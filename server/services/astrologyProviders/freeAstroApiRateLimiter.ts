/**
 * Provider-Wide FreeAstroAPI Rate-Limit Coordinator & Diagnostic Run Lock
 *
 * Pure Web Fetch + TypeScript + Supabase Admin CAS (Cloudflare Workers safe).
 * Coordinates the shared FREE_ASTRO_API_KEY 1 req/sec limit across:
 *   1. Concurrent requests inside the same Worker isolate (promise-chain mutex)
 *   2. Concurrent requests across separate Cloudflare Worker isolates and normal
 *      production traffic (optimistic CAS lease on public.platform_settings)
 *   3. Global 429 Retry-After backoff propagation across isolates
 *
 * Also manages an isolated diagnostic run lock so duplicate admin laboratory
 * submissions do not stack concurrent 4-6 request bundles on the shared key.
 */

import { getSupabaseAdmin } from '../../lib/supabaseAdmin';

const RATE_LIMIT_SETTINGS_KEY = 'rate_limit:freeastroapi';
const DIAGNOSTIC_LOCK_SETTINGS_KEY = 'lock:v2_diagnostic_run';
const DEFAULT_MIN_INTERVAL_MS = 1150;
const CAS_MAX_ATTEMPTS = 8;
const LOCK_TTL_MS = 45_000;
const STALE_HEARTBEAT_MS = 20_000;
const SAME_SESSION_ACTIVE_HEARTBEAT_MS = 3_000;

export type RateLimitCoordinationMode = 'global_supabase_cas' | 'isolate_memory_only';

export interface CoordinatedSlotResult {
  waitedMs: number;
  coordinationMode: RateLimitCoordinationMode;
  dispatchedAtMs: number;
}

interface RateLimitLeaseRecord {
  next_available_ms: number;
  lease_token: string;
  last_caller: string;
  updated_at_ms: number;
}

export interface DiagnosticLockRecord {
  lock_id: string;
  owner_id: string;
  profile_id: string;
  session_id: string | null;
  provider: string;
  status: 'running' | 'released';
  expires_at_ms: number;
  heartbeat_at_ms: number;
  acquired_at_iso: string;
  released_at_iso?: string | null;
}

interface IsolateLockEntry {
  lockId: string;
  ownerId: string;
  profileId: string;
  sessionId: string | null;
  provider: string;
  expiresAtMs: number;
  heartbeatAtMs: number;
}

let isolateQueueTail: Promise<unknown> = Promise.resolve();
let isolateNextAvailableMs = 0;
const activeIsolateDiagnosticLocks = new Map<string, IsolateLockEntry>();
let testClockOffsetMs = 0;

function currentNowMs(): number {
  return Date.now() + testClockOffsetMs;
}

export function setV2DiagnosticLockClockOffsetForTests(offsetMs: number): void {
  testClockOffsetMs = offsetMs;
}

