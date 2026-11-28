/**
 * CosmicCouncil Proprietary Analytical Intelligence Kernel — K04 Dispositor & Dependency Intelligence Engine
 *
 * Pure TypeScript / Web-standard implementation (zero Node built-ins; Cloudflare Workers safe).
 * Zero LLM calls, zero live API calls, zero DB writes, zero arbitrary weights, zero recursive PHI propagation.
 *
 * Implements:
 *  - Isolated per-frame sign-dispositor graph analysis (`vedic_lahiri`, `vedic_lahiri:D9`,
 *    `vedic_lahiri:<DIV>`, `western_tropical`) via deterministic Tarjan SCC + condensation DAG (R07).
 *  - Detection of direct dispositors, self-disposited planets (1-node self-loop), mutual dispositorship
 *    (2-node cycle), multi-planet closed cycles (SCC size >= 2), terminal sink SCCs, upstream dependents,
 *    terminal basins, multiple basins, and incomplete/missing dependencies (never assumes 1 final dispositor).
 *  - All 6 Dependency Properties per subject (`depth`, `breadth`, `quality`, `concentration`, `redundancy`, `criticality`).
 *  - Dependency Concentration Index (`DCI`) via R07 `dependency_concentration_dci` with strict non-renormalization
 *    and complete transparency metadata.
 */

import {
  PLANETARY_STATE_SUBJECTS,
  type AnalyticalKernelK02StateResult,
  type CanonicalEvidenceFrame,
  type K02ConfidenceCeiling,
  type K02SubjectStateRecord,
  type PlanetaryStateSubjectName,
  type PropagatedTrustLevel,
} from './types';
import {
  K04_RELATIONAL_ENGINE_VERSION,
  type NatalIntelligenceGraph,
  type NigChartFrame,
  type NigRelationshipEdge,
  type NigTypedRelationshipName,
} from './k04Types';
import type {
  K03RelationalContextInput,
  K03RelationalDispositorSubjectFact,
} from './k03Types';
import {
  evaluateRuleMathModel,
  type R07SccNodeGroup,
  type R07TerminalBasinSummary,
} from './ruleRegistry';
import {
  STRUCTURAL_REACHABILITY_EPISTEMIC_TAG,
  detectSharedDependencies,
  findAlternativeStructuralPaths,
  getDependencyChain,
  getOutgoingRelationships,
  type NigEpistemicReachabilityTag,
} from './graphTraversal';

export const K04_DISPOSITOR_ENGINE_VERSION = 'k04.dispositor.1.0' as const;
export const K04_DCI_CALCULATION_VERSION = 'k04.dci.1.0' as const;

const STANDARD_GRAHA_SUBJECTS: readonly Exclude<PlanetaryStateSubjectName, 'Ascendant'>[] = [
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
  'Rahu',
  'Ketu',
];

const STANDARD_GRAHA_ENTITY_IDS: readonly string[] = STANDARD_GRAHA_SUBJECTS.map(
  (s) => `planet:${s}`
);

// ============================================================================
// 1. 6 Dependency Property Contracts & DCI Metadata Contracts
// ============================================================================

export interface K04DependencyDepthProperty {
  hopsToTerminalBasin: number | null;
  maxUniqueChainEntities: number;
  chainPathEntityIds: string[];
  isSelfDisposited: boolean;
  isInCycle: boolean;
  isTerminalSinkMember: boolean;
  terminalKind: 'self_disposited' | 'cycle' | 'unresolved' | null;
}

export interface K04DependencyBreadthProperty {
  directDependentsCount: number;
  directDependentEntityIds: string[];
  totalUpstreamDependentCount: number;
  totalUpstreamDependentEntityIds: string[];
  includesAscendantDependency: boolean;
  governedHouseCount: number;
  governedHouseIds: string[];
}

export interface K04DispositorQualityObservation {
  dispositorSubject: PlanetaryStateSubjectName | string;
  dispositorEntityId: string;
  trustCeiling: PropagatedTrustLevel | 'unavailable';
  confidenceCeiling: K02ConfidenceCeiling | 'unavailable';
  dignityClass: string | null;
  capacityStatus: string | null;
  conditionFlags: string[];
  conflictCount: number;
  sourceEvidenceIds: string[];
}

export interface K04DependencyQualityProperty {
  directDispositorObservation: K04DispositorQualityObservation | null;
  terminalSinkObservations: K04DispositorQualityObservation[];
  qualitativeSummary:
    | 'dispositor_usable'
    | 'dispositor_usable_with_conditions'
    | 'dispositor_provisional_capped'
    | 'dispositor_blocked'
    | 'unresolved_dispositor';
  strictlyNoScalarPropagation: true;
  note: string;
}

export interface K04DependencyConcentrationProperty {
  terminalBasinId: string | null;
  terminalBasinKind: 'self_disposited' | 'cycle' | null;
  terminalBasinSize: number;
  basinAssignedEntityCount: number;
  basinProportionOfExpectedPopulation: number | null;
  frameDci: number | null;
  frameDciIsComplete: boolean;
  feedsIntoSharedTerminalBasin: boolean;
}

export interface K04DependencyRedundancyProperty {
  parivartanaPartnerEntityIds: string[];
  inParivartana: boolean;
  nakshatraLordEntityId: string | null;
  hasDistinctNakshatraChannel: boolean;
  sharedDirectDispositorPeers: string[];
  sharedTerminalBasinPeers: string[];
  alternativePathCountToTerminal: number;
  redundancyClassification:
    | 'mutual_exchange_loop'
    | 'cyclic_interdependence'
    | 'multi_channel_with_nakshatra'
    | 'single_channel_chain'
    | 'unresolved';
}

export interface K04DependencyCriticalityProperty {
  synthesisStatus: 'partial';
  deferralStatus: 'deferred_pending_k05_k06_k08';
  deferredTo: readonly ['K05', 'K06', 'K08'];
  isTerminalSinkMember: boolean;
  isCycleBottleneck: boolean;
  isUpstreamRelay: boolean;
  isLagneshInFrame: boolean;
  downstreamFeedCount: number;
  structuralNotes: string[];
  note: string;
}

