/**
 * CosmicCouncil Proprietary Analytical Intelligence Kernel — K03 Contracts (CEAR, AC1-AC6, 3 Policy Layers) & R04 Registry Types
 *
 * Pure TypeScript / Web-standard contracts (zero Node built-ins; Cloudflare Workers safe).
 * Zero LLM calls, zero live API calls, zero DB writes, zero arbitrary authority percentages.
 *
 * Strict Non-Mutation Invariant:
 *  - `CanonicalEvidenceObject` from K01 is never mutated to store contextual authority.
 *  - K03 contextual authority lives exclusively in versioned `ContextualEvidenceAuthorityRecord` (CEAR)
 *    entries and non-mutating P05/P09 enrichment views.
 */

import { sha256Hex } from './lineage';
import type {
  CanonicalEvidenceFrame,
  ComputationalVerificationStatus,
  EmpiricalValidationStatus,
  EvidenceEntityRef,
  EvidenceFamily,
  MethodologicalVerificationStatus,
  PhiReadyPlanetName,
  PlanetaryStateSubjectName,
  PropagatedTrustLevel,
} from './types';

export const K03_AUTHORITY_ENGINE_VERSION = 'k03.1.0' as const;
export const K03_CEAR_SCHEMA_VERSION = 'k03.cear.1.0' as const;
export const R04_AUTHORITY_REGISTRY_VERSION = 'k03.r04.1.0' as const;

// ============================================================================
// 1. 10 Initial Analytical Objectives
// ============================================================================

export const ANALYTICAL_OBJECTIVE_IDS = [
  'planetary_quantitative_capacity',
  'planetary_dignity_and_positional_condition',
  'planetary_health_evidence',
  'ascendant_and_lagnesh_condition',
  'house_governance',
  'configuration_qualification',
  'dispositor_dependency',
  'divisional_condition',
  'evidence_verification_and_compatibility',
  'functional_orientation_by_lagna',
] as const;

export type AnalyticalObjectiveId = (typeof ANALYTICAL_OBJECTIVE_IDS)[number];

// ============================================================================
// 2. AC1-AC6 Authority Classifications (+ explicit unevaluated / indeterminate)
// ============================================================================

export const AUTHORITY_CLASSIFICATIONS = [
  'AC1',
  'AC2',
  'AC3',
  'AC4',
  'AC5',
  'AC6',
  'unevaluated',
  'indeterminate',
] as const;

export type AuthorityClassification = (typeof AUTHORITY_CLASSIFICATIONS)[number];

export interface AuthorityClassificationSemanticSpec {
  code: AuthorityClassification;
  label: string;
  description: string;
  permissibleWithProvisionalEvidence: boolean;
}

export const AUTHORITY_CLASSIFICATION_SEMANTICS: Readonly<
  Record<AuthorityClassification, AuthorityClassificationSemanticSpec>
> = Object.freeze({
  AC1: {
    code: 'AC1',
    label: 'Decisive (Qualification-Scoped)',
    description:
      'Decisive for a specifically registered analytical qualification only; NEVER decisive proof of a real-world life outcome and NEVER assignable to provisional evidence.',
    permissibleWithProvisionalEvidence: false,
  },
  AC2: {
    code: 'AC2',
    label: 'Primary',
    description:
      'Primary usable authority directly governing the target analytical objective within its isolated chart frame.',
    permissibleWithProvisionalEvidence: false,
  },
  AC3: {
    code: 'AC3',
    label: 'Significant',
    description:
      'Significant contributing evidence (including bounded provisional evidence or distinct cross-frame complements with explicit caveats).',
    permissibleWithProvisionalEvidence: true,
  },
  AC4: {
    code: 'AC4',
    label: 'Supporting',
    description:
      'Supporting contextual evidence that corroborates or refines primary findings without independently deciding qualification.',
    permissibleWithProvisionalEvidence: true,
  },
  AC5: {
    code: 'AC5',
    label: 'Background',
    description:
      'Background telemetry or partial-overlap derivative preserved for audit lineage without direct authority weight.',
    permissibleWithProvisionalEvidence: true,
  },
  AC6: {
    code: 'AC6',
    label: 'Excluded',
    description:
      'Explicitly excluded from qualifying this objective due to frame incompatibility, blocked trust, temporal quarantine, or rule applicability boundaries.',
    permissibleWithProvisionalEvidence: true,
  },
  unevaluated: {
    code: 'unevaluated',
    label: 'Unevaluated',
    description:
      'Not evaluated because required upstream evidence, Lagna anchor, or applicability prerequisites were absent.',
    permissibleWithProvisionalEvidence: true,
  },
  indeterminate: {
    code: 'indeterminate',
    label: 'Indeterminate',
    description:
      'Conflicting, contested, or unresolved methodological conditions prevent deterministic AC1-AC6 ranking without external reconciliation.',
    permissibleWithProvisionalEvidence: true,
  },
});

