import {
  buildApiPayload,
  fetchChartFromApi,
  geocodeBirthLocation,
  resolveHistoricalTimezoneOffset,
  type BirthLocationResolved,
} from './astrologyApi';
import {
  computeAscendantMaturity,
  computeAshtakavarga,
  computeBhavaChalitShifts,
  computeDispositorChain,
  computeDivisionalCharts,
  computeExtendedJaimini,
  computeJaiminiKarakas,
  computeKPPlacidusCusps,
  computeKPRulingPlanets,
  computeKPSignificators,
  computeLalKitab,
  computeMajorYogas,
  computePanchangAndAvakhada,
  computePlanetaryConditions,
  computePlanetaryHealthIndex,
  computeScoredYogaRegistry,
  computeShadbala,
  computeSpecialVedicPoints,
  computeStructuralFlagsAndDoshas,
  computeVimshottariTimeline,
  computeWesternChart,
  SIGNS,
  type AscendantMaturityReport,
  type AshtakavargaTable,
  type BhavaChalitReport,
  type DashaNode,
  type DispositorChainReport,
  type ExtendedJaiminiData,
  type JaiminiKaraka,
  type KPCusp,
  type KPRulingPlanets,
  type KPSignificatorRow,
  type LalKitabData,
  type PanchangAvakhada,
  type PlanetaryConditionRow,
  type PlanetaryHealthRow,
  type PlanetPosition,
  type ScoredYogaItem,
  type ShadbalaReport,
  type SpecialVedicPointsReport,
  type StructuralFlagsReport,
  type VedicYogaItem,
  type WesternChartData,
} from './jyotishMath';

export interface CompiledChartData {
  meta: {
    name: string;
    birthDate: string;
    birthTime: string;
    location: BirthLocationResolved;
    ayanamsha: string;
    generatedAt: string;
  };
  planets: PlanetPosition[];
  vargas: Record<
    string,
    {
      ascendantSignIndex: number;
      placements: Array<{ name: string; signIndex: number; sign: string; house: number }>;
    }
  >;
  kp: {
    cusps: KPCusp[];
    significators: KPSignificatorRow[];
    rulingPlanets?: KPRulingPlanets;
  };
  jaimini: {
    karakas: JaiminiKaraka[];
    karakamshaSign: string;
    arudhaPadas?: ExtendedJaiminiData['arudhaPadas'];
    charaDasha?: ExtendedJaiminiData['charaDasha'];
    argala?: ExtendedJaiminiData['argala'];
  };
  ashtakavarga: AshtakavargaTable;
  vimshottari: {
    timeline: DashaNode[];
    currentStack: {
      mahadasha: string;
      antardasha: string;
      pratyantardasha: string;
      mdStart?: string;
      mdEnd: string;
      adStart?: string;
      adEnd: string;
      pdStart?: string;
      pdEnd: string;
      mdProgressPct?: number;
      adProgressPct?: number;
      mdSandhiWarning?: boolean;
      adSandhiWarning?: boolean;
    } | null;
  };
  shadbala?: ShadbalaReport;
  panchang?: PanchangAvakhada;
  conditions?: PlanetaryConditionRow[];
  yogas?: VedicYogaItem[];
  lalKitab?: LalKitabData;
  western?: WesternChartData;
  shadBalaSummary?: unknown;
  // Vedic Astrologer Precision Additions
  specialPoints?: SpecialVedicPointsReport;
  bhavaChalit?: BhavaChalitReport;
  ascendantMaturity?: AscendantMaturityReport;
  planetaryHealth?: PlanetaryHealthRow[];
  scoredYogas?: ScoredYogaItem[];
  structuralFlags?: StructuralFlagsReport;
  dispositorChain?: DispositorChainReport;
}

export interface CompileProfileInput {
  name: string;
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:MM or HH:MM:SS
  birthCity: string;
  birthState?: string | null;
  birthCountry: string;
  latitude?: number | null;
  longitude?: number | null;
  timezoneOffset?: number | null;
}

