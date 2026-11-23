// Pure deterministic Vedic Astrology (Parashari, KP, Jaimini, Ashtakavarga, Vimshottari) math
// Derived from Sidereal Lahiri planetary longitudes & birth coordinates.
import type { TimingProgressWidget, TimingWidgetId } from '../../lib/vedicTypes';

export const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

export const SIGN_ABBR = [
  'Ari', 'Tau', 'Gem', 'Can', 'Leo', 'Vir',
  'Lib', 'Sco', 'Sag', 'Cap', 'Aqu', 'Pis',
] as const;

export const SIGN_LORDS = [
  'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
] as const;

export const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
] as const;

export const VIMSHOTTARI_ORDER = [
  { lord: 'Ketu', years: 7 },
  { lord: 'Venus', years: 20 },
  { lord: 'Sun', years: 6 },
  { lord: 'Moon', years: 10 },
  { lord: 'Mars', years: 7 },
  { lord: 'Rahu', years: 18 },
  { lord: 'Jupiter', years: 16 },
  { lord: 'Saturn', years: 19 },
  { lord: 'Mercury', years: 17 },
] as const;

export const PLANET_SHORT: Record<string, string> = {
  Ascendant: 'As',
  Sun: 'Su',
  Moon: 'Mo',
  Mars: 'Ma',
  Mercury: 'Me',
  Jupiter: 'Ju',
  Venus: 'Ve',
  Saturn: 'Sa',
  Rahu: 'Ra',
  Ketu: 'Ke',
};

export interface PlanetPosition {
  name: string;
  longitude: number; // 0..360 sidereal
  signIndex: number; // 0..11
  sign: string;
  degreeInSign: number; // 0..30
  dms: string;
  nakshatra: string;
  nakshatraIndex: number;
  nakshatraLord: string;
  pada: number; // 1..4
  subLord: string;
  subSubLord: string;
  isRetrograde: boolean;
  house: number; // 1..12 whole-sign relative to Ascendant
  dignity: string;
}

export interface KPCusp {
  house: number; // 1..12
  longitude: number;
  signIndex: number;
  sign: string;
  degreeInSign: number;
  dms: string;
  signLord: string;
  nakshatra: string;
  starLord: string;
  subLord: string;
}

export interface KPSignificatorRow {
  planet: string;
  occupiesHouse: number;
  ownsHouses: number[];
  starLord: string;
  starLordOccupies: number;
  starLordOwns: number[];
  subLord: string;
  signifiesHouses: number[];
}

export interface JaiminiKaraka {
  code: string;
  title: string;
  planet: string;
  degreeInSign: number;
  dms: string;
  sign: string;
}

export interface DashaNode {
  lord: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  level: 'mahadasha' | 'antardasha' | 'pratyantardasha';
  children?: DashaNode[];
}

export interface AshtakavargaTable {
  bhinna: Record<string, number[]>; // 7 planets -> 12 sign bindus (index 0 = Aries)
  sarva: number[]; // 12 sign totals (index 0 = Aries)
  totalBindus: number;
}

export function normalizeDeg(deg: number): number {
  const m = deg % 360;
  return m < 0 ? m + 360 : m;
}

export function formatDMS(deg: number): string {
  const d = Math.floor(deg);
  const remMin = (deg - d) * 60;
  const m = Math.floor(remMin);
  const s = Math.round((remMin - m) * 60);
  const adjM = s === 60 ? m + 1 : m;
  const adjS = s === 60 ? 0 : s;
  const adjD = adjM === 60 ? d + 1 : d;
  const finalM = adjM === 60 ? 0 : adjM;
  return `${String(adjD).padStart(2, '0')}°${String(finalM).padStart(2, '0')}'${String(adjS).padStart(2, '0')}"`;
}

export function getNakshatraAndSubs(siderealLon: number): {
  nakshatraIndex: number;
  nakshatra: string;
  nakshatraLord: string;
  pada: number;
  subLord: string;
  subSubLord: string;
} {
  const lon = normalizeDeg(siderealLon);
  const nakSpan = 360 / 27; // 13.333333...
  const padaSpan = nakSpan / 4; // 3.333333...

  const nakIdx = Math.floor(lon / nakSpan) % 27;
  const offsetInNak = lon - nakIdx * nakSpan;
  const pada = Math.min(4, Math.floor(offsetInNak / padaSpan) + 1);

  const startLordIdx = nakIdx % 9;
  const nakLord = VIMSHOTTARI_ORDER[startLordIdx].lord;

  // Sub-lord proportional division within 13°20'
  let acc = 0;
  let subLord = nakLord;
  let subStart = 0;
  let subSpan = nakSpan;

  for (let i = 0; i < 9; i++) {
    const entry = VIMSHOTTARI_ORDER[(startLordIdx + i) % 9];
    const span = (entry.years / 120) * nakSpan;
    if (offsetInNak <= acc + span + 1e-9 || i === 8) {
      subLord = entry.lord;
      subStart = acc;
      subSpan = span;
      break;
    }
    acc += span;
  }

  // Sub-sub-lord proportional division inside sub-lord arc
  const subIdx = VIMSHOTTARI_ORDER.findIndex((x) => x.lord === subLord);
  const offsetInSub = Math.max(0, offsetInNak - subStart);
  let subSubLord = subLord;
  let acc2 = 0;
  for (let i = 0; i < 9; i++) {
    const entry = VIMSHOTTARI_ORDER[(subIdx + i) % 9];
    const span2 = (entry.years / 120) * subSpan;
    if (offsetInSub <= acc2 + span2 + 1e-9 || i === 8) {
      subSubLord = entry.lord;
      break;
    }
    acc2 += span2;
  }

  return {
    nakshatraIndex: nakIdx,
    nakshatra: NAKSHATRAS[nakIdx],
    nakshatraLord: nakLord,
    pada,
    subLord,
    subSubLord,
  };
}

// Exaltation/Debilitation/Own Sign dignity helper (Parashari)
const EXALT_SIGNS: Record<string, number> = {
  Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6, Rahu: 1, Ketu: 7,
};
const DEBIL_SIGNS: Record<string, number> = {
  Sun: 6, Moon: 7, Mars: 3, Mercury: 11, Jupiter: 9, Venus: 5, Saturn: 0, Rahu: 7, Ketu: 1,
};
const OWN_SIGNS: Record<string, number[]> = {
  Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11], Venus: [1, 6], Saturn: [9, 10], Rahu: [10], Ketu: [7],
};

export function getDignity(planet: string, signIndex: number): string {
  if (planet === 'Ascendant') return 'Lagna';
  if (EXALT_SIGNS[planet] === signIndex) return 'Exalted';
  if (DEBIL_SIGNS[planet] === signIndex) return 'Debilitated';
  if (OWN_SIGNS[planet]?.includes(signIndex)) return 'Own Sign';
  return 'Neutral';
}

// Exact BPHS Divisional Chart (Varga) mapping from sidereal longitude
export function getVargaSignIndex(siderealLon: number, division: number): number {
  const lon = normalizeDeg(siderealLon);
  const signIdx = Math.floor(lon / 30); // 0..11
  const deg = lon % 30;
  const part = Math.floor((deg * division) / 30); // 0..division-1

  switch (division) {
    case 1:
      return signIdx;
    case 2: {
      // Hora (Parashari): odd signs 0-15 Sun(Leo=4), 15-30 Moon(Can=3); even signs reverse
      const isOdd = signIdx % 2 === 0;
      const firstHalf = deg < 15;
      if (isOdd) return firstHalf ? 4 : 3;
      return firstHalf ? 3 : 4;
    }
    case 3: {
      // Drekkana: 1st, 5th, 9th from sign
      return (signIdx + part * 4) % 12;
    }
    case 4: {
      // Chaturthamsa: 1st, 4th, 7th, 10th from sign
      return (signIdx + part * 3) % 12;
    }
    case 7: {
      // Saptamsa: odd starts from same sign; even starts from 7th sign
      const start = signIdx % 2 === 0 ? signIdx : (signIdx + 6) % 12;
      return (start + part) % 12;
    }
    case 9: {
      // Navamsha: Movable (0,3,6,9)->same; Fixed (1,4,7,10)->9th; Dual (2,5,8,11)->5th
      const modality = signIdx % 3;
      const start = modality === 0 ? signIdx : modality === 1 ? (signIdx + 8) % 12 : (signIdx + 4) % 12;
      return (start + part) % 12;
    }
    case 10: {
      // Dasamsa: odd starts from same sign; even starts from 9th
      const start = signIdx % 2 === 0 ? signIdx : (signIdx + 8) % 12;
      return (start + part) % 12;
    }
    case 12: {
      // Dwadasamsa: starts from same sign
      return (signIdx + part) % 12;
    }
    case 16: {
      // Shodasamsa: Movable->Aries(0), Fixed->Leo(4), Dual->Sagittarius(8)
      const start = (signIdx % 3) * 4;
      return (start + part) % 12;
    }
    case 20: {
      // Vimsamsa: Movable->Aries(0), Fixed->Sag(8), Dual->Leo(4)
      const m = signIdx % 3;
      const start = m === 0 ? 0 : m === 1 ? 8 : 4;
      return (start + part) % 12;
    }
    case 24: {
      // Siddhamsa / Chaturvimsamsa: odd->Leo(4), even->Cancer(3)
      const start = signIdx % 2 === 0 ? 4 : 3;
      return (start + part) % 12;
    }
    case 27: {
      // Nakshatramsa / Bhamsha: Fire->Aries(0), Earth->Cancer(3), Air->Libra(6), Water->Capricorn(9)
      const start = (signIdx % 4) * 3;
      return (start + part) % 12;
    }
    case 30: {
      // Trimsamsa (standard BPHS unequal degrees)
      const isOdd = signIdx % 2 === 0;
      if (isOdd) {
        if (deg < 5) return 0; // Aries (Mars)
        if (deg < 10) return 10; // Aquarius (Saturn)
        if (deg < 18) return 8; // Sagittarius (Jupiter)
        if (deg < 25) return 2; // Gemini (Mercury)
        return 6; // Libra (Venus)
      } else {
        if (deg < 5) return 1; // Taurus (Venus)
        if (deg < 12) return 5; // Virgo (Mercury)
        if (deg < 20) return 11; // Pisces (Jupiter)
        if (deg < 25) return 9; // Capricorn (Saturn)
        return 7; // Scorpio (Mars)
      }
    }
    case 40: {
      // Khavedamsa: odd->Aries(0), even->Libra(6)
      const start = signIdx % 2 === 0 ? 0 : 6;
      return (start + part) % 12;
    }
    case 45: {
      // Akshavedamsa: Movable->Aries(0), Fixed->Leo(4), Dual->Sag(8)
      const start = (signIdx % 3) * 4;
      return (start + part) % 12;
    }
    case 60: {
      // Shashtyamsa: starts from same sign
      return (signIdx + part) % 12;
    }
    default: {
      const start = (signIdx * division) % 12;
      return (start + part) % 12;
    }
  }
}

export function computeDivisionalCharts(
  planets: PlanetPosition[],
  divisions = [1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60]
): Record<string, { ascendantSignIndex: number; placements: Array<{ name: string; signIndex: number; sign: string; house: number }> }> {
  const result: Record<string, { ascendantSignIndex: number; placements: Array<{ name: string; signIndex: number; sign: string; house: number }> }> = {};

  const asc = planets.find((p) => p.name === 'Ascendant');
  const ascLon = asc ? asc.longitude : 0;

  for (const div of divisions) {
    const ascSign = getVargaSignIndex(ascLon, div);
    const placements = planets.map((p) => {
      const sIdx = getVargaSignIndex(p.longitude, div);
      const house = ((sIdx - ascSign + 12) % 12) + 1;
      return {
        name: p.name,
        signIndex: sIdx,
        sign: SIGNS[sIdx],
        house,
      };
    });
    result[`D${div}`] = {
      ascendantSignIndex: ascSign,
      placements,
    };
  }

  return result;
}

// Julian Day & Placidus House Cusp Astronomical Calculation for KP System
export function toJulianDay(
  year: number,
  month: number,
  day: number,
  hourFloatUTC: number
): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  const jd =
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    hourFloatUTC / 24 +
    B -
    1524.5;
  return jd;
}

export function getLahiriAyanamsaApprox(jd: number): number {
  const t = (jd - 2451545.0) / 36525.0; // Julian centuries from J2000.0
  // Standard Chitrapaksha / Lahiri (~23°51'25" at J2000 + ~50.29"/year)
  return 23.85708 + 1.39697128 * t + 0.0003086 * t * t;
}

export function getKPAyanamsaApprox(jd: number): number {
  // KP New/Krishnamurti ayanamsa sits ~0°06' (0.10 deg) below Lahiri in modern era
  const t = (jd - 2451545.0) / 36525.0;
  return 23.7586 + 1.3965 * t;
}

export function computeKPPlacidusCusps(
  birthDateISO: string, // YYYY-MM-DD
  birthTimeStr: string, // HH:MM or HH:MM:SS
  timezoneOffsetHours: number,
  latitude: number,
  longitude: number,
  lahiriAscendantLongitude?: number
): KPCusp[] {
  const [y, m, d] = birthDateISO.split('-').map(Number);
  const timeParts = birthTimeStr.split(':').map(Number);
  const localHours = (timeParts[0] || 0) + (timeParts[1] || 0) / 60 + (timeParts[2] || 0) / 3600;
  const utcHours = localHours - timezoneOffsetHours;

  const jd = toJulianDay(y, m, d, utcHours);
  const t = (jd - 2451545.0) / 36525.0;

  // Mean obliquity of the ecliptic (radians)
  const epsDeg = 23.4392911 - 0.01300416 * t;
  const eps = (epsDeg * Math.PI) / 180;
  const latRad = (Math.max(-66, Math.min(66, latitude)) * Math.PI) / 180;

  // Greenwich Mean Sidereal Time in degrees
  const gmstDeg = normalizeDeg(
    280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - (t * t * t) / 38710000
  );
  const ramcDeg = normalizeDeg(gmstDeg + longitude);
  const ramc = (ramcDeg * Math.PI) / 180;

  // Tropical MC (House 10)
  const mcRad = Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps));
  const mcTrop = normalizeDeg((mcRad * 180) / Math.PI);

  // Tropical Ascendant (House 1)
  const ascRad = Math.atan2(
    Math.cos(ramc),
    -(Math.sin(ramc) * Math.cos(eps) + Math.tan(latRad) * Math.sin(eps))
  );
  const ascTrop = normalizeDeg((ascRad * 180) / Math.PI);

  // Iterative Placidus semi-arc cusp solver
  const solvePlacidus = (fraction: number, offsetDeg: number, isNocturnal: boolean): number => {
    let cusp = normalizeDeg(ramcDeg + offsetDeg);
    for (let iter = 0; iter < 12; iter++) {
      const ra = (cusp * Math.PI) / 180;
      // Approximate ecliptic longitude from RA on ecliptic
      const lambda = Math.atan2(Math.sin(ra), Math.cos(ra) * Math.cos(eps));
      const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
      const tanVal = Math.max(-0.999, Math.min(0.999, Math.tan(latRad) * Math.tan(decl)));
      const ad = Math.asin(tanVal); // Ascensional difference
      const semiArc = isNocturnal ? Math.PI / 2 + ad : Math.PI / 2 - ad;
      const targetRA = isNocturnal
        ? ramc + Math.PI - fraction * semiArc
        : ramc + fraction * semiArc;
      const lonRad = Math.atan2(Math.sin(targetRA), Math.cos(targetRA) * Math.cos(eps));
      cusp = normalizeDeg((lonRad * 180) / Math.PI);
    }
    // Convert final RA/cusp accurately onto ecliptic longitude
    const raFinal = (cusp * Math.PI) / 180;
    const declF = Math.asin(Math.sin(eps) * Math.sin(raFinal));
    const tanValF = Math.max(-0.999, Math.min(0.999, Math.tan(latRad) * Math.tan(declF)));
    const adF = Math.asin(tanValF);
    const semiArcF = isNocturnal ? Math.PI / 2 + adF : Math.PI / 2 - adF;
    const raExact = isNocturnal ? ramc + Math.PI - fraction * semiArcF : ramc + fraction * semiArcF;
    const eclLon = Math.atan2(Math.sin(raExact), Math.cos(raExact) * Math.cos(eps));
    return normalizeDeg((eclLon * 180) / Math.PI);
  };

  const ayanamsa = getKPAyanamsaApprox(jd);
  const lahiriAyanamsa = getLahiriAyanamsaApprox(jd);

  // Calibrate ayanamsa delta if API supplied exact Lahiri Ascendant
  const trop1 = lahiriAscendantLongitude !== undefined
    ? normalizeDeg(lahiriAscendantLongitude + lahiriAyanamsa)
    : ascTrop;

  const tropCusps: number[] = new Array(12).fill(0);
  tropCusps[0] = trop1;
  tropCusps[9] = mcTrop;
  tropCusps[6] = normalizeDeg(trop1 + 180);
  tropCusps[3] = normalizeDeg(mcTrop + 180);

  tropCusps[10] = solvePlacidus(1 / 3, 30, false); // House 11
  tropCusps[11] = solvePlacidus(2 / 3, 60, false); // House 12
  tropCusps[1] = solvePlacidus(2 / 3, 120, true); // House 2
  tropCusps[2] = solvePlacidus(1 / 3, 150, true); // House 3

  // Opposite cusps
  tropCusps[4] = normalizeDeg(tropCusps[10] + 180); // House 5
  tropCusps[5] = normalizeDeg(tropCusps[11] + 180); // House 6
  tropCusps[7] = normalizeDeg(tropCusps[1] + 180); // House 8
  tropCusps[8] = normalizeDeg(tropCusps[2] + 180); // House 9

  return tropCusps.map((tLon, idx) => {
    const sidLon = normalizeDeg(tLon - ayanamsa);
    const signIndex = Math.floor(sidLon / 30);
    const degInSign = sidLon % 30;
    const nak = getNakshatraAndSubs(sidLon);
    return {
      house: idx + 1,
      longitude: Number(sidLon.toFixed(4)),
      signIndex,
      sign: SIGNS[signIndex],
      degreeInSign: Number(degInSign.toFixed(4)),
      dms: formatDMS(degInSign),
      signLord: SIGN_LORDS[signIndex],
      nakshatra: nak.nakshatra,
      starLord: nak.nakshatraLord,
      subLord: nak.subLord,
    };
  });
}

// Determine which KP Placidus house (1..12) a planet's longitude falls inside
export function getKPHouseForLongitude(lon: number, cusps: KPCusp[]): number {
  const target = normalizeDeg(lon);
  for (let i = 0; i < 12; i++) {
    const start = cusps[i].longitude;
    const end = cusps[(i + 1) % 12].longitude;
    if (start < end) {
      if (target >= start && target < end) return i + 1;
    } else {
      if (target >= start || target < end) return i + 1;
    }
  }
  return 1;
}

export function computeKPSignificators(
  planets: PlanetPosition[],
  cusps: KPCusp[]
): KPSignificatorRow[] {
  const realPlanets = planets.filter((p) => p.name !== 'Ascendant');

  const ownsByPlanet: Record<string, number[]> = {};
  const occupiesByPlanet: Record<string, number> = {};

  for (const p of realPlanets) {
    ownsByPlanet[p.name] = [];
    occupiesByPlanet[p.name] = getKPHouseForLongitude(p.longitude, cusps);
  }

  for (const c of cusps) {
    if (!ownsByPlanet[c.signLord]) ownsByPlanet[c.signLord] = [];
    ownsByPlanet[c.signLord].push(c.house);
  }

  // Rahu/Ketu act as agents of their sign lord + conjunct/aspecting planets
  return realPlanets.map((p) => {
    const occ = occupiesByPlanet[p.name] || p.house;
    const owns = ownsByPlanet[p.name] || [];
    const starOcc = occupiesByPlanet[p.nakshatraLord] || occ;
    const starOwns = ownsByPlanet[p.nakshatraLord] || [];

    const combined = Array.from(new Set([starOcc, ...starOwns, occ, ...owns])).sort((a, b) => a - b);

    return {
      planet: p.name,
      occupiesHouse: occ,
      ownsHouses: owns,
      starLord: p.nakshatraLord,
      starLordOccupies: starOcc,
      starLordOwns: starOwns,
      subLord: p.subLord,
      signifiesHouses: combined,
    };
  });
}

// Jaimini 7 Chara Karakas (AK -> DK)
export function computeJaiminiKarakas(planets: PlanetPosition[]): {
  karakas: JaiminiKaraka[];
  karakamshaSign: string;
} {
  const seven = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const entries = planets
    .filter((p) => seven.includes(p.name))
    .map((p) => ({
      planet: p.name,
      degreeInSign: p.degreeInSign,
      dms: p.dms,
      sign: p.sign,
      longitude: p.longitude,
    }))
    .sort((a, b) => b.degreeInSign - a.degreeInSign);

  const labels = [
    { code: 'AK', title: 'Atmakaraka (Soul)' },
    { code: 'AmK', title: 'Amatyakaraka (Career)' },
    { code: 'BK', title: 'Bhratrukaraka (Siblings/Mentor)' },
    { code: 'MK', title: 'Matrukaraka (Mother/Home)' },
    { code: 'PK', title: 'Putrakaraka (Children/Intellect)' },
    { code: 'GK', title: 'Gnatikaraka (Obstacles/Strife)' },
    { code: 'DK', title: 'Darakaraka (Spouse/Partnership)' },
  ];

  const karakas: JaiminiKaraka[] = entries.map((e, i) => ({
    code: labels[i]?.code || `K${i + 1}`,
    title: labels[i]?.title || 'Karaka',
    planet: e.planet,
    degreeInSign: Number(e.degreeInSign.toFixed(4)),
    dms: e.dms,
    sign: e.sign,
  }));

  const ak = entries[0];
  const karakamshaSignIdx = ak ? getVargaSignIndex(ak.longitude, 9) : 0;

  return {
    karakas,
    karakamshaSign: SIGNS[karakamshaSignIdx],
  };
}

// Classic Parashari Bhinnashtakavarga + Sarvashtakavarga Bindu Matrices
// Offsets are 1-based houses from each reference planet/Lagna where benefic bindu is contributed.
const ASHTAKAVARGA_RULES: Record<string, Record<string, number[]>> = {
  Sun: {
    Sun: [1, 2, 4, 7, 8, 9, 10, 11],
    Moon: [3, 6, 10, 11],
    Mars: [1, 2, 4, 7, 8, 9, 10, 11],
    Mercury: [3, 5, 6, 9, 10, 11, 12],
    Jupiter: [5, 6, 9, 11],
    Venus: [6, 7, 12],
    Saturn: [1, 2, 4, 7, 8, 9, 10, 11],
    Ascendant: [3, 4, 6, 10, 11, 12],
  },
  Moon: {
    Sun: [3, 6, 7, 8, 10, 11],
    Moon: [1, 3, 6, 7, 10, 11],
    Mars: [2, 3, 5, 6, 9, 10, 11],
    Mercury: [1, 3, 4, 5, 7, 8, 10, 11],
    Jupiter: [1, 4, 7, 8, 10, 11, 12],
    Venus: [3, 4, 5, 7, 9, 10, 11],
    Saturn: [3, 5, 6, 11],
    Ascendant: [3, 6, 10, 11],
  },
  Mars: {
    Sun: [3, 5, 6, 10, 11],
    Moon: [3, 6, 11],
    Mars: [1, 2, 4, 7, 8, 10, 11],
    Mercury: [3, 5, 6, 11],
    Jupiter: [6, 10, 11, 12],
    Venus: [6, 8, 11, 12],
    Saturn: [1, 4, 7, 8, 9, 10, 11],
    Ascendant: [1, 3, 6, 10, 11],
  },
  Mercury: {
    Sun: [5, 6, 9, 11, 12],
    Moon: [2, 4, 6, 8, 10, 11],
    Mars: [1, 2, 4, 7, 8, 9, 10, 11],
    Mercury: [1, 3, 5, 6, 9, 10, 11, 12],
    Jupiter: [6, 8, 11, 12],
    Venus: [1, 2, 3, 4, 5, 8, 9, 11],
    Saturn: [1, 2, 4, 7, 8, 9, 10, 11],
    Ascendant: [1, 2, 4, 6, 8, 10, 11],
  },
  Jupiter: {
    Sun: [1, 2, 3, 4, 7, 8, 9, 10, 11],
    Moon: [2, 5, 7, 9, 11],
    Mars: [1, 2, 4, 7, 8, 10, 11],
    Mercury: [1, 2, 4, 5, 6, 9, 10, 11],
    Jupiter: [1, 2, 3, 4, 7, 8, 10, 11],
    Venus: [2, 5, 6, 9, 10, 11],
    Saturn: [3, 5, 6, 12],
    Ascendant: [1, 2, 4, 5, 6, 7, 9, 10, 11],
  },
  Venus: {
    Sun: [8, 11, 12],
    Moon: [1, 2, 3, 4, 5, 8, 9, 11, 12],
    Mars: [3, 5, 6, 9, 11, 12],
    Mercury: [3, 5, 6, 9, 11],
    Jupiter: [5, 8, 9, 10, 11],
    Venus: [1, 2, 3, 4, 5, 8, 9, 10, 11],
    Saturn: [3, 4, 5, 8, 9, 10, 11],
    Ascendant: [1, 2, 3, 4, 5, 8, 9, 11],
  },
  Saturn: {
    Sun: [1, 2, 4, 7, 8, 10, 11],
    Moon: [3, 6, 11],
    Mars: [3, 5, 6, 10, 11, 12],
    Mercury: [6, 8, 9, 10, 11, 12],
    Jupiter: [5, 6, 11, 12],
    Venus: [6, 11, 12],
    Saturn: [3, 5, 6, 11],
    Ascendant: [1, 3, 4, 6, 10, 11],
  },
};

export function computeAshtakavarga(planets: PlanetPosition[]): AshtakavargaTable {
  const signMap: Record<string, number> = {};
  for (const p of planets) {
    signMap[p.name] = p.signIndex;
  }

  const bhinna: Record<string, number[]> = {};
  const sarva = new Array(12).fill(0);

  for (const targetPlanet of Object.keys(ASHTAKAVARGA_RULES)) {
    const bindus = new Array(12).fill(0);
    const rules = ASHTAKAVARGA_RULES[targetPlanet];

    for (const [refBody, offsets] of Object.entries(rules)) {
      const refSign = signMap[refBody];
      if (refSign === undefined) continue;
      for (const offset of offsets) {
        const signIdx = (refSign + offset - 1) % 12;
        bindus[signIdx] += 1;
      }
    }

    bhinna[targetPlanet] = bindus;
    for (let i = 0; i < 12; i++) {
      sarva[i] += bindus[i];
    }
  }

  return {
    bhinna,
    sarva,
    totalBindus: sarva.reduce((a, b) => a + b, 0),
  };
}

// Vimshottari Mahadasha -> Antardasha -> Pratyantardasha Calculator
const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;

