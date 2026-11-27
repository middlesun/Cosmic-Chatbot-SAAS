/**
 * Isolated V2 Engine — Phase 4: Independently Validated Local Ashtakavarga & Prastara
 *
 * Pure TypeScript (Cloudflare Workers compatible — zero Node built-ins).
 *
 * Audit of legacy `jyotishMath.ts` (`computeAshtakavarga` + `ASHTAKAVARGA_RULES`):
 *  1. Classical offset tables in `ASHTAKAVARGA_RULES` match BPHS Ch. 66–72
 *     (Sun=48, Moon=49, Mars=39, Mercury=54, Jupiter=56, Venus=52, Saturn=39 -> 337).
 *  2. Legacy `computeAshtakavarga(planets)` silently drops all 45 Ascendant bindus
 *     (6+4+5+7+9+8+6 = 45, leaving 292 instead of 337) if callers omit an
 *     `'Ascendant'` pseudo-planet entry in `planets[]`.
 *  3. Legacy `computeAshtakavarga` does not emit `prastharashtakavarga` (`8 x 12`
 *     contributor matrices per target planet) or perform self-consistency/node audits.
 *
 * This module computes canonical BAV, SAV, and full `7 x 8 x 12` Prastara directly
 * on canonical V2 D1 placements, verifies contributor-level reconciliation, and can
 * cross-audit legacy `computeAshtakavarga` and provider Ashtakavarga payloads.
 */

import {
  computeAshtakavarga as computeLegacyAshtakavarga,
  normalizeDeg,
  SIGNS,
  type PlanetPosition,
} from '../jyotishMath';
import type { CanonicalBirthInstant, LayerBMasterChartRecord, VedicLahiriFrame } from './types';

export const CLASSICAL_7_PLANETS = [
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
] as const;

export type Classical7Planet = (typeof CLASSICAL_7_PLANETS)[number];

export const ASHTAKAVARGA_CONTRIBUTORS_8 = [
  ...CLASSICAL_7_PLANETS,
  'Ascendant',
] as const;

export type AshtakavargaContributor8 = (typeof ASHTAKAVARGA_CONTRIBUTORS_8)[number];

export const CLASSICAL_BAV_TOTALS: Record<Classical7Planet, number> = {
  Sun: 48,
  Moon: 49,
  Mars: 39,
  Mercury: 54,
  Jupiter: 56,
  Venus: 52,
  Saturn: 39,
};

export const CLASSICAL_ASCENDANT_CONTRIBUTION_TOTAL = 45;
export const CLASSICAL_SAV_TOTAL = 337;

/**
 * Classical BPHS Parashari Ashtakavarga contribution offsets (1-based houses
 * counted forward from each contributor's Rashi sign in D1).
 * Note: Rahu and Ketu are explicitly non-contributors in standard 7-planet Ashtakavarga,
 * so Mean vs True Node convention differences do not affect these matrices.
 */
export const BPHS_ASHTAKAVARGA_RULES: Readonly<
  Record<Classical7Planet, Readonly<Record<AshtakavargaContributor8, readonly number[]>>>
