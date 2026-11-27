/**
 * Isolated V2 Engine — Shadbala Reconciliation Module
 *
 * Compares:
 *   1. Provider-native Shadbala (/api/v2/vedic/calculate shadbala)
 *   2. Legacy local Shadbala (computeShadbala in jyotishMath.ts)
 *   3. Independent BPHS Reference checks (Naisargika, Uchcha, Dig Bala on
 *      Placidus vs Equal-90° basis, Paksha, Sun 5.0 vs 6.5 Rupa threshold,
 *      Ishta & Kashta Phala)
 *
 * Never mutates provider values, never averages conflicting datasets, and
 * keeps authoritativeDesignation = 'unassigned_pending_reconciliation' until
 * live verification is inspected and approved.
 */

import { computeShadbala, normalizeDeg, type PlanetPosition } from '../jyotishMath';
import type {
  CanonicalBirthInstant,
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

function calcUchchaBalaBphs(planet: string, siderealLon: number): number {
  const exaltDeg = EXALT_DEGREES_BPHS[planet];
  if (exaltDeg === undefined) return 0;
  const debilDeg = normalizeDeg(exaltDeg + 180);
  const distFromDebil = Math.abs(circularDiffDeg(siderealLon, debilDeg));
  return Number(((distFromDebil / 180) * 60).toFixed(2));
}

function calcDigBalaPoint(planet: string, siderealLon: number, maxStrengthLon: number): number {
  const powerlessLon = normalizeDeg(maxStrengthLon + 180);
  const arc = Math.abs(circularDiffDeg(siderealLon, powerlessLon));
  return Number(((arc / 180) * 60).toFixed(2));
}

export function buildShadbalaReconciliationReport(params: {
  instant: CanonicalBirthInstant;
  providerShadbalaRaw: Record<string, Record<string, unknown>> | null;
  providerStrengthMetadata?: Record<string, unknown> | null;
  canonicalLahiriPlanets: PlanetPosition[];
  lahiriAscDeg: number;
  lahiriMcDeg?: number | null;
  placidusLahiriCusps?: { h1: number; h4: number; h7: number; h10: number } | null;
}): ShadbalaReconciliationReport {
  const {
    instant,
    providerShadbalaRaw,
    providerStrengthMetadata,
    canonicalLahiriPlanets,
    lahiriAscDeg,
    lahiriMcDeg,
    placidusLahiriCusps,
  } = params;

  // Run legacy local Shadbala on the SAME canonical local date/time & canonical Lahiri planets
  // Note: legacy computeShadbala still contains internal 06:00/18:00 & Ayana/Cheshta approximations;
  // passing identical inputs isolates algorithmic differences from epoch bugs!
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

  const perPlanet: ShadbalaPlanetComparison[] = SEVEN_PLANETS.map((planet) => {
    const pObj = canonicalLahiriPlanets.find((p) => p.name === planet);
    const pLon = pObj?.longitude ?? 0;

    const rawRow = providerShadbalaRaw?.[planet];
    const provider =
      rawRow && typeof rawRow.total === 'number'
        ? (() => {
            const sthana = Number(rawRow.sthana_bala ?? 0);
            const dig = Number(rawRow.dig_bala ?? 0);
            const kala = Number(rawRow.kala_bala ?? 0);
            const cheshta = Number(rawRow.cheshta_bala ?? 0);
            const naisargika = Number(rawRow.naisargika_bala ?? 0);
            const drik = Number(rawRow.drik_bala ?? 0);
            const total = Number(rawRow.total);
            const sum = sthana + dig + kala + cheshta + naisargika + drik;
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
              componentSumCheckDelta: Number((total - sum).toFixed(4)),
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

    const digBalaPlacidus = calcDigBalaPoint(planet, pLon, placidusMax);
    const digBalaEqual90 = calcDigBalaPoint(planet, pLon, equalMax);
    const uchchaBalaBphs = calcUchchaBalaBphs(planet, pLon);

    let pakshaBalaBphs: number | null = null;
    if (sunLon !== null && moonLon !== null && planet === 'Moon') {
      const elong = Math.abs(circularDiffDeg(moonLon, sunLon));
      pakshaBalaBphs = Number(((elong / 180) * 60).toFixed(2));
    }

    const cheshtaForIshta = provider?.cheshtaBala ?? legacyLocal?.chestaBala ?? null;
    const ishtaPhalaClassicalApprox =
      cheshtaForIshta !== null
        ? Number(Math.sqrt(Math.max(0, uchchaBalaBphs) * Math.max(0, cheshtaForIshta)).toFixed(2))
        : null;
    const kashtaPhalaClassicalApprox =
      cheshtaForIshta !== null
        ? Number(
            Math.sqrt(Math.max(0, 60 - uchchaBalaBphs) * Math.max(0, 60 - cheshtaForIshta)).toFixed(
              2
            )
          )
        : null;

    const bphsMin = BPHS_CLASSICAL_MIN_RUPAS[planet];
    const providerSunAt5vs6_5RatioDelta =
      planet === 'Sun' && provider
        ? Number((provider.rupas / 6.5 - provider.rupas / 5.0).toFixed(4))
        : null;

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
      deltas: {
        totalVirupasProviderMinusLocal:
          provider && legacyLocal
            ? Number((provider.totalVirupas - legacyLocal.totalVirupas).toFixed(2))
            : null,
        ratioProviderMinusLocal:
          provider && legacyLocal ? Number((provider.ratio - legacyLocal.ratio).toFixed(2)) : null,
        digBalaProviderVsPlacidus: provider
          ? Number((provider.digBala - digBalaPlacidus).toFixed(2))
          : null,
        digBalaProviderVsEqual90: provider
          ? Number((provider.digBala - digBalaEqual90).toFixed(2))
          : null,
      },
    };
  });

  const sunRow = perPlanet.find((r) => r.planet === 'Sun');
  const providerSunRupas = sunRow?.provider?.rupas ?? null;
  const ratioAt5 = providerSunRupas !== null ? Number((providerSunRupas / 5.0).toFixed(2)) : null;
  const ratioAt65 =
    providerSunRupas !== null ? Number((providerSunRupas / 6.5).toFixed(2)) : null;

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

  return {
    authoritativeDesignation: 'unassigned_pending_reconciliation',
    designationPolicy:
      'Provider Shadbala and Legacy Local Shadbala are preserved separately without averaging. Authoritative source stays unassigned until live reconciliation is approved.',
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
  };
}
