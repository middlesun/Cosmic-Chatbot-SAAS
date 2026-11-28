/**
 * CosmicCouncil Proprietary Analytical Intelligence Kernel — K01 Identity, Lineage & Overlap
 *
 * Pure TypeScript / Web-standard implementation (zero Node built-ins; Cloudflare Workers safe).
 * Provides:
 *  - Deterministic pure-Web FIPS-180-4 SHA-256 evidence & impact IDs
 *  - CanonicalEvidenceRegistry with strict temporal-scope invariants
 *  - Acyclic lineage graph verification (DFS cycle detection throwing CircularLineageError)
 *  - Evidence overlap & independence classification preserving distinct analytical significance
 *    across derived frames/vargas (never falsely collapsing D1, Nakshatra, D9, KP, and Chalit)
 */

import {
  EVIDENCE_IMPACT_SCHEMA_VERSION,
  type CanonicalEvidenceDraft,
  type CanonicalEvidenceObject,
  type EvidenceImpactDirection,
  type EvidenceImpactInteractionType,
  type EvidenceImpactMagnitude,
  type EvidenceImpactObject,
  type EvidenceImpactOverlapMetadata,
  type EvidenceLineageEdge,
  type EvidenceLineageGraph,
  type EvidenceOverlapRelation,
  type EvidenceOverlapType,
  type NaturalKeyParts,
  type PlanetaryStateDimensionName,
  type UnresolvedParentReference,
} from './types';

export class CircularLineageError extends Error {
  cyclePath: string[];

  constructor(cyclePath: string[]) {
    super(`Circular evidence derivation dependency detected: ${cyclePath.join(' -> ')}`);
    this.name = 'CircularLineageError';
    this.cyclePath = cyclePath;
  }
}

export class EvidenceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvidenceValidationError';
  }
}

const textEncoder = new TextEncoder();

/**
 * Pure synchronous FIPS-180-4 SHA-256 hex digest (zero Node crypto dependency).
 */
export function sha256Hex(message: string): string {
  const bytes = textEncoder.encode(message);
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const W = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return Array.from(H)
    .map((x) => x.toString(16).padStart(8, '0'))
    .join('');
}

