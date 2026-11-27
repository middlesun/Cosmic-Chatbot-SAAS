/**
 * Isolated V2 Engine — Phase 4: Deterministic Local Vedic Mathematical Modules
 *
 * Pure TypeScript (Cloudflare Workers compatible — zero Node built-ins).
 * Implements deterministic, zero-coercion classical BPHS calculations missing from
 * AstroWay / FreeAstroAPI:
 *  1. Panchadha Maitri (Five-Fold Compound Planetary Friendship — Naisargika + Tatkalika)
 *  2. Vimshopaka Bala (Shadvarga, Saptavarga, Dashavarga, Shodashavarga out of 20.0)
 *  3. Natal Dispositor Graph, Chains, Cycles & Parivartana Mutual Exchanges (D1 & D9)
 *  4. Deterministic Vedic Planetary Conditions (Dignity, Combustion, Vargottama, Gandanta, Graha Yuddha)
 *  5. Master Record Phase 4 Orchestrator & Preferred Local Ashtakavarga Promotion
 *
 * Never mutates or overwrites primary provider planetary coordinates, Shadbala,
 * divisional charts, or Dashas.
 */

import { normalizeDeg, SIGN_LORDS, SIGNS } from '../jyotishMath';
import { evaluateDatasetCompleteness } from './datasetManifest';
import {
  auditMasterAshtakavargaWithLocal,
  buildPreferredLocalAshtakavargaFrame,
  CLASSICAL_7_PLANETS,
  type Classical7Planet,
  type LocalAshtakavargaMasterAudit,
  type LocalAshtakavargaResult,
} from './localAshtakavarga';
import type { LayerBMasterChartRecord, VedicLahiriFrame } from './types';

export type NaturalRelation = 'Friend' | 'Neutral' | 'Enemy';
export type CompoundRelation =
  | 'Self'
  | 'Adhi Mitra'
  | 'Mitra'
  | 'Sama'
  | 'Shatru'
  | 'Adhi Shatru';

export const NATURAL_RELATIONS_BPHS: Readonly<
  Record<
    Classical7Planet,
    Readonly<{
      friends: readonly Classical7Planet[];
      neutral: readonly Classical7Planet[];
      enemies: readonly Classical7Planet[];
    }>
  >
> = {
  Sun: { friends: ['Moon', 'Mars', 'Jupiter'], neutral: ['Mercury'], enemies: ['Venus', 'Saturn'] },
  Moon: { friends: ['Sun', 'Mercury'], neutral: ['Mars', 'Jupiter', 'Venus', 'Saturn'], enemies: [] },
  Mars: { friends: ['Sun', 'Moon', 'Jupiter'], neutral: ['Venus', 'Saturn'], enemies: ['Mercury'] },
  Mercury: { friends: ['Sun', 'Venus'], neutral: ['Mars', 'Jupiter', 'Saturn'], enemies: ['Moon'] },
  Jupiter: { friends: ['Sun', 'Moon', 'Mars'], neutral: ['Saturn'], enemies: ['Mercury', 'Venus'] },
  Venus: { friends: ['Mercury', 'Saturn'], neutral: ['Mars', 'Jupiter'], enemies: ['Sun', 'Moon'] },
  Saturn: { friends: ['Mercury', 'Venus'], neutral: ['Jupiter'], enemies: ['Sun', 'Moon', 'Mars'] },
};

const EXALTATION_SIGNS_9: Record<string, number> = {
  Sun: 0,     // Aries
  Moon: 1,    // Taurus
  Mars: 9,    // Capricorn
  Mercury: 5, // Virgo
  Jupiter: 3, // Cancer
  Venus: 11,  // Pisces
  Saturn: 6,  // Libra
  Rahu: 1,    // Taurus (common Parashari convention)
  Ketu: 7,    // Scorpio
};

const DEBILITATION_SIGNS_9: Record<string, number> = {
  Sun: 6,
  Moon: 7,
  Mars: 3,
  Mercury: 11,
  Jupiter: 9,
  Venus: 5,
  Saturn: 0,
  Rahu: 7,
  Ketu: 1,
};

const MOOLATRIKONA_BANDS_7: Record<
  Classical7Planet,
  { signIndex: number; minDeg: number; maxDeg: number }
> = {
  Sun: { signIndex: 4, minDeg: 0, maxDeg: 20 },       // Leo 0-20°
  Moon: { signIndex: 1, minDeg: 3, maxDeg: 30 },      // Taurus 3-30° (0-3° Exaltation)
  Mars: { signIndex: 0, minDeg: 0, maxDeg: 12 },      // Aries 0-12°
  Mercury: { signIndex: 5, minDeg: 15, maxDeg: 20 },  // Virgo 15-20° (0-15° Exaltation)
  Jupiter: { signIndex: 8, minDeg: 0, maxDeg: 10 },   // Sagittarius 0-10°
  Venus: { signIndex: 6, minDeg: 0, maxDeg: 15 },     // Libra 0-15°
  Saturn: { signIndex: 10, minDeg: 0, maxDeg: 20 },   // Aquarius 0-20°
};

const OWN_SIGNS_7: Record<Classical7Planet, readonly number[]> = {
  Sun: [4],
  Moon: [3],
  Mars: [0, 7],
  Mercury: [2, 5],
  Jupiter: [8, 11],
  Venus: [1, 6],
  Saturn: [9, 10],
};

const VIMSHOTTARI_BODY_NAMES_9 = [
  ...CLASSICAL_7_PLANETS,
  'Rahu',
  'Ketu',
] as const;

export type VimshopakaSchemeName =
  | 'shadvarga'
  | 'saptavarga'
  | 'dashavarga'
  | 'shodashavarga';

export const VIMSHOTAKA_SCHEME_WEIGHTS: Readonly<
  Record<VimshopakaSchemeName, Readonly<Record<string, number>>>
