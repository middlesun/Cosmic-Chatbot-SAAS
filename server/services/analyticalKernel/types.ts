/**
 * CosmicCouncil Proprietary Analytical Intelligence Kernel — K01 Contracts
 *
 * Pure TypeScript / Web-standard types (zero Node built-ins; Cloudflare Workers safe).
 * Consumes read-only `LayerCAnalyticalInput` (`v2.layer_c_input.1.0`) without
 * modifying `server/services/v2Engine/`, inventing proprietary PHI/YSI/DSI weights,
 * assigning arbitrary bonuses, or invoking LLMs.
 */

import type {
  CalculationConventionsRecord,
  CanonicalBirthInstant,
  CanonicalDatasetState,
  TemporalScope,
} from '../v2Engine/types';
import type { R04AuthorityRuleDefinition } from './k03Types';

export class UnregisteredRuleError extends Error {
  ruleId: string;
  expectedVersion?: string;

  constructor(ruleId: string, expectedVersion?: string, actualVersion?: string) {
    const msg = actualVersion
      ? `Rule "${ruleId}" version mismatch: expected "${expectedVersion}", registered "${actualVersion}".`
      : `Unregistered analytical rule "${ruleId}". Every rule execution must be explicitly registered in the authoritative registry.`;
    super(msg);
    this.name = 'UnregisteredRuleError';
    this.ruleId = ruleId;
    this.expectedVersion = expectedVersion;
  }
}

export class UnregisteredMathModelError extends Error {
  modelId: string;

  constructor(modelId: string) {
    super(`Unregistered K02 mathematical model "${modelId}".`);
    this.name = 'UnregisteredMathModelError';
    this.modelId = modelId;
  }
}

export const ANALYTICAL_KERNEL_VERSION = 'k01.1.0' as const;
export const REPOSITORY_SCHEMA_VERSION = 'k01.repository.1.0' as const;
export const EVIDENCE_IMPACT_SCHEMA_VERSION = 'k01.impact.1.0' as const;
export const PLANETARY_STATE_SCHEMA_VERSION = 'k01.planetary_state.1.0' as const;
export const ANALYTICAL_RULE_VERSION = 'k01.rules.1.0' as const;

export const EVIDENCE_FAMILIES = [
  'positional',
  'quantitative',
  'degree_level',
  'stellar',
  'operating_condition',
  'relational',
  'dependency',
  'divisional',
  'configuration',
  'modification',
  'temporal',
  'historical_contextual',
] as const;

export type EvidenceFamily = (typeof EVIDENCE_FAMILIES)[number];

export const CANONICAL_EVIDENCE_FRAMES = [
  'canonical_instant',
  'vedic_lahiri',
  'kp_placidus',
  'bhava_chalit',
  'western_tropical',
  'astronomical_telemetry',
  'cross_frame',
] as const;

export type CanonicalEvidenceFrame = (typeof CANONICAL_EVIDENCE_FRAMES)[number];

export type ComputationalVerificationStatus =
  | 'verified_internal'
  | 'provider_reported'
  | 'provisional'
  | 'unverified'
  | 'incompatible'
  | 'unavailable';

export type MethodologicalVerificationStatus =
  | 'classical_standard'
  | 'provider_convention'
  | 'contested_or_uncalibrated'
  | 'incompatible_methodology'
  | 'unspecified';

/**
 * Strictly reserved: `independently_validated_external` may ONLY be set when
 * reconciled against external JHora / PyJHora / Swiss Ephemeris validation.
 */
export type EmpiricalValidationStatus =
  | 'not_validated'
  | 'independently_validated_external';

export type PropagatedTrustLevel = 'usable' | 'provisional' | 'blocked';

export type EvidenceEntityType =
  | 'planet'
  | 'ascendant'
  | 'angle'
  | 'house'
  | 'cusp'
  | 'sign'
  | 'nakshatra'
  | 'varga'
  | 'yoga'
  | 'dosha'
  | 'configuration'
  | 'dasha_period'
  | 'special_point'
  | 'chart_instant'
  | 'dataset';