export function resetV2DiagnosticLockForTests(): void {
  activeIsolateDiagnosticLocks.clear();
  testClockOffsetMs = 0;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomToken(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fallback below
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function reserveGlobalSupabaseSlot(
  minIntervalMs: number,
  callerTag: string
): Promise<{ slotAtMs: number; mode: RateLimitCoordinationMode }> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { slotAtMs: Date.now(), mode: 'isolate_memory_only' };
  }

  for (let attempt = 0; attempt < CAS_MAX_ATTEMPTS; attempt++) {
    const now = Date.now();
    try {
      const { data: existingRow, error: selectErr } = await supabaseAdmin
        .from('platform_settings')
        .select('value_json')
        .eq('key', RATE_LIMIT_SETTINGS_KEY)
        .maybeSingle();

      if (selectErr) {
        return { slotAtMs: now, mode: 'isolate_memory_only' };
      }

      if (!existingRow) {
        const slotAtMs = now;
        const initialLease: RateLimitLeaseRecord = {
          next_available_ms: slotAtMs + minIntervalMs,
          lease_token: randomToken(),
          last_caller: callerTag,
          updated_at_ms: now,
        };
        const { error: insertErr } = await supabaseAdmin.from('platform_settings').insert({
          key: RATE_LIMIT_SETTINGS_KEY,
          value_json: initialLease,
          updated_at: new Date(now).toISOString(),
        });

        if (!insertErr) {
          return { slotAtMs, mode: 'global_supabase_cas' };
        }
        // Contended insert; retry via CAS update
        await sleep(35 + attempt * 20);
        continue;
      }

      const prev = (existingRow.value_json || {}) as Partial<RateLimitLeaseRecord>;
      const prevNextMs =
        typeof prev.next_available_ms === 'number' && Number.isFinite(prev.next_available_ms)
          ? prev.next_available_ms
          : 0;
      const prevToken = typeof prev.lease_token === 'string' ? prev.lease_token : '';

      const slotAtMs = Math.max(now, prevNextMs);
      // Safety cap: never reserve further than 30s ahead from stale clock data
      const boundedSlotAtMs = Math.min(slotAtMs, now + 30_000);
      const nextLease: RateLimitLeaseRecord = {
        next_available_ms: boundedSlotAtMs + minIntervalMs,
        lease_token: randomToken(),
        last_caller: callerTag,
        updated_at_ms: now,
      };

      const updateQuery = supabaseAdmin
        .from('platform_settings')
        .update({
          value_json: nextLease,
          updated_at: new Date(now).toISOString(),
        })
        .eq('key', RATE_LIMIT_SETTINGS_KEY);

      const { data: updatedRows, error: updateErr } = prevToken
        ? await updateQuery.eq('value_json->>lease_token', prevToken).select('key')
        : await updateQuery.select('key');

      if (updateErr) {
        return { slotAtMs: now, mode: 'isolate_memory_only' };
      }

      if (Array.isArray(updatedRows) && updatedRows.length > 0) {
        return { slotAtMs: boundedSlotAtMs, mode: 'global_supabase_cas' };
      }

      // CAS contention: another isolate grabbed the slot; retry briefly
      await sleep(45 + attempt * 25);
    } catch {
      return { slotAtMs: Date.now(), mode: 'isolate_memory_only' };
    }
  }

  // Fallback after CAS contention: at least wait minIntervalMs in isolate
  return {
    slotAtMs: Date.now() + minIntervalMs,
    mode: 'isolate_memory_only',
  };
}

/**
 * Reserves the next available outbound FreeAstroAPI dispatch slot across both
 * isolate-level concurrency and distributed Cloudflare Worker isolates, then
 * executes `fn` and reports measured wait telemetry.
 */
export async function coordinateFreeAstroApiSlot<T>(
  fn: () => Promise<T>,
  options?: {
    minIntervalMs?: number;
    callerTag?: string;
  }
): Promise<{ result: T; slot: CoordinatedSlotResult }> {
  const minIntervalMs =
    typeof options?.minIntervalMs === 'number' && options.minIntervalMs >= 0
      ? options.minIntervalMs
      : DEFAULT_MIN_INTERVAL_MS;
  const callerTag = options?.callerTag || 'shared';

  const run = isolateQueueTail.then(async () => {
    const enterMs = Date.now();
    const { slotAtMs, mode } = await reserveGlobalSupabaseSlot(minIntervalMs, callerTag);
    const targetMs = Math.max(slotAtMs, isolateNextAvailableMs);
    const waitMs = Math.max(0, targetMs - Date.now());
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    const dispatchedAtMs = Date.now();
    isolateNextAvailableMs = Math.max(isolateNextAvailableMs, dispatchedAtMs + minIntervalMs);

    const result = await fn();
    return {
      result,
      slot: {
        waitedMs: Math.max(0, dispatchedAtMs - enterMs),
        coordinationMode: mode,
        dispatchedAtMs,
      },
    };
  });

  isolateQueueTail = run.catch(() => undefined);
  return run;
}

/**
 * Pushes the provider-wide next-available timestamp forward when FreeAstroAPI returns HTTP 429.
 */
export async function reportFreeAstroApi429Backoff(backoffMs: number): Promise<void> {
  const boundedBackoff = Math.min(30_000, Math.max(1000, Math.round(backoffMs)));
  const pushedUntil = Date.now() + boundedBackoff;
  isolateNextAvailableMs = Math.max(isolateNextAvailableMs, pushedUntil);

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  try {
    const { data: existingRow } = await supabaseAdmin
      .from('platform_settings')
      .select('value_json')
      .eq('key', RATE_LIMIT_SETTINGS_KEY)
      .maybeSingle();

    const prev = (existingRow?.value_json || {}) as Partial<RateLimitLeaseRecord>;
    const nextMs = Math.max(pushedUntil, Number(prev.next_available_ms || 0));
    const record: RateLimitLeaseRecord = {
      next_available_ms: nextMs,
      lease_token: randomToken(),
      last_caller: '429_backoff',
      updated_at_ms: Date.now(),
    };

    if (existingRow) {
      await supabaseAdmin
        .from('platform_settings')
        .update({
          value_json: record,
          updated_at: new Date().toISOString(),
        })
        .eq('key', RATE_LIMIT_SETTINGS_KEY);
    } else {
      await supabaseAdmin.from('platform_settings').insert({
        key: RATE_LIMIT_SETTINGS_KEY,
        value_json: record,
        updated_at: new Date().toISOString(),
      });
    }
  } catch {
    // Non-fatal; isolate backoff already applied
  }
}

