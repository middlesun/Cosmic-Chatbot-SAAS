// Rate-limited FreeAstrologyAPI client (1 req/sec safe queue on free developer tier)
// Handles Geo Location, Timezone with DST, Planets Extended, Vargas, Vimsottari, Shad Bala, and Daily Gochar cache.

import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import {
  computeDeterministicSiderealPlanets,
  computeSlowPlanetTransitPairs,
  computeWesternDailyTransits,
  formatDMS,
  getDignity,
  getNakshatraAndSubs,
  normalizeDeg,
  SIGNS,
  type PlanetPosition,
  type SlowPlanetTransitPair,
  type WesternPlanetPosition,
} from './jyotishMath';

import {
  getActiveAstrologyProviderSync,
  isAstrologyProviderEnvConfigured,
} from './astrologyProviders/registry';
import {
  fetchChartFreeAstroApi,
  fetchDailyTransitPlanetsFreeAstroApi,
  geocodeBirthLocationFreeAstroApi,
  isFreeAstroApiConfigured,
  resolveHistoricalTimezoneOffsetFreeAstroApi,
  searchBirthPlacesFreeAstroApi,
} from './astrologyProviders/freeAstroApiAdapter';
import { getBirthChartConversionConfig } from './platformSettings';

const BASE_URL = 'https://json.freeastrologyapi.com';
const RATE_LIMIT_INTERVAL_MS = Number(process.env.FREE_ASTROLOGY_RATE_MS) || 1100;

let queueTail: Promise<unknown> = Promise.resolve();
let lastRequestTime = 0;

export function isAstrologyApiConfigured(): boolean {
  const active = getActiveAstrologyProviderSync();
  return isAstrologyProviderEnvConfigured(active);
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
  timezone?: string;
}

const placeSearchCache = new Map<string, { expiresAt: number; places: PlaceSuggestion[] }>();
const PLACE_CACHE_TTL_MS = 10 * 60 * 1000;
const coordTzCache = new Map<string, { expiresAt: number; timezone: string; offsetHours: number }>();

