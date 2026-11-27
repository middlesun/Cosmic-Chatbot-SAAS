/**
 * Isolated Foundational Calculation Engine V2 — Types & Contracts
 *
 * Strictly decoupled from production chartCompiler.ts, jyotishMath.ts indices,
 * Council/Companion prompts, and database mutations.
 */

export type BirthTimePrecision = 'exact' | 'approximate' | 'sunrise_unknown' | 'unknown';

export type DstFoldDisambiguation = 'earlier_occurrence' | 'later_occurrence';

export type TimezoneResolutionMethod =
  | 'explicit_iana_intl'
  | 'provider_geo_iana_intl'
  | 'coord_lookup_iana_intl'
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
  dstFoldDisambiguation?: DstFoldDisambiguation;
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
    dstFoldDisambiguationUsed?: DstFoldDisambiguation | null;
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

export type V2DiagnosticProviderId = 'freeastroapi' | 'astroway';

export type V2EndpointId =
  | 'vedic_calculate'
  | 'vedic_kp'
  | 'western_natal'
  | 'ephemeris'
  | 'timezone_probe_mode_a'
  | 'timezone_probe_mode_b'
  | (string & {});

export interface SanitizedProviderCallRecord {
  id: V2EndpointId;
  endpoint: string;
  method: 'POST' | 'GET';
  timestampUtc: string;
  sanitizedRequest: Record<string, unknown>;
  httpStatus: number;
  ok: boolean;
  attempts: number;
  rateWaitMs: number;
  coordinationMode: 'global_supabase_cas' | 'isolate_memory_only';
  latencyMs: number;
  payloadBytes: number;
  quotaAndMetaHeaders: Record<string, string>;
  errorMessage?: string | null;
  category?: string;
  declaredQuality?: 'green' | 'yellow' | 'red';
  qualityCaveat?: string | null;
  accessRestricted?: boolean;
  creditsUsed?: number | null;
  rawResponse: unknown;
}

export interface ShadbalaModeDeltaRow {
  planet: string;
  modeATotal: number;
  modeBTotal: number;
  totalDelta: number;
  modeARatio: number | null;
  modeBRatio: number | null;
  componentDeltas: {
    sthana_bala: number;
    dig_bala: number;
    kala_bala: number;
    cheshta_bala: number;
    naisargika_bala: number;
    drik_bala: number;
  };
  subcomponentDeltas?: Record<string, number>;
  suspectedKalaBalaDriver: string | null;
}

