import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, CalendarClock, Sparkles } from 'lucide-react';
import { useAuth } from './AuthContext';
import { PREVIEW_RADAR_SNAPSHOT } from './previewFixtures';

interface DashaProgressItem {
  level: 'Mahadasha' | 'Antardasha' | 'Pratyantardasha';
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
  profileId: string;
  profileName: string;
  ascendantSign: string;
  moonSign: string;
  dashaLadder: DashaProgressItem[];
  upcomingShift: {
    type: 'Antardasha' | 'Pratyantardasha';
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

const TimingRadarDashboard: React.FC = () => {
  const { isPreviewMode, getAccessToken } = useAuth();
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [radar, setRadar] = useState<TimingRadarSnapshot | null>(null);
  const [hasActivated, setHasActivated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [briefView, setBriefView] = useState<'daily' | 'monthly'>('daily');

  const fetchRadar = useCallback(
    async (profileId?: string) => {
      if (isPreviewMode) {
        setHasActivated(true);
        setProfiles([
          {
            id: PREVIEW_RADAR_SNAPSHOT.profileId,
            name: PREVIEW_RADAR_SNAPSHOT.profileName,
            short_name: 'Aarav',
            is_default: true,
          },
        ]);
        setRadar(PREVIEW_RADAR_SNAPSHOT);
        setSelectedProfileId(PREVIEW_RADAR_SNAPSHOT.profileId);
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
        const query = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
        const res = await fetch(`/api/radar${query}`, {
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
    [getAccessToken, isPreviewMode]
  );

  useEffect(() => {
    void fetchRadar();
  }, [fetchRadar]);

  if (isLoading) {
    return (
      <section className="rounded-3xl bg-gradient-to-br from-[#1F2229] to-[#292D36] p-7 md:p-9 text-[#F4EFE6]">
        <p className="text-xs text-[#F4EFE6]/60">Observatory Timing Radar</p>
        <p className="mt-2 font-serif text-2xl font-medium">
          Aligning Dasha progression & Gochar transits...
        </p>
      </section>
    );
  }

  if (!hasActivated || !radar) {
    return (
      <section className="rounded-3xl bg-gradient-to-br from-[#1F2229] to-[#292D36] p-7 md:p-9 text-[#F4EFE6] shadow-[0_24px_60px_-24px_rgba(31,34,41,0.45)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2 text-xs text-[#F4EFE6]/65">
              <Compass className="h-4 w-4 text-[#B8965A]" />
              <span>Personal Timing Radar</span>
            </div>
            <h2 className="font-serif text-2xl md:text-3xl font-medium text-[#F4EFE6]">
              Activate a Birth Chart to Unlock Live Planetary Timing
            </h2>
            <p className="text-sm text-[#F4EFE6]/70 leading-relaxed">
              Once a profile chart is activated, this observatory radar tracks your active Mahadasha, Antardasha, and Pratyantardasha progress bars alongside live Gochar transits and daily briefs.
            </p>
          </div>
          <Link
            to="/app/profiles"
            className="inline-flex items-center gap-2 rounded-full bg-[#F4EFE6] px-6 py-3 text-xs font-medium text-[#1F2229] hover:bg-[#EAE3D7] transition-colors whitespace-nowrap shrink-0"
          >
            <span>Open Birth Profiles</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      {/* Observatory Night Radar Container */}
      <div className="rounded-3xl bg-gradient-to-br from-[#1F2229] to-[#292D36] p-7 md:p-9 text-[#F4EFE6] shadow-[0_24px_60px_-24px_rgba(31,34,41,0.45)] space-y-7">
        {/* Header & Profile Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#F4EFE6]/10 pb-5">
          <div>
            <p className="text-xs text-[#F4EFE6]/60 mb-1">
              Timing Radar · {radar.ascendantSign} Lagna · {radar.moonSign} Moon
              {radar.transitsDate ? ` · Gochar ${radar.transitsDate}` : ''}
            </p>
            <h2 className="font-serif text-2xl md:text-3xl font-medium text-[#F4EFE6]">
              Planetary Rhythm for {radar.profileName}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 min-w-0">
            {profiles.length > 0 && (
              <div
                role="tablist"
                aria-label="Switch birth profile for Timing Radar"
                className="inline-flex items-center gap-1 rounded-full bg-[#F4EFE6]/8 border border-[#F4EFE6]/12 p-1 overflow-x-auto no-scrollbar max-w-full"
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
                          ? 'bg-[#F4EFE6] text-[#1F2229] font-medium'
                          : 'text-[#F4EFE6]/70 hover:text-[#F4EFE6] hover:bg-[#F4EFE6]/10'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            <Link
              to="/app/chat"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#F4EFE6]/12 border border-[#F4EFE6]/15 px-4 py-2 text-xs font-medium text-[#F4EFE6] hover:bg-[#F4EFE6]/20 transition-colors shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#B8965A]" />
              <span>Discuss Timing in Chat</span>
            </Link>
          </div>
        </div>

        {/* Row 1: Active Vimshottari Dasha Progress Ladder + Daily/Monthly Cached Brief */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
          {/* Active Dasha Progress Bars */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-[#F4EFE6]/75 uppercase tracking-wider">
                Vimshottari Dasha Progression
              </h3>
              {radar.upcomingShift && (
                <span className="text-[11px] font-['JetBrains_Mono',monospace] tabular-nums text-[#B8965A]">
                  Next {radar.upcomingShift.type.slice(0, 2)}: {radar.upcomingShift.toLord} ({radar.upcomingShift.transitionDate})
                </span>
              )}
            </div>

            <div className="space-y-4">
              {radar.dashaLadder.map((item) => (
                <div
                  key={item.level}
                  className="rounded-2xl bg-[#F4EFE6]/5 border border-[#F4EFE6]/10 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[#F4EFE6]/60 mr-2">{item.level}</span>
                      <span className="font-medium text-[#F4EFE6]">{item.lord}</span>
                    </div>
                    <span className="font-['JetBrains_Mono',monospace] tabular-nums text-[#F4EFE6]/80">
                      {item.daysRemaining.toLocaleString()}d left · {item.percentElapsed}%
                    </span>
                  </div>

                  <div className="h-1.5 w-full rounded-full bg-[#F4EFE6]/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#B8965A] transition-all"
                      style={{ width: `${Math.max(3, Math.min(100, item.percentElapsed))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-['JetBrains_Mono',monospace] tabular-nums text-[#F4EFE6]/50">
                    <span>{item.startDate}</span>
                    <span>{item.endDate}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cached Daily & Monthly Observatory Brief */}
          <div className="lg:col-span-6 flex flex-col justify-between rounded-2xl bg-[#F4EFE6]/5 border border-[#F4EFE6]/10 p-5 md:p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-[#F4EFE6]/75">
                  <CalendarClock className="h-4 w-4 text-[#B8965A]" />
                  <span>Observatory Brief</span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setBriefView('daily')}
                    className={`pb-0.5 border-b transition-colors ${
                      briefView === 'daily'
                        ? 'text-[#F4EFE6] border-[#B8965A] font-medium'
                        : 'text-[#F4EFE6]/55 border-transparent hover:text-[#F4EFE6]'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setBriefView('monthly')}
                    className={`pb-0.5 border-b transition-colors ${
                      briefView === 'monthly'
                        ? 'text-[#F4EFE6] border-[#B8965A] font-medium'
                        : 'text-[#F4EFE6]/55 border-transparent hover:text-[#F4EFE6]'
                    }`}
                  >
                    Monthly Horizon
                  </button>
                </div>
              </div>

              {briefView === 'daily' ? (
                <div className="space-y-3">
                  <p className="text-[11px] font-['JetBrains_Mono',monospace] text-[#F4EFE6]/50">
                    {radar.dailyBrief.date}
                  </p>
                  <h4 className="font-serif text-2xl font-medium text-[#F4EFE6]">
                    {radar.dailyBrief.headline}
                  </h4>
                  <p className="text-sm text-[#F4EFE6]/80 leading-relaxed">
                    {radar.dailyBrief.guidance}
                  </p>
                  <div className="pt-3 border-t border-[#F4EFE6]/10 text-xs text-[#B8965A]">
                    Focus: <span className="text-[#F4EFE6]/90">{radar.dailyBrief.focusAction}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[11px] font-['JetBrains_Mono',monospace] text-[#F4EFE6]/50">
                    {radar.monthlyBrief.month}
                  </p>
                  <h4 className="font-serif text-2xl font-medium text-[#F4EFE6]">
                    {radar.monthlyBrief.headline}
                  </h4>
                  <p className="text-sm text-[#F4EFE6]/80 leading-relaxed">
                    {radar.monthlyBrief.guidance}
                  </p>
                  <div className="pt-3 border-t border-[#F4EFE6]/10 text-xs text-[#B8965A]">
                    Watch: <span className="text-[#F4EFE6]/90">{radar.monthlyBrief.themeWatch}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Convergence Timing Windows */}
        <div className="space-y-3 pt-2 border-t border-[#F4EFE6]/10">
          <h3 className="text-xs font-medium text-[#F4EFE6]/75 uppercase tracking-wider">
            Dasha & Gochar Convergence Windows
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {radar.convergenceWindows.map((win, idx) => (
              <div
                key={idx}
                className="rounded-2xl bg-[#F4EFE6]/5 border border-[#F4EFE6]/10 p-4 space-y-1.5"
              >
                <p className="text-[11px] font-['JetBrains_Mono',monospace] text-[#B8965A]">
                  {win.windowRange}
                </p>
                <p className="text-sm font-medium text-[#F4EFE6]">{win.label}</p>
                <p className="text-xs text-[#F4EFE6]/60">
                  {win.focusDomain} · {win.intensity}
                </p>
                <p className="text-xs text-[#F4EFE6]/80 leading-relaxed pt-1">
                  {win.drivers}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Row 3: Live Slow-Planet Gochar Relative to Natal Lagna & Moon */}
        {radar.slowPlanetShifts.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-[#F4EFE6]/10">
            <h3 className="text-xs font-medium text-[#F4EFE6]/75 uppercase tracking-wider">
              Live Gochar Alignment Over Natal Houses
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {radar.slowPlanetShifts.map((t) => (
                <div
                  key={t.planet}
                  className="rounded-2xl bg-[#1F2229]/70 border border-[#F4EFE6]/10 px-4 py-3 space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#F4EFE6]">
                      {t.planet}
                      {t.isRetrograde ? ' (R)' : ''}
                    </span>
                    <span className="font-['JetBrains_Mono',monospace] tabular-nums text-[11px] text-[#F4EFE6]/75">
                      {t.sign} · H{t.houseFromLagna} Lagna
                    </span>
                  </div>
                  <p className="text-[11px] text-[#F4EFE6]/65">{t.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default TimingRadarDashboard;
