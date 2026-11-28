/**
 * CosmicCouncil Proprietary Analytical Intelligence Kernel — R04 Methodological Authority Registry
 *
 * Pure TypeScript / Web-standard implementation (zero Node built-ins; Cloudflare Workers safe).
 * Registers deterministic R04 authority rules covering:
 *  - All 10 initial AnalyticalObjectiveId entries
 *  - Classical BPHS Ch. 34 Lagna-specific Functional Benefic / Malefic / Yogakaraka / Maraka rules
 *    across all 12 Vedic Lagnas (Aries..Pisces)
 *  - Explicit non-universal handling for Rahu, Ketu, and Ascendant
 *  - Strict UnregisteredRuleError guard (rejects unknown rule IDs or version mismatches)
 *
 * Zero arbitrary authority percentages, zero undocumented numerical weights, zero LLM calls.
 */

import {
  ANALYTICAL_OBJECTIVE_IDS,
  R04_AUTHORITY_REGISTRY_VERSION,
  type AnalyticalObjectiveId,
  type K03AuthorityMethodology,
  type R04AuthorityRuleDefinition,
  type R04LagnaFunctionalSpecification,
  type R04RuleRegistrySnapshot,
  type VedicRashiSign,
} from './k03Types';
import {
  PLANETARY_STATE_SUBJECTS,
  UnregisteredRuleError,
  type PhiReadyPlanetName,
  type PlanetaryStateSubjectName,
} from './types';

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const val of Object.values(obj as Record<string, unknown>)) {
      deepFreeze(val);
    }
  }
  return obj;
}

const ALL_TEN_SUBJECTS: readonly PlanetaryStateSubjectName[] = [...PLANETARY_STATE_SUBJECTS];
const CLASSICAL_SEVEN: readonly PhiReadyPlanetName[] = [
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
];
const ALL_NINE_GRAHAS: readonly PlanetaryStateSubjectName[] = [...CLASSICAL_SEVEN, 'Rahu', 'Ketu'];

const VEDIC_SIGN_LORDS_BY_SIGN: Readonly<Record<VedicRashiSign, PhiReadyPlanetName>> = Object.freeze({
  Aries: 'Mars',
  Taurus: 'Venus',
  Gemini: 'Mercury',
  Cancer: 'Moon',
  Leo: 'Sun',
  Virgo: 'Mercury',
  Libra: 'Venus',
  Scorpio: 'Mars',
  Sagittarius: 'Jupiter',
  Capricorn: 'Saturn',
  Aquarius: 'Saturn',
  Pisces: 'Jupiter',
});

const ORDERED_VEDIC_SIGNS: readonly VedicRashiSign[] = Object.freeze([
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
]);

function buildHouseLordshipsForLagna(
  lagnaSign: VedicRashiSign
): Readonly<Record<number, PhiReadyPlanetName>> {
  const startIdx = ORDERED_VEDIC_SIGNS.indexOf(lagnaSign);
  const map: Record<number, PhiReadyPlanetName> = {};
  for (let h = 1; h <= 12; h++) {
    const sign = ORDERED_VEDIC_SIGNS[(startIdx + (h - 1)) % 12];
    map[h] = VEDIC_SIGN_LORDS_BY_SIGN[sign];
  }
  return Object.freeze(map);
}

// ============================================================================
// 1. Core R04 Rules Across Objectives 1..9
// ============================================================================

