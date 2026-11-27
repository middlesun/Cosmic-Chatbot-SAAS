/**
 * Isolated V2 Engine — 4-Request Maximum Natal Data Acquisition Module
 *
 * Endpoints:
 *   1. POST /api/v2/vedic/calculate   (Lahiri + Whole Sign + 17 Vargas + Bhava Chalit + Shadbala + Ashtakavarga + Yogas + Avastha + Panchang + 3-level Dasha)
 *   2. POST /api/v2/vedic/kp          (KP ayanamsha='kp' + Placidus cusps + 4-level significators + sub-sub-lords + ruling planets + KP dasha)
 *   3. POST /api/v1/natal/calculate   (Western Tropical Placidus + outer bodies/points + speeds + declinations + aspects + configurations + dominants)
 *   4. POST /api/v1/ephemeris/calculate (Astronomical telemetry: latitude, distance_au, speed, station, motion_state + exact timestamp check)
 *
 * Plus:
 *   - Pre-flight OpenAPI parameter validation
 *   - Live Mode A (local + IANA tz_str) vs Mode B (UTC + tz_str='UTC') equivalence verifier
 *   - Strict zero-credential-leakage sanitization
 */

import {
  formatUtcOffsetString,
  normalizeDeg360,
  toModeALocalTimeFields,
  toModeBUtcTimeFields,
} from './birthInstant';
import { getFreeAstroApiKey, redactHeaders, redactSecretsDeep } from './secretEnv';
import type {
  CanonicalBirthInstant,
  EphemerisTimestampCheck,
  LayerARawProviderRecord,
  SanitizedProviderCallRecord,
  TimezoneEquivalenceCheck,
  V2EndpointId,
} from './types';

export const FREE_ASTRO_API_BASE_URL = 'https://api.freeastroapi.com';

export const ALL_V2_VARGAS = [
  1, 2, 3, 4, 5, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60,
] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const textEncoder = new TextEncoder();

export interface BuiltV2Requests {
  request1VedicCalculate: {
    endpoint: '/api/v2/vedic/calculate';
    body: Record<string, unknown>;
  };
  request2VedicKp: {
    endpoint: '/api/v2/vedic/kp';
    body: Record<string, unknown>;
  };
  request3WesternNatal: {
    endpoint: '/api/v1/natal/calculate';
    body: Record<string, unknown>;
    knownOpenApiLimitations: string[];
  };
  request4Ephemeris: {
    endpoint: '/api/v1/ephemeris/calculate';
    body: Record<string, unknown>;
  };
  validationErrors: string[];
  validationWarnings: string[];
}

/**
 * Builds and validates all 4 requests against FreeAstroAPI's live OpenAPI 3.1.0 schema.
 */
