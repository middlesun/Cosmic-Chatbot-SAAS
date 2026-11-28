# Cosmic Council — Birth Chart Data Extraction Architecture

> **Scope:** Complete technical architecture covering both the **active Production (V1) Birth Chart Extraction Pipeline** and the **Isolated V2 Foundational Birth Chart Engine** (`server/services/v2Engine/`).  
> **Isolation Status:** The V2 Foundational Engine is strictly isolated from customer-facing routes (`profiles`, `chat`, `reports`, `apps`), production DB schemas, and existing `chartCompiler.ts` / `astrologyApi.ts` / `jyotishMath.ts` flows. Layer C proprietary analytical scoring (`PHI`, `YSI`, `DSI`, `Ascendant / Lagnesh Health`, `House Intelligence`, `Timing Convergence`) remains **`deferred_by_scope`** inside V2.

---

## 1. High-Level Architectural Overview

Cosmic Council currently houses **two distinct birth-chart extraction pipelines**:

1. **Production V1 Pipeline (Active Customer Traffic)**
   - Triggered on profile creation/activation, missing `chart_json` inspection, chat turns requiring activation, and report generation.
   - Calls a switchable primary provider (`freeastrologyapi` on `json.freeastrologyapi.com` [default] or `freeastroapi` on `api.freeastroapi.com`), computes divisional charts, KP cusps, Jaimini, Ashtakavarga, Shadbala, Yogic conditions, Lal Kitab, and Western Tropical data locally in `server/services/jyotishMath.ts` via `server/services/chartCompiler.ts`.
   - Persists `chart_json` (`CompiledChartData`), `chart_text_context`, and `natal_truth_dossier_json` (`CURRENT_NATAL_DOSSIER_VERSION = 2`) into Supabase `public.profiles`.
   - Daily transits are cached globally once per UTC day in `public.daily_transits`.

2. **Isolated V2 Foundational Engine (Diagnostic Lab & Next-Gen Foundation)**
   - Located exclusively in `server/services/v2Engine/` (20 pure-TypeScript modules, 100% Cloudflare Workers safe) + Admin Lab endpoints (`/api/admin/v2-diagnostics/*`) + CLI verifier (`scripts/verifyV2Engine.ts`).
   - Built around a strict **5-layer separation**:
     - **Layer 0 (`CanonicalBirthInstant`):** Single authoritative UTC/JD/GMST/LMST/DST-verified instant without silent UTC fallback.
     - **Layer A (`LayerARawProviderRecord`):** Sanitized, secret-redacted raw API payloads across AstroWay primary (`64`-endpoint pruned plan) + FreeAstroAPI targeted `1`-call supplement, plus Mode A vs Mode B timezone equivalence verification.
     - **Layer B (`LayerBMasterChartRecord` — `v2.master.1.0`):** Strictly separated **4 coordinate frames** (`vedicLahiri`, `kpPlacidus`, `bhavaChalit`, `westernTropical`) + `astronomicalTelemetry`, separated by `temporalScope` (`natal_invariant` vs `reference_date_dependent`).
     - **Phase 3 & 4:** Non-overwriting compatibility gates for FreeAstroAPI supplementary data (`Ashtakavarga`, `Bhava Chalit`, `D5 Panchamsha`) + 8 deterministic local BPHS modules wrapped in provenance-tagged `DatasetEnvelope`s.
     - **Phase 5 (`CompiledV2FoundationalChartResult` — `v2.compiled_foundational_chart.1.0`):** Consolidated compiler, independent Meeus/Placidus/Sripati verifier (`verifier.ts`), and 6-state `DatasetCompletenessManifest` (`v2.manifest.1.0`) feeding a read-only `LayerCAnalyticalInput` contract (`v2.layer_c_input.1.0`).