> = {
  shadvarga: {
    D1: 6,
    D2: 2,
    D3: 4,
    D9: 5,
    D12: 2,
    D30: 1,
  },
  saptavarga: {
    D1: 5,
    D2: 2,
    D3: 3,
    D7: 2.5,
    D9: 4.5,
    D12: 2,
    D30: 1,
  },
  dashavarga: {
    D1: 3,
    D2: 1.5,
    D3: 1.5,
    D7: 1.5,
    D9: 1.5,
    D10: 1.5,
    D12: 1.5,
    D16: 1.5,
    D30: 1.5,
    D60: 5,
  },
  shodashavarga: {
    D1: 3.5,
    D2: 1,
    D3: 1,
    D4: 0.5,
    D7: 0.5,
    D9: 3,
    D10: 0.5,
    D12: 0.5,
    D16: 2,
    D20: 0.5,
    D24: 0.5,
    D27: 0.5,
    D30: 1,
    D40: 0.5,
    D45: 0.5,
    D60: 4,
  },
};

export const VIMSHOPAKA_DIGNITY_POINTS: Readonly<Record<string, number>> = {
  Moolatrikona: 20,
  'Own Sign': 20,
  'Adhi Mitra': 18,
  Mitra: 15,
  Sama: 10,
  Shatru: 7,
  'Adhi Shatru': 5,
};

export interface PanchadhaMaitriEntry {
  target: Classical7Planet;
  naturalRelation: NaturalRelation | 'Self';
  naturalScore: number; // +1, 0, -1
  tatkalikaHouseFromSource: number; // 1..12
  tatkalikaIsFriend: boolean | null;
  tatkalikaScore: number; // +1 or -1 (0 for Self)
  compoundScore: number; // -2..+2
  compoundRelation: CompoundRelation;
}

export interface PanchadhaMaitriResult {
  valid: true;
  source: 'local:panchadhaMaitri';
  methodology: 'bphs_ch3_compound_friendship_d1';
  note: string;
  signIndexByPlanet: Record<Classical7Planet, number>;
  signByPlanet: Record<Classical7Planet, string>;
  matrix: Record<Classical7Planet, Record<Classical7Planet, PanchadhaMaitriEntry>>;
  summaryByPlanet: Record<
    Classical7Planet,
    {
      adhiMitra: Classical7Planet[];
      mitra: Classical7Planet[];
      sama: Classical7Planet[];
      shatru: Classical7Planet[];
      adhiShatru: Classical7Planet[];
    }
  >;
}

export interface VimshopakaPlanetVargaContribution {
  division: string;
  weight: number;
  signIndex: number;
  sign: string;
  signLord: Classical7Planet;
  dignityCategory:
    | 'Moolatrikona'
    | 'Own Sign'
    | 'Adhi Mitra'
    | 'Mitra'
    | 'Sama'
    | 'Shatru'
    | 'Adhi Shatru';
  dignityFactorOutOf20: number;
  weightedPoints: number;
}

export interface VimshopakaSchemeResult {
  scheme: VimshopakaSchemeName;
  complete: boolean;
  requiredDivisions: string[];
  missingDivisions: string[];
  missingBodyPlacements: string[];
  maxPossiblePoints: 20;
  scoresByPlanet: Record<
    Classical7Planet,
    {
      planet: Classical7Planet;
      scoreOutOf20: number;
      percentage: number;
      strengthTier: 'Purna/High' | 'Madhya/Moderate' | 'Alpa/Low';
      contributions: VimshopakaPlanetVargaContribution[];
    }
  > | null;
}

export interface VimshopakaBalaResult {
  valid: boolean;
  source: 'local:vimshopakaBala';
  methodology: 'bphs_ch6_panchadha_dignity_weighted_varga_bala';
  note: string;
  completeSchemesCount: number;
  shodashavargaComplete: boolean;
  schemes: Record<VimshopakaSchemeName, VimshopakaSchemeResult>;
  preferredOrderByShodashavarga: Classical7Planet[] | null;
}

export interface PlanetDispositorNode {
  planet: string;
  signIndex: number;
  sign: string;
  house: number;
  signLord: Classical7Planet;
  dispositorSign: string;
  dispositorHouse: number;
  isSelfDisposited: boolean;
  chain: string[];
  terminationType: 'swakshetra_anchor' | 'mutual_exchange_loop' | 'multi_node_cycle';
  finalDispositor: Classical7Planet | null;
  cycleNodes: string[];
}

export interface MutualExchangePair {
  planetA: Classical7Planet;
  planetB: Classical7Planet;
  signA: string;
  signB: string;
  houseA: number;
  houseB: number;
  parivartanaType: 'Maha' | 'Kahala' | 'Dainya';
}

export interface DispositorRelationshipsResult {
  valid: true;
  source: 'local:dispositorGraph';
  methodology: 'parashari_sign_lord_dispositor_chain_and_parivartana';
  ascendantSignIndex: number;
  ascendantSign: string;
  d1: {
    planets: Record<string, PlanetDispositorNode>;
    swakshetraAnchors: Classical7Planet[];
    mutualExchanges: MutualExchangePair[];
    finalDispositorDistribution: Record<string, string[]>;
    houseDispositors: Array<{
      house: number;
      sign: string;
      lord: Classical7Planet;
      lordPlacedInSign: string;
      lordPlacedInHouse: number;
    }>;
  };
  d9: {
    available: boolean;
    ascendantSign: string | null;
    planets: Record<
      string,
      {
        planet: string;
        sign: string;
        house: number;
        signLord: Classical7Planet;
        isSelfDisposited: boolean;
      }
    > | null;
    mutualExchanges: MutualExchangePair[];
  };
}

export interface LocalVedicPlanetCondition {
  planet: string;
  longitudeDeg: number | null;
  signIndex: number;
  sign: string;
  degreeInSign: number | null;
  house: number;
  isRetrograde: boolean;
  dignity: string;
  compoundRelationToSignLord: CompoundRelation | 'Own/Node' | null;
  sunSeparationDeg: number | null;
  combustionOrbDeg: number | null;
  isCombust: boolean;
  isVargottama: boolean | null;
  isGandanta: boolean;
  inGrahaYuddha: boolean;
}