function formatISODate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function computeVimshottariTimeline(
  moonSiderealLongitude: number,
  birthDateISO: string,
  birthTimeStr: string,
  timezoneOffsetHours: number
): {
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
} {
  const lon = normalizeDeg(moonSiderealLongitude);
  const nakSpan = 360 / 27;
  const nakIdx = Math.floor(lon / nakSpan) % 27;
  const elapsedFraction = (lon - nakIdx * nakSpan) / nakSpan;
  const remainingFraction = 1 - elapsedFraction;

  const startLordIdx = nakIdx % 9;
  const [y, m, d] = birthDateISO.split('-').map(Number);
  const [hh, mm, ss] = birthTimeStr.split(':').map(Number);
  const birthUtcMs =
    Date.UTC(y, m - 1, d, hh || 0, mm || 0, ss || 0) - timezoneOffsetHours * 3600 * 1000;

  // Rewind to theoretical start of the birth Mahadasha so Antardashas/PDs align accurately
  const firstYears = VIMSHOTTARI_ORDER[startLordIdx].years;
  let cursorMs = birthUtcMs - elapsedFraction * firstYears * MS_PER_YEAR;
  const cutoffMs = birthUtcMs + 100 * MS_PER_YEAR;

  const timeline: DashaNode[] = [];

  for (let i = 0; i < 9; i++) {
    const mdEntry = VIMSHOTTARI_ORDER[(startLordIdx + i) % 9];
    const mdDurationMs = mdEntry.years * MS_PER_YEAR;
    const mdStartMs = cursorMs;
    const mdEndMs = cursorMs + mdDurationMs;

    if (mdEndMs < birthUtcMs || mdStartMs > cutoffMs) {
      cursorMs = mdEndMs;
      continue;
    }

    const mdIdx = (startLordIdx + i) % 9;
    const adNodes: DashaNode[] = [];
    let adCursor = mdStartMs;

    for (let j = 0; j < 9; j++) {
      const adEntry = VIMSHOTTARI_ORDER[(mdIdx + j) % 9];
      const adDurationMs = (adEntry.years / 120) * mdDurationMs;
      const adStartMs = adCursor;
      const adEndMs = adCursor + adDurationMs;

      if (adEndMs >= birthUtcMs) {
        const adIdx = (mdIdx + j) % 9;
        const pdNodes: DashaNode[] = [];
        let pdCursor = adStartMs;

        for (let k = 0; k < 9; k++) {
          const pdEntry = VIMSHOTTARI_ORDER[(adIdx + k) % 9];
          const pdDurationMs = (pdEntry.years / 120) * adDurationMs;
          const pdStartMs = pdCursor;
          const pdEndMs = pdCursor + pdDurationMs;

          if (pdEndMs >= birthUtcMs) {
            pdNodes.push({
              lord: pdEntry.lord,
              startDate: formatISODate(Math.max(pdStartMs, birthUtcMs)),
              endDate: formatISODate(pdEndMs),
              level: 'pratyantardasha',
            });
          }
          pdCursor = pdEndMs;
        }

        adNodes.push({
          lord: adEntry.lord,
          startDate: formatISODate(Math.max(adStartMs, birthUtcMs)),
          endDate: formatISODate(adEndMs),
          level: 'antardasha',
          children: pdNodes,
        });
      }
      adCursor = adEndMs;
    }

    timeline.push({
      lord: mdEntry.lord,
      startDate: formatISODate(Math.max(mdStartMs, birthUtcMs)),
      endDate: formatISODate(mdEndMs),
      level: 'mahadasha',
      children: adNodes,
    });

    cursorMs = mdEndMs;
  }

  // Silence unused variable warning cleanly while keeping calculation explicit
  void remainingFraction;

  const nowMs = Date.now();
  const todayISO = new Date(nowMs).toISOString().slice(0, 10);
  const calcProgressPct = (startISO: string, endISO: string): number => {
    const sMs = Date.parse(`${startISO}T00:00:00Z`);
    const eMs = Date.parse(`${endISO}T23:59:59Z`);
    if (Number.isNaN(sMs) || Number.isNaN(eMs) || eMs <= sMs) return 50;
    return Number(Math.max(0, Math.min(100, ((nowMs - sMs) / (eMs - sMs)) * 100)).toFixed(1));
  };

  let currentStack: {
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
  } | null = null;

  for (const md of timeline) {
    if (todayISO >= md.startDate && todayISO <= md.endDate) {
      for (const ad of md.children || []) {
        if (todayISO >= ad.startDate && todayISO <= ad.endDate) {
          for (const pd of ad.children || []) {
            if (todayISO >= pd.startDate && todayISO <= pd.endDate) {
              const mdProgressPct = calcProgressPct(md.startDate, md.endDate);
              const adProgressPct = calcProgressPct(ad.startDate, ad.endDate);
              currentStack = {
                mahadasha: md.lord,
                antardasha: ad.lord,
                pratyantardasha: pd.lord,
                mdStart: md.startDate,
                mdEnd: md.endDate,
                adStart: ad.startDate,
                adEnd: ad.endDate,
                pdStart: pd.startDate,
                pdEnd: pd.endDate,
                mdProgressPct,
                adProgressPct,
                mdSandhiWarning: mdProgressPct >= 90 || mdProgressPct <= 5,
                adSandhiWarning: adProgressPct >= 90 || adProgressPct <= 5,
              };
              break;
            }
          }
        }
      }
    }
  }

  return { timeline, currentStack };
}

// =============================================================================
// EXTENDED PRO VEDIC & WESTERN DETERMINISTIC CALCULATORS
// =============================================================================

export const VARGA_METADATA: Array<{ code: string; name: string; focus: string }> = [
  { code: 'D1', name: 'Rasi', focus: 'Overall life, physical body, core destiny' },
  { code: 'D2', name: 'Hora', focus: 'Wealth, liquid resources, sustenance' },
  { code: 'D3', name: 'Drekkana', focus: 'Siblings, courage, initiative, effort' },
  { code: 'D4', name: 'Chaturthamsa', focus: 'Home, fixed assets, property, inner peace' },
  { code: 'D7', name: 'Saptamsa', focus: 'Children, creative progeny, legacy' },
  { code: 'D9', name: 'Navamsha', focus: 'Marriage, dharma, inner strength, fruit of karma' },
  { code: 'D10', name: 'Dasamsa', focus: 'Career, profession, status, achievement' },
  { code: 'D12', name: 'Dwadasamsa', focus: 'Parents, lineage, ancestral roots' },
  { code: 'D16', name: 'Shodasamsa', focus: 'Vehicles, comforts, conveyances, pleasures' },
  { code: 'D20', name: 'Vimsamsa', focus: 'Spiritual inclination, upasana, devotion' },
  { code: 'D24', name: 'Chaturvimsamsa', focus: 'Higher learning, education, scholarship' },
  { code: 'D27', name: 'Nakshatramsa', focus: 'Physical vitality, stamina, weaknesses' },
  { code: 'D30', name: 'Trimsamsa', focus: 'Adversities, hidden challenges, resilience' },
  { code: 'D40', name: 'Khavedamsa', focus: 'Maternal lineage, auspiciousness, fine tuning' },
  { code: 'D45', name: 'Akshavedamsa', focus: 'Paternal lineage, character, ethical integrity' },
  { code: 'D60', name: 'Shashtiamsa', focus: 'Past-life karma, subtle root causes' },
];

export interface ShadbalaPlanetRow {
  planet: string;
  sthanaBala: number;
  digBala: number;
  kalaBala: number;
  chestaBala: number;
  naisargikaBala: number;
  drikBala: number;
  totalVirupas: number;
  totalRupas: number;
  requiredRupas: number;
  ratio: number;
  isStrong: boolean;
  ishtaPhala: number;
  kashtaPhala: number;
  strengthRank: number;
}

export interface ShadbalaReport {
  planets: ShadbalaPlanetRow[];
  strongestPlanet: string;
  weakestPlanet: string;
}

export interface PanchangAvakhada {
  vara: string;
  tithi: { number: number; name: string; paksha: 'Shukla' | 'Krishna' };
  yoga: { number: number; name: string };
  karana: string;
  moonSign: string;
  sunSign: string;
  nakshatra: string;
  pada: number;
  avakhada: {
    varna: string;
    vashya: string;
    yoni: string;
    gana: string;
    nadi: string;
    tatva: string;
    paya: string;
    yunja: string;
    hansak: string;
    namakshar: string;
  };
}

export interface PlanetaryConditionRow {
  planet: string;
  sign: string;
  house: number;
  dignity: string;
  isRetrograde: boolean;
  isCombust: boolean;
  isVargottama: boolean;
  baladiAvastha: string;
  jagradadiAvastha: string;
  aspectsHouses: number[];
  conjunctWith: string[];
}

export interface VedicYogaItem {
  name: string;
  category: 'Raja Yoga' | 'Dhana Yoga' | 'Mahapurusha' | 'Lunar' | 'Challenging' | 'Special';
  planets: string[];
  summary: string;
}

export interface KPRulingPlanets {
  dayLord: string;
  lagnaSignLord: string;
  lagnaStarLord: string;
  lagnaSubLord: string;
  moonSignLord: string;
  moonStarLord: string;
  moonSubLord: string;
  uniqueRulingPlanets: string[];
}

export interface ArudhaPadaItem {
  code: string;
  house: number;
  houseLord: string;
  lordSign: string;
  padaSignIndex: number;
  padaSign: string;
  padaHouseFromLagna: number;
}

export interface CharaDashaPeriod {
  signIndex: number;
  sign: string;
  years: number;
  startDate: string;
  endDate: string;
}

export interface ArgalaItem {
  targetHouse: number;
  targetSign: string;
  supportingHouses: Array<{ house: number; label: string; planets: string[] }>;
  obstructingHouses: Array<{ house: number; label: string; planets: string[] }>;
  netSupport: 'Strong' | 'Balanced' | 'Obstructed';
}

export interface ExtendedJaiminiData {
  arudhaPadas: ArudhaPadaItem[];
  charaDasha: {
    periods: CharaDashaPeriod[];
    currentPeriod: CharaDashaPeriod | null;
  };
  argala: ArgalaItem[];
}

export interface LalKitabPlanetRow {
  planet: string;
  house: number;
  sign: string;
  pakkaGhar: number[];
  karakaOf: string;
  exaltedHouses: number[];
  debilitatedHouses: number[];
  status: 'Benefic' | 'Malefic' | 'Dormant (Soya)' | 'Mixed';
  isSleeping: boolean;
  notes: string;
}

export interface LalKitabDebt {
  name: string;
  indicator: string;
  active: boolean;
}

export interface LalKitabVarshaphalRow {
  natalHouse: number;
  annualHouse: number;
  planets: string[];
}

export interface LalKitabData {
  planets: LalKitabPlanetRow[];
  isAndhiKundli: boolean;
  isDharmiTewa: boolean;
  sleepingHouses: number[];
  karmicDebts: LalKitabDebt[];
  varshaphal: {
    runningAge: number;
    cycleYear: number;
    placements: LalKitabVarshaphalRow[];
  };
}

export interface WesternPlanetPosition {
  name: string;
  symbol: string;
  longitude: number; // 0..360 tropical
  signIndex: number;
  sign: string;
  degreeInSign: number;
  dms: string;
  house: number; // Placidus or Whole-Sign relative to Ascendant
  wholeSignHouse: number;
  isRetrograde: boolean;
  dignity: string;
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  modality: 'Cardinal' | 'Fixed' | 'Mutable';
  essentialScore?: number;
  accidentalScore?: number;
  houseClass?: 'Angular' | 'Succedent' | 'Cadent';
  solarCondition?: 'Cazimi' | 'Combust' | 'Under Beams' | 'Free';
  sectAlignment?: 'In Sect' | 'Neutral' | 'Contrary to Sect';
}

export interface WesternHouseCusp {
  house: number;
  label: string;
  longitude: number;
  signIndex: number;
  sign: string;
  degreeInSign: number;
  dms: string;
}

export interface WesternAspectItem {
  bodyA: string;
  bodyB: string;
  aspect:
    | 'Conjunction'
    | 'Sextile'
    | 'Square'
    | 'Trine'
    | 'Opposition'
    | 'Quincunx'
    | 'Semi-sextile'
    | 'Semi-square'
    | 'Sesquiquadrate';
  category: 'Major' | 'Minor';
  angle: number;
  orb: number;
  exactness: 'Exact' | 'Tight' | 'Moderate' | 'Wide';
  orbTier?: 'core_structural' | 'active' | 'background';
  weightScore?: number; // 0..100
}

export interface WesternSectInfo {
  chartType: 'Diurnal' | 'Nocturnal';
  sunHouse: number;
  sectLight: 'Sun' | 'Moon';
  beneficOfSect: 'Jupiter' | 'Venus';
  beneficContrary: 'Venus' | 'Jupiter';
  maleficOfSect: 'Saturn' | 'Mars';
  maleficContrary: 'Mars' | 'Saturn';
  summary: string;
}

export interface WesternChartRulerInfo {
  ascSign: string;
  traditional: string;
  modern: string;
  traditionalHouse: number;
  traditionalDignity: string;
  modernHouse: number;
  modernDignity: string;
}

export interface WesternMutualReceptionItem {
  planetA: string;
  planetB: string;
  type: 'Domicile' | 'Exaltation' | 'Mixed';
  summary: string;
}

export interface WesternDispositorSystem {
  chains: Record<string, string[]>;
  finalDispositors: string[];
  loops: string[][];
}

export interface WesternDispositorTree {
  traditional: WesternDispositorSystem;
  modern: WesternDispositorSystem;
}

export interface WesternAspectConfiguration {
  type: 'T-Square' | 'Grand Trine' | 'Grand Cross' | 'Yod' | 'Stellium';
  planets: string[];
  apex?: string;
  elementOrModality?: string;
  houseOrSign?: string;
  maxOrb: number;
  summary: string;
}

export interface WesternTimingSnapshot {
  asOfDate: string;
  profection: {
    age: number;
    profectedHouse: number;
    profectedSign: string;
    lordOfYearTraditional: string;
    lordOfYearModern: string;
    lordNatalHouse: number;
    lordDignity: string;
    yearStartIso: string;
    yearEndIso: string;
    percentElapsed: number;
    daysLeft: number;
  };
  progressions: {
    progressedDateIso: string;
    sun: { sign: string; dms: string; house: number };
    moon: {
      sign: string;
      signIndex: number;
      dms: string;
      house: number;
      signStartIso: string;
      signEndIso: string;
      percentElapsed: number;
      daysLeft: number;
    };
    mercury: { sign: string; dms: string; isRetrograde: boolean };
    venus: { sign: string; dms: string; isRetrograde: boolean };
    mars: { sign: string; dms: string; isRetrograde: boolean };
    ascendantSign: string;
    midheavenSign: string;
    tightAspectsToNatal: Array<{
      progressedBody: string;
      aspect: string;
      natalBody: string;
      orb: number;
    }>;
  };
  solarReturn: {
    returnDateIso: string;
    yearStartIso: string;
    yearEndIso: string;
    srAscendantSign: string;
    srAscendantDms: string;
    srMidheavenSign: string;
    srSunHouse: number;
    srMoonSign: string;
    summary: string;
  };
  transits: {
    transitDate: string;
    outerPlanets: Array<{
      planet: string;
      sign: string;
      dms: string;
      natalHouse: number;
      isRetrograde: boolean;
    }>;
    tightHitsToNatal: Array<{
      transitPlanet: string;
      aspect: string;
      natalBody: string;
      orb: number;
      orbTier: 'core_structural' | 'active';
    }>;
  };
}

export interface WesternChartData {
  system: 'Tropical (Placidus)';
  ayanamshaUsedForConversion: number;
  planets: WesternPlanetPosition[];
  cusps: WesternHouseCusp[];
  angles: {
    ascendant: { sign: string; dms: string; longitude: number };
    midheaven: { sign: string; dms: string; longitude: number };
    descendant: { sign: string; dms: string; longitude: number };
    ic: { sign: string; dms: string; longitude: number };
  };
  aspects: WesternAspectItem[];
  elements: Record<'Fire' | 'Earth' | 'Air' | 'Water', number>;
  modalities: Record<'Cardinal' | 'Fixed' | 'Mutable', number>;
  polarities: { Yang: number; Yin: number };
  dominantElement: string;
  dominantModality: string;
  sect?: WesternSectInfo;
  chartRuler?: WesternChartRulerInfo;
  mutualReceptions?: WesternMutualReceptionItem[];
  dispositorTree?: WesternDispositorTree;
  configurations?: WesternAspectConfiguration[];
}

const NATURAL_FRIENDS: Record<string, { friends: string[]; neutral: string[]; enemies: string[] }> = {
  Sun: { friends: ['Moon', 'Mars', 'Jupiter'], neutral: ['Mercury'], enemies: ['Venus', 'Saturn'] },
  Moon: { friends: ['Sun', 'Mercury'], neutral: ['Mars', 'Jupiter', 'Venus', 'Saturn'], enemies: [] },
  Mars: { friends: ['Sun', 'Moon', 'Jupiter'], neutral: ['Venus', 'Saturn'], enemies: ['Mercury'] },
  Mercury: { friends: ['Sun', 'Venus'], neutral: ['Mars', 'Jupiter', 'Saturn'], enemies: ['Moon'] },
  Jupiter: { friends: ['Sun', 'Moon', 'Mars'], neutral: ['Saturn'], enemies: ['Mercury', 'Venus'] },
  Venus: { friends: ['Mercury', 'Saturn'], neutral: ['Mars', 'Jupiter'], enemies: ['Sun', 'Moon'] },
  Saturn: { friends: ['Mercury', 'Venus'], neutral: ['Jupiter'], enemies: ['Sun', 'Moon', 'Mars'] },
};

const NAISARGIKA_BALA: Record<string, number> = {
  Sun: 60.0,
  Moon: 51.43,
  Venus: 42.86,
  Jupiter: 34.29,
  Mercury: 25.71,
  Mars: 17.14,
  Saturn: 8.57,
};

const MIN_REQUIRED_RUPAS: Record<string, number> = {
  Sun: 5.0,
  Moon: 6.0,
  Mars: 5.0,
  Mercury: 7.0,
  Jupiter: 6.5,
  Venus: 5.5,
  Saturn: 5.0,
};

const EXALT_EXACT_DEG: Record<string, number> = {
  Sun: 10,
  Moon: 33,
  Mars: 298,
  Mercury: 165,
  Jupiter: 95,
  Venus: 357,
  Saturn: 200,
};

const DEBIL_EXACT_DEG: Record<string, number> = {
  Sun: 190,
  Moon: 213,
  Mars: 118,
  Mercury: 345,
  Jupiter: 275,
  Venus: 177,
  Saturn: 20,
};

const MOOLATRIKONA_SIGNS: Record<string, number> = {
  Sun: 4,
  Moon: 1,
  Mars: 0,
  Mercury: 5,
  Jupiter: 8,
  Venus: 6,
  Saturn: 10,
};

function circularDist(a: number, b: number): number {
  const d = Math.abs(normalizeDeg(a) - normalizeDeg(b));
  return d > 180 ? 360 - d : d;
}

function getSignRelationScore(planet: string, signIdx: number): number {
  if (EXALT_SIGNS[planet] === signIdx) return 30;
  if (MOOLATRIKONA_SIGNS[planet] === signIdx) return 45;
  if (OWN_SIGNS[planet]?.includes(signIdx)) return 30;
  const signLord = SIGN_LORDS[signIdx];
  const rel = NATURAL_FRIENDS[planet];
  if (!rel) return 15;
  if (rel.friends.includes(signLord)) return 22.5;
  if (rel.neutral.includes(signLord)) return 15;
  return 7.5;
}

export function computeShadbala(
  planets: PlanetPosition[],
  birthDateISO: string,
  birthTimeStr: string
): ShadbalaReport {
  const seven = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const sun = planets.find((p) => p.name === 'Sun');
  const moon = planets.find((p) => p.name === 'Moon');
  const asc = planets.find((p) => p.name === 'Ascendant');

  const [hh, mm] = (birthTimeStr || '12:00').split(':').map(Number);
  const localHour = (hh || 0) + (mm || 0) / 60;
  const isDayBirth = localHour >= 6 && localHour <= 18;
  const distFromNoon = Math.abs(localHour - 12); // 0 at noon, 12 at midnight
  const dayFraction = Math.max(0, 1 - distFromNoon / 12); // 1 at noon, 0 at midnight

  const [y, m, d] = (birthDateISO || '2000-01-01').split('-').map(Number);
  const weekday = new Date(Date.UTC(y || 2000, (m || 1) - 1, d || 1)).getUTCDay(); // 0=Sun..6=Sat
  const dayLords = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const dinaLord = dayLords[weekday];
  const naturalBenefics = new Set(['Jupiter', 'Venus', 'Mercury', 'Moon']);

  const rows: ShadbalaPlanetRow[] = seven.map((name) => {
    const p = planets.find((item) => item.name === name);
    if (!p) {
      return {
        planet: name,
        sthanaBala: 60,
        digBala: 30,
        kalaBala: 45,
        chestaBala: 25,
        naisargikaBala: NAISARGIKA_BALA[name] || 20,
        drikBala: 0,
        totalVirupas: 180,
        totalRupas: 3,
        requiredRupas: MIN_REQUIRED_RUPAS[name] || 5,
        ratio: 0.6,
        isStrong: false,
        ishtaPhala: 20,
        kashtaPhala: 20,
        strengthRank: 7,
      };
    }

    // 1. Sthana Bala = Uchcha + Saptavargaja + Ojayugma + Kendradi + Drekkana
    const debDist = circularDist(p.longitude, DEBIL_EXACT_DEG[name] ?? 0);
    const uchchaBala = (debDist / 180) * 60;

    const vargaDivs = [1, 2, 3, 7, 9, 12, 30];
    let saptavargaja = 0;
    for (const div of vargaDivs) {
      const sIdx = getVargaSignIndex(p.longitude, div);
      saptavargaja += getSignRelationScore(name, sIdx);
    }

    const isFemalePlanet = name === 'Moon' || name === 'Venus';
    const isEvenRasi = p.signIndex % 2 === 1;
    const isEvenNav = getVargaSignIndex(p.longitude, 9) % 2 === 1;
    let ojayugma = 0;
    if ((isFemalePlanet && isEvenRasi) || (!isFemalePlanet && !isEvenRasi)) ojayugma += 15;
    if ((isFemalePlanet && isEvenNav) || (!isFemalePlanet && !isEvenNav)) ojayugma += 15;

    const kendradi = [1, 4, 7, 10].includes(p.house)
      ? 60
      : [2, 5, 8, 11].includes(p.house)
      ? 30
      : 15;

    const drekkanaPart = Math.floor(p.degreeInSign / 10); // 0, 1, 2
    const drekkanaBala =
      (drekkanaPart === 0 && ['Sun', 'Mars', 'Jupiter'].includes(name)) ||
      (drekkanaPart === 1 && ['Saturn', 'Mercury'].includes(name)) ||
      (drekkanaPart === 2 && ['Moon', 'Venus'].includes(name))
        ? 15
        : 0;

    const sthanaBala = uchchaBala + saptavargaja + ojayugma + kendradi + drekkanaBala;

    // 2. Dig Bala (Directional strength)
    const ascLon = asc?.longitude ?? 0;
    const bestDigLon =
      name === 'Mercury' || name === 'Jupiter'
        ? ascLon
        : name === 'Moon' || name === 'Venus'
        ? normalizeDeg(ascLon + 90)
        : name === 'Saturn'
        ? normalizeDeg(ascLon + 180)
        : normalizeDeg(ascLon + 270); // Sun / Mars 10H
    const powerlessLon = normalizeDeg(bestDigLon + 180);
    const digBala = (circularDist(p.longitude, powerlessLon) / 180) * 60;

    // 3. Kala Bala (Temporal strength)
    const natonnata =
      name === 'Mercury'
        ? 60
        : ['Sun', 'Jupiter', 'Venus'].includes(name)
        ? dayFraction * 60
        : (1 - dayFraction) * 60;

    let pakshaBala = 30;
    if (sun && moon) {
      const sunMoonSep = circularDist(moon.longitude, sun.longitude);
      const isBenefic = naturalBenefics.has(name);
      pakshaBala = isBenefic ? (sunMoonSep / 180) * 60 : ((180 - sunMoonSep) / 180) * 60;
      if (name === 'Moon') pakshaBala *= 2;
    }

    const tribhagaBala =
      (isDayBirth && name === 'Jupiter') ||
      (!isDayBirth && name === 'Jupiter') ||
      (isDayBirth && ['Mercury', 'Sun', 'Saturn'].includes(name)) ||
      (!isDayBirth && ['Moon', 'Venus', 'Mars'].includes(name))
        ? 30
        : 0;

    const dinaBala = name === dinaLord ? 45 : 0;
    const kalaBala = natonnata + pakshaBala + tribhagaBala + dinaBala;

    // 4. Chesta Bala (Motional strength)
    let chestaBala = 30;
    if (name === 'Sun') {
      // Ayana bala proxy based on Sun declination cycle
      const sunRad = (p.longitude * Math.PI) / 180;
      chestaBala = 30 + 30 * Math.sin(sunRad);
    } else if (name === 'Moon') {
      chestaBala = pakshaBala / 2;
    } else if (p.isRetrograde) {
      chestaBala = 60;
    } else if (sun) {
      const sunSep = circularDist(p.longitude, sun.longitude);
      chestaBala = 15 + (sunSep / 180) * 35;
    }

    // 5. Naisargika Bala
    const naisargikaBala = NAISARGIKA_BALA[name] || 20;

    // 6. Drik Bala (Aspectual strength)
    let drikNet = 0;
    for (const other of planets) {
      if (other.name === name || other.name === 'Ascendant' || other.name === 'Rahu' || other.name === 'Ketu') {
        continue;
      }
      const diff = normalizeDeg(p.longitude - other.longitude);
      let aspectWeight = 0;
      if (diff >= 165 && diff <= 195) aspectWeight = 1.0; // 7th aspect
      else if (other.name === 'Mars' && ((diff >= 80 && diff <= 105) || (diff >= 200 && diff <= 225))) aspectWeight = 0.75;
      else if (other.name === 'Jupiter' && ((diff >= 110 && diff <= 135) || (diff >= 230 && diff <= 255))) aspectWeight = 1.0;
      else if (other.name === 'Saturn' && ((diff >= 50 && diff <= 75) || (diff >= 260 && diff <= 285))) aspectWeight = 0.75;

      if (aspectWeight > 0) {
        const isOtherBenefic =
          other.name === 'Jupiter' ||
          other.name === 'Venus' ||
          other.name === 'Mercury' ||
          (other.name === 'Moon' && sun && circularDist(other.longitude, sun.longitude) > 90);
        drikNet += (isOtherBenefic ? 15 : -15) * aspectWeight;
      }
    }

    const totalVirupas = sthanaBala + digBala + kalaBala + chestaBala + naisargikaBala + drikNet;
    const totalRupas = totalVirupas / 60;
    const requiredRupas = MIN_REQUIRED_RUPAS[name] || 5.0;
    const ratio = totalRupas / requiredRupas;

    const ishtaPhala = Math.sqrt(Math.max(0, uchchaBala * chestaBala));
    const kashtaPhala = Math.sqrt(Math.max(0, (60 - uchchaBala) * (60 - chestaBala)));

    return {
      planet: name,
      sthanaBala: Number(sthanaBala.toFixed(1)),
      digBala: Number(digBala.toFixed(1)),
      kalaBala: Number(kalaBala.toFixed(1)),
      chestaBala: Number(chestaBala.toFixed(1)),
      naisargikaBala: Number(naisargikaBala.toFixed(1)),
      drikBala: Number(drikNet.toFixed(1)),
      totalVirupas: Number(totalVirupas.toFixed(1)),
      totalRupas: Number(totalRupas.toFixed(2)),
      requiredRupas,
      ratio: Number(ratio.toFixed(2)),
      isStrong: ratio >= 1.0,
      ishtaPhala: Number(ishtaPhala.toFixed(1)),
      kashtaPhala: Number(kashtaPhala.toFixed(1)),
      strengthRank: 1,
    };
  });

  const sortedByRatio = [...rows].sort((a, b) => b.ratio - a.ratio);
  sortedByRatio.forEach((row, idx) => {
    const match = rows.find((r) => r.planet === row.planet);
    if (match) match.strengthRank = idx + 1;
  });

  return {
    planets: rows,
    strongestPlanet: sortedByRatio[0]?.planet || 'Sun',
    weakestPlanet: sortedByRatio[sortedByRatio.length - 1]?.planet || 'Saturn',
  };
}

const TITHI_NAMES = [
  'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami',
  'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami',
  'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima / Amavasya',
];

const NITYA_YOGAS = [
  'Vishkumbha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma',
  'Dhriti', 'Shoola', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana',
  'Vajra', 'Siddhi', 'Vyatipata', 'Variyana', 'Parigha', 'Shiva', 'Siddha',
  'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti',
];

const VARA_NAMES = ['Sunday (Ravivara)', 'Monday (Somavara)', 'Tuesday (Mangalavara)', 'Wednesday (Budhavara)', 'Thursday (Guruvara)', 'Friday (Shukravara)', 'Saturday (Shanivara)'];
const NAK_YONIS = ['Horse', 'Elephant', 'Sheep', 'Serpent', 'Serpent', 'Dog', 'Cat', 'Sheep', 'Cat', 'Rat', 'Rat', 'Cow', 'Buffalo', 'Tiger', 'Buffalo', 'Tiger', 'Deer', 'Deer', 'Dog', 'Monkey', 'Mongoose', 'Monkey', 'Lion', 'Horse', 'Lion', 'Cow', 'Elephant'];
const NAK_GANAS = ['Deva', 'Manushya', 'Rakshasa', 'Manushya', 'Deva', 'Manushya', 'Deva', 'Deva', 'Rakshasa', 'Rakshasa', 'Manushya', 'Manushya', 'Deva', 'Rakshasa', 'Deva', 'Rakshasa', 'Deva', 'Rakshasa', 'Rakshasa', 'Manushya', 'Manushya', 'Deva', 'Rakshasa', 'Rakshasa', 'Manushya', 'Manushya', 'Deva'];
const NAK_NADIS = ['Adi (Vata)', 'Madhya (Pitta)', 'Antya (Kapha)', 'Antya (Kapha)', 'Madhya (Pitta)', 'Adi (Vata)', 'Adi (Vata)', 'Madhya (Pitta)', 'Antya (Kapha)', 'Antya (Kapha)', 'Madhya (Pitta)', 'Adi (Vata)', 'Adi (Vata)', 'Madhya (Pitta)', 'Antya (Kapha)', 'Antya (Kapha)', 'Madhya (Pitta)', 'Adi (Vata)', 'Adi (Vata)', 'Madhya (Pitta)', 'Antya (Kapha)', 'Antya (Kapha)', 'Madhya (Pitta)', 'Adi (Vata)', 'Adi (Vata)', 'Madhya (Pitta)', 'Antya (Kapha)'];
const NAK_SYLLABLES = [
  ['Chu', 'Che', 'Cho', 'La'], ['Li', 'Lu', 'Le', 'Lo'], ['A', 'I', 'U', 'E'],
  ['O', 'Va', 'Vi', 'Vu'], ['Ve', 'Vo', 'Ka', 'Ki'], ['Ku', 'Gha', 'Ng', 'Chha'],
  ['Ke', 'Ko', 'Ha', 'Hi'], ['Hu', 'He', 'Ho', 'Da'], ['Di', 'Du', 'De', 'Do'],
  ['Ma', 'Mi', 'Mu', 'Me'], ['Mo', 'Ta', 'Ti', 'Tu'], ['Te', 'To', 'Pa', 'Pi'],
  ['Pu', 'Sha', 'Na', 'Tha'], ['Pe', 'Po', 'Ra', 'Ri'], ['Ru', 'Re', 'Ro', 'Ta'],
  ['Ti', 'Tu', 'Te', 'To'], ['Na', 'Ni', 'Nu', 'Ne'], ['No', 'Ya', 'Yi', 'Yu'],
  ['Ye', 'Yo', 'Bha', 'Bhi'], ['Bhu', 'Dha', 'Pha', 'Dha'], ['Bhe', 'Bho', 'Ja', 'Ji'],
  ['Ju', 'Je', 'Jo', 'Gha'], ['Ga', 'Gi', 'Gu', 'Ge'], ['Go', 'Sa', 'Si', 'Su'],
  ['Se', 'So', 'Da', 'Di'], ['Du', 'Tha', 'Jha', 'Da'], ['De', 'Do', 'Cha', 'Chi'],
];

