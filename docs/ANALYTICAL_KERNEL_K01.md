# CosmicCouncil Layer C — Analytical Intelligence Kernel K01 Specification (`k01.1.0`)

> **Scope Boundary:** This document specifies the consumer interface and architectural invariants of **K01 (Evidence Intelligence)** (`server/services/analyticalKernel/`), the deterministic foundational evidence layer of CosmicCouncil's proprietary **Layer C Analytical Intelligence Kernel**.
>
> K01 prepares normalized, lineage-tracked, frame-isolated, and epistemically tagged evidence from `LayerCAnalyticalInput` (`v2.layer_c_input.1.0`) without modifying `server/services/v2Engine/`, inventing proprietary `PHI`/`YSI`/`DSI` scoring weights, emitting arbitrary numeric bonuses, or invoking LLMs.

---

## 1. Module Entry Points & Runtime Isolation

- **Barrel Export:** `server/services/analyticalKernel/index.ts`
- **Primary Builder:** `buildAnalyticalEvidenceRepository(source: CompiledV2FoundationalChartResult | LayerBMasterChartRecord | LayerCAnalyticalInput): AnalyticalEvidenceRepository`
- **Formatter Utility:** `formatPlanetEvidenceSummary(repo: AnalyticalEvidenceRepository, planetName: string): string`
- **Lineage & Registry:** `CanonicalEvidenceRegistry`, `CircularLineageError`, `EvidenceValidationError`, `buildDeterministicEvidenceId`, `createEvidenceImpactContract`, `analyzeEvidenceOverlaps`
- **Schema Versions:**
  - `ANALYTICAL_KERNEL_VERSION = 'k01.1.0'`
  - `REPOSITORY_SCHEMA_VERSION = 'k01.repository.1.0'`
  - `EVIDENCE_IMPACT_SCHEMA_VERSION = 'k01.impact.1.0'`
  - `PLANETARY_STATE_SCHEMA_VERSION = 'k01.planetary_state.1.0'`
  - `ANALYTICAL_RULE_VERSION = 'k01.rules.1.0'`
- **Cloudflare Workers Safety:** 100% pure TypeScript / Web-standard APIs (pure Web FIPS-180-4 `sha256Hex` + `TextEncoder`). Zero Node built-ins (`node:fs`, `node:path`, `node:os`, `node:crypto`, `child_process`, `process.exit`).

---

## 2. Role of K01 as Common Foundation for `K02`–`K10` & Downstream Engines

K01 decouples astrological evidence extraction, verification tracking, and lineage accounting from downstream synthesis so every future capability consumes a single canonical repository (`AnalyticalEvidenceRepository`) rather than parsing raw Layer A provider responses or ad-hoc Layer B structures:

| Core Type | Schema Role | Downstream Consumers |
| :--- | :--- | :--- |
| `AnalyticalEvidenceRepository` | Top-level immutable bundle containing `natalEvidence`, `temporalEvidence`, `rejectedOrBlockedFrames`, `lineageGraph`, `impactContracts`, `planetaryStates`, `familyInventory`, `frameInventory`, and deferred extension slots (`lifeContext`, `investigationFindings`). | All `K02`–`K10` capabilities, `PHI`, `YSI`, `DSI`, House Intelligence, Domain Matrices, AI Investigation Tools. |
| `CanonicalEvidenceObject` | Atomic, deterministic observation (`ev_<32-hex>`) bound to a single `frame`, `family` (12 families), `subject`, `observation`, raw `measurements`, `ruleReference`, `sourceDatasets`, `lineage`, `temporalScope`, `verification`, and `sensitivity`. | `K02` (State), `K03` (Authority), `K04` (Relational), `K05` (Interaction), `K06` (Structural), `K07` (Conflict), `K08` (Deliverability), `K09` (Temporal). |
| `EvidenceImpactObject` | Contextual analytical evaluation contract (`imp_<24-hex>`) kept strictly separate from `CanonicalEvidenceObject` so raw observations remain invariant while rule-driven direction, justified magnitude, modifiers, and overlap status are layered cleanly. | `K05` (Interaction), `K07` (Conflict), `K10` (Adjudication), `PHI` / `YSI` / `DSI`. |
| `PlanetaryStateRecord` | 10-dimension state model per celestial subject (`Sun`..`Ketu`, `Ascendant`): `capacity`, `integrity`, `stability`, `autonomy`, `authority`, `vulnerability`, `resilience`, `influenceFootprint`, `functionalOrientation`, `deliverability`. | `K02` State Intelligence, `PHI` Planetary Health Index, House Lord & Timing evaluators. |

### Evidence Taxonomy (12 Families)

Every `CanonicalEvidenceObject` belongs to one primary `EvidenceFamily` (`EVIDENCE_FAMILIES`):
`positional`, `quantitative`, `degree_level`, `stellar`, `operating_condition`, `relational`, `dependency`, `divisional`, `configuration`, `modification`, `temporal`, `historical_contextual`.

---

## 3. Consuming `natalEvidence` vs `temporalEvidence` & 4-Frame Isolation

