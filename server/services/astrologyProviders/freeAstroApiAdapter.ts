import {
  formatDMS,
  getDignity,
  getNakshatraAndSubs,
  normalizeDeg,
  SIGNS,
  type PlanetPosition,
} from '../jyotishMath';
import type {
  ProviderBirthInputPayload,
  ProviderBirthLocationResolved,
  ProviderChartFetchResult,
  ProviderPlaceSuggestion,
} from './types';

const FREE_ASTRO_BASE_URL = 'https://api.freeastroapi.com';
const FREE_ASTRO_RATE_MS = Number(process.env.FREE_ASTRO_RATE_MS) || 1100;

let queueTail: Promise<unknown> = Promise.resolve();
let lastRequestTime = 0;

export function isFreeAstroApiConfigured(): boolean {
  return Boolean((process.env.FREE_ASTRO_API_KEY || '').trim());
}

async function scheduleRateLimited<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueTail.then(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, FREE_ASTRO_RATE_MS - (now - lastRequestTime));
    if (waitMs > 0) {
      await new Promise((r) => setTimeout(r, waitMs));
    }
    lastRequestTime = Date.now();
    return fn();
  });

  queueTail = run.catch(() => undefined);
  return run;
}

async function requestFreeAstroApi<T = unknown>(
  endpointPath: string,
  options?: {
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
    retries?: number;
  }
): Promise<T> {
  const apiKey = (process.env.FREE_ASTRO_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('FREE_ASTRO_API_KEY is not configured on the server.');
  }

  const method = options?.method || 'POST';
  const retries = options?.retries ?? 2;

  return scheduleRateLimited(async () => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const response = await fetch(`${FREE_ASTRO_BASE_URL}${endpointPath}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        ...(method === 'POST' && options?.body ? { body: JSON.stringify(options.body) } : {}),
      });

      if (response.status === 429 && attempt < retries) {
        const retryAfterSec = Number(response.headers.get('retry-after') || '0');
        const backoff = retryAfterSec > 0 ? retryAfterSec * 1000 : 1500 * (attempt + 1);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`FreeAstroAPI ${endpointPath} failed (${response.status}): ${text.slice(0, 200)}`);
      }

      return (await response.json()) as T;
    }

    throw new Error(`FreeAstroAPI ${endpointPath} exceeded retries`);
  });
}

function getTimezoneOffsetHoursForZone(
  ianaZone: string,
  birthDateISO: string,
  birthTimeStr: string,
  fallbackOffset: number
): number {
  try {
    const [year, month, day] = birthDateISO.split('-').map(Number);
    const [hour = 12, minute = 0, second = 0] = birthTimeStr.split(':').map(Number);
    const utcGuess = new Date(Date.UTC(year, (month || 1) - 1, day || 1, hour, minute, second));
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(utcGuess);

    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = Number(p.value);
    }
    const zonedUtc = Date.UTC(
      map.year,
      (map.month || 1) - 1,
      map.day || 1,
      map.hour || 0,
      map.minute || 0,
      map.second || 0
    );
    const offsetHours = (zonedUtc - utcGuess.getTime()) / 3600000;
    return Number.isFinite(offsetHours) ? Number(offsetHours.toFixed(4)) : fallbackOffset;
  } catch {
    return fallbackOffset;
  }
}

function formatOffsetToTzStr(offsetHours: number): string {
  const sign = offsetHours >= 0 ? '+' : '-';
  const absMins = Math.round(Math.abs(offsetHours) * 60);
  const hh = String(Math.floor(absMins / 60)).padStart(2, '0');
  const mm = String(absMins % 60).padStart(2, '0');
  return `UTC${sign}${hh}:${mm}`;
}

export async function searchBirthPlacesFreeAstroApi(query: string): Promise<ProviderPlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const resp = await requestFreeAstroApi<Record<string, unknown>>(
    `/api/v2/geo/search?q=${encodeURIComponent(trimmed)}&limit=6`,
    { method: 'GET' }
  );

  const rows = Array.isArray(resp?.results)
    ? resp.results
    : Array.isArray(resp?.cities)
    ? resp.cities
    : Array.isArray(resp)
    ? resp
    : [];

  const todayISO = new Date().toISOString().slice(0, 10);
  const suggestions: ProviderPlaceSuggestion[] = [];

  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const lat = Number(obj.lat ?? obj.latitude);
    const lon = Number(obj.lng ?? obj.lon ?? obj.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

    const city = String(obj.name || obj.city || trimmed).trim();
    const state =
      typeof obj.state === 'string' && obj.state.trim()
        ? obj.state.trim()
        : typeof obj.admin1 === 'string' && obj.admin1.trim()
        ? obj.admin1.trim()
        : null;
    const country = String(obj.country_name || obj.country || obj.country_code || 'India').trim();
    const label = [city, state, country].filter(Boolean).join(', ');

    const ianaZone = typeof obj.timezone === 'string' ? obj.timezone : typeof obj.tz_str === 'string' ? obj.tz_str : undefined;
    const rawOffset = Number(obj.timezone_offset ?? obj.utc_offset_hours ?? NaN);
    const timezoneOffset = !Number.isNaN(rawOffset)
      ? rawOffset
      : ianaZone
      ? getTimezoneOffsetHoursForZone(ianaZone, todayISO, '12:00:00', 0)
      : 0;

    suggestions.push({
      label,
      city,
      state,
      country,
      latitude: lat,
      longitude: lon,
      timezoneOffset,
    });
    if (suggestions.length >= 6) break;
  }

  return suggestions;
}

export async function resolveHistoricalTimezoneOffsetFreeAstroApi(
  _lat: number,
  _lon: number,
  birthDateISO: string,
  birthTimeStr: string,
  fallbackOffset: number,
  tzName?: string
): Promise<number> {
  if (tzName && !tzName.startsWith('UTC')) {
    return getTimezoneOffsetHoursForZone(tzName, birthDateISO, birthTimeStr, fallbackOffset);
  }
  return fallbackOffset;
}

export async function geocodeBirthLocationFreeAstroApi(
  city: string,
  state: string | null | undefined,
  country: string,
  birthDateISO: string,
  birthTimeStr: string
): Promise<ProviderBirthLocationResolved> {
  const query = [city, state, country].filter(Boolean).join(', ');
  const resp = await requestFreeAstroApi<Record<string, unknown>>(
    `/api/v2/geo/search?q=${encodeURIComponent(query)}&limit=3`,
    { method: 'GET' }
  );

  const rows = Array.isArray(resp?.results)
    ? resp.results
    : Array.isArray(resp?.cities)
    ? resp.cities
    : Array.isArray(resp)
    ? resp
    : [];

  const first = rows[0] as Record<string, unknown> | undefined;
  const lat = Number(first?.lat ?? first?.latitude);
  const lon = Number(first?.lng ?? first?.lon ?? first?.longitude);

  if (!first || Number.isNaN(lat) || Number.isNaN(lon)) {
    throw new Error(
      `Could not find birth place "${query}" via FreeAstroAPI. Try adding the state or country.`
    );
  }

  const ianaZone =
    typeof first.timezone === 'string'
      ? first.timezone
      : typeof first.tz_str === 'string'
      ? first.tz_str
      : undefined;
  const baseOffset = Number(first.timezone_offset ?? first.utc_offset_hours ?? 0);
  const tzOffset = ianaZone
    ? getTimezoneOffsetHoursForZone(ianaZone, birthDateISO, birthTimeStr, Number.isNaN(baseOffset) ? 0 : baseOffset)
    : Number.isNaN(baseOffset)
    ? 0
    : baseOffset;

  const label = [
    first.name || first.city || city,
    first.state || state,
    first.country_name || first.country || country,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    latitude: lat,
    longitude: lon,
    timezoneOffset: tzOffset,
    locationLabel: label || query,
  };
}

function normalizeV2VedicPlanets(raw: Record<string, unknown>): PlanetPosition[] {
  const chart = (raw?.chart ?? raw) as Record<string, unknown>;
  const ascObj = (chart?.ascendant ?? null) as Record<string, unknown> | null;
  const planetList = Array.isArray(chart?.planets) ? (chart.planets as Array<Record<string, unknown>>) : [];

  const mapped: PlanetPosition[] = [];
  let ascSignIdx = 0;

  if (ascObj) {
    const ascLon = normalizeDeg(Number(ascObj.degree ?? ascObj.absolute_degree ?? 0));
    ascSignIdx = Math.floor(ascLon / 30) % 12;
    const degInSign = ascLon % 30;
    const nak = getNakshatraAndSubs(ascLon);
    mapped.push({
      name: 'Ascendant',
      longitude: Number(ascLon.toFixed(4)),
      signIndex: ascSignIdx,
      sign: SIGNS[ascSignIdx],
      degreeInSign: Number(degInSign.toFixed(4)),
      dms: formatDMS(degInSign),
      nakshatra: nak.nakshatra,
      nakshatraIndex: nak.nakshatraIndex,
      nakshatraLord: nak.nakshatraLord,
      pada: nak.pada,
      subLord: nak.subLord,
      subSubLord: nak.subSubLord,
      isRetrograde: false,
      house: 1,
      dignity: 'Lagna',
    });
  }

  const wanted = new Set(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']);

  for (const row of planetList) {
    const rawName = String(row.name || '').trim();
    const canonicalName = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();
    if (!wanted.has(canonicalName)) continue;

    const absDeg = Number(row.absolute_degree ?? row.longitude ?? NaN);
    if (Number.isNaN(absDeg)) continue;

    const lon = normalizeDeg(absDeg);
    const signIndex = Math.floor(lon / 30) % 12;
    const degInSign = lon % 30;
    const nak = getNakshatraAndSubs(lon);
    const isRetrograde = Boolean(row.is_retrograde);

    mapped.push({
      name: canonicalName,
      longitude: Number(lon.toFixed(4)),
      signIndex,
      sign: SIGNS[signIndex],
      degreeInSign: Number(degInSign.toFixed(4)),
      dms: formatDMS(degInSign),
      nakshatra: nak.nakshatra,
      nakshatraIndex: nak.nakshatraIndex,
      nakshatraLord: nak.nakshatraLord,
      pada: nak.pada,
      subLord: nak.subLord,
      subSubLord: nak.subSubLord,
      isRetrograde,
      house: ((signIndex - ascSignIdx + 12) % 12) + 1,
      dignity: getDignity(canonicalName, signIndex),
    });
  }

  return mapped;
}

function normalizeV1WesternPlanets(
  raw: Record<string, unknown>
): Array<{ name: string; longitude: number; isRetrograde?: boolean }> {
  const list = Array.isArray(raw?.planets) ? (raw.planets as Array<Record<string, unknown>>) : [];
  const results: Array<{ name: string; longitude: number; isRetrograde?: boolean }> = [];

  for (const item of list) {
    const name = String(item.name || '').trim();
    const absPos = Number(item.abs_pos ?? item.longitude ?? NaN);
    if (!name || Number.isNaN(absPos)) continue;
    results.push({
      name,
      longitude: normalizeDeg(absPos),
      isRetrograde: Boolean(item.retrograde),
    });
  }
  return results;
}

export async function fetchChartFreeAstroApi(
  payload: ProviderBirthInputPayload,
  options?: {
    fetchApiShadBala?: boolean;
    fetchApiWesternPlanets?: boolean;
    westernHouseSystem?: 'Placidus' | 'Whole Sign';
  }
): Promise<ProviderChartFetchResult> {
  const tzStr = formatOffsetToTzStr(payload.timezone);
  const vedicRaw = await requestFreeAstroApi<Record<string, unknown>>('/api/v2/vedic/calculate', {
    method: 'POST',
    body: {
      year: payload.year,
      month: payload.month,
      day: payload.date,
      hour: payload.hours,
      minute: payload.minutes,
      lat: payload.latitude,
      lng: payload.longitude,
      tz_str: tzStr,
      ayanamsha: 'lahiri',
      house_system: 'whole_sign',
      node_type: 'mean',
      vargas: [1],
      include_shadbala: options?.fetchApiShadBala !== false,
      dasha_levels: 0,
    },
  });

  const planets = normalizeV2VedicPlanets(vedicRaw);
  if (planets.length < 8) {
    throw new Error('FreeAstroAPI returned incomplete Vedic planetary positions.');
  }

  const apiShadBala = options?.fetchApiShadBala !== false ? vedicRaw.shadbala ?? null : null;
  let apiWesternPlanets: Array<{ name: string; longitude: number; isRetrograde?: boolean }> | null = null;

  if (options?.fetchApiWesternPlanets !== false) {
    try {
      const westernRaw = await requestFreeAstroApi<Record<string, unknown>>('/api/v1/natal/calculate', {
        method: 'POST',
        body: {
          year: payload.year,
          month: payload.month,
          day: payload.date,
          hour: payload.hours,
          minute: payload.minutes,
          city: 'Reference',
          lat: payload.latitude,
          lng: payload.longitude,
          tz_str: tzStr,
          house_system: options?.westernHouseSystem === 'Whole Sign' ? 'whole_sign' : 'placidus',
          zodiac_type: 'tropical',
        },
        retries: 0,
      });
      const parsed = normalizeV1WesternPlanets(westernRaw);
      if (parsed.length > 0) apiWesternPlanets = parsed;
    } catch {
      apiWesternPlanets = null;
    }
  }

  return {
    planets,
    apiShadBala,
    apiWesternPlanets,
  };
}

export async function fetchDailyTransitPlanetsFreeAstroApi(
  dateISO: string
): Promise<PlanetPosition[]> {
  const [year, month, day] = dateISO.split('-').map(Number);
  const raw = await requestFreeAstroApi<Record<string, unknown>>('/api/v2/vedic/calculate', {
    method: 'POST',
    body: {
      year,
      month,
      day,
      hour: 12,
      minute: 0,
      city: 'New Delhi',
      lat: 28.6139,
      lng: 77.209,
      tz_str: 'Asia/Kolkata',
      ayanamsha: 'lahiri',
      house_system: 'whole_sign',
      node_type: 'mean',
      vargas: [1],
      dasha_levels: 0,
    },
  });

  return normalizeV2VedicPlanets(raw).filter((p) => p.name !== 'Ascendant');
}
