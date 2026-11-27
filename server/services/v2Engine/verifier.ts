/**
 * Isolated V2 Engine — Independent Mathematical Verification & Frame Auditors
 *
 * Pure astronomical & Jyotish verification helpers without legacy partial H1/H7
 * overwrites, without Western-from-KP reconstruction, and without arbitrary
 * universal MC or house-size limits.
 */

import {
  formatDMS,
  getDignity,
  getNakshatraAndSubs,
  getVargaSignIndex,
  normalizeDeg,
  SIGNS,
  type PlanetPosition,
} from '../jyotishMath';
import type {
  BhavaChalitMethodologyAudit,
  CanonicalBirthInstant,
  EpistemicClassificationItem,
  EpistemicClassificationSummary,
  KpPlacidusFrame,
  LayerARawProviderRecord,
  LayerBMasterChartRecord,
  MathematicalVerificationReport,
  VedicLahiriFrame,
  VerificationCheckResult,
  WesternTropicalFrame,
} from './types';

export interface IndependentAstroReference {
  julianDayUt: number;
  meanObliquityDeg: number;
  gmstDeg: number;
  ramcDeg: number;
  tropicalAscendantDeg: number;
  tropicalMcDeg: number;
  tropicalPlacidusCusps: number[]; // 1..12
  tropicalSunLonDeg: number;
  tropicalMoonLonDeg: number;
  lahiriSunLonDeg: number;
  lahiriMoonLonDeg: number;
  lahiriAscendantDeg: number;
  lahiriMcDeg: number;
  kpAscendantDeg: number;
  kpMcDeg: number;
  kpPlacidusCuspsDeg: number[]; // 1..12
  sripatiLahiriBhavaMadhyasDeg: number[]; // 1..12
  sripatiLahiriSandhisDeg: Array<{ house: number; start: number; end: number; midpoint: number }>;
  placidusPolarCircleFallbackApplied: boolean;
}

function circularDiffDeg(a: number, b: number): number {
  let d = normalizeDeg(a) - normalizeDeg(b);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export function circularContainsLon(start: number, end: number, target: number): boolean {
  const s = normalizeDeg(start);
  const e = normalizeDeg(end);
  const t = normalizeDeg(target);
  if (s < e) return t >= s && t < e;
  return t >= s || t < e;
}

/**
 * Pure independent astronomical reference using Meeus Solar/Lunar formulas and
 * uncorrupted Placidus semi-arc iteration + Sripati quadrant trisection.
 */
export function computeIndependentAstronomicalReference(
  instant: CanonicalBirthInstant
): IndependentAstroReference {
  const jd = instant.utc.julianDayUt;
  const t = (jd - 2451545.0) / 36525.0;
  const degToRad = Math.PI / 180;
  const radToDeg = 180 / Math.PI;

  const epsDeg = instant.astronomy.meanObliquityDeg;
  const eps = epsDeg * degToRad;
  const gmstDeg = instant.astronomy.greenwichMeanSiderealTimeDeg;
  const ramcDeg = instant.astronomy.localMeanSiderealTimeDeg;
  const ramc = ramcDeg * degToRad;
  const latRad = instant.input.latitude * degToRad;

  // Tropical MC (House 10)
  const mcRad = Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps));
  const tropicalMcDeg = normalizeDeg(mcRad * radToDeg);

  // Tropical Ascendant (House 1)
  const ascRad = Math.atan2(
    Math.cos(ramc),
    -(Math.sin(ramc) * Math.cos(eps) + Math.tan(latRad) * Math.sin(eps))
  );
  const tropicalAscendantDeg = normalizeDeg(ascRad * radToDeg);

  // Iterative Placidus semi-arc solver (pure RA fixed-point iteration, exact tan(decl) = tan(eps)*sin(RA))
  // Diurnal semi-arc DSA = pi/2 + asin(tan(lat)*tan(decl)), Nocturnal NSA = pi/2 - asin(tan(lat)*tan(decl))
  let placidusPolarCircleFallbackApplied = false;
  const solvePlacidus = (fraction: number, offsetDeg: number, isNocturnal: boolean): number => {
    let raDeg = normalizeDeg(ramcDeg + offsetDeg);
    for (let iter = 0; iter < 30; iter++) {
      const ra = raDeg * degToRad;
      const tanDecl = Math.tan(eps) * Math.sin(ra);
      const prod = Math.tan(latRad) * tanDecl;
      if (Math.abs(prod) >= 0.9999) {
        placidusPolarCircleFallbackApplied = true;
      }
      const ad = Math.asin(Math.max(-0.9999, Math.min(0.9999, prod)));
      const semiArc = isNocturnal ? Math.PI / 2 - ad : Math.PI / 2 + ad;
      const targetRaRad = isNocturnal
        ? ramc + Math.PI - fraction * semiArc
        : ramc + fraction * semiArc;
      const nextRaDeg = normalizeDeg(targetRaRad * radToDeg);
      if (Math.abs(circularDiffDeg(nextRaDeg, raDeg)) < 1e-8) {
        raDeg = nextRaDeg;
        break;
      }
      raDeg = nextRaDeg;
    }
    const finalRa = raDeg * degToRad;
    const eclLon = Math.atan2(Math.sin(finalRa), Math.cos(finalRa) * Math.cos(eps));
    return normalizeDeg(eclLon * radToDeg);
  };

  const tropicalPlacidusCusps: number[] = new Array(12).fill(0);
  tropicalPlacidusCusps[0] = tropicalAscendantDeg;
  tropicalPlacidusCusps[9] = tropicalMcDeg;
  tropicalPlacidusCusps[6] = normalizeDeg(tropicalAscendantDeg + 180);
  tropicalPlacidusCusps[3] = normalizeDeg(tropicalMcDeg + 180);

  tropicalPlacidusCusps[10] = solvePlacidus(1 / 3, 30, false); // H11
  tropicalPlacidusCusps[11] = solvePlacidus(2 / 3, 60, false); // H12
  tropicalPlacidusCusps[1] = solvePlacidus(2 / 3, 120, true); // H2
  tropicalPlacidusCusps[2] = solvePlacidus(1 / 3, 150, true); // H3
  tropicalPlacidusCusps[4] = normalizeDeg(tropicalPlacidusCusps[10] + 180); // H5
  tropicalPlacidusCusps[5] = normalizeDeg(tropicalPlacidusCusps[11] + 180); // H6
  tropicalPlacidusCusps[7] = normalizeDeg(tropicalPlacidusCusps[1] + 180); // H8
  tropicalPlacidusCusps[8] = normalizeDeg(tropicalPlacidusCusps[2] + 180); // H9

  // Meeus low/medium-precision Solar longitude (~0.01° accuracy)
  const L0 = normalizeDeg(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
  const M = normalizeDeg(357.52911 + 35999.05029 * t - 0.0001537 * t * t);
  const Mrad = M * degToRad;
  const C =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(Mrad) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * Mrad) +
    0.000289 * Math.sin(3 * Mrad);
  const omega = (125.04 - 1934.136 * t) * degToRad;
  const tropicalSunLonDeg = normalizeDeg(L0 + C - 0.00569 - 0.00478 * Math.sin(omega));

  // Meeus Lunar longitude (principal periodic terms, ~0.05° accuracy)
  const Lp = normalizeDeg(218.3164477 + 481267.88123421 * t - 0.0015786 * t * t);
  const D = normalizeDeg(297.8501921 + 445267.1114034 * t - 0.0018819 * t * t);
  const Mp = normalizeDeg(134.9633964 + 477198.8675055 * t + 0.0087414 * t * t);
  const F = normalizeDeg(93.272095 + 483202.0175233 * t - 0.0036539 * t * t);
  const Drad = D * degToRad;
  const Mprad = Mp * degToRad;
  const Frad = F * degToRad;
  const moonDelta =
    6.288774 * Math.sin(Mprad) +
    1.274027 * Math.sin(2 * Drad - Mprad) +
    0.658314 * Math.sin(2 * Drad) +
    0.213618 * Math.sin(2 * Mprad) -
    0.185116 * Math.sin(Mrad) -
    0.114332 * Math.sin(2 * Frad) +
    0.058793 * Math.sin(2 * Drad - 2 * Mprad) +
    0.057066 * Math.sin(2 * Drad - Mrad - Mprad) +
    0.053322 * Math.sin(2 * Drad + Mprad) +
    0.045758 * Math.sin(2 * Drad - Mrad) -
    0.040923 * Math.sin(Mrad - Mprad) -
    0.03472 * Math.sin(Drad) -
    0.030383 * Math.sin(Mrad + Mprad);
  const tropicalMoonLonDeg = normalizeDeg(Lp + moonDelta - 0.00478 * Math.sin(omega));

  const lahiri = instant.astronomy.lahiriAyanamsaApproxDeg;
  const kpAy = instant.astronomy.kpAyanamsaApproxDeg;

  const lahiriAscendantDeg = normalizeDeg(tropicalAscendantDeg - lahiri);
  const lahiriMcDeg = normalizeDeg(tropicalMcDeg - lahiri);

  // Classical Sripati Bhava Chalit (cusp = Bhava Madhya; quadrants between Asc/IC/Dsc/MC trisected)
  const h1M = lahiriAscendantDeg;
  const h4M = normalizeDeg(lahiriMcDeg + 180);
  const h7M = normalizeDeg(lahiriAscendantDeg + 180);
  const h10M = lahiriMcDeg;
  const forwardSpan = (a: number, b: number) => normalizeDeg(b - a);
  const q1 = forwardSpan(h1M, h4M) / 3;
  const q2 = forwardSpan(h4M, h7M) / 3;
  const q3 = forwardSpan(h7M, h10M) / 3;
  const q4 = forwardSpan(h10M, h1M) / 3;

  const sripatiLahiriBhavaMadhyasDeg = [
    h1M,
    normalizeDeg(h1M + q1),
    normalizeDeg(h1M + 2 * q1),
    h4M,
    normalizeDeg(h4M + q2),
    normalizeDeg(h4M + 2 * q2),
    h7M,
    normalizeDeg(h7M + q3),
    normalizeDeg(h7M + 2 * q3),
    h10M,
    normalizeDeg(h10M + q4),
    normalizeDeg(h10M + 2 * q4),
  ];

  const midAngleForward = (a: number, b: number) => normalizeDeg(a + forwardSpan(a, b) / 2);
  const sripatiLahiriSandhisDeg = sripatiLahiriBhavaMadhyasDeg.map((mid, i) => {
    const prev = sripatiLahiriBhavaMadhyasDeg[(i + 11) % 12];
    const next = sripatiLahiriBhavaMadhyasDeg[(i + 1) % 12];
    return {
      house: i + 1,
      start: Number(midAngleForward(prev, mid).toFixed(4)),
      end: Number(midAngleForward(mid, next).toFixed(4)),
      midpoint: Number(mid.toFixed(4)),
    };
  });

  return {
    julianDayUt: jd,
    meanObliquityDeg: epsDeg,
    gmstDeg,
    ramcDeg,
    tropicalAscendantDeg: Number(tropicalAscendantDeg.toFixed(4)),
    tropicalMcDeg: Number(tropicalMcDeg.toFixed(4)),
    tropicalPlacidusCusps: tropicalPlacidusCusps.map((c) => Number(c.toFixed(4))),
    tropicalSunLonDeg: Number(tropicalSunLonDeg.toFixed(4)),
    tropicalMoonLonDeg: Number(tropicalMoonLonDeg.toFixed(4)),
    lahiriSunLonDeg: Number(normalizeDeg(tropicalSunLonDeg - lahiri).toFixed(4)),
    lahiriMoonLonDeg: Number(normalizeDeg(tropicalMoonLonDeg - lahiri).toFixed(4)),
    lahiriAscendantDeg: Number(lahiriAscendantDeg.toFixed(4)),
    lahiriMcDeg: Number(lahiriMcDeg.toFixed(4)),
    kpAscendantDeg: Number(normalizeDeg(tropicalAscendantDeg - kpAy).toFixed(4)),
    kpMcDeg: Number(normalizeDeg(tropicalMcDeg - kpAy).toFixed(4)),
    kpPlacidusCuspsDeg: tropicalPlacidusCusps.map((c) => Number(normalizeDeg(c - kpAy).toFixed(4))),
    sripatiLahiriBhavaMadhyasDeg: sripatiLahiriBhavaMadhyasDeg.map((c) => Number(c.toFixed(4))),
    sripatiLahiriSandhisDeg,
    placidusPolarCircleFallbackApplied,
  };
}

