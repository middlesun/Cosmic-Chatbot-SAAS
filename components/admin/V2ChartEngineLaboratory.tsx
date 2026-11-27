import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FlaskConical,
  RefreshCw,
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

interface V2DiagnosticRunResult {
  bundleMetadata: {
    laboratory: string;
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
    providerId: string;
    providerBaseUrl: string;
    inputFingerprint: string;
    canonicalUtcIso: string;
    canonicalJulianDayUt: number;
    acquisitionStatus: 'complete' | 'partial' | 'failed';
    missingDatasets: string[];
    validationFailures: string[];
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
        quotaAndMetaHeaders: Record<string, string>;
        sanitizedRequest: Record<string, unknown>;
        rawResponse: unknown;
      }
    >;
    timezoneEquivalenceCheck?: {
      executed: boolean;
      equivalent: boolean;
      modeAStatus: number;
      modeBStatus: number;
      ascendantDeltaDeg: number | null;
      maxPlanetDeltaDeg: number | null;
      notes: string[];
    } | null;
    ephemerisTimestampCheck?: {
      exactTimestampMatch: boolean;
      returnedUtcInstant: string | null;
      expectedUtcIso: string;
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
        note: string;
      };
    };
  };
  layerB: {
    schemaVersion: string;
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
      } | null;
    };
    remainingClassicalGaps: Array<{
      capability: string;
      freeAstroApiStatus: string;
      localDerivedStatus: string;
    }>;
  };
  layerC: Record<string, unknown>;
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

