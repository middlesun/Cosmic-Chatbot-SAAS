import crypto from 'crypto';
import type { DrawnTarotCard, DrawnTarotSpread } from '../../lib/tarotDeck';
import { enrichCompiledChart, formatChartForLLM, type CompiledChartData } from './chartCompiler';
import { SIGNS } from './jyotishMath';

export type { DrawnTarotCard, DrawnTarotSpread };

// =============================================================================
// 1. DETERMINISTIC TROPICAL WESTERN ASTROLOGY ENGINE
//    Converts existing Sidereal Lahiri chart_json into Tropical Western
//    longitudes, houses, Ptolemaic aspects & elemental balance with zero
//    external API calls and zero hallucinated degrees.
// =============================================================================

const ELEMENTS_BY_SIGN = [
  'Fire', 'Earth', 'Air', 'Water',
  'Fire', 'Earth', 'Air', 'Water',
  'Fire', 'Earth', 'Air', 'Water',
] as const;

const MODALITIES_BY_SIGN = [
  'Cardinal', 'Fixed', 'Mutable',
  'Cardinal', 'Fixed', 'Mutable',
  'Cardinal', 'Fixed', 'Mutable',
  'Cardinal', 'Fixed', 'Mutable',
] as const;

function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function formatDmsShort(degInSign: number): string {
  const clamped = ((degInSign % 30) + 30) % 30;
  const d = Math.floor(clamped);
  const m = Math.floor((clamped - d) * 60);
  return `${d}°${String(m).padStart(2, '0')}'`;
}

/**
 * Computes Lahiri (Chitrapaksha) ayanamsa for a given YYYY-MM-DD birth date.
 * Anchored to J2000.0 (2000-01-01 12:00 UTC) = 23.853056°, precession = 50.290966"/yr.
 * Accurate to < 0.015° across 1900–2100.
 */
export function computeLahiriAyanamsa(birthDate: string): number {
  const parts = String(birthDate || '').split('-').map(Number);
  const year = Number.isFinite(parts[0]) && parts[0] > 1800 ? parts[0] : 2000;
  const month = Number.isFinite(parts[1]) && parts[1] >= 1 && parts[1] <= 12 ? parts[1] : 1;
  const day = Number.isFinite(parts[2]) && parts[2] >= 1 && parts[2] <= 31 ? parts[2] : 1;

  const targetMs = Date.UTC(year, month - 1, day, 12, 0, 0);
  const j2000Ms = Date.UTC(2000, 0, 1, 12, 0, 0);
  const yearsSinceJ2000 = (targetMs - j2000Ms) / (365.25 * 24 * 3600 * 1000);
  return 23.853056 + yearsSinceJ2000 * 0.01396971;
}

export interface TropicalPlanetPlacement {
  name: string;
  westernName: string;
  longitude: number;
  signIndex: number;
  sign: string;
  degreeInSign: number;
  dms: string;
  house: number;
  isRetrograde: boolean;
}

export interface TropicalAspect {
  bodyA: string;
  bodyB: string;
  aspect: 'Conjunction' | 'Sextile' | 'Square' | 'Trine' | 'Opposition';
  orb: number;
}

const MAJOR_ASPECTS: Array<{
  name: TropicalAspect['aspect'];
  angle: number;
  orb: number;
}> = [
  { name: 'Conjunction', angle: 0, orb: 8 },
  { name: 'Sextile', angle: 60, orb: 6 },
  { name: 'Square', angle: 90, orb: 7 },
  { name: 'Trine', angle: 120, orb: 7 },
  { name: 'Opposition', angle: 180, orb: 8 },
];

function mapToWesternName(vedicName: string): string {
  if (vedicName === 'Rahu') return 'North Node (Rahu)';
  if (vedicName === 'Ketu') return 'South Node (Ketu)';
  return vedicName;
}

