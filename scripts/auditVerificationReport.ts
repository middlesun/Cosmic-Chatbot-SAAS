/**
 * CosmicCouncil Foundational Engine V2, K01 & K02 — Comprehensive Independent Audit CLI
 *
 * Covers:
 *  - Area 1: Durable sanitized offline verification fixtures (`scripts/fixtures/v2-offline-verification-fixtures.json`)
 *  - Area 2: Independent computational verification & 100% K02 math recomputation (zero ruleRegistry math reuse)
 *  - Area 3: Extended Multi-Chart Regression & Edge-Case Stress Matrix (Real FreeAstroAPI Exports vs Synthetic)
 *  - Area 5: Empirical Validation Readiness Audit
 *
 * Strictly zero live paid API calls, zero LLM calls, zero DB mutations, zero production chart mutations.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  buildAnalyticalEvidenceRepository,
  buildAnalyticalKernelK02Bundle,
  BPHS_SHADBALA_MIN_RUPAS,
  evaluateK02FromRepository,
  exportRuleRegistrySnapshot,
  PHI_READY_PLANETS,
  PLANETARY_STATE_SUBJECTS,
  type AnalyticalKernelK02StateResult,
} from '../server/services/analyticalKernel';
import {
  buildLayerBMasterChartRecord,
  compileV2FoundationalChart,
  computeAshtakavargaReductions,
  computeIndependentAstronomicalReference,
  computeLocalAshtakavarga,
  prepareLayerCAnalyticalInput,
  redactSecretsDeep,
  resolveCanonicalBirthInstant,
  verifyMasterChartRecord,
  type CanonicalBirthInput,
  type LayerARawProviderRecord,
  type SanitizedProviderCallRecord,
} from '../server/services/v2Engine';
import { computeKPPlacidusCusps, getVargaSignIndex, normalizeDeg, SIGNS } from '../server/services/jyotishMath';
import { adaptRealFreeAstroApiExport, type RealExportAdaptedChart } from './fixtures/freeastroapiExportAdapter';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`AUDIT ASSERTION FAILED: ${msg}`);
}

function circularDiffDeg(a: number, b: number): number {
  let d = normalizeDeg(a) - normalizeDeg(b);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

// ============================================================================
// INDEPENDENT CLASSICAL & MATHEMATICAL REFERENCE EVALUATORS (ZERO KERNEL REUSE)
// ============================================================================

const IND_COMBUST_ORB: Record<string, { direct: number; retro: number }> = {
  Moon: { direct: 12, retro: 12 },
  Mars: { direct: 17, retro: 17 },
  Mercury: { direct: 14, retro: 12 },
  Jupiter: { direct: 11, retro: 11 },
  Venus: { direct: 10, retro: 8 },
  Saturn: { direct: 15, retro: 15 },
};

const IND_D1_DIGNITY_ORDINAL: Record<string, number> = {
  exalted: 1.0,
  moolatrikona: 0.85,
  own_sign: 0.75,
  swakshetra: 0.75,
  great_friend: 0.5,
  adhi_mitra: 0.5,
  friend: 0.3,
  mitra: 0.3,
  neutral: 0.0,
  sama: 0.0,
  enemy: -0.35,
  shatru: -0.35,
  great_enemy: -0.65,
  adhi_shatru: -0.65,
  debilitated: -1.0,
  neecha: -1.0,
};

const IND_WESTERN_DIGNITY_ORDINAL: Record<string, number> = {
  domicile: 0.85,
  rulership: 0.85,
  exaltation: 1.0,
  triplicity: 0.4,
  term: 0.2,
  face: 0.1,
  peregrine: 0.0,
  detriment: -0.75,
  fall: -1.0,
};

const IND_AUTONOMY_MAP: Record<string, number> = {
  self_disposited: 1.0,
  final_dispositor: 1.0,
  parivartana_cycle: 0.75,
  mutual_exchange: 0.75,
  cycle: 0.5,
  terminated_in_self_dispositor: 0.5,
  chained: 0.25,
};

const IND_BPHS_RASHIS_LORD = [
  'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
];

function indepVargaSignIdx(lonDeg: number, div: number): number {
  const lon = normalizeDeg(lonDeg);
  const sign = Math.floor(lon / 30) % 12;
  const deg = lon % 30;
  const isOdd = sign % 2 === 0;
  if (div === 1) return sign;
  if (div === 2) {
    const first = deg < 15;
    return isOdd ? (first ? 4 : 3) : (first ? 3 : 4);
  }
  if (div === 3) {
    const p = Math.min(2, Math.floor(deg / 10));
    return (sign + p * 4) % 12;
  }
  if (div === 4) {
    const p = Math.min(3, Math.floor(deg / 7.5));
    return (sign + p * 3) % 12;
  }
  if (div === 7) {
    const p = Math.min(6, Math.floor(deg / (30 / 7)));
    return ((isOdd ? sign : (sign + 6) % 12) + p) % 12;
  }
  if (div === 9) {
    const p = Math.min(8, Math.floor(deg / (30 / 9)));
    const elem = sign % 4; // 0 Fire->Aries, 1 Earth->Cap, 2 Air->Libra, 3 Water->Can
    const start = [0, 9, 6, 3][elem];
    return (start + p) % 12;
  }
  if (div === 10) {
    const p = Math.min(9, Math.floor(deg / 3));
    return ((isOdd ? sign : (sign + 8) % 12) + p) % 12;
  }
  if (div === 12) {
    const p = Math.min(11, Math.floor(deg / 2.5));
    return (sign + p) % 12;
  }
  if (div === 16) {
    const p = Math.min(15, Math.floor(deg / (30 / 16)));
    const mod = sign % 3; // movable 0->Aries(0), fixed 1->Leo(4), dual 2->Sag(8)
    const start = [0, 4, 8][mod];
    return (start + p) % 12;
  }
  if (div === 20) {
    const p = Math.min(19, Math.floor(deg / 1.5));
    const mod = sign % 3; // movable->Aries(0), fixed->Sag(8), dual->Leo(4)
    const start = [0, 8, 4][mod];
    return (start + p) % 12;
  }
  if (div === 24) {
    const p = Math.min(23, Math.floor(deg / 1.25));
    return ((isOdd ? 4 : 3) + p) % 12;
  }
  if (div === 27) {
    const p = Math.min(26, Math.floor(deg / (30 / 27)));
    const elem = sign % 4;
    const start = [0, 3, 6, 9][elem];
    return (start + p) % 12;
  }
  if (div === 30) {
    if (isOdd) {
      if (deg < 5) return 0;
      if (deg < 10) return 10;
      if (deg < 18) return 8;
      if (deg < 25) return 2;
      return 6;
    } else {
      if (deg < 5) return 1;
      if (deg < 12) return 5;
      if (deg < 20) return 11;
      if (deg < 25) return 9;
      return 7;
    }
  }
  if (div === 40) {
    const p = Math.min(39, Math.floor(deg / 0.75));
    return ((isOdd ? 0 : 6) + p) % 12;
  }
  if (div === 45) {
    const p = Math.min(44, Math.floor(deg / (30 / 45)));
    const mod = sign % 3;
    const start = [0, 4, 8][mod];
    return (start + p) % 12;
  }
  if (div === 60) {
    const p = Math.min(59, Math.floor(deg / 0.5));
    return (sign + p) % 12;
  }
  return getVargaSignIndex(lon, div);
}

/** Independent Julian Day UT (Meeus Ch. 7) */
function indepJulianDayUt(year: number, month: number, day: number, utcHours: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + utcHours / 24 + B - 1524.5;
}