// ============================================================================
// 3. 10 Individually Inspectable Authority Dimension Assessments
// ============================================================================

export const AUTHORITY_DIMENSION_NAMES = [
  'evidenceValidity',
  'computationalReliability',
  'methodologicalSignificance',
  'contextualRelevance',
  'analyticalPotency',
  'evidenceIndependence',
  'reinforcement',
  'modification',
  'structuralCriticality',
  'temporalRelevance',
] as const;

export type AuthorityDimensionName = (typeof AUTHORITY_DIMENSION_NAMES)[number];

export type AuthorityDimensionStatus =
  | 'assessed'
  | 'constrained'
  | 'excluded'
  | 'unevaluated'
  | 'indeterminate';

export interface AuthorityDimensionAssessment {
  dimension: AuthorityDimensionName;
  status: AuthorityDimensionStatus;
  qualitativeRating: string;
  rationale: string;
  limitations: string[];
  supportingEvidenceIds: string[];
  ruleReferences: string[];
}

export type AuthorityDimensionAssessments = Record<
  AuthorityDimensionName,
  AuthorityDimensionAssessment
>;

// ============================================================================
// 4. ContextualEvidenceAuthorityRecord (CEAR)
// ============================================================================

export type K03AuthorityMethodology =
  | 'vedic_parashari'
  | 'kp'
  | 'jaimini'
  | 'western_tropical'
  | 'cross_tradition';

export type CearQualificationStatus =
  | 'qualified'
  | 'qualified_with_caveats'
  | 'provisional_only'
  | 'excluded'
  | 'unevaluated'
  | 'indeterminate';

export interface CearRuleReference {
  ruleId: string;
  version: string;
  citationCode: string;
  methodology: K03AuthorityMethodology;
}

export const K03_INDEPENDENCE_CLASSIFICATIONS = [
  'exact_duplicate',
  'partial_mathematical_overlap',
  'shared_upstream_dependency',
  'distinct_analytical_significance',
  'methodological_incompatibility',
  'unknown_independence',
] as const;

export type K03EvidenceIndependenceClassification =
  (typeof K03_INDEPENDENCE_CLASSIFICATIONS)[number];

export interface CearEvidenceIndependenceInfo {
  independenceStatus: K03EvidenceIndependenceClassification;
  overlapGroupId: string | null;
  overlapRelationIds: string[];
  doubleCountingGuardApplied: boolean;
  primaryRepresentativeId: string | null;
  notes: string[];
}

export interface CearVerificationStatus {
  computational: ComputationalVerificationStatus;
  methodological: MethodologicalVerificationStatus;
  empirical: EmpiricalValidationStatus;
  propagatedTrust: PropagatedTrustLevel;
}

export interface CearVersionMetadata {
  schemaVersion: typeof K03_CEAR_SCHEMA_VERSION;
  engineVersion: typeof K03_AUTHORITY_ENGINE_VERSION;
  registryVersion: typeof R04_AUTHORITY_REGISTRY_VERSION;
  evidenceRuleVersion: string | null;
}

