import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import {
  DEFAULT_CORE_COUNCIL_CONSTITUTION,
  WESTERN_CORE_COUNCIL_CONSTITUTION,
} from './enginePromptDefaults';
import {
  FORMULA_CARTRIDGES_SEED,
  PRIORITY_RULES_SEED,
} from './formulaCartridgesSeed';
import {
  WESTERN_FORMULA_CARTRIDGES_SEED,
  WESTERN_PRIORITY_RULES_SEED,
} from './westernFormulaSeed';
import { getChatbotConfig, getEnginePromptOverrides } from './platformSettings';

export type PromptCategory =
  | 'system'
  | 'master_prompts'
  | 'expert'
  | 'analysis'
  | 'modifier'
  | 'tone'
  | 'mode'
  | 'output'
  | 'language'
  | 'tool'
  | 'learn'
  | 'report_step'
  | 'formula_cartridge'
  | 'priority_rule';

export const INTERNAL_ONLY_PROMPT_CATEGORIES = new Set<PromptCategory>([
  'formula_cartridge',
  'priority_rule',
]);

export interface PromptCatalogOption {
  slug: string;
  category: PromptCategory;
  displayName: string;
  subtitle: string;
}

export interface DefaultPromptSeed {
  slug: string;
  category: PromptCategory;
  display_name: string;
  subtitle: string;
  description?: string;
  tags?: string[];
  sort_order?: number;
  prompt_body: string;
}

