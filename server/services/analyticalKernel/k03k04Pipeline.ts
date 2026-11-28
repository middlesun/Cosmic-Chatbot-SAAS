/**
 * CosmicCouncil Proprietary Analytical Intelligence Kernel — Staged 5-Stage K01–K04 Pipeline
 *
 * Pure TypeScript / Web-standard implementation (zero Node built-ins; Cloudflare Workers safe).
 * Zero LLM calls, zero live API calls, zero DB writes, zero production chart mutations.
 *
 * Non-Circular 5-Stage Execution Order:
 *   Stage 1: Canonical Evidence Repository (`K01` — `buildAnalyticalEvidenceRepository`)
 *   Stage 2: Planetary State Intelligence (`K02` — `evaluateK02FromRepository`)
 *   Stage 3: Initial Contextual Authority Pass 1 (`K03` — `evaluateK03ContextualAuthority`, NO `relationalContext`)
 *   Stage 4: Relational Intelligence (`K04` — NIG + Tarjan Dispositor/DCI + P08 Influence Footprint)
 *   Stage 5: Bounded Relationship-Dependent Authority Enrichment (`K03` Pass 2 consuming `K04` dispositor context)
 *            + Unified Non-Mutating `P05` / `P08` / `P09` Enrichment Projection
 */

import type { LayerCAnalyticalInput } from '../v2Engine/layerCContract';
import type {
  CompiledV2FoundationalChartResult,
  LayerBMasterChartRecord,
} from '../v2Engine/types';
import { evaluateK03ContextualAuthority } from './contextualAuthorityEngine';
import {
  K04_DISPOSITOR_ENGINE_VERSION,
  analyzeK04DispositorAndDependencies,
  buildK03RelationalContextFromDispositorAnalysis,
  type AnalyzeK04DispositorOptions,
  type K04DispositorDependencyAnalysisResult,
} from './dispositorDependencyEngine';
import {
  K03_AUTHORITY_ENGINE_VERSION,
  R04_AUTHORITY_REGISTRY_VERSION,
  type AnalyticalKernelK03AuthorityResult,
  type EvaluateK03ContextualAuthorityOptions,
  type K03P05SubjectAuthorityProfile,
  type K03P09FunctionalOrientationProfile,
  type K03RelationalContextInput,
} from './k03Types';
import {
  K04_NIG_SCHEMA_VERSION,
  K04_RELATIONAL_ENGINE_VERSION,
  type NatalIntelligenceGraph,
} from './k04Types';
import { buildNatalIntelligenceGraph } from './natalIntelligenceGraph';
import {
  K04_P08_ENRICHMENT_VERSION,
  buildK04InfluenceFootprintEnrichment,
  type K04InfluenceFootprintEnrichmentResult,
} from './p08FootprintEnrichment';
import type { EvaluateK02PlanetaryStatesOptions } from './planetaryStateEngine';
import {
  buildAnalyticalEvidenceRepository,
  evaluateK02FromRepository,
} from './repositoryBuilder';
import { R07_MATH_MODEL_REGISTRY_VERSION } from './ruleRegistry';
import {
  ANALYTICAL_KERNEL_VERSION,
  ANALYTICAL_RULE_REGISTRY_VERSION,
  K02_PROJECTION_SCHEMA_VERSION,
  K02_STATE_ENGINE_VERSION,
  REPOSITORY_SCHEMA_VERSION,
  type AnalyticalEvidenceRepository,
  type AnalyticalKernelK02StateResult,
  type CanonicalEvidenceFrame,
  type PlanetaryStateSubjectName,
} from './types';

export const K03_K04_PIPELINE_VERSION = 'k03_k04.pipeline.1.0' as const;

export const K01_TO_K04_STAGE_ORDER = Object.freeze([
  'stage1_k01_evidence_repository',
  'stage2_k02_planetary_states',
  'stage3_k03_contextual_authority_pass1',
  'stage4_k04_relational_intelligence',
  'stage5_k03_relational_enrichment_pass2',
] as const);

export type K01ToK04StageId = (typeof K01_TO_K04_STAGE_ORDER)[number];

export interface EvaluateK04RelationalOptions {
  targetFrames?: readonly CanonicalEvidenceFrame[];
}

export interface K04RelationalIntelligenceResult {
  engineVersion: typeof K04_RELATIONAL_ENGINE_VERSION;
  nigSchemaVersion: typeof K04_NIG_SCHEMA_VERSION;
  dispositorEngineVersion: typeof K04_DISPOSITOR_ENGINE_VERSION;
  p08EnrichmentVersion: typeof K04_P08_ENRICHMENT_VERSION;
  sourceInputFingerprint: string;
  generatedAtUtc: string;
  nig: NatalIntelligenceGraph;
  dispositorAnalysis: K04DispositorDependencyAnalysisResult;
  p08InfluenceFootprint: K04InfluenceFootprintEnrichmentResult;
}