export interface LocalVedicConditionsResult {
  valid: true;
  source: 'local:vedicDignityConditions';
  methodology: 'bphs_dignity_surya_siddhanta_combustion_vargottama_yuddha';
  byPlanet: Record<string, LocalVedicPlanetCondition>;
  grahaYuddhaPairs: Array<{
    planetA: string;
    planetB: string;
    separationDeg: number;
  }>;
  combustPlanets: string[];
  vargottamaPlanets: string[];
  gandantaPlanets: string[];
}

export interface Phase4LocalCalculationsSummary {
  localAshtakavarga: LocalAshtakavargaResult | null;
  localAshtakavargaAudit: LocalAshtakavargaMasterAudit;
  panchadhaMaitri: PanchadhaMaitriResult | null;
  vimshopakaBala: VimshopakaBalaResult | null;
  dispositorRelationships: DispositorRelationshipsResult | null;
  localVedicConditions: LocalVedicConditionsResult | null;
}

function asObj(val: unknown): Record<string, unknown> | null {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : null;
}

function asObjArr(val: unknown): Array<Record<string, unknown>> {
  return Array.isArray(val)
    ? (val.filter((x) => x && typeof x === 'object' && !Array.isArray(x)) as Array<Record<string, unknown>>)
    : [];
}

function normalizeBody9Name(raw: unknown): string | null {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
  if (!s) return null;
  if (s === 'sun' || s === 'surya') return 'Sun';
  if (s === 'moon' || s === 'chandra') return 'Moon';
  if (s === 'mars' || s === 'mangal' || s === 'mangala' || s === 'kuja') return 'Mars';
  if (s === 'mercury' || s === 'budha' || s === 'budh') return 'Mercury';
  if (s === 'jupiter' || s === 'guru' || s === 'brihaspati') return 'Jupiter';
  if (s === 'venus' || s === 'shukra') return 'Venus';
  if (s === 'saturn' || s === 'shani') return 'Saturn';
  if (
    s === 'rahu' ||
    s === 'mean node' ||
    s === 'true node' ||
    s === 'north node'
  ) {
    return 'Rahu';
  }
  if (
    s === 'ketu' ||
    s === 'south node' ||
    s === 'mean south node' ||
    s === 'true south node'
  ) {
    return 'Ketu';
  }
  return null;
}

function resolveBodySignIndex(body: Record<string, unknown> | null | undefined): {
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
  const rawSign =
    typeof body.sign === 'string'
      ? body.sign
      : typeof body.signName === 'string'
      ? body.signName
      : '';
  if (rawSign.trim()) {
    const idx = SIGNS.findIndex((s) => s.toLowerCase() === rawSign.trim().toLowerCase());
    if (idx >= 0) return { signIndex: idx, lonDeg: null };
  }
  return { signIndex: null, lonDeg: null };
}

function extractD1PlanetsMap(
  vedicData: VedicLahiriFrame | null | undefined
): Map<string, { signIndex: number; lonDeg: number | null; isRetrograde: boolean }> | null {
  if (!vedicData) return null;
  const out = new Map<string, { signIndex: number; lonDeg: number | null; isRetrograde: boolean }>();
  for (const p of vedicData.planets || []) {
    const canon = normalizeBody9Name(p.name ?? p.planet ?? p.raw_name);
    if (!canon || out.has(canon)) continue;
    const res = resolveBodySignIndex(p);
    if (res.signIndex !== null) {
      out.set(canon, {
        signIndex: res.signIndex,
        lonDeg: res.lonDeg,
        isRetrograde: Boolean(p.is_retrograde ?? p.isRetrograde),
      });
    }
  }
  return out;
}

function getNaturalRelationScore(
  source: Classical7Planet,
  target: Classical7Planet
): { relation: NaturalRelation; score: number } {
  const rel = NATURAL_RELATIONS_BPHS[source];
  if (rel.friends.includes(target)) return { relation: 'Friend', score: 1 };
  if (rel.neutral.includes(target)) return { relation: 'Neutral', score: 0 };
  return { relation: 'Enemy', score: -1 };
}

function resolveCompoundRelationLabel(score: number): CompoundRelation {
  if (score >= 2) return 'Adhi Mitra';
  if (score === 1) return 'Mitra';
  if (score === 0) return 'Sama';
  if (score === -1) return 'Shatru';
  return 'Adhi Shatru';
}

/**
 * 1. Panchadha Maitri (Five-Fold Compound Planetary Friendship)
 */