export interface ContextualEvidenceAuthorityRecord {
  schemaVersion: typeof K03_CEAR_SCHEMA_VERSION;
  authorityRecordId: string;
  evidenceId: string;
  objectiveId: AnalyticalObjectiveId;
  propositionRef: string;
  subject: EvidenceEntityRef;
  relatedEntities: EvidenceEntityRef[];
  applicableMethodology: K03AuthorityMethodology;
  applicableChartFrame: CanonicalEvidenceFrame;
  dimensionAssessments: AuthorityDimensionAssessments;
  authorityClassification: AuthorityClassification;
  qualificationStatus: CearQualificationStatus;
  applicableRuleReferences: CearRuleReference[];
  supportingConditions: string[];
  limitingConditions: string[];
  evidenceIndependenceInfo: CearEvidenceIndependenceInfo;
  verificationStatus: CearVerificationStatus;
  unresolvedPrerequisites: string[];
  versionMetadata: CearVersionMetadata;
}

function normCearSeg(raw: string | null | undefined): string {
  return String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

export function buildCearNaturalKey(params: {
  evidenceId: string;
  objectiveId: AnalyticalObjectiveId;
  propositionRef: string;
  applicableMethodology: K03AuthorityMethodology;
  applicableChartFrame: CanonicalEvidenceFrame;
}): string {
  return [
    normCearSeg(params.evidenceId),
    normCearSeg(params.objectiveId),
    normCearSeg(params.propositionRef),
    normCearSeg(params.applicableMethodology),
    normCearSeg(params.applicableChartFrame),
  ].join('|');
}

export function buildDeterministicAuthorityRecordId(params: {
  evidenceId: string;
  objectiveId: AnalyticalObjectiveId;
  propositionRef: string;
  applicableMethodology: K03AuthorityMethodology;
  applicableChartFrame: CanonicalEvidenceFrame;
}): { naturalKey: string; authorityRecordId: string } {
  const naturalKey = buildCearNaturalKey(params);
  return {
    naturalKey,
    authorityRecordId: `cear_${sha256Hex(naturalKey).slice(0, 32)}`,
  };
}

// ============================================================================
// 5. Three Separated Authority Policy Layers
// ============================================================================

/**
 * Layer 1 — Universal Integrity Policy (Strictly Non-Overridable)
 */
export interface UniversalIntegrityPolicy {
  readonly layerKind: 'universal_integrity';
  readonly nonOverridable: true;
  readonly enforceProvisionalCeiling: true;
  readonly forbidProvisionalDecisivePromotion: true;
  readonly enforceFrameIsolation: true;
  readonly quarantineTemporalFromNatal: true;
  readonly enforceZeroCoercion: true;
  readonly keepShadbalaBhavabalaProvisional: true;
  readonly issueRegisterReference: 'docs/SHADBALA_BHAVABALA_ISSUE_REGISTER.md';
}

export interface MethodologicalConventionPolicy {
  readonly methodology: K03AuthorityMethodology;
  readonly permittedFrames: readonly CanonicalEvidenceFrame[];
  readonly primaryQualificationSources: readonly string[];
  readonly provisionalTreatment: string;
  readonly crossSystemNonDominanceNote: string;
}

/**
 * Layer 2 — Methodological Authority Policy
 * Prohibits fixed global cross-system hierarchies (e.g. KP always overriding Vargas,
 * or Shadbala always overriding classical dignity).
 */
export interface MethodologicalAuthorityPolicy {
  readonly layerKind: 'methodological_authority';
  readonly registryVersion: typeof R04_AUTHORITY_REGISTRY_VERSION;
  readonly forbidFixedGlobalCrossSystemHierarchy: true;
  readonly prohibitedGlobalOverrides: readonly string[];
  readonly conventions: Readonly<
    Record<K03AuthorityMethodology, MethodologicalConventionPolicy>
  >;
}

/**
 * Layer 3 — Individual Analytical Preference Policy
 * Future-compatible contract only (no Companion runtime integration).
 * Strictly unable to bypass Layer 1 or mutate Layer 2.
 */
export interface IndividualAnalyticalPreferencePolicy {
  readonly layerKind: 'individual_analytical_preference';
  readonly status: 'future_compatible_contract_only';
  readonly cannotBypassUniversalIntegrity: true;
  readonly cannotMutateMethodologicalAuthority: true;
  readonly companionRuntimeIntegrated: false;
  readonly preferredMethodologies?: readonly K03AuthorityMethodology[];
  readonly preferredObjectives?: readonly AnalyticalObjectiveId[];
  readonly strictNonProvisionalOverride?: boolean;
  readonly allowProvisionalWithExplicitCaveats?: boolean;
}

export interface K03PolicyConfiguration {
  readonly universalIntegrity: UniversalIntegrityPolicy;
  readonly methodologicalAuthority: MethodologicalAuthorityPolicy;
  readonly individualPreference?: IndividualAnalyticalPreferencePolicy | null;
}

function deepFreezePolicy<T>(obj: T): Readonly<T> {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj as Record<string, unknown>)) {
      deepFreezePolicy(v);
    }
  }
  return obj;
}