function pruneStaleIsolateLocks(now: number): boolean {
  let prunedAny = false;
  for (const [id, entry] of activeIsolateDiagnosticLocks.entries()) {
    if (entry.expiresAtMs <= now || now - entry.heartbeatAtMs > STALE_HEARTBEAT_MS) {
      activeIsolateDiagnosticLocks.delete(id);
      prunedAny = true;
    }
  }
  return prunedAny;
}

function isLockStaleOrReleased(prev: Partial<DiagnosticLockRecord>, now: number): boolean {
  const prevLockId = typeof prev.lock_id === 'string' ? prev.lock_id.trim() : '';
  if (!prevLockId || prev.status === 'released') return true;
  const prevExpires = Number(prev.expires_at_ms || 0);
  if (!Number.isFinite(prevExpires) || prevExpires <= now) return true;
  const prevHeartbeat = Number(prev.heartbeat_at_ms || 0);
  if (Number.isFinite(prevHeartbeat) && prevHeartbeat > 0 && now - prevHeartbeat > STALE_HEARTBEAT_MS) {
    return true;
  }
  return false;
}

export interface AcquireV2DiagnosticLockParams {
  adminUserId: string;
  profileId: string;
  sessionId?: string | null;
  provider?: string;
  allowSameSessionResume?: boolean;
  lockTtlMs?: number;
}

export interface AcquireV2DiagnosticLockResult {
  acquired: boolean;
  lockId: string | null;
  recoveredStaleLock?: boolean;
  retryAfterMs?: number;
  code?: 'DIAGNOSTIC_RUN_IN_PROGRESS' | 'SAME_SESSION_BATCH_IN_PROGRESS';
  reason?: string;
}

