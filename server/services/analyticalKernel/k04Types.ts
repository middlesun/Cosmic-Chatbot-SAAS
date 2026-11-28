/**
 * CosmicCouncil Proprietary Analytical Intelligence Kernel — K04 Relational Intelligence Contracts
 *
 * Pure TypeScript / Web-standard contracts (zero Node built-ins; Cloudflare Workers safe).
 * Zero external graph databases, zero LLM calls, zero live API calls, zero DB writes.
 *
 * Defines:
 *  - Typed Natal Intelligence Graph (NIG) entity nodes across 9 entity types
 *  - Strongly typed, directed, serializable relationship edges across all 12 families
 *  - Strict chart frame isolation (`vedic_lahiri`, `vedic_lahiri:D9`, `vedic_lahiri:D10`,
 *    `vedic_lahiri:<DIV>`, `bhava_chalit`, `kp_placidus`, `western_tropical`, `cross_frame`, etc.)
 *  - Explicit `configuration` participant records (`adjudicationStatus: 'participants_mapped_interaction_deferred_to_k05_k07'`)
 *  - 4 logical projection contracts (`natal`, `functional_domain`, `temporal`, `private_investigative_contextual`)
 */

import { sha256Hex } from './lineage';
import type { AnalyticalKernelK03AuthorityResult } from './k03Types';
import type {
  CanonicalEvidenceFrame,
  ComputationalVerificationStatus,
  MethodologicalVerificationStatus,
  PropagatedTrustLevel,
} from './types';

export const K04_RELATIONAL_ENGINE_VERSION = 'k04.1.0' as const;
export const K04_NIG_SCHEMA_VERSION = 'k04.nig.1.0' as const;

// ============================================================================
// 1. 9 NIG Entity Types
// ============================================================================

export const NIG_ENTITY_TYPES = [
  'planet',
  'ascendant',
  'house',
  'sign',
  'nakshatra',
  'divisional_placement',
  'configuration',
  'evidence_object',
  'registered_functional_role',
] as const;

export type NigEntityType = (typeof NIG_ENTITY_TYPES)[number];

// ============================================================================
// 2. 12 NIG Relationship Families
// ============================================================================

export const NIG_RELATIONSHIP_FAMILIES = [
  'occupancy',
  'governance',
  'dependency',
  'association',
  'aspect',
  'compatibility',
  'configuration_participation',
  'modification',
  'cross_frame_relationship',
  'functional_relationship',
  'temporal_relationship',
  'evidence_lineage',
] as const;

export type NigRelationshipFamily = (typeof NIG_RELATIONSHIP_FAMILIES)[number];

// ============================================================================
// 3. Isolated Chart Frames & Relationship Qualifiers
// ============================================================================

export type NigChartFrame =
  | 'canonical_instant'
  | 'vedic_lahiri'
  | 'vedic_lahiri:D9'
  | 'vedic_lahiri:D10'
  | `vedic_lahiri:${string}`
  | 'bhava_chalit'
  | 'kp_placidus'
  | 'western_tropical'
  | 'astronomical_telemetry'
  | 'cross_frame';

export type NigRelationshipDirection = 'directed';

export type NigEdgeQualificationStatus =
  | 'qualified'
  | 'qualified_with_caveats'
  | 'provisional'
  | 'blocked'
  | 'deferred_to_k09';

export type NigEdgeMethodology =
  | 'vedic_parashari'
  | 'kp'
  | 'jaimini'
  | 'western_tropical'
  | 'astronomical'
  | 'cross_tradition';

// ============================================================================
// 4. Strongly Typed Relationship Types (Rejecting Generic Undifferentiated Edges)
// ============================================================================