> = {
  Sun: {
    Sun: [1, 2, 4, 7, 8, 9, 10, 11],
    Moon: [3, 6, 10, 11],
    Mars: [1, 2, 4, 7, 8, 9, 10, 11],
    Mercury: [3, 5, 6, 9, 10, 11, 12],
    Jupiter: [5, 6, 9, 11],
    Venus: [6, 7, 12],
    Saturn: [1, 2, 4, 7, 8, 9, 10, 11],
    Ascendant: [3, 4, 6, 10, 11, 12],
  },
  Moon: {
    Sun: [3, 6, 7, 8, 10, 11],
    Moon: [1, 3, 6, 7, 10, 11],
    Mars: [2, 3, 5, 6, 9, 10, 11],
    Mercury: [1, 3, 4, 5, 7, 8, 10, 11],
    Jupiter: [1, 4, 7, 8, 10, 11, 12],
    Venus: [3, 4, 5, 7, 9, 10, 11],
    Saturn: [3, 5, 6, 11],
    Ascendant: [3, 6, 10, 11],
  },
  Mars: {
    Sun: [3, 5, 6, 10, 11],
    Moon: [3, 6, 11],
    Mars: [1, 2, 4, 7, 8, 10, 11],
    Mercury: [3, 5, 6, 11],
    Jupiter: [6, 10, 11, 12],
    Venus: [6, 8, 11, 12],
    Saturn: [1, 4, 7, 8, 9, 10, 11],
    Ascendant: [1, 3, 6, 10, 11],
  },
  Mercury: {
    Sun: [5, 6, 9, 11, 12],
    Moon: [2, 4, 6, 8, 10, 11],
    Mars: [1, 2, 4, 7, 8, 9, 10, 11],
    Mercury: [1, 3, 5, 6, 9, 10, 11, 12],
    Jupiter: [6, 8, 11, 12],
    Venus: [1, 2, 3, 4, 5, 8, 9, 11],
    Saturn: [1, 2, 4, 7, 8, 9, 10, 11],
    Ascendant: [1, 2, 4, 6, 8, 10, 11],
  },
  Jupiter: {
    Sun: [1, 2, 3, 4, 7, 8, 9, 10, 11],
    Moon: [2, 5, 7, 9, 11],
    Mars: [1, 2, 4, 7, 8, 10, 11],
    Mercury: [1, 2, 4, 5, 6, 9, 10, 11],
    Jupiter: [1, 2, 3, 4, 7, 8, 10, 11],
    Venus: [2, 5, 6, 9, 10, 11],
    Saturn: [3, 5, 6, 12],
    Ascendant: [1, 2, 4, 5, 6, 7, 9, 10, 11],
  },
  Venus: {
    Sun: [8, 11, 12],
    Moon: [1, 2, 3, 4, 5, 8, 9, 11, 12],
    Mars: [3, 5, 6, 9, 11, 12],
    Mercury: [3, 5, 6, 9, 11],
    Jupiter: [5, 8, 9, 10, 11],
    Venus: [1, 2, 3, 4, 5, 8, 9, 10, 11],
    Saturn: [3, 4, 5, 8, 9, 10, 11],
    Ascendant: [1, 2, 3, 4, 5, 8, 9, 11],
  },
  Saturn: {
    Sun: [1, 2, 4, 7, 8, 10, 11],
    Moon: [3, 6, 11],
    Mars: [3, 5, 6, 10, 11, 12],
    Mercury: [6, 8, 9, 10, 11, 12],
    Jupiter: [5, 6, 11, 12],
    Venus: [6, 11, 12],
    Saturn: [3, 5, 6, 11],
    Ascendant: [1, 3, 4, 6, 10, 11],
  },
};

export interface AshtakavargaSignInput {
  ascendantSignIndex: number; // 0..11
  planetSignIndices: Record<Classical7Planet, number>; // 0..11
  bodyLongitudesDeg?: Partial<Record<AshtakavargaContributor8, number>>;
}

export interface LocalAshtakavargaResult {
  source: 'local:localAshtakavarga';
  methodology: 'bphs_parashari_7_planet_8_contributor';
  nodeConventionNote: string;
  ascendantSignIndex: number;
  ascendantSign: string;
  planetSignIndices: Record<Classical7Planet, number>;
  planetSigns: Record<Classical7Planet, string>;
  sarvashtakavarga: number[];
  bhinnashtakavarga: Record<Classical7Planet, number[]>;
  prastharashtakavarga: Record<Classical7Planet, Record<AshtakavargaContributor8, number[]>>;
  totalPoints: number;
  perPlanetTotals: Record<Classical7Planet, number>;
  selfConsistencyPassed: boolean;
  selfConsistencyNotes: string[];
}

export interface AshtakavargaRulesAudit {
  valid: boolean;
  totalTargets: number;
  totalContributorsPerTarget: number;
  perPlanetSums: Record<Classical7Planet, number>;
  ascendantContributionSum: number;
  grandTotal: number;
  issues: string[];
}

export interface AshtakavargaComparisonAudit {
  comparedAgainstSource: string;
  savMatched: boolean;
  bavMatched: boolean;
  prastaraCompared: boolean;
  prastaraMatched: boolean | null;
  exactAllCellsMatch: boolean;
  savDiffs: Array<{ signIndex: number; sign: string; local: number; candidate: number }>;
  bavDiffs: Array<{ planet: string; signIndex: number; sign: string; local: number; candidate: number }>;
  prastaraDiffs: Array<{
    planet: string;
    contributor: string;
    signIndex: number;
    sign: string;
    local: number;
    candidate: number;
  }>;
  summary: string;
}

