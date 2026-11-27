import type { PlanetPosition } from '../jyotishMath';

export type AstrologyProviderId =
  | 'freeastrologyapi'
  | 'freeastroapi'
  | 'astroway'
  | 'astrology_api_io';

export type AstrologyProviderStatus =
  | 'production_default'
  | 'poc_adapter_ready'
  | 'pending_poc';

export interface AstrologyProviderCatalogEntry {
  id: AstrologyProviderId;
  label: string;
  envKeyName: string;
  baseUrl: string;
  status: AstrologyProviderStatus;
  supportsSwitch: boolean;
  summary: string;
}

export interface AstrologyProviderRuntimeInfo extends AstrologyProviderCatalogEntry {
  envConfigured: boolean;
}

export interface ProviderBirthLocationResolved {
  latitude: number;
  longitude: number;
  timezoneOffset: number;
  locationLabel: string;
}

export interface ProviderPlaceSuggestion {
  label: string;
  city: string;
  state: string | null;
  country: string;
  latitude: number;
  longitude: number;
  timezoneOffset: number;
}

export interface ProviderBirthInputPayload {
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

export interface ProviderChartFetchResult {
  planets: PlanetPosition[];
  apiShadBala?: unknown;
  apiWesternPlanets?: Array<{ name: string; longitude: number; isRetrograde?: boolean }> | null;
}
