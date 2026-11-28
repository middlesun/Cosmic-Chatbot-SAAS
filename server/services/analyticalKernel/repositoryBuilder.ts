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
import { buildInitialPlanetaryStates } from './planetaryStateBuilder';
import {
  ANALYTICAL_KERNEL_VERSION,
  ANALYTICAL_RULE_VERSION,
  CANONICAL_EVIDENCE_FRAMES,
  EVIDENCE_FAMILIES,
  REPOSITORY_SCHEMA_VERSION,
  type AnalyticalEvidenceRepository,
  type CanonicalEvidenceFrame,
  type CanonicalEvidenceObject,
  type EvidenceFamily,
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
