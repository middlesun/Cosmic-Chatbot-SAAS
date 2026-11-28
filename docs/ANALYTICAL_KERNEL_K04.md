# CosmicCouncil Layer C — Analytical Intelligence Kernel K04 Specification (`k04.1.0`)

> **Scope Boundary:** This document specifies the data model, frame-isolation guarantees, Tarjan Strongly Connected Components (SCC) Dispositor & Dependency Engine, Dependency Concentration Index (`DCI`), R07 graph/set mathematical models, bounded cycle-safe graph traversal utilities, and non-mutating `P08` Influence Footprint enrichment for **K04 (Relational Intelligence)** (`server/services/analyticalKernel/`).
>
> K04 is 100% pure TypeScript using Web-standard APIs only (Cloudflare Workers `workerd` safe, zero `node:*` built-ins, zero external graph databases, zero LLM calls, zero live paid API calls, zero DB writes, zero arbitrary edge weights or recursive `PHI` score propagation).

---

## 1. Entry Points & Schema Versions

- **Modules:**
  - `server/services/analyticalKernel/k04Types.ts`
  - `server/services/analyticalKernel/natalIntelligenceGraph.ts`
  - `server/services/analyticalKernel/dispositorDependencyEngine.ts`
  - `server/services/analyticalKernel/graphTraversal.ts`
  - `server/services/analyticalKernel/p08FootprintEnrichment.ts`
  - `server/services/analyticalKernel/ruleRegistry.ts` (`R07_GRAPH_SET_MATH_MODELS`)
  - `server/services/analyticalKernel/k03k04Pipeline.ts`
- **Schema & Engine Versions:**
  - `K04_RELATIONAL_ENGINE_VERSION = 'k04.1.0'`
  - `K04_NIG_SCHEMA_VERSION = 'k04.nig.1.0'`
  - `K04_DISPOSITOR_ENGINE_VERSION = 'k04.dispositor.1.0'`
  - `K04_GRAPH_TRAVERSAL_VERSION = 'k04.traversal.1.0'`
  - `K04_P08_ENRICHMENT_VERSION = 'k04.p08.1.0'`
  - `R07_MATH_MODEL_REGISTRY_VERSION = 'k04.r07.1.0'`

---

## 2. Natal Intelligence Graph (`NIG`) Architecture

`buildNatalIntelligenceGraph(repo, { k03Result? })` constructs a deterministic, directed, serializable property graph entirely in memory:
- **Deterministic Identifiers:** Every node uses a canonical typed ID (`planet:Jupiter`, `ascendant:Ascendant`, `house:vedic_lahiri:5`, `sign:vedic_lahiri:Sagittarius`, `nakshatra:Rohini`, `divisional_placement:vedic_lahiri:D9:Jupiter`, `configuration:...`, `evidence_object:<evidenceId>`, `registered_functional_role:...`). Every edge carries a SHA-256 derived deterministic ID (`rel_<32-hex>`) with `direction: 'directed'` and **zero duplicates, zero dangling endpoints, zero unresolved `evidenceIds`**.
- **9 Entity Types (`NIG_ENTITY_TYPES`):** `planet`, `ascendant`, `house`, `sign`, `nakshatra`, `divisional_placement`, `configuration`, `evidence_object`, `registered_functional_role`.
- **All 12 Typed Relationship Families (`NIG_RELATIONSHIP_FAMILIES`):**
  1. `occupancy` (D1 sign/house, divisional sign/house, Nakshatra/Pada, Bhava Chalit, KP Placidus, Western Tropical)
  2. `governance` (Rashi sign lordship, D1 house lordship, KP cuspal star/sub-lord, KP 4-level significators)
  3. `dependency` (D1 sign dispositor, Nakshatra lord dispositor, divisional sign dispositor `D2..D60`, Lagna -> Lagnesh dependency, Western traditional sign dispositor)
  4. `association` (same-sign/same-house conjunctions, Panchadha/Naisargika/Tatkalika Maitri polarity context)
  5. `aspect` (Parashari Graha Drishti including Mars 4/7/8, Jupiter 5/7/9, Saturn 3/7/10; Jaimini Rashi Drishti; Western Ptolemaic aspects)
  6. `compatibility` (Parivartana mutual exchange, Ashtakavarga BAV/SAV links)
  7. `configuration_participation` (explicit `configuration:*` nodes for Yogas, Doshas, Jaimini Chara Karakas/Arudha Padas with `adjudicationStatus: 'participants_mapped_interaction_deferred_to_k05_k07'`)
  8. `modification` (Vargottama, Combustion/Asta, Graha Yuddha opponent links, Gandanta, Chalit shift vs D1)
  9. `cross_frame_relationship` (explicit D1 vs Bhava Chalit house shifts, D1 vs D9 Vargottama alignment, D1 vs Western Tropical contrasts without silent merge)
  10. `functional_relationship` (`registered_lagna_functional_role` edges populated when `k03Result` is passed in Stage 4)
  11. `temporal_relationship` (**strictly `0` edges inside natal projections**; reserved exclusively for deferred `K09` temporal projection)
  12. `evidence_lineage` (`evidence_lineage_parent`, `evidence_overlap_group` reflecting K01 DAG and overlap classifications)
