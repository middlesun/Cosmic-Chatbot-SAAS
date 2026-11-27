import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import CustomSelect from '../app/CustomSelect';

interface PipelineLogEntry {
  id: string;
  created_at: string;
  user_id?: string | null;
  conversation_id?: string | null;
  profile_id?: string | null;
  pillar?: 'council' | 'companion' | 'clarity' | null;
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

const PILLAR_OPTIONS = [
  { value: 'all', label: 'All Pillars' },
  { value: 'companion', label: 'Companion Only' },
  { value: 'council', label: 'Council Only' },
  { value: 'clarity', label: 'Clarity Only' },
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

function deriveEntryPillar(entry: PipelineLogEntry): 'council' | 'companion' | 'clarity' {
  if (entry.pillar === 'companion' || entry.pillar === 'clarity' || entry.pillar === 'council') {
    return entry.pillar;
  }
  const s1Pillar = entry.stage1_json?.pillar;
  if (s1Pillar === 'companion' || s1Pillar === 'clarity' || s1Pillar === 'council') {
    return s1Pillar;
  }
  const exp = String(entry.expert_slug || '').toLowerCase();
  if (exp === 'companion' || exp.startsWith('companion:')) return 'companion';
  if (exp === 'clarity' || exp === 'clarity_helper') return 'clarity';
  return 'council';
}

const AdminChatbotLogs: React.FC<AdminChatbotLogsProps> = ({ getAccessToken }) => {
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [jevEnabled, setJevEnabled] = useState(true);
  const [jevModel, setJevModel] = useState('typesafe/jev-1.14');
  const [logs, setLogs] = useState<PipelineLogEntry[]>([]);
  const [storage, setStorage] = useState<'supabase' | 'memory'>('supabase');
  const [tableMissing, setTableMissing] = useState(false);
  const [schemaCacheStale, setSchemaCacheStale] = useState(false);
  const [schemaErrorDetail, setSchemaErrorDetail] = useState<string | null>(null);
  const [retentionInfo, setRetentionInfo] = useState<{ maxRows: number; retentionDays: number }>({
    maxRows: 500,
    retentionDays: 30,
  });
  const [actionFilter, setActionFilter] = useState('all');
  const [pillarFilter, setPillarFilter] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [promptOpenIds, setPromptOpenIds] = useState<Record<string, boolean>>({});
  const [rawJsonOpenIds, setRawJsonOpenIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(
    async (actionOverride?: string, pillarOverride?: string) => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        const act = actionOverride ?? actionFilter;
        const pil = pillarOverride ?? pillarFilter;
        const res = await fetch(
          `/api/admin/chatbot-logs?limit=60&action=${encodeURIComponent(act)}&pillar=${encodeURIComponent(pil)}`,
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
        if (data.retention && typeof data.retention === 'object') {
          setRetentionInfo({
            maxRows: Number(data.retention.maxRows) || 500,
            retentionDays: Number(data.retention.retentionDays) || 30,
          });
        }
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
    [actionFilter, pillarFilter, getAccessToken]
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

  const handlePruneOldLogs = async () => {
    setPruning(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/chatbot-logs/prune', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ olderThanDays: 7 }),
      });
      if (!res.ok) throw new Error('Failed to prune old logs');
      await loadLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prune old logs');
    } finally {
      setPruning(false);
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
            Inspect Council Stage 1–4 diagnostics and opt-in Companion production telemetry (model, temperature, chart systems, memory isolation, and bounded prompt preview).
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
            disabled={pruning || logs.length === 0}
            onClick={() => void handlePruneOldLogs()}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-2 text-xs font-medium text-[#5C5449] hover:bg-[#F1ECE3] disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{pruning ? 'Pruning...' : 'Prune >7d'}</span>
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
            <span className="text-[#8B8275]">Retention Cap: </span>
            <span className="font-mono tabular-nums text-[#3D3830]">
              {retentionInfo.maxRows} rows / {retentionInfo.retentionDays}d
            </span>
          </div>
          <div>
            <span className="text-[#8B8275]">Showing: </span>
            <span className="font-mono tabular-nums text-[#3D3830]">{logs.length}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="w-full sm:w-44">
            <CustomSelect
              value={pillarFilter}
              onChange={(val) => setPillarFilter(val)}
              options={PILLAR_OPTIONS}
            />
          </div>
          <div className="w-full sm:w-56">
            <CustomSelect
              value={actionFilter}
              onChange={(val) => setActionFilter(val)}
              options={ACTION_OPTIONS}
            />
          </div>
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
              ? 'Send a Council or Companion message in Chat and refresh here to inspect execution diagnostics.'
              : 'Turn Logging ON above (or in AI Settings) to record step-by-step diagnostics for subsequent turns.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((entry) => {
            const isExpanded = Boolean(expandedIds[entry.id]);
            const entryPillar = deriveEntryPillar(entry);
            const s1 = (entry.stage1_json || {}) as Record<string, unknown>;
            const s2 = (entry.stage2_json || {}) as Record<string, unknown>;
            const s3 = (entry.stage3_json || {}) as Record<string, unknown>;
            const s4 = (entry.stage4_json || {}) as Record<string, unknown>;

            const isCompanion = entryPillar === 'companion';
            const isAdminPreview = Boolean(s1.admin_preview);
            const compName =
              typeof s1.companion_name === 'string' && s1.companion_name
                ? s1.companion_name
                : null;
            const compModel =
              typeof s3.model_id === 'string' && s3.model_id ? s3.model_id : null;
            const compTemp =
              typeof s3.resolved_temperature === 'number'
                ? s3.resolved_temperature
                : null;

            const chartInjectedMap =
              (s2.chart_systems_injected as Record<string, unknown> | undefined) || {};
            const chartCharMap =
              (s2.chart_char_counts as Record<string, unknown> | undefined) || {};
            const memorySources =
              (s2.memory_sources as Record<string, Record<string, unknown>> | undefined) || {};
            const analyticalStages = Array.isArray(s3.analytical_stages)
              ? (s3.analytical_stages as Array<Record<string, unknown>>)
              : [];
            const activeSections = Array.isArray(s3.active_prompt_sections)
              ? (s3.active_prompt_sections as Array<Record<string, unknown>>)
              : [];
            const promptPreviewText =
              typeof s3.system_prompt_preview === 'string' ? s3.system_prompt_preview : null;
            const isPromptOpen = Boolean(promptOpenIds[entry.id]);
            const isRawJsonOpen = Boolean(rawJsonOpenIds[entry.id]);

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
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          isCompanion
                            ? 'border-[#B8965A]/45 bg-[#B8965A]/15 text-[#5C5449]'
                            : entryPillar === 'clarity'
                            ? 'border-[#3D3830]/20 bg-[#F1ECE3] text-[#5C5449]'
                            : 'border-[#2D6A4F]/25 bg-[#2D6A4F]/8 text-[#2D6A4F]'
                        }`}
                      >
                        {entryPillar}
                      </span>

                      {isAdminPreview && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-[#B8965A]/50 bg-[#1F2229] px-2 py-0.5 text-[10px] font-medium text-[#F4EFE6]">
                          <ShieldCheck className="h-3 w-3 text-[#B8965A]" />
                          Admin Preview
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${getActionBadgeClasses(
                          entry.action_taken
                        )}`}
                      >
                        {entry.action_taken}
                      </span>

                      <span className="font-mono text-[11px] text-[#5C5449]">
                        {compName
                          ? `${compName} (${String(s1.companion_slug || entry.expert_slug || '')})`
                          : `${entry.expert_slug || 'council'} · ${entry.mode_slug || 'general'} · ${
                              entry.response_length || 'detailed'
                            }`}
                      </span>

                      {isCompanion && compModel && (
                        <span className="font-mono text-[11px] text-[#8B8275]">
                          {compModel}
                          {compTemp !== null ? ` · temp ${compTemp}` : ''}
                        </span>
                      )}

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
                  <div className="border-t border-[#3D3830]/10 bg-[#FAF7F2] p-4 space-y-4">
                    <div className="flex flex-wrap gap-4 text-[11px] font-mono text-[#5C5449]">
                      <span>User: {entry.user_id || '—'}</span>
                      <span>Conversation: {entry.conversation_id || '—'}</span>
                      <span>Profile: {entry.profile_id || 'General'}</span>
                    </div>

                    {isCompanion && s1.companion_slug ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {/* Companion Identity & Policy Settings */}
                          <div className="rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] p-3.5 space-y-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8B8275]">
                              Companion Identity &amp; Policies
                            </p>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                              <span className="text-[#8B8275]">Slug / Name</span>
                              <span className="font-mono text-[#3D3830]">
                                {String(s1.companion_slug || '—')} ({String(s1.companion_name || '—')})
                              </span>
                              <span className="text-[#8B8275]">V2 Version / Status</span>
                              <span className="font-mono text-[#3D3830]">
                                v{String(s1.v2_published_version ?? 1)} ·{' '}
                                {s1.is_active === false ? 'inactive (admin preview)' : 'active'}
                              </span>
                              <span className="text-[#8B8275]">Verification Mode</span>
                              <span className="font-mono text-[#3D3830]">
                                {String(s1.verification_mode || 'neutral')} (applied:{' '}
                                {String(s1.applied_verification_mode || 'skipped')})
                              </span>
                              <span className="text-[#8B8275]">Memory Mode</span>
                              <span className="font-mono text-[#3D3830]">
                                {String(s1.astrological_memory_mode || 'independent')}
                              </span>
                              <span className="text-[#8B8275]">Greeting / Familiarity</span>
                              <span className="font-mono text-[#3D3830]">
                                {String(s1.greeting_mode || '—')} ·{' '}
                                {String(s1.familiarity_mode || '—')} ({String(s1.familiarity_ceiling || '—')})
                              </span>
                              <span className="text-[#8B8275]">Chat Style</span>
                              <span className="font-mono text-[#3D3830]">
                                {String(s1.chat_style || '—')}
                              </span>
                            </div>
                          </div>

                          {/* Runtime & Analytical Stage Trace */}
                          <div className="rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] p-3.5 space-y-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8B8275]">
                              Runtime Execution &amp; Telemetry
                            </p>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                              <span className="text-[#8B8275]">Execution Mode</span>
                              <span className="font-mono text-[#3D3830]">
                                {String(s1.execution_mode || 'single_pass')}
                              </span>
                              <span className="text-[#8B8275]">Model ID</span>
                              <span className="font-mono text-[#3D3830] break-all">
                                {String(s3.model_id || '—')}
                              </span>
                              <span className="text-[#8B8275]">Temperature / Max Tokens</span>
                              <span className="font-mono tabular-nums text-[#3D3830]">
                                {s3.resolved_temperature !== undefined
                                  ? String(s3.resolved_temperature)
                                  : '0.45'}{' '}
                                / {String(s3.max_output_tokens ?? '—')}
                              </span>
                              <span className="text-[#8B8275]">Tokens (In / Out)</span>
                              <span className="font-mono tabular-nums text-[#3D3830]">
                                {String(s3.tokens_in ?? 0)} / {String(s3.tokens_out ?? 0)}
                              </span>
                              <span className="text-[#8B8275]">Latency / Credits</span>
                              <span className="font-mono tabular-nums text-[#3D3830]">
                                {entry.total_latency_ms}ms · {String(s3.credits_charged ?? 0)} cr
                              </span>
                              <span className="text-[#8B8275]">Post-Turn Sync</span>
                              <span className="font-mono text-[#3D3830]">
                                bond={String(Boolean(s4.post_turn_bond_update))} · memory=
                                {String(Boolean(s4.post_turn_profile_memory_update))}
                              </span>
                            </div>
                          </div>

                          {/* Chart Systems Supplied */}
                          <div className="rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] p-3.5 space-y-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8B8275]">
                              Chart Systems Injected &amp; Char Counts
                            </p>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                              <span className="text-[#8B8275]">Vedic Sidereal</span>
                              <span className="font-mono tabular-nums text-[#3D3830]">
                                {chartInjectedMap.vedic_sidereal ? 'Supplied' : 'Not attached'} (
                                {String(chartCharMap.vedic_sidereal_chars ?? 0)} chars)
                              </span>
                              <span className="text-[#8B8275]">Western Tropical</span>
                              <span className="font-mono tabular-nums text-[#3D3830]">
                                {chartInjectedMap.western_tropical ? 'Supplied' : 'Not attached'} (
                                {String(chartCharMap.western_tropical_chars ?? 0)} chars)
                              </span>
                              <span className="text-[#8B8275]">Vedic Transits</span>
                              <span className="font-mono tabular-nums text-[#3D3830]">
                                {chartInjectedMap.vedic_transits ? 'Supplied' : 'Skipped'} (
                                {String(chartCharMap.vedic_transits_chars ?? 0)} chars)
                              </span>
                              <span className="text-[#8B8275]">Western Transits</span>
                              <span className="font-mono tabular-nums text-[#3D3830]">
                                {chartInjectedMap.western_transits ? 'Supplied' : 'Skipped'} (
                                {String(chartCharMap.western_transits_chars ?? 0)} chars)
                              </span>
                              <span className="text-[#8B8275]">Divination / Profile State</span>
                              <span className="font-mono text-[#3D3830]">
                                tarot={String(Boolean(chartInjectedMap.tarot))} · num=
                                {String(Boolean(chartInjectedMap.numerology))} · incomplete=
                                {String(Boolean(chartInjectedMap.missing_or_incomplete))}
                              </span>
                            </div>
                          </div>

                          {/* Memory & Notes Isolation Audit */}
                          <div className="rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] p-3.5 space-y-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8B8275]">
                              Memory &amp; Notes Isolation Audit
                            </p>
                            <div className="space-y-1.5 text-xs">
                              {(
                                [
                                  ['factual_life_context', 'Factual Life Context'],
                                  ['companion_bond', 'Companion Bond'],
                                  ['thread_summary', 'Prior Thread Snippets'],
                                  ['shared_external_notes', 'Shared External Notes'],
                                  ['council_analyst_notes', 'Council Analyst Notes'],
                                ] as const
                              ).map(([key, label]) => {
                                const src = memorySources[key] || {};
                                const injected = Boolean(src.injected);
                                return (
                                  <div
                                    key={key}
                                    className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3D3830]/6 pb-1 last:border-b-0 last:pb-0"
                                  >
                                    <span className="text-[#5C5449]">{label}</span>
                                    <span
                                      className={`font-mono text-[11px] ${
                                        injected ? 'text-[#2D6A4F]' : 'text-[#8B8275]'
                                      }`}
                                    >
                                      {injected
                                        ? `Injected (${String(src.chars ?? 0)} chars${
                                            src.count !== undefined ? `, ${src.count} items` : ''
                                          }${
                                            src.total_turns !== undefined
                                              ? `, ${src.total_turns} turns`
                                              : ''
                                          })`
                                        : `Omitted (${String(src.omitted_reason || 'not_present')}${
                                            typeof src.count === 'number' && src.count > 0
                                              ? `, ${src.count} isolated`
                                              : ''
                                          })`}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Analytical Stages Trace Slots */}
                        {analyticalStages.length > 0 && (
                          <div className="rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] p-3.5 space-y-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8B8275]">
                              Pipeline Analytical Stages Trace (Extensible Schema)
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {analyticalStages.map((st, idx) => (
                                <div
                                  key={`${st.key || idx}`}
                                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${
                                    st.status === 'executed'
                                      ? 'border-[#2D6A4F]/25 bg-[#2D6A4F]/8 text-[#2D6A4F]'
                                      : 'border-[#3D3830]/10 bg-[#FAF7F2] text-[#8B8275]'
                                  }`}
                                >
                                  <span className="font-mono font-medium">
                                    S{String(st.stage ?? idx + 1)}: {String(st.label || st.key)}
                                  </span>
                                  {st.notes ? (
                                    <span className="ml-1.5 font-mono text-[10px] opacity-80">
                                      ({String(st.notes)})
                                    </span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Collapsible Sanitized Prompt Preview */}
                        {promptPreviewText && (
                          <div className="rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] overflow-hidden">
                            <button
                              type="button"
                              onClick={() =>
                                setPromptOpenIds((prev) => ({
                                  ...prev,
                                  [entry.id]: !prev[entry.id],
                                }))
                              }
                              className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3]/50 cursor-pointer"
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-[#B8965A]" />
                                Sanitized Assembled System Prompt Preview (
                                {String(s3.system_prompt_chars ?? promptPreviewText.length)} total chars)
                              </span>
                              <span className="font-mono text-[11px] text-[#8B8275]">
                                {isPromptOpen ? 'Hide' : 'Inspect'}
                              </span>
                            </button>

                            {isPromptOpen && (
                              <div className="border-t border-[#3D3830]/10 p-3.5 space-y-2.5">
                                {activeSections.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {activeSections.map((sec, idx) => (
                                      <span
                                        key={`${sec.key || idx}`}
                                        className="rounded-md border border-[#3D3830]/12 bg-[#FAF7F2] px-2 py-0.5 font-mono text-[10px] text-[#5C5449]"
                                      >
                                        {String(sec.key)}: {String(sec.charCount)}c (~
                                        {String(sec.estimatedTokens)}t)
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <pre className="max-h-96 overflow-auto rounded-lg border border-[#3D3830]/10 bg-[#FAF7F2] p-3 font-mono text-[11px] text-[#3D3830] whitespace-pre-wrap break-words">
                                  {promptPreviewText}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Collapsible Raw Stage 1-4 JSON */}
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              setRawJsonOpenIds((prev) => ({
                                ...prev,
                                [entry.id]: !prev[entry.id],
                              }))
                            }
                            className="text-[11px] font-mono text-[#8B8275] hover:text-[#3D3830] underline cursor-pointer"
                          >
                            {isRawJsonOpen ? 'Hide raw Stage 1–4 JSON' : 'Show raw Stage 1–4 JSON'}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {(!isCompanion || !s1.companion_slug || isRawJsonOpen) && (
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
                    )}
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