export interface BuildK03K04BundleOptions {
  k02Options?: EvaluateK02PlanetaryStatesOptions;
  k03Pass1Options?: Omit<EvaluateK03ContextualAuthorityOptions, 'relationalContext'>;
  k04Options?: EvaluateK04RelationalOptions;
  k03Pass2Options?: Omit<EvaluateK03ContextualAuthorityOptions, 'relationalContext'>;
  relationalContextFrame?: CanonicalEvidenceFrame;
}

export interface K01ToK04StageTelemetry {
  stageNumber: 1 | 2 | 3 | 4 | 5;
  stageId: K01ToK04StageId;
  durationMs: number;
  summaryCounts: Record<string, number | string | boolean | null>;
}

export interface UnifiedK03K04EnrichmentProjection {
  schemaVersion: typeof K03_K04_PIPELINE_VERSION;
  p05AuthorityBySubject: Record<PlanetaryStateSubjectName, K03P05SubjectAuthorityProfile>;
  p08InfluenceFootprint: K04InfluenceFootprintEnrichmentResult;
  p09FunctionalOrientationBySubject: Record<
    PlanetaryStateSubjectName,
    K03P09FunctionalOrientationProfile
  >;
  epistemicGuarantees: {
    mutatedK01Repository: false;
    mutatedK02State: false;
    circularDependencyDetected: false;
    nonCircularStageOrder: readonly K01ToK04StageId[];
    k03Pass1RelationalContextApplied: boolean;
    k03Pass2RelationalContextApplied: boolean;
  };
}

export const ANALYTICAL_REPRESENTATION_TIERS = [
  'normalized_canonical',
  'expanded_diagnostic',
  'focused_consumption',
] as const;

export type AnalyticalRepresentationTier = (typeof ANALYTICAL_REPRESENTATION_TIERS)[number];

export interface AnalyticalRepresentationArchitecture {
  currentBundleRepresentationTier: 'expanded_diagnostic';
  distinguishedTiers: {
    normalizedCanonical: {
      tier: 'normalized_canonical';
      role: string;
      referenceKeyStrategy: string;
      avoidsRedundantEmbeddings: readonly string[];
    };
    expandedDiagnostic: {
      tier: 'expanded_diagnostic';
      role: string;
      preservedForensicSections: readonly string[];
    };
    focusedConsumption: {
      tier: 'focused_consumption';
      role: string;
      builderFunction: 'buildFocusedK03K04ConsumptionView';
    };
  };
  recommendedIncrementalOptimizationStrategy: readonly string[];
}

export interface RepresentationEfficiencyProfile {
  measuredAtUtc: string;
  normalizedVolatileFields: boolean;
  expandedDiagnosticTotalBytes: number;
  focusedConsumptionBytes: number;
  focusedToExpandedPercent: number;
  topLevelSectionBytes: {
    k01RepositoryBytes: number;
    k02StateBytes: number;
    k03Pass1AuthorityBytes: number;
    k04RelationalBytes: number;
    k03RelationalContextBridgeBytes: number;
    k03AuthorityBytes: number;
    enrichmentProjectionBytes: number;
    manifestBytes: number;
  };
  duplicationAndExpansionContributorsBytes: {
    k03Pass1AuthorityDuplicateBytes: number;
    k03Pass2CearDimensionAssessmentsBytes: number;
    nigDuplicateLookupMapsBytes: number;
    enrichmentProjectionDuplicateBytes: number;
    dispositorPrimaryD1DuplicateBytes: number;
    k02CompatibilityMirrorAliasBytes: number;
  };
  recommendedIncrementalOptimizationStrategy: readonly string[];
}