```text
================================================================================
                    COSMIC COUNCIL BIRTH CHART EXTRACTION
================================================================================

  [A] PRODUCTION V1 PIPELINE (Customer Traffic — profiles / chat / reports)
  ------------------------------------------------------------------------
  Profile Birth Input (Date, Time, City/State/Country or Lat/Lng)
     │
     ▼  server/routes/{profiles,chat,reports}.ts ──> compileBirthChart()
  1. Geocode & Historical TZ ──> astrologyApi.ts (FreeAstrologyAPI /geo-details,
     │                            Open-Meteo, Photon, Nominatim, Intl tzdb)
     ▼
  2. External Ephemeris Call ──> fetchChartFromApi() via registry.ts
     ├─ Default: json.freeastrologyapi.com (/planets/extended, /shad-bala/summary, /western/planets)
     └─ Switchable: api.freeastroapi.com  (/api/v2/vedic/calculate, /api/v1/natal/calculate)
     │  [1 req/sec rate limit: isolate queue or Supabase CAS freeAstroApiRateLimiter.ts]
     ▼
  3. Local Vedic/KP/Western  ──> jyotishMath.ts + chartCompiler.ts
     │  (D1..D60 Vargas, KP Placidus cusps, Jaimini, Ashtakavarga, Shadbala, Lal Kitab, Western)
     ▼
  4. Dossier + LLM Context   ──> natalDossier.ts (Layer A deterministic + Layer B kernel + Western)
     │                            + formatChartForLLM() -> compact Vedic/Western JSON
     ▼
  5. Supabase Persistence    ──> public.profiles (chart_json, chart_text_context, natal_truth_dossier_json)
                                 Downstream: contextSlicer.ts / westernContextSlicer.ts (runtime slicing)

================================================================================
                       STRICT ISOLATION BOUNDARY (ZERO CUTOVER)
================================================================================

  [B] ISOLATED V2 ENGINE (Admin Lab / CLI — server/services/v2Engine/)
  --------------------------------------------------------------------
  CanonicalBirthInput (YYYY-MM-DD, HH:MM[:SS], Lat/Lng, IANA TZ, DST fold, nodeConvention)
     │
     ▼  Layer 0: birthInstant.ts ──> resolveCanonicalBirthInstant()
  CanonicalBirthInstant (UTC ISO, JD UT, GMST, LMST, Obliquity, Approx Lahiri/KP, SHA-256 fingerprint)
     │
     ├──► Layer A (Primary Foundation): astrowayEval.ts + astrowayCoordinator.ts
     │      64-endpoint Pruned Plan on api.astroway.info/v1 (10 req/60s global KV window, resumable batches)
     │      + Mode A (local+IANA) vs Mode B (UTC) timezone equivalence probe
     │
     ├──► Layer A (Supplementary 1-Call): acquisition.ts (/api/v2/vedic/calculate)
     │      or Standalone 4-Call FreeAstroAPI Bundle (vedic/calculate, vedic/kp, natal/calculate, ephemeris)
     │
     ▼  Layer B: normalizer.ts + astrowayNormalizer.ts + shadbalaReconciliation.ts
  LayerBMasterChartRecord (v2.master.1.0)
     ├─ 4 Strictly Isolated Frames: vedicLahiri | kpPlacidus | bhavaChalit | westernTropical
     ├─ Astronomical Telemetry + 5-Level Vimshottari (Prana) + Alternative Dashas + Shadbala Subcomponents
     ├─ Temporal Separation: natal_invariant vs reference_date_dependent
     │
     ├──► Phase 3: supplementaryCompatibility.ts (Non-overwriting gates: Ashtakavarga, Bhava Chalit, D5)
     ├──► Phase 4: localAshtakavarga.ts + localVedicMath.ts (8 deterministic local DatasetEnvelopes)
     ├──► Phase 5: verifier.ts (Meeus/Placidus/Sripati) + datasetManifest.ts (6 canonical states, 3 tiers)
     │
     ▼  compiler.ts ──> compileV2FoundationalChart()
  CompiledV2FoundationalChartResult (v2.compiled_foundational_chart.1.0)
     ├─ layerCShell: { status: 'deferred_by_scope' }
     └─ Read-Only Boundary: layerCContract.ts ──> prepareLayerCAnalyticalInput() (v2.layer_c_input.1.0)
```

---

## 2. Production V1 Birth Chart Extraction Pipeline

### 2.1 Trigger Entry Points & Persistence
Production compilation is orchestrated through `compileBirthChart()` and `enrichCompiledChart()` in `server/services/chartCompiler.ts`, invoked at:
- **`server/routes/profiles.ts`**: Auto-compiles unactivated profiles (`!is_activated || !chart_json`) on inspection (`GET`), profile creation/updates, and auto-enriches legacy `chart_json` on read when newer fields (`D27`, `D40`, `D45`, `shadbala`, `western.hellenistic`, `planetaryHealth`, etc.) or `CURRENT_NATAL_DOSSIER_VERSION = 2` are missing.
- **`server/routes/chat.ts`** & **`server/routes/reports.ts`**: Lazily compiles unactivated profiles before running consultations or multi-pass reports.
- **`server/workers/reportWorker.ts`**, **`server/routes/apps.ts`**, **`server/services/miniAppsCatalog.ts`**, **`server/services/divinationEngines.ts`**, and **`server/services/timingRadar.ts`**: Run deterministic `enrichCompiledChart()` to upgrade stored charts in-memory/DB without extra external API calls.

Persisted columns in `public.profiles`:
- `latitude`, `longitude`, `timezone_offset`
- `chart_json` (`CompiledChartData`)
- `chart_text_context` (compact `VERIFIED CANONICAL VEDIC CHART JSON:...` generated by `formatChartForLLM()`)
- `natal_truth_dossier_json` & `natal_dossier_version` (built by `server/services/natalDossier.ts`)
- `is_activated`, `activated_at`

*(Egress Rule: List/sidebar endpoints must never `select('*')` on heavy JSON/text columns like `chart_json` or `chart_text_context`.)*