export type NigTypedRelationshipName =
  // Family 1: occupancy
  | 'occupies_rashi_sign'
  | 'occupies_whole_sign_house'
  | 'occupies_nakshatra'
  | 'lagna_occupies_rashi_sign'
  | 'lagna_anchors_first_house'
  | 'lagna_occupies_nakshatra'
  | 'occupies_divisional_placement'
  | 'divisional_placement_in_sign'
  | 'divisional_placement_in_house'
  | 'occupies_sripati_chalit_house'
  | 'occupies_kp_placidus_house'
  | 'occupies_kp_sign'
  | 'occupies_tropical_sign'
  | 'occupies_placidus_house'
  // Family 2: governance
  | 'lords_whole_sign_house_bhavesha'
  | 'rules_rashi_sign'
  | 'rules_nakshatra'
  | 'divisional_rules_sign'
  | 'kp_cusp_sign_lord'
  | 'western_rules_sign'
  // Family 3: dependency
  | 'disposited_by_sign_lord'
  | 'disposited_by_nakshatra_lord'
  | 'house_depends_on_bhavesha'
  | 'lagna_depends_on_lagnesh'
  | 'lagna_depends_on_nakshatra_lord'
  | 'divisional_sign_dispositor'
  | 'kp_cusp_star_lord'
  | 'kp_cusp_sub_lord'
  | 'kp_cusp_sub_sub_lord'
  | 'kp_planet_sign_lord'
  | 'kp_planet_star_lord'
  | 'kp_planet_sub_lord'
  | 'kp_planet_sub_sub_lord'
  | 'kp_significator_level_1'
  | 'kp_significator_level_2'
  | 'kp_significator_level_3'
  | 'kp_significator_level_4'
  | 'western_traditional_sign_dispositor'
  // Family 4: association
  | 'conjunct_in_d1_rashi_sign'
  | 'conjunct_in_divisional_sign'
  | 'conjunct_in_tropical_sign'
  // Family 5: aspect
  | 'parashari_graha_drishti'
  | 'parashari_house_drishti'
  | 'sidereal_chart_aspect'
  | 'western_geometric_aspect'
  | 'western_declination_aspect'
  // Family 6: compatibility
  | 'panchadha_maitri_compound'
  // Family 7: configuration_participation
  | 'participates_in_configuration'
  // Family 8: modification
  | 'solar_combustion_modifies_planet'
  | 'retrogression_cheshta_modification'
  | 'vargottama_self_reinforcement'
  | 'gandanta_boundary_modification'
  | 'graha_yuddha_planetary_war'
  | 'dosha_modification_factor'
  // Family 9: cross_frame_relationship
  | 'chalit_house_shift_from_d1_rashi'
  | 'vargottama_d1_d9_sign_alignment'
  | 'cross_frame_d1_d9_placement_bridge'
  | 'vedic_d1_vs_western_tropical_zodiac_bridge'
  // Family 10: functional_relationship
  | 'registered_lagna_functional_role'
  | 'jaimini_chara_karaka_role'
  // Family 11: temporal_relationship (explicitly deferred to K09; zero edges in natal projection)
  | 'deferred_temporal_activation'
  // Family 12: evidence_lineage
  | 'derived_from_evidence';

// ============================================================================
// 5. Nodes, Edges & Verification Provenance
// ============================================================================

export interface NigEntityNode {
  entityId: string;
  entityType: NigEntityType;
  label: string;
  chartFrame: NigChartFrame | 'multi_frame_subject';
  subjectRef: string;
  metadata: Record<string, string | number | boolean | null>;
  sourceEvidenceIds: string[];
}

export interface NigEdgeVerificationStatus {
  computational: ComputationalVerificationStatus;
  methodological: MethodologicalVerificationStatus;
  propagatedTrust: PropagatedTrustLevel;
}

export interface NigEdgeProvenance {
  sourceModule: string;
  derivedFromObservationCodes: string[];
  frameIsolated: true;
  notes: string[];
}

export interface NigRelationshipEdge {
  relationshipId: string;
  sourceEntityId: string;
  targetEntityId: string;
  direction: NigRelationshipDirection;
  family: NigRelationshipFamily;
  relationshipType: NigTypedRelationshipName;
  chartFrame: NigChartFrame;
  methodology: NigEdgeMethodology;
  originalEvidenceIds: string[];
  ruleReferences: string[];
  qualificationStatus: NigEdgeQualificationStatus;
  verificationStatus: NigEdgeVerificationStatus;
  provenance: NigEdgeProvenance;
  attributes: Record<string, string | number | boolean | string[] | null>;
  deferredCapabilityNote?: string;
}

// ============================================================================
// 6. Configuration Participant Records (No Premature K05/K07 Adjudication)
// ============================================================================

export type ConfigurationParticipantRole =
  | 'required'
  | 'alternative'
  | 'supporting'
  | 'modifying';

export type ConfigurationKind =
  | 'parashari_yoga'
  | 'jaimini_yoga'
  | 'parivartana_exchange'
  | 'dosha'
  | 'western_aspect_configuration'
  | 'western_stellium';

export interface ConfigurationParticipantMember {
  entityId: string;
  entityType: NigEntityType;
  name: string;
  role: ConfigurationParticipantRole;
  sourceRoleLabel: string | null;
}

export interface ConfigurationParticipantRecord {
  configurationEntityId: string;
  configurationType: ConfigurationKind;
  name: string;
  chartFrame: NigChartFrame;
  methodology: NigEdgeMethodology;
  isPresent: boolean | null;
  isCancelled: boolean | null;
  requiredParticipants: ConfigurationParticipantMember[];
  alternativeParticipants: ConfigurationParticipantMember[];
  supportingParticipants: ConfigurationParticipantMember[];
  modifyingParticipants: ConfigurationParticipantMember[];
  sharedDependencies: string[];
  qualificationConditions: string[];
  originalEvidenceIds: string[];
  ruleReferences: string[];
  adjudicationStatus: 'participants_mapped_interaction_deferred_to_k05_k07';
  deferredInteractionNote: string;
}