export interface LegacyAshtakavargaAuditReport {
  withAscendantMatchedAll84BavCells: boolean;
  withAscendantMatchedAll12SavCells: boolean;
  withAscendantTotalBindus: number;
  withoutAscendantTotalBindus: number;
  withoutAscendantDroppedBindus: number;
  legacyEmitsPrastara: boolean;
  findings: string[];
}

export interface LocalAshtakavargaMasterAudit {
  available: boolean;
  rulesTableValid: boolean;
  providerAshtakavargaPresent: boolean;
  comparisonWithProvider: AshtakavargaComparisonAudit | null;
  legacyComputeAudit: LegacyAshtakavargaAuditReport | null;
  localTotalPoints: number | null;
  readyForPreferredAdoption: boolean;
  notes: string[];
}

function asObj(val: unknown): Record<string, unknown> | null {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : null;
}

function canon7Name(raw: unknown): Classical7Planet | null {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'sun' || s === 'surya') return 'Sun';
  if (s === 'moon' || s === 'chandra') return 'Moon';
  if (s === 'mars' || s === 'mangal' || s === 'mangala' || s === 'kuja') return 'Mars';
  if (s === 'mercury' || s === 'budha' || s === 'budh') return 'Mercury';
  if (s === 'jupiter' || s === 'guru' || s === 'brihaspati') return 'Jupiter';
  if (s === 'venus' || s === 'shukra') return 'Venus';
  if (s === 'saturn' || s === 'shani') return 'Saturn';
  return null;
}

function resolveSignIndex(body: Record<string, unknown> | null | undefined): {
  signIndex: number | null;
  lonDeg: number | null;
} {
  if (!body) return { signIndex: null, lonDeg: null };
  const rawLon = body.absolute_degree ?? body.longitude ?? body.degree;
  if (rawLon !== null && rawLon !== undefined && rawLon !== '' && Number.isFinite(Number(rawLon))) {
    const lon = normalizeDeg(Number(rawLon));
    return {
      signIndex: Math.floor(lon / 30) % 12,
      lonDeg: lon,
    };
  }
  const rawIdx = body.signIndex ?? body.sign_index;
  if (rawIdx !== null && rawIdx !== undefined && rawIdx !== '' && Number.isInteger(Number(rawIdx))) {
    const idx = Number(rawIdx);
    if (idx >= 0 && idx < 12) return { signIndex: idx, lonDeg: null };
  }
  const rawSign = typeof body.sign === 'string' ? body.sign : typeof body.signName === 'string' ? body.signName : '';
  if (rawSign.trim()) {
    const idx = SIGNS.findIndex((s) => s.toLowerCase() === rawSign.trim().toLowerCase());
    if (idx >= 0) return { signIndex: idx, lonDeg: null };
  }
  return { signIndex: null, lonDeg: null };
}

/**
 * Verifies BPHS_ASHTAKAVARGA_RULES invariants against classical tables.
 */
export function verifyClassicalAshtakavargaRulesTable(): AshtakavargaRulesAudit {
  const issues: string[] = [];
  const perPlanetSums = {} as Record<Classical7Planet, number>;
  let ascendantContributionSum = 0;
  let grandTotal = 0;

  for (const target of CLASSICAL_7_PLANETS) {
    const table = BPHS_ASHTAKAVARGA_RULES[target];
    let targetSum = 0;
    for (const contrib of ASHTAKAVARGA_CONTRIBUTORS_8) {
      const offsets = table?.[contrib];
      if (!offsets) {
        issues.push(`Missing offsets for ${target} <- ${contrib}.`);
        continue;
      }
      const unique = new Set(offsets);
      if (unique.size !== offsets.length) {
        issues.push(`Duplicate offsets in ${target} <- ${contrib}.`);
      }
      for (const off of offsets) {
        if (!Number.isInteger(off) || off < 1 || off > 12) {
          issues.push(`Invalid offset ${off} in ${target} <- ${contrib}.`);
        }
      }
      targetSum += offsets.length;
      if (contrib === 'Ascendant') {
        ascendantContributionSum += offsets.length;
      }
    }
    perPlanetSums[target] = targetSum;
    grandTotal += targetSum;
    if (targetSum !== CLASSICAL_BAV_TOTALS[target]) {
      issues.push(`Target ${target} rule sum=${targetSum} != classical ${CLASSICAL_BAV_TOTALS[target]}.`);
    }
  }

  if (ascendantContributionSum !== CLASSICAL_ASCENDANT_CONTRIBUTION_TOTAL) {
    issues.push(
      `Ascendant contribution sum=${ascendantContributionSum} != classical ${CLASSICAL_ASCENDANT_CONTRIBUTION_TOTAL}.`
    );
  }
  if (grandTotal !== CLASSICAL_SAV_TOTAL) {
    issues.push(`Grand total=${grandTotal} != classical ${CLASSICAL_SAV_TOTAL}.`);
  }

  return {
    valid: issues.length === 0,
    totalTargets: CLASSICAL_7_PLANETS.length,
    totalContributorsPerTarget: ASHTAKAVARGA_CONTRIBUTORS_8.length,
    perPlanetSums,
    ascendantContributionSum,
    grandTotal,
    issues,
  };
}