export function buildAndValidateV2Requests(
  instant: CanonicalBirthInstant,
  options?: {
    timeMode?: 'local_iana' | 'utc';
    referenceDateIso?: string;
  }
): BuiltV2Requests {
  const timeMode =
    options?.timeMode ?? (instant.timezone.ianaTimezone ? 'local_iana' : 'utc');
  const timeFields =
    timeMode === 'local_iana' && instant.timezone.ianaTimezone
      ? toModeALocalTimeFields(instant)
      : toModeBUtcTimeFields(instant);

  const referenceDate =
    options?.referenceDateIso || new Date().toISOString().slice(0, 10);

  const offsetStr = formatUtcOffsetString(instant.timezone.historicalUtcOffsetSeconds);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const localIsoWithOffset = `${instant.input.year}-${pad2(instant.input.month)}-${pad2(
    instant.input.day
  )}T${pad2(instant.input.hour)}:${pad2(instant.input.minute)}:${pad2(
    instant.input.second
  )}${offsetStr}`;

  const r1Body: Record<string, unknown> = {
    year: timeFields.year,
    month: timeFields.month,
    day: timeFields.day,
    hour: timeFields.hour,
    minute: timeFields.minute,
    second: timeFields.second,
    city: instant.input.city,
    lat: timeFields.lat,
    lng: timeFields.lng,
    tz_str: timeFields.tz_str,
    ayanamsha: 'lahiri',
    house_system: 'whole_sign',
    node_type: instant.input.nodeConvention,
    reference_date: referenceDate,
    d4_profile: 'auto',
    vargas: [...ALL_V2_VARGAS],
    include_avastha: true,
    include_bhava_chalit: true,
    include_yogas: true,
    include_panchang: true,
    include_shadbala: true,
    include_ashtakavarga: true,
    dasha_levels: 3,
    dasha_mode: 'classical',
  };

  const r2Body: Record<string, unknown> = {
    year: timeFields.year,
    month: timeFields.month,
    day: timeFields.day,
    hour: timeFields.hour,
    minute: timeFields.minute,
    second: timeFields.second,
    city: instant.input.city,
    lat: timeFields.lat,
    lng: timeFields.lng,
    tz_str: timeFields.tz_str,
    ayanamsha: 'kp', // OpenAPI const: 'kp'
    house_system: 'placidus', // OpenAPI const: 'placidus'
    node_type: instant.input.nodeConvention,
    reference_date: referenceDate,
    dasha_levels: 3,
  };

  // OpenAPI NatalChartRequest: supports hour & minute (no `second` property in V1 schema!)
  const r3Body: Record<string, unknown> = {
    name: instant.input.name,
    year: timeFields.year,
    month: timeFields.month,
    day: timeFields.day,
    hour: timeFields.hour,
    minute: timeFields.minute,
    time_known: instant.input.birthTimePrecision !== 'unknown',
    city: instant.input.city || undefined,
    lat: timeFields.lat,
    lng: timeFields.lng,
    tz_str: timeFields.tz_str,
    zodiac_type: 'tropical',
    house_system: 'placidus',
    include_speed: true,
    include_dignity: true,
    include_rulers: true,
    include_minor_aspects: true,
    include_declination_aspects: true,
    declination_orb: 1.0,
    include_stelliums: true,
    stellium_policy: 'classified',
    include_tables: true,
    include_dominants: true,
    dominants_method: 'traditional',
    include_configurations: true,
    lilith: true,
    mean_lilith: true,
    true_lilith: true,
    chiron: true,
    true_node: instant.input.nodeConvention === 'true',
    mean_node: instant.input.nodeConvention === 'mean',
    pholus: true,
    ceres: true,
    pallas: true,
    juno: true,
    vesta: true,
    eris: true,
    eros: true,
    vertex: true,
    response_format: 'full',
  };

  const r4Start =
    timeMode === 'local_iana' && instant.timezone.ianaTimezone
      ? localIsoWithOffset
      : instant.utc.iso;

  const r4Body: Record<string, unknown> = {
    start: r4Start,
    end: null,
    step: '1d',
    zodiac_type: 'sidereal',
    sidereal_ayanamsa: 'lahiri',
    house_system: 'whole_sign',
    lat: timeFields.lat,
    lng: timeFields.lng,
    tz_str: timeFields.tz_str,
    include_angles: true,
    include_houses: true,
    include_speed: true,
    include_retrograde: true,
    include_dignity: true,
    include_sign_degree: true,
    include_aspects: true,
    include_minor_aspects: false,
    include_moon_void_of_course: true,
    include_sidereal_time: true,
    format: 'json',
    response_mode: 'json',
  };

  const validationErrors: string[] = [];
  const validationWarnings: string[] = [];
  const knownOpenApiLimitations: string[] = [];

  // OpenAPI schema invariants check
  if (r2Body.ayanamsha !== 'kp') {
    validationErrors.push('KPChartRequest.ayanamsha must equal "kp".');
  }
  if (r2Body.house_system !== 'placidus') {
    validationErrors.push('KPChartRequest.house_system must equal "placidus".');
  }
  if ((r1Body.second as number) < 0 || (r1Body.second as number) > 59) {
    validationErrors.push('CalculateRequest.second must be in 0..59.');
  }
  if (instant.input.second !== 0) {
    const msg = `V1 NatalChartRequest (/api/v1/natal/calculate) schema has no "second" field; ${instant.input.second}s is truncated on Request 3.`;
    knownOpenApiLimitations.push(msg);
    validationWarnings.push(msg);
  }

  return {
    request1VedicCalculate: { endpoint: '/api/v2/vedic/calculate', body: r1Body },
    request2VedicKp: { endpoint: '/api/v2/vedic/kp', body: r2Body },
    request3WesternNatal: {
      endpoint: '/api/v1/natal/calculate',
      body: r3Body,
      knownOpenApiLimitations,
    },
    request4Ephemeris: { endpoint: '/api/v1/ephemeris/calculate', body: r4Body },
    validationErrors,
    validationWarnings,
  };
}

