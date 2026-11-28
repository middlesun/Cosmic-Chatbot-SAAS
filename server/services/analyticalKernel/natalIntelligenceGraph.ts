/**
 * CosmicCouncil Proprietary Analytical Intelligence Kernel — K04 Natal Intelligence Graph (NIG) Builder
 *
 * Pure TypeScript / Web-standard implementation (zero Node built-ins; Cloudflare Workers safe).
 * Zero external graph databases, zero LLM calls, zero live API calls, zero DB writes.
 *
 * Architectural Guarantees:
 *  - Deterministic SHA-256 `relationshipId`s (`rel_<32-hex>`) via `sha256Hex` from `./lineage`.
 *  - Strict Chart Frame Isolation: D1 (`vedic_lahiri`), D9 (`vedic_lahiri:D9`), D2..D60 (`vedic_lahiri:<DIV>`),
 *    `bhava_chalit`, `kp_placidus`, `western_tropical`, and `cross_frame` never collapse into a single pool.
 *  - Blocked/Incompatible Frame Integrity: if `bhava_chalit` is marked `incompatible` in
 *    `repo.rejectedOrBlockedFrames`, all Chalit occupancy/shift edges are omitted with NO KP fallback.
 *  - Multi-Planet Configurations (Yogas, Parivartanas, Doshas, Western Aspect Patterns, Stelliums)
 *    are modeled as explicit `configuration` entities + `ConfigurationParticipantRecord` structures
 *    with `adjudicationStatus: 'participants_mapped_interaction_deferred_to_k05_k07'`.
 *  - Temporal (`repo.temporalEvidence`) and private life context remain strictly excluded from the
 *    canonical `natal` projection (`temporal_relationship` deferred to K09).
 */

import { sha256Hex } from './lineage';
import {
  K04_NIG_SCHEMA_VERSION,
  K04_RELATIONAL_ENGINE_VERSION,
  NIG_RELATIONSHIP_FAMILIES,
  buildDeterministicRelationshipId,
  type BuildNatalIntelligenceGraphOptions,
  type ConfigurationKind,
  type ConfigurationParticipantMember,
  type ConfigurationParticipantRecord,
  type NatalIntelligenceGraph,
  type NigBlockedFrameNotice,
  type NigChartFrame,
  type NigEdgeMethodology,
  type NigEdgeQualificationStatus,
  type NigEntityNode,
  type NigEntityType,
  type NigFrameProjectionSummary,
  type NigRelationshipEdge,
  type NigRelationshipFamily,
  type NigTypedRelationshipName,
} from './k04Types';
import type {
  AnalyticalEvidenceRepository,
  CanonicalEvidenceFrame,
  CanonicalEvidenceObject,
  PropagatedTrustLevel,
} from './types';

const VEDIC_SIGNS = [
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
] as const;

const VEDIC_SIGN_LORDS: Readonly<Record<string, string>> = {
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
};

const WESTERN_TRADITIONAL_RULERS: Readonly<Record<string, string>> = {
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
};

const STANDARD_GRAHA_LIST = new Set<string>([
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
  'Rahu',
  'Ketu',
]);

function strMetric(item: CanonicalEvidenceObject | undefined, metric: string): string | null {
  if (!item) return null;
  const found = item.measurements.find((m) => m.metric === metric);
  return found && typeof found.value === 'string' && found.value.trim() ? found.value.trim() : null;
}

function numMetric(item: CanonicalEvidenceObject | undefined, metric: string): number | null {
  if (!item) return null;
  const found = item.measurements.find((m) => m.metric === metric);
  return found && typeof found.value === 'number' && Number.isFinite(found.value)
    ? found.value
    : null;
}

function boolMetric(item: CanonicalEvidenceObject | undefined, metric: string): boolean | null {
  if (!item) return null;
  const found = item.measurements.find((m) => m.metric === metric);
  return found && typeof found.value === 'boolean' ? found.value : null;
}

function normalizeSign(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();
  const match = VEDIC_SIGNS.find((s) => s.toLowerCase() === cleaned);
  return match ?? raw.trim();
}

function mapMethodology(
  tradition: CanonicalEvidenceObject['methodology']['tradition']
): NigEdgeMethodology {
  switch (tradition) {
    case 'vedic':
      return 'vedic_parashari';
    case 'kp':
      return 'kp';
    case 'jaimini':
      return 'jaimini';
    case 'western':
      return 'western_tropical';
    case 'astronomical':
      return 'astronomical';
    default:
      return 'cross_tradition';
  }
}

function qualificationFromEvidence(
  items: CanonicalEvidenceObject[]
): NigEdgeQualificationStatus {
  if (items.some((e) => e.verification.propagatedTrust === 'blocked')) return 'blocked';
  if (items.some((e) => e.verification.propagatedTrust === 'provisional')) return 'provisional';
  if (items.some((e) => e.verification.statusNotes.length > 0)) return 'qualified_with_caveats';
  return 'qualified';
}

function combineVerificationStatus(
  items: CanonicalEvidenceObject[]
): NigRelationshipEdge['verificationStatus'] {
  if (items.length === 0) {
    return {
      computational: 'verified_internal',
      methodological: 'classical_standard',
      propagatedTrust: 'usable',
    };
  }
  const trustRank: Record<PropagatedTrustLevel, number> = {
    usable: 2,
    provisional: 1,
    blocked: 0,
  };
  let lowest = items[0];
  for (const item of items) {
    if (trustRank[item.verification.propagatedTrust] < trustRank[lowest.verification.propagatedTrust]) {
      lowest = item;
    }
  }
  return {
    computational: lowest.verification.computational,
    methodological: lowest.verification.methodological,
    propagatedTrust: lowest.verification.propagatedTrust,
  };
}

function computeParashariAspectedHouses(planet: string, fromHouse: number): Array<{
  house: number;
  drishtiType: '7th_universal' | '4th_mars_special' | '8th_mars_special' | '5th_jupiter_special' | '9th_jupiter_special' | '3rd_saturn_special' | '10th_saturn_special';
}> {
  const offsetHouse = (delta: number) => ((fromHouse - 1 + delta) % 12) + 1;
  const targets: Array<{
    house: number;
    drishtiType: '7th_universal' | '4th_mars_special' | '8th_mars_special' | '5th_jupiter_special' | '9th_jupiter_special' | '3rd_saturn_special' | '10th_saturn_special';
  }> = [{ house: offsetHouse(6), drishtiType: '7th_universal' }];

  if (planet === 'Mars') {
    targets.push({ house: offsetHouse(3), drishtiType: '4th_mars_special' });
    targets.push({ house: offsetHouse(7), drishtiType: '8th_mars_special' });
  } else if (planet === 'Jupiter') {
    targets.push({ house: offsetHouse(4), drishtiType: '5th_jupiter_special' });
    targets.push({ house: offsetHouse(8), drishtiType: '9th_jupiter_special' });
  } else if (planet === 'Saturn') {
    targets.push({ house: offsetHouse(2), drishtiType: '3rd_saturn_special' });
    targets.push({ house: offsetHouse(9), drishtiType: '10th_saturn_special' });
  }
  return targets;
}

function emptyFamilyCounts(): Record<NigRelationshipFamily, number> {
  const rec = {} as Record<NigRelationshipFamily, number>;
  for (const fam of NIG_RELATIONSHIP_FAMILIES) {
    rec[fam] = 0;
  }
  return rec;
}