export interface FocusedK03K04ConsumptionView {
  schemaVersion: typeof K03_K04_PIPELINE_VERSION;
  representationTier: 'focused_consumption';
  generatedAtUtc: string;
  sourceInputFingerprint: string;
  manifestSummary: {
    pipelineVersion: typeof K03_K04_PIPELINE_VERSION;
    stageOrder: readonly K01ToK04StageId[];
    summaryCounts: AnalyticalKernelK03K04Manifest['summaryCounts'];
    compatibilityGuarantees: AnalyticalKernelK03K04Manifest['compatibilityGuarantees'];
    deferredCapabilities: readonly string[];
  };
  authorityScopeGuarantees: AnalyticalKernelK03AuthorityResult['authorityScopeGuarantees'];
  subjects: Record<
    PlanetaryStateSubjectName,
    {
      subject: PlanetaryStateSubjectName;
      k02TrustCeiling: string;
      k02ConfidenceCeiling: string;
      p05ObjectiveSummaries: Array<{
        objectiveId: string;
        highestClassification: string;
        qualifiedRecordCount: number;
        excludedRecordCount: number;
        provisionalCapped: boolean;
      }>;
      p05DiagnosticSummaryNote: string;
      p09FunctionalOrientation: {
        status: K03P09FunctionalOrientationProfile['status'];
        lagnaSign: K03P09FunctionalOrientationProfile['lagnaSign'];
        role: K03P09FunctionalOrientationProfile['role'];
        conditionalMaraka: boolean | null;
        conditionalMarakaHouses: number[];
        ruledHouses: number[];
        coexistingResponsibilitiesCount: number;
        naturalPolarity: K03P09FunctionalOrientationProfile['naturalSignifications']['naturalPolarity'];
      };
      p08FootprintSummary: {
        semanticCountBreakdown: K04InfluenceFootprintEnrichmentResult['subjectFootprints'][PlanetaryStateSubjectName]['semanticCountBreakdown'];
        d1DependencySummary: {
          directDispositorSubject: PlanetaryStateSubjectName | null;
          hopsToTerminalBasin: number | null;
          terminalKind: string | null;
          isInCycle: boolean;
          isTopologicalSinkWithInboundFeed: boolean;
          functionalBottleneckEstablished: false;
          functionalRedundancyEstablished: false;
        } | null;
      };
      referencedCearIds: string[];
    }
  >;
  d1DispositorSummary: {
    analyzedFrames: string[];
    dci: number | null;
    isComplete: boolean;
    renormalized: false;
    terminalBasins: K04DispositorDependencyAnalysisResult['frames'][string]['terminalBasins'];
    hasSingleFinalDispositor: boolean;
    singleFinalDispositorEntityId: string | null;
  } | null;
  nigVerificationStats: NatalIntelligenceGraph['verificationStats'];
}

export interface AnalyticalKernelK03K04Manifest {
  pipelineVersion: typeof K03_K04_PIPELINE_VERSION;
  generatedAtUtc: string;
  sourceInputFingerprint: string;
  representationTier: 'expanded_diagnostic';
  representationArchitecture: AnalyticalRepresentationArchitecture;
  schemaVersions: {
    k01Kernel: typeof ANALYTICAL_KERNEL_VERSION;
    k01Repository: typeof REPOSITORY_SCHEMA_VERSION;
    k02StateEngine: typeof K02_STATE_ENGINE_VERSION;
    k02Projection: typeof K02_PROJECTION_SCHEMA_VERSION;
    k02RuleRegistry: typeof ANALYTICAL_RULE_REGISTRY_VERSION;
    k03AuthorityEngine: typeof K03_AUTHORITY_ENGINE_VERSION;
    r04AuthorityRegistry: typeof R04_AUTHORITY_REGISTRY_VERSION;
    k04RelationalEngine: typeof K04_RELATIONAL_ENGINE_VERSION;
    k04NigSchema: typeof K04_NIG_SCHEMA_VERSION;
    k04DispositorEngine: typeof K04_DISPOSITOR_ENGINE_VERSION;
    k04P08Enrichment: typeof K04_P08_ENRICHMENT_VERSION;
    r07MathModelRegistry: typeof R07_MATH_MODEL_REGISTRY_VERSION;
  };
  stageOrder: readonly K01ToK04StageId[];
  totalDurationMs: number;
  stages: K01ToK04StageTelemetry[];
  summaryCounts: {
    natalEvidenceCount: number;
    temporalEvidenceCount: number;
    blockedFramesCount: number;
    k02RuleEvaluationsCount: number;
    k02ImpactContractsCount: number;
    k03Pass1CearCount: number;
    k03Pass2CearCount: number;
    nigNodeCount: number;
    nigEdgeCount: number;
    dispositorAnalyzedFramesCount: number;
    d1Dci: number | null;
    d1BasinCount: number;
    nigDuplicateIdCount: number;
    nigUnresolvedEvidenceRefCount: number;
    nigDanglingEndpointCount: number;
  };
  compatibilityGuarantees: {
    k01BackwardCompatible: true;
    k02BackwardCompatible: true;
    k01Mutated: false;
    k02Mutated: false;
    zeroNodeBuiltins: true;
    zeroLlmCalls: true;
    zeroLiveApiCalls: true;
    zeroDatabaseWrites: true;
    nonCircularTwoPassK03: true;
  };
  deferredCapabilities: readonly string[];
}

export interface AnalyticalKernelK03K04Bundle {
  pipelineVersion: typeof K03_K04_PIPELINE_VERSION;
  generatedAtUtc: string;
  sourceInputFingerprint: string;
  k01Repository: AnalyticalEvidenceRepository;
  k02State: AnalyticalKernelK02StateResult;
  k03Pass1Authority: AnalyticalKernelK03AuthorityResult;
  k04Relational: K04RelationalIntelligenceResult;
  k03RelationalContextBridge: K03RelationalContextInput;
  k03Authority: AnalyticalKernelK03AuthorityResult;
  enrichmentProjection: UnifiedK03K04EnrichmentProjection;
  manifest: AnalyticalKernelK03K04Manifest;
}

/**
 * Stage 4 pure helper: builds Natal Intelligence Graph (NIG), runs frame-isolated Tarjan SCC
 * dispositor & dependency analysis (DCI + 6 dependency properties), and generates non-mutating
 * P08 influence footprint enrichments. Accepts optional Pass 1 K03 authority for lagna functional roles.
 */
