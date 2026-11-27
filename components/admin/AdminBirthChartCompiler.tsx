import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Cpu,
  Database,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
} from 'lucide-react';
import CustomSelect from '../app/CustomSelect';
import type { ModelChoiceOption } from './PromptLibraryManager';

export type AstrologyProviderOptionId =
  | 'freeastrologyapi'
  | 'freeastroapi'
  | 'astroway'
  | 'astrology_api_io';

export interface AstrologyProviderRuntimeInfo {
  id: AstrologyProviderOptionId;
  label: string;
  envKeyName: string;
  baseUrl: string;
  status: 'production_default' | 'poc_adapter_ready' | 'pending_poc';
  supportsSwitch: boolean;
  summary: string;
  envConfigured: boolean;
}

export interface BirthChartConversionConfigState {
  astrology_provider: AstrologyProviderOptionId;
  observation_point: 'geocentric' | 'topocentric';
  ayanamsha: 'lahiri';
  western_house_system: 'Placidus' | 'Whole Sign';
  fetch_api_shadbala: boolean;
  fetch_api_western_planets: boolean;
  narrative_kernel_enabled: boolean;
  narrative_kernel_model_id: string | null;
  narrative_kernel_temperature: number;
  narrative_kernel_max_tokens: number;
  include_validated_yogas_limit: number;
  include_suppressed_yogas_limit: number;
  include_doshas_limit: number;
}

interface AdminBirthChartCompilerProps {
  getAccessToken: () => Promise<string | null>;
  modelOptions?: ModelChoiceOption[];
  onSaved?: () => void;
  compact?: boolean;
}

function approxTokens(text: string): number {
  const len = (text || '').trim().length;
  return len === 0 ? 0 : Math.ceil(len / 4);
}