export function buildNatalIntelligenceGraph(
  repo: AnalyticalEvidenceRepository,
  options?: BuildNatalIntelligenceGraphOptions
): NatalIntelligenceGraph {
  const chartIdHash = sha256Hex(repo.sourceChart.inputFingerprint || 'unknown_chart').slice(0, 24);
  const natalEvidence = repo.natalEvidence ?? [];
  const natalEvidenceById = new Map<string, CanonicalEvidenceObject>();
  for (const ev of natalEvidence) {
    natalEvidenceById.set(ev.evidenceId, ev);
  }

  const nodeMap = new Map<string, NigEntityNode>();
  const edgeMap = new Map<string, NigRelationshipEdge>();
  let duplicateIdCount = 0;
  let unresolvedEvidenceRefCount = 0;

  const upsertNode = (params: {
    entityId: string;
    entityType: NigEntityType;
    label: string;
    chartFrame: NigEntityNode['chartFrame'];
    subjectRef: string;
    metadata?: Record<string, string | number | boolean | null>;
    sourceEvidenceIds?: string[];
  }): string => {
    const existing = nodeMap.get(params.entityId);
    if (existing) {
      if (params.sourceEvidenceIds?.length) {
        const merged = new Set(existing.sourceEvidenceIds);
        for (const id of params.sourceEvidenceIds) {
          if (natalEvidenceById.has(id)) merged.add(id);
        }
        existing.sourceEvidenceIds = Array.from(merged);
      }
      if (params.metadata) {
        for (const [k, v] of Object.entries(params.metadata)) {
          if (existing.metadata[k] === undefined && v !== undefined) {
            existing.metadata[k] = v;
          }
        }
      }
      return existing.entityId;
    }

    const validEvidenceIds = Array.from(
      new Set((params.sourceEvidenceIds ?? []).filter((id) => natalEvidenceById.has(id)))
    );

    nodeMap.set(params.entityId, {
      entityId: params.entityId,
      entityType: params.entityType,
      label: params.label,
      chartFrame: params.chartFrame,
      subjectRef: params.subjectRef,
      metadata: { ...(params.metadata ?? {}) },
      sourceEvidenceIds: validEvidenceIds,
    });
    return params.entityId;
  };

  const ensurePlanetOrBodyNode = (
    rawId: string,
    label: string,
    evIds: string[],
    frameHint: NigEntityNode['chartFrame'] = 'multi_frame_subject'
  ): string => {
    const cleaned = rawId.trim();
    if (cleaned === 'Ascendant' || cleaned === 'West_Ascendant') {
      return upsertNode({
        entityId: 'ascendant:Ascendant',
        entityType: 'ascendant',
        label: 'Ascendant (Lagna)',
        chartFrame: 'multi_frame_subject',
        subjectRef: 'Ascendant',
        sourceEvidenceIds: evIds,
      });
    }
    const entityId = `planet:${cleaned}`;
    return upsertNode({
      entityId,
      entityType: 'planet',
      label: label || cleaned,
      chartFrame: STANDARD_GRAHA_LIST.has(cleaned) ? 'multi_frame_subject' : frameHint,
      subjectRef: cleaned,
      metadata: {
        isClassicalOrNodeGraha: STANDARD_GRAHA_LIST.has(cleaned),
      },
      sourceEvidenceIds: evIds,
    });
  };

  const ensureSignNode = (chartFrame: NigChartFrame, signName: string, evIds: string[]): string => {
    const norm = normalizeSign(signName) ?? signName.trim();
    return upsertNode({
      entityId: `sign:${chartFrame}:${norm}`,
      entityType: 'sign',
      label: `${norm} (${chartFrame})`,
      chartFrame,
      subjectRef: norm,
      metadata: {
        sign: norm,
        vedicSignLord: VEDIC_SIGN_LORDS[norm] ?? null,
      },
      sourceEvidenceIds: evIds,
    });
  };

  const ensureHouseNode = (
    chartFrame: NigChartFrame,
    houseNumber: number,
    evIds: string[],
    prefix = 'H'
  ): string => {
    const houseKey = `${prefix}${houseNumber}`;
    return upsertNode({
      entityId: `house:${chartFrame}:${houseKey}`,
      entityType: 'house',
      label: `${chartFrame} House ${houseNumber}`,
      chartFrame,
      subjectRef: houseKey,
      metadata: { houseNumber },
      sourceEvidenceIds: evIds,
    });
  };

  const ensureNakshatraNode = (nakName: string, evIds: string[]): string => {
    const clean = nakName.trim();
    return upsertNode({
      entityId: `nakshatra:${clean}`,
      entityType: 'nakshatra',
      label: clean,
      chartFrame: 'vedic_lahiri',
      subjectRef: clean,
      sourceEvidenceIds: evIds,
    });
  };

  const addEdge = (params: {
    sourceEntityId: string;
    targetEntityId: string;
    family: NigRelationshipFamily;
    relationshipType: NigTypedRelationshipName;
    chartFrame: NigChartFrame;
    methodology: NigEdgeMethodology;
    sourceItems: CanonicalEvidenceObject[];
    extraRuleReferences?: string[];
    sourceModule: string;
    notes?: string[];
    attributes?: Record<string, string | number | boolean | string[] | null>;
    qualifier?: string;
    qualificationOverride?: NigEdgeQualificationStatus;
    deferredCapabilityNote?: string;
  }): NigRelationshipEdge | null => {
    // Strictly reject temporal_relationship edges in canonical natal graph
    if (params.family === 'temporal_relationship') {
      return null;
    }

    const originalEvidenceIds = Array.from(
      new Set(params.sourceItems.map((i) => i.evidenceId))
    );
    // Reject any edge that does not originate exclusively from natal evidence
    const hasNonNatal = originalEvidenceIds.some((id) => !natalEvidenceById.has(id));
    if (hasNonNatal || originalEvidenceIds.length === 0) {
      if (hasNonNatal) unresolvedEvidenceRefCount += 1;
      return null;
    }

    const { relationshipId } = buildDeterministicRelationshipId({
      chartIdHash,
      chartFrame: params.chartFrame,
      family: params.family,
      relationshipType: params.relationshipType,
      sourceEntityId: params.sourceEntityId,
      targetEntityId: params.targetEntityId,
      methodology: params.methodology,
      qualifier: params.qualifier,
    });

    if (edgeMap.has(relationshipId)) {
      duplicateIdCount += 1;
      return edgeMap.get(relationshipId)!;
    }

    const ruleReferences = Array.from(
      new Set([
        ...params.sourceItems.map((i) => i.ruleReference.referenceCode),
        ...(params.extraRuleReferences ?? []),
      ])
    ).filter(Boolean);

    const obsCodes = Array.from(new Set(params.sourceItems.map((i) => i.observation.code)));

    const edge: NigRelationshipEdge = {
      relationshipId,
      sourceEntityId: params.sourceEntityId,
      targetEntityId: params.targetEntityId,
      direction: 'directed',
      family: params.family,
      relationshipType: params.relationshipType,
      chartFrame: params.chartFrame,
      methodology: params.methodology,
      originalEvidenceIds,
      ruleReferences,
      qualificationStatus:
        params.qualificationOverride ?? qualificationFromEvidence(params.sourceItems),
      verificationStatus: combineVerificationStatus(params.sourceItems),
      provenance: {
        sourceModule: params.sourceModule,
        derivedFromObservationCodes: obsCodes,
        frameIsolated: true,
        notes: params.notes ?? [],
      },
      attributes: params.attributes ?? {},
      ...(params.deferredCapabilityNote
        ? { deferredCapabilityNote: params.deferredCapabilityNote }
        : {}),
    };

    edgeMap.set(relationshipId, edge);
    return edge;
  };

  // --------------------------------------------------------------------------
  // Detect Blocked / Incompatible Frames (specifically Bhava Chalit)
  // --------------------------------------------------------------------------
  const blockedFrameNotices: NigBlockedFrameNotice[] = [];
  const blockedFramesSet = new Set<CanonicalEvidenceFrame>();

  const chalitBlockedNotice = (repo.rejectedOrBlockedFrames ?? []).find(
    (n) =>
      n.frame === 'bhava_chalit' &&
      (n.canonicalStatus === 'incompatible' ||
        n.canonicalStatus === 'unavailable' ||
        n.reason.toLowerCase().includes('incompatible'))
  );
  const usableChalitEvidence = natalEvidence.filter(
    (e) =>
      e.frame === 'bhava_chalit' &&
      e.observation.code === 'BHAVA_CHALIT_HOUSE_PLACEMENT' &&
      e.verification.propagatedTrust !== 'blocked' &&
      e.verification.computational !== 'incompatible'
  );

  if (chalitBlockedNotice || usableChalitEvidence.length === 0) {
    if (chalitBlockedNotice) {
      blockedFramesSet.add('bhava_chalit');
      blockedFrameNotices.push({
        frame: 'bhava_chalit',
        reason: chalitBlockedNotice.reason,
        fallbackSuppressed: true,
      });
    } else if (
      (repo.rejectedOrBlockedFrames ?? []).some((n) => n.frame === 'bhava_chalit')
    ) {
      blockedFramesSet.add('bhava_chalit');
      blockedFrameNotices.push({
        frame: 'bhava_chalit',
        reason: 'Bhava Chalit frame blocked or unavailable; KP Placidus fallback strictly suppressed.',
        fallbackSuppressed: true,
      });
    }
  }

  // Track D1, Divisional, and Western placements for cross-frame & association derivation
  const d1PlacementsByPlanet = new Map<
    string,
    { sign: string; house: number | null; item: CanonicalEvidenceObject }
  >();
  const d1AscSignItem: { sign: string | null; item: CanonicalEvidenceObject | null } = {
    sign: null,
    item: null,
  };
  const divisionalPlacementsByDiv = new Map<
    string,
    Array<{ subjectId: string; sign: string; house: number | null; dignity: string | null; item: CanonicalEvidenceObject; placementNodeId: string }>
  >();
  const westernPlacementsByPlanet = new Map<
    string,
    { sign: string | null; house: number | null; item: CanonicalEvidenceObject }
  >();
  const pendingGovernanceEdges = new Map<
    string,
    {
      sourceEntityId: string;
      targetEntityId: string;
      relationshipType: NigTypedRelationshipName;
      chartFrame: NigChartFrame;
      methodology: NigEdgeMethodology;
      sourceItems: CanonicalEvidenceObject[];
      sourceModule: string;
      attributes: Record<string, string | number | boolean | string[] | null>;
    }
  >();
  const recordGovernanceEdge = (entry: {
    sourceEntityId: string;
    targetEntityId: string;
    relationshipType: NigTypedRelationshipName;
    chartFrame: NigChartFrame;
    methodology: NigEdgeMethodology;
    sourceItem: CanonicalEvidenceObject;
    sourceModule: string;
    attributes: Record<string, string | number | boolean | string[] | null>;
  }) => {
    const key = `${entry.chartFrame}|${entry.relationshipType}|${entry.sourceEntityId}|${entry.targetEntityId}`;
    const existing = pendingGovernanceEdges.get(key);
    if (existing) {
      if (!existing.sourceItems.some((s) => s.evidenceId === entry.sourceItem.evidenceId)) {
        existing.sourceItems.push(entry.sourceItem);
      }
      return;
    }
    pendingGovernanceEdges.set(key, {
      sourceEntityId: entry.sourceEntityId,
      targetEntityId: entry.targetEntityId,
      relationshipType: entry.relationshipType,
      chartFrame: entry.chartFrame,
      methodology: entry.methodology,
      sourceItems: [entry.sourceItem],
      sourceModule: entry.sourceModule,
      attributes: entry.attributes,
    });
  };

  // --------------------------------------------------------------------------
  // Pass 1: Process Direct Natal Evidence Items by Frame & Observation Code
  // --------------------------------------------------------------------------
  for (const ev of natalEvidence) {
    if (ev.temporalScope !== 'natal_invariant') continue;
    const code = ev.observation.code;

    // A. Vedic D1 Ascendant Sign & Anchor
    if (code === 'VEDIC_D1_ASCENDANT_SIGN' && ev.frame === 'vedic_lahiri') {
      const sign = normalizeSign(strMetric(ev, 'sign'));
      if (!sign) continue;
      d1AscSignItem.sign = sign;
      d1AscSignItem.item = ev;
      const ascNode = ensurePlanetOrBodyNode('Ascendant', 'Ascendant (Lagna)', [ev.evidenceId], 'vedic_lahiri');
      const signNode = ensureSignNode('vedic_lahiri', sign, [ev.evidenceId]);
      const h1Node = ensureHouseNode('vedic_lahiri', 1, [ev.evidenceId], 'H');

      addEdge({
        sourceEntityId: ascNode,
        targetEntityId: signNode,
        family: 'occupancy',
        relationshipType: 'lagna_occupies_rashi_sign',
        chartFrame: 'vedic_lahiri',
        methodology: 'vedic_parashari',
        sourceItems: [ev],
        sourceModule: 'k04:vedic_d1_positional',
        attributes: { sign, house: 1 },
      });
      addEdge({
        sourceEntityId: ascNode,
        targetEntityId: h1Node,
        family: 'occupancy',
        relationshipType: 'lagna_anchors_first_house',
        chartFrame: 'vedic_lahiri',
        methodology: 'vedic_parashari',
        sourceItems: [ev],
        sourceModule: 'k04:vedic_d1_positional',
        attributes: { sign, house: 1 },
      });

      const lagnesh = VEDIC_SIGN_LORDS[sign];
      if (lagnesh) {
        const lagneshNode = ensurePlanetOrBodyNode(lagnesh, lagnesh, [ev.evidenceId]);
        recordGovernanceEdge({
          sourceEntityId: lagneshNode,
          targetEntityId: signNode,
          relationshipType: 'rules_rashi_sign',
          chartFrame: 'vedic_lahiri',
          methodology: 'vedic_parashari',
          sourceItem: ev,
          sourceModule: 'k04:vedic_d1_governance',
          attributes: { sign, signLord: lagnesh },
        });
        addEdge({
          sourceEntityId: ascNode,
          targetEntityId: lagneshNode,
          family: 'dependency',
          relationshipType: 'lagna_depends_on_lagnesh',
          chartFrame: 'vedic_lahiri',
          methodology: 'vedic_parashari',
          sourceItems: [ev],
          sourceModule: 'k04:vedic_d1_dependency',
          attributes: { lagnaSign: sign, lagnesh },
        });
      }
      continue;
    }

    // B. Vedic D1 Planet Sign & Whole-Sign House Placement
    if (code === 'VEDIC_D1_SIGN_HOUSE_PLACEMENT' && ev.frame === 'vedic_lahiri') {
      const planet = ev.subject.id;
      const sign = normalizeSign(strMetric(ev, 'sign'));
      const house = numMetric(ev, 'house');
      const pNode = ensurePlanetOrBodyNode(planet, ev.subject.name, [ev.evidenceId]);

      if (sign) {
        d1PlacementsByPlanet.set(planet, { sign, house, item: ev });
        const signNode = ensureSignNode('vedic_lahiri', sign, [ev.evidenceId]);
        addEdge({
          sourceEntityId: pNode,
          targetEntityId: signNode,
          family: 'occupancy',
          relationshipType: 'occupies_rashi_sign',
          chartFrame: 'vedic_lahiri',
          methodology: 'vedic_parashari',
          sourceItems: [ev],
          sourceModule: 'k04:vedic_d1_positional',
          attributes: { sign, house },
        });

        const signLord = VEDIC_SIGN_LORDS[sign];
        if (signLord) {
          const lordNode = ensurePlanetOrBodyNode(signLord, signLord, [ev.evidenceId]);
          recordGovernanceEdge({
            sourceEntityId: lordNode,
            targetEntityId: signNode,
            relationshipType: 'rules_rashi_sign',
            chartFrame: 'vedic_lahiri',
            methodology: 'vedic_parashari',
            sourceItem: ev,
            sourceModule: 'k04:vedic_d1_governance',
            attributes: { sign, signLord },
          });
        }
      }
      if (house !== null) {
        const hNode = ensureHouseNode('vedic_lahiri', house, [ev.evidenceId], 'H');
        addEdge({
          sourceEntityId: pNode,
          targetEntityId: hNode,
          family: 'occupancy',
          relationshipType: 'occupies_whole_sign_house',
          chartFrame: 'vedic_lahiri',
          methodology: 'vedic_parashari',
          sourceItems: [ev],
          sourceModule: 'k04:vedic_d1_positional',
          attributes: { sign, house },
        });
      }
      continue;
    }

    // C. Vedic Nakshatra & Pada
    if (code === 'VEDIC_NAKSHATRA_PADA' && ev.frame === 'vedic_lahiri') {
      const nakName = strMetric(ev, 'nakshatra');
      if (!nakName) continue;
      const pada = numMetric(ev, 'pada');
      const nakLord = strMetric(ev, 'nakshatra_lord');
      const subjNode = ensurePlanetOrBodyNode(ev.subject.id, ev.subject.name, [ev.evidenceId]);
      const nakNode = ensureNakshatraNode(nakName, [ev.evidenceId]);
      const isAsc = ev.subject.type === 'ascendant' || ev.subject.id === 'Ascendant';

      addEdge({
        sourceEntityId: subjNode,
        targetEntityId: nakNode,
        family: 'occupancy',
        relationshipType: isAsc ? 'lagna_occupies_nakshatra' : 'occupies_nakshatra',
        chartFrame: 'vedic_lahiri',
        methodology: 'vedic_parashari',
        sourceItems: [ev],
        sourceModule: 'k04:vedic_stellar',
        attributes: { nakshatra: nakName, pada, nakshatraLord: nakLord },
      });

      if (nakLord) {
        const lordNode = ensurePlanetOrBodyNode(nakLord, nakLord, [ev.evidenceId]);
        recordGovernanceEdge({
          sourceEntityId: lordNode,
          targetEntityId: nakNode,
          relationshipType: 'rules_nakshatra',
          chartFrame: 'vedic_lahiri',
          methodology: 'vedic_parashari',
          sourceItem: ev,
          sourceModule: 'k04:vedic_stellar',
          attributes: { nakshatra: nakName, nakshatraLord: nakLord },
        });
        addEdge({
          sourceEntityId: subjNode,
          targetEntityId: lordNode,
          family: 'dependency',
          relationshipType: isAsc
            ? 'lagna_depends_on_nakshatra_lord'
            : 'disposited_by_nakshatra_lord',
          chartFrame: 'vedic_lahiri',
          methodology: 'vedic_parashari',
          sourceItems: [ev],
          sourceModule: 'k04:vedic_stellar',
          attributes: { nakshatra: nakName, pada, nakshatraLord: nakLord },
        });
      }
      continue;
    }

    // D. Vedic D1 Dispositor Dependency
    if (code === 'VEDIC_D1_DISPOSITOR_DEPENDENCY' && ev.frame === 'vedic_lahiri') {
      const planet = ev.subject.id;
      const signLord = strMetric(ev, 'sign_lord');
      if (!signLord) continue;
      const pNode = ensurePlanetOrBodyNode(planet, ev.subject.name, [ev.evidenceId]);
      const lordNode = ensurePlanetOrBodyNode(signLord, signLord, [ev.evidenceId]);

      addEdge({
        sourceEntityId: pNode,
        targetEntityId: lordNode,
        family: 'dependency',
        relationshipType: 'disposited_by_sign_lord',
        chartFrame: 'vedic_lahiri',
        methodology: 'vedic_parashari',
        sourceItems: [ev],
        sourceModule: 'k04:vedic_d1_dispositor',
        attributes: {
          signLord,
          dispositorSign: strMetric(ev, 'dispositor_sign'),
          dispositorHouse: numMetric(ev, 'dispositor_house'),
          isSelfDisposited: boolMetric(ev, 'is_self_disposited'),
          terminationType: strMetric(ev, 'termination_type'),
          finalDispositor: strMetric(ev, 'final_dispositor'),
          chainPath: strMetric(ev, 'chain_path'),
        },
      });
      continue;
    }

    // E. Vedic D1 House Lord Placement (Bhavesha)
    if (code === 'VEDIC_D1_HOUSE_LORD_PLACEMENT' && ev.frame === 'vedic_lahiri') {
      const houseNum = numMetric(ev, 'house');
      const houseLord = strMetric(ev, 'house_lord');
      const houseSign = normalizeSign(strMetric(ev, 'house_sign'));
      if (houseNum === null || !houseLord) continue;

      const hNode = ensureHouseNode('vedic_lahiri', houseNum, [ev.evidenceId], 'H');
      const lordNode = ensurePlanetOrBodyNode(houseLord, houseLord, [ev.evidenceId]);
      if (houseSign) {
        const sNode = ensureSignNode('vedic_lahiri', houseSign, [ev.evidenceId]);
        recordGovernanceEdge({
          sourceEntityId: lordNode,
          targetEntityId: sNode,
          relationshipType: 'rules_rashi_sign',
          chartFrame: 'vedic_lahiri',
          methodology: 'vedic_parashari',
          sourceItem: ev,
          sourceModule: 'k04:vedic_d1_bhavesha',
          attributes: { sign: houseSign, signLord: houseLord },
        });
      }

      addEdge({
        sourceEntityId: lordNode,
        targetEntityId: hNode,
        family: 'governance',
        relationshipType: 'lords_whole_sign_house_bhavesha',
        chartFrame: 'vedic_lahiri',
        methodology: 'vedic_parashari',
        sourceItems: [ev],
        sourceModule: 'k04:vedic_d1_bhavesha',
        attributes: {
          house: houseNum,
          houseSign,
          lordPlacedInSign: strMetric(ev, 'lord_placed_in_sign'),
          lordPlacedInHouse: numMetric(ev, 'lord_placed_in_house'),
        },
      });
      addEdge({
        sourceEntityId: hNode,
        targetEntityId: lordNode,
        family: 'dependency',
        relationshipType: 'house_depends_on_bhavesha',
        chartFrame: 'vedic_lahiri',
        methodology: 'vedic_parashari',
        sourceItems: [ev],
        sourceModule: 'k04:vedic_d1_bhavesha',
        attributes: {
          house: houseNum,
          houseSign,
          lordPlacedInSign: strMetric(ev, 'lord_placed_in_sign'),
          lordPlacedInHouse: numMetric(ev, 'lord_placed_in_house'),
        },
      });
      continue;
    }

    // F. Divisional Charts (VEDIC_VARGA_PLACEMENT + VEDIC_VARGA_D5_PROVISIONAL)
    if (
      (code === 'VEDIC_VARGA_PLACEMENT' || code === 'VEDIC_VARGA_D5_PROVISIONAL') &&
      ev.frame === 'vedic_lahiri'
    ) {
      const division = (strMetric(ev, 'division') ?? 'D9').toUpperCase();
      const sign = normalizeSign(strMetric(ev, 'sign'));
      if (!sign) continue;
      const house = numMetric(ev, 'house');
      const dignity = strMetric(ev, 'dignity');
      const isProvisionalD5 = code === 'VEDIC_VARGA_D5_PROVISIONAL';
      const divFrame: NigChartFrame = division === 'D1' ? 'vedic_lahiri' : `vedic_lahiri:${division}`;

      // If D1 is already captured by primary D1 observations, do not duplicate D1 occupancy/dispositor edges;
      // still isolate D2..D60 under `vedic_lahiri:<DIV>`
      if (division === 'D1') continue;

      const subjectId = ev.subject.id;
      const isAsc = ev.subject.type === 'ascendant' || subjectId === 'Ascendant';
      const subjNode = ensurePlanetOrBodyNode(subjectId, ev.subject.name, [ev.evidenceId]);
      const placementEntityId = `divisional_placement:${division}:${subjectId}`;

      upsertNode({
        entityId: placementEntityId,
        entityType: 'divisional_placement',
        label: `${subjectId} in ${division} (${sign})`,
        chartFrame: divFrame,
        subjectRef: `${division}:${subjectId}`,
        metadata: {
          division,
          subjectId,
          sign,
          house,
          dignity,
          provisional: isProvisionalD5,
        },
        sourceEvidenceIds: [ev.evidenceId],
      });

      const signNode = ensureSignNode(divFrame, sign, [ev.evidenceId]);

      addEdge({
        sourceEntityId: subjNode,
        targetEntityId: placementEntityId,
        family: 'occupancy',
        relationshipType: 'occupies_divisional_placement',
        chartFrame: divFrame,
        methodology: 'vedic_parashari',
        sourceItems: [ev],
        sourceModule: 'k04:vedic_divisional',
        attributes: { division, sign, house, dignity, isProvisionalD5 },
      });

      addEdge({
        sourceEntityId: placementEntityId,
        targetEntityId: signNode,
        family: 'occupancy',
        relationshipType: 'divisional_placement_in_sign',
        chartFrame: divFrame,
        methodology: 'vedic_parashari',
        sourceItems: [ev],
        sourceModule: 'k04:vedic_divisional',
        attributes: { division, sign, house, dignity, isProvisionalD5 },
      });

      if (house !== null) {
        const divHouseNode = ensureHouseNode(divFrame, house, [ev.evidenceId], `${division}_H`);
        addEdge({
          sourceEntityId: placementEntityId,
          targetEntityId: divHouseNode,
          family: 'occupancy',
          relationshipType: 'divisional_placement_in_house',
          chartFrame: divFrame,
          methodology: 'vedic_parashari',
          sourceItems: [ev],
          sourceModule: 'k04:vedic_divisional',
          attributes: { division, sign, house, dignity, isProvisionalD5 },
        });
      }

      const divSignLord = VEDIC_SIGN_LORDS[sign];
      if (divSignLord) {
        const divLordNode = ensurePlanetOrBodyNode(divSignLord, divSignLord, [ev.evidenceId]);
        recordGovernanceEdge({
          sourceEntityId: divLordNode,
          targetEntityId: signNode,
          relationshipType: 'divisional_rules_sign',
          chartFrame: divFrame,
          methodology: 'vedic_parashari',
          sourceItem: ev,
          sourceModule: 'k04:vedic_divisional',
          attributes: { division, sign, signLord: divSignLord },
        });

        if (!isAsc) {
          addEdge({
            sourceEntityId: subjNode,
            targetEntityId: divLordNode,
            family: 'dependency',
            relationshipType: 'divisional_sign_dispositor',
            chartFrame: divFrame,
            methodology: 'vedic_parashari',
            sourceItems: [ev],
            sourceModule: 'k04:vedic_divisional',
            attributes: {
              division,
              occupiedSign: sign,
              signLord: divSignLord,
              divisionalHouse: house,
              dignity,
              divisionalPlacementEntityId: placementEntityId,
              isSelfDisposited: subjectId === divSignLord,
            },
          });
        }
      }

      if (!isAsc) {
        const bucket = divisionalPlacementsByDiv.get(division) ?? [];
        bucket.push({
          subjectId,
          sign,
          house,
          dignity,
          item: ev,
          placementNodeId: placementEntityId,
        });
        divisionalPlacementsByDiv.set(division, bucket);
      }
      continue;
    }

    // G. Bhava Chalit (strictly skipped if blocked/incompatible; zero KP fallback)
    if (code === 'BHAVA_CHALIT_HOUSE_PLACEMENT' && ev.frame === 'bhava_chalit') {
      if (
        blockedFramesSet.has('bhava_chalit') ||
        ev.verification.propagatedTrust === 'blocked' ||
        ev.verification.computational === 'incompatible'
      ) {
        continue;
      }
      const chalitHouse = numMetric(ev, 'chalit_house');
      const rashiHouse = numMetric(ev, 'rashi_house');
      const shifted = boolMetric(ev, 'shifted_from_rashi');
      if (chalitHouse === null) continue;

      const pNode = ensurePlanetOrBodyNode(ev.subject.id, ev.subject.name, [ev.evidenceId]);
      const chHouseNode = ensureHouseNode('bhava_chalit', chalitHouse, [ev.evidenceId], 'Chalit_H');
      addEdge({
        sourceEntityId: pNode,
        targetEntityId: chHouseNode,
        family: 'occupancy',
        relationshipType: 'occupies_sripati_chalit_house',
        chartFrame: 'bhava_chalit',
        methodology: 'vedic_parashari',
        sourceItems: [ev],
        sourceModule: 'k04:bhava_chalit',
        attributes: {
          chalitHouse,
          rashiHouse,
          shiftedFromRashi: shifted,
        },
      });

      if (shifted === true && rashiHouse !== null) {
        addEdge({
          sourceEntityId: pNode,
          targetEntityId: chHouseNode,
          family: 'cross_frame_relationship',
          relationshipType: 'chalit_house_shift_from_d1_rashi',
          chartFrame: 'cross_frame',
          methodology: 'cross_tradition',
          sourceItems: [ev],
          sourceModule: 'k04:cross_frame_chalit',
          attributes: {
            d1RashiHouse: rashiHouse,
            chalitHouse,
            shiftedFromRashi: true,
          },
          notes: ['Explicit Bhava Chalit vs D1 Whole-Sign house divergence.'],
        });
      }
      continue;
    }

    // H. KP Placidus Placements, Cuspal & Planetary Star/Sub/Sub-Sub Lords & 4-Level Significators
    if (code === 'KP_PLACIDUS_HOUSE_PLACEMENT' && ev.frame === 'kp_placidus') {
      const kpHouse = numMetric(ev, 'kp_house');
      const kpSign = normalizeSign(strMetric(ev, 'sign'));
      const pNode = ensurePlanetOrBodyNode(ev.subject.id, ev.subject.name, [ev.evidenceId]);
      if (kpHouse !== null) {
        const kpHNode = ensureHouseNode('kp_placidus', kpHouse, [ev.evidenceId], 'KP_H');
        addEdge({
          sourceEntityId: pNode,
          targetEntityId: kpHNode,
          family: 'occupancy',
          relationshipType: 'occupies_kp_placidus_house',
          chartFrame: 'kp_placidus',
          methodology: 'kp',
          sourceItems: [ev],
          sourceModule: 'k04:kp_placidus',
          attributes: { kpHouse, sign: kpSign },
        });
      }
      if (kpSign) {
        const kpSNode = ensureSignNode('kp_placidus', kpSign, [ev.evidenceId]);
        addEdge({
          sourceEntityId: pNode,
          targetEntityId: kpSNode,
          family: 'occupancy',
          relationshipType: 'occupies_kp_sign',
          chartFrame: 'kp_placidus',
          methodology: 'kp',
          sourceItems: [ev],
          sourceModule: 'k04:kp_placidus',
          attributes: { kpHouse, sign: kpSign },
        });
      }
      continue;
    }

    if (code === 'KP_CUSPAL_SUB_LORDS' && ev.frame === 'kp_placidus') {
      const hNum = numMetric(ev, 'house');
      if (hNum === null) continue;
      const cuspHouseNode = ensureHouseNode('kp_placidus', hNum, [ev.evidenceId], 'KP_H');
      const signLord = strMetric(ev, 'sign_lord');
      const starLord = strMetric(ev, 'star_lord');
      const subLord = strMetric(ev, 'sub_lord');
      const subSubLord = strMetric(ev, 'sub_sub_lord');

      if (signLord) {
        const slNode = ensurePlanetOrBodyNode(signLord, signLord, [ev.evidenceId]);
        addEdge({
          sourceEntityId: slNode,
          targetEntityId: cuspHouseNode,
          family: 'governance',
          relationshipType: 'kp_cusp_sign_lord',
          chartFrame: 'kp_placidus',
          methodology: 'kp',
          sourceItems: [ev],
          sourceModule: 'k04:kp_stellar',
          attributes: { house: hNum, signLord },
        });
      }
      for (const [roleType, lordName] of [
        ['kp_cusp_star_lord', starLord],
        ['kp_cusp_sub_lord', subLord],
        ['kp_cusp_sub_sub_lord', subSubLord],
      ] as const) {
        if (!lordName) continue;
        const lNode = ensurePlanetOrBodyNode(lordName, lordName, [ev.evidenceId]);
        addEdge({
          sourceEntityId: cuspHouseNode,
          targetEntityId: lNode,
          family: 'dependency',
          relationshipType: roleType,
          chartFrame: 'kp_placidus',
          methodology: 'kp',
          sourceItems: [ev],
          sourceModule: 'k04:kp_stellar',
          attributes: { house: hNum, lordName, roleType },
        });
      }
      continue;
    }

    if (code === 'KP_PLANET_SUB_LORDS' && ev.frame === 'kp_placidus') {
      const pNode = ensurePlanetOrBodyNode(ev.subject.id, ev.subject.name, [ev.evidenceId]);
      for (const [roleType, metricKey] of [
        ['kp_planet_sign_lord', 'sign_lord'],
        ['kp_planet_star_lord', 'star_lord'],
        ['kp_planet_sub_lord', 'sub_lord'],
        ['kp_planet_sub_sub_lord', 'sub_sub_lord'],
      ] as const) {
        const lordName = strMetric(ev, metricKey);
        if (!lordName) continue;
        const lNode = ensurePlanetOrBodyNode(lordName, lordName, [ev.evidenceId]);
        addEdge({
          sourceEntityId: pNode,
          targetEntityId: lNode,
          family: 'dependency',
          relationshipType: roleType,
          chartFrame: 'kp_placidus',
          methodology: 'kp',
          sourceItems: [ev],
          sourceModule: 'k04:kp_stellar',
          attributes: { lordName, tier: metricKey },
        });
      }
      continue;
    }

    if (code === 'KP_FOUR_LEVEL_SIGNIFICATORS' && ev.frame === 'kp_placidus') {
      const pNode = ensurePlanetOrBodyNode(ev.subject.id, ev.subject.name, [ev.evidenceId]);
      for (const [levelType, metricKey] of [
        ['kp_significator_level_1', 'level_1_houses'],
        ['kp_significator_level_2', 'level_2_houses'],
        ['kp_significator_level_3', 'level_3_houses'],
        ['kp_significator_level_4', 'level_4_houses'],
      ] as const) {
        const rawList = strMetric(ev, metricKey);
        if (!rawList) continue;
        const houseNums = rawList
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12);
        for (const hNum of Array.from(new Set(houseNums))) {
          const kpHNode = ensureHouseNode('kp_placidus', hNum, [ev.evidenceId], 'KP_H');
          addEdge({
            sourceEntityId: pNode,
            targetEntityId: kpHNode,
            family: 'dependency',
            relationshipType: levelType,
            chartFrame: 'kp_placidus',
            methodology: 'kp',
            sourceItems: [ev],
            sourceModule: 'k04:kp_significators',
            attributes: { house: hNum, significationGrade: metricKey },
          });
        }
      }
      continue;
    }

    // I. Western Tropical Placements & Traditional Rulerships
    if (code === 'WESTERN_TROPICAL_PLACEMENT' && ev.frame === 'western_tropical') {
      const sign = normalizeSign(strMetric(ev, 'sign'));
      const house = numMetric(ev, 'house');
      const pNode = ensurePlanetOrBodyNode(
        ev.subject.id,
        ev.subject.name,
        [ev.evidenceId],
        'western_tropical'
      );
      westernPlacementsByPlanet.set(ev.subject.id, { sign, house, item: ev });

      if (sign) {
        const sNode = ensureSignNode('western_tropical', sign, [ev.evidenceId]);
        addEdge({
          sourceEntityId: pNode,
          targetEntityId: sNode,
          family: 'occupancy',
          relationshipType: 'occupies_tropical_sign',
          chartFrame: 'western_tropical',
          methodology: 'western_tropical',
          sourceItems: [ev],
          sourceModule: 'k04:western_tropical',
          attributes: { sign, house },
        });
        const ruler = WESTERN_TRADITIONAL_RULERS[sign];
        if (ruler) {
          const rNode = ensurePlanetOrBodyNode(ruler, ruler, [ev.evidenceId], 'western_tropical');
          recordGovernanceEdge({
            sourceEntityId: rNode,
            targetEntityId: sNode,
            relationshipType: 'western_rules_sign',
            chartFrame: 'western_tropical',
            methodology: 'western_tropical',
            sourceItem: ev,
            sourceModule: 'k04:western_tropical',
            attributes: { sign, traditionalRuler: ruler },
          });
          if (STANDARD_GRAHA_LIST.has(ev.subject.id)) {
            addEdge({
              sourceEntityId: pNode,
              targetEntityId: rNode,
              family: 'dependency',
              relationshipType: 'western_traditional_sign_dispositor',
              chartFrame: 'western_tropical',
              methodology: 'western_tropical',
              sourceItems: [ev],
              sourceModule: 'k04:western_tropical',
              attributes: {
                sign,
                traditionalRuler: ruler,
                isSelfDisposited: ev.subject.id === ruler,
              },
            });
          }
        }
      }
      if (house !== null) {
        const hNode = ensureHouseNode('western_tropical', house, [ev.evidenceId], 'West_H');
        addEdge({
          sourceEntityId: pNode,
          targetEntityId: hNode,
          family: 'occupancy',
          relationshipType: 'occupies_placidus_house',
          chartFrame: 'western_tropical',
          methodology: 'western_tropical',
          sourceItems: [ev],
          sourceModule: 'k04:western_tropical',
          attributes: { sign, house },
        });
      }
      continue;
    }

    // J. Western Geometric & Declination Aspects + Sidereal Chart Aspects
    if (
      (code === 'WESTERN_GEOMETRIC_ASPECT' ||
        code === 'WESTERN_DECLINATION_ASPECT' ||
        code === 'SIDEREAL_PLANETARY_ASPECT') &&
      (ev.frame === 'western_tropical' || ev.frame === 'vedic_lahiri')
    ) {
      const targetRef = ev.relatedEntities[0];
      if (!targetRef) continue;
      const chartFrame: NigChartFrame = ev.frame;
      const methodology: NigEdgeMethodology =
        ev.frame === 'western_tropical' ? 'western_tropical' : 'vedic_parashari';
      const relType: NigTypedRelationshipName =
        code === 'WESTERN_GEOMETRIC_ASPECT'
          ? 'western_geometric_aspect'
          : code === 'WESTERN_DECLINATION_ASPECT'
          ? 'western_declination_aspect'
          : 'sidereal_chart_aspect';

      const srcNode = ensurePlanetOrBodyNode(ev.subject.id, ev.subject.name, [ev.evidenceId], chartFrame);
      const tgtNode = ensurePlanetOrBodyNode(targetRef.id, targetRef.name, [ev.evidenceId], chartFrame);
      const aspLabel = strMetric(ev, 'aspect_name') ?? strMetric(ev, 'aspect_type') ?? ev.observation.label;

      addEdge({
        sourceEntityId: srcNode,
        targetEntityId: tgtNode,
        family: 'aspect',
        relationshipType: relType,
        chartFrame,
        methodology,
        sourceItems: [ev],
        sourceModule: 'k04:aspects',
        qualifier: `${aspLabel}_${ev.evidenceId.slice(0, 10)}`,
        attributes: {
          aspectName: aspLabel,
          orbDeg: numMetric(ev, 'orb_deg'),
          aspectDegrees: numMetric(ev, 'aspect_degrees'),
          applyingOrMovement: strMetric(ev, 'applying_or_movement'),
        },
      });
      continue;
    }

    // K. Panchadha Maitri (Compatibility)
    if (code === 'PANCHADHA_MAITRI_PAIR' && ev.frame === 'vedic_lahiri') {
      const targetRef = ev.relatedEntities[0];
      if (!targetRef) continue;
      const srcNode = ensurePlanetOrBodyNode(ev.subject.id, ev.subject.name, [ev.evidenceId]);
      const tgtNode = ensurePlanetOrBodyNode(targetRef.id, targetRef.name, [ev.evidenceId]);
      addEdge({
        sourceEntityId: srcNode,
        targetEntityId: tgtNode,
        family: 'compatibility',
        relationshipType: 'panchadha_maitri_compound',
        chartFrame: 'vedic_lahiri',
        methodology: 'vedic_parashari',
        sourceItems: [ev],
        sourceModule: 'k04:compatibility',
        attributes: {
          compoundRelation: strMetric(ev, 'compound_relation'),
          compoundScore: numMetric(ev, 'compound_score'),
          naturalRelation: strMetric(ev, 'natural_relation'),
          tatkalikaHouseFromSource: numMetric(ev, 'tatkalika_house_from_source'),
          tatkalikaIsFriend: boolMetric(ev, 'tatkalika_is_friend'),
        },
      });
      continue;
    }

    // L. Operating Condition Modifications (Retrograde, Combustion, Vargottama, Gandanta, Graha Yuddha)
    if (code === 'VEDIC_PLANET_OPERATING_CONDITIONS' && ev.frame === 'vedic_lahiri') {
      const isRetro = boolMetric(ev, 'is_retrograde');
      if (isRetro === true) {
        const pNode = ensurePlanetOrBodyNode(ev.subject.id, ev.subject.name, [ev.evidenceId]);
        addEdge({
          sourceEntityId: pNode,
          targetEntityId: pNode,
          family: 'modification',
          relationshipType: 'retrogression_cheshta_modification',
          chartFrame: 'vedic_lahiri',
          methodology: 'vedic_parashari',
          sourceItems: [ev],
          sourceModule: 'k04:modifications',
          attributes: { isRetrograde: true },
        });
      }
      continue;
    }

    if (code === 'MODIFIER_COMBUSTION_ASTA' && ev.frame === 'vedic_lahiri') {
      const sunNode = ensurePlanetOrBodyNode('Sun', 'Sun', [ev.evidenceId]);
      const pNode = ensurePlanetOrBodyNode(ev.subject.id, ev.subject.name, [ev.evidenceId]);
      addEdge({
        sourceEntityId: sunNode,
        targetEntityId: pNode,
        family: 'modification',
        relationshipType: 'solar_combustion_modifies_planet',
        chartFrame: 'vedic_lahiri',
        methodology: 'vedic_parashari',
        sourceItems: [ev],
        sourceModule: 'k04:modifications',
        attributes: {
          sunSeparationDeg: numMetric(ev, 'sun_separation_deg'),
          combustionOrbDeg: numMetric(ev, 'combustion_orb_deg'),
          isRetrograde: boolMetric(ev, 'is_retrograde'),
        },
      });
      continue;
    }

    if (code === 'MODIFIER_VARGOTTAMA' && ev.frame === 'vedic_lahiri') {
      const pNode = ensurePlanetOrBodyNode(ev.subject.id, ev.subject.name, [ev.evidenceId]);
      addEdge({
        sourceEntityId: pNode,
        targetEntityId: pNode,
        family: 'modification',
        relationshipType: 'vargottama_self_reinforcement',
        chartFrame: 'vedic_lahiri',
        methodology: 'vedic_parashari',
        sourceItems: [ev],
        sourceModule: 'k04:modifications',
        attributes: {
          isVargottama: true,
          sign: strMetric(ev, 'sign'),
        },
      });
      continue;
    }

    if (code === 'MODIFIER_GANDANTA_JUNCTION' && ev.frame === 'vedic_lahiri') {
      const pNode = ensurePlanetOrBodyNode(ev.subject.id, ev.subject.name, [ev.evidenceId]);
      addEdge({
        sourceEntityId: pNode,
        targetEntityId: pNode,
        family: 'modification',
        relationshipType: 'gandanta_boundary_modification',
        chartFrame: 'vedic_lahiri',
        methodology: 'vedic_parashari',
        sourceItems: [ev],
        sourceModule: 'k04:modifications',
        attributes: {
          isGandanta: true,
          degreeInSign: numMetric(ev, 'degree_in_sign'),
        },
      });
      continue;
    }

    if (code === 'MODIFIER_GRAHA_YUDDHA' && ev.frame === 'vedic_lahiri') {
      const pA = ev.subject.id;
      const pB = ev.relatedEntities[0]?.id;
      if (!pB) continue;
      const winner = strMetric(ev, 'winner');
      const loser = strMetric(ev, 'loser');
      const srcId = winner && (winner === pA || winner === pB) ? winner : pA;
      const tgtId = srcId === pA ? pB : pA;
      const srcNode = ensurePlanetOrBodyNode(srcId, srcId, [ev.evidenceId]);
      const tgtNode = ensurePlanetOrBodyNode(tgtId, tgtId, [ev.evidenceId]);

      addEdge({
        sourceEntityId: srcNode,
        targetEntityId: tgtNode,
        family: 'modification',
        relationshipType: 'graha_yuddha_planetary_war',
        chartFrame: 'vedic_lahiri',
        methodology: 'vedic_parashari',
        sourceItems: [ev],
        sourceModule: 'k04:modifications',
        attributes: {
          separationDeg: numMetric(ev, 'separation_deg'),
          winner,
          loser,
          determinationBasis: strMetric(ev, 'determination_basis'),
        },
      });
      continue;
    }

    // M. Jaimini Chara Karaka Functional Role
    if (code === 'JAIMINI_CHARA_KARAKA' && ev.frame === 'vedic_lahiri') {
      const role = strMetric(ev, 'karaka_role');
      if (!role) continue;
      const pNode = ensurePlanetOrBodyNode(ev.subject.id, ev.subject.name, [ev.evidenceId]);
      const roleSlug = role.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const roleNodeId = upsertNode({
        entityId: `registered_functional_role:jaimini:${roleSlug}`,
        entityType: 'registered_functional_role',
        label: `Jaimini ${role}`,
        chartFrame: 'vedic_lahiri',
        subjectRef: role,
        metadata: { tradition: 'jaimini', karakaRole: role },
        sourceEvidenceIds: [ev.evidenceId],
      });
      addEdge({
        sourceEntityId: pNode,
        targetEntityId: roleNodeId,
        family: 'functional_relationship',
        relationshipType: 'jaimini_chara_karaka_role',
        chartFrame: 'vedic_lahiri',
        methodology: 'jaimini',
        sourceItems: [ev],
        sourceModule: 'k04:jaimini_functional',
        attributes: {
          karakaRole: role,
          degreeInSign: numMetric(ev, 'degree_in_sign'),
        },
      });
      continue;
    }
  }

  // --------------------------------------------------------------------------
  // Pass 2: Materialize Aggregated Governance Edges & Derived Within-Frame Structural Edges
  // --------------------------------------------------------------------------
  for (const gov of pendingGovernanceEdges.values()) {
    addEdge({
      sourceEntityId: gov.sourceEntityId,
      targetEntityId: gov.targetEntityId,
      family: 'governance',
      relationshipType: gov.relationshipType,
      chartFrame: gov.chartFrame,
      methodology: gov.methodology,
      sourceItems: gov.sourceItems,
      sourceModule: gov.sourceModule,
      attributes: gov.attributes,
    });
  }

  // 2a. D1 Sign Conjunctions & Parashari Graha Drishti (Vedic Lahiri)
  const d1PlanetsBySign = new Map<string, Array<{ planet: string; item: CanonicalEvidenceObject }>>();
  const d1PlanetsByHouse = new Map<number, Array<{ planet: string; item: CanonicalEvidenceObject }>>();

  for (const [planet, entry] of d1PlacementsByPlanet.entries()) {
    const sBucket = d1PlanetsBySign.get(entry.sign) ?? [];
    sBucket.push({ planet, item: entry.item });
    d1PlanetsBySign.set(entry.sign, sBucket);

    if (entry.house !== null) {
      const hBucket = d1PlanetsByHouse.get(entry.house) ?? [];
      hBucket.push({ planet, item: entry.item });
      d1PlanetsByHouse.set(entry.house, hBucket);
    }
  }

  for (const [sign, occupants] of d1PlanetsBySign.entries()) {
    if (occupants.length < 2) continue;
    for (let i = 0; i < occupants.length; i++) {
      for (let j = 0; j < occupants.length; j++) {
        if (i === j) continue;
        const a = occupants[i];
        const b = occupants[j];
        const aNode = ensurePlanetOrBodyNode(a.planet, a.planet, [a.item.evidenceId]);
        const bNode = ensurePlanetOrBodyNode(b.planet, b.planet, [b.item.evidenceId]);
        addEdge({
          sourceEntityId: aNode,
          targetEntityId: bNode,
          family: 'association',
          relationshipType: 'conjunct_in_d1_rashi_sign',
          chartFrame: 'vedic_lahiri',
          methodology: 'vedic_parashari',
          sourceItems: [a.item, b.item],
          extraRuleReferences: ['BPHS_RASHI_YUTI_ASSOCIATION'],
          sourceModule: 'k04:d1_association',
          attributes: { sign },
        });
      }
    }
  }

  for (const [planet, entry] of d1PlacementsByPlanet.entries()) {
    if (entry.house === null || !STANDARD_GRAHA_LIST.has(planet)) continue;
    const srcNode = ensurePlanetOrBodyNode(planet, planet, [entry.item.evidenceId]);
    const aspectTargets = computeParashariAspectedHouses(planet, entry.house);

    for (const target of aspectTargets) {
      const targetHNode = ensureHouseNode('vedic_lahiri', target.house, [entry.item.evidenceId], 'H');
      addEdge({
        sourceEntityId: srcNode,
        targetEntityId: targetHNode,
        family: 'aspect',
        relationshipType: 'parashari_house_drishti',
        chartFrame: 'vedic_lahiri',
        methodology: 'vedic_parashari',
        sourceItems: [entry.item],
        extraRuleReferences: ['BPHS_GRAHA_DRISHTI'],
        sourceModule: 'k04:parashari_drishti',
        qualifier: `${target.drishtiType}_H${target.house}`,
        attributes: {
          sourceHouse: entry.house,
          targetHouse: target.house,
          drishtiType: target.drishtiType,
        },
      });

      const houseOccupants = d1PlanetsByHouse.get(target.house) ?? [];
      for (const occ of houseOccupants) {
        if (occ.planet === planet) continue;
        const tgtNode = ensurePlanetOrBodyNode(occ.planet, occ.planet, [occ.item.evidenceId]);
        addEdge({
          sourceEntityId: srcNode,
          targetEntityId: tgtNode,
          family: 'aspect',
          relationshipType: 'parashari_graha_drishti',
          chartFrame: 'vedic_lahiri',
          methodology: 'vedic_parashari',
          sourceItems: [entry.item, occ.item],
          extraRuleReferences: ['BPHS_GRAHA_DRISHTI'],
          sourceModule: 'k04:parashari_drishti',
          qualifier: `${target.drishtiType}_to_${occ.planet}`,
          attributes: {
            sourceHouse: entry.house,
            targetHouse: target.house,
            drishtiType: target.drishtiType,
          },
        });
      }
    }
  }

  // 2b. Divisional Sign Conjunctions (strictly within each `vedic_lahiri:<DIV>`)
  for (const [division, rows] of divisionalPlacementsByDiv.entries()) {
    const divFrame: NigChartFrame = `vedic_lahiri:${division}`;
    const bySign = new Map<string, typeof rows>();
    for (const r of rows) {
      const arr = bySign.get(r.sign) ?? [];
      arr.push(r);
      bySign.set(r.sign, arr);
    }
    for (const [sign, group] of bySign.entries()) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length; i++) {
        for (let j = 0; j < group.length; j++) {
          if (i === j) continue;
          const a = group[i];
          const b = group[j];
          const aNode = ensurePlanetOrBodyNode(a.subjectId, a.subjectId, [a.item.evidenceId]);
          const bNode = ensurePlanetOrBodyNode(b.subjectId, b.subjectId, [b.item.evidenceId]);
          addEdge({
            sourceEntityId: aNode,
            targetEntityId: bNode,
            family: 'association',
            relationshipType: 'conjunct_in_divisional_sign',
            chartFrame: divFrame,
            methodology: 'vedic_parashari',
            sourceItems: [a.item, b.item],
            extraRuleReferences: [`BPHS_VARGA_${division}_CONJUNCTION`],
            sourceModule: 'k04:divisional_association',
            attributes: { division, sign },
          });
        }
      }
    }
  }

  // 2c. Western Tropical Sign Conjunctions
  const westBySign = new Map<string, Array<{ planet: string; item: CanonicalEvidenceObject }>>();
  for (const [planet, entry] of westernPlacementsByPlanet.entries()) {
    if (!entry.sign) continue;
    const arr = westBySign.get(entry.sign) ?? [];
    arr.push({ planet, item: entry.item });
    westBySign.set(entry.sign, arr);
  }
  for (const [sign, group] of westBySign.entries()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = 0; j < group.length; j++) {
        if (i === j) continue;
        const a = group[i];
        const b = group[j];
        const aNode = ensurePlanetOrBodyNode(a.planet, a.planet, [a.item.evidenceId], 'western_tropical');
        const bNode = ensurePlanetOrBodyNode(b.planet, b.planet, [b.item.evidenceId], 'western_tropical');
        addEdge({
          sourceEntityId: aNode,
          targetEntityId: bNode,
          family: 'association',
          relationshipType: 'conjunct_in_tropical_sign',
          chartFrame: 'western_tropical',
          methodology: 'western_tropical',
          sourceItems: [a.item, b.item],
          extraRuleReferences: ['WESTERN_CO_SIGN_OCCUPANCY'],
          sourceModule: 'k04:western_association',
          attributes: { sign },
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // Pass 3: Configuration Entities & Participant Structures (NO K05/K07 Adjudication)
  // --------------------------------------------------------------------------
  const configurationParticipants: ConfigurationParticipantRecord[] = [];
  const d9Rows = divisionalPlacementsByDiv.get('D9') ?? [];
  const d9BySubject = new Map(d9Rows.map((r) => [r.subjectId, r]));

  for (const ev of natalEvidence) {
    if (ev.temporalScope !== 'natal_invariant') continue;
    const code = ev.observation.code;

    if (
      code !== 'VEDIC_YOGA_CONFIGURATION' &&
      code !== 'JAIMINI_YOGA_CONFIGURATION' &&
      code !== 'PARIVARTANA_MUTUAL_EXCHANGE' &&
      code !== 'DOSHA_EVALUATION' &&
      code !== 'WESTERN_ASPECT_CONFIGURATION' &&
      code !== 'WESTERN_STELLIUM'
    ) {
      continue;
    }

    let cfgKind: ConfigurationKind;
    let cfgFrame: NigChartFrame = ev.frame;
    let cfgEntityKey = ev.subject.id;
    let cfgLabel = ev.subject.name;
    let isPresent: boolean | null = boolMetric(ev, 'is_present');
    let isCancelled: boolean | null = boolMetric(ev, 'is_cancelled');
    const methodology = mapMethodology(ev.methodology.tradition);
    const participantMembers: Array<{ entityId: string; entityType: NigEntityType; name: string; sourceRoleLabel: string | null }> = [];
    const sharedDependencies: string[] = [];
    const qualificationConditions: string[] = [];

    if (code === 'PARIVARTANA_MUTUAL_EXCHANGE') {
      const div = (strMetric(ev, 'division') ?? 'D1').toUpperCase();
      cfgKind = 'parivartana_exchange';
      cfgFrame = div === 'D1' ? 'vedic_lahiri' : `vedic_lahiri:${div}`;
      const pA = ev.subject.id;
      const pB = ev.relatedEntities[0]?.id;
      if (!pB) continue;
      cfgEntityKey = `Parivartana_${div}_${pA}_${pB}`;
      cfgLabel = ev.observation.label;
      isPresent = true;

      const nodeA = ensurePlanetOrBodyNode(pA, pA, [ev.evidenceId]);
      const nodeB = ensurePlanetOrBodyNode(pB, pB, [ev.evidenceId]);
      participantMembers.push(
        { entityId: nodeA, entityType: 'planet', name: pA, sourceRoleLabel: 'parivartana_planet_a' },
        { entityId: nodeB, entityType: 'planet', name: pB, sourceRoleLabel: 'parivartana_planet_b' }
      );
      const signA = normalizeSign(strMetric(ev, 'sign_a'));
      const signB = normalizeSign(strMetric(ev, 'sign_b'));
      if (signA) sharedDependencies.push(`sign:${cfgFrame}:${signA}`);
      if (signB) sharedDependencies.push(`sign:${cfgFrame}:${signB}`);
      const pType = strMetric(ev, 'parivartana_type');
      if (pType) qualificationConditions.push(`parivartana_type:${pType}`);
    } else {
      if (code === 'VEDIC_YOGA_CONFIGURATION') cfgKind = 'parashari_yoga';
      else if (code === 'JAIMINI_YOGA_CONFIGURATION') cfgKind = 'jaimini_yoga';
      else if (code === 'DOSHA_EVALUATION') cfgKind = 'dosha';
      else if (code === 'WESTERN_STELLIUM') cfgKind = 'western_stellium';
      else cfgKind = 'western_aspect_configuration';

      for (const rel of ev.relatedEntities) {
        const pNode = ensurePlanetOrBodyNode(rel.id, rel.name, [ev.evidenceId], cfgFrame);
        participantMembers.push({
          entityId: pNode,
          entityType: pNode.startsWith('ascendant:') ? 'ascendant' : 'planet',
          name: rel.name,
          sourceRoleLabel: rel.role ?? 'participating_planet',
        });
      }

      if (code === 'WESTERN_STELLIUM') {
        isPresent = true;
        const stSign = normalizeSign(strMetric(ev, 'sign'));
        const stHouse = numMetric(ev, 'house');
        if (stSign) sharedDependencies.push(`sign:western_tropical:${stSign}`);
        if (stHouse !== null) sharedDependencies.push(`house:western_tropical:West_H${stHouse}`);
      }
      if (ev.ruleReference.citation) {
        qualificationConditions.push(ev.ruleReference.citation);
      }
      const category = strMetric(ev, 'category');
      if (category) qualificationConditions.push(`category:${category}`);
    }

    const cfgEntityId = upsertNode({
      entityId: `configuration:${cfgEntityKey}`,
      entityType: 'configuration',
      label: cfgLabel,
      chartFrame: cfgFrame,
      subjectRef: cfgEntityKey,
      metadata: {
        configurationType: cfgKind,
        isPresent,
        isCancelled,
      },
      sourceEvidenceIds: [ev.evidenceId],
    });

    const requiredParticipants: ConfigurationParticipantMember[] = participantMembers.map((m) => ({
      ...m,
      role: 'required',
    }));

    configurationParticipants.push({
      configurationEntityId: cfgEntityId,
      configurationType: cfgKind,
      name: cfgLabel,
      chartFrame: cfgFrame,
      methodology,
      isPresent,
      isCancelled,
      requiredParticipants,
      alternativeParticipants: [],
      supportingParticipants: [],
      modifyingParticipants: [],
      sharedDependencies,
      qualificationConditions,
      originalEvidenceIds: [ev.evidenceId],
      ruleReferences: [ev.ruleReference.referenceCode],
      adjudicationStatus: 'participants_mapped_interaction_deferred_to_k05_k07',
      deferredInteractionNote:
        'Participant entities and preconditions mapped cleanly; cancellation, fructification, and interaction strength adjudication deferred to K05/K07.',
    });

    for (const member of requiredParticipants) {
      addEdge({
        sourceEntityId: member.entityId,
        targetEntityId: cfgEntityId,
        family: 'configuration_participation',
        relationshipType: 'participates_in_configuration',
        chartFrame: cfgFrame,
        methodology,
        sourceItems: [ev],
        sourceModule: 'k04:configuration_participation',
        qualifier: `${cfgEntityKey}_${member.role}`,
        attributes: {
          configurationType: cfgKind,
          participantRole: member.role,
          sourceRoleLabel: member.sourceRoleLabel,
          isPresent,
          isCancelled,
          adjudicationStatus: 'participants_mapped_interaction_deferred_to_k05_k07',
        },
        deferredCapabilityNote: 'K05/K07 configuration interaction & cancellation adjudication deferred.',
      });

      if (cfgKind === 'dosha') {
        addEdge({
          sourceEntityId: cfgEntityId,
          targetEntityId: member.entityId,
          family: 'modification',
          relationshipType: 'dosha_modification_factor',
          chartFrame: cfgFrame,
          methodology,
          sourceItems: [ev],
          sourceModule: 'k04:dosha_modification',
          qualifier: `${cfgEntityKey}_modifies_${member.entityId}`,
          attributes: {
            doshaName: cfgLabel,
            isPresent,
            isCancelled,
          },
          deferredCapabilityNote: 'K05/K07 dosha cancellation adjudication deferred.',
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // Pass 4: Cross-Frame Bridges (D1 <-> D9 Vargottama & Placement, Vedic D1 <-> Western Tropical)
  // --------------------------------------------------------------------------
  for (const [planet, d1Entry] of d1PlacementsByPlanet.entries()) {
    const d9Entry = d9BySubject.get(planet);
    if (d9Entry) {
      const pNode = ensurePlanetOrBodyNode(planet, planet, [d1Entry.item.evidenceId, d9Entry.item.evidenceId]);
      const isVargottama = d1Entry.sign === d9Entry.sign;
      addEdge({
        sourceEntityId: pNode,
        targetEntityId: d9Entry.placementNodeId,
        family: 'cross_frame_relationship',
        relationshipType: isVargottama
          ? 'vargottama_d1_d9_sign_alignment'
          : 'cross_frame_d1_d9_placement_bridge',
        chartFrame: 'cross_frame',
        methodology: 'vedic_parashari',
        sourceItems: [d1Entry.item, d9Entry.item],
        extraRuleReferences: isVargottama ? ['BPHS_VARGOTTAMA'] : ['BPHS_D1_D9_CROSS_FRAME'],
        sourceModule: 'k04:cross_frame_d1_d9',
        attributes: {
          d1Sign: d1Entry.sign,
          d9Sign: d9Entry.sign,
          d9Dignity: d9Entry.dignity,
          isVargottama,
        },
      });
    }

    const westEntry = westernPlacementsByPlanet.get(planet);
    if (westEntry?.sign) {
      const d1SignNode = ensureSignNode('vedic_lahiri', d1Entry.sign, [d1Entry.item.evidenceId]);
      const westSignNode = ensureSignNode('western_tropical', westEntry.sign, [westEntry.item.evidenceId]);
      addEdge({
        sourceEntityId: d1SignNode,
        targetEntityId: westSignNode,
        family: 'cross_frame_relationship',
        relationshipType: 'vedic_d1_vs_western_tropical_zodiac_bridge',
        chartFrame: 'cross_frame',
        methodology: 'cross_tradition',
        sourceItems: [d1Entry.item, westEntry.item],
        extraRuleReferences: ['CROSS_TRADITION_SIDEREAL_VS_TROPICAL'],
        sourceModule: 'k04:cross_frame_zodiac',
        qualifier: planet,
        attributes: {
          planet,
          vedicD1Sign: d1Entry.sign,
          westernTropicalSign: westEntry.sign,
          sameSignInBothZodiacs: d1Entry.sign === westEntry.sign,
        },
      });
    }
  }

  // --------------------------------------------------------------------------
  // Pass 5: Optional K03 Registered Functional Orientation Links (`registered_functional_role`)
  // --------------------------------------------------------------------------
  if (options?.k03Result) {
    const k03 = options.k03Result;
    for (const profile of Object.values(k03.functionalOrientationProfiles)) {
      if (profile.status === 'unevaluated' || profile.role === 'unevaluated') continue;
      const lagnaSign = profile.lagnaSign ?? d1AscSignItem.sign;
      const lagnaAuthIds =
        k03.planetaryAuthorityEnrichment[profile.subject]?.lagnaAuthority?.supportingEvidenceIds ?? [];
      const evItems = lagnaAuthIds
        .map((id) => natalEvidenceById.get(id))
        .filter((e): e is CanonicalEvidenceObject => Boolean(e));
      if (evItems.length === 0 && d1AscSignItem.item) {
        evItems.push(d1AscSignItem.item);
      }
      if (evItems.length === 0) {
        const pPlacement = d1PlacementsByPlanet.get(profile.subject)?.item;
        if (pPlacement) evItems.push(pPlacement);
      }
      if (evItems.length === 0) continue;

      const pNode = ensurePlanetOrBodyNode(
        profile.subject,
        profile.subject,
        evItems.map((e) => e.evidenceId)
      );
      const roleEntityId = `registered_functional_role:vedic_lahiri:${lagnaSign ?? 'unknown'}:${profile.subject}:${profile.role}`;
      upsertNode({
        entityId: roleEntityId,
        entityType: 'registered_functional_role',
        label: `${profile.subject} (${profile.role} for ${lagnaSign ?? 'Lagna'} Lagna)`,
        chartFrame: 'vedic_lahiri',
        subjectRef: profile.role,
        metadata: {
          lagnaSign: lagnaSign ?? null,
          functionalRole: profile.role,
          naturalPolarity: profile.naturalSignifications.naturalPolarity,
          ownedHouses: profile.directHouseLordships.ruledHouses.join(','),
        },
        sourceEvidenceIds: evItems.map((e) => e.evidenceId),
      });

      addEdge({
        sourceEntityId: pNode,
        targetEntityId: roleEntityId,
        family: 'functional_relationship',
        relationshipType: 'registered_lagna_functional_role',
        chartFrame: 'vedic_lahiri',
        methodology: 'vedic_parashari',
        sourceItems: evItems,
        extraRuleReferences: profile.ruleId ? [profile.ruleId] : [],
        sourceModule: 'k04:k03_functional_orientation',
        attributes: {
          lagnaSign: lagnaSign ?? null,
          functionalRole: profile.role,
          naturalPolarity: profile.naturalSignifications.naturalPolarity,
          ownedHouses: profile.directHouseLordships.ruledHouses.map(String),
        },
      });
    }
  }

  // --------------------------------------------------------------------------
  // Pass 6: Evidence Lineage Edges (`evidence_lineage` connecting natal `evidence_object`s)
  // --------------------------------------------------------------------------
  for (const linEdge of repo.lineageGraph?.edges ?? []) {
    const childEv = natalEvidenceById.get(linEdge.childEvidenceId);
    const parentEv = natalEvidenceById.get(linEdge.parentEvidenceId);
    if (!childEv || !parentEv) continue;

    const childNodeId = upsertNode({
      entityId: `evidence_object:${childEv.evidenceId}`,
      entityType: 'evidence_object',
      label: childEv.observation.label,
      chartFrame: childEv.frame,
      subjectRef: childEv.evidenceId,
      metadata: {
        observationCode: childEv.observation.code,
        family: childEv.family,
        frame: childEv.frame,
      },
      sourceEvidenceIds: [childEv.evidenceId],
    });
    const parentNodeId = upsertNode({
      entityId: `evidence_object:${parentEv.evidenceId}`,
      entityType: 'evidence_object',
      label: parentEv.observation.label,
      chartFrame: parentEv.frame,
      subjectRef: parentEv.evidenceId,
      metadata: {
        observationCode: parentEv.observation.code,
        family: parentEv.family,
        frame: parentEv.frame,
      },
      sourceEvidenceIds: [parentEv.evidenceId],
    });

    const edgeFrame: NigChartFrame =
      childEv.frame === parentEv.frame ? childEv.frame : 'cross_frame';

    addEdge({
      sourceEntityId: childNodeId,
      targetEntityId: parentNodeId,
      family: 'evidence_lineage',
      relationshipType: 'derived_from_evidence',
      chartFrame: edgeFrame,
      methodology: mapMethodology(childEv.methodology.tradition),
      sourceItems: [childEv, parentEv],
      sourceModule: 'k04:evidence_lineage',
      qualifier: linEdge.edgeId,
      attributes: {
        lineageRelationship: linEdge.relationship,
        derivedFromMetrics: [...linEdge.derivedFromMetrics],
        childFrame: childEv.frame,
        parentFrame: parentEv.frame,
      },
    });
  }

  // --------------------------------------------------------------------------
  // Pass 7: Materialize Adjacency Indexes, Frame Projections & Verification Stats
  // --------------------------------------------------------------------------
  const nodes = Array.from(nodeMap.values()).sort((a, b) => a.entityId.localeCompare(b.entityId));
  const edges = Array.from(edgeMap.values()).sort((a, b) =>
    a.relationshipId.localeCompare(b.relationshipId)
  );

  const nodesById: Record<string, NigEntityNode> = {};
  const outgoingEdgeIdsByEntity: Record<string, string[]> = {};
  const incomingEdgeIdsByEntity: Record<string, string[]> = {};

  for (const n of nodes) {
    nodesById[n.entityId] = n;
    outgoingEdgeIdsByEntity[n.entityId] = [];
    incomingEdgeIdsByEntity[n.entityId] = [];
  }

  const edgesById: Record<string, NigRelationshipEdge> = {};
  const edgeIdsByFamily = {} as Record<NigRelationshipFamily, string[]>;
  const countsByFamily = emptyFamilyCounts();
  for (const fam of NIG_RELATIONSHIP_FAMILIES) {
    edgeIdsByFamily[fam] = [];
  }
  const edgeIdsByFrame: Record<string, string[]> = {};
  const countsByFrame: Record<string, number> = {};
  const projectionsByFrame: Record<string, NigFrameProjectionSummary> = {};

  let danglingEndpointCount = 0;

  for (const edge of edges) {
    edgesById[edge.relationshipId] = edge;
    if (!nodesById[edge.sourceEntityId] || !nodesById[edge.targetEntityId]) {
      danglingEndpointCount += 1;
    }
    if (!outgoingEdgeIdsByEntity[edge.sourceEntityId]) {
      outgoingEdgeIdsByEntity[edge.sourceEntityId] = [];
    }
    if (!incomingEdgeIdsByEntity[edge.targetEntityId]) {
      incomingEdgeIdsByEntity[edge.targetEntityId] = [];
    }
    outgoingEdgeIdsByEntity[edge.sourceEntityId].push(edge.relationshipId);
    incomingEdgeIdsByEntity[edge.targetEntityId].push(edge.relationshipId);

    edgeIdsByFamily[edge.family].push(edge.relationshipId);
    countsByFamily[edge.family] += 1;

    if (!edgeIdsByFrame[edge.chartFrame]) {
      edgeIdsByFrame[edge.chartFrame] = [];
      countsByFrame[edge.chartFrame] = 0;
      projectionsByFrame[edge.chartFrame] = {
        chartFrame: edge.chartFrame,
        edgeCount: 0,
        edgeIds: [],
        countsByFamily: {},
      };
    }
    edgeIdsByFrame[edge.chartFrame].push(edge.relationshipId);
    countsByFrame[edge.chartFrame] += 1;
    const frameProj = projectionsByFrame[edge.chartFrame];
    frameProj.edgeCount += 1;
    frameProj.edgeIds.push(edge.relationshipId);
    frameProj.countsByFamily[edge.family] = (frameProj.countsByFamily[edge.family] ?? 0) + 1;

    for (const refId of edge.originalEvidenceIds) {
      if (!natalEvidenceById.has(refId)) {
        unresolvedEvidenceRefCount += 1;
      }
    }
  }

  const functionalEdgeIds = [...edgeIdsByFamily.functional_relationship];
  const registeredRoleCount = nodes.filter(
    (n) => n.entityType === 'registered_functional_role'
  ).length;

  return {
    schemaVersion: K04_NIG_SCHEMA_VERSION,
    engineVersion: K04_RELATIONAL_ENGINE_VERSION,
    generatedAtUtc: new Date().toISOString(),
    sourceInputFingerprint: repo.sourceChart.inputFingerprint,
    chartIdHash,
    nodes,
    edges,
    nodesById,
    edgesById,
    outgoingEdgeIdsByEntity,
    incomingEdgeIdsByEntity,
    edgeIdsByFamily,
    edgeIdsByFrame,
    projectionsByFrame,
    configurationParticipants: configurationParticipants.sort((a, b) =>
      a.configurationEntityId.localeCompare(b.configurationEntityId)
    ),
    projections: {
      natal: {
        projectionType: 'natal',
        status: 'implemented',
        entityIds: nodes.map((n) => n.entityId),
        edgeIds: edges.map((e) => e.relationshipId),
        countsByFamily: { ...countsByFamily },
        temporalEvidenceExcludedCount: (repo.temporalEvidence ?? []).length,
        blockedFramesOmitted: Array.from(blockedFramesSet),
        note: 'Canonical natal-invariant Natal Intelligence Graph with strict chart-frame isolation and zero temporal/private context mixing.',
      },
      functional_domain: {
        projectionType: 'functional_domain',
        status: 'partial_functional_roles_only',
        edgeIds: functionalEdgeIds,
        registeredFunctionalRoleCount: registeredRoleCount,
        domainScoringDeferredTo: 'K08',
        note: 'Includes registered functional-role relationships (`registered_lagna_functional_role`, `jaimini_chara_karaka_role`) only; full domain importance/scoring is deferred to K08.',
      },
      temporal: {
        projectionType: 'temporal',
        status: 'deferred_to_k09',
        edgeIds: [],
        excludedTemporalEvidenceCount: (repo.temporalEvidence ?? []).length,
        note: 'Temporal dasha, transit, and progression activation relationships are explicitly deferred to K09 and never mixed into the natal projection.',
      },
      private_investigative_contextual: {
        projectionType: 'private_investigative_contextual',
        status: 'deferred_and_isolated',
        edgeIds: [],
        note: 'Private life context and investigative hypotheses remain strictly isolated from the canonical natal projection.',
      },
    },
    blockedFrameNotices,
    verificationStats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      duplicateIdCount,
      unresolvedEvidenceRefCount,
      danglingEndpointCount,
      countsByFamily,
      countsByFrame,
      temporalRelationshipEdgeCount: countsByFamily.temporal_relationship,
      privateContextEdgeCount: 0,
    },
  };
}