export function evaluateK04RelationalIntelligence(
  repo: AnalyticalEvidenceRepository,
  k02State: AnalyticalKernelK02StateResult,
  k03Pass1?: AnalyticalKernelK03AuthorityResult | null,
  options: EvaluateK04RelationalOptions = {}
): K04RelationalIntelligenceResult {
  const nig = buildNatalIntelligenceGraph(repo, {
    k03Result: k03Pass1 ?? null,
  });

  const dispOpts: AnalyzeK04DispositorOptions = {};
  if (options.targetFrames) {
    dispOpts.targetFrames = options.targetFrames;
  }
  const dispositorAnalysis = analyzeK04DispositorAndDependencies(nig, k02State, dispOpts);
  const p08InfluenceFootprint = buildK04InfluenceFootprintEnrichment(
    nig,
    k02State,
    dispositorAnalysis
  );

  return {
    engineVersion: K04_RELATIONAL_ENGINE_VERSION,
    nigSchemaVersion: K04_NIG_SCHEMA_VERSION,
    dispositorEngineVersion: K04_DISPOSITOR_ENGINE_VERSION,
    p08EnrichmentVersion: K04_P08_ENRICHMENT_VERSION,
    sourceInputFingerprint: repo.sourceChart.inputFingerprint,
    generatedAtUtc: new Date().toISOString(),
    nig,
    dispositorAnalysis,
    p08InfluenceFootprint,
  };
}

/**
 * Runs Stages 2–5 (or Stages 3–5 when pre-computed `k02State` is supplied) directly
 * from an existing K01 `AnalyticalEvidenceRepository` without mutating K01 or K02.
 */
