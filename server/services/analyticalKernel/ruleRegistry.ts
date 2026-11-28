/**
 * CosmicCouncil Proprietary Analytical Intelligence Kernel — K02 Analytical Rule & Math Model Registry
 *
 * Pure TypeScript / Web-standard implementation (zero Node built-ins; Cloudflare Workers safe).
 * Enforces explicit registration, classical/astronomical citations, applicability boundaries,
 * mathematical model specifications, and zero unregistered/ad-hoc rule execution.
 */

import {
  ANALYTICAL_RULE_REGISTRY_VERSION,
  PLANETARY_STATE_SUBJECTS,
  UnregisteredMathModelError,
  UnregisteredRuleError,
  type AnalyticalRuleDefinition,
  type AnalyticalRuleRegistrySnapshot,
  type PlanetaryStateSubjectName,
} from './types';
import { exportR04RuleRegistrySnapshot } from './r04AuthorityRegistry';

export { UnregisteredMathModelError, UnregisteredRuleError };

const CLASSICAL_SEVEN: PlanetaryStateSubjectName[] = [
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
];

const ALL_NINE_GRAHAS: PlanetaryStateSubjectName[] = [
  ...CLASSICAL_SEVEN,
  'Rahu',
  'Ketu',
];

const SUN_EXCLUDED_CLASSICAL_PLANETS: PlanetaryStateSubjectName[] = [
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
];

const TARA_GRAHAS: PlanetaryStateSubjectName[] = [
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
];

const NODES_ONLY: PlanetaryStateSubjectName[] = ['Rahu', 'Ketu'];
const ASCENDANT_ONLY: PlanetaryStateSubjectName[] = ['Ascendant'];
const ALL_TEN: PlanetaryStateSubjectName[] = [...PLANETARY_STATE_SUBJECTS];

export const BPHS_SHADBALA_MIN_RUPAS: Readonly<Record<string, number>> = Object.freeze({
  Sun: 6.5,
  Moon: 6.0,
  Mars: 5.0,
  Mercury: 7.0,
  Jupiter: 6.5,
  Venus: 5.5,
  Saturn: 5.0,
});

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const val of Object.values(obj as Record<string, unknown>)) {
      deepFreeze(val);
    }
  }
  return obj;
}