### 2.2 Geocoding & Historical Timezone Resolution (`server/services/astrologyApi.ts`)
When latitude/longitude are missing, `geocodeBirthLocation()` executes a multi-source cascade:
1. If active provider (`platformSettings.ts` `getBirthChartConversionConfig()`) is `freeastroapi` and `FREE_ASTRO_API_KEY` is set: calls `GET /api/v2/geo/search` via `freeAstroApiAdapter.ts`.
2. Else if `FREE_ASTROLOGY_API_KEY` is set: calls `POST /geo-details` on `https://json.freeastrologyapi.com`.
3. Fallback cascade: `searchBirthPlaces()` combining Open-Meteo, Photon, and Nominatim.

`resolveHistoricalTimezoneOffset()` looks up the IANA zone via `https://api.open-meteo.com/v1/forecast?...&timezone=auto` (cached in `coordTzCache`, 1-hour TTL) and evaluates historical offset on `birthDate` + `birthTime` using `Intl.DateTimeFormat` (`computeZoneOffsetHours`).

### 2.3 External Ephemeris Providers (`server/services/astrologyProviders/`)
Provider routing is governed by `server/services/astrologyProviders/registry.ts` and dynamic DB settings (`getBirthChartConversionConfig()`):

| Provider ID | Base URL | Env Key | Status | Endpoints Called in V1 |
| :--- | :--- | :--- | :--- | :--- |
| `freeastrologyapi` *(Default)* | `https://json.freeastrologyapi.com` | `FREE_ASTROLOGY_API_KEY` | `production_default` | `POST /planets/extended`, optional `POST /shad-bala/summary`, `POST /western/planets`, `POST /geo-details` |
| `freeastroapi` | `https://api.freeastroapi.com` | `FREE_ASTRO_API_KEY` | `poc_adapter_ready` | `POST /api/v2/vedic/calculate` (Lahiri, Whole Sign, `node_type: 'mean'`, `vargas: [1]`, `include_shadbala`), optional `POST /api/v1/natal/calculate`, `GET /api/v2/geo/search` |
| `astroway` | `https://api.astroway.info` | `ASTROWAY_API_KEY` | `pending_poc` (`supportsSwitch: false`) | Isolated to V2 engine only |
| `astrology_api_io` | `https://api.astrology-api.io` | `ASTROLOGY_API_IO_KEY` | `pending_poc` (`supportsSwitch: false`) | Not active |

**Rate Limiting:**
- `freeastrologyapi` uses an isolate-local promise-chain queue (`scheduleRateLimited`, `FREE_ASTROLOGY_RATE_MS` default `1100ms`, 2 retries on HTTP `429`).
- `freeastroapiAdapter.ts` uses the distributed coordinator `coordinateFreeAstroApiSlot()` (`server/services/astrologyProviders/freeAstroApiRateLimiter.ts`), which enforces `1150ms` minimum spacing across concurrent isolate calls **and** separate Cloudflare Worker isolates via optimistic CAS leases on `public.platform_settings` (`key = 'rate_limit:freeastroapi'`) with global `429 Retry-After` backoff propagation.

### 2.4 Local Enrichment & Derived Models (`chartCompiler.ts` + `jyotishMath.ts`)
Once raw sidereal planet longitudes (`Ascendant`, `Sun`–`Ketu`) are normalized with `SIGNS`, `getNakshatraAndSubs()`, Whole-Sign house numbers, and `getDignity()`, `compileBirthChart()` computes all secondary layers deterministically:
- **16 Vargas (`computeDivisionalCharts`):** `D1`, `D2`, `D3`, `D4`, `D7`, `D9`, `D10`, `D12`, `D16`, `D20`, `D24`, `D27`, `D30`, `D40`, `D45`, `D60`.
- **KP System:** `computeKPPlacidusCusps()`, `computeKPSignificators()`, `computeKPRulingPlanets()`.
- **Jaimini:** `computeJaiminiKarakas()` (Karakamsha sign) + `computeExtendedJaimini()` (`arudhaPadas`, `charaDasha`, `argala`).
- **Ashtakavarga:** `computeAshtakavarga(planets)` (Bhinna + Sarva).
- **Vimshottari:** `computeVimshottariTimeline()` (active MD/AD/PD stack + progress % + Sandhi warning).
- **Strength, Conditions & Points:** `computeShadbala()`, `computePanchangAndAvakhada()`, `computePlanetaryConditions()`, `computeMajorYogas()`, `computeLalKitab()`, `computeSpecialVedicPoints()` (Indu Lagna, Shri Lagna, 64th Navamsa, 22nd Drekkana), `computeBhavaChalitShifts()`, `computeAscendantMaturity()`, `computeStructuralFlagsAndDoshas()` (Badhaka, Kendradhipati, Doshas), `computePlanetaryHealthIndex()`, `computeScoredYogaRegistry()` (`YSI`), `computeDispositorChain()`.
- **Western Tropical:** `computeWesternChart()` (using `apiWesternPlanets` if present, otherwise deterministic Tropical conversion + KP cusps, sect, mutual receptions, dispositor trees, aspect configurations, Hellenistic data).

