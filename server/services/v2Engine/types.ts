/**
 * Isolated Foundational Calculation Engine V2 — Types & Contracts
 *
 * Strictly decoupled from production chartCompiler.ts, jyotishMath.ts indices,
 * Council/Companion prompts, and database mutations.
 */

export type BirthTimePrecision = 'exact' | 'approximate' | 'sunrise_unknown' | 'unknown';

export type TimezoneResolutionMethod =
  | 'explicit_iana_intl'
  | 'provider_geo_iana_intl'
  | 'explicit_historical_offset';

export interface CanonicalBirthInput {
  profileId?: string;
  name: string;
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:MM or HH:MM:SS
  latitude: number;
  longitude: number;
  city?: string;
  state?: string | null;
  country?: string;
  ianaTimezone?: string | null;
  explicitHistoricalUtcOffsetHours?: number | null;
  birthTimePrecision?: BirthTimePrecision;
  birthTimeUncertaintyMinutes?: number | null;
  nodeConvention?: 'mean' | 'true';
}

export interface UtcDateComponents {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface CanonicalBirthInstant {
  input: {
    profileId?: string;
    name: string;
    birthDate: string;
    birthTime: string;
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    latitude: number;
    longitude: number;
    city: string;
    state: string | null;
    country: string;
    birthTimePrecision: BirthTimePrecision;
    birthTimeUncertaintyMinutes: number | null;
    nodeConvention: 'mean' | 'true';
  };
  timezone: {
    ianaTimezone: string | null;
    resolutionMethod: TimezoneResolutionMethod;
    historicalUtcOffsetSeconds: number;
    historicalUtcOffsetHours: number;
    isDst: boolean;
    standardUtcOffsetSeconds: number;
    dstTransitionNote: string | null;
  };
  utc: {
    components: UtcDateComponents;
    iso: string;
    timestampMs: number;
    julianDayUt: number;
  };
  astronomy: {
    greenwichMeanSiderealTimeDeg: number;
    localMeanSiderealTimeDeg: number;
    meanObliquityDeg: number;
    lahiriAyanamsaApproxDeg: number;
    kpAyanamsaApproxDeg: number;
  };
  inputFingerprint: string;
}

export type V2EndpointId =
  | 'vedic_calculate'
  | 'vedic_kp'
  | 'western_natal'
  | 'ephemeris'
  | 'timezone_probe_mode_a'
  | 'timezone_probe_mode_b';

export interface SanitizedProviderCallRecord {
  id: V2EndpointId;
  endpoint: string;
  method: 'POST' | 'GET';
  timestampUtc: string;
  sanitizedRequest: Record<string, unknown>;
  httpStatus: number;
  ok: boolean;
  latencyMs: number;
  payloadBytes: number;
  quotaAndMetaHeaders: Record<string, string>;
  errorMessage?: string | null;
  rawResponse: unknown;
}

export interface TimezoneEquivalenceCheck {
  executed: boolean;
  modeARequest: Record<string, unknown>;
  modeBRequest: Record<string, unknown>;
  modeAStatus: number;
  modeBStatus: number;
  equivalent: boolean;
  maxPlanetDeltaDeg: number | null;
  ascendantDeltaDeg: number | null;
  moonDeltaDeg: number | null;
  perPlanetDeltasDeg: Array<{ planet: string; modeALon: number; modeBLon: number; deltaDeg: number }>;
  notes: string[];
}

export interface EphemerisTimestampCheck {
  requestedStart: string;
  requestedTzStr: string;
  returnedUtcInstant: string | null;
  returnedJulianDay: number | null;
  expectedUtcIso: string;
  expectedJulianDayUt: number;
  deltaSecondsFromCanonical: number | null;
  deltaJulianDay: number | null;
  exactTimestampMatch: boolean;
  limitationNotes: string[];
}

/**
 * Layer A — Raw Provider Record
 * Preserves complete original provider responses, sanitized requests, metadata,
 * latency, payload size, and quota headers without dropping or altering values.
 */
export interface LayerARawProviderRecord {
  schemaVersion: 'v2.raw.1.0';
  capturedAtUtc: string;
  providerId: 'freeastroapi';
  providerBaseUrl: string;
  inputFingerprint: string;
  canonicalUtcIso: string;
  canonicalJulianDayUt: number;
  calls: Record<string, SanitizedProviderCallRecord>;
  timezoneEquivalenceCheck?: TimezoneEquivalenceCheck | null;
  ephemerisTimestampCheck?: EphemerisTimestampCheck | null;
  quotaAndPerformanceSummary: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalLatencyMs: number;
    totalPayloadBytes: number;
  };
}