export interface K04SubjectDependencyProperties {
  depth: K04DependencyDepthProperty;
  breadth: K04DependencyBreadthProperty;
  quality: K04DependencyQualityProperty;
  concentration: K04DependencyConcentrationProperty;
  redundancy: K04DependencyRedundancyProperty;
  criticality: K04DependencyCriticalityProperty;
}

export interface K04SubjectDependencyProfile {
  subject: PlanetaryStateSubjectName;
  entityId: string;
  chartFrame: NigChartFrame;
  directDispositorSubject: PlanetaryStateSubjectName | null;
  directDispositorEntityId: string | null;
  dependencyEdgeIds: string[];
  sourceEvidenceIds: string[];
  sccId: string | null;
  sccMembers: string[];
  properties: K04SubjectDependencyProperties;
  epistemicTag: Readonly<NigEpistemicReachabilityTag>;
}

export interface K04DciBasinProportion {
  basinId: string;
  terminalKind: 'self_disposited' | 'cycle';
  sinkMembers: string[];
  assignedEntityIds: string[];
  assignedCount: number;
  proportionOfExpectedPopulation: number;
}

export interface K04DciSummary {
  dci: number | null;
  isComplete: boolean;
  renormalized: false;
  expectedPopulationCount: number;
  assignedPopulationCount: number;
  missingPopulationCount: number;
  includedEntityPopulation: string[];
  excludedOrMissingEntities: Array<{ entityId: string; reason: string }>;
  basinAssignmentMethodology: string;
  cycleTreatment: string;
  selfDispositorTreatment: string;
  missingRelationshipHandling: string;
  calculationVersion: typeof K04_DCI_CALCULATION_VERSION;
  interpretationLimitations: 'Measures dependency concentration only; does not imply favorability, vulnerability, or predictive outcome';
  basinProportions: K04DciBasinProportion[];
}

export interface K04MutualDispositorPair {
  entityA: string;
  entityB: string;
  sccId: string;
  isTerminalSink: boolean;
}

export interface K04ClosedMultiPlanetCycle {
  sccId: string;
  members: string[];
  size: number;
  sccType: R07SccNodeGroup['sccType'];
  isTerminalSink: boolean;
}

export interface K04FrameDispositorAnalysis {
  chartFrame: NigChartFrame;
  dispositorRelationshipType: NigTypedRelationshipName;
  directDispositorByEntity: Record<string, string | null>;
  selfDispositedEntities: string[];
  mutualDispositorPairs: K04MutualDispositorPair[];
  closedMultiPlanetCycles: K04ClosedMultiPlanetCycle[];
  sccs: R07SccNodeGroup[];
  terminalSinkSccs: R07SccNodeGroup[];
  terminalBasins: R07TerminalBasinSummary[];
  upstreamDependentEntities: string[];
  unassignedOrMissingEntities: string[];
  hasSingleFinalDispositor: boolean;
  singleFinalDispositorEntityId: string | null;
  multipleTerminalBasinsDetected: boolean;
  dci: K04DciSummary;
  subjectProfiles: Partial<Record<PlanetaryStateSubjectName, K04SubjectDependencyProfile>>;
}

export interface K04DispositorDependencyAnalysisResult {
  engineVersion: typeof K04_DISPOSITOR_ENGINE_VERSION;
  k04EngineVersion: typeof K04_RELATIONAL_ENGINE_VERSION;
  sourceInputFingerprint: string;
  chartIdHash: string;
  analyzedFrames: NigChartFrame[];
  frames: Record<string, K04FrameDispositorAnalysis>;
  primaryD1Frame: K04FrameDispositorAnalysis | null;
}

export interface AnalyzeK04DispositorOptions {
  /**
   * Optional explicit list of frames to evaluate; defaults to all isolated frames
   * present in `nig.edgeIdsByFrame` that carry sign-dispositor dependency edges.
   */
  targetFrames?: readonly NigChartFrame[];
}

// ============================================================================
// 2. Helpers: Entity Mapping, K02 Quality Inspection & Frame Discovery
// ============================================================================

function subjectFromEntityId(entityId: string): PlanetaryStateSubjectName | null {
  if (entityId === 'ascendant:Ascendant') return 'Ascendant';
  if (entityId.startsWith('planet:')) {
    const raw = entityId.slice('planet:'.length);
    if ((PLANETARY_STATE_SUBJECTS as readonly string[]).includes(raw)) {
      return raw as PlanetaryStateSubjectName;
    }
  }
  return null;
}

function dispositorEdgeTypeForFrame(frame: NigChartFrame): NigTypedRelationshipName {
  if (frame === 'vedic_lahiri') return 'disposited_by_sign_lord';
  if (frame === 'western_tropical') return 'western_traditional_sign_dispositor';
  if (frame.startsWith('vedic_lahiri:')) return 'divisional_sign_dispositor';
  return 'disposited_by_sign_lord';
}

function discoverAnalyzableFrames(nig: NatalIntelligenceGraph): NigChartFrame[] {
  const candidates = new Set<NigChartFrame>();
  for (const [frameKey, edgeIds] of Object.entries(nig.edgeIdsByFrame)) {
    if (!edgeIds || edgeIds.length === 0) continue;
    if (frameKey === 'vedic_lahiri' || frameKey === 'western_tropical') {
      candidates.add(frameKey as NigChartFrame);
      continue;
    }
    if (frameKey.startsWith('vedic_lahiri:')) {
      // Only include divisional frames that have divisional_sign_dispositor or placement edges
      const hasDivDisp = edgeIds.some((id) => {
        const edge = nig.edgesById[id];
        return edge?.relationshipType === 'divisional_sign_dispositor';
      });
      if (hasDivDisp) {
        candidates.add(frameKey as NigChartFrame);
      }
    }
  }

  // Deterministic ordering: vedic_lahiri -> vedic_lahiri:D9 -> vedic_lahiri:<DIV> -> western_tropical
  return Array.from(candidates).sort((a, b) => {
    const rank = (f: string) => {
      if (f === 'vedic_lahiri') return '0000';
      if (f === 'vedic_lahiri:D9') return '0001';
      if (f.startsWith('vedic_lahiri:')) return `0002_${f}`;
      if (f === 'western_tropical') return '0003';
      return `0009_${f}`;
    };
    return rank(a).localeCompare(rank(b));
  });
}