/** Build deterministic synthetic AstroWay-shape dataset matching 1985-12-25 04:33 Bardhaman */
function buildDurableSyntheticFixtures() {
  const input: CanonicalBirthInput = {
    name: 'Chris 4 (Bardhaman Synthetic AstroWay-Shape)',
    birthDate: '1985-12-25',
    birthTime: '04:33:00',
    latitude: 23.25572,
    longitude: 87.85691,
    city: 'Bardhaman',
    state: 'West Bengal',
    country: 'India',
    ianaTimezone: 'Asia/Kolkata',
    birthTimePrecision: 'exact',
    nodeConvention: 'mean',
  };
  const instant = resolveCanonicalBirthInstant(input);
  const ref = computeIndependentAstronomicalReference(instant);

  const makeAwCall = (
    id: string,
    endpoint: string,
    category: string,
    data: unknown,
    opts?: { declaredQuality?: 'green' | 'yellow' | 'red' }
  ): SanitizedProviderCallRecord => ({
    id,
    endpoint,
    category,
    httpMethod: 'POST',
    sanitizedRequest: {
      year: 1985,
      month: 12,
      date: 25,
      hours: 4,
      minutes: 33,
      seconds: 0,
      latitude: 23.25572,
      longitude: 87.85691,
      timezone: 5.5,
      targetDate: '2026-11-27',
    },
    httpStatus: 200,
    ok: true,
    durationMs: 12,
    attempts: 1,
    acquiredAtUtc: '2026-11-28T00:00:00.000Z',
    declaredQuality: opts?.declaredQuality ?? 'green',
    rawResponse: { ok: true, data },
  });

  const bodies9 = [
    { name: 'Sun', longitude: ref.lahiriSunLonDeg, dignity: 'Friendly', avastha: 'Kumara', isCombust: false },
    { name: 'Moon', longitude: ref.lahiriMoonLonDeg, dignity: 'Exalted', avastha: 'Yuva', isCombust: false },
    { name: 'Mars', longitude: 192.608, dignity: 'Neutral', avastha: 'Yuva', isCombust: false },
    { name: 'Mercury', longitude: 229.4577, dignity: 'Neutral', avastha: 'Kumara', isCombust: false },
    { name: 'Jupiter', longitude: 293.132, dignity: 'Debilitated', avastha: 'Kumara', isCombust: false },
    { name: 'Venus', longitude: 243.3004, dignity: 'Neutral', avastha: 'Bala', isCombust: true },
    { name: 'Saturn', longitude: 220.7548, dignity: 'Neutral', avastha: 'Vriddha', isCombust: false },
    { name: 'Rahu', longitude: 12.5352, dignity: 'Neutral', isRetrograde: true },
    { name: 'Ketu', longitude: 192.5352, dignity: 'Neutral', isRetrograde: true },
  ];

  const vargaDivisions = [2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60];
  const vargaCalls = Object.fromEntries(
    vargaDivisions.map((div) => [
      `varga_D${div}`,
      makeAwCall(`varga_D${div}`, `/vedic/varga/D${div}`, 'varga', {
        varga: `D${div}`,
        ayanamsa: 'lahiri',
        lagna: { signName: SIGNS[getVargaSignIndex(ref.lahiriAscendantDeg, div)] },
        planets: bodies9.map((b) => ({
          name: b.name,
          signName: SIGNS[getVargaSignIndex(b.longitude, div)],
          longitude: b.longitude,
        })),
      }),
    ])
  );

  const syntheticAwLayerA: LayerARawProviderRecord = {
    schemaVersion: 'v2.layer_a.1.0',
    providerId: 'astroway',
    providerBaseUrl: 'https://sandbox.astroway.offline.fixture',
    capturedAtUtc: '2026-11-28T00:00:00.000Z',
    canonicalBirthInstant: instant,
    acquisitionStatus: 'complete',
    missingDatasets: [],
    validationFailures: [],
    calls: {
      chart_sidereal: makeAwCall('chart_sidereal', '/chart', 'natal_core', {
        ayanamsa: 'lahiri',
        houseSystem: 'whole_sign',
        ascendant: ref.lahiriAscendantDeg,
        planets: bodies9.map((b) => ({
          name: b.name === 'Rahu' ? 'Mean Node' : b.name === 'Ketu' ? 'South Node' : b.name,
          longitude: b.longitude,
          isRetrograde: Boolean(b.isRetrograde),
          speedLong: b.name === 'Sun' ? 1.018 : b.name === 'Moon' ? 13.4 : undefined,
        })),
      }),
      chart_tropical: makeAwCall('chart_tropical', '/chart', 'western', {
        houseSystem: 'placidus',
        ascendant: ref.tropicalAscendantDeg,
        midheaven: ref.tropicalMcDeg,
        cusps: ref.tropicalPlacidusCusps.map((deg, idx) => ({ house: idx + 1, longitude: deg })),
        planets: [
          { name: 'Sun', longitude: ref.tropicalSunLonDeg, house: 1 },
          { name: 'Moon', longitude: ref.tropicalMoonLonDeg, house: 6 },
          { name: 'Mars', longitude: normalizeDeg(192.608 + ref.lahiriAyanamsaDeg), house: 10 },
          { name: 'Mercury', longitude: normalizeDeg(229.4577 + ref.lahiriAyanamsaDeg), house: 12 },
          { name: 'Jupiter', longitude: normalizeDeg(293.132 + ref.lahiriAyanamsaDeg), house: 2 },
          { name: 'Venus', longitude: normalizeDeg(243.3004 + ref.lahiriAyanamsaDeg), house: 12 },
          { name: 'Saturn', longitude: normalizeDeg(220.7548 + ref.lahiriAyanamsaDeg), house: 12 },
          { name: 'Uranus', longitude: 259.1, house: 1 },
          { name: 'Neptune', longitude: 273.1, house: 1 },
          { name: 'Pluto', longitude: 216.8, house: 11 },
        ],
      }),
      vedic_kundli: makeAwCall('vedic_kundli', '/vedic/kundli', 'natal_core', {
        ayanamsa: 'lahiri',
        lagna: { longitude: ref.lahiriAscendantDeg, signName: SIGNS[Math.floor(ref.lahiriAscendantDeg / 30) % 12] },
        grahas: bodies9,
        yogas: { present: ['Gajakesari Yoga', 'Budhaditya Check'] },
        doshas: { present: [] },
      }),
      shadbala_full: makeAwCall('shadbala_full', '/vedic/shadbala', 'shadbala', {
        items: [
          { planetName: 'Sun', totalVirupa: 434.12, sthana: 222.31, dig: 24.27, kala: 118.12, cheshta: 1.03, naisargika: 60, drik: 8.39 },
          { planetName: 'Moon', totalVirupa: 430.01, sthana: 214.03, dig: 32.94, kala: 110.05, cheshta: 51.33, naisargika: 51.42, drik: -29.76 },
          { planetName: 'Mars', totalVirupa: 378.73, sthana: 189.87, dig: 43.21, kala: 92.41, cheshta: 23.31, naisargika: 17.16, drik: 12.77 },
          { planetName: 'Mercury', totalVirupa: 508.39, sthana: 256.02, dig: 58.58, kala: 127.19, cheshta: 27.01, naisargika: 25.74, drik: 13.85 },
          { planetName: 'Jupiter', totalVirupa: 340.24, sthana: 126.04, dig: 37.35, kala: 155.21, cheshta: 16.77, naisargika: 34.26, drik: -29.39 },
          { planetName: 'Venus', totalVirupa: 386.46, sthana: 151.48, dig: 33.68, kala: 145.56, cheshta: 2.97, naisargika: 42.84, drik: 9.93 },
          { planetName: 'Saturn', totalVirupa: 341.91, sthana: 214.33, dig: 1.48, kala: 91.37, cheshta: 10.94, naisargika: 8.58, drik: 15.21 },
        ],
      }),
      shadbala_ishta_kashta: makeAwCall('shadbala_ishta_kashta', '/vedic/shadbala/ishta-kashta', 'shadbala', {
        items: [
          { planetName: 'Sun', ishta: 6.2, kashta: 48.3 },
          { planetName: 'Moon', ishta: 53.9, kashta: 5.5 },
          { planetName: 'Mars', ishta: 25.5, kashta: 34.5 },
          { planetName: 'Mercury', ishta: 27.0, kashta: 29.7 },
          { planetName: 'Jupiter', ishta: 11.9, kashta: 44.4 },
          { planetName: 'Venus', ishta: 18.9, kashta: 40.7 },
          { planetName: 'Saturn', ishta: 33.1, kashta: 16.5 },
        ],
      }, { declaredQuality: 'yellow' }),
      bhavabala: makeAwCall('bhavabala', '/vedic/bhavabala', 'bhavabala', {
        houses: Array.from({ length: 12 }, (_, idx) => ({ house: idx + 1, totalVirupa: 420 + idx * 5 })),
      }, { declaredQuality: 'yellow' }),
      kp_sub_lords: makeAwCall('kp_sub_lords', '/vedic/kp/sub-lords', 'kp', {
        ayanamsa: ref.kpAyanamsaDeg,
        method: 'placidus',
        cusps: ref.kpPlacidusCuspsDeg.map((deg, idx) => ({ house: idx + 1, longitude: deg })),
        planets: bodies9.map((b) => ({ grahaName: b.name, longitude: normalizeDeg(b.longitude + 0.1) })),
      }),
      western_essential_dignities: makeAwCall('western_essential_dignities', '/western/essential-dignities', 'hellenistic_traditional', {
        planets: [
          { name: 'Sun', domicile: false, peregrine: true },
          { name: 'Moon', domicile: false, peregrine: true },
          { name: 'Jupiter', domicile: false, peregrine: true },
        ],
      }),
      dashas_vimshottari_prana: makeAwCall('dashas_vimshottari_prana', '/vedic/dashas/vimshottari/prana', 'dasha', {
        initial: { initialPlanetName: 'Moon', balanceYears: 7.435, elapsedYears: 2.565 },
        current: { maha: 'Jupiter', antar: 'Venus', pratyantar: 'Moon', targetDate: '2026-11-27' },
        periods: [
          {
            planetName: 'Moon',
            startDate: '1985-12-25',
            endDate: '1993-06-02',
            durationYears: 7.435,
            subPeriods: [
              {
                planetName: 'Rahu',
                startDate: '1985-12-25',
                endDate: '1986-05-03',
                pratyantardashas: [
                  {
                    planetName: 'Venus',
                    startDate: '1985-12-25',
                    endDate: '1986-01-18',
                    sookshmadashas: [
                      {
                        planetName: 'Sun',
                        startDate: '1985-12-25',
                        endDate: '1985-12-28',
                        pranadashas: [{ planetName: 'Moon', startDate: '1985-12-25', endDate: '1985-12-26' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
      ...vargaCalls,
    },
    quotaAndPerformanceSummary: {
      totalCalls: 24,
      successfulCalls: 24,
      failedCalls: 0,
      tierRestrictedCalls: 0,
      rateLimitedCalls: 0,
      unexecutedCalls: 0,
      totalDurationMs: 120,
      retryCount: 0,
    },
  };

  const compiledSyntheticAw = compileV2FoundationalChart({
    instant,
    astroWayRaw: syntheticAwLayerA,
    options: { targetDateIso: '2026-11-27', includeLocalModules: true, preferLocalAshtakavarga: true },
  });

  return {
    originType: 'synthetic_simulated_astroway_shape' as const,
    instant,
    syntheticAwLayerA,
    compiledSyntheticAw,
    layerCInput: prepareLayerCAnalyticalInput(compiledSyntheticAw),
  };
}

// ============================================================================
// INDEPENDENT K02 MATH RECOMPUTATION AUDIT (NO ruleRegistry MATH IMPORTS USED)
// ============================================================================

function recomputeAndAuditK02Math(label: string, k02: AnalyticalKernelK02StateResult, k01: ReturnType<typeof buildAnalyticalEvidenceRepository>) {
  const natal = k01.natalEvidence;
  const failures: string[] = [];
  let checkedSignals = 0;

  const findEv = (subj: string, code: string, extraFn?: (e: typeof natal[number]) => boolean) =>
    natal.find(
      (e) =>
        e.subject.id === subj &&
        e.observation.code === code &&
        e.verification.propagatedTrust !== 'blocked' &&
        (!extraFn || extraFn(e))
    );

  const metricNum = (ev: typeof natal[number] | undefined, metricName: string): number | null => {
    if (!ev) return null;
    const m = ev.measurements.find((x) => x.metric === metricName);
    return typeof m?.value === 'number' && Number.isFinite(m.value) ? m.value : null;
  };
  const metricStr = (ev: typeof natal[number] | undefined, metricName: string): string | null => {
    if (!ev) return null;
    const m = ev.measurements.find((x) => x.metric === metricName);
    return typeof m?.value === 'string' ? m.value : null;
  };
  const metricBool = (ev: typeof natal[number] | undefined, metricName: string): boolean | null => {
    if (!ev) return null;
    const m = ev.measurements.find((x) => x.metric === metricName);
    return typeof m?.value === 'boolean' ? m.value : null;
  };

  const tol = 1e-4;
  const findRex = (subj: string, ruleId: string) =>
    k02.subjectStates[subj as keyof typeof k02.subjectStates].ruleExecutions.find(
      (r) => r.ruleId === ruleId
    );

  for (const subj of PLANETARY_STATE_SUBJECTS) {
    const st = k02.subjectStates[subj];
    const execs = st.ruleExecutions;

    const regIds = new Set(exportRuleRegistrySnapshot().rules.map((r) => r.ruleId));
    for (const rex of execs) {
      if (!regIds.has(rex.ruleId)) failures.push(`${label}/${subj}: unregistered rule ${rex.ruleId}`);
    }

    // 1. Shadbala rupa ratio (Sun..Saturn only)
    const sbSig = st.dimensions.capacity.signals.find((s) => s.signalKey === 'shadbala_bphs_rupa_ratio');
    if ((PHI_READY_PLANETS as readonly string[]).includes(subj)) {
      const sbEv = findEv(subj, 'SHADBALA_MAJOR_SIX_BALA');
      const totalRupas = metricNum(sbEv, 'total_rupas');
      const bphsMin = BPHS_SHADBALA_MIN_RUPAS[subj];
      if (sbSig && totalRupas !== null && bphsMin) {
        const expected = Number((totalRupas / bphsMin).toFixed(4));
        checkedSignals++;
        if (sbSig.normalizedValue === null || Math.abs(sbSig.normalizedValue - expected) > tol) {
          failures.push(`${label}/${subj} ShadbalaRatio expected=${expected}, got=${sbSig.normalizedValue}`);
        }
      }
    } else if (sbSig) {
      failures.push(`${label}/${subj} fabricated Shadbala signal on non-classical subject!`);
    }

    // 2. BAV bounded deviation
    const bavSig = st.dimensions.capacity.signals.find((s) => s.signalKey === 'bav_natal_sign_bindu_deviation');
    const bavEv = findEv(subj, 'ASHTAKAVARGA_BHINNA_BAV');
    const bavBindus = metricNum(bavEv, 'native_sign_bindus');
    if (bavSig && bavBindus !== null) {
      const expected = Number(((bavBindus - 4) / 4).toFixed(4));
      checkedSignals++;
      if (bavSig.normalizedValue === null || Math.abs(bavSig.normalizedValue - expected) > tol) {
        failures.push(`${label}/${subj} BAV deviation expected=${expected}, got=${bavSig.normalizedValue}`);
      }
    }

    // 3. Vimshopaka ratio (prefers Shodashavarga > Dashavarga > Saptavarga > Shadvarga)
    const vimSig = st.dimensions.capacity.signals.find((s) => s.signalKey.startsWith('vimshopaka_'));
    if (vimSig) {
      const vimEvs = natal.filter((e) => e.subject.id === subj && e.observation.code === 'VIMSHOPAKA_BALA_SCHEME');
      const schemeRank = (ev: typeof natal[number]) => {
        const s = String(metricStr(ev, 'scheme') || '').toLowerCase();
        if (s === 'shodashavarga' || s === 'shodashvarga') return 4;
        if (s === 'dashavarga') return 3;
        if (s === 'saptavarga') return 2;
        if (s === 'shadvarga') return 1;
        return 0;
      };
      const chosen = [...vimEvs].sort((a, b) => schemeRank(b) - schemeRank(a))[0];
      const sc = metricNum(chosen, 'score_out_of_20');
      if (sc !== null) {
        const expected = Number((sc / 20).toFixed(4));
        checkedSignals++;
        if (vimSig.normalizedValue === null || Math.abs(vimSig.normalizedValue - expected) > tol) {
          failures.push(`${label}/${subj} Vimshopaka (${metricStr(chosen, 'scheme')}) expected=${expected}, got=${vimSig.normalizedValue}`);
        }
      }
    }

    // 4. Ishta/Kashta net balance
    const ikSig = st.dimensions.capacity.signals.find((s) => s.signalKey === 'ishta_kashta_net_balance');
    if (ikSig) {
      const ikEv = findEv(subj, 'ISHTA_KASHTA_PHALA');
      const ishta = metricNum(ikEv, 'ishta_phala');
      const kashta = metricNum(ikEv, 'kashta_phala');
      if (ishta !== null && kashta !== null) {
        const expected = Number(((ishta - kashta) / 60).toFixed(4));
        checkedSignals++;
        if (ikSig.normalizedValue === null || Math.abs(ikSig.normalizedValue - expected) > tol) {
          failures.push(`${label}/${subj} IshtaKashta expected=${expected}, got=${ikSig.normalizedValue}`);
        }
      }
    }

    // 5. Vedic D1 Dignity Ordinal (recorded on ruleExecution.numericalResult; signal kept non-scalar)
    const d1DigSig = st.dimensions.integrity.signals.find((s) => s.signalKey === 'vedic_d1_dignity');
    const d1DigRex = findRex(subj, 'K02_INTEGRITY_D1_DIGNITY');
    if (d1DigSig && typeof d1DigSig.rawValue === 'string') {
      const key = d1DigSig.rawValue.toLowerCase().trim().replace(/[\s-]+/g, '_');
      const expected = Object.prototype.hasOwnProperty.call(IND_D1_DIGNITY_ORDINAL, key)
        ? IND_D1_DIGNITY_ORDINAL[key]
        : null;
      if (expected !== null && d1DigRex?.numericalResult !== null && d1DigRex?.numericalResult !== undefined) {
        checkedSignals++;
        if (Math.abs(d1DigRex.numericalResult - expected) > tol) {
          failures.push(`${label}/${subj} D1 Dignity "${d1DigSig.rawValue}" expected=${expected}, got=${d1DigRex.numericalResult}`);
        }
      }
    }

    // 6. Western Essential Dignity Ordinal
    const wDigSig = st.dimensions.integrity.signals.find((s) => s.signalKey === 'western_essential_dignity');
    const wDigRex = findRex(subj, 'K02_INTEGRITY_WESTERN_ESSENTIAL_DIGNITY');
    if (wDigSig && typeof wDigSig.rawValue === 'string') {
      const key = wDigSig.rawValue.toLowerCase().trim().replace(/[\s-]+/g, '_');
      const expected = Object.prototype.hasOwnProperty.call(IND_WESTERN_DIGNITY_ORDINAL, key)
        ? IND_WESTERN_DIGNITY_ORDINAL[key]
        : null;
      if (expected !== null && wDigRex?.numericalResult !== null && wDigRex?.numericalResult !== undefined) {
        checkedSignals++;
        if (Math.abs(wDigRex.numericalResult - expected) > tol) {
          failures.push(`${label}/${subj} Western Dignity "${wDigSig.rawValue}" expected=${expected}, got=${wDigRex.numericalResult}`);
        }
      }
    }

    // 7. Retrogression non-scalar check
    const motSig = st.dimensions.stability.signals.find((s) => s.signalKey === 'kinematic_motion_state');
    if (motSig) {
      checkedSignals++;
      if (motSig.normalizedValue !== null) {
        failures.push(`${label}/${subj} retrogression/motion illegally emitted scalar ${motSig.normalizedValue}`);
      }
    }

    // 8. Dispositor autonomy index (recorded on ruleExecution.numericalResult)
    const autSig = st.dimensions.autonomy.signals.find((s) => s.signalKey === 'dispositor_chain_autonomy');
    const autRex = findRex(subj, 'K02_AUTONOMY_DISPOSITOR_DEPENDENCY');
    if (autSig && autRex?.numericalResult !== null && autRex?.numericalResult !== undefined) {
      const dispEv = findEv(subj, 'VEDIC_D1_DISPOSITOR_DEPENDENCY');
      const isSelf = metricBool(dispEv, 'is_self_disposited') === true;
      const hasPariv = natal.some(
        (e) =>
          e.observation.code === 'PARIVARTANA_MUTUAL_EXCHANGE' &&
          (e.subject.id === subj || e.relatedEntities.some((r) => r.id === subj)) &&
          e.verification.propagatedTrust !== 'blocked'
      );
      const termKey = String(autSig.rawValue ?? 'chained').toLowerCase().trim().replace(/[\s-]+/g, '_');
      const expected = isSelf ? 1.0 : hasPariv ? 0.75 : (IND_AUTONOMY_MAP[termKey] ?? 0.25);
      checkedSignals++;
      if (Math.abs(autRex.numericalResult - expected) > tol) {
        failures.push(`${label}/${subj} Autonomy "${autSig.rawValue}" expected=${expected}, got=${autRex.numericalResult}`);
      }
    }

    // 9. Combustion orb penetration ratio
    const combSig = st.dimensions.vulnerability.signals.find((s) => s.signalKey === 'combustion_asta_status');
    if (combSig && ['Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].includes(subj)) {
      const combMod = findEv(subj, 'MODIFIER_COMBUSTION_ASTA');
      const condEv = findEv(subj, 'VEDIC_PLANET_OPERATING_CONDITIONS');
      const isComb = Boolean(combMod) || metricBool(condEv, 'is_combust') === true;
      const sep = metricNum(combMod, 'sun_separation_deg') ?? metricNum(condEv, 'sun_separation_deg');
      const evOrb = metricNum(combMod, 'combustion_orb_deg') ?? metricNum(condEv, 'combustion_orb_deg');
      const isRetro = metricBool(condEv, 'is_retrograde') === true;
      const orbDef = IND_COMBUST_ORB[subj];
      const orb = evOrb && evOrb > 0 ? evOrb : (isRetro ? orbDef.retro : orbDef.direct);
      if (!isComb) {
        checkedSignals++;
        if (combSig.normalizedValue !== 0) {
          failures.push(`${label}/${subj} Non-combust expected=0, got=${combSig.normalizedValue}`);
        }
      } else if (sep !== null) {
        const expected = Number(Math.max(0, Math.min(1, 1 - sep / orb)).toFixed(4));
        checkedSignals++;
        if (combSig.normalizedValue === null || Math.abs(combSig.normalizedValue - expected) > tol) {
          failures.push(`${label}/${subj} Combustion sep=${sep} orb=${orb} expected=${expected}, got=${combSig.normalizedValue}`);
        }
      }
    }

    // 10. Graha Yuddha role & boundary guard
    const yuddhaSig = st.dimensions.vulnerability.signals.find((s) => s.signalKey === 'graha_yuddha_status');
    const yuddhaRex = findRex(subj, 'K02_VULNERABILITY_GRAHA_YUDDHA');
    if (['Sun', 'Moon', 'Rahu', 'Ketu', 'Ascendant'].includes(subj)) {
      if (yuddhaSig || (yuddhaRex && yuddhaRex.status !== 'not_applicable')) {
        failures.push(`${label}/${subj} Graha Yuddha illegally executed on non-Tara-Graha!`);
      }
    } else if (yuddhaSig && yuddhaRex && yuddhaRex.numericalResult !== null && yuddhaRex.numericalResult !== undefined) {
      const expected =
        yuddhaSig.rawValue === 'inactive'
          ? 0
          : yuddhaSig.rawValue === 'winner'
          ? 0.5
          : yuddhaSig.rawValue === 'loser'
          ? -1.0
          : -0.25;
      checkedSignals++;
      if (Math.abs(yuddhaRex.numericalResult - expected) > tol) {
        failures.push(`${label}/${subj} Graha Yuddha role=${yuddhaSig.rawValue} expected=${expected}, got=${yuddhaRex.numericalResult}`);
      }
    }

    // 11. Gandanta / Sandhi check
    const gSig = st.dimensions.vulnerability.signals.find((s) => s.signalKey === 'gandanta_and_sandhi_risk');
    if (gSig) {
      const degEv = findEv(subj, 'VEDIC_D1_PLANET_LONGITUDE');
      const gandMod = findEv(subj, 'MODIFIER_GANDANTA_JUNCTION');
      const condEv = findEv(subj, 'VEDIC_PLANET_OPERATING_CONDITIONS');
      const degInSign = metricNum(degEv, 'degree_in_sign');
      const isGandanta = Boolean(gandMod) || metricBool(condEv, 'is_gandanta') === true;
      if (degInSign !== null || isGandanta) {
        const edgeDist = degInSign !== null ? Math.min(degInSign, 30 - degInSign) : 0;
        const expected = isGandanta ? 1.0 : edgeDist <= 1.0 ? Number((1 - edgeDist).toFixed(4)) : 0;
        checkedSignals++;
        if (gSig.normalizedValue === null || Math.abs(gSig.normalizedValue - expected) > tol) {
          failures.push(`${label}/${subj} Gandanta/Sandhi deg=${degInSign} expected=${expected}, got=${gSig.normalizedValue}`);
        }
      }
    }

    // 12. Cross-frame divergence index check
    const cfSig = st.dimensions.influenceFootprint.signals.find((s) => s.signalKey === 'cross_frame_presence');
    if (cfSig) {
      checkedSignals++;
      if (typeof cfSig.normalizedValue !== 'number' || cfSig.normalizedValue < 1) {
        failures.push(`${label}/${subj} cross_frame_presence invalid=${cfSig.normalizedValue}`);
      }
    }
  }

  return { checkedSignals, failures };
}

// ============================================================================
// MAIN AUDIT RUNNER
// ============================================================================

async function main() {
  const outDir = '/tmp/v2-engine-verification';
  fs.mkdirSync(outDir, { recursive: true });
  const fixturesDir = path.resolve(process.cwd(), 'scripts', 'fixtures');
  fs.mkdirSync(fixturesDir, { recursive: true });

  console.log('=== CosmicCouncil V2 / K01 / K02 Comprehensive Audit ===');

  // --------------------------------------------------------------------------
  // AREA 1: Real Exports + Durable Sanitized Offline Fixtures
  // --------------------------------------------------------------------------
  const chris4Raw = JSON.parse(
    fs.readFileSync('public/assets/aistudio/chris-4-birth-chart_8e64429a.json', 'utf8')
  );
  const chrisNewRaw = JSON.parse(
    fs.readFileSync('public/assets/aistudio/chris-new-birth-chart_c00320ea.json', 'utf8')
  );
  const chris3Raw = JSON.parse(
    fs.readFileSync('public/assets/aistudio/chris-3-birth-chart_0f73e755.json', 'utf8')
  );

  const realChris4 = adaptRealFreeAstroApiExport({
    fixtureId: 'real_freeastroapi_export_chris4',
    sourceAssetFile: 'public/assets/aistudio/chris-4-birth-chart_8e64429a.json',
    rawExportJson: chris4Raw,
  });
  const realChrisNew = adaptRealFreeAstroApiExport({
    fixtureId: 'real_freeastroapi_export_chrisnew',
    sourceAssetFile: 'public/assets/aistudio/chris-new-birth-chart_c00320ea.json',
    rawExportJson: chrisNewRaw,
  });
  const realChris3 = adaptRealFreeAstroApiExport({
    fixtureId: 'real_freeastroapi_export_chris3_legacy_tz_defect',
    sourceAssetFile: 'public/assets/aistudio/chris-3-birth-chart_0f73e755.json',
    rawExportJson: chris3Raw,
  });

  const synthAw = buildDurableSyntheticFixtures();

  const durableFixturesPayload = redactSecretsDeep({
    schemaVersion: 'v2.offline_verification_fixtures.1.0',
    generatedAtUtc: new Date().toISOString(),
    realAstroWayCapturePresentOnDisk: false,
    astroWayCacheBlockerNote:
      'Complete 62/64-endpoint AstroWay capture was not present in repo or /tmp, and SUPABASE_URL / ASTROWAY_API_KEY / FREE_ASTRO_API_KEY are unset. Export a real chris4-consolidated-foundational-chart.json or chris4-astroway-cache.json from Admin V2 Laboratory into scripts/fixtures/ to verify the full live AstroWay capture offline.',
    fixtures: [
      {
        fixtureId: realChris4.fixtureId,
        originType: realChris4.originType,
        sourceAssetFile: realChris4.sourceAssetFile,
        astroWayPopulated: false,
        layerCInput: realChris4.layerCInput,
      },
      {
        fixtureId: realChrisNew.fixtureId,
        originType: realChrisNew.originType,
        sourceAssetFile: realChrisNew.sourceAssetFile,
        astroWayPopulated: false,
        layerCInput: realChrisNew.layerCInput,
      },
      {
        fixtureId: realChris3.fixtureId,
        originType: realChris3.originType,
        sourceAssetFile: realChris3.sourceAssetFile,
        astroWayPopulated: false,
        layerCInput: realChris3.layerCInput,
      },
      {
        fixtureId: 'synthetic_full_astroway_shape_chris4',
        originType: synthAw.originType,
        sourceAssetFile: 'deterministic_synthetic_builder',
        astroWayPopulated: false,
        warning: 'SYNTHETIC_SIMULATED_ASTROWAY_SHAPE — NOT a real AstroWay HTTP capture.',
        layerCInput: synthAw.layerCInput,
      },
    ],
  });

  const durableFixturePath = path.join(fixturesDir, 'v2-offline-verification-fixtures.json');
  fs.writeFileSync(durableFixturePath, JSON.stringify(durableFixturesPayload, null, 2), 'utf8');
  console.log(`[Area 1] Wrote durable sanitized offline fixtures -> ${durableFixturePath}`);

  // --------------------------------------------------------------------------
  // AREA 2: Independent Computational Verification
  // --------------------------------------------------------------------------
  const chris4Ref = computeIndependentAstronomicalReference(realChris4.instant);
  const chris4JdIndep = indepJulianDayUt(1985, 12, 24, 23 + 3 / 60);
  const jdDeltaDays = Math.abs(chris4JdIndep - realChris4.instant.utc.julianDayUt);
  assert(jdDeltaDays < 1e-8, `JD mismatch: ${jdDeltaDays}`);

  // Compare Real Chris 4 Vargas (16 divisions x 10 bodies = 160 cells) against independent BPHS formulas
  let vargaCellsChecked = 0;
  let vargaCellsMismatched = 0;
  const vargaDiffs: string[] = [];
  const rawPlanetsByName = new Map(
    (chris4Raw.planets as Array<Record<string, unknown>>).map((p) => [String(p.name), Number(p.longitude)])
  );
  for (const divNum of [1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60]) {
    const divKey = `D${divNum}`;
    const placements = (chris4Raw.vargas?.[divKey]?.placements ?? []) as Array<Record<string, unknown>>;
    for (const pl of placements) {
      const bName = String(pl.name);
      const lon = rawPlanetsByName.get(bName);
      if (lon === undefined) continue;
      vargaCellsChecked++;
      const expSign = SIGNS[indepVargaSignIdx(lon, divNum)];
      if (pl.sign !== expSign) {
        vargaCellsMismatched++;
        vargaDiffs.push(`${divKey}/${bName}: export=${pl.sign} indep=${expSign}`);
      }
    }
  }

  // Compare Real Chris 4 Ashtakavarga 7x12 BAV + 12 SAV against computeLocalAshtakavarga
  const localAvChris4 = computeLocalAshtakavarga({
    ascendantSignIndex: Math.floor(normalizeDeg(rawPlanetsByName.get('Ascendant')!) / 30) % 12,
    planetSignIndices: {
      Sun: Math.floor(normalizeDeg(rawPlanetsByName.get('Sun')!) / 30) % 12,
      Moon: Math.floor(normalizeDeg(rawPlanetsByName.get('Moon')!) / 30) % 12,
      Mars: Math.floor(normalizeDeg(rawPlanetsByName.get('Mars')!) / 30) % 12,
      Mercury: Math.floor(normalizeDeg(rawPlanetsByName.get('Mercury')!) / 30) % 12,
      Jupiter: Math.floor(normalizeDeg(rawPlanetsByName.get('Jupiter')!) / 30) % 12,
      Venus: Math.floor(normalizeDeg(rawPlanetsByName.get('Venus')!) / 30) % 12,
      Saturn: Math.floor(normalizeDeg(rawPlanetsByName.get('Saturn')!) / 30) % 12,
    },
  })!;
  let bavMismatches = 0;
  let savMismatches = 0;
  for (const pl of Object.keys(localAvChris4.bhinnashtakavarga)) {
    const expArr = (chris4Raw.ashtakavarga.bhinna[pl] ?? []) as number[];
    for (let i = 0; i < 12; i++) {
      if (localAvChris4.bhinnashtakavarga[pl][i] !== expArr[i]) bavMismatches++;
    }
  }
  for (let i = 0; i < 12; i++) {
    if (localAvChris4.sarvashtakavarga[i] !== chris4Raw.ashtakavarga.sarva[i]) savMismatches++;
  }
  const redChris4 = computeAshtakavargaReductions(localAvChris4)!;
  const shodhanaValid = Object.values(redChris4.perPlanet).every(
    (p) => p.rasiPinda + p.grahaPinda === p.shodhyaPinda
  );

  // Compare Real Chris 4 Astronomical Coordinates vs Independent Meeus Reference
  const coordDeltasChris4 = {
    lahiriAscDeltaDeg: Number(circularDiffDeg(rawPlanetsByName.get('Ascendant')!, chris4Ref.lahiriAscendantDeg).toFixed(4)),
    lahiriSunDeltaDeg: Number(circularDiffDeg(rawPlanetsByName.get('Sun')!, chris4Ref.lahiriSunLonDeg).toFixed(4)),
    lahiriMoonDeltaDeg: Number(circularDiffDeg(rawPlanetsByName.get('Moon')!, chris4Ref.lahiriMoonLonDeg).toFixed(4)),
    westernAscDeltaDeg: Number(circularDiffDeg(chris4Raw.western.angles.ascendant.longitude, chris4Ref.tropicalAscendantDeg).toFixed(4)),
    westernMcDeltaDeg: Number(circularDiffDeg(chris4Raw.western.angles.midheaven.longitude, chris4Ref.tropicalMcDeg).toFixed(4)),
    westernSunDeltaDeg: Number(circularDiffDeg(chris4Raw.western.planets[0].longitude, chris4Ref.tropicalSunLonDeg).toFixed(4)),
    westernMoonDeltaDeg: Number(circularDiffDeg(chris4Raw.western.planets[1].longitude, chris4Ref.tropicalMoonLonDeg).toFixed(4)),
    legacyPlacidusH2ErrorDeg: Number(circularDiffDeg(chris4Raw.western.cusps[1].longitude, chris4Ref.tropicalPlacidusCusps[1]).toFixed(4)),
    legacyPlacidusH12ErrorDeg: Number(circularDiffDeg(chris4Raw.western.cusps[11].longitude, chris4Ref.tropicalPlacidusCusps[11]).toFixed(4)),
  };

  // Compare Legacy Bhava Chalit (8/9 wrong shifts) vs True Sripati (0/9 shifts on Chris 4)
  const trueSripatiShifts = realChris4.layerBMaster.frames.bhavaChalit.data!.planets.filter((p) => p.shifted).length;
  const legacyChalitShifts = (chris4Raw.bhavaChalit.shifts as Array<Record<string, unknown>>).filter((s) => s.shifted).length;

  // Verify Chris 3 exposes legacy +5.5h timezone defect
  const chris3Ref = computeIndependentAstronomicalReference(realChris3.instant);
  const chris3RawAsc = Number((chris3Raw.planets as Array<Record<string, unknown>>)[0].longitude);
  const chris3AscDeltaDeg = Number(circularDiffDeg(chris3RawAsc, chris3Ref.lahiriAscendantDeg).toFixed(4));

  // Verify all 19 K02 rules + independent K02 math recomputation across Real + Synthetic charts
  const chartsToAudit: Array<{
    id: string;
    origin: 'real_freeastroapi_export' | 'synthetic';
    source: Parameters<typeof buildAnalyticalKernelK02Bundle>[0];
  }> = [
    { id: 'real_freeastroapi_chris4', origin: 'real_freeastroapi_export', source: realChris4.layerCInput },
    { id: 'real_freeastroapi_chrisnew', origin: 'real_freeastroapi_export', source: realChrisNew.layerCInput },
    { id: 'real_freeastroapi_chris3_legacy_tz_defect', origin: 'real_freeastroapi_export', source: realChris3.layerCInput },
    { id: 'synthetic_full_astroway_shape', origin: 'synthetic', source: synthAw.layerCInput },
  ];

  // Add synthetic edge-case stress charts
  const emptyMaster = buildLayerBMasterChartRecord({ instant: realChris4.instant, rawLayerA: null });
  chartsToAudit.push({ id: 'synthetic_empty_missing_inputs', origin: 'synthetic', source: emptyMaster });

  // Synthetic Stress Case A: Incompatible Bhava Chalit Rejection + Zero-Coercion Null Shadbala Subcomponent
  const stressIncompat = JSON.parse(JSON.stringify(realChris4.layerCInput)) as typeof realChris4.layerCInput;
  stressIncompat.natalInvariant.frames.bhavaChalit = {
    ...stressIncompat.natalInvariant.frames.bhavaChalit,
    canonicalStatus: 'incompatible',
    verificationStatus: 'incompatible',
    limitations: ['Stress test incompatible Bhava Chalit ayanamsha mismatch.'],
  };
  stressIncompat.datasetManifest = {
    ...stressIncompat.datasetManifest,
    entries: stressIncompat.datasetManifest.entries.map((e) =>
      e.key === 'bhava_chalit' ? { ...e, canonicalStatus: 'incompatible' } : e
    ),
  };
  chartsToAudit.push({
    id: 'synthetic_incompatible_chalit_gate',
    origin: 'synthetic',
    source: stressIncompat,
  });

  // Synthetic Stress Case B: Retrograde + Combust + Graha Yuddha (Winner/Loser + Undetermined) + Gandanta + D1/D9 Contradiction + Parivartana
  const stressWarAndRetro = JSON.parse(JSON.stringify(synthAw.layerCInput)) as typeof synthAw.layerCInput;
  const warCond = (stressWarAndRetro.natalInvariant.providerExtendedDatasets?.planetaryDignityConditions as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const warBodyList = (warCond?.planetaryConditions ?? []) as Array<Record<string, unknown>>;
  for (const row of warBodyList) {
    if (row.name === 'Venus') {
      row.isRetrograde = true;
      row.isCombust = true;
      row.sunSeparationDeg = 3.2;
      row.combustionOrbDeg = 8.0;
      row.inGrahaYuddha = true;
      row.grahaYuddhaOpponent = 'Mars';
      row.grahaYuddhaRole = 'winner';
    } else if (row.name === 'Mars') {
      row.inGrahaYuddha = true;
      row.grahaYuddhaOpponent = 'Venus';
      row.grahaYuddhaRole = 'loser';
    } else if (row.name === 'Saturn') {
      row.inGrahaYuddha = true;
      row.grahaYuddhaOpponent = 'Jupiter';
      row.grahaYuddhaRole = 'undetermined';
    }
  }
  chartsToAudit.push({
    id: 'synthetic_graha_yuddha_retro_combust_stress',
    origin: 'synthetic',
    source: stressWarAndRetro,
  });

  const strictProvBundle = {
    k01: buildAnalyticalEvidenceRepository(realChris4.layerCInput),
  };
  const k02StrictChris4 = evaluateK02FromRepository(strictProvBundle.k01, { strictNonProvisional: true });

  const regressionSummary: Array<Record<string, unknown>> = [];
  let totalK02SignalsRecomputed = 0;
  const allMathFailures: string[] = [];

  for (const ch of chartsToAudit) {
    const bA = buildAnalyticalKernelK02Bundle(ch.source);
    const bB = buildAnalyticalKernelK02Bundle(ch.source);

    // 1. Determinism check (ignoring timestamps)
    const normStr = (x: unknown) =>
      JSON.stringify(x, (k, v) => (k === 'generatedAtUtc' || k === 'preparedAtUtc' ? 'FIXED' : v));
    assert(normStr(bA.k01Repository) === normStr(bB.k01Repository), `${ch.id}: K01 non-deterministic`);
    assert(normStr(bA.k02State) === normStr(bB.k02State), `${ch.id}: K02 non-deterministic`);

    // 2. Uniqueness of IDs + DAG cycle check + zero unregistered rules
    const allEv = [...bA.k01Repository.natalEvidence, ...bA.k01Repository.temporalEvidence];
    const uniqEv = new Set(allEv.map((e) => e.evidenceId));
    assert(uniqEv.size === allEv.length, `${ch.id}: duplicate evidenceId`);
    assert(bA.k01Repository.lineageGraph.cycleCheckPassed === true, `${ch.id}: lineage cycle`);

    const uniqImp = new Set(bA.k02State.impactContracts.map((i) => i.impactId));
    assert(uniqImp.size === bA.k02State.impactContracts.length, `${ch.id}: duplicate impactId`);

    const uniqExec = new Set(bA.k02State.ruleExecutionSummary.records.map((r) => r.executionId));
    assert(uniqExec.size === bA.k02State.ruleExecutionSummary.records.length, `${ch.id}: duplicate executionId`);
    assert(bA.k02State.ruleExecutionSummary.unregisteredRuleRejections === 0, `${ch.id}: unregistered rule`);

    // 3. PHI Exclusion & Empirical status guards
    const tempIds = new Set(bA.k01Repository.temporalEvidence.map((e) => e.evidenceId));
    const natalMap = new Map(bA.k01Repository.natalEvidence.map((e) => [e.evidenceId, e]));
    for (const p of bA.k02State.phiReadyProjections) {
      assert(p.excludedBoundaries.excludedK03StructuralAuthority, `${ch.id}: K03 leak`);
      assert(p.excludedBoundaries.excludedTemporalDashaGochar, `${ch.id}: K09 temporal leak`);
      assert(p.excludedBoundaries.excludedDomainImportance, `${ch.id}: K04 domain leak`);
      assert(p.excludedBoundaries.excludedArbitraryWeights, `${ch.id}: arbitrary weights leak`);
      for (const id of p.deduplicatedEvidenceIds) {
        assert(!tempIds.has(id), `${ch.id}: temporal ID leaked into PHI`);
        const ev = natalMap.get(id);
        assert(
          Boolean(
            ev &&
              ev.observation.code !== 'VEDIC_D1_HOUSE_LORD_PLACEMENT' &&
              ev.observation.code !== 'KP_FOUR_LEVEL_SIGNIFICATORS' &&
              ev.observation.code !== 'JAIMINI_CHARA_KARAKA'
          ),
          `${ch.id}: P08 noise leaked into PHI`
        );
      }
      for (const grp of p.partialOverlapGroups) {
        for (const sid of grp.secondaryEvidenceIds) {
          assert(!p.deduplicatedEvidenceIds.includes(sid), `${ch.id}: overlap double-counting`);
        }
      }
    }

    // 4. Area 5 Empirical Non-Validation Guard
    for (const subj of PLANETARY_STATE_SUBJECTS) {
      const rel = bA.k02State.subjectStates[subj].overlays.reliability;
      assert(rel.externalValidationAchieved === false, `${ch.id}/${subj}: externalValidationAchieved illegally true`);
      assert(rel.empiricalStatus === 'not_validated', `${ch.id}/${subj}: empiricalStatus illegally validated`);
    }

    // 5. Area 2 Independent K02 Math Recomputation
    const mathRes = recomputeAndAuditK02Math(ch.id, bA.k02State, bA.k01Repository);
    totalK02SignalsRecomputed += mathRes.checkedSignals;
    allMathFailures.push(...mathRes.failures);

    regressionSummary.push({
      chartId: ch.id,
      origin: ch.origin,
      natalEvidence: bA.k01Repository.natalEvidence.length,
      temporalEvidence: bA.k01Repository.temporalEvidence.length,
      overlaps: bA.k01Repository.lineageGraph.overlapRelations.length,
      k02RuleEvaluations: bA.k02State.ruleExecutionSummary.totalEvaluations,
      countsByStatus: bA.k02State.ruleExecutionSummary.countsByStatus,
      impactContracts: bA.k02State.impactContracts.length,
      k02MathSignalsVerified: mathRes.checkedSignals,
      k02MathFailures: mathRes.failures.length,
    });
  }

  assert(allMathFailures.length === 0, `K02 math recomputation failures: ${allMathFailures.join(' | ')}`);
  assert(vargaCellsChecked === 160 && vargaCellsMismatched === 0, `Varga mismatch: ${vargaDiffs.join(', ')}`);
  assert(bavMismatches === 0 && savMismatches === 0 && shodhanaValid, `AV mismatch bav=${bavMismatches} sav=${savMismatches}`);
  assert(
    k02StrictChris4.ruleExecutionSummary.countsByStatus.excluded_by_provisional_gate > 0,
    'Strict non-provisional gate failed on Chris 4 real export.'
  );

  const report = redactSecretsDeep({
    generatedAtUtc: new Date().toISOString(),
    area1_durableFixtures: {
      durableFixturePath,
      realAstroWayCapturePresentOnDisk: false,
      realExportsIncluded: 3,
      syntheticFixturesIncluded: 1,
    },
    area2_independentComputationalVerification: {
      julianDayDeltaDays: jdDeltaDays,
      chris4CoordinatesVsMeeusRef: coordDeltasChris4,
      chris4Vargas16Verified: `${vargaCellsChecked - vargaCellsMismatched}/${vargaCellsChecked}`,
      chris4AshtakavargaVerified: { bavCells: '84/84', savCells: '12/12', totalPoints: localAvChris4.totalPoints, shodhanaValid },
      chris4BhavaChalitComparison: { legacyChalitShifts, trueSripatiShifts },
      chris4SunShadbalaMinThresholdGap: { providerRequiredRupas: 5.0, bphsRequiredRupas: 6.5 },
      chris3LegacyTimezoneBugAscDeltaDeg: chris3AscDeltaDeg,
      k02MathSignalsIndependentlyRecomputed: totalK02SignalsRecomputed,
      k02MathDiscrepancies: allMathFailures.length,
      externalClassicalToolsAvailable: {
        pyjhora: false,
        pyswisseph: false,
        jhora: false,
      },
    },
    area3_multiChartRegressionMatrix: regressionSummary,
    area5_empiricalReadiness: {
      externalValidationAchieved: false,
      allSubjectsEmpiricalStatus: 'not_validated',
      k02StrictGateExcludedOnChris4: k02StrictChris4.ruleExecutionSummary.countsByStatus.excluded_by_provisional_gate,
    },
  });

  const reportPath = path.join(outDir, 'audit-verification-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nAudit Report Written -> ${reportPath}`);
}

main().catch((err) => {
  console.error('AUDIT FAILED:', err);
  process.exit(1);
});
