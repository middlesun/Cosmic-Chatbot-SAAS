/**
 * CosmicCouncil Proprietary Analytical Intelligence Kernel — K04 Bounded Cycle-Safe Graph Traversal Utilities
 *
 * Pure TypeScript / Web-standard implementation (zero Node built-ins; Cloudflare Workers safe).
 * Zero external graph databases, zero LLM calls, zero arbitrary weights, zero recursive PHI propagation.
 *
 * Guarantees:
 *  - Frame-aware filtering (never silently merges isolated chart frames or admits temporal edges into natal traversals).
 *  - Explicit `maxDepth` & `maxSteps` termination bounds returning `visitedLimitReached` and `truncatedByDepth`.
 *  - Cycle-safe DFS/BFS path search & Tarjan SCC membership via registered R07 mathematical models.
 *  - Explicit epistemic boundary tag separating structural graph reachability from active influence and K08 deliverability.
 */

import {
  evaluateRuleMathModel,
  type R07SccNodeGroup,
  type R07TerminalBasinSummary,
} from './ruleRegistry';
import type {
  NatalIntelligenceGraph,
  NigChartFrame,
  NigEdgeMethodology,
  NigRelationshipEdge,
  NigRelationshipFamily,
  NigTypedRelationshipName,
} from './k04Types';

export const K04_GRAPH_TRAVERSAL_VERSION = 'k04.traversal.1.0' as const;

export interface NigTraversalFilterOptions {
  chartFrame?: NigChartFrame;
  allowedFrames?: readonly NigChartFrame[];
  families?: readonly NigRelationshipFamily[];
  relationshipTypes?: readonly NigTypedRelationshipName[];
  methodology?: NigEdgeMethodology;
  excludeBlocked?: boolean;
  excludeProvisional?: boolean;
  maxDepth?: number;
  maxSteps?: number;
  maxPaths?: number;
}

export interface NigTraversalBounds {
  maxDepth: number;
  maxSteps: number;
  stepsExecuted: number;
  visitedCount: number;
  visitedLimitReached: boolean;
  truncatedByDepth: boolean;
}

export interface NigEpistemicReachabilityTag {
  epistemicStatus: 'structural_graph_reachability_only';
  impliesActiveAstrologicalInfluence: false;
  functionalDeliverabilityDeferredTo: 'K08';
  note: string;
}

export const STRUCTURAL_REACHABILITY_EPISTEMIC_TAG: Readonly<NigEpistemicReachabilityTag> =
  Object.freeze({
    epistemicStatus: 'structural_graph_reachability_only',
    impliesActiveAstrologicalInfluence: false,
    functionalDeliverabilityDeferredTo: 'K08',
    note: 'Graph reachability reflects structural topology in the Natal Intelligence Graph only; it does not imply active astrological influence or life-domain deliverability (deferred to K08).',
  });

export interface NigDirectRelationshipResult {
  entityId: string;
  chartFrameFilter: NigChartFrame | 'all_filtered';
  outgoing: NigRelationshipEdge[];
  incoming: NigRelationshipEdge[];
  all: NigRelationshipEdge[];
  epistemicTag: Readonly<NigEpistemicReachabilityTag>;
}

export interface NigTypedPathRecord {
  nodes: string[];
  edges: NigRelationshipEdge[];
  hopLength: number;
  chartFramesInPath: NigChartFrame[];
}

export interface NigTypedPathsResult {
  sourceEntityId: string;
  targetEntityId: string;
  paths: NigTypedPathRecord[];
  shortestHopLength: number | null;
  maxPathsLimitReached: boolean;
  bounds: NigTraversalBounds;
  epistemicTag: Readonly<NigEpistemicReachabilityTag>;
}

export interface NigDependencyChainResult {
  entityId: string;
  chartFrame: NigChartFrame;
  chainNodes: string[];
  chainEdges: NigRelationshipEdge[];
  hopLengthToCycleOrEnd: number;
  uniqueChainEntityCount: number;
  cycleDetected: boolean;
  isSelfLoop: boolean;
  cycleEntryEntityId: string | null;
  cycleMembers: string[];
  terminalEntityIds: string[];
  isIncompleteDeadEnd: boolean;
  bounds: NigTraversalBounds;
  epistemicTag: Readonly<NigEpistemicReachabilityTag>;
}

