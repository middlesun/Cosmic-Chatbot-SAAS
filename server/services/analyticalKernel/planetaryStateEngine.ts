/**
 * CosmicCouncil Proprietary Analytical Intelligence Kernel — K02 Planetary State Engine
 *
 * Pure TypeScript / Web-standard implementation (zero Node built-ins; Cloudflare Workers safe).
 * Executes versioned, explicitly registered K02 rules from `ruleRegistry.ts` across all 10
 * planetary subjects (`Sun`..`Ketu`, `Ascendant`) and dimensions `P01`–`P10`:
 *  - Enforces strict temporal isolation (rejects `reference_date_dependent` items in `natalEvidence`)
 *  - Enforces `strictNonProvisional` gating and blocked-frame propagation
 *  - Prevents fabricated Shadbala for Nodes/Ascendant, Asta on Sun/Nodes/Ascendant,
 *    Graha Yuddha on Luminaries/Nodes/Ascendant, universal retrogression bonuses, and
 *    silent D9 debilitation cancellation
 *  - Emits qualified `EvidenceImpactObject[]` linked to K01 `overlapRelations`
 *  - Produces explicit Conflict, Modification, and Reliability Overlays per subject
 */

import {
  createEvidenceImpactContract,
  EvidenceValidationError,
  sha256Hex,
} from './lineage';
import {
  assertRegisteredRule,
  evaluateRuleMathModel,
} from './ruleRegistry';
import {
  ANALYTICAL_RULE_REGISTRY_VERSION,
  K02_STATE_ENGINE_VERSION,
  PHI_READY_PLANETS,
  PLANETARY_STATE_DIMENSIONS,
  PLANETARY_STATE_SUBJECTS,
  type AnalyticalEvidenceRepository,
  type AnalyticalRuleDefinition,
  type CanonicalEvidenceFrame,
  type CanonicalEvidenceObject,
  type ComputationalVerificationStatus,
  type ConflictOverlay,
  type ConflictOverlayItem,
  type EvidenceImpactDirection,
  type EvidenceImpactInteractionType,
  type EvidenceImpactMagnitude,
  type EvidenceImpactObject,
  type EvidenceImpactOverlapMetadata,
  type K02ConfidenceCeiling,
  type K02NormalizedSignal,
  type K02PlanetaryDimensionEvaluation,
  type K02SubjectStateRecord,
  type MethodologicalVerificationStatus,
  type ModificationOverlay,
  type ModificationOverlayItem,
  type PlanetaryStateDimensionName,
  type PlanetaryStateObservation,
  type PlanetaryStateSubjectName,
  type PropagatedTrustLevel,
  type ReliabilityOverlay,
  type RuleExecutionOutcomeStatus,
  type RuleExecutionRecord,
  type RuleExecutionSummary,
} from './types';

export interface EvaluateK02PlanetaryStatesOptions {
  strictNonProvisional?: boolean;
}

export interface EvaluateK02PlanetaryStatesOutput {
  engineVersion: typeof K02_STATE_ENGINE_VERSION;
  registryVersion: typeof ANALYTICAL_RULE_REGISTRY_VERSION;
  generatedAtUtc: string;
  sourceInputFingerprint: string;
  strictNonProvisional: boolean;
  subjectStates: Record<PlanetaryStateSubjectName, K02SubjectStateRecord>;
  k02ImpactContracts: EvidenceImpactObject[];
  ruleExecutionSummary: RuleExecutionSummary;
  overlapMetadataByEvidenceId: Record<string, EvidenceImpactOverlapMetadata>;
}

function isSubjectName(raw: string): raw is PlanetaryStateSubjectName {
  return (PLANETARY_STATE_SUBJECTS as readonly string[]).includes(raw);
}

function getSubjectCategory(
  subject: PlanetaryStateSubjectName
): K02SubjectStateRecord['subjectCategory'] {
  if ((PHI_READY_PLANETS as readonly string[]).includes(subject)) {
    return 'classical_seven_planet';
  }
  if (subject === 'Rahu' || subject === 'Ketu') return 'lunar_node';
  return 'ascendant';
}

function getMetric(
  item: CanonicalEvidenceObject,
  metricName: string
): { value: number | string | boolean | null; unit: string | null } | null {
  const m = item.measurements.find((x) => x.metric === metricName);
  if (!m || m.value === null || m.value === undefined || m.value === '') return null;
  return { value: m.value, unit: m.unit };
}

