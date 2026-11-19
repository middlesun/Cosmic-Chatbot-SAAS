// Pure deterministic Vedic Astrology (Parashari, KP, Jaimini, Ashtakavarga, Vimshottari) math
// Derived from Sidereal Lahiri planetary longitudes & birth coordinates.

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
    mdEnd: string;
    adEnd: string;
    pdEnd: string;
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

  const todayISO = new Date().toISOString().slice(0, 10);
  let currentStack: {
    mahadasha: string;
    antardasha: string;
    pratyantardasha: string;
    mdEnd: string;
    adEnd: string;
    pdEnd: string;
  } | null = null;

  for (const md of timeline) {
    if (todayISO >= md.startDate && todayISO <= md.endDate) {
      for (const ad of md.children || []) {
        if (todayISO >= ad.startDate && todayISO <= ad.endDate) {
          for (const pd of ad.children || []) {
            if (todayISO >= pd.startDate && todayISO <= pd.endDate) {
              currentStack = {
                mahadasha: md.lord,
                antardasha: ad.lord,
                pratyantardasha: pd.lord,
                mdEnd: md.endDate,
                adEnd: ad.endDate,
                pdEnd: pd.endDate,
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