function extractK02QualityObservation(
  dispositorEntityId: string,
  k02State: AnalyticalKernelK02StateResult | null | undefined
): K04DispositorQualityObservation {
  const subject = subjectFromEntityId(dispositorEntityId);
  const rec: K02SubjectStateRecord | undefined = subject
    ? k02State?.subjectStates?.[subject]
    : undefined;

  if (!rec) {
    return {
      dispositorSubject: subject ?? dispositorEntityId,
      dispositorEntityId,
      trustCeiling: 'unavailable',
      confidenceCeiling: 'unavailable',
      dignityClass: null,
      capacityStatus: null,
      conditionFlags: [],
      conflictCount: 0,
      sourceEvidenceIds: [],
    };
  }

  const digSignal = rec.dimensions.integrity?.signals?.[0];
  const digObs = rec.dimensions.integrity?.directObservations?.find((o) => o.key === 'dignity');
  const dignityClass =
    (typeof digSignal?.qualitativeClass === 'string' && digSignal.qualitativeClass) ||
    (typeof digObs?.value === 'string' && digObs.value) ||
    null;

  const conditionFlags = new Set<string>();
  for (const mod of rec.overlays.modification?.modifiers ?? []) {
    conditionFlags.add(`${mod.modifierType}:${mod.status}`);
  }
  for (const sig of [
    ...(rec.dimensions.stability?.signals ?? []),
    ...(rec.dimensions.vulnerability?.signals ?? []),
  ]) {
    if (
      sig.qualitativeClass &&
      sig.qualitativeClass !== 'inactive' &&
      sig.qualitativeClass !== 'not_combust' &&
      sig.qualitativeClass !== 'clear_of_boundary'
    ) {
      conditionFlags.add(sig.qualitativeClass);
    }
  }

  const evidenceSet = new Set<string>([
    ...(rec.dimensions.integrity?.supportedEvidenceIds ?? []),
    ...(rec.dimensions.stability?.supportedEvidenceIds ?? []),
    ...(rec.dimensions.vulnerability?.supportedEvidenceIds ?? []),
    ...(rec.dimensions.capacity?.supportedEvidenceIds ?? []),
  ]);

  return {
    dispositorSubject: subject ?? dispositorEntityId,
    dispositorEntityId,
    trustCeiling: rec.overlays.reliability?.overallTrust ?? 'unavailable',
    confidenceCeiling: rec.overlays.reliability?.confidenceCeiling ?? 'unavailable',
    dignityClass,
    capacityStatus: rec.dimensions.capacity?.status ?? null,
    conditionFlags: Array.from(conditionFlags).sort((a, b) => a.localeCompare(b)),
    conflictCount: rec.overlays.conflict?.conflictCount ?? 0,
    sourceEvidenceIds: Array.from(evidenceSet).sort((a, b) => a.localeCompare(b)),
  };
}

// ============================================================================
// 3. Per-Frame Dispositor SCC, Terminal Basin & DCI Evaluation
// ============================================================================