export async function compileBirthChart(input: CompileProfileInput): Promise<{
  location: BirthLocationResolved;
  chartJson: CompiledChartData;
  chartTextContext: string;
}> {
  let location: BirthLocationResolved;

  if (
    typeof input.latitude === 'number' &&
    typeof input.longitude === 'number'
  ) {
    const resolvedTz = await resolveHistoricalTimezoneOffset(
      input.latitude,
      input.longitude,
      input.birthDate,
      input.birthTime,
      typeof input.timezoneOffset === 'number' ? input.timezoneOffset : 0
    );
    location = {
      latitude: input.latitude,
      longitude: input.longitude,
      timezoneOffset: resolvedTz,
      locationLabel: [input.birthCity, input.birthState, input.birthCountry].filter(Boolean).join(', '),
    };
  } else {
    location = await geocodeBirthLocation(
      input.birthCity,
      input.birthState,
      input.birthCountry,
      input.birthDate,
      input.birthTime
    );
  }

  const payload = buildApiPayload(
    input.birthDate,
    input.birthTime,
    location.latitude,
    location.longitude,
    location.timezoneOffset
  );

  const apiData = await fetchChartFromApi(payload);
  const planets = apiData.planets;

  const asc = planets.find((p) => p.name === 'Ascendant');
  const moon = planets.find((p) => p.name === 'Moon');

  const vargas = computeDivisionalCharts(planets);
  const kpCusps = computeKPPlacidusCusps(
    input.birthDate,
    input.birthTime,
    location.timezoneOffset,
    location.latitude,
    location.longitude,
    asc?.longitude
  );
  const kpSignificators = computeKPSignificators(planets, kpCusps);
  const kpRulingPlanets = computeKPRulingPlanets(planets, input.birthDate);
  const jaiminiBase = computeJaiminiKarakas(planets);
  const jaiminiExt = computeExtendedJaimini(planets, input.birthDate);
  const ashtakavarga = computeAshtakavarga(planets);
  const vimshottari = computeVimshottariTimeline(
    moon ? moon.longitude : 0,
    input.birthDate,
    input.birthTime,
    location.timezoneOffset
  );
  const shadbala = computeShadbala(planets, input.birthDate, input.birthTime);
  const panchang = computePanchangAndAvakhada(planets, input.birthDate);
  const conditions = computePlanetaryConditions(planets, vargas);
  const yogas = computeMajorYogas(planets);
  const lalKitab = computeLalKitab(planets, input.birthDate);
  const western = computeWesternChart({
    siderealPlanets: planets,
    kpCusps,
    birthDateISO: input.birthDate,
    birthTimeStr: input.birthTime,
    timezoneOffsetHours: location.timezoneOffset,
    apiWesternPlanets: apiData.apiWesternPlanets,
  });

  const specialPoints = computeSpecialVedicPoints(planets, vargas);
  const bhavaChalit = computeBhavaChalitShifts(planets, kpCusps);
  const ascendantMaturity = computeAscendantMaturity(planets, vargas);
  const structuralFlags = computeStructuralFlagsAndDoshas(planets, vargas, conditions, ashtakavarga);
  const planetaryHealth = computePlanetaryHealthIndex({
    planets,
    vargas,
    shadbala,
    conditions,
    structuralFlags,
    bhavaChalit,
  });
  const scoredYogas = computeScoredYogaRegistry({
    planets,
    vargas,
    conditions,
    planetaryHealth,
    structuralFlags,
  });
  const dispositorChain = computeDispositorChain(planets);

  const chartJson: CompiledChartData = {
    meta: {
      name: input.name,
      birthDate: input.birthDate,
      birthTime: input.birthTime,
      location,
      ayanamsha: 'Lahiri (Chitrapaksha) + KP Placidus',
      generatedAt: new Date().toISOString(),
    },
    planets,
    vargas,
    kp: {
      cusps: kpCusps,
      significators: kpSignificators,
      rulingPlanets: kpRulingPlanets,
    },
    jaimini: {
      ...jaiminiBase,
      ...jaiminiExt,
    },
    ashtakavarga,
    vimshottari,
    shadbala,
    panchang,
    conditions,
    yogas,
    lalKitab,
    western,
    shadBalaSummary: apiData.apiShadBala ?? null,
    specialPoints,
    bhavaChalit,
    ascendantMaturity,
    planetaryHealth,
    scoredYogas,
    structuralFlags,
    dispositorChain,
  };

  const chartTextContext = formatChartForLLM(chartJson, 'vedic');

  return {
    location,
    chartJson,
    chartTextContext,
  };
}