export function formatTropicalWesternContext(params: {
  chartJson: CompiledChartData | null | undefined;
  birthDate: string;
  profileName: string;
  currentLocationLabel?: string | null;
}): string | null {
  const chart = params.chartJson;
  if (!chart || !Array.isArray(chart.planets) || chart.planets.length === 0) {
    return null;
  }

  const enriched = enrichCompiledChart(chart).chartJson;
  if (enriched.western) {
    const jsonBlock = formatChartForLLM(enriched, 'western');
    return params.currentLocationLabel
      ? `${jsonBlock}\nCurrent Residence / Relocation Context: ${params.currentLocationLabel}`
      : jsonBlock;
  }

  const ayanamsa = computeLahiriAyanamsa(params.birthDate || chart.meta?.birthDate || '2000-01-01');
  const siderealAsc = chart.planets.find((p) => p.name === 'Ascendant');
  const tropAscLon = siderealAsc ? norm360(siderealAsc.longitude + ayanamsa) : 0;
  const tropAscSignIndex = Math.floor(tropAscLon / 30);

  const placements: TropicalPlanetPlacement[] = chart.planets.map((p) => {
    const lon = norm360(p.longitude + ayanamsa);
    const signIndex = Math.floor(lon / 30);
    const degInSign = lon % 30;
    const house = ((signIndex - tropAscSignIndex + 12) % 12) + 1;
    return {
      name: p.name,
      westernName: mapToWesternName(p.name),
      longitude: lon,
      signIndex,
      sign: SIGNS[signIndex] || 'Aries',
      degreeInSign: degInSign,
      dms: formatDmsShort(degInSign),
      house,
      isRetrograde: Boolean(p.isRetrograde),
    };
  });

  // Compute Placidus tropical cusps if KP cusps exist
  const placidusLines: string[] = [];
  if (chart.kp?.cusps && Array.isArray(chart.kp.cusps) && chart.kp.cusps.length === 12) {
    for (const c of chart.kp.cusps) {
      const tLon = norm360(c.longitude + ayanamsa);
      const sIdx = Math.floor(tLon / 30);
      const deg = tLon % 30;
      const label =
        c.house === 1
          ? 'H1 (Asc)'
          : c.house === 4
          ? 'H4 (IC)'
          : c.house === 7
          ? 'H7 (Desc)'
          : c.house === 10
          ? 'H10 (MC)'
          : `H${c.house}`;
      placidusLines.push(`${label}: ${SIGNS[sIdx]} ${formatDmsShort(deg)}`);
    }
  }

  // Compute Ptolemaic major aspects across planets + Ascendant (skip Rahu-Ketu permanent opposition)
  const aspects: TropicalAspect[] = [];
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i];
      const b = placements[j];
      if ((a.name === 'Rahu' && b.name === 'Ketu') || (a.name === 'Ketu' && b.name === 'Rahu')) {
        continue;
      }
      const isNodePair = a.name === 'Rahu' || a.name === 'Ketu' || b.name === 'Rahu' || b.name === 'Ketu';
      const rawDiff = Math.abs(a.longitude - b.longitude);
      const sep = rawDiff > 180 ? 360 - rawDiff : rawDiff;

      for (const spec of MAJOR_ASPECTS) {
        const maxOrb = isNodePair ? Math.min(spec.orb, 5) : spec.orb;
        const orb = Math.abs(sep - spec.angle);
        if (orb <= maxOrb) {
          aspects.push({
            bodyA: a.westernName,
            bodyB: b.westernName,
            aspect: spec.name,
            orb: Math.round(orb * 100) / 100,
          });
          break;
        }
      }
    }
  }

  aspects.sort((a, b) => a.orb - b.orb);

  // Element & Modality tally across Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn + Ascendant
  const coreBodies = placements.filter((p) =>
    ['Ascendant', 'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].includes(p.name)
  );
  const elementCounts: Record<string, number> = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  const modalityCounts: Record<string, number> = { Cardinal: 0, Fixed: 0, Mutable: 0 };
  for (const body of coreBodies) {
    elementCounts[ELEMENTS_BY_SIGN[body.signIndex]] += 1;
    modalityCounts[MODALITIES_BY_SIGN[body.signIndex]] += 1;
  }

  const sun = placements.find((p) => p.name === 'Sun');
  const moon = placements.find((p) => p.name === 'Moon');
  const asc = placements.find((p) => p.name === 'Ascendant');

  const lines: string[] = [
    `VERIFIED TROPICAL WESTERN NATAL CHART FOR ${params.profileName.toUpperCase()} (Computed deterministically via Lahiri Ayanamsa +${ayanamsa.toFixed(2)}°):`,
    `Big Three: Sun in ${sun ? `${sun.sign} ${sun.dms} (House ${sun.house})` : 'N/A'} | Moon in ${moon ? `${moon.sign} ${moon.dms} (House ${moon.house})` : 'N/A'} | Rising (Ascendant) in ${asc ? `${asc.sign} ${asc.dms}` : 'N/A'}`,
  ];

  if (params.currentLocationLabel) {
    lines.push(`Current Residence / Relocation Context: ${params.currentLocationLabel}`);
  }

  lines.push(
    '',
    'TROPICAL PLANETARY PLACEMENTS (Whole-Sign Houses):',
    ...placements.map(
      (p) =>
        `- ${p.westernName}: ${p.sign} ${p.dms}${p.isRetrograde ? ' (Rx)' : ''} — House ${p.house}`
    )
  );

  if (placidusLines.length > 0) {
    lines.push('', `TROPICAL PLACIDUS ANGLES & CUSPS: ${placidusLines.join(' | ')}`);
  }

  lines.push(
    '',
    `ELEMENTAL & MODAL BALANCE (Core 7 + Rising): Fire ${elementCounts.Fire}, Earth ${elementCounts.Earth}, Air ${elementCounts.Air}, Water ${elementCounts.Water} | Cardinal ${modalityCounts.Cardinal}, Fixed ${modalityCounts.Fixed}, Mutable ${modalityCounts.Mutable}`
  );

  if (aspects.length > 0) {
    lines.push(
      '',
      'MAJOR TROPICAL ASPECTS (Tightest Orbs First):',
      ...aspects
        .slice(0, 22)
        .map((asp) => `- ${asp.bodyA} ${asp.aspect} ${asp.bodyB} (orb ${asp.orb.toFixed(1)}°)`)
    );
  }

  lines.push(
    '',
    'NOTE ON OUTER PLANETS: Exact Tropical longitudes for Sun through Saturn, Lunar Nodes, and Ascendant/Angles are verified above. Do not fabricate exact degrees for Uranus, Neptune, Pluto, or Chiron unless present; focus precise degree-level interpretation on the verified placements and generational sign themes where appropriate.'
  );

  return lines.join('\n');
}

