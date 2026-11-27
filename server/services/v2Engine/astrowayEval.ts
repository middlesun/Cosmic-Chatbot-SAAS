/**
 * Isolated V2 Engine — AstroWay Evaluation & Full Classical Acquisition Adapter
 *
 * Strictly isolated from production chart generation, existing user profiles,
 * Council, Companion, Reports, proprietary analytical indices, and active user flows.
 *
 * Designed for Cloudflare Workers & Node CLI compatibility:
 * - Zero Node fs/path dependencies
 * - Zero credential hardcoding or exposure (uses ASTROWAY_API_KEY env via secretEnv.ts)
 * - Bounded-concurrency execution (Worker CPU & timeout safe) with 429 retry handling
 * - Preserves all successful responses even when individual endpoints fail or are 402/403 tier-restricted
 * - Captures OpenAPI x-quality ('green' | 'yellow'), credit headers, and Mode A vs Mode B equivalence
 * - Keeps Bucket 3 reserved strictly for external JHora / PyJHora / Swiss Ephemeris validation
 */

import {
  generateSessionId,
  parseAstroWayRateLimitHeaders,
  readAstroWayGlobalRateState,
  writeAstroWayGlobalRateState,
  type AstroWayRateLimitState,
} from './astrowayCoordinator';
import { normalizeDeg360 } from './birthInstant';
import {
  getAstroWayApiKey,
  getAstroWayApiSecretStatus,
  redactHeaders,
  redactSecretsDeep,
  redactSecretsInText,
} from './secretEnv';
import type {
  CanonicalBirthInstant,
  EndpointAcquisitionClassification,
  EphemerisTimestampCheck,
  LayerARawProviderRecord,
  ObservedQuotaHeadersSummary,
  SanitizedProviderCallRecord,
  ShadbalaModeDeltaRow,
  TimezoneEquivalenceCheck,
  TimezoneEquivalenceStatus,
  V2DiagnosticBatchState,
} from './types';

export const ASTROWAY_BASE_URL = 'https://api.astroway.info/v1';

export const ASTROWAY_ACCESS_REQUIREMENTS = {
  openApiSpecVersionObserved: '2.383.19',
  freeTierAvailable: true,
  freeTierCreditsPerMonth: 10_000,
  creditCardRequiredForFreeTier: false,
  paidStarterTierUsdPerMonth: 5,
  paidStarterCreditsPerMonth: 50_000,
  minimumAccessRequiredForChris4Evaluation:
    'Free tier (10,000 credits/month, no credit card required) — full classical evaluation fits well within the monthly free allowance.',
  authHeader: 'X-Api-Key',
  envVarName: 'ASTROWAY_API_KEY' as const,
};

export type AstroWayEndpointCategory =
  | 'natal_core'
  | 'shadbala'
  | 'bhavabala'
  | 'ashtakavarga'
  | 'kp'
  | 'jaimini'
  | 'yoga_dosha'
  | 'dasha'
  | 'upagraha'
  | 'varga'
  | 'hellenistic_traditional'
  | 'timezone_probe';

export interface AstroWayEvalEndpointSpec {
  id: string;
  path: string;
  method: 'POST';
  category: AstroWayEndpointCategory;
  declaredQuality: 'green' | 'yellow';
  qualityCaveat: string | null;
  priorityTier?: 1 | 2 | 3 | 4;
  body: Record<string, unknown>;
}

export interface AstroWayChris4EvaluationPlan {
  schemaVersion: 'v2.astroway_plan.1.0';
  baseUrl: string;
  inputFingerprint: string;
  canonicalUtcIso: string;
  accessRequirements: typeof ASTROWAY_ACCESS_REQUIREMENTS;
  secretStatus: ReturnType<typeof getAstroWayApiSecretStatus>;
  inputAlignmentNotes: string[];
  validationErrors: string[];
  requests: AstroWayEvalEndpointSpec[];
}

export interface AstroWayEndpointCallResult {
  id: string;
  path: string;
  category: AstroWayEndpointCategory;
  declaredQuality: 'green' | 'yellow';
  qualityCaveat: string | null;
  priorityTier?: 1 | 2 | 3 | 4;
  httpStatus: number;
  ok: boolean;
  attempts: number;
  rateWaitMs?: number;
  coordinationMode?: 'global_supabase_cas' | 'isolate_memory_only';
  accessRestricted: boolean;
  acquisitionClassification?: EndpointAcquisitionClassification;
  creditsUsed: number | null;
  latencyMs: number;
  payloadBytes: number;
  creditAndMetaHeaders: Record<string, string>;
  sanitizedRequest: Record<string, unknown>;
  errorMessage: string | null;
  rawResponse: unknown;
}

export interface AstroWayEvaluationBundle {
  schemaVersion: 'v2.astroway_eval.1.0';
  executedAtUtc: string;
  status: 'blocked_missing_api_key' | 'complete' | 'partial' | 'failed';
  inputFingerprint: string;
  canonicalUtcIso: string;
  secretStatus: ReturnType<typeof getAstroWayApiSecretStatus>;
  accessRequirements: typeof ASTROWAY_ACCESS_REQUIREMENTS;
  epistemicBoundaryNote: string;
  plannedRequestsCount: number;
  successfulCallsCount: number;
  failedCallsCount: number;
  observedCreditHeadersSummary: {
    creditsUsedHeaderObserved: string | null;
    creditsUsedTotal: number | null;
    creditsRemainingHeaderObserved: string | null;
    creditsLimitHeaderObserved: string | null;
    creditsResetHeaderObserved: string | null;
  };
  results: Record<string, AstroWayEndpointCallResult>;
  shadbalaCrossCheckNote: string | null;
}

