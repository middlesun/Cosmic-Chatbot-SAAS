import crypto from 'crypto';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { getPipelineLoggingEnabledFast } from './platformSettings';

export type PipelinePillar = 'council' | 'companion' | 'clarity';

export interface ChatbotPipelineLogEntry {
  id: string;
  created_at: string;
  user_id?: string | null;
  conversation_id?: string | null;
  profile_id?: string | null;
  pillar?: PipelinePillar | null;
  expert_slug?: string | null;
  mode_slug?: string | null;
  response_length?: string | null;
  user_prompt_preview?: string | null;
  action_taken: string;
  stage1_json?: Record<string, unknown> | null;
  stage2_json?: Record<string, unknown> | null;
  stage3_json?: Record<string, unknown> | null;
  stage4_json?: Record<string, unknown> | null;
  total_latency_ms: number;
  error_message?: string | null;
}

export interface RecordChatbotPipelineLogInput {
  user_id?: string | null;
  conversation_id?: string | null;
  profile_id?: string | null;
  pillar?: PipelinePillar | null;
  expert_slug?: string | null;
  mode_slug?: string | null;
  response_length?: string | null;
  user_prompt_preview?: string | null;
  action_taken: string;
  stage1_json?: Record<string, unknown> | null;
  stage2_json?: Record<string, unknown> | null;
  stage3_json?: Record<string, unknown> | null;
  stage4_json?: Record<string, unknown> | null;
  total_latency_ms: number;
  error_message?: string | null;
}

export const PIPELINE_LOGS_MAX_ROWS = 500;
export const PIPELINE_LOGS_RETENTION_DAYS = 30;
export const MAX_TELEMETRY_PROMPT_PREVIEW_CHARS = 10_000;

const MAX_MEMORY_LOGS = 120;
const memoryLogBuffer: ChatbotPipelineLogEntry[] = [];
let lastWriteError: string | null = null;
let pillarColumnAvailable: boolean | null = null;
let lastAutoPruneAt = 0;
const AUTO_PRUNE_INTERVAL_MS = 10 * 60 * 1000;

function deriveLogPillar(entry: {
  pillar?: string | null;
  expert_slug?: string | null;
  stage1_json?: Record<string, unknown> | null;
}): PipelinePillar {
  if (entry.pillar === 'companion' || entry.pillar === 'clarity' || entry.pillar === 'council') {
    return entry.pillar;
  }
  const s1Pillar = entry.stage1_json?.pillar;
  if (s1Pillar === 'companion' || s1Pillar === 'clarity' || s1Pillar === 'council') {
    return s1Pillar;
  }
  const expert = String(entry.expert_slug || '').trim().toLowerCase();
  if (expert === 'companion' || expert.startsWith('companion:')) {
    return 'companion';
  }
  if (expert === 'clarity' || expert === 'clarity_helper') {
    return 'clarity';
  }
  return 'council';
}

export function redactTelemetrySecrets(raw: string): string {
  if (!raw) return '';
  let out = String(raw);

  // Strip well-known token / API key patterns
  out = out
    .replace(/\b(sk-[A-Za-z0-9_-]{12,})\b/g, '[REDACTED_KEY]')
    .replace(/\b(rk_[A-Za-z0-9_-]{12,}|pk_[A-Za-z0-9_-]{12,}|whsec_[A-Za-z0-9_-]{10,}|re_[A-Za-z0-9_-]{12,}|sb_secret_[A-Za-z0-9_-]{10,})\b/g, '[REDACTED_KEY]')
    .replace(/(Authorization\s*:\s*Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED_TOKEN]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]{16,}\b/g, 'Bearer [REDACTED_TOKEN]')
    .replace(/\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_JWT]');

  // Redact explicit configured server env secrets if any fragment ever appeared
  const envSecretNames = [
    'OPENROUTER_API_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ASTROLOGY_API_KEY',
    'DODO_PAYMENTS_API_KEY',
    'DODO_PAYMENTS_WEBHOOK_SECRET',
    'RESEND_API_KEY',
  ];
  for (const name of envSecretNames) {
    const val = process.env[name]?.trim();
    if (val && val.length >= 8 && out.includes(val)) {
      out = out.split(val).join(`[REDACTED_${name}]`);
    }
  }

  return out;
}

export function capTelemetryPreview(
  raw: string | null | undefined,
  maxChars = MAX_TELEMETRY_PROMPT_PREVIEW_CHARS
): string | null {
  if (!raw) return null;
  const redacted = redactTelemetrySecrets(String(raw)).trim();
  if (!redacted) return null;
  if (redacted.length <= maxChars) return redacted;
  return `${redacted.slice(0, maxChars)}\n... [truncated telemetry preview at ${maxChars} chars]`;
}

