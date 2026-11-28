/**
 * K01 Analytical Evidence Repository Builder & Summary Formatter
 *
 * Consumes ONLY `LayerCAnalyticalInput` (or adapts a read-only V2 Master/Compiled chart
 * via `prepareLayerCAnalyticalInput`), runs all deterministic K01 extractors, validates
 * acyclic lineage and overlap classification, partitions `natal_invariant` vs
 * `reference_date_dependent` evidence, and builds initial `PlanetaryStateRecord`s.
 */

import {
  LAYER_C_INPUT_CONTRACT_VERSION,
  prepareLayerCAnalyticalInput,
  type LayerCAnalyticalInput,
} from '../v2Engine/layerCContract';
import type {
  CompiledV2FoundationalChartResult,
  LayerBMasterChartRecord,
} from '../v2Engine/types';
import { extractDignityAndStrengthEvidence } from './extractors/dignityStrengthExtractor';
import { canonicalSubjectPlanet, createExtractionContext } from './extractors/helpers';
import { extractPositionalAndDegreeEvidence } from './extractors/positionalExtractor';
import { extractRelationalAndConditionEvidence } from './extractors/relationalConditionExtractor';
import { extractStellarAndDivisionalEvidence } from './extractors/stellarDivisionalExtractor';
import { extractYogaHouseAndTimingEvidence } from './extractors/yogaHouseTimingExtractor';
import { CanonicalEvidenceRegistry } from './lineage';
import { buildPhiAndSpecialProfiles } from './phiPreparation';
import { buildInitialPlanetaryStates } from './planetaryStateBuilder';
import {
  evaluateK02PlanetaryStates,
  type EvaluateK02PlanetaryStatesOptions,
} from './planetaryStateEngine';
import { exportRuleRegistrySnapshot } from './ruleRegistry';
import {
  ANALYTICAL_KERNEL_VERSION,
  ANALYTICAL_RULE_REGISTRY_VERSION,
  ANALYTICAL_RULE_VERSION,
  CANONICAL_EVIDENCE_FRAMES,
  EVIDENCE_FAMILIES,
  K02_PROJECTION_SCHEMA_VERSION,
  PLANETARY_STATE_DIMENSIONS,
  PLANETARY_STATE_SUBJECTS,
  REPOSITORY_SCHEMA_VERSION,
  type AnalyticalEvidenceRepository,
  type AnalyticalKernelK02Bundle,
  type AnalyticalKernelK02StateResult,
  type CanonicalEvidenceFrame,
  type CanonicalEvidenceObject,
  type EvidenceFamily,
  type K02SubjectStateRecord,
  type PhiReadyPlanetName,
  type PlanetaryStateSubjectName,
  type RuleExecutionOutcomeStatus,
} from './types';

function isLayerCInput(
  source: CompiledV2FoundationalChartResult | LayerBMasterChartRecord | LayerCAnalyticalInput
): source is LayerCAnalyticalInput {
  return (
    typeof source === 'object' &&
    source !== null &&
    'contractVersion' in source &&
    source.contractVersion === LAYER_C_INPUT_CONTRACT_VERSION
  );
}