const textEncoder = new TextEncoder();
const DEFAULT_FETCH_TIMEOUT_MS = 12_000;
const ASTROWAY_SHODASHAVARGA_DIVISIONS = [
  'D1',
  'D2',
  'D3',
  'D4',
  'D7',
  'D9',
  'D10',
  'D12',
  'D16',
  'D20',
  'D24',
  'D27',
  'D30',
  'D40',
  'D45',
  'D60',
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function asRec(val: unknown): Record<string, unknown> {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {};
}

function asRecArr(val: unknown): Array<Record<string, unknown>> {
  return Array.isArray(val)
    ? (val.filter((x) => x && typeof x === 'object') as Array<Record<string, unknown>>)
    : [];
}

function unwrapAstroWayData(rawResponse: unknown): Record<string, unknown> {
  const root = asRec(rawResponse);
  if (root.data && typeof root.data === 'object' && !Array.isArray(root.data)) {
    return root.data as Record<string, unknown>;
  }
  return root;
}

function circularDeltaDeg(a: number, b: number): number {
  let d = Math.abs(normalizeDeg360(a) - normalizeDeg360(b));
  if (d > 180) d = 360 - d;
  return d;
}

function round4(n: number): number {
  return Number(n.toFixed(4));
}

function parseIsoDateOnlyUtcMs(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function buildAstroWayChartInputPayload(
  instant: CanonicalBirthInstant,
  options?: {
    timeMode?: 'local_iana' | 'utc';
    zodiacType?: 'sidereal' | 'tropical';
    ayanamsa?: 'lahiri' | 'kp' | 'krishnamurti';
    houseSystem?: string;
  }
): Record<string, unknown> {
  const useUtc = options?.timeMode === 'utc' || !instant.timezone.ianaTimezone;
  const date = useUtc
    ? `${instant.utc.components.year}-${pad2(instant.utc.components.month)}-${pad2(
        instant.utc.components.day
      )}`
    : `${instant.input.year}-${pad2(instant.input.month)}-${pad2(instant.input.day)}`;
  const time = useUtc
    ? `${pad2(instant.utc.components.hour)}:${pad2(instant.utc.components.minute)}:${pad2(
        instant.utc.components.second
      )}`
    : `${pad2(instant.input.hour)}:${pad2(instant.input.minute)}:${pad2(
        instant.input.second
      )}`;

  const payload: Record<string, unknown> = {
    date,
    time,
    latitude: instant.input.latitude,
    longitude: instant.input.longitude,
    city: instant.input.city || '',
    name: instant.input.name || '',
    zodiacType: options?.zodiacType ?? 'sidereal',
  };

  if (payload.zodiacType === 'sidereal') {
    payload.ayanamsa = options?.ayanamsa ?? 'lahiri';
  }
  if (options?.houseSystem) {
    payload.houseSystem = options.houseSystem;
  }

  if (useUtc) {
    payload.timezone = 'UTC';
    payload.timezoneOffset = 0;
  } else if (instant.timezone.ianaTimezone) {
    payload.timezone = instant.timezone.ianaTimezone;
  } else {
    payload.timezoneOffset = instant.timezone.historicalUtcOffsetHours;
  }

  return payload;
}

/**
 * Generates the maximum aligned AstroWay evaluation plan covering core telemetry,
 * detailed Shadbala + 6 subcomponents, Ishta/Kashta, Bhavabala, Ashtakavarga + Shodhana,
 * complete KP suite, Jaimini suite, Yogas/Doshas, 6 Dasha systems, Upagrahas,
 * 16 Shodashavarga charts (D1–D60), and Western/Hellenistic modules.
 */
export function buildAstroWayChris4EvaluationPlan(
  instant: CanonicalBirthInstant,
  options?: { timeMode?: 'local_iana' | 'utc'; targetDateIso?: string }
): AstroWayChris4EvaluationPlan {
  const timeMode = options?.timeMode ?? (instant.timezone.ianaTimezone ? 'local_iana' : 'utc');

  const siderealWholeSignBase = buildAstroWayChartInputPayload(instant, {
    timeMode,
    zodiacType: 'sidereal',
    ayanamsa: 'lahiri',
    houseSystem: 'W',
  });
  const siderealBase = buildAstroWayChartInputPayload(instant, {
    timeMode,
    zodiacType: 'sidereal',
    ayanamsa: 'lahiri',
  });
  const kpPlacidusBase = buildAstroWayChartInputPayload(instant, {
    timeMode,
    zodiacType: 'sidereal',
    ayanamsa: 'kp',
    houseSystem: 'P',
  });
  const tropicalPlacidusBase = buildAstroWayChartInputPayload(instant, {
    timeMode,
    zodiacType: 'tropical',
    houseSystem: 'P',
  });
  const hellenisticWholeSignBase = buildAstroWayChartInputPayload(instant, {
    timeMode,
    zodiacType: 'tropical',
    houseSystem: 'W',
  });

  const targetDate = options?.targetDateIso || new Date().toISOString().slice(0, 10);
  const validationErrors: string[] = [];

  for (const field of ['date', 'time', 'latitude', 'longitude'] as const) {
    if (siderealBase[field] === undefined || siderealBase[field] === null || siderealBase[field] === '') {
      validationErrors.push(`AstroWay ChartInput missing required field "${field}".`);
    }
  }
  for (const forbiddenShort of ['lat', 'lon', 'lng', 'tz']) {
    if (
      forbiddenShort in siderealBase ||
      forbiddenShort in kpPlacidusBase ||
      forbiddenShort in hellenisticWholeSignBase
    ) {
      validationErrors.push(
        `AstroWay ChartInput rejects shorthand field "${forbiddenShort}" (400 INVALID_FIELD).`
      );
    }
  }

  const requests: AstroWayEvalEndpointSpec[] = [
    // 1. Core Natal Positions, Astronomy & Panchang
    {
      id: 'chart_sidereal',
      path: '/chart',
      method: 'POST',
      category: 'natal_core',
      declaredQuality: 'green',
      qualityCaveat:
        'Sidereal Lahiri Whole-Sign chart with full ecliptic latitude, distance, speedLong/Lat/Dist, declination, rightAscension, JD, and siderealTime.',
      body: { ...siderealWholeSignBase },
    },
    {
      id: 'chart_tropical',
      path: '/chart',
      method: 'POST',
      category: 'natal_core',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...tropicalPlacidusBase },
    },
    {
      id: 'vedic_kundli',
      path: '/vedic/kundli',
      method: 'POST',
      category: 'natal_core',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealWholeSignBase, targetDate },
    },
    {
      id: 'vedic_panchang_full',
      path: '/vedic/panchang/full',
      method: 'POST',
      category: 'natal_core',
      declaredQuality: 'green',
      qualityCaveat: 'Evaluated at `at: "moment"` (birth instant) rather than sunrise-only calendar mode.',
      body: { ...siderealBase, at: 'moment' },
    },

    // 2. Detailed Shadbala + 6 Subcomponents + Ishta/Kashta + Bhavabala
    {
      id: 'shadbala_full',
      path: '/vedic/shadbala/full',
      method: 'POST',
      category: 'shadbala',
      declaredQuality: 'green',
      qualityCaveat: 'OpenAPI notes Abda/Masa lords and Yuddha Bala still open vs PyJHora 62-chart set.',
      body: { ...siderealBase },
    },
    {
      id: 'shadbala_sthana',
      path: '/vedic/shadbala/sthana',
      method: 'POST',
      category: 'shadbala',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },
    {
      id: 'shadbala_dig',
      path: '/vedic/shadbala/dig',
      method: 'POST',
      category: 'shadbala',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },
    {
      id: 'shadbala_kala',
      path: '/vedic/shadbala/kala',
      method: 'POST',
      category: 'shadbala',
      declaredQuality: 'green',
      qualityCaveat:
        'Exposes individual Nathonnata, Paksha, Tribhaga, Abda/Masa/Vara/Hora, Ayana, and Yuddha subcomponents.',
      body: { ...siderealBase },
    },
    {
      id: 'shadbala_cheshta',
      path: '/vedic/shadbala/cheshta',
      method: 'POST',
      category: 'shadbala',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },
    {
      id: 'shadbala_naisargika',
      path: '/vedic/shadbala/naisargika',
      method: 'POST',
      category: 'shadbala',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },
    {
      id: 'shadbala_drik',
      path: '/vedic/shadbala/drik',
      method: 'POST',
      category: 'shadbala',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },
    {
      id: 'shadbala_ishta_kashta',
      path: '/vedic/shadbala/ishta-kashta',
      method: 'POST',
      category: 'shadbala',
      declaredQuality: 'yellow',
      qualityCaveat: 'Returns both BPHS ray-scale and B.V. Raman geometric forms; verify against JHora/PyJHora.',
      body: { ...siderealBase },
    },
    {
      id: 'bhavabala',
      path: '/vedic/bhavabala',
      method: 'POST',
      category: 'bhavabala',
      declaredQuality: 'yellow',
      qualityCaveat:
        'OpenAPI x-quality=yellow: PyJHora Bhava Bala was not usable as reference so total is unverified externally.',
      body: { ...siderealBase },
    },

    // 3. Ashtakavarga + Prasthara + Shodhana Reductions
    {
      id: 'ashtakavarga_basic',
      path: '/ashtakavarga',
      method: 'POST',
      category: 'ashtakavarga',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },
    {
      id: 'ashtakavarga_prastara',
      path: '/vedic/ashtakavarga/prastara',
      method: 'POST',
      category: 'ashtakavarga',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },
    {
      id: 'ashtakavarga_shodhana',
      path: '/vedic/ashtakavarga/shodhana',
      method: 'POST',
      category: 'ashtakavarga',
      declaredQuality: 'yellow',
      qualityCaveat:
        'OpenAPI x-quality=yellow: BPHS Trikona & Ekadhipatya reductions + Rasi/Graha/Shodhya Pinda.',
      body: { ...siderealBase },
    },

    // 4. Krishnamurti Paddhati (KP — explicit kp ayanamsa & Placidus P houses)
    {
      id: 'kp_sub_lords',
      path: '/vedic/kp/sub-lords',
      method: 'POST',
      category: 'kp',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...kpPlacidusBase },
    },
    {
      id: 'kp_cusps',
      path: '/vedic/kp/cusps',
      method: 'POST',
      category: 'kp',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...kpPlacidusBase },
    },
    {
      id: 'kp_significators',
      path: '/vedic/kp/significators',
      method: 'POST',
      category: 'kp',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...kpPlacidusBase },
    },
    {
      id: 'kp_planet_cuspal_position',
      path: '/vedic/kp/planet-cuspal-position',
      method: 'POST',
      category: 'kp',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...kpPlacidusBase },
    },
    {
      id: 'kp_ruling_planets',
      path: '/vedic/kp/ruling-planets',
      method: 'POST',
      category: 'kp',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...kpPlacidusBase },
    },
    {
      id: 'kp_asc_sub',
      path: '/vedic/kp/asc-sub',
      method: 'POST',
      category: 'kp',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...kpPlacidusBase },
    },
    {
      id: 'kp_fortuna',
      path: '/vedic/kp/fortuna',
      method: 'POST',
      category: 'kp',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...kpPlacidusBase },
    },

    // 5. Jaimini System
    {
      id: 'jaimini_karakas',
      path: '/vedic/jaimini/karakas',
      method: 'POST',
      category: 'jaimini',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },
    {
      id: 'jaimini_chara_karakas',
      path: '/vedic/jaimini/chara-karakas',
      method: 'POST',
      category: 'jaimini',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },
    {
      id: 'jaimini_padas',
      path: '/vedic/jaimini/padas',
      method: 'POST',
      category: 'jaimini',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },
    {
      id: 'jaimini_upapada',
      path: '/vedic/jaimini/upapada',
      method: 'POST',
      category: 'jaimini',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },
    {
      id: 'jaimini_aspects',
      path: '/vedic/jaimini/aspects',
      method: 'POST',
      category: 'jaimini',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },
    {
      id: 'jaimini_drishti_rasi',
      path: '/vedic/jaimini/drishti-rasi',
      method: 'POST',
      category: 'jaimini',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },
    {
      id: 'jaimini_drishti_graha',
      path: '/vedic/jaimini/drishti-graha',
      method: 'POST',
      category: 'jaimini',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },
    {
      id: 'jaimini_atmakaraka_navamsa',
      path: '/vedic/jaimini/atmakaraka-navamsa',
      method: 'POST',
      category: 'jaimini',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },
    {
      id: 'jaimini_argala_analysis',
      path: '/vedic/jaimini/argala-analysis',
      method: 'POST',
      category: 'jaimini',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },
    {
      id: 'jaimini_yogas',
      path: '/vedic/jaimini/yogas',
      method: 'POST',
      category: 'jaimini',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },

    // 6. Yogas, Doshas & Upagrahas
    {
      id: 'yogas_parashara_full',
      path: '/vedic/yogas/parashara/full',
      method: 'POST',
      category: 'yoga_dosha',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },
    {
      id: 'yogas_jaimini_full',
      path: '/vedic/yogas/jaimini/full',
      method: 'POST',
      category: 'yoga_dosha',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },
    {
      id: 'doshas_parashara_full',
      path: '/vedic/doshas/parashara/full',
      method: 'POST',
      category: 'yoga_dosha',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase },
    },
    {
      id: 'doshas_kp_full',
      path: '/vedic/doshas/kp/full',
      method: 'POST',
      category: 'yoga_dosha',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...kpPlacidusBase },
    },
    {
      id: 'vedic_upagrahas',
      path: '/vedic/upagrahas',
      method: 'POST',
      category: 'upagraha',
      declaredQuality: 'yellow',
      qualityCaveat:
        'OpenAPI x-quality=yellow: Time-based Upagraha moment-within-segment follows specific BPHS/Prasna Marga convention.',
      body: { ...siderealBase },
    },

    // 7. Advanced Dashas (5-level Vimshottari + Chara, Yogini, Ashtottari, Kalachakra, Tribhagi)
    {
      id: 'dashas_vimshottari_prana',
      path: '/vedic/dashas/vimshottari/prana',
      method: 'POST',
      category: 'dasha',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase, targetDate },
    },
    {
      id: 'dashas_chara_maha',
      path: '/vedic/dashas/chara/maha',
      method: 'POST',
      category: 'dasha',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase, targetDate },
    },
    {
      id: 'dashas_yogini_maha',
      path: '/vedic/dashas/yogini/maha',
      method: 'POST',
      category: 'dasha',
      declaredQuality: 'yellow',
      qualityCaveat:
        'OpenAPI x-quality=yellow: Uses (nakshatraIndex - 1) mod 8 JHora convention; verify against Saptarishi tradition.',
      body: { ...siderealBase, targetDate },
    },
    {
      id: 'dashas_ashtottari_maha',
      path: '/vedic/dashas/ashtottari/maha',
      method: 'POST',
      category: 'dasha',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase, targetDate },
    },
    {
      id: 'dashas_kalachakra_maha',
      path: '/vedic/dashas/kalachakra/maha',
      method: 'POST',
      category: 'dasha',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase, targetDate },
    },
    {
      id: 'dashas_tribhagi_maha',
      path: '/vedic/dashas/tribhagi/maha',
      method: 'POST',
      category: 'dasha',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...siderealBase, targetDate },
    },

    // 8. Shodashavarga Divisional Charts (all 16 documented /vedic/varga/D* endpoints)
    ...ASTROWAY_SHODASHAVARGA_DIVISIONS.map((div) => ({
      id: `varga_${div}`,
      path: `/vedic/varga/${div}`,
      method: 'POST' as const,
      category: 'varga' as const,
      declaredQuality: 'green' as const,
      qualityCaveat: null,
      body: { ...siderealBase },
    })),

    // 9. Western Traditional & Hellenistic Calculations
    {
      id: 'western_essential_dignities',
      path: '/essential-dignities',
      method: 'POST',
      category: 'hellenistic_traditional',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...tropicalPlacidusBase, mode: 'traditional' },
    },
    {
      id: 'western_firdaria',
      path: '/firdaria',
      method: 'POST',
      category: 'hellenistic_traditional',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...hellenisticWholeSignBase, maxYears: 75, nodes: 'after-mars' },
    },
    {
      id: 'western_profections',
      path: '/profections',
      method: 'POST',
      category: 'hellenistic_traditional',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...hellenisticWholeSignBase, targetDate },
    },
    {
      id: 'hellenistic_brennan_lots_15',
      path: '/hellenistic/brennan/lots-15',
      method: 'POST',
      category: 'hellenistic_traditional',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...hellenisticWholeSignBase },
    },
    {
      id: 'hellenistic_brennan_zr_fortune',
      path: '/hellenistic/brennan/zodiacal-releasing-fortune',
      method: 'POST',
      category: 'hellenistic_traditional',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...hellenisticWholeSignBase, years: 80, yearDays: 365.2422 },
    },
    {
      id: 'hellenistic_brennan_zr_spirit',
      path: '/hellenistic/brennan/zodiacal-releasing-spirit',
      method: 'POST',
      category: 'hellenistic_traditional',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...hellenisticWholeSignBase, years: 80, yearDays: 365.2422 },
    },
    {
      id: 'hellenistic_brennan_profections_detail',
      path: '/hellenistic/brennan/profections-detail',
      method: 'POST',
      category: 'hellenistic_traditional',
      declaredQuality: 'green',
      qualityCaveat: null,
      body: { ...hellenisticWholeSignBase, targetDate },
    },
  ];

  return {
    schemaVersion: 'v2.astroway_plan.1.0',
    baseUrl: ASTROWAY_BASE_URL,
    inputFingerprint: instant.inputFingerprint,
    canonicalUtcIso: instant.utc.iso,
    accessRequirements: ASTROWAY_ACCESS_REQUIREMENTS,
    secretStatus: getAstroWayApiSecretStatus(),
    inputAlignmentNotes: [
      'AstroWay requires full field names (`latitude`, `longitude`, `timezone`/`timezoneOffset`) and rejects short forms (`lat`, `lon`, `lng`, `tz`) with HTTP 400 INVALID_FIELD.',
      'Vedic requests explicitly pass `zodiacType: "sidereal"` and `ayanamsa: "lahiri"`, while KP requests pass `ayanamsa: "kp"` and `houseSystem: "P"`.',
      'CONVENTION NOTE: AstroWay OpenAPI ChartInput (v2.383.19) does not expose a `nodeType` (Mean vs True Rahu/Ketu) parameter; verify Rahu/Ketu longitudes against Mean vs True Node before equating node-dependent outputs.',
      'AstroWay v2.383.19 exposes no standalone Vimshopaka Bala, Panchadha Maitri, Advanced Avastha, D5 Panchamsha, or Bhava Chalit planet-shift endpoint; missing modules are flagged explicitly.',
      'Hellenistic Lots, Zodiacal Releasing, Profections, and Firdaria use `zodiacType: "tropical"` and `houseSystem: "W"` (Whole Sign) matching Brennan/Valens methodology.',
    ],
    validationErrors,
    requests,
  };
}

