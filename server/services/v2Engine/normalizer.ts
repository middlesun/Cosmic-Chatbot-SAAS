/**
 * Isolated V2 Engine — Layer B Master Chart Record Normalizer & Layer C Shell
 *
 * Enforces:
 * - Strict 4-frame separation (Vedic Lahiri, KP Placidus, Bhava Chalit, Western Tropical)
 * - ZERO partial H1/H7 overwrites
 * - ZERO Western-from-KP reconstructions
 * - Complete preservation of all returned provider fields (never pruning unused UI fields)
 * - Explicit provenance & verification metadata on every dataset envelope
 * - Strict No-Silent-Fallback resolution order:
 *     1. Cached verified dataset matching exact inputFingerprint + conventions
 *     2. Independently verified equivalent calculation (explicitly tagged)
 *     3. Explicit 'partial' or 'unavailable' dataset status
 */

import { normalizeDeg, SIGNS } from '../jyotishMath';
import {
  extractAstroWayPlanetaryConditions,
  normalizeAstroWayAlternativeDasha,
  normalizeAstroWayAshtakavargaShodhana,
  normalizeAstroWayBhavabala,
  normalizeAstroWayIshtaKashta,
  normalizeAstroWayJaiminiSuite,
  normalizeAstroWayPanchang,
  normalizeAstroWayShadbalaSubcomponents,
  normalizeAstroWayVimshottari5Level,
} from './astrowayNormalizer';
import {
  V2_RECALCULATION_VERSION,
  deriveCanonicalDatasetState,
  evaluateDatasetCompleteness,
} from './datasetManifest';
import { enrichMasterWithPhase4LocalCalculations } from './localVedicMath';
import { buildShadbalaReconciliationReport } from './shadbalaReconciliation';
import { integrateFreeAstroApiSupplementaryIntoMaster } from './supplementaryCompatibility';
import {
  buildPlanetPositionsFromVedicFrame,
  computeIndependentAstronomicalReference,
  verifyBhavaChalitMethodology,
} from './verifier';
import type {
  AstronomicalTelemetryFrame,
  BhavaChalitFrame,
  CalculationConventionsRecord,
  CanonicalBirthInstant,
  DatasetEnvelope,
  KpPlacidusFrame,
  LayerARawProviderRecord,
  LayerBMasterChartRecord,
  LayerCAnalyticalShell,
  ReferenceDateTimingSnapshot,
  RemainingClassicalGapItem,
  SanitizedProviderCallRecord,
  TemporalScope,
  VedicLahiriFrame,
  WesternTropicalFrame,
} from './types';

export const V2_MASTER_SCHEMA_VERSION = 'v2.master.1.0';

export const REMAINING_CLASSICAL_GAPS_INVENTORY: RemainingClassicalGapItem[] = [
  {
    capability: 'Detailed Shadbala Subcomponents (Uchcha, Saptavargaja, Ojayugma, Kendradi, Drekkana, Natonnata, Paksha, Tribhaga, Abda/Masa/Vara/Hora, Ayana, Yuddha)',
    category: 'Planetary Strength',
    freeAstroApiStatus: 'unavailable',
    localDerivedStatus: 'approximation_only',
    candidateProviders: ['AstroWay', 'Astrology-API.io'],
    notes: 'FreeAstroAPI returns the 6 major Bala sums only. AstroWay/PyJHora/JHora expose full subcomponent breakdown.',
  },
  {
    capability: 'Ishta Phala & Kashta Phala',
    category: 'Planetary Strength',
    freeAstroApiStatus: 'unavailable',
    localDerivedStatus: 'verified_deterministic',
    candidateProviders: ['AstroWay'],
    notes: 'Absent from FreeAstroAPI OpenAPI spec; derivable deterministically from exact Uchcha & Cheshta Bala.',
  },
  {
    capability: 'Bhavabala (Bhava Digbala, Bhava Adhipati, Bhava Drishti)',
    category: 'House Strength',
    freeAstroApiStatus: 'unavailable',
    localDerivedStatus: 'unavailable',
    candidateProviders: ['AstroWay', 'Astrology-API.io'],
    notes: 'Not provided by FreeAstroAPI. Candidate for AstroWay evaluation or exact BPHS implementation.',
  },
  {
    capability: 'Vimshopaka Bala (Shadvarga, Saptavarga, Dashavarga, Shodashavarga)',
    category: 'Varga Strength',
    freeAstroApiStatus: 'unavailable',
    localDerivedStatus: 'unavailable',
    candidateProviders: ['AstroWay'],
    notes: 'Not provided by FreeAstroAPI; derivable deterministically once all 16 Vargas and Panchadha Maitri are verified.',
  },
  {
    capability: 'Panchadha Maitri (Five-fold Compound Friendship)',
    category: 'Planetary Dignity',
    freeAstroApiStatus: 'unavailable',
    localDerivedStatus: 'unavailable',
    candidateProviders: ['AstroWay', 'Astrology-API.io'],
    notes: 'Legacy computeShadbala uses natural friendship only; full BPHS compound friendship should be implemented or verified.',
  },
  {
    capability: 'Jaimini System (Chara Karakas, Arudha Padas, Chara Dasha, Argala, Karakamsha)',
    category: 'Jaimini Jyotish',
    freeAstroApiStatus: 'unavailable',
    localDerivedStatus: 'verified_deterministic',
    candidateProviders: ['AstroWay', 'Astrology-API.io'],
    notes: 'Zero Jaimini endpoints in FreeAstroAPI. Currently computed locally in jyotishMath.ts.',
  },
  {
    capability: 'Ashtakavarga Shodhana (Trikona Shodhana, Ekadhipati Shodhana, Shodhya Pinda)',
    category: 'Ashtakavarga',
    freeAstroApiStatus: 'unavailable',
    localDerivedStatus: 'unavailable',
    candidateProviders: ['AstroWay'],
    notes: 'FreeAstroAPI provides BAV, SAV, and Prasthara matrices, but omits Trikona/Ekadhipati reductions and Pinda.',
  },
  {
    capability: 'Advanced Avasthas (Deeptadi, Sayanaadi, Lajjitadi)',
    category: 'Planetary Conditions',
    freeAstroApiStatus: 'unavailable',
    localDerivedStatus: 'partial_only' as unknown as 'approximation_only',
    candidateProviders: ['AstroWay'],
    notes: 'FreeAstroAPI supports Baladi Avastha only (`include_avastha: true`).',
  },
  {
    capability: 'Graha Yuddha (Planetary War exact angular/latitude/brightness winner)',
    category: 'Planetary Conditions',
    freeAstroApiStatus: 'partial_only',
    localDerivedStatus: 'unavailable',
    candidateProviders: ['AstroWay'],
    notes: 'Requires ecliptic latitude (`latitude_deg` from /api/v1/ephemeris/calculate) + classical brightness/disc rule.',
  },
  {
    capability: 'Alternative Dasha Systems (Yogini, Ashtottari, Kalachakra, Narayana)',
    category: 'Timing Systems',
    freeAstroApiStatus: 'unavailable',
    localDerivedStatus: 'unavailable',
    candidateProviders: ['AstroWay', 'Astrology-API.io', 'RoxyAPI'],
    notes: 'FreeAstroAPI supports Vimshottari only.',
  },
  {
    capability: 'Five-level Dasha Hierarchy (Mahadasha -> Antardasha -> Pratyantardasha -> Sookshma -> Prana)',
    category: 'Timing Systems',
    freeAstroApiStatus: 'partial_only',
    localDerivedStatus: 'unavailable',
    candidateProviders: ['AstroWay', 'Astrology-API.io'],
    notes: 'FreeAstroAPI caps `dasha_levels` at 3 (Pratyantardasha). Sookshma & Prana unavailable.',
  },
  {
    capability: 'Hellenistic Lots (Part of Fortune/Spirit/Eros/Necessity) & Traditional Profections/Almuten/Firdaria',
    category: 'Western Traditional / Hellenistic',
    freeAstroApiStatus: 'partial_only',
    localDerivedStatus: 'unavailable',
    candidateProviders: ['Astrology-API.io', 'RoxyAPI'],
    notes: 'FreeAstroAPI provides annual profections, progressions, and primary directions, but not full Hermetic Lots or Firdaria.',
  },
];

function unavailableEnvelope<T>(
  source: string,
  calculationMethod: string,
  conventions: Record<string, unknown>,
  inputFingerprint: string,
  limitations: string[],
  opts?: {
    dependencies?: string[];
    acquiredAtUtc?: string | null;
    temporalScope?: TemporalScope;
    referenceDateIso?: string | null;
  }
): DatasetEnvelope<T> {
  return {
    source,
    calculationMethod,
    version: V2_MASTER_SCHEMA_VERSION,
    conventions,
    dependencies: opts?.dependencies ?? ['canonical_birth_instant'],
    acquiredAtUtc: opts?.acquiredAtUtc ?? null,
    temporalScope: opts?.temporalScope ?? 'natal_invariant',
    referenceDateIso: opts?.referenceDateIso ?? null,
    inputFingerprint,
    completeness: 'unavailable',
    verificationStatus: 'unavailable',
    canonicalStatus: 'unavailable',
    limitations,
    data: null,
  };
}

function inferReferenceDateIso(
  rawLayerA?: LayerARawProviderRecord | null,
  explicitReferenceDateIso?: string | null
): string | null {
  if (explicitReferenceDateIso && /^\d{4}-\d{2}-\d{2}/.test(explicitReferenceDateIso.trim())) {
    return explicitReferenceDateIso.trim().slice(0, 10);
  }
  const calls = Object.values(rawLayerA?.calls || {});
  for (const call of calls) {
    const req = call?.sanitizedRequest;
    if (!req || typeof req !== 'object') continue;
    const candidate = req.targetDate ?? req.reference_date ?? req.referenceDate;
    if (typeof candidate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(candidate.trim())) {
      return candidate.trim().slice(0, 10);
    }
  }
  return null;
}

