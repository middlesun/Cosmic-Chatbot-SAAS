/**
 * Isolated V2 Engine — Layer B Master Chart Record Normalizer & Layer C Shell
 *
 * Enforces:
 * - Strict 4-frame separation (Vedic Lahiri, KP Placidus, Bhava Chalit, Western Tropical)
 * - ZERO partial H1/H7 overwrites
 * - ZERO Western-from-KP reconstructions
 * - Complete preservation of all returned provider fields (never pruning unused UI fields)
 * - Explicit provenance & verification metadata on every dataset envelope
 * - Strict No-Silent-Fallback resolution order:
 *     1. Cached verified dataset matching exact inputFingerprint + conventions
 *     2. Independently verified equivalent calculation (explicitly tagged)
 *     3. Explicit 'partial' or 'unavailable' dataset status
 */

import { normalizeDeg, SIGNS } from '../jyotishMath';
import { buildShadbalaReconciliationReport } from './shadbalaReconciliation';
import {
  buildPlanetPositionsFromVedicFrame,
  computeIndependentAstronomicalReference,
  verifyBhavaChalitMethodology,
} from './verifier';
import type {
  AstronomicalTelemetryFrame,
  BhavaChalitFrame,
  CanonicalBirthInstant,
  DatasetEnvelope,
  KpPlacidusFrame,
  LayerARawProviderRecord,
  LayerBMasterChartRecord,
  LayerCAnalyticalShell,
  RemainingClassicalGapItem,
  SanitizedProviderCallRecord,
  VedicLahiriFrame,
  WesternTropicalFrame,
} from './types';

export const V2_MASTER_SCHEMA_VERSION = 'v2.master.1.0';

export const REMAINING_CLASSICAL_GAPS_INVENTORY: RemainingClassicalGapItem[] = [
  {
    capability: 'Detailed Shadbala Subcomponents (Uchcha, Saptavargaja, Ojayugma, Kendradi, Drekkana, Natonnata, Paksha, Tribhaga, Abda/Masa/Vara/Hora, Ayana, Yuddha)',
    category: 'Planetary Strength',
    freeAstroApiStatus: 'unavailable',
    localDerivedStatus: 'approximation_only',
    candidateProviders: ['AstroWay', 'Astrology-API.io'],
    notes: 'FreeAstroAPI returns the 6 major Bala sums only. AstroWay/PyJHora/JHora expose full subcomponent breakdown.',
  },
  {
    capability: 'Ishta Phala & Kashta Phala',
    category: 'Planetary Strength',
    freeAstroApiStatus: 'unavailable',
    localDerivedStatus: 'verified_deterministic',
    candidateProviders: ['AstroWay'],
    notes: 'Absent from FreeAstroAPI OpenAPI spec; derivable deterministically from exact Uchcha & Cheshta Bala.',
  },
  {
    capability: 'Bhavabala (Bhava Digbala, Bhava Adhipati, Bhava Drishti)',
    category: 'House Strength',
    freeAstroApiStatus: 'unavailable',
    localDerivedStatus: 'unavailable',
    candidateProviders: ['AstroWay', 'Astrology-API.io'],
    notes: 'Not provided by FreeAstroAPI. Candidate for AstroWay evaluation or exact BPHS implementation.',
  },
  {
    capability: 'Vimshopaka Bala (Shadvarga, Saptavarga, Dashavarga, Shodashavarga)',
    category: 'Varga Strength',
    freeAstroApiStatus: 'unavailable',
    localDerivedStatus: 'unavailable',
    candidateProviders: ['AstroWay'],
    notes: 'Not provided by FreeAstroAPI; derivable deterministically once all 16 Vargas and Panchadha Maitri are verified.',
  },
  {
    capability: 'Panchadha Maitri (Five-fold Compound Friendship)',
    category: 'Planetary Dignity',
    freeAstroApiStatus: 'unavailable',
    localDerivedStatus: 'unavailable',
    candidateProviders: ['AstroWay', 'Astrology-API.io'],
    notes: 'Legacy computeShadbala uses natural friendship only; full BPHS compound friendship should be implemented or verified.',
  },
  {
    capability: 'Jaimini System (Chara Karakas, Arudha Padas, Chara Dasha, Argala, Karakamsha)',
    category: 'Jaimini Jyotish',
    freeAstroApiStatus: 'unavailable',
    localDerivedStatus: 'verified_deterministic',
    candidateProviders: ['AstroWay', 'Astrology-API.io'],
    notes: 'Zero Jaimini endpoints in FreeAstroAPI. Currently computed locally in jyotishMath.ts.',
  },
  {
    capability: 'Ashtakavarga Shodhana (Trikona Shodhana, Ekadhipati Shodhana, Shodhya Pinda)',
    category: 'Ashtakavarga',
    freeAstroApiStatus: 'unavailable',
    localDerivedStatus: 'unavailable',
    candidateProviders: ['AstroWay'],
    notes: 'FreeAstroAPI provides BAV, SAV, and Prasthara matrices, but omits Trikona/Ekadhipati reductions and Pinda.',
  },
  {
    capability: 'Advanced Avasthas (Deeptadi, Sayanaadi, Lajjitadi)',
    category: 'Planetary Conditions',
    freeAstroApiStatus: 'unavailable',
    localDerivedStatus: 'partial_only' as unknown as 'approximation_only',
    candidateProviders: ['AstroWay'],
    notes: 'FreeAstroAPI supports Baladi Avastha only (`include_avastha: true`).',
  },
  {
    capability: 'Graha Yuddha (Planetary War exact angular/latitude/brightness winner)',
    category: 'Planetary Conditions',
    freeAstroApiStatus: 'partial_only',
    localDerivedStatus: 'unavailable',
    candidateProviders: ['AstroWay'],
    notes: 'Requires ecliptic latitude (`latitude_deg` from /api/v1/ephemeris/calculate) + classical brightness/disc rule.',
  },
  {
    capability: 'Alternative Dasha Systems (Yogini, Ashtottari, Kalachakra, Narayana)',
    category: 'Timing Systems',
    freeAstroApiStatus: 'unavailable',
    localDerivedStatus: 'unavailable',
    candidateProviders: ['AstroWay', 'Astrology-API.io', 'RoxyAPI'],
    notes: 'FreeAstroAPI supports Vimshottari only.',
  },
  {
    capability: 'Five-level Dasha Hierarchy (Mahadasha -> Antardasha -> Pratyantardasha -> Sookshma -> Prana)',
    category: 'Timing Systems',
    freeAstroApiStatus: 'partial_only',
    localDerivedStatus: 'unavailable',
    candidateProviders: ['AstroWay', 'Astrology-API.io'],
    notes: 'FreeAstroAPI caps `dasha_levels` at 3 (Pratyantardasha). Sookshma & Prana unavailable.',
  },
  {
    capability: 'Hellenistic Lots (Part of Fortune/Spirit/Eros/Necessity) & Traditional Profections/Almuten/Firdaria',
    category: 'Western Traditional / Hellenistic',
    freeAstroApiStatus: 'partial_only',
    localDerivedStatus: 'unavailable',
    candidateProviders: ['Astrology-API.io', 'RoxyAPI'],
    notes: 'FreeAstroAPI provides annual profections, progressions, and primary directions, but not full Hermetic Lots or Firdaria.',
  },
];

function unavailableEnvelope<T>(
  source: string,
  calculationMethod: string,
  conventions: Record<string, unknown>,
  inputFingerprint: string,
  limitations: string[]
): DatasetEnvelope<T> {
  return {
    source,
    calculationMethod,
    version: V2_MASTER_SCHEMA_VERSION,
    conventions,
    inputFingerprint,
    completeness: 'unavailable',
    verificationStatus: 'unavailable',
    limitations,
    data: null,
  };
}

function asObj(val: unknown): Record<string, unknown> | null {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : null;
}

function asObjArr(val: unknown): Array<Record<string, unknown>> {
  return Array.isArray(val)
    ? (val.filter((x) => x && typeof x === 'object') as Array<Record<string, unknown>>)
    : [];
}

const BPHS_SHADBALA_MIN_RUPAS: Record<string, number> = {
  Sun: 6.5,
  Moon: 6.0,
  Mars: 5.0,
  Mercury: 7.0,
  Jupiter: 6.5,
  Venus: 5.5,
  Saturn: 5.0,
};

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

export function normalizeAstroWayPlanetName(rawName: unknown): string {
  const raw = String(rawName ?? '').trim();
  if (!raw) return '';
  const low = raw.toLowerCase().replace(/[_-]+/g, ' ');
  if (low === 'sun' || low === 'surya') return 'Sun';
  if (low === 'moon' || low === 'chandra') return 'Moon';
  if (low === 'mars' || low === 'mangala' || low === 'kuja') return 'Mars';
  if (low === 'mercury' || low === 'budha') return 'Mercury';
  if (low === 'jupiter' || low === 'guru' || low === 'brihaspati') return 'Jupiter';
  if (low === 'venus' || low === 'shukra') return 'Venus';
  if (low === 'saturn' || low === 'shani') return 'Saturn';
  if (
    low === 'rahu' ||
    low === 'mean node' ||
    low === 'true node' ||
    low === 'north node' ||
    low === 'mean north node' ||
    low === 'true north node'
  ) {
    return 'Rahu';
  }
  if (
    low === 'ketu' ||
    low === 'south node' ||
    low === 'mean south node' ||
    low === 'true south node'
  ) {
    return 'Ketu';
  }
  if (low === 'uranus') return 'Uranus';
  if (low === 'neptune') return 'Neptune';
  if (low === 'pluto') return 'Pluto';
  if (low === 'ascendant' || low === 'asc' || low === 'lagna') return 'Ascendant';
  if (low === 'mc' || low === 'midheaven') return 'MC';
  return raw;
}

