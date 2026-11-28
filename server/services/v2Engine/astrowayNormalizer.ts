/**
 * Isolated V2 Engine — AstroWay Phase 2 Deep Dataset Normalizer
 *
 * Pure TypeScript (Cloudflare Workers compatible — zero Node built-ins).
 * Normalizes AstroWay's comprehensive classical & Western/Hellenistic datasets:
 * - 5-level Vimshottari Dasha hierarchy (Mahadasha -> Antardasha -> Pratyantardasha -> Sookshma -> Prana)
 * - Alternative Dasha timelines (Chara, Yogini, Ashtottari, Kalachakra, Tribhagi) with natal vs reference-date separation
 * - Shadbala 6 subcomponents (Sthana, Dig, Kala, Cheshta, Naisargika, Drik) per planet
 * - Ishta Phala & Kashta Phala + Bhavabala (strict zero-coercion on empty arrays)
 * - Ashtakavarga Shodhana (Trikona, Ekadhipati, Rasi/Graha/Shodhya Pinda)
 * - Jaimini Suite (Karakas, Chara Karakas, Padas, Upapada, Argala, Aspects, Drishti, AK Navamsa)
 * - Panchang & Planetary Conditions (without fabricating unverified local calculations)
 */

const VIMSHOTTARI_FULL_YEARS: Record<string, number> = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};

const LEVEL_NAMES = [
  'mahadasha',
  'antardasha',
  'pratyantardasha',
  'sookshma',
  'prana',
] as const;

const SUB_PERIOD_KEYS = [
  'subPeriods',
  'subDashas',
  'subdashas',
  'sub_dashas',
  'sub_periods',
  'antardashas',
  'antardasha',
  'bhuktis',
  'bhukti',
  'pratyantardashas',
  'pratyantardasha',
  'pratyantars',
  'pratyantar',
  'sookshmadashas',
  'sookshmas',
  'sookshma',
  'sukshmadashas',
  'sukshmas',
  'sukshma',
  'pranadashas',
  'pranas',
  'prana',
  'paryantardashas',
  'paryantardasha',
  'antaras',
  'antara',
  'nested',
  'children',
  'periods',
  'items',
  'levels',
] as const;

const SINGLE_CHILD_OBJECT_KEYS = [
  'antardasha',
  'bhukti',
  'pratyantardasha',
  'pratyantar',
  'sookshma',
  'sukshma',
  'prana',
  'subPeriod',
  'subDasha',
] as const;

function asObj(val: unknown): Record<string, unknown> | null {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : null;
}

function asObjArr(val: unknown): Array<Record<string, unknown>> {
  return Array.isArray(val)
    ? (val.filter((x) => x && typeof x === 'object' && !Array.isArray(x)) as Array<Record<string, unknown>>)
    : [];
}

function normalizeNameFallback(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const low = s.toLowerCase().replace(/[_-]+/g, ' ');
  if (low === 'sun' || low === 'surya') return 'Sun';
  if (low === 'moon' || low === 'chandra') return 'Moon';
  if (low === 'mars' || low === 'mangala' || low === 'kuja') return 'Mars';
  if (low === 'mercury' || low === 'budha') return 'Mercury';
  if (low === 'jupiter' || low === 'guru' || low === 'brihaspati') return 'Jupiter';
  if (low === 'venus' || low === 'shukra') return 'Venus';
  if (low === 'saturn' || low === 'shani') return 'Saturn';
  if (low.includes('rahu') || low.includes('north node') || low === 'mean node' || low === 'true node') {
    return 'Rahu';
  }
  if (low.includes('ketu') || low.includes('south node')) return 'Ketu';
  return s;
}

export interface NormalizedDashaPeriodNode {
  level: number;
  levelName: string;
  lord: string;
  start_date: string | null;
  end_date: string | null;
  duration_years: number | null;
  subPeriods: NormalizedDashaPeriodNode[];
  [extraKey: string]: unknown;
}