function computeZoneOffsetHours(
  ianaZone: string,
  dateISO: string,
  timeStr: string,
  fallbackOffset: number
): number {
  try {
    const [year, month, day] = dateISO.split('-').map(Number);
    const [hour = 12, minute = 0, second = 0] = timeStr.split(':').map(Number);
    const utcGuess = new Date(Date.UTC(year || 2000, (month || 1) - 1, day || 1, hour, minute, second));
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

async function fetchJsonWithTimeout<T = unknown>(
  url: string,
  headers?: Record<string, string>,
  timeoutMs = 3500
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', ...(headers || {}) },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function lookupTimezoneByCoords(
  lat: number,
  lon: number,
  dateISO?: string,
  timeStr?: string
): Promise<{ timezone: string; offsetHours: number } | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = coordTzCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    const offsetHours =
      dateISO && timeStr
        ? computeZoneOffsetHours(cached.timezone, dateISO, timeStr, cached.offsetHours)
        : cached.offsetHours;
    return { timezone: cached.timezone, offsetHours };
  }

  const data = await fetchJsonWithTimeout<{
    timezone?: string;
    utc_offset_seconds?: number;
  }>(
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
      lat.toFixed(4)
    )}&longitude=${encodeURIComponent(lon.toFixed(4))}&timezone=auto&forecast_days=1`,
    undefined,
    3000
  );

  if (!data || typeof data.timezone !== 'string' || !data.timezone) {
    return null;
  }

  const baseOffset =
    typeof data.utc_offset_seconds === 'number' && Number.isFinite(data.utc_offset_seconds)
      ? Number((data.utc_offset_seconds / 3600).toFixed(4))
      : computeZoneOffsetHours(
          data.timezone,
          new Date().toISOString().slice(0, 10),
          '12:00:00',
          0
        );

  if (coordTzCache.size > 300) {
    const oldest = coordTzCache.keys().next().value;
    if (oldest) coordTzCache.delete(oldest);
  }
  coordTzCache.set(key, {
    expiresAt: Date.now() + 60 * 60 * 1000,
    timezone: data.timezone,
    offsetHours: baseOffset,
  });

  const offsetHours =
    dateISO && timeStr
      ? computeZoneOffsetHours(data.timezone, dateISO, timeStr, baseOffset)
      : baseOffset;

  return { timezone: data.timezone, offsetHours };
}

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

const HISTORICAL_CITY_ALIASES: Record<string, string> = {
  calcutta: 'Kolkata',
  allahabad: 'Prayagraj',
  bombay: 'Mumbai',
  madras: 'Chennai',
  benares: 'Varanasi',
  banaras: 'Varanasi',
  trivandrum: 'Thiruvananthapuram',
  bangalore: 'Bengaluru',
  gurgaon: 'Gurugram',
  baroda: 'Vadodara',
  poona: 'Pune',
  cawnpore: 'Kanpur',
  pondicherry: 'Puducherry',
  cochin: 'Kochi',
  calicut: 'Kozhikode',
  gauhati: 'Guwahati',
  mysore: 'Mysuru',
  mangalore: 'Mangaluru',
  simla: 'Shimla',
  burdwan: 'Bardhaman',
};

async function searchOpenMeteoPlaces(query: string): Promise<PlaceSuggestion[]> {
  const parts = query
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const rawCityToken = parts[0] || query;
  const canonicalAlias = HISTORICAL_CITY_ALIASES[rawCityToken.toLowerCase()];
  const cityToken = canonicalAlias || rawCityToken;
  const qualifiers = parts.slice(1).map((q) => q.toLowerCase());

  const data = await fetchJsonWithTimeout<{
    results?: Array<{
      name?: string;
      latitude?: number;
      longitude?: number;
      country?: string;
      admin1?: string;
      admin2?: string;
      timezone?: string;
      population?: number;
    }>;
  }>(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      cityToken
    )}&count=10&language=en&format=json`
  );

  const rows = Array.isArray(data?.results) ? data.results : [];
  if (rows.length === 0) return [];

  const todayISO = new Date().toISOString().slice(0, 10);
  const scored = rows
    .filter(
      (r) =>
        typeof r.latitude === 'number' &&
        typeof r.longitude === 'number' &&
        typeof r.name === 'string'
    )
    .map((r) => {
      const city = String(r.name || cityToken).trim();
      const state = typeof r.admin1 === 'string' && r.admin1.trim() ? r.admin1.trim() : null;
      const country = typeof r.country === 'string' && r.country.trim() ? r.country.trim() : '';
      const haystack = `${city} ${state || ''} ${r.admin2 || ''} ${country}`.toLowerCase();
      const qualifierMatches = qualifiers.filter((q) => haystack.includes(q)).length;
      const tz = typeof r.timezone === 'string' && r.timezone ? r.timezone : undefined;
      const tzOffset = tz ? computeZoneOffsetHours(tz, todayISO, '12:00:00', 0) : 0;
      const label = [city, state, country].filter(Boolean).join(', ');
      return {
        score: qualifierMatches * 1_000_000_000 + Number(r.population || 0),
        suggestion: {
          label,
          city,
          state,
          country: country || 'India',
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          timezoneOffset: tzOffset,
          ...(tz ? { timezone: tz } : {}),
        } satisfies PlaceSuggestion,
      };
    });

  if (qualifiers.length > 0) {
    const matched = scored.filter((s) => s.score >= 1_000_000_000);
    if (matched.length > 0) {
      return matched.sort((a, b) => b.score - a.score).map((s) => s.suggestion);
    }
  }

  return scored.sort((a, b) => b.score - a.score).map((s) => s.suggestion);
}

const PHOTON_ALLOWED_OSM_VALUES = new Set([
  'city',
  'town',
  'village',
  'hamlet',
  'suburb',
  'borough',
  'municipality',
  'county',
  'state_district',
  'district',
  'administrative',
]);