const CORE_R04_RULES: R04AuthorityRuleDefinition[] = [
  {
    ruleId: 'R04_PARASHARI_QUANTITATIVE_CAPACITY_SHADBALA',
    version: '1.0.0',
    title: 'Parashari Shadbala & Ishta/Kashta Provisional Quantitative Authority Gate',
    applicableMethodology: 'vedic_parashari',
    applicableAnalyticalObjective: 'planetary_quantitative_capacity',
    applicableSubjects: [...CLASSICAL_SEVEN],
    requiredEvidence: {
      observationCodes: ['SHADBALA_MAJOR_SIX_BALA', 'SHADBALA_SUBCOMPONENT_BUCKET', 'ISHTA_KASHTA_PHALA'],
      families: ['quantitative'],
      minimumRequiredCount: 1,
    },
    permittedChartFrames: ['vedic_lahiri'],
    qualificationPredicates: [
      'subject_is_classical_seven_planet',
      'frame_equals_vedic_lahiri',
      'temporal_scope_equals_natal_invariant',
      'measurement_total_virupas_is_finite_positive',
    ],
    exclusionConditions: [
      'subject_is_rahu_ketu_or_ascendant',
      'shadbala_value_is_null_or_non_finite_zero_coercion_guard',
      'provisional_ceiling_forbids_AC1_decisive_promotion',
      'subcomponent_double_counting_with_aggregate_forbidden',
    ],
    authorityClassification: {
      defaultClass: 'AC3',
      provisionalCapClass: 'AC3',
      conditionalRules: [
        {
          conditionKey: 'issue_register_provisional_gate_active',
          resultingClass: 'AC3',
          rationale:
            'While shadbalaReconciliation.authoritativeDesignation is unassigned_pending_reconciliation (docs/SHADBALA_BHAVABALA_ISSUE_REGISTER.md), Layer 1 caps Shadbala at AC3 Significant (never AC1).',
        },
        {
          conditionKey: 'shadbala_subcomponent_or_ishta_overlap_sibling',
          resultingClass: 'AC5',
          rationale:
            'Preserved subcomponents and Ishta/Kashta overlap mathematically with aggregate SHADBALA_MAJOR_SIX_BALA and classify as AC5 Background when evaluated alongside the aggregate.',
        },
      ],
    },
    dependenciesAndLimitations: [
      'Subject to Issues #1-#6 in docs/SHADBALA_BHAVABALA_ISSUE_REGISTER.md (Bhava Madhya, Kala Bala rollup, Luminary Cheshta, Sun 5.0 vs 6.5 threshold).',
      'Shadbala must never globally override classical Rashi dignity.',
    ],
    sourceOrMethodologicalJustification: {
      sourceType: 'classical',
      referenceCode: 'BPHS_CH27_SHADBALA_PROVISIONAL_GATE',
      citation: 'BPHS Ch. 27 Six-Fold Strength gated under Layer 1 provisional ceiling pending external JHora/PyJHora validation.',
      notes: 'Preserves all original provider subcomponents and Ishta/Kashta without scalar averaging.',
    },
    verificationStatus: {
      computational: 'provisional',
      methodological: 'contested_or_uncalibrated',
      empirical: 'not_validated',
    },
    regressionTestReferences: ['k03_r04_shadbala_provisional_cap', 'verifyV2Engine:shadbala_reconciliation'],
  },
  {
    ruleId: 'R04_PARASHARI_ASHTAKAVARGA_CAPACITY',
    version: '1.0.0',
    title: 'Parashari Bhinnashtakavarga (BAV) & Derivative Overlap Authority',
    applicableMethodology: 'vedic_parashari',
    applicableAnalyticalObjective: 'planetary_quantitative_capacity',
    applicableSubjects: [...CLASSICAL_SEVEN],
    requiredEvidence: {
      observationCodes: ['ASHTAKAVARGA_BHINNA_BAV', 'ASHTAKAVARGA_PRASTARA', 'ASHTAKAVARGA_SHODHANA_PINDA'],
      families: ['quantitative', 'modification'],
      minimumRequiredCount: 1,
    },
    permittedChartFrames: ['vedic_lahiri'],
    qualificationPredicates: [
      'subject_is_classical_seven_planet',
      'frame_equals_vedic_lahiri',
      'bav_bindus_finite_0_to_8',
    ],
    exclusionConditions: [
      'subject_is_rahu_ketu_or_ascendant',
      'dataset_unavailable_zero_coercion_guard',
      'prastara_and_shodhya_pinda_overlap_with_bav_must_not_double_count',
    ],
    authorityClassification: {
      defaultClass: 'AC2',
      provisionalCapClass: 'AC3',
      conditionalRules: [
        {
          conditionKey: 'primary_bav_verified_internal',
          resultingClass: 'AC2',
          rationale:
            'Internally verified BAV bindus (cross-checked against 8x12 Prastara sum & 337 total) serve as AC2 Primary quantitative capacity evidence.',
        },
        {
          conditionKey: 'prastara_or_shodhana_partial_overlap_derivative',
          resultingClass: 'AC4',
          rationale:
            'Prastara and Shodhya Pinda derivatives remain preserved for lineage audit as AC4 Supporting without double-counting BAV.',
        },
      ],
    },
    dependenciesAndLimitations: [
      'Applies strictly to 7 classical planets.',
      'Requires raw vs hybrid-local Ashtakavarga provenance transparency.',
    ],
    sourceOrMethodologicalJustification: {
      sourceType: 'classical',
      referenceCode: 'BPHS_ASHTAKAVARGA_BAV_AUTHORITY',
      citation: 'BPHS Ch. 66-72 Ashtakavarga (337-bindu invariant & Trikona/Ekadhipatya reductions).',
      notes: 'Preserves Prastara, BAV, and Shodhana derivatives while preventing double-counting.',
    },
    verificationStatus: {
      computational: 'verified_internal',
      methodological: 'classical_standard',
      empirical: 'not_validated',
    },
    regressionTestReferences: ['k03_r04_ashtakavarga_overlap_guard', 'auditVerificationReport:ashtakavarga'],
  },
  {
    ruleId: 'R04_PARASHARI_VIMSHOPAKA_CAPACITY',
    version: '1.0.0',
    title: 'Parashari Vimshopaka Divisional Capacity & Multi-Scheme Deduplication',
    applicableMethodology: 'vedic_parashari',
    applicableAnalyticalObjective: 'planetary_quantitative_capacity',
    applicableSubjects: [...CLASSICAL_SEVEN],
    requiredEvidence: {
      observationCodes: ['VIMSHOPAKA_BALA_SCHEME'],
      families: ['quantitative'],
      minimumRequiredCount: 1,
    },
    permittedChartFrames: ['vedic_lahiri'],
    qualificationPredicates: [
      'subject_is_classical_seven_planet',
      'all_required_vargas_for_scheme_present',
      'score_out_of_20_is_finite',
    ],
    exclusionConditions: [
      'incomplete_varga_scheme_blocked_zero_coercion',
      'secondary_scheme_when_shodashvarga_present',
    ],
    authorityClassification: {
      defaultClass: 'AC2',
      provisionalCapClass: 'AC3',
      conditionalRules: [
        {
          conditionKey: 'preferred_shodashvarga_scheme',
          resultingClass: 'AC2',
          rationale: 'Complete Shodashvarga Vimshopaka qualifies as AC2 Primary quantitative varga capacity.',
        },
        {
          conditionKey: 'secondary_overlapping_vimshopaka_scheme',
          resultingClass: 'AC5',
          rationale: 'Lower-granularity sibling schemes (Dashavarga/Saptavarga/Shadvarga) classify as AC5 Background when Shodashvarga is present.',
        },
      ],
    },
    dependenciesAndLimitations: ['Depends on completeness of underlying divisional charts D1..D60.'],
    sourceOrMethodologicalJustification: {
      sourceType: 'classical',
      referenceCode: 'BPHS_CH6_VIMSHOPAKA_AUTHORITY',
      citation: 'BPHS Ch. 6 Shodashvarga Vimshopaka Bala (20-point scale).',
      notes: 'Enforces single representative scheme per planet to prevent cross-scheme double-counting.',
    },
    verificationStatus: {
      computational: 'verified_internal',
      methodological: 'classical_standard',
      empirical: 'not_validated',
    },
    regressionTestReferences: ['k03_r04_vimshopaka_dedup'],
  },
  {
    ruleId: 'R04_PARASHARI_D1_DIGNITY_AND_CONDITION',
    version: '1.0.0',
    title: 'Parashari D1 Rashi Dignity, Placement & Operating Condition Authority',
    applicableMethodology: 'vedic_parashari',
    applicableAnalyticalObjective: 'planetary_dignity_and_positional_condition',
    applicableSubjects: [...ALL_NINE_GRAHAS],
    requiredEvidence: {
      observationCodes: [
        'VEDIC_D1_DIGNITY',
        'VEDIC_D1_SIGN_HOUSE_PLACEMENT',
        'VEDIC_D1_PLANET_LONGITUDE',
        'VEDIC_PLANET_OPERATING_CONDITIONS',
        'MODIFIER_COMBUSTION_ASTA',
        'MODIFIER_GANDANTA_JUNCTION',
        'MODIFIER_GRAHA_YUDDHA',
      ],
      families: ['positional', 'degree_level', 'operating_condition', 'modification'],
      minimumRequiredCount: 1,
    },
    permittedChartFrames: ['vedic_lahiri'],
    qualificationPredicates: [
      'frame_equals_vedic_lahiri',
      'temporal_scope_equals_natal_invariant',
      'valid_sidereal_longitude_and_sign_assignment',
    ],
    exclusionConditions: [
      'frame_is_western_tropical_or_kp_placidus',
      'nodal_dignity_contested_when_node_convention_uncertain',
    ],
    authorityClassification: {
      defaultClass: 'AC2',
      provisionalCapClass: 'AC3',
      conditionalRules: [
        {
          conditionKey: 'usable_classical_dignity_or_verified_operating_condition',
          resultingClass: 'AC1',
          rationale:
            'Decisive (AC1) strictly for qualifying the planetary positional/dignity/combustion/gandanta condition itself when usable and uncontested.',
        },
        {
          conditionKey: 'nodal_or_sandhi_sensitive_condition',
          resultingClass: 'AC3',
          rationale:
            'Rahu/Ketu dignity conventions or <=1deg Sandhi positions carry methodological/birth-time sensitivity and cap at AC3.',
        },
      ],
    },
    dependenciesAndLimitations: [
      'AC1 qualifies only the D1 astrological condition (e.g., Exalted/Debilitated/Combust), NEVER a real-world life outcome.',
      'Does not auto-cancel D1 debilitation using D9.',
    ],
    sourceOrMethodologicalJustification: {
      sourceType: 'classical',
      referenceCode: 'BPHS_SURYA_SIDDHANTA_DIGNITY_CONDITIONS',
      citation: 'BPHS D1 Rashis & Dignities; Surya Siddhanta Combustion (Asta) and Graha Yuddha.',
      notes: 'Preserves multidimensional tension rather than letting Shadbala overwrite dignity.',
    },
    verificationStatus: {
      computational: 'verified_internal',
      methodological: 'classical_standard',
      empirical: 'not_validated',
    },
    regressionTestReferences: ['k03_r04_d1_dignity_ac1_qualification', 'verifyV2Engine:operating_conditions'],
  },
  {
    ruleId: 'R04_WESTERN_ESSENTIAL_DIGNITY_ISOLATED',
    version: '1.0.0',
    title: 'Western Tropical Traditional Essential Dignity Frame-Isolated Authority',
    applicableMethodology: 'western_tropical',
    applicableAnalyticalObjective: 'planetary_dignity_and_positional_condition',
    applicableSubjects: [...ALL_NINE_GRAHAS],
    requiredEvidence: {
      observationCodes: ['WESTERN_ESSENTIAL_DIGNITY', 'WESTERN_TROPICAL_PLACEMENT', 'WESTERN_TROPICAL_PLANET_LONGITUDE'],
      families: ['positional', 'degree_level', 'operating_condition'],
      minimumRequiredCount: 1,
    },
    permittedChartFrames: ['western_tropical'],
    qualificationPredicates: ['frame_equals_western_tropical', 'sayana_tropical_longitude_present'],
    exclusionConditions: [
      'cannot_be_merged_into_vedic_lahiri_dignity',
      'missing_western_tropical_dataset',
    ],
    authorityClassification: {
      defaultClass: 'AC2',
      provisionalCapClass: 'AC3',
      conditionalRules: [
        {
          conditionKey: 'western_tropical_frame_isolated',
          resultingClass: 'AC2',
          rationale: 'Primary evidence strictly within western_tropical evaluations; isolated from sidereal Vedic frames.',
        },
      ],
    },
    dependenciesAndLimitations: ['Strictly prohibited from overriding or averaging with Vedic Lahiri D1 dignity.'],
    sourceOrMethodologicalJustification: {
      sourceType: 'classical',
      referenceCode: 'PTOLEMAIC_WESTERN_DIGNITY_ISOLATED',
      citation: 'Traditional Ptolemaic Domicile, Exaltation, Triplicity, Term, and Face within Sayana zodiac.',
      notes: 'Cross-frame differences with Vedic Lahiri are preserved as cross-frame contrasts.',
    },
    verificationStatus: {
      computational: 'provider_reported',
      methodological: 'classical_standard',
      empirical: 'not_validated',
    },
    regressionTestReferences: ['k03_r04_western_frame_isolation'],
  },
  {
    ruleId: 'R04_CROSS_TRADITION_PHI_HEALTH_CONTRIBUTION',
    version: '1.0.0',
    title: 'Intrinsic Planetary Health Evidence Authority Gate (Non-Overlapping)',
    applicableMethodology: 'cross_tradition',
    applicableAnalyticalObjective: 'planetary_health_evidence',
    applicableSubjects: [...CLASSICAL_SEVEN],
    requiredEvidence: {
      observationCodes: [
        'VEDIC_D1_DIGNITY',
        'ASHTAKAVARGA_BHINNA_BAV',
        'VIMSHOPAKA_BALA_SCHEME',
        'SHADBALA_MAJOR_SIX_BALA',
        'VEDIC_VARGA_PLACEMENT',
        'VEDIC_PLANET_OPERATING_CONDITIONS',
      ],
      families: ['quantitative', 'operating_condition', 'divisional', 'modification'],
      minimumRequiredCount: 1,
    },
    permittedChartFrames: ['vedic_lahiri', 'astronomical_telemetry'],
    qualificationPredicates: [
      'subject_is_classical_seven_planet',
      'temporal_scope_equals_natal_invariant',
      'not_p08_house_ownership_noise',
    ],
    exclusionConditions: [
      'temporal_evidence_quarantined',
      'p08_house_lordship_significators_excluded_from_phi_health',
      'subject_is_rahu_ketu_or_ascendant',
      'partial_overlap_secondary_sibling_excluded_from_double_counting',
    ],
    authorityClassification: {
      defaultClass: 'AC2',
      provisionalCapClass: 'AC3',
      conditionalRules: [
        {
          conditionKey: 'usable_non_overlapping_intrinsic_evidence',
          resultingClass: 'AC2',
          rationale: 'Usable, deduplicated intrinsic condition evidence holds AC2 Primary authority for planetary health evaluation.',
        },
        {
          conditionKey: 'provisional_shadbala_or_avastha_contribution',
          resultingClass: 'AC3',
          rationale: 'Provisional Shadbala and Avastha entries remain capped at AC3 with explicit caveat.',
        },
      ],
    },
    dependenciesAndLimitations: [
      'Does NOT compute scalar PHI scores or weights.',
      'Preserves tension between dignity, Shadbala, and combustion/war without flattening.',
    ],
    sourceOrMethodologicalJustification: {
      sourceType: 'methodological_governance',
      referenceCode: 'K03_PHI_HEALTH_AUTHORITY_GATE',
      citation: 'CosmicCouncil K02/K03 Intrinsic Health Boundary Contract (overlap-free, zero temporal/Lagna leakage).',
      notes: 'Prevents Shadbala from overriding classical Rashi dignity and protects PHI against temporal or P08 contamination.',
    },
    verificationStatus: {
      computational: 'verified_internal',
      methodological: 'classical_standard',
      empirical: 'not_validated',
    },
    regressionTestReferences: ['k03_r04_phi_health_gate'],
  },
  {
    ruleId: 'R04_PARASHARI_ASCENDANT_AND_LAGNESH_ANCHOR',
    version: '1.0.0',
    title: 'Ascendant (Lagna) Anchor & Lagnesha Condition Authority',
    applicableMethodology: 'vedic_parashari',
    applicableAnalyticalObjective: 'ascendant_and_lagnesh_condition',
    applicableSubjects: [...ALL_TEN_SUBJECTS],
    requiredEvidence: {
      observationCodes: [
        'VEDIC_D1_ASCENDANT_SIGN',
        'VEDIC_D1_ASCENDANT_LONGITUDE',
        'VEDIC_D1_DISPOSITOR_DEPENDENCY',
        'VEDIC_NAKSHATRA_PADA',
        'KP_CUSPAL_SUB_LORDS',
      ],
      families: ['positional', 'degree_level', 'stellar', 'dependency'],
      minimumRequiredCount: 1,
    },
    permittedChartFrames: ['vedic_lahiri', 'kp_placidus', 'bhava_chalit'],
    qualificationPredicates: [
      'lagna_sign_resolved_in_vedic_lahiri',
      'birth_time_sensitivity_audited',
    ],
    exclusionConditions: [
      'missing_ascendant_sign',
      'planetary_shadbala_never_applied_to_non_planetary_ascendant',
    ],
    authorityClassification: {
      defaultClass: 'AC2',
      provisionalCapClass: 'AC3',
      conditionalRules: [
        {
          conditionKey: 'clear_non_sandhi_lagna_definition',
          resultingClass: 'AC1',
          rationale: 'Decisive (AC1) strictly for establishing chart Lagna sign & Lagnesha identity when clear of Rashi Sandhi.',
        },
        {
          conditionKey: 'lagna_in_sandhi_or_gandanta_birth_time_sensitive',
          resultingClass: 'AC3',
          rationale: 'When Ascendant degree is within <=1deg Sandhi or Gandanta, birth-time sensitivity caps Lagna-dependent verdicts at AC3.',
        },
      ],
    },
    dependenciesAndLimitations: [
      'Ascendant is non-planetary; Shadbala, BAV, combustion, and retrogression are excluded.',
      'KP Cusp 1 Sub-Lord stays isolated in kp_placidus.',
    ],
    sourceOrMethodologicalJustification: {
      sourceType: 'classical',
      referenceCode: 'BPHS_LAGNA_LAGNESHA_ANCHOR',
      citation: 'BPHS Lagna & Lagnesha structural chart anchor rule with Sandhi birth-time boundary sensitivity.',
      notes: 'Establishes Lagna anchor needed by Lagna-specific functional rules.',
    },
    verificationStatus: {
      computational: 'verified_internal',
      methodological: 'classical_standard',
      empirical: 'not_validated',
    },
    regressionTestReferences: ['k03_r04_lagna_sandhi_sensitivity'],
  },
  {
    ruleId: 'R04_PARASHARI_HOUSE_GOVERNANCE_AND_CHALIT',
    version: '1.0.0',
    title: 'Parashari House Governance, SAV, Sripati Bhava Chalit & Provisional Bhavabala',
    applicableMethodology: 'vedic_parashari',
    applicableAnalyticalObjective: 'house_governance',
    applicableSubjects: [...ALL_TEN_SUBJECTS],
    requiredEvidence: {
      observationCodes: [
        'VEDIC_D1_HOUSE_LORD_PLACEMENT',
        'BHAVA_CHALIT_HOUSE_PLACEMENT',
        'ASHTAKAVARGA_SARVA_SAV_SIGN',
        'BHAVABALA_HOUSE_STRENGTH',
      ],
      families: ['positional', 'quantitative', 'relational'],
      minimumRequiredCount: 1,
    },
    permittedChartFrames: ['vedic_lahiri', 'bhava_chalit'],
    qualificationPredicates: [
      'frame_in_vedic_lahiri_or_sripati_bhava_chalit',
      'temporal_scope_equals_natal_invariant',
    ],
    exclusionConditions: [
      'incompatible_bhava_chalit_frame_rejected',
      'kp_placidus_cusps_never_substituted_for_bhava_chalit',
      'bhavabala_provisional_cannot_reach_AC1_or_AC2',
    ],
    authorityClassification: {
      defaultClass: 'AC2',
      provisionalCapClass: 'AC3',
      conditionalRules: [
        {
          conditionKey: 'bhavabala_issue_register_provisional',
          resultingClass: 'AC3',
          rationale:
            'BHAVABALA_HOUSE_STRENGTH is capped at AC3 provisional due to Issues #1 & #6 (madhyaLon basis & Shadbala lord dependencies).',
        },
        {
          conditionKey: 'incompatible_chalit_rejected',
          resultingClass: 'AC6',
          rationale: 'Incompatible Bhava Chalit observations are strictly AC6 Excluded.',
        },
      ],
    },
    dependenciesAndLimitations: [
      'Bhava Chalit differences from D1 Whole Sign are surfaced as cross-frame contrasts, not silently merged.',
      'Bhavabala remains provisional pending Issue Register #1 & #6 resolution.',
    ],
    sourceOrMethodologicalJustification: {
      sourceType: 'classical',
      referenceCode: 'BPHS_SRIPATI_HOUSE_GOVERNANCE',
      citation: 'BPHS House Lordship, Sarvashtakavarga, and Sripati Bhava Madhya House Governance.',
      notes: 'Protects Sripati Bhava Chalit from Placidus cusp confusion.',
    },
    verificationStatus: {
      computational: 'provisional',
      methodological: 'contested_or_uncalibrated',
      empirical: 'not_validated',
    },
    regressionTestReferences: ['k03_r04_bhavabala_provisional_gate', 'verifyV2Engine:sripati_chalit'],
  },
  {
    ruleId: 'R04_KP_CUSPAL_SUBLORD_AND_SIGNIFICATOR_GOVERNANCE',
    version: '1.0.0',
    title: 'KP Placidus Cuspal Sub-Lord & 4-Level Significator Governance',
    applicableMethodology: 'kp',
    applicableAnalyticalObjective: 'house_governance',
    applicableSubjects: [...ALL_TEN_SUBJECTS],
    requiredEvidence: {
      observationCodes: [
        'KP_CUSPAL_SUB_LORDS',
        'KP_PLANET_SUB_LORDS',
        'KP_PLACIDUS_HOUSE_PLACEMENT',
        'KP_FOUR_LEVEL_SIGNIFICATORS',
      ],
      families: ['stellar', 'positional', 'relational'],
      minimumRequiredCount: 1,
    },
    permittedChartFrames: ['kp_placidus'],
    qualificationPredicates: [
      'frame_equals_kp_placidus',
      'placidus_cusps_and_kp_ayanamsha_verified',
    ],
    exclusionConditions: [
      'forbidden_from_globally_overriding_parashari_vargas',
      'cannot_be_used_as_sripati_bhava_chalit',
    ],
    authorityClassification: {
      defaultClass: 'AC2',
      provisionalCapClass: 'AC3',
      conditionalRules: [
        {
          conditionKey: 'kp_sub_lord_verified_in_kp_placidus',
          resultingClass: 'AC2',
          rationale: 'Primary (AC2) within kp_placidus frame governance; prohibited from globally overriding Vedic divisional charts.',
        },
      ],
    },
    dependenciesAndLimitations: [
      'Strict kp_placidus frame isolation (Krishnamurti ayanamsha + Placidus cusps).',
      'Final K08 promise confirmation belongs to Deliverability Intelligence.',
    ],
    sourceOrMethodologicalJustification: {
      sourceType: 'classical',
      referenceCode: 'KP_READER_SUBLORD_AUTHORITY',
      citation: 'Krishnamurti Paddhati Cuspal Sub-Lord & 4-Level Significator Hierarchy (strictly frame-isolated).',
      notes: 'Enforces Layer 2 prohibition against KP globally overriding divisional charts.',
    },
    verificationStatus: {
      computational: 'verified_internal',
      methodological: 'classical_standard',
      empirical: 'not_validated',
    },
    regressionTestReferences: ['k03_r04_kp_non_dominance_guard'],
  },
  {
    ruleId: 'R04_PARASHARI_YOGA_DOSHA_QUALIFICATION',
    version: '1.0.0',
    title: 'Parashari Yoga, Dosha & Parivartana Configuration Qualification',
    applicableMethodology: 'vedic_parashari',
    applicableAnalyticalObjective: 'configuration_qualification',
    applicableSubjects: [...ALL_TEN_SUBJECTS],
    requiredEvidence: {
      observationCodes: ['YOGA_EVALUATION', 'DOSHA_EVALUATION', 'PARIVARTANA_MUTUAL_EXCHANGE', 'MODIFIER_VARGOTTAMA'],
      families: ['configuration', 'relational', 'modification'],
      minimumRequiredCount: 1,
    },
    permittedChartFrames: ['vedic_lahiri', 'bhava_chalit'],
    qualificationPredicates: [
      'participating_entities_present',
      'is_present_explicitly_boolean_not_null',
    ],
    exclusionConditions: [
      'automatic_cancellation_without_k05_k07_adjudication_forbidden',
      'missing_participant_entities',
    ],
    authorityClassification: {
      defaultClass: 'AC2',
      provisionalCapClass: 'AC3',
      conditionalRules: [
        {
          conditionKey: 'parivartana_or_complete_present_configuration',
          resultingClass: 'AC2',
          rationale: 'Present configurations with verified participants qualify as AC2 Primary structural configuration evidence.',
        },
        {
          conditionKey: 'absent_configuration_record',
          resultingClass: 'AC5',
          rationale: 'Explicitly evaluated is_present=false records classify as AC5 Background verification audit.',
        },
      ],
    },
    dependenciesAndLimitations: [
      'Does not score YSI/DSI weights or auto-cancel Doshas.',
    ],
    sourceOrMethodologicalJustification: {
      sourceType: 'classical',
      referenceCode: 'BPHS_YOGA_DOSHA_PARIVARTANA',
      citation: 'BPHS Planetary Yogas, Doshas, and Maha/Kahala/Dainya Parivartana structural qualification.',
      notes: 'Structural configuration qualification only; net interaction stays with K05/K07.',
    },
    verificationStatus: {
      computational: 'provider_reported',
      methodological: 'provider_convention',
      empirical: 'not_validated',
    },
    regressionTestReferences: ['k03_r04_configuration_qualification'],
  },
  {
    ruleId: 'R04_JAIMINI_KARAKA_PADA_QUALIFICATION',
    version: '1.0.0',
    title: 'Jaimini Chara Karaka, Arudha Pada & Rashi Drishti Qualification',
    applicableMethodology: 'jaimini',
    applicableAnalyticalObjective: 'configuration_qualification',
    applicableSubjects: [...ALL_NINE_GRAHAS],
    requiredEvidence: {
      observationCodes: ['JAIMINI_CHARA_KARAKA', 'JAIMINI_ARUDHA_PADA', 'JAIMINI_YOGA_OR_ASPECT'],
      families: ['configuration', 'relational'],
      minimumRequiredCount: 1,
    },
    permittedChartFrames: ['vedic_lahiri'],
    qualificationPredicates: [
      'frame_equals_vedic_lahiri',
      'karaka_scheme_7_vs_8_explicitly_tagged',
    ],
    exclusionConditions: [
      'cannot_overwrite_parashari_lagna_lordships',
      'node_convention_ambiguity_under_8_karaka_scheme',
    ],
    authorityClassification: {
      defaultClass: 'AC2',
      provisionalCapClass: 'AC3',
      conditionalRules: [
        {
          conditionKey: 'verified_7_karaka_classical_assignment',
          resultingClass: 'AC2',
          rationale: '7-planet degree-sorted Chara Karakas qualify as AC2 Primary Jaimini evidence.',
        },
        {
          conditionKey: '8_karaka_scheme_with_true_vs_mean_node_caveat',
          resultingClass: 'AC3',
          rationale: '8-karaka schemes involving Rahu carry Issue #7 node convention caveat and cap at AC3.',
        },
      ],
    },
    dependenciesAndLimitations: ['7-karaka vs 8-karaka schemes are tracked without silent conversion.'],
    sourceOrMethodologicalJustification: {
      sourceType: 'classical',
      referenceCode: 'JAIMINI_SUTRAS_KARAKA_PADA',
      citation: 'Jaimini Sutras Chara Karakas & Arudha Padas (strictly distinct from Parashari house lordship).',
      notes: 'Excluded from PHI intrinsic planet health projection.',
    },
    verificationStatus: {
      computational: 'verified_internal',
      methodological: 'classical_standard',
      empirical: 'not_validated',
    },
    regressionTestReferences: ['k03_r04_jaimini_karaka_authority'],
  },
  {
    ruleId: 'R04_PARASHARI_DISPOSITOR_DEPENDENCY_AUTHORITY',
    version: '1.0.0',
    title: 'Parashari D1 Dispositor Dependency & Final Dispositor Authority',
    applicableMethodology: 'vedic_parashari',
    applicableAnalyticalObjective: 'dispositor_dependency',
    applicableSubjects: [...ALL_NINE_GRAHAS],
    requiredEvidence: {
      observationCodes: ['VEDIC_D1_DISPOSITOR_DEPENDENCY', 'PARIVARTANA_MUTUAL_EXCHANGE', 'VEDIC_D1_SIGN_HOUSE_PLACEMENT'],
      families: ['dependency', 'positional', 'relational'],
      minimumRequiredCount: 1,
    },
    permittedChartFrames: ['vedic_lahiri'],
    qualificationPredicates: [
      'frame_equals_vedic_lahiri',
      'sign_lord_resolved_for_planet',
    ],
    exclusionConditions: [
      'subject_is_ascendant_use_lagnesh_rule_instead',
      'missing_d1_sign_placement',
    ],
    authorityClassification: {
      defaultClass: 'AC2',
      provisionalCapClass: 'AC3',
      conditionalRules: [
        {
          conditionKey: 'verified_self_disposited_or_terminal_dispositor_chain',
          resultingClass: 'AC1',
          rationale:
            'Decisive (AC1) strictly for identifying sign-dispositor chain termination (self-disposited vs cycle) on D1 placements.',
        },
        {
          conditionKey: 'nodal_dispositor_agentic_anchor',
          resultingClass: 'AC2',
          rationale: 'Primary (AC2) structural anchor for Rahu/Ketu agentic expression via sign dispositor.',
        },
      ],
    },
    dependenciesAndLimitations: [
      'Full Tarjan SCC basin analysis & Dependency Concentration Index (DCI) belong to K04 Relational Intelligence.',
    ],
    sourceOrMethodologicalJustification: {
      sourceType: 'classical',
      referenceCode: 'PARASHARI_DISPOSITOR_AUTONOMY_CHAIN',
      citation: 'Parashari Bhavat-Bhavam & Sign-Lord Dispositor Chain Dependency (including Chhaya Graha nodal dispositors).',
      notes: 'Provides clean verified prerequisite into K04 Dispositor & Dependency Intelligence.',
    },
    verificationStatus: {
      computational: 'verified_internal',
      methodological: 'classical_standard',
      empirical: 'not_validated',
    },
    regressionTestReferences: ['k03_r04_dispositor_chain_authority'],
  },
  {
    ruleId: 'R04_PARASHARI_DIVISIONAL_VARGA_AUTHORITY',
    version: '1.0.0',
    title: 'Parashari Divisional (Varga D1-D60) & Vargottama Condition Authority',
    applicableMethodology: 'vedic_parashari',
    applicableAnalyticalObjective: 'divisional_condition',
    applicableSubjects: [...ALL_TEN_SUBJECTS],
    requiredEvidence: {
      observationCodes: ['VEDIC_VARGA_PLACEMENT', 'MODIFIER_VARGOTTAMA', 'VEDIC_VARGA_D5_PROVISIONAL'],
      families: ['divisional', 'modification'],
      minimumRequiredCount: 1,
    },
    permittedChartFrames: ['vedic_lahiri'],
    qualificationPredicates: [
      'frame_equals_vedic_lahiri',
      'division_explicitly_labeled',
    ],
    exclusionConditions: [
      'kp_placidus_cannot_globally_override_divisional_condition',
      'd9_cannot_auto_cancel_d1_debilitation_in_k03',
      'uncalibrated_d5_or_ambiguous_d60_capped_provisional',
    ],
    authorityClassification: {
      defaultClass: 'AC2',
      provisionalCapClass: 'AC3',
      conditionalRules: [
        {
          conditionKey: 'usable_d9_navamsa_or_vargottama',
          resultingClass: 'AC2',
          rationale: 'D9 Navamsa and Vargottama serve as AC2 Primary divisional evidence alongside D1 (distinct_analytical_significance).',
        },
        {
          conditionKey: 'provisional_d5_or_uncalibrated_varga',
          resultingClass: 'AC3',
          rationale: 'Uncalibrated D5 Panchamsha or provisional divisional variants cap strictly at AC3.',
        },
      ],
    },
    dependenciesAndLimitations: [
      'KP sub-lords never globally suppress divisional chart evidence.',
      'Higher Vargas depend cleanly on exact birth-time precision.',
    ],
    sourceOrMethodologicalJustification: {
      sourceType: 'classical',
      referenceCode: 'BPHS_CH6_SHODASHAVARGA_AUTHORITY',
      citation: 'BPHS Shodashvarga D1-D60 Divisional System & Vargottama Distinction.',
      notes: 'Preserves D9/D10/D7 etc. as distinct analytical lenses.',
    },
    verificationStatus: {
      computational: 'verified_internal',
      methodological: 'classical_standard',
      empirical: 'not_validated',
    },
    regressionTestReferences: ['k03_r04_divisional_d9_non_collapse'],
  },
  {
    ruleId: 'R04_CROSS_TRADITION_VERIFICATION_AND_COMPATIBILITY',
    version: '1.0.0',
    title: 'Universal Integrity, Epistemic Verification & Frame Compatibility Gate',
    applicableMethodology: 'cross_tradition',
    applicableAnalyticalObjective: 'evidence_verification_and_compatibility',
    applicableSubjects: [...ALL_TEN_SUBJECTS],
    requiredEvidence: {
      observationCodes: [
        'CANONICAL_BIRTH_INSTANT',
        'ASTRONOMICAL_BODY_TELEMETRY',
        'VEDIC_NAKSHATRA_PADA',
        'VEDIC_ADVANCED_AVASTHAS',
        'VIMSHOTTARI_NATAL_MAHADASHA',
        'VIMSHOTTARI_REFERENCE_SNAPSHOT',
      ],
      families: [
        'positional',
        'degree_level',
        'stellar',
        'operating_condition',
        'temporal',
        'historical_contextual',
      ],
      minimumRequiredCount: 1,
    },
    permittedChartFrames: [
      'canonical_instant',
      'astronomical_telemetry',
      'vedic_lahiri',
      'kp_placidus',
      'bhava_chalit',
      'western_tropical',
      'cross_frame',
    ],
    qualificationPredicates: [
      'separates_computational_methodological_empirical_statuses',
      'enforces_temporal_natal_quarantine',
      'enforces_zero_coercion_and_frame_isolation',
    ],
    exclusionConditions: [
      'blocked_or_incompatible_evidence_excluded_as_AC6',
      'reference_date_dependent_evidence_excluded_from_natal_objectives_as_AC6',
      'provisional_evidence_cannot_promote_to_AC1',
    ],
    authorityClassification: {
      defaultClass: 'AC4',
      provisionalCapClass: 'AC3',
      conditionalRules: [
        {
          conditionKey: 'blocked_or_incompatible_dataset',
          resultingClass: 'AC6',
          rationale: 'Blocked or incompatible evidence is deterministically classified as AC6 Excluded.',
        },
        {
          conditionKey: 'canonical_birth_instant_verified_anchor',
          resultingClass: 'AC1',
          rationale:
            'Decisive (AC1) strictly for astronomical UTC/JD/coordinate instant anchoring when verified internally.',
        },
        {
          conditionKey: 'provisional_or_contested_convention',
          resultingClass: 'AC3',
          rationale: 'Provisional or convention-sensitive evidence (e.g., Issue #7 true vs mean node) stays bounded at AC3.',
        },
      ],
    },
    dependenciesAndLimitations: [
      'Empirical status remains not_validated unless externally reconciled against JHora/PyJHora/Swiss Ephemeris.',
    ],
    sourceOrMethodologicalJustification: {
      sourceType: 'methodological_governance',
      referenceCode: 'LAYER1_UNIVERSAL_INTEGRITY_GATE',
      citation: 'CosmicCouncil Universal Integrity Policy & SHADBALA_BHAVABALA_ISSUE_REGISTER.md enforcement.',
      notes: 'Separates computational discrepancies, cross-frame contrasts, methodological conventions, and analytical tensions.',
    },
    verificationStatus: {
      computational: 'verified_internal',
      methodological: 'classical_standard',
      empirical: 'not_validated',
    },
    regressionTestReferences: ['k03_r04_universal_integrity_gate', 'k03_r04_temporal_quarantine'],
  },
];