function computeFractionalYearsFromYmd(params: {
  years: unknown;
  months?: unknown;
  days?: unknown;
}): number | null {
  const yRaw = params.years !== undefined && params.years !== null && params.years !== '' ? Number(params.years) : Number.NaN;
  const mRaw = params.months !== undefined && params.months !== null && params.months !== '' ? Number(params.months) : Number.NaN;
  const dRaw = params.days !== undefined && params.days !== null && params.days !== '' ? Number(params.days) : Number.NaN;

  const hasY = Number.isFinite(yRaw);
  const hasM = Number.isFinite(mRaw);
  const hasD = Number.isFinite(dRaw);

  if (hasY) {
    const isAlreadyFractional = Math.abs(yRaw - Math.trunc(yRaw)) >= 1e-4;
    const hasMonthsOrDays = (hasM && mRaw !== 0) || (hasD && dRaw !== 0);
    if (!isAlreadyFractional && hasMonthsOrDays) {
      const mFrac = hasM ? mRaw / 12 : 0;
      const dFrac = hasD ? dRaw / 365.2425 : 0;
      return Number((yRaw + mFrac + dFrac).toFixed(4));
    }
    return Number(yRaw.toFixed(4));
  }

  if (hasM || hasD) {
    const mFrac = hasM ? mRaw / 12 : 0;
    const dFrac = hasD ? dRaw / 365.2425 : 0;
    return Number((mFrac + dFrac).toFixed(4));
  }

  return null;
}

function normalizeDashaTree(
  rawPeriods: Array<Record<string, unknown>>,
  depth: number,
  planetNormalizer: (raw: unknown) => string
): { nodes: NormalizedDashaPeriodNode[]; maxDepth: number } {
  if (!rawPeriods.length || depth > 5) {
    return { nodes: [], maxDepth: depth - 1 };
  }

  let deepest = depth;
  const nodes: NormalizedDashaPeriodNode[] = rawPeriods.map((raw) => {
    let rawSubs: Array<Record<string, unknown>> = [];
    for (const k of SUB_PERIOD_KEYS) {
      if (Array.isArray(raw[k]) && (raw[k] as unknown[]).length > 0) {
        rawSubs = asObjArr(raw[k]);
        if (rawSubs.length > 0) break;
      }
    }
    if (rawSubs.length === 0) {
      for (const k of SINGLE_CHILD_OBJECT_KEYS) {
        const single = asObj(raw[k]);
        if (single) {
          rawSubs = [single];
          break;
        }
      }
    }

    const childRes = rawSubs.length > 0 ? normalizeDashaTree(rawSubs, depth + 1, planetNormalizer) : null;
    if (childRes && childRes.maxDepth > deepest) {
      deepest = childRes.maxDepth;
    }

    const startRaw = raw.startDate ?? raw.start_date;
    const endRaw = raw.endDate ?? raw.end_date;
    const startStr = typeof startRaw === 'string' && startRaw.trim() ? startRaw : null;
    const endStr = typeof endRaw === 'string' && endRaw.trim() ? endRaw : null;

    let durRaw = Number(raw.durationYears ?? raw.duration_years ?? Number.NaN);
    if (!Number.isFinite(durRaw) && startStr && endStr) {
      const sMs = Date.parse(startStr);
      const eMs = Date.parse(endStr);
      if (Number.isFinite(sMs) && Number.isFinite(eMs) && eMs >= sMs) {
        durRaw = Number(((eMs - sMs) / (365.2425 * 86400 * 1000)).toFixed(6));
      }
    }

    return {
      ...raw,
      level: depth,
      levelName: LEVEL_NAMES[depth - 1] ?? `level_${depth}`,
      lord: planetNormalizer(raw.planetName ?? raw.planet ?? raw.lord ?? raw.signName ?? raw.sign),
      start_date: startStr,
      end_date: endStr,
      duration_years: Number.isFinite(durRaw) ? durRaw : null,
      subPeriods: childRes ? childRes.nodes : [],
    };
  });

  return { nodes, maxDepth: deepest };
}

