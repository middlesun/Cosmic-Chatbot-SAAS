import {
  buildApiPayload,
  fetchChartFromApi,
  geocodeBirthLocation,
  type BirthLocationResolved,
} from './astrologyApi';
import {
  computeAshtakavarga,
  computeDivisionalCharts,
  computeJaiminiKarakas,
  computeKPPlacidusCusps,
  computeKPSignificators,
  computeVimshottariTimeline,
  type AshtakavargaTable,
  type DashaNode,
  type JaiminiKaraka,
  type KPCusp,
  type KPSignificatorRow,
  type PlanetPosition,
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
  };
  jaimini: {
    karakas: JaiminiKaraka[];
    karakamshaSign: string;
  };
  ashtakavarga: AshtakavargaTable;
  vimshottari: {
    timeline: DashaNode[];
    currentStack: {
      mahadasha: string;
      antardasha: string;
      pratyantardasha: string;
      mdEnd: string;
      adEnd: string;
      pdEnd: string;
    } | null;
  };
  shadBalaSummary: unknown;
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
    typeof input.longitude === 'number' &&
    typeof input.timezoneOffset === 'number'
  ) {
    location = {
      latitude: input.latitude,
      longitude: input.longitude,
      timezoneOffset: input.timezoneOffset,
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
  const jaimini = computeJaiminiKarakas(planets);
  const ashtakavarga = computeAshtakavarga(planets);
  const vimshottari = computeVimshottariTimeline(
    moon ? moon.longitude : 0,
    input.birthDate,
    input.birthTime,
    location.timezoneOffset
  );

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
    },
    jaimini,
    ashtakavarga,
    vimshottari,
    shadBalaSummary: apiData.apiShadBala ?? null,
  };

  const chartTextContext = formatChartForLLM(chartJson);

  return {
    location,
    chartJson,
    chartTextContext,
  };
}

export function formatChartForLLM(chart: CompiledChartData): string {
  const lines: string[] = [];

  lines.push(`=== CANONICAL VEDIC BIRTH CHART: ${chart.meta.name} ===`);
  lines.push(
    `Birth: ${chart.meta.birthDate} at ${chart.meta.birthTime} | Place: ${chart.meta.location.locationLabel} (${chart.meta.location.latitude.toFixed(4)}, ${chart.meta.location.longitude.toFixed(4)}, UTC${chart.meta.location.timezoneOffset >= 0 ? '+' : ''}${chart.meta.location.timezoneOffset})`
  );
  lines.push(`System Standard: ${chart.meta.ayanamsha}`);
  lines.push('');

  lines.push('--- D1 (RASI / LAGNA) PLANETARY POSITIONS ---');
  for (const p of chart.planets) {
    lines.push(
      `${p.name.padEnd(10)} | H${String(p.house).padStart(2, '0')} | ${p.sign.padEnd(11)} ${p.dms} | ${p.nakshatra} (P${p.pada}, Lord: ${p.nakshatraLord}) | Sub: ${p.subLord} | ${p.dignity}${p.isRetrograde ? ' [R]' : ''}`
    );
  }
  lines.push('');

  lines.push('--- KEY DIVISIONAL CHARTS (VARGAS) ---');
  for (const divKey of ['D9', 'D10', 'D7', 'D12', 'D3', 'D4', 'D30', 'D60']) {
    const v = chart.vargas[divKey];
    if (!v) continue;
    const placements = v.placements
      .map((pl) => `${pl.name}: ${pl.sign.slice(0, 3)}(H${pl.house})`)
      .join(', ');
    lines.push(`${divKey}: ${placements}`);
  }
  lines.push('');

  lines.push('--- KP SYSTEM: PLACIDUS HOUSE CUSPS & SUB-LORDS ---');
  for (const c of chart.kp.cusps) {
    lines.push(
      `Cusp ${String(c.house).padStart(2, '0')}: ${c.sign.padEnd(11)} ${c.dms} | Sign: ${c.signLord} | Star: ${c.starLord} | Sub: ${c.subLord}`
    );
  }
  lines.push('');

  lines.push('--- KP PLANETARY SIGNIFICATORS (ABCD) ---');
  for (const s of chart.kp.significators) {
    lines.push(
      `${s.planet.padEnd(8)} | Occ: H${s.occupiesHouse} | Owns: [${s.ownsHouses.join(',')}] | StarLord: ${s.starLord} (Occ H${s.starLordOccupies}, Owns [${s.starLordOwns.join(',')}]) | Sub: ${s.subLord} | Signifies: [${s.signifiesHouses.join(',')}]`
    );
  }
  lines.push('');

  lines.push(`--- JAIMINI CHARA KARAKAS (Karakamsha: ${chart.jaimini.karakamshaSign}) ---`);
  for (const k of chart.jaimini.karakas) {
    lines.push(`${k.code.padEnd(4)} (${k.title}): ${k.planet} in ${k.sign} ${k.dms}`);
  }
  lines.push('');

  lines.push(`--- SARVASHTAKAVARGA (Total Bindus: ${chart.ashtakavarga.totalBindus}) ---`);
  lines.push(
    chart.ashtakavarga.sarva
      .map((b, idx) => `${['Ari', 'Tau', 'Gem', 'Can', 'Leo', 'Vir', 'Lib', 'Sco', 'Sag', 'Cap', 'Aqu', 'Pis'][idx]}:${b}`)
      .join(' | ')
  );
  lines.push('');

  lines.push('--- VIMSHOTTARI DASHA TIMELINE ---');
  if (chart.vimshottari.currentStack) {
    const cs = chart.vimshottari.currentStack;
    lines.push(
      `CURRENT ACTIVE: ${cs.mahadasha} MD (until ${cs.mdEnd}) -> ${cs.antardasha} AD (until ${cs.adEnd}) -> ${cs.pratyantardasha} PD (until ${cs.pdEnd})`
    );
  }
  for (const md of chart.vimshottari.timeline) {
    lines.push(`MD ${md.lord}: ${md.startDate} to ${md.endDate}`);
    const ads = (md.children || [])
      .map((ad) => `${ad.lord}(${ad.startDate}..${ad.endDate})`)
      .join(', ');
    lines.push(`  ADs: ${ads}`);
  }

  return lines.join('\n');
}
