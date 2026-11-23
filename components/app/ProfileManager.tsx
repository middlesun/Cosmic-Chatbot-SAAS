import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Trash2,
  Loader2,
  ArrowLeft,
  AlertCircle,
  MapPin,
  Pencil,
  UserCheck,
  Star,
  MessageSquare,
  MessageSquarePlus,
  X,
  Check,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import ChartViewer, {
  type CompiledChartJson,
  type DailyTransitsPayload,
  type NatalTruthDossierClient,
  type VedicTabId,
} from './ChartViewer';
import { BirthChartForm } from './BirthChartModal';
import CustomSelect from './CustomSelect';
import LifeContextModal from './LifeContextModal';
import Tooltip from './Tooltip';
import type { LifeContextData, PlaceSuggestion } from './chatTypes';
import {
  PREVIEW_CHART_JSON,
  PREVIEW_DAILY_TRANSITS,
  PREVIEW_PROFILES,
} from './previewFixtures';

interface ProfileSummary {
  id: string;
  name: string;
  short_name?: string | null;
  is_default?: boolean;
  is_starred?: boolean;
  tags?: string[];
  birth_date: string;
  birth_time: string;
  birth_city: string;
  birth_state: string | null;
  birth_country: string;
  current_city?: string | null;
  current_state?: string | null;
  current_country?: string | null;
  current_timezone_offset?: number | null;
  gender: string | null;
  relationship: string | null;
  birth_chart_pdf_url: string | null;
  is_activated: boolean;
  activated_at: string | null;
  created_at?: string;
  council_thread_count?: number;
  latest_council_conv_id?: string | null;
  chart_json?: CompiledChartJson | null;
  life_context_json?: LifeContextData | null;
  life_context_completeness?: number;
  natal_dossier_version?: number;
  natal_truth_dossier_json?: NatalTruthDossierClient | null;
}

type SortMode = 'newest' | 'oldest' | 'favourites' | 'tags';

const PRESET_PROFILE_TAGS = ['Family', 'Loved ones', 'Friends', 'Clients', 'Others'] as const;

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: 'newest', label: 'Sort: Newest' },
  { value: 'oldest', label: 'Sort: Oldest' },
  { value: 'favourites', label: 'Sort: Favourites' },
  { value: 'tags', label: 'Sort: Tags' },
];

