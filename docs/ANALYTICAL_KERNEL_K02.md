# CosmicCouncil Layer C — Analytical Intelligence Kernel K02 Specification (`k02.1.0`)

> **Scope Boundary:** This document specifies the consumer interface, governance invariants, and handoff contracts for **K02 (Planetary State Intelligence & Analytical Rule Registry Foundation)** (`server/services/analyticalKernel/`), building directly atop **K01** (`AnalyticalEvidenceRepository`).
>
> K02 is 100% pure TypeScript using Web-standard APIs only (Cloudflare Workers safe, zero Node built-ins, zero live API calls, zero LLM calls, zero DB writes). It evaluates deterministic `P01`–`P10` planetary state records, emits overlap-aware `EvidenceImpactObject[]` contracts, surfaces explicit Conflict / Modification / Reliability overlays, and projects clean inputs for downstream **`PHI`**, **`K03`–`K10`** without inventing scalar `PHI`/`YSI`/`DSI` weights or collapsing frame contradictions.

---

## 1. Entry Points, Versions & Layering Contract

- **Barrel Export:** `server/services/analyticalKernel/index.ts`
- **Core K02 Entry Points (`repositoryBuilder.ts`, `planetaryStateEngine.ts`, `phiPreparation.ts`, `ruleRegistry.ts`):**
  - `evaluateK02FromRepository(repo: AnalyticalEvidenceRepository, options?: EvaluateK02PlanetaryStatesOptions): AnalyticalKernelK02StateResult`
  - `buildAnalyticalKernelK02Bundle(source, options?): AnalyticalKernelK02Bundle` (`{ k01Repository, k02State }`)
  - `evaluateK02PlanetaryStates(repo, options?): EvaluateK02PlanetaryStatesOutput`
  - `buildPhiAndSpecialProfiles(repo, subjectStates, impactContracts, overlapMetadataByEvidenceId)`
  - `formatPlanetK02StateSummary(k02Result, planetName): string`
  - `assertRegisteredRule(ruleId, expectedVersion?)`, `evaluateRuleMathModel(modelId, rawValue, context?)`, `exportRuleRegistrySnapshot()`
- **Schema & Engine Versions:**
  - `K02_STATE_ENGINE_VERSION = 'k02.1.0'`
  - `ANALYTICAL_RULE_REGISTRY_VERSION = 'k02.rules.1.0'`
  - `K02_PROJECTION_SCHEMA_VERSION = 'k02.phi_projection.1.0'`
- **K01 Backwards Compatibility:** `buildAnalyticalEvidenceRepository` continues to return K01 `planetaryStates` (`observed_direct_only` / `unevaluated`) and `impactContracts: []`. K02 attaches its evaluations in `AnalyticalKernelK02StateResult` without mutating K01 `CanonicalEvidenceObject`s.

| Output Artifact | Role | Downstream Consumers |
| :--- | :--- | :--- |
| `AnalyticalKernelK02StateResult` | Top-level K02 state bundle containing `ruleRegistrySnapshot`, `subjectStates` (all 10 subjects), `impactContracts` (`EvidenceImpactObject[]`), `ruleExecutionSummary`, `phiReadyProjections` (7 classical planets), `nodalConditionProfiles` (`Rahu`, `Ketu`), and `ascendantConditionProfile` (`Ascendant`). | `K03`–`K10`, `PHI` Engine, Admin V2 Laboratory diagnostics. |
| `K02SubjectStateRecord` | Per-subject `P01`–`P10` dimension evaluations (`signals[]`, `supportedEvidenceIds`, `impactIds`, `directObservations[]`, `deferredCapability`), three overlays (`conflict`, `modification`, `reliability`), `ruleExecutions[]`, and `emittedImpactIds[]`. | `K03` (Authority), `K05`/`K07` (Interaction & Conflict), `K08` (Deliverability), `K09` (Temporal), `PHI`. |
| `EvidenceImpactObject[]` | Rule-driven, overlap-tagged impact contracts linked via `overlapMetadata` (`overlapGroupId`, `independenceStatus`) and `residualImpact: { status: 'unevaluated_pending_k05_k07' }`. | `K05`, `K07`, `K10`, `PHI` (post-resolution). |

---

## 2. Versioned `AnalyticalRuleRegistry` & Execution Governance

Every state evaluation, mathematical model invocation, and `EvidenceImpactObject` emission in K02 must pass through `ruleRegistry.ts`:

- **Hard Registration Guard (`UnregisteredRuleError` / `UnregisteredMathModelError`):** Calling `assertRegisteredRule(ruleId, expectedVersion?)` or `evaluateRuleMathModel(modelId, ...)` with an unknown ID or mismatched version throws immediately. Silent/ad-hoc heuristics are rejected.
- **Immutable Metadata (`K02_ANALYTICAL_RULES`, `19` rules in `k02.rules.1.0`):** Each `AnalyticalRuleDefinition` locks `ruleId`, `version`, `tradition`, `targetDimension`, `targetScope`, `applicableSubjects`, `requiredFrames`, `requiredObservationCodes`, `citation`, `applicabilityBoundaries`, `provisionalPolicy`, `overlapHandlingPolicy`, `excludedK03ToK08Concerns`, and an explicit `AnalyticalMathModelSpec`.
- **Six Explicit `RuleExecutionOutcomeStatus` Values (`RuleExecutionRecord`):**
  1. `'applied'` — All required inputs present, frame compatible, primary evidence `'usable'`.
  2. `'partially_applied'` — Executed deterministically using `'provisional'` evidence (`strictNonProvisional: false`); downstream trust remains capped.
  3. `'not_applicable'` — Subject is outside classical boundaries (e.g., Shadbala/BAV on `Rahu`/`Ketu`/`Ascendant`, Asta Combustion on `Sun`/`Rahu`/`Ketu`/`Ascendant`, Graha Yuddha on `Sun`/`Moon`/`Rahu`/`Ketu`/`Ascendant`). Never fabricated.
  4. `'blocked_missing_inputs'` — Required K01 observation or metric is null/unavailable (`zero-coercion` guard prevents mapping missing values to `0`).
  5. `'blocked_incompatible_frame'` — Required dataset/frame is marked `'incompatible'` in `repo.rejectedOrBlockedFrames` (e.g., incompatible `bhava_chalit` rejects Chalit without merging KP Placidus cusps).
  6. `'excluded_by_provisional_gate'` — Only `'provisional'` evidence exists and `{ strictNonProvisional: true }` is active.

### Registered K02 Rule Catalog (`k02.rules.1.0`, 19 Rules)

| `ruleId` | Target Dimension | Scope (`applicableSubjects`) | `mathModel.modelId` |
| :--- | :--- | :--- | :--- |
| `K02_CAPACITY_SHADBALA_RUPA_RATIO` | `capacity` (`P01`) | `Sun`..`Saturn` | `shadbala_bphs_rupa_ratio` (`6.5/6.0/5.0/7.0/6.5/5.5/5.0` rupas) |
| `K02_CAPACITY_BAV_STRENGTH` | `capacity` (`P01`) | `Sun`..`Saturn` | `bav_midpoint_4_deviation` (`(bindus - 4) / 4`) |
| `K02_CAPACITY_VIMSHOPAKA_TIER` | `capacity` (`P01`) | `Sun`..`Saturn` | `vimshopaka_20_ratio_tier` (prefers `Shodashvarga`) |
| `K02_CAPACITY_ISHTA_KASHTA_BALANCE` | `capacity` (`P01`) | `Sun`..`Saturn` | `ishta_kashta_net_balance` (`(ishta - kashta) / 60`) |
| `K02_INTEGRITY_D1_DIGNITY` | `integrity` (`P02`) | `Sun`..`Ketu` | `vedic_d1_dignity_category` |
| `K02_INTEGRITY_WESTERN_ESSENTIAL_DIGNITY` | `integrity` (`P02`) | `Sun`..`Ketu` | `western_essential_dignity_category` (`western_tropical` isolated) |
| `K02_INTEGRITY_D9_REINFORCEMENT_AND_VARGOTTAMA` | `integrity` (`P02`) | `Sun`..`Ketu` | `d1_d9_reinforcement_qualitative` (no auto-cancellation) |
| `K02_STABILITY_MOTION_AND_RETROGRESSION` | `stability` (`P03`) | `Sun`..`Ketu` | `kinematic_motion_taxonomy` (non-scalar; no +/- bonus) |
| `K02_AUTONOMY_DISPOSITOR_DEPENDENCY` | `autonomy` (`P04`) | `Sun`..`Ketu` | `dispositor_chain_autonomy_lookup` |
| `K02_VULNERABILITY_COMBUSTION_ASTA` | `vulnerability` (`P06`) | `Moon`..`Saturn` | `surya_siddhanta_combustion_orb_ratio` |
| `K02_VULNERABILITY_GRAHA_YUDDHA` | `vulnerability` (`P06`) | `Mars`..`Saturn` | `surya_siddhanta_graha_yuddha_gate` |
| `K02_VULNERABILITY_GANDANTA_AND_SANDHI` | `vulnerability` (`P06`) | All 10 subjects | `gandanta_sandhi_boundary_gate` |
| `K02_FOOTPRINT_CROSS_FRAME_PRESENCE` | `influenceFootprint` (`P08`) | All 10 subjects | `cross_frame_divergence_index` |
| `K02_OVERLAY_CONFLICT_DETECTION` | `overlay_conflict` | All 10 subjects | `k02_conflict_classification` |
| `K02_OVERLAY_MODIFICATION_CATALOG` | `overlay_modification` | All 10 subjects | `k02_modification_catalog` |
| `K02_OVERLAY_RELIABILITY_AUDIT` | `overlay_reliability` | All 10 subjects | `k02_reliability_trust_floor` |
| `K02_NODAL_CONDITION_PROFILE` | `nodal_condition_profile` | `Rahu`, `Ketu` | `nodal_condition_qualitative` |
| `K02_ASCENDANT_CONDITION_PROFILE` | `ascendant_condition_profile` | `Ascendant` | `ascendant_condition_qualitative` |
| `K02_PHI_INTRINSIC_HEALTH_PROJECTION` | `phi_projection` | `Sun`..`Saturn` | `phi_overlap_deduplication_projection` |