export function computePanchadhaMaitri(
  vedicData: VedicLahiriFrame | null | undefined
): PanchadhaMaitriResult | null {
  const pMap = extractD1PlanetsMap(vedicData);
  if (!pMap) return null;

  const signIndexByPlanet = {} as Record<Classical7Planet, number>;
  const signByPlanet = {} as Record<Classical7Planet, string>;
  for (const pl of CLASSICAL_7_PLANETS) {
    const entry = pMap.get(pl);
    if (!entry) return null; // Zero-coercion: all 7 classical planets required
    signIndexByPlanet[pl] = entry.signIndex;
    signByPlanet[pl] = SIGNS[entry.signIndex];
  }

  const matrix = {} as PanchadhaMaitriResult['matrix'];
  const summaryByPlanet = {} as PanchadhaMaitriResult['summaryByPlanet'];

  for (const source of CLASSICAL_7_PLANETS) {
    const row = {} as Record<Classical7Planet, PanchadhaMaitriEntry>;
    const summary: PanchadhaMaitriResult['summaryByPlanet'][Classical7Planet] = {
      adhiMitra: [],
      mitra: [],
      sama: [],
      shatru: [],
      adhiShatru: [],
    };
    const sIdx = signIndexByPlanet[source];

    for (const target of CLASSICAL_7_PLANETS) {
      if (source === target) {
        row[target] = {
          target,
          naturalRelation: 'Self',
          naturalScore: 0,
          tatkalikaHouseFromSource: 1,
          tatkalikaIsFriend: null,
          tatkalikaScore: 0,
          compoundScore: 0,
          compoundRelation: 'Self',
        };
        continue;
      }

      const tIdx = signIndexByPlanet[target];
      const relHouse = ((tIdx - sIdx + 12) % 12) + 1;
      const tatkalikaIsFriend = [2, 3, 4, 10, 11, 12].includes(relHouse);
      const tatkalikaScore = tatkalikaIsFriend ? 1 : -1;
      const nat = getNaturalRelationScore(source, target);
      const compoundScore = nat.score + tatkalikaScore;
      const compoundRelation = resolveCompoundRelationLabel(compoundScore);

      row[target] = {
        target,
        naturalRelation: nat.relation,
        naturalScore: nat.score,
        tatkalikaHouseFromSource: relHouse,
        tatkalikaIsFriend,
        tatkalikaScore,
        compoundScore,
        compoundRelation,
      };

      if (compoundRelation === 'Adhi Mitra') summary.adhiMitra.push(target);
      else if (compoundRelation === 'Mitra') summary.mitra.push(target);
      else if (compoundRelation === 'Sama') summary.sama.push(target);
      else if (compoundRelation === 'Shatru') summary.shatru.push(target);
      else if (compoundRelation === 'Adhi Shatru') summary.adhiShatru.push(target);
    }

    matrix[source] = row;
    summaryByPlanet[source] = summary;
  }

  return {
    valid: true,
    source: 'local:panchadhaMaitri',
    methodology: 'bphs_ch3_compound_friendship_d1',
    note: 'Combines Naisargika Maitri with D1 Tatkalika Maitri (houses 2,3,4,10,11,12 = temporary friend; 1,5,6,7,8,9 = temporary enemy). Nodes (Rahu/Ketu) follow separate Parashari conventions and are omitted from classical 7-planet compound matrix.',
    signIndexByPlanet,
    signByPlanet,
    matrix,
    summaryByPlanet,
  };
}

function findDivisionChart(
  chartsByDivision: Record<string, Record<string, unknown>> | null | undefined,
  divKey: string
): Record<string, unknown> | null {
  if (!chartsByDivision) return null;
  const numPart = divKey.replace(/^D/i, '');
  for (const [k, v] of Object.entries(chartsByDivision)) {
    const ku = k.trim().toUpperCase();
    if (ku === divKey.toUpperCase() || ku === numPart) {
      return asObj(v);
    }
  }
  return null;
}

function extractDivisionSignMap7(
  vedicData: VedicLahiriFrame,
  divKey: string
): Map<Classical7Planet, number> | null {
  const vargaChart = findDivisionChart(vedicData.vargas?.chartsByDivision, divKey);
  const planetList =
    vargaChart && asObjArr(vargaChart.planets).length > 0
      ? asObjArr(vargaChart.planets)
      : divKey === 'D1'
      ? vedicData.planets
      : [];

  if (planetList.length === 0) return null;

  const out = new Map<Classical7Planet, number>();
  for (const p of planetList) {
    const canon = normalizeBody9Name(p.name ?? p.planet ?? p.raw_name);
    if (!canon || !CLASSICAL_7_PLANETS.includes(canon as Classical7Planet)) continue;
    const pl = canon as Classical7Planet;
    if (out.has(pl)) continue;
    const res = resolveBodySignIndex(p);
    if (res.signIndex !== null) {
      out.set(pl, res.signIndex);
    }
  }
  return out;
}

function isMoolatrikonaInD1(
  planet: Classical7Planet,
  signIndex: number,
  lonDeg: number | null
): boolean {
  const band = MOOLATRIKONA_BANDS_7[planet];
  if (signIndex !== band.signIndex) return false;
  if (lonDeg === null) return true;
  const degInSign = normalizeDeg(lonDeg) % 30;
  return degInSign >= band.minDeg && degInSign < band.maxDeg;
}

/**
 * 2. Vimshopaka Bala (Shadvarga / Saptavarga / Dashavarga / Shodashavarga)
 */