export interface EvidenceEntityRef {
  type: EvidenceEntityType;
  id: string;
  name: string;
  role?: string;
}

export interface EvidenceObservation {
  code: string;
  label: string;
  summary: string;
  classification: string;
}

export interface EvidenceMeasurement {
  metric: string;
  value: number | string | boolean | null;
  unit: string | null;
  precisionNote?: string | null;
}

export interface EvidenceMethodology {
  tradition: 'vedic' | 'kp' | 'jaimini' | 'western' | 'astronomical' | 'cross_tradition';
  houseSystem: string | null;
  ayanamshaIdentifier: string | null;
  ayanamshaDegrees: number | null;
  nodeConvention: 'mean' | 'true' | 'not_applicable';
  conventionNotes: string[];
}

export interface EvidenceRuleReference {
  sourceType: 'classical' | 'proprietary' | 'astronomical' | 'provider';
  referenceCode: string;
  citation: string;
}

export interface EvidenceSourceDatasetRef {
  datasetKey: string;
  providerOrModule: string;
  canonicalStatus: CanonicalDatasetState;
  acquiredAtUtc: string | null;
}

export interface EvidenceLineageMetadata {
  parentEvidenceIds: string[];
  derivedFromMetrics: string[];
  derivationDepth: number;
}

export interface EvidenceVerificationMetadata {
  computational: ComputationalVerificationStatus;
  methodological: MethodologicalVerificationStatus;
  empirical: EmpiricalValidationStatus;
  propagatedTrust: PropagatedTrustLevel;
  statusNotes: string[];
}

export interface EvidenceSensitivityMetadata {
  birthTimeSensitive: boolean;
  sandhiOrBoundaryRisk: boolean;
  conventionSensitive: boolean;
  reasons: string[];
}

export interface EvidenceVersionMetadata {
  kernelVersion: string;
  ruleVersion: string;
  sourceSchemaVersion: string;
  recalculationVersion: string | null;
}

export interface CanonicalEvidenceObject {
  evidenceId: string;
  naturalKey: string;
  subject: EvidenceEntityRef;
  relatedEntities: EvidenceEntityRef[];
  family: EvidenceFamily;
  secondaryTags: string[];
  observation: EvidenceObservation;
  measurements: EvidenceMeasurement[];
  frame: CanonicalEvidenceFrame;
  methodology: EvidenceMethodology;
  ruleReference: EvidenceRuleReference;
  sourceDatasets: EvidenceSourceDatasetRef[];
  lineage: EvidenceLineageMetadata;
  temporalScope: TemporalScope;
  referenceDateIso: string | null;
  verification: EvidenceVerificationMetadata;
  sensitivity: EvidenceSensitivityMetadata;
  versions: EvidenceVersionMetadata;
}

export interface NaturalKeyParts {
  chartFingerprint: string;
  frame: CanonicalEvidenceFrame;
  family: EvidenceFamily;
  observationCode: string;
  subjectType: EvidenceEntityType;
  subjectId: string;
  ruleCode: string;
  temporalScope: TemporalScope;
  referenceDateIso?: string | null;
  qualifier?: string | null;
}

export interface CanonicalEvidenceDraft {
  naturalKeyParts: NaturalKeyParts;
  subject: EvidenceEntityRef;
  relatedEntities?: EvidenceEntityRef[];
  family: EvidenceFamily;
  secondaryTags?: string[];
  observation: EvidenceObservation;
  measurements: EvidenceMeasurement[];
  frame: CanonicalEvidenceFrame;
  methodology: EvidenceMethodology;
  ruleReference: EvidenceRuleReference;
  sourceDatasets: EvidenceSourceDatasetRef[];
  parentEvidenceIds?: string[];
  derivedFromMetrics?: string[];
  temporalScope: TemporalScope;
  referenceDateIso: string | null;
  verification: EvidenceVerificationMetadata;
  sensitivity: EvidenceSensitivityMetadata;
  versions: EvidenceVersionMetadata;
}

export const PLANETARY_STATE_DIMENSIONS = [
  'capacity',
  'integrity',
  'stability',
  'autonomy',
  'authority',
  'vulnerability',
  'resilience',
  'influenceFootprint',
  'functionalOrientation',
  'deliverability',
] as const;