async function searchPhotonPlaces(query: string): Promise<PlaceSuggestion[]> {
  const data = await fetchJsonWithTimeout<{
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: {
        name?: string;
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        state?: string;
        country?: string;
        osm_key?: string;
        osm_value?: string;
        type?: string;
      };
    }>;
  }>(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10&lang=en`);

  const features = Array.isArray(data?.features) ? data.features : [];
  const ranked: Array<{ rank: number; suggestion: PlaceSuggestion }> = [];

  for (const feat of features) {
    const coords = feat.geometry?.coordinates;
    const props = feat.properties;
    if (!coords || coords.length < 2 || !props) continue;
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

    const osmVal = String(props.osm_value || props.type || '').toLowerCase();
    const osmKey = String(props.osm_key || '').toLowerCase();
    if (
      osmKey &&
      osmKey !== 'place' &&
      osmKey !== 'boundary' &&
      !PHOTON_ALLOWED_OSM_VALUES.has(osmVal)
    ) {
      continue;
    }

    const city = String(
      props.city || props.town || props.village || props.name || query
    ).trim();
    const state = typeof props.state === 'string' && props.state.trim() ? props.state.trim() : null;
    const country =
      typeof props.country === 'string' && props.country.trim() ? props.country.trim() : '';
    if (!city || !country) continue;

    const label = [city, state, country].filter(Boolean).join(', ');
    const isSettlement =
      osmKey === 'place' ||
      osmVal === 'city' ||
      osmVal === 'town' ||
      osmVal === 'village' ||
      osmVal === 'municipality';
    const rank = isSettlement ? 2 : osmVal === 'administrative' || osmVal === 'county' ? 1 : 0;

    ranked.push({
      rank,
      suggestion: {
        label,
        city,
        state,
        country,
        latitude: lat,
        longitude: lon,
        timezoneOffset: Math.round((lon / 15) * 2) / 2,
      },
    });
  }

  return ranked.sort((a, b) => b.rank - a.rank).map((r) => r.suggestion);
}

async function searchNominatimPlaces(query: string): Promise<PlaceSuggestion[]> {
  const rows = await fetchJsonWithTimeout<
    Array<{
      lat?: string;
      lon?: string;
      name?: string;
      display_name?: string;
      address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        county?: string;
        state_district?: string;
        state?: string;
        country?: string;
      };
    }>
  >(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(
      query
    )}`,
    { 'User-Agent': 'CosmicCouncil/1.0 (https://cosmiccouncil.chat)' }
  );

  if (!Array.isArray(rows) || rows.length === 0) return [];

  const results: PlaceSuggestion[] = [];
  for (const row of rows) {
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
    const addr = row.address || {};
    const city = String(
      addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        row.name ||
        addr.county ||
        addr.state_district ||
        query
    ).trim();
    const state = typeof addr.state === 'string' && addr.state.trim() ? addr.state.trim() : null;
    const country =
      typeof addr.country === 'string' && addr.country.trim() ? addr.country.trim() : 'India';
    const label = [city, state, country].filter(Boolean).join(', ');
    results.push({
      label,
      city,
      state,
      country,
      latitude: lat,
      longitude: lon,
      timezoneOffset: Math.round((lon / 15) * 2) / 2,
    });
  }
  return results;
}