function sanitizeJsonValue(val: unknown, depth = 0): unknown {
  if (val === null || val === undefined) return val;
  if (depth > 6) return '[truncated_depth]';
  if (typeof val === 'string') {
    const redacted = redactTelemetrySecrets(val);
    if (redacted.length > MAX_TELEMETRY_PROMPT_PREVIEW_CHARS + 120) {
      return `${redacted.slice(0, MAX_TELEMETRY_PROMPT_PREVIEW_CHARS)}\n... [truncated]`;
    }
    return redacted;
  }
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (Array.isArray(val)) {
    return val.slice(0, 80).map((item) => sanitizeJsonValue(item, depth + 1));
  }
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v === undefined) continue;
      // Never persist raw chart_json blobs or private secret keys in logs
      if (/^(chart_json|service_role|api_key|secret|authorization|password)$/i.test(k)) {
        out[k] = '[OMITTED]';
        continue;
      }
      out[k] = sanitizeJsonValue(v, depth + 1);
    }
    return out;
  }
  return String(val).slice(0, 200);
}

function sanitizeStageJson(
  obj: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!obj || typeof obj !== 'object') return null;
  return sanitizeJsonValue(obj, 0) as Record<string, unknown>;
}

function pushToMemoryBuffer(entry: ChatbotPipelineLogEntry): void {
  memoryLogBuffer.unshift(entry);
  if (memoryLogBuffer.length > MAX_MEMORY_LOGS) {
    memoryLogBuffer.length = MAX_MEMORY_LOGS;
  }
}

export async function isPipelineLoggingEnabled(): Promise<boolean> {
  try {
    return await getPipelineLoggingEnabledFast();
  } catch {
    return false;
  }
}

export async function isPipelineLogsTableReady(): Promise<boolean> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return false;
  try {
    const { error } = await supabaseAdmin
      .from('chatbot_pipeline_logs')
      .select('id')
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}

async function runOpportunisticRetentionPrune(): Promise<void> {
  const now = Date.now();
  if (now - lastAutoPruneAt < AUTO_PRUNE_INTERVAL_MS) return;
  lastAutoPruneAt = now;

  // Prune in-memory buffer by age as well
  const cutoffIso = new Date(now - PIPELINE_LOGS_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  for (let i = memoryLogBuffer.length - 1; i >= 0; i--) {
    if (memoryLogBuffer[i].created_at < cutoffIso) {
      memoryLogBuffer.splice(i, 1);
    }
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  try {
    await supabaseAdmin
      .from('chatbot_pipeline_logs')
      .delete()
      .lt('created_at', cutoffIso);

    // Keep row count capped at PIPELINE_LOGS_MAX_ROWS
    const { data: overflowPivot } = await supabaseAdmin
      .from('chatbot_pipeline_logs')
      .select('created_at')
      .order('created_at', { ascending: false })
      .range(PIPELINE_LOGS_MAX_ROWS, PIPELINE_LOGS_MAX_ROWS)
      .maybeSingle();

    if (overflowPivot?.created_at) {
      await supabaseAdmin
        .from('chatbot_pipeline_logs')
        .delete()
        .lte('created_at', overflowPivot.created_at);
    }
  } catch {
    // Non-fatal background maintenance
  }
}

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    /column .*pillar.* does not exist/i.test(error.message || '') ||
    /could not find the ['"]pillar['"] column/i.test(error.message || '')
  );
}

/**
 * Records a compact diagnostic trace for one chatbot turn whenever Admin logging is enabled.
 * Never logs raw system_prompts, chart_json, or API secrets.
 */
export async function recordChatbotPipelineLog(
  input: RecordChatbotPipelineLogInput
): Promise<void> {
  try {
    const enabled = await isPipelineLoggingEnabled();
    if (!enabled) return;

    const derivedPillar = deriveLogPillar(input);
    const sanitizedStage1 = sanitizeStageJson(input.stage1_json);
    const stage1WithPillar = sanitizedStage1
      ? { pillar: derivedPillar, ...sanitizedStage1 }
      : { pillar: derivedPillar };

    const entry: ChatbotPipelineLogEntry = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      user_id: input.user_id || null,
      conversation_id: input.conversation_id || null,
      profile_id: input.profile_id || null,
      pillar: derivedPillar,
      expert_slug: input.expert_slug || null,
      mode_slug: input.mode_slug || null,
      response_length: input.response_length || null,
      user_prompt_preview: input.user_prompt_preview
        ? redactTelemetrySecrets(input.user_prompt_preview)
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 220)
        : null,
      action_taken: input.action_taken || 'proceed',
      stage1_json: stage1WithPillar,
      stage2_json: sanitizeStageJson(input.stage2_json),
      stage3_json: sanitizeStageJson(input.stage3_json),
      stage4_json: sanitizeStageJson(input.stage4_json),
      total_latency_ms: Math.max(0, Math.round(input.total_latency_ms || 0)),
      error_message: input.error_message
        ? redactTelemetrySecrets(String(input.error_message)).slice(0, 320)
        : null,
    };

    pushToMemoryBuffer(entry);

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return;

    const basePayload = {
      id: entry.id,
      created_at: entry.created_at,
      user_id: entry.user_id,
      conversation_id: entry.conversation_id,
      profile_id: entry.profile_id,
      expert_slug: entry.expert_slug,
      mode_slug: entry.mode_slug,
      response_length: entry.response_length,
      user_prompt_preview: entry.user_prompt_preview,
      action_taken: entry.action_taken,
      stage1_json: entry.stage1_json,
      stage2_json: entry.stage2_json,
      stage3_json: entry.stage3_json,
      stage4_json: entry.stage4_json,
      total_latency_ms: entry.total_latency_ms,
      error_message: entry.error_message,
    };

    const logsTable = (supabaseAdmin as unknown as {
      from: (table: string) => {
        insert: (row: Record<string, unknown>) => Promise<{ error: { code?: string; message?: string } | null }>;
      };
    }).from('chatbot_pipeline_logs');

    let insertRes = await logsTable.insert(
      pillarColumnAvailable === false
        ? basePayload
        : { ...basePayload, pillar: entry.pillar }
    );

    if (insertRes.error && isMissingColumnError(insertRes.error)) {
      pillarColumnAvailable = false;
      insertRes = await logsTable.insert(basePayload);
    } else if (!insertRes.error && pillarColumnAvailable === null) {
      pillarColumnAvailable = true;
    }

    if (insertRes.error) {
      lastWriteError = `${insertRes.error.code ? `[${insertRes.error.code}] ` : ''}${insertRes.error.message || 'Insert failed'}`;
      if (insertRes.error.code !== '42P01') {
        console.warn('[pipelineLogger] Supabase insert warning:', insertRes.error.message);
      }
    } else {
      lastWriteError = null;
      void runOpportunisticRetentionPrune();
    }
  } catch (err) {
    lastWriteError = err instanceof Error ? err.message : 'Unexpected telemetry write failure';
  }
}

