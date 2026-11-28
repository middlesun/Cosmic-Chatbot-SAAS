/**
 * CosmicCouncil Proprietary Analytical Intelligence Kernel — K03 Contextual Evidence Authority Engine
 *
 * Pure TypeScript / Web-standard implementation (zero Node built-ins; Cloudflare Workers safe).
 * Executes Layer C Capability K03 without mutating K01 `AnalyticalEvidenceRepository`,
 * K02 `AnalyticalKernelK02StateResult`, or any `CanonicalEvidenceObject`.
 *
 * Key Architectural Guarantees:
 *  - Policy Hierarchy: Layer 1 (UniversalIntegrityPolicy) -> Layer 2 (MethodologicalAuthorityPolicy)
 *    -> Layer 3 (IndividualAnalyticalPreferencePolicy, future-compatible, cannot override Layer 1/2).
 *  - Registered R04 Rules Only: Every CEAR and rule trace passes through `assertRegisteredR04Rule`
 *    (throws `UnregisteredRuleError` on any unregistered rule ID or version mismatch).
 *  - Provisional Gate: Any provisional evidence (`shadbala_major_6`, `bhavabala`, `D5`,
 *    `advanced_avasthas`, unresolved Shadbala reconciliation, or `propagatedTrust === 'provisional'`)
 *    CANNOT reach `AC1`/`AC2`/`AC3`; capped at `AC4`/`AC5` (or `AC6` under `strictNonProvisional`).
 *  - Temporal Quarantine: `reference_date_dependent` items are strictly quarantined (`AC6`) from
 *    natal objectives.
 *  - Zero Coercion & Frame Isolation: Missing/null measurements never become `0`; incompatible or
 *    cross-frame overrides become `AC6`; absent prerequisites become explicit `unevaluated` or `indeterminate`.
 *  - Same `evidenceId` -> Multiple distinct `CEAR`s across different analytical objectives.
 *  - Optional `relationalContext` parameter supports staged Phase 6 Pass 1 (without K04) and Pass 2 (with K04).
 */

import { sha256Hex } from './lineage';
import {
  ANALYTICAL_OBJECTIVE_IDS,
  AUTHORITY_CLASSIFICATIONS,
  DEFAULT_INDIVIDUAL_PREFERENCE_POLICY,
  DEFAULT_METHODOLOGICAL_AUTHORITY_POLICY,
  DEFAULT_UNIVERSAL_INTEGRITY_POLICY,
  K03_AUTHORITY_ENGINE_VERSION,
  K03_CEAR_SCHEMA_VERSION,
  K03_INDEPENDENCE_CLASSIFICATIONS,
  R04_AUTHORITY_REGISTRY_VERSION,
  buildDeterministicAuthorityRecordId,
  type AnalyticalKernelK03AuthorityResult,
  type AnalyticalObjectiveId,
  type AuthorityClassification,
  type AuthorityDimensionAssessment,
  type AuthorityDimensionAssessments,
  type AuthorityDimensionStatus,
  type CearEvidenceIndependenceInfo,
  type CearQualificationStatus,
  type CearRuleReference,
  type ContextualEvidenceAuthorityRecord,
  type EvaluateK03ContextualAuthorityOptions,
  type K03AuthorityMethodology,
  type K03CoexistingFunctionalResponsibility,
  type K03EvidenceIndependenceClassification,
  type K03ExclusionAndLimitationRecord,
  type K03IndependenceSummary,
  type K03LagnaAuthorityEnrichment,
  type K03ObjectiveClassificationSummary,
  type K03P05ObjectiveAuthorityEntry,
  type K03P05SubjectAuthorityProfile,
  type K03P09FunctionalOrientationProfile,
  type K03PolicyConfiguration,
  type K03RelationalContextInput,
  type K03RuleExecutionTrace,
  type K03UnresolvedRequirementRecord,
  type LagnaFunctionalRole,
  type NaturalPlanetaryPolarity,
  type R04AuthorityRuleDefinition,
  type UniversalIntegrityPolicy,
  type VedicRashiSign,
} from './k03Types';
import {
  assertRegisteredR04Rule,
  exportR04RuleRegistrySnapshot,
  getR04LagnaFunctionalRule,
} from './r04AuthorityRegistry';
import {
  PHI_READY_PLANETS,
  PLANETARY_STATE_SUBJECTS,
  type AnalyticalEvidenceRepository,
  type AnalyticalKernelK02StateResult,
  type CanonicalEvidenceFrame,
  type CanonicalEvidenceObject,
  type EvidenceEntityRef,
  type EvidenceOverlapRelation,
  type PhiReadyPlanetName,
  type PlanetaryStateSubjectName,
} from './types';

const VEDIC_SIGNS_CANONICAL: readonly VedicRashiSign[] = [
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
];

const PROVISIONAL_DATASET_KEYS = new Set<string>([
  'shadbala_major_6',
  'shadbala_subcomponents',
  'bhavabala',
  'vedic_d5_panchamsha',
  'advanced_avasthas',
]);

const PROVISIONAL_OBSERVATION_CODES = new Set<string>([
  'SHADBALA_MAJOR_SIX_BALA',
  'SHADBALA_SUBCOMPONENT_BUCKET',
  'BHAVABALA_HOUSE_STRENGTH',
  'VEDIC_VARGA_D5_PROVISIONAL',
  'VEDIC_ADVANCED_AVASTHAS',
]);

const CLASSICAL_SEVEN_SET = new Set<string>(PHI_READY_PLANETS);

const CLASSIFICATION_RANK: Readonly<Record<AuthorityClassification, number>> = {
  AC1: 7,
  AC2: 6,
  AC3: 5,
  AC4: 4,
  AC5: 3,
  AC6: 2,
  indeterminate: 1,
  unevaluated: 0,
};

const MOVABLE_SIGNS = new Set<VedicRashiSign>(['Aries', 'Cancer', 'Libra', 'Capricorn']);
const FIXED_SIGNS = new Set<VedicRashiSign>(['Taurus', 'Leo', 'Scorpio', 'Aquarius']);

function isSubjectName(raw: string): raw is PlanetaryStateSubjectName {
  return (PLANETARY_STATE_SUBJECTS as readonly string[]).includes(raw);
}

function normalizeVedicSign(raw: string | null | undefined): VedicRashiSign | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();
  const matched = VEDIC_SIGNS_CANONICAL.find((s) => s.toLowerCase() === cleaned);
  return matched ?? null;
}

function numMetric(item: CanonicalEvidenceObject | undefined, metric: string): number | null {
  if (!item) return null;
  const m = item.measurements.find((x) => x.metric === metric);
  return m && typeof m.value === 'number' && Number.isFinite(m.value) ? m.value : null;
}

function strMetric(item: CanonicalEvidenceObject | undefined, metric: string): string | null {
  if (!item) return null;
  const m = item.measurements.find((x) => x.metric === metric);
  return m && typeof m.value === 'string' && m.value.trim() ? m.value.trim() : null;
}

function boolMetric(item: CanonicalEvidenceObject | undefined, metric: string): boolean | null {
  if (!item) return null;
  const m = item.measurements.find((x) => x.metric === metric);
  return m && typeof m.value === 'boolean' ? m.value : null;
}

function hasAnyFiniteNumericMeasurement(item: CanonicalEvidenceObject, metricNames: string[]): boolean {
  return metricNames.some((name) => numMetric(item, name) !== null);
}

function assertUniversalIntegrityPolicyValid(policy: UniversalIntegrityPolicy): void {
  if (
    policy.layerKind !== 'universal_integrity' ||
    policy.nonOverridable !== true ||
    policy.enforceProvisionalCeiling !== true ||
    policy.forbidProvisionalDecisivePromotion !== true ||
    policy.enforceFrameIsolation !== true ||
    policy.quarantineTemporalFromNatal !== true ||
    policy.enforceZeroCoercion !== true ||
    policy.keepShadbalaBhavabalaProvisional !== true
  ) {
    throw new Error(
      'UniversalIntegrityPolicy validation failed: Layer 1 integrity flags are strictly non-overridable.'
    );
  }
}

function isProvisionalEvidence(
  item: CanonicalEvidenceObject,
  shadbalaUnassigned: boolean
): boolean {
  if (item.verification.propagatedTrust === 'provisional') return true;
  if (item.verification.computational === 'provisional') return true;
  if (item.verification.methodological === 'contested_or_uncalibrated') return true;
  if (PROVISIONAL_OBSERVATION_CODES.has(item.observation.code)) return true;
  if (item.sourceDatasets.some((ds) => PROVISIONAL_DATASET_KEYS.has(ds.datasetKey))) return true;
  if (
    shadbalaUnassigned &&
    (item.observation.code.includes('SHADBALA') || item.observation.code === 'BHAVABALA_HOUSE_STRENGTH')
  ) {
    return true;
  }
  return false;
}

function mapQualificationStatus(
  cls: AuthorityClassification,
  limitingConditions: string[]
): CearQualificationStatus {
  switch (cls) {
    case 'AC1':
    case 'AC2':
      return limitingConditions.length > 0 ? 'qualified_with_caveats' : 'qualified';
    case 'AC3':
      return 'qualified_with_caveats';
    case 'AC4':
    case 'AC5':
      return limitingConditions.some((l) => l.toLowerCase().includes('provisional'))
        ? 'provisional_only'
        : 'qualified_with_caveats';
    case 'AC6':
      return 'excluded';
    case 'unevaluated':
      return 'unevaluated';
    case 'indeterminate':
      return 'indeterminate';
  }
}

function mapRuleRef(rule: R04AuthorityRuleDefinition): CearRuleReference {
  return {
    ruleId: rule.ruleId,
    version: rule.version,
    citationCode: rule.sourceOrMethodologicalJustification.referenceCode,
    methodology: rule.applicableMethodology,
  };
}

function mapK03Methodology(tradition: CanonicalEvidenceObject['methodology']['tradition']): K03AuthorityMethodology {
  switch (tradition) {
    case 'vedic':
      return 'vedic_parashari';
    case 'kp':
      return 'kp';
    case 'jaimini':
      return 'jaimini';
    case 'western':
      return 'western_tropical';
    default:
      return 'cross_tradition';
  }
}

function getNaturalPolarityForSubject(subject: PlanetaryStateSubjectName): {
  naturalPolarity: NaturalPlanetaryPolarity;
  basis: string;
} {
  switch (subject) {
    case 'Jupiter':
    case 'Venus':
      return {
        naturalPolarity: 'natural_benefic',
        basis: 'BPHS Ch. 3 Naisargika Shubha Graha (Jupiter & Venus are inherently natural benefics regardless of Lagna).',
      };
    case 'Sun':
    case 'Mars':
    case 'Saturn':
      return {
        naturalPolarity: 'natural_malefic',
        basis: 'BPHS Ch. 3 Naisargika Krura/Papa Graha (Sun, Mars, Saturn are natural malefics prior to Lagna lordship).',
      };
    case 'Moon':
      return {
        naturalPolarity: 'conditional_waxing_waning_moon',
        basis: 'BPHS Ch. 3 Paksha-Bala rule: Shukla Paksha (waxing) Moon acts as natural benefic; Krishna Paksha (waning) acts as natural malefic.',
      };
    case 'Mercury':
      return {
        naturalPolarity: 'conditional_associated_mercury',
        basis: 'BPHS Ch. 3 Samyoga rule: Mercury alone or with benefics is natural benefic; joined exclusively with malefics turns natural malefic.',
      };
    case 'Rahu':
    case 'Ketu':
      return {
        naturalPolarity: 'chhaya_graha_shadow_node',
        basis: 'Chhaya Grahas (shadow lunar nodes) hold natural malefic/tamasic character and operate through sign dispositor & conjunction witnesses.',
      };
    case 'Ascendant':
      return {
        naturalPolarity: 'non_planetary_reference',
        basis: 'Ascendant (Lagna) is a horizon reference point rather than a physical planet; carries no planetary natural polarity.',
      };
  }
}

function extractEvidenceSubjects(item: CanonicalEvidenceObject): PlanetaryStateSubjectName[] {
  const found: PlanetaryStateSubjectName[] = [];
  if (
    (item.subject.type === 'planet' || item.subject.type === 'ascendant') &&
    isSubjectName(item.subject.id)
  ) {
    found.push(item.subject.id);
  } else if (item.subject.type === 'cusp' && item.subject.id === 'KP_Cusp_1') {
    found.push('Ascendant');
  } else if (item.subject.type === 'angle' && item.subject.id === 'West_Ascendant') {
    found.push('Ascendant');
  }

  for (const rel of item.relatedEntities) {
    if (isSubjectName(rel.id) && !found.includes(rel.id)) {
      found.push(rel.id);
    }
  }
  return found;
}