export function computeVimshopakaBala(
  vedicData: VedicLahiriFrame | null | undefined,
  panchadhaMaitri: PanchadhaMaitriResult | null
): VimshopakaBalaResult | null {
  if (!vedicData || !panchadhaMaitri) return null;
  const d1Map = extractD1PlanetsMap(vedicData);
  if (!d1Map) return null;

  const divisionMaps = new Map<string, Map<Classical7Planet, number> | null>();
  const allNeededDivs = Array.from(
    new Set(Object.values(VIMSHOTAKA_SCHEME_WEIGHTS).flatMap((w) => Object.keys(w)))
  );
  for (const div of allNeededDivs) {
    divisionMaps.set(div, extractDivisionSignMap7(vedicData, div));
  }

  const schemes = {} as Record<VimshopakaSchemeName, VimshopakaSchemeResult>;
  let completeSchemesCount = 0;

  for (const schemeName of [
    'shadvarga',
    'saptavarga',
    'dashavarga',
    'shodashavarga',
  ] as const) {
    const weights = VIMSHOTAKA_SCHEME_WEIGHTS[schemeName];
    const requiredDivisions = Object.keys(weights);
    const missingDivisions: string[] = [];
    const missingBodyPlacements: string[] = [];

    for (const div of requiredDivisions) {
      const divMap = divisionMaps.get(div);
      if (!divMap) {
        missingDivisions.push(div);
        continue;
      }
      for (const pl of CLASSICAL_7_PLANETS) {
        if (!divMap.has(pl)) {
          missingBodyPlacements.push(`${div}:${pl}`);
        }
      }
    }

    if (missingDivisions.length > 0 || missingBodyPlacements.length > 0) {
      schemes[schemeName] = {
        scheme: schemeName,
        complete: false,
        requiredDivisions,
        missingDivisions,
        missingBodyPlacements,
        maxPossiblePoints: 20,
        scoresByPlanet: null,
      };
      continue;
    }

    completeSchemesCount++;
    const scoresByPlanet = {} as NonNullable<VimshopakaSchemeResult['scoresByPlanet']>;

    for (const pl of CLASSICAL_7_PLANETS) {
      const contributions: VimshopakaPlanetVargaContribution[] = [];
      let rawSum = 0;

      for (const div of requiredDivisions) {
        const weight = weights[div];
        const signIndex = divisionMaps.get(div)!.get(pl)!;
        const signLord = SIGN_LORDS[signIndex] as Classical7Planet;

        let dignityCategory: VimshopakaPlanetVargaContribution['dignityCategory'];
        if (div === 'D1' && isMoolatrikonaInD1(pl, signIndex, d1Map.get(pl)?.lonDeg ?? null)) {
          dignityCategory = 'Moolatrikona';
        } else if (MOOLATRIKONA_BANDS_7[pl].signIndex === signIndex && OWN_SIGNS_7[pl].includes(signIndex)) {
          dignityCategory = 'Own Sign';
        } else if (OWN_SIGNS_7[pl].includes(signIndex) || signLord === pl) {
          dignityCategory = 'Own Sign';
        } else {
          const rel = panchadhaMaitri.matrix[pl][signLord].compoundRelation;
          dignityCategory =
            rel === 'Self' ? 'Own Sign' : (rel as VimshopakaPlanetVargaContribution['dignityCategory']);
        }

        const factor = VIMSHOPAKA_DIGNITY_POINTS[dignityCategory];
        const weightedPoints = (weight * factor) / 20;
        rawSum += weightedPoints;

        contributions.push({
          division: div,
          weight,
          signIndex,
          sign: SIGNS[signIndex],
          signLord,
          dignityCategory,
          dignityFactorOutOf20: factor,
          weightedPoints: Number(weightedPoints.toFixed(4)),
        });
      }

      const scoreOutOf20 = Number(rawSum.toFixed(4));
      const percentage = Number(((scoreOutOf20 / 20) * 100).toFixed(2));
      const strengthTier =
        scoreOutOf20 >= 15
          ? 'Purna/High'
          : scoreOutOf20 >= 10
          ? 'Madhya/Moderate'
          : 'Alpa/Low';

      scoresByPlanet[pl] = {
        planet: pl,
        scoreOutOf20,
        percentage,
        strengthTier,
        contributions,
      };
    }

    schemes[schemeName] = {
      scheme: schemeName,
      complete: true,
      requiredDivisions,
      missingDivisions: [],
      missingBodyPlacements: [],
      maxPossiblePoints: 20,
      scoresByPlanet,
    };
  }

  const shodScores = schemes.shodashavarga.scoresByPlanet;
  const preferredOrderByShodashavarga = shodScores
    ? ([...CLASSICAL_7_PLANETS].sort(
        (a, b) => shodScores[b].scoreOutOf20 - shodScores[a].scoreOutOf20
      ) as Classical7Planet[])
    : null;

  return {
    valid: completeSchemesCount > 0,
    source: 'local:vimshopakaBala',
    methodology: 'bphs_ch6_panchadha_dignity_weighted_varga_bala',
    note: 'BPHS Ch. 6 v.27 Vimshopaka dignity scale (Moolatrikona/Own=20, Adhi Mitra=18, Mitra=15, Sama=10, Shatru=7, Adhi Shatru=5) weighted per scheme out of 20.0. Zero-coercion: any scheme with missing Vargas stays incomplete/null.',
    completeSchemesCount,
    shodashavargaComplete: schemes.shodashavarga.complete,
    schemes,
    preferredOrderByShodashavarga,
  };
}

function classifyParivartana(houseA: number, houseB: number): MutualExchangePair['parivartanaType'] {
  if ([6, 8, 12].includes(houseA) || [6, 8, 12].includes(houseB)) return 'Dainya';
  if (houseA === 3 || houseB === 3) return 'Kahala';
  return 'Maha';
}

/**
 * 3. Natal Dispositor Graph, Chains, Mutual Exchanges (Parivartana) & D9 Dispositors
 */
