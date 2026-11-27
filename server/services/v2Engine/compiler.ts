/**
 * Isolated V2 Engine — Phase 5: Consolidated Foundational Birth Chart Compiler
 *
 * Pure TypeScript (Cloudflare Workers compatible — zero Node built-ins).
 *
 * Orchestrates the canonical V2 foundational pipeline:
 *  1. Normalize AstroWay primary datasets into LayerBMasterChartRecord (LayerA preserved separately).
 *  2. Run Phase 3 compatibility gates on single targeted FreeAstroAPI /api/v2/vedic/calculate call
 *     (Ashtakavarga, Bhava Chalit, D5 Panchamsha, genuinely missing optional fields) without
 *     overwriting AstroWay primary data.
 *  3. Compute Phase 4/5 deterministic local modules (Local Ashtakavarga, Ashtakavarga Reductions,
 *     Panchadha Maitri, Vimshopaka Bala, Local Sripati Bhava Chalit fallback, Dispositor trees,
 *     Advanced Avasthas, Local Vedic Conditions) as provenance-tagged DatasetEnvelopes.
 *  4. Evaluate Phase 1 Definitive Manifest + upgraded Phase 5 Mathematical Verification Report
 *     + 6-state completeness table + dataset inventory/attribution + endpoint & credit summary.
 *  5. Return LayerCAnalyticalShell strictly deferred_by_scope (no proprietary analytical weights).
 */

import { evaluateDatasetCompleteness } from './datasetManifest';
import {
  buildDisabledLocalModuleEnvelopes,
  buildPhase4LocalModuleEnvelopes,
  computePhase4LocalCalculationsForFrame,
} from './localVedicMath';
import {
  buildLayerBMasterChartRecord,
  buildLayerCAnalyticalShell,
} from './normalizer';
import type {
  CanonicalBirthInstant,
  CanonicalDatasetState,
  CompiledV2FoundationalChartResult,
  CompletenessStateSummaryRow,
  DatasetInventoryEntry,
  EndpointCreditConsumptionSummary,
  ExternalReferenceInput,
  LayerARawProviderRecord,
  LayerBMasterChartRecord,
  LocalModulesEnvelopeBundle,
  SanitizedProviderCallRecord,
} from './types';
import {
  computeIndependentAstronomicalReference,
  verifyMasterChartRecord,
} from './verifier';

export interface CompileV2FoundationalChartParams {
  instant: CanonicalBirthInstant;
  astroWayRaw?: LayerARawProviderRecord | null;
  freeAstroApiSupplementary?: SanitizedProviderCallRecord | null;
  externalReferenceData?: ExternalReferenceInput | null;
  options?: {
    targetDateIso?: string | null;
    includeLocalModules?: boolean;
    preferLocalAshtakavarga?: boolean;
    fallbackToLocalSripatiBhavaChalit?: boolean;
    cachedVerifiedRecord?: LayerBMasterChartRecord | null;
  };
}

const ALL_SIX_CANONICAL_STATES: readonly CanonicalDatasetState[] = [
  'available',
  'internally_verified',
  'independently_validated',
  'provisional',
  'incompatible',
  'unavailable',
];

function buildCompletenessStateTable(
  master: LayerBMasterChartRecord
): CompletenessStateSummaryRow[] {
  const entries = master.datasetManifest?.entries ?? [];
  return ALL_SIX_CANONICAL_STATES.map((state) => {
    const matched = entries.filter((e) => e.canonicalStatus === state).map((e) => e.key);
    return {
      state,
      count: matched.length,
      datasetKeys: matched,
    };
  });
}