export type AstroWayFetchFn = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

const TIER_1_PRIORITY_IDS = [
  'chart_sidereal',
  'timezone_probe_mode_b_chart',
  'shadbala_full',
  'timezone_probe_mode_b_shadbala_full',
  'shadbala_kala',
  'timezone_probe_mode_b_shadbala_kala',
  'shadbala_drik',
  'shadbala_ishta_kashta',
  'bhavabala',
] as const;

const TIER_2_PRIORITY_IDS = [
  'shadbala_sthana',
  'shadbala_dig',
  'shadbala_cheshta',
  'shadbala_naisargika',
  'varga_D9',
  'vedic_kundli',
  'yogas_parashara_full',
  'doshas_parashara_full',
  'yogas_jaimini_full',
  'doshas_kp_full',
] as const;

const TIER_3_PRIORITY_IDS = [
  'jaimini_karakas',
  'jaimini_chara_karakas',
  'jaimini_padas',
  'jaimini_upapada',
  'jaimini_aspects',
  'jaimini_drishti_rasi',
  'jaimini_drishti_graha',
  'jaimini_atmakaraka_navamsa',
  'jaimini_argala_analysis',
  'jaimini_yogas',
  'varga_D1',
  'varga_D2',
  'varga_D3',
  'varga_D4',
  'varga_D7',
  'varga_D10',
  'varga_D12',
] as const;

const TIER_4_PRIORITY_IDS = [
  'varga_D16',
  'varga_D20',
  'varga_D24',
  'varga_D27',
  'varga_D30',
  'varga_D40',
  'varga_D45',
  'varga_D60',
  'kp_sub_lords',
  'kp_cusps',
  'kp_significators',
  'kp_planet_cuspal_position',
  'kp_ruling_planets',
  'kp_asc_sub',
  'kp_fortuna',
  'ashtakavarga_basic',
  'ashtakavarga_prastara',
  'ashtakavarga_shodhana',
  'vedic_panchang_full',
  'timezone_probe_mode_b_panchang',
  'dashas_vimshottari_prana',
  'timezone_probe_mode_b_dasha',
  'dashas_chara_maha',
  'dashas_yogini_maha',
  'dashas_ashtottari_maha',
  'dashas_kalachakra_maha',
  'dashas_tribhagi_maha',
  'vedic_upagrahas',
  'chart_tropical',
  'western_essential_dignities',
  'western_firdaria',
  'western_profections',
  'hellenistic_brennan_lots_15',
  'hellenistic_brennan_zr_fortune',
  'hellenistic_brennan_zr_spirit',
  'hellenistic_brennan_profections_detail',
] as const;

export function orderAstroWaySpecsForPriorityVerification(
  planRequests: AstroWayEvalEndpointSpec[],
  probeSpecs: AstroWayEvalEndpointSpec[] = []
): AstroWayEvalEndpointSpec[] {
  const byId = new Map<string, AstroWayEvalEndpointSpec>();
  for (const spec of [...planRequests, ...probeSpecs]) {
    if (!byId.has(spec.id)) {
      byId.set(spec.id, spec);
    }
  }

  const ordered: AstroWayEvalEndpointSpec[] = [];
  const seen = new Set<string>();

  const pushTier = (ids: readonly string[], tier: 1 | 2 | 3 | 4) => {
    for (const id of ids) {
      const spec = byId.get(id);
      if (spec && !seen.has(id)) {
        seen.add(id);
        ordered.push({ ...spec, priorityTier: tier });
      }
    }
  };

  pushTier(TIER_1_PRIORITY_IDS, 1);
  pushTier(TIER_2_PRIORITY_IDS, 2);
  pushTier(TIER_3_PRIORITY_IDS, 3);
  pushTier(TIER_4_PRIORITY_IDS, 4);

  // Append any remaining specs so nothing is ever omitted
  for (const spec of byId.values()) {
    if (!seen.has(spec.id)) {
      seen.add(spec.id);
      ordered.push({ ...spec, priorityTier: 4 });
    }
  }

  return ordered;
}

export function classifyAstroWayCallOutcome(params: {
  httpStatus: number;
  ok: boolean;
  attempts?: number;
  errorMessage?: string | null;
}): EndpointAcquisitionClassification {
  const { httpStatus, ok, attempts } = params;
  if (attempts === 0) return 'not_yet_tested';
  if (ok && httpStatus >= 200 && httpStatus < 300) return 'successfully_acquired';
  if (httpStatus === 429) return 'rate_limited';
  if (httpStatus === 401 || httpStatus === 402 || httpStatus === 403) return 'tier_restricted';
  if (httpStatus === 404 || httpStatus === 405 || httpStatus === 501) return 'not_offered_by_provider';
  return 'runtime_execution_blocked';
}

export function isSettledAstroWayCall(
  call: Pick<SanitizedProviderCallRecord, 'ok' | 'httpStatus' | 'attempts' | 'acquisitionClassification'> | undefined
): boolean {
  if (!call || call.attempts === 0) return false;
  const cls =
    call.acquisitionClassification ||
    classifyAstroWayCallOutcome({
      httpStatus: call.httpStatus,
      ok: call.ok,
      attempts: call.attempts,
      errorMessage: null,
    });
  return (
    cls === 'successfully_acquired' ||
    cls === 'tier_restricted' ||
    cls === 'not_offered_by_provider'
  );
}

export function buildAstroWayProbeSpecs(
  instant: CanonicalBirthInstant,
  includeTimezoneEquivalenceProbe: boolean
): AstroWayEvalEndpointSpec[] {
  if (!includeTimezoneEquivalenceProbe || !instant.timezone.ianaTimezone) return [];

  const utcSiderealWholeSign = buildAstroWayChartInputPayload(instant, {
    timeMode: 'utc',
    zodiacType: 'sidereal',
    ayanamsa: 'lahiri',
    houseSystem: 'W',
  });
  const utcSiderealBase = buildAstroWayChartInputPayload(instant, {
    timeMode: 'utc',
    zodiacType: 'sidereal',
    ayanamsa: 'lahiri',
  });
  const targetDate = new Date().toISOString().slice(0, 10);

  return [
    {
      id: 'timezone_probe_mode_b_chart',
      path: '/chart',
      method: 'POST',
      category: 'timezone_probe',
      declaredQuality: 'green',
      qualityCaveat: 'Mode B UTC probe for /chart longitude/ascendant equivalence.',
      priorityTier: 1,
      body: utcSiderealWholeSign,
    },
    {
      id: 'timezone_probe_mode_b_shadbala_full',
      path: '/vedic/shadbala/full',
      method: 'POST',
      category: 'timezone_probe',
      declaredQuality: 'green',
      qualityCaveat: 'Mode B UTC probe for /vedic/shadbala/full invariance.',
      priorityTier: 1,
      body: utcSiderealBase,
    },
    {
      id: 'timezone_probe_mode_b_shadbala_kala',
      path: '/vedic/shadbala/kala',
      method: 'POST',
      category: 'timezone_probe',
      declaredQuality: 'green',
      qualityCaveat: 'Mode B UTC probe for /vedic/shadbala/kala subcomponent invariance.',
      priorityTier: 1,
      body: utcSiderealBase,
    },
    {
      id: 'timezone_probe_mode_b_panchang',
      path: '/vedic/panchang/full',
      method: 'POST',
      category: 'timezone_probe',
      declaredQuality: 'green',
      qualityCaveat: 'Mode B UTC probe for /vedic/panchang/full (at=moment) invariance.',
      priorityTier: 4,
      body: { ...utcSiderealBase, at: 'moment' },
    },
    {
      id: 'timezone_probe_mode_b_dasha',
      path: '/vedic/dashas/vimshottari/prana',
      method: 'POST',
      category: 'timezone_probe',
      declaredQuality: 'green',
      qualityCaveat: 'Mode B UTC probe for /vedic/dashas/vimshottari/prana invariance.',
      priorityTier: 4,
      body: { ...utcSiderealBase, targetDate },
    },
  ];
}

