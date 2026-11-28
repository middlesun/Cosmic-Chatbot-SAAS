/**
 * K01 Extractor Shared Helpers
 *
 * Pure TypeScript / Web-standard helpers for mapping LayerCAnalyticalInput
 * provenance, verification statuses, conventions, and birth-time sensitivities
 * into K01 CanonicalEvidenceDrafts without coercion or silent promotion.
 */

import type { LayerCAnalyticalInput } from '../../v2Engine/layerCContract';
import type {
  CanonicalDatasetState,
  DatasetEnvelope,
  DatasetManifestEntry,
  DatasetVerificationStatus,
} from '../../v2Engine/types';
import {
  ANALYTICAL_KERNEL_VERSION,
  ANALYTICAL_RULE_VERSION,
  type CanonicalEvidenceDraft,
  type CanonicalEvidenceFrame,
  type ComputationalVerificationStatus,
  type EmpiricalValidationStatus,
  type EvidenceMethodology,
  type EvidenceSensitivityMetadata,
  type EvidenceSourceDatasetRef,
  type EvidenceVerificationMetadata,
  type EvidenceVersionMetadata,
  type MethodologicalVerificationStatus,
  type PlanetaryStateSubjectName,
  type PropagatedTrustLevel,
  type RejectedOrBlockedDatasetNotice,
} from '../types';

export interface ExtractionSharedContext {
  input: LayerCAnalyticalInput;
  chartFingerprint: string;
  versions: EvidenceVersionMetadata;
  manifestByKey: Map<string, DatasetManifestEntry>;
  baseSensitivity: EvidenceSensitivityMetadata;
  blockedNotices: RejectedOrBlockedDatasetNotice[];
}

export function createExtractionContext(input: LayerCAnalyticalInput): ExtractionSharedContext {
  const manifestByKey = new Map<string, DatasetManifestEntry>();
  for (const entry of input.datasetManifest.entries) {
    manifestByKey.set(entry.key, entry);
  }

  const btPrecision = input.canonicalBirthInstant.input.birthTimePrecision;
  const uncertaintyMin = input.canonicalBirthInstant.input.birthTimeUncertaintyMinutes;
  const birthTimeSensitive =
    btPrecision !== 'exact' || (typeof uncertaintyMin === 'number' && uncertaintyMin > 0);
  const reasons: string[] = [];
  if (birthTimeSensitive) {
    reasons.push(
      `Birth-time precision is "${btPrecision}"${
        typeof uncertaintyMin === 'number' ? ` (±${uncertaintyMin}m)` : ''
      }.`
    );
  }
  if (input.canonicalBirthInstant.timezone.dstFoldDisambiguationUsed) {
    reasons.push(
      `DST fold disambiguation used: ${input.canonicalBirthInstant.timezone.dstFoldDisambiguationUsed}.`
    );
  }

  return {
    input,
    chartFingerprint: input.inputFingerprint,
    versions: {
      kernelVersion: ANALYTICAL_KERNEL_VERSION,
      ruleVersion: ANALYTICAL_RULE_VERSION,
      sourceSchemaVersion: input.sourceSchemaVersion,
      recalculationVersion: input.recalculationVersion,
    },
    manifestByKey,
    baseSensitivity: {
      birthTimeSensitive,
      sandhiOrBoundaryRisk: false,
      conventionSensitive: false,
      reasons,
    },
    blockedNotices: [],
  };
}

export function asObj(val: unknown): Record<string, unknown> | null {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : null;
}

export function asObjArr(val: unknown): Array<Record<string, unknown>> {
  return Array.isArray(val)
    ? (val.filter(
        (x) => x && typeof x === 'object' && !Array.isArray(x)
      ) as Array<Record<string, unknown>>)
    : [];
}

