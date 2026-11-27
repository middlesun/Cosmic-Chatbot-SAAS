/**
 * Isolated FreeAstroAPI Proof-of-Concept Benchmark Runner
 * Pure Web Fetch + TypeScript (zero Node fs/os/path dependencies; Cloudflare Workers compatible).
 * Zero production mutations, zero DB writes, never exposes API credentials.
 */

import {
  computeAshtakavarga,
  computeDivisionalCharts,
  computeKPPlacidusCusps,
  computeKPSignificators,
  computeMajorYogas,
  computePlanetaryConditions,
  computeShadbala,
  formatDMS,
  getDignity,
  getKPAyanamsaApprox,
  getLahiriAyanamsaApprox,
  getNakshatraAndSubs,
  normalizeDeg,
  SIGNS,
  toJulianDay,
  type PlanetPosition,
} from './jyotishMath';

const BASE_URL = 'https://api.freeastroapi.com';
const DEFAULT_RATE_WAIT_MS = 1150;

export const NEW_DELHI_REFERENCE = {
  name: 'Sample Chart 2 (New Delhi)',
  year: 1988,
  month: 11,
  day: 24,
  hour: 18,
  minute: 45,
  second: 0,
  birthDateISO: '1988-11-24',
  birthTimeStr: '18:45:00',
  city: 'New Delhi',
  lat: 28.6139,
  lng: 77.209,
  tzOffsetHours: 5.5,
  tz_str: 'Asia/Kolkata',
  ayanamsha: 'lahiri',
  house_system: 'whole_sign',
  node_type: 'mean',
} as const;

export const ALL_SUPPORTED_VARGAS = [
  1, 2, 3, 4, 5, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60,
] as const;

export interface PocCallRecord {
  id: string;
  endpoint: string;
  status: number;
  ok: boolean;
  latencyMs: number;
  payloadBytes: number;
  headers: Record<string, string>;
  data: unknown;
}

export interface FreeAstroApiPocReport {
  generatedAt: string;
  referenceProfile: typeof NEW_DELHI_REFERENCE;
  performanceSummary: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalLatencyMs: number;
    totalPayloadBytes: number;
  };
  quotaAndPerformance: Array<{
    id: string;
    endpoint: string;
    status: number;
    ok: boolean;
    latencyMs: number;
    payloadBytes: number;
    headers: Record<string, string>;
  }>;
  audits: {
    strengthMetadata: unknown;
    calculateMetadata: unknown;
    astronomicalReferenceCheck: {
      julianDay: number;
      expectedLahiriAyanamshaApprox: number;
      expectedKpAyanamshaApprox: number;
      expectedKpMinusLahiriDeg: number;
      apiLahiriAscendantDeg: number | null;
      apiKpAscendantDeg: number | null;
      observedAscKpMinusLahiriDeg: number | null;
      planetLongitudesComparison: Array<{
        planet: string;
        lahiriLon: number;
        lahiriSign: string;
        degInSign: number;
        retrograde: boolean;
        kpLon: number | null;
        observedKpMinusLahiriDeg: number | null;
      }>;
    };
    shadbalaComparison: Array<Record<string, unknown>>;
    digBalaMethodologyAudit: Array<Record<string, unknown>>;
    ashtakavargaAudit: Record<string, unknown>;
    ashtakavargaSavComparison: Array<Record<string, unknown>> | null;
    avasthaAudit: Array<Record<string, unknown>>;
    kpCuspsCount: number;
    kpPlanetSignificators: unknown;
    kpRahuKetuInspect: Array<Record<string, unknown>>;
    localKpSignificatorsRef: unknown;
    yogasCount: number;
    yogasActiveCount: number;
    localMajorYogasCount: number;
    yogasSampleNames: string[];
    vargasReturnedFromVargasEndpoint: string[];
    vargasReturnedFromCalculateEndpoint: string[];
    westernSummary: {
      natalStatus: number;
      profectionsStatus: number;
      progressionsStatus: number;
      solarReturnStatus: number;
    };
    gocharTimelineStatus: number;
    missingRequirementsChecklist: {
      shadbalaSubcomponentsPresent: boolean;
      ishtaKashtaPhalaPresent: boolean;
      bhavabalaPresent: boolean;
      vimshopakaBalaPresent: boolean;
      jaiminiPresent: boolean;
    };
  };
  rawResponses: Record<string, unknown>;
}

