/**
 * Isolated V2 Engine — Single Authoritative Birth Instant Solver
 *
 * Establishes one canonical birth-instant object shared across every API
 * endpoint and local derivation:
 * - Preserves original local date and time including seconds
 * - Preserves exact coordinates and birth-time precision/uncertainty
 * - Resolves historical UTC offset & DST via Intl tzdb when IANA timezone is known
 * - NEVER silently defaults to UTC or offset 0 when timezone resolution fails
 * - Computes exact UTC components, ISO instant, Julian Day (UT), GMST, LMST,
 *   mean obliquity, approximate Lahiri & KP ayanamsas, and deterministic fingerprint
 */

import crypto from 'node:crypto';
import type {
  CanonicalBirthInput,
  CanonicalBirthInstant,
  TimezoneResolutionMethod,
  UtcDateComponents,
} from './types';

export class BirthInstantValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BirthInstantValidationError';
  }
}

export class BirthInstantTimezoneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BirthInstantTimezoneError';
  }
}

export function normalizeDeg360(deg: number): number {
  const x = deg % 360;
  return x < 0 ? x + 360 : x;
}

export function computeJulianDayUt(
  year: number,
  month: number,
  day: number,
  utcHourFloat: number
): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    utcHourFloat / 24 +
    B -
    1524.5
  );
}

function parseBirthDate(dateStr: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateStr || '').trim());
  if (!match) {
    throw new BirthInstantValidationError(
      `Invalid birthDate "${dateStr}". Expected YYYY-MM-DD.`
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day
  ) {
    throw new BirthInstantValidationError(`Non-existent calendar date "${dateStr}".`);
  }
  return { year, month, day };
}

function parseBirthTime(timeStr: string): {
  hour: number;
  minute: number;
  second: number;
  normalizedTime: string;
} {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec((timeStr || '').trim());
  if (!match) {
    throw new BirthInstantValidationError(
      `Invalid birthTime "${timeStr}". Expected HH:MM or HH:MM:SS.`
    );
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] !== undefined ? Number(match[3]) : 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    throw new BirthInstantValidationError(
      `Out-of-range birthTime "${timeStr}" (hour 0..23, minute 0..59, second 0..59).`
    );
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    hour,
    minute,
    second,
    normalizedTime: `${pad(hour)}:${pad(minute)}:${pad(second)}`,
  };
}

function assertValidIanaTimezone(tz: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date(0));
  } catch {
    throw new BirthInstantTimezoneError(`Invalid IANA timezone "${tz}".`);
  }
}

function getZoneOffsetSecondsAtUtcMs(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) {
    parts[part.type] = part.value;
  }
  const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
  const localAsUtcMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second)
  );
  return Math.round((localAsUtcMs - utcMs) / 1000);
}

function resolveIanaLocalWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): {
  utcMs: number;
  offsetSeconds: number;
  standardOffsetSeconds: number;
  isDst: boolean;
  dstTransitionNote: string | null;
} {
  assertValidIanaTimezone(timeZone);
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);

  let guessUtcMs = naiveUtcMs - getZoneOffsetSecondsAtUtcMs(naiveUtcMs, timeZone) * 1000;
  for (let i = 0; i < 5; i++) {
    const offSec = getZoneOffsetSecondsAtUtcMs(guessUtcMs, timeZone);
    const nextGuess = naiveUtcMs - offSec * 1000;
    if (nextGuess === guessUtcMs) break;
    guessUtcMs = nextGuess;
  }

  const finalOffsetSeconds = getZoneOffsetSecondsAtUtcMs(guessUtcMs, timeZone);

  // Detect standard offset & DST for that calendar year in that zone
  const janOffset = getZoneOffsetSecondsAtUtcMs(Date.UTC(year, 0, 1, 12, 0, 0), timeZone);
  const julOffset = getZoneOffsetSecondsAtUtcMs(Date.UTC(year, 6, 1, 12, 0, 0), timeZone);
  const standardOffsetSeconds = Math.min(janOffset, julOffset);
  const hasSeasonalDst = janOffset !== julOffset;
  const isDst = hasSeasonalDst && finalOffsetSeconds > standardOffsetSeconds;

  // Check if local time fell on a DST fold or gap
  const minus1hOff = getZoneOffsetSecondsAtUtcMs(guessUtcMs - 3600 * 1000, timeZone);
  const plus1hOff = getZoneOffsetSecondsAtUtcMs(guessUtcMs + 3600 * 1000, timeZone);
  let dstTransitionNote: string | null = null;
  if (minus1hOff !== finalOffsetSeconds || plus1hOff !== finalOffsetSeconds) {
    dstTransitionNote = `Within ±1h of DST offset transition (${minus1hOff / 3600}h -> ${finalOffsetSeconds / 3600}h -> ${plus1hOff / 3600}h).`;
  }

  return {
    utcMs: guessUtcMs,
    offsetSeconds: finalOffsetSeconds,
    standardOffsetSeconds,
    isDst,
    dstTransitionNote,
  };
}