const ProfileManager: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getAccessToken, refreshUser, isPreviewMode } = useAuth();
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [tierLimit, setTierLimit] = useState(10);
  const [astrologyApiConfigured, setAstrologyApiConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortMode>('newest');
  const [activeTagFilter, setActiveTagFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Chart inspection state
  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<ProfileSummary | null>(null);
  const [selectedDailyTransits, setSelectedDailyTransits] = useState<DailyTransitsPayload | null>(null);
  const [initialChartTab, setInitialChartTab] = useState<VedicTabId>('overview');

  // Edit Modal state
  const [editingProfile, setEditingProfile] = useState<ProfileSummary | null>(null);
  const [editShortName, setEditShortName] = useState('');
  const [editLocationQuery, setEditLocationQuery] = useState('');
  const [selectedEditLocation, setSelectedEditLocation] = useState<PlaceSuggestion | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loadingLocationSuggestions, setLoadingLocationSuggestions] = useState(false);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [confirmDeleteInModal, setConfirmDeleteInModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [starringId, setStarringId] = useState<string | null>(null);
  const [lifeContextTarget, setLifeContextTarget] = useState<ProfileSummary | null>(null);

  const loadProfiles = useCallback(async () => {
    if (isPreviewMode) {
      setProfiles(
        PREVIEW_PROFILES.map((p) => ({
          id: p.id,
          name: p.name,
          short_name: p.short_name,
          is_default: p.is_default,
          is_starred: true,
          tags: ['Family'],
          birth_date: p.birth_date || '1992-08-14',
          birth_time: '09:15:00',
          birth_city: p.birth_city || 'Mumbai',
          birth_state: null,
          birth_country: p.birth_country || 'India',
          current_city: p.current_city,
          current_state: p.current_state,
          current_country: p.current_country,
          gender: 'male',
          relationship: p.relationship || 'Self',
          birth_chart_pdf_url: null,
          is_activated: true,
          activated_at: '2026-11-01T08:00:00.000Z',
          created_at: '2026-11-01T08:00:00.000Z',
          council_thread_count: 1,
          latest_council_conv_id: 'preview-conv-1',
          life_context_json: p.life_context_json ?? {},
          life_context_completeness: p.life_context_completeness ?? 0,
          natal_dossier_version: p.natal_dossier_version ?? 1,
        }))
      );
      setTierLimit(100);
      setLoading(false);
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/profiles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load profiles.');
      } else {
        setProfiles(data.profiles || []);
        setTierLimit(data.tierLimit ?? 10);
        setAstrologyApiConfigured(Boolean(data.astrologyApiConfigured));
        setError(null);
      }
    } catch {
      setError('Network error loading profiles.');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, isPreviewMode]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowCreateForm(true);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('new');
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Autocomplete for current location inside Edit Modal
  useEffect(() => {
    if (!editingProfile) {
      setLocationSuggestions([]);
      setLoadingLocationSuggestions(false);
      return;
    }
    const trimmed = editLocationQuery.trim();
    if (
      isPreviewMode ||
      trimmed.length < 2 ||
      (selectedEditLocation && selectedEditLocation.label === trimmed)
    ) {
      setLocationSuggestions([]);
      setLoadingLocationSuggestions(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingLocationSuggestions(true);
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await fetch(`/api/profiles/places?q=${encodeURIComponent(trimmed)}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setLocationSuggestions(Array.isArray(data.places) ? data.places : []);
        }
      } catch {
        // Ignore abort/network errors on autocomplete
      } finally {
        setLoadingLocationSuggestions(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [editingProfile, editLocationQuery, selectedEditLocation, isPreviewMode, getAccessToken]);

  const openEditModal = (e: React.MouseEvent, profile: ProfileSummary) => {
    e.stopPropagation();
    setEditingProfile(profile);
    setEditShortName(profile.short_name || '');
    setEditLocationQuery(
      [profile.current_city, profile.current_state, profile.current_country]
        .filter(Boolean)
        .join(', ')
    );
    setSelectedEditLocation(null);
    setLocationSuggestions([]);
    setEditTags(Array.isArray(profile.tags) ? [...profile.tags] : []);
    setCustomTagInput('');
    setConfirmDeleteInModal(false);
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditingProfile(null);
    setConfirmDeleteInModal(false);
    setEditError(null);
  };

  useEffect(() => {
    if (!editingProfile) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEditModal();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [editingProfile]);

  const toggleEditTag = (tag: string) => {
    setEditTags((prev) => {
      const exists = prev.some((t) => t.toLowerCase() === tag.toLowerCase());
      if (exists) return prev.filter((t) => t.toLowerCase() !== tag.toLowerCase());
      if (prev.length >= 10) return prev;
      return [...prev, tag];
    });
  };

  const handleAddCustomTag = () => {
    const clean = customTagInput.trim().slice(0, 24);
    if (!clean) return;
    setEditTags((prev) => {
      if (prev.some((t) => t.toLowerCase() === clean.toLowerCase()) || prev.length >= 10) {
        return prev;
      }
      return [...prev, clean];
    });
    setCustomTagInput('');
  };

  const handleToggleStar = async (e: React.MouseEvent, profile: ProfileSummary) => {
    e.stopPropagation();
    const nextVal = !profile.is_starred;
    setProfiles((prev) =>
      prev.map((p) => (p.id === profile.id ? { ...p, is_starred: nextVal } : p))
    );
    if (isPreviewMode) return;

    const token = await getAccessToken();
    if (!token) return;
    setStarringId(profile.id);
    try {
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_starred: nextVal }),
      });
      if (!res.ok) {
        setProfiles((prev) =>
          prev.map((p) => (p.id === profile.id ? { ...p, is_starred: !nextVal } : p))
        );
      }
    } catch {
      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, is_starred: !nextVal } : p))
      );
    } finally {
      setStarringId(null);
    }
  };

  const handleSaveEditModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    if (isPreviewMode) {
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === editingProfile.id
            ? {
                ...p,
                short_name: editShortName.trim() || null,
                tags: editTags,
              }
            : p
        )
      );
      closeEditModal();
      return;
    }

    const token = await getAccessToken();
    if (!token) return;
    setSavingEdit(true);
    setEditError(null);

    try {
      const trimmedLoc = editLocationQuery.trim();
      const locationPayload: Record<string, unknown> = selectedEditLocation
        ? {
            current_city: selectedEditLocation.city,
            current_state: selectedEditLocation.state,
            current_country: selectedEditLocation.country,
            current_timezone_offset: selectedEditLocation.timezoneOffset,
          }
        : trimmedLoc
        ? { current_place_query: trimmedLoc }
        : {
            current_city: '',
            current_state: '',
            current_country: '',
            current_timezone_offset: null,
          };

      const res = await fetch(`/api/profiles/${editingProfile.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          short_name: editShortName.trim(),
          tags: editTags,
          ...locationPayload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(data.error || 'Could not update profile.');
      } else {
        closeEditModal();
        await loadProfiles();
      }
    } catch {
      setEditError('Network error saving profile changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSetAsDefault = async (profileId: string) => {
    if (isPreviewMode) return;
    const token = await getAccessToken();
    if (!token) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_default: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setEditError(data.error || 'Could not update primary profile.');
      } else {
        setEditingProfile((prev) => (prev ? { ...prev, is_default: true } : prev));
        await loadProfiles();
      }
    } catch {
      setEditError('Network error updating primary profile.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteFromModal = async (profileId: string) => {
    if (isPreviewMode) {
      closeEditModal();
      return;
    }
    const token = await getAccessToken();
    if (!token) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        closeEditModal();
        if (selectedProfile?.id === profileId) {
          setSelectedProfile(null);
          setSelectedDailyTransits(null);
        }
        await loadProfiles();
        await refreshUser();
      } else {
        const data = await res.json().catch(() => ({}));
        setEditError(data.error || 'Failed to delete profile.');
      }
    } catch {
      setEditError('Failed to delete profile.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleInspectChart = async (profileId: string, initialTab: VedicTabId = 'overview') => {
    setInitialChartTab(initialTab);
    if (isPreviewMode) {
      const target = profiles.find((p) => p.id === profileId) || profiles[0];
      if (target) {
        setSelectedDailyTransits(PREVIEW_DAILY_TRANSITS);
        setSelectedProfile({
          ...target,
          chart_json: target.chart_json || PREVIEW_CHART_JSON,
        });
      }
      return;
    }
    const token = await getAccessToken();
    if (!token) return;
    setError(null);
    setInspectingId(profileId);
    try {
      const res = await fetch(`/api/profiles/${profileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.profile) {
        if (data.profile.chart_json) {
          setSelectedDailyTransits(data.dailyTransits || null);
          setSelectedProfile(data.profile);
        } else {
          setError('Chart data could not be loaded for this profile. Please try again.');
        }
      } else {
        setError(data.error || 'Could not load chart details.');
      }
    } catch {
      setError('Failed to load chart.');
    } finally {
      setInspectingId(null);
    }
  };

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const p of profiles) {
      for (const t of p.tags || []) {
        set.add(t);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [profiles]);

  const displayedProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = profiles.filter((p) => {
      if (activeTagFilter !== 'all') {
        const hasTag = (p.tags || []).some(
          (t) => t.toLowerCase() === activeTagFilter.toLowerCase()
        );
        if (!hasTag) return false;
      }
      if (!q) return true;
      const haystack = `${p.name} ${p.short_name || ''} ${p.birth_city} ${p.relationship || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
      return haystack.includes(q);
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortBy === 'favourites') {
        const starDiff = (b.is_starred ? 1 : 0) - (a.is_starred ? 1 : 0);
        if (starDiff !== 0) return starDiff;
        const defDiff = (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0);
        if (defDiff !== 0) return defDiff;
      } else if (sortBy === 'tags') {
        const aTag = (a.tags?.[0] || 'zzz').toLowerCase();
        const bTag = (b.tags?.[0] || 'zzz').toLowerCase();
        const tagDiff = aTag.localeCompare(bTag);
        if (tagDiff !== 0) return tagDiff;
      } else if (sortBy === 'oldest') {
        const ta = new Date(a.created_at || a.birth_date).getTime();
        const tb = new Date(b.created_at || b.birth_date).getTime();
        return ta - tb;
      }
      // Default / newest
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      if (tb !== ta) return tb - ta;
      return (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0);
    });
    return sorted;
  }, [profiles, search, activeTagFilter, sortBy]);

  if (selectedProfile?.chart_json) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              setSelectedProfile(null);
              setSelectedDailyTransits(null);
            }}
            className="inline-flex items-center gap-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Profiles</span>
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setLifeContextTarget(selectedProfile)}
              className="inline-flex items-center gap-2 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
            >
              <span>Life Context</span>
              <span
                className={`font-['JetBrains_Mono',monospace] tabular-nums ${
                  (selectedProfile.life_context_completeness ?? 0) >= 80
                    ? 'text-[#2D6A4F]'
                    : 'text-[#8B7355]'
                }`}
              >
                {selectedProfile.life_context_completeness ?? 0}%
              </span>
            </button>
            <span className="text-xs text-[#8B8275] font-['DM_Sans',sans-serif] tabular-nums">
              {selectedProfile.birth_date} · {selectedProfile.birth_time} · {selectedProfile.birth_city}
            </span>
          </div>
        </div>

        <ChartViewer
          chart={selectedProfile.chart_json}
          dailyTransits={selectedDailyTransits}
          initialVedicTab={initialChartTab}
          profileId={selectedProfile.id}
          gender={selectedProfile.gender}
          dossier={selectedProfile.natal_truth_dossier_json ?? null}
          lifeContextCompleteness={selectedProfile.life_context_completeness ?? 0}
          onOpenLifeContext={() => setLifeContextTarget(selectedProfile)}
          onDossierRefreshed={(nextDossier) => {
            setSelectedProfile((prev) =>
              prev ? { ...prev, natal_truth_dossier_json: nextDossier } : prev
            );
          }}
        />

        {lifeContextTarget && (
          <LifeContextModal
            isOpen={Boolean(lifeContextTarget)}
            profileId={lifeContextTarget.id}
            profileName={lifeContextTarget.short_name || lifeContextTarget.name}
            initialContext={lifeContextTarget.life_context_json}
            getAccessToken={getAccessToken}
            isPreviewMode={isPreviewMode}
            onClose={() => setLifeContextTarget(null)}
            onSaved={(updatedCtx, completeness) => {
              setProfiles((prev) =>
                prev.map((p) =>
                  p.id === lifeContextTarget.id
                    ? {
                        ...p,
                        life_context_json: updatedCtx,
                        life_context_completeness: completeness,
                      }
                    : p
                )
              );
              setSelectedProfile((prev) =>
                prev && prev.id === lifeContextTarget.id
                  ? {
                      ...prev,
                      life_context_json: updatedCtx,
                      life_context_completeness: completeness,
                    }
                  : prev
              );
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#3D3830]/10 pb-6">
        <div>
          <p className="text-xs text-[#8B8275] mb-1 font-['DM_Sans',sans-serif] tabular-nums">
            {profiles.length} / {tierLimit} saved profile slots
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-medium text-[#3D3830] tracking-tight">
            Profiles
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          disabled={profiles.length >= tierLimit}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{showCreateForm ? 'Close Form' : 'Add new profile'}</span>
        </button>
      </div>

      {!astrologyApiConfigured && (
        <div className="rounded-2xl bg-[#F1ECE3] p-4 border border-[#3D3830]/15 flex items-start gap-3 text-xs text-[#5C5449]">
          <AlertCircle className="h-4 w-4 shrink-0 text-[#3D3830] mt-0.5" />
          <div>
            <span className="font-semibold text-[#3D3830]">FREE_ASTROLOGY_API_KEY not configured yet.</span>{' '}
            Add your FreeAstrologyAPI key to your server environment variables to enable automated birth chart calculation.
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-[#A94438]/10 px-4 py-3 text-xs font-medium text-[#A94438]">
          {error}
        </div>
      )}

      {/* One-Step Add Birth Details Form */}
      {showCreateForm && (
        <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-6 md:p-8 space-y-5">
          <div>
            <h2 className="font-serif text-2xl font-medium text-[#3D3830]">Add new profile</h2>
            <p className="text-xs text-[#8B8275] mt-1">
              Calculated once and saved permanently for all consultations, reports, and planetary timing.
            </p>
          </div>
          <BirthChartForm
            getAccessToken={getAccessToken}
            isPreviewMode={isPreviewMode}
            isFirstChart={profiles.length === 0}
            submitLabel="Create Birth Chart"
            onCancel={() => setShowCreateForm(false)}
            onCreated={async () => {
              setShowCreateForm(false);
              await loadProfiles();
              await refreshUser();
            }}
          />
        </div>
      )}

      {/* Search, Sort & Tag Filter Bar */}
      {profiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B8275]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, label, city, or tag..."
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] pl-10 pr-4 py-2.5 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#4A453D] focus:outline-none"
              />
            </div>

            <div className="w-full sm:w-48 shrink-0">
              <CustomSelect
                value={sortBy}
                onChange={(v) => setSortBy(v as SortMode)}
                ariaLabel="Sort profiles"
                size="sm"
                surface="elevated"
                options={SORT_OPTIONS}
              />
            </div>
          </div>

          {availableTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <button
                type="button"
                onClick={() => setActiveTagFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTagFilter === 'all'
                    ? 'bg-[#4A453D] text-[#FAF7F2]'
                    : 'bg-[#F1ECE3] text-[#5C5449] hover:text-[#3D3830]'
                }`}
              >
                All Tags
              </button>
              {availableTags.map((tag) => {
                const active = activeTagFilter.toLowerCase() === tag.toLowerCase();
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setActiveTagFilter(active ? 'all' : tag)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#4A453D] text-[#FAF7F2]'
                        : 'bg-[#F1ECE3] text-[#5C5449] hover:text-[#3D3830]'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Profile Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2].map((n) => (
            <div key={n} className="h-44 rounded-3xl bg-[#F1ECE3] animate-pulse" />
          ))}
        </div>
      ) : displayedProfiles.length === 0 ? (
        <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-10 text-center">
          <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
            {profiles.length === 0 ? 'No Profiles Yet' : 'No Matching Profiles'}
          </h2>
          <p className="mt-2 text-sm text-[#5C5449] max-w-md mx-auto">
            {profiles.length === 0
              ? 'Add your birth details or a family member’s chart to calculate complete Vedic and Western charts.'
              : 'Try adjusting your search or tag filter.'}
          </p>
          {profiles.length === 0 && (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="mt-5 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-[#4A453D] px-6 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add new profile</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {displayedProfiles.map((profile) => {
            const councilCount = profile.council_thread_count || 0;
            const latestConvId = profile.latest_council_conv_id;
            const currentLoc = [profile.current_city, profile.current_state, profile.current_country]
              .filter(Boolean)
              .join(', ');
            const birthLoc = [profile.birth_city, profile.birth_state, profile.birth_country]
              .filter(Boolean)
              .join(', ');
            const isInspecting = inspectingId === profile.id;

            return (
              <div
                key={profile.id}
                role="button"
                tabIndex={0}
                onClick={() => void handleInspectChart(profile.id)}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    void handleInspectChart(profile.id);
                  }
                }}
                className={`group rounded-3xl border p-6 flex flex-col justify-between gap-5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8965A] ${
                  profile.is_default
                    ? 'bg-[#F1ECE3]/85 border-[#3D3830]/20 hover:bg-[#EAE3D7]/80 hover:border-[#3D3830]/30'
                    : 'bg-[#FDFBF7] border-[#3D3830]/12 hover:bg-[#F1ECE3]/55 hover:border-[#3D3830]/25'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-[#8B8275] mb-1 flex flex-wrap items-center gap-1.5">
                        {profile.is_default && (
                          <span className="font-medium text-[#3D3830]">You ·</span>
                        )}
                        <span>{profile.relationship || 'Profile'}</span>
                        {profile.short_name?.trim() && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-[#5C5449]">{profile.short_name.trim()}</span>
                          </>
                        )}
                      </p>
                      <h3 className="font-serif text-2xl font-medium text-[#3D3830] truncate">
                        {profile.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Tooltip content={profile.is_starred ? 'Unstar profile' : 'Star profile'}>
                        <button
                          type="button"
                          disabled={starringId === profile.id}
                          onClick={(e) => void handleToggleStar(e, profile)}
                          aria-label={profile.is_starred ? 'Unstar profile' : 'Star profile'}
                          className={`p-2 rounded-full transition-colors cursor-pointer ${
                            profile.is_starred
                              ? 'text-[#B8965A] bg-[#B8965A]/12'
                              : 'text-[#8B8275] hover:text-[#3D3830] hover:bg-[#EAE3D7]/70'
                          }`}
                        >
                          <Star className={`h-4 w-4 ${profile.is_starred ? 'fill-current' : ''}`} />
                        </button>
                      </Tooltip>

                      <Tooltip content="Edit label, location, tags & actions">
                        <button
                          type="button"
                          onClick={(e) => openEditModal(e, profile)}
                          aria-label={`Edit ${profile.name}`}
                          className="p-2 rounded-full text-[#8B8275] hover:text-[#3D3830] hover:bg-[#EAE3D7]/70 transition-colors cursor-pointer"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>

                  <p className="mt-2 font-['DM_Sans',sans-serif] tabular-nums text-xs text-[#5C5449]">
                    {profile.birth_date} · {profile.birth_time}
                  </p>
                  <p className="mt-1 text-xs text-[#8B8275] truncate">
                    Born in {birthLoc}
                    {currentLoc ? ` · Lives in ${currentLoc}` : ''}
                  </p>

                  {profile.tags && profile.tags.length > 0 && (
                    <p className="mt-2 text-[11px] text-[#5C5449] truncate">
                      {profile.tags.join(' · ')}
                    </p>
                  )}

                  {/* Context Calibration Indicator (0-100%) */}
                  <div className="mt-3.5 pt-3 border-t border-[#3D3830]/8">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-[#8B8275]">
                        Context Calibration{' '}
                        <span
                          className={`font-['JetBrains_Mono',monospace] tabular-nums font-medium ${
                            (profile.life_context_completeness ?? 0) >= 80
                              ? 'text-[#2D6A4F]'
                              : 'text-[#3D3830]'
                          }`}
                        >
                          {profile.life_context_completeness ?? 0}%
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLifeContextTarget(profile);
                        }}
                        className="font-medium text-[#8B7355] hover:text-[#3D3830] underline underline-offset-2 cursor-pointer"
                      >
                        {(profile.life_context_completeness ?? 0) >= 80 ? 'Update Context' : 'Calibrate'}
                      </button>
                    </div>
                    <div className="mt-1.5 h-1 w-full rounded-full bg-[#3D3830]/10 overflow-hidden">
                      <div
                        style={{ width: `${profile.life_context_completeness ?? 0}%` }}
                        className={`h-full rounded-full transition-all duration-300 ${
                          (profile.life_context_completeness ?? 0) >= 80
                            ? 'bg-[#2D6A4F]'
                            : 'bg-[#8B7355]'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[#3D3830]/10">
                  <div className="flex flex-wrap items-center gap-2">
                    {councilCount > 0 && latestConvId ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/app/chat/${latestConvId}`);
                          }}
                          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-1.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors cursor-pointer"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>Continue Chat</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/app/chat?pillar=council&profileId=${profile.id}&new=1`);
                          }}
                          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/20 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7] transition-colors cursor-pointer"
                        >
                          <MessageSquarePlus className="h-3.5 w-3.5 text-[#8B7355]" />
                          <span>Start New Chat</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/app/chat?pillar=council&profileId=${profile.id}&new=1`);
                        }}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-1.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors cursor-pointer"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Chat now</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {isPreviewMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleInspectChart(profile.id, 'vargas');
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#8B7355] hover:text-[#3D3830] transition-colors cursor-pointer"
                      >
                        <span>All 16 Divisional Charts</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleInspectChart(profile.id);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#5C5449] group-hover:text-[#3D3830] hover:text-[#3D3830] transition-colors cursor-pointer"
                    >
                      {isInspecting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Opening...</span>
                        </>
                      ) : (
                        <>
                          <span>View chart</span>
                          <ArrowRight className="h-3.5 w-3.5 text-[#8B7355] group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Profile Modal */}
      {editingProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2229]/45 backdrop-blur-xs p-4"
          onClick={closeEditModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-cc-drawer-in w-full max-w-lg rounded-3xl border border-[#3D3830]/15 bg-[#FAF7F2] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 bg-[#F1ECE3] border-b border-[#3D3830]/10">
              <div>
                <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                  Edit {editingProfile.name}
                </h2>
                <p className="text-[11px] text-[#8B8275] font-['DM_Sans',sans-serif] tabular-nums">
                  {editingProfile.birth_date} · {editingProfile.birth_city}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                aria-label="Close edit modal"
                className="p-2 rounded-full text-[#8B8275] hover:text-[#3D3830] hover:bg-[#3D3830]/5 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditModal} className="p-6 space-y-5 max-h-[80dvh] overflow-y-auto">
              {/* Short Label */}
              <div>
                <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                  Short Label
                </label>
                <input
                  type="text"
                  value={editShortName}
                  maxLength={40}
                  onChange={(e) => setEditShortName(e.target.value)}
                  placeholder="e.g. Mom, Partner, Client"
                  className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-2.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#4A453D] focus:outline-none"
                />
              </div>

              {/* Current Location */}
              <div className="space-y-2 relative">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-[#5C5449]">
                    Current Location (optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const birthFormatted = [
                        editingProfile.birth_city,
                        editingProfile.birth_state,
                        editingProfile.birth_country,
                      ]
                        .filter(Boolean)
                        .join(', ');
                      setEditLocationQuery(birthFormatted);
                      setSelectedEditLocation(null);
                      setLocationSuggestions([]);
                    }}
                    className="text-[11px] text-[#8B7355] hover:text-[#3D3830] underline underline-offset-2 cursor-pointer"
                  >
                    Same as birth city
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={editLocationQuery}
                    onChange={(e) => {
                      setEditLocationQuery(e.target.value);
                      setSelectedEditLocation(null);
                    }}
                    placeholder="City, Country (leave blank to clear)"
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-2.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#4A453D] focus:outline-none"
                  />
                  {loadingLocationSuggestions && (
                    <Loader2 className="h-4 w-4 text-[#8B8275] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>
                {locationSuggestions.length > 0 && (
                  <div className="rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] shadow-lg p-1 max-h-40 overflow-y-auto space-y-0.5">
                    {locationSuggestions.map((place, idx) => (
                      <button
                        key={`modal-loc-${idx}`}
                        type="button"
                        onClick={() => {
                          setSelectedEditLocation(place);
                          setEditLocationQuery(place.label);
                          setLocationSuggestions([]);
                        }}
                        className="w-full text-left rounded-lg px-2.5 py-1.5 text-xs text-[#3D3830] hover:bg-[#F1ECE3] flex items-center gap-2 cursor-pointer"
                      >
                        <MapPin className="h-3 w-3 text-[#8B7355] shrink-0" />
                        <span className="truncate">{place.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="space-y-2.5">
                <label className="block text-xs font-medium text-[#5C5449]">
                  Tags
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_PROFILE_TAGS.map((tag) => {
                    const selected = editTags.some((t) => t.toLowerCase() === tag.toLowerCase());
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleEditTag(tag)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[#4A453D] text-[#FAF7F2]'
                            : 'bg-[#F1ECE3] text-[#5C5449] hover:bg-[#EAE3D7] hover:text-[#3D3830]'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>

                {/* Custom tags already added that aren't in presets */}
                {editTags.filter(
                  (t) => !PRESET_PROFILE_TAGS.some((p) => p.toLowerCase() === t.toLowerCase())
                ).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {editTags
                      .filter(
                        (t) => !PRESET_PROFILE_TAGS.some((p) => p.toLowerCase() === t.toLowerCase())
                      )
                      .map((custom) => (
                        <button
                          key={custom}
                          type="button"
                          onClick={() => toggleEditTag(custom)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-[#4A453D] text-[#FAF7F2] text-xs font-medium cursor-pointer"
                        >
                          <span>{custom}</span>
                          <X className="h-3 w-3" />
                        </button>
                      ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customTagInput}
                    maxLength={24}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomTag();
                      }
                    }}
                    placeholder="Add custom tag..."
                    className="flex-1 rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#4A453D] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomTag}
                    disabled={!customTagInput.trim()}
                    className="rounded-xl border border-[#3D3830]/20 bg-[#F1ECE3] px-3.5 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7] disabled:opacity-40 cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Set as primary + Delete section */}
              <div className="pt-3 border-t border-[#3D3830]/10 flex flex-wrap items-center justify-between gap-3">
                {!editingProfile.is_default ? (
                  <button
                    type="button"
                    disabled={savingEdit}
                    onClick={() => void handleSetAsDefault(editingProfile.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/20 bg-[#FDFBF7] px-3.5 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7] transition-colors cursor-pointer"
                  >
                    <UserCheck className="h-3.5 w-3.5 text-[#8B7355]" />
                    <span>Set as Your Chart</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#5C5449]">
                    <UserCheck className="h-3.5 w-3.5 text-[#2D6A4F]" />
                    <span>Primary (&quot;You&quot;) chart</span>
                  </span>
                )}

                {confirmDeleteInModal ? (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={() => void handleDeleteFromModal(editingProfile.id)}
                      className="rounded-full bg-[#A94438] px-3 py-1 text-xs font-medium text-[#FAF7F2] hover:opacity-90 cursor-pointer"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteInModal(false)}
                      className="text-xs text-[#8B8275] hover:text-[#3D3830] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteInModal(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A94438] hover:underline cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Profile</span>
                  </button>
                )}
              </div>

              {editError && (
                <p className="rounded-xl bg-[#7A3E36]/10 px-3.5 py-2.5 text-xs text-[#7A3E36]">
                  {editError}
                </p>
              )}

              <div className="pt-2 border-t border-[#3D3830]/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-full px-4 py-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {savingEdit ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  <span>{savingEdit ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {lifeContextTarget && (
        <LifeContextModal
          isOpen={Boolean(lifeContextTarget)}
          profileId={lifeContextTarget.id}
          profileName={lifeContextTarget.short_name || lifeContextTarget.name}
          initialContext={lifeContextTarget.life_context_json}
          getAccessToken={getAccessToken}
          isPreviewMode={isPreviewMode}
          onClose={() => setLifeContextTarget(null)}
          onSaved={(updatedCtx, completeness) => {
            setProfiles((prev) =>
              prev.map((p) =>
                p.id === lifeContextTarget.id
                  ? {
                      ...p,
                      life_context_json: updatedCtx,
                      life_context_completeness: completeness,
                    }
                  : p
              )
            );
            setSelectedProfile((prev) =>
              prev && prev.id === lifeContextTarget.id
                ? {
                    ...prev,
                    life_context_json: updatedCtx,
                    life_context_completeness: completeness,
                  }
                : prev
            );
          }}
        />
      )}
    </div>
  );
};

export default ProfileManager;
