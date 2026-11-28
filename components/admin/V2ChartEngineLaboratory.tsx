import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FlaskConical,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import CustomSelect from '../app/CustomSelect';

interface V2DiagnosticProfileSummary {
  id: string;
  user_id: string;
  name: string;
  birth_date: string | null;
  birth_time: string | null;
  birth_city: string | null;
  birth_state: string | null;
  birth_country: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone_offset: number | null;
  is_activated: boolean;
  updated_at: string;
}

interface SecretStatusInfo {
  envVarName: string;
  configured: boolean;
  legacyKeyAffected: boolean;
  configuredViaMechanismHint: string;
}

interface AmbiguousCandidate {
  occurrence: 'earlier_occurrence' | 'later_occurrence';
  utcIso: string;
  offsetHours: number;
  isDst: boolean;
}

interface EpistemicItem {
  key: string;
  label: string;
  category: string;
  status: 'verified' | 'partial' | 'unresolved' | 'unavailable';
  detail: string;
}

type V2DiagnosticProvider = 'freeastroapi' | 'astroway';

type EndpointAcquisitionClassification =
  | 'successfully_acquired'
  | 'rate_limited'
  | 'runtime_execution_blocked'
  | 'tier_restricted'
  | 'not_offered_by_provider'
  | 'not_yet_tested'
  | 'mathematical_verification_failed';

interface V2DiagnosticBatchState {
  sessionId: string;
  status:
    | 'completed'
    | 'in_progress'
    | 'waiting_rate_limit'
    | 'paused_partial'
    | 'completed_with_restrictions';
  batchIndex: number;
  batchSize: number;
  totalPlannedCount: number;
  executedThisBatch: number;
  remainingEligibleCount: number;
  retryAfterMs: number;
  nextAvailableAtUtc: string | null;
  rateLimitResetSource: string | null;
  rateLimitLimitObserved: number | null;
  rateLimitRemainingObserved: number | null;
  totalRateLimitWindowWaitMs: number;
  classificationCounts: Record<EndpointAcquisitionClassification, number>;
  haltedReason: string | null;
  resumedFromSession: boolean;
}

interface ShadbalaMethodologicalInvestigation {
  referenceBasisSummary: string;
  sthanaDeltaDrivers: Array<{
    planet: string;
    wholeSignHouse: number;
    sripatiHouse: number;
    placidusHouse: number | null;
    kendradiWholeSign: number;
    kendradiSripatiBhava: number;
    kendradiDeltaSripatiMinusWholeSign: number;
    saptavargajaNatural: number;
    saptavargajaPanchadha: number;
    saptavargajaDeltaPanchadhaMinusNatural: number;
    explanation: string;
  }>;
  cheshtaBalaZeroLuminaries: {
    detectedOnProvider: boolean;
    sunProviderCheshta: number | null;
    moonProviderCheshta: number | null;
    sunLegacyLocalCheshta: number | null;
    moonLegacyLocalCheshta: number | null;
    conventionExplanation: string;
    ishtaKashtaImpactNote: string;
  };
  kalaBalaRollupAudit: {
    abdaMasaVaraHoraCombined: boolean;
    rawKalaItemsPresent: boolean;
    fieldsObserved: string[];
    openApiKnownCaveats: string[];
  };
  thresholdReversals: Array<{
    planet: string;
    bphsRequiredRupas: number;
    providerRupas: number | null;
    providerRatioAtBphs: number | null;
    providerPassesBphs: boolean | null;
    legacyLocalRupas: number | null;
    legacyLocalRequiredRupas: number;
    legacyLocalPasses: boolean | null;
    providerVsLocalPassMismatch: boolean;
    notes: string;
  }>;
}

interface V2DiagnosticRunResult {
  bundleMetadata: {
    laboratory: string;
    provider?: V2DiagnosticProvider;
    generatedAtUtc: string;
    runtimeEnvironment: string;
    readOnlyProfileSource: boolean;
    profileMutated: boolean;
    productionEngineModified: boolean;
    ianaInferenceNote: string | null;
  };
  runtimeTelemetry: {
    executionDurationMs: number;
    heapMemoryStatus?: 'measured' | 'unavailable_in_worker_isolate';
    heapMeasurementNote?: string;
    heapBeforeBytes: number | null;
    heapAfterBytes: number | null;
    heapDeltaBytes: number | null;
    artifactSizesBytes: {
      layerABytes: number;
      layerBBytes: number;
      layerCBytes: number;
      compiledFoundationalChartBytes?: number;
      analyticalEvidenceRepositoryBytes?: number;
      k02PlanetaryStateIntelligenceBytes?: number;
      analyticalRuleRegistryBytes?: number;
      verificationReportBytes: number;
      legacyVsV2ComparisonBytes: number;
      totalResponseBytes: number;
    };
  };
  profileSummary: {
    id: string;
    name: string;
    birthDate: string;
    birthTime: string;
    birthCity: string | null;
    birthState: string | null;
    birthCountry: string | null;
    latitude: number;
    longitude: number;
    storedTimezoneOffset: number | null;
    isActivated: boolean;
    hasLegacyChart: boolean;
  };
  layerA: {
    schemaVersion: string;
    capturedAtUtc: string;
    providerId: V2DiagnosticProvider | string;
    providerLabel?: string;
    providerBaseUrl: string;
    inputFingerprint: string;
    canonicalUtcIso: string;
    canonicalJulianDayUt: number;
    acquisitionStatus: 'complete' | 'partial' | 'failed';
    missingDatasets: string[];
    validationFailures: string[];
    batchState?: V2DiagnosticBatchState | null;
    calls: Record<
      string,
      {
        id: string;
        endpoint: string;
        method: string;
        timestampUtc: string;
        httpStatus: number;
        ok: boolean;
        attempts: number;
        rateWaitMs: number;
        coordinationMode: string;
        latencyMs: number;
        payloadBytes: number;
        errorMessage?: string | null;
        category?: string;
        declaredQuality?: 'green' | 'yellow' | 'red';
        qualityCaveat?: string | null;
        accessRestricted?: boolean;
        creditsUsed?: number | null;
        acquisitionClassification?: EndpointAcquisitionClassification;
        priorityTier?: number;
        quotaAndMetaHeaders: Record<string, string>;
        sanitizedRequest: Record<string, unknown>;
        rawResponse: unknown;
      }
    >;
    timezoneEquivalenceCheck?: {
      executed: boolean;
      status?: string;
      equivalent: boolean;
      coordinatesEquivalent?: boolean;
      modeAStatus: number;
      modeBStatus: number;
      ascendantDeltaDeg: number | null;
      maxPlanetDeltaDeg: number | null;
      shadbalaComparison?: {
        available: boolean;
        equivalent: boolean | null;
        maxTotalDeltaVirupas: number | null;
        maxComponentDeltaVirupas: number | null;
        perPlanet: Array<{
          planet: string;
          modeATotal: number;
          modeBTotal: number;
          totalDelta: number;
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
        }>;
      };
      notes: string[];
    } | null;
    ephemerisTimestampCheck?: {
      utcTimestampPresent?: boolean;
      julianDayMatch?: boolean;
      exactTimestampMatch: boolean;
      returnedUtcInstant: string | null;
      returnedJulianDay?: number | null;
      expectedUtcIso: string;
      expectedJulianDayUt?: number;
      deltaSecondsFromCanonical: number | null;
      limitationNotes: string[];
    } | null;
    quotaAndPerformanceSummary: {
      plannedRequestsCount: number;
      totalCalls: number;
      actualHttpRequestsSent: number;
      retryCount: number;
      successfulCalls: number;
      failedCalls: number;
      tierRestrictedCalls?: number;
      rateLimitedCalls?: number;
      runtimeBlockedCalls?: number;
      notOfferedCalls?: number;
      unexecutedCalls?: number;
      mathematicalVerificationFailedCalls?: number;
      classificationCounts?: Record<string, number>;
      rateLimitWindowWaitMs?: number;
      totalLatencyMs: number;
      totalRateWaitMs: number;
      totalPayloadBytes: number;
      coordinationModesObserved: string[];
      quotaHeadersObserved: {
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
      };
    };
  };
  layerB: {
    schemaVersion: string;
    providerId?: V2DiagnosticProvider;
    canonicalBirthInstant: {
      inputFingerprint: string;
      utc: { iso: string; julianDayUt: number };
      timezone: {
        ianaTimezone: string | null;
        resolutionMethod: string;
        historicalUtcOffsetHours: number;
        isDst: boolean;
        dstFoldDisambiguationUsed?: string | null;
      };
    };
    frames: Record<
      string,
      {
        source: string;
        completeness: string;
        verificationStatus: string;
        limitations: string[];
        data: unknown;
      }
    >;
    shadbalaReconciliation: {
      verificationStatus: string;
      data: {
        authoritativeDesignation: string;
        sunThresholdInvestigation: {
          providerMinRupasForSun: number | null;
          classicalBphsMinRupasForSun: number;
          flipsPassFailStatus: boolean;
        };
        methodologicalInvestigation?: ShadbalaMethodologicalInvestigation;
      } | null;
    };
    providerExtendedDatasets?: Record<string, unknown> | null;
    datasetManifest?: Record<string, unknown>;
    remainingClassicalGaps: Array<{
      capability: string;
      freeAstroApiStatus: string;
      selectedProviderStatus?: string;
      localDerivedStatus: string;
    }>;
  };
  layerC: Record<string, unknown>;
  datasetManifest?: Record<string, unknown>;
  compiledFoundationalChart?: Record<string, unknown>;
  layerCInputContract?: Record<string, unknown>;
  analyticalEvidenceRepository?: Record<string, unknown> | null;
  k02PlanetaryStateIntelligence?: Record<string, unknown> | null;
  analyticalRuleRegistry?: Record<string, unknown> | null;
  verificationReport: {
    profileName: string;
    mode: string;
    passedCount: number;
    failedCount: number;
    epistemicClassification: {
      providerDataAcquired: EpistemicItem[];
      internalMathConsistencyVerified: EpistemicItem[];
      independentlyValidatedAgainstExternalReference: EpistemicItem[];
      methodologyUnresolved: EpistemicItem[];
      datasetUnavailable: EpistemicItem[];
    };
    checks: Array<{
      id: string;
      domain: string;
      passed: boolean;
      severity: string;
      epistemicCategory: string;
      expected: string;
      observed: string;
    }>;
  };
  legacyVsV2Comparison: {
    hasLegacyChart: boolean;
    legacyMeta: {
      providerRecorded: string | null;
      providerLabelRecorded: string | null;
      generatedAt: string | null;
    };
    legacyDefectAudit: {
      affected: boolean;
      severity: string;
      defects: string[];
    } | null;
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
    };
    kpCuspsComparison: Array<{
      house: number;
      legacyDeg: number | null;
      v2ProviderDeg: number | null;
      independentRefDeg: number;
      signFlipBetweenLegacyAndRef: boolean;
    }>;
    bhavaChalitComparison: {
      legacyShiftedCount: number | null;
      v2ProviderShiftedCount: number | null;
      v2ProviderCompatibleWithSripati: boolean | null;
      independentSripatiShiftedCount: number;
    };
    shadbalaComparison: {
      authoritativeDesignation: string;
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
  };
}