/**
 * Zero-coercion extraction of D1 sign indices from canonical VedicLahiriFrame.
 */
export function extractCanonicalAshtakavargaSignInput(
  vedicData: VedicLahiriFrame | null | undefined
): AshtakavargaSignInput | null {
  if (!vedicData) return null;
  const ascRes = resolveSignIndex(vedicData.ascendant);
  if (ascRes.signIndex === null) return null;

  const planetSignIndices = {} as Record<Classical7Planet, number>;
  const bodyLongitudesDeg: Partial<Record<AshtakavargaContributor8, number>> = {};
  if (ascRes.lonDeg !== null) bodyLongitudesDeg.Ascendant = ascRes.lonDeg;

  for (const p of vedicData.planets || []) {
    const canon = canon7Name(p.name ?? p.planet ?? p.raw_name);
    if (!canon || canon in planetSignIndices) continue;
    const res = resolveSignIndex(p);
    if (res.signIndex !== null) {
      planetSignIndices[canon] = res.signIndex;
      if (res.lonDeg !== null) bodyLongitudesDeg[canon] = res.lonDeg;
    }
  }

  for (const pl of CLASSICAL_7_PLANETS) {
    if (
      planetSignIndices[pl] === undefined ||
      !Number.isInteger(planetSignIndices[pl]) ||
      planetSignIndices[pl] < 0 ||
      planetSignIndices[pl] > 11
    ) {
      return null;
    }
  }

  return {
    ascendantSignIndex: ascRes.signIndex,
    planetSignIndices,
    bodyLongitudesDeg,
  };
}

/**
 * Computes full canonical Ashtakavarga (Prastara + BAV + SAV) from validated D1 sign placements.
 */