export function evaluateK03K04FromRepository(
  k01Repository: AnalyticalEvidenceRepository,
  precomputedK02State?: AnalyticalKernelK02StateResult | null,
  options: BuildK03K04BundleOptions = {},
  stage1DurationMs = 0
): AnalyticalKernelK03K04Bundle {
  const pipelineStartedMs = Date.now();
  const stage1Telemetry: K01ToK04StageTelemetry = {
    stageNumber: 1,
    stageId: 'stage1_k01_evidence_repository',
    durationMs: stage1DurationMs,
    summaryCounts: {
      natalEvidenceCount: k01Repository.natalEvidence.length,
      temporalEvidenceCount: k01Repository.temporalEvidence.length,
      blockedFramesCount: k01Repository.rejectedOrBlockedFrames.length,
      overlapRelationsCount: k01Repository.lineageGraph.overlapRelations.length,
    },
  };

  // Stage 2: K02 Planetary States
  const s2Start = Date.now();
  const k02State =
    precomputedK02State ?? evaluateK02FromRepository(k01Repository, options.k02Options);
  const s2Dur = Math.max(0, Date.now() - s2Start);
  const stage2Telemetry: K01ToK04StageTelemetry = {
    stageNumber: 2,
    stageId: 'stage2_k02_planetary_states',
    durationMs: s2Dur,
    summaryCounts: {
      ruleEvaluations: k02State.ruleExecutionSummary.totalEvaluations,
      impactContracts: k02State.impactContracts.length,
      phiProjections: k02State.phiReadyProjections.length,
      unregisteredRuleRejections: k02State.ruleExecutionSummary.unregisteredRuleRejections,
    },
  };

  // Stage 3: K03 Contextual Authority Pass 1 (strictly no relationalContext — non-circular)
  const s3Start = Date.now();
  const k03Pass1Authority = evaluateK03ContextualAuthority(
    k01Repository,
    k02State,
    options.k03Pass1Options
  );
  const s3Dur = Math.max(0, Date.now() - s3Start);
  const stage3Telemetry: K01ToK04StageTelemetry = {
    stageNumber: 3,
    stageId: 'stage3_k03_contextual_authority_pass1',
    durationMs: s3Dur,
    summaryCounts: {
      cearCount: k03Pass1Authority.cearRecords.length,
      relationalContextApplied: k03Pass1Authority.relationalContextApplied,
      unresolvedRequirements: k03Pass1Authority.unresolvedRequirements.length,
      doubleCountingGuardsApplied: k03Pass1Authority.independenceSummaries.doubleCountingGuardsApplied,
    },
  };

  // Stage 4: K04 Relational Intelligence (NIG + Tarjan Dispositor/DCI + P08 Enrichment)
  const s4Start = Date.now();
  const k04Relational = evaluateK04RelationalIntelligence(
    k01Repository,
    k02State,
    k03Pass1Authority,
    options.k04Options
  );
  const s4Dur = Math.max(0, Date.now() - s4Start);
  const stage4Telemetry: K01ToK04StageTelemetry = {
    stageNumber: 4,
    stageId: 'stage4_k04_relational_intelligence',
    durationMs: s4Dur,
    summaryCounts: {
      nigNodes: k04Relational.nig.verificationStats.totalNodes,
      nigEdges: k04Relational.nig.verificationStats.totalEdges,
      analyzedFrames: k04Relational.dispositorAnalysis.analyzedFrames.length,
      d1Dci: k04Relational.dispositorAnalysis.primaryD1Frame?.dci.dci ?? null,
      d1TerminalBasins:
        k04Relational.dispositorAnalysis.primaryD1Frame?.terminalBasins.length ?? 0,
      duplicateIdCount: k04Relational.nig.verificationStats.duplicateIdCount,
      unresolvedEvidenceRefCount:
        k04Relational.nig.verificationStats.unresolvedEvidenceRefCount,
      danglingEndpointCount: k04Relational.nig.verificationStats.danglingEndpointCount,
    },
  };

  // Stage 5: Bounded Relationship-Dependent Authority Enrichment (K03 Pass 2)
  const s5Start = Date.now();
  const bridgeFrame: CanonicalEvidenceFrame = options.relationalContextFrame ?? 'vedic_lahiri';
  const k03RelationalContextBridge = buildK03RelationalContextFromDispositorAnalysis(
    k04Relational.dispositorAnalysis,
    bridgeFrame
  );
  const k03Authority = evaluateK03ContextualAuthority(k01Repository, k02State, {
    ...options.k03Pass1Options,
    ...options.k03Pass2Options,
    relationalContext: k03RelationalContextBridge,
  });
  const s5Dur = Math.max(0, Date.now() - s5Start);
  const stage5Telemetry: K01ToK04StageTelemetry = {
    stageNumber: 5,
    stageId: 'stage5_k03_relational_enrichment_pass2',
    durationMs: s5Dur,
    summaryCounts: {
      cearCount: k03Authority.cearRecords.length,
      relationalContextApplied: k03Authority.relationalContextApplied,
      qualifiedRelationalEvidenceCount:
        k03RelationalContextBridge.qualifiedRelationalEvidenceIds.length,
      bridgeFrame,
    },
  };

  const generatedAtUtc = new Date().toISOString();
  const totalDurationMs =
    stage1DurationMs + Math.max(0, Date.now() - pipelineStartedMs);

  const enrichmentProjection: UnifiedK03K04EnrichmentProjection = {
    schemaVersion: K03_K04_PIPELINE_VERSION,
    p05AuthorityBySubject: k03Authority.planetaryAuthorityEnrichment,
    p08InfluenceFootprint: k04Relational.p08InfluenceFootprint,
    p09FunctionalOrientationBySubject: k03Authority.functionalOrientationProfiles,
    epistemicGuarantees: {
      mutatedK01Repository: false,
      mutatedK02State: false,
      circularDependencyDetected: false,
      nonCircularStageOrder: K01_TO_K04_STAGE_ORDER,
      k03Pass1RelationalContextApplied: k03Pass1Authority.relationalContextApplied,
      k03Pass2RelationalContextApplied: k03Authority.relationalContextApplied,
    },
  };

  const stages = [
    stage1Telemetry,
    stage2Telemetry,
    stage3Telemetry,
    stage4Telemetry,
    stage5Telemetry,
  ];

  const manifest: AnalyticalKernelK03K04Manifest = {
    pipelineVersion: K03_K04_PIPELINE_VERSION,
    generatedAtUtc,
    sourceInputFingerprint: k01Repository.sourceChart.inputFingerprint,
    representationTier: 'expanded_diagnostic',
    representationArchitecture: {
      currentBundleRepresentationTier: 'expanded_diagnostic',
      distinguishedTiers: {
        normalizedCanonical: {
          tier: 'normalized_canonical',
          role: 'Single-copy canonical analytical records linked by deterministic IDs (ev_*, imp_*, cear_*, rel_*) without repeated Pass-1 clones, duplicate lookup maps, or verbose expanded dimension prose.',
          referenceKeyStrategy: 'evidenceId / authorityRecordId / relationshipId / ruleId',
          avoidsRedundantEmbeddings: [
            'k03Pass1Authority (emit Pass-1 vs Pass-2 diff/delta IDs instead of full 6.6 MB clone)',
            'nig.nodesById & nig.edgesById (reconstructable in-memory from nig.nodes & nig.edges)',
            'enrichmentProjection duplicate sub-trees (reference k03Authority.p05/p09 & k04Relational.p08)',
            'dispositorAnalysis.primaryD1Frame duplicate (reference frames.vedic_lahiri)',
            'k02State backward-compatibility alias mirrors (k02ImpactContracts, phiReadyProjection, nodalProfiles, ascendantProfile)',
            'repeated rule registry snapshots and verbose per-CEAR 10-dimension prose when canonical dimension status tuples suffice',
          ],
        },
        expandedDiagnostic: {
          tier: 'expanded_diagnostic',
          role: 'Complete forensic audit and laboratory export retaining full K01 lineage, K02 compatibility mirrors, both K03 Pass-1 and Pass-2 snapshots, full 10-dimension CEAR assessments, and pre-indexed NIG maps.',
          preservedForensicSections: [
            'k01Repository',
            'k02State',
            'k03Pass1Authority',
            'k04Relational',
            'k03Authority',
            'enrichmentProjection',
            'manifest',
          ],
        },
        focusedConsumption: {
          tier: 'focused_consumption',
          role: 'Compact ID/reference-backed analytical summary tailored for future tools, reasoning modules, and UI views without losing evidence lineage.',
          builderFunction: 'buildFocusedK03K04ConsumptionView',
        },
      },
      recommendedIncrementalOptimizationStrategy: [
        '1. Emit Pass-1 -> Pass-2 CEAR delta record IDs instead of serializing a second full k03Pass1Authority copy (~24.7% bundle savings).',
        '2. Rehydrate nig.nodesById, nig.edgesById, and primaryD1Frame in memory rather than duplicating ~2.3 MB in serialized canonical JSON.',
        '3. Normalize repeated rule/methodology descriptions and CEAR dimensionAssessments into shared lookup tables keyed by ruleId and compact dimension status codes (~4.3 MB savings).',
        '4. Reference p05/p08/p09 in enrichmentProjection by subject/ID or consume buildFocusedK03K04ConsumptionView for runtime consumers (~2.0 MB savings).',
        '5. Retain expanded_diagnostic solely for explicit forensic/lab exports and regression auditing.',
      ],
    },
    schemaVersions: {
      k01Kernel: ANALYTICAL_KERNEL_VERSION,
      k01Repository: REPOSITORY_SCHEMA_VERSION,
      k02StateEngine: K02_STATE_ENGINE_VERSION,
      k02Projection: K02_PROJECTION_SCHEMA_VERSION,
      k02RuleRegistry: ANALYTICAL_RULE_REGISTRY_VERSION,
      k03AuthorityEngine: K03_AUTHORITY_ENGINE_VERSION,
      r04AuthorityRegistry: R04_AUTHORITY_REGISTRY_VERSION,
      k04RelationalEngine: K04_RELATIONAL_ENGINE_VERSION,
      k04NigSchema: K04_NIG_SCHEMA_VERSION,
      k04DispositorEngine: K04_DISPOSITOR_ENGINE_VERSION,
      k04P08Enrichment: K04_P08_ENRICHMENT_VERSION,
      r07MathModelRegistry: R07_MATH_MODEL_REGISTRY_VERSION,
    },
    stageOrder: K01_TO_K04_STAGE_ORDER,
    totalDurationMs,
    stages,
    summaryCounts: {
      natalEvidenceCount: k01Repository.natalEvidence.length,
      temporalEvidenceCount: k01Repository.temporalEvidence.length,
      blockedFramesCount: k01Repository.rejectedOrBlockedFrames.length,
      k02RuleEvaluationsCount: k02State.ruleExecutionSummary.totalEvaluations,
      k02ImpactContractsCount: k02State.impactContracts.length,
      k03Pass1CearCount: k03Pass1Authority.cearRecords.length,
      k03Pass2CearCount: k03Authority.cearRecords.length,
      nigNodeCount: k04Relational.nig.verificationStats.totalNodes,
      nigEdgeCount: k04Relational.nig.verificationStats.totalEdges,
      dispositorAnalyzedFramesCount: k04Relational.dispositorAnalysis.analyzedFrames.length,
      d1Dci: k04Relational.dispositorAnalysis.primaryD1Frame?.dci.dci ?? null,
      d1BasinCount:
        k04Relational.dispositorAnalysis.primaryD1Frame?.terminalBasins.length ?? 0,
      nigDuplicateIdCount: k04Relational.nig.verificationStats.duplicateIdCount,
      nigUnresolvedEvidenceRefCount:
        k04Relational.nig.verificationStats.unresolvedEvidenceRefCount,
      nigDanglingEndpointCount: k04Relational.nig.verificationStats.danglingEndpointCount,
    },
    compatibilityGuarantees: {
      k01BackwardCompatible: true,
      k02BackwardCompatible: true,
      k01Mutated: false,
      k02Mutated: false,
      zeroNodeBuiltins: true,
      zeroLlmCalls: true,
      zeroLiveApiCalls: true,
      zeroDatabaseWrites: true,
      nonCircularTwoPassK03: true,
    },
    deferredCapabilities: [
      'CanonicalStrengthEngine (Shadbala/Bhavabala reconciliation pending Issue Register)',
      'K05 — Interaction Intelligence',
      'K06 — Structural Intelligence',
      'K07 — Conflict Intelligence',
      'K08 — Deliverability Intelligence',
      'K09 — Temporal Intelligence',
      'K10 — Adjudication Intelligence',
      'PHI / AHI / PAI / YSI / DSI Quantitative Indices',
    ],
  };

  return {
    pipelineVersion: K03_K04_PIPELINE_VERSION,
    generatedAtUtc,
    sourceInputFingerprint: k01Repository.sourceChart.inputFingerprint,
    k01Repository,
    k02State,
    k03Pass1Authority,
    k04Relational,
    k03RelationalContextBridge,
    k03Authority,
    enrichmentProjection,
    manifest,
  };
}