export const DEFAULT_UNIVERSAL_INTEGRITY_POLICY: Readonly<UniversalIntegrityPolicy> =
  deepFreezePolicy({
    layerKind: 'universal_integrity',
    nonOverridable: true,
    enforceProvisionalCeiling: true,
    forbidProvisionalDecisivePromotion: true,
    enforceFrameIsolation: true,
    quarantineTemporalFromNatal: true,
    enforceZeroCoercion: true,
    keepShadbalaBhavabalaProvisional: true,
    issueRegisterReference: 'docs/SHADBALA_BHAVABALA_ISSUE_REGISTER.md',
  });

export const DEFAULT_METHODOLOGICAL_AUTHORITY_POLICY: Readonly<MethodologicalAuthorityPolicy> =
  deepFreezePolicy({
    layerKind: 'methodological_authority',
    registryVersion: R04_AUTHORITY_REGISTRY_VERSION,
    forbidFixedGlobalCrossSystemHierarchy: true,
    prohibitedGlobalOverrides: [
      'kp_never_globally_overrides_vedic_divisional_charts',
      'shadbala_never_globally_overrides_classical_rashi_dignity',
      'western_tropical_never_merged_with_vedic_lahiri',
      'bhava_chalit_never_silently_substituted_by_kp_placidus',
    ],
    conventions: {
      vedic_parashari: {
        methodology: 'vedic_parashari',
        permittedFrames: ['vedic_lahiri', 'bhava_chalit', 'canonical_instant'],
        primaryQualificationSources: [
          'D1 Rashi dignity & sign/house placement',
          'BPHS Ch. 34 Lagna-specific functional lordship rules',
          'D9 Navamsa & Varga condition (preserving distinct_analytical_significance)',
          'Bhinnashtakavarga / Vimshopaka (when usable)',
        ],
        provisionalTreatment:
          'shadbala_major_6 and bhavabala remain provisional per SHADBALA_BHAVABALA_ISSUE_REGISTER.md and cannot reach AC1.',
        crossSystemNonDominanceNote:
          'Parashari D1, D9, Sripati Bhava Chalit, and Shadbala operate within isolated boundaries without global scalar override.',
      },
      kp: {
        methodology: 'kp',
        permittedFrames: ['kp_placidus', 'canonical_instant'],
        primaryQualificationSources: [
          'KP Placidus cuspal sub-lords (1st..12th)',
          'KP planet star-lord & sub-lord chains',
          'KP 4-level house significators',
        ],
        provisionalTreatment:
          'KP Placidus evidence requires verified cuspal longitudes and never suppresses Parashari Vargas globally.',
        crossSystemNonDominanceNote:
          'KP Placidus cuspal authority applies strictly inside kp_placidus objectives and never globally overrides Parashari divisional conditions.',
      },
      jaimini: {
        methodology: 'jaimini',
        permittedFrames: ['vedic_lahiri', 'canonical_instant'],
        primaryQualificationSources: [
          'Jaimini Chara Karakas (AK..DK)',
          'Jaimini Arudha Padas (AL, UL, A2..A12)',
          'Rashi Drishti & Jaimini yogas',
        ],
        provisionalTreatment:
          '7-karaka vs 8-karaka node conventions must remain tagged explicitly.',
        crossSystemNonDominanceNote:
          'Jaimini Karaka/Pada roles complement Parashari lordship without replacing BPHS Ch. 34 functional classification.',
      },
      western_tropical: {
        methodology: 'western_tropical',
        permittedFrames: ['western_tropical', 'canonical_instant'],
        primaryQualificationSources: [
          'Sayana tropical placements & angles',
          'Traditional Ptolemaic essential dignities',
          'Western geometric aspects',
        ],
        provisionalTreatment:
          'Hellenistic/Western datasets stay quarantined inside western_tropical frame.',
        crossSystemNonDominanceNote:
          'Western tropical dignity never overrides or averages with sidereal Vedic Lahiri dignity.',
      },
      cross_tradition: {
        methodology: 'cross_tradition',
        permittedFrames: [
          'canonical_instant',
          'astronomical_telemetry',
          'cross_frame',
          'vedic_lahiri',
          'kp_placidus',
          'bhava_chalit',
          'western_tropical',
        ],
        primaryQualificationSources: [
          'Canonical birth instant & astronomical ephemeris telemetry',
          'Frame compatibility & epistemic trust boundaries',
          'Overlap & independence classification checks',
        ],
        provisionalTreatment:
          'Enforces Layer 1 provisional ceiling and separates computational, methodological, empirical, and analytical-tension statuses.',
        crossSystemNonDominanceNote:
          'Preserves cross-frame contrasts explicitly without forcing a single universal cross-system hierarchy.',
      },
    },
  });