const RAW_K02_RULES: AnalyticalRuleDefinition[] = [
  {
    ruleId: 'K02_CAPACITY_SHADBALA_RUPA_RATIO',
    version: '1.0.0',
    title: 'Shadbala Total Rupas to Classical BPHS Minimum Threshold Ratio',
    layer: 'K02',
    tradition: 'vedic_parashari',
    targetDimension: 'capacity',
    targetScope: 'classical_seven_planets',
    applicableSubjects: [...CLASSICAL_SEVEN],
    requiredFrames: ['vedic_lahiri'],
    requiredObservationCodes: ['SHADBALA_MAJOR_SIX_BALA'],
    optionalObservationCodes: ['SHADBALA_SUBCOMPONENT_BUCKET'],
    citation: {
      sourceType: 'classical',
      referenceCode: 'BPHS_CH27_SHADBALA_MINIMUMS',
      text: 'Brihat Parashara Hora Shastra Ch. 27 (Shadbala Minimum Rupa Thresholds: Sun 6.5, Moon 6.0, Mars 5.0, Mercury 7.0, Jupiter 6.5, Venus 5.5, Saturn 5.0)',
    },
    applicabilityBoundaries: [
      'Strictly applicable ONLY to the 7 classical luminaries and tara grahas (Sun..Saturn).',
      'Strictly NOT applicable to Rahu, Ketu, or Ascendant — never fabricate or extrapolate Shadbala for nodes or Lagna.',
      'Subcomponents (Sthana/Dig/Kala/Chesta/Naisargika/Drik) share partial mathematical overlap with Total Rupas and must not be double-counted.',
    ],
    provisionalPolicy: 'accept_with_provisional_cap',
    overlapHandlingPolicy:
      'Use SHADBALA_MAJOR_SIX_BALA total_rupas as primary ratio input; mark subcomponents as partial_mathematical_overlap.',
    excludedK03ToK08Concerns: [
      'House lordship authority (K03)',
      'Dasha phala / Gochar modulation (K06)',
      'Proprietary composite PHI weighting',
    ],
    mathModel: {
      modelId: 'shadbala_bphs_rupa_ratio',
      modelType: 'threshold_ratio',
      inputUnit: 'rupas',
      outputUnit: 'bphs_threshold_ratio',
      parameters: {
        minimumRupasByPlanet: { ...BPHS_SHADBALA_MIN_RUPAS },
        sufficientThresholdRatio: 1.0,
        highThresholdRatio: 1.25,
        deficientThresholdRatio: 0.85,
      },
      normalizationBounds: { min: 0, max: 3.0 },
      nullOrZeroBehavior:
        'If total_rupas is null, non-finite, or <= 0, return invalid/blocked_missing_inputs rather than fabricating a default ratio.',
      formulaSummary: 'ratio = clamp(total_rupas / bphs_min_rupas(planet), 0, 3.0)',
    },
  },
  {
    ruleId: 'K02_CAPACITY_BAV_STRENGTH',
    version: '1.0.0',
    title: 'Bhinnashtakavarga (BAV) Natal Sign Bindu Deviation from Midpoint 4',
    layer: 'K02',
    tradition: 'vedic_ashtakavarga',
    targetDimension: 'capacity',
    targetScope: 'classical_seven_planets',
    applicableSubjects: [...CLASSICAL_SEVEN],
    requiredFrames: ['vedic_lahiri'],
    requiredObservationCodes: ['ASHTAKAVARGA_BHINNA_BAV'],
    optionalObservationCodes: ['ASHTAKAVARGA_PRASTARA', 'ASHTAKAVARGA_SHODHANA_PINDA'],
    citation: {
      sourceType: 'classical',
      referenceCode: 'BPHS_ASHTAKAVARGA_BAV',
      text: 'Brihat Parashara Hora Shastra Ashtakavarga Adhyaya (0-8 Bindu Scale; 4 Bindus Neutral Midpoint)',
    },
    applicabilityBoundaries: [
      'Strictly applicable ONLY to the 7 classical planets (Sun..Saturn) in their natal D1 sign.',
      'Rahu, Ketu, and Ascendant do not possess standard Parashari BAV tables.',
      'Prastara rows and Shodhana Pindas overlap mathematically with BAV bindus and must be tracked without double-counting.',
    ],
    provisionalPolicy: 'accept_with_provisional_cap',
    overlapHandlingPolicy:
      'Use ASHTAKAVARGA_BHINNA_BAV natal sign bindus as primary signal; link Prastara/SAV/Pinda via partial_mathematical_overlap.',
    excludedK03ToK08Concerns: [
      'Transit Kakshya / Gochar bindu triggering (K06/K09)',
      'Contextual house authority & relational signification weighting (K03/K04)',
    ],
    mathModel: {
      modelId: 'bav_midpoint_4_deviation',
      modelType: 'bounded_linear_deviation',
      inputUnit: 'bindus',
      outputUnit: 'normalized_deviation',
      parameters: {
        minBindus: 0,
        maxBindus: 8,
        neutralMidpoint: 4,
      },
      normalizationBounds: { min: -1, max: 1 },
      nullOrZeroBehavior:
        '0 bindus is mathematically valid (-1.0 deviation); null or non-finite returns invalid/missing.',
      formulaSummary: 'deviation = clamp((bindus - 4) / 4, -1, 1)',
    },
  },
  {
    ruleId: 'K02_CAPACITY_VIMSHOPAKA_TIER',
    version: '1.0.0',
    title: 'Vimshopaka Bala 20-Point Divisional Strength Ratio & Classical Tier',
    layer: 'K02',
    tradition: 'vedic_parashari',
    targetDimension: 'capacity',
    targetScope: 'classical_seven_planets',
    applicableSubjects: [...CLASSICAL_SEVEN],
    requiredFrames: ['vedic_lahiri'],
    requiredObservationCodes: ['VIMSHOPAKA_BALA_SCHEME'],
    optionalObservationCodes: [],
    citation: {
      sourceType: 'classical',
      referenceCode: 'BPHS_CH7_VIMSHOPAKA',
      text: 'Brihat Parashara Hora Shastra Varga Vimshopaka Bala (20-Point Scale; Shodashvarga / Dashavarga / Shadvarga / Saptavarga)',
    },
    applicabilityBoundaries: [
      'Prefer Shodashvarga scheme when multiple Vimshopaka schemes are present to prevent cross-scheme double-counting.',
      'Applicable cleanly to the 7 classical planets.',
    ],
    provisionalPolicy: 'accept_with_provisional_cap',
    overlapHandlingPolicy:
      'Treat multiple Vimshopaka schemes (Shadvarga, Saptavarga, Dashavarga, Shodashvarga) as partial_mathematical_overlap; select Shodashvarga > Dashavarga > Saptavarga > Shadvarga as representative.',
    excludedK03ToK08Concerns: [
      'Contextual evidence authority adjudication (K03) and relational dispositor synthesis (K04)',
    ],
    mathModel: {
      modelId: 'vimshopaka_20_ratio_tier',
      modelType: 'threshold_ratio',
      inputUnit: 'vimshopaka_20',
      outputUnit: 'ratio_0_to_1',
      parameters: {
        maxScore: 20,
        atiPoornaThreshold: 18,
        poornaThreshold: 15,
        madhyamaThreshold: 10,
        heenThreshold: 5,
      },
      normalizationBounds: { min: 0, max: 1 },
      nullOrZeroBehavior: 'Null or negative scores return invalid/missing.',
      formulaSummary: 'ratio = clamp(score / 20, 0, 1)',
    },
  },
  {
    ruleId: 'K02_CAPACITY_ISHTA_KASHTA_BALANCE',
    version: '1.0.0',
    title: 'Ishta Phala vs Kashta Phala Qualitative Capacity Balance',
    layer: 'K02',
    tradition: 'vedic_parashari',
    targetDimension: 'capacity',
    targetScope: 'classical_seven_planets',
    applicableSubjects: [...CLASSICAL_SEVEN],
    requiredFrames: ['vedic_lahiri'],
    requiredObservationCodes: ['ISHTA_KASHTA_PHALA'],
    optionalObservationCodes: [],
    citation: {
      sourceType: 'classical',
      referenceCode: 'BPHS_CH27_ISHTA_KASHTA',
      text: 'Brihat Parashara Hora Shastra Ch. 27 (Ishta Phala & Kashta Phala from Uccha & Chesta Bala, 0-60 Virupas)',
    },
    applicabilityBoundaries: [
      'Strictly applicable ONLY to the 7 classical planets.',
      'Derived from Uchcha + Chesta Bala; overlaps with Shadbala Sthana/Chesta components.',
    ],
    provisionalPolicy: 'accept_with_provisional_cap',
    overlapHandlingPolicy:
      'Mark overlap with Shadbala; express balance ratio in [-1, 1] without adding arbitrary bonus points.',
    excludedK03ToK08Concerns: [
      'Dasha beneficence manifestation (K06)',
    ],
    mathModel: {
      modelId: 'ishta_kashta_net_balance',
      modelType: 'multi_component_index',
      inputUnit: 'virupas_0_to_60',
      outputUnit: 'balance_ratio',
      parameters: {
        maxVirupas: 60,
        balancedBand: 3,
      },
      normalizationBounds: { min: -1, max: 1 },
      nullOrZeroBehavior:
        'If either ishta or kashta is missing, return invalid/missing; if both are 0, return 0 balanced.',
      formulaSummary: 'balance = clamp((ishta - kashta) / 60, -1, 1)',
    },
  },
  {
    ruleId: 'K02_INTEGRITY_D1_DIGNITY',
    version: '1.0.0',
    title: 'Vedic D1 Rashi Dignity Classification',
    layer: 'K02',
    tradition: 'vedic_parashari',
    targetDimension: 'integrity',
    targetScope: 'all_planets_excluding_ascendant',
    applicableSubjects: [...ALL_NINE_GRAHAS],
    requiredFrames: ['vedic_lahiri'],
    requiredObservationCodes: ['VEDIC_D1_DIGNITY'],
    optionalObservationCodes: ['VEDIC_D1_SIGN_HOUSE_PLACEMENT'],
    citation: {
      sourceType: 'classical',
      referenceCode: 'BPHS_PLANETARY_DIGNITIES',
      text: 'Parashari D1 Dignity Hierarchy (Exalted, Moolatrikona, Own Sign, Great Friend, Friend, Neutral, Enemy, Great Enemy, Debilitated)',
    },
    applicabilityBoundaries: [
      'Applicable to 7 classical planets cleanly; for Rahu/Ketu, preserves provider/classical dignity classification with convention caveat.',
      'Does NOT apply any automatic Neecha-Bhanga cancellation in K02 (candidate flags only).',
    ],
    provisionalPolicy: 'accept_with_provisional_cap',
    overlapHandlingPolicy: 'Single primary D1 dignity observation per planet in vedic_lahiri.',
    excludedK03ToK08Concerns: [
      'Functional benefic/malefic status by Lagna (K03)',
      'Full Neecha-Bhanga resolution (K05/K07)',
    ],
    mathModel: {
      modelId: 'vedic_d1_dignity_category',
      modelType: 'categorical_lookup',
      inputUnit: 'dignity_label',
      outputUnit: 'bounded_ordinal_index',
      parameters: {
        scaleMin: -1,
        scaleMax: 1,
        categoryMap: {
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
        },
      },
      normalizationBounds: { min: -1, max: 1 },
      nullOrZeroBehavior: 'Unrecognized or null dignity maps to null ordinal with qualitative label preserved.',
      formulaSummary: 'ordinal = categoryMap[normalize(dignity_label)] ?? null',
    },
  },
  {
    ruleId: 'K02_INTEGRITY_WESTERN_ESSENTIAL_DIGNITY',
    version: '1.0.0',
    title: 'Western Tropical Traditional Essential Dignity Classification',
    layer: 'K02',
    tradition: 'western_traditional',
    targetDimension: 'integrity',
    targetScope: 'all_planets_excluding_ascendant',
    applicableSubjects: [...ALL_NINE_GRAHAS],
    requiredFrames: ['western_tropical'],
    requiredObservationCodes: ['WESTERN_ESSENTIAL_DIGNITY'],
    optionalObservationCodes: ['WESTERN_TROPICAL_PLACEMENT'],
    citation: {
      sourceType: 'classical',
      referenceCode: 'PTOLEMAIC_ESSENTIAL_DIGNITY',
      text: 'Hellenistic & Traditional Western Essential Dignities (Domicile, Exaltation, Triplicity, Term, Face, Peregrine, Detriment, Fall)',
    },
    applicabilityBoundaries: [
      'Strictly isolated to `western_tropical` frame; NEVER merged or averaged with Vedic Lahiri D1 dignity.',
      'Divergences between Western Tropical dignity and Vedic Sidereal dignity are flagged in ConflictOverlay.',
    ],
    provisionalPolicy: 'accept_with_provisional_cap',
    overlapHandlingPolicy: 'Operate independently inside western_tropical; never collapse with vedic_lahiri.',
    excludedK03ToK08Concerns: [
      'Western accidental dignity by house/sect synthesis (K03/K05)',
    ],
    mathModel: {
      modelId: 'western_essential_dignity_category',
      modelType: 'categorical_lookup',
      inputUnit: 'western_dignity_label',
      outputUnit: 'bounded_ordinal_index',
      parameters: {
        categoryMap: {
          domicile: 0.85,
          rulership: 0.85,
          exaltation: 1.0,
          triplicity: 0.4,
          term: 0.2,
          face: 0.1,
          peregrine: 0.0,
          detriment: -0.75,
          fall: -1.0,
        },
      },
      normalizationBounds: { min: -1, max: 1 },
      nullOrZeroBehavior: 'Unknown or missing Western essential dignity returns null ordinal.',
      formulaSummary: 'ordinal = categoryMap[normalize(western_dignity)] ?? null',
    },
  },
  {
    ruleId: 'K02_INTEGRITY_D9_REINFORCEMENT_AND_VARGOTTAMA',
    version: '1.0.0',
    title: 'D9 Navamsa Reinforcement & Vargottama Coherence Check',
    layer: 'K02',
    tradition: 'vedic_parashari',
    targetDimension: 'integrity',
    targetScope: 'all_planets_excluding_ascendant',
    applicableSubjects: [...ALL_NINE_GRAHAS],
    requiredFrames: ['vedic_lahiri'],
    requiredObservationCodes: ['VEDIC_VARGA_PLACEMENT'],
    optionalObservationCodes: ['MODIFIER_VARGOTTAMA', 'VEDIC_PLANET_OPERATING_CONDITIONS'],
    citation: {
      sourceType: 'classical',
      referenceCode: 'BPHS_NAVAMSA_VARGOTTAMA',
      text: 'BPHS Navamsa (D9) Dignity & Vargottama (Identical D1 and D9 Sign)',
    },
    applicabilityBoundaries: [
      'Records D9 sign/dignity and Vargottama coherence alongside D1 without treating D9 strength as automatic cancellation of D1 debilitation or affliction.',
      'D1 vs D9 polarity divergence is recorded in ConflictOverlay for K07 resolution.',
    ],
    provisionalPolicy: 'accept_with_provisional_cap',
    overlapHandlingPolicy:
      'distinct_analytical_significance relative to D1 longitude/placement; never collapse D1 and D9.',
    excludedK03ToK08Concerns: [
      'Automatic Neecha-Bhanga or affliction cancellation (forbidden in K02; K05/K07)',
      'Contextual evidence authority (K03) and cross-frame relational graph synthesis (K04)',
    ],
    mathModel: {
      modelId: 'd1_d9_reinforcement_qualitative',
      modelType: 'non_scalar_qualitative',
      inputUnit: 'd9_dignity_and_vargottama',
      outputUnit: 'reinforcement_classification',
      parameters: {
        forbidsAutomaticCancellation: true,
      },
      normalizationBounds: null,
      nullOrZeroBehavior: 'If D9 evidence is missing, status is blocked_missing_inputs.',
      formulaSummary: 'qualitative_class in {vargottama, d9_strong, d9_neutral, d9_challenged, d1_d9_divergent}',
    },
  },
  {
    ruleId: 'K02_STABILITY_MOTION_AND_RETROGRESSION',
    version: '1.0.0',
    title: 'Kinematic Motion State & Retrogression (Non-Scalar Cheshta Condition)',
    layer: 'K02',
    tradition: 'astronomical_ephemeris',
    targetDimension: 'stability',
    targetScope: 'all_planets_excluding_ascendant',
    applicableSubjects: [...ALL_NINE_GRAHAS],
    requiredFrames: ['vedic_lahiri'],
    requiredObservationCodes: ['VEDIC_PLANET_OPERATING_CONDITIONS'],
    optionalObservationCodes: ['ASTRONOMICAL_BODY_TELEMETRY'],
    citation: {
      sourceType: 'classical',
      referenceCode: 'PHALADEEPIKA_CHESHTA_MOTION',
      text: 'Astronomical Ephemeris Speed & Classical Motion States (Vakra/Retrograde, Anuvakra, Atichara, Stambhi/Stationary, Sama/Direct); excludes universal scalar bonus/penalty.',
    },
    applicabilityBoundaries: [
      'Sun and Moon never turn retrograde; Rahu and Ketu are mean-retrograde by astronomical definition.',
      'CRITICAL GUARD: Retrogression is classified qualitatively and logged in ModificationOverlay — NEVER assign a universal bonus or universal penalty.',
    ],
    provisionalPolicy: 'accept_with_provisional_cap',
    overlapHandlingPolicy: 'Combine kinematic speed from astronomical_telemetry with vedic operating condition flags.',
    excludedK03ToK08Concerns: [
      'Retrograde functional reversal / Cheshta yoga effects (K05/K07)',
    ],
    mathModel: {
      modelId: 'kinematic_motion_taxonomy',
      modelType: 'non_scalar_qualitative',
      inputUnit: 'deg_per_day_and_flags',
      outputUnit: 'motion_state_category',
      parameters: {
        stationarySpeedThresholdDegPerDay: 0.05,
        forbidsUniversalRetrogradeBonus: true,
      },
      normalizationBounds: null,
      nullOrZeroBehavior: 'When speed is null, classify strictly from boolean is_retrograde flag without fabricating velocity.',
      formulaSummary: 'stationary(|speed| <= 0.05) | retrograde(is_retrograde) | direct',
    },
  },
  {
    ruleId: 'K02_VULNERABILITY_COMBUSTION_ASTA',
    version: '1.0.0',
    title: 'Surya Siddhanta Combustion (Asta) Orb & Proximity Gate',
    layer: 'K02',
    tradition: 'surya_siddhanta',
    targetDimension: 'vulnerability',
    targetScope: 'sun_excluded_planets',
    applicableSubjects: [...SUN_EXCLUDED_CLASSICAL_PLANETS],
    requiredFrames: ['vedic_lahiri'],
    requiredObservationCodes: ['VEDIC_PLANET_OPERATING_CONDITIONS'],
    optionalObservationCodes: ['MODIFIER_COMBUSTION_ASTA'],
    citation: {
      sourceType: 'classical',
      referenceCode: 'SURYA_SIDDHANTA_ASTA_ORBS',
      text: 'Surya Siddhanta Planetary Combustion (Asta) Angular Separation from Sun',
    },
    applicabilityBoundaries: [
      'Strictly NOT applicable to Sun (self), Rahu, Ketu (lunar nodes do not undergo classical Asta combustion), or Ascendant.',
      'Combustion when retrograde or in own sign is flagged as a candidate condition for K05/K07 without premature cancellation.',
    ],
    provisionalPolicy: 'accept_with_provisional_cap',
    overlapHandlingPolicy: 'Link MODIFIER_COMBUSTION_ASTA with VEDIC_PLANET_OPERATING_CONDITIONS without double-counting.',
    excludedK03ToK08Concerns: [
      'Domain-specific combustion mitigation by benefic aspect (K05/K07)',
    ],
    mathModel: {
      modelId: 'surya_siddhanta_combustion_orb_ratio',
      modelType: 'binary_or_orb_gate',
      inputUnit: 'degrees_from_sun',
      outputUnit: 'orb_penetration_ratio',
      parameters: {
        deepCombustionThresholdRatio: 0.35,
      },
      normalizationBounds: { min: 0, max: 1 },
      nullOrZeroBehavior:
        'When is_combust is false, returns 0 (not combust). When true and orb/separation valid, returns clamp(1 - separation/orb, 0, 1).',
      formulaSummary: 'if (!is_combust) 0 else clamp(1 - (sun_separation_deg / combustion_orb_deg), 0, 1)',
    },
  },
  {
    ruleId: 'K02_VULNERABILITY_GRAHA_YUDDHA',
    version: '1.0.0',
    title: 'Surya Siddhanta Planetary War (Graha Yuddha) < 1° Proximity Gate',
    layer: 'K02',
    tradition: 'surya_siddhanta',
    targetDimension: 'vulnerability',
    targetScope: 'tara_graha_only',
    applicableSubjects: [...TARA_GRAHAS],
    requiredFrames: ['vedic_lahiri'],
    requiredObservationCodes: ['VEDIC_PLANET_OPERATING_CONDITIONS'],
    optionalObservationCodes: ['MODIFIER_GRAHA_YUDDHA'],
    citation: {
      sourceType: 'classical',
      referenceCode: 'SURYA_SIDDHANTA_GRAHA_YUDDHA',
      text: 'Surya Siddhanta Graha Yuddha (Tara Grahas within 1° ecliptic longitude; northernmost ecliptic latitude / brightness basis)',
    },
    applicabilityBoundaries: [
      'Strictly restricted to Tara Grahas (Mars, Mercury, Jupiter, Venus, Saturn).',
      'Sun, Moon, Rahu, Ketu, and Ascendant NEVER participate in Graha Yuddha.',
    ],
    provisionalPolicy: 'accept_with_provisional_cap',
    overlapHandlingPolicy: 'Reference MODIFIER_GRAHA_YUDDHA pair once per subject.',
    excludedK03ToK08Concerns: [
      'Contextual authority gating (K03), relational graph propagation (K04), and interaction resolution (K05)',
    ],
    mathModel: {
      modelId: 'surya_siddhanta_graha_yuddha_gate',
      modelType: 'binary_or_orb_gate',
      inputUnit: 'boolean_and_role',
      outputUnit: 'war_status_indicator',
      parameters: {
        maxSeparationDeg: 1.0,
      },
      normalizationBounds: { min: -1, max: 1 },
      nullOrZeroBehavior: 'If in_graha_yuddha is false, returns 0 (inactive).',
      formulaSummary: 'inactive=0; winner=+0.5; loser=-1.0; undetermined=-0.25',
    },
  },
  {
    ruleId: 'K02_VULNERABILITY_GANDANTA_AND_SANDHI',
    version: '1.0.0',
    title: 'Gandanta & Rashi Sandhi Boundary Vulnerability Check',
    layer: 'K02',
    tradition: 'vedic_parashari',
    targetDimension: 'vulnerability',
    targetScope: 'all_ten_subjects',
    applicableSubjects: [...ALL_TEN],
    requiredFrames: ['vedic_lahiri'],
    requiredObservationCodes: ['VEDIC_D1_PLANET_LONGITUDE'],
    optionalObservationCodes: ['MODIFIER_GANDANTA_JUNCTION', 'VEDIC_PLANET_OPERATING_CONDITIONS'],
    citation: {
      sourceType: 'classical',
      referenceCode: 'BPHS_GANDANTA_AND_RASHI_SANDHI',
      text: 'BPHS Water-Fire Gandanta Junctions (Cancer/Leo, Scorpio/Sagittarius, Pisces/Aries) & Rashi Sandhi (<= 1.0° from sign cusp)',
    },
    applicabilityBoundaries: [
      'Applies to all 10 subjects (9 grahas + Ascendant) using Sidereal D1 degree_in_sign.',
      'Flags birthTimeSensitive & sandhiOrBoundaryRisk in ReliabilityOverlay.',
    ],
    provisionalPolicy: 'accept_with_provisional_cap',
    overlapHandlingPolicy: 'Single boundary assessment combining Gandanta flag and <= 1.0° Sandhi proximity.',
    excludedK03ToK08Concerns: [
      'Navamsa/rectification judgment (beyond boundary risk alert)',
    ],
    mathModel: {
      modelId: 'gandanta_sandhi_boundary_gate',
      modelType: 'binary_or_orb_gate',
      inputUnit: 'degree_in_sign',
      outputUnit: 'boundary_risk_index',
      parameters: {
        sandhiMarginDeg: 1.0,
        signSpanDeg: 30.0,
      },
      normalizationBounds: { min: 0, max: 1 },
      nullOrZeroBehavior: 'Null degree_in_sign returns invalid/missing unless is_gandanta flag is explicitly provided.',
      formulaSummary: 'edgeDist = min(deg, 30 - deg); risk = is_gandanta ? 1.0 : edgeDist <= 1.0 ? 1 - edgeDist : 0',
    },
  },
  {
    ruleId: 'K02_AUTONOMY_DISPOSITOR_DEPENDENCY',
    version: '1.0.0',
    title: 'D1 Dispositor Dependency, Self-Disposited Autonomy & Parivartana Links',
    layer: 'K02',
    tradition: 'vedic_parashari',
    targetDimension: 'autonomy',
    targetScope: 'all_planets_excluding_ascendant',
    applicableSubjects: [...ALL_NINE_GRAHAS],
    requiredFrames: ['vedic_lahiri'],
    requiredObservationCodes: ['VEDIC_D1_DISPOSITOR_DEPENDENCY'],
    optionalObservationCodes: ['PARIVARTANA_MUTUAL_EXCHANGE'],
    citation: {
      sourceType: 'classical',
      referenceCode: 'PARASHARI_DISPOSITOR_AUTONOMY',
      text: 'Parashari Dispositor Chain Dependency, Swakshetra Self-Dispositor & Mutual Exchange (Parivartana)',
    },
    applicabilityBoundaries: [
      'Evaluates structural dependency on sign dispositor without assessing house-lordship beneficence/maleficence (K03).',
    ],
    provisionalPolicy: 'accept_with_provisional_cap',
    overlapHandlingPolicy: 'Preserve distinct D1 and D9 Parivartana tags.',
    excludedK03ToK08Concerns: [
      'Kendra/Trikona/Dusthana Parivartana fruitfulness (K03/K05)',
    ],
    mathModel: {
      modelId: 'dispositor_chain_autonomy_lookup',
      modelType: 'categorical_lookup',
      inputUnit: 'termination_and_exchange_flags',
      outputUnit: 'autonomy_class_index',
      parameters: {
        categoryMap: {
          self_disposited: 1.0,
          final_dispositor: 1.0,
          parivartana_cycle: 0.75,
          mutual_exchange: 0.75,
          cycle: 0.5,
          terminated_in_self_dispositor: 0.5,
          chained: 0.25,
        },
      },
      normalizationBounds: { min: 0, max: 1 },
      nullOrZeroBehavior: 'Missing dispositor evidence yields blocked_missing_inputs.',
      formulaSummary: 'autonomy = is_self_disposited ? 1.0 : categoryMap[termination_type] ?? 0.25',
    },
  },
  {
    ruleId: 'K02_FOOTPRINT_CROSS_FRAME_PRESENCE',
    version: '1.0.0',
    title: 'Cross-Frame Presence & Divergence Audit (Vedic D1 / Chalit / KP / Western)',
    layer: 'K02',
    tradition: 'cross_tradition_governance',
    targetDimension: 'influenceFootprint',
    targetScope: 'all_ten_subjects',
    applicableSubjects: [...ALL_TEN],
    requiredFrames: ['vedic_lahiri'],
    requiredObservationCodes: ['VEDIC_D1_SIGN_HOUSE_PLACEMENT'],
    optionalObservationCodes: [
      'VEDIC_D1_ASCENDANT_SIGN',
      'BHAVA_CHALIT_HOUSE_PLACEMENT',
      'KP_PLACIDUS_HOUSE_PLACEMENT',
      'KP_PLANET_SUB_LORDS',
      'WESTERN_TROPICAL_PLACEMENT',
    ],
    citation: {
      sourceType: 'proprietary',
      referenceCode: 'K02_CROSS_FRAME_PRESENCE',
      text: 'Multi-Frame Coordinate Footprint Comparison preserving distinct analytical significance across D1, Bhava Chalit, KP Placidus, and Western Tropical.',
    },
    applicabilityBoundaries: [
      'Tracks house shifts between D1 Rashi vs Bhava Chalit vs KP Placidus without merging or overriding any frame.',
      'Does NOT adjudicate contextual authority (K03) or construct full natal relational/dependency graphs (K04).',
    ],
    provisionalPolicy: 'accept_with_provisional_cap',
    overlapHandlingPolicy: 'Always keep distinct_analytical_significance across frames intact.',
    excludedK03ToK08Concerns: [
      'Contextual evidence authority adjudication (K03/K07)',
      'Natal Intelligence Graph & relational signification footprint enrichment (K04)',
    ],
    mathModel: {
      modelId: 'cross_frame_divergence_index',
      modelType: 'multi_component_index',
      inputUnit: 'frame_house_assignments',
      outputUnit: 'present_frame_count',
      parameters: {
        maxTrackedFrames: 4,
      },
      normalizationBounds: { min: 0, max: 4 },
      nullOrZeroBehavior: 'Counts non-null distinct frames present cleanly.',
      formulaSummary: 'present_frames = countNonNull(vedicD1, bhavaChalit, kpPlacidus, westernTropical)',
    },
  },
  {
    ruleId: 'K02_OVERLAY_CONFLICT_DETECTION',
    version: '1.0.0',
    title: 'Cross-Frame & Intra-State Conflict Overlay Detector',
    layer: 'K02',
    tradition: 'cross_tradition_governance',
    targetDimension: 'overlay_conflict',
    targetScope: 'all_ten_subjects',
    applicableSubjects: [...ALL_TEN],
    requiredFrames: ['vedic_lahiri'],
    requiredObservationCodes: ['VEDIC_D1_PLANET_LONGITUDE'],
    optionalObservationCodes: [
      'VEDIC_D1_DIGNITY',
      'VEDIC_VARGA_PLACEMENT',
      'SHADBALA_MAJOR_SIX_BALA',
      'WESTERN_ESSENTIAL_DIGNITY',
      'BHAVA_CHALIT_HOUSE_PLACEMENT',
      'KP_PLACIDUS_HOUSE_PLACEMENT',
    ],
    citation: {
      sourceType: 'proprietary',
      referenceCode: 'K02_CONFLICT_OVERLAY_SPEC',
      text: 'K02 Explicit Conflict Preservation Policy (surfaces tensions for K07 Conflict Resolution instead of averaging away contradictions).',
    },
    applicabilityBoundaries: [
      'Detects but NEVER resolves conflicts; resolution is deferred to K07.',
    ],
    provisionalPolicy: 'accept_with_provisional_cap',
    overlapHandlingPolicy: 'Cross-references frame-isolated signals without blending metrics.',
    excludedK03ToK08Concerns: [
      'Final conflict adjudication & weighting (K07)',
    ],
    mathModel: {
      modelId: 'k02_conflict_classification',
      modelType: 'non_scalar_qualitative',
      inputUnit: 'state_signals',
      outputUnit: 'conflict_count',
      parameters: {
        shadbalaStrongRatio: 1.15,
        shadbalaWeakRatio: 0.85,
      },
      normalizationBounds: null,
      nullOrZeroBehavior: 'Returns 0 conflicts when no cross-frame or intra-state tensions are detected.',
      formulaSummary: 'Detect frame_divergence, strength_vs_dignity_divergence, d1_vs_d9_divergence, tradition_tension',
    },
  },
  {
    ruleId: 'K02_OVERLAY_MODIFICATION_CATALOG',
    version: '1.0.0',
    title: 'Active Operating Modifiers & Pending K05/K07 Resolution Catalog',
    layer: 'K02',
    tradition: 'vedic_parashari',
    targetDimension: 'overlay_modification',
    targetScope: 'all_ten_subjects',
    applicableSubjects: [...ALL_TEN],
    requiredFrames: ['vedic_lahiri'],
    requiredObservationCodes: ['VEDIC_D1_PLANET_LONGITUDE'],
    optionalObservationCodes: [
      'VEDIC_PLANET_OPERATING_CONDITIONS',
      'MODIFIER_COMBUSTION_ASTA',
      'MODIFIER_VARGOTTAMA',
      'MODIFIER_GANDANTA_JUNCTION',
      'MODIFIER_GRAHA_YUDDHA',
      'PARIVARTANA_MUTUAL_EXCHANGE',
      'VEDIC_ADVANCED_AVASTHAS',
    ],
    citation: {
      sourceType: 'classical',
      referenceCode: 'K02_MODIFICATION_OVERLAY_SPEC',
      text: 'K02 Operating Modifiers & Candidate Interactions preserved cleanly for K05/K07 resolution.',
    },
    applicabilityBoundaries: [
      'Logs active modifiers and candidate Neecha-Bhanga / Asta mitigations without applying premature cancellations.',
    ],
    provisionalPolicy: 'provisional_only_annotation',
    overlapHandlingPolicy: 'Deduplicate operating_condition vs explicit modification children via lineage.',
    excludedK03ToK08Concerns: [
      'Final cancellation or amplification net impact (K05/K07)',
    ],
    mathModel: {
      modelId: 'k02_modification_catalog',
      modelType: 'non_scalar_qualitative',
      inputUnit: 'modifier_evidence',
      outputUnit: 'active_modifier_count',
      parameters: {
        forbidsPrematureCancellation: true,
      },
      normalizationBounds: null,
      nullOrZeroBehavior: 'Zero active modifiers returns 0.',
      formulaSummary: 'Catalog active combustion, retrograde, vargottama, graha_yuddha, gandanta, parivartana, avastha_provisional',
    },
  },
  {
    ruleId: 'K02_OVERLAY_RELIABILITY_AUDIT',
    version: '1.0.0',
    title: 'Epistemic Trust Floor, Provisional Gate & Birth-Time Sensitivity Audit',
    layer: 'K02',
    tradition: 'cross_tradition_governance',
    targetDimension: 'overlay_reliability',
    targetScope: 'all_ten_subjects',
    applicableSubjects: [...ALL_TEN],
    requiredFrames: ['vedic_lahiri'],
    requiredObservationCodes: [],
    optionalObservationCodes: [],
    citation: {
      sourceType: 'proprietary',
      referenceCode: 'K02_RELIABILITY_AUDIT',
      text: 'K01/K02 Verification & Sensitivity Ceiling Governance (propagatedTrust floor, provisional gating, Sandhi/birth-time risk)',
    },
    applicabilityBoundaries: [
      'Computes subject trust ceiling strictly from contributing K01 evidence verification metadata.',
      'Never upgrades `provisional` or `blocked` evidence to `usable` or `independently_validated_external`.',
    ],
    provisionalPolicy: 'provisional_only_annotation',
    overlapHandlingPolicy: 'Audits all supporting evidence for the subject.',
    excludedK03ToK08Concerns: [],
    mathModel: {
      modelId: 'k02_reliability_trust_floor',
      modelType: 'categorical_lookup',
      inputUnit: 'verification_metadata',
      outputUnit: 'trust_ceiling_rank',
      parameters: {
        usable: 2,
        provisional: 1,
        blocked: 0,
      },
      normalizationBounds: { min: 0, max: 2 },
      nullOrZeroBehavior: 'No supporting evidence defaults to blocked (0).',
      formulaSummary: 'trustCeiling = anyUsable ? (anyProvisional ? provisional_or_usable_by_primary : usable) : blocked',
    },
  },
  {
    ruleId: 'K02_NODAL_CONDITION_PROFILE',
    version: '1.0.0',
    title: 'Lunar Node (Rahu / Ketu) Non-Shadbala Condition & Dispositor Profile',
    layer: 'K02',
    tradition: 'vedic_parashari',
    targetDimension: 'nodal_condition_profile',
    targetScope: 'nodes_only',
    applicableSubjects: [...NODES_ONLY],
    requiredFrames: ['vedic_lahiri'],
    requiredObservationCodes: ['VEDIC_D1_SIGN_HOUSE_PLACEMENT'],
    optionalObservationCodes: [
      'VEDIC_NAKSHATRA_PADA',
      'VEDIC_D1_DISPOSITOR_DEPENDENCY',
      'BHAVA_CHALIT_HOUSE_PLACEMENT',
      'KP_PLACIDUS_HOUSE_PLACEMENT',
      'VEDIC_VARGA_PLACEMENT',
      'WESTERN_TROPICAL_PLACEMENT',
    ],
    citation: {
      sourceType: 'classical',
      referenceCode: 'BPHS_CHHAYA_GRAHA_NODES',
      text: 'Parashari Chhaya Graha Protocol (Rahu/Ketu evaluated via sign dispositor, nakshatra lord, D9, Chalit/KP; excluded from Shadbala & BAV)',
    },
    applicabilityBoundaries: [
      'Strictly restricted to Rahu and Ketu.',
      'Explicitly forbids Shadbala and Ashtakavarga BAV fabrication for nodes.',
      'Records mean vs true node convention explicitly.',
    ],
    provisionalPolicy: 'accept_with_provisional_cap',
    overlapHandlingPolicy: 'Separate NodalConditionProfile outside 7-planet PHI projection.',
    excludedK03ToK08Concerns: [
      'Nodal agentic yoga / conjunction substitution (K05)',
      'Rahu/Ketu Mahadasha karmic delivery (K06)',
    ],
    mathModel: {
      modelId: 'nodal_condition_qualitative',
      modelType: 'exclusion_guard',
      inputUnit: 'nodal_evidence',
      outputUnit: 'profile_completeness_count',
      parameters: {
        excludesShadbala: true,
        excludesAshtakavarga: true,
      },
      normalizationBounds: { min: 0, max: 6 },
      nullOrZeroBehavior: 'Missing optional frames remain null in profile.',
      formulaSummary: 'Synthesize nodal placement, dispositor dependency, Nakshatra, D9, Chalit/KP, Western without Shadbala/BAV.',
    },
  },
  {
    ruleId: 'K02_ASCENDANT_CONDITION_PROFILE',
    version: '1.0.0',
    title: 'Ascendant (Lagna) Non-Planetary Reference Point Profile',
    layer: 'K02',
    tradition: 'vedic_parashari',
    targetDimension: 'ascendant_condition_profile',
    targetScope: 'ascendant_only',
    applicableSubjects: [...ASCENDANT_ONLY],
    requiredFrames: ['vedic_lahiri'],
    requiredObservationCodes: ['VEDIC_D1_ASCENDANT_SIGN'],
    optionalObservationCodes: [
      'VEDIC_NAKSHATRA_PADA',
      'VEDIC_VARGA_PLACEMENT',
      'KP_CUSPAL_SUB_LORDS',
      'WESTERN_TROPICAL_PLACEMENT',
    ],
    citation: {
      sourceType: 'classical',
      referenceCode: 'BPHS_LAGNA_REFERENCE_POINT',
      text: 'Ascendant (Lagna) Ecliptic Reference Point (Nakshatra, Navamsa, KP Cusp 1 Sub-Lord, Sandhi Sensitivity; non-planetary body)',
    },
    applicabilityBoundaries: [
      'Strictly restricted to Ascendant.',
      'Excludes planetary strength metrics (Shadbala, BAV, Combustion, Retrogression, Graha Yuddha).',
      'Defers Lagnesha / structural chart authority to K03.',
    ],
    provisionalPolicy: 'accept_with_provisional_cap',
    overlapHandlingPolicy: 'Separate AscendantConditionProfile outside 7-planet PHI projection.',
    excludedK03ToK08Concerns: [
      'Lagnesha placement & structural chart pillar authority (K03)',
    ],
    mathModel: {
      modelId: 'ascendant_condition_qualitative',
      modelType: 'exclusion_guard',
      inputUnit: 'lagna_coordinates',
      outputUnit: 'profile_completeness_count',
      parameters: {
        isNonPlanetaryPoint: true,
      },
      normalizationBounds: { min: 0, max: 4 },
      nullOrZeroBehavior: 'Missing cusp/frame fields remain null.',
      formulaSummary: 'Synthesize D1 Lagna, D9 Navamsa, KP Cusp 1, Western Ascendant, and Sandhi birth-time sensitivity.',
    },
  },
  {
    ruleId: 'K02_PHI_INTRINSIC_HEALTH_PROJECTION',
    version: '1.0.0',
    title: 'Overlap-Deduplicated PHI-Ready Intrinsic Planetary Health Projection',
    layer: 'K02',
    tradition: 'cross_tradition_governance',
    targetDimension: 'phi_projection',
    targetScope: 'classical_seven_planets',
    applicableSubjects: [...CLASSICAL_SEVEN],
    requiredFrames: ['vedic_lahiri'],
    requiredObservationCodes: ['VEDIC_D1_PLANET_LONGITUDE'],
    optionalObservationCodes: [
      'SHADBALA_MAJOR_SIX_BALA',
      'ASHTAKAVARGA_BHINNA_BAV',
      'VIMSHOPAKA_BALA_SCHEME',
      'ISHTA_KASHTA_PHALA',
      'VEDIC_D1_DIGNITY',
      'VEDIC_VARGA_PLACEMENT',
      'VEDIC_PLANET_OPERATING_CONDITIONS',
      'VEDIC_D1_DISPOSITOR_DEPENDENCY',
    ],
    citation: {
      sourceType: 'proprietary',
      referenceCode: 'K02_PHI_PROJECTION_CONTRACT',
      text: 'K02 PHI-Ready Intrinsic Health Projection (strictly 7 classical planets; overlap-deduplicated; zero K03-K08 leakage; zero arbitrary weights)',
    },
    applicabilityBoundaries: [
      'Strictly excludes Rahu, Ketu, and Ascendant (routed to NodalConditionProfile & AscendantConditionProfile).',
      'Deduplicates Shadbala subcomponents, Ashtakavarga Prastara/Pinda, and secondary Vimshopaka schemes via K01 overlapRelations.',
      'Does NOT compute scalar PHI scores or invent empirical weights.',
    ],
    provisionalPolicy: 'accept_with_provisional_cap',
    overlapHandlingPolicy:
      'Exclude child/redundant metrics flagged as partial_mathematical_overlap or exact_duplicate from primary quantitative fields.',
    excludedK03ToK08Concerns: [
      'K03 Contextual Evidence Authority Intelligence & Lagna-specific authority rules',
      'K04 Relational Intelligence (Natal Intelligence Graph, Dispositor & Dependency Intelligence, P08 enrichment)',
      'K05 Planetary interactions / Yogas',
      'K06 Temporal Dasha / Gochar',
      'K07 Conflict resolution',
      'K08 Historical / Life-context outcomes',
    ],
    mathModel: {
      modelId: 'phi_overlap_deduplication_projection',
      modelType: 'exclusion_guard',
      inputUnit: 'k02_subject_state_and_overlap_graph',
      outputUnit: 'deduplicated_evidence_count',
      parameters: {
        strictlyExcludesK03ToK08: true,
        strictlySevenClassicalPlanets: true,
      },
      normalizationBounds: { min: 0, max: 20 },
      nullOrZeroBehavior: 'Missing quantitative modules leave respective slot available=false.',
      formulaSummary: 'Project deduplicated intrinsic state fields + exclusion boundary certificate.',
    },
  },
];

