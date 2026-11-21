import crypto from 'crypto';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { getAiSettings } from './platformSettings';

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
}

const MAX_MEMORY_LOGS = 120;
const memoryLogBuffer: ChatbotPipelineLogEntry[] = [];

function pushToMemoryBuffer(entry: ChatbotPipelineLogEntry): void {
  memoryLogBuffer.unshift(entry);
  if (memoryLogBuffer.length > MAX_MEMORY_LOGS) {
    memoryLogBuffer.length = MAX_MEMORY_LOGS;
  }
}

export async function isPipelineLoggingEnabled(): Promise<boolean> {
  try {
    const ai = await getAiSettings();
    return Boolean(ai.chatbot_pipeline_logging_enabled);
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
 * Records a compact diagnostic trace for one chatbot turn whenever Admin logging is enabled.
 * Never logs raw system_prompts, chart_json, or API secrets.
 */
export async function recordChatbotPipelineLog(
  input: RecordChatbotPipelineLogInput
): Promise<void> {
  try {
    const enabled = await isPipelineLoggingEnabled();
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
        ? input.user_prompt_preview.replace(/\s+/g, ' ').trim().slice(0, 220)
        : null,
      action_taken: input.action_taken || 'proceed',
      stage1_json: input.stage1_json ?? null,
      stage2_json: input.stage2_json ?? null,
      stage3_json: input.stage3_json ?? null,
      stage4_json: input.stage4_json ?? null,
      total_latency_ms: Math.max(0, Math.round(input.total_latency_ms || 0)),
      error_message: input.error_message ? String(input.error_message).slice(0, 320) : null,
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

    if (error && error.code !== '42P01') {
      console.warn('[pipelineLogger] Supabase insert warning:', error.message);
    }
  } catch {
    // Non-fatal telemetry guard
  }
}

export async function getChatbotPipelineLogs(options?: {
  limit?: number;
  actionFilter?: string;
}): Promise<{
  logs: ChatbotPipelineLogEntry[];
  storage: 'supabase' | 'memory';
  tableMissing: boolean;
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
        };
      }

      const isMissing =
        error?.code === '42P01' ||
        Boolean(error?.message?.toLowerCase().includes('chatbot_pipeline_logs'));
      const filteredMem = memoryLogBuffer
        .filter((l) => !actionFilter || actionFilter === 'all' || l.action_taken === actionFilter)
        .slice(0, limit);
      return {
        logs: filteredMem,
        storage: 'memory',
        tableMissing: isMissing,
      };
    } catch {
      // Fallback to in-memory ring buffer
    }
  }

  const filteredMem = memoryLogBuffer
    .filter((l) => !actionFilter || actionFilter === 'all' || l.action_taken === actionFilter)
    .slice(0, limit);

  return {
    logs: filteredMem,
    storage: 'memory',
    tableMissing: false,
  };
}

export async function clearChatbotPipelineLogs(): Promise<{ clearedDb: boolean }> {
  memoryLogBuffer.length = 0;
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
