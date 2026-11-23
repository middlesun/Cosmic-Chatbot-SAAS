import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  Database,
  FolderTree,
  LayoutGrid,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sliders,
  Sparkles,
  Trash2,
} from 'lucide-react';
import CustomSelect from '../app/CustomSelect';
import {
  MINI_APP_ICON_OPTIONS,
  renderMiniAppIcon,
} from '../app/miniAppsClientData';
import type {
  MiniAppCategoryRecord,
  MiniAppTemplate,
} from '../app/miniAppsTypes';
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

export interface AdminMiniAppRecord {
  slug: string;
  title: string;
  shortTitle: string;
  tagline: string;
  description: string;
  category: string;
  categoryLabel: string;
  template: MiniAppTemplate;
  iconKey: string;
  popular: boolean;
  featuredOnHome: boolean;
  requiresProfile: boolean;
  cacheScope: 'daily' | 'weekly' | 'monthly' | 'chart' | 'none';
  chatSeedPrompt: string;
  estimatedRead: string;
  sortOrder: number;
  isActive: boolean;
  vedicPrompt: string;
  westernPrompt: string;
  systemOverride: string;
  inputLabel: string;
  inputPlaceholder: string;
  modelId: string | null;
  isBuiltIn: boolean;
  hasDefaultPrompt: boolean;
  defaultVedicPrompt: string;
  defaultWesternPrompt: string;
}

interface AppsManagerResponse {
  apps: AdminMiniAppRecord[];
  categories: MiniAppCategoryRecord[];
  storageSource: 'tables' | 'settings' | 'defaults';
  effectiveDefaultModel: string;
}

interface AppEditorDraft {
  slug: string;
  title: string;
  shortTitle: string;
  tagline: string;
  description: string;
  category: string;
  template: MiniAppTemplate;
  iconKey: string;
  popular: boolean;
  featuredOnHome: boolean;
  requiresProfile: boolean;
  cacheScope: 'daily' | 'weekly' | 'monthly' | 'chart' | 'none';
  chatSeedPrompt: string;
  estimatedRead: string;
  vedicPrompt: string;
  westernPrompt: string;
  systemOverride: string;
  inputLabel: string;
  inputPlaceholder: string;
  modelId: string;
  isActive: boolean;
}

interface AdminAppsAnalyticsProps {
  modelOptions: ModelChoiceOption[];
  getAccessToken: () => Promise<string | null>;
}

const PROMPT_PLACEHOLDERS: Array<{ token: string; hint: string }> = [
  { token: '{{date}}', hint: 'Full readable date (e.g. Sunday, November 22, 2026)' },
  { token: '{{formatted_date}}', hint: 'Day-Month-Year (e.g. 22 November 2026)' },
  { token: '{{month_year}}', hint: 'Current month & year' },
  { token: '{{year}}', hint: 'Current 4-digit year' },
  { token: '{{profile_name}}', hint: 'Selected profile name' },
  { token: '{{mode}}', hint: 'Vedic or Western' },
  { token: '{{user_inputs}}', hint: 'Form text or prompt entered by user' },
  { token: '{{app_title}}', hint: 'Current app title' },
  { token: '{{app_description}}', hint: 'Current app description' },
  { token: '{{partner_name}}', hint: 'Partner name (for compatibility / matching)' },
  { token: '{{partner_dob}}', hint: 'Partner birth date' },
  { token: '{{relationship_intent}}', hint: 'Relationship matching focus' },
  { token: '{{planet}}', hint: 'Selected planet (for guided quiz)' },
  { token: '{{domain_title}}', hint: 'Selected domain (for breakdown explorer)' },
  { token: '{{topic_label}}', hint: 'Selected topic (for breakdown explorer)' },
];

const TEMPLATE_OPTIONS: Array<{ value: MiniAppTemplate; label: string }> = [
  { value: 'auto_brief', label: 'Auto Brief (Instant Reading)' },
  { value: 'form_reading', label: 'Form Reading (User Prompt + Chart)' },
  { value: 'domain_explorer', label: 'Domain Explorer (Multi-Topic)' },
  { value: 'guided_quiz', label: 'Guided Quiz (Assessment)' },
];

const CUSTOM_APP_TEMPLATE_OPTIONS: Array<{ value: MiniAppTemplate; label: string }> = [
  { value: 'auto_brief', label: 'Auto Brief (Instant Reading)' },
  { value: 'form_reading', label: 'Form Reading (User Prompt + Chart)' },
];

const CACHE_SCOPE_OPTIONS: Array<{
  value: 'daily' | 'weekly' | 'monthly' | 'chart' | 'none';
  label: string;
}> = [
  { value: 'daily', label: 'Daily Cache (1x / day / profile)' },
  { value: 'weekly', label: 'Weekly Cache (1x / ISO week)' },
  { value: 'monthly', label: 'Monthly Cache (1x / month)' },
  { value: 'chart', label: 'Per Chart (Cached indefinitely)' },
  { value: 'none', label: 'Live (No Cache · Unique per input)' },
];

const BUILTIN_INTERACTIVE_SLUGS = new Set([
  'birth-chart-breakdown',
  'planet-strength-tester',
  'love-compatibility',
  'dream-interpreter',
  'affirmations-generator',
  'salary-negotiator',
  'birth-chart-matching',
  'breakup-clarity',
  'relationship-patterns',
  'pet-bond',
]);

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

function slugifyAppTitle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function toEditorDraft(app: AdminMiniAppRecord): AppEditorDraft {
  return {
    slug: app.slug,
    title: app.title,
    shortTitle: app.shortTitle || app.title,
    tagline: app.tagline,
    description: app.description,
    category: app.category,
    template: app.template,
    iconKey: app.iconKey || 'sparkles',
    popular: app.popular,
    featuredOnHome: app.featuredOnHome,
    requiresProfile: app.requiresProfile,
    cacheScope: app.cacheScope,
    chatSeedPrompt: app.chatSeedPrompt,
    estimatedRead: app.estimatedRead || '2 min read',
    vedicPrompt: app.vedicPrompt || '',
    westernPrompt: app.westernPrompt || '',
    systemOverride: app.systemOverride || '',
    inputLabel: app.inputLabel || '',
    inputPlaceholder: app.inputPlaceholder || '',
    modelId: app.modelId || '',
    isActive: app.isActive,
  };
}