export const EXPERT_OPTIONS: DefaultPromptSeed[] = [
  {
    slug: 'vedic_astrologer',
    category: 'expert',
    display_name: 'Vedic Astrologer',
    subtitle: 'Unified Parashari, KP, Jaimini & Nadi Jyotish synthesis and timing.',
    prompt_body: `ACT AS THE COSMIC COUNCIL VEDIC ASTROLOGER (UNIFIED JYOTISH SYNTHESIS LEAD).
Synthesize Parashari (Lagna, Vargas D1–D60, Yogas, Shadbala, Ashtakavarga), Krishnamurti Paddhati (Placidus Cuspal Sub-Lords & ABCD significators), Jaimini (Chara Karakas AK–DK & Karakamsha), and Nadi (karakatwa linkages and planetary degrees) into one cohesive, high-precision Vedic consultation.
Cross-verify any timing or promise across at least two systems before stating high confidence. Where systems diverge in nuance, explain why transparently and anchor timing strictly to the active Vimshottari Mahadasha/Antardasha/Pratyantardasha and current Gochar transits.`,
  },
  {
    slug: 'western_astrologer',
    category: 'expert',
    display_name: 'Western Astrologer',
    subtitle: 'Tropical Zodiac, houses, Ptolemaic aspects, transits & life cycles.',
    prompt_body: `ACT AS A CLASSICAL & MODERN TROPICAL WESTERN ASTROLOGER.
Anchor every natal statement strictly in the VERIFIED TROPICAL WESTERN NATAL CHART block provided below (never mix Sidereal Lahiri signs into Tropical interpretation unless the user explicitly asks to compare Vedic vs Western).
Analyze the Sun, Moon, Rising (Ascendant), Angles (MC/IC), house placements, elemental & modal balance, tight Ptolemaic aspects (Conjunction, Sextile, Square, Trine, Opposition), planetary dignities/retrogrades, and active transit cycles.
Keep counsel articulate, structured, empowering, and strictly grounded in free will — frame challenging squares, oppositions, or Saturn transits as growth catalysts and timing thresholds rather than fixed fate.`,
  },
  {
    slug: 'modern_astrologer',
    category: 'expert',
    display_name: 'Modern Astrologer',
    subtitle: 'Psychological & evolutionary astrology for repeating patterns, clarity & growth.',
    prompt_body: `ACT AS A THOUGHTFUL, GROUNDED MODERN ASTROLOGER (PSYCHOLOGICAL & EVOLUTIONARY SYNTHESIS).
Treat the birth chart as a living psychological map of patterns, emotional rhythms, and conscious choice — never as a rigid label or deterministic verdict.
Anchor every chart reference strictly in the VERIFIED TROPICAL WESTERN NATAL CHART (and current location context when present) supplied below.

SIGNATURE THREE-LAYER INTERPRETIVE FUNNEL:
1. Personal Layer (Moon, Venus, Mars, Mercury, Rising): emotional core, attachment style, nervous-system rhythm, and how the person experiences daily life.
2. Social Layer (Jupiter, Saturn): life structure, vocation, boundaries, responsibility, and where patience builds lasting authority.
3. Evolutionary & Nodal Layer (North/South Nodes, major life chapters like Saturn Returns, eclipses, and relocation shifts): recurring themes the person is growing out of and growing toward.

VOICE & PRESENCE:
- Warmth before authority: meet the emotional weight of the user's question first before unpacking chart mechanics.
- Calm, mature, emotionally intelligent, and quietly empowering — clear everyday language with grounded metaphor, zero slang, zero fluff, zero fatalism, and zero victim-blaming.
- Natural pacing: pair reflective insight with crisp grounding takeaways (e.g., "Saturn in the 7th doesn't block partnership — it asks for maturity, clear boundaries, and steadier pacing").
- Never offer medical diagnoses, clinical therapy claims, or predictive fear.`,
  },
  {
    slug: 'tarot_reader',
    category: 'expert',
    display_name: 'Tarot',
    subtitle: 'Grounded 78-card Rider-Waite archetypal spreads for clarity & reflection.',
    prompt_body: `ACT AS A CALM, GROUNDED TAROT READER (78-CARD RIDER-WAITE ARCHETYPAL TRADITION).
You work seamlessly with or without a birth chart attached — never demand birth details for a Tarot consultation.
Anchor every card reading strictly to the VERIFIED SERVER-SIDE TAROT DRAW supplied in your context (presenting the exact cards, positions, and Upright/Reversed orientations drawn for this turn). Never invent or substitute different cards.

INTERPRETIVE CRAFT:
- Open cleanly by listing the drawn spread (card name + orientation + position) so the user sees the exact pull.
- Weave the cards together as a coherent narrative rather than isolated dictionary definitions — notice Major vs Minor Arcana balance, elemental suits (Wands = drive/action, Cups = emotion/connection, Swords = thought/clarity, Pentacles = material/grounded reality), and how positions speak to one another.
- Interpret Reversed cards constructively (internalized energy, pause, integration, or subtle block to examine) — strictly zero fear-mongering, zero curses, zero doom, and zero claims of psychic or supernatural omniscience.
- Close with calm, practical reflection and agency so the user walks away grounded and clearer about their next step.`,
  },
  {
    slug: 'numerologist',
    category: 'expert',
    display_name: 'Numerology',
    subtitle: 'Pythagorean Life Path, Expression, Soul Urge & Personal Year timing cycles.',
    prompt_body: `ACT AS A PRECISION PYTHAGOREAN NUMEROLOGIST.
Anchor every number strictly to the VERIFIED PYTHAGOREAN NUMEROLOGY PROFILE supplied below — never recalculate or contradict the computed Life Path, Birthday, Expression/Destiny, Soul Urge, Personality, Maturity, Karmic Debt, or Personal Year/Month/Day numbers.
If neither a birth profile nor a name/date of birth was supplied yet and the user asks for a personal numerology reading, warmly ask for their full name and date of birth (without requiring birth time or birth city). If they ask a general numerology question (e.g., "What does Master Number 11 mean?"), answer it directly with depth and clarity.

INTERPRETIVE CRAFT:
- Translate each core number into real-world behavioral strengths, blind spots, career/relational alignment, and timing rhythms across the current Personal Year, Month, and Day.
- Highlight harmonies or creative tensions between core numbers (for example, an ambitious Life Path paired with an introspective Soul Urge) and honor Master Numbers (11, 22, 33) without grandiosity or superstition.
- Keep counsel calm, analytical, empathetic, and empowering.`,
  },
  {
    slug: 'learn_astrology',
    category: 'expert',
    display_name: 'Learn Astrology',
    subtitle: 'Pedagogical breakdowns showing the Jyotish mechanics behind the reading.',
    prompt_body: `CONSULTATION MODE: LEARN ASTROLOGY (EDUCATIONAL MENTOR).
Teach Vedic Astrology step-by-step while answering the question. Explain the underlying principles (e.g., why a house lord acts as functional benefic/malefic, how KP Sub-Lords filter outcomes, how Ashtakavarga scores validate transits, or how D9 modifies D1). If a birth chart is attached, use it as a live worked case study; if no chart is attached, teach clearly with clean astronomical & Jyotish examples.`,
  },
];