export function computeLocalAshtakavarga(
  input: AshtakavargaSignInput
): LocalAshtakavargaResult | null {
  if (
    !Number.isInteger(input.ascendantSignIndex) ||
    input.ascendantSignIndex < 0 ||
    input.ascendantSignIndex > 11
  ) {
    return null;
  }

  const contribSigns: Record<AshtakavargaContributor8, number> = {
    Sun: input.planetSignIndices.Sun,
    Moon: input.planetSignIndices.Moon,
    Mars: input.planetSignIndices.Mars,
    Mercury: input.planetSignIndices.Mercury,
    Jupiter: input.planetSignIndices.Jupiter,
    Venus: input.planetSignIndices.Venus,
    Saturn: input.planetSignIndices.Saturn,
    Ascendant: input.ascendantSignIndex,
  };

  for (const c of ASHTAKAVARGA_CONTRIBUTORS_8) {
    const idx = contribSigns[c];
    if (!Number.isInteger(idx) || idx < 0 || idx > 11) {
      return null;
    }
  }

  const prastharashtakavarga = {} as Record<
    Classical7Planet,
    Record<AshtakavargaContributor8, number[]>
  >;
  const bhinnashtakavarga = {} as Record<Classical7Planet, number[]>;
  const sarvashtakavarga = new Array<number>(12).fill(0);
  const perPlanetTotals = {} as Record<Classical7Planet, number>;
  const planetSigns = {} as Record<Classical7Planet, string>;
  const selfConsistencyNotes: string[] = [];

  for (const target of CLASSICAL_7_PLANETS) {
    planetSigns[target] = SIGNS[input.planetSignIndices[target]];
    const targetMatrix = {} as Record<AshtakavargaContributor8, number[]>;
    const bavRow = new Array<number>(12).fill(0);

    for (const contributor of ASHTAKAVARGA_CONTRIBUTORS_8) {
      const refSignIdx = contribSigns[contributor];
      const contribRow = new Array<number>(12).fill(0);
      for (const offset of BPHS_ASHTAKAVARGA_RULES[target][contributor]) {
        const destSignIdx = (refSignIdx + offset - 1) % 12;
        contribRow[destSignIdx] = 1;
        bavRow[destSignIdx] += 1;
      }
      targetMatrix[contributor] = contribRow;
    }

    prastharashtakavarga[target] = targetMatrix;
    bhinnashtakavarga[target] = bavRow;

    const pTotal = bavRow.reduce((a, b) => a + b, 0);
    perPlanetTotals[target] = pTotal;
    if (pTotal !== CLASSICAL_BAV_TOTALS[target]) {
      selfConsistencyNotes.push(
        `${target} BAV sum=${pTotal} != ${CLASSICAL_BAV_TOTALS[target]}.`
      );
    }

    for (let s = 0; s < 12; s++) {
      sarvashtakavarga[s] += bavRow[s];
      const pSum = ASHTAKAVARGA_CONTRIBUTORS_8.reduce(
        (acc, c) => acc + targetMatrix[c][s],
        0
      );
      if (pSum !== bavRow[s]) {
        selfConsistencyNotes.push(
          `${target} Prastara column sum at ${SIGNS[s]} (${pSum}) != BAV (${bavRow[s]}).`
        );
      }
    }
  }

  const totalPoints = sarvashtakavarga.reduce((a, b) => a + b, 0);
  if (totalPoints !== CLASSICAL_SAV_TOTAL) {
    selfConsistencyNotes.push(`SAV total=${totalPoints} != ${CLASSICAL_SAV_TOTAL}.`);
  }

  return {
    source: 'local:localAshtakavarga',
    methodology: 'bphs_parashari_7_planet_8_contributor',
    nodeConventionNote:
      'Computed solely from the 7 classical planets + Ascendant; Rahu and Ketu are non-contributors so Mean vs True Node differences do not alter Ashtakavarga.',
    ascendantSignIndex: input.ascendantSignIndex,
    ascendantSign: SIGNS[input.ascendantSignIndex],
    planetSignIndices: { ...input.planetSignIndices },
    planetSigns,
    sarvashtakavarga,
    bhinnashtakavarga,
    prastharashtakavarga,
    totalPoints,
    perPlanetTotals,
    selfConsistencyPassed: selfConsistencyNotes.length === 0,
    selfConsistencyNotes,
  };
}

/**
 * Compares local canonical Ashtakavarga cell-by-cell against any candidate
 * (FreeAstroAPI, AstroWay, JHora/PyJHora export, or legacy table).
 */
