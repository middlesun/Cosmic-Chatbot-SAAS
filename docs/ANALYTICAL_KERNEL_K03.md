# CosmicCouncil Layer C — Analytical Intelligence Kernel K03 Specification (`k03.1.0`)

> **Scope Boundary:** This document specifies the consumer contracts, three separated policy layers, R04 Methodological Authority Registry, `CEAR` (`AC1`–`AC6`) classification semantics, and non-mutating `P05` / `P09` enrichments for **K03 (Contextual Evidence Authority Intelligence)** (`server/services/analyticalKernel/`), operating downstream of **K01** (`AnalyticalEvidenceRepository`) and **K02** (`AnalyticalKernelK02StateResult`).
>
> K03 is 100% pure TypeScript using Web-standard APIs only (Cloudflare Workers `workerd` safe, zero `node:*` built-ins, zero LLM calls, zero live paid API calls, zero DB writes, zero arbitrary authority weights or percentages).

---

## 1. Entry Points, Schema Versions & Non-Mutation Contract

- **Modules:**
  - `server/services/analyticalKernel/k03Types.ts`
  - `server/services/analyticalKernel/r04AuthorityRegistry.ts`
  - `server/services/analyticalKernel/contextualAuthorityEngine.ts`
  - `server/services/analyticalKernel/k03k04Pipeline.ts`
  - Re-exported from `server/services/analyticalKernel/index.ts`
- **Core Entry Points:**
  - `evaluateK03ContextualAuthority(repo, k02State, options?): AnalyticalKernelK03AuthorityResult`
  - `buildAnalyticalKernelK03K04Bundle(source, options?): AnalyticalKernelK03K04Bundle` (executes non-circular Stage 3 Pass 1 without `relationalContext` and Stage 5 Pass 2 consuming qualified K04 relational evidence)
  - `assertRegisteredR04Rule(ruleId, expectedVersion?)`, `getRegisteredR04Rule(ruleId)`, `getRegisteredR04LagnaRule(lagnaSign)`, `exportR04RuleRegistrySnapshot()`
- **Schema & Engine Versions:**
  - `K03_AUTHORITY_ENGINE_VERSION = 'k03.1.0'`
  - `K03_CEAR_SCHEMA_VERSION = 'k03.cear.1.0'`
  - `R04_AUTHORITY_REGISTRY_VERSION = 'k03.r04.1.0'`
  - `K03_K04_PIPELINE_VERSION = 'k03_k04.pipeline.1.0'`
- **Strict Non-Mutation Invariant:** `CanonicalEvidenceObject` (K01) and `AnalyticalKernelK02StateResult` (K02) are never mutated to store contextual authority. Every evaluation emits standalone `ContextualEvidenceAuthorityRecord` (`CEAR`) contracts with deterministic SHA-256 IDs (`cear_<32-hex>`) and non-mutating `P05` (`planetaryAuthorityEnrichment`) and `P09` (`functionalOrientationProfiles`) projections.

---

## 2. ContextualEvidenceAuthorityRecord (`CEAR`), `AC1`–`AC6` & 10 Authority Dimensions

### Deterministic Authority Classifications (`AUTHORITY_CLASSIFICATIONS`)
Because the same `CanonicalEvidenceObject` (`evidenceId`) often carries different epistemic authority depending on analytical objective and chart frame (e.g., `VEDIC_D1_HOUSE_LORD_PLACEMENT` is `AC2 Primary` for `house_governance` and `AC6 Excluded` for intrinsic `planetary_health_evidence`), K03 issues per-`(evidenceId, objectiveId, methodology, frame)` CEARs using:

| Classification | Label | Provisional Allowed? | Semantics |
| :--- | :--- | :--- | :--- |
| `AC1` | Decisive (Qualification-Scoped) | **No** | Decisive strictly for qualifying an explicit registered astrological condition (e.g., D1 dignity/combustion or Lagna/Lagnesha anchor when uncontested and non-Sandhi). Never decisive proof of a real-world life outcome. |
| `AC2` | Primary | **No** | Primary usable evidence governing the objective within its isolated chart frame. |
| `AC3` | Significant | No (methodological sensitivity) | Significant contributing evidence with methodological or boundary sensitivity (e.g., Sandhi-risk Lagnas, nodal contingency, and 8-Karaka node convention items). |
| `AC4` | Supporting | Yes (provisional ceiling) | Corroborating/derivative lineage evidence (e.g., Ashtakavarga Prastara/Shodhya Pinda) and Layer 1 ceiling for provisional datasets (`shadbala_major_6`, `bhavabala`, `D5`, `advanced_avasthas`, `propagatedTrust: 'provisional'`). |
| `AC5` | Background | Yes | Secondary overlapping sibling or absent configuration (`is_present: false`) retained for audit lineage without direct weight. |
| `AC6` | Excluded | Yes | Excluded from qualifying the objective due to temporal quarantine (`reference_date_dependent`), blocked/incompatible frame, `strictNonProvisional` gating, or scope rules. |
| `unevaluated` | Unevaluated | Yes | Required upstream inputs or Lagna anchor missing (zero-coercion guard; never fabricated). |
| `indeterminate` | Indeterminate | Yes | Contested or unresolved methodological ambiguity prevents ranking without external reconciliation. |

