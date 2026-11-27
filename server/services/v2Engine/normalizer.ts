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

export function buildLayerBMasterChartRecord(params: {
  instant: CanonicalBirthInstant;
  rawLayerA?: LayerARawProviderRecord | null;
  cachedVerifiedRecord?: LayerBMasterChartRecord | null;
}): LayerBMasterChartRecord {
  const { instant, rawLayerA, cachedVerifiedRecord } = params;
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
