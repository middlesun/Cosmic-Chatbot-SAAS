import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Lock,
  MapPin,
  Search,
} from 'lucide-react';
import CustomDatePicker from './app/CustomDatePicker';
import CustomSelect, { type CustomSelectOption } from './app/CustomSelect';
import CompanionAvatar from './app/CompanionAvatar';
import type { PlaceSuggestion, PublicCompanionCard } from './app/chatTypes';
import {
  formatPendingBirthSummary,
  getPendingOnboardingDraft,
  savePendingOnboardingDraft,
  signInWithGooglePreservingDraft,
  type PendingBirthChartDraft,
} from '../lib/pendingOnboarding';

const HOUR_OPTIONS: CustomSelectOption[] = Array.from({ length: 12 }, (_, idx) => {
  const hr = String(idx + 1);
  return { value: hr, label: hr };
});

const MINUTE_OPTIONS: CustomSelectOption[] = Array.from({ length: 60 }, (_, idx) => {
  const mm = String(idx).padStart(2, '0');
  return { value: mm, label: mm };
});

const PERIOD_OPTIONS: CustomSelectOption[] = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
];

function parse24HourTo12Hour(hhmm?: string): { hour: string; minute: string; period: 'AM' | 'PM' } {
  if (!hhmm || !/^\d{1,2}:\d{2}/.test(hhmm.trim())) {
    return { hour: '9', minute: '00', period: 'AM' };
  }
  const [hStr, mStr] = hhmm.trim().split(':');
  const h24 = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h24) || !Number.isFinite(m)) {
    return { hour: '9', minute: '00', period: 'AM' };
  }
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return {
    hour: String(h12),
    minute: String(Math.max(0, Math.min(59, m))).padStart(2, '0'),
    period,
  };
}