export function normalizeAstroWayVimshottari5Level(
  raw: Record<string, unknown> | null,
  planetNormalizer: (raw: unknown) => string = normalizeNameFallback
): Record<string, unknown> | null {
  if (!raw) return null;
  const init = asObj(raw.initial) || {};
  const lord = planetNormalizer(init.initialPlanetName ?? init.initialPlanet ?? init.lord);
  const canonicalFullY = VIMSHOTTARI_FULL_YEARS[lord];

  const remYFractional = computeFractionalYearsFromYmd({
    years: init.balanceYears ?? init.remainingYears ?? init.remaining_years,
    months: init.balanceMonths ?? init.remainingMonths,
    days: init.balanceDays ?? init.remainingDays,
  });
  let elYFractional = computeFractionalYearsFromYmd({
    years: init.elapsedYears ?? init.elapsed_years,
    months: init.elapsedMonths,
    days: init.elapsedDays,
  });

  const fullDurationYears =
    canonicalFullY ??
    (remYFractional !== null && elYFractional !== null
      ? Number((remYFractional + elYFractional).toFixed(4))
      : null);

  if (elYFractional === null && fullDurationYears !== null && remYFractional !== null) {
    elYFractional = Number(Math.max(0, fullDurationYears - remYFractional).toFixed(4));
  }

  const rawPeriods = asObjArr(raw.periods ?? raw.mahadashas);
  const tree = normalizeDashaTree(rawPeriods, 1, planetNormalizer);
  const maxDepthObserved = rawPeriods.length > 0 ? tree.maxDepth : 0;
  const levelsObserved = LEVEL_NAMES.slice(0, Math.min(5, maxDepthObserved));

  const birthBalance = {
    lord,
    remaining_years: remYFractional,
    elapsed_years: elYFractional,
    full_duration_years: fullDurationYears,
    balanceYearsRaw:
      init.balanceYears !== undefined && init.balanceYears !== null && Number.isFinite(Number(init.balanceYears))
        ? Number(init.balanceYears)
        : null,
    balanceMonths:
      init.balanceMonths !== undefined && init.balanceMonths !== null && Number.isFinite(Number(init.balanceMonths))
        ? Number(init.balanceMonths)
        : init.balanceMonths ?? null,
    balanceDays:
      init.balanceDays !== undefined && init.balanceDays !== null && Number.isFinite(Number(init.balanceDays))
        ? Number(init.balanceDays)
        : init.balanceDays ?? null,
  };

  const referenceDateSnapshot = asObj(raw.current) ?? asObj(raw.active) ?? null;

  return {
    ...raw,
    birth_balance: birthBalance,
    maxDepthObserved,
    levelsObserved,
    mahadashas: tree.nodes,
    natalTimeline: {
      temporalScope: 'natal_invariant',
      birth_balance: birthBalance,
      maxDepthObserved,
      levelsObserved,
      mahadashas: tree.nodes,
    },
    referenceDateActive: referenceDateSnapshot,
    referenceDateSnapshot,
  };
}

export function normalizeAstroWayAlternativeDasha(
  systemName: string,
  raw: Record<string, unknown> | null,
  planetNormalizer: (raw: unknown) => string = normalizeNameFallback
): Record<string, unknown> | null {
  if (!raw) return null;
  const rawPeriods = asObjArr(raw.periods ?? raw.mahadashas ?? raw.cycles ?? raw.items);
  const tree = normalizeDashaTree(rawPeriods, 1, planetNormalizer);
  const current = asObj(raw.current) ?? asObj(raw.active) ?? null;

  return {
    ...raw,
    system: systemName,
    natalTimeline: {
      initial: asObj(raw.initial) ?? null,
      periods: tree.nodes,
      maxDepthObserved: rawPeriods.length > 0 ? tree.maxDepth : 0,
    },
    referenceDateActive: current,
  };
}

