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

interface DiagnosticLockRecord {
  lock_id: string;
  owner_id: string;
  profile_id: string;
  expires_at_ms: number;
  acquired_at_iso: string;
}

let isolateQueueTail: Promise<unknown> = Promise.resolve();
let isolateNextAvailableMs = 0;
const activeIsolateDiagnosticKeys = new Set<string>();

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

export async function acquireV2DiagnosticRunLock(params: {
  adminUserId: string;
  profileId: string;
}): Promise<{ acquired: boolean; lockId: string | null; reason?: string }> {
  const isolateKey = `${params.adminUserId}:${params.profileId}`;
  if (activeIsolateDiagnosticKeys.has(isolateKey) || activeIsolateDiagnosticKeys.size > 0) {
    return {
      acquired: false,
      lockId: null,
      reason: 'A V2 Engine diagnostic bundle run is already in progress. Please wait for it to finish.',
    };
  }

  const lockId = randomToken();
  activeIsolateDiagnosticKeys.add(isolateKey);

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { acquired: true, lockId };
  }

  try {
    const now = Date.now();
    const { data: existingRow } = await supabaseAdmin
      .from('platform_settings')
      .select('value_json')
      .eq('key', DIAGNOSTIC_LOCK_SETTINGS_KEY)
      .maybeSingle();

    const lockRecord: DiagnosticLockRecord = {
      lock_id: lockId,
      owner_id: params.adminUserId,
      profile_id: params.profileId,
      expires_at_ms: now + LOCK_TTL_MS,
      acquired_at_iso: new Date(now).toISOString(),
    };

    if (!existingRow) {
      const { error: insErr } = await supabaseAdmin.from('platform_settings').insert({
        key: DIAGNOSTIC_LOCK_SETTINGS_KEY,
        value_json: lockRecord,
        updated_at: new Date(now).toISOString(),
      });
      if (insErr) {
        activeIsolateDiagnosticKeys.delete(isolateKey);
        return {
          acquired: false,
          lockId: null,
          reason: 'Another V2 Engine diagnostic run is currently acquiring provider data. Please retry in a few seconds.',
        };
      }
      return { acquired: true, lockId };
    }

    const prev = (existingRow.value_json || {}) as Partial<DiagnosticLockRecord>;
    const prevExpires = Number(prev.expires_at_ms || 0);
    const prevLockId = typeof prev.lock_id === 'string' ? prev.lock_id : '';
    if (prevLockId && prevExpires > now) {
      activeIsolateDiagnosticKeys.delete(isolateKey);
      return {
        acquired: false,
        lockId: null,
        reason: 'Another V2 Engine diagnostic run is currently in progress across the server. Please wait for it to complete.',
      };
    }

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
      activeIsolateDiagnosticKeys.delete(isolateKey);
      return {
        acquired: false,
        lockId: null,
        reason: 'Concurrent V2 Engine diagnostic submission detected. Please wait for the active run to complete.',
      };
    }

    return { acquired: true, lockId };
  } catch {
    return { acquired: true, lockId };
  }
}

export async function releaseV2DiagnosticRunLock(params: {
  adminUserId: string;
  profileId: string;
  lockId: string | null;
}): Promise<void> {
  activeIsolateDiagnosticKeys.delete(`${params.adminUserId}:${params.profileId}`);
  if (!params.lockId) return;

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  try {
    await supabaseAdmin
      .from('platform_settings')
      .update({
        value_json: {
          lock_id: '',
          owner_id: '',
          profile_id: '',
          expires_at_ms: 0,
          acquired_at_iso: '',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('key', DIAGNOSTIC_LOCK_SETTINGS_KEY)
      .eq('value_json->>lock_id', params.lockId);
  } catch {
    // TTL safety expiry handles stale lock if release fails
  }
}
