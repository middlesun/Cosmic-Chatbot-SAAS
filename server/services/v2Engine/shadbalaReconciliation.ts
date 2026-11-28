/**
 * Isolated V2 Engine — Shadbala Reconciliation Module
 *
 * Compares:
 *   1. Provider-native Shadbala (FreeAstroAPI /api/v2/vedic/calculate or AstroWay /vedic/shadbala/*)
 *   2. Legacy local Shadbala (computeShadbala in jyotishMath.ts)
 *   3. Independent BPHS Reference checks (Naisargika, Uchcha, Ojayugma, Drekkana,
 *      Kendradi [Whole-Sign vs Sripati Bhava vs Placidus], Saptavargaja [Natural vs
 *      5-fold Panchadha Maitri], Dig Bala [Placidus vs Equal-90°], Paksha Bala,
 *      Sun 5.0 vs 6.5 Rupa threshold, Ishta & Kashta Phala, and Cheshta luminary conventions)
 *
 * Never mutates provider values, never averages conflicting datasets, and
 * keeps authoritativeDesignation = 'unassigned_pending_reconciliation' until
 * live reconciliation is inspected and approved.
 *
 * Alignment Note (Pre-K03/K04 Issue Register):
 *   All 8 unresolved Shadbala, Bhavabala, Nodal, and Vimshottari discrepancies
 *   are locked in `docs/SHADBALA_BHAVABALA_ISSUE_REGISTER.md`. This module stays
 *   strictly observational/diagnostic (no Canonical Strength Calculation Engine)
 *   while downstream `shadbala_major_6` and `bhavabala` remain `provisional`.
 */

import {
  computeShadbala,
  getVargaSignIndex,
  normalizeDeg,
  type PlanetPosition,
} from '../jyotishMath';
import {
  circularContainsLon,
  computeIndependentAstronomicalReference,
} from './verifier';
import type {
  CanonicalBirthInstant,
  ShadbalaMethodologicalInvestigation,
  ShadbalaPlanetComparison,
  ShadbalaReconciliationReport,
} from './types';

const SEVEN_PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'] as const;

const NAISARGIKA_BPHS: Record<string, number> = {
  Sun: 60.0,
  Moon: 51.43,
  Mars: 17.14,
  Mercury: 25.71,
  Jupiter: 34.29,
  Venus: 42.86,
  Saturn: 8.57,
};

const EXALT_DEGREES_BPHS: Record<string, number> = {
  Sun: 10, // Aries 10°
  Moon: 33, // Taurus 3°
  Mars: 298, // Capricorn 28°
  Mercury: 165, // Virgo 15°
  Jupiter: 95, // Cancer 5°
  Venus: 357, // Pisces 27°
  Saturn: 200, // Libra 20°
};

const BPHS_CLASSICAL_MIN_RUPAS: Record<string, number> = {
  Sun: 6.5, // 390 Virupas per BPHS (vs 5.0 often seen in modern software)
  Moon: 6.0, // 360 Virupas
  Mars: 5.0, // 300 Virupas
  Mercury: 7.0, // 420 Virupas
  Jupiter: 6.5, // 390 Virupas
  Venus: 5.5, // 330 Virupas
  Saturn: 5.0, // 300 Virupas
};

const SIGN_LORDS = [
  'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
];

const MOOLATRIKONA_SIGNS: Record<string, number> = {
  Sun: 4,     // Leo
  Moon: 1,    // Taurus
  Mars: 0,    // Aries
  Mercury: 5, // Virgo
  Jupiter: 8, // Sagittarius
  Venus: 6,   // Libra
  Saturn: 10, // Aquarius
};

const OWN_SIGNS: Record<string, number[]> = {
  Sun: [4],
  Moon: [3],
  Mars: [0, 7],
  Mercury: [2, 5],
  Jupiter: [8, 11],
  Venus: [1, 6],
  Saturn: [9, 10],
};

const NATURAL_FRIENDS: Record<string, { friends: string[]; neutral: string[]; enemies: string[] }> = {
  Sun: { friends: ['Moon', 'Mars', 'Jupiter'], neutral: ['Mercury'], enemies: ['Venus', 'Saturn'] },
  Moon: { friends: ['Sun', 'Mercury'], neutral: ['Mars', 'Jupiter', 'Venus', 'Saturn'], enemies: [] },
  Mars: { friends: ['Sun', 'Moon', 'Jupiter'], neutral: ['Venus', 'Saturn'], enemies: ['Mercury'] },
  Mercury: { friends: ['Sun', 'Venus'], neutral: ['Mars', 'Jupiter', 'Saturn'], enemies: ['Moon'] },
  Jupiter: { friends: ['Sun', 'Moon', 'Mars'], neutral: ['Saturn'], enemies: ['Mercury', 'Venus'] },
  Venus: { friends: ['Mercury', 'Saturn'], neutral: ['Mars', 'Jupiter'], enemies: ['Sun', 'Moon'] },
  Saturn: { friends: ['Mercury', 'Venus'], neutral: ['Jupiter'], enemies: ['Sun', 'Moon', 'Mars'] },
};