async function executeSingleAstroWaySpec(
  spec: AstroWayEvalEndpointSpec,
  apiKey: string,
  options?: {
    fetchFn?: AstroWayFetchFn;
    coordinationMode?: 'global_supabase_cas' | 'isolate_memory_only';
    rateWaitMs?: number;
  }
): Promise<AstroWayEndpointCallResult> {
  const sanitizedRequest = redactSecretsDeep(spec.body, [apiKey]);
  const startedAt = Date.now();
  const fetchImpl = options?.fetchFn ?? fetch;
  const signal =
    !options?.fetchFn &&
    typeof AbortSignal !== 'undefined' &&
    typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS)
      : undefined;

  try {
    const res = await fetchImpl(`${ASTROWAY_BASE_URL}${spec.path}`, {
      method: spec.method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(spec.body),
      ...(signal ? { signal } : {}),
    });
    const text = await res.text();
    const latencyMs = Math.max(0, Date.now() - startedAt);
    const payloadBytes = textEncoder.encode(text).length;

    const safeHeaders = redactHeaders(res.headers);
    const creditHeaders: Record<string, string> = {};
    for (const [hk, hv] of Object.entries(safeHeaders)) {
      if (
        hk.includes('credit') ||
        hk.includes('rate') ||
        hk.includes('limit') ||
        hk.includes('remaining') ||
        hk.includes('reset') ||
        hk.includes('retry') ||
        hk.includes('request-id')
      ) {
        creditHeaders[hk] = hv;
      }
    }

    const rawUsed = Number(safeHeaders['x-credits-used']);
    const creditsUsed = Number.isFinite(rawUsed) ? rawUsed : null;
    const accessRestricted = res.status === 401 || res.status === 402 || res.status === 403;
    const classification = classifyAstroWayCallOutcome({
      httpStatus: res.status,
      ok: res.ok,
      attempts: 1,
    });

    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = redactSecretsInText(text.slice(0, 1000), [apiKey]);
    }

    const parsedObj = asRec(parsed);
    const errDetail =
      parsedObj.error && typeof parsedObj.error === 'object'
        ? JSON.stringify(parsedObj.error)
        : typeof parsedObj.message === 'string'
        ? parsedObj.message
        : typeof parsedObj.detail === 'string'
        ? parsedObj.detail
        : null;

    return {
      id: spec.id,
      path: spec.path,
      category: spec.category,
      declaredQuality: spec.declaredQuality,
      qualityCaveat: spec.qualityCaveat,
      priorityTier: spec.priorityTier,
      httpStatus: res.status,
      ok: res.ok,
      attempts: 1,
      rateWaitMs: options?.rateWaitMs ?? 0,
      coordinationMode: options?.coordinationMode ?? 'isolate_memory_only',
      accessRestricted,
      acquisitionClassification: classification,
      creditsUsed,
      latencyMs,
      payloadBytes,
      creditAndMetaHeaders: creditHeaders,
      sanitizedRequest,
      errorMessage: res.ok
        ? null
        : redactSecretsInText(
            classification === 'rate_limited'
              ? `HTTP 429 (rate_limited${errDetail ? `: ${errDetail}` : ''})`
              : classification === 'tier_restricted'
              ? `HTTP ${res.status} (${res.status === 402 ? 'credits_exhausted' : 'tier_restricted'}${errDetail ? `: ${errDetail}` : ''})`
              : classification === 'not_offered_by_provider'
              ? `HTTP ${res.status} (not_offered_by_provider${errDetail ? `: ${errDetail}` : ''})`
              : `HTTP ${res.status}${errDetail ? `: ${errDetail}` : ''}`,
            [apiKey]
          ),
      rawResponse: redactSecretsDeep(parsed, [apiKey]),
    };
  } catch (err) {
    return {
      id: spec.id,
      path: spec.path,
      category: spec.category,
      declaredQuality: spec.declaredQuality,
      qualityCaveat: spec.qualityCaveat,
      priorityTier: spec.priorityTier,
      httpStatus: 0,
      ok: false,
      attempts: 1,
      rateWaitMs: options?.rateWaitMs ?? 0,
      coordinationMode: options?.coordinationMode ?? 'isolate_memory_only',
      accessRestricted: false,
      acquisitionClassification: 'runtime_execution_blocked',
      creditsUsed: null,
      latencyMs: Math.max(0, Date.now() - startedAt),
      payloadBytes: 0,
      creditAndMetaHeaders: {},
      sanitizedRequest,
      errorMessage: redactSecretsInText(
        err instanceof Error ? err.message : 'Network or timeout error calling AstroWay',
        [apiKey]
      ),
      rawResponse: null,
    };
  }
}

function makeNotYetTestedCallRecord(
  spec: AstroWayEvalEndpointSpec,
  apiKey: string,
  coordinationMode: 'global_supabase_cas' | 'isolate_memory_only'
): SanitizedProviderCallRecord {
  return {
    id: spec.id,
    endpoint: spec.path,
    method: 'POST',
    timestampUtc: new Date().toISOString(),
    sanitizedRequest: redactSecretsDeep(spec.body, [apiKey]),
    httpStatus: 0,
    ok: false,
    attempts: 0,
    rateWaitMs: 0,
    coordinationMode,
    latencyMs: 0,
    payloadBytes: 0,
    quotaAndMetaHeaders: {},
    errorMessage: 'Not yet tested (queued for next bounded batch)',
    category: spec.category,
    declaredQuality: spec.declaredQuality,
    qualityCaveat: spec.qualityCaveat,
    accessRestricted: false,
    creditsUsed: null,
    acquisitionClassification: 'not_yet_tested',
    priorityTier: spec.priorityTier,
    rawResponse: null,
  };
}

function toSanitizedCallRecord(r: AstroWayEndpointCallResult): SanitizedProviderCallRecord {
  const cls =
    r.acquisitionClassification ||
    classifyAstroWayCallOutcome({
      httpStatus: r.httpStatus,
      ok: r.ok,
      attempts: r.attempts,
      errorMessage: r.errorMessage,
    });
  return {
    id: r.id,
    endpoint: r.path,
    method: 'POST',
    timestampUtc: new Date().toISOString(),
    sanitizedRequest: r.sanitizedRequest,
    httpStatus: r.httpStatus,
    ok: r.ok,
    attempts: r.attempts,
    rateWaitMs: r.rateWaitMs ?? 0,
    coordinationMode: r.coordinationMode ?? 'isolate_memory_only',
    latencyMs: r.latencyMs,
    payloadBytes: r.payloadBytes,
    quotaAndMetaHeaders: r.creditAndMetaHeaders,
    errorMessage: r.errorMessage,
    category: r.category,
    declaredQuality: r.declaredQuality,
    qualityCaveat: r.qualityCaveat,
    accessRestricted: r.accessRestricted,
    creditsUsed: r.creditsUsed,
    acquisitionClassification: cls,
    priorityTier: r.priorityTier,
    rawResponse: r.rawResponse,
  };
}

function toEvalCallResult(c: SanitizedProviderCallRecord): AstroWayEndpointCallResult {
  const cls =
    c.acquisitionClassification ||
    classifyAstroWayCallOutcome({
      httpStatus: c.httpStatus,
      ok: c.ok,
      attempts: c.attempts,
      errorMessage: c.errorMessage,
    });
  return {
    id: c.id,
    path: c.endpoint,
    category: (c.category as AstroWayEndpointCategory) || 'natal_core',
    declaredQuality: c.declaredQuality === 'yellow' ? 'yellow' : 'green',
    qualityCaveat: c.qualityCaveat ?? null,
    priorityTier: c.priorityTier as 1 | 2 | 3 | 4 | undefined,
    httpStatus: c.httpStatus,
    ok: c.ok,
    attempts: c.attempts,
    rateWaitMs: c.rateWaitMs,
    coordinationMode: c.coordinationMode,
    accessRestricted: Boolean(c.accessRestricted),
    acquisitionClassification: cls,
    creditsUsed: c.creditsUsed ?? null,
    latencyMs: c.latencyMs,
    payloadBytes: c.payloadBytes,
    creditAndMetaHeaders: c.quotaAndMetaHeaders || {},
    sanitizedRequest: c.sanitizedRequest || {},
    errorMessage: c.errorMessage ?? null,
    rawResponse: c.rawResponse,
  };
}

export function evaluateAstroWayJulianDayCheck(
  instant: CanonicalBirthInstant,
  chartSiderealCall: Pick<
    AstroWayEndpointCallResult,
    'ok' | 'rawResponse' | 'sanitizedRequest'
  > | undefined
): EphemerisTimestampCheck | null {
  if (!chartSiderealCall?.ok) return null;
  const data = unwrapAstroWayData(chartSiderealCall.rawResponse);
  const returnedUtcInstant =
    typeof data.utcInstant === 'string'
      ? data.utcInstant
      : typeof data.utcTimestamp === 'string'
      ? data.utcTimestamp
      : typeof data.timestamp === 'string'
      ? data.timestamp
      : null;
  const returnedJd = typeof data.julianDay === 'number' ? data.julianDay : null;
  const deltaJd =
    returnedJd !== null ? Number((returnedJd - instant.utc.julianDayUt).toFixed(8)) : null;
  const deltaSeconds =
    deltaJd !== null ? Number((deltaJd * 86_400).toFixed(3)) : null;
  const utcTimestampPresent = Boolean(returnedUtcInstant);
  const julianDayMatch = deltaJd !== null ? Math.abs(deltaJd) < 0.00002 : false;
  // Strict truthfulness: ephemeris_timestamp_verification cannot pass when returnedUtcInstant is absent
  let exactTimestampMatch = false;
  if (utcTimestampPresent && returnedUtcInstant) {
    const parsedMs = Date.parse(returnedUtcInstant);
    if (!Number.isNaN(parsedMs)) {
      const utcDeltaSec = Math.abs((parsedMs - instant.utc.timestampMs) / 1000);
      exactTimestampMatch = utcDeltaSec <= 1 && julianDayMatch;
    }
  }

  const limitationNotes: string[] = [];
  if (!utcTimestampPresent) {
    limitationNotes.push(
      'AstroWay /chart returns numeric julianDay without an explicit UTC ISO timestamp string (returnedUtcInstant=null); julianDayMatch is reported separately from ephemeris_timestamp_verification.'
    );
  }
  if (returnedJd === null) {
    limitationNotes.push('AstroWay /chart response did not include numeric julianDay.');
  } else if (!julianDayMatch) {
    limitationNotes.push(
      `AstroWay julianDay ${returnedJd} differs from canonical ${instant.utc.julianDayUt} by Δ=${deltaSeconds}s.`
    );
  }

  return {
    requestedStart: `${String(chartSiderealCall.sanitizedRequest.date || '')} ${String(
      chartSiderealCall.sanitizedRequest.time || ''
    )}`,
    requestedTzStr: String(
      chartSiderealCall.sanitizedRequest.timezone ??
        chartSiderealCall.sanitizedRequest.timezoneOffset ??
        ''
    ),
    returnedUtcInstant,
    returnedJulianDay: returnedJd,
    expectedUtcIso: instant.utc.iso,
    expectedJulianDayUt: instant.utc.julianDayUt,
    deltaSecondsFromCanonical: deltaSeconds,
    deltaJulianDay: deltaJd,
    utcTimestampPresent,
    julianDayMatch,
    exactTimestampMatch,
    limitationNotes,
  };
}

/**
 * Compares AstroWay Mode A (local wall clock + IANA timezone) vs Mode B (UTC + timezone='UTC')
 * across /chart (sidereal longitudes & ascendant), /vedic/shadbala/full (all 6 Bala sums),
 * /vedic/shadbala/kala (6 Kala Bala subcomponents), /vedic/panchang/full, and
 * /vedic/dashas/vimshottari/prana.
 */