function normSeg(raw: string | null | undefined): string {
  return String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

export function buildNaturalKey(parts: NaturalKeyParts): string {
  const baseSegments = [
    normSeg(parts.chartFingerprint),
    normSeg(parts.frame),
    normSeg(parts.family),
    normSeg(parts.observationCode),
    normSeg(parts.subjectType),
    normSeg(parts.subjectId),
    normSeg(parts.ruleCode),
    normSeg(parts.temporalScope),
    parts.temporalScope === 'reference_date_dependent'
      ? normSeg(parts.referenceDateIso || 'unspecified_ref_date')
      : 'natal',
  ];

  if (parts.qualifier && parts.qualifier.trim()) {
    baseSegments.push(normSeg(parts.qualifier));
  }

  return baseSegments.join('|');
}

export function buildDeterministicEvidenceId(parts: NaturalKeyParts): {
  naturalKey: string;
  evidenceId: string;
} {
  const naturalKey = buildNaturalKey(parts);
  const digest = sha256Hex(naturalKey);
  return {
    naturalKey,
    evidenceId: `ev_${digest.slice(0, 32)}`,
  };
}

export function createEvidenceImpactContract(params: {
  evidenceId: string;
  analyticalTarget: EvidenceImpactObject['analyticalTarget'];
  affectedDimension: PlanetaryStateDimensionName | (string & {});
  direction: EvidenceImpactDirection;
  magnitude?: EvidenceImpactMagnitude;
  applicabilityConditions?: string[];
  interactionType?: EvidenceImpactInteractionType;
  modifierEvidenceIds?: string[];
  overlapMetadata?: EvidenceImpactOverlapMetadata;
  impactQualifier?: string;
}): EvidenceImpactObject {
  const magnitude: EvidenceImpactMagnitude = params.magnitude ?? {
    kind: 'unassigned_no_arbitrary_weight',
  };

  if (
    magnitude.kind === 'justified_rule_value' &&
    (!Number.isFinite(magnitude.value) || !magnitude.ruleReference.trim())
  ) {
    throw new EvidenceValidationError(
      'justified_rule_value impact magnitude requires a finite numeric value and non-empty ruleReference.'
    );
  }

  const impactKeyParts = [
    params.evidenceId,
    normSeg(params.analyticalTarget.type),
    normSeg(params.analyticalTarget.id),
    normSeg(params.affectedDimension),
    normSeg(params.direction),
    normSeg(params.interactionType ?? 'direct'),
  ];
  if (params.impactQualifier && params.impactQualifier.trim()) {
    impactKeyParts.push(normSeg(params.impactQualifier));
  }
  const impactKey = impactKeyParts.join('|');

  return {
    schemaVersion: EVIDENCE_IMPACT_SCHEMA_VERSION,
    impactId: `imp_${sha256Hex(impactKey).slice(0, 24)}`,
    evidenceId: params.evidenceId,
    analyticalTarget: params.analyticalTarget,
    affectedDimension: params.affectedDimension,
    direction: params.direction,
    magnitude,
    applicabilityConditions: [...(params.applicabilityConditions ?? [])],
    interactionType: params.interactionType ?? 'direct',
    modifierEvidenceIds: Array.from(new Set(params.modifierEvidenceIds ?? [])),
    overlapMetadata: params.overlapMetadata ?? {
      overlapGroupId: null,
      independenceStatus: 'independent',
      notes: [],
    },
    residualImpact: {
      status: 'unevaluated_pending_k05_k07',
      note: 'Residual impact evaluation is deferred until K05 Interaction and K07 Conflict rules are supplied.',
    },
  };
}

function stableMeasurementSignature(item: CanonicalEvidenceObject): string {
  const normalized = [...item.measurements]
    .map((m) => ({
      metric: m.metric,
      value: m.value,
      unit: m.unit ?? null,
    }))
    .sort((a, b) => a.metric.localeCompare(b.metric));
  return JSON.stringify(normalized);
}

function stableRelatedEntitySignature(item: CanonicalEvidenceObject): string {
  const normalized = [...item.relatedEntities]
    .map((e) => ({
      type: e.type,
      id: e.id,
      role: e.role ?? null,
    }))
    .sort((a, b) =>
      `${a.type}:${a.id}:${a.role ?? ''}`.localeCompare(`${b.type}:${b.id}:${b.role ?? ''}`)
    );
  return JSON.stringify(normalized);
}

const PRIMARY_ANALYTICAL_LENS_CODES = new Set<string>([
  'VEDIC_D1_PLANET_LONGITUDE',
  'VEDIC_D1_SIGN_HOUSE_PLACEMENT',
  'VEDIC_D1_ASCENDANT_SIGN',
  'VEDIC_NAKSHATRA_PADA',
  'BHAVA_CHALIT_HOUSE_PLACEMENT',
  'KP_PLACIDUS_HOUSE_PLACEMENT',
  'KP_PLANET_SUB_LORDS',
  'KP_FOUR_LEVEL_SIGNIFICATORS',
  'WESTERN_TROPICAL_PLACEMENT',
  'ASTRONOMICAL_BODY_TELEMETRY',
]);

function isPrimaryAnalyticalLens(item: CanonicalEvidenceObject): boolean {
  if (PRIMARY_ANALYTICAL_LENS_CODES.has(item.observation.code)) return true;
  if (item.observation.code === 'VEDIC_VARGA_PLACEMENT' && getDivisionalTag(item) === 'DIVISION:D9') {
    return true;
  }
  return false;
}

function getDivisionalTag(item: CanonicalEvidenceObject): string | null {
  const divTag = item.secondaryTags.find((t) => /^division:d\d+$/i.test(t));
  if (divTag) return divTag.toUpperCase();
  const metricDiv = item.measurements.find((m) => m.metric === 'division')?.value;
  if (typeof metricDiv === 'string' && /^d\d+$/i.test(metricDiv.trim())) {
    return `DIVISION:${metricDiv.trim().toUpperCase()}`;
  }
  return null;
}

function getAncestorSet(
  evidenceId: string,
  parentMap: Map<string, string[]>,
  memo: Map<string, Set<string>>
): Set<string> {
  const cached = memo.get(evidenceId);
  if (cached) return cached;

  const result = new Set<string>();
  const stack = [...(parentMap.get(evidenceId) ?? [])];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (result.has(cur)) continue;
    result.add(cur);
    const grandParents = parentMap.get(cur) ?? [];
    for (const gp of grandParents) {
      if (!result.has(gp)) stack.push(gp);
    }
  }
  memo.set(evidenceId, result);
  return result;
}