export function compareAshtakavargaMatrices(
  localAv: LocalAshtakavargaResult,
  candidate: {
    sarvashtakavarga: number[];
    bhinnashtakavarga: Record<string, number[]>;
    prastharashtakavarga?: Record<string, Record<string, number[]>>;
  },
  sourceLabel: string
): AshtakavargaComparisonAudit {
  const savDiffs: AshtakavargaComparisonAudit['savDiffs'] = [];
  for (let i = 0; i < 12; i++) {
    const lv = localAv.sarvashtakavarga[i];
    const cv = Number(candidate.sarvashtakavarga?.[i] ?? Number.NaN);
    if (lv !== cv) {
      savDiffs.push({ signIndex: i, sign: SIGNS[i], local: lv, candidate: cv });
    }
  }

  const bavDiffs: AshtakavargaComparisonAudit['bavDiffs'] = [];
  for (const pl of CLASSICAL_7_PLANETS) {
    const lRow = localAv.bhinnashtakavarga[pl];
    const cRow = candidate.bhinnashtakavarga?.[pl];
    for (let i = 0; i < 12; i++) {
      const lv = lRow[i];
      const cv = Array.isArray(cRow) ? Number(cRow[i] ?? Number.NaN) : Number.NaN;
      if (lv !== cv) {
        bavDiffs.push({ planet: pl, signIndex: i, sign: SIGNS[i], local: lv, candidate: cv });
      }
    }
  }

  const prastaraDiffs: AshtakavargaComparisonAudit['prastaraDiffs'] = [];
  const candPrastara = candidate.prastharashtakavarga ?? {};
  const hasAnyPrastara = CLASSICAL_7_PLANETS.some(
    (pl) => candPrastara[pl] && Object.keys(candPrastara[pl]).length > 0
  );
  let prastaraMatched: boolean | null = null;
  if (hasAnyPrastara) {
    for (const pl of CLASSICAL_7_PLANETS) {
      const lMat = localAv.prastharashtakavarga[pl];
      const cMat = candPrastara[pl] ?? {};
      for (const contrib of ASHTAKAVARGA_CONTRIBUTORS_8) {
        const lVec = lMat[contrib];
        const cVec = cMat[contrib];
        for (let i = 0; i < 12; i++) {
          const lv = lVec[i];
          const cv = Array.isArray(cVec) ? Number(cVec[i] ?? Number.NaN) : Number.NaN;
          if (lv !== cv) {
            prastaraDiffs.push({
              planet: pl,
              contributor: contrib,
              signIndex: i,
              sign: SIGNS[i],
              local: lv,
              candidate: cv,
            });
          }
        }
      }
    }
    prastaraMatched = prastaraDiffs.length === 0;
  }

  const savMatched = savDiffs.length === 0;
  const bavMatched = bavDiffs.length === 0;
  const exactAllCellsMatch =
    savMatched && bavMatched && (prastaraMatched === null || prastaraMatched === true);

  const summary = exactAllCellsMatch
    ? `100% match vs ${sourceLabel} (all 12 SAV, 84 BAV${hasAnyPrastara ? ', 672 Prastara' : ''} cells exact).`
    : `Divergence vs ${sourceLabel}: ${savDiffs.length} SAV cell(s), ${bavDiffs.length} BAV cell(s)${hasAnyPrastara ? `, ${prastaraDiffs.length} Prastara cell(s)` : ''}.`;

  return {
    comparedAgainstSource: sourceLabel,
    savMatched,
    bavMatched,
    prastaraCompared: hasAnyPrastara,
    prastaraMatched,
    exactAllCellsMatch,
    savDiffs,
    bavDiffs,
    prastaraDiffs,
    summary,
  };
}

function makeMinimalPlanetPosition(name: string, signIndex: number): PlanetPosition {
  return {
    name,
    longitude: signIndex * 30 + 15,
    signIndex,
    sign: SIGNS[signIndex],
    degreeInSign: 15,
    dms: "15°00'00\"",
    nakshatra: 'Ashwini',
    nakshatraIndex: 0,
    nakshatraLord: 'Ketu',
    pada: 1,
    subLord: 'Ketu',
    subSubLord: 'Ketu',
    isRetrograde: false,
    house: 1,
    dignity: name === 'Ascendant' ? 'Lagna' : 'Neutral',
  };
}

/**
 * Audits legacy `jyotishMath.ts` `computeAshtakavarga` against local canonical BPHS output.
 */