export type PlanetaryStateDimensionName = (typeof PLANETARY_STATE_DIMENSIONS)[number];

export type EvidenceImpactDirection =
  | 'supporting'
  | 'constraining'
  | 'modifying'
  | 'neutral';

export type EvidenceImpactMagnitude =
  | {
      kind: 'unassigned_no_arbitrary_weight';
    }
  | {
      kind: 'justified_rule_value';
      value: number;
      unit: string;
      ruleReference: string;
    };

export type EvidenceOverlapType =
  | 'exact_duplicate'
  | 'partial_mathematical_overlap'
  | 'shared_upstream_dependency'
  | 'distinct_analytical_significance';

export interface EvidenceImpactOverlapMetadata {
  overlapGroupId: string | null;
  independenceStatus: 'independent' | 'shared_upstream' | 'partial_overlap' | 'exact_duplicate';
  notes: string[];
}

export interface EvidenceImpactResidual {
  status: 'unevaluated_pending_k05_k07';
  note: string;
}

export type EvidenceImpactInteractionType =
  | 'direct'
  | 'modifier'
  | 'cancellation'
  | 'amplification'
  | 'contextual_gate'
  | 'conditional';

/**
 * Separate contextual impact contract — kept strictly isolated from
 * `CanonicalEvidenceObject` and free of arbitrary numerical bonuses.
 */
export interface EvidenceImpactObject {
  schemaVersion: typeof EVIDENCE_IMPACT_SCHEMA_VERSION;
  impactId: string;
  evidenceId: string;
  analyticalTarget: EvidenceEntityRef;
  affectedDimension: PlanetaryStateDimensionName | (string & {});
  direction: EvidenceImpactDirection;
  magnitude: EvidenceImpactMagnitude;
  applicabilityConditions: string[];
  interactionType: EvidenceImpactInteractionType;
  modifierEvidenceIds: string[];
  overlapMetadata: EvidenceImpactOverlapMetadata;
  residualImpact: EvidenceImpactResidual;
}

export interface EvidenceLineageEdge {
  edgeId: string;
  parentEvidenceId: string;
  childEvidenceId: string;
  relationship: 'derived_from' | 'aggregated_from' | 'evaluated_against';
  derivedFromMetrics: string[];
}

export interface EvidenceOverlapRelation {
  relationId: string;
  evidenceIdA: string;
  evidenceIdB: string;
  overlapType: EvidenceOverlapType;
  secondaryClassifications: EvidenceOverlapType[];
  sharedUpstreamIds: string[];
  sharedMetrics: string[];
  collapseRecommended: boolean;
  rationale: string;
}

export interface UnresolvedParentReference {
  childEvidenceId: string;
  missingParentId: string;
}

export interface EvidenceLineageGraph {
  edges: EvidenceLineageEdge[];
  overlapRelations: EvidenceOverlapRelation[];
  rootEvidenceIds: string[];
  maxDerivationDepth: number;
  cycleCheckPassed: boolean;
  unresolvedParentRefs: UnresolvedParentReference[];
}

export interface PlanetaryStateObservation {
  key: string;
  value: number | string | boolean | null;
  unit: string | null;
  sourceEvidenceId: string;
  trust: PropagatedTrustLevel;
}

export interface PlanetaryStateDimension {
  status: 'observed_direct_only' | 'unevaluated';
  supportedEvidenceIds: string[];
  directObservations: PlanetaryStateObservation[];
  unevaluatedReason: string | null;
}

export const PLANETARY_STATE_SUBJECTS = [
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
  'Rahu',
  'Ketu',
  'Ascendant',
] as const;

export type PlanetaryStateSubjectName = (typeof PLANETARY_STATE_SUBJECTS)[number];

export interface PlanetaryStateRecord {
  schemaVersion: typeof PLANETARY_STATE_SCHEMA_VERSION;
  planet: PlanetaryStateSubjectName;
  dimensions: Record<PlanetaryStateDimensionName, PlanetaryStateDimension>;
}