function buildBlankDraft(defaultCategory: string): AppEditorDraft {
  return {
    slug: '',
    title: '',
    shortTitle: '',
    tagline: '',
    description: '',
    category: defaultCategory || 'daily_timing',
    template: 'auto_brief',
    iconKey: 'sparkles',
    popular: false,
    featuredOnHome: false,
    requiresProfile: true,
    cacheScope: 'chart',
    chatSeedPrompt: 'Help me reflect further on this reading and apply it practically.',
    estimatedRead: '2 min read',
    vedicPrompt:
      'Provide a grounded, empathetic Vedic (Sidereal Lahiri) reading for {{profile_name}} as of {{formatted_date}}.\n\nCite exact Lagna, Moon Nakshatra, active Dasha/Antardasha, and practical guidance with clear sections and warm, non-fear-based counsel.',
    westernPrompt:
      'Provide a grounded, insightful Western (Tropical Placidus) reading for {{profile_name}} as of {{formatted_date}}.\n\nReference exact Sun, Moon, Rising, key planetary aspects, and constructive next steps.',
    systemOverride: '',
    inputLabel: 'What would you like this app to focus on?',
    inputPlaceholder: 'Enter a specific question, situation, or context...',
    modelId: '',
    isActive: true,
  };
}

const AdminAppsAnalytics: React.FC<AdminAppsAnalyticsProps> = ({
  modelOptions,
  getAccessToken,
}) => {
  const [subTab, setSubTab] = useState<'manager' | 'categories' | 'analytics' | 'governance'>('manager');
  const [period, setPeriod] = useState<'7' | '30' | 'all'>('30');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [data, setData] = useState<AppsAnalyticsResponse | null>(null);
  const [managerData, setManagerData] = useState<AppsManagerResponse | null>(null);
  const [draftConfig, setDraftConfig] = useState<MiniAppsGovernanceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearingSlug, setClearingSlug] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // App Manager State
  const [managerSearch, setManagerSearch] = useState('');
  const [managerCategoryFilter, setManagerCategoryFilter] = useState('all');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [editorTab, setEditorTab] = useState<'general' | 'prompts'>('general');
  const [editorDraft, setEditorDraft] = useState<AppEditorDraft | null>(null);
  const [activePromptField, setActivePromptField] = useState<
    'vedicPrompt' | 'westernPrompt' | 'chatSeedPrompt' | 'systemOverride'
  >('vedicPrompt');
  const [savingApp, setSavingApp] = useState(false);
  const [reorderingApps, setReorderingApps] = useState(false);
  const [confirmDeleteApp, setConfirmDeleteApp] = useState(false);
  const [deletingApp, setDeletingApp] = useState(false);

  // Categories Manager State
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [newCatActive, setNewCatActive] = useState(true);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [catLabelDrafts, setCatLabelDrafts] = useState<Record<string, string>>({});
  const [busyCatSlug, setBusyCatSlug] = useState<string | null>(null);
  const [reorderingCats, setReorderingCats] = useState(false);

  const loadAllData = useCallback(
    async (daysParam = period) => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error('Authentication required');

        const [analyticsRes, managerRes] = await Promise.all([
          fetch(`/api/admin/apps/analytics?days=${daysParam}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('/api/admin/apps/manager', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const [analyticsJson, managerJson] = await Promise.all([
          analyticsRes.json(),
          managerRes.json(),
        ]);

        if (!analyticsRes.ok) {
          throw new Error(analyticsJson.error || 'Failed to load Mini-Apps analytics');
        }
        if (!managerRes.ok) {
          throw new Error(managerJson.error || 'Failed to load Mini-Apps manager');
        }

        setData(analyticsJson as AppsAnalyticsResponse);
        setDraftConfig(analyticsJson.config as MiniAppsGovernanceConfig);

        const nextManager = managerJson as AppsManagerResponse;
        setManagerData(nextManager);

        const nextLabelDrafts: Record<string, string> = {};
        for (const cat of nextManager.categories) {
          nextLabelDrafts[cat.slug] = cat.label;
        }
        setCatLabelDrafts(nextLabelDrafts);

        setSelectedSlug((prev) => {
          if (isCreatingNew) return prev;
          if (prev && nextManager.apps.some((a) => a.slug === prev)) return prev;
          return nextManager.apps[0]?.slug || null;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load Mini-Apps workspace');
      } finally {
        setLoading(false);
      }
    },
    [getAccessToken, isCreatingNew, period]
  );

  useEffect(() => {
    void loadAllData(period);
  }, [loadAllData, period]);

  // Sync editor draft whenever selected app changes (when not creating new)
  const selectedApp = useMemo(() => {
    if (!managerData || !selectedSlug || isCreatingNew) return null;
    return managerData.apps.find((a) => a.slug === selectedSlug) || null;
  }, [managerData, selectedSlug, isCreatingNew]);

  useEffect(() => {
    if (isCreatingNew) return;
    if (selectedApp) {
      setEditorDraft(toEditorDraft(selectedApp));
      setConfirmDeleteApp(false);
    }
  }, [selectedApp, isCreatingNew]);

  const appModelOptions = useMemo<ModelChoiceOption[]>(() => {
    const base = modelOptions.filter((m) => m.value !== '');
    const defaultLabel =
      managerData?.effectiveDefaultModel || data?.effectiveDefaultModel || 'Utility Model';
    return [
      {
        value: '',
        label: `Mini-Apps Default (${defaultLabel})`,
      },
      ...base,
    ];
  }, [modelOptions, managerData?.effectiveDefaultModel, data?.effectiveDefaultModel]);

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

  const categorySelectOptions = useMemo(() => {
    const cats = managerData?.categories || [];
    return cats.map((c) => ({
      value: c.slug,
      label: c.isActive ? c.label : `${c.label} (Hidden)`,
    }));
  }, [managerData?.categories]);

  const categoryFilterOptions = useMemo(() => {
    const cats = managerData?.categories || [];
    return [
      { value: 'all', label: 'All Categories' },
      ...cats.map((c) => ({ value: c.slug, label: c.label })),
    ];
  }, [managerData?.categories]);

  const managerFilteredApps = useMemo(() => {
    if (!managerData) return [];
    const q = managerSearch.trim().toLowerCase();
    return managerData.apps.filter((app) => {
      if (managerCategoryFilter !== 'all' && app.category !== managerCategoryFilter) return false;
      if (!q) return true;
      return (
        app.title.toLowerCase().includes(q) ||
        app.slug.toLowerCase().includes(q) ||
        app.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [managerData, managerSearch, managerCategoryFilter]);

  const canReorderApps = !managerSearch.trim() && managerCategoryFilter === 'all';

  const appCountByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const app of managerData?.apps || []) {
      counts.set(app.category, (counts.get(app.category) || 0) + 1);
    }
    return counts;
  }, [managerData?.apps]);

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

  const startCreateNewApp = () => {
    const defaultCat = managerData?.categories[0]?.slug || 'daily_timing';
    setIsCreatingNew(true);
    setSlugTouched(false);
    setConfirmDeleteApp(false);
    setEditorTab('general');
    setEditorDraft(buildBlankDraft(defaultCat));
    setError(null);
    setFeedback(null);
  };

  const selectExistingApp = (slug: string) => {
    setIsCreatingNew(false);
    setSelectedSlug(slug);
    setConfirmDeleteApp(false);
    setError(null);
  };

  const handleSaveApp = async (flushCache = false) => {
    if (!editorDraft) return;
    if (!editorDraft.title.trim()) {
      setError('App name / title is required.');
      return;
    }

    setSavingApp(true);
    setError(null);
    setFeedback(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');

      const payload = {
        slug: editorDraft.slug.trim() || slugifyAppTitle(editorDraft.title),
        title: editorDraft.title.trim(),
        shortTitle: editorDraft.shortTitle.trim() || editorDraft.title.trim(),
        tagline: editorDraft.tagline.trim(),
        description: editorDraft.description.trim(),
        category: editorDraft.category,
        template: editorDraft.template,
        iconKey: editorDraft.iconKey,
        popular: editorDraft.popular,
        featuredOnHome: editorDraft.featuredOnHome,
        requiresProfile: editorDraft.requiresProfile,
        cacheScope: editorDraft.cacheScope,
        chatSeedPrompt: editorDraft.chatSeedPrompt.trim(),
        estimatedRead: editorDraft.estimatedRead.trim() || '2 min read',
        vedicPrompt: editorDraft.vedicPrompt,
        westernPrompt: editorDraft.westernPrompt,
        systemOverride: editorDraft.systemOverride,
        inputLabel: editorDraft.inputLabel.trim(),
        inputPlaceholder: editorDraft.inputPlaceholder.trim(),
        modelId: editorDraft.modelId.trim() || null,
        isActive: editorDraft.isActive,
        flushCache,
      };

      const url = isCreatingNew
        ? '/api/admin/apps/items'
        : `/api/admin/apps/items/${encodeURIComponent(editorDraft.slug)}`;
      const method = isCreatingNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save Mini-App');

      const savedApp = json.app as AdminMiniAppRecord;
      setIsCreatingNew(false);
      setSelectedSlug(savedApp.slug);
      setEditorDraft(toEditorDraft(savedApp));
      setFeedback(
        isCreatingNew
          ? `Created "${savedApp.title}" (${savedApp.slug}) and published to live catalog.`
          : flushCache
            ? `Saved "${savedApp.title}" and flushed cached readings so changes apply immediately.`
            : `Saved "${savedApp.title}" changes live.`
      );
      await loadAllData(period);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save Mini-App');
    } finally {
      setSavingApp(false);
    }
  };

  const handleDeleteApp = async () => {
    if (!selectedApp) return;
    setDeletingApp(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await fetch(`/api/admin/apps/items/${encodeURIComponent(selectedApp.slug)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete Mini-App');

      setConfirmDeleteApp(false);
      setSelectedSlug(null);
      setEditorDraft(null);
      setFeedback(`Deleted "${selectedApp.title}" and cleared its cache.`);
      await loadAllData(period);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete Mini-App');
    } finally {
      setDeletingApp(false);
    }
  };

  const handleMoveApp = async (index: number, direction: -1 | 1) => {
    if (!managerData || !canReorderApps || reorderingApps) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= managerData.apps.length) return;

    const nextApps = [...managerData.apps];
    const [moved] = nextApps.splice(index, 1);
    nextApps.splice(targetIdx, 0, moved);

    const orderedSlugs = nextApps.map((a) => a.slug);
    setManagerData({ ...managerData, apps: nextApps });
    setReorderingApps(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/admin/apps/items/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderedSlugs }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to reorder apps');
      setFeedback('Updated Mini-Apps display order live.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save app order');
      await loadAllData(period);
    } finally {
      setReorderingApps(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatLabel.trim()) {
      setError('Category label is required.');
      return;
    }
    setCreatingCategory(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/admin/apps/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          label: newCatLabel.trim(),
          slug: newCatSlug.trim() || undefined,
          isActive: newCatActive,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create category');

      setNewCatLabel('');
      setNewCatSlug('');
      setNewCatActive(true);
      setFeedback(`Added category "${json.category.label}".`);
      await loadAllData(period);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create category');
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleUpdateCategory = async (
    slug: string,
    patch: { label?: string; isActive?: boolean }
  ) => {
    setBusyCatSlug(slug);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await fetch(`/api/admin/apps/categories/${encodeURIComponent(slug)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update category');
      setFeedback(`Updated category "${json.category.label}".`);
      await loadAllData(period);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update category');
    } finally {
      setBusyCatSlug(null);
    }
  };

  const handleDeleteCategory = async (slug: string, label: string) => {
    setBusyCatSlug(slug);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await fetch(`/api/admin/apps/categories/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete category');
      setFeedback(`Deleted category "${label}".`);
      await loadAllData(period);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete category');
    } finally {
      setBusyCatSlug(null);
    }
  };

  const handleMoveCategory = async (index: number, direction: -1 | 1) => {
    if (!managerData || reorderingCats) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= managerData.categories.length) return;

    const nextCats = [...managerData.categories];
    const [moved] = nextCats.splice(index, 1);
    nextCats.splice(targetIdx, 0, moved);

    const orderedSlugs = nextCats.map((c) => c.slug);
    setManagerData({ ...managerData, categories: nextCats });
    setReorderingCats(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/admin/apps/categories/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderedSlugs }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to reorder categories');
      setFeedback('Updated category display order live.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reorder categories');
      await loadAllData(period);
    } finally {
      setReorderingCats(false);
    }
  };

  const handleInsertPlaceholder = (token: string) => {
    if (!editorDraft) return;
    setEditorDraft((prev) => {
      if (!prev) return prev;
      const existing = prev[activePromptField] || '';
      const separator = existing && !existing.endsWith(' ') && !existing.endsWith('\n') ? ' ' : '';
      return {
        ...prev,
        [activePromptField]: `${existing}${separator}${token}`,
      };
    });
  };

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
      await loadAllData(period);
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
      await loadAllData(period);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cache clear failed');
    } finally {
      setClearingSlug(null);
    }
  };

  if (loading && !data && !managerData) {
    return (
      <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-10 text-center text-sm text-[#8B8275]">
        Loading Mini-Apps manager, prompts, and token economics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#F1ECE3] p-1.5">
          <button
            type="button"
            onClick={() => setSubTab('manager')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'manager'
                ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                : 'text-[#5C5449] hover:text-[#3D3830]'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Apps Manager ({managerData?.apps.length ?? data?.summary.totalAppsCount ?? 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('categories')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'categories'
                ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                : 'text-[#5C5449] hover:text-[#3D3830]'
            }`}
          >
            <FolderTree className="h-3.5 w-3.5" />
            <span>Categories ({managerData?.categories.length ?? 0})</span>
          </button>

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
            <span>Usage &amp; Economics</span>
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
            <span>
              Global Caps ({data?.summary.activeAppsCount ?? 0}/{data?.summary.totalAppsCount ?? 0})
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {subTab === 'manager' && (
            <button
              type="button"
              onClick={startCreateNewApp}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New App</span>
            </button>
          )}

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
            onClick={() => void loadAllData(period)}
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
              in Supabase SQL Editor to persist Mini-App runs, cache hits, and OpenRouter token economics across deploys.
            </p>
          </div>
        </div>
      )}

      {/* Observatory Night Unit Economics Strip (visible on Analytics & Governance) */}
      {data && (subTab === 'analytics' || subTab === 'governance') && (
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
                In {formatCompactTokens(data.summary.totalTokensIn)} · Out{' '}
                {formatCompactTokens(data.summary.totalTokensOut)}
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
              <p className="text-[11px] text-[#F4EFE6]/55 mt-0.5">Implied monthly ARPU target</p>
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

      {/* SUB-TAB 1: COMPLETE APPS MANAGER (CRUD + PROMPTS + ORDERING) */}
      {subTab === 'manager' && managerData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT PANE: ORDERED APPS ROSTER */}
          <section className="lg:col-span-4 rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] overflow-hidden">
            <div className="p-4 border-b border-[#3D3830]/10 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                    Display Order &amp; Apps
                  </h2>
                  <p className="text-[11px] text-[#8B8275]">
                    {canReorderApps
                      ? 'Use ↑ ↓ to reorder how apps appear in the user hub.'
                      : 'Clear search & category filter to reorder display sequence.'}
                  </p>
                </div>
                {managerData.storageSource !== 'tables' && (
                  <span
                    className="rounded-lg bg-[#F1ECE3] px-2 py-1 text-[10px] font-mono text-[#5C5449]"
                    title="Persisted via platform settings until migration 016 is executed"
                  >
                    Live Sync
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-[#8B8275] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={managerSearch}
                    onChange={(e) => setManagerSearch(e.target.value)}
                    placeholder="Search apps by name or slug..."
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] pl-8 pr-3 py-2 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/35"
                  />
                </div>
                <CustomSelect
                  value={managerCategoryFilter}
                  onChange={setManagerCategoryFilter}
                  options={categoryFilterOptions}
                  ariaLabel="Filter managed apps by category"
                  size="sm"
                  surface="canvas"
                />
              </div>
            </div>

            <div className="max-h-[680px] overflow-y-auto divide-y divide-[#3D3830]/8">
              {managerFilteredApps.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#8B8275]">
                  No apps match the current search or category filter.
                </div>
              ) : (
                managerFilteredApps.map((app) => {
                  const fullIndex = managerData.apps.findIndex((a) => a.slug === app.slug);
                  const isSelected = !isCreatingNew && selectedSlug === app.slug;

                  return (
                    <div
                      key={app.slug}
                      className={`flex items-center gap-2.5 px-3.5 py-3 transition-colors ${
                        isSelected ? 'bg-[#F1ECE3]' : 'hover:bg-[#FAF7F2]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => selectExistingApp(app.slug)}
                        className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
                      >
                        <div
                          className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 ${
                            app.isActive
                              ? 'bg-[#FAF7F2] border-[#3D3830]/15 text-[#3D3830]'
                              : 'bg-[#F1ECE3] border-[#3D3830]/10 text-[#8B8275] opacity-70'
                          }`}
                        >
                          {renderMiniAppIcon(app.iconKey, 'h-4 w-4')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p
                              className={`text-xs font-medium truncate ${
                                app.isActive ? 'text-[#3D3830]' : 'text-[#8B8275] line-through'
                              }`}
                            >
                              {app.title}
                            </p>
                            {!app.isBuiltIn && (
                              <span className="text-[10px] font-medium text-[#8B7355] shrink-0">
                                · Custom
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#8B8275] truncate">
                            {app.categoryLabel}
                            {app.popular ? ' · Popular' : ''}
                            {!app.isActive ? ' · Paused' : ''}
                          </p>
                        </div>
                      </button>

                      {canReorderApps && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={fullIndex === 0 || reorderingApps}
                            onClick={() => void handleMoveApp(fullIndex, -1)}
                            aria-label={`Move ${app.title} up`}
                            className="h-7 w-7 rounded-lg border border-[#3D3830]/12 bg-[#FAF7F2] flex items-center justify-center text-[#5C5449] hover:text-[#3D3830] hover:bg-[#EAE3D7] disabled:opacity-30 cursor-pointer disabled:cursor-default"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={fullIndex === managerData.apps.length - 1 || reorderingApps}
                            onClick={() => void handleMoveApp(fullIndex, 1)}
                            aria-label={`Move ${app.title} down`}
                            className="h-7 w-7 rounded-lg border border-[#3D3830]/12 bg-[#FAF7F2] flex items-center justify-center text-[#5C5449] hover:text-[#3D3830] hover:bg-[#EAE3D7] disabled:opacity-30 cursor-pointer disabled:cursor-default"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* RIGHT PANE: APP & PROMPT EDITOR */}
          <section className="lg:col-span-8 rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] overflow-hidden">
            {!editorDraft ? (
              <div className="p-10 text-center text-sm text-[#8B8275]">
                Select an app on the left or click <strong className="text-[#3D3830]">New App</strong> to configure details, icon, category, and prompts.
              </div>
            ) : (
              <div>
                {/* Editor Header */}
                <div className="p-5 sm:p-6 border-b border-[#3D3830]/10 flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="h-11 w-11 rounded-2xl bg-[#F1ECE3] border border-[#3D3830]/12 flex items-center justify-center text-[#3D3830] shrink-0">
                      {renderMiniAppIcon(editorDraft.iconKey, 'h-5 w-5')}
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-['Cormorant_Garamond',serif] text-2xl font-medium text-[#3D3830] truncate">
                        {isCreatingNew
                          ? editorDraft.title.trim() || 'Create New Mini-App'
                          : editorDraft.title}
                      </h2>
                      <p className="text-xs font-mono text-[#8B8275] truncate">
                        {isCreatingNew
                          ? `Slug: ${editorDraft.slug || slugifyAppTitle(editorDraft.title) || 'auto-generated'}`
                          : `${selectedApp?.slug} · ${selectedApp?.isBuiltIn ? 'Built-in App' : 'Custom App'}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!isCreatingNew && selectedApp && selectedApp.cacheScope !== 'none' && (
                      <button
                        type="button"
                        disabled={clearingSlug === selectedApp.slug}
                        onClick={() => void handleClearCache(selectedApp.slug)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Database className="h-3.5 w-3.5" />
                        <span>
                          {clearingSlug === selectedApp.slug ? 'Clearing...' : 'Flush Cache'}
                        </span>
                      </button>
                    )}

                    {!isCreatingNew && selectedApp && (
                      confirmDeleteApp ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={deletingApp}
                            onClick={() => void handleDeleteApp()}
                            className="inline-flex items-center gap-1 rounded-full bg-[#7A3E36] px-3.5 py-1.5 text-xs font-medium text-[#FAF7F2] hover:opacity-90 cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{deletingApp ? 'Deleting...' : 'Confirm Delete'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteApp(false)}
                            className="rounded-full border border-[#3D3830]/15 px-3 py-1.5 text-xs text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteApp(true)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#7A3E36]/25 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#7A3E36] hover:bg-[#7A3E36]/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Inner Editor Switcher */}
                <div className="px-5 sm:px-6 pt-4 border-b border-[#3D3830]/10 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setEditorTab('general')}
                    className={`pb-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                      editorTab === 'general'
                        ? 'border-[#3D3830] text-[#3D3830]'
                        : 'border-transparent text-[#8B8275] hover:text-[#3D3830]'
                    }`}
                  >
                    General, Category &amp; Icon
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab('prompts')}
                    className={`pb-3 text-xs font-medium border-b-2 transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                      editorTab === 'prompts'
                        ? 'border-[#3D3830] text-[#3D3830]'
                        : 'border-transparent text-[#8B8275] hover:text-[#3D3830]'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Prompts Behind App</span>
                  </button>
                </div>

                {/* EDITOR BODY */}
                <div className="p-5 sm:p-6 space-y-6">
                  {editorTab === 'general' ? (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-[#5C5449]">
                            App Name (Displayed on Cards)
                          </label>
                          <input
                            type="text"
                            value={editorDraft.title}
                            onChange={(e) => {
                              const nextTitle = e.target.value;
                              setEditorDraft((prev) => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  title: nextTitle,
                                  slug:
                                    isCreatingNew && !slugTouched
                                      ? slugifyAppTitle(nextTitle)
                                      : prev.slug,
                                };
                              });
                            }}
                            placeholder="e.g. Daily Horoscope"
                            className="w-full min-h-[42px] rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 text-sm text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-[#5C5449]">
                            Short Title
                          </label>
                          <input
                            type="text"
                            value={editorDraft.shortTitle}
                            onChange={(e) =>
                              setEditorDraft({ ...editorDraft, shortTitle: e.target.value })
                            }
                            placeholder="Compact label"
                            className="w-full min-h-[42px] rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 text-sm text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                          />
                        </div>
                      </div>

                      {isCreatingNew && (
                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-[#5C5449]">
                            URL Slug (Unique identifier)
                          </label>
                          <input
                            type="text"
                            value={editorDraft.slug}
                            onChange={(e) => {
                              setSlugTouched(true);
                              setEditorDraft({
                                ...editorDraft,
                                slug: slugifyAppTitle(e.target.value),
                              });
                            }}
                            placeholder="e.g. annual-solar-return"
                            className="w-full min-h-[42px] rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 text-sm font-mono text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-[#5C5449]">
                            Category
                          </label>
                          <CustomSelect
                            value={editorDraft.category}
                            onChange={(val) => setEditorDraft({ ...editorDraft, category: val })}
                            options={categorySelectOptions}
                            ariaLabel="Select app category"
                            surface="canvas"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-[#5C5449]">
                            App Template
                          </label>
                          <CustomSelect
                            value={editorDraft.template}
                            onChange={(val) =>
                              setEditorDraft({
                                ...editorDraft,
                                template: val as MiniAppTemplate,
                              })
                            }
                            options={
                              isCreatingNew ||
                              (selectedApp &&
                                selectedApp.template !== 'domain_explorer' &&
                                selectedApp.template !== 'guided_quiz')
                                ? CUSTOM_APP_TEMPLATE_OPTIONS
                                : TEMPLATE_OPTIONS
                            }
                            ariaLabel="Select app template"
                            surface="canvas"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-[#5C5449]">
                            Cache Behavior
                          </label>
                          <CustomSelect
                            value={editorDraft.cacheScope}
                            onChange={(val) =>
                              setEditorDraft({
                                ...editorDraft,
                                cacheScope: val as AppEditorDraft['cacheScope'],
                              })
                            }
                            options={CACHE_SCOPE_OPTIONS}
                            ariaLabel="Select cache behavior"
                            surface="canvas"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-[#5C5449]">
                            Read Estimate
                          </label>
                          <input
                            type="text"
                            value={editorDraft.estimatedRead}
                            onChange={(e) =>
                              setEditorDraft({ ...editorDraft, estimatedRead: e.target.value })
                            }
                            placeholder="2 min read"
                            className="w-full min-h-[42px] rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 text-sm text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-[#5C5449]">
                          OpenRouter Model Override
                        </label>
                        <CustomSelect
                          value={editorDraft.modelId}
                          onChange={(val) => setEditorDraft({ ...editorDraft, modelId: val })}
                          options={appModelOptions}
                          ariaLabel="Model override for this app"
                          surface="canvas"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-[#5C5449]">
                          Tagline (Shown inside the App view)
                        </label>
                        <input
                          type="text"
                          value={editorDraft.tagline}
                          onChange={(e) =>
                            setEditorDraft({ ...editorDraft, tagline: e.target.value })
                          }
                          placeholder="Concise one-line subtitle..."
                          className="w-full min-h-[42px] rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 text-sm text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-[#5C5449]">
                          Description (Shown inside the App header &amp; details)
                        </label>
                        <textarea
                          rows={3}
                          value={editorDraft.description}
                          onChange={(e) =>
                            setEditorDraft({ ...editorDraft, description: e.target.value })
                          }
                          placeholder="Explain what this app explores and how it helps the user..."
                          className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                        />
                      </div>

                      {editorDraft.template === 'form_reading' &&
                        (isCreatingNew || !BUILTIN_INTERACTIVE_SLUGS.has(editorDraft.slug)) && (
                          <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="block text-xs font-medium text-[#5C5449]">
                                Form Input Prompt Label
                              </label>
                              <input
                                type="text"
                                value={editorDraft.inputLabel}
                                onChange={(e) =>
                                  setEditorDraft({ ...editorDraft, inputLabel: e.target.value })
                                }
                                placeholder="What question would you like to explore?"
                                className="w-full min-h-[40px] rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 text-xs text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-xs font-medium text-[#5C5449]">
                                Form Input Placeholder
                              </label>
                              <input
                                type="text"
                                value={editorDraft.inputPlaceholder}
                                onChange={(e) =>
                                  setEditorDraft({
                                    ...editorDraft,
                                    inputPlaceholder: e.target.value,
                                  })
                                }
                                placeholder="Describe the decision, date, or dream..."
                                className="w-full min-h-[40px] rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 text-xs text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                              />
                            </div>
                          </div>
                        )}

                      {/* Icon Picker Grid */}
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-[#5C5449]">
                          App Icon
                        </label>
                        <div className="grid grid-cols-6 sm:grid-cols-11 gap-2">
                          {MINI_APP_ICON_OPTIONS.map((opt) => {
                            const active = editorDraft.iconKey === opt.key;
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                title={opt.label}
                                onClick={() => setEditorDraft({ ...editorDraft, iconKey: opt.key })}
                                className={`h-10 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-[#4A453D] border-[#4A453D] text-[#FAF7F2]'
                                    : 'bg-[#FAF7F2] border-[#3D3830]/15 text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3]'
                                }`}
                              >
                                {renderMiniAppIcon(opt.key, 'h-4 w-4')}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Visibility & Feature Switches */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#3D3830]/10">
                        {(
                          [
                            {
                              key: 'isActive',
                              label: 'Active in User Catalog',
                              sub: 'Hide or show across Apps Hub & Dashboard',
                            },
                            {
                              key: 'popular',
                              label: 'Show in Most Popular Tab',
                              sub: 'Featured when members filter by Most Popular',
                            },
                            {
                              key: 'featuredOnHome',
                              label: 'Pin to Dashboard Spotlight',
                              sub: 'Included in Overview highlights',
                            },
                            {
                              key: 'requiresProfile',
                              label: 'Requires Birth Chart Profile',
                              sub: 'Prompts profile selection before running',
                            },
                          ] as const
                        ).map((toggle) => {
                          const checked = editorDraft[toggle.key];
                          return (
                            <div
                              key={toggle.key}
                              className="flex items-center justify-between gap-3 rounded-2xl border border-[#3D3830]/10 bg-[#FAF7F2] px-4 py-3"
                            >
                              <div>
                                <p className="text-xs font-medium text-[#3D3830]">{toggle.label}</p>
                                <p className="text-[11px] text-[#8B8275]">{toggle.sub}</p>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={checked}
                                onClick={() =>
                                  setEditorDraft({
                                    ...editorDraft,
                                    [toggle.key]: !checked,
                                  })
                                }
                                className={`relative inline-flex h-5 w-10 items-center rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                                  checked ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                                }`}
                              >
                                <span
                                  className={`h-4 w-4 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                                    checked ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* PROMPTS BEHIND APP TAB */
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-[#3D3830]/10 bg-[#FAF7F2] p-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-medium text-[#3D3830]">
                            Dynamic Prompt Placeholders
                          </p>
                          <span className="text-[11px] text-[#8B8275]">
                            Click a token to insert into active field ({activePromptField})
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {PROMPT_PLACEHOLDERS.map((ph) => (
                            <button
                              key={ph.token}
                              type="button"
                              title={ph.hint}
                              onClick={() => handleInsertPlaceholder(ph.token)}
                              className="rounded-lg border border-[#3D3830]/15 bg-[#FDFBF7] px-2.5 py-1 text-[11px] font-mono text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                            >
                              {ph.token}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Vedic Prompt */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-medium text-[#5C5449]">
                            Vedic Mode Prompt Template (Sidereal Lahiri)
                          </label>
                          {!isCreatingNew &&
                            selectedApp?.hasDefaultPrompt &&
                            editorDraft.vedicPrompt !== selectedApp.defaultVedicPrompt && (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditorDraft({
                                    ...editorDraft,
                                    vedicPrompt: selectedApp.defaultVedicPrompt,
                                  })
                                }
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8B7355] hover:text-[#3D3830] cursor-pointer"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Reset to Built-in Default</span>
                              </button>
                            )}
                        </div>
                        <textarea
                          rows={7}
                          value={editorDraft.vedicPrompt}
                          onFocus={() => setActivePromptField('vedicPrompt')}
                          onChange={(e) =>
                            setEditorDraft({ ...editorDraft, vedicPrompt: e.target.value })
                          }
                          placeholder="Instructions sent when running in Vedic mode..."
                          className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-3 text-xs font-mono leading-relaxed text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                        />
                      </div>

                      {/* Western Prompt */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-medium text-[#5C5449]">
                            Western Mode Prompt Template (Tropical Placidus)
                          </label>
                          {!isCreatingNew &&
                            selectedApp?.hasDefaultPrompt &&
                            editorDraft.westernPrompt !== selectedApp.defaultWesternPrompt && (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditorDraft({
                                    ...editorDraft,
                                    westernPrompt: selectedApp.defaultWesternPrompt,
                                  })
                                }
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8B7355] hover:text-[#3D3830] cursor-pointer"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Reset to Built-in Default</span>
                              </button>
                            )}
                        </div>
                        <textarea
                          rows={6}
                          value={editorDraft.westernPrompt}
                          onFocus={() => setActivePromptField('westernPrompt')}
                          onChange={(e) =>
                            setEditorDraft({ ...editorDraft, westernPrompt: e.target.value })
                          }
                          placeholder="Instructions sent when running in Western mode (optional fallback adapts Vedic prompt)..."
                          className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-3 text-xs font-mono leading-relaxed text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                        />
                      </div>

                      {/* Follow-up Chat Seed Prompt */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-[#5C5449]">
                          Follow-Up Chat Seed Prompt
                        </label>
                        <textarea
                          rows={2}
                          value={editorDraft.chatSeedPrompt}
                          onFocus={() => setActivePromptField('chatSeedPrompt')}
                          onChange={(e) =>
                            setEditorDraft({ ...editorDraft, chatSeedPrompt: e.target.value })
                          }
                          placeholder="Suggested prompt when user clicks 'Discuss in Chat'..."
                          className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                        />
                      </div>

                      {/* Optional System Prompt Override */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-[#5C5449]">
                          Additional System Guardrail / Persona Override (Optional)
                        </label>
                        <textarea
                          rows={3}
                          value={editorDraft.systemOverride}
                          onFocus={() => setActivePromptField('systemOverride')}
                          onChange={(e) =>
                            setEditorDraft({ ...editorDraft, systemOverride: e.target.value })
                          }
                          placeholder="Optional extra tone, word count, or formatting instructions prepended to this app's system prompt..."
                          className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs font-mono text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                        />
                      </div>
                    </div>
                  )}

                  {/* EDITOR SAVE BAR */}
                  <div className="pt-4 border-t border-[#3D3830]/10 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] text-[#8B8275]">
                      {isCreatingNew
                        ? 'New apps appear immediately inside user categories and dashboard.'
                        : 'Updates propagate live to both user Apps Hub and Dashboard.'}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      {isCreatingNew ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingNew(false);
                              if (managerData.apps[0]) {
                                setSelectedSlug(managerData.apps[0].slug);
                                setEditorDraft(toEditorDraft(managerData.apps[0]));
                              }
                            }}
                            className="rounded-full border border-[#3D3830]/15 px-4 py-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={savingApp}
                            onClick={() => void handleSaveApp(false)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            <Save className="h-3.5 w-3.5" />
                            <span>{savingApp ? 'Creating...' : 'Create & Publish App'}</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={savingApp}
                            onClick={() => void handleSaveApp(true)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-4 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            <Database className="h-3.5 w-3.5" />
                            <span>Save &amp; Flush Cache</span>
                          </button>
                          <button
                            type="button"
                            disabled={savingApp}
                            onClick={() => void handleSaveApp(false)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            <Save className="h-3.5 w-3.5" />
                            <span>{savingApp ? 'Saving...' : 'Save Changes'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* SUB-TAB 2: CATEGORIES & ORDERING MANAGER */}
      {subTab === 'categories' && managerData && (
        <div className="space-y-6">
          <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6">
            <h2 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
              Add Category
            </h2>
            <p className="text-xs text-[#8B8275] mt-0.5">
              Create categories for the Apps filter strip. <strong className="text-[#3D3830]">All</strong>,{' '}
              <strong className="text-[#3D3830]">Most Popular</strong>, and conditional{' '}
              <strong className="text-[#3D3830]">Favourites</strong> remain pinned automatically before your categories.
            </p>

            <form
              onSubmit={(e) => void handleCreateCategory(e)}
              className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
            >
              <div className="sm:col-span-5 space-y-1.5">
                <label className="block text-xs font-medium text-[#5C5449]">
                  Category Name
                </label>
                <input
                  type="text"
                  value={newCatLabel}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  placeholder="e.g. Remedies & Rituals"
                  className="w-full min-h-[42px] rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 text-sm text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                />
              </div>

              <div className="sm:col-span-4 space-y-1.5">
                <label className="block text-xs font-medium text-[#5C5449]">
                  Slug (Optional)
                </label>
                <input
                  type="text"
                  value={newCatSlug}
                  onChange={(e) => setNewCatSlug(e.target.value)}
                  placeholder="auto_from_name"
                  className="w-full min-h-[42px] rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 text-sm font-mono text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                />
              </div>

              <div className="sm:col-span-3 flex items-center justify-between sm:justify-end gap-3">
                <label className="inline-flex items-center gap-2 text-xs text-[#5C5449] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCatActive}
                    onChange={(e) => setNewCatActive(e.target.checked)}
                    className="rounded border-[#3D3830]/25 accent-[#4A453D]"
                  />
                  <span>Active</span>
                </label>

                <button
                  type="submit"
                  disabled={creatingCategory}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{creatingCategory ? 'Adding...' : 'Add Category'}</span>
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-[#3D3830]/10">
              <h2 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                Category Order &amp; Visibility
              </h2>
              <p className="text-xs text-[#8B8275] mt-0.5">
                Reorder categories with ↑ ↓, rename inline, toggle visibility, or remove unused categories.
              </p>
            </div>

            <div className="divide-y divide-[#3D3830]/10">
              {managerData.categories.map((cat, idx) => {
                const assignedCount = appCountByCategory.get(cat.slug) || 0;
                const draftLabel = catLabelDrafts[cat.slug] ?? cat.label;
                const labelDirty = draftLabel.trim() && draftLabel.trim() !== cat.label;
                const busy = busyCatSlug === cat.slug;

                return (
                  <div
                    key={cat.slug}
                    className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-[#FAF7F2]/70 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-[240px] flex-1">
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0 || reorderingCats}
                          onClick={() => void handleMoveCategory(idx, -1)}
                          aria-label={`Move ${cat.label} up`}
                          className="h-8 w-8 rounded-lg border border-[#3D3830]/15 bg-[#FAF7F2] flex items-center justify-center text-[#5C5449] hover:text-[#3D3830] hover:bg-[#EAE3D7] disabled:opacity-30 cursor-pointer disabled:cursor-default"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === managerData.categories.length - 1 || reorderingCats}
                          onClick={() => void handleMoveCategory(idx, 1)}
                          aria-label={`Move ${cat.label} down`}
                          className="h-8 w-8 rounded-lg border border-[#3D3830]/15 bg-[#FAF7F2] flex items-center justify-center text-[#5C5449] hover:text-[#3D3830] hover:bg-[#EAE3D7] disabled:opacity-30 cursor-pointer disabled:cursor-default"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="flex-1 min-w-[180px] max-w-xs flex items-center gap-2">
                        <input
                          type="text"
                          value={draftLabel}
                          onChange={(e) =>
                            setCatLabelDrafts((prev) => ({
                              ...prev,
                              [cat.slug]: e.target.value,
                            }))
                          }
                          className="w-full min-h-[38px] rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 text-sm text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                        />
                        {labelDirty && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void handleUpdateCategory(cat.slug, { label: draftLabel.trim() })
                            }
                            className="rounded-xl bg-[#4A453D] px-3 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] shrink-0 cursor-pointer disabled:opacity-50"
                          >
                            Save
                          </button>
                        )}
                      </div>

                      <div className="hidden sm:block text-xs text-[#8B8275] font-mono">
                        {cat.slug}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-xs font-mono tabular-nums text-[#5C5449]">
                        {assignedCount} {assignedCount === 1 ? 'app' : 'apps'}
                      </span>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={cat.isActive}
                        aria-label={`Toggle ${cat.label} active`}
                        disabled={busy}
                        onClick={() =>
                          void handleUpdateCategory(cat.slug, { isActive: !cat.isActive })
                        }
                        className={`relative inline-flex h-5 w-10 items-center rounded-full p-0.5 transition-colors cursor-pointer disabled:opacity-50 ${
                          cat.isActive ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                        }`}
                      >
                        <span
                          className={`h-4 w-4 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                            cat.isActive ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        disabled={busy || assignedCount > 0}
                        title={
                          assignedCount > 0
                            ? 'Reassign all apps out of this category before deleting'
                            : `Delete ${cat.label}`
                        }
                        onClick={() => void handleDeleteCategory(cat.slug, cat.label)}
                        className="inline-flex items-center gap-1 rounded-full border border-[#7A3E36]/20 bg-[#FAF7F2] px-3 py-1.5 text-[11px] font-medium text-[#7A3E36] hover:bg-[#7A3E36]/10 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* SUB-TAB 3: USAGE & TOKEN ECONOMICS */}
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
                    options={categoryFilterOptions}
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

      {/* SUB-TAB 4: GOVERNANCE, MODEL ROUTING & COST CONTROLS */}
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
                Per-App Quick Controls &amp; Model Overrides
              </h2>
              <p className="text-xs text-[#8B8275] mt-0.5">
                Enable or pause Mini-Apps, pin favorites to Home Hub, assign OpenRouter models, or flush caches in bulk.
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