export function buildAnalyticalEvidenceRepository(
  source: CompiledV2FoundationalChartResult | LayerBMasterChartRecord | LayerCAnalyticalInput
): AnalyticalEvidenceRepository {
  const input: LayerCAnalyticalInput = isLayerCInput(source)
    ? source
    : prepareLayerCAnalyticalInput(source);

  const ctx = createExtractionContext(input);
  const registry = new CanonicalEvidenceRegistry();

  // Execute extractors in deterministic dependency order
  const posResult = extractPositionalAndDegreeEvidence(ctx);
  registry.registerMany(posResult.drafts);

  const dignityDrafts = extractDignityAndStrengthEvidence(ctx, posResult);
  registry.registerMany(dignityDrafts);

  const stellarDivDrafts = extractStellarAndDivisionalEvidence(ctx, posResult);
  registry.registerMany(stellarDivDrafts);

  const relCondDrafts = extractRelationalAndConditionEvidence(ctx, posResult);
  registry.registerMany(relCondDrafts);

  const yogaTimingDrafts = extractYogaHouseAndTimingEvidence(ctx, posResult);
  registry.registerMany(yogaTimingDrafts);

  const lineageGraph = registry.validateAndBuildLineageGraph({ strictParents: false });
  const allEvidence = registry.getAll();

  const natalEvidence: CanonicalEvidenceObject[] = [];
  const temporalEvidence: CanonicalEvidenceObject[] = [];

  const familyInventory = {} as Record<EvidenceFamily, number>;
  for (const f of EVIDENCE_FAMILIES) familyInventory[f] = 0;

  const frameInventory = {} as Record<CanonicalEvidenceFrame, number>;
  for (const fr of CANONICAL_EVIDENCE_FRAMES) frameInventory[fr] = 0;

  for (const item of allEvidence) {
    familyInventory[item.family] += 1;
    frameInventory[item.frame] += 1;
    if (item.temporalScope === 'reference_date_dependent') {
      temporalEvidence.push(item);
    } else {
      natalEvidence.push(item);
    }
  }

  const planetaryStates = buildInitialPlanetaryStates(allEvidence);

  return {
    schemaVersion: REPOSITORY_SCHEMA_VERSION,
    kernelVersion: ANALYTICAL_KERNEL_VERSION,
    ruleVersion: ANALYTICAL_RULE_VERSION,
    generatedAtUtc: new Date().toISOString(),
    sourceChart: {
      contractVersion: input.contractVersion,
      inputFingerprint: input.inputFingerprint,
      sourceSchemaVersion: input.sourceSchemaVersion,
      recalculationVersion: input.recalculationVersion,
      canonicalBirthInstant: input.canonicalBirthInstant,
      calculationConventions: input.calculationConventions,
      minimumChartReady: input.readinessSummary.minimumChartReady,
      comprehensiveFoundationalReady: input.readinessSummary.comprehensiveFoundationalReady,
      externalValidationAchieved: input.epistemicTrustBoundary.externalValidationAchieved,
    },
    natalEvidence,
    temporalEvidence,
    rejectedOrBlockedFrames: ctx.blockedNotices,
    lineageGraph,
    impactContracts: [],
    planetaryStates,
    familyInventory,
    frameInventory,
    lifeContext: {
      status: 'deferred',
      note: 'Life context & natal domain framing deferred to later Layer C capabilities.',
      data: null,
    },
    investigationFindings: {
      status: 'deferred',
      note: 'Cross-capability investigation findings deferred until K02-K10 are implemented.',
      data: [],
    },
  };
}

/**
 * Evaluates Layer C Capability K02 (Planetary State Engine P01-P10, Impact Execution,
 * Three State Overlays, PHI-Ready Projections, and Nodal/Ascendant Condition Profiles)
 * directly from a completed K01 `AnalyticalEvidenceRepository`.
 */