export interface RejectedOrBlockedDatasetNotice {
  frame: CanonicalEvidenceFrame;
  datasetKey: string;
  canonicalStatus: CanonicalDatasetState;
  reason: string;
}

export interface DeferredSlot<T = null> {
  status: 'deferred';
  note: string;
  data: T;
}

export interface AnalyticalEvidenceRepository {
  schemaVersion: typeof REPOSITORY_SCHEMA_VERSION;
  kernelVersion: typeof ANALYTICAL_KERNEL_VERSION;
  ruleVersion: typeof ANALYTICAL_RULE_VERSION;
  generatedAtUtc: string;
  sourceChart: {
    contractVersion: string;
    inputFingerprint: string;
    sourceSchemaVersion: string;
    recalculationVersion: string | null;
    canonicalBirthInstant: CanonicalBirthInstant;
    calculationConventions: CalculationConventionsRecord | null;
    minimumChartReady: boolean;
    comprehensiveFoundationalReady: boolean;
    externalValidationAchieved: boolean;
  };
  natalEvidence: CanonicalEvidenceObject[];
  temporalEvidence: CanonicalEvidenceObject[];
  rejectedOrBlockedFrames: RejectedOrBlockedDatasetNotice[];
  lineageGraph: EvidenceLineageGraph;
  impactContracts: EvidenceImpactObject[];
  planetaryStates: Record<PlanetaryStateSubjectName, PlanetaryStateRecord>;
  familyInventory: Record<EvidenceFamily, number>;
  frameInventory: Record<CanonicalEvidenceFrame, number>;
  lifeContext: DeferredSlot<null>;
  investigationFindings: DeferredSlot<[]>;
}

// ============================================================================
// K02 — Planetary State Intelligence, Rule Registry & PHI-Ready Contracts
// ============================================================================

export const K02_STATE_ENGINE_VERSION = 'k02.1.0' as const;
export const ANALYTICAL_RULE_REGISTRY_VERSION = 'k02.rules.1.0' as const;
export const K02_PROJECTION_SCHEMA_VERSION = 'k02.phi_projection.1.0' as const;

export type RuleTradition =
  | 'vedic_parashari'
  | 'surya_siddhanta'
  | 'vedic_ashtakavarga'
  | 'kp_krishnamurti'
  | 'jaimini'
  | 'western_traditional'
  | 'astronomical_ephemeris'
  | 'cross_tradition_governance';

export type RuleTargetScope =
  | 'classical_seven_planets'
  | 'sun_excluded_planets'
  | 'tara_graha_only'
  | 'nodes_only'
  | 'ascendant_only'
  | 'all_planets_excluding_ascendant'
  | 'all_ten_subjects';

export type RuleMathModelType =
  | 'threshold_ratio'
  | 'bounded_linear_deviation'
  | 'categorical_lookup'
  | 'multi_component_index'
  | 'binary_or_orb_gate'
  | 'non_scalar_qualitative'
  | 'exclusion_guard';

export interface AnalyticalMathModelSpec {
  modelId: string;
  modelType: RuleMathModelType;
  inputUnit: string;
  outputUnit: string;
  parameters: Record<string, number | string | boolean | Record<string, number>>;
  normalizationBounds: { min: number; max: number } | null;
  nullOrZeroBehavior: string;
  formulaSummary: string;
}

export type RuleExecutionOutcomeStatus =
  | 'applied'
  | 'partially_applied'
  | 'not_applicable'
  | 'blocked_missing_inputs'
  | 'blocked_incompatible_frame'
  | 'excluded_by_provisional_gate';

export type RuleTargetDimension =
  | PlanetaryStateDimensionName
  | 'overlay_conflict'
  | 'overlay_modification'
  | 'overlay_reliability'
  | 'nodal_condition_profile'
  | 'ascendant_condition_profile'
  | 'phi_projection';