export function compareAstroWayModeAVsModeBResponses(params: {
  instant: CanonicalBirthInstant;
  chartA?: AstroWayEndpointCallResult;
  chartB?: AstroWayEndpointCallResult;
  shadbalaFullA?: AstroWayEndpointCallResult;
  shadbalaFullB?: AstroWayEndpointCallResult;
  shadbalaKalaA?: AstroWayEndpointCallResult;
  shadbalaKalaB?: AstroWayEndpointCallResult;
  panchangA?: AstroWayEndpointCallResult;
  panchangB?: AstroWayEndpointCallResult;
  dashaA?: AstroWayEndpointCallResult;
  dashaB?: AstroWayEndpointCallResult;
}): TimezoneEquivalenceCheck {
  const {
    instant,
    chartA,
    chartB,
    shadbalaFullA,
    shadbalaFullB,
    shadbalaKalaA,
    shadbalaKalaB,
    panchangA,
    panchangB,
    dashaA,
    dashaB,
  } = params;

  const getCls = (c?: AstroWayEndpointCallResult): EndpointAcquisitionClassification | null => {
    if (!c) return null;
    return (
      c.acquisitionClassification ||
      classifyAstroWayCallOutcome({
        httpStatus: c.httpStatus,
        ok: c.ok,
        attempts: c.attempts,
        errorMessage: c.errorMessage,
      })
    );
  };

  const chartBothOk = Boolean(chartA?.ok && chartB?.ok);
  const dataChartA = chartA?.ok ? unwrapAstroWayData(chartA.rawResponse) : {};
  const dataChartB = chartB?.ok ? unwrapAstroWayData(chartB.rawResponse) : {};

  const ascA = Number(asRec(dataChartA.houses).ascendant);
  const ascB = Number(asRec(dataChartB.houses).ascendant);
  const ascendantDeltaDeg =
    chartBothOk && Number.isFinite(ascA) && Number.isFinite(ascB)
      ? Number(circularDeltaDeg(ascA, ascB).toFixed(6))
      : null;

  const planetsA = asRecArr(dataChartA.planets);
  const planetsB = asRecArr(dataChartB.planets);
  const perPlanetDeltasDeg: Array<{
    planet: string;
    modeALon: number;
    modeBLon: number;
    deltaDeg: number;
  }> = [];
  let maxPlanetDeltaDeg: number | null = null;
  let moonDeltaDeg: number | null = null;

  if (chartBothOk) {
    for (const pA of planetsA) {
      const name = String(pA.name || '');
      const pB = planetsB.find((x) => String(x.name || '') === name);
      if (!pB) continue;
      const lonA = Number(pA.longitude);
      const lonB = Number(pB.longitude);
      if (!Number.isFinite(lonA) || !Number.isFinite(lonB)) continue;
      const delta = Number(circularDeltaDeg(lonA, lonB).toFixed(6));
      perPlanetDeltasDeg.push({ planet: name, modeALon: lonA, modeBLon: lonB, deltaDeg: delta });
      if (maxPlanetDeltaDeg === null || delta > maxPlanetDeltaDeg) maxPlanetDeltaDeg = delta;
      if (name.toLowerCase() === 'moon') moonDeltaDeg = delta;
    }
  }

  const coordinatesEquivalent =
    chartBothOk &&
    ascendantDeltaDeg !== null &&
    ascendantDeltaDeg < 0.01 &&
    maxPlanetDeltaDeg !== null &&
    maxPlanetDeltaDeg < 0.01;

  // Shadbala full + Kala Bala subcomponents comparison
  const sbAItems = shadbalaFullA?.ok ? asRecArr(unwrapAstroWayData(shadbalaFullA.rawResponse).items) : [];
  const sbBItems = shadbalaFullB?.ok ? asRecArr(unwrapAstroWayData(shadbalaFullB.rawResponse).items) : [];
  const kalaAItems = shadbalaKalaA?.ok ? asRecArr(unwrapAstroWayData(shadbalaKalaA.rawResponse).items) : [];
  const kalaBItems = shadbalaKalaB?.ok ? asRecArr(unwrapAstroWayData(shadbalaKalaB.rawResponse).items) : [];

  const shadbalaRows: ShadbalaModeDeltaRow[] = [];
  let maxSbTotalDelta: number | null = null;
  let maxSbCompDelta: number | null = null;

  for (const rA of sbAItems) {
    const planet = String(rA.planetName || '').trim();
    const rB = sbBItems.find(
      (x) => String(x.planetName || '').trim().toLowerCase() === planet.toLowerCase()
    );
    if (!planet || !rB) continue;

    const compDeltas = {
      sthana_bala: round4(Number(rA.sthana ?? 0) - Number(rB.sthana ?? 0)),
      dig_bala: round4(Number(rA.dig ?? 0) - Number(rB.dig ?? 0)),
      kala_bala: round4(Number(rA.kala ?? 0) - Number(rB.kala ?? 0)),
      cheshta_bala: round4(Number(rA.cheshta ?? 0) - Number(rB.cheshta ?? 0)),
      naisargika_bala: round4(Number(rA.naisargika ?? 0) - Number(rB.naisargika ?? 0)),
      drik_bala: round4(Number(rA.drik ?? 0) - Number(rB.drik ?? 0)),
    };
    const totalA = Number(rA.totalVirupa ?? 0);
    const totalB = Number(rB.totalVirupa ?? 0);
    const totalDelta = round4(totalA - totalB);
    const maxThisComp = Math.max(...Object.values(compDeltas).map((v) => Math.abs(v)));
    if (maxSbTotalDelta === null || Math.abs(totalDelta) > maxSbTotalDelta) {
      maxSbTotalDelta = round4(Math.abs(totalDelta));
    }
    if (maxSbCompDelta === null || maxThisComp > maxSbCompDelta) {
      maxSbCompDelta = round4(maxThisComp);
    }

    const kA = kalaAItems.find(
      (x) => String(x.planetName || '').trim().toLowerCase() === planet.toLowerCase()
    );
    const kB = kalaBItems.find(
      (x) => String(x.planetName || '').trim().toLowerCase() === planet.toLowerCase()
    );
    const subcomponentDeltas: Record<string, number> | undefined =
      kA && kB
        ? {
            nathonnatha: round4(Number(kA.nathonnatha ?? 0) - Number(kB.nathonnatha ?? 0)),
            paksha: round4(Number(kA.paksha ?? 0) - Number(kB.paksha ?? 0)),
            tribhaga: round4(Number(kA.tribhaga ?? 0) - Number(kB.tribhaga ?? 0)),
            abdaMasaVaraHora: round4(
              Number(kA.abdaMasaVaraHora ?? 0) - Number(kB.abdaMasaVaraHora ?? 0)
            ),
            ayana: round4(Number(kA.ayana ?? 0) - Number(kB.ayana ?? 0)),
            yuddha: round4(Number(kA.yuddha ?? 0) - Number(kB.yuddha ?? 0)),
          }
        : undefined;

    let suspectedKalaBalaDriver: string | null = null;
    if (Math.abs(compDeltas.kala_bala) > 0.02 && subcomponentDeltas) {
      const nonzeroSubs = Object.entries(subcomponentDeltas)
        .filter(([, d]) => Math.abs(d) > 0.02)
        .map(([k, d]) => `${k} Δ=${d}V`);
      suspectedKalaBalaDriver = nonzeroSubs.length
        ? `Kala Bala subcomponent delta: ${nonzeroSubs.join(', ')}`
        : 'Kala Bala total differs';
    }

    shadbalaRows.push({
      planet,
      modeATotal: totalA,
      modeBTotal: totalB,
      totalDelta,
      modeARatio: null,
      modeBRatio: null,
      componentDeltas: compDeltas,
      ...(subcomponentDeltas ? { subcomponentDeltas } : {}),
      suspectedKalaBalaDriver,
    });
  }

  const shadbalaAvailable = shadbalaRows.length > 0;
  const shadbalaEquivalent: boolean | null = shadbalaAvailable
    ? (maxSbTotalDelta ?? 0) <= 0.02 && (maxSbCompDelta ?? 0) <= 0.02
    : null;

  // Panchang Mode A vs Mode B
  let panchangAudit: TimezoneEquivalenceCheck['panchangAudit'] = null;
  if (panchangA?.ok && panchangB?.ok) {
    const pA = unwrapAstroWayData(panchangA.rawResponse);
    const pB = unwrapAstroWayData(panchangB.rawResponse);
    const reqMismatches: string[] = [];
    const dailyDiffs: string[] = [];

    for (const [label, aObj, bObj] of [
      ['tithi', asRec(pA.tithi), asRec(pB.tithi)],
      ['nakshatra', asRec(pA.nakshatra), asRec(pB.nakshatra)],
      ['yoga', asRec(pA.yoga), asRec(pB.yoga)],
      ['karana', asRec(pA.karana), asRec(pB.karana)],
    ] as const) {
      const aName = String(aObj.name ?? aObj.number ?? '');
      const bName = String(bObj.name ?? bObj.number ?? '');
      if (aName !== bName) {
        reqMismatches.push(`panchang.${label}: "${aName}" vs "${bName}"`);
      }
    }
    const varaA = String(asRec(pA.vara).name ?? '');
    const varaB = String(asRec(pB.vara).name ?? '');
    if (varaA && varaB && varaA !== varaB) {
      dailyDiffs.push(`daily panchang.vara: "${varaA}" vs "${varaB}"`);
    }

    panchangAudit = {
      available: true,
      equivalent: reqMismatches.length === 0,
      birthInstantSource: 'request_time_panchang',
      requestTimePanchangAvailable: true,
      requestTimePanchangEquivalent: reqMismatches.length === 0,
      requestTimePanchangMismatches: reqMismatches,
      dailyCalendarDifferences: dailyDiffs,
      nonClockMismatches: reqMismatches,
      sunriseInstantDeltaSeconds: null,
      sunsetInstantDeltaSeconds: null,
      legitimateDisplayTimeDifferences:
        pA.sunrise !== pB.sunrise || pA.sunset !== pB.sunset
          ? [`sunrise/sunset: "${String(pA.sunrise)}" vs "${String(pB.sunrise)}"`]
          : [],
    };
  }

  // Vimshottari Dasha Mode A vs Mode B
  let dashaEquivalent: boolean | null = null;
  const dashaMismatches: string[] = [];
  let dashaAudit: TimezoneEquivalenceCheck['dashaAudit'] = null;
  if (dashaA?.ok && dashaB?.ok) {
    const dA = unwrapAstroWayData(dashaA.rawResponse);
    const dB = unwrapAstroWayData(dashaB.rawResponse);
    const initA = asRec(dA.initial);
    const initB = asRec(dB.initial);
    const lordA = String(initA.initialPlanetName ?? initA.initialPlanet ?? '');
    const lordB = String(initB.initialPlanetName ?? initB.initialPlanet ?? '');
    const remA = Number(initA.balanceYears ?? NaN);
    const remB = Number(initB.balanceYears ?? NaN);
    const elA = Number(initA.elapsedYears ?? NaN);
    const elB = Number(initB.elapsedYears ?? NaN);
    const remDelta = Number.isFinite(remA) && Number.isFinite(remB) ? round4(Math.abs(remA - remB)) : null;
    const elDelta = Number.isFinite(elA) && Number.isFinite(elB) ? round4(Math.abs(elA - elB)) : null;

    const periodsA = asRecArr(dA.periods);
    const periodsB = asRecArr(dB.periods);
    const durationMismatches: string[] = [];
    const structuralMismatches: string[] = [];
    const rolloverShifts: string[] = [];

    if (lordA !== lordB) {
      structuralMismatches.push(`initialPlanet: ${lordA} vs ${lordB}`);
      dashaMismatches.push(`initialPlanet: ${lordA} vs ${lordB}`);
    }
    if (remDelta !== null && remDelta > 0.001) {
      dashaMismatches.push(`balanceYears Δ=${remDelta}y (${remA} vs ${remB})`);
    }
    if (periodsA.length !== periodsB.length) {
      structuralMismatches.push(`periods.length: ${periodsA.length} vs ${periodsB.length}`);
      dashaMismatches.push(`periods.length: ${periodsA.length} vs ${periodsB.length}`);
    } else {
      for (let i = 0; i < periodsA.length; i++) {
        const pA = periodsA[i];
        const pB = periodsB[i];
        const nameA = String(pA.planetName ?? pA.planet ?? '');
        const nameB = String(pB.planetName ?? pB.planet ?? '');
        if (nameA !== nameB) {
          structuralMismatches.push(`MD[${i}] ${nameA} vs ${nameB}`);
          dashaMismatches.push(`MD[${i}] ${nameA} vs ${nameB}`);
          continue;
        }
        const durA = Number(pA.durationYears ?? NaN);
        const durB = Number(pB.durationYears ?? NaN);
        if (Number.isFinite(durA) && Number.isFinite(durB) && Math.abs(durA - durB) > 0.005) {
          const msg = `MD[${i}] ${nameA} durationYears: ${durA} vs ${durB}`;
          durationMismatches.push(msg);
          dashaMismatches.push(msg);
        } else {
          const sA = String(pA.startDate ?? '').slice(0, 10);
          const sB = String(pB.startDate ?? '').slice(0, 10);
          if (sA && sB && sA !== sB) {
            const msA = parseIsoDateOnlyUtcMs(sA);
            const msB = parseIsoDateOnlyUtcMs(sB);
            const shiftDays = msA !== null && msB !== null ? Math.round((msA - msB) / 86_400_000) : null;
            if (shiftDays !== null && Math.abs(shiftDays) <= 1) {
              rolloverShifts.push(`MD[${i}] ${nameA} start ${sA} vs ${sB} (Δ=${shiftDays}d)`);
            }
          }
        }
      }
    }

    dashaAudit = {
      available: true,
      birthBalanceLordMatch: lordA === lordB,
      birthBalanceRemainingYearsModeA: Number.isFinite(remA) ? remA : null,
      birthBalanceRemainingYearsModeB: Number.isFinite(remB) ? remB : null,
      birthBalanceRemainingYearsDelta: remDelta,
      birthBalanceElapsedYearsDelta: elDelta,
      isSingleCalendarDayRolloverBalanceArtifact: false,
      calendarDateRolloverShifts: rolloverShifts,
      durationMismatches,
      structuralMismatches,
      notes: [],
    };
    dashaEquivalent = dashaMismatches.length === 0;
  }

  // Classify overall probe execution vs true mathematical failure
  const coreProbeList = [chartA, chartB, shadbalaFullA, shadbalaFullB, shadbalaKalaA, shadbalaKalaB];
  const anyCoreRateLimited = coreProbeList.some((c) => getCls(c) === 'rate_limited');
  const anyCoreNotYetTested = coreProbeList.some((c) => !c || getCls(c) === 'not_yet_tested');
  const anyCoreRuntimeBlocked = coreProbeList.some((c) => {
    const cls = getCls(c);
    return cls === 'runtime_execution_blocked' || cls === 'tier_restricted' || cls === 'not_offered_by_provider';
  });

  const hasTrueMathDivergence =
    (chartBothOk && !coordinatesEquivalent) ||
    shadbalaEquivalent === false ||
    (panchangAudit !== null && !panchangAudit.equivalent) ||
    dashaEquivalent === false;

  let status: TimezoneEquivalenceStatus;
  if (hasTrueMathDivergence) {
    status = 'mathematical_verification_failed';
  } else if (anyCoreRateLimited) {
    status = 'incomplete_due_to_rate_limit';
  } else if (anyCoreNotYetTested) {
    status = 'not_yet_tested';
  } else if (anyCoreRuntimeBlocked) {
    status = 'incomplete_due_to_runtime_block';
  } else {
    status = 'verified_equivalent';
  }

  const executed = status === 'verified_equivalent' || status === 'mathematical_verification_failed';
  const equivalent = status === 'verified_equivalent';

  const notes: string[] = [];
  if (!chartBothOk) {
    const clsA = getCls(chartA) ?? 'not_yet_tested';
    const clsB = getCls(chartB) ?? 'not_yet_tested';
    notes.push(
      `AstroWay /chart Mode A vs Mode B probe incomplete (${clsA} / ${clsB}; ModeA HTTP ${chartA?.httpStatus ?? 0}, ModeB HTTP ${chartB?.httpStatus ?? 0}) — NOT a mathematical failure.`
    );
  } else if (coordinatesEquivalent) {
    notes.push(
      `AstroWay /chart coordinates invariant across Mode A (${instant.timezone.ianaTimezone}) and Mode B (UTC) within ${Math.max(
        ascendantDeltaDeg || 0,
        maxPlanetDeltaDeg || 0
      )}°.`
    );
  } else {
    notes.push(
      `AstroWay /chart coordinate mathematical divergence: ΔAsc=${ascendantDeltaDeg}°, maxPlΔ=${maxPlanetDeltaDeg}°.`
    );
  }

  if (shadbalaAvailable) {
    if (shadbalaEquivalent) {
      notes.push(
        `AstroWay Shadbala (all 6 components + Kala subcomponents) INVARIANT across Mode A & Mode B (maxTotalΔ=${maxSbTotalDelta ?? 0}V, maxCompΔ=${maxSbCompDelta ?? 0}V).`
      );
    } else {
      notes.push(
        `AstroWay SHADBALA TIMEZONE INVARIANCE FAILURE: maxTotalΔ=${maxSbTotalDelta}V, maxCompΔ=${maxSbCompDelta}V.`
      );
    }
  } else {
    const sbBCls = getCls(shadbalaFullB) ?? 'not_yet_tested';
    const kalaBCls = getCls(shadbalaKalaB) ?? 'not_yet_tested';
    notes.push(
      `AstroWay Shadbala Mode A vs Mode B comparison incomplete (shadbala_full Mode B: ${sbBCls}; shadbala_kala Mode B: ${kalaBCls}).`
    );
  }

  if (panchangAudit) {
    notes.push(
      panchangAudit.equivalent
        ? 'AstroWay birth-instant Panchang (at="moment") invariant across Mode A & Mode B.'
        : `AstroWay Panchang divergence: ${panchangAudit.nonClockMismatches.join('; ')}`
    );
  }
  if (dashaAudit) {
    notes.push(
      dashaEquivalent
        ? 'AstroWay Vimshottari balance and durations invariant across Mode A & Mode B.'
        : `AstroWay Vimshottari divergence: ${dashaMismatches.join('; ')}`
    );
  }

  return {
    executed,
    status,
    modeARequest: chartA?.sanitizedRequest || {},
    modeBRequest: chartB?.sanitizedRequest || {},
    modeAStatus: chartA?.httpStatus ?? 0,
    modeBStatus: chartB?.httpStatus ?? 0,
    equivalent,
    coordinatesEquivalent,
    maxPlanetDeltaDeg,
    ascendantDeltaDeg,
    moonDeltaDeg,
    perPlanetDeltasDeg,
    shadbalaComparison: {
      available: shadbalaAvailable,
      equivalent: shadbalaEquivalent,
      maxTotalDeltaVirupas: maxSbTotalDelta,
      maxComponentDeltaVirupas: maxSbCompDelta,
      perPlanet: shadbalaRows,
    },
    dashaEquivalent,
    dashaMismatches,
    dashaAudit,
    panchangAudit,
    notes,
  };
}