function unwrapAstroWayCall(call: SanitizedProviderCallRecord | undefined): Record<string, unknown> | null {
  if (!call?.ok) return null;
  const root = asObj(call.rawResponse);
  if (!root) return null;
  const data = asObj(root.data);
  if (data) return data;
  if (Array.isArray(root.data)) return { items: root.data };
  return root;
}

function resolveSignNameFromAstroWayEntry(entry: Record<string, unknown> | null): string {
  if (!entry) return '';
  if (typeof entry.signName === 'string' && entry.signName.trim()) {
    return entry.signName.trim();
  }
  if (typeof entry.sign === 'string' && entry.sign.trim() && Number.isNaN(Number(entry.sign))) {
    return entry.sign.trim();
  }
  const lon = Number(entry.longitude ?? entry.abs_pos ?? entry.degree ?? NaN);
  if (Number.isFinite(lon)) {
    return SIGNS[Math.floor(normalizeDeg(lon) / 30) % 12] || '';
  }
  if (typeof entry.sign === 'number' && Number.isInteger(entry.sign)) {
    if (entry.sign >= 1 && entry.sign <= 12) return SIGNS[entry.sign - 1] || '';
    if (entry.sign >= 0 && entry.sign < 12) return SIGNS[entry.sign] || '';
  }
  return '';
}

function findArrayInAstroWayData(
  data: Record<string, unknown> | null,
  preferredKeys: string[]
): Array<Record<string, unknown>> {
  if (!data) return [];
  for (const k of preferredKeys) {
    if (Array.isArray(data[k])) {
      return asObjArr(data[k]);
    }
  }
  for (const val of Object.values(data)) {
    if (Array.isArray(val) && val.some((x) => x && typeof x === 'object')) {
      return asObjArr(val);
    }
  }
  return [];
}

