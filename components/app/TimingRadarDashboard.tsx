import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, CalendarClock, Sparkles } from 'lucide-react';
import { useAuth } from './AuthContext';
import {
  PREVIEW_RADAR_SNAPSHOT,
  PREVIEW_WESTERN_RADAR_SNAPSHOT,
} from './previewFixtures';

interface DashaProgressItem {
  level:
    | 'Mahadasha'
    | 'Antardasha'
    | 'Pratyantardasha'
    | 'Annual Profection'
    | 'Progressed Moon'
    | 'Solar Return';
  lord: string;
  startDate: string;
  endDate: string;
  percentElapsed: number;
  daysRemaining: number;
}

interface TransitAlignmentItem {
  planet: string;
  sign: string;
  dms: string;
  nakshatra: string;
  isRetrograde: boolean;
  houseFromLagna: number;
  houseFromMoon: number;
  savBindus: number;
  signal: 'supportive' | 'neutral' | 'intense';
  note: string;
}

interface ConvergenceWindow {
  label: string;
  windowRange: string;
  focusDomain: string;
  intensity: 'Peak Alignment' | 'Steady Consolidation' | 'Reflective Calibration';
  drivers: string;
}

interface TimingRadarSnapshot {
  mode?: 'vedic' | 'western';
  profileId: string;
  profileName: string;
  ascendantSign: string;
  moonSign: string;
  dashaLadder: DashaProgressItem[];
  upcomingShift: {
    type: 'Antardasha' | 'Pratyantardasha' | 'Profection' | 'Progressed Moon';
    fromLord: string;
    toLord: string;
    transitionDate: string;
  } | null;
  transitsDate: string | null;
  slowPlanetShifts: TransitAlignmentItem[];
  convergenceWindows: ConvergenceWindow[];
  dailyBrief: {
    date: string;
    headline: string;
    guidance: string;
    focusAction: string;
  };
  monthlyBrief: {
    month: string;
    headline: string;
    guidance: string;
    themeWatch: string;
  };
  transitsAvailable: boolean;
}

interface ProfileOption {
  id: string;
  name: string;
  short_name?: string | null;
  is_default?: boolean;
  birth_date?: string;
  birth_city?: string;
}

const DASHA_LEVEL_HINTS: Record<DashaProgressItem['level'], string> = {
  Mahadasha: 'Major life chapter',
  Antardasha: 'Current sub-chapter',
  Pratyantardasha: 'Short-term focus',
  'Annual Profection': 'This year’s focus',
  'Progressed Moon': 'Emotional chapter',
  'Solar Return': 'Year ahead focus',
};

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatFriendlyDate(raw: string): string {
  if (!raw) return '';
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw;
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  const monthLabel = MONTH_NAMES[monthIdx] || match[2];
  return `${day} ${monthLabel} ${year}`;
}

function formatTimeLeft(daysRemaining: number): string {
  if (!Number.isFinite(daysRemaining) || daysRemaining <= 0) return 'Ending soon';
  if (daysRemaining >= 365) {
    const years = Math.floor(daysRemaining / 365);
    const months = Math.round((daysRemaining % 365) / 30);
    return months > 0 ? `${years}y ${months}m left` : `${years}y left`;
  }
  if (daysRemaining >= 60) {
    const months = Math.round(daysRemaining / 30);
    return `${months}m left`;
  }
  return `${daysRemaining}d left`;
}

function humanizeWindowLabel(label: string): string {
  return label
    .replace(/^Immediate Horizon\s*\(Next 30 Days\)$/i, 'Next 30 Days')
    .replace(/^Quarterly Timing Pivot\s*\(30[–-]90 Days\)$/i, 'Next 1–3 Months')
    .replace(/^Medium-Term Trajectory\s*\(90[–-]180 Days\)$/i, 'Next 3–6 Months')
    .replace(/^Sub-Period Shift:\s*/i, 'Coming Cycle: ')
    .replace(/^Profection Transition$/i, 'Yearly Shift')
    .replace(/^Progressed Moon Transition$/i, 'Emotional Shift');
}