export const DEFAULT_INDIVIDUAL_PREFERENCE_POLICY: Readonly<IndividualAnalyticalPreferencePolicy> =
  deepFreezePolicy({
    layerKind: 'individual_analytical_preference',
    status: 'future_compatible_contract_only',
    cannotBypassUniversalIntegrity: true,
    cannotMutateMethodologicalAuthority: true,
    companionRuntimeIntegrated: false,
    strictNonProvisionalOverride: false,
    allowProvisionalWithExplicitCaveats: true,
  });

// ============================================================================
// 6. R04 Methodological Authority Registry Contracts
// ============================================================================

export type VedicRashiSign =
  | 'Aries'
  | 'Taurus'
  | 'Gemini'
  | 'Cancer'
  | 'Leo'
  | 'Virgo'
  | 'Libra'
  | 'Scorpio'
  | 'Sagittarius'
  | 'Capricorn'
  | 'Aquarius'
  | 'Pisces';

export type LagnaFunctionalRole =
  | 'yogakaraka'
  | 'functional_benefic'
  | 'functional_malefic'
  | 'neutral_or_mixed'
  | 'maraka_flagged'
  | 'lagnesha_anchor'
  | 'contingent_nodal_agent'
  | 'non_planetary_lagna_reference';

export interface R04LagnaFunctionalSpecification {
  lagnaSign: VedicRashiSign;
  lagnaLord: PhiReadyPlanetName;
  yogakarakas: readonly PhiReadyPlanetName[];
  functionalBenefics: readonly PhiReadyPlanetName[];
  functionalMalefics: readonly PhiReadyPlanetName[];
  neutralOrMixed: readonly PhiReadyPlanetName[];
  marakaPlanets: readonly PhiReadyPlanetName[];
  conditionalMarakaPlanets?: readonly PhiReadyPlanetName[];
  houseLordships: Readonly<Record<number, PhiReadyPlanetName>>;
  classicalCaveats: readonly string[];
  coexistingResponsibilityNotes?: readonly string[];
  classicalConventionNotes?: readonly string[];
}

export interface R04RequiredEvidenceSpec {
  observationCodes: readonly string[];
  families: readonly EvidenceFamily[];
  minimumRequiredCount: number;
}

export interface R04ConditionalClassificationRule {
  conditionKey: string;
  resultingClass: AuthorityClassification;
  rationale: string;
}

export interface R04AuthorityClassifierSpec {
  defaultClass: AuthorityClassification;
  provisionalCapClass: AuthorityClassification;
  conditionalRules: readonly R04ConditionalClassificationRule[];
}