### 10 Individually Inspectable Authority Dimensions (`AUTHORITY_DIMENSION_NAMES`)
Every `CEAR` evaluates and exposes all 10 dimensions independently under `dimensionAssessments`:
1. `evidenceValidity`
2. `computationalReliability`
3. `methodologicalSignificance`
4. `contextualRelevance`
5. `analyticalPotency`
6. `evidenceIndependence`
7. `reinforcement`
8. `modification`
9. `structuralCriticality` (links to K04 relational dispositor/SCC context when Pass 2 is active)
10. `temporalRelevance` (quarantines `reference_date_dependent` items strictly out of natal objectives as `AC6`)

### 10 Initial Analytical Objectives (`ANALYTICAL_OBJECTIVE_IDS`)
1. `planetary_quantitative_capacity`
2. `planetary_dignity_and_positional_condition`
3. `planetary_health_evidence`
4. `ascendant_and_lagnesh_condition`
5. `house_governance`
6. `configuration_qualification`
7. `dispositor_dependency`
8. `divisional_condition`
9. `evidence_verification_and_compatibility`
10. `functional_orientation_by_lagna`

---

## 3. Three Separated Policy Layers

K03 strictly separates invariant correctness rules from methodological choices and future user preferences:

1. **Layer 1 — `UniversalIntegrityPolicy` (Immutable System Invariants):**
   - `immutableByPreferenceOrUserOverride: true`
   - `forbidBlockedEvidencePromotion: true`
   - `forbidProvisionalDecisivePromotion: true` (provisional evidence tracked in `docs/SHADBALA_BHAVABALA_ISSUE_REGISTER.md` can never become `AC1` or `AC2`)
   - `forbidTemporalLeakageIntoNatal: true`
   - `forbidCrossFrameSilentMerge: true` (no KP-for-Bhava-Chalit or Sayana-for-Lahiri fallback)
   - `forbidZeroCoercionOnMissingData: true`
   - `enforceStrictRegistrationGuard: true` (`UnregisteredRuleError` on any unregistered R04 rule)
   - `requireIndependenceAuditBeforePromotion: true`
   - Attempting to weaken Layer 1 flags throws immediately (`Layer1PolicyViolation` / error).
2. **Layer 2 — `MethodologicalAuthorityPolicy` (Registered Tradition Governance):**
   - Configurable tradition/scope flags (`activeMethodologies`, `strictNonProvisional`, `kpSubLordCannotGloballyOverrideVargas: true`, `shadbalaCannotOverrideClassicalDignity: true`, `preserveCrossFrameContradictionsWithoutAveraging: true`, `forbidFixedGlobalCrossSystemHierarchy: true`).
   - Enforces non-dominance: KP cuspal sub-lords stay isolated in `kp_placidus` and never globally suppress Parashari divisional charts (`D9`, `D10`, etc.); Shadbala never overwrites D1 Rashi dignity; D9 never auto-cancels D1 debilitation inside K03.
3. **Layer 3 — `IndividualPreferencePolicy` (Future-Compatible Hook):**
   - `mode: 'system_defaults_only'` in `k03.1.0` with an immutable placeholder (`customHierarchyOverrides: Record<string, never>`, `preferenceHooksDeferred: true`) constrained strictly beneath Layer 1 and Layer 2.

---

## 4. R04 Methodological Authority Registry (`k03.r04.1.0`, 27 Rules)

All K03 evaluations execute solely via frozen registered definitions in `R04_AUTHORITY_RULES` (`r04AuthorityRegistry.ts`). Calling `assertRegisteredR04Rule` or passing `verifyRegisteredRuleIds` with an unknown rule ID or mismatched version throws `UnregisteredRuleError`.