### 2.5 Natal Truth Dossier, Runtime Slicing & Daily Transits
- **`server/services/natalDossier.ts` (`CURRENT_NATAL_DOSSIER_VERSION = 2`):**
  - `buildNatalTruthDossierLayerA()`: 100% deterministic JSON audit (`NatalTruthDossierLayerA`) capturing birth-time Sandhi sensitivity, snapshot scores, Lagnesh profile, command hierarchy (powerhouse vs afflicted planets), validated vs suppressed Yogas, dosha offsets, 12-house KP promises (`kp_verdict` + `sav`), special points, and domain pre-audits (marriage, career, wealth, health, foreign).
  - `compileNatalTruthDossier()`: Adds optional LLM-generated `NatalNarrativeKernel` (Layer B in dossier v1/v2) + `buildWesternTruthDossier()` (`WesternTruthDossierV1`).
- **`server/services/contextSlicer.ts` & `westernContextSlicer.ts`:** Slice `CompiledChartData` + `NatalTruthDossier` + active formula cartridges + daily transits at chat time to prevent frontier model attention dilution.
- **Global Daily Transits (`getOrFetchDailyTransits()` in `astrologyApi.ts`):** Checks memory cache → `public.daily_transits` (keyed by `transit_date`) → single daily external fetch (or `computeDeterministicSiderealPlanets()` fallback) → computes `slowTransitPairs` ingress windows and `computeWesternDailyTransits()`.

### 2.6 Known V1 Structural Defects (Documented by V2 Audit Modules)
Identified in `server/services/v2Engine/profileImpactAudit.ts`, `legacyComparison.ts`, `localAshtakavarga.ts`, and `shadbalaReconciliation.ts`:
1. **Epoch / Timezone Drift:** Legacy timezone/UTC fallback paths can introduce large Ascendant/Moon longitude discrepancies when offsets or historical DST are misresolved.
2. **Non-Sequential House Cusps:** Legacy Placidus cusp logic (`computeKPPlacidusCusps`) can emit non-monotonic wraparounds, distorting both KP cusps and Western cusps reconstructed from them.
3. **KP Placidus vs. Bhava Chalit Conflation:** Passing KP Placidus start cusps into `computeBhavaChalitShifts()` treats cusp starts as Sripati Bhava Madhyas, causing false mass shifting (e.g., 8–9/9 planets shifted).
4. **Silent Ashtakavarga Bindu Loss:** `jyotishMath.computeAshtakavarga(planets)` silently drops all `45` Ascendant bindus (`292` total instead of `337`) if callers omit the `'Ascendant'` pseudo-planet entry in `planets[]`.
5. **Conflicting Shadbala Datasets:** Provider `shadBalaSummary` vs local `computeShadbala()` (which uses simplified formulas and natural friendship rather than 5-fold `Panchadha Maitri`) can diverge sharply without reconciliation.

---

## 3. Isolated V2 Foundational Birth Chart Engine (`server/services/v2Engine/`)

Every module inside `server/services/v2Engine/` is pure TypeScript/Web-standard APIs (using `TextEncoder`, `DataView`, `Intl.DateTimeFormat`, `fetch`, `crypto.randomUUID` when available) with **zero** Node built-ins (`fs`, `path`, `os`, `child_process`, `process.exit`), ensuring identical execution in Node CLI (`scripts/verifyV2Engine.ts`) and Cloudflare Workers.

### 3.1 Layer 0: Canonical Birth Instant & Ephemeris Baseline (`birthInstant.ts`)
- **Entry Point:** `resolveCanonicalBirthInstant(input: CanonicalBirthInput): CanonicalBirthInstant`
- **Strict Guards:**
  - Validates calendar dates (`YYYY-MM-DD`) and time precision (`HH:MM[:SS]`) preserving seconds (`BirthInstantValidationError`).
  - **Never silently falls back to UTC (`offset = 0`)** if timezone data is missing (`BirthInstantTimezoneError`: `MISSING_TIMEZONE`, `INVALID_IANA_TIMEZONE`).
  - Explicitly detects **DST spring-forward gaps (`NONEXISTENT_LOCAL_TIME`)** and **DST fall-back folds (`AMBIGUOUS_LOCAL_TIME`)** with candidate occurrences (`earlier` / `later`) via `Intl.DateTimeFormat` zone probing.
- **Outputs:**
  - Exact `utc` components (`iso`, `unixMs`, `julianDayUt` via Meeus UT formula).
  - `astronomy`: `greenwichMeanSiderealTimeDeg` (GMST), `localMeanSiderealTimeDeg` (LMST/RAMC), `meanObliquityDeg`, `lahiriAyanamsaApproxDeg`, and `kpAyanamsaApproxDeg`.
  - Pure FIPS-180-4 Web-safe `inputFingerprint` (SHA-256 hex digest).
  - Mode A (`toModeALocalTimeFields`: local date/time + IANA `tz_str`) and Mode B (`toModeBUtcTimeFields`: UTC date/time + `tz_str: 'UTC'`) request builders.