export type DatasetVerificationStatus =
  | 'verified_provider'
  | 'verified_equivalent'
  | 'cached_verified'
  | 'partial'
  | 'unavailable'
  | 'pending_live_reconciliation';

export type DatasetCompleteness = 'complete' | 'partial' | 'unavailable';

export interface DatasetEnvelope<T> {
  source: string;
  calculationMethod: string;
  version: string;
  conventions: Record<string, unknown>;
  inputFingerprint: string;
  completeness: DatasetCompleteness;
  verificationStatus: DatasetVerificationStatus;
  limitations: string[];
  data: T | null;
}

export interface VedicLahiriFrame {
  ayanamshaLabel: string;
  houseSystem: string;
  nodeType: string;
  timezoneUsed: string;
  ascendant: Record<string, unknown> | null;
  planets: Array<Record<string, unknown>>;
  houses: Array<Record<string, unknown>>;
  sadeSati: Record<string, unknown> | null;
  vargas: {
    supportedCount: number;
    divisionsReturned: string[];
    chartsByDivision: Record<string, Record<string, unknown>>;
  } | null;
  ashtakavarga: {
    sarvashtakavarga: number[];
    bhinnashtakavarga: Record<string, number[]>;
    prastharashtakavarga: Record<string, Record<string, number[]>>;
    totalPoints: number;
  } | null;
  yogas: {
    summary: Record<string, unknown> | null;
    items: Array<Record<string, unknown>>;
    metadata: Record<string, unknown> | null;
  } | null;
  panchang: Record<string, unknown> | null;
  vimshottariDasha: Record<string, unknown> | null;
  providerMetadata: Record<string, unknown> | null;
}