- **14 Core Rules (Objectives 1–9):**
  1. `R04_PARASHARI_QUANTITATIVE_CAPACITY_SHADBALA` (`planetary_quantitative_capacity` — caps provisional Shadbala at `AC4`; subcomponents & Ishta/Kashta at `AC5`)
  2. `R04_PARASHARI_ASHTAKAVARGA_CAPACITY` (`planetary_quantitative_capacity` — BAV `AC2`, Prastara/Shodhana `AC4`)
  3. `R04_PARASHARI_VIMSHOPAKA_CAPACITY` (`planetary_quantitative_capacity` — prefers Shodashvarga `AC2`, secondary sibling schemes `AC5`)
  4. `R04_PARASHARI_D1_DIGNITY_AND_CONDITION` (`planetary_dignity_and_positional_condition` — `AC1` qualification-scoped when usable & uncontested)
  5. `R04_WESTERN_ESSENTIAL_DIGNITY_ISOLATED` (`planetary_dignity_and_positional_condition` — strictly `western_tropical` isolated `AC2`)
  6. `R04_CROSS_TRADITION_PHI_HEALTH_CONTRIBUTION` (`planetary_health_evidence` — excludes temporal items, `P08` house ownership noise, Rahu/Ketu/Ascendant, and overlap siblings)
  7. `R04_PARASHARI_ASCENDANT_AND_LAGNESH_ANCHOR` (`ascendant_and_lagnesh_condition` — `AC1` non-Sandhi, `AC3` if <=1° Sandhi/Gandanta)
  8. `R04_PARASHARI_HOUSE_GOVERNANCE_AND_CHALIT` (`house_governance` — Bhavabala provisional ceiling `AC4`, incompatible Chalit `AC6`)
  9. `R04_KP_CUSPAL_SUBLORD_AND_SIGNIFICATOR_GOVERNANCE` (`house_governance` — `kp_placidus` isolated `AC2`)
  10. `R04_PARASHARI_YOGA_DOSHA_QUALIFICATION` (`configuration_qualification` — present configurations `AC2`, absent `AC5`, interaction deferred to `K05`/`K07`)
  11. `R04_JAIMINI_KARAKA_PADA_QUALIFICATION` (`configuration_qualification` — 7-Karaka `AC2`, 8-Karaka node convention `AC3`)
  12. `R04_PARASHARI_DISPOSITOR_DEPENDENCY_AUTHORITY` (`dispositor_dependency` — `AC1` self/chain termination identity, `AC2` nodal agent anchor)
  13. `R04_PARASHARI_DIVISIONAL_VARGA_AUTHORITY` (`divisional_condition` — D9/Vargottama `AC2`, uncalibrated D5 `AC4`)
  14. `R04_CROSS_TRADITION_VERIFICATION_AND_COMPATIBILITY` (`evidence_verification_and_compatibility` — Universal Integrity gate)
- **12 Lagna-Specific Rules (`R04_LAGNA_FUNC_ARIES` .. `R04_LAGNA_FUNC_PISCES`):** Classical BPHS Ch. 34 Yogakaraka, functional benefic/malefic/neutral, and Maraka classifications for all 12 Vedic Lagnas (`functional_orientation_by_lagna`).
- **1 Non-Classical Guard Rule (`R04_LAGNA_FUNC_NON_CLASSICAL_SUBJECTS`):** Explicit exemption routing `Rahu`/`Ketu` (`contingent_nodal_agent`) and `Ascendant` (`non_planetary_lagna_reference`) out of 7-planet lordship tables.

---

## 5. Evidence Independence & Overlap Audit (`evidenceIndependenceInfo`)

K03 reads K01 `overlapRelations` directly and classifies every `CEAR` without erasing analytical perspectives:
- `exact_duplicate` -> duplicate entries downgraded/quarantined (`doubleCountingGuardApplied: true`)
- `partial_mathematical_overlap` -> primary kept (`SHADBALA_MAJOR_SIX_BALA`, `ASHTAKAVARGA_BHINNA_BAV`, Shodashavarga `VIMSHOPAKA_BALA_SCHEME`), mathematical subcomponents/derivatives (`SHADBALA_SUBCOMPONENT_BUCKET`, `ISHTA_KASHTA_PHALA`, `ASHTAKAVARGA_PRASTARA`, `ASHTAKAVARGA_SHODHANA_PINDA`, lower-granularity Vimshopaka schemes) downgraded to `AC4`/`AC5` with `doubleCountingGuardApplied: true`
- `distinct_analytical_significance` -> preserved concurrently across `D1`, `Nakshatra`, `D9`, `D10`, `Sripati Bhava Chalit`, `KP Placidus`, and `Western Tropical` (`distinctLensesPreserved`)