export interface NigCycleMembershipResult {
  entityId: string;
  chartFrame: NigChartFrame;
  isInCycle: boolean;
  isSelfLoop: boolean;
  sccId: string | null;
  sccType: R07SccNodeGroup['sccType'] | null;
  sccMembers: string[];
  isTrueTerminalSink: boolean;
  epistemicTag: Readonly<NigEpistemicReachabilityTag>;
}

export interface NigTerminalBasinMembershipResult {
  entityId: string;
  chartFrame: NigChartFrame;
  terminalBasinIds: string[];
  terminalBasins: R07TerminalBasinSummary[];
  basinStatus: 'single_basin' | 'multiple_basins' | 'unresolved_incomplete';
  isAmbiguousMultiBasin: boolean;
  isUnresolved: boolean;
  reachableSinkMembers: string[];
  epistemicTag: Readonly<NigEpistemicReachabilityTag>;
}

export interface NigSharedDependenciesResult {
  entityIdA: string;
  entityIdB: string;
  chartFrame: NigChartFrame;
  dependenciesA: string[];
  dependenciesB: string[];
  sharedDependencyEntityIds: string[];
  unionDependencyEntityIds: string[];
  jaccardOverlap: number;
  boundsA: NigTraversalBounds;
  boundsB: NigTraversalBounds;
  epistemicTag: Readonly<NigEpistemicReachabilityTag>;
}

export interface NigUniqueReachableEntitiesResult {
  startEntityId: string;
  chartFrameFilter: NigChartFrame | 'all_filtered';
  reachableEntityIds: string[];
  uniqueCount: number;
  duplicatePathVisitsCollapsed: number;
  depthByEntity: Record<string, number>;
  bounds: NigTraversalBounds;
  epistemicTag: Readonly<NigEpistemicReachabilityTag>;
}

function clampBound(v: number | undefined, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : fallback;
  return Math.min(max, Math.max(min, n));
}

function edgePassesFilter(
  edge: NigRelationshipEdge,
  options: NigTraversalFilterOptions
): boolean {
  // Never allow temporal relationships inside natal graph traversals
  if (edge.family === 'temporal_relationship') return false;
  if (options.excludeBlocked !== false && edge.qualificationStatus === 'blocked') {
    return false;
  }
  if (options.excludeProvisional === true && edge.qualificationStatus === 'provisional') {
    return false;
  }
  if (options.chartFrame && edge.chartFrame !== options.chartFrame) {
    return false;
  }
  if (options.allowedFrames && !options.allowedFrames.includes(edge.chartFrame)) {
    return false;
  }
  if (options.families && !options.families.includes(edge.family)) {
    return false;
  }
  if (
    options.relationshipTypes &&
    !options.relationshipTypes.includes(edge.relationshipType)
  ) {
    return false;
  }
  if (options.methodology && edge.methodology !== options.methodology) {
    return false;
  }
  return true;
}

function sortEdgesDeterministically(edges: NigRelationshipEdge[]): NigRelationshipEdge[] {
  return [...edges].sort((a, b) => a.relationshipId.localeCompare(b.relationshipId));
}

function buildFilteredAdjacency(
  graph: NatalIntelligenceGraph,
  options: NigTraversalFilterOptions
): {
  adjacency: Record<string, string[]>;
  edgesByPair: Map<string, NigRelationshipEdge[]>;
  entityPool: string[];
} {
  const adjSets = new Map<string, Set<string>>();
  const edgesByPair = new Map<string, NigRelationshipEdge[]>();
  const entitySet = new Set<string>();

  for (const edge of graph.edges) {
    if (!edgePassesFilter(edge, options)) continue;
    entitySet.add(edge.sourceEntityId);
    entitySet.add(edge.targetEntityId);

    const set = adjSets.get(edge.sourceEntityId) ?? new Set<string>();
    set.add(edge.targetEntityId);
    adjSets.set(edge.sourceEntityId, set);

    const pairKey = `${edge.sourceEntityId}=>${edge.targetEntityId}`;
    const list = edgesByPair.get(pairKey) ?? [];
    list.push(edge);
    edgesByPair.set(pairKey, list);
  }

  for (const [k, list] of edgesByPair.entries()) {
    edgesByPair.set(k, sortEdgesDeterministically(list));
  }

  const adjacency: Record<string, string[]> = {};
  for (const [src, targets] of adjSets.entries()) {
    adjacency[src] = Array.from(targets).sort((a, b) => a.localeCompare(b));
  }

  return {
    adjacency,
    edgesByPair,
    entityPool: Array.from(entitySet).sort((a, b) => a.localeCompare(b)),
  };
}

