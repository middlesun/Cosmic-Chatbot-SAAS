import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeftRight,
  Check,
  Copy,
  Eye,
  Flame,
  Layers,
  MessageSquare,
  RotateCcw,
  Send,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import CompanionAvatar from '../../app/CompanionAvatar';
import CustomSelect from '../../app/CustomSelect';
import { CHAT_STYLE_OPTIONS, type ChatStyle, type CompanionChatCue } from '../../app/chatTypes';
import {
  type AdminCompanionRecord,
  type AdminCompanionRosterSummary,
} from './companionStudioTypes';

export const ASTRA_MOON_BENCHMARK_SLUG = '__astra_moon_benchmark__';

interface CompanionAssemblySectionInfo {
  key: string;
  label: string;
  estimatedTokens: number;
  charCount: number;
  content: string;
}

interface CompanionAssemblyManifest {
  layersLoaded: string[];
  orderedSections: CompanionAssemblySectionInfo[];
  nuancesTriggered: Array<{ id: string; title: string; priority: number }>;
  dialoguesTriggered: Array<{ id: string; scenario: string }>;
  capsuleApplied: boolean;
  capsuleTokens: number;
  chartInjected: boolean;
  transitsInjected: boolean;
  analystNotesInjected: boolean;
  tarotDrawn: boolean;
  esotericRelevance: 'none' | 'subtle_open' | 'explicit_invite';
  astrologyEntryRule: 'never' | 'invite_only' | 'contextual_invite';
  astrologyGateDecision: {
    loaded: boolean;
    reason: string;
    hasAnyEsoteric: boolean;
    hasProfileChart: boolean;
    astrologyEntryRule: string;
    esotericRelevance: string;
  };
  emotionalWeight: string;
  conversationIntent: string;
  aiIdentityQuestion: boolean;
  estimatedTokensBySection: Record<string, number>;
  totalEstimatedTokens: number;
  assembledPromptPreview: string;
  fullAssembledPrompt?: string;
}

interface SandboxResult {
  companionSlug: string;
  companionName: string;
  assembledSystemPrompt: string;
  chatStyle: ChatStyle;
  modelUsed: string;
  temperatureUsed?: number;
  invitedEsoteric: boolean;
  openrouterConfigured: boolean;
  assemblyManifest: CompanionAssemblyManifest;
  tarotSpread?: {
    spread_type?: string;
    cards?: Array<{
      name: string;
      position: string;
      reversed?: boolean;
    }>;
  } | null;
  tokenBreakdown: {
    totalEstimatedTokens: number;
    capsuleEstimatedTokens: number;
    characterChars: number;
    sectionsCount: number;
  };
  replyText?: string;
  parsedReply?: {
    bubbles: string[];
    referral: { slug: string; name: string; reason: string } | null;
    cleanedText: string;
  };
  latencyMs?: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
  liveModelError?: string;
}

interface StudioTurnEntry {
  id: string;
  userPrompt: string;
  mode: 'live' | 'inspect';
  primaryStage: 'draft' | 'published' | 'benchmark';
  primary: SandboxResult;
  comparison?: {
    stage: 'draft' | 'published' | 'benchmark';
    result: SandboxResult;
  } | null;
}

interface CompanionTestingStudioProps {
  companions: AdminCompanionRosterSummary[];
  initialSlug?: string | null;
  activeEditorDraft?: AdminCompanionRecord | null;
  getAccessToken: () => Promise<string | null>;
}

const SCENARIO_PRESETS: Array<{ label: string; prompt: string; cue?: CompanionChatCue }> = [
  {
    label: 'Exhausted workday',
    prompt: "I'm honestly completely exhausted after back-to-back meetings all day.",
  },
  {
    label: 'Ask if AI',
    prompt: 'Be honest with me for a second — are you an AI or a real human?',
  },
  {
    label: 'Astrology career timing',
    prompt: 'Is Saturn affecting my career right now, or is it just stress?',
  },
  {
    label: 'Just listen / vent',
    prompt: "Don't try to fix anything yet, I just feel overwhelmed and need to get this off my chest.",
    cue: 'just_listen',
  },
  {
    label: 'Good news!',
    prompt: 'Guess what — I just got the job offer!! Still cannot believe it.',
  },
];

const STRESS_THEME_PRESETS = [
  'Work-life balance',
  'Career crossroads',
  'Relationship clarity',
  'Evening overthinking',
  'Family pressure',
  'Creative burnout',
];