function humanizeIntensity(intensity: ConvergenceWindow['intensity']): {
  label: string;
  barColor: string;
  badgeColor: string;
  fillPercent: number;
} {
  if (intensity === 'Peak Alignment') {
    return {
      label: 'Strong Momentum',
      barColor: '#2D6A4F',
      badgeColor: 'text-[#2D6A4F] bg-[#2D6A4F]/10 border-[#2D6A4F]/25',
      fillPercent: 86,
    };
  }
  if (intensity === 'Steady Consolidation') {
    return {
      label: 'Steady Growth',
      barColor: '#B8965A',
      badgeColor: 'text-[#8B7355] bg-[#B8965A]/15 border-[#B8965A]/30',
      fillPercent: 62,
    };
  }
  return {
    label: 'Quiet Reset',
    barColor: '#7A6F61',
    badgeColor: 'text-[#5C5449] bg-[#3D3830]/8 border-[#3D3830]/15',
    fillPercent: 40,
  };
}

function humanizeFocusDomain(focus: string): string {
  return focus
    .replace(/Dasha \+ Slow Gochar Convergence/i, 'Life Cycle & Moving Planets')
    .replace(/Pratyantardasha Transition/i, 'Short-Cycle Change')
    .replace(/Antardasha Transition/i, 'Sub-Chapter Change')
    .replace(/Profection Transition/i, 'Annual Cycle Change');
}

function humanizeWindowRange(range: string): { text: string; progressPercent: number | null } {
  const arrowMatch = range.match(/^(\d{4}-\d{2}-\d{2})\s*[→-]+\s*(\d{4}-\d{2}-\d{2})$/);
  if (arrowMatch) {
    const startMs = new Date(`${arrowMatch[1]}T00:00:00Z`).getTime();
    const endMs = new Date(`${arrowMatch[2]}T00:00:00Z`).getTime();
    const nowMs = Date.now();
    let progressPercent: number | null = null;
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      if (nowMs <= startMs) {
        progressPercent = 12;
      } else if (nowMs >= endMs) {
        progressPercent = 100;
      } else {
        progressPercent = Math.max(8, Math.round(((nowMs - startMs) / (endMs - startMs)) * 100));
      }
    }
    return {
      text: `${formatFriendlyDate(arrowMatch[1])} – ${formatFriendlyDate(arrowMatch[2])}`,
      progressPercent,
    };
  }

  const transitionMatch = range.match(/^Transitions\s+(\d{4}-\d{2}-\d{2})$/i);
  if (transitionMatch) {
    return {
      text: `Starts ${formatFriendlyDate(transitionMatch[1])}`,
      progressPercent: null,
    };
  }

  return { text: range, progressPercent: null };
}

function humanizePlanetNote(note: string): string {
  return note
    .replace(/(\d+)\s+SAV bindus/gi, 'Strength $1/40')
    .replace(/\bLagna\b/g, 'Ascendant');
}

interface CyclePieProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

