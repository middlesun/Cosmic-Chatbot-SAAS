import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Cpu,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Sliders,
  Trash2,
  Zap,
} from 'lucide-react';
import CustomSelect from '../app/CustomSelect';

export interface CustomModelEntry {
  id: string;
  label: string;
  provider?: string;
  notes?: string;
}

export interface TokenLimitsConfig {
  chat_short: number;
  chat_detailed: number;
  report_pass: number;
  utility: number;
  max_history_turns: number;
}

export interface AiSettingsResponse {
  keySource: 'database' | 'env' | 'none';
  maskedKey: string | null;
  hasDatabaseOverride: boolean;
  hasEnvKey: boolean;
  consultation_model: string;
  utility_model: string;
  jev_classifier_enabled?: boolean;
  jev_model?: string;
  chatbot_pipeline_logging_enabled?: boolean;
  custom_models: CustomModelEntry[];
  builtin_models: CustomModelEntry[];
  token_limits: TokenLimitsConfig;
}

interface AdminAiSettingsProps {
  getAccessToken: () => Promise<string | null>;
  onSettingsUpdated?: (settings: AiSettingsResponse) => void;
}

const AdminAiSettings: React.FC<AdminAiSettingsProps> = ({
  getAccessToken,
  onSettingsUpdated,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [clearingKey, setClearingKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [keySource, setKeySource] = useState<'database' | 'env' | 'none'>('none');
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [hasDatabaseOverride, setHasDatabaseOverride] = useState(false);
  const [hasEnvKey, setHasEnvKey] = useState(false);

  const [newApiKey, setNewApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  const [consultationModel, setConsultationModel] = useState('google/gemini-2.5-flash');
  const [utilityModel, setUtilityModel] = useState('google/gemini-2.5-flash');
  const [jevClassifierEnabled, setJevClassifierEnabled] = useState(true);
  const [jevModel, setJevModel] = useState('typesafe/jev-1.14');
  const [pipelineLoggingEnabled, setPipelineLoggingEnabled] = useState(false);
  const [builtinModels, setBuiltinModels] = useState<CustomModelEntry[]>([]);
  const [customModels, setCustomModels] = useState<CustomModelEntry[]>([]);

  const [newModelId, setNewModelId] = useState('');
  const [newModelLabel, setNewModelLabel] = useState('');
  const [newModelProvider, setNewModelProvider] = useState('');
  const [newModelNotes, setNewModelNotes] = useState('');

  const [tokenLimits, setTokenLimits] = useState<TokenLimitsConfig>({
    chat_short: 600,
    chat_detailed: 2600,
    report_pass: 4500,
    utility: 800,
    max_history_turns: 24,
  });

  const [testResult, setTestResult] = useState<{
    ok: boolean;
    modelUsed: string;
    keySource: string;
    latencyMs: number;
    replyPreview?: string;
    error?: string;
  } | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/settings/ai', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load AI settings');

      setKeySource(data.keySource || 'none');
      setMaskedKey(data.maskedKey || null);
      setHasDatabaseOverride(Boolean(data.hasDatabaseOverride));
      setHasEnvKey(Boolean(data.hasEnvKey));
      setConsultationModel(data.consultation_model || 'google/gemini-2.5-flash');
      setUtilityModel(data.utility_model || 'google/gemini-2.5-flash');
      setJevClassifierEnabled(data.jev_classifier_enabled !== false);
      setJevModel(data.jev_model || 'typesafe/jev-1.14');
      setPipelineLoggingEnabled(Boolean(data.chatbot_pipeline_logging_enabled));
      setBuiltinModels(Array.isArray(data.builtin_models) ? data.builtin_models : []);
      setCustomModels(Array.isArray(data.custom_models) ? data.custom_models : []);
      if (data.token_limits) {
        setTokenLimits(data.token_limits);
      }
      onSettingsUpdated?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load AI settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const allModelOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string; description?: string }>();
    for (const m of [...builtinModels, ...customModels]) {
      if (!m.id) continue;
      map.set(m.id, {
        value: m.id,
        label: m.label || m.id,
        description: [m.id, m.notes].filter(Boolean).join(' · '),
      });
    }
    if (consultationModel && !map.has(consultationModel)) {
      map.set(consultationModel, { value: consultationModel, label: consultationModel });
    }
    if (utilityModel && !map.has(utilityModel)) {
      map.set(utilityModel, { value: utilityModel, label: utilityModel });
    }
    return Array.from(map.values());
  }, [builtinModels, customModels, consultationModel, utilityModel]);

  const handleAddCustomModel = () => {
    const id = newModelId.trim();
    if (!id) return;
    if (customModels.some((m) => m.id === id)) {
      setError(`Model "${id}" is already in your custom registry.`);
      return;
    }
    setError(null);
    setCustomModels((prev) => [
      ...prev,
      {
        id,
        label: newModelLabel.trim() || id,
        provider: newModelProvider.trim() || undefined,
        notes: newModelNotes.trim() || undefined,
      },
    ]);
    setNewModelId('');
    setNewModelLabel('');
    setNewModelProvider('');
    setNewModelNotes('');
    setFeedback('Model added to draft list — click Save AI Settings to publish.');
  };

  const handleRemoveCustomModel = (id: string) => {
    setCustomModels((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/settings/ai', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...(newApiKey.trim() ? { openrouter_api_key: newApiKey.trim() } : {}),
          consultation_model: consultationModel,
          utility_model: utilityModel,
          jev_classifier_enabled: jevClassifierEnabled,
          jev_model: jevModel,
          chatbot_pipeline_logging_enabled: pipelineLoggingEnabled,
          custom_models: customModels,
          token_limits: tokenLimits,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save AI settings');

      setKeySource(data.keySource || 'none');
      setMaskedKey(data.maskedKey || null);
      setHasDatabaseOverride(Boolean(data.hasDatabaseOverride));
      setHasEnvKey(Boolean(data.hasEnvKey));
      setNewApiKey('');
      setFeedback('AI Settings saved and applied immediately across live consultations and reports.');
      onSettingsUpdated?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClearDbKey = async () => {
    setClearingKey(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/settings/ai/key', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not clear override key');
      setKeySource(data.keySource || 'none');
      setMaskedKey(data.maskedKey || null);
      setHasDatabaseOverride(false);
      setHasEnvKey(Boolean(data.hasEnvKey));
      setFeedback('Database API key override cleared. Server is now using environment fallback.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear API key');
    } finally {
      setClearingKey(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/settings/ai/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          openrouter_api_key: newApiKey.trim() || undefined,
          model: utilityModel,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({
        ok: false,
        modelUsed: utilityModel,
        keySource,
        latencyMs: 0,
        error: err instanceof Error ? err.message : 'Connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-10 text-center text-sm text-[#8B8275]">
        Loading AI settings & OpenRouter runtime...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-medium text-[#3D3830]">AI settings</h2>
          <p className="mt-1 text-xs text-[#5C5449]">
            Manage your OpenRouter API key, choose active consultation & utility models, register custom models, and tune token budgets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadSettings()}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save AI Settings'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-4 py-3 text-xs text-[#7A3E36]">
          {error}
        </div>
      )}
      {feedback && (
        <div className="rounded-2xl border border-[#2D6A4F]/25 bg-[#2D6A4F]/8 px-4 py-3 text-xs text-[#2D6A4F] flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* 1. OpenRouter API Key Card */}
      <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-[#EAE3D7]/80 flex items-center justify-center text-[#3D3830]">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#3D3830]">OpenRouter API Key</h3>
              <p className="text-xs text-[#8B8275]">
                Stored encrypted (AES-256-GCM) in Supabase with automatic fallback to your server environment variable.
              </p>
            </div>
          </div>

          <div className="text-right text-xs">
            <span className="text-[#8B8275]">Active source: </span>
            <span
              className={`font-medium ${
                keySource === 'none' ? 'text-[#7A3E36]' : 'text-[#2D6A4F]'
              }`}
            >
              {keySource === 'database'
                ? 'Database override (encrypted)'
                : keySource === 'env'
                ? 'Environment variable'
                : 'Not configured'}
            </span>
            {maskedKey && (
              <p className="mt-0.5 font-mono text-[11px] text-[#5C5449]">{maskedKey}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="block text-[11px] font-medium text-[#5C5449] mb-1.5">
              Set or Rotate OpenRouter API Key (leave blank to keep current active key)
            </label>
            <div className="relative">
              <input
                type={showKeyInput ? 'text' : 'password'}
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                autoComplete="off"
                className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] pl-4 pr-11 py-2.5 font-mono text-xs text-[#3D3830] placeholder:text-[#8B8275]/70 focus:outline-none focus:border-[#3D3830]/40"
              />
              <button
                type="button"
                onClick={() => setShowKeyInput((v) => !v)}
                aria-label={showKeyInput ? 'Hide API key' : 'Show API key'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B8275] hover:text-[#3D3830] cursor-pointer"
              >
                {showKeyInput ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={testing}
              onClick={handleTestConnection}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-4 py-2.5 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7]/70 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5 text-[#8B7355]" />
              {testing ? 'Testing...' : 'Test Connection'}
            </button>

            {hasDatabaseOverride && (
              <button
                type="button"
                disabled={clearingKey}
                onClick={handleClearDbKey}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#7A3E36]/25 bg-[#FAF7F2] px-4 py-2.5 text-xs font-medium text-[#7A3E36] hover:bg-[#7A3E36]/8 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {clearingKey ? 'Clearing...' : hasEnvKey ? 'Revert to Env Key' : 'Remove Saved Key'}
              </button>
            )}
          </div>
        </div>

        {testResult && (
          <div
            className={`rounded-2xl border px-4 py-3 text-xs ${
              testResult.ok
                ? 'border-[#2D6A4F]/25 bg-[#2D6A4F]/8 text-[#2D6A4F]'
                : 'border-[#7A3E36]/25 bg-[#7A3E36]/8 text-[#7A3E36]'
            }`}
          >
            {testResult.ok ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Connection verified via <strong className="font-mono">{testResult.modelUsed}</strong> (source: {testResult.keySource}) — reply: &ldquo;{testResult.replyPreview}&rdquo;
                </span>
                <span className="font-mono tabular-nums">{testResult.latencyMs}ms</span>
              </div>
            ) : (
              <div>
                <strong>Connection failed:</strong> {testResult.error}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2. Default Models + Token Limits Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-[#EAE3D7]/80 flex items-center justify-center text-[#3D3830]">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#3D3830]">Default Models</h3>
              <p className="text-xs text-[#8B8275]">
                Used whenever a specific Expert, Recipe, or Report does not set its own override.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-[#5C5449] mb-1.5">
                Primary Consultation & Report Model
              </label>
              <CustomSelect
                value={consultationModel}
                onChange={setConsultationModel}
                options={allModelOptions}
              />
              <input
                type="text"
                value={consultationModel}
                onChange={(e) => setConsultationModel(e.target.value)}
                placeholder="Or type any OpenRouter model slug..."
                className="mt-2 w-full rounded-xl border border-[#3D3830]/12 bg-[#FAF7F2] px-3 py-2 font-mono text-[11px] text-[#5C5449] focus:outline-none focus:border-[#3D3830]/35"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#5C5449] mb-1.5">
                Utility Model (Titles, Follow-ups, Quick Tools, Memory)
              </label>
              <CustomSelect
                value={utilityModel}
                onChange={setUtilityModel}
                options={allModelOptions}
              />
              <input
                type="text"
                value={utilityModel}
                onChange={(e) => setUtilityModel(e.target.value)}
                placeholder="Or type any OpenRouter model slug..."
                className="mt-2 w-full rounded-xl border border-[#3D3830]/12 bg-[#FAF7F2] px-3 py-2 font-mono text-[11px] text-[#5C5449] focus:outline-none focus:border-[#3D3830]/35"
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-[#EAE3D7]/80 flex items-center justify-center text-[#3D3830]">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#3D3830]">Token Limits & Context Window</h3>
              <p className="text-xs text-[#8B8275]">
                Caps maximum completion tokens per mode to balance depth, latency, and API cost.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                Short Reply Max Tokens
              </label>
              <input
                type="number"
                min={100}
                max={8000}
                value={tokenLimits.chat_short}
                onChange={(e) =>
                  setTokenLimits((prev) => ({ ...prev, chat_short: Number(e.target.value) || 100 }))
                }
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                Detailed Reply Max Tokens
              </label>
              <input
                type="number"
                min={200}
                max={16000}
                value={tokenLimits.chat_detailed}
                onChange={(e) =>
                  setTokenLimits((prev) => ({
                    ...prev,
                    chat_detailed: Number(e.target.value) || 200,
                  }))
                }
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                Report Pass Max Tokens
              </label>
              <input
                type="number"
                min={400}
                max={24000}
                value={tokenLimits.report_pass}
                onChange={(e) =>
                  setTokenLimits((prev) => ({
                    ...prev,
                    report_pass: Number(e.target.value) || 400,
                  }))
                }
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                Utility / Tool Max Tokens
              </label>
              <input
                type="number"
                min={100}
                max={4000}
                value={tokenLimits.utility}
                onChange={(e) =>
                  setTokenLimits((prev) => ({ ...prev, utility: Number(e.target.value) || 100 }))
                }
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                Conversation History Window (recent messages included per turn)
              </label>
              <input
                type="number"
                min={2}
                max={60}
                value={tokenLimits.max_history_turns}
                onChange={(e) =>
                  setTokenLimits((prev) => ({
                    ...prev,
                    max_history_turns: Number(e.target.value) || 12,
                  }))
                }
                className="w-full sm:w-44 rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
              />
            </div>
          </div>
        </section>
      </div>

      {/* 2B. Stage 1 Jev Decisions & Pipeline Diagnostics */}
      <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#3D3830]">
              Stage 1 Intent Classifier &amp; Pipeline Diagnostics
            </h3>
            <p className="text-xs text-[#8B8275] mt-0.5">
              Uses your single OpenRouter API key via OpenRouter Alpha Decisions (typesafe/jev-1.14 / 1.13) with automatic Utility LLM fallback.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <div className="rounded-2xl border border-[#3D3830]/10 bg-[#FAF7F2] p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#3D3830]">
                Enable Stage 1 Jev Decisions Classifier
              </span>
              <button
                type="button"
                onClick={() => setJevClassifierEnabled((v) => !v)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  jevClassifierEnabled
                    ? 'bg-[#2D6A4F] text-[#FAF7F2]'
                    : 'bg-[#EAE3D7] text-[#5C5449]'
                }`}
              >
                {jevClassifierEnabled ? 'On' : 'Off'}
              </button>
            </div>
            <p className="text-[11px] text-[#8B8275] leading-relaxed">
              When Off (or if Jev times out past 1.2s), routing falls back directly to your OpenRouter Utility Model.
            </p>
          </div>

          <div className="rounded-2xl border border-[#3D3830]/10 bg-[#FAF7F2] p-4 space-y-2">
            <label className="block text-xs font-semibold text-[#3D3830]">
              Stage 1 Decisions Model
            </label>
            <CustomSelect
              value={jevModel}
              onChange={setJevModel}
              disabled={!jevClassifierEnabled}
              options={[
                {
                  value: 'typesafe/jev-1.14',
                  label: 'typesafe/jev-1.14 (Default)',
                  hint: 'OpenRouter Alpha Decisions',
                },
                {
                  value: 'typesafe/jev-1.13',
                  label: 'typesafe/jev-1.13',
                  hint: 'OpenRouter Alpha Decisions',
                },
                {
                  value: 'utility_model',
                  label: 'OpenRouter Utility LLM',
                  hint: 'Skip Alpha Decisions & classify via Utility Model',
                },
              ]}
            />
          </div>

          <div className="rounded-2xl border border-[#3D3830]/10 bg-[#FAF7F2] p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#3D3830]">
                Enable Chatbot Pipeline Logs
              </span>
              <button
                type="button"
                onClick={() => setPipelineLoggingEnabled((v) => !v)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  pipelineLoggingEnabled
                    ? 'bg-[#2D6A4F] text-[#FAF7F2]'
                    : 'bg-[#EAE3D7] text-[#5C5449]'
                }`}
              >
                {pipelineLoggingEnabled ? 'On' : 'Off'}
              </button>
            </div>
            <p className="text-[11px] text-[#8B8275] leading-relaxed">
              Records Stage 1–4 routing decisions, cancellations, latency, and failures in Admin → Chatbot Logs.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Custom OpenRouter Model Registry */}
      <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[#3D3830]">Custom OpenRouter Models Registry</h3>
          <p className="text-xs text-[#8B8275] mt-0.5">
            Register any OpenRouter model ID here so it appears in all Admin dropdowns across Prompt Library, Recipes, Chatbot, and Reports.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1.1fr_0.9fr_1.2fr_auto] gap-2.5 items-end">
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-[#8B8275] mb-1">
              OpenRouter Model ID
            </label>
            <input
              type="text"
              value={newModelId}
              onChange={(e) => setNewModelId(e.target.value)}
              placeholder="e.g. x-ai/grok-3-mini"
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs text-[#3D3830]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-[#8B8275] mb-1">
              Display Label
            </label>
            <input
              type="text"
              value={newModelLabel}
              onChange={(e) => setNewModelLabel(e.target.value)}
              placeholder="e.g. Grok 3 Mini"
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-[#8B8275] mb-1">
              Provider
            </label>
            <input
              type="text"
              value={newModelProvider}
              onChange={(e) => setNewModelProvider(e.target.value)}
              placeholder="e.g. xAI"
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-[#8B8275] mb-1">
              Notes (optional)
            </label>
            <input
              type="text"
              value={newModelNotes}
              onChange={(e) => setNewModelNotes(e.target.value)}
              placeholder="Fast Sanskrit reasoning"
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830]"
            />
          </div>
          <button
            type="button"
            onClick={handleAddCustomModel}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Model
          </button>
        </div>

        {customModels.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#3D3830]/15 bg-[#FAF7F2]/60 px-4 py-5 text-center text-xs text-[#8B8275]">
            No custom models added yet. Built-in models ({builtinModels.length}) are already available in every selector.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#3D3830]/10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F1ECE3]/80 border-b border-[#3D3830]/10 text-[10px] uppercase tracking-wider text-[#8B8275]">
                  <th className="py-2.5 px-4 font-semibold">Label</th>
                  <th className="py-2.5 px-4 font-semibold">OpenRouter Model ID</th>
                  <th className="py-2.5 px-4 font-semibold">Provider</th>
                  <th className="py-2.5 px-4 font-semibold">Notes</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3D3830]/8 text-xs">
                {customModels.map((m) => (
                  <tr key={m.id} className="hover:bg-[#FAF7F2]/80">
                    <td className="py-2.5 px-4 font-medium text-[#3D3830]">{m.label}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-[#5C5449]">{m.id}</td>
                    <td className="py-2.5 px-4 text-[#5C5449]">{m.provider || '—'}</td>
                    <td className="py-2.5 px-4 text-[#8B8275]">{m.notes || '—'}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomModel(m.id)}
                        className="inline-flex items-center justify-center rounded-lg p-1.5 text-[#7A3E36] hover:bg-[#7A3E36]/10 cursor-pointer"
                        aria-label={`Remove ${m.label}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminAiSettings;