export function numOrNull(val: unknown): number | null {
  if (val === null || val === undefined || val === '' || typeof val === 'boolean') {
    return null;
  }
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export function strOrNull(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const t = val.trim();
  return t.length > 0 ? t : null;
}

export function canonicalSubjectPlanet(raw: unknown): PlanetaryStateSubjectName | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
  if (!s) return null;
  if (s === 'sun' || s === 'surya') return 'Sun';
  if (s === 'moon' || s === 'chandra') return 'Moon';
  if (s === 'mars' || s === 'mangal' || s === 'mangala' || s === 'kuja') return 'Mars';
  if (s === 'mercury' || s === 'budha' || s === 'budh') return 'Mercury';
  if (s === 'jupiter' || s === 'guru' || s === 'brihaspati') return 'Jupiter';
  if (s === 'venus' || s === 'shukra') return 'Venus';
  if (s === 'saturn' || s === 'shani') return 'Saturn';
  if (
    s === 'rahu' ||
    s === 'mean node' ||
    s === 'true node' ||
    s === 'north node'
  ) {
    return 'Rahu';
  }
  if (
    s === 'ketu' ||
    s === 'south node' ||
    s === 'mean south node' ||
    s === 'true south node'
  ) {
    return 'Ketu';
  }
  if (s === 'ascendant' || s === 'asc' || s === 'lagna') return 'Ascendant';
  return null;
}

export function resolveEnvelopeCanonicalState<T>(
  envelope: DatasetEnvelope<T> | null | undefined,
  manifestEntry?: DatasetManifestEntry | null
): CanonicalDatasetState {
  if (envelope === null || envelope === undefined) {
    return manifestEntry?.canonicalStatus ?? 'unavailable';
  }
  if (envelope.data === null || envelope.data === undefined) {
    if (envelope.canonicalStatus === 'incompatible') return 'incompatible';
    if (manifestEntry?.canonicalStatus === 'incompatible') return 'incompatible';
    return 'unavailable';
  }
  const raw = envelope.canonicalStatus ?? manifestEntry?.canonicalStatus;
  if (raw) return raw;
  const vs: DatasetVerificationStatus | undefined = envelope.verificationStatus;
  if (vs === 'independently_validated') return 'independently_validated';
  if (
    vs === 'internally_verified' ||
    vs === 'verified_equivalent' ||
    vs === 'cached_verified'
  ) {
    return 'internally_verified';
  }
  if (vs === 'available' || vs === 'verified_provider') {
    return envelope.completeness === 'partial' ? 'provisional' : 'available';
  }
  if (vs === 'incompatible') return 'incompatible';
  if (vs === 'unavailable') return 'unavailable';
  return 'provisional';
}

export function mapEnvelopeVerification<T>(
  envelope: DatasetEnvelope<T> | null | undefined,
  manifestEntry?: DatasetManifestEntry | null,
  options?: {
    forceProvisional?: boolean;
    methodologicalOverride?: MethodologicalVerificationStatus;
    extraNotes?: string[];
  }
): EvidenceVerificationMetadata {
  let state = resolveEnvelopeCanonicalState(envelope, manifestEntry);
  if (
    options?.forceProvisional &&
    (state === 'available' || state === 'internally_verified' || state === 'independently_validated')
  ) {
    state = 'provisional';
  }

  let computational: ComputationalVerificationStatus = 'unverified';
  let methodological: MethodologicalVerificationStatus =
    options?.methodologicalOverride ?? 'unspecified';
  let empirical: EmpiricalValidationStatus = 'not_validated';
  let propagatedTrust: PropagatedTrustLevel = 'blocked';

  switch (state) {
    case 'independently_validated':
      computational = 'verified_internal';
      if (!options?.methodologicalOverride) methodological = 'classical_standard';
      empirical = 'independently_validated_external';
      propagatedTrust = 'usable';
      break;
    case 'internally_verified':
      computational = 'verified_internal';
      if (!options?.methodologicalOverride) methodological = 'classical_standard';
      empirical = 'not_validated';
      propagatedTrust = 'usable';
      break;
    case 'available':
      computational = 'provider_reported';
      if (!options?.methodologicalOverride) methodological = 'provider_convention';
      empirical = 'not_validated';
      propagatedTrust = 'usable';
      break;
    case 'provisional':
      computational = 'provisional';
      if (!options?.methodologicalOverride) methodological = 'contested_or_uncalibrated';
      empirical = 'not_validated';
      propagatedTrust = 'provisional';
      break;
    case 'incompatible':
      computational = 'incompatible';
      methodological = 'incompatible_methodology';
      empirical = 'not_validated';
      propagatedTrust = 'blocked';
      break;
    case 'unavailable':
    default:
      computational = 'unavailable';
      methodological = 'unspecified';
      empirical = 'not_validated';
      propagatedTrust = 'blocked';
      break;
  }

  const notes = [
    ...(envelope?.limitations ?? []),
    ...(manifestEntry?.limitations ?? []),
    ...(options?.extraNotes ?? []),
  ].filter(Boolean);

  return {
    computational,
    methodological,
    empirical,
    propagatedTrust,
    statusNotes: Array.from(new Set(notes)),
  };
}

