/**
 * Isolated V2 Engine — Single Authoritative Birth Instant Solver
 *
 * Pure Web / TypeScript (zero Node built-ins; Cloudflare Workers safe).
 * Establishes one canonical birth-instant object shared across every API
 * endpoint and local derivation:
 * - Preserves original local date and time including seconds
 * - Preserves exact coordinates and birth-time precision/uncertainty
 * - Resolves historical UTC offset & DST via Intl tzdb when IANA timezone is known
 * - Explicitly detects nonexistent (DST spring-forward gap) and ambiguous (DST fall-back fold)
 *   local times instead of silently shifting or picking an occurrence
 * - NEVER silently defaults to UTC or offset 0 when timezone resolution fails
 * - Computes exact UTC components, ISO instant, Julian Day (UT), GMST, LMST,
 *   mean obliquity, approximate Lahiri & KP ayanamsas, and deterministic SHA-256 fingerprint
 */

import type {
  CanonicalBirthInput,
  CanonicalBirthInstant,
  DstFoldDisambiguation,
  TimezoneResolutionMethod,
  UtcDateComponents,
} from './types';

export class BirthInstantValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BirthInstantValidationError';
  }
}

export interface AmbiguousLocalTimeCandidate {
  occurrence: DstFoldDisambiguation;
  utcIso: string;
  offsetHours: number;
  isDst: boolean;
}

export class BirthInstantTimezoneError extends Error {
  code:
    | 'MISSING_TIMEZONE'
    | 'INVALID_IANA_TIMEZONE'
    | 'NONEXISTENT_LOCAL_TIME'
    | 'AMBIGUOUS_LOCAL_TIME';
  candidates?: AmbiguousLocalTimeCandidate[];

  constructor(
    message: string,
    code:
      | 'MISSING_TIMEZONE'
      | 'INVALID_IANA_TIMEZONE'
      | 'NONEXISTENT_LOCAL_TIME'
      | 'AMBIGUOUS_LOCAL_TIME' = 'MISSING_TIMEZONE',
    candidates?: AmbiguousLocalTimeCandidate[]
  ) {
    super(message);
    this.name = 'BirthInstantTimezoneError';
    this.code = code;
    this.candidates = candidates;
  }
}

export function normalizeDeg360(deg: number): number {
  const x = deg % 360;
  return x < 0 ? x + 360 : x;
}

/**
 * Pure synchronous FIPS-180-4 SHA-256 hex digest (zero Node crypto dependency).
 */
function sha256Hex(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const W = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return Array.from(H)
    .map((x) => x.toString(16).padStart(8, '0'))
    .join('');
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
    throw new BirthInstantTimezoneError(
      `Invalid IANA timezone "${tz}".`,
      'INVALID_IANA_TIMEZONE'
    );
  }
}

function getZonedWallClockAtUtcMs(
  utcMs: number,
  timeZone: string
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  offsetSeconds: number;
} {
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
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  const localAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    offsetSeconds: Math.round((localAsUtcMs - utcMs) / 1000),
  };
}

function getZoneOffsetSecondsAtUtcMs(utcMs: number, timeZone: string): number {
  return getZonedWallClockAtUtcMs(utcMs, timeZone).offsetSeconds;
}

function matchesTargetWallClock(
  w: ReturnType<typeof getZonedWallClockAtUtcMs>,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): boolean {
  return (
    w.year === year &&
    w.month === month &&
    w.day === day &&
    w.hour === hour &&
    w.minute === minute &&
    w.second === second
  );
}

function resolveIanaLocalWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
  dstFoldDisambiguation?: DstFoldDisambiguation
): {
  utcMs: number;
  offsetSeconds: number;
  standardOffsetSeconds: number;
  isDst: boolean;
  dstTransitionNote: string | null;
  dstFoldDisambiguationUsed: DstFoldDisambiguation | null;
} {
  assertValidIanaTimezone(timeZone);
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);

  // Sample offsets across a +/- 24h bracket around naiveUtcMs to capture every candidate offset
  // (catches 30m/45m/60m/120m historical DST or tzdb shifts accurately).
  const candidateOffsets = new Set<number>();
  for (const deltaHours of [-24, -12, -3, -2, -1, 0, 1, 2, 3, 12, 24]) {
    candidateOffsets.add(getZoneOffsetSecondsAtUtcMs(naiveUtcMs + deltaHours * 3600 * 1000, timeZone));
  }

  const validInstants: Array<{ utcMs: number; offsetSeconds: number }> = [];
  for (const offSec of candidateOffsets) {
    const candUtcMs = naiveUtcMs - offSec * 1000;
    const roundTrip = getZonedWallClockAtUtcMs(candUtcMs, timeZone);
    if (matchesTargetWallClock(roundTrip, year, month, day, hour, minute, second)) {
      if (!validInstants.some((v) => v.utcMs === candUtcMs)) {
        validInstants.push({ utcMs: candUtcMs, offsetSeconds: roundTrip.offsetSeconds });
      }
    }
  }

  validInstants.sort((a, b) => a.utcMs - b.utcMs);

  const janOffset = getZoneOffsetSecondsAtUtcMs(Date.UTC(year, 0, 1, 12, 0, 0), timeZone);
  const julOffset = getZoneOffsetSecondsAtUtcMs(Date.UTC(year, 6, 1, 12, 0, 0), timeZone);
  const standardOffsetSeconds = Math.min(janOffset, julOffset);
  const hasSeasonalDst = janOffset !== julOffset;

  const pad = (n: number) => String(n).padStart(2, '0');
  const localLabel = `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;

  // Case 1: Nonexistent local wall time (spring-forward gap)
  if (validInstants.length === 0) {
    throw new BirthInstantTimezoneError(
      `Nonexistent historical local time: "${localLabel}" in ${timeZone} fell inside a clock-forward (DST or tzdb) gap and never occurred on local clocks.`,
      'NONEXISTENT_LOCAL_TIME'
    );
  }

  // Case 2: Ambiguous local wall time (fall-back fold — occurred twice)
  let chosen = validInstants[0];
  let dstFoldDisambiguationUsed: DstFoldDisambiguation | null = null;
  let dstTransitionNote: string | null = null;

  if (validInstants.length > 1) {
    const earlier = validInstants[0];
    const later = validInstants[validInstants.length - 1];
    const candidates: AmbiguousLocalTimeCandidate[] = [
      {
        occurrence: 'earlier_occurrence',
        utcIso: new Date(earlier.utcMs).toISOString(),
        offsetHours: Number((earlier.offsetSeconds / 3600).toFixed(6)),
        isDst: hasSeasonalDst && earlier.offsetSeconds > standardOffsetSeconds,
      },
      {
        occurrence: 'later_occurrence',
        utcIso: new Date(later.utcMs).toISOString(),
        offsetHours: Number((later.offsetSeconds / 3600).toFixed(6)),
        isDst: hasSeasonalDst && later.offsetSeconds > standardOffsetSeconds,
      },
    ];

    if (!dstFoldDisambiguation) {
      throw new BirthInstantTimezoneError(
        `Ambiguous historical local time: "${localLabel}" in ${timeZone} occurred twice during a fall-back transition (${candidates[0].utcIso} [UTC${candidates[0].offsetHours >= 0 ? '+' : ''}${candidates[0].offsetHours}] vs ${candidates[1].utcIso} [UTC${candidates[1].offsetHours >= 0 ? '+' : ''}${candidates[1].offsetHours}]). Explicit disambiguation is required.`,
        'AMBIGUOUS_LOCAL_TIME',
        candidates
      );
    }

    chosen = dstFoldDisambiguation === 'later_occurrence' ? later : earlier;
    dstFoldDisambiguationUsed = dstFoldDisambiguation;
    dstTransitionNote = `Resolved ambiguous DST fall-back fold using "${dstFoldDisambiguation}" -> ${new Date(chosen.utcMs).toISOString()}.`;
  } else {
    const minus1hOff = getZoneOffsetSecondsAtUtcMs(chosen.utcMs - 3600 * 1000, timeZone);
    const plus1hOff = getZoneOffsetSecondsAtUtcMs(chosen.utcMs + 3600 * 1000, timeZone);
    if (minus1hOff !== chosen.offsetSeconds || plus1hOff !== chosen.offsetSeconds) {
      dstTransitionNote = `Within ±1h of offset transition (${minus1hOff / 3600}h -> ${chosen.offsetSeconds / 3600}h -> ${plus1hOff / 3600}h).`;
    }
  }

  const isDst = hasSeasonalDst && chosen.offsetSeconds > standardOffsetSeconds;

  return {
    utcMs: chosen.utcMs,
    offsetSeconds: chosen.offsetSeconds,
    standardOffsetSeconds,
    isDst,
    dstTransitionNote,
    dstFoldDisambiguationUsed,
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
  let dstFoldDisambiguationUsed: DstFoldDisambiguation | null = null;
  const ianaTimezone: string | null = rawInput.ianaTimezone?.trim() || null;
  let resolutionMethod: TimezoneResolutionMethod;

  if (ianaTimezone) {
    const resolved = resolveIanaLocalWallTimeToUtc(
      year,
      month,
      day,
      hour,
      minute,
      second,
      ianaTimezone,
      rawInput.dstFoldDisambiguation
    );
    utcMs = resolved.utcMs;
    offsetSeconds = resolved.offsetSeconds;
    standardOffsetSeconds = resolved.standardOffsetSeconds;
    isDst = resolved.isDst;
    dstTransitionNote = resolved.dstTransitionNote;
    dstFoldDisambiguationUsed = resolved.dstFoldDisambiguationUsed;
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
      'Timezone resolution required: neither ianaTimezone nor explicitHistoricalUtcOffsetHours was supplied. Refusing to silently default to UTC.',
      'MISSING_TIMEZONE'
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
  const inputFingerprint = sha256Hex(fingerprintSeed).slice(0, 24);

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
      dstFoldDisambiguationUsed,
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
      'Cannot construct Mode A local request without resolved IANA timezone.',
      'MISSING_TIMEZONE'
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
