import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  Clock,
  Copy,
  Heart,
  Loader2,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import AstrologyModeToggle from './AstrologyModeToggle';
import CustomSelect from './CustomSelect';
import CustomDatePicker from './CustomDatePicker';
import {
  CLIENT_BREAKDOWN_DOMAINS,
  CLIENT_MINI_APPS,
  CLIENT_PLANET_QUIZ_PREVIEW,
  buildPreviewAppResult,
  renderMiniAppIcon,
} from './miniAppsClientData';
import type {
  BreakdownDomain,
  MiniAppPastReading,
  MiniAppRunResponse,
  PlanetStrengthQuestion,
} from './miniAppsTypes';
import { PREVIEW_PROFILES } from './previewFixtures';

interface ProfileOption {
  id: string;
  name: string;
  short_name?: string | null;
  is_default?: boolean;
  is_activated?: boolean;
  birth_date?: string;
}

const PLANET_LIST = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'] as const;

const DREAM_EXAMPLES = [
  'I was walking through a quiet library where the floor slowly turned into shallow clear water.',
  'I kept missing a train at a sunlit station even though I had my ticket in my hand.',
];

const AFFIRMATION_EXAMPLES = [
  'Stepping into a bigger leadership role while dealing with quiet self-doubt.',
  'Rebuilding emotional calm and healthy boundaries after a draining season.',
];

const OFFER_EXAMPLES = [
  'Senior Product Lead offer at $155k base (target is $172k + equity). Strong interview feedback, 5 days to respond.',
];

const RELATIONSHIP_INTENT_OPTIONS = [
  { value: 'Long-term partnership / marriage', label: 'Long-term partnership / marriage' },
  { value: 'Serious dating & future alignment', label: 'Serious dating & future alignment' },
  { value: 'Deepening an existing marriage', label: 'Deepening an existing marriage' },
  { value: 'Understanding early chemistry', label: 'Understanding early chemistry' },
];

const BREAKUP_TIMEFRAME_OPTIONS = [
  { value: 'Within the last few weeks', label: 'Within the last few weeks' },
  { value: '1 to 3 months ago', label: '1 to 3 months ago' },
  { value: '3 to 12 months ago', label: '3 to 12 months ago' },
  { value: 'Over a year ago (still seeking closure)', label: 'Over a year ago (still seeking closure)' },
];

const PET_SPECIES_OPTIONS = [
  { value: 'Dog', label: 'Dog' },
  { value: 'Cat', label: 'Cat' },
  { value: 'Bird', label: 'Bird' },
  { value: 'Rabbit / Small Companion', label: 'Rabbit / Small Companion' },
  { value: 'Horse / Other Companion', label: 'Horse / Other Companion' },
];

const PATTERN_EXAMPLES = [
  'I keep attracting emotionally unavailable partners where I carry most of the communication.',
  'My relationships begin warmly but stall around commitment or long-term expectations.',
];

const FAVORITES_STORAGE_KEY = 'cc_favorite_apps_v1';

