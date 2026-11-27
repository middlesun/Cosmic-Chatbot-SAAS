/**
 * Isolated V2 Engine — AstroWay Global Rate-Limit Coordinator & Resumable Session Store
 *
 * Pure TypeScript + Supabase Admin CAS/KV (Cloudflare Workers safe, zero Node fs/path).
 *
 * Responsibilities:
 *  1. Persist AstroWay's provider rate-limit reset window (`rate_limit:astroway`)
 *     across Cloudflare Worker isolates & invocations using `Retry-After` and
 *     `x-ratelimit-reset` / `x-ratelimit-remaining` headers.
 *  2. Persist resumable batched AstroWay acquisition sessions (`v2_diag_session:<id>`)
 *     so bounded Worker batches (e.g. 8–9 requests per invocation) accumulate
 *     successful responses cleanly across rate-limit windows without re-calling
 *     already-succeeded or permanently restricted/unoffered endpoints.
 */

import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import type { RateLimitCoordinationMode } from '../astrologyProviders/freeAstroApiRateLimiter';
import type { SanitizedProviderCallRecord } from './types';

const ASTROWAY_RATE_LIMIT_KEY = 'rate_limit:astroway';
const ASTROWAY_SESSION_PREFIX = 'v2_diag_session:';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_RATE_WAIT_CLAMP_MS = 180_000;

export interface AstroWayRateLimitState {
  window_reset_ms: number;
  remaining_in_window: number | null;
  limit: number | null;
  last_retry_after_ms: number | null;
  reset_source: string | null;
  total_window_wait_ms: number;
  updated_at_ms: number;
}

export interface AstroWayBatchSessionRecord {
  sessionId: string;
  providerId: 'astroway';
  inputFingerprint: string;
  includeTimezoneEquivalenceProbe: boolean;
  batchIndex: number;
  totalRateLimitWindowWaitMs: number;
  createdAtMs: number;
  updatedAtMs: number;
  calls: Record<string, SanitizedProviderCallRecord>;
}

let isolateRateState: AstroWayRateLimitState = {
  window_reset_ms: 0,
  remaining_in_window: null,
  limit: null,
  last_retry_after_ms: null,
  reset_source: null,
  total_window_wait_ms: 0,
  updated_at_ms: 0,
};

const isolateSessions = new Map<string, AstroWayBatchSessionRecord>();

export function parseAstroWayRateLimitHeaders(
  headers: Record<string, string>,
  nowMs = Date.now()
): {
  retryAfterMs: number | null;
  windowResetAtMs: number | null;
  remaining: number | null;
  limit: number | null;
  resetSource: string | null;
} {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    lower[k.toLowerCase()] = String(v).trim();
  }

  const rawLimit = lower['x-ratelimit-limit'] ?? lower['ratelimit-limit'] ?? '';
  const rawRemaining = lower['x-ratelimit-remaining'] ?? lower['ratelimit-remaining'] ?? '';
  const rawReset = lower['x-ratelimit-reset'] ?? lower['ratelimit-reset'] ?? '';
  const rawRetryAfter = lower['retry-after'] ?? '';

  const limitNum = rawLimit !== '' && Number.isFinite(Number(rawLimit)) ? Number(rawLimit) : null;
  const remainingNum =
    rawRemaining !== '' && Number.isFinite(Number(rawRemaining)) ? Number(rawRemaining) : null;

  let retryAfterMs: number | null = null;
  let retryResetMs: number | null = null;
  let resetSource: string | null = null;

  if (rawRetryAfter) {
    if (/^\d+(\.\d+)?$/.test(rawRetryAfter)) {
      const sec = Number(rawRetryAfter);
      if (Number.isFinite(sec) && sec >= 0) {
        retryAfterMs = Math.min(MAX_RATE_WAIT_CLAMP_MS, Math.ceil(sec * 1000));
        retryResetMs = nowMs + retryAfterMs;
        resetSource = `retry-after:${rawRetryAfter}s`;
      }
    } else {
      const parsedDateMs = Date.parse(rawRetryAfter);
      if (Number.isFinite(parsedDateMs)) {
        const diff = Math.max(0, Math.min(MAX_RATE_WAIT_CLAMP_MS, parsedDateMs - nowMs));
        retryAfterMs = diff;
        retryResetMs = nowMs + diff;
        resetSource = `retry-after-date:${rawRetryAfter}`;
      }
    }
  }

  let headerResetMs: number | null = null;
  if (rawReset) {
    if (/^\d+(\.\d+)?$/.test(rawReset)) {
      const val = Number(rawReset);
      if (Number.isFinite(val)) {
        if (val > 1_000_000_000_000) {
          // Epoch ms
          headerResetMs = Math.min(nowMs + MAX_RATE_WAIT_CLAMP_MS, Math.max(nowMs, val));
        } else if (val > 1_000_000_000) {
          // Epoch seconds
          const ms = val * 1000;
          headerResetMs = Math.min(nowMs + MAX_RATE_WAIT_CLAMP_MS, Math.max(nowMs, ms));
        } else if (val >= 0) {
          // Delta seconds
          headerResetMs = nowMs + Math.min(MAX_RATE_WAIT_CLAMP_MS, Math.ceil(val * 1000));
        }
        if (headerResetMs !== null && !resetSource) {
          resetSource = `x-ratelimit-reset:${rawReset}`;
        }
      }
    } else {
      const parsedReset = Date.parse(rawReset);
      if (Number.isFinite(parsedReset)) {
        headerResetMs = Math.min(nowMs + MAX_RATE_WAIT_CLAMP_MS, Math.max(nowMs, parsedReset));
        if (!resetSource) resetSource = `x-ratelimit-reset-date:${rawReset}`;
      }
    }
  }

  let windowResetAtMs: number | null = null;
  if (retryResetMs !== null && headerResetMs !== null) {
    windowResetAtMs = Math.max(retryResetMs, headerResetMs);
    resetSource = `${resetSource || 'retry-after'} + x-ratelimit-reset`;
  } else {
    windowResetAtMs = retryResetMs ?? headerResetMs;
  }

  if (retryAfterMs === null && windowResetAtMs !== null) {
    retryAfterMs = Math.max(0, windowResetAtMs - nowMs);
  }

  return {
    retryAfterMs,
    windowResetAtMs,
    remaining: remainingNum,
    limit: limitNum,
    resetSource,
  };
}