export function auditLegacyJyotishMathAshtakavarga(
  input: AshtakavargaSignInput
): LegacyAshtakavargaAuditReport | null {
  const localAv = computeLocalAshtakavarga(input);
  if (!localAv) return null;

  const planetsOnly: PlanetPosition[] = CLASSICAL_7_PLANETS.map((pl) =>
    makeMinimalPlanetPosition(pl, input.planetSignIndices[pl])
  );
  const planetsWithAsc: PlanetPosition[] = [
    ...planetsOnly,
    makeMinimalPlanetPosition('Ascendant', input.ascendantSignIndex),
  ];

  const legacyWithAsc = computeLegacyAshtakavarga(planetsWithAsc);
  const legacyNoAsc = computeLegacyAshtakavarga(planetsOnly);

  const cmp = compareAshtakavargaMatrices(
    localAv,
    {
      sarvashtakavarga: legacyWithAsc.sarva,
      bhinnashtakavarga: legacyWithAsc.bhinna,
    },
    'legacy:jyotishMath.computeAshtakavarga(withAscendant)'
  );

  const droppedBindus = legacyWithAsc.totalBindus - legacyNoAsc.totalBindus;
  const legacyEmitsPrastara = 'prasthara' in (legacyWithAsc as unknown as Record<string, unknown>);

  const findings: string[] = [
    cmp.exactAllCellsMatch
      ? 'With Ascendant passed explicitly as a pseudo-planet, legacy jyotishMath.computeAshtakavarga matches all 84 BAV and 12 SAV cells.'
      : `Legacy jyotishMath mismatch even with Ascendant: ${cmp.summary}`,
    `Omitting "Ascendant" from legacy planets[] silently drops ${droppedBindus} bindus (total=${legacyNoAsc.totalBindus} instead of 337) without warning.`,
    legacyEmitsPrastara
      ? 'Legacy computeAshtakavarga emits Prastara.'
      : 'Legacy computeAshtakavarga omits contributor-level Prastara matrices (7x8x12).',
  ];

  return {
    withAscendantMatchedAll84BavCells: cmp.bavMatched,
    withAscendantMatchedAll12SavCells: cmp.savMatched,
    withAscendantTotalBindus: legacyWithAsc.totalBindus,
    withoutAscendantTotalBindus: legacyNoAsc.totalBindus,
    withoutAscendantDroppedBindus: droppedBindus,
    legacyEmitsPrastara,
    findings,
  };
}

/**
 * Evaluates sign-boundary sensitivity when one body moves across a 30° sign cusp.
 */
export function evaluateAshtakavargaSignBoundaryCase(
  baseInput: AshtakavargaSignInput,
  movingBody: AshtakavargaContributor8,
  lonBeforeDeg: number,
  lonAfterDeg: number
): {
  movingBody: AshtakavargaContributor8;
  beforeSign: string;
  afterSign: string;
  beforeResult: LocalAshtakavargaResult;
  afterResult: LocalAshtakavargaResult;
  savShiftedSignCount: number;
  bavShiftedCellCount: number;
  prastaraShiftedCellCount: number;
  invariant337Preserved: boolean;
} {
  const beforeIdx = Math.floor(normalizeDeg(lonBeforeDeg) / 30) % 12;
  const afterIdx = Math.floor(normalizeDeg(lonAfterDeg) / 30) % 12;

  const makeInput = (idx: number): AshtakavargaSignInput =>
    movingBody === 'Ascendant'
      ? { ...baseInput, ascendantSignIndex: idx }
      : {
          ...baseInput,
          planetSignIndices: { ...baseInput.planetSignIndices, [movingBody]: idx },
        };

  const beforeResult = computeLocalAshtakavarga(makeInput(beforeIdx))!;
  const afterResult = computeLocalAshtakavarga(makeInput(afterIdx))!;
  const diff = compareAshtakavargaMatrices(
    beforeResult,
    {
      sarvashtakavarga: afterResult.sarvashtakavarga,
      bhinnashtakavarga: afterResult.bhinnashtakavarga,
      prastharashtakavarga: afterResult.prastharashtakavarga,
    },
    'boundary_after'
  );

  return {
    movingBody,
    beforeSign: SIGNS[beforeIdx],
    afterSign: SIGNS[afterIdx],
    beforeResult,
    afterResult,
    savShiftedSignCount: diff.savDiffs.length,
    bavShiftedCellCount: diff.bavDiffs.length,
    prastaraShiftedCellCount: diff.prastaraDiffs.length,
    invariant337Preserved:
      beforeResult.totalPoints === 337 &&
      afterResult.totalPoints === 337 &&
      beforeResult.selfConsistencyPassed &&
      afterResult.selfConsistencyPassed,
  };
}

/**
 * Computes local Ashtakavarga + matrix audit against any existing provider Ashtakavarga on Master Record.
 */