export function resolveCanonicalBirthInstant(
  rawInput: CanonicalBirthInput,
  options?: { resolutionMethodOverride?: TimezoneResolutionMethod }
): CanonicalBirthInstant {
  if (
    typeof rawInput.latitude !== 'number' ||
    !Number.isFinite(rawInput.latitude) ||
    rawInput.latitude < -90 ||
    rawInput.latitude > 90
  ) {
    throw new BirthInstantValidationError(`Invalid latitude: ${rawInput.latitude}`);
  }
  if (
    typeof rawInput.longitude !== 'number' ||
    !Number.isFinite(rawInput.longitude) ||
    rawInput.longitude < -180 ||
    rawInput.longitude > 180
  ) {
    throw new BirthInstantValidationError(`Invalid longitude: ${rawInput.longitude}`);
  }

  const { year, month, day } = parseBirthDate(rawInput.birthDate);
  const { hour, minute, second, normalizedTime } = parseBirthTime(rawInput.birthTime);
  const nodeConvention = rawInput.nodeConvention || 'mean';
  const birthTimePrecision = rawInput.birthTimePrecision || 'exact';

  let utcMs: number;
  let offsetSeconds: number;
  let standardOffsetSeconds: number;
  let isDst = false;
  let dstTransitionNote: string | null = null;
  let ianaTimezone: string | null = rawInput.ianaTimezone?.trim() || null;
  let resolutionMethod: TimezoneResolutionMethod;

  if (ianaTimezone) {
    const resolved = resolveIanaLocalWallTimeToUtc(
      year,
      month,
      day,
      hour,
      minute,
      second,
      ianaTimezone
    );
    utcMs = resolved.utcMs;
    offsetSeconds = resolved.offsetSeconds;
    standardOffsetSeconds = resolved.standardOffsetSeconds;
    isDst = resolved.isDst;
    dstTransitionNote = resolved.dstTransitionNote;
    resolutionMethod = options?.resolutionMethodOverride || 'explicit_iana_intl';
  } else if (
    typeof rawInput.explicitHistoricalUtcOffsetHours === 'number' &&
    Number.isFinite(rawInput.explicitHistoricalUtcOffsetHours)
  ) {
    offsetSeconds = Math.round(rawInput.explicitHistoricalUtcOffsetHours * 3600);
    standardOffsetSeconds = offsetSeconds;
    utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - offsetSeconds * 1000;
    resolutionMethod = 'explicit_historical_offset';
  } else {
    throw new BirthInstantTimezoneError(
      'Timezone resolution required: neither ianaTimezone nor explicitHistoricalUtcOffsetHours was supplied. Refusing to silently default to UTC.'
    );
  }

  const utcDate = new Date(utcMs);
  const utcComponents: UtcDateComponents = {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate(),
    hour: utcDate.getUTCHours(),
    minute: utcDate.getUTCMinutes(),
    second: utcDate.getUTCSeconds(),
  };

  const utcHourFloat =
    utcComponents.hour + utcComponents.minute / 60 + utcComponents.second / 3600;
  const julianDayUt = computeJulianDayUt(
    utcComponents.year,
    utcComponents.month,
    utcComponents.day,
    utcHourFloat
  );

  const t = (julianDayUt - 2451545.0) / 36525.0;
  const gmstDeg = normalizeDeg360(
    280.46061837 +
      360.98564736629 * (julianDayUt - 2451545.0) +
      0.000387933 * t * t -
      (t * t * t) / 38710000
  );
  const lmstDeg = normalizeDeg360(gmstDeg + rawInput.longitude);
  const meanObliquityDeg = 23.4392911 - 0.01300416 * t;
  const lahiriAyanamsaApproxDeg = 23.85708 + 1.39697128 * t + 0.0003086 * t * t;
  const kpAyanamsaApproxDeg = 23.7586 + 1.3965 * t;

  const utcIso = utcDate.toISOString();
  const fingerprintSeed = JSON.stringify({
    utcIso,
    lat: Number(rawInput.latitude.toFixed(6)),
    lng: Number(rawInput.longitude.toFixed(6)),
    nodeConvention,
  });
  const inputFingerprint = crypto
    .createHash('sha256')
    .update(fingerprintSeed)
    .digest('hex')
    .slice(0, 24);

  return {
    input: {
      profileId: rawInput.profileId,
      name: rawInput.name,
      birthDate: rawInput.birthDate,
      birthTime: normalizedTime,
      year,
      month,
      day,
      hour,
      minute,
      second,
      latitude: rawInput.latitude,
      longitude: rawInput.longitude,
      city: rawInput.city || '',
      state: rawInput.state ?? null,
      country: rawInput.country || '',
      birthTimePrecision,
      birthTimeUncertaintyMinutes: rawInput.birthTimeUncertaintyMinutes ?? null,
      nodeConvention,
    },
    timezone: {
      ianaTimezone,
      resolutionMethod,
      historicalUtcOffsetSeconds: offsetSeconds,
      historicalUtcOffsetHours: Number((offsetSeconds / 3600).toFixed(6)),
      isDst,
      standardUtcOffsetSeconds: standardOffsetSeconds,
      dstTransitionNote,
    },
    utc: {
      components: utcComponents,
      iso: utcIso,
      timestampMs: utcMs,
      julianDayUt: Number(julianDayUt.toFixed(10)),
    },
    astronomy: {
      greenwichMeanSiderealTimeDeg: Number(gmstDeg.toFixed(8)),
      localMeanSiderealTimeDeg: Number(lmstDeg.toFixed(8)),
      meanObliquityDeg: Number(meanObliquityDeg.toFixed(8)),
      lahiriAyanamsaApproxDeg: Number(lahiriAyanamsaApproxDeg.toFixed(8)),
      kpAyanamsaApproxDeg: Number(kpAyanamsaApproxDeg.toFixed(8)),
    },
    inputFingerprint,
  };
}