export const R07_MATH_MODEL_REGISTRY_VERSION = 'k04.r07.1.0' as const;

export interface R07SccNodeGroup {
  sccId: string;
  members: string[];
  size: number;
  hasSelfLoop: boolean;
  isCycle: boolean;
  sccType: 'self_loop' | 'mutual_cycle' | 'multi_node_cycle' | 'singleton_acyclic';
  outgoingSccIds: string[];
  isTerminalSink: boolean;
  isTrueDispositorSink: boolean;
}

export interface R07TerminalBasinSummary {
  basinId: string;
  sinkSccId: string;
  terminalKind: 'self_disposited' | 'cycle';
  sinkMembers: string[];
  assignedEntities: string[];
  assignedCount: number;
}

export interface R07DciOutput {
  dci: number | null;
  isComplete: boolean;
  renormalized: false;
  expectedPopulation: number;
  assignedPopulation: number;
  missingPopulation: number;
  proportionsByBasin: Record<string, number>;
}

export interface R07MathModelOutput {
  uniqueEntities?: string[];
  duplicateInputCount?: number;
  reachableEntities?: string[];
  visitedAllEntities?: string[];
  depthByEntity?: Record<string, number>;
  visitedLimitReached?: boolean;
  truncatedByDepth?: boolean;
  pathLength?: number | null;
  shortestPath?: string[] | null;
  sccs?: R07SccNodeGroup[];
  cyclicSccCount?: number;
  selfLoopCount?: number;
  terminalSinkSccIds?: string[];
  unresolvedLeafNodes?: string[];
  basins?: R07TerminalBasinSummary[];
  basinByEntity?: Record<string, string[]>;
  unassignedEntities?: string[];
  multiBasinEntities?: string[];
  isComplete?: boolean;
  dciOutput?: R07DciOutput;
  items?: string[];
  jaccard?: number;
  intersectionSize?: number;
  unionSize?: number;
}

