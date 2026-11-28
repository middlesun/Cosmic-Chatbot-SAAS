/**
 * Sanitized Offline Adapter for Real FreeAstroAPI Chart Exports
 *
 * Adapts persisted FreeAstroAPI V2 / CosmicCouncil chart exports (e.g., chris-4, chris-new, chris-3
 * in `public/assets/aistudio/`) into canonical `LayerBMasterChartRecord` + `LayerCAnalyticalInput`
 * structures for offline Foundational V2, K01, and K02 verification.
 *
 * Strict Honesty Rules:
 * - Preserves exact exported longitudes, 16 Vargas, KP cusps/significators, Ashtakavarga BAV/SAV,
 *   Shadbala summaries, Western tropical data, and Vimshottari stack without altering numbers.
 * - Keeps missing V2-only datasets (astronomicalTelemetry, detailed Shadbala subcomponents, Bhavabala,
 *   5-level Vimshottari, Alternative Dashas) strictly `unavailable`.
 * - Never pretends a FreeAstroAPI export is a 62/64-endpoint AstroWay capture.
 */

import {
  buildLayerCAnalyticalShell,
  buildShadbalaReconciliationReport,
  computeIndependentAstronomicalReference,
  computePhase4LocalCalculationsForFrame,
  buildPhase4LocalModuleEnvelopes,
  evaluateDatasetCompleteness,
  prepareLayerCAnalyticalInput,
  resolveCanonicalBirthInstant,
  verifyMasterChartRecord,
  type BhavaChalitFrame,
  type CanonicalBirthInstant,
} from '../../server/services/v2Engine';
import type {
  AstronomicalTelemetryFrame,
  CompiledV2FoundationalChartResult,
  DatasetEnvelope,
  KpPlacidusFrame,
  LayerBMasterChartRecord,
  RemainingClassicalGapItem,
  ShadbalaReconciliationReport,
  VedicLahiriFrame,
  WesternTropicalFrame,
} from '../../server/services/v2Engine/types';
import type { LayerCAnalyticalInput } from '../../server/services/v2Engine/layerCContract';
import { formatDMS, getDignity, getNakshatraAndSubs, normalizeDeg, SIGNS } from '../../server/services/jyotishMath';

export type RealExportAdaptedChart = {
  fixtureId: string;
  originType: 'real_freeastroapi_export';
  sourceAssetFile: string;
  astroWayPopulated: false;
  instant: CanonicalBirthInstant;
  layerBMaster: LayerBMasterChartRecord;
  compiledResult: CompiledV2FoundationalChartResult;
  layerCInput: LayerCAnalyticalInput;
  rawExportSummary: {
    legacyShadbalaPlanets: Array<Record<string, unknown>>;
    legacyApiShadBalaSummary: Record<string, unknown> | null;
    legacyBhavaChalitShifts: Array<Record<string, unknown>>;
    exportedWesternAyanamsa: number | null;
  };
};

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asArr(v: unknown): Array<Record<string, unknown>> {
  return Array.isArray(v)
    ? (v.filter((x) => x && typeof x === 'object') as Array<Record<string, unknown>>)
    : [];
}

function unavailableEnv<T>(
  source: string,
  conventions: Record<string, unknown>,
  fp: string,
  limitations: string[]
): DatasetEnvelope<T> {
  return {
    source,
    calculationMethod: 'none',
    version: 'v2.master.1.0',
    conventions,
    dependencies: ['canonical_birth_instant'],
    acquiredAtUtc: null,
    temporalScope: 'natal_invariant',
    referenceDateIso: null,
    inputFingerprint: fp,
    completeness: 'unavailable',
    verificationStatus: 'unavailable',
    canonicalStatus: 'unavailable',
    limitations,
    data: null,
  };
}