// ============================================================================
// 2. BPHS Ch. 34 Lagna-Specific Rules (All 12 Vedic Lagnas + Non-Classical Guard)
// ============================================================================

const LAGNA_FUNCTIONAL_SPECS: readonly R04LagnaFunctionalSpecification[] = [
  {
    lagnaSign: 'Aries',
    lagnaLord: 'Mars',
    yogakarakas: [],
    functionalBenefics: ['Sun', 'Jupiter', 'Mars'],
    functionalMalefics: ['Mercury', 'Venus', 'Saturn'],
    neutralOrMixed: ['Moon'],
    marakaPlanets: ['Venus', 'Mercury'],
    houseLordships: buildHouseLordshipsForLagna('Aries'),
    classicalCaveats: [
      'Mars (Lagnesha, H1/H8) acts primarily as Lagna Anchor/Benefic; H8 dusthana caveat applies to secondary matters.',
      'Jupiter rules auspicious H9 Trikona alongside H12; BPHS Ch. 34 treats Jupiter as auspicious via H9 and Sun+Jupiter association.',
      'Saturn rules H10+H11 (Kendra+Trishadaya/Badhaka); functional malefic for Aries Lagna.',
    ],
  },
  {
    lagnaSign: 'Taurus',
    lagnaLord: 'Venus',
    yogakarakas: ['Saturn'],
    functionalBenefics: ['Saturn', 'Sun', 'Mercury'],
    functionalMalefics: ['Jupiter', 'Moon', 'Mars'],
    neutralOrMixed: ['Venus'],
    marakaPlanets: ['Mars', 'Jupiter'],
    houseLordships: buildHouseLordshipsForLagna('Taurus'),
    classicalCaveats: [
      'Saturn rules H9 Trikona and H10 Kendra — sole Yogakaraka for Taurus Lagna.',
      'Venus is Lagnesha (H1/H6), giving primary Lagna authority mixed with H6 Roganadi caveat.',
      'Jupiter rules H8+H11 (most malefic per BPHS Ch. 34).',
    ],
  },
  {
    lagnaSign: 'Gemini',
    lagnaLord: 'Mercury',
    yogakarakas: [],
    functionalBenefics: ['Venus', 'Mercury'],
    functionalMalefics: ['Mars', 'Jupiter', 'Sun'],
    neutralOrMixed: ['Saturn', 'Moon'],
    marakaPlanets: ['Jupiter', 'Moon'],
    houseLordships: buildHouseLordshipsForLagna('Gemini'),
    classicalCaveats: [
      'Venus (H5 Trikona + H12) is the sole unqualified functional benefic alongside Lagnesha Mercury (H1/H4).',
      'Jupiter (H7/H10) incurs Kendradhipati Dosha and Maraka lordship.',
      'Saturn (H8/H9) combines H9 Trikona grace with H8 dusthana caveat.',
    ],
  },
  {
    lagnaSign: 'Cancer',
    lagnaLord: 'Moon',
    yogakarakas: ['Mars'],
    functionalBenefics: ['Mars', 'Jupiter', 'Moon'],
    functionalMalefics: ['Venus', 'Mercury'],
    neutralOrMixed: ['Saturn', 'Sun'],
    marakaPlanets: ['Saturn', 'Sun'],
    houseLordships: buildHouseLordshipsForLagna('Cancer'),
    classicalCaveats: [
      'Mars rules H5 Trikona and H10 Kendra — sole Yogakaraka for Cancer Lagna.',
      'Jupiter rules H9 Trikona alongside H6 dusthana — primarily auspicious via H9 with H6 caveat.',
      'Venus rules H4+H11 (Kendradhipati + Badhaka/Trishadaya malefic).',
    ],
  },
  {
    lagnaSign: 'Leo',
    lagnaLord: 'Sun',
    yogakarakas: ['Mars'],
    functionalBenefics: ['Mars', 'Jupiter', 'Sun'],
    functionalMalefics: ['Mercury', 'Venus', 'Saturn'],
    neutralOrMixed: ['Moon'],
    marakaPlanets: ['Saturn', 'Mercury'],
    houseLordships: buildHouseLordshipsForLagna('Leo'),
    classicalCaveats: [
      'Mars rules H4 Kendra and H9 Trikona — sole Yogakaraka for Leo Lagna.',
      'Jupiter rules H5 Trikona + H8 — auspicious via H5 with H8 caveat.',
      'Saturn (H6/H7) is a primary Maraka and functional malefic.',
    ],
  },
  {
    lagnaSign: 'Virgo',
    lagnaLord: 'Mercury',
    yogakarakas: [],
    functionalBenefics: ['Venus', 'Mercury'],
    functionalMalefics: ['Mars', 'Jupiter', 'Moon'],
    neutralOrMixed: ['Saturn', 'Sun'],
    marakaPlanets: ['Jupiter', 'Mars'],
    houseLordships: buildHouseLordshipsForLagna('Virgo'),
    classicalCaveats: [
      'Venus rules H9 Trikona + H2 — primary functional benefic for Virgo Lagna.',
      'Mars rules H3+H8 — most malefic for Virgo Lagna; Jupiter rules H4+H7 (Kendradhipati + Badhaka/Maraka).',
      'Saturn (H5/H6) blends H5 Trikona with H6 dusthana.',
    ],
  },
  {
    lagnaSign: 'Libra',
    lagnaLord: 'Venus',
    yogakarakas: ['Saturn'],
    functionalBenefics: ['Saturn', 'Mercury', 'Venus'],
    functionalMalefics: ['Jupiter', 'Sun', 'Mars'],
    neutralOrMixed: ['Moon'],
    marakaPlanets: ['Mars', 'Sun'],
    houseLordships: buildHouseLordshipsForLagna('Libra'),
    classicalCaveats: [
      'Saturn rules H4 Kendra and H5 Trikona — primary Yogakaraka for Libra Lagna.',
      'Jupiter rules H3+H6 — most malefic; Sun rules H11 (Badhaka for movable Libra Lagna).',
      'Venus is Lagnesha (H1/H8), retaining Lagna anchor authority.',
    ],
  },
  {
    lagnaSign: 'Scorpio',
    lagnaLord: 'Mars',
    yogakarakas: [],
    functionalBenefics: ['Jupiter', 'Moon', 'Sun', 'Mars'],
    functionalMalefics: ['Mercury', 'Venus', 'Saturn'],
    neutralOrMixed: [],
    marakaPlanets: ['Venus', 'Mercury'],
    houseLordships: buildHouseLordshipsForLagna('Scorpio'),
    classicalCaveats: [
      'Jupiter (H2/H5) and Moon (H9) + Sun (H10) are classical benefics; Moon carries fixed-Lagna H9 Badhaka caveat.',
      'Mercury (H8/H11) is most malefic; Venus (H7/H12) is primary Maraka/malefic.',
      'Mars (Lagnesha H1/H6) anchors Lagna despite H6 moolatrikona.',
    ],
  },
  {
    lagnaSign: 'Sagittarius',
    lagnaLord: 'Jupiter',
    yogakarakas: [],
    functionalBenefics: ['Sun', 'Mars', 'Jupiter'],
    functionalMalefics: ['Venus', 'Saturn', 'Mercury'],
    neutralOrMixed: ['Moon'],
    marakaPlanets: ['Saturn', 'Mercury'],
    houseLordships: buildHouseLordshipsForLagna('Sagittarius'),
    classicalCaveats: [
      'Sun (H9 Trikona) and Mars (H5 Trikona + H12) are primary functional benefics alongside Lagnesha Jupiter.',
      'Venus (H6/H11) is most malefic; Mercury (H7/H10) incurs Kendradhipati & Badhaka/Maraka roles.',
      'Moon rules H8; classical luminary Ashtamadhipati exemption makes it mixed/neutral rather than outright malefic.',
    ],
  },
  {
    lagnaSign: 'Capricorn',
    lagnaLord: 'Saturn',
    yogakarakas: ['Venus'],
    functionalBenefics: ['Venus', 'Mercury', 'Saturn'],
    functionalMalefics: ['Mars', 'Jupiter', 'Moon'],
    neutralOrMixed: ['Sun'],
    marakaPlanets: ['Moon', 'Mars'],
    houseLordships: buildHouseLordshipsForLagna('Capricorn'),
    classicalCaveats: [
      'Venus rules H5 Trikona and H10 Kendra — sole Yogakaraka for Capricorn Lagna.',
      'Mercury rules H9 Trikona + H6 — auspicious via H9 with H6 caveat.',
      'Jupiter (H3/H12) is functional malefic; Sun (H8) carries luminary H8 neutral caveat.',
    ],
  },
  {
    lagnaSign: 'Aquarius',
    lagnaLord: 'Saturn',
    yogakarakas: ['Venus'],
    functionalBenefics: ['Venus', 'Saturn'],
    functionalMalefics: ['Jupiter', 'Moon', 'Mars'],
    neutralOrMixed: ['Sun', 'Mercury'],
    marakaPlanets: ['Jupiter', 'Sun'],
    houseLordships: buildHouseLordshipsForLagna('Aquarius'),
    classicalCaveats: [
      'Venus rules H4 Kendra and H9 Trikona — sole Yogakaraka for Aquarius Lagna (also Badhaka caveat if afflicted).',
      'Saturn is Lagnesha (H1/H12); Jupiter (H2/H11) and Moon (H6) act as functional malefics.',
      'Mercury (H5/H8) blends H5 Trikona with H8 dusthana.',
    ],
  },
  {
    lagnaSign: 'Pisces',
    lagnaLord: 'Jupiter',
    yogakarakas: [],
    functionalBenefics: ['Mars', 'Moon', 'Jupiter'],
    functionalMalefics: ['Saturn', 'Venus', 'Sun', 'Mercury'],
    neutralOrMixed: [],
    marakaPlanets: ['Mercury', 'Saturn'],
    houseLordships: buildHouseLordshipsForLagna('Pisces'),
    classicalCaveats: [
      'Mars (H2/H9) and Moon (H5) are functional benefics alongside Lagnesha Jupiter (H1/H10).',
      'Venus (H3/H8) and Saturn (H11/H12) are functional malefics; Mercury (H4/H7) carries Kendradhipati/Badhaka Maraka roles.',
    ],
  },
];