export interface AnalyticalRuleDefinition {
  ruleId: string;
  version: string;
  title: string;
  layer: 'K02';
  tradition: RuleTradition;
  targetDimension: RuleTargetDimension;
  targetScope: RuleTargetScope;
  applicableSubjects: PlanetaryStateSubjectName[];
  requiredFrames: CanonicalEvidenceFrame[];
  requiredObservationCodes: string[];
  optionalObservationCodes: string[];
  citation: {
    sourceType: 'classical' | 'astronomical' | 'proprietary';
    referenceCode: string;
    text: string;
  };
  applicabilityBoundaries: string[];
  provisionalPolicy:
    | 'accept_usable_only'
    | 'accept_with_provisional_cap'
    | 'provisional_only_annotation';
  overlapHandlingPolicy: string;
  excludedK03ToK08Concerns: string[];
  mathModel: AnalyticalMathModelSpec;
}

export interface AnalyticalRuleRegistrySnapshot {
  registryVersion: string;
  totalRules: number;
  rules: AnalyticalRuleDefinition[];
  r04RegistryVersion?: string;
  r04TotalRules?: number;
  r04Rules?: R04AuthorityRuleDefinition[];
  r07RegistryVersion?: string;
  r07TotalModels?: number;
  r07Models?: AnalyticalRuleDefinition['mathModel'][];
}

export interface RuleExecutionRecord {
  executionId: string;
  ruleId: string;
  ruleVersion: string;
  subject: PlanetaryStateSubjectName;
  targetDimension: RuleTargetDimension;
  status: RuleExecutionOutcomeStatus;
  outcome: RuleExecutionOutcomeStatus;
  sourceEvidenceIds: string[];
  emittedImpactIds: string[];
  missingInputs: string[];
  provisionalDependencies: string[];
  mathModelId: string;
  mathOutputSummary: string | null;
  numericalResult: number | null;
  reason: string;
}

export interface RuleExecutionSummary {
  registryVersion: string;
  totalEvaluations: number;
  countsByStatus: Record<RuleExecutionOutcomeStatus, number>;
  unregisteredRuleRejections: number;
  records: RuleExecutionRecord[];
}

export interface K02NormalizedSignal {
  signalKey: string;
  ruleId: string;
  ruleVersion: string;
  frame: CanonicalEvidenceFrame;
  label: string;
  rawValue: number | string | boolean | null;
  rawUnit: string | null;
  normalizedValue: number | null;
  normalizedUnit: string | null;
  qualitativeClass: string | null;
  direction: EvidenceImpactDirection;
  trust: PropagatedTrustLevel;
  sourceEvidenceIds: string[];
  impactId: string | null;
  overlapStatus: EvidenceImpactOverlapMetadata['independenceStatus'];
  citationCode: string;
}

export type K02DimensionEvaluationStatus =
  | 'evaluated'
  | 'partially_evaluated'
  | 'observed_direct_only'
  | 'not_applicable'
  | 'blocked_missing_inputs'
  | 'deferred_to_downstream'
  | 'deferred_to_k03_k08';

export interface K02PlanetaryDimensionEvaluation {
  dimension: PlanetaryStateDimensionName;
  status: K02DimensionEvaluationStatus;
  deferredCapability: 'K03' | 'K05' | 'K07' | 'K08' | null;
  summary: string;
  signals: K02NormalizedSignal[];
  supportedEvidenceIds: string[];
  impactIds: string[];
  ruleIdsExecuted: string[];
  directObservations: PlanetaryStateObservation[];
  deferredToK03ToK08: string[];
  limitations: string[];
}

export type ConflictOverlaySeverity = 'low' | 'moderate' | 'high';

export interface ConflictOverlayItem {
  conflictId: string;
  conflictType:
    | 'frame_house_divergence'
    | 'd1_d9_dignity_divergence'
    | 'strength_vs_condition_tension'
    | 'ishta_kashta_polarity_tension'
    | 'cross_frame_dignity_divergence'
    | 'frame_divergence'
    | 'tradition_tension'
    | 'strength_vs_dignity_divergence'
    | 'd1_vs_d9_divergence'
    | 'capacity_vs_vulnerability_tension'
    | 'condition_vs_quantitative_tension';
  severity: ConflictOverlaySeverity;
  title: string;
  description: string;
  framesInvolved: CanonicalEvidenceFrame[];
  evidenceIds: string[];
  ruleId: string;
  resolutionStatus:
    | 'unresolved_preserved_for_k05_k07'
    | 'unresolved_preserved_for_k07'
    | 'contextual_divergence_noted';
}

