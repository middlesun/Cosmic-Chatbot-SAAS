// Rate-limited FreeAstrologyAPI client (1 req/sec safe queue on free developer tier)
// Handles Geo Location, Timezone with DST, Planets Extended, Vargas, Vimsottari, Shad Bala, and Daily Gochar cache.

import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import {
  formatDMS,
  getDignity,
  getNakshatraAndSubs,
  normalizeDeg,
  SIGNS,
  type PlanetPosition,
} from './jyotishMath';

const BASE_URL = 'https://json.freeastrologyapi.com';
const RATE_LIMIT_INTERVAL_MS = Number(process.env.FREE_ASTROLOGY_RATE_MS) || 1100;

let queueTail: Promise<unknown> = Promise.resolve();
let lastRequestTime = 0;

export function isAstrologyApiConfigured(): boolean {
  return Boolean(process.env.FREE_ASTROLOGY_API_KEY);
}

async function scheduleRateLimited<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueTail.then(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, RATE_LIMIT_INTERVAL_MS - (now - lastRequestTime));
    if (waitMs > 0) {
      await new Promise((r) => setTimeout(r, waitMs));
    }
    lastRequestTime = Date.now();
    return fn();
  });

  queueTail = run.catch(() => undefined);
  return run;
}

async function postAstrologyEndpoint<T = unknown>(
  endpointPath: string,
  payload: Record<string, unknown>,
  retries = 2
): Promise<T> {
  const apiKey = process.env.FREE_ASTROLOGY_API_KEY;
  if (!apiKey) {
    throw new Error('FREE_ASTROLOGY_API_KEY is not configured on the server.');
  }

  return scheduleRateLimited(async () => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const response = await fetch(`${BASE_URL}${endpointPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 429 && attempt < retries) {
        const backoff = 1500 * (attempt + 1);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`FreeAstrologyAPI ${endpointPath} failed (${response.status}): ${text.slice(0, 200)}`);
      }

      const json = await response.json();
      return json as T;
    }

    throw new Error(`FreeAstrologyAPI ${endpointPath} exceeded retries`);
  });
}

export interface BirthLocationResolved {
  latitude: number;
  longitude: number;
  timezoneOffset: number;
  locationLabel: string;
}

export interface PlaceSuggestion {
  label: string;
  city: string;
  state: string | null;
  country: string;
  latitude: number;
  longitude: number;
  timezoneOffset: number;
}

const placeSearchCache = new Map<string, { expiresAt: number; places: PlaceSuggestion[] }>();
const PLACE_CACHE_TTL_MS = 10 * 60 * 1000;

function parsePlaceParts(completeName: string, fallbackQuery: string): {
  city: string;
  state: string | null;
  country: string;
} {
  const parts = completeName
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    return {
      city: parts[0],
      state: parts.slice(1, -1).join(', '),
      country: parts[parts.length - 1],
    };
  }
  if (parts.length === 2) {
    return {
      city: parts[0],
      state: null,
      country: parts[1],
    };
  }
  return {
    city: parts[0] || fallbackQuery.trim(),
    state: null,
    country: 'India',
  };
}

export async function searchBirthPlaces(query: string): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const cacheKey = trimmed.toLowerCase();
  const cached = placeSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.places;
  }

  const geoResp = await postAstrologyEndpoint<unknown[]>('/geo-details', {
    location: trimmed,
  });

  const rows = Array.isArray(geoResp) ? geoResp : [];
  const seen = new Set<string>();
  const places: PlaceSuggestion[] = [];

  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const lat = Number(obj.latitude);
    const lon = Number(obj.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

    const label = String(obj.complete_name || obj.location_name || obj.name || trimmed).trim();
    const dedupKey = `${label.toLowerCase()}::${lat.toFixed(2)}:${lon.toFixed(2)}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const parsed = parsePlaceParts(label, trimmed);
    const tzOffset = Number(obj.timezone_offset ?? 0);

    places.push({
      label,
      city: parsed.city,
      state: parsed.state,
      country: parsed.country,
      latitude: lat,
      longitude: lon,
      timezoneOffset: Number.isNaN(tzOffset) ? 0 : tzOffset,
    });

    if (places.length >= 6) break;
  }

  if (placeSearchCache.size > 200) {
    const oldestKey = placeSearchCache.keys().next().value;
    if (oldestKey) placeSearchCache.delete(oldestKey);
  }
  placeSearchCache.set(cacheKey, {
    expiresAt: Date.now() + PLACE_CACHE_TTL_MS,
    places,
  });

  return places;
}

export async function resolveHistoricalTimezoneOffset(
  lat: number,
  lon: number,
  birthDateISO: string,
  birthTimeStr: string,
  fallbackOffset: number,
  tzName?: string
): Promise<number> {
  const [year, month, date] = birthDateISO.split('-').map(Number);
  const [hours, minutes] = birthTimeStr.split(':').map(Number);

  let tzOffset = fallbackOffset;
  try {
    const tzResp = await postAstrologyEndpoint<Record<string, unknown>>('/timezone-with-dst', {
      latitude: lat,
      longitude: lon,
      year,
      month,
      date,
      hours: hours || 0,
      minutes: minutes || 0,
      seconds: 0,
      ...(tzName ? { timezone: tzName } : {}),
    });

    const parsedOffset = Number(
      tzResp?.timezone_offset ?? tzResp?.offset ?? tzResp?.gmt_offset ?? tzOffset
    );
    if (!Number.isNaN(parsedOffset)) {
      tzOffset = parsedOffset;
    }
  } catch {
    // Keep base timezone_offset if timezone-with-dst is unavailable for historical edge case
  }

  return tzOffset;
}

export async function geocodeBirthLocation(
  city: string,
  state: string | null | undefined,
  country: string,
  birthDateISO: string,
  birthTimeStr: string
): Promise<BirthLocationResolved> {
  const query = [city, state, country].filter(Boolean).join(', ');
  const geoResp = await postAstrologyEndpoint<unknown[]>('/geo-details', {
    location: query,
  });

  const first = Array.isArray(geoResp) ? (geoResp[0] as Record<string, unknown> | undefined) : undefined;
  if (!first || typeof first.latitude !== 'number' || typeof first.longitude !== 'number') {
    throw new Error(
      `Could not find birth place "${query}". Try adding the state or country (for example, "Pune, Maharashtra, India").`
    );
  }

  const lat = Number(first.latitude);
  const lon = Number(first.longitude);
  const baseOffset = Number(first.timezone_offset ?? 0);
  const tzName = typeof first.timezone === 'string' ? first.timezone : undefined;

  const tzOffset = await resolveHistoricalTimezoneOffset(
    lat,
    lon,
    birthDateISO,
    birthTimeStr,
    Number.isNaN(baseOffset) ? 0 : baseOffset,
    tzName
  );

  return {
    latitude: lat,
    longitude: lon,
    timezoneOffset: tzOffset,
    locationLabel: String(first.complete_name || query),
  };
}

export interface BirthApiPayload {
  year: number;
  month: number;
  date: number;
  hours: number;
  minutes: number;
  seconds: number;
  latitude: number;
  longitude: number;
  timezone: number;
  config: {
    observation_point: 'topocentric' | 'geocentric';
    ayanamsha: 'lahiri';
    language: 'en';
  };
}

export function buildApiPayload(
  birthDateISO: string,
  birthTimeStr: string,
  lat: number,
  lon: number,
  tz: number
): BirthApiPayload {
  const [year, month, date] = birthDateISO.split('-').map(Number);
  const [hours, minutes, seconds] = birthTimeStr.split(':').map(Number);

  return {
    year,
    month,
    date,
    hours: hours || 0,
    minutes: minutes || 0,
    seconds: seconds || 0,
    latitude: lat,
    longitude: lon,
    timezone: tz,
    config: {
      observation_point: 'geocentric',
      ayanamsha: 'lahiri',
      language: 'en',
    },
  };
}

// Parse FreeAstrologyAPI /planets/extended response across slight schema variations
export function normalizeExtendedPlanets(raw: unknown): PlanetPosition[] {
  const root = raw as Record<string, unknown>;
  const output = (root?.output ?? root) as unknown;

  const entries: Array<Record<string, unknown>> = [];

  if (Array.isArray(output)) {
    for (const item of output) {
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        // Sometimes FreeAstrologyAPI returns array with single keyed object {"0": {...}, "Ascendant": {...}}
        if ('name' in obj || 'fullDegree' in obj || 'normDegree' in obj) {
          entries.push(obj);
        } else {
          for (const [k, v] of Object.entries(obj)) {
            if (v && typeof v === 'object') {
              entries.push({ name: k, ...(v as Record<string, unknown>) });
            }
          }
        }
      }
    }
  } else if (output && typeof output === 'object') {
    for (const [k, v] of Object.entries(output as Record<string, unknown>)) {
      if (v && typeof v === 'object') {
        entries.push({ name: k, ...(v as Record<string, unknown>) });
      }
    }
  }

  const wanted = new Set([
    'Ascendant', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu',
  ]);

  const mapped: PlanetPosition[] = [];
  let ascSignIdx = 0;

  for (const row of entries) {
    const rawName = String(row.planet_name || row.name || row.localized_name || '').trim();
    const canonicalName =
      rawName.toLowerCase() === 'lagna' || rawName.toLowerCase() === 'ascendant'
        ? 'Ascendant'
        : rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();

    if (!wanted.has(canonicalName)) continue;

    const fullDegRaw = Number(row.fullDegree ?? row.longitude ?? row.full_degree ?? NaN);
    const signNumRaw = Number(row.current_sign ?? row.sign_number ?? row.rasi_no ?? NaN);
    const normDegRaw = Number(row.normDegree ?? row.degree ?? NaN);

    let lon = fullDegRaw;
    if (Number.isNaN(lon) && !Number.isNaN(signNumRaw) && !Number.isNaN(normDegRaw)) {
      lon = ((signNumRaw - 1) % 12) * 30 + normDegRaw;
    }
    if (Number.isNaN(lon)) continue;

    lon = normalizeDeg(lon);
    const signIndex = Math.floor(lon / 30) % 12;
    const degreeInSign = lon % 30;
    const nak = getNakshatraAndSubs(lon);

    if (canonicalName === 'Ascendant') {
      ascSignIdx = signIndex;
    }

    const retroVal = row.isRetro ?? row.is_retrograde ?? row.retrograde;
    const isRetrograde =
      retroVal === true || retroVal === 'true' || retroVal === 'R' || retroVal === 1;

    mapped.push({
      name: canonicalName,
      longitude: Number(lon.toFixed(4)),
      signIndex,
      sign: SIGNS[signIndex],
      degreeInSign: Number(degreeInSign.toFixed(4)),
      dms: formatDMS(degreeInSign),
      nakshatra: nak.nakshatra,
      nakshatraIndex: nak.nakshatraIndex,
      nakshatraLord: nak.nakshatraLord,
      pada: nak.pada,
      subLord: nak.subLord,
      subSubLord: nak.subSubLord,
      isRetrograde,
      house: Number(row.house_number) || 1,
      dignity: getDignity(canonicalName, signIndex),
    });
  }

  // Ensure Whole-Sign house number relative to Ascendant is accurate
  const ascItem = mapped.find((p) => p.name === 'Ascendant');
  if (ascItem) {
    ascSignIdx = ascItem.signIndex;
  }

  return mapped.map((p) => ({
    ...p,
    house: ((p.signIndex - ascSignIdx + 12) % 12) + 1,
  }));
}