// ============================================================================
// 1–3. Direct, Incoming & Outgoing Relationships
// ============================================================================

export function getOutgoingRelationships(
  graph: NatalIntelligenceGraph,
  entityId: string,
  options: NigTraversalFilterOptions = {}
): NigRelationshipEdge[] {
  const edgeIds = graph.outgoingEdgeIdsByEntity[entityId] ?? [];
  const filtered: NigRelationshipEdge[] = [];
  for (const id of edgeIds) {
    const edge = graph.edgesById[id];
    if (edge && edgePassesFilter(edge, options)) {
      filtered.push(edge);
    }
  }
  return sortEdgesDeterministically(filtered);
}

export function getIncomingRelationships(
  graph: NatalIntelligenceGraph,
  entityId: string,
  options: NigTraversalFilterOptions = {}
): NigRelationshipEdge[] {
  const edgeIds = graph.incomingEdgeIdsByEntity[entityId] ?? [];
  const filtered: NigRelationshipEdge[] = [];
  for (const id of edgeIds) {
    const edge = graph.edgesById[id];
    if (edge && edgePassesFilter(edge, options)) {
      filtered.push(edge);
    }
  }
  return sortEdgesDeterministically(filtered);
}

export function getDirectRelationships(
  graph: NatalIntelligenceGraph,
  entityId: string,
  options: NigTraversalFilterOptions = {}
): NigDirectRelationshipResult {
  const outgoing = getOutgoingRelationships(graph, entityId, options);
  const incoming = getIncomingRelationships(graph, entityId, options);
  const seen = new Set<string>();
  const all: NigRelationshipEdge[] = [];
  for (const e of [...outgoing, ...incoming]) {
    if (!seen.has(e.relationshipId)) {
      seen.add(e.relationshipId);
      all.push(e);
    }
  }
  return {
    entityId,
    chartFrameFilter: options.chartFrame ?? 'all_filtered',
    outgoing,
    incoming,
    all: sortEdgesDeterministically(all),
    epistemicTag: STRUCTURAL_REACHABILITY_EPISTEMIC_TAG,
  };
}

// ============================================================================
// 4 & 9. Bounded Cycle-Safe Typed Path Search & Alternative Structural Paths
// ============================================================================

