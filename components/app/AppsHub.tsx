import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Heart, Search, UserPlus } from 'lucide-react';
import { useAuth } from './AuthContext';
import AstrologyModeToggle from './AstrologyModeToggle';
import CustomSelect from './CustomSelect';
import {
  CLIENT_MINI_APPS,
  PREVIEW_HOME_SUMMARY,
  renderMiniAppIcon,
} from './miniAppsClientData';
import {
  MINI_APP_CATEGORIES,
  type MiniAppCategory,
  type MiniAppDefinition,
} from './miniAppsTypes';
import { PREVIEW_PROFILES } from './previewFixtures';

interface ProfileOption {
  id: string;
  name: string;
  short_name?: string | null;
  is_default?: boolean;
  is_activated?: boolean;
}

const FAVORITES_STORAGE_KEY = 'cc_favorite_apps_v1';

const AppsHub: React.FC = () => {
  const { isPreviewMode, getAccessToken, astrologyMode, setAstrologyMode } = useAuth();
  const navigate = useNavigate();

  const [apps, setApps] = useState<MiniAppDefinition[]>(CLIENT_MINI_APPS);
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
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>(() =>
    isPreviewMode
      ? PREVIEW_PROFILES.map((p) => ({
          id: p.id,
          name: p.name,
          short_name: p.short_name,
          is_default: p.is_default,
          is_activated: p.is_activated,
        }))
      : []
  );
  const [selectedProfileId, setSelectedProfileId] = useState<string>(() =>
    isPreviewMode ? PREVIEW_PROFILES[0]?.id || '' : ''
  );

  const [activeCategory, setActiveCategory] = useState<
    'all' | 'popular' | MiniAppCategory | 'favorites'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadHubData = useCallback(async () => {
    if (isPreviewMode) {
      setApps(CLIENT_MINI_APPS);
      setFavoriteSlugs(PREVIEW_HOME_SUMMARY.favoriteAppSlugs);
      setRecentSlugs(PREVIEW_HOME_SUMMARY.recentAppRuns.map((r) => r.app_slug));
      return;
    }

    const token = await getAccessToken();
    if (!token) return;

    const [catRes, profRes] = await Promise.all([
      fetch('/api/apps/catalog', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/profiles', { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    if (catRes.ok) {
      const data = await catRes.json();
      if (Array.isArray(data.apps)) {
        setApps(data.apps);
      }
      if (Array.isArray(data.favoriteSlugs)) {
        setFavoriteSlugs(data.favoriteSlugs);
        try {
          localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(data.favoriteSlugs));
        } catch {
          // Ignore quota
        }
      }
      if (Array.isArray(data.recentRuns)) {
        setRecentSlugs(
          data.recentRuns.map((r: { app_slug: string }) => r.app_slug)
        );
      }
    }

    if (profRes.ok) {
      const pData = await profRes.json();
      const list = (pData.profiles || []) as ProfileOption[];
      setProfiles(list);
      const preferred =
        list.find((p) => p.is_default) || list.find((p) => p.is_activated) || list[0];
      if (preferred) {
        setSelectedProfileId((prev) => prev || preferred.id);
      }
    }
  }, [getAccessToken, isPreviewMode]);

  useEffect(() => {
    void loadHubData();
  }, [loadHubData]);

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

  const filteredApps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return apps.filter((app) => {
      if (activeCategory === 'popular' && !app.popular) return false;
      if (activeCategory === 'favorites' && !favoriteSlugs.includes(app.slug)) return false;
      if (
        activeCategory !== 'all' &&
        activeCategory !== 'popular' &&
        activeCategory !== 'favorites' &&
        app.category !== activeCategory
      ) {
        return false;
      }

      if (!q) return true;
      return (
        app.title.toLowerCase().includes(q) ||
        app.tagline.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q) ||
        app.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [apps, activeCategory, favoriteSlugs, searchQuery]);

  const recentAppObjects = useMemo(() => {
    return recentSlugs
      .map((s) => apps.find((a) => a.slug === s))
      .filter((a): a is MiniAppDefinition => Boolean(a))
      .slice(0, 3);
  }, [recentSlugs, apps]);

  const buildAppUrl = (slug: string) => {
    return selectedProfileId
      ? `/app/apps/${slug}?profileId=${encodeURIComponent(selectedProfileId)}`
      : `/app/apps/${slug}`;
  };

  const profileOptions = useMemo(() => {
    return profiles.map((p) => ({
      value: p.id,
      label: p.is_default
        ? p.short_name
          ? `You (${p.short_name})`
          : 'You'
        : p.short_name?.trim() || p.name,
    }));
  }, [profiles]);

  return (
    <div className="space-y-8 pb-8">
      {/* Editorial Header */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-[#3D3830]/10 pb-7">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs text-[#8B8275]">
            Astrology Apps · {apps.length} interactive apps · Grounded in your verified chart
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-medium text-[#3D3830] tracking-tight">
            Apps
          </h1>
          <p className="text-sm text-[#5C5449] leading-relaxed">
            {astrologyMode === 'western'
              ? 'Focused daily forecasts, transit monitors, chart explorers, and reflection tools — all powered by your saved Tropical Placidus birth chart and live sky positions.'
              : 'Focused daily forecasts, transit monitors, chart explorers, and reflection tools — all powered by your saved Sidereal birth chart and live sky positions.'}
          </p>
        </div>

        {/* Mode Toggle + Active Chart Selector */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <AstrologyModeToggle
            value={astrologyMode}
            onChange={(next) => void setAstrologyMode(next)}
            size="sm"
          />
          {profiles.length > 0 ? (
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-[#8B8275] whitespace-nowrap">Reading for</span>
              <div className="w-48">
                <CustomSelect
                  value={selectedProfileId}
                  onChange={setSelectedProfileId}
                  options={profileOptions}
                  ariaLabel="Select birth profile for mini-apps"
                  size="sm"
                  surface="elevated"
                />
              </div>
            </div>
          ) : (
            <Link
              to="/app/profiles"
              className="min-h-[42px] inline-flex items-center gap-2 rounded-full border border-[#3D3830]/20 bg-[#FDFBF7] px-4 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors whitespace-nowrap"
            >
              <UserPlus className="h-3.5 w-3.5 text-[#8B7355]" />
              <span>Add Birth Profile</span>
            </Link>
          )}
        </div>
      </section>

      {/* Search + Clean Segmented Category Filter Bar */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Filter apps by category"
          className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-[#F1ECE3] border border-[#3D3830]/8"
        >
          {MINI_APP_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
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
                onClick={() => setActiveCategory(cat.id)}
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

        <div className="relative w-full md:w-64 shrink-0">
          <Search className="h-4 w-4 text-[#8B8275] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search apps..."
            aria-label="Search mini-apps"
            className="w-full rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/12 pl-10 pr-4 py-2.5 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/35 transition-colors"
          />
        </div>
      </section>

      {/* Recently Opened Strip (only on All view without active search) */}
      {activeCategory === 'all' && !searchQuery.trim() && recentAppObjects.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-medium text-[#8B8275]">Recently Opened</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {recentAppObjects.map((app) => (
              <button
                key={`recent-${app.slug}`}
                type="button"
                onClick={() => navigate(buildAppUrl(app.slug))}
                className="group flex items-center justify-between gap-3 rounded-2xl bg-[#F1ECE3]/80 border border-[#3D3830]/10 px-4 py-3.5 text-left hover:bg-[#F1ECE3] hover:border-[#3D3830]/20 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-[#FAF7F2] border border-[#3D3830]/10 flex items-center justify-center text-[#8B7355] shrink-0">
                    {renderMiniAppIcon(app.iconKey, 'h-4 w-4')}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#3D3830] truncate">{app.title}</p>
                    <p className="text-[11px] text-[#8B8275] truncate">{app.categoryLabel}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[#8B8275] group-hover:text-[#3D3830] group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Main Editorial Mini-Apps Grid */}
      {filteredApps.length === 0 ? (
        <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-10 text-center space-y-3">
          <p className="font-serif text-2xl text-[#3D3830]">
            {activeCategory === 'favorites'
              ? 'No saved apps yet'
              : 'No matching apps found'}
          </p>
          <p className="text-sm text-[#5C5449] max-w-md mx-auto">
            {activeCategory === 'favorites'
              ? 'Tap the heart icon on any app you revisit often to keep it pinned here.'
              : 'Try clearing your search or switching back to All categories.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveCategory('all');
              setSearchQuery('');
            }}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors cursor-pointer"
          >
            View All Apps
          </button>
        </section>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredApps.map((app) => {
            const isFav = favoriteSlugs.includes(app.slug);
            return (
              <div
                key={app.slug}
                onClick={() => navigate(buildAppUrl(app.slug))}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(buildAppUrl(app.slug));
                  }
                }}
                className="group flex flex-col justify-between rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-6 transition-all hover:bg-[#F1ECE3]/55 hover:border-[#3D3830]/22 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8965A]"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-[#F1ECE3] border border-[#3D3830]/10 flex items-center justify-center text-[#5C5449] group-hover:text-[#3D3830] transition-colors shrink-0">
                      {renderMiniAppIcon(app.iconKey, 'h-5 w-5')}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => void handleToggleFavorite(e, app.slug)}
                      aria-label={isFav ? `Remove ${app.title} from saved` : `Save ${app.title}`}
                      className={`p-2 rounded-full transition-colors cursor-pointer ${
                        isFav
                          ? 'text-[#B8965A] bg-[#B8965A]/12'
                          : 'text-[#8B8275] hover:text-[#3D3830] hover:bg-[#EAE3D7]/60'
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  <div>
                    <p className="text-[11px] text-[#8B8275]">
                      {app.categoryLabel} · {app.estimatedRead}
                    </p>
                    <h2 className="mt-1 font-serif text-2xl font-medium text-[#3D3830] tracking-tight">
                      {app.title}
                    </h2>
                    <p className="mt-2 text-xs text-[#5C5449] leading-relaxed">
                      {app.description}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#3D3830]/8 flex items-center justify-between text-xs font-medium text-[#3D3830]">
                  <span>Open App</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[#8B7355] group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
};

export default AppsHub;