export const UNAVAILABLE_SHADBALA_SUBCOMPONENTS: string[] = [
  'Sthana Bala -> Uchcha Bala (exact breakdown)',
  'Sthana Bala -> Saptavargaja Bala (Rashi/D2/D3/D7/D9/D12/D30 compound friendship)',
  'Sthana Bala -> Ojayugma Rashi/Amsha Bala',
  'Sthana Bala -> Kendradi Bala',
  'Sthana Bala -> Drekkana Bala',
  'Kala Bala -> Natonnata Bala (true sunrise/sunset basis)',
  'Kala Bala -> Paksha Bala (with benefic/malefic polarity)',
  'Kala Bala -> Tribhaga Bala',
  'Kala Bala -> Varsha / Masa / Dina / Hora Bala (Abda, Masa, Vara, Hora)',
  'Kala Bala -> Ayana Bala (true declination formula)',
  'Kala Bala -> Yuddha Bala (planetary war adjustment)',
  'Cheshta Bala (sub-components / Vakri / Vikala / Anuvakri speed rules)',
  'Ishta Phala & Kashta Phala (provider-native)',
  'Bhavabala (Bhava Digbala + Bhava Adhipati + Bhava Drishti)',
  'Vimshopaka Bala (Shadvarga / Saptavarga / Dashavarga / Shodashavarga)',
];