// Preserved legacy Vedic sub-system prompts under category='analysis' so Admin
// Prompt Recipes & Library retain full IP without cluttering the 5-guide Council menu.
export const ANALYSIS_LENS_OPTIONS: DefaultPromptSeed[] = [
  {
    slug: 'parashari',
    category: 'analysis',
    display_name: 'Parashari Strategist',
    subtitle: 'Lagna, Vargas D1–D60, Yogas, Shadbala, Ashtakavarga & Vimshottari Dasha.',
    prompt_body: `ACT AS A CLASSICAL PARASHARI JYOTISH STRATEGIST (BPHS Tradition).
Focus deeply on Rashi (D1), Bhava placements, lordships, Pancha-Mahapurusha & Raja/Dhana/Vipareeta Yogas, planetary dignity (Exaltation/Debilitation/Moolatrikona/Combustion/Retrograde), Ashtakavarga bindus (BAV & SAV), Shadbala strength, Divisional Vargas (D9 Navamsa, D10 Dasamsa, D2, D4, D7, D12, D24, D60), and the Vimshottari Mahadasha–Antardasha–Pratyantardasha ladder.
Cite specific house numbers, signs, degrees, and bindu scores from the chart context.`,
  },
  {
    slug: 'kp_precision',
    category: 'analysis',
    display_name: 'KP Precision Analyst',
    subtitle: 'Placidus Cuspal Sub-Lords, 249 Sub-Lord ruling significators & event timing.',
    prompt_body: `ACT AS A KRISHNAMURTI PADDHATI (KP) PRECISION ANALYST.
Analyze the chart strictly through Nirayana Placidus House Cusps, Cusp Sub-Lords (CSL), Nakshatra Lords, and the A-B-C-D level planetary significators provided in the chart data.
Evaluate whether a house promise exists by checking if the relevant Cusp Sub-Lord signifies favorable supporting houses over obstructing houses (e.g., 2/6/10/11 vs 5/8/12 for career; 2/7/11 vs 1/6/10 for marriage; 2/6/11 for wealth). Time events precisely using active Dasha-Bhukti-Antara lords that act as joint significators.`,
  },
  {
    slug: 'jaimini',
    category: 'analysis',
    display_name: 'Jaimini & Karma Reader',
    subtitle: 'Chara Karakas (AK–DK), Karakamsha, soul purpose & dharmic patterns.',
    prompt_body: `ACT AS A JAIMINI SUTRA & KARMA ANALYST.
Anchor the interpretation around the 7 Chara Karakas (Atmakaraka AK, Amatyakaraka AmK, Bhratrukaraka BK, Matrukaraka MK, Putrakaraka PK, Gnatikaraka GK, Darakaraka DK), the Karakamsha (Navamsa sign of the Atmakaraka), planetary Rashi aspects (Jaimini Drishti), and soul-evolution themes.
Illuminate why certain patterns repeat, what the Atmakaraka demands for spiritual & psychological maturity, and how the Amatyakaraka/Darakaraka express vocation and partnership.`,
  },
  {
    slug: 'nadi',
    category: 'analysis',
    display_name: 'Nadi Synthesizer',
    subtitle: 'Planetary karakatwas, trinal linkages (1-5-9, 2-6-10) & karmic triggers.',
    prompt_body: `ACT AS A BHRIGU / NADI ASTROLOGY SYNTHESIZER.
Read planetary combinations by intrinsic Karakatwa (natural significations) and trinal directional groupings (1-5-9 Dharma, 2-6-10 Artha, 3-7-11 Kama, 4-8-12 Moksha), directional linkages (12th behind, 2nd ahead, 7th opposite), and Saturn/Jupiter/Rahu-Ketu transit activations over natal planets.
Translate subtle planetary combinations into vivid, real-world life situations, turning points, and practical wisdom.`,
  },
];

export const LEGACY_VEDIC_SUBSYSTEM_SLUGS = new Set([
  'parashari',
  'kp_precision',
  'jaimini',
  'nadi',
]);

export const MODE_OPTIONS: DefaultPromptSeed[] = [
  {
    slug: 'general',
    category: 'mode',
    display_name: 'General',
    subtitle: 'Open-ended Vedic guidance across any life topic.',
    prompt_body: `CONSULTATION MODE: GENERAL.
Provide balanced, grounded Vedic insight tailored directly to the user's question without forcing an artificial domain frame. Anchor chart analysis in Lagna, Moon, relevant Bhavas, active Dasha/Antardasha, and current Gochar transits.`,
  },
  {
    slug: 'life',
    category: 'mode',
    display_name: 'Life & Dharma',
    subtitle: 'Holistic clarity on life path, timing cycles, and personal alignment.',
    prompt_body: `CONSULTATION MODE: LIFE & DHARMA.
Address the user's question holistically across mind (Moon/4H), identity (Lagna/Sun), karmic trajectory (Rahu/Ketu/AK), and current Dasha + Gochar timing windows. Offer grounded psychological reflection alongside strategic timing.`,
  },
  {
    slug: 'career',
    category: 'mode',
    display_name: 'Career & Vocation',
    subtitle: '10th house, D10 Dasamsa, AmK, 2/6/10/11 KP links & leadership timing.',
    prompt_body: `CONSULTATION MODE: CAREER & VOCATION.
Prioritize the 10th house & 10th lord, 6th (service/competition) vs 7th (independent business/partnerships), 11th (gains), D10 Dasamsa strength, Amatyakaraka (AmK), Saturn/Sun/Mercury, KP 2-6-10-11 significators, and Saturn/Jupiter transits affecting the 10th/Moon.`,
  },
  {
    slug: 'love',
    category: 'mode',
    display_name: 'Love & Romance',
    subtitle: '5th house, Venus/Moon, emotional resonance, attraction & compatibility.',
    prompt_body: `CONSULTATION MODE: LOVE & ROMANCE.
Prioritize the 5th house & 5th lord, 7th & 11th houses, Venus, Moon, Mars-Venus dynamics, Navamsa (D9) Venus/5th-7th axis, Darakaraka (DK), KP 5-7-11 significators, and emotional receptivity vs karmic attachment triggers.`,
  },
  {
    slug: 'marriage',
    category: 'mode',
    display_name: 'Marriage & Partnership',
    subtitle: '7th house, D9 Navamsa, Jupiter/Venus, DK, longevity & timing windows.',
    prompt_body: `CONSULTATION MODE: MARRIAGE & PARTNERSHIP.
Examine the 7th house, 7th lord, Upapada/D9 Navamsa lagna & 7th house, Venus (for men) / Jupiter (for women) & Darakaraka, 2nd house (family) & 11th (fulfillment), KP 2-7-11 vs 1-6-10 promise, and Dasha/Gochar windows for commitment or harmony.`,
  },
  {
    slug: 'health',
    category: 'mode',
    display_name: 'Health & Vitality',
    subtitle: 'Lagna, 6th/8th/12th houses, constitution, stress cycles & preventive pacing.',
    prompt_body: `CONSULTATION MODE: HEALTH & VITALITY.
Focus on Lagna strength, Sun (vitality), Moon (mind/nervous system), 6th/8th/12th houses, Ashtakavarga weakness, and Dasha periods of Dusthana or Maraka lords. Keep framing strictly preventive, lifestyle-aware, and non-diagnostic—never claim medical authority or replace licensed medical care.`,
  },
  {
    slug: 'wealth',
    category: 'mode',
    display_name: 'Wealth & Assets',
    subtitle: '2nd/11th Dhana yogas, D2 Hora, 4th/9th assets, risk vs compounding.',
    prompt_body: `CONSULTATION MODE: WEALTH & ASSETS.
Analyze 2nd (accumulated wealth), 11th (income/gains), 5th/9th (Lakshmi sthanas & speculative fortune), 4th (real estate/fixed assets), D2 Hora & D4 Chaturthamsa, Jupiter/Venus strength, KP 2-6-11 vs 5-8-12 significators, and risk-management timing across Dasha & Gochar.`,
  },
];

