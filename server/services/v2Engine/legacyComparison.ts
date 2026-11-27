/**
 * Isolated V2 Engine — Legacy vs V2 Comparison Report Builder
 *
 * Strictly read-only diagnostic comparator between an existing profile's
 * stored `chart_json` (legacy/production) and the isolated V2 acquisition +
 * independent astronomical reference. Handles partial/failed V2 frames and
 * unactivated profiles (`legacyChartJson === null`) gracefully.
 */

import { normalizeDeg, SIGNS } from '../jyotishMath';
import { assessChartJsonDefects } from './profileImpactAudit';
import { computeIndependentAstronomicalReference } from './verifier';
import type {
  CanonicalBirthInstant,
  LayerBMasterChartRecord,
  LegacyVsV2ComparisonReport,
} from './types';

function asObj(val: unknown): Record<string, unknown> | null {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : null;
}

function asArr(val: unknown): Array<Record<string, unknown>> {
  return Array.isArray(val)
    ? (val.filter((x) => x && typeof x === 'object') as Array<Record<string, unknown>>)
    : [];
}

function numOrNull(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function circularSignedDiff(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  let d = normalizeDeg(a) - normalizeDeg(b);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return Number(d.toFixed(4));
}

function circularAbsDiff(a: number | null, b: number | null): number | null {
  const s = circularSignedDiff(a, b);
  return s === null ? null : Number(Math.abs(s).toFixed(4));
}

function signFromDeg(deg: number): string {
  const idx = Math.floor(normalizeDeg(deg) / 30) % 12;
  return SIGNS[idx] || '';
}

const CORE_PLANETS = [
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
  'Rahu',
  'Ketu',
] as const;

export function buildLegacyVsV2ComparisonReport(params: {
  profileId: string;
  profileName: string;
  legacyChartJson: unknown;
  instant: CanonicalBirthInstant;
  layerB: LayerBMasterChartRecord;
}): LegacyVsV2ComparisonReport {
  const { profileId, profileName, legacyChartJson, instant, layerB } = params;
  const ref = computeIndependentAstronomicalReference(instant);

  const legacyObj = asObj(legacyChartJson);
  const hasLegacyChart = Boolean(legacyObj && Array.isArray(legacyObj.planets));
  const legacyMetaObj = asObj(legacyObj?.meta);
  const legacyLocObj = asObj(legacyMetaObj?.location);

  const legacyDefectAudit = hasLegacyChart
    ? assessChartJsonDefects(profileId, profileName, legacyChartJson)
    : null;

  const legacyPlanets = asArr(legacyObj?.planets);
  const findLegacyPlanet = (name: string) =>
    legacyPlanets.find((p) => String(p.name || '').toLowerCase() === name.toLowerCase()) || null;

  const vedicFrame = layerB.frames.vedicLahiri.data;
  const v2Planets = vedicFrame?.planets || [];
  const findV2Planet = (name: string) =>
    v2Planets.find((p) => String(p.name || '').toLowerCase() === name.toLowerCase()) || null;

  const legacyAscDeg = numOrNull(findLegacyPlanet('Ascendant')?.longitude);
  const v2AscDeg = numOrNull(vedicFrame?.ascendant?.degree);

  const legacySunDeg = numOrNull(findLegacyPlanet('Sun')?.longitude);
  const v2SunDeg = numOrNull(findV2Planet('Sun')?.absolute_degree);

  const legacyMoonDeg = numOrNull(findLegacyPlanet('Moon')?.longitude);
  const v2MoonDeg = numOrNull(findV2Planet('Moon')?.absolute_degree);

  const planetsComparison = CORE_PLANETS.map((planet) => {
    const lp = findLegacyPlanet(planet);
    const vp = findV2Planet(planet);
    const lDeg = numOrNull(lp?.longitude);
    const vDeg = numOrNull(vp?.absolute_degree);
    return {
      planet,
      legacyDeg: lDeg,
      v2ProviderDeg: vDeg,
      deltaDeg: circularAbsDiff(vDeg, lDeg),
      legacySign: lp?.sign ? String(lp.sign) : lDeg !== null ? signFromDeg(lDeg) : null,
      v2Sign: vp?.sign ? String(vp.sign) : vDeg !== null ? signFromDeg(vDeg) : null,
    };
  });

  // KP Cusps 1..12 comparison
  const legacyKpCusps = asArr(asObj(legacyObj?.kp)?.cusps);
  const v2KpCusps = layerB.frames.kpPlacidus.data?.cusps || [];

  const kpCuspsComparison = Array.from({ length: 12 }, (_, idx) => {
    const house = idx + 1;
    const lc = legacyKpCusps.find((c) => Number(c.house) === house) || legacyKpCusps[idx] || null;
    const vc = v2KpCusps.find((c) => Number(c.house) === house) || v2KpCusps[idx] || null;

    const lDeg = numOrNull(lc?.longitude ?? lc?.cusp_degree ?? lc?.absolute_degree);
    const vDeg = numOrNull(vc?.cusp_degree ?? vc?.absolute_degree ?? vc?.longitude);
    const rDeg = ref.kpPlacidusCuspsDeg[idx];
    const rSign = signFromDeg(rDeg);
    const lSign = lc?.sign ? String(lc.sign) : lDeg !== null ? signFromDeg(lDeg) : null;
    const vSign = vc?.sign ? String(vc.sign) : vDeg !== null ? signFromDeg(vDeg) : null;

    return {
      house,
      legacyDeg: lDeg,
      legacySign: lSign,
      legacyStarLord: lc?.starLord ? String(lc.starLord) : null,
      legacySubLord: lc?.subLord ? String(lc.subLord) : null,
      v2ProviderDeg: vDeg,
      v2ProviderSign: vSign,
      v2ProviderStarLord: vc?.star_lord
        ? String(vc.star_lord)
        : vc?.nakshatra_lord
        ? String(vc.nakshatra_lord)
        : null,
      v2ProviderSubLord: vc?.sub_lord ? String(vc.sub_lord) : null,
      independentRefDeg: rDeg,
      independentRefSign: rSign,
      legacyMinusRefDeg: circularSignedDiff(lDeg, rDeg),
      v2MinusRefDeg: circularSignedDiff(vDeg, rDeg),
      signFlipBetweenLegacyAndRef: Boolean(lSign && lSign !== rSign),
    };
  });

  // Western Tropical Cusps 1..12 comparison
  const legacyWestCusps = asArr(asObj(legacyObj?.western)?.cusps);
  const v2WestCusps = layerB.frames.westernTropical.data?.houses || [];

  const westernCuspsComparison = Array.from({ length: 12 }, (_, idx) => {
    const house = idx + 1;
    const lc = legacyWestCusps.find((c) => Number(c.house) === house) || legacyWestCusps[idx] || null;
    const vc = v2WestCusps.find((c) => Number(c.house) === house) || v2WestCusps[idx] || null;

    const lDeg = numOrNull(lc?.longitude ?? lc?.abs_pos);
    const vDeg = numOrNull(vc?.abs_pos ?? vc?.longitude);
    const rDeg = ref.tropicalPlacidusCusps[idx];
    const rSign = signFromDeg(rDeg);
    const lSign = lc?.sign ? String(lc.sign) : lDeg !== null ? signFromDeg(lDeg) : null;
    const vSign = vc?.sign ? String(vc.sign) : vDeg !== null ? signFromDeg(vDeg) : null;

    return {
      house,
      legacyDeg: lDeg,
      legacySign: lSign,
      v2ProviderDeg: vDeg,
      v2ProviderSign: vSign,
      independentRefDeg: rDeg,
      independentRefSign: rSign,
      legacyMinusRefDeg: circularSignedDiff(lDeg, rDeg),
      v2MinusRefDeg: circularSignedDiff(vDeg, rDeg),
    };
  });

  // Bhava Chalit Comparison (Rashi house vs Legacy Chalit vs V2 Provider Chalit vs Independent Sripati)
  const legacyBc = asObj(legacyObj?.bhavaChalit);
  const legacyBcShifts = asArr(legacyBc?.shifts);
  const legacyShiftedPlanets = Array.isArray(legacyBc?.shiftedPlanets)
    ? legacyBc!.shiftedPlanets.map(String)
    : [];

  const v2Bc = layerB.frames.bhavaChalit.data;
  const v2BcPlanets = v2Bc?.planets || [];

  const sripatiShiftedPlanets: string[] = [];
  const bcAscSign = Math.floor(
    normalizeDeg(v2AscDeg ?? legacyAscDeg ?? ref.lahiriAscendantDeg) / 30
  );

  const planetPlacements = CORE_PLANETS.map((planet) => {
    const vp = findV2Planet(planet);
    const lp = findLegacyPlanet(planet);
    const lon = numOrNull(vp?.absolute_degree ?? lp?.longitude);

    const rashiHouse =
      numOrNull(vp?.house) ??
      numOrNull(lp?.house) ??
      (lon !== null ? ((Math.floor(normalizeDeg(lon) / 30) - bcAscSign + 12) % 12) + 1 : null);

    const legacyShiftEntry = legacyBcShifts.find(
      (s) => String(s.planet || '').toLowerCase() === planet.toLowerCase()
    );
    const legacyChalitHouse =
      numOrNull(legacyShiftEntry?.chalitHouse) ?? (hasLegacyChart ? rashiHouse : null);

    const v2BcEntry = v2BcPlanets.find(
      (p) => String(p.name || '').toLowerCase() === planet.toLowerCase()
    );
    const v2ProviderChalitHouse = numOrNull(v2BcEntry?.chalit_house ?? v2BcEntry?.house);

    let independentSripatiHouse: number | null = null;
    if (lon !== null) {
      const targetLon = normalizeDeg(lon);
      for (const sandhi of ref.sripatiLahiriSandhisDeg) {
        const start = sandhi.start;
        const end = sandhi.end;
        const contains =
          start < end ? targetLon >= start && targetLon < end : targetLon >= start || targetLon < end;
        if (contains) {
          independentSripatiHouse = sandhi.house;
          break;
        }
      }
      if (
        independentSripatiHouse !== null &&
        rashiHouse !== null &&
        independentSripatiHouse !== rashiHouse
      ) {
        sripatiShiftedPlanets.push(planet);
      }
    }

    return {
      planet,
      rashiHouse,
      legacyChalitHouse,
      v2ProviderChalitHouse,
      independentSripatiHouse,
    };
  });

  const v2ShiftedCount =
    v2BcPlanets.length > 0
      ? planetPlacements.filter(
          (p) =>
            p.v2ProviderChalitHouse !== null &&
            p.rashiHouse !== null &&
            p.v2ProviderChalitHouse !== p.rashiHouse
        ).length
      : null;

  // Shadbala Comparison (Requirement #6: authoritativeDesignation stays unassigned_pending_reconciliation)
  const legacySbPlanets = asArr(asObj(legacyObj?.shadbala)?.planets);
  const legacyLocalOrder = [...legacySbPlanets]
    .sort((a, b) => Number(b.totalVirupas || 0) - Number(a.totalVirupas || 0))
    .map((p) => String(p.planet || ''));

  const legacyApiSummary = asObj(legacyObj?.shadBalaSummary);
  const legacyApiEntries = legacyApiSummary
    ? Object.entries(legacyApiSummary)
        .filter(([, v]) => Boolean(asObj(v)))
        .map(([planet, v]) => ({
          planet,
          total: numOrNull(asObj(v)?.total) ?? 0,
        }))
    : [];
  const legacyApiSummaryOrder = [...legacyApiEntries]
    .sort((a, b) => b.total - a.total)
    .map((e) => e.planet);

  let maxVirupaConflictBetweenLegacyLocalAndApi: number | null = null;
  for (const apiEntry of legacyApiEntries) {
    const locEntry = legacySbPlanets.find(
      (p) => String(p.planet || '').toLowerCase() === apiEntry.planet.toLowerCase()
    );
    const locTotal = numOrNull(locEntry?.totalVirupas);
    if (locTotal !== null) {
      const diff = Number(Math.abs(locTotal - apiEntry.total).toFixed(2));
      if (
        maxVirupaConflictBetweenLegacyLocalAndApi === null ||
        diff > maxVirupaConflictBetweenLegacyLocalAndApi
      ) {
        maxVirupaConflictBetweenLegacyLocalAndApi = diff;
      }
    }
  }

  // Dataset completeness comparison
  const legacyVargasObj = asObj(legacyObj?.vargas);
  const legacyVargaKeys = legacyVargasObj ? Object.keys(legacyVargasObj) : [];
  const legacyHasD5 = legacyVargaKeys.some((k) => k.toUpperCase() === 'D5' || k === '5');

  const v2VargaKeys = vedicFrame?.vargas?.divisionsReturned || [];
  const v2HasD5 = v2VargaKeys.some((k) => k.toUpperCase() === 'D5' || k === '5');

  const legacyAv = asObj(legacyObj?.ashtakavarga);
  const legacyHasPrasthara = Boolean(legacyAv && asObj(legacyAv.prasthara));
  const v2HasPrasthara = Boolean(
    vedicFrame?.ashtakavarga &&
      Object.keys(vedicFrame.ashtakavarga.prastharashtakavarga || {}).length > 0
  );

  const legacyKpSignifs = asArr(asObj(legacyObj?.kp)?.planetSignificators);
  const legacyHasNativeKp4LevelSignificators = legacyKpSignifs.some(
    (s) => s.source === 'freeastroapi' || Array.isArray(s.level1)
  );
  const v2HasNativeKp4LevelSignificators =
    (layerB.frames.kpPlacidus.data?.planetSignificators.length ?? 0) > 0;

  return {
    generatedAtUtc: new Date().toISOString(),
    hasLegacyChart,
    legacyMeta: {
      providerRecorded: legacyMetaObj?.astrologyProvider
        ? String(legacyMetaObj.astrologyProvider)
        : null,
      providerLabelRecorded: legacyMetaObj?.astrologyProviderLabel
        ? String(legacyMetaObj.astrologyProviderLabel)
        : null,
      generatedAt: legacyMetaObj?.generatedAt ? String(legacyMetaObj.generatedAt) : null,
      birthDate: legacyMetaObj?.birthDate ? String(legacyMetaObj.birthDate) : null,
      birthTime: legacyMetaObj?.birthTime ? String(legacyMetaObj.birthTime) : null,
      timezoneOffset: numOrNull(legacyLocObj?.timezoneOffset),
    },
    legacyDefectAudit,
    primaryCoordinatesComparison: {
      ascendant: {
        legacyDeg: legacyAscDeg,
        v2ProviderDeg: v2AscDeg,
        independentRefDeg: ref.lahiriAscendantDeg,
        legacyMinusRefDeg: circularSignedDiff(legacyAscDeg, ref.lahiriAscendantDeg),
        v2MinusRefDeg: circularSignedDiff(v2AscDeg, ref.lahiriAscendantDeg),
      },
      sun: {
        legacyDeg: legacySunDeg,
        v2ProviderDeg: v2SunDeg,
        independentRefDeg: ref.lahiriSunLonDeg,
        legacyMinusRefDeg: circularSignedDiff(legacySunDeg, ref.lahiriSunLonDeg),
        v2MinusRefDeg: circularSignedDiff(v2SunDeg, ref.lahiriSunLonDeg),
      },
      moon: {
        legacyDeg: legacyMoonDeg,
        v2ProviderDeg: v2MoonDeg,
        independentRefDeg: ref.lahiriMoonLonDeg,
        legacyMinusRefDeg: circularSignedDiff(legacyMoonDeg, ref.lahiriMoonLonDeg),
        v2MinusRefDeg: circularSignedDiff(v2MoonDeg, ref.lahiriMoonLonDeg),
      },
      planets: planetsComparison,
    },
    kpCuspsComparison,
    westernCuspsComparison,
    bhavaChalitComparison: {
      legacyShiftedCount: hasLegacyChart ? legacyShiftedPlanets.length : null,
      legacyShiftedPlanets,
      v2ProviderShiftedCount: v2ShiftedCount,
      v2ProviderCompatibleWithSripati: v2Bc
        ? v2Bc.methodologyAudit.compatibleWithIntendedClassicalMethodology
        : null,
      independentSripatiShiftedCount: sripatiShiftedPlanets.length,
      independentSripatiShiftedPlanets: sripatiShiftedPlanets,
      planetPlacements,
    },
    shadbalaComparison: {
      authoritativeDesignation: 'unassigned_pending_reconciliation',
      legacyLocalOrder,
      legacyApiSummaryOrder,
      v2ProviderOrder: layerB.shadbalaReconciliation.data?.rankingComparison.providerOrder || [],
      maxVirupaConflictBetweenLegacyLocalAndApi,
    },
    datasetCompletenessComparison: {
      legacyVargasCount: legacyVargaKeys.length,
      legacyHasD5,
      v2VargasCount: v2VargaKeys.length,
      v2HasD5,
      legacyHasPrastharaAshtakavarga: legacyHasPrasthara,
      v2HasPrastharaAshtakavarga: v2HasPrasthara,
      legacyHasEphemerisTelemetry: false,
      v2HasEphemerisTelemetry: Boolean(layerB.frames.astronomicalTelemetry.data),
      legacyHasNativeKp4LevelSignificators,
      v2HasNativeKp4LevelSignificators,
    },
  };
}