const CyclePieChart: React.FC<CyclePieProps> = ({
  percent,
  size = 54,
  strokeWidth = 5,
  color = '#B8965A',
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-label={`${clamped}% completed`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="rgba(61, 56, 48, 0.03)"
          stroke="rgba(61, 56, 48, 0.12)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-[11px] font-['DM_Sans',sans-serif] font-medium tabular-nums text-[#3D3830]">
        {clamped}%
      </span>
    </div>
  );
};

interface SkyBalancePieProps {
  supportive: number;
  neutral: number;
  intense: number;
}

const SkyBalancePie: React.FC<SkyBalancePieProps> = ({ supportive, neutral, intense }) => {
  const total = supportive + neutral + intense;
  if (total === 0) return null;
  const size = 48;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { count: supportive, color: '#2D6A4F' },
    { count: neutral, color: '#B8965A' },
    { count: intense, color: '#A94438' },
  ].filter((s) => s.count > 0);

  let cumulativeOffset = 0;

  return (
    <div className="flex items-center gap-3">
      <div className="relative inline-flex items-center justify-center shrink-0">
        <svg width={size} height={size} className="-rotate-90">
          {segments.map((seg, i) => {
            const fraction = seg.count / total;
            const dash = fraction * circumference;
            const offset = -cumulativeOffset;
            cumulativeOffset += dash;
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </svg>
        <span className="absolute text-[11px] font-['DM_Sans',sans-serif] font-medium tabular-nums text-[#3D3830]">
          {total}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#5C5449]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#2D6A4F]" />
          {supportive} Supportive
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#B8965A]" />
          {neutral} Steady
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#A94438]" />
          {intense} Take Care
        </span>
      </div>
    </div>
  );
};

const TimingRadarDashboard: React.FC = () => {
  const { isPreviewMode, getAccessToken, astrologyMode } = useAuth();
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [radar, setRadar] = useState<TimingRadarSnapshot | null>(null);
  const [hasActivated, setHasActivated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [briefView, setBriefView] = useState<'daily' | 'monthly'>('daily');

  const fetchRadar = useCallback(
    async (profileId?: string) => {
      if (isPreviewMode) {
        const previewSnap =
          astrologyMode === 'western' ? PREVIEW_WESTERN_RADAR_SNAPSHOT : PREVIEW_RADAR_SNAPSHOT;
        setHasActivated(true);
        setProfiles([
          {
            id: previewSnap.profileId,
            name: previewSnap.profileName,
            short_name: 'Aarav',
            is_default: true,
          },
        ]);
        setRadar(previewSnap);
        setSelectedProfileId(previewSnap.profileId);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const token = await getAccessToken();
        if (!token) {
          setIsLoading(false);
          return;
        }
        const params = new URLSearchParams();
        params.set('mode', astrologyMode);
        if (profileId) params.set('profileId', profileId);
        const res = await fetch(`/api/radar?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setHasActivated(Boolean(data.hasActivatedProfile));
          setProfiles(data.profiles || []);
          setRadar(data.radar || null);
          if (data.radar?.profileId) {
            setSelectedProfileId(data.radar.profileId);
          }
        }
      } catch {
        // Silent fail; UI shows fallback prompt to activate a profile
      } finally {
        setIsLoading(false);
      }
    },
    [astrologyMode, getAccessToken, isPreviewMode]
  );

  useEffect(() => {
    void fetchRadar();
  }, [fetchRadar]);

  const isWesternView = (radar?.mode || astrologyMode) === 'western';

  if (isLoading) {
    return (
      <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-7 md:p-9 text-[#3D3830]">
        <p className="text-xs text-[#8B8275]">Planetary Overview</p>
        <p className="mt-2 font-serif text-2xl font-medium text-[#3D3830]">
          Loading your current life cycles and sky positions...
        </p>
      </section>
    );
  }

  if (!hasActivated || !radar) {
    return (
      <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-7 md:p-9 text-[#3D3830]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2 text-xs text-[#8B8275]">
              <Compass className="h-4 w-4 text-[#8B7355]" />
              <span>Planetary Overview</span>
            </div>
            <h2 className="font-serif text-2xl md:text-3xl font-medium text-[#3D3830]">
              Add Birth Details to See Your Planetary Timing
            </h2>
            <p className="text-sm text-[#5C5449] leading-relaxed">
              Once you save a birth chart, you can track your active life chapters, see how much time is left in each period, and follow where slow planets are moving right now.
            </p>
          </div>
          <Link
            to="/app/profiles"
            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-[#4A453D] px-6 py-3 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors whitespace-nowrap shrink-0"
          >
            <span>Add Birth Details</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    );
  }

  const maha = radar.dashaLadder.find((d) => d.level === 'Mahadasha')?.lord;
  const antar = radar.dashaLadder.find((d) => d.level === 'Antardasha')?.lord;
  const profection = radar.dashaLadder.find((d) => d.level === 'Annual Profection')?.lord;
  const progMoon = radar.dashaLadder.find((d) => d.level === 'Progressed Moon')?.lord;
  const phaseSummary = isWesternView
    ? [profection, progMoon].filter(Boolean).join(' + ')
    : [maha, antar].filter(Boolean).join('–');
  const seededChatPrompt = isWesternView
    ? phaseSummary
      ? `What do my current ${phaseSummary} cycles point toward for my priorities right now?`
      : `How should I navigate my current Tropical timing cycle and outer transits?`
    : phaseSummary
    ? `What does my current ${phaseSummary} phase mean for my priorities right now?`
    : `How should I navigate my current planetary timing phase?`;
  const chatParams = new URLSearchParams();
  if (radar.profileId) chatParams.set('profileId', radar.profileId);
  if (isWesternView) {
    chatParams.set('system', 'western');
    chatParams.set('expert', 'western_astrologer');
  }
  chatParams.set('prompt', seededChatPrompt);
  if (isPreviewMode) chatParams.set('preview', '1');
  const discussPhaseUrl = `/app/chat?${chatParams.toString()}`;

  const supportiveCount = radar.slowPlanetShifts.filter((t) => t.signal === 'supportive').length;
  const neutralCount = radar.slowPlanetShifts.filter((t) => t.signal === 'neutral').length;
  const intenseCount = radar.slowPlanetShifts.filter((t) => t.signal === 'intense').length;

  return (
    <section className="space-y-5">
      <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-6 sm:p-7 md:p-9 text-[#3D3830] space-y-7">
        {/* Header & Profile Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#3D3830]/10 pb-5">
          <div>
            <p className="text-xs text-[#8B8275] mb-1">
              {radar.ascendantSign} {isWesternView ? 'Rising' : 'Lagna'} · {radar.moonSign} Moon
              {radar.transitsDate ? ` · ${formatFriendlyDate(radar.transitsDate)}` : ''}
            </p>
            <h2 className="font-serif text-2xl md:text-3xl font-medium text-[#3D3830]">
              Quick overview for {radar.profileName}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 min-w-0">
            {profiles.length > 0 && (
              <div
                role="tablist"
                aria-label="Switch birth profile"
                className="inline-flex items-center gap-1 rounded-full bg-[#F1ECE3] border border-[#3D3830]/12 p-1 overflow-x-auto no-scrollbar max-w-full"
              >
                {profiles.map((p) => {
                  const isActive = p.id === selectedProfileId;
                  const label = p.is_default ? 'You' : p.short_name?.trim() || p.name;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => {
                        if (!isActive) void fetchRadar(p.id);
                      }}
                      className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs transition-colors ${
                        isActive
                          ? 'bg-[#4A453D] text-[#FAF7F2] font-medium'
                          : 'text-[#5C5449] hover:text-[#3D3830] hover:bg-[#EAE3D7]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            <Link
              to={discussPhaseUrl}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#F1ECE3] border border-[#3D3830]/12 px-4 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7] transition-colors shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#8B7355]" />
              <span>Ask astrologer about this phase →</span>
            </Link>
          </div>
        </div>

        {/* Row 1: Graphical Life Chapters (Pie Charts + Progress Bars) & Observatory Brief */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
          <div className="lg:col-span-6 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="text-xs font-medium text-[#3D3830]/85 uppercase tracking-wider">
                  {isWesternView ? 'Current Timing Cycles' : 'Current Life Chapters (Dasha)'}
                </h3>
                <p className="text-[11px] text-[#8B8275] mt-0.5">
                  When each period started, how far along you are, and time left
                </p>
              </div>
              {radar.upcomingShift && (
                <span className="text-[11px] font-['DM_Sans',sans-serif] tabular-nums text-[#8B7355]">
                  Next change: {radar.upcomingShift.toLord} ({formatFriendlyDate(radar.upcomingShift.transitionDate)})
                </span>
              )}
            </div>

            <div className="space-y-3">
              {radar.dashaLadder.map((item, idx) => {
                const ringColor =
                  idx === 0 ? '#B8965A' : idx === 1 ? '#8B7355' : '#2D6A4F';
                return (
                  <div
                    key={item.level}
                    className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 p-4 flex items-center gap-4"
                  >
                    <CyclePieChart percent={item.percentElapsed} color={ringColor} />

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-medium text-[#3D3830] text-sm">
                              {item.lord}
                            </span>
                            <span className="text-[#8B8275] text-xs">
                              {item.level}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#8B8275]">
                            {DASHA_LEVEL_HINTS[item.level]}
                          </p>
                        </div>

                        <span className="font-['DM_Sans',sans-serif] tabular-nums text-xs font-medium text-[#8B7355] shrink-0">
                          {formatTimeLeft(item.daysRemaining)}
                        </span>
                      </div>

                      <div className="h-1.5 w-full rounded-full bg-[#3D3830]/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(4, Math.min(100, item.percentElapsed))}%`,
                            backgroundColor: ringColor,
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-['DM_Sans',sans-serif] tabular-nums text-[#8B8275]">
                        <span>Started {formatFriendlyDate(item.startDate)}</span>
                        <span>Ends {formatFriendlyDate(item.endDate)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cached Daily & Monthly Brief */}
          <div className="lg:col-span-6 flex flex-col justify-between rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 p-5 md:p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-[#5C5449]">
                  <CalendarClock className="h-4 w-4 text-[#8B7355]" />
                  <span>Daily & Monthly Guidance</span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setBriefView('daily')}
                    className={`pb-0.5 border-b transition-colors ${
                      briefView === 'daily'
                        ? 'text-[#3D3830] border-[#8B7355] font-medium'
                        : 'text-[#8B8275] border-transparent hover:text-[#3D3830]'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setBriefView('monthly')}
                    className={`pb-0.5 border-b transition-colors ${
                      briefView === 'monthly'
                        ? 'text-[#3D3830] border-[#8B7355] font-medium'
                        : 'text-[#8B8275] border-transparent hover:text-[#3D3830]'
                    }`}
                  >
                    Monthly Forecast
                  </button>
                </div>
              </div>

              {briefView === 'daily' ? (
                <div className="space-y-3">
                  <p className="text-[11px] font-['DM_Sans',sans-serif] text-[#8B8275]">
                    {formatFriendlyDate(radar.dailyBrief.date)}
                  </p>
                  <h4 className="font-serif text-2xl font-medium text-[#3D3830]">
                    {radar.dailyBrief.headline}
                  </h4>
                  <p className="text-sm text-[#5C5449] leading-relaxed">
                    {radar.dailyBrief.guidance}
                  </p>
                  <div className="pt-3 border-t border-[#3D3830]/10 text-xs text-[#8B7355]">
                    Focus: <span className="text-[#3D3830]">{radar.dailyBrief.focusAction}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[11px] font-['DM_Sans',sans-serif] text-[#8B8275]">
                    {radar.monthlyBrief.month}
                  </p>
                  <h4 className="font-serif text-2xl font-medium text-[#3D3830]">
                    {radar.monthlyBrief.headline}
                  </h4>
                  <p className="text-sm text-[#5C5449] leading-relaxed">
                    {radar.monthlyBrief.guidance}
                  </p>
                  <div className="pt-3 border-t border-[#3D3830]/10 text-xs text-[#8B7355]">
                    Watch: <span className="text-[#3D3830]">{radar.monthlyBrief.themeWatch}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Upcoming Highlights (Plain English + Progress Visuals) */}
        <div className="space-y-3 pt-2 border-t border-[#3D3830]/10">
          <div>
            <h3 className="text-xs font-medium text-[#3D3830]/85 uppercase tracking-wider">
              Upcoming Highlights
            </h3>
            <p className="text-[11px] text-[#8B8275] mt-0.5">
              Key dates ahead when your life chapters and moving planets line up
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {radar.convergenceWindows.map((win, idx) => {
              const mood = humanizeIntensity(win.intensity);
              const parsedRange = humanizeWindowRange(win.windowRange);
              const barWidth = parsedRange.progressPercent ?? mood.fillPercent;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-['DM_Sans',sans-serif] tabular-nums text-[#8B7355]">
                        {parsedRange.text}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0 ${mood.badgeColor}`}
                      >
                        {mood.label}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[#3D3830]">
                      {humanizeWindowLabel(win.label)}
                    </p>
                    <p className="text-[11px] text-[#8B8275]">
                      {humanizeFocusDomain(win.focusDomain)}
                    </p>
                    <p className="text-xs text-[#5C5449] leading-relaxed pt-1">
                      {humanizePlanetNote(win.drivers)}
                    </p>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="h-1.5 w-full rounded-full bg-[#3D3830]/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: mood.barColor,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 3: Where Moving Planets Are Now (Pie Chart + 12-House Bars) */}
        {radar.slowPlanetShifts.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-[#3D3830]/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-medium text-[#3D3830]/85 uppercase tracking-wider">
                  Where Slow Planets Are Now
                </h3>
                <p className="text-[11px] text-[#8B8275] mt-0.5">
                  Which of the 12 areas of your chart each planet is moving through
                </p>
              </div>
              <SkyBalancePie
                supportive={supportiveCount}
                neutral={neutralCount}
                intense={intenseCount}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {radar.slowPlanetShifts.map((t) => {
                const sigColor =
                  t.signal === 'supportive'
                    ? '#2D6A4F'
                    : t.signal === 'intense'
                    ? '#A94438'
                    : '#8B7355';
                const sigLabel =
                  t.signal === 'supportive'
                    ? 'Supportive'
                    : t.signal === 'intense'
                    ? 'Take Care'
                    : 'Steady';
                const strengthPct =
                  t.savBindus > 0 ? Math.min(100, Math.round((t.savBindus / 40) * 100)) : 0;

                return (
                  <div
                    key={t.planet}
                    className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 p-4 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: sigColor }}
                        />
                        <span className="font-medium text-[#3D3830] truncate">
                          {t.planet}
                          {t.isRetrograde ? ' (Retrograde)' : ''}
                        </span>
                      </div>
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F1ECE3] border border-[#3D3830]/10 shrink-0"
                        style={{ color: sigColor }}
                      >
                        {sigLabel}
                      </span>
                    </div>

                    {/* 12-House Position Strip */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-['DM_Sans',sans-serif] tabular-nums text-[#5C5449]">
                        <span>{t.sign}</span>
                        <span>House {t.houseFromLagna} of 12</span>
                      </div>
                      <div
                        className="grid grid-cols-12 gap-0.5"
                        aria-label={`House ${t.houseFromLagna} of 12`}
                      >
                        {Array.from({ length: 12 }, (_, idx) => {
                          const houseNum = idx + 1;
                          const isActive = houseNum === t.houseFromLagna;
                          return (
                            <span
                              key={houseNum}
                              className="h-1.5 rounded-sm transition-colors"
                              style={{
                                backgroundColor: isActive
                                  ? sigColor
                                  : 'rgba(61, 56, 48, 0.10)',
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {t.savBindus > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-[#8B8275]">
                          <span>House strength</span>
                          <span className="font-['DM_Sans',sans-serif] tabular-nums">
                            {t.savBindus}/40
                          </span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-[#3D3830]/10 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${strengthPct}%`,
                              backgroundColor: sigColor,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] text-[#5C5449] leading-relaxed">
                      {humanizePlanetNote(t.note)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default TimingRadarDashboard;