function convert12HourTo24Hour(hour12: string, minute: string, period: 'AM' | 'PM'): string {
  let h = Number(hour12) || 12;
  const m = Number(minute) || 0;
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface LandingBirthChartCardProps {
  variant?: 'hero' | 'modal';
  companion?: PublicCompanionCard | null;
  onDraftSaved?: (draft: PendingBirthChartDraft) => void;
}

const LandingBirthChartCard: React.FC<LandingBirthChartCardProps> = ({
  variant = 'hero',
  companion = null,
  onDraftSaved,
}) => {
  const existingDraft = useMemo(() => getPendingOnboardingDraft(), []);
  const initial12 = useMemo(
    () => parse24HourTo12Hour(existingDraft?.birth_time),
    [existingDraft?.birth_time]
  );

  const [name, setName] = useState(existingDraft?.name || '');
  const [birthDate, setBirthDate] = useState(existingDraft?.birth_date || '');
  const [hour12, setHour12] = useState(initial12.hour);
  const [minute, setMinute] = useState(initial12.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initial12.period);
  const [unknownTime, setUnknownTime] = useState(Boolean(existingDraft?.unknown_time));

  const [placeQuery, setPlaceQuery] = useState(existingDraft?.place_query || '');
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(() => {
    if (
      existingDraft?.birth_city &&
      typeof existingDraft.latitude === 'number' &&
      typeof existingDraft.longitude === 'number'
    ) {
      return {
        label: existingDraft.place_query,
        city: existingDraft.birth_city,
        state: existingDraft.birth_state || null,
        country: existingDraft.birth_country || '',
        latitude: existingDraft.latitude,
        longitude: existingDraft.longitude,
        timezoneOffset: existingDraft.timezone_offset ?? null,
      };
    }
    return null;
  });
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [stage, setStage] = useState<'form' | 'gmail'>('form');
  const [savedDraft, setSavedDraft] = useState<PendingBirthChartDraft | null>(existingDraft);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittingGmail, setSubmittingGmail] = useState(false);

  const placeContainerRef = useRef<HTMLDivElement>(null);
  const placeAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!showSuggestions) return;
    const handleOutside = (e: MouseEvent) => {
      if (placeContainerRef.current && !placeContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showSuggestions]);

  useEffect(() => {
    const trimmed = placeQuery.trim();
    if (trimmed.length < 2 || (selectedPlace && selectedPlace.label === trimmed)) {
      setSuggestions([]);
      setLoadingPlaces(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      placeAbortRef.current?.abort();
      const controller = new AbortController();
      placeAbortRef.current = controller;
      setLoadingPlaces(true);
      try {
        const res = await fetch(`/api/public/places?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setSuggestions([]);
          setLoadingPlaces(false);
          return;
        }
        const data = await res.json();
        setSuggestions(Array.isArray(data.places) ? data.places : []);
        setShowSuggestions(true);
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          setSuggestions([]);
        }
      } finally {
        setLoadingPlaces(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      placeAbortRef.current?.abort();
    };
  }, [placeQuery, selectedPlace]);

  const handlePlaceSelect = (place: PlaceSuggestion) => {
    setSelectedPlace(place);
    setPlaceQuery(place.label);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    const trimmedPlace = placeQuery.trim();

    if (!trimmedName) {
      setErrorMessage('Please enter your name.');
      return;
    }
    if (!birthDate) {
      setErrorMessage('Please select your date of birth.');
      return;
    }
    if (!trimmedPlace) {
      setErrorMessage('Please enter your birth city and country.');
      return;
    }

    const finalBirthTime = unknownTime ? '12:00' : convert12HourTo24Hour(hour12, minute, period);

    const draft = savePendingOnboardingDraft({
      name: trimmedName,
      birth_date: birthDate,
      birth_time: finalBirthTime,
      unknown_time: unknownTime,
      place_query: trimmedPlace,
      birth_city: selectedPlace?.city,
      birth_state: selectedPlace?.state ?? null,
      birth_country: selectedPlace?.country,
      latitude: selectedPlace?.latitude ?? null,
      longitude: selectedPlace?.longitude ?? null,
      timezone_offset: selectedPlace?.timezoneOffset ?? null,
      companion_slug: companion?.slug || null,
      companion_name: companion?.name || null,
    });

    setSavedDraft(draft);
    onDraftSaved?.(draft);
    setStage('gmail');
  };

  const handleGmailContinue = async () => {
    setErrorMessage(null);
    setSubmittingGmail(true);
    const activeDraft =
      savedDraft ||
      getPendingOnboardingDraft() ||
      undefined;

    if (activeDraft && companion?.slug && activeDraft.companion_slug !== companion.slug) {
      savePendingOnboardingDraft({
        ...activeDraft,
        companion_slug: companion.slug,
        companion_name: companion.name,
      });
    }

    const result = await signInWithGooglePreservingDraft(activeDraft);
    if (result.error) {
      setErrorMessage(result.error);
      setSubmittingGmail(false);
    }
  };

  const wrapperClass =
    variant === 'hero'
      ? 'rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/14 p-6 sm:p-7 shadow-[0_24px_60px_-28px_rgba(61,56,48,0.18)]'
      : 'space-y-5';

  return (
    <div className={wrapperClass}>
      {companion && (
        <div className="mb-5 flex items-center gap-3.5 rounded-2xl bg-[#F1ECE3]/85 border border-[#3D3830]/10 p-3.5">
          <CompanionAvatar
            name={companion.name}
            avatarUrl={companion.avatar_url}
            palette={companion.monogram_palette}
            size="md"
            shape="circle"
          />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-lg font-semibold text-[#3D3830] leading-tight truncate">
              Chat with {companion.name}
            </p>
            <p className="text-xs text-[#8B8275] truncate">
              {companion.primary_expertise}
              {companion.secondary_expertise?.[0] &&
              companion.secondary_expertise[0].toLowerCase() !==
                companion.primary_expertise.toLowerCase()
                ? ` · ${companion.secondary_expertise[0]}`
                : ''}
            </p>
          </div>
        </div>
      )}

      {stage === 'gmail' && savedDraft ? (
        <div className="space-y-5 animate-cc-tab-panel">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2D6A4F]">
              <Check className="h-3.5 w-3.5" />
              <span>Birth details saved</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-[28px] font-medium text-[#3D3830] leading-tight">
              {companion
                ? `Sign in with Gmail to meet ${companion.name}`
                : 'Continue with Gmail to unlock your chart'}
            </h2>
            <p className="text-xs sm:text-sm text-[#5C5449] leading-relaxed">
              Your birth chart details are safely held and will be calculated automatically the moment you sign in.
            </p>
          </div>

          <div className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/12 px-4 py-3.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-[#8B8275]">Saved birth details</span>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setStage('form');
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#3D3830] underline underline-offset-4 hover:text-[#5C5449] cursor-pointer"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>Edit</span>
              </button>
            </div>
            <p className="text-xs sm:text-sm font-medium text-[#3D3830] leading-relaxed">
              {formatPendingBirthSummary(savedDraft)}
            </p>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-3.5 py-2.5 text-xs text-[#7A3E36] flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void handleGmailContinue()}
              disabled={submittingGmail}
              className="w-full min-h-[48px] flex items-center justify-center gap-2.5 rounded-full bg-[#4A453D] px-6 py-3.5 text-sm font-medium text-[#FAF7F2] shadow-[0_12px_28px_-14px_rgba(61,56,48,0.45)] transition-all duration-200 hover:bg-[#38342E] hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-55 cursor-pointer whitespace-nowrap"
            >
              {submittingGmail ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                  />
                </svg>
              )}
              <span>{submittingGmail ? 'Connecting to Gmail...' : 'Continue with Gmail'}</span>
            </button>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-[#8B8275]">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3 w-3" />
                <span>Private &amp; encrypted</span>
              </span>
              <Link
                to="/app/login"
                onClick={() => {
                  savePendingOnboardingDraft({
                    ...savedDraft,
                    companion_slug: companion?.slug ?? savedDraft.companion_slug ?? null,
                    companion_name: companion?.name ?? savedDraft.companion_name ?? null,
                  });
                }}
                className="text-[#5C5449] hover:text-[#3D3830] underline underline-offset-4"
              >
                Use email instead
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-serif text-2xl sm:text-[27px] font-medium text-[#3D3830] leading-tight">
              {companion
                ? `Enter birth details to chat with ${companion.name}`
                : 'Enter your birth details'}
            </h2>
            <p className="text-xs text-[#8B8275]">
              Save your birth details once
            </p>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-3.5 py-2.5 text-xs text-[#7A3E36] flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
              Your Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aarav Sharma"
              className="w-full min-h-[44px] rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] placeholder:text-[#8B8275]/80 focus:border-[#4A453D] focus:outline-none transition-colors"
            />
          </div>

          {/* Date of Birth */}
          <div>
            <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
              Date of Birth
            </label>
            <CustomDatePicker
              required
              value={birthDate}
              onChange={setBirthDate}
              placeholder="Select date of birth"
              ariaLabel="Date of Birth"
            />
          </div>

          {/* Time of Birth */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#5C5449]">
              Time of Birth
            </label>
            <div
              className={`grid grid-cols-3 gap-2 transition-opacity ${
                unknownTime ? 'opacity-45 pointer-events-none' : ''
              }`}
            >
              <CustomSelect
                value={hour12}
                onChange={setHour12}
                options={HOUR_OPTIONS}
                ariaLabel="Birth hour"
                surface="canvas"
                size="md"
                triggerClassName="min-h-[44px]"
              />
              <CustomSelect
                value={minute}
                onChange={setMinute}
                options={MINUTE_OPTIONS}
                ariaLabel="Birth minute"
                surface="canvas"
                size="md"
                triggerClassName="min-h-[44px]"
              />
              <CustomSelect
                value={period}
                onChange={(val) => setPeriod(val as 'AM' | 'PM')}
                options={PERIOD_OPTIONS}
                ariaLabel="AM or PM"
                surface="canvas"
                size="md"
                triggerClassName="min-h-[44px]"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-[#5C5449] cursor-pointer select-none pt-0.5">
              <input
                type="checkbox"
                checked={unknownTime}
                onChange={(e) => setUnknownTime(e.target.checked)}
                className="h-4 w-4 rounded border-[#3D3830]/25 accent-[#4A453D]"
              />
              <span>I don&apos;t know my exact time (use 12:00 PM)</span>
            </label>
          </div>

          {/* Place of Birth */}
          <div ref={placeContainerRef} className="relative">
            <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
              Place of Birth
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8B8275]" />
              <input
                type="text"
                required
                value={placeQuery}
                onChange={(e) => {
                  setPlaceQuery(e.target.value);
                  setSelectedPlace(null);
                }}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                placeholder="City, State, Country (e.g. Mumbai, India)"
                className="w-full min-h-[44px] rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] pl-10 pr-10 py-2.5 text-sm text-[#3D3830] placeholder:text-[#8B8275]/80 focus:border-[#4A453D] focus:outline-none transition-colors"
              />
              {loadingPlaces && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[#8B8275]" />
              )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-30 left-0 right-0 mt-1.5 max-h-56 overflow-y-auto rounded-2xl border border-[#3D3830]/14 bg-[#FDFBF7] shadow-xl py-1 animate-cc-dropdown-down">
                {suggestions.map((place, idx) => (
                  <button
                    key={`${place.label}-${idx}`}
                    type="button"
                    onClick={() => handlePlaceSelect(place)}
                    className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left text-xs text-[#3D3830] hover:bg-[#EAE3D7]/65 transition-colors cursor-pointer"
                  >
                    <MapPin className="h-3.5 w-3.5 text-[#8B7355] shrink-0 mt-0.5" />
                    <span className="leading-snug">{place.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full min-h-[48px] group inline-flex items-center justify-center gap-2 rounded-full bg-[#4A453D] px-6 py-3.5 text-sm font-medium text-[#FAF7F2] transition-all duration-200 hover:bg-[#38342E] hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer whitespace-nowrap"
          >
            <span>{companion ? `Continue to meet ${companion.name}` : 'Continue with Birth Chart'}</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>

          <p className="text-[11px] text-center text-[#8B8275]">
            Next: sign in privately with Gmail to compute &amp; save your chart.
          </p>
        </form>
      )}
    </div>
  );
};

export default LandingBirthChartCard;