export async function acquireV2DiagnosticRunLock(
  params: AcquireV2DiagnosticLockParams
): Promise<AcquireV2DiagnosticLockResult> {
  const requestedSessionId =
    typeof params.sessionId === 'string' && params.sessionId.trim()
      ? params.sessionId.trim()
      : null;
  const provider = params.provider || 'freeastroapi';
  const ttlMs = Math.max(10_000, params.lockTtlMs ?? LOCK_TTL_MS);

  // Brief settle retry if the same session's previous batch is still flushing its release
  const maxIsolateChecks = requestedSessionId ? 3 : 1;
  let recoveredIsolateStale = false;

  for (let check = 0; check < maxIsolateChecks; check++) {
    const now = currentNowMs();
    if (pruneStaleIsolateLocks(now)) {
      recoveredIsolateStale = true;
    }

    const activeEntries = Array.from(activeIsolateDiagnosticLocks.values());
    if (activeEntries.length === 0) break;

    const sameSessionEntry = requestedSessionId
      ? activeEntries.find((e) => e.sessionId === requestedSessionId)
      : undefined;
    const otherEntry = activeEntries.find(
      (e) => !requestedSessionId || e.sessionId !== requestedSessionId
    );

    if (otherEntry) {
      const remainingMs = Math.max(2000, otherEntry.expiresAtMs - now);
      return {
        acquired: false,
        lockId: null,
        retryAfterMs: remainingMs,
        code: 'DIAGNOSTIC_RUN_IN_PROGRESS',
        reason: `Another V2 Engine diagnostic run (${otherEntry.provider}) is currently in progress. Please wait for it to finish.`,
      };
    }

    if (sameSessionEntry) {
      const hbAgeMs = now - sameSessionEntry.heartbeatAtMs;
      const canTakeover =
        params.allowSameSessionResume && hbAgeMs >= SAME_SESSION_ACTIVE_HEARTBEAT_MS;
      if (canTakeover) {
        activeIsolateDiagnosticLocks.delete(sameSessionEntry.lockId);
        recoveredIsolateStale = true;
        break;
      }
      if (check < maxIsolateChecks - 1) {
        await sleep(300);
        continue;
      }
      return {
        acquired: false,
        lockId: null,
        retryAfterMs: 3500,
        code: 'SAME_SESSION_BATCH_IN_PROGRESS',
        reason: `Batch for diagnostic session ${requestedSessionId} is still finishing. Retrying momentarily.`,
      };
    }
  }

  const lockId = randomToken();
  const nowInitial = currentNowMs();
  const isolateEntry: IsolateLockEntry = {
    lockId,
    ownerId: params.adminUserId,
    profileId: params.profileId,
    sessionId: requestedSessionId,
    provider,
    expiresAtMs: nowInitial + ttlMs,
    heartbeatAtMs: nowInitial,
  };
  activeIsolateDiagnosticLocks.set(lockId, isolateEntry);

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return {
      acquired: true,
      lockId,
      ...(recoveredIsolateStale ? { recoveredStaleLock: true } : {}),
    };
  }

  try {
    const maxAttempts = requestedSessionId ? 4 : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const now = currentNowMs();
      const { data: existingRow } = await supabaseAdmin
        .from('platform_settings')
        .select('value_json')
        .eq('key', DIAGNOSTIC_LOCK_SETTINGS_KEY)
        .maybeSingle();

      const lockRecord: DiagnosticLockRecord = {
        lock_id: lockId,
        owner_id: params.adminUserId,
        profile_id: params.profileId,
        session_id: requestedSessionId,
        provider,
        status: 'running',
        expires_at_ms: now + ttlMs,
        heartbeat_at_ms: now,
        acquired_at_iso: new Date(now).toISOString(),
        released_at_iso: null,
      };

      if (!existingRow) {
        const { error: insErr } = await supabaseAdmin.from('platform_settings').insert({
          key: DIAGNOSTIC_LOCK_SETTINGS_KEY,
          value_json: lockRecord,
          updated_at: new Date(now).toISOString(),
        });
        if (insErr) {
          if (attempt < maxAttempts - 1) {
            await sleep(250);
            continue;
          }
          activeIsolateDiagnosticLocks.delete(lockId);
          return {
            acquired: false,
            lockId: null,
            retryAfterMs: 4000,
            code: 'DIAGNOSTIC_RUN_IN_PROGRESS',
            reason:
              'Another V2 Engine diagnostic run is currently acquiring provider data. Please retry in a few seconds.',
          };
        }
        return {
          acquired: true,
          lockId,
          ...(recoveredIsolateStale ? { recoveredStaleLock: true } : {}),
        };
      }

      const prev = (existingRow.value_json || {}) as Partial<DiagnosticLockRecord>;
      const prevLockId = typeof prev.lock_id === 'string' ? prev.lock_id : '';
      const prevSessionId =
        typeof prev.session_id === 'string' && prev.session_id.trim()
          ? prev.session_id.trim()
          : null;
      const prevHeartbeat = Number(prev.heartbeat_at_ms || 0);
      const staleOrReleased = isLockStaleOrReleased(prev, now);
      const sameSession = Boolean(requestedSessionId && prevSessionId === requestedSessionId);

      if (!staleOrReleased) {
        if (!sameSession) {
          activeIsolateDiagnosticLocks.delete(lockId);
          return {
            acquired: false,
            lockId: null,
            retryAfterMs: Math.max(3000, Math.min(20_000, Number(prev.expires_at_ms || now) - now)),
            code: 'DIAGNOSTIC_RUN_IN_PROGRESS',
            reason: `Another V2 Engine diagnostic run (${prev.provider || 'active'}) is currently in progress across the server. Please wait for it to complete.`,
          };
        }

        // Same session still shows a live row: allow brief wait for release or takeover if manual resume & stale heartbeat
        const hbAgeMs = prevHeartbeat > 0 ? now - prevHeartbeat : STALE_HEARTBEAT_MS + 1;
        const canTakeoverSameSession =
          params.allowSameSessionResume &&
          prev.owner_id === params.adminUserId &&
          hbAgeMs >= SAME_SESSION_ACTIVE_HEARTBEAT_MS;

        if (!canTakeoverSameSession) {
          if (attempt < maxAttempts - 1) {
            await sleep(350);
            continue;
          }
          activeIsolateDiagnosticLocks.delete(lockId);
          return {
            acquired: false,
            lockId: null,
            retryAfterMs: 3500,
            code: 'SAME_SESSION_BATCH_IN_PROGRESS',
            reason:
              'The previous batch for this diagnostic session is still completing on the server. Retrying shortly.',
          };
        }
      }

      const recoveredStale =
        recoveredIsolateStale ||
        Boolean(prevLockId && prev.status !== 'released' && (staleOrReleased || sameSession));

      const updateQuery = supabaseAdmin
        .from('platform_settings')
        .update({
          value_json: lockRecord,
          updated_at: new Date(now).toISOString(),
        })
        .eq('key', DIAGNOSTIC_LOCK_SETTINGS_KEY);

      const { data: updatedRows, error: updErr } = prevLockId
        ? await updateQuery.eq('value_json->>lock_id', prevLockId).select('key')
        : await updateQuery.select('key');

      if (updErr || !Array.isArray(updatedRows) || updatedRows.length === 0) {
        if (attempt < maxAttempts - 1) {
          await sleep(250);
          continue;
        }
        activeIsolateDiagnosticLocks.delete(lockId);
        return {
          acquired: false,
          lockId: null,
          retryAfterMs: 4000,
          code: 'DIAGNOSTIC_RUN_IN_PROGRESS',
          reason:
            'Concurrent V2 Engine diagnostic submission detected. Please wait for the active run to complete.',
        };
      }

      return {
        acquired: true,
        lockId,
        ...(recoveredStale ? { recoveredStaleLock: true } : {}),
      };
    }

    activeIsolateDiagnosticLocks.delete(lockId);
    return {
      acquired: false,
      lockId: null,
      retryAfterMs: 4000,
      code: 'DIAGNOSTIC_RUN_IN_PROGRESS',
      reason: 'Unable to acquire V2 diagnostic execution lock after retries.',
    };
  } catch {
    return { acquired: true, lockId };
  }
}