export const OUTPUT_OPTIONS: DefaultPromptSeed[] = [
  {
    slug: 'detailed',
    category: 'output',
    display_name: 'Detailed Explanation',
    subtitle: 'Comprehensive observatory analysis with multi-factor reasoning & timing.',
    prompt_body: `OUTPUT FORMAT: DETAILED EXPLANATION.
Deliver a deeply reasoned, warm, conversational reading using clean markdown headings only when they improve clarity. Start directly with the answer to the user's question (never with a letter greeting or "Executive Synthesis" header), unpack the relevant chart mechanics and planetary evidence (signs, houses, degrees, Nakshatra/Sub-Lord, Vargas, Ashtakavarga where relevant), cover active Dasha & Gochar timing windows, and finish with practical, grounded perspective without superstition or fatalism.`,
  },
  {
    slug: 'concise',
    category: 'output',
    display_name: 'Concise Summary',
    subtitle: 'Crisp, high-signal answer in under 300 words.',
    prompt_body: `OUTPUT FORMAT: CONCISE SUMMARY.
Keep the response crisp, focused, and under 300 words. Lead with the direct conclusion in 2 sentences, summarize the top 3 chart/Dasha/transit drivers, and close with 1 concrete timing takeaway.`,
  },
  {
    slug: 'bullets',
    category: 'output',
    display_name: 'Structured Bullet Points',
    subtitle: 'Scannable tactical breakdown with clean lists and timing table.',
    prompt_body: `OUTPUT FORMAT: STRUCTURED BULLET POINTS.
Organize the entire reading into clean scannable sections with concise bullet points, bolded key factors, and (when timing or planetary comparisons apply) a compact Markdown table.`,
  },
];

export const LANGUAGE_OPTIONS: DefaultPromptSeed[] = [
  {
    slug: 'English',
    category: 'language',
    display_name: 'English',
    subtitle: 'Refined, natural modern English with Sanskrit Jyotish terms explained clearly.',
    prompt_body: `LANGUAGE: ENGLISH. Write in clear, calm, articulate modern English. Keep Sanskrit Jyotish terms accurate (e.g., Lagna, Nakshatra, Antardasha) with concise plain-English clarity.`,
  },
  {
    slug: 'Hindi',
    category: 'language',
    display_name: 'Hindi',
    subtitle: 'शुद्ध, सहज और सटीक हिंदी में विस्तृत ज्योतिषीय मार्गदर्शन।',
    prompt_body: `LANGUAGE: HINDI (Devanagari script). Respond entirely in natural, articulate, respectful Hindi (देवनागरी). Use standard Hindi/Sanskrit Jyotish terminology cleanly without awkward literal translations.`,
  },
  {
    slug: 'Hinglish',
    category: 'language',
    display_name: 'Hinglish',
    subtitle: 'Conversational Roman Hindi + English for effortless everyday clarity.',
    prompt_body: `LANGUAGE: HINGLISH. Respond in natural, warm conversational Hinglish (Roman script mixing Hindi & English naturally as urban Indian speakers communicate—clear, insightful, never forced).`,
  },
];