export interface R04SourceJustification {
  sourceType: 'classical' | 'methodological_governance' | 'astronomical';
  referenceCode: string;
  citation: string;
  notes: string;
}

export interface R04VerificationStatusSpec {
  computational: ComputationalVerificationStatus;
  methodological: MethodologicalVerificationStatus;
  empirical: EmpiricalValidationStatus;
}

export interface R04AuthorityRuleDefinition {
  ruleId: string;
  version: string;
  title: string;
  applicableMethodology: K03AuthorityMethodology;
  applicableAnalyticalObjective: AnalyticalObjectiveId;
  applicableSubjects?: readonly PlanetaryStateSubjectName[];
  requiredEvidence: R04RequiredEvidenceSpec;
  permittedChartFrames: readonly CanonicalEvidenceFrame[];
  qualificationPredicates: readonly string[];
  exclusionConditions: readonly string[];
  authorityClassification: R04AuthorityClassifierSpec;
  dependenciesAndLimitations: readonly string[];
  sourceOrMethodologicalJustification: R04SourceJustification;
  verificationStatus: R04VerificationStatusSpec;
  regressionTestReferences: readonly string[];
  lagnaFunctionalSpec?: R04LagnaFunctionalSpecification;
}

export interface R04RuleRegistrySnapshot {
  registryVersion: string;
  totalRules: number;
  objectivesCovered: readonly AnalyticalObjectiveId[];
  rules: R04AuthorityRuleDefinition[];
}

// ============================================================================
// 7. Non-Mutating P05 & P09 Enrichment Contracts (Populated in Phase 3)
// ============================================================================

export interface K03LagnaAuthorityEnrichment {
  lagnaSign: VedicRashiSign | null;
  lagnaLord: PhiReadyPlanetName | null;
  ruledHouses: number[];
  authorityClassification: AuthorityClassification;
  role: LagnaFunctionalRole;
  isLagnesha: boolean;
  isYogakaraka: boolean;
  isMaraka: boolean;
  isConditionalMaraka?: boolean;
  isKendraLord: boolean;
  isTrikonaLord: boolean;
  isDusthanaLord: boolean;
  ruleId: string;
  ruleVersion: string;
  rationale: string;
  caveats: string[];
  supportingEvidenceIds: string[];
}

export interface K03SubjectAuthorityEnrichmentView {
  subject: PlanetaryStateSubjectName;
  p05Authority: K03LagnaAuthorityEnrichment | null;
  p09FunctionalOrientation: {
    classification: LagnaFunctionalRole;
    authorityClassification: AuthorityClassification;
    ruleId: string;
    ruleVersion: string;
    caveats: string[];
  } | null;
  cearRecordIds: string[];
}

// ============================================================================
// 8. Phase 3 K03 Runtime Engine, P05/P09 & Staged K04 Relational Context
// ============================================================================

export interface K03RelationalDispositorSubjectFact {
  subject: PlanetaryStateSubjectName;
  signLord: PlanetaryStateSubjectName | null;
  terminalBasinId: string | null;
  terminalKind: 'self_disposited' | 'cycle' | 'unresolved' | null;
  isInSccCycle: boolean;
  sccMembers: PlanetaryStateSubjectName[];
  dependencyDepth: number | null;
  inboundDependentCount: number;
  parivartanaPartners: PlanetaryStateSubjectName[];
  evidenceIds: string[];
}

export interface K03RelationalContextInput {
  k04EngineVersion: string;
  frame: CanonicalEvidenceFrame;
  dependencyConcentrationIndex: number | null;
  dispositorBasinCount: number;
  bySubject: Partial<Record<PlanetaryStateSubjectName, K03RelationalDispositorSubjectFact>>;
  qualifiedRelationalEvidenceIds: string[];
}

export interface EvaluateK03ContextualAuthorityOptions {
  strictNonProvisional?: boolean;
  universalIntegrityPolicy?: UniversalIntegrityPolicy;
  methodologicalPolicy?: MethodologicalAuthorityPolicy;
  individualPreference?: IndividualAnalyticalPreferencePolicy | null;
  relationalContext?: K03RelationalContextInput | null;
  /**
   * Optional verification hook: any unregistered rule ID triggers `UnregisteredRuleError`.
   */
  verifyRegisteredRuleIds?: readonly string[];
}