export function computeDispositorRelationships(
  vedicData: VedicLahiriFrame | null | undefined
): DispositorRelationshipsResult | null {
  if (!vedicData) return null;
  const ascRes = resolveBodySignIndex(vedicData.ascendant);
  if (ascRes.signIndex === null) return null;
  const ascSignIdx = ascRes.signIndex;

  const pMap = extractD1PlanetsMap(vedicData);
  if (!pMap) return null;
  for (const body of VIMSHOTTARI_BODY_NAMES_9) {
    if (!pMap.has(body)) return null;
  }

  const d1PlanetNodes = {} as Record<string, PlanetDispositorNode>;
  const swakshetraAnchors: Classical7Planet[] = [];
  const finalDispositorDistribution: Record<string, string[]> = {};

  for (const body of VIMSHOTTARI_BODY_NAMES_9) {
    const startSignIdx = pMap.get(body)!.signIndex;
    const startHouse = ((startSignIdx - ascSignIdx + 12) % 12) + 1;
    const directLord = SIGN_LORDS[startSignIdx] as Classical7Planet;
    const directLordEntry = pMap.get(directLord)!;
    const dispositorHouse = ((directLordEntry.signIndex - ascSignIdx + 12) % 12) + 1;
    const isSelfDisposited = directLord === body;

    if (isSelfDisposited && CLASSICAL_7_PLANETS.includes(body as Classical7Planet)) {
      swakshetraAnchors.push(body as Classical7Planet);
    }

    // Walk dispositor chain safely without infinite loops
    const chain: string[] = [body];
    const visited = new Set<string>([body]);
    let cursor: string = body;
    let terminationType: PlanetDispositorNode['terminationType'] = 'swakshetra_anchor';
    let finalDispositor: Classical7Planet | null = null;
    let cycleNodes: string[] = [];

    for (let step = 0; step < 12; step++) {
      const cursorSignIdx = pMap.get(cursor)!.signIndex;
      const nextLord = SIGN_LORDS[cursorSignIdx] as Classical7Planet;
      if (nextLord === cursor) {
        terminationType = 'swakshetra_anchor';
        finalDispositor = nextLord;
        cycleNodes = [nextLord];
        break;
      }
      chain.push(nextLord);
      if (visited.has(nextLord)) {
        const cycleStart = chain.indexOf(nextLord);
        const loop = chain.slice(cycleStart, chain.length - 1);
        cycleNodes = Array.from(new Set(loop));
        terminationType =
          cycleNodes.length === 2 ? 'mutual_exchange_loop' : 'multi_node_cycle';
        finalDispositor = null;
        break;
      }
      visited.add(nextLord);
      cursor = nextLord;
    }

    const anchorKey = finalDispositor ?? `cycle(${cycleNodes.join('<->')})`;
    if (!finalDispositorDistribution[anchorKey]) finalDispositorDistribution[anchorKey] = [];
    finalDispositorDistribution[anchorKey].push(body);

    d1PlanetNodes[body] = {
      planet: body,
      signIndex: startSignIdx,
      sign: SIGNS[startSignIdx],
      house: startHouse,
      signLord: directLord,
      dispositorSign: SIGNS[directLordEntry.signIndex],
      dispositorHouse,
      isSelfDisposited,
      chain,
      terminationType,
      finalDispositor,
      cycleNodes,
    };
  }

  // Extract unique Parivartana mutual exchanges among classical 7 planets
  const mutualExchanges: MutualExchangePair[] = [];
  for (let i = 0; i < CLASSICAL_7_PLANETS.length; i++) {
    for (let j = i + 1; j < CLASSICAL_7_PLANETS.length; j++) {
      const a = CLASSICAL_7_PLANETS[i];
      const b = CLASSICAL_7_PLANETS[j];
      const nodeA = d1PlanetNodes[a];
      const nodeB = d1PlanetNodes[b];
      if (nodeA.signLord === b && nodeB.signLord === a) {
        mutualExchanges.push({
          planetA: a,
          planetB: b,
          signA: nodeA.sign,
          signB: nodeB.sign,
          houseA: nodeA.house,
          houseB: nodeB.house,
          parivartanaType: classifyParivartana(nodeA.house, nodeB.house),
        });
      }
    }
  }

  const houseDispositors = Array.from({ length: 12 }, (_, idx) => {
    const house = idx + 1;
    const hSignIdx = (ascSignIdx + idx) % 12;
    const lord = SIGN_LORDS[hSignIdx] as Classical7Planet;
    const lordPlacement = d1PlanetNodes[lord];
    return {
      house,
      sign: SIGNS[hSignIdx],
      lord,
      lordPlacedInSign: lordPlacement.sign,
      lordPlacedInHouse: lordPlacement.house,
    };
  });

  // D9 Dispositors (when complete D9 Navamsa exists)
  const d9Chart = findDivisionChart(vedicData.vargas?.chartsByDivision, 'D9');
  const d9AscRes = d9Chart ? resolveBodySignIndex(asObj(d9Chart.ascendant)) : { signIndex: null };
  const d9PlanetsRaw = d9Chart ? asObjArr(d9Chart.planets) : [];
  const d9Map = new Map<string, number>();
  for (const dp of d9PlanetsRaw) {
    const canon = normalizeBody9Name(dp.name ?? dp.planet ?? dp.raw_name);
    const res = resolveBodySignIndex(dp);
    if (canon && res.signIndex !== null && !d9Map.has(canon)) {
      d9Map.set(canon, res.signIndex);
    }
  }
  const hasD9Complete =
    d9AscRes.signIndex !== null &&
    CLASSICAL_7_PLANETS.every((pl) => d9Map.has(pl));

  let d9Summary: DispositorRelationshipsResult['d9'] = {
    available: false,
    ascendantSign: null,
    planets: null,
    mutualExchanges: [],
  };

  if (hasD9Complete) {
    const d9AscIdx = d9AscRes.signIndex!;
    const d9Planets: NonNullable<DispositorRelationshipsResult['d9']['planets']> = {};
    for (const [body, sIdx] of d9Map.entries()) {
      const lord = SIGN_LORDS[sIdx] as Classical7Planet;
      d9Planets[body] = {
        planet: body,
        sign: SIGNS[sIdx],
        house: ((sIdx - d9AscIdx + 12) % 12) + 1,
        signLord: lord,
        isSelfDisposited: lord === body,
      };
    }
    const d9Mutual: MutualExchangePair[] = [];
    for (let i = 0; i < CLASSICAL_7_PLANETS.length; i++) {
      for (let j = i + 1; j < CLASSICAL_7_PLANETS.length; j++) {
        const a = CLASSICAL_7_PLANETS[i];
        const b = CLASSICAL_7_PLANETS[j];
        if (d9Planets[a]?.signLord === b && d9Planets[b]?.signLord === a) {
          d9Mutual.push({
            planetA: a,
            planetB: b,
            signA: d9Planets[a].sign,
            signB: d9Planets[b].sign,
            houseA: d9Planets[a].house,
            houseB: d9Planets[b].house,
            parivartanaType: classifyParivartana(d9Planets[a].house, d9Planets[b].house),
          });
        }
      }
    }
    d9Summary = {
      available: true,
      ascendantSign: SIGNS[d9AscIdx],
      planets: d9Planets,
      mutualExchanges: d9Mutual,
    };
  }

  return {
    valid: true,
    source: 'local:dispositorGraph',
    methodology: 'parashari_sign_lord_dispositor_chain_and_parivartana',
    ascendantSignIndex: ascSignIdx,
    ascendantSign: SIGNS[ascSignIdx],
    d1: {
      planets: d1PlanetNodes,
      swakshetraAnchors,
      mutualExchanges,
      finalDispositorDistribution,
      houseDispositors,
    },
    d9: d9Summary,
  };
}

function circularDistDeg(a: number, b: number): number {
  let d = Math.abs(normalizeDeg(a) - normalizeDeg(b));
  if (d > 180) d = 360 - d;
  return d;
}