export async function fetchChartFromApi(payload: BirthApiPayload): Promise<{
  planets: PlanetPosition[];
  apiNavamsa?: unknown;
  apiDasamsa?: unknown;
  apiVimsottari?: unknown;
  apiShadBala?: unknown;
}> {
  const planetsRaw = await postAstrologyEndpoint('/planets/extended', payload as unknown as Record<string, unknown>);
  const planets = normalizeExtendedPlanets(planetsRaw);

  if (planets.length < 8) {
    throw new Error('FreeAstrologyAPI returned incomplete planetary positions.');
  }

  // Optional auxiliary endpoints (wrapped cleanly so deterministic JyotishMath covers any variation)
  let apiNavamsa: unknown = null;
  let apiDasamsa: unknown = null;
  let apiVimsottari: unknown = null;
  let apiShadBala: unknown = null;

  try {
    apiNavamsa = await postAstrologyEndpoint('/navamsa-chart-info', payload as unknown as Record<string, unknown>);
  } catch {
    apiNavamsa = null;
  }

  try {
    apiDasamsa = await postAstrologyEndpoint('/d10-chart-information', payload as unknown as Record<string, unknown>);
  } catch {
    apiDasamsa = null;
  }

  try {
    apiVimsottari = await postAstrologyEndpoint('/vimsottari/maha-dasas-and-antar-dasas', payload as unknown as Record<string, unknown>);
  } catch {
    apiVimsottari = null;
  }

  try {
    apiShadBala = await postAstrologyEndpoint('/shad-bala/summary', payload as unknown as Record<string, unknown>);
  } catch {
    apiShadBala = null;
  }

  return {
    planets,
    apiNavamsa,
    apiDasamsa,
    apiVimsottari,
    apiShadBala,
  };
}

