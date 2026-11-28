/**
 * CosmicCouncil Proprietary Analytical Intelligence Kernel — K02 PHI Preparation & Special Profiles
 *
 * Pure TypeScript / Web-standard implementation (zero Node built-ins; Cloudflare Workers safe).
 * Produces:
 *  1. Overlap-deduplicated `PhiReadyPlanetProjection` strictly for the 7 classical planets (`Sun`..`Saturn`)
 *     while enforcing strict boundary exclusions against:
 *       - Temporal activation (`reference_date_dependent`, Dashas, Gochar, KP Ruling Planets)
 *       - Structural / Lagna authority (`K03` house lordships, Yogakaraka, functional benefic/malefic)
 *       - Domain importance (`K04`)
 *       - Historical / life-context outcomes (`K08` / `lifeContext`)
 *       - Unrelated house-ownership & broad signification footprint (`P08`)
 *  2. Dedicated `NodalConditionProfile` for `Rahu` and `Ketu` (never forced into Shadbala/PHI).
 *  3. Dedicated `AscendantConditionProfile` for `Ascendant` (Lagna reference anchor + Lagna Lord chain).
 */

import { sha256Hex } from './lineage';
import {
  assertRegisteredRule,
  BPHS_SHADBALA_MIN_RUPAS,
  evaluateRuleMathModel,
} from './ruleRegistry';
import {
  K02_PROJECTION_SCHEMA_VERSION,
  PHI_READY_PLANETS,
  type AnalyticalEvidenceRepository,
  type AnalyticalKernelK02StateResult,
  type AscendantConditionProfile,
  type CanonicalEvidenceObject,
  type EvidenceImpactObject,
  type EvidenceImpactOverlapMetadata,
  type K02SubjectStateRecord,
  type NodalConditionProfile,
  type PhiPartialOverlapGroupSummary,
  type PhiReadyExcludedBoundaries,
  type PhiReadyPlanetName,
  type PhiReadyPlanetProjection,
  type PlanetaryStateSubjectName,
  type RuleExecutionRecord,
} from './types';

const VEDIC_SIGN_LORDS: Readonly<Record<string, string>> = Object.freeze({
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
});

function getMetricVal(
  item: CanonicalEvidenceObject | undefined,
  metricName: string
): number | string | boolean | null {
  if (!item) return null;
  const m = item.measurements.find((x) => x.metric === metricName);
  if (!m || m.value === null || m.value === undefined || m.value === '') return null;
  return m.value;
}