/**
 * Mode A: Local birth date/time components (including seconds) + resolved IANA timezone.
 */
export function toModeALocalTimeFields(instant: CanonicalBirthInstant): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  lat: number;
  lng: number;
  tz_str: string;
} {
  if (!instant.timezone.ianaTimezone) {
    throw new BirthInstantTimezoneError(
      'Cannot construct Mode A local request without resolved IANA timezone.'
    );
  }
  return {
    year: instant.input.year,
    month: instant.input.month,
    day: instant.input.day,
    hour: instant.input.hour,
    minute: instant.input.minute,
    second: instant.input.second,
    lat: instant.input.latitude,
    lng: instant.input.longitude,
    tz_str: instant.timezone.ianaTimezone,
  };
}

/**
 * Mode B: Canonical UTC birth components (including seconds) + tz_str: 'UTC'.
 */
export function toModeBUtcTimeFields(instant: CanonicalBirthInstant): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  lat: number;
  lng: number;
  tz_str: 'UTC';
} {
  return {
    year: instant.utc.components.year,
    month: instant.utc.components.month,
    day: instant.utc.components.day,
    hour: instant.utc.components.hour,
    minute: instant.utc.components.minute,
    second: instant.utc.components.second,
    lat: instant.input.latitude,
    lng: instant.input.longitude,
    tz_str: 'UTC',
  };
}

export function formatUtcOffsetString(offsetSeconds: number): string {
  const sign = offsetSeconds >= 0 ? '+' : '-';
  const abs = Math.abs(offsetSeconds);
  const hh = String(Math.floor(abs / 3600)).padStart(2, '0');
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}