const V2ChartEngineLaboratory: React.FC<V2ChartEngineLaboratoryProps> = ({ getAccessToken }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<V2DiagnosticProfileSummary[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [secretStatus, setSecretStatus] = useState<SecretStatusInfo | null>(null);

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

  const inFlightRef = useRef(false);

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

  const handleRunV2Diagnostic = async () => {
    if (inFlightRef.current || !selectedProfileId) return;
    inFlightRef.current = true;
    setRunning(true);
    setError(null);
    setAmbiguousCandidates([]);
    setProgressStage(
      includeTimezoneProbe
        ? 'Coordinating rate-limited 4-request acquisition + Mode A/B probe (~8–11s)...'
        : 'Coordinating rate-limited 4-request FreeAstroAPI V2 bundle (~5–7s)...'
    );

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
          profileId: selectedProfileId,
          ianaTimezoneOverride: ianaTimezoneOverride.trim() || null,
          dstFoldDisambiguation: dstFoldDisambiguation || null,
          birthTimePrecision,
          nodeConvention,
          includeTimezoneEquivalenceProbe: includeTimezoneProbe,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'AMBIGUOUS_LOCAL_TIME' && Array.isArray(data.candidates)) {
          setAmbiguousCandidates(data.candidates);
        }
        throw new Error(data.error || `Diagnostic failed (HTTP ${res.status})`);
      }

      setResult(data as V2DiagnosticRunResult);
      setAmbiguousCandidates([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'V2 diagnostic execution failed.');
    } finally {
      inFlightRef.current = false;
      setRunning(false);
      setProgressStage(null);
    }
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

    const completeDiagnosticBundle = {
      bundleMetadata: result.bundleMetadata,
      runtimeTelemetry: result.runtimeTelemetry,
      profileSummary: result.profileSummary,
      rawApiResponses,
      layerA: result.layerA,
      layerB: result.layerB,
      layerC: result.layerC,
      verificationAndProvenance,
      legacyVsV2Comparison: result.legacyVsV2Comparison,
    };

    return {
      completeDiagnosticBundle,
      rawApiResponses,
      layerA: result.layerA,
      layerB: result.layerB,
      layerC: result.layerC,
      verificationAndProvenance,
      legacyVsV2Comparison: result.legacyVsV2Comparison,
    };
  }, [result]);

  const filePrefix = result
    ? `v2-diag-${slugifyFilePart(result.profileSummary.name)}-${result.bundleMetadata.generatedAtUtc.slice(0, 10)}`
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
            Isolated, read-only diagnostic workbench reusing the server&apos;s{' '}
            <span className="font-mono">FREE_ASTRO_API_KEY</span> under provider-wide 1 req/sec rate
            coordination. Never overwrites existing profiles, charts, Council, Companion, or Reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] ${
              secretStatus?.configured
                ? 'border-[#2D6A4F]/25 bg-[#2D6A4F]/8 text-[#2D6A4F]'
                : 'border-[#7A3E36]/25 bg-[#7A3E36]/8 text-[#7A3E36]'
            }`}
          >
            FREE_ASTRO_API_KEY: {secretStatus?.configured ? 'Configured' : 'Unset in runtime'}
          </span>
        </div>
      </div>

      {/* Profile Selector + Configuration Controls */}
      <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
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

          <div className="lg:col-span-8 space-y-1.5">
            <label className="block text-xs font-medium text-[#5C5449]">
              Target Birth Profile (Read-Only)
            </label>
            <CustomSelect
              value={selectedProfileId}
              onChange={(val) => {
                setSelectedProfileId(val);
                setDstFoldDisambiguation('');
                setAmbiguousCandidates([]);
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

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-xs text-[#8B8275]">
            {progressStage ||
              'Executes 4 isolated endpoints (/vedic/calculate, /vedic/kp, /natal/calculate, /ephemeris/calculate).'}
          </div>
          <button
            type="button"
            disabled={running || !selectedProfileId || !secretStatus?.configured}
            onClick={() => void handleRunV2Diagnostic()}
            className="inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-45 transition-colors cursor-pointer"
          >
            <FlaskConical className={`h-3.5 w-3.5 ${running ? 'animate-pulse' : ''}`} />
            <span>
              {running
                ? 'Running Isolated V2 Acquisition...'
                : 'Generate Isolated V2 Diagnostic Bundle'}
            </span>
          </button>
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
                  Acquisition Status: {result.layerA.acquisitionStatus.toUpperCase()} — Successful
                  endpoint responses were preserved
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
                  Diagnostic Export Artifacts — {result.profileSummary.name}
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
                {result.layerA.quotaAndPerformanceSummary.retryCount} retries
              </div>
            </div>

            <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-3.5">
              <div className="text-[11px] text-[#8B8275]">Measured Timing &amp; Coordination</div>
              <div className="font-mono text-sm font-medium text-[#3D3830] mt-0.5 tabular-nums">
                {(result.runtimeTelemetry.executionDurationMs / 1000).toFixed(2)}s total
              </div>
              <div className="font-mono text-[10px] text-[#8B8275] mt-0.5">
                HTTP {result.layerA.quotaAndPerformanceSummary.totalLatencyMs}ms · Queue wait{' '}
                {result.layerA.quotaAndPerformanceSummary.totalRateWaitMs}ms
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
              <div className="text-[11px] text-[#8B8275]">Provider Quota Headers</div>
              <div className="font-mono text-xs font-medium text-[#3D3830] mt-0.5">
                {result.layerA.quotaAndPerformanceSummary.quotaHeadersObserved.status ===
                'measured_from_headers'
                  ? 'Measured from headers'
                  : 'Not provided by provider'}
              </div>
              <div className="font-mono text-[10px] text-[#8B8275] mt-0.5">
                Coord: {result.layerA.quotaAndPerformanceSummary.coordinationModesObserved.join(', ')}
              </div>
            </div>
          </div>

          {/* Per-Endpoint Measured Call Table */}
          <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-[#3D3830]">
              <Database className="h-3.5 w-3.5 text-[#8B7355]" />
              <span>Per-Endpoint Measured HTTP Calls &amp; Quota Observation</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[11px] tabular-nums">
                <thead>
                  <tr className="border-b border-[#3D3830]/12 text-[#8B8275]">
                    <th className="py-1.5 pr-3">Endpoint</th>
                    <th className="py-1.5 pr-3">Status</th>
                    <th className="py-1.5 pr-3">Attempts</th>
                    <th className="py-1.5 pr-3">HTTP Latency</th>
                    <th className="py-1.5 pr-3">Rate Wait</th>
                    <th className="py-1.5 pr-3">Coord Mode</th>
                    <th className="py-1.5">Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3D3830]/8 text-[#3D3830]">
                  {Object.values(result.layerA.calls).map((call) => (
                    <tr key={call.id}>
                      <td className="py-1.5 pr-3">{call.endpoint}</td>
                      <td
                        className={`py-1.5 pr-3 ${
                          call.ok ? 'text-[#2D6A4F]' : 'text-[#7A3E36]'
                        }`}
                      >
                        HTTP {call.httpStatus}
                      </td>
                      <td className="py-1.5 pr-3">{call.attempts}</td>
                      <td className="py-1.5 pr-3">{call.latencyMs}ms</td>
                      <td className="py-1.5 pr-3">{call.rateWaitMs}ms</td>
                      <td className="py-1.5 pr-3">{call.coordinationMode}</td>
                      <td className="py-1.5">{formatKb(call.payloadBytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-[#8B8275]">
              {result.layerA.quotaAndPerformanceSummary.quotaHeadersObserved.note}
            </p>
          </div>

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