const LAGNA_FUNC_RULES: R04AuthorityRuleDefinition[] = LAGNA_FUNCTIONAL_SPECS.map((spec) => ({
  ruleId: `R04_LAGNA_FUNC_${spec.lagnaSign.toUpperCase()}`,
  version: '1.0.0',
  title: `BPHS Ch. 34 Functional Benefic/Malefic/Yogakaraka Authority — ${spec.lagnaSign} Lagna`,
  applicableMethodology: 'vedic_parashari',
  applicableAnalyticalObjective: 'functional_orientation_by_lagna',
  applicableSubjects: [...CLASSICAL_SEVEN],
  requiredEvidence: {
    observationCodes: ['VEDIC_D1_ASCENDANT_SIGN', 'VEDIC_D1_HOUSE_LORD_PLACEMENT', 'VEDIC_D1_SIGN_HOUSE_PLACEMENT'],
    families: ['positional', 'relational'],
    minimumRequiredCount: 1,
  },
  permittedChartFrames: ['vedic_lahiri'],
  qualificationPredicates: [
    `ascendant_d1_sign_equals_${spec.lagnaSign.toLowerCase()}`,
    'subject_is_classical_seven_planet',
    'frame_equals_vedic_lahiri',
  ],
  exclusionConditions: [
    'subject_is_rahu_ketu_or_ascendant_use_non_classical_guard',
    'cannot_execute_for_different_lagna_sign',
    'birth_time_sandhi_caps_lagna_verdict_at_AC3',
  ],
  authorityClassification: {
    defaultClass: 'AC2',
    provisionalCapClass: 'AC3',
    conditionalRules: [
      {
        conditionKey: 'yogakaraka_or_lagnesha_verified_non_sandhi_lagna',
        resultingClass: 'AC1',
        rationale:
          'Decisive (AC1) strictly for classifying Yogakaraka/Lagnesha/Functional Lordship orientation under non-Sandhi Vedic D1 Lagna.',
      },
      {
        conditionKey: 'lagna_in_sandhi_boundary_risk',
        resultingClass: 'AC3',
        rationale:
          'When Ascendant degree is near a sign cusp (<=1deg Sandhi), Lagna-dependent functional classification caps at AC3.',
      },
    ],
  },
  dependenciesAndLimitations: [
    ...spec.classicalCaveats,
    'Evaluates Lagna house-lordship orientation only; actual delivery depends on K05 interactions and K08 KP/Chalit deliverability.',
  ],
  sourceOrMethodologicalJustification: {
    sourceType: 'classical',
    referenceCode: `BPHS_CH34_${spec.lagnaSign.toUpperCase()}`,
    citation: `Brihat Parashara Hora Shastra Ch. 34 (Yogakaraka & Functional Benefic/Malefic Rules for ${spec.lagnaSign} Ascendant).`,
    notes: `Lagnesha=${spec.lagnaLord}; Yogakarakas=${spec.yogakarakas.join(',') || 'None'}.`,
  },
  verificationStatus: {
    computational: 'verified_internal',
    methodological: 'classical_standard',
    empirical: 'not_validated',
  },
  regressionTestReferences: [`k03_r04_lagna_func_${spec.lagnaSign.toLowerCase()}`],
  lagnaFunctionalSpec: deepFreeze({ ...spec }),
}));