export interface KpPlacidusFrame {
  ayanamsha: {
    id: string;
    name: string;
    valueDegrees: number | null;
  };
  angles: Record<string, unknown> | null;
  ascendant: Record<string, unknown> | null;
  planets: Array<Record<string, unknown>>;
  cusps: Array<Record<string, unknown>>;
  cuspalSubLordTable: Array<Record<string, unknown>>;
  planetSignificators: Array<Record<string, unknown>>;
  houseSignificators: Array<Record<string, unknown>>;
  rulingPlanets: Record<string, unknown> | null;
  dasha: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

export interface BhavaChalitMethodologyAudit {
  providerHouseBasis: string | null;
  cuspIsMidpointStraddledByBoundaries: boolean;
  matchesClassicalSripatiWithin1Deg: boolean;
  maxDeltaVsSripatiCuspsDeg: number | null;
  allPlanetsMatchBoundaryContainment: boolean;
  compatibleWithIntendedClassicalMethodology: boolean;
  notes: string[];
}

export interface BhavaChalitFrame {
  chartType: string | null;
  name: string | null;
  calibrated: boolean | null;
  houseBasis: string | null;
  ascendant: Record<string, unknown> | null;
  houses: Array<Record<string, unknown>>;
  planets: Array<Record<string, unknown>>;
  methodologyAudit: BhavaChalitMethodologyAudit;
}

export interface WesternTropicalFrame {
  zodiacType: string;
  houseSystem: string;
  timeKnown: boolean | null;
  secondPrecisionDroppedByV1Endpoint: boolean;
  subject: Record<string, unknown> | null;
  resolvedTime: Record<string, unknown> | null;
  angles: Record<string, unknown> | null;
  anglesDetails: Record<string, unknown> | null;
  planets: Array<Record<string, unknown>>;
  houses: Array<Record<string, unknown>>;
  aspects: Array<Record<string, unknown>>;
  aspectsSummary: Record<string, unknown> | null;
  declinationAspects: Array<Record<string, unknown>>;
  declinationAspectsSummary: Record<string, unknown> | null;
  configurations: Record<string, unknown> | null;
  stelliums: Record<string, unknown> | null;
  dominants: Record<string, unknown> | null;
  dominantsProfile: Record<string, unknown> | null;
  tables: Record<string, unknown> | null;
}

export interface AstronomicalTelemetryFrame {
  zodiacType: string;
  siderealAyanamsa: string | null;
  timestamp: string | null;
  localTimestamp: string | null;
  resolvedTime: Record<string, unknown> | null;
  subjectSettings: Record<string, unknown> | null;
  bodies: Record<string, Record<string, unknown>>;
  astrology: Record<string, unknown> | null;
  angles: Record<string, unknown> | null;
  houses: Array<Record<string, unknown>> | null;
  timestampVerification: EphemerisTimestampCheck | null;
}

export interface ShadbalaPlanetComparison {
  planet: string;
  provider: {
    sthanaBala: number;
    digBala: number;
    kalaBala: number;
    cheshtaBala: number;
    naisargikaBala: number;
    drikBala: number;
    totalVirupas: number;
    rupas: number;
    requiredRupas: number;
    ratio: number;
    componentSumCheckDelta: number;
    rank: number;
  } | null;
  legacyLocal: {
    sthanaBala: number;
    digBala: number;
    kalaBala: number;
    chestaBala: number;
    naisargikaBala: number;
    drikBala: number;
    totalVirupas: number;
    rupas: number;
    requiredRupas: number;
    ratio: number;
    ishtaPhala: number;
    kashtaPhala: number;
    rank: number;
  } | null;
  independentReference: {
    naisargikaBalaBphs: number;
    uchchaBalaBphs: number;
    digBalaPlacidus: number;
    digBalaEqual90: number;
    pakshaBalaBphs: number | null;
    bphsClassicalRequiredRupas: number;
    providerSunAt5vs6_5RatioDelta: number | null;
    ishtaPhalaClassicalApprox: number | null;
    kashtaPhalaClassicalApprox: number | null;
  };
  deltas: {
    totalVirupasProviderMinusLocal: number | null;
    ratioProviderMinusLocal: number | null;
    digBalaProviderVsPlacidus: number | null;
    digBalaProviderVsEqual90: number | null;
  };
}

export interface ShadbalaReconciliationReport {
  authoritativeDesignation: 'unassigned_pending_reconciliation';
  designationPolicy: string;
  metadata: Record<string, unknown> | null;
  sunThresholdInvestigation: {
    providerMinRupasForSun: number | null;
    legacyLocalMinRupasForSun: number;
    classicalBphsMinRupasForSun: number;
    providerSunRupas: number | null;
    ratioAt5_0Threshold: number | null;
    ratioAt6_5Threshold: number | null;
    flipsPassFailStatus: boolean;
  };
  unavailableClassicalSubcomponents: string[];
  perPlanet: ShadbalaPlanetComparison[];
  rankingComparison: {
    providerOrder: string[];
    legacyLocalOrder: string[];
    rankDifferences: Array<{ planet: string; providerRank: number; localRank: number }>;
  };
}

export interface RemainingClassicalGapItem {
  capability: string;
  category: string;
  freeAstroApiStatus: 'unavailable' | 'partial_only';
  localDerivedStatus: 'verified_deterministic' | 'approximation_only' | 'unavailable';
  candidateProviders: Array<'AstroWay' | 'Astrology-API.io' | 'RoxyAPI'>;
  notes: string;
}

/**
 * Layer B — Master Chart Record
 * Normalized, frame-separated, provenance-tagged foundational record.
 */
export interface LayerBMasterChartRecord {
  schemaVersion: 'v2.master.1.0';
  generatedAtUtc: string;
  canonicalBirthInstant: CanonicalBirthInstant;
  frames: {
    vedicLahiri: DatasetEnvelope<VedicLahiriFrame>;
    kpPlacidus: DatasetEnvelope<KpPlacidusFrame>;
    bhavaChalit: DatasetEnvelope<BhavaChalitFrame>;
    westernTropical: DatasetEnvelope<WesternTropicalFrame>;
    astronomicalTelemetry: DatasetEnvelope<AstronomicalTelemetryFrame>;
  };
  shadbalaReconciliation: DatasetEnvelope<ShadbalaReconciliationReport>;
  remainingClassicalGaps: RemainingClassicalGapItem[];
}

/**
 * Layer C — CosmicCouncil Analytical Record (Strict Separation Shell)
 * Proprietary indices (PHI, YSI, DSI, etc.) remain untouched in this phase.
 */
export interface LayerCAnalyticalShell {
  schemaVersion: 'v2.analytical_shell.1.0';
  linkedMasterFingerprint: string;
  linkedMasterSchemaVersion: string;
  status: 'deferred_by_scope';
  note: string;
  touchedIndices: [];
}

export interface VerificationCheckResult {
  id: string;
  domain: string;
  passed: boolean;
  severity: 'critical' | 'major' | 'info';
  expected: string;
  observed: string;
  notes?: string;
}

export interface MathematicalVerificationReport {
  profileName: string;
  inputFingerprint: string;
  mode: 'live_and_offline' | 'offline_only';
  passedCount: number;
  failedCount: number;
  checks: VerificationCheckResult[];
}

export interface ProfileDefectAssessment {
  identifier: string;
  name: string;
  providerRecorded: string | null;
  affected: boolean;
  severity: 'critical' | 'moderate' | 'clean';
  defects: string[];
  downstreamArtifactsToRegenerate: string[];
}
