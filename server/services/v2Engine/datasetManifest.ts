/**
 * Isolated V2 Engine — Definitive Birth Chart Dataset Manifest & Canonical State Guardrails
 *
 * Pure TypeScript (Cloudflare Workers compatible — zero Node built-ins).
 * Enforces:
 * - Six canonical dataset states (available, internally_verified, independently_validated, provisional, incompatible, unavailable)
 * - Strict zero-coercion / empty-success rejection (missing or empty data never masquerades as 0 or valid)
 * - Explicit dependency graphs and downstream Layer C analytical module prerequisite guards
 * - Clear separation of natal_invariant vs. reference_date_dependent datasets
 */

import type {
  CanonicalDatasetState,
  DatasetCompletenessManifest,
  DatasetEnvelope,
  DatasetManifestEntry,
  LayerBMasterChartRecord,
  ManifestReadinessTier,
  TemporalScope,
} from './types';

export const V2_RECALCULATION_VERSION = '2026.11.27-foundational.1';
export const V2_MANIFEST_SCHEMA_VERSION = 'v2.manifest.1.0';

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

function hasFiniteNum(val: unknown): boolean {
  if (val === null || val === undefined || val === '') return false;
  const n = Number(val);
  return Number.isFinite(n);
}

function hasNonEmptyKeys(val: unknown): boolean {
  const obj = asObj(val);
  return obj !== null && Object.keys(obj).length > 0;
}

const SATISFIED_STATES = new Set<CanonicalDatasetState>([
  'available',
  'internally_verified',
  'independently_validated',
]);

export function isDatasetStateSatisfied(state: CanonicalDatasetState): boolean {
  return SATISFIED_STATES.has(state);
}

/**
 * Maps an envelope's verificationStatus / completeness / canonicalStatus into the
 * strict 6-state canonical contract while preserving explicit incompatible/unavailable tags.
 */
export function deriveCanonicalDatasetState<T>(
  envelope: DatasetEnvelope<T> | null | undefined
): CanonicalDatasetState {
  if (!envelope || envelope.data === null || envelope.data === undefined) {
    return 'unavailable';
  }
  if (envelope.canonicalStatus === 'incompatible' || envelope.verificationStatus === 'incompatible') {
    return 'incompatible';
  }
  if (envelope.canonicalStatus === 'unavailable' || envelope.verificationStatus === 'unavailable') {
    return 'unavailable';
  }
  if (
    envelope.canonicalStatus === 'independently_validated' ||
    envelope.verificationStatus === 'independently_validated'
  ) {
    return 'independently_validated';
  }
  if (
    envelope.canonicalStatus === 'internally_verified' ||
    envelope.verificationStatus === 'internally_verified' ||
    envelope.verificationStatus === 'verified_equivalent' ||
    envelope.verificationStatus === 'cached_verified'
  ) {
    return 'internally_verified';
  }
  if (
    envelope.canonicalStatus === 'provisional' ||
    envelope.verificationStatus === 'provisional' ||
    envelope.verificationStatus === 'partial' ||
    envelope.verificationStatus === 'pending_live_reconciliation'
  ) {
    return 'provisional';
  }
  if (
    envelope.canonicalStatus === 'available' ||
    envelope.verificationStatus === 'available' ||
    envelope.verificationStatus === 'verified_provider'
  ) {
    return envelope.completeness === 'partial' ? 'provisional' : 'available';
  }
  return 'provisional';
}

interface ManifestDescriptor {
  key: string;
  label: string;
  tier: ManifestReadinessTier;
  temporalScope: TemporalScope;
  dependencies: string[];
  blockingForDownstream: string[];
  evaluate: (master: LayerBMasterChartRecord) => {
    status: CanonicalDatasetState;
    source: string;
    acquiredAtUtc: string | null;
    version: string;
    referenceDateIso: string | null;
    limitations: string[];
  };
}

const DOWNSTREAM_MODULE_PREREQUISITES: Record<string, string[]> = {
  phi_planetary_health: [
    'canonical_birth_instant',
    'vedic_d1_positions',
    'vedic_d9_navamsa',
    'shadbala_major_6',
    'planetary_dignity_conditions',
    'panchadha_maitri',
    'vimshopaka_bala',
  ],
  ascendant_lagnesh_health: [
    'canonical_birth_instant',
    'vedic_d1_positions',
    'vedic_d9_navamsa',
    'bhavabala',
    'ashtakavarga_bav_sav_prastara',
  ],
  ysi_yoga_strength: [
    'vedic_d1_positions',
    'vedic_d9_navamsa',
    'parashari_yogas_doshas',
    'shadbala_major_6',
  ],
  dsi_dosha_strength: [
    'vedic_d1_positions',
    'vedic_d9_navamsa',
    'parashari_yogas_doshas',
    'bhava_chalit',
  ],
  house_intelligence: [
    'vedic_d1_positions',
    'bhavabala',
    'bhava_chalit',
    'ashtakavarga_bav_sav_prastara',
    'kp_placidus_cusps_sublords',
    'kp_significators',
  ],
  temporal_activation: [
    'canonical_birth_instant',
    'vimshottari_natal_timeline',
    'reference_date_dasha_snapshot',
  ],
};

