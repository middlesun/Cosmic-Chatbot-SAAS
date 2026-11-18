import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { CompiledChartData } from './chartCompiler';
import { getOrFetchDailyTransits, isAstrologyApiConfigured } from './astrologyApi';
import type { DashaNode, PlanetPosition } from './jyotishMath';

export interface DashaProgressItem {
  level: 'Mahadasha' | 'Antardasha' | 'Pratyantardasha';
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

// In-memory brief cache keyed by (profileId + date/month) so page reloads do not burn Gemini tokens
const dailyBriefCache = new Map<
  string,
  { headline: string; guidance: string; focusAction: string }
>();
const monthlyBriefCache = new Map<
  string,
  { headline: string; guidance: string; themeWatch: string }
>();

let radarAiClient: GoogleGenAI | null = null;

function getRadarAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!radarAiClient) {
    radarAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return radarAiClient;
}

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

  const ai = getRadarAiClient();
  if (ai && (!daily || !monthly)) {
    try {
      const transitSummary = params.shifts
        .map((s) => `${s.planet} in ${s.sign} (H${s.houseFromLagna} Lagna, H${s.houseFromMoon} Moon, SAV ${s.savBindus})`)
        .join('; ');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Create a calm, Oura-inspired Vedic Timing Radar brief for ${params.profileName} (${params.ascendantSign} Lagna, ${params.moonSign} Moon).
Active Dasha: ${md} MD -> ${ad} AD -> ${pd} PD.
Current Transits: ${transitSummary || 'Standard daily pacing'}.
Return crisp, non-fatalistic, deeply specific guidance (no mysticism clichés).`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              dailyHeadline: { type: Type.STRING },
              dailyGuidance: { type: Type.STRING },
              dailyAction: { type: Type.STRING },
              monthlyHeadline: { type: Type.STRING },
              monthlyGuidance: { type: Type.STRING },
              monthlyWatch: { type: Type.STRING },
            },
            required: [
              'dailyHeadline',
              'dailyGuidance',
              'dailyAction',
              'monthlyHeadline',
              'monthlyGuidance',
              'monthlyWatch',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as Record<string, string>;
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

export async function buildTimingRadarForProfile(params: {
  profileId: string;
  profileName: string;
  chartJson: CompiledChartData;
}): Promise<TimingRadarSnapshot> {
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
