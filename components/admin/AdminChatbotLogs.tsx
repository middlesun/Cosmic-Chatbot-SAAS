import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import CustomSelect from '../app/CustomSelect';

interface PipelineLogEntry {
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

interface AdminChatbotLogsProps {
  getAccessToken: () => Promise<string | null>;
}

const ACTION_OPTIONS = [
  { value: 'all', label: 'All Pipeline Actions' },
  { value: 'proceed', label: 'Proceed (Answered)' },
  { value: 'clarify', label: 'Clarify (0-Credit Pause)' },
  { value: 'prompt_partner_chart', label: 'Partner Chart Required' },
  { value: 'refuse_extraction', label: 'Refuse Extraction' },
  { value: 'aborted', label: 'Aborted' },
  { value: 'error', label: 'Errors Only' },
];

const getActionBadgeClasses = (action: string): string => {
  switch (action) {
    case 'proceed':
      return 'border-[#2D6A4F]/25 bg-[#2D6A4F]/10 text-[#2D6A4F]';
    case 'clarify':
    case 'prompt_partner_chart':
      return 'border-[#B8965A]/45 bg-[#B8965A]/15 text-[#5C5449]';
    case 'refuse_extraction':
    case 'error':
      return 'border-[#7A3E36]/30 bg-[#7A3E36]/10 text-[#7A3E36]';
    default:
      return 'border-[#3D3830]/15 bg-[#F1ECE3] text-[#5C5449]';
  }
};

const AdminChatbotLogs: React.FC<AdminChatbotLogsProps> = ({ getAccessToken }) => {
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [jevEnabled, setJevEnabled] = useState(true);
  const [jevModel, setJevModel] = useState('typesafe/jev-1.14');
  const [logs, setLogs] = useState<PipelineLogEntry[]>([]);
  const [storage, setStorage] = useState<'supabase' | 'memory'>('supabase');
  const [tableMissing, setTableMissing] = useState(false);
  const [schemaCacheStale, setSchemaCacheStale] = useState(false);
  const [schemaErrorDetail, setSchemaErrorDetail] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(
    async (filterOverride?: string) => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        const act = filterOverride ?? actionFilter;
        const res = await fetch(
          `/api/admin/chatbot-logs?limit=60&action=${encodeURIComponent(act)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load chatbot logs');

        setEnabled(Boolean(data.enabled));
        setJevEnabled(data.jevClassifierEnabled !== false);
        setJevModel(data.jevModel || 'typesafe/jev-1.14');
        setLogs(Array.isArray(data.logs) ? data.logs : []);
        setStorage(data.storage === 'memory' ? 'memory' : 'supabase');
        setTableMissing(Boolean(data.tableMissing));
        setSchemaCacheStale(Boolean(data.schemaCacheStale));
        setSchemaErrorDetail(
          typeof data.schemaErrorDetail === 'string' && data.schemaErrorDetail.trim()
            ? data.schemaErrorDetail.trim()
            : null
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load chatbot logs');
      } finally {
        setLoading(false);
      }
    },
    [actionFilter, getAccessToken]
  );

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const handleToggleLogging = async () => {
    setToggling(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const nextEnabled = !enabled;
      const res = await fetch('/api/admin/chatbot-logs/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle logging');
      setEnabled(Boolean(data.enabled));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle logging');
    } finally {
      setToggling(false);
    }
  };

  const handleClearLogs = async () => {
    setClearing(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/chatbot-logs', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to clear logs');
      setLogs([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear logs');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
            Chatbot Pipeline Logs
          </h2>
          <p className="mt-1 text-xs text-[#5C5449]">
            Trace Stage 1 Jev/Router decisions, Stage 2 slice &amp; cancellations, Stage 3 synthesis tokens, and Stage 4 follow-ups when diagnostics are enabled.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={toggling}
            onClick={() => void handleToggleLogging()}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
              enabled
                ? 'bg-[#2D6A4F] text-[#FAF7F2] hover:bg-[#24563F]'
                : 'border border-[#3D3830]/18 bg-[#FDFBF7] text-[#3D3830] hover:bg-[#F1ECE3]'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>{enabled ? 'Logging: ON' : 'Logging: OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => void loadLogs()}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            disabled={clearing || logs.length === 0}
            onClick={() => void handleClearLogs()}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#7A3E36]/25 bg-[#FDFBF7] px-3.5 py-2 text-xs font-medium text-[#7A3E36] hover:bg-[#7A3E36]/8 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{clearing ? 'Clearing...' : 'Clear Logs'}</span>
          </button>
        </div>
      </div>

      {/* Status & Filter Strip */}
      <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div>
            <span className="text-[#8B8275]">Stage 1 Classifier: </span>
            <span className="font-mono text-[#3D3830]">
              {jevEnabled ? jevModel : 'Off (Utility LLM fallback)'}
            </span>
          </div>
          <div>
            <span className="text-[#8B8275]">Storage: </span>
            <span className="font-medium text-[#3D3830] capitalize">{storage}</span>
          </div>
          <div>
            <span className="text-[#8B8275]">Showing: </span>
            <span className="font-mono tabular-nums text-[#3D3830]">{logs.length}</span>
          </div>
        </div>

        <div className="w-full sm:w-64">
          <CustomSelect
            value={actionFilter}
            onChange={(val) => setActionFilter(val)}
            options={ACTION_OPTIONS}
          />
        </div>
      </section>

      {(tableMissing || schemaErrorDetail) && (
        <div className="rounded-2xl border border-[#B8965A]/45 bg-[#B8965A]/12 p-4 text-xs text-[#3D3830] flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-[#8B7355] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              {schemaCacheStale
                ? 'Supabase schema cache needs a refresh'
                : tableMissing
                ? 'Migration 012 not yet applied in Supabase'
                : 'Supabase telemetry diagnostic notice'}
            </p>
            <p className="text-[#5C5449]">
              {schemaCacheStale ? (
                <>
                  Run{' '}
                  <code className="font-mono text-[11px] bg-[#FAF7F2] px-1.5 py-0.5 rounded">
                    NOTIFY pgrst, &apos;reload schema&apos;;
                  </code>{' '}
                  in Supabase SQL Editor so PostgREST sees{' '}
                  <code className="font-mono text-[11px] bg-[#FAF7F2] px-1.5 py-0.5 rounded">
                    public.chatbot_pipeline_logs
                  </code>
                  . Currently displaying the live server in-memory ring buffer.
                </>
              ) : tableMissing ? (
                <>
                  Run{' '}
                  <code className="font-mono text-[11px] bg-[#FAF7F2] px-1.5 py-0.5 rounded">
                    supabase/migrations/012_pipeline_logs_and_stress_context.sql
                  </code>{' '}
                  in Supabase SQL Editor for persistent logs. Currently displaying the live server in-memory ring buffer.
                </>
              ) : (
                'Supabase returned an error when reading or writing pipeline telemetry.'
              )}
            </p>
            {schemaErrorDetail && (
              <p className="font-mono text-[11px] text-[#7A3E36] break-all">
                Detail: {schemaErrorDetail}
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-4 py-3 text-xs text-[#7A3E36]">
          {error}
        </div>
      )}

      {/* Logs List */}
      {loading ? (
        <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-8 text-center text-xs text-[#8B8275]">
          Loading pipeline execution logs...
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#3D3830]/18 bg-[#FDFBF7] p-10 text-center space-y-2">
          <p className="text-sm font-medium text-[#3D3830]">No pipeline logs recorded yet</p>
          <p className="text-xs text-[#8B8275] max-w-md mx-auto">
            {enabled
              ? 'Send a Vedic Council message in Chat and refresh here to inspect Stage 1–4 telemetry.'
              : 'Turn Logging ON above (or in AI Settings) to record step-by-step diagnostics for subsequent turns.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((entry) => {
            const isExpanded = Boolean(expandedIds[entry.id]);
            return (
              <article
                key={entry.id}
                className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedIds((prev) => ({
                      ...prev,
                      [entry.id]: !prev[entry.id],
                    }))
                  }
                  className="w-full px-4 py-3.5 text-left hover:bg-[#FAF7F2] transition-colors cursor-pointer flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${getActionBadgeClasses(
                          entry.action_taken
                        )}`}
                      >
                        {entry.action_taken}
                      </span>
                      <span className="font-mono text-[11px] text-[#5C5449]">
                        {entry.expert_slug || 'council'} · {entry.mode_slug || 'general'} ·{' '}
                        {entry.response_length || 'detailed'}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-[#8B8275]">
                        <Clock className="h-3 w-3" />
                        {entry.total_latency_ms}ms
                      </span>
                    </div>

                    <p className="text-xs text-[#3D3830] truncate">
                      {entry.user_prompt_preview || '(No prompt preview)'}
                    </p>

                    {entry.error_message && (
                      <p className="text-[11px] text-[#7A3E36] truncate">
                        Error: {entry.error_message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-[11px] text-[#8B8275]">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-[#5C5449]" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-[#5C5449]" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[#3D3830]/10 bg-[#FAF7F2] p-4 space-y-3">
                    <div className="flex flex-wrap gap-4 text-[11px] font-mono text-[#5C5449]">
                      <span>User: {entry.user_id || '—'}</span>
                      <span>Conversation: {entry.conversation_id || '—'}</span>
                      <span>Profile: {entry.profile_id || 'General'}</span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] p-3 space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8B8275]">
                          Stage 1 · Intent &amp; Router
                        </p>
                        <pre className="text-[11px] font-mono text-[#3D3830] overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(entry.stage1_json ?? null, null, 2)}
                        </pre>
                      </div>

                      <div className="rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] p-3 space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8B8275]">
                          Stage 2 · Context Slicer &amp; Flags
                        </p>
                        <pre className="text-[11px] font-mono text-[#3D3830] overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(entry.stage2_json ?? null, null, 2)}
                        </pre>
                      </div>

                      <div className="rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] p-3 space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8B8275]">
                          Stage 3 · Synthesis &amp; Tokens
                        </p>
                        <pre className="text-[11px] font-mono text-[#3D3830] overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(entry.stage3_json ?? null, null, 2)}
                        </pre>
                      </div>

                      <div className="rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] p-3 space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8B8275]">
                          Stage 4 · Follow-ups &amp; Deeper Probes
                        </p>
                        <pre className="text-[11px] font-mono text-[#3D3830] overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(entry.stage4_json ?? null, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminChatbotLogs;