function buildManifestDescriptors(): ManifestDescriptor[] {
  return [
    // =========================================================================
    // TIER 1 — Minimum Chart Readiness
    // =========================================================================
    {
      key: 'canonical_birth_instant',
      label: 'Canonical Birth Instant & Julian Day UT',
      tier: 'minimum_chart_readiness',
      temporalScope: 'natal_invariant',
      dependencies: [],
      blockingForDownstream: Object.keys(DOWNSTREAM_MODULE_PREREQUISITES),
      evaluate: (m) => {
        const valid =
          Boolean(m.canonicalBirthInstant?.utc?.iso) &&
          hasFiniteNum(m.canonicalBirthInstant?.utc?.julianDayUt) &&
          hasFiniteNum(m.canonicalBirthInstant?.input?.latitude) &&
          hasFiniteNum(m.canonicalBirthInstant?.input?.longitude);
        return {
          status: valid ? 'internally_verified' : 'unavailable',
          source: 'local:birthInstant.resolveCanonicalBirthInstant',
          acquiredAtUtc: m.generatedAtUtc ?? null,
          version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
          referenceDateIso: null,
          limitations: valid ? [] : ['Canonical UTC instant or coordinates missing/invalid.'],
        };
      },
    },
    {
      key: 'vedic_d1_positions',
      label: 'Vedic Lahiri D1 Planetary Positions & Ascendant',
      tier: 'minimum_chart_readiness',
      temporalScope: 'natal_invariant',
      dependencies: ['canonical_birth_instant'],
      blockingForDownstream: [
        'phi_planetary_health',
        'ascendant_lagnesh_health',
        'ysi_yoga_strength',
        'dsi_dosha_strength',
        'house_intelligence',
      ],
      evaluate: (m) => {
        const env = m.frames.vedicLahiri;
        const data = env?.data;
        if (!data) {
          return {
            status: 'unavailable',
            source: env?.source ?? 'unavailable',
            acquiredAtUtc: env?.acquiredAtUtc ?? null,
            version: env?.version ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: env?.limitations ?? ['Vedic D1 frame unavailable.'],
          };
        }
        const ascDeg = data.ascendant?.degree ?? data.ascendant?.absolute_degree;
        const validPlanets = asObjArr(data.planets).filter((p) =>
          hasFiniteNum(p.degree ?? p.absolute_degree)
        );
        // Zero-coercion guardrail: < 9 planets or missing numeric ascendant degree is unavailable
        if (!hasFiniteNum(ascDeg) || validPlanets.length < 9) {
          return {
            status: 'unavailable',
            source: env.source,
            acquiredAtUtc: env.acquiredAtUtc ?? null,
            version: env.version,
            referenceDateIso: null,
            limitations: [
              `Zero-coercion guard rejected incomplete/empty D1 payload (ascValid=${hasFiniteNum(ascDeg)}, validPlanets=${validPlanets.length}/9).`,
            ],
          };
        }
        const envState = deriveCanonicalDatasetState(env);
        return {
          status: envState === 'provisional' ? 'available' : envState,
          source: env.source,
          acquiredAtUtc: env.acquiredAtUtc ?? null,
          version: env.version,
          referenceDateIso: null,
          limitations: [],
        };
      },
    },
    {
      key: 'vedic_d9_navamsa',
      label: 'Vedic D9 Navamsa Chart',
      tier: 'minimum_chart_readiness',
      temporalScope: 'natal_invariant',
      dependencies: ['canonical_birth_instant', 'vedic_d1_positions'],
      blockingForDownstream: [
        'phi_planetary_health',
        'ascendant_lagnesh_health',
        'ysi_yoga_strength',
        'dsi_dosha_strength',
      ],
      evaluate: (m) => {
        const env = m.frames.vedicLahiri;
        const d9 = asObj(env?.data?.vargas?.chartsByDivision?.D9);
        const d9Planets = asObjArr(d9?.planets).filter(
          (p) => typeof p.sign === 'string' && p.sign.trim().length > 0
        );
        const d9AscSign = asObj(d9?.ascendant)?.sign;
        const hasValidD9 =
          d9 !== null &&
          typeof d9AscSign === 'string' &&
          d9AscSign.trim().length > 0 &&
          d9Planets.length >= 2;
        if (!hasValidD9) {
          return {
            status: 'unavailable',
            source: env?.source ?? 'unavailable',
            acquiredAtUtc: env?.acquiredAtUtc ?? null,
            version: env?.version ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: ['D9 Navamsa missing valid ascendant sign or planetary placements.'],
          };
        }
        const status: CanonicalDatasetState =
          d9Planets.length >= 9 ? 'available' : 'provisional';
        return {
          status,
          source: env.source,
          acquiredAtUtc: env.acquiredAtUtc ?? null,
          version: env.version,
          referenceDateIso: null,
          limitations:
            d9Planets.length >= 9
              ? []
              : [`D9 contains ${d9Planets.length}/9 planetary placements.`],
        };
      },
    },
    {
      key: 'vimshottari_natal_timeline',
      label: 'Vimshottari Natal Dasha Timeline & Birth Balance',
      tier: 'minimum_chart_readiness',
      temporalScope: 'natal_invariant',
      dependencies: ['canonical_birth_instant', 'vedic_d1_positions'],
      blockingForDownstream: ['temporal_activation'],
      evaluate: (m) => {
        const env = m.frames.vedicLahiri;
        const vd = asObj(env?.data?.vimshottariDasha);
        const bb = asObj(vd?.birth_balance);
        const mds = asObjArr(vd?.mahadashas);
        const valid =
          vd !== null &&
          typeof bb?.lord === 'string' &&
          bb.lord.trim().length > 0 &&
          hasFiniteNum(bb?.remaining_years) &&
          mds.length > 0;
        return {
          status: valid ? 'available' : 'unavailable',
          source: env?.source ?? 'unavailable',
          acquiredAtUtc: env?.acquiredAtUtc ?? null,
          version: env?.version ?? V2_RECALCULATION_VERSION,
          referenceDateIso: null,
          limitations: valid
            ? []
            : ['Vimshottari birth balance lord/remaining years or mahadasha periods missing.'],
        };
      },
    },
    {
      key: 'astronomical_telemetry',
      label: 'Astronomical Ephemeris Telemetry (Velocities, Declinations, Latitudes)',
      tier: 'minimum_chart_readiness',
      temporalScope: 'natal_invariant',
      dependencies: ['canonical_birth_instant'],
      blockingForDownstream: [],
      evaluate: (m) => {
        const env = m.frames.astronomicalTelemetry;
        const bodiesCount = env?.data ? Object.keys(env.data.bodies || {}).length : 0;
        if (!env?.data || bodiesCount === 0) {
          return {
            status: 'unavailable',
            source: env?.source ?? 'unavailable',
            acquiredAtUtc: env?.acquiredAtUtc ?? null,
            version: env?.version ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: env?.limitations ?? ['Astronomical telemetry bodies empty or missing.'],
          };
        }
        return {
          status: deriveCanonicalDatasetState(env),
          source: env.source,
          acquiredAtUtc: env.acquiredAtUtc ?? null,
          version: env.version,
          referenceDateIso: null,
          limitations: env.limitations,
        };
      },
    },

    // =========================================================================
    // TIER 2 — Comprehensive Foundational Completeness
    // =========================================================================
    {
      key: 'vedic_shodashavarga_16',
      label: 'BPHS 16-Chart Shodashavarga Suite',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['vedic_d1_positions'],
      blockingForDownstream: ['vimshopaka_bala'],
      evaluate: (m) => {
        const env = m.frames.vedicLahiri;
        const vargas = env?.data?.vargas;
        if (!vargas || vargas.supportedCount === 0) {
          return {
            status: 'unavailable',
            source: env?.source ?? 'unavailable',
            acquiredAtUtc: env?.acquiredAtUtc ?? null,
            version: env?.version ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: ['Shodashavarga charts absent.'],
          };
        }
        const status: CanonicalDatasetState =
          vargas.supportedCount >= 16 ? 'available' : 'provisional';
        return {
          status,
          source: env.source,
          acquiredAtUtc: env.acquiredAtUtc ?? null,
          version: env.version,
          referenceDateIso: null,
          limitations:
            vargas.supportedCount >= 16
              ? []
              : [`Only ${vargas.supportedCount}/16 Shodashavarga charts acquired.`],
        };
      },
    },
    {
      key: 'vedic_d5_panchamsha',
      label: 'D5 Panchamsha Divisional Chart (Supplementary)',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['vedic_d1_positions'],
      blockingForDownstream: [],
      evaluate: (m) => {
        const suppD5 = m.supplementaryIntegration?.d5;
        const env = m.frames.vedicLahiri;
        const d5 = asObj(env?.data?.vargas?.chartsByDivision?.D5);

        if (suppD5 && suppD5.recommendedState === 'incompatible') {
          return {
            status: 'incompatible',
            source: 'freeastroapi:/api/v2/vedic/calculate#D5 (rejected)',
            acquiredAtUtc: m.supplementaryIntegration?.acquiredAtUtc ?? null,
            version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: suppD5.reasons,
          };
        }

        if (suppD5 && suppD5.recommendedState === 'provisional') {
          return {
            status: 'provisional',
            source: 'freeastroapi:/api/v2/vedic/calculate#D5 (provisional)',
            acquiredAtUtc: m.supplementaryIntegration?.acquiredAtUtc ?? null,
            version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: suppD5.reasons,
          };
        }

        const valid = d5 !== null && asObjArr(d5.planets).length >= 7;
        if (!valid) {
          return {
            status: 'unavailable',
            source: env?.source ?? 'unavailable',
            acquiredAtUtc: env?.acquiredAtUtc ?? null,
            version: env?.version ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: [
              'D5 Panchamsha not present; queued for validated supplementary acquisition/local verification.',
            ],
          };
        }

        const d5Meta = asObj(d5.metadata);
        const isCalibratedFalse = d5.calibrated === false || d5Meta?.calibrated === false;
        return {
          status: isCalibratedFalse ? 'provisional' : 'available',
          source: typeof d5._source === 'string' ? d5._source : env.source,
          acquiredAtUtc: env?.acquiredAtUtc ?? null,
          version: env?.version ?? V2_RECALCULATION_VERSION,
          referenceDateIso: null,
          limitations: isCalibratedFalse
            ? ['Provider marks D5 calibrated:false; outside canonical BPHS 16-Varga Shodashavarga.']
            : [],
        };
      },
    },
    {
      key: 'nakshatra_sub_divisions',
      label: 'Nakshatra, Pada & Stellar Sub-Lord Divisions',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['vedic_d1_positions'],
      blockingForDownstream: [],
      evaluate: (m) => {
        const env = m.frames.vedicLahiri;
        const kpEnv = m.frames.kpPlacidus;
        const hasKpSubs =
          asObjArr(kpEnv?.data?.planets).filter(
            (p) => typeof p.star_lord === 'string' && p.star_lord.length > 0
          ).length >= 9;
        const kundliNak = asObj(asObj(m.providerExtendedDatasets?.vedicKundli)?.nakshatra);
        const vedicPlanets = asObjArr(env?.data?.planets);
        const validVedic = vedicPlanets.length >= 9 && (kundliNak !== null || hasKpSubs);
        return {
          status: hasKpSubs ? 'available' : validVedic ? 'provisional' : 'unavailable',
          source: hasKpSubs ? kpEnv.source : env?.source ?? 'unavailable',
          acquiredAtUtc: kpEnv?.acquiredAtUtc ?? env?.acquiredAtUtc ?? null,
          version: env?.version ?? V2_RECALCULATION_VERSION,
          referenceDateIso: null,
          limitations: hasKpSubs
            ? []
            : validVedic
            ? ['Full 9-planet KP star/sub-lord stellar breakdown incomplete.']
            : ['Nakshatra & stellar subdivision data unavailable.'],
        };
      },
    },
    {
      key: 'shadbala_major_6',
      label: 'Shadbala 6-Fold Strength Totals & Ratios',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['canonical_birth_instant', 'vedic_d1_positions'],
      blockingForDownstream: ['phi_planetary_health', 'ysi_yoga_strength'],
      evaluate: (m) => {
        const env = m.shadbalaReconciliation;
        const perPlanet = env?.data?.perPlanet ?? [];
        const providerRows = perPlanet.filter(
          (r) => r.provider !== null && hasFiniteNum(r.provider.totalVirupas) && r.provider.totalVirupas > 0
        );
        if (providerRows.length < 7) {
          return {
            status: 'unavailable',
            source: env?.source ?? 'unavailable',
            acquiredAtUtc: env?.acquiredAtUtc ?? null,
            version: env?.version ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: [`Provider Shadbala missing (${providerRows.length}/7 classical planets).`],
          };
        }
        return {
          status: deriveCanonicalDatasetState(env),
          source: env.source,
          acquiredAtUtc: env.acquiredAtUtc ?? null,
          version: env.version,
          referenceDateIso: null,
          limitations: env.limitations,
        };
      },
    },
    {
      key: 'shadbala_subcomponents',
      label: 'Shadbala Detailed Subcomponents (Sthana, Dig, Kala, Cheshta, Naisargika, Drik)',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['shadbala_major_6'],
      blockingForDownstream: [],
      evaluate: (m) => {
        const subs = asObj(m.providerExtendedDatasets?.shadbalaSubcomponents);
        if (!subs) {
          return {
            status: 'unavailable',
            source: 'unavailable',
            acquiredAtUtc: null,
            version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: ['Shadbala subcomponent endpoints not acquired.'],
          };
        }
        const populatedBuckets = Object.entries(subs).filter(([, v]) => {
          const obj = asObj(v);
          if (!obj) return false;
          return asObjArr(obj.items).length > 0 || asObjArr(obj.planets).length > 0;
        });
        if (populatedBuckets.length === 0) {
          return {
            status: 'unavailable',
            source: 'astroway:/vedic/shadbala/*',
            acquiredAtUtc: m.shadbalaReconciliation?.acquiredAtUtc ?? null,
            version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: ['Shadbala subcomponent payloads returned empty item arrays (zero-coercion guard).'],
          };
        }
        return {
          status: populatedBuckets.length >= 6 ? 'available' : 'provisional',
          source: 'astroway:/vedic/shadbala/*',
          acquiredAtUtc: m.shadbalaReconciliation?.acquiredAtUtc ?? null,
          version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
          referenceDateIso: null,
          limitations:
            populatedBuckets.length >= 6
              ? []
              : [`${populatedBuckets.length}/6 Shadbala subcomponent buckets non-empty.`],
        };
      },
    },
    {
      key: 'ishta_kashta_phala',
      label: 'Ishta Phala & Kashta Phala',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['shadbala_major_6'],
      blockingForDownstream: [],
      evaluate: (m) => {
        const ik = asObj(m.providerExtendedDatasets?.ishtaKashtaPhala);
        const items = asObjArr(ik?.items);
        if (!ik || items.length === 0) {
          return {
            status: 'unavailable',
            source: 'unavailable',
            acquiredAtUtc: null,
            version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: ['Ishta & Kashta Phala items absent or empty.'],
          };
        }
        return {
          status: items.length >= 7 ? 'available' : 'provisional',
          source: 'astroway:/vedic/shadbala/ishta-kashta',
          acquiredAtUtc: m.shadbalaReconciliation?.acquiredAtUtc ?? null,
          version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
          referenceDateIso: null,
          limitations:
            items.length >= 7
              ? ['AstroWay OpenAPI marks endpoint x-quality=yellow pending independent reconciliation.']
              : [`Only ${items.length}/7 Ishta/Kashta items returned.`],
        };
      },
    },
    {
      key: 'bhavabala',
      label: 'Bhavabala (House Strength & Bhava Madhya)',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['canonical_birth_instant', 'vedic_d1_positions'],
      blockingForDownstream: ['ascendant_lagnesh_health', 'house_intelligence'],
      evaluate: (m) => {
        const bb = asObj(m.providerExtendedDatasets?.bhavabala);
        const houses = asObjArr(bb?.houses ?? bb?.items);
        if (!bb || houses.length < 12) {
          return {
            status: 'unavailable',
            source: bb ? 'astroway:/vedic/bhavabala' : 'unavailable',
            acquiredAtUtc: null,
            version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: [`Bhavabala missing or empty (${houses.length}/12 houses).`],
          };
        }
        return {
          status: 'provisional',
          source: 'astroway:/vedic/bhavabala',
          acquiredAtUtc: m.frames.vedicLahiri?.acquiredAtUtc ?? null,
          version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
          referenceDateIso: null,
          limitations: ['AstroWay OpenAPI marks /vedic/bhavabala x-quality=yellow pending independent validation.'],
        };
      },
    },
    {
      key: 'planetary_dignity_conditions',
      label: 'Planetary Dignity, Combustion & Essential Conditions',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['vedic_d1_positions'],
      blockingForDownstream: ['phi_planetary_health'],
      evaluate: (m) => {
        const planets = asObjArr(m.frames.vedicLahiri?.data?.planets);
        const condExt = asObj(m.providerExtendedDatasets?.planetaryConditions);
        const hasVedicDignity =
          planets.length >= 9 &&
          (planets.some(
            (p) =>
              (typeof p.dignity === 'string' && p.dignity.trim().length > 0) ||
              (typeof p.avastha === 'string' && p.avastha.trim().length > 0) ||
              typeof p.is_combust === 'boolean'
          ) ||
            condExt?.hasAnyVedicCondition === true);
        const hasWesternDignities =
          hasNonEmptyKeys(asObj(m.providerExtendedDatasets?.westernAndHellenistic)?.essentialDignities) ||
          hasNonEmptyKeys(asObj(m.frames.westernTropical?.data?.tables)?.essentialDignities) ||
          condExt?.hasWesternEssentialDignities === true;
        if (!hasVedicDignity && !hasWesternDignities) {
          return {
            status: 'unavailable',
            source: 'unavailable',
            acquiredAtUtc: null,
            version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: ['Explicit Vedic planetary dignity/combustion/avastha tags absent on provider D1 payload.'],
          };
        }
        return {
          status: hasVedicDignity ? 'available' : 'provisional',
          source: m.frames.vedicLahiri.source,
          acquiredAtUtc: m.frames.vedicLahiri?.acquiredAtUtc ?? null,
          version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
          referenceDateIso: null,
          limitations: hasVedicDignity
            ? []
            : ['Only Western essential dignities present; Vedic dignity matrix awaits deterministic/local derivation.'],
        };
      },
    },
    {
      key: 'ashtakavarga_bav_sav_prastara',
      label: 'Ashtakavarga (BAV, SAV & Prastara Matrices)',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['vedic_d1_positions'],
      blockingForDownstream: ['ascendant_lagnesh_health', 'house_intelligence'],
      evaluate: (m) => {
        const env = m.frames.vedicLahiri;
        const av = env?.data?.ashtakavarga;
        if (!av) {
          const suppAv = m.supplementaryIntegration?.ashtakavarga;
          if (suppAv && suppAv.recommendedState === 'incompatible') {
            return {
              status: 'incompatible',
              source: 'freeastroapi:/api/v2/vedic/calculate#ashtakavarga (rejected)',
              acquiredAtUtc: m.supplementaryIntegration?.acquiredAtUtc ?? null,
              version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
              referenceDateIso: null,
              limitations: suppAv.reasons,
            };
          }
          return {
            status: 'unavailable',
            source: env?.source ?? 'unavailable',
            acquiredAtUtc: env?.acquiredAtUtc ?? null,
            version: env?.version ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: ['Ashtakavarga absent.'],
          };
        }
        const sav = Array.isArray(av.sarvashtakavarga) ? av.sarvashtakavarga : [];
        const bavKeys = Object.keys(av.bhinnashtakavarga || {});
        const prastaraKeys = Object.keys(av.prastharashtakavarga || {});
        // Zero-coercion guardrail: totalPoints <= 0 or empty SAV/BAV is NOT available
        if (av.totalPoints <= 0 || sav.length !== 12 || bavKeys.length < 7) {
          return {
            status: 'unavailable',
            source: env.source,
            acquiredAtUtc: env.acquiredAtUtc ?? null,
            version: env.version,
            referenceDateIso: null,
            limitations: [
              `Zero-coercion guard rejected empty/invalid Ashtakavarga (totalPoints=${av.totalPoints}, savLen=${sav.length}, bavCount=${bavKeys.length}).`,
            ],
          };
        }
        const savSum = sav.reduce((a, b) => a + Number(b || 0), 0);
        if (savSum !== 337 || av.totalPoints !== 337) {
          return {
            status: 'incompatible',
            source: env.source,
            acquiredAtUtc: env.acquiredAtUtc ?? null,
            version: env.version,
            referenceDateIso: null,
            limitations: [`Ashtakavarga SAV total (${savSum}/${av.totalPoints}) failed 337-bindu classical invariant.`],
          };
        }
        const suppAv = m.supplementaryIntegration?.ashtakavarga;
        if (suppAv && suppAv.outcome === 'accepted') {
          return {
            status: suppAv.recommendedState,
            source: 'freeastroapi:/api/v2/vedic/calculate#ashtakavarga (supplementary)',
            acquiredAtUtc: m.supplementaryIntegration?.acquiredAtUtc ?? env.acquiredAtUtc ?? null,
            version: env.version,
            referenceDateIso: null,
            limitations:
              prastaraKeys.length >= 7
                ? []
                : [`Prastara contributor matrices incomplete (${prastaraKeys.length}/7 planets).`],
          };
        }
        return {
          status: prastaraKeys.length >= 7 ? 'available' : 'provisional',
          source: env.source,
          acquiredAtUtc: env.acquiredAtUtc ?? null,
          version: env.version,
          referenceDateIso: null,
          limitations:
            prastaraKeys.length >= 7
              ? []
              : [`Prastara contributor matrices incomplete (${prastaraKeys.length}/7 planets).`],
        };
      },
    },
    {
      key: 'ashtakavarga_shodhana_pinda',
      label: 'Ashtakavarga Trikona/Ekadhipati Shodhana & Shodhya Pinda',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['ashtakavarga_bav_sav_prastara'],
      blockingForDownstream: [],
      evaluate: (m) => {
        const shodhana = asObj(m.providerExtendedDatasets?.ashtakavargaShodhana);
        const hasShodhanaContent =
          shodhana !== null &&
          (shodhana.hasTrikona === true ||
            shodhana.hasEkadhipatya === true ||
            shodhana.hasPinda === true ||
            asObjArr(shodhana.planets ?? shodhana.items).length > 0);
        if (!hasShodhanaContent) {
          return {
            status: 'unavailable',
            source: 'unavailable',
            acquiredAtUtc: null,
            version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: ['Ashtakavarga Shodhana & Pinda unavailable.'],
          };
        }
        return {
          status: 'available',
          source: 'astroway:/vedic/ashtakavarga/shodhana',
          acquiredAtUtc: m.frames.vedicLahiri?.acquiredAtUtc ?? null,
          version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
          referenceDateIso: null,
          limitations: [],
        };
      },
    },
    {
      key: 'bhava_chalit',
      label: 'Bhava Chalit (Sripati Midpoint / Sandhi Boundaries)',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['canonical_birth_instant', 'vedic_d1_positions'],
      blockingForDownstream: ['dsi_dosha_strength', 'house_intelligence'],
      evaluate: (m) => {
        const env = m.frames.bhavaChalit;
        if (env?.canonicalStatus === 'incompatible') {
          return {
            status: 'incompatible',
            source: env.source,
            acquiredAtUtc: env.acquiredAtUtc ?? null,
            version: env.version,
            referenceDateIso: null,
            limitations:
              env.limitations?.length > 0
                ? env.limitations
                : env.data?.methodologyAudit?.notes ?? ['Bhava Chalit marked incompatible.'],
          };
        }
        if (!env?.data || asObjArr(env.data.houses).length !== 12) {
          return {
            status: 'unavailable',
            source: env?.source ?? 'unavailable',
            acquiredAtUtc: env?.acquiredAtUtc ?? null,
            version: env?.version ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: env?.limitations ?? ['Bhava Chalit frame unavailable.'],
          };
        }
        if (env.data.methodologyAudit && !env.data.methodologyAudit.compatibleWithIntendedClassicalMethodology) {
          return {
            status: 'incompatible',
            source: env.source,
            acquiredAtUtc: env.acquiredAtUtc ?? null,
            version: env.version,
            referenceDateIso: null,
            limitations: env.data.methodologyAudit.notes,
          };
        }
        return {
          status: deriveCanonicalDatasetState(env),
          source: env.source,
          acquiredAtUtc: env.acquiredAtUtc ?? null,
          version: env.version,
          referenceDateIso: null,
          limitations: env.limitations,
        };
      },
    },
    {
      key: 'parashari_yogas_doshas',
      label: 'Parashari & Jaimini Yogas + Doshas',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['vedic_d1_positions'],
      blockingForDownstream: ['ysi_yoga_strength', 'dsi_dosha_strength'],
      evaluate: (m) => {
        const yogas = m.frames.vedicLahiri?.data?.yogas;
        const ydExt = asObj(m.providerExtendedDatasets?.yogasAndDoshas);
        const hasYogas = yogas !== null && yogas !== undefined;
        const hasDoshas = hasNonEmptyKeys(ydExt?.doshasParashara) || hasNonEmptyKeys(ydExt?.doshasKp);
        if (!hasYogas && !hasDoshas) {
          return {
            status: 'unavailable',
            source: 'unavailable',
            acquiredAtUtc: null,
            version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: ['Yoga and Dosha evaluations unavailable.'],
          };
        }
        return {
          status: hasYogas && hasDoshas ? 'available' : 'provisional',
          source: m.frames.vedicLahiri.source,
          acquiredAtUtc: m.frames.vedicLahiri?.acquiredAtUtc ?? null,
          version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
          referenceDateIso: null,
          limitations: hasDoshas ? [] : ['Dosha evaluation absent; only Yogas present.'],
        };
      },
    },
    {
      key: 'jaimini_karakas_arudhas_argala',
      label: 'Jaimini Suite (Karakas, Arudhas, Upapada, Argala, Aspects)',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['vedic_d1_positions', 'vedic_d9_navamsa'],
      blockingForDownstream: [],
      evaluate: (m) => {
        const j = asObj(m.providerExtendedDatasets?.jaimini);
        if (!j) {
          return {
            status: 'unavailable',
            source: 'unavailable',
            acquiredAtUtc: null,
            version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: ['Jaimini datasets unavailable.'],
          };
        }
        const jaiminiKeys = [
          'karakas',
          'charaKarakas',
          'padas',
          'upapada',
          'aspects',
          'drishtiRasi',
          'drishtiGraha',
          'atmakarakaNavamsa',
          'argalaAnalysis',
          'yogas',
        ];
        const populated = jaiminiKeys.filter((k) => {
          const bucket = asObj(j[k]);
          if (!bucket) return false;
          const keys = Object.keys(bucket);
          if (keys.length === 0) return false;
          // Reject wrapper-only empty arrays like { items: [] }
          if (keys.every((bk) => Array.isArray(bucket[bk]) && (bucket[bk] as unknown[]).length === 0)) {
            return false;
          }
          return true;
        }).length;
        if (populated === 0) {
          return {
            status: 'unavailable',
            source: 'astroway:/vedic/jaimini/*',
            acquiredAtUtc: null,
            version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: ['All Jaimini endpoint buckets returned null/empty.'],
          };
        }
        return {
          status: populated >= 6 ? 'available' : 'provisional',
          source: 'astroway:/vedic/jaimini/*',
          acquiredAtUtc: m.frames.vedicLahiri?.acquiredAtUtc ?? null,
          version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
          referenceDateIso: null,
          limitations:
            populated >= 6 ? [] : [`Only ${populated}/10 Jaimini dataset buckets populated.`],
        };
      },
    },
    {
      key: 'kp_placidus_cusps_sublords',
      label: 'KP Placidus Cusps & Stellar Sub-Lords',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['canonical_birth_instant'],
      blockingForDownstream: ['kp_significators', 'house_intelligence'],
      evaluate: (m) => {
        const env = m.frames.kpPlacidus;
        const valid =
          env?.data !== null &&
          asObjArr(env?.data?.cusps).length === 12 &&
          asObjArr(env?.data?.planets).length >= 9;
        if (!valid) {
          return {
            status: 'unavailable',
            source: env?.source ?? 'unavailable',
            acquiredAtUtc: env?.acquiredAtUtc ?? null,
            version: env?.version ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: env?.limitations ?? ['KP Placidus cusps/planets unavailable or incomplete.'],
          };
        }
        return {
          status: deriveCanonicalDatasetState(env),
          source: env.source,
          acquiredAtUtc: env.acquiredAtUtc ?? null,
          version: env.version,
          referenceDateIso: null,
          limitations: env.limitations,
        };
      },
    },
    {
      key: 'kp_significators',
      label: 'KP 4-Level Planet & House Significators',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['kp_placidus_cusps_sublords'],
      blockingForDownstream: ['house_intelligence'],
      evaluate: (m) => {
        const env = m.frames.kpPlacidus;
        const pSigs = asObjArr(env?.data?.planetSignificators);
        const hSigs = asObjArr(env?.data?.houseSignificators);
        const valid = pSigs.length >= 9 && hSigs.length === 12;
        return {
          status: valid ? 'available' : pSigs.length > 0 ? 'provisional' : 'unavailable',
          source: env?.source ?? 'unavailable',
          acquiredAtUtc: env?.acquiredAtUtc ?? null,
          version: env?.version ?? V2_RECALCULATION_VERSION,
          referenceDateIso: null,
          limitations: valid
            ? []
            : [`KP 4-level significators incomplete (planets=${pSigs.length}, houses=${hSigs.length}).`],
        };
      },
    },
    {
      key: 'alternative_dashas_natal',
      label: 'Alternative Dasha Systems (Chara, Yogini, Ashtottari, Kalachakra, Tribhagi)',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['canonical_birth_instant', 'vedic_d1_positions'],
      blockingForDownstream: [],
      evaluate: (m) => {
        const adv = asObj(m.providerExtendedDatasets?.advancedDashas);
        if (!adv) {
          return {
            status: 'unavailable',
            source: 'unavailable',
            acquiredAtUtc: null,
            version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: ['Alternative Dasha datasets unavailable.'],
          };
        }
        const keys = ['charaMaha', 'yoginiMaha', 'ashtottariMaha', 'kalachakraMaha', 'tribhagiMaha'];
        const hasPopulatedPeriods = (val: unknown): boolean => {
          const obj = asObj(val);
          if (!obj) return false;
          const nt = asObj(obj.natalTimeline);
          if (nt) {
            return asObjArr(nt.periods).length > 0;
          }
          return asObjArr(obj.periods ?? obj.mahadashas ?? obj.cycles ?? obj.items).length > 0;
        };
        const count = keys.filter((k) => hasPopulatedPeriods(adv[k])).length;
        if (count === 0) {
          return {
            status: 'unavailable',
            source: 'astroway:/vedic/dashas/*',
            acquiredAtUtc: null,
            version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: ['No alternative Dasha timelines acquired (empty or absent periods).'],
          };
        }
        return {
          status: count === keys.length ? 'available' : 'provisional',
          source: 'astroway:/vedic/dashas/*',
          acquiredAtUtc: m.frames.vedicLahiri?.acquiredAtUtc ?? null,
          version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
          referenceDateIso: null,
          limitations:
            count === keys.length ? [] : [`${count}/${keys.length} alternative Dasha systems populated.`],
        };
      },
    },
    {
      key: 'natal_panchang',
      label: 'Natal Panchang (Tithi, Vara, Nakshatra, Yoga, Karana, Sunrise/Sunset)',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['canonical_birth_instant', 'vedic_d1_positions'],
      blockingForDownstream: [],
      evaluate: (m) => {
        const env = m.frames.vedicLahiri;
        const p = env?.data?.panchang;
        const valid = hasNonEmptyKeys(p);
        return {
          status: valid ? 'available' : 'unavailable',
          source: env?.source ?? 'unavailable',
          acquiredAtUtc: env?.acquiredAtUtc ?? null,
          version: env?.version ?? V2_RECALCULATION_VERSION,
          referenceDateIso: null,
          limitations: valid ? [] : ['Natal Panchang data unavailable.'],
        };
      },
    },
    {
      key: 'upagrahas_aprakasha',
      label: 'Upagrahas & Aprakasha Grahas (Gulika, Mandi, Dhuma, etc.)',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['canonical_birth_instant', 'vedic_d1_positions'],
      blockingForDownstream: [],
      evaluate: (m) => {
        const up = m.providerExtendedDatasets?.upagrahas;
        const valid = hasNonEmptyKeys(up);
        return {
          status: valid ? 'available' : 'unavailable',
          source: valid ? 'astroway:/vedic/upagrahas' : 'unavailable',
          acquiredAtUtc: valid ? m.frames.vedicLahiri?.acquiredAtUtc ?? null : null,
          version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
          referenceDateIso: null,
          limitations: valid ? [] : ['Upagraha dataset unavailable.'],
        };
      },
    },
    {
      key: 'panchadha_maitri',
      label: 'Panchadha Maitri (Five-Fold Compound Planetary Friendship)',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['vedic_d1_positions'],
      blockingForDownstream: ['phi_planetary_health'],
      evaluate: (m) => {
        const pm = m.providerExtendedDatasets?.panchadhaMaitri;
        const valid = hasNonEmptyKeys(pm);
        return {
          status: valid ? 'internally_verified' : 'unavailable',
          source: valid ? 'local:panchadhaMaitri' : 'unavailable',
          acquiredAtUtc: valid ? m.generatedAtUtc ?? null : null,
          version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
          referenceDateIso: null,
          limitations: valid
            ? []
            : ['Panchadha Maitri absent in AstroWay/FreeAstroAPI; scheduled for deterministic local BPHS implementation.'],
        };
      },
    },
    {
      key: 'vimshopaka_bala',
      label: 'Vimshopaka Bala (Shadvarga / Saptavarga / Dashavarga / Shodashavarga)',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['vedic_shodashavarga_16'],
      blockingForDownstream: ['phi_planetary_health'],
      evaluate: (m) => {
        const vb = m.providerExtendedDatasets?.vimshopakaBala;
        const valid = hasNonEmptyKeys(vb);
        return {
          status: valid ? 'internally_verified' : 'unavailable',
          source: valid ? 'local:vimshopakaBala' : 'unavailable',
          acquiredAtUtc: valid ? m.generatedAtUtc ?? null : null,
          version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
          referenceDateIso: null,
          limitations: valid
            ? []
            : ['Vimshopaka Bala absent in AstroWay/FreeAstroAPI; scheduled for deterministic local implementation.'],
        };
      },
    },
    {
      key: 'dispositor_relationships',
      label: 'Natal Dispositor & Mutual Exchange Relationships',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['vedic_d1_positions'],
      blockingForDownstream: [],
      evaluate: (m) => {
        const disp = m.providerExtendedDatasets?.dispositorRelationships;
        const valid = hasNonEmptyKeys(disp);
        return {
          status: valid ? 'internally_verified' : 'unavailable',
          source: valid ? 'local:dispositorGraph' : 'unavailable',
          acquiredAtUtc: valid ? m.generatedAtUtc ?? null : null,
          version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
          referenceDateIso: null,
          limitations: valid
            ? []
            : ['Dispositor graph awaiting Phase 4 deterministic local derivation.'],
        };
      },
    },
    {
      key: 'western_tropical_natal',
      label: 'Western Tropical Natal Chart & Essential Dignities',
      tier: 'comprehensive_foundational_completeness',
      temporalScope: 'natal_invariant',
      dependencies: ['canonical_birth_instant'],
      blockingForDownstream: [],
      evaluate: (m) => {
        const env = m.frames.westernTropical;
        const valid =
          env?.data !== null &&
          asObjArr(env?.data?.planets).length >= 10 &&
          asObjArr(env?.data?.houses).length === 12;
        if (!valid) {
          return {
            status: 'unavailable',
            source: env?.source ?? 'unavailable',
            acquiredAtUtc: env?.acquiredAtUtc ?? null,
            version: env?.version ?? V2_RECALCULATION_VERSION,
            referenceDateIso: null,
            limitations: env?.limitations ?? ['Western Tropical chart unavailable or incomplete.'],
          };
        }
        return {
          status: deriveCanonicalDatasetState(env),
          source: env.source,
          acquiredAtUtc: env.acquiredAtUtc ?? null,
          version: env.version,
          referenceDateIso: null,
          limitations: env.limitations,
        };
      },
    },

    // =========================================================================
    // TIER 3 — Specialized / On-Demand / Reference-Date Dependent
    // =========================================================================
    {
      key: 'reference_date_dasha_snapshot',
      label: 'Reference-Date Active Dasha Snapshot',
      tier: 'specialized_on_demand',
      temporalScope: 'reference_date_dependent',
      dependencies: ['canonical_birth_instant', 'vimshottari_natal_timeline'],
      blockingForDownstream: ['temporal_activation'],
      evaluate: (m) => {
        const snap = m.referenceDateTiming;
        const hasActive =
          snap !== null &&
          snap !== undefined &&
          Boolean(snap.referenceDateIso) &&
          (hasNonEmptyKeys(snap.activeVimshottari) || hasNonEmptyKeys(snap.activeAlternativeDashas));
        return {
          status: hasActive ? 'available' : 'unavailable',
          source: hasActive ? `${m.providerId ?? 'provider'}:reference_date_dasha` : 'unavailable',
          acquiredAtUtc: m.generatedAtUtc ?? null,
          version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
          referenceDateIso: snap?.referenceDateIso ?? null,
          limitations: hasActive
            ? snap?.limitations ?? []
            : ['No reference-date active Dasha snapshot present (natal-only acquisition or date omitted).'],
        };
      },
    },
    {
      key: 'kp_ruling_planets_snapshot',
      label: 'KP Ruling Planets (Reference-Instant Snapshot)',
      tier: 'specialized_on_demand',
      temporalScope: 'reference_date_dependent',
      dependencies: ['canonical_birth_instant', 'kp_placidus_cusps_sublords'],
      blockingForDownstream: [],
      evaluate: (m) => {
        const snap = m.referenceDateTiming;
        const rp = snap?.kpRulingPlanets ?? m.frames.kpPlacidus?.data?.rulingPlanets ?? null;
        const valid = hasNonEmptyKeys(rp);
        return {
          status: valid ? 'available' : 'unavailable',
          source: valid ? m.frames.kpPlacidus.source : 'unavailable',
          acquiredAtUtc: m.frames.kpPlacidus?.acquiredAtUtc ?? null,
          version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
          referenceDateIso: snap?.referenceDateIso ?? null,
          limitations: valid ? [] : ['KP Ruling Planets snapshot unavailable.'],
        };
      },
    },
    {
      key: 'western_profections_snapshot',
      label: 'Western / Hellenistic Annual Profections (Reference-Date Snapshot)',
      tier: 'specialized_on_demand',
      temporalScope: 'reference_date_dependent',
      dependencies: ['canonical_birth_instant', 'western_tropical_natal'],
      blockingForDownstream: [],
      evaluate: (m) => {
        const snap = m.referenceDateTiming;
        const prof = snap?.westernProfections ?? null;
        const valid = hasNonEmptyKeys(prof) && Boolean(snap?.referenceDateIso);
        return {
          status: valid ? 'available' : 'unavailable',
          source: valid ? 'astroway:/western/profections + /hellenistic/*' : 'unavailable',
          acquiredAtUtc: m.frames.westernTropical?.acquiredAtUtc ?? null,
          version: m.recalculationVersion ?? V2_RECALCULATION_VERSION,
          referenceDateIso: snap?.referenceDateIso ?? null,
          limitations: valid ? [] : ['Annual profections reference-date snapshot unavailable.'],
        };
      },
    },
  ];
}

