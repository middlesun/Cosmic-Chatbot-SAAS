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
  acquireV2NatalBundle,
  assessChartJsonDefects,
  auditVargasMethodology,
  BirthInstantTimezoneError,
  buildAndValidateV2Requests,
  buildAstroWayChris4EvaluationPlan,
  buildLayerBMasterChartRecord,
  buildLayerCAnalyticalShell,
  buildLegacyVsV2ComparisonReport,
  buildAstroWayProbeSpecs,
  buildShadbalaReconciliationReport,
  compareAstroWayModeAVsModeBResponses,
  compareModeAVsModeBResponses,
  computeIndependentAstronomicalReference,
  evaluateAstroWayJulianDayCheck,
  executeAstroWayBatchedBundle,
  executeAstroWayEvaluationBundle,
  getAstroWayApiKey,
  getAstroWayApiSecretStatus,
  getFreeAstroApiKey,
  getFreeAstroApiSecretStatus,
  normalizePositiveHeapBytes,
  orderAstroWaySpecsForPriorityVerification,
  parseAstroWayRateLimitHeaders,
  READ_ONLY_SUPABASE_DIAGNOSTIC_SQL,
  redactSecretsDeep,
  resetAstroWayIsolateRateStateForTests,
  resolveCanonicalBirthInstant,
  summarizeObservedQuotaHeaders,
  summarizeRuntimeHeapTelemetry,
  verify12CuspSequence,
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
        aspects: [],
      }),
      vedic_kundli: makeAwCall('vedic_kundli', '/vedic/kundli', 'natal_core', {
        ayanamsa: 'lahiri',
        lagna: { longitude: sampleRef.lahiriAscendantDeg, signName: SIGNS[Math.floor(sampleRef.lahiriAscendantDeg / 30) % 12] },
        grahas: [
          { name: 'Sun', longitude: sampleRef.lahiriSunLonDeg },
          { name: 'Moon', longitude: sampleRef.lahiriMoonLonDeg },
          { name: 'Mars', longitude: 185 },
          { name: 'Mercury', longitude: 230 },
          { name: 'Jupiter', longitude: 295 },
          { name: 'Venus', longitude: 245 },
          { name: 'Saturn', longitude: 221 },
          { name: 'Rahu', longitude: 11.5, isRetrograde: true },
          { name: 'Ketu', longitude: 191.5, isRetrograde: true },
        ],
      }),
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
      bhavabala: makeAwCall('bhavabala', '/vedic/bhavabala', 'bhavabala', { houses: [] }, { declaredQuality: 'yellow' }),
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
      plannedRequestsCount: 12,
      totalCalls: 12,
      actualHttpRequestsSent: 12,
      retryCount: 0,
      successfulCalls: 11,
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
        creditsUsedTotal: 11,
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

  assert(
    awMaster.providerId === 'astroway' &&
      awMaster.frames.vedicLahiri.data?.planets.some((p) => p.name === 'Rahu') &&
      awMaster.frames.kpPlacidus.data?.cusps.length === 12 &&
      awMaster.frames.westernTropical.data?.houses.length === 12 &&
      awMaster.frames.astronomicalTelemetry.data?.bodies.Sun !== undefined &&
      awMaster.shadbalaReconciliation.data?.authoritativeDesignation === 'unassigned_pending_reconciliation' &&
      awVerif.mode === 'live_and_offline' &&
      awVerif.epistemicClassification.independentlyValidatedAgainstExternalReference.length === 0 &&
      awVerif.epistemicClassification.methodologyUnresolved.some((i) => i.key === 'astroway_yellow_bhavabala') &&
      awVerif.epistemicClassification.datasetUnavailable.some((i) => i.key === 'astroway_failed_jaimini_yogas') &&
      awCmp.primaryCoordinatesComparison.ascendant.v2ProviderDeg !== null &&
      awKalaProbe.shadbalaComparison?.perPlanet[0]?.subcomponentDeltas?.abdaMasaVaraHora === -15,
    'AstroWay normalization, epistemic audit, and Kala Mode A/B probe test failed.'
  );
  regressionResults.push({
    id: 'astroway_normalization_epistemic_and_kala_probe',
    status: 'PASSED',
    verificationMode: awVerif.mode,
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