// =============================================================================
// 2. DETERMINISTIC PYTHAGOREAN NUMEROLOGY ENGINE
//    Computes Life Path, Expression/Destiny, Soul Urge, Personality, Maturity,
//    Birthday Number, Karmic Debts & Personal Year/Month/Day preserving
//    Master Numbers (11, 22, 33).
// =============================================================================

const PYTHAGOREAN_MAP: Record<string, number> = {
  A: 1, J: 1, S: 1,
  B: 2, K: 2, T: 2,
  C: 3, L: 3, U: 3,
  D: 4, M: 4, V: 4,
  E: 5, N: 5, W: 5,
  F: 6, O: 6, X: 6,
  G: 7, P: 7, Y: 7,
  H: 8, Q: 8, Z: 8,
  I: 9, R: 9,
};

const MASTER_NUMBERS = new Set([11, 22, 33]);
const KARMIC_DEBT_NUMBERS = new Set([13, 14, 16, 19]);

interface ReducedResult {
  value: number;
  rawSum: number;
  isMaster: boolean;
  karmicDebt: number | null;
}

function reducePythagorean(input: number, preserveMasters = true): ReducedResult {
  let current = Math.abs(Math.trunc(input));
  const rawSum = current;
  let karmicDebt: number | null = KARMIC_DEBT_NUMBERS.has(current) ? current : null;

  while (current > 9) {
    if (preserveMasters && MASTER_NUMBERS.has(current)) {
      break;
    }
    let next = 0;
    let temp = current;
    while (temp > 0) {
      next += temp % 10;
      temp = Math.floor(temp / 10);
    }
    if (karmicDebt === null && KARMIC_DEBT_NUMBERS.has(next)) {
      karmicDebt = next;
    }
    current = next;
  }

  return {
    value: current,
    rawSum,
    isMaster: MASTER_NUMBERS.has(current),
    karmicDebt,
  };
}