function numVal(item: CanonicalEvidenceObject | undefined, metricName: string): number | null {
  const v = getMetricVal(item, metricName);
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function strVal(item: CanonicalEvidenceObject | undefined, metricName: string): string | null {
  const v = getMetricVal(item, metricName);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function boolVal(item: CanonicalEvidenceObject | undefined, metricName: string): boolean | null {
  const v = getMetricVal(item, metricName);
  return typeof v === 'boolean' ? v : null;
}

function buildExcludedBoundaries(
  temporalExcludedCount: number,
  unrelatedHouseFootprintExcludedCount: number
): PhiReadyExcludedBoundaries {
  return {
    excludedK03StructuralAuthority: true,
    excludedDomainImportance: true,
    excludedTemporalDashaGochar: true,
    excludedHistoricalOutcomes: true,
    excludedHouseOwnershipNoise: true,
    excludedArbitraryWeights: true,
    temporalEvidenceExcluded: true,
    structuralAuthorityExcluded: true,
    domainImportanceExcluded: true,
    historicalOutcomesExcluded: true,
    unrelatedHouseFootprintExcluded: true,
    temporalEvidenceCountExcluded: temporalExcludedCount,
    unrelatedHouseFootprintEvidenceCountExcluded: unrelatedHouseFootprintExcludedCount,
    note: 'Strictly intrinsic planetary state projection for downstream PHI; excludes temporal activations, K03 Lagna/house authority, domain weights, historical outcomes, and P08 house-ownership noise.',
  };
}

function classifyOverlapCategory(
  codes: string[]
): PhiPartialOverlapGroupSummary['category'] {
  if (codes.some((c) => c.includes('SHADBALA') || c === 'ISHTA_KASHTA_PHALA')) {
    return 'shadbala_aggregate_vs_subcomponents';
  }
  if (codes.some((c) => c.includes('ASHTAKAVARGA'))) {
    return 'ashtakavarga_prastara_vs_bav';
  }
  if (codes.some((c) => c === 'VIMSHOPAKA_BALA_SCHEME')) {
    return 'vimshopaka_multi_scheme';
  }
  return 'other_partial_overlap';
}

function pickPrimaryFromPartialGroup(
  items: CanonicalEvidenceObject[],
  preferredVimshopakaId: string | null
): CanonicalEvidenceObject {
  const priority = (item: CanonicalEvidenceObject): number => {
    if (item.observation.code === 'SHADBALA_MAJOR_SIX_BALA') return 100;
    if (item.observation.code === 'ASHTAKAVARGA_BHINNA_BAV') return 95;
    if (preferredVimshopakaId && item.evidenceId === preferredVimshopakaId) return 90;
    if (item.observation.code === 'ISHTA_KASHTA_PHALA') return 60;
    if (item.observation.code === 'ASHTAKAVARGA_PRASTARA') return 40;
    if (item.observation.code === 'ASHTAKAVARGA_SHODHANA_PINDA') return 30;
    if (item.observation.code === 'SHADBALA_SUBCOMPONENT_BUCKET') return 20;
    return 10;
  };
  return [...items].sort((a, b) => priority(b) - priority(a))[0];
}

export interface BuildPhiAndSpecialProfilesResult {
  phiReadyProjections: PhiReadyPlanetProjection[];
  phiReadyProjection: AnalyticalKernelK02StateResult['phiReadyProjection'];
  nodalConditionProfiles: {
    Rahu: NodalConditionProfile;
    Ketu: NodalConditionProfile;
  };
  ascendantConditionProfile: AscendantConditionProfile;
  profileRuleExecutions: RuleExecutionRecord[];
}

export function buildPhiAndSpecialProfiles(
  repo: AnalyticalEvidenceRepository,
  subjectStates: Record<PlanetaryStateSubjectName, K02SubjectStateRecord>,
  _impactContracts: EvidenceImpactObject[],
  overlapMetadataByEvidenceId: Record<string, EvidenceImpactOverlapMetadata> = {}
): BuildPhiAndSpecialProfilesResult {
  const natalById = new Map(repo.natalEvidence.map((e) => [e.evidenceId, e]));
  const profileRuleExecutions: RuleExecutionRecord[] = [];
  const temporalExcludedCount = repo.temporalEvidence.length;

  const classicalPlanets = {} as Record<PhiReadyPlanetName, PhiReadyPlanetProjection>;
  const phiReadyProjections: PhiReadyPlanetProjection[] = [];

  // Shared lookup for D1 sign co-occupant conjunctions
  const d1OccupantsBySign = new Map<string, string[]>();
  for (const item of repo.natalEvidence) {
    if (item.observation.code === 'VEDIC_D1_SIGN_HOUSE_PLACEMENT') {
      const sign = strVal(item, 'sign');
      if (sign && item.subject.type === 'planet') {
        const list = d1OccupantsBySign.get(sign) ?? [];
        if (!list.includes(item.subject.id)) list.push(item.subject.id);
        d1OccupantsBySign.set(sign, list);
      }
    }
  }

  // ===========================================================================
  // 1. 7 Classical Planets -> PhiReadyPlanetProjection
  // ===========================================================================
  const phiRule = assertRegisteredRule('K02_PHI_INTRINSIC_HEALTH_PROJECTION');
  let totalHouseFootprintExcluded = 0;

  for (const planet of PHI_READY_PLANETS) {
    const state = subjectStates[planet];
    const directItems = repo.natalEvidence.filter(
      (e) =>
        e.subject.type === 'planet' &&
        e.subject.id === planet &&
        e.temporalScope === 'natal_invariant'
    );
    const directIds = new Set(directItems.map((e) => e.evidenceId));

    // Identify P08 house-ownership / broad signification footprint items explicitly excluded from PHI
    const excludedHouseFootprintIds = repo.natalEvidence
      .filter(
        (e) =>
          (e.observation.code === 'VEDIC_D1_HOUSE_LORD_PLACEMENT' &&
            e.relatedEntities.some((r) => r.id === planet && r.role === 'house_lord')) ||
          (e.subject.id === planet &&
            (e.observation.code === 'KP_FOUR_LEVEL_SIGNIFICATORS' ||
              e.observation.code === 'JAIMINI_CHARA_KARAKA'))
      )
      .map((e) => e.evidenceId);
    totalHouseFootprintExcluded += excludedHouseFootprintIds.length;

    // Collect intrinsic dimension evidence IDs ONLY (P01, P02, P03, P04, P06, P07 preconditions)
    const intrinsicRawIds = Array.from(
      new Set([
        ...state.dimensions.capacity.supportedEvidenceIds,
        ...state.dimensions.integrity.supportedEvidenceIds,
        ...state.dimensions.stability.supportedEvidenceIds,
        ...state.dimensions.autonomy.supportedEvidenceIds,
        ...state.dimensions.vulnerability.supportedEvidenceIds,
        ...state.dimensions.resilience.supportedEvidenceIds,
      ])
    ).filter((id) => {
      const ev = natalById.get(id);
      if (!ev) return false;
      // Strict guard: never allow reference_date_dependent or P08 house-lordship items inside PHI
      if (ev.temporalScope !== 'natal_invariant') return false;
      if (excludedHouseFootprintIds.includes(id)) return false;
      return true;
    });

    // Deduplicate exact_duplicate pairs via lineageGraph.overlapRelations
    const collapsedDuplicateIds: string[] = [];
    const collapsedSet = new Set<string>();
    const preservedDistinctSet = new Set<string>();
    const partialPairsByGroup = new Map<string, Set<string>>();

    for (const rel of repo.lineageGraph.overlapRelations) {
      const touchesPlanet =
        intrinsicRawIds.includes(rel.evidenceIdA) ||
        intrinsicRawIds.includes(rel.evidenceIdB) ||
        directIds.has(rel.evidenceIdA) ||
        directIds.has(rel.evidenceIdB);
      if (!touchesPlanet) continue;

      if (rel.overlapType === 'exact_duplicate' && rel.collapseRecommended) {
        const dropId =
          rel.evidenceIdA < rel.evidenceIdB ? rel.evidenceIdB : rel.evidenceIdA;
        if (!collapsedSet.has(dropId)) {
          collapsedSet.add(dropId);
          collapsedDuplicateIds.push(dropId);
        }
      } else if (rel.overlapType === 'distinct_analytical_significance') {
        if (directIds.has(rel.evidenceIdA) || intrinsicRawIds.includes(rel.evidenceIdA)) {
          preservedDistinctSet.add(rel.evidenceIdA);
        }
        if (directIds.has(rel.evidenceIdB) || intrinsicRawIds.includes(rel.evidenceIdB)) {
          preservedDistinctSet.add(rel.evidenceIdB);
        }
      } else if (rel.overlapType === 'partial_mathematical_overlap') {
        const gid =
          overlapMetadataByEvidenceId[rel.evidenceIdA]?.overlapGroupId ??
          overlapMetadataByEvidenceId[rel.evidenceIdB]?.overlapGroupId ??
          rel.relationId;
        const set = partialPairsByGroup.get(gid) ?? new Set<string>();
        set.add(rel.evidenceIdA);
        set.add(rel.evidenceIdB);
        partialPairsByGroup.set(gid, set);
      }
    }

    const vimSig = state.dimensions.capacity.signals.find((s) =>
      s.signalKey.startsWith('vimshopaka_')
    );
    const preferredVimId = vimSig?.sourceEvidenceIds[0] ?? null;

    const partialOverlapGroups: PhiPartialOverlapGroupSummary[] = [];
    const secondaryOverlapDropSet = new Set<string>();
    const excludedOverlapGroupIds: string[] = [];

    for (const [gid, idSet] of partialPairsByGroup.entries()) {
      const groupItems = Array.from(idSet)
        .map((id) => natalById.get(id))
        .filter((x): x is CanonicalEvidenceObject => Boolean(x))
        .filter(
          (x) =>
            x.subject.id === planet &&
            ['SHADBALA_MAJOR_SIX_BALA', 'SHADBALA_SUBCOMPONENT_BUCKET', 'ISHTA_KASHTA_PHALA', 'ASHTAKAVARGA_BHINNA_BAV', 'ASHTAKAVARGA_PRASTARA', 'ASHTAKAVARGA_SHODHANA_PINDA', 'VIMSHOPAKA_BALA_SCHEME'].includes(
              x.observation.code
            )
        );
      if (groupItems.length < 2) continue;
      const primary = pickPrimaryFromPartialGroup(groupItems, preferredVimId);
      const secondaries = groupItems
        .filter((g) => g.evidenceId !== primary.evidenceId)
        .map((g) => g.evidenceId);
      const category = classifyOverlapCategory(groupItems.map((g) => g.observation.code));

      for (const secId of secondaries) {
        secondaryOverlapDropSet.add(secId);
      }
      excludedOverlapGroupIds.push(gid);
      partialOverlapGroups.push({
        overlapGroupId: gid,
        category,
        primaryEvidenceId: primary.evidenceId,
        secondaryEvidenceIds: secondaries,
        rationale: `Selected ${primary.observation.code} as primary intrinsic metric; excluded ${secondaries.length} mathematically overlapping sibling(s) from double-counting.`,
      });
    }

    const deduplicatedEvidenceIds = intrinsicRawIds.filter(
      (id) => !collapsedSet.has(id) && !secondaryOverlapDropSet.has(id)
    );

    // Extract structured P01-P04/P06 fields
    const sbItem = directItems.find((e) => e.observation.code === 'SHADBALA_MAJOR_SIX_BALA');
    const sbSig = state.dimensions.capacity.signals.find(
      (s) => s.signalKey === 'shadbala_bphs_rupa_ratio'
    );

    const bavItem = directItems.find((e) => e.observation.code === 'ASHTAKAVARGA_BHINNA_BAV');
    const bavSig = state.dimensions.capacity.signals.find(
      (s) => s.signalKey === 'bav_natal_sign_bindu_deviation'
    );

    const vimItem = preferredVimId ? natalById.get(preferredVimId) : undefined;

    const ikItem = directItems.find((e) => e.observation.code === 'ISHTA_KASHTA_PHALA');
    const ikSig = state.dimensions.capacity.signals.find(
      (s) => s.signalKey === 'ishta_kashta_balance'
    );

    const vedicPos = directItems.find((e) => e.observation.code === 'VEDIC_D1_SIGN_HOUSE_PLACEMENT');
    const vedicDeg = directItems.find((e) => e.observation.code === 'VEDIC_D1_PLANET_LONGITUDE');
    const d1Dig = directItems.find((e) => e.observation.code === 'VEDIC_D1_DIGNITY');
    const westDig = directItems.find((e) => e.observation.code === 'WESTERN_ESSENTIAL_DIGNITY');
    const d9Item = directItems.find(
      (e) => e.observation.code === 'VEDIC_VARGA_PLACEMENT' && strVal(e, 'division') === 'D9'
    );
    const vargMod = directItems.find((e) => e.observation.code === 'MODIFIER_VARGOTTAMA');
    const condItem = directItems.find((e) => e.observation.code === 'VEDIC_PLANET_OPERATING_CONDITIONS');
    const combMod = directItems.find((e) => e.observation.code === 'MODIFIER_COMBUSTION_ASTA');
    const gandMod = directItems.find((e) => e.observation.code === 'MODIFIER_GANDANTA_JUNCTION');
    const teleItem = directItems.find((e) => e.observation.code === 'ASTRONOMICAL_BODY_TELEMETRY');
    const dispItem = directItems.find((e) => e.observation.code === 'VEDIC_D1_DISPOSITOR_DEPENDENCY');
    const chalitItem = directItems.find((e) => e.observation.code === 'BHAVA_CHALIT_HOUSE_PLACEMENT');
    const kpPos = directItems.find((e) => e.observation.code === 'KP_PLACIDUS_HOUSE_PLACEMENT');
    const kpSub = directItems.find((e) => e.observation.code === 'KP_PLANET_SUB_LORDS');
    const westPos = directItems.find((e) => e.observation.code === 'WESTERN_TROPICAL_PLACEMENT');
    const parivartanaCount = repo.natalEvidence.filter(
      (e) =>
        e.observation.code === 'PARIVARTANA_MUTUAL_EXCHANGE' &&
        (e.subject.id === planet || e.relatedEntities.some((r) => r.id === planet))
    ).length;

    const motionSig = state.dimensions.stability.signals.find(
      (s) => s.signalKey === 'kinematic_motion_state'
    );

    const d1House = numVal(vedicPos, 'house');
    const chalitHouse = numVal(chalitItem, 'chalit_house');
    const kpHouse = numVal(kpPos, 'kp_house');
    const frameDivergenceFlags: string[] = [];
    if (d1House !== null && chalitHouse !== null && d1House !== chalitHouse) {
      frameDivergenceFlags.push(`D1_H${d1House}_vs_Chalit_H${chalitHouse}`);
    }
    if (d1House !== null && kpHouse !== null && d1House !== kpHouse) {
      frameDivergenceFlags.push(`D1_H${d1House}_vs_KP_H${kpHouse}`);
    }

    const projection: PhiReadyPlanetProjection = {
      schemaVersion: K02_PROJECTION_SCHEMA_VERSION,
      planet,
      eligibility: 'phi_eligible_classical_planet',
      shadbalaRupaRatio: {
        available: Boolean(sbSig),
        totalRupas: numVal(sbItem, 'total_rupas'),
        bphsMinRupas: BPHS_SHADBALA_MIN_RUPAS[planet],
        ratio: sbSig?.normalizedValue ?? null,
        trust: sbSig?.trust ?? null,
        sourceEvidenceId: sbItem?.evidenceId ?? null,
      },
      ashtakavargaBav: {
        available: Boolean(bavSig),
        bindus: typeof bavSig?.rawValue === 'number' ? bavSig.rawValue : null,
        neutralMidpoint: 4,
        boundedDeviation: bavSig?.normalizedValue ?? null,
        trust: bavSig?.trust ?? null,
        sourceEvidenceId: bavItem?.evidenceId ?? null,
      },
      vimshopaka: {
        available: Boolean(vimSig),
        shodashvargaScore: numVal(vimItem, 'score_out_of_20'),
        normalizedRatio: vimSig?.normalizedValue ?? null,
        tier: strVal(vimItem, 'strength_tier'),
        trust: vimSig?.trust ?? null,
        sourceEvidenceId: vimItem?.evidenceId ?? null,
      },
      ishtaKashta: {
        available: Boolean(ikSig),
        ishtaPhala: numVal(ikItem, 'ishta_phala'),
        kashtaPhala: numVal(ikItem, 'kashta_phala'),
        dominantSide:
          ikSig?.qualitativeClass === 'ishta_dominant' ||
          ikSig?.qualitativeClass === 'kashta_dominant' ||
          ikSig?.qualitativeClass === 'balanced'
            ? ikSig.qualitativeClass
            : null,
        trust: ikSig?.trust ?? null,
        sourceEvidenceId: ikItem?.evidenceId ?? null,
      },
      d1Integrity: {
        dignityClass: strVal(d1Dig, 'dignity'),
        sign: strVal(vedicPos, 'sign'),
        house: d1House,
        westernEssentialDignity: strVal(westDig, 'dignity_status'),
        sourceEvidenceIds: [
          ...(d1Dig ? [d1Dig.evidenceId] : []),
          ...(westDig ? [westDig.evidenceId] : []),
        ],
      },
      d9Reinforcement: {
        d9Sign: strVal(d9Item, 'sign'),
        d9Dignity: strVal(d9Item, 'dignity'),
        isVargottama:
          Boolean(vargMod) || boolVal(condItem, 'is_vargottama') === true ? true : d9Item ? false : null,
        divergenceFlag: state.overlays.conflict.conflicts.some(
          (c) => c.conflictType === 'd1_d9_dignity_divergence'
        ),
        sourceEvidenceIds: [
          ...(d9Item ? [d9Item.evidenceId] : []),
          ...(vargMod ? [vargMod.evidenceId] : []),
        ],
      },
      motionAndConditions: {
        motionState: motionSig?.qualitativeClass ?? strVal(teleItem, 'motion_state'),
        isRetrograde: boolVal(condItem, 'is_retrograde'),
        isCombust: combMod ? true : boolVal(condItem, 'is_combust'),
        sunSeparationDeg: numVal(combMod ?? condItem, 'sun_separation_deg'),
        inGrahaYuddha: boolVal(condItem, 'in_graha_yuddha'),
        grahaYuddhaRole: strVal(condItem, 'graha_yuddha_role'),
        isGandanta: gandMod ? true : boolVal(condItem, 'is_gandanta'),
        sandhiRisk: Boolean(vedicDeg?.sensitivity.sandhiOrBoundaryRisk),
        sourceEvidenceIds: [
          ...(condItem ? [condItem.evidenceId] : []),
          ...(combMod ? [combMod.evidenceId] : []),
          ...(gandMod ? [gandMod.evidenceId] : []),
          ...(teleItem ? [teleItem.evidenceId] : []),
        ],
      },
      autonomySummary: {
        signLord: strVal(dispItem, 'sign_lord'),
        finalDispositor: strVal(dispItem, 'final_dispositor'),
        isSelfDisposited: boolVal(dispItem, 'is_self_disposited'),
        terminationType: strVal(dispItem, 'termination_type'),
        inParivartana: parivartanaCount > 0,
        sourceEvidenceIds: dispItem ? [dispItem.evidenceId] : [],
      },
      crossFramePresence: {
        vedicD1Sign: strVal(vedicPos, 'sign'),
        bhavaChalitHouse: chalitHouse,
        kpHouse,
        kpStarLord: strVal(kpSub, 'star_lord'),
        kpSubLord: strVal(kpSub, 'sub_lord'),
        westernSign: strVal(westPos, 'sign'),
        frameDivergenceFlags,
      },
      deduplicatedEvidenceIds,
      collapsedDuplicateIds,
      partialOverlapGroups,
      preservedDistinctLensIds: Array.from(preservedDistinctSet),
      excludedOverlapGroupIds,
      reliabilityCeiling: state.overlays.reliability.overallTrust,
      conflictFlags: state.overlays.conflict.conflicts.map((c) => c.conflictType),
      pendingK05K07Modifiers: state.overlays.modification.modifiers.map((m) => m.modifierType),
      overlays: state.overlays,
      excludedBoundaries: buildExcludedBoundaries(
        temporalExcludedCount,
        excludedHouseFootprintIds.length
      ),
    };

    const mathEval = evaluateRuleMathModel(
      phiRule.mathModel.modelId,
      deduplicatedEvidenceIds.length,
      { planet }
    );
    profileRuleExecutions.push({
      executionId: `rex_${sha256Hex(`${phiRule.ruleId}:${planet}`).slice(0, 20)}`,
      ruleId: phiRule.ruleId,
      ruleVersion: phiRule.version,
      subject: planet,
      targetDimension: 'phi_projection',
      status: 'applied',
      outcome: 'applied',
      sourceEvidenceIds: deduplicatedEvidenceIds,
      emittedImpactIds: [],
      missingInputs: [],
      provisionalDependencies: state.overlays.reliability.provisionalEvidenceIds,
      mathModelId: phiRule.mathModel.modelId,
      mathOutputSummary: mathEval.formulaTrace,
      numericalResult: deduplicatedEvidenceIds.length,
      reason: `Built overlap-deduplicated PHI-ready projection for ${planet} (${deduplicatedEvidenceIds.length} intrinsic items; ${partialOverlapGroups.length} overlap groups deduplicated).`,
    });

    classicalPlanets[planet] = projection;
    phiReadyProjections.push(projection);
  }

  // ===========================================================================
  // 2. Separate Nodal Condition Profiles (Rahu, Ketu)
  // ===========================================================================
  const nodalRule = assertRegisteredRule('K02_NODAL_CONDITION_PROFILE');
  const buildNodalProfile = (node: 'Rahu' | 'Ketu'): NodalConditionProfile => {
    const state = subjectStates[node];
    const directItems = repo.natalEvidence.filter(
      (e) =>
        e.subject.type === 'planet' &&
        e.subject.id === node &&
        e.temporalScope === 'natal_invariant'
    );
    const vedicDeg = directItems.find((e) => e.observation.code === 'VEDIC_D1_PLANET_LONGITUDE');
    const vedicPos = directItems.find((e) => e.observation.code === 'VEDIC_D1_SIGN_HOUSE_PLACEMENT');
    const nakItem = directItems.find((e) => e.observation.code === 'VEDIC_NAKSHATRA_PADA');
    const digItem = directItems.find((e) => e.observation.code === 'VEDIC_D1_DIGNITY');
    const chalitItem = directItems.find((e) => e.observation.code === 'BHAVA_CHALIT_HOUSE_PLACEMENT');
    const kpPos = directItems.find((e) => e.observation.code === 'KP_PLACIDUS_HOUSE_PLACEMENT');
    const kpSub = directItems.find((e) => e.observation.code === 'KP_PLANET_SUB_LORDS');
    const westPos = directItems.find((e) => e.observation.code === 'WESTERN_TROPICAL_PLACEMENT');
    const westDeg = directItems.find(
      (e) => e.observation.code === 'WESTERN_TROPICAL_PLANET_LONGITUDE'
    );
    const d9Item = directItems.find(
      (e) => e.observation.code === 'VEDIC_VARGA_PLACEMENT' && strVal(e, 'division') === 'D9'
    );
    const vargMod = directItems.find((e) => e.observation.code === 'MODIFIER_VARGOTTAMA');
    const condItem = directItems.find((e) => e.observation.code === 'VEDIC_PLANET_OPERATING_CONDITIONS');
    const dispItem = directItems.find((e) => e.observation.code === 'VEDIC_D1_DISPOSITOR_DEPENDENCY');

    const d1Sign = strVal(vedicPos, 'sign');
    const witnesses: NodalConditionProfile['conjunctionAndAspectWitnesses'] = [];
    if (d1Sign) {
      for (const coOccupant of d1OccupantsBySign.get(d1Sign) ?? []) {
        if (coOccupant !== node) {
          witnesses.push({
            partner: coOccupant,
            relation: 'd1_sign_conjunction_co_occupant',
            frame: 'vedic_lahiri',
            evidenceId: vedicPos!.evidenceId,
          });
        }
      }
    }
    for (const asp of repo.natalEvidence) {
      if (
        asp.observation.code === 'SIDEREAL_PLANETARY_ASPECT' ||
        asp.observation.code === 'WESTERN_GEOMETRIC_ASPECT'
      ) {
        const isSubj = asp.subject.id === node;
        const isRel = asp.relatedEntities.some((r) => r.id === node);
        if (isSubj || isRel) {
          const partner = isSubj
            ? asp.relatedEntities[0]?.id ?? 'Unknown'
            : asp.subject.id;
          witnesses.push({
            partner,
            relation:
              strVal(asp, 'aspect_type') ??
              strVal(asp, 'aspect_name') ??
              asp.observation.code,
            frame: asp.frame,
            evidenceId: asp.evidenceId,
          });
        }
      }
    }

    const sourceIds = Array.from(new Set(directItems.map((e) => e.evidenceId)));
    const completenessCount = [vedicPos, nakItem, dispItem, d9Item, kpSub, chalitItem].filter(
      Boolean
    ).length;
    const mathEval = evaluateRuleMathModel(nodalRule.mathModel.modelId, completenessCount, {
      planet: node,
    });
    profileRuleExecutions.push({
      executionId: `rex_${sha256Hex(`${nodalRule.ruleId}:${node}`).slice(0, 20)}`,
      ruleId: nodalRule.ruleId,
      ruleVersion: nodalRule.version,
      subject: node,
      targetDimension: 'nodal_condition_profile',
      status: 'applied',
      outcome: 'applied',
      sourceEvidenceIds: sourceIds,
      emittedImpactIds: [],
      missingInputs: [],
      provisionalDependencies: state.overlays.reliability.provisionalEvidenceIds,
      mathModelId: nodalRule.mathModel.modelId,
      mathOutputSummary: mathEval.formulaTrace,
      numericalResult: completenessCount,
      reason: `Built separate NodalConditionProfile for ${node} (Shadbala & BAV excluded).`,
    });

    return {
      schemaVersion: K02_PROJECTION_SCHEMA_VERSION,
      node,
      subjectCategory: 'lunar_node_shadow_graha',
      shadbalaStatus: 'not_applicable_lunar_node',
      shadbalaExcludedReason:
        'Rahu and Ketu are shadow nodes (Chhaya Grahas) without physical luminosity or classical BPHS Shadbala.',
      ashtakavargaExcludedReason:
        'Standard Parashari Bhinnashtakavarga applies strictly to Sun..Saturn; excluded for Rahu/Ketu.',
      nodeCalculationConvention: vedicDeg?.methodology.nodeConvention ?? 'mean',
      vedicPlacement: {
        sign: d1Sign,
        house: numVal(vedicPos, 'house'),
        degreeInSign: numVal(vedicDeg, 'degree_in_sign'),
        nakshatra: strVal(nakItem, 'nakshatra'),
        pada: numVal(nakItem, 'pada'),
        nakshatraLord: strVal(nakItem, 'nakshatra_lord'),
        dignityLabel: strVal(digItem, 'dignity'),
      },
      chalitAndKp: {
        bhavaChalitHouse: numVal(chalitItem, 'chalit_house'),
        kpHouse: numVal(kpPos, 'kp_house'),
        kpStarLord: strVal(kpSub, 'star_lord'),
        kpSubLord: strVal(kpSub, 'sub_lord'),
      },
      westernTropical: {
        sign: strVal(westPos, 'sign'),
        house: numVal(westPos, 'house'),
        degreeInSign: numVal(westDeg, 'degree_in_sign'),
      },
      d9AndVargottama: {
        d9Sign: strVal(d9Item, 'sign'),
        isVargottama:
          Boolean(vargMod) || boolVal(condItem, 'is_vargottama') === true
            ? true
            : d9Item
            ? false
            : null,
      },
      dispositorDependency: {
        d1SignLord: strVal(dispItem, 'sign_lord'),
        finalDispositor: strVal(dispItem, 'final_dispositor'),
        terminationType: strVal(dispItem, 'termination_type'),
        chainPath: strVal(dispItem, 'chain_path'),
      },
      conjunctionAndAspectWitnesses: witnesses,
      operatingConditions: {
        isRetrogradeMean: boolVal(condItem, 'is_retrograde'),
        isGandanta: boolVal(condItem, 'is_gandanta') === true,
        sandhiRisk: Boolean(vedicDeg?.sensitivity.sandhiOrBoundaryRisk),
      },
      reliabilityCeiling: state.overlays.reliability.overallTrust,
      conflictFlags: state.overlays.conflict.conflicts.map((c) => c.conflictType),
      overlays: state.overlays,
      sourceEvidenceIds: sourceIds,
      deferredToK03ToK08: [
        'K05: Nodal agentic substitution via sign dispositor & conjunction witnesses',
        'K06: Rahu/Ketu Mahadasha & Antardasha delivery',
      ],
    };
  };

  const nodalConditionProfiles = {
    Rahu: buildNodalProfile('Rahu'),
    Ketu: buildNodalProfile('Ketu'),
  };

  // ===========================================================================
  // 3. Separate Ascendant Condition Profile (Ascendant)
  // ===========================================================================
  const ascRule = assertRegisteredRule('K02_ASCENDANT_CONDITION_PROFILE');
  const ascState = subjectStates.Ascendant;
  const ascItems = repo.natalEvidence.filter(
    (e) => e.subject.type === 'ascendant' && e.subject.id === 'Ascendant'
  );
  const ascVedicDeg = ascItems.find((e) => e.observation.code === 'VEDIC_D1_ASCENDANT_LONGITUDE');
  const ascVedicPos = ascItems.find((e) => e.observation.code === 'VEDIC_D1_ASCENDANT_SIGN');
  const ascNak = ascItems.find((e) => e.observation.code === 'VEDIC_NAKSHATRA_PADA');
  const ascD9 = ascItems.find(
    (e) => e.observation.code === 'VEDIC_VARGA_PLACEMENT' && strVal(e, 'division') === 'D9'
  );
  const kpCusp1Deg = repo.natalEvidence.find(
    (e) => e.observation.code === 'KP_PLACIDUS_CUSP_LONGITUDE' && e.subject.id === 'KP_Cusp_1'
  );
  const kpCusp1Sub = repo.natalEvidence.find(
    (e) => e.observation.code === 'KP_CUSPAL_SUB_LORDS' && e.subject.id === 'KP_Cusp_1'
  );
  const westAsc = repo.natalEvidence.find(
    (e) =>
      e.observation.code === 'WESTERN_TROPICAL_ANGLE_LONGITUDE' &&
      e.subject.id === 'West_Ascendant'
  );

  const ascSign = strVal(ascVedicPos, 'sign') ?? strVal(ascVedicDeg, 'sign');
  const ascSignLord = ascSign ? VEDIC_SIGN_LORDS[ascSign] ?? null : null;
  const ascD9Sign = strVal(ascD9, 'sign');
  const lagnaLordDisp = ascSignLord
    ? repo.natalEvidence.find(
        (e) =>
          e.observation.code === 'VEDIC_D1_DISPOSITOR_DEPENDENCY' &&
          e.subject.id === ascSignLord
      )
    : undefined;

  const ascSourceIds = Array.from(
    new Set([
      ...ascItems.map((e) => e.evidenceId),
      ...(kpCusp1Deg ? [kpCusp1Deg.evidenceId] : []),
      ...(kpCusp1Sub ? [kpCusp1Sub.evidenceId] : []),
      ...(westAsc ? [westAsc.evidenceId] : []),
      ...(lagnaLordDisp ? [lagnaLordDisp.evidenceId] : []),
    ])
  );

  const ascCompleteness = [ascVedicPos, ascNak, ascD9, kpCusp1Sub].filter(Boolean).length;
  const ascEval = evaluateRuleMathModel(ascRule.mathModel.modelId, ascCompleteness, {
    planet: 'Ascendant',
  });
  profileRuleExecutions.push({
    executionId: `rex_${sha256Hex(`${ascRule.ruleId}:Ascendant`).slice(0, 20)}`,
    ruleId: ascRule.ruleId,
    ruleVersion: ascRule.version,
    subject: 'Ascendant',
    targetDimension: 'ascendant_condition_profile',
    status: 'applied',
    outcome: 'applied',
    sourceEvidenceIds: ascSourceIds,
    emittedImpactIds: [],
    missingInputs: [],
    provisionalDependencies: ascState.overlays.reliability.provisionalEvidenceIds,
    mathModelId: ascRule.mathModel.modelId,
    mathOutputSummary: ascEval.formulaTrace,
    numericalResult: ascCompleteness,
    reason: 'Built separate AscendantConditionProfile (non-planetary Lagna anchor).',
  });

  const ascendantConditionProfile: AscendantConditionProfile = {
    schemaVersion: K02_PROJECTION_SCHEMA_VERSION,
    subject: 'Ascendant',
    subjectCategory: 'reference_point_lagna',
    shadbalaStatus: 'not_applicable_ascendant',
    nonPlanetaryPointNote:
      'Ascendant (Lagna) is the eastern horizon ecliptic reference point, not a planet; planetary Shadbala, BAV, combustion, and retrogression are excluded.',
    vedicD1: {
      sign: ascSign,
      signLord: ascSignLord,
      degreeInSign: numVal(ascVedicDeg, 'degree_in_sign'),
      fullLongitudeDeg: numVal(ascVedicDeg, 'longitude_deg'),
      nakshatra: strVal(ascNak, 'nakshatra'),
      pada: numVal(ascNak, 'pada'),
      nakshatraLord: strVal(ascNak, 'nakshatra_lord'),
    },
    d9Navamsa: {
      d9Sign: ascD9Sign,
      isVargottama:
        ascSign && ascD9Sign
          ? ascSign.toLowerCase() === ascD9Sign.toLowerCase()
          : null,
    },
    kpCusp1: {
      sign: strVal(kpCusp1Deg, 'sign'),
      starLord: strVal(kpCusp1Sub, 'star_lord'),
      subLord: strVal(kpCusp1Sub, 'sub_lord'),
      degreeInSign: numVal(kpCusp1Deg, 'degree_in_sign'),
    },
    westernAscendant: {
      sign: strVal(westAsc, 'sign'),
      degreeInSign: numVal(westAsc, 'degree_in_sign'),
    },
    lagnaLordReference: {
      signLord: ascSignLord,
      finalDispositor: strVal(lagnaLordDisp, 'final_dispositor'),
      terminationType: strVal(lagnaLordDisp, 'termination_type'),
      chainPath: strVal(lagnaLordDisp, 'chain_path'),
      sourceEvidenceIds: lagnaLordDisp ? [lagnaLordDisp.evidenceId] : [],
    },
    sandhiAndTimeSensitivity: {
      birthTimeSensitive: ascState.overlays.reliability.birthTimeSensitive,
      sandhiOrBoundaryRisk: ascState.overlays.reliability.sandhiOrBoundaryRisk,
      reasons: ascState.overlays.reliability.sensitivityReasons,
    },
    reliabilityCeiling: ascState.overlays.reliability.overallTrust,
    reliabilityOverlay: ascState.overlays.reliability,
    sourceEvidenceIds: ascSourceIds,
    deferredLagnaAuthorityNote:
      'Lagna structural pillar strength, Lagnesha house placement authority, and functional benefic/malefic classification are deferred to K03.',
  };

  return {
    phiReadyProjections,
    phiReadyProjection: {
      classicalPlanets,
      excludedSubjects: ['Rahu', 'Ketu', 'Ascendant'],
      boundaryGuarantees: buildExcludedBoundaries(
        temporalExcludedCount,
        totalHouseFootprintExcluded
      ),
    },
    nodalConditionProfiles,
    ascendantConditionProfile,
    profileRuleExecutions,
  };
}