export function computePanchangAndAvakhada(
  planets: PlanetPosition[],
  birthDateISO: string
): PanchangAvakhada {
  const sun = planets.find((p) => p.name === 'Sun');
  const moon = planets.find((p) => p.name === 'Moon');
  const sunLon = sun?.longitude ?? 0;
  const moonLon = moon?.longitude ?? 0;

  const [y, m, d] = (birthDateISO || '2000-01-01').split('-').map(Number);
  const weekday = new Date(Date.UTC(y || 2000, (m || 1) - 1, d || 1)).getUTCDay();
  const vara = VARA_NAMES[weekday] || VARA_NAMES[0];

  const diff = normalizeDeg(moonLon - sunLon);
  const tithiNum = Math.floor(diff / 12) + 1; // 1..30
  const paksha: 'Shukla' | 'Krishna' = tithiNum <= 15 ? 'Shukla' : 'Krishna';
  const tithiInPaksha = tithiNum <= 15 ? tithiNum : tithiNum - 15;
  let tithiName = TITHI_NAMES[tithiInPaksha - 1] || 'Pratipada';
  if (tithiNum === 15) tithiName = 'Purnima';
  if (tithiNum === 30) tithiName = 'Amavasya';

  const yogaSpan = 360 / 27;
  const yogaIdx = Math.floor(normalizeDeg(sunLon + moonLon) / yogaSpan) % 27;

  const karanaIdx = Math.floor(diff / 6) % 60;
  const movableKaranas = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti (Bhadra)'];
  let karana = 'Bava';
  if (karanaIdx === 0) karana = 'Kimstughna';
  else if (karanaIdx === 57) karana = 'Shakuni';
  else if (karanaIdx === 58) karana = 'Chatushpada';
  else if (karanaIdx === 59) karana = 'Naga';
  else karana = movableKaranas[(karanaIdx - 1) % 7];

  const nakIdx = moon?.nakshatraIndex ?? 0;
  const moonSignIdx = moon?.signIndex ?? 0;
  const pada = moon?.pada ?? 1;

  const varnaMap = ['Kshatriya', 'Vaishya', 'Shudra', 'Brahmin'];
  const varna = varnaMap[moonSignIdx % 4];
  const tatvaMap = ['Fire (Agni)', 'Earth (Prithvi)', 'Air (Vayu)', 'Water (Jala)'];
  const tatva = tatvaMap[moonSignIdx % 4];

  const vashyaList = [
    'Chatushpada (Quadruped)', 'Chatushpada (Quadruped)', 'Dwipada (Human)',
    'Jalachara (Aquatic)', 'Vanachara (Wild)', 'Dwipada (Human)',
    'Dwipada (Human)', 'Keeta (Insect)', 'Dwipada / Chatushpada',
    'Jalachara / Chatushpada', 'Dwipada (Human)', 'Jalachara (Aquatic)',
  ];
  const payaList = ['Gold', 'Silver', 'Copper', 'Iron'];
  const paya = payaList[(moon?.house ? moon.house - 1 : 0) % 4];
  const yunja = pada === 1 ? 'Purva' : pada === 4 ? 'Antya' : 'Madhya';
  const hansak = ['Bhoomi', 'Agni', 'Vayu', 'Akasha', 'Jala'][moonSignIdx % 5];
  const namakshar = NAK_SYLLABLES[nakIdx]?.[pada - 1] || 'A';

  return {
    vara,
    tithi: { number: tithiNum, name: `${paksha} ${tithiName}`, paksha },
    yoga: { number: yogaIdx + 1, name: NITYA_YOGAS[yogaIdx] },
    karana,
    moonSign: moon?.sign || 'Aries',
    sunSign: sun?.sign || 'Aries',
    nakshatra: moon?.nakshatra || 'Ashwini',
    pada,
    avakhada: {
      varna,
      vashya: vashyaList[moonSignIdx],
      yoni: NAK_YONIS[nakIdx] || 'Horse',
      gana: NAK_GANAS[nakIdx] || 'Deva',
      nadi: NAK_NADIS[nakIdx] || 'Adi (Vata)',
      tatva,
      paya,
      yunja,
      hansak,
      namakshar,
    },
  };
}

const COMBUSTION_ORBS: Record<string, { direct: number; retro: number }> = {
  Moon: { direct: 12, retro: 12 },
  Mars: { direct: 17, retro: 17 },
  Mercury: { direct: 14, retro: 12 },
  Jupiter: { direct: 11, retro: 11 },
  Venus: { direct: 10, retro: 8 },
  Saturn: { direct: 15, retro: 15 },
};

export function computePlanetaryConditions(
  planets: PlanetPosition[],
  vargas: Record<string, { ascendantSignIndex: number; placements: Array<{ name: string; signIndex: number; sign: string; house: number }> }>
): PlanetaryConditionRow[] {
  const sun = planets.find((p) => p.name === 'Sun');
  const d9 = vargas.D9;

  return planets
    .filter((p) => p.name !== 'Ascendant')
    .map((p) => {
      const orbSpec = COMBUSTION_ORBS[p.name];
      const isCombust = Boolean(
        orbSpec &&
          sun &&
          circularDist(p.longitude, sun.longitude) <= (p.isRetrograde ? orbSpec.retro : orbSpec.direct)
      );

      const d9Match = d9?.placements.find((pl) => pl.name === p.name);
      const isVargottama = Boolean(d9Match && d9Match.signIndex === p.signIndex);

      const slice = Math.min(4, Math.floor(p.degreeInSign / 6)); // 0..4
      const oddSignStates = ['Bala (Infant)', 'Kumara (Youth)', 'Yuva (Adult)', 'Vriddha (Old)', 'Mrita (Dormant)'];
      const evenSignStates = [...oddSignStates].reverse();
      const baladiAvastha = p.signIndex % 2 === 0 ? oddSignStates[slice] : evenSignStates[slice];

      const jagradadiAvastha =
        p.dignity === 'Exalted' || p.dignity === 'Own Sign'
          ? 'Jagrat (Awake)'
          : p.dignity === 'Debilitated'
          ? 'Sushupta (Asleep)'
          : 'Swapna (Dreaming)';

      const aspectsSet = new Set<number>([((p.house + 6 - 1) % 12) + 1]);
      if (p.name === 'Mars') {
        aspectsSet.add(((p.house + 3 - 1) % 12) + 1);
        aspectsSet.add(((p.house + 7 - 1) % 12) + 1);
      } else if (p.name === 'Jupiter' || p.name === 'Rahu' || p.name === 'Ketu') {
        aspectsSet.add(((p.house + 4 - 1) % 12) + 1);
        aspectsSet.add(((p.house + 8 - 1) % 12) + 1);
      } else if (p.name === 'Saturn') {
        aspectsSet.add(((p.house + 2 - 1) % 12) + 1);
        aspectsSet.add(((p.house + 9 - 1) % 12) + 1);
      }

      const conjunctWith = planets
        .filter((other) => other.name !== 'Ascendant' && other.name !== p.name && other.signIndex === p.signIndex)
        .map((other) => other.name);

      return {
        planet: p.name,
        sign: p.sign,
        house: p.house,
        dignity: p.dignity,
        isRetrograde: p.isRetrograde,
        isCombust,
        isVargottama,
        baladiAvastha,
        jagradadiAvastha,
        aspectsHouses: Array.from(aspectsSet).sort((a, b) => a - b),
        conjunctWith,
      };
    });
}