function getCombustionOrb(planet: string, isRetrograde: boolean): number | null {
  switch (planet) {
    case 'Moon':
      return 12;
    case 'Mars':
      return 17;
    case 'Mercury':
      return isRetrograde ? 12 : 14;
    case 'Jupiter':
      return 11;
    case 'Venus':
      return isRetrograde ? 8 : 10;
    case 'Saturn':
      return 15;
    default:
      return null;
  }
}

function isGandantaLongitude(lonDeg: number): boolean {
  const n = normalizeDeg(lonDeg);
  const orb = 3 + 20 / 60; // 3°20'
  // Fire/Water sign junctions: Pisces(330-360)/Aries(0-30), Cancer(90-120)/Leo(120-150), Scorpio(210-240)/Sagittarius(240-270)
  for (const junction of [0, 120, 240]) {
    if (circularDistDeg(n, junction) <= orb) return true;
  }
  return false;
}

/**
 * 4. Deterministic Vedic Conditions (D1 Dignity, Combustion, Vargottama, Gandanta, Graha Yuddha)
 */
export function computeLocalVedicConditions(
  vedicData: VedicLahiriFrame | null | undefined,
  panchadhaMaitri: PanchadhaMaitriResult | null
): LocalVedicConditionsResult | null {
  if (!vedicData || !panchadhaMaitri) return null;
  const ascRes = resolveBodySignIndex(vedicData.ascendant);
  if (ascRes.signIndex === null) return null;
  const ascSignIdx = ascRes.signIndex;

  const pMap = extractD1PlanetsMap(vedicData);
  if (!pMap) return null;
  for (const body of VIMSHOTTARI_BODY_NAMES_9) {
    if (!pMap.has(body)) return null;
  }

  const sunLon = pMap.get('Sun')?.lonDeg ?? null;

  // Optional D9 lookup for Vargottama (D1 sign == D9 sign)
  const d9Map = extractDivisionSignMap7(vedicData, 'D9');
  const d9Chart = findDivisionChart(vedicData.vargas?.chartsByDivision, 'D9');
  const d9NodeMap = new Map<string, number>();
  if (d9Chart) {
    for (const dp of asObjArr(d9Chart.planets)) {
      const canon = normalizeBody9Name(dp.name ?? dp.planet ?? dp.raw_name);
      const res = resolveBodySignIndex(dp);
      if (canon && res.signIndex !== null && !d9NodeMap.has(canon)) {
        d9NodeMap.set(canon, res.signIndex);
      }
    }
  }

  // Graha Yuddha (Planetary War among Mars, Mercury, Jupiter, Venus, Saturn within 1.0°)
  const taraGrahas = ['Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'] as const;
  const grahaYuddhaPairs: LocalVedicConditionsResult['grahaYuddhaPairs'] = [];
  const yuddhaSet = new Set<string>();
  for (let i = 0; i < taraGrahas.length; i++) {
    for (let j = i + 1; j < taraGrahas.length; j++) {
      const a = taraGrahas[i];
      const b = taraGrahas[j];
      const lonA = pMap.get(a)?.lonDeg ?? null;
      const lonB = pMap.get(b)?.lonDeg ?? null;
      if (lonA !== null && lonB !== null) {
        const sep = circularDistDeg(lonA, lonB);
        if (sep <= 1.0) {
          grahaYuddhaPairs.push({
            planetA: a,
            planetB: b,
            separationDeg: Number(sep.toFixed(4)),
          });
          yuddhaSet.add(a);
          yuddhaSet.add(b);
        }
      }
    }
  }

  const byPlanet: Record<string, LocalVedicPlanetCondition> = {};
  const combustPlanets: string[] = [];
  const vargottamaPlanets: string[] = [];
  const gandantaPlanets: string[] = [];

  for (const body of VIMSHOTTARI_BODY_NAMES_9) {
    const entry = pMap.get(body)!;
    const signIndex = entry.signIndex;
    const lon = entry.lonDeg;
    const house = ((signIndex - ascSignIdx + 12) % 12) + 1;
    const signLord = SIGN_LORDS[signIndex] as Classical7Planet;

    let dignity: string;
    let compoundRelationToSignLord: LocalVedicPlanetCondition['compoundRelationToSignLord'] = null;

    if (CLASSICAL_7_PLANETS.includes(body as Classical7Planet)) {
      const pl = body as Classical7Planet;
      const degInSign = lon !== null ? normalizeDeg(lon) % 30 : null;
      const isMoonExaltedSpan = pl === 'Moon' && signIndex === 1 && (degInSign === null || degInSign < 3);
      const isMercExaltedSpan = pl === 'Mercury' && signIndex === 5 && (degInSign === null || degInSign < 15);
      const isExactExaltation =
        pl === 'Moon'
          ? isMoonExaltedSpan
          : pl === 'Mercury'
          ? isMercExaltedSpan
          : EXALTATION_SIGNS_9[pl] === signIndex;

      if (isExactExaltation) {
        dignity = 'Exalted';
      } else if (DEBILITATION_SIGNS_9[pl] === signIndex) {
        dignity = 'Debilitated';
      } else if (isMoolatrikonaInD1(pl, signIndex, lon)) {
        dignity = 'Moolatrikona';
        compoundRelationToSignLord = 'Self';
      } else if (OWN_SIGNS_7[pl].includes(signIndex) || signLord === pl) {
        dignity = 'Own Sign';
        compoundRelationToSignLord = 'Self';
      } else {
        const rel = panchadhaMaitri.matrix[pl][signLord].compoundRelation;
        dignity = rel;
        compoundRelationToSignLord = rel;
      }
    } else {
      // Rahu / Ketu Parashari sign-based tags
      if (EXALTATION_SIGNS_9[body] === signIndex) dignity = 'Exalted';
      else if (DEBILITATION_SIGNS_9[body] === signIndex) dignity = 'Debilitated';
      else if ((body === 'Rahu' && signIndex === 10) || (body === 'Ketu' && signIndex === 7)) {
        dignity = 'Own Sign';
        compoundRelationToSignLord = 'Own/Node';
      } else {
        dignity = `Disposited by ${signLord}`;
        compoundRelationToSignLord = 'Own/Node';
      }
    }

    const sunSep =
      body !== 'Sun' && sunLon !== null && lon !== null
        ? Number(circularDistDeg(lon, sunLon).toFixed(4))
        : null;
    const orb = getCombustionOrb(body, entry.isRetrograde);
    const isCombust = sunSep !== null && orb !== null ? sunSep <= orb : false;
    if (isCombust) combustPlanets.push(body);

    const d9SignIdx = d9NodeMap.get(body) ?? d9Map?.get(body as Classical7Planet) ?? null;
    const isVargottama = d9SignIdx !== null ? d9SignIdx === signIndex : null;
    if (isVargottama) vargottamaPlanets.push(body);

    const isGandanta = lon !== null ? isGandantaLongitude(lon) : false;
    if (isGandanta) gandantaPlanets.push(body);

    byPlanet[body] = {
      planet: body,
      longitudeDeg: lon !== null ? Number(lon.toFixed(4)) : null,
      signIndex,
      sign: SIGNS[signIndex],
      degreeInSign: lon !== null ? Number((lon % 30).toFixed(4)) : null,
      house,
      isRetrograde: entry.isRetrograde,
      dignity,
      compoundRelationToSignLord,
      sunSeparationDeg: sunSep,
      combustionOrbDeg: orb,
      isCombust,
      isVargottama,
      isGandanta,
      inGrahaYuddha: yuddhaSet.has(body),
    };
  }

  return {
    valid: true,
    source: 'local:vedicDignityConditions',
    methodology: 'bphs_dignity_surya_siddhanta_combustion_vargottama_yuddha',
    byPlanet,
    grahaYuddhaPairs,
    combustPlanets,
    vargottamaPlanets,
    gandantaPlanets,
  };
}