function normalizeAstroWayLayerBMasterChartRecord(params: {
  instant: CanonicalBirthInstant;
  rawLayerA: LayerARawProviderRecord;
  cachedVerifiedRecord?: LayerBMasterChartRecord | null;
}): LayerBMasterChartRecord {
  const { instant, rawLayerA } = params;
  const fp = instant.inputFingerprint;
  const indepRef = computeIndependentAstronomicalReference(instant);
  const calls = rawLayerA.calls || {};

  const chartSidereal = unwrapAstroWayCall(calls.chart_sidereal);
  const chartTropical = unwrapAstroWayCall(calls.chart_tropical);
  const kundli = unwrapAstroWayCall(calls.vedic_kundli);
  const panchang = unwrapAstroWayCall(calls.vedic_panchang_full);
  const avPrastara = unwrapAstroWayCall(calls.ashtakavarga_prastara);
  const avBasic = unwrapAstroWayCall(calls.ashtakavarga_basic);
  const yogasParashara = unwrapAstroWayCall(calls.yogas_parashara_full);
  const vimshottariPrana = unwrapAstroWayCall(calls.dashas_vimshottari_prana);

  // =========================================================================
  // FRAME 1: VEDIC LAHIRI (AstroWay /vedic/kundli + /chart + 16 Vargas + AV + Dasha)
  // =========================================================================
  const sidHousesObj = asObj(chartSidereal?.houses);
  const kundliLagna = asObj(kundli?.lagna);
  const ascDegRaw = Number(
    kundliLagna?.longitude ?? sidHousesObj?.ascendant ?? Number.NaN
  );
  const ascDeg = Number.isFinite(ascDegRaw) ? normalizeDeg(ascDegRaw) : null;
  const ascSignIdx = ascDeg !== null ? Math.floor(ascDeg / 30) % 12 : null;

  const siderealPlanetsArr = asObjArr(chartSidereal?.planets);
  const kundliGrahasArr = asObjArr(kundli?.grahas);
  const chartSiderealNodeLabels = siderealPlanetsArr
    .map((p) => String(p.name || p.id || '').trim())
    .filter((n) => /node|rahu|ketu/i.test(n));
  const kundliNodeLabels = kundliGrahasArr
    .map((p) => String(p.name || '').trim())
    .filter((n) => /node|rahu|ketu/i.test(n));

  const siderealByCanon = new Map<string, Record<string, unknown>>();
  for (const p of siderealPlanetsArr) {
    const canon = normalizeAstroWayPlanetName(p.name || p.id);
    if (canon) siderealByCanon.set(canon, p);
  }
  const kundliByCanon = new Map<string, Record<string, unknown>>();
  for (const g of kundliGrahasArr) {
    const canon = normalizeAstroWayPlanetName(g.name);
    if (canon) kundliByCanon.set(canon, g);
  }

  const orderedCanonNames: string[] = [];
  for (const k of [...kundliByCanon.keys(), ...siderealByCanon.keys()]) {
    if (!orderedCanonNames.includes(k)) orderedCanonNames.push(k);
  }

  const vedicPlanets: Array<Record<string, unknown>> = [];
  for (const name of orderedCanonNames) {
    const k = kundliByCanon.get(name);
    const s = siderealByCanon.get(name);
    const lonRaw = Number(k?.longitude ?? s?.longitude ?? Number.NaN);
    if (!Number.isFinite(lonRaw)) continue;
    const lon = normalizeDeg(lonRaw);
    const signIdx = Math.floor(lon / 30) % 12;
    const degInSign = Number((lon % 30).toFixed(6));
    const house = ascSignIdx !== null ? ((signIdx - ascSignIdx + 12) % 12) + 1 : undefined;
    vedicPlanets.push({
      name,
      raw_name: k?.name ?? s?.name ?? name,
      absolute_degree: lon,
      degree: lon,
      sign: resolveSignNameFromAstroWayEntry(k || s) || SIGNS[signIdx],
      degree_in_sign: degInSign,
      ...(house !== undefined ? { house } : {}),
      is_retrograde: Boolean(k?.isRetrograde ?? s?.isRetrograde),
      ...(typeof s?.latitude === 'number' ? { latitude_deg: s.latitude } : {}),
      ...(typeof s?.distance === 'number' ? { distance_au: s.distance } : {}),
      ...(typeof s?.speedLong === 'number' ? { speed_deg_per_day: s.speedLong } : {}),
      ...(typeof s?.declination === 'number' ? { declination: s.declination } : {}),
      ...(typeof s?.rightAscension === 'number' ? { right_ascension: s.rightAscension } : {}),
    });
  }

  // Build 16 Shodashavarga charts from /vedic/varga/D*
  const vargaChartsByDivision: Record<string, Record<string, unknown>> = {};
  for (const [callId, callRec] of Object.entries(calls)) {
    if (!callId.startsWith('varga_')) continue;
    const divKey = callId.replace(/^varga_/, '');
    const vData = unwrapAstroWayCall(callRec);
    if (!vData) continue;
    const vLagna = asObj(vData.lagna);
    const vLagnaSign = resolveSignNameFromAstroWayEntry(vLagna);
    const vPlanets = asObjArr(vData.planets).map((vp) => ({
      name: normalizeAstroWayPlanetName(vp.name || vp.id),
      raw_name: vp.name ?? vp.id,
      sign: resolveSignNameFromAstroWayEntry(vp),
      longitude: vp.longitude,
      degree_in_sign: vp.degreeInSign,
      is_retrograde: Boolean(vp.isRetrograde),
    }));
    vargaChartsByDivision[divKey] = {
      varga: vData.varga ?? divKey,
      ayanamsa: vData.ayanamsa ?? null,
      calibrated: true,
      ascendant: vLagna
        ? {
            ...vLagna,
            sign: vLagnaSign,
          }
        : null,
      planets: vPlanets,
    };
  }
  const vargaKeys = Object.keys(vargaChartsByDivision);

  // Normalize Ashtakavarga (Prastara + BAV + SAV)
  let vedicAshtakavarga: VedicLahiriFrame['ashtakavarga'] = null;
  if (avPrastara && Array.isArray(avPrastara.planets)) {
    const bhinnashtakavarga: Record<string, number[]> = {};
    const prastharashtakavarga: Record<string, Record<string, number[]>> = {};
    for (const pEntry of asObjArr(avPrastara.planets)) {
      const pName = normalizeAstroWayPlanetName(pEntry.planetName || pEntry.planet);
      if (!pName) continue;
      if (Array.isArray(pEntry.bindus)) {
        bhinnashtakavarga[pName] = pEntry.bindus.map((n) => Number(n ?? 0));
      }
      if (Array.isArray(pEntry.contributors)) {
        const matrix: Record<string, number[]> = {};
        for (const c of asObjArr(pEntry.contributors)) {
          const src = normalizeAstroWayPlanetName(c.source) || String(c.source || '');
          if (src && Array.isArray(c.signs)) {
            matrix[src] = c.signs.map((n) => Number(n ?? 0));
          }
        }
        prastharashtakavarga[pName] = matrix;
      }
    }
    const sav = Array.isArray(avPrastara.sarva)
      ? avPrastara.sarva.map((n) => Number(n ?? 0))
      : [];
    vedicAshtakavarga = {
      sarvashtakavarga: sav,
      bhinnashtakavarga,
      prastharashtakavarga,
      totalPoints: Number(
        avPrastara.sarvaTotal ?? sav.reduce((a, b) => a + b, 0)
      ),
    };
  } else if (avBasic && Array.isArray(avBasic.sarva)) {
    const sav = avBasic.sarva.map((n) => Number(n ?? 0));
    const bav: Record<string, number[]> = {};
    for (const pEntry of asObjArr(avBasic.planets)) {
      const pName = normalizeAstroWayPlanetName(pEntry.planetName || pEntry.planet);
      if (pName && Array.isArray(pEntry.bindus)) {
        bav[pName] = pEntry.bindus.map((n) => Number(n ?? 0));
      }
    }
    vedicAshtakavarga = {
      sarvashtakavarga: sav,
      bhinnashtakavarga: bav,
      prastharashtakavarga: {},
      totalPoints: Number(avBasic.sarvaTotal ?? sav.reduce((a, b) => a + b, 0)),
    };
  }

  // Normalize Parashara Yogas
  const yogaItems = yogasParashara
    ? findArrayInAstroWayData(yogasParashara, ['yogas', 'items', 'present', 'detected'])
    : [];

  // Normalize Vimshottari Prana Dasha
  let normalizedVimshottari: Record<string, unknown> | null = null;
  if (vimshottariPrana) {
    const init = asObj(vimshottariPrana.initial) || {};
    const lord = normalizeAstroWayPlanetName(init.initialPlanetName ?? init.initialPlanet);
    const remY = Number(init.balanceYears ?? Number.NaN);
    const elY = Number(init.elapsedYears ?? Number.NaN);
    const canonicalFullY = VIMSHOTTARI_FULL_YEARS[lord];
    const periods = asObjArr(vimshottariPrana.periods).map((md) => ({
      ...md,
      lord: normalizeAstroWayPlanetName(md.planetName ?? md.planet),
      start_date: md.startDate,
      end_date: md.endDate,
      duration_years: md.durationYears,
    }));
    normalizedVimshottari = {
      ...vimshottariPrana,
      birth_balance: {
        lord,
        remaining_years: Number.isFinite(remY) ? remY : null,
        elapsed_years: Number.isFinite(elY) ? elY : null,
        full_duration_years:
          canonicalFullY ??
          (Number.isFinite(remY) && Number.isFinite(elY) ? Number((remY + elY).toFixed(4)) : null),
        balanceMonths: init.balanceMonths ?? null,
        balanceDays: init.balanceDays ?? null,
      },
      mahadashas: periods,
    };
  }

  const vedicCusps = Array.isArray(sidHousesObj?.cusps)
    ? (sidHousesObj!.cusps as number[]).map((c, idx) => ({
        house: idx + 1,
        degree: normalizeDeg(Number(c)),
        sign: SIGNS[Math.floor(normalizeDeg(Number(c)) / 30) % 12],
      }))
    : [];

  let vedicLahiri: DatasetEnvelope<VedicLahiriFrame>;
  if (chartSidereal || kundli) {
    const vedicFrameData: VedicLahiriFrame = {
      ayanamshaLabel: String(kundli?.ayanamsa ?? 'lahiri'),
      houseSystem: String(sidHousesObj?.system ?? 'W'),
      nodeType: chartSiderealNodeLabels.length
        ? `provider_default (${chartSiderealNodeLabels.join(', ')}; ChartInput omits nodeType)`
        : 'provider_default (ChartInput omits nodeType)',
      timezoneUsed: instant.timezone.ianaTimezone || `offset_${instant.timezone.historicalUtcOffsetHours}`,
      ascendant:
        ascDeg !== null
          ? {
              ...(kundliLagna || {}),
              degree: ascDeg,
              absolute_degree: ascDeg,
              sign: resolveSignNameFromAstroWayEntry(kundliLagna) || SIGNS[ascSignIdx!],
            }
          : null,
      planets: vedicPlanets,
      houses: vedicCusps,
      sadeSati: null,
      vargas:
        vargaKeys.length > 0
          ? {
              supportedCount: vargaKeys.length,
              divisionsReturned: vargaKeys,
              chartsByDivision: vargaChartsByDivision,
            }
          : null,
      ashtakavarga: vedicAshtakavarga,
      yogas: yogasParashara
        ? {
            summary: yogasParashara,
            items: yogaItems,
            metadata: { source: '/vedic/yogas/parashara/full' },
          }
        : null,
      panchang,
      vimshottariDasha: normalizedVimshottari,
      providerMetadata: asObj(chartSidereal?.meta) || null,
    };

    const vedicLimitations: string[] = [
      'AstroWay ChartInput v2.383.19 does not expose an explicit nodeType (Mean vs True Node) toggle.',
    ];
    if (vargaKeys.length < 16) {
      vedicLimitations.push(
        `Returned ${vargaKeys.length}/16 expected BPHS Shodashavarga divisions (D5 Panchamsha is not supported by AstroWay v2.383.19).`
      );
    }

    vedicLahiri = {
      source: 'astroway:/chart + /vedic/kundli + /vedic/varga/D* + /vedic/ashtakavarga/prastara',
      calculationMethod: 'AstroWay V1 Lahiri Whole-Sign Sidereal',
      version: V2_MASTER_SCHEMA_VERSION,
      conventions: {
        ayanamsha: 'lahiri',
        houseSystem: 'whole_sign',
        nodeConvention: vedicFrameData.nodeType,
        observationPoint: 'geocentric',
      },
      inputFingerprint: fp,
      completeness:
        vedicPlanets.length >= 9 &&
        vargaKeys.length >= 16 &&
        vedicAshtakavarga &&
        normalizedVimshottari
          ? 'complete'
          : 'partial',
      verificationStatus: 'verified_provider',
      limitations: vedicLimitations,
      data: vedicFrameData,
    };
  } else {
    vedicLahiri = unavailableEnvelope<VedicLahiriFrame>(
      'astroway:/chart + /vedic/kundli',
      'none',
      { ayanamsha: 'lahiri', houseSystem: 'whole_sign' },
      fp,
      [
        calls.chart_sidereal
          ? `Provider returned HTTP ${calls.chart_sidereal.httpStatus}: ${calls.chart_sidereal.errorMessage || 'error'}`
          : 'AstroWay Vedic Lahiri endpoints failed or were not executed.',
      ]
    );
  }

  // =========================================================================
  // FRAME 2: KP PLACIDUS (/vedic/kp/cusps + sub-lords + significators + cuspal position)
  // =========================================================================
  const kpCuspsRaw = unwrapAstroWayCall(calls.kp_cusps);
  const kpSubLordsRaw = unwrapAstroWayCall(calls.kp_sub_lords);
  const kpPosRaw = unwrapAstroWayCall(calls.kp_planet_cuspal_position);
  const kpSigRaw = unwrapAstroWayCall(calls.kp_significators);
  const kpRulingRaw = unwrapAstroWayCall(calls.kp_ruling_planets);

  let kpPlacidus: DatasetEnvelope<KpPlacidusFrame>;
  if (kpSubLordsRaw || kpCuspsRaw) {
    const rawCusps = asObjArr(kpSubLordsRaw?.cusps ?? kpCuspsRaw?.cusps);
    const kpCusps = rawCusps.map((c, idx) => {
      const deg = normalizeDeg(Number(c.longitude ?? c.cusp_degree ?? 0));
      return {
        ...c,
        house: Number(c.house ?? idx + 1),
        cusp_degree: deg,
        absolute_degree: deg,
        sign: resolveSignNameFromAstroWayEntry(c) || SIGNS[Math.floor(deg / 30) % 12],
        star_lord: normalizeAstroWayPlanetName(c.starLordName ?? c.starLord),
        sub_lord: normalizeAstroWayPlanetName(c.subName ?? c.subLord),
        sub_sub_lord: normalizeAstroWayPlanetName(c.subSubName ?? c.subSubLord),
        sign_lord: normalizeAstroWayPlanetName(c.signLordName ?? c.signLord),
      };
    });

    const kpPosArr = findArrayInAstroWayData(kpPosRaw, ['planets', 'items', 'positions', 'cuspalPositions']);
    const kpHouseByPlanet = new Map<string, number>();
    for (const row of kpPosArr) {
      const pname = normalizeAstroWayPlanetName(row.grahaName ?? row.planetName ?? row.planet ?? row.name);
      const hNum = Number(row.house ?? row.kpHouse ?? row.bhava ?? Number.NaN);
      if (pname && Number.isInteger(hNum) && hNum >= 1 && hNum <= 12) {
        kpHouseByPlanet.set(pname, hNum);
      }
    }

    const kpPlanets = asObjArr(kpSubLordsRaw?.planets ?? kpCuspsRaw?.planets).map((p) => {
      const pName = normalizeAstroWayPlanetName(p.grahaName ?? p.name);
      const lon = normalizeDeg(Number(p.longitude ?? 0));
      const kpHouse = kpHouseByPlanet.get(pName) ?? (typeof p.house === 'number' ? p.house : undefined);
      return {
        ...p,
        name: pName,
        raw_name: p.grahaName ?? p.name,
        absolute_degree: lon,
        degree: lon,
        sign: resolveSignNameFromAstroWayEntry(p) || SIGNS[Math.floor(lon / 30) % 12],
        star_lord: normalizeAstroWayPlanetName(p.starLordName ?? p.starLord),
        sub_lord: normalizeAstroWayPlanetName(p.subName ?? p.subLord),
        sub_sub_lord: normalizeAstroWayPlanetName(p.subSubName ?? p.subSubLord),
        sign_lord: normalizeAstroWayPlanetName(p.signLordName ?? p.signLord),
        ...(kpHouse !== undefined ? { kp_house: kpHouse, house: kpHouse } : {}),
      };
    });

    const planetSignificators = asObjArr(
      kpSigRaw?.significators ?? findArrayInAstroWayData(kpSigRaw, ['significators', 'planets', 'items'])
    ).map((s) => {
      const levels = asObj(s.levels) || {};
      return {
        ...s,
        planet: normalizeAstroWayPlanetName(s.grahaName ?? s.planet ?? s.name),
        level_1: levels.l1 ?? s.level_1 ?? [],
        level_2: levels.l2 ?? s.level_2 ?? [],
        level_3: levels.l3 ?? s.level_3 ?? [],
        level_4: levels.l4 ?? s.level_4 ?? [],
      };
    });

    const kpAyVal =
      typeof kpCuspsRaw?.ayanamsa === 'number'
        ? kpCuspsRaw.ayanamsa
        : typeof kpSubLordsRaw?.ayanamsa === 'number'
        ? kpSubLordsRaw.ayanamsa
        : null;
    const kpLagnaObj = asObj(kpSubLordsRaw?.lagna ?? kpCuspsRaw?.lagna);
    const kpAscDeg =
      kpLagnaObj && typeof kpLagnaObj.longitude === 'number'
        ? normalizeDeg(kpLagnaObj.longitude)
        : kpCusps[0]?.cusp_degree ?? null;
    const kpMcDeg = kpCusps[9]?.cusp_degree ?? null;

    const kpFrameData: KpPlacidusFrame = {
      ayanamsha: {
        id: 'kp',
        name: 'Krishnamurti (KP)',
        valueDegrees: kpAyVal,
      },
      angles: {
        ascendant: kpAscDeg !== null ? { degree: kpAscDeg } : null,
        mc: kpMcDeg !== null ? { degree: kpMcDeg } : null,
      },
      ascendant: kpAscDeg !== null ? { ...(kpLagnaObj || {}), degree: kpAscDeg } : null,
      planets: kpPlanets,
      cusps: kpCusps,
      cuspalSubLordTable: kpCusps,
      planetSignificators,
      houseSignificators: Array.isArray(kpSigRaw?.houseSignificators)
        ? asObjArr(kpSigRaw?.houseSignificators)
        : [],
      rulingPlanets: kpRulingRaw,
      dasha: null,
      metadata: {
        method: kpCuspsRaw?.method ?? 'placidus',
        nodeConventionNote: 'ChartInput omits nodeType',
      },
    };

    kpPlacidus = {
      source: 'astroway:/vedic/kp/cusps + /sub-lords + /planet-cuspal-position + /significators',
      calculationMethod: 'AstroWay V1 KP Placidus (ayanamsa=kp, houseSystem=P)',
      version: V2_MASTER_SCHEMA_VERSION,
      conventions: {
        ayanamsha: 'kp',
        ayanamshaValueDeg: kpAyVal,
        houseSystem: 'placidus',
      },
      inputFingerprint: fp,
      completeness: kpCusps.length === 12 && kpPlanets.length >= 9 ? 'complete' : 'partial',
      verificationStatus: 'verified_provider',
      limitations: [],
      data: kpFrameData,
    };
  } else {
    kpPlacidus = unavailableEnvelope<KpPlacidusFrame>(
      'astroway:/vedic/kp/*',
      'none',
      { ayanamsha: 'kp', houseSystem: 'placidus' },
      fp,
      ['AstroWay KP endpoints failed or were not executed.']
    );
  }

  // =========================================================================
  // FRAME 3: BHAVA CHALIT (Not exposed as standalone endpoint in AstroWay v2.383.19)
  // =========================================================================
  const bhavaChalit = unavailableEnvelope<BhavaChalitFrame>(
    'astroway:not_supported_in_v2.383.19',
    'none',
    { ayanamsha: 'lahiri', methodology: 'sripati_midpoint_chalit' },
    fp,
    [
      'AstroWay OpenAPI v2.383.19 exposes /vedic/bhavabala (with house madhyaLon) but does not expose a dedicated Bhava Chalit planet-shift chart endpoint.',
    ]
  );

  // =========================================================================
  // FRAME 4: WESTERN TROPICAL PLACIDUS (/chart zodiacType=tropical, houseSystem=P)
  // =========================================================================
  let westernTropical: DatasetEnvelope<WesternTropicalFrame>;
  if (chartTropical) {
    const tHousesObj = asObj(chartTropical.houses);
    const tCuspsArr = Array.isArray(tHousesObj?.cusps)
      ? (tHousesObj!.cusps as number[]).map((deg, idx) => {
          const norm = normalizeDeg(Number(deg));
          return {
            house: idx + 1,
            abs_pos: norm,
            longitude: norm,
            sign: SIGNS[Math.floor(norm / 30) % 12],
          };
        })
      : [];
    const tAsc = typeof tHousesObj?.ascendant === 'number' ? normalizeDeg(tHousesObj.ascendant) : null;
    const tMc = typeof tHousesObj?.mc === 'number' ? normalizeDeg(tHousesObj.mc) : null;

    const tPlanets = asObjArr(chartTropical.planets).map((p) => {
      const lon = normalizeDeg(Number(p.longitude ?? 0));
      return {
        ...p,
        name: normalizeAstroWayPlanetName(p.name || p.id),
        raw_name: p.name ?? p.id,
        abs_pos: lon,
        longitude: lon,
        sign: SIGNS[Math.floor(lon / 30) % 12],
        is_retrograde: Boolean(p.isRetrograde),
      };
    });

    const tAspects = asObjArr(chartTropical.aspects).map((a) => {
      const typeObj = asObj(a.type);
      return {
        ...a,
        p1_name: normalizeAstroWayPlanetName(a.planet1),
        p2_name: normalizeAstroWayPlanetName(a.planet2),
        aspect: String(typeObj?.name ?? a.type ?? ''),
        aspect_degrees: typeof typeObj?.angle === 'number' ? typeObj.angle : undefined,
        orb: Number(a.orb ?? Number.NaN),
      };
    });

    const westData: WesternTropicalFrame = {
      zodiacType: 'tropical',
      houseSystem: String(tHousesObj?.system ?? 'placidus'),
      timeKnown: true,
      secondPrecisionDroppedByV1Endpoint: false,
      subject: asObj(chartTropical.meta),
      resolvedTime: {
        julianDay: chartTropical.julianDay ?? null,
        siderealTime: chartTropical.siderealTime ?? null,
        chartSect: chartTropical.chartSect ?? null,
      },
      angles: {
        ascendant: tAsc !== null ? { abs_pos: tAsc } : null,
        mc: tMc !== null ? { abs_pos: tMc } : null,
        armc: tHousesObj?.armc ?? null,
        vertex: tHousesObj?.vertex ?? null,
      },
      anglesDetails: tHousesObj,
      planets: tPlanets,
      houses: tCuspsArr,
      aspects: tAspects,
      aspectsSummary: null,
      declinationAspects: [],
      declinationAspectsSummary: null,
      configurations: null,
      stelliums: null,
      dominants: null,
      dominantsProfile: null,
      tables: null,
    };

    westernTropical = {
      source: 'astroway:/chart (zodiacType=tropical, houseSystem=P)',
      calculationMethod: 'AstroWay V1 Tropical Placidus Natal',
      version: V2_MASTER_SCHEMA_VERSION,
      conventions: {
        zodiac: 'tropical',
        houseSystem: 'placidus',
      },
      inputFingerprint: fp,
      completeness: tPlanets.length >= 10 && tCuspsArr.length === 12 ? 'complete' : 'partial',
      verificationStatus: 'verified_provider',
      limitations: [],
      data: westData,
    };
  } else {
    westernTropical = unavailableEnvelope<WesternTropicalFrame>(
      'astroway:/chart (tropical)',
      'none',
      { zodiac: 'tropical', houseSystem: 'placidus' },
      fp,
      ['AstroWay Western Tropical /chart request failed or was not executed.']
    );
  }

  // =========================================================================
  // FRAME 5: ASTRONOMICAL TELEMETRY (/chart sidereal bodies + JD/LST/RA/Decl)
  // =========================================================================
  let astronomicalTelemetry: DatasetEnvelope<AstronomicalTelemetryFrame>;
  if (chartSidereal) {
    const bodies: Record<string, Record<string, unknown>> = {};
    for (const p of siderealPlanetsArr) {
      const name = normalizeAstroWayPlanetName(p.name || p.id);
      if (!name) continue;
      bodies[name] = {
        raw_name: p.name ?? p.id,
        longitude: p.longitude,
        latitude_deg: p.latitude,
        distance_au: p.distance,
        speed_deg_per_day: p.speedLong,
        speed_lat_deg_per_day: p.speedLat,
        speed_dist_au_per_day: p.speedDist,
        is_retrograde: Boolean(p.isRetrograde),
        declination: p.declination,
        right_ascension: p.rightAscension,
      };
    }

    const tsCheck = rawLayerA.ephemerisTimestampCheck ?? null;
    const telemetryData: AstronomicalTelemetryFrame = {
      zodiacType: 'sidereal',
      siderealAyanamsa: 'lahiri',
      timestamp: instant.utc.iso,
      localTimestamp: `${instant.input.birthDate}T${instant.input.birthTime}`,
      resolvedTime: {
        julianDay: chartSidereal.julianDay ?? null,
        siderealTime: chartSidereal.siderealTime ?? null,
        chartSect: chartSidereal.chartSect ?? null,
      },
      subjectSettings: asObj(chartSidereal.meta),
      bodies,
      astrology: { vedicAscendantDeg: ascDeg },
      angles: sidHousesObj,
      houses: vedicCusps,
      timestampVerification: tsCheck,
    };

    astronomicalTelemetry = {
      source: 'astroway:/chart (telemetry fields)',
      calculationMethod: 'AstroWay V1 Astronomical Ephemeris Telemetry',
      version: V2_MASTER_SCHEMA_VERSION,
      conventions: {
        zodiacType: 'sidereal',
        ayanamsha: 'lahiri',
        observationPoint: 'geocentric',
      },
      inputFingerprint: fp,
      completeness: Object.keys(bodies).length > 0 ? 'complete' : 'partial',
      verificationStatus: tsCheck?.exactTimestampMatch ? 'verified_provider' : 'partial',
      limitations: tsCheck?.limitationNotes || [],
      data: telemetryData,
    };
  } else {
    astronomicalTelemetry = unavailableEnvelope<AstronomicalTelemetryFrame>(
      'astroway:/chart (telemetry)',
      'none',
      { zodiacType: 'sidereal', ayanamsha: 'lahiri' },
      fp,
      ['AstroWay /chart astronomical telemetry unavailable.']
    );
  }

  // =========================================================================
  // SHADBALA RECONCILIATION (Keep unassigned_pending_reconciliation)
  // =========================================================================
  const shadbalaFullData = unwrapAstroWayCall(calls.shadbala_full);
  const providerShadbalaMap: Record<string, Record<string, unknown>> = {};
  if (shadbalaFullData && Array.isArray(shadbalaFullData.items)) {
    for (const item of asObjArr(shadbalaFullData.items)) {
      const pName = normalizeAstroWayPlanetName(item.planetName || item.planet);
      const minRupas = BPHS_SHADBALA_MIN_RUPAS[pName];
      if (!pName || !minRupas) continue;
      const totalVirupa = Number(item.totalVirupa ?? 0);
      const totalRupa = Number(item.totalRupa ?? (totalVirupa / 60).toFixed(2));
      providerShadbalaMap[pName] = {
        sthana_bala: Number(item.sthana ?? 0),
        dig_bala: Number(item.dig ?? 0),
        kala_bala: Number(item.kala ?? 0),
        cheshta_bala: Number(item.cheshta ?? 0),
        naisargika_bala: Number(item.naisargika ?? 0),
        drik_bala: Number(item.drik ?? 0),
        total: totalVirupa,
        shadbala_in_rupas: totalRupa,
        minimum_requirements: minRupas,
        ratio: Number((totalRupa / minRupas).toFixed(4)),
      };
    }
  }
  const hasAwShadbala = Object.keys(providerShadbalaMap).length > 0;
  const vedicAscDeg =
    ascDeg !== null ? ascDeg : indepRef.lahiriAscendantDeg;
  const canonicalPlanets =
    vedicPlanets.length >= 8
      ? buildPlanetPositionsFromVedicFrame(vedicPlanets, vedicAscDeg)
      : [];

  const reconciliationData = buildShadbalaReconciliationReport({
    instant,
    providerShadbalaRaw: hasAwShadbala ? providerShadbalaMap : null,
    providerStrengthMetadata: {
      provider: 'astroway',
      ratioComputedLocallyAgainstBphsMinimums: true,
      openApiNote: 'Abda/Masa lords and Yuddha Bala still marked open vs PyJHora 62-chart set in OpenAPI.',
    },
    canonicalLahiriPlanets: canonicalPlanets,
    lahiriAscDeg: vedicAscDeg,
    lahiriMcDeg: indepRef.lahiriMcDeg,
    placidusLahiriCusps: null,
  });

  // Override the FreeAstroAPI-specific unavailable list with AstroWay's actual omissions
  const awUnavailableStrengthItems: string[] = [
    'Vimshopaka Bala (Shadvarga / Saptavarga / Dashavarga / Shodashavarga — not in AstroWay OpenAPI)',
    'Panchadha Maitri (Five-fold Compound Friendship — not in AstroWay OpenAPI)',
  ];
  for (const subId of [
    'shadbala_sthana',
    'shadbala_dig',
    'shadbala_kala',
    'shadbala_cheshta',
    'shadbala_naisargika',
    'shadbala_drik',
    'shadbala_ishta_kashta',
    'bhavabala',
  ]) {
    if (!calls[subId]?.ok) {
      awUnavailableStrengthItems.push(
        `${subId} (${calls[subId]?.errorMessage || 'failed or restricted'})`
      );
    }
  }
  reconciliationData.unavailableClassicalSubcomponents = awUnavailableStrengthItems;

  const shadbalaReconciliation: DatasetEnvelope<typeof reconciliationData> = {
    source: 'reconciliation(astroway_v1 + legacy_local + bphs_ref)',
    calculationMethod: 'Side-by-side Shadbala reconciliation (no averaging, no silent authority)',
    version: V2_MASTER_SCHEMA_VERSION,
    conventions: {
      authoritativeDesignation: reconciliationData.authoritativeDesignation,
    },
    inputFingerprint: fp,
    completeness: hasAwShadbala ? 'complete' : 'partial',
    verificationStatus: 'pending_live_reconciliation',
    limitations: [
      'AstroWay exposes detailed 6-Bala subcomponents, Ishta/Kashta (x-quality=yellow), and Bhavabala (x-quality=yellow), while Vimshopaka Bala and Panchadha Maitri are absent.',
    ],
    data: reconciliationData,
  };

  // =========================================================================
  // EXTENDED CLASSICAL DATASETS + UPDATED GAPS MATRIX
  // =========================================================================
  const providerExtendedDatasets: Record<string, unknown> = {
    shadbalaSubcomponents: {
      sthana: unwrapAstroWayCall(calls.shadbala_sthana),
      dig: unwrapAstroWayCall(calls.shadbala_dig),
      kala: unwrapAstroWayCall(calls.shadbala_kala),
      cheshta: unwrapAstroWayCall(calls.shadbala_cheshta),
      naisargika: unwrapAstroWayCall(calls.shadbala_naisargika),
      drik: unwrapAstroWayCall(calls.shadbala_drik),
    },
    ishtaKashtaPhala: unwrapAstroWayCall(calls.shadbala_ishta_kashta),
    bhavabala: unwrapAstroWayCall(calls.bhavabala),
    ashtakavargaShodhana: unwrapAstroWayCall(calls.ashtakavarga_shodhana),
    kpExtended: {
      rulingPlanets: kpRulingRaw,
      ascSub: unwrapAstroWayCall(calls.kp_asc_sub),
      fortuna: unwrapAstroWayCall(calls.kp_fortuna),
      planetCuspalPosition: kpPosRaw,
    },
    jaimini: {
      karakas: unwrapAstroWayCall(calls.jaimini_karakas),
      charaKarakas: unwrapAstroWayCall(calls.jaimini_chara_karakas),
      padas: unwrapAstroWayCall(calls.jaimini_padas),
      upapada: unwrapAstroWayCall(calls.jaimini_upapada),
      aspects: unwrapAstroWayCall(calls.jaimini_aspects),
      drishtiRasi: unwrapAstroWayCall(calls.jaimini_drishti_rasi),
      drishtiGraha: unwrapAstroWayCall(calls.jaimini_drishti_graha),
      atmakarakaNavamsa: unwrapAstroWayCall(calls.jaimini_atmakaraka_navamsa),
      argalaAnalysis: unwrapAstroWayCall(calls.jaimini_argala_analysis),
      yogas: unwrapAstroWayCall(calls.jaimini_yogas),
    },
    yogasAndDoshas: {
      yogasParashara,
      yogasJaimini: unwrapAstroWayCall(calls.yogas_jaimini_full),
      doshasParashara: unwrapAstroWayCall(calls.doshas_parashara_full),
      doshasKp: unwrapAstroWayCall(calls.doshas_kp_full),
    },
    upagrahas: unwrapAstroWayCall(calls.vedic_upagrahas),
    advancedDashas: {
      vimshottariPrana,
      charaMaha: unwrapAstroWayCall(calls.dashas_chara_maha),
      yoginiMaha: unwrapAstroWayCall(calls.dashas_yogini_maha),
      ashtottariMaha: unwrapAstroWayCall(calls.dashas_ashtottari_maha),
      kalachakraMaha: unwrapAstroWayCall(calls.dashas_kalachakra_maha),
      tribhagiMaha: unwrapAstroWayCall(calls.dashas_tribhagi_maha),
    },
    westernAndHellenistic: {
      essentialDignities: unwrapAstroWayCall(calls.western_essential_dignities),
      firdaria: unwrapAstroWayCall(calls.western_firdaria),
      profections: unwrapAstroWayCall(calls.western_profections),
      brennanLots15: unwrapAstroWayCall(calls.hellenistic_brennan_lots_15),
      brennanZrFortune: unwrapAstroWayCall(calls.hellenistic_brennan_zr_fortune),
      brennanZrSpirit: unwrapAstroWayCall(calls.hellenistic_brennan_zr_spirit),
      brennanProfectionsDetail: unwrapAstroWayCall(calls.hellenistic_brennan_profections_detail),
    },
    nodeConventionObserved: {
      chartSiderealNodeLabels,
      kundliNodeLabels,
      caveat: 'AstroWay ChartInput v2.383.19 omits explicit nodeType (Mean vs True node) toggle.',
    },
    explicitApiGaps: [
      'Vimshopaka Bala (no endpoint in AstroWay OpenAPI v2.383.19)',
      'Panchadha Maitri (no endpoint in AstroWay OpenAPI v2.383.19)',
      'Advanced Avasthas: Deeptadi / Sayanaadi / Lajjitadi (no endpoint in AstroWay OpenAPI v2.383.19)',
      'D5 Panchamsha divisional chart (only 16 BPHS Shodashavarga D1–D60 endpoints exist)',
      'Standalone Bhava Chalit planet-shift chart (only /vedic/bhavabala exists)',
    ],
  };

  const resolveAwStatus = (
    callIds: string[],
    overrideNote?: string
  ): {
    status: RemainingClassicalGapItem['selectedProviderStatus'];
    note: string;
  } => {
    const matched = callIds.map((id) => calls[id]).filter(Boolean);
    if (matched.length === 0) {
      return { status: 'unavailable', note: overrideNote || 'Not requested.' };
    }
    const okList = matched.filter((c) => c.ok);
    const restricted = matched.filter((c) => c.accessRestricted);
    if (okList.length === matched.length) {
      const anyYellow = okList.some((c) => c.declaredQuality === 'yellow');
      return {
        status: anyYellow ? 'available_yellow' : 'available_green',
        note: `${okList.length}/${matched.length} AstroWay endpoint(s) acquired${
          anyYellow ? ' (includes OpenAPI x-quality=yellow dataset requiring external verification)' : ''
        }.${overrideNote ? ` ${overrideNote}` : ''}`,
      };
    }
    if (restricted.length > 0 && okList.length === 0) {
      return {
        status: 'tier_restricted',
        note: `AstroWay returned HTTP ${restricted[0].httpStatus} (tier/credit restricted).`,
      };
    }
    if (okList.length > 0) {
      return {
        status: 'partial_only',
        note: `${okList.length}/${matched.length} AstroWay endpoint(s) succeeded; ${
          matched.length - okList.length
        } failed or restricted.`,
      };
    }
    return {
      status: 'unavailable',
      note: `All ${matched.length} AstroWay endpoint(s) failed (last HTTP ${matched[0].httpStatus}).`,
    };
  };

  const remainingClassicalGaps: RemainingClassicalGapItem[] = REMAINING_CLASSICAL_GAPS_INVENTORY.map(
    (item) => {
      if (item.capability.startsWith('Detailed Shadbala Subcomponents')) {
        const res = resolveAwStatus([
          'shadbala_sthana',
          'shadbala_dig',
          'shadbala_kala',
          'shadbala_cheshta',
          'shadbala_naisargika',
          'shadbala_drik',
        ]);
        return { ...item, selectedProviderStatus: res.status, notes: res.note };
      }
      if (item.capability.startsWith('Ishta Phala')) {
        const res = resolveAwStatus(['shadbala_ishta_kashta']);
        return { ...item, selectedProviderStatus: res.status, notes: res.note };
      }
      if (item.capability.startsWith('Bhavabala')) {
        const res = resolveAwStatus(['bhavabala']);
        return { ...item, selectedProviderStatus: res.status, notes: res.note };
      }
      if (item.capability.startsWith('Vimshopaka Bala')) {
        return {
          ...item,
          selectedProviderStatus: 'unavailable',
          notes: 'Confirmed absent in AstroWay OpenAPI v2.383.19.',
        };
      }
      if (item.capability.startsWith('Panchadha Maitri')) {
        return {
          ...item,
          selectedProviderStatus: 'unavailable',
          notes: 'Confirmed absent in AstroWay OpenAPI v2.383.19.',
        };
      }
      if (item.capability.startsWith('Jaimini System')) {
        const res = resolveAwStatus([
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
        ]);
        return { ...item, selectedProviderStatus: res.status, notes: res.note };
      }
      if (item.capability.startsWith('Ashtakavarga Shodhana')) {
        const res = resolveAwStatus(['ashtakavarga_shodhana']);
        return { ...item, selectedProviderStatus: res.status, notes: res.note };
      }
      if (item.capability.startsWith('Advanced Avasthas')) {
        return {
          ...item,
          selectedProviderStatus: 'unavailable',
          notes: 'Confirmed absent in AstroWay OpenAPI v2.383.19.',
        };
      }
      if (item.capability.startsWith('Graha Yuddha')) {
        const res = resolveAwStatus(
          ['chart_sidereal', 'shadbala_kala'],
          'Ecliptic latitudes from /chart + kala.yuddha from /vedic/shadbala/kala.'
        );
        return { ...item, selectedProviderStatus: res.status, notes: res.note };
      }
      if (item.capability.startsWith('Alternative Dasha')) {
        const res = resolveAwStatus([
          'dashas_chara_maha',
          'dashas_yogini_maha',
          'dashas_ashtottari_maha',
          'dashas_kalachakra_maha',
          'dashas_tribhagi_maha',
        ]);
        return { ...item, selectedProviderStatus: res.status, notes: res.note };
      }
      if (item.capability.startsWith('Five-level Dasha Hierarchy')) {
        const res = resolveAwStatus(['dashas_vimshottari_prana']);
        return { ...item, selectedProviderStatus: res.status, notes: res.note };
      }
      if (item.capability.startsWith('Hellenistic Lots')) {
        const res = resolveAwStatus([
          'western_essential_dignities',
          'western_firdaria',
          'western_profections',
          'hellenistic_brennan_lots_15',
          'hellenistic_brennan_zr_fortune',
          'hellenistic_brennan_zr_spirit',
          'hellenistic_brennan_profections_detail',
        ]);
        return { ...item, selectedProviderStatus: res.status, notes: res.note };
      }
      return item;
    }
  );

  return {
    schemaVersion: V2_MASTER_SCHEMA_VERSION,
    providerId: 'astroway',
    generatedAtUtc: new Date().toISOString(),
    canonicalBirthInstant: instant,
    frames: {
      vedicLahiri,
      kpPlacidus,
      bhavaChalit,
      westernTropical,
      astronomicalTelemetry,
    },
    shadbalaReconciliation,
    providerExtendedDatasets,
    remainingClassicalGaps,
  };
}