/**
 * Deterministically upgrades any legacy saved chart_json in Supabase with
 * all 16 Vargas, 6-fold Shadbala, Panchang/Avakhada, Planetary Conditions, Yogas,
 * KP Ruling Planets, Extended Jaimini (Arudhas/Chara Dasha/Argala), Lal Kitab,
 * and complete Tropical Western chart — requiring zero external API calls.
 */
export function enrichCompiledChart(rawChart: CompiledChartData): {
  chartJson: CompiledChartData;
  chartTextContext: string;
  wasEnriched: boolean;
} {
  if (!rawChart || !Array.isArray(rawChart.planets) || rawChart.planets.length === 0) {
    return { chartJson: rawChart, chartTextContext: '', wasEnriched: false };
  }

  const missingProFields =
    !rawChart.vargas?.D27 ||
    !rawChart.vargas?.D40 ||
    !rawChart.vargas?.D45 ||
    !rawChart.shadbala ||
    !rawChart.panchang ||
    !rawChart.conditions ||
    !rawChart.yogas ||
    !rawChart.lalKitab ||
    !rawChart.western ||
    !rawChart.western.sect ||
    !rawChart.western.configurations ||
    !rawChart.western.mutualReceptions ||
    !rawChart.western.dispositorTree ||
    !rawChart.western.hellenistic ||
    !rawChart.kp?.rulingPlanets ||
    !rawChart.jaimini?.arudhaPadas ||
    !rawChart.jaimini?.charaDasha ||
    !rawChart.specialPoints ||
    !rawChart.bhavaChalit ||
    !rawChart.ascendantMaturity ||
    !rawChart.planetaryHealth ||
    !rawChart.scoredYogas ||
    !rawChart.structuralFlags ||
    !rawChart.dispositorChain;

  if (!missingProFields) {
    return {
      chartJson: rawChart,
      chartTextContext: formatChartForLLM(rawChart, 'vedic'),
      wasEnriched: false,
    };
  }

  const birthDate = rawChart.meta?.birthDate || '2000-01-01';
  const birthTime = rawChart.meta?.birthTime || '12:00:00';
  const lat = rawChart.meta?.location?.latitude ?? 28.6139;
  const lon = rawChart.meta?.location?.longitude ?? 77.209;
  const tz = rawChart.meta?.location?.timezoneOffset ?? 5.5;
  const asc = rawChart.planets.find((p) => p.name === 'Ascendant');

  const vargas =
    rawChart.vargas?.D27 && rawChart.vargas?.D40 && rawChart.vargas?.D45
      ? rawChart.vargas
      : computeDivisionalCharts(rawChart.planets);

  const kpCusps =
    rawChart.kp?.cusps && rawChart.kp.cusps.length === 12
      ? rawChart.kp.cusps
      : computeKPPlacidusCusps(birthDate, birthTime, tz, lat, lon, asc?.longitude);

  const kpSignificators =
    rawChart.kp?.significators && rawChart.kp.significators.length > 0
      ? rawChart.kp.significators
      : computeKPSignificators(rawChart.planets, kpCusps);

  const rulingPlanets = rawChart.kp?.rulingPlanets || computeKPRulingPlanets(rawChart.planets, birthDate);
  const jaiminiBase = rawChart.jaimini?.karakas ? rawChart.jaimini : computeJaiminiKarakas(rawChart.planets);
  const jaiminiExt =
    rawChart.jaimini?.arudhaPadas && rawChart.jaimini?.charaDasha && rawChart.jaimini?.argala
      ? {
          arudhaPadas: rawChart.jaimini.arudhaPadas,
          charaDasha: rawChart.jaimini.charaDasha,
          argala: rawChart.jaimini.argala,
        }
      : computeExtendedJaimini(rawChart.planets, birthDate);

  const ashtakavarga = rawChart.ashtakavarga?.sarva?.length === 12
    ? rawChart.ashtakavarga
    : computeAshtakavarga(rawChart.planets);

  const shadbala = rawChart.shadbala || computeShadbala(rawChart.planets, birthDate, birthTime);
  const panchang = rawChart.panchang || computePanchangAndAvakhada(rawChart.planets, birthDate);
  const conditions = rawChart.conditions || computePlanetaryConditions(rawChart.planets, vargas);
  const yogas = rawChart.yogas || computeMajorYogas(rawChart.planets);
  const lalKitab = rawChart.lalKitab || computeLalKitab(rawChart.planets, birthDate);
  const western =
    rawChart.western?.sect &&
    rawChart.western?.configurations &&
    rawChart.western?.mutualReceptions &&
    rawChart.western?.dispositorTree &&
    rawChart.western?.hellenistic
      ? rawChart.western
      : computeWesternChart({
          siderealPlanets: rawChart.planets,
          kpCusps,
          birthDateISO: birthDate,
          birthTimeStr: birthTime,
          timezoneOffsetHours: tz,
          apiWesternPlanets: rawChart.western?.planets
            ?.filter((p) => !['Ascendant', 'Midheaven'].includes(p.name))
            .map((p) => ({ name: p.name, longitude: p.longitude, isRetrograde: p.isRetrograde })),
        });

  const specialPoints = rawChart.specialPoints || computeSpecialVedicPoints(rawChart.planets, vargas);
  const bhavaChalit = rawChart.bhavaChalit || computeBhavaChalitShifts(rawChart.planets, kpCusps);
  const ascendantMaturity = rawChart.ascendantMaturity || computeAscendantMaturity(rawChart.planets, vargas);
  const structuralFlags =
    rawChart.structuralFlags ||
    computeStructuralFlagsAndDoshas(rawChart.planets, vargas, conditions, ashtakavarga);
  const planetaryHealth =
    rawChart.planetaryHealth ||
    computePlanetaryHealthIndex({
      planets: rawChart.planets,
      vargas,
      shadbala,
      conditions,
      structuralFlags,
      bhavaChalit,
    });
  const scoredYogas =
    rawChart.scoredYogas ||
    computeScoredYogaRegistry({
      planets: rawChart.planets,
      vargas,
      conditions,
      planetaryHealth,
      structuralFlags,
    });
  const dispositorChain = rawChart.dispositorChain || computeDispositorChain(rawChart.planets);

  const enriched: CompiledChartData = {
    ...rawChart,
    vargas,
    kp: {
      cusps: kpCusps,
      significators: kpSignificators,
      rulingPlanets,
    },
    jaimini: {
      karakas: jaiminiBase.karakas,
      karakamshaSign: jaiminiBase.karakamshaSign,
      ...jaiminiExt,
    },
    ashtakavarga,
    shadbala,
    panchang,
    conditions,
    yogas,
    lalKitab,
    western,
    specialPoints,
    bhavaChalit,
    ascendantMaturity,
    planetaryHealth,
    scoredYogas,
    structuralFlags,
    dispositorChain,
  };

  return {
    chartJson: enriched,
    chartTextContext: formatChartForLLM(enriched, 'vedic'),
    wasEnriched: true,
  };
}

