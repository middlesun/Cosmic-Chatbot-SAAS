import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Flame,
  Headphones,
  HeartHandshake,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Sun,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import CustomSelect from './CustomSelect';
import CompanionAvatar from './CompanionAvatar';
import CompanionDiscoveryControls from './CompanionDiscoveryControls';
import CompanionProfileSheet from './CompanionProfileSheet';
import { PREVIEW_PUBLIC_COMPANIONS } from './previewFixtures';
import {
  matchesCompanionDiscoveryFilter,
  type CompanionArchetypeConfigItem,
  type CompanionArchetypeSlug,
  type CompanionDiscoveryTabId,
  type CompanionPersona,
  type ConversationRecord,
  type PublicCompanionCard,
} from './chatTypes';

export interface CustomCompanionSummary {
  id: string;
  slug: string;
  persona: CompanionPersona;
  last_conversation_id: string | null;
  last_interaction_at: string | null;
  thread_count: number;
}

interface CompanionSetupViewProps {
  variant?: 'chat' | 'page';
  initialArchetype?: CompanionArchetypeSlug | null;
  pastCompanionConversations: ConversationRecord[];
  archetypeConfigs?: CompanionArchetypeConfigItem[];
  companionCatalog?: PublicCompanionCard[];
  isPreviewMode?: boolean;
  getAccessToken: () => Promise<string | null>;
  onSelectPastCompanion: (conversationId: string) => void;
  onStartWithCompanion: (persona: CompanionPersona) => Promise<void>;
  onStartPresetCompanion?: (
    card: PublicCompanionCard,
    options?: { forceNew?: boolean }
  ) => Promise<void>;
  onStartCustomBySlug?: (
    slug: string,
    persona: CompanionPersona,
    options?: { forceNew?: boolean }
  ) => Promise<void>;
  onCatalogLoaded?: (
    cards: PublicCompanionCard[],
    customCompanions?: CustomCompanionSummary[]
  ) => void;
}

// Category filter tabs & matching imported from ./chatTypes to stay consistent with homepage.

interface ArchetypeOption {
  slug: CompanionArchetypeSlug;
  label: string;
  summary: string;
  questionOne?: string;
  questionTwo?: string;
  icon: React.FC<{ className?: string }>;
  isSpiritual?: boolean;
}

const ARCHETYPE_OPTIONS: ArchetypeOption[] = [
  {
    slug: 'find_someone',
    label: 'Find someone',
    summary:
      'Not sure which voice fits yet? Share what is on your mind and meet 4 grounded people.',
    icon: Compass,
  },
  {
    slug: 'friend',
    label: 'Friend',
    summary:
      'Easy, genuine company to talk through your day, bounce a thought around, or feel less alone.',
    icon: MessageCircle,
  },
  {
    slug: 'listener',
    label: 'Listener',
    summary:
      'Unhurried, judgment-free space to vent, slow down, and be heard without rushing to fix.',
    icon: Headphones,
  },
  {
    slug: 'motivator',
    label: 'Motivator',
    summary: 'Steady encouragement and realistic momentum when energy or confidence feels low.',
    icon: Flame,
  },
  {
    slug: 'life_coach',
    label: 'Life coach',
    summary:
      'Clear-eyed accountability and honest pushback when you want real traction on a choice.',
    icon: HeartHandshake,
  },
  {
    slug: 'spiritual_guide',
    label: 'Spiritual guide',
    summary:
      'Reflective philosophical and spiritual companionship attuned to your faith and depth.',
    icon: Sun,
    isSpiritual: true,
  },
];

const PRIMARY_RELIGION_OPTIONS = [
  { value: 'Spiritual but not religious', label: 'Spiritual, not religious' },
  { value: 'Hinduism / Sanatana Dharma', label: 'Hinduism / Sanatana Dharma' },
  { value: 'Buddhism', label: 'Buddhism' },
  { value: 'Christianity', label: 'Christianity' },
  { value: 'Islam', label: 'Islam' },
  { value: 'Sikhism', label: 'Sikhism' },
  { value: 'Jainism', label: 'Jainism' },
  { value: 'Judaism', label: 'Judaism' },
  { value: 'Taoism / Zen', label: 'Taoism / Zen' },
  { value: 'New Age / Universal Spirituality', label: 'New Age / Universal' },
  { value: 'Secular / Philosophical', label: 'Secular / Philosophical' },
  { value: 'Open / Exploring', label: 'Open / Exploring' },
];

const SECONDARY_RELIGION_OPTIONS = [
  { value: 'None', label: 'None / Keep it simple' },
  { value: 'Advaita Vedanta', label: 'Advaita Vedanta' },
  { value: 'Buddhism / Mindfulness', label: 'Buddhism / Mindfulness' },
  { value: 'Stoicism', label: 'Stoicism' },
  { value: 'Sufism', label: 'Sufism' },
  { value: 'Yoga & Gita Philosophy', label: 'Yoga & Gita Philosophy' },
  { value: 'Taoism', label: 'Taoism' },
  { value: 'Christian Mysticism', label: 'Christian Mysticism' },
  { value: 'Bhakti Tradition', label: 'Bhakti Tradition' },
  { value: 'Existentialism', label: 'Existentialism' },
  { value: 'Universal Humanism', label: 'Universal Humanism' },
];