export interface TimezoneEquivalenceCheck {
  executed: boolean;
  modeARequest: Record<string, unknown>;
  modeBRequest: Record<string, unknown>;
  modeAStatus: number;
  modeBStatus: number;
  equivalent: boolean;
  coordinatesEquivalent: boolean;
  maxPlanetDeltaDeg: number | null;
  ascendantDeltaDeg: number | null;
  moonDeltaDeg: number | null;
  perPlanetDeltasDeg: Array<{ planet: string; modeALon: number; modeBLon: number; deltaDeg: number }>;
  shadbalaComparison?: {
    available: boolean;
    equivalent: boolean;
    maxTotalDeltaVirupas: number | null;
    maxComponentDeltaVirupas: number | null;
    perPlanet: ShadbalaModeDeltaRow[];
  };
  bhavaChalitEquivalent?: boolean | null;
  bhavaChalitMaxCuspDeltaDeg?: number | null;
  bhavaChalitHouseMismatches?: string[];
  ashtakavargaEquivalent?: boolean | null;
  ashtakavargaSavDiffs?: number[];
  ashtakavargaBavMismatches?: string[];
  vargasEquivalent?: boolean | null;
  vargasMismatches?: string[];
  yogasEquivalent?: boolean | null;
  yogasMismatches?: string[];
  dashaEquivalent?: boolean | null;
  dashaMismatches?: string[];
  dashaAudit?: {
    available: boolean;
    birthBalanceLordMatch: boolean;
    birthBalanceRemainingYearsModeA: number | null;
    birthBalanceRemainingYearsModeB: number | null;
    birthBalanceRemainingYearsDelta: number | null;
    birthBalanceElapsedYearsDelta: number | null;
    isSingleCalendarDayRolloverBalanceArtifact: boolean;
    calendarDateRolloverShifts: string[];
    durationMismatches: string[];
    structuralMismatches: string[];
    notes: string[];
  } | null;
  panchangAudit?: {
    available: boolean;
    equivalent: boolean;
    birthInstantSource: 'request_time_panchang' | 'top_level_fallback';
    requestTimePanchangAvailable: boolean;
    requestTimePanchangEquivalent: boolean | null;
    requestTimePanchangMismatches: string[];
    dailyCalendarDifferences: string[];
    nonClockMismatches: string[];
    sunriseInstantDeltaSeconds: number | null;
    sunsetInstantDeltaSeconds: number | null;
    legitimateDisplayTimeDifferences: string[];
  } | null;
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

export interface ObservedQuotaHeadersSummary {
  status: 'measured_from_headers' | 'not_provided_by_provider';
  observedHeadersByEndpoint: Record<string, Record<string, string>>;
  remainingQuotaObserved: string | null;
  initialRemainingQuotaObserved?: string | null;
  rateLimitObserved: string | null;
  bodyQuotaMetadataObserved?: Record<string, unknown> | null;
  creditsUsedTotal?: number | null;
  creditsRemainingFinal?: string | null;
  creditsLimitObserved?: string | null;
  creditsResetObserved?: string | null;
  tierRestrictedEndpoints?: string[];
  note: string;
}

/**
 * Layer A — Raw Provider Record
 * Preserves complete original provider responses, sanitized requests, metadata,
 * latency, payload size, and quota headers without dropping or altering values.
 */
export interface LayerARawProviderRecord {
  schemaVersion: 'v2.raw.1.0';
  capturedAtUtc: string;
  providerId: V2DiagnosticProviderId;
  providerLabel?: string;
  providerBaseUrl: string;
  inputFingerprint: string;
  canonicalUtcIso: string;
  canonicalJulianDayUt: number;
  acquisitionStatus: 'complete' | 'partial' | 'failed';
  missingDatasets: string[];
  validationFailures: string[];
  calls: Record<string, SanitizedProviderCallRecord>;
  timezoneEquivalenceCheck?: TimezoneEquivalenceCheck | null;
  ephemerisTimestampCheck?: EphemerisTimestampCheck | null;
  quotaAndPerformanceSummary: {
    plannedRequestsCount: number;
    totalCalls: number;
    actualHttpRequestsSent: number;
    retryCount: number;
    successfulCalls: number;
    failedCalls: number;
    tierRestrictedCalls?: number;
    totalLatencyMs: number;
    totalRateWaitMs: number;
    totalPayloadBytes: number;
    coordinationModesObserved: Array<'global_supabase_cas' | 'isolate_memory_only'>;
    quotaHeadersObserved: ObservedQuotaHeadersSummary;
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
  selectedProviderStatus?:
    | 'available_green'
    | 'available_yellow'
    | 'partial_only'
    | 'unavailable'
    | 'tier_restricted';
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
  providerId?: V2DiagnosticProviderId;
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
  providerExtendedDatasets?: Record<string, unknown> | null;
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

export type EpistemicCategory =
  | 'provider_data_acquired'
  | 'internal_math_consistency_verified'
  | 'independently_validated_against_external_reference'
  | 'methodology_unresolved'
  | 'dataset_unavailable';

export type VerificationBasis =
  | 'provider_payload'
  | 'provider_self_consistency'
  | 'cosmiccouncil_internal_solver'
  | 'external_jhora_pyjhora_swisseph'
  | 'pending_external_validation'
  | 'none';

export interface EpistemicClassificationItem {
  key: string;
  label: string;
  category: EpistemicCategory;
  verificationBasis?: VerificationBasis;
  status: 'verified' | 'partial' | 'unresolved' | 'unavailable';
  detail: string;
}

export interface EpistemicClassificationSummary {
  providerDataAcquired: EpistemicClassificationItem[];
  internalMathConsistencyVerified: EpistemicClassificationItem[];
  independentlyValidatedAgainstExternalReference: EpistemicClassificationItem[];
  methodologyUnresolved: EpistemicClassificationItem[];
  datasetUnavailable: EpistemicClassificationItem[];
}

export interface VerificationCheckResult {
  id: string;
  domain: string;
  passed: boolean;
  severity: 'critical' | 'major' | 'info';
  epistemicCategory: EpistemicCategory;
  verificationBasis?: VerificationBasis;
  expected: string;
  observed: string;
  notes?: string;
}

export interface MathematicalVerificationReport {
  profileName: string;
  inputFingerprint: string;
  mode: 'live_and_offline' | 'partial_live_and_offline' | 'offline_only';
  passedCount: number;
  failedCount: number;
  epistemicClassification: EpistemicClassificationSummary;
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

export interface LegacyVsV2ComparisonReport {
  generatedAtUtc: string;
  hasLegacyChart: boolean;
  legacyMeta: {
    providerRecorded: string | null;
    providerLabelRecorded: string | null;
    generatedAt: string | null;
    birthDate: string | null;
    birthTime: string | null;
    timezoneOffset: number | null;
  };
  legacyDefectAudit: ProfileDefectAssessment | null;
  primaryCoordinatesComparison: {
    ascendant: {
      legacyDeg: number | null;
      v2ProviderDeg: number | null;
      independentRefDeg: number;
      legacyMinusRefDeg: number | null;
      v2MinusRefDeg: number | null;
    };
    sun: {
      legacyDeg: number | null;
      v2ProviderDeg: number | null;
      independentRefDeg: number;
      legacyMinusRefDeg: number | null;
      v2MinusRefDeg: number | null;
    };
    moon: {
      legacyDeg: number | null;
      v2ProviderDeg: number | null;
      independentRefDeg: number;
      legacyMinusRefDeg: number | null;
      v2MinusRefDeg: number | null;
    };
    planets: Array<{
      planet: string;
      legacyDeg: number | null;
      v2ProviderDeg: number | null;
      deltaDeg: number | null;
      legacySign: string | null;
      v2Sign: string | null;
    }>;
  };
  kpCuspsComparison: Array<{
    house: number;
    legacyDeg: number | null;
    legacySign: string | null;
    legacyStarLord: string | null;
    legacySubLord: string | null;
    v2ProviderDeg: number | null;
    v2ProviderSign: string | null;
    v2ProviderStarLord: string | null;
    v2ProviderSubLord: string | null;
    independentRefDeg: number;
    independentRefSign: string;
    legacyMinusRefDeg: number | null;
    v2MinusRefDeg: number | null;
    signFlipBetweenLegacyAndRef: boolean;
  }>;
  westernCuspsComparison: Array<{
    house: number;
    legacyDeg: number | null;
    legacySign: string | null;
    v2ProviderDeg: number | null;
    v2ProviderSign: string | null;
    independentRefDeg: number;
    independentRefSign: string;
    legacyMinusRefDeg: number | null;
    v2MinusRefDeg: number | null;
  }>;
  bhavaChalitComparison: {
    legacyShiftedCount: number | null;
    legacyShiftedPlanets: string[];
    v2ProviderShiftedCount: number | null;
    v2ProviderCompatibleWithSripati: boolean | null;
    independentSripatiShiftedCount: number;
    independentSripatiShiftedPlanets: string[];
    planetPlacements: Array<{
      planet: string;
      rashiHouse: number | null;
      legacyChalitHouse: number | null;
      v2ProviderChalitHouse: number | null;
      independentSripatiHouse: number | null;
    }>;
  };
  shadbalaComparison: {
    authoritativeDesignation: 'unassigned_pending_reconciliation';
    legacyLocalOrder: string[];
    legacyApiSummaryOrder: string[];
    v2ProviderOrder: string[];
    maxVirupaConflictBetweenLegacyLocalAndApi: number | null;
  };
  datasetCompletenessComparison: {
    legacyVargasCount: number;
    legacyHasD5: boolean;
    v2VargasCount: number;
    v2HasD5: boolean;
    legacyHasPrastharaAshtakavarga: boolean;
    v2HasPrastharaAshtakavarga: boolean;
    legacyHasEphemerisTelemetry: boolean;
    v2HasEphemerisTelemetry: boolean;
    legacyHasNativeKp4LevelSignificators: boolean;
    v2HasNativeKp4LevelSignificators: boolean;
  };
}
