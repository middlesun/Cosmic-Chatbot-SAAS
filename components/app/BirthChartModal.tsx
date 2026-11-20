import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import CustomDatePicker from './CustomDatePicker';
import CustomSelect, { type CustomSelectOption } from './CustomSelect';
import type { ChatProfile, PendingBirthProfileDraft, PlaceSuggestion } from './chatTypes';

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

const RELATIONSHIP_OPTIONS: CustomSelectOption[] = [
  { value: 'Self', label: 'Self' },
  { value: 'Spouse', label: 'Spouse' },
  { value: 'Child', label: 'Child' },
  { value: 'Parent', label: 'Parent' },
  { value: 'Partner', label: 'Partner' },
  { value: 'Client', label: 'Client' },
  { value: 'Friend', label: 'Friend' },
  { value: 'Other', label: 'Other' },
];

const GENDER_OPTIONS: CustomSelectOption[] = [
  { value: '', label: 'Not specified' },
  { value: 'Female', label: 'Female' },
  { value: 'Male', label: 'Male' },
  { value: 'Non-binary', label: 'Non-binary' },
];

function parse24HourTo12Hour(hhmm?: string): { hour: string; minute: string; period: 'AM' | 'PM' } {
  if (!hhmm || !/^\d{1,2}:\d{2}/.test(hhmm.trim())) {
    return { hour: '12', minute: '00', period: 'PM' };
  }
  const [hStr, mStr] = hhmm.trim().split(':');
  const h24 = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h24) || !Number.isFinite(m)) {
    return { hour: '12', minute: '00', period: 'PM' };
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

export interface ChartCreationProgressProps {
  status: 'creating' | 'success' | 'error';
  subjectName?: string;
  errorMessage?: string;
  onRetryEdit?: () => void;
  compact?: boolean;
}

const PROGRESS_STAGES = [
  { pct: 22, label: 'Locating birth coordinates & historical timezone...' },
  { pct: 54, label: 'Calculating planetary degrees & divisional charts...' },
  { pct: 80, label: 'Computing Vimshottari Dashas & KP Sub-Lords...' },
  { pct: 93, label: 'Saving your birth chart permanently...' },
];

export const ChartCreationProgress: React.FC<ChartCreationProgressProps> = ({
  status,
  subjectName,
  errorMessage,
  onRetryEdit,
  compact = false,
}) => {
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    if (status !== 'creating') return;
    setStageIdx(0);
    const t1 = window.setTimeout(() => setStageIdx(1), 1100);
    const t2 = window.setTimeout(() => setStageIdx(2), 2500);
    const t3 = window.setTimeout(() => setStageIdx(3), 4300);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [status]);

  if (status === 'error') {
    return (
      <div
        className={`rounded-2xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 ${
          compact ? 'p-4' : 'p-5'
        } space-y-3`}
      >
        <div className="flex items-start gap-2.5 text-sm text-[#7A3E36]">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium">Could not create the birth chart</p>
            <p className="text-xs leading-relaxed text-[#7A3E36]/90">
              {errorMessage || 'Please check the birth place spelling (include City and Country) and try again.'}
            </p>
          </div>
        </div>
        {onRetryEdit && (
          <button
            type="button"
            onClick={onRetryEdit}
            className="min-h-[44px] inline-flex items-center justify-center rounded-xl bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors"
          >
            Edit Birth Details
          </button>
        )}
      </div>
    );
  }

  const isSuccess = status === 'success';
  const currentStage = PROGRESS_STAGES[Math.min(stageIdx, PROGRESS_STAGES.length - 1)];
  const percentage = isSuccess ? 100 : currentStage.pct;

  return (
    <div
      className={`rounded-2xl border ${
        isSuccess
          ? 'border-[#2D6A4F]/25 bg-[#2D6A4F]/[0.06]'
          : 'border-[#3D3830]/12 bg-[#FDFBF7]'
      } ${compact ? 'p-4' : 'p-6'} space-y-3.5 transition-colors duration-300`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {isSuccess ? (
            <span className="h-8 w-8 rounded-full bg-[#2D6A4F]/15 text-[#2D6A4F] flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </span>
          ) : (
            <span className="h-8 w-8 rounded-full bg-[#B8965A]/15 text-[#8B7355] flex items-center justify-center shrink-0">
              <Loader2 className="h-4 w-4 animate-spin" />
            </span>
          )}
          <div className="min-w-0">
            <p
              className={`text-sm font-medium ${
                isSuccess ? 'text-[#2D6A4F]' : 'text-[#3D3830]'
              }`}
            >
              {isSuccess ? 'Success' : 'Creating your birth chart'}
            </p>
            <p className="text-xs text-[#5C5449] truncate">
              {isSuccess
                ? subjectName
                  ? `${subjectName}'s birth chart is saved and ready.`
                  : 'Your birth chart is saved and ready.'
                : subjectName
                ? `Preparing ${subjectName}'s natal chart & Dashas...`
                : currentStage.label}
            </p>
          </div>
        </div>
        <span className="font-['JetBrains_Mono',monospace] tabular-nums text-xs text-[#8B8275] shrink-0">
          {percentage}%
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-[#3D3830]/10 overflow-hidden">
        <div
          style={{ width: `${percentage}%` }}
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            isSuccess
              ? 'bg-[#2D6A4F]'
              : 'bg-gradient-to-r from-[#8B7355] to-[#B8965A]'
          }`}
        />
      </div>

      {!isSuccess && (
        <p className="text-[11px] text-[#8B8275] flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-[#B8965A] shrink-0" />
          <span>{currentStage.label}</span>
        </p>
      )}
    </div>
  );
};

export interface BirthChartFormProps {
  getAccessToken: () => Promise<string | null>;
  isPreviewMode?: boolean;
  isFirstChart?: boolean;
  initialValues?: Partial<PendingBirthProfileDraft>;
  submitLabel?: string;
  onCancel?: () => void;
  onCreated: (profile: ChatProfile) => void;
}

export const BirthChartForm: React.FC<BirthChartFormProps> = ({
  getAccessToken,
  isPreviewMode = false,
  isFirstChart = false,
  initialValues,
  submitLabel = 'Create Birth Chart',
  onCancel,
  onCreated,
}) => {
  const initial12 = useMemo(
    () => parse24HourTo12Hour(initialValues?.birth_time),
    [initialValues?.birth_time]
  );

  const [name, setName] = useState(initialValues?.name || '');
  const [shortName, setShortName] = useState('');
  const [birthDate, setBirthDate] = useState(initialValues?.birth_date || '');
  const [hour12, setHour12] = useState(initial12.hour);
  const [minute, setMinute] = useState(initial12.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initial12.period);
  const [unknownTime, setUnknownTime] = useState(false);

  const initialPlaceText =
    initialValues?.place_query ||
    [initialValues?.birth_city, initialValues?.birth_state, initialValues?.birth_country]
      .filter(Boolean)
      .join(', ');
  const [placeQuery, setPlaceQuery] = useState(initialPlaceText);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Current Location (optional — used for relocation context, local timing & transit precision)
  const [currentPlaceQuery, setCurrentPlaceQuery] = useState('');
  const [selectedCurrentPlace, setSelectedCurrentPlace] = useState<PlaceSuggestion | null>(null);
  const [currentSuggestions, setCurrentSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loadingCurrentPlaces, setLoadingCurrentPlaces] = useState(false);
  const [showCurrentSuggestions, setShowCurrentSuggestions] = useState(false);

  const [relationship, setRelationship] = useState(
    initialValues?.relationship || (isFirstChart ? 'Self' : 'Other')
  );
  const [gender, setGender] = useState(initialValues?.gender || '');
  const [isDefault, setIsDefault] = useState(isFirstChart);

  const [submitState, setSubmitState] = useState<'idle' | 'creating' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const placeContainerRef = useRef<HTMLDivElement>(null);
  const placeAbortRef = useRef<AbortController | null>(null);
  const currentPlaceContainerRef = useRef<HTMLDivElement>(null);
  const currentPlaceAbortRef = useRef<AbortController | null>(null);

  // Sync if initialValues change (e.g., opening Edit Details from Chat confirmation card)
  useEffect(() => {
    if (!initialValues) return;
    if (initialValues.name) setName(initialValues.name);
    if (initialValues.birth_date) setBirthDate(initialValues.birth_date);
    if (initialValues.birth_time) {
      const parsed = parse24HourTo12Hour(initialValues.birth_time);
      setHour12(parsed.hour);
      setMinute(parsed.minute);
      setPeriod(parsed.period);
    }
    const nextPlace =
      initialValues.place_query ||
      [initialValues.birth_city, initialValues.birth_state, initialValues.birth_country]
        .filter(Boolean)
        .join(', ');
    if (nextPlace) {
      setPlaceQuery(nextPlace);
      setSelectedPlace(null);
    }
    if (initialValues.relationship) setRelationship(initialValues.relationship);
    if (initialValues.gender) setGender(initialValues.gender);
  }, [initialValues]);

  // Close place suggestions on outside click
  useEffect(() => {
    if (!showSuggestions && !showCurrentSuggestions) return;
    const handleOutside = (e: MouseEvent) => {
      if (placeContainerRef.current && !placeContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (
        currentPlaceContainerRef.current &&
        !currentPlaceContainerRef.current.contains(e.target as Node)
      ) {
        setShowCurrentSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showSuggestions, showCurrentSuggestions]);

  // Debounced natural place autocomplete (Place of Birth)
  useEffect(() => {
    const trimmed = placeQuery.trim();
    if (
      isPreviewMode ||
      trimmed.length < 2 ||
      (selectedPlace && selectedPlace.label === trimmed)
    ) {
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
        const token = await getAccessToken();
        if (!token) {
          setLoadingPlaces(false);
          return;
        }
        const res = await fetch(`/api/profiles/places?q=${encodeURIComponent(trimmed)}`, {
          headers: { Authorization: `Bearer ${token}` },
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
    }, 320);

    return () => {
      window.clearTimeout(timer);
    };
  }, [getAccessToken, isPreviewMode, placeQuery, selectedPlace]);

  // Debounced natural place autocomplete (Current Location)
  useEffect(() => {
    const trimmed = currentPlaceQuery.trim();
    if (
      isPreviewMode ||
      trimmed.length < 2 ||
      (selectedCurrentPlace && selectedCurrentPlace.label === trimmed)
    ) {
      setCurrentSuggestions([]);
      setLoadingCurrentPlaces(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      currentPlaceAbortRef.current?.abort();
      const controller = new AbortController();
      currentPlaceAbortRef.current = controller;
      setLoadingCurrentPlaces(true);
      try {
        const token = await getAccessToken();
        if (!token) {
          setLoadingCurrentPlaces(false);
          return;
        }
        const res = await fetch(`/api/profiles/places?q=${encodeURIComponent(trimmed)}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok) {
          setCurrentSuggestions([]);
          setLoadingCurrentPlaces(false);
          return;
        }
        const data = await res.json();
        setCurrentSuggestions(Array.isArray(data.places) ? data.places : []);
        setShowCurrentSuggestions(true);
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          setCurrentSuggestions([]);
        }
      } finally {
        setLoadingCurrentPlaces(false);
      }
    }, 320);

    return () => {
      window.clearTimeout(timer);
    };
  }, [getAccessToken, isPreviewMode, currentPlaceQuery, selectedCurrentPlace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    const trimmedPlace = placeQuery.trim();

    if (!trimmedName) {
      setErrorMessage('Please enter a name for this birth chart.');
      return;
    }
    if (!birthDate) {
      setErrorMessage('Please select the date of birth.');
      return;
    }
    if (!trimmedPlace) {
      setErrorMessage('Please enter the place of birth (city and country).');
      return;
    }

    const finalBirthTime = unknownTime
      ? '12:00'
      : convert12HourTo24Hour(hour12, minute, period);

    setSubmitState('creating');

    if (isPreviewMode) {
      window.setTimeout(() => {
        setSubmitState('success');
        const cityPart = trimmedPlace.split(',')[0]?.trim() || trimmedPlace;
        const countryPart = trimmedPlace.split(',').slice(-1)[0]?.trim() || '';
        const trimmedCurrent = currentPlaceQuery.trim();
        const curCityPart = trimmedCurrent ? trimmedCurrent.split(',')[0]?.trim() || trimmedCurrent : null;
        const curCountryPart = trimmedCurrent ? trimmedCurrent.split(',').slice(-1)[0]?.trim() || null : null;
        const previewProfile: ChatProfile = {
          id: `preview-prof-${Date.now()}`,
          name: trimmedName,
          short_name: shortName.trim() || null,
          is_default: isDefault,
          birth_date: birthDate,
          birth_time: finalBirthTime,
          birth_city: cityPart,
          birth_country: countryPart,
          current_city: curCityPart,
          current_country: curCountryPart,
          relationship,
          is_activated: true,
        };
        window.setTimeout(() => {
          onCreated(previewProfile);
        }, 850);
      }, 1300);
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        setSubmitState('error');
        setErrorMessage('Please sign in to save your birth chart.');
        return;
      }

      const payload: Record<string, unknown> = {
        name: trimmedName,
        short_name: shortName.trim() || undefined,
        is_default: isDefault,
        birth_date: birthDate,
        birth_time: finalBirthTime,
        place_query: trimmedPlace,
        gender: gender || undefined,
        relationship,
      };

      if (selectedPlace) {
        payload.birth_city = selectedPlace.city;
        payload.birth_state = selectedPlace.state;
        payload.birth_country = selectedPlace.country;
        payload.latitude = selectedPlace.latitude;
        payload.longitude = selectedPlace.longitude;
        if (typeof selectedPlace.timezoneOffset === 'number') {
          payload.timezone_offset = selectedPlace.timezoneOffset;
        }
      }

      const trimmedCurrent = currentPlaceQuery.trim();
      if (selectedCurrentPlace) {
        payload.current_city = selectedCurrentPlace.city;
        payload.current_state = selectedCurrentPlace.state;
        payload.current_country = selectedCurrentPlace.country;
        if (typeof selectedCurrentPlace.timezoneOffset === 'number') {
          payload.current_timezone_offset = selectedCurrentPlace.timezoneOffset;
        }
      } else if (trimmedCurrent) {
        payload.current_place_query = trimmedCurrent;
      }

      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitState('error');
        setErrorMessage(
          data.error || 'Could not calculate the birth chart. Please check the birth place and try again.'
        );
        return;
      }

      setSubmitState('success');
      const createdProfile = data.profile as ChatProfile;
      window.setTimeout(() => {
        onCreated(createdProfile);
      }, 900);
    } catch (err) {
      setSubmitState('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Network error while creating your birth chart.'
      );
    }
  };

  if (submitState === 'creating' || submitState === 'success') {
    return (
      <div className="py-2">
        <ChartCreationProgress status={submitState} subjectName={name.trim()} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {(errorMessage || submitState === 'error') && (
        <div className="rounded-xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-3.5 py-2.5 text-xs text-[#7A3E36] flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Name + Optional Short Name */}
      <div className="grid sm:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
            Full Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aarav Sharma"
            className="w-full min-h-[44px] rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#4A453D] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
            Short Name <span className="text-[#8B8275] font-normal">(optional)</span>
          </label>
          <input
            type="text"
            maxLength={32}
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            placeholder="e.g. Aarav, Mom"
            className="w-full min-h-[44px] rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#4A453D] focus:outline-none"
          />
        </div>
      </div>

      {/* Date of Birth */}
      <div>
        <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
          Date of Birth *
        </label>
        <CustomDatePicker
          required
          value={birthDate}
          onChange={setBirthDate}
          placeholder="Select date of birth"
          ariaLabel="Date of Birth"
        />
      </div>

      {/* Time of Birth — Effortless 12-hour AM/PM */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-[#5C5449]">
          Time of Birth (AM / PM) *
        </label>
        <div
          className={`grid grid-cols-3 gap-2.5 transition-opacity ${
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
            onChange={(v) => setPeriod(v as 'AM' | 'PM')}
            options={PERIOD_OPTIONS}
            ariaLabel="AM or PM"
            surface="canvas"
            size="md"
            triggerClassName="min-h-[44px]"
          />
        </div>

        <label className="inline-flex items-center gap-2.5 cursor-pointer pt-0.5 text-xs text-[#5C5449] select-none">
          <input
            type="checkbox"
            checked={unknownTime}
            onChange={(e) => setUnknownTime(e.target.checked)}
            className="h-4 w-4 rounded border-[#3D3830]/30 accent-[#4A453D]"
          />
          <span>I don&apos;t know the exact time (use 12:00 PM approximate)</span>
        </label>
      </div>

      {/* Single Natural Place of Birth Search */}
      <div ref={placeContainerRef} className="relative">
        <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
          Place of Birth *
        </label>
        <div className="relative">
          <MapPin className="h-4 w-4 text-[#8B8275] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            required
            value={placeQuery}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            onChange={(e) => {
              setPlaceQuery(e.target.value);
              setSelectedPlace(null);
            }}
            placeholder="Type city or town (e.g. Pune, Mumbai, London)"
            className="w-full min-h-[44px] rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] pl-10 pr-9 py-2.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#4A453D] focus:outline-none"
          />
          {loadingPlaces ? (
            <Loader2 className="h-4 w-4 text-[#8B8275] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
          ) : selectedPlace ? (
            <CheckCircle2 className="h-4 w-4 text-[#2D6A4F] absolute right-3 top-1/2 -translate-y-1/2" />
          ) : (
            <Search className="h-3.5 w-3.5 text-[#8B8275]/70 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>

        {selectedPlace ? (
          <p className="mt-1 text-[11px] text-[#2D6A4F]">
            Location selected: {selectedPlace.label}
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-[#8B8275]">
            Pick a match from the list or enter City, State, Country directly.
          </p>
        )}

        {showSuggestions && suggestions.length > 0 && (
          <div className="animate-cc-dropdown-down absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-[#3D3830]/15 bg-[#FDFBF7] shadow-[0_18px_42px_-12px_rgba(61,56,48,0.22)] p-1.5 max-h-56 overflow-y-auto">
            {suggestions.map((place, idx) => (
              <button
                key={`${place.latitude}-${place.longitude}-${idx}`}
                type="button"
                onClick={() => {
                  setSelectedPlace(place);
                  setPlaceQuery(place.label);
                  setShowSuggestions(false);
                }}
                className="w-full text-left rounded-xl px-3 py-2.5 hover:bg-[#F1ECE3] transition-colors flex items-start gap-2.5"
              >
                <MapPin className="h-3.5 w-3.5 text-[#8B7355] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm text-[#3D3830] font-medium truncate">
                    {place.city}
                  </p>
                  <p className="text-[11px] text-[#8B8275] truncate">
                    {[place.state, place.country].filter(Boolean).join(', ')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Current Location (Optional, with 1-tap Same as birth city shortcut) */}
      <div ref={currentPlaceContainerRef} className="relative">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label className="text-xs font-medium text-[#5C5449]">
            Current Location <span className="text-[#8B8275] font-normal">(optional)</span>
          </label>
          {placeQuery.trim() && (
            <button
              type="button"
              onClick={() => {
                setCurrentPlaceQuery(selectedPlace ? selectedPlace.label : placeQuery.trim());
                setSelectedCurrentPlace(selectedPlace);
                setShowCurrentSuggestions(false);
              }}
              className="text-[11px] font-medium text-[#8B7355] hover:text-[#3D3830] underline underline-offset-2 transition-colors cursor-pointer"
            >
              Same as birth city
            </button>
          )}
        </div>
        <div className="relative">
          <MapPin className="h-4 w-4 text-[#8B8275] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={currentPlaceQuery}
            onFocus={() => {
              if (currentSuggestions.length > 0) setShowCurrentSuggestions(true);
            }}
            onChange={(e) => {
              setCurrentPlaceQuery(e.target.value);
              setSelectedCurrentPlace(null);
            }}
            placeholder="Where you live today (e.g. Bengaluru, Dubai, New York)"
            className="w-full min-h-[44px] rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] pl-10 pr-9 py-2.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#4A453D] focus:outline-none"
          />
          {loadingCurrentPlaces ? (
            <Loader2 className="h-4 w-4 text-[#8B8275] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
          ) : selectedCurrentPlace ? (
            <CheckCircle2 className="h-4 w-4 text-[#2D6A4F] absolute right-3 top-1/2 -translate-y-1/2" />
          ) : (
            <Search className="h-3.5 w-3.5 text-[#8B8275]/70 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>

        <p className="mt-1 text-[11px] text-[#8B8275]">
          {selectedCurrentPlace
            ? `Current city: ${selectedCurrentPlace.label}`
            : 'Helps calibrate relocation, local timing, and personal context. Editable anytime.'}
        </p>

        {showCurrentSuggestions && currentSuggestions.length > 0 && (
          <div className="animate-cc-dropdown-down absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-[#3D3830]/15 bg-[#FDFBF7] shadow-[0_18px_42px_-12px_rgba(61,56,48,0.22)] p-1.5 max-h-56 overflow-y-auto">
            {currentSuggestions.map((place, idx) => (
              <button
                key={`cur-${place.latitude}-${place.longitude}-${idx}`}
                type="button"
                onClick={() => {
                  setSelectedCurrentPlace(place);
                  setCurrentPlaceQuery(place.label);
                  setShowCurrentSuggestions(false);
                }}
                className="w-full text-left rounded-xl px-3 py-2.5 hover:bg-[#F1ECE3] transition-colors flex items-start gap-2.5"
              >
                <MapPin className="h-3.5 w-3.5 text-[#8B7355] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm text-[#3D3830] font-medium truncate">
                    {place.city}
                  </p>
                  <p className="text-[11px] text-[#8B8275] truncate">
                    {[place.state, place.country].filter(Boolean).join(', ')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Optional Relationship & Gender */}
      <div className="grid sm:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
            Relationship
          </label>
          <CustomSelect
            value={relationship}
            onChange={setRelationship}
            options={RELATIONSHIP_OPTIONS}
            ariaLabel="Relationship"
            surface="canvas"
            size="md"
            triggerClassName="min-h-[44px]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
            Gender <span className="text-[#8B8275] font-normal">(optional)</span>
          </label>
          <CustomSelect
            value={gender}
            onChange={setGender}
            options={GENDER_OPTIONS}
            ariaLabel="Gender"
            surface="canvas"
            size="md"
            triggerClassName="min-h-[44px]"
          />
        </div>
      </div>

      {/* Mark as "You" default */}
      <label className="flex items-start gap-3 rounded-xl border border-[#3D3830]/10 bg-[#FAF7F2] px-3.5 py-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-[#3D3830]/30 accent-[#4A453D]"
        />
        <span className="text-xs text-[#3D3830] leading-relaxed">
          <span className="font-medium">This is my chart (show as &quot;You&quot;)</span>
          <span className="block text-[#8B8275] mt-0.5">
            Gives you a 1-tap &quot;Your Chart&quot; shortcut whenever you start a new chat.
          </span>
        </span>
      </label>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2.5 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-full border border-[#3D3830]/15 px-5 py-2 text-sm text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3]/60 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-[#4A453D] px-6 py-2.5 text-sm font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          {submitLabel}
        </button>
      </div>
    </form>
  );
};

export interface BirthChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (profile: ChatProfile) => void;
  getAccessToken: () => Promise<string | null>;
  isPreviewMode?: boolean;
  isFirstChart?: boolean;
  initialValues?: Partial<PendingBirthProfileDraft>;
  title?: string;
}

const BirthChartModal: React.FC<BirthChartModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  getAccessToken,
  isPreviewMode = false,
  isFirstChart = false,
  initialValues,
  title = 'Add Birth Details',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#3D3830]/45 backdrop-blur-xs p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-3xl border border-[#3D3830]/15 bg-[#FDFBF7] shadow-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-['Cormorant_Garamond',serif] text-2xl sm:text-[26px] font-medium text-[#3D3830] leading-tight">
              {title}
            </h2>
            <p className="text-xs text-[#8B8275] mt-1">
              Calculated once and saved permanently for all future consultations.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-9 w-9 rounded-full flex items-center justify-center text-[#8B8275] hover:bg-[#F1ECE3] hover:text-[#3D3830] transition-colors shrink-0"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <BirthChartForm
          getAccessToken={getAccessToken}
          isPreviewMode={isPreviewMode}
          isFirstChart={isFirstChart}
          initialValues={initialValues}
          onCancel={onClose}
          onCreated={(profile) => {
            onCreated(profile);
            onClose();
          }}
        />
      </div>
    </div>
  );
};

export default BirthChartModal;