---

## 3. Consuming Overlays (`K05` / `K07`) & Deferred Dimensions (`K03` / `K08` / `K09`)

### Conflict & Modification Overlays (`K05` / `K07`)
`K05` (Interaction Intelligence) and `K07` (Conflict Resolution) read directly from `subjectStates[subject].overlays` and `impactContracts` without re-parsing raw chart frames:

1. **Conflict Overlay (`overlays.conflict`):** Surfaces intra-state and cross-frame contradictions explicitly without averaging them away:
   - `frame_house_divergence`: D1 Whole Sign house vs Sripati Bhava Chalit house or KP Placidus house.
   - `d1_d9_dignity_divergence`: Sharp D1 vs D9 polarity clash (e.g., D1 `Debilitated` + D9 `Exalted` or `Vargottama`) emitted with `resolutionStatus: 'unresolved_preserved_for_k05_k07'`. **K02 never performs automatic D9 cancellation.**
   - `strength_vs_condition_tension`: Shadbala `>= 1.0x` co-occurring with active combustion, Graha Yuddha loss, or Gandanta.
   - `ishta_kashta_polarity_tension` & `cross_frame_dignity_divergence` (Vedic Sidereal vs Western Tropical).
2. **Modification Overlay (`overlays.modification`):** Catalogs operating modifiers (`retrograde`, `combust`, `vargottama`, `gandanta`, `graha_yuddha`, `parivartana`, `chalit_shift`, `sandhi_boundary`, `dosha_factor`, `avastha_provisional`) with `pendingResolutionBy: 'K05_K07'`.
   - Retrogression and conjunctions receive **no universal +/- scalar bonuses** in K02 (`normalizedValue: null`, `magnitude: { kind: 'unassigned_no_arbitrary_weight' }`).
   - All `EvidenceImpactObject`s retain `residualImpact.status === 'unevaluated_pending_k05_k07'` until `K05`/`K07` compute net cancellation/amplification.

### Deferred `P05`, `P07`, `P09`, `P10` & `K09` Boundaries
- **`P05 authority` (`deferredCapability: 'K03'`):** Reserved strictly for `K03` Lagna-specific house lordship authority (Kendra/Trikona/Dusthana ownership, Lagnesha authority).
- **`P09 functionalOrientation` (`deferredCapability: 'K03'`):** Reserved strictly for `K03` Lagna-dependent functional benefic / malefic / Yogakaraka / Maraka status.
- **`P07 resilience` (`deferredCapability: 'K05'`):** K02 records factual recovery preconditions (`Vargottama`, `Parivartana`, `self_disposited` in `directObservations`) only; composite `Neecha-Bhanga` and affliction recovery belong to `K05`/`K07`.
- **`P10 deliverability` (`deferredCapability: 'K08'`):** Reserved strictly for `K08` KP Sub-Lord promise confirmation, Bhava Chalit delivery checks, and timing fusion.
- **`K09` Temporal Isolation:** K02 processes **`repo.natalEvidence` only** (`temporalScope === 'natal_invariant'`). Active Dashas, Gochar, KP Ruling Planets, and Profections remain quarantined in `repo.temporalEvidence` for `K09`.