### Strict Temporal Partitioning
`buildAnalyticalEvidenceRepository` enforces temporal partitioning at both registration (`CanonicalEvidenceRegistry.register`) and repository assembly:

1. **`natalEvidence` (`temporalScope === 'natal_invariant'`):**
   - Contains ONLY birth-chart invariants (`referenceDateIso === null` strictly enforced; supplying a non-null `referenceDateIso` throws `EvidenceValidationError`).
   - Safe to cache or compare across any future query date for the same `sourceChart.inputFingerprint`.
2. **`temporalEvidence` (`temporalScope === 'reference_date_dependent'`):**
   - Contains ONLY target-date-dependent activations (`referenceDateIso !== null` strictly enforced), such as active `Vimshottari`, active alternative dashas (`Yogini`, `Chara`, `Ashtottari`), `KP Ruling Planets`, and `Hellenistic Annual Profections`.
   - Downstream `K09 Temporal Intelligence` must combine `natalEvidence` with `temporalEvidence` at evaluation time and **must never persist `temporalEvidence` into invariant natal truth**.

### Frame Isolation Contract (`CANONICAL_EVIDENCE_FRAMES`)
Downstream consumers MUST filter by `item.frame` and MUST NEVER silently merge placements or house assignments across incompatible coordinate/house systems:

- `canonical_instant`: Canonical UTC/JD/timezone birth anchor (`CANONICAL_BIRTH_INSTANT`) and birth-balance context.
- `vedic_lahiri`: Sidereal Lahiri positions, Whole Sign houses (`H1`..`H12`), Vargas (`D1`..`D60`), Shadbala, Bhavabala, Ashtakavarga, Vimshopaka, Panchadha Maitri, Dispositors, Conditions, Yogas, Doshas, Dashas.
- `kp_placidus`: KP Krishnamurti Ayanamsha + Placidus cuspal longitudes, cuspal/planet 4-step lords (`Sign`/`Star`/`Sub`/`Sub-Sub`), 4-level KP significators, KP Ruling Planets.
- `bhava_chalit`: Sripati Bhava Madhya & Sandhi boundaries (`sripati_midpoint_chalit`). Never falls back to `kp_placidus` start-cusps when unavailable or incompatible.
- `western_tropical`: Sayana (tropical) Placidus/chart placements, Western essential dignities, aspects, Hellenistic Profections.
- `astronomical_telemetry`: Geocentric ecliptic longitude, latitude, speed (`deg/day`), and stationary/direct/retrograde motion state.
- `cross_frame`: Explicit cross-system structural comparisons where methodology differences are preserved as metadata rather than merged.

Future capabilities read **only** from `AnalyticalEvidenceRepository` (or its `LayerCAnalyticalInput` provenance header) and never inspect raw provider JSON (`LayerA`).

---

## 4. Epistemic Trust Rules, Empirical Validation Boundary & Zero-Coercion

Each `CanonicalEvidenceObject` carries `verification: EvidenceVerificationMetadata`:

- `computational`: `'verified_internal' | 'provider_reported' | 'provisional' | 'unverified' | 'incompatible' | 'unavailable'`
- `methodological`: `'classical_standard' | 'provider_convention' | 'contested_or_uncalibrated' | 'incompatible_methodology' | 'unspecified'`
- `empirical`: `'not_validated' | 'independently_validated_external'`
- `propagatedTrust`: `'usable' | 'provisional' | 'blocked'`

### Trust Propagation & Policy

| Propagated Trust | Source `CanonicalDatasetState` | Consumer Rule (`K02`–`K10`, `PHI`/`YSI`/`DSI`) |
| :--- | :--- | :--- |
| **`usable`** | `available`, `internally_verified`, `independently_validated` | Eligible for primary rule evaluation (`available` carries `provider_convention` caveat; `internally_verified` reflects internal astronomical/BPHS solver checks). |
| **`provisional`** | `provisional` | **Never silently promoted to `usable` or `verified_internal`.** Examples: supplementary `D5` (`calibrated: false`), `advancedAvasthas` (`Sayanaadi`/`Lajjitadi`), `shadbalaReconciliation` while `authoritativeDesignation === 'unassigned_pending_reconciliation'`, or missing `D60` schemes. Downstream consumers must either require an explicit `allowProvisional` gate or surface a methodological caveat. |
| **`blocked`** | `unavailable`, `incompatible` | **Excluded from usable evidence extraction.** Surfaced explicitly in `repository.rejectedOrBlockedFrames` with `frame`, `datasetKey`, `canonicalStatus`, and `reason`. |

### Empirical Validation Invariant
`verification.empirical = 'independently_validated_external'` is **never auto-claimed by CosmicCouncil's internal solvers** (`jyotishMath`, `computeLocalAshtakavarga`, `computeLocalSripatiBhavaChalit`, etc.). It may only appear when the upstream dataset manifest carries `canonicalStatus === 'independently_validated'` after reconciliation against an external reference engine (`JHora`, `PyJHora`, or `Swiss Ephemeris`).