function emptyClassificationCounts(): Record<EndpointAcquisitionClassification, number> {
  return {
    successfully_acquired: 0,
    rate_limited: 0,
    runtime_execution_blocked: 0,
    tier_restricted: 0,
    not_offered_by_provider: 0,
    not_yet_tested: 0,
    mathematical_verification_failed: 0,
  };
}

export function buildAstroWayLayerAFromCalls(params: {
  instant: CanonicalBirthInstant;
  orderedSpecs: AstroWayEvalEndpointSpec[];
  callsMap: Record<string, SanitizedProviderCallRecord>;
  batchState?: V2DiagnosticBatchState | null;
  totalRateLimitWindowWaitMs?: number;
  coordinationModesObserved?: Array<'global_supabase_cas' | 'isolate_memory_only'>;
}): LayerARawProviderRecord {
  const { instant, orderedSpecs, callsMap, batchState } = params;
  const calls: Record<string, SanitizedProviderCallRecord> = {};
  const missingDatasets: string[] = [];
  const tierRestrictedEndpoints: string[] = [];
  const observedHeadersByEndpoint: Record<string, Record<string, string>> = {};
  const classificationCounts = emptyClassificationCounts();

  let creditsUsedTotal = 0;
  let hasAnyCreditsUsed = false;
  let creditsRemainingFinal: string | null = null;
  let creditsLimitObserved: string | null = null;
  let creditsResetObserved: string | null = null;

  for (const spec of orderedSpecs) {
    const rec = callsMap[spec.id];
    if (!rec) continue;
    const cls: EndpointAcquisitionClassification =
      rec.acquisitionClassification ||
      classifyAstroWayCallOutcome({
        httpStatus: rec.httpStatus,
        ok: rec.ok,
        attempts: rec.attempts,
        errorMessage: rec.errorMessage,
      });
    const normalizedRec: SanitizedProviderCallRecord = {
      ...rec,
      acquisitionClassification: cls,
      priorityTier: rec.priorityTier ?? spec.priorityTier,
    };
    calls[spec.id] = normalizedRec;
    classificationCounts[cls] = (classificationCounts[cls] || 0) + 1;

    if (normalizedRec.quotaAndMetaHeaders && Object.keys(normalizedRec.quotaAndMetaHeaders).length > 0) {
      observedHeadersByEndpoint[spec.id] = normalizedRec.quotaAndMetaHeaders;
    }
    if (typeof normalizedRec.creditsUsed === 'number' && Number.isFinite(normalizedRec.creditsUsed)) {
      creditsUsedTotal += normalizedRec.creditsUsed;
      hasAnyCreditsUsed = true;
    }
    if (normalizedRec.quotaAndMetaHeaders?.['x-credits-remaining']) {
      creditsRemainingFinal = normalizedRec.quotaAndMetaHeaders['x-credits-remaining'];
    }
    if (!creditsLimitObserved && normalizedRec.quotaAndMetaHeaders?.['x-credits-limit']) {
      creditsLimitObserved = normalizedRec.quotaAndMetaHeaders['x-credits-limit'];
    }
    if (!creditsResetObserved && normalizedRec.quotaAndMetaHeaders?.['x-credits-reset']) {
      creditsResetObserved = normalizedRec.quotaAndMetaHeaders['x-credits-reset'];
    }

    if (!normalizedRec.ok) {
      if (cls === 'tier_restricted') {
        tierRestrictedEndpoints.push(`${spec.id} (${spec.path}: HTTP ${normalizedRec.httpStatus})`);
      }
      if (cls !== 'not_yet_tested') {
        missingDatasets.push(
          `${spec.id} (${spec.path}): [${cls.toUpperCase()}] HTTP ${normalizedRec.httpStatus}${
            normalizedRec.errorMessage ? ` — ${normalizedRec.errorMessage}` : ''
          }`
        );
      }
    }
  }

  const evalMap: Record<string, AstroWayEndpointCallResult> = {};
  for (const [k, v] of Object.entries(calls)) {
    evalMap[k] = toEvalCallResult(v);
  }

  const ephemerisTimestampCheck = evaluateAstroWayJulianDayCheck(
    instant,
    evalMap.chart_sidereal
  );

  const hasAnyProbeSpec = orderedSpecs.some((s) => s.category === 'timezone_probe');
  const validationFailures: string[] = [];
  let timezoneEquivalenceCheck: TimezoneEquivalenceCheck | null = null;
  if (hasAnyProbeSpec) {
    timezoneEquivalenceCheck = compareAstroWayModeAVsModeBResponses({
      instant,
      chartA: evalMap.chart_sidereal,
      chartB: evalMap.timezone_probe_mode_b_chart,
      shadbalaFullA: evalMap.shadbala_full,
      shadbalaFullB: evalMap.timezone_probe_mode_b_shadbala_full,
      shadbalaKalaA: evalMap.shadbala_kala,
      shadbalaKalaB: evalMap.timezone_probe_mode_b_shadbala_kala,
      panchangA: evalMap.vedic_panchang_full,
      panchangB: evalMap.timezone_probe_mode_b_panchang,
      dashaA: evalMap.dashas_vimshottari_prana,
      dashaB: evalMap.timezone_probe_mode_b_dasha,
    });
    if (timezoneEquivalenceCheck.status === 'mathematical_verification_failed') {
      validationFailures.push(
        `AstroWay Mode A vs Mode B mathematical divergence: ${timezoneEquivalenceCheck.notes.join(' ')}`
      );
    }
  }

  if (ephemerisTimestampCheck && ephemerisTimestampCheck.julianDayMatch === false) {
    validationFailures.push(
      `AstroWay Julian Day delta=${ephemerisTimestampCheck.deltaSecondsFromCanonical ?? 'N/A'}s (${ephemerisTimestampCheck.limitationNotes.join(' ')})`
    );
  }

  const allCallValues = Object.values(calls);
  const successfulCalls = classificationCounts.successfully_acquired;
  const failedCalls = allCallValues.length - successfulCalls;
  const actualHttpRequestsSent = allCallValues.reduce(
    (s, c) => s + (typeof c.attempts === 'number' ? c.attempts : 0),
    0
  );
  const retryCount = allCallValues.reduce(
    (s, c) => s + Math.max(0, (typeof c.attempts === 'number' ? c.attempts : 0) - 1),
    0
  );
  const totalRateWaitMs = Math.max(
    params.totalRateLimitWindowWaitMs ?? 0,
    allCallValues.reduce((s, c) => s + (c.rateWaitMs || 0), 0)
  );

  const acquisitionStatus: LayerARawProviderRecord['acquisitionStatus'] =
    successfulCalls === allCallValues.length && allCallValues.length > 0
      ? 'complete'
      : successfulCalls > 0
      ? 'partial'
      : 'failed';

  const hasObservedHeaders = Object.keys(observedHeadersByEndpoint).length > 0;
  const quotaHeadersObserved: ObservedQuotaHeadersSummary = {
    status: hasObservedHeaders ? 'measured_from_headers' : 'not_provided_by_provider',
    observedHeadersByEndpoint,
    remainingQuotaObserved: creditsRemainingFinal
      ? `x-credits-remaining: ${creditsRemainingFinal}`
      : null,
    rateLimitObserved: creditsLimitObserved ? `x-credits-limit: ${creditsLimitObserved}` : null,
    creditsUsedTotal: hasAnyCreditsUsed ? creditsUsedTotal : null,
    creditsRemainingFinal,
    creditsLimitObserved,
    creditsResetObserved,
    tierRestrictedEndpoints,
    note: hasObservedHeaders
      ? `AstroWay headers measured across ${actualHttpRequestsSent} HTTP call(s) (credits used=${
          hasAnyCreditsUsed ? creditsUsedTotal : 'N/A'
        }, remaining=${creditsRemainingFinal ?? 'N/A'}, tierRestricted=${
          classificationCounts.tier_restricted
        }, rateLimited=${classificationCounts.rate_limited}, notYetTested=${
          classificationCounts.not_yet_tested
        }).`
      : 'AstroWay HTTP responses did not include credit headers.',
  };

  const coordModes =
    params.coordinationModesObserved && params.coordinationModesObserved.length > 0
      ? params.coordinationModesObserved
      : Array.from(new Set(allCallValues.map((c) => c.coordinationMode)));

  return {
    schemaVersion: 'v2.raw.1.0',
    capturedAtUtc: new Date().toISOString(),
    providerId: 'astroway',
    providerLabel: 'AstroWay V1 API',
    providerBaseUrl: ASTROWAY_BASE_URL,
    inputFingerprint: instant.inputFingerprint,
    canonicalUtcIso: instant.utc.iso,
    canonicalJulianDayUt: instant.utc.julianDayUt,
    acquisitionStatus,
    missingDatasets,
    validationFailures,
    calls,
    timezoneEquivalenceCheck,
    ephemerisTimestampCheck,
    batchState: batchState ?? null,
    quotaAndPerformanceSummary: {
      plannedRequestsCount: orderedSpecs.length,
      totalCalls: allCallValues.length,
      actualHttpRequestsSent,
      retryCount,
      successfulCalls,
      failedCalls,
      tierRestrictedCalls: classificationCounts.tier_restricted,
      rateLimitedCalls: classificationCounts.rate_limited,
      runtimeBlockedCalls: classificationCounts.runtime_execution_blocked,
      notOfferedCalls: classificationCounts.not_offered_by_provider,
      unexecutedCalls: classificationCounts.not_yet_tested,
      mathematicalVerificationFailedCalls: classificationCounts.mathematical_verification_failed,
      classificationCounts,
      rateLimitWindowWaitMs: params.totalRateLimitWindowWaitMs ?? totalRateWaitMs,
      totalLatencyMs: allCallValues.reduce((s, c) => s + c.latencyMs, 0),
      totalRateWaitMs,
      totalPayloadBytes: allCallValues.reduce((s, c) => s + c.payloadBytes, 0),
      coordinationModesObserved: coordModes,
      quotaHeadersObserved,
    },
  };
}