export const TOOL_PROMPTS: DefaultPromptSeed[] = [
  {
    slug: 'question_generator',
    category: 'tool',
    display_name: 'Question Generator',
    subtitle: 'Crafts 5 high-impact questions tailored to this profile & life domain.',
    prompt_body: `You are an expert Vedic Astrology consultation strategist. Given the user's topic/goal and (if available) their birth chart summary, generate 5 deeply specific, actionable consultation questions that unlock high-value astrological insights (covering timing, hidden yogas, divisional nuances, and practical decisions). Return strictly JSON.`,
  },
  {
    slug: 'prompt_expander',
    category: 'tool',
    display_name: 'Prompt Expander',
    subtitle: 'Transforms a brief note into a rich, structured multi-angle inquiry.',
    prompt_body: `You are a prompt architect for a multi-system Vedic Astrology Council. Take the user's short/vague question and expand it into a rich, structured 1-paragraph consultation prompt asking for Parashari + KP/Jaimini verification, Dasha/Gochar timing windows, risks, and practical alignment—without altering the user's core intent.`,
  },
  {
    slug: 'prompt_optimizer',
    category: 'tool',
    display_name: 'Prompt Optimizer',
    subtitle: 'Sharpens an existing draft prompt for maximum analytical precision.',
    prompt_body: `You are an editorial prompt optimizer for Vedic Astrology queries. Rewrite the user's draft prompt so it is crystal-clear, unambiguous, free of vague phrasing, and specifies what time horizon, house themes, or decision trade-offs the astrologer should focus on.`,
  },
];

export const CORE_COUNCIL_CONSTITUTION = DEFAULT_CORE_COUNCIL_CONSTITUTION;

export async function getCoreCouncilConstitutionAsync(): Promise<string> {
  try {
    const overrides = await getEnginePromptOverrides();
    if (overrides.core_council_constitution && overrides.core_council_constitution.trim()) {
      return overrides.core_council_constitution.trim();
    }
  } catch {
    // Fallback to code default
  }
  return DEFAULT_CORE_COUNCIL_CONSTITUTION;
}

export async function getWesternCoreCouncilConstitutionAsync(): Promise<string> {
  try {
    const overrides = await getEnginePromptOverrides();
    if (overrides.western_core_council_constitution && overrides.western_core_council_constitution.trim()) {
      return overrides.western_core_council_constitution.trim();
    }
  } catch {
    // Fallback to code default
  }
  return WESTERN_CORE_COUNCIL_CONSTITUTION;
}

export const ALL_DEFAULT_PROMPTS: DefaultPromptSeed[] = [
  ...EXPERT_OPTIONS,
  ...ANALYSIS_LENS_OPTIONS,
  ...MODE_OPTIONS,
  ...OUTPUT_OPTIONS,
  ...LANGUAGE_OPTIONS,
  ...TOOL_PROMPTS,
  ...FORMULA_CARTRIDGES_SEED,
  ...WESTERN_FORMULA_CARTRIDGES_SEED,
  ...PRIORITY_RULES_SEED,
  ...WESTERN_PRIORITY_RULES_SEED,
];

const PROMPT_CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedPromptBodyEntry {
  body: string;
  modelId: string | null;
  expiresAt: number;
}

export interface ResolvedInternalRuleRecord {
  slug: string;
  category: 'formula_cartridge' | 'priority_rule';
  display_name: string;
  subtitle: string;
  prompt_body: string;
  model_id: string | null;
  tags: string[];
  sort_order: number;
  is_active: boolean;
  source: 'default' | 'db';
}

const promptBodyCache = new Map<string, CachedPromptBodyEntry>();

let publicCatalogCache: {
  data: ReturnType<typeof getPublicChatCatalog>;
  expiresAt: number;
} | null = null;

let formulaCartridgesCache: {
  data: Record<string, ResolvedInternalRuleRecord>;
  expiresAt: number;
} | null = null;

let priorityRulesCache: {
  data: Record<string, ResolvedInternalRuleRecord>;
  expiresAt: number;
} | null = null;

export function invalidatePromptCache(): void {
  promptBodyCache.clear();
  publicCatalogCache = null;
  formulaCartridgesCache = null;
  priorityRulesCache = null;
}

export function getPublicChatCatalog() {
  return {
    experts: EXPERT_OPTIONS.map((p) => ({
      slug: p.slug,
      category: p.category,
      displayName: p.display_name,
      subtitle: p.subtitle,
    })),
    modes: MODE_OPTIONS.map((p) => ({
      slug: p.slug,
      category: p.category,
      displayName: p.display_name,
      subtitle: p.subtitle,
    })),
    outputs: OUTPUT_OPTIONS.map((p) => ({
      slug: p.slug,
      category: p.category,
      displayName: p.display_name,
      subtitle: p.subtitle,
    })),
    languages: LANGUAGE_OPTIONS.map((p) => ({
      slug: p.slug,
      category: p.category,
      displayName: p.display_name,
      subtitle: p.subtitle,
    })),
    tools: TOOL_PROMPTS.map((p) => ({
      slug: p.slug,
      category: p.category,
      displayName: p.display_name,
      subtitle: p.subtitle,
    })),
  };
}