function circularDiffDeg(a: number, b: number): number {
  let d = normalizeDeg(a) - normalizeDeg(b);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

function calcUchchaBalaBphs(planet: string, siderealLon: number): number {
  const exaltDeg = EXALT_DEGREES_BPHS[planet];
  if (exaltDeg === undefined) return 0;
  const debilDeg = normalizeDeg(exaltDeg + 180);
  const distFromDebil = Math.abs(circularDiffDeg(siderealLon, debilDeg));
  return round2((distFromDebil / 180) * 60);
}

function calcOjayugmaBalaBphs(planet: string, siderealLon: number): number {
  const isFemale = planet === 'Moon' || planet === 'Venus';
  const rashiEven = (Math.floor(normalizeDeg(siderealLon) / 30) % 12) % 2 === 1;
  const navEven = getVargaSignIndex(siderealLon, 9) % 2 === 1;
  let score = 0;
  if ((isFemale && rashiEven) || (!isFemale && !rashiEven)) score += 15;
  if ((isFemale && navEven) || (!isFemale && !navEven)) score += 15;
  return score;
}

function calcDrekkanaBalaBphs(planet: string, siderealLon: number): number {
  const degInSign = normalizeDeg(siderealLon) % 30;
  const part = Math.floor(degInSign / 10);
  if (
    (part === 0 && ['Sun', 'Mars', 'Jupiter'].includes(planet)) ||
    (part === 1 && ['Saturn', 'Mercury'].includes(planet)) ||
    (part === 2 && ['Moon', 'Venus'].includes(planet))
  ) {
    return 15;
  }
  return 0;
}

function calcKendradiFromHouse(houseNum: number): number {
  if ([1, 4, 7, 10].includes(houseNum)) return 60;
  if ([2, 5, 8, 11].includes(houseNum)) return 30;
  return 15;
}

function calcDigBalaPoint(siderealLon: number, maxStrengthLon: number): number {
  const powerlessLon = normalizeDeg(maxStrengthLon + 180);
  const arc = Math.abs(circularDiffDeg(siderealLon, powerlessLon));
  return round2((arc / 180) * 60);
}

function isTatkalikaFriend(planetSignIdx: number, otherSignIdx: number): boolean {
  const relHouse = ((otherSignIdx - planetSignIdx + 12) % 12) + 1;
  return [2, 3, 4, 10, 11, 12].includes(relHouse);
}

function getNaturalSignScore(planet: string, signIdx: number): number {
  if (MOOLATRIKONA_SIGNS[planet] === signIdx) return 45;
  if (OWN_SIGNS[planet]?.includes(signIdx)) return 30;
  const lord = SIGN_LORDS[signIdx];
  const rel = NATURAL_FRIENDS[planet];
  if (!rel) return 15;
  if (rel.friends.includes(lord)) return 22.5;
  if (rel.neutral.includes(lord)) return 15;
  return 7.5;
}

function getPanchadhaSignScore(
  planet: string,
  signIdx: number,
  divIdx: number,
  planetSignIdxD1: Map<string, number>
): number {
  // BPHS 5-fold compound friendship (Moolatrikona=45 in D1; Own=30; Adhi Mitra=22.5; Mitra=15; Sama=10; Shatru=7.5; Adhi Shatru=3.75)
  if (divIdx === 1 && MOOLATRIKONA_SIGNS[planet] === signIdx) return 45;
  if (OWN_SIGNS[planet]?.includes(signIdx)) return 30;

  const lord = SIGN_LORDS[signIdx];
  if (lord === planet) return 30;

  const pD1 = planetSignIdxD1.get(planet);
  const lordD1 = planetSignIdxD1.get(lord);
  const rel = NATURAL_FRIENDS[planet];
  if (!rel) return 10;

  const naturalVal = rel.friends.includes(lord) ? 1 : rel.neutral.includes(lord) ? 0 : -1;
  const tatkalikaVal =
    pD1 !== undefined && lordD1 !== undefined
      ? isTatkalikaFriend(pD1, lordD1)
        ? 1
        : -1
      : 0;
  const compound = naturalVal + tatkalikaVal;
  if (compound >= 2) return 22.5; // Adhi Mitra
  if (compound === 1) return 15;  // Mitra
  if (compound === 0) return 10;  // Sama
  if (compound === -1) return 7.5; // Shatru
  return 3.75; // Adhi Shatru
}

function findHouseInSandhis(
  lon: number,
  sandhis: Array<{ house: number; start: number; end: number }>
): number {
  for (const s of sandhis) {
    if (circularContainsLon(s.start, s.end, lon)) return s.house;
  }
  return 1;
}

function findHouseInCusps12(lon: number, cusps: number[]): number | null {
  if (cusps.length !== 12) return null;
  for (let i = 0; i < 12; i++) {
    if (circularContainsLon(cusps[i], cusps[(i + 1) % 12], lon)) return i + 1;
  }
  return null;
}

function asObj(val: unknown): Record<string, unknown> | null {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : null;
}

function asObjArr(val: unknown): Array<Record<string, unknown>> {
  return Array.isArray(val)
    ? (val.filter((x) => x && typeof x === 'object') as Array<Record<string, unknown>>)
    : [];
}

function findRowByPlanet(
  rawObj: Record<string, unknown> | null | undefined,
  planet: string
): Record<string, unknown> | null {
  if (!rawObj) return null;
  const items = asObjArr(rawObj.items);
  if (items.length > 0) {
    const match = items.find(
      (r) => String(r.planetName ?? r.planet ?? r.name ?? '').trim().toLowerCase() === planet.toLowerCase()
    );
    if (match) return match;
  }
  const direct = asObj(rawObj[planet]);
  if (direct) return direct;
  return null;
}

export function buildShadbalaReconciliationReport(params: {
  instant: CanonicalBirthInstant;
  providerShadbalaRaw: Record<string, Record<string, unknown>> | null;
  providerStrengthMetadata?: Record<string, unknown> | null;
  canonicalLahiriPlanets: PlanetPosition[];
  lahiriAscDeg: number;
  lahiriMcDeg?: number | null;
  placidusLahiriCusps?: { h1: number; h4: number; h7: number; h10: number } | null;
  placidusLahiriCusps12?: number[] | null;
  providerSthanaRaw?: Record<string, unknown> | null;
  providerKalaRaw?: Record<string, unknown> | null;
  providerIshtaKashtaRaw?: Record<string, unknown> | null;
}): ShadbalaReconciliationReport {
  const {
    instant,
    providerShadbalaRaw,
    providerStrengthMetadata,
    canonicalLahiriPlanets,
    lahiriAscDeg,
    lahiriMcDeg,
    placidusLahiriCusps,
    placidusLahiriCusps12,
    providerSthanaRaw,
    providerKalaRaw,
  } = params;

  const indepRef = computeIndependentAstronomicalReference(instant);

  // Run legacy local Shadbala on the SAME canonical local date/time & canonical Lahiri planets
  const localReport =
    canonicalLahiriPlanets.length >= 8
      ? computeShadbala(canonicalLahiriPlanets, instant.input.birthDate, instant.input.birthTime)
      : null;

  // Derive provider ranking
  const providerEntries: Array<{ planet: string; ratio: number }> = [];
  if (providerShadbalaRaw) {
    for (const p of SEVEN_PLANETS) {
      const row = providerShadbalaRaw[p];
      if (row && typeof row.ratio === 'number') {
        providerEntries.push({ planet: p, ratio: Number(row.ratio) });
      }
    }
  }
  providerEntries.sort((a, b) => b.ratio - a.ratio);
  const providerRankMap = new Map<string, number>();
  providerEntries.forEach((e, idx) => providerRankMap.set(e.planet, idx + 1));

  const sunLon = canonicalLahiriPlanets.find((p) => p.name === 'Sun')?.longitude ?? null;
  const moonLon = canonicalLahiriPlanets.find((p) => p.name === 'Moon')?.longitude ?? null;

  const h1 = placidusLahiriCusps?.h1 ?? lahiriAscDeg;
  const h4 =
    placidusLahiriCusps?.h4 ??
    (lahiriMcDeg !== undefined && lahiriMcDeg !== null
      ? normalizeDeg(lahiriMcDeg + 180)
      : normalizeDeg(lahiriAscDeg + 90));
  const h7 = placidusLahiriCusps?.h7 ?? normalizeDeg(h1 + 180);
  const h10 =
    placidusLahiriCusps?.h10 ??
    (lahiriMcDeg !== undefined && lahiriMcDeg !== null
      ? lahiriMcDeg
      : normalizeDeg(lahiriAscDeg + 270));

  const effectivePlacidus12 =
    placidusLahiriCusps12 && placidusLahiriCusps12.length === 12
      ? placidusLahiriCusps12
      : indepRef.tropicalPlacidusCusps.map((c) =>
          normalizeDeg(c - instant.astronomy.lahiriAyanamsaApproxDeg)
        );

  const ascSignIdx = Math.floor(normalizeDeg(lahiriAscDeg) / 30) % 12;
  const planetSignIdxD1 = new Map<string, number>();
  for (const pl of canonicalLahiriPlanets) {
    if (SEVEN_PLANETS.includes(pl.name as (typeof SEVEN_PLANETS)[number])) {
      planetSignIdxD1.set(pl.name, Math.floor(normalizeDeg(pl.longitude) / 30) % 12);
    }
  }

  const sthanaDeltaDrivers: ShadbalaMethodologicalInvestigation['sthanaDeltaDrivers'] = [];
  const perPlanetKalaComparison: ShadbalaMethodologicalInvestigation['kalaBalaRollupAudit']['perPlanetKalaComparison'] = [];
  const thresholdReversals: ShadbalaMethodologicalInvestigation['thresholdReversals'] = [];

  const localHour = instant.input.hour + instant.input.minute / 60 + instant.input.second / 3600;
  const dayFraction = Math.max(0, 1 - Math.abs(localHour - 12) / 12);

  const perPlanet: ShadbalaPlanetComparison[] = SEVEN_PLANETS.map((planet) => {
    const pObj = canonicalLahiriPlanets.find((p) => p.name === planet);
    const pLon = pObj?.longitude ?? 0;

    const finiteOrNull = (val: unknown): number | null => {
      if (val === null || val === undefined || val === '') return null;
      const n = Number(val);
      return Number.isFinite(n) ? n : null;
    };
    const rawRow = providerShadbalaRaw?.[planet];
    const rawTotal = rawRow ? finiteOrNull(rawRow.total) : null;
    const provider =
      rawRow && rawTotal !== null
        ? (() => {
            const sthana = finiteOrNull(rawRow.sthana_bala);
            const dig = finiteOrNull(rawRow.dig_bala);
            const kala = finiteOrNull(rawRow.kala_bala);
            const cheshta = finiteOrNull(rawRow.cheshta_bala);
            const naisargika = finiteOrNull(rawRow.naisargika_bala);
            const drik = finiteOrNull(rawRow.drik_bala);
            const allSixPresent =
              sthana !== null &&
              dig !== null &&
              kala !== null &&
              cheshta !== null &&
              naisargika !== null &&
              drik !== null;
            const sum = allSixPresent
              ? sthana + dig + kala + cheshta + naisargika + drik
              : null;
            const total = rawTotal;
            return {
              sthanaBala: sthana,
              digBala: dig,
              kalaBala: kala,
              cheshtaBala: cheshta,
              naisargikaBala: naisargika,
              drikBala: drik,
              totalVirupas: total,
              rupas: Number(rawRow.shadbala_in_rupas ?? (total / 60).toFixed(2)),
              requiredRupas: Number(rawRow.minimum_requirements ?? 0),
              ratio: Number(rawRow.ratio ?? 0),
              componentSumCheckDelta:
                sum !== null ? Number((total - sum).toFixed(4)) : null,
              rank: providerRankMap.get(planet) ?? 0,
            };
          })()
        : null;

    const localRow = localReport?.planets.find((r) => r.planet === planet) || null;
    const legacyLocal = localRow
      ? {
          sthanaBala: localRow.sthanaBala,
          digBala: localRow.digBala,
          kalaBala: localRow.kalaBala,
          chestaBala: localRow.chestaBala,
          naisargikaBala: localRow.naisargikaBala,
          drikBala: localRow.drikBala,
          totalVirupas: localRow.totalVirupas,
          rupas: localRow.totalRupas,
          requiredRupas: localRow.requiredRupas,
          ratio: localRow.ratio,
          ishtaPhala: localRow.ishtaPhala,
          kashtaPhala: localRow.kashtaPhala,
          rank: localRow.strengthRank,
        }
      : null;

    const equalMax =
      planet === 'Mercury' || planet === 'Jupiter'
        ? lahiriAscDeg
        : planet === 'Moon' || planet === 'Venus'
        ? normalizeDeg(lahiriAscDeg + 90)
        : planet === 'Saturn'
        ? normalizeDeg(lahiriAscDeg + 180)
        : normalizeDeg(lahiriAscDeg + 270);

    const placidusMax =
      planet === 'Mercury' || planet === 'Jupiter'
        ? h1
        : planet === 'Moon' || planet === 'Venus'
        ? h4
        : planet === 'Saturn'
        ? h7
        : h10;

    const digBalaPlacidus = calcDigBalaPoint(pLon, placidusMax);
    const digBalaEqual90 = calcDigBalaPoint(pLon, equalMax);
    const uchchaBalaBphs = calcUchchaBalaBphs(planet, pLon);
    const ojayugmaBala = calcOjayugmaBalaBphs(planet, pLon);
    const drekkanaBala = calcDrekkanaBalaBphs(planet, pLon);

    const pSignIdx = Math.floor(normalizeDeg(pLon) / 30) % 12;
    const wholeSignHouse = ((pSignIdx - ascSignIdx + 12) % 12) + 1;
    const sripatiHouse = findHouseInSandhis(pLon, indepRef.sripatiLahiriSandhisDeg);
    const placidusHouse = findHouseInCusps12(pLon, effectivePlacidus12);

    const kendradiWholeSign = calcKendradiFromHouse(wholeSignHouse);
    const kendradiSripatiBhava = calcKendradiFromHouse(sripatiHouse);
    const kendradiPlacidus = placidusHouse !== null ? calcKendradiFromHouse(placidusHouse) : null;

    const vargaDivs = [1, 2, 3, 7, 9, 12, 30];
    let saptavargajaNatural = 0;
    let saptavargajaPanchadha = 0;
    for (const div of vargaDivs) {
      const sIdx = getVargaSignIndex(pLon, div);
      saptavargajaNatural += getNaturalSignScore(planet, sIdx);
      saptavargajaPanchadha += getPanchadhaSignScore(planet, sIdx, div, planetSignIdxD1);
    }
    saptavargajaNatural = round2(saptavargajaNatural);
    saptavargajaPanchadha = round2(saptavargajaPanchadha);

    const sthanaTotalWholeSignNatural = round2(
      uchchaBalaBphs + saptavargajaNatural + ojayugmaBala + kendradiWholeSign + drekkanaBala
    );
    const sthanaTotalSripatiPanchadha = round2(
      uchchaBalaBphs + saptavargajaPanchadha + ojayugmaBala + kendradiSripatiBhava + drekkanaBala
    );

    let pakshaBalaBphs: number | null = null;
    if (sunLon !== null && moonLon !== null) {
      const elong = Math.abs(circularDiffDeg(moonLon, sunLon));
      const isNaturalBenefic = ['Moon', 'Mercury', 'Jupiter', 'Venus'].includes(planet);
      const base = isNaturalBenefic ? (elong / 180) * 60 : ((180 - elong) / 180) * 60;
      pakshaBalaBphs = round2(planet === 'Moon' ? base * 2 : base);
    }

    const cheshtaForIshta = provider?.cheshtaBala ?? legacyLocal?.chestaBala ?? null;
    const ishtaPhalaClassicalApprox =
      cheshtaForIshta !== null
        ? round2(Math.sqrt(Math.max(0, uchchaBalaBphs) * Math.max(0, cheshtaForIshta)))
        : null;
    const kashtaPhalaClassicalApprox =
      cheshtaForIshta !== null
        ? round2(Math.sqrt(Math.max(0, 60 - uchchaBalaBphs) * Math.max(0, 60 - cheshtaForIshta)))
        : null;

    const bphsMin = BPHS_CLASSICAL_MIN_RUPAS[planet];
    const providerSunAt5vs6_5RatioDelta =
      planet === 'Sun' && provider
        ? Number((provider.rupas / 6.5 - provider.rupas / 5.0).toFixed(4))
        : null;

    // Collect Sthana methodological driver details
    const rawSthanaRow = findRowByPlanet(providerSthanaRaw, planet);
    const kendradiDiff = kendradiSripatiBhava - kendradiWholeSign;
    const saptDiff = round2(saptavargajaPanchadha - saptavargajaNatural);
    const sthanaNotes: string[] = [];
    if (kendradiDiff !== 0) {
      sthanaNotes.push(
        `Kendradi house-basis shift: Whole-Sign H${wholeSignHouse} (${kendradiWholeSign}V) vs Sripati Bhava H${sripatiHouse} (${kendradiSripatiBhava}V) => ${kendradiDiff > 0 ? '+' : ''}${kendradiDiff}V`
      );
    }
    if (placidusHouse !== null && placidusHouse !== wholeSignHouse) {
      sthanaNotes.push(
        `Placidus cusp house=H${placidusHouse} (${kendradiPlacidus}V) vs Whole-Sign H${wholeSignHouse} (${kendradiWholeSign}V)`
      );
    }
    if (Math.abs(saptDiff) > 0.1) {
      sthanaNotes.push(
        `Saptavargaja Panchadha vs Natural friendship delta=${saptDiff > 0 ? '+' : ''}${saptDiff}V`
      );
    }
    if (provider && legacyLocal && provider.sthanaBala !== null) {
      const obsDelta = round2(provider.sthanaBala - legacyLocal.sthanaBala);
      sthanaNotes.push(`Observed Provider − Legacy Local Sthana=${obsDelta > 0 ? '+' : ''}${obsDelta}V`);
    }

    sthanaDeltaDrivers.push({
      planet,
      wholeSignHouse,
      sripatiHouse,
      placidusHouse,
      kendradiWholeSign,
      kendradiSripatiBhava,
      kendradiDeltaSripatiMinusWholeSign: kendradiDiff,
      saptavargajaNatural,
      saptavargajaPanchadha,
      saptavargajaDeltaPanchadhaMinusNatural: saptDiff,
      providerSthanaSubcomponents: rawSthanaRow,
      explanation: sthanaNotes.join(' | ') || 'Whole-Sign and Bhava house basis aligned.',
    });

    // Collect Kala Bala comparison details
    const rawKalaRow = findRowByPlanet(providerKalaRaw, planet);
    const kalaSubEntries = rawKalaRow
      ? (['nathonnatha', 'paksha', 'tribhaga', 'abdaMasaVaraHora', 'ayana', 'yuddha'] as const)
          .map((k) => [k, finiteOrNull(rawKalaRow[k])] as const)
          .filter((pair): pair is [typeof pair[0], number] => pair[1] !== null)
      : [];
    const kalaSubMap: Record<string, number> | null =
      kalaSubEntries.length > 0 ? Object.fromEntries(kalaSubEntries) : null;

    const independentNatonnataApprox =
      planet === 'Mercury'
        ? 60
        : ['Sun', 'Jupiter', 'Venus'].includes(planet)
        ? round2(dayFraction * 60)
        : round2((1 - dayFraction) * 60);

    const rawKalaTotal = rawKalaRow ? finiteOrNull(rawKalaRow.total) : null;
    perPlanetKalaComparison.push({
      planet,
      providerKalaTotal: provider?.kalaBala ?? rawKalaTotal,
      providerSubcomponents: kalaSubMap,
      independentPakshaBala: pakshaBalaBphs,
      independentNatonnataApprox,
      legacyLocalKala: legacyLocal?.kalaBala ?? null,
    });

    // Threshold reversal check
    const providerRatioAtBphs = provider ? round2(provider.rupas / bphsMin) : null;
    const providerPassesBphs = providerRatioAtBphs !== null ? providerRatioAtBphs >= 1.0 : null;
    const legacyPasses = legacyLocal ? legacyLocal.ratio >= 1.0 : null;
    const thresholdMismatch =
      providerPassesBphs !== null && legacyPasses !== null && providerPassesBphs !== legacyPasses;
    const nearMargin = provider !== null && Math.abs(provider.rupas - bphsMin) <= 0.6;

    const thNotes: string[] = [];
    if (thresholdMismatch) {
      thNotes.push(
        `Threshold crossing: Provider=${provider!.rupas.toFixed(2)}R (${providerPassesBphs ? 'PASS' : 'FAIL'} at ${bphsMin}R) vs Legacy Local=${legacyLocal!.rupas.toFixed(2)}R (${legacyPasses ? 'PASS' : 'FAIL'} at ${legacyLocal!.requiredRupas}R).`
      );
    } else if (nearMargin) {
      thNotes.push(
        `Near minimum threshold (${provider!.rupas.toFixed(2)}R vs ${bphsMin}R BPHS); minor Sthana/Kala/Cheshta convention shifts can flip pass/fail.`
      );
    } else if (planet === 'Sun') {
      thNotes.push('Sun classical BPHS threshold is 6.5R (390V) vs 5.0R (300V) used in some modern software.');
    }

    thresholdReversals.push({
      planet,
      bphsRequiredRupas: bphsMin,
      providerRupas: provider?.rupas ?? null,
      providerRatioAtBphs,
      providerPassesBphs,
      legacyLocalRupas: legacyLocal?.rupas ?? null,
      legacyLocalRequiredRupas: legacyLocal?.requiredRupas ?? bphsMin,
      legacyLocalPasses: legacyPasses,
      providerVsLocalPassMismatch: thresholdMismatch,
      notes: thNotes.join(' ') || 'Consistent pass/fail across evaluated sources.',
    });

    return {
      planet,
      provider,
      legacyLocal,
      independentReference: {
        naisargikaBalaBphs: NAISARGIKA_BPHS[planet],
        uchchaBalaBphs,
        digBalaPlacidus,
        digBalaEqual90,
        pakshaBalaBphs,
        bphsClassicalRequiredRupas: bphsMin,
        providerSunAt5vs6_5RatioDelta,
        ishtaPhalaClassicalApprox,
        kashtaPhalaClassicalApprox,
      },
      independentSthanaSubcomponents: {
        uchchaBala: uchchaBalaBphs,
        ojayugmaBala,
        drekkanaBala,
        kendradiWholeSign,
        kendradiSripatiBhava,
        kendradiPlacidus,
        saptavargajaNatural,
        saptavargajaPanchadha,
        wholeSignHouse,
        sripatiHouse,
        placidusHouse,
        sthanaTotalWholeSignNatural,
        sthanaTotalSripatiPanchadha,
      },
      deltas: {
        totalVirupasProviderMinusLocal:
          provider && legacyLocal
            ? round2(provider.totalVirupas - legacyLocal.totalVirupas)
            : null,
        ratioProviderMinusLocal:
          provider && legacyLocal ? round2(provider.ratio - legacyLocal.ratio) : null,
        digBalaProviderVsPlacidus:
          provider && provider.digBala !== null ? round2(provider.digBala - digBalaPlacidus) : null,
        digBalaProviderVsEqual90:
          provider && provider.digBala !== null ? round2(provider.digBala - digBalaEqual90) : null,
        sthanaBalaProviderMinusLocal:
          provider && provider.sthanaBala !== null && legacyLocal
            ? round2(provider.sthanaBala - legacyLocal.sthanaBala)
            : null,
        kalaBalaProviderMinusLocal:
          provider && provider.kalaBala !== null && legacyLocal
            ? round2(provider.kalaBala - legacyLocal.kalaBala)
            : null,
        cheshtaBalaProviderMinusLocal:
          provider && provider.cheshtaBala !== null && legacyLocal
            ? round2(provider.cheshtaBala - legacyLocal.chestaBala)
            : null,
        naisargikaBalaProviderMinusLocal:
          provider && provider.naisargikaBala !== null && legacyLocal
            ? round2(provider.naisargikaBala - legacyLocal.naisargikaBala)
            : null,
        drikBalaProviderMinusLocal:
          provider && provider.drikBala !== null && legacyLocal
            ? round2(provider.drikBala - legacyLocal.drikBala)
            : null,
      },
    };
  });

  const sunRow = perPlanet.find((r) => r.planet === 'Sun');
  const moonRow = perPlanet.find((r) => r.planet === 'Moon');
  const providerSunRupas = sunRow?.provider?.rupas ?? null;
  const ratioAt5 = providerSunRupas !== null ? round2(providerSunRupas / 5.0) : null;
  const ratioAt65 = providerSunRupas !== null ? round2(providerSunRupas / 6.5) : null;

  const providerOrder = providerEntries.map((e) => e.planet);
  const legacyLocalOrder = localReport
    ? [...localReport.planets].sort((a, b) => a.strengthRank - b.strengthRank).map((p) => p.planet)
    : [];

  const rankDifferences = perPlanet
    .filter((r) => r.provider && r.legacyLocal && r.provider.rank !== r.legacyLocal.rank)
    .map((r) => ({
      planet: r.planet,
      providerRank: r.provider!.rank,
      localRank: r.legacyLocal!.rank,
    }));

  const rawKalaItems = asObjArr(providerKalaRaw?.items);
  const kalaFieldsObserved = rawKalaItems[0] ? Object.keys(rawKalaItems[0]) : [];
  const abdaMasaVaraHoraCombined =
    kalaFieldsObserved.includes('abdaMasaVaraHora') ||
    (providerStrengthMetadata?.provider === 'astroway');

  const sunProvCheshta = sunRow?.provider?.cheshtaBala ?? null;
  const moonProvCheshta = moonRow?.provider?.cheshtaBala ?? null;
  const zeroLuminaryCheshtaDetected =
    sunProvCheshta === 0 && moonProvCheshta === 0;

  const methodologicalInvestigation: ShadbalaMethodologicalInvestigation = {
    referenceBasisSummary:
      'Independent BPHS checks compare Whole-Sign vs Sripati/Placidus Kendradi house assignment (60/30/15V), Natural vs 5-fold Panchadha Maitri Saptavargaja Bala, Tara-Graha vs Ayana/Paksha Cheshta Bala for luminaries, and decomposed vs rolled-up Kala Bala subcomponents.',
    sthanaDeltaDrivers,
    cheshtaBalaZeroLuminaries: {
      detectedOnProvider: zeroLuminaryCheshtaDetected,
      sunProviderCheshta: sunProvCheshta,
      moonProviderCheshta: moonProvCheshta,
      sunLegacyLocalCheshta: sunRow?.legacyLocal?.chestaBala ?? null,
      moonLegacyLocalCheshta: moonRow?.legacyLocal?.chestaBala ?? null,
      conventionExplanation:
        'Strict Tara-Graha / Surya-Siddhanta Shadbala assigns Cheshta Bala = 0 (or non-retrograde motion zero) to Sun and Moon because luminaries never retrograde, whereas B.V. Raman / JHora / FreeAstroAPI assign Sun Cheshta = Sun Ayana Bala and Moon Cheshta = Moon Paksha Bala (causing ~1V–51V divergence on luminaries).',
      ishtaKashtaImpactNote:
        'When Sun or Moon Cheshta Bala = 0, geometric Ishta Phala sqrt(Uchcha * Cheshta) collapses to 0 unless Ayana/Paksha or separate BPHS ray-scale Ishta/Kashta rules are used.',
    },
    kalaBalaRollupAudit: {
      abdaMasaVaraHoraCombined,
      rawKalaItemsPresent: rawKalaItems.length > 0,
      fieldsObserved: kalaFieldsObserved,
      openApiKnownCaveats: [
        'AstroWay /vedic/shadbala/kala exposes 6 fields and combines Abda, Masa, Vara, and Hora into a single `abdaMasaVaraHora` value.',
        'AstroWay OpenAPI v2.383.19 explicitly notes Abda/Masa lords and Yuddha Bala remain open vs PyJHora 62-chart reference validation.',
      ],
      perPlanetKalaComparison,
    },
    thresholdReversals,
  };

  return {
    authoritativeDesignation: 'unassigned_pending_reconciliation',
    designationPolicy:
      'Provider Shadbala and Legacy Local Shadbala are preserved separately without averaging. Authoritative source stays unassigned until live reconciliation against external JHora/PyJHora is inspected and approved.',
    metadata: providerStrengthMetadata ?? null,
    sunThresholdInvestigation: {
      providerMinRupasForSun: sunRow?.provider?.requiredRupas ?? null,
      legacyLocalMinRupasForSun: 5.0,
      classicalBphsMinRupasForSun: 6.5,
      providerSunRupas,
      ratioAt5_0Threshold: ratioAt5,
      ratioAt6_5Threshold: ratioAt65,
      flipsPassFailStatus:
        ratioAt5 !== null && ratioAt65 !== null ? (ratioAt5 >= 1) !== (ratioAt65 >= 1) : false,
    },
    unavailableClassicalSubcomponents: UNAVAILABLE_SHADBALA_SUBCOMPONENTS,
    perPlanet,
    rankingComparison: {
      providerOrder,
      legacyLocalOrder,
      rankDifferences,
    },
    methodologicalInvestigation,
  };
}