export function evaluateK02FromRepository(
  repo: AnalyticalEvidenceRepository,
  options: EvaluateK02PlanetaryStatesOptions = {}
): AnalyticalKernelK02StateResult {
  const engineOut = evaluateK02PlanetaryStates(repo, options);
  const phiOut = buildPhiAndSpecialProfiles(
    repo,
    engineOut.subjectStates,
    engineOut.k02ImpactContracts,
    engineOut.overlapMetadataByEvidenceId
  );

  // Merge profile rule executions cleanly into subjectStates & ruleExecutionSummary
  const mergedSubjectStates = { ...engineOut.subjectStates } as Record<
    PlanetaryStateSubjectName,
    K02SubjectStateRecord
  >;
  const mergedCountsByStatus: Record<RuleExecutionOutcomeStatus, number> = {
    ...engineOut.ruleExecutionSummary.countsByStatus,
  };
  const mergedRecords = [...engineOut.ruleExecutionSummary.records];

  for (const rec of phiOut.profileRuleExecutions) {
    mergedRecords.push(rec);
    mergedCountsByStatus[rec.status] = (mergedCountsByStatus[rec.status] ?? 0) + 1;
    const subj = mergedSubjectStates[rec.subject];
    if (subj) {
      mergedSubjectStates[rec.subject] = {
        ...subj,
        ruleExecutions: [...subj.ruleExecutions, rec],
      };
    }
  }

  return {
    engineVersion: engineOut.engineVersion,
    registryVersion: ANALYTICAL_RULE_REGISTRY_VERSION,
    projectionSchemaVersion: K02_PROJECTION_SCHEMA_VERSION,
    generatedAtUtc: engineOut.generatedAtUtc,
    sourceInputFingerprint: engineOut.sourceInputFingerprint,
    strictNonProvisional: engineOut.strictNonProvisional,
    ruleRegistrySnapshot: exportRuleRegistrySnapshot(),
    subjectStates: mergedSubjectStates,
    impactContracts: engineOut.k02ImpactContracts,
    k02ImpactContracts: engineOut.k02ImpactContracts,
    ruleExecutionSummary: {
      registryVersion: engineOut.ruleExecutionSummary.registryVersion,
      totalEvaluations: mergedRecords.length,
      countsByStatus: mergedCountsByStatus,
      unregisteredRuleRejections: engineOut.ruleExecutionSummary.unregisteredRuleRejections,
      records: mergedRecords,
    },
    phiReadyProjections: phiOut.phiReadyProjections,
    phiReadyProjection: phiOut.phiReadyProjection,
    nodalConditionProfiles: phiOut.nodalConditionProfiles,
    nodalProfiles: phiOut.nodalConditionProfiles,
    ascendantConditionProfile: phiOut.ascendantConditionProfile,
    ascendantProfile: phiOut.ascendantConditionProfile,
  };
}

/**
 * Convenience entry point building both the K01 AnalyticalEvidenceRepository
 * and the K02 Planetary State & PHI-Ready Projection bundle without mutating K01 semantics.
 */
export function buildAnalyticalKernelK02Bundle(
  source: CompiledV2FoundationalChartResult | LayerBMasterChartRecord | LayerCAnalyticalInput,
  options: EvaluateK02PlanetaryStatesOptions = {}
): AnalyticalKernelK02Bundle {
  const k01Repository = buildAnalyticalEvidenceRepository(source);
  const k02State = evaluateK02FromRepository(k01Repository, options);
  return {
    k01Repository,
    k02State,
  };
}

function resolveK02SubjectName(planetName: string): PlanetaryStateSubjectName | null {
  const raw = planetName.trim();
  const canonical = canonicalSubjectPlanet(raw) ?? raw;
  const matched = PLANETARY_STATE_SUBJECTS.find(
    (s) => s.toLowerCase() === canonical.toLowerCase()
  );
  return matched ?? null;
}

/**
 * Formats a clean, human-readable K02 diagnostic breakdown for a single subject
 * (Sun..Saturn, Rahu, Ketu, or Ascendant): P01-P10 dimensions, RuleExecutionRecords,
 * EvidenceImpactObjects, Conflict/Modification/Reliability overlays, and
 * PHI-Ready Projection or Nodal/Ascendant Condition Profile.
 */
