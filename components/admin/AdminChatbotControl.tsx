import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Columns2,
  Cpu,
  Database,
  Eye,
  EyeOff,
  FileCode2,
  GripVertical,
  Info,
  Layers,
  Maximize2,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sliders,
  Sparkles,
  Star,
  Terminal,
  Trash2,
  Wrench,
} from 'lucide-react';
import CustomSelect from '../app/CustomSelect';
import ChatWorkspace from '../app/ChatWorkspace';
import type { ModelChoiceOption, PromptRecipeRecord } from './PromptLibraryManager';

interface ChatbotFeaturesConfig {
  voice_input: boolean;
  listen_tts: boolean;
  whatsapp_share: boolean;
  attachments: boolean;
  quick_tools: boolean;
  followups: boolean;
  auto_intake: boolean;
  memory_summary: boolean;
}

interface ChatbotConfigState {
  welcome_title: string;
  welcome_subtitle: string;
  general_ready_message: string;
  composer_placeholder: string;
  default_expert: string;
  default_mode: string;
  default_output: string;
  default_language: string;
  default_tone: 'friendly' | 'technical';
  default_response_length: 'short' | 'detailed';
  expert_order: string[];
  mode_order: string[];
  language_order: string[];
  features: ChatbotFeaturesConfig;
  conversational_rules: string;
}

interface SuggestionsConfigState {
  followups_enabled: boolean;
  deeper_analysis_enabled: boolean;
  default_expanded: boolean;
  max_followups: number;
  max_deeper_analysis: number;
  followups_rules: string;
  deeper_analysis_rules: string;
}

interface GuideSuggestionsState extends SuggestionsConfigState {
  enabled: boolean;
}

interface ModularRuleBlock {
  id: string;
  title: string;
  body: string;
  enabled: boolean;
  source_slug?: string | null;
  updated_at?: string;
}

interface GuideCatalogMetaItem {
  slug: string;
  displayName: string;
  subtitle: string;
  pillar: 'council' | 'companion' | 'clarity';
  hasSystemPromptRow: boolean;
  defaultSuggestionsEnabled: boolean;
  defaultWelcomeTitle: string;
  defaultWelcomeSubtitle: string;
  defaultGeneralReadyMessage: string;
  defaultComposerPlaceholder: string;
}

interface ResolvedGuideConfigState {
  slug: string;
  meta: GuideCatalogMetaItem;
  isCustomized: boolean;
  welcome_title: string;
  welcome_subtitle: string;
  general_ready_message: string;
  composer_placeholder: string;
  features: ChatbotFeaturesConfig;
  modular_rules: ModularRuleBlock[];
  has_custom_modular_rules: boolean;
  combined_rules_text: string;
  suggestions: GuideSuggestionsState;
  model_id: string | null;
}

interface GuideSystemPromptState {
  id: string | null;
  slug: string;
  display_name: string;
  subtitle: string | null;
  prompt_body: string;
  default_prompt_body: string;
  model_id: string | null;
  is_active: boolean;
  version: number;
  updated_at: string | null;
}

interface CompanionArchetypeState {
  slug: string;
  label: string;
  shortDesc: string;
  questionOne: string;
  questionTwo: string;
  isSpiritual?: boolean;
}

interface EnginePromptBundle {
  core_council_constitution: string;
  companion_constitution: string;
  companion_archetypes: CompanionArchetypeState[];
  companion_matcher_instructions: string;
  clarity_helper_system_prompt: string;
  sutra_tier1_reasoning_laws: string;
  sutra_anti_cliche_rules: string;
  intent_output_contracts: Record<string, string>;
  fluency_instructions: Record<string, string>;
  format_contracts: Record<string, string>;
  stage1_router_prompt: string;
  deep_audit_lenses: Record<string, string>;
  deep_audit_adjudicator_mandate: string;
  stage4_aligned_suggestions_prompt: string;
  stage4_fast_more_suggestions_prompt: string;
}

interface EnginePromptOverridesState {
  core_council_constitution?: string;
  companion_constitution?: string;
  companion_archetypes?: CompanionArchetypeState[];
  companion_matcher_instructions?: string;
  clarity_helper_system_prompt?: string;
  sutra_tier1_reasoning_laws?: string;
  sutra_anti_cliche_rules?: string;
  intent_output_contracts?: Record<string, string>;
  fluency_instructions?: Record<string, string>;
  format_contracts?: Record<string, string>;
  stage1_router_prompt?: string;
  deep_audit_lenses?: Record<string, string>;
  deep_audit_adjudicator_mandate?: string;
  stage4_aligned_suggestions_prompt?: string;
  stage4_fast_more_suggestions_prompt?: string;
}

interface PlaybookCatalogItem {
  id: string;
  domain: string;
  title: string;
  shortLabel: string;
  defaultIntent: string;
  requiredHouses: number[];
  requiredVargas: string[];
  requiresTimingStack: boolean;
  requiresSynastry: boolean;
  formulaSlugs: string[];
}

interface PlaybookOverrideItem {
  requiresTimingStack?: boolean;
  formulaSlugs?: string[];
  customInstructions?: string;
  updated_at?: string;
}

interface LibraryPromptOption {
  id: string;
  slug: string;
  category: string;
  display_name: string;
  subtitle?: string | null;
  prompt_body: string;
}

interface ChatbotPromptSummary {
  id: string;
  slug: string;
  category: string;
  display_name: string;
  subtitle?: string | null;
  is_active: boolean;
  model_id?: string | null;
  sort_order?: number | null;
}

interface RuntimeManifestResponse {
  guide: string;
  guideMeta: GuideCatalogMetaItem;
  resolvedModels: {
    consultationModel: string;
    utilityModel: string;
    jevModel: string;
    guideModelOverride: string | null;
    effectiveModel: string;
  };
  runtimeFiles: Array<{
    step: string;
    filePath: string;
    modelResolved: string;
    notes: string;
  }>;
  promptStack: Array<{
    order: number;
    layer: string;
    source: 'Database' | 'Code Default';
    dbLocation: string;
    status: 'Active' | 'Disabled';
    chars: number;
    approxTokens: number;
    preview: string;
    fullText: string;
  }>;
  overrideWarnings: Array<{
    severity: 'warn' | 'info';
    message: string;
  }>;
  databaseTables: Array<{
    table: string;
    purpose: string;
    count: number;
    details: string;
  }>;
}

type GuideSubTab =
  | 'system_prompt'
  | 'features'
  | 'welcome'
  | 'rules'
  | 'suggestions'
  | 'engine'
  | 'stack';

const SUGGESTION_COUNT_OPTIONS = ['1', '2', '3', '4', '5', '6'].map((v) => ({
  value: v,
  label: `${v} items`,
}));

interface AdminChatbotControlProps {
  getAccessToken: () => Promise<string | null>;
  modelOptions?: ModelChoiceOption[];
  onPromptsChanged?: () => void;
}

const GUIDE_FEATURE_TOGGLES: Array<{
  key: keyof ChatbotFeaturesConfig;
  label: string;
  description: string;
}> = [
  {
    key: 'voice_input',
    label: 'Voice dictation in composer',
    description: 'Allows members to speak questions using the microphone button.',
  },
  {
    key: 'listen_tts',
    label: 'One-tap Listen (read aloud)',
    description: 'Shows the browser speech playback icon on AI replies.',
  },
  {
    key: 'whatsapp_share',
    label: 'Share on WhatsApp',
    description: 'Shows the monochrome WhatsApp share icon on AI replies.',
  },
  {
    key: 'attachments',
    label: 'Image & PDF chart attachments',
    description: 'Allows members to upload or paste chart screenshots and PDFs.',
  },
  {
    key: 'quick_tools',
    label: 'Prompt helper tools',
    description: 'Shows Question Generator, Expander, and Optimizer in the composer drawer.',
  },
  {
    key: 'auto_intake',
    label: 'Natural chat birth-detail capture',
    description: 'Detects birth details typed in chat and offers one-tap chart creation.',
  },
  {
    key: 'memory_summary',
    label: 'Longitudinal profile memory',
    description: 'Updates and carries forward a concise memory summary per birth profile.',
  },
];

function mergeOrderedSlugs(items: ChatbotPromptSummary[], savedOrder: string[]): ChatbotPromptSummary[] {
  const indexMap = new Map<string, number>();
  savedOrder.forEach((slug, idx) => indexMap.set(slug, idx));
  return [...items].sort((a, b) => {
    const idxA = indexMap.has(a.slug) ? indexMap.get(a.slug)! : 1000 + (a.sort_order ?? 100);
    const idxB = indexMap.has(b.slug) ? indexMap.get(b.slug)! : 1000 + (b.sort_order ?? 100);
    if (idxA !== idxB) return idxA - idxB;
    return a.display_name.localeCompare(b.display_name);
  });
}

function approxTokens(text: string): number {
  const len = (text || '').trim().length;
  return len === 0 ? 0 : Math.ceil(len / 4);
}

const SUB_TABS: Array<{
  key: GuideSubTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'system_prompt', label: 'System Prompt', icon: Terminal },
  { key: 'features', label: 'Features', icon: Sliders },
  { key: 'welcome', label: 'Welcome', icon: Sparkles },
  { key: 'rules', label: 'Rules', icon: Layers },
  { key: 'suggestions', label: 'Suggestions', icon: Star },
  { key: 'engine', label: 'Engine & Formulas', icon: Wrench },
  { key: 'stack', label: 'Active Files & Stack', icon: Cpu },
];

const ENGINE_SCALAR_FIELDS: Array<{
  key:
    | 'core_council_constitution'
    | 'sutra_tier1_reasoning_laws'
    | 'sutra_anti_cliche_rules'
    | 'stage1_router_prompt'
    | 'deep_audit_adjudicator_mandate'
    | 'stage4_aligned_suggestions_prompt'
    | 'stage4_fast_more_suggestions_prompt'
    | 'companion_constitution'
    | 'companion_matcher_instructions'
    | 'clarity_helper_system_prompt';
  title: string;
  subtitle: string;
  rows: number;
}> = [
  {
    key: 'core_council_constitution',
    title: 'Core Council Constitution',
    subtitle: 'Ephemeris grounding, calm strategic counsel, and strict anti-extraction security directives.',
    rows: 6,
  },
  {
    key: 'sutra_tier1_reasoning_laws',
    title: 'Tier-1 Adjudication Laws',
    subtitle: '8-Tier Judgment Scale, Independent Evidence rule, D1-vs-D9 boundary, and 5-Tier Truth Gate hierarchy.',
    rows: 9,
  },
  {
    key: 'sutra_anti_cliche_rules',
    title: 'Voice & Anti-Cliché Guardrails',
    subtitle: 'Banned AI phrases, direct "you" address, and calm "sitting across the table" cadence.',
    rows: 6,
  },
  {
    key: 'stage1_router_prompt',
    title: 'Stage 1 Intent & Playbook Router Prompt',
    subtitle: 'Classifies every Vedic Astrologer question into a Canonical Playbook ID, Intent archetype, and user fluency.',
    rows: 10,
  },
  {
    key: 'deep_audit_adjudicator_mandate',
    title: 'Deep Audit Adjudicator Mandate',
    subtitle: 'Synthesizes the 4 parallel lenses cleanly without mentioning "4 lenses" or internal machinery.',
    rows: 6,
  },
  {
    key: 'stage4_aligned_suggestions_prompt',
    title: 'Stage 4 Aligned Suggestions Prompt',
    subtitle: 'Generates chart-aligned Follow-Ups and Deeper Analysis cards seeded from playbook next-hops & chart contradictions.',
    rows: 7,
  },
  {
    key: 'stage4_fast_more_suggestions_prompt',
    title: 'Stage 4 "Load More" Fast Suggestions Prompt',
    subtitle: 'Prompt template used when users click "Load more" under Suggestions.',
    rows: 5,
  },
  {
    key: 'companion_constitution',
    title: 'Companion Safety & Presence Constitution',
    subtitle: 'Controls human texting rhythm, non-yes-man honesty, and strict platonic/non-clinical boundaries.',
    rows: 7,
  },
  {
    key: 'companion_matcher_instructions',
    title: 'Companion 4-Persona Matcher Instructions',
    subtitle: 'Governs 2 Female + 2 Male realistic companion generation during intake matching.',
    rows: 6,
  },
  {
    key: 'clarity_helper_system_prompt',
    title: 'Clarity Helper System Prompt',
    subtitle: 'Core instructions for the off-record Clarity sidekick pillar.',
    rows: 7,
  },
];