export class CanonicalEvidenceRegistry {
  private readonly items = new Map<string, CanonicalEvidenceObject>();
  private readonly explicitEdges: EvidenceLineageEdge[] = [];
  private readonly edgeKeys = new Set<string>();
  private readonly duplicateObservations: Array<{
    existingId: string;
    duplicateId: string;
  }> = [];

  register(draft: CanonicalEvidenceDraft): CanonicalEvidenceObject {
    if (draft.temporalScope === 'natal_invariant' && draft.referenceDateIso !== null) {
      throw new EvidenceValidationError(
        `natal_invariant evidence "${draft.observation.code}" cannot carry a non-null referenceDateIso.`
      );
    }
    if (draft.temporalScope === 'reference_date_dependent' && !draft.referenceDateIso) {
      throw new EvidenceValidationError(
        `reference_date_dependent evidence "${draft.observation.code}" requires referenceDateIso.`
      );
    }

    const { naturalKey, evidenceId } = buildDeterministicEvidenceId(draft.naturalKeyParts);
    const parentIds = Array.from(new Set(draft.parentEvidenceIds ?? []));
    const derivedFromMetrics = Array.from(new Set(draft.derivedFromMetrics ?? []));

    if (parentIds.includes(evidenceId)) {
      throw new CircularLineageError([evidenceId, evidenceId]);
    }

    const secondaryTags = Array.from(new Set((draft.secondaryTags ?? []).filter(Boolean)));
    if (!secondaryTags.length && draft.family) {
      // keep secondaryTags clean; empty array is valid
    }

    const materialized: CanonicalEvidenceObject = {
      evidenceId,
      naturalKey,
      subject: draft.subject,
      relatedEntities: draft.relatedEntities ?? [],
      family: draft.family,
      secondaryTags,
      observation: draft.observation,
      measurements: draft.measurements,
      frame: draft.frame,
      methodology: draft.methodology,
      ruleReference: draft.ruleReference,
      sourceDatasets: draft.sourceDatasets,
      lineage: {
        parentEvidenceIds: parentIds,
        derivedFromMetrics,
        derivationDepth: 0,
      },
      temporalScope: draft.temporalScope,
      referenceDateIso: draft.referenceDateIso,
      verification: draft.verification,
      sensitivity: draft.sensitivity,
      versions: draft.versions,
    };

    const existing = this.items.get(evidenceId);
    if (existing) {
      return existing;
    }

    // Detect structurally identical content registered under a distinct qualifier/naturalKey.
    // Must compare relatedEntities as well so pairwise observations (e.g., Panchadha Maitri
    // Mercury->Sun vs Mercury->Venus with identical numerical scores) are never misflagged.
    for (const prev of this.items.values()) {
      if (
        prev.frame === materialized.frame &&
        prev.family === materialized.family &&
        prev.subject.type === materialized.subject.type &&
        prev.subject.id === materialized.subject.id &&
        prev.observation.code === materialized.observation.code &&
        prev.ruleReference.referenceCode === materialized.ruleReference.referenceCode &&
        prev.temporalScope === materialized.temporalScope &&
        prev.referenceDateIso === materialized.referenceDateIso &&
        stableMeasurementSignature(prev) === stableMeasurementSignature(materialized) &&
        stableRelatedEntitySignature(prev) === stableRelatedEntitySignature(materialized)
      ) {
        this.duplicateObservations.push({
          existingId: prev.evidenceId,
          duplicateId: materialized.evidenceId,
        });
      }
    }

    this.items.set(evidenceId, materialized);

    for (const parentId of parentIds) {
      this.addEdgeInternal(parentId, evidenceId, 'derived_from', derivedFromMetrics);
    }

    return materialized;
  }