function numMetric(item: CanonicalEvidenceObject | undefined, metricName: string): number | null {
  if (!item) return null;
  const v = getMetric(item, metricName)?.value;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function strMetric(item: CanonicalEvidenceObject | undefined, metricName: string): string | null {
  if (!item) return null;
  const v = getMetric(item, metricName)?.value;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function boolMetric(item: CanonicalEvidenceObject | undefined, metricName: string): boolean | null {
  if (!item) return null;
  const v = getMetric(item, metricName)?.value;
  return typeof v === 'boolean' ? v : null;
}

function normToken(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function buildOverlapMetadataIndex(
  repo: AnalyticalEvidenceRepository
): Record<string, EvidenceImpactOverlapMetadata> {
  const byId: Record<string, EvidenceImpactOverlapMetadata> = {};
  const allEvidence = [...repo.natalEvidence, ...repo.temporalEvidence];

  // Build connected components for exact_duplicate and partial_mathematical_overlap
  // so mathematically overlapping evidence (e.g., Shadbala total + subcomponents;
  // BAV + Prastara + Shodhana) shares a single deterministic overlapGroupId.
  const adjacency = new Map<string, Set<string>>();
  const notesById = new Map<string, string[]>();
  const highestStatusById = new Map<
    string,
    EvidenceImpactOverlapMetadata['independenceStatus']
  >();

  const rankStatus = (s: EvidenceImpactOverlapMetadata['independenceStatus']): number => {
    switch (s) {
      case 'exact_duplicate':
        return 3;
      case 'partial_overlap':
        return 2;
      case 'shared_upstream':
        return 1;
      default:
        return 0;
    }
  };

  const upgradeStatus = (
    id: string,
    candidate: EvidenceImpactOverlapMetadata['independenceStatus'],
    note: string
  ) => {
    const prev = highestStatusById.get(id) ?? 'independent';
    if (rankStatus(candidate) > rankStatus(prev)) {
      highestStatusById.set(id, candidate);
    }
    const notes = notesById.get(id) ?? [];
    if (!notes.includes(note)) notes.push(note);
    notesById.set(id, notes);
  };

  for (const rel of repo.lineageGraph.overlapRelations) {
    if (rel.overlapType === 'exact_duplicate') {
      if (!adjacency.has(rel.evidenceIdA)) adjacency.set(rel.evidenceIdA, new Set());
      if (!adjacency.has(rel.evidenceIdB)) adjacency.set(rel.evidenceIdB, new Set());
      adjacency.get(rel.evidenceIdA)!.add(rel.evidenceIdB);
      adjacency.get(rel.evidenceIdB)!.add(rel.evidenceIdA);
      upgradeStatus(rel.evidenceIdA, 'exact_duplicate', rel.rationale);
      upgradeStatus(rel.evidenceIdB, 'exact_duplicate', rel.rationale);
    } else if (rel.overlapType === 'partial_mathematical_overlap') {
      if (!adjacency.has(rel.evidenceIdA)) adjacency.set(rel.evidenceIdA, new Set());
      if (!adjacency.has(rel.evidenceIdB)) adjacency.set(rel.evidenceIdB, new Set());
      adjacency.get(rel.evidenceIdA)!.add(rel.evidenceIdB);
      adjacency.get(rel.evidenceIdB)!.add(rel.evidenceIdA);
      upgradeStatus(rel.evidenceIdA, 'partial_overlap', rel.rationale);
      upgradeStatus(rel.evidenceIdB, 'partial_overlap', rel.rationale);
    } else if (rel.overlapType === 'shared_upstream_dependency') {
      upgradeStatus(rel.evidenceIdA, 'shared_upstream', rel.rationale);
      upgradeStatus(rel.evidenceIdB, 'shared_upstream', rel.rationale);
    } else if (rel.overlapType === 'distinct_analytical_significance') {
      // Preserved as distinct analytical significance (not collapsed); note shared upstream if any
      const notesA = notesById.get(rel.evidenceIdA) ?? [];
      if (!notesA.includes('distinct_analytical_significance')) {
        notesA.push('distinct_analytical_significance');
        notesById.set(rel.evidenceIdA, notesA);
      }
      const notesB = notesById.get(rel.evidenceIdB) ?? [];
      if (!notesB.includes('distinct_analytical_significance')) {
        notesB.push('distinct_analytical_significance');
        notesById.set(rel.evidenceIdB, notesB);
      }
    }
  }

  // Assign deterministic group IDs for connected mathematical overlap components
  const visited = new Set<string>();
  const groupIdByEvidence = new Map<string, string>();
  for (const startId of adjacency.keys()) {
    if (visited.has(startId)) continue;
    const component: string[] = [];
    const stack = [startId];
    visited.add(startId);
    while (stack.length > 0) {
      const cur = stack.pop()!;
      component.push(cur);
      for (const nxt of adjacency.get(cur) ?? []) {
        if (!visited.has(nxt)) {
          visited.add(nxt);
          stack.push(nxt);
        }
      }
    }
    component.sort();
    const groupId = `ovg_${sha256Hex(component.join('|')).slice(0, 16)}`;
    for (const id of component) {
      groupIdByEvidence.set(id, groupId);
    }
  }

  for (const item of allEvidence) {
    byId[item.evidenceId] = {
      overlapGroupId: groupIdByEvidence.get(item.evidenceId) ?? null,
      independenceStatus: highestStatusById.get(item.evidenceId) ?? 'independent',
      notes: (notesById.get(item.evidenceId) ?? []).slice(0, 4),
    };
  }

  return byId;
}

interface PartitionedSubjectEvidence {
  direct: CanonicalEvidenceObject[];
  related: CanonicalEvidenceObject[];
  all: CanonicalEvidenceObject[];
}

function partitionEvidenceBySubject(
  natalEvidence: CanonicalEvidenceObject[]
): Record<PlanetaryStateSubjectName, PartitionedSubjectEvidence> {
  const result = {} as Record<PlanetaryStateSubjectName, PartitionedSubjectEvidence>;
  for (const subject of PLANETARY_STATE_SUBJECTS) {
    result[subject] = { direct: [], related: [], all: [] };
  }

  const pushUnique = (arr: CanonicalEvidenceObject[], item: CanonicalEvidenceObject) => {
    if (!arr.some((x) => x.evidenceId === item.evidenceId)) {
      arr.push(item);
    }
  };

  for (const item of natalEvidence) {
    if (item.temporalScope === 'reference_date_dependent') {
      throw new EvidenceValidationError(
        `Temporal scope violation in K02: evidence "${item.evidenceId}" (${item.observation.code}) has temporalScope="reference_date_dependent" inside natalEvidence.`
      );
    }

    if (
      (item.subject.type === 'planet' || item.subject.type === 'ascendant') &&
      isSubjectName(item.subject.id)
    ) {
      const bucket = result[item.subject.id];
      pushUnique(bucket.direct, item);
      pushUnique(bucket.all, item);
    }

    // Related-entity participations (house lordships, mutual exchanges, war opponents, active doshas)
    if (
      item.observation.code === 'VEDIC_D1_HOUSE_LORD_PLACEMENT' ||
      item.observation.code === 'PARIVARTANA_MUTUAL_EXCHANGE' ||
      item.observation.code === 'MODIFIER_GRAHA_YUDDHA' ||
      item.observation.code === 'DOSHA_EVALUATION'
    ) {
      for (const rel of item.relatedEntities) {
        if (isSubjectName(rel.id) && rel.id !== item.subject.id) {
          const bucket = result[rel.id];
          pushUnique(bucket.related, item);
          pushUnique(bucket.all, item);
        }
      }
    }
  }

  return result;
}

function pickBestVimshopaka(items: CanonicalEvidenceObject[]): CanonicalEvidenceObject | undefined {
  const candidates = items.filter((e) => e.observation.code === 'VIMSHOPAKA_BALA_SCHEME');
  if (candidates.length === 0) return undefined;
  const rank = (e: CanonicalEvidenceObject): number => {
    const scheme = normToken(strMetric(e, 'scheme'));
    if (scheme === 'shodashavarga' || scheme === 'shodashvarga') return 4;
    if (scheme === 'dashavarga') return 3;
    if (scheme === 'saptavarga') return 2;
    if (scheme === 'shadvarga') return 1;
    return 0;
  };
  return [...candidates].sort((a, b) => rank(b) - rank(a))[0];
}

function createEmptyK02Dimension(
  dimension: PlanetaryStateDimensionName,
  status: K02PlanetaryDimensionEvaluation['status'],
  deferredCapability: K02PlanetaryDimensionEvaluation['deferredCapability'],
  summary: string,
  deferredToK03ToK08: string[] = []
): K02PlanetaryDimensionEvaluation {
  return {
    dimension,
    status,
    deferredCapability,
    summary,
    signals: [],
    supportedEvidenceIds: [],
    impactIds: [],
    ruleIdsExecuted: [],
    directObservations: [],
    deferredToK03ToK08,
    limitations: [],
  };
}

function createDirectObs(
  item: CanonicalEvidenceObject,
  key: string,
  value: number | string | boolean | null,
  unit: string | null = null
): PlanetaryStateObservation | null {
  if (value === null || value === undefined || value === '') return null;
  return {
    key,
    value,
    unit,
    sourceEvidenceId: item.evidenceId,
    trust: item.verification.propagatedTrust,
  };
}

export function evaluateK02PlanetaryStates(
  repo: AnalyticalEvidenceRepository,
  options: EvaluateK02PlanetaryStatesOptions = {}
): EvaluateK02PlanetaryStatesOutput {
  const strictNonProvisional = options.strictNonProvisional === true;
  const partitioned = partitionEvidenceBySubject(repo.natalEvidence);
  const overlapMetadataByEvidenceId = buildOverlapMetadataIndex(repo);

  const blockedIncompatibleFrames = new Set<CanonicalEvidenceFrame>();
  const blockedNoticesByDataset = new Map<string, { status: string; reason: string }>();
  for (const notice of repo.rejectedOrBlockedFrames) {
    if (notice.canonicalStatus === 'incompatible') {
      blockedIncompatibleFrames.add(notice.frame);
    }
    blockedNoticesByDataset.set(notice.datasetKey, {
      status: notice.canonicalStatus,
      reason: notice.reason,
    });
  }

  const allK02Impacts: EvidenceImpactObject[] = [];
  const allRuleExecutions: RuleExecutionRecord[] = [];
  const subjectStates = {} as Record<PlanetaryStateSubjectName, K02SubjectStateRecord>;

  const countsByStatus: Record<RuleExecutionOutcomeStatus, number> = {
    applied: 0,
    partially_applied: 0,
    not_applicable: 0,
    blocked_missing_inputs: 0,
    blocked_incompatible_frame: 0,
    excluded_by_provisional_gate: 0,
  };

  for (const subject of PLANETARY_STATE_SUBJECTS) {
    const subjectCategory = getSubjectCategory(subject);
    const bucket = partitioned[subject];
    const direct = bucket.direct;
    const allSubjectItems = bucket.all;
    const subjectImpacts: EvidenceImpactObject[] = [];
    const subjectExecutions: RuleExecutionRecord[] = [];

    const dimensions = {} as Record<PlanetaryStateDimensionName, K02PlanetaryDimensionEvaluation>;
    for (const dimName of PLANETARY_STATE_DIMENSIONS) {
      if (dimName === 'authority') {
        dimensions[dimName] = createEmptyK02Dimension(
          dimName,
          'deferred_to_downstream',
          'K03',
          'Deferred to K03 Structural & Lagna Authority (no Lagna-lordship scoring in K02).',
          ['K03: Lagna-specific house lordship authority, Kendra/Trikona/Dusthana placement authority']
        );
      } else if (dimName === 'functionalOrientation') {
        dimensions[dimName] = createEmptyK02Dimension(
          dimName,
          'deferred_to_downstream',
          'K03',
          'Deferred to K03 Functional Orientation (no premature functional benefic/malefic verdicts in K02).',
          ['K03: Lagna-specific functional benefic, functional malefic, and Yogakaraka classification']
        );
      } else if (dimName === 'deliverability') {
        dimensions[dimName] = createEmptyK02Dimension(
          dimName,
          'deferred_to_downstream',
          'K08',
          'Deferred to K08 Deliverability Intelligence (KP sub-lord, Bhava Chalit confirmation, and timing).',
          ['K08: KP Sub-Lord promise confirmation, Chalit verification, and domain deliverability']
        );
      } else if (dimName === 'resilience') {
        dimensions[dimName] = createEmptyK02Dimension(
          dimName,
          'deferred_to_downstream',
          'K05',
          'Composite resilience deferred to K05/K07; factual recovery preconditions preserved only.',
          ['K05/K07: Interaction recovery, Neecha-Bhanga adjudication, and combustion mitigation']
        );
      } else {
        dimensions[dimName] = createEmptyK02Dimension(
          dimName,
          'blocked_missing_inputs',
          null,
          `Pending K02 rule evaluation for ${dimName}.`
        );
      }
    }

    // Carry forward K01 directObservations cleanly so no observed K01 telemetry is lost
    const k01Mirror = repo.planetaryStates[subject];
    if (k01Mirror) {
      for (const dimName of PLANETARY_STATE_DIMENSIONS) {
        dimensions[dimName].directObservations = [...k01Mirror.dimensions[dimName].directObservations];
        for (const eid of k01Mirror.dimensions[dimName].supportedEvidenceIds) {
          if (!dimensions[dimName].supportedEvidenceIds.includes(eid)) {
            dimensions[dimName].supportedEvidenceIds.push(eid);
          }
        }
      }
    }

    const pushDirectObsToDim = (
      dimName: PlanetaryStateDimensionName,
      item: CanonicalEvidenceObject,
      key: string,
      value: number | string | boolean | null,
      unit: string | null = null
    ) => {
      const obs = createDirectObs(item, key, value, unit);
      if (!obs) return;
      const dim = dimensions[dimName];
      if (!dim.directObservations.some((x) => x.key === obs.key && x.sourceEvidenceId === obs.sourceEvidenceId)) {
        dim.directObservations.push(obs);
      }
      if (!dim.supportedEvidenceIds.includes(item.evidenceId)) {
        dim.supportedEvidenceIds.push(item.evidenceId);
      }
    };

    const recordExecution = (params: {
      rule: AnalyticalRuleDefinition;
      status: RuleExecutionOutcomeStatus;
      sourceEvidenceIds: string[];
      emittedImpactIds?: string[];
      missingInputs?: string[];
      provisionalDependencies?: string[];
      mathOutputSummary?: string | null;
      numericalResult?: number | null;
      reason: string;
    }): RuleExecutionRecord => {
      const execKey = `${params.rule.ruleId}@${params.rule.version}:${subject}:${params.status}:${params.sourceEvidenceIds.join(',')}`;
      const rec: RuleExecutionRecord = {
        executionId: `rex_${sha256Hex(execKey).slice(0, 20)}`,
        ruleId: params.rule.ruleId,
        ruleVersion: params.rule.version,
        subject,
        targetDimension: params.rule.targetDimension,
        status: params.status,
        outcome: params.status,
        sourceEvidenceIds: Array.from(new Set(params.sourceEvidenceIds)),
        emittedImpactIds: Array.from(new Set(params.emittedImpactIds ?? [])),
        missingInputs: Array.from(new Set(params.missingInputs ?? [])),
        provisionalDependencies: Array.from(new Set(params.provisionalDependencies ?? [])),
        mathModelId: params.rule.mathModel.modelId,
        mathOutputSummary: params.mathOutputSummary ?? null,
        numericalResult: params.numericalResult ?? null,
        reason: params.reason,
      };
      subjectExecutions.push(rec);
      allRuleExecutions.push(rec);
      countsByStatus[params.status] += 1;

      if (
        params.rule.targetDimension !== 'overlay_conflict' &&
        params.rule.targetDimension !== 'overlay_modification' &&
        params.rule.targetDimension !== 'overlay_reliability' &&
        params.rule.targetDimension !== 'nodal_condition_profile' &&
        params.rule.targetDimension !== 'ascendant_condition_profile' &&
        params.rule.targetDimension !== 'phi_projection'
      ) {
        const dim = dimensions[params.rule.targetDimension];
        if (!dim.ruleIdsExecuted.includes(params.rule.ruleId)) {
          dim.ruleIdsExecuted.push(params.rule.ruleId);
        }
      }
      return rec;
    };

    const emitImpactAndSignal = (params: {
      rule: AnalyticalRuleDefinition;
      dimension: PlanetaryStateDimensionName;
      evidence: CanonicalEvidenceObject;
      signalKey: string;
      label: string;
      rawValue: number | string | boolean | null;
      rawUnit: string | null;
      normalizedValue: number | null;
      normalizedUnit: string | null;
      qualitativeClass: string | null;
      direction: EvidenceImpactDirection;
      interactionType: EvidenceImpactInteractionType;
      magnitude: EvidenceImpactMagnitude;
      applicabilityConditions?: string[];
      modifierEvidenceIds?: string[];
    }): { impact: EvidenceImpactObject; signal: K02NormalizedSignal } => {
      const ovMeta: EvidenceImpactOverlapMetadata = overlapMetadataByEvidenceId[
        params.evidence.evidenceId
      ] ?? {
        overlapGroupId: null,
        independenceStatus: 'independent',
        notes: [],
      };

      const impact = createEvidenceImpactContract({
        evidenceId: params.evidence.evidenceId,
        analyticalTarget: {
          type: subject === 'Ascendant' ? 'ascendant' : 'planet',
          id: subject,
          name: subject,
        },
        affectedDimension: params.dimension,
        direction: params.direction,
        magnitude: params.magnitude,
        applicabilityConditions: [
          `rule:${params.rule.ruleId}@${params.rule.version}`,
          `frame:${params.evidence.frame}`,
          `trust:${params.evidence.verification.propagatedTrust}`,
          ...(params.applicabilityConditions ?? []),
        ],
        interactionType: params.interactionType,
        modifierEvidenceIds: params.modifierEvidenceIds ?? [],
        overlapMetadata: ovMeta,
        impactQualifier: `${params.rule.ruleId}:${params.signalKey}`,
      });

      subjectImpacts.push(impact);
      allK02Impacts.push(impact);

      const signal: K02NormalizedSignal = {
        signalKey: params.signalKey,
        ruleId: params.rule.ruleId,
        ruleVersion: params.rule.version,
        frame: params.evidence.frame,
        label: params.label,
        rawValue: params.rawValue,
        rawUnit: params.rawUnit,
        normalizedValue: params.normalizedValue,
        normalizedUnit: params.normalizedUnit,
        qualitativeClass: params.qualitativeClass,
        direction: params.direction,
        trust: params.evidence.verification.propagatedTrust,
        sourceEvidenceIds: [params.evidence.evidenceId],
        impactId: impact.impactId,
        overlapStatus: ovMeta.independenceStatus,
        citationCode: params.rule.citation.referenceCode,
      };

      const dim = dimensions[params.dimension];
      dim.signals.push(signal);
      if (!dim.impactIds.includes(impact.impactId)) dim.impactIds.push(impact.impactId);
      if (!dim.supportedEvidenceIds.includes(params.evidence.evidenceId)) {
        dim.supportedEvidenceIds.push(params.evidence.evidenceId);
      }

      return { impact, signal };
    };

    const gateItems = (
      rule: AnalyticalRuleDefinition,
      candidates: CanonicalEvidenceObject[],
      datasetKeyHint?: string
    ): {
      proceed: boolean;
      accepted: CanonicalEvidenceObject[];
      provisionalIds: string[];
      blockedReason?: { status: 'blocked_missing_inputs' | 'blocked_incompatible_frame' | 'excluded_by_provisional_gate'; reason: string; missingInputs: string[] };
    } => {
      const nonBlocked = candidates.filter((e) => e.verification.propagatedTrust !== 'blocked');
      const blockedOnly = candidates.filter((e) => e.verification.propagatedTrust === 'blocked');
      const provisional = nonBlocked.filter((e) => e.verification.propagatedTrust === 'provisional');
      const usable = nonBlocked.filter((e) => e.verification.propagatedTrust === 'usable');

      if (candidates.length === 0) {
        const blockedInfo = datasetKeyHint ? blockedNoticesByDataset.get(datasetKeyHint) : undefined;
        const frameIncompatible = rule.requiredFrames.some((f) => blockedIncompatibleFrames.has(f));
        if (blockedInfo?.status === 'incompatible' || frameIncompatible) {
          return {
            proceed: false,
            accepted: [],
            provisionalIds: [],
            blockedReason: {
              status: 'blocked_incompatible_frame',
              reason: `Blocked due to incompatible dataset/frame (${datasetKeyHint ?? rule.requiredFrames.join(', ')}): ${
                blockedInfo?.reason ?? 'frame marked incompatible in rejectedOrBlockedFrames'
              }`,
              missingInputs: [datasetKeyHint ?? rule.requiredObservationCodes[0] ?? rule.ruleId],
            },
          };
        }
        return {
          proceed: false,
          accepted: [],
          provisionalIds: [],
          blockedReason: {
            status: 'blocked_missing_inputs',
            reason: `Missing required K01 evidence (${rule.requiredObservationCodes.join(', ') || datasetKeyHint || 'unknown'}) for ${subject}.`,
            missingInputs: rule.requiredObservationCodes.length
              ? [...rule.requiredObservationCodes]
              : [datasetKeyHint ?? rule.ruleId],
          },
        };
      }

      if (nonBlocked.length === 0 && blockedOnly.length > 0) {
        return {
          proceed: false,
          accepted: [],
          provisionalIds: [],
          blockedReason: {
            status: 'blocked_incompatible_frame',
            reason: `All matching evidence for ${rule.ruleId} on ${subject} carries propagatedTrust="blocked".`,
            missingInputs: blockedOnly.map((b) => b.observation.code),
          },
        };
      }

      if (strictNonProvisional && usable.length === 0 && provisional.length > 0) {
        return {
          proceed: false,
          accepted: [],
          provisionalIds: provisional.map((p) => p.evidenceId),
          blockedReason: {
            status: 'excluded_by_provisional_gate',
            reason: `Excluded by strictNonProvisional gate: ${rule.ruleId} on ${subject} depends solely on provisional evidence.`,
            missingInputs: [],
          },
        };
      }

      const accepted = strictNonProvisional ? usable : nonBlocked;
      return {
        proceed: true,
        accepted,
        provisionalIds: strictNonProvisional ? [] : provisional.map((p) => p.evidenceId),
      };
    };

    // Convenient direct lookups for subject
    const vedicDegItem = direct.find(
      (e) =>
        e.observation.code === 'VEDIC_D1_PLANET_LONGITUDE' ||
        e.observation.code === 'VEDIC_D1_ASCENDANT_LONGITUDE'
    );
    const vedicPosItem = direct.find(
      (e) =>
        e.observation.code === 'VEDIC_D1_SIGN_HOUSE_PLACEMENT' ||
        e.observation.code === 'VEDIC_D1_ASCENDANT_SIGN'
    );
    const chalitItem = direct.find((e) => e.observation.code === 'BHAVA_CHALIT_HOUSE_PLACEMENT');
    const kpPosItem = direct.find((e) => e.observation.code === 'KP_PLACIDUS_HOUSE_PLACEMENT');
    const kpSubItem = direct.find((e) => e.observation.code === 'KP_PLANET_SUB_LORDS');
    const kpSigItem = direct.find((e) => e.observation.code === 'KP_FOUR_LEVEL_SIGNIFICATORS');
    const westPosItem = direct.find((e) => e.observation.code === 'WESTERN_TROPICAL_PLACEMENT');
    const telemetryItem = direct.find((e) => e.observation.code === 'ASTRONOMICAL_BODY_TELEMETRY');
    const d1DignityItem = direct.find((e) => e.observation.code === 'VEDIC_D1_DIGNITY');
    const westDignityItem = direct.find((e) => e.observation.code === 'WESTERN_ESSENTIAL_DIGNITY');
    const d9Item = direct.find(
      (e) => e.observation.code === 'VEDIC_VARGA_PLACEMENT' && strMetric(e, 'division') === 'D9'
    );
    const vargottamaModItem = direct.find((e) => e.observation.code === 'MODIFIER_VARGOTTAMA');
    const condItem = direct.find((e) => e.observation.code === 'VEDIC_PLANET_OPERATING_CONDITIONS');
    const combustModItem = direct.find((e) => e.observation.code === 'MODIFIER_COMBUSTION_ASTA');
    const gandantaModItem = direct.find((e) => e.observation.code === 'MODIFIER_GANDANTA_JUNCTION');
    const dispItem = direct.find((e) => e.observation.code === 'VEDIC_D1_DISPOSITOR_DEPENDENCY');
    const parivartanaItems = allSubjectItems.filter(
      (e) => e.observation.code === 'PARIVARTANA_MUTUAL_EXCHANGE'
    );
    const yuddhaModItems = allSubjectItems.filter(
      (e) => e.observation.code === 'MODIFIER_GRAHA_YUDDHA'
    );
    const activeDoshaItems = allSubjectItems.filter(
      (e) => e.observation.code === 'DOSHA_EVALUATION' && boolMetric(e, 'is_present') === true
    );
    const avasthaItem = direct.find((e) => e.observation.code === 'VEDIC_ADVANCED_AVASTHAS');
    const d5ProvItem = direct.find((e) => e.observation.code === 'VEDIC_VARGA_D5_PROVISIONAL');

    // =========================================================================
    // P01: CAPACITY (7 Classical Planets ONLY; Rahu/Ketu/Ascendant -> not_applicable)
    // =========================================================================
    {
      const capRules: Array<{ ruleId: string; datasetHint: string; obsCode: string }> = [
        { ruleId: 'K02_CAPACITY_SHADBALA_RUPA_RATIO', datasetHint: 'shadbala_major_6', obsCode: 'SHADBALA_MAJOR_SIX_BALA' },
        { ruleId: 'K02_CAPACITY_BAV_STRENGTH', datasetHint: 'ashtakavarga_bav_sav_prastara', obsCode: 'ASHTAKAVARGA_BHINNA_BAV' },
        { ruleId: 'K02_CAPACITY_VIMSHOPAKA_TIER', datasetHint: 'vimshopaka_bala', obsCode: 'VIMSHOPAKA_BALA_SCHEME' },
        { ruleId: 'K02_CAPACITY_ISHTA_KASHTA_BALANCE', datasetHint: 'ishta_kashta_phala', obsCode: 'ISHTA_KASHTA_PHALA' },
      ];

      let capEvaluated = 0;
      let capPartial = 0;

      for (const spec of capRules) {
        const rule = assertRegisteredRule(spec.ruleId);
        if (!rule.applicableSubjects.includes(subject)) {
          recordExecution({
            rule,
            status: 'not_applicable',
            sourceEvidenceIds: [],
            reason: `${rule.ruleId} is strictly restricted to the 7 classical planets; excluded for ${subject} (no fabricated Shadbala/BAV).`,
          });
          continue;
        }

        const candidates =
          spec.obsCode === 'VIMSHOPAKA_BALA_SCHEME'
            ? (() => {
                const best = pickBestVimshopaka(direct);
                return best ? [best] : [];
              })()
            : direct.filter((e) => e.observation.code === spec.obsCode);

        const gate = gateItems(rule, candidates, spec.datasetHint);
        if (!gate.proceed || gate.accepted.length === 0) {
          recordExecution({
            rule,
            status: gate.blockedReason!.status,
            sourceEvidenceIds: [],
            missingInputs: gate.blockedReason!.missingInputs,
            provisionalDependencies: gate.provisionalIds,
            reason: gate.blockedReason!.reason,
          });
          continue;
        }

        const ev = gate.accepted[0];
        if (spec.ruleId === 'K02_CAPACITY_SHADBALA_RUPA_RATIO') {
          const totalRupas = numMetric(ev, 'total_rupas');
          const res = evaluateRuleMathModel(rule.mathModel.modelId, totalRupas, { planet: subject });
          if (!res.valid || res.normalizedValue === null) {
            recordExecution({
              rule,
              status: 'blocked_missing_inputs',
              sourceEvidenceIds: [ev.evidenceId],
              missingInputs: ['total_rupas'],
              provisionalDependencies: gate.provisionalIds,
              reason: res.reason,
            });
            continue;
          }
          const dir: EvidenceImpactDirection =
            res.normalizedValue >= 1.0 ? 'supporting' : 'constraining';
          const { impact } = emitImpactAndSignal({
            rule,
            dimension: 'capacity',
            evidence: ev,
            signalKey: 'shadbala_bphs_rupa_ratio',
            label: `${subject} Shadbala BPHS Ratio`,
            rawValue: totalRupas,
            rawUnit: 'rupas',
            normalizedValue: res.normalizedValue,
            normalizedUnit: res.normalizedUnit,
            qualitativeClass: res.qualitativeClass,
            direction: dir,
            interactionType: 'direct',
            magnitude: {
              kind: 'justified_rule_value',
              value: res.normalizedValue,
              unit: res.normalizedUnit ?? 'bphs_threshold_ratio',
              ruleReference: `${rule.ruleId}@${rule.version}`,
            },
          });
          const status: RuleExecutionOutcomeStatus =
            gate.provisionalIds.length > 0 ? 'partially_applied' : 'applied';
          if (status === 'partially_applied') capPartial += 1;
          else capEvaluated += 1;
          recordExecution({
            rule,
            status,
            sourceEvidenceIds: [ev.evidenceId],
            emittedImpactIds: [impact.impactId],
            provisionalDependencies: gate.provisionalIds,
            mathOutputSummary: res.formulaTrace,
            numericalResult: res.normalizedValue,
            reason: res.reason,
          });
        } else if (spec.ruleId === 'K02_CAPACITY_BAV_STRENGTH') {
          const d1Sign = vedicPosItem ? strMetric(vedicPosItem, 'sign') : null;
          const natalBindus = d1Sign ? numMetric(ev, `bav_${d1Sign.toLowerCase()}`) : null;
          const res = evaluateRuleMathModel(rule.mathModel.modelId, natalBindus, { planet: subject });
          if (!res.valid || res.normalizedValue === null || natalBindus === null) {
            recordExecution({
              rule,
              status: 'blocked_missing_inputs',
              sourceEvidenceIds: [ev.evidenceId],
              missingInputs: d1Sign ? [`bav_${d1Sign.toLowerCase()}`] : ['vedic_d1_sign'],
              provisionalDependencies: gate.provisionalIds,
              reason: res.reason,
            });
            continue;
          }
          const dir: EvidenceImpactDirection =
            natalBindus > 4 ? 'supporting' : natalBindus < 4 ? 'constraining' : 'neutral';
          const { impact } = emitImpactAndSignal({
            rule,
            dimension: 'capacity',
            evidence: ev,
            signalKey: 'bav_natal_sign_bindu_deviation',
            label: `${subject} BAV (${d1Sign}) Bindus`,
            rawValue: natalBindus,
            rawUnit: 'bindus',
            normalizedValue: res.normalizedValue,
            normalizedUnit: 'bindu_midpoint_delta',
            qualitativeClass: res.qualitativeClass,
            direction: dir,
            interactionType: 'direct',
            magnitude: {
              kind: 'justified_rule_value',
              value: res.normalizedValue,
              unit: 'bindu_midpoint_delta',
              ruleReference: `${rule.ruleId}@${rule.version}`,
            },
          });
          const status: RuleExecutionOutcomeStatus =
            gate.provisionalIds.length > 0 ? 'partially_applied' : 'applied';
          if (status === 'partially_applied') capPartial += 1;
          else capEvaluated += 1;
          recordExecution({
            rule,
            status,
            sourceEvidenceIds: [ev.evidenceId],
            emittedImpactIds: [impact.impactId],
            provisionalDependencies: gate.provisionalIds,
            mathOutputSummary: res.formulaTrace,
            numericalResult: res.normalizedValue,
            reason: res.reason,
          });
        } else if (spec.ruleId === 'K02_CAPACITY_VIMSHOPAKA_TIER') {
          const score = numMetric(ev, 'score_out_of_20');
          const scheme = strMetric(ev, 'scheme') ?? 'unknown';
          const res = evaluateRuleMathModel(rule.mathModel.modelId, score, { planet: subject });
          if (!res.valid || res.normalizedValue === null) {
            recordExecution({
              rule,
              status: 'blocked_missing_inputs',
              sourceEvidenceIds: [ev.evidenceId],
              missingInputs: ['score_out_of_20'],
              provisionalDependencies: gate.provisionalIds,
              reason: res.reason,
            });
            continue;
          }
          const dir: EvidenceImpactDirection =
            res.normalizedValue >= 0.75
              ? 'supporting'
              : res.normalizedValue < 0.5
              ? 'constraining'
              : 'neutral';
          const { impact } = emitImpactAndSignal({
            rule,
            dimension: 'capacity',
            evidence: ev,
            signalKey: `vimshopaka_${normToken(scheme)}_ratio`,
            label: `${subject} Vimshopaka (${scheme})`,
            rawValue: score,
            rawUnit: 'virupas_20_scale',
            normalizedValue: res.normalizedValue,
            normalizedUnit: 'normalized_20_ratio',
            qualitativeClass: res.qualitativeClass,
            direction: dir,
            interactionType: 'direct',
            magnitude: {
              kind: 'justified_rule_value',
              value: res.normalizedValue,
              unit: 'normalized_20_ratio',
              ruleReference: `${rule.ruleId}@${rule.version}`,
            },
            applicabilityConditions: [`selected_scheme:${scheme}`],
          });
          const status: RuleExecutionOutcomeStatus =
            gate.provisionalIds.length > 0 ? 'partially_applied' : 'applied';
          if (status === 'partially_applied') capPartial += 1;
          else capEvaluated += 1;
          recordExecution({
            rule,
            status,
            sourceEvidenceIds: [ev.evidenceId],
            emittedImpactIds: [impact.impactId],
            provisionalDependencies: gate.provisionalIds,
            mathOutputSummary: res.formulaTrace,
            numericalResult: res.normalizedValue,
            reason: res.reason,
          });
        } else if (spec.ruleId === 'K02_CAPACITY_ISHTA_KASHTA_BALANCE') {
          const ishta = numMetric(ev, 'ishta_phala');
          const kashta = numMetric(ev, 'kashta_phala');
          const res = evaluateRuleMathModel(rule.mathModel.modelId, ishta, {
            planet: subject,
            kashtaPhala: kashta,
          });
          if (!res.valid || res.normalizedValue === null) {
            recordExecution({
              rule,
              status: 'blocked_missing_inputs',
              sourceEvidenceIds: [ev.evidenceId],
              missingInputs: ['ishta_phala', 'kashta_phala'],
              provisionalDependencies: gate.provisionalIds,
              reason: res.reason,
            });
            continue;
          }
          const dir: EvidenceImpactDirection =
            res.qualitativeClass === 'ishta_dominant'
              ? 'supporting'
              : res.qualitativeClass === 'kashta_dominant'
              ? 'constraining'
              : 'neutral';
          const { impact } = emitImpactAndSignal({
            rule,
            dimension: 'capacity',
            evidence: ev,
            signalKey: 'ishta_kashta_balance',
            label: `${subject} Ishta/Kashta Balance`,
            rawValue: ishta !== null && kashta !== null ? Number((ishta - kashta).toFixed(2)) : null,
            rawUnit: 'virupas',
            normalizedValue: res.normalizedValue,
            normalizedUnit: res.normalizedUnit,
            qualitativeClass: res.qualitativeClass,
            direction: dir,
            interactionType: 'direct',
            magnitude: {
              kind: 'justified_rule_value',
              value: res.normalizedValue,
              unit: res.normalizedUnit ?? 'balance_ratio',
              ruleReference: `${rule.ruleId}@${rule.version}`,
            },
          });
          const status: RuleExecutionOutcomeStatus =
            gate.provisionalIds.length > 0 ? 'partially_applied' : 'applied';
          if (status === 'partially_applied') capPartial += 1;
          else capEvaluated += 1;
          recordExecution({
            rule,
            status,
            sourceEvidenceIds: [ev.evidenceId],
            emittedImpactIds: [impact.impactId],
            provisionalDependencies: gate.provisionalIds,
            mathOutputSummary: res.formulaTrace,
            numericalResult: res.normalizedValue,
            reason: res.reason,
          });
        }
      }

      if (subjectCategory !== 'classical_seven_planet') {
        dimensions.capacity.status = 'not_applicable';
        dimensions.capacity.summary = `Quantitative Shadbala/BAV/Vimshopaka/Ishta capacity rules are not applicable to ${subject}.`;
        dimensions.capacity.limitations.push(
          'Classical planetary capacity metrics apply strictly to Sun..Saturn; never fabricated for Rahu, Ketu, or Ascendant.'
        );
      } else if (capEvaluated > 0 && capPartial === 0) {
        dimensions.capacity.status = 'evaluated';
        dimensions.capacity.summary = `Evaluated ${capEvaluated} registered K02 capacity signals for ${subject}.`;
      } else if (capEvaluated + capPartial > 0) {
        dimensions.capacity.status = 'partially_evaluated';
        dimensions.capacity.summary = `Evaluated ${capEvaluated + capPartial} capacity signals (${capPartial} provisional-capped) for ${subject}.`;
      } else {
        dimensions.capacity.status = 'blocked_missing_inputs';
        dimensions.capacity.summary = `No usable capacity inputs available for ${subject}.`;
      }
    }

    // =========================================================================
    // P02: INTEGRITY (D1 Dignity, Western Essential Dignity, D9 Reinforcement)
    // =========================================================================
    {
      let intApplied = 0;
      let intPartial = 0;

      // 2a. Vedic D1 Dignity
      {
        const rule = assertRegisteredRule('K02_INTEGRITY_D1_DIGNITY');
        if (!rule.applicableSubjects.includes(subject)) {
          recordExecution({
            rule,
            status: 'not_applicable',
            sourceEvidenceIds: [],
            reason: `${rule.ruleId} is not applicable to ${subject}.`,
          });
        } else {
          const candidates = d1DignityItem ? [d1DignityItem] : [];
          const gate = gateItems(rule, candidates, 'planetary_dignity_conditions');
          if (!gate.proceed || gate.accepted.length === 0) {
            recordExecution({
              rule,
              status: gate.blockedReason!.status,
              sourceEvidenceIds: [],
              missingInputs: gate.blockedReason!.missingInputs,
              provisionalDependencies: gate.provisionalIds,
              reason: gate.blockedReason!.reason,
            });
          } else {
            const ev = gate.accepted[0];
            const dignity = strMetric(ev, 'dignity');
            const res = evaluateRuleMathModel(rule.mathModel.modelId, dignity, { planet: subject });
            const ord = res.normalizedValue;
            const dir: EvidenceImpactDirection =
              ord !== null ? (ord > 0 ? 'supporting' : ord < 0 ? 'constraining' : 'neutral') : 'neutral';
            const { impact } = emitImpactAndSignal({
              rule,
              dimension: 'integrity',
              evidence: ev,
              signalKey: 'vedic_d1_dignity',
              label: `${subject} D1 Dignity`,
              rawValue: dignity,
              rawUnit: null,
              normalizedValue: null,
              normalizedUnit: null,
              qualitativeClass: res.qualitativeClass,
              direction: dir,
              interactionType: 'direct',
              magnitude: { kind: 'unassigned_no_arbitrary_weight' },
            });
            const status: RuleExecutionOutcomeStatus =
              gate.provisionalIds.length > 0 ? 'partially_applied' : 'applied';
            if (status === 'partially_applied') intPartial += 1;
            else intApplied += 1;
            recordExecution({
              rule,
              status,
              sourceEvidenceIds: [ev.evidenceId],
              emittedImpactIds: [impact.impactId],
              provisionalDependencies: gate.provisionalIds,
              mathOutputSummary: res.formulaTrace,
              numericalResult: ord,
              reason: res.reason,
            });
          }
        }
      }

      // 2b. Western Essential Dignity (strictly isolated to western_tropical)
      {
        const rule = assertRegisteredRule('K02_INTEGRITY_WESTERN_ESSENTIAL_DIGNITY');
        if (!rule.applicableSubjects.includes(subject)) {
          recordExecution({
            rule,
            status: 'not_applicable',
            sourceEvidenceIds: [],
            reason: `${rule.ruleId} is not applicable to ${subject}.`,
          });
        } else {
          const candidates = westDignityItem ? [westDignityItem] : [];
          const gate = gateItems(rule, candidates, 'western_essential_dignities');
          if (!gate.proceed || gate.accepted.length === 0) {
            recordExecution({
              rule,
              status: gate.blockedReason!.status,
              sourceEvidenceIds: [],
              missingInputs: gate.blockedReason!.missingInputs,
              provisionalDependencies: gate.provisionalIds,
              reason: gate.blockedReason!.reason,
            });
          } else {
            const ev = gate.accepted[0];
            const wDig = strMetric(ev, 'dignity_status');
            const res = evaluateRuleMathModel(rule.mathModel.modelId, wDig, { planet: subject });
            const ord = res.normalizedValue;
            const dir: EvidenceImpactDirection =
              ord !== null ? (ord > 0 ? 'supporting' : ord < 0 ? 'constraining' : 'neutral') : 'neutral';
            const { impact } = emitImpactAndSignal({
              rule,
              dimension: 'integrity',
              evidence: ev,
              signalKey: 'western_essential_dignity',
              label: `${subject} Western Essential Dignity`,
              rawValue: wDig,
              rawUnit: null,
              normalizedValue: null,
              normalizedUnit: null,
              qualitativeClass: res.qualitativeClass,
              direction: dir,
              interactionType: 'direct',
              magnitude: { kind: 'unassigned_no_arbitrary_weight' },
              applicabilityConditions: ['isolated_western_tropical_frame'],
            });
            const status: RuleExecutionOutcomeStatus =
              gate.provisionalIds.length > 0 ? 'partially_applied' : 'applied';
            if (status === 'partially_applied') intPartial += 1;
            else intApplied += 1;
            recordExecution({
              rule,
              status,
              sourceEvidenceIds: [ev.evidenceId],
              emittedImpactIds: [impact.impactId],
              provisionalDependencies: gate.provisionalIds,
              mathOutputSummary: res.formulaTrace,
              numericalResult: ord,
              reason: res.reason,
            });
          }
        }
      }

      // 2c. D9 Navamsa Reinforcement & Vargottama (NEVER automatic D1 cancellation)
      {
        const rule = assertRegisteredRule('K02_INTEGRITY_D9_REINFORCEMENT_AND_VARGOTTAMA');
        if (!rule.applicableSubjects.includes(subject)) {
          recordExecution({
            rule,
            status: 'not_applicable',
            sourceEvidenceIds: [],
            reason: `${rule.ruleId} is not applicable to ${subject}.`,
          });
        } else {
          const candidates = d9Item ? [d9Item] : [];
          const gate = gateItems(rule, candidates, 'vedic_d9_navamsa');
          if (!gate.proceed || gate.accepted.length === 0) {
            recordExecution({
              rule,
              status: gate.blockedReason!.status,
              sourceEvidenceIds: [],
              missingInputs: gate.blockedReason!.missingInputs,
              provisionalDependencies: gate.provisionalIds,
              reason: gate.blockedReason!.reason,
            });
          } else {
            const ev = gate.accepted[0];
            const d9Sign = strMetric(ev, 'sign');
            const d9Dignity = strMetric(ev, 'dignity');
            const d1Sign = vedicPosItem ? strMetric(vedicPosItem, 'sign') : null;
            const isVargottama =
              Boolean(vargottamaModItem) ||
              boolMetric(condItem, 'is_vargottama') === true ||
              (d1Sign !== null && d9Sign !== null && normToken(d1Sign) === normToken(d9Sign));

            const d1DigTok = normToken(strMetric(d1DignityItem, 'dignity'));
            const d9DigTok = normToken(d9Dignity);
            const d1Weak = ['debilitated', 'neecha', 'enemy', 'shatru', 'great_enemy', 'adhi_shatru'].includes(d1DigTok);
            const d9Strong = ['exalted', 'own_sign', 'swakshetra', 'moolatrikona'].includes(d9DigTok);
            const d1Strong = ['exalted', 'own_sign', 'swakshetra', 'moolatrikona'].includes(d1DigTok);
            const d9Weak = ['debilitated', 'neecha', 'enemy', 'shatru', 'great_enemy', 'adhi_shatru'].includes(d9DigTok);

            const qualInput = isVargottama
              ? 'vargottama'
              : (d1Weak && d9Strong) || (d1Strong && d9Weak)
              ? 'd1_d9_divergent'
              : d9Strong
              ? 'd9_strong'
              : d9Weak
              ? 'd9_challenged'
              : 'd9_neutral';

            const res = evaluateRuleMathModel(rule.mathModel.modelId, qualInput, { planet: subject });
            const dir: EvidenceImpactDirection = isVargottama
              ? 'supporting'
              : qualInput === 'd1_d9_divergent'
              ? 'modifying'
              : 'neutral';

            const { impact } = emitImpactAndSignal({
              rule,
              dimension: 'integrity',
              evidence: ev,
              signalKey: 'd9_reinforcement_and_vargottama',
              label: `${subject} D9 (${d9Sign ?? '?'}) Reinforcement`,
              rawValue: d9Dignity ?? d9Sign,
              rawUnit: null,
              normalizedValue: null,
              normalizedUnit: null,
              qualitativeClass: res.qualitativeClass,
              direction: dir,
              interactionType: qualInput === 'd1_d9_divergent' ? 'modifier' : 'direct',
              magnitude: { kind: 'unassigned_no_arbitrary_weight' },
              applicabilityConditions: ['no_automatic_d9_cancellation_in_k02'],
              modifierEvidenceIds: vargottamaModItem ? [vargottamaModItem.evidenceId] : [],
            });
            const status: RuleExecutionOutcomeStatus =
              gate.provisionalIds.length > 0 ? 'partially_applied' : 'applied';
            if (status === 'partially_applied') intPartial += 1;
            else intApplied += 1;
            recordExecution({
              rule,
              status,
              sourceEvidenceIds: [
                ev.evidenceId,
                ...(vargottamaModItem ? [vargottamaModItem.evidenceId] : []),
              ],
              emittedImpactIds: [impact.impactId],
              provisionalDependencies: gate.provisionalIds,
              mathOutputSummary: res.formulaTrace,
              numericalResult: null,
              reason: res.reason,
            });
          }
        }
      }

      if (subject === 'Ascendant') {
        dimensions.integrity.status = 'not_applicable';
        dimensions.integrity.summary =
          'Planetary dignity rules apply to planets; Ascendant sign/Navamsa recorded in AscendantConditionProfile.';
      } else if (intApplied > 0 && intPartial === 0) {
        dimensions.integrity.status = 'evaluated';
        dimensions.integrity.summary = `Evaluated ${intApplied} integrity rules for ${subject} without automatic D9 cancellations.`;
      } else if (intApplied + intPartial > 0) {
        dimensions.integrity.status = 'partially_evaluated';
        dimensions.integrity.summary = `Evaluated ${intApplied + intPartial} integrity rules (${intPartial} provisional-capped) for ${subject}.`;
      } else {
        dimensions.integrity.status = 'blocked_missing_inputs';
        dimensions.integrity.summary = `Integrity inputs missing or gated for ${subject}.`;
      }
      dimensions.integrity.limitations.push(
        'K02 never performs automatic D9 cancellation of D1 debilitation/affliction; divergences are surfaced in ConflictOverlay.'
      );
    }

    // =========================================================================
    // P03: STABILITY (Motion/Retrogression without +/- bonus + Chalit/Sandhi notes)
    // =========================================================================
    {
      const rule = assertRegisteredRule('K02_STABILITY_MOTION_AND_RETROGRESSION');
      if (!rule.applicableSubjects.includes(subject)) {
        recordExecution({
          rule,
          status: 'not_applicable',
          sourceEvidenceIds: [],
          reason: `${rule.ruleId} is not applicable to non-planetary point ${subject}.`,
        });
        dimensions.stability.status =
          dimensions.stability.directObservations.length > 0 ? 'observed_direct_only' : 'not_applicable';
        dimensions.stability.summary = `Kinematics not applicable to ${subject}; Sandhi/time sensitivity tracked in ReliabilityOverlay.`;
      } else {
        const candidates = condItem ? [condItem] : telemetryItem ? [telemetryItem] : [];
        const gate = gateItems(rule, candidates, 'planetary_dignity_conditions');
        if (!gate.proceed || gate.accepted.length === 0) {
          recordExecution({
            rule,
            status: gate.blockedReason!.status,
            sourceEvidenceIds: [],
            missingInputs: gate.blockedReason!.missingInputs,
            provisionalDependencies: gate.provisionalIds,
            reason: gate.blockedReason!.reason,
          });
          dimensions.stability.status =
            dimensions.stability.directObservations.length > 0
              ? 'observed_direct_only'
              : 'blocked_missing_inputs';
          dimensions.stability.summary = gate.blockedReason!.reason;
        } else {
          const ev = gate.accepted[0];
          const isRetro = boolMetric(condItem, 'is_retrograde');
          const speed = numMetric(telemetryItem, 'speed_deg_per_day');
          const res = evaluateRuleMathModel(rule.mathModel.modelId, speed, {
            planet: subject,
            isRetrograde: isRetro,
          });
          const { impact } = emitImpactAndSignal({
            rule,
            dimension: 'stability',
            evidence: ev,
            signalKey: 'kinematic_motion_state',
            label: `${subject} Kinematic Motion`,
            rawValue: speed ?? res.qualitativeClass,
            rawUnit: speed !== null ? 'deg/day' : null,
            normalizedValue: null,
            normalizedUnit: null,
            qualitativeClass: res.qualitativeClass,
            direction: isRetro ? 'modifying' : 'neutral',
            interactionType: isRetro ? 'modifier' : 'direct',
            magnitude: { kind: 'unassigned_no_arbitrary_weight' },
            applicabilityConditions: [
              'non_scalar_kinematics_no_universal_retrograde_bonus_or_penalty',
            ],
          });
          const status: RuleExecutionOutcomeStatus =
            gate.provisionalIds.length > 0 ? 'partially_applied' : 'applied';
          recordExecution({
            rule,
            status,
            sourceEvidenceIds: Array.from(
              new Set([ev.evidenceId, ...(telemetryItem ? [telemetryItem.evidenceId] : [])])
            ),
            emittedImpactIds: [impact.impactId],
            provisionalDependencies: gate.provisionalIds,
            mathOutputSummary: res.formulaTrace,
            numericalResult: null,
            reason: res.reason,
          });
          dimensions.stability.status = status === 'partially_applied' ? 'partially_evaluated' : 'evaluated';
          dimensions.stability.summary = `Motion state "${res.qualitativeClass}" evaluated non-scalarly (Chalit/Sandhi contextual stability preserved).`;
        }
      }
      dimensions.stability.limitations.push(
        'Retrogression and conjunctions never receive universal scalar bonuses/penalties in K02; contextual synthesis is deferred to K05/K07.'
      );
    }

    // =========================================================================
    // P04: AUTONOMY (Dispositor Chain Termination & Self-Disposited / Parivartana)
    // =========================================================================
    {
      const rule = assertRegisteredRule('K02_AUTONOMY_DISPOSITOR_DEPENDENCY');
      if (!rule.applicableSubjects.includes(subject)) {
        recordExecution({
          rule,
          status: 'not_applicable',
          sourceEvidenceIds: [],
          reason: `${rule.ruleId} is not applicable to ${subject} (Lagnesha structural autonomy belongs to K03).`,
        });
        dimensions.autonomy.status = 'deferred_to_downstream';
        dimensions.autonomy.deferredCapability = 'K03';
        dimensions.autonomy.summary = 'Ascendant dispositor (Lagnesha) structural authority deferred to K03.';
      } else {
        const candidates = dispItem ? [dispItem] : [];
        const gate = gateItems(rule, candidates, 'dispositor_relationships');
        if (!gate.proceed || gate.accepted.length === 0) {
          recordExecution({
            rule,
            status: gate.blockedReason!.status,
            sourceEvidenceIds: [],
            missingInputs: gate.blockedReason!.missingInputs,
            provisionalDependencies: gate.provisionalIds,
            reason: gate.blockedReason!.reason,
          });
          dimensions.autonomy.status = 'blocked_missing_inputs';
          dimensions.autonomy.summary = gate.blockedReason!.reason;
        } else {
          const ev = gate.accepted[0];
          const isSelf = boolMetric(ev, 'is_self_disposited');
          const termType = strMetric(ev, 'termination_type');
          const inParivartana = parivartanaItems.length > 0;
          const res = evaluateRuleMathModel(rule.mathModel.modelId, termType, {
            planet: subject,
            isSelfDisposited: isSelf,
            inParivartana,
          });
          const dir: EvidenceImpactDirection =
            isSelf || inParivartana ? 'supporting' : 'modifying';
          const { impact } = emitImpactAndSignal({
            rule,
            dimension: 'autonomy',
            evidence: ev,
            signalKey: 'dispositor_chain_autonomy',
            label: `${subject} Dispositor Autonomy`,
            rawValue: termType ?? (isSelf ? 'self_disposited' : 'chained'),
            rawUnit: null,
            normalizedValue: null,
            normalizedUnit: null,
            qualitativeClass: res.qualitativeClass,
            direction: dir,
            interactionType: isSelf ? 'direct' : 'conditional',
            magnitude: { kind: 'unassigned_no_arbitrary_weight' },
            modifierEvidenceIds: parivartanaItems.map((p) => p.evidenceId),
          });
          const status: RuleExecutionOutcomeStatus =
            gate.provisionalIds.length > 0 ? 'partially_applied' : 'applied';
          recordExecution({
            rule,
            status,
            sourceEvidenceIds: [
              ev.evidenceId,
              ...parivartanaItems.map((p) => p.evidenceId),
            ],
            emittedImpactIds: [impact.impactId],
            provisionalDependencies: gate.provisionalIds,
            mathOutputSummary: res.formulaTrace,
            numericalResult: res.normalizedValue,
            reason: res.reason,
          });
          dimensions.autonomy.status = status === 'partially_applied' ? 'partially_evaluated' : 'evaluated';
          dimensions.autonomy.summary = `Dispositor autonomy classified as "${res.qualitativeClass}" (sign lord: ${
            strMetric(ev, 'sign_lord') ?? '?'
          }).`;
        }
      }
    }

    // =========================================================================
    // P06: VULNERABILITY (Asta, Graha Yuddha, Gandanta/Sandhi, Kashta, Doshas)
    // =========================================================================
    {
      let vulnApplied = 0;
      let vulnPartial = 0;

      // 6a. Combustion (Asta)
      {
        const rule = assertRegisteredRule('K02_VULNERABILITY_COMBUSTION_ASTA');
        if (!rule.applicableSubjects.includes(subject)) {
          recordExecution({
            rule,
            status: 'not_applicable',
            sourceEvidenceIds: [],
            reason: `${rule.ruleId} is strictly not applicable to ${subject} (Sun/Nodes/Ascendant never undergo Asta combustion).`,
          });
        } else {
          const candidates = combustModItem
            ? [combustModItem]
            : condItem
            ? [condItem]
            : [];
          const gate = gateItems(rule, candidates, 'planetary_dignity_conditions');
          if (!gate.proceed || gate.accepted.length === 0) {
            recordExecution({
              rule,
              status: gate.blockedReason!.status,
              sourceEvidenceIds: [],
              missingInputs: gate.blockedReason!.missingInputs,
              provisionalDependencies: gate.provisionalIds,
              reason: gate.blockedReason!.reason,
            });
          } else {
            const ev = gate.accepted[0];
            const isCombust =
              ev.observation.code === 'MODIFIER_COMBUSTION_ASTA'
                ? true
                : boolMetric(ev, 'is_combust') === true;
            const sep = numMetric(ev, 'sun_separation_deg') ?? numMetric(condItem, 'sun_separation_deg');
            const orb = numMetric(ev, 'combustion_orb_deg') ?? numMetric(condItem, 'combustion_orb_deg');
            const res = evaluateRuleMathModel(rule.mathModel.modelId, sep, {
              planet: subject,
              isCombust,
              combustionOrbDeg: orb,
            });
            const hasExactOrb = isCombust && sep !== null && orb !== null && res.normalizedValue !== null;
            const { impact } = emitImpactAndSignal({
              rule,
              dimension: 'vulnerability',
              evidence: ev,
              signalKey: 'combustion_asta_status',
              label: `${subject} Combustion (Asta)`,
              rawValue: isCombust ? sep ?? true : false,
              rawUnit: isCombust && sep !== null ? 'degrees' : null,
              normalizedValue: res.normalizedValue,
              normalizedUnit: hasExactOrb ? res.normalizedUnit : null,
              qualitativeClass: res.qualitativeClass,
              direction: isCombust ? 'constraining' : 'neutral',
              interactionType: isCombust ? 'modifier' : 'direct',
              magnitude: hasExactOrb && res.normalizedValue !== null
                ? {
                    kind: 'justified_rule_value',
                    value: res.normalizedValue,
                    unit: res.normalizedUnit ?? 'orb_penetration_ratio',
                    ruleReference: `${rule.ruleId}@${rule.version}`,
                  }
                : { kind: 'unassigned_no_arbitrary_weight' },
            });
            const status: RuleExecutionOutcomeStatus =
              gate.provisionalIds.length > 0 ? 'partially_applied' : 'applied';
            if (status === 'partially_applied') vulnPartial += 1;
            else vulnApplied += 1;
            recordExecution({
              rule,
              status,
              sourceEvidenceIds: [ev.evidenceId],
              emittedImpactIds: [impact.impactId],
              provisionalDependencies: gate.provisionalIds,
              mathOutputSummary: res.formulaTrace,
              numericalResult: res.normalizedValue,
              reason: res.reason,
            });
          }
        }
      }

      // 6b. Graha Yuddha (Tara Grahas ONLY)
      {
        const rule = assertRegisteredRule('K02_VULNERABILITY_GRAHA_YUDDHA');
        if (!rule.applicableSubjects.includes(subject)) {
          recordExecution({
            rule,
            status: 'not_applicable',
            sourceEvidenceIds: [],
            reason: `${rule.ruleId} is restricted to Tara Grahas (Mars..Saturn); not applicable to ${subject}.`,
          });
        } else {
          const candidates = yuddhaModItems.length > 0 ? yuddhaModItems : condItem ? [condItem] : [];
          const gate = gateItems(rule, candidates, 'planetary_dignity_conditions');
          if (!gate.proceed || gate.accepted.length === 0) {
            recordExecution({
              rule,
              status: gate.blockedReason!.status,
              sourceEvidenceIds: [],
              missingInputs: gate.blockedReason!.missingInputs,
              provisionalDependencies: gate.provisionalIds,
              reason: gate.blockedReason!.reason,
            });
          } else {
            const ev = gate.accepted[0];
            const inWar =
              yuddhaModItems.length > 0 || boolMetric(condItem, 'in_graha_yuddha') === true;
            let role = strMetric(condItem, 'graha_yuddha_role');
            if (!role && yuddhaModItems.length > 0) {
              const winner = strMetric(yuddhaModItems[0], 'winner');
              const loser = strMetric(yuddhaModItems[0], 'loser');
              if (winner === subject) role = 'winner';
              else if (loser === subject) role = 'loser';
              else role = 'undetermined';
            }
            const res = evaluateRuleMathModel(rule.mathModel.modelId, role, {
              planet: subject,
              inGrahaYuddha: inWar,
              grahaYuddhaRole: role,
            });
            const dir: EvidenceImpactDirection = !inWar
              ? 'neutral'
              : role === 'loser'
              ? 'constraining'
              : 'modifying';
            const { impact } = emitImpactAndSignal({
              rule,
              dimension: 'vulnerability',
              evidence: ev,
              signalKey: 'graha_yuddha_status',
              label: `${subject} Graha Yuddha`,
              rawValue: inWar ? role ?? 'participant' : 'inactive',
              rawUnit: null,
              normalizedValue: null,
              normalizedUnit: null,
              qualitativeClass: res.qualitativeClass,
              direction: dir,
              interactionType: inWar ? 'modifier' : 'direct',
              magnitude: { kind: 'unassigned_no_arbitrary_weight' },
            });
            const status: RuleExecutionOutcomeStatus =
              gate.provisionalIds.length > 0 ? 'partially_applied' : 'applied';
            if (status === 'partially_applied') vulnPartial += 1;
            else vulnApplied += 1;
            recordExecution({
              rule,
              status,
              sourceEvidenceIds: [ev.evidenceId],
              emittedImpactIds: [impact.impactId],
              provisionalDependencies: gate.provisionalIds,
              mathOutputSummary: res.formulaTrace,
              numericalResult: res.normalizedValue,
              reason: res.reason,
            });
          }
        }
      }

      // 6c. Gandanta & Rashi Sandhi (All 10 subjects)
      {
        const rule = assertRegisteredRule('K02_VULNERABILITY_GANDANTA_AND_SANDHI');
        const candidates = vedicDegItem ? [vedicDegItem] : gandantaModItem ? [gandantaModItem] : [];
        const gate = gateItems(rule, candidates, 'vedic_d1_positions');
        if (!gate.proceed || gate.accepted.length === 0) {
          recordExecution({
            rule,
            status: gate.blockedReason!.status,
            sourceEvidenceIds: [],
            missingInputs: gate.blockedReason!.missingInputs,
            provisionalDependencies: gate.provisionalIds,
            reason: gate.blockedReason!.reason,
          });
        } else {
          const ev = gate.accepted[0];
          const degInSign = numMetric(vedicDegItem, 'degree_in_sign');
          const isGandanta =
            Boolean(gandantaModItem) || boolMetric(condItem, 'is_gandanta') === true;
          const res = evaluateRuleMathModel(rule.mathModel.modelId, degInSign, {
            planet: subject,
            isGandanta,
          });
          const activeBoundary = (res.normalizedValue ?? 0) > 0;
          const { impact } = emitImpactAndSignal({
            rule,
            dimension: 'vulnerability',
            evidence: ev,
            signalKey: 'gandanta_and_sandhi_risk',
            label: `${subject} Gandanta / Sandhi Gate`,
            rawValue: degInSign,
            rawUnit: degInSign !== null ? 'degrees' : null,
            normalizedValue: res.normalizedValue,
            normalizedUnit: res.normalizedUnit,
            qualitativeClass: res.qualitativeClass,
            direction: activeBoundary ? 'constraining' : 'neutral',
            interactionType: activeBoundary ? 'modifier' : 'direct',
            magnitude: { kind: 'unassigned_no_arbitrary_weight' },
            modifierEvidenceIds: gandantaModItem ? [gandantaModItem.evidenceId] : [],
          });
          const status: RuleExecutionOutcomeStatus =
            gate.provisionalIds.length > 0 ? 'partially_applied' : 'applied';
          if (status === 'partially_applied') vulnPartial += 1;
          else vulnApplied += 1;
          recordExecution({
            rule,
            status,
            sourceEvidenceIds: [
              ev.evidenceId,
              ...(gandantaModItem ? [gandantaModItem.evidenceId] : []),
            ],
            emittedImpactIds: [impact.impactId],
            provisionalDependencies: gate.provisionalIds,
            mathOutputSummary: res.formulaTrace,
            numericalResult: res.normalizedValue,
            reason: res.reason,
          });
        }
      }

      // Active Dosha participation (factual direct observation)
      for (const dosha of activeDoshaItems) {
        if (strictNonProvisional && dosha.verification.propagatedTrust === 'provisional') continue;
        pushDirectObsToDim(
          'vulnerability',
          dosha,
          `active_dosha_${normToken(dosha.subject.name)}`,
          true,
          null
        );
      }

      if (vulnApplied > 0 && vulnPartial === 0) {
        dimensions.vulnerability.status = 'evaluated';
        dimensions.vulnerability.summary = `Evaluated ${vulnApplied} vulnerability checks for ${subject}.`;
      } else if (vulnApplied + vulnPartial > 0) {
        dimensions.vulnerability.status = 'partially_evaluated';
        dimensions.vulnerability.summary = `Evaluated ${vulnApplied + vulnPartial} vulnerability checks (${vulnPartial} provisional-capped) for ${subject}.`;
      } else {
        dimensions.vulnerability.status = 'blocked_missing_inputs';
        dimensions.vulnerability.summary = `Vulnerability checks blocked or missing inputs for ${subject}.`;
      }
    }

    // =========================================================================
    // P07: RESILIENCE (Preconditions ONLY; composite resolution deferred K05/K07)
    // =========================================================================
    {
      if (vargottamaModItem) {
        pushDirectObsToDim('resilience', vargottamaModItem, 'precondition_vargottama', true);
      }
      for (const pItem of parivartanaItems) {
        const div = strMetric(pItem, 'division') ?? 'D1';
        pushDirectObsToDim(
          'resilience',
          pItem,
          `precondition_parivartana_${div}`,
          strMetric(pItem, 'parivartana_type') ?? 'exchange'
        );
      }
      if (boolMetric(dispItem, 'is_self_disposited') === true && dispItem) {
        pushDirectObsToDim('resilience', dispItem, 'precondition_self_disposited', true);
      }
      if (dimensions.resilience.directObservations.length > 0) {
        dimensions.resilience.status = 'partially_evaluated';
        dimensions.resilience.deferredCapability = 'K05';
        dimensions.resilience.summary =
          'Observed factual recovery preconditions only; composite cancellation/resilience resolution deferred to K05/K07.';
      }
      dimensions.resilience.limitations.push(
        'K02 never adjudicates final Neecha-Bhanga or affliction recovery; preconditions await K05 Interaction and K07 Conflict resolution.'
      );
    }

    // =========================================================================
    // P08: INFLUENCE FOOTPRINT (Isolated cross-frame presence, no domain scoring)
    // =========================================================================
    {
      const rule = assertRegisteredRule('K02_FOOTPRINT_CROSS_FRAME_PRESENCE');
      const candidates = vedicPosItem ? [vedicPosItem] : [];
      const gate = gateItems(rule, candidates, 'vedic_d1_positions');
      if (!gate.proceed || gate.accepted.length === 0) {
        recordExecution({
          rule,
          status: gate.blockedReason!.status,
          sourceEvidenceIds: [],
          missingInputs: gate.blockedReason!.missingInputs,
          provisionalDependencies: gate.provisionalIds,
          reason: gate.blockedReason!.reason,
        });
        dimensions.influenceFootprint.status =
          dimensions.influenceFootprint.directObservations.length > 0
            ? 'observed_direct_only'
            : 'blocked_missing_inputs';
        dimensions.influenceFootprint.summary = gate.blockedReason!.reason;
      } else {
        const ev = gate.accepted[0];
        const d1House = numMetric(vedicPosItem, 'house');
        const chalitHouse = numMetric(chalitItem, 'chalit_house');
        const kpHouse = numMetric(kpPosItem, 'kp_house');
        const westHouse = numMetric(westPosItem, 'house');
        const presentCount = [d1House, chalitHouse, kpHouse, westHouse].filter(
          (x) => x !== null
        ).length;

        const res = evaluateRuleMathModel(rule.mathModel.modelId, presentCount, { planet: subject });
        const { impact } = emitImpactAndSignal({
          rule,
          dimension: 'influenceFootprint',
          evidence: ev,
          signalKey: 'cross_frame_presence',
          label: `${subject} Cross-Frame Footprint`,
          rawValue: presentCount,
          rawUnit: 'frames_present',
          normalizedValue: presentCount,
          normalizedUnit: 'present_frame_count',
          qualitativeClass: res.qualitativeClass,
          direction: 'neutral',
          interactionType: 'direct',
          magnitude: { kind: 'unassigned_no_arbitrary_weight' },
        });
        const sourceIds = [
          ev.evidenceId,
          ...(chalitItem ? [chalitItem.evidenceId] : []),
          ...(kpPosItem ? [kpPosItem.evidenceId] : []),
          ...(kpSubItem ? [kpSubItem.evidenceId] : []),
          ...(kpSigItem ? [kpSigItem.evidenceId] : []),
          ...(westPosItem ? [westPosItem.evidenceId] : []),
        ];
        const status: RuleExecutionOutcomeStatus =
          gate.provisionalIds.length > 0 ? 'partially_applied' : 'applied';
        recordExecution({
          rule,
          status,
          sourceEvidenceIds: sourceIds,
          emittedImpactIds: [impact.impactId],
          provisionalDependencies: gate.provisionalIds,
          mathOutputSummary: res.formulaTrace,
          numericalResult: presentCount,
          reason: res.reason,
        });
        dimensions.influenceFootprint.status =
          status === 'partially_applied' ? 'partially_evaluated' : 'evaluated';
        dimensions.influenceFootprint.summary = `Recorded factual coordinates across ${presentCount} isolated chart frames (D1/Chalit/KP/Western) without domain weighting.`;
      }
      if (
        blockedIncompatibleFrames.has('bhava_chalit') ||
        blockedNoticesByDataset.get('bhava_chalit')?.status === 'incompatible'
      ) {
        const chalitBlockReason =
          blockedNoticesByDataset.get('bhava_chalit')?.reason ??
          'Bhava Chalit frame marked incompatible in rejectedOrBlockedFrames.';
        recordExecution({
          rule,
          status: 'blocked_incompatible_frame',
          sourceEvidenceIds: [],
          missingInputs: ['bhava_chalit'],
          reason: `Bhava Chalit blocked due to incompatible frame (${chalitBlockReason}); KP Placidus cusps never merged into Bhava Chalit.`,
        });
        dimensions.influenceFootprint.limitations.push(
          `Incompatible Bhava Chalit rejected (blocked_incompatible_frame): ${chalitBlockReason}`
        );
      }
      dimensions.influenceFootprint.limitations.push(
        'Domain-specific house importance and benefic/malefic lordship authority are deferred to K03/K04.'
      );
    }

    // =========================================================================
    // OVERLAY 1: CONFLICT OVERLAY (Explicit preservation, NEVER silent resolution)
    // =========================================================================
    const conflictRule = assertRegisteredRule('K02_OVERLAY_CONFLICT_DETECTION');
    const conflicts: ConflictOverlayItem[] = [];
    const addConflict = (item: Omit<ConflictOverlayItem, 'conflictId' | 'ruleId'>) => {
      const cid = `conf_${sha256Hex(`${subject}:${item.conflictType}:${item.evidenceIds.join(',')}`).slice(0, 16)}`;
      conflicts.push({
        conflictId: cid,
        ruleId: conflictRule.ruleId,
        ...item,
      });
    };

    const d1HouseNum = numMetric(vedicPosItem, 'house');
    const chalitHouseNum = numMetric(chalitItem, 'chalit_house');
    const kpHouseNum = numMetric(kpPosItem, 'kp_house');

    // 1. D1 Whole Sign house !== Sripati Chalit house
    if (d1HouseNum !== null && chalitHouseNum !== null && d1HouseNum !== chalitHouseNum) {
      addConflict({
        conflictType: 'frame_house_divergence',
        severity: 'moderate',
        title: `${subject} D1 (H${d1HouseNum}) vs Sripati Chalit (H${chalitHouseNum}) House Shift`,
        description: `${subject} occupies Whole-Sign House ${d1HouseNum} in D1 Rashi but shifts to House ${chalitHouseNum} in Sripati Bhava Chalit.`,
        framesInvolved: ['vedic_lahiri', 'bhava_chalit'],
        evidenceIds: [vedicPosItem!.evidenceId, chalitItem!.evidenceId],
        resolutionStatus: 'unresolved_preserved_for_k05_k07',
      });
    }
    if (d1HouseNum !== null && kpHouseNum !== null && d1HouseNum !== kpHouseNum) {
      addConflict({
        conflictType: 'frame_house_divergence',
        severity: 'moderate',
        title: `${subject} D1 (H${d1HouseNum}) vs KP Placidus (H${kpHouseNum}) House Shift`,
        description: `${subject} occupies Whole-Sign House ${d1HouseNum} in D1 Rashi vs KP Placidus House ${kpHouseNum}.`,
        framesInvolved: ['vedic_lahiri', 'kp_placidus'],
        evidenceIds: [vedicPosItem!.evidenceId, kpPosItem!.evidenceId],
        resolutionStatus: 'unresolved_preserved_for_k05_k07',
      });
    }

    // 2. D1 vs D9 Dignity Divergence (NEVER automatic cancellation)
    if (d1DignityItem && d9Item) {
      const d1Dig = strMetric(d1DignityItem, 'dignity');
      const d9Dig = strMetric(d9Item, 'dignity');
      const d1Tok = normToken(d1Dig);
      const d9Tok = normToken(d9Dig);
      const isVarg = Boolean(vargottamaModItem) || boolMetric(condItem, 'is_vargottama') === true;
      const d1Weak = ['debilitated', 'neecha', 'enemy', 'shatru', 'great_enemy', 'adhi_shatru'].includes(d1Tok);
      const d9Strong = ['exalted', 'own_sign', 'swakshetra', 'moolatrikona'].includes(d9Tok) || isVarg;
      const d1Strong = ['exalted', 'own_sign', 'swakshetra', 'moolatrikona'].includes(d1Tok);
      const d9Weak = ['debilitated', 'neecha', 'enemy', 'shatru', 'great_enemy', 'adhi_shatru'].includes(d9Tok);

      if ((d1Weak && d9Strong) || (d1Strong && d9Weak)) {
        addConflict({
          conflictType: 'd1_d9_dignity_divergence',
          severity: 'high',
          title: `${subject} D1 (${d1Dig ?? '?'}) vs D9 (${d9Dig ?? (isVarg ? 'Vargottama' : '?')}) Polarity Divergence`,
          description: `D1 dignity (${d1Dig ?? '?'}) diverges sharply from D9 Navamsa state (${
            d9Dig ?? '?'
          }${isVarg ? ', Vargottama' : ''}). Preserved explicitly without automatic D9 cancellation.`,
          framesInvolved: ['vedic_lahiri'],
          evidenceIds: [
            d1DignityItem.evidenceId,
            d9Item.evidenceId,
            ...(vargottamaModItem ? [vargottamaModItem.evidenceId] : []),
          ],
          resolutionStatus: 'unresolved_preserved_for_k05_k07',
        });
      }
    }

    // 3. Strong Shadbala (ratio >= 1.0) vs Combustion / Graha Yuddha loss / Gandanta
    const shadbalaSig = dimensions.capacity.signals.find((s) => s.signalKey === 'shadbala_bphs_rupa_ratio');
    const shadbalaRatio = shadbalaSig?.normalizedValue ?? null;
    const isCombust = Boolean(combustModItem) || boolMetric(condItem, 'is_combust') === true;
    const isGandanta = Boolean(gandantaModItem) || boolMetric(condItem, 'is_gandanta') === true;
    const isYuddhaLoser =
      boolMetric(condItem, 'in_graha_yuddha') === true &&
      normToken(strMetric(condItem, 'graha_yuddha_role')) === 'loser';

    if (shadbalaRatio !== null && shadbalaRatio >= 1.0 && (isCombust || isYuddhaLoser || isGandanta)) {
      const condEvIds = [
        ...shadbalaSig!.sourceEvidenceIds,
        ...(combustModItem ? [combustModItem.evidenceId] : []),
        ...(gandantaModItem ? [gandantaModItem.evidenceId] : []),
        ...(condItem ? [condItem.evidenceId] : []),
      ];
      addConflict({
        conflictType: 'strength_vs_condition_tension',
        severity: 'high',
        title: `${subject} Adequate/Strong Shadbala (${shadbalaRatio}x) Co-occurring with Operating Affliction`,
        description: `Shadbala meets/exceeds BPHS minimum (${shadbalaRatio}x) while active vulnerability condition exists (combust=${isCombust}, yuddha_loser=${isYuddhaLoser}, gandanta=${isGandanta}).`,
        framesInvolved: ['vedic_lahiri'],
        evidenceIds: Array.from(new Set(condEvIds)),
        resolutionStatus: 'unresolved_preserved_for_k05_k07',
      });
    }

    // 4. High Ishta Phala paired with higher Kashta Phala
    const ikItem = direct.find((e) => e.observation.code === 'ISHTA_KASHTA_PHALA');
    if (ikItem) {
      const ishta = numMetric(ikItem, 'ishta_phala');
      const kashta = numMetric(ikItem, 'kashta_phala');
      if (ishta !== null && kashta !== null && ishta >= 20 && kashta > ishta) {
        addConflict({
          conflictType: 'ishta_kashta_polarity_tension',
          severity: 'moderate',
          title: `${subject} High Ishta (${ishta}) Exceeded by Kashta (${kashta})`,
          description: `${subject} records high Ishta Phala (${ishta}) alongside higher Kashta Phala (${kashta}).`,
          framesInvolved: ['vedic_lahiri'],
          evidenceIds: [ikItem.evidenceId],
          resolutionStatus: 'unresolved_preserved_for_k05_k07',
        });
      }
    }

    // 5. Vedic Lahiri dignity vs Western Tropical essential dignity divergence
    if (d1DignityItem && westDignityItem) {
      const vSig = dimensions.integrity.signals.find((s) => s.signalKey === 'vedic_d1_dignity');
      const wSig = dimensions.integrity.signals.find((s) => s.signalKey === 'western_essential_dignity');
      const vDig = strMetric(d1DignityItem, 'dignity');
      const wDig = strMetric(westDignityItem, 'dignity_status');
      const vDir = vSig?.direction;
      const wDir = wSig?.direction;
      if (
        (vDir === 'supporting' && wDir === 'constraining') ||
        (vDir === 'constraining' && wDir === 'supporting')
      ) {
        addConflict({
          conflictType: 'cross_frame_dignity_divergence',
          severity: 'low',
          title: `${subject} Vedic Sidereal (${vDig ?? '?'}) vs Western Tropical (${wDig ?? '?'}) Dignity Divergence`,
          description: `Sidereal Lahiri dignity (${vDig ?? '?'}) and Tropical Western essential dignity (${wDig ?? '?'}) carry opposite polarity in their respective frames.`,
          framesInvolved: ['vedic_lahiri', 'western_tropical'],
          evidenceIds: [d1DignityItem.evidenceId, westDignityItem.evidenceId],
          resolutionStatus: 'contextual_divergence_noted',
        });
      }
    }

    const conflictEval = evaluateRuleMathModel(conflictRule.mathModel.modelId, conflicts.length, {
      planet: subject,
    });
    recordExecution({
      rule: conflictRule,
      status: 'applied',
      sourceEvidenceIds: Array.from(new Set(conflicts.flatMap((c) => c.evidenceIds))),
      mathOutputSummary: conflictEval.formulaTrace,
      numericalResult: conflicts.length,
      reason: `Detected ${conflicts.length} conflict/tension signals for ${subject}.`,
    });

    const conflictOverlay: ConflictOverlay = {
      hasConflicts: conflicts.length > 0,
      conflictCount: conflicts.length,
      conflicts,
      note: 'All cross-frame and intra-state tensions are preserved verbatim without silent averaging or premature cancellation.',
    };

    // =========================================================================
    // OVERLAY 2: MODIFICATION OVERLAY (Active Modifiers pending K05/K07)
    // =========================================================================
    const modRule = assertRegisteredRule('K02_OVERLAY_MODIFICATION_CATALOG');
    const modifiers: ModificationOverlayItem[] = [];
    const addModifier = (item: Omit<ModificationOverlayItem, 'modifierId' | 'ruleId' | 'evidenceIds' | 'pendingResolutionBy'>) => {
      const mid = `mod_${sha256Hex(`${subject}:${item.modifierType}:${item.sourceEvidenceIds.join(',')}`).slice(0, 16)}`;
      modifiers.push({
        modifierId: mid,
        ruleId: modRule.ruleId,
        evidenceIds: [...item.sourceEvidenceIds],
        pendingResolutionBy: 'K05_K07',
        ...item,
      });
    };

    if (boolMetric(condItem, 'is_retrograde') === true && condItem) {
      addModifier({
        modifierType: 'retrograde',
        status: 'active',
        label: `${subject} Retrograde (Vakra)`,
        summary: `${subject} is in retrograde motion (non-scalar Cheshta state; no automatic bonus/penalty).`,
        affectedDimensions: ['stability', 'resilience'],
        sourceEvidenceIds: [condItem.evidenceId, ...(telemetryItem ? [telemetryItem.evidenceId] : [])],
        trust: condItem.verification.propagatedTrust,
        pendingDownstreamResolution: 'K05/K07 contextual retrogression & Cheshta synthesis.',
      });
    }
    if (isCombust && (combustModItem || condItem)) {
      const src = combustModItem ?? condItem!;
      const sep = numMetric(src, 'sun_separation_deg') ?? numMetric(condItem, 'sun_separation_deg');
      addModifier({
        modifierType: 'combust',
        status: 'active',
        label: `${subject} Combustion (Asta)`,
        summary: `${subject} is combust (${sep !== null ? `${sep.toFixed(2)}°` : '?'} from Sun).`,
        affectedDimensions: ['vulnerability', 'capacity'],
        sourceEvidenceIds: Array.from(
          new Set([...(combustModItem ? [combustModItem.evidenceId] : []), ...(condItem ? [condItem.evidenceId] : [])])
        ),
        trust: src.verification.propagatedTrust,
        pendingDownstreamResolution: 'K05/K07 combustion mitigation & benefic aspect review.',
      });
    }
    if ((Boolean(vargottamaModItem) || boolMetric(condItem, 'is_vargottama') === true) && (vargottamaModItem || condItem)) {
      const src = vargottamaModItem ?? condItem!;
      addModifier({
        modifierType: 'vargottama',
        status: 'active',
        label: `${subject} Vargottama`,
        summary: `${subject} occupies the identical sign in D1 Rashi and D9 Navamsa.`,
        affectedDimensions: ['integrity', 'resilience'],
        sourceEvidenceIds: Array.from(
          new Set([...(vargottamaModItem ? [vargottamaModItem.evidenceId] : []), ...(condItem ? [condItem.evidenceId] : [])])
        ),
        trust: src.verification.propagatedTrust,
        pendingDownstreamResolution: 'K05/K07 reinforcement & Neecha-Bhanga interaction check.',
      });
    }
    if (isGandanta && (gandantaModItem || condItem)) {
      const src = gandantaModItem ?? condItem!;
      addModifier({
        modifierType: 'gandanta',
        status: 'active',
        label: `${subject} Gandanta Junction`,
        summary: `${subject} lies in a Water-Fire Rashi/Nakshatra Gandanta junction.`,
        affectedDimensions: ['vulnerability', 'stability'],
        sourceEvidenceIds: Array.from(
          new Set([...(gandantaModItem ? [gandantaModItem.evidenceId] : []), ...(condItem ? [condItem.evidenceId] : [])])
        ),
        trust: src.verification.propagatedTrust,
        pendingDownstreamResolution: 'K05/K07 boundary vulnerability synthesis.',
      });
    }
    if (yuddhaModItems.length > 0 || boolMetric(condItem, 'in_graha_yuddha') === true) {
      const src = yuddhaModItems[0] ?? condItem!;
      addModifier({
        modifierType: 'graha_yuddha',
        status: 'active',
        label: `${subject} Graha Yuddha`,
        summary: `${subject} is in Surya Siddhanta planetary war (role: ${strMetric(condItem, 'graha_yuddha_role') ?? 'participant'}).`,
        affectedDimensions: ['vulnerability', 'stability'],
        sourceEvidenceIds: Array.from(
          new Set([...yuddhaModItems.map((y) => y.evidenceId), ...(condItem ? [condItem.evidenceId] : [])])
        ),
        trust: src.verification.propagatedTrust,
        pendingDownstreamResolution: 'K05/K07 planetary war outcome integration.',
      });
    }
    for (const pItem of parivartanaItems) {
      addModifier({
        modifierType: 'parivartana',
        status: 'active',
        label: `${subject} ${strMetric(pItem, 'division') ?? 'D1'} Parivartana`,
        summary: `${pItem.observation.summary}`,
        affectedDimensions: ['integrity', 'autonomy', 'resilience'],
        sourceEvidenceIds: [pItem.evidenceId],
        trust: pItem.verification.propagatedTrust,
        pendingDownstreamResolution: 'K05/K07 mutual exchange activation & domain synthesis.',
      });
    }
    if (
      chalitItem &&
      (boolMetric(chalitItem, 'shifted_from_rashi') === true ||
        (d1HouseNum !== null && chalitHouseNum !== null && d1HouseNum !== chalitHouseNum))
    ) {
      addModifier({
        modifierType: 'chalit_shift',
        status: 'active',
        label: `${subject} Sripati Chalit House Shift`,
        summary: `${subject} shifts from Rashi House ${d1HouseNum ?? '?'} to Sripati Chalit House ${chalitHouseNum ?? '?'}.`,
        affectedDimensions: ['stability', 'influenceFootprint', 'deliverability'],
        sourceEvidenceIds: [chalitItem.evidenceId],
        trust: chalitItem.verification.propagatedTrust,
        pendingDownstreamResolution: 'K05/K07/K08 Bhava Chalit house delivery adjudication.',
      });
    }
    if (vedicDegItem && vedicDegItem.sensitivity.sandhiOrBoundaryRisk) {
      const deg = numMetric(vedicDegItem, 'degree_in_sign');
      addModifier({
        modifierType: 'sandhi_boundary',
        status: 'active',
        label: `${subject} Sandhi / Sign Boundary Proximity`,
        summary: `${subject} is near a sign cusp (${deg !== null ? `${deg.toFixed(4)}°` : 'boundary'}).`,
        affectedDimensions: ['vulnerability', 'stability'],
        sourceEvidenceIds: [vedicDegItem.evidenceId],
        trust: vedicDegItem.verification.propagatedTrust,
        pendingDownstreamResolution: 'K07/K08 birth-time & cusp sensitivity weighting.',
      });
    }
    for (const dosha of activeDoshaItems) {
      if (strictNonProvisional && dosha.verification.propagatedTrust === 'provisional') continue;
      addModifier({
        modifierType: 'dosha_factor',
        status: 'candidate_pending_k05_k07',
        label: `${dosha.subject.name} Participation`,
        summary: dosha.observation.summary,
        affectedDimensions: ['vulnerability'],
        sourceEvidenceIds: [dosha.evidenceId],
        trust: dosha.verification.propagatedTrust,
        pendingDownstreamResolution: 'K05/K07 dosha severity & cancellation review.',
      });
    }
    if (avasthaItem && !strictNonProvisional) {
      addModifier({
        modifierType: 'avastha_provisional',
        status: 'candidate_pending_k05_k07',
        label: `${subject} Baladi/Jagradadi/Deeptadi Avastha (Provisional)`,
        summary: avasthaItem.observation.summary,
        affectedDimensions: ['integrity'],
        sourceEvidenceIds: [avasthaItem.evidenceId],
        trust: avasthaItem.verification.propagatedTrust,
        pendingDownstreamResolution: 'Pending external Avastha calibration & K05 contextual integration.',
      });
    }

    const modEval = evaluateRuleMathModel(modRule.mathModel.modelId, modifiers.length, {
      planet: subject,
    });
    recordExecution({
      rule: modRule,
      status: 'applied',
      sourceEvidenceIds: Array.from(new Set(modifiers.flatMap((m) => m.sourceEvidenceIds))),
      mathOutputSummary: modEval.formulaTrace,
      numericalResult: modifiers.length,
      reason: `Cataloged ${modifiers.length} active/candidate modifiers for ${subject}.`,
    });

    const modificationOverlay: ModificationOverlay = {
      activeModifierCount: modifiers.length,
      modifiers,
      note: 'All active modifiers and candidate interaction rules are preserved for K05/K07 without premature K02 scalar weighting.',
    };

    // =========================================================================
    // OVERLAY 3: RELIABILITY OVERLAY (Trust ceiling, provisional & sensitivity)
    // =========================================================================
    const relRule = assertRegisteredRule('K02_OVERLAY_RELIABILITY_AUDIT');
    const usableItems = allSubjectItems.filter((e) => e.verification.propagatedTrust === 'usable');
    const provisionalItems = allSubjectItems.filter(
      (e) => e.verification.propagatedTrust === 'provisional'
    );
    const blockedItems = allSubjectItems.filter((e) => e.verification.propagatedTrust === 'blocked');

    const compRank: Record<ComputationalVerificationStatus, number> = {
      unavailable: 0,
      incompatible: 1,
      unverified: 2,
      provisional: 3,
      provider_reported: 4,
      verified_internal: 5,
    };
    let computationalFloor: ComputationalVerificationStatus = 'unavailable';
    if (allSubjectItems.length > 0) {
      let minRank = 99;
      let minStatus: ComputationalVerificationStatus = 'verified_internal';
      for (const item of allSubjectItems) {
        if (item.verification.propagatedTrust === 'blocked') continue;
        const r = compRank[item.verification.computational] ?? 0;
        if (r < minRank) {
          minRank = r;
          minStatus = item.verification.computational;
        }
      }
      computationalFloor = minRank === 99 ? 'unavailable' : minStatus;
    }

    const methodologicalProfile = Array.from(
      new Set(allSubjectItems.map((e) => e.verification.methodological))
    ) as MethodologicalVerificationStatus[];

    const birthTimeSensitive = allSubjectItems.some((e) => e.sensitivity.birthTimeSensitive);
    const sandhiOrBoundaryRisk = allSubjectItems.some((e) => e.sensitivity.sandhiOrBoundaryRisk);
    const conventionSensitive = allSubjectItems.some((e) => e.sensitivity.conventionSensitive);
    const sensitivityReasons = Array.from(
      new Set(allSubjectItems.flatMap((e) => e.sensitivity.reasons))
    );

    const provisionalDependencies = Array.from(
      new Set(
        provisionalItems.map(
          (p) => `${p.observation.code}:${p.sourceDatasets.map((d) => d.datasetKey).join('+') || 'local'}`
        )
      )
    );
    const blockedDependencies = Array.from(
      new Set([
        ...blockedItems.map((b) => `${b.observation.code}:blocked`),
        ...repo.rejectedOrBlockedFrames.map((n) => `${n.datasetKey}:${n.canonicalStatus}`),
      ])
    );

    const overallTrust: PropagatedTrustLevel =
      usableItems.length === 0 && provisionalItems.length === 0
        ? 'blocked'
        : usableItems.length > 0 &&
          (!strictNonProvisional ? provisionalItems.length === 0 || usableItems.length >= provisionalItems.length : true)
        ? provisionalItems.some((p) =>
            ['SHADBALA_MAJOR_SIX_BALA', 'VEDIC_D1_PLANET_LONGITUDE', 'VEDIC_D1_SIGN_HOUSE_PLACEMENT'].includes(
              p.observation.code
            )
          )
          ? 'provisional'
          : 'usable'
        : 'provisional';

    const externalValidationAchieved = repo.sourceChart.externalValidationAchieved;
    const confidenceCeiling: K02ConfidenceCeiling =
      overallTrust === 'blocked' || (usableItems.length === 0 && provisionalItems.length === 0)
        ? 'insufficient_data'
        : overallTrust === 'provisional' ||
          provisionalItems.some((p) =>
            ['SHADBALA_MAJOR_SIX_BALA', 'VEDIC_D1_PLANET_LONGITUDE'].includes(p.observation.code)
          ) ||
          (d5ProvItem !== undefined && !strictNonProvisional)
        ? 'capped_provisional'
        : !externalValidationAchieved &&
          allSubjectItems.some((e) => e.verification.computational === 'provider_reported')
        ? 'moderate_provider_dependent'
        : 'high_internal';

    const confidenceCeilingNote =
      confidenceCeiling === 'insufficient_data'
        ? `Insufficient usable or provisional evidence for ${subject}.`
        : confidenceCeiling === 'capped_provisional'
        ? `Confidence capped at provisional (${provisionalDependencies.join(', ') || 'provisional inputs'}). Never promoted to usable/validated.`
        : confidenceCeiling === 'moderate_provider_dependent'
        ? 'Primary coordinates are consistent, bounded by provider_reported components and unvalidated external reconciliation.'
        : 'Internally verified across primary frames (external empirical validation remains not_validated).';

    const relEval = evaluateRuleMathModel(relRule.mathModel.modelId, overallTrust, { planet: subject });
    recordExecution({
      rule: relRule,
      status: 'applied',
      sourceEvidenceIds: allSubjectItems.map((e) => e.evidenceId),
      provisionalDependencies: provisionalItems.map((p) => p.evidenceId),
      mathOutputSummary: `${relEval.formulaTrace}; ceiling=${confidenceCeiling}`,
      numericalResult: relEval.normalizedValue,
      reason: confidenceCeilingNote,
    });

    const reliabilityOverlay: ReliabilityOverlay = {
      overallTrust,
      confidenceCeiling,
      externalValidationAchieved,
      computationalFloor,
      methodologicalProfile,
      empiricalStatus: externalValidationAchieved ? 'independently_validated_external' : 'not_validated',
      birthTimeSensitive,
      sandhiOrBoundaryRisk,
      conventionSensitive,
      provisionalEvidenceIds: provisionalItems.map((p) => p.evidenceId),
      blockedEvidenceIds: blockedItems.map((b) => b.evidenceId),
      provisionalDependencies,
      blockedDependencies,
      usableEvidenceCount: usableItems.length,
      provisionalEvidenceCount: provisionalItems.length,
      blockedEvidenceCount: blockedItems.length,
      confidenceCeilingNote,
      sensitivityReasons,
    };

    subjectStates[subject] = {
      schemaVersion: K02_STATE_ENGINE_VERSION,
      subject,
      subjectCategory,
      dimensions,
      overlays: {
        conflict: conflictOverlay,
        modification: modificationOverlay,
        reliability: reliabilityOverlay,
      },
      ruleExecutions: subjectExecutions,
      emittedImpactIds: subjectImpacts.map((i) => i.impactId),
    };
  }

  return {
    engineVersion: K02_STATE_ENGINE_VERSION,
    registryVersion: ANALYTICAL_RULE_REGISTRY_VERSION,
    generatedAtUtc: new Date().toISOString(),
    sourceInputFingerprint: repo.sourceChart.inputFingerprint,
    strictNonProvisional,
    subjectStates,
    k02ImpactContracts: allK02Impacts,
    ruleExecutionSummary: {
      registryVersion: ANALYTICAL_RULE_REGISTRY_VERSION,
      totalEvaluations: allRuleExecutions.length,
      countsByStatus,
      unregisteredRuleRejections: 0,
      records: allRuleExecutions,
    },
    overlapMetadataByEvidenceId,
  };
}