export const R07_GRAPH_SET_MATH_MODELS: readonly AnalyticalRuleDefinition['mathModel'][] = deepFreeze([
  {
    modelId: 'unique_entity_counting',
    modelType: 'categorical_lookup',
    inputUnit: 'entity_id_collection',
    outputUnit: 'unique_entity_count',
    parameters: { deduplicatesMultiPathHits: true },
    normalizationBounds: { min: 0, max: 10000 },
    nullOrZeroBehavior: 'Empty input returns 0.',
    formulaSummary: 'count = |Set(entities)|',
  },
  {
    modelId: 'graph_reachability',
    modelType: 'categorical_lookup',
    inputUnit: 'directed_adjacency_list',
    outputUnit: 'reachable_entity_count',
    parameters: { defaultMaxDepth: 12, defaultMaxSteps: 256, cycleSafe: true },
    normalizationBounds: { min: 0, max: 10000 },
    nullOrZeroBehavior: 'Empty adjacency returns 0 reachable entities.',
    formulaSummary: 'Bounded BFS over directed sorted adjacency respecting maxDepth and maxSteps.',
  },
  {
    modelId: 'dependency_path_length',
    modelType: 'categorical_lookup',
    inputUnit: 'directed_adjacency_list',
    outputUnit: 'edge_hops',
    parameters: { defaultMaxDepth: 12, defaultMaxSteps: 256, cycleSafe: true },
    normalizationBounds: { min: 0, max: 64 },
    nullOrZeroBehavior: 'Unreachable target returns valid=false, normalizedValue=null.',
    formulaSummary: 'Shortest directed hop distance from startNode to targetNode (or max reachable hop depth if targetNode omitted).',
  },
  {
    modelId: 'scc_detection',
    modelType: 'non_scalar_qualitative',
    inputUnit: 'directed_adjacency_list',
    outputUnit: 'scc_count',
    parameters: { algorithm: 'tarjan_deterministic_scc', detectsSelfLoops: true },
    normalizationBounds: { min: 0, max: 10000 },
    nullOrZeroBehavior: 'Empty graph returns 0 SCCs.',
    formulaSummary: 'Deterministic Tarjan SCC + condensation DAG detecting self-loops, mutual 2-cycles, multi-node cycles, and true terminal sinks.',
  },
  {
    modelId: 'terminal_basin_assignment',
    modelType: 'non_scalar_qualitative',
    inputUnit: 'directed_adjacency_list',
    outputUnit: 'assigned_entity_count',
    parameters: { neverAssumeSingleFinalDispositor: true, marksMissingAsUnassigned: true },
    normalizationBounds: { min: 0, max: 10000 },
    nullOrZeroBehavior: 'Nodes with missing outgoing dependencies remain unassigned rather than coerced into synthetic basins.',
    formulaSummary: 'Map each node via condensation DAG to its reachable true terminal sink SCC basin(s).',
  },
  {
    modelId: 'dependency_concentration_dci',
    modelType: 'threshold_ratio',
    inputUnit: 'basin_entity_counts',
    outputUnit: 'dci_concentration_index',
    parameters: { forbidSilentRenormalizationOnIncomplete: true, formula: 'sum((count_i / expectedPopulation)^2)' },
    normalizationBounds: { min: 0, max: 1 },
    nullOrZeroBehavior: 'Incomplete basin assignment marks isComplete=false and divides by expectedPopulation (never renormalized to 1.0).',
    formulaSummary: 'DCI = sum_i (count_i / expectedPopulation)^2',
  },
  {
    modelId: 'set_intersection',
    modelType: 'categorical_lookup',
    inputUnit: 'two_entity_sets',
    outputUnit: 'intersection_count',
    parameters: { sortedDeterministic: true },
    normalizationBounds: { min: 0, max: 10000 },
    nullOrZeroBehavior: 'Disjoint sets return 0.',
    formulaSummary: 'setA ∩ setB',
  },
  {
    modelId: 'set_union',
    modelType: 'categorical_lookup',
    inputUnit: 'two_entity_sets',
    outputUnit: 'union_count',
    parameters: { sortedDeterministic: true },
    normalizationBounds: { min: 0, max: 20000 },
    nullOrZeroBehavior: 'Empty sets return 0.',
    formulaSummary: 'setA ∪ setB',
  },
  {
    modelId: 'jaccard_overlap',
    modelType: 'threshold_ratio',
    inputUnit: 'two_entity_sets',
    outputUnit: 'jaccard_index',
    parameters: { sortedDeterministic: true },
    normalizationBounds: { min: 0, max: 1 },
    nullOrZeroBehavior: 'Both empty sets return 0 overlap.',
    formulaSummary: '|setA ∩ setB| / |setA ∪ setB|',
  },
]);