export function computeMajorYogas(planets: PlanetPosition[]): VedicYogaItem[] {
  const yogas: VedicYogaItem[] = [];
  const asc = planets.find((p) => p.name === 'Ascendant');
  const sun = planets.find((p) => p.name === 'Sun');
  const moon = planets.find((p) => p.name === 'Moon');
  const mars = planets.find((p) => p.name === 'Mars');
  const mercury = planets.find((p) => p.name === 'Mercury');
  const jupiter = planets.find((p) => p.name === 'Jupiter');
  const venus = planets.find((p) => p.name === 'Venus');
  const saturn = planets.find((p) => p.name === 'Saturn');

  const ascSign = asc?.signIndex ?? 0;
  const houseLord = (h: number): string => SIGN_LORDS[(ascSign + h - 1) % 12];
  const findP = (name: string) => planets.find((p) => p.name === name);

  // 1. Gaja Kesari Yoga (Jupiter in 1, 4, 7, 10 from Moon)
  if (moon && jupiter) {
    const diff = ((jupiter.signIndex - moon.signIndex + 12) % 12) + 1;
    if ([1, 4, 7, 10].includes(diff)) {
      yogas.push({
        name: 'Gaja Kesari Yoga',
        category: 'Lunar',
        planets: ['Jupiter', 'Moon'],
        summary: `Jupiter is in the ${diff}th sign from Moon, supporting wisdom, goodwill, and resilient reputation.`,
      });
    }
  }

  // 2. Budhaditya Yoga (Sun + Mercury same sign)
  if (sun && mercury && sun.signIndex === mercury.signIndex) {
    yogas.push({
      name: 'Budhaditya Yoga',
      category: 'Special',
      planets: ['Sun', 'Mercury'],
      summary: `Sun and Mercury unite in ${sun.sign} (House ${sun.house}), sharpening analytical intellect and articulation.`,
    });
  }

  // 3. Chandra-Mangala Yoga (Moon + Mars same sign or 7th)
  if (moon && mars && (moon.signIndex === mars.signIndex || ((mars.signIndex - moon.signIndex + 12) % 12) === 6)) {
    yogas.push({
      name: 'Chandra-Mangala Yoga',
      category: 'Dhana Yoga',
      planets: ['Moon', 'Mars'],
      summary: 'Moon and Mars form an energizing financial & entrepreneurial drive axis.',
    });
  }

  // 4. Pancha Mahapurusha Yogas
  const mahapurushaChecks: Array<{ planet: PlanetPosition | undefined; yoga: string }> = [
    { planet: mars, yoga: 'Ruchaka Mahapurusha Yoga' },
    { planet: mercury, yoga: 'Bhadra Mahapurusha Yoga' },
    { planet: jupiter, yoga: 'Hamsa Mahapurusha Yoga' },
    { planet: venus, yoga: 'Malavya Mahapurusha Yoga' },
    { planet: saturn, yoga: 'Sasa Mahapurusha Yoga' },
  ];
  for (const item of mahapurushaChecks) {
    const pl = item.planet;
    if (pl && [1, 4, 7, 10].includes(pl.house) && (pl.dignity === 'Exalted' || pl.dignity === 'Own Sign')) {
      yogas.push({
        name: item.yoga,
        category: 'Mahapurusha',
        planets: [pl.name],
        summary: `${pl.name} in ${pl.dignity.toLowerCase()} ${pl.sign} in Kendra House ${pl.house}.`,
      });
    }
  }

  // 5. Kendra-Trikona Raja Yogas (lords of 1/4/7/10 linked with 5/9)
  const kendraLords = [1, 4, 7, 10].map((h) => houseLord(h));
  const trikonaLords = [1, 5, 9].map((h) => houseLord(h));
  const seenRaja = new Set<string>();
  for (const kLord of kendraLords) {
    for (const tLord of trikonaLords) {
      if (kLord === tLord) continue;
      const pk = findP(kLord);
      const pt = findP(tLord);
      if (pk && pt && pk.signIndex === pt.signIndex) {
        const key = [kLord, tLord].sort().join('-');
        if (!seenRaja.has(key)) {
          seenRaja.add(key);
          yogas.push({
            name: `Raja Yoga (${kLord} + ${tLord})`,
            category: 'Raja Yoga',
            planets: [kLord, tLord],
            summary: `Conjunction of Kendra & Trikona lords in ${pk.sign} (House ${pk.house}), conferring leadership momentum.`,
          });
        }
      }
    }
  }

  // 6. Dhana Yoga (2nd & 11th / 5th / 9th lord conjunctions)
  const l2 = findP(houseLord(2));
  const l11 = findP(houseLord(11));
  const l9 = findP(houseLord(9));
  if (l2 && l11 && (l2.name === l11.name || l2.signIndex === l11.signIndex)) {
    yogas.push({
      name: 'Dhana Yoga (2nd & 11th Lords)',
      category: 'Dhana Yoga',
      planets: Array.from(new Set([l2.name, l11.name])),
      summary: `Strong wealth-accumulation link between 2nd & 11th lords in House ${l2.house}.`,
    });
  } else if (l11 && l9 && l11.signIndex === l9.signIndex) {
    yogas.push({
      name: 'Dhana Yoga (9th & 11th Lords)',
      category: 'Dhana Yoga',
      planets: Array.from(new Set([l9.name, l11.name])),
      summary: `Fortune and gains lords unite in ${l9.sign} (House ${l9.house}).`,
    });
  }

  // 7. Vipareeta Raja Yoga (lords of 6, 8, 12 placed in 6, 8, 12)
  for (const h of [6, 8, 12]) {
    const lName = houseLord(h);
    const lp = findP(lName);
    if (lp && [6, 8, 12].includes(lp.house) && lp.house !== h) {
      yogas.push({
        name: `Vipareeta Raja Yoga (${h}th Lord ${lName} in H${lp.house})`,
        category: 'Raja Yoga',
        planets: [lName],
        summary: `Rise through overcoming obstacles: ${h}th lord placed in ${lp.house}th house.`,
      });
    }
  }

  // 8. Kemadruma check (no planet other than Sun/Nodes in 2nd or 12th from Moon, unless cancelled by Kendra from Moon/Lagna)
  if (moon) {
    const nextFromMoon = (moon.signIndex + 1) % 12;
    const prevFromMoon = (moon.signIndex + 11) % 12;
    const realFive = ['Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
    const flanking = planets.filter(
      (p) => realFive.includes(p.name) && (p.signIndex === nextFromMoon || p.signIndex === prevFromMoon)
    );
    if (flanking.length === 0) {
      const hasKendraFromMoon = planets.some(
        (p) => realFive.includes(p.name) && [0, 3, 6, 9].includes((p.signIndex - moon.signIndex + 12) % 12)
      );
      yogas.push({
        name: hasKendraFromMoon ? 'Kemadruma Bhanga (Cancelled)' : 'Kemadruma Yoga',
        category: hasKendraFromMoon ? 'Lunar' : 'Challenging',
        planets: ['Moon'],
        summary: hasKendraFromMoon
          ? 'Moon has empty flanking houses, but Kendra planetary support cancels isolation and builds self-made strength.'
          : 'No classical planets flanking 2nd/12th from Moon; favors self-reliance and deliberate emotional grounding.',
      });
    }
  }

  return yogas;
}

export function computeKPRulingPlanets(
  planets: PlanetPosition[],
  birthDateISO: string
): KPRulingPlanets {
  const [y, m, d] = (birthDateISO || '2000-01-01').split('-').map(Number);
  const weekday = new Date(Date.UTC(y || 2000, (m || 1) - 1, d || 1)).getUTCDay();
  const dayLords = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const dayLord = dayLords[weekday] || 'Sun';

  const asc = planets.find((p) => p.name === 'Ascendant');
  const moon = planets.find((p) => p.name === 'Moon');

  const lagnaSignLord = SIGN_LORDS[asc?.signIndex ?? 0];
  const lagnaStarLord = asc?.nakshatraLord || lagnaSignLord;
  const lagnaSubLord = asc?.subLord || lagnaStarLord;

  const moonSignLord = SIGN_LORDS[moon?.signIndex ?? 0];
  const moonStarLord = moon?.nakshatraLord || moonSignLord;
  const moonSubLord = moon?.subLord || moonStarLord;

  const uniqueRulingPlanets = Array.from(
    new Set([lagnaSubLord, lagnaStarLord, lagnaSignLord, moonSubLord, moonStarLord, moonSignLord, dayLord])
  );

  return {
    dayLord,
    lagnaSignLord,
    lagnaStarLord,
    lagnaSubLord,
    moonSignLord,
    moonStarLord,
    moonSubLord,
    uniqueRulingPlanets,
  };
}

export function computeExtendedJaimini(
  planets: PlanetPosition[],
  birthDateISO: string
): ExtendedJaiminiData {
  const asc = planets.find((p) => p.name === 'Ascendant');
  const ascSign = asc?.signIndex ?? 0;

  // Dual lordships in Jaimini: Scorpio (Mars/Ketu -> pick stronger, default Mars), Aquarius (Saturn/Rahu -> Saturn)
  const getStrongerLord = (signIdx: number): string => {
    if (signIdx === 7) {
      const ma = planets.find((p) => p.name === 'Mars');
      const ke = planets.find((p) => p.name === 'Ketu');
      return ke && ma && (ke.degreeInSign > ma.degreeInSign) ? 'Ketu' : 'Mars';
    }
    if (signIdx === 10) {
      const sa = planets.find((p) => p.name === 'Saturn');
      const ra = planets.find((p) => p.name === 'Rahu');
      return ra && sa && (ra.degreeInSign > sa.degreeInSign) ? 'Rahu' : 'Saturn';
    }
    return SIGN_LORDS[signIdx];
  };

  // 1. Arudha Padas (AL, A2..A11, UL)
  const arudhaPadas: ArudhaPadaItem[] = [];
  for (let h = 1; h <= 12; h++) {
    const houseSignIdx = (ascSign + h - 1) % 12;
    const lordName = getStrongerLord(houseSignIdx);
    const lordPos = planets.find((p) => p.name === lordName);
    const lordSignIdx = lordPos?.signIndex ?? houseSignIdx;
    const steps = (lordSignIdx - houseSignIdx + 12) % 12;
    let padaSignIdx = (lordSignIdx + steps) % 12;

    // Jaimini Exception: if Pada falls in 1st or 7th from the house, advance 10 signs from Pada
    const diffFromHouse = (padaSignIdx - houseSignIdx + 12) % 12;
    if (diffFromHouse === 0 || diffFromHouse === 6) {
      padaSignIdx = (padaSignIdx + 9) % 12;
    }

    const code = h === 1 ? 'AL' : h === 12 ? 'UL' : `A${h}`;
    arudhaPadas.push({
      code,
      house: h,
      houseLord: lordName,
      lordSign: SIGNS[lordSignIdx],
      padaSignIndex: padaSignIdx,
      padaSign: SIGNS[padaSignIdx],
      padaHouseFromLagna: ((padaSignIdx - ascSign + 12) % 12) + 1,
    });
  }

  // 2. Jaimini Chara Dasha (KN Rao / BPHS standard sign-by-sign years)
  // Vishama (direct): Aries(0), Taurus(1), Gemini(2), Libra(6), Scorpio(7), Sagittarius(8) -> actually 9th sign from Lagna is Vishama/Sama rule:
  // Classic rule: if 9th house from Lagna is odd-footed (Aries, Taurus, Gemini, Libra, Scorpio, Sagittarius) -> direct; else reverse.
  const ninthSignIdx = (ascSign + 8) % 12;
  const ODD_FOOTED = new Set([0, 1, 2, 6, 7, 8]);
  const isDirectSequence = ODD_FOOTED.has(ninthSignIdx);

  const periods: CharaDashaPeriod[] = [];
  let cursorMs = Date.parse(`${birthDateISO || '2000-01-01'}T00:00:00Z`);
  if (Number.isNaN(cursorMs)) cursorMs = Date.UTC(2000, 0, 1);

  const computeCharaYears = (signIdx: number): number => {
    const lordName = getStrongerLord(signIdx);
    const lord = planets.find((p) => p.name === lordName);
    const lordSignIdx = lord?.signIndex ?? signIdx;
    if (lordSignIdx === signIdx) return 12;

    const countForward = ODD_FOOTED.has(signIdx);
    const steps = countForward
      ? (lordSignIdx - signIdx + 12) % 12
      : (signIdx - lordSignIdx + 12) % 12;

    let years = steps; // KN Rao count-inclusive minus 1 = steps
    if (lord && lord.dignity === 'Exalted') years += 1;
    if (lord && lord.dignity === 'Debilitated') years = Math.max(1, years - 1);
    return Math.max(1, Math.min(12, years));
  };

  for (let i = 0; i < 12; i++) {
    const sIdx = isDirectSequence ? (ascSign + i) % 12 : (ascSign - i + 12) % 12;
    const years = computeCharaYears(sIdx);
    const startDate = formatISODate(cursorMs);
    const endMs = cursorMs + years * MS_PER_YEAR;
    const endDate = formatISODate(endMs);
    periods.push({
      signIndex: sIdx,
      sign: SIGNS[sIdx],
      years,
      startDate,
      endDate,
    });
    cursorMs = endMs;
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  const currentPeriod =
    periods.find((p) => todayISO >= p.startDate && todayISO <= p.endDate) || periods[0] || null;

  // 3. Argala & Virodha Argala on Houses 1, 7, 10
  const planetsInHouse = (h: number) =>
    planets.filter((p) => p.name !== 'Ascendant' && p.house === h).map((p) => p.name);

  const argala: ArgalaItem[] = [1, 7, 10].map((targetHouse) => {
    const targetSign = SIGNS[(ascSign + targetHouse - 1) % 12];
    const hOf = (offset: number) => ((targetHouse + offset - 2) % 12) + 1;
    const pairs = [
      { sup: 2, supLabel: '2nd (Sustenance)', obs: 12, obsLabel: '12th' },
      { sup: 4, supLabel: '4th (Home/Base)', obs: 10, obsLabel: '10th' },
      { sup: 11, supLabel: '11th (Gains)', obs: 3, obsLabel: '3rd' },
      { sup: 5, supLabel: '5th (Creative/Followers)', obs: 9, obsLabel: '9th' },
    ];
    let supCount = 0;
    let obsCount = 0;
    const supportingHouses = pairs.map((pair) => {
      const house = hOf(pair.sup);
      const list = planetsInHouse(house);
      supCount += list.length;
      return { house, label: pair.supLabel, planets: list };
    });
    const obstructingHouses = pairs.map((pair) => {
      const house = hOf(pair.obs);
      const list = planetsInHouse(house);
      obsCount += list.length;
      return { house, label: pair.obsLabel, planets: list };
    });

    const netSupport: 'Strong' | 'Balanced' | 'Obstructed' =
      supCount > obsCount ? 'Strong' : obsCount > supCount ? 'Obstructed' : 'Balanced';

    return {
      targetHouse,
      targetSign,
      supportingHouses,
      obstructingHouses,
      netSupport,
    };
  });

  return {
    arudhaPadas,
    charaDasha: {
      periods,
      currentPeriod,
    },
    argala,
  };
}

// Lal Kitab Pakka Ghar, Exaltation/Debilitation Houses & Karmic Debts
const LK_RULES: Record<
  string,
  { pakkaGhar: number[]; karakaOf: string; exaltedHouses: number[]; debilitatedHouses: number[]; maleficHouses: number[] }
> = {
  Sun: { pakkaGhar: [1], karakaOf: 'Father, Soul, Authority', exaltedHouses: [1], debilitatedHouses: [7], maleficHouses: [6, 7, 10] },
  Moon: { pakkaGhar: [4], karakaOf: 'Mother, Mind, Wealth', exaltedHouses: [2], debilitatedHouses: [8], maleficHouses: [8, 10, 12] },
  Mars: { pakkaGhar: [3, 8], karakaOf: 'Courage, Siblings, Land', exaltedHouses: [10], debilitatedHouses: [4], maleficHouses: [4, 7, 8] },
  Mercury: { pakkaGhar: [7], karakaOf: 'Intellect, Speech, Trade', exaltedHouses: [6], debilitatedHouses: [12], maleficHouses: [3, 8, 9, 12] },
  Jupiter: { pakkaGhar: [2, 5, 9, 11, 12], karakaOf: 'Wisdom, Dharma, Children', exaltedHouses: [4], debilitatedHouses: [10], maleficHouses: [6, 7, 10] },
  Venus: { pakkaGhar: [7], karakaOf: 'Spouse, Luxury, Beauty', exaltedHouses: [12], debilitatedHouses: [6], maleficHouses: [1, 6, 9] },
  Saturn: { pakkaGhar: [8, 10], karakaOf: 'Justice, Career, Endurance', exaltedHouses: [7], debilitatedHouses: [1], maleficHouses: [1, 4, 5, 6] },
  Rahu: { pakkaGhar: [12], karakaOf: 'Diplomacy, In-laws, Ambition', exaltedHouses: [3, 6], debilitatedHouses: [8, 9, 12], maleficHouses: [1, 2, 5, 7, 8, 9, 12] },
  Ketu: { pakkaGhar: [6], karakaOf: 'Son, Intuition, Liberation', exaltedHouses: [9, 12], debilitatedHouses: [3, 6], maleficHouses: [1, 4, 5, 8] },
};

// Lal Kitab Annual Varshaphal House Mapping Table (Age year % 12 -> 12 houses map)
const LK_VARSHAPHAL_MAP: number[][] = [
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // Cycle 1 (1, 13, 25, 37...)
  [4, 8, 10, 7, 2, 12, 5, 11, 6, 9, 3, 1], // Cycle 2
  [9, 10, 6, 12, 3, 5, 11, 2, 8, 7, 1, 4], // Cycle 3
  [10, 4, 7, 11, 8, 2, 9, 6, 1, 12, 5, 3], // Cycle 4
  [11, 3, 2, 8, 6, 9, 4, 1, 5, 7, 10, 12], // Cycle 5
  [6, 12, 8, 9, 7, 10, 3, 5, 4, 1, 2, 11], // Cycle 6
  [3, 11, 9, 6, 10, 7, 12, 4, 2, 5, 8, 1], // Cycle 7
  [5, 7, 12, 3, 11, 8, 1, 9, 10, 4, 6, 2], // Cycle 8
  [2, 5, 4, 10, 12, 1, 8, 3, 7, 6, 9, 11], // Cycle 9
  [8, 6, 1, 5, 4, 3, 2, 12, 11, 10, 7, 9], // Cycle 10
  [7, 9, 11, 1, 9, 4, 6, 10, 12, 2, 3, 5], // Cycle 11
  [12, 1, 5, 2, 7, 11, 10, 7, 3, 8, 4, 6], // Cycle 12
];

export function computeLalKitab(planets: PlanetPosition[], birthDateISO: string): LalKitabData {
  const realPlanets = planets.filter((p) => p.name !== 'Ascendant');
  const h10 = realPlanets.filter((p) => p.house === 10);
  const h4 = realPlanets.filter((p) => p.house === 4);
  const saturn = realPlanets.find((p) => p.name === 'Saturn');

  const isAndhiKundli =
    h10.some((p) => ['Sun', 'Moon', 'Jupiter'].includes(p.name)) &&
    (saturn?.house === 7 || h4.length === 0);
  const isDharmiTewa = realPlanets.some((p) => p.house === 9 && ['Jupiter', 'Sun', 'Moon'].includes(p.name));

  // Houses with no planets and empty aspecting 7th house are considered "Soya" (dormant)
  const sleepingHouses: number[] = [];
  for (let h = 1; h <= 12; h++) {
    const occ = realPlanets.filter((p) => p.house === h);
    if (occ.length === 0) {
      sleepingHouses.push(h);
    }
  }

  const lkPlanets: LalKitabPlanetRow[] = realPlanets.map((p) => {
    const rule = LK_RULES[p.name] || {
      pakkaGhar: [p.house],
      karakaOf: p.name,
      exaltedHouses: [],
      debilitatedHouses: [],
      maleficHouses: [],
    };
    const isExaltedH = rule.exaltedHouses.includes(p.house);
    const isDebilH = rule.debilitatedHouses.includes(p.house);
    const isPakka = rule.pakkaGhar.includes(p.house);
    const isMaleficH = rule.maleficHouses.includes(p.house) || isDebilH;

    // A planet in House 1..12 is Dormant (Soya) if its aspecting target house has no waking trigger
    const targetAsp = ((p.house + 6 - 1) % 12) + 1;
    const isSleeping = sleepingHouses.includes(targetAsp) && !isPakka;

    let status: LalKitabPlanetRow['status'] = 'Mixed';
    if (isSleeping) status = 'Dormant (Soya)';
    else if (isExaltedH || isPakka) status = 'Benefic';
    else if (isMaleficH) status = 'Malefic';

    const notesParts: string[] = [];
    if (isPakka) notesParts.push(`In Pakka Ghar (H${p.house})`);
    if (isExaltedH) notesParts.push(`Lal Kitab Exalted House`);
    if (isDebilH) notesParts.push(`Lal Kitab Debilitated House`);
    if (isSleeping) notesParts.push(`Requires activation via 7th house (${targetAsp})`);
    if (notesParts.length === 0) notesParts.push(`Acts according to planetary companions in H${p.house}`);

    return {
      planet: p.name,
      house: p.house,
      sign: p.sign,
      pakkaGhar: rule.pakkaGhar,
      karakaOf: rule.karakaOf,
      exaltedHouses: rule.exaltedHouses,
      debilitatedHouses: rule.debilitatedHouses,
      status,
      isSleeping,
      notes: notesParts.join(' · '),
    };
  });

  // Karmic Debts (Rina) triggers
  const hasIn = (planet: string, houses: number[]) =>
    realPlanets.some((p) => p.name === planet && houses.includes(p.house));

  const karmicDebts: LalKitabDebt[] = [
    {
      name: 'Pitr Rina (Ancestral Debt)',
      indicator: 'Venus, Mercury, or Rahu in Houses 2, 5, 9, or 12 afflicting Jupiter/9th',
      active:
        hasIn('Venus', [2, 5, 9, 12]) ||
        hasIn('Mercury', [2, 5, 9, 12]) ||
        hasIn('Rahu', [2, 5, 9, 12]),
    },
    {
      name: 'Matr Rina (Mother Debt)',
      indicator: 'Ketu in House 4 or afflicting Moon',
      active: hasIn('Ketu', [4]) || (hasIn('Moon', [8]) && hasIn('Rahu', [4])),
    },
    {
      name: 'Self / Swarup Rina',
      indicator: 'Venus, Saturn, Rahu, or Ketu in House 5 or Sun in 12',
      active: hasIn('Venus', [5]) || hasIn('Saturn', [5]) || hasIn('Rahu', [5]) || hasIn('Sun', [12]),
    },
    {
      name: 'Stri / Partner Debt',
      indicator: 'Sun, Moon, or Rahu in Houses 2 or 7',
      active: hasIn('Sun', [2, 7]) || hasIn('Moon', [2, 7]) || hasIn('Rahu', [2, 7]),
    },
    {
      name: 'Daiva / Guru Debt',
      indicator: 'Mercury, Venus, or Rahu in Houses 2, 5, 9, 12 with Jupiter in 6/10',
      active: hasIn('Jupiter', [6, 10]) && (hasIn('Mercury', [2, 5, 9]) || hasIn('Rahu', [2, 9])),
    },
  ];

  // Current Varshaphal Year
  const birthYear = Number((birthDateISO || '2000-01-01').slice(0, 4)) || 2000;
  const nowYear = new Date().getUTCFullYear();
  const runningAge = Math.max(1, nowYear - birthYear + 1);
  const cycleYear = ((runningAge - 1) % 12) + 1;
  const tableRow = LK_VARSHAPHAL_MAP[cycleYear - 1] || LK_VARSHAPHAL_MAP[0];

  const varshaphalPlacements: LalKitabVarshaphalRow[] = [];
  for (let nh = 1; nh <= 12; nh++) {
    const annualH = tableRow[nh - 1] || nh;
    const pls = realPlanets.filter((p) => p.house === nh).map((p) => p.name);
    varshaphalPlacements.push({
      natalHouse: nh,
      annualHouse: annualH,
      planets: pls,
    });
  }

  return {
    planets: lkPlanets,
    isAndhiKundli,
    isDharmiTewa,
    sleepingHouses,
    karmicDebts,
    varshaphal: {
      runningAge,
      cycleYear,
      placements: varshaphalPlacements,
    },
  };
}

// =============================================================================
// DETERMINISTIC TROPICAL WESTERN CALCULATOR (Sun-Pluto, Chiron, Lilith, Nodes, Placidus)
// =============================================================================

const WESTERN_ELEMENTS: Array<'Fire' | 'Earth' | 'Air' | 'Water'> = [
  'Fire', 'Earth', 'Air', 'Water',
  'Fire', 'Earth', 'Air', 'Water',
  'Fire', 'Earth', 'Air', 'Water',
];

const WESTERN_MODALITIES: Array<'Cardinal' | 'Fixed' | 'Mutable'> = [
  'Cardinal', 'Fixed', 'Mutable',
  'Cardinal', 'Fixed', 'Mutable',
  'Cardinal', 'Fixed', 'Mutable',
  'Cardinal', 'Fixed', 'Mutable',
];

const WESTERN_SYMBOLS: Record<string, string> = {
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂',
  Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇',
  Chiron: '⚷', Lilith: '⚸', 'North Node': '☊', 'South Node': '☋',
  Ascendant: 'AC', Midheaven: 'MC',
};

const WESTERN_DOMICILES: Record<string, number[]> = {
  Sun: [4], Moon: [3], Mercury: [2, 5], Venus: [1, 6], Mars: [0, 7],
  Jupiter: [8, 11], Saturn: [9, 10], Uranus: [10], Neptune: [11], Pluto: [7],
};
const WESTERN_EXALT: Record<string, number> = {
  Sun: 0, Moon: 1, Mercury: 5, Venus: 11, Mars: 9, Jupiter: 3, Saturn: 6,
};
const WESTERN_DETRIMENT: Record<string, number[]> = {
  Sun: [10], Moon: [9], Mercury: [8, 11], Venus: [0, 7], Mars: [1, 6],
  Jupiter: [2, 5], Saturn: [3, 4], Uranus: [4], Neptune: [5], Pluto: [1],
};
const WESTERN_FALL: Record<string, number> = {
  Sun: 6, Moon: 7, Mercury: 11, Venus: 5, Mars: 3, Jupiter: 9, Saturn: 0,
};

function getWesternDignity(body: string, signIdx: number): string {
  if (body === 'Ascendant' || body === 'Midheaven') return 'Angle';
  if (WESTERN_DOMICILES[body]?.includes(signIdx)) return 'Domicile';
  if (WESTERN_EXALT[body] === signIdx) return 'Exaltation';
  if (WESTERN_DETRIMENT[body]?.includes(signIdx)) return 'Detriment';
  if (WESTERN_FALL[body] === signIdx) return 'Fall';
  return 'Peregrine';
}

// Compute heliocentric -> geocentric ecliptic longitude for Uranus, Neptune, Pluto, Chiron, & Mean Lilith
function computeOuterAndMinorTropicalBodies(jd: number): Array<{
  name: string;
  longitude: number;
  isRetrograde: boolean;
}> {
  const computeAtJD = (j: number): Record<string, number> => {
    const d = j - 2451543.5; // days from 2000-01-00 00:00 UT (Schlyter epoch)
    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;

    const solveKepler = (Mdeg: number, e: number): number => {
      const M = normalizeDeg(Mdeg) * toRad;
      let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
      for (let k = 0; k < 6; k++) {
        E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      }
      return E;
    };

    const helioXY = (N: number, i: number, w: number, a: number, e: number, M: number) => {
      const E = solveKepler(M, e);
      const xv = a * (Math.cos(E) - e);
      const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
      const v = Math.atan2(yv, xv);
      const r = Math.hypot(xv, yv);
      const Nrad = N * toRad;
      const irad = i * toRad;
      const vw = v + w * toRad;
      const xh = r * (Math.cos(Nrad) * Math.cos(vw) - Math.sin(Nrad) * Math.sin(vw) * Math.cos(irad));
      const yh = r * (Math.sin(Nrad) * Math.cos(vw) + Math.cos(Nrad) * Math.sin(vw) * Math.cos(irad));
      return { xh, yh };
    };

    // Earth (via Sun orbital elements)
    const wSun = 282.9404 + 4.70935e-5 * d;
    const eSun = 0.016709 - 1.151e-9 * d;
    const MSun = 356.047 + 0.9856002585 * d;
    const ESun = solveKepler(MSun, eSun);
    const xvS = Math.cos(ESun) - eSun;
    const yvS = Math.sqrt(1 - eSun * eSun) * Math.sin(ESun);
    const lSun = Math.atan2(yvS, xvS) + wSun * toRad;
    const rSun = Math.hypot(xvS, yvS);
    // Earth helio = opposite of Sun geocentric
    const xe = -rSun * Math.cos(lSun);
    const ye = -rSun * Math.sin(lSun);

    const geoLon = (xh: number, yh: number) => normalizeDeg(Math.atan2(yh - ye, xh - xe) * toDeg);

    const ur = helioXY(74.0005 + 1.3978e-5 * d, 0.7733 + 1.9e-8 * d, 96.6612 + 3.0565e-5 * d, 19.18171 - 1.55e-8 * d, 0.047318 + 7.45e-9 * d, 142.5905 + 0.011725806 * d);
    const ne = helioXY(131.7806 + 3.0173e-5 * d, 1.77 - 2.55e-7 * d, 272.8461 - 6.027e-6 * d, 30.05826 + 3.313e-8 * d, 0.008606 + 2.15e-9 * d, 260.2471 + 0.005995147 * d);

    // Pluto (Meeus/Schlyter elements valid 1900–2100)
    const T = (j - 2451545.0) / 36525.0;
    const S = 50.03 + 0.033459652 * d;
    const P = 238.95 + 0.003968789 * d;
    const plLonApprox =
      238.9508 +
      0.00400703 * d -
      19.799 * Math.sin(P * toRad) +
      19.848 * Math.cos(P * toRad) +
      0.897 * Math.sin(2 * P * toRad) -
      4.956 * Math.cos(2 * P * toRad) +
      0.61 * Math.sin(3 * P * toRad) +
      1.211 * Math.cos(3 * P * toRad) -
      0.341 * Math.sin(4 * P * toRad) -
      0.19 * Math.cos(4 * P * toRad);
    const plLat =
      -3.9082 -
      5.453 * Math.sin(P * toRad) -
      14.975 * Math.cos(P * toRad) +
      3.527 * Math.sin(2 * P * toRad) +
      1.673 * Math.cos(2 * P * toRad);
    const plR =
      40.72 +
      6.68 * Math.sin(P * toRad) +
      6.9 * Math.cos(P * toRad) -
      1.18 * Math.sin(2 * P * toRad) -
      0.03 * Math.cos(2 * P * toRad);
    const xPl = plR * Math.cos(plLat * toRad) * Math.cos(plLonApprox * toRad);
    const yPl = plR * Math.cos(plLat * toRad) * Math.sin(plLonApprox * toRad);
    void S;

    // Chiron (mean J2000 elements, a=13.67, e=0.381, period=50.42y, i=6.93, N=209.3, w=339.6, M0=24.2 at J2000)
    const ch = helioXY(209.3 + 0.0139 * T, 6.93, 339.6, 13.67, 0.381, 24.2 + 0.01954 * (j - 2451545.0));

    // Mean Black Moon Lilith (Lunar Apogee: 83.353243 + 4069.0137287 * T)
    const lilithLon = normalizeDeg(83.35324312 + 4069.0137111 * T - 0.0103238 * T * T);

    // Precess 2000 -> date of birth (+50.29"/yr)
    const precession = 1.39697 * T;

    return {
      Uranus: normalizeDeg(geoLon(ur.xh, ur.yh) + precession),
      Neptune: normalizeDeg(geoLon(ne.xh, ne.yh) + precession),
      Pluto: normalizeDeg(geoLon(xPl, yPl)),
      Chiron: normalizeDeg(geoLon(ch.xh, ch.yh) + precession),
      Lilith: lilithLon,
    };
  };

  const nowPos = computeAtJD(jd);
  const prevPos = computeAtJD(jd - 1);

  return ['Uranus', 'Neptune', 'Pluto', 'Chiron', 'Lilith'].map((name) => {
    const lon = nowPos[name];
    let delta = lon - prevPos[name];
    if (delta < -180) delta += 360;
    if (delta > 180) delta -= 360;
    return {
      name,
      longitude: Number(lon.toFixed(4)),
      isRetrograde: name === 'Lilith' ? false : delta < 0,
    };
  });
}

function getHouseForTropicalLon(lon: number, cusps: number[]): number {
  const target = normalizeDeg(lon);
  for (let i = 0; i < 12; i++) {
    const start = cusps[i];
    const end = cusps[(i + 1) % 12];
    if (start < end) {
      if (target >= start && target < end) return i + 1;
    } else {
      if (target >= start || target < end) return i + 1;
    }
  }
  return 1;
}

const WESTERN_ASPECT_SPECS: Array<{
  aspect: WesternAspectItem['aspect'];
  category: 'Major' | 'Minor';
  angle: number;
  orb: number;
}> = [
  { aspect: 'Conjunction', category: 'Major', angle: 0, orb: 8 },
  { aspect: 'Opposition', category: 'Major', angle: 180, orb: 8 },
  { aspect: 'Trine', category: 'Major', angle: 120, orb: 7 },
  { aspect: 'Square', category: 'Major', angle: 90, orb: 7 },
  { aspect: 'Sextile', category: 'Major', angle: 60, orb: 6 },
  { aspect: 'Quincunx', category: 'Minor', angle: 150, orb: 3 },
  { aspect: 'Semi-square', category: 'Minor', angle: 45, orb: 2.5 },
  { aspect: 'Sesquiquadrate', category: 'Minor', angle: 135, orb: 2.5 },
  { aspect: 'Semi-sextile', category: 'Minor', angle: 30, orb: 2 },
];

export const WESTERN_TRADITIONAL_RULERS = [
  'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
] as const;

export const WESTERN_MODERN_RULERS = [
  'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Pluto', 'Jupiter', 'Saturn', 'Uranus', 'Neptune',
] as const;

function getWesternHouseClass(house: number): 'Angular' | 'Succedent' | 'Cadent' {
  if (house === 1 || house === 4 || house === 7 || house === 10) return 'Angular';
  if (house === 2 || house === 5 || house === 8 || house === 11) return 'Succedent';
  return 'Cadent';
}

function getWesternEssentialScore(dignity: string): number {
  if (dignity === 'Domicile') return 5;
  if (dignity === 'Exaltation') return 4;
  if (dignity === 'Detriment') return -5;
  if (dignity === 'Fall') return -4;
  if (dignity === 'Angle') return 3;
  return 0;
}

function computeWesternAspectWeight(
  bodyA: string,
  bodyB: string,
  aspect: WesternAspectItem['aspect'],
  orb: number
): number {
  const maxOrb = aspect === 'Conjunction' || aspect === 'Opposition' ? 8 : aspect === 'Trine' || aspect === 'Square' ? 7 : aspect === 'Sextile' ? 6 : 3;
  const tightness = Math.max(0, 1 - orb / Math.max(1, maxOrb));
  const coreBoost = orb <= 2.0 ? 22 : orb <= 5.0 ? 8 : -10;
  const majorBoost =
    aspect === 'Conjunction' || aspect === 'Opposition' || aspect === 'Square' || aspect === 'Trine'
      ? 18
      : aspect === 'Sextile'
      ? 12
      : 4;
  const luminaryOrAngleBoost =
    ['Sun', 'Moon', 'Ascendant', 'Midheaven'].includes(bodyA) ||
    ['Sun', 'Moon', 'Ascendant', 'Midheaven'].includes(bodyB)
      ? 10
      : 0;
  return Math.max(5, Math.min(100, Math.round(tightness * 55 + coreBoost + majorBoost + luminaryOrAngleBoost)));
}

function computeMutualReceptions(
  planets: WesternPlanetPosition[]
): WesternMutualReceptionItem[] {
  const classicalAndModern = planets.filter((p) => Boolean(WESTERN_DOMICILES[p.name]));
  const items: WesternMutualReceptionItem[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < classicalAndModern.length; i++) {
    for (let j = i + 1; j < classicalAndModern.length; j++) {
      const a = classicalAndModern[i];
      const b = classicalAndModern[j];
      if (a.signIndex === b.signIndex) continue;

      const aInBDom = WESTERN_DOMICILES[b.name]?.includes(a.signIndex) ?? false;
      const bInADom = WESTERN_DOMICILES[a.name]?.includes(b.signIndex) ?? false;
      const aInBExalt = WESTERN_EXALT[b.name] === a.signIndex;
      const bInAExalt = WESTERN_EXALT[a.name] === b.signIndex;

      let type: 'Domicile' | 'Exaltation' | 'Mixed' | null = null;
      if (aInBDom && bInADom) type = 'Domicile';
      else if (aInBExalt && bInAExalt) type = 'Exaltation';
      else if ((aInBDom && bInAExalt) || (aInBExalt && bInADom)) type = 'Mixed';

      if (!type) continue;
      const key = [a.name, b.name].sort().join(':');
      if (seen.has(key)) continue;
      seen.add(key);

      items.push({
        planetA: a.name,
        planetB: b.name,
        type,
        summary: `${a.name} (${a.sign}) and ${b.name} (${b.sign}) share ${type} Mutual Reception — cooperating across houses H${a.house} & H${b.house}.`,
      });
    }
  }
  return items;
}

function buildWesternDispositorSystem(
  planets: WesternPlanetPosition[],
  rulerTable: readonly string[]
): WesternDispositorSystem {
  const coreSet = new Set([
    'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
  ]);
  const signMap = new Map<string, number>();
  for (const p of planets) {
    if (coreSet.has(p.name)) signMap.set(p.name, p.signIndex);
  }

  const chains: Record<string, string[]> = {};
  const finals = new Set<string>();
  const loopKeys = new Set<string>();
  const loops: string[][] = [];

  for (const [name, sIdx] of signMap.entries()) {
    const chain: string[] = [name];
    let cur = name;
    let curSign = sIdx;
    for (let step = 0; step < 12; step++) {
      const ruler = rulerTable[curSign];
      if (!ruler) break;
      if (ruler === cur) {
        finals.add(cur);
        break;
      }
      const existingIdx = chain.indexOf(ruler);
      chain.push(ruler);
      if (existingIdx !== -1) {
        const cycle = chain.slice(existingIdx, chain.length - 1);
        const key = [...cycle].sort().join('->');
        if (cycle.length >= 2 && !loopKeys.has(key)) {
          loopKeys.add(key);
          loops.push(cycle);
        }
        break;
      }
      const nextSign = signMap.get(ruler);
      if (nextSign === undefined) break;
      cur = ruler;
      curSign = nextSign;
    }
    chains[name] = chain;
  }

  return {
    chains,
    finalDispositors: Array.from(finals),
    loops,
  };
}

function detectWesternAspectConfigurations(
  planets: WesternPlanetPosition[],
  aspects: WesternAspectItem[]
): WesternAspectConfiguration[] {
  const configs: WesternAspectConfiguration[] = [];
  const coreBodies = planets.filter(
    (p) =>
      p.name !== 'Ascendant' &&
      p.name !== 'Midheaven' &&
      p.name !== 'South Node' &&
      p.name !== 'Lilith'
  );
  const planetByName = new Map(planets.map((p) => [p.name, p]));
  const hasAspect = (a: string, b: string, target: WesternAspectItem['aspect']): WesternAspectItem | undefined =>
    aspects.find(
      (asp) =>
        asp.aspect === target &&
        ((asp.bodyA === a && asp.bodyB === b) || (asp.bodyA === b && asp.bodyB === a))
    );

  // 1. T-Squares (Opposition + two Squares to Apex)
  const oppositions = aspects.filter(
    (a) => a.aspect === 'Opposition' && a.bodyA !== 'North Node' && a.bodyB !== 'North Node'
  );
  const tSquareKeys = new Set<string>();
  for (const opp of oppositions) {
    for (const candidate of coreBodies) {
      if (candidate.name === opp.bodyA || candidate.name === opp.bodyB) continue;
      const sq1 = hasAspect(opp.bodyA, candidate.name, 'Square');
      const sq2 = hasAspect(opp.bodyB, candidate.name, 'Square');
      if (sq1 && sq2) {
        const trio = [opp.bodyA, opp.bodyB, candidate.name];
        const key = `${[...trio].sort().join('+')}:${candidate.name}`;
        if (tSquareKeys.has(key)) continue;
        tSquareKeys.add(key);
        const maxOrb = Math.max(opp.orb, sq1.orb, sq2.orb);
        configs.push({
          type: 'T-Square',
          planets: trio,
          apex: candidate.name,
          elementOrModality: candidate.modality,
          houseOrSign: `${candidate.sign} H${candidate.house}`,
          maxOrb: Number(maxOrb.toFixed(2)),
          summary: `${candidate.modality} T-Square: ${opp.bodyA} opposite ${opp.bodyB} squaring apex ${candidate.name} (${candidate.sign} H${candidate.house}, max orb ${maxOrb.toFixed(1)}°).`,
        });
      }
    }
  }

  // 2. Grand Crosses (2 Oppositions mutually Square)
  const gcKeys = new Set<string>();
  for (let i = 0; i < oppositions.length; i++) {
    for (let j = i + 1; j < oppositions.length; j++) {
      const o1 = oppositions[i];
      const o2 = oppositions[j];
      const four = [o1.bodyA, o1.bodyB, o2.bodyA, o2.bodyB];
      if (new Set(four).size !== 4) continue;
      const s1 = hasAspect(o1.bodyA, o2.bodyA, 'Square');
      const s2 = hasAspect(o1.bodyA, o2.bodyB, 'Square');
      const s3 = hasAspect(o1.bodyB, o2.bodyA, 'Square');
      const s4 = hasAspect(o1.bodyB, o2.bodyB, 'Square');
      if (s1 && s2 && s3 && s4) {
        const key = [...four].sort().join('+');
        if (gcKeys.has(key)) continue;
        gcKeys.add(key);
        const mod = planetByName.get(o1.bodyA)?.modality || 'Cardinal';
        const maxOrb = Math.max(o1.orb, o2.orb, s1.orb, s2.orb, s3.orb, s4.orb);
        configs.push({
          type: 'Grand Cross',
          planets: four,
          elementOrModality: mod,
          maxOrb: Number(maxOrb.toFixed(2)),
          summary: `${mod} Grand Cross linking ${four.join(', ')} (max orb ${maxOrb.toFixed(1)}°).`,
        });
      }
    }
  }

  // 3. Grand Trines (3 planets mutually Trine)
  const trines = aspects.filter((a) => a.aspect === 'Trine');
  const gtKeys = new Set<string>();
  for (const tr of trines) {
    for (const candidate of coreBodies) {
      if (candidate.name === tr.bodyA || candidate.name === tr.bodyB) continue;
      const t2 = hasAspect(tr.bodyA, candidate.name, 'Trine');
      const t3 = hasAspect(tr.bodyB, candidate.name, 'Trine');
      if (t2 && t3) {
        const trio = [tr.bodyA, tr.bodyB, candidate.name];
        const key = [...trio].sort().join('+');
        if (gtKeys.has(key)) continue;
        gtKeys.add(key);
        const maxOrb = Math.max(tr.orb, t2.orb, t3.orb);
        configs.push({
          type: 'Grand Trine',
          planets: trio,
          elementOrModality: candidate.element,
          maxOrb: Number(maxOrb.toFixed(2)),
          summary: `${candidate.element} Grand Trine connecting ${trio.join(', ')} (max orb ${maxOrb.toFixed(1)}°).`,
        });
      }
    }
  }

  // 4. Yods (Sextile base + 2 Quincunxes to Apex)
  const sextiles = aspects.filter((a) => a.aspect === 'Sextile');
  const yodKeys = new Set<string>();
  for (const sx of sextiles) {
    for (const candidate of coreBodies) {
      if (candidate.name === sx.bodyA || candidate.name === sx.bodyB) continue;
      const q1 = hasAspect(sx.bodyA, candidate.name, 'Quincunx');
      const q2 = hasAspect(sx.bodyB, candidate.name, 'Quincunx');
      if (q1 && q2) {
        const trio = [sx.bodyA, sx.bodyB, candidate.name];
        const key = `${[...trio].sort().join('+')}:${candidate.name}`;
        if (yodKeys.has(key)) continue;
        yodKeys.add(key);
        const maxOrb = Math.max(sx.orb, q1.orb, q2.orb);
        configs.push({
          type: 'Yod',
          planets: trio,
          apex: candidate.name,
          houseOrSign: `${candidate.sign} H${candidate.house}`,
          maxOrb: Number(maxOrb.toFixed(2)),
          summary: `Yod (Finger of God): ${sx.bodyA} sextile ${sx.bodyB} pointing via quincunx to apex ${candidate.name} (${candidate.sign} H${candidate.house}, max orb ${maxOrb.toFixed(1)}°).`,
        });
      }
    }
  }

  // 5. Stelliums (3+ core personal/social/outer planets in same Sign or same House)
  const stelliumBodies = planets.filter((p) =>
    ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].includes(
      p.name
    )
  );
  const bySign = new Map<string, WesternPlanetPosition[]>();
  const byHouse = new Map<number, WesternPlanetPosition[]>();
  for (const p of stelliumBodies) {
    bySign.set(p.sign, [...(bySign.get(p.sign) || []), p]);
    byHouse.set(p.house, [...(byHouse.get(p.house) || []), p]);
  }
  const stelliumSeen = new Set<string>();
  for (const [sign, group] of bySign.entries()) {
    if (group.length >= 3) {
      const names = group.map((g) => g.name);
      const key = names.slice().sort().join('+');
      stelliumSeen.add(key);
      configs.push({
        type: 'Stellium',
        planets: names,
        houseOrSign: `${sign} (Sign Stellium)`,
        maxOrb: 30,
        summary: `${sign} Stellium (${names.join(', ')}) concentrating focus across H${Array.from(new Set(group.map((g) => g.house))).join('/H')}.`,
      });
    }
  }
  for (const [house, group] of byHouse.entries()) {
    if (group.length >= 3) {
      const names = group.map((g) => g.name);
      const key = names.slice().sort().join('+');
      if (stelliumSeen.has(key)) continue;
      configs.push({
        type: 'Stellium',
        planets: names,
        houseOrSign: `House ${house} Stellium`,
        maxOrb: 30,
        summary: `House ${house} Stellium (${names.join(', ')}) packing concentrated drive into H${house}.`,
      });
    }
  }

  configs.sort((a, b) => a.maxOrb - b.maxOrb);
  return configs.slice(0, 10);
}

export function computeWesternChart(params: {
  siderealPlanets: PlanetPosition[];
  kpCusps: KPCusp[];
  birthDateISO: string;
  birthTimeStr: string;
  timezoneOffsetHours: number;
  apiWesternPlanets?: Array<{ name: string; longitude: number; isRetrograde?: boolean }> | null;
}): WesternChartData {
  const [y, m, d] = (params.birthDateISO || '2000-01-01').split('-').map(Number);
  const timeParts = (params.birthTimeStr || '12:00:00').split(':').map(Number);
  const localHours = (timeParts[0] || 0) + (timeParts[1] || 0) / 60 + (timeParts[2] || 0) / 3600;
  const jd = toJulianDay(y || 2000, m || 1, d || 1, localHours - params.timezoneOffsetHours);
  const lahiri = getLahiriAyanamsaApprox(jd);
  const kpAyanamsa = getKPAyanamsaApprox(jd);

  // Convert KP Placidus cusps to Tropical Placidus cusps
  const tropCuspLons = params.kpCusps.map((c) => normalizeDeg(c.longitude + kpAyanamsa));
  const cusps: WesternHouseCusp[] = tropCuspLons.map((lon, idx) => {
    const signIndex = Math.floor(lon / 30) % 12;
    const deg = lon % 30;
    const h = idx + 1;
    const label = h === 1 ? 'Ascendant (AC)' : h === 4 ? 'Imum Coeli (IC)' : h === 7 ? 'Descendant (DC)' : h === 10 ? 'Midheaven (MC)' : `House ${h}`;
    return {
      house: h,
      label,
      longitude: Number(lon.toFixed(4)),
      signIndex,
      sign: SIGNS[signIndex],
      degreeInSign: Number(deg.toFixed(4)),
      dms: formatDMS(deg),
    };
  });

  const ascLon = cusps[0]?.longitude ?? 0;
  const ascSignIdx = Math.floor(ascLon / 30) % 12;
  const mcLon = cusps[9]?.longitude ?? normalizeDeg(ascLon + 270);
  const mcSignIdx = Math.floor(mcLon / 30) % 12;

  const baseBodies: Array<{ name: string; longitude: number; isRetrograde: boolean }> = [];
  for (const sp of params.siderealPlanets) {
    if (sp.name === 'Ascendant') continue;
    const wName = sp.name === 'Rahu' ? 'North Node' : sp.name === 'Ketu' ? 'South Node' : sp.name;
    baseBodies.push({
      name: wName,
      longitude: normalizeDeg(sp.longitude + lahiri),
      isRetrograde: sp.isRetrograde,
    });
  }

  // Merge API Western outer planets if returned, else deterministic VSOP/Schlyter math
  const outerDet = computeOuterAndMinorTropicalBodies(jd);
  for (const body of outerDet) {
    const apiMatch = params.apiWesternPlanets?.find(
      (ap) => ap.name.toLowerCase() === body.name.toLowerCase()
    );
    baseBodies.push(
      apiMatch
        ? {
            name: body.name,
            longitude: normalizeDeg(apiMatch.longitude),
            isRetrograde: Boolean(apiMatch.isRetrograde),
          }
        : body
    );
  }

  // Include Ascendant & Midheaven
  baseBodies.push({ name: 'Ascendant', longitude: ascLon, isRetrograde: false });
  baseBodies.push({ name: 'Midheaven', longitude: mcLon, isRetrograde: false });

  // Preliminary planet build to resolve Sun house (Diurnal vs Nocturnal Sect) and solar proximity
  const rawSun = baseBodies.find((b) => b.name === 'Sun');
  const sunLon = rawSun ? normalizeDeg(rawSun.longitude) : 0;
  const sunHouse = rawSun ? getHouseForTropicalLon(sunLon, tropCuspLons) : 10;
  const isDiurnal = sunHouse >= 7 && sunHouse <= 12;

  const sect: WesternSectInfo = {
    chartType: isDiurnal ? 'Diurnal' : 'Nocturnal',
    sunHouse,
    sectLight: isDiurnal ? 'Sun' : 'Moon',
    beneficOfSect: isDiurnal ? 'Jupiter' : 'Venus',
    beneficContrary: isDiurnal ? 'Venus' : 'Jupiter',
    maleficOfSect: isDiurnal ? 'Saturn' : 'Mars',
    maleficContrary: isDiurnal ? 'Mars' : 'Saturn',
    summary: isDiurnal
      ? `Diurnal (Day) Chart (Sun in H${sunHouse}): Jupiter acts as Benefic of Sect (most constructive ease) and Saturn is Malefic of Sect (disciplined structure); Mars and Venus operate contrary to sect.`
      : `Nocturnal (Night) Chart (Sun in H${sunHouse}): Moon leads with Venus as Benefic of Sect and Mars as Malefic of Sect (focused drive); Saturn and Jupiter operate contrary to sect.`,
  };

  const planets: WesternPlanetPosition[] = baseBodies.map((b) => {
    const lon = normalizeDeg(b.longitude);
    const signIndex = Math.floor(lon / 30) % 12;
    const degInSign = lon % 30;
    const house =
      b.name === 'Ascendant'
        ? 1
        : b.name === 'Midheaven'
        ? 10
        : getHouseForTropicalLon(lon, tropCuspLons);
    const houseClass = getWesternHouseClass(house);
    const dignity = getWesternDignity(b.name, signIndex);
    const essentialScore = getWesternEssentialScore(dignity);

    let solarCondition: WesternPlanetPosition['solarCondition'] = 'Free';
    if (
      b.name !== 'Sun' &&
      b.name !== 'Ascendant' &&
      b.name !== 'Midheaven' &&
      b.name !== 'North Node' &&
      b.name !== 'South Node'
    ) {
      const distSun = circularDist(lon, sunLon);
      if (distSun <= 0.28) solarCondition = 'Cazimi';
      else if (distSun <= 8.5) solarCondition = 'Combust';
      else if (distSun <= 15) solarCondition = 'Under Beams';
    }

    let sectAlignment: WesternPlanetPosition['sectAlignment'] = 'Neutral';
    if (b.name === 'Sun' || b.name === 'Jupiter' || b.name === 'Saturn') {
      sectAlignment = isDiurnal ? 'In Sect' : 'Contrary to Sect';
    } else if (b.name === 'Moon' || b.name === 'Venus' || b.name === 'Mars') {
      sectAlignment = !isDiurnal ? 'In Sect' : 'Contrary to Sect';
    }

    let accidentalScore = houseClass === 'Angular' ? 3 : houseClass === 'Succedent' ? 1 : -1;
    if (solarCondition === 'Cazimi') accidentalScore += 3;
    else if (solarCondition === 'Combust') accidentalScore -= 2;
    if (b.isRetrograde && b.name !== 'North Node' && b.name !== 'South Node') accidentalScore -= 1;

    return {
      name: b.name,
      symbol: WESTERN_SYMBOLS[b.name] || b.name.slice(0, 2),
      longitude: Number(lon.toFixed(4)),
      signIndex,
      sign: SIGNS[signIndex],
      degreeInSign: Number(degInSign.toFixed(4)),
      dms: formatDMS(degInSign),
      house,
      wholeSignHouse: ((signIndex - ascSignIdx + 12) % 12) + 1,
      isRetrograde: b.isRetrograde,
      dignity,
      element: WESTERN_ELEMENTS[signIndex],
      modality: WESTERN_MODALITIES[signIndex],
      essentialScore,
      accidentalScore,
      houseClass,
      solarCondition,
      sectAlignment,
    };
  });

  // Compute Major & Minor Aspects with Tight-Orb Tiering (<2° Core vs 2-5° Active vs >5° Background)
  const aspects: WesternAspectItem[] = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = planets[i];
      const b = planets[j];
      if (
        (a.name === 'North Node' && b.name === 'South Node') ||
        (a.name === 'South Node' && b.name === 'North Node')
      ) {
        continue;
      }
      const isMinorBody = ['Chiron', 'Lilith', 'North Node', 'South Node'].includes(a.name) ||
        ['Chiron', 'Lilith', 'North Node', 'South Node'].includes(b.name);
      const sep = circularDist(a.longitude, b.longitude);

      for (const spec of WESTERN_ASPECT_SPECS) {
        const maxOrb = isMinorBody ? Math.min(spec.orb, 4) : spec.orb;
        const orb = Math.abs(sep - spec.angle);
        if (orb <= maxOrb) {
          const roundedOrb = Number(orb.toFixed(2));
          aspects.push({
            bodyA: a.name,
            bodyB: b.name,
            aspect: spec.aspect,
            category: spec.category,
            angle: spec.angle,
            orb: roundedOrb,
            exactness: orb <= 1 ? 'Exact' : orb <= 3 ? 'Tight' : orb <= 5.5 ? 'Moderate' : 'Wide',
            orbTier: orb <= 2.0 ? 'core_structural' : orb <= 5.0 ? 'active' : 'background',
            weightScore: computeWesternAspectWeight(a.name, b.name, spec.aspect, roundedOrb),
          });
          break;
        }
      }
    }
  }
  aspects.sort((a, b) => a.orb - b.orb);

  const coreNames = new Set([
    'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Ascendant',
  ]);
  const elements: Record<'Fire' | 'Earth' | 'Air' | 'Water', number> = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  const modalities: Record<'Cardinal' | 'Fixed' | 'Mutable', number> = { Cardinal: 0, Fixed: 0, Mutable: 0 };
  let yang = 0;
  let yin = 0;

  for (const pl of planets) {
    if (!coreNames.has(pl.name)) continue;
    elements[pl.element] += 1;
    modalities[pl.modality] += 1;
    if (pl.element === 'Fire' || pl.element === 'Air') yang += 1;
    else yin += 1;
  }

  const dominantElement = Object.entries(elements).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Fire';
  const dominantModality = Object.entries(modalities).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Cardinal';

  const descLon = normalizeDeg(ascLon + 180);
  const icLon = normalizeDeg(mcLon + 180);

  const tradRulerName = WESTERN_TRADITIONAL_RULERS[ascSignIdx];
  const modRulerName = WESTERN_MODERN_RULERS[ascSignIdx];
  const tradRulerObj = planets.find((p) => p.name === tradRulerName);
  const modRulerObj = planets.find((p) => p.name === modRulerName);

  const chartRuler: WesternChartRulerInfo = {
    ascSign: SIGNS[ascSignIdx],
    traditional: tradRulerName,
    modern: modRulerName,
    traditionalHouse: tradRulerObj?.house ?? 1,
    traditionalDignity: tradRulerObj?.dignity ?? 'Peregrine',
    modernHouse: modRulerObj?.house ?? 1,
    modernDignity: modRulerObj?.dignity ?? 'Peregrine',
  };

  const mutualReceptions = computeMutualReceptions(planets);
  const dispositorTree: WesternDispositorTree = {
    traditional: buildWesternDispositorSystem(planets, WESTERN_TRADITIONAL_RULERS),
    modern: buildWesternDispositorSystem(planets, WESTERN_MODERN_RULERS),
  };
  const configurations = detectWesternAspectConfigurations(planets, aspects);

  return {
    system: 'Tropical (Placidus)',
    ayanamshaUsedForConversion: Number(lahiri.toFixed(4)),
    planets,
    cusps,
    angles: {
      ascendant: { sign: SIGNS[ascSignIdx], dms: formatDMS(ascLon % 30), longitude: Number(ascLon.toFixed(4)) },
      midheaven: { sign: SIGNS[mcSignIdx], dms: formatDMS(mcLon % 30), longitude: Number(mcLon.toFixed(4)) },
      descendant: { sign: SIGNS[Math.floor(descLon / 30) % 12], dms: formatDMS(descLon % 30), longitude: Number(descLon.toFixed(4)) },
      ic: { sign: SIGNS[Math.floor(icLon / 30) % 12], dms: formatDMS(icLon % 30), longitude: Number(icLon.toFixed(4)) },
    },
    aspects,
    elements,
    modalities,
    polarities: { Yang: yang, Yin: yin },
    dominantElement,
    dominantModality,
    sect,
    chartRuler,
    mutualReceptions,
    dispositorTree,
    configurations,
  };
}

