import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Compass,
  FileText,
  Hash,
  Heart,
  HeartHandshake,
  LayoutGrid,
  MessageCircle,
  MessageSquare,
  Plus,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import AstrologyModeToggle from './AstrologyModeToggle';
import TimingRadarDashboard from './TimingRadarDashboard';
import { getUserProfileDisplayLabel } from './chatUtilities';
import {
  CLIENT_MINI_APPS,
  PREVIEW_HOME_SUMMARY,
  renderMiniAppIcon,
} from './miniAppsClientData';
import {
  MINI_APP_CATEGORIES,
  type HomeSummaryResponse,
  type MiniAppCategory,
  type MiniAppDefinition,
} from './miniAppsTypes';

const FAVORITES_STORAGE_KEY = 'cc_favorite_apps_v1';

const formatRelativeDate = (iso: string): string => {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '';
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const AppDashboardHome: React.FC = () => {
  const { appUser, stats, isPreviewMode, getAccessToken, astrologyMode, setAstrologyMode } = useAuth();
  const [summary, setSummary] = useState<HomeSummaryResponse | null>(() =>
    isPreviewMode ? PREVIEW_HOME_SUMMARY : null
  );
  const [catalogApps, setCatalogApps] = useState<MiniAppDefinition[]>(CLIENT_MINI_APPS);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(!isPreviewMode);
  const [activeAppCategory, setActiveAppCategory] = useState<
    'all' | 'popular' | MiniAppCategory | 'favorites'
  >('popular');
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>(() => {
    if (isPreviewMode) return PREVIEW_HOME_SUMMARY.favoriteAppSlugs;
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as string[];
    } catch {
      // Ignore storage errors
    }
    return [];
  });

  const loadHomeSummary = useCallback(async () => {
    if (isPreviewMode) {
      setSummary(PREVIEW_HOME_SUMMARY);
      setCatalogApps(CLIENT_MINI_APPS);
      setFavoriteSlugs(PREVIEW_HOME_SUMMARY.favoriteAppSlugs);
      setSummaryLoading(false);
      return;
    }
    setSummaryLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setSummaryLoading(false);
        return;
      }
      const [res, catRes] = await Promise.all([
        fetch('/api/apps/home-summary', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/apps/catalog', {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
      ]);
      if (res.ok) {
        const data = (await res.json()) as HomeSummaryResponse;
        setSummary(data);
        if (Array.isArray(data.favoriteAppSlugs)) {
          setFavoriteSlugs(data.favoriteAppSlugs);
          try {
            localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(data.favoriteAppSlugs));
          } catch {
            // Ignore quota
          }
        }
      }
      if (catRes && catRes.ok) {
        const catData = await catRes.json();
        if (Array.isArray(catData.apps)) {
          setCatalogApps(catData.apps as MiniAppDefinition[]);
        }
        if (Array.isArray(catData.favoriteSlugs)) {
          setFavoriteSlugs(catData.favoriteSlugs as string[]);
        }
      }
    } catch {
      // Non-fatal — hub renders cleanly with default guides & featured apps
    } finally {
      setSummaryLoading(false);
    }
  }, [getAccessToken, isPreviewMode]);

  useEffect(() => {
    void loadHomeSummary();
  }, [loadHomeSummary]);

  const handleToggleFavorite = async (e: React.MouseEvent, appSlug: string) => {
    e.preventDefault();
    e.stopPropagation();
    const currentlyFav = favoriteSlugs.includes(appSlug);
    const nextFavs = currentlyFav
      ? favoriteSlugs.filter((s) => s !== appSlug)
      : [...favoriteSlugs, appSlug];

    setFavoriteSlugs(nextFavs);
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(nextFavs));
    } catch {
      // Ignore storage
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
      body: JSON.stringify({ appSlug, desired: !currentlyFav }),
    }).catch(() => {});
  };

  const tierProfileLimit =
    appUser?.tier === 'guru' ? 200 : appUser?.tier === 'pro' ? 100 : 10;

  const tierLabel =
    appUser?.tier === 'guru'
      ? 'Guru Plan'
      : appUser?.tier === 'pro'
      ? 'Professional Plan'
      : 'Personal Plan';

  const displayedApps = useMemo(() => {
    if (activeAppCategory === 'all') {
      const featured = catalogApps.filter((a) => a.featuredOnHome);
      return featured.length > 0 ? featured : catalogApps.slice(0, 8);
    }
    if (activeAppCategory === 'popular') {
      return catalogApps.filter((a) => a.popular).slice(0, 8);
    }
    if (activeAppCategory === 'favorites') {
      return catalogApps.filter((a) => favoriteSlugs.includes(a.slug));
    }
    return catalogApps.filter((a) => a.category === activeAppCategory);
  }, [catalogApps, activeAppCategory, favoriteSlugs]);

  const guidesToShow = useMemo(() => {
    const base =
      summary && summary.recentGuides.length > 0
        ? summary.recentGuides
        : PREVIEW_HOME_SUMMARY.recentGuides;

    if (astrologyMode === 'western') {
      const westernPriority = [
        'expert-western_astrologer',
        'expert-modern_astrologer',
        'expert-council_synthesis',
      ];
      return [...base].sort((a, b) => {
        const idxA = westernPriority.indexOf(a.id);
        const idxB = westernPriority.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    }
    return base;
  }, [summary, astrologyMode]);

  const lowCreditsThreshold =
    appUser?.tier === 'guru' ? 8000 : appUser?.tier === 'pro' ? 2500 : 500;
  const lowCreditsAlert =
    typeof appUser?.credits_balance === 'number' &&
    appUser.credits_balance < lowCreditsThreshold;

  return (
    <div className="space-y-10 pb-8">
      {/* Editorial Greeting Header */}
      <section className="border-b border-[#3D3830]/10 pb-7 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#8B8275]">
            {tierLabel} · {appUser?.currency_pref || 'INR'} · {getUserProfileDisplayLabel(appUser)}
          </p>
          <AstrologyModeToggle value={astrologyMode} onChange={setAstrologyMode} />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <h1 className="font-serif text-4xl md:text-5xl font-medium text-[#3D3830] tracking-tight">
            Welcome back
          </h1>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              to="/app/profiles?new=1"
              className="min-h-[44px] inline-flex items-center gap-2 rounded-full border border-[#3D3830]/20 bg-[#FDFBF7] px-5 py-3 text-sm font-medium text-[#3D3830] transition-colors hover:bg-[#F1ECE3] whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4 text-[#8B7355]" />
              <span>New Chart</span>
            </Link>
            <Link
              to="/app/chat"
              className="min-h-[44px] inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-6 py-3 text-sm font-medium text-[#FAF7F2] transition-colors hover:bg-[#38342E] whitespace-nowrap shrink-0"
            >
              <span>Open Chat</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 0: PRIMARY QUICK-ACTION CARD BUTTONS (Chat, BirthCharts, Apps, Reports) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/app/chat"
          className="group rounded-3xl bg-[#DDD4C5] hover:bg-[#D5CBB9] active:scale-[0.985] p-5 sm:p-6 border border-[#3D3830]/20 hover:border-[#3D3830]/35 text-[#3D3830] hover:-translate-y-1 hover:shadow-[0_20px_44px_-22px_rgba(61,56,48,0.18)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col justify-between gap-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="h-10 w-10 rounded-2xl bg-[#FAF7F2]/65 border border-[#3D3830]/15 flex items-center justify-center text-[#5C5449] group-hover:text-[#3D3830] transition-colors">
              <MessageSquare className="h-5 w-5" />
            </div>
            <span className="h-7 w-7 rounded-full bg-[#FAF7F2]/65 group-hover:bg-[#FAF7F2] border border-[#3D3830]/10 flex items-center justify-center transition-colors">
              <ArrowRight className="h-3.5 w-3.5 text-[#3D3830] group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          <div>
            <h2 className="font-serif text-2xl font-medium text-[#3D3830] tracking-tight">Chat</h2>
          </div>
        </Link>

        <Link
          to="/app/profiles"
          className="group rounded-3xl bg-[#DDD4C5] hover:bg-[#D5CBB9] active:scale-[0.985] p-5 sm:p-6 border border-[#3D3830]/20 hover:border-[#3D3830]/35 text-[#3D3830] hover:-translate-y-1 hover:shadow-[0_20px_44px_-22px_rgba(61,56,48,0.18)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col justify-between gap-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="h-10 w-10 rounded-2xl bg-[#FAF7F2]/65 border border-[#3D3830]/15 flex items-center justify-center text-[#5C5449] group-hover:text-[#3D3830] transition-colors">
              <UserPlus className="h-5 w-5" />
            </div>
            <span className="h-7 w-7 rounded-full bg-[#FAF7F2]/65 group-hover:bg-[#FAF7F2] border border-[#3D3830]/10 flex items-center justify-center transition-colors">
              <ArrowRight className="h-3.5 w-3.5 text-[#3D3830] group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          <div>
            <h2 className="font-serif text-2xl font-medium text-[#3D3830] tracking-tight">BirthCharts</h2>
          </div>
        </Link>

        <Link
          to="/app/apps"
          className="group rounded-3xl bg-[#DDD4C5] hover:bg-[#D5CBB9] active:scale-[0.985] p-5 sm:p-6 border border-[#3D3830]/20 hover:border-[#3D3830]/35 text-[#3D3830] hover:-translate-y-1 hover:shadow-[0_20px_44px_-22px_rgba(61,56,48,0.18)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col justify-between gap-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="h-10 w-10 rounded-2xl bg-[#FAF7F2]/65 border border-[#3D3830]/15 flex items-center justify-center text-[#5C5449] group-hover:text-[#3D3830] transition-colors">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <span className="h-7 w-7 rounded-full bg-[#FAF7F2]/65 group-hover:bg-[#FAF7F2] border border-[#3D3830]/10 flex items-center justify-center transition-colors">
              <ArrowRight className="h-3.5 w-3.5 text-[#3D3830] group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          <div>
            <h2 className="font-serif text-2xl font-medium text-[#3D3830] tracking-tight">Apps</h2>
          </div>
        </Link>

        <Link
          to="/app/reports"
          className="group rounded-3xl bg-[#DDD4C5] hover:bg-[#D5CBB9] active:scale-[0.985] p-5 sm:p-6 border border-[#3D3830]/20 hover:border-[#3D3830]/35 text-[#3D3830] hover:-translate-y-1 hover:shadow-[0_20px_44px_-22px_rgba(61,56,48,0.18)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col justify-between gap-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="h-10 w-10 rounded-2xl bg-[#FAF7F2]/65 border border-[#3D3830]/15 flex items-center justify-center text-[#5C5449] group-hover:text-[#3D3830] transition-colors">
              <FileText className="h-5 w-5" />
            </div>
            <span className="h-7 w-7 rounded-full bg-[#FAF7F2]/65 group-hover:bg-[#FAF7F2] border border-[#3D3830]/10 flex items-center justify-center transition-colors">
              <ArrowRight className="h-3.5 w-3.5 text-[#3D3830] group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
          <div>
            <h2 className="font-serif text-2xl font-medium text-[#3D3830] tracking-tight">Reports</h2>
          </div>
        </Link>
      </section>

      {/* SECTION 1: CONTINUE CONVERSATIONS (Distinct Chat-Bubble Cards) */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-[#8B8275]">Recent Threads</p>
            <h2 className="font-serif text-2xl md:text-3xl font-medium text-[#3D3830]">
              Continue Conversations
            </h2>
          </div>
          <Link
            to="/app/chat"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors whitespace-nowrap"
          >
            <span>Open Chat</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {summaryLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-36 rounded-3xl rounded-tl-md bg-[#EAE3D7]/70 border border-[#3D3830]/12 animate-pulse"
              />
            ))}
          </div>
        ) : summary && summary.recentConversations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {summary.recentConversations.map((conv) => {
              const isCompanion = conv.pillar === 'companion';
              const metaLine = isCompanion
                ? `Companion · ${conv.companion_role || 'Conversation'}`
                : `Council${conv.profile_label ? ` · ${conv.profile_label}` : ' · General'}`;
              return (
                <Link
                  key={conv.id}
                  to={`/app/chat/${conv.id}`}
                  className="group relative flex flex-col justify-between rounded-3xl rounded-tl-md bg-[#FDFBF7] border border-[#3D3830]/15 p-5 shadow-[0_8px_20px_-14px_rgba(61,56,48,0.22)] transition-all hover:bg-[#F1ECE3]/75 hover:border-[#4A453D]/35"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-8 w-8 rounded-full bg-[#4A453D] text-[#FAF7F2] flex items-center justify-center shrink-0">
                          {isCompanion ? (
                            <HeartHandshake className="h-3.5 w-3.5 text-[#E6D3B3]" />
                          ) : (
                            <MessageCircle className="h-3.5 w-3.5 text-[#E6D3B3]" />
                          )}
                        </span>
                        <span className="text-[11px] font-medium text-[#5C5449] truncate">
                          {metaLine}
                        </span>
                      </div>
                      <span className="font-['DM_Sans',sans-serif] tabular-nums text-[11px] text-[#8B8275] shrink-0">
                        {formatRelativeDate(conv.updated_at)}
                      </span>
                    </div>

                    <div className="rounded-2xl rounded-tl-sm bg-[#F1ECE3]/75 px-3.5 py-2.5 border border-[#3D3830]/8">
                      <h3 className="font-serif text-lg font-medium text-[#3D3830] leading-snug line-clamp-2">
                        {isCompanion && conv.companion_name ? conv.companion_name : conv.title}
                      </h3>
                      {isCompanion && conv.title && (
                        <p className="mt-0.5 text-xs text-[#5C5449] truncate">{conv.title}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3.5 flex items-center justify-between text-xs font-medium text-[#4A453D] group-hover:text-[#3D3830]">
                    <span>Continue chat</span>
                    <ArrowRight className="h-3.5 w-3.5 text-[#8B7355] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl rounded-tl-md bg-[#FDFBF7] border border-[#3D3830]/15 p-6 md:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <span className="h-10 w-10 rounded-full bg-[#4A453D] text-[#FAF7F2] flex items-center justify-center shrink-0 mt-0.5">
                <MessageCircle className="h-4 w-4 text-[#E6D3B3]" />
              </span>
              <div>
                <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                  Start your first consultation or companion chat
                </h3>
                <p className="mt-1 text-xs text-[#5C5449] max-w-xl leading-relaxed">
                  Ask your {astrologyMode === 'western' ? 'Western' : 'Vedic'} Astrologer about an active timing cycle, pull a Tarot spread, or talk through what is on your mind with a matched Companion.
                </p>
              </div>
            </div>
            <Link
              to="/app/chat"
              className="min-h-[42px] inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors whitespace-nowrap shrink-0"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Start Chatting</span>
            </Link>
          </div>
        )}
      </section>

      {/* SECTION 2: GUIDES & COMPANIONS (All 6 — Dark-Warm Bento Cards) */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-[#8B8275]">Council & Companions</p>
            <h2 className="font-serif text-2xl md:text-3xl font-medium text-[#3D3830]">
              Your Guides & Companions
            </h2>
          </div>
          <Link
            to="/app/chat?pillar=companion"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors whitespace-nowrap"
          >
            <HeartHandshake className="h-3.5 w-3.5 text-[#8B7355]" />
            <span>Match a Companion</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {guidesToShow.map((guide) => {
            const href =
              guide.kind === 'companion'
                ? guide.conversationId
                  ? `/app/chat/${guide.conversationId}`
                  : '/app/chat?pillar=companion'
                : `/app/chat?pillar=council&expert=${encodeURIComponent(
                    guide.expertSlug || 'council_synthesis'
                  )}`;
            return (
              <Link
                key={guide.id}
                to={href}
                className="group flex items-start justify-between gap-3.5 rounded-3xl bg-[#F1ECE3] border border-[#3D3830]/15 p-5 transition-colors hover:bg-[#EAE3D7] hover:border-[#3D3830]/25"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="h-10 w-10 rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/12 flex items-center justify-center text-[#8B7355] shrink-0">
                    {guide.kind === 'companion' ? (
                      <HeartHandshake className="h-4 w-4" />
                    ) : guide.expertSlug === 'tarot_reader' ? (
                      <Sparkles className="h-4 w-4" />
                    ) : guide.expertSlug === 'numerologist' ? (
                      <Hash className="h-4 w-4" />
                    ) : (
                      <Compass className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#8B8275]">
                      {guide.kind === 'companion' ? 'Companion' : 'Council Guide'}
                      {guide.lastActiveAt ? ` · ${formatRelativeDate(guide.lastActiveAt)}` : ''}
                    </p>
                    <h3 className="mt-0.5 font-serif text-xl font-medium text-[#3D3830] truncate">
                      {guide.title}
                    </h3>
                    <p className="mt-1 text-xs text-[#5C5449] line-clamp-1">{guide.subtitle}</p>
                  </div>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 text-[#8B8275] group-hover:text-[#3D3830] group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: PERSONAL TIMING OVERVIEW CARD */}
      <TimingRadarDashboard />

      {/* SECTION 4: APPS BY CATEGORY + GO TO APPS (Moved below Overview Card) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs text-[#8B8275]">Daily & Chart Tools</p>
            <h2 className="font-serif text-2xl md:text-3xl font-medium text-[#3D3830]">
              Apps
            </h2>
          </div>
          <Link
            to="/app/apps"
            className="min-h-[40px] inline-flex items-center gap-2 rounded-full border border-[#3D3830]/18 bg-[#FDFBF7] px-4 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            <span>Go to All Apps ({catalogApps.length})</span>
            <ArrowRight className="h-3.5 w-3.5 text-[#8B7355]" />
          </Link>
        </div>

        {/* Aligned 8 Category Tabs */}
        <div
          role="tablist"
          aria-label="Filter home apps by category"
          className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-[#F1ECE3] border border-[#3D3830]/8 w-full sm:w-fit max-w-full"
        >
          {MINI_APP_CATEGORIES.map((cat) => {
            const isActive = activeAppCategory === cat.id;
            const favSuffix =
              cat.id === 'favorites' && favoriteSlugs.length > 0
                ? ` (${favoriteSlugs.length})`
                : '';
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveAppCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#4A453D] text-[#FAF7F2] shadow-xs'
                    : 'text-[#5C5449] hover:text-[#3D3830] hover:bg-[#FAF7F2]/60'
                }`}
              >
                {cat.label}
                {favSuffix}
              </button>
            );
          })}
        </div>

        {displayedApps.length === 0 ? (
          <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-8 text-center space-y-2">
            <p className="font-serif text-xl text-[#3D3830]">No favourite apps saved yet</p>
            <p className="text-xs text-[#5C5449]">
              Tap the heart icon on any app to keep quick access right here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {displayedApps.map((app) => {
              const isFav = favoriteSlugs.includes(app.slug);
              return (
                <Link
                  key={app.slug}
                  to={`/app/apps/${app.slug}`}
                  className="group flex flex-col justify-between rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 transition-colors hover:bg-[#F1ECE3]/65 hover:border-[#3D3830]/20"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-10 w-10 rounded-2xl bg-[#F1ECE3] border border-[#3D3830]/8 flex items-center justify-center text-[#5C5449] group-hover:text-[#3D3830] transition-colors">
                        {renderMiniAppIcon(app.iconKey, 'h-4 w-4')}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => void handleToggleFavorite(e, app.slug)}
                        aria-label={isFav ? `Remove ${app.title} from favourites` : `Add ${app.title} to favourites`}
                        className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                          isFav
                            ? 'text-[#B8965A] bg-[#B8965A]/12'
                            : 'text-[#8B8275] hover:text-[#3D3830] hover:bg-[#EAE3D7]/60'
                        }`}
                      >
                        <Heart className={`h-3.5 w-3.5 ${isFav ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#8B8275]">{app.categoryLabel}</p>
                      <h3 className="mt-0.5 font-serif text-xl font-medium text-[#3D3830]">
                        {app.shortTitle}
                      </h3>
                      <p className="mt-1 text-xs text-[#5C5449] leading-relaxed line-clamp-2">
                        {app.tagline}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#3D3830]/8 flex items-center justify-between text-xs font-medium text-[#5C5449] group-hover:text-[#3D3830]">
                    <span>Open</span>
                    <ArrowRight className="h-3.5 w-3.5 text-[#8B7355] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 5: CREDITS SNAPSHOT */}
      <section className="rounded-3xl bg-[#F1ECE3] p-7 md:p-8 border border-[#3D3830]/10 text-[#3D3830]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div>
            <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
              Credits snapshot
            </h2>
            {lowCreditsAlert && (
              <p className="mt-2 text-xs font-medium text-[#7A3E36]">
                Your credit balance is below 10% remaining —{' '}
                <Link to="/app/billing" className="underline underline-offset-4">
                  review top-up options
                </Link>
                .
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-6 md:gap-10">
            <div>
              <p className="text-xs text-[#8B8275] mb-1">Credits</p>
              <p className="font-['DM_Sans',sans-serif] tabular-nums text-2xl md:text-3xl font-medium text-[#3D3830]">
                {(appUser?.credits_balance ?? 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8B8275] mb-1">Saved Profiles</p>
              <p className="font-['DM_Sans',sans-serif] tabular-nums text-2xl md:text-3xl font-medium text-[#3D3830]">
                {stats.savedProfiles}
                <span className="text-sm text-[#8B8275]">/{tierProfileLimit}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8B8275] mb-1">Referrals</p>
              <p className="font-['DM_Sans',sans-serif] tabular-nums text-2xl md:text-3xl font-medium text-[#3D3830]">
                {stats.successfulReferrals}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AppDashboardHome;