function buildDatasetInventory(
  master: LayerBMasterChartRecord,
  localModules: LocalModulesEnvelopeBundle
): DatasetInventoryEntry[] {
  const entries: DatasetInventoryEntry[] = [];

  for (const mEntry of master.datasetManifest?.entries ?? []) {
    const sources: string[] = [mEntry.source];
    if (
      mEntry.key === 'ashtakavarga_bav_sav_prastara' &&
      localModules.localAshtakavarga.canonicalStatus !== 'unavailable' &&
      !sources.includes(localModules.localAshtakavarga.source)
    ) {
      sources.push(localModules.localAshtakavarga.source);
    }
    entries.push({
      key: mEntry.key,
      label: mEntry.label,
      domain: mEntry.tier,
      canonicalStatus: mEntry.canonicalStatus,
      temporalScope: mEntry.temporalScope,
      sourceAttribution: sources.filter(Boolean),
      notes: mEntry.limitations.join(' | ') || 'Satisfied',
    });
  }

  const localLabels: Array<{
    key: keyof LocalModulesEnvelopeBundle;
    label: string;
  }> = [
    { key: 'localAshtakavarga', label: 'Local BPHS Ashtakavarga + 7x8x12 Prastara' },
    { key: 'ashtakavargaReductions', label: 'Local Ashtakavarga Reductions (Trikona, Ekadhipatya, Shodhya Pinda)' },
    { key: 'panchadhaMaitri', label: 'Local Panchadha Maitri (Five-Fold Friendship)' },
    { key: 'vimshopakaBala', label: 'Local Vimshopaka Bala (Shadvarga..Shodashavarga)' },
    { key: 'sripatiBhavaChalit', label: 'Local Sripati Bhava Chalit (Fallback Model)' },
    { key: 'dispositorRelationships', label: 'Local Dispositor Chains, Cycles & Parivartana (D1/D9)' },
    { key: 'advancedAvasthas', label: 'Local Advanced Avasthas (Baladi, Jagradadi, Deeptadi)' },
    { key: 'localVedicConditions', label: 'Local Vedic Conditions (Dignity, Combustion, Vargottama, Gandanta, Yuddha)' },
  ];

  for (const item of localLabels) {
    const env = localModules[item.key];
    entries.push({
      key: `local_module:${item.key}`,
      label: item.label,
      domain: 'deterministic_local_module',
      canonicalStatus: env.canonicalStatus,
      temporalScope: env.temporalScope,
      sourceAttribution: [env.source],
      notes: env.limitations.join(' | ') || env.calculationMethod,
    });
  }

  return entries;
}

function buildEndpointAndCreditSummary(
  astroWayRaw: LayerARawProviderRecord | null | undefined,
  freeAstroApiSupplementary: SanitizedProviderCallRecord | null | undefined,
  localModules: LocalModulesEnvelopeBundle
): EndpointCreditConsumptionSummary {
  const awCalls = astroWayRaw?.calls ? Object.values(astroWayRaw.calls) : [];
  const awQuota = astroWayRaw?.quotaAndPerformanceSummary;
  const computedLocalCount = Object.values(localModules).filter(
    (env) => env.canonicalStatus !== 'unavailable' && env.data !== null
  ).length;

  return {
    astroWay: {
      acquired: Boolean(astroWayRaw && awCalls.some((c) => c.ok)),
      totalCalls: awQuota?.totalCalls ?? awCalls.length,
      successfulCalls: awQuota?.successfulCalls ?? awCalls.filter((c) => c.ok).length,
      failedCalls: awQuota?.failedCalls ?? awCalls.filter((c) => !c.ok && c.attempts > 0).length,
      tierRestrictedCalls:
        awQuota?.tierRestrictedCalls ??
        awCalls.filter((c) => c.acquisitionClassification === 'tier_restricted').length,
      rateLimitedCalls:
        awQuota?.rateLimitedCalls ??
        awCalls.filter((c) => c.acquisitionClassification === 'rate_limited').length,
      unexecutedCalls:
        awQuota?.unexecutedCalls ??
        awCalls.filter((c) => c.acquisitionClassification === 'not_yet_tested').length,
      creditsUsedTotal: awQuota?.quotaHeadersObserved?.creditsUsedTotal ?? null,
      creditsRemainingFinal: awQuota?.quotaHeadersObserved?.creditsRemainingFinal ?? null,
      endpointsCalled: awCalls.map((c) => ({
        id: c.id,
        endpoint: c.endpoint,
        ok: c.ok,
        httpStatus: c.httpStatus,
        creditsUsed: c.creditsUsed ?? null,
        declaredQuality: c.declaredQuality ?? null,
      })),
    },
    freeAstroApi: {
      acquired: Boolean(freeAstroApiSupplementary?.ok),
      singleCallOnly: true,
      endpointsCalled: freeAstroApiSupplementary
        ? [
            {
              id: freeAstroApiSupplementary.id,
              endpoint: freeAstroApiSupplementary.endpoint,
              ok: freeAstroApiSupplementary.ok,
              httpStatus: freeAstroApiSupplementary.httpStatus,
            },
          ]
        : [],
    },
    localModulesComputedCount: computedLocalCount,
  };
}

/**
 * Consolidates AstroWay primary, FreeAstroAPI 1-call supplementary, deterministic local modules,
 * definitive completeness manifest, mathematical verification, and deferred Layer C shell into a single
 * versioned Foundational Birth Chart payload.
 */