export interface ExecuteAstroWayBatchedBundleOptions {
  apiKey?: string;
  timeMode?: 'local_iana' | 'utc';
  includeTimezoneEquivalenceProbe?: boolean;
  existingCalls?: Record<string, SanitizedProviderCallRecord>;
  sessionId?: string;
  batchSize?: number;
  batchIndex?: number;
  priorRateLimitWindowWaitMs?: number;
  resumedFromSession?: boolean;
  allowSinglePassOverride?: boolean;
  maxSubrequestsBudget?: number;
  fetchFn?: AstroWayFetchFn;
  endpointIds?: string[];
  skipGlobalCooldown?: boolean;
}

/**
 * Executes a single bounded, rate-limit-aware, priority-ordered AstroWay batch,
 * preserving all prior settled responses and halting immediately on HTTP 429 or
 * `x-ratelimit-remaining === 0` so Worker subrequest limits are never exhausted.
 */
export async function executeAstroWayBatchedBundle(
  instant: CanonicalBirthInstant,
  options?: ExecuteAstroWayBatchedBundleOptions
): Promise<{
  layerA: LayerARawProviderRecord;
  batchState: V2DiagnosticBatchState;
  updatedCalls: Record<string, SanitizedProviderCallRecord>;
}> {
  const apiKey = (options?.apiKey || getAstroWayApiKey() || '').trim();
  if (!apiKey) {
    throw new Error(
      'ASTROWAY_API_KEY is not configured in server environment secrets. Live AstroWay acquisition aborted (no silent fallback).'
    );
  }

  const plan = buildAstroWayChris4EvaluationPlan(instant, {
    timeMode: options?.timeMode ?? (instant.timezone.ianaTimezone ? 'local_iana' : 'utc'),
  });
  if (plan.validationErrors.length > 0) {
    throw new Error(`AstroWay preflight failed: ${plan.validationErrors.join('; ')}`);
  }

  const runProbe = Boolean(
    options?.includeTimezoneEquivalenceProbe && instant.timezone.ianaTimezone
  );
  const probeSpecs = buildAstroWayProbeSpecs(instant, runProbe);
  let orderedSpecs = orderAstroWaySpecsForPriorityVerification(plan.requests, probeSpecs);
  if (options?.endpointIds?.length) {
    const filterSet = new Set(options.endpointIds);
    orderedSpecs = orderedSpecs.filter((s) => filterSet.has(s.id));
  }

  const sessionId = (options?.sessionId || '').trim() || generateSessionId();
  const batchIndex = (options?.batchIndex ?? 0) + 1;
  const effectiveBatchSize = options?.allowSinglePassOverride
    ? orderedSpecs.length
    : Math.max(1, Math.min(9, options?.batchSize ?? 8));
  const maxSubrequestsBudget = options?.maxSubrequestsBudget ?? 32;

  const callsMap: Record<string, SanitizedProviderCallRecord> = {};
  if (options?.existingCalls) {
    for (const [k, v] of Object.entries(options.existingCalls)) {
      callsMap[k] = { ...v };
    }
  }

  let totalRateLimitWindowWaitMs = Math.max(0, options?.priorRateLimitWindowWaitMs ?? 0);
  let retryAfterMs = 0;
  let nextAvailableAtUtc: string | null = null;
  let rateLimitResetSource: string | null = null;
  let rateLimitLimitObserved: number | null = null;
  let rateLimitRemainingObserved: number | null = null;
  let haltedReason: string | null = null;
  let executedThisBatch = 0;
  let subrequestsUsed = 0;
  let firstCallRateWaitMs = 0;
  const coordModes = new Set<'global_supabase_cas' | 'isolate_memory_only'>();

  const globalRead = options?.skipGlobalCooldown
    ? {
        state: {
          window_reset_ms: 0,
          remaining_in_window: null,
          limit: null,
          last_retry_after_ms: null,
          reset_source: null,
          total_window_wait_ms: 0,
          updated_at_ms: 0,
        } satisfies AstroWayRateLimitState,
        coordinationMode: 'isolate_memory_only' as const,
      }
    : await readAstroWayGlobalRateState();

  coordModes.add(globalRead.coordinationMode);
  let currentRateState = globalRead.state;
  rateLimitLimitObserved = currentRateState.limit;
  rateLimitRemainingObserved = currentRateState.remaining_in_window;
  rateLimitResetSource = currentRateState.reset_source;

  const nowMs = Date.now();
  let cooldownActive = false;
  if (currentRateState.window_reset_ms > nowMs) {
    const remainingCooldownMs = currentRateState.window_reset_ms - nowMs;
    if (remainingCooldownMs <= 2_500) {
      await new Promise((r) => setTimeout(r, remainingCooldownMs));
      firstCallRateWaitMs = remainingCooldownMs;
      totalRateLimitWindowWaitMs += remainingCooldownMs;
      currentRateState = {
        ...currentRateState,
        window_reset_ms: 0,
        remaining_in_window: null,
        total_window_wait_ms: currentRateState.total_window_wait_ms + remainingCooldownMs,
        updated_at_ms: Date.now(),
      };
      if (!options?.skipGlobalCooldown) {
        const wMode = await writeAstroWayGlobalRateState(currentRateState);
        coordModes.add(wMode);
      }
    } else {
      cooldownActive = true;
      retryAfterMs = remainingCooldownMs;
      nextAvailableAtUtc = new Date(currentRateState.window_reset_ms).toISOString();
      haltedReason = `AstroWay provider rate-limit window active; resume after ${Math.ceil(
        remainingCooldownMs / 1000
      )}s (${nextAvailableAtUtc}).`;
    }
  }

  if (!cooldownActive) {
    for (const spec of orderedSpecs) {
      if (isSettledAstroWayCall(callsMap[spec.id])) {
        continue;
      }
      if (executedThisBatch >= effectiveBatchSize) {
        haltedReason = `Bounded batch size (${effectiveBatchSize}) completed cleanly within Worker limits.`;
        break;
      }
      if (subrequestsUsed >= maxSubrequestsBudget) {
        haltedReason = `Subrequest safety ceiling (${maxSubrequestsBudget}) reached.`;
        break;
      }

      const appliedWait = firstCallRateWaitMs;
      firstCallRateWaitMs = 0;

      const callResult = await executeSingleAstroWaySpec(spec, apiKey, {
        fetchFn: options?.fetchFn,
        coordinationMode: globalRead.coordinationMode,
        rateWaitMs: appliedWait,
      });
      subrequestsUsed++;
      executedThisBatch++;

      const sanitizedCall = toSanitizedCallRecord(callResult);
      callsMap[spec.id] = sanitizedCall;

      const parsedHeaders = parseAstroWayRateLimitHeaders(callResult.creditAndMetaHeaders);
      if (parsedHeaders.limit !== null) rateLimitLimitObserved = parsedHeaders.limit;
      if (parsedHeaders.remaining !== null) rateLimitRemainingObserved = parsedHeaders.remaining;
      if (parsedHeaders.resetSource) rateLimitResetSource = parsedHeaders.resetSource;

      if (callResult.httpStatus === 429) {
        const waitMs = parsedHeaders.retryAfterMs ?? 50_000;
        const resetAtMs = parsedHeaders.windowResetAtMs ?? Date.now() + waitMs;
        retryAfterMs = Math.max(0, resetAtMs - Date.now());
        nextAvailableAtUtc = new Date(resetAtMs).toISOString();
        haltedReason = `HTTP 429 received on ${spec.id}; halting batch immediately without retry until ${nextAvailableAtUtc}.`;

        currentRateState = {
          window_reset_ms: resetAtMs,
          remaining_in_window: 0,
          limit: rateLimitLimitObserved,
          last_retry_after_ms: retryAfterMs,
          reset_source: rateLimitResetSource || 'http_429_default_50s',
          total_window_wait_ms: currentRateState.total_window_wait_ms,
          updated_at_ms: Date.now(),
        };
        if (!options?.skipGlobalCooldown) {
          const wMode = await writeAstroWayGlobalRateState(currentRateState);
          coordModes.add(wMode);
        }
        break;
      }

      if (parsedHeaders.remaining === 0) {
        const waitMs = parsedHeaders.retryAfterMs ?? 50_000;
        const resetAtMs = parsedHeaders.windowResetAtMs ?? Date.now() + waitMs;
        retryAfterMs = Math.max(0, resetAtMs - Date.now());
        nextAvailableAtUtc = new Date(resetAtMs).toISOString();
        haltedReason = `AstroWay window allowance reached (x-ratelimit-remaining=0 after ${spec.id}); halting proactively until ${nextAvailableAtUtc}.`;

        currentRateState = {
          window_reset_ms: resetAtMs,
          remaining_in_window: 0,
          limit: rateLimitLimitObserved,
          last_retry_after_ms: retryAfterMs,
          reset_source: rateLimitResetSource || 'x-ratelimit-remaining-zero',
          total_window_wait_ms: currentRateState.total_window_wait_ms,
          updated_at_ms: Date.now(),
        };
        if (!options?.skipGlobalCooldown) {
          const wMode = await writeAstroWayGlobalRateState(currentRateState);
          coordModes.add(wMode);
        }
        break;
      }
    }
  }

  // Ensure every planned endpoint has an explicit call record ('not_yet_tested' when untouched)
  for (const spec of orderedSpecs) {
    if (!callsMap[spec.id]) {
      callsMap[spec.id] = makeNotYetTestedCallRecord(spec, apiKey, globalRead.coordinationMode);
    }
  }

  const classificationCounts = emptyClassificationCounts();
  let remainingEligibleCount = 0;
  for (const spec of orderedSpecs) {
    const rec = callsMap[spec.id];
    const cls =
      rec.acquisitionClassification ||
      classifyAstroWayCallOutcome({
        httpStatus: rec.httpStatus,
        ok: rec.ok,
        attempts: rec.attempts,
        errorMessage: rec.errorMessage,
      });
    classificationCounts[cls] = (classificationCounts[cls] || 0) + 1;
    if (!isSettledAstroWayCall(rec)) {
      remainingEligibleCount++;
    }
  }

  const batchStatus: V2DiagnosticBatchState['status'] =
    remainingEligibleCount === 0
      ? classificationCounts.tier_restricted > 0 ||
        classificationCounts.not_offered_by_provider > 0
        ? 'completed_with_restrictions'
        : 'completed'
      : retryAfterMs > 0
      ? 'waiting_rate_limit'
      : executedThisBatch === 0 && cooldownActive
      ? 'waiting_rate_limit'
      : 'in_progress';

  const batchState: V2DiagnosticBatchState = {
    sessionId,
    status: batchStatus,
    batchIndex,
    batchSize: effectiveBatchSize,
    totalPlannedCount: orderedSpecs.length,
    executedThisBatch,
    remainingEligibleCount,
    retryAfterMs,
    nextAvailableAtUtc,
    rateLimitResetSource,
    rateLimitLimitObserved,
    rateLimitRemainingObserved,
    totalRateLimitWindowWaitMs,
    classificationCounts,
    haltedReason,
    resumedFromSession: Boolean(options?.resumedFromSession),
  };

  const layerA = buildAstroWayLayerAFromCalls({
    instant,
    orderedSpecs,
    callsMap,
    batchState,
    totalRateLimitWindowWaitMs,
    coordinationModesObserved: Array.from(coordModes),
  });

  return {
    layerA,
    batchState,
    updatedCalls: layerA.calls,
  };
}

