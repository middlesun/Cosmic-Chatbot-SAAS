/**
 * Isolated V2 Engine — Layer C Read-Only Input Contract & Epistemic Readiness Helpers
 *
 * Pure TypeScript (Cloudflare Workers compatible — zero Node built-ins).
 *
 * Defines the stable foundational-to-analytical boundary consumed by Layer C
 * (CosmicCouncil Proprietary Analytical Intelligence: PHI, YSI, DSI, Lagna/Lagnesh Health,
 * House Intelligence, Timing Convergence) WITHOUT implementing any proprietary analytical
 * weights, thresholds, or formulas (`LayerCAnalyticalShell` remains `deferred_by_scope`).
 */

import { evaluateDatasetCompleteness } from './datasetManifest';
import type {
  AstronomicalTelemetryFrame,
  BhavaChalitFrame,
  CalculationConventionsRecord,
  CanonicalBirthInstant,
  CanonicalDatasetState,
  CompiledV2FoundationalChartResult,
  DatasetCompletenessManifest,
  DatasetEnvelope,
  KpPlacidusFrame,
  LayerBMasterChartRecord,
  LayerCAnalyticalShell,
  LocalModulesEnvelopeBundle,
  ReferenceDateTimingSnapshot,
  ShadbalaReconciliationReport,
  VedicLahiriFrame,
  WesternTropicalFrame,
} from './types';

export const LAYER_C_INPUT_CONTRACT_VERSION = 'v2.layer_c_input.1.0';

export type LayerCAnalyticalDomain =
  | 'phi_planetary_health'
  | 'ascendant_lagnesh_health'
  | 'ysi_yoga_strength'
  | 'dsi_dosha_strength'
  | 'house_intelligence'
  | 'temporal_activation';

export const LAYER_C_ANALYTICAL_DOMAINS: readonly LayerCAnalyticalDomain[] = [
  'phi_planetary_health',
  'ascendant_lagnesh_health',
  'ysi_yoga_strength',
  'dsi_dosha_strength',
  'house_intelligence',
  'temporal_activation',
] as const;

export interface LayerCEpistemicTrustBoundary {
  usableStates: CanonicalDatasetState[];
  provisionalStates: CanonicalDatasetState[];
  blockedStates: CanonicalDatasetState[];
  externalValidationAchieved: boolean;
  externalValidationBlockers: string[];
}

export interface LayerCModuleReadiness {
  domain: string;
  ready: boolean;
  missingPrerequisites: string[];
  incompatiblePrerequisites: string[];
  provisionalInputs: string[];
  recommendedDegradationBehavior:
    | 'full_analytical_computation_allowed'
    | 'compute_with_provisional_caveat'
    | 'withhold_or_return_insufficient_evidence';
}

export interface LayerCNatalInvariantPayload {
  temporalScope: 'natal_invariant';
  frames: {
    vedicLahiri: DatasetEnvelope<VedicLahiriFrame>;
    kpPlacidus: DatasetEnvelope<KpPlacidusFrame>;
    bhavaChalit: DatasetEnvelope<BhavaChalitFrame>;
    westernTropical: DatasetEnvelope<WesternTropicalFrame>;
    astronomicalTelemetry: DatasetEnvelope<AstronomicalTelemetryFrame>;
  };
  shadbalaReconciliation: DatasetEnvelope<ShadbalaReconciliationReport>;
  localModules: LocalModulesEnvelopeBundle | null;
  providerExtendedDatasets: Record<string, unknown> | null;
}

export interface LayerCAnalyticalInput {
  contractVersion: typeof LAYER_C_INPUT_CONTRACT_VERSION;
  preparedAtUtc: string;
  sourceSchemaVersion: string;
  recalculationVersion: string | null;
  inputFingerprint: string;
  canonicalBirthInstant: CanonicalBirthInstant;
  calculationConventions: CalculationConventionsRecord | null;
  epistemicTrustBoundary: LayerCEpistemicTrustBoundary;
  natalInvariant: LayerCNatalInvariantPayload;
  referenceDateTiming: ReferenceDateTimingSnapshot | null;
  datasetManifest: DatasetCompletenessManifest;
  readinessSummary: {
    minimumChartReady: boolean;
    comprehensiveFoundationalReady: boolean;
    comprehensiveCompletenessRatio: number;
    domainReadiness: Record<string, LayerCModuleReadiness>;
  };
  layerCShell: LayerCAnalyticalShell;
}

export function isBlockedForLayerC(state: CanonicalDatasetState | undefined): boolean {
  return !state || state === 'unavailable' || state === 'incompatible';
}

export function isUsableForLayerC(
  state: CanonicalDatasetState | undefined,
  options?: { allowProvisional?: boolean }
): boolean {
  if (!state) return false;
  if (
    state === 'available' ||
    state === 'internally_verified' ||
    state === 'independently_validated'
  ) {
    return true;
  }
  if (options?.allowProvisional && state === 'provisional') {
    return true;
  }
  return false;
}