async function searchProviderPlacesFallback(query: string): Promise<PlaceSuggestion[]> {
  try {
    const cfg = await getBirthChartConversionConfig();
    if (cfg.astrology_provider === 'freeastroapi' && isFreeAstroApiConfigured()) {
      return await searchBirthPlacesFreeAstroApi(query);
    }
    if (!process.env.FREE_ASTROLOGY_API_KEY) return [];
    const geoResp = await postAstrologyEndpoint<unknown[]>('/geo-details', {
      location: query,
    });
    const rows = Array.isArray(geoResp) ? geoResp : [];
    const places: PlaceSuggestion[] = [];
    for (const item of rows) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const lat = Number(obj.latitude);
      const lon = Number(obj.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
      const label = String(obj.complete_name || obj.location_name || obj.name || query).trim();
      const parsed = parsePlaceParts(label, query);
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
    return places;
  } catch {
    return [];
  }
}

function mergeUniquePlaces(lists: PlaceSuggestion[][], limit = 6): PlaceSuggestion[] {
  const seen = new Set<string>();
  const out: PlaceSuggestion[] = [];

  for (const list of lists) {
    for (const item of list) {
      const coordBucket = `${item.city.toLowerCase()}::${item.latitude.toFixed(1)}:${item.longitude.toFixed(1)}`;
      const labelKey = item.label.toLowerCase();
      if (seen.has(coordBucket) || seen.has(labelKey)) continue;
      seen.add(coordBucket);
      seen.add(labelKey);
      out.push(item);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export async function searchBirthPlaces(query: string): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const cacheKey = trimmed.toLowerCase();
  const cached = placeSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.places;
  }

  const [openMeteoRes, photonRes] = await Promise.allSettled([
    searchOpenMeteoPlaces(trimmed),
    searchPhotonPlaces(trimmed),
  ]);

  const openMeteoList = openMeteoRes.status === 'fulfilled' ? openMeteoRes.value : [];
  const photonList = photonRes.status === 'fulfilled' ? photonRes.value : [];

  let places = mergeUniquePlaces([openMeteoList, photonList], 6);

  if (places.length === 0) {
    const nominatimList = await searchNominatimPlaces(trimmed);
    places = mergeUniquePlaces([nominatimList], 6);
  }

  if (places.length === 0) {
    const providerList = await searchProviderPlacesFallback(trimmed);
    places = mergeUniquePlaces([providerList], 6);
  }

  // Enrich any suggestions missing an IANA timezone so Current Location / Birth Place offsets are exact
  await Promise.all(
    places.map(async (p) => {
      if (p.timezone) return;
      const tzInfo = await lookupTimezoneByCoords(p.latitude, p.longitude);
      if (tzInfo) {
        p.timezone = tzInfo.timezone;
        p.timezoneOffset = tzInfo.offsetHours;
      }
    })
  );

  if (places.length > 0) {
    if (placeSearchCache.size > 200) {
      const oldestKey = placeSearchCache.keys().next().value;
      if (oldestKey) placeSearchCache.delete(oldestKey);
    }
    placeSearchCache.set(cacheKey, {
      expiresAt: Date.now() + PLACE_CACHE_TTL_MS,
      places,
    });
  }

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
  const cfg = await getBirthChartConversionConfig();
  if (cfg.astrology_provider === 'freeastroapi') {
    const resolved = await resolveHistoricalTimezoneOffsetFreeAstroApi(
      lat,
      lon,
      birthDateISO,
      birthTimeStr,
      fallbackOffset,
      tzName
    );
    if (resolved !== 0 || fallbackOffset === 0) return resolved;
  }

  const [year, month, date] = birthDateISO.split('-').map(Number);
  const [hours, minutes] = birthTimeStr.split(':').map(Number);

  if (process.env.FREE_ASTROLOGY_API_KEY) {
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
        tzResp?.timezone_offset ?? tzResp?.offset ?? tzResp?.gmt_offset ?? NaN
      );
      if (!Number.isNaN(parsedOffset)) {
        return parsedOffset;
      }
    } catch {
      // Fall through to IANA / Open-Meteo coordinate timezone lookup
    }
  }

  if (tzName && !tzName.startsWith('UTC')) {
    return computeZoneOffsetHours(tzName, birthDateISO, birthTimeStr, fallbackOffset);
  }

  const coordTz = await lookupTimezoneByCoords(lat, lon, birthDateISO, birthTimeStr);
  if (coordTz) {
    return coordTz.offsetHours;
  }

  return fallbackOffset;
}

