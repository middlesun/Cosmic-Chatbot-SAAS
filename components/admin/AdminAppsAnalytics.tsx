import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Check,
  Database,
  RefreshCw,
  Save,
  Search,
  Sliders,
  Trash2,
} from 'lucide-react';
import CustomSelect from '../app/CustomSelect';
import type { ModelChoiceOption } from './PromptLibraryManager';

interface MiniAppOverrideConfig {
  enabled?: boolean;
  featured_on_home?: boolean;
  model_id?: string | null;
}

interface MiniAppsGovernanceConfig {
  default_model_id: string | null;
  daily_live_runs_soft_cap: number;
  estimated_input_cost_per_million_usd: number;
  estimated_output_cost_per_million_usd: number;
  overrides: Record<string, MiniAppOverrideConfig>;
}

interface PerAppAnalyticsRow {
  slug: string;
  title: string;
  shortTitle: string;
  category: string;
  categoryLabel: string;
  template: string;
  cacheScope: string;
  enabled: boolean;
  featuredOnHome: boolean;
  modelOverride: string | null;
  runs: number;
  liveRuns: number;
  cacheHits: number;
  cacheHitRate: number;
  uniqueUsers: number;
  avgTokensPerLiveRun: number;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  estimatedCostUsd: number;
  favoritesCount: number;
  lastUsedAt: string | null;
}

interface DailySeriesPoint {
  date: string;
  totalRuns: number;
  liveRuns: number;
  cacheHits: number;
  tokensIn: number;
  tokensOut: number;
}

interface TopUserRow {
  userId: string;
  email: string;
  fullName: string | null;
  tier: string;
  totalRuns: number;
  liveRuns: number;
  cacheHits: number;
  totalTokens: number;
  estimatedCostUsd: number;
  lastUsedAt: string;
}

interface AppsAnalyticsResponse {
  periodDays: number;
  usageTableMissing: boolean;
  summary: {
    totalAppsCount: number;
    activeAppsCount: number;
    totalRuns: number;
    liveRuns: number;
    cacheHits: number;
    cacheHitRate: number;
    uniqueUsers: number;
    totalCachedEntries: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalTokens: number;
    estimatedCostUsd: number;
    avgCostPerActiveUserUsd: number;
    ninetyFiveMarginTargetPerUserUsd: number;
  };
  perApp: PerAppAnalyticsRow[];
  dailySeries: DailySeriesPoint[];
  topUsers: TopUserRow[];
  config: MiniAppsGovernanceConfig;
  effectiveDefaultModel: string;
}

interface AdminAppsAnalyticsProps {
  modelOptions: ModelChoiceOption[];
  getAccessToken: () => Promise<string | null>;
}

const formatUsd = (val: number): string => {
  if (val === 0) return '$0.00';
  if (val < 0.01) return `$${val.toFixed(4)}`;
  return `$${val.toFixed(2)}`;
};

const formatCompactTokens = (tokens: number): string => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return tokens.toLocaleString();
};

