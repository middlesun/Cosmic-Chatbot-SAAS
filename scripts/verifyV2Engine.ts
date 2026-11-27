/**
 * Isolated V2 Foundational Calculation Engine — Verification & Regression CLI
 *
 * Usage:
 *   npx tsx scripts/verifyV2Engine.ts
 *   npx tsx scripts/verifyV2Engine.ts --require-live
 *
 * Reads FREE_ASTRO_API_KEY from process.env or .env.local / .env (gitignored).
 * Zero production mutations, zero DB writes, zero credential leakage.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import {
  acquireAstroWayFoundationalBundle,
  acquireFreeAstroApiSupplementaryVedicCalculate,
  acquireV2NatalBundle,
  adoptPreferredLocalAshtakavarga,
  assessChartJsonDefects,
  ASTROWAY_PRUNED_REDUNDANT_ENDPOINTS,
  auditLegacyJyotishMathAshtakavarga,
  auditVargasMethodology,
  BirthInstantTimezoneError,
  buildAndValidateV2Requests,
  buildAstroWayChris4EvaluationPlan,
  buildAstroWayFoundationalPlan,
  buildFreeAstroApiSupplementaryRequest,
  buildLayerBMasterChartRecord,
  buildLayerCAnalyticalShell,
  buildLegacyVsV2ComparisonReport,
  buildAstroWayProbeSpecs,
  buildShadbalaReconciliationReport,
  compareAstroWayModeAVsModeBResponses,
  compareAshtakavargaMatrices,
  compareModeAVsModeBResponses,
  computeCompletedAgeYears,
  computeDispositorRelationships,
  computeIndependentAstronomicalReference,
  computeLocalAshtakavarga,
  computeLocalVedicConditions,
  computePanchadhaMaitri,
  computeVimshopakaBala,
  deleteAstroWayBatchSession,
  enrichMasterWithPhase4LocalCalculations,
  evaluateAshtakavargaCompatibility,
  evaluateAshtakavargaSignBoundaryCase,
  evaluateAstroWayJulianDayCheck,
  evaluateBhavaChalitCompatibility,
  evaluateD5DivisionalCompatibility,
  executeAstroWayBatchedBundle,
  executeAstroWayEvaluationBundle,
  extractCanonicalAshtakavargaSignInput,
  getAstroWayApiKey,
  getAstroWayApiSecretStatus,
  getFreeAstroApiKey,
  getFreeAstroApiSecretStatus,
  integrateFreeAstroApiSupplementaryIntoMaster,
  listResumableAstroWaySessions,
  loadAstroWayBatchSession,
  normalizeAstroWayAlternativeDasha,
  normalizeAstroWayAshtakavargaShodhana,
  normalizeAstroWayVimshottari5Level,
  normalizeAstroWayYogas,
  normalizePositiveHeapBytes,
  orderAstroWaySpecsForPriorityVerification,
  parseAstroWayRateLimitHeaders,
  READ_ONLY_SUPABASE_DIAGNOSTIC_SQL,
  reconstructAstroWayLayerAFromSession,
  redactSecretsDeep,
  resetAstroWayIsolateRateStateForTests,
  resetAstroWayIsolateSessionsForTests,
  resolveCanonicalBirthInstant,
  saveAstroWayBatchSession,
  summarizeObservedQuotaHeaders,
  summarizeRuntimeHeapTelemetry,
  verify12CuspSequence,
  verifyClassicalAshtakavargaRulesTable,
  verifyKpFrameDetailed,
  verifyMasterChartRecord,
  verifyWesternFrameDetailed,
  type CanonicalBirthInput,
  type KpPlacidusFrame,
  type LayerARawProviderRecord,
  type SanitizedProviderCallRecord,
  type VedicLahiriFrame,
  type WesternTropicalFrame,
} from '../server/services/v2Engine';
import {
  acquireV2DiagnosticRunLock,
  releaseV2DiagnosticRunLock,
  renewV2DiagnosticRunLock,
  resetV2DiagnosticLockForTests,
  setV2DiagnosticLockClockOffsetForTests,
} from '../server/services/astrologyProviders/freeAstroApiRateLimiter';
import { getNakshatraAndSubs, getVargaSignIndex, normalizeDeg, SIGNS } from '../server/services/jyotishMath';

function loadLocalEnvFilesForCli(): { loadedFiles: string[] } {
  const cwd = process.cwd();
  const loadedFiles: string[] = [];
  for (const name of ['.env.local', '.env']) {
    const abs = path.resolve(cwd, name);
    if (fs.existsSync(abs)) {
      dotenv.config({ path: abs, override: false });
      loadedFiles.push(name);
    }
  }
  return { loadedFiles };
}

interface RegressionFixture {
  id: string;
  input: CanonicalBirthInput;
  expectedUtcIso: string;
  expectedOffsetHours: number;
  expectedIsDst: boolean;
}

const FIXTURES: RegressionFixture[] = [
  {
    id: 'bardhaman_1985_reference',
    input: {
      name: 'Chris 3 (Bardhaman Reference)',
      birthDate: '1985-12-25',
      birthTime: '04:33:00',
      latitude: 23.25572,
      longitude: 87.85691,
      city: 'Bardhaman',
      state: 'West Bengal',
      country: 'India',
      ianaTimezone: 'Asia/Kolkata',
      birthTimePrecision: 'exact',
      nodeConvention: 'mean',
    },
    expectedUtcIso: '1985-12-24T23:03:00.000Z',
    expectedOffsetHours: 5.5,
    expectedIsDst: false,
  },
  {
    id: 'new_delhi_1988_benchmark',
    input: {
      name: 'Sample Chart 2 (New Delhi)',
      birthDate: '1988-11-24',
      birthTime: '18:45:00',
      latitude: 28.6139,
      longitude: 77.209,
      city: 'New Delhi',
      state: 'Delhi',
      country: 'India',
      ianaTimezone: 'Asia/Kolkata',
      birthTimePrecision: 'exact',
      nodeConvention: 'mean',
    },
    expectedUtcIso: '1988-11-24T13:15:00.000Z',
    expectedOffsetHours: 5.5,
    expectedIsDst: false,
  },
  {
    id: 'utc_rollover_nonzero_seconds',
    input: {
      name: 'Rollover + Non-Zero Seconds (Mumbai)',
      birthDate: '1992-01-01',
      birthTime: '00:15:47',
      latitude: 19.076,
      longitude: 72.8777,
      city: 'Mumbai',
      country: 'India',
      ianaTimezone: 'Asia/Kolkata',
      birthTimePrecision: 'exact',
      nodeConvention: 'mean',
    },
    expectedUtcIso: '1991-12-31T18:45:47.000Z',
    expectedOffsetHours: 5.5,
    expectedIsDst: false,
  },
  {
    id: 'historical_dst_us_1995',
    input: {
      name: 'Historical DST 1995 (New York EDT)',
      birthDate: '1995-06-10',
      birthTime: '14:15:37',
      latitude: 40.7128,
      longitude: -74.006,
      city: 'New York',
      country: 'United States',
      ianaTimezone: 'America/New_York',
      birthTimePrecision: 'exact',
      nodeConvention: 'mean',
    },
    expectedUtcIso: '1995-06-10T18:15:37.000Z',
    expectedOffsetHours: -4.0,
    expectedIsDst: true,
  },
  {
    id: 'historical_dst_uk_1985',
    input: {
      name: 'Historical DST 1985 (London BST)',
      birthDate: '1985-07-15',
      birthTime: '00:15:45',
      latitude: 51.5074,
      longitude: -0.1278,
      city: 'London',
      country: 'United Kingdom',
      ianaTimezone: 'Europe/London',
      birthTimePrecision: 'exact',
      nodeConvention: 'mean',
    },
    expectedUtcIso: '1985-07-14T23:15:45.000Z',
    expectedOffsetHours: 1.0,
    expectedIsDst: true,
  },
  {
    id: 'high_latitude_reykjavik_1990',
    input: {
      name: 'High Latitude (Reykjavik 64.15N)',
      birthDate: '1990-06-21',
      birthTime: '03:30:15',
      latitude: 64.1466,
      longitude: -21.9426,
      city: 'Reykjavik',
      country: 'Iceland',
      ianaTimezone: 'Atlantic/Reykjavik',
      birthTimePrecision: 'exact',
      nodeConvention: 'mean',
    },
    expectedUtcIso: '1990-06-21T03:30:15.000Z',
    expectedOffsetHours: 0,
    expectedIsDst: false,
  },
];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

async function main() {
  const requireLive = process.argv.includes('--require-live');
  const evalAstroWay = process.argv.includes('--eval-astroway');
  const envLoad = loadLocalEnvFilesForCli();
  const secretStatus = getFreeAstroApiSecretStatus();
  const astroWaySecretStatus = getAstroWayApiSecretStatus();

  console.log('====================================================================');
  console.log('CosmicCouncil — Foundational Calculation Engine V2 Verification CLI');
  console.log('====================================================================');
  console.log(
    'Secret Status:',
    JSON.stringify({
      freeAstroApi: secretStatus,
      astroWay: astroWaySecretStatus,
      loadedEnvFiles: envLoad.loadedFiles,
    })
  );

  const outDir = path.join(os.tmpdir(), 'v2-engine-verification');
  fs.mkdirSync(outDir, { recursive: true });

  const regressionResults: Array<Record<string, unknown>> = [];

  // 1. Offline Canonical Birth Instant + Astronomical Reference + OpenAPI Preflight Tests
  for (const fx of FIXTURES) {
    const instant = resolveCanonicalBirthInstant(fx.input);
    assert(
      instant.utc.iso === fx.expectedUtcIso,
      `${fx.id}: UTC expected ${fx.expectedUtcIso}, got ${instant.utc.iso}`
    );
    assert(
      instant.timezone.historicalUtcOffsetHours === fx.expectedOffsetHours,
      `${fx.id}: offset expected ${fx.expectedOffsetHours}, got ${instant.timezone.historicalUtcOffsetHours}`
    );
    assert(
      instant.timezone.isDst === fx.expectedIsDst,
      `${fx.id}: isDst expected ${fx.expectedIsDst}, got ${instant.timezone.isDst}`
    );

    const ref = computeIndependentAstronomicalReference(instant);
    const kpSeq = verify12CuspSequence(ref.kpPlacidusCuspsDeg);
    const tropSeq = verify12CuspSequence(ref.tropicalPlacidusCusps);
    assert(kpSeq.monotonicSequential, `${fx.id}: reference KP Placidus cusps must be monotonic`);
    assert(tropSeq.monotonicSequential, `${fx.id}: reference Tropical Placidus cusps must be monotonic`);

    if (fx.id === 'bardhaman_1985_reference') {
      assert(
        Math.abs(ref.lahiriAscendantDeg - 225.1875) < 0.02,
        `Bardhaman Lahiri Asc expected ~225.1875°, got ${ref.lahiriAscendantDeg}°`
      );
      assert(
        Math.abs(ref.lahiriMoonLonDeg - 43.42) < 0.25,
        `Bardhaman Lahiri Moon expected ~43.42°, got ${ref.lahiriMoonLonDeg}°`
      );
    }

    const builtReqs = buildAndValidateV2Requests(instant);
    assert(
      builtReqs.validationErrors.length === 0,
      `${fx.id}: OpenAPI preflight failed: ${builtReqs.validationErrors.join('; ')}`
    );
    assert(
      builtReqs.request1VedicCalculate.body.second === instant.input.second,
      `${fx.id}: Request 1 must preserve seconds=${instant.input.second}`
    );
    assert(
      builtReqs.request2VedicKp.body.ayanamsha === 'kp',
      `${fx.id}: Request 2 must use ayanamsha="kp"`
    );

    // Offline Layer B + Layer C no-fallback check
    const offlineMaster = buildLayerBMasterChartRecord({ instant, rawLayerA: null });
    assert(
      offlineMaster.frames.vedicLahiri.verificationStatus === 'unavailable',
      `${fx.id}: offline master must mark missing provider data 'unavailable' (no silent fallback)`
    );
    const shell = buildLayerCAnalyticalShell(offlineMaster);
    assert(shell.status === 'deferred_by_scope', `${fx.id}: Layer C must stay deferred`);

    regressionResults.push({
      id: fx.id,
      status: 'PASSED',
      utcIso: instant.utc.iso,
      julianDayUt: instant.utc.julianDayUt,
      offsetHours: instant.timezone.historicalUtcOffsetHours,
      isDst: instant.timezone.isDst,
      refLahiriAscDeg: ref.lahiriAscendantDeg,
      refLahiriMoonDeg: ref.lahiriMoonLonDeg,
      placidusSpanDeg: kpSeq.totalSpanDeg,
      openApiPreflightWarnings: builtReqs.validationWarnings,
    });
  }

  // 2. Nakshatra & Gandanta Boundary Checks
  const nakTests = [
    { lon: 119.9999, expectedNak: 'Ashlesha', expectedPada: 4 },
    { lon: 120.0001, expectedNak: 'Magha', expectedPada: 1 },
    { lon: 239.9999, expectedNak: 'Jyeshtha', expectedPada: 4 },
    { lon: 240.0001, expectedNak: 'Mula', expectedPada: 1 },
    { lon: 359.9999, expectedNak: 'Revati', expectedPada: 4 },
    { lon: 0.0001, expectedNak: 'Ashwini', expectedPada: 1 },
  ];
  for (const nt of nakTests) {
    const res = getNakshatraAndSubs(nt.lon);
    assert(
      res.nakshatra === nt.expectedNak && res.pada === nt.expectedPada,
      `Boundary ${nt.lon}° expected ${nt.expectedNak} p${nt.expectedPada}, got ${res.nakshatra} p${res.pada}`
    );
  }
  regressionResults.push({ id: 'nakshatra_gandanta_boundaries', status: 'PASSED', cases: nakTests.length });

  // 3. Negative Guardrail: Never silently default missing timezone to UTC
  let threwTzError = false;
  try {
    resolveCanonicalBirthInstant({
      name: 'Missing TZ Test',
      birthDate: '1990-01-01',
      birthTime: '12:00:00',
      latitude: 28.6139,
      longitude: 77.209,
    });
  } catch (err) {
    threwTzError = err instanceof BirthInstantTimezoneError;
  }
  assert(threwTzError, 'Expected BirthInstantTimezoneError when timezone is omitted.');
  regressionResults.push({ id: 'no_silent_utc_default_guardrail', status: 'PASSED' });

  // 3b. DST Spring-Forward Nonexistent Time & Fall-Back Ambiguous Fold Tests
  let threwNonexistent = false;
  try {
    resolveCanonicalBirthInstant({
      name: 'DST Gap (America/New_York)',
      birthDate: '2024-03-10',
      birthTime: '02:30:00',
      latitude: 40.7128,
      longitude: -74.006,
      ianaTimezone: 'America/New_York',
    });
  } catch (err) {
    threwNonexistent =
      err instanceof BirthInstantTimezoneError && err.code === 'NONEXISTENT_LOCAL_TIME';
  }
  assert(threwNonexistent, 'Expected NONEXISTENT_LOCAL_TIME for 2024-03-10 02:30 America/New_York');

  let threwAmbiguousWithCandidates = false;
  try {
    resolveCanonicalBirthInstant({
      name: 'DST Fold (America/New_York)',
      birthDate: '2024-11-03',
      birthTime: '01:30:00',
      latitude: 40.7128,
      longitude: -74.006,
      ianaTimezone: 'America/New_York',
    });
  } catch (err) {
    threwAmbiguousWithCandidates =
      err instanceof BirthInstantTimezoneError &&
      err.code === 'AMBIGUOUS_LOCAL_TIME' &&
      Array.isArray(err.candidates) &&
      err.candidates.length === 2;
  }
  assert(
    threwAmbiguousWithCandidates,
    'Expected AMBIGUOUS_LOCAL_TIME with 2 candidates for 2024-11-03 01:30 America/New_York'
  );

  const foldEarlier = resolveCanonicalBirthInstant({
    name: 'DST Fold Earlier',
    birthDate: '2024-11-03',
    birthTime: '01:30:00',
    latitude: 40.7128,
    longitude: -74.006,
    ianaTimezone: 'America/New_York',
    dstFoldDisambiguation: 'earlier_occurrence',
  });
  const foldLater = resolveCanonicalBirthInstant({
    name: 'DST Fold Later',
    birthDate: '2024-11-03',
    birthTime: '01:30:00',
    latitude: 40.7128,
    longitude: -74.006,
    ianaTimezone: 'America/New_York',
    dstFoldDisambiguation: 'later_occurrence',
  });
  assert(
    foldEarlier.utc.iso === '2024-11-03T05:30:00.000Z' &&
      foldLater.utc.iso === '2024-11-03T06:30:00.000Z',
    `Expected DST fold UTCs 05:30Z / 06:30Z, got ${foldEarlier.utc.iso} / ${foldLater.utc.iso}`
  );
  regressionResults.push({
    id: 'dst_gap_and_fold_disambiguation',
    status: 'PASSED',
    earlierUtc: foldEarlier.utc.iso,
    laterUtc: foldLater.utc.iso,
  });

  // 3c. Partial Acquisition Preservation + 5-Bucket Epistemic Verification + Shadbala Guard
  const sampleInstant = resolveCanonicalBirthInstant(FIXTURES[0].input);
  const sampleRef = computeIndependentAstronomicalReference(sampleInstant);
  const syntheticPartialLayerA: LayerARawProviderRecord = {
    schemaVersion: 'v2.raw.1.0',
    capturedAtUtc: new Date().toISOString(),
    providerId: 'freeastroapi',
    providerBaseUrl: 'https://api.freeastroapi.com',
    inputFingerprint: sampleInstant.inputFingerprint,
    canonicalUtcIso: sampleInstant.utc.iso,
    canonicalJulianDayUt: sampleInstant.utc.julianDayUt,
    acquisitionStatus: 'partial',
    missingDatasets: ['vedic_kp (/api/v2/vedic/kp): Simulated HTTP 500 failure'],
    validationFailures: [],
    calls: {
      vedic_calculate: {
        id: 'vedic_calculate',
        endpoint: '/api/v2/vedic/calculate',
        method: 'POST',
        timestampUtc: new Date().toISOString(),
        sanitizedRequest: { city: 'Bardhaman' },
        httpStatus: 200,
        ok: true,
        attempts: 1,
        rateWaitMs: 0,
        coordinationMode: 'isolate_memory_only',
        latencyMs: 120,
        payloadBytes: 512,
        quotaAndMetaHeaders: {},
        errorMessage: null,
        rawResponse: {
          ayanamsha: 'lahiri',
          timezone_used: 'Asia/Kolkata',
          chart: {
            ascendant: { degree: sampleRef.lahiriAscendantDeg, sign: 'Scorpio' },
            planets: [
              { name: 'Sun', absolute_degree: sampleRef.lahiriSunLonDeg, house: 2 },
              { name: 'Moon', absolute_degree: sampleRef.lahiriMoonLonDeg, house: 7 },
            ],
            houses: [],
          },
        },
      },
      vedic_kp: {
        id: 'vedic_kp',
        endpoint: '/api/v2/vedic/kp',
        method: 'POST',
        timestampUtc: new Date().toISOString(),
        sanitizedRequest: { city: 'Bardhaman' },
        httpStatus: 500,
        ok: false,
        attempts: 1,
        rateWaitMs: 1150,
        coordinationMode: 'isolate_memory_only',
        latencyMs: 90,
        payloadBytes: 42,
        quotaAndMetaHeaders: {},
        errorMessage: 'HTTP 500',
        rawResponse: { detail: 'Simulated error' },
      },
    },
    timezoneEquivalenceCheck: null,
    ephemerisTimestampCheck: null,
    quotaAndPerformanceSummary: {
      plannedRequestsCount: 4,
      totalCalls: 2,
      actualHttpRequestsSent: 2,
      retryCount: 0,
      successfulCalls: 1,
      failedCalls: 1,
      totalLatencyMs: 210,
      totalRateWaitMs: 1150,
      totalPayloadBytes: 554,
      coordinationModesObserved: ['isolate_memory_only'],
      quotaHeadersObserved: {
        status: 'not_provided_by_provider',
        observedHeadersByEndpoint: {},
        remainingQuotaObserved: null,
        rateLimitObserved: null,
        note: 'Simulated test payload.',
      },
    },
  };
  const partialMaster = buildLayerBMasterChartRecord({
    instant: sampleInstant,
    rawLayerA: syntheticPartialLayerA,
  });
  const partialVerification = verifyMasterChartRecord(partialMaster, syntheticPartialLayerA);
  assert(
    Boolean(partialMaster.frames.vedicLahiri.data) &&
      partialMaster.frames.kpPlacidus.verificationStatus === 'unavailable' &&
      partialVerification.mode === 'partial_live_and_offline' &&
      partialMaster.shadbalaReconciliation.data?.authoritativeDesignation ===
        'unassigned_pending_reconciliation' &&
      partialVerification.epistemicClassification.providerDataAcquired.length >= 1 &&
      partialVerification.epistemicClassification.independentlyValidatedAgainstExternalReference.length === 0 &&
      partialVerification.epistemicClassification.methodologyUnresolved.some(
        (i) => i.key === 'pending_external_jhora_pyjhora_validation'
      ) &&
      partialVerification.epistemicClassification.datasetUnavailable.length >= 1,
    'Partial acquisition & 5-bucket epistemic classification check failed.'
  );
  regressionResults.push({
    id: 'partial_acquisition_and_epistemic_classification',
    status: 'PASSED',
    verificationMode: partialVerification.mode,
    externalBucketCount:
      partialVerification.epistemicClassification.independentlyValidatedAgainstExternalReference.length,
    shadbalaDesignation: partialMaster.shadbalaReconciliation.data?.authoritativeDesignation,
  });

  // 3d. Chris 4 Mode A vs Mode B Shadbala Kala Bala failure & Panchang clock-offset audit
  const makeProbeCall = (
    id: 'timezone_probe_mode_a' | 'timezone_probe_mode_b',
    rawResponse: unknown
  ): SanitizedProviderCallRecord => ({
    id,
    endpoint: '/api/v2/vedic/calculate',
    method: 'POST',
    timestampUtc: new Date().toISOString(),
    sanitizedRequest: { tz_str: id === 'timezone_probe_mode_a' ? 'Asia/Kolkata' : 'UTC' },
    httpStatus: 200,
    ok: true,
    attempts: 1,
    rateWaitMs: 0,
    coordinationMode: 'isolate_memory_only',
    latencyMs: 100,
    payloadBytes: 1024,
    quotaAndMetaHeaders: {},
    rawResponse,
  });
  const chris4ModeBCall = makeProbeCall('timezone_probe_mode_b', {
    chart: {
      ascendant: { degree: sampleRef.lahiriAscendantDeg },
      planets: [
        { name: 'Sun', absolute_degree: sampleRef.lahiriSunLonDeg },
        { name: 'Moon', absolute_degree: sampleRef.lahiriMoonLonDeg },
      ],
    },
    shadbala: {
      Sun: { sthana_bala: 222.31, dig_bala: 24.27, kala_bala: 118.12, cheshta_bala: 1.03, naisargika_bala: 60, drik_bala: 8.39, total: 434.12, ratio: 1.45 },
      Moon: { sthana_bala: 214.03, dig_bala: 32.94, kala_bala: 110.05, cheshta_bala: 51.33, naisargika_bala: 51.42, drik_bala: -29.76, total: 430.01, ratio: 1.2 },
      Mars: { sthana_bala: 189.87, dig_bala: 43.21, kala_bala: 92.41, cheshta_bala: 23.31, naisargika_bala: 17.16, drik_bala: 12.77, total: 378.73, ratio: 1.26 },
      Mercury: { sthana_bala: 256.02, dig_bala: 58.58, kala_bala: 127.19, cheshta_bala: 27.01, naisargika_bala: 25.74, drik_bala: 13.85, total: 508.39, ratio: 1.21 },
      Jupiter: { sthana_bala: 126.04, dig_bala: 37.35, kala_bala: 155.21, cheshta_bala: 16.77, naisargika_bala: 34.26, drik_bala: -29.39, total: 340.24, ratio: 0.87 },
      Venus: { sthana_bala: 151.48, dig_bala: 33.68, kala_bala: 145.56, cheshta_bala: 2.97, naisargika_bala: 42.84, drik_bala: 9.93, total: 386.46, ratio: 1.17 },
      Saturn: { sthana_bala: 214.33, dig_bala: 1.48, kala_bala: 91.37, cheshta_bala: 10.94, naisargika_bala: 8.58, drik_bala: 15.21, total: 341.91, ratio: 1.14 },
    },
    panchang: {
      tithi: { name: 'Shukla Chaturdashi' },
      nakshatra: { name: 'Rohini' },
      sunrise: '06:17:00',
      sunset: '16:56:00',
    },
  });
  const chris4ModeACall = makeProbeCall('timezone_probe_mode_a', {
    chart: {
      ascendant: { degree: sampleRef.lahiriAscendantDeg },
      planets: [
        { name: 'Sun', absolute_degree: sampleRef.lahiriSunLonDeg },
        { name: 'Moon', absolute_degree: sampleRef.lahiriMoonLonDeg },
      ],
    },
    shadbala: {
      Sun: { sthana_bala: 222.31, dig_bala: 24.27, kala_bala: 105.14, cheshta_bala: 1.03, naisargika_bala: 60, drik_bala: 8.39, total: 421.14, ratio: 1.4 },
      Moon: { sthana_bala: 214.03, dig_bala: 32.94, kala_bala: 123.03, cheshta_bala: 51.33, naisargika_bala: 51.42, drik_bala: -29.76, total: 442.99, ratio: 1.23 },
      Mars: { sthana_bala: 189.87, dig_bala: 43.21, kala_bala: 165.39, cheshta_bala: 23.31, naisargika_bala: 17.16, drik_bala: 12.77, total: 451.71, ratio: 1.51 },
      Mercury: { sthana_bala: 256.02, dig_bala: 58.58, kala_bala: 127.19, cheshta_bala: 27.01, naisargika_bala: 25.74, drik_bala: 13.85, total: 508.39, ratio: 1.21 },
      Jupiter: { sthana_bala: 126.04, dig_bala: 37.35, kala_bala: 142.23, cheshta_bala: 16.77, naisargika_bala: 34.26, drik_bala: -29.39, total: 327.26, ratio: 0.84 },
      Venus: { sthana_bala: 151.48, dig_bala: 33.68, kala_bala: 72.58, cheshta_bala: 2.97, naisargika_bala: 42.84, drik_bala: 9.93, total: 313.48, ratio: 0.95 },
      Saturn: { sthana_bala: 214.33, dig_bala: 1.48, kala_bala: 104.35, cheshta_bala: 10.94, naisargika_bala: 8.58, drik_bala: 15.21, total: 354.89, ratio: 1.18 },
    },
    panchang: {
      tithi: { name: 'Shukla Chaturdashi' },
      nakshatra: { name: 'Rohini' },
      sunrise: '11:47:00',
      sunset: '22:26:00',
    },
  });
  const modeCompare = compareModeAVsModeBResponses(chris4ModeACall, chris4ModeBCall, sampleInstant);
  assert(
    modeCompare.coordinatesEquivalent === true &&
      modeCompare.shadbalaComparison?.available === true &&
      modeCompare.shadbalaComparison.equivalent === false &&
      modeCompare.equivalent === false &&
      Math.abs((modeCompare.shadbalaComparison.maxTotalDeltaVirupas ?? 0) - 72.98) < 0.02 &&
      modeCompare.panchangAudit?.equivalent === true &&
      (modeCompare.panchangAudit?.legitimateDisplayTimeDifferences.length ?? 0) === 2,
    'Chris 4 Mode A vs Mode B Shadbala Kala Bala failure + Panchang offset test failed.'
  );
  regressionResults.push({
    id: 'shadbala_timezone_invariance_detector',
    status: 'PASSED',
    maxTotalDeltaVirupas: modeCompare.shadbalaComparison?.maxTotalDeltaVirupas,
    legitimatePanchangTimeDiffs: modeCompare.panchangAudit?.legitimateDisplayTimeDifferences.length,
  });

  // 3e. D4 alternate longitudes & D5 calibrated:false audit
  const syntheticVedicForVargas: VedicLahiriFrame = {
    ayanamshaLabel: 'lahiri',
    houseSystem: 'whole_sign',
    nodeType: 'mean',
    timezoneUsed: 'Asia/Kolkata',
    ascendant: { degree: sampleRef.lahiriAscendantDeg },
    planets: [
      { name: 'Sun', absolute_degree: sampleRef.lahiriSunLonDeg },
      { name: 'Moon', absolute_degree: sampleRef.lahiriMoonLonDeg },
    ],
    houses: [],
    sadeSati: null,
    vargas: {
      supportedCount: 2,
      divisionsReturned: ['D4', 'D5'],
      chartsByDivision: {
        D4: {
          profile: 'auto',
          alternate_source_longitudes: true,
          ascendant: { sign: SIGNS[getVargaSignIndex(sampleRef.lahiriAscendantDeg, 4)] },
          planets: [
            { name: 'Sun', sign: SIGNS[getVargaSignIndex(sampleRef.lahiriSunLonDeg, 4)] },
            { name: 'Moon', sign: SIGNS[getVargaSignIndex(sampleRef.lahiriMoonLonDeg, 4)] },
          ],
        },
        D5: {
          calibrated: false,
          ascendant: { sign: 'Scorpio' },
          planets: [{ name: 'Sun', sign: 'Sagittarius' }],
        },
      },
    },
    ashtakavarga: null,
    yogas: null,
    panchang: null,
    vimshottariDasha: null,
    providerMetadata: null,
  };
  const vargaAuditRes = auditVargasMethodology(syntheticVedicForVargas);
  assert(
    vargaAuditRes.d4Audit.matchesBphsQuadrantJumpCount === 3 &&
      vargaAuditRes.d4Audit.hasAlternateSourceLongitudes === true &&
      vargaAuditRes.d5Audit.calibrated === false &&
      vargaAuditRes.uncalibratedDivisions.some((u) => u.division === 'D5'),
    'D4/D5 varga audit test failed.'
  );
  regressionResults.push({
    id: 'vargas_d4_d5_methodology_audit',
    status: 'PASSED',
    d4Matches: vargaAuditRes.d4Audit.matchesBphsQuadrantJumpCount,
    d5Calibrated: vargaAuditRes.d5Audit.calibrated,
  });

  // 3f. KP cusps, occupancy & 4-level significators verification
  const kpAyRef = normalizeDeg(sampleRef.tropicalAscendantDeg - sampleRef.kpAscendantDeg);
  const kpSunLon = normalizeDeg(sampleRef.tropicalSunLonDeg - kpAyRef);
  const kpMoonLon = normalizeDeg(sampleRef.tropicalMoonLonDeg - kpAyRef);
  const findKpHouse = (lon: number): number => {
    for (let i = 0; i < 12; i++) {
      const s = sampleRef.kpPlacidusCuspsDeg[i];
      const e = sampleRef.kpPlacidusCuspsDeg[(i + 1) % 12];
      if (s < e ? lon >= s && lon < e : lon >= s || lon < e) return i + 1;
    }
    return 1;
  };
  const kpSunH = findKpHouse(kpSunLon);
  const kpMoonH = findKpHouse(kpMoonLon);
  const kpCuspsArr = sampleRef.kpPlacidusCuspsDeg.map((deg, idx) => {
    const nak = getNakshatraAndSubs(deg);
    return { house: idx + 1, cusp_degree: deg, star_lord: nak.nakshatraLord, sub_lord: nak.subLord };
  });
  const SIGN_LORDS = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
  const sunOwned = kpCuspsArr.filter((c) => SIGN_LORDS[Math.floor(c.cusp_degree / 30) % 12] === 'Sun').map((c) => c.house);
  const moonOwned = kpCuspsArr.filter((c) => SIGN_LORDS[Math.floor(c.cusp_degree / 30) % 12] === 'Moon').map((c) => c.house);
  const kpFrameGood: KpPlacidusFrame = {
    ayanamsha: { id: 'kp', name: 'KP', valueDegrees: kpAyRef },
    angles: { ascendant: { degree: sampleRef.kpAscendantDeg }, mc: { degree: sampleRef.kpMcDeg } },
    ascendant: { degree: sampleRef.kpAscendantDeg },
    planets: [
      { name: 'Sun', absolute_degree: kpSunLon, kp_house: kpSunH },
      { name: 'Moon', absolute_degree: kpMoonLon, kp_house: kpMoonH },
    ],
    cusps: kpCuspsArr,
    cuspalSubLordTable: [],
    planetSignificators: [
      { planet: 'Sun', level_2: [kpSunH], level_4: sunOwned },
      { planet: 'Moon', level_2: [kpMoonH], level_4: moonOwned },
    ],
    houseSignificators: Array.from({ length: 12 }, (_, i) => ({ house: i + 1 })),
    rulingPlanets: null,
    dasha: null,
    metadata: null,
  };
  const kpGoodCheck = verifyKpFrameDetailed(kpFrameGood, sampleRef);
  const kpBadCheck = verifyKpFrameDetailed(
    {
      ...kpFrameGood,
      planets: [
        { name: 'Sun', absolute_degree: kpSunLon, kp_house: (kpSunH % 12) + 1 },
        { name: 'Moon', absolute_degree: kpMoonLon, kp_house: kpMoonH },
      ],
    },
    sampleRef
  );
  assert(
    kpGoodCheck.passed === true &&
      kpGoodCheck.occupancyMatches === 2 &&
      kpBadCheck.passed === false &&
      kpBadCheck.occupancyMismatches.length === 1,
    'KP occupancy & significators verification check failed.'
  );
  regressionResults.push({
    id: 'kp_occupancy_and_significators',
    status: 'PASSED',
    goodOccupancyMatches: kpGoodCheck.occupancyMatches,
    corruptedMismatchesDetected: kpBadCheck.occupancyMismatches.length,
  });

  // 3g. Western Placidus occupancy & aspect geometry verification
  const findTropHouse = (lon: number): number => {
    for (let i = 0; i < 12; i++) {
      const s = sampleRef.tropicalPlacidusCusps[i];
      const e = sampleRef.tropicalPlacidusCusps[(i + 1) % 12];
      if (s < e ? lon >= s && lon < e : lon >= s || lon < e) return i + 1;
    }
    return 1;
  };
  const westGood: WesternTropicalFrame = {
    zodiacType: 'tropical',
    houseSystem: 'placidus',
    timeKnown: true,
    secondPrecisionDroppedByV1Endpoint: false,
    subject: null,
    resolvedTime: null,
    angles: { ascendant: { abs_pos: sampleRef.tropicalAscendantDeg }, mc: { abs_pos: sampleRef.tropicalMcDeg } },
    anglesDetails: null,
    planets: [
      { name: 'Sun', abs_pos: sampleRef.tropicalSunLonDeg, house: findTropHouse(sampleRef.tropicalSunLonDeg) },
      { name: 'Moon', abs_pos: sampleRef.tropicalMoonLonDeg, house: findTropHouse(sampleRef.tropicalMoonLonDeg) },
      {
        name: 'Mercury',
        abs_pos: normalizeDeg(sampleRef.tropicalSunLonDeg + 120),
        house: findTropHouse(normalizeDeg(sampleRef.tropicalSunLonDeg + 120)),
      },
    ],
    houses: sampleRef.tropicalPlacidusCusps.map((deg, idx) => ({ house: idx + 1, abs_pos: deg })),
    aspects: [{ p1_name: 'Sun', p2_name: 'Mercury', aspect: 'Trine', orb: 0.0 }],
    aspectsSummary: null,
    declinationAspects: [],
    declinationAspectsSummary: null,
    configurations: null,
    stelliums: null,
    dominants: null,
    dominantsProfile: null,
    tables: null,
  };
  const westGoodCheck = verifyWesternFrameDetailed(westGood, sampleRef, false);
  const westBadCheck = verifyWesternFrameDetailed(
    { ...westGood, aspects: [{ p1_name: 'Sun', p2_name: 'Mercury', aspect: 'Square', orb: 0.0 }] },
    sampleRef,
    false
  );
  assert(
    westGoodCheck.passed === true &&
      westGoodCheck.aspectsMatched === 1 &&
      westBadCheck.passed === false &&
      westBadCheck.aspectMismatches.length === 1,
    'Western occupancy & aspect verification check failed.'
  );
  regressionResults.push({
    id: 'western_occupancy_and_aspects',
    status: 'PASSED',
    aspectsVerified: westGoodCheck.aspectsMatched,
    badAspectDetected: westBadCheck.aspectMismatches.length,
  });

  // 3h. Quota header summary non-conflation & post-run remaining value
  const quotaCalls: SanitizedProviderCallRecord[] = [
    {
      ...chris4ModeACall,
      id: 'vedic_calculate',
      quotaAndMetaHeaders: { 'x-ratelimit-limit': '60', 'x-ratelimit-remaining': '100' },
    },
    {
      ...chris4ModeBCall,
      id: 'ephemeris',
      quotaAndMetaHeaders: { 'x-ratelimit-limit': '60', 'x-ratelimit-remaining': '96' },
    },
  ];
  const quotaSummary = summarizeObservedQuotaHeaders(quotaCalls);
  assert(
    quotaSummary.remainingQuotaObserved === 'x-ratelimit-remaining: 96' &&
      quotaSummary.initialRemainingQuotaObserved === 'x-ratelimit-remaining: 100' &&
      quotaSummary.rateLimitObserved === 'x-ratelimit-limit: 60',
    `Quota summary mismatch: ${JSON.stringify(quotaSummary)}`
  );
  regressionResults.push({
    id: 'quota_header_summary_accuracy',
    status: 'PASSED',
    initialRemaining: quotaSummary.initialRemainingQuotaObserved,
    finalRemaining: quotaSummary.remainingQuotaObserved,
    rateLimit: quotaSummary.rateLimitObserved,
  });

  // 3i. Panchang request_time_panchang vs daily sunrise calendar Panchang + Vimshottari rollover vs 0.0027y balance artifact
  const panchangDashaModeB = makeProbeCall('timezone_probe_mode_b', {
    chart: {
      ascendant: { degree: sampleRef.lahiriAscendantDeg },
      planets: [
        { name: 'Sun', absolute_degree: sampleRef.lahiriSunLonDeg },
        { name: 'Moon', absolute_degree: sampleRef.lahiriMoonLonDeg },
      ],
    },
    panchang: {
      tithi: { name: 'Shukla Chaturdashi' },
      nakshatra: { name: 'Rohini' },
      vara: 'Tuesday',
      sunrise: '06:17:00',
      sunset: '16:56:00',
      request_time_panchang: {
        tithi: { name: 'Shukla Chaturdashi', paksha: 'Shukla' },
        nakshatra: { name: 'Rohini', pada: 2 },
        yoga: { name: 'Shubha' },
        karana: { name: 'Vanija' },
        sun_longitude: sampleRef.lahiriSunLonDeg,
        moon_longitude: sampleRef.lahiriMoonLonDeg,
      },
    },
    vimshottari_dasha: {
      birth_balance: { lord: 'Moon', remaining_years: 7.4329, full_duration_years: 10 },
      mahadashas: [
        { lord: 'Moon', start_date: '1985-12-24', end_date: '1993-05-31' },
        { lord: 'Mars', start_date: '1993-05-31', end_date: '2000-05-31' },
        { lord: 'Rahu', start_date: '2000-05-31', end_date: '2018-05-31' },
      ],
    },
  });
  const panchangDashaModeA = makeProbeCall('timezone_probe_mode_a', {
    chart: {
      ascendant: { degree: sampleRef.lahiriAscendantDeg },
      planets: [
        { name: 'Sun', absolute_degree: sampleRef.lahiriSunLonDeg },
        { name: 'Moon', absolute_degree: sampleRef.lahiriMoonLonDeg },
      ],
    },
    panchang: {
      tithi: { name: 'Purnima' },
      nakshatra: { name: 'Mrigashira' },
      vara: 'Wednesday',
      sunrise: '11:47:30',
      sunset: '22:26:30',
      request_time_panchang: {
        tithi: { name: 'Shukla Chaturdashi', paksha: 'Shukla' },
        nakshatra: { name: 'Rohini', pada: 2 },
        yoga: { name: 'Shubha' },
        karana: { name: 'Vanija' },
        sun_longitude: sampleRef.lahiriSunLonDeg,
        moon_longitude: sampleRef.lahiriMoonLonDeg,
      },
    },
    vimshottari_dasha: {
      birth_balance: { lord: 'Moon', remaining_years: 7.4356, full_duration_years: 10 },
      mahadashas: [
        { lord: 'Moon', start_date: '1985-12-25', end_date: '1993-06-01' },
        { lord: 'Mars', start_date: '1993-06-01', end_date: '2000-06-01' },
        { lord: 'Rahu', start_date: '2000-06-01', end_date: '2018-06-01' },
      ],
    },
  });
  const panDashaCmp = compareModeAVsModeBResponses(
    panchangDashaModeA,
    panchangDashaModeB,
    sampleInstant
  );
  assert(
    panDashaCmp.panchangAudit?.birthInstantSource === 'request_time_panchang' &&
      panDashaCmp.panchangAudit?.requestTimePanchangEquivalent === true &&
      panDashaCmp.panchangAudit?.equivalent === true &&
      panDashaCmp.panchangAudit?.dailyCalendarDifferences.length === 3 &&
      panDashaCmp.dashaAudit?.isSingleCalendarDayRolloverBalanceArtifact === true &&
      panDashaCmp.dashaAudit?.durationMismatches.length === 0 &&
      panDashaCmp.dashaAudit?.calendarDateRolloverShifts.length === 3 &&
      panDashaCmp.dashaEquivalent === false,
    `Panchang request_time_panchang / Vimshottari rollover test failed: ${JSON.stringify(panDashaCmp)}`
  );
  const partialWithPanProbe: LayerARawProviderRecord = {
    ...syntheticPartialLayerA,
    timezoneEquivalenceCheck: panDashaCmp,
  };
  const panVerificationReport = verifyMasterChartRecord(partialMaster, partialWithPanProbe);
  assert(
    panVerificationReport.epistemicClassification.internalMathConsistencyVerified.some(
      (i) => i.key === 'panchang_request_time_equivalence' && i.status === 'verified'
    ) &&
      panVerificationReport.epistemicClassification.methodologyUnresolved.some(
        (i) => i.key === 'vimshottari_birth_balance_rollover_artifact'
      ),
    'Epistemic classification for request_time_panchang and Vimshottari 0.0027y rollover artifact failed.'
  );
  regressionResults.push({
    id: 'panchang_request_time_and_vimshottari_rollover_audit',
    status: 'PASSED',
    requestTimePanchangEquivalent: panDashaCmp.panchangAudit?.requestTimePanchangEquivalent,
    dailyCalendarDifferencesSeparated: panDashaCmp.panchangAudit?.dailyCalendarDifferences.length,
    dashaRolloverShiftsSeparated: panDashaCmp.dashaAudit?.calendarDateRolloverShifts.length,
    dashaRemainingYearsDelta: panDashaCmp.dashaAudit?.birthBalanceRemainingYearsDelta,
  });

  // 3j. Zero-byte Worker isolate heap rejection test
  assert(normalizePositiveHeapBytes(0) === null, '0 heap bytes must normalize to null');
  assert(normalizePositiveHeapBytes(-5) === null, 'Negative heap bytes must normalize to null');
  const zeroHeapTelemetry = summarizeRuntimeHeapTelemetry(0, 0);
  const validHeapTelemetry = summarizeRuntimeHeapTelemetry(10_000_000, 12_500_000);
  assert(
    zeroHeapTelemetry.heapMemoryStatus === 'unavailable_in_worker_isolate' &&
      zeroHeapTelemetry.heapBeforeBytes === null &&
      zeroHeapTelemetry.heapAfterBytes === null &&
      zeroHeapTelemetry.heapDeltaBytes === null &&
      validHeapTelemetry.heapMemoryStatus === 'measured' &&
      validHeapTelemetry.heapDeltaBytes === 2_500_000,
    `Heap telemetry guard failed: zero=${JSON.stringify(zeroHeapTelemetry)} valid=${JSON.stringify(validHeapTelemetry)}`
  );
  regressionResults.push({
    id: 'worker_zero_byte_heap_rejection',
    status: 'PASSED',
    zeroBytesStatus: zeroHeapTelemetry.heapMemoryStatus,
    positiveBytesStatus: validHeapTelemetry.heapMemoryStatus,
  });

  // 3k. Isolated AstroWay Chris 4 evaluation preflight & secret redaction test
  const astroWayPlan = buildAstroWayChris4EvaluationPlan(sampleInstant);
  const blockedAstroWayBundle = await executeAstroWayEvaluationBundle(sampleInstant, { apiKey: '' });
  const fakeAwKey = 'aw_live_secret_preflight_token';
  const redactedCheck = redactSecretsDeep(
    { headers: { 'x-api-key': fakeAwKey }, text: `Bearer ${fakeAwKey}` },
    [fakeAwKey]
  );
  assert(
    astroWayPlan.validationErrors.length === 0 &&
      astroWayPlan.requests.length === 67 &&
      astroWayPlan.requests.some((r) => r.path === '/vedic/shadbala/kala') &&
      astroWayPlan.requests.some((r) => r.path === '/vedic/bhavabala' && r.declaredQuality === 'yellow') &&
      astroWayPlan.requests.some((r) => r.path === '/vedic/ashtakavarga/shodhana' && r.declaredQuality === 'yellow') &&
      astroWayPlan.requests.some((r) => r.path === '/vedic/varga/D60') &&
      astroWayPlan.requests.some((r) => r.path === '/hellenistic/brennan/lots-15') &&
      blockedAstroWayBundle.status === 'blocked_missing_api_key' &&
      redactedCheck.headers['x-api-key'] === '[REDACTED]' &&
      !JSON.stringify(redactedCheck).includes(fakeAwKey),
    'AstroWay Chris 4 evaluation preflight or redaction test failed.'
  );
  regressionResults.push({
    id: 'astroway_chris4_evaluation_preflight',
    status: 'PASSED',
    plannedEndpoints: astroWayPlan.requests.length,
    freeTierCredits: astroWayPlan.accessRequirements.freeTierCreditsPerMonth,
    blockedStatusWithoutKey: blockedAstroWayBundle.status,
  });

  // 3l. AstroWay Layer A -> Layer B normalization, partial 402 preservation, Kala Mode A/B & epistemic audit
  const makeAwCall = (
    id: string,
    endpoint: string,
    category: string,
    rawData: unknown,
    opts?: { ok?: boolean; httpStatus?: number; accessRestricted?: boolean; declaredQuality?: 'green' | 'yellow' }
  ): SanitizedProviderCallRecord => ({
    id,
    endpoint,
    method: 'POST',
    timestampUtc: new Date().toISOString(),
    sanitizedRequest: { latitude: sampleInstant.input.latitude, longitude: sampleInstant.input.longitude },
    httpStatus: opts?.httpStatus ?? 200,
    ok: opts?.ok ?? true,
    attempts: 1,
    rateWaitMs: 0,
    coordinationMode: 'isolate_memory_only',
    latencyMs: 55,
    payloadBytes: 800,
    category,
    declaredQuality: opts?.declaredQuality ?? 'green',
    accessRestricted: opts?.accessRestricted ?? false,
    creditsUsed: opts?.ok === false ? 0 : 1,
    quotaAndMetaHeaders: { 'x-credits-used': '1', 'x-credits-remaining': '9950' },
    errorMessage: opts?.ok === false ? `HTTP ${opts.httpStatus ?? 402}` : null,
    rawResponse: opts?.ok === false ? { error: 'tier_restricted' } : { ok: true, data: rawData },
  });

  const awTropCusps = sampleRef.tropicalPlacidusCusps;
  const awKpCusps = sampleRef.kpPlacidusCuspsDeg.map((deg, idx) => {
    const nak = getNakshatraAndSubs(deg);
    return {
      house: idx + 1,
      longitude: deg,
      signName: SIGNS[Math.floor(deg / 30) % 12],
      starLordName: nak.nakshatraLord,
      subName: nak.subLord,
      subSubName: nak.subSubLord,
    };
  });
  const awSunKp = normalizeDeg(sampleRef.tropicalSunLonDeg - kpAyRef);
  const awMoonKp = normalizeDeg(sampleRef.tropicalMoonLonDeg - kpAyRef);
  const awSunKpH = findKpHouse(awSunKp);
  const awMoonKpH = findKpHouse(awMoonKp);

  const mockAwLayerA: LayerARawProviderRecord = {
    schemaVersion: 'v2.raw.1.0',
    capturedAtUtc: new Date().toISOString(),
    providerId: 'astroway',
    providerLabel: 'AstroWay V1 API',
    providerBaseUrl: 'https://api.astroway.info/v1',
    inputFingerprint: sampleInstant.inputFingerprint,
    canonicalUtcIso: sampleInstant.utc.iso,
    canonicalJulianDayUt: sampleInstant.utc.julianDayUt,
    acquisitionStatus: 'partial',
    missingDatasets: ['jaimini_yogas (/vedic/jaimini/yogas): [TIER_RESTRICTED] HTTP 402'],
    validationFailures: [],
    calls: {
      chart_sidereal: makeAwCall('chart_sidereal', '/chart', 'natal_core', {
        julianDay: sampleInstant.utc.julianDayUt,
        siderealTime: 5.5,
        houses: { system: 'W', ascendant: sampleRef.lahiriAscendantDeg, mc: sampleRef.lahiriMcDeg, cusps: Array.from({ length: 12 }, (_, i) => normalizeDeg(Math.floor(sampleRef.lahiriAscendantDeg / 30) * 30 + i * 30)) },
        planets: [
          { name: 'Sun', longitude: sampleRef.lahiriSunLonDeg, latitude: 0, distance: 0.983, speedLong: 1.01, isRetrograde: false, declination: -23.4, rightAscension: 270 },
          { name: 'Moon', longitude: sampleRef.lahiriMoonLonDeg, latitude: 1.2, distance: 0.0025, speedLong: 13.1, isRetrograde: false, declination: 21.1, rightAscension: 68 },
          { name: 'Mars', longitude: 185, isRetrograde: false },
          { name: 'Mercury', longitude: 230, isRetrograde: false },
          { name: 'Jupiter', longitude: 295, isRetrograde: false },
          { name: 'Venus', longitude: 245, isRetrograde: false },
          { name: 'Saturn', longitude: 221, isRetrograde: false },
          { name: 'Mean Node', longitude: 11.5, isRetrograde: true },
          { name: 'South Node', longitude: 191.5, isRetrograde: true },
        ],
      }),
      chart_tropical: makeAwCall('chart_tropical', '/chart', 'natal_core', {
        julianDay: sampleInstant.utc.julianDayUt,
        houses: { system: 'P', ascendant: sampleRef.tropicalAscendantDeg, mc: sampleRef.tropicalMcDeg, cusps: awTropCusps },
        planets: [
          { name: 'Sun', longitude: sampleRef.tropicalSunLonDeg },
          { name: 'Moon', longitude: sampleRef.tropicalMoonLonDeg },
          { name: 'Mars', longitude: 209 },
          { name: 'Mercury', longitude: 254 },
          { name: 'Jupiter', longitude: 319 },
          { name: 'Venus', longitude: 269 },
          { name: 'Saturn', longitude: 245 },
          { name: 'Uranus', longitude: 259 },
          { name: 'Neptune', longitude: 273 },
          { name: 'Pluto', longitude: 216 },
        ],
        aspects: [
          {
            planet1: { name: 'Sun' },
            planet2: { name: 'Venus' },
            type: { name: 'Conjunction', angle: 0 },
            orb: Number(
              (() => {
                let d = Math.abs(sampleRef.tropicalSunLonDeg - 269);
                if (d > 180) d = 360 - d;
                return d;
              })().toFixed(2)
            ),
          },
        ],
        parallelAspects: [{ planet1: 'Sun', planet2: 'Venus', type: 'Parallel', orb: 0.4 }],
        houseAspects: [{ planet: 'Sun', house: 10, aspect: 'Conjunction' }],
        antiscia: [{ planet: 'Sun', antiscionLongitude: 86.9 }],
        antisciaAspects: [],
      }),
      vedic_kundli: makeAwCall('vedic_kundli', '/vedic/kundli', 'natal_core', {
        ayanamsa: 'lahiri',
        lagna: { longitude: sampleRef.lahiriAscendantDeg, signName: SIGNS[Math.floor(sampleRef.lahiriAscendantDeg / 30) % 12] },
        nakshatra: { name: 'Rohini', pada: 2 },
        dasha: { current: { maha: 'Saturn', antar: 'Mercury' } },
        yogas: { present: ['Raja Yoga', 'Hamsa Mahapurusha Yoga'], dhana: { present: true, contributingPlanets: ['Jupiter', 'Venus'] } },
        doshas: { present: [] },
        grahas: [
          { name: 'Sun', longitude: sampleRef.lahiriSunLonDeg },
          { name: 'Moon', longitude: sampleRef.lahiriMoonLonDeg },
          { name: 'Mars', longitude: 185 },
          { name: 'Mercury', longitude: 230 },
          { name: 'Jupiter', longitude: 295 },
          { name: 'Venus', longitude: 245 },
          { name: 'Saturn', longitude: 221 },
          { name: 'Rahu', longitude: 12.5352, isRetrograde: true },
          { name: 'Ketu', longitude: 192.5352, isRetrograde: true },
        ],
      }),
      vedic_panchang_full: makeAwCall('vedic_panchang_full', '/vedic/panchang/full', 'natal_core', {
        sunrise: '06:17:00',
        sunset: '16:56:00',
        tithi: { name: 'Shukla Chaturdashi' },
        nakshatra: { name: 'Rohini', pada: 2 },
      }),
      ...Object.fromEntries(
        [1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60].map((div) => [
          `varga_D${div}`,
          makeAwCall(`varga_D${div}`, `/vedic/varga/D${div}`, 'varga', {
            varga: `D${div}`,
            ayanamsa: 23.66,
            lagna: { signName: SIGNS[getVargaSignIndex(sampleRef.lahiriAscendantDeg, div)] },
            planets: [
              { name: 'Sun', signName: SIGNS[getVargaSignIndex(sampleRef.lahiriSunLonDeg, div)], longitude: sampleRef.lahiriSunLonDeg },
              { name: 'Moon', signName: SIGNS[getVargaSignIndex(sampleRef.lahiriMoonLonDeg, div)], longitude: sampleRef.lahiriMoonLonDeg },
            ],
          }),
        ])
      ),
      shadbala_full: makeAwCall('shadbala_full', '/vedic/shadbala/full', 'shadbala', {
        items: [
          { planetName: 'Sun', sthana: 220, dig: 24, kala: 105, cheshta: 1, naisargika: 60, drik: 8, totalVirupa: 418, totalRupa: 6.97 },
          { planetName: 'Moon', sthana: 210, dig: 33, kala: 123, cheshta: 51, naisargika: 51.43, drik: -30, totalVirupa: 438.43, totalRupa: 7.31 },
          { planetName: 'Mars', sthana: 190, dig: 43, kala: 165, cheshta: 23, naisargika: 17.14, drik: 12, totalVirupa: 450.14, totalRupa: 7.5 },
          { planetName: 'Mercury', sthana: 256, dig: 58, kala: 127, cheshta: 27, naisargika: 25.71, drik: 14, totalVirupa: 507.71, totalRupa: 8.46 },
          { planetName: 'Jupiter', sthana: 126, dig: 37, kala: 142, cheshta: 17, naisargika: 34.29, drik: -29, totalVirupa: 327.29, totalRupa: 5.45 },
          { planetName: 'Venus', sthana: 151, dig: 34, kala: 72, cheshta: 3, naisargika: 42.86, drik: 10, totalVirupa: 312.86, totalRupa: 5.21 },
          { planetName: 'Saturn', sthana: 214, dig: 2, kala: 104, cheshta: 11, naisargika: 8.57, drik: 15, totalVirupa: 354.57, totalRupa: 5.91 },
        ],
      }),
      shadbala_sthana: makeAwCall('shadbala_sthana', '/vedic/shadbala/sthana', 'shadbala', { items: [] }),
      shadbala_kala: makeAwCall('shadbala_kala', '/vedic/shadbala/kala', 'shadbala', {
        items: [
          { planetName: 'Sun', nathonnatha: 20, paksha: 30, tribhaga: 10, abdaMasaVaraHora: 15, ayana: 30, yuddha: 0, total: 105 },
          { planetName: 'Moon', nathonnatha: 40, paksha: 45, tribhaga: 8, abdaMasaVaraHora: 15, ayana: 15, yuddha: 0, total: 123 },
          { planetName: 'Mars', nathonnatha: 50, paksha: 30, tribhaga: 20, abdaMasaVaraHora: 45, ayana: 20, yuddha: 0, total: 165 },
          { planetName: 'Mercury', nathonnatha: 60, paksha: 20, tribhaga: 10, abdaMasaVaraHora: 20, ayana: 17, yuddha: 0, total: 127 },
          { planetName: 'Jupiter', nathonnatha: 50, paksha: 40, tribhaga: 15, abdaMasaVaraHora: 15, ayana: 22, yuddha: 0, total: 142 },
          { planetName: 'Venus', nathonnatha: 20, paksha: 20, tribhaga: 10, abdaMasaVaraHora: 12, ayana: 10, yuddha: 0, total: 72 },
          { planetName: 'Saturn', nathonnatha: 40, paksha: 30, tribhaga: 10, abdaMasaVaraHora: 12, ayana: 12, yuddha: 0, total: 104 },
        ],
      }),
      shadbala_ishta_kashta: makeAwCall('shadbala_ishta_kashta', '/vedic/shadbala/ishta-kashta', 'shadbala', { items: [{ planetName: 'Sun', ishta: 32, kashta: 28 }] }, { declaredQuality: 'yellow' }),
      bhavabala: makeAwCall('bhavabala', '/vedic/bhavabala', 'bhavabala', { houses: [] }, { declaredQuality: 'yellow' }),
      yogas_parashara_full: makeAwCall('yogas_parashara_full', '/vedic/yogas/parashara/full', 'yoga_dosha', {
        raja: { present: true, strength: 'strong', contributingPlanets: ['Jupiter', 'Venus'], details: ['9L + 10L link'] },
        dhana: { present: true, strength: 'moderate', contributingPlanets: ['Jupiter', 'Mercury'], details: ['2L + 11L link'] },
        dharmaKarmadhipati: { present: false, contributingPlanets: [] },
        gajakesari: { present: false, details: [] },
        adhi: { present: false, contributingPlanets: [] },
        panchaMahapurusha: {
          presentCount: 1,
          yogas: [
            { yogaName: 'Hamsa Mahapurusha Yoga', planetName: 'Jupiter', present: false },
            { yogaName: 'Ruchaka Mahapurusha Yoga', planetName: 'Mars', present: true, sign: 'Capricorn', house: 10 },
          ],
        },
      }),
      yogas_jaimini_full: makeAwCall('yogas_jaimini_full', '/vedic/yogas/jaimini/full', 'yoga_dosha', {
        raja: { present: true, description: 'AK + AmK mutual aspect' },
        dhana: { present: false },
        daridra: { present: false },
        viparita: { present: false },
      }),
      doshas_parashara_full: makeAwCall('doshas_parashara_full', '/vedic/doshas/parashara/full', 'yoga_dosha', {
        mangal: { present: false },
        kaalSarp: { present: false },
      }),
      kp_sub_lords: makeAwCall('kp_sub_lords', '/vedic/kp/sub-lords', 'kp', {
        cusps: awKpCusps,
        planets: [
          { grahaName: 'Sun', longitude: awSunKp },
          { grahaName: 'Moon', longitude: awMoonKp },
          { grahaName: 'Mean Node', longitude: 11.5 },
        ],
      }),
      kp_cusps: makeAwCall('kp_cusps', '/vedic/kp/cusps', 'kp', { ayanamsa: 23.56, method: 'placidus', cusps: awKpCusps }),
      kp_planet_cuspal_position: makeAwCall('kp_planet_cuspal_position', '/vedic/kp/planet-cuspal-position', 'kp', {
        planets: [
          { grahaName: 'Sun', house: awSunKpH },
          { grahaName: 'Moon', house: awMoonKpH },
        ],
      }),
      kp_significators: makeAwCall('kp_significators', '/vedic/kp/significators', 'kp', {
        significators: [
          { grahaName: 'Sun', levels: { l1: [], l2: [awSunKpH], l3: [], l4: sunOwned } },
          { grahaName: 'Moon', levels: { l1: [], l2: [awMoonKpH], l3: [], l4: moonOwned } },
        ],
      }),
      jaimini_yogas: makeAwCall('jaimini_yogas', '/vedic/jaimini/yogas', 'jaimini', null, { ok: false, httpStatus: 402, accessRestricted: true }),
      dashas_vimshottari_prana: makeAwCall('dashas_vimshottari_prana', '/vedic/dashas/vimshottari/prana', 'dasha', {
        initial: { initialPlanetName: 'Moon', balanceYears: 7.435, elapsedYears: 2.565 },
        periods: [{ planetName: 'Moon', startDate: '1985-12-25', endDate: '1993-06-01', durationYears: 7.435 }],
      }),
    },
    timezoneEquivalenceCheck: null,
    ephemerisTimestampCheck: null,
    quotaAndPerformanceSummary: {
      plannedRequestsCount: 33,
      totalCalls: 33,
      actualHttpRequestsSent: 33,
      retryCount: 0,
      successfulCalls: 32,
      failedCalls: 1,
      tierRestrictedCalls: 1,
      totalLatencyMs: 660,
      totalRateWaitMs: 0,
      totalPayloadBytes: 9600,
      coordinationModesObserved: ['isolate_memory_only'],
      quotaHeadersObserved: {
        status: 'measured_from_headers',
        observedHeadersByEndpoint: {},
        remainingQuotaObserved: 'x-credits-remaining: 9950',
        rateLimitObserved: null,
        creditsUsedTotal: 32,
        creditsRemainingFinal: '9950',
        tierRestrictedEndpoints: ['jaimini_yogas (/vedic/jaimini/yogas: HTTP 402)'],
        note: 'Mocked AstroWay test',
      },
    },
  };

  const awMaster = buildLayerBMasterChartRecord({ instant: sampleInstant, rawLayerA: mockAwLayerA });
  const awVerif = verifyMasterChartRecord(awMaster, mockAwLayerA);
  const awCmp = buildLegacyVsV2ComparisonReport({
    profileId: 'chris-4-aw',
    profileName: 'Chris 4 AstroWay',
    legacyChartJson: null,
    instant: sampleInstant,
    layerB: awMaster,
  });

  // Kala subcomponent Mode A vs Mode B delta detection test
  const awKalaProbe = compareAstroWayModeAVsModeBResponses({
    instant: sampleInstant,
    chartA: { id: 'a', path: '/chart', category: 'natal_core', declaredQuality: 'green', qualityCaveat: null, httpStatus: 200, ok: true, attempts: 1, accessRestricted: false, creditsUsed: 1, latencyMs: 10, payloadBytes: 10, creditAndMetaHeaders: {}, sanitizedRequest: {}, errorMessage: null, rawResponse: mockAwLayerA.calls.chart_sidereal.rawResponse },
    chartB: { id: 'b', path: '/chart', category: 'timezone_probe', declaredQuality: 'green', qualityCaveat: null, httpStatus: 200, ok: true, attempts: 1, accessRestricted: false, creditsUsed: 1, latencyMs: 10, payloadBytes: 10, creditAndMetaHeaders: {}, sanitizedRequest: {}, errorMessage: null, rawResponse: mockAwLayerA.calls.chart_sidereal.rawResponse },
    shadbalaFullA: { id: 'sfa', path: '/vedic/shadbala/full', category: 'shadbala', declaredQuality: 'green', qualityCaveat: null, httpStatus: 200, ok: true, attempts: 1, accessRestricted: false, creditsUsed: 1, latencyMs: 10, payloadBytes: 10, creditAndMetaHeaders: {}, sanitizedRequest: {}, errorMessage: null, rawResponse: mockAwLayerA.calls.shadbala_full.rawResponse },
    shadbalaFullB: {
      id: 'sfb', path: '/vedic/shadbala/full', category: 'timezone_probe', declaredQuality: 'green', qualityCaveat: null, httpStatus: 200, ok: true, attempts: 1, accessRestricted: false, creditsUsed: 1, latencyMs: 10, payloadBytes: 10, creditAndMetaHeaders: {}, sanitizedRequest: {}, errorMessage: null,
      rawResponse: {
        ok: true,
        data: {
          items: [
            { planetName: 'Sun', sthana: 220, dig: 24, kala: 120, cheshta: 1, naisargika: 60, drik: 8, totalVirupa: 433, totalRupa: 7.22 },
          ],
        },
      },
    },
    shadbalaKalaA: { id: 'ska', path: '/vedic/shadbala/kala', category: 'shadbala', declaredQuality: 'green', qualityCaveat: null, httpStatus: 200, ok: true, attempts: 1, accessRestricted: false, creditsUsed: 1, latencyMs: 10, payloadBytes: 10, creditAndMetaHeaders: {}, sanitizedRequest: {}, errorMessage: null, rawResponse: mockAwLayerA.calls.shadbala_kala.rawResponse },
    shadbalaKalaB: {
      id: 'skb', path: '/vedic/shadbala/kala', category: 'timezone_probe', declaredQuality: 'green', qualityCaveat: null, httpStatus: 200, ok: true, attempts: 1, accessRestricted: false, creditsUsed: 1, latencyMs: 10, payloadBytes: 10, creditAndMetaHeaders: {}, sanitizedRequest: {}, errorMessage: null,
      rawResponse: {
        ok: true,
        data: {
          items: [
            { planetName: 'Sun', nathonnatha: 20, paksha: 30, tribhaga: 10, abdaMasaVaraHora: 30, ayana: 30, yuddha: 0, total: 120 },
          ],
        },
      },
    },
  });

  const awFailedChecks = awVerif.checks.filter((c) => !c.passed).map((c) => `${c.id}: ${c.observed}`);
  assert(
    awMaster.providerId === 'astroway' &&
      awMaster.frames.vedicLahiri.data?.planets.some((p) => p.name === 'Rahu') &&
      awMaster.frames.vedicLahiri.data?.yogas?.items.length === 4 &&
      awMaster.frames.kpPlacidus.data?.cusps.length === 12 &&
      awMaster.frames.westernTropical.data?.houses.length === 12 &&
      awMaster.frames.astronomicalTelemetry.data?.bodies.Sun !== undefined &&
      awMaster.shadbalaReconciliation.data?.authoritativeDesignation === 'unassigned_pending_reconciliation' &&
      awVerif.mode === 'live_and_offline' &&
      awVerif.failedCount === 0 &&
      awVerif.epistemicClassification.independentlyValidatedAgainstExternalReference.length === 0 &&
      awVerif.epistemicClassification.methodologyUnresolved.some((i) => i.key === 'astroway_yellow_bhavabala') &&
      awVerif.epistemicClassification.datasetUnavailable.some((i) => i.key === 'astroway_failed_jaimini_yogas') &&
      awCmp.primaryCoordinatesComparison.ascendant.v2ProviderDeg !== null &&
      awKalaProbe.shadbalaComparison?.perPlanet[0]?.subcomponentDeltas?.abdaMasaVaraHora === -15,
    `AstroWay normalization, epistemic audit, and Kala Mode A/B probe test failed. failedChecks=${JSON.stringify(awFailedChecks)}`
  );
  regressionResults.push({
    id: 'astroway_normalization_epistemic_and_kala_probe',
    status: 'PASSED',
    verificationMode: awVerif.mode,
    failedCount: awVerif.failedCount,
    normalizedActiveYogas: awMaster.frames.vedicLahiri.data?.yogas?.items.length ?? 0,
    externalBucketCount: awVerif.epistemicClassification.independentlyValidatedAgainstExternalReference.length,
    detectedSunAbdaMasaVaraHoraDelta: awKalaProbe.shadbalaComparison?.perPlanet[0]?.subcomponentDeltas?.abdaMasaVaraHora,
  });

  // 3m. AstroWay Rate-Limit Header Parsing (Retry-After + x-ratelimit-reset + remaining=0)
  const fixedNow = Date.UTC(2026, 10, 27, 10, 0, 0);
  const parsedSec = parseAstroWayRateLimitHeaders(
    {
      'retry-after': '47',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-limit': '10',
    },
    fixedNow
  );
  const parsedEpochReset = parseAstroWayRateLimitHeaders(
    {
      'x-ratelimit-reset': String(Math.floor(fixedNow / 1000) + 52),
      'x-ratelimit-remaining': '0',
    },
    fixedNow
  );
  assert(
    parsedSec.retryAfterMs === 47_000 &&
      parsedSec.remaining === 0 &&
      parsedSec.limit === 10 &&
      parsedEpochReset.retryAfterMs !== null &&
      parsedEpochReset.retryAfterMs >= 51_000 &&
      parsedEpochReset.retryAfterMs <= 52_500,
    'AstroWay rate-limit header parser failed.'
  );
  regressionResults.push({ id: 'astroway_rate_limit_header_parsing', status: 'PASSED' });

  // 3n. Priority Tier 1 Order + Cooldown Halt & Resumable Batch without Re-Calling Settled Endpoints
  const awPlanSpecs = buildAstroWayChris4EvaluationPlan(sampleInstant, { timeMode: 'local_iana' });
  const awProbeSpecs = buildAstroWayProbeSpecs(sampleInstant, true);
  const orderedSpecs = orderAstroWaySpecsForPriorityVerification(awPlanSpecs.requests, awProbeSpecs);
  assert(
    orderedSpecs[0].id === 'chart_sidereal' &&
      orderedSpecs[1].id === 'timezone_probe_mode_b_chart' &&
      orderedSpecs[2].id === 'shadbala_full' &&
      orderedSpecs[3].id === 'timezone_probe_mode_b_shadbala_full' &&
      orderedSpecs[4].id === 'shadbala_kala' &&
      orderedSpecs[5].id === 'timezone_probe_mode_b_shadbala_kala' &&
      orderedSpecs[8].id === 'bhavabala',
    'Priority Tier 1 ordering for AstroWay failed.'
  );

  await resetAstroWayIsolateRateStateForTests();
  const calledPathsBatch1: string[] = [];
  const mockFetchBatch1 = async (url: string, _init?: RequestInit): Promise<Response> => {
    const pathname = new URL(url).pathname;
    calledPathsBatch1.push(pathname);
    if (calledPathsBatch1.length === 1) {
      return new Response(
        JSON.stringify({ ok: true, data: mockAwLayerA.calls.chart_sidereal.rawResponse }),
        { status: 200, headers: { 'x-ratelimit-remaining': '8', 'x-ratelimit-limit': '10' } }
      );
    }
    if (calledPathsBatch1.length === 2) {
      return new Response(JSON.stringify({ ok: false, message: 'Upgrade required' }), {
        status: 402,
        headers: { 'x-ratelimit-remaining': '7', 'x-ratelimit-limit': '10' },
      });
    }
    return new Response(JSON.stringify({ ok: false, message: 'Rate limit exceeded' }), {
      status: 429,
      headers: {
        'retry-after': '48',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-limit': '10',
      },
    });
  };

  const batch1 = await executeAstroWayBatchedBundle(sampleInstant, {
    apiKey: 'test-key-redacted',
    includeTimezoneEquivalenceProbe: true,
    sessionId: 'sess-test-1',
    batchSize: 8,
    fetchFn: mockFetchBatch1,
  });
  assert(
    calledPathsBatch1.length === 3 &&
      batch1.batchState.status === 'waiting_rate_limit' &&
      batch1.batchState.retryAfterMs > 40_000 &&
      batch1.layerA.quotaAndPerformanceSummary.actualHttpRequestsSent === 3 &&
      batch1.layerA.calls.shadbala_kala.attempts === 0 &&
      batch1.layerA.calls.shadbala_kala.acquisitionClassification === 'not_yet_tested' &&
      batch1.layerA.calls.shadbala_full.acquisitionClassification === 'rate_limited' &&
      batch1.layerA.calls.timezone_probe_mode_b_chart.acquisitionClassification === 'tier_restricted',
    'Batched AstroWay cooldown halt & 7-state classification failed.'
  );

  // Attempting resume inside active cooldown must NOT send any HTTP request
  let calledDuringCooldown = 0;
  const blockedDuringCooldown = await executeAstroWayBatchedBundle(sampleInstant, {
    apiKey: 'test-key-redacted',
    includeTimezoneEquivalenceProbe: true,
    sessionId: 'sess-test-1',
    existingCalls: batch1.updatedCalls,
    batchSize: 8,
    batchIndex: 2,
    fetchFn: async () => {
      calledDuringCooldown++;
      return new Response('{}', { status: 200 });
    },
  });
  assert(
    calledDuringCooldown === 0 &&
      blockedDuringCooldown.batchState.executedThisBatch === 0 &&
      blockedDuringCooldown.batchState.status === 'waiting_rate_limit',
    'Cooldown guard failed to block early request.'
  );

  // After reset window expires, resume must skip settled 200 & 402 and retry 429 shadbala_full first
  await resetAstroWayIsolateRateStateForTests();
  const calledPathsBatch2: string[] = [];
  const batch2 = await executeAstroWayBatchedBundle(sampleInstant, {
    apiKey: 'test-key-redacted',
    includeTimezoneEquivalenceProbe: true,
    sessionId: 'sess-test-1',
    existingCalls: batch1.updatedCalls,
    batchSize: 3,
    batchIndex: 2,
    resumedFromSession: true,
    fetchFn: async (url: string) => {
      calledPathsBatch2.push(new URL(url).pathname);
      return new Response(JSON.stringify({ ok: true, data: { items: [] } }), {
        status: 200,
        headers: { 'x-ratelimit-remaining': '7', 'x-ratelimit-limit': '10' },
      });
    },
  });
  assert(
    calledPathsBatch2.length === 3 &&
      calledPathsBatch2[0].endsWith('/vedic/shadbala/full') &&
      batch2.updatedCalls.chart_sidereal.ok &&
      batch2.updatedCalls.timezone_probe_mode_b_chart.acquisitionClassification === 'tier_restricted',
    `Batched resume failed to preserve settled 200/402 calls and retry 429 (paths=${JSON.stringify(calledPathsBatch2)}).`
  );
  await resetAstroWayIsolateRateStateForTests();
  regressionResults.push({ id: 'astroway_batched_cooldown_halt_and_resume', status: 'PASSED' });

  // 3s. Session-Aware Diagnostic Lock Contention, Release, Renewal & Stale-Lock Recovery
  resetV2DiagnosticLockForTests();
  const lockA = await acquireV2DiagnosticRunLock({
    adminUserId: 'admin-1',
    profileId: 'chris-4',
    sessionId: 'sess-lock-A',
    provider: 'astroway',
  });
  assert(lockA.acquired && Boolean(lockA.lockId), 'Session A should acquire diagnostic lock.');

  // Unrelated session B and FreeAstroAPI non-session run must be rejected with conflict
  const lockBBlocked = await acquireV2DiagnosticRunLock({
    adminUserId: 'admin-1',
    profileId: 'chris-4',
    sessionId: 'sess-lock-B',
    provider: 'astroway',
  });
  const lockFreeBlocked = await acquireV2DiagnosticRunLock({
    adminUserId: 'admin-1',
    profileId: 'chris-4',
    sessionId: null,
    provider: 'freeastroapi',
  });
  assert(
    !lockBBlocked.acquired &&
      lockBBlocked.code === 'DIAGNOSTIC_RUN_IN_PROGRESS' &&
      !lockFreeBlocked.acquired &&
      lockFreeBlocked.code === 'DIAGNOSTIC_RUN_IN_PROGRESS',
    'Active Session A lock failed to block unrelated concurrent runs.'
  );

  // Lock renewal succeeds for valid lockId and fails for invalid lockId
  const renewedValid = await renewV2DiagnosticRunLock({ lockId: lockA.lockId, sessionId: 'sess-lock-A' });
  const renewedInvalid = await renewV2DiagnosticRunLock({ lockId: 'wrong-lock-id', sessionId: 'sess-lock-A' });
  assert(renewedValid && !renewedInvalid, 'Diagnostic lock renewal validation failed.');

  // Pre-response release frees Session A to immediately resume Batch 2
  await releaseV2DiagnosticRunLock({
    adminUserId: 'admin-1',
    profileId: 'chris-4',
    lockId: lockA.lockId,
    sessionId: 'sess-lock-A',
  });
  const lockABatch2 = await acquireV2DiagnosticRunLock({
    adminUserId: 'admin-1',
    profileId: 'chris-4',
    sessionId: 'sess-lock-A',
    provider: 'astroway',
  });
  assert(lockABatch2.acquired && Boolean(lockABatch2.lockId), 'Same session Batch 2 failed after release.');

  // Same-session manual resume takeover after stalled worker (>3s without heartbeat)
  setV2DiagnosticLockClockOffsetForTests(4_500);
  const lockASameSessionResume = await acquireV2DiagnosticRunLock({
    adminUserId: 'admin-1',
    profileId: 'chris-4',
    sessionId: 'sess-lock-A',
    provider: 'astroway',
    allowSameSessionResume: true,
  });
  assert(
    lockASameSessionResume.acquired && lockASameSessionResume.recoveredStaleLock === true,
    'Same-session manual resume should reclaim stalled lock of same session.'
  );

  // Stale heartbeat expiry (>20s) allows unrelated session B to recover abandoned lock
  setV2DiagnosticLockClockOffsetForTests(30_000);
  const lockBRecovered = await acquireV2DiagnosticRunLock({
    adminUserId: 'admin-1',
    profileId: 'chris-4',
    sessionId: 'sess-lock-B',
    provider: 'astroway',
  });
  assert(
    lockBRecovered.acquired && lockBRecovered.recoveredStaleLock === true,
    'Stale abandoned lock was not recovered after heartbeat expiry.'
  );
  resetV2DiagnosticLockForTests();
  regressionResults.push({ id: 'session_aware_lock_contention_renewal_and_recovery', status: 'PASSED' });

  // 3t. Queued vs Failed Aggregate Counter Accuracy (8 acquired + 64 queued => 0 failed)
  await resetAstroWayIsolateRateStateForTests();
  const batch8Queued64 = await executeAstroWayBatchedBundle(sampleInstant, {
    apiKey: 'test-key-redacted',
    includeTimezoneEquivalenceProbe: true,
    sessionId: 'sess-queued-counter',
    batchSize: 8,
    skipGlobalCooldown: true,
    fetchFn: async () =>
      new Response(JSON.stringify({ ok: true, data: { items: [] } }), {
        status: 200,
        headers: { 'x-ratelimit-remaining': '9', 'x-ratelimit-limit': '10' },
      }),
  });
  assert(
    batch8Queued64.layerA.quotaAndPerformanceSummary.successfulCalls === 8 &&
      batch8Queued64.layerA.quotaAndPerformanceSummary.unexecutedCalls === 64 &&
      batch8Queued64.layerA.quotaAndPerformanceSummary.failedCalls === 0 &&
      batch8Queued64.batchState.status === 'in_progress' &&
      batch8Queued64.batchState.remainingEligibleCount === 64,
    `Queued requests miscounted as failed (ok=${batch8Queued64.layerA.quotaAndPerformanceSummary.successfulCalls}, failed=${batch8Queued64.layerA.quotaAndPerformanceSummary.failedCalls}, queued=${batch8Queued64.layerA.quotaAndPerformanceSummary.unexecutedCalls}).`
  );
  regressionResults.push({ id: 'queued_not_counted_as_failed_aggregate_counter', status: 'PASSED' });

  // 3u. Full Multi-Batch Continuation (0 -> Terminal State) Across 429 Cooldowns & Persistent Failures
  await resetAstroWayIsolateRateStateForTests();
  const multiBatchCallCounts = new Map<string, number>();
  let totalHttpSentSimulated = 0;
  let existingCallsAcc: Record<string, SanitizedProviderCallRecord> | undefined;
  let mbBatchIndex = 0;
  let priorWaitAcc = 0;
  let finalBatchResult: Awaited<ReturnType<typeof executeAstroWayBatchedBundle>> | null = null;
  let loops = 0;
  const multiBatchSessionId = 'sess-full-multibatch';

  while (loops < 20) {
    loops++;
    const step = await executeAstroWayBatchedBundle(sampleInstant, {
      apiKey: 'test-key-redacted',
      includeTimezoneEquivalenceProbe: true,
      sessionId: multiBatchSessionId,
      existingCalls: existingCallsAcc,
      batchSize: 8,
      batchIndex: mbBatchIndex,
      priorRateLimitWindowWaitMs: priorWaitAcc,
      resumedFromSession: mbBatchIndex > 0,
      fetchFn: async (url: string) => {
        totalHttpSentSimulated++;
        const p = new URL(url).pathname;
        const count = (multiBatchCallCounts.get(p) || 0) + 1;
        multiBatchCallCounts.set(p, count);

        // Trigger a 429 cooldown once on request #12, then recover cleanly on retry
        if (totalHttpSentSimulated === 12) {
          return new Response(JSON.stringify({ ok: false, message: 'Rate limited' }), {
            status: 429,
            headers: { 'retry-after': '1', 'x-ratelimit-remaining': '0', 'x-ratelimit-limit': '10' },
          });
        }
        // Tier-restricted endpoint (402) must settle immediately without retry
        if (p.endsWith('/vedic/jaimini/yogas')) {
          return new Response(JSON.stringify({ ok: false, message: 'Tier restricted' }), { status: 402 });
        }
        // Persistent HTTP 500 must retry at most once (2 total attempts) and settle to reach terminal state
        if (p.endsWith('/vedic/kp/fortuna')) {
          return new Response(JSON.stringify({ ok: false, message: 'Server error' }), { status: 500 });
        }
        return new Response(JSON.stringify({ ok: true, data: { items: [] } }), {
          status: 200,
          headers: { 'x-ratelimit-remaining': '8', 'x-ratelimit-limit': '10' },
        });
      },
    });

    existingCallsAcc = step.updatedCalls;
    mbBatchIndex = step.batchState.batchIndex;
    priorWaitAcc = step.batchState.totalRateLimitWindowWaitMs;
    finalBatchResult = step;

    // Every intermediate queued state must report failedCalls only for actual non-200 attempts, never queued items
    assert(
      step.layerA.quotaAndPerformanceSummary.unexecutedCalls ===
        step.batchState.classificationCounts.not_yet_tested,
      'Unexecuted count mismatch during multi-batch loop.'
    );

    if (step.batchState.status === 'waiting_rate_limit') {
      // Simulate cooldown expiry without waiting full wall clock
      await resetAstroWayIsolateRateStateForTests();
      continue;
    }
    if (
      step.batchState.status === 'completed' ||
      step.batchState.status === 'completed_with_restrictions' ||
      step.batchState.remainingEligibleCount === 0
    ) {
      break;
    }
  }

  assert(
    finalBatchResult !== null &&
      loops < 20 &&
      finalBatchResult.batchState.status === 'completed_with_restrictions' &&
      finalBatchResult.batchState.remainingEligibleCount === 0 &&
      finalBatchResult.layerA.quotaAndPerformanceSummary.totalCalls === 72 &&
      finalBatchResult.layerA.quotaAndPerformanceSummary.unexecutedCalls === 0 &&
      finalBatchResult.layerA.quotaAndPerformanceSummary.successfulCalls === 70 &&
      finalBatchResult.layerA.quotaAndPerformanceSummary.tierRestrictedCalls === 1 &&
      finalBatchResult.layerA.quotaAndPerformanceSummary.runtimeBlockedCalls === 1 &&
      finalBatchResult.layerA.quotaAndPerformanceSummary.actualHttpRequestsSent === 74 &&
      finalBatchResult.layerA.quotaAndPerformanceSummary.retryCount === 2,
    `Full 72-endpoint multi-batch loop failed (status=${finalBatchResult?.batchState.status}, loops=${loops}, ok=${finalBatchResult?.layerA.quotaAndPerformanceSummary.successfulCalls}, sent=${finalBatchResult?.layerA.quotaAndPerformanceSummary.actualHttpRequestsSent}, retries=${finalBatchResult?.layerA.quotaAndPerformanceSummary.retryCount}).`
  );
  regressionResults.push({
    id: 'astroway_full_multibatch_continuation_to_terminal_state',
    status: 'PASSED',
    batchesExecuted: loops,
    totalHttpRequestsSent: finalBatchResult!.layerA.quotaAndPerformanceSummary.actualHttpRequestsSent,
    retryCount: finalBatchResult!.layerA.quotaAndPerformanceSummary.retryCount,
    terminalStatus: finalBatchResult!.batchState.status,
  });

  // 3v. Interrupted 8/72 Session Persistence, Discovery & Recovery Without Repeating Settled Calls
  resetAstroWayIsolateSessionsForTests();
  await resetAstroWayIsolateRateStateForTests();
  const interruptedSessionId = 'sess-interrupted-8-of-72';
  await saveAstroWayBatchSession({
    sessionId: interruptedSessionId,
    providerId: 'astroway',
    // Intentionally omit profileId to match legacy pre-fix Batch 1 stored row shape
    inputFingerprint: sampleInstant.inputFingerprint,
    includeTimezoneEquivalenceProbe: true,
    batchIndex: 1,
    totalRateLimitWindowWaitMs: 0,
    createdAtMs: Date.now() - 10_000,
    updatedAtMs: Date.now() - 5_000,
    calls: batch8Queued64.updatedCalls,
  });

  const discovered = await listResumableAstroWaySessions({
    profileId: 'chris-4-profile',
    inputFingerprint: sampleInstant.inputFingerprint,
  });
  assert(
    discovered.length === 1 &&
      discovered[0].sessionId === interruptedSessionId &&
      discovered[0].matchesFingerprint === true &&
      discovered[0].successfulCount === 8 &&
      discovered[0].queuedCount === 64 &&
      discovered[0].failedCount === 0 &&
      discovered[0].remainingEligibleCount === 64,
    'Interrupted 8/72 session discovery failed.'
  );

  const loadedInterrupted = await loadAstroWayBatchSession(discovered[0].sessionId);
  assert(loadedInterrupted !== null, 'Failed to load interrupted session from coordinator.');
  const hydratedZeroHttp = await reconstructAstroWayLayerAFromSession({
    instant: sampleInstant,
    session: loadedInterrupted!,
    skipGlobalCooldownRead: true,
  });
  assert(
    hydratedZeroHttp.layerA.quotaAndPerformanceSummary.successfulCalls === 8 &&
      hydratedZeroHttp.layerA.quotaAndPerformanceSummary.failedCalls === 0 &&
      hydratedZeroHttp.layerA.quotaAndPerformanceSummary.unexecutedCalls === 64 &&
      hydratedZeroHttp.batchState.status === 'paused_partial',
    'Zero-HTTP session bundle reconstruction failed.'
  );

  // Resume from interrupted 8/72 session and ensure the 8 already-succeeded endpoints are NEVER called again
  const alreadyAcquiredIds = new Set(
    Object.values(loadedInterrupted!.calls)
      .filter((c) => c.ok)
      .map((c) => c.id)
  );
  const resumedPaths: string[] = [];
  const resumedBatch2 = await executeAstroWayBatchedBundle(sampleInstant, {
    apiKey: 'test-key-redacted',
    includeTimezoneEquivalenceProbe: loadedInterrupted!.includeTimezoneEquivalenceProbe,
    existingCalls: loadedInterrupted!.calls,
    sessionId: loadedInterrupted!.sessionId,
    batchSize: 8,
    batchIndex: loadedInterrupted!.batchIndex,
    resumedFromSession: true,
    skipGlobalCooldown: true,
    fetchFn: async (url: string) => {
      const p = new URL(url).pathname;
      resumedPaths.push(p);
      return new Response(JSON.stringify({ ok: true, data: { items: [] } }), { status: 200 });
    },
  });
  // Verify Batch 2 ran 8 NEW endpoints, accumulated 16 total OK, and did not repeat any Batch 1 succeeded spec IDs
  const batch1SucceededSpecIds = Object.values(loadedInterrupted!.calls)
    .filter((c) => c.ok)
    .map((c) => c.id);
  const batch2CallAttemptsUnchanged = batch1SucceededSpecIds.every(
    (id) => resumedBatch2.updatedCalls[id]?.attempts === loadedInterrupted!.calls[id]?.attempts
  );
  assert(
    alreadyAcquiredIds.size === 8 &&
      resumedPaths.length === 8 &&
      batch2CallAttemptsUnchanged &&
      resumedBatch2.layerA.quotaAndPerformanceSummary.successfulCalls === 16 &&
      resumedBatch2.layerA.quotaAndPerformanceSummary.failedCalls === 0 &&
      resumedBatch2.layerA.quotaAndPerformanceSummary.unexecutedCalls === 56,
    'Resuming interrupted 8/72 session repeated settled calls or failed to accumulate responses.'
  );
  await deleteAstroWayBatchSession(interruptedSessionId);
  resetAstroWayIsolateSessionsForTests();
  regressionResults.push({ id: 'astroway_interrupted_8_of_72_session_recovery', status: 'PASSED' });

  // 3o. Rate-Limited / Unexecuted Timezone Probe MUST NOT be Marked a Mathematical Failure
  const rateLimitedTzCheck = compareAstroWayModeAVsModeBResponses({
    instant: sampleInstant,
    chartA: { id: 'chart_sidereal', path: '/chart', category: 'natal_core', declaredQuality: 'green', qualityCaveat: null, httpStatus: 200, ok: true, attempts: 1, accessRestricted: false, acquisitionClassification: 'successfully_acquired', creditsUsed: 1, latencyMs: 10, payloadBytes: 10, creditAndMetaHeaders: {}, sanitizedRequest: {}, errorMessage: null, rawResponse: mockAwLayerA.calls.chart_sidereal.rawResponse },
    chartB: { id: 'timezone_probe_mode_b_chart', path: '/chart', category: 'timezone_probe', declaredQuality: 'green', qualityCaveat: null, httpStatus: 429, ok: false, attempts: 1, accessRestricted: false, acquisitionClassification: 'rate_limited', creditsUsed: 0, latencyMs: 10, payloadBytes: 10, creditAndMetaHeaders: {}, sanitizedRequest: {}, errorMessage: 'HTTP 429', rawResponse: null },
  });
  const rlMaster = buildLayerBMasterChartRecord({
    instant: sampleInstant,
    rawLayerA: { ...mockAwLayerA, timezoneEquivalenceCheck: rateLimitedTzCheck },
  });
  const rlVerif = verifyMasterChartRecord(rlMaster, {
    ...mockAwLayerA,
    timezoneEquivalenceCheck: rateLimitedTzCheck,
  });
  assert(
    rateLimitedTzCheck.status === 'incomplete_due_to_rate_limit' &&
      rateLimitedTzCheck.executed === false &&
      !rlVerif.checks.some((c) => c.id === 'timezone_mode_a_vs_b' && !c.passed) &&
      !rlVerif.epistemicClassification.methodologyUnresolved.some((i) => i.key === 'timezone_mode_a_vs_b') &&
      rlVerif.epistemicClassification.datasetUnavailable.some((i) => i.key === 'timezone_mode_a_vs_b_incomplete'),
    'Rate-limited TZ probe was falsely flagged as mathematical failure.'
  );
  regressionResults.push({ id: 'astroway_incomplete_tz_probe_not_math_failure', status: 'PASSED' });

  // 3p. 0/0 Occupancy Must Fail Both KP and Western Verification
  const zeroOccKp = verifyKpFrameDetailed(
    {
      ...kpFrameGood,
      planets: kpFrameGood.planets.map(({ kp_house: _kh, house: _h, ...rest }) => rest),
    },
    sampleRef
  );
  const zeroOccWest = verifyWesternFrameDetailed(
    {
      ...westGood,
      planets: westGood.planets.map(({ house: _h, ...rest }) => rest),
    },
    sampleRef,
    false
  );
  assert(
    zeroOccKp.occupancyChecked === 0 &&
      zeroOccKp.passed === false &&
      zeroOccWest.occupancyChecked === 0 &&
      zeroOccWest.passed === false,
    '0/0 occupancy check falsely passed on KP or Western.'
  );
  regressionResults.push({ id: 'zero_of_zero_occupancy_fails_kp_and_western', status: 'PASSED' });

  // 3q. Absent UTC Timestamp Fails Strict Ephemeris Timestamp Verification While Crediting julianDayMatch
  const jdOnlyCheck = evaluateAstroWayJulianDayCheck(sampleInstant, {
    ok: true,
    sanitizedRequest: { date: '1985-12-25', time: '04:33:00', timezone: 'Asia/Kolkata' },
    rawResponse: { ok: true, data: { julianDay: sampleInstant.utc.julianDayUt } },
  });
  const jdOnlyVerif = verifyMasterChartRecord(
    buildLayerBMasterChartRecord({
      instant: sampleInstant,
      rawLayerA: { ...mockAwLayerA, ephemerisTimestampCheck: jdOnlyCheck },
    }),
    { ...mockAwLayerA, ephemerisTimestampCheck: jdOnlyCheck }
  );
  const tsCheckRow = jdOnlyVerif.checks.find((c) => c.id === 'ephemeris_timestamp_verification');
  const jdCheckRow = jdOnlyVerif.checks.find((c) => c.id === 'ephemeris_julian_day_verification');
  assert(
    jdOnlyCheck?.utcTimestampPresent === false &&
      jdOnlyCheck?.julianDayMatch === true &&
      jdOnlyCheck?.exactTimestampMatch === false &&
      tsCheckRow?.passed === false &&
      jdCheckRow?.passed === true,
    'Absent UTC timestamp ephemeris check did not separate exact timestamp vs Julian Day.'
  );
  regressionResults.push({ id: 'absent_utc_timestamp_ephemeris_check', status: 'PASSED' });

  // 3r. Shadbala Methodological Investigation (Kendradi shift, Zero Luminary Cheshta, Kala 6-field rollup, Thresholds)
  const makeTestPlanet = (name: string, lon: number, isRetrograde: boolean, dignity: string) => {
    const signIndex = Math.floor(normalizeDeg(lon) / 30) % 12;
    const ascIdx = Math.floor(normalizeDeg(sampleRef.lahiriAscendantDeg) / 30) % 12;
    const nak = getNakshatraAndSubs(lon);
    return {
      name,
      longitude: normalizeDeg(lon),
      isRetrograde,
      sign: SIGNS[signIndex],
      signIndex,
      degreeInSign: Number((normalizeDeg(lon) % 30).toFixed(4)),
      dms: `${Math.floor(normalizeDeg(lon) % 30)}°00'`,
      house: ((signIndex - ascIdx + 12) % 12) + 1,
      nakshatra: nak.nakshatra,
      nakshatraIndex: nak.nakshatraIndex,
      nakshatraLord: nak.nakshatraLord,
      pada: nak.pada,
      subLord: nak.subLord,
      subSubLord: nak.subSubLord,
      dignity,
    };
  };
  const sbReportZeroLum = buildShadbalaReconciliationReport({
    instant: sampleInstant,
    providerShadbalaRaw: {
      Sun: { sthana_bala: 220, dig_bala: 24, kala_bala: 105, cheshta_bala: 0, naisargika_bala: 60, drik_bala: 8, total: 417, shadbala_in_rupas: 6.95, minimum_requirements: 6.5, ratio: 1.0692 },
      Moon: { sthana_bala: 210, dig_bala: 33, kala_bala: 123, cheshta_bala: 0, naisargika_bala: 51.43, drik_bala: -30, total: 387.43, shadbala_in_rupas: 6.46, minimum_requirements: 6.0, ratio: 1.0767 },
    },
    providerStrengthMetadata: { provider: 'astroway' },
    canonicalLahiriPlanets: [
      makeTestPlanet('Sun', sampleRef.lahiriSunLonDeg, false, 'Neutral'),
      makeTestPlanet('Moon', sampleRef.lahiriMoonLonDeg, false, 'Exalted'),
      makeTestPlanet('Mars', 185, false, 'Neutral'),
      makeTestPlanet('Mercury', 230, false, 'Neutral'),
      makeTestPlanet('Jupiter', 295, false, 'Debilitated'),
      makeTestPlanet('Venus', 245, false, 'Neutral'),
      makeTestPlanet('Saturn', 221, false, 'Neutral'),
      makeTestPlanet('Rahu', 11.5, true, 'Neutral'),
      makeTestPlanet('Ketu', 191.5, true, 'Neutral'),
    ],
    lahiriAscDeg: sampleRef.lahiriAscendantDeg,
    lahiriMcDeg: sampleRef.lahiriMcDeg,
    providerKalaRaw: mockAwLayerA.calls.shadbala_kala.rawResponse as Record<string, unknown>,
  });
  assert(
    sbReportZeroLum.authoritativeDesignation === 'unassigned_pending_reconciliation' &&
      sbReportZeroLum.methodologicalInvestigation?.cheshtaBalaZeroLuminaries.detectedOnProvider === true &&
      sbReportZeroLum.methodologicalInvestigation?.kalaBalaRollupAudit.abdaMasaVaraHoraCombined === true &&
      sbReportZeroLum.methodologicalInvestigation?.sthanaDeltaDrivers.length === 7 &&
      sbReportZeroLum.methodologicalInvestigation?.thresholdReversals.length === 7,
    'Shadbala methodological investigation audit failed.'
  );
  regressionResults.push({ id: 'shadbala_methodological_investigation_checks', status: 'PASSED' });

  // 3w. AstroWay Nested Parashara/Jaimini/Kundli Yoga Extraction & Non-Zero Reporting Regression Test
  const yogasResNested = normalizeAstroWayYogas({
    yogasParashara: {
      raja: { present: true, contributingPlanets: ['Sun', 'Jupiter'], details: ['10L + 5L'] },
      dhana: { present: false, contributingPlanets: [] },
      dharmaKarmadhipati: { present: true, contributingPlanets: ['Sun', 'Mercury'] },
      gajakesari: { present: true, details: ['Jupiter 9th from Moon'] },
      adhi: { present: false, contributingPlanets: [] },
      panchaMahapurusha: {
        presentCount: 1,
        yogas: [
          { yogaName: 'Sasa Mahapurusha Yoga', planetName: 'Saturn', present: true, sign: 'Scorpio' },
          { yogaName: 'Malavya Mahapurusha Yoga', planetName: 'Venus', present: false },
        ],
      },
    },
    yogasJaimini: {
      raja: { present: true },
      dhana: { present: false },
      daridra: { present: false },
      viparita: { present: false },
    },
    jaiminiYogas: {
      yogas: [
        { name: 'AK in Kendra', present: true },
        { name: 'DK in Trikona', present: false },
      ],
    },
    kundli: null,
  });
  const yogasResKundliFallback = normalizeAstroWayYogas({
    yogasParashara: null,
    yogasJaimini: null,
    jaiminiYogas: null,
    kundli: {
      yogas: {
        present: ['Budhaditya Yoga', 'Gajakesari Yoga'],
        dhana: { present: true, contributingPlanets: ['Jupiter', 'Venus'] },
      },
    },
  });
  const nestedCounts = (yogasResNested?.summary?.counts ?? {}) as Record<string, number>;
  assert(
    yogasResNested !== null &&
      yogasResNested.items.length === 6 &&
      nestedCounts.totalEvaluatedDetectors === 13 &&
      nestedCounts.totalActiveYogas === 6 &&
      yogasResKundliFallback !== null &&
      yogasResKundliFallback.items.length === 3,
    `Nested AstroWay Yoga normalization regression failed (nested=${yogasResNested?.items.length}, kundliFallback=${yogasResKundliFallback?.items.length}).`
  );
  regressionResults.push({
    id: 'astroway_nested_yogas_extraction_and_preservation',
    status: 'PASSED',
    nestedActiveYogas: yogasResNested?.items.length ?? 0,
    nestedEvaluatedDetectors: nestedCounts.totalEvaluatedDetectors ?? 0,
    kundliFallbackActiveYogas: yogasResKundliFallback?.items.length ?? 0,
  });

  // 3x. Hellenistic Profections targetAge Calculation & Preflight Validation Test
  const ageBeforeBday = computeCompletedAgeYears(sampleInstant.input, '2026-12-24');
  const ageExactBday = computeCompletedAgeYears(sampleInstant.input, '2026-12-25');
  const ageDayAfterBday = computeCompletedAgeYears(sampleInstant.input, '2026-12-26');
  const profPlan = buildAstroWayChris4EvaluationPlan(sampleInstant, {
    timeMode: 'local_iana',
    targetDateIso: '2026-11-27',
  });
  const profDetailReq = profPlan.requests.find((r) => r.id === 'hellenistic_brennan_profections_detail');
  const profBasicReq = profPlan.requests.find((r) => r.id === 'western_profections');
  assert(
    ageBeforeBday === 40 &&
      ageExactBday === 41 &&
      ageDayAfterBday === 41 &&
      profPlan.validationErrors.length === 0 &&
      profDetailReq?.body.targetAge === 40 &&
      profDetailReq?.body.targetDate === undefined &&
      profBasicReq?.body.targetDate === '2026-11-27',
    `Hellenistic profections targetAge test failed (ages=${ageBeforeBday}/${ageExactBday}/${ageDayAfterBday}, body=${JSON.stringify(profDetailReq?.body)}).`
  );
  regressionResults.push({
    id: 'astroway_hellenistic_profections_target_age',
    status: 'PASSED',
    targetAgeOn20261127: profDetailReq?.body.targetAge,
    ageOnExactBirthday: ageExactBday,
  });

  // 3y. Full Dataset Preservation Across LayerBMasterChartRecord
  const ext = (awMaster.providerExtendedDatasets ?? {}) as Record<string, unknown>;
  assert(
    Boolean(ext.vedicKundli) &&
      Boolean(ext.siderealChartExtras) &&
      Boolean(ext.shadbalaFull) &&
      Boolean(ext.shadbalaSubcomponents) &&
      Boolean(ext.ishtaKashtaPhala) &&
      'bhavabala' in ext &&
      ext.bhavabala === null &&
      Boolean(ext.kpExtended) &&
      Boolean(ext.jaimini) &&
      Boolean(ext.yogasAndDoshas) &&
      Boolean(ext.advancedDashas) &&
      Boolean(ext.westernAndHellenistic) &&
      (awMaster.frames.westernTropical.data?.declinationAspects?.length ?? 0) === 1 &&
      Boolean(awMaster.frames.westernTropical.data?.tables) &&
      awMaster.frames.westernTropical.data?.planets.every((p) => Number.isInteger(p.house)) &&
      (awMaster.frames.kpPlacidus.data?.houseSignificators?.length ?? 0) === 12,
    'AstroWay full dataset preservation in LayerBMasterChartRecord failed.'
  );
  regressionResults.push({
    id: 'astroway_full_dataset_preservation',
    status: 'PASSED',
    extendedBucketsCount: Object.keys(ext).length,
    kpHouseSignificators: awMaster.frames.kpPlacidus.data?.houseSignificators?.length ?? 0,
    westernTablesPreserved: Boolean(awMaster.frames.westernTropical.data?.tables),
  });

  // 3z. Phase 1 — Canonical Dataset Contract, Definitive Manifest, Zero-Coercion Guards & Temporal Separation
  const zeroCoercionLayerA: LayerARawProviderRecord = {
    ...syntheticPartialLayerA,
    calls: {
      vedic_calculate: {
        ...syntheticPartialLayerA.calls.vedic_calculate,
        rawResponse: {
          ayanamsha: 'lahiri',
          timezone_used: 'Asia/Kolkata',
          chart: {
            ascendant: null,
            planets: [],
            houses: [],
          },
          ashtakavarga: {
            sarvashtakavarga: [],
            bhinnashtakavarga: {},
            prastharashtakavarga: {},
            total_points: 0,
          },
          vimshottari_dasha: {
            birth_balance: { lord: '', remaining_years: null },
            mahadashas: [],
          },
        },
      },
    },
  };
  const zeroCoercionMaster = buildLayerBMasterChartRecord({
    instant: sampleInstant,
    rawLayerA: zeroCoercionLayerA,
  });
  const zcManifest = zeroCoercionMaster.datasetManifest!;
  const zcEntry = (key: string) => zcManifest.entries.find((e) => e.key === key);

  assert(
    zeroCoercionMaster.frames.vedicLahiri.canonicalStatus === 'unavailable' &&
      zcEntry('vedic_d1_positions')?.canonicalStatus === 'unavailable' &&
      zcEntry('ashtakavarga_bav_sav_prastara')?.canonicalStatus === 'unavailable' &&
      zcEntry('vimshottari_natal_timeline')?.canonicalStatus === 'unavailable' &&
      zcEntry('vedic_d9_navamsa')?.canonicalStatus === 'unavailable' &&
      zcManifest.minimumChartReadiness.ready === false &&
      zcManifest.minimumChartReadiness.missingKeys.includes('vedic_d1_positions') &&
      zcManifest.downstreamGuardSummary.phi_planetary_health?.ready === false &&
      zcManifest.downstreamGuardSummary.phi_planetary_health?.missingPrerequisites.includes('vedic_d1_positions'),
    'Zero-coercion empty-success guardrail failed to mark empty D1/Ashtakavarga/Dasha payloads as unavailable.'
  );

  // Check offlineMaster & partialMaster downstream guards + conventions preservation
  const offlineManifest = buildLayerBMasterChartRecord({
    instant: sampleInstant,
    rawLayerA: null,
  }).datasetManifest!;
  assert(
    offlineManifest.minimumChartReadiness.ready === false &&
      offlineManifest.minimumChartReadiness.satisfiedCount === 1 &&
      offlineManifest.downstreamGuardSummary.phi_planetary_health.ready === false &&
      partialMaster.datasetManifest?.downstreamGuardSummary.phi_planetary_health.ready === false,
    'Offline/partial downstream prerequisite guard failed.'
  );

  // Check AstroWay master manifest, empty subcomponents/bhavabala rejection, conventions & temporal scope
  const awManifest = awMaster.datasetManifest!;
  const awEntry = (key: string) => awManifest.entries.find((e) => e.key === key);
  const refTimedAwMaster = buildLayerBMasterChartRecord({
    instant: sampleInstant,
    rawLayerA: {
      ...mockAwLayerA,
      calls: {
        ...mockAwLayerA.calls,
        western_profections: {
          ...mockAwLayerA.calls.chart_tropical,
          id: 'western_profections',
          endpoint: '/western/profections',
          sanitizedRequest: { targetDate: '2026-11-27' },
          rawResponse: { ok: true, data: { lordOfYear: 'Jupiter', profectedHouse: 5 } },
        },
        hellenistic_brennan_profections_detail: {
          ...mockAwLayerA.calls.chart_tropical,
          id: 'hellenistic_brennan_profections_detail',
          endpoint: '/hellenistic/profections',
          sanitizedRequest: { targetAge: 40 },
          rawResponse: { ok: true, data: { annualProfection: { house: 5 } } },
        },
      },
    },
  });

  const manifestTotalByStatus = Object.values(awManifest.countsByStatus).reduce((a, b) => a + b, 0);
  const emptySubcomponentsMaster = buildLayerBMasterChartRecord({
    instant: sampleInstant,
    rawLayerA: {
      ...mockAwLayerA,
      calls: {
        ...mockAwLayerA.calls,
        shadbala_kala: {
          ...mockAwLayerA.calls.shadbala_kala,
          rawResponse: { ok: true, data: { items: [] } },
        },
      },
    },
  });
  assert(
    awMaster.recalculationVersion !== undefined &&
      awMaster.calculationConventions?.supportsFutureUserConventionOverrides === true &&
      awMaster.frames.vedicLahiri.temporalScope === 'natal_invariant' &&
      awManifest.entries.length === manifestTotalByStatus &&
      awEntry('canonical_birth_instant')?.canonicalStatus === 'internally_verified' &&
      awEntry('vedic_d1_positions')?.canonicalStatus === 'available' &&
      awEntry('shadbala_subcomponents')?.canonicalStatus === 'provisional' &&
      emptySubcomponentsMaster.datasetManifest?.entries.find((e) => e.key === 'shadbala_subcomponents')
        ?.canonicalStatus === 'unavailable' &&
      awEntry('bhavabala')?.canonicalStatus === 'unavailable' &&
      awEntry('reference_date_dasha_snapshot')?.temporalScope === 'reference_date_dependent' &&
      refTimedAwMaster.referenceDateTiming?.temporalScope === 'reference_date_dependent' &&
      refTimedAwMaster.referenceDateTiming?.referenceDateIso === '2026-11-27' &&
      refTimedAwMaster.referenceDateTiming?.targetAgeYears === 40 &&
      refTimedAwMaster.datasetManifest?.entries.find((e) => e.key === 'western_profections_snapshot')?.canonicalStatus ===
        'available',
    'Phase 1 manifest, empty subcomponent rejection, conventions, or reference-date temporal isolation check failed.'
  );
  regressionResults.push({
    id: 'phase1_canonical_manifest_zero_coercion_and_temporal_scope',
    status: 'PASSED',
    manifestEntriesCount: awManifest.entries.length,
    awTier1Ready: awManifest.minimumChartReadiness.ready,
    awTier2Ratio: awManifest.comprehensiveFoundationalCompleteness.completenessRatio,
    referenceDateIsoExtracted: refTimedAwMaster.referenceDateTiming?.referenceDateIso,
    targetAgeExtracted: refTimedAwMaster.referenceDateTiming?.targetAgeYears,
  });

  // 3aa. Phase 2 — AstroWay Foundational Pruning (67 -> 64) & Deep Mathematical Dataset Normalization
  const foundationalPlan = buildAstroWayFoundationalPlan(sampleInstant, {
    timeMode: 'local_iana',
    targetDateIso: '2026-11-27',
  });
  const prunedPlanIds = new Set(foundationalPlan.requests.map((r) => r.id));
  assert(
    foundationalPlan.planMode === 'foundational_pruned' &&
      ASTROWAY_PRUNED_REDUNDANT_ENDPOINTS.length === 3 &&
      foundationalPlan.requests.length === 64 &&
      !prunedPlanIds.has('ashtakavarga_basic') &&
      !prunedPlanIds.has('kp_cusps') &&
      !prunedPlanIds.has('varga_D1') &&
      prunedPlanIds.has('ashtakavarga_prastara') &&
      prunedPlanIds.has('kp_sub_lords') &&
      prunedPlanIds.has('varga_D2') &&
      prunedPlanIds.has('varga_D60') &&
      prunedPlanIds.has('jaimini_karakas') &&
      prunedPlanIds.has('jaimini_chara_karakas') &&
      prunedPlanIds.has('western_essential_dignities'),
    `Phase 2 AstroWay foundational plan pruning check failed (count=${foundationalPlan.requests.length}).`
  );

  await resetAstroWayIsolateRateStateForTests();
  const foundationalCalledPaths: string[] = [];
  let foundationalExistingCalls: Record<string, SanitizedProviderCallRecord> | undefined;
  let foundationalBatchIndex = 0;
  let foundationalExec: Awaited<ReturnType<typeof acquireAstroWayFoundationalBundle>> | null = null;
  for (let loop = 0; loop < 15; loop++) {
    const step = await acquireAstroWayFoundationalBundle(sampleInstant, {
      apiKey: 'test-key-redacted',
      sessionId: 'sess-phase2-foundational-test',
      includeTimezoneEquivalenceProbe: false,
      existingCalls: foundationalExistingCalls,
      batchIndex: foundationalBatchIndex,
      batchSize: 9,
      skipGlobalCooldown: true,
      fetchFn: async (url: string) => {
        foundationalCalledPaths.push(new URL(url).pathname);
        return new Response(JSON.stringify({ ok: true, data: { items: [] } }), {
          status: 200,
          headers: { 'x-ratelimit-remaining': '9', 'x-ratelimit-limit': '10' },
        });
      },
    });
    foundationalExistingCalls = step.updatedCalls;
    foundationalBatchIndex = step.batchState.batchIndex;
    foundationalExec = step;
    if (step.batchState.remainingEligibleCount === 0) break;
  }
  assert(
    foundationalExec !== null &&
      foundationalExec.layerA.quotaAndPerformanceSummary.totalCalls === 64 &&
      foundationalExec.layerA.quotaAndPerformanceSummary.successfulCalls === 64 &&
      foundationalCalledPaths.length === 64 &&
      !foundationalCalledPaths.includes('/v1/ashtakavarga') &&
      !foundationalCalledPaths.includes('/v1/vedic/kp/cusps') &&
      !foundationalCalledPaths.includes('/v1/vedic/varga/D1'),
    `Phase 2 acquireAstroWayFoundationalBundle executed unexpected/pruned paths (${foundationalCalledPaths.length}).`
  );

  // Build deep 5-level Vimshottari, alternative dashas (1 valid + 1 empty), enriched telemetry/dignity,
  // Ashtakavarga Shodhana (empty vs populated), and pruned KP/Varga_D1/AV_basic bundle
  const prunedCalls = { ...mockAwLayerA.calls };
  delete prunedCalls.ashtakavarga_basic;
  delete prunedCalls.kp_cusps;
  delete prunedCalls.varga_D1;

  const prunedAwLayerA: LayerARawProviderRecord = {
    ...mockAwLayerA,
    calls: {
      ...prunedCalls,
      chart_sidereal: makeAwCall('chart_sidereal', '/chart', 'natal_core', {
        ...(unwrapAstroWayDataCheck(mockAwLayerA.calls.chart_sidereal.rawResponse)),
        planets: [
          {
            name: 'Sun',
            longitude: sampleRef.lahiriSunLonDeg,
            latitude: 0.0001,
            distance: 0.983,
            speedLong: 1.01,
            speedLat: 0.00002,
            speedDist: -0.00004,
            isRetrograde: false,
            declination: -23.4,
            rightAscension: 270,
          },
          {
            name: 'Moon',
            longitude: sampleRef.lahiriMoonLonDeg,
            latitude: 1.2,
            distance: 0.0025,
            speedLong: 13.1,
            speedLat: -0.11,
            speedDist: 0.00001,
            isRetrograde: false,
            declination: 21.1,
            rightAscension: 68,
          },
          { name: 'Mars', longitude: 185, isRetrograde: false },
          { name: 'Mercury', longitude: 230, isRetrograde: false },
          { name: 'Jupiter', longitude: 295, isRetrograde: false },
          { name: 'Venus', longitude: 245, isRetrograde: false },
          { name: 'Saturn', longitude: 221, isRetrograde: false },
          { name: 'Mean Node', longitude: 11.5, isRetrograde: true },
          { name: 'South Node', longitude: 191.5, isRetrograde: true },
        ],
      }),
      vedic_kundli: makeAwCall('vedic_kundli', '/vedic/kundli', 'natal_core', {
        ayanamsa: 'lahiri',
        lagna: {
          longitude: sampleRef.lahiriAscendantDeg,
          signName: SIGNS[Math.floor(sampleRef.lahiriAscendantDeg / 30) % 12],
        },
        nakshatra: { name: 'Rohini', pada: 2 },
        dasha: { current: { maha: 'Saturn', antar: 'Mercury' } },
        yogas: { present: ['Raja Yoga'] },
        doshas: { present: [] },
        grahas: [
          {
            name: 'Sun',
            longitude: sampleRef.lahiriSunLonDeg,
            dignity: 'Friendly',
            avastha: 'Kumara',
            isCombust: false,
            nakshatraName: 'Mula',
            nakshatraLord: 'Ketu',
            pada: 1,
          },
          {
            name: 'Moon',
            longitude: sampleRef.lahiriMoonLonDeg,
            dignity: 'Exalted',
            avastha: 'Yuva',
            isCombust: false,
            nakshatraName: 'Rohini',
            nakshatraLord: 'Moon',
            pada: 2,
          },
          { name: 'Mars', longitude: 185, dignity: 'Neutral', isCombust: false },
          { name: 'Mercury', longitude: 230, dignity: 'Friendly', isCombust: false },
          { name: 'Jupiter', longitude: 295, dignity: 'Debilitated', isCombust: false },
          { name: 'Venus', longitude: 245, dignity: 'Neutral', isCombust: true },
          { name: 'Saturn', longitude: 221, dignity: 'Neutral', isCombust: false },
          { name: 'Rahu', longitude: 12.5352, isRetrograde: true },
          { name: 'Ketu', longitude: 192.5352, isRetrograde: true },
        ],
      }),
      ashtakavarga_prastara: (() => {
        // Classical per-planet bindu totals: Sun=48, Moon=49, Mars=39, Mercury=54, Jupiter=56, Venus=52, Saturn=39 -> 337
        const bavRows: Array<{ planetName: string; bindus: number[] }> = [
          { planetName: 'Sun', bindus: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] }, // 48
          { planetName: 'Moon', bindus: [5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] }, // 49
          { planetName: 'Mars', bindus: [3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4] }, // 39
          { planetName: 'Mercury', bindus: [5, 5, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4] }, // 54
          { planetName: 'Jupiter', bindus: [5, 5, 5, 5, 5, 5, 5, 5, 4, 4, 4, 4] }, // 56
          { planetName: 'Venus', bindus: [5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4] }, // 52
          { planetName: 'Saturn', bindus: [3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4] }, // 39
        ];
        const sarva = Array.from({ length: 12 }, (_, idx) =>
          bavRows.reduce((s, r) => s + r.bindus[idx], 0)
        );
        const contributorsList = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Ascendant'];
        return makeAwCall('ashtakavarga_prastara', '/vedic/ashtakavarga/prastara', 'ashtakavarga', {
          sarva,
          sarvaTotal: sarva.reduce((a, b) => a + b, 0),
          planets: bavRows.map((row) => ({
            planetName: row.planetName,
            bindus: row.bindus,
            contributors: contributorsList.map((src, cIdx) => ({
              source: src,
              signs: row.bindus.map((targetCount) => (cIdx < targetCount ? 1 : 0)),
            })),
          })),
        });
      })(),
      ashtakavarga_shodhana: makeAwCall('ashtakavarga_shodhana', '/vedic/ashtakavarga/shodhana', 'ashtakavarga', {
        planets: [{ planetName: 'Sun', shodhyaPinda: 112 }],
      }, { declaredQuality: 'yellow' }),
      ...(() => {
        const kpBodies = [
          { rawName: 'Sun', canon: 'Sun', lon: awSunKp },
          { rawName: 'Moon', canon: 'Moon', lon: awMoonKp },
          { rawName: 'Mars', canon: 'Mars', lon: 185 },
          { rawName: 'Mercury', canon: 'Mercury', lon: 230 },
          { rawName: 'Jupiter', canon: 'Jupiter', lon: 295 },
          { rawName: 'Venus', canon: 'Venus', lon: 245 },
          { rawName: 'Saturn', canon: 'Saturn', lon: 221 },
          { rawName: 'Mean Node', canon: 'Rahu', lon: 11.5 },
          { rawName: 'South Node', canon: 'Ketu', lon: 191.5 },
        ];
        const kpOccMap = new Map<string, number>();
        for (const b of kpBodies) {
          kpOccMap.set(b.canon, findKpHouse(b.lon));
        }
        const ownedByPlanet = (canon: string) => {
          const signLords = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
          return awKpCusps
            .filter((c) => signLords[Math.floor(c.longitude / 30) % 12] === canon)
            .map((c) => c.house);
        };
        return {
          kp_sub_lords: makeAwCall('kp_sub_lords', '/vedic/kp/sub-lords', 'kp', {
            ayanamsa: 23.56,
            method: 'placidus',
            cusps: [
              ...awKpCusps,
              // Non-finite cusp longitude must be dropped rather than coerced to 0°
              { house: 99, longitude: undefined, signName: 'Aries' },
            ],
            planets: kpBodies.map((b) => ({ grahaName: b.rawName, longitude: b.lon })),
          }),
          kp_planet_cuspal_position: makeAwCall('kp_planet_cuspal_position', '/vedic/kp/planet-cuspal-position', 'kp', {
            planets: kpBodies.map((b) => ({ grahaName: b.rawName, house: kpOccMap.get(b.canon)! })),
          }),
          kp_significators: makeAwCall('kp_significators', '/vedic/kp/significators', 'kp', {
            significators: kpBodies.map((b) => {
              const starLord = getNakshatraAndSubs(b.lon).nakshatraLord;
              const starOcc = kpOccMap.get(starLord);
              const ownH = kpOccMap.get(b.canon)!;
              return {
                grahaName: b.rawName,
                levels: {
                  l1: starOcc ? [starOcc] : [],
                  l2: [ownH],
                  l3: ownedByPlanet(starLord),
                  l4: ownedByPlanet(b.canon),
                },
              };
            }),
          }),
        };
      })(),
      dashas_vimshottari_prana: makeAwCall('dashas_vimshottari_prana', '/vedic/dashas/vimshottari/prana', 'dasha', {
        initial: { initialPlanetName: 'Moon', balanceYears: 7.435, elapsedYears: 2.565 },
        current: { maha: 'Saturn', antar: 'Mercury', pratyantar: 'Venus', targetDate: '2026-11-27' },
        periods: [
          {
            planetName: 'Moon',
            startDate: '1985-12-25',
            endDate: '1993-06-01',
            durationYears: 7.435,
            subPeriods: [
              {
                planetName: 'Moon',
                startDate: '1985-12-25',
                endDate: '1986-10-25',
                pratyantardashas: [
                  {
                    planetName: 'Mars',
                    startDate: '1985-12-25',
                    endDate: '1986-01-15',
                    sookshmadashas: [
                      {
                        planetName: 'Rahu',
                        startDate: '1985-12-25',
                        endDate: '1985-12-29',
                        pranadashas: [
                          {
                            planetName: 'Jupiter',
                            startDate: '1985-12-25',
                            endDate: '1985-12-26',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
      dashas_chara_maha: makeAwCall('dashas_chara_maha', '/vedic/dashas/chara/maha', 'dasha', {
        initial: { signName: 'Sagittarius' },
        current: { signName: 'Virgo', targetDate: '2026-11-27' },
        periods: [
          { signName: 'Sagittarius', startDate: '1985-12-25', endDate: '1994-12-25', durationYears: 9 },
        ],
      }),
      dashas_yogini_maha: makeAwCall('dashas_yogini_maha', '/vedic/dashas/yogini/maha', 'dasha', {
        periods: [],
      }),
      western_essential_dignities: makeAwCall('western_essential_dignities', '/western/essential-dignities', 'hellenistic_traditional', {
        planets: [{ name: 'Sun', domicile: false, triplicity: 'Fire' }],
      }),
      bhavabala: makeAwCall('bhavabala', '/vedic/bhavabala', 'bhavabala', {
        houses: Array.from({ length: 12 }, (_, idx) => ({
          house: idx + 1,
          totalVirupa: 420 + idx * 5,
        })),
      }, { declaredQuality: 'yellow' }),
    },
  };

  function unwrapAstroWayDataCheck(rawResponse: unknown): Record<string, unknown> {
    const r = rawResponse as Record<string, unknown>;
    return (r?.data && typeof r.data === 'object' ? r.data : r) as Record<string, unknown>;
  }

  const prunedMaster = buildLayerBMasterChartRecord({
    instant: sampleInstant,
    rawLayerA: prunedAwLayerA,
    referenceDateIso: '2026-11-27',
  });
  const prunedVerif = verifyMasterChartRecord(prunedMaster, prunedAwLayerA);
  const prunedManifest = prunedMaster.datasetManifest!;
  const pEntry = (key: string) => prunedManifest.entries.find((e) => e.key === key);

  const vim5 = prunedMaster.frames.vedicLahiri.data?.vimshottariDasha as Record<string, unknown>;
  const level1 = (vim5?.mahadashas as Array<Record<string, unknown>>)?.[0];
  const level2 = (level1?.subPeriods as Array<Record<string, unknown>>)?.[0];
  const level3 = (level2?.subPeriods as Array<Record<string, unknown>>)?.[0];
  const level4 = (level3?.subPeriods as Array<Record<string, unknown>>)?.[0];
  const level5 = (level4?.subPeriods as Array<Record<string, unknown>>)?.[0];
  const sunPlanet = prunedMaster.frames.vedicLahiri.data?.planets.find((p) => p.name === 'Sun');
  const venusPlanet = prunedMaster.frames.vedicLahiri.data?.planets.find((p) => p.name === 'Venus');
  const advExt = (prunedMaster.providerExtendedDatasets?.advancedDashas ?? {}) as Record<string, unknown>;
  const charaNorm = advExt.charaMaha as Record<string, unknown>;
  const bhavaNorm = prunedMaster.providerExtendedDatasets?.bhavabala as Record<string, unknown> | null;
  const bhavaHouses = (bhavaNorm?.houses ?? []) as Array<Record<string, unknown>>;

  // Zero-coercion checks on empty Shodhana & all-empty alternative Dashas
  const emptyShodhanaNorm = normalizeAstroWayAshtakavargaShodhana({ items: [] });
  const emptyAltDashasMaster = buildLayerBMasterChartRecord({
    instant: sampleInstant,
    rawLayerA: {
      ...prunedAwLayerA,
      calls: {
        ...prunedAwLayerA.calls,
        dashas_chara_maha: makeAwCall('dashas_chara_maha', '/vedic/dashas/chara/maha', 'dasha', { periods: [] }),
        dashas_yogini_maha: makeAwCall('dashas_yogini_maha', '/vedic/dashas/yogini/maha', 'dasha', { periods: [] }),
        ashtakavarga_shodhana: makeAwCall('ashtakavarga_shodhana', '/vedic/ashtakavarga/shodhana', 'ashtakavarga', { items: [] }),
      },
    },
  });

  assert(
    prunedMaster.frames.vedicLahiri.data?.vargas?.supportedCount === 16 &&
      prunedMaster.frames.vedicLahiri.data?.vargas?.chartsByDivision?.D1?.source === 'canonical_d1_mirror' &&
      prunedMaster.frames.kpPlacidus.data?.cusps.length === 12 &&
      !prunedMaster.frames.kpPlacidus.source.includes('/vedic/kp/cusps') &&
      vim5?.maxDepthObserved === 5 &&
      level5?.levelName === 'prana' &&
      level5?.lord === 'Jupiter' &&
      sunPlanet?.speed_lat_deg_per_day === 0.00002 &&
      sunPlanet?.dignity === 'Friendly' &&
      sunPlanet?.avastha === 'Kumara' &&
      sunPlanet?.nakshatra === 'Mula' &&
      sunPlanet?.nakshatra_lord === 'Ketu' &&
      sunPlanet?.pada === 1 &&
      venusPlanet?.is_combust === true &&
      bhavaHouses.length === 12 &&
      bhavaHouses[0]?.totalRupa === 7 &&
      Boolean((prunedMaster.frames.westernTropical.data?.tables as Record<string, unknown>)?.essentialDignities) &&
      Boolean(prunedMaster.referenceDateTiming?.activeVimshottari) &&
      Boolean((prunedMaster.referenceDateTiming?.activeAlternativeDashas as Record<string, unknown>)?.chara) &&
      (charaNorm?.natalTimeline as Record<string, unknown>)?.maxDepthObserved === 1 &&
      pEntry('vedic_shodashavarga_16')?.canonicalStatus === 'available' &&
      pEntry('kp_placidus_cusps_sublords')?.canonicalStatus === 'available' &&
      pEntry('planetary_dignity_conditions')?.canonicalStatus === 'available' &&
      pEntry('ashtakavarga_shodhana_pinda')?.canonicalStatus === 'available' &&
      pEntry('bhavabala')?.canonicalStatus === 'provisional' &&
      pEntry('alternative_dashas_natal')?.canonicalStatus === 'provisional' &&
      emptyShodhanaNorm === null &&
      emptyAltDashasMaster.datasetManifest?.entries.find((e) => e.key === 'alternative_dashas_natal')
        ?.canonicalStatus === 'unavailable' &&
      emptyAltDashasMaster.datasetManifest?.entries.find((e) => e.key === 'ashtakavarga_shodhana_pinda')
        ?.canonicalStatus === 'unavailable' &&
      prunedVerif.checks.every((c) => c.passed),
    `Phase 2 deep normalization/pruning verification failed (checksFailed=${prunedVerif.failedCount}, failed=[${prunedVerif.checks.filter((c) => !c.passed).map((c) => `${c.id}:${c.observed}`).join('; ')}]).`
  );
  // Silence unused helper import warning if needed while verifying direct exports
  assert(
    normalizeAstroWayVimshottari5Level(null) === null &&
      normalizeAstroWayAlternativeDasha('chara', null) === null,
    'Null dasha normalizer guard failed.'
  );

  regressionResults.push({
    id: 'phase2_astroway_foundational_pruning_and_deep_normalization',
    status: 'PASSED',
    foundationalPlanEndpoints: foundationalPlan.requests.length,
    prunedEndpointsCount: ASTROWAY_PRUNED_REDUNDANT_ENDPOINTS.length,
    shodashavargaCountWithD1Mirror: prunedMaster.frames.vedicLahiri.data?.vargas?.supportedCount,
    vimshottariMaxDepth: vim5?.maxDepthObserved,
    prunedMasterChecksFailed: prunedVerif.failedCount,
  });

  // 3ab. Phase 3 — FreeAstroAPI 1-Call Supplementary Acquisition & Mandatory Compatibility Gates
  const suppReq = buildFreeAstroApiSupplementaryRequest(sampleInstant);
  assert(
    suppReq.endpoint === '/api/v2/vedic/calculate' &&
      Array.isArray(suppReq.body.vargas) &&
      (suppReq.body.vargas as number[]).join(',') === '1,5' &&
      suppReq.body.include_bhava_chalit === true &&
      suppReq.body.include_ashtakavarga === true &&
      suppReq.body.include_avastha === true &&
      suppReq.body.include_yogas === false &&
      suppReq.body.include_panchang === false &&
      suppReq.body.include_shadbala === false,
    'Phase 3 supplementary request builder did not target strictly required supplementary datasets.'
  );

  // Classical D5 helper for synthetic validation cases
  const parashariD5Sign = (lon: number): string => {
    const nLon = normalizeDeg(lon);
    const sIdx = Math.floor(nLon / 30) % 12;
    const part = Math.min(4, Math.floor((nLon % 30) / 6));
    const odd = [0, 10, 8, 2, 6];
    const even = [1, 5, 11, 9, 7];
    return SIGNS[sIdx % 2 === 0 ? odd[part] : even[part]];
  };

  // Build canonical FreeAstroAPI D1 + AV + Bhava Chalit + D5 payload matching sampleRef
  // Intentionally shift Rahu/Ketu (Mean vs True Node) to prove 7-planet AV passes while D5 catches node sensitivity
  const faSuppClassicalBodies = [
    { name: 'Sun', absolute_degree: sampleRef.lahiriSunLonDeg, avastha: 'Deepta' },
    { name: 'Moon', absolute_degree: sampleRef.lahiriMoonLonDeg, avastha: 'Mudita' },
    { name: 'Mars', absolute_degree: 185, avastha: 'Shanta' },
    { name: 'Mercury', absolute_degree: 230, avastha: 'Svastha' },
    { name: 'Jupiter', absolute_degree: 295, avastha: 'Deena' },
    { name: 'Venus', absolute_degree: 245, avastha: 'Mudita' },
    { name: 'Saturn', absolute_degree: 221, avastha: 'Shanta' },
  ];
  const faSuppNodesTrue = [
    { name: 'Rahu', absolute_degree: 29.8 }, // Aries (Mean was 12.53 Aries; differs > 0.2 deg)
    { name: 'Ketu', absolute_degree: 209.8 },
  ];
  const faSuppAllPlanets = [...faSuppClassicalBodies, ...faSuppNodesTrue].map((p) => ({
    ...p,
    sign: SIGNS[Math.floor(normalizeDeg(p.absolute_degree) / 30) % 12],
  }));

  const faBavRows: Record<string, number[]> = {
    Sun: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    Moon: [5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    Mars: [3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4],
    Mercury: [5, 5, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4],
    Jupiter: [5, 5, 5, 5, 5, 5, 5, 5, 4, 4, 4, 4],
    Venus: [5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4],
    Saturn: [3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4],
  };
  const faSavRow = Array.from({ length: 12 }, (_, idx) =>
    Object.values(faBavRows).reduce((s, r) => s + r[idx], 0)
  );
  const faContributors = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Ascendant'];
  const faPrastara: Record<string, Record<string, number[]>> = {};
  for (const [pl, row] of Object.entries(faBavRows)) {
    faPrastara[pl] = {};
    faContributors.forEach((cName, cIdx) => {
      faPrastara[pl][cName] = row.map((cnt) => (cIdx < cnt ? 1 : 0));
    });
  }

  const faValidBhavaChalit = {
    chart_type: 'bhava_chalit',
    name: 'Sripati Bhava Chalit',
    calibrated: true,
    house_basis: 'sripati_midpoint_chalit',
    ascendant: { degree: sampleRef.lahiriAscendantDeg, sign: SIGNS[Math.floor(sampleRef.lahiriAscendantDeg / 30) % 12] },
    houses: sampleRef.sripatiLahiriSandhisDeg.map((s) => ({
      house: s.house,
      degree_cusp: s.midpoint,
      boundary_start: s.start,
      boundary_end: s.end,
    })),
    planets: faSuppAllPlanets.map((p) => {
      const hObj = sampleRef.sripatiLahiriSandhisDeg.find((s) => {
        const st = normalizeDeg(s.start);
        const en = normalizeDeg(s.end);
        const t = normalizeDeg(p.absolute_degree);
        return st < en ? t >= st && t < en : t >= st || t < en;
      });
      return {
        name: p.name,
        absolute_degree: p.absolute_degree,
        chalit_house: hObj?.house ?? 1,
      };
    }),
  };

  const faUncalibratedD5 = {
    calibrated: false,
    ascendant: { sign: parashariD5Sign(sampleRef.lahiriAscendantDeg) },
    planets: faSuppAllPlanets.map((p) => ({
      name: p.name,
      sign: parashariD5Sign(p.absolute_degree),
    })),
  };

  const validSupplPayload = {
    ayanamsha: 'lahiri',
    timezone_used: 'Asia/Kolkata',
    chart: {
      metadata: { house_system: 'whole_sign', node_type: sampleInstant.input.nodeConvention },
      ascendant: {
        degree: sampleRef.lahiriAscendantDeg,
        sign: SIGNS[Math.floor(sampleRef.lahiriAscendantDeg / 30) % 12],
      },
      planets: faSuppAllPlanets,
    },
    vargas: {
      vargas: {
        D1: { ascendant: { sign: SIGNS[Math.floor(sampleRef.lahiriAscendantDeg / 30) % 12] }, planets: faSuppAllPlanets },
        D5: faUncalibratedD5,
      },
    },
    ashtakavarga: {
      sarvashtakavarga: faSavRow,
      bhinnashtakavarga: faBavRows,
      prastharashtakavarga: faPrastara,
      total_points: 337,
    },
    bhava_chalit: faValidBhavaChalit,
  };

  let singleCallFetchCount = 0;
  const singleCallRes = await acquireFreeAstroApiSupplementaryVedicCalculate(sampleInstant, {
    apiKey: 'test-key-redacted',
    rateWaitMs: 0,
    fetchFn: async (url: string) => {
      singleCallFetchCount++;
      assert(
        new URL(url).pathname === '/api/v2/vedic/calculate',
        `Expected single call to /api/v2/vedic/calculate, got ${url}`
      );
      return new Response(JSON.stringify(validSupplPayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert(
    singleCallFetchCount === 1 &&
      singleCallRes.status === 'acquired' &&
      singleCallRes.plannedRequestsCount === 1 &&
      singleCallRes.actualHttpRequestsSent === 1 &&
      singleCallRes.call !== null,
    'Single-call FreeAstroAPI supplementary acquisition helper failed.'
  );

  // Build an AstroWay primary master WITHOUT Ashtakavarga, Bhava Chalit, or D5
  const awWithoutAvOrBcCalls = { ...prunedAwLayerA.calls };
  delete awWithoutAvOrBcCalls.ashtakavarga_prastara;
  const awBaseForSupp = buildLayerBMasterChartRecord({
    instant: sampleInstant,
    rawLayerA: {
      ...prunedAwLayerA,
      calls: awWithoutAvOrBcCalls,
    },
  });
  assert(
    awBaseForSupp.frames.vedicLahiri.data?.ashtakavarga === null &&
      awBaseForSupp.frames.bhavaChalit.data === null &&
      !awBaseForSupp.frames.vedicLahiri.data?.vargas?.chartsByDivision?.D5,
    'Precondition for Phase 3 base AstroWay chart failed.'
  );

  const hybridMaster = buildLayerBMasterChartRecord({
    instant: sampleInstant,
    rawLayerA: {
      ...prunedAwLayerA,
      calls: awWithoutAvOrBcCalls,
    },
    supplementaryFreeAstroApiVedicCall: singleCallRes.call,
  });

  const hManifest = hybridMaster.datasetManifest!;
  const hEntry = (key: string) => hManifest.entries.find((e) => e.key === key);
  const hSun = hybridMaster.frames.vedicLahiri.data?.planets.find((p) => p.name === 'Sun');
  const hMars = hybridMaster.frames.vedicLahiri.data?.planets.find((p) => p.name === 'Mars');

  assert(
    hybridMaster.supplementaryIntegration?.singleCallOnly === true &&
      hybridMaster.supplementaryIntegration?.primaryPreservationGuarantee.primaryPlanetsOverwritten === false &&
      hybridMaster.supplementaryIntegration?.ashtakavarga.outcome === 'accepted' &&
      hybridMaster.supplementaryIntegration?.ashtakavarga.recommendedState === 'internally_verified' &&
      hybridMaster.supplementaryIntegration?.ashtakavarga.nodeSignOrLongitudeDiffs.some(
        (d) => (d.deltaDeg ?? 0) > 10
      ) &&
      hybridMaster.frames.vedicLahiri.data?.ashtakavarga?.totalPoints === 337 &&
      hybridMaster.supplementaryIntegration?.bhavaChalit.outcome === 'accepted' &&
      hybridMaster.frames.bhavaChalit.canonicalStatus === 'internally_verified' &&
      hEntry('bhava_chalit')?.canonicalStatus === 'internally_verified' &&
      hEntry('ashtakavarga_bav_sav_prastara')?.canonicalStatus === 'internally_verified' &&
      !hManifest.downstreamGuardSummary.dsi_dosha_strength?.missingPrerequisites.includes('bhava_chalit') &&
      !hManifest.downstreamGuardSummary.house_intelligence?.missingPrerequisites.includes('bhava_chalit') &&
      !hManifest.downstreamGuardSummary.house_intelligence?.missingPrerequisites.includes(
        'ashtakavarga_bav_sav_prastara'
      ) &&
      // Uncalibrated D5 must NOT pollute primary BPHS Shodashavarga; remains provisional
      hybridMaster.supplementaryIntegration?.d5.outcome === 'provisional' &&
      hybridMaster.supplementaryIntegration?.d5.detectedFormula === 'parashari_odd_even' &&
      !hybridMaster.frames.vedicLahiri.data?.vargas?.chartsByDivision?.D5 &&
      Boolean(hybridMaster.supplementaryIntegration?.provisionalCandidates?.d5) &&
      hEntry('vedic_d5_panchamsha')?.canonicalStatus === 'provisional' &&
      // Primary Sun avastha ('Kumara') preserved while missing Mars avastha ('Shanta') filled cleanly
      hSun?.avastha === 'Kumara' &&
      hMars?.avastha === 'Shanta' &&
      // AstroWay primary Shadbala, KP, and Dashas remained intact
      hybridMaster.shadbalaReconciliation.source.includes('astroway_v1') &&
      (hybridMaster.frames.vedicLahiri.data?.vimshottariDasha as Record<string, unknown>)?.maxDepthObserved === 5,
    `Phase 3 hybrid supplementary integration failed: notes=${JSON.stringify(hybridMaster.supplementaryIntegration?.summaryNotes)}, dsiMissing=${JSON.stringify(hManifest.downstreamGuardSummary.dsi_dosha_strength?.missingPrerequisites)}, houseMissing=${JSON.stringify(hManifest.downstreamGuardSummary.house_intelligence?.missingPrerequisites)}, sunAvastha=${String(hSun?.avastha)}, marsAvastha=${String(hMars?.avastha)}`
  );

  // Test established & calibrated D5 acceptance (calibrated=true, matching node convention, no boundary flip)
  const calibratedD5SupplCall: SanitizedProviderCallRecord = {
    ...singleCallRes.call!,
    rawResponse: {
      ...validSupplPayload,
      chart: {
        ...validSupplPayload.chart,
        planets: [...faSuppClassicalBodies, { name: 'Rahu', absolute_degree: 12.5352 }, { name: 'Ketu', absolute_degree: 192.5352 }].map(
          (p) => ({ ...p, sign: SIGNS[Math.floor(normalizeDeg(p.absolute_degree) / 30) % 12] })
        ),
      },
      vargas: {
        vargas: {
          D5: {
            calibrated: true,
            ascendant: { sign: parashariD5Sign(sampleRef.lahiriAscendantDeg) },
            planets: [...faSuppClassicalBodies, { name: 'Rahu', absolute_degree: 12.5352 }, { name: 'Ketu', absolute_degree: 192.5352 }].map(
              (p) => ({ name: p.name, sign: parashariD5Sign(p.absolute_degree) })
            ),
          },
        },
      },
    },
  };
  const d5AcceptedHybrid = integrateFreeAstroApiSupplementaryIntoMaster(awBaseForSupp, calibratedD5SupplCall);
  assert(
    d5AcceptedHybrid.supplementaryIntegration?.d5.outcome === 'accepted' &&
      d5AcceptedHybrid.supplementaryIntegration?.d5.recommendedState === 'available' &&
      d5AcceptedHybrid.frames.vedicLahiri.data?.vargas?.supportedCount === 17 &&
      Boolean(d5AcceptedHybrid.frames.vedicLahiri.data?.vargas?.chartsByDivision?.D5) &&
      d5AcceptedHybrid.datasetManifest?.entries.find((e) => e.key === 'vedic_d5_panchamsha')?.canonicalStatus ===
        'available',
    'Established & calibrated FreeAstroAPI D5 should be cleanly accepted into master Vargas.'
  );

  // Test Non-Overwrite Guarantee when AstroWay already owns valid Ashtakavarga
  const customAwSavCheck = prunedMaster.frames.vedicLahiri.data?.ashtakavarga?.sarvashtakavarga;
  const crossVerifiedAw = integrateFreeAstroApiSupplementaryIntoMaster(prunedMaster, singleCallRes.call);
  assert(
    crossVerifiedAw.supplementaryIntegration?.ashtakavarga.outcome === 'preserved_primary_cross_verified' &&
      JSON.stringify(crossVerifiedAw.frames.vedicLahiri.data?.ashtakavarga?.sarvashtakavarga) ===
        JSON.stringify(customAwSavCheck),
    'Existing valid primary AstroWay Ashtakavarga must never be overwritten by supplementary data.'
  );

  // Adversarial Rejection 1: Matching 337 SAV total alone with mismatched planet sign MUST fail!
  const signMismatchAvEval = evaluateAshtakavargaCompatibility(awBaseForSupp, {
    ...validSupplPayload,
    chart: {
      ...validSupplPayload.chart,
      planets: validSupplPayload.chart.planets.map((p) =>
        p.name === 'Saturn' ? { ...p, sign: 'Aries' } : p
      ),
    },
  });
  assert(
    signMismatchAvEval.audit.savTotalEquals337 === true &&
      signMismatchAvEval.audit.sevenClassicalPlanetSignsMatch === false &&
      signMismatchAvEval.audit.totalsAloneRejectedNotice === true &&
      signMismatchAvEval.audit.recommendedState === 'incompatible' &&
      signMismatchAvEval.normalizedSupplementaryAv === null,
    'Ashtakavarga matching 337 total with mismatched classical planet sign was not rejected!'
  );

  // Adversarial Rejection 2: BAV-to-SAV & Prastara mismatch (even with SAV=337) MUST fail!
  const corruptedPrastara = structuredClone(faPrastara);
  corruptedPrastara.Sun.Sun[0] = corruptedPrastara.Sun.Sun[0] === 1 ? 0 : 1;
  const prastaraMismatchAvEval = evaluateAshtakavargaCompatibility(awBaseForSupp, {
    ...validSupplPayload,
    ashtakavarga: {
      ...validSupplPayload.ashtakavarga,
      prastharashtakavarga: corruptedPrastara,
    },
  });
  assert(
    prastaraMismatchAvEval.audit.savTotalEquals337 === true &&
      prastaraMismatchAvEval.audit.prastaraReconciliationPassed === false &&
      prastaraMismatchAvEval.audit.recommendedState === 'incompatible',
    'Prastara contributor mismatch was not rejected!'
  );

  // Adversarial Rejection 3: KP Placidus cusp starts passed as Bhava Chalit MUST be rejected cleanly
  const kpCuspAsBhavaChalitCall: SanitizedProviderCallRecord = {
    ...singleCallRes.call!,
    rawResponse: {
      ...validSupplPayload,
      bhava_chalit: {
        house_basis: 'placidus',
        houses: sampleRef.kpPlacidusCuspsDeg.map((cusp, idx) => ({
          house: idx + 1,
          degree_cusp: cusp,
          boundary_start: cusp,
          boundary_end: sampleRef.kpPlacidusCuspsDeg[(idx + 1) % 12],
        })),
        planets: faSuppAllPlanets.map((p) => ({
          name: p.name,
          absolute_degree: p.absolute_degree,
          chalit_house: 1,
        })),
      },
    },
  };
  const rejectedBcMaster = integrateFreeAstroApiSupplementaryIntoMaster(
    awBaseForSupp,
    kpCuspAsBhavaChalitCall
  );
  assert(
    rejectedBcMaster.supplementaryIntegration?.bhavaChalit.kpPlacidusConfusionDetected === true &&
      rejectedBcMaster.supplementaryIntegration?.bhavaChalit.recommendedState === 'incompatible' &&
      rejectedBcMaster.frames.bhavaChalit.canonicalStatus === 'incompatible' &&
      rejectedBcMaster.datasetManifest?.entries.find((e) => e.key === 'bhava_chalit')?.canonicalStatus ===
        'incompatible' &&
      rejectedBcMaster.datasetManifest?.downstreamGuardSummary.dsi_dosha_strength?.ready === false &&
      rejectedBcMaster.datasetManifest?.downstreamGuardSummary.house_intelligence?.ready === false,
    'KP Placidus cusp starts masquerading as Sripati Bhava Chalit failed to reject cleanly.'
  );

  // Adversarial Rejection 4: Mismatched coords / longitudes for Bhava Chalit & D5
  const badCoordsCall: SanitizedProviderCallRecord = {
    ...singleCallRes.call!,
    sanitizedRequest: {
      ...singleCallRes.call!.sanitizedRequest,
      lat: 51.5074, // Wrong latitude (London vs Bardhaman)
    },
  };
  const badBcEval = evaluateBhavaChalitCompatibility(
    awBaseForSupp,
    validSupplPayload,
    badCoordsCall,
    sampleRef
  );
  const badD5Eval = evaluateD5DivisionalCompatibility(awBaseForSupp, validSupplPayload, badCoordsCall);
  assert(
    badBcEval.audit.coordinatesCompatible === false &&
      badBcEval.audit.recommendedState === 'incompatible' &&
      badD5Eval.audit.recommendedState === 'incompatible',
    'Coordinate mismatch failed to trigger incompatible rejection on Bhava Chalit / D5.'
  );

  // Boundary Sensitivity Check: D5 body right across 6° boundary (e.g., primary Mars=185° vs supp=186.05° -> 5° vs 6.05°; or 215.95°)
  const boundaryFlipD5Eval = evaluateD5DivisionalCompatibility(awBaseForSupp, {
    ...validSupplPayload,
    chart: {
      ...validSupplPayload.chart,
      planets: validSupplPayload.chart.planets.map((p) =>
        p.name === 'Saturn' ? { ...p, absolute_degree: 215.95 } : p
      ), // Primary Saturn is 221° vs 215.95° -> crosses 6° boundary -> flipped D5 sign
    },
    vargas: {
      vargas: {
        D5: {
          ...faUncalibratedD5,
          calibrated: true,
        },
      },
    },
  });
  assert(
    boundaryFlipD5Eval.audit.longitudesCompatible === false &&
      boundaryFlipD5Eval.audit.boundarySensitiveBodies.some((b) => b.body === 'Saturn'),
    `D5 boundary sensitivity check failed: ${JSON.stringify(boundaryFlipD5Eval.audit)}`
  );

  regressionResults.push({
    id: 'phase3_freeastroapi_supplementary_compatibility_gates',
    status: 'PASSED',
    singleCallHttpRequests: singleCallRes.actualHttpRequestsSent,
    hybridAvOutcome: hybridMaster.supplementaryIntegration?.ashtakavarga.outcome,
    hybridBcStatus: hybridMaster.frames.bhavaChalit.canonicalStatus,
    hybridD5UncalibratedStatus: hybridMaster.datasetManifest?.entries.find((e) => e.key === 'vedic_d5_panchamsha')?.canonicalStatus,
    calibratedD5Status: d5AcceptedHybrid.datasetManifest?.entries.find((e) => e.key === 'vedic_d5_panchamsha')?.canonicalStatus,
    totalsOnlyRejectionVerified: signMismatchAvEval.audit.totalsAloneRejectedNotice,
    kpPlacidusConfusionRejected: rejectedBcMaster.supplementaryIntegration?.bhavaChalit.kpPlacidusConfusionDetected,
  });

  // 3ac. Phase 4 — Local Mathematical Calculations & Independent Ashtakavarga Validation
  // A. Classical BPHS Rules Table Verification
  const avRulesAudit = verifyClassicalAshtakavargaRulesTable();
  assert(
    avRulesAudit.valid === true &&
      avRulesAudit.totalTargets === 7 &&
      avRulesAudit.totalContributorsPerTarget === 8 &&
      avRulesAudit.ascendantContributionSum === 45 &&
      avRulesAudit.grandTotal === 337 &&
      avRulesAudit.perPlanetSums.Sun === 48 &&
      avRulesAudit.perPlanetSums.Moon === 49 &&
      avRulesAudit.perPlanetSums.Mars === 39 &&
      avRulesAudit.perPlanetSums.Mercury === 54 &&
      avRulesAudit.perPlanetSums.Jupiter === 56 &&
      avRulesAudit.perPlanetSums.Venus === 52 &&
      avRulesAudit.perPlanetSums.Saturn === 39,
    `Phase 4 classical BPHS rules table validation failed: ${JSON.stringify(avRulesAudit)}`
  );

  // B. Independent Local Ashtakavarga + Legacy jyotishMath Audit across Multiple Charts & Boundary Cases
  const chart1AvInput = extractCanonicalAshtakavargaSignInput(prunedMaster.frames.vedicLahiri.data);
  assert(chart1AvInput !== null, 'Failed to extract canonical Ashtakavarga input from prunedMaster.');
  const chart1LocalAv = computeLocalAshtakavarga(chart1AvInput!);
  const chart1LegacyAudit = auditLegacyJyotishMathAshtakavarga(chart1AvInput!);

  // Second independent chart (mixed signs across hemisphere & dual signs)
  const chart2AvInput = {
    ascendantSignIndex: 3, // Cancer
    planetSignIndices: {
      Sun: 11,     // Pisces
      Moon: 1,     // Taurus
      Mars: 9,     // Capricorn
      Mercury: 0,  // Aries
      Jupiter: 6,  // Libra
      Venus: 10,   // Aquarius
      Saturn: 7,   // Scorpio
    },
  };
  const chart2LocalAv = computeLocalAshtakavarga(chart2AvInput);
  const chart2LegacyAudit = auditLegacyJyotishMathAshtakavarga(chart2AvInput);

  // Third chart: crowded conjunction boundary test
  const chart3AvInput = {
    ascendantSignIndex: 11, // Pisces
    planetSignIndices: {
      Sun: 0,
      Moon: 0,
      Mars: 0,
      Mercury: 0,
      Jupiter: 5,
      Venus: 11,
      Saturn: 6,
    },
  };
  const chart3LocalAv = computeLocalAshtakavarga(chart3AvInput);
  const chart3LegacyAudit = auditLegacyJyotishMathAshtakavarga(chart3AvInput);

  assert(
    chart1LocalAv !== null &&
      chart1LocalAv.selfConsistencyPassed === true &&
      chart1LocalAv.totalPoints === 337 &&
      chart1LegacyAudit !== null &&
      chart1LegacyAudit.withAscendantMatchedAll84BavCells === true &&
      chart1LegacyAudit.withAscendantMatchedAll12SavCells === true &&
      chart1LegacyAudit.withAscendantTotalBindus === 337 &&
      chart1LegacyAudit.withoutAscendantTotalBindus === 292 &&
      chart1LegacyAudit.withoutAscendantDroppedBindus === 45 &&
      chart1LegacyAudit.legacyEmitsPrastara === false &&
      chart2LocalAv?.selfConsistencyPassed === true &&
      chart2LegacyAudit?.withAscendantMatchedAll84BavCells === true &&
      chart2LegacyAudit?.withAscendantMatchedAll12SavCells === true &&
      chart3LocalAv?.selfConsistencyPassed === true &&
      chart3LegacyAudit?.withAscendantMatchedAll84BavCells === true &&
      chart3LegacyAudit?.withAscendantMatchedAll12SavCells === true,
    'Phase 4 multi-chart Ashtakavarga & legacy jyotishMath audit failed.'
  );

  // Verify Mean vs True Node invariance for local Ashtakavarga & single-cell Prastara sensitivity
  const nodeVariantFrame: VedicLahiriFrame = {
    ...prunedMaster.frames.vedicLahiri.data!,
    planets: prunedMaster.frames.vedicLahiri.data!.planets.map((p) =>
      p.name === 'Rahu'
        ? { ...p, degree: 29.8, absolute_degree: 29.8, sign: 'Aries', signIndex: 0 }
        : p.name === 'Ketu'
        ? { ...p, degree: 209.8, absolute_degree: 209.8, sign: 'Libra', signIndex: 6 }
        : p
    ),
  };
  const nodeVariantAv = computeLocalAshtakavarga(
    extractCanonicalAshtakavargaSignInput(nodeVariantFrame)!
  )!;
  const nodeInvarianceCmp = compareAshtakavargaMatrices(
    chart1LocalAv!,
    nodeVariantAv,
    'node_variant_chart'
  );
  assert(
    nodeInvarianceCmp.exactAllCellsMatch === true &&
      nodeInvarianceCmp.prastaraCompared === true &&
      nodeInvarianceCmp.prastaraMatched === true,
    'Mean vs True Node shifts must not alter 7-planet Ashtakavarga.'
  );

  // Corrupt 1 Prastara cell while preserving exact 337 SAV & BAV rows? -> catches Prastara cell drift!
  const corruptedLocalPrastara = structuredClone(chart1LocalAv!.prastharashtakavarga);
  corruptedLocalPrastara.Sun.Sun[0] = corruptedLocalPrastara.Sun.Sun[0] === 1 ? 0 : 1;
  const singlePrastaraCorruptionCmp = compareAshtakavargaMatrices(
    chart1LocalAv!,
    {
      sarvashtakavarga: chart1LocalAv!.sarvashtakavarga,
      bhinnashtakavarga: chart1LocalAv!.bhinnashtakavarga,
      prastharashtakavarga: corruptedLocalPrastara,
    },
    'corrupted_1_prastara_cell'
  );
  assert(
    singlePrastaraCorruptionCmp.savMatched === true &&
      singlePrastaraCorruptionCmp.bavMatched === true &&
      singlePrastaraCorruptionCmp.prastaraMatched === false &&
      singlePrastaraCorruptionCmp.exactAllCellsMatch === false &&
      singlePrastaraCorruptionCmp.prastaraDiffs.length === 1,
    'compareAshtakavargaMatrices must catch a single corrupted Prastara contributor cell even when BAV/SAV match.'
  );

  // Sign boundary test: 29.99° -> 0.01° across Aries/Taurus for Saturn & Pisces/Aries for Ascendant
  const saturnBoundary = evaluateAshtakavargaSignBoundaryCase(chart2AvInput, 'Saturn', 29.99, 30.01);
  const ascBoundary = evaluateAshtakavargaSignBoundaryCase(chart2AvInput, 'Ascendant', 359.99, 0.01);
  assert(
    saturnBoundary.beforeSign === 'Aries' &&
      saturnBoundary.afterSign === 'Taurus' &&
      saturnBoundary.invariant337Preserved === true &&
      saturnBoundary.savShiftedSignCount > 0 &&
      saturnBoundary.bavShiftedCellCount > 0 &&
      saturnBoundary.prastaraShiftedCellCount > 0 &&
      ascBoundary.beforeSign === 'Pisces' &&
      ascBoundary.afterSign === 'Aries' &&
      ascBoundary.invariant337Preserved === true &&
      ascBoundary.prastaraShiftedCellCount > 0,
    'Ashtakavarga 29.99° -> 0.01° boundary shift check failed.'
  );

  // C. Promoting Validated Local Ashtakavarga as Preferred Implementation (and preserving backups)
  const preferredOnMissingAv = adoptPreferredLocalAshtakavarga(awBaseForSupp);
  const preferredOnHybrid = adoptPreferredLocalAshtakavarga(hybridMaster);
  const directPreferredMaster = buildLayerBMasterChartRecord({
    instant: sampleInstant,
    rawLayerA: prunedAwLayerA,
    referenceDateIso: '2026-11-27',
    preferLocalAshtakavarga: true,
  });
  assert(
    preferredOnMissingAv.frames.vedicLahiri.data?.ashtakavarga?.totalPoints === 337 &&
      Object.keys(
        preferredOnMissingAv.frames.vedicLahiri.data?.ashtakavarga?.prastharashtakavarga ?? {}
      ).length === 7 &&
      preferredOnMissingAv.providerExtendedDatasets?.localAshtakavargaPreferred === true &&
      preferredOnMissingAv.datasetManifest?.entries.find(
        (e) => e.key === 'ashtakavarga_bav_sav_prastara'
      )?.canonicalStatus === 'independently_validated' &&
      Boolean(preferredOnHybrid.providerExtendedDatasets?.providerOriginalAshtakavargaBackup) &&
      preferredOnHybrid.datasetManifest?.entries.find(
        (e) => e.key === 'ashtakavarga_bav_sav_prastara'
      )?.canonicalStatus === 'independently_validated' &&
      directPreferredMaster.providerExtendedDatasets?.localAshtakavargaPreferred === true &&
      directPreferredMaster.datasetManifest?.entries.find(
        (e) => e.key === 'ashtakavarga_bav_sav_prastara'
      )?.canonicalStatus === 'independently_validated',
    'Local Ashtakavarga preferred adoption / backup preservation failed.'
  );

  // D. Zero-Coercion on Partial Vargas (prunedMaster has only 2 planets per varga -> must NOT fabricate Vimshopaka)
  const pmManifest = prunedMaster.datasetManifest!;
  const pmExt = prunedMaster.providerExtendedDatasets as Record<string, unknown>;
  const pmPanchadha = pmExt.panchadhaMaitri as ReturnType<typeof computePanchadhaMaitri>;
  const pmVimshopakaPartial = pmExt.vimshopakaBala as ReturnType<typeof computeVimshopakaBala>;
  const pmDispositorPartial = pmExt.dispositorRelationships as ReturnType<
    typeof computeDispositorRelationships
  >;

  assert(
    pmPanchadha?.valid === true &&
      pmVimshopakaPartial !== null &&
      pmVimshopakaPartial.completeSchemesCount === 0 &&
      pmVimshopakaPartial.schemes.shodashavarga.scoresByPlanet === null &&
      pmManifest.entries.find((e) => e.key === 'panchadha_maitri')?.canonicalStatus ===
        'internally_verified' &&
      pmManifest.entries.find((e) => e.key === 'vimshopaka_bala')?.canonicalStatus ===
        'unavailable' &&
      pmDispositorPartial?.valid === true &&
      pmDispositorPartial.d9.available === false,
    'Zero-coercion guard failed on partial 2-planet Varga mock chart.'
  );

  // Build Full 9-planet Shodashavarga (16-Varga) AstroWay Master Record & verify Vimshopaka + Dispositors + PHI Unlock
  const all9VargaBodies = [
    { name: 'Sun', longitude: sampleRef.lahiriSunLonDeg },
    { name: 'Moon', longitude: sampleRef.lahiriMoonLonDeg },
    { name: 'Mars', longitude: 185 },
    { name: 'Mercury', longitude: 230 },
    { name: 'Jupiter', longitude: 295 },
    { name: 'Venus', longitude: 245 },
    { name: 'Saturn', longitude: 221 },
    { name: 'Rahu', longitude: 12.5352 },
    { name: 'Ketu', longitude: 192.5352 },
  ];
  const full16VargaAwLayerA: LayerARawProviderRecord = {
    ...prunedAwLayerA,
    calls: {
      ...prunedAwLayerA.calls,
      ...Object.fromEntries(
        [1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60]
          .filter((div) => div !== 1) // verify D1 mirror still supplies D1!
          .map((div) => [
            `varga_D${div}`,
            makeAwCall(`varga_D${div}`, `/vedic/varga/D${div}`, 'varga', {
              varga: `D${div}`,
              ayanamsa: 23.66,
              lagna: { signName: SIGNS[getVargaSignIndex(sampleRef.lahiriAscendantDeg, div)] },
              planets: all9VargaBodies.map((b) => ({
                name: b.name,
                signName: SIGNS[getVargaSignIndex(b.longitude, div)],
                longitude: b.longitude,
              })),
            }),
          ])
      ),
    },
  };
  const full16VargaMasterRaw = buildLayerBMasterChartRecord({
    instant: sampleInstant,
    rawLayerA: full16VargaAwLayerA,
    referenceDateIso: '2026-11-27',
  });
  const full16VargaMaster = enrichMasterWithPhase4LocalCalculations({
    ...full16VargaMasterRaw,
    shadbalaReconciliation: {
      ...full16VargaMasterRaw.shadbalaReconciliation,
      canonicalStatus: 'internally_verified',
      verificationStatus: 'internally_verified',
    },
  });

  const f16Manifest = full16VargaMaster.datasetManifest!;
  const f16Ext = full16VargaMaster.providerExtendedDatasets as Record<string, unknown>;
  const f16Panchadha = f16Ext.panchadhaMaitri as ReturnType<typeof computePanchadhaMaitri>;
  const f16Vimshopaka = f16Ext.vimshopakaBala as ReturnType<typeof computeVimshopakaBala>;
  const f16Dispositor = f16Ext.dispositorRelationships as ReturnType<
    typeof computeDispositorRelationships
  >;

  assert(
    f16Panchadha?.valid === true &&
      f16Vimshopaka?.valid === true &&
      f16Vimshopaka.shodashavargaComplete === true &&
      f16Vimshopaka.completeSchemesCount === 4 &&
      f16Vimshopaka.schemes.shadvarga.complete === true &&
      f16Vimshopaka.schemes.saptavarga.complete === true &&
      f16Vimshopaka.schemes.dashavarga.complete === true &&
      f16Vimshopaka.schemes.shodashavarga.complete === true &&
      Object.values(f16Vimshopaka.schemes.shodashavarga.scoresByPlanet ?? {}).every(
        (s) => s.scoreOutOf20 > 0 && s.scoreOutOf20 <= 20
      ) &&
      f16Dispositor?.valid === true &&
      f16Dispositor.d9.available === true &&
      f16Manifest.entries.find((e) => e.key === 'panchadha_maitri')?.canonicalStatus ===
        'internally_verified' &&
      f16Manifest.entries.find((e) => e.key === 'vimshopaka_bala')?.canonicalStatus ===
        'internally_verified' &&
      f16Manifest.entries.find((e) => e.key === 'dispositor_relationships')?.canonicalStatus ===
        'internally_verified' &&
      f16Manifest.downstreamGuardSummary.phi_planetary_health?.ready === true,
    `Phase 4 local Vedic enrichment / PHI readiness check failed: missing=${JSON.stringify(f16Manifest.downstreamGuardSummary.phi_planetary_health?.missingPrerequisites)}`
  );

  // E. Zero-Coercion Vimshopaka Guard (omitting D60 keeps Shadvarga/Saptavarga complete, marks Dashavarga/Shodashavarga incomplete & manifest 'provisional')
  const vargaWithoutD60 = { ...full16VargaMaster.frames.vedicLahiri.data!.vargas! };
  const clonedDivsNoD60 = { ...(vargaWithoutD60.chartsByDivision ?? {}) };
  delete clonedDivsNoD60.D60;
  const masterNoD60 = enrichMasterWithPhase4LocalCalculations({
    ...full16VargaMaster,
    frames: {
      ...full16VargaMaster.frames,
      vedicLahiri: {
        ...full16VargaMaster.frames.vedicLahiri,
        data: {
          ...full16VargaMaster.frames.vedicLahiri.data!,
          vargas: {
            ...vargaWithoutD60,
            chartsByDivision: clonedDivsNoD60,
          },
        },
      },
    },
  });
  const noD60Vim = (masterNoD60.providerExtendedDatasets as Record<string, unknown>)
    .vimshopakaBala as ReturnType<typeof computeVimshopakaBala>;
  assert(
    noD60Vim !== null &&
      noD60Vim.schemes.shadvarga.complete === true &&
      noD60Vim.schemes.saptavarga.complete === true &&
      noD60Vim.schemes.dashavarga.complete === false &&
      noD60Vim.schemes.dashavarga.scoresByPlanet === null &&
      noD60Vim.schemes.dashavarga.missingDivisions.includes('D60') &&
      noD60Vim.schemes.shodashavarga.complete === false &&
      noD60Vim.schemes.shodashavarga.scoresByPlanet === null &&
      masterNoD60.datasetManifest?.entries.find((e) => e.key === 'vimshopaka_bala')
        ?.canonicalStatus === 'provisional',
    'Zero-coercion Vimshopaka guard failed when D60 is absent.'
  );

  // F. Dispositor Cycle Termination (2-planet Maha Parivartana + 3-planet loop) & Local Vedic Conditions fallback (Dignity, Combustion, Vargottama, Gandanta, Graha Yuddha)
  const cycleAndCondFrame: VedicLahiriFrame = {
    ayanamshaLabel: 'lahiri',
    houseSystem: 'whole_sign',
    nodeType: 'mean',
    timezoneUsed: 'Asia/Kolkata',
    ascendant: { degree: 10, sign: 'Aries', signIndex: 0 },
    planets: [
      { name: 'Sun', degree: 185, absolute_degree: 185, sign: 'Libra', signIndex: 6, is_retrograde: false },       // Libra -> Venus (H7)
      { name: 'Venus', degree: 125, absolute_degree: 125, sign: 'Leo', signIndex: 4, is_retrograde: false },     // Leo -> Sun (H5) => Maha Parivartana (5/7)
      { name: 'Moon', degree: 32, absolute_degree: 32, sign: 'Taurus', signIndex: 1, is_retrograde: false },     // Taurus 2° => Exalted
      { name: 'Mercury', degree: 173.5, absolute_degree: 173.5, sign: 'Virgo', signIndex: 5, is_retrograde: true }, // Virgo 23.5° retro => Own Sign + Combust (11.5° <= 12° retro orb)
      { name: 'Mars', degree: 358.8, absolute_degree: 358.8, sign: 'Pisces', signIndex: 11, is_retrograde: false }, // Pisces 28.8° => Gandanta (1.2° <= 3°20') -> Jupiter
      { name: 'Jupiter', degree: 285.0, absolute_degree: 285.0, sign: 'Capricorn', signIndex: 9, is_retrograde: false }, // Cap -> Saturn
      { name: 'Saturn', degree: 15.0, absolute_degree: 15.0, sign: 'Aries', signIndex: 0, is_retrograde: false }, // Aries -> Mars (closes 3-node loop Mars->Jupiter->Saturn->Mars)
      { name: 'Rahu', degree: 50, absolute_degree: 50, sign: 'Taurus', signIndex: 1, is_retrograde: true },
      { name: 'Ketu', degree: 230, absolute_degree: 230, sign: 'Scorpio', signIndex: 7, is_retrograde: true },
    ],
    houses: [],
    sadeSati: null,
    vargas: {
      supportedCount: 1,
      divisionsReturned: ['D9'],
      chartsByDivision: {
        D9: {
          ascendant: { sign: 'Aries' },
          planets: [
            { name: 'Sun', sign: 'Libra' }, // Vargottama!
            { name: 'Moon', sign: 'Aries' },
            { name: 'Mars', sign: 'Pisces' }, // Vargottama!
            { name: 'Mercury', sign: 'Leo' },
            { name: 'Jupiter', sign: 'Taurus' },
            { name: 'Venus', sign: 'Taurus' },
            { name: 'Saturn', sign: 'Leo' },
          ],
        },
      },
    },
    ashtakavarga: null,
    yogas: null,
    panchang: null,
    vimshottariDasha: null,
    providerMetadata: null,
  };

  const customPanchadha = computePanchadhaMaitri(cycleAndCondFrame);
  const customDispositor = computeDispositorRelationships(cycleAndCondFrame);
  const customLocalCond = computeLocalVedicConditions(cycleAndCondFrame, customPanchadha);

  // Also check Graha Yuddha within 1.0° (Mars 40.2° vs Jupiter 40.65°)
  const yuddhaFrame: VedicLahiriFrame = {
    ...cycleAndCondFrame,
    planets: cycleAndCondFrame.planets.map((p) =>
      p.name === 'Mars'
        ? { ...p, degree: 40.2, absolute_degree: 40.2, sign: 'Taurus', signIndex: 1 }
        : p.name === 'Jupiter'
        ? { ...p, degree: 40.65, absolute_degree: 40.65, sign: 'Taurus', signIndex: 1 }
        : p
    ),
  };
  const yuddhaCond = computeLocalVedicConditions(yuddhaFrame, computePanchadhaMaitri(yuddhaFrame));

  // Verify planetary_dignity_conditions unlocks on FreeAstroAPI chart when provider dignity/combustion flags absent
  const faWithoutDignityTags = buildLayerBMasterChartRecord({
    instant: sampleInstant,
    rawLayerA: {
      ...syntheticPartialLayerA,
      calls: {
        ...syntheticPartialLayerA.calls,
        vedic_calculate: {
          ...syntheticPartialLayerA.calls.vedic_calculate,
          rawResponse: {
            ayanamsha: 'lahiri',
            timezone_used: 'Asia/Kolkata',
            chart: {
              ascendant: validSupplPayload.chart.ascendant,
              planets: faSuppAllPlanets.map((p) => ({
                name: p.name,
                absolute_degree: p.absolute_degree,
                sign: p.sign,
              })),
            },
          },
        },
      },
    },
  });

  const faDigStatus = faWithoutDignityTags.datasetManifest?.entries.find(
    (e) => e.key === 'planetary_dignity_conditions'
  )?.canonicalStatus;

  assert(
    customDispositor !== null &&
      customDispositor.d1.mutualExchanges.length === 1 &&
      customDispositor.d1.mutualExchanges[0].planetA === 'Sun' &&
      customDispositor.d1.mutualExchanges[0].planetB === 'Venus' &&
      customDispositor.d1.mutualExchanges[0].parivartanaType === 'Maha' &&
      customDispositor.d1.planets.Sun.terminationType === 'mutual_exchange_loop' &&
      customDispositor.d1.planets.Mars.terminationType === 'multi_node_cycle' &&
      customDispositor.d1.planets.Mars.cycleNodes.length === 3 &&
      customLocalCond !== null &&
      customLocalCond.byPlanet.Sun.dignity === 'Debilitated' &&
      customLocalCond.byPlanet.Sun.isVargottama === true &&
      customLocalCond.byPlanet.Moon.dignity === 'Exalted' &&
      customLocalCond.byPlanet.Mercury.dignity === 'Own Sign' &&
      customLocalCond.byPlanet.Mercury.isCombust === true &&
      customLocalCond.byPlanet.Mars.isGandanta === true &&
      customLocalCond.byPlanet.Mars.isVargottama === true &&
      yuddhaCond !== null &&
      yuddhaCond.grahaYuddhaPairs.length === 1 &&
      yuddhaCond.grahaYuddhaPairs[0].planetA === 'Mars' &&
      yuddhaCond.grahaYuddhaPairs[0].planetB === 'Jupiter' &&
      yuddhaCond.byPlanet.Mars.inGrahaYuddha === true &&
      faDigStatus === 'internally_verified',
    `Phase 4 Dispositor/Conditions/Fallback check failed: parivartana=${JSON.stringify(customDispositor?.d1.mutualExchanges)}, sunTerm=${customDispositor?.d1.planets.Sun.terminationType}, marsCycle=${JSON.stringify(customDispositor?.d1.planets.Mars.cycleNodes)}, sunDignity=${customLocalCond?.byPlanet.Sun.dignity}, sunVarg=${customLocalCond?.byPlanet.Sun.isVargottama}, moon=${customLocalCond?.byPlanet.Moon.dignity}, merc=${customLocalCond?.byPlanet.Mercury.dignity}/combust=${customLocalCond?.byPlanet.Mercury.isCombust}, marsGandanta=${customLocalCond?.byPlanet.Mars.isGandanta}/varg=${customLocalCond?.byPlanet.Mars.isVargottama}, yuddha=${JSON.stringify(yuddhaCond?.grahaYuddhaPairs)}, faDigStatus=${faDigStatus}`
  );

  regressionResults.push({
    id: 'phase4_local_mathematical_calculations',
    status: 'PASSED',
    bphsRulesTableValid: avRulesAudit.valid,
    multiChartLegacyAshtakavargaMatched: true,
    legacyDroppedAscendantBindus: chart1LegacyAudit!.withoutAscendantDroppedBindus,
    boundaryShift337Preserved:
      saturnBoundary.invariant337Preserved && ascBoundary.invariant337Preserved,
    preferredLocalAshtakavargaStatus:
      preferredOnMissingAv.datasetManifest?.entries.find(
        (e) => e.key === 'ashtakavarga_bav_sav_prastara'
      )?.canonicalStatus,
    partialVargaZeroCoercionBlocked: pmVimshopakaPartial?.completeSchemesCount === 0,
    shodashavargaVimshopakaReady: f16Vimshopaka?.shodashavargaComplete,
    phiDownstreamUnlockedOnFullChart:
      f16Manifest.downstreamGuardSummary.phi_planetary_health?.ready,
    zeroCoercionNoD60Status:
      masterNoD60.datasetManifest?.entries.find((e) => e.key === 'vimshopaka_bala')?.canonicalStatus,
  });

  // 4. Read-Only Existing Profile Defect Audit + Legacy vs V2 Comparison on Local Fixtures
  const profileAudits: unknown[] = [];
  for (const [id, filePath] of [
    ['chris-3-bardhaman', 'public/assets/aistudio/chris-3-birth-chart_0f73e755.json'],
    ['chris-4-bardhaman', 'public/assets/aistudio/chris-4-birth-chart_8e64429a.json'],
    ['chris-new-kolkata', 'public/assets/aistudio/chris-new-birth-chart_c00320ea.json'],
  ]) {
    const abs = path.resolve(process.cwd(), filePath);
    if (fs.existsSync(abs)) {
      const json = JSON.parse(fs.readFileSync(abs, 'utf8'));
      const assessment = assessChartJsonDefects(id, String(json?.meta?.name || id), json);
      profileAudits.push(assessment);
      if (id === 'chris-4-bardhaman') {
        const startedAt = Date.now();
        const cmp = buildLegacyVsV2ComparisonReport({
          profileId: id,
          profileName: String(json?.meta?.name || id),
          legacyChartJson: json,
          instant: sampleInstant,
          layerB: partialMaster,
        });
        const cmpBytes = Buffer.byteLength(JSON.stringify(cmp), 'utf8');
        regressionResults.push({
          id: 'chris_4_legacy_comparison_check',
          status: 'PASSED',
          legacyProviderRecorded: cmp.legacyMeta.providerRecorded,
          legacyAscDeg: cmp.primaryCoordinatesComparison.ascendant.legacyDeg,
          independentRefAscDeg: cmp.primaryCoordinatesComparison.ascendant.independentRefDeg,
          kpSignFlipsCount: cmp.kpCuspsComparison.filter((c) => c.signFlipBetweenLegacyAndRef).length,
          comparisonDurationMs: Date.now() - startedAt,
          comparisonBytes: cmpBytes,
        });
      }
    }
  }

  console.log('\n--- Offline Regression & Read-Only Profile Audits ---');
  console.log(JSON.stringify({ regressionResults, profileAudits }, null, 2));

  // 5. Live Authenticated Verification (if FREE_ASTRO_API_KEY is configured)
  const apiKey = getFreeAstroApiKey();
  const liveSummaries: Array<Record<string, unknown>> = [];

  if (!apiKey) {
    console.log('\n[LIVE VERIFICATION BLOCKED] FREE_ASTRO_API_KEY is unset in runtime process.env.');
    console.log('To run live 4-request verification:');
    console.log('  - Configure FREE_ASTRO_API_KEY in environment secrets / .env.local (gitignored)');
    console.log('  - Re-run: npx tsx scripts/verifyV2Engine.ts');

    const offlineArtifact = redactSecretsDeep({
      generatedAtUtc: new Date().toISOString(),
      secretStatus,
      liveStatus: 'BLOCKED_MISSING_FREE_ASTRO_API_KEY',
      regressionResults,
      profileAudits,
      readOnlySupabaseDiagnosticSql: READ_ONLY_SUPABASE_DIAGNOSTIC_SQL,
    });
    fs.writeFileSync(
      path.join(outDir, 'offline-verification-report.json'),
      JSON.stringify(offlineArtifact, null, 2),
      'utf8'
    );
    if (requireLive) {
      process.exit(2);
    }
    return;
  }

  // Live execution on Bardhaman 1985 + New Delhi 1988
  for (const fx of FIXTURES.slice(0, 2)) {
    const instant = resolveCanonicalBirthInstant(fx.input);
    console.log(`\n>>> Running LIVE V2 Acquisition for ${fx.id} (${instant.utc.iso})...`);
    const layerA = await acquireV2NatalBundle(instant, {
      apiKey,
      timeMode: 'local_iana',
      includeTimezoneEquivalenceProbe: true,
      onProgress: (msg) => console.log(msg),
    });
    const layerB = buildLayerBMasterChartRecord({ instant, rawLayerA: layerA });
    const layerC = buildLayerCAnalyticalShell(layerB);
    const verification = verifyMasterChartRecord(layerB, layerA);

    fs.writeFileSync(
      path.join(outDir, `${fx.id}-layer-a-raw.json`),
      JSON.stringify(redactSecretsDeep(layerA), null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(outDir, `${fx.id}-layer-b-master.json`),
      JSON.stringify(redactSecretsDeep(layerB), null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(outDir, `${fx.id}-layer-c-shell.json`),
      JSON.stringify(redactSecretsDeep(layerC), null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(outDir, `${fx.id}-verification.json`),
      JSON.stringify(redactSecretsDeep(verification), null, 2),
      'utf8'
    );

    liveSummaries.push({
      id: fx.id,
      quotaAndPerformance: layerA.quotaAndPerformanceSummary,
      timezoneEquivalence: layerA.timezoneEquivalenceCheck,
      ephemerisTimestampCheck: layerA.ephemerisTimestampCheck,
      shadbalaAuthoritativeDesignation: layerB.shadbalaReconciliation.data?.authoritativeDesignation,
      verificationPassed: verification.passedCount,
      verificationFailed: verification.failedCount,
    });
  }

  console.log('\n--- LIVE VERIFICATION SUMMARY ---');
  console.log(JSON.stringify(liveSummaries, null, 2));
  console.log(`Sanitized live artifacts written to: ${outDir}`);

  if (evalAstroWay) {
    const astroKey = getAstroWayApiKey();
    if (!astroKey) {
      console.log(
        '\n[ASTROWAY LIVE EVAL BLOCKED] ASTROWAY_API_KEY is unset (Free tier: 10,000 credits/mo, no card required).'
      );
    } else {
      console.log('\n>>> Running LIVE Isolated AstroWay Chris 4 Evaluation...');
      const chris4Instant = resolveCanonicalBirthInstant(FIXTURES[0].input);
      const astroResult = await executeAstroWayEvaluationBundle(chris4Instant, { apiKey: astroKey });
      fs.writeFileSync(
        path.join(outDir, 'astroway-chris4-eval.json'),
        JSON.stringify(redactSecretsDeep(astroResult), null, 2),
        'utf8'
      );
      console.log(
        `AstroWay Evaluation finished: status=${astroResult.status}, ok=${astroResult.successfulCallsCount}/${astroResult.plannedRequestsCount}`
      );
    }
  }
}

main().catch((err) => {
  console.error('V2 Verification Error:', err);
  process.exit(1);
});