const PREVIEW_MATCHES: CompanionPersona[] = [
  {
    id: 'prev-m-1',
    name: 'Nadia',
    age: 31,
    gender: 'F',
    companion_type: 'find_someone',
    role_label: 'Thoughtful Confidante',
    background: 'Architectural lighting designer · Calm, observant, sharp dry humor',
    tagline: 'Sees through noise quickly without making you feel judged.',
    bio: 'Nadia spent years renovating old libraries and has a habit of noticing the quiet details most people rush past. She listens closely, asks the one question you have been avoiding, and keeps things grounded.',
    conversation_style: 'Warm, observant, gently candid when you are overthinking',
    opening_message:
      'Hey — glad you dropped in. No need to package it neatly; what has been sitting in the back of your head today?',
    system_prompt: '',
    chat_style: 'chat_bubbles',
  },
  {
    id: 'prev-m-2',
    name: 'Devansh',
    age: 34,
    gender: 'M',
    companion_type: 'find_someone',
    role_label: 'Grounded Straight-Talker',
    background: 'Former culinary instructor · Practical, warm, unhurried',
    tagline: 'Steady energy when your head feels loud.',
    bio: 'Devansh left high-pressure kitchens to teach small cooking classes and rebuild a slower pace of life. He has zero patience for performative pep talks, but he will sit with you until the real next step shows up.',
    conversation_style: 'Steady, down-to-earth, playfully direct',
    opening_message: 'Hey there. Take a breath — what are we untangling today?',
    system_prompt: '',
    chat_style: 'chat_bubbles',
  },
  {
    id: 'prev-m-3',
    name: 'Claire',
    age: 28,
    gender: 'F',
    companion_type: 'find_someone',
    role_label: 'Warm Everyday Companion',
    background: 'Bookshop buyer & weekend potter · Curious, empathetic, sincere',
    tagline: 'Easy to talk to when you just want real company.',
    bio: 'Claire reads too many biographies and believes half of life is having someone steady to bounce half-formed thoughts off of. She brings genuine warmth without sounding scripted.',
    conversation_style: 'Conversational, curious, emotionally attuned',
    opening_message:
      'Hi! Pull up a chair — is today one of those days where you want to talk something through, or just decompress?',
    system_prompt: '',
    chat_style: 'chat_bubbles',
  },
  {
    id: 'prev-m-4',
    name: 'Arjun',
    age: 37,
    gender: 'M',
    companion_type: 'find_someone',
    role_label: 'Perspective Builder',
    background: 'Urban planner & marathon runner · Patient, structured, sincere',
    tagline: 'Helps turn tangled thoughts into calm perspective.',
    bio: 'Arjun spends his days figuring out how cities flow and his mornings running quiet routes before sunrise. He is patient with uncertainty and gently nudges you when it is time to stop circling.',
    conversation_style: 'Measured, encouraging, thoughtfully challenging',
    opening_message:
      'Hey — good to meet you. Tell me a little about what has been occupying your mind lately.',
    system_prompt: '',
    chat_style: 'chat_bubbles',
  },
];

const getReligiousnessCaption = (score: number): string => {
  if (score <= 2) return 'Philosophical / Secular';
  if (score <= 4) return 'Quietly Reflective';
  if (score <= 6) return 'Balanced & Open';
  if (score <= 8) return 'Rooted in Practice';
  return 'Deeply Devout';
};