export function normalizeAstroWayShadbalaSubcomponents(
  buckets: {
    sthana: Record<string, unknown> | null;
    dig: Record<string, unknown> | null;
    kala: Record<string, unknown> | null;
    cheshta: Record<string, unknown> | null;
    naisargika: Record<string, unknown> | null;
    drik: Record<string, unknown> | null;
  },
  planetNormalizer: (raw: unknown) => string = normalizeNameFallback
): {
  populatedBuckets: string[];
  emptyBuckets: string[];
  byPlanet: Record<string, Record<string, Record<string, unknown>>>;
} {
  const byPlanet: Record<string, Record<string, Record<string, unknown>>> = {};
  const populatedBuckets: string[] = [];
  const emptyBuckets: string[] = [];

  for (const [bucketName, rawBucket] of Object.entries(buckets)) {
    const rows = rawBucket ? asObjArr(rawBucket.items ?? rawBucket.planets) : [];
    if (rows.length === 0) {
      emptyBuckets.push(bucketName);
      continue;
    }
    populatedBuckets.push(bucketName);
    for (const row of rows) {
      const planet = planetNormalizer(row.planetName ?? row.planet ?? row.grahaName ?? row.name);
      if (!planet) continue;
      if (!byPlanet[planet]) byPlanet[planet] = {};
      byPlanet[planet][bucketName] = { ...row, planet };
    }
  }

  return {
    populatedBuckets,
    emptyBuckets,
    byPlanet,
  };
}

export function normalizeAstroWayIshtaKashta(
  raw: Record<string, unknown> | null,
  planetNormalizer: (raw: unknown) => string = normalizeNameFallback
): Record<string, unknown> | null {
  if (!raw) return null;
  const rows = asObjArr(raw.items ?? raw.planets);
  if (rows.length === 0) return null;

  const byPlanet: Record<string, Record<string, unknown>> = {};
  const items = rows.map((r) => {
    const planet = planetNormalizer(r.planetName ?? r.planet ?? r.name);
    const ishtaRaw = Number(r.ishta ?? r.ishtaPhala ?? r.bphsIshta ?? Number.NaN);
    const kashtaRaw = Number(r.kashta ?? r.kashtaPhala ?? r.bphsKashta ?? Number.NaN);
    const entry = {
      ...r,
      planet,
      ishta: Number.isFinite(ishtaRaw) ? ishtaRaw : null,
      kashta: Number.isFinite(kashtaRaw) ? kashtaRaw : null,
      netIshtaMinusKashta:
        Number.isFinite(ishtaRaw) && Number.isFinite(kashtaRaw)
          ? Number((ishtaRaw - kashtaRaw).toFixed(4))
          : null,
    };
    if (planet) byPlanet[planet] = entry;
    return entry;
  });

  return {
    ...raw,
    items,
    byPlanet,
  };
}

export function normalizeAstroWayBhavabala(
  raw: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!raw) return null;
  const rows = asObjArr(raw.houses ?? raw.items);
  if (rows.length === 0) return null;

  const houses = rows.map((h, idx) => {
    const houseNum = Number(h.house ?? h.houseNumber ?? h.bhava ?? idx + 1);
    const totalVirupa = Number(h.totalVirupa ?? h.total ?? h.totalBala ?? Number.NaN);
    const totalRupa = Number(
      h.totalRupa ?? h.rupa ?? (Number.isFinite(totalVirupa) ? totalVirupa / 60 : Number.NaN)
    );
    return {
      ...h,
      house: Number.isInteger(houseNum) ? houseNum : idx + 1,
      totalVirupa: Number.isFinite(totalVirupa) ? totalVirupa : null,
      totalRupa: Number.isFinite(totalRupa) ? Number(totalRupa.toFixed(4)) : null,
    };
  });

  return {
    ...raw,
    houses,
  };
}