function buildMissingOrNullCheck(item: CanonicalEvidenceObject): string | null {
  switch (item.observation.code) {
    case 'SHADBALA_MAJOR_SIX_BALA':
      if (!hasAnyFiniteNumericMeasurement(item, ['total_rupas', 'total_virupas'])) {
        return 'Missing finite Shadbala total_rupas/total_virupas; zero-coercion guard forbids substituting 0.';
      }
      return null;
    case 'BHAVABALA_HOUSE_STRENGTH':
      if (!hasAnyFiniteNumericMeasurement(item, ['total_rupas', 'total_virupas', 'strength_virupas', 'bhavabala'])) {
        return 'Missing finite Bhavabala strength metric; zero-coercion guard forbids substituting 0.';
      }
      return null;
    case 'VIMSHOPAKA_BALA_SCHEME':
      if (numMetric(item, 'score_out_of_20') === null) {
        return 'Missing finite Vimshopaka score_out_of_20; zero-coercion guard forbids substituting 0.';
      }
      return null;
    case 'ISHTA_KASHTA_PHALA':
      if (numMetric(item, 'ishta_phala') === null || numMetric(item, 'kashta_phala') === null) {
        return 'Missing finite Ishta/Kashta Phala measurement; zero-coercion guard forbids substituting 0.';
      }
      return null;
    case 'ASHTAKAVARGA_BHINNA_BAV': {
      const hasAnyBav = item.measurements.some(
        (m) => m.metric.startsWith('bav_') && typeof m.value === 'number' && Number.isFinite(m.value)
      );
      if (!hasAnyBav) {
        return 'Missing finite BAV bindu vector; zero-coercion guard forbids substituting 0.';
      }
      return null;
    }
    default:
      return null;
  }
}

interface CandidateSpec {
  item: CanonicalEvidenceObject;
  objectiveId: AnalyticalObjectiveId;
  rule: R04AuthorityRuleDefinition;
  baseClass: AuthorityClassification;
  propositionRef: string;
  forceExclusionReason?: K03ExclusionAndLimitationRecord['reasonCode'];
  extraSupporting?: string[];
  extraLimiting?: string[];
  extraPrerequisites?: string[];
}

function pickPartialGroupPrimaryId(
  items: CanonicalEvidenceObject[],
  preferredVimshopakaBySubject: Map<string, string>
): string {
  const rank = (ev: CanonicalEvidenceObject): number => {
    if (ev.observation.code === 'SHADBALA_MAJOR_SIX_BALA') return 100;
    if (ev.observation.code === 'ASHTAKAVARGA_BHINNA_BAV') return 95;
    const prefVim = preferredVimshopakaBySubject.get(ev.subject.id);
    if (prefVim && ev.evidenceId === prefVim) return 90;
    if (ev.observation.code === 'ISHTA_KASHTA_PHALA') return 60;
    if (ev.observation.code === 'ASHTAKAVARGA_PRASTARA') return 45;
    if (ev.observation.code === 'ASHTAKAVARGA_SHODHANA_PINDA') return 35;
    if (ev.observation.code === 'SHADBALA_SUBCOMPONENT_BUCKET') return 25;
    if (ev.observation.code === 'ASHTAKAVARGA_SARVA_SAV_SIGN') return 20;
    return 10;
  };
  return [...items].sort((a, b) => {
    const diff = rank(b) - rank(a);
    return diff !== 0 ? diff : a.evidenceId.localeCompare(b.evidenceId);
  })[0].evidenceId;
}

function buildTenDimensions(params: {
  item: CanonicalEvidenceObject;
  objectiveId: AnalyticalObjectiveId;
  rule: R04AuthorityRuleDefinition;
  classification: AuthorityClassification;
  independence: CearEvidenceIndependenceInfo;
  provisional: boolean;
  temporalQuarantined: boolean;
  frameIncompatible: boolean;
  supportingConditions: string[];
  limitingConditions: string[];
  unresolvedPrerequisites: string[];
  relationalFactNote: string | null;
  activeModifiers: string[];
  corroborationIds: string[];
}): AuthorityDimensionAssessments {
  const {
    item,
    objectiveId,
    rule,
    classification,
    independence,
    provisional,
    temporalQuarantined,
    frameIncompatible,
    supportingConditions,
    limitingConditions,
    unresolvedPrerequisites,
    relationalFactNote,
    activeModifiers,
    corroborationIds,
  } = params;

  const isExcluded = classification === 'AC6';
  const isUnevaluated = classification === 'unevaluated';
  const isIndeterminate = classification === 'indeterminate';

  const makeDim = (
    dimension: AuthorityDimensionAssessment['dimension'],
    status: AuthorityDimensionStatus,
    qualitativeRating: string,
    rationale: string,
    limitations: string[] = []
  ): AuthorityDimensionAssessment => ({
    dimension,
    status,
    qualitativeRating,
    rationale,
    limitations,
    supportingEvidenceIds: [item.evidenceId, ...corroborationIds.slice(0, 4)],
    ruleReferences: [`${rule.ruleId}@${rule.version}`],
  });

  const baseStatus: AuthorityDimensionStatus = isExcluded
    ? 'excluded'
    : isUnevaluated
    ? 'unevaluated'
    : isIndeterminate
    ? 'indeterminate'
    : provisional || limitingConditions.length > 0
    ? 'constrained'
    : 'assessed';

  return {
    evidenceValidity: makeDim(
      'evidenceValidity',
      item.verification.propagatedTrust === 'blocked' || temporalQuarantined || frameIncompatible
        ? 'excluded'
        : baseStatus,
      item.verification.propagatedTrust === 'usable'
        ? 'valid_canonical_evidence'
        : item.verification.propagatedTrust === 'provisional'
        ? 'valid_provisional_bounded'
        : 'blocked_or_invalid_scope',
      `Temporal scope="${item.temporalScope}", frame="${item.frame}", trust="${item.verification.propagatedTrust}".`,
      temporalQuarantined
        ? ['Temporal evidence quarantined from natal objectives under Universal Integrity Policy.']
        : []
    ),
    computationalReliability: makeDim(
      'computationalReliability',
      provisional ? 'constrained' : isExcluded ? 'excluded' : 'assessed',
      `${item.verification.computational}|empirical:${item.verification.empirical}`,
      `Computational status is "${item.verification.computational}" with empirical="${item.verification.empirical}".`,
      provisional
        ? [
            'Provisional computational gate active (docs/SHADBALA_BHAVABALA_ISSUE_REGISTER.md); cannot be promoted to AC1/AC2/AC3.',
          ]
        : []
    ),
    methodologicalSignificance: makeDim(
      'methodologicalSignificance',
      frameIncompatible ? 'excluded' : baseStatus,
      `${rule.applicableMethodology}:${rule.sourceOrMethodologicalJustification.referenceCode}`,
      `Evaluated under registered methodology "${rule.applicableMethodology}" (${rule.sourceOrMethodologicalJustification.citation}).`,
      frameIncompatible
        ? ['Cross-system global override or frame mismatch blocked by Layer 2 Methodological Policy.']
        : []
    ),
    contextualRelevance: makeDim(
      'contextualRelevance',
      isExcluded ? 'excluded' : baseStatus,
      `${objectiveId}:${classification}`,
      `Assessed specifically for analytical objective "${objectiveId}" on ${item.subject.type}:${item.subject.id}.`,
      unresolvedPrerequisites
    ),
    analyticalPotency: makeDim(
      'analyticalPotency',
      isExcluded ? 'excluded' : isUnevaluated ? 'unevaluated' : isIndeterminate ? 'indeterminate' : baseStatus,
      classification === 'AC1'
        ? 'decisive_for_registered_qualification_only'
        : classification === 'AC2'
        ? 'primary_structural_authority'
        : classification === 'AC3'
        ? 'significant_with_caveats'
        : classification === 'AC4'
        ? 'supporting_or_provisional_bounded'
        : classification === 'AC5'
        ? 'background_audit_or_overlap_sibling'
        : classification === 'AC6'
        ? 'excluded_zero_potency'
        : classification,
      supportingConditions[0] ??
        `Classified ${classification} for objective "${objectiveId}" without inventing arbitrary scalar weights.`,
      limitingConditions
    ),
    evidenceIndependence: makeDim(
      'evidenceIndependence',
      independence.independenceStatus === 'methodological_incompatibility'
        ? 'excluded'
        : independence.doubleCountingGuardApplied
        ? 'constrained'
        : 'assessed',
      independence.independenceStatus,
      `Independence classified as "${independence.independenceStatus}"${
        independence.doubleCountingGuardApplied ? ' (double-counting guard active)' : ''
      }.`,
      independence.notes
    ),
    reinforcement: makeDim(
      'reinforcement',
      corroborationIds.length > 0 ? 'assessed' : baseStatus,
      corroborationIds.length > 0 ? 'corroborated_within_objective' : 'standalone_signal',
      corroborationIds.length > 0
        ? `Corroborated by ${corroborationIds.length} companion evidence item(s) within "${objectiveId}".`
        : 'No duplicate inflation; standalone signal within objective.',
      []
    ),
    modification: makeDim(
      'modification',
      activeModifiers.length > 0 ? 'constrained' : 'assessed',
      activeModifiers.length > 0 ? `modifiers_present:${activeModifiers.join(',')}` : 'unmodified_baseline',
      activeModifiers.length > 0
        ? `Pending K05/K07 interaction modifiers recorded qualitatively: ${activeModifiers.join(', ')}.`
        : 'No active operating-condition modifiers attached directly to this evidence.',
      activeModifiers.length > 0
        ? ['Modifiers are preserved qualitatively in K03; composite cancellation/amplification belongs to K05/K07.']
        : []
    ),
    structuralCriticality: makeDim(
      'structuralCriticality',
      relationalFactNote ? 'assessed' : item.sensitivity.sandhiOrBoundaryRisk ? 'constrained' : baseStatus,
      relationalFactNote
        ? 'k04_relational_topology_linked'
        : item.sensitivity.sandhiOrBoundaryRisk
        ? 'boundary_or_sandhi_sensitive'
        : 'standard_structural_role',
      relationalFactNote ??
        (item.sensitivity.sandhiOrBoundaryRisk
          ? `Sensitivity notice: ${item.sensitivity.reasons.join('; ') || 'sandhi/boundary sensitivity flagged'}.`
          : `Standard structural role inside frame "${item.frame}".`),
      item.sensitivity.reasons
    ),
    temporalRelevance: makeDim(
      'temporalRelevance',
      temporalQuarantined ? 'excluded' : 'assessed',
      temporalQuarantined ? 'quarantined_reference_date_dependent' : 'natal_invariant_valid',
      temporalQuarantined
        ? `Reference-date dependent telemetry (${item.referenceDateIso ?? 'unspecified'}) quarantined from natal authority.`
        : 'Natal-invariant birth-chart observation valid for structural evaluation.',
      temporalQuarantined
        ? ['Must remain isolated in temporal layer (K09 — Temporal Intelligence) and never contaminate natal authority.']
        : []
    ),
  };
}