export const R07_MATH_MODEL_BY_ID: Readonly<Record<string, AnalyticalRuleDefinition['mathModel']>> =
  deepFreeze(Object.fromEntries(R07_GRAPH_SET_MATH_MODELS.map((m) => [m.modelId, m])));

const FORBIDDEN_WEIGHTING_MODEL_PATTERNS = [
  'composite_authority',
  'universal_relationship_strength',
  'relationship_weight',
  'arbitrary_weight',
  'scalar_phi_weight',
  'composite_strength_score',
] as const;

export const K02_ANALYTICAL_RULES: Readonly<Record<string, AnalyticalRuleDefinition>> = deepFreeze(
  Object.fromEntries(RAW_K02_RULES.map((rule) => [rule.ruleId, rule]))
);

export const K02_RULE_LIST: readonly AnalyticalRuleDefinition[] = deepFreeze([...RAW_K02_RULES]);

const MATH_MODEL_SPEC_BY_ID: ReadonlyMap<string, AnalyticalRuleDefinition['mathModel']> = new Map([
  ...RAW_K02_RULES.map((rule): [string, AnalyticalRuleDefinition['mathModel']] => [
    rule.mathModel.modelId,
    rule.mathModel,
  ]),
  ...R07_GRAPH_SET_MATH_MODELS.map((spec): [string, AnalyticalRuleDefinition['mathModel']] => [
    spec.modelId,
    spec,
  ]),
]);

export function isR07MathModelRegistered(modelId: string): boolean {
  return Object.prototype.hasOwnProperty.call(R07_MATH_MODEL_BY_ID, modelId);
}

export function exportR07MathModelRegistrySnapshot(): {
  registryVersion: typeof R07_MATH_MODEL_REGISTRY_VERSION;
  totalModels: number;
  modelIds: string[];
  models: AnalyticalRuleDefinition['mathModel'][];
} {
  return {
    registryVersion: R07_MATH_MODEL_REGISTRY_VERSION,
    totalModels: R07_GRAPH_SET_MATH_MODELS.length,
    modelIds: R07_GRAPH_SET_MATH_MODELS.map((m) => m.modelId),
    models: R07_GRAPH_SET_MATH_MODELS.map((m) => ({ ...m })),
  };
}

export function isRuleRegistered(ruleId: string): boolean {
  return Object.prototype.hasOwnProperty.call(K02_ANALYTICAL_RULES, ruleId);
}

export function getRegisteredRule(ruleId: string): AnalyticalRuleDefinition | undefined {
  return isRuleRegistered(ruleId) ? K02_ANALYTICAL_RULES[ruleId] : undefined;
}

/**
 * Hard runtime guard: throws `UnregisteredRuleError` if an engine tries to execute
 * an unregistered ruleId or mismatched rule version.
 */
export function assertRegisteredRule(
  ruleId: string,
  expectedVersion?: string
): AnalyticalRuleDefinition {
  const rule = getRegisteredRule(ruleId);
  if (!rule) {
    throw new UnregisteredRuleError(ruleId, expectedVersion);
  }
  if (expectedVersion && rule.version !== expectedVersion) {
    throw new UnregisteredRuleError(ruleId, expectedVersion, rule.version);
  }
  return rule;
}

export function listRegisteredRules(): readonly AnalyticalRuleDefinition[] {
  return K02_RULE_LIST;
}

export function exportRuleRegistrySnapshot(): AnalyticalRuleRegistrySnapshot {
  const r04 = exportR04RuleRegistrySnapshot();
  return {
    registryVersion: ANALYTICAL_RULE_REGISTRY_VERSION,
    totalRules: K02_RULE_LIST.length,
    rules: K02_RULE_LIST.map((r) => ({ ...r })),
    r04RegistryVersion: r04.registryVersion,
    r04TotalRules: r04.totalRules,
    r04Rules: r04.rules,
  };
}

export interface MathModelEvaluationContext {
  planet?: PlanetaryStateSubjectName;
  bphsMinRupas?: number;
  kashtaPhala?: number | null;
  combustionOrbDeg?: number | null;
  isCombust?: boolean | null;
  isRetrograde?: boolean | null;
  inGrahaYuddha?: boolean | null;
  grahaYuddhaRole?: string | null;
  isGandanta?: boolean | null;
  isSelfDisposited?: boolean | null;
  inParivartana?: boolean | null;
  // R07 Graph & Set Mathematical Model Context Inputs
  entities?: readonly string[];
  adjacency?: Readonly<Record<string, readonly string[]>>;
  startNodes?: readonly string[];
  targetNode?: string;
  includeStartInReachable?: boolean;
  maxDepth?: number;
  maxSteps?: number;
  basinCounts?: Readonly<Record<string, number>> | readonly number[];
  totalExpectedPopulation?: number;
  excludedOrMissingCount?: number;
  setA?: readonly string[];
  setB?: readonly string[];
}

export interface MathModelEvaluationResult {
  modelId: string;
  valid: boolean;
  normalizedValue: number | null;
  normalizedUnit: string | null;
  qualitativeClass: string | null;
  formulaTrace: string;
  reason: string;
  r07Output?: R07MathModelOutput;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function round6(v: number): number {
  return Math.round(v * 1000000) / 1000000;
}

function normToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function buildSortedAdjacency(
  rawAdjacency: Readonly<Record<string, readonly string[]>>,
  extraEntities: readonly string[] = []
): { nodes: string[]; adj: Map<string, string[]> } {
  const nodeSet = new Set<string>(extraEntities);
  for (const [src, targets] of Object.entries(rawAdjacency)) {
    nodeSet.add(src);
    for (const tgt of targets ?? []) {
      nodeSet.add(tgt);
    }
  }
  const nodes = Array.from(nodeSet).sort((a, b) => a.localeCompare(b));
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    const rawTargets = rawAdjacency[n] ?? [];
    adj.set(n, Array.from(new Set(rawTargets)).sort((a, b) => a.localeCompare(b)));
  }
  return { nodes, adj };
}