const AdminAppsAnalytics: React.FC<AdminAppsAnalyticsProps> = ({
  modelOptions,
  getAccessToken,
}) => {
  const [subTab, setSubTab] = useState<'analytics' | 'governance'>('analytics');
  const [period, setPeriod] = useState<'7' | '30' | 'all'>('30');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [data, setData] = useState<AppsAnalyticsResponse | null>(null);
  const [draftConfig, setDraftConfig] = useState<MiniAppsGovernanceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearingSlug, setClearingSlug] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(
    async (daysParam = period) => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error('Authentication required');
        const res = await fetch(`/api/admin/apps/analytics?days=${daysParam}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load Mini-Apps analytics');
        setData(json as AppsAnalyticsResponse);
        setDraftConfig(json.config as MiniAppsGovernanceConfig);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load Mini-Apps analytics');
      } finally {
        setLoading(false);
      }
    },
    [getAccessToken, period]
  );

  useEffect(() => {
    void loadAnalytics(period);
  }, [loadAnalytics, period]);

  const appModelOptions = useMemo<ModelChoiceOption[]>(() => {
    const base = modelOptions.filter((m) => m.value !== '');
    return [
      {
        value: '',
        label: `Mini-Apps Default (${data?.effectiveDefaultModel || 'Utility Model'})`,
      },
      ...base,
    ];
  }, [modelOptions, data?.effectiveDefaultModel]);

  const globalModelOptions = useMemo<ModelChoiceOption[]>(() => {
    const base = modelOptions.filter((m) => m.value !== '');
    return [
      {
        value: '',
        label: 'Inherit Utility Model (from AI Settings)',
      },
      ...base,
    ];
  }, [modelOptions]);

  const filteredApps = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.perApp
      .filter((row) => {
        if (categoryFilter !== 'all' && row.category !== categoryFilter) return false;
        if (!q) return true;
        return (
          row.title.toLowerCase().includes(q) ||
          row.slug.toLowerCase().includes(q) ||
          row.categoryLabel.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.runs - a.runs || a.title.localeCompare(b.title));
  }, [data, search, categoryFilter]);

  const maxDailyRuns = useMemo(() => {
    if (!data || data.dailySeries.length === 0) return 1;
    return Math.max(1, ...data.dailySeries.map((d) => d.totalRuns));
  }, [data]);

  const updateAppOverride = (slug: string, patch: Partial<MiniAppOverrideConfig>) => {
    setDraftConfig((prev) => {
      if (!prev) return prev;
      const existing = prev.overrides[slug] || {};
      return {
        ...prev,
        overrides: {
          ...prev.overrides,
          [slug]: {
            ...existing,
            ...patch,
          },
        },
      };
    });
  };

  const handleSaveConfig = async () => {
    if (!draftConfig) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/apps/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(draftConfig),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save configuration');
      setFeedback('Mini-Apps governance, model overrides, and cost rates saved and applied live.');
      await loadAnalytics(period);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save Mini-Apps configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleClearCache = async (appSlug?: string) => {
    setClearingSlug(appSlug || '__all__');
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/apps/cache-clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(appSlug ? { appSlug } : {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to clear cache');
      setConfirmClearAll(false);
      setFeedback(
        appSlug
          ? `Cleared cached readings for "${appSlug}". Next visit will generate a fresh reading.`
          : 'Cleared all cached Mini-App outputs across server memory and Supabase.'
      );
      await loadAnalytics(period);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cache clear failed');
    } finally {
      setClearingSlug(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-10 text-center text-sm text-[#8B8275]">
        Loading Mini-Apps usage and token economics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 rounded-2xl bg-[#F1ECE3] p-1.5">
          <button
            type="button"
            onClick={() => setSubTab('analytics')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'analytics'
                ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                : 'text-[#5C5449] hover:text-[#3D3830]'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Usage &amp; Token Economics</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('governance')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'governance'
                ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                : 'text-[#5C5449] hover:text-[#3D3830]'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Apps Governance &amp; Caps ({data?.summary.activeAppsCount ?? 22}/{data?.summary.totalAppsCount ?? 22})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {subTab === 'analytics' && (
            <div className="flex items-center gap-1 rounded-xl bg-[#F1ECE3] p-1">
              {(
                [
                  { id: '7', label: '7d' },
                  { id: '30', label: '30d' },
                  { id: 'all', label: 'All Time' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPeriod(opt.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    period === opt.id
                      ? 'bg-[#4A453D] text-[#FAF7F2]'
                      : 'text-[#5C5449] hover:text-[#3D3830]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {subTab === 'governance' && (
            <button
              type="button"
              disabled={saving || !draftConfig}
              onClick={() => void handleSaveConfig()}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={() => void loadAnalytics(period)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
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

      {data?.usageTableMissing && (
        <div className="rounded-2xl border border-[#B8965A]/45 bg-[#B8965A]/12 p-4 text-xs text-[#3D3830] flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-[#8B7355] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Migration 007 Required for Persistent App Usage &amp; Cache Logs</p>
            <p className="text-[#5C5449]">
              Run{' '}
              <code className="font-mono text-[11px] bg-[#FAF7F2] px-1.5 py-0.5 rounded">
                supabase/migrations/007_mini_apps_and_usage.sql
              </code>{' '}
              in Supabase SQL Editor to start persisting Mini-App runs, cache hits, and OpenRouter token economics across deploys.
            </p>
          </div>
        </div>
      )}

      {/* Observatory Night Unit Economics Strip */}
      {data && (
        <section className="rounded-3xl bg-gradient-to-br from-[#1F2229] to-[#292D36] p-6 sm:p-7 text-[#F4EFE6]">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
            <div>
              <p className="text-xs text-[#F4EFE6]/65">Total App Runs</p>
              <p className="font-mono text-2xl font-medium tabular-nums mt-1 text-[#F4EFE6]">
                {data.summary.totalRuns.toLocaleString()}
              </p>
              <p className="text-[11px] text-[#F4EFE6]/55 mt-0.5 font-mono tabular-nums">
                {data.summary.uniqueUsers} active {data.summary.uniqueUsers === 1 ? 'member' : 'members'}
              </p>
            </div>

            <div>
              <p className="text-xs text-[#F4EFE6]/65">Cache Efficiency</p>
              <p className="font-mono text-2xl font-medium tabular-nums mt-1 text-[#B8965A]">
                {data.summary.cacheHitRate}%
              </p>
              <p className="text-[11px] text-[#F4EFE6]/55 mt-0.5 font-mono tabular-nums">
                {data.summary.cacheHits.toLocaleString()} cached · {data.summary.liveRuns.toLocaleString()} live
              </p>
            </div>

            <div>
              <p className="text-xs text-[#F4EFE6]/65">Total Tokens</p>
              <p className="font-mono text-2xl font-medium tabular-nums mt-1 text-[#F4EFE6]">
                {formatCompactTokens(data.summary.totalTokens)}
              </p>
              <p className="text-[11px] text-[#F4EFE6]/55 mt-0.5 font-mono tabular-nums">
                In {formatCompactTokens(data.summary.totalTokensIn)} · Out {formatCompactTokens(data.summary.totalTokensOut)}
              </p>
            </div>

            <div>
              <p className="text-xs text-[#F4EFE6]/65">Est. OpenRouter Spend</p>
              <p className="font-mono text-2xl font-medium tabular-nums mt-1 text-[#F4EFE6]">
                {formatUsd(data.summary.estimatedCostUsd)}
              </p>
              <p className="text-[11px] text-[#F4EFE6]/55 mt-0.5 font-mono tabular-nums">
                {formatUsd(data.summary.avgCostPerActiveUserUsd)} / active user
              </p>
            </div>

            <div>
              <p className="text-xs text-[#F4EFE6]/65">95% Margin Benchmark</p>
              <p className="font-mono text-2xl font-medium tabular-nums mt-1 text-[#B8965A]">
                {formatUsd(data.summary.ninetyFiveMarginTargetPerUserUsd)}
              </p>
              <p className="text-[11px] text-[#F4EFE6]/55 mt-0.5">
                Implied monthly ARPU target
              </p>
            </div>

            <div>
              <p className="text-xs text-[#F4EFE6]/65">Cached Briefs Stored</p>
              <p className="font-mono text-2xl font-medium tabular-nums mt-1 text-[#F4EFE6]">
                {data.summary.totalCachedEntries.toLocaleString()}
              </p>
              <p className="text-[11px] text-[#F4EFE6]/55 mt-0.5 truncate">
                {data.effectiveDefaultModel}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* SUB-TAB 1: USAGE & TOKEN ECONOMICS */}
      {subTab === 'analytics' && data && (
        <div className="space-y-6">
          {/* Daily Runs & Cache Hit Bar Strip */}
          <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                  Daily App Activity &amp; Cache Savings
                </h2>
                <p className="text-xs text-[#8B8275] mt-0.5">
                  Tracks live AI generations versus zero-cost cached revisits per day.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#5C5449]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#2D6A4F]" />
                  <span>Cache Hit ($0)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#B8965A]" />
                  <span>Live AI Call</span>
                </span>
              </div>
            </div>

            {data.dailySeries.length === 0 ? (
              <div className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 py-10 text-center text-xs text-[#8B8275]">
                No Mini-App runs recorded in this period yet. Activity will populate automatically as members explore Apps.
              </div>
            ) : (
              <div className="overflow-x-auto pb-1">
                <div className="min-w-[560px] flex items-end gap-2 h-40 pt-4">
                  {data.dailySeries.map((day) => {
                    const totalPct = Math.max(6, Math.round((day.totalRuns / maxDailyRuns) * 100));
                    const cachePct =
                      day.totalRuns > 0 ? Math.round((day.cacheHits / day.totalRuns) * 100) : 0;
                    const livePct = 100 - cachePct;
                    return (
                      <div
                        key={day.date}
                        className="flex-1 min-w-[20px] flex flex-col items-center gap-1.5 group"
                        title={`${day.date}: ${day.totalRuns} runs (${day.cacheHits} cached, ${day.liveRuns} live · ${(day.tokensIn + day.tokensOut).toLocaleString()} tokens)`}
                      >
                        <span className="font-mono text-[10px] tabular-nums text-[#8B8275] opacity-80 group-hover:opacity-100">
                          {day.totalRuns}
                        </span>
                        <div className="w-full max-w-[28px] h-28 flex flex-col justify-end rounded-t-md bg-[#F1ECE3]/70 overflow-hidden">
                          <div
                            className="w-full flex flex-col justify-end transition-all"
                            style={{ height: `${totalPct}%` }}
                          >
                            {day.liveRuns > 0 && (
                              <div
                                className="w-full bg-[#B8965A]"
                                style={{ height: `${livePct}%` }}
                              />
                            )}
                            {day.cacheHits > 0 && (
                              <div
                                className="w-full bg-[#2D6A4F]"
                                style={{ height: `${cachePct}%` }}
                              />
                            )}
                          </div>
                        </div>
                        <span className="font-mono text-[10px] tabular-nums text-[#8B8275]">
                          {day.date.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Per-App Usage & Token Table */}
          <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-[#3D3830]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                  Per-App Usage &amp; Cost Breakdown
                </h2>
                <p className="text-xs text-[#8B8275] mt-0.5">
                  Compare popularity, cache hit rate, average token footprint, and estimated spend across all {data.summary.totalAppsCount} apps.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-[#8B8275] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter apps..."
                    className="w-44 rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] pl-8 pr-3 py-2 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/35"
                  />
                </div>
                <div className="w-40">
                  <CustomSelect
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    ariaLabel="Filter apps by category"
                    size="sm"
                    surface="canvas"
                    options={[
                      { value: 'all', label: 'All Categories' },
                      { value: 'daily_timing', label: 'Daily & Timing' },
                      { value: 'self_chart', label: 'Self & Chart' },
                      { value: 'love', label: 'Love' },
                      { value: 'money_career', label: 'Money & Career' },
                      { value: 'mind_wellness', label: 'Mind & Wellness' },
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F1ECE3] text-[#5C5449] border-b border-[#3D3830]/10">
                  <tr>
                    <th className="px-5 py-3 font-medium">Mini-App</th>
                    <th className="px-4 py-3 font-medium">Cache Scope</th>
                    <th className="px-4 py-3 font-medium text-right">Runs</th>
                    <th className="px-4 py-3 font-medium text-right">Live / Cached</th>
                    <th className="px-4 py-3 font-medium text-right">Users</th>
                    <th className="px-4 py-3 font-medium text-right">Avg Tok / Live</th>
                    <th className="px-4 py-3 font-medium text-right">Total Tokens</th>
                    <th className="px-4 py-3 font-medium text-right">Est. Cost</th>
                    <th className="px-5 py-3 font-medium text-right">Saved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3D3830]/8">
                  {filteredApps.map((app) => (
                    <tr key={app.slug} className="hover:bg-[#FAF7F2]/80 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#3D3830]">{app.title}</span>
                          {!app.enabled && (
                            <span className="text-[11px] text-[#7A3E36]">· Paused</span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#8B8275]">
                          {app.categoryLabel} · {app.template.replace('_', ' ')}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-[#5C5449] capitalize">
                        {app.cacheScope}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-[#3D3830]">
                        {app.runs.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-[#5C5449]">
                        {app.liveRuns} / {app.cacheHits}{' '}
                        <span className="text-[#8B8275]">({app.cacheHitRate}%)</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-[#5C5449]">
                        {app.uniqueUsers}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-[#5C5449]">
                        {app.avgTokensPerLiveRun > 0 ? app.avgTokensPerLiveRun.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-[#3D3830]">
                        {app.totalTokens > 0 ? formatCompactTokens(app.totalTokens) : '0'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-[#3D3830]">
                        {formatUsd(app.estimatedCostUsd)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums text-[#8B8275]">
                        {app.favoritesCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Top Active Members Table */}
          <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-[#3D3830]/10">
              <h2 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                Most Active Members on Mini-Apps
              </h2>
              <p className="text-xs text-[#8B8275] mt-0.5">
                Helps benchmark heavy-user consumption patterns before locking future pricing tiers.
              </p>
            </div>
            {data.topUsers.length === 0 ? (
              <p className="p-6 text-xs text-[#8B8275]">
                No member Mini-App sessions recorded in this timeframe yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F1ECE3] text-[#5C5449] border-b border-[#3D3830]/10">
                    <tr>
                      <th className="px-5 py-3 font-medium">Member</th>
                      <th className="px-4 py-3 font-medium">Tier</th>
                      <th className="px-4 py-3 font-medium text-right">Total Runs</th>
                      <th className="px-4 py-3 font-medium text-right">Live / Cached</th>
                      <th className="px-4 py-3 font-medium text-right">Tokens Used</th>
                      <th className="px-5 py-3 font-medium text-right">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3D3830]/8">
                    {data.topUsers.map((u) => (
                      <tr key={u.userId}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-[#3D3830]">{u.email}</p>
                          {u.fullName && <p className="text-[11px] text-[#8B8275]">{u.fullName}</p>}
                        </td>
                        <td className="px-4 py-3 capitalize text-[#5C5449]">{u.tier}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-[#3D3830]">
                          {u.totalRuns.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-[#5C5449]">
                          {u.liveRuns} / {u.cacheHits}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-[#3D3830]">
                          {formatCompactTokens(u.totalTokens)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums text-[#3D3830]">
                          {formatUsd(u.estimatedCostUsd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* SUB-TAB 2: GOVERNANCE, MODEL ROUTING & COST CONTROLS */}
      {subTab === 'governance' && data && draftConfig && (
        <div className="space-y-6">
          {/* Global Mini-Apps Controls */}
          <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                  Global Mini-Apps Routing &amp; Margin Guardrails
                </h2>
                <p className="text-xs text-[#8B8275] mt-0.5">
                  Keep Mini-Apps complimentary for members while protecting your 95% target margin with smart model routing, caching, and a generous daily fresh-generation soft cap.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {confirmClearAll ? (
                  <>
                    <button
                      type="button"
                      disabled={clearingSlug === '__all__'}
                      onClick={() => void handleClearCache()}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#7A3E36] px-3.5 py-1.5 text-xs font-medium text-[#FAF7F2] hover:opacity-90 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{clearingSlug === '__all__' ? 'Clearing...' : 'Confirm Clear All Cache'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="rounded-full border border-[#3D3830]/15 px-3 py-1.5 text-xs text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                  >
                    <Database className="h-3.5 w-3.5" />
                    <span>Clear All Cached Readings</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-[#3D3830]/10">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#5C5449]">
                  Default Mini-Apps Model
                </label>
                <CustomSelect
                  value={draftConfig.default_model_id || ''}
                  onChange={(val) =>
                    setDraftConfig({
                      ...draftConfig,
                      default_model_id: val || null,
                    })
                  }
                  options={globalModelOptions}
                  ariaLabel="Default OpenRouter model for Mini-Apps"
                  surface="canvas"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#5C5449]">
                  Daily Fresh Runs Cap / User
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={draftConfig.daily_live_runs_soft_cap}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      daily_live_runs_soft_cap: Math.max(1, Number(e.target.value) || 40),
                    })
                  }
                  className="w-full min-h-[42px] rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 text-sm font-mono tabular-nums text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                />
                <p className="text-[11px] text-[#8B8275]">Cached revisits never count toward cap.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#5C5449]">
                  Est. Input Cost ($ / 1M tok)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={draftConfig.estimated_input_cost_per_million_usd}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      estimated_input_cost_per_million_usd: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="w-full min-h-[42px] rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 text-sm font-mono tabular-nums text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                />
                <p className="text-[11px] text-[#8B8275]">Used for live margin estimates.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#5C5449]">
                  Est. Output Cost ($ / 1M tok)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={draftConfig.estimated_output_cost_per_million_usd}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      estimated_output_cost_per_million_usd: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="w-full min-h-[42px] rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 text-sm font-mono tabular-nums text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                />
                <p className="text-[11px] text-[#8B8275]">Matches OpenRouter output rate.</p>
              </div>
            </div>
          </section>

          {/* Per-App Toggle, Home Spotlight & Model Override Matrix */}
          <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-[#3D3830]/10">
              <h2 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                Per-App Controls &amp; Model Overrides
              </h2>
              <p className="text-xs text-[#8B8275] mt-0.5">
                Enable or pause individual Mini-Apps, pin favorites to the Home Hub, assign specialized OpenRouter models, or clear stale caches.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F1ECE3] text-[#5C5449] border-b border-[#3D3830]/10">
                  <tr>
                    <th className="px-5 py-3 font-medium">Mini-App</th>
                    <th className="px-4 py-3 font-medium text-center">Active</th>
                    <th className="px-4 py-3 font-medium text-center">Home Hub</th>
                    <th className="px-4 py-3 font-medium">Model Override</th>
                    <th className="px-5 py-3 font-medium text-right">Cache</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3D3830]/8">
                  {data.perApp.map((app) => {
                    const ov = draftConfig.overrides[app.slug] || {};
                    const isEnabled = ov.enabled !== undefined ? ov.enabled : app.enabled;
                    const isFeatured =
                      ov.featured_on_home !== undefined
                        ? ov.featured_on_home
                        : app.featuredOnHome;
                    const currentModel =
                      ov.model_id !== undefined ? ov.model_id || '' : app.modelOverride || '';

                    return (
                      <tr key={app.slug}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-[#3D3830]">{app.title}</p>
                          <p className="text-[11px] text-[#8B8275]">
                            {app.categoryLabel} · {app.cacheScope} cache
                          </p>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isEnabled}
                            aria-label={`Toggle ${app.title} active`}
                            onClick={() => updateAppOverride(app.slug, { enabled: !isEnabled })}
                            className={`relative inline-flex h-5 w-10 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                              isEnabled ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                            }`}
                          >
                            <span
                              className={`h-4 w-4 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                                isEnabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isFeatured}
                            aria-label={`Pin ${app.title} to Home Hub`}
                            onClick={() =>
                              updateAppOverride(app.slug, { featured_on_home: !isFeatured })
                            }
                            className={`relative inline-flex h-5 w-10 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                              isFeatured ? 'bg-[#8B7355]' : 'bg-[#D6CEC0]'
                            }`}
                          >
                            <span
                              className={`h-4 w-4 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                                isFeatured ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </td>

                        <td className="px-4 py-3 min-w-[240px]">
                          <CustomSelect
                            value={currentModel}
                            onChange={(val) =>
                              updateAppOverride(app.slug, { model_id: val || null })
                            }
                            options={appModelOptions}
                            ariaLabel={`Model override for ${app.title}`}
                            size="sm"
                            surface="canvas"
                          />
                        </td>

                        <td className="px-5 py-3 text-right">
                          {app.cacheScope !== 'none' ? (
                            <button
                              type="button"
                              disabled={clearingSlug === app.slug}
                              onClick={() => void handleClearCache(app.slug)}
                              className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>{clearingSlug === app.slug ? 'Clearing...' : 'Flush'}</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-[#8B8275]">Live</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default AdminAppsAnalytics;