export function computeWesternDailyTransits(
  siderealTransitPlanets: PlanetPosition[],
  transitDateISO: string
): WesternPlanetPosition[] {
  const [y, m, d] = (transitDateISO || new Date().toISOString().slice(0, 10)).split('-').map(Number);
  const jd = toJulianDay(y || 2026, m || 1, d || 1, 12);
  const lahiri = getLahiriAyanamsaApprox(jd);

  const bodies: Array<{ name: string; longitude: number; isRetrograde: boolean }> = [];
  for (const sp of siderealTransitPlanets) {
    if (sp.name === 'Ascendant') continue;
    const wName = sp.name === 'Rahu' ? 'North Node' : sp.name === 'Ketu' ? 'South Node' : sp.name;
    bodies.push({
      name: wName,
      longitude: normalizeDeg(sp.longitude + lahiri),
      isRetrograde: sp.isRetrograde,
    });
  }
  for (const outer of computeOuterAndMinorTropicalBodies(jd)) {
    bodies.push(outer);
  }

  return bodies.map((b) => {
    const lon = normalizeDeg(b.longitude);
    const signIndex = Math.floor(lon / 30) % 12;
    const degInSign = lon % 30;
    return {
      name: b.name,
      symbol: WESTERN_SYMBOLS[b.name] || b.name.slice(0, 2),
      longitude: Number(lon.toFixed(4)),
      signIndex,
      sign: SIGNS[signIndex],
      degreeInSign: Number(degInSign.toFixed(4)),
      dms: formatDMS(degInSign),
      house: 1,
      wholeSignHouse: 1,
      isRetrograde: b.isRetrograde,
      dignity: getWesternDignity(b.name, signIndex),
      element: WESTERN_ELEMENTS[signIndex],
      modality: WESTERN_MODALITIES[signIndex],
    };
  });
}

// =============================================================================
// VEDIC ASTROLOGER ENGINE — DETERMINISTIC VEDIC PRECISION CALCULATORS
// =============================================================================

export interface InduLagnaInfo {
  signIndex: number;
  sign: string;
  houseFromLagna: number;
  lord: string;
  ninthFromLagnaLord: string;
  ninthFromMoonLord: string;
  totalKalas: number;
  occupants: string[];
  aspectingPlanets: string[];
}

export interface ShriLagnaInfo {
  longitude: number;
  signIndex: number;
  sign: string;
  degreeInSign: number;
  dms: string;
  houseFromLagna: number;
  lord: string;
  nakshatra: string;
  occupants: string[];
}

export interface KharaPointInfo {
  pointName: '64th Navamsa (From Moon)' | '64th Navamsa (From Lagna)' | '22nd Drekkana (From Lagna)';
  signIndex: number;
  sign: string;
  lord: string;
  houseFromLagna: number;
  vargaOccupants: string[];
  d1Occupants: string[];
}

export interface SpecialVedicPointsReport {
  induLagna: InduLagnaInfo;
  shriLagna: ShriLagnaInfo;
  khara64NavamsaMoon: KharaPointInfo;
  khara64NavamsaLagna: KharaPointInfo;
  khara22DrekkanaLagna: KharaPointInfo;
}

export interface BhavaChalitShiftRow {
  planet: string;
  sign: string;
  degreeInSign: number;
  rashiHouse: number;
  chalitHouse: number;
  shifted: boolean;
  direction: 'forward' | 'backward' | 'none';
}

export interface BhavaChalitReport {
  shifts: BhavaChalitShiftRow[];
  shiftedPlanets: string[];
}

export interface AscendantMaturityReport {
  sign: string;
  degreeInSign: number;
  dms: string;
  nakshatra: string;
  pada: number;
  nakshatraLord: string;
  maturityBand: 'early_immature' | 'stable' | 'late_mature';
  isSandhi: boolean;
  isGandanta: boolean;
  birthTimeSensitivityWarning: boolean;
  d9AscSign: string;
  lagnesh: string;
  lagneshD1House: number;
  lagneshD9Sign: string;
  lagneshD9Dignity: string;
  lagneshD1D9Aligned: boolean;
}

export interface PlanetaryHealthRow {
  planet: string;
  d1Score: number; // 0..70
  d9Modifier: number; // -15..+15
  multiVargaBonus: number; // -15..+15
  totalScore: number; // 0..100
  tier: 'Elite' | 'Strong' | 'Moderate' | 'Weak' | 'Compromised';
  isNeechaBhanga: boolean;
  isPapakartari: boolean;
  factors: string[];
}

export interface ScoredYogaItem extends VedicYogaItem {
  ysiTotal: number; // 0..110
  status: 'Foundational' | 'Active' | 'Conditional' | 'Latent' | 'Blocked';
  breakdown: {
    structuralValidity: number; // 0..25
    planetaryStrength: number; // 0..25
    d1DegreePrecision: number; // 0..25
    d9Reinforcement: number; // 0..25
    classicalBias: number; // 0..10
  };
}

export interface StructuralDoshaItem {
  slug: string;
  name: string;
  active: boolean;
  severity: number; // 0..10
  planets: string[];
  cancelledOrMitigated: boolean;
  notes: string;
}

export interface NeechaBhangaReport {
  planet: string;
  sign: string;
  house: number;
  isCancelled: boolean;
  conditionsMet: string[];
}

export interface KendradhipatiReport {
  planet: string;
  kendraHousesOwned: number[];
  hasTrikonaLordship: boolean;
  isActive: boolean;
  mitigated: boolean;
  notes: string;
}

export interface BadhakaReport {
  lagnaModality: 'Movable' | 'Fixed' | 'Dual';
  badhakaHouse: number;
  badhakesh: string;
  badhakeshHouse: number;
  badhakeshSign: string;
  occupantsInBadhaka: string[];
  conjunctBadhakesh: string[];
}

export interface DispositorChainReport {
  links: Array<{ planet: string; sign: string; dispositor: string }>;
  finalDispositors: string[];
  mutualReceptions: Array<[string, string]>;
}

export interface StructuralFlagsReport {
  badhaka: BadhakaReport;
  marakaPlanets: Array<{ planet: string; houseOwned: number; currentHouse: number; dignity: string }>;
  kendradhipati: KendradhipatiReport[];
  neechaBhanga: NeechaBhangaReport[];
  doshas: StructuralDoshaItem[];
}

export interface DoubleTransitHouseRow {
  house: number;
  houseFromMoon: number;
  signIndex: number;
  sign: string;
  jupiterActivated: boolean;
  saturnActivated: boolean;
  doubleTransitActive: boolean;
  marsTriggered: boolean;
  savBindus: number;
  savVolumeBand: 'High (>=28)' | 'Standard (20-27)' | 'Low (<20)';
  jupiterBav: number;
  saturnBav: number;
}

export interface DoubleTransitReport {
  transitDate: string;
  jupiterSign: string;
  saturnSign: string;
  marsSign: string;
  doubleTransitHouses: number[];
  houses: DoubleTransitHouseRow[];
}

export interface SlowPlanetTransitPair {
  planet: 'Jupiter' | 'Saturn' | 'Rahu' | 'Ketu';
  currentSignIndex: number;
  currentSign: string;
  currentDegreeInSign: number;
  isRetrograde: boolean;
  nextSignIndex: number;
  nextSign: string;
  nextIngressApproxDate: string;
  daysUntilIngress: number;
  direction: 'forward' | 'backward';
}

const INDU_KALAS: Record<string, number> = {
  Sun: 30,
  Moon: 16,
  Mars: 6,
  Mercury: 8,
  Jupiter: 10,
  Venus: 12,
  Saturn: 1,
};

const NATURAL_MALEFICS = new Set(['Sun', 'Mars', 'Saturn', 'Rahu', 'Ketu']);

function getMoonWaxingStatus(planets: PlanetPosition[]): boolean {
  const sun = planets.find((p) => p.name === 'Sun');
  const moon = planets.find((p) => p.name === 'Moon');
  if (!sun || !moon) return true;
  const phaseAngle = normalizeDeg(moon.longitude - sun.longitude);
  return phaseAngle >= 60 && phaseAngle <= 300;
}

function doesPlanetAspectSign(planet: PlanetPosition, targetSignIdx: number): boolean {
  if (planet.name === 'Ascendant') return false;
  const diff = (targetSignIdx - planet.signIndex + 12) % 12; // 0 = conjunction, 6 = 7th
  if (diff === 0 || diff === 6) return true;
  if (planet.name === 'Mars' && (diff === 3 || diff === 7)) return true;
  if ((planet.name === 'Jupiter' || planet.name === 'Rahu' || planet.name === 'Ketu') && (diff === 4 || diff === 8)) {
    return true;
  }
  if (planet.name === 'Saturn' && (diff === 2 || diff === 9)) return true;
  return false;
}

// 1 & 2. Indu Lagna, Shri Lagna, 64th Navamsa & 22nd Drekkana
export function computeSpecialVedicPoints(
  planets: PlanetPosition[],
  vargas: Record<string, { ascendantSignIndex: number; placements: Array<{ name: string; signIndex: number; sign: string; house: number }> }>
): SpecialVedicPointsReport {
  const asc = planets.find((p) => p.name === 'Ascendant');
  const moon = planets.find((p) => p.name === 'Moon');
  const ascSign = asc?.signIndex ?? 0;
  const moonSign = moon?.signIndex ?? 0;

  // Indu Lagna
  const ninthLagnaSign = (ascSign + 8) % 12;
  const ninthMoonSign = (moonSign + 8) % 12;
  const ninthFromLagnaLord = SIGN_LORDS[ninthLagnaSign];
  const ninthFromMoonLord = SIGN_LORDS[ninthMoonSign];
  const totalKalas = (INDU_KALAS[ninthFromLagnaLord] || 0) + (INDU_KALAS[ninthFromMoonLord] || 0);
  const rem = totalKalas % 12 === 0 ? 12 : totalKalas % 12;
  const induSignIdx = (moonSign + rem - 1) % 12;
  const induHouse = ((induSignIdx - ascSign + 12) % 12) + 1;
  const realPlanets = planets.filter((p) => p.name !== 'Ascendant');
  const induOccupants = realPlanets.filter((p) => p.signIndex === induSignIdx).map((p) => p.name);
  const induAspecting = realPlanets
    .filter((p) => p.signIndex !== induSignIdx && doesPlanetAspectSign(p, induSignIdx))
    .map((p) => p.name);

  // Shri Lagna
  const nakSpan = 360 / 27;
  const moonLon = moon?.longitude ?? 0;
  const nakFraction = ((moonLon % nakSpan) + nakSpan) % nakSpan / nakSpan;
  const shriLon = normalizeDeg((asc?.longitude ?? 0) + nakFraction * 360);
  const shriSignIdx = Math.floor(shriLon / 30) % 12;
  const shriDeg = shriLon % 30;
  const shriNak = getNakshatraAndSubs(shriLon);
  const shriOccupants = realPlanets.filter((p) => p.signIndex === shriSignIdx).map((p) => p.name);

  // 64th Navamsa & 22nd Drekkana
  const d9 = vargas.D9;
  const d3 = vargas.D3;
  const moonD9Sign = d9?.placements.find((p) => p.name === 'Moon')?.signIndex ?? getVargaSignIndex(moonLon, 9);
  const lagnaD9Sign = d9?.ascendantSignIndex ?? getVargaSignIndex(asc?.longitude ?? 0, 9);
  const lagnaD3Sign = d3?.ascendantSignIndex ?? getVargaSignIndex(asc?.longitude ?? 0, 3);

  const khara64MoonSign = (moonD9Sign + 3) % 12;
  const khara64LagnaSign = (lagnaD9Sign + 3) % 12;
  const khara22LagnaSign = (lagnaD3Sign + 7) % 12;

  const buildKhara = (
    pointName: KharaPointInfo['pointName'],
    targetSignIdx: number,
    vargaTable?: { placements: Array<{ name: string; signIndex: number }> }
  ): KharaPointInfo => ({
    pointName,
    signIndex: targetSignIdx,
    sign: SIGNS[targetSignIdx],
    lord: SIGN_LORDS[targetSignIdx],
    houseFromLagna: ((targetSignIdx - ascSign + 12) % 12) + 1,
    vargaOccupants: (vargaTable?.placements || [])
      .filter((pl) => pl.name !== 'Ascendant' && pl.signIndex === targetSignIdx)
      .map((pl) => pl.name),
    d1Occupants: realPlanets.filter((p) => p.signIndex === targetSignIdx).map((p) => p.name),
  });

  return {
    induLagna: {
      signIndex: induSignIdx,
      sign: SIGNS[induSignIdx],
      houseFromLagna: induHouse,
      lord: SIGN_LORDS[induSignIdx],
      ninthFromLagnaLord,
      ninthFromMoonLord,
      totalKalas,
      occupants: induOccupants,
      aspectingPlanets: induAspecting,
    },
    shriLagna: {
      longitude: Number(shriLon.toFixed(4)),
      signIndex: shriSignIdx,
      sign: SIGNS[shriSignIdx],
      degreeInSign: Number(shriDeg.toFixed(4)),
      dms: formatDMS(shriDeg),
      houseFromLagna: ((shriSignIdx - ascSign + 12) % 12) + 1,
      lord: SIGN_LORDS[shriSignIdx],
      nakshatra: shriNak.nakshatra,
      occupants: shriOccupants,
    },
    khara64NavamsaMoon: buildKhara('64th Navamsa (From Moon)', khara64MoonSign, d9),
    khara64NavamsaLagna: buildKhara('64th Navamsa (From Lagna)', khara64LagnaSign, d9),
    khara22DrekkanaLagna: buildKhara('22nd Drekkana (From Lagna)', khara22LagnaSign, d3),
  };
}

// 3. Bhava-Chalit Shift Diff (D1 Whole Sign House vs KP Placidus Chalit House)
export function computeBhavaChalitShifts(
  planets: PlanetPosition[],
  cusps: KPCusp[]
): BhavaChalitReport {
  if (!cusps || cusps.length !== 12) {
    return { shifts: [], shiftedPlanets: [] };
  }

  const shifts: BhavaChalitShiftRow[] = planets
    .filter((p) => p.name !== 'Ascendant')
    .map((p) => {
      const chalitHouse = getKPHouseForLongitude(p.longitude, cusps);
      const diff = (chalitHouse - p.house + 12) % 12;
      const shifted = diff !== 0;
      const direction: BhavaChalitShiftRow['direction'] = !shifted
        ? 'none'
        : diff <= 6
        ? 'forward'
        : 'backward';

      return {
        planet: p.name,
        sign: p.sign,
        degreeInSign: Number(p.degreeInSign.toFixed(2)),
        rashiHouse: p.house,
        chalitHouse,
        shifted,
        direction,
      };
    });

  return {
    shifts,
    shiftedPlanets: shifts.filter((s) => s.shifted).map((s) => s.planet),
  };
}

// 4. Ascendant Degree Maturity & D1↔D9 Alignment
export function computeAscendantMaturity(
  planets: PlanetPosition[],
  vargas: Record<string, { ascendantSignIndex: number; placements: Array<{ name: string; signIndex: number; sign: string; house: number }> }>
): AscendantMaturityReport {
  const asc = planets.find((p) => p.name === 'Ascendant');
  const deg = asc?.degreeInSign ?? 15;
  const signIdx = asc?.signIndex ?? 0;
  const lagnesh = SIGN_LORDS[signIdx];
  const lagneshPos = planets.find((p) => p.name === lagnesh);

  const d9 = vargas.D9;
  const d9AscSignIdx = d9?.ascendantSignIndex ?? getVargaSignIndex(asc?.longitude ?? 0, 9);
  const lagneshD9 = d9?.placements.find((p) => p.name === lagnesh);
  const lagneshD9SignIdx = lagneshD9?.signIndex ?? signIdx;
  const lagneshD9Dignity = getDignity(lagnesh, lagneshD9SignIdx);

  const maturityBand: AscendantMaturityReport['maturityBand'] =
    deg < 5 ? 'early_immature' : deg > 25 ? 'late_mature' : 'stable';

  const isSandhi = deg < 1.0 || deg > 29.0;
  // Gandanta junctions: Water->Fire boundaries (Can->Leo, Sco->Sag, Pis->Ari) within 3.33 deg
  const isWaterEnd = (signIdx === 3 || signIdx === 7 || signIdx === 11) && deg >= 26.67;
  const isFireStart = (signIdx === 4 || signIdx === 8 || signIdx === 0) && deg <= 3.33;
  const isGandanta = isWaterEnd || isFireStart;

  const isStrongDig = (dig: string) => dig === 'Exalted' || dig === 'Own Sign';
  const lagneshD1D9Aligned =
    Boolean(lagneshPos && lagneshD9SignIdx === lagneshPos.signIndex) ||
    Boolean(lagneshPos && isStrongDig(lagneshPos.dignity) && isStrongDig(lagneshD9Dignity)) ||
    d9AscSignIdx === signIdx;

  return {
    sign: asc?.sign || 'Aries',
    degreeInSign: Number(deg.toFixed(2)),
    dms: asc?.dms || formatDMS(deg),
    nakshatra: asc?.nakshatra || 'Ashwini',
    pada: asc?.pada || 1,
    nakshatraLord: asc?.nakshatraLord || 'Ketu',
    maturityBand,
    isSandhi,
    isGandanta,
    birthTimeSensitivityWarning: isSandhi || isGandanta || deg < 1.5 || deg > 28.5,
    d9AscSign: SIGNS[d9AscSignIdx],
    lagnesh,
    lagneshD1House: lagneshPos?.house ?? 1,
    lagneshD9Sign: SIGNS[lagneshD9SignIdx],
    lagneshD9Dignity,
    lagneshD1D9Aligned,
  };
}

