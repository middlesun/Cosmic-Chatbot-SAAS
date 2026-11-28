# Shadbala & Bhavabala Technical Issue Register

> **Status:** Locked Pre-K03/K04 Provenance & Discrepancy Register  
> **Scope Boundary:** This register locks the **8 unresolved Shadbala, Bhavabala, Nodal, and Dasha discrepancies** identified during Foundational Chart Engine V2 verification. It does **not** implement a Canonical Strength Calculation Engine yet and preserves all original provider observations without averaging or silent replacement.
>
> **Epistemic Discipline:** Verified code/fixture observations are kept strictly separate from **Unverified Hypotheses**. No proposed methodological explanation may be treated as established truth until independently reconciled against external classical references (`JHora`, `PyJHora`, and `Swiss Ephemeris`).

---

## 1. Mandatory Preservation, Provisional Gating & Fixture Privacy Rules

1. **Non-Destructive Evidence Preservation (`K01` / `K02`):**
   - Original provider Shadbala totals (`SHADBALA_MAJOR_SIX_BALA`), Shadbala subcomponent buckets (`SHADBALA_SUBCOMPONENT_BUCKET`: `sthana`, `dig`, `kala`, `cheshta`, `naisargika`, `drik`), Ishta & Kashta Phala (`ISHTA_KASHTA_PHALA`), Ashtakavarga derivatives (`ASHTAKAVARGA_PRASTARA`, `ASHTAKAVARGA_BHINNA_BAV`, `ASHTAKAVARGA_SARVA_SAV_SIGN`, `ASHTAKAVARGA_SHODHANA_PINDA`), and divisional observations (`VEDIC_VARGA_PLACEMENT` D1–D60) are **always preserved** in `AnalyticalEvidenceRepository.natalEvidence`.
   - Overlap deduplication in `K02` (`phiPreparation.ts`) prevents double-counting in `PhiReadyPlanetProjection` **without erasing or mutating** underlying `CanonicalEvidenceObject` records or provider subcomponents.
2. **Provisional Gating of `shadbala_major_6` and `bhavabala`:**
   - `shadbala_major_6` remains explicitly **`provisional`** in `datasetManifest.ts` (`deriveCanonicalDatasetState(shadbalaReconciliation)` stays `provisional` while `authoritativeDesignation === 'unassigned_pending_reconciliation'`).
   - `bhavabala` remains explicitly **`provisional`** in `datasetManifest.ts` (and **`unavailable`** if fewer than 12 finite house totals are present).
   - **Downstream Consumer Constraint:** Neither `shadbala_major_6` nor `bhavabala` may be treated as decisive single-source authority or fed into premature numeric aggregation (`PHI`/`YSI`/`DSI`/House Strength scalar totals) until resolved by external validation or governed explicitly under K03 authority gates.
3. **Offline Fixture Personal Data Restriction:**
   - `scripts/fixtures/astroway-chris4-sanitized.json` and `scripts/fixtures/v2-offline-verification-fixtures.json` strip account identifiers (`user_id`, `profile_id`, `email`, `uuid`), **but exact birth dates, birth times, and geographic coordinates remain personal data**.
   - These fixtures MUST stay strictly outside `public/` and `dist/` (never served via static assets or Cloudflare Workers `ASSETS`) and remain restricted to private offline repository verification.
   - `real_astroway_chris4` (raw 72-endpoint AstroWay capture with `preferLocalAshtakavarga: false`) is **never silently substituted** by `real_astroway_chris4_hybrid_local_av` (`preferLocalAshtakavarga: true`).

---

## 2. The 8 Unresolved Discrepancies & Suspected Defects