const AdminChatbotControl: React.FC<AdminChatbotControlProps> = ({
  getAccessToken,
  modelOptions = [],
  onPromptsChanged,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [togglingPromptId, setTogglingPromptId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Global chatbot & catalog state
  const [config, setConfig] = useState<ChatbotConfigState | null>(null);
  const [suggestionsConfig, setSuggestionsConfig] = useState<SuggestionsConfigState | null>(null);
  const [prompts, setPrompts] = useState<ChatbotPromptSummary[]>([]);
  const [libraryPrompts, setLibraryPrompts] = useState<LibraryPromptOption[]>([]);
  const [recipes, setRecipes] = useState<PromptRecipeRecord[]>([]);
  const [pipelineLoggingEnabled, setPipelineLoggingEnabled] = useState(false);
  const [togglingPipelineLogging, setTogglingPipelineLogging] = useState(false);
  const [showGlobalCatalogDrawer, setShowGlobalCatalogDrawer] = useState(false);

  // Per-guide state
  const [guidesMeta, setGuidesMeta] = useState<GuideCatalogMetaItem[]>([]);
  const [perGuideConfigs, setPerGuideConfigs] = useState<Record<string, ResolvedGuideConfigState>>({});
  const [guideSystemPrompts, setGuideSystemPrompts] = useState<Record<string, GuideSystemPromptState>>({});
  const [selectedGuide, setSelectedGuide] = useState<string>('council_synthesis');
  const [sectionTab, setSectionTab] = useState<GuideSubTab>('system_prompt');

  // Rules stack UI state
  const [expandedRuleIds, setExpandedRuleIds] = useState<Record<string, boolean>>({});
  const [draggedRuleIdx, setDraggedRuleIdx] = useState<number | null>(null);
  const [dragOverRuleIdx, setDragOverRuleIdx] = useState<number | null>(null);

  // Engine & Playbook state
  const [engineDefaults, setEngineDefaults] = useState<EnginePromptBundle | null>(null);
  const [engineOverrides, setEngineOverrides] = useState<EnginePromptOverridesState>({});
  const [expandedEngineSection, setExpandedEngineSection] = useState<Record<string, boolean>>({
    core_council_constitution: true,
  });
  const [savingEngine, setSavingEngine] = useState(false);

  const [canonicalPlaybooks, setCanonicalPlaybooks] = useState<PlaybookCatalogItem[]>([]);
  const [playbookOverrides, setPlaybookOverrides] = useState<Record<string, PlaybookOverrideItem>>({});
  const [playbookSearch, setPlaybookSearch] = useState('');
  const [playbookDomainFilter, setPlaybookDomainFilter] = useState('all');
  const [expandedPlaybookId, setExpandedPlaybookId] = useState<string | null>(null);
  const [savingPlaybookId, setSavingPlaybookId] = useState<string | null>(null);

  // Runtime manifest tab state
  const [manifest, setManifest] = useState<RuntimeManifestResponse | null>(null);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [expandedStackOrders, setExpandedStackOrders] = useState<Record<number, boolean>>({});

  // Live preview workbench state
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewKey, setPreviewKey] = useState(1);

  const loadChatbotSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/settings/chatbot', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load chatbot settings');
      setConfig(data.config);
      setPipelineLoggingEnabled(Boolean(data.pipelineLoggingEnabled));
      if (data.suggestionsConfig) {
        setSuggestionsConfig(data.suggestionsConfig as SuggestionsConfigState);
      }
      setPrompts(data.prompts || []);
      setLibraryPrompts(data.libraryPrompts || []);
      setRecipes(data.recipes || []);
      setGuidesMeta(data.guidesMeta || []);
      setPerGuideConfigs(data.perGuideConfigs || {});
      setGuideSystemPrompts(data.guideSystemPrompts || {});
      if (data.enginePrompts) {
        setEngineDefaults(data.enginePrompts.defaults || null);
        setEngineOverrides(data.enginePrompts.overrides || {});
      }
      setCanonicalPlaybooks(data.canonicalPlaybooks || []);
      setPlaybookOverrides(data.playbookOverrides || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load chatbot settings');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadChatbotSettings();
  }, [loadChatbotSettings]);

  const loadRuntimeManifest = useCallback(
    async (guideSlug: string) => {
      setManifestLoading(true);
      try {
        const token = await getAccessToken();
        const res = await fetch(
          `/api/admin/chatbot-settings/runtime-manifest?guide=${encodeURIComponent(guideSlug)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load runtime manifest');
        setManifest(data as RuntimeManifestResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load runtime manifest');
      } finally {
        setManifestLoading(false);
      }
    },
    [getAccessToken]
  );

  useEffect(() => {
    if (sectionTab === 'stack' && !loading) {
      void loadRuntimeManifest(selectedGuide);
    }
  }, [sectionTab, selectedGuide, loading, loadRuntimeManifest]);

  const activeGuide = perGuideConfigs[selectedGuide] || null;
  const activeGuideMeta = useMemo(
    () =>
      guidesMeta.find((g) => g.slug === selectedGuide) ||
      activeGuide?.meta ||
      guidesMeta[0] ||
      null,
    [guidesMeta, selectedGuide, activeGuide]
  );
  const activeSystemPrompt = guideSystemPrompts[selectedGuide] || null;

  const guideSelectorOptions = useMemo(() => {
    return guidesMeta.map((g) => {
      const resolved = perGuideConfigs[g.slug];
      const sp = guideSystemPrompts[g.slug];
      const hasPromptCustom =
        g.hasSystemPromptRow &&
        sp &&
        (sp.prompt_body.trim() !== sp.default_prompt_body.trim() || Boolean(sp.model_id));
      const hasClarityCustom =
        g.slug === 'clarity' && Boolean(engineOverrides.clarity_helper_system_prompt?.trim());
      const hasCompanionCustom =
        g.slug === 'companion' &&
        Boolean(
          engineOverrides.companion_constitution?.trim() ||
            engineOverrides.companion_matcher_instructions?.trim() ||
            (engineOverrides.companion_archetypes && engineOverrides.companion_archetypes.length > 0)
        );
      const customTag =
        resolved?.isCustomized || hasPromptCustom || hasClarityCustom || hasCompanionCustom
          ? ' · Customized'
          : '';
      return {
        value: g.slug,
        label: `${g.displayName}${customTag}`,
        description: `${g.pillar.toUpperCase()} · ${g.subtitle}`,
      };
    });
  }, [guidesMeta, perGuideConfigs, guideSystemPrompts, engineOverrides]);

  const guideModelDropdownOptions = useMemo(() => {
    return [
      { value: '__inherit__', label: 'Inherit Global Consultation Model' },
      ...modelOptions.map((m) => ({
        value: m.value,
        label: m.label,
        description: m.description,
      })),
    ];
  }, [modelOptions]);

  const expertsList = useMemo(
    () =>
      mergeOrderedSlugs(
        prompts.filter(
          (p) =>
            p.category === 'expert' ||
            p.category === 'learn' ||
            p.slug === 'learn_astrology'
        ),
        config?.expert_order || []
      ),
    [prompts, config?.expert_order]
  );

  const modesList = useMemo(
    () =>
      mergeOrderedSlugs(
        prompts.filter((p) => p.category === 'mode' && p.slug !== 'learn_astrology'),
        config?.mode_order || []
      ),
    [prompts, config?.mode_order]
  );

  const languagesList = useMemo(
    () =>
      mergeOrderedSlugs(
        prompts.filter((p) => p.category === 'language'),
        config?.language_order || []
      ),
    [prompts, config?.language_order]
  );

  const outputsList = useMemo(
    () => prompts.filter((p) => p.category === 'output'),
    [prompts]
  );

  const recipeByModeSlug = useMemo(() => {
    const map = new Map<string, PromptRecipeRecord>();
    for (const r of recipes) {
      if (r.is_active && r.target_type === 'mode' && r.target_slug) {
        map.set(r.target_slug, r);
      }
    }
    return map;
  }, [recipes]);

  const updateActiveGuide = (updater: (prev: ResolvedGuideConfigState) => ResolvedGuideConfigState) => {
    setPerGuideConfigs((prev) => {
      const current = prev[selectedGuide];
      if (!current) return prev;
      return {
        ...prev,
        [selectedGuide]: updater(current),
      };
    });
  };

  const moveSlugInOrder = (
    listKey: 'expert_order' | 'mode_order' | 'language_order',
    orderedItems: ChatbotPromptSummary[],
    idx: number,
    delta: -1 | 1
  ) => {
    if (!config) return;
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= orderedItems.length) return;
    const slugs = orderedItems.map((i) => i.slug);
    const copy = [...slugs];
    const [moved] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, moved);
    setConfig({ ...config, [listKey]: copy });
  };

  const handleTogglePipelineLogging = async () => {
    setTogglingPipelineLogging(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const nextEnabled = !pipelineLoggingEnabled;
      const res = await fetch('/api/admin/chatbot-logs/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update pipeline logging setting');
      const confirmed = Boolean(data.enabled);
      setPipelineLoggingEnabled(confirmed);
      setFeedback(`Chatbot pipeline diagnostics logging is now ${confirmed ? 'ON' : 'OFF'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle pipeline logging');
    } finally {
      setTogglingPipelineLogging(false);
    }
  };

  const handleTogglePromptActive = async (item: ChatbotPromptSummary) => {
    setTogglingPromptId(item.id);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/prompts/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !item.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update prompt visibility');

      setPrompts((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, is_active: !item.is_active } : p))
      );
      setFeedback(`${item.display_name} is now ${!item.is_active ? 'visible' : 'hidden'} in Chat.`);
      setPreviewKey((k) => k + 1);
      onPromptsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle visibility');
    } finally {
      setTogglingPromptId(null);
    }
  };

  const handleSaveAll = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const requests: Array<Promise<Response>> = [];

      // 1. Save currently selected guide overrides + system prompt / pillar overrides
      if (activeGuide) {
        const sp = guideSystemPrompts[selectedGuide];
        const guidePayload: Record<string, unknown> = {
          welcome_title: activeGuide.welcome_title,
          welcome_subtitle: activeGuide.welcome_subtitle,
          general_ready_message: activeGuide.general_ready_message,
          composer_placeholder: activeGuide.composer_placeholder,
          features: activeGuide.features,
          modular_rules: activeGuide.modular_rules,
          suggestions: activeGuide.suggestions,
          model_id: activeGuide.model_id || null,
        };
        if (activeGuideMeta?.hasSystemPromptRow && sp) {
          guidePayload.display_name = sp.display_name;
          guidePayload.subtitle = sp.subtitle;
          guidePayload.prompt_body = sp.prompt_body;
          guidePayload.model_id = sp.model_id || null;
          guidePayload.is_active = sp.is_active;
        }
        requests.push(
          fetch(`/api/admin/settings/chatbot/guide/${encodeURIComponent(selectedGuide)}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(guidePayload),
          })
        );
      }

      // 2. Save Global Chatbot catalog/order defaults
      const globalPayload: ChatbotConfigState = {
        ...config,
        expert_order: expertsList.map((i) => i.slug),
        mode_order: modesList.map((i) => i.slug),
        language_order: languagesList.map((i) => i.slug),
      };
      requests.push(
        fetch('/api/admin/settings/chatbot', {
          method: 'PUT',
          headers,
          body: JSON.stringify(globalPayload),
        })
      );

      // 3. Save Global Suggestions defaults (if present)
      if (suggestionsConfig) {
        requests.push(
          fetch('/api/admin/settings/suggestions', {
            method: 'PUT',
            headers,
            body: JSON.stringify(suggestionsConfig),
          })
        );
      }

      // 4. Save Engine Prompt Overrides
      requests.push(
        fetch('/api/admin/settings/chatbot/engine-prompts', {
          method: 'PUT',
          headers,
          body: JSON.stringify(engineOverrides),
        })
      );

      const responses = await Promise.all(requests);
      for (const r of responses) {
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed while saving settings.');
        }
      }

      await loadChatbotSettings();
      if (sectionTab === 'stack') {
        void loadRuntimeManifest(selectedGuide);
      }
      setFeedback(
        `Saved ${activeGuideMeta?.displayName || selectedGuide}, global defaults, and engine prompt overrides.`
      );
      setPreviewKey((k) => k + 1);
      onPromptsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save chatbot configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleResetGuideScope = async (
    scope: 'welcome' | 'features' | 'rules' | 'suggestions' | 'system_prompt' | 'all'
  ) => {
    setResetting(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `/api/admin/settings/chatbot/guide/${encodeURIComponent(selectedGuide)}/reset`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ scope }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset guide scope');

      await loadChatbotSettings();
      if (sectionTab === 'stack') {
        void loadRuntimeManifest(selectedGuide);
      }
      setFeedback(
        `Reset ${scope === 'all' ? 'all settings' : scope.replace('_', ' ')} for ${
          activeGuideMeta?.displayName || selectedGuide
        } back to defaults.`
      );
      setPreviewKey((k) => k + 1);
      onPromptsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset guide settings');
    } finally {
      setResetting(false);
    }
  };

  // Modular Rules helpers
  const moveModularRule = (fromIdx: number, toIdx: number) => {
    if (!activeGuide || toIdx < 0 || toIdx >= activeGuide.modular_rules.length) return;
    updateActiveGuide((prev) => {
      const copy = [...prev.modular_rules];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return { ...prev, modular_rules: copy, has_custom_modular_rules: true };
    });
  };

  const handleAddCustomRule = () => {
    const newId = `custom_rule_${Date.now()}`;
    updateActiveGuide((prev) => ({
      ...prev,
      has_custom_modular_rules: true,
      modular_rules: [
        ...prev.modular_rules,
        {
          id: newId,
          title: `Custom Rule #${prev.modular_rules.length + 1}`,
          body: '',
          enabled: true,
          source_slug: null,
        },
      ],
    }));
    setExpandedRuleIds((prev) => ({ ...prev, [newId]: true }));
  };

  const handleImportFromLibrary = (promptId: string) => {
    const match = libraryPrompts.find((p) => p.id === promptId);
    if (!match || !activeGuide) return;
    const newId = `lib_${match.slug}_${Date.now()}`;
    updateActiveGuide((prev) => ({
      ...prev,
      has_custom_modular_rules: true,
      modular_rules: [
        ...prev.modular_rules,
        {
          id: newId,
          title: `${match.display_name} (${match.category})`,
          body: match.prompt_body,
          enabled: true,
          source_slug: match.slug,
        },
      ],
    }));
    setExpandedRuleIds((prev) => ({ ...prev, [newId]: true }));
    setFeedback(`Imported "${match.display_name}" into ${activeGuideMeta?.displayName || selectedGuide}'s modular rules stack. Click Save to apply.`);
  };

  // Engine prompts save / reset helpers
  const handleSaveEnginePromptsOnly = async () => {
    setSavingEngine(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/settings/chatbot/engine-prompts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(engineOverrides),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save engine prompts');
      setEngineOverrides(data.overrides || {});
      setFeedback('Engine prompt overrides saved.');
      if (sectionTab === 'stack') {
        void loadRuntimeManifest(selectedGuide);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save engine prompts');
    } finally {
      setSavingEngine(false);
    }
  };

  const handleResetEngineKey = async (key: string, subKey?: string) => {
    setSavingEngine(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/settings/chatbot/engine-prompts/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key, subKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset engine prompt');
      setEngineOverrides(data.overrides || {});
      setFeedback(`Reset ${subKey ? `${key}.${subKey}` : key} back to Code Default.`);
      if (sectionTab === 'stack') {
        void loadRuntimeManifest(selectedGuide);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset engine prompt');
    } finally {
      setSavingEngine(false);
    }
  };

  // Playbook helpers
  const playbookDomains = useMemo(() => {
    const set = new Set<string>(canonicalPlaybooks.map((p) => p.domain));
    return [
      { value: 'all', label: `All Domains (${canonicalPlaybooks.length})` },
      ...Array.from(set)
        .sort()
        .map((d) => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) })),
    ];
  }, [canonicalPlaybooks]);

  const filteredPlaybooks = useMemo(() => {
    const q = playbookSearch.trim().toLowerCase();
    return canonicalPlaybooks.filter((pb) => {
      if (playbookDomainFilter !== 'all' && pb.domain !== playbookDomainFilter) return false;
      if (!q) return true;
      return (
        pb.id.toLowerCase().includes(q) ||
        pb.title.toLowerCase().includes(q) ||
        pb.shortLabel.toLowerCase().includes(q) ||
        pb.formulaSlugs.some((f) => f.toLowerCase().includes(q))
      );
    });
  }, [canonicalPlaybooks, playbookSearch, playbookDomainFilter]);

  const handleSavePlaybookOverride = async (pbId: string) => {
    const entry = playbookOverrides[pbId];
    if (!entry) return;
    setSavingPlaybookId(pbId);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/settings/chatbot/playbooks/${encodeURIComponent(pbId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(entry),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save playbook override');
      setPlaybookOverrides(data.overrides || {});
      setFeedback(`Playbook ${pbId} override saved.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save playbook override');
    } finally {
      setSavingPlaybookId(null);
    }
  };

  const handleResetPlaybookOverride = async (pbId: string) => {
    setSavingPlaybookId(pbId);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/settings/chatbot/playbooks/${encodeURIComponent(pbId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset playbook override');
      setPlaybookOverrides(data.overrides || {});
      setFeedback(`Playbook ${pbId} restored to code default.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset playbook override');
    } finally {
      setSavingPlaybookId(null);
    }
  };

  const libraryImportOptions = useMemo(
    () =>
      libraryPrompts.map((p) => ({
        value: p.id,
        label: `${p.display_name} (${p.category})`,
        description: p.subtitle || p.slug,
      })),
    [libraryPrompts]
  );

  if (loading || !config) {
    return (
      <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-8 text-center text-sm text-[#8B8275]">
        Loading chatbot configuration...
      </div>
    );
  }

  const enabledRulesCount = activeGuide
    ? activeGuide.modular_rules.filter((r) => r.enabled && r.body.trim()).length
    : 0;
  const enabledRulesCombinedText = activeGuide
    ? activeGuide.modular_rules
        .filter((r) => r.enabled && r.body.trim())
        .map((r) => r.body.trim())
        .join('\n\n')
    : '';
  const isCurrentGuideCustomized = Boolean(
    activeGuide?.isCustomized ||
      (activeGuideMeta?.hasSystemPromptRow &&
        activeSystemPrompt &&
        (activeSystemPrompt.prompt_body.trim() !== activeSystemPrompt.default_prompt_body.trim() ||
          Boolean(activeSystemPrompt.model_id))) ||
      (selectedGuide === 'clarity' && Boolean(engineOverrides.clarity_helper_system_prompt?.trim())) ||
      (selectedGuide === 'companion' &&
        Boolean(
          engineOverrides.companion_constitution?.trim() ||
            engineOverrides.companion_matcher_instructions?.trim() ||
            (engineOverrides.companion_archetypes && engineOverrides.companion_archetypes.length > 0)
        ))
  );

  return (
    <div className="space-y-5">
      {/* Top Action Header & Per-Guide Selector Bar */}
      <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] px-5 py-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-['Cormorant_Garamond',serif] text-2xl font-medium text-[#3D3830]">
              Chatbot Experience &amp; Controls
            </h2>
            <p className="text-xs text-[#8B8275] mt-0.5">
              Select any personality or guide below to configure its system prompt, features, welcome copy, modular rules, suggestions, and engine contracts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowLivePreview((prev) => {
                  const next = !prev;
                  if (!next) setPreviewExpanded(false);
                  return next;
                });
              }}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showLivePreview
                  ? 'border-[#3D3830]/30 bg-[#3D3830] text-[#FAF7F2]'
                  : 'border-[#3D3830]/18 bg-[#FAF7F2] text-[#3D3830] hover:bg-[#F1ECE3]'
              }`}
            >
              {showLivePreview ? <EyeOff className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
              <span>{showLivePreview ? 'Hide Live Chatbot' : 'Test Live Chatbot'}</span>
            </button>

            {showLivePreview && (
              <>
                <button
                  type="button"
                  onClick={() => setPreviewExpanded((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {previewExpanded ? (
                    <>
                      <Columns2 className="h-3.5 w-3.5" />
                      <span>Split View</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span>Full Preview</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewKey((k) => k + 1)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Reload Chat</span>
                </button>
              </>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveAll()}
              className="inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>

        {/* Guide Selector Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#3D3830]/10">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
            <span className="text-xs font-medium text-[#5C5449] shrink-0">
              Active Guide / Personality:
            </span>
            <div className="w-full sm:w-80">
              <CustomSelect
                value={selectedGuide}
                onChange={(val) => setSelectedGuide(val)}
                ariaLabel="Select chatbot guide or personality"
                surface="canvas"
                size="sm"
                className="w-full"
                options={guideSelectorOptions}
              />
            </div>
            <span
              className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-medium shrink-0 ${
                isCurrentGuideCustomized
                  ? 'border-[#B8965A]/40 bg-[#B8965A]/12 text-[#3D3830]'
                  : 'border-[#3D3830]/12 bg-[#F1ECE3] text-[#8B8275]'
              }`}
            >
              {isCurrentGuideCustomized ? 'Customized' : 'Code / Global Default'}
            </span>
          </div>

          {isCurrentGuideCustomized && (
            <button
              type="button"
              disabled={resetting}
              onClick={() => void handleResetGuideScope('all')}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#7A3E36]/25 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#7A3E36] hover:bg-[#7A3E36]/8 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset All for {activeGuideMeta?.displayName || selectedGuide}</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-4 py-3 text-xs text-[#7A3E36]">
          {error}
        </div>
      )}

      {feedback && (
        <div className="flex items-center gap-2 rounded-2xl border border-[#2D6A4F]/25 bg-[#2D6A4F]/8 px-4 py-3 text-xs text-[#2D6A4F]">
          <Check className="h-3.5 w-3.5 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Main Content Area: Full Controls, Split Controls + Live Chat, or Full Live Chat */}
      <div
        className={
          showLivePreview && !previewExpanded
            ? 'grid grid-cols-1 xl:grid-cols-12 gap-6 items-start'
            : 'space-y-5'
        }
      >
        {(!showLivePreview || !previewExpanded) && (
          <div className={showLivePreview ? 'xl:col-span-6 space-y-5' : 'space-y-5'}>
            {/* 7 Clean Segmented Sub-Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#F1ECE3] p-1.5 w-fit">
              {SUB_TABS.map((t) => {
                const Icon = t.icon;
                const active = sectionTab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setSectionTab(t.key)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                        : 'text-[#5C5449] hover:text-[#3D3830]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* SUB-TAB 1: SYSTEM PROMPT (+ Model Override + Global Catalog Ordering) */}
            {sectionTab === 'system_prompt' && (
              <div className="space-y-5">
                {activeGuideMeta?.hasSystemPromptRow && activeSystemPrompt ? (
                  <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                            {activeGuideMeta.displayName} — System Prompt
                          </h3>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                              activeSystemPrompt.prompt_body.trim() !==
                              activeSystemPrompt.default_prompt_body.trim()
                                ? 'bg-[#B8965A]/15 text-[#3D3830]'
                                : 'bg-[#F1ECE3] text-[#8B8275]'
                            }`}
                          >
                            {activeSystemPrompt.prompt_body.trim() !==
                            activeSystemPrompt.default_prompt_body.trim()
                              ? 'Customized'
                              : 'Code Default'}
                          </span>
                        </div>
                        <p className="text-xs text-[#8B8275] mt-0.5">
                          Stored in <span className="font-mono">system_prompts[slug=&quot;{selectedGuide}&quot;]</span> · v
                          <span className="font-mono tabular-nums">{activeSystemPrompt.version}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setGuideSystemPrompts((prev) => ({
                              ...prev,
                              [selectedGuide]: {
                                ...activeSystemPrompt,
                                is_active: !activeSystemPrompt.is_active,
                              },
                            }))
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                            activeSystemPrompt.is_active
                              ? 'border-[#2D6A4F]/30 bg-[#2D6A4F]/10 text-[#2D6A4F]'
                              : 'border-[#3D3830]/15 bg-[#F1ECE3] text-[#8B8275]'
                          }`}
                        >
                          {activeSystemPrompt.is_active ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5" />
                          )}
                          <span>{activeSystemPrompt.is_active ? 'Active in Chat' : 'Hidden'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={resetting}
                          onClick={() => void handleResetGuideScope('system_prompt')}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Reset to Code Default</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-[#5C5449]">Display Name</span>
                        <input
                          type="text"
                          value={activeSystemPrompt.display_name}
                          onChange={(e) =>
                            setGuideSystemPrompts((prev) => ({
                              ...prev,
                              [selectedGuide]: {
                                ...activeSystemPrompt,
                                display_name: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                        />
                      </label>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-[#5C5449]">Subtitle</span>
                        <input
                          type="text"
                          value={activeSystemPrompt.subtitle || ''}
                          onChange={(e) =>
                            setGuideSystemPrompts((prev) => ({
                              ...prev,
                              [selectedGuide]: {
                                ...activeSystemPrompt,
                                subtitle: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                        />
                      </label>

                      <div className="space-y-1.5">
                        <span className="text-xs font-medium text-[#5C5449]">
                          OpenRouter Model Override
                        </span>
                        <CustomSelect
                          value={activeSystemPrompt.model_id || '__inherit__'}
                          onChange={(val) => {
                            const resolvedVal = val === '__inherit__' ? null : val;
                            setGuideSystemPrompts((prev) => ({
                              ...prev,
                              [selectedGuide]: {
                                ...activeSystemPrompt,
                                model_id: resolvedVal,
                              },
                            }));
                            updateActiveGuide((g) => ({ ...g, model_id: resolvedVal }));
                          }}
                          ariaLabel="Guide OpenRouter model override"
                          surface="canvas"
                          className="w-full"
                          options={guideModelDropdownOptions}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[#5C5449]">
                          Core System Instructions
                        </span>
                        <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                          {activeSystemPrompt.prompt_body.length} chars · ~
                          {approxTokens(activeSystemPrompt.prompt_body)} tokens
                        </span>
                      </div>
                      <textarea
                        rows={11}
                        value={activeSystemPrompt.prompt_body}
                        onChange={(e) =>
                          setGuideSystemPrompts((prev) => ({
                            ...prev,
                            [selectedGuide]: {
                              ...activeSystemPrompt,
                              prompt_body: e.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-4 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                      />
                    </div>
                  </section>
                ) : selectedGuide === 'clarity' && engineDefaults ? (
                  <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                            Clarity — Off-Record Helper Prompt
                          </h3>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                              engineOverrides.clarity_helper_system_prompt?.trim()
                                ? 'bg-[#B8965A]/15 text-[#3D3830]'
                                : 'bg-[#F1ECE3] text-[#8B8275]'
                            }`}
                          >
                            {engineOverrides.clarity_helper_system_prompt?.trim()
                              ? 'Customized'
                              : 'Code Default'}
                          </span>
                        </div>
                        <p className="text-xs text-[#8B8275] mt-0.5">
                          Controls Clarity&apos;s off-record helper persona in <span className="font-mono">server/services/companionEngine.ts</span>.
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={resetting}
                        onClick={() => void handleResetGuideScope('system_prompt')}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Reset to Code Default</span>
                      </button>
                    </div>

                    {activeGuide && (
                      <div className="max-w-sm space-y-1.5">
                        <span className="text-xs font-medium text-[#5C5449]">
                          OpenRouter Model Override
                        </span>
                        <CustomSelect
                          value={activeGuide.model_id || '__inherit__'}
                          onChange={(val) =>
                            updateActiveGuide((g) => ({
                              ...g,
                              model_id: val === '__inherit__' ? null : val,
                            }))
                          }
                          ariaLabel="Clarity OpenRouter model override"
                          surface="canvas"
                          className="w-full"
                          options={guideModelDropdownOptions}
                        />
                      </div>
                    )}

                    {(() => {
                      const val =
                        engineOverrides.clarity_helper_system_prompt ??
                        engineDefaults.clarity_helper_system_prompt;
                      return (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-[#5C5449]">
                              CLARITY_HELPER_SYSTEM_PROMPT
                            </span>
                            <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                              {val.length} chars · ~{approxTokens(val)} tokens
                            </span>
                          </div>
                          <textarea
                            rows={10}
                            value={val}
                            onChange={(e) =>
                              setEngineOverrides((prev) => ({
                                ...prev,
                                clarity_helper_system_prompt: e.target.value,
                              }))
                            }
                            className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-4 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                          />
                        </div>
                      );
                    })()}
                  </section>
                ) : selectedGuide === 'companion' && engineDefaults ? (
                  <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                            Companion — Constitution, Matcher &amp; Archetypes
                          </h3>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                              engineOverrides.companion_constitution?.trim() ||
                              engineOverrides.companion_matcher_instructions?.trim() ||
                              (engineOverrides.companion_archetypes &&
                                engineOverrides.companion_archetypes.length > 0)
                                ? 'bg-[#B8965A]/15 text-[#3D3830]'
                                : 'bg-[#F1ECE3] text-[#8B8275]'
                            }`}
                          >
                            {engineOverrides.companion_constitution?.trim() ||
                            engineOverrides.companion_matcher_instructions?.trim() ||
                            (engineOverrides.companion_archetypes &&
                              engineOverrides.companion_archetypes.length > 0)
                              ? 'Customized'
                              : 'Code Default'}
                          </span>
                        </div>
                        <p className="text-xs text-[#8B8275] mt-0.5">
                          Controls Companion safety/boundaries, 4-person matching rules, and the 6 Companion archetype setup cards.
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={resetting}
                        onClick={() => void handleResetGuideScope('system_prompt')}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Reset Companion Prompts</span>
                      </button>
                    </div>

                    {activeGuide && (
                      <div className="max-w-sm space-y-1.5">
                        <span className="text-xs font-medium text-[#5C5449]">
                          OpenRouter Model Override
                        </span>
                        <CustomSelect
                          value={activeGuide.model_id || '__inherit__'}
                          onChange={(val) =>
                            updateActiveGuide((g) => ({
                              ...g,
                              model_id: val === '__inherit__' ? null : val,
                            }))
                          }
                          ariaLabel="Companion OpenRouter model override"
                          surface="canvas"
                          className="w-full"
                          options={guideModelDropdownOptions}
                        />
                      </div>
                    )}

                    {(() => {
                      const constVal =
                        engineOverrides.companion_constitution ??
                        engineDefaults.companion_constitution;
                      const matcherVal =
                        engineOverrides.companion_matcher_instructions ??
                        engineDefaults.companion_matcher_instructions;
                      const archetypesList =
                        engineOverrides.companion_archetypes &&
                        engineOverrides.companion_archetypes.length > 0
                          ? engineOverrides.companion_archetypes
                          : engineDefaults.companion_archetypes;

                      return (
                        <>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-[#5C5449]">
                                COMPANION_CONSTITUTION
                              </span>
                              <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                                {constVal.length} chars · ~{approxTokens(constVal)} tokens
                              </span>
                            </div>
                            <textarea
                              rows={7}
                              value={constVal}
                              onChange={(e) =>
                                setEngineOverrides((prev) => ({
                                  ...prev,
                                  companion_constitution: e.target.value,
                                }))
                              }
                              className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-4 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-[#5C5449]">
                                COMPANION_MATCHER_INSTRUCTIONS
                              </span>
                              <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                                {matcherVal.length} chars · ~{approxTokens(matcherVal)} tokens
                              </span>
                            </div>
                            <textarea
                              rows={6}
                              value={matcherVal}
                              onChange={(e) =>
                                setEngineOverrides((prev) => ({
                                  ...prev,
                                  companion_matcher_instructions: e.target.value,
                                }))
                              }
                              className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-4 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                            />
                          </div>

                          <div className="space-y-3 pt-2 border-t border-[#3D3830]/10">
                            <p className="text-xs font-medium text-[#3D3830]">
                              Companion Archetype Cards &amp; Intake Questions (COMPANION_ARCHETYPES)
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {archetypesList.map((arch, aIdx) => (
                                <div
                                  key={arch.slug}
                                  className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-3.5 space-y-2.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-[11px] text-[#8B8275]">
                                      {arch.slug}
                                    </span>
                                  </div>
                                  <input
                                    type="text"
                                    value={arch.label}
                                    onChange={(e) => {
                                      const next = archetypesList.map((item, i) =>
                                        i === aIdx ? { ...item, label: e.target.value } : item
                                      );
                                      setEngineOverrides((prev) => ({
                                        ...prev,
                                        companion_archetypes: next,
                                      }));
                                    }}
                                    placeholder="Label"
                                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-xs font-medium text-[#3D3830] focus:outline-none"
                                  />
                                  <textarea
                                    rows={2}
                                    value={arch.shortDesc}
                                    onChange={(e) => {
                                      const next = archetypesList.map((item, i) =>
                                        i === aIdx ? { ...item, shortDesc: e.target.value } : item
                                      );
                                      setEngineOverrides((prev) => ({
                                        ...prev,
                                        companion_archetypes: next,
                                      }));
                                    }}
                                    placeholder="Card summary"
                                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-xs text-[#5C5449] focus:outline-none resize-none"
                                  />
                                  <input
                                    type="text"
                                    value={arch.questionOne}
                                    onChange={(e) => {
                                      const next = archetypesList.map((item, i) =>
                                        i === aIdx ? { ...item, questionOne: e.target.value } : item
                                      );
                                      setEngineOverrides((prev) => ({
                                        ...prev,
                                        companion_archetypes: next,
                                      }));
                                    }}
                                    placeholder="Question 1"
                                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-[11px] text-[#5C5449] focus:outline-none"
                                  />
                                  {!arch.isSpiritual && (
                                    <input
                                      type="text"
                                      value={arch.questionTwo}
                                      onChange={(e) => {
                                        const next = archetypesList.map((item, i) =>
                                          i === aIdx
                                            ? { ...item, questionTwo: e.target.value }
                                            : item
                                        );
                                        setEngineOverrides((prev) => ({
                                          ...prev,
                                          companion_archetypes: next,
                                        }));
                                      }}
                                      placeholder="Question 2"
                                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-[11px] text-[#5C5449] focus:outline-none"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </section>
                ) : null}

                {/* Global Defaults & Dropdown Ordering (Collapsible to keep focus clean) */}
                <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowGlobalCatalogDrawer((v) => !v)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                  >
                    <div>
                      <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                        Global Consultation Defaults &amp; Dropdown Ordering
                      </h3>
                      <p className="text-xs text-[#8B8275] mt-0.5">
                        Configure platform-wide default expert, focus mode, output style, language, tone, and visible dropdown order.
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-[#8B8275] shrink-0 transition-transform ${
                        showGlobalCatalogDrawer ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {showGlobalCatalogDrawer && (
                    <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-2 border-t border-[#3D3830]/10 space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <span className="text-xs font-medium text-[#5C5449]">
                            Default Council Guide
                          </span>
                          <CustomSelect
                            value={config.default_expert}
                            onChange={(val) => setConfig({ ...config, default_expert: val })}
                            ariaLabel="Default council guide"
                            surface="canvas"
                            className="w-full"
                            options={expertsList.map((p) => ({
                              value: p.slug,
                              label: p.display_name,
                            }))}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-xs font-medium text-[#5C5449]">
                            Default Mode / Focus
                          </span>
                          <CustomSelect
                            value={config.default_mode}
                            onChange={(val) => setConfig({ ...config, default_mode: val })}
                            ariaLabel="Default mode"
                            surface="canvas"
                            className="w-full"
                            options={modesList.map((p) => ({
                              value: p.slug,
                              label: p.display_name,
                            }))}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-xs font-medium text-[#5C5449]">
                            Default Output Style
                          </span>
                          <CustomSelect
                            value={config.default_output}
                            onChange={(val) => setConfig({ ...config, default_output: val })}
                            ariaLabel="Default output format"
                            surface="canvas"
                            className="w-full"
                            options={outputsList.map((p) => ({
                              value: p.slug,
                              label: p.display_name,
                            }))}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-xs font-medium text-[#5C5449]">
                            Default Language
                          </span>
                          <CustomSelect
                            value={config.default_language}
                            onChange={(val) => setConfig({ ...config, default_language: val })}
                            ariaLabel="Default language"
                            surface="canvas"
                            className="w-full"
                            options={languagesList.map((p) => ({
                              value: p.slug,
                              label: p.display_name,
                            }))}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-xs font-medium text-[#5C5449]">Default Tone</span>
                          <CustomSelect
                            value={config.default_tone}
                            onChange={(val) =>
                              setConfig({
                                ...config,
                                default_tone: val === 'friendly' ? 'friendly' : 'technical',
                              })
                            }
                            ariaLabel="Default tone"
                            surface="canvas"
                            className="w-full"
                            options={[
                              { value: 'technical', label: 'Technical (Jyotish depth)' },
                              { value: 'friendly', label: 'Friendly (Plain everyday language)' },
                            ]}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-xs font-medium text-[#5C5449]">Default Length</span>
                          <CustomSelect
                            value={config.default_response_length}
                            onChange={(val) =>
                              setConfig({
                                ...config,
                                default_response_length: val === 'short' ? 'short' : 'detailed',
                              })
                            }
                            ariaLabel="Default length"
                            surface="canvas"
                            className="w-full"
                            options={[
                              { value: 'detailed', label: 'Detailed explanation' },
                              { value: 'short', label: 'Short & direct' },
                            ]}
                          />
                        </div>
                      </div>

                      {/* Ordering Lists */}
                      {(
                        [
                          {
                            title: 'Council Order & Visibility',
                            key: 'expert_order' as const,
                            items: expertsList,
                          },
                          {
                            title: 'Modes & Life Focus Order',
                            key: 'mode_order' as const,
                            items: modesList,
                          },
                          {
                            title: 'Languages Order & Visibility',
                            key: 'language_order' as const,
                            items: languagesList,
                          },
                        ] as const
                      ).map((group) => (
                        <div key={group.key} className="space-y-2 pt-2 border-t border-[#3D3830]/10">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-[#3D3830]">{group.title}</p>
                            <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                              {group.items.filter((i) => i.is_active).length}/{group.items.length} active
                            </span>
                          </div>
                          <div className="divide-y divide-[#3D3830]/10 rounded-2xl border border-[#3D3830]/10 bg-[#FAF7F2] px-3.5">
                            {group.items.map((item, idx) => {
                              const boundRecipe =
                                group.key === 'mode_order' ? recipeByModeSlug.get(item.slug) : null;
                              return (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between gap-3 py-2"
                                >
                                  <div className="min-w-0 flex items-center gap-2.5">
                                    <span className="font-mono text-xs tabular-nums text-[#8B8275] w-5">
                                      {idx + 1}.
                                    </span>
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium text-[#3D3830] truncate">
                                        {item.display_name}
                                      </p>
                                      <p className="text-[11px] text-[#8B8275] truncate">
                                        {item.slug}
                                        {boundRecipe
                                          ? ` · Recipe: ${boundRecipe.name} (${boundRecipe.steps_json.filter((s) => s.enabled).length} steps)`
                                          : ''}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() =>
                                        moveSlugInOrder(group.key, group.items, idx, -1)
                                      }
                                      aria-label={`Move ${item.display_name} up`}
                                      className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#F1ECE3] disabled:opacity-30 cursor-pointer"
                                    >
                                      <ArrowUp className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === group.items.length - 1}
                                      onClick={() =>
                                        moveSlugInOrder(group.key, group.items, idx, 1)
                                      }
                                      aria-label={`Move ${item.display_name} down`}
                                      className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#F1ECE3] disabled:opacity-30 cursor-pointer"
                                    >
                                      <ArrowDown className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={togglingPromptId === item.id}
                                      onClick={() => void handleTogglePromptActive(item)}
                                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                                        item.is_active
                                          ? 'border-[#2D6A4F]/25 bg-[#2D6A4F]/8 text-[#2D6A4F]'
                                          : 'border-[#3D3830]/15 bg-[#F1ECE3] text-[#8B8275]'
                                      }`}
                                    >
                                      {item.is_active ? (
                                        <Eye className="h-3 w-3" />
                                      ) : (
                                        <EyeOff className="h-3 w-3" />
                                      )}
                                      <span>{item.is_active ? 'Visible' : 'Hidden'}</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* SUB-TAB 2: PER-GUIDE FEATURE CONTROLS + DIAGNOSTICS LOGGING */}
            {sectionTab === 'features' && activeGuide && (
              <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                      {activeGuideMeta?.displayName || selectedGuide} — Feature Controls
                    </h3>
                    <p className="text-xs text-[#8B8275] mt-0.5">
                      Toggle composer &amp; reply capabilities specifically for {activeGuideMeta?.displayName || selectedGuide}.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={resetting}
                    onClick={() => void handleResetGuideScope('features')}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset Features</span>
                  </button>
                </div>

                <div className="divide-y divide-[#3D3830]/10">
                  {GUIDE_FEATURE_TOGGLES.map((feat) => {
                    const enabled = Boolean(activeGuide.features[feat.key]);
                    return (
                      <div
                        key={feat.key}
                        className="flex items-center justify-between gap-4 py-3 first:pt-1"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#3D3830]">{feat.label}</p>
                          <p className="text-xs text-[#8B8275] mt-0.5">{feat.description}</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={enabled}
                          aria-label={feat.label}
                          onClick={() =>
                            updateActiveGuide((g) => ({
                              ...g,
                              isCustomized: true,
                              features: {
                                ...g.features,
                                [feat.key]: !enabled,
                              },
                            }))
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            enabled ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                          }`}
                        >
                          <span
                            className={`h-5 w-5 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                              enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}

                  {/* Master Suggestions Switch (synced cleanly with Suggestions tab) */}
                  <div className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#3D3830]">
                        Enable Suggestions (Followups &amp; Deeper analysis)
                      </p>
                      <p className="text-xs text-[#8B8275] mt-0.5">
                        Master switch for {activeGuideMeta?.displayName || selectedGuide}. When OFF, skips Stage 4 suggestion LLM calls completely and hides suggestion cards.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(activeGuide.suggestions.enabled)}
                      aria-label="Enable Suggestions for guide"
                      onClick={() =>
                        updateActiveGuide((g) => ({
                          ...g,
                          isCustomized: true,
                          suggestions: {
                            ...g.suggestions,
                            enabled: !g.suggestions.enabled,
                          },
                          features: {
                            ...g.features,
                            followups: !g.suggestions.enabled,
                          },
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                        activeGuide.suggestions.enabled ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                      }`}
                    >
                      <span
                        className={`h-5 w-5 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                          activeGuide.suggestions.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Global Pipeline Diagnostics Logging Switch */}
                  <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#3D3830]">
                        Chatbot pipeline diagnostics logging (Global)
                      </p>
                      <p className="text-xs text-[#8B8275] mt-0.5">
                        Records Stage 1–4 decisions, latency, and token telemetry in Chatbot Logs (updates immediately).
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      disabled={togglingPipelineLogging}
                      aria-checked={pipelineLoggingEnabled}
                      aria-label="Chatbot pipeline diagnostics logging"
                      onClick={() => void handleTogglePipelineLogging()}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer disabled:opacity-50 ${
                        pipelineLoggingEnabled ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                      }`}
                    >
                      <span
                        className={`h-5 w-5 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                          pipelineLoggingEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* SUB-TAB 3: PER-GUIDE WELCOME & PLACEHOLDER COPY */}
            {sectionTab === 'welcome' && activeGuide && (
              <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                      {activeGuideMeta?.displayName || selectedGuide} — Welcome &amp; Input Copy
                    </h3>
                    <p className="text-xs text-[#8B8275] mt-0.5">
                      Customize the greeting headline, subtitle, general-ready banner, and composer placeholder shown when {activeGuideMeta?.displayName || selectedGuide} is active.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={resetting}
                    onClick={() => void handleResetGuideScope('welcome')}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset Welcome Copy</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-[#5C5449]">New Chat Headline</span>
                    <input
                      type="text"
                      value={activeGuide.welcome_title}
                      onChange={(e) =>
                        updateActiveGuide((g) => ({
                          ...g,
                          isCustomized: true,
                          welcome_title: e.target.value,
                        }))
                      }
                      placeholder={activeGuideMeta?.defaultWelcomeTitle || "I'm ready"}
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-[#5C5449]">
                      Optional Subtitle
                    </span>
                    <input
                      type="text"
                      value={activeGuide.welcome_subtitle}
                      onChange={(e) =>
                        updateActiveGuide((g) => ({
                          ...g,
                          isCustomized: true,
                          welcome_subtitle: e.target.value,
                        }))
                      }
                      placeholder={
                        activeGuideMeta?.defaultWelcomeSubtitle || 'Optional calm helper line...'
                      }
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                    />
                  </label>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#5C5449]">
                    General Chart Ready Message
                  </span>
                  <textarea
                    rows={2}
                    value={activeGuide.general_ready_message}
                    onChange={(e) =>
                      updateActiveGuide((g) => ({
                        ...g,
                        isCustomized: true,
                        general_ready_message: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#5C5449]">
                    Composer Placeholder Text
                  </span>
                  <input
                    type="text"
                    value={activeGuide.composer_placeholder}
                    onChange={(e) =>
                      updateActiveGuide((g) => ({
                        ...g,
                        isCustomized: true,
                        composer_placeholder: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                  />
                </label>
              </section>
            )}

            {/* SUB-TAB 4: MODULAR DRAG-AND-DROP RULES STACK */}
            {sectionTab === 'rules' && activeGuide && (
              <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                        {activeGuideMeta?.displayName || selectedGuide} — Modular Rules Stack
                      </h3>
                      <span className="rounded-lg border border-[#3D3830]/12 bg-[#F1ECE3] px-2.5 py-0.5 font-mono text-[11px] tabular-nums text-[#5C5449]">
                        {enabledRulesCount} enabled · {enabledRulesCombinedText.length} chars · ~
                        {approxTokens(enabledRulesCombinedText)} tokens
                      </span>
                    </div>
                    <p className="text-xs text-[#8B8275] mt-0.5 max-w-2xl">
                      Drag cards to reorder priority. All enabled blocks combine automatically as <span className="font-mono">RULE #1, RULE #2...</span> at runtime for this guide.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={resetting}
                    onClick={() => void handleResetGuideScope('rules')}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset Guide Rules</span>
                  </button>
                </div>

                {/* Add / Import Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-[#3D3830]/10 bg-[#FAF7F2] p-3">
                  <button
                    type="button"
                    onClick={handleAddCustomRule}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors shrink-0 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Custom Rule</span>
                  </button>

                  {libraryImportOptions.length > 0 && (
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="text-xs text-[#8B8275] shrink-0">Import from Prompt Library:</span>
                      <div className="flex-1 min-w-0">
                        <CustomSelect
                          value=""
                          onChange={(promptId) => handleImportFromLibrary(promptId)}
                          placeholder="Choose a library prompt to append..."
                          ariaLabel="Import prompt from library into guide rules"
                          surface="elevated"
                          size="sm"
                          className="w-full"
                          options={libraryImportOptions}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Draggable Modular Rule Cards */}
                <div className="space-y-2.5">
                  {activeGuide.modular_rules.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#3D3830]/20 bg-[#FAF7F2] p-6 text-center text-xs text-[#8B8275]">
                      No modular rule blocks yet for this guide. Click &ldquo;Add Custom Rule&rdquo; or import one from Prompt Library.
                    </div>
                  ) : (
                    activeGuide.modular_rules.map((rule, idx) => {
                      const isExpanded = Boolean(expandedRuleIds[rule.id]);
                      const enabledOrder = activeGuide.modular_rules
                        .slice(0, idx + 1)
                        .filter((r) => r.enabled && r.body.trim()).length;

                      return (
                        <div
                          key={rule.id}
                          draggable
                          onDragStart={() => setDraggedRuleIdx(idx)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (dragOverRuleIdx !== idx) setDragOverRuleIdx(idx);
                          }}
                          onDragLeave={() => {
                            if (dragOverRuleIdx === idx) setDragOverRuleIdx(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedRuleIdx !== null && draggedRuleIdx !== idx) {
                              moveModularRule(draggedRuleIdx, idx);
                            }
                            setDraggedRuleIdx(null);
                            setDragOverRuleIdx(null);
                          }}
                          onDragEnd={() => {
                            setDraggedRuleIdx(null);
                            setDragOverRuleIdx(null);
                          }}
                          className={`rounded-2xl border transition-all ${
                            dragOverRuleIdx === idx
                              ? 'border-[#B8965A] bg-[#B8965A]/8'
                              : rule.enabled
                              ? 'border-[#3D3830]/15 bg-[#FAF7F2]'
                              : 'border-[#3D3830]/10 bg-[#F1ECE3]/60 opacity-75'
                          }`}
                        >
                          {/* Collapsible Header */}
                          <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
                            <span
                              title="Drag to reorder"
                              className="cursor-grab text-[#8B8275] hover:text-[#3D3830] shrink-0"
                            >
                              <GripVertical className="h-4 w-4" />
                            </span>

                            <span
                              className={`rounded-md px-2 py-0.5 font-mono text-[11px] tabular-nums shrink-0 ${
                                rule.enabled
                                  ? 'bg-[#3D3830] text-[#FAF7F2]'
                                  : 'bg-[#EAE3D7] text-[#8B8275]'
                              }`}
                            >
                              {rule.enabled ? `#${enabledOrder}` : 'Off'}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                setExpandedRuleIds((prev) => ({
                                  ...prev,
                                  [rule.id]: !prev[rule.id],
                                }))
                              }
                              className="p-1 text-[#5C5449] hover:text-[#3D3830] cursor-pointer shrink-0"
                              aria-label={isExpanded ? 'Collapse rule' : 'Expand rule'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>

                            <input
                              type="text"
                              value={rule.title}
                              onChange={(e) =>
                                updateActiveGuide((g) => ({
                                  ...g,
                                  has_custom_modular_rules: true,
                                  modular_rules: g.modular_rules.map((r) =>
                                    r.id === rule.id ? { ...r, title: e.target.value } : r
                                  ),
                                }))
                              }
                              className="flex-1 min-w-[140px] bg-transparent text-sm font-medium text-[#3D3830] focus:outline-none border-b border-transparent focus:border-[#3D3830]/30 py-0.5"
                            />

                            <span className="font-mono text-[11px] tabular-nums text-[#8B8275] shrink-0">
                              {rule.body.length} chars · ~{approxTokens(rule.body)} tokens
                            </span>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moveModularRule(idx, idx - 1)}
                                aria-label="Move rule up"
                                className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#F1ECE3] disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === activeGuide.modular_rules.length - 1}
                                onClick={() => moveModularRule(idx, idx + 1)}
                                aria-label="Move rule down"
                                className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#F1ECE3] disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>

                              <button
                                type="button"
                                role="switch"
                                aria-checked={rule.enabled}
                                aria-label={`Toggle ${rule.title}`}
                                onClick={() =>
                                  updateActiveGuide((g) => ({
                                    ...g,
                                    has_custom_modular_rules: true,
                                    modular_rules: g.modular_rules.map((r) =>
                                      r.id === rule.id ? { ...r, enabled: !r.enabled } : r
                                    ),
                                  }))
                                }
                                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer mx-1 ${
                                  rule.enabled ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                                }`}
                              >
                                <span
                                  className={`h-4 w-4 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                                    rule.enabled ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  updateActiveGuide((g) => ({
                                    ...g,
                                    has_custom_modular_rules: true,
                                    modular_rules: g.modular_rules.filter((r) => r.id !== rule.id),
                                  }))
                                }
                                aria-label={`Delete ${rule.title}`}
                                className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#8B8275] hover:text-[#7A3E36] hover:bg-[#7A3E36]/8 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Expandable Editor */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-1 border-t border-[#3D3830]/10 space-y-2">
                              {rule.source_slug && (
                                <p className="text-[11px] text-[#8B8275]">
                                  Imported from Prompt Library slug: <span className="font-mono">{rule.source_slug}</span>
                                </p>
                              )}
                              <textarea
                                rows={7}
                                value={rule.body}
                                onChange={(e) =>
                                  updateActiveGuide((g) => ({
                                    ...g,
                                    has_custom_modular_rules: true,
                                    modular_rules: g.modular_rules.map((r) =>
                                      r.id === rule.id ? { ...r, body: e.target.value } : r
                                    ),
                                  }))
                                }
                                placeholder="Write concise behavioral instructions injected for this rule block..."
                                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3.5 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            )}

            {/* SUB-TAB 5: PER-GUIDE SUGGESTIONS CONTROLS */}
            {sectionTab === 'suggestions' && activeGuide && (
              <div className="space-y-5">
                <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                        {activeGuideMeta?.displayName || selectedGuide} — Suggestions Controls
                      </h3>
                      <p className="text-xs text-[#8B8275] mt-0.5">
                        Enable or disable Followup &amp; Deeper analysis suggestions for this specific guide and customize generation rules.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={resetting}
                      onClick={() => void handleResetGuideScope('suggestions')}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reset Suggestions</span>
                    </button>
                  </div>

                  {/* Master Enable Suggestions Switch */}
                  <div
                    className={`flex items-center justify-between gap-4 rounded-2xl border p-4 ${
                      activeGuide.suggestions.enabled
                        ? 'border-[#2D6A4F]/25 bg-[#2D6A4F]/6'
                        : 'border-[#7A3E36]/20 bg-[#7A3E36]/6'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#3D3830]">
                        Enable Suggestions for {activeGuideMeta?.displayName || selectedGuide}
                      </p>
                      <p className="text-xs text-[#5C5449] mt-0.5">
                        {activeGuide.suggestions.enabled
                          ? 'Active — runs Stage 4 suggestion generation and shows Option A cards beneath replies.'
                          : 'Disabled — completely skips Stage 4 OpenRouter calls (zero suggestion token spend) and hides suggestion cards in Chat.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={activeGuide.suggestions.enabled}
                      aria-label="Enable suggestions master switch"
                      onClick={() =>
                        updateActiveGuide((g) => ({
                          ...g,
                          isCustomized: true,
                          suggestions: {
                            ...g.suggestions,
                            enabled: !g.suggestions.enabled,
                          },
                          features: {
                            ...g.features,
                            followups: !g.suggestions.enabled,
                          },
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                        activeGuide.suggestions.enabled ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                      }`}
                    >
                      <span
                        className={`h-5 w-5 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                          activeGuide.suggestions.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="divide-y divide-[#3D3830]/10">
                    {(
                      [
                        {
                          key: 'followups_enabled' as const,
                          label: 'Enable Followup column',
                          description:
                            'Generates natural, everyday next questions tailored to the user’s reading.',
                        },
                        {
                          key: 'deeper_analysis_enabled' as const,
                          label: 'Enable Deeper analysis column',
                          description:
                            'Generates Grandmaster multi-system analytical lenses with hidden technical directives.',
                        },
                        {
                          key: 'default_expanded' as const,
                          label: 'Expand suggestions by default',
                          description:
                            'Default expanded state for new replies (members can still toggle in Chat Settings).',
                        },
                      ] as const
                    ).map((toggle) => {
                      const enabled = Boolean(activeGuide.suggestions[toggle.key]);
                      return (
                        <div
                          key={toggle.key}
                          className="flex items-center justify-between gap-4 py-3 first:pt-1 last:pb-0"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#3D3830]">{toggle.label}</p>
                            <p className="text-xs text-[#8B8275] mt-0.5">{toggle.description}</p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            aria-label={toggle.label}
                            onClick={() =>
                              updateActiveGuide((g) => ({
                                ...g,
                                isCustomized: true,
                                suggestions: {
                                  ...g.suggestions,
                                  [toggle.key]: !enabled,
                                },
                              }))
                            }
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                              enabled ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                            }`}
                          >
                            <span
                              className={`h-5 w-5 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                                enabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#3D3830]/10">
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-[#5C5449]">
                        Max Followups per reply
                      </span>
                      <CustomSelect
                        value={String(activeGuide.suggestions.max_followups)}
                        onChange={(val) =>
                          updateActiveGuide((g) => ({
                            ...g,
                            isCustomized: true,
                            suggestions: {
                              ...g.suggestions,
                              max_followups: Number(val) || 4,
                            },
                          }))
                        }
                        ariaLabel="Maximum followups per reply"
                        surface="canvas"
                        className="w-full"
                        options={SUGGESTION_COUNT_OPTIONS}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-[#5C5449]">
                        Max Deeper analysis items per reply
                      </span>
                      <CustomSelect
                        value={String(activeGuide.suggestions.max_deeper_analysis)}
                        onChange={(val) =>
                          updateActiveGuide((g) => ({
                            ...g,
                            isCustomized: true,
                            suggestions: {
                              ...g.suggestions,
                              max_deeper_analysis: Number(val) || 4,
                            },
                          }))
                        }
                        ariaLabel="Maximum deeper analysis suggestions per reply"
                        surface="canvas"
                        className="w-full"
                        options={SUGGESTION_COUNT_OPTIONS}
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
                  <h4 className="font-['Cormorant_Garamond',serif] text-lg font-medium text-[#3D3830]">
                    Followups Generation Rules ({activeGuideMeta?.displayName || selectedGuide})
                  </h4>
                  <textarea
                    rows={7}
                    value={activeGuide.suggestions.followups_rules}
                    onChange={(e) =>
                      updateActiveGuide((g) => ({
                        ...g,
                        isCustomized: true,
                        suggestions: {
                          ...g.suggestions,
                          followups_rules: e.target.value,
                        },
                      }))
                    }
                    className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-4 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                  />
                  <div className="flex justify-end text-xs font-mono tabular-nums text-[#8B8275]">
                    {activeGuide.suggestions.followups_rules.length} / 4000 chars
                  </div>
                </section>

                <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
                  <h4 className="font-['Cormorant_Garamond',serif] text-lg font-medium text-[#3D3830]">
                    Deeper Analysis Grandmaster Rules ({activeGuideMeta?.displayName || selectedGuide})
                  </h4>
                  <textarea
                    rows={9}
                    value={activeGuide.suggestions.deeper_analysis_rules}
                    onChange={(e) =>
                      updateActiveGuide((g) => ({
                        ...g,
                        isCustomized: true,
                        suggestions: {
                          ...g.suggestions,
                          deeper_analysis_rules: e.target.value,
                        },
                      }))
                    }
                    className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-4 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                  />
                  <div className="flex justify-end text-xs font-mono tabular-nums text-[#8B8275]">
                    {activeGuide.suggestions.deeper_analysis_rules.length} / 5000 chars
                  </div>
                </section>
              </div>
            )}

            {/* SUB-TAB 6: ENGINE PROMPTS & CANONICAL PLAYBOOKS */}
            {sectionTab === 'engine' && engineDefaults && (
              <div className="space-y-6">
                <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                        Underlying Engine Prompts, Laws &amp; Contracts
                      </h3>
                      <p className="text-xs text-[#8B8275] mt-0.5 max-w-2xl">
                        Every hardcoded prompt across the Council, Sutradhara Stages 1–4, Deep Audit, Companion, and Clarity engines is editable here with instant code-default fallback.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={savingEngine}
                        onClick={() => void handleResetEngineKey('all')}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Reset All Engine Defaults</span>
                      </button>
                      <button
                        type="button"
                        disabled={savingEngine}
                        onClick={() => void handleSaveEnginePromptsOnly()}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-1.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>{savingEngine ? 'Saving...' : 'Save Engine Prompts'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Scalar Engine Prompt Accordions */}
                  <div className="space-y-2.5">
                    {ENGINE_SCALAR_FIELDS.map((field) => {
                      const overrideVal = engineOverrides[field.key];
                      const isCustomized = Boolean(
                        typeof overrideVal === 'string' &&
                          overrideVal.trim() &&
                          overrideVal.trim() !== engineDefaults[field.key].trim()
                      );
                      const currentVal = overrideVal ?? engineDefaults[field.key];
                      const isOpen = Boolean(expandedEngineSection[field.key]);

                      return (
                        <div
                          key={field.key}
                          className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] overflow-hidden"
                        >
                          <div
                            onClick={() =>
                              setExpandedEngineSection((prev) => ({
                                ...prev,
                                [field.key]: !prev[field.key],
                              }))
                            }
                            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 cursor-pointer hover:bg-[#F1ECE3]/55 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4 text-[#5C5449] shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-[#5C5449] shrink-0" />
                              )}
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-medium text-[#3D3830]">
                                    {field.title}
                                  </span>
                                  <span
                                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                                      isCustomized
                                        ? 'bg-[#B8965A]/20 text-[#3D3830]'
                                        : 'bg-[#EAE3D7] text-[#8B8275]'
                                    }`}
                                  >
                                    {isCustomized ? 'Customized' : 'Code Default'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#8B8275] truncate">
                                  {field.subtitle}
                                </p>
                              </div>
                            </div>

                            <span className="font-mono text-[11px] tabular-nums text-[#8B8275] shrink-0">
                              {currentVal.length} chars · ~{approxTokens(currentVal)} tokens
                            </span>
                          </div>

                          {isOpen && (
                            <div className="px-4 pb-4 pt-2 border-t border-[#3D3830]/10 space-y-2.5">
                              <textarea
                                rows={field.rows}
                                value={currentVal}
                                onChange={(e) =>
                                  setEngineOverrides((prev) => ({
                                    ...prev,
                                    [field.key]: e.target.value,
                                  }))
                                }
                                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3.5 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                              />
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[11px] text-[#8B8275]">
                                  key: {field.key}
                                </span>
                                <button
                                  type="button"
                                  disabled={savingEngine || !isCustomized}
                                  onClick={() => void handleResetEngineKey(field.key)}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] disabled:opacity-40 cursor-pointer"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  <span>Reset to Code Default</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Nested Record Groups: Intent Contracts, Fluency Instructions, Format Contracts, Deep Audit Lenses */}
                    {(
                      [
                        {
                          key: 'intent_output_contracts' as const,
                          title: '5 Intent Output Contracts',
                          subtitle:
                            'CONVERSATIONAL, SOFT_HORIZON, HARD_DECISION, TIMING, and PEER_AUDIT structural contracts.',
                        },
                        {
                          key: 'fluency_instructions' as const,
                          title: '6 Fluency Ladder Instructions',
                          subtitle:
                            'Simple/Detailed x Beginner/Guided Bridge/Practitioner calibration directives.',
                        },
                        {
                          key: 'format_contracts' as const,
                          title: '3 Response Format Contracts',
                          subtitle: 'dual_view, short, and detailed Observatory cards/tables formatting.',
                        },
                        {
                          key: 'deep_audit_lenses' as const,
                          title: '4 Deep Council Audit Lenses',
                          subtitle:
                            'parashari_divisional, kp_nadi, multi_clock_timing, and contrarian_auditor personas.',
                        },
                      ] as const
                    ).map((group) => {
                      const defaultsMap = engineDefaults[group.key];
                      const overridesMap = engineOverrides[group.key] || {};
                      const subKeys = Object.keys(defaultsMap);
                      const customCount = subKeys.filter(
                        (sk) =>
                          overridesMap[sk] &&
                          overridesMap[sk].trim() !== defaultsMap[sk].trim()
                      ).length;
                      const isOpen = Boolean(expandedEngineSection[group.key]);

                      return (
                        <div
                          key={group.key}
                          className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] overflow-hidden"
                        >
                          <div
                            onClick={() =>
                              setExpandedEngineSection((prev) => ({
                                ...prev,
                                [group.key]: !prev[group.key],
                              }))
                            }
                            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 cursor-pointer hover:bg-[#F1ECE3]/55 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4 text-[#5C5449] shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-[#5C5449] shrink-0" />
                              )}
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-medium text-[#3D3830]">
                                    {group.title}
                                  </span>
                                  <span
                                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                                      customCount > 0
                                        ? 'bg-[#B8965A]/20 text-[#3D3830]'
                                        : 'bg-[#EAE3D7] text-[#8B8275]'
                                    }`}
                                  >
                                    {customCount > 0 ? `${customCount} Customized` : 'Code Default'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#8B8275] truncate">
                                  {group.subtitle}
                                </p>
                              </div>
                            </div>
                            <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                              {subKeys.length} blocks
                            </span>
                          </div>

                          {isOpen && (
                            <div className="px-4 pb-4 pt-3 border-t border-[#3D3830]/10 space-y-4">
                              {subKeys.map((sk) => {
                                const val = overridesMap[sk] ?? defaultsMap[sk];
                                const skCustom = Boolean(
                                  overridesMap[sk] &&
                                    overridesMap[sk].trim() !== defaultsMap[sk].trim()
                                );
                                return (
                                  <div key={sk} className="space-y-1.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-medium text-[#3D3830]">
                                          {sk}
                                        </span>
                                        <span
                                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                            skCustom
                                              ? 'bg-[#B8965A]/20 text-[#3D3830]'
                                              : 'bg-[#EAE3D7] text-[#8B8275]'
                                          }`}
                                        >
                                          {skCustom ? 'Customized' : 'Code Default'}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                                          {val.length} chars · ~{approxTokens(val)} tokens
                                        </span>
                                        {skCustom && (
                                          <button
                                            type="button"
                                            disabled={savingEngine}
                                            onClick={() => void handleResetEngineKey(group.key, sk)}
                                            className="text-[11px] text-[#7A3E36] hover:underline cursor-pointer"
                                          >
                                            Reset
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <textarea
                                      rows={4}
                                      value={val}
                                      onChange={(e) =>
                                        setEngineOverrides((prev) => ({
                                          ...prev,
                                          [group.key]: {
                                            ...(prev[group.key] || {}),
                                            [sk]: e.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Canonical Playbooks Viewer & Override Editor */}
                <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                        Canonical Playbooks ({canonicalPlaybooks.length}) &amp; Per-Playbook Overrides
                      </h3>
                      <p className="text-xs text-[#8B8275] mt-0.5">
                        Inspect every Vedic routing playbook, bound formula cartridges, required Vargas, or add custom domain instructions &amp; timing overrides.
                      </p>
                    </div>
                    <span className="font-mono text-xs tabular-nums text-[#8B8275]">
                      {Object.keys(playbookOverrides).length} customized
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="h-3.5 w-3.5 text-[#8B8275] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={playbookSearch}
                        onChange={(e) => setPlaybookSearch(e.target.value)}
                        placeholder="Search by ID (MAR_01, CAR_02), question title, or formula slug..."
                        className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] pl-9 pr-3.5 py-2 text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                      />
                    </div>
                    <div className="w-full sm:w-56">
                      <CustomSelect
                        value={playbookDomainFilter}
                        onChange={setPlaybookDomainFilter}
                        ariaLabel="Filter playbooks by domain"
                        surface="canvas"
                        size="sm"
                        className="w-full"
                        options={playbookDomains}
                      />
                    </div>
                  </div>

                  <div className="max-h-[540px] overflow-y-auto space-y-2 pr-1">
                    {filteredPlaybooks.map((pb) => {
                      const ov = playbookOverrides[pb.id];
                      const isExpanded = expandedPlaybookId === pb.id;
                      const effectiveTiming =
                        ov?.requiresTimingStack !== undefined
                          ? ov.requiresTimingStack
                          : pb.requiresTimingStack;
                      const effectiveFormulas =
                        ov?.formulaSlugs && ov.formulaSlugs.length > 0
                          ? ov.formulaSlugs
                          : pb.formulaSlugs;

                      return (
                        <div
                          key={pb.id}
                          className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedPlaybookId((prev) => (prev === pb.id ? null : pb.id))
                            }
                            className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-[#F1ECE3]/55 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-mono text-xs font-semibold text-[#3D3830] shrink-0">
                                {pb.id}
                              </span>
                              <span className="rounded bg-[#EAE3D7] px-1.5 py-0.5 text-[10px] font-medium text-[#5C5449] uppercase shrink-0">
                                {pb.domain}
                              </span>
                              {ov && (
                                <span className="rounded bg-[#B8965A]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#3D3830] shrink-0">
                                  Customized
                                </span>
                              )}
                              <span className="text-xs text-[#3D3830] truncate">{pb.title}</span>
                            </div>
                            <span className="font-mono text-[11px] text-[#8B8275] shrink-0">
                              {pb.defaultIntent} · {pb.requiredVargas.join('/')}
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="px-4 pb-4 pt-3 border-t border-[#3D3830]/10 space-y-3 bg-[#FDFBF7]">
                              <div className="flex flex-wrap gap-3 text-[11px] text-[#5C5449]">
                                <span>
                                  Houses: <strong className="font-mono">{pb.requiredHouses.join(', ')}</strong>
                                </span>
                                <span>
                                  Vargas: <strong className="font-mono">{pb.requiredVargas.join(', ')}</strong>
                                </span>
                                <span>
                                  Intent: <strong className="font-mono">{pb.defaultIntent}</strong>
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-medium text-[#3D3830]">
                                  Requires Multi-Clock Timing Stack (Dasha + Gochar)
                                </span>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={effectiveTiming}
                                  onClick={() =>
                                    setPlaybookOverrides((prev) => ({
                                      ...prev,
                                      [pb.id]: {
                                        ...(prev[pb.id] || {}),
                                        requiresTimingStack: !effectiveTiming,
                                      },
                                    }))
                                  }
                                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                                    effectiveTiming ? 'bg-[#4A453D]' : 'bg-[#D6CEC0]'
                                  }`}
                                >
                                  <span
                                    className={`h-4 w-4 rounded-full bg-[#FDFBF7] shadow-xs transition-transform ${
                                      effectiveTiming ? 'translate-x-4' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                              </div>

                              <label className="block space-y-1">
                                <span className="text-xs font-medium text-[#5C5449]">
                                  Formula Cartridge Slugs (comma-separated)
                                </span>
                                <input
                                  type="text"
                                  value={effectiveFormulas.join(', ')}
                                  onChange={(e) =>
                                    setPlaybookOverrides((prev) => ({
                                      ...prev,
                                      [pb.id]: {
                                        ...(prev[pb.id] || {}),
                                        formulaSlugs: e.target.value
                                          .split(',')
                                          .map((s) => s.trim())
                                          .filter(Boolean),
                                      },
                                    }))
                                  }
                                  className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs text-[#3D3830] focus:outline-none"
                                />
                              </label>

                              <label className="block space-y-1">
                                <span className="text-xs font-medium text-[#5C5449]">
                                  Playbook-Specific Override Guidance (injected when routed to {pb.id})
                                </span>
                                <textarea
                                  rows={3}
                                  value={ov?.customInstructions || ''}
                                  onChange={(e) =>
                                    setPlaybookOverrides((prev) => ({
                                      ...prev,
                                      [pb.id]: {
                                        ...(prev[pb.id] || {}),
                                        customInstructions: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="Optional domain nuances or constraints specific to this question playbook..."
                                  className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] p-3 font-mono text-xs text-[#3D3830] focus:outline-none resize-y"
                                />
                              </label>

                              <div className="flex items-center justify-end gap-2">
                                {ov && (
                                  <button
                                    type="button"
                                    disabled={savingPlaybookId === pb.id}
                                    onClick={() => void handleResetPlaybookOverride(pb.id)}
                                    className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-xs font-medium text-[#7A3E36] hover:bg-[#7A3E36]/8 cursor-pointer"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    <span>Reset to Default</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={savingPlaybookId === pb.id || !ov}
                                  onClick={() => void handleSavePlaybookOverride(pb.id)}
                                  className="inline-flex items-center gap-1 rounded-full bg-[#4A453D] px-3.5 py-1.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-40 cursor-pointer"
                                >
                                  <Save className="h-3 w-3" />
                                  <span>
                                    {savingPlaybookId === pb.id ? 'Saving...' : 'Save Playbook Override'}
                                  </span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            {/* SUB-TAB 7: ACTIVE FILES, PROMPT STACK & OVERRIDE MANIFEST */}
            {sectionTab === 'stack' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] px-5 py-4">
                  <div>
                    <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                      Active Files, Prompt Stack &amp; Override Manifest — {activeGuideMeta?.displayName || selectedGuide}
                    </h3>
                    <p className="text-xs text-[#8B8275] mt-0.5">
                      Live read-only verification of every backend TypeScript module, resolved model, precedence stack, contradiction check, and database source powering this guide.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={manifestLoading}
                    onClick={() => void loadRuntimeManifest(selectedGuide)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${manifestLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh Manifest</span>
                  </button>
                </div>

                {manifestLoading && !manifest ? (
                  <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-8 text-center text-xs text-[#8B8275]">
                    Inspecting live runtime manifest...
                  </div>
                ) : manifest ? (
                  <>
                    {/* Override Warnings */}
                    {manifest.overrideWarnings.length > 0 && (
                      <div className="space-y-2">
                        {manifest.overrideWarnings.map((w, idx) => (
                          <div
                            key={idx}
                            className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-xs ${
                              w.severity === 'warn'
                                ? 'border-[#7A3E36]/30 bg-[#7A3E36]/8 text-[#7A3E36]'
                                : 'border-[#B8965A]/35 bg-[#B8965A]/10 text-[#3D3830]'
                            }`}
                          >
                            {w.severity === 'warn' ? (
                              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            ) : (
                              <Info className="h-4 w-4 shrink-0 mt-0.5 text-[#B8965A]" />
                            )}
                            <span>{w.message}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Resolved Models Strip */}
                    <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 space-y-3">
                      <h4 className="font-['Cormorant_Garamond',serif] text-lg font-medium text-[#3D3830]">
                        Resolved OpenRouter Models
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div className="rounded-2xl border border-[#3D3830]/10 bg-[#FAF7F2] p-3">
                          <p className="text-[11px] text-[#8B8275]">Effective Guide Model</p>
                          <p className="font-mono font-medium text-[#3D3830] mt-1 truncate">
                            {manifest.resolvedModels.effectiveModel}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[#3D3830]/10 bg-[#FAF7F2] p-3">
                          <p className="text-[11px] text-[#8B8275]">Global Consultation</p>
                          <p className="font-mono text-[#5C5449] mt-1 truncate">
                            {manifest.resolvedModels.consultationModel}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[#3D3830]/10 bg-[#FAF7F2] p-3">
                          <p className="text-[11px] text-[#8B8275]">Utility / Stage 4</p>
                          <p className="font-mono text-[#5C5449] mt-1 truncate">
                            {manifest.resolvedModels.utilityModel}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[#3D3830]/10 bg-[#FAF7F2] p-3">
                          <p className="text-[11px] text-[#8B8275]">Stage 1 Jev Router</p>
                          <p className="font-mono text-[#5C5449] mt-1 truncate">
                            {manifest.resolvedModels.jevModel}
                          </p>
                        </div>
                      </div>
                    </section>

                    {/* 1. Runtime Code Files Executed */}
                    <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <FileCode2 className="h-4 w-4 text-[#5C5449]" />
                        <h4 className="font-['Cormorant_Garamond',serif] text-lg font-medium text-[#3D3830]">
                          Runtime Code Files Executed (Exact Order)
                        </h4>
                      </div>
                      <div className="divide-y divide-[#3D3830]/10 rounded-2xl border border-[#3D3830]/10 bg-[#FAF7F2]">
                        {manifest.runtimeFiles.map((rf, i) => (
                          <div key={i} className="p-3.5 space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-medium text-[#3D3830]">
                                  {i + 1}. {rf.filePath}
                                </span>
                                <span className="rounded bg-[#EAE3D7] px-2 py-0.5 text-[11px] text-[#5C5449]">
                                  {rf.step}
                                </span>
                              </div>
                              <span className="font-mono text-[11px] text-[#8B8275]">
                                {rf.modelResolved}
                              </span>
                            </div>
                            <p className="text-xs text-[#5C5449]">{rf.notes}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* 2. Prompt & Rule Precedence Stack */}
                    <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-[#5C5449]" />
                          <h4 className="font-['Cormorant_Garamond',serif] text-lg font-medium text-[#3D3830]">
                            Prompt &amp; Rule Precedence Stack (Lowest → Highest)
                          </h4>
                        </div>
                        <span className="font-mono text-xs tabular-nums text-[#8B8275]">
                          {manifest.promptStack.reduce(
                            (acc, s) => acc + (s.status === 'Active' ? s.approxTokens : 0),
                            0
                          )}{' '}
                          ~active tokens
                        </span>
                      </div>

                      <div className="space-y-2">
                        {manifest.promptStack.map((item) => {
                          const expanded = Boolean(expandedStackOrders[item.order]);
                          return (
                            <div
                              key={item.order}
                              className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-3.5 space-y-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                  <span className="font-mono text-xs font-semibold text-[#3D3830]">
                                    #{item.order}
                                  </span>
                                  <span className="text-xs font-medium text-[#3D3830]">
                                    {item.layer}
                                  </span>
                                  <span
                                    className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                                      item.source === 'Database'
                                        ? 'bg-[#B8965A]/20 text-[#3D3830]'
                                        : 'bg-[#EAE3D7] text-[#5C5449]'
                                    }`}
                                  >
                                    {item.source}
                                  </span>
                                  <span
                                    className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                                      item.status === 'Active'
                                        ? 'bg-[#2D6A4F]/12 text-[#2D6A4F]'
                                        : 'bg-[#7A3E36]/12 text-[#7A3E36]'
                                    }`}
                                  >
                                    {item.status}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                                    {item.chars} chars · ~{item.approxTokens} tokens
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedStackOrders((prev) => ({
                                        ...prev,
                                        [item.order]: !prev[item.order],
                                      }))
                                    }
                                    className="text-[11px] font-medium text-[#3D3830] hover:underline cursor-pointer"
                                  >
                                    {expanded ? 'Hide text' : 'Inspect text'}
                                  </button>
                                </div>
                              </div>

                              <p className="font-mono text-[11px] text-[#8B8275] truncate">
                                Source: {item.dbLocation}
                              </p>

                              {expanded ? (
                                <pre className="whitespace-pre-wrap rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] p-3 font-mono text-[11px] leading-relaxed text-[#3D3830] max-h-72 overflow-y-auto">
                                  {item.fullText}
                                </pre>
                              ) : (
                                <p className="text-[11px] text-[#5C5449] line-clamp-2">
                                  {item.preview}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    {/* 3. Database Tables & Linked Records */}
                    <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-[#5C5449]" />
                        <h4 className="font-['Cormorant_Garamond',serif] text-lg font-medium text-[#3D3830]">
                          Database Tables &amp; Linked Records
                        </h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {manifest.databaseTables.map((tbl) => (
                          <div
                            key={tbl.table}
                            className="rounded-2xl border border-[#3D3830]/10 bg-[#FAF7F2] p-3.5 space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-medium text-[#3D3830]">
                                {tbl.table}
                              </span>
                              <span className="rounded bg-[#EAE3D7] px-2 py-0.5 font-mono text-[11px] tabular-nums text-[#3D3830]">
                                {tbl.count}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#5C5449]">{tbl.purpose}</p>
                            <p className="text-[11px] text-[#8B8275]">{tbl.details}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* Live Interactive Chatbot Test Frame */}
        {showLivePreview && (
          <div
            className={
              previewExpanded ? 'w-full' : 'xl:col-span-6 xl:sticky xl:top-6'
            }
          >
            <div className="rounded-3xl border border-[#3D3830]/18 bg-[#FAF7F2] overflow-hidden flex flex-col h-[700px] shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b border-[#3D3830]/12 bg-[#F1ECE3] px-4 py-2.5 shrink-0">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#3D3830] truncate">
                    Live Chatbot Test Workbench
                  </p>
                  <p className="text-[11px] text-[#8B8275] truncate">
                    Real AI stream using your saved prompts, modular rules, and engine overrides
                  </p>
                </div>
                <span className="font-mono text-[11px] tabular-nums text-[#8B8275] shrink-0">
                  Session #{previewKey}
                </span>
              </div>
              <div className="flex-1 min-h-0 flex">
                <ChatWorkspace key={previewKey} embeddedPreview />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminChatbotControl;