  registerMany(drafts: CanonicalEvidenceDraft[]): CanonicalEvidenceObject[] {
    return drafts.map((d) => this.register(d));
  }

  linkParent(
    childEvidenceId: string,
    parentEvidenceId: string,
    options?: {
      relationship?: EvidenceLineageEdge['relationship'];
      derivedFromMetrics?: string[];
    }
  ): void {
    if (childEvidenceId === parentEvidenceId) {
      throw new CircularLineageError([parentEvidenceId, childEvidenceId]);
    }
    const child = this.items.get(childEvidenceId);
    if (!child) {
      throw new EvidenceValidationError(
        `Cannot link parent "${parentEvidenceId}": child evidence "${childEvidenceId}" is not registered.`
      );
    }

    if (!child.lineage.parentEvidenceIds.includes(parentEvidenceId)) {
      child.lineage.parentEvidenceIds.push(parentEvidenceId);
    }
    if (options?.derivedFromMetrics?.length) {
      child.lineage.derivedFromMetrics = Array.from(
        new Set([...child.lineage.derivedFromMetrics, ...options.derivedFromMetrics])
      );
    }

    this.addEdgeInternal(
      parentEvidenceId,
      childEvidenceId,
      options?.relationship ?? 'derived_from',
      options?.derivedFromMetrics ?? child.lineage.derivedFromMetrics
    );

    // Immediately verify no cycle was introduced by this link
    this.assertAcyclic();
  }

  private addEdgeInternal(
    parentEvidenceId: string,
    childEvidenceId: string,
    relationship: EvidenceLineageEdge['relationship'],
    derivedFromMetrics: string[]
  ): void {
    const key = `${parentEvidenceId}->${childEvidenceId}:${relationship}`;
    if (this.edgeKeys.has(key)) return;
    this.edgeKeys.add(key);
    this.explicitEdges.push({
      edgeId: `edge_${sha256Hex(key).slice(0, 24)}`,
      parentEvidenceId,
      childEvidenceId,
      relationship,
      derivedFromMetrics: [...derivedFromMetrics],
    });
  }

  assertAcyclic(): void {
    const adjacency = new Map<string, string[]>();
    for (const id of this.items.keys()) {
      adjacency.set(id, []);
    }
    for (const edge of this.explicitEdges) {
      if (!adjacency.has(edge.parentEvidenceId)) {
        adjacency.set(edge.parentEvidenceId, []);
      }
      adjacency.get(edge.parentEvidenceId)!.push(edge.childEvidenceId);
    }

    // 0 = unvisited, 1 = visiting (active recursion stack), 2 = visited
    const state = new Map<string, 0 | 1 | 2>();
    const stack: string[] = [];

    const dfs = (nodeId: string): void => {
      state.set(nodeId, 1);
      stack.push(nodeId);

      const children = adjacency.get(nodeId) ?? [];
      for (const childId of children) {
        const childState = state.get(childId) ?? 0;
        if (childState === 1) {
          const cycleStart = stack.indexOf(childId);
          const cyclePath = [...stack.slice(cycleStart >= 0 ? cycleStart : 0), childId];
          throw new CircularLineageError(cyclePath);
        }
        if (childState === 0) {
          dfs(childId);
        }
      }

      stack.pop();
      state.set(nodeId, 2);
    };

    for (const nodeId of adjacency.keys()) {
      if ((state.get(nodeId) ?? 0) === 0) {
        dfs(nodeId);
      }
    }
  }

  getAll(): CanonicalEvidenceObject[] {
    return Array.from(this.items.values());
  }