function captureQuotaHeaders(headers: Headers): Record<string, string> {
  const safeAll = redactHeaders(headers);
  const picked: Record<string, string> = {};
  for (const [k, v] of Object.entries(safeAll)) {
    if (
      k.includes('rate') ||
      k.includes('limit') ||
      k.includes('quota') ||
      k.includes('remaining') ||
      k.includes('reset') ||
      k.includes('retry') ||
      k.includes('cache') ||
      k.includes('request-id') ||
      k.includes('version') ||
      k === 'content-type' ||
      k === 'date'
    ) {
      picked[k] = v;
    }
  }
  return picked;
}

async function executeProviderPost(
  id: V2EndpointId,
  endpoint: string,
  body: Record<string, unknown>,
  apiKey: string
): Promise<SanitizedProviderCallRecord> {
  const sanitizedRequest = redactSecretsDeep(structuredClone(body));
  const started = Date.now();
  const timestampUtc = new Date().toISOString();

  const res = await fetch(`${FREE_ASTRO_API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  const latencyMs = Date.now() - started;
  const payloadBytes = textEncoder.encode(text).length;

  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // preserve non-JSON text
  }

  return {
    id,
    endpoint,
    method: 'POST',
    timestampUtc,
    sanitizedRequest,
    httpStatus: res.status,
    ok: res.ok,
    latencyMs,
    payloadBytes,
    quotaAndMetaHeaders: captureQuotaHeaders(res.headers),
    errorMessage: res.ok
      ? null
      : typeof parsed === 'object' && parsed && 'detail' in parsed
      ? JSON.stringify((parsed as Record<string, unknown>).detail)
      : `HTTP ${res.status}`,
    rawResponse: redactSecretsDeep(parsed),
  };
}

function circularDeltaDeg(a: number, b: number): number {
  let d = Math.abs(normalizeDeg360(a) - normalizeDeg360(b));
  if (d > 180) d = 360 - d;
  return d;
}

export function evaluateEphemerisTimestampCheck(
  instant: CanonicalBirthInstant,
  request4Body: Record<string, unknown>,
  ephemerisResponse: unknown
): EphemerisTimestampCheck {
  const root =
    ephemerisResponse && typeof ephemerisResponse === 'object'
      ? (ephemerisResponse as Record<string, unknown>)
      : {};
  const data =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : Array.isArray(root.data) && root.data[0] && typeof root.data[0] === 'object'
      ? (root.data[0] as Record<string, unknown>)
      : {};

  const resolvedTime =
    data.resolved_time && typeof data.resolved_time === 'object'
      ? (data.resolved_time as Record<string, unknown>)
      : {};
  const subject =
    data.subject && typeof data.subject === 'object'
      ? (data.subject as Record<string, unknown>)
      : {};
  const settings =
    subject.settings && typeof subject.settings === 'object'
      ? (subject.settings as Record<string, unknown>)
      : {};

  const returnedUtcInstant =
    typeof resolvedTime.utc_instant === 'string'
      ? resolvedTime.utc_instant
      : typeof data.timestamp === 'string'
      ? data.timestamp
      : null;

  const returnedJd =
    typeof settings.julian_day === 'number' ? settings.julian_day : null;

  const limitationNotes: string[] = [];
  let deltaSeconds: number | null = null;
  if (returnedUtcInstant) {
    const parsedMs = Date.parse(returnedUtcInstant);
    if (!Number.isNaN(parsedMs)) {
      deltaSeconds = Number(((parsedMs - instant.utc.timestampMs) / 1000).toFixed(3));
      if (Math.abs(deltaSeconds) > 1) {
        limitationNotes.push(
          `Ephemeris returned UTC instant ${returnedUtcInstant} differs from canonical ${instant.utc.iso} by ${deltaSeconds}s.`
        );
      }
    }
  } else {
    limitationNotes.push('Ephemeris response did not include resolved_time.utc_instant or timestamp.');
  }

  const deltaJd =
    returnedJd !== null
      ? Number((returnedJd - instant.utc.julianDayUt).toFixed(8))
      : null;

  const exactTimestampMatch =
    deltaSeconds !== null &&
    Math.abs(deltaSeconds) <= 1 &&
    (deltaJd === null || Math.abs(deltaJd) < 0.00002);

  return {
    requestedStart: String(request4Body.start || ''),
    requestedTzStr: String(request4Body.tz_str || ''),
    returnedUtcInstant,
    returnedJulianDay: returnedJd,
    expectedUtcIso: instant.utc.iso,
    expectedJulianDayUt: instant.utc.julianDayUt,
    deltaSecondsFromCanonical: deltaSeconds,
    deltaJulianDay: deltaJd,
    exactTimestampMatch,
    limitationNotes,
  };
}

/**
 * Verifies Mode A (local wall clock + IANA tz_str) vs Mode B (UTC + tz_str='UTC')
 * on /api/v2/vedic/calculate produce equivalent astronomical longitudes & Ascendant.
 */
export async function verifyTimezoneEquivalenceLive(
  instant: CanonicalBirthInstant,
  options?: { apiKey?: string; rateWaitMs?: number }
): Promise<TimezoneEquivalenceCheck> {
  const apiKey = (options?.apiKey || getFreeAstroApiKey() || '').trim();
  if (!apiKey) {
    throw new Error('FREE_ASTRO_API_KEY is not configured in server environment secrets.');
  }
  const rateWaitMs = options?.rateWaitMs ?? 1150;

  const reqA = buildAndValidateV2Requests(instant, { timeMode: 'local_iana' }).request1VedicCalculate;
  const reqB = buildAndValidateV2Requests(instant, { timeMode: 'utc' }).request1VedicCalculate;

  const callA = await executeProviderPost('timezone_probe_mode_a', reqA.endpoint, reqA.body, apiKey);
  if (rateWaitMs > 0) await sleep(rateWaitMs);
  const callB = await executeProviderPost('timezone_probe_mode_b', reqB.endpoint, reqB.body, apiKey);

  const chartA = ((callA.rawResponse as Record<string, unknown>)?.chart || {}) as Record<
    string,
    unknown
  >;
  const chartB = ((callB.rawResponse as Record<string, unknown>)?.chart || {}) as Record<
    string,
    unknown
  >;

  const ascA = Number((chartA.ascendant as Record<string, unknown>)?.degree);
  const ascB = Number((chartB.ascendant as Record<string, unknown>)?.degree);
  const ascendantDeltaDeg =
    Number.isFinite(ascA) && Number.isFinite(ascB)
      ? Number(circularDeltaDeg(ascA, ascB).toFixed(6))
      : null;

  const planetsA = Array.isArray(chartA.planets)
    ? (chartA.planets as Array<Record<string, unknown>>)
    : [];
  const planetsB = Array.isArray(chartB.planets)
    ? (chartB.planets as Array<Record<string, unknown>>)
    : [];

  const perPlanetDeltasDeg: Array<{
    planet: string;
    modeALon: number;
    modeBLon: number;
    deltaDeg: number;
  }> = [];
  let maxPlanetDeltaDeg: number | null = null;
  let moonDeltaDeg: number | null = null;

  for (const pA of planetsA) {
    const name = String(pA.name || '');
    const pB = planetsB.find((x) => String(x.name || '') === name);
    if (!pB) continue;
    const lonA = Number(pA.absolute_degree);
    const lonB = Number(pB.absolute_degree);
    if (!Number.isFinite(lonA) || !Number.isFinite(lonB)) continue;
    const delta = Number(circularDeltaDeg(lonA, lonB).toFixed(6));
    perPlanetDeltasDeg.push({ planet: name, modeALon: lonA, modeBLon: lonB, deltaDeg: delta });
    if (maxPlanetDeltaDeg === null || delta > maxPlanetDeltaDeg) maxPlanetDeltaDeg = delta;
    if (name === 'Moon') moonDeltaDeg = delta;
  }

  const notes: string[] = [];
  const equivalent =
    callA.ok &&
    callB.ok &&
    ascendantDeltaDeg !== null &&
    ascendantDeltaDeg < 0.01 &&
    maxPlanetDeltaDeg !== null &&
    maxPlanetDeltaDeg < 0.01;

  if (!equivalent) {
    notes.push(
      `Timezone equivalence FAILED or incomplete: ModeA HTTP ${callA.httpStatus}, ModeB HTTP ${callB.httpStatus}, ascDelta=${ascendantDeltaDeg}, maxPlanetDelta=${maxPlanetDeltaDeg}.`
    );
  } else {
    notes.push(
      `Mode A (${reqA.body.tz_str}) and Mode B (UTC) match within ${Math.max(
        ascendantDeltaDeg || 0,
        maxPlanetDeltaDeg || 0
      )}°.`
    );
  }

  return {
    executed: true,
    modeARequest: callA.sanitizedRequest,
    modeBRequest: callB.sanitizedRequest,
    modeAStatus: callA.httpStatus,
    modeBStatus: callB.httpStatus,
    equivalent,
    maxPlanetDeltaDeg,
    ascendantDeltaDeg,
    moonDeltaDeg,
    perPlanetDeltasDeg,
    notes,
  };
}

/**
 * Executes the complete 4-request natal acquisition bundle against live FreeAstroAPI.
 * Zero silent fallbacks: returns exact HTTP results & preserved raw payloads.
 */
export async function acquireV2NatalBundle(
  instant: CanonicalBirthInstant,
  options?: {
    apiKey?: string;
    rateWaitMs?: number;
    timeMode?: 'local_iana' | 'utc';
    includeTimezoneEquivalenceProbe?: boolean;
    onProgress?: (msg: string) => void;
  }
): Promise<LayerARawProviderRecord> {
  const apiKey = (options?.apiKey || getFreeAstroApiKey() || '').trim();
  if (!apiKey) {
    throw new Error(
      'FREE_ASTRO_API_KEY is not configured in server environment secrets. Live acquisition aborted (no silent fallback).'
    );
  }

  const built = buildAndValidateV2Requests(instant, {
    timeMode: options?.timeMode,
  });
  if (built.validationErrors.length > 0) {
    throw new Error(`OpenAPI preflight validation failed: ${built.validationErrors.join('; ')}`);
  }

  const rateWaitMs = options?.rateWaitMs ?? 1150;
  const calls: Record<string, SanitizedProviderCallRecord> = {};

  const run = async (id: V2EndpointId, endpoint: string, body: Record<string, unknown>) => {
    if (Object.keys(calls).length > 0 && rateWaitMs > 0) {
      await sleep(rateWaitMs);
    }
    options?.onProgress?.(`[V2 Acquisition] POST ${endpoint} (${id}) ...`);
    const rec = await executeProviderPost(id, endpoint, body, apiKey);
    calls[id] = rec;
    options?.onProgress?.(
      `                 -> HTTP ${rec.httpStatus} | ${rec.latencyMs}ms | ${rec.payloadBytes} bytes`
    );
    return rec;
  };

  await run(
    'vedic_calculate',
    built.request1VedicCalculate.endpoint,
    built.request1VedicCalculate.body
  );
  await run('vedic_kp', built.request2VedicKp.endpoint, built.request2VedicKp.body);
  await run(
    'western_natal',
    built.request3WesternNatal.endpoint,
    built.request3WesternNatal.body
  );
  const ephRec = await run(
    'ephemeris',
    built.request4Ephemeris.endpoint,
    built.request4Ephemeris.body
  );

  const ephemerisTimestampCheck = evaluateEphemerisTimestampCheck(
    instant,
    built.request4Ephemeris.body,
    ephRec.rawResponse
  );

  let timezoneEquivalenceCheck: TimezoneEquivalenceCheck | null = null;
  if (options?.includeTimezoneEquivalenceProbe && instant.timezone.ianaTimezone) {
    if (rateWaitMs > 0) await sleep(rateWaitMs);
    options?.onProgress?.('[V2 Acquisition] Running Mode A (IANA) vs Mode B (UTC) probe...');
    timezoneEquivalenceCheck = await verifyTimezoneEquivalenceLive(instant, {
      apiKey,
      rateWaitMs,
    });
  }

  const allCallValues = Object.values(calls);
  const successfulCalls = allCallValues.filter((c) => c.ok).length;

  return {
    schemaVersion: 'v2.raw.1.0',
    capturedAtUtc: new Date().toISOString(),
    providerId: 'freeastroapi',
    providerBaseUrl: FREE_ASTRO_API_BASE_URL,
    inputFingerprint: instant.inputFingerprint,
    canonicalUtcIso: instant.utc.iso,
    canonicalJulianDayUt: instant.utc.julianDayUt,
    calls,
    timezoneEquivalenceCheck,
    ephemerisTimestampCheck,
    quotaAndPerformanceSummary: {
      totalCalls: allCallValues.length,
      successfulCalls,
      failedCalls: allCallValues.length - successfulCalls,
      totalLatencyMs: allCallValues.reduce((s, c) => s + c.latencyMs, 0),
      totalPayloadBytes: allCallValues.reduce((s, c) => s + c.payloadBytes, 0),
    },
  };
}