---

## 4. `PHI` Engine vs Nodal & Ascendant Profile Consumption

### `PHI` Engine (`phiReadyProjections` / `phiReadyProjection.classicalPlanets`)
Downstream `PHI` consumes `phiReadyProjections` (covering **strictly the 7 classical planets `Sun`..`Saturn`**):
1. **Overlap Anti-Double-Counting:** `buildPhiAndSpecialProfiles` uses `repo.lineageGraph.overlapRelations` to:
   - Collapse `exact_duplicate` entries (`collapsedDuplicateIds`).
   - Group `partial_mathematical_overlap` families (`partialOverlapGroups`) — selecting `SHADBALA_MAJOR_SIX_BALA` over `SHADBALA_SUBCOMPONENT_BUCKET`/`ISHTA_KASHTA_PHALA`, `ASHTAKAVARGA_BHINNA_BAV` over `ASHTAKAVARGA_PRASTARA`/`ASHTAKAVARGA_SHODHANA_PINDA`, and preferring `Shodashvarga` for `VIMSHOPAKA_BALA_SCHEME`.
   - Preserve **all** `distinct_analytical_significance` observations (`preservedDistinctLensIds`) across D1, Nakshatra, D9, Chalit, KP, and Western frames.
2. **Enforced `excludedBoundaries`:** Guarantees zero leakage of:
   - `temporalEvidence` (`excludedTemporalDashaGochar: true`, `temporalEvidenceCountExcluded`)
   - `K03` Lagna/house authority (`excludedK03StructuralAuthority: true`)
   - `K04` domain importance (`excludedDomainImportance: true`)
   - `K08`/`lifeContext` historical outcomes (`excludedHistoricalOutcomes: true`)
   - `P08` house-ownership & broad signification noise (`VEDIC_D1_HOUSE_LORD_PLACEMENT`, `KP_FOUR_LEVEL_SIGNIFICATORS`, `JAIMINI_CHARA_KARAKA` counted in `unrelatedHouseFootprintEvidenceCountExcluded`)
   - Arbitrary `PHI` scalar weights (`excludedArbitraryWeights: true`).

### Nodal & Ascendant Consumers (`K03`, `K06`, Relational)
- **`nodalConditionProfiles.Rahu` & `.Ketu` (`NodalConditionProfile`):** Expose `shadbalaStatus: 'not_applicable_lunar_node'`, `nodeCalculationConvention` (`'mean' | 'true'`), D1/Nakshatra/D9/Chalit/KP/Western placements, `dispositorDependency`, `conjunctionAndAspectWitnesses`, operating conditions, and overlays for `K03`, `K05` (agentic substitution), and `K06` (Nodal Dashas).
- **`ascendantConditionProfile` (`AscendantConditionProfile`):** Exposes `shadbalaStatus: 'not_applicable_ascendant'`, D1 Lagna coordinates & Nakshatra/Pada, D9 Vargottama status, KP Cusp 1 `starLord`/`subLord`, Western Ascendant, `lagnaLordReference` (`signLord` & dispositor chain), `sandhiAndTimeSensitivity`, and `reliabilityOverlay` for `K03` Lagna authority.

---

## 5. Epistemic Reliability, Provisional Gate & Zero-Coercion

- **`ReliabilityOverlay`:** Computes `overallTrust` (`'usable' | 'provisional' | 'blocked'`) and `confidenceCeiling` (`'insufficient_data' | 'capped_provisional' | 'moderate_provider_dependent' | 'high_internal'`).
- **Provisional Non-Promotion:** Datasets like `D5` (`calibrated: false`), `advanced_avasthas`, and `shadbalaReconciliation` (`authoritativeDesignation === 'unassigned_pending_reconciliation'`) remain `provisional` and cap `confidenceCeiling = 'capped_provisional'`. Passing `{ strictNonProvisional: true }` gates them cleanly via `'excluded_by_provisional_gate'`.
- **External Validation Boundary:** `externalValidationAchieved` stays `false` unless an upstream manifest confirms external reconciliation (`JHora` / `PyJHora` / `Swiss Ephemeris`).
- **Zero-Coercion:** Missing metrics or frames remain `null` and emit `'blocked_missing_inputs'` or `'blocked_incompatible_frame'` with explicit `missingInputs` / `blockedDependencies` — never coerced to `0`.