function analyzeIsolatedFrameDispositors(
  nig: NatalIntelligenceGraph,
  k02State: AnalyticalKernelK02StateResult | null | undefined,
  chartFrame: NigChartFrame
): K04FrameDispositorAnalysis {
  const relType = dispositorEdgeTypeForFrame(chartFrame);
  const frameEdgeIds = nig.edgeIdsByFrame[chartFrame] ?? [];

  const frameEdges: NigRelationshipEdge[] = [];
  for (const id of frameEdgeIds) {
    const e = nig.edgesById[id];
    if (e && e.qualificationStatus !== 'blocked') {
      frameEdges.push(e);
    }
  }

  const dispEdges = frameEdges.filter(
    (e) => e.family === 'dependency' && e.relationshipType === relType
  );

  // Determine expected planetary population for this frame
  const excludedOrMissingEntities: Array<{ entityId: string; reason: string }> = [];
  let includedEntityPopulation: string[] = [];

  if (chartFrame === 'western_tropical') {
    const tropicalPlanetOcc = frameEdges.filter(
      (e) =>
        e.family === 'occupancy' &&
        (e.relationshipType === 'occupies_tropical_sign' ||
          e.relationshipType === 'occupies_placidus_house') &&
        e.sourceEntityId.startsWith('planet:')
    );
    const presentPlanetIds = new Set<string>([
      ...tropicalPlanetOcc.map((e) => e.sourceEntityId),
      ...dispEdges.map((e) => e.sourceEntityId),
    ]);
    const sortedPresent = Array.from(presentPlanetIds).sort((a, b) => a.localeCompare(b));
    const traditionalEligible: string[] = [];
    for (const eid of sortedPresent) {
      if (STANDARD_GRAHA_ENTITY_IDS.includes(eid)) {
        traditionalEligible.push(eid);
      } else {
        excludedOrMissingEntities.push({
          entityId: eid,
          reason:
            'Excluded from traditional Ptolemaic sign-dispositor DCI pool (outer/modern body without classical 7-ruler assignment).',
        });
      }
    }
    includedEntityPopulation = traditionalEligible;
  } else {
    // Vedic D1 or Vedic Divisional Frame: expected pool is the 9 Vedic grahas (Sun..Ketu)
    includedEntityPopulation = [...STANDARD_GRAHA_ENTITY_IDS];
  }

  const includedSet = new Set(includedEntityPopulation);

  // Build sorted directed adjacency over included planetary entities ONLY
  // (Ascendant is analyzed separately via Lagnesh without distorting the planetary DCI count)
  const adjacency: Record<string, string[]> = {};
  const directDispositorByEntity: Record<string, string | null> = {};
  const dispEdgeBySource = new Map<string, NigRelationshipEdge>();

  for (const eid of includedEntityPopulation) {
    adjacency[eid] = [];
    directDispositorByEntity[eid] = null;
  }

  for (const edge of dispEdges) {
    if (!includedSet.has(edge.sourceEntityId)) continue;
    // Keep deterministic first edge if multiple somehow exist
    if (!dispEdgeBySource.has(edge.sourceEntityId)) {
      dispEdgeBySource.set(edge.sourceEntityId, edge);
      directDispositorByEntity[edge.sourceEntityId] = edge.targetEntityId;
    }
    if (includedSet.has(edge.targetEntityId)) {
      const list = adjacency[edge.sourceEntityId] ?? [];
      if (!list.includes(edge.targetEntityId)) {
        list.push(edge.targetEntityId);
        list.sort((a, b) => a.localeCompare(b));
        adjacency[edge.sourceEntityId] = list;
      }
    } else if (!adjacency[edge.targetEntityId]) {
      // Target is a valid planet outside initial pool (rare in western), ensure deterministic handling
      adjacency[edge.targetEntityId] = adjacency[edge.targetEntityId] ?? [];
    }
  }

  // Run R07 `scc_detection` + `terminal_basin_assignment`
  const sccRes = evaluateRuleMathModel('scc_detection', null, {
    adjacency,
    entities: includedEntityPopulation,
  });
  const basinRes = evaluateRuleMathModel('terminal_basin_assignment', null, {
    adjacency,
    entities: includedEntityPopulation,
  });

  const sccs = basinRes.r07Output?.sccs ?? sccRes.r07Output?.sccs ?? [];
  const terminalSinkSccs = sccs.filter((s) => s.isTrueDispositorSink);
  const terminalBasins = basinRes.r07Output?.basins ?? [];
  const basinByEntity = basinRes.r07Output?.basinByEntity ?? {};
  const unassignedEntities = (basinRes.r07Output?.unassignedEntities ?? []).filter((id) =>
    includedSet.has(id)
  );
  const multiBasinEntities = (basinRes.r07Output?.multiBasinEntities ?? []).filter((id) =>
    includedSet.has(id)
  );

  for (const missingId of unassignedEntities) {
    const directTgt = directDispositorByEntity[missingId];
    excludedOrMissingEntities.push({
      entityId: missingId,
      reason: directTgt
        ? `Dependency chain through ${directTgt} terminates without reaching a closed/self-disposited sink in ${chartFrame}.`
        : `Missing ${relType} edge in ${chartFrame}; left explicitly unassigned (never coerced).`,
    });
  }
  for (const ambigId of multiBasinEntities) {
    excludedOrMissingEntities.push({
      entityId: ambigId,
      reason: `Entity reaches multiple terminal basins in ${chartFrame}; excluded from single-basin assignment without arbitrary tie-breaking.`,
    });
  }

  const selfDispositedEntities = sccs
    .filter((s) => s.size === 1 && s.hasSelfLoop)
    .map((s) => s.members[0])
    .sort((a, b) => a.localeCompare(b));

  const mutualDispositorPairs: K04MutualDispositorPair[] = sccs
    .filter((s) => s.size === 2)
    .map((s) => ({
      entityA: s.members[0],
      entityB: s.members[1],
      sccId: s.sccId,
      isTerminalSink: s.isTrueDispositorSink,
    }));

  const closedMultiPlanetCycles: K04ClosedMultiPlanetCycle[] = sccs
    .filter((s) => s.size >= 2)
    .map((s) => ({
      sccId: s.sccId,
      members: [...s.members],
      size: s.size,
      sccType: s.sccType,
      isTerminalSink: s.isTrueDispositorSink,
    }));

  const sinkMemberSet = new Set(terminalSinkSccs.flatMap((s) => s.members));
  const unassignedSet = new Set(unassignedEntities);
  const upstreamDependentEntities = includedEntityPopulation
    .filter((eid) => !sinkMemberSet.has(eid) && !unassignedSet.has(eid))
    .sort((a, b) => a.localeCompare(b));

  // Compute DCI via R07 `dependency_concentration_dci` without silent renormalization
  const basinCountsMap: Record<string, number> = {};
  for (const b of terminalBasins) {
    basinCountsMap[b.basinId] = b.assignedCount;
  }

  const dciEval = evaluateRuleMathModel('dependency_concentration_dci', null, {
    basinCounts: basinCountsMap,
    totalExpectedPopulation: includedEntityPopulation.length,
    excludedOrMissingCount: unassignedEntities.length + multiBasinEntities.length,
  });

  const dciOutput = dciEval.r07Output?.dciOutput;
  const expectedPop = includedEntityPopulation.length;

  const basinProportions: K04DciBasinProportion[] = terminalBasins.map((b) => ({
    basinId: b.basinId,
    terminalKind: b.terminalKind,
    sinkMembers: [...b.sinkMembers],
    assignedEntityIds: [...b.assignedEntities],
    assignedCount: b.assignedCount,
    proportionOfExpectedPopulation:
      dciOutput?.proportionsByBasin?.[b.basinId] ??
      (expectedPop > 0 ? Math.round((b.assignedCount / expectedPop) * 1000000) / 1000000 : 0),
  }));

  const dciSummary: K04DciSummary = {
    dci: dciOutput?.dci ?? null,
    isComplete:
      Boolean(dciOutput?.isComplete) &&
      unassignedEntities.length === 0 &&
      multiBasinEntities.length === 0 &&
      expectedPop > 0,
    renormalized: false,
    expectedPopulationCount: expectedPop,
    assignedPopulationCount: dciOutput?.assignedPopulation ?? 0,
    missingPopulationCount: dciOutput?.missingPopulation ?? unassignedEntities.length,
    includedEntityPopulation,
    excludedOrMissingEntities,
    basinAssignmentMethodology:
      'Tarjan Strongly Connected Components (SCC) + Condensation DAG reachability per isolated chart frame; every entity is mapped to its reachable true terminal sink SCC.',
    cycleTreatment:
      'Mutual 2-cycles and multi-planet closed cycles (SCC size >= 2, condensation out-degree 0) act as shared multi-entity terminal basins without electing an arbitrary single final dispositor.',
    selfDispositorTreatment:
      'A planet occupying its own sign creates a 1-node self-loop SCC (isTrueDispositorSink=true), forming a 1-member terminal basin.',
    missingRelationshipHandling:
      'Entities lacking outgoing sign-dispositor edges (or failing to reach a true sink) stay unassigned and count toward expectedPopulationCount so incomplete DCI is NEVER silently renormalized to 1.0.',
    calculationVersion: K04_DCI_CALCULATION_VERSION,
    interpretationLimitations:
      'Measures dependency concentration only; does not imply favorability, vulnerability, or predictive outcome',
    basinProportions,
  };

  const hasSingleFinalDispositor =
    dciSummary.isComplete &&
    terminalBasins.length === 1 &&
    terminalBasins[0].terminalKind === 'self_disposited' &&
    terminalBasins[0].sinkMembers.length === 1;
  const singleFinalDispositorEntityId = hasSingleFinalDispositor
    ? terminalBasins[0].sinkMembers[0]
    : null;

  // Precompute reverse adjacency for upstream dependents breadth
  const reverseAdjacency: Record<string, string[]> = {};
  const directDependentsMap = new Map<string, string[]>();
  for (const eid of includedEntityPopulation) {
    reverseAdjacency[eid] = [];
    directDependentsMap.set(eid, []);
  }
  for (const [src, tgt] of Object.entries(directDispositorByEntity)) {
    if (!tgt || !includedSet.has(tgt) || src === tgt) continue;
    const rev = reverseAdjacency[tgt] ?? [];
    if (!rev.includes(src)) {
      rev.push(src);
      rev.sort((a, b) => a.localeCompare(b));
      reverseAdjacency[tgt] = rev;
    }
    const dirList = directDependentsMap.get(tgt) ?? [];
    if (!dirList.includes(src)) {
      dirList.push(src);
      dirList.sort((a, b) => a.localeCompare(b));
      directDependentsMap.set(tgt, dirList);
    }
  }

  // Ascendant Lagnesh edge in vedic_lahiri
  const ascLagneshEdge =
    chartFrame === 'vedic_lahiri'
      ? frameEdges.find(
          (e) =>
            e.sourceEntityId === 'ascendant:Ascendant' &&
            e.relationshipType === 'lagna_depends_on_lagnesh'
        ) ?? null
      : null;

  const parivartanaPartnersByEntity = new Map<string, Set<string>>();
  for (const cfg of nig.configurationParticipants) {
    if (cfg.configurationType !== 'parivartana_exchange' || cfg.chartFrame !== chartFrame) {
      continue;
    }
    const members = cfg.requiredParticipants.map((m) => m.entityId);
    for (const m of members) {
      const set = parivartanaPartnersByEntity.get(m) ?? new Set<string>();
      for (const other of members) {
        if (other !== m) set.add(other);
      }
      parivartanaPartnersByEntity.set(m, set);
    }
  }
  for (const pair of mutualDispositorPairs) {
    const setA = parivartanaPartnersByEntity.get(pair.entityA) ?? new Set<string>();
    setA.add(pair.entityB);
    parivartanaPartnersByEntity.set(pair.entityA, setA);
    const setB = parivartanaPartnersByEntity.get(pair.entityB) ?? new Set<string>();
    setB.add(pair.entityA);
    parivartanaPartnersByEntity.set(pair.entityB, setB);
  }

  // Helper to compute exact directed hops from entity to its sink SCC
  const sccByEntity = new Map<string, R07SccNodeGroup>();
  for (const scc of sccs) {
    for (const m of scc.members) {
      sccByEntity.set(m, scc);
    }
  }

  const computePlanetarySubjectProfile = (
    entityId: string,
    subject: PlanetaryStateSubjectName
  ): K04SubjectDependencyProfile => {
    const scc = sccByEntity.get(entityId) ?? null;
    const basinIds = basinByEntity[entityId] ?? [];
    const assignedBasin =
      basinIds.length === 1
        ? terminalBasins.find((b) => b.basinId === basinIds[0]) ?? null
        : null;
    const directDispId = directDispositorByEntity[entityId] ?? null;
    const directDispSubj = directDispId ? subjectFromEntityId(directDispId) : null;
    const dispEdge = dispEdgeBySource.get(entityId) ?? null;

    const chain = getDependencyChain(nig, entityId, {
      chartFrame,
      relationshipTypes: [relType],
      maxDepth: 16,
    });

    // Compute exact hop distance to first sink SCC node
    let hopsToTerminalBasin: number | null = null;
    if (scc?.isTrueDispositorSink) {
      hopsToTerminalBasin = 0;
    } else if (assignedBasin) {
      const sinkSet = new Set(assignedBasin.sinkMembers);
      const idx = chain.chainNodes.findIndex((n, i) => i > 0 && sinkSet.has(n));
      hopsToTerminalBasin = idx >= 0 ? idx : chain.hopLengthToCycleOrEnd;
    }

    const terminalKind: K04DependencyDepthProperty['terminalKind'] = !assignedBasin
      ? 'unresolved'
      : assignedBasin.terminalKind;

    // Breadth via R07 `graph_reachability` over reversed dispositor edges
    const upstreamReach = evaluateRuleMathModel('graph_reachability', null, {
      adjacency: reverseAdjacency,
      entities: includedEntityPopulation,
      startNodes: [entityId],
      maxDepth: 16,
      maxSteps: 128,
      includeStartInReachable: false,
    });
    const upstreamIds = upstreamReach.r07Output?.reachableEntities ?? [];
    const directDeps = [...(directDependentsMap.get(entityId) ?? [])];
    const includesAscendant = ascLagneshEdge?.targetEntityId === entityId;

    const governedHouseIds = frameEdges
      .filter(
        (e) =>
          e.family === 'governance' &&
          e.sourceEntityId === entityId &&
          (e.relationshipType === 'lords_whole_sign_house_bhavesha' ||
            e.relationshipType === 'kp_cusp_sign_lord')
      )
      .map((e) => e.targetEntityId)
      .sort((a, b) => a.localeCompare(b));

    // Quality (direct K02 state observation, zero scalar averaging)
    const directQuality = directDispId
      ? extractK02QualityObservation(directDispId, k02State)
      : null;
    const sinkObservations = (assignedBasin?.sinkMembers ?? []).map((sid) =>
      extractK02QualityObservation(sid, k02State)
    );
    let qualitativeSummary: K04DependencyQualityProperty['qualitativeSummary'] =
      'unresolved_dispositor';
    if (directQuality) {
      if (directQuality.trustCeiling === 'blocked') qualitativeSummary = 'dispositor_blocked';
      else if (directQuality.trustCeiling === 'provisional')
        qualitativeSummary = 'dispositor_provisional_capped';
      else if (directQuality.conditionFlags.length > 0 || directQuality.conflictCount > 0)
        qualitativeSummary = 'dispositor_usable_with_conditions';
      else if (directQuality.trustCeiling === 'usable') qualitativeSummary = 'dispositor_usable';
    }

    // Concentration
    const propForBasin = assignedBasin
      ? dciSummary.basinProportions.find((p) => p.basinId === assignedBasin.basinId) ?? null
      : null;

    // Redundancy
    const parivartanaPartners = Array.from(
      parivartanaPartnersByEntity.get(entityId) ?? []
    ).sort((a, b) => a.localeCompare(b));

    const nakEdge =
      chartFrame === 'vedic_lahiri'
        ? getOutgoingRelationships(nig, entityId, {
            chartFrame: 'vedic_lahiri',
            families: ['dependency'],
            relationshipTypes: ['disposited_by_nakshatra_lord'],
          })[0] ?? null
        : null;

    const sharedDirectPeers = directDispId
      ? includedEntityPopulation
          .filter(
            (other) => other !== entityId && directDispositorByEntity[other] === directDispId
          )
          .sort((a, b) => a.localeCompare(b))
      : [];

    const sharedBasinPeers = assignedBasin
      ? assignedBasin.assignedEntities
          .filter((other) => other !== entityId)
          .sort((a, b) => a.localeCompare(b))
      : [];

    let altPathCount = 0;
    if (assignedBasin && assignedBasin.sinkMembers.length > 0 && !scc?.isTrueDispositorSink) {
      const pRes = findAlternativeStructuralPaths(nig, entityId, assignedBasin.sinkMembers[0], {
        chartFrame,
        families: ['dependency'],
        relationshipTypes:
          chartFrame === 'vedic_lahiri'
            ? ['disposited_by_sign_lord', 'disposited_by_nakshatra_lord']
            : [relType],
        maxDepth: 8,
      });
      altPathCount = pRes.paths.length;
    }

    const redundancyClassification: K04DependencyRedundancyProperty['redundancyClassification'] =
      !assignedBasin
        ? 'unresolved'
        : parivartanaPartners.length > 0
        ? 'mutual_exchange_loop'
        : scc?.isCycle
        ? 'cyclic_interdependence'
        : nakEdge && nakEdge.targetEntityId !== directDispId
        ? 'multi_channel_with_nakshatra'
        : 'single_channel_chain';

    // Criticality (explicitly partial & deferred to K05/K06/K08)
    const isTerminalSinkMember = Boolean(scc?.isTrueDispositorSink);
    const isCycleBottleneck = isTerminalSinkMember && upstreamIds.length > 0;
    const isUpstreamRelay = !isTerminalSinkMember && directDeps.length > 0;
    const structuralNotes: string[] = [];
    if (isTerminalSinkMember) {
      structuralNotes.push(
        `Member of terminal ${assignedBasin?.terminalKind ?? 'sink'} basin (${assignedBasin?.sinkMembers.join(', ')}).`
      );
    }
    if (isCycleBottleneck) {
      structuralNotes.push(
        `Structural sink receiving dependency feed from ${upstreamIds.length} upstream planet(s).`
      );
    }
    if (includesAscendant) {
      structuralNotes.push('Serves as D1 Lagnesh (Ascendant sign dispositor).');
    }

    const depEdgeIds = [
      ...(dispEdge ? [dispEdge.relationshipId] : []),
      ...(nakEdge ? [nakEdge.relationshipId] : []),
    ];
    const sourceEvIds = Array.from(
      new Set([
        ...(dispEdge?.originalEvidenceIds ?? []),
        ...(nakEdge?.originalEvidenceIds ?? []),
      ])
    );

    return {
      subject,
      entityId,
      chartFrame,
      directDispositorSubject: directDispSubj,
      directDispositorEntityId: directDispId,
      dependencyEdgeIds: depEdgeIds,
      sourceEvidenceIds: sourceEvIds,
      sccId: scc?.sccId ?? null,
      sccMembers: scc ? [...scc.members] : [entityId],
      properties: {
        depth: {
          hopsToTerminalBasin,
          maxUniqueChainEntities: chain.uniqueChainEntityCount,
          chainPathEntityIds: chain.chainNodes,
          isSelfDisposited: selfDispositedEntities.includes(entityId),
          isInCycle: Boolean(scc?.isCycle),
          isTerminalSinkMember,
          terminalKind,
        },
        breadth: {
          directDependentsCount: directDeps.length,
          directDependentEntityIds: directDeps,
          totalUpstreamDependentCount: upstreamIds.length,
          totalUpstreamDependentEntityIds: upstreamIds,
          includesAscendantDependency: includesAscendant,
          governedHouseCount: governedHouseIds.length,
          governedHouseIds,
        },
        quality: {
          directDispositorObservation: directQuality,
          terminalSinkObservations: sinkObservations,
          qualitativeSummary,
          strictlyNoScalarPropagation: true,
          note: 'Direct K02 state observations of dispositor(s) only; zero scalar averaging or recursive PHI propagation.',
        },
        concentration: {
          terminalBasinId: assignedBasin?.basinId ?? null,
          terminalBasinKind: assignedBasin?.terminalKind ?? null,
          terminalBasinSize: assignedBasin?.sinkMembers.length ?? 0,
          basinAssignedEntityCount: assignedBasin?.assignedCount ?? 0,
          basinProportionOfExpectedPopulation:
            propForBasin?.proportionOfExpectedPopulation ?? null,
          frameDci: dciSummary.dci,
          frameDciIsComplete: dciSummary.isComplete,
          feedsIntoSharedTerminalBasin: (assignedBasin?.assignedCount ?? 0) > 1,
        },
        redundancy: {
          parivartanaPartnerEntityIds: parivartanaPartners,
          inParivartana: parivartanaPartners.length > 0,
          nakshatraLordEntityId: nakEdge?.targetEntityId ?? null,
          hasDistinctNakshatraChannel: Boolean(nakEdge && nakEdge.targetEntityId !== directDispId),
          sharedDirectDispositorPeers: sharedDirectPeers,
          sharedTerminalBasinPeers: sharedBasinPeers,
          alternativePathCountToTerminal: altPathCount,
          redundancyClassification,
        },
        criticality: {
          synthesisStatus: 'partial',
          deferralStatus: 'deferred_pending_k05_k06_k08',
          deferredTo: ['K05', 'K06', 'K08'],
          isTerminalSinkMember,
          isCycleBottleneck,
          isUpstreamRelay,
          isLagneshInFrame: includesAscendant,
          downstreamFeedCount: upstreamIds.length,
          structuralNotes,
          note: 'Topological dependency criticality only; functional deliverability synthesis is strictly deferred_pending_k05_k06_k08.',
        },
      },
      epistemicTag: STRUCTURAL_REACHABILITY_EPISTEMIC_TAG,
    };
  };

  const subjectProfiles: Partial<Record<PlanetaryStateSubjectName, K04SubjectDependencyProfile>> =
    {};

  for (const eid of includedEntityPopulation) {
    const subj = subjectFromEntityId(eid);
    if (!subj || subj === 'Ascendant') continue;
    subjectProfiles[subj] = computePlanetarySubjectProfile(eid, subj);
  }

  // Ascendant Profile in vedic_lahiri via Lagnesh dependency
  if (chartFrame === 'vedic_lahiri' && nig.nodesById['ascendant:Ascendant']) {
    const ascId = 'ascendant:Ascendant';
    const lagneshId = ascLagneshEdge?.targetEntityId ?? null;
    const lagneshSubj = lagneshId ? subjectFromEntityId(lagneshId) : null;
    const lagneshProfile = lagneshSubj ? subjectProfiles[lagneshSubj] : undefined;

    const ascChain = getDependencyChain(nig, ascId, {
      chartFrame: 'vedic_lahiri',
      relationshipTypes: ['lagna_depends_on_lagnesh', 'disposited_by_sign_lord'],
      maxDepth: 16,
    });
    const ascNakEdge =
      getOutgoingRelationships(nig, ascId, {
        chartFrame: 'vedic_lahiri',
        families: ['dependency'],
        relationshipTypes: ['lagna_depends_on_nakshatra_lord'],
      })[0] ?? null;

    const lagneshHops = lagneshProfile?.properties.depth.hopsToTerminalBasin;
    const ascHops =
      lagneshId && lagneshHops !== null && lagneshHops !== undefined ? lagneshHops + 1 : null;

    const sharedWithLagnesh =
      lagneshId && includedEntityPopulation.length > 0
        ? detectSharedDependencies(nig, ascId, lagneshId, {
            chartFrame: 'vedic_lahiri',
          }).sharedDependencyEntityIds
        : [];

    subjectProfiles.Ascendant = {
      subject: 'Ascendant',
      entityId: ascId,
      chartFrame: 'vedic_lahiri',
      directDispositorSubject: lagneshSubj,
      directDispositorEntityId: lagneshId,
      dependencyEdgeIds: [
        ...(ascLagneshEdge ? [ascLagneshEdge.relationshipId] : []),
        ...(ascNakEdge ? [ascNakEdge.relationshipId] : []),
      ],
      sourceEvidenceIds: Array.from(
        new Set([
          ...(ascLagneshEdge?.originalEvidenceIds ?? []),
          ...(ascNakEdge?.originalEvidenceIds ?? []),
        ])
      ),
      sccId: null,
      sccMembers: [ascId],
      properties: {
        depth: {
          hopsToTerminalBasin: ascHops,
          maxUniqueChainEntities: ascChain.uniqueChainEntityCount,
          chainPathEntityIds: ascChain.chainNodes,
          isSelfDisposited: false,
          isInCycle: false,
          isTerminalSinkMember: false,
          terminalKind: lagneshProfile?.properties.depth.terminalKind ?? 'unresolved',
        },
        breadth: {
          directDependentsCount: 0,
          directDependentEntityIds: [],
          totalUpstreamDependentCount: 0,
          totalUpstreamDependentEntityIds: [],
          includesAscendantDependency: false,
          governedHouseCount: 0,
          governedHouseIds: [],
        },
        quality: {
          directDispositorObservation: lagneshId
            ? extractK02QualityObservation(lagneshId, k02State)
            : null,
          terminalSinkObservations:
            lagneshProfile?.properties.quality.terminalSinkObservations ?? [],
          qualitativeSummary:
            lagneshProfile?.properties.quality.qualitativeSummary ?? 'unresolved_dispositor',
          strictlyNoScalarPropagation: true,
          note: 'Ascendant depends on Lagnesh (D1 Lagna lord) evaluated via direct K02 observations without scalar propagation.',
        },
        concentration: {
          terminalBasinId: lagneshProfile?.properties.concentration.terminalBasinId ?? null,
          terminalBasinKind: lagneshProfile?.properties.concentration.terminalBasinKind ?? null,
          terminalBasinSize: lagneshProfile?.properties.concentration.terminalBasinSize ?? 0,
          basinAssignedEntityCount:
            lagneshProfile?.properties.concentration.basinAssignedEntityCount ?? 0,
          basinProportionOfExpectedPopulation:
            lagneshProfile?.properties.concentration.basinProportionOfExpectedPopulation ?? null,
          frameDci: dciSummary.dci,
          frameDciIsComplete: dciSummary.isComplete,
          feedsIntoSharedTerminalBasin: Boolean(
            lagneshProfile?.properties.concentration.terminalBasinId
          ),
        },
        redundancy: {
          parivartanaPartnerEntityIds:
            lagneshProfile?.properties.redundancy.parivartanaPartnerEntityIds ?? [],
          inParivartana: Boolean(lagneshProfile?.properties.redundancy.inParivartana),
          nakshatraLordEntityId: ascNakEdge?.targetEntityId ?? null,
          hasDistinctNakshatraChannel: Boolean(
            ascNakEdge && ascNakEdge.targetEntityId !== lagneshId
          ),
          sharedDirectDispositorPeers: sharedWithLagnesh,
          sharedTerminalBasinPeers: lagneshProfile
            ? [
                ...(lagneshId ? [lagneshId] : []),
                ...lagneshProfile.properties.redundancy.sharedTerminalBasinPeers,
              ]
            : [],
          alternativePathCountToTerminal: ascLagneshEdge ? 1 : 0,
          redundancyClassification: !lagneshId
            ? 'unresolved'
            : ascNakEdge && ascNakEdge.targetEntityId !== lagneshId
            ? 'multi_channel_with_nakshatra'
            : 'single_channel_chain',
        },
        criticality: {
          synthesisStatus: 'partial',
          deferralStatus: 'deferred_pending_k05_k06_k08',
          deferredTo: ['K05', 'K06', 'K08'],
          isTerminalSinkMember: false,
          isCycleBottleneck: false,
          isUpstreamRelay: false,
          isLagneshInFrame: false,
          downstreamFeedCount: 0,
          structuralNotes: lagneshId
            ? [`Ascendant structural foundation anchored via Lagnesh ${lagneshSubj ?? lagneshId}.`]
            : ['Ascendant Lagnesh missing in vedic_lahiri frame.'],
          note: 'Topological Lagna-Lagnesh anchor only; functional deliverability deferred_pending_k05_k06_k08.',
        },
      },
      epistemicTag: STRUCTURAL_REACHABILITY_EPISTEMIC_TAG,
    };
  }

  return {
    chartFrame,
    dispositorRelationshipType: relType,
    directDispositorByEntity,
    selfDispositedEntities,
    mutualDispositorPairs,
    closedMultiPlanetCycles,
    sccs,
    terminalSinkSccs,
    terminalBasins,
    upstreamDependentEntities,
    unassignedOrMissingEntities: unassignedEntities,
    hasSingleFinalDispositor,
    singleFinalDispositorEntityId,
    multipleTerminalBasinsDetected: terminalBasins.length > 1,
    dci: dciSummary,
    subjectProfiles,
  };
}