export async function renewV2DiagnosticRunLock(params: {
  lockId: string | null;
  sessionId?: string | null;
  extendMs?: number;
}): Promise<boolean> {
  if (!params.lockId) return false;
  const now = currentNowMs();
  const extendMs = Math.max(10_000, params.extendMs ?? LOCK_TTL_MS);

  const memEntry = activeIsolateDiagnosticLocks.get(params.lockId);
  if (memEntry) {
    memEntry.heartbeatAtMs = now;
    memEntry.expiresAtMs = now + extendMs;
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return Boolean(memEntry);

  try {
    const { data: existingRow } = await supabaseAdmin
      .from('platform_settings')
      .select('value_json')
      .eq('key', DIAGNOSTIC_LOCK_SETTINGS_KEY)
      .maybeSingle();

    const prev = (existingRow?.value_json || {}) as Partial<DiagnosticLockRecord>;
    if (prev.lock_id !== params.lockId || prev.status === 'released') {
      return false;
    }

    const renewed: DiagnosticLockRecord = {
      lock_id: params.lockId,
      owner_id: String(prev.owner_id || ''),
      profile_id: String(prev.profile_id || ''),
      session_id: params.sessionId ?? prev.session_id ?? null,
      provider: String(prev.provider || 'astroway'),
      status: 'running',
      expires_at_ms: now + extendMs,
      heartbeat_at_ms: now,
      acquired_at_iso: String(prev.acquired_at_iso || new Date(now).toISOString()),
      released_at_iso: null,
    };

    const { data: updatedRows, error } = await supabaseAdmin
      .from('platform_settings')
      .update({
        value_json: renewed,
        updated_at: new Date(now).toISOString(),
      })
      .eq('key', DIAGNOSTIC_LOCK_SETTINGS_KEY)
      .eq('value_json->>lock_id', params.lockId)
      .select('key');

    return !error && Array.isArray(updatedRows) && updatedRows.length > 0;
  } catch {
    return Boolean(memEntry);
  }
}

export async function releaseV2DiagnosticRunLock(params: {
  adminUserId: string;
  profileId: string;
  lockId: string | null;
  sessionId?: string | null;
}): Promise<void> {
  if (params.lockId) {
    activeIsolateDiagnosticLocks.delete(params.lockId);
  }
  if (!params.lockId) return;

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  const now = currentNowMs();
  try {
    const releasedRecord: DiagnosticLockRecord = {
      lock_id: '',
      owner_id: params.adminUserId,
      profile_id: params.profileId,
      session_id: params.sessionId ?? null,
      provider: '',
      status: 'released',
      expires_at_ms: 0,
      heartbeat_at_ms: now,
      acquired_at_iso: '',
      released_at_iso: new Date(now).toISOString(),
    };
    await supabaseAdmin
      .from('platform_settings')
      .update({
        value_json: releasedRecord,
        updated_at: new Date(now).toISOString(),
      })
      .eq('key', DIAGNOSTIC_LOCK_SETTINGS_KEY)
      .eq('value_json->>lock_id', params.lockId);
  } catch {
    // TTL + stale heartbeat safety expiry handles stale lock if release fails
  }
}