export function formatChartForLLM(
  chart: CompiledChartData,
  mode: 'vedic' | 'western' = 'vedic'
): string {
  const enriched =
    !chart.shadbala ||
    !chart.western ||
    !chart.western.sect ||
    !chart.western.configurations ||
    !chart.western.hellenistic ||
    !chart.lalKitab ||
    !chart.panchang ||
    !chart.vargas?.D27 ||
    !chart.specialPoints ||
    !chart.planetaryHealth
      ? enrichCompiledChart(chart).chartJson
      : chart;

  if (mode === 'western' && enriched.western) {
    const w = enriched.western;
    const compactWestern = {
      system: 'Western Tropical (Placidus)',
      profile: {
        name: enriched.meta.name,
        dob: enriched.meta.birthDate,
        tob: enriched.meta.birthTime,
        place: enriched.meta.location.locationLabel,
      },
      sect: w.sect
        ? {
            type: w.sect.chartType,
            sunH: w.sect.sunHouse,
            sectLight: w.sect.sectLight,
            beneficOfSect: w.sect.beneficOfSect,
            maleficOfSect: w.sect.maleficOfSect,
          }
        : undefined,
      chartRuler: w.chartRuler,
      angles: {
        Asc: `${w.angles.ascendant.sign} ${w.angles.ascendant.dms}`,
        MC: `${w.angles.midheaven.sign} ${w.angles.midheaven.dms}`,
        Desc: `${w.angles.descendant.sign} ${w.angles.descendant.dms}`,
        IC: `${w.angles.ic.sign} ${w.angles.ic.dms}`,
      },
      planets: w.planets.map((p) => ({
        b: p.name,
        s: `${p.sign.slice(0, 3)} ${p.dms}`,
        h: p.house,
        wsH: p.wholeSignHouse,
        hc: p.houseClass,
        rx: p.isRetrograde || undefined,
        dig: p.dignity !== 'Peregrine' ? p.dignity : undefined,
        ess: typeof p.essentialScore === 'number' && p.essentialScore !== 0 ? p.essentialScore : undefined,
        sol: p.solarCondition && p.solarCondition !== 'Free' ? p.solarCondition : undefined,
        sect: p.sectAlignment && p.sectAlignment !== 'Neutral' ? p.sectAlignment : undefined,
      })),
      cusps: w.cusps.map((c) => `H${c.house}:${c.sign.slice(0, 3)} ${c.dms}`),
      elements: w.elements,
      modalities: w.modalities,
      polarities: w.polarities,
      mutualReceptions: w.mutualReceptions?.map((m) => m.summary),
      finalDispositors: w.dispositorTree?.traditional.finalDispositors,
      dispositorLoops: w.dispositorTree?.traditional.loops,
      configurations: w.configurations?.map((cfg) => cfg.summary),
      hellenistic: w.hellenistic,
      aspects: w.aspects
        .slice(0, 36)
        .map(
          (a) =>
            `${a.bodyA} ${a.aspect} ${a.bodyB} (${a.orb.toFixed(1)}°${a.orbTier === 'core_structural' ? ' CORE' : ''})`
        ),
    };
    return `VERIFIED WESTERN TROPICAL CHART JSON:\n${JSON.stringify(compactWestern)}`;
  }

  // Canonical Vedic JSON (complete 16 Vargas, Shadbala, Bhinna+Sarva Ashtakavarga, KP, Jaimini, Lal Kitab, Panchang, Dashas)
  const signShort = (s: string) => s.slice(0, 3);
  const nowYear = new Date().getUTCFullYear();

  const vargasCompact: Record<string, string> = {};
  for (const divKey of ['D1', 'D2', 'D3', 'D4', 'D7', 'D9', 'D10', 'D12', 'D16', 'D20', 'D24', 'D27', 'D30', 'D40', 'D45', 'D60']) {
    const v = enriched.vargas[divKey];
    if (!v) continue;
    vargasCompact[divKey] = v.placements
      .map((pl) => `${pl.name === 'Ascendant' ? 'Asc' : pl.name.slice(0, 2)}:${signShort(pl.sign)}(H${pl.house})`)
      .join(' ');
  }

  const bhinnaCompact: Record<string, number[]> = {};
  for (const [pl, arr] of Object.entries(enriched.ashtakavarga.bhinna || {})) {
    bhinnaCompact[pl.slice(0, 2)] = arr;
  }

  const savLabeled = enriched.ashtakavarga.sarva.map(
    (b, idx) => `${SIGNS[idx].slice(0, 3)}:${b}`
  );

  // Trim Vimshottari AD/PD detail to active MD + adjacent ±15yr window to preserve full 100-yr MD visibility while bounding tokens
  const vimCompact = {
    active: enriched.vimshottari?.currentStack || null,
    timeline: (enriched.vimshottari?.timeline || []).map((md) => {
      const mdStartY = Number(md.startDate.slice(0, 4));
      const mdEndY = Number(md.endDate.slice(0, 4));
      const isNearNow = mdEndY >= nowYear - 12 && mdStartY <= nowYear + 20;
      return {
        md: `${md.lord} (${md.startDate}..${md.endDate})`,
        ...(isNearNow && md.children
          ? {
              ads: md.children.map((ad) => {
                const adStartY = Number(ad.startDate.slice(0, 4));
                const adEndY = Number(ad.endDate.slice(0, 4));
                const isAdNearNow = adEndY >= nowYear - 2 && adStartY <= nowYear + 5;
                return {
                  ad: `${ad.lord} (${ad.startDate}..${ad.endDate})`,
                  ...(isAdNearNow && ad.children
                    ? { pds: ad.children.map((pd) => `${pd.lord}:${pd.startDate}..${pd.endDate}`) }
                    : {}),
                };
              }),
            }
          : {}),
      };
    }),
  };

  const compactVedic = {
    system: 'Vedic Sidereal (Lahiri + KP Placidus + Jaimini + Lal Kitab)',
    profile: {
      name: enriched.meta.name,
      dob: enriched.meta.birthDate,
      tob: enriched.meta.birthTime,
      place: enriched.meta.location.locationLabel,
      lat: Number(enriched.meta.location.latitude.toFixed(4)),
      lon: Number(enriched.meta.location.longitude.toFixed(4)),
      tz: enriched.meta.location.timezoneOffset,
    },
    panchang: enriched.panchang
      ? {
          vara: enriched.panchang.vara,
          tithi: `${enriched.panchang.tithi.number}:${enriched.panchang.tithi.name}`,
          yoga: enriched.panchang.yoga.name,
          karana: enriched.panchang.karana,
          avakhada: enriched.panchang.avakhada,
        }
      : undefined,
    d1: enriched.planets.map((p) => {
      const cond = enriched.conditions?.find((c) => c.planet === p.name);
      return {
        b: p.name,
        h: p.house,
        s: `${signShort(p.sign)} ${p.dms}`,
        nak: `${p.nakshatra}(P${p.pada},${p.nakshatraLord.slice(0, 2)})`,
        sub: `${p.subLord.slice(0, 2)}/${p.subSubLord.slice(0, 2)}`,
        dig: p.dignity,
        ...(p.isRetrograde ? { rx: true } : {}),
        ...(cond?.isCombust ? { combust: true } : {}),
        ...(cond?.isVargottama ? { vargottama: true } : {}),
        ...(cond ? { avastha: `${cond.baladiAvastha.split(' ')[0]}/${cond.jagradadiAvastha.split(' ')[0]}`, asp: cond.aspectsHouses } : {}),
      };
    }),
    vargas_d1_d60: vargasCompact,
    kp: {
      cusps: enriched.kp.cusps.map(
        (c) => `H${c.house}:${signShort(c.sign)} ${c.dms} [RL:${c.signLord.slice(0, 2)} SL:${c.starLord.slice(0, 2)} Sub:${c.subLord.slice(0, 2)}]`
      ),
      significators: enriched.kp.significators.map(
        (s) => `${s.planet.slice(0, 2)} occ:H${s.occupiesHouse} owns:[${s.ownsHouses.join(',')}] SL:${s.starLord.slice(0, 2)} Sub:${s.subLord.slice(0, 2)} -> [${s.signifiesHouses.join(',')}]`
      ),
      rulingPlanets: enriched.kp.rulingPlanets?.uniqueRulingPlanets,
    },
    jaimini: {
      karakamsha: enriched.jaimini.karakamshaSign,
      karakas: enriched.jaimini.karakas.map((k) => `${k.code}:${k.planet}(${signShort(k.sign)} ${k.dms})`),
      arudhas: enriched.jaimini.arudhaPadas?.map((a) => `${a.code}:${signShort(a.padaSign)}(H${a.padaHouseFromLagna})`),
      charaDashaCurrent: enriched.jaimini.charaDasha?.currentPeriod
        ? `${enriched.jaimini.charaDasha.currentPeriod.sign} (${enriched.jaimini.charaDasha.currentPeriod.startDate}..${enriched.jaimini.charaDasha.currentPeriod.endDate})`
        : undefined,
      charaDashaAll: enriched.jaimini.charaDasha?.periods.map((c) => `${signShort(c.sign)}(${c.years}y:${c.startDate})`),
      argala: enriched.jaimini.argala?.map((ag) => `H${ag.targetHouse}:${ag.netSupport}`),
    },
    ashtakavarga: {
      total: enriched.ashtakavarga.totalBindus,
      sarva: savLabeled,
      bhinna: bhinnaCompact,
    },
    shadbala: enriched.shadbala
      ? {
          strongest: enriched.shadbala.strongestPlanet,
          weakest: enriched.shadbala.weakestPlanet,
          rows: enriched.shadbala.planets.map((r) => ({
            p: r.planet,
            rupas: r.totalRupas,
            min: r.requiredRupas,
            ratio: r.ratio,
            sthana: r.sthanaBala,
            dig: r.digBala,
            kala: r.kalaBala,
            chesta: r.chestaBala,
            nais: r.naisargikaBala,
            drik: r.drikBala,
            ishta: r.ishtaPhala,
            kashta: r.kashtaPhala,
          })),
        }
      : undefined,
    lalKitab: enriched.lalKitab
      ? {
          andhiKundli: enriched.lalKitab.isAndhiKundli,
          dharmiTewa: enriched.lalKitab.isDharmiTewa,
          sleepingHouses: enriched.lalKitab.sleepingHouses,
          activeDebts: enriched.lalKitab.karmicDebts.filter((d) => d.active).map((d) => d.name),
          planets: enriched.lalKitab.planets.map((lp) => `${lp.planet}:H${lp.house}(${lp.status})`),
          varshaphalYear: enriched.lalKitab.varshaphal.runningAge,
          varshaphalCycle: enriched.lalKitab.varshaphal.cycleYear,
        }
      : undefined,
    yogas: enriched.scoredYogas
      ? enriched.scoredYogas.map((y) => `${y.name} [${y.status}, YSI:${y.ysiTotal}/110]`)
      : enriched.yogas?.map((y) => `${y.name} [${y.planets.join('+')}]`),
    vedicPrecision: {
      ascMaturity: enriched.ascendantMaturity
        ? `${enriched.ascendantMaturity.sign} ${enriched.ascendantMaturity.degreeInSign}° (${enriched.ascendantMaturity.maturityBand}${enriched.ascendantMaturity.birthTimeSensitivityWarning ? ', SANDHI/SENSITIVE' : ''})`
        : undefined,
      induLagna: enriched.specialPoints
        ? `${enriched.specialPoints.induLagna.sign}(H${enriched.specialPoints.induLagna.houseFromLagna}, L:${enriched.specialPoints.induLagna.lord})`
        : undefined,
      shriLagna: enriched.specialPoints
        ? `${enriched.specialPoints.shriLagna.sign}(H${enriched.specialPoints.shriLagna.houseFromLagna})`
        : undefined,
      kharaPoints: enriched.specialPoints
        ? {
            nav64Moon: `${enriched.specialPoints.khara64NavamsaMoon.sign}(L:${enriched.specialPoints.khara64NavamsaMoon.lord})`,
            drekk22Lagna: `${enriched.specialPoints.khara22DrekkanaLagna.sign}(L:${enriched.specialPoints.khara22DrekkanaLagna.lord})`,
          }
        : undefined,
      chalitShifts: enriched.bhavaChalit?.shifts
        .filter((s) => s.shifted)
        .map((s) => `${s.planet}:R${s.rashiHouse}->C${s.chalitHouse}`),
      planetaryHealth: enriched.planetaryHealth?.map((h) => `${h.planet}:${h.totalScore}(${h.tier})`),
      badhaka: enriched.structuralFlags
        ? `H${enriched.structuralFlags.badhaka.badhakaHouse} (${enriched.structuralFlags.badhaka.badhakesh} in H${enriched.structuralFlags.badhaka.badhakeshHouse})`
        : undefined,
      kendradhipati: enriched.structuralFlags?.kendradhipati
        .filter((k) => k.isActive)
        .map((k) => `${k.planet}(H${k.kendraHousesOwned.join('/')}${k.mitigated ? ',mitigated' : ''})`),
      activeDoshas: enriched.structuralFlags?.doshas
        .filter((d) => d.active)
        .map((d) => `${d.name}(sev:${d.severity}${d.cancelledOrMitigated ? ',mitigated' : ''})`),
      finalDispositors: enriched.dispositorChain?.finalDispositors,
    },
    vimshottari: vimCompact,
  };

  return `VERIFIED CANONICAL VEDIC CHART JSON:\n${JSON.stringify(compactVedic)}`;
}