const CompanionSetupView: React.FC<CompanionSetupViewProps> = ({
  variant = 'chat',
  initialArchetype = null,
  pastCompanionConversations,
  archetypeConfigs,
  companionCatalog,
  isPreviewMode = false,
  getAccessToken,
  onSelectPastCompanion,
  onStartWithCompanion,
  onStartPresetCompanion,
  onStartCustomBySlug,
  onCatalogLoaded,
}) => {
  const [selectedType, setSelectedType] = useState<CompanionArchetypeSlug | null>(
    initialArchetype
  );
  const [step, setStep] = useState<'hub' | 'pick_type' | 'intake' | 'matching' | 'results'>(
    initialArchetype ? 'intake' : 'hub'
  );

  // Preset hub catalog + saved custom companions
  const [presets, setPresets] = useState<PublicCompanionCard[]>(() =>
    companionCatalog && companionCatalog.length > 0
      ? companionCatalog
      : isPreviewMode
      ? PREVIEW_PUBLIC_COMPANIONS
      : []
  );
  const [customCompanions, setCustomCompanions] = useState<CustomCompanionSummary[]>([]);
  const [loadingHub, setLoadingHub] = useState<boolean>(
    !isPreviewMode && (!companionCatalog || companionCatalog.length === 0)
  );
  const [activeGroup, setActiveGroup] = useState<CompanionDiscoveryTabId>('all');
  const [activeSituationChip, setActiveSituationChip] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sheetCompanion, setSheetCompanion] = useState<PublicCompanionCard | null>(null);

  // Standard 2-question intake
  const [topic, setTopic] = useState('');
  const [preference, setPreference] = useState('');

  // Spiritual guide intake
  const [religiousness, setReligiousness] = useState<number>(5);
  const [primaryReligion, setPrimaryReligion] = useState<string>('Spiritual but not religious');
  const [secondaryReligion, setSecondaryReligion] = useState<string>('None');

  // Matched 4 personas (2F + 2M)
  const [matches, setMatches] = useState<CompanionPersona[]>([]);
  const [seenNames, setSeenNames] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [confirmRemoveCustomSlug, setConfirmRemoveCustomSlug] = useState<string | null>(null);
  const [removingCustomSlug, setRemovingCustomSlug] = useState<string | null>(null);

  useEffect(() => {
    if (companionCatalog && companionCatalog.length > 0) {
      setPresets(companionCatalog);
      setLoadingHub(false);
    }
  }, [companionCatalog]);

  useEffect(() => {
    if (isPreviewMode) {
      setPresets(PREVIEW_PUBLIC_COMPANIONS);
      setLoadingHub(false);
      return;
    }

    let cancelled = false;
    const loadCatalog = async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) {
          setLoadingHub(false);
          return;
        }
        const res = await fetch('/api/chat/companions', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) {
          setLoadingHub(false);
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const loadedCards = Array.isArray(data.companions)
          ? (data.companions as PublicCompanionCard[])
          : [];
        const loadedCustom = Array.isArray(data.customCompanions)
          ? (data.customCompanions as CustomCompanionSummary[])
          : [];
        if (loadedCards.length > 0) {
          setPresets(loadedCards);
        }
        setCustomCompanions(loadedCustom);
        onCatalogLoaded?.(loadedCards, loadedCustom);
      } catch {
        // Keep whatever catalog was hydrated
      } finally {
        if (!cancelled) setLoadingHub(false);
      }
    };

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, isPreviewMode]);

  const resolvedArchetypeOptions = useMemo(() => {
    if (!archetypeConfigs || archetypeConfigs.length === 0) return ARCHETYPE_OPTIONS;
    const bySlug = new Map(archetypeConfigs.map((a) => [a.slug, a]));
    return ARCHETYPE_OPTIONS.map((opt) => {
      const ov = bySlug.get(opt.slug);
      if (!ov) return opt;
      return {
        ...opt,
        label: ov.label?.trim() || opt.label,
        summary: ov.shortDesc?.trim() || opt.summary,
        questionOne: ov.questionOne?.trim() || undefined,
        questionTwo: ov.questionTwo?.trim() || undefined,
      };
    });
  }, [archetypeConfigs]);

  const activeArchetypeMeta = useMemo(
    () =>
      resolvedArchetypeOptions.find((a) => a.slug === selectedType) ||
      resolvedArchetypeOptions[0],
    [resolvedArchetypeOptions, selectedType]
  );

  // Merge live thread counts from pastCompanionConversations for snappy UI updates
  const enrichedPresets = useMemo(() => {
    if (pastCompanionConversations.length === 0) return presets;
    const bySlug = new Map<string, ConversationRecord>();
    for (const conv of pastCompanionConversations) {
      const slug = conv.companion_slug || conv.companion_persona_json?.slug;
      if (slug && !bySlug.has(slug)) {
        bySlug.set(slug, conv);
      }
    }
    return presets.map((card) => {
      const localLatest = bySlug.get(card.slug);
      if (!localLatest) return card;
      return {
        ...card,
        last_conversation_id: card.last_conversation_id || localLatest.id,
        last_interaction_at: card.last_interaction_at || localLatest.updated_at,
      };
    });
  }, [presets, pastCompanionConversations]);

  const filteredPresets = useMemo(
    () =>
      enrichedPresets.filter((c) =>
        matchesCompanionDiscoveryFilter(c, {
          groupTab: activeGroup,
          situationChipId: activeSituationChip,
          searchQuery,
        })
      ),
    [enrichedPresets, activeGroup, activeSituationChip, searchQuery]
  );

  const isDefaultDirectoryView =
    activeGroup === 'all' && !activeSituationChip && !searchQuery.trim();

  const handleChooseArchetype = (slug: CompanionArchetypeSlug) => {
    setSelectedType(slug);
    setErrorMsg(null);
    setStep('intake');
  };

  const runMatching = async (refreshOnly = false) => {
    const chosenType = selectedType || 'find_someone';
    setErrorMsg(null);
    setStep('matching');

    const excludeNames = refreshOnly
      ? Array.from(new Set([...seenNames, ...matches.map((m) => m.name)]))
      : [];

    if (isPreviewMode) {
      window.setTimeout(() => {
        const previewSet = PREVIEW_MATCHES.map((m) => ({
          ...m,
          companion_type: chosenType,
          topic_context: topic.trim() || undefined,
        }));
        setMatches(previewSet);
        setSeenNames(previewSet.map((m) => m.name));
        setStep('results');
      }, 850);
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        setErrorMsg('Please sign in to match with a companion.');
        setStep('intake');
        return;
      }

      const res = await fetch('/api/chat/companions/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companionType: chosenType,
          topic: topic.trim(),
          preference: preference.trim(),
          religiousness: chosenType === 'spiritual_guide' ? religiousness : undefined,
          primaryReligion: chosenType === 'spiritual_guide' ? primaryReligion : undefined,
          secondaryReligion:
            chosenType === 'spiritual_guide' && secondaryReligion !== 'None'
              ? secondaryReligion
              : undefined,
          excludeNames,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.companions) || data.companions.length === 0) {
        throw new Error(data.error || 'Could not find companion matches right now.');
      }

      const generated = data.companions as CompanionPersona[];
      setMatches(generated);
      setSeenNames((prev) =>
        Array.from(new Set([...prev, ...generated.map((g) => g.name)]))
      );
      setStep('results');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Matching interrupted.');
      setStep('intake');
    }
  };

  const handleSelectPersona = async (persona: CompanionPersona) => {
    if (startingId) return;
    setStartingId(persona.id);
    setErrorMsg(null);
    try {
      await onStartWithCompanion(persona);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to start conversation.');
    } finally {
      setStartingId(null);
    }
  };

  const handleStartPreset = async (
    card: PublicCompanionCard,
    options?: { forceNew?: boolean }
  ) => {
    if (startingId) return;
    setStartingId(card.slug);
    setErrorMsg(null);
    try {
      if (onStartPresetCompanion) {
        await onStartPresetCompanion(card, options);
      } else {
        await onStartWithCompanion({
          id: card.id,
          slug: card.slug,
          name: card.name,
          age: card.age,
          gender: card.sex,
          companion_type: 'friend',
          role_label: card.primary_expertise,
          background: card.short_bio,
          tagline: card.tagline,
          bio: card.full_bio || card.short_bio,
          conversation_style: 'Natural human texting',
          opening_message: `Hey — I’m ${card.name}. What’s on your mind right now?`,
          system_prompt: '',
          avatar_url: card.avatar_url,
          monogram_palette: card.monogram_palette,
          chat_style: card.chat_style,
          skill_level: card.skill_level,
          tts_voice_profile: card.tts_voice_profile,
          supports_listening_cue: card.supports_listening_cue,
        });
      }
      setSheetCompanion(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to start conversation.');
    } finally {
      setStartingId(null);
    }
  };

  const handleResumeCustom = async (
    item: CustomCompanionSummary,
    options?: { forceNew?: boolean }
  ) => {
    if (startingId) return;
    setStartingId(item.slug);
    setErrorMsg(null);
    try {
      if (!options?.forceNew && item.last_conversation_id) {
        onSelectPastCompanion(item.last_conversation_id);
        return;
      }
      if (onStartCustomBySlug) {
        await onStartCustomBySlug(item.slug, item.persona, options);
      } else {
        await onStartWithCompanion(item.persona);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to open companion.');
    } finally {
      setStartingId(null);
    }
  };

  const handleRemoveCustom = async (slug: string) => {
    if (removingCustomSlug) return;
    setRemovingCustomSlug(slug);
    setErrorMsg(null);
    try {
      if (!isPreviewMode) {
        const token = await getAccessToken();
        if (!token) throw new Error('Please sign in again.');
        const res = await fetch(
          `/api/chat/companions/custom/${encodeURIComponent(slug)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || 'Could not remove companion.');
        }
      }
      const nextCustom = customCompanions.filter((c) => c.slug !== slug);
      setCustomCompanions(nextCustom);
      setConfirmRemoveCustomSlug(null);
      onCatalogLoaded?.(presets, nextCustom);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not remove companion.');
    } finally {
      setRemovingCustomSlug(null);
    }
  };

  return (
    <div
      className={
        variant === 'page'
          ? 'w-full pb-8'
          : 'flex-1 overflow-y-auto px-4 sm:px-6 md:px-10 pt-6 pb-40'
      }
    >
      <div className={variant === 'page' ? 'mx-auto max-w-5xl' : 'mx-auto max-w-4xl'}>
        {/* HUB: Preset Companion Directory (2-col desktop / 1-col mobile) + "Find someone new" LAST */}
        {step === 'hub' && (
          <div className="space-y-6 animate-cc-message-in">
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-[#8B8275]">
                Companions · Judgment-free human space
              </p>
              <h2 className="font-['Cormorant_Garamond',serif] text-2xl sm:text-3xl font-medium text-[#3D3830] leading-tight text-balance">
                Someone in your corner, whenever you want company
              </h2>
              <p className="text-xs sm:text-sm text-[#5C5449] leading-relaxed max-w-2xl">
                Vent freely, talk about nothing at all, or invite grounded astrology, tarot, or numerology when you want perspective. Every companion remembers your story across chats together—strictly private and platonic.
              </p>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-3.5 py-2.5 text-xs text-[#7A3E36]">
                {errorMsg}
              </div>
            )}

            {/* Pillar Tabs, Situation Search & Quick Chips */}
            <CompanionDiscoveryControls
              cards={enrichedPresets}
              activeGroup={activeGroup}
              onChangeGroup={setActiveGroup}
              activeSituationChip={activeSituationChip}
              onChangeSituationChip={setActiveSituationChip}
              searchQuery={searchQuery}
              onChangeSearchQuery={setSearchQuery}
              tabSurface="white"
              showCounts
            />

            {/* Saved Custom Companions from "Find someone new" (if user has any) */}
            {isDefaultDirectoryView && customCompanions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[#5C5449]">
                    Your matched companions
                  </h3>
                  <span className="text-[11px] font-['DM_Sans',sans-serif] tabular-nums text-[#8B8275]">
                    {customCompanions.length} saved
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {customCompanions.map((item) => {
                    const p = item.persona;
                    const isStarting = startingId === item.slug;
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col justify-between rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 sm:p-5 gap-3.5"
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          <CompanionAvatar
                            name={p.name}
                            avatarUrl={p.avatar_url}
                            palette={p.monogram_palette}
                            size="lg"
                            shape="circle"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <div className="flex items-baseline gap-2 min-w-0">
                                <h3 className="font-['Cormorant_Garamond',serif] text-xl font-semibold text-[#3D3830] truncate">
                                  {p.name}
                                </h3>
                                <span className="text-xs font-['DM_Sans',sans-serif] tabular-nums text-[#8B8275] shrink-0">
                                  {p.age}
                                </span>
                              </div>
                              {confirmRemoveCustomSlug === item.slug ? (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    disabled={removingCustomSlug === item.slug}
                                    onClick={() => void handleRemoveCustom(item.slug)}
                                    className="text-[11px] font-medium text-[#7A3E36] hover:underline cursor-pointer"
                                  >
                                    {removingCustomSlug === item.slug ? 'Removing…' : 'Remove'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmRemoveCustomSlug(null)}
                                    aria-label="Cancel removal"
                                    className="p-1 rounded-full text-[#8B8275] hover:text-[#3D3830] cursor-pointer"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmRemoveCustomSlug(item.slug)}
                                  aria-label={`Remove ${p.name} from saved matches`}
                                  className="p-1.5 rounded-full text-[#8B8275] hover:text-[#7A3E36] hover:bg-[#F1ECE3] transition-colors shrink-0 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-[#8B8275] truncate">
                              {p.role_label}
                              {item.thread_count > 0 ? ` · ${item.thread_count} chat${item.thread_count === 1 ? '' : 's'}` : ''}
                            </p>
                            <p className="text-xs text-[#5C5449] leading-relaxed line-clamp-2">
                              {p.tagline || p.bio}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 items-center gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              setSheetCompanion({
                                id: item.id,
                                slug: item.slug,
                                name: p.name,
                                age: p.age,
                                sex: p.gender,
                                tagline: p.tagline || '',
                                short_bio: p.bio || p.tagline || '',
                                full_bio: p.bio || p.tagline || '',
                                primary_expertise: p.role_label || 'Companion',
                                secondary_expertise: [],
                                category_tag: 'friends',
                                cultural_fluency: p.background || '',
                                skill_level: p.skill_level || 'none_emotional',
                                chat_style: p.chat_style || 'chat_bubbles',
                                tts_voice_profile: p.tts_voice_profile || { rate: 1, pitch: 1 },
                                supports_listening_cue: Boolean(p.supports_listening_cue),
                                suggestions_enabled: true,
                                sort_order: 0,
                                monogram_palette: p.monogram_palette || {
                                  bg: '#EAE3D7',
                                  ring: '#B8965A',
                                  ink: '#3D3830',
                                },
                                avatar_url: p.avatar_url || null,
                                last_conversation_id: item.last_conversation_id,
                              })
                            }
                            className="min-h-[36px] rounded-xl border border-[#3D3830]/10 bg-[#F5F1EA] px-2.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#EBE4D8] transition-colors cursor-pointer truncate"
                          >
                            About
                          </button>

                          <button
                            type="button"
                            disabled={startingId !== null}
                            onClick={() =>
                              void handleResumeCustom(item, { forceNew: true })
                            }
                            className="min-h-[36px] rounded-xl border border-[#3D3830]/10 bg-[#F5F1EA] px-2.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#EBE4D8] disabled:opacity-50 transition-colors cursor-pointer truncate"
                          >
                            Start new
                          </button>

                          <button
                            type="button"
                            disabled={startingId !== null}
                            onClick={() => void handleResumeCustom(item)}
                            className="min-h-[36px] rounded-xl border border-[#3D3830]/14 bg-[#EDE6DA] px-2.5 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#E4DCCD] disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer truncate"
                          >
                            {isStarting ? 'Opening…' : 'Continue Chat'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Preset Companions Grid (2 columns desktop, 1 column mobile) */}
            {loadingHub ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {[1, 2, 3, 4].map((skeleton) => (
                  <div
                    key={skeleton}
                    className="rounded-3xl border border-[#3D3830]/10 bg-[#FDFBF7] p-5 h-44 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredPresets.length === 0 ? (
                  <div className="md:col-span-2 rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-7 text-center space-y-2.5">
                    <p className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                      No companions match that moment or search
                    </p>
                    <p className="text-xs text-[#5C5449]">
                      Reset your filters or match a custom companion below.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveGroup('all');
                        setActiveSituationChip(null);
                        setSearchQuery('');
                      }}
                      className="min-h-[36px] inline-flex items-center justify-center rounded-full border border-[#3D3830]/18 bg-[#FAF7F2] px-4 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                    >
                      Reset filters
                    </button>
                  </div>
                ) : (
                  filteredPresets.map((card) => {
                    const isStarting = startingId === card.slug;
                    const hasHistory = Boolean(card.last_conversation_id);
                    return (
                      <div
                        key={card.slug}
                        className="flex flex-col justify-between rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 sm:p-5 gap-4 hover:border-[#3D3830]/25 transition-colors"
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => setSheetCompanion(card)}
                            aria-label={`View ${card.name}'s profile`}
                            className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8965A] cursor-pointer"
                          >
                            <CompanionAvatar
                              name={card.name}
                              avatarUrl={card.avatar_url}
                              palette={card.monogram_palette}
                              size="lg"
                              shape="circle"
                            />
                          </button>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <button
                                type="button"
                                onClick={() => setSheetCompanion(card)}
                                className="flex items-baseline gap-2 min-w-0 text-left hover:opacity-80 transition-opacity cursor-pointer"
                              >
                                <h3 className="font-['Cormorant_Garamond',serif] text-[21px] font-semibold text-[#3D3830] leading-tight truncate">
                                  {card.name}
                                </h3>
                                <span className="text-xs font-['DM_Sans',sans-serif] tabular-nums text-[#8B8275] shrink-0">
                                  {card.age}
                                </span>
                              </button>

                              {hasHistory && (
                                <span className="text-[11px] font-medium text-[#2D6A4F] shrink-0">
                                  Active chat
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-[#8B8275] truncate">
                              {card.primary_expertise}
                              {card.secondary_expertise?.[0] &&
                              card.secondary_expertise[0].toLowerCase() !==
                                card.primary_expertise.toLowerCase()
                                ? ` · ${card.secondary_expertise[0]}`
                                : ''}
                            </p>

                            <p className="text-xs text-[#5C5449] leading-relaxed line-clamp-2 pt-0.5">
                              {card.tagline || card.short_bio}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 items-center gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setSheetCompanion(card)}
                            className="min-h-[36px] rounded-xl border border-[#3D3830]/10 bg-[#F5F1EA] px-2.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#EBE4D8] transition-colors cursor-pointer truncate"
                          >
                            About
                          </button>

                          <button
                            type="button"
                            disabled={startingId !== null}
                            onClick={() => void handleStartPreset(card, { forceNew: true })}
                            className="min-h-[36px] rounded-xl border border-[#3D3830]/10 bg-[#F5F1EA] px-2.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#EBE4D8] disabled:opacity-50 transition-colors cursor-pointer truncate"
                          >
                            Start new
                          </button>

                          <button
                            type="button"
                            disabled={startingId !== null}
                            onClick={() => void handleStartPreset(card)}
                            className="min-h-[36px] rounded-xl border border-[#3D3830]/14 bg-[#EDE6DA] px-2.5 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#E4DCCD] disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer truncate"
                          >
                            {isStarting ? 'Connecting…' : 'Continue Chat'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* LAST OPTION ON THE LIST: Find someone new (preserved custom matcher) */}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setStep('pick_type');
                  }}
                  className="md:col-span-2 group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-dashed border-[#3D3830]/22 bg-[#F1ECE3]/55 hover:bg-[#F1ECE3] hover:border-[#3D3830]/35 p-5 text-left transition-all cursor-pointer"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FAF7F2] border border-[#3D3830]/12 text-[#8B7355]">
                      <UserPlus className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <h3 className="font-['Cormorant_Garamond',serif] text-xl font-semibold text-[#3D3830]">
                        Find someone new
                      </h3>
                      <p className="text-xs text-[#5C5449] leading-relaxed">
                        Want a companion shaped around something specific—like a spiritual tradition, life coach, or fresh voice? Tell us briefly and meet 4 tailored matches.
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#3D3830]/18 bg-[#FDFBF7] px-4 py-2 text-xs font-medium text-[#3D3830] group-hover:bg-[#4A453D] group-hover:text-[#FAF7F2] transition-colors">
                    <span>Match custom</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 1 (Custom Matcher): Choose Companion Archetype */}
        {step === 'pick_type' && (
          <div className="space-y-7 animate-cc-message-in">
            <button
              type="button"
              onClick={() => {
                setStep('hub');
                setErrorMsg(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to all companions</span>
            </button>

            <div className="space-y-2">
              <p className="text-[11px] font-medium text-[#8B8275]">
                Find someone new · Custom companion match
              </p>
              <h2 className="font-['Cormorant_Garamond',serif] text-2xl sm:text-3xl font-medium text-[#3D3830] leading-tight text-balance">
                Who would feel right to talk with today?
              </h2>
              <p className="text-xs sm:text-sm text-[#5C5449] leading-relaxed max-w-xl">
                Pick a direction below. We will ask two brief questions and introduce four grounded, realistic companions matched to what you need — strictly private, platonic, and honest.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {resolvedArchetypeOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.slug}
                    type="button"
                    onClick={() => handleChooseArchetype(opt.slug)}
                    className="group flex flex-col justify-between text-left rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 hover:border-[#3D3830]/30 hover:bg-[#FAF7F2] active:scale-[0.99] transition-all cursor-pointer min-h-[126px]"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#F1ECE3] text-[#5C5449] group-hover:text-[#3D3830] transition-colors">
                          <Icon className="h-4 w-4" />
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-[#8B8275] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <h3 className="font-['Cormorant_Garamond',serif] text-lg font-medium text-[#3D3830]">
                        {opt.label}
                      </h3>
                      <p className="text-xs text-[#5C5449] leading-relaxed">
                        {opt.summary}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2 (Custom Matcher): Tailored Intake */}
        {step === 'intake' && (
          <div className="max-w-xl mx-auto space-y-6 animate-cc-message-in">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep('pick_type');
                  setErrorMsg(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>All custom types</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('hub');
                  setErrorMsg(null);
                }}
                className="text-xs font-medium text-[#8B8275] hover:text-[#3D3830] transition-colors cursor-pointer"
              >
                Browse preset companions
              </button>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-[#8B8275]">
                Companion · {activeArchetypeMeta.label}
              </p>
              <h2 className="font-['Cormorant_Garamond',serif] text-2xl sm:text-3xl font-medium text-[#3D3830] text-balance">
                {activeArchetypeMeta.isSpiritual
                  ? 'Tune your spiritual companion'
                  : 'Tell us a little before we match you'}
              </h2>
              <p className="text-xs text-[#5C5449] leading-relaxed">
                {activeArchetypeMeta.isSpiritual
                  ? 'We will introduce four thoughtful guides attuned to your tradition and depth — never preachy, always respectful.'
                  : 'Just a sentence or two is plenty. We will introduce 2 women and 2 men whose style fits naturally.'}
              </p>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-3.5 py-2.5 text-xs text-[#7A3E36]">
                {errorMsg}
              </div>
            )}

            <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-5">
              {activeArchetypeMeta.isSpiritual ? (
                <>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="spiritual-scale"
                        className="text-xs font-medium text-[#3D3830]"
                      >
                        How religious are you?
                      </label>
                      <span className="text-xs font-['DM_Sans',sans-serif] tabular-nums text-[#3D3830]">
                        {religiousness} / 10 ·{' '}
                        <span className="font-sans text-[#5C5449]">
                          {getReligiousnessCaption(religiousness)}
                        </span>
                      </span>
                    </div>
                    <input
                      id="spiritual-scale"
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={religiousness}
                      onChange={(e) => setReligiousness(Number(e.target.value))}
                      className="w-full accent-[#4A453D] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-['DM_Sans',sans-serif] tabular-nums text-[#8B8275]">
                      <span>1 · Secular</span>
                      <span>5 · Balanced</span>
                      <span>10 · Devout</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#3D3830]">
                      Which religion do you follow?
                    </label>
                    <CustomSelect
                      value={primaryReligion}
                      onChange={setPrimaryReligion}
                      ariaLabel="Primary religion or spiritual path"
                      size="md"
                      surface="canvas"
                      className="w-full"
                      options={PRIMARY_RELIGION_OPTIONS}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#3D3830]">
                      Which other religion or philosophy do you like?{' '}
                      <span className="font-normal text-[#8B8275]">(Optional)</span>
                    </label>
                    <CustomSelect
                      value={secondaryReligion}
                      onChange={setSecondaryReligion}
                      ariaLabel="Other religion or philosophy you appreciate"
                      size="md"
                      surface="canvas"
                      className="w-full"
                      options={SECONDARY_RELIGION_OPTIONS}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="spiritual-topic"
                      className="block text-xs font-medium text-[#3D3830]"
                    >
                      {activeArchetypeMeta.questionOne || 'What would you like to reflect on?'}{' '}
                      <span className="font-normal text-[#8B8275]">(Optional)</span>
                    </label>
                    <textarea
                      id="spiritual-topic"
                      rows={2}
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., Staying grounded through change, finding peace with uncertainty, daily stillness..."
                      className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/40 resize-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="companion-topic"
                      className="block text-xs font-medium text-[#3D3830]"
                    >
                      {activeArchetypeMeta.questionOne || 'What do you want to talk about?'}
                    </label>
                    <textarea
                      id="companion-topic"
                      rows={3}
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Share as little or as much as you like — a tough week, a decision you keep circling, feeling drained, or just wanting good company..."
                      className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/40 resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="companion-pref"
                      className="block text-xs font-medium text-[#3D3830]"
                    >
                      {activeArchetypeMeta.questionTwo || 'What kind of person are you looking for?'}{' '}
                      <span className="font-normal text-[#8B8275]">(Optional)</span>
                    </label>
                    <input
                      id="companion-pref"
                      type="text"
                      value={preference}
                      onChange={(e) => setPreference(e.target.value)}
                      placeholder="e.g., Calm and candid, warm dry humor, someone older who won't sugarcoat things..."
                      className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/40"
                    />
                  </div>
                </>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-[11px] text-[#8B8275]">
                  Always shows 2 women &amp; 2 men · Strictly private &amp; platonic
                </p>
                <button
                  type="button"
                  onClick={() => void runMatching(false)}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Find my companion</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Calm Editorial Matching Transition */}
        {step === 'matching' && (
          <div className="min-h-[340px] flex flex-col items-center justify-center text-center space-y-4 animate-cc-message-in">
            <div className="h-12 w-12 rounded-full border border-[#B8965A]/40 bg-[#F1ECE3] flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-[#B8965A] animate-pulse" />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h2 className="font-['Cormorant_Garamond',serif] text-2xl font-medium text-[#3D3830]">
                Finding the right person for you…
              </h2>
              <p className="text-xs text-[#8B8275] leading-relaxed">
                Curating four grounded personalities attuned to your tone and what you shared.
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: 4 Realistic Companion Cards (2 Female, 2 Male) */}
        {step === 'results' && (
          <div className="space-y-6 animate-cc-message-in">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setStep('intake')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] mb-1 cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Adjust preferences</span>
                </button>
                <h2 className="font-['Cormorant_Garamond',serif] text-2xl sm:text-3xl font-medium text-[#3D3830]">
                  Choose who you would like to talk with
                </h2>
                <p className="text-xs text-[#5C5449]">
                  {activeArchetypeMeta.label} · 4 matched companions (2 women, 2 men)
                </p>
              </div>

              <button
                type="button"
                onClick={() => void runMatching(true)}
                className="min-h-[42px] inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5 text-[#8B7355]" />
                <span>Show different companions</span>
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-3.5 py-2.5 text-xs text-[#7A3E36]">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {matches.map((persona) => {
                const isStarting = startingId === persona.id;
                return (
                  <div
                    key={persona.id}
                    className="flex flex-col justify-between rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 space-y-4 hover:border-[#3D3830]/25 transition-colors"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <CompanionAvatar
                          name={persona.name}
                          avatarUrl={persona.avatar_url}
                          palette={persona.monogram_palette}
                          size="md"
                          shape="circle"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <h3 className="font-['Cormorant_Garamond',serif] text-xl font-semibold text-[#3D3830] truncate">
                              {persona.name}
                            </h3>
                            <span className="text-xs font-['DM_Sans',sans-serif] tabular-nums text-[#8B8275]">
                              {persona.age}
                            </span>
                          </div>
                          <p className="text-xs text-[#5C5449] leading-snug">
                            {persona.role_label} · {persona.background}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-[#5C5449] leading-relaxed">
                        {persona.bio}
                      </p>

                      <p className="text-[11px] text-[#8B8275]">
                        <span className="font-medium text-[#5C5449]">Style:</span>{' '}
                        {persona.conversation_style}
                      </p>

                      <div className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/8 px-3.5 py-2.5 text-xs italic text-[#3D3830]/90 leading-relaxed">
                        &ldquo;{persona.opening_message}&rdquo;
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={startingId !== null}
                      onClick={() => void handleSelectPersona(persona)}
                      className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <span>
                        {isStarting ? `Connecting with ${persona.name}…` : `Talk with ${persona.name}`}
                      </span>
                      {!isStarting && <ArrowRight className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Companion Bio Sheet */}
      <CompanionProfileSheet
        companion={sheetCompanion}
        isOpen={Boolean(sheetCompanion)}
        onClose={() => setSheetCompanion(null)}
        onStartChat={(companion, opts) => void handleStartPreset(companion, opts)}
      />
    </div>
  );
};

export default CompanionSetupView;