const AdminBirthChartCompiler: React.FC<AdminBirthChartCompilerProps> = ({
  getAccessToken,
  modelOptions = [],
  onSaved,
  compact = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [config, setConfig] = useState<BirthChartConversionConfigState | null>(null);
  const [providers, setProviders] = useState<AstrologyProviderRuntimeInfo[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState('');
  const [defaultUserPrompt, setDefaultUserPrompt] = useState('');
  const [utilityModel, setUtilityModel] = useState('google/gemini-2.5-flash');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/settings/birth-chart', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load birth chart compiler settings');

      setConfig(data.config);
      if (Array.isArray(data.providers)) setProviders(data.providers);
      setSystemPrompt(data.prompts?.natal_narrative_kernel_system_prompt || '');
      setUserPrompt(data.prompts?.natal_narrative_kernel_user_prompt || '');
      setDefaultSystemPrompt(data.promptDefaults?.natal_narrative_kernel_system_prompt || '');
      setDefaultUserPrompt(data.promptDefaults?.natal_narrative_kernel_user_prompt || '');
      if (data.utilityModel) setUtilityModel(data.utilityModel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load birth chart settings');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const modelDropdownOptions = useMemo(() => {
    return [
      {
        value: '__inherit__',
        label: `Inherit Utility Model (${utilityModel})`,
        description: 'Configured in Admin → AI Settings',
      },
      ...modelOptions
        .filter((m) => m.value)
        .map((m) => ({
          value: m.value,
          label: m.label,
          description: m.description,
        })),
    ];
  }, [modelOptions, utilityModel]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/settings/birth-chart', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          config,
          natal_narrative_kernel_system_prompt: systemPrompt,
          natal_narrative_kernel_user_prompt: userPrompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save birth chart settings');

      setConfig(data.config);
      if (Array.isArray(data.providers)) setProviders(data.providers);
      setSystemPrompt(data.prompts?.natal_narrative_kernel_system_prompt || '');
      setUserPrompt(data.prompts?.natal_narrative_kernel_user_prompt || '');
      setFeedback('Birth chart conversion parameters and Natal Truth Dossier prompts saved.');
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (scope: 'all' | 'config' | 'system_prompt' | 'user_prompt') => {
    setResetting(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/settings/birth-chart/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ scope }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');

      setConfig(data.config);
      if (Array.isArray(data.providers)) setProviders(data.providers);
      setSystemPrompt(data.prompts?.natal_narrative_kernel_system_prompt || '');
      setUserPrompt(data.prompts?.natal_narrative_kernel_user_prompt || '');
      setFeedback(
        scope === 'all'
          ? 'All birth chart conversion settings and prompts restored to Code Defaults.'
          : 'Selected birth chart setting restored to Code Default.'
      );
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset birth chart settings');
    } finally {
      setResetting(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-8 text-center text-sm text-[#8B8275]">
        Loading Birth Chart Conversion &amp; Natal Dossier settings...
      </div>
    );
  }

  const isSystemCustom =
    Boolean(defaultSystemPrompt) && systemPrompt.trim() !== defaultSystemPrompt.trim();
  const isUserCustom =
    Boolean(defaultUserPrompt) && userPrompt.trim() !== defaultUserPrompt.trim();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {!compact && (
            <h2 className="font-['Cormorant_Garamond',serif] text-2xl font-medium text-[#3D3830]">
              Birth Chart Conversion &amp; Natal Truth Dossier
            </h2>
          )}
          <p className="text-xs text-[#5C5449] mt-0.5 max-w-3xl">
            Controls how raw birth details are fetched from FreeAstrologyAPI (<span className="font-mono">astrologyApi.ts</span>), expanded deterministically (<span className="font-mono">chartCompiler.ts</span> + <span className="font-mono">jyotishMath.ts</span>), and compiled by OpenRouter into each profile&apos;s Natal Truth Dossier (<span className="font-mono">natalDossier.ts</span>).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadSettings()}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reload</span>
          </button>
          <button
            type="button"
            disabled={resetting || saving}
            onClick={() => void handleReset('all')}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset All Defaults</span>
          </button>
          <button
            type="button"
            disabled={saving || resetting}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-1.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving...' : 'Save Birth Chart Settings'}</span>
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

      {/* 3-Stage Conversion Pipeline Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#3D3830]">
            <Database className="h-3.5 w-3.5 text-[#8B7355]" />
            <span>1. FreeAstrologyAPI Fetch</span>
          </div>
          <p className="text-[11px] text-[#5C5449] leading-relaxed">
            Geocodes place + historical DST timezone, fetches <span className="font-mono">/planets/extended</span> (Lahiri), and optionally fetches <span className="font-mono">/shad-bala/summary</span> and <span className="font-mono">/western/planets</span>.
          </p>
        </div>

        <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#3D3830]">
            <Cpu className="h-3.5 w-3.5 text-[#8B7355]" />
            <span>2. Deterministic Chart Math</span>
          </div>
          <p className="text-[11px] text-[#5C5449] leading-relaxed">
            Computes 16 Vargas (<span className="font-mono">D1–D60</span>), KP Placidus cusps &amp; Sub-Lords, Jaimini Karakas/Arudhas/Chara Dasha, Ashtakavarga, Shadbala, Vimshottari, Bhava Chalit, Doshas &amp; Western Hellenistic data.
          </p>
        </div>

        <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#3D3830]">
            <Sparkles className="h-3.5 w-3.5 text-[#B8965A]" />
            <span>3. Natal Truth Dossier (Layer A + B)</span>
          </div>
          <p className="text-[11px] text-[#5C5449] leading-relaxed">
            Builds verified Layer A structural dossier + Western dossier, then runs the OpenRouter LLM Layer B Narrative Kernel prompt below (with deterministic fallback).
          </p>
        </div>
      </div>

      {/* Stage 1 & Stage 3 Parameter Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Stage 1: FreeAstrologyAPI Parameters */}
        <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                Stage 1 — AstrologyAPI Parameters
              </h3>
              <p className="text-xs text-[#8B8275] mt-0.5">
                Applied on new profile creation, chart activation, and backfill compiles.
              </p>
            </div>
            <button
              type="button"
              disabled={resetting || saving}
              onClick={() => void handleReset('config')}
              className="text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:underline cursor-pointer"
            >
              Reset Config
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-medium text-[#5C5449]">
                Active Ephemeris &amp; Chart API Provider
              </label>
              <CustomSelect
                value={config.astrology_provider || 'freeastrologyapi'}
                onChange={(val) =>
                  setConfig((prev) =>
                    prev
                      ? {
                          ...prev,
                          astrology_provider: val as AstrologyProviderOptionId,
                        }
                      : prev
                  )
                }
                ariaLabel="Active astrology API provider"
                surface="canvas"
                className="w-full"
                options={(providers.length > 0
                  ? providers
                  : [
                      {
                        id: 'freeastrologyapi' as const,
                        label: 'FreeAstrologyAPI (Production Default)',
                        envKeyName: 'FREE_ASTROLOGY_API_KEY',
                        baseUrl: 'https://json.freeastrologyapi.com',
                        status: 'production_default' as const,
                        supportsSwitch: true,
                        summary: 'Default provider',
                        envConfigured: true,
                      },
                      {
                        id: 'freeastroapi' as const,
                        label: 'FreeAstroAPI V2 (French Ephemeris)',
                        envKeyName: 'FREE_ASTRO_API_KEY',
                        baseUrl: 'https://api.freeastroapi.com',
                        status: 'poc_adapter_ready' as const,
                        supportsSwitch: true,
                        summary: 'Evaluation candidate',
                        envConfigured: false,
                      },
                    ]
                ).map((p) => ({
                  value: p.id,
                  label: p.label,
                  disabled: !p.supportsSwitch,
                  hint: p.supportsSwitch
                    ? `${p.envKeyName}: ${p.envConfigured ? 'Configured in server env' : 'Missing in server env'}`
                    : `${p.envKeyName} — Pending PoC evaluation`,
                }))}
              />
              {(() => {
                const selected = providers.find((p) => p.id === config.astrology_provider);
                if (!selected) return null;
                return (
                  <p className="text-[11px] text-[#8B8275]">
                    {selected.summary}{' '}
                    <span className="font-mono">
                      ({selected.envKeyName}: {selected.envConfigured ? 'configured' : 'unset in server env'})
                    </span>
                  </p>
                );
              })()}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#5C5449]">
                Observation Point
              </label>
              <CustomSelect
                value={config.observation_point}
                onChange={(val) =>
                  setConfig((prev) =>
                    prev
                      ? {
                          ...prev,
                          observation_point: val === 'topocentric' ? 'topocentric' : 'geocentric',
                        }
                      : prev
                  )
                }
                ariaLabel="Observation point"
                surface="canvas"
                className="w-full"
                options={[
                  { value: 'geocentric', label: 'Geocentric (Standard)' },
                  { value: 'topocentric', label: 'Topocentric (Observer Surface)' },
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#5C5449]">
                Vedic Ayanamsha (Math-Locked)
              </label>
              <div className="rounded-xl border border-[#3D3830]/12 bg-[#F1ECE3]/70 px-3 py-2 font-mono text-xs text-[#5C5449]">
                Lahiri (Chitrapaksha)
              </div>
              <p className="text-[10px] text-[#8B8275]">
                Required by KP Placidus &amp; Nakshatra math invariants.
              </p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-medium text-[#5C5449]">
                Western API House System
              </label>
              <CustomSelect
                value={config.western_house_system}
                onChange={(val) =>
                  setConfig((prev) =>
                    prev
                      ? {
                          ...prev,
                          western_house_system: val === 'Whole Sign' ? 'Whole Sign' : 'Placidus',
                        }
                      : prev
                  )
                }
                ariaLabel="Western API house system"
                surface="canvas"
                className="w-full"
                options={[
                  { value: 'Placidus', label: 'Placidus (Default)' },
                  { value: 'Whole Sign', label: 'Whole Sign' },
                ]}
              />
            </div>
          </div>

          <div className="divide-y divide-[#3D3830]/10 pt-1">
            <div className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#3D3830]">
                  Fetch API Shad Bala Summary (<span className="font-mono">/shad-bala/summary</span>)
                </p>
                <p className="text-[11px] text-[#8B8275]">
                  When Off, skips 1 extra API call/chart and relies on deterministic <span className="font-mono">jyotishMath.ts</span> Shadbala.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config.fetch_api_shadbala}
                onClick={() =>
                  setConfig((prev) =>
                    prev ? { ...prev, fetch_api_shadbala: !prev.fetch_api_shadbala } : prev
                  )
                }
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  config.fetch_api_shadbala ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                    config.fetch_api_shadbala ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#3D3830]">
                  Fetch API Western Tropical Planets (<span className="font-mono">/western/planets</span>)
                </p>
                <p className="text-[11px] text-[#8B8275]">
                  When Off, computes Tropical positions directly from Lahiri longitudes + Ayanamsha.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config.fetch_api_western_planets}
                onClick={() =>
                  setConfig((prev) =>
                    prev
                      ? { ...prev, fetch_api_western_planets: !prev.fetch_api_western_planets }
                      : prev
                  )
                }
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  config.fetch_api_western_planets ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                    config.fetch_api_western_planets ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Stage 3: Layer B LLM Extractor Runtime Settings */}
        <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
              Stage 3 — Natal Narrative Kernel LLM Runtime
            </h3>
            <p className="text-xs text-[#8B8275] mt-0.5">
              Governs the OpenRouter extraction call in <span className="font-mono">natalDossier.ts</span> that turns Layer A math into structured prose fields.
            </p>
          </div>

          <div
            className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 ${
              config.narrative_kernel_enabled
                ? 'border-[#2D6A4F]/25 bg-[#2D6A4F]/6'
                : 'border-[#3D3830]/12 bg-[#FAF7F2]'
            }`}
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#3D3830]">
                Enable Layer B OpenRouter LLM Synthesis
              </p>
              <p className="text-[11px] text-[#5C5449] mt-0.5">
                {config.narrative_kernel_enabled
                  ? 'On — runs the structural compiler prompt below (falls back deterministically if API fails).'
                  : 'Off — skips OpenRouter calls during birth chart compilation and uses deterministic synthesis only.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.narrative_kernel_enabled}
              onClick={() =>
                setConfig((prev) =>
                  prev
                    ? { ...prev, narrative_kernel_enabled: !prev.narrative_kernel_enabled }
                    : prev
                )
              }
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                config.narrative_kernel_enabled ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                  config.narrative_kernel_enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#5C5449]">
              Extraction Model Override
            </label>
            <CustomSelect
              value={config.narrative_kernel_model_id || '__inherit__'}
              onChange={(val) =>
                setConfig((prev) =>
                  prev
                    ? {
                        ...prev,
                        narrative_kernel_model_id: val === '__inherit__' ? null : val,
                      }
                    : prev
                )
              }
              disabled={!config.narrative_kernel_enabled}
              ariaLabel="Natal narrative kernel model"
              surface="canvas"
              className="w-full"
              options={modelDropdownOptions}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                Temperature (0–1)
              </label>
              <input
                type="number"
                step="0.05"
                min={0}
                max={1}
                disabled={!config.narrative_kernel_enabled}
                value={config.narrative_kernel_temperature}
                onChange={(e) =>
                  setConfig((prev) =>
                    prev
                      ? {
                          ...prev,
                          narrative_kernel_temperature: Number(e.target.value),
                        }
                      : prev
                  )
                }
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                Max Output Tokens
              </label>
              <input
                type="number"
                min={300}
                max={3000}
                step={50}
                disabled={!config.narrative_kernel_enabled}
                value={config.narrative_kernel_max_tokens}
                onChange={(e) =>
                  setConfig((prev) =>
                    prev
                      ? {
                          ...prev,
                          narrative_kernel_max_tokens: Number(e.target.value) || 900,
                        }
                      : prev
                  )
                }
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                Validated Yogas Cap
              </label>
              <input
                type="number"
                min={1}
                max={15}
                value={config.include_validated_yogas_limit}
                onChange={(e) =>
                  setConfig((prev) =>
                    prev
                      ? {
                          ...prev,
                          include_validated_yogas_limit: Number(e.target.value) || 5,
                        }
                      : prev
                  )
                }
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                Suppressed Yogas Cap
              </label>
              <input
                type="number"
                min={1}
                max={15}
                value={config.include_suppressed_yogas_limit}
                onChange={(e) =>
                  setConfig((prev) =>
                    prev
                      ? {
                          ...prev,
                          include_suppressed_yogas_limit: Number(e.target.value) || 4,
                        }
                      : prev
                  )
                }
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                Doshas &amp; Risks Cap
              </label>
              <input
                type="number"
                min={1}
                max={15}
                value={config.include_doshas_limit}
                onChange={(e) =>
                  setConfig((prev) =>
                    prev
                      ? {
                          ...prev,
                          include_doshas_limit: Number(e.target.value) || 4,
                        }
                      : prev
                  )
                }
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Extraction Prompts Editor */}
      <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-5">
        <div>
          <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
            Natal Truth Dossier Extraction Prompts (<span className="font-mono text-base">natalDossier.ts</span>)
          </h3>
          <p className="text-xs text-[#8B8275] mt-0.5">
            These prompts run whenever a birth chart is compiled, activated, or recomputed via &ldquo;Refresh Dossier&rdquo;. Use <span className="font-mono text-[#3D3830]">{'{{VERIFIED_LAYER_A_JSON}}'}</span> in the user prompt where the compact Layer A chart JSON should be injected.
          </p>
        </div>

        {/* System Prompt */}
        <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#3D3830]">
                Natal Narrative Kernel — System Prompt
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                  isSystemCustom
                    ? 'bg-[#B8965A]/20 text-[#3D3830]'
                    : 'bg-[#EAE3D7] text-[#8B8275]'
                }`}
              >
                {isSystemCustom ? 'Customized' : 'Code Default'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                {systemPrompt.length} chars · ~{approxTokens(systemPrompt)} tokens
              </span>
              <button
                type="button"
                disabled={resetting || !isSystemCustom}
                onClick={() => void handleReset('system_prompt')}
                className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] disabled:opacity-40 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset to Default</span>
              </button>
            </div>
          </div>

          <textarea
            rows={7}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3.5 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
          <p className="font-mono text-[11px] text-[#8B8275]">
            key: natal_narrative_kernel_system_prompt
          </p>
        </div>

        {/* User Prompt Template */}
        <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#3D3830]">
                Natal Narrative Kernel — User Extraction Template &amp; JSON Schema
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                  isUserCustom
                    ? 'bg-[#B8965A]/20 text-[#3D3830]'
                    : 'bg-[#EAE3D7] text-[#8B8275]'
                }`}
              >
                {isUserCustom ? 'Customized' : 'Code Default'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                {userPrompt.length} chars · ~{approxTokens(userPrompt)} tokens
              </span>
              <button
                type="button"
                disabled={resetting || !isUserCustom}
                onClick={() => void handleReset('user_prompt')}
                className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] disabled:opacity-40 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset to Default</span>
              </button>
            </div>
          </div>

          <textarea
            rows={14}
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3.5 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
          />
          <p className="font-mono text-[11px] text-[#8B8275]">
            key: natal_narrative_kernel_user_prompt · placeholder: {'{{VERIFIED_LAYER_A_JSON}}'}
          </p>
        </div>
      </section>
    </div>
  );
};

export default AdminBirthChartCompiler;