- **Strict Chart Frame Isolation:** Edges never cross-contaminate across `vedic_lahiri`, `vedic_lahiri:D9`, `vedic_lahiri:D2..D60`, `bhava_chalit`, `kp_placidus`, `western_tropical`, `astronomical_telemetry`, or `cross_frame`. If `bhava_chalit` is `incompatible`/`blocked` in K01, Chalit edges are omitted and `blockedFrameNotices` records `fallbackSuppressed: true` (KP Placidus never substitutes).
- **4 Logical Projection Contracts (`projections`):**
  1. `natal` (`status: 'implemented'`) — excludes all `temporalEvidence` (`temporalEvidenceExcludedCount`).
  2. `functional_domain` (`status: 'partial_functional_roles_only'`, `domainScoringDeferredTo: 'K08'`).
  3. `temporal` (`status: 'deferred_to_k09'`, `edgeIds: []`).
  4. `private_investigative_contextual` (`status: 'deferred_and_isolated'`, `edgeIds: []`).

---

## 3. Dispositor Intelligence, Tarjan SCC & Dependency Concentration Index (`DCI`)

`analyzeK04DispositorAndDependencies(nig, k02State?, options?)` analyzes each chart frame independently (never mixing D1, D9, D10, etc.):
- **Cycle-Complete Topology via Deterministic Tarjan SCC:**
  - Self-dispositors (1-node self-loop, e.g. planet in own sign)
  - Mutual 2-cycles (`Parivartana` / `A -> B -> A`)
  - Closed multi-planet cycles (e.g., Chris 4 D1 reference cycle verified identically on both `real_freeastroapi_export_chris4` and `astroway-chris4-sanitized.json`: `Jupiter -> Saturn -> Mars -> Venus -> Jupiter`, with 5 upstream planets `Sun, Moon, Mercury, Rahu, Ketu` draining into the single cycle basin -> `DCI = 1.0`, `hasSingleFinalDispositor: false`)
  - Multiple terminal basins (`multipleTerminalBasinsDetected: true`, `DCI < 1.0`)
  - Unassigned / dead-end incomplete chains (`unassignedOrMissingEntities`)
- **Dependency Concentration Index (`DCI`) via R07 `dependency_concentration_dci`:**
  - `DCI = sum_i (count_i / expectedPopulationCount)^2` across terminal basins.
  - **Strict Non-Renormalization Invariant:** When planets lack dispositor assignments (`isComplete: false`), `expectedPopulationCount` remains the full population (9 Grahas), `renormalized` is strictly `false`, and unassigned mass is never renormalized back to `1.0`.
  - Carries explicit caveat: `interpretationLimitations: 'Measures dependency concentration only; does not imply favorability, vulnerability, or predictive outcome'`.
- **6 Structured Dependency Properties per Subject (`subjectProfiles`):**
  1. `direct` (sign lord / Lagnesha edge + provenance)
  2. `depth` (hops to terminal basin, cycle membership)
  3. `breadth` (direct dependents count, transitive upstream basin size)
  4. `quality` (`strictlyNoScalarPropagation: true` — preserves K02 dispositor condition tags without scalar propagation)
  5. `redundancy` (Parivartana mutual support & alternative Nakshatra dispositor path observation; strictly `redundancyEpistemicStatus: 'topological_path_observation_only'`, `functionalRedundancyEstablished: false`, stronger redundancy deferred to `K06` & `K08`)
  6. `criticality` (topological observation only — exposes `isTopologicalSinkWithInboundFeed` with `functionalBottleneckEstablished: false`; terminal cycle membership, concentration, or cyclic co-membership never independently establish functional bottlenecks or vulnerability, with stronger criticality reserved strictly for **`K06` Structural Intelligence** and **`K08` Deliverability Intelligence**)
  7. Plus `concentration` (`terminalBasinId`, `basinShare`, `frameDci`) and `epistemicTag`.

---

## 4. Registered R07 Graph & Set Mathematical Models (`k04.r07.1.0`)

