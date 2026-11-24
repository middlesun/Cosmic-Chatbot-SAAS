import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import CompanionAvatar from './CompanionAvatar';
import CompanionDiscoveryControls from './CompanionDiscoveryControls';
import LifeContextModal from './LifeContextModal';
import TimingRadarDashboard from './TimingRadarDashboard';
import { getUserProfileDisplayLabel } from './chatUtilities';
import {
  matchesCompanionDiscoveryFilter,
  type CompanionDiscoveryTabId,
} from './chatTypes';
import { PREVIEW_PUBLIC_COMPANIONS } from './previewFixtures';
import {
  CLIENT_MINI_APPS,
  PREVIEW_HOME_SUMMARY,
  renderMiniAppIcon,
} from './miniAppsClientData';
import {
  DEFAULT_MINI_APP_CATEGORY_RECORDS,
  type HomeSummaryResponse,
  type MiniAppCategory,
  type MiniAppCategoryRecord,
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
  const navigate = useNavigate();
  const { appUser, stats, isPreviewMode, getAccessToken, astrologyMode, setAstrologyMode } = useAuth();
  const [summary, setSummary] = useState<HomeSummaryResponse | null>(() =>
    isPreviewMode ? PREVIEW_HOME_SUMMARY : null
  );
  const [catalogApps, setCatalogApps] = useState<MiniAppDefinition[]>(CLIENT_MINI_APPS);
  const [appCategories, setAppCategories] = useState<MiniAppCategoryRecord[]>(
    DEFAULT_MINI_APP_CATEGORY_RECORDS
  );
  const [summaryLoading, setSummaryLoading] = useState<boolean>(!isPreviewMode);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [activeCompanionGroup, setActiveCompanionGroup] =
    useState<CompanionDiscoveryTabId>('all');
  const [activeCompanionChip, setActiveCompanionChip] = useState<string | null>(null);
  const [companionSearchQuery, setCompanionSearchQuery] = useState('');
  const [showAllDashboardCompanions, setShowAllDashboardCompanions] = useState(false);
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
        if (Array.isArray(catData.categories)) {
          setAppCategories(catData.categories as MiniAppCategoryRecord[]);
        }
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

  useEffect(() => {
    if (activeAppCategory === 'favorites' && favoriteSlugs.length === 0) {
      setActiveAppCategory('all');
    }
  }, [activeAppCategory, favoriteSlugs.length]);

  const homeAppCategoryTabs = useMemo(() => {
    const tabs: Array<{ id: 'all' | 'popular' | MiniAppCategory | 'favorites'; label: string }> = [
      { id: 'all', label: 'All' },
      { id: 'popular', label: 'Most Popular' },
    ];
    if (favoriteSlugs.length > 0) {
      tabs.push({ id: 'favorites', label: `Favourites (${favoriteSlugs.length})` });
    }
    for (const cat of appCategories) {
      if (!cat.isActive) continue;
      tabs.push({ id: cat.slug, label: cat.label });
    }
    return tabs;
  }, [appCategories, favoriteSlugs.length]);

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
        'expert-hellenistic_astrologer',
        'expert-vedic_astrologer',
        'expert-kp_precision',
        'expert-jaimini',
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
              return (
                <Link
                  key={conv.id}
                  to={`/app/chat/${conv.id}`}
                  className="group relative flex flex-col justify-between gap-4 rounded-3xl rounded-tl-md bg-[#FDFBF7] border border-[#3D3830]/15 p-5 shadow-[0_8px_20px_-14px_rgba(61,56,48,0.22)] transition-all hover:bg-[#F1ECE3]/75 hover:border-[#4A453D]/35"
                >
                  <div className="flex items-center justify-between gap-2.5">
                    {isCompanion ? (
                      <CompanionAvatar
                        name={conv.companion_name || conv.title || 'Companion'}
                        avatarUrl={conv.avatar_url}
                        palette={conv.monogram_palette || undefined}
                        size="sm"
                        shape="circle"
                      />
                    ) : (
                      <span className="h-9 w-9 rounded-full bg-[#4A453D] text-[#FAF7F2] flex items-center justify-center shrink-0">
                        <MessageCircle className="h-4 w-4 text-[#E6D3B3]" />
                      </span>
                    )}
                    <span className="font-['DM_Sans',sans-serif] tabular-nums text-[11px] text-[#8B8275] shrink-0">
                      {formatRelativeDate(conv.updated_at)}
                    </span>
                  </div>

                  <h3 className="font-serif text-lg font-medium text-[#3D3830] leading-snug line-clamp-2">
                    {isCompanion && conv.companion_name ? conv.companion_name : conv.title}
                  </h3>
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

      {/* SECTION 2: GUIDES & COMPANIONS */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-serif text-2xl md:text-3xl font-medium text-[#3D3830]">
            Your Guides & Companions
          </h2>
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
                  : guide.companionSlug
                  ? `/app/chat?pillar=companion&companion=${encodeURIComponent(guide.companionSlug)}`
                  : '/app/chat?pillar=companion'
                : `/app/chat?pillar=council&expert=${encodeURIComponent(
                    guide.expertSlug || 'vedic_astrologer'
                  )}`;
            const cleanTitle = guide.title.replace(/^Companion\s*·\s*/i, '');
            return (
              <Link
                key={guide.id}
                to={href}
                className="group rounded-3xl bg-[#F1ECE3] hover:bg-[#EAE3D7] active:scale-[0.985] p-5 sm:p-6 border border-[#3D3830]/15 hover:border-[#3D3830]/30 text-[#3D3830] hover:-translate-y-1 hover:shadow-[0_20px_44px_-22px_rgba(61,56,48,0.18)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col justify-between gap-4"
              >
                <div className="flex items-center justify-between gap-2">
                  {guide.kind === 'companion' ? (
                    <CompanionAvatar
                      name={cleanTitle || 'Companion'}
                      avatarUrl={guide.avatarUrl}
                      palette={guide.monogramPalette || undefined}
                      size="sm"
                      shape="circle"
                      className="!w-10 !h-10"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-2xl bg-[#FAF7F2]/80 border border-[#3D3830]/15 flex items-center justify-center text-[#8B7355] group-hover:text-[#3D3830] transition-colors shrink-0">
                      {guide.expertSlug === 'tarot_reader' ? (
                        <Sparkles className="h-5 w-5" />
                      ) : guide.expertSlug === 'numerologist' ? (
                        <Hash className="h-5 w-5" />
                      ) : (
                        <Compass className="h-5 w-5" />
                      )}
                    </div>
                  )}
                  <span className="h-7 w-7 rounded-full bg-[#FAF7F2]/75 group-hover:bg-[#FAF7F2] border border-[#3D3830]/10 flex items-center justify-center transition-colors shrink-0">
                    <ArrowRight className="h-3.5 w-3.5 text-[#3D3830] group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
                <div>
                  <h3 className="font-serif text-2xl font-medium text-[#3D3830] tracking-tight leading-snug">
                    {cleanTitle}
                  </h3>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* SECTION 2B: COMPANIONS — Pillar Tabs, Situation Search & Calm Portrait Strip */}
      {(() => {
        const baseCompanions = (() => {
          if (
            !isPreviewMode &&
            summary?.featuredCompanions &&
            summary.featuredCompanions.length > 0
          ) {
            return summary.featuredCompanions;
          }
          const previewFeatured = PREVIEW_HOME_SUMMARY.featuredCompanions || [];
          const bySlug = new Map(
            PREVIEW_PUBLIC_COMPANIONS.map((c) => [c.slug.toLowerCase(), c])
          );
          const merged: NonNullable<HomeSummaryResponse['featuredCompanions']> = [];
          const seen = new Set<string>();
          for (const item of previewFeatured) {
            const full = bySlug.get(item.slug.toLowerCase());
            seen.add(item.slug.toLowerCase());
            merged.push({
              ...full,
              ...item,
              companion_group: item.companion_group || full?.companion_group,
              situation_tags: item.situation_tags || full?.situation_tags,
              secondary_expertise: item.secondary_expertise || full?.secondary_expertise,
              skill_level: item.skill_level || full?.skill_level,
              category_tag: item.category_tag || full?.category_tag,
              short_bio: item.short_bio || full?.short_bio,
            });
          }
          for (const full of PREVIEW_PUBLIC_COMPANIONS) {
            if (!seen.has(full.slug.toLowerCase())) {
              seen.add(full.slug.toLowerCase());
              merged.push(full);
            }
          }
          return merged;
        })();

        if (baseCompanions.length === 0) return null;

        const filteredCompanions = baseCompanions.filter((comp) =>
          matchesCompanionDiscoveryFilter(comp, {
            groupTab: activeCompanionGroup,
            situationChipId: activeCompanionChip,
            searchQuery: companionSearchQuery,
          })
        );

        const isDefaultView =
          activeCompanionGroup === 'all' &&
          !activeCompanionChip &&
          !companionSearchQuery.trim();

        const displayedCompanions =
          isDefaultView && !showAllDashboardCompanions
            ? filteredCompanions.slice(0, 6)
            : filteredCompanions;

        return (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-serif text-2xl md:text-3xl font-medium text-[#3D3830]">
                Companions
              </h2>
              <Link
                to="/app/companions"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors whitespace-nowrap"
              >
                <span>Browse all</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <CompanionDiscoveryControls
              cards={baseCompanions}
              activeGroup={activeCompanionGroup}
              onChangeGroup={(group) => {
                setActiveCompanionGroup(group);
                setShowAllDashboardCompanions(false);
              }}
              activeSituationChip={activeCompanionChip}
              onChangeSituationChip={(chipId) => {
                setActiveCompanionChip(chipId);
                setShowAllDashboardCompanions(false);
              }}
              searchQuery={companionSearchQuery}
              onChangeSearchQuery={setCompanionSearchQuery}
              tabSurface="white"
              showCounts
            />

            {displayedCompanions.length === 0 ? (
              <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-6 text-center space-y-2.5">
                <p className="font-serif text-lg text-[#3D3830]">
                  No companions match this moment or search
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCompanionGroup('all');
                    setActiveCompanionChip(null);
                    setCompanionSearchQuery('');
                  }}
                  className="min-h-[36px] inline-flex items-center justify-center rounded-full border border-[#3D3830]/18 bg-[#FAF7F2] px-4 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayedCompanions.map((comp) => {
                    const targetHref = comp.last_conversation_id
                      ? `/app/chat/${comp.last_conversation_id}`
                      : `/app/chat?pillar=companion&companion=${encodeURIComponent(comp.slug)}`;
                    return (
                      <Link
                        key={comp.slug}
                        to={targetHref}
                        className="group flex items-start justify-between gap-3.5 rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/14 p-4 sm:p-5 transition-all hover:bg-[#F1ECE3]/80 hover:border-[#3D3830]/28"
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          <CompanionAvatar
                            name={comp.name}
                            avatarUrl={comp.avatar_url}
                            palette={comp.monogram_palette}
                            size="md"
                            shape="circle"
                          />
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-baseline gap-1.5 min-w-0">
                              <h3 className="font-serif text-lg font-medium text-[#3D3830] truncate">
                                {comp.name}
                              </h3>
                              <span className="font-['DM_Sans',sans-serif] tabular-nums text-[11px] text-[#8B8275] shrink-0">
                                {comp.age}
                              </span>
                            </div>
                            <p className="text-[11px] font-medium text-[#8B7355] truncate">
                              {comp.primary_expertise}
                              {comp.last_conversation_id ? ' · Active' : ''}
                            </p>
                            <p className="text-xs text-[#5C5449] leading-snug line-clamp-2 pt-0.5">
                              {comp.tagline}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="mt-1 h-4 w-4 text-[#8B8275] group-hover:text-[#3D3830] group-hover:translate-x-0.5 transition-all shrink-0" />
                      </Link>
                    );
                  })}
                </div>

                {isDefaultView && filteredCompanions.length > 6 && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setShowAllDashboardCompanions((prev) => !prev)}
                      className="min-h-[38px] inline-flex items-center gap-2 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-4 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                    >
                      <span>
                        {showAllDashboardCompanions
                          ? 'Show fewer'
                          : `Show all ${filteredCompanions.length} companions`}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })()}

      {/* Gentle Desh-Kaal-Patra Context Calibration Prompt (when primary profile < 80%) */}
      {summary?.primaryProfile &&
        (summary.primaryProfile.life_context_completeness ?? 0) < 80 && (
          <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/15 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B7355]">
                  Life Context Calibration · {summary.primaryProfile.short_name || summary.primaryProfile.name}
                </p>
                <span className="font-['JetBrains_Mono',monospace] tabular-nums text-xs font-medium text-[#3D3830]">
                  {summary.primaryProfile.life_context_completeness ?? 0}%
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#5C5449] leading-relaxed">
                Add birth time accuracy, relationship status, work mode, and 1–2 past milestones so readings stay grounded in your actual life.
              </p>
              <div className="h-1.5 w-full max-w-md rounded-full bg-[#3D3830]/10 overflow-hidden">
                <div
                  style={{ width: `${summary.primaryProfile.life_context_completeness ?? 0}%` }}
                  className="h-full rounded-full bg-[#8B7355] transition-all duration-300"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCalibrationOpen(true)}
              className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Complete Context</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </section>
        )}

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

        {/* Dynamic Category Tabs */}
        <div
          role="tablist"
          aria-label="Filter home apps by category"
          className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-[#F1ECE3] border border-[#3D3830]/8 w-full sm:w-fit max-w-full"
        >
          {homeAppCategoryTabs.map((cat) => {
            const isActive = activeAppCategory === cat.id;
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
                <div
                  key={app.slug}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/app/apps/${app.slug}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/app/apps/${app.slug}`);
                    }
                  }}
                  className="group flex flex-col justify-between gap-5 rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 transition-colors hover:bg-[#F1ECE3]/65 hover:border-[#3D3830]/20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8965A]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="h-10 w-10 rounded-2xl bg-[#F1ECE3] border border-[#3D3830]/8 flex items-center justify-center text-[#5C5449] group-hover:text-[#3D3830] transition-colors shrink-0">
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
                  <div className="flex items-center justify-between gap-2.5">
                    <h3 className="font-serif text-xl font-medium text-[#3D3830] leading-snug">
                      {app.shortTitle || app.title}
                    </h3>
                    <ArrowRight className="h-4 w-4 text-[#8B7355] group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </div>
                </div>
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

      {summary?.primaryProfile && (
        <LifeContextModal
          isOpen={calibrationOpen}
          profileId={summary.primaryProfile.id}
          profileName={summary.primaryProfile.short_name || summary.primaryProfile.name}
          initialContext={summary.primaryProfile.life_context_json}
          getAccessToken={getAccessToken}
          isPreviewMode={isPreviewMode}
          onClose={() => setCalibrationOpen(false)}
          onSaved={(updatedCtx, nextScore) => {
            setSummary((prev) =>
              prev && prev.primaryProfile
                ? {
                    ...prev,
                    primaryProfile: {
                      ...prev.primaryProfile,
                      life_context_json: updatedCtx,
                      life_context_completeness: nextScore,
                    },
                  }
                : prev
            );
          }}
        />
      )}
    </div>
  );
};

export default AppDashboardHome;