// ============================================================================
// 4. Main Engine Entrypoint & K03 Staged Relational Context Bridge
// ============================================================================

export function analyzeK04DispositorAndDependencies(
  nig: NatalIntelligenceGraph,
  k02State?: AnalyticalKernelK02StateResult | null,
  options: AnalyzeK04DispositorOptions = {}
): K04DispositorDependencyAnalysisResult {
  const framesToAnalyze = options.targetFrames
    ? [...options.targetFrames]
    : discoverAnalyzableFrames(nig);

  const frames: Record<string, K04FrameDispositorAnalysis> = {};
  for (const frame of framesToAnalyze) {
    frames[frame] = analyzeIsolatedFrameDispositors(nig, k02State, frame);
  }

  return {
    engineVersion: K04_DISPOSITOR_ENGINE_VERSION,
    k04EngineVersion: K04_RELATIONAL_ENGINE_VERSION,
    sourceInputFingerprint: nig.sourceInputFingerprint,
    chartIdHash: nig.chartIdHash,
    analyzedFrames: framesToAnalyze,
    frames,
    primaryD1Frame: frames.vedic_lahiri ?? null,
  };
}

export function buildK03RelationalContextFromDispositorAnalysis(
  analysis: K04DispositorDependencyAnalysisResult,
  frame: CanonicalEvidenceFrame = 'vedic_lahiri'
): K03RelationalContextInput {
  const frameResult = analysis.frames[frame] ?? analysis.primaryD1Frame;
  const bySubject: Partial<Record<PlanetaryStateSubjectName, K03RelationalDispositorSubjectFact>> =
    {};
  const qualifiedEvidenceIds = new Set<string>();

  if (frameResult) {
    for (const [subj, prof] of Object.entries(frameResult.subjectProfiles)) {
      if (!prof) continue;
      for (const eid of prof.sourceEvidenceIds) qualifiedEvidenceIds.add(eid);
      bySubject[subj as PlanetaryStateSubjectName] = {
        subject: prof.subject,
        signLord: prof.directDispositorSubject,
        terminalBasinId: prof.properties.concentration.terminalBasinId,
        terminalKind: prof.properties.depth.terminalKind,
        isInSccCycle: prof.properties.depth.isInCycle,
        sccMembers: prof.sccMembers
          .map((id) => subjectFromEntityId(id))
          .filter((s): s is PlanetaryStateSubjectName => Boolean(s)),
        dependencyDepth: prof.properties.depth.hopsToTerminalBasin,
        inboundDependentCount: prof.properties.breadth.directDependentsCount,
        parivartanaPartners: prof.properties.redundancy.parivartanaPartnerEntityIds
          .map((id) => subjectFromEntityId(id))
          .filter((s): s is PlanetaryStateSubjectName => Boolean(s)),
        evidenceIds: [...prof.sourceEvidenceIds],
      };
    }
  }

  return {
    k04EngineVersion: analysis.k04EngineVersion,
    frame,
    dependencyConcentrationIndex: frameResult?.dci.dci ?? null,
    dispositorBasinCount: frameResult?.terminalBasins.length ?? 0,
    bySubject,
    qualifiedRelationalEvidenceIds: Array.from(qualifiedEvidenceIds).sort((a, b) =>
      a.localeCompare(b)
    ),
  };
}