export async function geocodeBirthLocation(
  city: string,
  state: string | null | undefined,
  country: string,
  birthDateISO: string,
  birthTimeStr: string
): Promise<BirthLocationResolved> {
  const cfg = await getBirthChartConversionConfig();
  if (cfg.astrology_provider === 'freeastroapi') {
    try {
      return await geocodeBirthLocationFreeAstroApi(city, state, country, birthDateISO, birthTimeStr);
    } catch {
      // Fall through to resilient multi-source geocoder
    }
  }

  const query = [city, state, country].filter(Boolean).join(', ');
  if (process.env.FREE_ASTROLOGY_API_KEY) {
    try {
      const geoResp = await postAstrologyEndpoint<unknown[]>('/geo-details', {
        location: query,
      });

      const first = Array.isArray(geoResp)
        ? (geoResp[0] as Record<string, unknown> | undefined)
        : undefined;
      if (first && typeof first.latitude === 'number' && typeof first.longitude === 'number') {
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
    } catch {
      // Fall through to resilient multi-source geocoder
    }
  }

  // Fallback to multi-source geocoder (Open-Meteo + Photon + Nominatim)
  const fallbackPlaces = await searchBirthPlaces(query);
  const match = fallbackPlaces[0];
  if (!match) {
    throw new Error(
      `Could not find birth place "${query}". Try adding the state or country (for example, "Pune, Maharashtra, India").`
    );
  }

  const tzOffset = await resolveHistoricalTimezoneOffset(
    match.latitude,
    match.longitude,
    birthDateISO,
    birthTimeStr,
    match.timezoneOffset,
    match.timezone
  );

  return {
    latitude: match.latitude,
    longitude: match.longitude,
    timezoneOffset: tzOffset,
    locationLabel: match.label,
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
  tz: number,
  options?: {
    observationPoint?: 'topocentric' | 'geocentric';
  }
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
      observation_point: options?.observationPoint === 'topocentric' ? 'topocentric' : 'geocentric',
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

function parseWesternApiPlanets(
  raw: unknown
): Array<{ name: string; longitude: number; isRetrograde?: boolean }> {
  const root = raw as Record<string, unknown>;
  const list = Array.isArray(root?.output)
    ? root.output
    : Array.isArray(root)
    ? root
    : [];

  const result: Array<{ name: string; longitude: number; isRetrograde?: boolean }> = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const rawName = String(obj.planet?.toString() || obj.name || obj.planet_name || '').trim();
    const lon = Number(obj.fullDegree ?? obj.longitude ?? obj.normDegree ?? NaN);
    if (!rawName || Number.isNaN(lon)) continue;
    const retroRaw = obj.isRetro ?? obj.is_retrograde ?? obj.retrograde;
    result.push({
      name: rawName,
      longitude: normalizeDeg(lon),
      isRetrograde: retroRaw === true || retroRaw === 'true' || retroRaw === 'R' || retroRaw === 1,
    });
  }
  return result;
}

export async function fetchChartFromApi(
  payload: BirthApiPayload,
  options?: {
    fetchApiShadBala?: boolean;
    fetchApiWesternPlanets?: boolean;
    westernHouseSystem?: 'Placidus' | 'Whole Sign';
  }
): Promise<{
  planets: PlanetPosition[];
  apiShadBala?: unknown;
  apiWesternPlanets?: Array<{ name: string; longitude: number; isRetrograde?: boolean }> | null;
}> {
  const cfg = await getBirthChartConversionConfig();
  if (cfg.astrology_provider === 'freeastroapi') {
    return fetchChartFreeAstroApi(payload, options);
  }

  const planetsRaw = await postAstrologyEndpoint('/planets/extended', payload as unknown as Record<string, unknown>);
  const planets = normalizeExtendedPlanets(planetsRaw);

  if (planets.length < 8) {
    throw new Error('FreeAstrologyAPI returned incomplete planetary positions.');
  }

  // Optional auxiliary endpoints (deterministic JyotishMath & Meeus calculators cover any gaps cleanly)
  let apiShadBala: unknown = null;
  let apiWesternPlanets: Array<{ name: string; longitude: number; isRetrograde?: boolean }> | null = null;

  if (options?.fetchApiShadBala !== false) {
    try {
      apiShadBala = await postAstrologyEndpoint('/shad-bala/summary', payload as unknown as Record<string, unknown>, 0);
    } catch {
      apiShadBala = null;
    }
  }

  if (options?.fetchApiWesternPlanets !== false) {
    try {
      const westernPayload = {
        year: payload.year,
        month: payload.month,
        date: payload.date,
        hours: payload.hours,
        minutes: payload.minutes,
        seconds: payload.seconds,
        latitude: payload.latitude,
        longitude: payload.longitude,
        timezone: payload.timezone,
        config: {
          observation_point: payload.config.observation_point || 'geocentric',
          house_system: options?.westernHouseSystem === 'Whole Sign' ? 'Whole Sign' : 'Placidus',
          language: 'en',
        },
      };
      const westernRaw = await postAstrologyEndpoint('/western/planets', westernPayload, 0);
      const parsed = parseWesternApiPlanets(westernRaw);
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

let dailyTransitsMemoryCache: {
  transitDate: string;
  planets: PlanetPosition[];
  transitsText: string;
  slowTransitPairs: SlowPlanetTransitPair[];
  upcomingTransitionsText: string;
  westernPlanets: WesternPlanetPosition[];
  westernTransitsText: string;
} | null = null;

function buildUpcomingTransitionsText(pairs: SlowPlanetTransitPair[]): string {
  return [
    'SLOW-PLANET SIGN TRANSIT WINDOWS (Estimated Sidereal Lahiri):',
    ...pairs.map(
      (p) =>
        `- ${p.planet}: currently ${p.currentSign} (${p.currentDegreeInSign.toFixed(1)}°${p.isRetrograde ? ' Rx' : ''}${p.currentSignEntryApproxDate ? `, entered ~${p.currentSignEntryApproxDate}` : ''}) -> next enters ${p.nextSign} (${p.direction}) around ${p.nextIngressApproxDate} (~${p.daysUntilIngress}d)`
    ),
  ].join('\n');
}

function buildWesternTransitsText(westernPlanets: WesternPlanetPosition[], dateISO: string): string {
  return [
    `GLOBAL WESTERN TRANSITS FOR ${dateISO} (Tropical Zodiac):`,
    ...westernPlanets.map(
      (p) => `- ${p.name}: ${p.sign} ${p.dms}${p.isRetrograde ? ' [Rx]' : ''}`
    ),
  ].join('\n');
}

// Global Daily Transit (Gochar + Western Tropical) Cache — maximum 1 API call per UTC day across ALL users
export async function getOrFetchDailyTransits(): Promise<{
  transitDate: string;
  planets: PlanetPosition[];
  transitsText: string;
  slowTransitPairs: SlowPlanetTransitPair[];
  upcomingTransitionsText: string;
  westernPlanets: WesternPlanetPosition[];
  westernTransitsText: string;
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

    if (
      cached &&
      Array.isArray(cached.transits_json) &&
      cached.transits_json.length > 0 &&
      typeof cached.transits_text === 'string' &&
      cached.transits_text.trim().length > 0
    ) {
      const planets = cached.transits_json as PlanetPosition[];
      const slowTransitPairs = computeSlowPlanetTransitPairs(planets, todayISO);
      const upcomingTransitionsText = buildUpcomingTransitionsText(slowTransitPairs);
      const westernPlanets = computeWesternDailyTransits(planets, todayISO);
      dailyTransitsMemoryCache = {
        transitDate: todayISO,
        planets,
        transitsText: cached.transits_text as string,
        slowTransitPairs,
        upcomingTransitionsText,
        westernPlanets,
        westernTransitsText: buildWesternTransitsText(westernPlanets, todayISO),
      };
      return dailyTransitsMemoryCache;
    }
  }

  let planets: PlanetPosition[] | null = null;
  let fetchedFromApi = false;

  const cfg = await getBirthChartConversionConfig().catch(() => null);
  const activeProvider = cfg?.astrology_provider || getActiveAstrologyProviderSync();

  if (activeProvider === 'freeastroapi' && isFreeAstroApiConfigured()) {
    try {
      const parsed = await fetchDailyTransitPlanetsFreeAstroApi(todayISO);
      if (parsed.length > 0) {
        planets = parsed;
        fetchedFromApi = true;
      }
    } catch (err) {
      console.warn(
        '[astrologyApi] FreeAstroAPI daily transits fetch failed; using deterministic Sidereal Lahiri ephemeris fallback:',
        err instanceof Error ? err.message : err
      );
    }
  } else if (isAstrologyApiConfigured()) {
    try {
      const payload = buildApiPayload(todayISO, '12:00:00', 28.6139, 77.209, 5.5);
      const raw = await postAstrologyEndpoint(
        '/planets/extended',
        payload as unknown as Record<string, unknown>
      );
      const parsed = normalizeExtendedPlanets(raw).filter((p) => p.name !== 'Ascendant');
      if (parsed.length > 0) {
        planets = parsed;
        fetchedFromApi = true;
      }
    } catch (err) {
      console.warn(
        '[astrologyApi] Daily transits API fetch failed; using deterministic Sidereal Lahiri ephemeris fallback:',
        err instanceof Error ? err.message : err
      );
    }
  }

  if (!planets) {
    planets = computeDeterministicSiderealPlanets(todayISO);
  }

  const slowTransitPairs = computeSlowPlanetTransitPairs(planets, todayISO);
  const upcomingTransitionsText = buildUpcomingTransitionsText(slowTransitPairs);

  const transitsText = [
    `GLOBAL GOCHAR (TRANSITS) FOR ${todayISO} (Sidereal Lahiri${fetchedFromApi ? '' : ' — Ephemeris'}):`,
    ...planets.map(
      (p) =>
        `- ${p.name}: ${p.sign} ${p.dms} | ${p.nakshatra} (Pada ${p.pada})${p.isRetrograde ? ' [Retrograde]' : ''}`
    ),
    '',
    upcomingTransitionsText,
  ].join('\n');

  const westernPlanets = computeWesternDailyTransits(planets, todayISO);
  const westernTransitsText = buildWesternTransitsText(westernPlanets, todayISO);

  if (supabaseAdmin && fetchedFromApi) {
    try {
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
    } catch {
      // Non-fatal DB cache write failure
    }
  }

  dailyTransitsMemoryCache = {
    transitDate: todayISO,
    planets,
    transitsText,
    slowTransitPairs,
    upcomingTransitionsText,
    westernPlanets,
    westernTransitsText,
  };
  return dailyTransitsMemoryCache;
}