export function findTypedPaths(
  graph: NatalIntelligenceGraph,
  sourceEntityId: string,
  targetEntityId: string,
  options: NigTraversalFilterOptions = {}
): NigTypedPathsResult {
  const maxDepth = clampBound(options.maxDepth, 8, 1, 32);
  const maxSteps = clampBound(options.maxSteps, 256, 1, 4096);
  const maxPaths = clampBound(options.maxPaths, 16, 1, 64);

  const paths: NigTypedPathRecord[] = [];
  const visitedNodes = new Set<string>([sourceEntityId]);
  let stepsExecuted = 0;
  let visitedLimitReached = false;
  let truncatedByDepth = false;
  let maxPathsLimitReached = false;

  if (sourceEntityId === targetEntityId && graph.nodesById[sourceEntityId]) {
    // Also check direct self-loop edges if present
    const selfEdges = getOutgoingRelationships(graph, sourceEntityId, options).filter(
      (e) => e.targetEntityId === targetEntityId
    );
    for (const se of selfEdges) {
      if (paths.length >= maxPaths) {
        maxPathsLimitReached = true;
        break;
      }
      paths.push({
        nodes: [sourceEntityId, targetEntityId],
        edges: [se],
        hopLength: 1,
        chartFramesInPath: [se.chartFrame],
      });
    }
  }

  const activePathNodes = new Set<string>([sourceEntityId]);
  const currentNodes: string[] = [sourceEntityId];
  const currentEdges: NigRelationshipEdge[] = [];

  const dfs = (curNode: string, depth: number) => {
    if (visitedLimitReached || maxPathsLimitReached) return;
    if (depth >= maxDepth) {
      const out = getOutgoingRelationships(graph, curNode, options);
      if (out.length > 0) truncatedByDepth = true;
      return;
    }

    const outgoing = getOutgoingRelationships(graph, curNode, options);
    for (const edge of outgoing) {
      if (stepsExecuted >= maxSteps) {
        visitedLimitReached = true;
        return;
      }
      if (paths.length >= maxPaths) {
        maxPathsLimitReached = true;
        return;
      }
      stepsExecuted += 1;
      const next = edge.targetEntityId;
      visitedNodes.add(next);

      if (next === targetEntityId && depth >= 0) {
        // Avoid duplicating trivial depth=0 self-loop already added above
        if (!(sourceEntityId === targetEntityId && depth === 0)) {
          paths.push({
            nodes: [...currentNodes, next],
            edges: [...currentEdges, edge],
            hopLength: currentEdges.length + 1,
            chartFramesInPath: Array.from(
              new Set([...currentEdges.map((e) => e.chartFrame), edge.chartFrame])
            ),
          });
        }
        continue;
      }

      if (activePathNodes.has(next)) {
        // Cycle guard on active DFS stack
        continue;
      }

      activePathNodes.add(next);
      currentNodes.push(next);
      currentEdges.push(edge);
      dfs(next, depth + 1);
      currentEdges.pop();
      currentNodes.pop();
      activePathNodes.delete(next);
    }
  };

  if (graph.nodesById[sourceEntityId] && graph.nodesById[targetEntityId]) {
    dfs(sourceEntityId, 0);
  }

  paths.sort(
    (a, b) =>
      a.hopLength - b.hopLength ||
      a.nodes.join('>').localeCompare(b.nodes.join('>'))
  );

  // Confirm shortest path length via registered R07 `dependency_path_length` when graph is nonempty
  let shortestHopLength: number | null = paths.length > 0 ? paths[0].hopLength : null;
  if (paths.length > 0 && sourceEntityId !== targetEntityId) {
    const { adjacency, entityPool } = buildFilteredAdjacency(graph, options);
    const lenRes = evaluateRuleMathModel('dependency_path_length', null, {
      adjacency,
      entities: entityPool,
      startNodes: [sourceEntityId],
      targetNode: targetEntityId,
      maxDepth,
      maxSteps,
    });
    if (lenRes.valid && lenRes.normalizedValue !== null) {
      shortestHopLength = Math.min(shortestHopLength ?? lenRes.normalizedValue, lenRes.normalizedValue);
    }
  }

  return {
    sourceEntityId,
    targetEntityId,
    paths,
    shortestHopLength,
    maxPathsLimitReached,
    bounds: {
      maxDepth,
      maxSteps,
      stepsExecuted,
      visitedCount: visitedNodes.size,
      visitedLimitReached,
      truncatedByDepth,
    },
    epistemicTag: STRUCTURAL_REACHABILITY_EPISTEMIC_TAG,
  };
}

export function findAlternativeStructuralPaths(
  graph: NatalIntelligenceGraph,
  sourceEntityId: string,
  targetEntityId: string,
  options: NigTraversalFilterOptions = {}
): NigTypedPathsResult {
  return findTypedPaths(graph, sourceEntityId, targetEntityId, {
    ...options,
    maxPaths: clampBound(options.maxPaths, 16, 2, 64),
  });
}

// ============================================================================
// 5. Cycle-Safe Dependency Chain Extraction (Within Isolated Frame)
// ============================================================================

function defaultDispositorTypeForFrame(frame: NigChartFrame): NigTypedRelationshipName {
  if (frame === 'vedic_lahiri') return 'disposited_by_sign_lord';
  if (frame === 'western_tropical') return 'western_traditional_sign_dispositor';
  if (frame.startsWith('vedic_lahiri:')) return 'divisional_sign_dispositor';
  return 'disposited_by_sign_lord';
}