/**
 * Verifies whether a provider's native Bhava Chalit response matches classical
 * Sripati midpoint Bhava Chalit (degree_cusp = Bhava Madhya straddled by
 * [boundary_start, boundary_end]) vs cusp-start Placidus / Equal.
 */
export function verifyBhavaChalitMethodology(
  providerBhavaChalit: Record<string, unknown> | null,
  ref: IndependentAstroReference
): BhavaChalitMethodologyAudit {
  if (!providerBhavaChalit) {
    return {
      providerHouseBasis: null,
      cuspIsMidpointStraddledByBoundaries: false,
      matchesClassicalSripatiWithin1Deg: false,
      maxDeltaVsSripatiCuspsDeg: null,
      allPlanetsMatchBoundaryContainment: false,
      compatibleWithIntendedClassicalMethodology: false,
      notes: ['Provider Bhava Chalit dataset absent.'],
    };
  }

  const houseBasis =
    typeof providerBhavaChalit.house_basis === 'string'
      ? providerBhavaChalit.house_basis
      : null;
  const houses = Array.isArray(providerBhavaChalit.houses)
    ? (providerBhavaChalit.houses as Array<Record<string, unknown>>)
    : [];
  const planets = Array.isArray(providerBhavaChalit.planets)
    ? (providerBhavaChalit.planets as Array<Record<string, unknown>>)
    : [];

  let straddledCount = 0;
  let maxSripatiDelta: number | null = null;

  for (const h of houses) {
    const num = Number(h.house);
    const cusp = Number(h.degree_cusp);
    const bStart = Number(h.boundary_start);
    const bEnd = Number(h.boundary_end);
    if (
      Number.isFinite(cusp) &&
      Number.isFinite(bStart) &&
      Number.isFinite(bEnd) &&
      circularContainsLon(bStart, bEnd, cusp) &&
      Math.abs(circularDiffDeg(cusp, bStart)) > 1
    ) {
      straddledCount++;
    }
    if (num >= 1 && num <= 12 && Number.isFinite(cusp)) {
      const sripatiMid = ref.sripatiLahiriBhavaMadhyasDeg[num - 1];
      const delta = Math.abs(circularDiffDeg(cusp, sripatiMid));
      if (maxSripatiDelta === null || delta > maxSripatiDelta) {
        maxSripatiDelta = Number(delta.toFixed(4));
      }
    }
  }

  let containmentMatches = 0;
  for (const p of planets) {
    const lon = Number(p.absolute_degree);
    const chHouse = Number(p.chalit_house ?? p.house);
    const hObj = houses.find((h) => Number(h.house) === chHouse);
    if (
      hObj &&
      Number.isFinite(lon) &&
      circularContainsLon(Number(hObj.boundary_start), Number(hObj.boundary_end), lon)
    ) {
      containmentMatches++;
    }
  }

  const cuspIsMidpointStraddledByBoundaries = houses.length === 12 && straddledCount === 12;
  const matchesClassicalSripatiWithin1Deg =
    maxSripatiDelta !== null && maxSripatiDelta <= 1.0;
  const allPlanetsMatchBoundaryContainment =
    planets.length > 0 && containmentMatches === planets.length;

  const compatibleWithIntendedClassicalMethodology =
    cuspIsMidpointStraddledByBoundaries &&
    matchesClassicalSripatiWithin1Deg &&
    allPlanetsMatchBoundaryContainment;

  const notes: string[] = [];
  notes.push(
    `Provider house_basis="${houseBasis || 'unspecified'}", midpoint-straddled houses=${straddledCount}/12.`
  );
  notes.push(
    `Max delta vs independent Sripati Bhava Madhya=${maxSripatiDelta ?? 'N/A'}°; boundary containment=${containmentMatches}/${planets.length}.`
  );

  return {
    providerHouseBasis: houseBasis,
    cuspIsMidpointStraddledByBoundaries,
    matchesClassicalSripatiWithin1Deg,
    maxDeltaVsSripatiCuspsDeg: maxSripatiDelta,
    allPlanetsMatchBoundaryContainment,
    compatibleWithIntendedClassicalMethodology,
    notes,
  };
}

/**
 * Checks strict monotonic zodiacal order and 180° opposition for any 12-cusp array.
 * Does NOT apply arbitrary universal bounds on MC or house span widths.
 */
export function verify12CuspSequence(cuspsDeg: number[]): {
  monotonicSequential: boolean;
  totalSpanDeg: number;
  maxOppositionErrorDeg: number;
  spansDeg: number[];
} {
  if (cuspsDeg.length !== 12) {
    return {
      monotonicSequential: false,
      totalSpanDeg: 0,
      maxOppositionErrorDeg: 999,
      spansDeg: [],
    };
  }
  const spansDeg: number[] = [];
  for (let i = 0; i < 12; i++) {
    const span = normalizeDeg(cuspsDeg[(i + 1) % 12] - cuspsDeg[i]);
    spansDeg.push(Number(span.toFixed(4)));
  }
  const totalSpanDeg = Number(spansDeg.reduce((a, b) => a + b, 0).toFixed(4));
  const monotonicSequential =
    spansDeg.every((s) => s > 0 && s < 180) && Math.abs(totalSpanDeg - 360) < 0.05;

  let maxOppErr = 0;
  for (let i = 0; i < 6; i++) {
    const expectedOpp = normalizeDeg(cuspsDeg[i] + 180);
    const err = Math.abs(circularDiffDeg(cuspsDeg[i + 6], expectedOpp));
    if (err > maxOppErr) maxOppErr = err;
  }

  return {
    monotonicSequential,
    totalSpanDeg,
    maxOppositionErrorDeg: Number(maxOppErr.toFixed(4)),
    spansDeg,
  };
}

export function buildPlanetPositionsFromVedicFrame(
  planetsRaw: Array<Record<string, unknown>>,
  ascDeg: number
): PlanetPosition[] {
  const ascNorm = normalizeDeg(ascDeg);
  const ascSign = Math.floor(ascNorm / 30) % 12;
  const ascNak = getNakshatraAndSubs(ascNorm);
  const out: PlanetPosition[] = [
    {
      name: 'Ascendant',
      longitude: Number(ascNorm.toFixed(4)),
      signIndex: ascSign,
      sign: SIGNS[ascSign],
      degreeInSign: Number((ascNorm % 30).toFixed(4)),
      dms: formatDMS(ascNorm % 30),
      nakshatra: ascNak.nakshatra,
      nakshatraIndex: ascNak.nakshatraIndex,
      nakshatraLord: ascNak.nakshatraLord,
      pada: ascNak.pada,
      subLord: ascNak.subLord,
      subSubLord: ascNak.subSubLord,
      isRetrograde: false,
      house: 1,
      dignity: 'Lagna',
    },
  ];

  for (const p of planetsRaw) {
    const name = String(p.name || '').trim();
    const lon = normalizeDeg(Number(p.absolute_degree ?? 0));
    const signIndex = Math.floor(lon / 30) % 12;
    const degInSign = lon % 30;
    const nak = getNakshatraAndSubs(lon);
    out.push({
      name,
      longitude: Number(lon.toFixed(4)),
      signIndex,
      sign: SIGNS[signIndex],
      degreeInSign: Number(degInSign.toFixed(4)),
      dms: formatDMS(degInSign),
      nakshatra: nak.nakshatra,
      nakshatraIndex: nak.nakshatraIndex,
      nakshatraLord: nak.nakshatraLord,
      pada: nak.pada,
      subLord: nak.subLord,
      subSubLord: nak.subSubLord,
      isRetrograde: Boolean(p.is_retrograde),
      house: Number(p.house) || ((signIndex - ascSign + 12) % 12) + 1,
      dignity: getDignity(name, signIndex),
    });
  }
  return out;
}

const ASPECT_NAME_TO_ANGLE: Record<string, number> = {
  conjunction: 0,
  semisextile: 30,
  'semi-sextile': 30,
  semisquare: 45,
  'semi-square': 45,
  octile: 45,
  sextile: 60,
  quintile: 72,
  square: 90,
  trine: 120,
  sesquiquadrate: 135,
  sesquare: 135,
  trioctile: 135,
  biquintile: 144,
  quincunx: 150,
  inconjunct: 150,
  opposition: 180,
};

const SIGN_LORDS_TRADITIONAL = [
  'Mars',    // Aries
  'Venus',   // Taurus
  'Mercury', // Gemini
  'Moon',    // Cancer
  'Sun',     // Leo
  'Mercury', // Virgo
  'Venus',   // Libra
  'Mars',    // Scorpio
  'Jupiter', // Sagittarius
  'Saturn',  // Capricorn
  'Saturn',  // Aquarius
  'Jupiter', // Pisces
];

function extractNumericDeg(obj: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      const n = Number(obj[k]);
      if (Number.isFinite(n)) return normalizeDeg(n);
    }
  }
  return Number.NaN;
}

function findOccupiedHouseInCusps(cuspsDeg: number[], lonDeg: number): number | null {
  if (cuspsDeg.length !== 12 || !Number.isFinite(lonDeg)) return null;
  for (let i = 0; i < 12; i++) {
    if (circularContainsLon(cuspsDeg[i], cuspsDeg[(i + 1) % 12], lonDeg)) {
      return i + 1;
    }
  }
  return null;
}

function extractHouseNumbersFromUnknown(val: unknown): number[] {
  if (Array.isArray(val)) {
    return val
      .map((x) => {
        if (typeof x === 'number') return x;
        if (x && typeof x === 'object') {
          const r = x as Record<string, unknown>;
          return Number(r.house ?? r.house_number ?? r.num ?? NaN);
        }
        return Number(x);
      })
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12);
  }
  return [];
}

export interface VargasMethodologyAuditResult {
  divisionsInspected: number;
  uncalibratedDivisions: Array<{ division: string; metadata: Record<string, unknown> }>;
  d4Audit: {
    present: boolean;
    profileOrMethod: string | null;
    calibrated: boolean | null;
    hasAlternateSourceLongitudes: boolean;
    alternateSourceNotes: string[];
    matchesBphsQuadrantJumpCount: number;
    checkedBodiesCount: number;
    signMismatchesVsBphs: string[];
    continuousCyclicMatchesInsteadCount: number;
  };
  d5Audit: {
    present: boolean;
    calibrated: boolean | null;
    notes: string[];
  };
}