// 5. Neecha Bhanga, Badhaka, Kendradhipati, Maraka & Dosha Scanner
export function computeStructuralFlagsAndDoshas(
  planets: PlanetPosition[],
  vargas: Record<string, { ascendantSignIndex: number; placements: Array<{ name: string; signIndex: number; sign: string; house: number }> }>,
  conditions: PlanetaryConditionRow[],
  ashtakavarga?: AshtakavargaTable
): StructuralFlagsReport {
  const asc = planets.find((p) => p.name === 'Ascendant');
  const moon = planets.find((p) => p.name === 'Moon');
  const ascSign = asc?.signIndex ?? 0;
  const moonSign = moon?.signIndex ?? 0;
  const findP = (name: string) => planets.find((p) => p.name === name);
  const houseLord = (h: number) => SIGN_LORDS[(ascSign + h - 1) % 12];
  const isInKendraFrom = (p: PlanetPosition | undefined, refSignIdx: number) =>
    Boolean(p && [0, 3, 6, 9].includes((p.signIndex - refSignIdx + 12) % 12));

  const d9 = vargas.D9;
  const realPlanets = planets.filter((p) => p.name !== 'Ascendant');
  const isMoonWaxing = getMoonWaxingStatus(planets);

  // A. Badhaka
  const modalityIdx = ascSign % 3;
  const lagnaModality: BadhakaReport['lagnaModality'] =
    modalityIdx === 0 ? 'Movable' : modalityIdx === 1 ? 'Fixed' : 'Dual';
  const badhakaHouse = lagnaModality === 'Movable' ? 11 : lagnaModality === 'Fixed' ? 9 : 7;
  const badhakesh = houseLord(badhakaHouse);
  const badhakeshPos = findP(badhakesh);

  const badhaka: BadhakaReport = {
    lagnaModality,
    badhakaHouse,
    badhakesh,
    badhakeshHouse: badhakeshPos?.house ?? badhakaHouse,
    badhakeshSign: badhakeshPos?.sign ?? SIGNS[(ascSign + badhakaHouse - 1) % 12],
    occupantsInBadhaka: realPlanets.filter((p) => p.house === badhakaHouse).map((p) => p.name),
    conjunctBadhakesh: badhakeshPos
      ? realPlanets.filter((p) => p.name !== badhakesh && p.signIndex === badhakeshPos.signIndex).map((p) => p.name)
      : [],
  };

  // B. Maraka Planets (2nd & 7th lords)
  const marakaPlanets = [2, 7].map((h) => {
    const pName = houseLord(h);
    const pos = findP(pName);
    return {
      planet: pName,
      houseOwned: h,
      currentHouse: pos?.house ?? h,
      dignity: pos?.dignity ?? 'Neutral',
    };
  });

  // C. Kendradhipati Dosha (Natural benefics owning Kendras 4/7/10 without owning Trikona 1/5/9)
  const ownedHousesByPlanet: Record<string, number[]> = {};
  for (let h = 1; h <= 12; h++) {
    const lord = houseLord(h);
    if (!ownedHousesByPlanet[lord]) ownedHousesByPlanet[lord] = [];
    ownedHousesByPlanet[lord].push(h);
  }
  const natBeneficCandidates = isMoonWaxing
    ? ['Jupiter', 'Venus', 'Mercury', 'Moon']
    : ['Jupiter', 'Venus', 'Mercury'];
  const kendradhipati: KendradhipatiReport[] = [];
  for (const bName of natBeneficCandidates) {
    const owned = ownedHousesByPlanet[bName] || [];
    const kendras = owned.filter((h) => h === 4 || h === 7 || h === 10);
    const hasTrikona = owned.some((h) => h === 1 || h === 5 || h === 9);
    if (kendras.length >= 1 && !hasTrikona && (kendras.length === 2 || bName === 'Jupiter' || bName === 'Venus')) {
      const pos = findP(bName);
      const d9Pos = d9?.placements.find((pl) => pl.name === bName);
      const d9Dig = d9Pos ? getDignity(bName, d9Pos.signIndex) : 'Neutral';
      const trikonaLords: string[] = [houseLord(5), houseLord(9)];
      const withTrikonaLord = Boolean(
        pos && realPlanets.some((o) => trikonaLords.includes(o.name) && o.signIndex === pos.signIndex)
      );
      const mitigated =
        Boolean(pos && (pos.dignity === 'Own Sign' || pos.dignity === 'Exalted' || [6, 8, 12].includes(pos.house))) ||
        withTrikonaLord ||
        d9Dig === 'Exalted' ||
        d9Dig === 'Own Sign';
      kendradhipati.push({
        planet: bName,
        kendraHousesOwned: kendras,
        hasTrikonaLordship: hasTrikona,
        isActive: kendras.length >= 2 || (bName === 'Jupiter' && kendras.length >= 1),
        mitigated,
        notes: mitigated
          ? `${bName} owns Kendra(s) ${kendras.join('/')} without 5/9, mitigated by ${pos?.dignity || 'D9/placement'}.`
          : `${bName} owns Kendra(s) ${kendras.join('/')} without Trikona lordship, making expression procedural or conditional.`,
      });
    }
  }

  // D. Neecha Bhanga Scanner (7 classical planets Sun..Saturn)
  const exaltLordOfSign = (signIdx: number): string | undefined =>
    Object.entries(EXALT_SIGNS).find(([, s]) => s === signIdx)?.[0];
  const SEVEN_CLASSICAL = new Set(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']);

  const neechaBhanga: NeechaBhangaReport[] = [];
  for (const p of realPlanets) {
    if (!SEVEN_CLASSICAL.has(p.name) || p.dignity !== 'Debilitated') continue;
    const conditionsMet: string[] = [];
    const signLord = findP(SIGN_LORDS[p.signIndex]);
    if (isInKendraFrom(signLord, ascSign) || isInKendraFrom(signLord, moonSign)) {
      conditionsMet.push(`Dispositor ${SIGN_LORDS[p.signIndex]} in Kendra from Lagna/Moon`);
    }
    const exaltLordName = SIGN_LORDS[EXALT_SIGNS[p.name] ?? 0];
    const exaltSignLord = findP(exaltLordName);
    if (isInKendraFrom(exaltSignLord, ascSign) || isInKendraFrom(exaltSignLord, moonSign)) {
      conditionsMet.push(`Exaltation sign lord ${exaltLordName} in Kendra from Lagna/Moon`);
    }
    const exaltsHere = exaltLordOfSign(p.signIndex);
    const exaltsHerePos = exaltsHere ? findP(exaltsHere) : undefined;
    if (isInKendraFrom(exaltsHerePos, ascSign) || isInKendraFrom(exaltsHerePos, moonSign)) {
      conditionsMet.push(`${exaltsHere} (which exalts in ${p.sign}) sits in Kendra`);
    }
    if (signLord && doesPlanetAspectSign(signLord, p.signIndex)) {
      conditionsMet.push(`Aspected by sign dispositor ${signLord.name}`);
    }
    const d9Pos = d9?.placements.find((pl) => pl.name === p.name);
    const d9Dig = d9Pos ? getDignity(p.name, d9Pos.signIndex) : 'Neutral';
    if (d9Dig === 'Exalted' || d9Dig === 'Own Sign') {
      conditionsMet.push(`Uplifted in D9 Navamsa (${d9Dig} in ${SIGNS[d9Pos?.signIndex ?? 0]})`);
    }
    neechaBhanga.push({
      planet: p.name,
      sign: p.sign,
      house: p.house,
      isCancelled: conditionsMet.length > 0,
      conditionsMet,
    });
  }

  // E. Dosha Scanner
  const doshas: StructuralDoshaItem[] = [];
  const saturn = findP('Saturn');
  const mars = findP('Mars');
  const rahu = findP('Rahu');
  const ketu = findP('Ketu');
  const sun = findP('Sun');
  const jupiter = findP('Jupiter');
  const venus = findP('Venus');

  // 1. Punarphoo (Saturn–Moon mutual/same-sign/aspect link)
  if (saturn && moon) {
    const linked =
      saturn.signIndex === moon.signIndex ||
      doesPlanetAspectSign(saturn, moon.signIndex) ||
      moon.nakshatraLord === 'Saturn' ||
      (moon.signIndex === 9 || moon.signIndex === 10) && saturn.house === moon.house;
    if (linked) {
      const jupMitigates = Boolean(jupiter && doesPlanetAspectSign(jupiter, moon.signIndex));
      doshas.push({
        slug: 'punarphoo',
        name: 'Punarphoo (Saturn-Moon Link)',
        active: true,
        severity: saturn.signIndex === moon.signIndex ? 7 : jupMitigates ? 4 : 6,
        planets: ['Saturn', 'Moon'],
        cancelledOrMitigated: jupMitigates,
        notes: jupMitigates
          ? 'Saturn links with Moon creating emotional caution/delays, moderated by Jupiter aspect.'
          : 'Saturn aspects/conjoins Moon; suggests emotional restraint, over-thinking, or delayed commitment milestones.',
      });
    }
  }

  // 2. Angarak (Mars + Rahu)
  if (mars && rahu && mars.signIndex === rahu.signIndex) {
    const orb = circularDist(mars.longitude, rahu.longitude);
    const jupAspect = Boolean(jupiter && doesPlanetAspectSign(jupiter, mars.signIndex));
    doshas.push({
      slug: 'angarak',
      name: 'Angarak Yoga (Mars + Rahu)',
      active: true,
      severity: orb <= 8 ? (jupAspect ? 6 : 8) : 5,
      planets: ['Mars', 'Rahu'],
      cancelledOrMitigated: jupAspect,
      notes: `Mars & Rahu conjunct in ${mars.sign} (orb ${orb.toFixed(1)}°)${jupAspect ? ', tempered by Jupiter aspect' : ''}.`,
    });
  }

  // 3. Shrapit (Saturn + Rahu)
  if (saturn && rahu && saturn.signIndex === rahu.signIndex) {
    const jupAspect = Boolean(jupiter && doesPlanetAspectSign(jupiter, saturn.signIndex));
    doshas.push({
      slug: 'shrapit',
      name: 'Shrapit Yoga (Saturn + Rahu)',
      active: true,
      severity: jupAspect ? 5 : 7,
      planets: ['Saturn', 'Rahu'],
      cancelledOrMitigated: jupAspect,
      notes: `Saturn & Rahu in ${saturn.sign}${jupAspect ? ' with Jupiter mitigation' : ''}.`,
    });
  }

  // 4. Grahan (Sun/Moon conjunct Nodes within 12 deg)
  for (const lum of [sun, moon]) {
    if (!lum) continue;
    for (const node of [rahu, ketu]) {
      if (!node) continue;
      if (lum.signIndex === node.signIndex && circularDist(lum.longitude, node.longitude) <= 12) {
        const jupAspect = Boolean(jupiter && doesPlanetAspectSign(jupiter, lum.signIndex));
        doshas.push({
          slug: `grahan_${lum.name.toLowerCase()}`,
          name: `Grahan (${lum.name} + ${node.name})`,
          active: true,
          severity: jupAspect ? 4 : 7,
          planets: [lum.name, node.name],
          cancelledOrMitigated: jupAspect,
          notes: `${lum.name} within ${circularDist(lum.longitude, node.longitude).toFixed(1)}° of ${node.name} in ${lum.sign}.`,
        });
      }
    }
  }

  // 5. Kemadruma with cancellation test
  if (moon) {
    const nextFromMoon = (moon.signIndex + 1) % 12;
    const prevFromMoon = (moon.signIndex + 11) % 12;
    const realFive = ['Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
    const flanking = realPlanets.filter(
      (p) => realFive.includes(p.name) && (p.signIndex === nextFromMoon || p.signIndex === prevFromMoon)
    );
    if (flanking.length === 0) {
      const hasKendraFromMoon = realPlanets.some(
        (p) => realFive.includes(p.name) && [0, 3, 6, 9].includes((p.signIndex - moon.signIndex + 12) % 12)
      );
      const jupAspectsMoon = Boolean(jupiter && doesPlanetAspectSign(jupiter, moon.signIndex));
      const cancelled = hasKendraFromMoon || jupAspectsMoon;
      doshas.push({
        slug: 'kemadruma',
        name: cancelled ? 'Kemadruma Bhanga (Cancelled)' : 'Kemadruma Yoga',
        active: !cancelled,
        severity: cancelled ? 2 : 6,
        planets: ['Moon'],
        cancelledOrMitigated: cancelled,
        notes: cancelled
          ? 'Empty 2nd/12th from Moon is cancelled by Kendra planetary support or Jupiter aspect.'
          : 'No planets flanking 2nd/12th from Moon; favors deliberate emotional anchors.',
      });
    }
  }

  // 6. Papakartari on Lagna (1H) or 7H
  const isNaturalMalefic = (name: string) =>
    NATURAL_MALEFICS.has(name) || (name === 'Moon' && !isMoonWaxing);
  for (const targetH of [1, 7, 10]) {
    const prevH = targetH === 1 ? 12 : targetH - 1;
    const nextH = targetH === 12 ? 1 : targetH + 1;
    const prevMal = realPlanets.filter((p) => p.house === prevH && isNaturalMalefic(p.name)).map((p) => p.name);
    const nextMal = realPlanets.filter((p) => p.house === nextH && isNaturalMalefic(p.name)).map((p) => p.name);
    const prevBen = realPlanets.some((p) => p.house === prevH && !isNaturalMalefic(p.name));
    const nextBen = realPlanets.some((p) => p.house === nextH && !isNaturalMalefic(p.name));
    if (prevMal.length > 0 && nextMal.length > 0 && !prevBen && !nextBen) {
      doshas.push({
        slug: `papakartari_h${targetH}`,
        name: `Papakartari on House ${targetH}`,
        active: true,
        severity: 6,
        planets: [...prevMal, ...nextMal],
        cancelledOrMitigated: false,
        notes: `House ${targetH} is hemmed between malefics (${prevMal.join(',')} in H${prevH}, ${nextMal.join(',')} in H${nextH}).`,
      });
    }
  }

  // 7. Financial & Structural Checks (2L in 12H, Daridra, 10L combust, 7L in 6/8/12)
  const l2 = findP(houseLord(2));
  const l7 = findP(houseLord(7));
  const l10 = findP(houseLord(10));
  const l11 = findP(houseLord(11));

  if (l2 && l2.house === 12) {
    doshas.push({
      slug: '2l_in_12h',
      name: '2nd Lord in 12th House (Outflow Leakage)',
      active: true,
      severity: l2.dignity === 'Exalted' || l2.dignity === 'Own Sign' ? 3 : 5,
      planets: [l2.name],
      cancelledOrMitigated: l2.dignity === 'Exalted' || l2.dignity === 'Own Sign',
      notes: `2nd lord ${l2.name} in 12th indicates high expenses or foreign/investment outflow unless structured.`,
    });
  }

  if (l11 && [6, 8, 12].includes(l11.house)) {
    const jupRescue = Boolean(jupiter && doesPlanetAspectSign(jupiter, l11.signIndex));
    const sav11 = ashtakavarga?.sarva[(ascSign + 10) % 12] ?? 25;
    doshas.push({
      slug: 'daridra_11l',
      name: 'Daridra / 11th Lord in Dusthana',
      active: !jupRescue && sav11 < 25,
      severity: jupRescue || sav11 >= 28 ? 3 : 6,
      planets: [l11.name],
      cancelledOrMitigated: jupRescue || sav11 >= 28,
      notes: `11th lord ${l11.name} in H${l11.house} (11H SAV=${sav11})${jupRescue ? ', Jupiter aspect supports recovery' : ''}.`,
    });
  }

  if (l10 && conditions.find((c) => c.planet === l10.name)?.isCombust) {
    doshas.push({
      slug: '10l_combust',
      name: '10th Lord Combust',
      active: true,
      severity: 5,
      planets: [l10.name],
      cancelledOrMitigated: Boolean(conditions.find((c) => c.planet === l10.name)?.isVargottama),
      notes: `Career lord ${l10.name} is combust near Sun; public recognition may require behind-the-scenes leadership.`,
    });
  }

  if (l7 && [6, 8, 12].includes(l7.house)) {
    const venD9 = d9?.placements.find((pl) => pl.name === 'Venus');
    const venD9Dig = venD9 ? getDignity('Venus', venD9.signIndex) : 'Neutral';
    const rescued = venD9Dig === 'Exalted' || venD9Dig === 'Own Sign' || Boolean(venus && venus.house !== 6 && venus.house !== 8);
    doshas.push({
      slug: '7l_dusthana',
      name: `7th Lord in ${l7.house}th House`,
      active: true,
      severity: rescued ? 4 : 6,
      planets: [l7.name],
      cancelledOrMitigated: rescued,
      notes: `7th lord ${l7.name} sits in H${l7.house} (${l7.sign}); interpret via D9 Venus & KP 7th CSL before assuming difficulty.`,
    });
  }

  return {
    badhaka,
    marakaPlanets,
    kendradhipati,
    neechaBhanga,
    doshas,
  };
}

// 6. Dispositor Chain & Final Dispositors
export function computeDispositorChain(planets: PlanetPosition[]): DispositorChainReport {
  const seven = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const links: Array<{ planet: string; sign: string; dispositor: string }> = [];
  const finalDispositors: string[] = [];
  const mutualReceptions: Array<[string, string]> = [];

  for (const name of seven) {
    const p = planets.find((x) => x.name === name);
    if (!p) continue;
    const disp = SIGN_LORDS[p.signIndex];
    links.push({ planet: name, sign: p.sign, dispositor: disp });
    if (disp === name) {
      finalDispositors.push(name);
    }
  }

  const seenPairs = new Set<string>();
  for (const a of links) {
    if (a.planet === a.dispositor) continue;
    const b = links.find((l) => l.planet === a.dispositor);
    if (b && b.dispositor === a.planet) {
      const pairKey = [a.planet, b.planet].sort().join('-');
      if (!seenPairs.has(pairKey)) {
        seenPairs.add(pairKey);
        mutualReceptions.push([a.planet, b.planet]);
      }
    }
  }

  return { links, finalDispositors, mutualReceptions };
}

// 7. Planetary Health Index (0–100)
export function computePlanetaryHealthIndex(params: {
  planets: PlanetPosition[];
  vargas: Record<string, { ascendantSignIndex: number; placements: Array<{ name: string; signIndex: number; sign: string; house: number }> }>;
  shadbala: ShadbalaReport;
  conditions: PlanetaryConditionRow[];
  structuralFlags: StructuralFlagsReport;
  bhavaChalit?: BhavaChalitReport;
}): PlanetaryHealthRow[] {
  const { planets, vargas, shadbala, conditions, structuralFlags, bhavaChalit } = params;
  const realPlanets = planets.filter((p) => p.name !== 'Ascendant');
  const isMoonWaxing = getMoonWaxingStatus(planets);
  const d9 = vargas.D9;
  const multiDivs = ['D10', 'D2', 'D4', 'D7', 'D60'];

  return realPlanets.map((p) => {
    const factors: string[] = [];
    let d1Score = 36;

    // Dignity
    if (p.dignity === 'Exalted') {
      d1Score += 18;
      factors.push('Exalted D1 (+18)');
    } else if (p.dignity === 'Own Sign') {
      d1Score += 14;
      factors.push('Own Sign D1 (+14)');
    } else if (p.dignity === 'Debilitated') {
      d1Score -= 16;
      factors.push('Debilitated D1 (-16)');
    } else {
      const signLord = SIGN_LORDS[p.signIndex];
      const rel = NATURAL_FRIENDS[p.name];
      if (rel?.friends.includes(signLord)) d1Score += 6;
      else if (rel?.enemies.includes(signLord)) d1Score -= 5;
    }

    // Neecha Bhanga rescue
    const nb = structuralFlags.neechaBhanga.find((n) => n.planet === p.name && n.isCancelled);
    if (nb) {
      d1Score += 12;
      factors.push('Neecha Bhanga (+12)');
    }

    // House placement
    if ([1, 4, 5, 7, 9, 10].includes(p.house)) {
      d1Score += 7;
    } else if ([3, 11].includes(p.house)) {
      d1Score += 4;
    } else if ([6, 8, 12].includes(p.house)) {
      d1Score -= 7;
      factors.push(`Dusthana H${p.house} (-7)`);
    }

    // Shadbala ratio
    const sb = shadbala.planets.find((r) => r.planet === p.name);
    if (sb) {
      if (sb.ratio >= 1.25) {
        d1Score += 10;
        factors.push(`Shadbala ${sb.ratio}x (+10)`);
      } else if (sb.ratio >= 1.0) {
        d1Score += 6;
      } else if (sb.ratio < 0.75) {
        d1Score -= 8;
        factors.push(`Low Shadbala ${sb.ratio}x (-8)`);
      }
    }

    // Condition (Combustion, Retrograde, Nakshatra Lord)
    const cond = conditions.find((c) => c.planet === p.name);
    if (cond?.isCombust) {
      const pen = p.isRetrograde || cond.isVargottama ? -6 : -12;
      d1Score += pen;
      factors.push(`Combust (${pen})`);
    }
    if (p.isRetrograde && p.name !== 'Rahu' && p.name !== 'Ketu') {
      d1Score += 4;
      factors.push('Retrograde Cheshta (+4)');
    }

    // Papakartari on planet sign
    const prevS = (p.signIndex + 11) % 12;
    const nextS = (p.signIndex + 1) % 12;
    const isMal = (name: string) => NATURAL_MALEFICS.has(name) || (name === 'Moon' && !isMoonWaxing);
    const hasPrevMal = realPlanets.some((o) => o.signIndex === prevS && isMal(o.name));
    const hasNextMal = realPlanets.some((o) => o.signIndex === nextS && isMal(o.name));
    const hasSideBen = realPlanets.some(
      (o) => (o.signIndex === prevS || o.signIndex === nextS) && !isMal(o.name)
    );
    const isPapakartari = hasPrevMal && hasNextMal && !hasSideBen;
    if (isPapakartari) {
      d1Score -= 7;
      factors.push('Papakartari (-7)');
    }

    // Bhava Chalit shift note
    const shift = bhavaChalit?.shifts.find((s) => s.planet === p.name && s.shifted);
    if (shift) {
      factors.push(`Chalit H${shift.rashiHouse}->H${shift.chalitHouse}`);
    }

    d1Score = Math.max(0, Math.min(70, Math.round(d1Score)));

    // D9 Modifier (-15..+15)
    let d9Modifier = 0;
    const d9Pos = d9?.placements.find((pl) => pl.name === p.name);
    if (d9Pos) {
      const d9Dig = getDignity(p.name, d9Pos.signIndex);
      if (d9Dig === 'Exalted') {
        d9Modifier += 13;
        factors.push('D9 Exalted (+13)');
      } else if (d9Dig === 'Own Sign') {
        d9Modifier += 10;
        factors.push('D9 Own (+10)');
      } else if (d9Dig === 'Debilitated') {
        d9Modifier -= cond?.isVargottama ? 4 : 12;
        factors.push('D9 Debilitated (-12)');
      }
      if ([1, 4, 5, 7, 9, 10].includes(d9Pos.house)) d9Modifier += 2;
      else if ([6, 8, 12].includes(d9Pos.house)) d9Modifier -= 3;
    }
    d9Modifier = Math.max(-15, Math.min(15, d9Modifier));

    // Multi-Varga Bonus (-15..+15)
    let multiVargaBonus = 0;
    if (cond?.isVargottama) {
      multiVargaBonus += 8;
      factors.push('Vargottama (+8)');
    }
    for (const divKey of multiDivs) {
      const vp = vargas[divKey]?.placements.find((pl) => pl.name === p.name);
      if (!vp) continue;
      const vDig = getDignity(p.name, vp.signIndex);
      if (vDig === 'Exalted' || vDig === 'Own Sign') multiVargaBonus += 2;
      else if (vDig === 'Debilitated') multiVargaBonus -= 2;
    }
    multiVargaBonus = Math.max(-15, Math.min(15, multiVargaBonus));

    const totalScore = Math.max(0, Math.min(100, d1Score + d9Modifier + multiVargaBonus));
    const tier: PlanetaryHealthRow['tier'] =
      totalScore >= 85
        ? 'Elite'
        : totalScore >= 70
        ? 'Strong'
        : totalScore >= 55
        ? 'Moderate'
        : totalScore >= 40
        ? 'Weak'
        : 'Compromised';

    return {
      planet: p.name,
      d1Score,
      d9Modifier,
      multiVargaBonus,
      totalScore,
      tier,
      isNeechaBhanga: Boolean(nb),
      isPapakartari,
      factors,
    };
  });
}

// 8. Scored Yoga Registry (Yoga Strength Index 0–110)
export function computeScoredYogaRegistry(params: {
  planets: PlanetPosition[];
  vargas: Record<string, { ascendantSignIndex: number; placements: Array<{ name: string; signIndex: number; sign: string; house: number }> }>;
  conditions: PlanetaryConditionRow[];
  planetaryHealth: PlanetaryHealthRow[];
  structuralFlags: StructuralFlagsReport;
}): ScoredYogaItem[] {
  const { planets, vargas, conditions, planetaryHealth, structuralFlags } = params;
  const baseYogas = [...computeMajorYogas(planets)];

  // Append active Neecha Bhanga Raja Yogas & Parivartana Yogas
  for (const nb of structuralFlags.neechaBhanga) {
    if (nb.isCancelled) {
      baseYogas.push({
        name: `Neecha Bhanga Raja Yoga (${nb.planet})`,
        category: 'Raja Yoga',
        planets: [nb.planet],
        summary: `${nb.planet} debilitation cancelled (${nb.conditionsMet[0] || 'classical cancel'}), converting early friction into mature authority.`,
      });
    }
  }

  // Parivartana checks (mutual sign exchange among 7 core planets)
  const ascSign = planets.find((p) => p.name === 'Ascendant')?.signIndex ?? 0;
  const houseLord = (h: number) => SIGN_LORDS[(ascSign + h - 1) % 12];
  const seven = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const seenExch = new Set<string>();
  for (const aName of seven) {
    const a = planets.find((p) => p.name === aName);
    if (!a) continue;
    const bName = SIGN_LORDS[a.signIndex];
    if (bName === aName) continue;
    const b = planets.find((p) => p.name === bName);
    if (b && SIGN_LORDS[b.signIndex] === aName) {
      const key = [aName, bName].sort().join('-');
      if (!seenExch.has(key)) {
        seenExch.add(key);
        const dusthanaInvolvement = [6, 8, 12].includes(a.house) || [6, 8, 12].includes(b.house);
        const typeLabel = dusthanaInvolvement ? 'Dainya Parivartana' : 'Maha Parivartana';
        baseYogas.push({
          name: `${typeLabel} Yoga (${aName} ↔ ${bName})`,
          category: dusthanaInvolvement ? 'Special' : 'Raja Yoga',
          planets: [aName, bName],
          summary: `Mutual sign exchange between ${aName} (H${a.house}) and ${bName} (H${b.house}); creates a closed reinforcement loop.`,
        });
      }
    }
  }
  void houseLord;

  const d9 = vargas.D9;
  const scored: ScoredYogaItem[] = baseYogas.map((y) => {
    const involved = y.planets
      .map((name) => planets.find((p) => p.name === name))
      .filter((p): p is PlanetPosition => Boolean(p));

    // 1. Structural Validity (0..25)
    let structuralValidity = y.category === 'Challenging' ? 14 : 20;
    if (y.category === 'Mahapurusha' || y.category === 'Raja Yoga') structuralValidity = 23;
    if (y.name.includes('Cancelled') || y.name.includes('Bhanga')) structuralValidity = 21;

    // 2. Planetary Strength (0..25) from average PHI
    const avgPhi =
      involved.length > 0
        ? involved.reduce((acc, p) => acc + (planetaryHealth.find((h) => h.planet === p.name)?.totalScore ?? 55), 0) /
          involved.length
        : 55;
    const planetaryStrength = Math.max(0, Math.min(25, Math.round((avgPhi / 100) * 25)));

    // 3. D1 Degree Precision (0..25)
    let d1DegreePrecision = 17;
    if (involved.length >= 2) {
      const orb = circularDist(involved[0].longitude, involved[1].longitude);
      const minAngle = Math.min(orb, Math.abs(orb - 180), Math.abs(orb - 90));
      d1DegreePrecision = minAngle <= 3 ? 25 : minAngle <= 8 ? 21 : minAngle <= 15 ? 16 : 12;
    } else if (involved.length === 1) {
      const deg = involved[0].degreeInSign;
      d1DegreePrecision = deg >= 5 && deg <= 25 ? 22 : deg >= 1 && deg <= 29 ? 16 : 10;
    }

    // 4. D9 Reinforcement (0..25)
    let d9Score = 14;
    for (const p of involved) {
      const d9Pl = d9?.placements.find((pl) => pl.name === p.name);
      const cond = conditions.find((c) => c.planet === p.name);
      if (cond?.isVargottama) d9Score += 6;
      if (d9Pl) {
        const d9Dig = getDignity(p.name, d9Pl.signIndex);
        if (d9Dig === 'Exalted' || d9Dig === 'Own Sign') d9Score += 5;
        else if (d9Dig === 'Debilitated') d9Score -= 6;
      }
    }
    const d9Reinforcement = Math.max(0, Math.min(25, d9Score));

    // 5. Classical Bias (+5..+10 only when clean)
    const hasCombustOrUncancelledDeb = involved.some((p) => {
      const c = conditions.find((row) => row.planet === p.name);
      const isUncancelledDeb =
        p.dignity === 'Debilitated' &&
        !structuralFlags.neechaBhanga.some((n) => n.planet === p.name && n.isCancelled);
      return Boolean(c?.isCombust) || isUncancelledDeb;
    });
    const classicalBias =
      !hasCombustOrUncancelledDeb && (y.category === 'Raja Yoga' || y.category === 'Mahapurusha' || y.category === 'Dhana Yoga')
        ? 8
        : 0;

    const ysiTotal = Math.max(
      0,
      Math.min(110, structuralValidity + planetaryStrength + d1DegreePrecision + d9Reinforcement + classicalBias)
    );

    const status: ScoredYogaItem['status'] =
      hasCombustOrUncancelledDeb && ysiTotal < 60
        ? 'Blocked'
        : ysiTotal >= 75
        ? 'Foundational'
        : ysiTotal >= 62
        ? 'Active'
        : ysiTotal >= 48
        ? 'Conditional'
        : 'Latent';

    return {
      ...y,
      ysiTotal,
      status,
      breakdown: {
        structuralValidity,
        planetaryStrength,
        d1DegreePrecision,
        d9Reinforcement,
        classicalBias,
      },
    };
  });

  return scored.sort((a, b) => b.ysiTotal - a.ysiTotal);
}

// 9. Double Transit Overlap Matrix (Jupiter + Saturn + Mars + SAV Volume Knob)
export function computeDoubleTransitMatrix(params: {
  natalPlanets: PlanetPosition[];
  ashtakavarga: AshtakavargaTable;
  transitPlanets: PlanetPosition[];
  transitDateISO?: string;
}): DoubleTransitReport {
  const { natalPlanets, ashtakavarga, transitPlanets } = params;
  const ascSign = natalPlanets.find((p) => p.name === 'Ascendant')?.signIndex ?? 0;
  const moonSign = natalPlanets.find((p) => p.name === 'Moon')?.signIndex ?? ascSign;

  const tJup = transitPlanets.find((p) => p.name === 'Jupiter');
  const tSat = transitPlanets.find((p) => p.name === 'Saturn');
  const tMars = transitPlanets.find((p) => p.name === 'Mars');

  const jupSign = tJup?.signIndex ?? 0;
  const satSign = tSat?.signIndex ?? 0;
  const marsSign = tMars?.signIndex ?? 0;

  const jupTargets = new Set([0, 4, 6, 8].map((o) => (jupSign + o) % 12));
  const satTargets = new Set([0, 2, 6, 9].map((o) => (satSign + o) % 12));
  const marsTargets = new Set([0, 3, 6, 7].map((o) => (marsSign + o) % 12));

  const houses: DoubleTransitHouseRow[] = [];
  const doubleTransitHouses: number[] = [];

  for (let h = 1; h <= 12; h++) {
    const signIndex = (ascSign + h - 1) % 12;
    const houseFromMoon = ((signIndex - moonSign + 12) % 12) + 1;
    const jupiterActivated = Boolean(tJup && jupTargets.has(signIndex));
    const saturnActivated = Boolean(tSat && satTargets.has(signIndex));
    const doubleTransitActive = jupiterActivated && saturnActivated;
    const marsTriggered = Boolean(tMars && marsTargets.has(signIndex));
    if (doubleTransitActive) doubleTransitHouses.push(h);

    const savBindus = ashtakavarga.sarva[signIndex] ?? 25;
    const savVolumeBand: DoubleTransitHouseRow['savVolumeBand'] =
      savBindus >= 28 ? 'High (>=28)' : savBindus >= 20 ? 'Standard (20-27)' : 'Low (<20)';

    houses.push({
      house: h,
      houseFromMoon,
      signIndex,
      sign: SIGNS[signIndex],
      jupiterActivated,
      saturnActivated,
      doubleTransitActive,
      marsTriggered,
      savBindus,
      savVolumeBand,
      jupiterBav: ashtakavarga.bhinna.Jupiter?.[signIndex] ?? 4,
      saturnBav: ashtakavarga.bhinna.Saturn?.[signIndex] ?? 4,
    });
  }

  return {
    transitDate: params.transitDateISO || new Date().toISOString().slice(0, 10),
    jupiterSign: tJup?.sign || 'Unknown',
    saturnSign: tSat?.sign || 'Unknown',
    marsSign: tMars?.sign || 'Unknown',
    doubleTransitHouses,
    houses,
  };
}

// 10. Current + Upcoming Next Sign-Change Transit Pairs (Zero External API Cost)
function computeSiderealSlowLongitudesAtJD(jd: number): {
  Jupiter: number;
  Saturn: number;
  Rahu: number;
  Ketu: number;
} {
  const d = jd - 2451543.5;
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  const lahiri = getLahiriAyanamsaApprox(jd);
  const precession = 1.39697 * ((jd - 2451545.0) / 36525.0);

  const solveKepler = (Mdeg: number, e: number): number => {
    const M = normalizeDeg(Mdeg) * toRad;
    let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
    for (let k = 0; k < 6; k++) {
      E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    }
    return E;
  };

  const helioXY = (N: number, i: number, w: number, a: number, e: number, M: number) => {
    const E = solveKepler(M, e);
    const xv = a * (Math.cos(E) - e);
    const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const v = Math.atan2(yv, xv);
    const r = Math.hypot(xv, yv);
    const Nrad = N * toRad;
    const irad = i * toRad;
    const vw = v + w * toRad;
    const xh = r * (Math.cos(Nrad) * Math.cos(vw) - Math.sin(Nrad) * Math.sin(vw) * Math.cos(irad));
    const yh = r * (Math.sin(Nrad) * Math.cos(vw) + Math.cos(Nrad) * Math.sin(vw) * Math.cos(irad));
    return { xh, yh };
  };

  // Earth
  const wSun = 282.9404 + 4.70935e-5 * d;
  const eSun = 0.016709 - 1.151e-9 * d;
  const MSun = 356.047 + 0.9856002585 * d;
  const ESun = solveKepler(MSun, eSun);
  const xvS = Math.cos(ESun) - eSun;
  const yvS = Math.sqrt(1 - eSun * eSun) * Math.sin(ESun);
  const lSun = Math.atan2(yvS, xvS) + wSun * toRad;
  const rSun = Math.hypot(xvS, yvS);
  const xe = -rSun * Math.cos(lSun);
  const ye = -rSun * Math.sin(lSun);

  const siderealGeo = (xh: number, yh: number) =>
    normalizeDeg(Math.atan2(yh - ye, xh - xe) * toDeg + precession - lahiri);

  // Jupiter & Saturn (Schlyter/Meeus elements)
  const ju = helioXY(100.4542 + 2.76854e-5 * d, 1.303 - 1.557e-7 * d, 273.8777 + 1.64505e-5 * d, 5.20256, 0.048498 + 4.469e-9 * d, 19.895 + 0.0830853001 * d);
  const sa = helioXY(113.6634 + 2.3898e-5 * d, 2.4886 - 1.081e-7 * d, 339.3939 + 2.97661e-5 * d, 9.55475, 0.055546 - 9.499e-9 * d, 316.967 + 0.0334442282 * d);

  // Mean Lunar Node (Rahu)
  const T = (jd - 2451545.0) / 36525.0;
  const rahuTrop = normalizeDeg(125.04452 - 1934.136261 * T + 0.0020708 * T * T);
  const rahuSid = normalizeDeg(rahuTrop - lahiri);

  return {
    Jupiter: siderealGeo(ju.xh, ju.yh),
    Saturn: siderealGeo(sa.xh, sa.yh),
    Rahu: rahuSid,
    Ketu: normalizeDeg(rahuSid + 180),
  };
}

export function computeSlowPlanetTransitPairs(
  siderealTransitPlanets: PlanetPosition[],
  transitDateISO: string
): SlowPlanetTransitPair[] {
  const [y, m, d] = (transitDateISO || new Date().toISOString().slice(0, 10)).split('-').map(Number);
  const baseJd = toJulianDay(y || 2026, m || 1, d || 1, 12);
  const targetNames: Array<'Jupiter' | 'Saturn' | 'Rahu' | 'Ketu'> = ['Jupiter', 'Saturn', 'Rahu', 'Ketu'];
  const maxDays = 1150; // ~3.15 years lookahead covers Saturn & Rahu/Ketu ingresses cleanly

  return targetNames.map((pName) => {
    const apiPos = siderealTransitPlanets.find((p) => p.name === pName);
    const baseMath = computeSiderealSlowLongitudesAtJD(baseJd);
    const currentSignIndex = apiPos?.signIndex ?? Math.floor(baseMath[pName] / 30) % 12;
    const currentDegreeInSign = apiPos?.degreeInSign ?? Number((baseMath[pName] % 30).toFixed(2));
    const isRetrograde = apiPos?.isRetrograde ?? (pName === 'Rahu' || pName === 'Ketu');

    let daysUntilIngress = 365;
    let nextSignIndex = (currentSignIndex + (pName === 'Rahu' || pName === 'Ketu' ? 11 : 1)) % 12;
    let direction: 'forward' | 'backward' = pName === 'Rahu' || pName === 'Ketu' ? 'backward' : 'forward';

    // Step weekly first, then refine by single day around sign boundary
    let foundDay = -1;
    for (let day = 7; day <= maxDays; day += 7) {
      const lon = computeSiderealSlowLongitudesAtJD(baseJd + day)[pName];
      const sIdx = Math.floor(lon / 30) % 12;
      if (sIdx !== currentSignIndex) {
        for (let fine = Math.max(1, day - 7); fine <= day; fine++) {
          const fineLon = computeSiderealSlowLongitudesAtJD(baseJd + fine)[pName];
          const fineSign = Math.floor(fineLon / 30) % 12;
          if (fineSign !== currentSignIndex) {
            foundDay = fine;
            nextSignIndex = fineSign;
            const forwardDiff = (fineSign - currentSignIndex + 12) % 12;
            direction = forwardDiff === 1 ? 'forward' : 'backward';
            break;
          }
        }
        break;
      }
    }

    if (foundDay > 0) {
      daysUntilIngress = foundDay;
    }

    const baseMs = Date.parse(`${transitDateISO}T12:00:00Z`) || Date.now();
    const ingressDate = new Date(baseMs + daysUntilIngress * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return {
      planet: pName,
      currentSignIndex,
      currentSign: SIGNS[currentSignIndex],
      currentDegreeInSign: Number(currentDegreeInSign.toFixed(2)),
      isRetrograde,
      nextSignIndex,
      nextSign: SIGNS[nextSignIndex],
      nextIngressApproxDate: ingressDate,
      daysUntilIngress,
      direction,
    };
  });
}

// 11. Deterministic Sidereal Lahiri 9-Planet Ephemeris (Fallback when live FreeAstrologyAPI is unavailable)
export function computeDeterministicSiderealPlanets(dateISO?: string): PlanetPosition[] {
  const safeDate =
    dateISO && /^\d{4}-\d{2}-\d{2}$/.test(dateISO)
      ? dateISO
      : new Date().toISOString().slice(0, 10);
  const [y, m, day] = safeDate.split('-').map(Number);
  const jd = toJulianDay(y || 2026, m || 1, day || 1, 12);

  const computeAtJD = (j: number): Record<string, number> => {
    const d = j - 2451543.5;
    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;
    const lahiri = getLahiriAyanamsaApprox(j);
    const precession = 1.39697 * ((j - 2451545.0) / 36525.0);

    const solveKepler = (Mdeg: number, e: number): number => {
      const M = normalizeDeg(Mdeg) * toRad;
      let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
      for (let k = 0; k < 6; k++) {
        E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      }
      return E;
    };

    const helioXY = (N: number, i: number, w: number, a: number, e: number, M: number) => {
      const E = solveKepler(M, e);
      const xv = a * (Math.cos(E) - e);
      const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
      const v = Math.atan2(yv, xv);
      const r = Math.hypot(xv, yv);
      const Nrad = N * toRad;
      const irad = i * toRad;
      const vw = v + w * toRad;
      const xh = r * (Math.cos(Nrad) * Math.cos(vw) - Math.sin(Nrad) * Math.sin(vw) * Math.cos(irad));
      const yh = r * (Math.sin(Nrad) * Math.cos(vw) + Math.cos(Nrad) * Math.sin(vw) * Math.cos(irad));
      return { xh, yh };
    };

    // Earth / Sun
    const wSun = 282.9404 + 4.70935e-5 * d;
    const eSun = 0.016709 - 1.151e-9 * d;
    const MSun = 356.047 + 0.9856002585 * d;
    const ESun = solveKepler(MSun, eSun);
    const xvS = Math.cos(ESun) - eSun;
    const yvS = Math.sqrt(1 - eSun * eSun) * Math.sin(ESun);
    const lSun = Math.atan2(yvS, xvS) + wSun * toRad;
    const rSun = Math.hypot(xvS, yvS);
    const xe = -rSun * Math.cos(lSun);
    const ye = -rSun * Math.sin(lSun);

    const siderealGeo = (xh: number, yh: number) =>
      normalizeDeg(Math.atan2(yh - ye, xh - xe) * toDeg + precession - lahiri);

    const sunSid = siderealGeo(0, 0);

    // Moon (Schlyter orbital elements + main lunar perturbations)
    const Nm = 125.1228 - 0.0529538083 * d;
    const wm = 318.0634 + 0.1643573223 * d;
    const Mm = 115.3654 + 13.0649929509 * d;
    const moonXY = helioXY(Nm, 5.1454, wm, 60.2666, 0.0549, Mm);
    const Ls = MSun + wSun;
    const Lm = Mm + wm + Nm;
    const Dm = Lm - Ls;
    const Fm = Lm - Nm;
    const deltaMoon =
      -1.274 * Math.sin((Mm - 2 * Dm) * toRad) +
      0.658 * Math.sin(2 * Dm * toRad) -
      0.186 * Math.sin(MSun * toRad) -
      0.059 * Math.sin((2 * Mm - 2 * Dm) * toRad) -
      0.057 * Math.sin((Mm - 2 * Dm + MSun) * toRad) +
      0.053 * Math.sin((Mm + 2 * Dm) * toRad) +
      0.046 * Math.sin((2 * Dm - MSun) * toRad) +
      0.041 * Math.sin((Mm - MSun) * toRad) -
      0.035 * Math.sin(Dm * toRad) -
      0.031 * Math.sin((Mm + MSun) * toRad) -
      0.015 * Math.sin((2 * Fm - 2 * Dm) * toRad) +
      0.011 * Math.sin((Mm - 4 * Dm) * toRad);
    const moonSid = normalizeDeg(
      Math.atan2(moonXY.yh, moonXY.xh) * toDeg + deltaMoon + precession - lahiri
    );

    const me = helioXY(
      48.3313 + 3.24587e-5 * d,
      7.0047 + 5.0e-8 * d,
      29.1241 + 1.01444e-5 * d,
      0.387098,
      0.205635 + 5.59e-10 * d,
      168.6562 + 4.0923344368 * d
    );
    const ve = helioXY(
      76.6799 + 2.4659e-5 * d,
      3.3946 + 2.75e-8 * d,
      54.891 + 1.38374e-5 * d,
      0.72333,
      0.006773 - 1.302e-9 * d,
      48.0052 + 1.6021302244 * d
    );
    const ma = helioXY(
      49.5574 + 2.11081e-5 * d,
      1.8497 - 1.78e-8 * d,
      286.5016 + 2.92961e-5 * d,
      1.523688,
      0.093405 + 2.516e-9 * d,
      18.6021 + 0.5240207766 * d
    );

    const slow = computeSiderealSlowLongitudesAtJD(j);

    return {
      Sun: sunSid,
      Moon: moonSid,
      Mars: siderealGeo(ma.xh, ma.yh),
      Mercury: siderealGeo(me.xh, me.yh),
      Jupiter: slow.Jupiter,
      Venus: siderealGeo(ve.xh, ve.yh),
      Saturn: slow.Saturn,
      Rahu: slow.Rahu,
      Ketu: slow.Ketu,
    };
  };

  const nowLon = computeAtJD(jd);
  const prevLon = computeAtJD(jd - 1);
  const orderedNames = [
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

  return orderedNames.map((name) => {
    const lon = normalizeDeg(nowLon[name]);
    const signIndex = Math.floor(lon / 30) % 12;
    const degreeInSign = lon % 30;
    const nak = getNakshatraAndSubs(lon);
    let delta = lon - prevLon[name];
    if (delta < -180) delta += 360;
    if (delta > 180) delta -= 360;
    const isRetrograde =
      name === 'Rahu' || name === 'Ketu'
        ? true
        : name === 'Sun' || name === 'Moon'
        ? false
        : delta < 0;

    return {
      name,
      longitude: Number(lon.toFixed(4)),
      signIndex,
      sign: SIGNS[signIndex],
      degreeInSign: Number(degreeInSign.toFixed(4)),
      dms: formatDMS(degreeInSign),
      nakshatra: nak.nakshatra,
      nakshatraIndex: nak.nakshatraIndex,
      nakshatraLord: nak.nakshatraLord,
      pada: nak.pada,
      subLord: nak.subLord,
      subSubLord: nak.subSubLord,
      isRetrograde,
      house: signIndex + 1,
      dignity: getDignity(name, signIndex),
    };
  });
}

// 12. Deterministic Dasha & Slow-Transit 3-Step Visual Progress Widgets (Zero LLM Math)
export interface TimingWidgetChartInput {
  vimshottari?: {
    timeline?: DashaNode[];
    currentStack?: {
      mahadasha: string;
      antardasha: string;
      pratyantardasha: string;
      mdStart?: string;
      mdEnd: string;
      adStart?: string;
      adEnd: string;
      pdStart?: string;
      pdEnd: string;
    } | null;
  };
}

export interface TimingWidgetTransitFeedInput {
  transitDate?: string;
  planets?: PlanetPosition[];
  slowTransitPairs?: SlowPlanetTransitPair[];
}

const PLANET_ABBR_3: Record<string, string> = {
  Sun: 'Sun',
  Moon: 'Moo',
  Mars: 'Mar',
  Mercury: 'Mer',
  Jupiter: 'Jup',
  Venus: 'Ven',
  Saturn: 'Sat',
  Rahu: 'Rah',
  Ketu: 'Ket',
};

const DISPLAY_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function formatWidgetDisplayDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || '').trim());
  if (!m) return isoDate;
  const monthIdx = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (monthIdx < 0 || monthIdx > 11) return isoDate;
  return `${day} ${DISPLAY_MONTHS[monthIdx]} ${m[1]}`;
}

function parseUtcDayMs(isoDate: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || '').trim());
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function computeProgressMetrics(
  startDateIso: string,
  endDateIso: string,
  nowDayMs: number
): { percentElapsed: number; daysLeft: number } {
  const startMs = parseUtcDayMs(startDateIso);
  const endMs = parseUtcDayMs(endDateIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return { percentElapsed: 0, daysLeft: 0 };
  }

  let percentElapsed = 0;
  if (nowDayMs <= startMs) {
    percentElapsed = 0;
  } else if (nowDayMs >= endMs) {
    percentElapsed = 100;
  } else {
    const raw = ((nowDayMs - startMs) / (endMs - startMs)) * 100;
    percentElapsed = Math.round(Math.max(0, Math.min(100, raw)) * 10) / 10;
  }

  const daysLeft = Math.max(0, Math.round((endMs - nowDayMs) / (24 * 60 * 60 * 1000)));
  return { percentElapsed, daysLeft };
}