export interface ConflictOverlay {
  hasConflicts: boolean;
  conflictCount: number;
  conflicts: ConflictOverlayItem[];
  note: string;
}

export interface ModificationOverlayItem {
  modifierId: string;
  modifierType:
    | 'retrograde'
    | 'combust'
    | 'vargottama'
    | 'gandanta'
    | 'graha_yuddha'
    | 'parivartana'
    | 'chalit_shift'
    | 'sandhi_boundary'
    | 'dosha_factor'
    | 'combustion_asta'
    | 'retrogression_cheshta'
    | 'dispositor_dependency'
    | 'neecha_bhanga_candidate'
    | 'avastha_provisional';
  status: 'active' | 'candidate_pending_k05_k07';
  label: string;
  summary: string;
  affectedDimensions: PlanetaryStateDimensionName[];
  evidenceIds: string[];
  sourceEvidenceIds: string[];
  trust: PropagatedTrustLevel;
  pendingResolutionBy: 'K05_K07';
  ruleId: string;
  pendingDownstreamResolution: string;
}

export interface ModificationOverlay {
  activeModifierCount: number;
  modifiers: ModificationOverlayItem[];
  note: string;
}

export type K02ConfidenceCeiling =
  | 'insufficient_data'
  | 'capped_provisional'
  | 'moderate_provider_dependent'
  | 'high_internal';

export interface ReliabilityOverlay {
  overallTrust: PropagatedTrustLevel;
  confidenceCeiling: K02ConfidenceCeiling;
  externalValidationAchieved: boolean;
  computationalFloor: ComputationalVerificationStatus;
  methodologicalProfile: MethodologicalVerificationStatus[];
  empiricalStatus: EmpiricalValidationStatus;
  birthTimeSensitive: boolean;
  sandhiOrBoundaryRisk: boolean;
  conventionSensitive: boolean;
  provisionalEvidenceIds: string[];
  blockedEvidenceIds: string[];
  provisionalDependencies: string[];
  blockedDependencies: string[];
  usableEvidenceCount: number;
  provisionalEvidenceCount: number;
  blockedEvidenceCount: number;
  confidenceCeilingNote: string;
  sensitivityReasons: string[];
}

export interface K02SubjectStateRecord {
  schemaVersion: typeof K02_STATE_ENGINE_VERSION;
  subject: PlanetaryStateSubjectName;
  subjectCategory: 'classical_seven_planet' | 'lunar_node' | 'ascendant';
  dimensions: Record<PlanetaryStateDimensionName, K02PlanetaryDimensionEvaluation>;
  overlays: {
    conflict: ConflictOverlay;
    modification: ModificationOverlay;
    reliability: ReliabilityOverlay;
  };
  ruleExecutions: RuleExecutionRecord[];
  emittedImpactIds: string[];
}

export const PHI_READY_PLANETS = [
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
] as const;

export type PhiReadyPlanetName = (typeof PHI_READY_PLANETS)[number];

export interface PhiReadyExcludedBoundaries {
  excludedK03StructuralAuthority: true;
  excludedDomainImportance: true;
  excludedTemporalDashaGochar: true;
  excludedHistoricalOutcomes: true;
  excludedHouseOwnershipNoise: true;
  excludedArbitraryWeights: true;
  temporalEvidenceExcluded: true;
  structuralAuthorityExcluded: true;
  domainImportanceExcluded: true;
  historicalOutcomesExcluded: true;
  unrelatedHouseFootprintExcluded: true;
  temporalEvidenceCountExcluded: number;
  unrelatedHouseFootprintEvidenceCountExcluded: number;
  note: string;
}

export interface PhiPartialOverlapGroupSummary {
  overlapGroupId: string;
  category:
    | 'shadbala_aggregate_vs_subcomponents'
    | 'ashtakavarga_prastara_vs_bav'
    | 'vimshopaka_multi_scheme'
    | 'other_partial_overlap';
  primaryEvidenceId: string;
  secondaryEvidenceIds: string[];
  rationale: string;
}