function firstAcquiredTimestamp(
  calls: Array<SanitizedProviderCallRecord | undefined>
): string | null {
  for (const call of calls) {
    if (call?.ok && typeof call.timestampUtc === 'string' && call.timestampUtc) {
      return call.timestampUtc;
    }
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

const BPHS_SHADBALA_MIN_RUPAS: Record<string, number> = {
  Sun: 6.5,
  Moon: 6.0,
  Mars: 5.0,
  Mercury: 7.0,
  Jupiter: 6.5,
  Venus: 5.5,
  Saturn: 5.0,
};

const VIMSHOTTARI_FULL_YEARS: Record<string, number> = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};

export const LAHIRI_AYANAMSA_DEG_TOLERANCE = 0.04;

export interface ResolvedAyanamshaDescriptor {
  id: string;
  name: string;
  valueDegrees: number | null;
  matchesCanonicalLahiri: boolean;
  reason: string;
}

export function resolveAyanamshaDescriptor(params: {
  rawValue?: unknown;
  rawValueDegrees?: unknown;
  requestedAyanamsa?: unknown;
  expectedLahiriDeg: number;
}): ResolvedAyanamshaDescriptor {
  const { rawValue, rawValueDegrees, requestedAyanamsa, expectedLahiriDeg } = params;

  let labelCandidate = '';
  let numericCandidate: number | null = null;

  const inspectValue = (val: unknown) => {
    if (val === null || val === undefined) return;
    if (typeof val === 'number') {
      if (Number.isFinite(val)) numericCandidate = val;
      return;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return;
      const asNum = Number(trimmed);
      if (Number.isFinite(asNum)) {
        if (numericCandidate === null) numericCandidate = asNum;
      } else if (!labelCandidate) {
        labelCandidate = trimmed;
      }
      return;
    }
    if (typeof val === 'object' && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      const nestedDeg = obj.valueDegrees ?? obj.value_degrees ?? obj.degrees ?? obj.degree ?? obj.value;
      if (nestedDeg !== undefined) inspectValue(nestedDeg);
      const nestedId = obj.id ?? obj.name ?? obj.label ?? obj.type;
      if (nestedId !== undefined) inspectValue(nestedId);
    }
  };

  inspectValue(rawValue);
  if (rawValueDegrees !== undefined && rawValueDegrees !== null && rawValueDegrees !== '') {
    const parsed = Number(rawValueDegrees);
    if (Number.isFinite(parsed)) {
      numericCandidate = parsed;
    }
  }

  const reqStr =
    typeof requestedAyanamsa === 'string' && requestedAyanamsa.trim()
      ? requestedAyanamsa.trim().toLowerCase()
      : '';
  const lowLabel = labelCandidate.toLowerCase();

  const labelLooksLahiri =
    lowLabel.includes('lahiri') || lowLabel.includes('chitrapaksha');
  const labelExplicitNonLahiri =
    Boolean(lowLabel) && !labelLooksLahiri;
  const requestedExplicitNonLahiri =
    Boolean(reqStr) && !reqStr.includes('lahiri') && !reqStr.includes('chitrapaksha');

  if (numericCandidate !== null) {
    const delta = Math.abs(numericCandidate - expectedLahiriDeg);
    const numericMatchesLahiri = delta <= LAHIRI_AYANAMSA_DEG_TOLERANCE;
    if (numericMatchesLahiri && !labelExplicitNonLahiri && !requestedExplicitNonLahiri) {
      return {
        id: 'lahiri',
        name: 'Lahiri (Chitrapaksha)',
        valueDegrees: numericCandidate,
        matchesCanonicalLahiri: true,
        reason: `Numeric ayanamsha ${numericCandidate.toFixed(6)}° matches canonical Lahiri (${expectedLahiriDeg.toFixed(4)}°, Δ=${delta.toFixed(5)}°).`,
      };
    }
    const nonLahiriId = labelCandidate
      ? labelCandidate.toLowerCase().replace(/\s+/g, '_')
      : 'non_lahiri_numeric';
    return {
      id: nonLahiriId,
      name: labelCandidate || `Non-Lahiri (${numericCandidate.toFixed(6)}°)`,
      valueDegrees: numericCandidate,
      matchesCanonicalLahiri: false,
      reason: `Numeric ayanamsha ${numericCandidate.toFixed(6)}° diverges from canonical Lahiri (${expectedLahiriDeg.toFixed(4)}°, Δ=${delta.toFixed(5)}°) or explicit non-Lahiri label (${labelCandidate || reqStr}).`,
    };
  }

  if (labelLooksLahiri && !requestedExplicitNonLahiri) {
    return {
      id: 'lahiri',
      name: labelCandidate || 'Lahiri (Chitrapaksha)',
      valueDegrees: null,
      matchesCanonicalLahiri: true,
      reason: `Explicit Lahiri label "${labelCandidate}" without conflicting numeric degrees.`,
    };
  }

  if (labelCandidate) {
    return {
      id: labelCandidate.toLowerCase().replace(/\s+/g, '_'),
      name: labelCandidate,
      valueDegrees: null,
      matchesCanonicalLahiri: false,
      reason: `Non-Lahiri ayanamsha label "${labelCandidate}".`,
    };
  }

  if (reqStr.includes('lahiri') || reqStr.includes('chitrapaksha')) {
    return {
      id: 'lahiri',
      name: 'Lahiri (Chitrapaksha)',
      valueDegrees: null,
      matchesCanonicalLahiri: true,
      reason: 'Resolved from explicit Lahiri request parameter (provider omitted ayanamsha field).',
    };
  }

  return {
    id: 'unspecified',
    name: 'Unspecified',
    valueDegrees: null,
    matchesCanonicalLahiri: false,
    reason: 'No ayanamsha identifier or numerical value supplied.',
  };
}

export function normalizeAstroWayPlanetName(rawName: unknown): string {
  const raw = String(rawName ?? '').trim();
  if (!raw) return '';
  const low = raw.toLowerCase().replace(/[_-]+/g, ' ');
  if (low === 'sun' || low === 'surya') return 'Sun';
  if (low === 'moon' || low === 'chandra') return 'Moon';
  if (low === 'mars' || low === 'mangala' || low === 'kuja') return 'Mars';
  if (low === 'mercury' || low === 'budha') return 'Mercury';
  if (low === 'jupiter' || low === 'guru' || low === 'brihaspati') return 'Jupiter';
  if (low === 'venus' || low === 'shukra') return 'Venus';
  if (low === 'saturn' || low === 'shani') return 'Saturn';
  if (
    low === 'rahu' ||
    low === 'mean node' ||
    low === 'true node' ||
    low === 'north node' ||
    low === 'mean north node' ||
    low === 'true north node'
  ) {
    return 'Rahu';
  }
  if (
    low === 'ketu' ||
    low === 'south node' ||
    low === 'mean south node' ||
    low === 'true south node'
  ) {
    return 'Ketu';
  }
  if (low === 'uranus') return 'Uranus';
  if (low === 'neptune') return 'Neptune';
  if (low === 'pluto') return 'Pluto';
  if (low === 'ascendant' || low === 'asc' || low === 'lagna') return 'Ascendant';
  if (low === 'mc' || low === 'midheaven') return 'MC';
  return raw;
}

function unwrapAstroWayCall(call: SanitizedProviderCallRecord | undefined): Record<string, unknown> | null {
  if (!call?.ok) return null;
  const root = asObj(call.rawResponse);
  if (!root) return null;
  const data = asObj(root.data);
  if (data) return data;
  if (Array.isArray(root.data)) return { items: root.data };
  return root;
}

function resolveSignNameFromAstroWayEntry(entry: Record<string, unknown> | null): string {
  if (!entry) return '';
  if (typeof entry.signName === 'string' && entry.signName.trim()) {
    return entry.signName.trim();
  }
  if (typeof entry.sign === 'string' && entry.sign.trim() && Number.isNaN(Number(entry.sign))) {
    return entry.sign.trim();
  }
  const lon = Number(entry.longitude ?? entry.abs_pos ?? entry.degree ?? NaN);
  if (Number.isFinite(lon)) {
    return SIGNS[Math.floor(normalizeDeg(lon) / 30) % 12] || '';
  }
  if (typeof entry.sign === 'number' && Number.isInteger(entry.sign)) {
    if (entry.sign >= 1 && entry.sign <= 12) return SIGNS[entry.sign - 1] || '';
    if (entry.sign >= 0 && entry.sign < 12) return SIGNS[entry.sign] || '';
  }
  return '';
}

function findArrayInAstroWayData(
  data: Record<string, unknown> | null,
  preferredKeys: string[]
): Array<Record<string, unknown>> {
  if (!data) return [];
  for (const k of preferredKeys) {
    if (Array.isArray(data[k])) {
      return asObjArr(data[k]);
    }
  }
  for (const val of Object.values(data)) {
    if (Array.isArray(val) && val.some((x) => x && typeof x === 'object')) {
      return asObjArr(val);
    }
  }
  return [];
}

function findHouseFrom12Cusps(cuspsDeg: number[], lonDeg: number): number | undefined {
  if (cuspsDeg.length !== 12 || !cuspsDeg.every((c) => Number.isFinite(c))) return undefined;
  const lon = normalizeDeg(lonDeg);
  for (let i = 0; i < 12; i++) {
    const start = normalizeDeg(cuspsDeg[i]);
    const end = normalizeDeg(cuspsDeg[(i + 1) % 12]);
    const inside = start < end ? lon >= start && lon < end : lon >= start || lon < end;
    if (inside) return i + 1;
  }
  return undefined;
}

export function normalizeAstroWayYogas(params: {
  yogasParashara: Record<string, unknown> | null;
  yogasJaimini: Record<string, unknown> | null;
  jaiminiYogas: Record<string, unknown> | null;
  kundli: Record<string, unknown> | null;
}): {
  summary: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
} | null {
  const { yogasParashara, yogasJaimini, jaiminiYogas, kundli } = params;
  const kundliYogas = asObj(kundli?.yogas);
  if (!yogasParashara && !yogasJaimini && !jaiminiYogas && !kundliYogas) {
    return null;
  }

  const evaluatedItems: Array<Record<string, unknown>> = [];
  const activeSources: string[] = [];

  if (yogasParashara) {
    activeSources.push('/vedic/yogas/parashara/full');
    const parasharaNamedDetectors: Array<[string, string]> = [
      ['raja', 'Raja Yoga'],
      ['dhana', 'Dhana Yoga'],
      ['dharmaKarmadhipati', 'Dharma-Karmadhipati Yoga'],
      ['gajakesari', 'Gajakesari Yoga'],
      ['adhi', 'Adhi Yoga'],
    ];
    for (const [key, displayName] of parasharaNamedDetectors) {
      const det = asObj(yogasParashara[key]);
      if (!det) continue;
      evaluatedItems.push({
        id: `parashara_${key}`,
        name: displayName,
        school: 'parashara',
        category: key,
        endpoint: '/vedic/yogas/parashara/full',
        present: Boolean(det.present),
        contributingPlanets: Array.isArray(det.contributingPlanets)
          ? det.contributingPlanets
          : [],
        details: Array.isArray(det.details) ? det.details : [],
        ...(det.strength !== undefined ? { strength: det.strength } : {}),
      });
    }

    const panchaObj = asObj(yogasParashara.panchaMahapurusha);
    const panchaArr = asObjArr(panchaObj?.yogas);
    for (const py of panchaArr) {
      const yName = String(py.yogaName ?? py.name ?? 'Pancha Mahapurusha Yoga').trim();
      const slug = yName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      evaluatedItems.push({
        id: `parashara_pancha_${slug || 'yoga'}`,
        name: yName,
        school: 'parashara',
        category: 'panchaMahapurusha',
        endpoint: '/vedic/yogas/parashara/full',
        present: Boolean(py.present),
        planetName: normalizeAstroWayPlanetName(py.planetName ?? py.graha),
        ...(py.graha !== undefined ? { graha: py.graha } : {}),
        ...(py.sign !== undefined ? { sign: py.sign } : {}),
        ...(py.house !== undefined ? { house: py.house } : {}),
        ...(py.reason !== undefined ? { reason: py.reason } : {}),
      });
    }

    // Fallback if any mock/variant passes a top-level array under yogas/items
    for (const row of findArrayInAstroWayData(yogasParashara, ['yogas', 'items'])) {
      const yName = String(row.yogaName ?? row.name ?? '').trim();
      if (!yName) continue;
      evaluatedItems.push({
        id: `parashara_arr_${yName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        name: yName,
        school: 'parashara',
        category: 'other',
        endpoint: '/vedic/yogas/parashara/full',
        present: row.present === undefined ? true : Boolean(row.present),
        ...row,
      });
    }
  }

  if (yogasJaimini) {
    activeSources.push('/vedic/yogas/jaimini/full');
    const jaiminiFullDetectors: Array<[string, string]> = [
      ['raja', 'Jaimini Raja Yoga'],
      ['dhana', 'Jaimini Dhana Yoga'],
      ['daridra', 'Jaimini Daridra Yoga'],
      ['viparita', 'Jaimini Viparita Raja Yoga'],
    ];
    for (const [key, displayName] of jaiminiFullDetectors) {
      const det = asObj(yogasJaimini[key]);
      if (!det) continue;
      evaluatedItems.push({
        id: `jaimini_full_${key}`,
        name: displayName,
        school: 'jaimini',
        category: key,
        endpoint: '/vedic/yogas/jaimini/full',
        present: Boolean(det.present),
        ...det,
      });
    }
  }

  if (jaiminiYogas) {
    activeSources.push('/vedic/jaimini/yogas');
    for (const jy of asObjArr(jaiminiYogas.yogas)) {
      const yName = String(jy.name ?? jy.yogaName ?? '').trim();
      if (!yName) continue;
      const slug = yName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      evaluatedItems.push({
        id: `jaimini_basic_${slug || 'yoga'}`,
        name: yName,
        school: 'jaimini',
        category: 'jaimini_karaka',
        endpoint: '/vedic/jaimini/yogas',
        present: Boolean(jy.present),
        ...(jy.description !== undefined ? { description: jy.description } : {}),
      });
    }
  }

  if (kundliYogas) {
    activeSources.push('/vedic/kundli#yogas');
    // Only synthesize items from /vedic/kundli when /vedic/yogas/parashara/full was not acquired
    if (!yogasParashara) {
      const kundliPresentArr = Array.isArray(kundliYogas.present) ? kundliYogas.present : [];
      for (const entry of kundliPresentArr) {
        if (typeof entry === 'string' && entry.trim()) {
          evaluatedItems.push({
            id: `kundli_${entry.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
            name: entry.trim(),
            school: 'parashara',
            category: 'kundli_summary',
            endpoint: '/vedic/kundli',
            present: true,
          });
        } else if (entry && typeof entry === 'object') {
          const rec = entry as Record<string, unknown>;
          evaluatedItems.push({
            id: `kundli_${String(rec.name ?? 'yoga').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
            name: String(rec.name ?? rec.yogaName ?? 'Yoga'),
            school: 'parashara',
            category: 'kundli_summary',
            endpoint: '/vedic/kundli',
            present: rec.present === undefined ? true : Boolean(rec.present),
            ...rec,
          });
        }
      }
      const kDhana = asObj(kundliYogas.dhana);
      if (kDhana && !evaluatedItems.some((e) => e.category === 'dhana')) {
        evaluatedItems.push({
          id: 'kundli_dhana',
          name: 'Dhana Yoga',
          school: 'parashara',
          category: 'dhana',
          endpoint: '/vedic/kundli',
          present: Boolean(kDhana.present),
          contributingPlanets: Array.isArray(kDhana.contributingPlanets)
            ? kDhana.contributingPlanets
            : [],
        });
      }
    }
  }

  const activeItems = evaluatedItems.filter((item) => item.present === true);
  const parasharaEvaluated = evaluatedItems.filter((item) => item.school === 'parashara');
  const jaiminiEvaluated = evaluatedItems.filter((item) => item.school === 'jaimini');

  return {
    summary: {
      parashara: yogasParashara,
      jaiminiFull: yogasJaimini,
      jaiminiBasic: jaiminiYogas,
      kundliYogas,
      counts: {
        totalEvaluatedDetectors: evaluatedItems.length,
        totalActiveYogas: activeItems.length,
        parasharaEvaluated: parasharaEvaluated.length,
        parasharaActive: parasharaEvaluated.filter((i) => i.present === true).length,
        jaiminiEvaluated: jaiminiEvaluated.length,
        jaiminiActive: jaiminiEvaluated.filter((i) => i.present === true).length,
      },
      evaluatedItems,
    },
    items: activeItems,
    metadata: {
      source: activeSources[0] || '/vedic/yogas/parashara/full',
      sources: activeSources,
    },
  };
}

function normalizeAstroWayLayerBMasterChartRecord(params: {
  instant: CanonicalBirthInstant;
  rawLayerA: LayerARawProviderRecord;
  cachedVerifiedRecord?: LayerBMasterChartRecord | null;
  referenceDateIso?: string | null;
  preferLocalAshtakavarga?: boolean;
  includeLocalModules?: boolean;
}): LayerBMasterChartRecord {
  const {
    instant,
    rawLayerA,
    referenceDateIso,
    preferLocalAshtakavarga,
    includeLocalModules = true,
  } = params;
  const fp = instant.inputFingerprint;
  const indepRef = computeIndependentAstronomicalReference(instant);
  const calls = rawLayerA.calls || {};
  const effectiveRefDateIso = inferReferenceDateIso(rawLayerA, referenceDateIso);

  const chartSidereal = unwrapAstroWayCall(calls.chart_sidereal);
  const chartTropical = unwrapAstroWayCall(calls.chart_tropical);
  const kundli = unwrapAstroWayCall(calls.vedic_kundli);
  const panchang = unwrapAstroWayCall(calls.vedic_panchang_full);
  const avPrastara = unwrapAstroWayCall(calls.ashtakavarga_prastara);
  const avBasic = unwrapAstroWayCall(calls.ashtakavarga_basic);
  const yogasParashara = unwrapAstroWayCall(calls.yogas_parashara_full);
  const yogasJaimini = unwrapAstroWayCall(calls.yogas_jaimini_full);
  const jaiminiYogas = unwrapAstroWayCall(calls.jaimini_yogas);
  const vimshottariPrana = unwrapAstroWayCall(calls.dashas_vimshottari_prana);

  // =========================================================================
  // FRAME 1: VEDIC LAHIRI (AstroWay /vedic/kundli + /chart + 16 Vargas + AV + Dasha)
  // =========================================================================
  const sidHousesObj = asObj(chartSidereal?.houses);
  const kundliLagna = asObj(kundli?.lagna);
  const ascDegRaw = Number(
    kundliLagna?.longitude ?? sidHousesObj?.ascendant ?? Number.NaN
  );
  const ascDeg = Number.isFinite(ascDegRaw) ? normalizeDeg(ascDegRaw) : null;
  const ascSignIdx = ascDeg !== null ? Math.floor(ascDeg / 30) % 12 : null;

  const siderealPlanetsArr = asObjArr(chartSidereal?.planets);
  const kundliGrahasArr = asObjArr(kundli?.grahas);
  const chartSiderealNodeLabels = siderealPlanetsArr
    .map((p) => String(p.name || p.id || '').trim())
    .filter((n) => /node|rahu|ketu/i.test(n));
  const kundliNodeLabels = kundliGrahasArr
    .map((p) => String(p.name || '').trim())
    .filter((n) => /node|rahu|ketu/i.test(n));

  const siderealByCanon = new Map<string, Record<string, unknown>>();
  for (const p of siderealPlanetsArr) {
    const canon = normalizeAstroWayPlanetName(p.name || p.id);
    if (canon) siderealByCanon.set(canon, p);
  }
  const kundliByCanon = new Map<string, Record<string, unknown>>();
  for (const g of kundliGrahasArr) {
    const canon = normalizeAstroWayPlanetName(g.name);
    if (canon) kundliByCanon.set(canon, g);
  }

  const orderedCanonNames: string[] = [];
  for (const k of [...kundliByCanon.keys(), ...siderealByCanon.keys()]) {
    if (!orderedCanonNames.includes(k)) orderedCanonNames.push(k);
  }

  const vedicPlanets: Array<Record<string, unknown>> = [];
  for (const name of orderedCanonNames) {
    const k = kundliByCanon.get(name);
    const s = siderealByCanon.get(name);
    const lonRaw = Number(k?.longitude ?? s?.longitude ?? Number.NaN);
    if (!Number.isFinite(lonRaw)) continue;
    const lon = normalizeDeg(lonRaw);
    const signIdx = Math.floor(lon / 30) % 12;
    const degInSign = Number((lon % 30).toFixed(6));
    const house = ascSignIdx !== null ? ((signIdx - ascSignIdx + 12) % 12) + 1 : undefined;
    const dignityRaw = k?.dignity ?? s?.dignity;
    const avasthaRaw = k?.avastha ?? s?.avastha;
    const combustRaw = k?.isCombust ?? k?.combust ?? s?.isCombust ?? s?.combust;
    const nakRaw = k?.nakshatraName ?? k?.nakshatra ?? s?.nakshatra;
    const nakLordRaw = k?.nakshatraLord ?? k?.starLord;
    const padaRaw = Number(k?.pada ?? Number.NaN);
    vedicPlanets.push({
      name,
      raw_name: k?.name ?? s?.name ?? name,
      absolute_degree: lon,
      degree: lon,
      sign: resolveSignNameFromAstroWayEntry(k || s) || SIGNS[signIdx],
      degree_in_sign: degInSign,
      ...(house !== undefined ? { house } : {}),
      is_retrograde: Boolean(k?.isRetrograde ?? s?.isRetrograde),
      ...(typeof dignityRaw === 'string' && dignityRaw.trim() ? { dignity: dignityRaw.trim() } : {}),
      ...(typeof avasthaRaw === 'string' && avasthaRaw.trim() ? { avastha: avasthaRaw.trim() } : {}),
      ...(typeof combustRaw === 'boolean' ? { is_combust: combustRaw } : {}),
      ...(typeof nakRaw === 'string' && nakRaw.trim()
        ? { nakshatra: nakRaw.trim() }
        : asObj(nakRaw)?.name
        ? { nakshatra: String(asObj(nakRaw)!.name) }
        : {}),
      ...(typeof nakLordRaw === 'string' && nakLordRaw.trim()
        ? { nakshatra_lord: normalizeAstroWayPlanetName(nakLordRaw) }
        : {}),
      ...(Number.isInteger(padaRaw) && padaRaw >= 1 && padaRaw <= 4 ? { pada: padaRaw } : {}),
      ...(typeof s?.latitude === 'number' ? { latitude_deg: s.latitude } : {}),
      ...(typeof s?.distance === 'number' ? { distance_au: s.distance } : {}),
      ...(typeof s?.speedLong === 'number' ? { speed_deg_per_day: s.speedLong } : {}),
      ...(typeof s?.speedLat === 'number' ? { speed_lat_deg_per_day: s.speedLat } : {}),
      ...(typeof s?.speedDist === 'number' ? { speed_dist_au_per_day: s.speedDist } : {}),
      ...(typeof s?.declination === 'number' ? { declination: s.declination } : {}),
      ...(typeof s?.rightAscension === 'number' ? { right_ascension: s.rightAscension } : {}),
    });
  }

  const vedicRequestedAy =
    calls.vedic_kundli?.sanitizedRequest?.ayanamsa ??
    calls.chart_sidereal?.sanitizedRequest?.ayanamsa ??
    'lahiri';
  const vedicAyDescriptor = resolveAyanamshaDescriptor({
    rawValue: kundli?.ayanamsa ?? chartSidereal?.ayanamsa ?? vedicRequestedAy,
    rawValueDegrees:
      kundli?.ayanamsaDegrees ??
      kundli?.ayanamsaValue ??
      chartSidereal?.ayanamsaDegrees ??
      chartSidereal?.ayanamsaValue,
    requestedAyanamsa: vedicRequestedAy,
    expectedLahiriDeg: instant.astronomy.lahiriAyanamsaApproxDeg,
  });

  // Build Shodashavarga charts from /vedic/varga/D* (and mirror canonical D1 if varga_D1 call was pruned)
  const vargaChartsByDivision: Record<string, Record<string, unknown>> = {};
  for (const [callId, callRec] of Object.entries(calls)) {
    if (!callId.startsWith('varga_')) continue;
    const divKey = callId.replace(/^varga_/, '');
    const vData = unwrapAstroWayCall(callRec);
    if (!vData) continue;
    const vLagna = asObj(vData.lagna);
    const vLagnaSign = resolveSignNameFromAstroWayEntry(vLagna);
    const vAyDesc = resolveAyanamshaDescriptor({
      rawValue: vData.ayanamsa ?? callRec?.sanitizedRequest?.ayanamsa,
      rawValueDegrees: vData.ayanamsaDegrees ?? vData.ayanamsaValue,
      requestedAyanamsa: callRec?.sanitizedRequest?.ayanamsa ?? 'lahiri',
      expectedLahiriDeg: instant.astronomy.lahiriAyanamsaApproxDeg,
    });
    const rawVargaBodies =
      asObjArr(vData.grahas).length > 0 ? asObjArr(vData.grahas) : asObjArr(vData.planets);
    const vPlanets = rawVargaBodies.map((vp) => ({
      name: normalizeAstroWayPlanetName(vp.name || vp.id),
      raw_name: vp.name ?? vp.id,
      sign: resolveSignNameFromAstroWayEntry(vp),
      longitude: vp.longitude,
      degree_in_sign: vp.degreeInSign,
      is_retrograde: Boolean(vp.isRetrograde),
    }));
    vargaChartsByDivision[divKey] = {
      varga: vData.varga ?? divKey,
      ayanamsa: vAyDesc.id !== 'unspecified' ? vAyDesc.id : null,
      ayanamsaValueDegrees: vAyDesc.valueDegrees,
      calibrated: true,
      ascendant: vLagna
        ? {
            ...vLagna,
            sign: vLagnaSign,
          }
        : null,
      planets: vPlanets,
    };
  }
  if (!vargaChartsByDivision.D1 && ascDeg !== null && ascSignIdx !== null && vedicPlanets.length > 0) {
    vargaChartsByDivision.D1 = {
      varga: 'D1',
      source: 'canonical_d1_mirror',
      ayanamsa: vedicAyDescriptor.id,
      ayanamsaValueDegrees: vedicAyDescriptor.valueDegrees,
      calibrated: true,
      ascendant: {
        ...(kundliLagna || {}),
        degree: ascDeg,
        longitude: ascDeg,
        sign: resolveSignNameFromAstroWayEntry(kundliLagna) || SIGNS[ascSignIdx],
      },
      planets: vedicPlanets.map((vp) => ({
        name: vp.name,
        raw_name: vp.raw_name,
        sign: vp.sign,
        longitude: vp.absolute_degree,
        degree_in_sign: vp.degree_in_sign,
        is_retrograde: vp.is_retrograde,
      })),
    };
  }
  const vargaKeys = Object.keys(vargaChartsByDivision);

  // Normalize Ashtakavarga (Prastara + BAV + SAV)
  let vedicAshtakavarga: VedicLahiriFrame['ashtakavarga'] = null;
  if (avPrastara && Array.isArray(avPrastara.planets)) {
    const bhinnashtakavarga: Record<string, number[]> = {};
    const prastharashtakavarga: Record<string, Record<string, number[]>> = {};
    for (const pEntry of asObjArr(avPrastara.planets)) {
      const pName = normalizeAstroWayPlanetName(pEntry.planetName || pEntry.planet);
      if (!pName) continue;
      if (Array.isArray(pEntry.bindus)) {
        bhinnashtakavarga[pName] = pEntry.bindus.map((n) => Number(n ?? 0));
      }
      if (Array.isArray(pEntry.contributors)) {
        const matrix: Record<string, number[]> = {};
        for (const c of asObjArr(pEntry.contributors)) {
          const src = normalizeAstroWayPlanetName(c.source) || String(c.source || '');
          if (src && Array.isArray(c.signs)) {
            matrix[src] = c.signs.map((n) => Number(n ?? 0));
          }
        }
        prastharashtakavarga[pName] = matrix;
      }
    }
    const sav = Array.isArray(avPrastara.sarva)
      ? avPrastara.sarva.map((n) => Number(n ?? 0))
      : [];
    vedicAshtakavarga = {
      sarvashtakavarga: sav,
      bhinnashtakavarga,
      prastharashtakavarga,
      totalPoints: Number(
        avPrastara.sarvaTotal ?? sav.reduce((a, b) => a + b, 0)
      ),
    };
  } else if (avBasic && Array.isArray(avBasic.sarva)) {
    const sav = avBasic.sarva.map((n) => Number(n ?? 0));
    const bav: Record<string, number[]> = {};
    for (const pEntry of asObjArr(avBasic.planets)) {
      const pName = normalizeAstroWayPlanetName(pEntry.planetName || pEntry.planet);
      if (pName && Array.isArray(pEntry.bindus)) {
        bav[pName] = pEntry.bindus.map((n) => Number(n ?? 0));
      }
    }
    vedicAshtakavarga = {
      sarvashtakavarga: sav,
      bhinnashtakavarga: bav,
      prastharashtakavarga: {},
      totalPoints: Number(avBasic.sarvaTotal ?? sav.reduce((a, b) => a + b, 0)),
    };
  }

  // Normalize Parashara + Jaimini + Kundli Yogas (handling nested detectors cleanly)
  const normalizedYogas = normalizeAstroWayYogas({
    yogasParashara,
    yogasJaimini,
    jaiminiYogas,
    kundli,
  });

  // Normalize Vimshottari 5-Level Dasha Hierarchy (separating natal timeline from reference-date snapshot)
  const normalizedVimshottari = normalizeAstroWayVimshottari5Level(
    vimshottariPrana,
    normalizeAstroWayPlanetName,
    {
      birthDateIso: instant.input.birthDate,
      referenceDateIso: effectiveRefDateIso,
    }
  );
  const normalizedPanchang = normalizeAstroWayPanchang(panchang);

  const vedicCusps = Array.isArray(sidHousesObj?.cusps)
    ? (sidHousesObj!.cusps as number[]).map((c, idx) => ({
        house: idx + 1,
        degree: normalizeDeg(Number(c)),
        sign: SIGNS[Math.floor(normalizeDeg(Number(c)) / 30) % 12],
      }))
    : [];

  let vedicLahiri: DatasetEnvelope<VedicLahiriFrame>;
  if (chartSidereal || kundli) {
    const vedicFrameData: VedicLahiriFrame = {
      ayanamshaLabel: vedicAyDescriptor.id,
      ayanamshaValueDegrees: vedicAyDescriptor.valueDegrees,
      ayanamsha: {
        id: vedicAyDescriptor.id,
        name: vedicAyDescriptor.name,
        valueDegrees: vedicAyDescriptor.valueDegrees,
      },
      houseSystem: String(sidHousesObj?.system ?? 'W'),
      nodeType: chartSiderealNodeLabels.length
        ? `provider_default (${chartSiderealNodeLabels.join(', ')}; ChartInput omits nodeType)`
        : 'provider_default (ChartInput omits nodeType)',
      timezoneUsed: instant.timezone.ianaTimezone || `offset_${instant.timezone.historicalUtcOffsetHours}`,
      ascendant:
        ascDeg !== null
          ? {
              ...(kundliLagna || {}),
              degree: ascDeg,
              absolute_degree: ascDeg,
              sign: resolveSignNameFromAstroWayEntry(kundliLagna) || SIGNS[ascSignIdx!],
            }
          : null,
      planets: vedicPlanets,
      houses: vedicCusps,
      sadeSati: null,
      vargas:
        vargaKeys.length > 0
          ? {
              supportedCount: vargaKeys.length,
              divisionsReturned: vargaKeys,
              chartsByDivision: vargaChartsByDivision,
            }
          : null,
      ashtakavarga: vedicAshtakavarga,
      yogas: normalizedYogas,
      panchang: normalizedPanchang,
      vimshottariDasha: normalizedVimshottari,
      providerMetadata: asObj(chartSidereal?.meta) || null,
    };

    const vedicLimitations: string[] = [
      'AstroWay ChartInput v2.383.19 does not expose an explicit nodeType (Mean vs True Node) toggle.',
    ];
    if (vargaKeys.length < 16) {
      vedicLimitations.push(
        `Returned ${vargaKeys.length}/16 expected BPHS Shodashavarga divisions (D5 Panchamsha is not supported by AstroWay v2.383.19).`
      );
    }

    const vedicCompleteness =
      vedicPlanets.length >= 9 &&
      vargaKeys.length >= 16 &&
      vedicAshtakavarga &&
      normalizedVimshottari
        ? 'complete'
        : 'partial';
    const vedicAcquiredAt = firstAcquiredTimestamp([
      calls.chart_sidereal,
      calls.vedic_kundli,
      calls.dashas_vimshottari_prana,
    ]);
    const hasValidD1 = ascDeg !== null && vedicPlanets.length >= 9;

    vedicLahiri = {
      source: 'astroway:/chart + /vedic/kundli + /vedic/varga/D* + /vedic/ashtakavarga/prastara',
      calculationMethod: 'AstroWay V1 Lahiri Whole-Sign Sidereal',
      version: V2_MASTER_SCHEMA_VERSION,
      conventions: {
        ayanamsha: 'lahiri',
        houseSystem: 'whole_sign',
        nodeConvention: vedicFrameData.nodeType,
        observationPoint: 'geocentric',
      },
      dependencies: ['canonical_birth_instant'],
      acquiredAtUtc: vedicAcquiredAt,
      temporalScope: 'natal_invariant',
      referenceDateIso: null,
      inputFingerprint: fp,
      completeness: vedicCompleteness,
      verificationStatus: 'verified_provider',
      canonicalStatus: hasValidD1
        ? vedicCompleteness === 'complete'
          ? 'available'
          : 'provisional'
        : 'unavailable',
      limitations: vedicLimitations,
      data: vedicFrameData,
    };
  } else {
    vedicLahiri = unavailableEnvelope<VedicLahiriFrame>(
      'astroway:/chart + /vedic/kundli',
      'none',
      { ayanamsha: 'lahiri', houseSystem: 'whole_sign' },
      fp,
      [
        calls.chart_sidereal
          ? `Provider returned HTTP ${calls.chart_sidereal.httpStatus}: ${calls.chart_sidereal.errorMessage || 'error'}`
          : 'AstroWay Vedic Lahiri endpoints failed or were not executed.',
      ]
    );
  }

  // =========================================================================
  // FRAME 2: KP PLACIDUS (/vedic/kp/cusps + sub-lords + significators + cuspal position)
  // =========================================================================
  const kpCuspsRaw = unwrapAstroWayCall(calls.kp_cusps);
  const kpSubLordsRaw = unwrapAstroWayCall(calls.kp_sub_lords);
  const kpPosRaw = unwrapAstroWayCall(calls.kp_planet_cuspal_position);
  const kpSigRaw = unwrapAstroWayCall(calls.kp_significators);
  const kpRulingRaw = unwrapAstroWayCall(calls.kp_ruling_planets);

  let kpPlacidus: DatasetEnvelope<KpPlacidusFrame>;
  if (kpSubLordsRaw || kpCuspsRaw) {
    const rawCusps = asObjArr(kpSubLordsRaw?.cusps ?? kpCuspsRaw?.cusps);
    const kpCusps = rawCusps
      .map((c, idx) => {
        const rawDeg = Number(c.longitude ?? c.cusp_degree ?? Number.NaN);
        if (!Number.isFinite(rawDeg)) return null;
        const deg = normalizeDeg(rawDeg);
        return {
          ...c,
          house: Number(c.house ?? idx + 1),
          cusp_degree: deg,
          absolute_degree: deg,
          sign: resolveSignNameFromAstroWayEntry(c) || SIGNS[Math.floor(deg / 30) % 12],
          star_lord: normalizeAstroWayPlanetName(c.starLordName ?? c.starLord),
          sub_lord: normalizeAstroWayPlanetName(c.subName ?? c.subLord),
          sub_sub_lord: normalizeAstroWayPlanetName(c.subSubName ?? c.subSubLord),
          sign_lord: normalizeAstroWayPlanetName(c.signLordName ?? c.signLord),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const kpPosArr = findArrayInAstroWayData(kpPosRaw, ['planets', 'items', 'positions', 'cuspalPositions']);
    const kpHouseByPlanet = new Map<string, number>();
    for (const row of kpPosArr) {
      const pname = normalizeAstroWayPlanetName(row.grahaName ?? row.planetName ?? row.planet ?? row.name);
      const hNum = Number(row.house ?? row.kpHouse ?? row.bhava ?? Number.NaN);
      if (pname && Number.isInteger(hNum) && hNum >= 1 && hNum <= 12) {
        kpHouseByPlanet.set(pname, hNum);
      }
    }

    const kpPlanets = asObjArr(kpSubLordsRaw?.planets ?? kpCuspsRaw?.planets)
      .map((p) => {
        const rawLon = Number(p.longitude ?? Number.NaN);
        if (!Number.isFinite(rawLon)) return null;
        const pName = normalizeAstroWayPlanetName(p.grahaName ?? p.name);
        const lon = normalizeDeg(rawLon);
        const kpHouse = kpHouseByPlanet.get(pName) ?? (typeof p.house === 'number' ? p.house : undefined);
        return {
          ...p,
          name: pName,
          raw_name: p.grahaName ?? p.name,
          absolute_degree: lon,
          degree: lon,
          sign: resolveSignNameFromAstroWayEntry(p) || SIGNS[Math.floor(lon / 30) % 12],
          star_lord: normalizeAstroWayPlanetName(p.starLordName ?? p.starLord),
          sub_lord: normalizeAstroWayPlanetName(p.subName ?? p.subLord),
          sub_sub_lord: normalizeAstroWayPlanetName(p.subSubName ?? p.subSubLord),
          sign_lord: normalizeAstroWayPlanetName(p.signLordName ?? p.signLord),
          ...(kpHouse !== undefined ? { kp_house: kpHouse, house: kpHouse } : {}),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const planetSignificators = asObjArr(
      kpSigRaw?.significators ?? findArrayInAstroWayData(kpSigRaw, ['significators', 'planets', 'items'])
    ).map((s) => {
      const levels = asObj(s.levels) || {};
      return {
        ...s,
        planet: normalizeAstroWayPlanetName(s.grahaName ?? s.planet ?? s.name),
        level_1: levels.l1 ?? s.level_1 ?? [],
        level_2: levels.l2 ?? s.level_2 ?? [],
        level_3: levels.l3 ?? s.level_3 ?? [],
        level_4: levels.l4 ?? s.level_4 ?? [],
      };
    });

    const kpAyVal =
      typeof kpCuspsRaw?.ayanamsa === 'number'
        ? kpCuspsRaw.ayanamsa
        : typeof kpSubLordsRaw?.ayanamsa === 'number'
        ? kpSubLordsRaw.ayanamsa
        : null;
    const kpLagnaObj = asObj(kpSubLordsRaw?.lagna ?? kpCuspsRaw?.lagna);
    const kpAscDeg =
      kpLagnaObj && typeof kpLagnaObj.longitude === 'number'
        ? normalizeDeg(kpLagnaObj.longitude)
        : kpCusps[0]?.cusp_degree ?? null;
    const kpMcDeg = kpCusps[9]?.cusp_degree ?? null;

    const rawHouseSignificators = Array.isArray(kpSigRaw?.houseSignificators)
      ? asObjArr(kpSigRaw?.houseSignificators)
      : [];
    const houseSignificators =
      rawHouseSignificators.length > 0
        ? rawHouseSignificators
        : planetSignificators.length > 0
        ? Array.from({ length: 12 }, (_, idx) => {
            const house = idx + 1;
            const collectLevel = (lk: 'level_1' | 'level_2' | 'level_3' | 'level_4') =>
              planetSignificators
                .filter((ps) => Array.isArray(ps[lk]) && (ps[lk] as unknown[]).map(Number).includes(house))
                .map((ps) => String(ps.planet || ''));
            const l1 = collectLevel('level_1');
            const l2 = collectLevel('level_2');
            const l3 = collectLevel('level_3');
            const l4 = collectLevel('level_4');
            return {
              house,
              level_1: l1,
              level_2: l2,
              level_3: l3,
              level_4: l4,
              significators: Array.from(new Set([...l1, ...l2, ...l3, ...l4])),
              source: 'derived_from_provider_planet_significators',
            };
          })
        : [];

    const kpFrameData: KpPlacidusFrame = {
      ayanamsha: {
        id: 'kp',
        name: 'Krishnamurti (KP)',
        valueDegrees: kpAyVal,
      },
      angles: {
        ascendant: kpAscDeg !== null ? { degree: kpAscDeg } : null,
        mc: kpMcDeg !== null ? { degree: kpMcDeg } : null,
      },
      ascendant: kpAscDeg !== null ? { ...(kpLagnaObj || {}), degree: kpAscDeg } : null,
      planets: kpPlanets,
      cusps: kpCusps,
      cuspalSubLordTable: kpCusps,
      planetSignificators,
      houseSignificators,
      rulingPlanets: kpRulingRaw,
      dasha: null,
      metadata: {
        method: kpCuspsRaw?.method ?? kpSubLordsRaw?.method ?? 'placidus',
        nodeConventionNote: 'ChartInput omits nodeType',
        ascSub: unwrapAstroWayCall(calls.kp_asc_sub),
        fortuna: unwrapAstroWayCall(calls.kp_fortuna),
      },
    };

    const kpCompleteness = kpCusps.length === 12 && kpPlanets.length >= 9 ? 'complete' : 'partial';
    kpPlacidus = {
      source: kpCuspsRaw
        ? 'astroway:/vedic/kp/cusps + /sub-lords + /planet-cuspal-position + /significators'
        : 'astroway:/vedic/kp/sub-lords + /planet-cuspal-position + /significators',
      calculationMethod: 'AstroWay V1 KP Placidus (ayanamsa=kp, houseSystem=P)',
      version: V2_MASTER_SCHEMA_VERSION,
      conventions: {
        ayanamsha: 'kp',
        ayanamshaValueDeg: kpAyVal,
        houseSystem: 'placidus',
      },
      dependencies: ['canonical_birth_instant'],
      acquiredAtUtc: firstAcquiredTimestamp([calls.kp_sub_lords, calls.kp_cusps]),
      temporalScope: 'natal_invariant',
      referenceDateIso: null,
      inputFingerprint: fp,
      completeness: kpCompleteness,
      verificationStatus: 'verified_provider',
      canonicalStatus: kpCompleteness === 'complete' ? 'available' : 'provisional',
      limitations: [],
      data: kpFrameData,
    };
  } else {
    kpPlacidus = unavailableEnvelope<KpPlacidusFrame>(
      'astroway:/vedic/kp/*',
      'none',
      { ayanamsha: 'kp', houseSystem: 'placidus' },
      fp,
      ['AstroWay KP endpoints failed or were not executed.']
    );
  }

  // =========================================================================
  // FRAME 3: BHAVA CHALIT (Not exposed as standalone endpoint in AstroWay v2.383.19)
  // =========================================================================
  const bhavaChalit = unavailableEnvelope<BhavaChalitFrame>(
    'astroway:not_supported_in_v2.383.19',
    'none',
    { ayanamsha: 'lahiri', methodology: 'sripati_midpoint_chalit' },
    fp,
    [
      'AstroWay OpenAPI v2.383.19 exposes /vedic/bhavabala (with house madhyaLon) but does not expose a dedicated Bhava Chalit planet-shift chart endpoint.',
    ]
  );

  // =========================================================================
  // FRAME 4: WESTERN TROPICAL PLACIDUS (/chart zodiacType=tropical, houseSystem=P)
  // =========================================================================
  let westernTropical: DatasetEnvelope<WesternTropicalFrame>;
  if (chartTropical) {
    const tHousesObj = asObj(chartTropical.houses);
    const tCuspsArr = Array.isArray(tHousesObj?.cusps)
      ? (tHousesObj!.cusps as number[]).map((deg, idx) => {
          const norm = normalizeDeg(Number(deg));
          return {
            house: idx + 1,
            abs_pos: norm,
            longitude: norm,
            sign: SIGNS[Math.floor(norm / 30) % 12],
          };
        })
      : [];
    const tAsc = typeof tHousesObj?.ascendant === 'number' ? normalizeDeg(tHousesObj.ascendant) : null;
    const tMc = typeof tHousesObj?.mc === 'number' ? normalizeDeg(tHousesObj.mc) : null;

    const tCuspsDeg12 = tCuspsArr.map((c) => c.abs_pos);
    const tPlanets = asObjArr(chartTropical.planets)
      .map((p) => {
        const rawLon = p.longitude;
        if (
          rawLon === null ||
          rawLon === undefined ||
          rawLon === '' ||
          !Number.isFinite(Number(rawLon))
        ) {
          return null;
        }
        const lon = normalizeDeg(Number(rawLon));
        const providerHouse =
          typeof p.house === 'number' && Number.isInteger(p.house) && p.house >= 1 && p.house <= 12
            ? p.house
            : undefined;
        const derivedHouse =
          providerHouse === undefined ? findHouseFrom12Cusps(tCuspsDeg12, lon) : undefined;
        return {
          ...p,
          name: normalizeAstroWayPlanetName(p.name || p.id),
          raw_name: p.name ?? p.id,
          abs_pos: lon,
          longitude: lon,
          sign: SIGNS[Math.floor(lon / 30) % 12],
          is_retrograde: Boolean(p.isRetrograde),
          ...(providerHouse !== undefined
            ? { house: providerHouse }
            : derivedHouse !== undefined
            ? { house: derivedHouse, house_derived_from_provider_cusps: true }
            : {}),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const tAspects = asObjArr(chartTropical.aspects).map((a) => {
      const typeObj = asObj(a.type);
      return {
        ...a,
        p1_name: normalizeAstroWayPlanetName(
          asObj(a.planet1)?.name ?? a.planet1
        ),
        p2_name: normalizeAstroWayPlanetName(
          asObj(a.planet2)?.name ?? a.planet2
        ),
        aspect: String(typeObj?.name ?? a.type ?? ''),
        aspect_degrees: typeof typeObj?.angle === 'number' ? typeObj.angle : undefined,
        orb: Number(a.orb ?? Number.NaN),
      };
    });

    const tParallelAspects = asObjArr(chartTropical.parallelAspects);
    const tHouseAspects = asObjArr(chartTropical.houseAspects);
    const tAntiscia = asObjArr(chartTropical.antiscia);
    const tAntisciaAspects = asObjArr(chartTropical.antisciaAspects);
    const tEssentialDignities = unwrapAstroWayCall(calls.western_essential_dignities);
    const tTables: Record<string, unknown> = {
      ...(tHouseAspects.length > 0 ? { houseAspects: tHouseAspects } : {}),
      ...(tAntiscia.length > 0 ? { antiscia: tAntiscia } : {}),
      ...(tAntisciaAspects.length > 0 ? { antisciaAspects: tAntisciaAspects } : {}),
      ...(tEssentialDignities ? { essentialDignities: tEssentialDignities } : {}),
    };

    const westData: WesternTropicalFrame = {
      zodiacType: 'tropical',
      houseSystem: String(tHousesObj?.system ?? 'placidus'),
      timeKnown: true,
      secondPrecisionDroppedByV1Endpoint: false,
      subject: asObj(chartTropical.meta),
      resolvedTime: {
        julianDay: chartTropical.julianDay ?? null,
        siderealTime: chartTropical.siderealTime ?? null,
        chartSect: chartTropical.chartSect ?? null,
      },
      angles: {
        ascendant: tAsc !== null ? { abs_pos: tAsc } : null,
        mc: tMc !== null ? { abs_pos: tMc } : null,
        armc: tHousesObj?.armc ?? null,
        vertex: tHousesObj?.vertex ?? null,
      },
      anglesDetails: tHousesObj,
      planets: tPlanets,
      houses: tCuspsArr,
      aspects: tAspects,
      aspectsSummary:
        asObj(chartTropical.aspectsSummary) ||
        (tAspects.length > 0 ? { total: tAspects.length } : null),
      declinationAspects: tParallelAspects,
      declinationAspectsSummary:
        tParallelAspects.length > 0 ? { total: tParallelAspects.length } : null,
      configurations: null,
      stelliums: null,
      dominants: null,
      dominantsProfile: null,
      tables: Object.keys(tTables).length > 0 ? tTables : null,
    };

    const westCompleteness = tPlanets.length >= 10 && tCuspsArr.length === 12 ? 'complete' : 'partial';
    westernTropical = {
      source: 'astroway:/chart (zodiacType=tropical, houseSystem=P)',
      calculationMethod: 'AstroWay V1 Tropical Placidus Natal',
      version: V2_MASTER_SCHEMA_VERSION,
      conventions: {
        zodiac: 'tropical',
        houseSystem: 'placidus',
      },
      dependencies: ['canonical_birth_instant'],
      acquiredAtUtc: firstAcquiredTimestamp([calls.chart_tropical]),
      temporalScope: 'natal_invariant',
      referenceDateIso: null,
      inputFingerprint: fp,
      completeness: westCompleteness,
      verificationStatus: 'verified_provider',
      canonicalStatus: westCompleteness === 'complete' ? 'available' : 'provisional',
      limitations: [],
      data: westData,
    };
  } else {
    westernTropical = unavailableEnvelope<WesternTropicalFrame>(
      'astroway:/chart (tropical)',
      'none',
      { zodiac: 'tropical', houseSystem: 'placidus' },
      fp,
      ['AstroWay Western Tropical /chart request failed or was not executed.']
    );
  }

  // =========================================================================
  // FRAME 5: ASTRONOMICAL TELEMETRY (/chart sidereal bodies + JD/LST/RA/Decl)
  // =========================================================================
  let astronomicalTelemetry: DatasetEnvelope<AstronomicalTelemetryFrame>;
  if (chartSidereal) {
    const bodies: Record<string, Record<string, unknown>> = {};
    for (const p of siderealPlanetsArr) {
      const name = normalizeAstroWayPlanetName(p.name || p.id);
      if (!name) continue;
      bodies[name] = {
        raw_name: p.name ?? p.id,
        longitude: p.longitude,
        latitude_deg: p.latitude,
        distance_au: p.distance,
        speed_deg_per_day: p.speedLong,
        speed_lat_deg_per_day: p.speedLat,
        speed_dist_au_per_day: p.speedDist,
        is_retrograde: Boolean(p.isRetrograde),
        declination: p.declination,
        right_ascension: p.rightAscension,
      };
    }

    const tsCheck = rawLayerA.ephemerisTimestampCheck ?? null;
    const telemetryData: AstronomicalTelemetryFrame = {
      zodiacType: 'sidereal',
      siderealAyanamsa: 'lahiri',
      timestamp: tsCheck?.returnedUtcInstant ?? null,
      localTimestamp: `${instant.input.birthDate}T${instant.input.birthTime}`,
      resolvedTime: {
        julianDay: chartSidereal.julianDay ?? null,
        siderealTime: chartSidereal.siderealTime ?? null,
        chartSect: chartSidereal.chartSect ?? null,
      },
      subjectSettings: asObj(chartSidereal.meta),
      bodies,
      astrology: { vedicAscendantDeg: ascDeg },
      angles: sidHousesObj,
      houses: vedicCusps,
      timestampVerification: tsCheck,
    };

    const telCompleteness = Object.keys(bodies).length > 0 ? 'complete' : 'partial';
    const telVerificationStatus = tsCheck?.exactTimestampMatch ? 'verified_provider' : 'partial';
    astronomicalTelemetry = {
      source: 'astroway:/chart (telemetry fields)',
      calculationMethod: 'AstroWay V1 Astronomical Ephemeris Telemetry',
      version: V2_MASTER_SCHEMA_VERSION,
      conventions: {
        zodiacType: 'sidereal',
        ayanamsha: 'lahiri',
        observationPoint: 'geocentric',
      },
      dependencies: ['canonical_birth_instant'],
      acquiredAtUtc: firstAcquiredTimestamp([calls.chart_sidereal]),
      temporalScope: 'natal_invariant',
      referenceDateIso: null,
      inputFingerprint: fp,
      completeness: telCompleteness,
      verificationStatus: telVerificationStatus,
      canonicalStatus:
        Object.keys(bodies).length === 0
          ? 'unavailable'
          : tsCheck?.exactTimestampMatch
          ? 'internally_verified'
          : 'available',
      limitations: tsCheck?.limitationNotes || [],
      data: telemetryData,
    };
  } else {
    astronomicalTelemetry = unavailableEnvelope<AstronomicalTelemetryFrame>(
      'astroway:/chart (telemetry)',
      'none',
      { zodiacType: 'sidereal', ayanamsha: 'lahiri' },
      fp,
      ['AstroWay /chart astronomical telemetry unavailable.']
    );
  }

  // =========================================================================
  // SHADBALA RECONCILIATION (Keep unassigned_pending_reconciliation)
  // =========================================================================
  const shadbalaFullData = unwrapAstroWayCall(calls.shadbala_full);
  const providerShadbalaMap: Record<string, Record<string, unknown>> = {};
  if (shadbalaFullData && Array.isArray(shadbalaFullData.items)) {
    const finiteOrNull = (val: unknown): number | null => {
      if (val === null || val === undefined || val === '') return null;
      const n = Number(val);
      return Number.isFinite(n) ? n : null;
    };
    for (const item of asObjArr(shadbalaFullData.items)) {
      const pName = normalizeAstroWayPlanetName(item.planetName || item.planet);
      const minRupas = BPHS_SHADBALA_MIN_RUPAS[pName];
      if (!pName || !minRupas) continue;
      const totalVirupa = finiteOrNull(item.totalVirupa);
      if (totalVirupa === null || totalVirupa <= 0) continue;
      const totalRupaRaw = finiteOrNull(item.totalRupa);
      const totalRupa =
        totalRupaRaw !== null ? totalRupaRaw : Number((totalVirupa / 60).toFixed(2));
      providerShadbalaMap[pName] = {
        sthana_bala: finiteOrNull(item.sthana),
        dig_bala: finiteOrNull(item.dig),
        kala_bala: finiteOrNull(item.kala),
        cheshta_bala: finiteOrNull(item.cheshta),
        naisargika_bala: finiteOrNull(item.naisargika),
        drik_bala: finiteOrNull(item.drik),
        total: totalVirupa,
        shadbala_in_rupas: totalRupa,
        minimum_requirements: minRupas,
        ratio: Number((totalRupa / minRupas).toFixed(4)),
      };
    }
  }
  const hasAwShadbala = Object.keys(providerShadbalaMap).length > 0;
  const vedicAscDeg =
    ascDeg !== null ? ascDeg : indepRef.lahiriAscendantDeg;
  const canonicalPlanets =
    vedicPlanets.length >= 8
      ? buildPlanetPositionsFromVedicFrame(vedicPlanets, vedicAscDeg)
      : [];

  const kpCusps12 =
    kpPlacidus.data?.cusps && kpPlacidus.data.cusps.length === 12
      ? kpPlacidus.data.cusps.map((c) => Number(c.cusp_degree))
      : null;

  const reconciliationData = buildShadbalaReconciliationReport({
    instant,
    providerShadbalaRaw: hasAwShadbala ? providerShadbalaMap : null,
    providerStrengthMetadata: {
      provider: 'astroway',
      ratioComputedLocallyAgainstBphsMinimums: true,
      openApiNote: 'Abda/Masa lords and Yuddha Bala still marked open vs PyJHora 62-chart set in OpenAPI.',
    },
    canonicalLahiriPlanets: canonicalPlanets,
    lahiriAscDeg: vedicAscDeg,
    lahiriMcDeg: indepRef.lahiriMcDeg,
    placidusLahiriCusps: null,
    placidusLahiriCusps12:
      kpCusps12 && kpCusps12.every((n) => Number.isFinite(n)) ? kpCusps12 : null,
    providerSthanaRaw: unwrapAstroWayCall(calls.shadbala_sthana),
    providerKalaRaw: unwrapAstroWayCall(calls.shadbala_kala),
    providerIshtaKashtaRaw: unwrapAstroWayCall(calls.shadbala_ishta_kashta),
  });

  // Override the FreeAstroAPI-specific unavailable list with AstroWay's actual omissions
  const awUnavailableStrengthItems: string[] = [
    'Vimshopaka Bala (Shadvarga / Saptavarga / Dashavarga / Shodashavarga — not in AstroWay OpenAPI)',
    'Panchadha Maitri (Five-fold Compound Friendship — not in AstroWay OpenAPI)',
  ];
  for (const subId of [
    'shadbala_sthana',
    'shadbala_dig',
    'shadbala_kala',
    'shadbala_cheshta',
    'shadbala_naisargika',
    'shadbala_drik',
    'shadbala_ishta_kashta',
    'bhavabala',
  ]) {
    const c = calls[subId];
    if (!c?.ok) {
      const tag = c?.acquisitionClassification ? `[${c.acquisitionClassification}] ` : '';
      awUnavailableStrengthItems.push(
        `${subId} (${tag}${c?.errorMessage || 'not yet acquired'})`
      );
    }
  }
  reconciliationData.unavailableClassicalSubcomponents = awUnavailableStrengthItems;

  const shadbalaReconciliation: DatasetEnvelope<typeof reconciliationData> = {
    source: 'reconciliation(astroway_v1 + legacy_local + bphs_ref)',
    calculationMethod: 'Side-by-side Shadbala reconciliation (no averaging, no silent authority)',
    version: V2_MASTER_SCHEMA_VERSION,
    conventions: {
      authoritativeDesignation: reconciliationData.authoritativeDesignation,
    },
    dependencies: ['canonical_birth_instant', 'vedic_d1_positions'],
    acquiredAtUtc: firstAcquiredTimestamp([calls.shadbala_full]),
    temporalScope: 'natal_invariant',
    referenceDateIso: null,
    inputFingerprint: fp,
    completeness: hasAwShadbala ? 'complete' : 'partial',
    verificationStatus: 'pending_live_reconciliation',
    canonicalStatus: hasAwShadbala ? 'provisional' : 'unavailable',
    limitations: [
      'AstroWay exposes detailed 6-Bala subcomponents, Ishta/Kashta (x-quality=yellow), and Bhavabala (x-quality=yellow), while Vimshopaka Bala and Panchadha Maitri are absent.',
    ],
    data: reconciliationData,
  };

  const shadbalaSubRaw = {
    sthana: unwrapAstroWayCall(calls.shadbala_sthana),
    dig: unwrapAstroWayCall(calls.shadbala_dig),
    kala: unwrapAstroWayCall(calls.shadbala_kala),
    cheshta: unwrapAstroWayCall(calls.shadbala_cheshta),
    naisargika: unwrapAstroWayCall(calls.shadbala_naisargika),
    drik: unwrapAstroWayCall(calls.shadbala_drik),
  };
  const shadbalaSubNormalized = normalizeAstroWayShadbalaSubcomponents(
    shadbalaSubRaw,
    normalizeAstroWayPlanetName
  );
  const westEssentialDignities = unwrapAstroWayCall(calls.western_essential_dignities);
  const planetaryConditions = extractAstroWayPlanetaryConditions(vedicPlanets, westEssentialDignities);
  const normalizedChara = normalizeAstroWayAlternativeDasha(
    'chara',
    unwrapAstroWayCall(calls.dashas_chara_maha),
    normalizeAstroWayPlanetName
  );
  const normalizedYogini = normalizeAstroWayAlternativeDasha(
    'yogini',
    unwrapAstroWayCall(calls.dashas_yogini_maha),
    normalizeAstroWayPlanetName
  );
  const normalizedAshtottari = normalizeAstroWayAlternativeDasha(
    'ashtottari',
    unwrapAstroWayCall(calls.dashas_ashtottari_maha),
    normalizeAstroWayPlanetName
  );
  const normalizedKalachakra = normalizeAstroWayAlternativeDasha(
    'kalachakra',
    unwrapAstroWayCall(calls.dashas_kalachakra_maha),
    normalizeAstroWayPlanetName
  );
  const normalizedTribhagi = normalizeAstroWayAlternativeDasha(
    'tribhagi',
    unwrapAstroWayCall(calls.dashas_tribhagi_maha),
    normalizeAstroWayPlanetName
  );

  // =========================================================================
  // EXTENDED CLASSICAL DATASETS + UPDATED GAPS MATRIX
  // =========================================================================
  const providerExtendedDatasets: Record<string, unknown> = {
    vedicKundli: kundli
      ? {
          ayanamsa: kundli.ayanamsa ?? null,
          lagna: kundli.lagna ?? null,
          nakshatra: kundli.nakshatra ?? null,
          dasha: kundli.dasha ?? null,
          yogas: kundli.yogas ?? null,
          doshas: kundli.doshas ?? null,
        }
      : null,
    siderealChartExtras: chartSidereal
      ? {
          aspects: asObjArr(chartSidereal.aspects),
          houseAspects: asObjArr(chartSidereal.houseAspects),
          parallelAspects: asObjArr(chartSidereal.parallelAspects),
          antiscia: asObjArr(chartSidereal.antiscia),
          antisciaAspects: asObjArr(chartSidereal.antisciaAspects),
        }
      : null,
    shadbalaFull: shadbalaFullData,
    shadbalaSubcomponents: shadbalaSubRaw,
    shadbalaSubcomponentsNormalized: shadbalaSubNormalized,
    ishtaKashtaPhala: normalizeAstroWayIshtaKashta(
      unwrapAstroWayCall(calls.shadbala_ishta_kashta),
      normalizeAstroWayPlanetName
    ),
    bhavabala: normalizeAstroWayBhavabala(unwrapAstroWayCall(calls.bhavabala)),
    planetaryConditions,
    ashtakavargaBasic: avBasic,
    ashtakavargaShodhana: normalizeAstroWayAshtakavargaShodhana(
      unwrapAstroWayCall(calls.ashtakavarga_shodhana)
    ),
    kpExtended: {
      rulingPlanets: kpRulingRaw,
      ascSub: unwrapAstroWayCall(calls.kp_asc_sub),
      fortuna: unwrapAstroWayCall(calls.kp_fortuna),
      planetCuspalPosition: kpPosRaw,
    },
    jaimini: normalizeAstroWayJaiminiSuite({
      karakas: unwrapAstroWayCall(calls.jaimini_karakas),
      charaKarakas: unwrapAstroWayCall(calls.jaimini_chara_karakas),
      padas: unwrapAstroWayCall(calls.jaimini_padas),
      upapada: unwrapAstroWayCall(calls.jaimini_upapada),
      aspects: unwrapAstroWayCall(calls.jaimini_aspects),
      drishtiRasi: unwrapAstroWayCall(calls.jaimini_drishti_rasi),
      drishtiGraha: unwrapAstroWayCall(calls.jaimini_drishti_graha),
      atmakarakaNavamsa: unwrapAstroWayCall(calls.jaimini_atmakaraka_navamsa),
      argalaAnalysis: unwrapAstroWayCall(calls.jaimini_argala_analysis),
      yogas: jaiminiYogas,
    }),
    yogasAndDoshas: {
      yogasParashara,
      yogasJaimini,
      doshasParashara: unwrapAstroWayCall(calls.doshas_parashara_full),
      doshasKp: unwrapAstroWayCall(calls.doshas_kp_full),
      normalizedYogas,
    },
    upagrahas: unwrapAstroWayCall(calls.vedic_upagrahas),
    advancedDashas: {
      vimshottariPrana: normalizedVimshottari,
      charaMaha: normalizedChara,
      yoginiMaha: normalizedYogini,
      ashtottariMaha: normalizedAshtottari,
      kalachakraMaha: normalizedKalachakra,
      tribhagiMaha: normalizedTribhagi,
    },
    westernAndHellenistic: {
      essentialDignities: westEssentialDignities,
      firdaria: unwrapAstroWayCall(calls.western_firdaria),
      profections: unwrapAstroWayCall(calls.western_profections),
      brennanLots15: unwrapAstroWayCall(calls.hellenistic_brennan_lots_15),
      brennanZrFortune: unwrapAstroWayCall(calls.hellenistic_brennan_zr_fortune),
      brennanZrSpirit: unwrapAstroWayCall(calls.hellenistic_brennan_zr_spirit),
      brennanProfectionsDetail: unwrapAstroWayCall(calls.hellenistic_brennan_profections_detail),
    },
    nodeConventionObserved: {
      chartSiderealNodeLabels,
      kundliNodeLabels,
      caveat: 'AstroWay ChartInput v2.383.19 omits explicit nodeType (Mean vs True node) toggle.',
    },
    explicitApiGaps: [
      'Vimshopaka Bala (no endpoint in AstroWay OpenAPI v2.383.19)',
      'Panchadha Maitri (no endpoint in AstroWay OpenAPI v2.383.19)',
      'Advanced Avasthas: Deeptadi / Sayanaadi / Lajjitadi (no endpoint in AstroWay OpenAPI v2.383.19)',
      'D5 Panchamsha divisional chart (only 16 BPHS Shodashavarga D1–D60 endpoints exist)',
      'Standalone Bhava Chalit planet-shift chart (only /vedic/bhavabala exists)',
    ],
  };

  const resolveAwStatus = (
    callIds: string[],
    overrideNote?: string
  ): {
    status: RemainingClassicalGapItem['selectedProviderStatus'];
    note: string;
  } => {
    const matched = callIds.map((id) => calls[id]).filter(Boolean);
    if (matched.length === 0) {
      return { status: 'not_yet_tested', note: overrideNote || 'Queued in later batch.' };
    }
    const okList = matched.filter((c) => c.ok);
    const getCls = (c: (typeof matched)[number]) =>
      c.acquisitionClassification ||
      (c.attempts === 0
        ? 'not_yet_tested'
        : c.ok
        ? 'successfully_acquired'
        : c.httpStatus === 429
        ? 'rate_limited'
        : c.accessRestricted || [401, 402, 403].includes(c.httpStatus)
        ? 'tier_restricted'
        : [404, 405, 501].includes(c.httpStatus)
        ? 'not_offered_by_provider'
        : 'runtime_execution_blocked');

    const classes = matched.map(getCls);
    if (okList.length === matched.length) {
      const anyYellow = okList.some((c) => c.declaredQuality === 'yellow');
      return {
        status: anyYellow ? 'available_yellow' : 'available_green',
        note: `${okList.length}/${matched.length} AstroWay endpoint(s) acquired${
          anyYellow ? ' (includes OpenAPI x-quality=yellow dataset requiring external verification)' : ''
        }.${overrideNote ? ` ${overrideNote}` : ''}`,
      };
    }
    if (okList.length > 0) {
      return {
        status: 'partial_only',
        note: `${okList.length}/${matched.length} AstroWay endpoint(s) succeeded; remaining states: ${classes.filter((x) => x !== 'successfully_acquired').join(', ')}.`,
      };
    }
    if (classes.some((x) => x === 'rate_limited')) {
      return {
        status: 'rate_limited',
        note: `Rate-limited (HTTP 429) across ${matched.length} AstroWay endpoint(s); queued to resume after cooldown.`,
      };
    }
    if (classes.every((x) => x === 'not_yet_tested')) {
      return {
        status: 'not_yet_tested',
        note: `Not yet tested (${matched.length} endpoint(s) queued for upcoming bounded batch).`,
      };
    }
    if (classes.some((x) => x === 'tier_restricted')) {
      return {
        status: 'tier_restricted',
        note: `Tier/credit restricted (${matched.find((c) => getCls(c) === 'tier_restricted')?.httpStatus ?? '402/403'}).`,
      };
    }
    if (classes.some((x) => x === 'runtime_execution_blocked')) {
      return {
        status: 'runtime_execution_blocked',
        note: `Runtime execution blocked on ${matched.length} AstroWay endpoint(s) (${matched[0].errorMessage || `HTTP ${matched[0].httpStatus}`}).`,
      };
    }
    return {
      status: 'unavailable',
      note: `Not offered by provider across ${matched.length} AstroWay endpoint(s) (last HTTP ${matched[0].httpStatus}).`,
    };
  };

  const remainingClassicalGaps: RemainingClassicalGapItem[] = REMAINING_CLASSICAL_GAPS_INVENTORY.map(
    (item) => {
      if (item.capability.startsWith('Detailed Shadbala Subcomponents')) {
        const res = resolveAwStatus([
          'shadbala_sthana',
          'shadbala_dig',
          'shadbala_kala',
          'shadbala_cheshta',
          'shadbala_naisargika',
          'shadbala_drik',
        ]);
        return { ...item, selectedProviderStatus: res.status, notes: res.note };
      }
      if (item.capability.startsWith('Ishta Phala')) {
        const res = resolveAwStatus(['shadbala_ishta_kashta']);
        return { ...item, selectedProviderStatus: res.status, notes: res.note };
      }
      if (item.capability.startsWith('Bhavabala')) {
        const res = resolveAwStatus(['bhavabala']);
        return { ...item, selectedProviderStatus: res.status, notes: res.note };
      }
      if (item.capability.startsWith('Vimshopaka Bala')) {
        return {
          ...item,
          selectedProviderStatus: 'unavailable',
          notes: 'Confirmed absent in AstroWay OpenAPI v2.383.19.',
        };
      }
      if (item.capability.startsWith('Panchadha Maitri')) {
        return {
          ...item,
          selectedProviderStatus: 'unavailable',
          notes: 'Confirmed absent in AstroWay OpenAPI v2.383.19.',
        };
      }
      if (item.capability.startsWith('Jaimini System')) {
        const res = resolveAwStatus([
          'jaimini_karakas',
          'jaimini_chara_karakas',
          'jaimini_padas',
          'jaimini_upapada',
          'jaimini_aspects',
          'jaimini_drishti_rasi',
          'jaimini_drishti_graha',
          'jaimini_atmakaraka_navamsa',
          'jaimini_argala_analysis',
          'jaimini_yogas',
        ]);
        return { ...item, selectedProviderStatus: res.status, notes: res.note };
      }
      if (item.capability.startsWith('Ashtakavarga Shodhana')) {
        const res = resolveAwStatus(['ashtakavarga_shodhana']);
        return { ...item, selectedProviderStatus: res.status, notes: res.note };
      }
      if (item.capability.startsWith('Advanced Avasthas')) {
        return {
          ...item,
          selectedProviderStatus: 'unavailable',
          notes: 'Confirmed absent in AstroWay OpenAPI v2.383.19.',
        };
      }
      if (item.capability.startsWith('Graha Yuddha')) {
        const res = resolveAwStatus(
          ['chart_sidereal', 'shadbala_kala'],
          'Ecliptic latitudes from /chart + kala.yuddha from /vedic/shadbala/kala.'
        );
        return { ...item, selectedProviderStatus: res.status, notes: res.note };
      }
      if (item.capability.startsWith('Alternative Dasha')) {
        const res = resolveAwStatus([
          'dashas_chara_maha',
          'dashas_yogini_maha',
          'dashas_ashtottari_maha',
          'dashas_kalachakra_maha',
          'dashas_tribhagi_maha',
        ]);
        return { ...item, selectedProviderStatus: res.status, notes: res.note };
      }
      if (item.capability.startsWith('Five-level Dasha Hierarchy')) {
        const res = resolveAwStatus(['dashas_vimshottari_prana']);
        return { ...item, selectedProviderStatus: res.status, notes: res.note };
      }
      if (item.capability.startsWith('Hellenistic Lots')) {
        const res = resolveAwStatus([
          'western_essential_dignities',
          'western_firdaria',
          'western_profections',
          'hellenistic_brennan_lots_15',
          'hellenistic_brennan_zr_fortune',
          'hellenistic_brennan_zr_spirit',
          'hellenistic_brennan_profections_detail',
        ]);
        return { ...item, selectedProviderStatus: res.status, notes: res.note };
      }
      return item;
    }
  );

  const calculationConventions: CalculationConventionsRecord = {
    ayanamsa: {
      vedic: vedicLahiri.data?.ayanamshaLabel || 'lahiri',
      vedicValueDegrees: vedicLahiri.data?.ayanamshaValueDegrees ?? null,
      kp: kpPlacidus.data?.ayanamsha?.name ?? 'Krishnamurti (KP)',
      kpValueDegrees: kpPlacidus.data?.ayanamsha?.valueDegrees ?? null,
    },
    nodeConvention: {
      requested: instant.input.nodeConvention,
      vedicObserved:
        vedicLahiri.data?.nodeType ||
        (chartSiderealNodeLabels.length
          ? chartSiderealNodeLabels.join(', ')
          : 'provider_default (ChartInput omits nodeType)'),
      isExplicitOnProvider: false,
    },
    houseSystems: {
      parashari: 'whole_sign',
      kp: 'placidus',
      bhavaChalit: 'sripati_midpoint_pending_supplementary_or_local',
      western: westernTropical.data?.houseSystem || 'placidus',
    },
    divisionalChartMethods: {
      shodashavarga: calls.varga_D1
        ? 'astroway_v1_bphs_16_charts (excludes D5)'
        : 'astroway_v1_bphs_16_charts (D1 mirrored from canonical D1; excludes D5)',
      d4Method: 'astroway_v1_chaturthamsha',
      d5Method: null,
    },
    dashaYearLength: {
      vimshottari: '365.2425/365.25-day calendar dates returned by AstroWay prana endpoint',
      alternativeDashas: 'astroway_v1_chara_yogini_ashtottari_kalachakra_tribhagi',
    },
    shadbalaMethodology: {
      provider: 'astroway_v1_shadbala',
      luminaryCheshtaConvention: 'explicit_non_zero_subject_to_bphs_reconciliation',
      minimumStrengthThresholdStandard: 'bphs_6.5_sun_rupas_reference',
    },
    recalculationVersion: V2_RECALCULATION_VERSION,
    supportsFutureUserConventionOverrides: true,
  };

  const kundliDashaSnapshot = asObj(kundli?.dasha);
  const profectionsBasic = unwrapAstroWayCall(calls.western_profections);
  const profectionsDetail = unwrapAstroWayCall(calls.hellenistic_brennan_profections_detail);
  const profReqAgeRaw = calls.hellenistic_brennan_profections_detail?.sanitizedRequest?.targetAge;
  const targetAgeYears =
    typeof profReqAgeRaw === 'number' && Number.isFinite(profReqAgeRaw) ? profReqAgeRaw : null;

  const altDashaSnap: Record<string, unknown> = {};
  for (const [k, normalizedAlt] of [
    ['chara', normalizedChara],
    ['yogini', normalizedYogini],
    ['ashtottari', normalizedAshtottari],
    ['kalachakra', normalizedKalachakra],
    ['tribhagi', normalizedTribhagi],
  ] as const) {
    if (normalizedAlt?.referenceDateActive) {
      altDashaSnap[k] = normalizedAlt.referenceDateActive;
    }
  }

  const vimRefActive = asObj(normalizedVimshottari?.referenceDateActive);
  const hasRefTiming = Boolean(
    effectiveRefDateIso ||
      kpRulingRaw ||
      profectionsBasic ||
      profectionsDetail ||
      kundliDashaSnapshot?.current ||
      vimRefActive ||
      Object.keys(altDashaSnap).length > 0
  );

  const referenceDateTiming: ReferenceDateTimingSnapshot | null = hasRefTiming
    ? {
        temporalScope: 'reference_date_dependent',
        referenceDateIso: effectiveRefDateIso,
        targetAgeYears,
        activeVimshottari:
          vimRefActive ?? asObj(kundliDashaSnapshot?.current) ?? kundliDashaSnapshot ?? null,
        activeAlternativeDashas: Object.keys(altDashaSnap).length > 0 ? altDashaSnap : null,
        kpRulingPlanets: kpRulingRaw ?? null,
        westernProfections:
          profectionsBasic || profectionsDetail
            ? {
                basic: profectionsBasic,
                hellenisticDetail: profectionsDetail,
              }
            : null,
        limitations: effectiveRefDateIso
          ? []
          : [
              'Reference-date-dependent snapshot fields extracted from provider response without an explicit targetDate parameter in sanitizedRequest.',
            ],
      }
    : null;

  const master: LayerBMasterChartRecord = {
    schemaVersion: V2_MASTER_SCHEMA_VERSION,
    recalculationVersion: V2_RECALCULATION_VERSION,
    providerId: 'astroway',
    generatedAtUtc: new Date().toISOString(),
    canonicalBirthInstant: instant,
    calculationConventions,
    frames: {
      vedicLahiri,
      kpPlacidus,
      bhavaChalit,
      westernTropical,
      astronomicalTelemetry,
    },
    shadbalaReconciliation,
    referenceDateTiming,
    providerExtendedDatasets,
    remainingClassicalGaps,
  };
  if (includeLocalModules === false) {
    master.datasetManifest = evaluateDatasetCompleteness(master);
    return master;
  }
  return enrichMasterWithPhase4LocalCalculations(master, {
    preferLocalAshtakavarga,
  });
}

export function buildLayerBMasterChartRecord(params: {
  instant: CanonicalBirthInstant;
  rawLayerA?: LayerARawProviderRecord | null;
  cachedVerifiedRecord?: LayerBMasterChartRecord | null;
  referenceDateIso?: string | null;
  supplementaryFreeAstroApiVedicCall?: SanitizedProviderCallRecord | null;
  preferLocalAshtakavarga?: boolean;
  includeLocalModules?: boolean;
}): LayerBMasterChartRecord {
  const {
    instant,
    rawLayerA,
    cachedVerifiedRecord,
    referenceDateIso,
    supplementaryFreeAstroApiVedicCall,
    preferLocalAshtakavarga,
    includeLocalModules = true,
  } = params;
  if (rawLayerA?.providerId === 'astroway') {
    const awMaster = normalizeAstroWayLayerBMasterChartRecord({
      instant,
      rawLayerA,
      cachedVerifiedRecord,
      referenceDateIso,
      preferLocalAshtakavarga,
      includeLocalModules,
    });
    if (supplementaryFreeAstroApiVedicCall) {
      return integrateFreeAstroApiSupplementaryIntoMaster(
        awMaster,
        supplementaryFreeAstroApiVedicCall,
        { includeLocalModules }
      );
    }
    return awMaster;
  }

  const fp = instant.inputFingerprint;
  const indepRef = computeIndependentAstronomicalReference(instant);

  const calcCall = rawLayerA?.calls?.vedic_calculate;
  const kpCall = rawLayerA?.calls?.vedic_kp;
  const westCall = rawLayerA?.calls?.western_natal;
  const ephCall = rawLayerA?.calls?.ephemeris;

  const resolveCached = <T>(
    extractor: (r: LayerBMasterChartRecord) => DatasetEnvelope<T>
  ): DatasetEnvelope<T> | null => {
    if (
      cachedVerifiedRecord &&
      cachedVerifiedRecord.canonicalBirthInstant.inputFingerprint === fp
    ) {
      const env = extractor(cachedVerifiedRecord);
      if (env.data && env.completeness === 'complete') {
        return { ...env, verificationStatus: 'cached_verified' };
      }
    }
    return null;
  };

  // =========================================================================
  // FRAME 1: VEDIC LAHIRI (Whole Sign + 17 Vargas + Ashtakavarga + Yogas + Panchang + Dasha)
  // =========================================================================
  let vedicLahiri: DatasetEnvelope<VedicLahiriFrame>;
  if (calcCall?.ok && asObj(calcCall.rawResponse)) {
    const raw = calcCall.rawResponse as Record<string, unknown>;
    const chart = asObj(raw.chart) || {};
    const vargasRaw = asObj(raw.vargas);
    const vargaChartsRaw = (asObj(vargasRaw?.vargas) || {}) as Record<
      string,
      Record<string, unknown>
    >;
    const avRaw = asObj(raw.ashtakavarga);
    const yogasRaw = asObj(raw.yogas);
    const dashaRaw = asObj(raw.vimshottari_dasha);
    const panchangRaw = asObj(raw.panchang);

    const faAyDescriptor = resolveAyanamshaDescriptor({
      rawValue: raw.ayanamsha ?? calcCall.sanitizedRequest?.ayanamsa,
      rawValueDegrees:
        raw.ayanamsha_value ??
        raw.ayanamsa_degrees ??
        asObj(chart.metadata)?.ayanamsha_value ??
        asObj(chart.metadata)?.ayanamsha_degrees,
      requestedAyanamsa: calcCall.sanitizedRequest?.ayanamsa ?? 'lahiri',
      expectedLahiriDeg: instant.astronomy.lahiriAyanamsaApproxDeg,
    });

    const frameData: VedicLahiriFrame = {
      ayanamshaLabel: faAyDescriptor.id,
      ayanamshaValueDegrees: faAyDescriptor.valueDegrees,
      ayanamsha: {
        id: faAyDescriptor.id,
        name: faAyDescriptor.name,
        valueDegrees: faAyDescriptor.valueDegrees,
      },
      houseSystem: String(
        asObj(chart.metadata)?.house_system || 'whole_sign'
      ),
      nodeType: String(
        asObj(chart.metadata)?.node_type || instant.input.nodeConvention
      ),
      timezoneUsed: String(raw.timezone_used || ''),
      ascendant: asObj(chart.ascendant),
      planets: asObjArr(chart.planets),
      houses: asObjArr(chart.houses),
      sadeSati: asObj(chart.sade_sati),
      vargas: vargasRaw
        ? {
            supportedCount: Object.keys(vargaChartsRaw).length,
            divisionsReturned: Object.keys(vargaChartsRaw),
            chartsByDivision: vargaChartsRaw,
          }
        : null,
      ashtakavarga: avRaw
        ? {
            sarvashtakavarga: Array.isArray(avRaw.sarvashtakavarga)
              ? (avRaw.sarvashtakavarga as number[])
              : [],
            bhinnashtakavarga:
              (asObj(avRaw.bhinnashtakavarga) as Record<string, number[]>) || {},
            prastharashtakavarga:
              (asObj(avRaw.prastharashtakavarga) as Record<
                string,
                Record<string, number[]>
              >) || {},
            totalPoints: Number(avRaw.total_points ?? 0),
          }
        : null,
      yogas: yogasRaw
        ? {
            summary: asObj(yogasRaw.summary),
            items: asObjArr(yogasRaw.yogas),
            metadata: asObj(yogasRaw.metadata),
          }
        : null,
      panchang: panchangRaw,
      vimshottariDasha: dashaRaw,
      providerMetadata: asObj(raw.metadata) || asObj(chart.metadata),
    };

    const limitations: string[] = [];
    if (!frameData.vargas || frameData.vargas.supportedCount < 17) {
      limitations.push(
        `Returned ${frameData.vargas?.supportedCount ?? 0}/17 expected Vargas.`
      );
    }

    const vedicCompleteness =
      frameData.planets.length >= 9 &&
      frameData.vargas &&
      frameData.ashtakavarga &&
      frameData.vimshottariDasha
        ? 'complete'
        : 'partial';
    const hasValidFreeAstroD1 =
      frameData.planets.length >= 9 &&
      frameData.ascendant !== null &&
      Number.isFinite(Number(frameData.ascendant.degree ?? frameData.ascendant.absolute_degree));

    vedicLahiri = {
      source: 'freeastroapi:/api/v2/vedic/calculate',
      calculationMethod: 'FreeAstroAPI V2 Lahiri Whole-Sign Sidereal',
      version: String(asObj(chart.metadata)?.ruleset_version || V2_MASTER_SCHEMA_VERSION),
      conventions: {
        ayanamsha: 'lahiri',
        houseSystem: 'whole_sign',
        nodeConvention: frameData.nodeType,
        observationPoint: 'geocentric',
      },
      dependencies: ['canonical_birth_instant'],
      acquiredAtUtc: firstAcquiredTimestamp([calcCall]),
      temporalScope: 'natal_invariant',
      referenceDateIso: null,
      inputFingerprint: fp,
      completeness: vedicCompleteness,
      verificationStatus: 'verified_provider',
      canonicalStatus: hasValidFreeAstroD1
        ? vedicCompleteness === 'complete'
          ? 'available'
          : 'provisional'
        : 'unavailable',
      limitations,
      data: frameData,
    };
  } else {
    vedicLahiri =
      resolveCached((r) => r.frames.vedicLahiri) ||
      unavailableEnvelope<VedicLahiriFrame>(
        'freeastroapi:/api/v2/vedic/calculate',
        'none',
        { ayanamsha: 'lahiri', houseSystem: 'whole_sign', nodeConvention: instant.input.nodeConvention },
        fp,
        [
          calcCall
            ? `Provider returned HTTP ${calcCall.httpStatus}: ${calcCall.errorMessage || 'error'}`
            : 'Live provider acquisition not executed (FREE_ASTRO_API_KEY unset or request omitted). Silent fallback disabled.',
        ]
      );
    if (vedicLahiri.verificationStatus === 'cached_verified') {
      vedicLahiri.canonicalStatus = deriveCanonicalDatasetState(vedicLahiri);
    }
  }

  // =========================================================================
  // FRAME 2: KP (Krishnamurti Ayanamsa + Placidus Cusps — NO H1/H7 overwrite)
  // =========================================================================
  let kpPlacidus: DatasetEnvelope<KpPlacidusFrame>;
  if (kpCall?.ok && asObj(kpCall.rawResponse)) {
    const raw = kpCall.rawResponse as Record<string, unknown>;
    const ayObj = asObj(raw.ayanamsha) || {};
    const frameData: KpPlacidusFrame = {
      ayanamsha: {
        id: String(ayObj.id || 'kp'),
        name: String(ayObj.name || 'Krishnamurti (KP)'),
        valueDegrees: typeof ayObj.value_degrees === 'number' ? ayObj.value_degrees : null,
      },
      angles: asObj(raw.angles),
      ascendant: asObj(raw.ascendant),
      planets: asObjArr(raw.planets),
      cusps: asObjArr(raw.cusps),
      cuspalSubLordTable: asObjArr(raw.cuspal_sub_lord_table),
      planetSignificators: asObjArr(raw.planet_significators),
      houseSignificators: asObjArr(raw.house_significators),
      rulingPlanets: asObj(raw.ruling_planets),
      dasha: asObj(raw.dasha),
      metadata: asObj(raw.metadata),
    };

    const kpCompleteness =
      frameData.cusps.length === 12 && frameData.planets.length >= 9 ? 'complete' : 'partial';
    kpPlacidus = {
      source: 'freeastroapi:/api/v2/vedic/kp',
      calculationMethod: 'FreeAstroAPI V2 Dedicated KP (ayanamsha=kp, house_system=placidus)',
      version: String(asObj(raw.metadata)?.ruleset_version || V2_MASTER_SCHEMA_VERSION),
      conventions: {
        ayanamsha: 'kp',
        ayanamshaValueDeg: frameData.ayanamsha.valueDegrees,
        houseSystem: 'placidus',
        nodeConvention: String(
          asObj(raw.metadata)?.node_type || instant.input.nodeConvention
        ),
        nodePolicy: asObj(raw.metadata)?.node_policy ?? null,
        significatorPolicy: asObj(raw.metadata)?.significator_policy ?? null,
      },
      dependencies: ['canonical_birth_instant'],
      acquiredAtUtc: firstAcquiredTimestamp([kpCall]),
      temporalScope: 'natal_invariant',
      referenceDateIso: null,
      inputFingerprint: fp,
      completeness: kpCompleteness,
      verificationStatus: 'verified_provider',
      canonicalStatus: kpCompleteness === 'complete' ? 'available' : 'provisional',
      limitations: [],
      data: frameData,
    };
  } else {
    kpPlacidus =
      resolveCached((r) => r.frames.kpPlacidus) ||
      unavailableEnvelope<KpPlacidusFrame>(
        'freeastroapi:/api/v2/vedic/kp',
        'none',
        { ayanamsha: 'kp', houseSystem: 'placidus', nodeConvention: instant.input.nodeConvention },
        fp,
        [
          kpCall
            ? `Provider returned HTTP ${kpCall.httpStatus}: ${kpCall.errorMessage || 'error'}`
            : 'Live KP acquisition not executed. Unverified local cusp approximations are disabled as silent fallbacks.',
        ]
      );
    if (kpPlacidus.verificationStatus === 'cached_verified') {
      kpPlacidus.canonicalStatus = deriveCanonicalDatasetState(kpPlacidus);
    }
  }

  // =========================================================================
  // FRAME 3: CLASSICAL BHAVA CHALIT (Strictly separated from KP Placidus)
  // =========================================================================
  let bhavaChalit: DatasetEnvelope<BhavaChalitFrame>;
  const providerBcRaw =
    calcCall?.ok && asObj(calcCall.rawResponse)
      ? asObj((calcCall.rawResponse as Record<string, unknown>).bhava_chalit) ||
        asObj(asObj((calcCall.rawResponse as Record<string, unknown>).chart)?.bhava_chalit)
      : null;

  if (providerBcRaw) {
    const methodologyAudit = verifyBhavaChalitMethodology(providerBcRaw, indepRef);
    const frameData: BhavaChalitFrame = {
      chartType: typeof providerBcRaw.chart_type === 'string' ? providerBcRaw.chart_type : null,
      name: typeof providerBcRaw.name === 'string' ? providerBcRaw.name : null,
      calibrated: typeof providerBcRaw.calibrated === 'boolean' ? providerBcRaw.calibrated : null,
      houseBasis: typeof providerBcRaw.house_basis === 'string' ? providerBcRaw.house_basis : null,
      ascendant: asObj(providerBcRaw.ascendant),
      houses: asObjArr(providerBcRaw.houses),
      planets: asObjArr(providerBcRaw.planets),
      methodologyAudit,
    };

    const bcCompatible = methodologyAudit.compatibleWithIntendedClassicalMethodology;
    bhavaChalit = {
      source: 'freeastroapi:/api/v2/vedic/calculate#bhava_chalit',
      calculationMethod: `FreeAstroAPI V2 Bhava Chalit (${frameData.houseBasis || 'unspecified'})`,
      version: V2_MASTER_SCHEMA_VERSION,
      conventions: {
        ayanamsha: 'lahiri',
        houseBasis: frameData.houseBasis,
        nodeConvention: instant.input.nodeConvention,
      },
      dependencies: ['canonical_birth_instant', 'vedic_d1_positions'],
      acquiredAtUtc: firstAcquiredTimestamp([calcCall]),
      temporalScope: 'natal_invariant',
      referenceDateIso: null,
      inputFingerprint: fp,
      completeness: frameData.houses.length === 12 ? 'complete' : 'partial',
      verificationStatus: bcCompatible ? 'verified_provider' : 'partial',
      canonicalStatus:
        frameData.houses.length !== 12
          ? 'unavailable'
          : bcCompatible
          ? 'internally_verified'
          : 'incompatible',
      limitations: bcCompatible
        ? []
        : [
            'Provider Bhava Chalit failed full classical Sripati midpoint methodology compatibility check; review methodologyAudit.',
          ],
      data: frameData,
    };
  } else {
    bhavaChalit =
      resolveCached((r) => r.frames.bhavaChalit) ||
      unavailableEnvelope<BhavaChalitFrame>(
        calcCall ? 'freeastroapi:/api/v2/vedic/calculate#bhava_chalit' : 'unavailable',
        'none',
        { ayanamsha: 'lahiri', methodology: 'sripati_midpoint_chalit' },
        fp,
        ['Provider Bhava Chalit not available; legacy KP-cusp Bhava Chalit conflation removed.'],
        { dependencies: ['canonical_birth_instant', 'vedic_d1_positions'] }
      );
    if (bhavaChalit.verificationStatus === 'cached_verified') {
      bhavaChalit.canonicalStatus = deriveCanonicalDatasetState(bhavaChalit);
    }
  }

  // =========================================================================
  // FRAME 4: WESTERN TROPICAL PLACIDUS (Independent of KP & Vedic)
  // =========================================================================
  let westernTropical: DatasetEnvelope<WesternTropicalFrame>;
  if (westCall?.ok && asObj(westCall.rawResponse)) {
    const raw = westCall.rawResponse as Record<string, unknown>;
    const frameData: WesternTropicalFrame = {
      zodiacType: String(raw.zodiac_type || 'tropical'),
      houseSystem: String(raw.house_system || 'placidus'),
      timeKnown: typeof raw.time_known === 'boolean' ? raw.time_known : null,
      secondPrecisionDroppedByV1Endpoint: instant.input.second !== 0,
      subject: asObj(raw.subject),
      resolvedTime: asObj(raw.resolved_time),
      angles: asObj(raw.angles),
      anglesDetails: asObj(raw.angles_details),
      planets: asObjArr(raw.planets),
      houses: asObjArr(raw.houses),
      aspects: asObjArr(raw.aspects),
      aspectsSummary: asObj(raw.aspects_summary),
      declinationAspects: asObjArr(raw.declination_aspects),
      declinationAspectsSummary: asObj(raw.declination_aspects_summary),
      configurations: asObj(raw.configurations),
      stelliums: asObj(raw.stelliums),
      dominants: asObj(raw.dominants),
      dominantsProfile: asObj(raw.dominants_profile),
      tables: asObj(raw.tables),
    };

    const limitations: string[] = [];
    if (instant.input.second !== 0) {
      limitations.push(
        `V1 /api/v1/natal/calculate request schema lacks a "second" parameter; ${instant.input.second}s was truncated.`
      );
    }

    const westCompleteness =
      frameData.planets.length >= 10 && frameData.houses.length === 12 ? 'complete' : 'partial';
    westernTropical = {
      source: 'freeastroapi:/api/v1/natal/calculate',
      calculationMethod: 'FreeAstroAPI V1 Tropical Placidus Natal',
      version: String(asObj(raw.resolved_time)?.tzdb_version || V2_MASTER_SCHEMA_VERSION),
      conventions: {
        zodiac: 'tropical',
        houseSystem: 'placidus',
        nodeConvention: instant.input.nodeConvention,
      },
      dependencies: ['canonical_birth_instant'],
      acquiredAtUtc: firstAcquiredTimestamp([westCall]),
      temporalScope: 'natal_invariant',
      referenceDateIso: null,
      inputFingerprint: fp,
      completeness: westCompleteness,
      verificationStatus: limitations.length ? 'partial' : 'verified_provider',
      canonicalStatus:
        westCompleteness === 'complete' && limitations.length === 0 ? 'available' : 'provisional',
      limitations,
      data: frameData,
    };
  } else {
    westernTropical =
      resolveCached((r) => r.frames.westernTropical) ||
      unavailableEnvelope<WesternTropicalFrame>(
        'freeastroapi:/api/v1/natal/calculate',
        'none',
        { zodiac: 'tropical', houseSystem: 'placidus', nodeConvention: instant.input.nodeConvention },
        fp,
        ['Western Tropical natal calculation not executed; KP-based Western cusp reconstruction disabled.']
      );
    if (westernTropical.verificationStatus === 'cached_verified') {
      westernTropical.canonicalStatus = deriveCanonicalDatasetState(westernTropical);
    }
  }

  // =========================================================================
  // FRAME 5: ASTRONOMICAL TELEMETRY (/api/v1/ephemeris/calculate)
  // =========================================================================
  let astronomicalTelemetry: DatasetEnvelope<AstronomicalTelemetryFrame>;
  if (ephCall?.ok && asObj(ephCall.rawResponse)) {
    const raw = ephCall.rawResponse as Record<string, unknown>;
    const dataNode =
      asObj(raw.data) ||
      (Array.isArray(raw.data) ? asObj(raw.data[0]) : null) ||
      {};
    const subj = asObj(dataNode.subject) || {};
    const tsCheck = rawLayerA?.ephemerisTimestampCheck ?? null;

    const frameData: AstronomicalTelemetryFrame = {
      zodiacType: String(asObj(raw.meta)?.zodiac_type || 'sidereal'),
      siderealAyanamsa:
        typeof asObj(raw.meta)?.sidereal_ayanamsa === 'string'
          ? String(asObj(raw.meta)?.sidereal_ayanamsa)
          : null,
      timestamp: typeof dataNode.timestamp === 'string' ? dataNode.timestamp : null,
      localTimestamp:
        typeof dataNode.local_timestamp === 'string' ? dataNode.local_timestamp : null,
      resolvedTime: asObj(dataNode.resolved_time),
      subjectSettings: asObj(subj.settings),
      bodies: (asObj(dataNode.bodies) as Record<string, Record<string, unknown>>) || {},
      astrology: asObj(dataNode.astrology),
      angles: asObj(dataNode.angles),
      houses: Array.isArray(dataNode.houses) ? asObjArr(dataNode.houses) : null,
      timestampVerification: tsCheck,
    };

    const exactOk = tsCheck ? tsCheck.exactTimestampMatch : false;
    astronomicalTelemetry = {
      source: 'freeastroapi:/api/v1/ephemeris/calculate',
      calculationMethod: 'FreeAstroAPI V1 Ephemeris Snapshot',
      version: V2_MASTER_SCHEMA_VERSION,
      conventions: {
        zodiacType: frameData.zodiacType,
        ayanamsha: frameData.siderealAyanamsa,
        observationPoint: 'geocentric',
      },
      dependencies: ['canonical_birth_instant'],
      acquiredAtUtc: firstAcquiredTimestamp([ephCall]),
      temporalScope: 'natal_invariant',
      referenceDateIso: null,
      inputFingerprint: fp,
      completeness: Object.keys(frameData.bodies).length > 0 ? 'complete' : 'partial',
      verificationStatus: exactOk ? 'verified_provider' : 'partial',
      canonicalStatus:
        Object.keys(frameData.bodies).length === 0
          ? 'unavailable'
          : exactOk
          ? 'internally_verified'
          : 'provisional',
      limitations: tsCheck?.limitationNotes || [],
      data: frameData,
    };
  } else {
    astronomicalTelemetry =
      resolveCached((r) => r.frames.astronomicalTelemetry) ||
      unavailableEnvelope<AstronomicalTelemetryFrame>(
        'freeastroapi:/api/v1/ephemeris/calculate',
        'none',
        { zodiacType: 'sidereal', ayanamsha: 'lahiri' },
        fp,
        ['Astronomical ephemeris telemetry unavailable.']
      );
    if (astronomicalTelemetry.verificationStatus === 'cached_verified') {
      astronomicalTelemetry.canonicalStatus = deriveCanonicalDatasetState(astronomicalTelemetry);
    }
  }

  // =========================================================================
  // SHADBALA RECONCILIATION (Preserved without silent designation or averaging)
  // =========================================================================
  const calcRawObj = calcCall?.ok ? asObj(calcCall.rawResponse) : null;
  const providerShadbalaRaw = calcRawObj
    ? (asObj(calcRawObj.shadbala) as Record<string, Record<string, unknown>> | null)
    : null;
  const providerStrengthMeta = calcRawObj ? asObj(calcRawObj.metadata) : null;

  const vedicAscDeg =
    vedicLahiri.data?.ascendant && typeof vedicLahiri.data.ascendant.degree === 'number'
      ? Number(vedicLahiri.data.ascendant.degree)
      : indepRef.lahiriAscendantDeg;
  const canonicalPlanets =
    vedicLahiri.data && vedicLahiri.data.planets.length >= 9
      ? buildPlanetPositionsFromVedicFrame(vedicLahiri.data.planets, vedicAscDeg)
      : [];

  const reconciliationData = buildShadbalaReconciliationReport({
    instant,
    providerShadbalaRaw,
    providerStrengthMetadata: providerStrengthMeta,
    canonicalLahiriPlanets: canonicalPlanets,
    lahiriAscDeg: vedicAscDeg,
    lahiriMcDeg: indepRef.lahiriMcDeg,
    placidusLahiriCusps: null,
  });

  const shadbalaReconciliation: DatasetEnvelope<typeof reconciliationData> = {
    source: 'reconciliation(freeastroapi_v2 + legacy_local + bphs_ref)',
    calculationMethod: 'Side-by-side Shadbala reconciliation (no averaging, no silent authority)',
    version: V2_MASTER_SCHEMA_VERSION,
    conventions: {
      authoritativeDesignation: reconciliationData.authoritativeDesignation,
    },
    dependencies: ['canonical_birth_instant', 'vedic_d1_positions'],
    acquiredAtUtc: firstAcquiredTimestamp([calcCall]),
    temporalScope: 'natal_invariant',
    referenceDateIso: null,
    inputFingerprint: fp,
    completeness: providerShadbalaRaw ? 'complete' : 'partial',
    verificationStatus: 'pending_live_reconciliation',
    canonicalStatus: providerShadbalaRaw ? 'provisional' : 'unavailable',
    limitations: providerShadbalaRaw
      ? ['Detailed classical subcomponents and Bhavabala/Vimshopaka are unavailable from provider.']
      : ['Provider Shadbala absent; reconciliation awaits live FreeAstroAPI execution.'],
    data: reconciliationData,
  };

  const calculationConventions: CalculationConventionsRecord = {
    ayanamsa: {
      vedic: vedicLahiri.data?.ayanamshaLabel || 'lahiri',
      vedicValueDegrees: vedicLahiri.data?.ayanamshaValueDegrees ?? null,
      kp: kpPlacidus.data?.ayanamsha?.name || 'Krishnamurti (KP)',
      kpValueDegrees: kpPlacidus.data?.ayanamsha?.valueDegrees ?? null,
    },
    nodeConvention: {
      requested: instant.input.nodeConvention,
      vedicObserved: vedicLahiri.data?.nodeType || instant.input.nodeConvention,
      isExplicitOnProvider: true,
    },
    houseSystems: {
      parashari: vedicLahiri.data?.houseSystem || 'whole_sign',
      kp: 'placidus',
      bhavaChalit: bhavaChalit.data?.houseBasis || 'sripati_midpoint_chalit',
      western: westernTropical.data?.houseSystem || 'placidus',
    },
    divisionalChartMethods: {
      shodashavarga: 'freeastroapi_v2_17_vargas',
      d4Method: 'freeastroapi_v2_chaturthamsha',
      d5Method: vedicLahiri.data?.vargas?.chartsByDivision?.D5
        ? 'freeastroapi_v2_panchamsha'
        : null,
    },
    dashaYearLength: {
      vimshottari: '365.2425/365.25-day calendar dates returned by FreeAstroAPI v2',
      alternativeDashas: null,
    },
    shadbalaMethodology: {
      provider: 'freeastroapi_v2_shadbala',
      luminaryCheshtaConvention: 'explicit_zero_for_sun_and_moon_per_provider',
      minimumStrengthThresholdStandard: 'mixed_sun_5.0_on_provider_vs_bphs_6.5',
    },
    recalculationVersion: V2_RECALCULATION_VERSION,
    supportsFutureUserConventionOverrides: true,
  };

  const effectiveRefDateIso = inferReferenceDateIso(rawLayerA, referenceDateIso);
  const kpRuling = kpPlacidus.data?.rulingPlanets ?? null;
  const referenceDateTiming: ReferenceDateTimingSnapshot | null =
    effectiveRefDateIso || kpRuling
      ? {
          temporalScope: 'reference_date_dependent',
          referenceDateIso: effectiveRefDateIso,
          targetAgeYears: null,
          activeVimshottari: asObj(vedicLahiri.data?.vimshottariDasha?.current_dasha) ?? null,
          activeAlternativeDashas: null,
          kpRulingPlanets: kpRuling,
          westernProfections: null,
          limitations: effectiveRefDateIso
            ? []
            : ['KP ruling planets captured without an explicit targetDate in sanitizedRequest.'],
        }
      : null;

  const master: LayerBMasterChartRecord = {
    schemaVersion: V2_MASTER_SCHEMA_VERSION,
    recalculationVersion: V2_RECALCULATION_VERSION,
    providerId: 'freeastroapi',
    generatedAtUtc: new Date().toISOString(),
    canonicalBirthInstant: instant,
    calculationConventions,
    frames: {
      vedicLahiri,
      kpPlacidus,
      bhavaChalit,
      westernTropical,
      astronomicalTelemetry,
    },
    shadbalaReconciliation,
    referenceDateTiming,
    remainingClassicalGaps: REMAINING_CLASSICAL_GAPS_INVENTORY,
  };
  if (includeLocalModules === false) {
    master.datasetManifest = evaluateDatasetCompleteness(master);
    return master;
  }
  return enrichMasterWithPhase4LocalCalculations(master, {
    preferLocalAshtakavarga,
  });
}

export function buildLayerCAnalyticalShell(
  master: LayerBMasterChartRecord
): LayerCAnalyticalShell {
  return {
    schemaVersion: 'v2.analytical_shell.1.0',
    linkedMasterFingerprint: master.canonicalBirthInstant.inputFingerprint,
    linkedMasterSchemaVersion: master.schemaVersion,
    status: 'deferred_by_scope',
    note: 'Layer C proprietary indices (PHI, YSI, DSI, Ascendant Health, domain matrices) are strictly separated and untouched in this phase.',
    touchedIndices: [],
  };
}
