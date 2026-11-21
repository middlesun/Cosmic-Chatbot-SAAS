import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Columns2,
  Eye,
  EyeOff,
  Maximize2,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
  Star,
} from 'lucide-react';
import CustomSelect from '../app/CustomSelect';
import ChatWorkspace from '../app/ChatWorkspace';
import type { PromptRecipeRecord } from './PromptLibraryManager';

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

const SUGGESTION_COUNT_OPTIONS = ['1', '2', '3', '4', '5', '6'].map((v) => ({
  value: v,
  label: `${v} items`,
}));

interface AdminChatbotControlProps {
  getAccessToken: () => Promise<string | null>;
  onPromptsChanged?: () => void;
}

const FEATURE_TOGGLES: Array<{
  key: keyof ChatbotFeaturesConfig;
  label: string;
  description: string;
}> = [
  {
    key: 'voice_input',
    label: 'Voice dictation in composer',
    description: 'Allows users to speak questions using the microphone button.',
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
    description: 'Allows users to upload or paste chart screenshots and PDFs.',
  },
  {
    key: 'quick_tools',
    label: 'Prompt helper tools',
    description: 'Shows Question Generator, Expander, and Optimizer in the composer drawer.',
  },
  {
    key: 'followups',
    label: 'Suggested follow-up questions',
    description: 'Generates clickable numbered follow-up prompts under each answer.',
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

const AdminChatbotControl: React.FC<AdminChatbotControlProps> = ({
  getAccessToken,
  onPromptsChanged,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingPromptId, setTogglingPromptId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [config, setConfig] = useState<ChatbotConfigState | null>(null);
  const [defaultRules, setDefaultRules] = useState('');
  const [suggestionsConfig, setSuggestionsConfig] = useState<SuggestionsConfigState | null>(null);
  const [defaultSuggestionsConfig, setDefaultSuggestionsConfig] =
    useState<SuggestionsConfigState | null>(null);
  const [prompts, setPrompts] = useState<ChatbotPromptSummary[]>([]);
  const [recipes, setRecipes] = useState<PromptRecipeRecord[]>([]);
  const [pipelineLoggingEnabled, setPipelineLoggingEnabled] = useState(false);
  const [togglingPipelineLogging, setTogglingPipelineLogging] = useState(false);

  const [sectionTab, setSectionTab] = useState<
    'experience' | 'catalog' | 'rules' | 'suggestions'
  >('experience');
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewKey, setPreviewKey] = useState(1);

  const loadChatbotSettings = async () => {
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
      setDefaultRules(data.defaultConversationalRules || '');
      setPipelineLoggingEnabled(Boolean(data.pipelineLoggingEnabled));
      if (data.suggestionsConfig) {
        setSuggestionsConfig(data.suggestionsConfig as SuggestionsConfigState);
      }
      if (data.defaultSuggestionsConfig) {
        setDefaultSuggestionsConfig(data.defaultSuggestionsConfig as SuggestionsConfigState);
      }
      setPrompts(data.prompts || []);
      setRecipes(data.recipes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load chatbot settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadChatbotSettings();
  }, []);

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
      setFeedback(
        `Chatbot pipeline diagnostics logging is now ${confirmed ? 'ON' : 'OFF'}.`
      );
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
      setFeedback(
        `${item.display_name} is now ${!item.is_active ? 'visible' : 'hidden'} in Chat.`
      );
      setPreviewKey((k) => k + 1);
      onPromptsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle visibility');
    } finally {
      setTogglingPromptId(null);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const payload: ChatbotConfigState = {
        ...config,
        expert_order: expertsList.map((i) => i.slug),
        mode_order: modesList.map((i) => i.slug),
        language_order: languagesList.map((i) => i.slug),
      };

      const requests: Array<Promise<Response>> = [
        fetch('/api/admin/settings/chatbot', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }),
      ];

      if (suggestionsConfig) {
        requests.push(
          fetch('/api/admin/settings/suggestions', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(suggestionsConfig),
          })
        );
      }

      const [chatbotRes, suggestionsRes] = await Promise.all(requests);
      const chatbotData = await chatbotRes.json();
      if (!chatbotRes.ok) {
        throw new Error(chatbotData.error || 'Failed to save chatbot configuration');
      }
      setConfig(chatbotData.config || payload);

      if (suggestionsRes) {
        const sugData = await suggestionsRes.json();
        if (!suggestionsRes.ok) {
          throw new Error(sugData.error || 'Failed to save suggestions configuration');
        }
        if (sugData.config) {
          setSuggestionsConfig(sugData.config as SuggestionsConfigState);
        }
      }

      setFeedback('Chatbot & Suggestions configuration saved. Live users and preview updated.');
      setPreviewKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save chatbot configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-8 text-center text-sm text-[#8B8275]">
        Loading chatbot configuration...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-['Cormorant_Garamond',serif] text-2xl font-medium text-[#3D3830]">
            Chatbot Experience &amp; Controls
          </h2>
          <p className="text-xs text-[#8B8275] mt-0.5">
            Configure welcome copy, default selectors, feature toggles, dropdown order, and natural dialogue rules.
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
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving...' : 'Save Chatbot Settings'}</span>
          </button>
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
            : 'space-y-6'
        }
      >
        {(!showLivePreview || !previewExpanded) && (
          <div className={showLivePreview ? 'xl:col-span-6 space-y-5' : 'space-y-5'}>
            {/* Clean Segmented Sub-Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#F1ECE3] p-1.5 w-fit">
              <button
                type="button"
                onClick={() => setSectionTab('experience')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sectionTab === 'experience'
                    ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                    : 'text-[#5C5449] hover:text-[#3D3830]'
                }`}
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Welcome &amp; Features</span>
              </button>
              <button
                type="button"
                onClick={() => setSectionTab('catalog')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sectionTab === 'catalog'
                    ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                    : 'text-[#5C5449] hover:text-[#3D3830]'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Defaults &amp; Ordering</span>
              </button>
              <button
                type="button"
                onClick={() => setSectionTab('rules')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sectionTab === 'rules'
                    ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                    : 'text-[#5C5449] hover:text-[#3D3830]'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Conversational Rules</span>
              </button>
              <button
                type="button"
                onClick={() => setSectionTab('suggestions')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sectionTab === 'suggestions'
                    ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                    : 'text-[#5C5449] hover:text-[#3D3830]'
                }`}
              >
                <Star className="h-3.5 w-3.5" />
                <span>Suggestions</span>
              </button>
            </div>

            {/* TAB 1: Welcome Copy & Feature Toggles */}
            {sectionTab === 'experience' && (
              <div className="space-y-5">
                <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
                  <div>
                    <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                      Empty State &amp; Input Copy
                    </h3>
                    <p className="text-xs text-[#8B8275] mt-0.5">
                      Fine-tune the greeting, ready state confirmation, and composer placeholder shown to members.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[#5C5449]">New Chat Headline</span>
                      <input
                        type="text"
                        value={config.welcome_title}
                        onChange={(e) =>
                          setConfig({ ...config, welcome_title: e.target.value })
                        }
                        placeholder="I'm ready"
                        className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                      />
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-[#5C5449]">
                        Optional Subtitle (leave blank for minimal view)
                      </span>
                      <input
                        type="text"
                        value={config.welcome_subtitle}
                        onChange={(e) =>
                          setConfig({ ...config, welcome_subtitle: e.target.value })
                        }
                        placeholder="Optional calm helper line..."
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
                      value={config.general_ready_message}
                      onChange={(e) =>
                        setConfig({ ...config, general_ready_message: e.target.value })
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
                      value={config.composer_placeholder}
                      onChange={(e) =>
                        setConfig({ ...config, composer_placeholder: e.target.value })
                      }
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                    />
                  </label>
                </section>

                <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
                  <div>
                    <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                      Chatbot Feature Controls
                    </h3>
                    <p className="text-xs text-[#8B8275] mt-0.5">
                      Toggle individual capabilities on or off globally across the user Chat interface.
                    </p>
                  </div>

                  <div className="divide-y divide-[#3D3830]/10">
                    {FEATURE_TOGGLES.map((feat) => {
                      const enabled = Boolean(config.features[feat.key]);
                      return (
                        <div
                          key={feat.key}
                          className="flex items-center justify-between gap-4 py-3 first:pt-1 last:pb-0"
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
                              setConfig({
                                ...config,
                                features: {
                                  ...config.features,
                                  [feat.key]: !enabled,
                                },
                              })
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

                    <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#3D3830]">
                          Chatbot pipeline diagnostics logging
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
              </div>
            )}

            {/* TAB 2: Defaults, Tone & Dropdown Ordering */}
            {sectionTab === 'catalog' && (
              <div className="space-y-5">
                <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
                  <div>
                    <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                      Default Consultation Settings
                    </h3>
                    <p className="text-xs text-[#8B8275] mt-0.5">
                      Applied automatically when members start a fresh consultation.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-[#5C5449]">Default Council Guide</span>
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
                      <span className="text-xs font-medium text-[#5C5449]">Default Mode / Focus</span>
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
                      <span className="text-xs font-medium text-[#5C5449]">Default Output Style</span>
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
                      <span className="text-xs font-medium text-[#5C5449]">Default Language</span>
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
                </section>

                {/* Council Ordering & Visibility */}
                <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                        Council Order &amp; Visibility
                      </h3>
                      <p className="text-xs text-[#8B8275] mt-0.5">
                        Reorder how council guides appear in the dropdown or toggle visibility live.
                      </p>
                    </div>
                    <span className="font-mono text-xs tabular-nums text-[#8B8275]">
                      {expertsList.filter((i) => i.is_active).length}/{expertsList.length} active
                    </span>
                  </div>

                  <div className="divide-y divide-[#3D3830]/10">
                    {expertsList.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <div className="min-w-0 flex items-center gap-3">
                          <span className="font-mono text-xs tabular-nums text-[#8B8275] w-5">
                            {idx + 1}.
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#3D3830] truncate">
                              {item.display_name}
                            </p>
                            <p className="text-xs text-[#8B8275] truncate">
                              {item.slug}
                              {item.model_id ? ` · ${item.model_id}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveSlugInOrder('expert_order', expertsList, idx, -1)}
                            aria-label={`Move ${item.display_name} up`}
                            className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#F1ECE3] disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === expertsList.length - 1}
                            onClick={() => moveSlugInOrder('expert_order', expertsList, idx, 1)}
                            aria-label={`Move ${item.display_name} down`}
                            className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#F1ECE3] disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={togglingPromptId === item.id}
                            onClick={() => void handleTogglePromptActive(item)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                              item.is_active
                                ? 'border-[#2D6A4F]/25 bg-[#2D6A4F]/8 text-[#2D6A4F]'
                                : 'border-[#3D3830]/15 bg-[#F1ECE3] text-[#8B8275]'
                            }`}
                          >
                            {item.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            <span>{item.is_active ? 'Visible' : 'Hidden'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Modes / Areas of Life Ordering & Recipe Binding */}
                <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                        Modes &amp; Life Focus Order
                      </h3>
                      <p className="text-xs text-[#8B8275] mt-0.5">
                        Controls the Mode selector order and shows any active Composable Recipe bound in Prompt Library.
                      </p>
                    </div>
                    <span className="font-mono text-xs tabular-nums text-[#8B8275]">
                      {modesList.filter((i) => i.is_active).length}/{modesList.length} active
                    </span>
                  </div>

                  <div className="divide-y divide-[#3D3830]/10">
                    {modesList.map((item, idx) => {
                      const boundRecipe = recipeByModeSlug.get(item.slug);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 py-2.5"
                        >
                          <div className="min-w-0 flex items-center gap-3">
                            <span className="font-mono text-xs tabular-nums text-[#8B8275] w-5">
                              {idx + 1}.
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[#3D3830] truncate">
                                {item.display_name}
                              </p>
                              <p className="text-xs text-[#8B8275] truncate">
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
                              onClick={() => moveSlugInOrder('mode_order', modesList, idx, -1)}
                              aria-label={`Move ${item.display_name} up`}
                              className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#F1ECE3] disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === modesList.length - 1}
                              onClick={() => moveSlugInOrder('mode_order', modesList, idx, 1)}
                              aria-label={`Move ${item.display_name} down`}
                              className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#F1ECE3] disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={togglingPromptId === item.id}
                              onClick={() => void handleTogglePromptActive(item)}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                                item.is_active
                                  ? 'border-[#2D6A4F]/25 bg-[#2D6A4F]/8 text-[#2D6A4F]'
                                  : 'border-[#3D3830]/15 bg-[#F1ECE3] text-[#8B8275]'
                              }`}
                            >
                              {item.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                              <span>{item.is_active ? 'Visible' : 'Hidden'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Languages Order */}
                <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                        Languages Order &amp; Visibility
                      </h3>
                      <p className="text-xs text-[#8B8275] mt-0.5">
                        Configure which response languages are available to members.
                      </p>
                    </div>
                    <span className="font-mono text-xs tabular-nums text-[#8B8275]">
                      {languagesList.filter((i) => i.is_active).length}/{languagesList.length} active
                    </span>
                  </div>

                  <div className="divide-y divide-[#3D3830]/10">
                    {languagesList.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <div className="min-w-0 flex items-center gap-3">
                          <span className="font-mono text-xs tabular-nums text-[#8B8275] w-5">
                            {idx + 1}.
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#3D3830] truncate">
                              {item.display_name}
                            </p>
                            <p className="text-xs text-[#8B8275] truncate">{item.slug}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveSlugInOrder('language_order', languagesList, idx, -1)}
                            aria-label={`Move ${item.display_name} up`}
                            className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#F1ECE3] disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === languagesList.length - 1}
                            onClick={() => moveSlugInOrder('language_order', languagesList, idx, 1)}
                            aria-label={`Move ${item.display_name} down`}
                            className="p-1.5 rounded-lg border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#F1ECE3] disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={togglingPromptId === item.id}
                            onClick={() => void handleTogglePromptActive(item)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                              item.is_active
                                ? 'border-[#2D6A4F]/25 bg-[#2D6A4F]/8 text-[#2D6A4F]'
                                : 'border-[#3D3830]/15 bg-[#F1ECE3] text-[#8B8275]'
                            }`}
                          >
                            {item.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            <span>{item.is_active ? 'Visible' : 'Hidden'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* TAB 3: Conversational Rules */}
            {sectionTab === 'rules' && (
              <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                      Conversational Style &amp; Dialogue Continuity Rules
                    </h3>
                    <p className="text-xs text-[#8B8275] mt-0.5 max-w-2xl">
                      Injected into every consultation turn to prevent repetitive salutations (like &ldquo;Hello Name,&rdquo;) and keep replies warm, direct, and conversational.
                    </p>
                  </div>

                  {defaultRules && (
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, conversational_rules: defaultRules })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reset Default Rules</span>
                    </button>
                  )}
                </div>

                <textarea
                  rows={12}
                  value={config.conversational_rules}
                  onChange={(e) =>
                    setConfig({ ...config, conversational_rules: e.target.value })
                  }
                  className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-4 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                />

                <div className="flex items-center justify-between text-xs text-[#8B8275]">
                  <span>Changes take effect immediately on the next chat message after saving.</span>
                  <span className="font-mono tabular-nums">
                    {config.conversational_rules.length} / 4000 chars
                  </span>
                </div>
              </section>
            )}

            {/* TAB 4: Suggestions (Followups & Deeper analysis Grandmaster Rules) */}
            {sectionTab === 'suggestions' && suggestionsConfig && (
              <div className="space-y-5">
                <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
                  <div>
                    <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                      Two-Tier Suggestions Controls
                    </h3>
                    <p className="text-xs text-[#8B8275] mt-0.5">
                      Manage the collapsible Followup and Deeper analysis columns generated below each consultation reply.
                    </p>
                  </div>

                  <div className="divide-y divide-[#3D3830]/10">
                    {(
                      [
                        {
                          key: 'followups_enabled',
                          label: 'Enable Followup column',
                          description:
                            'Generates natural, everyday next questions tailored to the user’s reading.',
                        },
                        {
                          key: 'deeper_analysis_enabled',
                          label: 'Enable Deeper analysis column',
                          description:
                            'Generates Grandmaster multi-system analytical lenses (KP Sub-Lords, Vargas, Jaimini, Ashtakavarga, Nadi) with private technical directives.',
                        },
                        {
                          key: 'default_expanded',
                          label: 'Expand suggestions by default',
                          description:
                            'Global default state for new replies (individual members can still collapse by default in Chat Settings).',
                        },
                      ] as const
                    ).map((toggle) => {
                      const enabled = Boolean(suggestionsConfig[toggle.key]);
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
                              setSuggestionsConfig({
                                ...suggestionsConfig,
                                [toggle.key]: !enabled,
                              })
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
                        value={String(suggestionsConfig.max_followups)}
                        onChange={(val) =>
                          setSuggestionsConfig({
                            ...suggestionsConfig,
                            max_followups: Number(val) || 4,
                          })
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
                        value={String(suggestionsConfig.max_deeper_analysis)}
                        onChange={(val) =>
                          setSuggestionsConfig({
                            ...suggestionsConfig,
                            max_deeper_analysis: Number(val) || 4,
                          })
                        }
                        ariaLabel="Maximum deeper analysis suggestions per reply"
                        surface="canvas"
                        className="w-full"
                        options={SUGGESTION_COUNT_OPTIONS}
                      />
                    </div>
                  </div>
                </section>

                {/* Followups Rules */}
                <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                        Followups Generation Rules
                      </h3>
                      <p className="text-xs text-[#8B8275] mt-0.5 max-w-2xl">
                        Guides how the AI crafts natural, accessible next questions in the Followup column.
                      </p>
                    </div>
                    {defaultSuggestionsConfig?.followups_rules && (
                      <button
                        type="button"
                        onClick={() =>
                          setSuggestionsConfig({
                            ...suggestionsConfig,
                            followups_rules: defaultSuggestionsConfig.followups_rules,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Reset Default</span>
                      </button>
                    )}
                  </div>

                  <textarea
                    rows={8}
                    value={suggestionsConfig.followups_rules}
                    onChange={(e) =>
                      setSuggestionsConfig({
                        ...suggestionsConfig,
                        followups_rules: e.target.value,
                      })
                    }
                    className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-4 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                  />

                  <div className="flex items-center justify-between text-xs text-[#8B8275]">
                    <span>Injected into the single-turn suggestion block on every eligible reply.</span>
                    <span className="font-mono tabular-nums">
                      {suggestionsConfig.followups_rules.length} / 4000 chars
                    </span>
                  </div>
                </section>

                {/* Deeper Analysis Grandmaster Rules */}
                <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                        Deeper analysis Grandmaster Rules
                      </h3>
                      <p className="text-xs text-[#8B8275] mt-0.5 max-w-2xl">
                        Instructs the AI to act as an autonomous master practitioner dynamically selecting divisional charts (D9/D10/D12/D16/D30), KP Sub-Lords, Jaimini Karakas, Ashtakavarga, Nadi linkages, Tropical aspects, or Tarot/Numerology checks—never artificially capped to a fixed list.
                      </p>
                    </div>
                    {defaultSuggestionsConfig?.deeper_analysis_rules && (
                      <button
                        type="button"
                        onClick={() =>
                          setSuggestionsConfig({
                            ...suggestionsConfig,
                            deeper_analysis_rules: defaultSuggestionsConfig.deeper_analysis_rules,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Reset Default</span>
                      </button>
                    )}
                  </div>

                  <textarea
                    rows={10}
                    value={suggestionsConfig.deeper_analysis_rules}
                    onChange={(e) =>
                      setSuggestionsConfig({
                        ...suggestionsConfig,
                        deeper_analysis_rules: e.target.value,
                      })
                    }
                    className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-4 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
                  />

                  <div className="flex items-center justify-between text-xs text-[#8B8275]">
                    <span>
                      Each Deeper analysis option carries a hidden technical directive applied automatically when clicked or edited.
                    </span>
                    <span className="font-mono tabular-nums">
                      {suggestionsConfig.deeper_analysis_rules.length} / 5000 chars
                    </span>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}

        {/* Live Interactive Chatbot Test Frame */}
        {showLivePreview && (
          <div
            className={
              previewExpanded
                ? 'w-full'
                : 'xl:col-span-6 xl:sticky xl:top-6'
            }
          >
            <div className="rounded-3xl border border-[#3D3830]/18 bg-[#FAF7F2] overflow-hidden flex flex-col h-[700px] shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b border-[#3D3830]/12 bg-[#F1ECE3] px-4 py-2.5 shrink-0">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#3D3830] truncate">
                    Live Chatbot Test Workbench
                  </p>
                  <p className="text-[11px] text-[#8B8275] truncate">
                    Real AI stream using your saved prompts, recipes, tone, and dialogue rules
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
