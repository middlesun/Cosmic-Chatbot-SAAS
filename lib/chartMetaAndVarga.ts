import type { CompiledChartJson, PlanetPosition } from '../components/app/ChartViewer';

export const VEDIC_SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

export const VEDIC_SIGNS_SHORT = [
  'Ari',
  'Tau',
  'Gem',
  'Can',
  'Leo',
  'Vir',
  'Lib',
  'Sco',
  'Sag',
  'Cap',
  'Aqu',
  'Pis',
] as const;

export const SIGN_LORDS = [
  'Mars',
  'Venus',
  'Mercury',
  'Moon',
  'Sun',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Saturn',
  'Jupiter',
] as const;

export const SHODASHVARGA_DEFS: Array<{ code: string; division: number; name: string; focus: string }> = [
  { code: 'D1', division: 1, name: 'Lagna (Rasi)', focus: 'Physical body, destiny & overall chart' },
  { code: 'D2', division: 2, name: 'Hora', focus: 'Wealth, resources & sustenance' },
  { code: 'D3', division: 3, name: 'Drekkana', focus: 'Siblings, courage & initiative' },
  { code: 'D4', division: 4, name: 'Chaturthamsa', focus: 'Home, property & fortune' },
  { code: 'D7', division: 7, name: 'Saptamsa', focus: 'Children & creative legacy' },
  { code: 'D9', division: 9, name: 'Navamsha', focus: 'Marriage, dharma & inner strength' },
  { code: 'D10', division: 10, name: 'Dashamamsa', focus: 'Career, vocation & public standing' },
  { code: 'D12', division: 12, name: 'Dwadashamsa', focus: 'Parents & ancestral lineage' },
  { code: 'D16', division: 16, name: 'Shodashamsa', focus: 'Vehicles, comforts & inner happiness' },
  { code: 'D20', division: 20, name: 'Vimshamsa', focus: 'Spiritual practice & devotion' },
  { code: 'D24', division: 24, name: 'Chaturvimshamsa', focus: 'Learning, scholarship & wisdom' },
  { code: 'D27', division: 27, name: 'Saptavimshamsa', focus: 'Stamina, vitality & resilience' },
  { code: 'D30', division: 30, name: 'Trimshamsa', focus: 'Subconscious challenges & protections' },
  { code: 'D40', division: 40, name: 'Khavedamsa', focus: 'Maternal heritage & subtle fortune' },
  { code: 'D45', division: 45, name: 'Akshavedamsa', focus: 'Paternal heritage & ethics' },
  { code: 'D60', division: 60, name: 'Shashtiamsa', focus: 'Karmic roots & subtle fruition' },
];

const VIMSHOTTARI_CYCLE: Array<{ lord: string; years: number }> = [
  { lord: 'Ketu', years: 7 },
  { lord: 'Venus', years: 20 },
  { lord: 'Sun', years: 6 },
  { lord: 'Moon', years: 10 },
  { lord: 'Mars', years: 7 },
  { lord: 'Rahu', years: 18 },
  { lord: 'Jupiter', years: 16 },
  { lord: 'Saturn', years: 19 },
  { lord: 'Mercury', years: 17 },
];