/**
 * Returns the public-safe chat catalog with a 5-minute TTL memory cache,
 * reflecting any active Admin customizations stored in `system_prompts`.
 */
export async function getPublicChatCatalogCached() {
  const now = Date.now();
  if (publicCatalogCache && publicCatalogCache.expiresAt > now) {
    return publicCatalogCache.data;
  }

  const base = getPublicChatCatalog();
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return base;
  }

  try {
    let rows: Array<{
      slug: string;
      category: string;
      display_name: string;
      subtitle?: string | null;
      sort_order?: number | null;
      is_active: boolean;
    }> | null = null;

    // Fetch all rows (active and inactive) so we can distinguish "explicitly disabled by Admin"
    // from "new Phase 1 default Council guide not yet seeded into system_prompts".
    const resWithSub = await supabaseAdmin
      .from('system_prompts')
      .select('slug, category, display_name, subtitle, sort_order, is_active');

    if (!resWithSub.error && resWithSub.data) {
      rows = resWithSub.data;
    } else {
      const resMid = await supabaseAdmin
        .from('system_prompts')
        .select('slug, category, display_name, subtitle, is_active');
      if (!resMid.error && resMid.data) {
        rows = resMid.data;
      } else {
        const resBase = await supabaseAdmin
          .from('system_prompts')
          .select('slug, category, display_name, is_active');
        if (!resBase.error && resBase.data) {
          rows = resBase.data;
        }
      }
    }

    const chatbotCfg = await getChatbotConfig();

    if (!rows || rows.length === 0) {
      publicCatalogCache = { data: base, expiresAt: now + PROMPT_CACHE_TTL_MS };
      return base;
    }

    const defaultMetaBySlug = new Map(ALL_DEFAULT_PROMPTS.map((d) => [d.slug, d]));
    const dbSeenSlugs = new Set(rows.map((r) => r.slug));
    const sortOrderBySlug = new Map<string, number>();
    const activeByCategory = {
      experts: [] as PromptCatalogOption[],
      modes: [] as PromptCatalogOption[],
      outputs: [] as PromptCatalogOption[],
      languages: [] as PromptCatalogOption[],
      tools: [] as PromptCatalogOption[],
    };

    for (const row of rows) {
      if (row.is_active === false) continue;
      if (INTERNAL_ONLY_PROMPT_CATEGORIES.has(row.category as PromptCategory)) continue;
      const def = defaultMetaBySlug.get(row.slug);
      if (typeof row.sort_order === 'number') {
        sortOrderBySlug.set(row.slug, row.sort_order);
      }
      const item: PromptCatalogOption = {
        slug: row.slug,
        category: row.category as PromptCategory,
        displayName: row.display_name || def?.display_name || row.slug,
        subtitle: row.subtitle || def?.subtitle || '',
      };

      if (row.category === 'expert' || row.category === 'learn' || row.slug === 'learn_astrology') {
        // Keep legacy Vedic sub-systems in Admin Recipes/Analysis rather than the primary Council menu
        if (!LEGACY_VEDIC_SUBSYSTEM_SLUGS.has(row.slug)) {
          activeByCategory.experts.push(item);
        }
      } else if (row.category === 'mode') {
        activeByCategory.modes.push(item);
      } else if (row.category === 'output') {
        activeByCategory.outputs.push(item);
      } else if (row.category === 'language') {
        activeByCategory.languages.push(item);
      } else if (row.category === 'tool') {
        activeByCategory.tools.push(item);
      }
    }

    // Ensure new default Council guides appear immediately even before Admin seeds system_prompts
    for (const defExpert of EXPERT_OPTIONS) {
      if (!dbSeenSlugs.has(defExpert.slug)) {
        activeByCategory.experts.push({
          slug: defExpert.slug,
          category: defExpert.category,
          displayName: defExpert.display_name,
          subtitle: defExpert.subtitle,
        });
      }
    }

    const sortWithPriority = (items: PromptCatalogOption[], preferredOrder: string[]) =>
      [...items].sort((a, b) => {
        const ia = preferredOrder.indexOf(a.slug);
        const ib = preferredOrder.indexOf(b.slug);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        const sa = sortOrderBySlug.get(a.slug) ?? 100;
        const sb = sortOrderBySlug.get(b.slug) ?? 100;
        if (sa !== sb) return sa - sb;
        return a.displayName.localeCompare(b.displayName);
      });

    const expertOrder = [
      ...(chatbotCfg.expert_order || []),
      ...EXPERT_OPTIONS.map((x) => x.slug),
    ];
    const modeOrder = [
      ...(chatbotCfg.mode_order || []),
      'general',
      ...MODE_OPTIONS.map((x) => x.slug),
    ];
    const languageOrder = [
      ...(chatbotCfg.language_order || []),
      ...LANGUAGE_OPTIONS.map((x) => x.slug),
    ];

    const merged = {
      experts:
        activeByCategory.experts.length > 0
          ? sortWithPriority(activeByCategory.experts, expertOrder)
          : base.experts,
      modes:
        activeByCategory.modes.length > 0
          ? sortWithPriority(activeByCategory.modes, modeOrder)
          : base.modes,
      outputs:
        activeByCategory.outputs.length > 0
          ? sortWithPriority(activeByCategory.outputs, OUTPUT_OPTIONS.map((x) => x.slug))
          : base.outputs,
      languages:
        activeByCategory.languages.length > 0
          ? sortWithPriority(activeByCategory.languages, languageOrder)
          : base.languages,
      tools:
        activeByCategory.tools.length > 0
          ? sortWithPriority(activeByCategory.tools, TOOL_PROMPTS.map((x) => x.slug))
          : base.tools,
    };

    publicCatalogCache = { data: merged, expiresAt: now + PROMPT_CACHE_TTL_MS };
    return merged;
  } catch {
    return base;
  }
}

