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
  coordinateFreeAstroApiSlot,
  reportFreeAstroApi429Backoff,
  type RateLimitCoordinationMode,
} from '../astrologyProviders/freeAstroApiRateLimiter';
import {
  formatUtcOffsetString,
  normalizeDeg360,
  toModeALocalTimeFields,
  toModeBUtcTimeFields,
} from './birthInstant';
import {
  getFreeAstroApiKey,
  redactHeaders,
  redactSecretsDeep,
  redactSecretsInText,
} from './secretEnv';
import type {
  CanonicalBirthInstant,
  EphemerisTimestampCheck,
  LayerARawProviderRecord,
  ObservedQuotaHeadersSummary,
  SanitizedProviderCallRecord,
  ShadbalaModeDeltaRow,
  TimezoneEquivalenceCheck,
  V2EndpointId,
} from './types';

export const FREE_ASTRO_API_BASE_URL = 'https://api.freeastroapi.com';

export const ALL_V2_VARGAS = [
  1, 2, 3, 4, 5, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60,
] as const;

const textEncoder = new TextEncoder();
const DEFAULT_FETCH_TIMEOUT_MS = 12_000;

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
      k.includes('credit') ||
      k.includes('usage') ||
      k.includes('allowance') ||
      k.includes('burst') ||
      k.includes('window') ||
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
  apiKey: string,
  options?: { rateWaitMs?: number; maxRetries?: number }
): Promise<SanitizedProviderCallRecord> {
  const sanitizedRequest = redactSecretsDeep(structuredClone(body), [apiKey]);
  const minIntervalMs = options?.rateWaitMs ?? 1150;
  const maxRetries = options?.maxRetries ?? 1;

  let attempts = 0;
  let totalRateWaitMs = 0;
  let lastCoordMode: RateLimitCoordinationMode = 'isolate_memory_only';
  let lastRecord: SanitizedProviderCallRecord | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts++;
    const timestampUtc = new Date().toISOString();
    const started = Date.now();

    try {
      const { result: res, slot } = await coordinateFreeAstroApiSlot(
        () => {
          const signal =
            typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
              ? AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS)
              : undefined;
          return fetch(`${FREE_ASTRO_API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
            },
            body: JSON.stringify(body),
            ...(signal ? { signal } : {}),
          });
        },
        {
          minIntervalMs,
          callerTag: `v2:${id}`,
        }
      );

      totalRateWaitMs += slot.waitedMs;
      lastCoordMode = slot.coordinationMode;

      const text = await res.text();
      const latencyMs = Math.max(0, Date.now() - slot.dispatchedAtMs);
      const payloadBytes = textEncoder.encode(text).length;

      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        // preserve non-JSON text
      }

      const headers = captureQuotaHeaders(res.headers);
      const redactedParsed = redactSecretsDeep(parsed, [apiKey]);
      lastRecord = {
        id,
        endpoint,
        method: 'POST',
        timestampUtc,
        sanitizedRequest,
        httpStatus: res.status,
        ok: res.ok,
        attempts,
        rateWaitMs: totalRateWaitMs,
        coordinationMode: lastCoordMode,
        latencyMs,
        payloadBytes,
        quotaAndMetaHeaders: headers,
        errorMessage: res.ok
          ? null
          : typeof redactedParsed === 'object' && redactedParsed && 'detail' in redactedParsed
          ? redactSecretsInText(
              JSON.stringify((redactedParsed as Record<string, unknown>).detail),
              [apiKey]
            )
          : `HTTP ${res.status}`,
        rawResponse: redactedParsed,
      };

      if (res.status === 429 && attempt < maxRetries) {
        const retryAfterSec = Number(res.headers.get('retry-after') || '0');
        const backoff = retryAfterSec > 0 ? retryAfterSec * 1000 : 1800 * (attempt + 1);
        await reportFreeAstroApi429Backoff(backoff);
        continue;
      }

      return lastRecord;
    } catch (err) {
      const latencyMs = Math.max(0, Date.now() - started);
      const rawMsg = err instanceof Error ? err.message : 'Network error calling FreeAstroAPI';
      const msg = redactSecretsInText(rawMsg, [apiKey]);
      lastRecord = {
        id,
        endpoint,
        method: 'POST',
        timestampUtc,
        sanitizedRequest,
        httpStatus: 0,
        ok: false,
        attempts,
        rateWaitMs: totalRateWaitMs,
        coordinationMode: lastCoordMode,
        latencyMs,
        payloadBytes: 0,
        quotaAndMetaHeaders: {},
        errorMessage: msg,
        rawResponse: null,
      };
      return lastRecord;
    }
  }

  return lastRecord!;
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

function asRec(val: unknown): Record<string, unknown> {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {};
}

function asRecArr(val: unknown): Array<Record<string, unknown>> {
  return Array.isArray(val)
    ? (val.filter((x) => x && typeof x === 'object') as Array<Record<string, unknown>>)
    : [];
}

function round4(n: number): number {
  return Number(n.toFixed(4));
}

function parseClockOrIsoInstantSeconds(
  rawVal: unknown,
  instant: CanonicalBirthInstant,
  isLocalClockMode: boolean
): { utcSecondsOfDay: number | null; epochMs: number | null; displayText: string | null } {
  if (typeof rawVal !== 'string' || !rawVal.trim()) {
    return { utcSecondsOfDay: null, epochMs: null, displayText: null };
  }
  const text = rawVal.trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(text) && (text.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(text))) {
    const ms = Date.parse(text);
    if (!Number.isNaN(ms)) {
      const d = new Date(ms);
      return {
        utcSecondsOfDay: d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds(),
        epochMs: ms,
        displayText: text,
      };
    }
  }
  const hmsMatch = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(text);
  if (hmsMatch) {
    const secOfDay =
      Number(hmsMatch[1]) * 3600 +
      Number(hmsMatch[2]) * 60 +
      (hmsMatch[3] ? Number(hmsMatch[3]) : 0);
    const utcSec = isLocalClockMode
      ? (((secOfDay - instant.timezone.historicalUtcOffsetSeconds) % 86400) + 86400) % 86400
      : ((secOfDay % 86400) + 86400) % 86400;
    return { utcSecondsOfDay: utcSec, epochMs: null, displayText: text };
  }
  return { utcSecondsOfDay: null, epochMs: null, displayText: text };
}

function extractPanchangFieldLabel(val: unknown): string {
  if (typeof val === 'string') return val.trim().toLowerCase();
  if (val && typeof val === 'object') {
    const o = val as Record<string, unknown>;
    return String(o.name ?? o.title ?? o.lord ?? o.number ?? JSON.stringify(o))
      .trim()
      .toLowerCase();
  }
  return val === undefined || val === null ? '' : String(val).trim().toLowerCase();
}

export function compareModeAVsModeBResponses(
  callA: SanitizedProviderCallRecord,
  callB: SanitizedProviderCallRecord,
  instant: CanonicalBirthInstant
): TimezoneEquivalenceCheck {
  const rawA = asRec(callA.rawResponse);
  const rawB = asRec(callB.rawResponse);
  const chartA = asRec(rawA.chart);
  const chartB = asRec(rawB.chart);

  // 1. Ascendant & Planetary Longitudes
  const ascA = Number(asRec(chartA.ascendant).degree);
  const ascB = Number(asRec(chartB.ascendant).degree);
  const ascendantDeltaDeg =
    Number.isFinite(ascA) && Number.isFinite(ascB)
      ? Number(circularDeltaDeg(ascA, ascB).toFixed(6))
      : null;

  const planetsA = asRecArr(chartA.planets);
  const planetsB = asRecArr(chartB.planets);
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

  const coordinatesEquivalent =
    callA.ok &&
    callB.ok &&
    ascendantDeltaDeg !== null &&
    ascendantDeltaDeg < 0.01 &&
    maxPlanetDeltaDeg !== null &&
    maxPlanetDeltaDeg < 0.01;

  // 2. Shadbala (all 6 components + total + ratio)
  const sbA = asRec(rawA.shadbala);
  const sbB = asRec(rawB.shadbala);
  const SEVEN = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const shadbalaRows: ShadbalaModeDeltaRow[] = [];
  let maxSbTotalDelta: number | null = null;
  let maxSbCompDelta: number | null = null;

  for (const planet of SEVEN) {
    const rA = asRec(sbA[planet]);
    const rB = asRec(sbB[planet]);
    if (typeof rA.total !== 'number' || typeof rB.total !== 'number') continue;

    const compDeltas = {
      sthana_bala: round4(Number(rA.sthana_bala ?? 0) - Number(rB.sthana_bala ?? 0)),
      dig_bala: round4(Number(rA.dig_bala ?? 0) - Number(rB.dig_bala ?? 0)),
      kala_bala: round4(Number(rA.kala_bala ?? 0) - Number(rB.kala_bala ?? 0)),
      cheshta_bala: round4(Number(rA.cheshta_bala ?? 0) - Number(rB.cheshta_bala ?? 0)),
      naisargika_bala: round4(Number(rA.naisargika_bala ?? 0) - Number(rB.naisargika_bala ?? 0)),
      drik_bala: round4(Number(rA.drik_bala ?? 0) - Number(rB.drik_bala ?? 0)),
    };
    const totalDelta = round4(Number(rA.total) - Number(rB.total));
    const maxThisComp = Math.max(...Object.values(compDeltas).map((v) => Math.abs(v)));
    if (maxSbTotalDelta === null || Math.abs(totalDelta) > maxSbTotalDelta) {
      maxSbTotalDelta = round4(Math.abs(totalDelta));
    }
    if (maxSbCompDelta === null || maxThisComp > maxSbCompDelta) {
      maxSbCompDelta = round4(maxThisComp);
    }

    let suspectedKalaBalaDriver: string | null = null;
    if (Math.abs(compDeltas.kala_bala) > 0.02) {
      const absK = Math.abs(compDeltas.kala_bala);
      if (absK >= 59.5) {
        suspectedKalaBalaDriver =
          'Kala Bala (Hora Bala ±60V swap + Natonnata Bala diurnal/nocturnal shift)';
      } else {
        suspectedKalaBalaDriver =
          'Kala Bala (Natonnata / diurnal-nocturnal time-of-day variance)';
      }
    }

    shadbalaRows.push({
      planet,
      modeATotal: Number(rA.total),
      modeBTotal: Number(rB.total),
      totalDelta,
      modeARatio: typeof rA.ratio === 'number' ? Number(rA.ratio) : null,
      modeBRatio: typeof rB.ratio === 'number' ? Number(rB.ratio) : null,
      componentDeltas: compDeltas,
      suspectedKalaBalaDriver,
    });
  }

  const shadbalaAvailable = shadbalaRows.length > 0;
  const shadbalaEquivalent =
    !shadbalaAvailable ||
    ((maxSbTotalDelta ?? 0) <= 0.02 && (maxSbCompDelta ?? 0) <= 0.02);

  // 3. Bhava Chalit cusps, boundaries & shifted planet houses
  const bcA = rawA.bhava_chalit ? asRec(rawA.bhava_chalit) : asRec(chartA.bhava_chalit);
  const bcB = rawB.bhava_chalit ? asRec(rawB.bhava_chalit) : asRec(chartB.bhava_chalit);
  const bcHousesA = asRecArr(bcA.houses);
  const bcHousesB = asRecArr(bcB.houses);
  let bhavaChalitMaxCuspDeltaDeg: number | null = null;
  const bhavaChalitHouseMismatches: string[] = [];
  let bhavaChalitEquivalent: boolean | null = null;

  if (bcHousesA.length > 0 || bcHousesB.length > 0) {
    for (const hA of bcHousesA) {
      const hNum = Number(hA.house);
      const hB = bcHousesB.find((x) => Number(x.house) === hNum);
      if (!hB) {
        bhavaChalitHouseMismatches.push(`Missing Bhava Chalit house ${hNum} in Mode B`);
        continue;
      }
      for (const field of ['degree_cusp', 'boundary_start', 'boundary_end'] as const) {
        const vA = Number(hA[field]);
        const vB = Number(hB[field]);
        if (Number.isFinite(vA) && Number.isFinite(vB)) {
          const d = round4(circularDeltaDeg(vA, vB));
          if (field === 'degree_cusp' && (bhavaChalitMaxCuspDeltaDeg === null || d > bhavaChalitMaxCuspDeltaDeg)) {
            bhavaChalitMaxCuspDeltaDeg = d;
          }
          if (d > 0.01) {
            bhavaChalitHouseMismatches.push(`H${hNum}.${field}: Δ=${d}° (${vA} vs ${vB})`);
          }
        }
      }
    }
    const bcPlanetsA = asRecArr(bcA.planets);
    const bcPlanetsB = asRecArr(bcB.planets);
    for (const pA of bcPlanetsA) {
      const pName = String(pA.name || '');
      const pB = bcPlanetsB.find((x) => String(x.name || '') === pName);
      if (!pB) continue;
      const chA = Number(pA.chalit_house ?? pA.house);
      const chB = Number(pB.chalit_house ?? pB.house);
      if (Number.isFinite(chA) && Number.isFinite(chB) && chA !== chB) {
        bhavaChalitHouseMismatches.push(`${pName} chalit_house: ${chA} vs ${chB}`);
      }
    }
    bhavaChalitEquivalent = bhavaChalitHouseMismatches.length === 0;
  }

  // 4. Ashtakavarga (SAV + BAV)
  const avA = asRec(rawA.ashtakavarga);
  const avB = asRec(rawB.ashtakavarga);
  let ashtakavargaEquivalent: boolean | null = null;
  const ashtakavargaSavDiffs: number[] = [];
  const ashtakavargaBavMismatches: string[] = [];

  if (Array.isArray(avA.sarvashtakavarga) || Array.isArray(avB.sarvashtakavarga)) {
    const savA = Array.isArray(avA.sarvashtakavarga) ? (avA.sarvashtakavarga as number[]) : [];
    const savB = Array.isArray(avB.sarvashtakavarga) ? (avB.sarvashtakavarga as number[]) : [];
    for (let i = 0; i < Math.max(savA.length, savB.length); i++) {
      ashtakavargaSavDiffs.push(Number(savA[i] ?? 0) - Number(savB[i] ?? 0));
    }
    const bavA = asRec(avA.bhinnashtakavarga);
    const bavB = asRec(avB.bhinnashtakavarga);
    for (const pl of Array.from(new Set([...Object.keys(bavA), ...Object.keys(bavB)]))) {
      const rA = Array.isArray(bavA[pl]) ? (bavA[pl] as number[]) : [];
      const rB = Array.isArray(bavB[pl]) ? (bavB[pl] as number[]) : [];
      if (rA.length !== rB.length || rA.some((v, idx) => Number(v) !== Number(rB[idx]))) {
        ashtakavargaBavMismatches.push(`${pl} BAV mismatch`);
      }
    }
    ashtakavargaEquivalent =
      ashtakavargaSavDiffs.every((d) => d === 0) &&
      Number(avA.total_points ?? 0) === Number(avB.total_points ?? 0) &&
      ashtakavargaBavMismatches.length === 0;
  }

  // 5. Vargas (all returned divisions)
  const vargasA = asRec(asRec(rawA.vargas).vargas);
  const vargasB = asRec(asRec(rawB.vargas).vargas);
  let vargasEquivalent: boolean | null = null;
  const vargasMismatches: string[] = [];

  if (Object.keys(vargasA).length > 0 || Object.keys(vargasB).length > 0) {
    const divKeys = Array.from(new Set([...Object.keys(vargasA), ...Object.keys(vargasB)]));
    for (const div of divKeys) {
      const dA = asRec(vargasA[div]);
      const dB = asRec(vargasB[div]);
      const ascSignA = String(asRec(dA.ascendant).sign || '');
      const ascSignB = String(asRec(dB.ascendant).sign || '');
      if (ascSignA !== ascSignB) {
        vargasMismatches.push(`${div}.ascendant.sign: ${ascSignA} vs ${ascSignB}`);
      }
      const pListA = asRecArr(dA.planets);
      const pListB = asRecArr(dB.planets);
      for (const pA of pListA) {
        const n = String(pA.name || '');
        const pB = pListB.find((x) => String(x.name || '') === n);
        if (!pB) {
          vargasMismatches.push(`${div}.${n}: missing in Mode B`);
          continue;
        }
        if (String(pA.sign || '') !== String(pB.sign || '')) {
          vargasMismatches.push(`${div}.${n}.sign: ${String(pA.sign)} vs ${String(pB.sign)}`);
        }
        const degA = Number(pA.absolute_degree ?? pA.degree);
        const degB = Number(pB.absolute_degree ?? pB.degree);
        if (Number.isFinite(degA) && Number.isFinite(degB) && circularDeltaDeg(degA, degB) > 0.02) {
          vargasMismatches.push(
            `${div}.${n}.degree: Δ=${round4(circularDeltaDeg(degA, degB))}°`
          );
        }
      }
    }
    vargasEquivalent = vargasMismatches.length === 0;
  }

  // 6. Yogas
  const yogasA = asRec(rawA.yogas);
  const yogasB = asRec(rawB.yogas);
  let yogasEquivalent: boolean | null = null;
  const yogasMismatches: string[] = [];

  if (Object.keys(yogasA).length > 0 || Object.keys(yogasB).length > 0) {
    const activeA = asRecArr(yogasA.yogas)
      .filter((y) => y.active === true)
      .map((y) => String(y.name || y.id || ''))
      .sort();
    const activeB = asRecArr(yogasB.yogas)
      .filter((y) => y.active === true)
      .map((y) => String(y.name || y.id || ''))
      .sort();
    if (JSON.stringify(activeA) !== JSON.stringify(activeB)) {
      yogasMismatches.push(`Active yogas differ (${activeA.length} vs ${activeB.length})`);
    }
    const sumA = asRec(yogasA.summary);
    const sumB = asRec(yogasB.summary);
    if (Number(sumA.active_yogas ?? 0) !== Number(sumB.active_yogas ?? 0)) {
      yogasMismatches.push(
        `yogas.summary.active_yogas: ${String(sumA.active_yogas)} vs ${String(sumB.active_yogas)}`
      );
    }
    yogasEquivalent = yogasMismatches.length === 0;
  }

  // 7. Vimshottari Dasha
  const dashaA = asRec(rawA.vimshottari_dasha);
  const dashaB = asRec(rawB.vimshottari_dasha);
  let dashaEquivalent: boolean | null = null;
  const dashaMismatches: string[] = [];

  if (Object.keys(dashaA).length > 0 || Object.keys(dashaB).length > 0) {
    const bbA = asRec(dashaA.birth_balance);
    const bbB = asRec(dashaB.birth_balance);
    if (String(bbA.lord || '') !== String(bbB.lord || '')) {
      dashaMismatches.push(`birth_balance.lord: ${String(bbA.lord)} vs ${String(bbB.lord)}`);
    }
    const remA = Number(bbA.remaining_years ?? 0);
    const remB = Number(bbB.remaining_years ?? 0);
    if (Math.abs(remA - remB) > 0.001) {
      dashaMismatches.push(`birth_balance.remaining_years: ${remA} vs ${remB}`);
    }
    const mdA = asRecArr(dashaA.mahadashas ?? dashaA.periods ?? dashaA.timeline);
    const mdB = asRecArr(dashaB.mahadashas ?? dashaB.periods ?? dashaB.timeline);
    if (mdA.length !== mdB.length) {
      dashaMismatches.push(`mahadasha count: ${mdA.length} vs ${mdB.length}`);
    } else {
      for (let i = 0; i < mdA.length; i++) {
        const lA = String(mdA[i].lord || '');
        const lB = String(mdB[i].lord || '');
        const sA = String(mdA[i].start_date ?? mdA[i].start ?? '').slice(0, 10);
        const sB = String(mdB[i].start_date ?? mdB[i].start ?? '').slice(0, 10);
        const eA = String(mdA[i].end_date ?? mdA[i].end ?? '').slice(0, 10);
        const eB = String(mdB[i].end_date ?? mdB[i].end ?? '').slice(0, 10);
        if (lA !== lB || sA !== sB || eA !== eB) {
          dashaMismatches.push(`MD[${i}]: ${lA}(${sA}..${eA}) vs ${lB}(${sB}..${eB})`);
        }
      }
    }
    dashaEquivalent = dashaMismatches.length === 0;
  }

  // 8. Panchang (separating astro-elements from legitimate clock display formatting)
  const panA = asRec(rawA.panchang);
  const panB = asRec(rawB.panchang);
  let panchangAudit: TimezoneEquivalenceCheck['panchangAudit'] = null;

  if (Object.keys(panA).length > 0 || Object.keys(panB).length > 0) {
    const nonClockMismatches: string[] = [];
    const legitimateDisplayTimeDifferences: string[] = [];

    for (const key of ['tithi', 'nakshatra', 'yoga', 'karana', 'vara', 'weekday']) {
      if (panA[key] === undefined && panB[key] === undefined) continue;
      const vA = extractPanchangFieldLabel(panA[key]);
      const vB = extractPanchangFieldLabel(panB[key]);
      if (vA !== vB) {
        nonClockMismatches.push(`panchang.${key}: "${vA}" vs "${vB}"`);
      }
    }

    const compareSunEvent = (fieldName: 'sunrise' | 'sunset'): number | null => {
      const aInfo = parseClockOrIsoInstantSeconds(panA[fieldName], instant, true);
      const bInfo = parseClockOrIsoInstantSeconds(panB[fieldName], instant, false);
      if (aInfo.displayText && bInfo.displayText && aInfo.displayText !== bInfo.displayText) {
        if (aInfo.epochMs !== null && bInfo.epochMs !== null) {
          const deltaSec = Math.round((aInfo.epochMs - bInfo.epochMs) / 1000);
          if (Math.abs(deltaSec) <= 5) {
            legitimateDisplayTimeDifferences.push(
              `panchang.${fieldName}: local display "${aInfo.displayText}" vs UTC "${bInfo.displayText}" (same instant, Δ=${deltaSec}s)`
            );
          } else {
            nonClockMismatches.push(
              `panchang.${fieldName} instant mismatch: Δ=${deltaSec}s ("${aInfo.displayText}" vs "${bInfo.displayText}")`
            );
          }
          return deltaSec;
        }
        if (aInfo.utcSecondsOfDay !== null && bInfo.utcSecondsOfDay !== null) {
          let deltaSec = aInfo.utcSecondsOfDay - bInfo.utcSecondsOfDay;
          if (deltaSec > 43200) deltaSec -= 86400;
          if (deltaSec < -43200) deltaSec += 86400;
          if (Math.abs(deltaSec) <= 120) {
            legitimateDisplayTimeDifferences.push(
              `panchang.${fieldName}: wall-clock "${aInfo.displayText}" vs UTC "${bInfo.displayText}" (consistent after ${instant.timezone.historicalUtcOffsetHours}h offset, Δ=${deltaSec}s)`
            );
          } else {
            nonClockMismatches.push(
              `panchang.${fieldName} time-of-day mismatch after offset: Δ=${deltaSec}s ("${aInfo.displayText}" vs "${bInfo.displayText}")`
            );
          }
          return deltaSec;
        }
      }
      return null;
    };

    const sunriseInstantDeltaSeconds = compareSunEvent('sunrise');
    const sunsetInstantDeltaSeconds = compareSunEvent('sunset');

    panchangAudit = {
      available: true,
      equivalent: nonClockMismatches.length === 0,
      nonClockMismatches,
      sunriseInstantDeltaSeconds,
      sunsetInstantDeltaSeconds,
      legitimateDisplayTimeDifferences,
    };
  }

  const allSubdatasetsEquivalent =
    shadbalaEquivalent &&
    (bhavaChalitEquivalent !== false) &&
    (ashtakavargaEquivalent !== false) &&
    (vargasEquivalent !== false) &&
    (yogasEquivalent !== false) &&
    (dashaEquivalent !== false) &&
    (panchangAudit ? panchangAudit.equivalent : true);

  const equivalent = coordinatesEquivalent && allSubdatasetsEquivalent;

  const notes: string[] = [];
  if (!coordinatesEquivalent) {
    notes.push(
      `Coordinate equivalence FAILED or incomplete: ModeA HTTP ${callA.httpStatus}, ModeB HTTP ${callB.httpStatus}, ascDelta=${ascendantDeltaDeg}°, maxPlanetDelta=${maxPlanetDeltaDeg}°.`
    );
  } else {
    notes.push(
      `Coordinates invariant across Mode A (${String(callA.sanitizedRequest.tz_str || '')}) and Mode B (UTC) within ${Math.max(
        ascendantDeltaDeg || 0,
        maxPlanetDeltaDeg || 0
      )}°.`
    );
  }

  if (shadbalaAvailable && !shadbalaEquivalent) {
    notes.push(
      `SHADBALA TIMEZONE INVARIANCE FAILURE: maxTotalΔ=${maxSbTotalDelta}V, maxCompΔ=${maxSbCompDelta}V (isolated to Kala Bala while longitudes match).`
    );
  } else if (shadbalaAvailable) {
    notes.push(`Shadbala invariant across all 6 components and totals (maxΔ=${maxSbTotalDelta ?? 0}V).`);
  }

  if (bhavaChalitEquivalent === false) {
    notes.push(`Bhava Chalit divergence: ${bhavaChalitHouseMismatches.join('; ')}`);
  }
  if (ashtakavargaEquivalent === false) {
    notes.push(`Ashtakavarga divergence: ${ashtakavargaBavMismatches.join('; ') || 'SAV array differs'}`);
  }
  if (vargasEquivalent === false) {
    notes.push(`Vargas divergence: ${vargasMismatches.slice(0, 6).join('; ')}`);
  }
  if (yogasEquivalent === false) {
    notes.push(`Yogas divergence: ${yogasMismatches.join('; ')}`);
  }
  if (dashaEquivalent === false) {
    notes.push(`Vimshottari Dasha divergence: ${dashaMismatches.slice(0, 4).join('; ')}`);
  }
  if (panchangAudit && !panchangAudit.equivalent) {
    notes.push(`Panchang divergence: ${panchangAudit.nonClockMismatches.join('; ')}`);
  }

  return {
    executed: true,
    modeARequest: callA.sanitizedRequest,
    modeBRequest: callB.sanitizedRequest,
    modeAStatus: callA.httpStatus,
    modeBStatus: callB.httpStatus,
    equivalent,
    coordinatesEquivalent,
    maxPlanetDeltaDeg,
    ascendantDeltaDeg,
    moonDeltaDeg,
    perPlanetDeltasDeg,
    shadbalaComparison: {
      available: shadbalaAvailable,
      equivalent: shadbalaEquivalent,
      maxTotalDeltaVirupas: maxSbTotalDelta,
      maxComponentDeltaVirupas: maxSbCompDelta,
      perPlanet: shadbalaRows,
    },
    bhavaChalitEquivalent,
    bhavaChalitMaxCuspDeltaDeg,
    bhavaChalitHouseMismatches,
    ashtakavargaEquivalent,
    ashtakavargaSavDiffs,
    ashtakavargaBavMismatches,
    vargasEquivalent,
    vargasMismatches,
    yogasEquivalent,
    yogasMismatches,
    dashaEquivalent,
    dashaMismatches,
    panchangAudit,
    notes,
  };
}

async function runTimezoneEquivalenceProbeInternal(
  instant: CanonicalBirthInstant,
  apiKey: string,
  rateWaitMs: number
): Promise<{
  check: TimezoneEquivalenceCheck;
  callA: SanitizedProviderCallRecord;
  callB: SanitizedProviderCallRecord;
}> {
  const reqA = buildAndValidateV2Requests(instant, { timeMode: 'local_iana' }).request1VedicCalculate;
  const reqB = buildAndValidateV2Requests(instant, { timeMode: 'utc' }).request1VedicCalculate;

  const callA = await executeProviderPost('timezone_probe_mode_a', reqA.endpoint, reqA.body, apiKey, {
    rateWaitMs,
  });
  const callB = await executeProviderPost('timezone_probe_mode_b', reqB.endpoint, reqB.body, apiKey, {
    rateWaitMs,
  });

  const check = compareModeAVsModeBResponses(callA, callB, instant);
  return { check, callA, callB };
}

/**
 * Verifies Mode A (local wall clock + IANA tz_str) vs Mode B (UTC + tz_str='UTC')
 * on /api/v2/vedic/calculate across longitudes AND all birth-instant numerical tables.
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
  const { check } = await runTimezoneEquivalenceProbeInternal(instant, apiKey, rateWaitMs);
  return check;
}

export function summarizeObservedQuotaHeaders(
  calls: SanitizedProviderCallRecord[]
): ObservedQuotaHeadersSummary {
  const observedHeadersByEndpoint: Record<string, Record<string, string>> = {};
  let initialRemainingQuotaObserved: string | null = null;
  let finalRemainingQuotaObserved: string | null = null;
  const finalRemainingByKey: Record<string, string> = {};
  let rateLimitObserved: string | null = null;
  let bodyQuotaMetadataObserved: Record<string, unknown> | null = null;

  for (const call of calls) {
    const quotaEntries: Record<string, string> = {};
    for (const [k, v] of Object.entries(call.quotaAndMetaHeaders || {})) {
      const lk = k.toLowerCase();
      if (
        lk.includes('rate') ||
        lk.includes('limit') ||
        lk.includes('quota') ||
        lk.includes('remaining') ||
        lk.includes('reset') ||
        lk.includes('retry') ||
        lk.includes('credit') ||
        lk.includes('usage') ||
        lk.includes('allowance')
      ) {
        quotaEntries[k] = v;
        const isRemainingKey =
          lk.includes('remaining') || lk.includes('credits-left') || lk.includes('quota-left');
        const isResetOrUsageKey =
          lk.includes('reset') || lk.includes('used') || lk.includes('retry');

        if (isRemainingKey) {
          const formatted = `${k}: ${v}`;
          if (!initialRemainingQuotaObserved) {
            initialRemainingQuotaObserved = formatted;
          }
          finalRemainingQuotaObserved = formatted;
          finalRemainingByKey[k] = v;
        } else if (
          !rateLimitObserved &&
          !isResetOrUsageKey &&
          (lk.includes('limit') || lk.includes('quota') || lk.includes('allowance'))
        ) {
          rateLimitObserved = `${k}: ${v}`;
        }
      }
    }
    if (Object.keys(quotaEntries).length > 0) {
      observedHeadersByEndpoint[call.id] = quotaEntries;
    }

    if (call.rawResponse && typeof call.rawResponse === 'object' && !Array.isArray(call.rawResponse)) {
      const r = call.rawResponse as Record<string, unknown>;
      for (const candidateKey of ['quota', 'usage', 'credits', 'rate_limit']) {
        if (r[candidateKey] !== undefined) {
          bodyQuotaMetadataObserved = bodyQuotaMetadataObserved || {};
          bodyQuotaMetadataObserved[`${call.id}.${candidateKey}`] = r[candidateKey];
        }
      }
      const meta = r.meta && typeof r.meta === 'object' ? (r.meta as Record<string, unknown>) : null;
      if (meta) {
        for (const [mk, mv] of Object.entries(meta)) {
          if (/quota|remaining|credit|limit|usage/i.test(mk)) {
            bodyQuotaMetadataObserved = bodyQuotaMetadataObserved || {};
            bodyQuotaMetadataObserved[`${call.id}.meta.${mk}`] = mv;
          }
        }
      }
    }
  }

  const remainingKeys = Object.keys(finalRemainingByKey);
  const remainingQuotaSummary =
    remainingKeys.length > 1
      ? remainingKeys.map((k) => `${k}: ${finalRemainingByKey[k]}`).join(' | ')
      : finalRemainingQuotaObserved;

  const hasMeasuredHeaders = Object.keys(observedHeadersByEndpoint).length > 0;
  return {
    status: hasMeasuredHeaders ? 'measured_from_headers' : 'not_provided_by_provider',
    observedHeadersByEndpoint,
    remainingQuotaObserved: remainingQuotaSummary,
    ...(initialRemainingQuotaObserved && initialRemainingQuotaObserved !== remainingQuotaSummary
      ? { initialRemainingQuotaObserved }
      : {}),
    rateLimitObserved,
    ...(bodyQuotaMetadataObserved ? { bodyQuotaMetadataObserved } : {}),
    note: hasMeasuredHeaders
      ? remainingQuotaSummary
        ? `Quota/rate-limit headers directly observed across ${calls.length} calls; remainingQuotaObserved reports final post-run header state (${remainingQuotaSummary}).`
        : 'Rate-limit headers observed in provider HTTP responses, without a remaining-quota header.'
      : 'FreeAstroAPI HTTP responses did not include rate-limit or remaining-quota headers; only client-measured request counts and payload sizes are reported.',
  };
}

/**
 * Executes the complete 4-request natal acquisition bundle against live FreeAstroAPI.
 * Zero silent fallbacks: preserves all successful endpoints even when another fails,
 * uses global provider-wide rate-limit coordination, and measures exact HTTP counts.
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
  const runProbe = Boolean(
    options?.includeTimezoneEquivalenceProbe && instant.timezone.ianaTimezone
  );
  const plannedRequestsCount = runProbe ? 6 : 4;

  const run = async (id: V2EndpointId, endpoint: string, body: Record<string, unknown>) => {
    options?.onProgress?.(`[V2 Acquisition] POST ${endpoint} (${id}) ...`);
    const rec = await executeProviderPost(id, endpoint, body, apiKey, { rateWaitMs });
    calls[id] = rec;
    options?.onProgress?.(
      `                 -> HTTP ${rec.httpStatus} | ${rec.latencyMs}ms | ${rec.payloadBytes} bytes | coord=${rec.coordinationMode}`
    );
    return rec;
  };

  const r1 = await run(
    'vedic_calculate',
    built.request1VedicCalculate.endpoint,
    built.request1VedicCalculate.body
  );
  const r2 = await run('vedic_kp', built.request2VedicKp.endpoint, built.request2VedicKp.body);
  const r3 = await run(
    'western_natal',
    built.request3WesternNatal.endpoint,
    built.request3WesternNatal.body
  );
  const ephRec = await run(
    'ephemeris',
    built.request4Ephemeris.endpoint,
    built.request4Ephemeris.body
  );

  const ephemerisTimestampCheck = ephRec.ok
    ? evaluateEphemerisTimestampCheck(instant, built.request4Ephemeris.body, ephRec.rawResponse)
    : null;

  let timezoneEquivalenceCheck: TimezoneEquivalenceCheck | null = null;
  const validationFailures: string[] = [];

  if (runProbe) {
    try {
      options?.onProgress?.('[V2 Acquisition] Running Mode A (IANA) vs Mode B (UTC) probe...');
      const probe = await runTimezoneEquivalenceProbeInternal(instant, apiKey, rateWaitMs);
      timezoneEquivalenceCheck = probe.check;
      calls.timezone_probe_mode_a = probe.callA;
      calls.timezone_probe_mode_b = probe.callB;
      if (!probe.check.equivalent) {
        validationFailures.push(
          `Timezone equivalence probe failed or incomplete: ${probe.check.notes.join(' ')}`
        );
      }
    } catch (err) {
      validationFailures.push(
        `Timezone equivalence probe error: ${err instanceof Error ? err.message : 'unknown error'}`
      );
    }
  }

  const missingDatasets: string[] = [];
  if (!r1.ok) {
    missingDatasets.push(
      `vedic_calculate (${r1.endpoint}): Vedic Lahiri D1, 17 Vargas, Bhava Chalit, Ashtakavarga, Shadbala, Yogas, Panchang, Dasha unavailable (HTTP ${r1.httpStatus}${r1.errorMessage ? `: ${r1.errorMessage}` : ''})`
    );
  }
  if (!r2.ok) {
    missingDatasets.push(
      `vedic_kp (${r2.endpoint}): KP Placidus cusps, sub-lords, 4-level significators & ruling planets unavailable (HTTP ${r2.httpStatus}${r2.errorMessage ? `: ${r2.errorMessage}` : ''})`
    );
  }
  if (!r3.ok) {
    missingDatasets.push(
      `western_natal (${r3.endpoint}): Western Tropical Placidus chart, aspects & outer bodies unavailable (HTTP ${r3.httpStatus}${r3.errorMessage ? `: ${r3.errorMessage}` : ''})`
    );
  }
  if (!ephRec.ok) {
    missingDatasets.push(
      `ephemeris (${ephRec.endpoint}): Geocentric astronomical telemetry & timestamp verification unavailable (HTTP ${ephRec.httpStatus}${ephRec.errorMessage ? `: ${ephRec.errorMessage}` : ''})`
    );
  }

  if (ephemerisTimestampCheck && !ephemerisTimestampCheck.exactTimestampMatch) {
    validationFailures.push(
      `Ephemeris timestamp delta=${ephemerisTimestampCheck.deltaSecondsFromCanonical ?? 'N/A'}s (${ephemerisTimestampCheck.limitationNotes.join(' ')})`
    );
  }

  const mainCalls = [r1, r2, r3, ephRec];
  const mainSuccessCount = mainCalls.filter((c) => c.ok).length;
  const acquisitionStatus: LayerARawProviderRecord['acquisitionStatus'] =
    mainSuccessCount === 4 ? 'complete' : mainSuccessCount > 0 ? 'partial' : 'failed';

  const allCallValues = Object.values(calls);
  const successfulCalls = allCallValues.filter((c) => c.ok).length;
  const actualHttpRequestsSent = allCallValues.reduce((s, c) => s + (c.attempts || 1), 0);
  const retryCount = allCallValues.reduce((s, c) => s + Math.max(0, (c.attempts || 1) - 1), 0);
  const totalRateWaitMs = allCallValues.reduce((s, c) => s + (c.rateWaitMs || 0), 0);
  const coordinationModesObserved = Array.from(
    new Set(allCallValues.map((c) => c.coordinationMode))
  );

  return {
    schemaVersion: 'v2.raw.1.0',
    capturedAtUtc: new Date().toISOString(),
    providerId: 'freeastroapi',
    providerBaseUrl: FREE_ASTRO_API_BASE_URL,
    inputFingerprint: instant.inputFingerprint,
    canonicalUtcIso: instant.utc.iso,
    canonicalJulianDayUt: instant.utc.julianDayUt,
    acquisitionStatus,
    missingDatasets,
    validationFailures,
    calls,
    timezoneEquivalenceCheck,
    ephemerisTimestampCheck,
    quotaAndPerformanceSummary: {
      plannedRequestsCount,
      totalCalls: allCallValues.length,
      actualHttpRequestsSent,
      retryCount,
      successfulCalls,
      failedCalls: allCallValues.length - successfulCalls,
      totalLatencyMs: allCallValues.reduce((s, c) => s + c.latencyMs, 0),
      totalRateWaitMs,
      totalPayloadBytes: allCallValues.reduce((s, c) => s + c.payloadBytes, 0),
      coordinationModesObserved,
      quotaHeadersObserved: summarizeObservedQuotaHeaders(allCallValues),
    },
  };
}