export function compileV2FoundationalChart(
  params: CompileV2FoundationalChartParams
): CompiledV2FoundationalChartResult {
  const {
    instant,
    astroWayRaw = null,
    freeAstroApiSupplementary = null,
    externalReferenceData = null,
    options = {},
  } = params;

  const includeLocalModules = options.includeLocalModules !== false;
  const fallbackToLocalSripatiBhavaChalit = options.fallbackToLocalSripatiBhavaChalit !== false;

  // Step 1 + 2: Normalize primary AstroWay foundation & run Phase 3 compatibility gates (no primary overwrite)
  let layerBMaster = buildLayerBMasterChartRecord({
    instant,
    rawLayerA: astroWayRaw,
    supplementaryFreeAstroApiVedicCall: freeAstroApiSupplementary,
    referenceDateIso: options.targetDateIso ?? null,
    preferLocalAshtakavarga: options.preferLocalAshtakavarga ?? false,
    cachedVerifiedRecord: options.cachedVerifiedRecord ?? null,
    includeLocalModules,
  });

  // Step 3: Resolve provenance-tagged local module envelopes + optional Sripati Bhava Chalit fallback
  const localModules: LocalModulesEnvelopeBundle = !includeLocalModules
    ? buildDisabledLocalModuleEnvelopes(layerBMaster)
    : layerBMaster.localModules ??
      buildPhase4LocalModuleEnvelopes(
        layerBMaster,
        computePhase4LocalCalculationsForFrame(
          layerBMaster.frames.vedicLahiri?.data ?? null,
          layerBMaster.frames.vedicLahiri?.source ?? 'provider',
          computeIndependentAstronomicalReference(instant)
        )
      );

  if (
    includeLocalModules &&
    fallbackToLocalSripatiBhavaChalit &&
    layerBMaster.frames.bhavaChalit.data === null &&
    layerBMaster.frames.bhavaChalit.canonicalStatus !== 'incompatible' &&
    localModules.sripatiBhavaChalit.data !== null &&
    localModules.sripatiBhavaChalit.canonicalStatus === 'internally_verified'
  ) {
    layerBMaster = {
      ...layerBMaster,
      frames: {
        ...layerBMaster.frames,
        bhavaChalit: {
          ...localModules.sripatiBhavaChalit,
          source: 'local:sripatiBhavaChalit (fallback)',
          limitations: [
            'Provider/supplementary Bhava Chalit unavailable; populated with deterministic local Sripati Bhava Chalit fallback (never conflated with KP Placidus).',
          ],
        },
      },
      ...(layerBMaster.calculationConventions
        ? {
            calculationConventions: {
              ...layerBMaster.calculationConventions,
              houseSystems: {
                ...layerBMaster.calculationConventions.houseSystems,
                bhavaChalit: 'sripati_midpoint_chalit_local_fallback',
              },
            },
          }
        : {}),
    };
    layerBMaster.datasetManifest = evaluateDatasetCompleteness(layerBMaster);
  }

  // Step 4: Evaluate manifest, completeness table, inventory & mathematical verification
  const manifest = layerBMaster.datasetManifest ?? evaluateDatasetCompleteness(layerBMaster);
  layerBMaster.datasetManifest = manifest;

  const verification = verifyMasterChartRecord(layerBMaster, astroWayRaw, {
    externalReferenceData,
  });
  const completenessTable = buildCompletenessStateTable(layerBMaster);
  const datasetInventory = buildDatasetInventory(layerBMaster, localModules);
  const endpointAndCreditSummary = buildEndpointAndCreditSummary(
    astroWayRaw,
    freeAstroApiSupplementary,
    localModules
  );

  // Step 5: Keep Layer C analytical intelligence strictly deferred by scope
  const layerCShell = buildLayerCAnalyticalShell(layerBMaster);

  const localAvAudit =
    (layerBMaster.providerExtendedDatasets?.localAshtakavargaAudit as Record<string, unknown> | null) ??
    null;

  return {
    schemaVersion: 'v2.compiled_foundational_chart.1.0',
    compiledAtUtc: new Date().toISOString(),
    canonicalBirthInstant: instant,
    layerBMaster,
    layerCShell,
    localModules,
    verification,
    manifest,
    completenessTable,
    datasetInventory,
    compatibilityGates: layerBMaster.supplementaryIntegration ?? null,
    localAshtakavargaAudit: localAvAudit,
    endpointAndCreditSummary,
    externalValidationBlockers: verification.externalReferenceAudit?.blockers ?? [],
  };
}