export interface K03P05ObjectiveAuthorityEntry {
  objectiveId: AnalyticalObjectiveId;
  highestClassification: AuthorityClassification;
  qualifiedRecordCount: number;
  excludedRecordCount: number;
  unevaluatedOrIndeterminateCount: number;
  governingRuleIds: string[];
  provisionalCapped: boolean;
  provisionalCeilingApplied: AuthorityClassification | null;
  unresolvedPrerequisites: string[];
  cearRecordIds: string[];
}

export interface K03P05SubjectAuthorityProfile {
  subject: PlanetaryStateSubjectName;
  dimension: 'authority';
  objectiveAuthorities: Record<AnalyticalObjectiveId, K03P05ObjectiveAuthorityEntry>;
  lagnaAuthority: K03LagnaAuthorityEnrichment | null;
  /**
   * Diagnostic summary only across this subject's evaluated CEAR records.
   * MUST NEVER be treated as a universal planetary authority rank or fed into scoring/prioritization.
   */
  overallHighestClassification: AuthorityClassification;
  overallHighestClassificationDiagnosticMeta: {
    diagnosticMetadataOnly: true;
    notUniversalPlanetaryAuthority: true;
    forbiddenAsScoringOrPrioritizationInput: true;
    authorityRemainsObjectiveAndPropositionScoped: true;
    note: string;
  };
  provisionalCappedAny: boolean;
  unresolvedPrerequisites: string[];
  cearRecordIds: string[];
}

export type NaturalPlanetaryPolarity =
  | 'natural_benefic'
  | 'natural_malefic'
  | 'conditional_waxing_waning_moon'
  | 'conditional_associated_mercury'
  | 'chhaya_graha_shadow_node'
  | 'non_planetary_reference';

export type K03CoexistingResponsibilityCategory =
  | 'supportive'
  | 'constraining'
  | 'conditional'
  | 'house_specific';

export interface K03CoexistingFunctionalResponsibility {
  category: K03CoexistingResponsibilityCategory;
  houses: number[];
  label: string;
  rationale: string;
}

export interface K03MethodologicalFunctionalQualification {
  differsAcrossClassicalConventions: boolean;
  conventionNotes: string[];
  functionalBeneficDoesNotExcludeConditionalMaraka: true;
}

export interface K03P09FunctionalOrientationProfile {
  subject: PlanetaryStateSubjectName;
  dimension: 'functionalOrientation';
  status: 'evaluated' | 'constrained_sandhi_or_provisional' | 'unevaluated';
  lagnaSign: VedicRashiSign | null;
  methodology: K03AuthorityMethodology;
  ruleId: string | null;
  ruleVersion: string | null;
  authorityClassification: AuthorityClassification;
  role: LagnaFunctionalRole | 'unevaluated';
  functionalBenefic: boolean | null;
  functionalMalefic: boolean | null;
  yogakaraka: boolean | null;
  maraka: boolean | null;
  conditionalMaraka: boolean | null;
  conditionalMarakaHouses: number[];
  neutralOrMixed: boolean | null;
  lagnesha: boolean | null;
  directHouseLordships: {
    ruledHouses: number[];
    kendraHouses: number[];
    trikonaHouses: number[];
    dusthanaHouses: number[];
    marakaHouses: number[];
    badhakaNote: string | null;
  };
  coexistingResponsibilities: K03CoexistingFunctionalResponsibility[];
  methodologicalQualifications: K03MethodologicalFunctionalQualification;
  naturalSignifications: {
    naturalPolarity: NaturalPlanetaryPolarity;
    basis: string;
    nonConflationNote: string;
  };
  functionalResponsibilities: {
    summary: string;
    caveats: string[];
    roleSource: 'BPHS_CH34' | 'nodal_exemption' | 'lagna_anchor' | 'unevaluated';
  };
  jaiminiKarakas: {
    karakaCodes: string[];
    karakaScheme: string | null;
    sourceEvidenceIds: string[];
    separationNote: string;
  };
  kpSignifications: {
    kpHouse: number | null;
    starLord: string | null;
    subLord: string | null;
    fourLevelHouseSignifications: Record<string, number[]> | null;
    sourceEvidenceIds: string[];
    separationNote: string;
  };
  unresolvedPrerequisites: string[];
  cearRecordIds: string[];
}