function filterLogsInMemory(
  entries: ChatbotPipelineLogEntry[],
  options: {
    limit: number;
    actionFilter: string;
    pillarFilter: string;
    companionSlug: string;
  }
): ChatbotPipelineLogEntry[] {
  const slugTarget = options.companionSlug.toLowerCase();
  return entries
    .map((l) => ({
      ...l,
      pillar: deriveLogPillar(l),
    }))
    .filter((l) => {
      if (options.actionFilter && options.actionFilter !== 'all' && l.action_taken !== options.actionFilter) {
        return false;
      }
      if (options.pillarFilter && options.pillarFilter !== 'all' && l.pillar !== options.pillarFilter) {
        return false;
      }
      if (slugTarget) {
        const s1Slug = typeof l.stage1_json?.companion_slug === 'string' ? l.stage1_json.companion_slug.toLowerCase() : '';
        const exp = String(l.expert_slug || '').toLowerCase();
        if (s1Slug !== slugTarget && exp !== `companion:${slugTarget}` && exp !== slugTarget) {
          return false;
        }
      }
      return true;
    })
    .slice(0, options.limit);
}

export async function getChatbotPipelineLogs(options?: {
  limit?: number;
  actionFilter?: string;
  pillarFilter?: string;
  companionSlug?: string;
}): Promise<{
  logs: ChatbotPipelineLogEntry[];
  storage: 'supabase' | 'memory';
  tableMissing: boolean;
  schemaCacheStale: boolean;
  schemaErrorDetail: string | null;
}> {
  const limit = Math.max(1, Math.min(200, options?.limit || 60));
  const actionFilter = options?.actionFilter?.trim() || 'all';
  const pillarFilter = options?.pillarFilter?.trim().toLowerCase() || 'all';
  const companionSlug = options?.companionSlug?.trim() || '';
  const supabaseAdmin = getSupabaseAdmin();

  const baseSelectCols =
    'id, created_at, user_id, conversation_id, profile_id, expert_slug, mode_slug, response_length, user_prompt_preview, action_taken, stage1_json, stage2_json, stage3_json, stage4_json, total_latency_ms, error_message';
  const withPillarCols =
    'id, created_at, user_id, conversation_id, profile_id, pillar, expert_slug, mode_slug, response_length, user_prompt_preview, action_taken, stage1_json, stage2_json, stage3_json, stage4_json, total_latency_ms, error_message';

  if (supabaseAdmin) {
    try {
      // Fetch extra window when filtering by derived pillar/companionSlug pre-migration
      const fetchLimit =
        (pillarFilter && pillarFilter !== 'all') || companionSlug
          ? Math.min(400, Math.max(limit * 3, 180))
          : limit;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tableClient = (supabaseAdmin as any).from('chatbot_pipeline_logs');
      let query = tableClient
        .select(pillarColumnAvailable === false ? baseSelectCols : withPillarCols)
        .order('created_at', { ascending: false })
        .limit(fetchLimit);

      if (actionFilter && actionFilter !== 'all') {
        query = query.eq('action_taken', actionFilter);
      }
      if (pillarFilter && pillarFilter !== 'all' && pillarColumnAvailable === true) {
        query = query.eq('pillar', pillarFilter);
      }
      if (companionSlug) {
        query = query.eq('expert_slug', `companion:${companionSlug.toLowerCase()}`);
      }

      let result = await query;
      if (result.error && isMissingColumnError(result.error)) {
        pillarColumnAvailable = false;
        let fallbackQuery = tableClient
          .select(baseSelectCols)
          .order('created_at', { ascending: false })
          .limit(fetchLimit);
        if (actionFilter && actionFilter !== 'all') {
          fallbackQuery = fallbackQuery.eq('action_taken', actionFilter);
        }
        if (companionSlug) {
          fallbackQuery = fallbackQuery.eq('expert_slug', `companion:${companionSlug.toLowerCase()}`);
        }
        result = await fallbackQuery;
      } else if (!result.error && pillarColumnAvailable === null) {
        pillarColumnAvailable = true;
      }

      const { data, error } = result;
      if (!error && Array.isArray(data)) {
        const filtered = filterLogsInMemory(data as unknown as ChatbotPipelineLogEntry[], {
          limit,
          actionFilter,
          pillarFilter,
          companionSlug,
        });
        return {
          logs: filtered,
          storage: 'supabase',
          tableMissing: false,
          schemaCacheStale: false,
          schemaErrorDetail: filtered.length === 0 ? lastWriteError : null,
        };
      }

      const errCode = error?.code || '';
      const errMsg = error?.message || '';
      const schemaCacheStale =
        errCode === 'PGRST205' || /schema cache/i.test(errMsg);
      const isMissing =
        errCode === '42P01' ||
        schemaCacheStale ||
        /relation .*chatbot_pipeline_logs.* does not exist/i.test(errMsg);
      const filteredMem = filterLogsInMemory(memoryLogBuffer, {
        limit,
        actionFilter,
        pillarFilter,
        companionSlug,
      });
      return {
        logs: filteredMem,
        storage: 'memory',
        tableMissing: isMissing,
        schemaCacheStale,
        schemaErrorDetail:
          errMsg || lastWriteError
            ? `${errCode ? `[${errCode}] ` : ''}${errMsg || lastWriteError}`.trim()
            : null,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Query exception';
      return {
        logs: filterLogsInMemory(memoryLogBuffer, {
          limit,
          actionFilter,
          pillarFilter,
          companionSlug,
        }),
        storage: 'memory',
        tableMissing: false,
        schemaCacheStale: false,
        schemaErrorDetail: msg,
      };
    }
  }

  return {
    logs: filterLogsInMemory(memoryLogBuffer, {
      limit,
      actionFilter,
      pillarFilter,
      companionSlug,
    }),
    storage: 'memory',
    tableMissing: false,
    schemaCacheStale: false,
    schemaErrorDetail: 'Supabase admin client is unavailable.',
  };
}

export async function pruneChatbotPipelineLogs(
  olderThanDays = PIPELINE_LOGS_RETENTION_DAYS
): Promise<{ prunedDb: boolean; deletedMemoryCount: number; cutoffIso: string }> {
  const safeDays = Math.max(0, Math.min(365, Math.floor(Number(olderThanDays) || 0)));
  const cutoffIso = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();

  let deletedMemoryCount = 0;
  for (let i = memoryLogBuffer.length - 1; i >= 0; i--) {
    if (memoryLogBuffer[i].created_at < cutoffIso) {
      memoryLogBuffer.splice(i, 1);
      deletedMemoryCount++;
    }
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { prunedDb: false, deletedMemoryCount, cutoffIso };
  }

  try {
    const { error } = await supabaseAdmin
      .from('chatbot_pipeline_logs')
      .delete()
      .lt('created_at', cutoffIso);
    return { prunedDb: !error, deletedMemoryCount, cutoffIso };
  } catch {
    return { prunedDb: false, deletedMemoryCount, cutoffIso };
  }
}

export async function clearChatbotPipelineLogs(): Promise<{ clearedDb: boolean }> {
  memoryLogBuffer.length = 0;
  lastWriteError = null;
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return { clearedDb: false };
  try {
    const { error } = await supabaseAdmin
      .from('chatbot_pipeline_logs')
      .delete()
      .gte('created_at', '1970-01-01T00:00:00Z');
    return { clearedDb: !error };
  } catch {
    return { clearedDb: false };
  }
}
