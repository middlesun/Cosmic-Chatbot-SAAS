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
  BirthInstantTimezoneError,
  buildAndValidateV2Requests,
  buildLayerBMasterChartRecord,
  buildLayerCAnalyticalShell,
  buildLegacyVsV2ComparisonReport,
  computeIndependentAstronomicalReference,
  getFreeAstroApiKey,
  getFreeAstroApiSecretStatus,
  READ_ONLY_SUPABASE_DIAGNOSTIC_SQL,
  redactSecretsDeep,
  resolveCanonicalBirthInstant,
  verify12CuspSequence,
  verifyMasterChartRecord,
  type CanonicalBirthInput,
  type LayerARawProviderRecord,
} from '../server/services/v2Engine';
import { getNakshatraAndSubs } from '../server/services/jyotishMath';

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
  const envLoad = loadLocalEnvFilesForCli();
  const secretStatus = getFreeAstroApiSecretStatus();

  console.log('====================================================================');
  console.log('CosmicCouncil — Foundational Calculation Engine V2 Verification CLI');
  console.log('====================================================================');
  console.log('Secret Status:', JSON.stringify({ ...secretStatus, loadedEnvFiles: envLoad.loadedFiles }));

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
      partialVerification.epistemicClassification.methodologyUnresolved.length >= 1 &&
      partialVerification.epistemicClassification.datasetUnavailable.length >= 1,
    'Partial acquisition & 5-bucket epistemic classification check failed.'
  );
  regressionResults.push({
    id: 'partial_acquisition_and_epistemic_classification',
    status: 'PASSED',
    verificationMode: partialVerification.mode,
    shadbalaDesignation: partialMaster.shadbalaReconciliation.data?.authoritativeDesignation,
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
}

main().catch((err) => {
  console.error('V2 Verification Error:', err);
  process.exit(1);
});