export function formatPlanetK02StateSummary(
  k02Result: AnalyticalKernelK02StateResult,
  planetName: string
): string {
  const subject = resolveK02SubjectName(planetName);
  if (!subject) {
    return `Unknown K02 subject "${planetName}". Valid subjects: ${PLANETARY_STATE_SUBJECTS.join(', ')}.`;
  }

  const state = k02Result.subjectStates[subject];
  const subjectImpacts = k02Result.impactContracts.filter(
    (i) => i.analyticalTarget.id === subject
  );
  const lines: string[] = [
    `=== K02 Planetary State Summary for ${subject} (${state.subjectCategory}) ===`,
    `Engine: ${k02Result.engineVersion} | Registry: ${k02Result.registryVersion} | Projection: ${k02Result.projectionSchemaVersion}`,
    `Fingerprint: ${k02Result.sourceInputFingerprint} | strictNonProvisional: ${k02Result.strictNonProvisional}`,
    `Rule Executions (subject=${state.ruleExecutions.length}, total=${k02Result.ruleExecutionSummary.totalEvaluations}) | Impacts Emitted: ${subjectImpacts.length}`,
    '',
    '--- P01-P10 Planetary State Dimensions ---',
  ];

  for (const dimName of PLANETARY_STATE_DIMENSIONS) {
    const dim = state.dimensions[dimName];
    lines.push(
      `[${dimName}] status=${dim.status}${
        dim.deferredCapability ? ` (deferredTo=${dim.deferredCapability})` : ''
      } | signals=${dim.signals.length} | directObs=${dim.directObservations.length} | impacts=${dim.impactIds.length}`
    );
    lines.push(`  Summary: ${dim.summary}`);
    for (const sig of dim.signals) {
      lines.push(
        `  * ${sig.signalKey}: raw=${String(sig.rawValue)}${
          sig.rawUnit ? ` ${sig.rawUnit}` : ''
        } | norm=${sig.normalizedValue !== null ? sig.normalizedValue : 'null'}${
          sig.normalizedUnit ? ` ${sig.normalizedUnit}` : ''
        } | class=${sig.qualitativeClass ?? 'none'} | dir=${sig.direction} | trust=${
          sig.trust
        } | overlap=${sig.overlapStatus} | rule=${sig.ruleId}`
      );
    }
    if (dim.limitations.length > 0) {
      lines.push(`  Note: ${dim.limitations[0]}`);
    }
  }

  lines.push('');
  lines.push(`--- Rule Execution Records (${state.ruleExecutions.length}) ---`);
  for (const rex of state.ruleExecutions) {
    lines.push(
      `  - [${rex.status}] ${rex.ruleId}@${rex.ruleVersion} (${rex.targetDimension}) model=${rex.mathModelId}`
    );
    lines.push(
      `    Reason: ${rex.reason}${
        rex.mathOutputSummary ? ` | Math: ${rex.mathOutputSummary}` : ''
      }`
    );
    if (rex.missingInputs.length > 0) {
      lines.push(`    MissingInputs: ${rex.missingInputs.join(', ')}`);
    }
    if (rex.provisionalDependencies.length > 0) {
      lines.push(`    ProvisionalDeps: ${rex.provisionalDependencies.join(', ')}`);
    }
  }

  lines.push('');
  lines.push(`--- Evidence Impact Objects (${subjectImpacts.length}) ---`);
  for (const imp of subjectImpacts) {
    lines.push(
      `  - ${imp.impactId} -> ${imp.affectedDimension} [${imp.direction}/${imp.interactionType}] mag=${imp.magnitude.kind}${
        imp.magnitude.kind === 'justified_rule_value'
          ? `(${imp.magnitude.value} ${imp.magnitude.unit})`
          : ''
      } | overlap=${imp.overlapMetadata.independenceStatus}${
        imp.overlapMetadata.overlapGroupId ? `(${imp.overlapMetadata.overlapGroupId})` : ''
      } | residual=${imp.residualImpact.status}`
    );
  }

  lines.push('');
  lines.push('--- Three Explicit State Overlays ---');
  const { conflict, modification, reliability } = state.overlays;
  lines.push(`ConflictOverlay (count=${conflict.conflictCount}): ${conflict.note}`);
  for (const c of conflict.conflicts) {
    lines.push(
      `  ! [${c.severity}] ${c.conflictType}: ${c.title} (${c.resolutionStatus}) frames=[${c.framesInvolved.join(', ')}]`
    );
  }
  lines.push(
    `ModificationOverlay (active=${modification.activeModifierCount}): ${modification.note}`
  );
  for (const m of modification.modifiers) {
    lines.push(
      `  ~ [${m.status}] ${m.modifierType}: ${m.summary} -> pending ${m.pendingResolutionBy}`
    );
  }
  lines.push(
    `ReliabilityOverlay: overallTrust=${reliability.overallTrust} | ceiling=${reliability.confidenceCeiling} | externalValidation=${reliability.externalValidationAchieved}`
  );
  lines.push(
    `  Counts: usable=${reliability.usableEvidenceCount}, provisional=${reliability.provisionalEvidenceCount}, blocked=${reliability.blockedEvidenceCount}`
  );
  lines.push(
    `  Sensitivity: birthTimeSensitive=${reliability.birthTimeSensitive}, sandhiOrBoundaryRisk=${reliability.sandhiOrBoundaryRisk}, conventionSensitive=${reliability.conventionSensitive}`
  );
  if (reliability.provisionalDependencies.length > 0) {
    lines.push(`  ProvisionalDeps: ${reliability.provisionalDependencies.join(', ')}`);
  }
  if (reliability.blockedDependencies.length > 0) {
    lines.push(`  BlockedDeps: ${reliability.blockedDependencies.join(', ')}`);
  }

  lines.push('');
  if (subject === 'Rahu' || subject === 'Ketu') {
    const nodal = k02Result.nodalConditionProfiles[subject];
    lines.push(`--- Nodal Condition Profile (${subject}) ---`);
    lines.push(
      `Shadbala=${nodal.shadbalaStatus} | Vedic=${nodal.vedicPlacement.sign ?? '?'} H${
        nodal.vedicPlacement.house ?? '?'
      } (${nodal.vedicPlacement.nakshatra ?? '?'} p${nodal.vedicPlacement.pada ?? '?'}) | D9=${
        nodal.d9AndVargottama.d9Sign ?? '?'
      } (vargottama=${String(nodal.d9AndVargottama.isVargottama)})`
    );
    lines.push(
      `Dispositor=${nodal.dispositorDependency.d1SignLord ?? '?'} -> final=${
        nodal.dispositorDependency.finalDispositor ?? '?'
      } (${nodal.dispositorDependency.terminationType ?? '?'}) | Witnesses=${
        nodal.conjunctionAndAspectWitnesses.length
      }`
    );
  } else if (subject === 'Ascendant') {
    const asc = k02Result.ascendantConditionProfile;
    lines.push('--- Ascendant Condition Profile (Ascendant) ---');
    lines.push(
      `Shadbala=${asc.shadbalaStatus} | D1=${asc.vedicD1.sign ?? '?'} ${
        asc.vedicD1.degreeInSign ?? '?'
      }deg (Lord=${asc.vedicD1.signLord ?? '?'}) | Nakshatra=${asc.vedicD1.nakshatra ?? '?'} p${
        asc.vedicD1.pada ?? '?'
      }`
    );
    lines.push(
      `KP Cusp 1=${asc.kpCusp1.sign ?? '?'} (Star=${asc.kpCusp1.starLord ?? '?'}, Sub=${
        asc.kpCusp1.subLord ?? '?'
      }) | D9=${asc.d9Navamsa.d9Sign ?? '?'} (vargottama=${String(
        asc.d9Navamsa.isVargottama
      )}) | LagnaLordRef=${asc.lagnaLordReference.signLord ?? '?'}->${
        asc.lagnaLordReference.finalDispositor ?? '?'
      }`
    );
  } else {
    const phi = k02Result.phiReadyProjection.classicalPlanets[subject as PhiReadyPlanetName];
    lines.push(`--- PHI-Ready Projection (${subject}) ---`);
    lines.push(
      `ShadbalaRatio=${phi.shadbalaRupaRatio.ratio ?? 'null'} (${
        phi.shadbalaRupaRatio.totalRupas ?? 'null'
      }/${phi.shadbalaRupaRatio.bphsMinRupas} rupas) | BAV=${
        phi.ashtakavargaBav.bindus ?? 'null'
      } (dev=${phi.ashtakavargaBav.boundedDeviation ?? 'null'}) | Vimshopaka=${
        phi.vimshopaka.shodashvargaScore ?? 'null'
      } (${phi.vimshopaka.normalizedRatio ?? 'null'})`
    );
    lines.push(
      `Deduplication: keptIntrinsic=${phi.deduplicatedEvidenceIds.length}, collapsedDuplicates=${phi.collapsedDuplicateIds.length}, partialOverlapGroups=${phi.partialOverlapGroups.length}, preservedDistinctLenses=${phi.preservedDistinctLensIds.length}`
    );
    lines.push(
      `ExclusionGuards: temporalExcluded=${phi.excludedBoundaries.temporalEvidenceCountExcluded}, houseFootprintExcluded=${phi.excludedBoundaries.unrelatedHouseFootprintEvidenceCountExcluded}, structuralAuthExcluded=${phi.excludedBoundaries.excludedK03StructuralAuthority}`
    );
  }

  return lines.join('\n');
}