/**
 * Isolated evaluation runner (for CLI or diagnostic bundle execution).
 * Uses the rate-limit-aware, priority-ordered coordinator without blind 429 retry loops.
 */
export async function executeAstroWayEvaluationBundle(
  instant: CanonicalBirthInstant,
  options?: {
    apiKey?: string;
    endpointIds?: string[];
    delayBetweenCallsMs?: number;
    concurrency?: number;
    timeMode?: 'local_iana' | 'utc';
    fetchFn?: AstroWayFetchFn;
  }
): Promise<AstroWayEvaluationBundle> {
  const plan = buildAstroWayChris4EvaluationPlan(instant, {
    timeMode: options?.timeMode,
  });
  if (plan.validationErrors.length > 0) {
    throw new Error(`AstroWay preflight failed: ${plan.validationErrors.join('; ')}`);
  }

  const apiKey = (options?.apiKey || getAstroWayApiKey() || '').trim();
  const epistemicBoundaryNote =
    'Cross-checking FreeAstroAPI vs AstroWay evaluates inter-provider agreement only. Authoritative ground-truth remains pending external validation against JHora, PyJHora, or Swiss Ephemeris.';

  const targetRequests = options?.endpointIds?.length
    ? plan.requests.filter((r) => options.endpointIds!.includes(r.id))
    : plan.requests;

  if (!apiKey) {
    return {
      schemaVersion: 'v2.astroway_eval.1.0',
      executedAtUtc: new Date().toISOString(),
      status: 'blocked_missing_api_key',
      inputFingerprint: instant.inputFingerprint,
      canonicalUtcIso: instant.utc.iso,
      secretStatus: getAstroWayApiSecretStatus(),
      accessRequirements: ASTROWAY_ACCESS_REQUIREMENTS,
      epistemicBoundaryNote,
      plannedRequestsCount: targetRequests.length,
      successfulCallsCount: 0,
      failedCallsCount: 0,
      observedCreditHeadersSummary: {
        creditsUsedHeaderObserved: null,
        creditsUsedTotal: null,
        creditsRemainingHeaderObserved: null,
        creditsLimitHeaderObserved: null,
        creditsResetHeaderObserved: null,
      },
      results: {},
      shadbalaCrossCheckNote:
        'Blocked: configure ASTROWAY_API_KEY (Free tier: 10,000 credits/month, no credit card) to run live Shadbala & missing-dataset verification.',
    };
  }

  const batched = await executeAstroWayBatchedBundle(instant, {
    apiKey,
    timeMode: options?.timeMode,
    includeTimezoneEquivalenceProbe: false,
    endpointIds: options?.endpointIds,
    allowSinglePassOverride: true,
    maxSubrequestsBudget: targetRequests.length + 5,
    fetchFn: options?.fetchFn,
    skipGlobalCooldown: true,
  });

  const results: Record<string, AstroWayEndpointCallResult> = {};
  for (const [id, c] of Object.entries(batched.layerA.calls)) {
    results[id] = toEvalCallResult(c);
  }

  const successfulCallsCount = batched.layerA.quotaAndPerformanceSummary.successfulCalls;
  const failedCallsCount = batched.layerA.quotaAndPerformanceSummary.failedCalls;
  const status: AstroWayEvaluationBundle['status'] =
    successfulCallsCount === targetRequests.length
      ? 'complete'
      : successfulCallsCount > 0
      ? 'partial'
      : 'failed';

  return {
    schemaVersion: 'v2.astroway_eval.1.0',
    executedAtUtc: new Date().toISOString(),
    status,
    inputFingerprint: instant.inputFingerprint,
    canonicalUtcIso: instant.utc.iso,
    secretStatus: getAstroWayApiSecretStatus(),
    accessRequirements: ASTROWAY_ACCESS_REQUIREMENTS,
    epistemicBoundaryNote,
    plannedRequestsCount: targetRequests.length,
    successfulCallsCount,
    failedCallsCount,
    observedCreditHeadersSummary: {
      creditsUsedHeaderObserved: null,
      creditsUsedTotal: batched.layerA.quotaAndPerformanceSummary.quotaHeadersObserved.creditsUsedTotal ?? null,
      creditsRemainingHeaderObserved:
        batched.layerA.quotaAndPerformanceSummary.quotaHeadersObserved.creditsRemainingFinal ?? null,
      creditsLimitHeaderObserved:
        batched.layerA.quotaAndPerformanceSummary.quotaHeadersObserved.creditsLimitObserved ?? null,
      creditsResetHeaderObserved:
        batched.layerA.quotaAndPerformanceSummary.quotaHeadersObserved.creditsResetObserved ?? null,
    },
    results,
    shadbalaCrossCheckNote: results.shadbala_kala?.ok
      ? 'AstroWay /vedic/shadbala/kala acquired; inspect abdaMasaVaraHora & nathonnatha against FreeAstroAPI Mode A/B kala_bala (subject to external JHora/PyJHora validation).'
      : null,
  };
}

/**
 * Executes a bounded AstroWay diagnostic acquisition batch (default 8 endpoints,
 * Worker subrequest & rate-limit safe) and returns a consolidated LayerARawProviderRecord.
 */
export async function acquireAstroWayV2Bundle(
  instant: CanonicalBirthInstant,
  options?: {
    apiKey?: string;
    timeMode?: 'local_iana' | 'utc';
    includeTimezoneEquivalenceProbe?: boolean;
    existingCalls?: Record<string, SanitizedProviderCallRecord>;
    sessionId?: string;
    batchSize?: number;
    batchIndex?: number;
    priorRateLimitWindowWaitMs?: number;
    resumedFromSession?: boolean;
    fetchFn?: AstroWayFetchFn;
  }
): Promise<LayerARawProviderRecord> {
  const { layerA } = await executeAstroWayBatchedBundle(instant, options);
  return layerA;
}