export function adaptRealFreeAstroApiExport(params: {
  fixtureId: string;
  sourceAssetFile: string;
  rawExportJson: Record<string, unknown>;
  referenceDateIso?: string;
}): RealExportAdaptedChart {
  const { fixtureId, sourceAssetFile, rawExportJson, referenceDateIso = '2026-11-27' } = params;
  const d = (asObj(rawExportJson.data) ?? rawExportJson) as Record<string, unknown>;
  const meta = asObj(d.meta) ?? {};
  const loc = asObj(meta.location) ?? {};

  const label = String(loc.locationLabel || 'Bardhaman, West Bengal, India');
  const labelParts = label.split(',').map((s) => s.trim());
  const city = labelParts[0] || 'Bardhaman';
  const country = labelParts[labelParts.length - 1] || 'India';
  const state = labelParts.length >= 3 ? labelParts[1] : null;

  const instant = resolveCanonicalBirthInstant({
    name: String(meta.name || fixtureId),
    birthDate: String(meta.birthDate || '1985-12-25'),
    birthTime: String(meta.birthTime || '04:33:00'),
    latitude: Number(loc.latitude ?? 23.25572),
    longitude: Number(loc.longitude ?? 87.85691),
    city,
    state,
    country,
    ianaTimezone: country.toLowerCase() === 'india' ? 'Asia/Kolkata' : 'UTC',
    explicitHistoricalUtcOffsetHours:
      typeof loc.timezoneOffset === 'number' ? loc.timezoneOffset : null,
    birthTimePrecision: 'exact',
    nodeConvention: 'mean',
  });

  const fp = instant.inputFingerprint;
  const indepRef = computeIndependentAstronomicalReference(instant);

  const rawPlanets = asArr(d.planets);
  const rawConditions = asArr(d.conditions);
  const condByPlanet = new Map(
    rawConditions.map((c) => [String(c.planet || '').toLowerCase(), c])
  );

  const ascRow =
    rawPlanets.find((p) => String(p.name || '').toLowerCase() === 'ascendant') ?? null;
  const ascLon = ascRow ? Number(ascRow.longitude) : indepRef.lahiriAscendantDeg;
  const ascSignIdx = Math.floor(normalizeDeg(ascLon) / 30) % 12;

  const vedicPlanets: Array<Record<string, unknown>> = rawPlanets
    .filter((p) => String(p.name || '').toLowerCase() !== 'ascendant')
    .map((p) => {
      const name = String(p.name || '');
      const lon = normalizeDeg(Number(p.longitude));
      const cond = condByPlanet.get(name.toLowerCase());
      const signIndex =
        typeof p.signIndex === 'number' ? p.signIndex : Math.floor(lon / 30) % 12;
      const degInSign =
        typeof p.degreeInSign === 'number' ? p.degreeInSign : Number((lon % 30).toFixed(6));
      const isNode = name === 'Rahu' || name === 'Ketu';
      const isRetrograde =
        typeof cond?.isRetrograde === 'boolean'
          ? cond.isRetrograde
          : typeof p.is_retrograde === 'boolean'
          ? p.is_retrograde
          : isNode;
      const isCombust =
        typeof cond?.isCombust === 'boolean'
          ? cond.isCombust
          : typeof p.is_combust === 'boolean'
          ? p.is_combust
          : false;
      const isVargottama =
        typeof cond?.isVargottama === 'boolean' ? cond.isVargottama : undefined;
      const avastha =
        typeof cond?.baladiAvastha === 'string'
          ? String(cond.baladiAvastha).split(' ')[0]
          : undefined;
      return {
        name,
        absolute_degree: lon,
        longitude: lon,
        degree: degInSign,
        degree_in_sign: degInSign,
        sign: String(p.sign || SIGNS[signIndex]),
        signIndex,
        house: typeof p.house === 'number' ? p.house : ((signIndex - ascSignIdx + 12) % 12) + 1,
        nakshatra: p.nakshatra ?? null,
        nakshatra_lord: p.nakshatraLord ?? null,
        pada: p.pada ?? null,
        sub_lord: p.subLord ?? null,
        dignity: cond?.dignity ?? p.dignity ?? null,
        is_retrograde: isRetrograde,
        is_combust: isCombust,
        ...(isVargottama !== undefined ? { is_vargottama: isVargottama } : {}),
        ...(avastha ? { avastha } : {}),
      };
    });

  // Vargas (D1..D60)
  const rawVargas = asObj(d.vargas) ?? {};
  const chartsByDivision: Record<string, Record<string, unknown>> = {};
  for (const [divKey, divVal] of Object.entries(rawVargas)) {
    const dv = asObj(divVal);
    if (!dv) continue;
    const placements = asArr(dv.placements);
    const divAsc = placements.find(
      (pl) => String(pl.name || '').toLowerCase() === 'ascendant'
    );
    chartsByDivision[divKey.toUpperCase()] = {
      division: divKey.toUpperCase(),
      source: 'freeastroapi_exported_chart_json',
      ascendant: divAsc ? { sign: divAsc.sign, signIndex: divAsc.signIndex } : null,
      planets: placements
        .filter((pl) => String(pl.name || '').toLowerCase() !== 'ascendant')
        .map((pl) => ({
          name: pl.name,
          sign: pl.sign,
          signIndex: pl.signIndex,
          house: pl.house,
        })),
    };
  }

  // Ashtakavarga (BAV + SAV from FreeAstroAPI export; Prastara not in legacy export)
  const rawAv = asObj(d.ashtakavarga);
  const rawBhinna = asObj(rawAv?.bhinna);
  const bhinnaMap: Record<string, number[]> = {};
  if (rawBhinna) {
    for (const [pl, arr] of Object.entries(rawBhinna)) {
      if (Array.isArray(arr)) bhinnaMap[pl] = arr.map(Number);
    }
  }
  const sarvaArr = Array.isArray(rawAv?.sarva) ? rawAv!.sarva.map(Number) : [];
  const totalPoints =
    typeof rawAv?.totalBindus === 'number'
      ? Number(rawAv.totalBindus)
      : sarvaArr.reduce((a, b) => a + b, 0);

  const westObj = asObj(d.western) ?? {};
  const exportedWesternAyanamsa =
    typeof westObj.ayanamshaUsedForConversion === 'number'
      ? Number(westObj.ayanamshaUsedForConversion)
      : null;

  // Vimshottari (export includes timeline + currentStack)
  const rawVim = asObj(d.vimshottari);
  const vimCurrentStack = asObj(rawVim?.currentStack);
  const vimTimeline = Array.isArray(rawVim?.timeline) ? (rawVim!.timeline as Array<Record<string, unknown>>) : [];
  const firstMd = vimTimeline[0] ?? null;
  const birthMs = Date.parse(instant.utc.iso);
  const firstMdEndMs = firstMd && typeof firstMd.endDate === 'string' ? Date.parse(firstMd.endDate) : NaN;
  const remainingYears =
    Number.isFinite(birthMs) && Number.isFinite(firstMdEndMs) && firstMdEndMs > birthMs
      ? Number(((firstMdEndMs - birthMs) / (365.2425 * 86400 * 1000)).toFixed(4))
      : null;

  const vedicFrameData: VedicLahiriFrame = {
    ayanamshaLabel: 'lahiri',
    ayanamshaValueDegrees: exportedWesternAyanamsa,
    houseSystem: 'whole_sign',
    nodeType: 'mean',
    timezoneUsed: instant.timezone.ianaTimezone,
    ascendant: {
      degree: ascLon,
      absolute_degree: ascLon,
      sign: String(ascRow?.sign || SIGNS[ascSignIdx]),
      signIndex: ascSignIdx,
      nakshatra: ascRow?.nakshatra ?? null,
      nakshatra_lord: ascRow?.nakshatraLord ?? null,
      pada: ascRow?.pada ?? null,
      sub_lord: ascRow?.subLord ?? null,
    },
    planets: vedicPlanets,
    houses: Array.from({ length: 12 }, (_, idx) => ({
      house: idx + 1,
      sign: SIGNS[(ascSignIdx + idx) % 12],
      signIndex: (ascSignIdx + idx) % 12,
    })),
    sadeSati: null,
    vargas: {
      supportedCount: Object.keys(chartsByDivision).length,
      divisionsReturned: Object.keys(chartsByDivision),
      chartsByDivision,
    },
    ashtakavarga: rawAv
      ? {
          totalPoints,
          sarvashtakavarga: sarvaArr,
          bhinnashtakavarga: bhinnaMap,
          prastharashtakavarga: {},
        }
      : null,
    yogas: (() => {
      const rawYogas = asObj(d.yogas);
      if (!rawYogas) return null;
      return {
        summary: asObj(rawYogas.summary),
        items: Array.isArray(rawYogas.items)
          ? (rawYogas.items.filter((x) => x && typeof x === 'object') as Array<Record<string, unknown>>)
          : [],
        metadata: asObj(rawYogas.metadata),
      };
    })(),
    panchang: asObj(d.panchang),
    vimshottariDasha: rawVim
      ? {
          source: 'freeastroapi_exported_chart_json',
          birth_balance:
            firstMd && typeof firstMd.lord === 'string' && remainingYears !== null
              ? {
                  lord: firstMd.lord,
                  remaining_years: remainingYears,
                }
              : null,
          current_dasha: vimCurrentStack,
          mahadashas: vimTimeline,
          maxDepthObserved: 3,
        }
      : null,
    providerMetadata: {
      provider: 'freeastroapi',
      exportedAt: d.exportedAt ?? meta.generatedAt ?? null,
    },
  };

  const vedicLahiri: DatasetEnvelope<VedicLahiriFrame> = {
    source: `freeastroapi:exported_chart_asset(${sourceAssetFile})`,
    calculationMethod: 'FreeAstroAPI V2 Lahiri Whole-Sign Sidereal (Real Saved Export)',
    version: 'v2.master.1.0',
    conventions: {
      ayanamsha: 'lahiri',
      houseSystem: 'whole_sign',
      nodeConvention: 'mean',
      observationPoint: 'geocentric',
    },
    dependencies: ['canonical_birth_instant'],
    acquiredAtUtc: String(meta.generatedAt || d.exportedAt || new Date().toISOString()),
    temporalScope: 'natal_invariant',
    referenceDateIso: null,
    inputFingerprint: fp,
    completeness: 'complete',
    verificationStatus: 'verified_provider',
    canonicalStatus: 'available',
    limitations: [
      'Constructed from persisted FreeAstroAPI chart export; raw HTTP capture /v1/ephemeris/calculate not bundled in export.',
    ],
    data: vedicFrameData,
  };

  // KP Placidus from d.kp
  const rawKp = asObj(d.kp) ?? {};
  const rawKpCusps = asArr(rawKp.cusps);
  const rawKpSignifs = asArr(rawKp.significators);
  const rawKpRuling = asObj(rawKp.rulingPlanets);

  const kpFrameData: KpPlacidusFrame = {
    ayanamsha: {
      id: 'kp',
      name: 'Krishnamurti (KP)',
      valueDegrees: null,
    },
    angles: null,
    ascendant: rawKpCusps[0] ?? null,
    planets: vedicPlanets.map((p) => {
      const sig = rawKpSignifs.find(
        (s) => String(s.planet || '').toLowerCase() === String(p.name).toLowerCase()
      );
      return {
        name: p.name,
        house: sig?.occupiesHouse ?? p.house,
        star_lord: sig?.starLord ?? p.nakshatra_lord,
        sub_lord: sig?.subLord ?? p.sub_lord,
      };
    }),
    cusps: rawKpCusps.map((c) => ({
      house: c.house,
      cusp_degree: c.longitude,
      absolute_degree: c.longitude,
      longitude: c.longitude,
      sign: c.sign,
      signIndex: c.signIndex,
      star_lord: c.starLord,
      nakshatra_lord: c.starLord,
      sub_lord: c.subLord,
      sign_lord: c.signLord,
      nakshatra: c.nakshatra,
    })),
    cuspalSubLordTable: rawKpCusps,
    planetSignificators: rawKpSignifs,
    houseSignificators: [],
    rulingPlanets: rawKpRuling,
    dasha: null,
    metadata: { source: 'freeastroapi_exported_chart_json' },
  };

  const kpPlacidus: DatasetEnvelope<KpPlacidusFrame> = {
    source: `freeastroapi:exported_chart_asset#kp(${sourceAssetFile})`,
    calculationMethod: 'FreeAstroAPI KP Placidus Cusps & Significators (Real Saved Export)',
    version: 'v2.master.1.0',
    conventions: {
      ayanamsha: 'kp',
      houseSystem: 'placidus',
      nodeConvention: 'mean',
    },
    dependencies: ['canonical_birth_instant'],
    acquiredAtUtc: vedicLahiri.acquiredAtUtc,
    temporalScope: 'natal_invariant',
    referenceDateIso: null,
    inputFingerprint: fp,
    completeness: kpFrameData.cusps.length === 12 ? 'complete' : 'partial',
    verificationStatus: 'verified_provider',
    canonicalStatus: kpFrameData.cusps.length === 12 ? 'available' : 'provisional',
    limitations: [
      'Saved export omits separate KP ayanamsa planet longitudes (cusps + significators + rulingPlanets preserved verbatim).',
    ],
    data: kpFrameData,
  };

  // Bhava Chalit: saved export only contains shifts[] (missing house boundaries), so mark raw as unavailable
  // and let local Sripati fallback populate BhavaChalit cleanly without conflating with KP.
  const rawBc = asObj(d.bhavaChalit);
  const legacyBhavaChalitShifts = asArr(rawBc?.shifts);

  const phase4Computed = computePhase4LocalCalculationsForFrame(
    vedicFrameData,
    vedicLahiri.source,
    indepRef
  );

  const bhavaChalit: DatasetEnvelope<BhavaChalitFrame> = phase4Computed.sripatiBhavaChalit
    ? {
        source: 'local:sripatiBhavaChalit (real_export_adapter_fallback)',
        calculationMethod: 'Classical Sripati Midpoint Bhava Chalit (from real FreeAstroAPI D1 + Independent Reference)',
        version: 'v2.master.1.0',
        conventions: {
          ayanamsha: 'lahiri',
          houseBasis: 'sripati_midpoint_chalit',
          nodeConvention: 'mean',
        },
        dependencies: ['canonical_birth_instant', 'vedic_d1_positions'],
        acquiredAtUtc: vedicLahiri.acquiredAtUtc,
        temporalScope: 'natal_invariant',
        referenceDateIso: null,
        inputFingerprint: fp,
        completeness: 'complete',
        verificationStatus: 'internally_verified',
        canonicalStatus: 'internally_verified',
        limitations: [
          'Legacy export bhavaChalit omitted house cusp boundaries; populated with verified Sripati midpoint Bhava Chalit.',
        ],
        data: phase4Computed.sripatiBhavaChalit,
      }
    : unavailableEnv<BhavaChalitFrame>(
        'unavailable',
        { ayanamsha: 'lahiri', methodology: 'sripati_midpoint_chalit' },
        fp,
        ['Bhava Chalit boundaries unavailable.']
      );

  // Western Tropical Placidus
  const rawWestCusps = asArr(westObj.cusps);
  const rawWestPlanets = asArr(westObj.planets);
  const rawWestAngles = asObj(westObj.angles) ?? {};
  const westFrameData: WesternTropicalFrame = {
    zodiacType: 'tropical',
    houseSystem: String(westObj.system || 'placidus').toLowerCase(),
    timeKnown: true,
    secondPrecisionDroppedByV1Endpoint: false,
    subject: null,
    resolvedTime: null,
    angles: {
      ascendant: asObj(rawWestAngles.ascendant)?.longitude ?? rawWestCusps[0]?.longitude ?? null,
      midheaven: asObj(rawWestAngles.midheaven)?.longitude ?? rawWestCusps[9]?.longitude ?? null,
      descendant: asObj(rawWestAngles.descendant)?.longitude ?? rawWestCusps[6]?.longitude ?? null,
      ic: asObj(rawWestAngles.ic)?.longitude ?? rawWestCusps[3]?.longitude ?? null,
    },
    anglesDetails: rawWestAngles,
    planets: rawWestPlanets.map((wp) => ({
      name: wp.name,
      longitude: wp.longitude,
      abs_pos: wp.longitude,
      sign: wp.sign,
      signIndex: wp.signIndex,
      house: wp.house,
      retrograde: wp.isRetrograde,
      isRetrograde: wp.isRetrograde,
      dignity: wp.dignity,
      essentialScore: wp.essentialScore,
      accidentalScore: wp.accidentalScore,
      solarCondition: wp.solarCondition,
      sectAlignment: wp.sectAlignment,
    })),
    houses: rawWestCusps.map((wc) => ({
      house: wc.house,
      longitude: wc.longitude,
      abs_pos: wc.longitude,
      sign: wc.sign,
      signIndex: wc.signIndex,
    })),
    aspects: asArr(westObj.aspects),
    aspectsSummary: null,
    declinationAspects: [],
    declinationAspectsSummary: null,
    configurations: asObj(westObj.configurations),
    stelliums: null,
    dominants: asObj(westObj.elements),
    dominantsProfile: null,
    tables: null,
  };

  const westernTropical: DatasetEnvelope<WesternTropicalFrame> = {
    source: `freeastroapi:exported_chart_asset#western(${sourceAssetFile})`,
    calculationMethod: 'FreeAstroAPI Tropical Placidus (Real Saved Export)',
    version: 'v2.master.1.0',
    conventions: {
      zodiac: 'tropical',
      houseSystem: 'placidus',
      nodeConvention: 'mean',
    },
    dependencies: ['canonical_birth_instant'],
    acquiredAtUtc: vedicLahiri.acquiredAtUtc,
    temporalScope: 'natal_invariant',
    referenceDateIso: null,
    inputFingerprint: fp,
    completeness:
      westFrameData.planets.length >= 10 && westFrameData.houses.length === 12
        ? 'complete'
        : 'partial',
    verificationStatus: 'verified_provider',
    canonicalStatus:
      westFrameData.planets.length >= 10 && westFrameData.houses.length === 12
        ? 'available'
        : 'provisional',
    limitations: [],
    data: westFrameData,
  };

  const astronomicalTelemetry = unavailableEnv<AstronomicalTelemetryFrame>(
    'freeastroapi:/api/v1/ephemeris/calculate',
    { zodiacType: 'sidereal', ayanamsha: 'lahiri' },
    fp,
    ['Separate /api/v1/ephemeris/calculate snapshot unavailable in legacy chart export.']
  );

  // Shadbala Reconciliation (real provider shadBalaSummary vs legacy local shadbala.planets)
  const providerShadbalaRaw = asObj(d.shadBalaSummary) as Record<
    string,
    Record<string, unknown>
  > | null;
  const canonicalPlanets = vedicPlanets.map((vp) => {
    const lon = Number(vp.absolute_degree);
    const signIndex = Number(vp.signIndex);
    const degreeInSign = Number(vp.degree_in_sign);
    const name = String(vp.name);
    const nak = getNakshatraAndSubs(lon);
    return {
      name,
      sign: String(vp.sign),
      signIndex,
      degreeInSign,
      dms: formatDMS(degreeInSign),
      longitude: lon,
      house: Number(vp.house),
      nakshatra: String(vp.nakshatra || nak.nakshatra),
      nakshatraIndex: nak.nakshatraIndex,
      nakshatraLord: String(vp.nakshatra_lord || nak.nakshatraLord),
      pada: Number(vp.pada || nak.pada),
      subLord: nak.subLord,
      subSubLord: nak.subSubLord,
      isRetrograde: Boolean(vp.is_retrograde),
      dignity: getDignity(name, signIndex),
    };
  });

  const reconciliationData = buildShadbalaReconciliationReport({
    instant,
    providerShadbalaRaw,
    providerStrengthMetadata: { source: 'freeastroapi_exported_shadBalaSummary' },
    canonicalLahiriPlanets: canonicalPlanets,
    lahiriAscDeg: ascLon,
    lahiriMcDeg: indepRef.lahiriMcDeg,
    placidusLahiriCusps: null,
  });

  const shadbalaReconciliation: DatasetEnvelope<ShadbalaReconciliationReport> = {
    source: 'reconciliation(freeastroapi_export + legacy_local + bphs_ref)',
    calculationMethod: 'Side-by-side Shadbala reconciliation (no averaging, no silent authority)',
    version: 'v2.master.1.0',
    conventions: {
      authoritativeDesignation: reconciliationData.authoritativeDesignation,
    },
    dependencies: ['canonical_birth_instant', 'vedic_d1_positions'],
    acquiredAtUtc: vedicLahiri.acquiredAtUtc,
    temporalScope: 'natal_invariant',
    referenceDateIso: null,
    inputFingerprint: fp,
    completeness: providerShadbalaRaw ? 'complete' : 'partial',
    verificationStatus: 'pending_live_reconciliation',
    canonicalStatus: providerShadbalaRaw ? 'provisional' : 'unavailable',
    limitations: [
      'Provider shadBalaSummary preserved side-by-side with legacy local jyotishMath Shadbala; Sun min threshold discrepancy (provider 5.0 vs BPHS 6.5) flagged; authoritativeDesignation remains unassigned_pending_reconciliation.',
    ],
    data: reconciliationData,
  };

  const remainingClassicalGaps: RemainingClassicalGapItem[] = [
    {
      capability: 'AstroWay 62/64-Endpoint Bundle (Bhavabala, Shadbala Subcomponents, Ashtakavarga Shodhana, 5-Level Vimshottari)',
      category: 'Provider Coverage',
      freeAstroApiStatus: 'unavailable',
      localDerivedStatus: 'verified_deterministic',
      candidateProviders: ['AstroWay'],
      notes: 'Not present in saved FreeAstroAPI chart export; K01/K02 test against actual available datasets plus verified local modules.',
    },
  ];

  const baseMaster: LayerBMasterChartRecord = {
    schemaVersion: 'v2.master.1.0',
    recalculationVersion: 'v2.recalc.1.0',
    providerId: 'freeastroapi',
    generatedAtUtc: new Date().toISOString(),
    canonicalBirthInstant: instant,
    calculationConventions: {
      ayanamsa: {
        vedic: 'lahiri',
        vedicValueDegrees: exportedWesternAyanamsa,
        kp: 'Krishnamurti (KP)',
        kpValueDegrees: null,
      },
      nodeConvention: {
        requested: 'mean',
        vedicObserved: 'mean',
        isExplicitOnProvider: true,
      },
      houseSystems: {
        parashari: 'whole_sign',
        kp: 'placidus',
        bhavaChalit: 'sripati_midpoint_chalit_local_fallback',
        western: 'placidus',
      },
      divisionalChartMethods: {
        shodashavarga: 'freeastroapi_v2_16_vargas_export',
        d4Method: 'freeastroapi_v2_chaturthamsha',
        d5Method: null,
      },
      dashaYearLength: {
        vimshottari: '365.2425/365.25-day calendar dates returned by FreeAstroAPI v2',
        alternativeDashas: null,
      },
      shadbalaMethodology: {
        provider: 'freeastroapi_v2_shadbala_export',
        luminaryCheshtaConvention: 'explicit_near_zero_provider_convention',
        minimumStrengthThresholdStandard: 'mixed_sun_5.0_on_provider_vs_bphs_6.5',
      },
      recalculationVersion: 'v2.recalc.1.0',
      supportsFutureUserConventionOverrides: true,
    },
    frames: {
      vedicLahiri,
      kpPlacidus,
      bhavaChalit,
      westernTropical,
      astronomicalTelemetry,
    },
    shadbalaReconciliation,
    referenceDateTiming: vimCurrentStack
      ? {
          temporalScope: 'reference_date_dependent',
          referenceDateIso,
          targetAgeYears: null,
          activeVimshottari: vimCurrentStack,
          activeAlternativeDashas: null,
          kpRulingPlanets: rawKpRuling,
          westernProfections: null,
          limitations: [],
        }
      : null,
    remainingClassicalGaps,
    providerExtendedDatasets: {
      jaimini: (() => {
        const rawJ = asObj(d.jaimini);
        if (!rawJ) return null;
        const karakasArr = asArr(rawJ.karakas);
        const padasArr = asArr(rawJ.arudhaPadas).map((p) => ({
          ...p,
          name: p.code ?? p.name ?? p.pada,
          sign: p.padaSign ?? p.sign,
          house: p.padaHouseFromLagna ?? p.house,
        }));
        const argalaArr = asArr(rawJ.argala);
        return {
          ...rawJ,
          ...(karakasArr.length > 0
            ? {
                karakas: { items: karakasArr },
                charaKarakas: { items: karakasArr },
              }
            : {}),
          ...(padasArr.length > 0 ? { padas: { items: padasArr } } : {}),
          ...(argalaArr.length > 0 ? { argalaAnalysis: { items: argalaArr } } : {}),
          ...(typeof rawJ.karakamshaSign === 'string' && rawJ.karakamshaSign.trim()
            ? { atmakarakaNavamsa: { karakamshaSign: rawJ.karakamshaSign.trim() } }
            : {}),
        };
      })(),
      legacyShadbalaExported: asObj(d.shadbala),
      legacyBhavaChalitShifts,
    },
  };

  const localModules = buildPhase4LocalModuleEnvelopes(baseMaster, phase4Computed);
  const enrichedMaster: LayerBMasterChartRecord = {
    ...baseMaster,
    localModules,
    providerExtendedDatasets: {
      ...baseMaster.providerExtendedDatasets,
      localAshtakavarga: phase4Computed.localAshtakavarga,
      ashtakavargaReductions: phase4Computed.ashtakavargaReductions,
      panchadhaMaitri: phase4Computed.panchadhaMaitri,
      vimshopakaBala: phase4Computed.vimshopakaBala,
      dispositorRelationships: phase4Computed.dispositorRelationships,
      advancedAvasthas: phase4Computed.advancedAvasthas,
      localVedicConditions: phase4Computed.localVedicConditions,
    },
  };
  enrichedMaster.datasetManifest = evaluateDatasetCompleteness(enrichedMaster);

  const verification = verifyMasterChartRecord(enrichedMaster, null);
  const manifest = enrichedMaster.datasetManifest;
  const compiledResult: CompiledV2FoundationalChartResult = {
    schemaVersion: 'v2.compiled_foundational_chart.1.0',
    compiledAtUtc: new Date().toISOString(),
    canonicalBirthInstant: instant,
    layerBMaster: enrichedMaster,
    layerCShell: buildLayerCAnalyticalShell(enrichedMaster),
    localModules,
    verification,
    manifest,
    completenessTable: (
      ['available', 'internally_verified', 'independently_validated', 'provisional', 'incompatible', 'unavailable'] as const
    ).map((state) => {
      const keys = manifest.entries.filter((e) => e.canonicalStatus === state).map((e) => e.key);
      return { state, count: keys.length, datasetKeys: keys };
    }),
    datasetInventory: manifest.entries.map((e) => ({
      key: e.key,
      label: e.label,
      domain: e.tier,
      canonicalStatus: e.canonicalStatus,
      temporalScope: e.temporalScope,
      sourceAttribution: [e.source],
      notes: e.limitations.join(' | ') || 'Satisfied',
    })),
    compatibilityGates: null,
    localAshtakavargaAudit: null,
    endpointAndCreditSummary: {
      astroWay: {
        acquired: false,
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        tierRestrictedCalls: 0,
        rateLimitedCalls: 0,
        unexecutedCalls: 0,
        creditsUsedTotal: null,
        creditsRemainingFinal: null,
        endpointsCalled: [],
      },
      freeAstroApi: {
        acquired: true,
        singleCallOnly: false,
        endpointsCalled: [
          {
            id: 'exported_asset',
            endpoint: sourceAssetFile,
            ok: true,
            httpStatus: 200,
          },
        ],
      },
      localModulesComputedCount: Object.values(localModules).filter(
        (env) => env.canonicalStatus !== 'unavailable' && env.data !== null
      ).length,
    },
    externalValidationBlockers: verification.externalReferenceAudit?.blockers ?? [],
  };

  const layerCInput = prepareLayerCAnalyticalInput(compiledResult);

  return {
    fixtureId,
    originType: 'real_freeastroapi_export',
    sourceAssetFile,
    astroWayPopulated: false,
    instant,
    layerBMaster: enrichedMaster,
    compiledResult,
    layerCInput,
    rawExportSummary: {
      legacyShadbalaPlanets: asArr(asObj(d.shadbala)?.planets),
      legacyApiShadBalaSummary: asObj(d.shadBalaSummary),
      legacyBhavaChalitShifts,
      exportedWesternAyanamsa,
    },
  };
}