export function isEnvelopeExtractable<T>(
  envelope: DatasetEnvelope<T> | null | undefined,
  ctx: ExtractionSharedContext,
  frame: CanonicalEvidenceFrame,
  datasetKey: string,
  manifestEntry?: DatasetManifestEntry | null
): envelope is DatasetEnvelope<T> & { data: T } {
  const state = resolveEnvelopeCanonicalState(envelope, manifestEntry);
  if (!envelope || envelope.data === null || envelope.data === undefined || state === 'unavailable' || state === 'incompatible') {
    const reasons = [
      ...(envelope?.limitations ?? []),
      ...(manifestEntry?.limitations ?? []),
    ];
    ctx.blockedNotices.push({
      frame,
      datasetKey,
      canonicalStatus: state,
      reason:
        reasons[0] ||
        `Dataset "${datasetKey}" (${frame}) has canonicalStatus "${state}" and cannot emit usable evidence.`,
    });
    return false;
  }
  return true;
}

export function buildSourceDatasetRef<T>(
  datasetKey: string,
  envelope: DatasetEnvelope<T> | null | undefined,
  manifestEntry?: DatasetManifestEntry | null
): EvidenceSourceDatasetRef {
  return {
    datasetKey,
    providerOrModule: envelope?.source || manifestEntry?.source || 'unknown',
    canonicalStatus: resolveEnvelopeCanonicalState(envelope, manifestEntry),
    acquiredAtUtc: envelope?.acquiredAtUtc ?? manifestEntry?.acquiredAtUtc ?? null,
  };
}

export function buildFrameMethodology(
  ctx: ExtractionSharedContext,
  frame: CanonicalEvidenceFrame,
  overrides?: Partial<EvidenceMethodology>
): EvidenceMethodology {
  const conv = ctx.input.calculationConventions;
  const requestedNode = ctx.input.canonicalBirthInstant.input.nodeConvention;

  if (frame === 'vedic_lahiri') {
    return {
      tradition: overrides?.tradition ?? 'vedic',
      houseSystem: overrides?.houseSystem ?? conv?.houseSystems.parashari ?? 'whole_sign',
      ayanamshaIdentifier: overrides?.ayanamshaIdentifier ?? conv?.ayanamsa.vedic ?? 'lahiri',
      ayanamshaDegrees: overrides?.ayanamshaDegrees ?? conv?.ayanamsa.vedicValueDegrees ?? null,
      nodeConvention: overrides?.nodeConvention ?? requestedNode,
      conventionNotes: overrides?.conventionNotes ?? [
        conv?.nodeConvention.vedicObserved
          ? `Observed Vedic node convention: ${conv.nodeConvention.vedicObserved}`
          : 'Lahiri Whole-Sign Sidereal frame.',
      ],
    };
  }
  if (frame === 'kp_placidus') {
    return {
      tradition: 'kp',
      houseSystem: overrides?.houseSystem ?? conv?.houseSystems.kp ?? 'placidus',
      ayanamshaIdentifier: overrides?.ayanamshaIdentifier ?? conv?.ayanamsa.kp ?? 'kp',
      ayanamshaDegrees: overrides?.ayanamshaDegrees ?? conv?.ayanamsa.kpValueDegrees ?? null,
      nodeConvention: overrides?.nodeConvention ?? requestedNode,
      conventionNotes: overrides?.conventionNotes ?? ['KP Krishnamurti Ayanamsha + Placidus cusps.'],
    };
  }
  if (frame === 'bhava_chalit') {
    return {
      tradition: 'vedic',
      houseSystem: overrides?.houseSystem ?? conv?.houseSystems.bhavaChalit ?? 'sripati_midpoint',
      ayanamshaIdentifier: overrides?.ayanamshaIdentifier ?? conv?.ayanamsa.vedic ?? 'lahiri',
      ayanamshaDegrees: overrides?.ayanamshaDegrees ?? conv?.ayanamsa.vedicValueDegrees ?? null,
      nodeConvention: overrides?.nodeConvention ?? requestedNode,
      conventionNotes: overrides?.conventionNotes ?? ['Sripati Bhava Madhya & Sandhi boundaries.'],
    };
  }
  if (frame === 'western_tropical') {
    return {
      tradition: 'western',
      houseSystem: overrides?.houseSystem ?? conv?.houseSystems.western ?? 'placidus',
      ayanamshaIdentifier: null,
      ayanamshaDegrees: null,
      nodeConvention: overrides?.nodeConvention ?? requestedNode,
      conventionNotes: overrides?.conventionNotes ?? ['Tropical zodiac (sayana).'],
    };
  }
  if (frame === 'astronomical_telemetry') {
    return {
      tradition: 'astronomical',
      houseSystem: null,
      ayanamshaIdentifier: overrides?.ayanamshaIdentifier ?? conv?.ayanamsa.vedic ?? 'lahiri',
      ayanamshaDegrees: overrides?.ayanamshaDegrees ?? conv?.ayanamsa.vedicValueDegrees ?? null,
      nodeConvention: overrides?.nodeConvention ?? requestedNode,
      conventionNotes: overrides?.conventionNotes ?? ['Geocentric ephemeris telemetry.'],
    };
  }

  return {
    tradition: overrides?.tradition ?? 'astronomical',
    houseSystem: overrides?.houseSystem ?? null,
    ayanamshaIdentifier: overrides?.ayanamshaIdentifier ?? null,
    ayanamshaDegrees: overrides?.ayanamshaDegrees ?? null,
    nodeConvention: overrides?.nodeConvention ?? 'not_applicable',
    conventionNotes: overrides?.conventionNotes ?? [],
  };
}