  getById(evidenceId: string): CanonicalEvidenceObject | undefined {
    return this.items.get(evidenceId);
  }

  validateAndBuildLineageGraph(options?: {
    strictParents?: boolean;
  }): EvidenceLineageGraph {
    this.assertAcyclic();

    const strictParents = options?.strictParents ?? false;
    const unresolvedParentRefs: UnresolvedParentReference[] = [];
    const parentMap = new Map<string, string[]>();

    for (const item of this.items.values()) {
      const validParents: string[] = [];
      for (const pid of item.lineage.parentEvidenceIds) {
        if (!this.items.has(pid)) {
          if (strictParents) {
            throw new EvidenceValidationError(
              `Evidence "${item.evidenceId}" references missing parent "${pid}".`
            );
          }
          unresolvedParentRefs.push({
            childEvidenceId: item.evidenceId,
            missingParentId: pid,
          });
        } else {
          validParents.push(pid);
        }
      }
      parentMap.set(item.evidenceId, validParents);
    }

    // Compute exact DAG derivation depth bottom-up with memoization
    const depthMemo = new Map<string, number>();
    const computeDepth = (id: string): number => {
      const cached = depthMemo.get(id);
      if (cached !== undefined) return cached;
      const parents = parentMap.get(id) ?? [];
      const depth =
        parents.length === 0 ? 0 : 1 + Math.max(...parents.map((p) => computeDepth(p)));
      depthMemo.set(id, depth);
      return depth;
    };

    let maxDerivationDepth = 0;
    const rootEvidenceIds: string[] = [];
    for (const item of this.items.values()) {
      const d = computeDepth(item.evidenceId);
      item.lineage.derivationDepth = d;
      if (d > maxDerivationDepth) maxDerivationDepth = d;
      if (item.lineage.parentEvidenceIds.length === 0) {
        rootEvidenceIds.push(item.evidenceId);
      }
    }

    const overlapRelations = analyzeEvidenceOverlaps(
      Array.from(this.items.values()),
      this.explicitEdges,
      this.duplicateObservations
    );

    return {
      edges: [...this.explicitEdges],
      overlapRelations,
      rootEvidenceIds,
      maxDerivationDepth,
      cycleCheckPassed: true,
      unresolvedParentRefs,
    };
  }
}

/**
 * Classifies overlap and analytical independence between evidence items.
 * Never automatically collapses evidence derived from the same astronomical
 * longitude (e.g., D1 placement vs Nakshatra vs D9 vs KP Cusp vs Bhava Chalit)
 * into redundant duplicates.
 *
 * K02 Phase 1 Overlap Audit Notes:
 *  - Excludes universal `chart_instant` roots from sibling cross-lens comparisons to eliminate
 *    noisy O(k^2) Cartesian meshes (e.g., D16 vs Panchadha Maitri vs Astronomical Telemetry)
 *    that bloated repository JSON from ~1 MB to ~4.6 MB.
 *  - Preserves 100% of `exact_duplicate` (requiring identical `relatedEntities`),
 *    100% of `partial_mathematical_overlap` (e.g., Shadbala total vs subcomponents, BAV vs SAV/Prastara,
 *    Shadbala vs Ishta/Kashta, Vimshopaka schemes), and meaningful `distinct_analytical_significance`
 *    links (direct parent-child derivations and primary-lens comparisons across D1, Nakshatra, D9,
 *    Chalit, KP, Western Tropical, and Astronomical Telemetry).
 */