### Zero-Coercion Invariant
Missing, `null`, `unavailable`, or `incompatible` values (e.g., absent Bhavabala houses, incomplete Vimshopaka vargas, missing Shadbala subcomponents `sthana_bala`/`dig_bala`, or `incompatible` Bhava Chalit) are **never coerced to `0`**. Measurements remain `null` or the dataset is withheld into `rejectedOrBlockedFrames`.

---

## 5. Lineage, Determinism & Overlap Anti-Double-Counting

### Deterministic Identity & Acyclic DAG
- `naturalKey` combines normalized `chartFingerprint | frame | family | observationCode | subjectType | subjectId | ruleCode | temporalScope | referenceDateIso_or_natal [| qualifier]`.
- `evidenceId` is `ev_<first 32 hex chars of SHA-256(naturalKey)>`, guaranteeing identical IDs across repeated Node and Cloudflare Worker runs.
- `CanonicalEvidenceRegistry.assertAcyclic()` performs DFS cycle verification on `register` and `linkParent`, throwing `CircularLineageError` on any cycle (`A -> B -> A` or self-parent).
- `lineageGraph` exposes `edges`, `rootEvidenceIds`, `maxDerivationDepth`, `cycleCheckPassed`, and `unresolvedParentRefs`.

### Overlap Classifications (`lineageGraph.overlapRelations`)
`analyzeEvidenceOverlaps` classifies related evidence pairs to prevent downstream double-weighting while preserving distinct analytical meaning:

| Overlap Classification | `collapseRecommended` | Meaning & Downstream Action |
| :--- | :--- | :--- |
| **`exact_duplicate`** | `true` | Identical `frame`, `family`, `subject`, `observation.code`, `ruleCode`, `temporalScope`, `referenceDateIso`, and sorted measurements (differing only by qualifier/key). Collapse or deduplicate before scoring. |
| **`partial_mathematical_overlap`** | `false` | Shares mathematical inputs or aggregation hierarchy within the **same** frame and family (e.g., `SHADBALA_MAJOR_SIX_BALA` vs `SHADBALA_SUBCOMPONENT_BUCKET`, or `ASHTAKAVARGA_PRASTARA` -> `ASHTAKAVARGA_BHINNA_BAV`). Keep both for audit; **never double-count both aggregate and constituent in one index**. |
| **`shared_upstream_dependency`** | `false` | Shares an ancestor (`sharedUpstreamIds`) without identical frame/family overlap. Track dependency edge for downstream independence accounting. |
| **`distinct_analytical_significance`** | `false` | Shares a common astronomical root (e.g. planetary longitude) across **distinct frames, vargas, or analytical lenses** — such as D1 Rashi vs Nakshatra/Pada vs D9 Navamsa vs KP Placidus vs Sripati Bhava Chalit. **Must NEVER be collapsed as redundant.** |

---

## 6. Extension Points for `K02`–`K10` (`EvidenceImpactObject` & `PlanetaryStateRecord`)

K01 intentionally leaves rule adjudication and synthesis un-scored so `K02`–`K10` can plug into typed contracts without altering K01 extraction:

1. **`EvidenceImpactObject` (`repository.impactContracts`, currently `[]` in K01):**
   - Created via `createEvidenceImpactContract(...)` when K02–K10 rule tables are supplied.
   - Separates `analyticalTarget`, `affectedDimension`, `direction` (`'supporting' | 'constraining' | 'modifying' | 'neutral'`), `interactionType` (`'direct' | 'modifier' | 'cancellation' | 'amplification' | 'contextual_gate' | 'conditional'`), `applicabilityConditions`, `modifierEvidenceIds`, and `overlapMetadata`.
   - Enforces epistemic magnitude discipline: `magnitude` defaults to `{ kind: 'unassigned_no_arbitrary_weight' }` unless backed by `{ kind: 'justified_rule_value', value, unit, ruleReference }`.
   - `residualImpact` tracks `{ status: 'unevaluated_pending_k05_k07', note }` until K05 Interaction and K07 Conflict engines resolve cancellations/amplifications.
2. **`PlanetaryStateRecord` (`repository.planetaryStates`):**
   - In K01 (`buildInitialPlanetaryStates`), dimensions backed by direct extracted facts (`capacity`, `integrity`, `stability`, `autonomy`, `vulnerability`, `influenceFootprint` when observations exist) carry `status: 'observed_direct_only'` and `directObservations[]` with per-observation `sourceEvidenceId` and `trust`.
   - Synthesis-dependent dimensions (`authority`, `resilience`, `functionalOrientation`, `deliverability`, and any dimension without direct observations) remain strictly `status: 'unevaluated'` with an explicit `unevaluatedReason` pointing to the governing future capability (`K02`, `K03`, `K05`, `K08`).
3. **Repository Deferred Slots:**
   - `lifeContext`: `{ status: 'deferred', data: null }` for life-domain & chart-context framing.
   - `investigationFindings`: `{ status: 'deferred', data: [] }` for cross-capability adjudications (`K10`).