export function auditVargasMethodology(vedicData: VedicLahiriFrame): VargasMethodologyAuditResult {
  const charts = vedicData.vargas?.chartsByDivision || {};
  const entries = Object.entries(charts);
  const uncalibratedDivisions: Array<{ division: string; metadata: Record<string, unknown> }> = [];

  for (const [divKey, rawChart] of entries) {
    if (!rawChart || typeof rawChart !== 'object') continue;
    const meta =
      rawChart.metadata && typeof rawChart.metadata === 'object'
        ? (rawChart.metadata as Record<string, unknown>)
        : {};
    const calibratedVal =
      typeof rawChart.calibrated === 'boolean'
        ? rawChart.calibrated
        : typeof meta.calibrated === 'boolean'
        ? meta.calibrated
        : null;
    if (calibratedVal === false) {
      uncalibratedDivisions.push({
        division: divKey,
        metadata: { ...meta, calibrated: false },
      });
    }
  }

  // D4 Chaturthamsha audit (BPHS quadrant jump vs continuous/alternate source longitudes)
  const d4Key = entries.find(([k]) => k.toUpperCase() === 'D4' || k === '4')?.[0];
  const d4Chart = d4Key ? charts[d4Key] : undefined;
  const alternateSourceNotes: string[] = [];
  const signMismatchesVsBphs: string[] = [];
  let matchesBphsQuadrantJumpCount = 0;
  let checkedBodiesCount = 0;
  let continuousCyclicMatchesInsteadCount = 0;
  let hasAlternateSourceLongitudes = false;
  let d4ProfileOrMethod: string | null = null;
  let d4Calibrated: boolean | null = null;

  if (d4Chart && typeof d4Chart === 'object') {
    const d4Meta =
      d4Chart.metadata && typeof d4Chart.metadata === 'object'
        ? (d4Chart.metadata as Record<string, unknown>)
        : {};
    d4Calibrated =
      typeof d4Chart.calibrated === 'boolean'
        ? d4Chart.calibrated
        : typeof d4Meta.calibrated === 'boolean'
        ? d4Meta.calibrated
        : null;
    d4ProfileOrMethod = String(
      d4Chart.d4_profile ??
        d4Chart.profile ??
        d4Chart.method ??
        d4Meta.d4_profile ??
        d4Meta.profile ??
        d4Meta.method ??
        ''
    ).trim() || null;

    for (const altKey of [
      'alternate_longitudes',
      'alternate_source_longitudes',
      'source_longitudes',
      'raw_longitudes',
      'cyclic_longitudes',
    ]) {
      if (d4Chart[altKey] !== undefined || d4Meta[altKey] !== undefined) {
        hasAlternateSourceLongitudes = true;
        alternateSourceNotes.push(`D4 exposes ${altKey} metadata.`);
      }
    }

    const d1Map = new Map<string, number>();
    const ascLon = Number(vedicData.ascendant?.degree ?? vedicData.ascendant?.absolute_degree);
    if (Number.isFinite(ascLon)) d1Map.set('Ascendant', normalizeDeg(ascLon));
    for (const p of vedicData.planets) {
      const n = String(p.name || '').trim();
      const lon = Number(p.absolute_degree ?? p.degree);
      if (n && Number.isFinite(lon)) d1Map.set(n, normalizeDeg(lon));
    }

    const checkD4Entry = (label: string, entry: Record<string, unknown> | undefined) => {
      if (!entry) return;
      const d1Lon = d1Map.get(label);
      if (d1Lon === undefined) return;

      for (const altField of ['alternate_degree', 'source_degree', 'raw_degree', 'continuous_degree']) {
        if (entry[altField] !== undefined) {
          hasAlternateSourceLongitudes = true;
          alternateSourceNotes.push(`${label} exposes ${altField}=${String(entry[altField])}`);
        }
      }

      const returnedSignName = String(entry.sign || '').trim();
      const returnedSignIdx = SIGNS.findIndex(
        (s) => s.toLowerCase() === returnedSignName.toLowerCase()
      );
      if (returnedSignIdx < 0) return;

      checkedBodiesCount++;
      const expectedBphsIdx = getVargaSignIndex(d1Lon, 4);
      const cyclicSignIdx = Math.floor(normalizeDeg(d1Lon * 4) / 30);

      if (returnedSignIdx === expectedBphsIdx) {
        matchesBphsQuadrantJumpCount++;
      } else {
        signMismatchesVsBphs.push(
          `${label}: returned ${SIGNS[returnedSignIdx]} vs BPHS D4 ${SIGNS[expectedBphsIdx]}`
        );
        if (returnedSignIdx === cyclicSignIdx) {
          continuousCyclicMatchesInsteadCount++;
        }
      }
    };

    if (d4Chart.ascendant && typeof d4Chart.ascendant === 'object') {
      checkD4Entry('Ascendant', d4Chart.ascendant as Record<string, unknown>);
    }
    const d4Planets = Array.isArray(d4Chart.planets)
      ? (d4Chart.planets as Array<Record<string, unknown>>)
      : [];
    for (const dp of d4Planets) {
      checkD4Entry(String(dp.name || '').trim(), dp);
    }
  }

  // D5 Panchamsha audit
  const d5Key = entries.find(([k]) => k.toUpperCase() === 'D5' || k === '5')?.[0];
  const d5Chart = d5Key ? charts[d5Key] : undefined;
  const d5Meta =
    d5Chart && typeof d5Chart.metadata === 'object'
      ? (d5Chart.metadata as Record<string, unknown>)
      : {};
  const d5Calibrated =
    d5Chart && typeof d5Chart.calibrated === 'boolean'
      ? d5Chart.calibrated
      : d5Chart && typeof d5Meta.calibrated === 'boolean'
      ? d5Meta.calibrated
      : null;

  const d5Notes: string[] = [];
  if (!d5Chart) {
    d5Notes.push('D5 (Panchamsha) chart missing from provider vargas.');
  } else if (d5Calibrated === false) {
    d5Notes.push(
      'Provider explicitly tags D5 (Panchamsha) calibrated:false — D5 is outside BPHS canonical 16-Varga Shodashavarga and differs across Tajika cyclical vs odd/even traditions.'
    );
  } else {
    d5Notes.push(
      `D5 present with calibrated=${String(d5Calibrated)} (note: outside BPHS 16-Varga Shodashavarga canon).`
    );
  }

  return {
    divisionsInspected: entries.length,
    uncalibratedDivisions,
    d4Audit: {
      present: Boolean(d4Chart),
      profileOrMethod: d4ProfileOrMethod,
      calibrated: d4Calibrated,
      hasAlternateSourceLongitudes,
      alternateSourceNotes,
      matchesBphsQuadrantJumpCount,
      checkedBodiesCount,
      signMismatchesVsBphs,
      continuousCyclicMatchesInsteadCount,
    },
    d5Audit: {
      present: Boolean(d5Chart),
      calibrated: d5Calibrated,
      notes: d5Notes,
    },
  };
}

export interface KpDetailedVerificationResult {
  passed: boolean;
  cuspSequenceOk: boolean;
  maxCuspRefDeltaDeg: number | null;
  ascDeltaDeg: number | null;
  mcDeltaDeg: number | null;
  sunDeltaDeg: number | null;
  moonDeltaDeg: number | null;
  cuspLordMismatches: string[];
  occupancyChecked: number;
  occupancyMatches: number;
  occupancyMismatches: string[];
  significatorsChecked: boolean;
  houseSignificatorCoverage: number;
  planetSignificatorCoverage: number;
  significatorInconsistencies: string[];
  notes: string[];
}

export function verifyKpFrameDetailed(
  kpData: KpPlacidusFrame,
  ref: IndependentAstroReference
): KpDetailedVerificationResult {
  const cuspsDeg = kpData.cusps.map((c) =>
    extractNumericDeg(c, ['cusp_degree', 'absolute_degree', 'degree', 'longitude', 'abs_pos'])
  );
  const validCusps = cuspsDeg.length === 12 && cuspsDeg.every((d) => Number.isFinite(d));
  const seq = validCusps
    ? verify12CuspSequence(cuspsDeg)
    : { monotonicSequential: false, totalSpanDeg: 0, maxOppositionErrorDeg: 999, spansDeg: [] };
  const cuspSequenceOk = seq.monotonicSequential && seq.maxOppositionErrorDeg < 0.05;

  const kpAy = normalizeDeg(ref.tropicalAscendantDeg - ref.kpAscendantDeg);
  const expectedKpSun = normalizeDeg(ref.tropicalSunLonDeg - kpAy);
  const expectedKpMoon = normalizeDeg(ref.tropicalMoonLonDeg - kpAy);

  const maxCuspRefDeltaDeg = validCusps
    ? Number(
        Math.max(
          ...cuspsDeg.map((d, i) => Math.abs(circularDiffDeg(d, ref.kpPlacidusCuspsDeg[i])))
        ).toFixed(4)
      )
    : null;

  const ascRaw =
    (kpData.ascendant ? extractNumericDeg(kpData.ascendant, ['degree', 'absolute_degree', 'cusp_degree', 'longitude']) : NaN) ||
    (validCusps ? cuspsDeg[0] : NaN);
  const ascDeltaDeg = Number.isFinite(ascRaw)
    ? Number(Math.abs(circularDiffDeg(ascRaw, ref.kpAscendantDeg)).toFixed(4))
    : null;

  const mcObj =
    kpData.angles && typeof kpData.angles.mc === 'object'
      ? (kpData.angles.mc as Record<string, unknown>)
      : null;
  const mcRaw = mcObj
    ? extractNumericDeg(mcObj, ['degree', 'absolute_degree', 'longitude'])
    : kpData.angles && typeof kpData.angles.mc === 'number'
    ? normalizeDeg(Number(kpData.angles.mc))
    : validCusps
    ? cuspsDeg[9]
    : NaN;
  const mcDeltaDeg = Number.isFinite(mcRaw)
    ? Number(Math.abs(circularDiffDeg(mcRaw, ref.kpMcDeg)).toFixed(4))
    : null;

  const sunObj = kpData.planets.find((p) => String(p.name || '').toLowerCase() === 'sun');
  const moonObj = kpData.planets.find((p) => String(p.name || '').toLowerCase() === 'moon');
  const sunRaw = sunObj
    ? extractNumericDeg(sunObj, ['absolute_degree', 'degree', 'longitude'])
    : NaN;
  const moonRaw = moonObj
    ? extractNumericDeg(moonObj, ['absolute_degree', 'degree', 'longitude'])
    : NaN;
  const sunDeltaDeg = Number.isFinite(sunRaw)
    ? Number(Math.abs(circularDiffDeg(sunRaw, expectedKpSun)).toFixed(4))
    : null;
  const moonDeltaDeg = Number.isFinite(moonRaw)
    ? Number(Math.abs(circularDiffDeg(moonRaw, expectedKpMoon)).toFixed(4))
    : null;

  // Cusp star_lord / sub_lord verification against Vimshottari KP subdivision
  const cuspLordMismatches: string[] = [];
  if (validCusps) {
    kpData.cusps.forEach((c, idx) => {
      const nak = getNakshatraAndSubs(cuspsDeg[idx]);
      const starLord = String(c.star_lord ?? c.nakshatra_lord ?? '').trim();
      const subLord = String(c.sub_lord ?? '').trim();
      if (starLord && starLord.toLowerCase() !== nak.nakshatraLord.toLowerCase()) {
        cuspLordMismatches.push(`H${idx + 1} star_lord=${starLord} expected=${nak.nakshatraLord}`);
      }
      if (subLord && subLord.toLowerCase() !== nak.subLord.toLowerCase()) {
        cuspLordMismatches.push(`H${idx + 1} sub_lord=${subLord} expected=${nak.subLord}`);
      }
    });
  }

  // Planetary occupancy (Placidus cusp containment)
  let occupancyChecked = 0;
  let occupancyMatches = 0;
  const occupancyMismatches: string[] = [];
  const planetOccupiedHouse = new Map<string, number>();
  const planetStarLord = new Map<string, string>();

  for (const p of kpData.planets) {
    const name = String(p.name || '').trim();
    if (!name || name.toLowerCase() === 'ascendant') continue;
    const lon = extractNumericDeg(p, ['absolute_degree', 'degree', 'longitude']);
    const reportedHouse = Number(p.kp_house ?? p.house ?? p.bhava ?? NaN);
    if (!Number.isFinite(lon) || !validCusps) continue;

    const computedHouse = findOccupiedHouseInCusps(cuspsDeg, lon);
    if (computedHouse !== null) {
      planetOccupiedHouse.set(name, computedHouse);
      planetStarLord.set(name, getNakshatraAndSubs(lon).nakshatraLord);
    }
    if (Number.isInteger(reportedHouse) && reportedHouse >= 1 && reportedHouse <= 12) {
      occupancyChecked++;
      if (computedHouse === reportedHouse) {
        occupancyMatches++;
      } else {
        occupancyMismatches.push(
          `${name}@${lon.toFixed(3)}° reported H${reportedHouse}, cusp containment=H${computedHouse}`
        );
      }
    }
  }

  // Cusp ownership by sign lord
  const houseSignLord = new Map<number, string>();
  if (validCusps) {
    for (let i = 0; i < 12; i++) {
      const signIdx = Math.floor(cuspsDeg[i] / 30) % 12;
      houseSignLord.set(i + 1, SIGN_LORDS_TRADITIONAL[signIdx]);
    }
  }

  // 4-Level KP Significators cross-check
  const planetSignificators = kpData.planetSignificators || [];
  const houseSignificators = kpData.houseSignificators || [];
  const significatorInconsistencies: string[] = [];
  const significatorsChecked =
    planetSignificators.length > 0 || houseSignificators.length > 0;

  // Verify each classic planet's own occupancy (Level 2) and ownership (Level 4) appear in planetSignificators
  const CLASSICAL_7 = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  for (const ps of planetSignificators) {
    const pName = String(ps.planet ?? ps.name ?? '').trim();
    if (!CLASSICAL_7.includes(pName)) continue;

    const l2Occ = extractHouseNumbersFromUnknown(
      ps.level_2 ?? ps.level2 ?? ps.occupied_houses ?? ps.occupant_of ?? ps.house
    );
    const l4Own = extractHouseNumbersFromUnknown(
      ps.level_4 ?? ps.level4 ?? ps.owned_houses ?? ps.owner_of
    );
    const allSigHouses = new Set<number>([
      ...extractHouseNumbersFromUnknown(ps.level_1 ?? ps.level1),
      ...l2Occ,
      ...extractHouseNumbersFromUnknown(ps.level_3 ?? ps.level3),
      ...l4Own,
      ...extractHouseNumbersFromUnknown(ps.houses ?? ps.significators ?? ps.all_houses),
    ]);

    const expectedOcc = planetOccupiedHouse.get(pName);
    if (expectedOcc && allSigHouses.size > 0 && !allSigHouses.has(expectedOcc)) {
      significatorInconsistencies.push(
        `${pName} planet_significators missing occupied house H${expectedOcc}`
      );
    }
    for (const [hNum, lord] of houseSignLord.entries()) {
      if (lord === pName && allSigHouses.size > 0 && !allSigHouses.has(hNum)) {
        significatorInconsistencies.push(
          `${pName} planet_significators missing cusp-owned house H${hNum}`
        );
      }
    }
    // Check star lord occupancy (Level 1) when star lord is classical planet
    const starLord = planetStarLord.get(pName);
    const starOcc = starLord ? planetOccupiedHouse.get(starLord) : undefined;
    if (starLord && starOcc && allSigHouses.size > 0 && !allSigHouses.has(starOcc)) {
      significatorInconsistencies.push(
        `${pName} (star lord ${starLord} in H${starOcc}) missing Level-1 house H${starOcc}`
      );
    }
  }

  const occupancyVerified = occupancyChecked > 0 && occupancyMismatches.length === 0;

  const coordsPassed =
    cuspSequenceOk &&
    (maxCuspRefDeltaDeg === null || maxCuspRefDeltaDeg < 0.45) &&
    (sunDeltaDeg === null || sunDeltaDeg < 0.25) &&
    (moonDeltaDeg === null || moonDeltaDeg < 0.45) &&
    cuspLordMismatches.length === 0 &&
    occupancyVerified &&
    significatorInconsistencies.length === 0;

  const notes: string[] = [
    `KP span=${seq.totalSpanDeg}°, maxCuspΔvsRef=${maxCuspRefDeltaDeg ?? 'N/A'}°, ΔAsc=${ascDeltaDeg ?? 'N/A'}°, ΔSun=${sunDeltaDeg ?? 'N/A'}°, ΔMoon=${moonDeltaDeg ?? 'N/A'}°.`,
    `Occupancy=${occupancyMatches}/${occupancyChecked} cusp containment; Cusp lords mismatches=${cuspLordMismatches.length}; Significator houses=${houseSignificators.length}, planets=${planetSignificators.length}, inconsistencies=${significatorInconsistencies.length}.`,
    ...(occupancyChecked === 0
      ? ['KP planetary house occupancy could not be verified (0/0 planets carried kp_house/house).']
      : []),
  ];

  return {
    passed: coordsPassed,
    cuspSequenceOk,
    maxCuspRefDeltaDeg,
    ascDeltaDeg,
    mcDeltaDeg,
    sunDeltaDeg,
    moonDeltaDeg,
    cuspLordMismatches,
    occupancyChecked,
    occupancyMatches,
    occupancyMismatches,
    significatorsChecked,
    houseSignificatorCoverage: houseSignificators.length,
    planetSignificatorCoverage: planetSignificators.length,
    significatorInconsistencies,
    notes,
  };
}