export function evaluateDatasetCompleteness(
  master: LayerBMasterChartRecord
): DatasetCompletenessManifest {
  const descriptors = buildManifestDescriptors();
  const statusByKey = new Map<string, CanonicalDatasetState>();
  const rawEvaluations = descriptors.map((desc) => {
    const evalRes = desc.evaluate(master);
    statusByKey.set(desc.key, evalRes.status);
    return { desc, evalRes };
  });

  const entries: DatasetManifestEntry[] = rawEvaluations.map(({ desc, evalRes }) => {
    const missingDependencies = desc.dependencies.filter(
      (depKey) => !isDatasetStateSatisfied(statusByKey.get(depKey) ?? 'unavailable')
    );
    return {
      key: desc.key,
      label: desc.label,
      tier: desc.tier,
      temporalScope: desc.temporalScope,
      referenceDateIso: evalRes.referenceDateIso,
      canonicalStatus: evalRes.status,
      source: evalRes.source,
      acquiredAtUtc: evalRes.acquiredAtUtc,
      version: evalRes.version,
      dependencies: desc.dependencies,
      missingDependencies,
      blockingForDownstream: desc.blockingForDownstream,
      limitations: evalRes.limitations,
    };
  });

  const countsByStatus: Record<CanonicalDatasetState, number> = {
    available: 0,
    internally_verified: 0,
    independently_validated: 0,
    provisional: 0,
    incompatible: 0,
    unavailable: 0,
  };
  for (const entry of entries) {
    countsByStatus[entry.canonicalStatus] += 1;
  }

  const tier1 = entries.filter((e) => e.tier === 'minimum_chart_readiness');
  const tier1Missing = tier1
    .filter((e) => !isDatasetStateSatisfied(e.canonicalStatus))
    .map((e) => e.key);

  const tier2 = entries.filter((e) => e.tier === 'comprehensive_foundational_completeness');
  const tier2Satisfied = tier2.filter((e) => isDatasetStateSatisfied(e.canonicalStatus)).length;
  const tier2Missing = tier2
    .filter((e) => !isDatasetStateSatisfied(e.canonicalStatus))
    .map((e) => e.key);

  const tier3 = entries.filter((e) => e.tier === 'specialized_on_demand');
  const tier3Available = tier3.filter((e) => isDatasetStateSatisfied(e.canonicalStatus)).length;

  const downstreamGuardSummary: DatasetCompletenessManifest['downstreamGuardSummary'] = {};
  for (const [moduleName, prereqs] of Object.entries(DOWNSTREAM_MODULE_PREREQUISITES)) {
    const missingPrerequisites = prereqs.filter(
      (key) => !isDatasetStateSatisfied(statusByKey.get(key) ?? 'unavailable')
    );
    downstreamGuardSummary[moduleName] = {
      ready: missingPrerequisites.length === 0,
      missingPrerequisites,
    };
  }

  return {
    schemaVersion: V2_MANIFEST_SCHEMA_VERSION,
    evaluatedAtUtc: new Date().toISOString(),
    inputFingerprint: master.canonicalBirthInstant.inputFingerprint,
    minimumChartReadiness: {
      ready: tier1Missing.length === 0,
      satisfiedCount: tier1.length - tier1Missing.length,
      totalCount: tier1.length,
      missingKeys: tier1Missing,
    },
    comprehensiveFoundationalCompleteness: {
      ready: tier2Missing.length === 0,
      satisfiedCount: tier2Satisfied,
      totalCount: tier2.length,
      completenessRatio:
        tier2.length > 0 ? Number((tier2Satisfied / tier2.length).toFixed(4)) : 0,
      missingOrUnresolvedKeys: tier2Missing,
    },
    specializedOnDemand: {
      availableCount: tier3Available,
      totalCount: tier3.length,
      referenceDateIso: master.referenceDateTiming?.referenceDateIso ?? null,
    },
    countsByStatus,
    entries,
    downstreamGuardSummary,
  };
}