interface V2ChartEngineLaboratoryProps {
  getAccessToken: () => Promise<string | null>;
}

function formatKb(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function slugifyFilePart(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'profile'
  );
}

function triggerJsonDownload(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface AstroWaySessionSummary {
  sessionId: string;
  providerId: 'astroway';
  profileId: string | null;
  profileName: string | null;
  inputFingerprint: string;
  includeTimezoneEquivalenceProbe: boolean;
  batchIndex: number;
  status: V2DiagnosticBatchState['status'];
  totalPlannedCount: number;
  successfulCount: number;
  queuedCount: number;
  failedCount: number;
  remainingEligibleCount: number;
  totalRateLimitWindowWaitMs: number;
  createdAtMs: number;
  updatedAtMs: number;
  matchesFingerprint: boolean;
  matchesProfileId: boolean;
}

function getSessionStorageKey(profileId: string): string {
  return `cc_v2_aw_session:${profileId}`;
}

function createClientSessionId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fallback
  }
  return `aw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const V2ChartEngineLaboratory: React.FC<V2ChartEngineLaboratoryProps> = ({ getAccessToken }) => {
  const [provider, setProvider] = useState<V2DiagnosticProvider>('freeastroapi');
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<V2DiagnosticProfileSummary[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [secretStatus, setSecretStatus] = useState<SecretStatusInfo | null>(null);
  const [astroWaySecretStatus, setAstroWaySecretStatus] = useState<SecretStatusInfo | null>(null);

  const [ianaTimezoneOverride, setIanaTimezoneOverride] = useState('');
  const [birthTimePrecision, setBirthTimePrecision] = useState<
    'exact' | 'approximate' | 'sunrise_unknown' | 'unknown'
  >('exact');
  const [nodeConvention, setNodeConvention] = useState<'mean' | 'true'>('mean');
  const [includeTimezoneProbe, setIncludeTimezoneProbe] = useState(true);
  const [dstFoldDisambiguation, setDstFoldDisambiguation] = useState<
    '' | 'earlier_occurrence' | 'later_occurrence'
  >('');
  const [ambiguousCandidates, setAmbiguousCandidates] = useState<AmbiguousCandidate[]>([]);

  const [running, setRunning] = useState(false);
  const [progressStage, setProgressStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<V2DiagnosticRunResult | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [recoverableSession, setRecoverableSession] = useState<AstroWaySessionSummary | null>(null);
  const [recoveringSession, setRecoveringSession] = useState(false);
  const [cooldownRemainingSec, setCooldownRemainingSec] = useState<number | null>(null);
  const [pausedByUser, setPausedByUser] = useState(false);

  const inFlightRef = useRef(false);
  const pausedRef = useRef(false);
  const cooldownIntervalRef = useRef<number | null>(null);
  const resumeTimeoutRef = useRef<number | null>(null);
  const autoHydratedSessionRef = useRef<string | null>(null);

  const clearBatchTimers = useCallback(() => {
    if (cooldownIntervalRef.current !== null) {
      window.clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
    }
    if (resumeTimeoutRef.current !== null) {
      window.clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
    setCooldownRemainingSec(null);
  }, []);

  useEffect(() => {
    return () => {
      pausedRef.current = true;
      clearBatchTimers();
    };
  }, [clearBatchTimers]);

  const loadProfiles = useCallback(
    async (q = '') => {
      setLoadingProfiles(true);
      try {
        const token = await getAccessToken();
        const url = q.trim()
          ? `/api/admin/v2-diagnostics/profiles?q=${encodeURIComponent(q.trim())}`
          : '/api/admin/v2-diagnostics/profiles';
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load profiles');

        const list = Array.isArray(data.profiles)
          ? (data.profiles as V2DiagnosticProfileSummary[])
          : [];
        setProfiles(list);
        if (data.secretStatus) setSecretStatus(data.secretStatus);
        if (data.astroWaySecretStatus) setAstroWaySecretStatus(data.astroWaySecretStatus);

        setSelectedProfileId((prev) => {
          if (prev && list.some((p) => p.id === prev)) return prev;
          const chris4 = list.find((p) => /chris\s*4/i.test(p.name));
          return chris4?.id || list[0]?.id || '';
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load profiles');
      } finally {
        setLoadingProfiles(false);
      }
    },
    [getAccessToken]
  );

  useEffect(() => {
    void loadProfiles('');
  }, [loadProfiles]);

  const activeSecretConfigured =
    provider === 'astroway'
      ? Boolean(astroWaySecretStatus?.configured)
      : Boolean(secretStatus?.configured);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) || null,
    [profiles, selectedProfileId]
  );

  const profileDropdownOptions = useMemo(
    () =>
      profiles.map((p) => ({
        value: p.id,
        label: `${p.name} — ${p.birth_city || 'Unknown City'}${
          p.birth_country ? `, ${p.birth_country}` : ''
        }`,
        hint: `${p.birth_date || '?'} ${p.birth_time || '?'} · ${
          p.is_activated ? 'Activated chart present' : 'Unactivated'
        }`,
      })),
    [profiles]
  );

  const recoverPersistedSession = useCallback(
    async (sessionId: string, profileId: string) => {
      if (!profileId || !sessionId || inFlightRef.current) return;
      setRecoveringSession(true);
      try {
        const token = await getAccessToken();
        const res = await fetch('/api/admin/v2-diagnostics/recover', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
          body: JSON.stringify({
            profileId,
            sessionId,
            ianaTimezoneOverride: ianaTimezoneOverride.trim() || null,
            dstFoldDisambiguation: dstFoldDisambiguation || null,
            birthTimePrecision,
            nodeConvention,
          }),
        });
        if (!res.ok) return;
        const recovered = (await res.json()) as V2DiagnosticRunResult;
        setResult(recovered);
        const bs = recovered.layerA.batchState;
        if (bs?.sessionId) {
          setActiveSessionId(bs.sessionId);
          try {
            window.localStorage.setItem(getSessionStorageKey(profileId), bs.sessionId);
          } catch {
            // ignore storage failure
          }
        }
        if (bs && bs.remainingEligibleCount > 0) {
          setPausedByUser(true);
          setProgressStage(
            `Recovered persisted session (${recovered.layerA.quotaAndPerformanceSummary.successfulCalls} acquired · ${
              recovered.layerA.quotaAndPerformanceSummary.unexecutedCalls ?? 0
            } queued · ${recovered.layerA.quotaAndPerformanceSummary.failedCalls} failed). Click Resume Acquisition to continue without re-calling settled endpoints.`
          );
        }
      } catch {
        // Non-fatal recovery probe
      } finally {
        setRecoveringSession(false);
      }
    },
    [
      birthTimePrecision,
      dstFoldDisambiguation,
      getAccessToken,
      ianaTimezoneOverride,
      nodeConvention,
    ]
  );

  const checkRecoverableAstroWaySessions = useCallback(
    async (profileId: string) => {
      if (provider !== 'astroway' || !profileId || inFlightRef.current) return;
      try {
        const token = await getAccessToken();
        const qs = new URLSearchParams({
          profileId,
          birthTimePrecision,
          nodeConvention,
        });
        if (ianaTimezoneOverride.trim()) {
          qs.set('ianaTimezoneOverride', ianaTimezoneOverride.trim());
        }
        const res = await fetch(`/api/admin/v2-diagnostics/sessions?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { sessions?: AstroWaySessionSummary[] };
        const sessions = Array.isArray(data.sessions) ? data.sessions : [];
        let storedId: string | null = null;
        try {
          storedId = window.localStorage.getItem(getSessionStorageKey(profileId));
        } catch {
          storedId = null;
        }
        const matched =
          sessions.find((s) => s.matchesFingerprint || s.matchesProfileId) ||
          (storedId ? sessions.find((s) => s.sessionId === storedId) : undefined) ||
          sessions.find((s) => s.profileId === null) ||
          null;

        setRecoverableSession(matched);
        if (matched) {
          setActiveSessionId((prev) => prev || matched.sessionId);
          const shouldAutoHydrate =
            autoHydratedSessionRef.current !== `${profileId}:${matched.sessionId}` &&
            (!result ||
              result.profileSummary.id !== profileId ||
              result.layerA.providerId !== 'astroway');
          if (shouldAutoHydrate) {
            autoHydratedSessionRef.current = `${profileId}:${matched.sessionId}`;
            void recoverPersistedSession(matched.sessionId, profileId);
          }
        }
      } catch {
        // Non-fatal session check
      }
    },
    [
      birthTimePrecision,
      getAccessToken,
      ianaTimezoneOverride,
      nodeConvention,
      provider,
      recoverPersistedSession,
      result,
    ]
  );

  useEffect(() => {
    if (provider === 'astroway' && selectedProfileId && !running) {
      void checkRecoverableAstroWaySessions(selectedProfileId);
    }
  }, [checkRecoverableAstroWaySessions, provider, running, selectedProfileId]);

  const runSingleBatch = async (opts?: {
    sessionId?: string | null;
    resetSession?: boolean;
    manualResume?: boolean;
  }): Promise<{
    data: V2DiagnosticRunResult | null;
    lockConflict?: { code: string; retryAfterMs: number; message: string };
  }> => {
    if (inFlightRef.current || !selectedProfileId) return { data: null };
    inFlightRef.current = true;
    setRunning(true);
    setError(null);
    setAmbiguousCandidates([]);

    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/v2-diagnostics/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
        body: JSON.stringify({
          provider,
          profileId: selectedProfileId,
          ianaTimezoneOverride: ianaTimezoneOverride.trim() || null,
          dstFoldDisambiguation: dstFoldDisambiguation || null,
          birthTimePrecision,
          nodeConvention,
          includeTimezoneEquivalenceProbe: includeTimezoneProbe,
          ...(provider === 'astroway'
            ? {
                sessionId: opts?.sessionId ?? null,
                resetSession: Boolean(opts?.resetSession),
                manualResume: Boolean(opts?.manualResume),
                batchSize: 8,
              }
            : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (
          res.status === 409 &&
          (data.code === 'DIAGNOSTIC_RUN_IN_PROGRESS' ||
            data.code === 'SAME_SESSION_BATCH_IN_PROGRESS')
        ) {
          return {
            data: null,
            lockConflict: {
              code: String(data.code),
              retryAfterMs: Number(data.retryAfterMs || 3000),
              message: String(data.error || 'Diagnostic lock busy'),
            },
          };
        }
        if (data.code === 'AMBIGUOUS_LOCAL_TIME' && Array.isArray(data.candidates)) {
          setAmbiguousCandidates(data.candidates);
        }
        throw new Error(data.error || `Diagnostic failed (HTTP ${res.status})`);
      }

      const typed = data as V2DiagnosticRunResult;
      setResult(typed);
      setAmbiguousCandidates([]);
      return { data: typed };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'V2 diagnostic execution failed.');
      return { data: null };
    } finally {
      inFlightRef.current = false;
      setRunning(false);
    }
  };

  const executeAstroWayBatchLoop = async (opts?: {
    sessionId?: string | null;
    resetSession?: boolean;
    manualResume?: boolean;
    expectedBatchIndex?: number;
    lockHandoverRetries?: number;
    zeroProgressBatches?: number;
  }) => {
    clearBatchTimers();
    pausedRef.current = false;
    setPausedByUser(false);

    const targetSessionId =
      opts?.resetSession || !opts?.sessionId ? createClientSessionId() : opts.sessionId;
    setActiveSessionId(targetSessionId);
    if (selectedProfileId) {
      try {
        window.localStorage.setItem(getSessionStorageKey(selectedProfileId), targetSessionId);
      } catch {
        // ignore
      }
    }

    const batchNum =
      opts?.expectedBatchIndex ??
      (opts?.resetSession || !opts?.sessionId
        ? 1
        : (result?.layerA.batchState?.batchIndex ?? 0) + 1);
    setProgressStage(
      `Executing AstroWay Priority Batch #${batchNum} (session ${targetSessionId.slice(0, 8)}..., max 8 Worker subrequests)...`
    );

    const { data: resData, lockConflict } = await runSingleBatch({
      sessionId: targetSessionId,
      resetSession: Boolean(opts?.resetSession),
      manualResume: Boolean(opts?.manualResume),
    });

    if (lockConflict) {
      const handoverRetries = opts?.lockHandoverRetries ?? 0;
      const canRetryTransientLock =
        (lockConflict.code === 'SAME_SESSION_BATCH_IN_PROGRESS' || Boolean(opts?.sessionId)) &&
        handoverRetries < 2;
      if (canRetryTransientLock && !pausedRef.current) {
        const retryWaitMs = Math.min(5000, Math.max(1500, lockConflict.retryAfterMs || 2500));
        const targetAtMs = Date.now() + retryWaitMs;
        setCooldownRemainingSec(Math.ceil(retryWaitMs / 1000));
        setProgressStage(
          `Finishing lock handover for Batch #${batchNum} — retrying automatically in ${Math.ceil(
            retryWaitMs / 1000
          )}s...`
        );
        cooldownIntervalRef.current = window.setInterval(() => {
          setCooldownRemainingSec(Math.max(0, Math.ceil((targetAtMs - Date.now()) / 1000)));
        }, 400);
        resumeTimeoutRef.current = window.setTimeout(() => {
          clearBatchTimers();
          if (!pausedRef.current) {
            void executeAstroWayBatchLoop({
              sessionId: targetSessionId,
              resetSession: false,
              manualResume: opts?.manualResume,
              expectedBatchIndex: batchNum,
              lockHandoverRetries: handoverRetries + 1,
              zeroProgressBatches: opts?.zeroProgressBatches ?? 0,
            });
          }
        }, retryWaitMs);
        return;
      }

      setError(lockConflict.message);
      setPausedByUser(true);
      setProgressStage(
        'Automatic continuation paused due to active server lock. Progress is saved — click Resume Acquisition when ready.'
      );
      return;
    }

    if (!resData) {
      setPausedByUser(true);
      setProgressStage(
        'Batch interrupted before completion — settled responses remain saved. Click Resume Acquisition to continue.'
      );
      return;
    }

    const bs = resData.layerA.batchState;
    if (!bs) {
      setProgressStage(null);
      return;
    }
    setActiveSessionId(bs.sessionId);
    if (selectedProfileId) {
      try {
        window.localStorage.setItem(getSessionStorageKey(selectedProfileId), bs.sessionId);
      } catch {
        // ignore
      }
    }

    if (
      bs.status === 'completed' ||
      bs.status === 'completed_with_restrictions' ||
      bs.remainingEligibleCount === 0
    ) {
      setRecoverableSession(null);
      const qSummary = resData.layerA.quotaAndPerformanceSummary;
      setProgressStage(
        `Acquisition finished (${bs.status}): ${qSummary.successfulCalls} acquired · ${qSummary.failedCalls} non-200/restricted · ${
          qSummary.unexecutedCalls ?? 0
        } queued.`
      );
      return;
    }

    setRecoverableSession({
      sessionId: bs.sessionId,
      providerId: 'astroway',
      profileId: selectedProfileId || null,
      profileName: resData.profileSummary.name || null,
      inputFingerprint: resData.layerA.inputFingerprint,
      includeTimezoneEquivalenceProbe: includeTimezoneProbe,
      batchIndex: bs.batchIndex,
      status: bs.status,
      totalPlannedCount: bs.totalPlannedCount,
      successfulCount: resData.layerA.quotaAndPerformanceSummary.successfulCalls,
      queuedCount: resData.layerA.quotaAndPerformanceSummary.unexecutedCalls ?? 0,
      failedCount: resData.layerA.quotaAndPerformanceSummary.failedCalls,
      remainingEligibleCount: bs.remainingEligibleCount,
      totalRateLimitWindowWaitMs: bs.totalRateLimitWindowWaitMs,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      matchesFingerprint: true,
      matchesProfileId: true,
    });

    if (pausedRef.current) {
      setProgressStage(
        `Paused at Batch #${bs.batchIndex} (${bs.remainingEligibleCount} endpoints remaining — click Resume Acquisition to continue).`
      );
      return;
    }

    if (bs.status === 'waiting_rate_limit' && bs.retryAfterMs > 0) {
      const waitTotalMs = Math.max(1500, bs.retryAfterMs + 600);
      const targetAtMs = Date.now() + waitTotalMs;
      setCooldownRemainingSec(Math.ceil(waitTotalMs / 1000));
      setProgressStage(
        `Rate-limit window active after Batch #${bs.batchIndex}. Waiting Retry-After before resuming Batch #${bs.batchIndex + 1} (${bs.remainingEligibleCount} remaining)...`
      );

      cooldownIntervalRef.current = window.setInterval(() => {
        const rem = Math.max(0, Math.ceil((targetAtMs - Date.now()) / 1000));
        setCooldownRemainingSec(rem);
      }, 500);

      resumeTimeoutRef.current = window.setTimeout(() => {
        clearBatchTimers();
        if (!pausedRef.current) {
          void executeAstroWayBatchLoop({
            sessionId: bs.sessionId,
            resetSession: false,
            expectedBatchIndex: bs.batchIndex + 1,
            lockHandoverRetries: 0,
            zeroProgressBatches: 0,
          });
        }
      }, waitTotalMs);
      return;
    }

    const zeroProgressCount =
      bs.executedThisBatch === 0 ? (opts?.zeroProgressBatches ?? 0) + 1 : 0;
    if (zeroProgressCount >= 3) {
      setPausedByUser(true);
      setProgressStage(
        `Paused after ${zeroProgressCount} zero-progress batches (${bs.remainingEligibleCount} remaining). Click Resume Acquisition to retry.`
      );
      return;
    }

    // Bounded batch completed cleanly without 429; chain next batch cleanly after short pause
    setProgressStage(
      `Batch #${bs.batchIndex} completed (${resData.layerA.quotaAndPerformanceSummary.successfulCalls} OK · ${
        resData.layerA.quotaAndPerformanceSummary.unexecutedCalls ?? 0
      } queued · ${resData.layerA.quotaAndPerformanceSummary.failedCalls} failed). Continuing to Batch #${
        bs.batchIndex + 1
      }...`
    );
    resumeTimeoutRef.current = window.setTimeout(() => {
      clearBatchTimers();
      if (!pausedRef.current) {
        void executeAstroWayBatchLoop({
          sessionId: bs.sessionId,
          resetSession: false,
          expectedBatchIndex: bs.batchIndex + 1,
          lockHandoverRetries: 0,
          zeroProgressBatches: zeroProgressCount,
        });
      }
    }, 350);
  };

  const handlePauseAutoResume = () => {
    pausedRef.current = true;
    setPausedByUser(true);
    clearBatchTimers();
    const rem =
      result?.layerA.batchState?.remainingEligibleCount ??
      recoverableSession?.remainingEligibleCount;
    setProgressStage(
      rem != null
        ? `Paused (${rem} endpoints remaining — existing responses preserved).`
        : 'Paused.'
    );
  };

  const handleResetAstroWaySession = async () => {
    pausedRef.current = true;
    setPausedByUser(false);
    clearBatchTimers();
    const sidToDelete = activeSessionId || recoverableSession?.sessionId || null;
    if (selectedProfileId) {
      try {
        window.localStorage.removeItem(getSessionStorageKey(selectedProfileId));
      } catch {
        // ignore
      }
    }
    if (sidToDelete) {
      try {
        const token = await getAccessToken();
        await fetch(`/api/admin/v2-diagnostics/sessions/${encodeURIComponent(sidToDelete)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Non-fatal
      }
    }
    autoHydratedSessionRef.current = null;
    setActiveSessionId(null);
    setRecoverableSession(null);
    setError(null);
    setProgressStage(null);
  };

  const handleResumeAstroWaySession = async () => {
    if (inFlightRef.current || !selectedProfileId) return;
    const resumeId = activeSessionId || recoverableSession?.sessionId || null;
    if (!resumeId) return;
    await executeAstroWayBatchLoop({
      sessionId: resumeId,
      resetSession: false,
      manualResume: true,
      expectedBatchIndex:
        (result?.layerA.batchState?.batchIndex ?? recoverableSession?.batchIndex ?? 0) + 1,
    });
  };

  const handleRunV2Diagnostic = async () => {
    if (inFlightRef.current || !selectedProfileId) return;
    if (provider === 'astroway') {
      const resumeId = activeSessionId || recoverableSession?.sessionId || null;
      const hasRemaining =
        (result?.layerA.providerId === 'astroway' &&
          (result?.layerA.batchState?.remainingEligibleCount ?? 0) > 0) ||
        Boolean(recoverableSession && recoverableSession.remainingEligibleCount > 0);
      const shouldResume = Boolean(resumeId && hasRemaining);
      await executeAstroWayBatchLoop({
        sessionId: shouldResume ? resumeId : null,
        resetSession: !shouldResume,
        manualResume: shouldResume,
        expectedBatchIndex: shouldResume
          ? (result?.layerA.batchState?.batchIndex ?? recoverableSession?.batchIndex ?? 0) + 1
          : 1,
      });
      return;
    }

    clearBatchTimers();
    setProgressStage(
      includeTimezoneProbe
        ? 'Coordinating rate-limited 4-request acquisition + Mode A/B probe (~8–11s)...'
        : 'Coordinating rate-limited 4-request FreeAstroAPI V2 bundle (~5–7s)...'
    );
    await runSingleBatch();
    setProgressStage(null);
  };

  const downloadPayloads = useMemo(() => {
    if (!result) return null;
    const rawApiResponses = {
      capturedAtUtc: result.layerA.capturedAtUtc,
      providerId: result.layerA.providerId,
      providerBaseUrl: result.layerA.providerBaseUrl,
      acquisitionStatus: result.layerA.acquisitionStatus,
      missingDatasets: result.layerA.missingDatasets,
      validationFailures: result.layerA.validationFailures,
      quotaAndPerformanceSummary: result.layerA.quotaAndPerformanceSummary,
      calls: result.layerA.calls,
    };

    const verificationAndProvenance = {
      capturedAtUtc: result.bundleMetadata.generatedAtUtc,
      bundleMetadata: result.bundleMetadata,
      canonicalBirthInstant: result.layerB.canonicalBirthInstant,
      verificationReport: result.verificationReport,
      ephemerisTimestampCheck: result.layerA.ephemerisTimestampCheck ?? null,
      timezoneEquivalenceCheck: result.layerA.timezoneEquivalenceCheck ?? null,
      shadbalaReconciliation: result.layerB.shadbalaReconciliation,
      legacyDefectAudit: result.legacyVsV2Comparison.legacyDefectAudit,
    };

    const datasetManifest =
      result.datasetManifest ?? result.layerB.datasetManifest ?? null;

    const consolidatedFoundationalChart =
      result.compiledFoundationalChart ?? {
        schemaVersion: 'v2.compiled_foundational_chart.1.0',
        compiledAtUtc: result.bundleMetadata.generatedAtUtc,
        canonicalBirthInstant: result.layerB.canonicalBirthInstant,
        layerBMaster: result.layerB,
        layerCShell: result.layerC,
        manifest: datasetManifest,
        verification: result.verificationReport,
        layerCInputContract: result.layerCInputContract ?? null,
      };

    const analyticalEvidenceRepository = result.analyticalEvidenceRepository ?? null;
    const k02PlanetaryStateIntelligence = result.k02PlanetaryStateIntelligence ?? null;
    const analyticalRuleRegistry = result.analyticalRuleRegistry ?? null;

    const completeDiagnosticBundle = {
      bundleMetadata: result.bundleMetadata,
      runtimeTelemetry: result.runtimeTelemetry,
      profileSummary: result.profileSummary,
      rawApiResponses,
      layerA: result.layerA,
      layerB: result.layerB,
      layerC: result.layerC,
      datasetManifest,
      compiledFoundationalChart: consolidatedFoundationalChart,
      layerCInputContract: result.layerCInputContract ?? null,
      analyticalEvidenceRepository,
      k02PlanetaryStateIntelligence,
      analyticalRuleRegistry,
      verificationAndProvenance,
      legacyVsV2Comparison: result.legacyVsV2Comparison,
    };

    return {
      completeDiagnosticBundle,
      consolidatedFoundationalChart,
      analyticalEvidenceRepository,
      k02PlanetaryStateIntelligence,
      analyticalRuleRegistry,
      rawApiResponses,
      layerA: result.layerA,
      layerB: result.layerB,
      layerC: result.layerC,
      verificationAndProvenance,
      legacyVsV2Comparison: result.legacyVsV2Comparison,
    };
  }, [result]);

  const filePrefix = result
    ? `v2-diag-${slugifyFilePart(String(result.layerA.providerId || 'freeastroapi'))}-${slugifyFilePart(result.profileSummary.name)}-${result.bundleMetadata.generatedAtUtc.slice(0, 10)}`
    : 'v2-diag';

  return (
    <section className="rounded-3xl border border-[#3D3830]/15 bg-[#FDFBF7] p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-[#B8965A]" />
            <h3 className="font-['Cormorant_Garamond',serif] text-2xl font-medium text-[#3D3830]">
              Chart Engine Laboratory — Foundational Calculation Engine V2
            </h3>
          </div>
          <p className="text-xs text-[#5C5449] mt-1 max-w-3xl">
            Isolated, read-only diagnostic workbench reusing server Worker Secrets (
            <span className="font-mono">FREE_ASTRO_API_KEY</span> &amp;{' '}
            <span className="font-mono">ASTROWAY_API_KEY</span>). Never overwrites existing profiles,
            charts, Council, Companion, or Reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] ${
              secretStatus?.configured
                ? 'border-[#2D6A4F]/25 bg-[#2D6A4F]/8 text-[#2D6A4F]'
                : 'border-[#7A3E36]/25 bg-[#7A3E36]/8 text-[#7A3E36]'
            }`}
          >
            FREE_ASTRO_API_KEY: {secretStatus?.configured ? 'Configured' : 'Unset in runtime'}
          </span>
          <span
            className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] ${
              astroWaySecretStatus?.configured
                ? 'border-[#2D6A4F]/25 bg-[#2D6A4F]/8 text-[#2D6A4F]'
                : 'border-[#7A3E36]/25 bg-[#7A3E36]/8 text-[#7A3E36]'
            }`}
          >
            ASTROWAY_API_KEY: {astroWaySecretStatus?.configured ? 'Configured' : 'Unset in runtime'}
          </span>
        </div>
      </div>

      {/* Profile Selector + Configuration Controls */}
      <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-3 space-y-1.5">
            <label className="block text-xs font-medium text-[#5C5449]">
              Diagnostic Provider
            </label>
            <CustomSelect
              value={provider}
              onChange={(val) =>
                setProvider(val === 'astroway' ? 'astroway' : 'freeastroapi')
              }
              ariaLabel="Select diagnostic provider"
              surface="canvas"
              className="w-full"
              options={[
                {
                  value: 'freeastroapi',
                  label: 'FreeAstroAPI',
                  hint: '4-request V2/V1 bundle (1 req/s CAS)',
                },
                {
                  value: 'astroway',
                  label: 'AstroWay',
                  hint: 'Maximum 67-endpoint classical V1 suite',
                },
              ]}
            />
          </div>

          <div className="lg:col-span-4 space-y-1.5">
            <label className="block text-xs font-medium text-[#5C5449]">
              Search Existing Profiles
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8B8275]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void loadProfiles(searchQuery);
                  }}
                  placeholder="Name, city, or country (e.g. Chris 4)"
                  className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] pl-8 pr-3 py-2 text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
                />
              </div>
              <button
                type="button"
                disabled={loadingProfiles}
                onClick={() => void loadProfiles(searchQuery)}
                className="inline-flex items-center gap-1 rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingProfiles ? 'animate-spin' : ''}`} />
                <span>Find</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-1.5">
            <label className="block text-xs font-medium text-[#5C5449]">
              Target Birth Profile (Read-Only)
            </label>
            <CustomSelect
              value={selectedProfileId}
              onChange={(val) => {
                setSelectedProfileId(val);
                setDstFoldDisambiguation('');
                setAmbiguousCandidates([]);
                setActiveSessionId(null);
                setRecoverableSession(null);
                setProgressStage(null);
                setError(null);
                autoHydratedSessionRef.current = null;
              }}
              ariaLabel="Select target birth profile"
              surface="canvas"
              className="w-full"
              options={
                profileDropdownOptions.length > 0
                  ? profileDropdownOptions
                  : [{ value: '', label: loadingProfiles ? 'Loading profiles...' : 'No profiles found' }]
              }
            />
          </div>
        </div>

        {selectedProfile && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] px-3.5 py-2.5 font-mono text-[11px] text-[#5C5449] tabular-nums">
            <span>
              <strong className="text-[#3D3830]">Date/Time:</strong> {selectedProfile.birth_date || '—'}{' '}
              {selectedProfile.birth_time || '—'}
            </span>
            <span>
              <strong className="text-[#3D3830]">Coords:</strong>{' '}
              {typeof selectedProfile.latitude === 'number'
                ? selectedProfile.latitude.toFixed(5)
                : '—'}
              ,{' '}
              {typeof selectedProfile.longitude === 'number'
                ? selectedProfile.longitude.toFixed(5)
                : '—'}
            </span>
            <span>
              <strong className="text-[#3D3830]">Stored Offset:</strong>{' '}
              {selectedProfile.timezone_offset ?? 'null'}h
            </span>
            <span>
              <strong className="text-[#3D3830]">Chart State:</strong>{' '}
              {selectedProfile.is_activated ? 'Activated' : 'Unactivated'}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#5C5449]">
              IANA Timezone Override (Optional)
            </label>
            <input
              type="text"
              value={ianaTimezoneOverride}
              onChange={(e) => {
                setIanaTimezoneOverride(e.target.value);
                setDstFoldDisambiguation('');
                setAmbiguousCandidates([]);
              }}
              placeholder="Auto-resolve (e.g. Asia/Kolkata)"
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 font-mono text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#5C5449]">
              Birth Time Precision
            </label>
            <CustomSelect
              value={birthTimePrecision}
              onChange={(val) =>
                setBirthTimePrecision(
                  val as 'exact' | 'approximate' | 'sunrise_unknown' | 'unknown'
                )
              }
              ariaLabel="Birth time precision"
              surface="canvas"
              className="w-full"
              options={[
                { value: 'exact', label: 'Exact (Minutes/Seconds)' },
                { value: 'approximate', label: 'Approximate' },
                { value: 'sunrise_unknown', label: 'Sunrise Fallback' },
                { value: 'unknown', label: 'Unknown' },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#5C5449]">
              Lunar Node Convention
            </label>
            <CustomSelect
              value={nodeConvention}
              onChange={(val) => setNodeConvention(val === 'true' ? 'true' : 'mean')}
              ariaLabel="Lunar node convention"
              surface="canvas"
              className="w-full"
              options={[
                { value: 'mean', label: 'Mean Node (Default)' },
                { value: 'true', label: 'True Node' },
              ]}
            />
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] px-3 py-2 text-xs text-[#3D3830] cursor-pointer">
            <input
              type="checkbox"
              checked={includeTimezoneProbe}
              onChange={(e) => setIncludeTimezoneProbe(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#4A453D]"
            />
            <span>Run Mode A vs B TZ Probe</span>
          </label>
        </div>

        {/* Explicit DST Ambiguous Fold Disambiguation Prompt */}
        {ambiguousCandidates.length > 0 && (
          <div className="rounded-2xl border border-[#B8965A]/45 bg-[#B8965A]/10 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#3D3830]">
              <AlertTriangle className="h-4 w-4 text-[#8B6B2E]" />
              <span>Ambiguous Historical DST Fold Detected — Select Occurrence</span>
            </div>
            <p className="text-xs text-[#5C5449]">
              This local birth clock occurred twice due to a DST fall-back transition. Choose the
              exact intended occurrence before re-running:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ambiguousCandidates.map((cand) => (
                <label
                  key={cand.occurrence}
                  className={`flex items-start gap-2 rounded-xl border p-3 text-xs cursor-pointer ${
                    dstFoldDisambiguation === cand.occurrence
                      ? 'border-[#4A453D] bg-[#FDFBF7]'
                      : 'border-[#3D3830]/15 bg-[#FAF7F2]'
                  }`}
                >
                  <input
                    type="radio"
                    name="v2DstFoldDisambig"
                    checked={dstFoldDisambiguation === cand.occurrence}
                    onChange={() => setDstFoldDisambiguation(cand.occurrence)}
                    className="mt-0.5 accent-[#4A453D]"
                  />
                  <div>
                    <div className="font-medium text-[#3D3830]">
                      {cand.occurrence === 'earlier_occurrence'
                        ? 'Earlier Occurrence (Pre-transition)'
                        : 'Later Occurrence (Post-transition)'}
                    </div>
                    <div className="font-mono text-[11px] text-[#5C5449] mt-0.5">
                      {cand.utcIso} · UTC{cand.offsetHours >= 0 ? `+${cand.offsetHours}` : cand.offsetHours}h ·{' '}
                      {cand.isDst ? 'DST' : 'Standard'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {provider === 'astroway' &&
          recoverableSession &&
          recoverableSession.remainingEligibleCount > 0 &&
          !running && (
            <div className="rounded-2xl border border-[#B8965A]/45 bg-[#B8965A]/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="font-medium text-[#3D3830]">
                  Persisted AstroWay Session Ready to Resume ({recoverableSession.successfulCount}/
                  {recoverableSession.totalPlannedCount} acquired ·{' '}
                  {recoverableSession.queuedCount} queued · {recoverableSession.failedCount} failed)
                </div>
                <div className="font-mono text-[11px] text-[#5C5449]">
                  Session {recoverableSession.sessionId.slice(0, 12)} · Batch #
                  {recoverableSession.batchIndex} ·{' '}
                  {recoverableSession.remainingEligibleCount} remaining without repeating settled calls
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(!result ||
                  result.layerA.batchState?.sessionId !== recoverableSession.sessionId) && (
                  <button
                    type="button"
                    disabled={recoveringSession}
                    onClick={() =>
                      void recoverPersistedSession(recoverableSession.sessionId, selectedProfileId)
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/20 bg-[#FDFBF7] px-3 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                  >
                    <Database className="h-3 w-3" />
                    <span>{recoveringSession ? 'Loading...' : 'Load Saved Bundle'}</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={!activeSecretConfigured || cooldownRemainingSec !== null}
                  onClick={() => void handleResumeAstroWaySession()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-3.5 py-1.5 text-[11px] font-medium text-[#FAF7F2] hover:bg-[#38342E] cursor-pointer disabled:opacity-45"
                >
                  <Play className="h-3 w-3" />
                  <span>Resume Acquisition ({recoverableSession.remainingEligibleCount} left)</span>
                </button>
              </div>
            </div>
          )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-xs text-[#8B8275]">
            {progressStage ||
              (provider === 'astroway'
                ? 'Priority-ordered, rate-limit-aware resumable batches (<= 8 endpoints/batch; verifies Chart, Shadbala, Kala & Mode B probes first before the remaining 67-endpoint suite).'
                : 'Executes 4 isolated endpoints (/vedic/calculate, /vedic/kp, /natal/calculate, /ephemeris/calculate).')}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(running || cooldownRemainingSec !== null) && provider === 'astroway' && (
              <button
                type="button"
                onClick={handlePauseAutoResume}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/20 bg-[#FDFBF7] px-3.5 py-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
              >
                <Pause className="h-3.5 w-3.5" />
                <span>Pause Auto-Resume</span>
              </button>
            )}

            {provider === 'astroway' &&
              (activeSessionId || recoverableSession) &&
              !running &&
              cooldownRemainingSec === null && (
                <button
                  type="button"
                  onClick={() => void handleResetAstroWaySession()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/20 bg-[#FDFBF7] px-3.5 py-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Session</span>
                </button>
              )}

            <button
              type="button"
              disabled={
                running ||
                cooldownRemainingSec !== null ||
                !selectedProfileId ||
                !activeSecretConfigured
              }
              onClick={() => void handleRunV2Diagnostic()}
              className="inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-45 transition-colors cursor-pointer"
            >
              {cooldownRemainingSec !== null ? (
                <Clock className="h-3.5 w-3.5 animate-pulse" />
              ) : (pausedByUser || recoverableSession) &&
                provider === 'astroway' &&
                (activeSessionId || recoverableSession) &&
                ((result?.layerA.batchState?.remainingEligibleCount ??
                  recoverableSession?.remainingEligibleCount ??
                  0) > 0) ? (
                <Play className="h-3.5 w-3.5" />
              ) : (
                <FlaskConical className={`h-3.5 w-3.5 ${running ? 'animate-pulse' : ''}`} />
              )}
              <span>
                {cooldownRemainingSec !== null
                  ? `Retry-After Cooldown (${cooldownRemainingSec}s)...`
                  : running
                  ? `Running Isolated ${provider === 'astroway' ? 'AstroWay Batch' : 'V2'}...`
                  : provider === 'astroway' &&
                    (activeSessionId || recoverableSession) &&
                    ((result?.layerA.providerId === 'astroway' &&
                      (result?.layerA.batchState?.remainingEligibleCount ?? 0) > 0) ||
                      (recoverableSession?.remainingEligibleCount ?? 0) > 0)
                  ? `Resume Acquisition (${
                      result?.layerA.providerId === 'astroway'
                        ? result?.layerA.batchState?.remainingEligibleCount
                        : recoverableSession?.remainingEligibleCount
                    } left)`
                  : `Generate Isolated ${provider === 'astroway' ? 'AstroWay' : 'FreeAstroAPI'} V2 Bundle`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-4 py-3 text-xs text-[#7A3E36] flex items-start gap-2">
          <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Display & Downloads */}
      {result && downloadPayloads && (
        <div className="space-y-5 border-t border-[#3D3830]/12 pt-5">
          {/* Partial or Failed Acquisition Alert */}
          {(result.layerA.acquisitionStatus !== 'complete' ||
            result.layerA.validationFailures.length > 0) && (
            <div className="rounded-2xl border border-[#B8965A]/40 bg-[#B8965A]/10 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-semibold text-[#3D3830]">
                <AlertTriangle className="h-4 w-4 text-[#8B6B2E]" />
                <span>
                  Acquisition Status: {result.layerA.acquisitionStatus.toUpperCase()}
                  {result.layerA.batchState ? ` (${result.layerA.batchState.status.toUpperCase()})` : ''} —{' '}
                  {result.layerA.quotaAndPerformanceSummary.successfulCalls} acquired ·{' '}
                  {result.layerA.quotaAndPerformanceSummary.unexecutedCalls ?? 0} queued ·{' '}
                  {result.layerA.quotaAndPerformanceSummary.failedCalls} failed (successful responses preserved)
                </span>
              </div>
              {result.layerA.missingDatasets.length > 0 && (
                <ul className="list-disc pl-5 space-y-0.5 text-[#5C5449]">
                  {result.layerA.missingDatasets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {result.layerA.validationFailures.length > 0 && (
                <ul className="list-disc pl-5 space-y-0.5 text-[#7A3E36]">
                  {result.layerA.validationFailures.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Download Suite */}
          <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[#3D3830]">
                  Diagnostic Export Artifacts — {result.profileSummary.name} ({result.layerA.providerLabel || result.layerA.providerId})
                </div>
                <div className="font-mono text-[11px] text-[#8B8275] mt-0.5">
                  Canonical UTC: {result.layerA.canonicalUtcIso} · JD {result.layerA.canonicalJulianDayUt} ·{' '}
                  {result.layerB.canonicalBirthInstant.timezone.ianaTimezone ||
                    `Offset ${result.layerB.canonicalBirthInstant.timezone.historicalUtcOffsetHours}h`}{' '}
                  ({result.layerB.canonicalBirthInstant.timezone.resolutionMethod})
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  triggerJsonDownload(
                    `${filePrefix}-complete-bundle.json`,
                    downloadPayloads.completeDiagnosticBundle
                  )
                }
                className="inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>
                  Download Complete Diagnostic Bundle (
                  {formatKb(result.runtimeTelemetry.artifactSizesBytes.totalResponseBytes)})
                </span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  triggerJsonDownload(
                    `${filePrefix}-raw-api-responses.json`,
                    downloadPayloads.rawApiResponses
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
              >
                <Download className="h-3 w-3" />
                <span>Raw API Responses JSON</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  triggerJsonDownload(`${filePrefix}-layer-a.json`, downloadPayloads.layerA)
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
              >
                <Download className="h-3 w-3" />
                <span>
                  Layer A JSON ({formatKb(result.runtimeTelemetry.artifactSizesBytes.layerABytes)})
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  triggerJsonDownload(`${filePrefix}-layer-b.json`, downloadPayloads.layerB)
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
              >
                <Download className="h-3 w-3" />
                <span>
                  Layer B JSON ({formatKb(result.runtimeTelemetry.artifactSizesBytes.layerBBytes)})
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  triggerJsonDownload(`${filePrefix}-layer-c-shell.json`, downloadPayloads.layerC)
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
              >
                <Download className="h-3 w-3" />
                <span>
                  Layer C Shell JSON ({formatKb(result.runtimeTelemetry.artifactSizesBytes.layerCBytes)})
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  triggerJsonDownload(
                    `${filePrefix}-verification-provenance.json`,
                    downloadPayloads.verificationAndProvenance
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
              >
                <Download className="h-3 w-3" />
                <span>
                  Verification &amp; Provenance JSON (
                  {formatKb(result.runtimeTelemetry.artifactSizesBytes.verificationReportBytes)})
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  triggerJsonDownload(
                    `${filePrefix}-consolidated-foundational-chart.json`,
                    downloadPayloads.consolidatedFoundationalChart
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
              >
                <Download className="h-3 w-3" />
                <span>
                  Consolidated Foundational Chart + Manifest JSON
                  {result.runtimeTelemetry.artifactSizesBytes.compiledFoundationalChartBytes
                    ? ` (${formatKb(result.runtimeTelemetry.artifactSizesBytes.compiledFoundationalChartBytes)})`
                    : ''}
                </span>
              </button>

              {downloadPayloads.analyticalEvidenceRepository && (
                <button
                  type="button"
                  onClick={() =>
                    triggerJsonDownload(
                      `${filePrefix}-analytical-evidence-repository-k01.json`,
                      downloadPayloads.analyticalEvidenceRepository
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
                >
                  <Download className="h-3 w-3" />
                  <span>
                    Analytical Evidence Repository (K01) JSON
                    {result.runtimeTelemetry.artifactSizesBytes.analyticalEvidenceRepositoryBytes
                      ? ` (${formatKb(result.runtimeTelemetry.artifactSizesBytes.analyticalEvidenceRepositoryBytes)})`
                      : ''}
                  </span>
                </button>
              )}

              {downloadPayloads.k02PlanetaryStateIntelligence && (
                <button
                  type="button"
                  onClick={() =>
                    triggerJsonDownload(
                      `${filePrefix}-k02-planetary-state-intelligence.json`,
                      downloadPayloads.k02PlanetaryStateIntelligence
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
                >
                  <Download className="h-3 w-3" />
                  <span>
                    K02 Planetary State JSON
                    {result.runtimeTelemetry.artifactSizesBytes.k02PlanetaryStateIntelligenceBytes
                      ? ` (${formatKb(result.runtimeTelemetry.artifactSizesBytes.k02PlanetaryStateIntelligenceBytes)})`
                      : ''}
                  </span>
                </button>
              )}

              {downloadPayloads.analyticalRuleRegistry && (
                <button
                  type="button"
                  onClick={() =>
                    triggerJsonDownload(
                      `${filePrefix}-analytical-rule-registry.json`,
                      downloadPayloads.analyticalRuleRegistry
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
                >
                  <Download className="h-3 w-3" />
                  <span>
                    Analytical Rule Registry JSON
                    {result.runtimeTelemetry.artifactSizesBytes.analyticalRuleRegistryBytes
                      ? ` (${formatKb(result.runtimeTelemetry.artifactSizesBytes.analyticalRuleRegistryBytes)})`
                      : ''}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  triggerJsonDownload(
                    `${filePrefix}-legacy-vs-v2-comparison.json`,
                    downloadPayloads.legacyVsV2Comparison
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
              >
                <Download className="h-3 w-3" />
                <span>
                  Legacy vs V2 Comparison JSON (
                  {formatKb(result.runtimeTelemetry.artifactSizesBytes.legacyVsV2ComparisonBytes)})
                </span>
              </button>
            </div>
          </div>

          {/* Batched Execution & 7-State Classification Summary */}
          {result.layerA.batchState && (
            <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-medium text-[#3D3830]">
                  Resumable Batched Acquisition Coordinator — Batch #{result.layerA.batchState.batchIndex}
                  {result.layerA.batchState.resumedFromSession ? ' (Resumed Session)' : ''}
                </div>
                <span
                  className={`font-mono text-[11px] px-2 py-0.5 rounded-md border ${
                    result.layerA.batchState.status === 'completed'
                      ? 'border-[#2D6A4F]/30 bg-[#2D6A4F]/8 text-[#2D6A4F]'
                      : result.layerA.batchState.status === 'completed_with_restrictions'
                      ? 'border-[#B8965A]/40 bg-[#B8965A]/12 text-[#6B5120]'
                      : 'border-[#B8965A]/45 bg-[#B8965A]/12 text-[#7A3E36]'
                  }`}
                >
                  {result.layerA.batchState.status}
                </span>
              </div>

              <div className="w-full h-2 rounded-full bg-[#EAE3D7] overflow-hidden">
                <div
                  className="h-full bg-[#4A453D] transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((result.layerA.batchState.totalPlannedCount -
                          result.layerA.batchState.remainingEligibleCount) /
                          Math.max(1, result.layerA.batchState.totalPlannedCount)) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] text-[#5C5449] tabular-nums">
                <span>
                  Settled:{' '}
                  <strong className="text-[#3D3830]">
                    {result.layerA.batchState.totalPlannedCount -
                      result.layerA.batchState.remainingEligibleCount}
                    /{result.layerA.batchState.totalPlannedCount}
                  </strong>
                </span>
                <span>
                  Executed This Batch: <strong className="text-[#3D3830]">{result.layerA.batchState.executedThisBatch}</strong>
                </span>
                <span>
                  Cooldown Wait:{' '}
                  <strong className="text-[#3D3830]">
                    {(result.layerA.batchState.totalRateLimitWindowWaitMs / 1000).toFixed(1)}s
                  </strong>
                </span>
                {result.layerA.batchState.rateLimitRemainingObserved !== null && (
                  <span>
                    Window Remaining:{' '}
                    <strong className="text-[#3D3830]">
                      {result.layerA.batchState.rateLimitRemainingObserved}
                      {result.layerA.batchState.rateLimitLimitObserved !== null
                        ? `/${result.layerA.batchState.rateLimitLimitObserved}`
                        : ''}
                    </strong>
                  </span>
                )}
              </div>

              {result.layerA.batchState.haltedReason && (
                <div className="text-[11px] font-mono text-[#5C5449]">
                  {result.layerA.batchState.haltedReason}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 font-mono text-[10px] tabular-nums">
                {(
                  [
                    ['successfully_acquired', 'Acquired', 'text-[#2D6A4F] border-[#2D6A4F]/25 bg-[#2D6A4F]/5'],
                    ['rate_limited', 'Rate Limited', 'text-[#8B6B2E] border-[#B8965A]/35 bg-[#B8965A]/10'],
                    ['runtime_execution_blocked', 'Runtime Blocked', 'text-[#7A3E36] border-[#7A3E36]/25 bg-[#7A3E36]/5'],
                    ['tier_restricted', 'Tier Restricted', 'text-[#7A3E36] border-[#B8965A]/35 bg-[#B8965A]/10'],
                    ['not_offered_by_provider', 'Not Offered', 'text-[#5C5449] border-[#3D3830]/15 bg-[#FDFBF7]'],
                    ['not_yet_tested', 'Not Yet Tested', 'text-[#8B8275] border-[#3D3830]/12 bg-[#FDFBF7]'],
                    ['mathematical_verification_failed', 'Math Failed', 'text-[#7A3E36] border-[#7A3E36]/30 bg-[#7A3E36]/8'],
                  ] as const
                ).map(([key, label, tone]) => (
                  <div key={key} className={`rounded-xl border px-2.5 py-2 ${tone}`}>
                    <div className="font-sans text-[10px] opacity-85">{label}</div>
                    <div className="text-sm font-medium mt-0.5">
                      {result.layerA.batchState?.classificationCounts?.[key] ?? 0}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Measured API & Worker Telemetry */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-3.5">
              <div className="text-[11px] text-[#8B8275]">Measured API Requests</div>
              <div className="font-mono text-sm font-medium text-[#3D3830] mt-0.5 tabular-nums">
                {result.layerA.quotaAndPerformanceSummary.actualHttpRequestsSent} sent /{' '}
                {result.layerA.quotaAndPerformanceSummary.plannedRequestsCount} planned
              </div>
              <div className="font-mono text-[10px] text-[#8B8275] mt-0.5">
                {result.layerA.quotaAndPerformanceSummary.successfulCalls} OK ·{' '}
                {result.layerA.quotaAndPerformanceSummary.failedCalls} failed ·{' '}
                {result.layerA.quotaAndPerformanceSummary.unexecutedCalls ?? 0} queued
              </div>
            </div>

            <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-3.5">
              <div className="text-[11px] text-[#8B8275]">Measured Timing &amp; Coordination</div>
              <div className="font-mono text-sm font-medium text-[#3D3830] mt-0.5 tabular-nums">
                {(result.runtimeTelemetry.executionDurationMs / 1000).toFixed(2)}s batch
              </div>
              <div className="font-mono text-[10px] text-[#8B8275] mt-0.5">
                HTTP {result.layerA.quotaAndPerformanceSummary.totalLatencyMs}ms · Rate wait{' '}
                {result.layerA.quotaAndPerformanceSummary.rateLimitWindowWaitMs ??
                  result.layerA.quotaAndPerformanceSummary.totalRateWaitMs}
                ms
              </div>
            </div>

            <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-3.5">
              <div className="text-[11px] text-[#8B8275]">Payload &amp; Runtime Footprint</div>
              <div className="font-mono text-sm font-medium text-[#3D3830] mt-0.5 tabular-nums">
                {formatKb(result.layerA.quotaAndPerformanceSummary.totalPayloadBytes)} raw
              </div>
              <div className="font-mono text-[10px] text-[#8B8275] mt-0.5">
                Bundle {formatKb(result.runtimeTelemetry.artifactSizesBytes.totalResponseBytes)} ·{' '}
                {result.bundleMetadata.runtimeEnvironment}
              </div>
            </div>

            <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-3.5">
              <div className="text-[11px] text-[#8B8275]">Provider Quota &amp; Credits</div>
              <div className="font-mono text-xs font-medium text-[#3D3830] mt-0.5">
                {result.layerA.quotaAndPerformanceSummary.quotaHeadersObserved.status ===
                'measured_from_headers'
                  ? result.layerA.quotaAndPerformanceSummary.quotaHeadersObserved.creditsUsedTotal != null
                    ? `${result.layerA.quotaAndPerformanceSummary.quotaHeadersObserved.creditsUsedTotal} credits used`
                    : 'Measured from headers'
                  : 'Not provided by provider'}
              </div>
              <div className="font-mono text-[10px] text-[#8B8275] mt-0.5">
                {result.layerA.quotaAndPerformanceSummary.quotaHeadersObserved.creditsRemainingFinal != null
                  ? `Rem: ${result.layerA.quotaAndPerformanceSummary.quotaHeadersObserved.creditsRemainingFinal} · Tier restricted: ${result.layerA.quotaAndPerformanceSummary.tierRestrictedCalls ?? 0}`
                  : `Coord: ${result.layerA.quotaAndPerformanceSummary.coordinationModesObserved.join(', ')}`}
              </div>
            </div>
          </div>

          {/* Tier-Restricted Endpoints (Upgrade Evaluation) */}
          {(result.layerA.quotaAndPerformanceSummary.quotaHeadersObserved.tierRestrictedEndpoints
            ?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-[#B8965A]/40 bg-[#B8965A]/10 p-4 space-y-1.5 text-xs">
              <div className="font-medium text-[#3D3830]">
                Tier-Restricted Endpoints (Upgrade Evaluation Required)
              </div>
              <div className="font-mono text-[11px] text-[#5C5449]">
                {result.layerA.quotaAndPerformanceSummary.quotaHeadersObserved.tierRestrictedEndpoints!.join(
                  ' · '
                )}
              </div>
            </div>
          )}

          {/* Per-Endpoint Measured Call Table */}
          <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-[#3D3830]">
              <Database className="h-3.5 w-3.5 text-[#8B7355]" />
              <span>Per-Endpoint Measured HTTP Calls &amp; Quota Observation ({Object.keys(result.layerA.calls).length} calls)</span>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left font-mono text-[11px] tabular-nums">
                <thead>
                  <tr className="border-b border-[#3D3830]/12 text-[#8B8275]">
                    <th className="py-1.5 pr-3">Endpoint</th>
                    <th className="py-1.5 pr-3">Tier</th>
                    <th className="py-1.5 pr-3">Status &amp; Classification</th>
                    <th className="py-1.5 pr-3">Quality / Note</th>
                    <th className="py-1.5 pr-3">Attempts</th>
                    <th className="py-1.5 pr-3">HTTP Latency</th>
                    <th className="py-1.5 pr-3">Rate Wait</th>
                    <th className="py-1.5 pr-3">Coord Mode</th>
                    <th className="py-1.5">Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3D3830]/8 text-[#3D3830]">
                  {Object.values(result.layerA.calls).map((call) => {
                    const cls =
                      call.acquisitionClassification ||
                      (call.attempts === 0
                        ? 'not_yet_tested'
                        : call.ok
                        ? 'successfully_acquired'
                        : call.httpStatus === 429
                        ? 'rate_limited'
                        : call.accessRestricted
                        ? 'tier_restricted'
                        : 'runtime_execution_blocked');
                    const statusTone =
                      cls === 'successfully_acquired'
                        ? 'text-[#2D6A4F]'
                        : cls === 'not_yet_tested' || cls === 'not_offered_by_provider'
                        ? 'text-[#8B8275]'
                        : cls === 'rate_limited' || cls === 'tier_restricted'
                        ? 'text-[#8B6B2E]'
                        : 'text-[#7A3E36]';

                    return (
                      <tr key={call.id}>
                        <td className="py-1.5 pr-3">
                          <span>{call.endpoint}</span>
                          {call.category && (
                            <span className="ml-1.5 text-[10px] text-[#8B8275]">[{call.category}]</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-3 text-[#8B8275]">
                          {call.priorityTier ? `T${call.priorityTier}` : '—'}
                        </td>
                        <td className={`py-1.5 pr-3 ${statusTone}`}>
                          {call.attempts === 0 ? 'QUEUED' : `HTTP ${call.httpStatus}`} · {cls}
                        </td>
                        <td className="py-1.5 pr-3 text-[10px]">
                          {call.declaredQuality ? (
                            <span
                              className={
                                call.declaredQuality === 'yellow'
                                  ? 'text-[#8B6B2E]'
                                  : 'text-[#2D6A4F]'
                              }
                            >
                              {call.declaredQuality}
                            </span>
                          ) : (
                            '—'
                          )}
                          {call.creditsUsed != null ? ` · ${call.creditsUsed}cr` : ''}
                        </td>
                        <td className="py-1.5 pr-3">{call.attempts}</td>
                        <td className="py-1.5 pr-3">{call.latencyMs}ms</td>
                        <td className="py-1.5 pr-3">{call.rateWaitMs}ms</td>
                        <td className="py-1.5 pr-3">{call.coordinationMode}</td>
                        <td className="py-1.5">{formatKb(call.payloadBytes)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-[#8B8275]">
              {result.layerA.quotaAndPerformanceSummary.quotaHeadersObserved.note}
            </p>
          </div>

          {/* Mode A vs Mode B Shadbala & Kala Subcomponents Probe Snapshot */}
          {result.layerA.timezoneEquivalenceCheck && (
            <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-[#3D3830]">
                  Mode A (IANA) vs Mode B (UTC) Timezone &amp; Shadbala Invariance Probe
                </span>
                <span
                  className={`font-mono text-[11px] ${
                    result.layerA.timezoneEquivalenceCheck.status === 'verified_equivalent' ||
                    (result.layerA.timezoneEquivalenceCheck.executed &&
                      result.layerA.timezoneEquivalenceCheck.equivalent)
                      ? 'text-[#2D6A4F]'
                      : result.layerA.timezoneEquivalenceCheck.status === 'incomplete_due_to_rate_limit' ||
                        result.layerA.timezoneEquivalenceCheck.status === 'not_yet_tested'
                      ? 'text-[#8B6B2E]'
                      : 'text-[#7A3E36]'
                  }`}
                >
                  {result.layerA.timezoneEquivalenceCheck.status
                    ? result.layerA.timezoneEquivalenceCheck.status.toUpperCase()
                    : result.layerA.timezoneEquivalenceCheck.equivalent
                    ? 'INVARIANT'
                    : 'DIVERGED'}
                </span>
              </div>

              {result.layerA.timezoneEquivalenceCheck.shadbalaComparison?.available ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-[11px] tabular-nums">
                    <thead>
                      <tr className="border-b border-[#3D3830]/12 text-[#8B8275]">
                        <th className="py-1.5 pr-3">Planet</th>
                        <th className="py-1.5 pr-3">Mode A (IANA)</th>
                        <th className="py-1.5 pr-3">Mode B (UTC)</th>
                        <th className="py-1.5 pr-3">Total Δ</th>
                        <th className="py-1.5 pr-3">Kala Δ</th>
                        <th className="py-1.5">Driver / Subcomponents</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3D3830]/8 text-[#3D3830]">
                      {result.layerA.timezoneEquivalenceCheck.shadbalaComparison.perPlanet.map(
                        (row) => (
                          <tr key={row.planet}>
                            <td className="py-1.5 pr-3 font-medium">{row.planet}</td>
                            <td className="py-1.5 pr-3">{row.modeATotal.toFixed(2)}V</td>
                            <td className="py-1.5 pr-3">{row.modeBTotal.toFixed(2)}V</td>
                            <td
                              className={`py-1.5 pr-3 ${
                                Math.abs(row.totalDelta) > 0.02 ? 'text-[#7A3E36]' : 'text-[#2D6A4F]'
                              }`}
                            >
                              {row.totalDelta}V
                            </td>
                            <td className="py-1.5 pr-3">{row.componentDeltas.kala_bala}V</td>
                            <td className="py-1.5 text-[10px] text-[#5C5449]">
                              {row.suspectedKalaBalaDriver ||
                                (row.subcomponentDeltas ? 'All 6 Kala subcomponents 0.00V' : '—')}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="font-mono text-[11px] text-[#5C5449]">
                  {result.layerA.timezoneEquivalenceCheck.notes.join(' | ')}
                </p>
              )}
            </div>
          )}

          {/* Shadbala Methodological Investigation */}
          {result.layerB.shadbalaReconciliation.data?.methodologicalInvestigation && (
            <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-medium text-[#3D3830]">
                  Shadbala Methodological Investigation (Unassigned Pending Reconciliation)
                </div>
                <span className="font-mono text-[11px] text-[#8B6B2E]">
                  {result.layerB.shadbalaReconciliation.data.authoritativeDesignation}
                </span>
              </div>
              <p className="text-[11px] text-[#5C5449]">
                {result.layerB.shadbalaReconciliation.data.methodologicalInvestigation.referenceBasisSummary}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                <div className="rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] p-3 space-y-1">
                  <div className="font-medium text-[#3D3830]">
                    Zero Luminary Cheshta Bala Convention
                  </div>
                  <div className="font-mono text-[10px] text-[#5C5449]">
                    Provider Sun={result.layerB.shadbalaReconciliation.data.methodologicalInvestigation.cheshtaBalaZeroLuminaries.sunProviderCheshta ?? '—'}V, Moon={result.layerB.shadbalaReconciliation.data.methodologicalInvestigation.cheshtaBalaZeroLuminaries.moonProviderCheshta ?? '—'}V · Legacy Sun={result.layerB.shadbalaReconciliation.data.methodologicalInvestigation.cheshtaBalaZeroLuminaries.sunLegacyLocalCheshta ?? '—'}V, Moon={result.layerB.shadbalaReconciliation.data.methodologicalInvestigation.cheshtaBalaZeroLuminaries.moonLegacyLocalCheshta ?? '—'}V
                  </div>
                  <p className="text-[#5C5449]">
                    {result.layerB.shadbalaReconciliation.data.methodologicalInvestigation.cheshtaBalaZeroLuminaries.conventionExplanation}
                  </p>
                </div>

                <div className="rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] p-3 space-y-1">
                  <div className="font-medium text-[#3D3830]">Kala Bala 6-Field Rollup Audit</div>
                  <div className="font-mono text-[10px] text-[#5C5449]">
                    abdaMasaVaraHora combined:{' '}
                    {String(
                      result.layerB.shadbalaReconciliation.data.methodologicalInvestigation
                        .kalaBalaRollupAudit.abdaMasaVaraHoraCombined
                    )}
                  </div>
                  <ul className="list-disc pl-4 text-[#5C5449] space-y-0.5">
                    {result.layerB.shadbalaReconciliation.data.methodologicalInvestigation.kalaBalaRollupAudit.openApiKnownCaveats.map(
                      (c) => (
                        <li key={c}>{c}</li>
                      )
                    )}
                  </ul>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px] tabular-nums">
                  <thead>
                    <tr className="border-b border-[#3D3830]/12 text-[#8B8275]">
                      <th className="py-1.5 pr-3">Planet</th>
                      <th className="py-1.5 pr-3">WS vs Sripati House</th>
                      <th className="py-1.5 pr-3">Kendradi Δ</th>
                      <th className="py-1.5 pr-3">Saptavargaja Δ</th>
                      <th className="py-1.5 pr-3">BPHS Min</th>
                      <th className="py-1.5">Threshold / Pass-Fail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3D3830]/8 text-[#3D3830]">
                    {result.layerB.shadbalaReconciliation.data.methodologicalInvestigation.sthanaDeltaDrivers.map(
                      (drv) => {
                        const rev =
                          result.layerB.shadbalaReconciliation.data?.methodologicalInvestigation?.thresholdReversals.find(
                            (r) => r.planet === drv.planet
                          );
                        return (
                          <tr key={drv.planet}>
                            <td className="py-1.5 pr-3 font-medium">{drv.planet}</td>
                            <td className="py-1.5 pr-3">
                              H{drv.wholeSignHouse} / Bh{drv.sripatiHouse}
                              {drv.placidusHouse ? ` / Pl${drv.placidusHouse}` : ''}
                            </td>
                            <td className="py-1.5 pr-3">
                              {drv.kendradiDeltaSripatiMinusWholeSign > 0 ? '+' : ''}
                              {drv.kendradiDeltaSripatiMinusWholeSign}V
                            </td>
                            <td className="py-1.5 pr-3">
                              {drv.saptavargajaDeltaPanchadhaMinusNatural > 0 ? '+' : ''}
                              {drv.saptavargajaDeltaPanchadhaMinusNatural}V
                            </td>
                            <td className="py-1.5 pr-3">{rev?.bphsRequiredRupas ?? '—'}R</td>
                            <td
                              className={`py-1.5 text-[10px] ${
                                rev?.providerVsLocalPassMismatch ? 'text-[#7A3E36]' : 'text-[#5C5449]'
                              }`}
                            >
                              {rev?.notes || drv.explanation}
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AstroWay Extended Classical Coverage Snapshot */}
          {result.layerB.providerExtendedDatasets && (
            <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-2">
              <div className="text-xs font-medium text-[#3D3830]">
                Extended Classical Datasets Coverage ({result.layerA.providerLabel || result.layerA.providerId})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 font-mono text-[11px]">
                {result.layerB.remainingClassicalGaps.map((gap) => (
                  <div
                    key={gap.capability}
                    className="rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] px-3 py-2"
                  >
                    <div className="font-sans text-[11px] font-medium text-[#3D3830]">
                      {gap.capability}
                    </div>
                    <div
                      className={`mt-0.5 text-[10px] ${
                        gap.selectedProviderStatus === 'available_green'
                          ? 'text-[#2D6A4F]'
                          : gap.selectedProviderStatus === 'available_yellow'
                          ? 'text-[#8B6B2E]'
                          : 'text-[#7A3E36]'
                      }`}
                    >
                      Status: {gap.selectedProviderStatus || gap.freeAstroApiStatus}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5-Category Epistemic Classification */}
          <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-[#3D3830]">
                <ShieldCheck className="h-4 w-4 text-[#2D6A4F]" />
                <span>
                  5-Category Epistemic Classification ({result.verificationReport.passedCount} passed ·{' '}
                  {result.verificationReport.failedCount} failed · mode={result.verificationReport.mode})
                </span>
              </div>
              <span className="font-mono text-[11px] text-[#5C5449]">
                Shadbala Designation:{' '}
                <strong className="text-[#3D3830]">
                  {result.layerB.shadbalaReconciliation.data?.authoritativeDesignation ||
                    'unassigned_pending_reconciliation'}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {[
                {
                  title: '1. Provider Data Acquired',
                  tone: 'border-[#3D3830]/15 bg-[#FDFBF7]',
                  items: result.verificationReport.epistemicClassification.providerDataAcquired,
                },
                {
                  title: '2. Internal Math & Internal Solver Verified',
                  tone: 'border-[#2D6A4F]/25 bg-[#2D6A4F]/5',
                  items:
                    result.verificationReport.epistemicClassification
                      .internalMathConsistencyVerified,
                },
                {
                  title: '3. External JHora / PyJHora / SwissEph Validated',
                  tone: 'border-[#2D6A4F]/25 bg-[#2D6A4F]/5',
                  items:
                    result.verificationReport.epistemicClassification
                      .independentlyValidatedAgainstExternalReference,
                },
                {
                  title: '4. Methodology Unresolved',
                  tone: 'border-[#B8965A]/40 bg-[#B8965A]/8',
                  items: result.verificationReport.epistemicClassification.methodologyUnresolved,
                },
                {
                  title: '5. Dataset Unavailable',
                  tone: 'border-[#7A3E36]/25 bg-[#7A3E36]/5 md:col-span-2',
                  items: result.verificationReport.epistemicClassification.datasetUnavailable,
                },
              ].map((bucket) => (
                <div key={bucket.title} className={`rounded-xl border p-3 space-y-2 ${bucket.tone}`}>
                  <div className="flex items-center justify-between gap-2 font-medium text-[#3D3830]">
                    <span>{bucket.title}</span>
                    <span className="font-mono text-[11px] text-[#8B8275]">
                      {bucket.items.length}
                    </span>
                  </div>
                  {bucket.items.length === 0 ? (
                    <div className="text-[11px] text-[#8B8275]">
                      {bucket.title.startsWith('3.')
                        ? 'None (internal solver checks are in Bucket 2; external JHora/PyJHora pending)'
                        : 'None'}
                    </div>
                  ) : (
                    <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {bucket.items.map((item) => (
                        <li key={item.key} className="text-[11px] text-[#5C5449]">
                          <div className="font-medium text-[#3D3830]">{item.label}</div>
                          <div className="font-mono text-[10px] text-[#5C5449]">{item.detail}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Legacy vs V2 Comparison Snapshot */}
          <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-medium text-[#3D3830]">
                Legacy Profile vs Isolated V2 Comparison
              </div>
              <div className="font-mono text-[11px] text-[#5C5449]">
                {result.legacyVsV2Comparison.hasLegacyChart
                  ? `Stored provider: ${result.legacyVsV2Comparison.legacyMeta.providerLabelRecorded || result.legacyVsV2Comparison.legacyMeta.providerRecorded || 'unknown'}`
                  : 'No stored legacy chart on this profile'}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[11px] tabular-nums">
                <thead>
                  <tr className="border-b border-[#3D3830]/12 text-[#8B8275]">
                    <th className="py-1.5 pr-3">Coordinate (Lahiri)</th>
                    <th className="py-1.5 pr-3">Legacy Stored</th>
                    <th className="py-1.5 pr-3">V2 Provider</th>
                    <th className="py-1.5 pr-3">Independent Ref</th>
                    <th className="py-1.5 pr-3">Legacy − Ref</th>
                    <th className="py-1.5">V2 − Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3D3830]/8 text-[#3D3830]">
                  {(
                    [
                      ['Ascendant', result.legacyVsV2Comparison.primaryCoordinatesComparison.ascendant],
                      ['Sun', result.legacyVsV2Comparison.primaryCoordinatesComparison.sun],
                      ['Moon', result.legacyVsV2Comparison.primaryCoordinatesComparison.moon],
                    ] as const
                  ).map(([label, row]) => (
                    <tr key={label}>
                      <td className="py-1.5 pr-3 font-medium">{label}</td>
                      <td className="py-1.5 pr-3">{row.legacyDeg ?? '—'}°</td>
                      <td className="py-1.5 pr-3">{row.v2ProviderDeg ?? '—'}°</td>
                      <td className="py-1.5 pr-3">{row.independentRefDeg}°</td>
                      <td className="py-1.5 pr-3">{row.legacyMinusRefDeg ?? '—'}°</td>
                      <td className="py-1.5">{row.v2MinusRefDeg ?? '—'}°</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] font-mono text-[#5C5449]">
              <div className="rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] p-3">
                <div className="text-[#8B8275] font-sans">KP Cusps &amp; Bhava Chalit</div>
                <div className="text-[#3D3830] mt-1">
                  Legacy KP sign flips vs ref:{' '}
                  {
                    result.legacyVsV2Comparison.kpCuspsComparison.filter(
                      (c) => c.signFlipBetweenLegacyAndRef
                    ).length
                  }
                  /12
                </div>
                <div className="mt-0.5">
                  Chalit shifts: Legacy={result.legacyVsV2Comparison.bhavaChalitComparison.legacyShiftedCount ?? '—'}{' '}
                  · V2={result.legacyVsV2Comparison.bhavaChalitComparison.v2ProviderShiftedCount ?? '—'}{' '}
                  · Ref Sripati={result.legacyVsV2Comparison.bhavaChalitComparison.independentSripatiShiftedCount}
                </div>
              </div>

              <div className="rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] p-3">
                <div className="text-[#8B8275] font-sans">Shadbala (Unassigned)</div>
                <div className="text-[#3D3830] mt-1">
                  Legacy Local vs API max Δ:{' '}
                  {result.legacyVsV2Comparison.shadbalaComparison.maxVirupaConflictBetweenLegacyLocalAndApi ??
                    '—'}
                  V
                </div>
                <div className="mt-0.5 truncate">
                  V2 order:{' '}
                  {result.legacyVsV2Comparison.shadbalaComparison.v2ProviderOrder.join(' > ') || '—'}
                </div>
              </div>

              <div className="rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] p-3">
                <div className="text-[#8B8275] font-sans">Completeness Delta</div>
                <div className="text-[#3D3830] mt-1">
                  Vargas: {result.legacyVsV2Comparison.datasetCompletenessComparison.legacyVargasCount} (D5:
                  {result.legacyVsV2Comparison.datasetCompletenessComparison.legacyHasD5 ? 'Y' : 'N'}) →{' '}
                  {result.legacyVsV2Comparison.datasetCompletenessComparison.v2VargasCount} (D5:
                  {result.legacyVsV2Comparison.datasetCompletenessComparison.v2HasD5 ? 'Y' : 'N'})
                </div>
                <div className="mt-0.5">
                  Prasthara: {result.legacyVsV2Comparison.datasetCompletenessComparison.v2HasPrastharaAshtakavarga ? 'Yes' : 'No'} · Ephemeris:{' '}
                  {result.legacyVsV2Comparison.datasetCompletenessComparison.v2HasEphemerisTelemetry ? 'Yes' : 'No'}
                </div>
              </div>
            </div>

            {result.legacyVsV2Comparison.legacyDefectAudit?.affected && (
              <div className="rounded-xl border border-[#7A3E36]/20 bg-[#7A3E36]/5 p-3 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-[#7A3E36]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>
                    Legacy Defect Audit ({result.legacyVsV2Comparison.legacyDefectAudit.severity}):
                  </span>
                </div>
                <ul className="list-disc pl-5 text-[11px] text-[#5C5449] space-y-0.5">
                  {result.legacyVsV2Comparison.legacyDefectAudit.defects.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default V2ChartEngineLaboratory;