const VARA_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function getVargaSignIndex(siderealLon: number, division: number): number {
  const lon = normalizeDeg(siderealLon);
  const signIdx = Math.floor(lon / 30);
  const deg = lon % 30;
  const part = Math.floor((deg * division) / 30);

  switch (division) {
    case 1:
      return signIdx;
    case 2: {
      const isOdd = signIdx % 2 === 0;
      const firstHalf = deg < 15;
      return isOdd ? (firstHalf ? 4 : 3) : firstHalf ? 3 : 4;
    }
    case 3:
      return (signIdx + part * 4) % 12;
    case 4:
      return (signIdx + part * 3) % 12;
    case 7: {
      const start = signIdx % 2 === 0 ? signIdx : (signIdx + 6) % 12;
      return (start + part) % 12;
    }
    case 9: {
      const modality = signIdx % 3;
      const start = modality === 0 ? signIdx : modality === 1 ? (signIdx + 8) % 12 : (signIdx + 4) % 12;
      return (start + part) % 12;
    }
    case 10: {
      const start = signIdx % 2 === 0 ? signIdx : (signIdx + 8) % 12;
      return (start + part) % 12;
    }
    case 12:
      return (signIdx + part) % 12;
    case 16: {
      const start = (signIdx % 3) * 4;
      return (start + part) % 12;
    }
    case 20: {
      const m = signIdx % 3;
      const start = m === 0 ? 0 : m === 1 ? 8 : 4;
      return (start + part) % 12;
    }
    case 24: {
      const start = signIdx % 2 === 0 ? 4 : 3;
      return (start + part) % 12;
    }
    case 27: {
      const start = (signIdx % 4) * 3;
      return (start + part) % 12;
    }
    case 30: {
      const isOdd = signIdx % 2 === 0;
      if (isOdd) {
        if (deg < 5) return 0;
        if (deg < 10) return 10;
        if (deg < 18) return 8;
        if (deg < 25) return 2;
        return 6;
      }
      if (deg < 5) return 1;
      if (deg < 12) return 5;
      if (deg < 20) return 11;
      if (deg < 25) return 9;
      return 7;
    }
    case 40: {
      const start = signIdx % 2 === 0 ? 0 : 6;
      return (start + part) % 12;
    }
    case 45: {
      const start = (signIdx % 3) * 4;
      return (start + part) % 12;
    }
    case 60:
      return (signIdx + part) % 12;
    default: {
      const start = (signIdx * division) % 12;
      return (start + part) % 12;
    }
  }
}

export function computeAllVargasFromPlanets(
  planets: PlanetPosition[]
): Record<
  string,
  {
    ascendantSignIndex: number;
    placements: Array<{ name: string; signIndex: number; sign: string; house: number }>;
  }
> {
  const result: Record<
    string,
    {
      ascendantSignIndex: number;
      placements: Array<{ name: string; signIndex: number; sign: string; house: number }>;
    }
  > = {};
  const asc = planets.find((p) => p.name === 'Ascendant');
  const ascLon = asc ? asc.longitude : 0;

  for (const def of SHODASHVARGA_DEFS) {
    const ascSign = getVargaSignIndex(ascLon, def.division);
    const placements = planets.map((p) => {
      const sIdx = getVargaSignIndex(p.longitude, def.division);
      const house = ((sIdx - ascSign + 12) % 12) + 1;
      return {
        name: p.name,
        signIndex: sIdx,
        sign: VEDIC_SIGNS[sIdx],
        house,
      };
    });
    result[def.code] = {
      ascendantSignIndex: ascSign,
      placements,
    };
  }
  return result;
}

/**
 * Ensures all 16 divisional charts exist even if older Supabase chart_json
 * or fixture payloads only stored a subset.
 */
export function resolveCompleteVargas(
  chart: CompiledChartJson
): Record<
  string,
  {
    ascendantSignIndex: number;
    placements: Array<{ name: string; signIndex: number; sign: string; house: number }>;
  }
> {
  const computed = computeAllVargasFromPlanets(chart.planets || []);
  return {
    ...computed,
    ...(chart.vargas || {}),
  };
}

function toJulianDay(year: number, month: number, day: number, hourFloatUTC: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    hourFloatUTC / 24 +
    B -
    1524.5
  );
}