export function buildLayerBMasterChartRecord(params: {
  instant: CanonicalBirthInstant;
  rawLayerA?: LayerARawProviderRecord | null;
  cachedVerifiedRecord?: LayerBMasterChartRecord | null;
}): LayerBMasterChartRecord {
  const { instant, rawLayerA, cachedVerifiedRecord } = params;
  if (rawLayerA?.providerId === 'astroway') {
    return normalizeAstroWayLayerBMasterChartRecord({
      instant,
      rawLayerA,
      cachedVerifiedRecord,
    });
  }

  const fp = instant.inputFingerprint;
  const indepRef = computeIndependentAstronomicalReference(instant);

  const calcCall = rawLayerA?.calls?.vedic_calculate;
  const kpCall = rawLayerA?.calls?.vedic_kp;
  const westCall = rawLayerA?.calls?.western_natal;
  const ephCall = rawLayerA?.calls?.ephemeris;

  const resolveCached = <T>(
    extractor: (r: LayerBMasterChartRecord) => DatasetEnvelope<T>
  ): DatasetEnvelope<T> | null => {
    if (
      cachedVerifiedRecord &&
      cachedVerifiedRecord.canonicalBirthInstant.inputFingerprint === fp
    ) {
      const env = extractor(cachedVerifiedRecord);
      if (env.data && env.completeness === 'complete') {
        return { ...env, verificationStatus: 'cached_verified' };
      }
    }
    return null;
  };

  // =========================================================================
  // FRAME 1: VEDIC LAHIRI (Whole Sign + 17 Vargas + Ashtakavarga + Yogas + Panchang + Dasha)
  // =========================================================================
  let vedicLahiri: DatasetEnvelope<VedicLahiriFrame>;
  if (calcCall?.ok && asObj(calcCall.rawResponse)) {
    const raw = calcCall.rawResponse as Record<string, unknown>;
    const chart = asObj(raw.chart) || {};
    const vargasRaw = asObj(raw.vargas);
    const vargaChartsRaw = (asObj(vargasRaw?.vargas) || {}) as Record<
      string,
      Record<string, unknown>
    >;
    const avRaw = asObj(raw.ashtakavarga);
    const yogasRaw = asObj(raw.yogas);
    const dashaRaw = asObj(raw.vimshottari_dasha);
    const panchangRaw = asObj(raw.panchang);

    const frameData: VedicLahiriFrame = {
      ayanamshaLabel: String(raw.ayanamsha || 'lahiri'),
      houseSystem: String(
        asObj(chart.metadata)?.house_system || 'whole_sign'
      ),
      nodeType: String(
        asObj(chart.metadata)?.node_type || instant.input.nodeConvention
      ),
      timezoneUsed: String(raw.timezone_used || ''),
      ascendant: asObj(chart.ascendant),
      planets: asObjArr(chart.planets),
      houses: asObjArr(chart.houses),
      sadeSati: asObj(chart.sade_sati),
      vargas: vargasRaw
        ? {
            supportedCount: Object.keys(vargaChartsRaw).length,
            divisionsReturned: Object.keys(vargaChartsRaw),
            chartsByDivision: vargaChartsRaw,
          }
        : null,
      ashtakavarga: avRaw
        ? {
            sarvashtakavarga: Array.isArray(avRaw.sarvashtakavarga)
              ? (avRaw.sarvashtakavarga as number[])
              : [],
            bhinnashtakavarga:
              (asObj(avRaw.bhinnashtakavarga) as Record<string, number[]>) || {},
            prastharashtakavarga:
              (asObj(avRaw.prastharashtakavarga) as Record<
                string,
                Record<string, number[]>
              >) || {},
            totalPoints: Number(avRaw.total_points ?? 0),
          }
        : null,
      yogas: yogasRaw
        ? {
            summary: asObj(yogasRaw.summary),
            items: asObjArr(yogasRaw.yogas),
            metadata: asObj(yogasRaw.metadata),
          }
        : null,
      panchang: panchangRaw,
      vimshottariDasha: dashaRaw,
      providerMetadata: asObj(raw.metadata) || asObj(chart.metadata),
    };

    const limitations: string[] = [];
    if (!frameData.vargas || frameData.vargas.supportedCount < 17) {
      limitations.push(
        `Returned ${frameData.vargas?.supportedCount ?? 0}/17 expected Vargas.`
      );
    }

    vedicLahiri = {
      source: 'freeastroapi:/api/v2/vedic/calculate',
      calculationMethod: 'FreeAstroAPI V2 Lahiri Whole-Sign Sidereal',
      version: String(asObj(chart.metadata)?.ruleset_version || V2_MASTER_SCHEMA_VERSION),
      conventions: {
        ayanamsha: 'lahiri',
        houseSystem: 'whole_sign',
        nodeConvention: frameData.nodeType,
        observationPoint: 'geocentric',
      },
      inputFingerprint: fp,
      completeness:
        frameData.planets.length >= 9 &&
        frameData.vargas &&
        frameData.ashtakavarga &&
        frameData.vimshottariDasha
          ? 'complete'
          : 'partial',
      verificationStatus: 'verified_provider',
      limitations,
      data: frameData,
    };
  } else {
    vedicLahiri =
      resolveCached((r) => r.frames.vedicLahiri) ||
      unavailableEnvelope<VedicLahiriFrame>(
        'freeastroapi:/api/v2/vedic/calculate',
        'none',
        { ayanamsha: 'lahiri', houseSystem: 'whole_sign', nodeConvention: instant.input.nodeConvention },
        fp,
        [
          calcCall
            ? `Provider returned HTTP ${calcCall.httpStatus}: ${calcCall.errorMessage || 'error'}`
            : 'Live provider acquisition not executed (FREE_ASTRO_API_KEY unset or request omitted). Silent fallback disabled.',
        ]
      );
  }

  // =========================================================================
  // FRAME 2: KP (Krishnamurti Ayanamsa + Placidus Cusps — NO H1/H7 overwrite)
  // =========================================================================
  let kpPlacidus: DatasetEnvelope<KpPlacidusFrame>;
  if (kpCall?.ok && asObj(kpCall.rawResponse)) {
    const raw = kpCall.rawResponse as Record<string, unknown>;
    const ayObj = asObj(raw.ayanamsha) || {};
    const frameData: KpPlacidusFrame = {
      ayanamsha: {
        id: String(ayObj.id || 'kp'),
        name: String(ayObj.name || 'Krishnamurti (KP)'),
        valueDegrees: typeof ayObj.value_degrees === 'number' ? ayObj.value_degrees : null,
      },
      angles: asObj(raw.angles),
      ascendant: asObj(raw.ascendant),
      planets: asObjArr(raw.planets),
      cusps: asObjArr(raw.cusps),
      cuspalSubLordTable: asObjArr(raw.cuspal_sub_lord_table),
      planetSignificators: asObjArr(raw.planet_significators),
      houseSignificators: asObjArr(raw.house_significators),
      rulingPlanets: asObj(raw.ruling_planets),
      dasha: asObj(raw.dasha),
      metadata: asObj(raw.metadata),
    };

    kpPlacidus = {
      source: 'freeastroapi:/api/v2/vedic/kp',
      calculationMethod: 'FreeAstroAPI V2 Dedicated KP (ayanamsha=kp, house_system=placidus)',
      version: String(asObj(raw.metadata)?.ruleset_version || V2_MASTER_SCHEMA_VERSION),
      conventions: {
        ayanamsha: 'kp',
        ayanamshaValueDeg: frameData.ayanamsha.valueDegrees,
        houseSystem: 'placidus',
        nodeConvention: String(
          asObj(raw.metadata)?.node_type || instant.input.nodeConvention
        ),
        nodePolicy: asObj(raw.metadata)?.node_policy ?? null,
        significatorPolicy: asObj(raw.metadata)?.significator_policy ?? null,
      },
      inputFingerprint: fp,
      completeness: frameData.cusps.length === 12 && frameData.planets.length >= 9 ? 'complete' : 'partial',
      verificationStatus: 'verified_provider',
      limitations: [],
      data: frameData,
    };
  } else {
    kpPlacidus =
      resolveCached((r) => r.frames.kpPlacidus) ||
      unavailableEnvelope<KpPlacidusFrame>(
        'freeastroapi:/api/v2/vedic/kp',
        'none',
        { ayanamsha: 'kp', houseSystem: 'placidus', nodeConvention: instant.input.nodeConvention },
        fp,
        [
          kpCall
            ? `Provider returned HTTP ${kpCall.httpStatus}: ${kpCall.errorMessage || 'error'}`
            : 'Live KP acquisition not executed. Unverified local cusp approximations are disabled as silent fallbacks.',
        ]
      );
  }

  // =========================================================================
  // FRAME 3: CLASSICAL BHAVA CHALIT (Strictly separated from KP Placidus)
  // =========================================================================
  let bhavaChalit: DatasetEnvelope<BhavaChalitFrame>;
  const providerBcRaw =
    calcCall?.ok && asObj(calcCall.rawResponse)
      ? asObj((calcCall.rawResponse as Record<string, unknown>).bhava_chalit) ||
        asObj(asObj((calcCall.rawResponse as Record<string, unknown>).chart)?.bhava_chalit)
      : null;

  if (providerBcRaw) {
    const methodologyAudit = verifyBhavaChalitMethodology(providerBcRaw, indepRef);
    const frameData: BhavaChalitFrame = {
      chartType: typeof providerBcRaw.chart_type === 'string' ? providerBcRaw.chart_type : null,
      name: typeof providerBcRaw.name === 'string' ? providerBcRaw.name : null,
      calibrated: typeof providerBcRaw.calibrated === 'boolean' ? providerBcRaw.calibrated : null,
      houseBasis: typeof providerBcRaw.house_basis === 'string' ? providerBcRaw.house_basis : null,
      ascendant: asObj(providerBcRaw.ascendant),
      houses: asObjArr(providerBcRaw.houses),
      planets: asObjArr(providerBcRaw.planets),
      methodologyAudit,
    };

    bhavaChalit = {
      source: 'freeastroapi:/api/v2/vedic/calculate#bhava_chalit',
      calculationMethod: `FreeAstroAPI V2 Bhava Chalit (${frameData.houseBasis || 'unspecified'})`,
      version: V2_MASTER_SCHEMA_VERSION,
      conventions: {
        ayanamsha: 'lahiri',
        houseBasis: frameData.houseBasis,
        nodeConvention: instant.input.nodeConvention,
      },
      inputFingerprint: fp,
      completeness: frameData.houses.length === 12 ? 'complete' : 'partial',
      verificationStatus: methodologyAudit.compatibleWithIntendedClassicalMethodology
        ? 'verified_provider'
        : 'partial',
      limitations: methodologyAudit.compatibleWithIntendedClassicalMethodology
        ? []
        : [
            'Provider Bhava Chalit failed full classical Sripati midpoint methodology compatibility check; review methodologyAudit.',
          ],
      data: frameData,
    };
  } else {
    bhavaChalit =
      resolveCached((r) => r.frames.bhavaChalit) ||
      unavailableEnvelope<BhavaChalitFrame>(
        'freeastroapi:/api/v2/vedic/calculate#bhava_chalit',
        'none',
        { ayanamsha: 'lahiri', methodology: 'sripati_midpoint_chalit' },
        fp,
        ['Provider Bhava Chalit not available; legacy KP-cusp Bhava Chalit conflation removed.']
      );
  }

  // =========================================================================
  // FRAME 4: WESTERN TROPICAL PLACIDUS (Independent of KP & Vedic)
  // =========================================================================
  let westernTropical: DatasetEnvelope<WesternTropicalFrame>;
  if (westCall?.ok && asObj(westCall.rawResponse)) {
    const raw = westCall.rawResponse as Record<string, unknown>;
    const frameData: WesternTropicalFrame = {
      zodiacType: String(raw.zodiac_type || 'tropical'),
      houseSystem: String(raw.house_system || 'placidus'),
      timeKnown: typeof raw.time_known === 'boolean' ? raw.time_known : null,
      secondPrecisionDroppedByV1Endpoint: instant.input.second !== 0,
      subject: asObj(raw.subject),
      resolvedTime: asObj(raw.resolved_time),
      angles: asObj(raw.angles),
      anglesDetails: asObj(raw.angles_details),
      planets: asObjArr(raw.planets),
      houses: asObjArr(raw.houses),
      aspects: asObjArr(raw.aspects),
      aspectsSummary: asObj(raw.aspects_summary),
      declinationAspects: asObjArr(raw.declination_aspects),
      declinationAspectsSummary: asObj(raw.declination_aspects_summary),
      configurations: asObj(raw.configurations),
      stelliums: asObj(raw.stelliums),
      dominants: asObj(raw.dominants),
      dominantsProfile: asObj(raw.dominants_profile),
      tables: asObj(raw.tables),
    };

    const limitations: string[] = [];
    if (instant.input.second !== 0) {
      limitations.push(
        `V1 /api/v1/natal/calculate request schema lacks a "second" parameter; ${instant.input.second}s was truncated.`
      );
    }

    westernTropical = {
      source: 'freeastroapi:/api/v1/natal/calculate',
      calculationMethod: 'FreeAstroAPI V1 Tropical Placidus Natal',
      version: String(asObj(raw.resolved_time)?.tzdb_version || V2_MASTER_SCHEMA_VERSION),
      conventions: {
        zodiac: 'tropical',
        houseSystem: 'placidus',
        nodeConvention: instant.input.nodeConvention,
      },
      inputFingerprint: fp,
      completeness: frameData.planets.length >= 10 && frameData.houses.length === 12 ? 'complete' : 'partial',
      verificationStatus: limitations.length ? 'partial' : 'verified_provider',
      limitations,
      data: frameData,
    };
  } else {
    westernTropical =
      resolveCached((r) => r.frames.westernTropical) ||
      unavailableEnvelope<WesternTropicalFrame>(
        'freeastroapi:/api/v1/natal/calculate',
        'none',
        { zodiac: 'tropical', houseSystem: 'placidus', nodeConvention: instant.input.nodeConvention },
        fp,
        ['Western Tropical natal calculation not executed; KP-based Western cusp reconstruction disabled.']
      );
  }

  // =========================================================================
  // FRAME 5: ASTRONOMICAL TELEMETRY (/api/v1/ephemeris/calculate)
  // =========================================================================
  let astronomicalTelemetry: DatasetEnvelope<AstronomicalTelemetryFrame>;
  if (ephCall?.ok && asObj(ephCall.rawResponse)) {
    const raw = ephCall.rawResponse as Record<string, unknown>;
    const dataNode =
      asObj(raw.data) ||
      (Array.isArray(raw.data) ? asObj(raw.data[0]) : null) ||
      {};
    const subj = asObj(dataNode.subject) || {};
    const tsCheck = rawLayerA?.ephemerisTimestampCheck ?? null;

    const frameData: AstronomicalTelemetryFrame = {
      zodiacType: String(asObj(raw.meta)?.zodiac_type || 'sidereal'),
      siderealAyanamsa:
        typeof asObj(raw.meta)?.sidereal_ayanamsa === 'string'
          ? String(asObj(raw.meta)?.sidereal_ayanamsa)
          : null,
      timestamp: typeof dataNode.timestamp === 'string' ? dataNode.timestamp : null,
      localTimestamp:
        typeof dataNode.local_timestamp === 'string' ? dataNode.local_timestamp : null,
      resolvedTime: asObj(dataNode.resolved_time),
      subjectSettings: asObj(subj.settings),
      bodies: (asObj(dataNode.bodies) as Record<string, Record<string, unknown>>) || {},
      astrology: asObj(dataNode.astrology),
      angles: asObj(dataNode.angles),
      houses: Array.isArray(dataNode.houses) ? asObjArr(dataNode.houses) : null,
      timestampVerification: tsCheck,
    };

    const exactOk = tsCheck ? tsCheck.exactTimestampMatch : false;
    astronomicalTelemetry = {
      source: 'freeastroapi:/api/v1/ephemeris/calculate',
      calculationMethod: 'FreeAstroAPI V1 Ephemeris Snapshot',
      version: V2_MASTER_SCHEMA_VERSION,
      conventions: {
        zodiacType: frameData.zodiacType,
        ayanamsha: frameData.siderealAyanamsa,
        observationPoint: 'geocentric',
      },
      inputFingerprint: fp,
      completeness: Object.keys(frameData.bodies).length > 0 ? 'complete' : 'partial',
      verificationStatus: exactOk ? 'verified_provider' : 'partial',
      limitations: tsCheck?.limitationNotes || [],
      data: frameData,
    };
  } else {
    astronomicalTelemetry =
      resolveCached((r) => r.frames.astronomicalTelemetry) ||
      unavailableEnvelope<AstronomicalTelemetryFrame>(
        'freeastroapi:/api/v1/ephemeris/calculate',
        'none',
        { zodiacType: 'sidereal', ayanamsha: 'lahiri' },
        fp,
        ['Astronomical ephemeris telemetry unavailable.']
      );
  }

  // =========================================================================
  // SHADBALA RECONCILIATION (Preserved without silent designation or averaging)
  // =========================================================================
  const calcRawObj = calcCall?.ok ? asObj(calcCall.rawResponse) : null;
  const providerShadbalaRaw = calcRawObj
    ? (asObj(calcRawObj.shadbala) as Record<string, Record<string, unknown>> | null)
    : null;
  const providerStrengthMeta = calcRawObj ? asObj(calcRawObj.metadata) : null;

  const vedicAscDeg =
    vedicLahiri.data?.ascendant && typeof vedicLahiri.data.ascendant.degree === 'number'
      ? Number(vedicLahiri.data.ascendant.degree)
      : indepRef.lahiriAscendantDeg;
  const canonicalPlanets =
    vedicLahiri.data && vedicLahiri.data.planets.length >= 9
      ? buildPlanetPositionsFromVedicFrame(vedicLahiri.data.planets, vedicAscDeg)
      : [];

  const reconciliationData = buildShadbalaReconciliationReport({
    instant,
    providerShadbalaRaw,
    providerStrengthMetadata: providerStrengthMeta,
    canonicalLahiriPlanets: canonicalPlanets,
    lahiriAscDeg: vedicAscDeg,
    lahiriMcDeg: indepRef.lahiriMcDeg,
    placidusLahiriCusps: null,
  });

  const shadbalaReconciliation: DatasetEnvelope<typeof reconciliationData> = {
    source: 'reconciliation(freeastroapi_v2 + legacy_local + bphs_ref)',
    calculationMethod: 'Side-by-side Shadbala reconciliation (no averaging, no silent authority)',
    version: V2_MASTER_SCHEMA_VERSION,
    conventions: {
      authoritativeDesignation: reconciliationData.authoritativeDesignation,
    },
    inputFingerprint: fp,
    completeness: providerShadbalaRaw ? 'complete' : 'partial',
    verificationStatus: 'pending_live_reconciliation',
    limitations: providerShadbalaRaw
      ? ['Detailed classical subcomponents and Bhavabala/Vimshopaka are unavailable from provider.']
      : ['Provider Shadbala absent; reconciliation awaits live FreeAstroAPI execution.'],
    data: reconciliationData,
  };

  return {
    schemaVersion: V2_MASTER_SCHEMA_VERSION,
    providerId: 'freeastroapi',
    generatedAtUtc: new Date().toISOString(),
    canonicalBirthInstant: instant,
    frames: {
      vedicLahiri,
      kpPlacidus,
      bhavaChalit,
      westernTropical,
      astronomicalTelemetry,
    },
    shadbalaReconciliation,
    remainingClassicalGaps: REMAINING_CLASSICAL_GAPS_INVENTORY,
  };
}

export function buildLayerCAnalyticalShell(
  master: LayerBMasterChartRecord
): LayerCAnalyticalShell {
  return {
    schemaVersion: 'v2.analytical_shell.1.0',
    linkedMasterFingerprint: master.canonicalBirthInstant.inputFingerprint,
    linkedMasterSchemaVersion: master.schemaVersion,
    status: 'deferred_by_scope',
    note: 'Layer C proprietary indices (PHI, YSI, DSI, Ascendant Health, domain matrices) are strictly separated and untouched in this phase.',
    touchedIndices: [],
  };
}