const CompanionTestingStudio: React.FC<CompanionTestingStudioProps> = ({
  companions,
  initialSlug,
  activeEditorDraft,
  getAccessToken,
}) => {
  const orderedCompanions = useMemo(() => {
    const active = companions.filter((c) => c.is_active);
    const inactive = companions.filter((c) => !c.is_active);
    return [...active, ...inactive];
  }, [companions]);

  const defaultPrimarySlug = useMemo(() => {
    if (initialSlug) return initialSlug;
    if (activeEditorDraft?.slug && activeEditorDraft.id !== '__new__') {
      return activeEditorDraft.slug;
    }
    return orderedCompanions[0]?.slug || ASTRA_MOON_BENCHMARK_SLUG;
  }, [activeEditorDraft, initialSlug, orderedCompanions]);

  const [primarySlug, setPrimarySlug] = useState<string>(defaultPrimarySlug);
  const [targetStage, setTargetStage] = useState<'draft' | 'published'>('draft');
  const [useUnsavedEditorDraft, setUseUnsavedEditorDraft] = useState<boolean>(true);

  const [compareMode, setCompareMode] = useState<
    'off' | 'draft_vs_published' | 'vs_astra_moon' | 'vs_other'
  >('off');
  const [compareOtherSlug, setCompareOtherSlug] = useState<string>(
    orderedCompanions[1]?.slug || orderedCompanions[0]?.slug || ASTRA_MOON_BENCHMARK_SLUG
  );

  // Simulated User & Living Context
  const [hasBirthChart, setHasBirthChart] = useState<boolean>(true);
  const [sampleChartKey, setSampleChartKey] = useState<'aarav_vedic' | 'maya_western'>(
    'aarav_vedic'
  );
  const [preferredCallName, setPreferredCallName] = useState<string>('Aarav');
  const [careerRole, setCareerRole] = useState<string>('Senior Product Designer');
  const [relationshipStatus, setRelationshipStatus] = useState<string>('dating_committed');
  const [stressAreas, setStressAreas] = useState<string[]>([
    'Work-life balance',
    'Career crossroads',
  ]);
  const [practicalNotes, setPracticalNotes] = useState<string>('');
  const [bondTurns, setBondTurns] = useState<number>(6);
  const [bondMemory, setBondMemory] = useState<string>('');

  // Runtime Controls
  const [paceCue, setPaceCue] = useState<CompanionChatCue>('natural');
  const [chatStyleOverride, setChatStyleOverride] = useState<string>('default');
  const [languageSlug, setLanguageSlug] = useState<string>('English');
  const [timePreset, setTimePreset] = useState<string>('evening');

  // Conversation State
  const [promptInput, setPromptInput] = useState<string>('');
  const [turns, setTurns] = useState<StudioTurnEntry[]>([]);
  const [runningMode, setRunningMode] = useState<'live' | 'inspect' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inspector State
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(true);
  const [inspectedTurnId, setInspectedTurnId] = useState<string | null>(null);
  const [inspectedSide, setInspectedSide] = useState<'primary' | 'comparison'>('primary');
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({});
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

  useEffect(() => {
    if (initialSlug) {
      setPrimarySlug(initialSlug);
    }
  }, [initialSlug]);

  const primaryRosterMeta = useMemo(
    () => companions.find((c) => c.slug === primarySlug) || null,
    [companions, primarySlug]
  );

  const canAttachEditorDraft = Boolean(
    activeEditorDraft &&
      activeEditorDraft.id !== '__new__' &&
      activeEditorDraft.slug === primarySlug
  );

  const companionSelectOptions = useMemo(
    () => [
      ...orderedCompanions.map((c) => ({
        value: c.slug,
        label: `${c.name} — ${c.primary_expertise}${!c.is_active ? ' (Hidden)' : ''}${c.has_unpublished_draft ? ' (Draft)' : ''}`,
      })),
      {
        value: ASTRA_MOON_BENCHMARK_SLUG,
        label: 'Astra Moon (Benchmark · Modern Astrologer)',
      },
    ],
    [orderedCompanions]
  );

  const localHourValue = useMemo(() => {
    if (timePreset === 'morning') return 8;
    if (timePreset === 'afternoon') return 14;
    if (timePreset === 'evening') return 19;
    if (timePreset === 'late_night') return 23;
    return null;
  }, [timePreset]);

  const toggleStressTheme = (theme: string) => {
    setStressAreas((prev) =>
      prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme].slice(0, 6)
    );
  };

  const handleResetSession = () => {
    setTurns([]);
    setInspectedTurnId(null);
    setErrorMsg(null);
  };

  const runTestTurn = async (runLiveModel: boolean, overridePrompt?: string) => {
    const trimmedPrompt = (overridePrompt ?? promptInput).trim();
    if (!trimmedPrompt || runningMode) return;

    setRunningMode(runLiveModel ? 'live' : 'inspect');
    setErrorMsg(null);

    try {
      const historyMessages = turns.flatMap((t) => {
        const out: Array<{ role: 'user' | 'assistant'; content: string }> = [
          { role: 'user', content: t.userPrompt },
        ];
        const assistantReply = t.primary.parsedReply?.cleanedText || t.primary.replyText || '';
        if (assistantReply) {
          out.push({ role: 'assistant', content: assistantReply });
        }
        return out;
      });

      const messages = [...historyMessages, { role: 'user' as const, content: trimmedPrompt }];

      let compareWithStageOrSlug: string | null = null;
      if (compareMode === 'draft_vs_published') {
        compareWithStageOrSlug = targetStage === 'draft' ? 'published' : 'draft';
      } else if (compareMode === 'vs_astra_moon') {
        compareWithStageOrSlug = ASTRA_MOON_BENCHMARK_SLUG;
      } else if (compareMode === 'vs_other' && compareOtherSlug) {
        compareWithStageOrSlug = compareOtherSlug;
      }

      const token = await getAccessToken();
      const res = await fetch('/api/admin/companions/test-turn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slug: primarySlug,
          targetStage: primarySlug === ASTRA_MOON_BENCHMARK_SLUG ? 'published' : targetStage,
          draftOverride:
            targetStage === 'draft' && canAttachEditorDraft && useUnsavedEditorDraft
              ? activeEditorDraft
              : null,
          messages,
          compareWithStageOrSlug,
          runLiveModel,
          simulation: {
            hasBirthChart,
            sampleChartKey,
            preferredCallName: preferredCallName.trim() || null,
            companionChatMode: paceCue,
            chatStyleOverride: chatStyleOverride === 'default' ? null : chatStyleOverride,
            languageSlug,
            clientLocalHour: localHourValue,
            livingContext: {
              career_role: careerRole.trim(),
              relationship_status: relationshipStatus,
              core_stress_areas: stressAreas,
              practical_notes: practicalNotes.trim(),
            },
            bond: {
              total_turns: Math.max(0, Number(bondTurns) || 0),
              memory_summary: bondMemory.trim() || null,
            },
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to execute companion test turn.');
      }

      const entryId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const entry: StudioTurnEntry = {
        id: entryId,
        userPrompt: trimmedPrompt,
        mode: runLiveModel ? 'live' : 'inspect',
        primaryStage: data.primaryStage,
        primary: data.primary as SandboxResult,
        comparison: data.comparison || null,
      };

      setTurns((prev) => [...prev, entry]);
      setInspectedTurnId(entryId);
      setInspectedSide('primary');
      if (!overridePrompt) setPromptInput('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to execute test turn');
    } finally {
      setRunningMode(null);
    }
  };

  const inspectedTurn = useMemo(
    () => turns.find((t) => t.id === inspectedTurnId) || turns[turns.length - 1] || null,
    [inspectedTurnId, turns]
  );

  const inspectedResult: SandboxResult | null = useMemo(() => {
    if (!inspectedTurn) return null;
    if (inspectedSide === 'comparison' && inspectedTurn.comparison) {
      return inspectedTurn.comparison.result;
    }
    return inspectedTurn.primary;
  }, [inspectedSide, inspectedTurn]);

  const handleCopyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPrompt(true);
      window.setTimeout(() => setCopiedPrompt(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const renderReplyContent = (result: SandboxResult, meta?: AdminCompanionRosterSummary | null) => {
    if (result.liveModelError) {
      return (
        <div className="rounded-2xl border border-[#B8965A]/40 bg-[#B8965A]/10 px-3.5 py-2.5 text-xs text-[#5C5449]">
          <p className="font-semibold text-[#3D3830]">Prompt Assembled · Live Model Unavailable</p>
          <p className="mt-1 leading-relaxed">{result.liveModelError}</p>
        </div>
      );
    }
    if (!result.replyText) {
      return (
        <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] px-3.5 py-2.5 text-xs text-[#5C5449]">
          Prompt inspection complete — {result.assemblyManifest.totalEstimatedTokens} estimated tokens across {result.assemblyManifest.layersLoaded.length} layers. Click Send Live Turn to generate a model reply.
        </div>
      );
    }

    const bubbles =
      result.parsedReply?.bubbles && result.parsedReply.bubbles.length > 0
        ? result.parsedReply.bubbles
        : [result.replyText];
    const referral = result.parsedReply?.referral || null;

    return (
      <div className="space-y-2.5">
        {result.chatStyle === 'chat_bubbles' ? (
          <div className="flex items-start gap-2.5">
            <CompanionAvatar
              name={result.companionName}
              avatarUrl={meta?.avatar_url}
              palette={meta?.monogram_palette}
              size="xs"
              shape="circle"
              className="mt-1"
            />
            <div className="space-y-1.5 flex-1 min-w-0">
              {bubbles.map((bubble, idx) => (
                <div
                  key={idx}
                  className="w-fit max-w-full rounded-2xl rounded-tl-sm border border-[#3D3830]/12 bg-[#FDFBF7] px-3.5 py-2 text-[13px] leading-relaxed text-[#3D3830] shadow-2xs prose prose-sm max-w-none"
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{bubble}</ReactMarkdown>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] px-4 py-3 text-[13px] leading-relaxed text-[#3D3830] prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {result.parsedReply?.cleanedText || result.replyText}
            </ReactMarkdown>
          </div>
        )}

        {result.tarotSpread?.cards && result.tarotSpread.cards.length > 0 && (
          <div className="rounded-xl border border-[#B8965A]/30 bg-[#FAF7F2] px-3 py-2 text-[11px] text-[#5C5449]">
            <span className="font-semibold text-[#3D3830]">Tarot Spread Drawn: </span>
            {result.tarotSpread.cards
              .map((c) => `${c.position}: ${c.name}${c.reversed ? ' (Rev.)' : ''}`)
              .join(' · ')}
          </div>
        )}

        {referral && (
          <div className="rounded-xl border border-[#2D6A4F]/25 bg-[#2D6A4F]/8 px-3 py-2 text-[11px] text-[#2D6A4F]">
            <span className="font-semibold">Warm Referral Parsed: </span>
            {referral.name} ({referral.slug}) — {referral.reason}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums text-[#8B8275]">
          <span>{result.modelUsed}</span>
          <span aria-hidden="true">·</span>
          <span>{result.chatStyle}</span>
          {typeof result.latencyMs === 'number' && (
            <>
              <span aria-hidden="true">·</span>
              <span>{result.latencyMs}ms</span>
            </>
          )}
          {result.usage && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {result.usage.promptTokens} in / {result.usage.completionTokens} out
              </span>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* LEFT SIMULATION CONTROLS */}
      <aside className="xl:col-span-4 rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 sm:p-5 space-y-5">
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#3D3830]/10">
          <div>
            <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
              Testing &amp; Comparison Studio
            </h3>
            <p className="text-[11px] text-[#5C5449] mt-0.5">
              Zero DB writes · Zero credit charges · Full 6-layer manifest inspection.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setInspectorOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-2.5 py-1 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer whitespace-nowrap shrink-0"
          >
            <Layers className="h-3 w-3" />
            <span>{inspectorOpen ? 'Hide Inspector' : 'Show Inspector'}</span>
          </button>
        </div>

        {/* Companion & Stage */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-[#5C5449]">
              Primary Companion
            </label>
            <CustomSelect
              value={primarySlug}
              onChange={(val) => {
                setPrimarySlug(val);
                handleResetSession();
              }}
              ariaLabel="Select companion to test"
              surface="elevated"
              size="sm"
              className="w-full"
              options={companionSelectOptions}
            />
          </div>

          {primarySlug !== ASTRA_MOON_BENCHMARK_SLUG && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1 rounded-xl bg-[#F1ECE3] p-1">
                <button
                  type="button"
                  onClick={() => setTargetStage('draft')}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    targetStage === 'draft'
                      ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                      : 'text-[#5C5449] hover:text-[#3D3830]'
                  }`}
                >
                  Test Draft
                </button>
                <button
                  type="button"
                  onClick={() => setTargetStage('published')}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    targetStage === 'published'
                      ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                      : 'text-[#5C5449] hover:text-[#3D3830]'
                  }`}
                >
                  Test Published
                </button>
              </div>
              {primaryRosterMeta?.has_unpublished_draft && (
                <span className="font-mono text-[11px] text-[#8B7355]">
                  Staged draft available
                </span>
              )}
            </div>
          )}

          {canAttachEditorDraft && targetStage === 'draft' && (
            <label className="flex items-center gap-2 rounded-xl border border-[#B8965A]/30 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830] cursor-pointer">
              <input
                type="checkbox"
                checked={useUnsavedEditorDraft}
                onChange={(e) => setUseUnsavedEditorDraft(e.target.checked)}
                className="accent-[#4A453D]"
              />
              <span>Include unsaved in-memory editor changes</span>
            </label>
          )}
        </div>

        {/* Comparison Mode */}
        <div className="space-y-2.5 pt-3 border-t border-[#3D3830]/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#5C5449]">
              Side-by-Side Comparison
            </span>
            <ArrowLeftRight className="h-3.5 w-3.5 text-[#8B8275]" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                { key: 'off', label: 'Single View' },
                { key: 'draft_vs_published', label: 'Draft vs Live' },
                { key: 'vs_astra_moon', label: 'vs Astra Moon' },
                { key: 'vs_other', label: 'vs Companion' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setCompareMode(opt.key)}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  compareMode === opt.key
                    ? 'border-[#4A453D] bg-[#4A453D] text-[#FAF7F2]'
                    : 'border-[#3D3830]/12 bg-[#FAF7F2] text-[#5C5449] hover:text-[#3D3830]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {compareMode === 'vs_other' && (
            <CustomSelect
              value={compareOtherSlug}
              onChange={setCompareOtherSlug}
              ariaLabel="Select second companion to compare"
              surface="elevated"
              size="sm"
              className="w-full"
              options={companionSelectOptions}
            />
          )}
        </div>

        {/* User Profile & Chart Simulation */}
        <div className="space-y-3 pt-3 border-t border-[#3D3830]/10">
          <span className="block text-[11px] font-medium text-[#5C5449]">
            Simulated User &amp; Chart State
          </span>
          <div className="inline-flex w-full rounded-xl bg-[#F1ECE3] p-1">
            <button
              type="button"
              onClick={() => setHasBirthChart(false)}
              className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                !hasBirthChart
                  ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                  : 'text-[#5C5449] hover:text-[#3D3830]'
              }`}
            >
              Chartless User
            </button>
            <button
              type="button"
              onClick={() => setHasBirthChart(true)}
              className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                hasBirthChart
                  ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                  : 'text-[#5C5449] hover:text-[#3D3830]'
              }`}
            >
              Has Birth Chart
            </button>
          </div>

          {hasBirthChart && (
            <CustomSelect
              value={sampleChartKey}
              onChange={(val) => setSampleChartKey(val as 'aarav_vedic' | 'maya_western')}
              ariaLabel="Sample chart profile"
              surface="elevated"
              size="sm"
              className="w-full"
              options={[
                { value: 'aarav_vedic', label: 'Sample Chart · Aarav (Vedic + Dasha)' },
                { value: 'maya_western', label: 'Sample Chart · Maya (Western Tropical)' },
              ]}
            />
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-[#8B8275] mb-1">Call Name</label>
              <input
                type="text"
                value={preferredCallName}
                onChange={(e) => setPreferredCallName(e.target.value)}
                placeholder="Alex"
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-2.5 py-1.5 text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#8B8275] mb-1">Career Role</label>
              <input
                type="text"
                value={careerRole}
                onChange={(e) => setCareerRole(e.target.value)}
                placeholder="Product Designer"
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-2.5 py-1.5 text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-[#8B8275] mb-1">Relationship</label>
              <CustomSelect
                value={relationshipStatus}
                onChange={setRelationshipStatus}
                ariaLabel="Simulated relationship status"
                surface="elevated"
                size="sm"
                className="w-full"
                options={[
                  { value: 'single', label: 'Single' },
                  { value: 'dating_committed', label: 'Dating / Committed' },
                  { value: 'engaged', label: 'Engaged' },
                  { value: 'married_no_children', label: 'Married (No Children)' },
                  { value: 'married_with_children', label: 'Married (With Children)' },
                  { value: 'divorced_separated', label: 'Divorced / Separated' },
                ]}
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#8B8275] mb-1">
                Bond Familiarity (Turns)
              </label>
              <input
                type="number"
                min={0}
                max={300}
                value={bondTurns}
                onChange={(e) => setBondTurns(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <span className="block text-[11px] text-[#8B8275] mb-1.5">
              Simulated Stress / Life Themes
            </span>
            <div className="flex flex-wrap gap-1.5">
              {STRESS_THEME_PRESETS.map((theme) => {
                const active = stressAreas.includes(theme);
                return (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => toggleStressTheme(theme)}
                    className={`rounded-lg px-2 py-1 text-[11px] border transition-colors cursor-pointer ${
                      active
                        ? 'border-[#4A453D] bg-[#4A453D] text-[#FAF7F2]'
                        : 'border-[#3D3830]/12 bg-[#FAF7F2] text-[#5C5449] hover:text-[#3D3830]'
                    }`}
                  >
                    {theme}
                  </button>
                );
              })}
            </div>
          </div>

          <input
            type="text"
            value={bondMemory}
            onChange={(e) => setBondMemory(e.target.value)}
            placeholder="Optional simulated memory summary (e.g. Prepping for Friday review)..."
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-2.5 py-1.5 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#3D3830]/40 focus:outline-none"
          />
          <input
            type="text"
            value={practicalNotes}
            onChange={(e) => setPracticalNotes(e.target.value)}
            placeholder="Optional deep practical note..."
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-2.5 py-1.5 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#3D3830]/40 focus:outline-none"
          />
        </div>

        {/* Turn Controls */}
        <div className="space-y-3 pt-3 border-t border-[#3D3830]/10">
          <span className="block text-[11px] font-medium text-[#5C5449]">
            Turn Pace, Style &amp; Environment
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { key: 'natural', label: 'Natural' },
                { key: 'just_listen', label: 'Just Listen' },
                { key: 'help_think', label: 'Help Think' },
              ] as const
            ).map((cue) => (
              <button
                key={cue.key}
                type="button"
                onClick={() => setPaceCue(cue.key)}
                className={`rounded-xl px-2 py-1.5 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  paceCue === cue.key
                    ? 'border-[#4A453D] bg-[#4A453D] text-[#FAF7F2]'
                    : 'border-[#3D3830]/12 bg-[#FAF7F2] text-[#5C5449] hover:text-[#3D3830]'
                }`}
              >
                {cue.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] text-[#8B8275] mb-1">Style</label>
              <CustomSelect
                value={chatStyleOverride}
                onChange={setChatStyleOverride}
                ariaLabel="Override chat style"
                surface="elevated"
                size="sm"
                className="w-full"
                options={[
                  { value: 'default', label: 'Default' },
                  ...CHAT_STYLE_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
                ]}
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#8B8275] mb-1">Time</label>
              <CustomSelect
                value={timePreset}
                onChange={setTimePreset}
                ariaLabel="Simulated local hour"
                surface="elevated"
                size="sm"
                className="w-full"
                options={[
                  { value: 'morning', label: 'Morning' },
                  { value: 'afternoon', label: 'Afternoon' },
                  { value: 'evening', label: 'Evening' },
                  { value: 'late_night', label: 'Late Night' },
                ]}
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#8B8275] mb-1">Language</label>
              <CustomSelect
                value={languageSlug}
                onChange={setLanguageSlug}
                ariaLabel="Conversation language"
                surface="elevated"
                size="sm"
                className="w-full"
                options={[
                  { value: 'English', label: 'English' },
                  { value: 'Hinglish', label: 'Hinglish' },
                  { value: 'Hindi', label: 'Hindi' },
                  { value: 'Spanish', label: 'Spanish' },
                  { value: 'French', label: 'French' },
                ]}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* CENTER CONVERSATION & COMPARISON CANVAS */}
      <div
        className={`${
          inspectorOpen ? 'xl:col-span-5' : 'xl:col-span-8'
        } space-y-4 min-w-0`}
      >
        <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] overflow-hidden flex flex-col min-h-[620px]">
          {/* Sandbox Header */}
          <div className="px-5 py-3.5 border-b border-[#3D3830]/10 bg-[#FAF7F2]/75 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <CompanionAvatar
                name={primaryRosterMeta?.name || 'Astra Moon'}
                avatarUrl={primaryRosterMeta?.avatar_url}
                palette={primaryRosterMeta?.monogram_palette}
                size="sm"
                shape="circle"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#3D3830] truncate">
                  {primarySlug === ASTRA_MOON_BENCHMARK_SLUG
                    ? 'Astra Moon (Benchmark)'
                    : primaryRosterMeta?.name || primarySlug}
                </p>
                <p className="text-[11px] text-[#8B8275] truncate">
                  {targetStage === 'draft' ? 'Draft stage' : 'Published stage'}
                  {' · '}
                  {hasBirthChart ? `Chart attached (${sampleChartKey === 'maya_western' ? 'Western' : 'Vedic'})` : 'Chartless user'}
                  {compareMode !== 'off' ? ' · Side-by-side active' : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleResetSession}
              disabled={turns.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Thread</span>
            </button>
          </div>

          {/* Quick Scenario Presets */}
          <div className="px-5 py-2.5 border-b border-[#3D3830]/8 bg-[#F1ECE3]/45 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[#8B8275] mr-1">Scenarios:</span>
            {SCENARIO_PRESETS.map((sc) => (
              <button
                key={sc.label}
                type="button"
                onClick={() => {
                  if (sc.cue) setPaceCue(sc.cue);
                  setPromptInput(sc.prompt);
                }}
                className="rounded-lg border border-[#3D3830]/12 bg-[#FDFBF7] px-2.5 py-1 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:border-[#3D3830]/25 transition-colors cursor-pointer"
              >
                {sc.label}
              </button>
            ))}
          </div>

          {/* Conversation Turns */}
          <div className="flex-1 p-5 space-y-5 overflow-y-auto max-h-[540px] bg-[#FAF7F2]/50">
            {turns.length === 0 ? (
              <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center px-4 space-y-2.5">
                <MessageSquare className="h-7 w-7 text-[#8B7355]/70" />
                <p className="font-['Cormorant_Garamond',serif] text-xl text-[#3D3830]">
                  Test Voice, Gating &amp; Emotional Realism
                </p>
                <p className="text-xs text-[#5C5449] max-w-md leading-relaxed">
                  Pick a scenario preset or type a message below. Run a Dry Inspect to audit the 6-layer prompt assembly and astrology relevance gate instantly, or Send Live Turn for model output.
                </p>
              </div>
            ) : (
              turns.map((turn, idx) => {
                const isInspected = inspectedTurn?.id === turn.id;
                return (
                  <div
                    key={turn.id}
                    className={`space-y-3 pb-4 ${
                      idx < turns.length - 1 ? 'border-b border-[#3D3830]/10' : ''
                    }`}
                  >
                    {/* User bubble */}
                    <div className="flex justify-end items-start gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setInspectedTurnId(turn.id);
                          setInspectedSide('primary');
                        }}
                        className={`rounded-xl px-2 py-1 text-[10px] font-medium border transition-colors cursor-pointer shrink-0 mt-1 ${
                          isInspected
                            ? 'border-[#B8965A] bg-[#B8965A]/15 text-[#3D3830]'
                            : 'border-[#3D3830]/12 bg-[#FDFBF7] text-[#8B8275] hover:text-[#3D3830]'
                        }`}
                      >
                        Inspect Turn {idx + 1}
                      </button>
                      <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-[#4A453D] px-3.5 py-2.5 text-[13px] text-[#FAF7F2] leading-relaxed">
                        {turn.userPrompt}
                      </div>
                    </div>

                    {/* Companion Reply (Single vs Comparison) */}
                    {turn.comparison ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7]/80 p-3 space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-[#5C5449]">
                            <span className="font-semibold text-[#3D3830]">
                              {turn.primary.companionName} ({turn.primaryStage})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setInspectedTurnId(turn.id);
                                setInspectedSide('primary');
                              }}
                              className="text-[#8B7355] hover:underline cursor-pointer"
                            >
                              Manifest
                            </button>
                          </div>
                          {renderReplyContent(turn.primary, primaryRosterMeta)}
                        </div>

                        <div className="rounded-2xl border border-[#B8965A]/30 bg-[#FDFBF7]/80 p-3 space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-[#5C5449]">
                            <span className="font-semibold text-[#3D3830]">
                              {turn.comparison.result.companionName} ({turn.comparison.stage})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setInspectedTurnId(turn.id);
                                setInspectedSide('comparison');
                              }}
                              className="text-[#8B7355] hover:underline cursor-pointer"
                            >
                              Manifest
                            </button>
                          </div>
                          {renderReplyContent(
                            turn.comparison.result,
                            companions.find(
                              (c) => c.slug === turn.comparison?.result.companionSlug
                            ) || null
                          )}
                        </div>
                      </div>
                    ) : (
                      renderReplyContent(turn.primary, primaryRosterMeta)
                    )}
                  </div>
                );
              })
            )}
          </div>

          {errorMsg && (
            <div className="mx-5 mb-2 rounded-xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-3.5 py-2 text-xs text-[#7A3E36]">
              {errorMsg}
            </div>
          )}

          {/* Composer */}
          <div className="p-4 border-t border-[#3D3830]/10 bg-[#FDFBF7] space-y-2.5">
            <textarea
              rows={2}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void runTestTurn(true);
                }
              }}
              placeholder="Write a realistic message to test voice, gating, nuances, and bubbles..."
              className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#3D3830]/40 focus:outline-none resize-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-[#8B8275]">
                Cmd/Ctrl + Enter to send live turn
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!promptInput.trim() || Boolean(runningMode)}
                  onClick={() => void runTestTurn(false)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/18 bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] disabled:opacity-45 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Eye className="h-3.5 w-3.5 text-[#8B7355]" />
                  <span>{runningMode === 'inspect' ? 'Inspecting...' : 'Dry Inspect Prompt'}</span>
                </button>
                <button
                  type="button"
                  disabled={!promptInput.trim() || Boolean(runningMode)}
                  onClick={() => void runTestTurn(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-45 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{runningMode === 'live' ? 'Running...' : 'Send Live Turn'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PROMPT ASSEMBLY & TELEMETRY INSPECTOR */}
      {inspectorOpen && (
        <aside className="xl:col-span-3 rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#3D3830]/10">
            <div>
              <h4 className="font-['Cormorant_Garamond',serif] text-lg font-medium text-[#3D3830]">
                Prompt Inspector
              </h4>
              <p className="text-[11px] text-[#8B8275]">
                Admin-only assembly manifest
              </p>
            </div>
            {inspectedTurn?.comparison && (
              <div className="inline-flex rounded-lg bg-[#F1ECE3] p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setInspectedSide('primary')}
                  className={`rounded-md px-2 py-1 font-medium cursor-pointer ${
                    inspectedSide === 'primary'
                      ? 'bg-[#FDFBF7] text-[#3D3830]'
                      : 'text-[#5C5449]'
                  }`}
                >
                  Primary
                </button>
                <button
                  type="button"
                  onClick={() => setInspectedSide('comparison')}
                  className={`rounded-md px-2 py-1 font-medium cursor-pointer ${
                    inspectedSide === 'comparison'
                      ? 'bg-[#FDFBF7] text-[#3D3830]'
                      : 'text-[#5C5449]'
                  }`}
                >
                  Compare
                </button>
              </div>
            )}
          </div>

          {!inspectedResult ? (
            <div className="py-8 text-center text-xs text-[#8B8275]">
              Run any turn or Dry Inspect to view triggered nuances, astrology gating decisions, and token estimates per layer.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Astrology Gate Decision */}
              <div
                className={`rounded-2xl border p-3 text-xs space-y-1 ${
                  inspectedResult.assemblyManifest.astrologyGateDecision.loaded
                    ? 'border-[#B8965A]/45 bg-[#B8965A]/10 text-[#3D3830]'
                    : 'border-[#2D6A4F]/25 bg-[#2D6A4F]/8 text-[#2D6A4F]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    {inspectedResult.assemblyManifest.astrologyGateDecision.loaded ? (
                      <Flame className="h-3.5 w-3.5 text-[#8B7355]" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {inspectedResult.assemblyManifest.astrologyGateDecision.loaded
                        ? 'Chart / Esoteric Loaded'
                        : 'Astrology Gated Off'}
                    </span>
                  </span>
                  <span className="font-mono text-[10px]">
                    {inspectedResult.assemblyManifest.esotericRelevance}
                  </span>
                </div>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  {inspectedResult.assemblyManifest.astrologyGateDecision.reason}
                </p>
                <p className="font-mono text-[10px] pt-0.5 opacity-80">
                  chart:{String(inspectedResult.assemblyManifest.chartInjected)} · transits:
                  {String(inspectedResult.assemblyManifest.transitsInjected)} · notes:
                  {String(inspectedResult.assemblyManifest.analystNotesInjected)} · tarot:
                  {String(inspectedResult.assemblyManifest.tarotDrawn)}
                </p>
              </div>

              {/* Turn Analysis & Triggered Signals */}
              <div className="space-y-1.5 text-xs text-[#5C5449]">
                <div className="flex items-center justify-between">
                  <span>Total Est. Prompt Tokens</span>
                  <span className="font-mono tabular-nums font-semibold text-[#3D3830]">
                    ~{inspectedResult.assemblyManifest.totalEstimatedTokens} tok
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Core Capsule Active</span>
                  <span className="font-mono tabular-nums text-[#3D3830]">
                    {inspectedResult.assemblyManifest.capsuleApplied
                      ? `Yes (~${inspectedResult.assemblyManifest.capsuleTokens} tok)`
                      : 'Fallback'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Mood / Intent</span>
                  <span className="font-mono text-[11px] text-[#3D3830]">
                    {inspectedResult.assemblyManifest.emotionalWeight} /{' '}
                    {inspectedResult.assemblyManifest.conversationIntent}
                  </span>
                </div>
                {typeof inspectedResult.temperatureUsed === 'number' && (
                  <div className="flex items-center justify-between">
                    <span>Temperature</span>
                    <span className="font-mono tabular-nums text-[#3D3830]">
                      {inspectedResult.temperatureUsed.toFixed(2)}
                    </span>
                  </div>
                )}
                {inspectedResult.assemblyManifest.aiIdentityQuestion && (
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#8B7355] pt-0.5">
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>Honest AI identity directive active</span>
                  </div>
                )}
              </div>

              {/* Nuances & Dialogues Triggered */}
              <div className="space-y-2 pt-2 border-t border-[#3D3830]/10 text-xs">
                <div>
                  <span className="text-[11px] font-medium text-[#5C5449]">
                    Triggered Nuances ({inspectedResult.assemblyManifest.nuancesTriggered.length})
                  </span>
                  {inspectedResult.assemblyManifest.nuancesTriggered.length === 0 ? (
                    <p className="text-[11px] text-[#8B8275] mt-0.5">None matched this turn.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {inspectedResult.assemblyManifest.nuancesTriggered.map((n) => (
                        <li
                          key={n.id}
                          className="text-[11px] text-[#3D3830] flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{n.title}</span>
                          <span className="font-mono text-[10px] text-[#8B8275]">p{n.priority}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <span className="text-[11px] font-medium text-[#5C5449]">
                    Reference Voice Moments ({inspectedResult.assemblyManifest.dialoguesTriggered.length})
                  </span>
                  {inspectedResult.assemblyManifest.dialoguesTriggered.length === 0 ? (
                    <p className="text-[11px] text-[#8B8275] mt-0.5">None loaded.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {inspectedResult.assemblyManifest.dialoguesTriggered.map((d) => (
                        <li key={d.id} className="text-[11px] text-[#3D3830] truncate">
                          · {d.scenario}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Ordered 6-Layer Token Bars */}
              <div className="space-y-2 pt-2 border-t border-[#3D3830]/10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#5C5449]">
                    6-Layer Assembly Breakdown
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyPrompt(inspectedResult.assembledSystemPrompt)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4A453D] hover:underline cursor-pointer"
                  >
                    {copiedPrompt ? (
                      <>
                        <Check className="h-3 w-3 text-[#2D6A4F]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy Full</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-1.5">
                  {inspectedResult.assemblyManifest.orderedSections.map((sec) => {
                    const pct = Math.min(
                      100,
                      Math.max(
                        6,
                        Math.round(
                          (sec.estimatedTokens /
                            Math.max(1, inspectedResult.assemblyManifest.totalEstimatedTokens)) *
                            100
                        )
                      )
                    );
                    const isOpen = Boolean(expandedLayers[sec.key]);
                    return (
                      <div
                        key={sec.key}
                        className="rounded-xl border border-[#3D3830]/10 bg-[#FAF7F2] p-2 space-y-1.5"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedLayers((prev) => ({ ...prev, [sec.key]: !prev[sec.key] }))
                          }
                          className="w-full text-left space-y-1 cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-medium text-[#3D3830] truncate">{sec.label}</span>
                            <span className="font-mono tabular-nums text-[10px] text-[#8B8275] shrink-0">
                              ~{sec.estimatedTokens}t
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-[#EAE3D7] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#B8965A]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </button>
                        {isOpen && (
                          <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-[#1F2229] p-2.5 font-mono text-[10px] leading-relaxed text-[#F4EFE6]">
                            {sec.content}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
};

export default CompanionTestingStudio;