const UTF8_ENCODER = new TextEncoder();

function measureUtf8Bytes(value: unknown, normalizeVolatile = false): number {
  const json = normalizeVolatile
    ? JSON.stringify(value, (key, val) => {
        if (key === 'generatedAtUtc' || key === 'preparedAtUtc' || key === 'measuredAtUtc') {
          return 'FIXED_TS';
        }
        if (key === 'durationMs' || key === 'totalDurationMs') return 0;
        return val;
      })
    : JSON.stringify(value);
  return UTF8_ENCODER.encode(json).length;
}

/**
 * Produces a lightweight, ID/reference-driven `focused_consumption` projection from the full
 * `expanded_diagnostic` bundle without mutating or losing reference lineage (`ev_*`, `cear_*`, `rel_*`).
 */
export function buildFocusedK03K04ConsumptionView(
  bundle: AnalyticalKernelK03K04Bundle
): FocusedK03K04ConsumptionView {
  const subjects = {} as FocusedK03K04ConsumptionView['subjects'];
  const subjectKeys = Object.keys(
    bundle.k03Authority.planetaryAuthorityEnrichment
  ) as PlanetaryStateSubjectName[];

  for (const subject of subjectKeys) {
    const k02Rec = bundle.k02State.subjectStates[subject];
    const p05 = bundle.k03Authority.planetaryAuthorityEnrichment[subject];
    const p09 = bundle.k03Authority.functionalOrientationProfiles[subject];
    const p08 = bundle.k04Relational.p08InfluenceFootprint.subjectFootprints[subject];
    const d1Dep = bundle.k04Relational.dispositorAnalysis.primaryD1Frame?.subjectProfiles[subject];

    subjects[subject] = {
      subject,
      k02TrustCeiling: k02Rec?.overlays.reliability.overallTrust ?? 'unavailable',
      k02ConfidenceCeiling: k02Rec?.overlays.reliability.confidenceCeiling ?? 'insufficient_data',
      p05ObjectiveSummaries: Object.values(p05.objectiveAuthorities).map((obj) => ({
        objectiveId: obj.objectiveId,
        highestClassification: obj.highestClassification,
        qualifiedRecordCount: obj.qualifiedRecordCount,
        excludedRecordCount: obj.excludedRecordCount,
        provisionalCapped: obj.provisionalCapped,
      })),
      p05DiagnosticSummaryNote: p05.overallHighestClassificationDiagnosticMeta.note,
      p09FunctionalOrientation: {
        status: p09.status,
        lagnaSign: p09.lagnaSign,
        role: p09.role,
        conditionalMaraka: p09.conditionalMaraka,
        conditionalMarakaHouses: [...p09.conditionalMarakaHouses],
        ruledHouses: [...p09.directHouseLordships.ruledHouses],
        coexistingResponsibilitiesCount: p09.coexistingResponsibilities.length,
        naturalPolarity: p09.naturalSignifications.naturalPolarity,
      },
      p08FootprintSummary: {
        semanticCountBreakdown: p08.semanticCountBreakdown,
        d1DependencySummary: d1Dep
          ? {
              directDispositorSubject: d1Dep.directDispositorSubject,
              hopsToTerminalBasin: d1Dep.properties.depth.hopsToTerminalBasin,
              terminalKind: d1Dep.properties.depth.terminalKind,
              isInCycle: d1Dep.properties.depth.isInCycle,
              isTopologicalSinkWithInboundFeed:
                d1Dep.properties.criticality.isTopologicalSinkWithInboundFeed,
              functionalBottleneckEstablished: false,
              functionalRedundancyEstablished: false,
            }
          : null,
      },
      referencedCearIds: [...p05.cearRecordIds],
    };
  }

  const d1 = bundle.k04Relational.dispositorAnalysis.primaryD1Frame;
  return {
    schemaVersion: K03_K04_PIPELINE_VERSION,
    representationTier: 'focused_consumption',
    generatedAtUtc: bundle.generatedAtUtc,
    sourceInputFingerprint: bundle.sourceInputFingerprint,
    manifestSummary: {
      pipelineVersion: bundle.manifest.pipelineVersion,
      stageOrder: bundle.manifest.stageOrder,
      summaryCounts: bundle.manifest.summaryCounts,
      compatibilityGuarantees: bundle.manifest.compatibilityGuarantees,
      deferredCapabilities: bundle.manifest.deferredCapabilities,
    },
    authorityScopeGuarantees: bundle.k03Authority.authorityScopeGuarantees,
    subjects,
    d1DispositorSummary: d1
      ? {
          analyzedFrames: [...bundle.k04Relational.dispositorAnalysis.analyzedFrames],
          dci: d1.dci.dci,
          isComplete: d1.dci.isComplete,
          renormalized: d1.dci.renormalized,
          terminalBasins: d1.terminalBasins,
          hasSingleFinalDispositor: d1.hasSingleFinalDispositor,
          singleFinalDispositorEntityId: d1.singleFinalDispositorEntityId,
        }
      : null,
    nigVerificationStats: bundle.k04Relational.nig.verificationStats,
  };
}