// ============================================================================
// 7. 4 Logical Graph Projection Contracts & Serialized Graph Container
// ============================================================================

export interface NigNatalProjectionContract {
  projectionType: 'natal';
  status: 'implemented';
  entityIds: string[];
  edgeIds: string[];
  countsByFamily: Record<NigRelationshipFamily, number>;
  temporalEvidenceExcludedCount: number;
  blockedFramesOmitted: CanonicalEvidenceFrame[];
  note: string;
}

export interface NigFunctionalDomainProjectionContract {
  projectionType: 'functional_domain';
  status: 'partial_functional_roles_only';
  edgeIds: string[];
  registeredFunctionalRoleCount: number;
  domainScoringDeferredTo: 'K08';
  note: string;
}

export interface NigTemporalProjectionContract {
  projectionType: 'temporal';
  status: 'deferred_to_k09';
  edgeIds: [];
  excludedTemporalEvidenceCount: number;
  note: string;
}

export interface NigPrivateContextProjectionContract {
  projectionType: 'private_investigative_contextual';
  status: 'deferred_and_isolated';
  edgeIds: [];
  note: string;
}

export interface NigFrameProjectionSummary {
  chartFrame: NigChartFrame;
  edgeCount: number;
  edgeIds: string[];
  countsByFamily: Partial<Record<NigRelationshipFamily, number>>;
}

export interface NigBlockedFrameNotice {
  frame: CanonicalEvidenceFrame;
  reason: string;
  fallbackSuppressed: true;
}

export interface NigVerificationStats {
  totalNodes: number;
  totalEdges: number;
  duplicateIdCount: number;
  unresolvedEvidenceRefCount: number;
  danglingEndpointCount: number;
  countsByFamily: Record<NigRelationshipFamily, number>;
  countsByFrame: Record<string, number>;
  temporalRelationshipEdgeCount: number;
  privateContextEdgeCount: number;
}

export interface NatalIntelligenceGraph {
  schemaVersion: typeof K04_NIG_SCHEMA_VERSION;
  engineVersion: typeof K04_RELATIONAL_ENGINE_VERSION;
  generatedAtUtc: string;
  sourceInputFingerprint: string;
  chartIdHash: string;
  nodes: NigEntityNode[];
  edges: NigRelationshipEdge[];
  nodesById: Record<string, NigEntityNode>;
  edgesById: Record<string, NigRelationshipEdge>;
  outgoingEdgeIdsByEntity: Record<string, string[]>;
  incomingEdgeIdsByEntity: Record<string, string[]>;
  edgeIdsByFamily: Record<NigRelationshipFamily, string[]>;
  edgeIdsByFrame: Record<string, string[]>;
  projectionsByFrame: Record<string, NigFrameProjectionSummary>;
  configurationParticipants: ConfigurationParticipantRecord[];
  projections: {
    natal: NigNatalProjectionContract;
    functional_domain: NigFunctionalDomainProjectionContract;
    temporal: NigTemporalProjectionContract;
    private_investigative_contextual: NigPrivateContextProjectionContract;
  };
  blockedFrameNotices: NigBlockedFrameNotice[];
  verificationStats: NigVerificationStats;
}

export interface BuildNatalIntelligenceGraphOptions {
  /**
   * Optional K03 authority result used exclusively to surface registered
   * `registered_functional_role` links in `functional_relationship` /
   * `functional_domain` without mutating canonical K01/K02 state.
   */
  k03Result?: AnalyticalKernelK03AuthorityResult | null;
}

// ============================================================================
// 8. Deterministic SHA-256 Relationship ID Builder
// ============================================================================

function normNigSeg(raw: string | null | undefined): string {
  return String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

export interface DeterministicRelationshipKeyParts {
  chartIdHash: string;
  chartFrame: NigChartFrame;
  family: NigRelationshipFamily;
  relationshipType: NigTypedRelationshipName;
  sourceEntityId: string;
  targetEntityId: string;
  methodology: NigEdgeMethodology;
  qualifier?: string | null;
}

export function buildDeterministicRelationshipId(
  parts: DeterministicRelationshipKeyParts
): {
  naturalKey: string;
  relationshipId: string;
} {
  const segments = [
    normNigSeg(parts.chartIdHash),
    normNigSeg(parts.chartFrame),
    normNigSeg(parts.family),
    normNigSeg(parts.relationshipType),
    normNigSeg(parts.sourceEntityId),
    normNigSeg(parts.targetEntityId),
    normNigSeg(parts.methodology),
  ];
  if (parts.qualifier && parts.qualifier.trim()) {
    segments.push(normNigSeg(parts.qualifier));
  }
  const naturalKey = segments.join('|');
  return {
    naturalKey,
    relationshipId: `rel_${sha256Hex(naturalKey).slice(0, 32)}`,
  };
}