### 3.2 Layer A: Multi-Provider Acquisition, Secrets & Global Coordination

#### Secret Isolation & Redaction (`secretEnv.ts`)
- Reads `ASTROWAY_API_KEY` and `FREE_ASTRO_API_KEY` solely from server `process.env` (never falls back to production `FREE_ASTROLOGY_API_KEY`).
- Strips `x-api-key`, `authorization`, `proxy-authorization`, `cookie`, and `set-cookie` via `redactHeaders()` and `redactSecretsDeep()` before any response artifact, cache, or diagnostic payload is returned or stored.

#### Primary Provider: AstroWay (`astrowayEval.ts` & `astrowayCoordinator.ts`)
- **Base URL:** `https://api.astroway.info/v1` (OpenAPI `2.383.19`, `X-Api-Key` auth, 10,000 credits/month free tier).
- **Plan Modes (`buildAstroWayChris4Plan`):**
  - `foundational_pruned` *(default — 64 endpoints)*: Prunes 3 strict-subset endpoints (`ASTROWAY_PRUNED_REDUNDANT_ENDPOINTS`):
    1. `ashtakavarga_basic` (`/ashtakavarga`) → superseded by `ashtakavarga_prastara` (`/vedic/ashtakavarga/prastara`)
    2. `kp_cusps` (`/vedic/kp/cusps`) → superseded by `kp_sub_lords` (`/vedic/kp/sub-lords`)
    3. `varga_D1` (`/vedic/varga/D1`) → superseded by `chart_sidereal` (`/chart`) & `vedic_kundli` (`/vedic/kundli`), mirrored canonically into `D1`
  - `full_evaluation`: All 67 endpoints.
- **Endpoint Domains Covered:**
  - `natal_core`: Sidereal `/chart`, Tropical `/chart`, `/vedic/kundli`, `/vedic/panchang/full`
  - `shadbala` & `bhavabala`: `/vedic/shadbala/full` + 6 subcomponent endpoints (`sthana`, `dig`, `kala`, `cheshta`, `naisargika`, `drik`) + `/vedic/shadbala/ishta-kashta` + `/vedic/bhavabala`
  - `yoga_dosha`: `yogas/parashara/full`, `doshas/parashara/full`, `yogas/jaimini/full`, `doshas/kp/full`
  - `jaimini`: All 10 Jaimini endpoints (karakas, chara karakas, padas, upapada, argala, aspects, drishti, atmakaraka navamsa, etc.)
  - `varga`: Shodashavarga `D2`..`D60` (`15` calls in pruned mode; `D1` mirrored)
  - `kp`: `sub-lords`, `significators`, `planet-cuspal-position`, `ruling-planets`, `asc-sub`, `fortuna`
  - `dasha`: 5-level Vimshottari (`prana`) + 5 alternative Dashas (`Chara`, `Yogini`, `Ashtottari`, `Kalachakra`, `Tribhagi`)
  - `upagraha` & `hellenistic_traditional`: `/vedic/upagrahas`, Western `essential-dignities`, `firdaria`, `profections`, Brennan `lots`/`zr`/`profections`
  - `timezone_probe`: Optional Mode A (`local + tz_str`) vs Mode B (`UTC`) verification probe.
- **Note on Tier Restrictions:** Under the free tier, `/vedic/ashtakavarga/prastara` and `/vedic/ashtakavarga/shodhana` return `HTTP 402` (`tier_restricted` — requires Indie plan), triggering FreeAstroAPI supplementary + Local Phase 4 fallback seamlessly.
- **Global Coordinator & Resumable Sessions (`astrowayCoordinator.ts`):**
  - Observed AstroWay limit: `10 req / 60s`.
  - Reads/persists rate window state across Worker isolates in `platform_settings` (`rate_limit:astroway`) parsing `Retry-After` & `x-ratelimit-reset`/`remaining`.
  - Stores resumable multi-batch acquisition sessions (`v2_diag_session:<sessionId>`) with 7-day TTL so Cloudflare Worker invocations can execute bounded batches (e.g., 8–9 requests/batch) across 60s windows without re-calling completed or permanently tier-restricted endpoints.
  - Concurrency Lock (`lock:v2_diagnostic_run` in `freeAstroApiRateLimiter.ts`): Prevents overlapping diagnostic runs (`45s` lease TTL, stale heartbeat recovery).