---

## 6. Non-Mutating `P05` & `P09` Enrichment & Contextual Authority Integrity

- **`P05` (`planetaryAuthorityEnrichment[subject]`):** Summarizes objective- and proposition-scoped authority (`AC1`–`AC6` distribution), provisional ceilings, excluded temporal/incompatible items, and Pass 2 `K04` relational criticality linkage without altering K02 `subjectStates`.
  - **`overallHighestClassification` Boundary:** Explicitly tagged via `overallHighestClassificationDiagnosticMeta` (`diagnosticMetadataOnly: true`, `notUniversalPlanetaryAuthority: true`, `forbiddenAsScoringOrPrioritizationInput: true`, `authorityRemainsObjectiveAndPropositionScoped: true`) alongside `authorityScopeGuarantees`. Cross-objective summaries are diagnostic metadata only — never universal planetary authority or future scoring inputs.
  - **`AC5` Non-Substitution:** `AC5` (`Background`) is used strictly for overlapping mathematical siblings or absent (`is_present: false`) configurations and never substitutes for genuinely `unevaluated` or `indeterminate` authority.
- **`P09` (`functionalOrientationProfiles[subject]`):** Executes the registered BPHS Ch. 34 Lagna rule (`R04_LAGNA_FUNC_<SIGN>`) for the 7 classical planets across all 12 Lagnas (`Aries`..`Pisces`) while enforcing strict separation from `naturalSignifications` (e.g., Venus under Scorpio Lagna is `functionalMalefic: true`, `maraka: true`, while retaining `naturalPolarity: 'natural_benefic'`; Saturn under Taurus Lagna is `yogakaraka: true`, `functionalBenefic: true`, while retaining `naturalPolarity: 'natural_malefic'`).
  - **Coexisting & Conditional Responsibilities:** Preserves `coexistingResponsibilities` (`supportive`, `constraining`, `conditional`, `house_specific`), `conditionalMaraka` / `conditionalMarakaHouses`, and `methodologicalQualifications` (explicitly recording differing classical conventions). Example: for **Scorpio Lagna**, **Jupiter** carries `functionalBenefic: true` via H5 Trikona **alongside** `conditionalMaraka: true` (`conditionalMarakaHouses: [2]`) for H2 Dhana/Maraka governance — functional beneficence never silently excludes conditional Maraka responsibilities.
  - **Non-Classical Guard:** `Rahu`, `Ketu`, and `Ascendant` route to `R04_LAGNA_FUNC_NON_CLASSICAL_SUBJECTS` (`contingent_nodal_agent` / `non_planetary_lagna_reference`). Missing D1 Ascendant returns `status: 'unevaluated'` with `null` flags.

---

## 7. Known Limitations, Verification Separation & Explicitly Deferred Scope

- **Provisional Quantitative Inputs:** Shadbala (`6.5` vs `5.0` Sun threshold, Kala Bala rollup, luminary Cheshta = 0) and Bhavabala remain strictly capped (`provisional`, max `AC4`/`AC5`, or `AC6` under `strictNonProvisional: true`) per `docs/SHADBALA_BHAVABALA_ISSUE_REGISTER.md`.
- **Verification Terminology Separation:** `computational`, `methodological`, and `empirical` (`empiricalStatus: 'not_validated'`) are kept strictly separate. External ephemeris/astrology software comparisons (`JHora`, `PyJHora`, `Swiss Ephemeris`, `AstroWay`) assess computational agreement only and never establish empirical predictive validity.
- **Explicitly Deferred (Governing `K01`–`K10` Architecture):** Canonical Strength Engine, `K05 — Interaction Intelligence`, `K06 — Structural Intelligence`, `K07 — Conflict Intelligence`, `K08 — Deliverability Intelligence`, `K09 — Temporal Intelligence`, `K10 — Adjudication Intelligence`, `T01`–`T08` (Temporal Engines), scalar `PHI`/`AHI`/`PAI`/`YSI`/`DSI` scores, `REFINE`, Layer 3 runtime user overrides, commercial provider acquisition, and consumer dashboards.