const NON_CLASSICAL_LAGNA_GUARD_RULE: R04AuthorityRuleDefinition = {
  ruleId: 'R04_LAGNA_FUNC_NON_CLASSICAL_SUBJECTS',
  version: '1.0.0',
  title: 'Non-Universal Functional Orientation Guard for Rahu, Ketu & Ascendant',
  applicableMethodology: 'vedic_parashari',
  applicableAnalyticalObjective: 'functional_orientation_by_lagna',
  applicableSubjects: ['Rahu', 'Ketu', 'Ascendant'],
  requiredEvidence: {
    observationCodes: ['VEDIC_D1_ASCENDANT_SIGN', 'VEDIC_D1_DISPOSITOR_DEPENDENCY', 'VEDIC_D1_SIGN_HOUSE_PLACEMENT'],
    families: ['positional', 'dependency'],
    minimumRequiredCount: 1,
  },
  permittedChartFrames: ['vedic_lahiri'],
  qualificationPredicates: [
    'subject_is_rahu_ketu_or_ascendant',
    'frame_equals_vedic_lahiri',
  ],
  exclusionConditions: [
    'never_apply_fixed_rashi_lordship_benefic_malefic_tables_to_nodes_or_ascendant',
  ],
  authorityClassification: {
    defaultClass: 'AC3',
    provisionalCapClass: 'AC3',
    conditionalRules: [
      {
        conditionKey: 'ascendant_reference_anchor',
        resultingClass: 'AC2',
        rationale: 'Ascendant is classified as non_planetary_lagna_reference governed via Lagnesha rather than lordship beneficence.',
      },
      {
        conditionKey: 'rahu_or_ketu_contingent_agent',
        resultingClass: 'AC3',
        rationale:
          'Rahu and Ketu are classified as contingent_nodal_agent depending on sign dispositor, house occupancy, and conjunction/aspect witnesses.',
      },
    ],
  },
  dependenciesAndLimitations: [
    'Rahu/Ketu lack universal Rashi sign-lordship in BPHS Ch. 34; full agentic substitution belongs to K04/K05.',
    'Ascendant is the reference anchor point, not a functional lord.',
  ],
  sourceOrMethodologicalJustification: {
    sourceType: 'classical',
    referenceCode: 'BPHS_CH34_NODAL_AND_LAGNA_EXEMPTION',
    citation: 'BPHS Ch. 34 / Shadow-Graha Agentic Rule (Rahu/Ketu follow sign dispositor & yogakaraka house associations).',
    notes: 'Prevents forcing Rahu, Ketu, or Ascendant into 7-planet lordship tables.',
  },
  verificationStatus: {
    computational: 'verified_internal',
    methodological: 'classical_standard',
    empirical: 'not_validated',
  },
  regressionTestReferences: ['k03_r04_non_classical_nodes_ascendant_guard'],
};