export interface WesternDetailedVerificationResult {
  passed: boolean;
  cuspSequenceOk: boolean;
  maxCuspRefDeltaDeg: number | null;
  ascDeltaDeg: number | null;
  mcDeltaDeg: number | null;
  sunDeltaDeg: number | null;
  moonDeltaDeg: number | null;
  occupancyChecked: number;
  occupancyMatches: number;
  occupancyBoundaryOrbNotes: string[];
  occupancyMismatches: string[];
  aspectsChecked: number;
  aspectsMatched: number;
  aspectMismatches: string[];
  notes: string[];
}

export function verifyWesternFrameDetailed(
  westData: WesternTropicalFrame,
  ref: IndependentAstroReference,
  secondPrecisionDropped: boolean
): WesternDetailedVerificationResult {
  const cuspsDeg = westData.houses.map((h) =>
    extractNumericDeg(h, ['abs_pos', 'absolute_degree', 'degree', 'cusp_degree', 'longitude'])
  );
  const validCusps = cuspsDeg.length === 12 && cuspsDeg.every((d) => Number.isFinite(d));
  const seq = validCusps
    ? verify12CuspSequence(cuspsDeg)
    : { monotonicSequential: false, totalSpanDeg: 0, maxOppositionErrorDeg: 999, spansDeg: [] };
  const cuspSequenceOk = seq.monotonicSequential && seq.maxOppositionErrorDeg < 0.05;

  // V1 drops seconds (up to 59s shift ≈ 0.25° on Asc/MC); scale angular tolerance gracefully
  const angleTolDeg = secondPrecisionDropped ? 0.6 : 0.35;

  const maxCuspRefDeltaDeg = validCusps
    ? Number(
        Math.max(
          ...cuspsDeg.map((d, i) => Math.abs(circularDiffDeg(d, ref.tropicalPlacidusCusps[i])))
        ).toFixed(4)
      )
    : null;

  const angles = westData.angles || {};
  const ascFromAngles = Number(
    (angles.ascendant && typeof angles.ascendant === 'object'
      ? (angles.ascendant as Record<string, unknown>).abs_pos ??
        (angles.ascendant as Record<string, unknown>).degree
      : angles.ascendant) ?? NaN
  );
  const ascDeg = Number.isFinite(ascFromAngles)
    ? normalizeDeg(ascFromAngles)
    : validCusps
    ? cuspsDeg[0]
    : NaN;
  const mcFromAngles = Number(
    (angles.mc && typeof angles.mc === 'object'
      ? (angles.mc as Record<string, unknown>).abs_pos ??
        (angles.mc as Record<string, unknown>).degree
      : angles.mc) ?? NaN
  );
  const mcDeg = Number.isFinite(mcFromAngles)
    ? normalizeDeg(mcFromAngles)
    : validCusps
    ? cuspsDeg[9]
    : NaN;

  const ascDeltaDeg = Number.isFinite(ascDeg)
    ? Number(Math.abs(circularDiffDeg(ascDeg, ref.tropicalAscendantDeg)).toFixed(4))
    : null;
  const mcDeltaDeg = Number.isFinite(mcDeg)
    ? Number(Math.abs(circularDiffDeg(mcDeg, ref.tropicalMcDeg)).toFixed(4))
    : null;

  const bodyLonMap = new Map<string, number>();
  if (Number.isFinite(ascDeg)) bodyLonMap.set('ascendant', ascDeg);
  if (Number.isFinite(mcDeg)) bodyLonMap.set('mc', mcDeg);
  if (Number.isFinite(ascDeg)) bodyLonMap.set('asc', ascDeg);
  if (Number.isFinite(mcDeg)) bodyLonMap.set('midheaven', mcDeg);

  for (const p of westData.planets) {
    const n = String(p.name || p.id || '').trim();
    const lon = extractNumericDeg(p, ['abs_pos', 'absolute_degree', 'degree', 'longitude']);
    if (n && Number.isFinite(lon)) {
      bodyLonMap.set(n.toLowerCase(), lon);
    }
  }

  const sunLon = bodyLonMap.get('sun');
  const moonLon = bodyLonMap.get('moon');
  const sunDeltaDeg =
    sunLon !== undefined
      ? Number(Math.abs(circularDiffDeg(sunLon, ref.tropicalSunLonDeg)).toFixed(4))
      : null;
  const moonDeltaDeg =
    moonLon !== undefined
      ? Number(Math.abs(circularDiffDeg(moonLon, ref.tropicalMoonLonDeg)).toFixed(4))
      : null;

  // Western Planetary Occupancy (Placidus Cusp Containment)
  let occupancyChecked = 0;
  let occupancyMatches = 0;
  const occupancyMismatches: string[] = [];
  const occupancyBoundaryOrbNotes: string[] = [];

  for (const p of westData.planets) {
    const name = String(p.name || p.id || '').trim();
    const lon = extractNumericDeg(p, ['abs_pos', 'absolute_degree', 'degree', 'longitude']);
    const reportedHouse = Number(p.house ?? NaN);
    if (!name || !Number.isFinite(lon) || !validCusps) continue;
    if (Number.isInteger(reportedHouse) && reportedHouse >= 1 && reportedHouse <= 12) {
      occupancyChecked++;
      const computedHouse = findOccupiedHouseInCusps(cuspsDeg, lon);
      if (computedHouse === reportedHouse) {
        occupancyMatches++;
      } else {
        // Check 5-degree Placidus pre-cusp orb (e.g., planet within 5° before cusp of reportedHouse)
        const targetCusp = cuspsDeg[reportedHouse - 1];
        const distBeforeTargetCusp = normalizeDeg(targetCusp - lon);
        if (distBeforeTargetCusp > 0 && distBeforeTargetCusp <= 5.05) {
          occupancyMatches++;
          occupancyBoundaryOrbNotes.push(
            `${name} (${distBeforeTargetCusp.toFixed(2)}° before H${reportedHouse} cusp) uses 5° Placidus pre-cusp rule.`
          );
        } else {
          occupancyMismatches.push(
            `${name}@${lon.toFixed(3)}° reported H${reportedHouse}, cusp containment=H${computedHouse}`
          );
        }
      }
    }
  }

  // Western Aspect Geometry Verification
  let aspectsChecked = 0;
  let aspectsMatched = 0;
  const aspectMismatches: string[] = [];
  for (const asp of westData.aspects) {
    const p1Name = String(asp.p1_name ?? asp.planet1 ?? asp.first ?? asp.p1 ?? '').trim().toLowerCase();
    const p2Name = String(asp.p2_name ?? asp.planet2 ?? asp.second ?? asp.p2 ?? '').trim().toLowerCase();
    const aspectName = String(asp.aspect ?? asp.type ?? asp.name ?? '').trim().toLowerCase();
    const nominalAngle =
      typeof asp.aspect_degrees === 'number'
        ? asp.aspect_degrees
        : ASPECT_NAME_TO_ANGLE[aspectName];
    const lon1 = bodyLonMap.get(p1Name);
    const lon2 = bodyLonMap.get(p2Name);
    if (lon1 === undefined || lon2 === undefined || nominalAngle === undefined) continue;

    aspectsChecked++;
    const actualSep = Math.abs(circularDiffDeg(lon1, lon2));
    const computedOrb = Math.abs(actualSep - nominalAngle);
    const reportedOrb = Number(asp.orb ?? NaN);
    if (Number.isFinite(reportedOrb) && Math.abs(computedOrb - reportedOrb) > 0.35) {
      aspectMismatches.push(
        `${p1Name}-${p2Name} ${aspectName}: computed orb=${computedOrb.toFixed(2)}° vs reported ${reportedOrb.toFixed(2)}°`
      );
    } else if (computedOrb > 12.5) {
      aspectMismatches.push(
        `${p1Name}-${p2Name} ${aspectName}: separation ${actualSep.toFixed(2)}° too far from ${nominalAngle}°`
      );
    } else {
      aspectsMatched++;
    }
  }

  const occupancyVerified = occupancyChecked > 0 && occupancyMismatches.length === 0;

  const passed =
    cuspSequenceOk &&
    (maxCuspRefDeltaDeg === null || maxCuspRefDeltaDeg <= angleTolDeg + 0.15) &&
    (ascDeltaDeg === null || ascDeltaDeg <= angleTolDeg) &&
    (mcDeltaDeg === null || mcDeltaDeg <= angleTolDeg) &&
    (sunDeltaDeg === null || sunDeltaDeg < 0.25) &&
    (moonDeltaDeg === null || moonDeltaDeg < 0.45) &&
    occupancyVerified &&
    aspectMismatches.length === 0;

  const notes: string[] = [
    `Western Tropical span=${seq.totalSpanDeg}°, maxCuspΔ=${maxCuspRefDeltaDeg ?? 'N/A'}°, ΔAsc=${ascDeltaDeg ?? 'N/A'}°, ΔMC=${mcDeltaDeg ?? 'N/A'}°, ΔSun=${sunDeltaDeg ?? 'N/A'}°, ΔMoon=${moonDeltaDeg ?? 'N/A'}° (tol=${angleTolDeg}°).`,
    `Occupancy=${occupancyMatches}/${occupancyChecked}; Aspects=${aspectsMatched}/${aspectsChecked} verified (mismatches=${aspectMismatches.length}).`,
    ...(occupancyChecked === 0
      ? ['Western Placidus house occupancy could not be verified (0/0 planets carried house field).']
      : []),
    ...occupancyBoundaryOrbNotes,
  ];

  return {
    passed,
    cuspSequenceOk,
    maxCuspRefDeltaDeg,
    ascDeltaDeg,
    mcDeltaDeg,
    sunDeltaDeg,
    moonDeltaDeg,
    occupancyChecked,
    occupancyMatches,
    occupancyBoundaryOrbNotes,
    occupancyMismatches,
    aspectsChecked,
    aspectsMatched,
    aspectMismatches,
    notes,
  };
}