function runDeterministicTarjanScc(
  rawAdjacency: Readonly<Record<string, readonly string[]>>,
  extraEntities: readonly string[] = []
): {
  nodes: string[];
  adj: Map<string, string[]>;
  sccs: R07SccNodeGroup[];
  sccIdByNode: Map<string, string>;
  unresolvedLeafNodes: string[];
} {
  const { nodes, adj } = buildSortedAdjacency(rawAdjacency, extraEntities);
  let indexCounter = 0;
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const rawComponents: string[][] = [];

  const strongConnect = (v: string) => {
    indices.set(v, indexCounter);
    lowlink.set(v, indexCounter);
    indexCounter += 1;
    stack.push(v);
    onStack.add(v);

    for (const w of adj.get(v) ?? []) {
      if (!indices.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
      }
    }

    if (lowlink.get(v) === indices.get(v)) {
      const comp: string[] = [];
      while (stack.length > 0) {
        const w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
        if (w === v) break;
      }
      comp.sort((a, b) => a.localeCompare(b));
      rawComponents.push(comp);
    }
  };

  for (const n of nodes) {
    if (!indices.has(n)) {
      strongConnect(n);
    }
  }

  // Sort components deterministically by first sorted member so sccIds never depend on traversal insertion order
  rawComponents.sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''));

  const sccIdByNode = new Map<string, string>();
  const sccIdByCompIdx = rawComponents.map((comp, idx) => {
    const id = `scc_${idx + 1}_${comp[0] ?? 'empty'}`;
    for (const m of comp) {
      sccIdByNode.set(m, id);
    }
    return id;
  });

  const sccs: R07SccNodeGroup[] = [];
  const unresolvedLeafNodes: string[] = [];

  for (let i = 0; i < rawComponents.length; i++) {
    const members = rawComponents[i];
    const sccId = sccIdByCompIdx[i];
    const hasSelfLoop =
      members.length === 1 && (adj.get(members[0]) ?? []).includes(members[0]);
    const isCycle = members.length > 1 || hasSelfLoop;
    const sccType: R07SccNodeGroup['sccType'] =
      members.length > 2
        ? 'multi_node_cycle'
        : members.length === 2
        ? 'mutual_cycle'
        : hasSelfLoop
        ? 'self_loop'
        : 'singleton_acyclic';

    const outgoingSet = new Set<string>();
    for (const u of members) {
      for (const w of adj.get(u) ?? []) {
        const tgtScc = sccIdByNode.get(w);
        if (tgtScc && tgtScc !== sccId) {
          outgoingSet.add(tgtScc);
        }
      }
    }
    const outgoingSccIds = Array.from(outgoingSet).sort((a, b) => a.localeCompare(b));
    const isTerminalSink = outgoingSccIds.length === 0;
    const isTrueDispositorSink = isTerminalSink && isCycle;
    if (isTerminalSink && !isCycle && members.length === 1) {
      unresolvedLeafNodes.push(members[0]);
    }

    sccs.push({
      sccId,
      members,
      size: members.length,
      hasSelfLoop,
      isCycle,
      sccType,
      outgoingSccIds,
      isTerminalSink,
      isTrueDispositorSink,
    });
  }

  return { nodes, adj, sccs, sccIdByNode, unresolvedLeafNodes };
}

/**
 * Executes a registered mathematical model deterministically against raw input telemetry.
 * Throws `UnregisteredMathModelError` if `modelId` is not registered in `K02_ANALYTICAL_RULES` or `R07_GRAPH_SET_MATH_MODELS`.
 */