export function evaluateLayerCDomainReadiness(
  manifest: DatasetCompletenessManifest
): Record<string, LayerCModuleReadiness> {
  const entryMap = new Map(manifest.entries.map((e) => [e.key, e]));
  const result: Record<string, LayerCModuleReadiness> = {};

  const domainKeys = new Set<string>([
    ...LAYER_C_ANALYTICAL_DOMAINS,
    ...Object.keys(manifest.downstreamGuardSummary || {}),
  ]);

  for (const domain of domainKeys) {
    const guard = manifest.downstreamGuardSummary?.[domain] ?? {
      ready: false,
      missingPrerequisites: [],
    };
    const missingPrerequisites = [...guard.missingPrerequisites];
    const incompatiblePrerequisites = missingPrerequisites.filter(
      (k) => entryMap.get(k)?.canonicalStatus === 'incompatible'
    );
    const provisionalInputs = manifest.entries
      .filter(
        (e) =>
          e.canonicalStatus === 'provisional' &&
          e.blockingForDownstream.includes(domain)
      )
      .map((e) => e.key);

    let recommendedDegradationBehavior: LayerCModuleReadiness['recommendedDegradationBehavior'] =
      'full_analytical_computation_allowed';
    if (!guard.ready || missingPrerequisites.length > 0 || incompatiblePrerequisites.length > 0) {
      recommendedDegradationBehavior = 'withhold_or_return_insufficient_evidence';
    } else if (provisionalInputs.length > 0) {
      recommendedDegradationBehavior = 'compute_with_provisional_caveat';
    }

    result[domain] = {
      domain,
      ready: guard.ready && incompatiblePrerequisites.length === 0,
      missingPrerequisites,
      incompatiblePrerequisites,
      provisionalInputs,
      recommendedDegradationBehavior,
    };
  }

  return result;
}

function isCompiledResult(
  source: CompiledV2FoundationalChartResult | LayerBMasterChartRecord
): source is CompiledV2FoundationalChartResult {
  return 'layerBMaster' in source && 'manifest' in source;
}

/**
 * Prepares the read-only, strictly scoped Layer C Analytical Input contract from either a
 * compiled V2 foundational result or a Layer B Master Chart Record.
 * Enforces natal vs reference-date separation and exposes epistemic trust gates without
 * computing any proprietary Layer C scores.
 */
export function prepareLayerCAnalyticalInput(
  source: CompiledV2FoundationalChartResult | LayerBMasterChartRecord
): LayerCAnalyticalInput {
  const compiled = isCompiledResult(source) ? source : null;
  const master: LayerBMasterChartRecord = isCompiledResult(source)
    ? source.layerBMaster
    : source;
  const manifest = compiled?.manifest ?? master.datasetManifest ?? evaluateDatasetCompleteness(master);
  const localModules = compiled?.localModules ?? master.localModules ?? null;
  const externalValidationBlockers = compiled?.externalValidationBlockers ?? [];
  const externalValidationAchieved =
    manifest.countsByStatus.independently_validated > 0 &&
    externalValidationBlockers.length === 0;

  const domainReadiness = evaluateLayerCDomainReadiness(manifest);

  const shell: LayerCAnalyticalShell = compiled?.layerCShell ?? {
    schemaVersion: 'v2.analytical_shell.1.0',
    linkedMasterFingerprint: master.canonicalBirthInstant.inputFingerprint,
    linkedMasterSchemaVersion: master.schemaVersion,
    status: 'deferred_by_scope',
    note: 'Layer C proprietary indices (PHI, YSI, DSI, Ascendant Health, domain matrices) are strictly separated and untouched in this phase.',
    touchedIndices: [],
  };

  return {
    contractVersion: LAYER_C_INPUT_CONTRACT_VERSION,
    preparedAtUtc: new Date().toISOString(),
    sourceSchemaVersion: compiled?.schemaVersion ?? master.schemaVersion,
    recalculationVersion: master.recalculationVersion ?? null,
    inputFingerprint: master.canonicalBirthInstant.inputFingerprint,
    canonicalBirthInstant: master.canonicalBirthInstant,
    calculationConventions: master.calculationConventions ?? null,
    epistemicTrustBoundary: {
      usableStates: ['available', 'internally_verified', 'independently_validated'],
      provisionalStates: ['provisional'],
      blockedStates: ['incompatible', 'unavailable'],
      externalValidationAchieved,
      externalValidationBlockers,
    },
    natalInvariant: {
      temporalScope: 'natal_invariant',
      frames: master.frames,
      shadbalaReconciliation: master.shadbalaReconciliation,
      localModules,
      providerExtendedDatasets: master.providerExtendedDatasets ?? null,
    },
    referenceDateTiming: master.referenceDateTiming ?? null,
    datasetManifest: manifest,
    readinessSummary: {
      minimumChartReady: manifest.minimumChartReadiness.ready,
      comprehensiveFoundationalReady: manifest.comprehensiveFoundationalCompleteness.ready,
      comprehensiveCompletenessRatio:
        manifest.comprehensiveFoundationalCompleteness.completenessRatio,
      domainReadiness,
    },
    layerCShell: shell,
  };
}

export function assertLayerCPrerequisites(
  input: LayerCAnalyticalInput,
  domain: LayerCAnalyticalDomain | string
): { ok: boolean; reasons: string[] } {
  const readiness = input.readinessSummary.domainReadiness[domain];
  if (!readiness) {
    return {
      ok: false,
      reasons: [`Unknown Layer C analytical domain "${domain}".`],
    };
  }
  const reasons: string[] = [];
  if (readiness.incompatiblePrerequisites.length > 0) {
    reasons.push(
      `Blocked by incompatible dataset prerequisites: ${readiness.incompatiblePrerequisites.join(', ')}.`
    );
  }
  const nonIncompatibleMissing = readiness.missingPrerequisites.filter(
    (k) => !readiness.incompatiblePrerequisites.includes(k)
  );
  if (nonIncompatibleMissing.length > 0) {
    reasons.push(`Missing/unavailable dataset prerequisites: ${nonIncompatibleMissing.join(', ')}.`);
  }
  return {
    ok: readiness.ready && reasons.length === 0,
    reasons,
  };
}