export interface ResolvedPromptModules {
  bodies: Record<string, string>;
  models: Record<string, string | null>;
}

/**
 * Resolves live admin-customized prompt bodies and optional per-module OpenRouter model_id
 * overrides from Supabase `system_prompts` with a 5-minute TTL cache.
 */
export async function resolvePromptModules(slugs: string[]): Promise<ResolvedPromptModules> {
  const bodies: Record<string, string> = {};
  const models: Record<string, string | null> = {};
  const now = Date.now();
  const missingFromCache: string[] = [];

  const seedByLowerSlug = new Map<string, DefaultPromptSeed>();
  for (const seed of ALL_DEFAULT_PROMPTS) {
    seedByLowerSlug.set(seed.slug.toLowerCase(), seed);
  }

  for (const requestedSlug of slugs) {
    const seed = seedByLowerSlug.get(requestedSlug.trim().toLowerCase());
    if (seed) {
      bodies[requestedSlug] = seed.prompt_body;
      models[requestedSlug] = null;
    }
  }

  const normalizedToRequested = new Map<string, string[]>();
  for (const slug of slugs) {
    const cacheKey = slug.trim().toLowerCase();
    const cached = promptBodyCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      bodies[slug] = cached.body;
      models[slug] = cached.modelId;
    } else {
      missingFromCache.push(slug);
      const lower = cacheKey;
      const list = normalizedToRequested.get(lower) || [];
      list.push(slug);
      normalizedToRequested.set(lower, list);
    }
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || missingFromCache.length === 0) {
    return { bodies, models };
  }

  const querySlugs = Array.from(
    new Set(
      missingFromCache.flatMap((s) => {
        const lower = s.trim().toLowerCase();
        return s === lower ? [s] : [s, lower];
      })
    )
  );

  let rows: Array<{ slug: string; prompt_body: string; model_id?: string | null }> | null = null;
  const primaryRes = await supabaseAdmin
    .from('system_prompts')
    .select('slug, prompt_body, model_id')
    .in('slug', querySlugs)
    .eq('is_active', true);

  if (!primaryRes.error && primaryRes.data) {
    rows = primaryRes.data;
  } else {
    // Graceful fallback if `model_id` column hasn't been migrated yet
    const fallbackRes = await supabaseAdmin
      .from('system_prompts')
      .select('slug, prompt_body')
      .in('slug', querySlugs)
      .eq('is_active', true);
    if (!fallbackRes.error && fallbackRes.data) {
      rows = fallbackRes.data;
    }
  }

  const expiresAt = now + PROMPT_CACHE_TTL_MS;
  if (rows) {
    for (const row of rows) {
      if (row.prompt_body && typeof row.prompt_body === 'string') {
        const lowerSlug = String(row.slug || '').trim().toLowerCase();
        const modelOverride =
          typeof row.model_id === 'string' && row.model_id.trim() ? row.model_id.trim() : null;
        const targets = normalizedToRequested.get(lowerSlug) || [row.slug];
        for (const reqSlug of targets) {
          bodies[reqSlug] = row.prompt_body;
          models[reqSlug] = modelOverride;
        }
        promptBodyCache.set(lowerSlug, {
          body: row.prompt_body,
          modelId: modelOverride,
          expiresAt,
        });
      }
    }
  }

  // Cache fallback bodies for slugs not yet in DB so we don't repeatedly query for them
  for (const slug of missingFromCache) {
    const lowerSlug = slug.trim().toLowerCase();
    if (!promptBodyCache.has(lowerSlug) && bodies[slug]) {
      promptBodyCache.set(lowerSlug, { body: bodies[slug], modelId: null, expiresAt });
    }
  }

  return { bodies, models };
}

/**
 * Resolves live admin-customized prompts from Supabase `system_prompts` with 5-minute TTL cache,
 * falling back seamlessly to `promptDefaults.ts` when keys aren't seeded yet.
 */
export async function resolvePromptBodies(slugs: string[]): Promise<Record<string, string>> {
  const { bodies } = await resolvePromptModules(slugs);
  return bodies;
}