All graph and set math in `graphTraversal.ts` and `dispositorDependencyEngine.ts` runs exclusively through `evaluateRuleMathModel` (`ruleRegistry.ts`), which rejects unregistered IDs and forbidden arbitrary weighting patterns (`composite_authority`, `relationship_weight`, `scalar_phi_weight`, etc.) with `UnregisteredMathModelError`:
1. `unique_entity_counting` (`|Set(entities)|`)
2. `graph_reachability` (bounded cycle-safe BFS)
3. `dependency_path_length` (shortest directed hop length)
4. `scc_detection` (deterministic Tarjan SCC + condensation DAG)
5. `terminal_basin_assignment` (maps nodes to terminal sink SCCs without assuming a single final dispositor)
6. `dependency_concentration_dci` (`sum_i (count_i / expectedPopulation)^2`, zero renormalization)
7. `set_intersection`
8. `set_union`
9. `jaccard_overlap`

---

## 5. Bounded Cycle-Safe Traversal, Non-Mutating `P08` & Representation Tiers

- **10 Traversal Utilities (`graphTraversal.ts`):** `getDirectRelationships`, `getIncomingRelationships`, `getOutgoingRelationships`, `findTypedPaths`, `getDependencyChain`, `getCycleMembership`, `getTerminalBasinMembership`, `detectSharedDependencies`, `findAlternativeStructuralPaths`, `countUniqueReachableEntities`.
  - Every traversal enforces explicit `maxDepth` & `maxSteps` termination bounds (`bounds.visitedLimitReached`, `bounds.truncatedByDepth`), forbids `temporal_relationship` admission, and attaches `STRUCTURAL_REACHABILITY_EPISTEMIC_TAG` (`epistemicStatus: 'structural_graph_reachability_only'`, `impliesActiveAstrologicalInfluence: false`, `functionalDeliverabilityDeferredTo: 'K08'`).
- **`P08` Influence Footprint Enrichment (`p08FootprintEnrichment.ts`):** `buildK04InfluenceFootprintEnrichment(nig, k02State, dispositorAnalysis)` organizes `directOccupancy`, `governance`, `aspects`, `dispositorDependencies`, `crossDivisionalRelationships`, `qualifiedIndirectRelationships`, `epistemicSeparation`, and `semanticCountBreakdown` (strictly separating total typed relationship records, unique connected entity count, D1-only vs by-frame counts, and distinct mechanism families present, with `aggregateInfluenceScoreComputed: false` and explicit non-conflation invariants so cross-frame counts are never mistaken for unique D1 house influences or independent astrological contributions).
- **3-Tier Analytical Representation Architecture (`k03k04Pipeline.ts`):**
  1. `normalized_canonical`: Single-copy deterministic-ID records without Pass-1 clones or duplicate maps.
  2. `expanded_diagnostic`: Complete forensic export (`buildAnalyticalKernelK03K04Bundle`, >25 MiB on rich multi-varga charts due to duplicated Pass-1 CEARs, verbose `dimensionAssessments`, `nodesById`/`edgesById` lookup indices, `enrichmentProjection` copies, and K02 compatibility aliases).
  3. `focused_consumption`: Lightweight ID/reference-driven projection (`buildFocusedK03K04ConsumptionView`) + byte telemetry (`analyzeBundleRepresentationEfficiency`).
- **Staged Non-Circular K03 Bridge (`k03k04Pipeline.ts`):** Stage 4 calls `buildK03RelationalContextFromDispositorAnalysis` so Stage 5 (`K03` Pass 2) receives qualified dispositor/SCC/DCI context cleanly without circular recursion.

---

## 6. Known Limitations & Explicitly Deferred Scope

- **Structural vs Active Influence:** Graph reachability (`structural_graph_reachability_only`) never implies active event manifestation or domain deliverability (deferred to `K05`, `K07`, `K08`).
- **Explicitly Deferred (Governing `K01`–`K10` Architecture):** Canonical Strength Engine, `K05 — Interaction Intelligence` (Yoga/Dosha cancellation & Neecha-Bhanga net synthesis), `K06 — Structural Intelligence`, `K07 — Conflict Intelligence`, `K08 — Deliverability Intelligence`, `K09 — Temporal Intelligence` (temporal graph projection for Dasha/Gochar/KP Ruling Planets), `K10 — Adjudication Intelligence`, `T01`–`T08` (Temporal Engines), `REFINE`, scalar `PHI`/`AHI`/`PAI`/`YSI`/`DSI` indices, commercial provider acquisition, and consumer dashboards.