const ALL_RAW_R04_RULES: R04AuthorityRuleDefinition[] = [
  ...CORE_R04_RULES,
  ...LAGNA_FUNC_RULES,
  NON_CLASSICAL_LAGNA_GUARD_RULE,
];

export const R04_AUTHORITY_RULES: Readonly<Record<string, R04AuthorityRuleDefinition>> = deepFreeze(
  Object.fromEntries(ALL_RAW_R04_RULES.map((rule) => [rule.ruleId, rule]))
);

export const R04_AUTHORITY_RULE_LIST: readonly R04AuthorityRuleDefinition[] = deepFreeze([
  ...ALL_RAW_R04_RULES,
]);

const R04_LAGNA_RULE_BY_SIGN: Readonly<Record<VedicRashiSign, R04AuthorityRuleDefinition>> =
  deepFreeze(
    Object.fromEntries(
      LAGNA_FUNC_RULES.map((rule) => [rule.lagnaFunctionalSpec!.lagnaSign, rule])
    ) as Record<VedicRashiSign, R04AuthorityRuleDefinition>
  );

export function isR04RuleRegistered(ruleId: string): boolean {
  return Object.prototype.hasOwnProperty.call(R04_AUTHORITY_RULES, ruleId);
}

export function getRegisteredR04Rule(ruleId: string): R04AuthorityRuleDefinition | undefined {
  return isR04RuleRegistered(ruleId) ? R04_AUTHORITY_RULES[ruleId] : undefined;
}