### Issue #1 — AstroWay Bhava Midpoint (`madhyaLon`) and Kendradi Bala Discrepancy
- **Status:** Unresolved Computational & Methodological Discrepancy (`bhavabala` = `provisional`)
- **Verified Code & Fixture Observations (`Chris 4`: 1985-12-25 04:33:00 IST, `23.25572, 87.85691`):**
  - Sidereal Ascendant (`chart_sidereal`) = `225.1875°` (Scorpio); Whole-Sign houses place `Sun` (`249.44°`) in H2 (`30V` classical Kendradi), `Moon` (`43.42°`) in H7 (`60V`), and `Mars` (`192.60°`) in H12 (`15V`).
  - Sripati Bhava Chalit (`computeLocalSripatiBhavaChalit`) also places `Sun` in H2 (`30V`), `Moon` in H7 (`60V`), and `Mars` in H12 (`15V`).
  - AstroWay `/vedic/shadbala/sthana` (`shadbala_sthana`) reports `kendradi`: `Sun = 60`, `Moon = 15`, `Mars = 30`, matching **Placidus start-cusp house boundaries** (`Sun` in H1, `Moon` in H6, `Mars` in H11).
  - AstroWay `/vedic/bhavabala` (`bhavabala`) reports House 1 with `madhyaLon = 240.34°`, `sign = 8` (Sagittarius), `lord = 5` (Jupiter), `bhavadhipatiBala = 329.93` (Jupiter's Shadbala total), `bhavaDigBala = 60`, `bhavaDrishtiBala = 10.67`, `totalVirupas = 400.59`, whereas the Sidereal Ascendant is `225.1875°` (Scorpio, ruled by Mars whose Shadbala total is `464.43` virupas — a `134.50` virupa swing on `bhavadhipatiBala`).
- **Unverified Hypothesis:** AstroWay may be computing Bhava `madhyaLon` as the midpoint `(cusp[i] + cusp[i+1]) / 2` between Placidus cusps (producing `~240.34°` Sagittarius for House 1 instead of treating Ascendant `225.19°` as House 1 Bhava Madhya per Sripati) and assigning `kendradi` from Placidus cusp intervals rather than Whole Sign or Sripati Bhava boundaries. Requires independent inspection of AstroWay internals / JHora comparison.

### Issue #2 — PyJHora Suspected Dig Bala Angular Wrapping Defect
- **Status:** Unverified External Defect Hypothesis (`externalValidationAchieved = false`)
- **Verified Code & Fixture Observations:**
  - On `Chris 4`, AstroWay `/vedic/shadbala/dig` and FreeAstroAPI `shadBalaSummary` agree across all 7 planets (`Sun = 24.27`, `Moon = 32.94`, `Mars = 43.21`, `Mercury = 58.58`, `Jupiter = 37.35`, `Venus = 33.68`, `Saturn = 1.48`), and match `shadbalaReconciliation.ts` `digBalaPlacidus` to `0.00` delta (`digBalaProviderVsPlacidus === 0` on all 7 planets).
  - `shadbalaReconciliation.ts` `digBalaEqual90` differs by `±2.35V` on Sun/Moon/Mars/Venus because `Chris 4` Placidus MC = `142.24°` (`h10`) vs `Asc + 270° = 135.19°`.
  - No audited PyJHora chart fixture with Dig Bala subcomponents is currently present in-repo.
- **Unverified Hypothesis:** An external PyJHora Dig Bala calculation has been suspected of a `0° / 360°` angular wrapping defect (e.g., failing to take shortest modular arc across `360°` when computing distance from `digBala`-powerless cusp), which could also explain why AstroWay OpenAPI marks several reference checks open against PyJHora. Exact PyJHora version, affected formula lines, and chart conditions remain unverified pending direct external PyJHora + JHora + Swiss Ephemeris audit.

### Issue #3 — Luminary Cheshta Bala Conventions (`Sun` & `Moon`)
- **Status:** Unresolved Methodological Convention Split (`provisional`)
- **Verified Code & Fixture Observations:**
  - On `Chris 4`:
    - AstroWay `/vedic/shadbala/full` and `/vedic/shadbala/cheshta` return `Sun cheshta = 0`, `Moon cheshta = 0`.
    - AstroWay `/vedic/shadbala/ishta-kashta` simultaneously uses `Sun cheshtaBala = 58.9676`, `Moon cheshtaBala = 51.3272` annotated `cheshtaFrom: "BPHS 28.4 kendra"`.
    - FreeAstroAPI `shadBalaSummary` returns `Sun cheshta_bala = 1.03`, `Moon cheshta_bala = 51.33`.
    - Legacy local `jyotishMath.ts` returns `Sun chestaBala = 1.9`, `Moon chestaBala = 51.3`.
  - `shadbalaReconciliation.ts` (`cheshtaBalaZeroLuminaries`) detects `zeroLuminaryCheshtaDetected === true` on AstroWay `Chris 4`.
- **Unverified Hypothesis:** Providers appear split between (a) strict Tara-Graha convention (`Cheshta = 0` for non-retrograding luminaries) and (b) B.V. Raman / BPHS 28.4 Ayana/Paksha/Kendra proxy (`Sun ≈ Ayana`, `Moon ≈ Paksha`), while geometric `sqrt(Uchcha * Cheshta)` Ishta Phala collapses to `0` if `Cheshta = 0` is substituted directly. Reconciliation against classical texts & JHora/PyJHora is unverified.

### Issue #4 — Kala Bala Conventions & Subcomponent Rollup
- **Status:** Unresolved Computational & Methodological Discrepancy (`provisional`)
- **Verified Code & Fixture Observations:**
  - AstroWay `/vedic/shadbala/kala` exposes 6 fields (`nathonnatha`, `paksha`, `tribhaga`, `abdaMasaVaraHora`, `ayana`, `yuddha`), rolling Abda, Masa, Vara, and Hora into a single combined `abdaMasaVaraHora` bucket.
  - AstroWay OpenAPI `v2.383.19` caveats (surfaced in `shadbalaReconciliation.ts:713-716`) explicitly note that Abda/Masa lords and Yuddha Bala remain open vs PyJHora 62-chart reference validation.
  - On `Chris 4`, AstroWay vs FreeAstroAPI Kala Bala totals diverge substantially across planets (e.g., `Sun`: `109.72V` vs `118.12V`; `Moon`: `168.16V` vs `110.05V`; `Mars`: `163.36V` vs `92.41V`; `Venus`: `76.56V` vs `145.56V`).
- **Unverified Hypothesis:** Divergences likely involve sunrise vs midnight weekday/Vara rollover (especially pre-sunrise births like `Chris 4` at `04:33 IST`), apparent vs mean solar noon for Natonnata Bala, Tribhaga nocturnal 3-part vs 4-part indexing, Abda/Masa Ahargana basis, and Yuddha Bala adjustment conventions. Unverified until subcomponents are independently audited against JHora/PyJHora.

### Issue #5 — Sun Minimum Strength Requirement (`5.0` vs `6.5` Rupas)
- **Status:** Unresolved Classical Threshold Discrepancy (`thresholdReversals` tracked)
- **Verified Code & Fixture Observations:**
  - `shadbalaReconciliation.ts` (`BPHS_CLASSICAL_MIN_RUPAS`) and `ruleRegistry.ts` (`BPHS_SHADBALA_MIN_RUPAS`) record classical BPHS minimum strength for Sun as **`6.5` Rupas (`390` Virupas)**.
  - FreeAstroAPI `shadBalaSummary.Sun.minimum_requirements` and legacy `jyotishMath.ts` use **`5.0` Rupas (`300` Virupas)**.
  - `shadbalaReconciliation.ts` tracks `ratioAt5_0Threshold`, `ratioAt6_5Threshold`, and `flipsPassFailStatus`.
- **Unverified Hypothesis:** Modern software implementations frequently emit `5.0` Rupas for the Sun (possibly copying Mars/Saturn thresholds or a B.V. Raman print/errata tradition) instead of the `6.5` Rupas BPHS standard. Exact textual provenance of the `5.0R` convention in external libraries has not yet been independently audited.

### Issue #6 — Bhavabala Dependencies (`shadbala_major_6` + Bhava Madhya Basis)
- **Status:** Unresolved Compound Dependency (`bhavabala` = `provisional`)
- **Verified Code & Fixture Observations:**
  - `bhavabala` sums `bhavadhipatiBala + bhavaDigBala + bhavaDrishtiBala`.
  - Consequently, House `i` Bhavabala inherits **both** (a) every upstream discrepancy inside the sign lord's Shadbala total (`bhavadhipatiBala`), and (b) the Bhava Madhya cusp definition (`Issue #1`: `madhyaLon = 240.34°` Sagittarius / Jupiter `329.93V` vs Scorpio / Mars `464.43V` on Chris 4 H1).
  - AstroWay OpenAPI marks `/vedic/bhavabala` with `x-quality = yellow` because PyJHora Bhava Bala reference could not be used; `datasetManifest.ts` locks `bhavabala` to `'provisional'` (`'unavailable'` if `< 12` houses).
- **Unverified Hypothesis:** Resolving Bhavabala requires upstream resolution of both Issues #1 (Bhava Madhya / cusp convention) and #3/#4 (Shadbala lord totals), plus independent Bhava Drishti Bala verification.

### Issue #7 — True Node vs Mean Node Calculation Discrepancy (`Rahu` / `Ketu`)
- **Status:** Unresolved Provider Methodology Omission & Ephemeris Split
- **Verified Code & Fixture Observations:**
  - On `Chris 4`:
    - FreeAstroAPI reports Mean Node `Rahu = 12.5352°` Aries (`Ashwini` Pada 4).
    - AstroWay `chart_sidereal` returns `name: "true Node"`, `lon = 14.2818°` Aries (`Bharani` Pada 1), a **`+1.7466°` delta** that shifts both Nakshatra and Pada (`Ashwini P4` vs `Bharani P1`) and KP Star Lord (`Ketu` vs `Venus`).
    - AstroWay OpenAPI `ChartInput` schema omits a `nodeType` (`mean` vs `true`) selector, surfaced via `calculationConventions.nodeConvention` (`requested` vs `vedicObserved`).
  - `supplementaryCompatibility.ts` and `K02` `NodalConditionProfile` isolate `Rahu`/`Ketu` from 7-planet Ashtakavarga, Shadbala, and Sripati cusp checks while recording `nodeCalculationConvention`.
- **Unverified Hypothesis:** When `Rahu`/`Ketu` sit near Nakshatra or Navamsa boundaries, unconfigurable `true Node` vs `mean Node` switches (`±1.5°–1.8°`) invert star-lord/sub-lord and D9 placements. Whether AstroWay exposes an undocumented parameter or hardcodes True Node globally remains to be verified with the provider.

### Issue #8 — Vimshottari Year-Length Conventions & Timestamp Precision
- **Status:** Unresolved Precision & Calendar Convention Split
- **Verified Code & Fixture Observations:**
  - `astrowayNormalizer.ts` (`159, 167, 217, 311`) and `jyotishMath.ts:711` (`MS_PER_YEAR`) normalize Dasha durations using **`365.2425` days/year** (Gregorian mean year).
  - `jyotishMath.ts:5391, 5417, 5420` and Hellenistic profections (`astrowayEval.ts:854, 863`) use **`365.2422` days/year** (tropical year).
  - Classical Jyotish texts also specify **Savana (`360` days/year)** or **Sidereal (`365.25` / `365.25636` days/year)** conventions (`normalizer.ts:1916, 2575`).
  - AstroWay `/vedic/dashas/vimshottari/prana` `initial` returns integer `balanceYears: 7, balanceMonths: 5, balanceDays: 7` alongside floating `elapsedYears: 2.563021437021277`, date strings formatted to minute/day granularity alongside `julianDay`, while `/chart` omits `returnedUtcInstant` (tracked via `ephemerisTimestampCheck` in `astrowayEval.ts`).
- **Unverified Hypothesis:** Multi-decade Dasha boundary drift (especially at `Sookshma` and `Prana` sub-levels, where 100+ years of `360` vs `365.2425` vs `365.25636` accumulates significant offset) and integer-day vs continuous instant rounding require external verification against JHora / Swiss Ephemeris settings before locking a single canonical year-length standard.