export function evaluateK03ContextualAuthority(
  repo: AnalyticalEvidenceRepository,
  k02State?: AnalyticalKernelK02StateResult | null,
  options: EvaluateK03ContextualAuthorityOptions = {}
): AnalyticalKernelK03AuthorityResult {
  // 1. Validate Layer 1 Universal Integrity Policy FIRST (strictly non-overridable)
  const universalIntegrity = options.universalIntegrityPolicy ?? DEFAULT_UNIVERSAL_INTEGRITY_POLICY;
  assertUniversalIntegrityPolicyValid(universalIntegrity);

  const methodologicalAuthority =
    options.methodologicalPolicy ?? DEFAULT_METHODOLOGICAL_AUTHORITY_POLICY;
  const individualPreference =
    options.individualPreference ?? DEFAULT_INDIVIDUAL_PREFERENCE_POLICY;

  if (options.verifyRegisteredRuleIds) {
    for (const ruleId of options.verifyRegisteredRuleIds) {
      assertRegisteredR04Rule(ruleId);
    }
  }

  const strictNonProvisional = Boolean(
    options.strictNonProvisional ||
      k02State?.strictNonProvisional ||
      individualPreference?.strictNonProvisionalOverride
  );
  const relationalContext: K03RelationalContextInput | null = options.relationalContext ?? null;

  const shadbalaUnassigned = repo.natalEvidence.some(
    (e) =>
      e.observation.code === 'SHADBALA_MAJOR_SIX_BALA' &&
      e.verification.statusNotes.some((n) => n.includes('unassigned_pending_reconciliation'))
  );

  // Build quick indexes from repo (pure read-only)
  const natalItems = repo.natalEvidence;
  const temporalItems = repo.temporalEvidence;

  const overlapRelsByEvidence = new Map<string, EvidenceOverlapRelation[]>();
  for (const rel of repo.lineageGraph.overlapRelations) {
    const aList = overlapRelsByEvidence.get(rel.evidenceIdA) ?? [];
    aList.push(rel);
    overlapRelsByEvidence.set(rel.evidenceIdA, aList);

    const bList = overlapRelsByEvidence.get(rel.evidenceIdB) ?? [];
    bList.push(rel);
    overlapRelsByEvidence.set(rel.evidenceIdB, bList);
  }

  const unresolvedParentIds = new Set<string>(
    repo.lineageGraph.unresolvedParentRefs.map((u) => u.childEvidenceId)
  );

  const blockedIncompatibleFrames = new Set<CanonicalEvidenceFrame>();
  for (const notice of repo.rejectedOrBlockedFrames) {
    if (notice.canonicalStatus === 'incompatible') {
      blockedIncompatibleFrames.add(notice.frame);
    }
  }

  // Preferred Vimshopaka per planet (matching K02 selection so Shodashvarga leads when available)
  const preferredVimshopakaBySubject = new Map<string, string>();
  const vimRank = (e: CanonicalEvidenceObject): number => {
    const s = (strMetric(e, 'scheme') ?? '').toLowerCase();
    if (s === 'shodashavarga' || s === 'shodashvarga') return 4;
    if (s === 'dashavarga') return 3;
    if (s === 'saptavarga') return 2;
    if (s === 'shadvarga') return 1;
    return 0;
  };
  for (const subj of PHI_READY_PLANETS) {
    const cands = natalItems.filter(
      (e) => e.subject.id === subj && e.observation.code === 'VIMSHOPAKA_BALA_SCHEME'
    );
    if (cands.length > 0) {
      cands.sort((a, b) => vimRank(b) - vimRank(a));
      preferredVimshopakaBySubject.set(subj, cands[0].evidenceId);
    }
  }

  // Active modifiers index per subject
  const activeModifiersBySubject = new Map<string, string[]>();
  for (const item of natalItems) {
    if (
      item.observation.code === 'MODIFIER_COMBUSTION_ASTA' ||
      item.observation.code === 'MODIFIER_GANDANTA_JUNCTION' ||
      item.observation.code === 'MODIFIER_GRAHA_YUDDHA' ||
      item.observation.code === 'MODIFIER_VARGOTTAMA' ||
      item.observation.code === 'PARIVARTANA_MUTUAL_EXCHANGE'
    ) {
      for (const s of extractEvidenceSubjects(item)) {
        const list = activeModifiersBySubject.get(s) ?? [];
        if (!list.includes(item.observation.code)) list.push(item.observation.code);
        activeModifiersBySubject.set(s, list);
      }
    }
  }

  // Resolve Lagna Anchor
  const ascSignItem = natalItems.find((e) => e.observation.code === 'VEDIC_D1_ASCENDANT_SIGN');
  const ascLongItem = natalItems.find((e) => e.observation.code === 'VEDIC_D1_ASCENDANT_LONGITUDE');
  const rawLagnaSign =
    strMetric(ascSignItem, 'sign') ??
    strMetric(ascLongItem, 'sign') ??
    k02State?.ascendantConditionProfile.vedicD1.sign ??
    null;
  const lagnaSign = normalizeVedicSign(rawLagnaSign);
  const lagnaRule = lagnaSign ? getR04LagnaFunctionalRule(lagnaSign) : null;
  const nonClassicalLagnaRule = assertRegisteredR04Rule('R04_LAGNA_FUNC_NON_CLASSICAL_SUBJECTS');
  const lagnaLord = lagnaRule?.lagnaFunctionalSpec?.lagnaLord ?? null;
  const lagnaSandhiRisk = Boolean(
    ascSignItem?.sensitivity.sandhiOrBoundaryRisk ||
      ascLongItem?.sensitivity.sandhiOrBoundaryRisk ||
      k02State?.ascendantConditionProfile.sandhiAndTimeSensitivity.sandhiOrBoundaryRisk
  );

  // 2. Map every repository evidence item into registered objective candidates
  // Note: the SAME evidenceId cleanly generates MULTIPLE CEARs across different objectives!
  const candidates: CandidateSpec[] = [];

  for (const item of natalItems) {
    const code = item.observation.code;

    // Temporal item mistakenly placed in natalEvidence -> immediate Layer 1 quarantine
    if (item.temporalScope === 'reference_date_dependent') {
      const r = assertRegisteredR04Rule('R04_CROSS_TRADITION_VERIFICATION_AND_COMPATIBILITY');
      candidates.push({
        item,
        objectiveId: 'evidence_verification_and_compatibility',
        rule: r,
        baseClass: 'AC6',
        propositionRef: `temporal_quarantine:${code}`,
        forceExclusionReason: 'temporal_natal_quarantine',
        extraLimiting: ['Temporal evidence found in natal bucket; excluded as AC6 by Universal Integrity Policy.'],
      });
      continue;
    }

    // Objective 1: planetary_quantitative_capacity
    if (code === 'SHADBALA_MAJOR_SIX_BALA' || code === 'SHADBALA_SUBCOMPONENT_BUCKET' || code === 'ISHTA_KASHTA_PHALA') {
      const r = assertRegisteredR04Rule('R04_PARASHARI_QUANTITATIVE_CAPACITY_SHADBALA');
      const isClassical = CLASSICAL_SEVEN_SET.has(item.subject.id);
      candidates.push({
        item,
        objectiveId: 'planetary_quantitative_capacity',
        rule: r,
        baseClass: !isClassical
          ? 'AC6'
          : code === 'SHADBALA_MAJOR_SIX_BALA'
          ? 'AC4'
          : 'AC5',
        propositionRef: `quantitative_capacity:${code}:${item.subject.id}`,
        forceExclusionReason: !isClassical ? 'subject_scope_inapplicable' : undefined,
        extraLimiting: [
          'Subject to docs/SHADBALA_BHAVABALA_ISSUE_REGISTER.md provisional ceiling (never AC1/AC2/AC3).',
        ],
        extraPrerequisites: shadbalaUnassigned
          ? ['shadbala_reconciliation:unassigned_pending_external_jhora_validation']
          : [],
      });
    } else if (
      code === 'ASHTAKAVARGA_BHINNA_BAV' ||
      code === 'ASHTAKAVARGA_PRASTARA' ||
      code === 'ASHTAKAVARGA_SHODHANA_PINDA'
    ) {
      const r = assertRegisteredR04Rule('R04_PARASHARI_ASHTAKAVARGA_CAPACITY');
      const isClassical = CLASSICAL_SEVEN_SET.has(item.subject.id);
      candidates.push({
        item,
        objectiveId: 'planetary_quantitative_capacity',
        rule: r,
        baseClass: !isClassical
          ? 'AC6'
          : code === 'ASHTAKAVARGA_BHINNA_BAV'
          ? 'AC2'
          : 'AC5',
        propositionRef: `quantitative_capacity:${code}:${item.subject.id}`,
        forceExclusionReason: !isClassical ? 'subject_scope_inapplicable' : undefined,
      });
    } else if (code === 'VIMSHOPAKA_BALA_SCHEME') {
      const r = assertRegisteredR04Rule('R04_PARASHARI_VIMSHOPAKA_CAPACITY');
      const isClassical = CLASSICAL_SEVEN_SET.has(item.subject.id);
      const isPreferred = preferredVimshopakaBySubject.get(item.subject.id) === item.evidenceId;
      candidates.push({
        item,
        objectiveId: 'planetary_quantitative_capacity',
        rule: r,
        baseClass: !isClassical ? 'AC6' : isPreferred ? 'AC2' : 'AC5',
        propositionRef: `quantitative_capacity:${code}:${item.subject.id}`,
        forceExclusionReason: !isClassical ? 'subject_scope_inapplicable' : undefined,
      });
    }

    // Objective 2: planetary_dignity_and_positional_condition
    if (
      code === 'VEDIC_D1_DIGNITY' ||
      code === 'VEDIC_D1_SIGN_HOUSE_PLACEMENT' ||
      code === 'VEDIC_D1_PLANET_LONGITUDE' ||
      code === 'VEDIC_PLANET_OPERATING_CONDITIONS' ||
      code === 'MODIFIER_COMBUSTION_ASTA' ||
      code === 'MODIFIER_GANDANTA_JUNCTION' ||
      code === 'MODIFIER_GRAHA_YUDDHA'
    ) {
      const r = assertRegisteredR04Rule('R04_PARASHARI_D1_DIGNITY_AND_CONDITION');
      const isNode = item.subject.id === 'Rahu' || item.subject.id === 'Ketu';
      const isSandhi = item.sensitivity.sandhiOrBoundaryRisk;
      const baseClass: AuthorityClassification =
        code === 'VEDIC_D1_DIGNITY' && !isNode && !isSandhi
          ? 'AC1'
          : isNode && code === 'VEDIC_D1_DIGNITY'
          ? 'AC3'
          : isSandhi
          ? 'AC3'
          : 'AC2';
      candidates.push({
        item,
        objectiveId: 'planetary_dignity_and_positional_condition',
        rule: r,
        baseClass,
        propositionRef: `d1_dignity_condition:${code}:${item.subject.id}`,
        extraSupporting:
          baseClass === 'AC1'
            ? ['AC1 qualifies the astrological D1 dignity state only — never a guaranteed real-world outcome.']
            : [],
      });
    } else if (
      code === 'WESTERN_ESSENTIAL_DIGNITY' ||
      code === 'WESTERN_TROPICAL_PLACEMENT' ||
      code === 'WESTERN_TROPICAL_PLANET_LONGITUDE'
    ) {
      const r = assertRegisteredR04Rule('R04_WESTERN_ESSENTIAL_DIGNITY_ISOLATED');
      candidates.push({
        item,
        objectiveId: 'planetary_dignity_and_positional_condition',
        rule: r,
        baseClass: 'AC2',
        propositionRef: `western_isolated_condition:${code}:${item.subject.id}`,
        extraLimiting: ['Strictly isolated inside western_tropical frame; never averaged with Vedic Lahiri.'],
      });
    }

    // Objective 3: planetary_health_evidence (Intrinsic PHI boundary + explicit P08 exclusions!)
    if (
      CLASSICAL_SEVEN_SET.has(item.subject.id) &&
      (code === 'VEDIC_D1_DIGNITY' ||
        code === 'ASHTAKAVARGA_BHINNA_BAV' ||
        code === 'ASHTAKAVARGA_PRASTARA' ||
        code === 'ASHTAKAVARGA_SHODHANA_PINDA' ||
        code === 'VIMSHOPAKA_BALA_SCHEME' ||
        code === 'SHADBALA_MAJOR_SIX_BALA' ||
        code === 'SHADBALA_SUBCOMPONENT_BUCKET' ||
        code === 'ISHTA_KASHTA_PHALA' ||
        (code === 'VEDIC_VARGA_PLACEMENT' && strMetric(item, 'division') === 'D9') ||
        code === 'VEDIC_PLANET_OPERATING_CONDITIONS' ||
        code === 'MODIFIER_COMBUSTION_ASTA' ||
        code === 'MODIFIER_GANDANTA_JUNCTION' ||
        code === 'MODIFIER_GRAHA_YUDDHA')
    ) {
      const r = assertRegisteredR04Rule('R04_CROSS_TRADITION_PHI_HEALTH_CONTRIBUTION');
      const isSecondaryOverlap =
        code === 'SHADBALA_SUBCOMPONENT_BUCKET' ||
        code === 'ISHTA_KASHTA_PHALA' ||
        code === 'ASHTAKAVARGA_PRASTARA' ||
        code === 'ASHTAKAVARGA_SHODHANA_PINDA' ||
        (code === 'VIMSHOPAKA_BALA_SCHEME' &&
          preferredVimshopakaBySubject.get(item.subject.id) !== item.evidenceId);
      const baseClass: AuthorityClassification = isSecondaryOverlap
        ? 'AC5'
        : code === 'SHADBALA_MAJOR_SIX_BALA'
        ? 'AC4'
        : code === 'VEDIC_VARGA_PLACEMENT'
        ? 'AC3'
        : 'AC2';
      candidates.push({
        item,
        objectiveId: 'planetary_health_evidence',
        rule: r,
        baseClass,
        propositionRef: `phi_intrinsic_health:${code}:${item.subject.id}`,
      });
    } else if (
      code === 'VEDIC_D1_HOUSE_LORD_PLACEMENT' ||
      code === 'KP_FOUR_LEVEL_SIGNIFICATORS' ||
      code === 'JAIMINI_CHARA_KARAKA'
    ) {
      // Explicit P08 exclusion guard inside planetary_health_evidence so same evidenceId
      // receives AC2 in house_governance/configuration and AC6 in planetary_health_evidence!
      const r = assertRegisteredR04Rule('R04_CROSS_TRADITION_PHI_HEALTH_CONTRIBUTION');
      candidates.push({
        item,
        objectiveId: 'planetary_health_evidence',
        rule: r,
        baseClass: 'AC6',
        propositionRef: `phi_p08_exclusion:${code}:${item.subject.id}`,
        forceExclusionReason: 'p08_excluded_from_phi',
        extraLimiting: [
          'House ownership / KP significators / Jaimini Karakas belong to P08/governance and are strictly excluded from PHI intrinsic planetary health.',
        ],
      });
    }

    // Objective 4: ascendant_and_lagnesh_condition
    if (
      code === 'VEDIC_D1_ASCENDANT_SIGN' ||
      code === 'VEDIC_D1_ASCENDANT_LONGITUDE' ||
      (code === 'VEDIC_NAKSHATRA_PADA' && item.subject.id === 'Ascendant') ||
      (code === 'KP_CUSPAL_SUB_LORDS' && item.subject.id === 'KP_Cusp_1') ||
      (code === 'KP_PLACIDUS_CUSP_LONGITUDE' && item.subject.id === 'KP_Cusp_1') ||
      (lagnaLord &&
        item.subject.id === lagnaLord &&
        (code === 'VEDIC_D1_DISPOSITOR_DEPENDENCY' || code === 'VEDIC_D1_SIGN_HOUSE_PLACEMENT'))
    ) {
      const r = assertRegisteredR04Rule('R04_PARASHARI_ASCENDANT_AND_LAGNESH_ANCHOR');
      const isSandhi = item.sensitivity.sandhiOrBoundaryRisk || lagnaSandhiRisk;
      const baseClass: AuthorityClassification =
        code === 'VEDIC_D1_ASCENDANT_SIGN' && !isSandhi
          ? 'AC1'
          : isSandhi
          ? 'AC3'
          : 'AC2';
      candidates.push({
        item,
        objectiveId: 'ascendant_and_lagnesh_condition',
        rule: r,
        baseClass,
        propositionRef: `ascendant_lagnesh:${code}:${item.subject.id}`,
      });
    }

    // Objective 5: house_governance
    if (
      code === 'VEDIC_D1_HOUSE_LORD_PLACEMENT' ||
      code === 'BHAVA_CHALIT_HOUSE_PLACEMENT' ||
      code === 'ASHTAKAVARGA_SARVA_SAV_SIGN' ||
      code === 'BHAVABALA_HOUSE_STRENGTH'
    ) {
      const r = assertRegisteredR04Rule('R04_PARASHARI_HOUSE_GOVERNANCE_AND_CHALIT');
      const baseClass: AuthorityClassification =
        code === 'BHAVABALA_HOUSE_STRENGTH'
          ? 'AC4'
          : code === 'ASHTAKAVARGA_SARVA_SAV_SIGN'
          ? 'AC3'
          : 'AC2';
      candidates.push({
        item,
        objectiveId: 'house_governance',
        rule: r,
        baseClass,
        propositionRef: `house_governance:${code}:${item.subject.id}`,
        extraLimiting:
          code === 'BHAVABALA_HOUSE_STRENGTH'
            ? ['Bhavabala capped provisional per docs/SHADBALA_BHAVABALA_ISSUE_REGISTER.md Issues #1 & #6.']
            : [],
      });
    } else if (
      code === 'KP_CUSPAL_SUB_LORDS' ||
      code === 'KP_PLANET_SUB_LORDS' ||
      code === 'KP_PLACIDUS_HOUSE_PLACEMENT' ||
      code === 'KP_FOUR_LEVEL_SIGNIFICATORS'
    ) {
      const r = assertRegisteredR04Rule('R04_KP_CUSPAL_SUBLORD_AND_SIGNIFICATOR_GOVERNANCE');
      candidates.push({
        item,
        objectiveId: 'house_governance',
        rule: r,
        baseClass: 'AC2',
        propositionRef: `kp_house_governance:${code}:${item.subject.id}`,
        extraLimiting: ['Isolated strictly inside kp_placidus; never globally overrides Parashari Vargas or Sripati Chalit.'],
      });
    }

    // Objective 6: configuration_qualification
    if (
      code === 'VEDIC_YOGA_CONFIGURATION' ||
      code === 'DOSHA_EVALUATION' ||
      code === 'PARIVARTANA_MUTUAL_EXCHANGE' ||
      code === 'MODIFIER_VARGOTTAMA'
    ) {
      const r = assertRegisteredR04Rule('R04_PARASHARI_YOGA_DOSHA_QUALIFICATION');
      const isPresent = boolMetric(item, 'is_present');
      const baseClass: AuthorityClassification = isPresent === false ? 'AC5' : 'AC2';
      candidates.push({
        item,
        objectiveId: 'configuration_qualification',
        rule: r,
        baseClass,
        propositionRef: `configuration:${code}:${item.subject.id}`,
      });
    } else if (
      code === 'JAIMINI_CHARA_KARAKA' ||
      code === 'JAIMINI_ARUDHA_PADA' ||
      code === 'JAIMINI_YOGA_CONFIGURATION'
    ) {
      const r = assertRegisteredR04Rule('R04_JAIMINI_KARAKA_PADA_QUALIFICATION');
      const scheme = (strMetric(item, 'karaka_scheme') ?? '').toLowerCase();
      const baseClass: AuthorityClassification =
        scheme.includes('8') ? 'AC3' : boolMetric(item, 'is_present') === false ? 'AC5' : 'AC2';
      candidates.push({
        item,
        objectiveId: 'configuration_qualification',
        rule: r,
        baseClass,
        propositionRef: `jaimini_configuration:${code}:${item.subject.id}`,
      });
    }

    // Objective 7: dispositor_dependency
    if (
      (code === 'VEDIC_D1_DISPOSITOR_DEPENDENCY' ||
        code === 'PARIVARTANA_MUTUAL_EXCHANGE' ||
        (code === 'VEDIC_D1_SIGN_HOUSE_PLACEMENT' && item.subject.type === 'planet')) &&
      item.subject.id !== 'Ascendant'
    ) {
      const r = assertRegisteredR04Rule('R04_PARASHARI_DISPOSITOR_DEPENDENCY_AUTHORITY');
      const termType = strMetric(item, 'termination_type');
      const isDecisiveDispositor =
        code === 'VEDIC_D1_DISPOSITOR_DEPENDENCY' &&
        (termType === 'self_disposited' || termType === 'multi_node_cycle' || termType === 'mutual_exchange');
      const baseClass: AuthorityClassification =
        isDecisiveDispositor && item.subject.id !== 'Rahu' && item.subject.id !== 'Ketu'
          ? 'AC1'
          : code === 'VEDIC_D1_SIGN_HOUSE_PLACEMENT'
          ? 'AC4'
          : 'AC2';
      candidates.push({
        item,
        objectiveId: 'dispositor_dependency',
        rule: r,
        baseClass,
        propositionRef: `dispositor_dependency:${code}:${item.subject.id}`,
      });
    }

    // Objective 8: divisional_condition
    if (
      code === 'VEDIC_VARGA_PLACEMENT' ||
      code === 'MODIFIER_VARGOTTAMA' ||
      code === 'VEDIC_VARGA_D5_PROVISIONAL'
    ) {
      const r = assertRegisteredR04Rule('R04_PARASHARI_DIVISIONAL_VARGA_AUTHORITY');
      const div = strMetric(item, 'division');
      const baseClass: AuthorityClassification =
        code === 'VEDIC_VARGA_D5_PROVISIONAL'
          ? 'AC4'
          : div === 'D9' || code === 'MODIFIER_VARGOTTAMA'
          ? 'AC2'
          : 'AC3';
      candidates.push({
        item,
        objectiveId: 'divisional_condition',
        rule: r,
        baseClass,
        propositionRef: `divisional_condition:${code}:${div ?? 'varga'}:${item.subject.id}`,
      });
    } else if (code === 'KP_CUSPAL_SUB_LORDS' && item.subject.id === 'KP_Cusp_1') {
      // Explicit Layer 2 cross-system non-dominance record: KP Placidus is AC6 Excluded from Parashari divisional conditions!
      const r = assertRegisteredR04Rule('R04_PARASHARI_DIVISIONAL_VARGA_AUTHORITY');
      candidates.push({
        item,
        objectiveId: 'divisional_condition',
        rule: r,
        baseClass: 'AC6',
        propositionRef: `kp_non_dominance_over_vargas:${item.subject.id}`,
        forceExclusionReason: 'methodological_non_dominance_guard',
        extraLimiting: [
          'Methodological Authority Policy forbids KP Placidus cusps from overriding or classifying Parashari Vargas.',
        ],
      });
    }

    // Objective 9: evidence_verification_and_compatibility (canonical instant, telemetry, contexts, and audit items)
    if (
      code === 'CANONICAL_BIRTH_INSTANT' ||
      code === 'ASTRONOMICAL_BODY_TELEMETRY' ||
      code === 'VEDIC_NAKSHATRA_PADA' ||
      code === 'VEDIC_ADVANCED_AVASTHAS' ||
      code === 'VEDIC_VARGA_D5_PROVISIONAL' ||
      code === 'VIMSHOTTARI_BIRTH_BALANCE' ||
      code === 'VIMSHOTTARI_NATAL_MAHADASHA' ||
      code === 'ALTERNATIVE_DASHA_NATAL_TIMELINE' ||
      code === 'BIRTH_CONTEXT_TIMEZONE_PRECISION' ||
      code === 'NATAL_PANCHANG_CONTEXT' ||
      code === 'WESTERN_TROPICAL_ANGLE_LONGITUDE' ||
      code === 'WESTERN_ASPECT_CONFIGURATION' ||
      code === 'WESTERN_STELLIUM' ||
      code === 'HELLENISTIC_ARABIC_LOT' ||
      code === 'WESTERN_GEOMETRIC_ASPECT' ||
      code === 'WESTERN_DECLINATION_ASPECT' ||
      code === 'SIDEREAL_PLANETARY_ASPECT' ||
      code === 'PANCHADHA_MAITRI_PAIR' ||
      code === 'VEDIC_UPAGRAHA_POSITION' ||
      code === 'SRIPATI_BHAVA_MADHYA_SANDHI' ||
      code === 'KP_PLANET_LONGITUDE' ||
      code === 'KP_PLACIDUS_CUSP_LONGITUDE'
    ) {
      const r = assertRegisteredR04Rule('R04_CROSS_TRADITION_VERIFICATION_AND_COMPATIBILITY');
      const baseClass: AuthorityClassification =
        code === 'CANONICAL_BIRTH_INSTANT'
          ? 'AC1'
          : code === 'VEDIC_ADVANCED_AVASTHAS' || code === 'VEDIC_VARGA_D5_PROVISIONAL'
          ? 'AC4'
          : code === 'ASTRONOMICAL_BODY_TELEMETRY' || code === 'VEDIC_NAKSHATRA_PADA'
          ? 'AC2'
          : 'AC4';
      candidates.push({
        item,
        objectiveId: 'evidence_verification_and_compatibility',
        rule: r,
        baseClass,
        propositionRef: `verification_compatibility:${code}:${item.subject.id}`,
      });
    }

    // Objective 10: functional_orientation_by_lagna (when Lagna rule is resolved)
    if (
      lagnaRule &&
      (code === 'VEDIC_D1_ASCENDANT_SIGN' ||
        code === 'VEDIC_D1_HOUSE_LORD_PLACEMENT' ||
        (code === 'VEDIC_D1_SIGN_HOUSE_PLACEMENT' && item.subject.type === 'planet') ||
        (code === 'VEDIC_D1_DISPOSITOR_DEPENDENCY' &&
          (item.subject.id === 'Rahu' || item.subject.id === 'Ketu')))
    ) {
      const isNodeOrAsc =
        item.subject.id === 'Rahu' ||
        item.subject.id === 'Ketu' ||
        item.subject.id === 'Ascendant';
      const activeRule = isNodeOrAsc ? nonClassicalLagnaRule : lagnaRule;
      const baseClass: AuthorityClassification = lagnaSandhiRisk
        ? 'AC3'
        : isNodeOrAsc
        ? item.subject.id === 'Ascendant'
          ? 'AC2'
          : 'AC3'
        : code === 'VEDIC_D1_ASCENDANT_SIGN'
        ? 'AC1'
        : 'AC2';
      candidates.push({
        item,
        objectiveId: 'functional_orientation_by_lagna',
        rule: activeRule,
        baseClass,
        propositionRef: `functional_orientation:${lagnaSign}:${code}:${item.subject.id}`,
        extraLimiting: lagnaSandhiRisk
          ? ['Ascendant Sandhi/Gandanta sensitivity caps Lagna-dependent functional classifications.']
          : [],
      });
    }
  }

  // Quarantine ALL temporalEvidence (`reference_date_dependent`) explicitly as AC6
  const verifCompatRule = assertRegisteredR04Rule('R04_CROSS_TRADITION_VERIFICATION_AND_COMPATIBILITY');
  for (const tItem of temporalItems) {
    candidates.push({
      item: tItem,
      objectiveId: 'evidence_verification_and_compatibility',
      rule: verifCompatRule,
      baseClass: 'AC6',
      propositionRef: `temporal_natal_quarantine:${tItem.observation.code}:${tItem.referenceDateIso ?? 'ref'}`,
      forceExclusionReason: 'temporal_natal_quarantine',
      extraLimiting: [
        `Temporal scope "reference_date_dependent" (${tItem.referenceDateIso ?? 'unspecified'}) quarantined from natal authority (Layer 1).`,
      ],
    });
  }

  // 3. Group candidates by (objectiveId, subjectId) for per-objective overlap & corroboration analysis
  const candidatesByObjBucket = new Map<string, CandidateSpec[]>();
  for (const c of candidates) {
    const key = `${c.objectiveId}::${c.item.subject.id}`;
    const list = candidatesByObjBucket.get(key) ?? [];
    list.push(c);
    candidatesByObjBucket.set(key, list);
  }

  // 4. Materialize CEAR records, exclusions, unresolved requirements & rule execution traces
  const cearRecords: ContextualEvidenceAuthorityRecord[] = [];
  const exclusionAndLimitationRecords: K03ExclusionAndLimitationRecord[] = [];
  const unresolvedRequirements: K03UnresolvedRequirementRecord[] = [];
  const traceMap = new Map<string, K03RuleExecutionTrace>();

  const pushExclusion = (entry: Omit<K03ExclusionAndLimitationRecord, 'recordId'>) => {
    const key = `${entry.objectiveId}:${entry.evidenceId ?? 'none'}:${entry.subject.id}:${entry.reasonCode}`;
    const recordId = `excl_${sha256Hex(key).slice(0, 20)}`;
    if (!exclusionAndLimitationRecords.some((x) => x.recordId === recordId)) {
      exclusionAndLimitationRecords.push({ recordId, ...entry });
    }
  };

  const pushUnresolved = (entry: Omit<K03UnresolvedRequirementRecord, 'requirementId'>) => {
    const key = `${entry.objectiveId}:${entry.subject}:${entry.prerequisiteKey}`;
    const requirementId = `unres_${sha256Hex(key).slice(0, 20)}`;
    if (!unresolvedRequirements.some((x) => x.requirementId === requirementId)) {
      unresolvedRequirements.push({ requirementId, ...entry });
    }
  };

  const recordTrace = (params: {
    rule: R04AuthorityRuleDefinition;
    objectiveId: AnalyticalObjectiveId;
    subject: string;
    status: K03RuleExecutionTrace['status'];
    evidenceId: string | null;
    cearId: string | null;
    reason: string;
  }) => {
    const traceKey = `${params.rule.ruleId}:${params.objectiveId}:${params.subject}:${params.status}`;
    const existing = traceMap.get(traceKey);
    if (existing) {
      if (params.evidenceId && !existing.evaluatedEvidenceIds.includes(params.evidenceId)) {
        existing.evaluatedEvidenceIds.push(params.evidenceId);
      }
      if (params.cearId && !existing.emittedCearIds.includes(params.cearId)) {
        existing.emittedCearIds.push(params.cearId);
      }
      return;
    }
    traceMap.set(traceKey, {
      traceId: `rtx_${sha256Hex(traceKey).slice(0, 20)}`,
      ruleId: params.rule.ruleId,
      ruleVersion: params.rule.version,
      objectiveId: params.objectiveId,
      subject: params.subject,
      status: params.status,
      evaluatedEvidenceIds: params.evidenceId ? [params.evidenceId] : [],
      emittedCearIds: params.cearId ? [params.cearId] : [],
      reason: params.reason,
    });
  };

  // Evaluate each CandidateSpec deterministically
  for (const spec of candidates) {
    const { item, objectiveId, rule } = spec;
    // Enforce registry assertion on every execution
    const verifiedRule = assertRegisteredR04Rule(rule.ruleId, rule.version);

    const bucketKey = `${objectiveId}::${item.subject.id}`;
    const bucketSpecs = candidatesByObjBucket.get(bucketKey) ?? [spec];
    const bucketEvidenceIds = new Set(bucketSpecs.map((b) => b.item.evidenceId));
    const bucketEvidenceItems = bucketSpecs.map((b) => b.item);

    const temporalQuarantined = item.temporalScope === 'reference_date_dependent';
    const frameIncompatible =
      blockedIncompatibleFrames.has(item.frame) ||
      !verifiedRule.permittedChartFrames.includes(item.frame) ||
      item.verification.propagatedTrust === 'blocked' ||
      item.verification.computational === 'incompatible' ||
      item.verification.computational === 'unavailable';
    const missingOrNullReason = buildMissingOrNullCheck(item);
    const provisional = isProvisionalEvidence(item, shadbalaUnassigned);

    // Independence analysis scoped to (objectiveId, subject)
    const rels = overlapRelsByEvidence.get(item.evidenceId) ?? [];
    const inObjectiveRels = rels.filter(
      (r) => bucketEvidenceIds.has(r.evidenceIdA) && bucketEvidenceIds.has(r.evidenceIdB)
    );
    const exactDupRel = inObjectiveRels.find((r) => r.overlapType === 'exact_duplicate');
    const partialOverlapRels = inObjectiveRels.filter(
      (r) => r.overlapType === 'partial_mathematical_overlap'
    );
    const sharedUpstreamRel = inObjectiveRels.find(
      (r) => r.overlapType === 'shared_upstream_dependency'
    );
    const distinctLensRel = rels.find(
      (r) => r.overlapType === 'distinct_analytical_significance'
    );

    let independenceStatus: K03EvidenceIndependenceClassification = 'distinct_analytical_significance';
    let doubleCountingGuardApplied = false;
    let primaryRepresentativeId: string | null = item.evidenceId;
    let overlapGroupId: string | null = null;
    const overlapNotes: string[] = [];

    if (frameIncompatible || spec.forceExclusionReason === 'methodological_non_dominance_guard') {
      independenceStatus = 'methodological_incompatibility';
      overlapNotes.push('Incompatible chart frame or prohibited cross-system dominance for this objective.');
    } else if (exactDupRel) {
      const siblingId =
        exactDupRel.evidenceIdA === item.evidenceId ? exactDupRel.evidenceIdB : exactDupRel.evidenceIdA;
      const keepPrimary = item.evidenceId < siblingId;
      primaryRepresentativeId = keepPrimary ? item.evidenceId : siblingId;
      if (!keepPrimary) {
        independenceStatus = 'exact_duplicate';
        doubleCountingGuardApplied = true;
        overlapGroupId = `ovg_${sha256Hex([item.evidenceId, siblingId].sort().join('|')).slice(0, 16)}`;
        overlapNotes.push(`Collapsed duplicate of ${siblingId} within objective "${objectiveId}".`);
      } else {
        independenceStatus = 'distinct_analytical_significance';
        overlapNotes.push(`Selected as primary canonical item over duplicate ${siblingId}.`);
      }
    } else if (partialOverlapRels.length > 0) {
      const peerIds = new Set<string>([item.evidenceId]);
      for (const pr of partialOverlapRels) {
        peerIds.add(pr.evidenceIdA);
        peerIds.add(pr.evidenceIdB);
      }
      const peerItems = bucketEvidenceItems.filter((x) => peerIds.has(x.evidenceId));
      const sortedGroup = Array.from(peerIds).sort();
      overlapGroupId = `ovg_${sha256Hex(sortedGroup.join('|')).slice(0, 16)}`;
      primaryRepresentativeId =
        peerItems.length >= 2
          ? pickPartialGroupPrimaryId(peerItems, preferredVimshopakaBySubject)
          : item.evidenceId;

      if (primaryRepresentativeId !== item.evidenceId) {
        independenceStatus = 'partial_mathematical_overlap';
        doubleCountingGuardApplied = true;
        overlapNotes.push(
          `Shares mathematical inputs with primary ${primaryRepresentativeId}; downgraded to prevent double-counting.`
        );
      } else {
        independenceStatus = 'partial_mathematical_overlap';
        doubleCountingGuardApplied = false;
        overlapNotes.push(
          `Designated primary representative in overlap group ${overlapGroupId}; siblings remain AC5 Background.`
        );
      }
    } else if (distinctLensRel) {
      independenceStatus = 'distinct_analytical_significance';
      overlapNotes.push('Distinct frame/varga/lens analytical significance preserved without collapsing.');
    } else if (sharedUpstreamRel) {
      independenceStatus = 'shared_upstream_dependency';
      overlapNotes.push('Shares intermediate upstream derivation edge inside objective.');
    } else if (
      unresolvedParentIds.has(item.evidenceId) ||
      item.verification.computational === 'unverified'
    ) {
      independenceStatus = 'unknown_independence';
      overlapNotes.push('Upstream lineage parent missing or computational provenance unverified.');
    } else {
      independenceStatus = 'distinct_analytical_significance';
      overlapNotes.push('Independent canonical evidence inside target frame and objective.');
    }

    const independenceInfo: CearEvidenceIndependenceInfo = {
      independenceStatus,
      overlapGroupId,
      overlapRelationIds: inObjectiveRels.map((r) => r.relationId),
      doubleCountingGuardApplied,
      primaryRepresentativeId,
      notes: overlapNotes,
    };

    // Determine final AuthorityClassification respecting strict policy hierarchy
    let finalClass: AuthorityClassification = spec.baseClass;
    const supportingConditions: string[] = [...(spec.extraSupporting ?? [])];
    const limitingConditions: string[] = [...(spec.extraLimiting ?? [])];
    const unresolvedPrerequisites: string[] = [...(spec.extraPrerequisites ?? [])];

    if (spec.forceExclusionReason === 'temporal_natal_quarantine' || temporalQuarantined) {
      finalClass = 'AC6';
      pushExclusion({
        evidenceId: item.evidenceId,
        objectiveId,
        subject: item.subject,
        classification: 'AC6',
        reasonCode: 'temporal_natal_quarantine',
        rationale: `Quarantined temporal item (${item.observation.code}) from natal objective.`,
        ruleId: verifiedRule.ruleId,
        unresolvedPrerequisites,
      });
    } else if (
      spec.forceExclusionReason === 'p08_excluded_from_phi' ||
      spec.forceExclusionReason === 'subject_scope_inapplicable' ||
      spec.forceExclusionReason === 'methodological_non_dominance_guard'
    ) {
      finalClass = 'AC6';
      pushExclusion({
        evidenceId: item.evidenceId,
        objectiveId,
        subject: item.subject,
        classification: 'AC6',
        reasonCode: spec.forceExclusionReason,
        rationale: limitingConditions[0] ?? `Excluded by rule ${verifiedRule.ruleId}.`,
        ruleId: verifiedRule.ruleId,
        unresolvedPrerequisites,
      });
    } else if (frameIncompatible) {
      finalClass = 'AC6';
      limitingConditions.push(
        `Frame "${item.frame}" is blocked/incompatible for rule ${verifiedRule.ruleId} or evidence trust="blocked".`
      );
      pushExclusion({
        evidenceId: item.evidenceId,
        objectiveId,
        subject: item.subject,
        classification: 'AC6',
        reasonCode: 'blocked_or_incompatible_frame',
        rationale: `Incompatible or blocked frame/dataset (${item.frame}, trust=${item.verification.propagatedTrust}).`,
        ruleId: verifiedRule.ruleId,
        unresolvedPrerequisites,
      });
    } else if (missingOrNullReason) {
      finalClass = 'AC6';
      limitingConditions.push(missingOrNullReason);
      unresolvedPrerequisites.push(`missing_finite_metric:${item.observation.code}`);
      pushExclusion({
        evidenceId: item.evidenceId,
        objectiveId,
        subject: item.subject,
        classification: 'AC6',
        reasonCode: 'zero_coercion_missing_or_null',
        rationale: missingOrNullReason,
        ruleId: verifiedRule.ruleId,
        unresolvedPrerequisites,
      });
    } else if (item.verification.computational === 'unverified') {
      finalClass = 'indeterminate';
      limitingConditions.push(
        'Computational verification status is "unverified"; classified indeterminate pending verification.'
      );
      unresolvedPrerequisites.push(`computational_verification_required:${item.observation.code}`);
      pushUnresolved({
        objectiveId,
        subject: item.subject.id,
        prerequisiteKey: `computational_verification:${item.observation.code}`,
        classification: 'indeterminate',
        reason: `Evidence "${item.observation.code}" is computationally unverified.`,
      });
    } else if (doubleCountingGuardApplied && independenceStatus === 'exact_duplicate') {
      finalClass = 'AC6';
      limitingConditions.push(`Exact duplicate collapsed behind primary ${primaryRepresentativeId}.`);
      pushExclusion({
        evidenceId: item.evidenceId,
        objectiveId,
        subject: item.subject,
        classification: 'AC6',
        reasonCode: 'overlap_double_counting_guard',
        rationale: `Exact duplicate of ${primaryRepresentativeId} excluded from inflating authority.`,
        ruleId: verifiedRule.ruleId,
        unresolvedPrerequisites,
      });
    } else {
      // Partial mathematical overlap secondary downgrade -> AC5 Background
      if (doubleCountingGuardApplied && independenceStatus === 'partial_mathematical_overlap') {
        if (CLASSIFICATION_RANK[finalClass] > CLASSIFICATION_RANK.AC5) {
          finalClass = 'AC5';
        }
        limitingConditions.push(
          `Partial mathematical overlap with ${primaryRepresentativeId}; capped at AC5 Background.`
        );
        pushExclusion({
          evidenceId: item.evidenceId,
          objectiveId,
          subject: item.subject,
          classification: finalClass,
          reasonCode: 'overlap_double_counting_guard',
          rationale: `Overlapping mathematical derivative of ${primaryRepresentativeId} capped at AC5 Background.`,
          ruleId: verifiedRule.ruleId,
          unresolvedPrerequisites,
        });
      }

      // Layer 1 Provisional Ceiling Gate (NEVER AC1/AC2/AC3; capped at AC4/AC5, or AC6 if strictNonProvisional)
      if (provisional) {
        if (strictNonProvisional) {
          finalClass = 'AC6';
          limitingConditions.push(
            'Excluded as AC6 under strictNonProvisional=true (provisional evidence disallowed).'
          );
          pushExclusion({
            evidenceId: item.evidenceId,
            objectiveId,
            subject: item.subject,
            classification: 'AC6',
            reasonCode: 'strict_non_provisional_exclusion',
            rationale: `strictNonProvisional gate excluded provisional ${item.observation.code}.`,
            ruleId: verifiedRule.ruleId,
            unresolvedPrerequisites: [
              ...unresolvedPrerequisites,
              'requires_usable_external_or_reconciled_dataset',
            ],
          });
        } else {
          if (CLASSIFICATION_RANK[finalClass] > CLASSIFICATION_RANK.AC4) {
            finalClass = 'AC4';
          }
          limitingConditions.push(
            'Provisional evidence gated by Layer 1 Universal Integrity Policy: capped at non-decisive AC4/AC5 (never AC1).'
          );
          if (
            item.observation.code.includes('SHADBALA') ||
            item.observation.code === 'BHAVABALA_HOUSE_STRENGTH'
          ) {
            unresolvedPrerequisites.push(
              'docs/SHADBALA_BHAVABALA_ISSUE_REGISTER.md:pending_external_jhora_pyjhora_reconciliation'
            );
          }
          pushExclusion({
            evidenceId: item.evidenceId,
            objectiveId,
            subject: item.subject,
            classification: finalClass,
            reasonCode: 'provisional_ceiling_cap',
            rationale: `Provisional evidence ${item.observation.code} capped at ${finalClass} (never AC1).`,
            ruleId: verifiedRule.ruleId,
            unresolvedPrerequisites,
          });
        }
      }
    }

    if (finalClass === 'AC1') {
      supportingConditions.push(
        `Qualified as AC1 (Decisive strictly for registered analytical qualification "${spec.propositionRef}", never real-world outcome proof).`
      );
    } else if (finalClass !== 'AC6' && supportingConditions.length === 0) {
      supportingConditions.push(
        `Qualified under ${verifiedRule.ruleId}@${verifiedRule.version} in isolated frame "${item.frame}".`
      );
    }

    const subjName = isSubjectName(item.subject.id) ? item.subject.id : null;
    const relFact = subjName ? relationalContext?.bySubject?.[subjName] : undefined;
    const relationalFactNote =
      objectiveId === 'dispositor_dependency' && relFact
        ? `K04 Dispositor Context: terminalKind=${relFact.terminalKind ?? 'unknown'}, inSccCycle=${relFact.isInSccCycle}, depth=${relFact.dependencyDepth ?? 'null'}, inbound=${relFact.inboundDependentCount}.`
        : null;
    if (relationalFactNote) {
      supportingConditions.push(relationalFactNote);
    }

    const corroborationIds = bucketSpecs
      .map((b) => b.item.evidenceId)
      .filter((id) => id !== item.evidenceId);
    const activeModifiers = subjName ? activeModifiersBySubject.get(subjName) ?? [] : [];

    const applicableMethodology = verifiedRule.applicableMethodology;
    const { authorityRecordId } = buildDeterministicAuthorityRecordId({
      evidenceId: item.evidenceId,
      objectiveId,
      propositionRef: spec.propositionRef,
      applicableMethodology,
      applicableChartFrame: item.frame,
    });

    const dimensionAssessments = buildTenDimensions({
      item,
      objectiveId,
      rule: verifiedRule,
      classification: finalClass,
      independence: independenceInfo,
      provisional,
      temporalQuarantined,
      frameIncompatible,
      supportingConditions,
      limitingConditions,
      unresolvedPrerequisites,
      relationalFactNote,
      activeModifiers,
      corroborationIds,
    });

    const cear: ContextualEvidenceAuthorityRecord = {
      schemaVersion: K03_CEAR_SCHEMA_VERSION,
      authorityRecordId,
      evidenceId: item.evidenceId,
      objectiveId,
      propositionRef: spec.propositionRef,
      subject: item.subject,
      relatedEntities: item.relatedEntities,
      applicableMethodology,
      applicableChartFrame: item.frame,
      dimensionAssessments,
      authorityClassification: finalClass,
      qualificationStatus: mapQualificationStatus(finalClass, limitingConditions),
      applicableRuleReferences: [mapRuleRef(verifiedRule)],
      supportingConditions,
      limitingConditions,
      evidenceIndependenceInfo: independenceInfo,
      verificationStatus: {
        computational: item.verification.computational,
        methodological: item.verification.methodological,
        empirical: item.verification.empirical,
        propagatedTrust: item.verification.propagatedTrust,
      },
      unresolvedPrerequisites: Array.from(new Set(unresolvedPrerequisites)),
      versionMetadata: {
        schemaVersion: K03_CEAR_SCHEMA_VERSION,
        engineVersion: K03_AUTHORITY_ENGINE_VERSION,
        registryVersion: R04_AUTHORITY_REGISTRY_VERSION,
        evidenceRuleVersion: item.versions.ruleVersion ?? null,
      },
    };

    cearRecords.push(cear);

    const traceStatus: K03RuleExecutionTrace['status'] =
      finalClass === 'AC6'
        ? 'excluded'
        : provisional
        ? 'provisional_capped'
        : finalClass === 'unevaluated'
        ? 'unevaluated'
        : finalClass === 'indeterminate'
        ? 'indeterminate'
        : 'applied';

    recordTrace({
      rule: verifiedRule,
      objectiveId,
      subject: item.subject.id,
      status: traceStatus,
      evidenceId: item.evidenceId,
      cearId: cear.authorityRecordId,
      reason: `Evaluated ${item.observation.code} -> ${finalClass} (${independenceStatus}).`,
    });
  }

  // 5. Explicit AC6 notices for blocked/incompatible frames in repo.rejectedOrBlockedFrames
  for (const notice of repo.rejectedOrBlockedFrames) {
    if (notice.canonicalStatus === 'incompatible') {
      const targetObjective: AnalyticalObjectiveId =
        notice.frame === 'bhava_chalit'
          ? 'house_governance'
          : 'evidence_verification_and_compatibility';
      const governingRule =
        targetObjective === 'house_governance'
          ? assertRegisteredR04Rule('R04_PARASHARI_HOUSE_GOVERNANCE_AND_CHALIT')
          : assertRegisteredR04Rule('R04_CROSS_TRADITION_VERIFICATION_AND_COMPATIBILITY');

      const syntheticEvidenceId = `blocked_frame:${notice.frame}:${notice.datasetKey}`;
      const { authorityRecordId } = buildDeterministicAuthorityRecordId({
        evidenceId: syntheticEvidenceId,
        objectiveId: targetObjective,
        propositionRef: `blocked_frame:${notice.frame}:${notice.datasetKey}`,
        applicableMethodology: governingRule.applicableMethodology,
        applicableChartFrame: notice.frame,
      });

      const dummyBlockedItem: CanonicalEvidenceObject = {
        evidenceId: syntheticEvidenceId,
        naturalKey: syntheticEvidenceId,
        subject: { type: 'dataset', id: notice.datasetKey, name: notice.datasetKey },
        relatedEntities: [],
        family: 'positional',
        secondaryTags: ['blocked_incompatible_frame'],
        observation: {
          code: `BLOCKED_FRAME_${notice.frame.toUpperCase()}`,
          label: `Blocked Frame (${notice.frame})`,
          summary: notice.reason,
          classification: 'blocked',
        },
        measurements: [],
        frame: notice.frame,
        methodology: {
          tradition: 'cross_tradition',
          houseSystem: null,
          ayanamshaIdentifier: null,
          ayanamshaDegrees: null,
          nodeConvention: 'not_applicable',
          conventionNotes: [notice.reason],
        },
        ruleReference: {
          sourceType: 'proprietary',
          referenceCode: governingRule.ruleId,
          citation: notice.reason,
        },
        sourceDatasets: [
          {
            datasetKey: notice.datasetKey,
            providerOrModule: 'rejectedOrBlockedFrames',
            canonicalStatus: notice.canonicalStatus,
            acquiredAtUtc: null,
          },
        ],
        lineage: { parentEvidenceIds: [], derivedFromMetrics: [], derivationDepth: 0 },
        temporalScope: 'natal_invariant',
        referenceDateIso: null,
        verification: {
          computational: 'incompatible',
          methodological: 'incompatible_methodology',
          empirical: 'not_validated',
          propagatedTrust: 'blocked',
          statusNotes: [notice.reason],
        },
        sensitivity: {
          birthTimeSensitive: false,
          sandhiOrBoundaryRisk: false,
          conventionSensitive: true,
          reasons: [notice.reason],
        },
        versions: {
          kernelVersion: repo.kernelVersion,
          ruleVersion: governingRule.version,
          sourceSchemaVersion: repo.sourceChart.sourceSchemaVersion,
          recalculationVersion: repo.sourceChart.recalculationVersion,
        },
      };

      const independence: CearEvidenceIndependenceInfo = {
        independenceStatus: 'methodological_incompatibility',
        overlapGroupId: null,
        overlapRelationIds: [],
        doubleCountingGuardApplied: false,
        primaryRepresentativeId: null,
        notes: [notice.reason],
      };

      const cear: ContextualEvidenceAuthorityRecord = {
        schemaVersion: K03_CEAR_SCHEMA_VERSION,
        authorityRecordId,
        evidenceId: syntheticEvidenceId,
        objectiveId: targetObjective,
        propositionRef: `blocked_frame:${notice.frame}:${notice.datasetKey}`,
        subject: dummyBlockedItem.subject,
        relatedEntities: [],
        applicableMethodology: governingRule.applicableMethodology,
        applicableChartFrame: notice.frame,
        dimensionAssessments: buildTenDimensions({
          item: dummyBlockedItem,
          objectiveId: targetObjective,
          rule: governingRule,
          classification: 'AC6',
          independence,
          provisional: false,
          temporalQuarantined: false,
          frameIncompatible: true,
          supportingConditions: [],
          limitingConditions: [notice.reason],
          unresolvedPrerequisites: [`compatible_frame_required:${notice.frame}`],
          relationalFactNote: null,
          activeModifiers: [],
          corroborationIds: [],
        }),
        authorityClassification: 'AC6',
        qualificationStatus: 'excluded',
        applicableRuleReferences: [mapRuleRef(governingRule)],
        supportingConditions: [],
        limitingConditions: [notice.reason],
        evidenceIndependenceInfo: independence,
        verificationStatus: {
          computational: 'incompatible',
          methodological: 'incompatible_methodology',
          empirical: 'not_validated',
          propagatedTrust: 'blocked',
        },
        unresolvedPrerequisites: [`compatible_frame_required:${notice.frame}`],
        versionMetadata: {
          schemaVersion: K03_CEAR_SCHEMA_VERSION,
          engineVersion: K03_AUTHORITY_ENGINE_VERSION,
          registryVersion: R04_AUTHORITY_REGISTRY_VERSION,
          evidenceRuleVersion: governingRule.version,
        },
      };

      cearRecords.push(cear);
      pushExclusion({
        evidenceId: syntheticEvidenceId,
        objectiveId: targetObjective,
        subject: dummyBlockedItem.subject,
        classification: 'AC6',
        reasonCode: 'blocked_or_incompatible_frame',
        rationale: notice.reason,
        ruleId: governingRule.ruleId,
        unresolvedPrerequisites: [`compatible_frame_required:${notice.frame}`],
      });
      recordTrace({
        rule: governingRule,
        objectiveId: targetObjective,
        subject: notice.datasetKey,
        status: 'excluded',
        evidenceId: syntheticEvidenceId,
        cearId: authorityRecordId,
        reason: notice.reason,
      });
    }
  }

  // 6. Handle missing prerequisites / unevaluated objectives (never force missing inputs into AC1-AC5)
  if (!lagnaRule) {
    pushUnresolved({
      objectiveId: 'functional_orientation_by_lagna',
      subject: 'Ascendant',
      prerequisiteKey: 'VEDIC_D1_ASCENDANT_SIGN',
      classification: 'unevaluated',
      reason:
        'Vedic D1 Ascendant (Lagna) sign is missing; BPHS Ch. 34 functional orientation cannot be assigned universally without a Lagna.',
    });
    pushUnresolved({
      objectiveId: 'ascendant_and_lagnesh_condition',
      subject: 'Ascendant',
      prerequisiteKey: 'VEDIC_D1_ASCENDANT_SIGN',
      classification: 'unevaluated',
      reason: 'Ascendant anchor missing in repository.',
    });
  }

  for (const objId of ANALYTICAL_OBJECTIVE_IDS) {
    const countForObj = cearRecords.filter((r) => r.objectiveId === objId).length;
    if (countForObj === 0) {
      pushUnresolved({
        objectiveId: objId,
        subject: 'Ascendant',
        prerequisiteKey: `missing_evidence_for_${objId}`,
        classification: 'unevaluated',
        reason: `No eligible repository evidence present for objective "${objId}"; marked unevaluated without coercing missing values.`,
      });
    }
  }

  // Deterministic ordering of CEAR records
  cearRecords.sort((a, b) =>
    `${a.objectiveId}:${a.subject.id}:${a.authorityRecordId}`.localeCompare(
      `${b.objectiveId}:${b.subject.id}:${b.authorityRecordId}`
    )
  );

  // 7. Build P09 (Functional Orientation) Profiles per subject (`Sun`..`Ketu`, `Ascendant`)
  const functionalOrientationProfiles = {} as Record<
    PlanetaryStateSubjectName,
    K03P09FunctionalOrientationProfile
  >;

  const cearBySubject = new Map<PlanetaryStateSubjectName, ContextualEvidenceAuthorityRecord[]>();
  for (const subj of PLANETARY_STATE_SUBJECTS) {
    cearBySubject.set(subj, []);
  }
  for (const c of cearRecords) {
    if (isSubjectName(c.subject.id)) {
      cearBySubject.get(c.subject.id)!.push(c);
    } else if (c.subject.id === 'KP_Cusp_1' || c.subject.id === 'West_Ascendant') {
      cearBySubject.get('Ascendant')!.push(c);
    }
    for (const rel of c.relatedEntities) {
      if (isSubjectName(rel.id) && rel.id !== c.subject.id) {
        const list = cearBySubject.get(rel.id)!;
        if (!list.some((x) => x.authorityRecordId === c.authorityRecordId)) {
          list.push(c);
        }
      }
    }
  }

  for (const subject of PLANETARY_STATE_SUBJECTS) {
    const natInfo = getNaturalPolarityForSubject(subject);
    const subjNatal = natalItems.filter(
      (e) => e.subject.id === subject || e.relatedEntities.some((r) => r.id === subject)
    );
    const jaiminiItems = subjNatal.filter((e) => e.observation.code === 'JAIMINI_CHARA_KARAKA');
    const kpHouseItem = subjNatal.find((e) => e.observation.code === 'KP_PLACIDUS_HOUSE_PLACEMENT');
    const kpSubItem = subjNatal.find(
      (e) =>
        e.observation.code === 'KP_PLANET_SUB_LORDS' ||
        (subject === 'Ascendant' &&
          e.observation.code === 'KP_CUSPAL_SUB_LORDS' &&
          e.subject.id === 'KP_Cusp_1')
    );
    const kpSigItem = subjNatal.find((e) => e.observation.code === 'KP_FOUR_LEVEL_SIGNIFICATORS');
    const kpFourLevel: Record<string, number[]> | null = kpSigItem
      ? (() => {
          const out: Record<string, number[]> = {};
          for (const m of kpSigItem.measurements) {
            if (typeof m.value === 'string' && m.value.trim()) {
              const nums = m.value
                .split(',')
                .map((s) => Number(s.trim()))
                .filter((n) => Number.isFinite(n));
              if (nums.length) out[m.metric] = nums;
            }
          }
          return Object.keys(out).length ? out : null;
        })()
      : null;

    const subjFunctionalCears = (cearBySubject.get(subject) ?? []).filter(
      (c) => c.objectiveId === 'functional_orientation_by_lagna'
    );

    if (!lagnaRule || !lagnaRule.lagnaFunctionalSpec || !lagnaSign) {
      functionalOrientationProfiles[subject] = {
        subject,
        dimension: 'functionalOrientation',
        status: 'unevaluated',
        lagnaSign: null,
        methodology: 'vedic_parashari',
        ruleId: null,
        ruleVersion: null,
        authorityClassification: 'unevaluated',
        role: 'unevaluated',
        functionalBenefic: null,
        functionalMalefic: null,
        yogakaraka: null,
        maraka: null,
        conditionalMaraka: null,
        conditionalMarakaHouses: [],
        neutralOrMixed: null,
        lagnesha: null,
        directHouseLordships: {
          ruledHouses: [],
          kendraHouses: [],
          trikonaHouses: [],
          dusthanaHouses: [],
          marakaHouses: [],
          badhakaNote: null,
        },
        coexistingResponsibilities: [],
        methodologicalQualifications: {
          differsAcrossClassicalConventions: false,
          conventionNotes: [
            'Lagna sign is absent; BPHS Ch. 34 functional responsibilities remain unevaluated.',
          ],
          functionalBeneficDoesNotExcludeConditionalMaraka: true,
        },
        naturalSignifications: {
          ...natInfo,
          nonConflationNote:
            'Natural polarity (Naisargika) is strictly separate from BPHS Ch. 34 Lagna-dependent functional benefic/malefic status.',
        },
        functionalResponsibilities: {
          summary: `Unevaluated for ${subject}: Vedic D1 Lagna anchor is absent (no universal functional labels assigned).`,
          caveats: ['Requires Vedic D1 Ascendant sign to select registered BPHS Ch. 34 Lagna rule.'],
          roleSource: 'unevaluated',
        },
        jaiminiKarakas: {
          karakaCodes: jaiminiItems.map((j) => strMetric(j, 'karaka_code') ?? j.observation.classification),
          karakaScheme: jaiminiItems[0] ? strMetric(jaiminiItems[0], 'karaka_scheme') : null,
          sourceEvidenceIds: jaiminiItems.map((j) => j.evidenceId),
          separationNote: 'Jaimini Chara Karakas are tracked separately from Parashari house lordship.',
        },
        kpSignifications: {
          kpHouse: numMetric(kpHouseItem, 'kp_house'),
          starLord: strMetric(kpSubItem, 'star_lord'),
          subLord: strMetric(kpSubItem, 'sub_lord'),
          fourLevelHouseSignifications: kpFourLevel,
          sourceEvidenceIds: [kpHouseItem, kpSubItem, kpSigItem]
            .filter((x): x is CanonicalEvidenceObject => Boolean(x))
            .map((x) => x.evidenceId),
          separationNote: 'KP Placidus significations stay isolated inside kp_placidus.',
        },
        unresolvedPrerequisites: ['VEDIC_D1_ASCENDANT_SIGN'],
        cearRecordIds: subjFunctionalCears.map((c) => c.authorityRecordId),
      };
      continue;
    }

    const spec = lagnaRule.lagnaFunctionalSpec;
    const ascProvisional = ascSignItem ? isProvisionalEvidence(ascSignItem, shadbalaUnassigned) : false;

    if (subject === 'Rahu' || subject === 'Ketu' || subject === 'Ascendant') {
      const role: LagnaFunctionalRole =
        subject === 'Ascendant' ? 'non_planetary_lagna_reference' : 'contingent_nodal_agent';
      const dispItem = subjNatal.find((e) => e.observation.code === 'VEDIC_D1_DISPOSITOR_DEPENDENCY');
      const dispLord = strMetric(dispItem, 'sign_lord');
      const cls: AuthorityClassification = ascProvisional
        ? strictNonProvisional
          ? 'AC6'
          : 'AC4'
        : lagnaSandhiRisk
        ? 'AC3'
        : subject === 'Ascendant'
        ? 'AC2'
        : 'AC3';

      functionalOrientationProfiles[subject] = {
        subject,
        dimension: 'functionalOrientation',
        status: lagnaSandhiRisk || ascProvisional ? 'constrained_sandhi_or_provisional' : 'evaluated',
        lagnaSign,
        methodology: 'vedic_parashari',
        ruleId: nonClassicalLagnaRule.ruleId,
        ruleVersion: nonClassicalLagnaRule.version,
        authorityClassification: cls,
        role,
        functionalBenefic: null,
        functionalMalefic: null,
        yogakaraka: null,
        maraka: null,
        conditionalMaraka: null,
        conditionalMarakaHouses: [],
        neutralOrMixed: null,
        lagnesha: subject === 'Ascendant' ? null : false,
        directHouseLordships: {
          ruledHouses: [],
          kendraHouses: [],
          trikonaHouses: [],
          dusthanaHouses: [],
          marakaHouses: [],
          badhakaNote: null,
        },
        coexistingResponsibilities: [
          {
            category: 'conditional',
            houses: [],
            label:
              subject === 'Ascendant'
                ? 'lagna_reference_via_lagnesha'
                : 'contingent_nodal_agent_via_dispositor',
            rationale:
              subject === 'Ascendant'
                ? `Ascendant acts as Lagna reference anchored through Lagnesha ${spec.lagnaLord}.`
                : `${subject} reflects sign dispositor ${dispLord ?? 'unresolved'} and co-occupants rather than fixed Rashi lordship.`,
          },
        ],
        methodologicalQualifications: {
          differsAcrossClassicalConventions: subject !== 'Ascendant',
          conventionNotes:
            subject === 'Ascendant'
              ? ['Ascendant is a reference point rather than a house-lord planet.']
              : [
                  'Classical conventions differ on Rahu/Ketu secondary sign lordships (Aquarius/Scorpio vs dispositor-only agentic transfer in K05 Interaction Intelligence).',
                ],
          functionalBeneficDoesNotExcludeConditionalMaraka: true,
        },
        naturalSignifications: {
          ...natInfo,
          nonConflationNote:
            'Shadow nodes / Ascendant never receive fixed 7-planet BPHS Ch. 34 lordship tables.',
        },
        functionalResponsibilities: {
          summary:
            subject === 'Ascendant'
              ? `Ascendant (Lagna = ${lagnaSign}) anchors the chart via Lagnesha ${spec.lagnaLord}.`
              : `${subject} is a contingent Chhaya Graha agent for ${lagnaSign} Lagna${
                  dispLord ? ` anchored by sign dispositor ${dispLord}` : ''
                }.`,
          caveats: [...nonClassicalLagnaRule.dependenciesAndLimitations],
          roleSource: subject === 'Ascendant' ? 'lagna_anchor' : 'nodal_exemption',
        },
        jaiminiKarakas: {
          karakaCodes: jaiminiItems.map((j) => strMetric(j, 'karaka_code') ?? j.observation.classification),
          karakaScheme: jaiminiItems[0] ? strMetric(jaiminiItems[0], 'karaka_scheme') : null,
          sourceEvidenceIds: jaiminiItems.map((j) => j.evidenceId),
          separationNote: 'Jaimini Chara Karakas are tracked separately from Parashari Lagna orientation.',
        },
        kpSignifications: {
          kpHouse: numMetric(kpHouseItem, 'kp_house'),
          starLord: strMetric(kpSubItem, 'star_lord'),
          subLord: strMetric(kpSubItem, 'sub_lord'),
          fourLevelHouseSignifications: kpFourLevel,
          sourceEvidenceIds: [kpHouseItem, kpSubItem, kpSigItem]
            .filter((x): x is CanonicalEvidenceObject => Boolean(x))
            .map((x) => x.evidenceId),
          separationNote: 'KP Placidus sub-lord & significations stay isolated inside kp_placidus.',
        },
        unresolvedPrerequisites: [],
        cearRecordIds: subjFunctionalCears.map((c) => c.authorityRecordId),
      };

      recordTrace({
        rule: nonClassicalLagnaRule,
        objectiveId: 'functional_orientation_by_lagna',
        subject,
        status: ascProvisional ? 'provisional_capped' : 'applied',
        evidenceId: ascSignItem?.evidenceId ?? dispItem?.evidenceId ?? null,
        cearId: subjFunctionalCears[0]?.authorityRecordId ?? null,
        reason: `Applied ${nonClassicalLagnaRule.ruleId} for ${subject} under ${lagnaSign} Lagna (${role}).`,
      });
      continue;
    }

    // Classical 7 Planet under BPHS Ch. 34 Lagna spec
    const planet = subject as PhiReadyPlanetName;
    const ruledHouses = Object.entries(spec.houseLordships)
      .filter(([, lord]) => lord === planet)
      .map(([h]) => Number(h))
      .sort((a, b) => a - b);

    const kendraHouses = ruledHouses.filter((h) => [1, 4, 7, 10].includes(h));
    const trikonaHouses = ruledHouses.filter((h) => [1, 5, 9].includes(h));
    const dusthanaHouses = ruledHouses.filter((h) => [6, 8, 12].includes(h));
    const marakaHouses = ruledHouses.filter((h) => [2, 7].includes(h));

    const badhakaHouse = MOVABLE_SIGNS.has(lagnaSign)
      ? 11
      : FIXED_SIGNS.has(lagnaSign)
      ? 9
      : 7;
    const badhakaNote = ruledHouses.includes(badhakaHouse)
      ? `Rules Badhaka house H${badhakaHouse} for ${lagnaSign} Lagna.`
      : null;

    const isLagnesha = spec.lagnaLord === planet;
    const isYogakaraka = spec.yogakarakas.includes(planet);
    const isFuncBenefic = spec.functionalBenefics.includes(planet);
    const isFuncMalefic = spec.functionalMalefics.includes(planet);
    const isNeutral = spec.neutralOrMixed.includes(planet);
    const isMaraka = spec.marakaPlanets.includes(planet);
    const isConditionalMaraka =
      Boolean(spec.conditionalMarakaPlanets?.includes(planet)) ||
      (!isMaraka && marakaHouses.length > 0);
    const conditionalMarakaHouses =
      isConditionalMaraka && marakaHouses.length > 0 ? [...marakaHouses] : [];

    const role: LagnaFunctionalRole = isYogakaraka
      ? 'yogakaraka'
      : isFuncBenefic
      ? 'functional_benefic'
      : isFuncMalefic
      ? 'functional_malefic'
      : isNeutral
      ? 'neutral_or_mixed'
      : isLagnesha
      ? 'lagnesha_anchor'
      : 'neutral_or_mixed';

    const cls: AuthorityClassification = ascProvisional
      ? strictNonProvisional
        ? 'AC6'
        : 'AC4'
      : lagnaSandhiRisk
      ? 'AC3'
      : 'AC1';

    const coexistingResponsibilities: K03CoexistingFunctionalResponsibility[] = [];
    if (isLagnesha) {
      coexistingResponsibilities.push({
        category: 'supportive',
        houses: [1],
        label: 'lagnesha_lagna_anchor',
        rationale: `${planet} governs H1 (Lagna) for ${lagnaSign} Ascendant, anchoring bodily/constitutional direction.`,
      });
    }
    const pureTrikonaHouses = trikonaHouses.filter((h) => h !== 1);
    if (pureTrikonaHouses.length > 0) {
      coexistingResponsibilities.push({
        category: 'supportive',
        houses: pureTrikonaHouses,
        label: 'trikona_supportive_governance',
        rationale: `${planet} governs supportive Trikona house(s) H${pureTrikonaHouses.join(', H')}.`,
      });
    }
    const pureKendraHouses = kendraHouses.filter((h) => h !== 1);
    if (pureKendraHouses.length > 0) {
      const hasKendradhipati =
        (natInfo.naturalPolarity === 'natural_benefic' || planet === 'Mercury') &&
        !isYogakaraka &&
        !isLagnesha;
      coexistingResponsibilities.push({
        category: hasKendradhipati ? 'conditional' : 'house_specific',
        houses: pureKendraHouses,
        label: hasKendradhipati ? 'kendra_with_kendradhipati_qualification' : 'kendra_governance',
        rationale: hasKendradhipati
          ? `${planet} governs Kendra house(s) H${pureKendraHouses.join(', H')}, attracting Kendradhipati Dosha qualification depending on strength and Trikona co-lordship.`
          : `${planet} governs Kendra house(s) H${pureKendraHouses.join(', H')}.`,
      });
    }
    if (dusthanaHouses.length > 0) {
      coexistingResponsibilities.push({
        category: 'constraining',
        houses: dusthanaHouses,
        label: 'dusthana_coexisting_responsibility',
        rationale: `${planet} simultaneously governs Dusthana house(s) H${dusthanaHouses.join(', H')}${
          isLagnesha || pureTrikonaHouses.length > 0
            ? '; coexists alongside Lagna/Trikona authority without erasing Dusthana duties.'
            : '.'
        }`,
      });
    }
    if (marakaHouses.length > 0) {
      coexistingResponsibilities.push({
        category: 'conditional',
        houses: marakaHouses,
        label: isMaraka ? 'primary_maraka_responsibility' : 'conditional_maraka_responsibility',
        rationale: isMaraka
          ? `${planet} carries primary Maraka responsibility via H${marakaHouses.join(', H')}.`
          : `${planet} carries conditional Maraka responsibility via H${marakaHouses.join(', H')} (${
              isFuncBenefic
                ? 'functional benefic classification does NOT exclude conditional H2/H7 Maraka duties'
                : 'subject to association, affliction, and timing activation in K05/K09'
            }).`,
      });
    }
    if (badhakaNote) {
      coexistingResponsibilities.push({
        category: 'conditional',
        houses: [badhakaHouse],
        label: 'badhaka_house_qualification',
        rationale: badhakaNote,
      });
    }
    const trishadayaOnly = ruledHouses.filter((h) => h === 3 || h === 11);
    if (trishadayaOnly.length > 0) {
      coexistingResponsibilities.push({
        category: 'constraining',
        houses: trishadayaOnly,
        label: 'trishadaya_effort_or_desire_governance',
        rationale: `${planet} governs Trishadaya house(s) H${trishadayaOnly.join(', H')}.`,
      });
    }

    const planetCaveats = [
      ...spec.classicalCaveats.filter((c) => c.includes(planet)),
      ...(spec.coexistingResponsibilityNotes ?? []).filter((c) => c.includes(planet)),
    ];
    const conventionNotes = (spec.classicalConventionNotes ?? []).filter(
      (c) => c.includes(planet) || coexistingResponsibilities.length > 1
    );

    functionalOrientationProfiles[subject] = {
      subject,
      dimension: 'functionalOrientation',
      status: lagnaSandhiRisk || ascProvisional ? 'constrained_sandhi_or_provisional' : 'evaluated',
      lagnaSign,
      methodology: 'vedic_parashari',
      ruleId: lagnaRule.ruleId,
      ruleVersion: lagnaRule.version,
      authorityClassification: cls,
      role,
      functionalBenefic: isFuncBenefic,
      functionalMalefic: isFuncMalefic,
      yogakaraka: isYogakaraka,
      maraka: isMaraka,
      conditionalMaraka: isConditionalMaraka,
      conditionalMarakaHouses,
      neutralOrMixed: isNeutral,
      lagnesha: isLagnesha,
      directHouseLordships: {
        ruledHouses,
        kendraHouses,
        trikonaHouses,
        dusthanaHouses,
        marakaHouses,
        badhakaNote,
      },
      coexistingResponsibilities,
      methodologicalQualifications: {
        differsAcrossClassicalConventions:
          conventionNotes.length > 0 || isConditionalMaraka || Boolean(badhakaNote) || dusthanaHouses.length > 0,
        conventionNotes,
        functionalBeneficDoesNotExcludeConditionalMaraka: true,
      },
      naturalSignifications: {
        ...natInfo,
        nonConflationNote:
          'Natural polarity (Naisargika) is preserved separately and NEVER conflated with Lagna-dependent functional orientation (BPHS Ch. 34).',
      },
      functionalResponsibilities: {
        summary: `${planet} for ${lagnaSign} Lagna rules H${ruledHouses.join('/H')} -> ${role}${
          isLagnesha ? ' (Lagnesha)' : ''
        }${isMaraka ? ' [Primary Maraka]' : ''}${
          isConditionalMaraka ? ` [Conditional Maraka H${conditionalMarakaHouses.join('/H')}]` : ''
        }.`,
        caveats: Array.from(new Set(planetCaveats)),
        roleSource: 'BPHS_CH34',
      },
      jaiminiKarakas: {
        karakaCodes: jaiminiItems.map((j) => strMetric(j, 'karaka_code') ?? j.observation.classification),
        karakaScheme: jaiminiItems[0] ? strMetric(jaiminiItems[0], 'karaka_scheme') : null,
        sourceEvidenceIds: jaiminiItems.map((j) => j.evidenceId),
        separationNote: 'Jaimini Chara Karakas are strictly separated from Parashari BPHS Ch. 34 lordships.',
      },
      kpSignifications: {
        kpHouse: numMetric(kpHouseItem, 'kp_house'),
        starLord: strMetric(kpSubItem, 'star_lord'),
        subLord: strMetric(kpSubItem, 'sub_lord'),
        fourLevelHouseSignifications: kpFourLevel,
        sourceEvidenceIds: [kpHouseItem, kpSubItem, kpSigItem]
          .filter((x): x is CanonicalEvidenceObject => Boolean(x))
          .map((x) => x.evidenceId),
        separationNote: 'KP Placidus sub-lord & significations remain isolated inside kp_placidus.',
      },
      unresolvedPrerequisites: ascProvisional ? ['usable_vedic_d1_ascendant_sign'] : [],
      cearRecordIds: subjFunctionalCears.map((c) => c.authorityRecordId),
    };

    recordTrace({
      rule: lagnaRule,
      objectiveId: 'functional_orientation_by_lagna',
      subject,
      status: ascProvisional ? 'provisional_capped' : 'applied',
      evidenceId: ascSignItem?.evidenceId ?? null,
      cearId: subjFunctionalCears[0]?.authorityRecordId ?? null,
      reason: `Applied ${lagnaRule.ruleId} for ${subject} (${lagnaSign} Lagna): role=${role}, houses=${ruledHouses.join(',')}.`,
    });
  }

  // 8. Build P05 (Authority) Subject Enrichment per subject (`Sun`..`Ketu`, `Ascendant`)
  const planetaryAuthorityEnrichment = {} as Record<
    PlanetaryStateSubjectName,
    K03P05SubjectAuthorityProfile
  >;

  const highestClassFromList = (list: AuthorityClassification[]): AuthorityClassification => {
    if (list.length === 0) return 'unevaluated';
    const sorted = [...list].sort((a, b) => CLASSIFICATION_RANK[b] - CLASSIFICATION_RANK[a]);
    return sorted[0];
  };

  for (const subject of PLANETARY_STATE_SUBJECTS) {
    const subjCears = cearBySubject.get(subject) ?? [];
    const objectiveAuthorities = {} as Record<AnalyticalObjectiveId, K03P05ObjectiveAuthorityEntry>;

    for (const objId of ANALYTICAL_OBJECTIVE_IDS) {
      const objCears = subjCears.filter((c) => c.objectiveId === objId);
      const qualified = objCears.filter((c) =>
        ['AC1', 'AC2', 'AC3', 'AC4', 'AC5'].includes(c.authorityClassification)
      );
      const excluded = objCears.filter((c) => c.authorityClassification === 'AC6');
      const unEval = objCears.filter((c) =>
        ['unevaluated', 'indeterminate'].includes(c.authorityClassification)
      );
      const provisionalCapped = objCears.some(
        (c) =>
          c.qualificationStatus === 'provisional_only' ||
          c.limitingConditions.some((l) => l.toLowerCase().includes('provisional'))
      );
      const provisionalCeilings = objCears
        .filter((c) => c.qualificationStatus === 'provisional_only')
        .map((c) => c.authorityClassification);

      objectiveAuthorities[objId] = {
        objectiveId: objId,
        highestClassification: highestClassFromList(
          objCears.map((c) => c.authorityClassification)
        ),
        qualifiedRecordCount: qualified.length,
        excludedRecordCount: excluded.length,
        unevaluatedOrIndeterminateCount: unEval.length,
        governingRuleIds: Array.from(
          new Set(objCears.flatMap((c) => c.applicableRuleReferences.map((r) => r.ruleId)))
        ),
        provisionalCapped,
        provisionalCeilingApplied:
          provisionalCeilings.length > 0 ? highestClassFromList(provisionalCeilings) : null,
        unresolvedPrerequisites: Array.from(
          new Set(objCears.flatMap((c) => c.unresolvedPrerequisites))
        ),
        cearRecordIds: objCears.map((c) => c.authorityRecordId),
      };
    }

    const p09 = functionalOrientationProfiles[subject];
    let lagnaAuthority: K03LagnaAuthorityEnrichment | null = null;
    if (p09.lagnaSign && p09.ruleId && p09.ruleVersion && p09.role !== 'unevaluated') {
      lagnaAuthority = {
        lagnaSign: p09.lagnaSign,
        lagnaLord,
        ruledHouses: p09.directHouseLordships.ruledHouses,
        authorityClassification: p09.authorityClassification,
        role: p09.role,
        isLagnesha: Boolean(p09.lagnesha),
        isYogakaraka: Boolean(p09.yogakaraka),
        isMaraka: Boolean(p09.maraka),
        isConditionalMaraka: Boolean(p09.conditionalMaraka),
        isKendraLord: p09.directHouseLordships.kendraHouses.length > 0,
        isTrikonaLord: p09.directHouseLordships.trikonaHouses.length > 0,
        isDusthanaLord: p09.directHouseLordships.dusthanaHouses.length > 0,
        ruleId: p09.ruleId,
        ruleVersion: p09.ruleVersion,
        rationale: p09.functionalResponsibilities.summary,
        caveats: p09.functionalResponsibilities.caveats,
        supportingEvidenceIds: ascSignItem ? [ascSignItem.evidenceId] : [],
      };
    }

    const allObjEntries = Object.values(objectiveAuthorities);
    const qualifiedHighest = highestClassFromList(
      subjCears
        .filter((c) => c.authorityClassification !== 'AC6')
        .map((c) => c.authorityClassification)
    );

    planetaryAuthorityEnrichment[subject] = {
      subject,
      dimension: 'authority',
      objectiveAuthorities,
      lagnaAuthority,
      overallHighestClassification:
        subjCears.length === 0 ? 'unevaluated' : qualifiedHighest === 'unevaluated' && subjCears.some((c) => c.authorityClassification === 'AC6') ? 'AC6' : qualifiedHighest,
      overallHighestClassificationDiagnosticMeta: {
        diagnosticMetadataOnly: true,
        notUniversalPlanetaryAuthority: true,
        forbiddenAsScoringOrPrioritizationInput: true,
        authorityRemainsObjectiveAndPropositionScoped: true,
        note: 'Summary metadata across evaluated CEAR records only; never treat as a universal planetary rank or input to scoring/prioritization.',
      },
      provisionalCappedAny: allObjEntries.some((o) => o.provisionalCapped),
      unresolvedPrerequisites: Array.from(
        new Set([
          ...allObjEntries.flatMap((o) => o.unresolvedPrerequisites),
          ...p09.unresolvedPrerequisites,
        ])
      ),
      cearRecordIds: subjCears.map((c) => c.authorityRecordId),
    };
  }

  // 9. Aggregate Objective & Independence Summaries
  const classificationsByObjective = {} as Record<
    AnalyticalObjectiveId,
    K03ObjectiveClassificationSummary
  >;
  for (const objId of ANALYTICAL_OBJECTIVE_IDS) {
    const counts = {} as Record<AuthorityClassification, number>;
    for (const cls of AUTHORITY_CLASSIFICATIONS) counts[cls] = 0;
    const objCears = cearRecords.filter((c) => c.objectiveId === objId);
    for (const c of objCears) counts[c.authorityClassification] += 1;
    const unresForObj = unresolvedRequirements.filter((u) => u.objectiveId === objId);
    if (objCears.length === 0 && unresForObj.length > 0) {
      counts.unevaluated += unresForObj.length;
    }

    classificationsByObjective[objId] = {
      objectiveId: objId,
      totalRecords: objCears.length,
      countsByClassification: counts,
      governingRuleIds: Array.from(
        new Set(objCears.flatMap((c) => c.applicableRuleReferences.map((r) => r.ruleId)))
      ),
      cearRecordIds: objCears.map((c) => c.authorityRecordId),
    };
  }

  const indCounts = {} as Record<K03EvidenceIndependenceClassification, number>;
  for (const ind of K03_INDEPENDENCE_CLASSIFICATIONS) indCounts[ind] = 0;
  const overlapGroups = new Set<string>();
  let doubleCountingGuardsApplied = 0;
  for (const c of cearRecords) {
    indCounts[c.evidenceIndependenceInfo.independenceStatus] += 1;
    if (c.evidenceIndependenceInfo.doubleCountingGuardApplied) doubleCountingGuardsApplied += 1;
    if (c.evidenceIndependenceInfo.overlapGroupId) {
      overlapGroups.add(c.evidenceIndependenceInfo.overlapGroupId);
    }
  }

  const independenceSummaries: K03IndependenceSummary = {
    totalEvaluatedRecords: cearRecords.length,
    countsByClassification: indCounts,
    doubleCountingGuardsApplied,
    distinctLensesPreserved: indCounts.distinct_analytical_significance,
    methodologicalIncompatibilities: indCounts.methodological_incompatibility,
    overlapGroupsDetected: Array.from(overlapGroups).sort(),
  };

  const policyConfiguration: K03PolicyConfiguration = {
    universalIntegrity,
    methodologicalAuthority,
    individualPreference,
  };

  return {
    engineVersion: K03_AUTHORITY_ENGINE_VERSION,
    cearSchemaVersion: K03_CEAR_SCHEMA_VERSION,
    registryVersion: R04_AUTHORITY_REGISTRY_VERSION,
    generatedAtUtc: new Date().toISOString(),
    sourceInputFingerprint: repo.sourceChart.inputFingerprint,
    strictNonProvisional,
    policyConfiguration,
    authorityScopeGuarantees: {
      objectiveAndPropositionScoped: true,
      crossObjectiveSummariesDiagnosticOnly: true,
      overallHighestNotScoringInput: true,
      ac5NeverSubstitutesForUnevaluatedOrIndeterminate: true,
    },
    relationalContextApplied: Boolean(relationalContext),
    cearRecords,
    r04RegistrySnapshot: exportR04RuleRegistrySnapshot(),
    classificationsByObjective,
    planetaryAuthorityEnrichment,
    functionalOrientationProfiles,
    independenceSummaries,
    exclusionAndLimitationRecords,
    unresolvedRequirements,
    ruleExecutionTraces: Array.from(traceMap.values()),
  };
}