function isVowelAt(word: string, idx: number): boolean {
  const ch = word[idx];
  if ('AEIOU'.includes(ch)) return true;
  if (ch !== 'Y') return false;
  const prev = idx > 0 ? word[idx - 1] : '';
  const next = idx < word.length - 1 ? word[idx + 1] : '';
  return !'AEIOU'.includes(prev) && !'AEIOU'.includes(next);
}

function formatNumLabel(res: ReducedResult): string {
  const parts = [String(res.value)];
  if (res.isMaster) parts.push('(Master Number)');
  if (res.karmicDebt) parts.push(`[Karmic Debt ${res.karmicDebt}/${res.value}]`);
  return parts.join(' ');
}

export function extractNumerologyHintsFromPrompt(prompt: string): {
  name?: string;
  birthDate?: string;
} {
  const text = String(prompt || '');
  let birthDate: string | undefined;

  // Match YYYY-MM-DD
  const isoMatch = /\b((?:19|20)\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(text);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      birthDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Match DD Month YYYY or Month DD, YYYY
  if (!birthDate) {
    const months: Record<string, number> = {
      jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
      apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
      aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
      nov: 11, november: 11, dec: 12, december: 12,
    };
    const dmy = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[,\s]+((?:19|20)\d{2})\b/i.exec(
      text
    );
    const mdy = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?[,\s]+((?:19|20)\d{2})\b/i.exec(
      text
    );
    if (dmy) {
      const d = Number(dmy[1]);
      const m = months[dmy[2].toLowerCase()];
      const y = Number(dmy[3]);
      if (m && d >= 1 && d <= 31) {
        birthDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    } else if (mdy) {
      const m = months[mdy[1].toLowerCase()];
      const d = Number(mdy[2]);
      const y = Number(mdy[3]);
      if (m && d >= 1 && d <= 31) {
        birthDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }

  let name: string | undefined;
  const nameMatch = /(?:my name is|name[:\s]+|for\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/.exec(text);
  if (nameMatch?.[1]) {
    name = nameMatch[1].trim();
  }

  return { name, birthDate };
}

export function formatPythagoreanNumerologyContext(params: {
  fullName?: string | null;
  birthDate?: string | null;
  now?: Date;
}): string | null {
  const cleanName = (params.fullName || '').trim();
  const cleanDob = (params.birthDate || '').trim();
  const hasDob = /^\d{4}-\d{2}-\d{2}$/.test(cleanDob);
  const alphaLetters = cleanName.toUpperCase().replace(/[^A-Z\s]/g, '').trim();
  const hasName = alphaLetters.replace(/\s+/g, '').length >= 2;

  if (!hasDob && !hasName) {
    return null;
  }

  const now = params.now || new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();

  let lifePath: ReducedResult | null = null;
  let birthday: ReducedResult | null = null;
  let personalYear: ReducedResult | null = null;
  let personalMonth: ReducedResult | null = null;
  let personalDay: ReducedResult | null = null;

  if (hasDob) {
    const [year, month, day] = cleanDob.split('-').map(Number);
    const mRed = reducePythagorean(month, true);
    const dRed = reducePythagorean(day, true);
    const yRed = reducePythagorean(year, true);
    lifePath = reducePythagorean(mRed.value + dRed.value + yRed.value, true);
    birthday = reducePythagorean(day, true);

    const curYearRed = reducePythagorean(currentYear, false);
    personalYear = reducePythagorean(mRed.value + dRed.value + curYearRed.value, true);
    personalMonth = reducePythagorean(personalYear.value + currentMonth, true);
    personalDay = reducePythagorean(personalMonth.value + currentDay, true);
  }

  let expression: ReducedResult | null = null;
  let soulUrge: ReducedResult | null = null;
  let personality: ReducedResult | null = null;

  if (hasName) {
    const words = alphaLetters.split(/\s+/).filter(Boolean);
    let exprSum = 0;
    let vowelSum = 0;
    let consonantSum = 0;

    for (const word of words) {
      let wExpr = 0;
      let wVowel = 0;
      let wCons = 0;
      for (let i = 0; i < word.length; i++) {
        const val = PYTHAGOREAN_MAP[word[i]] || 0;
        if (!val) continue;
        wExpr += val;
        if (isVowelAt(word, i)) {
          wVowel += val;
        } else {
          wCons += val;
        }
      }
      exprSum += reducePythagorean(wExpr, true).value;
      vowelSum += reducePythagorean(wVowel, true).value;
      consonantSum += reducePythagorean(wCons, true).value;
    }

    expression = reducePythagorean(exprSum, true);
    soulUrge = reducePythagorean(vowelSum, true);
    personality = reducePythagorean(consonantSum, true);
  }

  const maturity =
    lifePath && expression
      ? reducePythagorean(lifePath.value + expression.value, true)
      : null;

  const lines: string[] = [
    `VERIFIED PYTHAGOREAN NUMEROLOGY PROFILE (Computed deterministically — do not recalculate or contradict these numbers):`,
  ];

  if (hasName) lines.push(`Subject Name Analyzed: ${cleanName}`);
  if (hasDob) lines.push(`Date of Birth Analyzed: ${cleanDob}`);
  lines.push(`Current Reference Date: ${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`);
  lines.push('');

  if (lifePath) lines.push(`- Life Path Number: ${formatNumLabel(lifePath)}`);
  if (birthday) lines.push(`- Birthday Number: ${formatNumLabel(birthday)}`);
  if (expression) lines.push(`- Expression / Destiny Number: ${formatNumLabel(expression)}`);
  if (soulUrge) lines.push(`- Soul Urge (Heart's Desire) Number: ${formatNumLabel(soulUrge)}`);
  if (personality) lines.push(`- Personality Number: ${formatNumLabel(personality)}`);
  if (maturity) lines.push(`- Maturity Number: ${formatNumLabel(maturity)}`);

  if (personalYear && personalMonth && personalDay) {
    lines.push(
      '',
      'ACTIVE PERSONAL TIMING CYCLES:',
      `- Personal Year (${currentYear}): ${formatNumLabel(personalYear)}`,
      `- Personal Month (${currentYear}-${String(currentMonth).padStart(2, '0')}): ${formatNumLabel(personalMonth)}`,
      `- Personal Day (Today): ${formatNumLabel(personalDay)}`
    );
  }

  return lines.join('\n');
}

// =============================================================================
// 3. CRYPTOGRAPHICALLY SHUFFLED 78-CARD RIDER-WAITE TAROT ENGINE
//    Draws verifiable cards server-side using crypto.randomInt before LLM call.
// =============================================================================

const MAJOR_ARCANA: string[] = [
  '0 · The Fool',
  'I · The Magician',
  'II · The High Priestess',
  'III · The Empress',
  'IV · The Emperor',
  'V · The Hierophant',
  'VI · The Lovers',
  'VII · The Chariot',
  'VIII · Strength',
  'IX · The Hermit',
  'X · Wheel of Fortune',
  'XI · Justice',
  'XII · The Hanged Man',
  'XIII · Death',
  'XIV · Temperance',
  'XV · The Devil',
  'XVI · The Tower',
  'XVII · The Star',
  'XVIII · The Moon',
  'XIX · The Sun',
  'XX · Judgement',
  'XXI · The World',
];

const SUITS = ['Wands', 'Cups', 'Swords', 'Pentacles'] as const;
const RANKS = [
  'Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
  'Eight', 'Nine', 'Ten', 'Page', 'Knight', 'Queen', 'King',
] as const;

const FULL_TAROT_DECK: string[] = [
  ...MAJOR_ARCANA,
  ...SUITS.flatMap((suit) => RANKS.map((rank) => `${rank} of ${suit}`)),
];


function chooseSpreadPositions(userPrompt: string): {
  spreadName: string;
  positions: string[];
} {
  const q = String(userPrompt || '').toLowerCase();

  if (/\b(one[\s-]?card|1[\s-]?card|single card|card of the day|daily card|quick pull|quick clarity)\b/.test(q)) {
    return {
      spreadName: '1-Card Clarity Pull',
      positions: ['Core Message & Immediate Energy'],
    };
  }

  if (
    /\b(five[\s-]?card|5[\s-]?card|crossroads|decision|choose between|option a|should i|deep spread|celtic|complex|relationship dynamics)\b/.test(q)
  ) {
    return {
      spreadName: '5-Card Crossroads Spread',
      positions: [
        '1. Present Threshold (Where You Stand)',
        '2. Hidden or Subconscious Influence',
        '3. Core Tension or Invitation',
        '4. Grounded Advice (Best Stance to Take)',
        '5. Emerging Trajectory (If Current Energy Continues)',
      ],
    };
  }

  return {
    spreadName: '3-Card Guidance Spread',
    positions: [
      '1. Root Influence (What Led Here)',
      '2. Present Energy (What Is Active Now)',
      '3. Grounded Guidance (Wise Next Movement)',
    ],
  };
}

export function drawTarotSpread(userPrompt: string): DrawnTarotSpread {
  const { spreadName, positions } = chooseSpreadPositions(userPrompt);
  const deck = [...FULL_TAROT_DECK];

  // Fisher-Yates shuffle powered by Node crypto.randomInt
  for (let i = deck.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }

  const cards: DrawnTarotCard[] = positions.map((position, idx) => {
    const card = deck[idx];
    // ~24% reversed probability for authentic nuanced readings without excessive gloom
    const orientation: 'Upright' | 'Reversed' =
      crypto.randomInt(0, 100) < 24 ? 'Reversed' : 'Upright';
    const arcana: 'Major' | 'Minor' = MAJOR_ARCANA.includes(card) ? 'Major' : 'Minor';
    return { position, card, orientation, arcana };
  });

  return { spreadName, cards };
}

export function formatTarotSpreadContext(spread: DrawnTarotSpread): string {
  const majorCount = spread.cards.filter((c) => c.arcana === 'Major').length;
  const lines: string[] = [
    `VERIFIED SERVER-SIDE TAROT DRAW (Cryptographically shuffled 78-card Rider-Waite deck — interpret THESE EXACT CARDS and orientations; never substitute or invent different cards):`,
    `Spread: ${spread.spreadName} (${majorCount} Major Arcana drawn)`,
    ...spread.cards.map(
      (c) => `- ${c.position}: **${c.card}** (${c.orientation})`
    ),
    '',
    'INTERPRETATION RULES FOR THIS DRAW:',
    '- Present the exact drawn cards cleanly at the start of your reading so the user sees what was pulled.',
    '- Treat Reversed cards constructively (internalized energy, delay, reflection, or lesson needing integration — never doom or fear).',
    '- If the user is asking a follow-up purely about the cards already drawn earlier in this thread (e.g., "tell me more about the second card"), reference those earlier cards first and note whether this fresh clarifying draw adds nuance.',
  ];
  return lines.join('\n');
}
