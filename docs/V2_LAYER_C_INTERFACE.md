# Cosmic Council V2 — Layer C Analytical Interface Specification (`v2.layer_c_input.1.0`)

> **Scope Boundary:** This document specifies the stable, read-only input contract exposed by the V2 Foundational Birth Chart Engine (`server/services/v2Engine/`) to the upcoming **Layer C Analytical Intelligence** layer (`PHI`, `YSI`, `DSI`, `Ascendant / Lagnesh Health`, `House Intelligence`, and `Timing Convergence`).
>
> Layer C scoring weights, thresholds, and domain formulas remain strictly **`deferred_by_scope`** (`LayerCAnalyticalShell.status === 'deferred_by_scope'`) in this foundational phase.

---

## 1. Entry Point & Cloudflare Workers Safety

- **Module:** `server/services/v2Engine/layerCContract.ts` (re-exported via `server/services/v2Engine/index.ts`)
- **Primary Builder:** `prepareLayerCAnalyticalInput(source: CompiledV2FoundationalChartResult | LayerBMasterChartRecord): LayerCAnalyticalInput`
- **Prerequisite Guard:** `assertLayerCPrerequisites(input: LayerCAnalyticalInput, domain: LayerCAnalyticalDomain): { ok: boolean; reasons: string[] }`
- **Trust Helpers:** `isUsableForLayerC(state, { allowProvisional? })`, `isBlockedForLayerC(state)`
- **Runtime Safety:** 100% pure TypeScript with zero Node built-ins (`fs`, `path`, `os`, `child_process`, `process.exit`). Safe for both Cloudflare Workers edge runtime and Node.js.

---

## 2. Structural Separation Guaranteed by `LayerCAnalyticalInput`

| Field | Temporal / Epistemic Role | Layer C Rule |
| :--- | :--- | :--- |
| `canonicalBirthInstant` | `natal_invariant` | Single source of truth for UTC ISO, JD UT, IANA timezone, historical offset, coordinates, and `lahiriAyanamsaApproxDeg` / `kpAyanamsaApproxDeg`. |
| `calculationConventions` | Configuration metadata | Separates identifier (`ayanamsa.vedic: 'lahiri'`) from numerical degrees (`ayanamsa.vedicValueDegrees`), node mode, Bhava Chalit basis (`sripati_midpoint_chalit`), D4/D5 methods, and Shadbala convention (`bphs_6.5_sun_rupas_reference`). |
| `natalInvariant` | `natal_invariant` | Contains strictly separated frames (`vedicLahiri`, `kpPlacidus`, `bhavaChalit`, `westernTropical`, `astronomicalTelemetry`), `shadbalaReconciliation`, `localModules`, and normalized `providerExtendedDatasets`. Never contains transit or reference-date dasha state. |
| `referenceDateTiming` | `reference_date_dependent` | Contains ONLY query-date-dependent snapshots (`referenceDateIso`, `activeVimshottari`, `activeAlternativeDashas`, `kpRulingPlanets`, `westernProfections`). Must never be persisted as invariant natal truth. |
| `datasetManifest` | Completeness & provenance | Canonical 6-state status per dataset (`available`, `internally_verified`, `independently_validated`, `provisional`, `incompatible`, `unavailable`) + `downstreamGuardSummary`. |
| `epistemicTrustBoundary` | Trust gate | Lists usable, provisional, and blocked states plus `externalValidationAchieved` and `externalValidationBlockers`. |
| `readinessSummary` | Per-domain readiness | Pre-evaluates readiness and graceful degradation mode for every Layer C module. |

---

## 3. Epistemic State Policy for Layer C Consumers

1. **Blocked (`unavailable`, `incompatible`):**
   - Layer C MUST NOT treat `unavailable` or `incompatible` datasets as valid zero-valued inputs (Zero-Coercion Guardrail).
   - Example: If `bhava_chalit` is `incompatible` (e.g. KP Placidus start-cusp confusion) or `vimshopaka_bala` is `unavailable`, `assertLayerCPrerequisites` returns `{ ok: false, reasons: [...] }`.