export function normalizeAstroWayJaiminiSuite(rawBuckets: {
  karakas: Record<string, unknown> | null;
  charaKarakas: Record<string, unknown> | null;
  padas: Record<string, unknown> | null;
  upapada: Record<string, unknown> | null;
  aspects: Record<string, unknown> | null;
  drishtiRasi: Record<string, unknown> | null;
  drishtiGraha: Record<string, unknown> | null;
  atmakarakaNavamsa: Record<string, unknown> | null;
  argalaAnalysis: Record<string, unknown> | null;
  yogas: Record<string, unknown> | null;
}): Record<string, unknown> {
  const populatedKeys = Object.entries(rawBuckets)
    .filter(([, v]) => v !== null && Object.keys(v).length > 0)
    .map(([k]) => k);

  return {
    ...rawBuckets,
    populatedBucketsCount: populatedKeys.length,
    populatedBuckets: populatedKeys,
  };
}

export function normalizeAstroWayAshtakavargaShodhana(
  raw: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!raw || Object.keys(raw).length === 0) return null;
  const hasNonEmptyArrayOrObj = (val: unknown): boolean => {
    if (Array.isArray(val)) return val.length > 0;
    if (val && typeof val === 'object') return Object.keys(val as Record<string, unknown>).length > 0;
    return val !== undefined && val !== null;
  };
  const hasPlanets = asObjArr(raw.planets ?? raw.items).length > 0;
  const hasTrikona =
    hasNonEmptyArrayOrObj(raw.trikona) || hasNonEmptyArrayOrObj(raw.trikonaShodhana) || hasPlanets;
  const hasEkadhipatya =
    hasNonEmptyArrayOrObj(raw.ekadhipatya) || hasNonEmptyArrayOrObj(raw.ekadhipati) || hasPlanets;
  const hasPinda =
    hasNonEmptyArrayOrObj(raw.pinda) ||
    hasNonEmptyArrayOrObj(raw.shodhyaPinda) ||
    hasNonEmptyArrayOrObj(raw.rasiPinda) ||
    hasPlanets;
  if (!hasTrikona && !hasEkadhipatya && !hasPinda) {
    return null;
  }
  return {
    ...raw,
    hasTrikona,
    hasEkadhipatya,
    hasPinda,
  };
}

export function extractAstroWayPlanetaryConditions(
  vedicPlanets: Array<Record<string, unknown>>,
  westernEssentialDignities: Record<string, unknown> | null
): Record<string, unknown> {
  const byPlanet: Record<string, Record<string, unknown>> = {};
  let hasAnyVedicCondition = false;

  for (const p of vedicPlanets) {
    const name = String(p.name ?? '').trim();
    if (!name) continue;
    const dignity = p.dignity ?? p.dignity_status ?? null;
    const avastha = p.avastha ?? null;
    const isCombust = typeof p.is_combust === 'boolean' ? p.is_combust : null;
    const isRetrograde = typeof p.is_retrograde === 'boolean' ? p.is_retrograde : null;
    if (dignity !== null || avastha !== null || isCombust !== null) {
      hasAnyVedicCondition = true;
    }
    byPlanet[name] = {
      name,
      dignity,
      avastha,
      is_combust: isCombust,
      is_retrograde: isRetrograde,
      speed_deg_per_day: p.speed_deg_per_day ?? null,
    };
  }

  return {
    byPlanet,
    hasAnyVedicCondition,
    hasWesternEssentialDignities:
      westernEssentialDignities !== null && Object.keys(westernEssentialDignities).length > 0,
    westernEssentialDignities: westernEssentialDignities ?? null,
  };
}

export function normalizeAstroWayPanchang(
  raw: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!raw || Object.keys(raw).length === 0) return null;
  return {
    ...raw,
    evaluationMode: raw.at ?? 'moment',
    tithi: raw.tithi ?? null,
    vara: raw.vara ?? null,
    nakshatra: raw.nakshatra ?? null,
    yoga: raw.yoga ?? null,
    karana: raw.karana ?? null,
    sunrise: raw.sunrise ?? null,
    sunset: raw.sunset ?? null,
  };
}