function findActivePeriodIndex<T extends { startDate: string; endDate: string }>(
  list: T[],
  nowISO: string
): number {
  if (list.length === 0) return -1;
  const strictIdx = list.findIndex((item) => nowISO >= item.startDate && nowISO < item.endDate);
  if (strictIdx !== -1) return strictIdx;
  const inclusiveIdx = list.findIndex((item) => nowISO >= item.startDate && nowISO <= item.endDate);
  return inclusiveIdx;
}

function computeSlowTransitWindow(
  planetName: 'Jupiter' | 'Saturn' | 'Rahu',
  nowISO: string,
  nowDayMs: number,
  pair?: SlowPlanetTransitPair
): {
  prevSignIndex: number;
  currentSignIndex: number;
  nextSignIndex: number;
  startDateIso: string;
  endDateIso: string;
  percentElapsed: number;
  daysLeft: number;
} {
  const [y, m, d] = nowISO.split('-').map(Number);
  const baseJd = toJulianDay(y || 2026, m || 1, d || 1, 12);
  const baseMath = computeSiderealSlowLongitudesAtJD(baseJd);
  const currentSignIndex = pair?.currentSignIndex ?? Math.floor(baseMath[planetName] / 30) % 12;

  const maxDays = 1300; // Covers Saturn (~912d), Rahu (~548d), Jupiter (~380d) cleanly
  let daysSinceIngress = 180;
  let prevSignIndex = (currentSignIndex + (planetName === 'Rahu' ? 1 : 11)) % 12;

  for (let day = 7; day <= maxDays; day += 7) {
    const lon = computeSiderealSlowLongitudesAtJD(baseJd - day)[planetName];
    const sIdx = Math.floor(lon / 30) % 12;
    if (sIdx !== currentSignIndex) {
      for (let fine = Math.max(1, day - 7); fine <= day; fine++) {
        const fineLon = computeSiderealSlowLongitudesAtJD(baseJd - fine)[planetName];
        const fineSign = Math.floor(fineLon / 30) % 12;
        if (fineSign !== currentSignIndex) {
          daysSinceIngress = Math.max(0, fine - 1);
          prevSignIndex = fineSign;
          break;
        }
      }
      break;
    }
  }

  let daysUntilIngress = pair?.daysUntilIngress ?? 365;
  let nextSignIndex =
    pair?.nextSignIndex ?? (currentSignIndex + (planetName === 'Rahu' ? 11 : 1)) % 12;
  let endDateIso = pair?.nextIngressApproxDate || '';

  if (!endDateIso || endDateIso < nowISO) {
    for (let day = 7; day <= maxDays; day += 7) {
      const lon = computeSiderealSlowLongitudesAtJD(baseJd + day)[planetName];
      const sIdx = Math.floor(lon / 30) % 12;
      if (sIdx !== currentSignIndex) {
        for (let fine = Math.max(1, day - 7); fine <= day; fine++) {
          const fineLon = computeSiderealSlowLongitudesAtJD(baseJd + fine)[planetName];
          const fineSign = Math.floor(fineLon / 30) % 12;
          if (fineSign !== currentSignIndex) {
            daysUntilIngress = fine;
            nextSignIndex = fineSign;
            break;
          }
        }
        break;
      }
    }
    endDateIso = new Date(nowDayMs + daysUntilIngress * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  }

  const startDateIso = new Date(nowDayMs - daysSinceIngress * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { percentElapsed, daysLeft } = computeProgressMetrics(startDateIso, endDateIso, nowDayMs);

  return {
    prevSignIndex,
    currentSignIndex,
    nextSignIndex,
    startDateIso,
    endDateIso,
    percentElapsed,
    daysLeft,
  };
}

export function buildDeterministicTimingWidgets(
  compiledChart: TimingWidgetChartInput | null | undefined,
  transitFeed?: TimingWidgetTransitFeedInput | null,
  nowDate?: Date | string
): TimingProgressWidget[] {
  const parsedNow =
    nowDate instanceof Date
      ? nowDate
      : typeof nowDate === 'string' && nowDate.trim()
      ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(nowDate.trim()) ? `${nowDate.trim()}T12:00:00Z` : nowDate)
      : new Date();
  const safeNow = Number.isNaN(parsedNow.getTime()) ? new Date() : parsedNow;
  const nowISO = safeNow.toISOString().slice(0, 10);
  const nowDayMs = parseUtcDayMs(nowISO);

  const widgets: TimingProgressWidget[] = [];
  const timeline = compiledChart?.vimshottari?.timeline || [];

  const abbr = (planet: string): string => PLANET_ABBR_3[planet] || planet.slice(0, 3);

  // 1. Vimshottari Mahadasha / Antardasha / Pratyantardasha
  if (timeline.length > 0) {
    const mdList = timeline;
    const adList: Array<{ mdLord: string; adLord: string; startDate: string; endDate: string }> =
      [];
    const pdList: Array<{
      mdLord: string;
      adLord: string;
      pdLord: string;
      startDate: string;
      endDate: string;
    }> = [];

    for (const md of mdList) {
      for (const ad of md.children || []) {
        adList.push({
          mdLord: md.lord,
          adLord: ad.lord,
          startDate: ad.startDate,
          endDate: ad.endDate,
        });
        for (const pd of ad.children || []) {
          pdList.push({
            mdLord: md.lord,
            adLord: ad.lord,
            pdLord: pd.lord,
            startDate: pd.startDate,
            endDate: pd.endDate,
          });
        }
      }
    }

    const activeAdIdx = findActivePeriodIndex(adList, nowISO);
    if (activeAdIdx !== -1) {
      const cur = adList[activeAdIdx];
      const prev = activeAdIdx > 0 ? adList[activeAdIdx - 1] : null;
      const nxt = activeAdIdx + 1 < adList.length ? adList[activeAdIdx + 1] : null;
      const metrics = computeProgressMetrics(cur.startDate, cur.endDate, nowDayMs);
      widgets.push({
        id: 'ad',
        kind: 'dasha',
        title: 'Antardasha Chapter',
        previous: {
          label: prev ? `${abbr(prev.mdLord)}-${abbr(prev.adLord)}` : 'Birth Start',
        },
        current: {
          label: `${cur.mdLord}–${cur.adLord}`,
          startDateIso: cur.startDate,
          endDateIso: cur.endDate,
          startDisplay: formatWidgetDisplayDate(cur.startDate),
          endDisplay: formatWidgetDisplayDate(cur.endDate),
          percentElapsed: metrics.percentElapsed,
          daysLeft: metrics.daysLeft,
        },
        next: {
          label: nxt ? `${abbr(nxt.mdLord)}-${abbr(nxt.adLord)}` : 'Cycle End',
        },
      });
    }

    const activePdIdx = findActivePeriodIndex(pdList, nowISO);
    if (activePdIdx !== -1) {
      const cur = pdList[activePdIdx];
      const prev = activePdIdx > 0 ? pdList[activePdIdx - 1] : null;
      const nxt = activePdIdx + 1 < pdList.length ? pdList[activePdIdx + 1] : null;
      const metrics = computeProgressMetrics(cur.startDate, cur.endDate, nowDayMs);
      widgets.push({
        id: 'pd',
        kind: 'dasha',
        title: 'Pratyantardasha Sub-Window',
        previous: {
          label: prev ? `${abbr(prev.adLord)}-${abbr(prev.pdLord)}` : 'Prior AD',
        },
        current: {
          label: `${abbr(cur.mdLord)}–${abbr(cur.adLord)}–${cur.pdLord}`,
          startDateIso: cur.startDate,
          endDateIso: cur.endDate,
          startDisplay: formatWidgetDisplayDate(cur.startDate),
          endDisplay: formatWidgetDisplayDate(cur.endDate),
          percentElapsed: metrics.percentElapsed,
          daysLeft: metrics.daysLeft,
        },
        next: {
          label: nxt ? `${abbr(nxt.adLord)}-${abbr(nxt.pdLord)}` : 'Next AD',
        },
      });
    }

    const activeMdIdx = findActivePeriodIndex(mdList, nowISO);
    if (activeMdIdx !== -1) {
      const cur = mdList[activeMdIdx];
      const prev = activeMdIdx > 0 ? mdList[activeMdIdx - 1] : null;
      const nxt = activeMdIdx + 1 < mdList.length ? mdList[activeMdIdx + 1] : null;
      const metrics = computeProgressMetrics(cur.startDate, cur.endDate, nowDayMs);
      widgets.push({
        id: 'md',
        kind: 'dasha',
        title: 'Mahadasha Era',
        previous: {
          label: prev ? `${prev.lord} MD` : 'Birth MD',
        },
        current: {
          label: `${cur.lord} Mahadasha`,
          startDateIso: cur.startDate,
          endDateIso: cur.endDate,
          startDisplay: formatWidgetDisplayDate(cur.startDate),
          endDisplay: formatWidgetDisplayDate(cur.endDate),
          percentElapsed: metrics.percentElapsed,
          daysLeft: metrics.daysLeft,
        },
        next: {
          label: nxt ? `${nxt.lord} MD` : 'Next Cycle',
        },
      });
    }
  } else if (compiledChart?.vimshottari?.currentStack) {
    const stack = compiledChart.vimshottari.currentStack;
    if (stack.adStart && stack.adEnd) {
      const metrics = computeProgressMetrics(stack.adStart, stack.adEnd, nowDayMs);
      widgets.push({
        id: 'ad',
        kind: 'dasha',
        title: 'Antardasha Chapter',
        previous: { label: 'Previous AD' },
        current: {
          label: `${stack.mahadasha}–${stack.antardasha}`,
          startDateIso: stack.adStart,
          endDateIso: stack.adEnd,
          startDisplay: formatWidgetDisplayDate(stack.adStart),
          endDisplay: formatWidgetDisplayDate(stack.adEnd),
          percentElapsed: metrics.percentElapsed,
          daysLeft: metrics.daysLeft,
        },
        next: { label: 'Next AD' },
      });
    }
  }

  // 2. Slow-Planet Gochar Progress (Saturn, Jupiter, Rahu-Ketu)
  const sameDatePairs =
    transitFeed?.transitDate === nowISO && Array.isArray(transitFeed?.slowTransitPairs)
      ? transitFeed.slowTransitPairs
      : [];

  const saturnPair = sameDatePairs.find((p) => p.planet === 'Saturn');
  const satWin = computeSlowTransitWindow('Saturn', nowISO, nowDayMs, saturnPair);
  widgets.push({
    id: 'saturn' as TimingWidgetId,
    kind: 'transit',
    title: 'Saturn Gochar',
    previous: { label: `Saturn in ${SIGNS[satWin.prevSignIndex]}` },
    current: {
      label: `Saturn in ${SIGNS[satWin.currentSignIndex]}`,
      startDateIso: satWin.startDateIso,
      endDateIso: satWin.endDateIso,
      startDisplay: formatWidgetDisplayDate(satWin.startDateIso),
      endDisplay: formatWidgetDisplayDate(satWin.endDateIso),
      percentElapsed: satWin.percentElapsed,
      daysLeft: satWin.daysLeft,
    },
    next: { label: `Saturn in ${SIGNS[satWin.nextSignIndex]}` },
  });

  const jupiterPair = sameDatePairs.find((p) => p.planet === 'Jupiter');
  const jupWin = computeSlowTransitWindow('Jupiter', nowISO, nowDayMs, jupiterPair);
  widgets.push({
    id: 'jupiter' as TimingWidgetId,
    kind: 'transit',
    title: 'Jupiter Gochar',
    previous: { label: `Jupiter in ${SIGNS[jupWin.prevSignIndex]}` },
    current: {
      label: `Jupiter in ${SIGNS[jupWin.currentSignIndex]}`,
      startDateIso: jupWin.startDateIso,
      endDateIso: jupWin.endDateIso,
      startDisplay: formatWidgetDisplayDate(jupWin.startDateIso),
      endDisplay: formatWidgetDisplayDate(jupWin.endDateIso),
      percentElapsed: jupWin.percentElapsed,
      daysLeft: jupWin.daysLeft,
    },
    next: { label: `Jupiter in ${SIGNS[jupWin.nextSignIndex]}` },
  });

  const rahuPair = sameDatePairs.find((p) => p.planet === 'Rahu');
  const rahuWin = computeSlowTransitWindow('Rahu', nowISO, nowDayMs, rahuPair);
  widgets.push({
    id: 'rahu_ketu' as TimingWidgetId,
    kind: 'transit',
    title: 'Rahu–Ketu Gochar',
    previous: {
      label: `Rahu/Ketu ${SIGNS[rahuWin.prevSignIndex].slice(0, 3)}/${SIGNS[(rahuWin.prevSignIndex + 6) % 12].slice(0, 3)}`,
    },
    current: {
      label: `Rahu ${SIGNS[rahuWin.currentSignIndex]} · Ketu ${SIGNS[(rahuWin.currentSignIndex + 6) % 12]}`,
      startDateIso: rahuWin.startDateIso,
      endDateIso: rahuWin.endDateIso,
      startDisplay: formatWidgetDisplayDate(rahuWin.startDateIso),
      endDisplay: formatWidgetDisplayDate(rahuWin.endDateIso),
      percentElapsed: rahuWin.percentElapsed,
      daysLeft: rahuWin.daysLeft,
    },
    next: {
      label: `Rahu/Ketu ${SIGNS[rahuWin.nextSignIndex].slice(0, 3)}/${SIGNS[(rahuWin.nextSignIndex + 6) % 12].slice(0, 3)}`,
    },
  });

  return widgets;
}

// 13. Deterministic Western Multi-Clock Timing Snapshot & 3-Step Visual Progress Widgets
function computeTropicalCoreAtJD(jd: number): Record<string, number> {
  const lahiri = getLahiriAyanamsaApprox(jd);
  const sidSlow = computeSiderealSlowLongitudesAtJD(jd);

  const d = jd - 2451543.5;
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  const precession = 1.39697 * ((jd - 2451545.0) / 36525.0);

  const solveKepler = (Mdeg: number, e: number): number => {
    const M = normalizeDeg(Mdeg) * toRad;
    let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
    for (let k = 0; k < 6; k++) {
      E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    }
    return E;
  };

  const helioXY = (N: number, i: number, w: number, a: number, e: number, M: number) => {
    const E = solveKepler(M, e);
    const xv = a * (Math.cos(E) - e);
    const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const v = Math.atan2(yv, xv);
    const r = Math.hypot(xv, yv);
    const Nrad = N * toRad;
    const irad = i * toRad;
    const vw = v + w * toRad;
    const xh = r * (Math.cos(Nrad) * Math.cos(vw) - Math.sin(Nrad) * Math.sin(vw) * Math.cos(irad));
    const yh = r * (Math.sin(Nrad) * Math.cos(vw) + Math.cos(Nrad) * Math.sin(vw) * Math.cos(irad));
    return { xh, yh };
  };

  const wSun = 282.9404 + 4.70935e-5 * d;
  const eSun = 0.016709 - 1.151e-9 * d;
  const MSun = 356.047 + 0.9856002585 * d;
  const ESun = solveKepler(MSun, eSun);
  const xvS = Math.cos(ESun) - eSun;
  const yvS = Math.sqrt(1 - eSun * eSun) * Math.sin(ESun);
  const lSun = Math.atan2(yvS, xvS) + wSun * toRad;
  const rSun = Math.hypot(xvS, yvS);
  const xe = -rSun * Math.cos(lSun);
  const ye = -rSun * Math.sin(lSun);
  const tropGeo = (xh: number, yh: number) =>
    normalizeDeg(Math.atan2(yh - ye, xh - xe) * toDeg + precession);

  const Nm = 125.1228 - 0.0529538083 * d;
  const wm = 318.0634 + 0.1643573223 * d;
  const Mm = 115.3654 + 13.0649929509 * d;
  const moonXY = helioXY(Nm, 5.1454, wm, 60.2666, 0.0549, Mm);
  const Ls = MSun + wSun;
  const Lm = Mm + wm + Nm;
  const Dm = Lm - Ls;
  const Fm = Lm - Nm;
  const deltaMoon =
    -1.274 * Math.sin((Mm - 2 * Dm) * toRad) +
    0.658 * Math.sin(2 * Dm * toRad) -
    0.186 * Math.sin(MSun * toRad) -
    0.059 * Math.sin((2 * Mm - 2 * Dm) * toRad) -
    0.057 * Math.sin((Mm - 2 * Dm + MSun) * toRad) +
    0.053 * Math.sin((Mm + 2 * Dm) * toRad) +
    0.046 * Math.sin((2 * Dm - MSun) * toRad) +
    0.041 * Math.sin((Mm - MSun) * toRad) -
    0.035 * Math.sin(Dm * toRad) -
    0.031 * Math.sin((Mm + MSun) * toRad) -
    0.015 * Math.sin((2 * Fm - 2 * Dm) * toRad) +
    0.011 * Math.sin((Mm - 4 * Dm) * toRad);

  const me = helioXY(48.3313 + 3.24587e-5 * d, 7.0047 + 5.0e-8 * d, 29.1241 + 1.01444e-5 * d, 0.387098, 0.205635 + 5.59e-10 * d, 168.6562 + 4.0923344368 * d);
  const ve = helioXY(76.6799 + 2.4659e-5 * d, 3.3946 + 2.75e-8 * d, 54.891 + 1.38374e-5 * d, 0.72333, 0.006773 - 1.302e-9 * d, 48.0052 + 1.6021302244 * d);
  const ma = helioXY(49.5574 + 2.11081e-5 * d, 1.8497 - 1.78e-8 * d, 286.5016 + 2.92961e-5 * d, 1.523688, 0.093405 + 2.516e-9 * d, 18.6021 + 0.5240207766 * d);

  const outers = computeOuterAndMinorTropicalBodies(jd);
  const outerMap = Object.fromEntries(outers.map((o) => [o.name, o.longitude]));

  return {
    Sun: tropGeo(0, 0),
    Moon: normalizeDeg(Math.atan2(moonXY.yh, moonXY.xh) * toDeg + deltaMoon + precession),
    Mercury: tropGeo(me.xh, me.yh),
    Venus: tropGeo(ve.xh, ve.yh),
    Mars: tropGeo(ma.xh, ma.yh),
    Jupiter: normalizeDeg(sidSlow.Jupiter + lahiri),
    Saturn: normalizeDeg(sidSlow.Saturn + lahiri),
    'North Node': normalizeDeg(sidSlow.Rahu + lahiri),
    'South Node': normalizeDeg(sidSlow.Ketu + lahiri),
    Uranus: outerMap.Uranus ?? 0,
    Neptune: outerMap.Neptune ?? 0,
    Pluto: outerMap.Pluto ?? 0,
    Chiron: outerMap.Chiron ?? 0,
  };
}

function computeTropicalAscMcAtJD(jd: number, latitude: number, longitude: number): {
  asc: number;
  mc: number;
} {
  const t = (jd - 2451545.0) / 36525.0;
  const epsDeg = 23.4392911 - 0.01300416 * t;
  const eps = (epsDeg * Math.PI) / 180;
  const latRad = (Math.max(-66, Math.min(66, latitude)) * Math.PI) / 180;
  const gmstDeg = normalizeDeg(
    280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - (t * t * t) / 38710000
  );
  const ramcDeg = normalizeDeg(gmstDeg + longitude);
  const ramc = (ramcDeg * Math.PI) / 180;
  const mcRad = Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps));
  const mc = normalizeDeg((mcRad * 180) / Math.PI);
  const ascRad = Math.atan2(
    Math.cos(ramc),
    -(Math.sin(ramc) * Math.cos(eps) + Math.tan(latRad) * Math.sin(eps))
  );
  const asc = normalizeDeg((ascRad * 180) / Math.PI);
  return { asc, mc };
}

