/**
 * CosmicCouncil Proprietary Analytical Intelligence Kernel — K04 P08 Influence Footprint Enrichment
 *
 * Pure TypeScript / Web-standard implementation (zero Node built-ins; Cloudflare Workers safe).
 * Zero LLM calls, zero live API calls, zero DB writes, zero arbitrary numerical weights,
 * zero recursive PHI propagation, and zero mutation of K02 `K02SubjectStateRecord`.
 *
 * Enriches K02 P08 `influenceFootprint` with typed, navigable relational records separated cleanly into:
 *  - `directOccupancy`
 *  - `governance`
 *  - `directAssociation`
 *  - `aspects`
 *  - `dispositorDependencies`
 *  - `configurationParticipation`
 *  - `crossDivisionalRelationships`
 *  - `qualifiedIndirectRelationships`
 *
 * Enforces strict separation between:
 *  1. Structural graph reachability (`epistemicStatus: 'structural_graph_reachability_only'`)
 *  2. Established natal relational links
 *  3. Functional life-domain deliverability (`functionalDeliverabilityDeferredTo: 'K08'`)
 */

import {
  PLANETARY_STATE_SUBJECTS,
  type AnalyticalKernelK02StateResult,
  type PlanetaryStateSubjectName,
} from './types';
import {
  K04_RELATIONAL_ENGINE_VERSION,
  type ConfigurationParticipantRecord,
  type NatalIntelligenceGraph,
  type NigChartFrame,
  type NigEdgeMethodology,
  type NigEdgeQualificationStatus,
  type NigRelationshipEdge,
  type NigRelationshipFamily,
  type NigTypedRelationshipName,
} from './k04Types';
import {
  STRUCTURAL_REACHABILITY_EPISTEMIC_TAG,
  countUniqueReachableEntities,
  getDirectRelationships,
  getOutgoingRelationships,
  type NigEpistemicReachabilityTag,
  type NigTraversalBounds,
} from './graphTraversal';
import type {
  K04DispositorDependencyAnalysisResult,
  K04SubjectDependencyProfile,
} from './dispositorDependencyEngine';

export const K04_P08_ENRICHMENT_VERSION = 'k04.p08.1.0' as const;

export interface P08NavigableRelationshipLink {
  relationshipId: string;
  directionRole: 'outgoing' | 'incoming';
  sourceEntityId: string;
  targetEntityId: string;
  counterpartyEntityId: string;
  counterpartyLabel: string;
  family: NigRelationshipFamily;
  relationshipType: NigTypedRelationshipName;
  chartFrame: NigChartFrame;
  methodology: NigEdgeMethodology;
  qualificationStatus: NigEdgeQualificationStatus;
  originalEvidenceIds: string[];
  ruleReferences: string[];
  attributes: Record<string, string | number | boolean | string[] | null>;
}

export interface P08IndirectReachabilityRecord {
  reachabilityId: string;
  kind:
    | 'indirect_dispositor_chain'
    | 'governed_house_occupant_reachability'
    | 'shared_dependency_peer';
  targetEntityId: string;
  targetLabel: string;
  chartFrame: NigChartFrame;
  hopDistance: number;
  viaEntityIds: string[];
  supportingEdgeIds: string[];
  bounds: NigTraversalBounds;
  epistemicTag: Readonly<NigEpistemicReachabilityTag>;
}

export interface P08ConfigurationParticipationSummary {
  configurationEntityId: string;
  configurationType: ConfigurationParticipantRecord['configurationType'];
  name: string;
  chartFrame: NigChartFrame;
  methodology: NigEdgeMethodology;
  participantRole: string;
  isPresent: boolean | null;
  isCancelled: boolean | null;
  adjudicationStatus: ConfigurationParticipantRecord['adjudicationStatus'];
  deferredInteractionNote: string;
  relationshipId: string;
  originalEvidenceIds: string[];
}