export function getDependencyChain(
  graph: NatalIntelligenceGraph,
  entityId: string,
  options: NigTraversalFilterOptions = {}
): NigDependencyChainResult {
  const chartFrame: NigChartFrame = options.chartFrame ?? 'vedic_lahiri';
  const maxDepth = clampBound(options.maxDepth, 16, 1, 32);
  const maxSteps = clampBound(options.maxSteps, 64, 1, 512);
  const defaultRelType = defaultDispositorTypeForFrame(chartFrame);
  const relationshipTypes: readonly NigTypedRelationshipName[] =
    options.relationshipTypes ??
    (entityId === 'ascendant:Ascendant' && chartFrame === 'vedic_lahiri'
      ? ['lagna_depends_on_lagnesh', 'disposited_by_sign_lord']
      : [defaultRelType]);

  const filterOpts: NigTraversalFilterOptions = {
    ...options,
    chartFrame,
    families: options.families ?? ['dependency'],
    relationshipTypes,
  };

  const chainNodes: string[] = [entityId];
  const chainEdges: NigRelationshipEdge[] = [];
  const indexByNode = new Map<string, number>([[entityId, 0]]);
  let cur = entityId;
  let stepsExecuted = 0;
  let visitedLimitReached = false;
  let truncatedByDepth = false;
  let cycleDetected = false;
  let isSelfLoop = false;
  let cycleEntryEntityId: string | null = null;
  let cycleMembers: string[] = [];

  for (let depth = 0; depth < maxDepth; depth++) {
    if (stepsExecuted >= maxSteps) {
      visitedLimitReached = true;
      break;
    }
    // Note: if Ascendant stepped onto Lagnesh, subsequent hops follow sign dispositor edges too
    const stepRelTypes =
      cur === 'ascendant:Ascendant'
        ? relationshipTypes
        : options.relationshipTypes ?? [defaultRelType];
    const outgoing = getOutgoingRelationships(graph, cur, {
      ...filterOpts,
      relationshipTypes: stepRelTypes,
    });
    if (outgoing.length === 0) {
      break;
    }
    const edge = outgoing[0];
    stepsExecuted += 1;
    chainEdges.push(edge);
    const next = edge.targetEntityId;

    if (next === cur) {
      cycleDetected = true;
      isSelfLoop = true;
      cycleEntryEntityId = next;
      cycleMembers = [cur];
      chainNodes.push(next);
      break;
    }

    if (indexByNode.has(next)) {
      cycleDetected = true;
      cycleEntryEntityId = next;
      const startIdx = indexByNode.get(next)!;
      cycleMembers = chainNodes.slice(startIdx);
      chainNodes.push(next);
      break;
    }

    indexByNode.set(next, chainNodes.length);
    chainNodes.push(next);
    cur = next;

    if (depth === maxDepth - 1) {
      const lookahead = getOutgoingRelationships(graph, cur, {
        ...filterOpts,
        relationshipTypes: options.relationshipTypes ?? [defaultRelType],
      });
      if (lookahead.length > 0) truncatedByDepth = true;
    }
  }

  const countRes = evaluateRuleMathModel('unique_entity_counting', null, {
    entities: chainNodes,
  });
  const uniqueChainEntityCount = countRes.normalizedValue ?? new Set(chainNodes).size;
  const terminalEntityIds = cycleDetected
    ? [...cycleMembers].sort((a, b) => a.localeCompare(b))
    : [];
  const isIncompleteDeadEnd = !cycleDetected && chainEdges.length === 0;

  return {
    entityId,
    chartFrame,
    chainNodes,
    chainEdges,
    hopLengthToCycleOrEnd: chainEdges.length,
    uniqueChainEntityCount,
    cycleDetected,
    isSelfLoop,
    cycleEntryEntityId,
    cycleMembers,
    terminalEntityIds,
    isIncompleteDeadEnd: isIncompleteDeadEnd || (!cycleDetected && !truncatedByDepth && !visitedLimitReached),
    bounds: {
      maxDepth,
      maxSteps,
      stepsExecuted,
      visitedCount: uniqueChainEntityCount,
      visitedLimitReached,
      truncatedByDepth,
    },
    epistemicTag: STRUCTURAL_REACHABILITY_EPISTEMIC_TAG,
  };
}

// ============================================================================
// 6 & 7. Cycle Membership & Terminal Basin Membership (via R07 SCC & Basin Models)
// ============================================================================