/**
 * Hard runtime guard: throws `UnregisteredRuleError` on any unknown R04 ruleId
 * or version mismatch.
 */
export function assertRegisteredR04Rule(
  ruleId: string,
  expectedVersion?: string
): R04AuthorityRuleDefinition {
  const rule = getRegisteredR04Rule(ruleId);
  if (!rule) {
    throw new UnregisteredRuleError(ruleId, expectedVersion);
  }
  if (expectedVersion && rule.version !== expectedVersion) {
    throw new UnregisteredRuleError(ruleId, expectedVersion, rule.version);
  }
  return rule;
}

export function listRegisteredR04Rules(): readonly R04AuthorityRuleDefinition[] {
  return R04_AUTHORITY_RULE_LIST;
}

export function getR04RulesByObjective(
  objectiveId: AnalyticalObjectiveId
): readonly R04AuthorityRuleDefinition[] {
  return R04_AUTHORITY_RULE_LIST.filter(
    (rule) => rule.applicableAnalyticalObjective === objectiveId
  );
}

export function getR04RulesByMethodology(
  methodology: K03AuthorityMethodology
): readonly R04AuthorityRuleDefinition[] {
  return R04_AUTHORITY_RULE_LIST.filter((rule) => rule.applicableMethodology === methodology);
}

export function getR04LagnaFunctionalRule(
  lagnaSign: VedicRashiSign
): R04AuthorityRuleDefinition {
  const rule = R04_LAGNA_RULE_BY_SIGN[lagnaSign];
  if (!rule) {
    throw new UnregisteredRuleError(`R04_LAGNA_FUNC_${String(lagnaSign).toUpperCase()}`);
  }
  return assertRegisteredR04Rule(rule.ruleId, rule.version);
}

export function exportR04RuleRegistrySnapshot(): R04RuleRegistrySnapshot {
  return {
    registryVersion: R04_AUTHORITY_REGISTRY_VERSION,
    totalRules: R04_AUTHORITY_RULE_LIST.length,
    objectivesCovered: [...ANALYTICAL_OBJECTIVE_IDS],
    rules: R04_AUTHORITY_RULE_LIST.map((r) => ({ ...r })),
  };
}
