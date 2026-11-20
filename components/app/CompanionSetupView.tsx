import React, { useMemo, useState } from 'react';
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
} from 'lucide-react';
import CustomSelect from './CustomSelect';
import type {
  CompanionArchetypeSlug,
  CompanionPersona,
  ConversationRecord,
} from './chatTypes';

interface CompanionSetupViewProps {
  initialArchetype?: CompanionArchetypeSlug | null;
  pastCompanionConversations: ConversationRecord[];
  isPreviewMode?: boolean;
  getAccessToken: () => Promise<string | null>;
  onSelectPastCompanion: (conversationId: string) => void;
  onStartWithCompanion: (persona: CompanionPersona) => Promise<void>;
}

interface ArchetypeOption {
  slug: CompanionArchetypeSlug;
  label: string;
  summary: string;
  icon: React.FC<{ className?: string }>;
  isSpiritual?: boolean;
}

const ARCHETYPE_OPTIONS: ArchetypeOption[] = [
  {
    slug: 'find_someone',
    label: 'Find someone',
    summary: 'Not sure which voice fits yet? Share what is on your mind and meet 4 grounded people.',
    icon: Compass,
  },
  {
    slug: 'friend',
    label: 'Friend',
    summary: 'Easy, genuine company to talk through your day, bounce a thought around, or feel less alone.',
    icon: MessageCircle,
  },
  {
    slug: 'listener',
    label: 'Listener',
    summary: 'Unhurried, judgment-free space to vent, slow down, and be heard without rushing to fix.',
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
    summary: 'Clear-eyed accountability and honest pushback when you want real traction on a choice.',
    icon: HeartHandshake,
  },
  {
    slug: 'spiritual_guide',
    label: 'Spiritual guide',
    summary: 'Reflective philosophical and spiritual companionship attuned to your faith and depth.',
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
  },
  {
    id: 'prev-m-2',
    name: 'Dev',
    age: 34,
    gender: 'M',
    companion_type: 'find_someone',
    role_label: 'Grounded Straight-Talker',
    background: 'Former culinary instructor · Practical, warm, unhurried',
    tagline: 'Steady energy when your head feels loud.',
    bio: 'Dev left high-pressure kitchens to teach small cooking classes and rebuild a slower pace of life. He has zero patience for performative pep talks, but he will sit with you until the real next step shows up.',
    conversation_style: 'Steady, down-to-earth, playfully direct',
    opening_message: 'Hey there. Take a breath — what are we untangling today?',
    system_prompt: '',
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
  },
  {
    id: 'prev-m-4',
    name: 'Rohan',
    age: 37,
    gender: 'M',
    companion_type: 'find_someone',
    role_label: 'Perspective Builder',
    background: 'Urban planner & marathon runner · Patient, structured, sincere',
    tagline: 'Helps turn tangled thoughts into calm perspective.',
    bio: 'Rohan spends his days figuring out how cities flow and his mornings running quiet routes before sunrise. He is patient with uncertainty and gently nudges you when it is time to stop circling.',
    conversation_style: 'Measured, encouraging, thoughtfully challenging',
    opening_message:
      'Hey — good to meet you. Tell me a little about what has been occupying your mind lately.',
    system_prompt: '',
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
  initialArchetype = null,
  pastCompanionConversations,
  isPreviewMode = false,
  getAccessToken,
  onSelectPastCompanion,
  onStartWithCompanion,
}) => {
  const [selectedType, setSelectedType] = useState<CompanionArchetypeSlug | null>(
    initialArchetype
  );
  const [step, setStep] = useState<'pick_type' | 'intake' | 'matching' | 'results'>(
    initialArchetype ? 'intake' : 'pick_type'
  );

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

  const activeArchetypeMeta = useMemo(
    () => ARCHETYPE_OPTIONS.find((a) => a.slug === selectedType) || ARCHETYPE_OPTIONS[0],
    [selectedType]
  );

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

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-10 pt-6 pb-40">
      <div className="mx-auto max-w-3xl">
        {/* STEP 1: Choose Companion Archetype */}
        {step === 'pick_type' && (
          <div className="space-y-7 animate-cc-message-in">
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-[#8B8275]">
                Companions · Judgment-free human space
              </p>
              <h2 className="font-serif text-2xl sm:text-3xl font-medium text-[#3D3830] leading-tight text-balance">
                Who would feel right to talk with today?
              </h2>
              <p className="text-xs sm:text-sm text-[#5C5449] leading-relaxed max-w-xl">
                Pick a direction below. We will ask two brief questions and introduce four grounded, realistic companions matched to what you need — strictly private, platonic, and honest.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ARCHETYPE_OPTIONS.map((opt) => {
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
                      <h3 className="font-serif text-lg font-medium text-[#3D3830]">
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

            {/* Continue with Past Companions */}
            {pastCompanionConversations.length > 0 && (
              <div className="pt-2 border-t border-[#3D3830]/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-[#5C5449]">
                    Continue with a past companion
                  </h3>
                  <span className="text-[11px] font-mono tabular-nums text-[#8B8275]">
                    {pastCompanionConversations.length} saved
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {pastCompanionConversations.slice(0, 6).map((conv) => {
                    const persona = conv.companion_persona_json;
                    const displayName = persona?.name || conv.title.split('·')[0].trim();
                    const initial = displayName.charAt(0).toUpperCase();
                    return (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => onSelectPastCompanion(conv.id)}
                        className="flex items-center gap-3 rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] px-3.5 py-2.5 text-left hover:border-[#3D3830]/30 hover:bg-[#F1ECE3]/55 transition-colors cursor-pointer"
                      >
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAE3D7] font-serif text-base font-semibold text-[#3D3830]">
                          {initial}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#3D3830] truncate">
                            {displayName}
                            {persona?.role_label ? (
                              <span className="font-normal text-[#8B8275]">
                                {' '}· {persona.role_label}
                              </span>
                            ) : null}
                          </p>
                          <p className="text-[11px] text-[#5C5449] truncate mt-0.5">
                            {conv.title}
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-[#8B8275] shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Tailored Intake (Standard 2 Questions OR Spiritual Guide Scale + Dropdowns) */}
        {step === 'intake' && (
          <div className="max-w-xl mx-auto space-y-6 animate-cc-message-in">
            <button
              type="button"
              onClick={() => {
                setStep('pick_type');
                setErrorMsg(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>All companion types</span>
            </button>

            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-[#8B8275]">
                Companion · {activeArchetypeMeta.label}
              </p>
              <h2 className="font-serif text-2xl sm:text-3xl font-medium text-[#3D3830] text-balance">
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
                  {/* 10-Point Religiousness Slider */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="spiritual-scale"
                        className="text-xs font-medium text-[#3D3830]"
                      >
                        How religious are you?
                      </label>
                      <span className="text-xs font-mono tabular-nums text-[#3D3830]">
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
                    <div className="flex justify-between text-[10px] font-mono tabular-nums text-[#8B8275]">
                      <span>1 · Secular</span>
                      <span>5 · Balanced</span>
                      <span>10 · Devout</span>
                    </div>
                  </div>

                  {/* Primary Religion Dropdown */}
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

                  {/* Secondary Religion / Philosophy Dropdown */}
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

                  {/* Optional Reflection Note */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="spiritual-topic"
                      className="block text-xs font-medium text-[#3D3830]"
                    >
                      What would you like to reflect on?{' '}
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
                      What do you want to talk about?
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
                      What kind of person are you looking for?{' '}
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
                  className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] active:scale-[0.98] transition-all cursor-pointer"
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
              <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                Wait… finding the perfect companion for you
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
                <h2 className="font-serif text-2xl sm:text-3xl font-medium text-[#3D3830]">
                  Choose who you would like to talk with
                </h2>
                <p className="text-xs text-[#5C5449]">
                  {activeArchetypeMeta.label} · 4 matched companions (2 women, 2 men)
                </p>
              </div>

              <button
                type="button"
                onClick={() => void runMatching(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
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
                const monogram = persona.name.charAt(0).toUpperCase();
                return (
                  <div
                    key={persona.id}
                    className="flex flex-col justify-between rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 space-y-4 hover:border-[#3D3830]/25 transition-colors"
                  >
                    <div className="space-y-3">
                      {/* Identity Row */}
                      <div className="flex items-start gap-3">
                        <div className="h-11 w-11 shrink-0 rounded-full bg-[#EAE3D7] border border-[#3D3830]/10 flex items-center justify-center font-serif text-xl font-semibold text-[#3D3830]">
                          {monogram}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <h3 className="font-serif text-xl font-semibold text-[#3D3830] truncate">
                              {persona.name}
                            </h3>
                            <span className="text-xs font-mono tabular-nums text-[#8B8275]">
                              {persona.age}
                            </span>
                          </div>
                          <p className="text-xs text-[#5C5449] leading-snug">
                            {persona.role_label} · {persona.background}
                          </p>
                        </div>
                      </div>

                      {/* Bio */}
                      <p className="text-xs text-[#5C5449] leading-relaxed">
                        {persona.bio}
                      </p>

                      {/* Style Metadata (Unboxed) */}
                      <p className="text-[11px] text-[#8B8275]">
                        <span className="font-medium text-[#5C5449]">Style:</span>{' '}
                        {persona.conversation_style}
                      </p>

                      {/* Natural Opening Line Preview */}
                      <div className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/8 px-3.5 py-2.5 text-xs italic text-[#3D3830]/90 leading-relaxed">
                        &ldquo;{persona.opening_message}&rdquo;
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={startingId !== null}
                      onClick={() => void handleSelectPersona(persona)}
                      className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 active:scale-[0.98] transition-all cursor-pointer"
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
    </div>
  );
};

export default CompanionSetupView;