export function getCycleMembership(
  graph: NatalIntelligenceGraph,
  entityId: string,
  options: NigTraversalFilterOptions = {}
): NigCycleMembershipResult {
  const chartFrame: NigChartFrame = options.chartFrame ?? 'vedic_lahiri';
  const defaultRelType = defaultDispositorTypeForFrame(chartFrame);
  const { adjacency, entityPool } = buildFilteredAdjacency(graph, {
    ...options,
    chartFrame,
    families: options.families ?? ['dependency'],
    relationshipTypes: options.relationshipTypes ?? [defaultRelType],
  });

  const sccRes = evaluateRuleMathModel('scc_detection', null, {
    adjacency,
    entities: Array.from(new Set([...entityPool, entityId])),
  });
  const sccs = sccRes.r07Output?.sccs ?? [];
  const found = sccs.find((s) => s.members.includes(entityId)) ?? null;

  return {
    entityId,
    chartFrame,
    isInCycle: found ? found.isCycle : false,
    isSelfLoop: found ? found.hasSelfLoop : false,
    sccId: found ? found.sccId : null,
    sccType: found ? found.sccType : null,
    sccMembers: found ? [...found.members] : [entityId],
    isTrueTerminalSink: found ? found.isTrueDispositorSink : false,
    epistemicTag: STRUCTURAL_REACHABILITY_EPISTEMIC_TAG,
  };
}

export function getTerminalBasinMembership(
  graph: NatalIntelligenceGraph,
  entityId: string,
  options: NigTraversalFilterOptions = {}
): NigTerminalBasinMembershipResult {
  const chartFrame: NigChartFrame = options.chartFrame ?? 'vedic_lahiri';
  const defaultRelType = defaultDispositorTypeForFrame(chartFrame);
  const relTypes: readonly NigTypedRelationshipName[] =
    options.relationshipTypes ??
    (entityId === 'ascendant:Ascendant' && chartFrame === 'vedic_lahiri'
      ? [defaultRelType, 'lagna_depends_on_lagnesh']
      : [defaultRelType]);

  const { adjacency, entityPool } = buildFilteredAdjacency(graph, {
    ...options,
    chartFrame,
    families: options.families ?? ['dependency'],
    relationshipTypes: relTypes,
  });

  const basinRes = evaluateRuleMathModel('terminal_basin_assignment', null, {
    adjacency,
    entities: Array.from(new Set([...entityPool, entityId])),
  });
  const basins = basinRes.r07Output?.basins ?? [];
  const basinIds = basinRes.r07Output?.basinByEntity?.[entityId] ?? [];
  const matchedBasins = basins.filter((b) => basinIds.includes(b.basinId));
  const reachableSinkMembers = Array.from(
    new Set(matchedBasins.flatMap((b) => b.sinkMembers))
  ).sort((a, b) => a.localeCompare(b));

  const basinStatus: NigTerminalBasinMembershipResult['basinStatus'] =
    matchedBasins.length === 0
      ? 'unresolved_incomplete'
      : matchedBasins.length === 1
      ? 'single_basin'
      : 'multiple_basins';

  return {
    entityId,
    chartFrame,
    terminalBasinIds: basinIds,
    terminalBasins: matchedBasins,
    basinStatus,
    isAmbiguousMultiBasin: matchedBasins.length > 1,
    isUnresolved: matchedBasins.length === 0,
    reachableSinkMembers,
    epistemicTag: STRUCTURAL_REACHABILITY_EPISTEMIC_TAG,
  };
}

// ============================================================================
// 8. Detect Shared Dependencies (via R07 `graph_reachability` + Set Operations)
// ============================================================================