export async function readAstroWayGlobalRateState(): Promise<{
  state: AstroWayRateLimitState;
  coordinationMode: RateLimitCoordinationMode;
}> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { state: { ...isolateRateState }, coordinationMode: 'isolate_memory_only' };
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('value_json')
      .eq('key', ASTROWAY_RATE_LIMIT_KEY)
      .maybeSingle();

    if (error) {
      return { state: { ...isolateRateState }, coordinationMode: 'isolate_memory_only' };
    }
    const raw = (data?.value_json || {}) as Partial<AstroWayRateLimitState>;
    const merged: AstroWayRateLimitState = {
      window_reset_ms: Math.max(
        isolateRateState.window_reset_ms,
        Number(raw.window_reset_ms || 0)
      ),
      remaining_in_window:
        typeof raw.remaining_in_window === 'number'
          ? raw.remaining_in_window
          : isolateRateState.remaining_in_window,
      limit: typeof raw.limit === 'number' ? raw.limit : isolateRateState.limit,
      last_retry_after_ms:
        typeof raw.last_retry_after_ms === 'number'
          ? raw.last_retry_after_ms
          : isolateRateState.last_retry_after_ms,
      reset_source:
        typeof raw.reset_source === 'string' ? raw.reset_source : isolateRateState.reset_source,
      total_window_wait_ms: Math.max(
        isolateRateState.total_window_wait_ms,
        Number(raw.total_window_wait_ms || 0)
      ),
      updated_at_ms: Math.max(isolateRateState.updated_at_ms, Number(raw.updated_at_ms || 0)),
    };
    isolateRateState = merged;
    return { state: merged, coordinationMode: 'global_supabase_cas' };
  } catch {
    return { state: { ...isolateRateState }, coordinationMode: 'isolate_memory_only' };
  }
}

export async function writeAstroWayGlobalRateState(
  next: AstroWayRateLimitState
): Promise<RateLimitCoordinationMode> {
  isolateRateState = { ...next };
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return 'isolate_memory_only';
  try {
    const { data: existing } = await supabaseAdmin
      .from('platform_settings')
      .select('key')
      .eq('key', ASTROWAY_RATE_LIMIT_KEY)
      .maybeSingle();
    const nowIso = new Date().toISOString();
    if (existing) {
      const { error } = await supabaseAdmin
        .from('platform_settings')
        .update({ value_json: next, updated_at: nowIso })
        .eq('key', ASTROWAY_RATE_LIMIT_KEY);
      return error ? 'isolate_memory_only' : 'global_supabase_cas';
    }
    const { error } = await supabaseAdmin
      .from('platform_settings')
      .insert({ key: ASTROWAY_RATE_LIMIT_KEY, value_json: next, updated_at: nowIso });
    return error ? 'isolate_memory_only' : 'global_supabase_cas';
  } catch {
    return 'isolate_memory_only';
  }
}

export async function resetAstroWayIsolateRateStateForTests(): Promise<void> {
  isolateRateState = {
    window_reset_ms: 0,
    remaining_in_window: null,
    limit: null,
    last_retry_after_ms: null,
    reset_source: null,
    total_window_wait_ms: 0,
    updated_at_ms: 0,
  };
}

export function generateSessionId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fallback
  }
  return `aw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function loadAstroWayBatchSession(
  sessionId: string
): Promise<AstroWayBatchSessionRecord | null> {
  const cleanId = sessionId.trim();
  if (!cleanId) return null;

  const mem = isolateSessions.get(cleanId);
  if (mem && Date.now() - mem.updatedAtMs < SESSION_TTL_MS) {
    return mem;
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('value_json')
      .eq('key', `${ASTROWAY_SESSION_PREFIX}${cleanId}`)
      .maybeSingle();
    if (error || !data?.value_json) return null;
    const rec = data.value_json as AstroWayBatchSessionRecord;
    if (Date.now() - Number(rec.updatedAtMs || 0) > SESSION_TTL_MS) {
      return null;
    }
    isolateSessions.set(cleanId, rec);
    return rec;
  } catch {
    return null;
  }
}

export async function saveAstroWayBatchSession(
  record: AstroWayBatchSessionRecord
): Promise<void> {
  isolateSessions.set(record.sessionId, record);

  // Prune stale isolate sessions
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [k, v] of isolateSessions.entries()) {
    if (v.updatedAtMs < cutoff) isolateSessions.delete(k);
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  const key = `${ASTROWAY_SESSION_PREFIX}${record.sessionId}`;
  const nowIso = new Date().toISOString();
  try {
    const { data: existing } = await supabaseAdmin
      .from('platform_settings')
      .select('key')
      .eq('key', key)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin
        .from('platform_settings')
        .update({ value_json: record, updated_at: nowIso })
        .eq('key', key);
    } else {
      await supabaseAdmin
        .from('platform_settings')
        .insert({ key, value_json: record, updated_at: nowIso });
    }
  } catch {
    // Non-fatal: isolate store retains session
  }
}