export function buildDegreeSensitivity(
  ctx: ExtractionSharedContext,
  degreeInSign: number | null,
  extraReasons: string[] = []
): EvidenceSensitivityMetadata {
  const reasons = [...ctx.baseSensitivity.reasons, ...extraReasons];
  let sandhiOrBoundaryRisk = false;
  if (degreeInSign !== null && (degreeInSign < 1.0 || degreeInSign > 29.0)) {
    sandhiOrBoundaryRisk = true;
    reasons.push(`Sign boundary / Sandhi proximity (${degreeInSign.toFixed(4)}° in sign).`);
  }
  return {
    birthTimeSensitive: ctx.baseSensitivity.birthTimeSensitive,
    sandhiOrBoundaryRisk,
    conventionSensitive: extraReasons.some((r) => r.toLowerCase().includes('node') || r.toLowerCase().includes('ayanam')),
    reasons: Array.from(new Set(reasons)),
  };
}

export function makeDraft(
  ctx: ExtractionSharedContext,
  params: Omit<CanonicalEvidenceDraft, 'versions' | 'naturalKeyParts'> & {
    observationCode: string;
    ruleCode: string;
    qualifier?: string | null;
  }
): CanonicalEvidenceDraft {
  return {
    naturalKeyParts: {
      chartFingerprint: ctx.chartFingerprint,
      frame: params.frame,
      family: params.family,
      observationCode: params.observationCode,
      subjectType: params.subject.type,
      subjectId: params.subject.id,
      ruleCode: params.ruleCode,
      temporalScope: params.temporalScope,
      referenceDateIso: params.referenceDateIso,
      qualifier: params.qualifier ?? null,
    },
    subject: params.subject,
    relatedEntities: params.relatedEntities ?? [],
    family: params.family,
    secondaryTags: params.secondaryTags ?? [],
    observation: params.observation,
    measurements: params.measurements,
    frame: params.frame,
    methodology: params.methodology,
    ruleReference: params.ruleReference,
    sourceDatasets: params.sourceDatasets,
    parentEvidenceIds: params.parentEvidenceIds ?? [],
    derivedFromMetrics: params.derivedFromMetrics ?? [],
    temporalScope: params.temporalScope,
    referenceDateIso: params.referenceDateIso,
    verification: params.verification,
    sensitivity: params.sensitivity,
    versions: ctx.versions,
  };
}
