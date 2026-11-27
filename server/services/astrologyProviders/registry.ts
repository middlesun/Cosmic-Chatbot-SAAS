import type {
  AstrologyProviderCatalogEntry,
  AstrologyProviderId,
  AstrologyProviderRuntimeInfo,
} from './types';

export const DEFAULT_ASTROLOGY_PROVIDER: AstrologyProviderId = 'freeastrologyapi';

export const ASTROLOGY_PROVIDER_CATALOG: readonly AstrologyProviderCatalogEntry[] = [
  {
    id: 'freeastrologyapi',
    label: 'FreeAstrologyAPI (Production Default)',
    envKeyName: 'FREE_ASTROLOGY_API_KEY',
    baseUrl: 'https://json.freeastrologyapi.com',
    status: 'production_default',
    supportsSwitch: true,
    summary: 'Existing production provider for /planets/extended, geo, timezone, Shadbala summary, and Western planets.',
  },
  {
    id: 'freeastroapi',
    label: 'FreeAstroAPI V2 (French Ephemeris)',
    envKeyName: 'FREE_ASTRO_API_KEY',
    baseUrl: 'https://api.freeastroapi.com',
    status: 'poc_adapter_ready',
    supportsSwitch: true,
    summary: 'DE441/DE442 FrenchEphemeris adapter supporting /v2/vedic/calculate, /v2/geo/search, and /v1/natal/calculate.',
  },
  {
    id: 'astroway',
    label: 'AstroWay (Pending PoC)',
    envKeyName: 'ASTROWAY_API_KEY',
    baseUrl: 'https://api.astroway.info',
    status: 'pending_poc',
    supportsSwitch: false,
    summary: 'Planned evaluation candidate for detailed Shadbala subcomponents, Bhavabala, Vimshopaka, Jaimini, and Hellenistic.',
  },
  {
    id: 'astrology_api_io',
    label: 'Astrology-API.io (Pending PoC)',
    envKeyName: 'ASTROLOGY_API_IO_KEY',
    baseUrl: 'https://api.astrology-api.io',
    status: 'pending_poc',
    supportsSwitch: false,
    summary: 'Planned evaluation candidate for unified Vedic and Western comparison benchmark.',
  },
] as const;

export const SWITCHABLE_ASTROLOGY_PROVIDERS: readonly AstrologyProviderId[] = ASTROLOGY_PROVIDER_CATALOG
  .filter((entry) => entry.supportsSwitch)
  .map((entry) => entry.id);

export function normalizeAstrologyProviderId(
  raw: unknown,
  fallback: AstrologyProviderId = DEFAULT_ASTROLOGY_PROVIDER
): AstrologyProviderId {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.trim().toLowerCase();
  const match = ASTROLOGY_PROVIDER_CATALOG.find(
    (entry) => entry.id === cleaned && entry.supportsSwitch
  );
  return match ? match.id : fallback;
}

export function getAstrologyProviderCatalogEntry(
  id: AstrologyProviderId
): AstrologyProviderCatalogEntry {
  return (
    ASTROLOGY_PROVIDER_CATALOG.find((entry) => entry.id === id) ||
    ASTROLOGY_PROVIDER_CATALOG[0]
  );
}

export function isAstrologyProviderEnvConfigured(id: AstrologyProviderId): boolean {
  const entry = getAstrologyProviderCatalogEntry(id);
  return Boolean((process.env[entry.envKeyName] || '').trim());
}

export function listAstrologyProviderStatuses(): AstrologyProviderRuntimeInfo[] {
  return ASTROLOGY_PROVIDER_CATALOG.map((entry) => ({
    ...entry,
    envConfigured: Boolean((process.env[entry.envKeyName] || '').trim()),
  }));
}

let activeAstrologyProviderSync: AstrologyProviderId = DEFAULT_ASTROLOGY_PROVIDER;

export function setActiveAstrologyProviderSync(id: AstrologyProviderId): void {
  activeAstrologyProviderSync = normalizeAstrologyProviderId(id, DEFAULT_ASTROLOGY_PROVIDER);
}

export function getActiveAstrologyProviderSync(): AstrologyProviderId {
  return activeAstrologyProviderSync;
}