function formatHMS(hoursFloat: number): string {
  const norm = ((hoursFloat % 24) + 24) % 24;
  const h = Math.floor(norm);
  const mFloat = (norm - h) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60);
  const carryM = s === 60 ? m + 1 : m;
  const finalS = s === 60 ? 0 : s;
  const finalH = carryM === 60 ? (h + 1) % 24 : h;
  const finalM = carryM === 60 ? 0 : carryM;
  return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}:${String(finalS).padStart(2, '0')}`;
}

function formatAyanamshaDms(deg: number): string {
  const d = Math.floor(deg);
  const mFloat = (deg - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60);
  return `${String(d).padStart(3, '0')}-${String(m).padStart(2, '0')}-${String(s).padStart(2, '0')}`;
}

function formatCoordinate(val: number, posHem: string, negHem: string): string {
  const abs = Math.abs(val);
  const d = Math.floor(abs);
  const m = Math.round((abs - d) * 60);
  return `${String(d).padStart(2, '0')}°${String(m).padStart(2, '0')}′ ${val >= 0 ? posHem : negHem}`;
}

function computeSunriseSunset(
  year: number,
  month: number,
  day: number,
  lat: number,
  lon: number,
  tzOffset: number
): { sunrise: string; sunset: string } {
  // NOAA solar calculation at local noon
  const startOfYear = Date.UTC(year, 0, 0);
  const targetDay = Date.UTC(year, month - 1, day);
  const dayOfYear = Math.round((targetDay - startOfYear) / 86400000);
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1);

  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const latRad = (lat * Math.PI) / 180;
  const zenithRad = (90.833 * Math.PI) / 180;
  const cosHa =
    Math.cos(zenithRad) / (Math.cos(latRad) * Math.cos(decl)) - Math.tan(latRad) * Math.tan(decl);

  if (cosHa > 1 || cosHa < -1) {
    return { sunrise: '—', sunset: '—' };
  }
  const haDeg = (Math.acos(cosHa) * 180) / Math.PI;
  const sunriseMinutes = 720 - 4 * (lon + haDeg) - eqTime + tzOffset * 60;
  const sunsetMinutes = 720 - 4 * (lon - haDeg) - eqTime + tzOffset * 60;

  return {
    sunrise: formatHMS(sunriseMinutes / 60),
    sunset: formatHMS(sunsetMinutes / 60),
  };
}

function computeBalanceOfDasha(moonLongitude: number): string {
  const lon = normalizeDeg(moonLongitude);
  const nakSpan = 360 / 27;
  const nakIdx = Math.floor(lon / nakSpan) % 27;
  const elapsedFraction = (lon - nakIdx * nakSpan) / nakSpan;
  const remainingFraction = 1 - elapsedFraction;
  const lordEntry = VIMSHOTTARI_CYCLE[nakIdx % 9];

  const totalDays = remainingFraction * lordEntry.years * 365.25;
  const years = Math.floor(totalDays / 365.25);
  const remAfterYears = totalDays - years * 365.25;
  const months = Math.floor(remAfterYears / 30.4375);
  const days = Math.round(remAfterYears - months * 30.4375);

  return `${lordEntry.lord} ${years}Y ${months}M ${days}D`;
}

export interface TraditionalBirthMeta {
  name: string;
  sex: string;
  birthDate: string;
  dayOfWeek: string;
  birthTime: string;
  place: string;
  longitudeLabel: string;
  latitudeLabel: string;
  julianDay: string;
  ayanType: string;
  ayanamshaDms: string;
  siderealTime: string;
  sunrise: string;
  sunset: string;
  ascendant: string;
  ascLord: string;
  rasi: string;
  rasiLord: string;
  starPada: string;
  starLord: string;
  balanceOfDasha: string;
  yoga: string;
  tithi: string;
  karan: string;
}

export function computeTraditionalBirthMeta(
  chart: CompiledChartJson,
  gender?: string | null
): TraditionalBirthMeta {
  const [y, m, d] = (chart.meta.birthDate || '2000-01-01').split('-').map(Number);
  const timeParts = (chart.meta.birthTime || '12:00:00').split(':').map(Number);
  const localHours = (timeParts[0] || 0) + (timeParts[1] || 0) / 60 + (timeParts[2] || 0) / 3600;
  const tzOffset = chart.meta.location?.timezoneOffset ?? 5.5;
  const lat = chart.meta.location?.latitude ?? 19.076;
  const lon = chart.meta.location?.longitude ?? 72.8777;

  const jd = toJulianDay(y || 2000, m || 1, d || 1, localHours - tzOffset);
  const t = (jd - 2451545.0) / 36525.0;
  const ayanamshaVal = 23.85708 + 1.39697128 * t + 0.0003086 * t * t;

  const gmstDeg = normalizeDeg(
    280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - (t * t * t) / 38710000
  );
  const localSiderealDeg = normalizeDeg(gmstDeg + lon);
  const siderealHours = localSiderealDeg / 15;

  const { sunrise, sunset } = computeSunriseSunset(y || 2000, m || 1, d || 1, lat, lon, tzOffset);
  const weekday = new Date(Date.UTC(y || 2000, (m || 1) - 1, d || 1)).getUTCDay();

  const asc = chart.planets.find((p) => p.name === 'Ascendant');
  const moon = chart.planets.find((p) => p.name === 'Moon');
  const ascSignIdx = asc?.signIndex ?? 0;
  const moonSignIdx = moon?.signIndex ?? 0;

  const normalizedGender = (gender || '').trim().toLowerCase();
  const sexDisplay =
    normalizedGender === 'female' || normalizedGender === 'f'
      ? 'Female'
      : normalizedGender === 'male' || normalizedGender === 'm'
      ? 'Male'
      : normalizedGender
      ? normalizedGender.charAt(0).toUpperCase() + normalizedGender.slice(1)
      : '—';

  const yogaRaw = chart.panchang?.yoga?.name || '—';
  const tithiRaw = chart.panchang?.tithi?.name || '—';
  const karanRaw = chart.panchang?.karana || '—';

  return {
    name: chart.meta.name,
    sex: sexDisplay,
    birthDate: chart.meta.birthDate,
    dayOfWeek: VARA_NAMES[weekday] || '—',
    birthTime: chart.meta.birthTime,
    place: chart.meta.location?.locationLabel || '—',
    longitudeLabel: formatCoordinate(lon, 'E', 'W'),
    latitudeLabel: formatCoordinate(lat, 'N', 'S'),
    julianDay: jd.toFixed(0),
    ayanType: chart.meta.ayanamsha?.split('(')[0]?.trim() || 'Lahiri',
    ayanamshaDms: formatAyanamshaDms(ayanamshaVal),
    siderealTime: formatHMS(siderealHours),
    sunrise,
    sunset,
    ascendant: asc?.sign || '—',
    ascLord: SIGN_LORDS[ascSignIdx] || '—',
    rasi: moon?.sign || '—',
    rasiLord: SIGN_LORDS[moonSignIdx] || '—',
    starPada: moon ? `${moon.nakshatra}-${moon.pada}` : '—',
    starLord: moon?.nakshatraLord || '—',
    balanceOfDasha: moon ? computeBalanceOfDasha(moon.longitude) : '—',
    yoga: yogaRaw,
    tithi: tithiRaw,
    karan: karanRaw,
  };
}

export interface JaiminiChartPair {
  karakamshaSignIndex: number;
  karakamshaSign: string;
  karakamshaPlacements: Array<{ name: string; signIndex: number; sign: string; house: number }>;
  swamsaPlacements: Array<{ name: string; signIndex: number; sign: string; house: number }>;
}

export function buildJaiminiChartPair(chart: CompiledChartJson): JaiminiChartPair {
  const allVargas = resolveCompleteVargas(chart);
  const d1 = allVargas.D1;
  const d9 = allVargas.D9;

  const signIdxFromName = VEDIC_SIGNS.findIndex(
    (s) => s.toLowerCase() === (chart.jaimini?.karakamshaSign || '').toLowerCase()
  );
  const akPlanet = chart.jaimini?.karakas?.[0]?.planet;
  const akD9 = akPlanet ? d9?.placements?.find((p) => p.name === akPlanet) : undefined;
  const karakamshaSignIndex =
    signIdxFromName >= 0 ? signIdxFromName : akD9 ? akD9.signIndex : 0;

  const reorient = (
    placements: Array<{ name: string; signIndex: number; sign: string; house: number }>
  ) =>
    placements.map((p) => ({
      name: p.name,
      signIndex: p.signIndex,
      sign: p.sign,
      house: ((p.signIndex - karakamshaSignIndex + 12) % 12) + 1,
    }));

  return {
    karakamshaSignIndex,
    karakamshaSign: VEDIC_SIGNS[karakamshaSignIndex],
    karakamshaPlacements: reorient(d1?.placements || []),
    swamsaPlacements: reorient(d9?.placements || []),
  };
}