const MiniAppRunner: React.FC = () => {
  const { appSlug } = useParams<{ appSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isPreviewMode, getAccessToken, astrologyMode, setAstrologyMode } = useAuth();

  const appDef = useMemo(
    () => CLIENT_MINI_APPS.find((a) => a.slug === appSlug) || null,
    [appSlug]
  );

  const [profiles, setProfiles] = useState<ProfileOption[]>(() =>
    isPreviewMode
      ? PREVIEW_PROFILES.map((p) => ({
          id: p.id,
          name: p.name,
          short_name: p.short_name,
          is_default: p.is_default,
          is_activated: p.is_activated,
          birth_date: p.birth_date,
        }))
      : []
  );
  const [profilesLoaded, setProfilesLoaded] = useState<boolean>(isPreviewMode);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    () => searchParams.get('profileId') || (isPreviewMode ? PREVIEW_PROFILES[0]?.id || '' : '')
  );

  const [isFavorite, setIsFavorite] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (raw && appSlug) return (JSON.parse(raw) as string[]).includes(appSlug);
    } catch {
      // Ignore
    }
    return false;
  });

  // Shared run result state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<MiniAppRunResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [pastReadings, setPastReadings] = useState<MiniAppPastReading[]>([]);
  const [isLoadingReadings, setIsLoadingReadings] = useState(false);
  const [savingToNotes, setSavingToNotes] = useState(false);
  const [savedToNotes, setSavedToNotes] = useState(false);
  const [saveNoteError, setSaveNoteError] = useState<string | null>(null);

  // Template B: Birth Chart Breakdown state
  const [breakdownDomains] = useState<BreakdownDomain[]>(CLIENT_BREAKDOWN_DOMAINS);
  const [activeDomainId, setActiveDomainId] = useState<string>(CLIENT_BREAKDOWN_DOMAINS[0].id);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [breakdownLocalCache, setBreakdownLocalCache] = useState<Record<string, MiniAppRunResponse>>({});

  // Template C: Form-Input Reading states
  const [partnerMode, setPartnerMode] = useState<'manual' | 'saved'>('manual');
  const [partnerProfileId, setPartnerProfileId] = useState<string>('');
  const [partnerName, setPartnerName] = useState('');
  const [partnerDob, setPartnerDob] = useState('');
  const [partnerBirthTime, setPartnerBirthTime] = useState('');
  const [partnerBirthPlace, setPartnerBirthPlace] = useState('');
  const [relationshipIntent, setRelationshipIntent] = useState('Long-term partnership / marriage');
  const [dreamText, setDreamText] = useState('');
  const [situationText, setSituationText] = useState('');
  const [offerContext, setOfferContext] = useState('');
  const [breakupTimeframe, setBreakupTimeframe] = useState('1 to 3 months ago');
  const [breakupContext, setBreakupContext] = useState('');
  const [patternFocus, setPatternFocus] = useState('');
  const [petName, setPetName] = useState('');
  const [petSpecies, setPetSpecies] = useState('Dog');
  const [petDate, setPetDate] = useState('');
  const [petQuirks, setPetQuirks] = useState('');

  // Template D: Planet Strength Tester Quiz states
  const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null);
  const [quizStep, setQuizStep] = useState<'select' | 'quiz' | 'result'>('select');
  const [quizQuestions, setQuizQuestions] = useState<PlanetStrengthQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Array<{ question: string; answer: string; score: number }>>([]);
  const [planetNatalMeta, setPlanetNatalMeta] = useState<MiniAppRunResponse['planetNatalContext']>(null);

  // Load profiles on mount
  useEffect(() => {
    if (isPreviewMode) {
      setProfilesLoaded(true);
      return;
    }

    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      if (!token) {
        if (!cancelled) setProfilesLoaded(true);
        return;
      }
      const res = await fetch('/api/profiles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok && !cancelled) {
        const data = await res.json();
        const list = (data.profiles || []) as ProfileOption[];
        setProfiles(list);
        const queryPid = searchParams.get('profileId');
        const validQueryPid = queryPid && list.some((p) => p.id === queryPid) ? queryPid : '';
        const preferred =
          validQueryPid ||
          list.find((p) => p.is_default)?.id ||
          list.find((p) => p.is_activated)?.id ||
          list[0]?.id ||
          '';
        setSelectedProfileId(preferred);
      }
      if (!cancelled) setProfilesLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, isPreviewMode, searchParams]);

  const loadPastReadings = useCallback(async () => {
    if (!appDef || isPreviewMode) {
      setPastReadings([]);
      return;
    }
    const token = await getAccessToken();
    if (!token) return;
    setIsLoadingReadings(true);
    try {
      const qs = new URLSearchParams();
      if (selectedProfileId) qs.set('profileId', selectedProfileId);
      const res = await fetch(
        `/api/apps/${encodeURIComponent(appDef.slug)}/readings${qs.toString() ? `?${qs.toString()}` : ''}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPastReadings(Array.isArray(data.readings) ? data.readings : []);
      }
    } catch {
      // Ignore fetch errors
    } finally {
      setIsLoadingReadings(false);
    }
  }, [appDef, getAccessToken, isPreviewMode, selectedProfileId]);

  useEffect(() => {
    void loadPastReadings();
  }, [loadPastReadings]);

  // Reset transient state when switching app slug
  useEffect(() => {
    setResult(null);
    setErrorMsg(null);
    setCopied(false);
    setSavedToNotes(false);
    setSaveNoteError(null);
    setActiveTopicId(null);
    setQuizStep('select');
    setSelectedPlanet(null);
    setQuizQuestions([]);
    setQuizAnswers([]);
    setPlanetNatalMeta(null);
  }, [appSlug]);

  const executeMiniApp = useCallback(
    async (opts?: {
      forceRefresh?: boolean;
      inputs?: Record<string, unknown>;
      partnerProfileId?: string | null;
      action?: 'run' | 'generate_quiz';
      overrideMode?: 'vedic' | 'western';
    }): Promise<MiniAppRunResponse | null> => {
      if (!appDef) return null;
      const effectiveMode = opts?.overrideMode || astrologyMode;
      setErrorMsg(null);
      setSaveNoteError(null);
      setIsLoading(true);

      try {
        if (isPreviewMode) {
          await new Promise((r) => setTimeout(r, 380));
          if (appDef.slug === 'planet-strength-tester' && opts?.action === 'generate_quiz') {
            const planet = String(opts.inputs?.planet || 'Sun');
            const previewRes: MiniAppRunResponse = {
              slug: appDef.slug,
              markdown: '',
              structured: null,
              cacheHit: false,
              cachedAt: new Date().toISOString(),
              astrologyMode: effectiveMode,
              questions: CLIENT_PLANET_QUIZ_PREVIEW.Sun,
              planetNatalContext: {
                planet,
                sign: planet === 'Moon' ? 'Virgo' : planet === 'Saturn' ? 'Capricorn' : 'Leo',
                house: planet === 'Moon' ? 1 : planet === 'Saturn' ? 5 : 12,
                nakshatra: planet === 'Moon' ? 'Hasta' : 'Magha',
                dignity: planet === 'Saturn' ? 'Own Sign' : 'Neutral',
              },
            };
            return previewRes;
          }
          const mock = buildPreviewAppResult(appDef.slug, opts?.inputs, effectiveMode);
          setResult(mock);
          setSavedToNotes(false);
          return mock;
        }

        const token = await getAccessToken();
        if (!token) {
          setErrorMsg('Please sign in to run this app.');
          return null;
        }

        const res = await fetch(`/api/apps/${encodeURIComponent(appDef.slug)}/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            profileId: selectedProfileId || null,
            partnerProfileId: opts?.partnerProfileId || null,
            forceRefresh: Boolean(opts?.forceRefresh),
            astrologyMode: effectiveMode,
            action: opts?.action || 'run',
            inputs: opts?.inputs || {},
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || 'Could not generate this reading right now.');
          return null;
        }

        const typed = data as MiniAppRunResponse;
        if (opts?.action !== 'generate_quiz') {
          setResult(typed);
          setSavedToNotes(false);
          if (!typed.cacheHit) {
            void loadPastReadings();
          }
        }
        return typed;
      } catch {
        setErrorMsg('Connection interrupted. Please try again.');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [appDef, astrologyMode, getAccessToken, isPreviewMode, loadPastReadings, selectedProfileId]
  );

  const handleProfileChange = (nextPid: string) => {
    setSelectedProfileId(nextPid);
    setResult(null);
    setSavedToNotes(false);
    setBreakdownLocalCache({});
    setActiveTopicId(null);
    const nextParams = new URLSearchParams(searchParams);
    if (nextPid) nextParams.set('profileId', nextPid);
    else nextParams.delete('profileId');
    setSearchParams(nextParams, { replace: true });
  };

  const handleModeSwitch = (nextMode: 'vedic' | 'western') => {
    if (nextMode === astrologyMode) return;
    void setAstrologyMode(nextMode);
    setResult(null);
    setSavedToNotes(false);
    setSaveNoteError(null);
    setActiveTopicId(null);
  };

  const handleToggleFavorite = async () => {
    if (!appDef) return;
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      const current = raw ? (JSON.parse(raw) as string[]) : [];
      const updated = next
        ? Array.from(new Set([...current, appDef.slug]))
        : current.filter((s) => s !== appDef.slug);
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }

    if (isPreviewMode) return;
    const token = await getAccessToken();
    if (!token) return;
    await fetch('/api/apps/favorites/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ appSlug: appDef.slug, desired: next }),
    }).catch(() => {});
  };

  const handleCopyMarkdown = () => {
    if (!result?.markdown) return;
    void navigator.clipboard.writeText(result.markdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToNotes = async () => {
    if (!appDef || !result?.markdown || savingToNotes) return;
    setSaveNoteError(null);

    if (isPreviewMode) {
      setSavedToNotes(true);
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setSaveNoteError('Please sign in to save notes.');
      return;
    }

    setSavingToNotes(true);
    try {
      const modeUsed = result.astrologyMode || astrologyMode;
      const modeTag = modeUsed === 'western' ? 'Western' : 'Vedic';
      const title =
        appDef.slug === 'birth-chart-breakdown' && activeTopic?.label
          ? `${appDef.title}: ${activeTopic.label} (${modeTag})`
          : appDef.slug === 'planet-strength-tester' && selectedPlanet
          ? `${appDef.title}: ${selectedPlanet} (${modeTag})`
          : `${appDef.title} (${modeTag})`;

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          content: result.markdown,
          source_type: 'apps',
          source_ref_id: result.readingId || `${appDef.slug}:${result.cachedAt}`,
          profile_id: selectedProfileId || null,
          astrology_mode: modeUsed,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Could not save note');
      }
      setSavedToNotes(true);
    } catch (err) {
      setSaveNoteError(err instanceof Error ? err.message : 'Could not save to Notes');
    } finally {
      setSavingToNotes(false);
    }
  };

  const handleOpenPastReading = (reading: MiniAppPastReading) => {
    setErrorMsg(null);
    setSaveNoteError(null);
    setSavedToNotes(false);
    setResult({
      slug: reading.app_slug,
      markdown: reading.markdown,
      structured: reading.structured_json,
      cacheHit: true,
      cachedAt: reading.created_at,
      astrologyMode: reading.astrology_mode,
      readingId: reading.id,
      profileUsed: reading.profile_name
        ? { id: reading.profile_id || '', name: reading.profile_name }
        : null,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDiscussInChat = () => {
    if (!appDef) return;
    const params = new URLSearchParams();
    params.set('pillar', 'council');
    params.set('system', result?.astrologyMode || astrologyMode);
    if (selectedProfileId) params.set('profileId', selectedProfileId);
    const seed =
      appDef.slug === 'birth-chart-breakdown' && activeTopicId
        ? `Let’s explore "${activeDomain?.title} — ${activeTopic?.label}" from my Birth Chart Breakdown in deeper technical detail.`
        : appDef.slug === 'planet-strength-tester' && selectedPlanet
        ? `Let’s examine my natal ${selectedPlanet} placement and practical ways to harmonize it.`
        : appDef.chatSeedPrompt;
    params.set('prompt', seed);
    navigate(`/app/chat?${params.toString()}`);
  };

  // Template B: Birth Chart Breakdown topic runner
  const activeDomain = useMemo(
    () => breakdownDomains.find((d) => d.id === activeDomainId) || breakdownDomains[0],
    [breakdownDomains, activeDomainId]
  );
  const activeTopic = useMemo(
    () => activeDomain.topics.find((t) => t.id === activeTopicId) || null,
    [activeDomain, activeTopicId]
  );

  const handleSelectBreakdownTopic = async (
    domainId: string,
    topicId: string,
    topicLabel: string,
    forceRefresh = false
  ) => {
    setActiveTopicId(topicId);
    const localKey = `${selectedProfileId}:${astrologyMode}:${domainId}:${topicId}`;
    if (!forceRefresh && breakdownLocalCache[localKey]) {
      setResult(breakdownLocalCache[localKey]);
      setSavedToNotes(false);
      return;
    }
    const res = await executeMiniApp({
      forceRefresh,
      inputs: { domainId, topicId, topicLabel },
    });
    if (res) {
      setBreakdownLocalCache((prev) => ({ ...prev, [localKey]: res }));
    }
  };

  // Template D: Planet Strength Tester handlers
  const handleStartPlanetQuiz = async (planet: string) => {
    setSelectedPlanet(planet);
    setQuizAnswers([]);
    setResult(null);
    const res = await executeMiniApp({
      action: 'generate_quiz',
      inputs: { planet },
    });
    if (res?.questions && res.questions.length > 0) {
      setQuizQuestions(res.questions);
      setPlanetNatalMeta(res.planetNatalContext || null);
      setQuizStep('quiz');
    }
  };

  const handleAnswerPlanetQuestion = async (optionText: string, score: number) => {
    const q = quizQuestions[quizAnswers.length];
    if (!q || !selectedPlanet) return;
    const nextAnswers = [...quizAnswers, { question: q.question, answer: optionText, score }];
    setQuizAnswers(nextAnswers);

    if (nextAnswers.length >= quizQuestions.length) {
      const totalScore = nextAnswers.reduce((sum, item) => sum + item.score, 0);
      const evalRes = await executeMiniApp({
        action: 'run',
        inputs: {
          planet: selectedPlanet,
          totalScore,
          answersSummary: nextAnswers,
        },
      });
      if (evalRes) {
        setQuizStep('result');
      }
    }
  };

  if (!appDef) {
    return (
      <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-10 text-center space-y-4">
        <h1 className="font-serif text-3xl text-[#3D3830]">App not found</h1>
        <p className="text-sm text-[#5C5449]">
          This tool is either unavailable or its link has changed.
        </p>
        <Link
          to="/app/apps"
          className="inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Apps</span>
        </Link>
      </div>
    );
  }

  const profileOptions = profiles.map((p) => ({
    value: p.id,
    label: p.is_default
      ? p.short_name
        ? `You (${p.short_name})`
        : 'You'
      : p.short_name?.trim() || p.name,
  }));

  const otherPartnerProfiles = profiles.filter((p) => p.id !== selectedProfileId);
  const partnerProfileOptions = otherPartnerProfiles.map((p) => ({
    value: p.id,
    label: p.short_name?.trim() || p.name,
  }));
  const needsProfileWall = appDef.requiresProfile && profilesLoaded && profiles.length === 0;

  const selectedProfileLabel = useMemo(() => {
    const found = profiles.find((p) => p.id === selectedProfileId);
    if (!found) return null;
    if (found.is_default) return found.short_name ? `You (${found.short_name})` : 'You';
    return found.short_name?.trim() || found.name;
  }, [profiles, selectedProfileId]);

  return (
    <div className="max-w-4xl mx-auto space-y-7 pb-12">
      {/* Calm Top Navigation & Context Bar */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#3D3830]/10 pb-5">
        <div className="flex items-start gap-3.5 min-w-0">
          <Link
            to="/app/apps"
            aria-label="Back to Apps"
            className="mt-0.5 h-10 w-10 rounded-full border border-[#3D3830]/12 bg-[#FDFBF7] flex items-center justify-center text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs text-[#8B8275]">
              {appDef.categoryLabel} · {appDef.tagline}
            </p>
            <h1 className="font-serif text-3xl md:text-4xl font-medium text-[#3D3830] tracking-tight">
              {appDef.title}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <AstrologyModeToggle
            value={astrologyMode}
            onChange={handleModeSwitch}
            size="sm"
          />
          {profiles.length > 0 && (
            <div className="w-44">
              <CustomSelect
                value={selectedProfileId}
                onChange={handleProfileChange}
                options={profileOptions}
                ariaLabel="Switch birth profile"
                size="sm"
                surface="elevated"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => void handleToggleFavorite()}
            aria-label={isFavorite ? 'Remove from saved apps' : 'Save app'}
            className={`h-10 w-10 rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
              isFavorite
                ? 'border-[#B8965A]/40 bg-[#B8965A]/12 text-[#B8965A]'
                : 'border-[#3D3830]/12 bg-[#FDFBF7] text-[#8B8275] hover:text-[#3D3830]'
            }`}
          >
            <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>
      </header>

      {/* Profile Required Gate */}
      {needsProfileWall ? (
        <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-8 md:p-12 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-[#F1ECE3] flex items-center justify-center text-[#8B7355]">
            {renderMiniAppIcon(appDef.iconKey, 'h-5 w-5')}
          </div>
          <h2 className="font-serif text-2xl md:text-3xl font-medium text-[#3D3830]">
            Add Birth Details to Personalize {appDef.title}
          </h2>
          <p className="text-sm text-[#5C5449] max-w-md mx-auto leading-relaxed">
            Cosmic Council grounds every reading in your exact planetary degrees, houses, and active timing cycles — never generic sun-sign summaries.
          </p>
          <div className="pt-2">
            <Link
              to="/app/profiles"
              className="min-h-[44px] inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-6 py-3 text-sm font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add Your Birth Profile</span>
            </Link>
          </div>
        </section>
      ) : (
        <>
          {/* TEMPLATE A: PRE-ANALYSIS LANDING CARD */}
          {appDef.template === 'auto_brief' && !result && !isLoading && (
            <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-6 md:p-9 space-y-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-[#F1ECE3] border border-[#3D3830]/10 flex items-center justify-center text-[#8B7355] shrink-0">
                  {renderMiniAppIcon(appDef.iconKey, 'h-5 w-5')}
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#8B8275]">
                    <span>{appDef.categoryLabel}</span>
                    <span>·</span>
                    <span className="font-medium text-[#3D3830]">
                      ({astrologyMode === 'western' ? 'Western Tropical' : 'Vedic Sidereal'})
                    </span>
                    {selectedProfileLabel && (
                      <>
                        <span>·</span>
                        <span>Profile: {selectedProfileLabel}</span>
                      </>
                    )}
                  </div>
                  <h2 className="font-serif text-2xl md:text-3xl font-medium text-[#3D3830]">
                    Ready to generate your {appDef.title}
                  </h2>
                  <p className="text-sm text-[#5C5449] leading-relaxed max-w-2xl">
                    {appDef.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => void executeMiniApp({ forceRefresh: false })}
                  className="min-h-[46px] inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-6 py-3 text-sm font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 text-[#B8965A]" />
                  <span>Generate Analysis</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {/* TEMPLATE B: BIRTH CHART BREAKDOWN EXPLORER */}
          {appDef.template === 'domain_explorer' && (
            <section className="space-y-5">
              {/* Domain Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {breakdownDomains.map((dom) => {
                  const isActive = dom.id === activeDomainId;
                  return (
                    <button
                      key={dom.id}
                      type="button"
                      onClick={() => {
                        setActiveDomainId(dom.id);
                        setActiveTopicId(null);
                        setResult(null);
                      }}
                      className={`px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-[#4A453D] text-[#FAF7F2]'
                          : 'bg-[#F1ECE3] text-[#5C5449] hover:text-[#3D3830] hover:bg-[#EAE3D7]'
                      }`}
                    >
                      {dom.title}
                    </button>
                  );
                })}
              </div>

              {/* Focused Sub-Topic Cards */}
              <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-6 space-y-4">
                <div>
                  <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                    {activeDomain.title}
                  </h2>
                  <p className="text-xs text-[#5C5449] mt-0.5">{activeDomain.subtitle}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeDomain.topics.map((topic) => {
                    const isSelected = activeTopicId === topic.id;
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        disabled={isLoading}
                        onClick={() =>
                          void handleSelectBreakdownTopic(activeDomain.id, topic.id, topic.label)
                        }
                        className={`rounded-2xl p-4 text-left border transition-colors cursor-pointer disabled:opacity-60 ${
                          isSelected
                            ? 'bg-[#4A453D] text-[#FAF7F2] border-[#4A453D]'
                            : 'bg-[#FAF7F2] text-[#3D3830] border-[#3D3830]/10 hover:bg-[#F1ECE3]'
                        }`}
                      >
                        <p className="text-sm font-medium">{topic.label}</p>
                        <p
                          className={`mt-1 text-[11px] leading-relaxed ${
                            isSelected ? 'text-[#FAF7F2]/80' : 'text-[#8B8275]'
                          }`}
                        >
                          {topic.summary}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* TEMPLATE C: FORM-INPUT READINGS */}
          {appDef.template === 'form_reading' && (
            <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-6 md:p-7 space-y-5">
              {appDef.slug === 'love-compatibility' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                        Who would you like to compare with?
                      </h2>
                      <p className="text-xs text-[#5C5449] mt-0.5">
                        Choose a saved birth profile for full dual-chart synastry, or enter a partner’s name and birth date.
                      </p>
                    </div>
                    {otherPartnerProfiles.length > 0 && (
                      <div className="inline-flex items-center p-1 rounded-xl bg-[#F1ECE3] border border-[#3D3830]/10">
                        <button
                          type="button"
                          onClick={() => setPartnerMode('saved')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                            partnerMode === 'saved'
                              ? 'bg-[#4A453D] text-[#FAF7F2]'
                              : 'text-[#5C5449] hover:text-[#3D3830]'
                          }`}
                        >
                          Saved Profile
                        </button>
                        <button
                          type="button"
                          onClick={() => setPartnerMode('manual')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                            partnerMode === 'manual'
                              ? 'bg-[#4A453D] text-[#FAF7F2]'
                              : 'text-[#5C5449] hover:text-[#3D3830]'
                          }`}
                        >
                          Enter Birth Date
                        </button>
                      </div>
                    )}
                  </div>

                  {partnerMode === 'saved' && otherPartnerProfiles.length > 0 ? (
                    <div className="max-w-md">
                      <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                        Second Profile
                      </label>
                      <CustomSelect
                        value={partnerProfileId}
                        onChange={setPartnerProfileId}
                        placeholder="Select a saved profile..."
                        options={otherPartnerProfiles.map((p) => ({
                          value: p.id,
                          label: p.short_name?.trim() || p.name,
                        }))}
                        ariaLabel="Select partner birth profile"
                        surface="canvas"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                          Partner’s Name
                        </label>
                        <input
                          type="text"
                          value={partnerName}
                          onChange={(e) => setPartnerName(e.target.value)}
                          placeholder="e.g., Maya"
                          className="w-full rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/12 px-4 py-3 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/35"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                          Partner’s Birth Date
                        </label>
                        <CustomDatePicker
                          value={partnerDob}
                          onChange={setPartnerDob}
                          placeholder="Select birth date"
                          ariaLabel="Partner birth date"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={
                      isLoading ||
                      (partnerMode === 'saved'
                        ? !partnerProfileId
                        : !partnerDob.trim())
                    }
                    onClick={() =>
                      void executeMiniApp({
                        partnerProfileId: partnerMode === 'saved' ? partnerProfileId : null,
                        inputs:
                          partnerMode === 'saved'
                            ? {}
                            : { partnerName: partnerName.trim() || 'Partner', partnerDob },
                      })
                    }
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-6 py-3 text-sm font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors disabled:opacity-45 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Comparing charts & rhythm...</span>
                      </>
                    ) : (
                      <>
                        <span>Explore Compatibility</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {appDef.slug === 'dream-interpreter' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                      Describe the dream while it is fresh
                    </h2>
                    <p className="text-xs text-[#5C5449] mt-0.5">
                      Include key images, settings, people, or the strongest feeling you woke up with.
                    </p>
                  </div>
                  <textarea
                    rows={4}
                    value={dreamText}
                    onChange={(e) => setDreamText(e.target.value)}
                    placeholder="I was standing on a balcony overlooking a quiet sea at dusk..."
                    className="w-full rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/12 px-4 py-3.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/35 leading-relaxed"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-[#8B8275]">Sample prompts:</span>
                    {DREAM_EXAMPLES.map((ex, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setDreamText(ex)}
                        className="text-left text-[11px] text-[#5C5449] underline underline-offset-4 hover:text-[#3D3830] cursor-pointer"
                      >
                        Example {i + 1}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={isLoading || !dreamText.trim()}
                    onClick={() => void executeMiniApp({ inputs: { dreamText: dreamText.trim() } })}
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-6 py-3 text-sm font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors disabled:opacity-45 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Unpacking symbols...</span>
                      </>
                    ) : (
                      <>
                        <span>Interpret Dream</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {appDef.slug === 'affirmations-generator' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                      What are you navigating right now?
                    </h2>
                    <p className="text-xs text-[#5C5449] mt-0.5">
                      Share a current intention, transition, or quiet tension to tailor affirmations to your chart.
                    </p>
                  </div>
                  <textarea
                    rows={3}
                    value={situationText}
                    onChange={(e) => setSituationText(e.target.value)}
                    placeholder="e.g., Preparing for a career change and wanting steadier self-trust..."
                    className="w-full rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/12 px-4 py-3.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/35 leading-relaxed"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-[#8B8275]">Try:</span>
                    {AFFIRMATION_EXAMPLES.map((ex, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSituationText(ex)}
                        className="text-left text-[11px] text-[#5C5449] underline underline-offset-4 hover:text-[#3D3830] cursor-pointer"
                      >
                        Prompt {i + 1}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={isLoading || !situationText.trim()}
                    onClick={() =>
                      void executeMiniApp({ inputs: { situation: situationText.trim() } })
                    }
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-6 py-3 text-sm font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors disabled:opacity-45 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Crafting affirmations...</span>
                      </>
                    ) : (
                      <>
                        <span>Generate Affirmations</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {appDef.slug === 'salary-negotiator' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                      Share your offer or compensation goal
                    </h2>
                    <p className="text-xs text-[#5C5449] mt-0.5">
                      Include role level, offered package, target range, and timeline for three tailored scripts.
                    </p>
                  </div>
                  <textarea
                    rows={4}
                    value={offerContext}
                    onChange={(e) => setOfferContext(e.target.value)}
                    placeholder="e.g., Offered ₹36L base for Principal Designer, targeting ₹42L or stronger ESOP allocation..."
                    className="w-full rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/12 px-4 py-3.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/35 leading-relaxed"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOfferContext(OFFER_EXAMPLES[0])}
                      className="text-[11px] text-[#5C5449] underline underline-offset-4 hover:text-[#3D3830] cursor-pointer"
                    >
                      Use sample offer scenario
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={isLoading || !offerContext.trim()}
                    onClick={() =>
                      void executeMiniApp({ inputs: { offerContext: offerContext.trim() } })
                    }
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-6 py-3 text-sm font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors disabled:opacity-45 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Drafting negotiation scripts...</span>
                      </>
                    ) : (
                      <>
                        <span>Draft Negotiation Scripts</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {appDef.slug === 'birth-chart-matching' && (
                <div className="space-y-5">
                  <div>
                    <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                      Compare two birth charts
                    </h2>
                    <p className="text-xs text-[#5C5449] mt-0.5">
                      {astrologyMode === 'western'
                        ? 'Pick a saved partner profile for full Sun, Moon, Rising & Placidus synastry, or enter partner birth details below.'
                        : 'Pick a saved partner profile for full Moon, Nakshatra & Navamsa matching, or enter partner birth details below.'}
                    </p>
                  </div>

                  {partnerProfileOptions.length > 0 && (
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F1ECE3] border border-[#3D3830]/10 w-fit">
                      <button
                        type="button"
                        onClick={() => setPartnerMode('saved')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          partnerMode === 'saved'
                            ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                            : 'text-[#5C5449] hover:text-[#3D3830]'
                        }`}
                      >
                        Saved Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => setPartnerMode('manual')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          partnerMode === 'manual'
                            ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                            : 'text-[#5C5449] hover:text-[#3D3830]'
                        }`}
                      >
                        Enter Partner Details
                      </button>
                    </div>
                  )}

                  {partnerMode === 'saved' && partnerProfileOptions.length > 0 ? (
                    <div className="max-w-sm">
                      <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                        Partner’s Saved Profile
                      </label>
                      <CustomSelect
                        value={partnerProfileId}
                        onChange={setPartnerProfileId}
                        options={partnerProfileOptions}
                        placeholder="Select saved profile..."
                        ariaLabel="Select partner birth profile for chart matching"
                        surface="canvas"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                          Partner’s Name
                        </label>
                        <input
                          type="text"
                          value={partnerName}
                          onChange={(e) => setPartnerName(e.target.value)}
                          placeholder="e.g., Meera"
                          className="w-full min-h-[44px] rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/12 px-4 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/35"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                          Partner’s Birth Date
                        </label>
                        <CustomDatePicker
                          value={partnerDob}
                          onChange={setPartnerDob}
                          placeholder="Select birth date"
                          ariaLabel="Partner birth date for chart matching"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                          Birth Time <span className="text-[#8B8275] font-normal">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={partnerBirthTime}
                          onChange={(e) => setPartnerBirthTime(e.target.value)}
                          placeholder="e.g., 08:45 AM"
                          className="w-full min-h-[44px] rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/12 px-4 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/35"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                          Birth City <span className="text-[#8B8275] font-normal">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={partnerBirthPlace}
                          onChange={(e) => setPartnerBirthPlace(e.target.value)}
                          placeholder="e.g., Bengaluru, India"
                          className="w-full min-h-[44px] rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/12 px-4 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/35"
                        />
                      </div>
                    </div>
                  )}

                  <div className="max-w-sm">
                    <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                      Relationship Context
                    </label>
                    <CustomSelect
                      value={relationshipIntent}
                      onChange={setRelationshipIntent}
                      options={RELATIONSHIP_INTENT_OPTIONS}
                      ariaLabel="Select relationship matching focus"
                      surface="canvas"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={
                      isLoading ||
                      (partnerMode === 'saved' ? !partnerProfileId : !partnerDob.trim())
                    }
                    onClick={() =>
                      void executeMiniApp({
                        partnerProfileId: partnerMode === 'saved' ? partnerProfileId : null,
                        inputs:
                          partnerMode === 'saved'
                            ? { relationshipIntent }
                            : {
                                partnerName: partnerName.trim() || 'Partner',
                                partnerDob,
                                partnerBirthTime: partnerBirthTime.trim(),
                                partnerBirthPlace: partnerBirthPlace.trim(),
                                relationshipIntent,
                              },
                      })
                    }
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-6 py-3 text-sm font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors disabled:opacity-45 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Synthesizing Ashtakoot &amp; synastry...</span>
                      </>
                    ) : (
                      <>
                        <span>Match Birth Charts</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {appDef.slug === 'breakup-clarity' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                      Reflect calmly on what shifted
                    </h2>
                    <p className="text-xs text-[#5C5449] mt-0.5">
                      Share as much or as little as feels comfortable — we will map the timing lesson and emotional healing rhythm ahead.
                    </p>
                  </div>
                  <div className="max-w-sm">
                    <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                      When did this parting happen?
                    </label>
                    <CustomSelect
                      value={breakupTimeframe}
                      onChange={setBreakupTimeframe}
                      options={BREAKUP_TIMEFRAME_OPTIONS}
                      ariaLabel="Breakup timeline"
                      surface="canvas"
                    />
                  </div>
                  <textarea
                    rows={4}
                    value={breakupContext}
                    onChange={(e) => setBreakupContext(e.target.value)}
                    placeholder="e.g., We ended a 2-year relationship quietly because our life timelines diverged, and I am struggling to find emotional footing..."
                    className="w-full rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/12 px-4 py-3.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/35 leading-relaxed"
                  />
                  <button
                    type="button"
                    disabled={isLoading || !breakupContext.trim()}
                    onClick={() =>
                      void executeMiniApp({
                        inputs: {
                          timeframe: breakupTimeframe,
                          breakupContext: breakupContext.trim(),
                        },
                      })
                    }
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-6 py-3 text-sm font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors disabled:opacity-45 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Reading your healing timing...</span>
                      </>
                    ) : (
                      <>
                        <span>Explore Clarity &amp; Closure</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {appDef.slug === 'relationship-patterns' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                      What pattern keeps showing up in love?
                    </h2>
                    <p className="text-xs text-[#5C5449] mt-0.5">
                      Describe a recurring relational dynamic (or leave a brief note) to examine it through your 7th house, Venus, and Rahu–Ketu axis.
                    </p>
                  </div>
                  <textarea
                    rows={4}
                    value={patternFocus}
                    onChange={(e) => setPatternFocus(e.target.value)}
                    placeholder="e.g., I notice I either hold back my feelings too long or invest heavily before checking mutual readiness..."
                    className="w-full rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/12 px-4 py-3.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/35 leading-relaxed"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-[#8B8275]">Sample reflections:</span>
                    {PATTERN_EXAMPLES.map((ex, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPatternFocus(ex)}
                        className="text-left text-[11px] text-[#5C5449] underline underline-offset-4 hover:text-[#3D3830] cursor-pointer"
                      >
                        Example {i + 1}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() =>
                      void executeMiniApp({
                        inputs: { patternFocus: patternFocus.trim() },
                      })
                    }
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-6 py-3 text-sm font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors disabled:opacity-45 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Decoding relational themes...</span>
                      </>
                    ) : (
                      <>
                        <span>Decode My Pattern</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {appDef.slug === 'pet-bond' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                      Tell us about your companion animal
                    </h2>
                    <p className="text-xs text-[#5C5449] mt-0.5">
                      Share their name, species, and personality quirks for a warm temperament portrait and household bond reading.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                        Pet’s Name
                      </label>
                      <input
                        type="text"
                        value={petName}
                        onChange={(e) => setPetName(e.target.value)}
                        placeholder="e.g., Milo"
                        className="w-full min-h-[44px] rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/12 px-4 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/35"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                        Species
                      </label>
                      <CustomSelect
                        value={petSpecies}
                        onChange={setPetSpecies}
                        options={PET_SPECIES_OPTIONS}
                        ariaLabel="Select pet species"
                        surface="canvas"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                        Birth or Adoption Date <span className="text-[#8B8275] font-normal">(optional)</span>
                      </label>
                      <CustomDatePicker
                        value={petDate}
                        onChange={setPetDate}
                        placeholder="Select date"
                        ariaLabel="Pet birth or adoption date"
                      />
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    value={petQuirks}
                    onChange={(e) => setPetQuirks(e.target.value)}
                    placeholder="e.g., Golden Retriever who greets everyone at the door, sleeps by my desk during work calls, and gets dramatically excited about walks..."
                    className="w-full rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/12 px-4 py-3.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/35 leading-relaxed"
                  />
                  <button
                    type="button"
                    disabled={isLoading || !petName.trim()}
                    onClick={() =>
                      void executeMiniApp({
                        inputs: {
                          petName: petName.trim(),
                          petSpecies,
                          petDate: petDate.trim(),
                          petQuirks: petQuirks.trim(),
                        },
                      })
                    }
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-6 py-3 text-sm font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors disabled:opacity-45 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Reading bond &amp; temperament...</span>
                      </>
                    ) : (
                      <>
                        <span>Explore Pet Bond</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* TEMPLATE D: GUIDED QUIZ (PLANET STRENGTH TESTER) */}
          {appDef.template === 'guided_quiz' && (
            <section className="space-y-5">
              {quizStep === 'select' && (
                <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-6 md:p-8 space-y-5">
                  <div>
                    <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                      Choose a planet to assess
                    </h2>
                    <p className="text-xs text-[#5C5449] mt-1">
                      Answer 5 real-world behavioral questions to compare lived experience against your natal placement.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {PLANET_LIST.map((planet) => (
                      <button
                        key={planet}
                        type="button"
                        disabled={isLoading}
                        onClick={() => void handleStartPlanetQuiz(planet)}
                        className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/12 px-4 py-5 text-center hover:bg-[#F1ECE3] hover:border-[#3D3830]/25 transition-colors cursor-pointer disabled:opacity-55"
                      >
                        <p className="font-serif text-xl font-medium text-[#3D3830]">{planet}</p>
                        <p className="mt-1 text-[11px] text-[#8B8275]">5 questions</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {quizStep === 'quiz' && quizQuestions[quizAnswers.length] && (
                <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-6 md:p-8 space-y-6">
                  <div className="flex items-center justify-between text-xs text-[#8B8275]">
                    <span>
                      Assessing <strong className="font-medium text-[#3D3830]">{selectedPlanet}</strong>
                      {planetNatalMeta?.sign
                        ? ` · Natal ${planetNatalMeta.sign} (House ${planetNatalMeta.house})`
                        : ''}
                    </span>
                    <span className="font-mono tabular-nums">
                      {quizAnswers.length + 1} / {quizQuestions.length}
                    </span>
                  </div>

                  <div className="h-1.5 w-full rounded-full bg-[#F1ECE3] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#B8965A] transition-all"
                      style={{
                        width: `${Math.round(((quizAnswers.length + 1) / quizQuestions.length) * 100)}%`,
                      }}
                    />
                  </div>

                  <h3 className="font-serif text-2xl font-medium text-[#3D3830] leading-snug">
                    {quizQuestions[quizAnswers.length].question}
                  </h3>

                  <div className="space-y-2.5">
                    {quizQuestions[quizAnswers.length].options.map((opt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={isLoading}
                        onClick={() => void handleAnswerPlanetQuestion(opt, idx + 1)}
                        className="w-full rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/12 px-5 py-3.5 text-left text-sm text-[#3D3830] hover:bg-[#4A453D] hover:text-[#FAF7F2] hover:border-[#4A453D] transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setQuizStep('select');
                      setQuizAnswers([]);
                      setSelectedPlanet(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-[#8B8275] hover:text-[#3D3830] cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Pick a different planet</span>
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="rounded-2xl bg-[#7A3E36]/8 border border-[#7A3E36]/20 px-5 py-4 text-sm text-[#7A3E36]">
              {errorMsg}
            </div>
          )}

          {/* Loading Skeleton */}
          {isLoading && (
            <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-8 md:p-10 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-6 w-6 text-[#B8965A] animate-spin" />
              <p className="font-serif text-xl text-[#3D3830]">
                {appDef.slug === 'current-transits'
                  ? `Mapping current ${astrologyMode === 'western' ? 'Tropical' : 'Sidereal'} sky positions...`
                  : appDef.slug === 'numerology'
                  ? 'Calculating verified Pythagorean matrix...'
                  : 'Preparing your reading...'}
              </p>
              <p className="text-xs text-[#8B8275]">
                Grounding insight directly in your chart placements and active timing cycles.
              </p>
            </section>
          )}

          {/* DETERMINISTIC STRUCTURED HEADER (Transits Table / Dasha Ladder / Numerology Grid) */}
          {!isLoading && result?.structured && (
            <section className="rounded-3xl bg-gradient-to-br from-[#1F2229] to-[#292D36] p-6 md:p-7 text-[#F4EFE6] space-y-5">
              <div>
                {result.structured.eyebrow && (
                  <p className="text-xs text-[#F4EFE6]/65">{result.structured.eyebrow}</p>
                )}
                {result.structured.headline && (
                  <h2 className="mt-1 font-serif text-2xl md:text-3xl font-medium text-[#F4EFE6]">
                    {result.structured.headline}
                  </h2>
                )}
              </div>

              {result.structured.metrics && result.structured.metrics.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {result.structured.metrics.map((m, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl bg-[#F4EFE6]/6 border border-[#F4EFE6]/10 px-4 py-3.5"
                    >
                      <p className="text-[11px] text-[#F4EFE6]/60">{m.label}</p>
                      <p className="mt-1 font-mono tabular-nums text-base md:text-lg font-medium text-[#F4EFE6]">
                        {m.value}
                      </p>
                      {m.hint && (
                        <p className="mt-0.5 text-[11px] text-[#B8965A] font-mono tabular-nums">
                          {m.hint}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {result.structured.table && result.structured.table.rows.length > 0 && (
                <div className="overflow-x-auto rounded-2xl border border-[#F4EFE6]/10 bg-[#1F2229]/60">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#F4EFE6]/12 text-[#F4EFE6]/65">
                        {result.structured.table.columns.map((col, idx) => (
                          <th key={idx} className="py-2.5 px-3.5 font-medium whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F4EFE6]/8 font-mono tabular-nums">
                      {result.structured.table.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-[#F4EFE6]/5 transition-colors">
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className={`py-2.5 px-3.5 whitespace-nowrap ${
                                cIdx === 0
                                  ? 'font-sans font-medium text-[#F4EFE6]'
                                  : cIdx === row.length - 1
                                  ? 'text-[#B8965A]'
                                  : 'text-[#F4EFE6]/80'
                              }`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* EDITORIAL MARKDOWN OUTPUT CARD */}
          {!isLoading && result?.markdown && (
            <article className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-6 md:p-9 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#3D3830]/8 text-xs text-[#8B8275]">
                <div className="flex flex-wrap items-center gap-2">
                  <span>
                    {result.profileUsed ? `${result.profileUsed.short_name || result.profileUsed.name} · ` : ''}
                    {result.cacheHit ? 'Loaded from saved reading' : 'Freshly synthesized'}
                    {result.cachedAt ? ` · ${new Date(result.cachedAt).toLocaleDateString()}` : ''}
                  </span>
                  <span className="font-medium text-[#3D3830]">
                    ({(result.astrologyMode || astrologyMode) === 'western' ? 'Western' : 'Vedic'})
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {appDef.template === 'auto_brief' && (
                    <button
                      type="button"
                      onClick={() => void executeMiniApp({ forceRefresh: true })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/12 bg-[#FAF7F2] px-3 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Analyse again</span>
                    </button>
                  )}
                  {appDef.template === 'domain_explorer' && activeTopic && (
                    <button
                      type="button"
                      onClick={() =>
                        void handleSelectBreakdownTopic(
                          activeDomain.id,
                          activeTopic.id,
                          activeTopic.label,
                          true
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/12 bg-[#FAF7F2] px-3 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Analyse again</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={savingToNotes}
                    onClick={() => void handleSaveToNotes()}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer disabled:opacity-55 ${
                      savedToNotes
                        ? 'border-[#2D6A4F]/30 bg-[#2D6A4F]/10 text-[#2D6A4F]'
                        : 'border-[#3D3830]/12 bg-[#FAF7F2] text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3]'
                    }`}
                  >
                    {savedToNotes ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Saved to Notes</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-3.5 w-3.5" />
                        <span>{savingToNotes ? 'Saving...' : 'Save to Notes'}</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyMarkdown}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/12 bg-[#FAF7F2] px-3 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[#2D6A4F]" />
                        <span className="text-[#2D6A4F]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {saveNoteError && (
                <div className="rounded-2xl bg-[#7A3E36]/8 border border-[#7A3E36]/20 px-4 py-2.5 text-xs text-[#7A3E36]">
                  {saveNoteError}
                </div>
              )}

              <div className="space-y-4">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h2 className="font-serif text-3xl font-medium text-[#3D3830] pt-2 pb-1 border-b border-[#3D3830]/10">
                        {children}
                      </h2>
                    ),
                    h2: ({ children }) => (
                      <h2 className="font-serif text-2xl md:text-3xl font-medium text-[#3D3830] pt-3">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="font-serif text-2xl font-medium text-[#3D3830] pt-4">
                        {children}
                      </h3>
                    ),
                    h4: ({ children }) => (
                      <h4 className="font-serif text-lg font-medium text-[#3D3830] pt-2">
                        {children}
                      </h4>
                    ),
                    p: ({ children }) => (
                      <p className="text-sm md:text-[15px] text-[#5C5449] leading-[1.78]">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc pl-5 space-y-1.5 text-sm md:text-[15px] text-[#5C5449] marker:text-[#B8965A]">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-5 space-y-1.5 text-sm md:text-[15px] text-[#5C5449] marker:text-[#B8965A]">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => <li className="leading-[1.7]">{children}</li>,
                    strong: ({ children }) => (
                      <strong className="font-semibold text-[#3D3830]">{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic text-[#5C5449]">{children}</em>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-[#B8965A]/55 bg-[#FAF7F2] rounded-2xl py-3 px-5 text-sm text-[#5C5449]">
                        {children}
                      </blockquote>
                    ),
                    hr: () => <hr className="border-[#3D3830]/10 my-5" />,
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-4 rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2]">
                        <table className="w-full text-xs text-left border-collapse">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-[#F1ECE3] text-[#3D3830]">{children}</thead>
                    ),
                    th: ({ children }) => (
                      <th className="px-4 py-2.5 font-medium border-b border-[#3D3830]/12">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="px-4 py-2.5 border-b border-[#3D3830]/8 text-[#5C5449]">
                        {children}
                      </td>
                    ),
                    code: ({ children }) => (
                      <code className="font-mono text-xs bg-[#F1ECE3] px-1.5 py-0.5 rounded text-[#3D3830]">
                        {children}
                      </code>
                    ),
                  }}
                >
                  {result.markdown}
                </ReactMarkdown>
              </div>

              {/* Seamless Handoff to Chat + Reset for Quiz */}
              <div className="pt-5 border-t border-[#3D3830]/10 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDiscussInChat}
                    className="min-h-[42px] inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Explore Deeper in Chat</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>

                  {appDef.template === 'guided_quiz' && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuizStep('select');
                        setSelectedPlanet(null);
                        setQuizAnswers([]);
                        setResult(null);
                      }}
                      className="min-h-[42px] inline-flex items-center gap-2 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-5 py-2.5 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Test Another Planet</span>
                    </button>
                  )}
                </div>

                <Link
                  to="/app/apps"
                  className="text-xs font-medium text-[#5C5449] hover:text-[#3D3830] underline underline-offset-4"
                >
                  Back to Apps
                </Link>
              </div>
            </article>
          )}

          {/* PAST READINGS HISTORY */}
          {!isLoading && (isLoadingReadings || pastReadings.length > 0) && (
            <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-6 md:p-7 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#8B7355]" />
                  <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                    Past Readings
                  </h3>
                </div>
                {pastReadings.length > 0 && (
                  <span className="font-mono text-xs text-[#8B8275] tabular-nums">
                    {pastReadings.length} saved
                  </span>
                )}
              </div>

              {isLoadingReadings && pastReadings.length === 0 ? (
                <p className="text-xs text-[#8B8275]">Loading past readings...</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pastReadings.map((reading) => {
                    const isOpen = result?.readingId === reading.id;
                    return (
                      <button
                        key={reading.id}
                        type="button"
                        onClick={() => handleOpenPastReading(reading)}
                        className={`rounded-2xl border p-4 text-left transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                          isOpen
                            ? 'bg-[#F1ECE3] border-[#3D3830]/28'
                            : 'bg-[#FAF7F2] border-[#3D3830]/10 hover:bg-[#F1ECE3]/70'
                        }`}
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium text-[#3D3830] truncate">
                            {reading.title}
                          </p>
                          <p className="text-[11px] text-[#8B8275] truncate">
                            {reading.profile_name ? `${reading.profile_name} · ` : ''}
                            {reading.astrology_mode === 'western' ? 'Western' : 'Vedic'} ·{' '}
                            {new Date(reading.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-[#8B7355] shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default MiniAppRunner;
