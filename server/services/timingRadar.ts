import { enrichCompiledChart, type CompiledChartData } from './chartCompiler';
import { getOrFetchDailyTransits, isAstrologyApiConfigured } from './astrologyApi';
import {
  computeDeterministicSiderealPlanets,
  computeWesternDailyTransits,
  computeWesternTimingSnapshot,
  SIGNS,
  WESTERN_TRADITIONAL_RULERS,
  type DashaNode,
  type PlanetPosition,
  type WesternPlanetPosition,
} from './jyotishMath';
import {
  createOpenRouterCompletion,
  getUtilityModel,
  isOpenRouterConfigured,
  safeExtractJson,
} from './openrouter';

export interface DashaProgressItem {
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

export interface TransitAlignmentItem {
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

export interface ConvergenceWindow {
  label: string;
  windowRange: string;
  focusDomain: string;
  intensity: 'Peak Alignment' | 'Steady Consolidation' | 'Reflective Calibration';
  drivers: string;
}

export interface TimingRadarSnapshot {
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

const dailyBriefCache = new Map<
  string,
  { headline: string; guidance: string; focusAction: string }
>();
const monthlyBriefCache = new Map<
  string,
  { headline: string; guidance: string; themeWatch: string }
>();

function computeDateProgress(startISO: string, endISO: string, nowMs: number): {
  percentElapsed: number;
  daysRemaining: number;
} {
  const startMs = new Date(`${startISO}T00:00:00Z`).getTime();
  const endMs = new Date(`${endISO}T23:59:59Z`).getTime();
  const total = Math.max(1, endMs - startMs);
  const elapsed = Math.max(0, Math.min(total, nowMs - startMs));
  const percentElapsed = Math.round((elapsed / total) * 100);
  const daysRemaining = Math.max(0, Math.ceil((endMs - nowMs) / (86400 * 1000)));
  return { percentElapsed, daysRemaining };
}

function findActiveDashaNodes(
  timeline: DashaNode[],
  todayISO: string
): {
  ladder: DashaProgressItem[];
  upcomingShift: TimingRadarSnapshot['upcomingShift'];
} {
  const nowMs = Date.now();
  const ladder: DashaProgressItem[] = [];
  let upcomingShift: TimingRadarSnapshot['upcomingShift'] = null;

  const activeMd =
    timeline.find((md) => md.startDate <= todayISO && todayISO <= md.endDate) ||
    timeline[0];

  if (!activeMd) return { ladder, upcomingShift };

  const mdProg = computeDateProgress(activeMd.startDate, activeMd.endDate, nowMs);
  ladder.push({
    level: 'Mahadasha',
    lord: activeMd.lord,
    startDate: activeMd.startDate,
    endDate: activeMd.endDate,
    ...mdProg,
  });

  const ads = activeMd.children || [];
  const activeAdIdx = ads.findIndex((ad) => ad.startDate <= todayISO && todayISO <= ad.endDate);
  const activeAd = activeAdIdx >= 0 ? ads[activeAdIdx] : ads[0];

  if (activeAd) {
    const adProg = computeDateProgress(activeAd.startDate, activeAd.endDate, nowMs);
    ladder.push({
      level: 'Antardasha',
      lord: activeAd.lord,
      startDate: activeAd.startDate,
      endDate: activeAd.endDate,
      ...adProg,
    });

    if (activeAdIdx >= 0 && activeAdIdx + 1 < ads.length) {
      const nextAd = ads[activeAdIdx + 1];
      upcomingShift = {
        type: 'Antardasha',
        fromLord: activeAd.lord,
        toLord: nextAd.lord,
        transitionDate: nextAd.startDate,
      };
    }

    const pds = activeAd.children || [];
    const activePdIdx = pds.findIndex((pd) => pd.startDate <= todayISO && todayISO <= pd.endDate);
    const activePd = activePdIdx >= 0 ? pds[activePdIdx] : pds[0];
    if (activePd) {
      const pdProg = computeDateProgress(activePd.startDate, activePd.endDate, nowMs);
      ladder.push({
        level: 'Pratyantardasha',
        lord: activePd.lord,
        startDate: activePd.startDate,
        endDate: activePd.endDate,
        ...pdProg,
      });

      if (activePdIdx >= 0 && activePdIdx + 1 < pds.length) {
        const nextPd = pds[activePdIdx + 1];
        upcomingShift = {
          type: 'Pratyantardasha',
          fromLord: activePd.lord,
          toLord: nextPd.lord,
          transitionDate: nextPd.startDate,
        };
      }
    }
  }

  return { ladder, upcomingShift };
}

function classifyTransitSignal(
  planet: string,
  houseFromMoon: number,
  savBindus: number
): { signal: 'supportive' | 'neutral' | 'intense'; note: string } {
  if (planet === 'Jupiter') {
    if ([2, 5, 7, 9, 11].includes(houseFromMoon)) {
      return {
        signal: 'supportive',
        note: `Guru Bala active (${houseFromMoon}th from natal Moon) · ${savBindus} SAV bindus`,
      };
    }
    return {
      signal: savBindus >= 28 ? 'supportive' : 'neutral',
      note: `Transiting ${houseFromMoon}th from Moon · ${savBindus} SAV bindus`,
    };
  }

  if (planet === 'Saturn') {
    if ([12, 1, 2].includes(houseFromMoon)) {
      return {
        signal: 'intense',
        note: `Sade Sati phase (${houseFromMoon}th from Moon) · Structural discipline`,
      };
    }
    if (houseFromMoon === 8) {
      return {
        signal: 'intense',
        note: `Ashtama Shani (8th from Moon) · Steady patience advised`,
      };
    }
    if ([3, 6, 11].includes(houseFromMoon)) {
      return {
        signal: 'supportive',
        note: `Upachaya Saturn (${houseFromMoon}th from Moon) · Durable gains`,
      };
    }
    return {
      signal: 'neutral',
      note: `Transiting ${houseFromMoon}th from Moon · ${savBindus} SAV bindus`,
    };
  }

  if (planet === 'Rahu' || planet === 'Ketu') {
    if ([3, 6, 10, 11].includes(houseFromMoon)) {
      return {
        signal: 'supportive',
        note: `Karmic momentum in ${houseFromMoon}th from Moon`,
      };
    }
    return {
      signal: 'neutral',
      note: `Axis activation in ${houseFromMoon}th from Moon · ${savBindus} SAV bindus`,
    };
  }

  return {
    signal: savBindus >= 30 ? 'supportive' : 'neutral',
    note: `Transiting ${houseFromMoon}th from Moon · ${savBindus} SAV bindus`,
  };
}

function buildConvergenceWindows(
  ladder: DashaProgressItem[],
  shifts: TransitAlignmentItem[],
  upcomingShift: TimingRadarSnapshot['upcomingShift']
): ConvergenceWindow[] {
  const md = ladder[0];
  const ad = ladder[1];
  const jupiter = shifts.find((s) => s.planet === 'Jupiter');
  const saturn = shifts.find((s) => s.planet === 'Saturn');

  const today = new Date();
  const plus30 = new Date(today.getTime() + 30 * 86400 * 1000).toISOString().slice(0, 10);
  const plus90 = new Date(today.getTime() + 90 * 86400 * 1000).toISOString().slice(0, 10);
  const plus180 = new Date(today.getTime() + 180 * 86400 * 1000).toISOString().slice(0, 10);

  return [
    {
      label: 'Immediate Horizon (Next 30 Days)',
      windowRange: `${today.toISOString().slice(0, 10)} → ${plus30}`,
      focusDomain: ad ? `${md?.lord}-${ad.lord} Active Cycle` : 'Active Dasha Window',
      intensity:
        jupiter?.signal === 'supportive' ? 'Peak Alignment' : 'Steady Consolidation',
      drivers: jupiter
        ? `Jupiter in H${jupiter.houseFromLagna} (${jupiter.sign}) supporting ${md?.lord || 'natal'} themes.`
        : `Anchored by ${md?.lord || 'active'} Mahadasha & ${ad?.lord || 'current'} Antardasha.`,
    },
    {
      label: upcomingShift
        ? `Sub-Period Shift: ${upcomingShift.toLord}`
        : 'Quarterly Timing Pivot (30–90 Days)',
      windowRange: upcomingShift
        ? `Transitions ${upcomingShift.transitionDate}`
        : `${plus30} → ${plus90}`,
      focusDomain: `${upcomingShift?.type || 'Dasha'} Transition`,
      intensity: saturn?.signal === 'intense' ? 'Reflective Calibration' : 'Steady Consolidation',
      drivers: upcomingShift
        ? `Shifts focus from ${upcomingShift.fromLord} to ${upcomingShift.toLord} within ${md?.lord || ''} Mahadasha.`
        : `Saturn H${saturn?.houseFromLagna || '-'} consolidation with active Antardasha pacing.`,
    },
    {
      label: 'Medium-Term Trajectory (90–180 Days)',
      windowRange: `${plus90} → ${plus180}`,
      focusDomain: 'Dasha + Slow Gochar Convergence',
      intensity:
        saturn?.signal === 'supportive' || jupiter?.signal === 'supportive'
          ? 'Peak Alignment'
          : 'Steady Consolidation',
      drivers: `Combined Jupiter (${jupiter?.savBindus ?? 28} SAV) and Saturn (${saturn?.savBindus ?? 28} SAV) transit pacing.`,
    },
  ];
}

async function generateCachedBriefs(params: {
  profileId: string;
  profileName: string;
  ascendantSign: string;
  moonSign: string;
  ladder: DashaProgressItem[];
  shifts: TransitAlignmentItem[];
}): Promise<{
  dailyBrief: TimingRadarSnapshot['dailyBrief'];
  monthlyBrief: TimingRadarSnapshot['monthlyBrief'];
}> {
  const todayISO = new Date().toISOString().slice(0, 10);
  const monthISO = todayISO.slice(0, 7);
  const dailyKey = `${params.profileId}:${todayISO}`;
  const monthlyKey = `${params.profileId}:${monthISO}`;

  const md = params.ladder[0]?.lord || 'Current';
  const ad = params.ladder[1]?.lord || '';
  const pd = params.ladder[2]?.lord || '';
  const jup = params.shifts.find((s) => s.planet === 'Jupiter');
  const sat = params.shifts.find((s) => s.planet === 'Saturn');

  let daily = dailyBriefCache.get(dailyKey);
  let monthly = monthlyBriefCache.get(monthlyKey);

  if (isOpenRouterConfigured() && (!daily || !monthly)) {
    try {
      const transitSummary = params.shifts
        .map((s) => `${s.planet} in ${s.sign} (H${s.houseFromLagna} Lagna, H${s.houseFromMoon} Moon, SAV ${s.savBindus})`)
        .join('; ');

      const completion = await createOpenRouterCompletion({
        model: getUtilityModel(),
        jsonMode: true,
        temperature: 0.35,
        messages: [
          {
            role: 'user',
            content: `Create a calm, Oura-inspired Vedic Timing Radar brief for ${params.profileName} (${params.ascendantSign} Lagna, ${params.moonSign} Moon).
Active Dasha: ${md} MD -> ${ad} AD -> ${pd} PD.
Current Transits: ${transitSummary || 'Standard daily pacing'}.
Return crisp, non-fatalistic, deeply specific guidance (no mysticism clichés) strictly as JSON with keys:
dailyHeadline, dailyGuidance, dailyAction, monthlyHeadline, monthlyGuidance, monthlyWatch.`,
          },
        ],
      });

      const parsed = safeExtractJson<Record<string, string>>(completion.text, {});
      if (parsed.dailyHeadline && parsed.dailyGuidance) {
        daily = {
          headline: parsed.dailyHeadline,
          guidance: parsed.dailyGuidance,
          focusAction: parsed.dailyAction || 'Align high-priority decisions with clarity.',
        };
        dailyBriefCache.set(dailyKey, daily);
      }
      if (parsed.monthlyHeadline && parsed.monthlyGuidance) {
        monthly = {
          headline: parsed.monthlyHeadline,
          guidance: parsed.monthlyGuidance,
          themeWatch: parsed.monthlyWatch || `${md}-${ad} cycle pacing`,
        };
        monthlyBriefCache.set(monthlyKey, monthly);
      }
    } catch {
      // Fall back to deterministic ephemeris brief below
    }
  }

  return {
    dailyBrief: {
      date: todayISO,
      headline: daily?.headline || `${md}–${ad} Rhythm in ${params.moonSign} Moon`,
      guidance:
        daily?.guidance ||
        `Today activates your ${md} Mahadasha and ${ad} Antardasha${jup ? ` alongside Jupiter transiting your ${jup.houseFromLagna}th house` : ''}. Favor deliberate conversations and calm execution over rushed commitments.`,
      focusAction:
        daily?.focusAction ||
        `Channel ${pd || ad || md} focus toward one meaningful milestone today.`,
    },
    monthlyBrief: {
      month: monthISO,
      headline: monthly?.headline || `Strategic Consolidation Under ${md}–${ad}`,
      guidance:
        monthly?.guidance ||
        `Across ${monthISO}, ${params.ascendantSign} Lagna is paced by ${sat ? `Saturn in House ${sat.houseFromLagna}` : `${md} Mahadasha`} and ${jup ? `Jupiter in House ${jup.houseFromLagna}` : 'your active Antardasha'}. Build durable routines and review commitments with patience.`,
      themeWatch:
        monthly?.themeWatch ||
        `${params.ladder[1]?.daysRemaining ?? 30} days remaining in ${ad || md} sub-period`,
    },
  };
}

async function generateCachedWesternBriefs(params: {
  profileId: string;
  profileName: string;
  ascendantSign: string;
  moonSign: string;
  profectionSummary: string;
  progressedMoonSummary: string;
  saturnHouse: number;
  jupiterHouse: number;
  tightHitSummary: string;
  daysUntilNextProfection: number;
}): Promise<{
  dailyBrief: TimingRadarSnapshot['dailyBrief'];
  monthlyBrief: TimingRadarSnapshot['monthlyBrief'];
}> {
  const todayISO = new Date().toISOString().slice(0, 10);
  const monthISO = todayISO.slice(0, 7);
  const dailyKey = `${params.profileId}:western:${todayISO}`;
  const monthlyKey = `${params.profileId}:western:${monthISO}`;

  let daily = dailyBriefCache.get(dailyKey);
  let monthly = monthlyBriefCache.get(monthlyKey);

  if (isOpenRouterConfigured() && (!daily || !monthly)) {
    try {
      const completion = await createOpenRouterCompletion({
        model: getUtilityModel(),
        jsonMode: true,
        temperature: 0.35,
        messages: [
          {
            role: 'user',
            content: `Create a calm, Oura-inspired Western Tropical Timing Radar brief for ${params.profileName} (${params.ascendantSign} Rising, ${params.moonSign} Moon).
Annual Profection: ${params.profectionSummary}.
Secondary Progressed Moon: ${params.progressedMoonSummary}.
Outer Transits: Saturn in H${params.saturnHouse}, Jupiter in H${params.jupiterHouse}. Tight hits: ${params.tightHitSummary || 'None exact today'}.
Use strictly Western Tropical terminology (NO Sanskrit/Vedic terms). Return crisp, non-fatalistic, deeply specific guidance strictly as JSON with keys:
dailyHeadline, dailyGuidance, dailyAction, monthlyHeadline, monthlyGuidance, monthlyWatch.`,
          },
        ],
      });

      const parsed = safeExtractJson<Record<string, string>>(completion.text, {});
      if (parsed.dailyHeadline && parsed.dailyGuidance) {
        daily = {
          headline: parsed.dailyHeadline,
          guidance: parsed.dailyGuidance,
          focusAction: parsed.dailyAction || 'Align high-priority decisions with clarity.',
        };
        dailyBriefCache.set(dailyKey, daily);
      }
      if (parsed.monthlyHeadline && parsed.monthlyGuidance) {
        monthly = {
          headline: parsed.monthlyHeadline,
          guidance: parsed.monthlyGuidance,
          themeWatch: parsed.monthlyWatch || params.profectionSummary,
        };
        monthlyBriefCache.set(monthlyKey, monthly);
      }
    } catch {
      // Deterministic fallback below
    }
  }

  return {
    dailyBrief: {
      date: todayISO,
      headline: daily?.headline || `${params.profectionSummary} · ${params.progressedMoonSummary}`,
      guidance:
        daily?.guidance ||
        `Today weaves your ${params.profectionSummary} with Secondary Progressed Moon in ${params.progressedMoonSummary} and Jupiter transiting your ${params.jupiterHouse}th Placidus house. Favor calm follow-through and clear dialogue.`,
      focusAction:
        daily?.focusAction ||
        `Lean into one deliberate priority aligned with your ${params.profectionSummary} focus.`,
    },
    monthlyBrief: {
      month: monthISO,
      headline: monthly?.headline || `Steady Momentum Under ${params.profectionSummary}`,
      guidance:
        monthly?.guidance ||
        `Throughout ${monthISO}, ${params.ascendantSign} Rising balances Saturn transiting House ${params.saturnHouse} with Jupiter expanding House ${params.jupiterHouse}. Pace commitments with grounded discernment.`,
      themeWatch:
        monthly?.themeWatch ||
        `${params.daysUntilNextProfection} days until your next Annual Profection birthday shift`,
    },
  };
}

async function buildWesternTimingRadar(params: {
  profileId: string;
  profileName: string;
  chartJson: CompiledChartData;
}): Promise<TimingRadarSnapshot> {
  const todayISO = new Date().toISOString().slice(0, 10);
  const enriched = enrichCompiledChart(params.chartJson).chartJson;
  const w = enriched.western;

  if (!w) {
    return {
      mode: 'western',
      profileId: params.profileId,
      profileName: params.profileName,
      ascendantSign: 'Aries',
      moonSign: 'Aries',
      dashaLadder: [],
      upcomingShift: null,
      transitsDate: todayISO,
      slowPlanetShifts: [],
      convergenceWindows: [],
      dailyBrief: {
        date: todayISO,
        headline: 'Tropical Timing Readiness',
        guidance: 'Recalculate or open your chart profile to populate Tropical angles and multi-clock timings.',
        focusAction: 'Review your birth details in Profiles.',
      },
      monthlyBrief: {
        month: todayISO.slice(0, 7),
        headline: 'Monthly Tropical Overview',
        guidance: 'Save your birth chart to view live Annual Profections, Progressed Moon, and outer transits.',
        themeWatch: 'Birth chart data required',
      },
      transitsAvailable: false,
    };
  }

  let westernTransits: WesternPlanetPosition[] = [];
  let transitsDate: string | null = todayISO;
  let transitsAvailable = false;

  if (isAstrologyApiConfigured()) {
    try {
      const gochar = await getOrFetchDailyTransits();
      if (Array.isArray(gochar.westernPlanets) && gochar.westernPlanets.length > 0) {
        westernTransits = gochar.westernPlanets;
        transitsDate = gochar.transitDate;
        transitsAvailable = true;
      }
    } catch {
      // Deterministic fallback below
    }
  }
  if (westernTransits.length === 0) {
    const siderealDaily = computeDeterministicSiderealPlanets(todayISO);
    westernTransits = computeWesternDailyTransits(siderealDaily, todayISO);
    transitsAvailable = true;
  }

  const snap = computeWesternTimingSnapshot({
    westernChart: w,
    birthDateISO: enriched.meta?.birthDate || '1990-01-01',
    birthTimeStr: enriched.meta?.birthTime || '12:00:00',
    timezoneOffsetHours: enriched.meta?.location?.timezoneOffset ?? 0,
    latitude: enriched.meta?.location?.latitude ?? 0,
    longitude: enriched.meta?.location?.longitude ?? 0,
    transitPlanets: westernTransits,
    nowDate: todayISO,
  });

  const ladder: DashaProgressItem[] = [
    {
      level: 'Annual Profection',
      lord: `H${snap.profection.profectedHouse} ${snap.profection.profectedSign} · Lord: ${snap.profection.lordOfYearTraditional}`,
      startDate: snap.profection.yearStartIso,
      endDate: snap.profection.yearEndIso,
      percentElapsed: snap.profection.percentElapsed,
      daysRemaining: snap.profection.daysLeft,
    },
    {
      level: 'Progressed Moon',
      lord: `${snap.progressions.moon.sign} ${snap.progressions.moon.dms} (H${snap.progressions.moon.house})`,
      startDate: snap.progressions.moon.signStartIso,
      endDate: snap.progressions.moon.signEndIso,
      percentElapsed: snap.progressions.moon.percentElapsed,
      daysRemaining: snap.progressions.moon.daysLeft,
    },
    {
      level: 'Solar Return',
      lord: `SR Asc ${snap.solarReturn.srAscendantSign} · Sun H${snap.solarReturn.srSunHouse}`,
      startDate: snap.solarReturn.yearStartIso,
      endDate: snap.solarReturn.yearEndIso,
      percentElapsed: snap.profection.percentElapsed,
      daysRemaining: snap.profection.daysLeft,
    },
  ];

  const ascSignIdx = Math.floor((w.angles.ascendant.longitude || 0) / 30) % 12;
  const nextProfHouse = (snap.profection.profectedHouse % 12) + 1;
  const nextProfSignIdx = (ascSignIdx + nextProfHouse - 1) % 12;
  const nextProfLord = WESTERN_TRADITIONAL_RULERS[nextProfSignIdx];

  const upcomingShift: TimingRadarSnapshot['upcomingShift'] = {
    type: 'Profection',
    fromLord: `H${snap.profection.profectedHouse} (${snap.profection.lordOfYearTraditional})`,
    toLord: `H${nextProfHouse} (${nextProfLord})`,
    transitionDate: snap.profection.yearEndIso,
  };

  const tropMoon = w.planets.find((p) => p.name === 'Moon');
  const tropMoonSignIdx = tropMoon?.signIndex ?? 0;
  const wantedOuter = new Set(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node']);

  const slowPlanetShifts: TransitAlignmentItem[] = snap.transits.outerPlanets
    .filter((tp) => wantedOuter.has(tp.planet))
    .map((tp) => {
      const signIdx = Math.max(0, SIGNS.indexOf(tp.sign as (typeof SIGNS)[number]));
      const houseFromMoon = ((signIdx - tropMoonSignIdx + 12) % 12) + 1;
      const tightHits = snap.transits.tightHitsToNatal.filter((h) => h.transitPlanet === tp.planet);
      const topHit = tightHits[0];

      let signal: 'supportive' | 'neutral' | 'intense' = 'neutral';
      let note = `Transiting Placidus House ${tp.natalHouse} (${tp.sign}).`;

      if (topHit) {
        const isHarmonious = topHit.aspect === 'Trine' || topHit.aspect === 'Sextile' || (topHit.aspect === 'Conjunction' && tp.planet === 'Jupiter');
        const isChallenging = topHit.aspect === 'Square' || topHit.aspect === 'Opposition';
        signal = isHarmonious ? 'supportive' : isChallenging ? 'intense' : tp.planet === 'Jupiter' ? 'supportive' : 'neutral';
        note = `${topHit.aspect} natal ${topHit.natalBody} (${topHit.orb.toFixed(1)}° orb) · House ${tp.natalHouse}.`;
      } else if (tp.planet === 'Jupiter') {
        signal = 'supportive';
        note = `Expanding Placidus House ${tp.natalHouse} themes in ${tp.sign}.`;
      } else if (tp.planet === 'Saturn') {
        signal = [1, 4, 7, 10].includes(tp.natalHouse) ? 'intense' : 'neutral';
        note = `Structuring & testing Placidus House ${tp.natalHouse} commitments.`;
      }

      return {
        planet: tp.planet,
        sign: tp.sign,
        dms: tp.dms,
        nakshatra: '',
        isRetrograde: tp.isRetrograde,
        houseFromLagna: tp.natalHouse,
        houseFromMoon,
        savBindus: 0,
        signal,
        note,
      };
    });

  const jupTransit = slowPlanetShifts.find((s) => s.planet === 'Jupiter');
  const satTransit = slowPlanetShifts.find((s) => s.planet === 'Saturn');
  const today = new Date();
  const plus30 = new Date(today.getTime() + 30 * 86400 * 1000).toISOString().slice(0, 10);
  const plus90 = new Date(today.getTime() + 90 * 86400 * 1000).toISOString().slice(0, 10);
  const plus180 = new Date(today.getTime() + 180 * 86400 * 1000).toISOString().slice(0, 10);

  const tightHitSummary = snap.transits.tightHitsToNatal
    .slice(0, 2)
    .map((h) => `${h.transitPlanet} ${h.aspect} ${h.natalBody} (${h.orb.toFixed(1)}°)`)
    .join(', ');

  const convergenceWindows: ConvergenceWindow[] = [
    {
      label: 'Immediate Horizon (Next 30 Days)',
      windowRange: `${todayISO} → ${plus30}`,
      focusDomain: `H${snap.profection.profectedHouse} Profection (${snap.profection.lordOfYearTraditional})`,
      intensity: jupTransit?.signal === 'supportive' ? 'Peak Alignment' : 'Steady Consolidation',
      drivers: tightHitSummary
        ? `Exact outer transits (${tightHitSummary}) activating your ${snap.profection.profectedSign} Profection year.`
        : `Jupiter in H${jupTransit?.houseFromLagna ?? '-'} (${jupTransit?.sign ?? ''}) supporting Lord of the Year ${snap.profection.lordOfYearTraditional}.`,
    },
    {
      label: `Next Profection Year: ${upcomingShift.toLord}`,
      windowRange: `Shifts ${snap.profection.yearEndIso}`,
      focusDomain: 'Solar Return & Birthday Cycle',
      intensity: satTransit?.signal === 'intense' ? 'Reflective Calibration' : 'Steady Consolidation',
      drivers: `Transitions from ${upcomingShift.fromLord} into ${upcomingShift.toLord} while Progressed Moon moves through ${snap.progressions.moon.sign}.`,
    },
    {
      label: 'Medium-Term Outer Transit Arc (90–180 Days)',
      windowRange: `${plus90} → ${plus180}`,
      focusDomain: 'Progressions + Outer Transits',
      intensity:
        snap.progressions.tightAspectsToNatal.length > 0 || jupTransit?.signal === 'supportive'
          ? 'Peak Alignment'
          : 'Steady Consolidation',
      drivers:
        snap.progressions.tightAspectsToNatal[0]
          ? `Progressed ${snap.progressions.tightAspectsToNatal[0].progressedBody} ${snap.progressions.tightAspectsToNatal[0].aspect} natal ${snap.progressions.tightAspectsToNatal[0].natalBody} paired with Saturn H${satTransit?.houseFromLagna ?? '-'}.`
          : `Jupiter H${jupTransit?.houseFromLagna ?? '-'} expansion balanced by Saturn H${satTransit?.houseFromLagna ?? '-'} discipline.`,
    },
  ];

  const { dailyBrief, monthlyBrief } = await generateCachedWesternBriefs({
    profileId: params.profileId,
    profileName: params.profileName,
    ascendantSign: w.angles.ascendant.sign,
    moonSign: tropMoon?.sign || 'Aries',
    profectionSummary: `H${snap.profection.profectedHouse} ${snap.profection.profectedSign} (${snap.profection.lordOfYearTraditional})`,
    progressedMoonSummary: `${snap.progressions.moon.sign} (H${snap.progressions.moon.house})`,
    saturnHouse: satTransit?.houseFromLagna ?? 1,
    jupiterHouse: jupTransit?.houseFromLagna ?? 1,
    tightHitSummary,
    daysUntilNextProfection: snap.profection.daysLeft,
  });

  return {
    mode: 'western',
    profileId: params.profileId,
    profileName: params.profileName,
    ascendantSign: w.angles.ascendant.sign,
    moonSign: tropMoon?.sign || 'Aries',
    dashaLadder: ladder,
    upcomingShift,
    transitsDate,
    slowPlanetShifts,
    convergenceWindows,
    dailyBrief,
    monthlyBrief,
    transitsAvailable,
  };
}

export async function buildTimingRadarForProfile(params: {
  profileId: string;
  profileName: string;
  chartJson: CompiledChartData;
  mode?: 'vedic' | 'western';
}): Promise<TimingRadarSnapshot> {
  if (params.mode === 'western') {
    return buildWesternTimingRadar(params);
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  const { chartJson } = params;

  const asc = chartJson.planets.find((p) => p.name === 'Ascendant');
  const moon = chartJson.planets.find((p) => p.name === 'Moon');
  const ascSignIdx = asc?.signIndex ?? 0;
  const moonSignIdx = moon?.signIndex ?? 0;

  const { ladder, upcomingShift } = findActiveDashaNodes(
    chartJson.vimshottari?.timeline || [],
    todayISO
  );

  let transitPlanets: PlanetPosition[] = [];
  let transitsDate: string | null = null;
  let transitsAvailable = false;

  if (isAstrologyApiConfigured()) {
    try {
      const gochar = await getOrFetchDailyTransits();
      transitPlanets = gochar.planets;
      transitsDate = gochar.transitDate;
      transitsAvailable = true;
    } catch {
      transitsAvailable = false;
    }
  }

  const wantedTransits = new Set(['Saturn', 'Jupiter', 'Rahu', 'Ketu', 'Sun', 'Mars']);
  const savArr = chartJson.ashtakavarga?.sarva || Array(12).fill(28);

  const slowPlanetShifts: TransitAlignmentItem[] = transitPlanets
    .filter((p) => wantedTransits.has(p.name))
    .map((p) => {
      const houseFromLagna = ((p.signIndex - ascSignIdx + 12) % 12) + 1;
      const houseFromMoon = ((p.signIndex - moonSignIdx + 12) % 12) + 1;
      const savBindus = savArr[p.signIndex] ?? 28;
      const { signal, note } = classifyTransitSignal(p.name, houseFromMoon, savBindus);

      return {
        planet: p.name,
        sign: p.sign,
        dms: p.dms,
        nakshatra: p.nakshatra,
        isRetrograde: p.isRetrograde,
        houseFromLagna,
        houseFromMoon,
        savBindus,
        signal,
        note,
      };
    });

  const convergenceWindows = buildConvergenceWindows(ladder, slowPlanetShifts, upcomingShift);

  const { dailyBrief, monthlyBrief } = await generateCachedBriefs({
    profileId: params.profileId,
    profileName: params.profileName,
    ascendantSign: asc?.sign || 'Aries',
    moonSign: moon?.sign || 'Aries',
    ladder,
    shifts: slowPlanetShifts,
  });

  return {
    mode: 'vedic',
    profileId: params.profileId,
    profileName: params.profileName,
    ascendantSign: asc?.sign || 'Aries',
    moonSign: moon?.sign || 'Aries',
    dashaLadder: ladder,
    upcomingShift,
    transitsDate,
    slowPlanetShifts,
    convergenceWindows,
    dailyBrief,
    monthlyBrief,
    transitsAvailable,
  };
}