/**
 * Pure Web-standard serializer telemetry auditing exact UTF-8 byte contributors of the
 * expanded diagnostic bundle vs the compact focused consumption representation.
 */
export function analyzeBundleRepresentationEfficiency(
  bundle: AnalyticalKernelK03K04Bundle,
  options: { normalizeVolatileFields?: boolean } = {}
): RepresentationEfficiencyProfile {
  const norm = Boolean(options.normalizeVolatileFields);
  const expandedDiagnosticTotalBytes = measureUtf8Bytes(bundle, norm);
  const focusedView = buildFocusedK03K04ConsumptionView(bundle);
  const focusedConsumptionBytes = measureUtf8Bytes(focusedView, norm);

  const k01RepositoryBytes = measureUtf8Bytes(bundle.k01Repository, norm);
  const k02StateBytes = measureUtf8Bytes(bundle.k02State, norm);
  const k03Pass1AuthorityBytes = measureUtf8Bytes(bundle.k03Pass1Authority, norm);
  const k04RelationalBytes = measureUtf8Bytes(bundle.k04Relational, norm);
  const k03RelationalContextBridgeBytes = measureUtf8Bytes(bundle.k03RelationalContextBridge, norm);
  const k03AuthorityBytes = measureUtf8Bytes(bundle.k03Authority, norm);
  const enrichmentProjectionBytes = measureUtf8Bytes(bundle.enrichmentProjection, norm);
  const manifestBytes = measureUtf8Bytes(bundle.manifest, norm);

  const k03Pass2CearDimensionAssessmentsBytes = bundle.k03Authority.cearRecords.reduce(
    (acc, rec) => acc + measureUtf8Bytes(rec.dimensionAssessments, norm),
    0
  );
  const nigDuplicateLookupMapsBytes =
    measureUtf8Bytes(bundle.k04Relational.nig.nodesById, norm) +
    measureUtf8Bytes(bundle.k04Relational.nig.edgesById, norm);
  const dispositorPrimaryD1DuplicateBytes = measureUtf8Bytes(
    bundle.k04Relational.dispositorAnalysis.primaryD1Frame,
    norm
  );
  const k02CompatibilityMirrorAliasBytes =
    measureUtf8Bytes(bundle.k02State.k02ImpactContracts, norm) +
    measureUtf8Bytes(bundle.k02State.phiReadyProjection, norm) +
    measureUtf8Bytes(bundle.k02State.nodalProfiles, norm) +
    measureUtf8Bytes(bundle.k02State.ascendantProfile, norm);

  return {
    measuredAtUtc: norm ? 'FIXED_TS' : new Date().toISOString(),
    normalizedVolatileFields: norm,
    expandedDiagnosticTotalBytes,
    focusedConsumptionBytes,
    focusedToExpandedPercent:
      expandedDiagnosticTotalBytes > 0
        ? Number(((focusedConsumptionBytes / expandedDiagnosticTotalBytes) * 100).toFixed(2))
        : 0,
    topLevelSectionBytes: {
      k01RepositoryBytes,
      k02StateBytes,
      k03Pass1AuthorityBytes,
      k04RelationalBytes,
      k03RelationalContextBridgeBytes,
      k03AuthorityBytes,
      enrichmentProjectionBytes,
      manifestBytes,
    },
    duplicationAndExpansionContributorsBytes: {
      k03Pass1AuthorityDuplicateBytes: k03Pass1AuthorityBytes,
      k03Pass2CearDimensionAssessmentsBytes,
      nigDuplicateLookupMapsBytes,
      enrichmentProjectionDuplicateBytes: enrichmentProjectionBytes,
      dispositorPrimaryD1DuplicateBytes,
      k02CompatibilityMirrorAliasBytes,
    },
    recommendedIncrementalOptimizationStrategy:
      bundle.manifest.representationArchitecture.recommendedIncrementalOptimizationStrategy,
  };
}

/**
 * Primary non-circular 5-stage K01 -> K02 -> K03(Pass1) -> K04 -> K03(Pass2) orchestrator.
 */
export function buildAnalyticalKernelK03K04Bundle(
  source: CompiledV2FoundationalChartResult | LayerBMasterChartRecord | LayerCAnalyticalInput,
  options: BuildK03K04BundleOptions = {}
): AnalyticalKernelK03K04Bundle {
  const s1Start = Date.now();
  const k01Repository = buildAnalyticalEvidenceRepository(source);
  const s1Dur = Math.max(0, Date.now() - s1Start);
  return evaluateK03K04FromRepository(k01Repository, null, options, s1Dur);
}