/**
 * Formats a clean, human-readable breakdown of all extracted evidence for a single planet
 * (e.g., "Jupiter") grouped by frame and family, showing measurements, verification statuses,
 * parent/child lineage links, and overlap classifications.
 */
export function formatPlanetEvidenceSummary(
  repo: AnalyticalEvidenceRepository,
  planetName: string
): string {
  const canonicalTarget = canonicalSubjectPlanet(planetName) ?? planetName.trim();
  const all = [...repo.natalEvidence, ...repo.temporalEvidence];
  const byId = new Map(all.map((e) => [e.evidenceId, e]));

  const matching = all.filter(
    (e) =>
      e.subject.id.toLowerCase() === canonicalTarget.toLowerCase() ||
      e.relatedEntities.some((r) => r.id.toLowerCase() === canonicalTarget.toLowerCase())
  );

  const lines: string[] = [
    `=== K01 Evidence Summary for ${canonicalTarget} (matched ${matching.length} evidence items) ===`,
    `Repository: ${repo.schemaVersion} | Kernel: ${repo.kernelVersion} | Fingerprint: ${repo.sourceChart.inputFingerprint}`,
    '',
  ];

  // Group by frame -> family
  const grouped = new Map<string, CanonicalEvidenceObject[]>();
  for (const item of matching) {
    const key = `${item.frame} :: ${item.family}`;
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }

  for (const [groupKey, items] of grouped.entries()) {
    lines.push(`[${groupKey}] (${items.length})`);
    for (const item of items) {
      const roleNote =
        item.subject.id.toLowerCase() === canonicalTarget.toLowerCase()
          ? 'SUBJECT'
          : `RELATED(${item.relatedEntities
              .filter((r) => r.id.toLowerCase() === canonicalTarget.toLowerCase())
              .map((r) => r.role ?? 'participant')
              .join(',')})`;
      const meas = item.measurements
        .filter((m) => m.value !== null && m.value !== undefined && m.value !== '')
        .slice(0, 6)
        .map((m) => `${m.metric}=${String(m.value)}${m.unit ? ` ${m.unit}` : ''}`)
        .join(', ');
      const parentCodes = item.lineage.parentEvidenceIds
        .map((pid) => byId.get(pid)?.observation.code ?? pid)
        .join(', ');

      lines.push(
        `  - ${item.evidenceId} [${roleNote}] ${item.observation.code}: ${item.observation.summary}`
      );
      lines.push(
        `    Measurements: ${meas || 'none'} | Trust=${item.verification.propagatedTrust} (comp=${item.verification.computational}, meth=${item.verification.methodological}, emp=${item.verification.empirical})`
      );
      if (parentCodes) {
        lines.push(`    Lineage Parents (depth=${item.lineage.derivationDepth}): ${parentCodes}`);
      }
    }
    lines.push('');
  }

  // Relevant overlap classifications for matching items
  const matchedIds = new Set(matching.map((m) => m.evidenceId));
  const overlaps = repo.lineageGraph.overlapRelations.filter(
    (rel) => matchedIds.has(rel.evidenceIdA) || matchedIds.has(rel.evidenceIdB)
  );
  lines.push(`Overlap & Independence Relations involving ${canonicalTarget}: ${overlaps.length}`);
  for (const rel of overlaps.slice(0, 20)) {
    const aCode = byId.get(rel.evidenceIdA)?.observation.code ?? rel.evidenceIdA;
    const bCode = byId.get(rel.evidenceIdB)?.observation.code ?? rel.evidenceIdB;
    lines.push(
      `  * ${rel.overlapType} (collapse=${rel.collapseRecommended}): ${aCode} <-> ${bCode}`
    );
  }

  return lines.join('\n');
}
