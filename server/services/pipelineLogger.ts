import crypto from 'crypto';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { getPipelineLoggingEnabledFast } from './platformSettings';

export interface ChatbotPipelineLogEntry {
  id: string;
  created_at: string;
  user_id?: string | null;
  conversation_id?: string | null;
  profile_id?: string | null;
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
  /** Opt-in administrator-only diagnostic turn capture; bypasses global toggle cleanly without recording on ordinary user turns. */
  bypassGlobalToggle?: boolean;
}

const MAX_MEMORY_LOGS = 120;
const MAX_DB_LOGS_RETAINED = 150;
const memoryLogBuffer: ChatbotPipelineLogEntry[] = [];
let lastWriteError: string | null = null;

const SENSITIVE_KEY_RE =
  /(api[-_]?key|secret|password|authorization|service[-_]?role|private[-_]?key|access[-_]?token|refresh[-_]?token|bearer)/i;

export function redactDiagnosticString(raw: string): string {
  return raw
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-(?:or-v1-)?[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_API_KEY]')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}\b/g, '[REDACTED_JWT]')
    .replace(/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s"'`]+/gi, '[REDACTED_DB_URI]')
    .replace(/(openrouter_api_key|supabase_service_role_key|resend_api_key)\s*[:=]\s*\S+/gi, '$1=[REDACTED]');
}

export function redactDiagnosticSecrets<T>(value: T, depth = 0): T {
  if (depth > 8 || value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return redactDiagnosticString(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactDiagnosticSecrets(item, depth + 1)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_RE.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactDiagnosticSecrets(v, depth + 1);
      }
    }
    return out as T;
  }
  return value;
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

/**
 * Records a diagnostic trace for one chatbot turn whenever Admin logging is enabled
 * OR an administrator opted into single-turn production diagnostics (`bypassGlobalToggle`).
 * Never logs raw API secrets or auth tokens; normal user turns remain gated behind Admin toggle.
 */
export async function recordChatbotPipelineLog(
  input: RecordChatbotPipelineLogInput
): Promise<void> {
  try {
    const enabled = input.bypassGlobalToggle ? true : await isPipelineLoggingEnabled();
    if (!enabled) return;

    const entry: ChatbotPipelineLogEntry = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      user_id: input.user_id || null,
      conversation_id: input.conversation_id || null,
      profile_id: input.profile_id || null,
      expert_slug: input.expert_slug || null,
      mode_slug: input.mode_slug || null,
      response_length: input.response_length || null,
      user_prompt_preview: input.user_prompt_preview
        ? redactDiagnosticString(
            input.user_prompt_preview.replace(/\s+/g, ' ').trim().slice(0, 220)
          )
        : null,
      action_taken: input.action_taken || 'proceed',
      stage1_json: input.stage1_json ? redactDiagnosticSecrets(input.stage1_json) : null,
      stage2_json: input.stage2_json ? redactDiagnosticSecrets(input.stage2_json) : null,
      stage3_json: input.stage3_json ? redactDiagnosticSecrets(input.stage3_json) : null,
      stage4_json: input.stage4_json ? redactDiagnosticSecrets(input.stage4_json) : null,
      total_latency_ms: Math.max(0, Math.round(input.total_latency_ms || 0)),
      error_message: input.error_message
        ? redactDiagnosticString(String(input.error_message).slice(0, 320))
        : null,
    };

    pushToMemoryBuffer(entry);

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return;

    const { error } = await supabaseAdmin.from('chatbot_pipeline_logs').insert({
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
    });

    if (error) {
      lastWriteError = `${error.code ? `[${error.code}] ` : ''}${error.message || 'Insert failed'}`;
      if (error.code !== '42P01') {
        console.warn('[pipelineLogger] Supabase insert warning:', error.message);
      }
    } else {
      lastWriteError = null;
      // Enforce bounded DB retention quietly so companion diagnostic dumps never grow unboundedly
      try {
        const { data: oldestExcess } = await supabaseAdmin
          .from('chatbot_pipeline_logs')
          .select('id')
          .order('created_at', { ascending: false })
          .range(MAX_DB_LOGS_RETAINED, MAX_DB_LOGS_RETAINED + 25);
        if (Array.isArray(oldestExcess) && oldestExcess.length > 0) {
          const idsToDelete = oldestExcess
            .map((r) => String((r as { id?: string }).id || ''))
            .filter(Boolean);
          if (idsToDelete.length > 0) {
            await supabaseAdmin.from('chatbot_pipeline_logs').delete().in('id', idsToDelete);
          }
        }
      } catch {
        // Non-fatal retention cleanup
      }
    }
  } catch (err) {
    lastWriteError = err instanceof Error ? err.message : 'Unexpected telemetry write failure';
  }
}

export async function getChatbotPipelineLogs(options?: {
  limit?: number;
  actionFilter?: string;
}): Promise<{
  logs: ChatbotPipelineLogEntry[];
  storage: 'supabase' | 'memory';
  tableMissing: boolean;
  schemaCacheStale: boolean;
  schemaErrorDetail: string | null;
}> {
  const limit = Math.max(1, Math.min(200, options?.limit || 60));
  const actionFilter = options?.actionFilter?.trim() || '';
  const supabaseAdmin = getSupabaseAdmin();

  if (supabaseAdmin) {
    try {
      let query = supabaseAdmin
        .from('chatbot_pipeline_logs')
        .select(
          'id, created_at, user_id, conversation_id, profile_id, expert_slug, mode_slug, response_length, user_prompt_preview, action_taken, stage1_json, stage2_json, stage3_json, stage4_json, total_latency_ms, error_message'
        )
        .order('created_at', { ascending: false })
        .limit(limit);

      if (actionFilter && actionFilter !== 'all') {
        query = query.eq('action_taken', actionFilter);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        return {
          logs: data as ChatbotPipelineLogEntry[],
          storage: 'supabase',
          tableMissing: false,
          schemaCacheStale: false,
          schemaErrorDetail: data.length === 0 ? lastWriteError : null,
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
      const filteredMem = memoryLogBuffer
        .filter((l) => !actionFilter || actionFilter === 'all' || l.action_taken === actionFilter)
        .slice(0, limit);
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
        logs: memoryLogBuffer
          .filter((l) => !actionFilter || actionFilter === 'all' || l.action_taken === actionFilter)
          .slice(0, limit),
        storage: 'memory',
        tableMissing: false,
        schemaCacheStale: false,
        schemaErrorDetail: msg,
      };
    }
  }

  const filteredMem = memoryLogBuffer
    .filter((l) => !actionFilter || actionFilter === 'all' || l.action_taken === actionFilter)
    .slice(0, limit);

  return {
    logs: filteredMem,
    storage: 'memory',
    tableMissing: false,
    schemaCacheStale: false,
    schemaErrorDetail: 'Supabase admin client is unavailable.',
  };
}

export async function deleteChatbotPipelineLog(
  logId: string
): Promise<{ deletedDb: boolean }> {
  const cleanId = logId.trim();
  if (!cleanId) return { deletedDb: false };
  const idx = memoryLogBuffer.findIndex((entry) => entry.id === cleanId);
  if (idx !== -1) {
    memoryLogBuffer.splice(idx, 1);
  }
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return { deletedDb: false };
  try {
    const { error } = await supabaseAdmin
      .from('chatbot_pipeline_logs')
      .delete()
      .eq('id', cleanId);
    return { deletedDb: !error };
  } catch {
    return { deletedDb: false };
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