#### Supplementary / Standalone Provider: FreeAstroAPI (`acquisition.ts`)
1. **Targeted Supplementary Mode (`fetchFreeAstroApiSupplementaryVedicCall`):** Single `POST /api/v2/vedic/calculate` call with `vargas: [1, 5]`, `include_bhava_chalit: true`, `include_ashtakavarga: true` to supply Bhava Chalit, D5 Panchamsha, and BAV/SAV/Prastara alongside AstroWay.
2. **Standalone 4-Call Natal Bundle (`buildAndValidateV2Requests`):**
   - Call 1: `POST /api/v2/vedic/calculate` (Lahiri, Whole Sign, 17 Vargas `[1..60]`, Bhava Chalit, Shadbala, Ashtakavarga, Yogas, Avastha, Panchang, 3-level Dasha)
   - Call 2: `POST /api/v2/vedic/kp` (Const `ayanamsha: 'kp'`, `house_system: 'placidus'`, 4-level significators, sub-sub-lords, ruling planets)
   - Call 3: `POST /api/v1/natal/calculate` (Western Tropical Placidus, outer bodies, asteroids/Chiron/Lilith, declinations, aspects, dominants; explicitly flags V1 schema limitation that `second` is truncated)
   - Call 4: `POST /api/v1/ephemeris/calculate` (Astronomical telemetry: ecliptic latitude, distance AU, exact speed, station/retrograde motion, Moon VoC, sidereal time) + timestamp/Mode A↔B verification.

### 3.3 Layer B: 4-Frame Normalization, Dashas & Shadbala Reconciliation

#### Strict 4-Frame & Temporal Separation (`normalizer.ts` + `astrowayNormalizer.ts`)
`buildLayerBMasterChartRecord()` transforms sanitized Layer A calls into `LayerBMasterChartRecord` (`schemaVersion: 'v2.master.1.0'`) without pruning returned fields or conflating systems:

1. **Frame 1 — `vedicLahiri` (`VedicLahiriFrame`):** Whole-Sign sidereal Rashi positions, Lagna, 16+ Vargas (`D1`–`D60` with `D1` canonically mirrored), Yogas, Doshas, Panchang, Upagrahas, Ashtakavarga, Shadbala, Bhavabala, Ishta/Kashta, and Jaimini Suite.
2. **Frame 2 — `kpPlacidus` (`KpPlacidusFrame`):** Strictly `kp` ayanamsha + Placidus cusps (`1`–`12`), planetary positions, 4-level significators, cuspal sub/sub-sub lords, KP Doshas, Ruling Planets, and Fortuna. Never overwrites Frame 1 or Frame 3.
3. **Frame 3 — `bhavaChalit` (`BhavaChalitFrame`):** Strictly Sripati / Bhava-Madhya Chalit cusps (`bhavaMadhya`, `bhavaSandhiStart`, `bhavaSandhiEnd`) and chalit house placements. Never reconstructed from KP Placidus start cusps.
4. **Frame 4 — `westernTropical` (`WesternTropicalFrame`):** Strictly Tropical zodiac, Placidus cusps, outer bodies, essential dignities, aspects, configurations, Firdaria, Annual Profections, and Hellenistic Lots / Zodiacal Releasing (`Brennan`). Never reconstructed by adding ayanamsha to KP.
5. **`astronomicalTelemetry` (`AstronomicalTelemetryFrame`):** Geocentric speeds, ecliptic latitudes, AU distances, station indicators, and `EphemerisTimestampCheck`.

**Key Normalization Safeguards:**
- **Ayanamsha Identifier vs. Degree (`resolveAyanamshaDescriptor`):** Preserves symbolic identifier (`ayanamsa.vedic: 'lahiri'`) separately from numeric degree (`ayanamsa.vedicValueDegrees`, e.g., `23.66126484739226` returned by AstroWay), checking numerical consistency against `canonicalBirthInstant.astronomy.lahiriAyanamsaApproxDeg` (`±0.04°` tolerance).
- **5-Level Vimshottari & Fractional Birth Balance (`normalizeAstroWayVimshottari5Level`):** Normalizes `mahadasha -> antardasha -> pratyantardasha -> sookshma -> prana`, computing exact fractional `birth_balance.remaining_years` (`years + months/12 + days/365.2425`) when providers return integer Y/M/D fields.
- **Temporal Scope Separation:** Every dataset is tagged `temporalScope: 'natal_invariant' | 'reference_date_dependent'`. Active Dasha pointers, Ruling Planets, and Western Profections live exclusively in `referenceDateTiming` (`ReferenceDateTimingSnapshot`) and never pollute natal-invariant structures.

#### Shadbala Reconciliation (`shadbalaReconciliation.ts`)
Compares provider-native Shadbala (`AstroWay` / `FreeAstroAPI`) against legacy local `jyotishMath.computeShadbala()` and independent BPHS checks (Naisargika, Uchcha, Ojayugma, Drekkana, Kendradi across Whole-Sign/Sripati/Placidus, Saptavargaja with 5-fold Panchadha Maitri vs natural friendship, Sun `6.5` vs `5.0` Rupa threshold). Keeps `authoritativeDesignation = 'unassigned_pending_reconciliation'` until verified rather than silently averaging mismatched totals.

### 3.4 Phase 3: Supplementary Compatibility Gates (`supplementaryCompatibility.ts`)
Enforces strict, non-overwriting gates before any dataset from FreeAstroAPI `/api/v2/vedic/calculate` is accepted alongside AstroWay primary data:

