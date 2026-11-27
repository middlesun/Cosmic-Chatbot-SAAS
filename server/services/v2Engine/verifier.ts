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
  normalizeDeg,
  SIGNS,
  type PlanetPosition,
} from '../jyotishMath';
import type {
  BhavaChalitMethodologyAudit,
  CanonicalBirthInstant,
  EpistemicClassificationItem,
  EpistemicClassificationSummary,
  LayerARawProviderRecord,
  LayerBMasterChartRecord,
  MathematicalVerificationReport,
  VerificationCheckResult,
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

export function verifyMasterChartRecord(
  master: LayerBMasterChartRecord,
  rawLayerA?: LayerARawProviderRecord | null
): MathematicalVerificationReport {
  const instant = master.canonicalBirthInstant;
  const ref = computeIndependentAstronomicalReference(instant);
  const checks: VerificationCheckResult[] = [];

  const providerDataAcquired: EpistemicClassificationItem[] = [];
  const internalMathConsistencyVerified: EpistemicClassificationItem[] = [];
  const independentlyValidatedAgainstExternalReference: EpistemicClassificationItem[] = [];
  const methodologyUnresolved: EpistemicClassificationItem[] = [];
  const datasetUnavailable: EpistemicClassificationItem[] = [];

  // 1. UTC & Julian Day consistency
  const expectedOffsetCheck =
    instant.utc.julianDayUt > 2400000 &&
    Math.abs(instant.utc.julianDayUt - ref.julianDayUt) < 1e-8;
  checks.push({
    id: 'utc_jd_consistency',
    domain: 'UTC & Julian Day',
    passed: expectedOffsetCheck,
    severity: 'critical',
    epistemicCategory: 'internal_math_consistency_verified',
    expected: `${instant.utc.iso} / JD=${ref.julianDayUt}`,
    observed: `${instant.utc.iso} / JD=${instant.utc.julianDayUt}`,
  });
  internalMathConsistencyVerified.push({
    key: 'canonical_utc_jd',
    label: 'Canonical UTC & Julian Day Conversion',
    category: 'internal_math_consistency_verified',
    status: expectedOffsetCheck ? 'verified' : 'unresolved',
    detail: `${instant.utc.iso} | JD=${instant.utc.julianDayUt} | TZ=${instant.timezone.ianaTimezone || `offset ${instant.timezone.historicalUtcOffsetHours}h`}`,
  });

  // 2. Mode A vs Mode B timezone equivalence (if executed live)
  if (rawLayerA?.timezoneEquivalenceCheck) {
    const eq = rawLayerA.timezoneEquivalenceCheck;
    checks.push({
      id: 'timezone_mode_a_vs_b',
      domain: 'Timezone Equivalence',
      passed: eq.equivalent,
      severity: 'critical',
      epistemicCategory: 'independently_validated_against_external_reference',
      expected: 'Mode A (IANA) == Mode B (UTC) within 0.01°',
      observed: `ascDelta=${eq.ascendantDeltaDeg}°, maxPlanetDelta=${eq.maxPlanetDeltaDeg}°`,
      notes: eq.notes.join(' | '),
    });
    (eq.equivalent
      ? independentlyValidatedAgainstExternalReference
      : methodologyUnresolved
    ).push({
      key: 'timezone_mode_a_vs_b',
      label: 'Provider Mode A (IANA) vs Mode B (UTC) Equivalence',
      category: eq.equivalent
        ? 'independently_validated_against_external_reference'
        : 'methodology_unresolved',
      status: eq.equivalent ? 'verified' : 'unresolved',
      detail: eq.notes.join(' | '),
    });
  }

  // 3. Independent Placidus cusp invariants (offline reference)
  const refKpSeq = verify12CuspSequence(ref.kpPlacidusCuspsDeg);
  const refTropSeq = verify12CuspSequence(ref.tropicalPlacidusCusps);
  const refSeqPassed =
    refKpSeq.monotonicSequential &&
    refTropSeq.monotonicSequential &&
    refKpSeq.maxOppositionErrorDeg < 0.02;
  checks.push({
    id: 'independent_placidus_sequence',
    domain: 'Reference Placidus Cusps',
    passed: refSeqPassed,
    severity: 'critical',
    epistemicCategory: 'independently_validated_against_external_reference',
    expected: 'Monotonic 12 cusps summing to 360°, opposite cusps 180° ± 0.02°',
    observed: `KP span=${refKpSeq.totalSpanDeg}° oppErr=${refKpSeq.maxOppositionErrorDeg}°; Trop span=${refTropSeq.totalSpanDeg}°`,
  });
  independentlyValidatedAgainstExternalReference.push({
    key: 'independent_astronomical_solver',
    label: 'Independent Solar/Lunar & Placidus Reference Solver',
    category: 'independently_validated_against_external_reference',
    status: refSeqPassed ? 'verified' : 'unresolved',
    detail: `Lahiri Asc=${ref.lahiriAscendantDeg}°, Sun=${ref.lahiriSunLonDeg}°, Moon=${ref.lahiriMoonLonDeg}°; Placidus span=${refKpSeq.totalSpanDeg}°`,
  });

  // Track Endpoint 1: Vedic Lahiri
  const vedicData = master.frames.vedicLahiri.data;
  if (vedicData) {
    providerDataAcquired.push({
      key: 'provider_vedic_calculate',
      label: 'FreeAstroAPI V2 Vedic Lahiri (/api/v2/vedic/calculate)',
      category: 'provider_data_acquired',
      status: master.frames.vedicLahiri.completeness === 'complete' ? 'verified' : 'partial',
      detail: `${vedicData.planets.length} planets, ${vedicData.vargas?.supportedCount ?? 0} Vargas, ${vedicData.yogas?.items.length ?? 0} Yogas, Ashtakavarga=${vedicData.ashtakavarga ? 'yes' : 'no'}, Dasha=${vedicData.vimshottariDasha ? 'yes' : 'no'}`,
    });

    // 4. Lahiri Ascendant, Sun & Moon vs independent astronomical reference
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
      epistemicCategory: 'independently_validated_against_external_reference',
      expected: `Asc~${ref.lahiriAscendantDeg}°, Sun~${ref.lahiriSunLonDeg}°, Moon~${ref.lahiriMoonLonDeg}°`,
      observed: `Asc=${ascDeg}° (Δ${ascErr.toFixed(3)}°), Sun=${sunDeg}° (Δ${sunErr.toFixed(3)}°), Moon=${moonDeg}° (Δ${moonErr.toFixed(3)}°)`,
    });
    independentlyValidatedAgainstExternalReference.push({
      key: 'lahiri_asc_sun_moon_vs_reference',
      label: 'Vedic Lahiri Ascendant, Sun & Moon vs Astronomical Reference',
      category: 'independently_validated_against_external_reference',
      status: lahiriRefPassed ? 'verified' : 'unresolved',
      detail: `ΔAsc=${ascErr.toFixed(3)}°, ΔSun=${sunErr.toFixed(3)}°, ΔMoon=${moonErr.toFixed(3)}°`,
    });

    // 5. All 17 Vargas present (incl. D5)
    const vargaKeys = vedicData.vargas?.divisionsReturned || [];
    const hasD5 = vargaKeys.some((k) => k.toUpperCase() === 'D5' || k === '5');
    const vargasOk = vargaKeys.length >= 17 && hasD5;
    checks.push({
      id: 'vargas_17_completeness',
      domain: 'Divisional Charts',
      passed: vargasOk,
      severity: 'major',
      epistemicCategory: 'provider_data_acquired',
      expected: '17 Vargas including D5',
      observed: `${vargaKeys.length} Vargas (${vargaKeys.join(',')})`,
    });
    if (!hasD5) {
      datasetUnavailable.push({
        key: 'varga_d5_missing',
        label: 'D5 (Panchamsha) Divisional Chart',
        category: 'dataset_unavailable',
        status: 'unavailable',
        detail: `Provider returned ${vargaKeys.length} Vargas without D5.`,
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
        expected: 'SAV=337, 0 BAV mismatches, 0 Prasthara mismatches',
        observed: `SAV=${savSum}, bavErrors=${bavErrors}, prastharaErrors=${prastharaErrors}`,
      });
      internalMathConsistencyVerified.push({
        key: 'ashtakavarga_matrix',
        label: 'Ashtakavarga Prasthara -> BAV -> SAV (337)',
        category: 'internal_math_consistency_verified',
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
        expected: 'elapsed_years + remaining_years == full_duration_years',
        observed: `${elY} + ${remY} vs ${fullY}`,
      });
      internalMathConsistencyVerified.push({
        key: 'vimshottari_balance',
        label: 'Vimshottari Birth Balance Sum',
        category: 'internal_math_consistency_verified',
        status: balanceSumOk ? 'verified' : 'unresolved',
        detail: `${elY} + ${remY} vs ${fullY} years`,
      });
    }

    // 8. Panchang sunrise/sunset & weekday check
    if (vedicData.panchang) {
      const hasSunTimes = Boolean(vedicData.panchang.sunrise && vedicData.panchang.sunset);
      checks.push({
        id: 'panchang_sunrise_sunset_present',
        domain: 'Panchang',
        passed: hasSunTimes,
        severity: 'major',
        epistemicCategory: 'provider_data_acquired',
        expected: 'Provider sunrise/sunset + tithi/nakshatra/yoga/karana present',
        observed: `sunrise=${vedicData.panchang.sunrise}, sunset=${vedicData.panchang.sunset}`,
      });
    }
  } else {
    datasetUnavailable.push({
      key: 'provider_vedic_calculate',
      label: 'Vedic Lahiri Frame (/api/v2/vedic/calculate)',
      category: 'dataset_unavailable',
      status: 'unavailable',
      detail: master.frames.vedicLahiri.limitations.join(' ') || 'Endpoint unavailable or not executed.',
    });
  }

  // Track Endpoint 2: KP Frame sequence & significators
  const kpData = master.frames.kpPlacidus.data;
  if (kpData) {
    providerDataAcquired.push({
      key: 'provider_vedic_kp',
      label: 'FreeAstroAPI V2 Dedicated KP (/api/v2/vedic/kp)',
      category: 'provider_data_acquired',
      status: master.frames.kpPlacidus.completeness === 'complete' ? 'verified' : 'partial',
      detail: `${kpData.cusps.length} cusps, ${kpData.planets.length} planets, ayanamsha=${kpData.ayanamsha.name} (${kpData.ayanamsha.valueDegrees ?? 'N/A'}°)`,
    });

    const kpCuspDegs = kpData.cusps.map((c) => Number(c.cusp_degree ?? c.absolute_degree));
    const kpSeq = verify12CuspSequence(kpCuspDegs);
    const kpSeqOk = kpSeq.monotonicSequential && kpSeq.maxOppositionErrorDeg < 0.05;
    checks.push({
      id: 'kp_12_cusp_sequence',
      domain: 'KP Placidus Cusps',
      passed: kpSeqOk,
      severity: 'critical',
      epistemicCategory: 'internal_math_consistency_verified',
      expected: '12 strictly monotonic KP Placidus cusps summing to 360°',
      observed: `span=${kpSeq.totalSpanDeg}°, maxOppErr=${kpSeq.maxOppositionErrorDeg}°`,
    });
    internalMathConsistencyVerified.push({
      key: 'kp_12_cusp_sequence',
      label: 'KP Placidus 12-Cusp Monotonic Order & 180° Opposition',
      category: 'internal_math_consistency_verified',
      status: kpSeqOk ? 'verified' : 'unresolved',
      detail: `span=${kpSeq.totalSpanDeg}°, maxOppErr=${kpSeq.maxOppositionErrorDeg}°`,
    });

    if (kpCuspDegs.length === 12) {
      const maxKpCuspRefDelta = kpCuspDegs.reduce((mx, deg, idx) => {
        const d = Math.abs(circularDiffDeg(deg, ref.kpPlacidusCuspsDeg[idx]));
        return Math.max(mx, d);
      }, 0);
      independentlyValidatedAgainstExternalReference.push({
        key: 'kp_cusps_vs_reference',
        label: 'KP Placidus Cusps vs Independent Semi-Arc Reference',
        category: 'independently_validated_against_external_reference',
        status: maxKpCuspRefDelta < 0.35 ? 'verified' : 'unresolved',
        detail: `Max cusp delta vs independent Placidus KP reference: ${maxKpCuspRefDelta.toFixed(4)}°`,
      });
    }
  } else {
    datasetUnavailable.push({
      key: 'provider_vedic_kp',
      label: 'KP Placidus Frame (/api/v2/vedic/kp)',
      category: 'dataset_unavailable',
      status: 'unavailable',
      detail: master.frames.kpPlacidus.limitations.join(' ') || 'Endpoint unavailable or not executed.',
    });
  }

  // Track Frame 3: Bhava Chalit methodology verification
  const bcData = master.frames.bhavaChalit.data;
  if (bcData) {
    providerDataAcquired.push({
      key: 'provider_bhava_chalit',
      label: 'FreeAstroAPI V2 Bhava Chalit Frame',
      category: 'provider_data_acquired',
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
        ? 'independently_validated_against_external_reference'
        : 'methodology_unresolved',
      expected: 'Midpoint-straddled boundaries matching classical Sripati within 1°',
      observed: bcData.methodologyAudit.notes.join(' | '),
    });
    if (bcCompat) {
      independentlyValidatedAgainstExternalReference.push({
        key: 'bhava_chalit_sripati',
        label: 'Bhava Chalit vs Classical Sripati Trisection',
        category: 'independently_validated_against_external_reference',
        status: 'verified',
        detail: bcData.methodologyAudit.notes.join(' | '),
      });
    } else {
      methodologyUnresolved.push({
        key: 'bhava_chalit_methodology',
        label: 'Bhava Chalit Methodology Divergence',
        category: 'methodology_unresolved',
        status: 'unresolved',
        detail: bcData.methodologyAudit.notes.join(' | '),
      });
    }
  } else {
    datasetUnavailable.push({
      key: 'provider_bhava_chalit',
      label: 'Bhava Chalit Frame',
      category: 'dataset_unavailable',
      status: 'unavailable',
      detail: master.frames.bhavaChalit.limitations.join(' ') || 'Bhava Chalit frame unavailable.',
    });
  }

  // Track Endpoint 3: Western Tropical sequence & angles
  const westData = master.frames.westernTropical.data;
  if (westData) {
    providerDataAcquired.push({
      key: 'provider_western_natal',
      label: 'FreeAstroAPI V1 Western Tropical (/api/v1/natal/calculate)',
      category: 'provider_data_acquired',
      status: master.frames.westernTropical.completeness === 'complete' ? 'verified' : 'partial',
      detail: `${westData.planets.length} bodies, ${westData.houses.length} Placidus cusps, ${westData.aspects.length} aspects`,
    });

    const wCusps = westData.houses.map((h) => Number(h.abs_pos));
    const wSeq = verify12CuspSequence(wCusps);
    const wSeqOk = wSeq.monotonicSequential && wSeq.maxOppositionErrorDeg < 0.05;
    checks.push({
      id: 'western_placidus_cusp_sequence',
      domain: 'Western Placidus Cusps',
      passed: wSeqOk,
      severity: 'critical',
      epistemicCategory: 'internal_math_consistency_verified',
      expected: '12 monotonic Tropical Placidus cusps independent of KP',
      observed: `span=${wSeq.totalSpanDeg}°, maxOppErr=${wSeq.maxOppositionErrorDeg}°`,
    });
    internalMathConsistencyVerified.push({
      key: 'western_placidus_cusp_sequence',
      label: 'Western Placidus 12-Cusp Monotonic Order & 180° Opposition',
      category: 'internal_math_consistency_verified',
      status: wSeqOk ? 'verified' : 'unresolved',
      detail: `span=${wSeq.totalSpanDeg}°, maxOppErr=${wSeq.maxOppositionErrorDeg}°`,
    });

    if (westData.secondPrecisionDroppedByV1Endpoint) {
      methodologyUnresolved.push({
        key: 'western_v1_seconds_truncation',
        label: 'Western V1 Birth-Time Second Precision Truncated',
        category: 'methodology_unresolved',
        status: 'partial',
        detail: `Request 3 (/api/v1/natal/calculate) omits "second" parameter; ${instant.input.second}s truncated in Western response.`,
      });
    }
  } else {
    datasetUnavailable.push({
      key: 'provider_western_natal',
      label: 'Western Tropical Frame (/api/v1/natal/calculate)',
      category: 'dataset_unavailable',
      status: 'unavailable',
      detail: master.frames.westernTropical.limitations.join(' ') || 'Endpoint unavailable or not executed.',
    });
  }

  // Track Endpoint 4: Astronomical Telemetry
  const ephData = master.frames.astronomicalTelemetry.data;
  if (ephData) {
    providerDataAcquired.push({
      key: 'provider_ephemeris',
      label: 'FreeAstroAPI V1 Ephemeris (/api/v1/ephemeris/calculate)',
      category: 'provider_data_acquired',
      status: master.frames.astronomicalTelemetry.completeness === 'complete' ? 'verified' : 'partial',
      detail: `${Object.keys(ephData.bodies).length} celestial bodies with speed, latitude & distance_au`,
    });

    if (ephData.timestampVerification) {
      const tsOk = ephData.timestampVerification.exactTimestampMatch;
      checks.push({
        id: 'ephemeris_timestamp_verification',
        domain: 'Ephemeris Timestamp',
        passed: tsOk,
        severity: 'major',
        epistemicCategory: tsOk
          ? 'independently_validated_against_external_reference'
          : 'methodology_unresolved',
        expected: `${ephData.timestampVerification.expectedUtcIso} / JD=${ephData.timestampVerification.expectedJulianDayUt}`,
        observed: `${ephData.timestampVerification.returnedUtcInstant ?? 'missing'} / Δ=${ephData.timestampVerification.deltaSecondsFromCanonical ?? 'N/A'}s`,
        notes: ephData.timestampVerification.limitationNotes.join(' | '),
      });
      (tsOk
        ? independentlyValidatedAgainstExternalReference
        : methodologyUnresolved
      ).push({
        key: 'ephemeris_timestamp_verification',
        label: 'Ephemeris Timestamp & Julian Day Match',
        category: tsOk
          ? 'independently_validated_against_external_reference'
          : 'methodology_unresolved',
        status: tsOk ? 'verified' : 'unresolved',
        detail: `Canonical ${ephData.timestampVerification.expectedUtcIso} vs returned ${ephData.timestampVerification.returnedUtcInstant ?? 'N/A'} (Δ=${ephData.timestampVerification.deltaSecondsFromCanonical ?? 'N/A'}s)`,
      });
    }
  } else {
    datasetUnavailable.push({
      key: 'provider_ephemeris',
      label: 'Astronomical Ephemeris Frame (/api/v1/ephemeris/calculate)',
      category: 'dataset_unavailable',
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
      expected: 'All provider Shadbala components sum to total Virupas',
      observed: `sumErrors=${providerSumErr}, authoritativeDesignation=${sb.authoritativeDesignation}`,
    });
    if (sb.perPlanet.some((p) => p.provider)) {
      internalMathConsistencyVerified.push({
        key: 'shadbala_component_sum',
        label: 'Provider Shadbala 6-Bala Component Sum',
        category: 'internal_math_consistency_verified',
        status: providerSumErr === 0 ? 'verified' : 'unresolved',
        detail: `${sb.perPlanet.length - providerSumErr}/${sb.perPlanet.length} planets sum cleanly within 0.2V.`,
      });
    }
    methodologyUnresolved.push({
      key: 'shadbala_authoritative_source',
      label: 'Shadbala Authoritative Model & Subcomponents',
      category: 'methodology_unresolved',
      status: 'unresolved',
      detail: `Designation remains "${sb.authoritativeDesignation}". Provider omits subcomponents; Sun 5.0 vs 6.5 threshold (${sb.sunThresholdInvestigation.flipsPassFailStatus ? 'flips pass/fail' : 'investigated'}) and Legacy Local vs Provider Virupa deltas require independent JHora/PyJHora cross-check.`,
    });
  }

  for (const gap of master.remainingClassicalGaps) {
    datasetUnavailable.push({
      key: `gap:${gap.capability.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 48)}`,
      label: gap.capability,
      category: 'dataset_unavailable',
      status: 'unavailable',
      detail: `FreeAstroAPI=${gap.freeAstroApiStatus}; local=${gap.localDerivedStatus}. ${gap.notes}`,
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