/**
 * Pure Phase 4 enrichment pass for a LayerBMasterChartRecord.
 * Computes Panchadha Maitri, Vimshopaka Bala, Dispositor Relationships,
 * Local Vedic Conditions, and Local Ashtakavarga + Matrix Audit without
 * mutating any primary provider D1/Shadbala/Varga/Dasha outputs.
 */
export function computePhase4LocalCalculationsForFrame(
  vedicData: VedicLahiriFrame | null | undefined,
  providerSourceLabel: string
): Phase4LocalCalculationsSummary {
  const { localAshtakavarga, audit: localAshtakavargaAudit } =
    auditMasterAshtakavargaWithLocal(vedicData, providerSourceLabel);
  const panchadhaMaitri = computePanchadhaMaitri(vedicData);
  const vimshopakaBala = computeVimshopakaBala(vedicData, panchadhaMaitri);
  const dispositorRelationships = computeDispositorRelationships(vedicData);
  const localVedicConditions = computeLocalVedicConditions(vedicData, panchadhaMaitri);

  return {
    localAshtakavarga,
    localAshtakavargaAudit,
    panchadhaMaitri,
    vimshopakaBala,
    dispositorRelationships,
    localVedicConditions,
  };
}

/**
 * Enriches a LayerBMasterChartRecord with Phase 4 deterministic local calculations
 * and refreshes `datasetManifest`.
 *
 * When `preferLocalAshtakavarga: true` is supplied AND `localAshtakavarga.selfConsistencyPassed`
 * is verified, local Ashtakavarga becomes the canonical `vedicLahiri.data.ashtakavarga`
 * implementation (preserving any prior provider Ashtakavarga in
 * `providerExtendedDatasets.providerOriginalAshtakavargaBackup`).
 */
export function enrichMasterWithPhase4LocalCalculations(
  master: LayerBMasterChartRecord,
  options?: {
    preferLocalAshtakavarga?: boolean;
  }
): LayerBMasterChartRecord {
  const vedicEnv = master.frames.vedicLahiri;
  const vedicData = vedicEnv?.data ?? null;

  const summary = computePhase4LocalCalculationsForFrame(
    vedicData,
    vedicEnv?.source ?? 'provider'
  );

  let nextVedicEnv = vedicEnv;
  const nextExt: Record<string, unknown> = {
    ...(master.providerExtendedDatasets ?? {}),
    panchadhaMaitri: summary.panchadhaMaitri,
    vimshopakaBala: summary.vimshopakaBala,
    dispositorRelationships: summary.dispositorRelationships,
    localVedicConditions: summary.localVedicConditions,
    localAshtakavarga: summary.localAshtakavarga,
    localAshtakavargaAudit: summary.localAshtakavargaAudit,
  };

  if (
    options?.preferLocalAshtakavarga &&
    vedicData &&
    summary.localAshtakavarga &&
    summary.localAshtakavarga.selfConsistencyPassed
  ) {
    if (vedicData.ashtakavarga && !nextExt.providerOriginalAshtakavargaBackup) {
      nextExt.providerOriginalAshtakavargaBackup = vedicData.ashtakavarga;
    }
    nextExt.localAshtakavargaPreferred = true;
    nextVedicEnv = {
      ...vedicEnv,
      data: {
        ...vedicData,
        ashtakavarga: buildPreferredLocalAshtakavargaFrame(summary.localAshtakavarga),
      },
    };
  }

  const enriched: LayerBMasterChartRecord = {
    ...master,
    frames: {
      ...master.frames,
      vedicLahiri: nextVedicEnv,
    },
    providerExtendedDatasets: nextExt,
  };
  enriched.datasetManifest = evaluateDatasetCompleteness(enriched);
  return enriched;
}

/**
 * Convenience wrapper to promote independently validated local Ashtakavarga
 * as the preferred Ashtakavarga implementation on an existing LayerBMasterChartRecord.
 */
export function adoptPreferredLocalAshtakavarga(
  master: LayerBMasterChartRecord
): LayerBMasterChartRecord {
  return enrichMasterWithPhase4LocalCalculations(master, {
    preferLocalAshtakavarga: true,
  });
}