export function analyzeEvidenceOverlaps(
  items: CanonicalEvidenceObject[],
  edges: EvidenceLineageEdge[],
  explicitDuplicatePairs: Array<{ existingId: string; duplicateId: string }> = []
): EvidenceOverlapRelation[] {
  const relations: EvidenceOverlapRelation[] = [];
  const seenPairs = new Set<string>();

  const parentMap = new Map<string, string[]>();
  const chartInstantIds = new Set<string>();
  const degreeRootIds = new Set<string>();

  for (const item of items) {
    parentMap.set(item.evidenceId, [...item.lineage.parentEvidenceIds]);
    if (
      item.subject.type === 'chart_instant' ||
      item.observation.code === 'CANONICAL_BIRTH_INSTANT'
    ) {
      chartInstantIds.add(item.evidenceId);
    }
    if (item.family === 'degree_level') {
      degreeRootIds.add(item.evidenceId);
    }
  }
  for (const e of edges) {
    const list = parentMap.get(e.childEvidenceId) ?? [];
    if (!list.includes(e.parentEvidenceId)) list.push(e.parentEvidenceId);
    parentMap.set(e.childEvidenceId, list);
  }

  const ancestorMemo = new Map<string, Set<string>>();
  const addRelation = (rel: Omit<EvidenceOverlapRelation, 'relationId'>) => {
    const [a, b] =
      rel.evidenceIdA < rel.evidenceIdB
        ? [rel.evidenceIdA, rel.evidenceIdB]
        : [rel.evidenceIdB, rel.evidenceIdA];
    const key = `${a}::${b}`;
    if (seenPairs.has(key)) return;
    seenPairs.add(key);
    relations.push({
      relationId: `ov_${sha256Hex(key).slice(0, 24)}`,
      ...rel,
      evidenceIdA: a,
      evidenceIdB: b,
    });
  };

  for (const dup of explicitDuplicatePairs) {
    addRelation({
      evidenceIdA: dup.existingId,
      evidenceIdB: dup.duplicateId,
      overlapType: 'exact_duplicate',
      secondaryClassifications: [],
      sharedUpstreamIds: [],
      sharedMetrics: [],
      collapseRecommended: true,
      rationale:
        'Identical frame, family, subject, related entities, observation code, rule reference, and measurements.',
    });
  }

  // Group by subject.id to keep pairwise analysis deterministic & bounded per entity
  const bySubject = new Map<string, CanonicalEvidenceObject[]>();
  for (const item of items) {
    const key = `${item.subject.type}:${item.subject.id}`;
    const bucket = bySubject.get(key) ?? [];
    bucket.push(item);
    bySubject.set(key, bucket);
  }

  for (const bucket of bySubject.values()) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i];
        const b = bucket[j];

        const ancA = getAncestorSet(a.evidenceId, parentMap, ancestorMemo);
        const ancB = getAncestorSet(b.evidenceId, parentMap, ancestorMemo);
        const aIsParentOfB = ancB.has(a.evidenceId);
        const bIsParentOfA = ancA.has(b.evidenceId);
        const isDirectParentChild =
          a.lineage.parentEvidenceIds.includes(b.evidenceId) ||
          b.lineage.parentEvidenceIds.includes(a.evidenceId);

        const meaningfulSharedAncestors: string[] = [];
        const nonDegreeSharedAncestors: string[] = [];
        for (const id of ancA) {
          if (ancB.has(id) && !chartInstantIds.has(id)) {
            meaningfulSharedAncestors.push(id);
            if (!degreeRootIds.has(id)) {
              nonDegreeSharedAncestors.push(id);
            }
          }
        }

        const metricsA = new Set(a.lineage.derivedFromMetrics);
        const sharedMetrics = b.lineage.derivedFromMetrics.filter((m) => metricsA.has(m));
        const datasetKeysA = new Set(a.sourceDatasets.map((d) => d.datasetKey));
        const sharesDataset = b.sourceDatasets.some((d) => datasetKeysA.has(d.datasetKey));

        // 1. Direct exact duplicate (excluding identical ID)
        if (
          a.frame === b.frame &&
          a.family === b.family &&
          a.observation.code === b.observation.code &&
          a.ruleReference.referenceCode === b.ruleReference.referenceCode &&
          a.temporalScope === b.temporalScope &&
          a.referenceDateIso === b.referenceDateIso &&
          stableMeasurementSignature(a) === stableMeasurementSignature(b) &&
          stableRelatedEntitySignature(a) === stableRelatedEntitySignature(b)
        ) {
          addRelation({
            evidenceIdA: a.evidenceId,
            evidenceIdB: b.evidenceId,
            overlapType: 'exact_duplicate',
            secondaryClassifications: [],
            sharedUpstreamIds: meaningfulSharedAncestors,
            sharedMetrics,
            collapseRecommended: true,
            rationale:
              'Exact semantic and numerical duplicate within the same frame, rule, related entities, and temporal scope.',
          });
          continue;
        }

        // 2. Partial mathematical overlap within same frame & same analytical family/quantitative bucket
        const isQuantitativePair = a.family === 'quantitative' && b.family === 'quantitative';
        if (
          a.frame === b.frame &&
          (((aIsParentOfB || bIsParentOfA) && (a.family === b.family || isQuantitativePair)) ||
            (a.family === b.family && sharesDataset && sharedMetrics.length > 0) ||
            (a.family === b.family && nonDegreeSharedAncestors.length > 0 && sharedMetrics.length > 0))
        ) {
          addRelation({
            evidenceIdA: a.evidenceId,
            evidenceIdB: b.evidenceId,
            overlapType: 'partial_mathematical_overlap',
            secondaryClassifications:
              meaningfulSharedAncestors.length > 0 ? ['shared_upstream_dependency'] : [],
            sharedUpstreamIds:
              meaningfulSharedAncestors.length > 0
                ? meaningfulSharedAncestors
                : aIsParentOfB
                ? [a.evidenceId]
                : bIsParentOfA
                ? [b.evidenceId]
                : [],
            sharedMetrics,
            collapseRecommended: false,
            rationale:
              'Shares underlying mathematical inputs or aggregate components within the same frame; preserve both for lineage audit and avoid double-weighting downstream.',
          });
          continue;
        }

        const divA = getDivisionalTag(a);
        const divB = getDivisionalTag(b);
        const hasDistinctFrameOrLens =
          a.frame !== b.frame ||
          a.family !== b.family ||
          (divA !== null && divB !== null && divA !== divB);

        // 3. Meaningful distinct analytical significance:
        //    - direct derivation from an upstream coordinate/placement across frames/lenses, OR
        //    - two primary analytical lenses (D1, Nakshatra, D9, Chalit, KP, Western, Telemetry)
        //      that share a non-chart_instant upstream root or derivation path.
        const bothPrimaryLenses = isPrimaryAnalyticalLens(a) && isPrimaryAnalyticalLens(b);
        if (
          hasDistinctFrameOrLens &&
          (isDirectParentChild ||
            (bothPrimaryLenses && (meaningfulSharedAncestors.length > 0 || aIsParentOfB || bIsParentOfA)))
        ) {
          addRelation({
            evidenceIdA: a.evidenceId,
            evidenceIdB: b.evidenceId,
            overlapType: 'distinct_analytical_significance',
            secondaryClassifications: ['shared_upstream_dependency'],
            sharedUpstreamIds:
              meaningfulSharedAncestors.length > 0
                ? meaningfulSharedAncestors
                : [aIsParentOfB ? a.evidenceId : b.evidenceId],
            sharedMetrics,
            collapseRecommended: false,
            rationale:
              'Derived from a shared astronomical coordinate or upstream placement, but operates in a distinct chart frame, varga, or primary astrological lens (must not be collapsed as redundant).',
          });
          continue;
        }

        // 4. Shared non-trivial upstream dependency without identical frame/family overlap
        if (nonDegreeSharedAncestors.length > 0 || isDirectParentChild) {
          addRelation({
            evidenceIdA: a.evidenceId,
            evidenceIdB: b.evidenceId,
            overlapType: 'shared_upstream_dependency',
            secondaryClassifications: [],
            sharedUpstreamIds:
              nonDegreeSharedAncestors.length > 0
                ? nonDegreeSharedAncestors
                : [aIsParentOfB ? a.evidenceId : b.evidenceId],
            sharedMetrics,
            collapseRecommended: false,
            rationale:
              'Shares an intermediate upstream dependency; track dependency edge for downstream independence accounting.',
          });
        }
      }
    }
  }

  return relations;
}