export function verifyMasterChartRecord(
  master: LayerBMasterChartRecord,
  rawLayerA?: LayerARawProviderRecord | null
): MathematicalVerificationReport {
  const instant = master.canonicalBirthInstant;
  const isAstroWay = (master.providerId || rawLayerA?.providerId) === 'astroway';
  const providerDisplay = isAstroWay ? 'AstroWay V1' : 'FreeAstroAPI';
  const ref = computeIndependentAstronomicalReference(instant);
  const checks: VerificationCheckResult[] = [];

  const providerDataAcquired: EpistemicClassificationItem[] = [];
  const internalMathConsistencyVerified: EpistemicClassificationItem[] = [];
  const independentlyValidatedAgainstExternalReference: EpistemicClassificationItem[] = [];
  const methodologyUnresolved: EpistemicClassificationItem[] = [];
  const datasetUnavailable: EpistemicClassificationItem[] = [];

  // 1. UTC & Julian Day consistency (CosmicCouncil internal canonical solver)
  const expectedOffsetCheck =
    instant.utc.julianDayUt > 2400000 &&
    Math.abs(instant.utc.julianDayUt - ref.julianDayUt) < 1e-8;
  checks.push({
    id: 'utc_jd_consistency',
    domain: 'UTC & Julian Day',
    passed: expectedOffsetCheck,
    severity: 'critical',
    epistemicCategory: 'internal_math_consistency_verified',
    verificationBasis: 'cosmiccouncil_internal_solver',
    expected: `${instant.utc.iso} / JD=${ref.julianDayUt}`,
    observed: `${instant.utc.iso} / JD=${instant.utc.julianDayUt}`,
  });
  internalMathConsistencyVerified.push({
    key: 'canonical_utc_jd',
    label: 'Canonical UTC & Julian Day Conversion',
    category: 'internal_math_consistency_verified',
    verificationBasis: 'cosmiccouncil_internal_solver',
    status: expectedOffsetCheck ? 'verified' : 'unresolved',
    detail: `${instant.utc.iso} | JD=${instant.utc.julianDayUt} | TZ=${instant.timezone.ianaTimezone || `offset ${instant.timezone.historicalUtcOffsetHours}h`}`,
  });

  // 2. Mode A vs Mode B timezone equivalence (Provider self-consistency across all birth-instant outputs)
  if (rawLayerA?.timezoneEquivalenceCheck) {
    const eq = rawLayerA.timezoneEquivalenceCheck;
    const tzStatus =
      eq.status ||
      (eq.executed
        ? eq.equivalent
          ? 'verified_equivalent'
          : 'mathematical_verification_failed'
        : 'not_yet_tested');

    if (
      tzStatus === 'not_yet_tested' ||
      tzStatus === 'incomplete_due_to_rate_limit' ||
      tzStatus === 'incomplete_due_to_runtime_block'
    ) {
      const prefix =
        tzStatus === 'incomplete_due_to_rate_limit'
          ? '[RATE LIMITED]'
          : tzStatus === 'incomplete_due_to_runtime_block'
          ? '[RUNTIME BLOCKED]'
          : '[NOT YET TESTED]';
      datasetUnavailable.push({
        key: 'timezone_mode_a_vs_b_incomplete',
        label: `${prefix} Mode A (IANA) vs Mode B (UTC) Timezone Equivalence Probe`,
        category: 'dataset_unavailable',
        verificationBasis: 'none',
        status: 'unavailable',
        detail:
          eq.notes.join(' | ') ||
          `Probe incomplete (${tzStatus}); resume batch acquisition before evaluating timezone invariance.`,
      });
    } else {
      const sbNote = eq.shadbalaComparison?.available
        ? `Shadbala maxΔ=${eq.shadbalaComparison.maxTotalDeltaVirupas ?? 0}V`
        : 'Shadbala absent';
      const panNote = eq.panchangAudit?.available
        ? eq.panchangAudit.requestTimePanchangAvailable
          ? `BirthTimePanchang(request_time_panchang)=${String(eq.panchangAudit.requestTimePanchangEquivalent)} (dailyCalendarDiffs=${eq.panchangAudit.dailyCalendarDifferences.length})`
          : `Panchang nonClockErr=${eq.panchangAudit.nonClockMismatches.length}`
        : 'Panchang absent';
      const dashaNote = eq.dashaAudit?.available
        ? `Dasha durErr=${eq.dashaAudit.durationMismatches.length}, remΔ=${eq.dashaAudit.birthBalanceRemainingYearsDelta ?? 0}y, rolloverShifts=${eq.dashaAudit.calendarDateRolloverShifts.length}`
        : `DashaEq=${String(eq.dashaEquivalent)}`;

      checks.push({
        id: 'timezone_mode_a_vs_b',
        domain: 'Timezone Equivalence (Full Payload)',
        passed: eq.equivalent,
        severity: 'critical',
        epistemicCategory: eq.equivalent
          ? 'internal_math_consistency_verified'
          : 'methodology_unresolved',
        verificationBasis: 'provider_self_consistency',
        expected: 'Mode A (IANA) == Mode B (UTC) across coordinates, Shadbala, Bhava Chalit, Ashtakavarga, Vargas, Yogas, Dasha durations & birth-time Panchang',
        observed: `coordsEq=${eq.coordinatesEquivalent} (ascΔ=${eq.ascendantDeltaDeg}°, maxPlΔ=${eq.maxPlanetDeltaDeg}°); ${sbNote}; bhavaChalitEq=${String(eq.bhavaChalitEquivalent)}; AV_Eq=${String(eq.ashtakavargaEquivalent)}; ${dashaNote}; ${panNote}`,
        notes: eq.notes.join(' | '),
      });
      if (eq.equivalent) {
        internalMathConsistencyVerified.push({
          key: 'timezone_mode_a_vs_b',
          label: 'Provider Mode A (IANA) vs Mode B (UTC) Full Self-Consistency',
          category: 'internal_math_consistency_verified',
          verificationBasis: 'provider_self_consistency',
          status: 'verified',
          detail: eq.notes.join(' | '),
        });
      } else {
        methodologyUnresolved.push({
          key: 'timezone_mode_a_vs_b',
          label: 'Provider Mode A (IANA) vs Mode B (UTC) Timezone Invariance Failure',
          category: 'methodology_unresolved',
          verificationBasis: 'provider_self_consistency',
          status: 'unresolved',
          detail: eq.notes.join(' | '),
        });
      }
    }

    if (eq.panchangAudit?.available && eq.panchangAudit.requestTimePanchangAvailable) {
      const rtOk = Boolean(eq.panchangAudit.requestTimePanchangEquivalent);
      const panDetail = rtOk
        ? `panchang.request_time_panchang identical across Mode A & Mode B (${eq.panchangAudit.dailyCalendarDifferences.length} daily sunrise-date fields separated as calendar-date differences).`
        : `panchang.request_time_panchang mismatches: ${eq.panchangAudit.requestTimePanchangMismatches.join('; ')}`;
      checks.push({
        id: 'panchang_request_time_equivalence',
        domain: 'Natal Birth-Instant Panchang',
        passed: rtOk,
        severity: 'major',
        epistemicCategory: rtOk
          ? 'internal_math_consistency_verified'
          : 'methodology_unresolved',
        verificationBasis: 'provider_self_consistency',
        expected: 'panchang.request_time_panchang invariant across Mode A (IANA) and Mode B (UTC)',
        observed: panDetail,
      });
      (rtOk ? internalMathConsistencyVerified : methodologyUnresolved).push({
        key: 'panchang_request_time_equivalence',
        label: 'Natal Birth-Instant Panchang (panchang.request_time_panchang) Timezone Equivalence',
        category: rtOk ? 'internal_math_consistency_verified' : 'methodology_unresolved',
        verificationBasis: 'provider_self_consistency',
        status: rtOk ? 'verified' : 'unresolved',
        detail: panDetail,
      });
    }

    if (eq.dashaAudit?.available) {
      const durOk =
        eq.dashaAudit.durationMismatches.length === 0 &&
        eq.dashaAudit.structuralMismatches.length === 0;
      const balanceOk =
        eq.dashaAudit.birthBalanceRemainingYearsDelta === null ||
        eq.dashaAudit.birthBalanceRemainingYearsDelta <= 0.001;
      const dashaDetail = `lordMatch=${eq.dashaAudit.birthBalanceLordMatch}, remaining_yearsΔ=${eq.dashaAudit.birthBalanceRemainingYearsDelta ?? 0}y (${eq.dashaAudit.isSingleCalendarDayRolloverBalanceArtifact ? '1-day calendar-date rollover balance artifact' : 'exact/other'}), rolloverShifts=${eq.dashaAudit.calendarDateRolloverShifts.length}, durationMismatches=${eq.dashaAudit.durationMismatches.length}.`;
      checks.push({
        id: 'vimshottari_dasha_timezone_audit',
        domain: 'Vimshottari Dasha Timezone Audit',
        passed: durOk && balanceOk,
        severity: 'info',
        epistemicCategory: durOk && balanceOk
          ? 'internal_math_consistency_verified'
          : 'methodology_unresolved',
        verificationBasis: 'provider_self_consistency',
        expected: 'Mahadasha durations and birth_balance identical across Mode A & Mode B',
        observed: dashaDetail,
        notes: eq.dashaAudit.notes.join(' | ') || undefined,
      });
      if (durOk && !balanceOk) {
        methodologyUnresolved.push({
          key: 'vimshottari_birth_balance_rollover_artifact',
          label: 'Vimshottari Birth Balance ~1-Day Calendar Rollover Discrepancy',
          category: 'methodology_unresolved',
          verificationBasis: 'provider_self_consistency',
          status: 'partial',
          detail: dashaDetail,
        });
      }
    }
  }

  // 3. CosmicCouncil internal Solar/Lunar & Placidus reference solver check (Bucket 2, NOT external JHora)
  const refKpSeq = verify12CuspSequence(ref.kpPlacidusCuspsDeg);
  const refTropSeq = verify12CuspSequence(ref.tropicalPlacidusCusps);
  const refSeqPassed =
    refKpSeq.monotonicSequential &&
    refTropSeq.monotonicSequential &&
    refKpSeq.maxOppositionErrorDeg < 0.02;
  checks.push({
    id: 'independent_placidus_sequence',
    domain: 'CosmicCouncil Internal Solver',
    passed: refSeqPassed,
    severity: 'critical',
    epistemicCategory: 'internal_math_consistency_verified',
    verificationBasis: 'cosmiccouncil_internal_solver',
    expected: 'Monotonic 12 cusps summing to 360°, opposite cusps 180° ± 0.02°',
    observed: `KP span=${refKpSeq.totalSpanDeg}° oppErr=${refKpSeq.maxOppositionErrorDeg}°; Trop span=${refTropSeq.totalSpanDeg}°`,
  });
  internalMathConsistencyVerified.push({
    key: 'independent_astronomical_solver',
    label: 'CosmicCouncil Internal Meeus Solar/Lunar & Placidus Solver',
    category: 'internal_math_consistency_verified',
    verificationBasis: 'cosmiccouncil_internal_solver',
    status: refSeqPassed ? 'verified' : 'unresolved',
    detail: `Lahiri Asc=${ref.lahiriAscendantDeg}°, Sun=${ref.lahiriSunLonDeg}°, Moon=${ref.lahiriMoonLonDeg}°; Placidus span=${refKpSeq.totalSpanDeg}°`,
  });

  // Track Endpoint 1: Vedic Lahiri
  const vedicData = master.frames.vedicLahiri.data;
  if (vedicData) {
    providerDataAcquired.push({
      key: 'provider_vedic_calculate',
      label: isAstroWay
        ? 'AstroWay V1 Vedic Lahiri (/chart + /vedic/kundli + Vargas)'
        : 'FreeAstroAPI V2 Vedic Lahiri (/api/v2/vedic/calculate)',
      category: 'provider_data_acquired',
      verificationBasis: 'provider_payload',
      status: master.frames.vedicLahiri.completeness === 'complete' ? 'verified' : 'partial',
      detail: `${vedicData.planets.length} planets, ${vedicData.vargas?.supportedCount ?? 0} Vargas, ${vedicData.yogas?.items.length ?? 0} Yogas, Ashtakavarga=${vedicData.ashtakavarga ? 'yes' : 'no'}, Dasha=${vedicData.vimshottariDasha ? 'yes' : 'no'}`,
    });

    // 4. Lahiri Ascendant, Sun & Moon vs CosmicCouncil internal reference solver (Bucket 2)
    const ascDeg = Number(vedicData.ascendant?.degree);
    const sunDeg = Number(
      vedicData.planets.find((p) => String(p.name) === 'Sun')?.absolute_degree
    );
    const moonDeg = Number(
      vedicData.planets.find((p) => String(p.name) === 'Moon')?.absolute_degree
    );
    const ascErr = Number.isFinite(ascDeg)
      ? Math.abs(circularDiffDeg(ascDeg, ref.lahiriAscendantDeg))
      : 999;
    const sunErr = Number.isFinite(sunDeg)
      ? Math.abs(circularDiffDeg(sunDeg, ref.lahiriSunLonDeg))
      : 999;
    const moonErr = Number.isFinite(moonDeg)
      ? Math.abs(circularDiffDeg(moonDeg, ref.lahiriMoonLonDeg))
      : 999;

    const lahiriRefPassed = ascErr < 0.25 && sunErr < 0.15 && moonErr < 0.35;
    checks.push({
      id: 'lahiri_asc_sun_moon_vs_reference',
      domain: 'Vedic Lahiri Positions',
      passed: lahiriRefPassed,
      severity: 'critical',
      epistemicCategory: lahiriRefPassed
        ? 'internal_math_consistency_verified'
        : 'methodology_unresolved',
      verificationBasis: 'cosmiccouncil_internal_solver',
      expected: `Asc~${ref.lahiriAscendantDeg}°, Sun~${ref.lahiriSunLonDeg}°, Moon~${ref.lahiriMoonLonDeg}°`,
      observed: `Asc=${ascDeg}° (Δ${ascErr.toFixed(3)}°), Sun=${sunDeg}° (Δ${sunErr.toFixed(3)}°), Moon=${moonDeg}° (Δ${moonErr.toFixed(3)}°)`,
    });
    (lahiriRefPassed ? internalMathConsistencyVerified : methodologyUnresolved).push({
      key: 'lahiri_asc_sun_moon_vs_reference',
      label: 'Vedic Lahiri Ascendant, Sun & Moon vs Internal Reference Solver',
      category: lahiriRefPassed ? 'internal_math_consistency_verified' : 'methodology_unresolved',
      verificationBasis: 'cosmiccouncil_internal_solver',
      status: lahiriRefPassed ? 'verified' : 'unresolved',
      detail: `ΔAsc=${ascErr.toFixed(3)}°, ΔSun=${sunErr.toFixed(3)}°, ΔMoon=${moonErr.toFixed(3)}°`,
    });

    // 5. Vargas completeness + D4 alternate longitudes & D5 calibrated:false audit
    const vargaKeys = vedicData.vargas?.divisionsReturned || [];
    const hasD5 = vargaKeys.some((k) => k.toUpperCase() === 'D5' || k === '5');
    const vargasOk = isAstroWay ? vargaKeys.length >= 16 : vargaKeys.length >= 17 && hasD5;
    checks.push({
      id: 'vargas_17_completeness',
      domain: 'Divisional Charts',
      passed: vargasOk,
      severity: 'major',
      epistemicCategory: 'provider_data_acquired',
      verificationBasis: 'provider_payload',
      expected: isAstroWay
        ? '16 BPHS Shodashavarga Vargas (D1–D60; D5 absent in AstroWay v2.383.19)'
        : '17 Vargas including D5',
      observed: `${vargaKeys.length} Vargas (${vargaKeys.join(',')})`,
    });

    const vargaAudit = auditVargasMethodology(vedicData);
    const d4BphsClean =
      !vargaAudit.d4Audit.present || vargaAudit.d4Audit.signMismatchesVsBphs.length === 0;
    const d5Uncalibrated = vargaAudit.d5Audit.calibrated === false;
    checks.push({
      id: 'vargas_d4_d5_methodology_audit',
      domain: 'Divisional Chart Methodology (D4/D5)',
      passed: d4BphsClean && vargaAudit.uncalibratedDivisions.length === 0,
      severity: 'info',
      epistemicCategory: 'methodology_unresolved',
      verificationBasis: 'cosmiccouncil_internal_solver',
      expected: 'All divisions calibrated and matching BPHS quadrant rules',
      observed: `D4 BPHS matches=${vargaAudit.d4Audit.matchesBphsQuadrantJumpCount}/${vargaAudit.d4Audit.checkedBodiesCount}, D4 altSources=${vargaAudit.d4Audit.hasAlternateSourceLongitudes}, uncalibrated=[${vargaAudit.uncalibratedDivisions.map((u) => u.division).join(',')}]`,
      notes: [
        ...vargaAudit.d4Audit.alternateSourceNotes,
        ...vargaAudit.d4Audit.signMismatchesVsBphs,
        ...vargaAudit.d5Audit.notes,
      ].join(' | '),
    });

    if (vargaAudit.d4Audit.present) {
      if (d4BphsClean && !vargaAudit.d4Audit.hasAlternateSourceLongitudes) {
        internalMathConsistencyVerified.push({
          key: 'varga_d4_bphs_consistency',
          label: 'D4 (Chaturthamsha) BPHS Quadrant Mapping',
          category: 'internal_math_consistency_verified',
          verificationBasis: 'cosmiccouncil_internal_solver',
          status: 'verified',
          detail: `${vargaAudit.d4Audit.matchesBphsQuadrantJumpCount}/${vargaAudit.d4Audit.checkedBodiesCount} bodies match BPHS (sign+part*3)%12; profile=${vargaAudit.d4Audit.profileOrMethod || 'auto'}.`,
        });
      } else {
        methodologyUnresolved.push({
          key: 'varga_d4_methodology_notes',
          label: 'D4 (Chaturthamsha) Profile / Alternate Source Longitudes',
          category: 'methodology_unresolved',
          verificationBasis: 'cosmiccouncil_internal_solver',
          status: 'unresolved',
          detail: [
            `profile=${vargaAudit.d4Audit.profileOrMethod || 'auto'}`,
            `BPHS sign matches=${vargaAudit.d4Audit.matchesBphsQuadrantJumpCount}/${vargaAudit.d4Audit.checkedBodiesCount}`,
            vargaAudit.d4Audit.continuousCyclicMatchesInsteadCount > 0
              ? `cyclic (lon*4)%360 matches=${vargaAudit.d4Audit.continuousCyclicMatchesInsteadCount}`
              : null,
            ...vargaAudit.d4Audit.alternateSourceNotes,
            ...vargaAudit.d4Audit.signMismatchesVsBphs.slice(0, 3),
          ]
            .filter(Boolean)
            .join(' | '),
        });
      }
    }

    if (!hasD5) {
      datasetUnavailable.push({
        key: 'varga_d5_missing',
        label: 'D5 (Panchamsha) Divisional Chart',
        category: 'dataset_unavailable',
        verificationBasis: 'none',
        status: 'unavailable',
        detail: `Provider returned ${vargaKeys.length} Vargas without D5.`,
      });
    } else if (d5Uncalibrated || vargaAudit.uncalibratedDivisions.length > 0) {
      methodologyUnresolved.push({
        key: 'varga_d5_uncalibrated',
        label: 'D5 (Panchamsha) Marked calibrated:false by Provider',
        category: 'methodology_unresolved',
        verificationBasis: 'provider_payload',
        status: 'unresolved',
        detail: `${vargaAudit.d5Audit.notes.join(' ')} Uncalibrated divisions: ${vargaAudit.uncalibratedDivisions.map((u) => u.division).join(', ') || 'D5'}.`,
      });
    }

    // 6. Ashtakavarga Prasthara -> BAV -> SAV = 337 check
    const av = vedicData.ashtakavarga;
    if (av) {
      const savSum = av.sarvashtakavarga.reduce((a, b) => a + Number(b || 0), 0);
      let bavErrors = 0;
      let prastharaErrors = 0;
      for (let i = 0; i < 12; i++) {
        const col = Object.values(av.bhinnashtakavarga).reduce(
          (s, row) => s + Number(row[i] || 0),
          0
        );
        if (col !== Number(av.sarvashtakavarga[i])) bavErrors++;
      }
      for (const [pl, row] of Object.entries(av.bhinnashtakavarga)) {
        const mat = av.prastharashtakavarga[pl];
        if (!mat) {
          prastharaErrors += 12;
          continue;
        }
        for (let i = 0; i < 12; i++) {
          const sumCell = Object.values(mat).reduce((s, c) => s + Number(c[i] || 0), 0);
          if (sumCell !== Number(row[i])) prastharaErrors++;
        }
      }
      const avPassed = savSum === 337 && bavErrors === 0 && prastharaErrors === 0;
      checks.push({
        id: 'ashtakavarga_matrix_consistency',
        domain: 'Ashtakavarga',
        passed: avPassed,
        severity: 'critical',
        epistemicCategory: 'internal_math_consistency_verified',
        verificationBasis: 'provider_self_consistency',
        expected: 'SAV=337, 0 BAV mismatches, 0 Prasthara mismatches',
        observed: `SAV=${savSum}, bavErrors=${bavErrors}, prastharaErrors=${prastharaErrors}`,
      });
      internalMathConsistencyVerified.push({
        key: 'ashtakavarga_matrix',
        label: 'Ashtakavarga Prasthara -> BAV -> SAV (337)',
        category: 'internal_math_consistency_verified',
        verificationBasis: 'provider_self_consistency',
        status: avPassed ? 'verified' : 'unresolved',
        detail: `SAV=${savSum}, BAV mismatches=${bavErrors}, Prasthara mismatches=${prastharaErrors}`,
      });
    }

    // 7. Vimshottari balance & period sum check
    const dasha = vedicData.vimshottariDasha;
    if (dasha && typeof dasha.birth_balance === 'object' && dasha.birth_balance) {
      const bb = dasha.birth_balance as Record<string, unknown>;
      const fullY = Number(bb.full_duration_years ?? 0);
      const elY = Number(bb.elapsed_years ?? 0);
      const remY = Number(bb.remaining_years ?? 0);
      const balanceSumOk = fullY > 0 && Math.abs(elY + remY - fullY) < 0.02;
      checks.push({
        id: 'vimshottari_balance_consistency',
        domain: 'Vimshottari Dasha',
        passed: balanceSumOk,
        severity: 'major',
        epistemicCategory: 'internal_math_consistency_verified',
        verificationBasis: 'provider_self_consistency',
        expected: 'elapsed_years + remaining_years == full_duration_years',
        observed: `${elY} + ${remY} vs ${fullY}`,
      });
      internalMathConsistencyVerified.push({
        key: 'vimshottari_balance',
        label: 'Vimshottari Birth Balance Sum',
        category: 'internal_math_consistency_verified',
        verificationBasis: 'provider_self_consistency',
        status: balanceSumOk ? 'verified' : 'unresolved',
        detail: `${elY} + ${remY} vs ${fullY} years`,
      });
    }

    // 8. Panchang sunrise/sunset & natal request_time_panchang presence check
    if (vedicData.panchang) {
      const hasSunTimes = Boolean(vedicData.panchang.sunrise && vedicData.panchang.sunset);
      const hasRequestTimePanchang = Boolean(
        vedicData.panchang.request_time_panchang &&
          typeof vedicData.panchang.request_time_panchang === 'object'
      );
      checks.push({
        id: 'panchang_sunrise_sunset_present',
        domain: 'Panchang',
        passed: hasSunTimes,
        severity: 'major',
        epistemicCategory: 'provider_data_acquired',
        verificationBasis: 'provider_payload',
        expected: 'Provider daily sunrise/sunset + natal request_time_panchang present',
        observed: `sunrise=${vedicData.panchang.sunrise}, sunset=${vedicData.panchang.sunset}, request_time_panchang=${hasRequestTimePanchang ? 'present' : 'absent'}`,
      });
    }
  } else {
    datasetUnavailable.push({
      key: 'provider_vedic_calculate',
      label: 'Vedic Lahiri Frame (/api/v2/vedic/calculate)',
      category: 'dataset_unavailable',
      verificationBasis: 'none',
      status: 'unavailable',
      detail: master.frames.vedicLahiri.limitations.join(' ') || 'Endpoint unavailable or not executed.',
    });
  }

  // Track Endpoint 2: KP Frame cusps, coordinates, occupancy & 4-level significators
  const kpData = master.frames.kpPlacidus.data;
  if (kpData) {
    providerDataAcquired.push({
      key: 'provider_vedic_kp',
      label: isAstroWay
        ? 'AstroWay V1 KP Placidus (/vedic/kp/*)'
        : 'FreeAstroAPI V2 Dedicated KP (/api/v2/vedic/kp)',
      category: 'provider_data_acquired',
      verificationBasis: 'provider_payload',
      status: master.frames.kpPlacidus.completeness === 'complete' ? 'verified' : 'partial',
      detail: `${kpData.cusps.length} cusps, ${kpData.planets.length} planets, ayanamsha=${kpData.ayanamsha.name} (${kpData.ayanamsha.valueDegrees ?? 'N/A'}°)`,
    });

    const kpDetail = verifyKpFrameDetailed(kpData, ref);

    checks.push({
      id: 'kp_12_cusp_sequence',
      domain: 'KP Placidus Cusps',
      passed: kpDetail.cuspSequenceOk,
      severity: 'critical',
      epistemicCategory: 'internal_math_consistency_verified',
      verificationBasis: 'provider_self_consistency',
      expected: '12 strictly monotonic KP Placidus cusps summing to 360°',
      observed: kpDetail.notes[0],
    });
    internalMathConsistencyVerified.push({
      key: 'kp_12_cusp_sequence',
      label: 'KP Placidus 12-Cusp Monotonic Order & 180° Opposition',
      category: 'internal_math_consistency_verified',
      verificationBasis: 'provider_self_consistency',
      status: kpDetail.cuspSequenceOk ? 'verified' : 'unresolved',
      detail: kpDetail.notes[0],
    });

    const kpGeomAndSignificatorsOk =
      (kpDetail.maxCuspRefDeltaDeg === null || kpDetail.maxCuspRefDeltaDeg < 0.45) &&
      kpDetail.cuspLordMismatches.length === 0 &&
      kpDetail.occupancyChecked > 0 &&
      kpDetail.occupancyMismatches.length === 0 &&
      kpDetail.significatorInconsistencies.length === 0;

    checks.push({
      id: 'kp_cusps_occupancy_significators',
      domain: 'KP Geometry, Occupancy & Significators',
      passed: kpGeomAndSignificatorsOk,
      severity: 'critical',
      epistemicCategory: kpGeomAndSignificatorsOk
        ? 'internal_math_consistency_verified'
        : 'methodology_unresolved',
      verificationBasis: 'cosmiccouncil_internal_solver',
      expected: 'KP cusps/planets match internal Placidus KP ref; 100% cusp containment; 4-level significators consistent',
      observed: kpDetail.notes.join(' | '),
      notes: [
        ...kpDetail.cuspLordMismatches,
        ...kpDetail.occupancyMismatches,
        ...kpDetail.significatorInconsistencies,
      ].join('; ') || undefined,
    });

    (kpGeomAndSignificatorsOk
      ? internalMathConsistencyVerified
      : methodologyUnresolved
    ).push({
      key: 'kp_cusps_vs_reference',
      label: 'KP Cusps, Planetary Occupancy & 4-Level Significators vs Internal Solver',
      category: kpGeomAndSignificatorsOk
        ? 'internal_math_consistency_verified'
        : 'methodology_unresolved',
      verificationBasis: 'cosmiccouncil_internal_solver',
      status: kpGeomAndSignificatorsOk ? 'verified' : 'unresolved',
      detail: `${kpDetail.notes.join(' ')}${
        kpDetail.significatorInconsistencies.length
          ? ` Issues: ${kpDetail.significatorInconsistencies.slice(0, 3).join('; ')}`
          : ''
      }`,
    });
  } else {
    datasetUnavailable.push({
      key: 'provider_vedic_kp',
      label: 'KP Placidus Frame (/api/v2/vedic/kp)',
      category: 'dataset_unavailable',
      verificationBasis: 'none',
      status: 'unavailable',
      detail: master.frames.kpPlacidus.limitations.join(' ') || 'Endpoint unavailable or not executed.',
    });
  }

  // Track Frame 3: Bhava Chalit methodology verification (Bucket 2 internal Sripati solver)
  const bcData = master.frames.bhavaChalit.data;
  if (bcData) {
    providerDataAcquired.push({
      key: 'provider_bhava_chalit',
      label: `${providerDisplay} Bhava Chalit Frame`,
      category: 'provider_data_acquired',
      verificationBasis: 'provider_payload',
      status: bcData.houses.length === 12 ? 'verified' : 'partial',
      detail: `house_basis=${bcData.houseBasis || 'unspecified'}, calibrated=${String(bcData.calibrated)}`,
    });

    const bcCompat = bcData.methodologyAudit.compatibleWithIntendedClassicalMethodology;
    checks.push({
      id: 'bhava_chalit_methodology',
      domain: 'Bhava Chalit',
      passed: bcCompat,
      severity: 'major',
      epistemicCategory: bcCompat
        ? 'internal_math_consistency_verified'
        : 'methodology_unresolved',
      verificationBasis: 'cosmiccouncil_internal_solver',
      expected: 'Midpoint-straddled boundaries matching classical Sripati within 1°',
      observed: bcData.methodologyAudit.notes.join(' | '),
    });
    if (bcCompat) {
      internalMathConsistencyVerified.push({
        key: 'bhava_chalit_sripati',
        label: 'Bhava Chalit vs Internal Classical Sripati Solver',
        category: 'internal_math_consistency_verified',
        verificationBasis: 'cosmiccouncil_internal_solver',
        status: 'verified',
        detail: bcData.methodologyAudit.notes.join(' | '),
      });
    } else {
      methodologyUnresolved.push({
        key: 'bhava_chalit_methodology',
        label: 'Bhava Chalit Methodology Divergence',
        category: 'methodology_unresolved',
        verificationBasis: 'cosmiccouncil_internal_solver',
        status: 'unresolved',
        detail: bcData.methodologyAudit.notes.join(' | '),
      });
    }
  } else {
    datasetUnavailable.push({
      key: 'provider_bhava_chalit',
      label: 'Bhava Chalit Frame',
      category: 'dataset_unavailable',
      verificationBasis: 'none',
      status: 'unavailable',
      detail: master.frames.bhavaChalit.limitations.join(' ') || 'Bhava Chalit frame unavailable.',
    });
  }

  // Track Endpoint 3: Western Tropical sequence, angles, occupancy & aspects
  const westData = master.frames.westernTropical.data;
  if (westData) {
    providerDataAcquired.push({
      key: 'provider_western_natal',
      label: isAstroWay
        ? 'AstroWay V1 Western Tropical (/chart zodiacType=tropical)'
        : 'FreeAstroAPI V1 Western Tropical (/api/v1/natal/calculate)',
      category: 'provider_data_acquired',
      verificationBasis: 'provider_payload',
      status: master.frames.westernTropical.completeness === 'complete' ? 'verified' : 'partial',
      detail: `${westData.planets.length} bodies, ${westData.houses.length} Placidus cusps, ${westData.aspects.length} aspects`,
    });

    const westDetail = verifyWesternFrameDetailed(
      westData,
      ref,
      westData.secondPrecisionDroppedByV1Endpoint
    );

    checks.push({
      id: 'western_placidus_cusp_sequence',
      domain: 'Western Placidus Cusps',
      passed: westDetail.cuspSequenceOk,
      severity: 'critical',
      epistemicCategory: 'internal_math_consistency_verified',
      verificationBasis: 'provider_self_consistency',
      expected: '12 monotonic Tropical Placidus cusps independent of KP',
      observed: westDetail.notes[0],
    });
    internalMathConsistencyVerified.push({
      key: 'western_placidus_cusp_sequence',
      label: 'Western Placidus 12-Cusp Monotonic Order & 180° Opposition',
      category: 'internal_math_consistency_verified',
      verificationBasis: 'provider_self_consistency',
      status: westDetail.cuspSequenceOk ? 'verified' : 'unresolved',
      detail: westDetail.notes[0],
    });

    checks.push({
      id: 'western_angles_occupancy_aspects',
      domain: 'Western Angles, Occupancy & Aspects',
      passed: westDetail.passed,
      severity: 'critical',
      epistemicCategory: westDetail.passed
        ? 'internal_math_consistency_verified'
        : 'methodology_unresolved',
      verificationBasis: 'cosmiccouncil_internal_solver',
      expected: 'Tropical Sun/Moon/Asc/MC/Cusps match internal Placidus ref; Placidus occupancy & aspect orbs valid',
      observed: westDetail.notes.join(' | '),
      notes: [...westDetail.occupancyMismatches, ...westDetail.aspectMismatches].join('; ') || undefined,
    });
    (westDetail.passed ? internalMathConsistencyVerified : methodologyUnresolved).push({
      key: 'western_angles_occupancy_aspects',
      label: 'Western Tropical Angles, Placidus Occupancy & Aspect Orbs vs Internal Solver',
      category: westDetail.passed ? 'internal_math_consistency_verified' : 'methodology_unresolved',
      verificationBasis: 'cosmiccouncil_internal_solver',
      status: westDetail.passed ? 'verified' : 'unresolved',
      detail: westDetail.notes.join(' | '),
    });

    if (westData.secondPrecisionDroppedByV1Endpoint) {
      methodologyUnresolved.push({
        key: 'western_v1_seconds_truncation',
        label: 'Western V1 Birth-Time Second Precision Truncated',
        category: 'methodology_unresolved',
        verificationBasis: 'provider_payload',
        status: 'partial',
        detail: `Request 3 (/api/v1/natal/calculate) omits "second" parameter; ${instant.input.second}s truncated in Western response.`,
      });
    }
  } else {
    datasetUnavailable.push({
      key: 'provider_western_natal',
      label: 'Western Tropical Frame (/api/v1/natal/calculate)',
      category: 'dataset_unavailable',
      verificationBasis: 'none',
      status: 'unavailable',
      detail: master.frames.westernTropical.limitations.join(' ') || 'Endpoint unavailable or not executed.',
    });
  }

  // Track Endpoint 4: Astronomical Telemetry
  const ephData = master.frames.astronomicalTelemetry.data;
  if (ephData) {
    providerDataAcquired.push({
      key: 'provider_ephemeris',
      label: isAstroWay
        ? 'AstroWay V1 Astronomical Telemetry (/chart sidereal fields)'
        : 'FreeAstroAPI V1 Ephemeris (/api/v1/ephemeris/calculate)',
      category: 'provider_data_acquired',
      verificationBasis: 'provider_payload',
      status: master.frames.astronomicalTelemetry.completeness === 'complete' ? 'verified' : 'partial',
      detail: `${Object.keys(ephData.bodies).length} celestial bodies with speed, latitude & distance_au`,
    });

    if (ephData.timestampVerification) {
      const tv = ephData.timestampVerification;
      const utcPresent = tv.utcTimestampPresent ?? Boolean(tv.returnedUtcInstant);
      const tsOk = utcPresent && tv.exactTimestampMatch;
      checks.push({
        id: 'ephemeris_timestamp_verification',
        domain: 'Ephemeris Timestamp',
        passed: tsOk,
        severity: 'major',
        epistemicCategory: tsOk
          ? 'internal_math_consistency_verified'
          : 'methodology_unresolved',
        verificationBasis: 'cosmiccouncil_internal_solver',
        expected: `${tv.expectedUtcIso} / JD=${tv.expectedJulianDayUt}`,
        observed: `${tv.returnedUtcInstant ?? 'missing (returnedUtcInstant=null)'} / JD=${tv.returnedJulianDay ?? 'N/A'} / Δ=${tv.deltaSecondsFromCanonical ?? 'N/A'}s`,
        notes: tv.limitationNotes.join(' | '),
      });
      (tsOk ? internalMathConsistencyVerified : methodologyUnresolved).push({
        key: 'ephemeris_timestamp_verification',
        label: 'Ephemeris Timestamp & Julian Day Match vs Canonical Solver',
        category: tsOk ? 'internal_math_consistency_verified' : 'methodology_unresolved',
        verificationBasis: 'cosmiccouncil_internal_solver',
        status: tsOk ? 'verified' : 'unresolved',
        detail: utcPresent
          ? `Canonical ${tv.expectedUtcIso} vs returned ${tv.returnedUtcInstant ?? 'N/A'} (Δ=${tv.deltaSecondsFromCanonical ?? 'N/A'}s)`
          : `Provider returned julianDay=${tv.returnedJulianDay ?? 'N/A'} without explicit returnedUtcInstant string (UTC timestamp absent).`,
      });

      if (!tsOk && tv.julianDayMatch) {
        checks.push({
          id: 'ephemeris_julian_day_verification',
          domain: 'Ephemeris Julian Day',
          passed: true,
          severity: 'major',
          epistemicCategory: 'internal_math_consistency_verified',
          verificationBasis: 'cosmiccouncil_internal_solver',
          expected: `JD=${tv.expectedJulianDayUt}`,
          observed: `JD=${tv.returnedJulianDay} (Δ=${tv.deltaSecondsFromCanonical ?? 0}s)`,
        });
        internalMathConsistencyVerified.push({
          key: 'ephemeris_julian_day_verification',
          label: 'Ephemeris Numeric Julian Day Match vs Canonical Solver',
          category: 'internal_math_consistency_verified',
          verificationBasis: 'cosmiccouncil_internal_solver',
          status: 'verified',
          detail: `Returned JD=${tv.returnedJulianDay} matches canonical JD=${tv.expectedJulianDayUt} (Δ=${tv.deltaSecondsFromCanonical ?? 0}s).`,
        });
      }
    }
  } else {
    datasetUnavailable.push({
      key: 'provider_ephemeris',
      label: 'Astronomical Ephemeris Frame (/api/v1/ephemeris/calculate)',
      category: 'dataset_unavailable',
      verificationBasis: 'none',
      status: 'unavailable',
      detail:
        master.frames.astronomicalTelemetry.limitations.join(' ') ||
        'Endpoint unavailable or not executed.',
    });
  }

  // 12. Shadbala component sum & reconciliation check (Requirement #6: never prematurely designate authoritative)
  const sb = master.shadbalaReconciliation.data;
  if (sb) {
    const providerSumErr = sb.perPlanet.filter(
      (r) => r.provider && Math.abs(r.provider.componentSumCheckDelta) > 0.2
    ).length;
    checks.push({
      id: 'shadbala_sum_integrity',
      domain: 'Shadbala Reconciliation',
      passed: providerSumErr === 0,
      severity: 'major',
      epistemicCategory: 'internal_math_consistency_verified',
      verificationBasis: 'provider_self_consistency',
      expected: 'All provider Shadbala components sum to total Virupas',
      observed: `sumErrors=${providerSumErr}, authoritativeDesignation=${sb.authoritativeDesignation}`,
    });
    if (sb.perPlanet.some((p) => p.provider)) {
      internalMathConsistencyVerified.push({
        key: 'shadbala_component_sum',
        label: 'Provider Shadbala 6-Bala Component Sum',
        category: 'internal_math_consistency_verified',
        verificationBasis: 'provider_self_consistency',
        status: providerSumErr === 0 ? 'verified' : 'unresolved',
        detail: `${sb.perPlanet.length - providerSumErr}/${sb.perPlanet.length} planets sum cleanly within 0.2V.`,
      });
    }
    methodologyUnresolved.push({
      key: 'shadbala_authoritative_source',
      label: 'Shadbala Authoritative Model & Subcomponents',
      category: 'methodology_unresolved',
      verificationBasis: 'pending_external_validation',
      status: 'unresolved',
      detail: isAstroWay
        ? `Designation remains "${sb.authoritativeDesignation}". AstroWay provides all 6 Shadbala subcomponent modules, Ishta/Kashta (x-quality=yellow), and Bhavabala (x-quality=yellow), while Vimshopaka Bala & Panchadha Maitri remain absent; external JHora/PyJHora validation remains pending.`
        : `Designation remains "${sb.authoritativeDesignation}". Provider omits subcomponents; Sun 5.0 vs 6.5 threshold (${sb.sunThresholdInvestigation.flipsPassFailStatus ? 'flips pass/fail' : 'investigated'}) and Legacy Local vs Provider Virupa deltas require independent JHora/PyJHora cross-check.`,
    });
  }

  // AstroWay extended classical datasets epistemic classification
  if (isAstroWay && rawLayerA?.calls) {
    const awCalls = Object.values(rawLayerA.calls).filter(
      (c) => c.category !== 'timezone_probe'
    );
    const byCat = new Map<string, { ok: number; total: number }>();
    for (const c of awCalls) {
      const cat = c.category || 'other';
      const entry = byCat.get(cat) || { ok: 0, total: 0 };
      entry.total++;
      if (c.ok) entry.ok++;
      byCat.set(cat, entry);
    }

    const catLabels: Record<string, string> = {
      shadbala: 'AstroWay Shadbala + 6 Subcomponents + Ishta/Kashta',
      bhavabala: 'AstroWay Bhavabala (/vedic/bhavabala)',
      ashtakavarga: 'AstroWay Ashtakavarga + Prastara + Shodhana',
      jaimini: 'AstroWay Jaimini System (Karakas, Padas, Upapada, Aspects, Argala, Yogas)',
      yoga_dosha: 'AstroWay Parashara/Jaimini/KP Yogas & Doshas',
      upagraha: 'AstroWay Upagrahas (/vedic/upagrahas)',
      dasha: 'AstroWay 6 Dasha Systems (Vimshottari Prana, Chara, Yogini, Ashtottari, Kalachakra, Tribhagi)',
      hellenistic_traditional: 'AstroWay Western Traditional & Hellenistic (Dignities, Firdaria, Profections, Lots, ZR)',
    };

    for (const [cat, label] of Object.entries(catLabels)) {
      const counts = byCat.get(cat);
      if (counts && counts.ok > 0) {
        providerDataAcquired.push({
          key: `astroway_cat_${cat}`,
          label,
          category: 'provider_data_acquired',
          verificationBasis: 'provider_payload',
          status: counts.ok === counts.total ? 'verified' : 'partial',
          detail: `${counts.ok}/${counts.total} endpoint(s) returned HTTP 200.`,
        });
      }
    }

    // Verify Kala Bala subcomponent sum against Kala Bala total if both acquired
    const kalaCall = rawLayerA.calls.shadbala_kala;
    const fullCall = rawLayerA.calls.shadbala_full;
    if (kalaCall?.ok && fullCall?.ok) {
      const kData = (kalaCall.rawResponse as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
      const fData = (fullCall.rawResponse as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
      const kItems = Array.isArray(kData?.items) ? (kData!.items as Array<Record<string, unknown>>) : [];
      const fItems = Array.isArray(fData?.items) ? (fData!.items as Array<Record<string, unknown>>) : [];
      let mismatches = 0;
      for (const kRow of kItems) {
        const subSum =
          Number(kRow.nathonnatha ?? 0) +
          Number(kRow.paksha ?? 0) +
          Number(kRow.tribhaga ?? 0) +
          Number(kRow.abdaMasaVaraHora ?? 0) +
          Number(kRow.ayana ?? 0) +
          Number(kRow.yuddha ?? 0);
        const fRow = fItems.find(
          (f) => String(f.planetName || '').toLowerCase() === String(kRow.planetName || '').toLowerCase()
        );
        const targetKala = Number(fRow?.kala ?? kRow.total ?? 0);
        if (Math.abs(subSum - targetKala) > 0.25) mismatches++;
      }
      const kalaSumOk = kItems.length >= 7 && mismatches === 0;
      checks.push({
        id: 'astroway_kala_subcomponents_sum',
        domain: 'Shadbala Kala Subcomponents',
        passed: kalaSumOk,
        severity: 'major',
        epistemicCategory: kalaSumOk ? 'internal_math_consistency_verified' : 'methodology_unresolved',
        verificationBasis: 'provider_self_consistency',
        expected: 'nathonnatha+paksha+tribhaga+abdaMasaVaraHora+ayana+yuddha == shadbala.kala',
        observed: `${kItems.length - mismatches}/${kItems.length} planets sum cleanly within 0.25V`,
      });
      (kalaSumOk ? internalMathConsistencyVerified : methodologyUnresolved).push({
        key: 'astroway_kala_subcomponents_sum',
        label: 'AstroWay Kala Bala 6-Subcomponent Sum vs Full Kala Bala',
        category: kalaSumOk ? 'internal_math_consistency_verified' : 'methodology_unresolved',
        verificationBasis: 'provider_self_consistency',
        status: kalaSumOk ? 'verified' : 'unresolved',
        detail: `${kItems.length - mismatches}/${kItems.length} planets match within 0.25V.`,
      });
    }

    // Methodology caveats: missing nodeType toggle + x-quality='yellow' endpoints
    methodologyUnresolved.push({
      key: 'astroway_missing_node_type_parameter',
      label: 'AstroWay ChartInput Omits nodeType (Mean vs True Node)',
      category: 'methodology_unresolved',
      verificationBasis: 'provider_payload',
      status: 'partial',
      detail:
        'AstroWay OpenAPI v2.383.19 ChartInput does not expose a Mean vs True Rahu/Ketu parameter. Verify Rahu/Ketu longitudes against Mean vs True Node conventions.',
    });

    for (const c of awCalls) {
      if (c.ok && c.declaredQuality === 'yellow') {
        methodologyUnresolved.push({
          key: `astroway_yellow_${c.id}`,
          label: `OpenAPI x-quality=yellow: ${c.endpoint}`,
          category: 'methodology_unresolved',
          verificationBasis: 'pending_external_validation',
          status: 'partial',
          detail: c.qualityCaveat || 'Marked yellow in AstroWay OpenAPI spec; verify against external JHora/PyJHora.',
        });
      }
      if (!c.ok) {
        const cls =
          c.acquisitionClassification ||
          (c.attempts === 0
            ? 'not_yet_tested'
            : c.httpStatus === 429
            ? 'rate_limited'
            : c.accessRestricted || [401, 402, 403].includes(c.httpStatus)
            ? 'tier_restricted'
            : [404, 405, 501].includes(c.httpStatus)
            ? 'not_offered_by_provider'
            : 'runtime_execution_blocked');
        const prefixMap: Record<string, string> = {
          tier_restricted: '[TIER RESTRICTED] ',
          rate_limited: '[RATE LIMITED] ',
          runtime_execution_blocked: '[RUNTIME BLOCKED] ',
          not_offered_by_provider: '[NOT OFFERED] ',
          not_yet_tested: '[NOT YET TESTED] ',
          mathematical_verification_failed: '[MATH FAILED] ',
        };
        datasetUnavailable.push({
          key: `astroway_failed_${c.id}`,
          label: `${prefixMap[cls] || ''}${c.endpoint}`,
          category: 'dataset_unavailable',
          verificationBasis: 'none',
          status: 'unavailable',
          detail: c.errorMessage || `HTTP ${c.httpStatus}`,
        });
      }
    }
  }

  // Explicit epistemic marker: Bucket 3 stays empty unless an external JHora / PyJHora / SwissEph benchmark runs
  methodologyUnresolved.push({
    key: 'pending_external_jhora_pyjhora_validation',
    label: 'External Reference Benchmark (JHora / PyJHora / Swiss Ephemeris)',
    category: 'methodology_unresolved',
    verificationBasis: 'pending_external_validation',
    status: 'unresolved',
    detail:
      'CosmicCouncil internal Meeus/Placidus/Sripati solver checks are classified under Bucket 2 (internal_math_consistency_verified). External validation against JHora, PyJHora, or Swiss Ephemeris remains pending.',
  });

  for (const gap of master.remainingClassicalGaps) {
    const effectiveStatus = isAstroWay
      ? gap.selectedProviderStatus || 'unavailable'
      : gap.freeAstroApiStatus;
    if (
      isAstroWay &&
      (effectiveStatus === 'available_green' || effectiveStatus === 'available_yellow')
    ) {
      continue;
    }
    datasetUnavailable.push({
      key: `gap:${gap.capability.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 48)}`,
      label: gap.capability,
      category: 'dataset_unavailable',
      verificationBasis: 'none',
      status: 'unavailable',
      detail: `${providerDisplay}=${effectiveStatus}; local=${gap.localDerivedStatus}. ${gap.notes}`,
    });
  }

  const passedCount = checks.filter((c) => c.passed).length;
  const failedCount = checks.length - passedCount;

  const liveFramesCount = [
    master.frames.vedicLahiri.data,
    master.frames.kpPlacidus.data,
    master.frames.westernTropical.data,
    master.frames.astronomicalTelemetry.data,
  ].filter(Boolean).length;

  const mode: MathematicalVerificationReport['mode'] =
    liveFramesCount === 4
      ? 'live_and_offline'
      : liveFramesCount > 0
      ? 'partial_live_and_offline'
      : 'offline_only';

  return {
    profileName: instant.input.name,
    inputFingerprint: instant.inputFingerprint,
    mode,
    passedCount,
    failedCount,
    epistemicClassification: {
      providerDataAcquired,
      internalMathConsistencyVerified,
      independentlyValidatedAgainstExternalReference,
      methodologyUnresolved,
      datasetUnavailable,
    },
    checks,
  };
}