export function detectSharedDependencies(
  graph: NatalIntelligenceGraph,
  entityIdA: string,
  entityIdB: string,
  options: NigTraversalFilterOptions = {}
): NigSharedDependenciesResult {
  const chartFrame: NigChartFrame = options.chartFrame ?? 'vedic_lahiri';
  const maxDepth = clampBound(options.maxDepth, 12, 1, 32);
  const maxSteps = clampBound(options.maxSteps, 256, 1, 4096);
  const defaultRelType = defaultDispositorTypeForFrame(chartFrame);
  const relTypes: readonly NigTypedRelationshipName[] =
    options.relationshipTypes ??
    (chartFrame === 'vedic_lahiri'
      ? [defaultRelType, 'lagna_depends_on_lagnesh']
      : [defaultRelType]);

  const { adjacency, entityPool } = buildFilteredAdjacency(graph, {
    ...options,
    chartFrame,
    families: options.families ?? ['dependency'],
    relationshipTypes: relTypes,
  });

  const reachA = evaluateRuleMathModel('graph_reachability', null, {
    adjacency,
    entities: entityPool,
    startNodes: [entityIdA],
    maxDepth,
    maxSteps,
    includeStartInReachable: false,
  });
  const reachB = evaluateRuleMathModel('graph_reachability', null, {
    adjacency,
    entities: entityPool,
    startNodes: [entityIdB],
    maxDepth,
    maxSteps,
    includeStartInReachable: false,
  });

  const depsA = reachA.r07Output?.reachableEntities ?? [];
  const depsB = reachB.r07Output?.reachableEntities ?? [];

  const interRes = evaluateRuleMathModel('set_intersection', null, {
    setA: depsA,
    setB: depsB,
  });
  const unionRes = evaluateRuleMathModel('set_union', null, {
    setA: depsA,
    setB: depsB,
  });
  const jaccRes = evaluateRuleMathModel('jaccard_overlap', null, {
    setA: depsA,
    setB: depsB,
  });

  return {
    entityIdA,
    entityIdB,
    chartFrame,
    dependenciesA: depsA,
    dependenciesB: depsB,
    sharedDependencyEntityIds: interRes.r07Output?.items ?? [],
    unionDependencyEntityIds: unionRes.r07Output?.items ?? [],
    jaccardOverlap: jaccRes.normalizedValue ?? 0,
    boundsA: {
      maxDepth,
      maxSteps,
      stepsExecuted: depsA.length,
      visitedCount: depsA.length,
      visitedLimitReached: Boolean(reachA.r07Output?.visitedLimitReached),
      truncatedByDepth: Boolean(reachA.r07Output?.truncatedByDepth),
    },
    boundsB: {
      maxDepth,
      maxSteps,
      stepsExecuted: depsB.length,
      visitedCount: depsB.length,
      visitedLimitReached: Boolean(reachB.r07Output?.visitedLimitReached),
      truncatedByDepth: Boolean(reachB.r07Output?.truncatedByDepth),
    },
    epistemicTag: STRUCTURAL_REACHABILITY_EPISTEMIC_TAG,
  };
}

// ============================================================================
// 10. Count Unique Reachable Entities (via R07 `graph_reachability` + `unique_entity_counting`)
// ============================================================================

export function countUniqueReachableEntities(
  graph: NatalIntelligenceGraph,
  startEntityId: string,
  options: NigTraversalFilterOptions = {}
): NigUniqueReachableEntitiesResult {
  const maxDepth = clampBound(options.maxDepth, 8, 1, 32);
  const maxSteps = clampBound(options.maxSteps, 256, 1, 4096);
  const { adjacency, entityPool } = buildFilteredAdjacency(graph, options);

  const reachRes = evaluateRuleMathModel('graph_reachability', null, {
    adjacency,
    entities: entityPool,
    startNodes: [startEntityId],
    maxDepth,
    maxSteps,
    includeStartInReachable: false,
  });

  const reachableRaw = reachRes.r07Output?.reachableEntities ?? [];
  const countRes = evaluateRuleMathModel('unique_entity_counting', null, {
    entities: reachableRaw,
  });

  const uniqueEntities = countRes.r07Output?.uniqueEntities ?? reachableRaw;
  const depthByEntity = reachRes.r07Output?.depthByEntity ?? {};

  return {
    startEntityId,
    chartFrameFilter: options.chartFrame ?? 'all_filtered',
    reachableEntityIds: uniqueEntities,
    uniqueCount: countRes.normalizedValue ?? uniqueEntities.length,
    duplicatePathVisitsCollapsed: countRes.r07Output?.duplicateInputCount ?? 0,
    depthByEntity,
    bounds: {
      maxDepth,
      maxSteps,
      stepsExecuted: Object.keys(depthByEntity).length,
      visitedCount: uniqueEntities.length,
      visitedLimitReached: Boolean(reachRes.r07Output?.visitedLimitReached),
      truncatedByDepth: Boolean(reachRes.r07Output?.truncatedByDepth),
    },
    epistemicTag: STRUCTURAL_REACHABILITY_EPISTEMIC_TAG,
  };
}