2. **Provisional (`provisional`):**
   - May only be consumed when explicitly opted in (`allowProvisional: true`) and must surface methodological uncertainty downstream.
   - Example: `advanced_avasthas` (`Sayanaadi`/`Lajjitadi` awaiting fuller BPHS reconciliation), `shadbala_reconciliation` (while `authoritativeDesignation === 'unassigned_pending_reconciliation'`), or D5 Panchamsha (`calibrated: false`).
3. **Usable Foundational States (`available`, `internally_verified`, `independently_validated`):**
   - `internally_verified`: Verified against CosmicCouncil's internal astronomical/BPHS solvers and/or cross-provider mathematical invariants (e.g., Local Ashtakavarga, Trikona/Ekadhipatya Reductions, Panchadha Maitri, Sripati Bhava Chalit).
   - `independently_validated`: Strictly reserved for datasets reconciled against an external classical reference (`JHora`, `PyJHora`, or `Swiss Ephemeris`). Internal solvers never self-promote to `independently_validated`.

---

## 4. Downstream Analytical Domains (`LayerCAnalyticalDomain`)

| Domain Key | Required Prerequisites (`downstreamGuardSummary`) | Degradation Policy When Blocked |
| :--- | :--- | :--- |
| `phi_planetary_health` | `canonical_birth_instant`, `vedic_d1_positions`, `vedic_d9_navamsa`, `shadbala_major_6`, `planetary_dignity_conditions`, `panchadha_maitri`, `vimshopaka_bala` | `withhold_or_return_insufficient_evidence` |
| `ascendant_lagnesh_health` | `canonical_birth_instant`, `vedic_d1_positions`, `vedic_d9_navamsa`, `bhavabala`, `ashtakavarga_bav_sav_prastara` | `withhold_or_return_insufficient_evidence` |
| `ysi_yoga_strength` | `vedic_d1_positions`, `vedic_d9_navamsa`, `parashari_yogas_doshas`, `shadbala_major_6` | `withhold_or_return_insufficient_evidence` |
| `dsi_dosha_strength` | `vedic_d1_positions`, `vedic_d9_navamsa`, `parashari_yogas_doshas`, `bhava_chalit` | `withhold_or_return_insufficient_evidence` |
| `house_intelligence` | `vedic_d1_positions`, `bhavabala`, `bhava_chalit`, `ashtakavarga_bav_sav_prastara`, `kp_placidus_cusps_sublords`, `kp_significators` | `withhold_or_return_insufficient_evidence` |
| `temporal_activation` | `canonical_birth_instant`, `vimshottari_natal_timeline`, `reference_date_dasha_snapshot` | `withhold_or_return_insufficient_evidence` |

---

## 5. Conventions Preserved Explicitly for Layer C

- **Ayanamsha:** `calculationConventions.ayanamsa.vedic` (`'lahiri'`) paired with `calculationConventions.ayanamsa.vedicValueDegrees` (`number | null`), checked numerically against `canonicalBirthInstant.astronomy.lahiriAyanamsaApproxDeg`.
- **Node Convention:** `calculationConventions.nodeConvention` (`requested` vs `vedicObserved`, flagging AstroWay's `ChartInput` nodeType omission) and explicit separation of `Rahu`/`Ketu` from 7-classical-planet audits in `supplementaryIntegration`.
- **House Systems:** Strict non-conflation of Whole Sign (`parashari`), Placidus (`kp`), and Sripati midpoint (`bhavaChalit`).
- **Vimshottari Dasha:** Fractional `birth_balance.remaining_years` (`years + months/12 + days/365.2425`) and 5-level `mahadasha -> antardasha -> pratyantardasha -> sookshma -> prana` hierarchy separated into `natalTimeline` vs `referenceDateSnapshot`.