1. **Ashtakavarga Gate (`evaluateAshtakavargaCompatibility`):**
   - Verifies all 7 classical planets + Ascendant signs match primary `vedicLahiri`.
   - Verifies classical BPHS totals (`Sun=48, Moon=49, Mars=39, Mercury=54, Jupiter=56, Venus=52, Saturn=39`, `SAV=337`), BAV-to-SAV sums, and Prastara contributor sums. Matching `337` alone is never treated as proof.
   - Isolates True vs Mean Node (`Rahu`/`Ketu`) delta via `nodeDependentPlacementsAudit` so node differences do **not** spuriously invalidate 7-planet Ashtakavarga.
   - Checks canonicalized ayanamsha identifier equivalence (`lahiri` vs numeric Lahiri within `±0.04°`).
2. **Bhava Chalit Gate (`evaluateBhavaChalitCompatibility`):**
   - Verifies canonical instant, coordinates, Ascendant (`Δ`), MC (`Δ`), classical planet longitudes, Sripati H10 vs MC alignment, 12/12 midpoint straddling, and boundary containment.
   - Explicitly rejects `kpPlacidusConfusionDetected` (if start cusps look like KP Placidus rather than Sripati Madhyas/Sandhis).
   - If rejected/incompatible or unavailable, falls back cleanly to deterministic `local:sripatiBhavaChalit`.
3. **D5 Panchamsha Gate (`evaluateD5DivisionalCompatibility`):**
   - Verifies base longitudes, Ascendant, ayanamsha, node convention (`Rahu`/`Ketu`), formula (`parashari_odd_even`), `calibrated` flag, and `6°` boundary sensitivity.
   - Retains `provisional` / separated attribution whenever `calibrated === false` or node convention differs rather than silently overwriting AstroWay Vargas.

### 3.5 Phase 4: Deterministic Local Modules & Zero-Coercion Guards (`localAshtakavarga.ts`, `localVedicMath.ts`)
Computes 8 provenance-tagged `DatasetEnvelope`s locally (pure TypeScript, zero coercion — missing inputs produce `unavailable`, never coerced `0`):
1. `localAshtakavarga` — Canonical BPHS 7-planet/8-contributor BAV, SAV (`337`), and full `7 x 8 x 12` Prastara matrices (fixing the legacy Ascendant-bindu omission bug) + cross-audit against legacy/provider tables.
2. `ashtakavargaReductions` — `Trikona Shodhana`, `Ekadhipatya Shodhana`, and `Shodhya Pinda` (`Rasi Pinda + Graha Pinda`).
3. `panchadhaMaitri` — BPHS Ch. 3 five-fold compound friendship matrix (`Adhi Mitra`, `Mitra`, `Sama`, `Shatru`, `Adhi Shatru`).
4. `vimshopakaBala` — `Shadvarga`, `Saptavarga`, `Dashavarga`, and `Shodashavarga` weighted strength out of `20.0`.
5. `sripatiBhavaChalit` — Deterministic Sripati Bhava Madhya & Sandhi solver from independent astronomical Ascendant & MC.
6. `dispositorRelationships` — D1 & D9 dispositor graphs, chains, loops/cycles, final dispositors, and `Parivartana` mutual exchanges.
7. `advancedAvasthas` — `Baladi`, `Jagradadi`, and `Deeptadi` Avasthas (tagged `provisional` until full `Sayanaadi`/`Lajjitadi` BPHS reconciliation).
8. `localVedicConditions` — Exaltation/debilitation/Moolatrikona, solar combustion (`isCombust`), Vargottama, Gandanta, and planetary war (`Graha Yuddha`).

### 3.6 Phase 5: Independent Verification, Manifest & Consolidated Compiler

#### Independent Astronomical Verifier (`verifier.ts`)
- **`computeIndependentAstronomicalReference(instant)`:** Computes Tropical/Lahiri/KP Ascendant & MC, Meeus Solar (`~0.01°`) and Lunar (`~0.05°`) longitudes, iterative semi-arc Placidus 12 cusps (with polar-circle safeguard), and Sripati quadrant-trisected Bhava Madhyas & Sandhis.
- Audits 4-frame isolation, non-monotonic cusps, KP vs Western vs Sripati methodology, Ashtakavarga invariants, Vimshottari timelines, and `ExternalReferenceAudit` (`JHora` / `PyJHora` / `Swiss Ephemeris` blockers when external reference fixtures are absent).

#### Definitive 6-State Completeness Manifest (`datasetManifest.ts`)
Evaluates **31 datasets** across **3 readiness tiers** (`minimum_chart_readiness`, `comprehensive_foundational_completeness`, `specialized_on_demand`) using **6 strict canonical states**:

| Canonical State | Semantics | Usable by Layer C? |
| :--- | :--- | :--- |
| `available` | Acquired from live provider with valid non-empty structure | Yes |
| `internally_verified` | Cross-checked against CosmicCouncil internal astronomical/BPHS solvers | Yes |
| `independently_validated` | Reconciled against external classical ground truth (`JHora` / `PyJHora` / `Swiss Ephemeris` ONLY — never self-promoted) | Yes |
| `provisional` | Partial coverage, `calibrated: false` (e.g., D5), or pending reconciliation (e.g., `ShadbalaReconciliation`, `advanced_avasthas`) | Opt-in (`allowProvisional: true`) with caveat |
| `incompatible` | Failed compatibility, frame-isolation, or ayanamsha/node gate | **Blocked** |
| `unavailable` | Missing, empty, or HTTP `402` tier-restricted with no fallback | **Blocked** |

#### Consolidated Compiler (`compiler.ts`)
`compileV2FoundationalChart(params)` ties Phases 1–5 together into `CompiledV2FoundationalChartResult` (`schemaVersion: 'v2.compiled_foundational_chart.1.0'`), outputting `canonicalBirthInstant`, `layerBMaster`, `layerCShell` (`{ status: 'deferred_by_scope' }`), `localModules`, `verification`, `manifest`, `completenessTable` (counts per 6 states), `datasetInventory` (with provenance attribution), `compatibilityGates`, `localAshtakavargaAudit`, `endpointAndCreditSummary`, and `externalValidationBlockers`.

### 3.7 Layer B → Layer C Read-Only Analytical Boundary (`layerCContract.ts`)
- **Contract Spec:** `docs/V2_LAYER_C_INTERFACE.md` (`LAYER_C_INPUT_CONTRACT_VERSION = 'v2.layer_c_input.1.0'`)
- **`prepareLayerCAnalyticalInput(source)`:** Packages read-only `LayerCAnalyticalInput` strictly separating `natalInvariant` vs `referenceDateTiming`, preserving explicit `calculationConventions`, and enforcing `epistemicTrustBoundary`.
- **`assertLayerCPrerequisites(input, domain)`:** Evaluates `DOWNSTREAM_MODULE_PREREQUISITES` for all 6 Layer C analytical domains (`phi_planetary_health`, `ascendant_lagnesh_health`, `ysi_yoga_strength`, `dsi_dosha_strength`, `house_intelligence`, `temporal_activation`), enforcing `withhold_or_return_insufficient_evidence` whenever required foundational datasets are `unavailable` or `incompatible`.

---

## 4. Admin Diagnostic Workbench, Telemetry & CLI Verification

- **Admin API Routes (`server/routes/admin.ts`, strictly gated by `requireAdmin`):**
  - `GET /api/admin/v2-diagnostics/profiles` — Read-only profile lookup (by search query) without modifying customer charts.
  - `GET /api/admin/v2-diagnostics/sessions` — Lists persisted resumable AstroWay acquisition sessions from `platform_settings` (`v2_diag_session:*`).
  - `POST /api/admin/v2-diagnostics/run` — Executes single-call/4-call FreeAstroAPI or resumable batched AstroWay acquisition, runs the full `compileV2FoundationalChart` pipeline + read-only `buildLegacyVsV2ComparisonReport`, and returns sanitized telemetry & redacted JSON export.
  - `POST /api/admin/v2-diagnostics/recover` & `DELETE /api/admin/v2-diagnostics/sessions/:sessionId` — Lock recovery and session cleanup.
- **Admin UI (`components/admin/V2ChartEngineLaboratory.tsx`):** Accessible via `/app/admin` for inspecting live vs legacy comparisons, compatibility gates, 6-state manifest tables, batch progress across 60s AstroWay windows, and redacted consolidated JSON exports.
- **Runtime Telemetry (`server/services/v2Engine/runtimeTelemetry.ts`):** Tracks per-isolate diagnostic latencies, CAS coordination mode, and wait timings without leaking credentials.
- **CLI Verification Suite (`scripts/verifyV2Engine.ts`):** Runs offline regression checks (DST ambiguity/gap validation, zero-coercion guards, local Ashtakavarga BPHS audit, 4-frame isolation, Sripati fallback, manifest state validation, `LayerC` contract readiness checks) and supports live/cached AstroWay + FreeAstroAPI end-to-end compilation & redacted artifact output (e.g., `/tmp/v2-engine-verification/`).

---

## 5. Key Architectural & Security Guarantees

1. **Zero Node Built-Ins in Core V2 Engine:** `server/services/v2Engine/*` runs identically on Cloudflare Workers (`worker.ts`) and Node (`server.ts`).
2. **Secret & Egress Safety:** Credentials never touch DB logs, frontend responses, or export JSON (`redactSecretsDeep`). Heavy profile JSON columns are excluded from list queries and read-only comparison tools never write back to `public.profiles`.
3. **Non-Overwriting Frame & Convention Discipline:** Whole-Sign Parashari (`vedicLahiri`), KP Placidus (`kpPlacidus`), Sripati (`bhavaChalit`), and Western Tropical (`westernTropical`) remain mathematically distinct end-to-end, while temporal snapshots never contaminate invariant natal structures.