export interface P08SubjectInfluenceFootprintEnrichment {
  subject: PlanetaryStateSubjectName;
  entityId: string;
  dimension: 'influenceFootprint';
  k02BaselineFootprintStatus: string;
  directOccupancy: P08NavigableRelationshipLink[];
  governance: P08NavigableRelationshipLink[];
  directAssociation: P08NavigableRelationshipLink[];
  aspects: P08NavigableRelationshipLink[];
  dispositorDependencies: {
    edges: P08NavigableRelationshipLink[];
    profilesByFrame: Record<string, K04SubjectDependencyProfile>;
  };
  configurationParticipation: P08ConfigurationParticipationSummary[];
  crossDivisionalRelationships: P08NavigableRelationshipLink[];
  qualifiedIndirectRelationships: {
    records: P08IndirectReachabilityRecord[];
    uniqueReachableEntityCountD1: number;
    d1ReachabilityBounds: NigTraversalBounds;
    epistemicTag: Readonly<NigEpistemicReachabilityTag>;
  };
  supplementaryDirectModifiersAndCompatibility: P08NavigableRelationshipLink[];
  counts: {
    directOccupancy: number;
    governance: number;
    directAssociation: number;
    aspects: number;
    dispositorDependencies: number;
    configurationParticipation: number;
    crossDivisionalRelationships: number;
    qualifiedIndirectRelationships: number;
  };
  epistemicSeparation: {
    structuralReachabilityStatus: 'structural_graph_reachability_only';
    establishedInfluenceStatus: 'typed_natal_edges_only_no_arbitrary_weights';
    functionalDeliverabilityStatus: 'deferred_to_k08';
    configurationInteractionStatus: 'deferred_to_k05_k07';
    temporalActivationStatus: 'deferred_to_k09';
    note: string;
  };
}

export interface K04InfluenceFootprintEnrichmentResult {
  enrichmentVersion: typeof K04_P08_ENRICHMENT_VERSION;
  k04EngineVersion: typeof K04_RELATIONAL_ENGINE_VERSION;
  sourceInputFingerprint: string;
  chartIdHash: string;
  subjectFootprints: Record<PlanetaryStateSubjectName, P08SubjectInfluenceFootprintEnrichment>;
  epistemicBoundaries: {
    structuralReachabilityVsActiveInfluence: string;
    activeInfluenceVsFunctionalDeliverability: string;
    configurationInteractionDeferredTo: readonly ['K05', 'K07'];
    temporalActivationDeferredTo: 'K09';
    mutatedK02State: false;
  };
}

function subjectEntityId(subject: PlanetaryStateSubjectName): string {
  return subject === 'Ascendant' ? 'ascendant:Ascendant' : `planet:${subject}`;
}

function toNavigableLink(
  graph: NatalIntelligenceGraph,
  edge: NigRelationshipEdge,
  subjectId: string
): P08NavigableRelationshipLink {
  const directionRole: 'outgoing' | 'incoming' =
    edge.sourceEntityId === subjectId ? 'outgoing' : 'incoming';
  const counterpartyEntityId =
    directionRole === 'outgoing' ? edge.targetEntityId : edge.sourceEntityId;
  const counterpartyLabel = graph.nodesById[counterpartyEntityId]?.label ?? counterpartyEntityId;

  return {
    relationshipId: edge.relationshipId,
    directionRole,
    sourceEntityId: edge.sourceEntityId,
    targetEntityId: edge.targetEntityId,
    counterpartyEntityId,
    counterpartyLabel,
    family: edge.family,
    relationshipType: edge.relationshipType,
    chartFrame: edge.chartFrame,
    methodology: edge.methodology,
    qualificationStatus: edge.qualificationStatus,
    originalEvidenceIds: [...edge.originalEvidenceIds],
    ruleReferences: [...edge.ruleReferences],
    attributes: { ...edge.attributes },
  };
}

function isDivisionalSubFrame(frame: NigChartFrame): boolean {
  return frame.startsWith('vedic_lahiri:');
}

