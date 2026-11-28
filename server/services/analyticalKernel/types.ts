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