const textEncoder = new TextEncoder();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function circularDiffDeg(a: number, b: number): number {
  let d = normalizeDeg(a) - normalizeDeg(b);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

async function callEndpoint(
  id: string,
  endpointPath: string,
  body: Record<string, unknown>,
  apiKey: string
): Promise<PocCallRecord> {
  const started = Date.now();
  const res = await fetch(`${BASE_URL}${endpointPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const latencyMs = Date.now() - started;

  const capturedHeaders: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (
      lk.includes('rate') ||
      lk.includes('limit') ||
      lk.includes('quota') ||
      lk.includes('remaining') ||
      lk.includes('cache') ||
      lk.includes('retry') ||
      lk.includes('request-id')
    ) {
      capturedHeaders[lk] = value;
    }
  });

  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Keep raw text if non-JSON response
  }

  return {
    id,
    endpoint: endpointPath,
    status: res.status,
    ok: res.ok,
    latencyMs,
    payloadBytes: textEncoder.encode(text).length,
    headers: capturedHeaders,
    data: parsed,
  };
}

function buildLocalReferenceFromApiLongitudes(
  planetsRaw: Array<Record<string, unknown>>,
  ascDeg: number
): PlanetPosition[] {
  const ascSign = Math.floor(normalizeDeg(ascDeg) / 30) % 12;
  const rows: PlanetPosition[] = [];

  const ascNak = getNakshatraAndSubs(ascDeg);
  rows.push({
    name: 'Ascendant',
    longitude: Number(normalizeDeg(ascDeg).toFixed(4)),
    signIndex: ascSign,
    sign: SIGNS[ascSign],
    degreeInSign: Number((normalizeDeg(ascDeg) % 30).toFixed(4)),
    dms: formatDMS(normalizeDeg(ascDeg) % 30),
    nakshatra: ascNak.nakshatra,
    nakshatraIndex: ascNak.nakshatraIndex,
    nakshatraLord: ascNak.nakshatraLord,
    pada: ascNak.pada,
    subLord: ascNak.subLord,
    subSubLord: ascNak.subSubLord,
    isRetrograde: false,
    house: 1,
    dignity: 'Lagna',
  });

  for (const p of planetsRaw) {
    const name = String(p.name || '').trim();
    const lon = normalizeDeg(Number(p.absolute_degree ?? 0));
    const signIndex = Math.floor(lon / 30) % 12;
    const degInSign = lon % 30;
    const nak = getNakshatraAndSubs(lon);
    rows.push({
      name,
      longitude: Number(lon.toFixed(4)),
      signIndex,
      sign: SIGNS[signIndex],
      degreeInSign: Number(degInSign.toFixed(4)),
      dms: formatDMS(degInSign),
      nakshatra: nak.nakshatra,
      nakshatraIndex: nak.nakshatraIndex,
      nakshatraLord: nak.nakshatraLord,
      pada: nak.pada,
      subLord: nak.subLord,
      subSubLord: nak.subSubLord,
      isRetrograde: Boolean(p.is_retrograde),
      house: ((signIndex - ascSign + 12) % 12) + 1,
      dignity: getDignity(name, signIndex),
    });
  }

  return rows;
}

function auditAshtakavarga(strengthData: Record<string, unknown>) {
  const av = (strengthData?.ashtakavarga ?? null) as Record<string, unknown> | null;
  if (!av) return { present: false };

  const sav = Array.isArray(av.sarvashtakavarga) ? (av.sarvashtakavarga as number[]) : [];
  const bav = (av.bhinnashtakavarga ?? {}) as Record<string, number[]>;
  const prasthara = (av.prastharashtakavarga ?? {}) as Record<string, Record<string, number[]>>;

  const savTotal = sav.reduce((a, b) => a + Number(b || 0), 0);
  const bavCrossCheckErrors: string[] = [];
  const prastharaCrossCheckErrors: string[] = [];

  for (let i = 0; i < 12; i++) {
    let colSum = 0;
    for (const row of Object.values(bav)) {
      colSum += Number(row?.[i] || 0);
    }
    if (sav[i] !== colSum) {
      bavCrossCheckErrors.push(`Sign[${i}]: SAV=${sav[i]} vs sum(BAV)=${colSum}`);
    }
  }

  for (const [planet, row] of Object.entries(bav)) {
    const matrix = prasthara[planet];
    if (!matrix) {
      prastharaCrossCheckErrors.push(`Missing Prasthara matrix for ${planet}`);
      continue;
    }
    for (let i = 0; i < 12; i++) {
      let cellSum = 0;
      for (const contrib of Object.values(matrix)) {
        cellSum += Number(contrib?.[i] || 0);
      }
      if (Number(row?.[i] || 0) !== cellSum) {
        prastharaCrossCheckErrors.push(
          `${planet} Sign[${i}]: BAV=${row?.[i]} vs sum(Prasthara)=${cellSum}`
        );
      }
    }
  }

  return {
    present: true,
    savTotal,
    expectedClassicalTotal: 337,
    totalMatches337: savTotal === 337,
    bavCrossCheckErrors,
    prastharaCrossCheckErrors,
    hasShodhanaFields: Boolean(av.trikona_shodhana || av.ekadipati_shodhana || av.shodhya_pinda),
  };
}

function auditDigBalaMethodology(
  shadbalaRaw: Record<string, Record<string, unknown>>,
  planetsRaw: Array<Record<string, unknown>>,
  ascDeg: number,
  kpCuspsRaw: Array<Record<string, unknown>>
) {
  const jd = toJulianDay(
    NEW_DELHI_REFERENCE.year,
    NEW_DELHI_REFERENCE.month,
    NEW_DELHI_REFERENCE.day,
    NEW_DELHI_REFERENCE.hour + NEW_DELHI_REFERENCE.minute / 60 - NEW_DELHI_REFERENCE.tzOffsetHours
  );
  const lahiri = getLahiriAyanamsaApprox(jd);
  const kpAy = getKPAyanamsaApprox(jd);
  const kpToLahiriDelta = kpAy - lahiri;

  const cusp1 = kpCuspsRaw.find((c) => Number(c.house) === 1);
  const cusp4 = kpCuspsRaw.find((c) => Number(c.house) === 4);
  const cusp7 = kpCuspsRaw.find((c) => Number(c.house) === 7);
  const cusp10 = kpCuspsRaw.find((c) => Number(c.house) === 10);

  const h1Lahiri = cusp1 ? normalizeDeg(Number(cusp1.degree) + kpToLahiriDelta) : ascDeg;
  const h4Lahiri = cusp4
    ? normalizeDeg(Number(cusp4.degree) + kpToLahiriDelta)
    : normalizeDeg(ascDeg + 90);
  const h7Lahiri = cusp7
    ? normalizeDeg(Number(cusp7.degree) + kpToLahiriDelta)
    : normalizeDeg(ascDeg + 180);
  const h10Lahiri = cusp10
    ? normalizeDeg(Number(cusp10.degree) + kpToLahiriDelta)
    : normalizeDeg(ascDeg + 270);

  const calcDig = (pLon: number, maxStrengthPoint: number) => {
    const powerlessPoint = normalizeDeg(maxStrengthPoint + 180);
    const arc = Math.abs(circularDiffDeg(pLon, powerlessPoint));
    return Number(((arc / 180) * 60).toFixed(2));
  };

  const comparisons: Array<Record<string, unknown>> = [];
  for (const name of ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']) {
    const pRow = planetsRaw.find((p) => String(p.name) === name);
    const sRow = shadbalaRaw?.[name];
    if (!pRow || !sRow) continue;
    const pLon = Number(pRow.absolute_degree);
    const apiDig = Number(sRow.dig_bala);

    const equalMax =
      name === 'Mercury' || name === 'Jupiter'
        ? ascDeg
        : name === 'Moon' || name === 'Venus'
        ? normalizeDeg(ascDeg + 90)
        : name === 'Saturn'
        ? normalizeDeg(ascDeg + 180)
        : normalizeDeg(ascDeg + 270);

    const placidusMax =
      name === 'Mercury' || name === 'Jupiter'
        ? h1Lahiri
        : name === 'Moon' || name === 'Venus'
        ? h4Lahiri
        : name === 'Saturn'
        ? h7Lahiri
        : h10Lahiri;

    const equalDig = calcDig(pLon, equalMax);
    const placidusDig = calcDig(pLon, placidusMax);

    comparisons.push({
      planet: name,
      apiDigBala: apiDig,
      placidusBasisDigBala: placidusDig,
      equal90DegBasisDigBala: equalDig,
      deltaApiVsPlacidus: Number((apiDig - placidusDig).toFixed(2)),
      deltaApiVsEqual90: Number((apiDig - equalDig).toFixed(2)),
    });
  }

  return comparisons;
}

export async function runFreeAstroApiPocBenchmark(options?: {
  apiKey?: string;
  rateWaitMs?: number;
  onProgress?: (msg: string) => void;
}): Promise<FreeAstroApiPocReport> {
  const apiKey = (options?.apiKey ?? process.env.FREE_ASTRO_API_KEY ?? '').trim();
  if (!apiKey) {
    throw new Error('FREE_ASTRO_API_KEY is not configured in server environment secrets.');
  }

  const rateWaitMs =
    typeof options?.rateWaitMs === 'number' && options.rateWaitMs >= 0
      ? options.rateWaitMs
      : DEFAULT_RATE_WAIT_MS;

  const refDateISO = new Date().toISOString().slice(0, 10);
  const baseBody = {
    year: NEW_DELHI_REFERENCE.year,
    month: NEW_DELHI_REFERENCE.month,
    day: NEW_DELHI_REFERENCE.day,
    hour: NEW_DELHI_REFERENCE.hour,
    minute: NEW_DELHI_REFERENCE.minute,
    city: NEW_DELHI_REFERENCE.city,
    lat: NEW_DELHI_REFERENCE.lat,
    lng: NEW_DELHI_REFERENCE.lng,
    tz_str: NEW_DELHI_REFERENCE.tz_str,
    ayanamsha: NEW_DELHI_REFERENCE.ayanamsha,
    house_system: NEW_DELHI_REFERENCE.house_system,
    node_type: NEW_DELHI_REFERENCE.node_type,
  };

  const calls: PocCallRecord[] = [];
  const runStep = async (id: string, endpoint: string, body: Record<string, unknown>) => {
    if (calls.length > 0 && rateWaitMs > 0) await sleep(rateWaitMs);
    options?.onProgress?.(`[PoC] Calling ${id}: POST ${endpoint} ...`);
    const rec = await callEndpoint(id, endpoint, body, apiKey);
    calls.push(rec);
    options?.onProgress?.(
      `      -> HTTP ${rec.status} | ${rec.latencyMs}ms | ${rec.payloadBytes} bytes`
    );
    return rec;
  };

  // A. Full Vedic Calculate V2 (Max parameters)
  const calcRes = await runStep('A_full_vedic_calculate_v2', '/api/v2/vedic/calculate', {
    ...baseBody,
    vargas: [...ALL_SUPPORTED_VARGAS],
    include_avastha: true,
    include_yogas: true,
    include_panchang: true,
    include_shadbala: true,
    include_ashtakavarga: true,
    dasha_levels: 3,
    reference_date: refDateISO,
  });

  // B. Planetary Strength V2
  const strengthRes = await runStep('B_planetary_strength_v2', '/api/v2/vedic/strength', baseBody);

  // C. KP Astrology (dedicated KP ayanamsha + Placidus preserved separately)
  const kpRes = await runStep('C_kp_astrology_v2', '/api/v2/vedic/kp', {
    year: NEW_DELHI_REFERENCE.year,
    month: NEW_DELHI_REFERENCE.month,
    day: NEW_DELHI_REFERENCE.day,
    hour: NEW_DELHI_REFERENCE.hour,
    minute: NEW_DELHI_REFERENCE.minute,
    second: NEW_DELHI_REFERENCE.second,
    city: NEW_DELHI_REFERENCE.city,
    lat: NEW_DELHI_REFERENCE.lat,
    lng: NEW_DELHI_REFERENCE.lng,
    tz_str: NEW_DELHI_REFERENCE.tz_str,
    ayanamsha: 'krishnamurti',
    house_system: 'placidus',
    node_type: 'mean',
    reference_date: refDateISO,
    dasha_levels: 3,
    ruling_datetime: `${refDateISO}T12:00:00+05:30`,
  });

  // D. Yoga Detection V2
  const yogasRes = await runStep('D_yoga_detect_v2', '/api/v2/vedic/yogas', baseBody);

  // E. Divisional Charts (all 17 documented)
  const vargasRes = await runStep('E_divisional_charts_v2', '/api/v2/vedic/vargas', {
    ...baseBody,
    divisions: [...ALL_SUPPORTED_VARGAS],
  });

  // F. Western Natal + Timing + Gochar Timeline gating check
  const westernNatalRes = await runStep('F1_western_natal_v1', '/api/v1/natal/calculate', {
    name: NEW_DELHI_REFERENCE.name,
    year: NEW_DELHI_REFERENCE.year,
    month: NEW_DELHI_REFERENCE.month,
    day: NEW_DELHI_REFERENCE.day,
    hour: NEW_DELHI_REFERENCE.hour,
    minute: NEW_DELHI_REFERENCE.minute,
    time_known: true,
    city: NEW_DELHI_REFERENCE.city,
    lat: NEW_DELHI_REFERENCE.lat,
    lng: NEW_DELHI_REFERENCE.lng,
    tz_str: NEW_DELHI_REFERENCE.tz_str,
    house_system: 'placidus',
    zodiac_type: 'tropical',
    include_dominants: true,
    dominants_method: 'traditional',
  });

  const profectionsRes = await runStep(
    'F2_western_profections_v1',
    '/api/v1/western/profections/annual?include=monthly_profections,natal_time_lord_details,activated_house_planets',
    {
      name: NEW_DELHI_REFERENCE.name,
      year: NEW_DELHI_REFERENCE.year,
      month: NEW_DELHI_REFERENCE.month,
      day: NEW_DELHI_REFERENCE.day,
      hour: NEW_DELHI_REFERENCE.hour,
      minute: NEW_DELHI_REFERENCE.minute,
      time_known: true,
      city: NEW_DELHI_REFERENCE.city,
      lat: NEW_DELHI_REFERENCE.lat,
      lng: NEW_DELHI_REFERENCE.lng,
      tz_str: NEW_DELHI_REFERENCE.tz_str,
      annual_profection: { year: new Date().getUTCFullYear() },
    }
  );

  const progressionsRes = await runStep(
    'F3_western_secondary_progressions_v1',
    '/api/v1/western/progressions/secondary?response_mode=full&include=natal_reference,movements,highlights',
    {
      natal: {
        name: NEW_DELHI_REFERENCE.name,
        datetime: `${NEW_DELHI_REFERENCE.birthDateISO} 18:45`,
        time_known: true,
        location: {
          city: NEW_DELHI_REFERENCE.city,
          lat: NEW_DELHI_REFERENCE.lat,
          lng: NEW_DELHI_REFERENCE.lng,
          tz_str: NEW_DELHI_REFERENCE.tz_str,
        },
      },
      secondary_progression: { target_date: refDateISO },
    }
  );

  const solarReturnRes = await runStep(
    'F4_western_solar_return_v1',
    '/api/v1/western/solar/calculate',
    {
      natal: {
        name: NEW_DELHI_REFERENCE.name,
        year: NEW_DELHI_REFERENCE.year,
        month: NEW_DELHI_REFERENCE.month,
        day: NEW_DELHI_REFERENCE.day,
        hour: NEW_DELHI_REFERENCE.hour,
        minute: NEW_DELHI_REFERENCE.minute,
        time_known: true,
        location: {
          city: NEW_DELHI_REFERENCE.city,
          lat: NEW_DELHI_REFERENCE.lat,
          lng: NEW_DELHI_REFERENCE.lng,
          timezone: NEW_DELHI_REFERENCE.tz_str,
        },
      },
      solar_return: {
        year: new Date().getUTCFullYear(),
        location: {
          city: NEW_DELHI_REFERENCE.city,
          lat: NEW_DELHI_REFERENCE.lat,
          lng: NEW_DELHI_REFERENCE.lng,
          timezone: NEW_DELHI_REFERENCE.tz_str,
        },
      },
    }
  );

  const gocharRes = await runStep('F5_vedic_gochar_timeline_v2', '/api/v2/vedic/gochar/timeline', {
    ...baseBody,
    range_start: refDateISO,
    range_end: refDateISO,
    transit_hour: 12,
    transit_minute: 0,
    transit_tz_str: 'Asia/Kolkata',
    transit_planets: ['saturn', 'jupiter', 'rahu', 'ketu'],
    include_dasha_overlay: false,
  });

  // ---------------- Numerical Analysis & Discrepancy Audit ----------------
  const calcData = (
    calcRes.data && typeof calcRes.data === 'object' ? calcRes.data : {}
  ) as Record<string, unknown>;
  const strengthData = (
    strengthRes.data && typeof strengthRes.data === 'object' ? strengthRes.data : {}
  ) as Record<string, unknown>;
  const kpData = (kpRes.data && typeof kpRes.data === 'object' ? kpRes.data : {}) as Record<
    string,
    unknown
  >;
  const yogasData = (
    yogasRes.data && typeof yogasRes.data === 'object' ? yogasRes.data : {}
  ) as Record<string, unknown>;
  const vargasData = (
    vargasRes.data && typeof vargasRes.data === 'object' ? vargasRes.data : {}
  ) as Record<string, unknown>;

  const chartObj = (calcData.chart ?? {}) as Record<string, unknown>;
  const ascDegRaw = (chartObj.ascendant as Record<string, unknown> | undefined)?.degree;
  const ascDeg = typeof ascDegRaw === 'number' ? ascDegRaw : Number(ascDegRaw ?? 0);
  const planetsRaw = Array.isArray(chartObj.planets)
    ? (chartObj.planets as Array<Record<string, unknown>>)
    : [];

  const kpCuspsRaw = Array.isArray(kpData.cusps)
    ? (kpData.cusps as Array<Record<string, unknown>>)
    : Array.isArray(kpData.cuspal_sub_lord_table)
    ? (kpData.cuspal_sub_lord_table as Array<Record<string, unknown>>)
    : [];
  const kpPlanetsRaw = Array.isArray(kpData.planets)
    ? (kpData.planets as Array<Record<string, unknown>>)
    : [];
  const kpAscRaw =
    (kpData.ascendant as Record<string, unknown> | undefined)?.degree ??
    kpCuspsRaw.find((c) => Number(c.house) === 1)?.degree;
  const kpAscDeg = kpAscRaw !== undefined && kpAscRaw !== null ? Number(kpAscRaw) : null;

  const jd = toJulianDay(
    NEW_DELHI_REFERENCE.year,
    NEW_DELHI_REFERENCE.month,
    NEW_DELHI_REFERENCE.day,
    NEW_DELHI_REFERENCE.hour + NEW_DELHI_REFERENCE.minute / 60 - NEW_DELHI_REFERENCE.tzOffsetHours
  );
  const expectedLahiri = Number(getLahiriAyanamsaApprox(jd).toFixed(4));
  const expectedKp = Number(getKPAyanamsaApprox(jd).toFixed(4));

  const planetLongitudesComparison = planetsRaw.map((p) => {
    const name = String(p.name || '');
    const lahiriLon = Number(Number(p.absolute_degree ?? 0).toFixed(4));
    const kpMatch = kpPlanetsRaw.find(
      (kpP) => String(kpP.name || '').toLowerCase() === name.toLowerCase()
    );
    const kpLon =
      kpMatch && kpMatch.absolute_degree !== undefined
        ? Number(Number(kpMatch.absolute_degree).toFixed(4))
        : null;
    return {
      planet: name,
      lahiriLon,
      lahiriSign: String(p.sign || ''),
      degInSign: Number(Number(p.degree_in_sign ?? 0).toFixed(4)),
      retrograde: Boolean(p.is_retrograde),
      kpLon,
      observedKpMinusLahiriDeg:
        kpLon !== null ? Number(circularDiffDeg(kpLon, lahiriLon).toFixed(4)) : null,
    };
  });

  const localPlanets =
    planetsRaw.length > 0 ? buildLocalReferenceFromApiLongitudes(planetsRaw, ascDeg) : [];
  const localVargas = localPlanets.length > 0 ? computeDivisionalCharts(localPlanets) : {};
  const localShadbala =
    localPlanets.length > 0
      ? computeShadbala(
          localPlanets,
          NEW_DELHI_REFERENCE.birthDateISO,
          NEW_DELHI_REFERENCE.birthTimeStr
        )
      : null;
  const localAshtakavarga = localPlanets.length > 0 ? computeAshtakavarga(localPlanets) : null;
  const localConditions =
    localPlanets.length > 0 ? computePlanetaryConditions(localPlanets, localVargas) : [];
  const localYogas = localPlanets.length > 0 ? computeMajorYogas(localPlanets) : [];
  const localKpCusps = computeKPPlacidusCusps(
    NEW_DELHI_REFERENCE.birthDateISO,
    NEW_DELHI_REFERENCE.birthTimeStr,
    NEW_DELHI_REFERENCE.tzOffsetHours,
    NEW_DELHI_REFERENCE.lat,
    NEW_DELHI_REFERENCE.lng,
    ascDeg
  );
  const localKpSigs =
    localPlanets.length > 0 ? computeKPSignificators(localPlanets, localKpCusps) : [];

  const apiShadbalaMap = (strengthData.shadbala ?? calcData.shadbala ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const shadbalaComparison = (localShadbala?.planets || []).map((loc) => {
    const api = apiShadbalaMap?.[loc.planet];
    return {
      planet: loc.planet,
      api: api || null,
      localEngine: {
        sthana: loc.sthanaBala,
        dig: loc.digBala,
        kala: loc.kalaBala,
        chesta: loc.chestaBala,
        naisargika: loc.naisargikaBala,
        drik: loc.drikBala,
        totalVirupas: loc.totalVirupas,
        totalRupas: loc.totalRupas,
        ratio: loc.ratio,
      },
      deltaVirupas: api ? Number((Number(api.total) - loc.totalVirupas).toFixed(2)) : null,
      deltaRupas: api
        ? Number((Number(api.shadbala_in_rupas) - loc.totalRupas).toFixed(2))
        : null,
    };
  });

  const digBalaAudit =
    planetsRaw.length > 0 && Object.keys(apiShadbalaMap).length > 0
      ? auditDigBalaMethodology(apiShadbalaMap, planetsRaw, ascDeg, kpCuspsRaw)
      : [];

  const ashtakavargaAudit = auditAshtakavarga(strengthData);

  const avasthaAudit = planetsRaw.map((p) => {
    const name = String(p.name || '');
    const signId = Number(p.sign_id || 1);
    const degInSign = Number(p.degree_in_sign || 0);
    const isOddSign = signId % 2 === 1;
    const expectedSlice = Math.min(4, Math.floor(degInSign / 6));
    const oddOrder = ['Bala', 'Kumara', 'Yuva', 'Vriddha', 'Mrita'];
    const expectedBaladi = isOddSign
      ? oddOrder[expectedSlice]
      : [...oddOrder].reverse()[expectedSlice];
    const localCond = localConditions.find((c) => c.planet === name);
    return {
      planet: name,
      sign: p.sign,
      degreeInSign: degInSign,
      apiAvastha: p.avastha ?? p.baladi_avastha ?? null,
      classicalBaladiExpected: expectedBaladi,
      localBaladi: localCond?.baladiAvastha ?? null,
    };
  });

  const ashtakavargaSavApi = (strengthData.ashtakavarga as Record<string, unknown> | undefined)
    ?.sarvashtakavarga as number[] | undefined;
  const ashtakavargaSavDelta =
    ashtakavargaSavApi && localAshtakavarga
      ? ashtakavargaSavApi.map((val, idx) => ({
          sign: SIGNS[idx],
          apiSav: val,
          localSav: localAshtakavarga.sarva[idx],
          diff: val - localAshtakavarga.sarva[idx],
        }))
      : null;

  const kpSigsArray = Array.isArray(kpData.planet_significators)
    ? (kpData.planet_significators as Array<Record<string, unknown>>)
    : [];
  const kpRahuKetuInspect = kpSigsArray.filter((item) => {
    const n = String(item.planet || item.name || '').toLowerCase();
    return n === 'rahu' || n === 'ketu';
  });

  const yogasArray = Array.isArray(yogasData.yogas)
    ? (yogasData.yogas as Array<Record<string, unknown>>)
    : [];
  const yogasActive = yogasArray.filter((y) => y.active === true);

  const firstApiShadbala = Object.values(apiShadbalaMap)[0] as Record<string, unknown> | undefined;
  const missingRequirementsChecklist = {
    shadbalaSubcomponentsPresent: Boolean(
      firstApiShadbala?.sthana_subcomponents || firstApiShadbala?.kala_subcomponents
    ),
    ishtaKashtaPhalaPresent: Boolean(
      firstApiShadbala?.ishta_phala ||
        firstApiShadbala?.kashta_phala ||
        strengthData.ishta_kashta_phala
    ),
    bhavabalaPresent: Boolean(strengthData.bhavabala || calcData.bhavabala),
    vimshopakaBalaPresent: Boolean(
      strengthData.vimshopaka_bala || strengthData.vimshopaka || calcData.vimshopaka_bala
    ),
    jaiminiPresent: Boolean(calcData.jaimini || strengthData.jaimini),
  };

  return {
    generatedAt: new Date().toISOString(),
    referenceProfile: NEW_DELHI_REFERENCE,
    performanceSummary: {
      totalCalls: calls.length,
      successfulCalls: calls.filter((c) => c.ok).length,
      failedCalls: calls.filter((c) => !c.ok).length,
      totalLatencyMs: calls.reduce((acc, c) => acc + c.latencyMs, 0),
      totalPayloadBytes: calls.reduce((acc, c) => acc + c.payloadBytes, 0),
    },
    quotaAndPerformance: calls.map((c) => ({
      id: c.id,
      endpoint: c.endpoint,
      status: c.status,
      ok: c.ok,
      latencyMs: c.latencyMs,
      payloadBytes: c.payloadBytes,
      headers: c.headers,
    })),
    audits: {
      strengthMetadata: strengthData.metadata ?? null,
      calculateMetadata: calcData.metadata ?? null,
      astronomicalReferenceCheck: {
        julianDay: Number(jd.toFixed(6)),
        expectedLahiriAyanamshaApprox: expectedLahiri,
        expectedKpAyanamshaApprox: expectedKp,
        expectedKpMinusLahiriDeg: Number((expectedKp - expectedLahiri).toFixed(4)),
        apiLahiriAscendantDeg: ascDegRaw !== undefined ? Number(ascDeg.toFixed(4)) : null,
        apiKpAscendantDeg: kpAscDeg !== null ? Number(kpAscDeg.toFixed(4)) : null,
        observedAscKpMinusLahiriDeg:
          ascDegRaw !== undefined && kpAscDeg !== null
            ? Number(circularDiffDeg(kpAscDeg, ascDeg).toFixed(4))
            : null,
        planetLongitudesComparison,
      },
      shadbalaComparison,
      digBalaMethodologyAudit: digBalaAudit,
      ashtakavargaAudit,
      ashtakavargaSavComparison: ashtakavargaSavDelta,
      avasthaAudit,
      kpCuspsCount: kpCuspsRaw.length,
      kpPlanetSignificators: kpData.planet_significators ?? null,
      kpRahuKetuInspect,
      localKpSignificatorsRef: localKpSigs,
      yogasCount: yogasArray.length,
      yogasActiveCount: yogasActive.length,
      localMajorYogasCount: localYogas.length,
      yogasSampleNames: yogasActive
        .slice(0, 15)
        .map((y) => String(y.name || y.title || 'unnamed')),
      vargasReturnedFromVargasEndpoint: vargasData.vargas
        ? Object.keys(vargasData.vargas as object)
        : [],
      vargasReturnedFromCalculateEndpoint:
        calcData.vargas && typeof calcData.vargas === 'object' && 'vargas' in calcData.vargas
          ? Object.keys((calcData.vargas as { vargas: object }).vargas)
          : [],
      westernSummary: {
        natalStatus: westernNatalRes.status,
        profectionsStatus: profectionsRes.status,
        progressionsStatus: progressionsRes.status,
        solarReturnStatus: solarReturnRes.status,
      },
      gocharTimelineStatus: gocharRes.status,
      missingRequirementsChecklist,
    },
    rawResponses: Object.fromEntries(calls.map((c) => [c.id, c.data])),
  };
}