export function buildK04InfluenceFootprintEnrichment(
  nig: NatalIntelligenceGraph,
  k02State: AnalyticalKernelK02StateResult,
  dispositorAnalysis: K04DispositorDependencyAnalysisResult
): K04InfluenceFootprintEnrichmentResult {
  const cfgById = new Map<string, ConfigurationParticipantRecord>(
    nig.configurationParticipants.map((c) => [c.configurationEntityId, c])
  );

  const subjectFootprints = {} as Record<
    PlanetaryStateSubjectName,
    P08SubjectInfluenceFootprintEnrichment
  >;

  for (const subject of PLANETARY_STATE_SUBJECTS) {
    const entityId = subjectEntityId(subject);
    const k02Baseline = k02State.subjectStates[subject]?.dimensions.influenceFootprint;
    const directRes = getDirectRelationships(nig, entityId, { excludeBlocked: true });

    const directOccupancy: P08NavigableRelationshipLink[] = [];
    const governance: P08NavigableRelationshipLink[] = [];
    const directAssociation: P08NavigableRelationshipLink[] = [];
    const aspects: P08NavigableRelationshipLink[] = [];
    const dispositorDepEdges: P08NavigableRelationshipLink[] = [];
    const configurationParticipation: P08ConfigurationParticipationSummary[] = [];
    const crossDivisionalRelationships: P08NavigableRelationshipLink[] = [];
    const supplementaryDirectModifiersAndCompatibility: P08NavigableRelationshipLink[] = [];

    for (const edge of directRes.all) {
      const link = toNavigableLink(nig, edge, entityId);

      // Cross-frame bridges & divisional subframes route cleanly into crossDivisionalRelationships
      if (edge.family === 'cross_frame_relationship') {
        crossDivisionalRelationships.push(link);
        continue;
      }

      if (isDivisionalSubFrame(edge.chartFrame)) {
        crossDivisionalRelationships.push(link);
        if (edge.family === 'dependency') {
          dispositorDepEdges.push(link);
        }
        continue;
      }

      switch (edge.family) {
        case 'occupancy':
          if (link.directionRole === 'outgoing') {
            directOccupancy.push(link);
          }
          break;
        case 'governance':
          if (link.directionRole === 'outgoing') {
            governance.push(link);
          }
          break;
        case 'association':
          directAssociation.push(link);
          break;
        case 'aspect':
          aspects.push(link);
          break;
        case 'dependency':
          dispositorDepEdges.push(link);
          break;
        case 'configuration_participation': {
          const cfg = cfgById.get(edge.targetEntityId);
          configurationParticipation.push({
            configurationEntityId: edge.targetEntityId,
            configurationType:
              cfg?.configurationType ??
              ((edge.attributes.configurationType as ConfigurationParticipantRecord['configurationType']) ??
                'parashari_yoga'),
            name: cfg?.name ?? link.counterpartyLabel,
            chartFrame: edge.chartFrame,
            methodology: edge.methodology,
            participantRole: String(edge.attributes.sourceRoleLabel ?? edge.attributes.participantRole ?? 'required'),
            isPresent: cfg?.isPresent ?? null,
            isCancelled: cfg?.isCancelled ?? null,
            adjudicationStatus:
              cfg?.adjudicationStatus ?? 'participants_mapped_interaction_deferred_to_k05_k07',
            deferredInteractionNote:
              cfg?.deferredInteractionNote ??
              'Configuration participation mapped; interaction & cancellation deferred to K05/K07.',
            relationshipId: edge.relationshipId,
            originalEvidenceIds: [...edge.originalEvidenceIds],
          });
          break;
        }
        case 'compatibility':
        case 'modification':
        case 'functional_relationship':
          supplementaryDirectModifiersAndCompatibility.push(link);
          break;
        default:
          break;
      }
    }

    // Collect subject dependency profiles across all analyzed frames
    const profilesByFrame: Record<string, K04SubjectDependencyProfile> = {};
    for (const frameKey of dispositorAnalysis.analyzedFrames) {
      const frameAnalysis = dispositorAnalysis.frames[frameKey];
      const prof = frameAnalysis?.subjectProfiles?.[subject];
      if (prof) {
        profilesByFrame[frameKey] = prof;
      }
    }

    // Compute qualified indirect structural reachability (strictly bounded, never conflated with active influence)
    const indirectRecords: P08IndirectReachabilityRecord[] = [];
    const seenIndirectKeys = new Set<string>();

    // 1. Dispositor chain hops >= 2 in D1 vedic_lahiri
    const d1Prof = profilesByFrame.vedic_lahiri;
    if (d1Prof) {
      const chainNodes = d1Prof.properties.depth.chainPathEntityIds;
      for (let i = 2; i < chainNodes.length; i++) {
        const tgtId = chainNodes[i];
        if (tgtId === entityId) continue;
        const key = `indirect_dispositor_chain:${tgtId}`;
        if (seenIndirectKeys.has(key)) continue;
        seenIndirectKeys.add(key);
        indirectRecords.push({
          reachabilityId: `reach_${subject}_disp_${i}_${tgtId}`,
          kind: 'indirect_dispositor_chain',
          targetEntityId: tgtId,
          targetLabel: nig.nodesById[tgtId]?.label ?? tgtId,
          chartFrame: 'vedic_lahiri',
          hopDistance: i,
          viaEntityIds: chainNodes.slice(1, i),
          supportingEdgeIds: [...d1Prof.dependencyEdgeIds],
          bounds: {
            maxDepth: 16,
            maxSteps: 64,
            stepsExecuted: i,
            visitedCount: chainNodes.length,
            visitedLimitReached: false,
            truncatedByDepth: false,
          },
          epistemicTag: STRUCTURAL_REACHABILITY_EPISTEMIC_TAG,
        });
      }

      // 2. Shared dependency terminal basin / direct dispositor peers
      for (const peerId of d1Prof.properties.redundancy.sharedDirectDispositorPeers) {
        const key = `shared_dependency_peer:${peerId}`;
        if (seenIndirectKeys.has(key)) continue;
        seenIndirectKeys.add(key);
        indirectRecords.push({
          reachabilityId: `reach_${subject}_peer_${peerId}`,
          kind: 'shared_dependency_peer',
          targetEntityId: peerId,
          targetLabel: nig.nodesById[peerId]?.label ?? peerId,
          chartFrame: 'vedic_lahiri',
          hopDistance: 2,
          viaEntityIds: d1Prof.directDispositorEntityId ? [d1Prof.directDispositorEntityId] : [],
          supportingEdgeIds: [...d1Prof.dependencyEdgeIds],
          bounds: {
            maxDepth: 2,
            maxSteps: 32,
            stepsExecuted: 2,
            visitedCount: 2,
            visitedLimitReached: false,
            truncatedByDepth: false,
          },
          epistemicTag: STRUCTURAL_REACHABILITY_EPISTEMIC_TAG,
        });
      }
    }

    // 3. Governed D1 house -> occupants occupying that governed house (2-hop structural reachability)
    for (const govLink of governance) {
      if (
        govLink.chartFrame !== 'vedic_lahiri' ||
        govLink.relationshipType !== 'lords_whole_sign_house_bhavesha'
      ) {
        continue;
      }
      const houseId = govLink.targetEntityId;
      const houseIncoming = getDirectRelationships(nig, houseId, {
        chartFrame: 'vedic_lahiri',
        families: ['occupancy'],
        relationshipTypes: ['occupies_whole_sign_house'],
        excludeBlocked: true,
      }).incoming;

      for (const occEdge of houseIncoming) {
        if (occEdge.sourceEntityId === entityId) continue;
        const key = `governed_house_occupant:${houseId}:${occEdge.sourceEntityId}`;
        if (seenIndirectKeys.has(key)) continue;
        seenIndirectKeys.add(key);
        indirectRecords.push({
          reachabilityId: `reach_${subject}_${houseId}_${occEdge.sourceEntityId}`,
          kind: 'governed_house_occupant_reachability',
          targetEntityId: occEdge.sourceEntityId,
          targetLabel: nig.nodesById[occEdge.sourceEntityId]?.label ?? occEdge.sourceEntityId,
          chartFrame: 'vedic_lahiri',
          hopDistance: 2,
          viaEntityIds: [houseId],
          supportingEdgeIds: [govLink.relationshipId, occEdge.relationshipId],
          bounds: {
            maxDepth: 2,
            maxSteps: 32,
            stepsExecuted: 2,
            visitedCount: 3,
            visitedLimitReached: false,
            truncatedByDepth: false,
          },
          epistemicTag: STRUCTURAL_REACHABILITY_EPISTEMIC_TAG,
        });
      }
    }

    // Also include bounded unique reachable entities count within vedic_lahiri (depth <= 2)
    const d1ReachSummary = countUniqueReachableEntities(nig, entityId, {
      chartFrame: 'vedic_lahiri',
      families: ['occupancy', 'governance', 'dependency', 'association', 'aspect'],
      maxDepth: 2,
      maxSteps: 128,
      excludeBlocked: true,
    });

    // Ensure supplementary outgoing relationships if needed remain deterministic
    void getOutgoingRelationships;

    subjectFootprints[subject] = {
      subject,
      entityId,
      dimension: 'influenceFootprint',
      k02BaselineFootprintStatus: k02Baseline?.status ?? 'unavailable',
      directOccupancy,
      governance,
      directAssociation,
      aspects,
      dispositorDependencies: {
        edges: dispositorDepEdges,
        profilesByFrame,
      },
      configurationParticipation: configurationParticipation.sort((a, b) =>
        a.configurationEntityId.localeCompare(b.configurationEntityId)
      ),
      crossDivisionalRelationships,
      qualifiedIndirectRelationships: {
        records: indirectRecords.sort((a, b) =>
          a.reachabilityId.localeCompare(b.reachabilityId)
        ),
        uniqueReachableEntityCountD1: d1ReachSummary.uniqueCount,
        d1ReachabilityBounds: d1ReachSummary.bounds,
        epistemicTag: STRUCTURAL_REACHABILITY_EPISTEMIC_TAG,
      },
      supplementaryDirectModifiersAndCompatibility,
      counts: {
        directOccupancy: directOccupancy.length,
        governance: governance.length,
        directAssociation: directAssociation.length,
        aspects: aspects.length,
        dispositorDependencies: dispositorDepEdges.length,
        configurationParticipation: configurationParticipation.length,
        crossDivisionalRelationships: crossDivisionalRelationships.length,
        qualifiedIndirectRelationships: indirectRecords.length,
      },
      epistemicSeparation: {
        structuralReachabilityStatus: 'structural_graph_reachability_only',
        establishedInfluenceStatus: 'typed_natal_edges_only_no_arbitrary_weights',
        functionalDeliverabilityStatus: 'deferred_to_k08',
        configurationInteractionStatus: 'deferred_to_k05_k07',
        temporalActivationStatus: 'deferred_to_k09',
        note: 'Separates direct relational facts from multi-hop structural reachability; domain deliverability and composite influence scoring remain deferred to K08.',
      },
    };
  }

  return {
    enrichmentVersion: K04_P08_ENRICHMENT_VERSION,
    k04EngineVersion: K04_RELATIONAL_ENGINE_VERSION,
    sourceInputFingerprint: nig.sourceInputFingerprint,
    chartIdHash: nig.chartIdHash,
    subjectFootprints,
    epistemicBoundaries: {
      structuralReachabilityVsActiveInfluence:
        'Structural graph reachability (`qualifiedIndirectRelationships`) never implies active astrological influence.',
      activeInfluenceVsFunctionalDeliverability:
        'Direct relational connections never imply life-domain deliverability; domain outcomes and timing remain deferred to K08 and K09.',
      configurationInteractionDeferredTo: ['K05', 'K07'],
      temporalActivationDeferredTo: 'K09',
      mutatedK02State: false,
    },
  };
}