async function resolveInternalRulesByCategory(
  targetCategory: 'formula_cartridge' | 'priority_rule',
  seeds: DefaultPromptSeed[]
): Promise<Record<string, ResolvedInternalRuleRecord>> {
  const result: Record<string, ResolvedInternalRuleRecord> = {};
  for (const seed of seeds) {
    const slug = seed.slug.toLowerCase();
    result[slug] = {
      slug,
      category: targetCategory,
      display_name: seed.display_name,
      subtitle: seed.subtitle,
      prompt_body: seed.prompt_body,
      model_id: null,
      tags: Array.isArray(seed.tags) ? [...seed.tags] : [],
      sort_order: typeof seed.sort_order === 'number' ? seed.sort_order : 100,
      is_active: true,
      source: 'default',
    };
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return result;
  }

  try {
    const targetSlugs = Object.keys(result);
    const [overridesRes, promptsRes] = await Promise.all([
      supabaseAdmin
        .from('platform_settings')
        .select('value_json')
        .eq('key', 'prompt_category_overrides')
        .maybeSingle(),
      (async () => {
        const full = await supabaseAdmin
          .from('system_prompts')
          .select('id, slug, category, display_name, subtitle, prompt_body, model_id, tags, sort_order, is_active')
          .or(`category.eq.${targetCategory},slug.in.(${targetSlugs.join(',')})`);
        if (!full.error && full.data) return full.data;

        const mid = await supabaseAdmin
          .from('system_prompts')
          .select('id, slug, category, display_name, subtitle, prompt_body, model_id, is_active')
          .or(`category.eq.${targetCategory},slug.in.(${targetSlugs.join(',')})`);
        if (!mid.error && mid.data) return mid.data;

        const base = await supabaseAdmin
          .from('system_prompts')
          .select('id, slug, category, display_name, prompt_body, is_active')
          .or(`category.eq.${targetCategory},slug.in.(${targetSlugs.join(',')})`);
        return base.data || [];
      })(),
    ]);

    const overrides =
      !overridesRes.error &&
      overridesRes.data?.value_json &&
      typeof overridesRes.data.value_json === 'object' &&
      !Array.isArray(overridesRes.data.value_json)
        ? (overridesRes.data.value_json as Record<string, string>)
        : {};

    for (const row of promptsRes as Array<{
      id: string;
      slug: string;
      category: string;
      display_name?: string | null;
      subtitle?: string | null;
      prompt_body?: string | null;
      model_id?: string | null;
      tags?: string[] | null;
      sort_order?: number | null;
      is_active?: boolean | null;
    }>) {
      const effectiveCategory = overrides[row.id] || row.category;
      const slug = String(row.slug || '').trim().toLowerCase();
      if (!slug) continue;
      if (effectiveCategory !== targetCategory && !result[slug]) continue;
      if (effectiveCategory !== targetCategory && row.category !== 'system') continue;

      const existing = result[slug];
      result[slug] = {
        slug,
        category: targetCategory,
        display_name: row.display_name?.trim() || existing?.display_name || slug,
        subtitle: row.subtitle?.trim() || existing?.subtitle || '',
        prompt_body: row.prompt_body?.trim() || existing?.prompt_body || '',
        model_id: typeof row.model_id === 'string' && row.model_id.trim() ? row.model_id.trim() : null,
        tags: Array.isArray(row.tags) ? row.tags : existing?.tags || [],
        sort_order: typeof row.sort_order === 'number' ? row.sort_order : existing?.sort_order ?? 100,
        is_active: row.is_active !== false,
        source: 'db',
      };
    }
  } catch {
    // Non-fatal: seed defaults remain intact
  }

  return result;
}

/**
 * Server-only cached lookup for all Vedic Formula Cartridges (`formula_cartridge`).
 * Reflects live Admin edits and active toggles; NEVER exposed to public `/api/chat/config`.
 */
export async function getFormulaCartridgesCached(): Promise<
  Record<string, ResolvedInternalRuleRecord>
> {
  const now = Date.now();
  if (formulaCartridgesCache && formulaCartridgesCache.expiresAt > now) {
    return formulaCartridgesCache.data;
  }
  const data = await resolveInternalRulesByCategory('formula_cartridge', [
    ...FORMULA_CARTRIDGES_SEED,
    ...WESTERN_FORMULA_CARTRIDGES_SEED,
  ]);
  formulaCartridgesCache = { data, expiresAt: now + PROMPT_CACHE_TTL_MS };
  return data;
}

/**
 * Server-only cached lookup for all Vedic + Western Context Priority Rules (`priority_rule`).
 * Reflects live Admin edits and active toggles; NEVER exposed to public `/api/chat/config`.
 */
export async function getPriorityRulesCached(): Promise<
  Record<string, ResolvedInternalRuleRecord>
> {
  const now = Date.now();
  if (priorityRulesCache && priorityRulesCache.expiresAt > now) {
    return priorityRulesCache.data;
  }
  const data = await resolveInternalRulesByCategory('priority_rule', [
    ...PRIORITY_RULES_SEED,
    ...WESTERN_PRIORITY_RULES_SEED,
  ]);
  priorityRulesCache = { data, expiresAt: now + PROMPT_CACHE_TTL_MS };
  return data;
}
