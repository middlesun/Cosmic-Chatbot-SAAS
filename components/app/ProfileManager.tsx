import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Search,
  Trash2,
  Eye,
  Loader2,
  ArrowLeft,
  AlertCircle,
  Check,
  MapPin,
  Pencil,
  UserCheck,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import ChartViewer, { type CompiledChartJson } from './ChartViewer';
import { BirthChartForm } from './BirthChartModal';
import type { PlaceSuggestion } from './chatTypes';

interface ProfileSummary {
  id: string;
  name: string;
  short_name?: string | null;
  is_default?: boolean;
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
  chart_json?: CompiledChartJson | null;
}

const ProfileManager: React.FC = () => {
  const { getAccessToken, refreshUser, isPreviewMode } = useAuth();
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [tierLimit, setTierLimit] = useState(10);
  const [astrologyApiConfigured, setAstrologyApiConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Chart inspection & deletion state
  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<ProfileSummary | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Inline label, current location & default management
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingShortName, setEditingShortName] = useState('');
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editingLocationQuery, setEditingLocationQuery] = useState('');
  const [selectedEditLocation, setSelectedEditLocation] = useState<PlaceSuggestion | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loadingLocationSuggestions, setLoadingLocationSuggestions] = useState(false);
  const [updatingMetaId, setUpdatingMetaId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
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
  }, [getAccessToken]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const handleSetAsDefault = async (profileId: string) => {
    const token = await getAccessToken();
    if (!token) return;
    setError(null);
    setUpdatingMetaId(profileId);
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
        setError(data.error || 'Could not update default profile.');
      } else {
        await loadProfiles();
      }
    } catch {
      setError('Network error updating default profile.');
    } finally {
      setUpdatingMetaId(null);
    }
  };

  useEffect(() => {
    if (!editingLocationId) {
      setLocationSuggestions([]);
      setLoadingLocationSuggestions(false);
      return;
    }
    const trimmed = editingLocationQuery.trim();
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
  }, [editingLocationId, editingLocationQuery, selectedEditLocation, isPreviewMode, getAccessToken]);

  const handleSaveCurrentLocation = async (profileId: string) => {
    const token = await getAccessToken();
    if (!token) return;
    setError(null);
    setUpdatingMetaId(profileId);
    try {
      const trimmed = editingLocationQuery.trim();
      const body: Record<string, unknown> = selectedEditLocation
        ? {
            current_city: selectedEditLocation.city,
            current_state: selectedEditLocation.state,
            current_country: selectedEditLocation.country,
            current_timezone_offset: selectedEditLocation.timezoneOffset,
          }
        : trimmed
        ? { current_place_query: trimmed }
        : {
            current_city: '',
            current_state: '',
            current_country: '',
            current_timezone_offset: null,
          };

      const res = await fetch(`/api/profiles/${profileId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not save current location.');
      } else {
        setEditingLocationId(null);
        setSelectedEditLocation(null);
        setLocationSuggestions([]);
        await loadProfiles();
      }
    } catch {
      setError('Network error saving current location.');
    } finally {
      setUpdatingMetaId(null);
    }
  };

  const handleSaveShortName = async (profileId: string) => {
    const token = await getAccessToken();
    if (!token) return;
    setError(null);
    setUpdatingMetaId(profileId);
    try {
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ short_name: editingShortName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not save short name.');
      } else {
        setEditingLabelId(null);
        await loadProfiles();
      }
    } catch {
      setError('Network error saving short name.');
    } finally {
      setUpdatingMetaId(null);
    }
  };

  const handleInspectChart = async (profileId: string) => {
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

  const handleDelete = async (profileId: string) => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setConfirmDeleteId(null);
        if (selectedProfile?.id === profileId) setSelectedProfile(null);
        await loadProfiles();
        await refreshUser();
      }
    } catch {
      setError('Failed to delete profile.');
    }
  };

  const filtered = profiles.filter((p) =>
    `${p.name} ${p.birth_city} ${p.relationship || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  if (selectedProfile?.chart_json) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelectedProfile(null)}
            className="inline-flex items-center gap-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Saved Profiles</span>
          </button>
          <span className="text-xs text-[#8B8275]">
            {selectedProfile.birth_date} · {selectedProfile.birth_time} · {selectedProfile.birth_city}
          </span>
        </div>

        <ChartViewer chart={selectedProfile.chart_json} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#3D3830]/10 pb-6">
        <div>
          <p className="text-xs text-[#8B8275] mb-1 font-['DM_Sans',sans-serif] tabular-nums">
            {profiles.length} / {tierLimit} saved profile slots
          </p>
          <h1 className="font-serif text-3xl md:text-4xl font-medium text-[#3D3830]">
            Birth Profiles & Charts
          </h1>
          <p className="mt-1.5 text-sm text-[#5C5449]">
            Save birth details once to calculate complete AstroSage-calibrated Parashari, KP, Jaimini, and Ashtakavarga charts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          disabled={profiles.length >= tierLimit}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>{showCreateForm ? 'Close Form' : 'Add Birth Details'}</span>
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
            <h2 className="font-serif text-2xl font-medium text-[#3D3830]">Add Birth Details</h2>
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

      {/* Search Filter */}
      {profiles.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#8B8275]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter saved profiles..."
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] pl-10 pr-4 py-2.5 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#4A453D] focus:outline-none"
          />
        </div>
      )}

      {/* Profile List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((n) => (
            <div key={n} className="h-24 rounded-3xl bg-[#F1ECE3] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-10 text-center">
          <h2 className="font-serif text-2xl font-medium text-[#3D3830]">No Birth Profiles Yet</h2>
          <p className="mt-2 text-sm text-[#5C5449] max-w-md mx-auto">
            Add your birth details or a family member&apos;s chart to calculate complete D1–D60 Vargas, KP Sub-Lords, Jaimini Karakas, and Vimshottari Dashas.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="mt-5 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-[#4A453D] px-6 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Birth Details</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((profile) => (
            <div
              key={profile.id}
              className={`rounded-3xl border p-6 flex flex-col justify-between gap-5 transition-colors ${
                profile.is_default
                  ? 'bg-[#F1ECE3]/85 border-[#3D3830]/20'
                  : 'bg-[#FDFBF7] border-[#3D3830]/10'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-[#8B8275] mb-1 flex flex-wrap items-center gap-1.5">
                      {profile.is_default && (
                        <span className="font-medium text-[#3D3830]">You (Primary) ·</span>
                      )}
                      <span>{profile.relationship || 'Profile'}</span>
                    </p>
                    <h3 className="font-serif text-2xl font-medium text-[#3D3830] truncate">
                      {profile.name}
                    </h3>

                    {editingLabelId === profile.id ? (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="text"
                          value={editingShortName}
                          maxLength={40}
                          onChange={(e) => setEditingShortName(e.target.value)}
                          placeholder="Short name (e.g. Mom)"
                          className="w-40 rounded-lg border border-[#3D3830]/20 bg-[#FAF7F2] px-2.5 py-1 text-xs text-[#3D3830] focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={updatingMetaId === profile.id}
                          onClick={() => void handleSaveShortName(profile.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-[#4A453D] px-3 py-1 text-[11px] font-medium text-[#FAF7F2] hover:bg-[#38342E]"
                        >
                          <Check className="h-3 w-3" />
                          <span>Save</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingLabelId(null)}
                          className="text-[11px] text-[#8B8275] hover:text-[#3D3830]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-2 text-xs text-[#5C5449]">
                        <span>
                          Short label:{' '}
                          <span className="font-medium text-[#3D3830]">
                            {profile.short_name?.trim() || 'Not set'}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLabelId(profile.id);
                            setEditingShortName(profile.short_name || '');
                          }}
                          className="inline-flex items-center gap-1 text-[11px] text-[#8B8275] hover:text-[#3D3830]"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {confirmDeleteId === profile.id ? (
                    <div className="flex items-center gap-2 text-xs shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDelete(profile.id)}
                        className="font-medium text-[#A94438] hover:underline"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-[#8B8275] hover:text-[#3D3830]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(profile.id)}
                      aria-label="Delete Profile"
                      className="text-[#8B8275] hover:text-[#A94438] p-1.5 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <p className="mt-2 font-['DM_Sans',sans-serif] tabular-nums text-xs text-[#5C5449]">
                  {profile.birth_date} · {profile.birth_time}
                </p>
                <p className="mt-1 text-xs text-[#8B8275]">
                  Born in {[profile.birth_city, profile.birth_state, profile.birth_country].filter(Boolean).join(', ')}
                </p>

                {/* Current Location display + inline edit */}
                {editingLocationId === profile.id ? (
                  <div className="mt-2.5 space-y-2 relative">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-[#5C5449]">Current location</span>
                      <button
                        type="button"
                        onClick={() => {
                          const birthFormatted = [
                            profile.birth_city,
                            profile.birth_state,
                            profile.birth_country,
                          ]
                            .filter(Boolean)
                            .join(', ');
                          setEditingLocationQuery(birthFormatted);
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
                        value={editingLocationQuery}
                        onChange={(e) => {
                          setEditingLocationQuery(e.target.value);
                          setSelectedEditLocation(null);
                        }}
                        placeholder="City, Country (leave blank to clear)"
                        className="w-full rounded-lg border border-[#3D3830]/20 bg-[#FAF7F2] px-2.5 py-1.5 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#4A453D] focus:outline-none"
                      />
                      {loadingLocationSuggestions && (
                        <Loader2 className="h-3.5 w-3.5 text-[#8B8275] animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
                      )}
                    </div>
                    {locationSuggestions.length > 0 && (
                      <div className="rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] shadow-lg p-1 max-h-40 overflow-y-auto space-y-0.5">
                        {locationSuggestions.map((place, idx) => (
                          <button
                            key={`edit-loc-${idx}`}
                            type="button"
                            onClick={() => {
                              setSelectedEditLocation(place);
                              setEditingLocationQuery(place.label);
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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={updatingMetaId === profile.id}
                        onClick={() => void handleSaveCurrentLocation(profile.id)}
                        className="inline-flex items-center gap-1 rounded-full bg-[#4A453D] px-3 py-1 text-[11px] font-medium text-[#FAF7F2] hover:bg-[#38342E] cursor-pointer"
                      >
                        <Check className="h-3 w-3" />
                        <span>Save</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLocationId(null);
                          setSelectedEditLocation(null);
                          setLocationSuggestions([]);
                        }}
                        className="text-[11px] text-[#8B8275] hover:text-[#3D3830] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-[#5C5449]">
                    <span className="truncate">
                      Lives in:{' '}
                      <span className="font-medium text-[#3D3830]">
                        {[profile.current_city, profile.current_state, profile.current_country]
                          .filter(Boolean)
                          .join(', ') || 'Not set'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLocationId(profile.id);
                        setEditingLocationQuery(
                          [profile.current_city, profile.current_state, profile.current_country]
                            .filter(Boolean)
                            .join(', ')
                        );
                        setSelectedEditLocation(null);
                        setLocationSuggestions([]);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-[#8B8275] hover:text-[#3D3830] shrink-0 cursor-pointer"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Edit</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#3D3830]/10">
                <button
                  type="button"
                  disabled={inspectingId === profile.id}
                  onClick={() => void handleInspectChart(profile.id)}
                  className="min-h-[40px] inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-60 transition-colors"
                >
                  {inspectingId === profile.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {inspectingId === profile.id ? 'Opening Chart...' : 'Inspect Chart & Dashas'}
                  </span>
                </button>

                {!profile.is_default && (
                  <button
                    type="button"
                    disabled={updatingMetaId === profile.id}
                    onClick={() => void handleSetAsDefault(profile.id)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/20 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7] transition-colors disabled:opacity-50"
                  >
                    <UserCheck className="h-3.5 w-3.5 text-[#8B7355]" />
                    <span>{updatingMetaId === profile.id ? 'Updating...' : 'Set as Your Chart'}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfileManager;