export interface PhiReadyPlanetProjection {
  schemaVersion: typeof K02_PROJECTION_SCHEMA_VERSION;
  planet: PhiReadyPlanetName;
  eligibility: 'phi_eligible_classical_planet';
  shadbalaRupaRatio: {
    available: boolean;
    totalRupas: number | null;
    bphsMinRupas: number;
    ratio: number | null;
    trust: PropagatedTrustLevel | null;
    sourceEvidenceId: string | null;
  };
  ashtakavargaBav: {
    available: boolean;
    bindus: number | null;
    neutralMidpoint: 4;
    boundedDeviation: number | null;
    trust: PropagatedTrustLevel | null;
    sourceEvidenceId: string | null;
  };
  vimshopaka: {
    available: boolean;
    shodashvargaScore: number | null;
    normalizedRatio: number | null;
    tier: string | null;
    trust: PropagatedTrustLevel | null;
    sourceEvidenceId: string | null;
  };
  ishtaKashta: {
    available: boolean;
    ishtaPhala: number | null;
    kashtaPhala: number | null;
    dominantSide: 'ishta_dominant' | 'kashta_dominant' | 'balanced' | null;
    trust: PropagatedTrustLevel | null;
    sourceEvidenceId: string | null;
  };
  d1Integrity: {
    dignityClass: string | null;
    sign: string | null;
    house: number | null;
    westernEssentialDignity: string | null;
    sourceEvidenceIds: string[];
  };
  d9Reinforcement: {
    d9Sign: string | null;
    d9Dignity: string | null;
    isVargottama: boolean | null;
    divergenceFlag: boolean;
    sourceEvidenceIds: string[];
  };
  motionAndConditions: {
    motionState: string | null;
    isRetrograde: boolean | null;
    isCombust: boolean | null;
    sunSeparationDeg: number | null;
    inGrahaYuddha: boolean | null;
    grahaYuddhaRole: string | null;
    isGandanta: boolean | null;
    sandhiRisk: boolean;
    sourceEvidenceIds: string[];
  };
  autonomySummary: {
    signLord: string | null;
    finalDispositor: string | null;
    isSelfDisposited: boolean | null;
    terminationType: string | null;
    inParivartana: boolean;
    sourceEvidenceIds: string[];
  };
  crossFramePresence: {
    vedicD1Sign: string | null;
    bhavaChalitHouse: number | null;
    kpHouse: number | null;
    kpStarLord: string | null;
    kpSubLord: string | null;
    westernSign: string | null;
    frameDivergenceFlags: string[];
  };
  deduplicatedEvidenceIds: string[];
  collapsedDuplicateIds: string[];
  partialOverlapGroups: PhiPartialOverlapGroupSummary[];
  preservedDistinctLensIds: string[];
  excludedOverlapGroupIds: string[];
  reliabilityCeiling: PropagatedTrustLevel;
  conflictFlags: string[];
  pendingK05K07Modifiers: string[];
  overlays: {
    conflict: ConflictOverlay;
    modification: ModificationOverlay;
    reliability: ReliabilityOverlay;
  };
  excludedBoundaries: PhiReadyExcludedBoundaries;
}