export function evaluateRuleMathModel(
  modelId: string,
  rawValue: number | string | boolean | null | undefined,
  context: MathModelEvaluationContext = {}
): MathModelEvaluationResult {
  const lowered = normToken(modelId);
  if (
    FORBIDDEN_WEIGHTING_MODEL_PATTERNS.some((pat) => lowered.includes(pat)) &&
    !MATH_MODEL_SPEC_BY_ID.has(modelId)
  ) {
    throw new UnregisteredMathModelError(
      `${modelId} (forbidden composite authority or universal relationship-strength weighting model)`
    );
  }
  const spec = MATH_MODEL_SPEC_BY_ID.get(modelId);
  if (!spec) {
    throw new UnregisteredMathModelError(modelId);
  }

  switch (modelId) {
    case 'shadbala_bphs_rupa_ratio': {
      const rupas = typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : null;
      const minRupas =
        context.bphsMinRupas ??
        (context.planet ? BPHS_SHADBALA_MIN_RUPAS[context.planet] : undefined);

      if (rupas === null || rupas <= 0 || !minRupas || minRupas <= 0) {
        return {
          modelId,
          valid: false,
          normalizedValue: null,
          normalizedUnit: spec.outputUnit,
          qualitativeClass: 'unavailable',
          formulaTrace: 'invalid_or_excluded_shadbala_input',
          reason:
            'Requires finite positive total_rupas and a 7-classical-planet BPHS minimum threshold.',
        };
      }

      const ratio = round4(clamp(rupas / minRupas, 0, 3.0));
      const qualitativeClass =
        ratio >= 1.25
          ? 'above_bphs_minimum_strong'
          : ratio >= 1.0
          ? 'meets_bphs_minimum'
          : ratio >= 0.85
          ? 'slightly_below_bphs_minimum'
          : 'below_bphs_minimum';

      return {
        modelId,
        valid: true,
        normalizedValue: ratio,
        normalizedUnit: spec.outputUnit,
        qualitativeClass,
        formulaTrace: `${rupas} / ${minRupas} = ${ratio}`,
        reason: `BPHS Shadbala ratio ${ratio}x minimum (${minRupas} rupas).`,
      };
    }

    case 'bav_midpoint_4_deviation': {
      const bindus = typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : null;
      if (bindus === null || bindus < 0 || bindus > 8) {
        return {
          modelId,
          valid: false,
          normalizedValue: null,
          normalizedUnit: spec.outputUnit,
          qualitativeClass: 'unavailable',
          formulaTrace: 'invalid_bav_bindus',
          reason: 'BAV bindus must be a finite number in [0, 8].',
        };
      }

      const dev = round4(clamp((bindus - 4) / 4, -1, 1));
      const qualitativeClass =
        bindus >= 6
          ? 'high_bav_support'
          : bindus === 5
          ? 'moderate_above_midpoint'
          : bindus === 4
          ? 'neutral_midpoint'
          : bindus === 3
          ? 'mild_below_midpoint'
          : 'low_bav_support';

      return {
        modelId,
        valid: true,
        normalizedValue: dev,
        normalizedUnit: spec.outputUnit,
        qualitativeClass,
        formulaTrace: `(${bindus} - 4) / 4 = ${dev}`,
        reason: `BAV ${bindus}/8 bindus (deviation ${dev >= 0 ? '+' : ''}${dev} from midpoint 4).`,
      };
    }

    case 'vimshopaka_20_ratio_tier': {
      const score = typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : null;
      if (score === null || score < 0) {
        return {
          modelId,
          valid: false,
          normalizedValue: null,
          normalizedUnit: spec.outputUnit,
          qualitativeClass: 'unavailable',
          formulaTrace: 'invalid_vimshopaka_score',
          reason: 'Vimshopaka score must be non-negative finite number on 20-point scale.',
        };
      }

      const ratio = round4(clamp(score / 20, 0, 1));
      const qualitativeClass =
        score >= 18
          ? 'ati_poorna'
          : score >= 15
          ? 'poorna'
          : score >= 10
          ? 'madhyama'
          : score >= 5
          ? 'heen'
          : 'ati_heen';

      return {
        modelId,
        valid: true,
        normalizedValue: ratio,
        normalizedUnit: spec.outputUnit,
        qualitativeClass,
        formulaTrace: `${score} / 20 = ${ratio}`,
        reason: `Vimshopaka ${score}/20 (${qualitativeClass}).`,
      };
    }

    case 'ishta_kashta_net_balance': {
      const ishta = typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : null;
      const kashta =
        typeof context.kashtaPhala === 'number' && Number.isFinite(context.kashtaPhala)
          ? context.kashtaPhala
          : null;

      if (ishta === null || kashta === null) {
        return {
          modelId,
          valid: false,
          normalizedValue: null,
          normalizedUnit: spec.outputUnit,
          qualitativeClass: 'unavailable',
          formulaTrace: 'missing_ishta_or_kashta',
          reason: 'Both Ishta Phala and Kashta Phala must be finite numbers.',
        };
      }

      const diff = ishta - kashta;
      const balance = round4(clamp(diff / 60, -1, 1));
      const qualitativeClass =
        Math.abs(diff) <= 3
          ? 'balanced'
          : diff > 0
          ? 'ishta_dominant'
          : 'kashta_dominant';

      return {
        modelId,
        valid: true,
        normalizedValue: balance,
        normalizedUnit: spec.outputUnit,
        qualitativeClass,
        formulaTrace: `(${ishta} - ${kashta}) / 60 = ${balance}`,
        reason: `Ishta ${ishta} vs Kashta ${kashta} (${qualitativeClass}).`,
      };
    }

    case 'vedic_d1_dignity_category':
    case 'western_essential_dignity_category': {
      if (typeof rawValue !== 'string' || !rawValue.trim()) {
        return {
          modelId,
          valid: false,
          normalizedValue: null,
          normalizedUnit: spec.outputUnit,
          qualitativeClass: null,
          formulaTrace: 'missing_dignity_label',
          reason: 'Dignity label is null or empty.',
        };
      }

      const key = normToken(rawValue);
      const map = spec.parameters.categoryMap as Record<string, number>;
      const mapped = Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;

      return {
        modelId,
        valid: true,
        normalizedValue: mapped,
        normalizedUnit: spec.outputUnit,
        qualitativeClass: key,
        formulaTrace: `categoryMap[${key}] = ${mapped ?? 'unmapped'}`,
        reason:
          mapped !== null
            ? `Mapped dignity "${rawValue}" to ordinal ${mapped}.`
            : `Preserved dignity label "${rawValue}" (no ordinal lookup entry).`,
      };
    }

    case 'd1_d9_reinforcement_qualitative': {
      const label = typeof rawValue === 'string' && rawValue.trim() ? normToken(rawValue) : 'observed';
      return {
        modelId,
        valid: true,
        normalizedValue: null,
        normalizedUnit: null,
        qualitativeClass: label,
        formulaTrace: `qualitative(${label}) [auto_cancellation_forbidden=true]`,
        reason: `D9 condition classified qualitatively as "${label}" without automatic cancellation.`,
      };
    }

    case 'kinematic_motion_taxonomy': {
      const speed = typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : null;
      const isRetro = context.isRetrograde === true;
      let motionClass = isRetro ? 'retrograde' : 'direct';
      if (speed !== null && Math.abs(speed) <= 0.05) {
        motionClass = 'stationary_stambhi';
      }

      return {
        modelId,
        valid: true,
        normalizedValue: null,
        normalizedUnit: null,
        qualitativeClass: motionClass,
        formulaTrace: `motion(${motionClass}, speed=${speed ?? 'null'}, retro=${isRetro})`,
        reason: `Kinematic motion state "${motionClass}" recorded non-scalarly (no universal bonus/penalty).`,
      };
    }

    case 'surya_siddhanta_combustion_orb_ratio': {
      if (context.isCombust === false) {
        return {
          modelId,
          valid: true,
          normalizedValue: 0,
          normalizedUnit: spec.outputUnit,
          qualitativeClass: 'not_combust',
          formulaTrace: 'is_combust=false -> 0',
          reason: 'Planet is outside Surya Siddhanta combustion orb.',
        };
      }

      const sep = typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : null;
      const orb =
        typeof context.combustionOrbDeg === 'number' &&
        Number.isFinite(context.combustionOrbDeg) &&
        context.combustionOrbDeg > 0
          ? context.combustionOrbDeg
          : null;

      if (sep === null || orb === null) {
        return {
          modelId,
          valid: Boolean(context.isCombust),
          normalizedValue: context.isCombust ? 0.5 : null,
          normalizedUnit: spec.outputUnit,
          qualitativeClass: context.isCombust ? 'combust_unmeasured_orb' : 'unavailable',
          formulaTrace: 'combust_without_complete_orb_metrics',
          reason: context.isCombust
            ? 'Combustion active without complete angular orb ratio.'
            : 'Insufficient combustion metrics.',
        };
      }

      const ratio = round4(clamp(1 - sep / orb, 0, 1));
      const qualitativeClass =
        ratio >= 0.65 ? 'deep_combustion' : ratio > 0 ? 'combust_within_orb' : 'not_combust';

      return {
        modelId,
        valid: true,
        normalizedValue: ratio,
        normalizedUnit: spec.outputUnit,
        qualitativeClass,
        formulaTrace: `1 - (${sep} / ${orb}) = ${ratio}`,
        reason: `Combustion penetration ratio ${ratio} (${sep}° / ${orb}° orb).`,
      };
    }

    case 'surya_siddhanta_graha_yuddha_gate': {
      if (context.inGrahaYuddha !== true) {
        return {
          modelId,
          valid: true,
          normalizedValue: 0,
          normalizedUnit: spec.outputUnit,
          qualitativeClass: 'inactive',
          formulaTrace: 'in_graha_yuddha=false -> 0',
          reason: 'Not engaged in Graha Yuddha.',
        };
      }

      const role = normToken(String(context.grahaYuddhaRole ?? rawValue ?? 'undetermined'));
      const val = role === 'winner' ? 0.5 : role === 'loser' ? -1.0 : -0.25;
      return {
        modelId,
        valid: true,
        normalizedValue: val,
        normalizedUnit: spec.outputUnit,
        qualitativeClass: `graha_yuddha_${role}`,
        formulaTrace: `role(${role}) -> ${val}`,
        reason: `Active Graha Yuddha role: ${role}.`,
      };
    }

    case 'gandanta_sandhi_boundary_gate': {
      const deg = typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : null;
      const isGandanta = context.isGandanta === true;

      if (deg === null && !isGandanta) {
        return {
          modelId,
          valid: false,
          normalizedValue: null,
          normalizedUnit: spec.outputUnit,
          qualitativeClass: 'unavailable',
          formulaTrace: 'missing_degree_in_sign',
          reason: 'Degree in sign unavailable for Sandhi/Gandanta check.',
        };
      }

      const edgeDist = deg !== null ? Math.min(deg, 30 - deg) : 0;
      const risk = isGandanta
        ? 1.0
        : edgeDist <= 1.0
        ? round4(clamp(1 - edgeDist, 0, 1))
        : 0;
      const qualitativeClass = isGandanta
        ? 'gandanta_junction'
        : edgeDist <= 1.0
        ? 'rashi_sandhi_boundary'
        : 'clear_of_boundary';

      return {
        modelId,
        valid: true,
        normalizedValue: risk,
        normalizedUnit: spec.outputUnit,
        qualitativeClass,
        formulaTrace: `isGandanta=${isGandanta}, edgeDist=${round4(edgeDist)} -> ${risk}`,
        reason: `Boundary risk=${risk} (${qualitativeClass}).`,
      };
    }

    case 'dispositor_chain_autonomy_lookup': {
      if (context.isSelfDisposited === true) {
        return {
          modelId,
          valid: true,
          normalizedValue: 1.0,
          normalizedUnit: spec.outputUnit,
          qualitativeClass: 'self_disposited',
          formulaTrace: 'isSelfDisposited=true -> 1.0',
          reason: 'Self-disposited in own sign (Swakshetra).',
        };
      }
      if (context.inParivartana === true) {
        return {
          modelId,
          valid: true,
          normalizedValue: 0.75,
          normalizedUnit: spec.outputUnit,
          qualitativeClass: 'parivartana_exchange',
          formulaTrace: 'inParivartana=true -> 0.75',
          reason: 'Connected via mutual sign exchange (Parivartana).',
        };
      }

      const term = typeof rawValue === 'string' && rawValue.trim() ? normToken(rawValue) : 'chained';
      const map = spec.parameters.categoryMap as Record<string, number>;
      const val = Object.prototype.hasOwnProperty.call(map, term) ? map[term] : 0.25;
      return {
        modelId,
        valid: true,
        normalizedValue: val,
        normalizedUnit: spec.outputUnit,
        qualitativeClass: term,
        formulaTrace: `categoryMap[${term}] -> ${val}`,
        reason: `Dispositor termination class "${term}" (${val}).`,
      };
    }

    case 'cross_frame_divergence_index':
    case 'k02_conflict_classification':
    case 'k02_modification_catalog':
    case 'nodal_condition_qualitative':
    case 'ascendant_condition_qualitative':
    case 'phi_overlap_deduplication_projection': {
      const count = typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : null;
      return {
        modelId,
        valid: true,
        normalizedValue: count,
        normalizedUnit: spec.outputUnit,
        qualitativeClass: count !== null ? `count_${count}` : 'evaluated',
        formulaTrace: `${modelId}(count=${count ?? 'null'})`,
        reason: `Evaluated ${modelId} deterministically.`,
      };
    }

    case 'k02_reliability_trust_floor': {
      const trust = typeof rawValue === 'string' ? normToken(rawValue) : 'blocked';
      const map = spec.parameters as Record<string, number>;
      const rank = Object.prototype.hasOwnProperty.call(map, trust) ? map[trust] : 0;
      return {
        modelId,
        valid: true,
        normalizedValue: rank,
        normalizedUnit: spec.outputUnit,
        qualitativeClass: trust,
        formulaTrace: `trustFloor(${trust}) = ${rank}`,
        reason: `Reliability trust floor "${trust}" (rank ${rank}).`,
      };
    }

    // =========================================================================
    // R07 Graph & Set Mathematical Models (K04 Relational Intelligence)
    // =========================================================================
    case 'unique_entity_counting': {
      const rawEntities = context.entities ?? [];
      const uniqueEntities = Array.from(new Set(rawEntities.filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      );
      const duplicateInputCount = Math.max(0, rawEntities.length - uniqueEntities.length);
      return {
        modelId,
        valid: true,
        normalizedValue: uniqueEntities.length,
        normalizedUnit: spec.outputUnit,
        qualitativeClass: uniqueEntities.length === 0 ? 'empty_set' : 'deduplicated_count',
        formulaTrace: `|Set(${rawEntities.length} inputs)| = ${uniqueEntities.length}`,
        reason: `Counted ${uniqueEntities.length} unique entities (${duplicateInputCount} duplicate references collapsed).`,
        r07Output: {
          uniqueEntities,
          duplicateInputCount,
        },
      };
    }

    case 'graph_reachability': {
      const maxDepth = clamp(Math.floor(context.maxDepth ?? 12), 0, 64);
      const maxSteps = clamp(Math.floor(context.maxSteps ?? 256), 1, 4096);
      const { adj } = buildSortedAdjacency(context.adjacency ?? {}, context.entities ?? []);
      const starts = Array.from(new Set(context.startNodes ?? [])).sort((a, b) =>
        a.localeCompare(b)
      );
      const depthByEntity: Record<string, number> = {};
      const startSet = new Set(starts);
      const queue: Array<{ node: string; depth: number }> = [];

      for (const s of starts) {
        depthByEntity[s] = 0;
        queue.push({ node: s, depth: 0 });
      }

      let steps = 0;
      let visitedLimitReached = false;
      let truncatedByDepth = false;
      const reachableSet = new Set<string>();
      if (context.includeStartInReachable) {
        for (const s of starts) reachableSet.add(s);
      }

      while (queue.length > 0) {
        const current = queue.shift()!;
        const neighbors = adj.get(current.node) ?? [];
        if (neighbors.length === 0) continue;

        if (current.depth >= maxDepth) {
          truncatedByDepth = true;
          continue;
        }

        for (const next of neighbors) {
          if (steps >= maxSteps) {
            visitedLimitReached = true;
            break;
          }
          steps += 1;
          reachableSet.add(next);
          if (depthByEntity[next] === undefined) {
            depthByEntity[next] = current.depth + 1;
            queue.push({ node: next, depth: current.depth + 1 });
          }
        }
        if (visitedLimitReached) break;
      }

      const reachableEntities = Array.from(reachableSet).sort((a, b) => a.localeCompare(b));
      const visitedAllEntities = Array.from(
        new Set([...startSet, ...reachableEntities])
      ).sort((a, b) => a.localeCompare(b));

      return {
        modelId,
        valid: true,
        normalizedValue: reachableEntities.length,
        normalizedUnit: spec.outputUnit,
        qualitativeClass:
          visitedLimitReached || truncatedByDepth ? 'bounded_partial_reachability' : 'complete_reachability',
        formulaTrace: `bfs(starts=${starts.length}, maxDepth=${maxDepth}, maxSteps=${maxSteps}) -> ${reachableEntities.length}`,
        reason: `Reached ${reachableEntities.length} unique entities within maxDepth=${maxDepth}, steps=${steps}.`,
        r07Output: {
          reachableEntities,
          visitedAllEntities,
          depthByEntity,
          visitedLimitReached,
          truncatedByDepth,
        },
      };
    }

    case 'dependency_path_length': {
      const start = context.startNodes?.[0];
      if (!start) {
        return {
          modelId,
          valid: false,
          normalizedValue: null,
          normalizedUnit: spec.outputUnit,
          qualitativeClass: 'unavailable',
          formulaTrace: 'missing_start_node',
          reason: 'dependency_path_length requires a startNode.',
          r07Output: { pathLength: null, shortestPath: null },
        };
      }
      const maxDepth = clamp(Math.floor(context.maxDepth ?? 12), 0, 64);
      const maxSteps = clamp(Math.floor(context.maxSteps ?? 256), 1, 4096);
      const { adj } = buildSortedAdjacency(context.adjacency ?? {}, context.entities ?? []);
      const target = context.targetNode;

      if (target && target === start) {
        return {
          modelId,
          valid: true,
          normalizedValue: 0,
          normalizedUnit: spec.outputUnit,
          qualitativeClass: 'zero_hop_self',
          formulaTrace: `dist(${start} -> ${target}) = 0`,
          reason: `Source and target match (${start}); hop length = 0.`,
          r07Output: { pathLength: 0, shortestPath: [start], visitedLimitReached: false, truncatedByDepth: false },
        };
      }

      const visited = new Set<string>([start]);
      const parent = new Map<string, string>();
      const queue: Array<{ node: string; depth: number }> = [{ node: start, depth: 0 }];
      let maxObservedDepth = 0;
      let deepestNode = start;
      let steps = 0;
      let visitedLimitReached = false;
      let truncatedByDepth = false;
      let foundTargetDepth: number | null = null;

      while (queue.length > 0) {
        const cur = queue.shift()!;
        if (cur.depth > maxObservedDepth) {
          maxObservedDepth = cur.depth;
          deepestNode = cur.node;
        }
        const neighbors = adj.get(cur.node) ?? [];
        if (neighbors.length === 0) continue;
        if (cur.depth >= maxDepth) {
          truncatedByDepth = true;
          continue;
        }
        for (const next of neighbors) {
          if (steps >= maxSteps) {
            visitedLimitReached = true;
            break;
          }
          steps += 1;
          if (!visited.has(next)) {
            visited.add(next);
            parent.set(next, cur.node);
            if (target && next === target) {
              foundTargetDepth = cur.depth + 1;
              break;
            }
            queue.push({ node: next, depth: cur.depth + 1 });
          }
        }
        if (foundTargetDepth !== null || visitedLimitReached) break;
      }

      if (target && foundTargetDepth === null) {
        return {
          modelId,
          valid: false,
          normalizedValue: null,
          normalizedUnit: spec.outputUnit,
          qualitativeClass: 'unreachable',
          formulaTrace: `dist(${start} -> ${target}) = unreachable`,
          reason: `No directed path from ${start} to ${target} within bounds (maxDepth=${maxDepth}, maxSteps=${maxSteps}).`,
          r07Output: { pathLength: null, shortestPath: null, visitedLimitReached, truncatedByDepth },
        };
      }

      const endNode = target ?? deepestNode;
      const len = foundTargetDepth ?? maxObservedDepth;
      const path: string[] = [];
      let trace: string | undefined = endNode;
      while (trace !== undefined) {
        path.unshift(trace);
        if (trace === start) break;
        trace = parent.get(trace);
      }

      return {
        modelId,
        valid: true,
        normalizedValue: len,
        normalizedUnit: spec.outputUnit,
        qualitativeClass: `hops_${len}`,
        formulaTrace: `dist(${start} -> ${endNode}) = ${len}`,
        reason: `Computed directed dependency path length ${len} from ${start} to ${endNode}.`,
        r07Output: {
          pathLength: len,
          shortestPath: path,
          visitedLimitReached,
          truncatedByDepth,
        },
      };
    }

    case 'scc_detection': {
      const { sccs, unresolvedLeafNodes } = runDeterministicTarjanScc(
        context.adjacency ?? {},
        context.entities ?? []
      );
      const cyclicSccCount = sccs.filter((s) => s.isCycle).length;
      const selfLoopCount = sccs.filter((s) => s.hasSelfLoop).length;
      const terminalSinkSccIds = sccs
        .filter((s) => s.isTrueDispositorSink)
        .map((s) => s.sccId);

      return {
        modelId,
        valid: true,
        normalizedValue: sccs.length,
        normalizedUnit: spec.outputUnit,
        qualitativeClass:
          cyclicSccCount > 0 ? `sccs_${sccs.length}_cycles_${cyclicSccCount}` : `acyclic_${sccs.length}`,
        formulaTrace: `tarjan_scc(total=${sccs.length}, cyclic=${cyclicSccCount}, trueSinks=${terminalSinkSccIds.length})`,
        reason: `Detected ${sccs.length} SCCs (${cyclicSccCount} cyclic, ${selfLoopCount} self-loops, ${terminalSinkSccIds.length} true terminal sinks).`,
        r07Output: {
          sccs,
          cyclicSccCount,
          selfLoopCount,
          terminalSinkSccIds,
          unresolvedLeafNodes,
        },
      };
    }

    case 'terminal_basin_assignment': {
      const { nodes, sccs, sccIdByNode } = runDeterministicTarjanScc(
        context.adjacency ?? {},
        context.entities ?? []
      );
      const sccById = new Map(sccs.map((s) => [s.sccId, s]));
      const sinkBasinBySccId = new Map<string, R07TerminalBasinSummary>();

      let basinIdx = 0;
      for (const scc of sccs) {
        if (!scc.isTrueDispositorSink) continue;
        basinIdx += 1;
        const basinId = `basin_${basinIdx}_${scc.hasSelfLoop ? 'self' : 'cycle'}_${scc.members[0]}`;
        sinkBasinBySccId.set(scc.sccId, {
          basinId,
          sinkSccId: scc.sccId,
          terminalKind: scc.hasSelfLoop && scc.size === 1 ? 'self_disposited' : 'cycle',
          sinkMembers: [...scc.members],
          assignedEntities: [],
          assignedCount: 0,
        });
      }

      // Memoized condensation DAG reachability from each SCC to true terminal sink basins
      const reachableBasinsCache = new Map<string, string[]>();
      const resolveSccBasins = (sccId: string, activeStack: Set<string>): string[] => {
        if (reachableBasinsCache.has(sccId)) return reachableBasinsCache.get(sccId)!;
        const sink = sinkBasinBySccId.get(sccId);
        if (sink) {
          const out = [sink.basinId];
          reachableBasinsCache.set(sccId, out);
          return out;
        }
        const scc = sccById.get(sccId);
        if (!scc || scc.outgoingSccIds.length === 0 || activeStack.has(sccId)) {
          reachableBasinsCache.set(sccId, []);
          return [];
        }
        activeStack.add(sccId);
        const found = new Set<string>();
        for (const nextSccId of scc.outgoingSccIds) {
          for (const bId of resolveSccBasins(nextSccId, activeStack)) {
            found.add(bId);
          }
        }
        activeStack.delete(sccId);
        const out = Array.from(found).sort((a, b) => a.localeCompare(b));
        reachableBasinsCache.set(sccId, out);
        return out;
      };

      const basinByEntity: Record<string, string[]> = {};
      const unassignedEntities: string[] = [];
      const multiBasinEntities: string[] = [];
      let assignedCount = 0;

      for (const node of nodes) {
        const sccId = sccIdByNode.get(node)!;
        const basinIds = resolveSccBasins(sccId, new Set());
        basinByEntity[node] = basinIds;
        if (basinIds.length === 0) {
          unassignedEntities.push(node);
        } else {
          assignedCount += 1;
          if (basinIds.length > 1) {
            multiBasinEntities.push(node);
          } else {
            const summary = Array.from(sinkBasinBySccId.values()).find(
              (b) => b.basinId === basinIds[0]
            );
            if (summary) {
              summary.assignedEntities.push(node);
              summary.assignedCount += 1;
            }
          }
        }
      }

      const basins = Array.from(sinkBasinBySccId.values()).map((b) => ({
        ...b,
        assignedEntities: [...b.assignedEntities].sort((a, b2) => a.localeCompare(b2)),
      }));
      const isComplete = unassignedEntities.length === 0 && multiBasinEntities.length === 0 && nodes.length > 0;

      return {
        modelId,
        valid: true,
        normalizedValue: assignedCount,
        normalizedUnit: spec.outputUnit,
        qualitativeClass: isComplete
          ? basins.length === 1
            ? 'complete_single_basin'
            : 'complete_multi_basin'
          : 'incomplete_basin_assignment',
        formulaTrace: `basins=${basins.length}, assigned=${assignedCount}/${nodes.length}, unassigned=${unassignedEntities.length}`,
        reason: `Assigned ${assignedCount}/${nodes.length} entities across ${basins.length} terminal basin(s) (${unassignedEntities.length} unassigned).`,
        r07Output: {
          sccs,
          basins,
          basinByEntity,
          unassignedEntities,
          multiBasinEntities,
          isComplete,
        },
      };
    }

    case 'dependency_concentration_dci': {
      const rawBasinCounts = context.basinCounts;
      const entries: Array<[string, number]> = Array.isArray(rawBasinCounts)
        ? rawBasinCounts.map((c, idx) => [`basin_${idx + 1}`, Number(c)])
        : Object.entries(rawBasinCounts ?? {}).map(([k, v]) => [k, Number(v)]);

      const validEntries = entries.filter(([, v]) => Number.isFinite(v) && v >= 0);
      const assignedPopulation = validEntries.reduce((acc, [, v]) => acc + v, 0);
      const explicitMissing =
        typeof context.excludedOrMissingCount === 'number' &&
        Number.isFinite(context.excludedOrMissingCount) &&
        context.excludedOrMissingCount > 0
          ? context.excludedOrMissingCount
          : 0;
      const expectedPopulation =
        typeof context.totalExpectedPopulation === 'number' &&
        Number.isFinite(context.totalExpectedPopulation) &&
        context.totalExpectedPopulation > 0
          ? context.totalExpectedPopulation
          : typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue > 0
          ? rawValue
          : assignedPopulation + explicitMissing;

      if (expectedPopulation <= 0 || validEntries.length === 0 && explicitMissing === 0) {
        return {
          modelId,
          valid: false,
          normalizedValue: null,
          normalizedUnit: spec.outputUnit,
          qualitativeClass: 'unavailable',
          formulaTrace: 'empty_basin_population',
          reason: 'No positive entity population provided for DCI calculation.',
          r07Output: {
            dciOutput: {
              dci: null,
              isComplete: false,
              renormalized: false,
              expectedPopulation: 0,
              assignedPopulation: 0,
              missingPopulation: 0,
              proportionsByBasin: {},
            },
          },
        };
      }

      const missingPopulation = Math.max(0, expectedPopulation - assignedPopulation);
      const isComplete = missingPopulation === 0 && assignedPopulation > 0;
      const proportionsByBasin: Record<string, number> = {};
      let dciSum = 0;

      // CRITICAL: Divide by expectedPopulation, NEVER silently renormalize by assignedPopulation when incomplete.
      for (const [bId, count] of validEntries) {
        const p = count / expectedPopulation;
        proportionsByBasin[bId] = round6(p);
        dciSum += p * p;
      }

      const dci = round6(dciSum);
      const qualitativeClass = !isComplete
        ? 'incomplete_non_renormalized'
        : dci >= 0.999999
        ? 'single_basin_monocentric'
        : dci >= 0.5
        ? 'concentrated_polycentric'
        : 'dispersed_polycentric';

      return {
        modelId,
        valid: true,
        normalizedValue: dci,
        normalizedUnit: spec.outputUnit,
        qualitativeClass,
        formulaTrace: `sum((c_i / ${expectedPopulation})^2) = ${dci} [isComplete=${isComplete}, renormalized=false]`,
        reason: isComplete
          ? `Computed complete DCI=${dci} across ${validEntries.length} basin(s) (${assignedPopulation}/${expectedPopulation} entities).`
          : `Computed non-renormalized incomplete DCI=${dci} (${assignedPopulation}/${expectedPopulation} assigned, ${missingPopulation} missing).`,
        r07Output: {
          dciOutput: {
            dci,
            isComplete,
            renormalized: false,
            expectedPopulation,
            assignedPopulation,
            missingPopulation,
            proportionsByBasin,
          },
        },
      };
    }

    case 'set_intersection': {
      const a = Array.from(new Set(context.setA ?? [])).sort((x, y) => x.localeCompare(y));
      const bSet = new Set(context.setB ?? []);
      const items = a.filter((x) => bSet.has(x));
      return {
        modelId,
        valid: true,
        normalizedValue: items.length,
        normalizedUnit: spec.outputUnit,
        qualitativeClass: items.length === 0 ? 'disjoint' : 'intersecting',
        formulaTrace: `|setA ∩ setB| = ${items.length}`,
        reason: `Computed set intersection of size ${items.length}.`,
        r07Output: { items },
      };
    }

    case 'set_union': {
      const items = Array.from(
        new Set([...(context.setA ?? []), ...(context.setB ?? [])])
      ).sort((x, y) => x.localeCompare(y));
      return {
        modelId,
        valid: true,
        normalizedValue: items.length,
        normalizedUnit: spec.outputUnit,
        qualitativeClass: items.length === 0 ? 'empty' : 'union_computed',
        formulaTrace: `|setA ∪ setB| = ${items.length}`,
        reason: `Computed set union of size ${items.length}.`,
        r07Output: { items },
      };
    }

    case 'jaccard_overlap': {
      const a = Array.from(new Set(context.setA ?? [])).sort((x, y) => x.localeCompare(y));
      const b = Array.from(new Set(context.setB ?? [])).sort((x, y) => x.localeCompare(y));
      const bSet = new Set(b);
      const intersection = a.filter((x) => bSet.has(x));
      const union = Array.from(new Set([...a, ...b]));
      const jaccard = union.length === 0 ? 0 : round6(intersection.length / union.length);
      return {
        modelId,
        valid: true,
        normalizedValue: jaccard,
        normalizedUnit: spec.outputUnit,
        qualitativeClass:
          union.length === 0
            ? 'empty_sets'
            : jaccard === 1
            ? 'identical'
            : jaccard === 0
            ? 'disjoint'
            : 'partial_overlap',
        formulaTrace: `${intersection.length} / ${union.length || 1} = ${jaccard}`,
        reason: `Computed Jaccard overlap ${jaccard} (${intersection.length}/${union.length}).`,
        r07Output: {
          items: intersection,
          jaccard,
          intersectionSize: intersection.length,
          unionSize: union.length,
        },
      };
    }

    default:
      throw new UnregisteredMathModelError(modelId);
  }
}