let dailyTransitsMemoryCache: {
  transitDate: string;
  planets: PlanetPosition[];
  transitsText: string;
} | null = null;

// Global Daily Transit (Gochar) Cache — maximum 1 API call per UTC day across ALL users
export async function getOrFetchDailyTransits(): Promise<{
  transitDate: string;
  planets: PlanetPosition[];
  transitsText: string;
}> {
  const todayISO = new Date().toISOString().slice(0, 10);

  if (dailyTransitsMemoryCache && dailyTransitsMemoryCache.transitDate === todayISO) {
    return dailyTransitsMemoryCache;
  }

  const supabaseAdmin = getSupabaseAdmin();

  if (supabaseAdmin) {
    const { data: cached } = await supabaseAdmin
      .from('daily_transits')
      .select('transits_json, transits_text')
      .eq('transit_date', todayISO)
      .maybeSingle();

    if (cached) {
      dailyTransitsMemoryCache = {
        transitDate: todayISO,
        planets: cached.transits_json as PlanetPosition[],
        transitsText: cached.transits_text as string,
      };
      return dailyTransitsMemoryCache;
    }
  }

  const payload = buildApiPayload(todayISO, '12:00:00', 28.6139, 77.209, 5.5);
  const raw = await postAstrologyEndpoint('/planets/extended', payload as unknown as Record<string, unknown>);
  const planets = normalizeExtendedPlanets(raw).filter((p) => p.name !== 'Ascendant');

  const transitsText = [
    `GLOBAL GOCHAR (TRANSITS) FOR ${todayISO} (Sidereal Lahiri):`,
    ...planets.map(
      (p) =>
        `- ${p.name}: ${p.sign} ${p.dms} | ${p.nakshatra} (Pada ${p.pada})${p.isRetrograde ? ' [Retrograde]' : ''}`
    ),
  ].join('\n');

  if (supabaseAdmin) {
    await supabaseAdmin
      .from('daily_transits')
      .upsert(
        {
          transit_date: todayISO,
          transits_json: planets,
          transits_text: transitsText,
        },
        { onConflict: 'transit_date' }
      );
  }

  dailyTransitsMemoryCache = {
    transitDate: todayISO,
    planets,
    transitsText,
  };
  return dailyTransitsMemoryCache;
}