export interface K03ObjectiveClassificationSummary {
  objectiveId: AnalyticalObjectiveId;
  totalRecords: number;
  countsByClassification: Record<AuthorityClassification, number>;
  governingRuleIds: string[];
  cearRecordIds: string[];
}

export interface K03IndependenceSummary {
  totalEvaluatedRecords: number;
  countsByClassification: Record<K03EvidenceIndependenceClassification, number>;
  doubleCountingGuardsApplied: number;
  distinctLensesPreserved: number;
  methodologicalIncompatibilities: number;
  overlapGroupsDetected: string[];
}

export interface K03ExclusionAndLimitationRecord {
  recordId: string;
  evidenceId: string | null;
  objectiveId: AnalyticalObjectiveId;
  subject: EvidenceEntityRef;
  classification: AuthorityClassification;
  reasonCode:
    | 'temporal_natal_quarantine'
    | 'blocked_or_incompatible_frame'
    | 'provisional_ceiling_cap'
    | 'strict_non_provisional_exclusion'
    | 'zero_coercion_missing_or_null'
    | 'overlap_double_counting_guard'
    | 'subject_scope_inapplicable'
    | 'p08_excluded_from_phi'
    | 'missing_lagna_or_prerequisite'
    | 'methodological_non_dominance_guard';
  rationale: string;
  ruleId: string | null;
  unresolvedPrerequisites: string[];
}

export interface K03UnresolvedRequirementRecord {
  requirementId: string;
  objectiveId: AnalyticalObjectiveId;
  subject: PlanetaryStateSubjectName | string;
  prerequisiteKey: string;
  classification: 'unevaluated' | 'indeterminate' | AuthorityClassification;
  reason: string;
}

export interface K03RuleExecutionTrace {
  traceId: string;
  ruleId: string;
  ruleVersion: string;
  objectiveId: AnalyticalObjectiveId;
  subject: PlanetaryStateSubjectName | string;
  status: 'applied' | 'provisional_capped' | 'excluded' | 'unevaluated' | 'indeterminate';
  evaluatedEvidenceIds: string[];
  emittedCearIds: string[];
  reason: string;
}

export interface AnalyticalKernelK03AuthorityResult {
  engineVersion: typeof K03_AUTHORITY_ENGINE_VERSION;
  cearSchemaVersion: typeof K03_CEAR_SCHEMA_VERSION;
  registryVersion: typeof R04_AUTHORITY_REGISTRY_VERSION;
  generatedAtUtc: string;
  sourceInputFingerprint: string;
  strictNonProvisional: boolean;
  policyConfiguration: K03PolicyConfiguration;
  authorityScopeGuarantees: {
    objectiveAndPropositionScoped: true;
    crossObjectiveSummariesDiagnosticOnly: true;
    overallHighestNotScoringInput: true;
    ac5NeverSubstitutesForUnevaluatedOrIndeterminate: true;
  };
  relationalContextApplied: boolean;
  cearRecords: ContextualEvidenceAuthorityRecord[];
  r04RegistrySnapshot: R04RuleRegistrySnapshot;
  classificationsByObjective: Record<AnalyticalObjectiveId, K03ObjectiveClassificationSummary>;
  planetaryAuthorityEnrichment: Record<PlanetaryStateSubjectName, K03P05SubjectAuthorityProfile>;
  functionalOrientationProfiles: Record<PlanetaryStateSubjectName, K03P09FunctionalOrientationProfile>;
  independenceSummaries: K03IndependenceSummary;
  exclusionAndLimitationRecords: K03ExclusionAndLimitationRecord[];
  unresolvedRequirements: K03UnresolvedRequirementRecord[];
  ruleExecutionTraces: K03RuleExecutionTrace[];
}