export function auditMasterAshtakavargaWithLocal(
  vedicData: VedicLahiriFrame | null | undefined,
  providerSourceLabel: string
): {
  localAshtakavarga: LocalAshtakavargaResult | null;
  audit: LocalAshtakavargaMasterAudit;
} {
  const rulesAudit = verifyClassicalAshtakavargaRulesTable();
  const signInput = extractCanonicalAshtakavargaSignInput(vedicData);
  const localAshtakavarga = signInput ? computeLocalAshtakavarga(signInput) : null;

  if (!signInput || !localAshtakavarga) {
    return {
      localAshtakavarga: null,
      audit: {
        available: false,
        rulesTableValid: rulesAudit.valid,
        providerAshtakavargaPresent: Boolean(vedicData?.ashtakavarga),
        comparisonWithProvider: null,
        legacyComputeAudit: null,
        localTotalPoints: null,
        readyForPreferredAdoption: false,
        notes: [
          'Cannot compute local Ashtakavarga: canonical D1 Ascendant or all 7 classical planets missing/invalid (zero-coercion guard).',
        ],
      },
    };
  }

  const legacyComputeAudit = auditLegacyJyotishMathAshtakavarga(signInput);
  const providerAv = vedicData?.ashtakavarga ?? null;
  const comparisonWithProvider = providerAv
    ? compareAshtakavargaMatrices(
        localAshtakavarga,
        providerAv,
        providerSourceLabel || 'provider_ashtakavarga'
      )
    : null;

  const notes: string[] = [];
  if (localAshtakavarga.selfConsistencyPassed && rulesAudit.valid) {
    notes.push(
      'Local Ashtakavarga (BAV, SAV=337, 7x8x12 Prastara) computed deterministically on canonical D1 and verified self-consistent.'
    );
  }
  if (comparisonWithProvider) {
    notes.push(comparisonWithProvider.summary);
  } else {
    notes.push('No provider Ashtakavarga present on primary frame for side-by-side matrix diff.');
  }

  return {
    localAshtakavarga,
    audit: {
      available: true,
      rulesTableValid: rulesAudit.valid,
      providerAshtakavargaPresent: Boolean(providerAv),
      comparisonWithProvider,
      legacyComputeAudit,
      localTotalPoints: localAshtakavarga.totalPoints,
      readyForPreferredAdoption:
        rulesAudit.valid &&
        localAshtakavarga.selfConsistencyPassed &&
        localAshtakavarga.totalPoints === CLASSICAL_SAV_TOTAL,
      notes,
    },
  };
}

/**
 * Promotes independently validated local Ashtakavarga to become the canonical
 * `vedicLahiri.data.ashtakavarga` implementation (operating directly on canonical D1 placements)
 * while preserving any prior provider Ashtakavarga in `providerExtendedDatasets.providerOriginalAshtakavargaBackup`.
 *
 * Callers run `evaluateDatasetCompleteness` afterward (or pass through `enrichMasterWithPhase4LocalCalculations`).
 */
export function buildPreferredLocalAshtakavargaFrame(
  localAv: LocalAshtakavargaResult
): NonNullable<VedicLahiriFrame['ashtakavarga']> {
  return {
    sarvashtakavarga: [...localAv.sarvashtakavarga],
    bhinnashtakavarga: Object.fromEntries(
      CLASSICAL_7_PLANETS.map((pl) => [pl, [...localAv.bhinnashtakavarga[pl]]])
    ),
    prastharashtakavarga: Object.fromEntries(
      CLASSICAL_7_PLANETS.map((pl) => [
        pl,
        Object.fromEntries(
          ASHTAKAVARGA_CONTRIBUTORS_8.map((c) => [c, [...localAv.prastharashtakavarga[pl][c]]])
        ),
      ])
    ),
    totalPoints: localAv.totalPoints,
  };
}

export function extractCanonSignIndexFromPair(
  signName: string | null | undefined,
  lonDeg?: number | null
): number | null {
  if (lonDeg !== null && lonDeg !== undefined && Number.isFinite(lonDeg)) {
    return Math.floor(normalizeDeg(lonDeg) / 30) % 12;
  }
  if (signName) {
    const idx = SIGNS.findIndex((s) => s.toLowerCase() === signName.trim().toLowerCase());
    if (idx >= 0) return idx;
  }
  return null;
}

export function isPreferredLocalAshtakavargaRecord(master: LayerBMasterChartRecord): boolean {
  return asObj(master.providerExtendedDatasets)?.localAshtakavargaPreferred === true;
}

export function resolveCanonicalBirthSummaryForAv(instant: CanonicalBirthInstant): string {
  return `${instant.input.birthDate} ${instant.input.birthTime} (${instant.utc.iso})`;
}