export interface NodalConditionProfile {
  schemaVersion: typeof K02_PROJECTION_SCHEMA_VERSION;
  node: 'Rahu' | 'Ketu';
  subjectCategory: 'lunar_node_shadow_graha';
  shadbalaStatus: 'not_applicable_lunar_node';
  shadbalaExcludedReason: string;
  ashtakavargaExcludedReason: string;
  nodeCalculationConvention: 'mean' | 'true' | 'not_applicable';
  vedicPlacement: {
    sign: string | null;
    house: number | null;
    degreeInSign: number | null;
    nakshatra: string | null;
    pada: number | null;
    nakshatraLord: string | null;
    dignityLabel: string | null;
  };
  chalitAndKp: {
    bhavaChalitHouse: number | null;
    kpHouse: number | null;
    kpStarLord: string | null;
    kpSubLord: string | null;
  };
  westernTropical: {
    sign: string | null;
    house: number | null;
    degreeInSign: number | null;
  };
  d9AndVargottama: {
    d9Sign: string | null;
    isVargottama: boolean | null;
  };
  dispositorDependency: {
    d1SignLord: string | null;
    finalDispositor: string | null;
    terminationType: string | null;
    chainPath: string | null;
  };
  conjunctionAndAspectWitnesses: Array<{
    partner: string;
    relation: string;
    frame: CanonicalEvidenceFrame;
    evidenceId: string;
  }>;
  operatingConditions: {
    isRetrogradeMean: boolean | null;
    isGandanta: boolean;
    sandhiRisk: boolean;
  };
  reliabilityCeiling: PropagatedTrustLevel;
  conflictFlags: string[];
  overlays: {
    conflict: ConflictOverlay;
    modification: ModificationOverlay;
    reliability: ReliabilityOverlay;
  };
  sourceEvidenceIds: string[];
  deferredToK03ToK08: string[];
}

export interface AscendantConditionProfile {
  schemaVersion: typeof K02_PROJECTION_SCHEMA_VERSION;
  subject: 'Ascendant';
  subjectCategory: 'reference_point_lagna';
  shadbalaStatus: 'not_applicable_ascendant';
  nonPlanetaryPointNote: string;
  vedicD1: {
    sign: string | null;
    signLord: string | null;
    degreeInSign: number | null;
    fullLongitudeDeg: number | null;
    nakshatra: string | null;
    pada: number | null;
    nakshatraLord: string | null;
  };
  d9Navamsa: {
    d9Sign: string | null;
    isVargottama: boolean | null;
  };
  kpCusp1: {
    sign: string | null;
    starLord: string | null;
    subLord: string | null;
    degreeInSign: number | null;
  };
  westernAscendant: {
    sign: string | null;
    degreeInSign: number | null;
  };
  lagnaLordReference: {
    signLord: string | null;
    finalDispositor: string | null;
    terminationType: string | null;
    chainPath: string | null;
    sourceEvidenceIds: string[];
  };
  sandhiAndTimeSensitivity: {
    birthTimeSensitive: boolean;
    sandhiOrBoundaryRisk: boolean;
    reasons: string[];
  };
  reliabilityCeiling: PropagatedTrustLevel;
  reliabilityOverlay: ReliabilityOverlay;
  sourceEvidenceIds: string[];
  deferredLagnaAuthorityNote: string;
}

export interface AnalyticalKernelK02StateResult {
  engineVersion: typeof K02_STATE_ENGINE_VERSION;
  registryVersion: typeof ANALYTICAL_RULE_REGISTRY_VERSION;
  projectionSchemaVersion: typeof K02_PROJECTION_SCHEMA_VERSION;
  generatedAtUtc: string;
  sourceInputFingerprint: string;
  strictNonProvisional: boolean;
  ruleRegistrySnapshot: AnalyticalRuleRegistrySnapshot;
  subjectStates: Record<PlanetaryStateSubjectName, K02SubjectStateRecord>;
  impactContracts: EvidenceImpactObject[];
  k02ImpactContracts: EvidenceImpactObject[];
  ruleExecutionSummary: RuleExecutionSummary;
  phiReadyProjections: PhiReadyPlanetProjection[];
  phiReadyProjection: {
    classicalPlanets: Record<PhiReadyPlanetName, PhiReadyPlanetProjection>;
    excludedSubjects: ['Rahu', 'Ketu', 'Ascendant'];
    boundaryGuarantees: PhiReadyExcludedBoundaries;
  };
  nodalConditionProfiles: {
    Rahu: NodalConditionProfile;
    Ketu: NodalConditionProfile;
  };
  nodalProfiles: {
    Rahu: NodalConditionProfile;
    Ketu: NodalConditionProfile;
  };
  ascendantConditionProfile: AscendantConditionProfile;
  ascendantProfile: AscendantConditionProfile;
}

export interface AnalyticalKernelK02Bundle {
  k01Repository: AnalyticalEvidenceRepository;
  k02State: AnalyticalKernelK02StateResult;
}