function jdToIsoDate(jd: number): string {
  const ms = (jd - 2440587.5) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

function computeTropicalSlowTransitWindow(
  planetName: 'Jupiter' | 'Saturn',
  nowISO: string,
  nowDayMs: number
): {
  prevSignIndex: number;
  currentSignIndex: number;
  nextSignIndex: number;
  startDateIso: string;
  endDateIso: string;
  percentElapsed: number;
  daysLeft: number;
} {
  const [y, m, d] = nowISO.split('-').map(Number);
  const baseJd = toJulianDay(y || 2026, m || 1, d || 1, 12);
  const getTropLon = (j: number) => {
    const s = computeSiderealSlowLongitudesAtJD(j)[planetName];
    return normalizeDeg(s + getLahiriAyanamsaApprox(j));
  };
  const currentSignIndex = Math.floor(getTropLon(baseJd) / 30) % 12;

  const maxDays = 1300;
  let daysSinceIngress = 180;
  let prevSignIndex = (currentSignIndex + 11) % 12;

  for (let day = 7; day <= maxDays; day += 7) {
    const sIdx = Math.floor(getTropLon(baseJd - day) / 30) % 12;
    if (sIdx !== currentSignIndex) {
      for (let fine = Math.max(1, day - 7); fine <= day; fine++) {
        const fineSign = Math.floor(getTropLon(baseJd - fine) / 30) % 12;
        if (fineSign !== currentSignIndex) {
          daysSinceIngress = Math.max(0, fine - 1);
          prevSignIndex = fineSign;
          break;
        }
      }
      break;
    }
  }

  let daysUntilIngress = 365;
  let nextSignIndex = (currentSignIndex + 1) % 12;
  for (let day = 7; day <= maxDays; day += 7) {
    const sIdx = Math.floor(getTropLon(baseJd + day) / 30) % 12;
    if (sIdx !== currentSignIndex) {
      for (let fine = Math.max(1, day - 7); fine <= day; fine++) {
        const fineSign = Math.floor(getTropLon(baseJd + fine) / 30) % 12;
        if (fineSign !== currentSignIndex) {
          daysUntilIngress = fine;
          nextSignIndex = fineSign;
          break;
        }
      }
      break;
    }
  }

  const startDateIso = new Date(nowDayMs - daysSinceIngress * 86400000).toISOString().slice(0, 10);
  const endDateIso = new Date(nowDayMs + daysUntilIngress * 86400000).toISOString().slice(0, 10);
  const { percentElapsed, daysLeft } = computeProgressMetrics(startDateIso, endDateIso, nowDayMs);

  return {
    prevSignIndex,
    currentSignIndex,
    nextSignIndex,
    startDateIso,
    endDateIso,
    percentElapsed,
    daysLeft,
  };
}

export function computeWesternTimingSnapshot(params: {
  westernChart: WesternChartData;
  birthDateISO: string;
  birthTimeStr: string;
  timezoneOffsetHours: number;
  latitude: number;
  longitude: number;
  transitPlanets?: WesternPlanetPosition[] | null;
  nowDate?: Date | string;
}): WesternTimingSnapshot {
  const parsedNow =
    params.nowDate instanceof Date
      ? params.nowDate
      : typeof params.nowDate === 'string' && params.nowDate.trim()
      ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(params.nowDate.trim()) ? `${params.nowDate.trim()}T12:00:00Z` : params.nowDate)
      : new Date();
  const safeNow = Number.isNaN(parsedNow.getTime()) ? new Date() : parsedNow;
  const nowISO = safeNow.toISOString().slice(0, 10);
  const nowDayMs = parseUtcDayMs(nowISO);

  const [by, bm, bd] = (params.birthDateISO || '2000-01-01').split('-').map(Number);
  const timeParts = (params.birthTimeStr || '12:00:00').split(':').map(Number);
  const localHours = (timeParts[0] || 0) + (timeParts[1] || 0) / 60 + (timeParts[2] || 0) / 3600;
  const birthJD = toJulianDay(by || 2000, bm || 1, bd || 1, localHours - params.timezoneOffsetHours);

  const [ny, nm, nd] = nowISO.split('-').map(Number);
  const nowJD = toJulianDay(ny, nm, nd, 12);

  // 1. Annual Profections (exact birthday boundary)
  const hadBirthdayThisYear = nm > bm || (nm === bm && nd >= bd);
  const age = Math.max(0, ny - by - (hadBirthdayThisYear ? 0 : 1));
  const lastBdayYear = hadBirthdayThisYear ? ny : ny - 1;
  const nextBdayYear = lastBdayYear + 1;
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const clampDay = (yr: number, mo: number, dy: number) =>
    mo === 2 && dy === 29 && yr % 4 !== 0 ? 28 : dy;
  const yearStartIso = `${lastBdayYear}-${pad2(bm)}-${pad2(clampDay(lastBdayYear, bm, bd))}`;
  const yearEndIso = `${nextBdayYear}-${pad2(bm)}-${pad2(clampDay(nextBdayYear, bm, bd))}`;
  const profProgress = computeProgressMetrics(yearStartIso, yearEndIso, nowDayMs);

  const ascSignIdx = Math.floor((params.westernChart.angles.ascendant.longitude || 0) / 30) % 12;
  const profectedHouse = (age % 12) + 1;
  const profectedSignIdx = (ascSignIdx + profectedHouse - 1) % 12;
  const lordTrad = WESTERN_TRADITIONAL_RULERS[profectedSignIdx];
  const lordMod = WESTERN_MODERN_RULERS[profectedSignIdx];
  const lordNatalObj = params.westernChart.planets.find((p) => p.name === lordTrad);

  // 2. Secondary Progressions (1 day after birth = 1 year of life)
  const exactAgeYears = Math.max(0, (nowJD - birthJD) / 365.2422);
  const progJD = birthJD + exactAgeYears;
  const progLonNow = computeTropicalCoreAtJD(progJD);
  const progLonPrev = computeTropicalCoreAtJD(progJD - 0.05); // ~18 days in life earlier for Rx check
  const progSign = (lon: number) => SIGNS[Math.floor(normalizeDeg(lon) / 30) % 12];
  const cuspLons = params.westernChart.cusps.map((c) => c.longitude);

  const progMoonLon = progLonNow.Moon;
  const progMoonSignIdx = Math.floor(normalizeDeg(progMoonLon) / 30) % 12;
  // Find Secondary Progressed Moon sign start/end dates (each Moon day ~ 2.5 years of life)
  let pMoonDaysBefore = 1.25;
  for (let step = 0.05; step <= 3.5; step += 0.05) {
    const sIdx = Math.floor(computeTropicalCoreAtJD(progJD - step).Moon / 30) % 12;
    if (sIdx !== progMoonSignIdx) {
      pMoonDaysBefore = Math.max(0.02, step - 0.025);
      break;
    }
  }
  let pMoonDaysAfter = 1.25;
  for (let step = 0.05; step <= 3.5; step += 0.05) {
    const sIdx = Math.floor(computeTropicalCoreAtJD(progJD + step).Moon / 30) % 12;
    if (sIdx !== progMoonSignIdx) {
      pMoonDaysAfter = Math.max(0.02, step);
      break;
    }
  }
  const progMoonStartIso = new Date(nowDayMs - pMoonDaysBefore * 365.2422 * 86400000)
    .toISOString()
    .slice(0, 10);
  const progMoonEndIso = new Date(nowDayMs + pMoonDaysAfter * 365.2422 * 86400000)
    .toISOString()
    .slice(0, 10);
  const progMoonMetrics = computeProgressMetrics(progMoonStartIso, progMoonEndIso, nowDayMs);

  const natalSunLon =
    params.westernChart.planets.find((p) => p.name === 'Sun')?.longitude ?? progLonNow.Sun;
  const solarArcDelta = normalizeDeg(progLonNow.Sun - natalSunLon);
  const progAscLon = normalizeDeg(params.westernChart.angles.ascendant.longitude + solarArcDelta);
  const progMcLon = normalizeDeg(params.westernChart.angles.midheaven.longitude + solarArcDelta);

  const tightAspectsToNatal: WesternTimingSnapshot['progressions']['tightAspectsToNatal'] = [];
  const progKeys = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'] as const;
  const majorAspAngles = [
    { name: 'Conjunction', deg: 0 },
    { name: 'Sextile', deg: 60 },
    { name: 'Square', deg: 90 },
    { name: 'Trine', deg: 120 },
    { name: 'Opposition', deg: 180 },
  ];
  for (const pk of progKeys) {
    const pLon = progLonNow[pk];
    for (const natal of params.westernChart.planets) {
      if (natal.name === 'Lilith' || natal.name === 'South Node') continue;
      const dist = circularDist(pLon, natal.longitude);
      for (const spec of majorAspAngles) {
        const orb = Math.abs(dist - spec.deg);
        if (orb <= 1.5) {
          tightAspectsToNatal.push({
            progressedBody: pk,
            aspect: spec.name,
            natalBody: natal.name,
            orb: Number(orb.toFixed(2)),
          });
          break;
        }
      }
    }
  }
  tightAspectsToNatal.sort((a, b) => a.orb - b.orb);

  // 3. Solar Return (exact JD when transiting Sun matches natal Sun longitude)
  let srJd = toJulianDay(lastBdayYear, bm, clampDay(lastBdayYear, bm, bd), 12);
  for (let iter = 0; iter < 5; iter++) {
    const sLon = computeTropicalCoreAtJD(srJd).Sun;
    let diff = natalSunLon - sLon;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    srJd += diff / 0.9856;
  }
  const srBodies = computeTropicalCoreAtJD(srJd);
  const srAscMc = computeTropicalAscMcAtJD(srJd, params.latitude, params.longitude);
  const srAscSignIdx = Math.floor(srAscMc.asc / 30) % 12;
  const srMcSignIdx = Math.floor(srAscMc.mc / 30) % 12;
  const srMoonSignIdx = Math.floor(srBodies.Moon / 30) % 12;
  const srSunHouse = ((Math.floor(srBodies.Sun / 30) % 12 - srAscSignIdx + 12) % 12) + 1;
  const srDateIso = jdToIsoDate(srJd);

  // 4. Outer & Slow Transits to Natal (<2.5° tight orbs)
  const transitNow = computeTropicalCoreAtJD(nowJD);
  const transitYesterday = computeTropicalCoreAtJD(nowJD - 1);
  const outerNames = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron', 'North Node'] as const;
  const outerPlanets = outerNames.map((pName) => {
    const apiMatch = params.transitPlanets?.find((tp) => tp.name === pName);
    const lon = apiMatch ? apiMatch.longitude : transitNow[pName];
    const sIdx = Math.floor(normalizeDeg(lon) / 30) % 12;
    let delta = lon - transitYesterday[pName];
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const isRx =
      apiMatch !== undefined
        ? apiMatch.isRetrograde
        : pName === 'North Node'
        ? true
        : delta < 0;
    return {
      planet: pName,
      lon,
      sign: SIGNS[sIdx],
      dms: formatDMS(normalizeDeg(lon) % 30),
      natalHouse: cuspLons.length === 12 ? getHouseForTropicalLon(lon, cuspLons) : ((sIdx - ascSignIdx + 12) % 12) + 1,
      isRetrograde: isRx,
    };
  });

  const tightHitsToNatal: WesternTimingSnapshot['transits']['tightHitsToNatal'] = [];
  for (const tp of outerPlanets) {
    for (const natal of params.westernChart.planets) {
      if (natal.name === 'Lilith' || natal.name === 'South Node') continue;
      const dist = circularDist(tp.lon, natal.longitude);
      for (const spec of majorAspAngles) {
        const orb = Math.abs(dist - spec.deg);
        if (orb <= 2.5) {
          tightHitsToNatal.push({
            transitPlanet: tp.planet,
            aspect: spec.name,
            natalBody: natal.name,
            orb: Number(orb.toFixed(2)),
            orbTier: orb <= 1.2 ? 'core_structural' : 'active',
          });
          break;
        }
      }
    }
  }
  tightHitsToNatal.sort((a, b) => a.orb - b.orb);

  return {
    asOfDate: nowISO,
    profection: {
      age,
      profectedHouse,
      profectedSign: SIGNS[profectedSignIdx],
      lordOfYearTraditional: lordTrad,
      lordOfYearModern: lordMod,
      lordNatalHouse: lordNatalObj?.house ?? 1,
      lordDignity: lordNatalObj?.dignity ?? 'Peregrine',
      yearStartIso,
      yearEndIso,
      percentElapsed: profProgress.percentElapsed,
      daysLeft: profProgress.daysLeft,
    },
    progressions: {
      progressedDateIso: jdToIsoDate(progJD),
      sun: {
        sign: progSign(progLonNow.Sun),
        dms: formatDMS(normalizeDeg(progLonNow.Sun) % 30),
        house: cuspLons.length === 12 ? getHouseForTropicalLon(progLonNow.Sun, cuspLons) : 1,
      },
      moon: {
        sign: SIGNS[progMoonSignIdx],
        signIndex: progMoonSignIdx,
        dms: formatDMS(normalizeDeg(progMoonLon) % 30),
        house: cuspLons.length === 12 ? getHouseForTropicalLon(progMoonLon, cuspLons) : 1,
        signStartIso: progMoonStartIso,
        signEndIso: progMoonEndIso,
        percentElapsed: progMoonMetrics.percentElapsed,
        daysLeft: progMoonMetrics.daysLeft,
      },
      mercury: {
        sign: progSign(progLonNow.Mercury),
        dms: formatDMS(normalizeDeg(progLonNow.Mercury) % 30),
        isRetrograde: normalizeDeg(progLonNow.Mercury - progLonPrev.Mercury) > 180,
      },
      venus: {
        sign: progSign(progLonNow.Venus),
        dms: formatDMS(normalizeDeg(progLonNow.Venus) % 30),
        isRetrograde: normalizeDeg(progLonNow.Venus - progLonPrev.Venus) > 180,
      },
      mars: {
        sign: progSign(progLonNow.Mars),
        dms: formatDMS(normalizeDeg(progLonNow.Mars) % 30),
        isRetrograde: normalizeDeg(progLonNow.Mars - progLonPrev.Mars) > 180,
      },
      ascendantSign: progSign(progAscLon),
      midheavenSign: progSign(progMcLon),
      tightAspectsToNatal: tightAspectsToNatal.slice(0, 10),
    },
    solarReturn: {
      returnDateIso: srDateIso,
      yearStartIso,
      yearEndIso,
      srAscendantSign: SIGNS[srAscSignIdx],
      srAscendantDms: formatDMS(srAscMc.asc % 30),
      srMidheavenSign: SIGNS[srMcSignIdx],
      srSunHouse,
      srMoonSign: SIGNS[srMoonSignIdx],
      summary: `Solar Return (${srDateIso}): SR Ascendant ${SIGNS[srAscSignIdx]} ${formatDMS(srAscMc.asc % 30)}, SR MC ${SIGNS[srMcSignIdx]}, SR Sun in SR H${srSunHouse}, SR Moon in ${SIGNS[srMoonSignIdx]}.`,
    },
    transits: {
      transitDate: nowISO,
      outerPlanets: outerPlanets.map(({ lon: _lon, ...rest }) => rest),
      tightHitsToNatal: tightHitsToNatal.slice(0, 14),
    },
  };
}

export function buildWesternTimingWidgets(
  snapshot: WesternTimingSnapshot,
  nowDate?: Date | string
): TimingProgressWidget[] {
  const parsedNow =
    nowDate instanceof Date
      ? nowDate
      : typeof nowDate === 'string' && nowDate.trim()
      ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(nowDate.trim()) ? `${nowDate.trim()}T12:00:00Z` : nowDate)
      : new Date();
  const safeNow = Number.isNaN(parsedNow.getTime()) ? new Date() : parsedNow;
  const nowISO = safeNow.toISOString().slice(0, 10);
  const nowDayMs = parseUtcDayMs(nowISO);

  const widgets: TimingProgressWidget[] = [];

  // 1. Annual Profection Year
  const curH = snapshot.profection.profectedHouse;
  const prevH = curH === 1 ? 12 : curH - 1;
  const nextH = curH === 12 ? 1 : curH + 1;
  widgets.push({
    id: 'profection',
    kind: 'dasha',
    title: `Annual Profection (Age ${snapshot.profection.age})`,
    previous: { label: `${prevH}H Year` },
    current: {
      label: `${curH}H ${snapshot.profection.profectedSign} · Lord ${snapshot.profection.lordOfYearTraditional}`,
      startDateIso: snapshot.profection.yearStartIso,
      endDateIso: snapshot.profection.yearEndIso,
      startDisplay: formatWidgetDisplayDate(snapshot.profection.yearStartIso),
      endDisplay: formatWidgetDisplayDate(snapshot.profection.yearEndIso),
      percentElapsed: snapshot.profection.percentElapsed,
      daysLeft: snapshot.profection.daysLeft,
    },
    next: { label: `${nextH}H Year` },
  });

  // 2. Secondary Progressed Moon Sign Cycle
  const pmIdx = snapshot.progressions.moon.signIndex;
  const pmPrev = (pmIdx + 11) % 12;
  const pmNext = (pmIdx + 1) % 12;
  widgets.push({
    id: 'progressed_moon',
    kind: 'dasha',
    title: 'Progressed Moon Cycle',
    previous: { label: `Moon in ${SIGNS[pmPrev]}` },
    current: {
      label: `Progressed Moon in ${SIGNS[pmIdx]} (H${snapshot.progressions.moon.house})`,
      startDateIso: snapshot.progressions.moon.signStartIso,
      endDateIso: snapshot.progressions.moon.signEndIso,
      startDisplay: formatWidgetDisplayDate(snapshot.progressions.moon.signStartIso),
      endDisplay: formatWidgetDisplayDate(snapshot.progressions.moon.signEndIso),
      percentElapsed: snapshot.progressions.moon.percentElapsed,
      daysLeft: snapshot.progressions.moon.daysLeft,
    },
    next: { label: `Moon in ${SIGNS[pmNext]}` },
  });

  // 3. Tropical Saturn Transit
  const satWin = computeTropicalSlowTransitWindow('Saturn', nowISO, nowDayMs);
  widgets.push({
    id: 'w_saturn',
    kind: 'transit',
    title: 'Saturn Transit (Tropical)',
    previous: { label: `Saturn in ${SIGNS[satWin.prevSignIndex]}` },
    current: {
      label: `Saturn in ${SIGNS[satWin.currentSignIndex]}`,
      startDateIso: satWin.startDateIso,
      endDateIso: satWin.endDateIso,
      startDisplay: formatWidgetDisplayDate(satWin.startDateIso),
      endDisplay: formatWidgetDisplayDate(satWin.endDateIso),
      percentElapsed: satWin.percentElapsed,
      daysLeft: satWin.daysLeft,
    },
    next: { label: `Saturn in ${SIGNS[satWin.nextSignIndex]}` },
  });

  // 4. Tropical Jupiter Transit
  const jupWin = computeTropicalSlowTransitWindow('Jupiter', nowISO, nowDayMs);
  widgets.push({
    id: 'w_jupiter',
    kind: 'transit',
    title: 'Jupiter Transit (Tropical)',
    previous: { label: `Jupiter in ${SIGNS[jupWin.prevSignIndex]}` },
    current: {
      label: `Jupiter in ${SIGNS[jupWin.currentSignIndex]}`,
      startDateIso: jupWin.startDateIso,
      endDateIso: jupWin.endDateIso,
      startDisplay: formatWidgetDisplayDate(jupWin.startDateIso),
      endDisplay: formatWidgetDisplayDate(jupWin.endDateIso),
      percentElapsed: jupWin.percentElapsed,
      daysLeft: jupWin.daysLeft,
    },
    next: { label: `Jupiter in ${SIGNS[jupWin.nextSignIndex]}` },
  });

  return widgets;
}




