import { getSupabaseAdmin } from '../lib/supabaseAdmin';

export interface ReportPromptStep {
  stepNumber: number;
  title: string;
  instruction: string;
}

export interface DefaultReportSeed {
  slug: string;
  name: string;
  category: string;
  short_description: string;
  long_description: string;
  price_credits: number;
  sort_order: number;
  prompt_chain_json: ReportPromptStep[];
}

export const DEFAULT_REPORT_CATALOG: DefaultReportSeed[] = [
  {
    slug: 'life-blueprint-dossier',
    name: 'Life Blueprint Deep Research Dossier',
    category: 'Life & Dharma',
    short_description:
      'A comprehensive 4-pass Vedic life map integrating Parashari, KP, Jaimini, and multi-year Dasha synthesis.',
    long_description:
      'Built across four sequential analytical passes, this flagship dossier audits your Rashi (D1) architecture, Navamsa (D9) soul maturation, Dasamsa (D10) vocation, KP Cuspal Sub-Lords, Jaimini Chara Karakas, and a 36-month Mahadasha-Antardasha-Gochar strategic forecast.',
    price_credits: 4000,
    sort_order: 1,
    prompt_chain_json: [
      {
        stepNumber: 1,
        title: 'Pass 1 · Natal Architecture & Divisional Vargas (D1–D60)',
        instruction:
          'Analyze Lagna lord, Moon strength, Sun vitality, major Raja/Dhana/Vipareeta Yogas, planetary dignities, Sarvashtakavarga bindu distribution, and key divisional charts (D9 Navamsa, D10 Dasamsa, D4, D12, D60). Cite exact signs, degrees, Nakshatras, and house numbers from the chart context.',
      },
      {
        stepNumber: 2,
        title: 'Pass 2 · KP Sub-Lord Promise & Jaimini Karma Mechanics',
        instruction:
          'Synthesize KP Placidus Cuspal Sub-Lords for Houses 1, 2, 5, 7, 9, 10, and 11 along with ABCD significators. Integrate Jaimini Atmakaraka, Amatyakaraka, Darakaraka, and Karakamsha themes to uncover recurring life lessons and authentic dharma.',
      },
      {
        stepNumber: 3,
        title: 'Pass 3 · 36-Month Vimshottari Dasha & Gochar Forecast',
        instruction:
          'Map the active Mahadasha, Antardasha, and upcoming Pratyantardasha transitions across the next 36 months, overlaying slow Jupiter, Saturn, and Rahu-Ketu Gochar shifts relative to natal Lagna and Moon. Identify high-leverage timing windows and periods requiring disciplined consolidation.',
      },
      {
        stepNumber: 4,
        title: 'Pass 4 · Strategic Executive Synthesis & Personal Questions',
        instruction:
          'Combine Passes 1–3 into one seamless, editorial-grade Vedic dossier. Directly answer every specific user question submitted with the order, eliminate redundancy, preserve all exact planetary citations and dates, and conclude with grounded, non-fatalistic life strategy principles.',
      },
    ],
  },
  {
    slug: 'career-vocation-masterplan',
    name: 'Career, Vocation & D10 Strategy Report',
    category: 'Career & Vocation',
    short_description:
      'Deep analysis of 10th house leadership, D10 Dasamsa, Amatyakaraka, KP 2-6-10-11 promise, and role timing.',
    long_description:
      'Designed for executives, founders, and seekers at a professional crossroads. Evaluates employment vs. entrepreneurial strength, authority cycles, income scalability, and optimal transition windows over the next 24 months.',
    price_credits: 2500,
    sort_order: 2,
    prompt_chain_json: [
      {
        stepNumber: 1,
        title: 'Pass 1 · 10th House, 6th vs 7th Axis & D10 Dasamsa Strength',
        instruction:
          'Evaluate the 10th house/lord, 6th (service) vs 7th (independent enterprise/consulting), 11th gains, Sun/Saturn/Mercury dignity, and D10 Dasamsa alignments alongside Sarvashtakavarga scores in Artha houses (2, 6, 10, 11).',
      },
      {
        stepNumber: 2,
        title: 'Pass 2 · KP 10th/11th Cusp Sub-Lords & Jaimini Amatyakaraka',
        instruction:
          'Audit KP 10th, 6th, 2nd, and 11th Cuspal Sub-Lords (checking 2-6-10-11 vs 5-8-12 significations) and examine Jaimini Amatyakaraka (AmK) and Karakamsha career inclinations.',
      },
      {
        stepNumber: 3,
        title: 'Pass 3 · Role Transition Windows & Gochar Momentum',
        instruction:
          'Identify concrete career pivots, promotion windows, or consolidation phases across active Dasha-Bhukti-Antara cycles and Saturn/Jupiter transits over the 10th house and natal Moon.',
      },
      {
        stepNumber: 4,
        title: 'Pass 4 · Unified Career Masterplan & Q&A Resolution',
        instruction:
          'Compile Passes 1–3 into a crisp, authoritative Career Strategy Dossier. Address every user question directly with chart evidence, decision trade-offs, and practical timing guidance.',
      },
    ],
  },
  {
    slug: 'marriage-navamsa-dossier',
    name: 'Marriage, Partnership & D9 Navamsa Report',
    category: 'Marriage & Partnership',
    short_description:
      'In-depth study of 7th house dynamics, D9 Navamsa architecture, Darakaraka, timing, and relational harmony.',
    long_description:
      'Examines marital promise, spousal temperament traits, timing windows for commitment, and how partnership evolves emotionally and practically across long Dasha cycles.',
    price_credits: 3000,
    sort_order: 3,
    prompt_chain_json: [
      {
        stepNumber: 1,
        title: 'Pass 1 · 7th House, Venus/Jupiter & D9 Navamsa Foundations',
        instruction:
          'Analyze the 7th house/lord, 2nd (family continuity), 4th (domestic peace), 11th, Venus, Jupiter, and complete D9 Navamsa Ascendant/7th house dignity and planetary exchanges.',
      },
      {
        stepNumber: 2,
        title: 'Pass 2 · KP 7th Cusp Sub-Lord & Jaimini Darakaraka',
        instruction:
          'Examine the KP 7th and 2nd/11th Cuspal Sub-Lords for commitment promise and dynamics, plus Jaimini Darakaraka (DK) sign, Navamsa dignity, and emotional compatibility traits.',
      },
      {
        stepNumber: 3,
        title: 'Pass 3 · Partnership Timing Windows & Stress Mitigation',
        instruction:
          'Pinpoint key Dasha-Antardasha periods and Jupiter/Saturn transits activating the 7th/1st/D9 axis, plus periods requiring extra communication and patience.',
      },
      {
        stepNumber: 4,
        title: 'Pass 4 · Cohesive Relationship Roadmap & Direct Answers',
        instruction:
          'Unify Passes 1–3 into a compassionate, psychologically perceptive Marriage & Partnership Dossier, directly answering all user questions clearly.',
      },
    ],
  },
  {
    slug: 'wealth-prosperity-audit',
    name: 'Wealth, Dhana Yogas & Asset Timing Audit',
    category: 'Wealth & Assets',
    short_description:
      'Evaluates 2nd/11th cashflow, D2 Hora, D4 fixed assets, KP 2-6-11 promise, and risk timing cycles.',
    long_description:
      'A disciplined wealth architecture reading distinguishing steady compounding channels from speculative risk windows across your active Dashas and Ashtakavarga bindus.',
    price_credits: 2500,
    sort_order: 4,
    prompt_chain_json: [
      {
        stepNumber: 1,
        title: 'Pass 1 · Dhana Yogas, 2nd/11th Houses, D2 & D4 Analysis',
        instruction:
          'Audit wealth-generating combinations across 1st, 2nd, 5th, 9th, and 11th houses, 4th house real estate/assets, D2 Hora, D4 Chaturthamsa, and Sarvashtakavarga income vs expenditure ratios (11th vs 12th).',
      },
      {
        stepNumber: 2,
        title: 'Pass 2 · KP Financial Significators (2-6-11 vs 5-8-12)',
        instruction:
          'Inspect KP 2nd, 6th, 11th, and 4th Cuspal Sub-Lords to evaluate accumulation capacity, asset liquidity, and speculative restraint.',
      },
      {
        stepNumber: 3,
        title: 'Pass 3 · 24-Month Cashflow & Investment Pacing Windows',
        instruction:
          'Analyze upcoming Antardasha and slow Gochar cycles highlighting expansion phases vs capital-preservation periods.',
      },
      {
        stepNumber: 4,
        title: 'Pass 4 · Strategic Wealth Brief & User Questions',
        instruction:
          'Assemble Passes 1–3 into an actionable financial timing dossier with clear risk boundaries and direct answers to the user’s questions (no regulated financial advice claims).',
      },
    ],
  },
  {
    slug: 'love-timeline-report',
    name: 'Love & Romantic Timing Horizon Report',
    category: 'Love & Romance',
    short_description:
      '5th/7th/11th romance signatures, Venus-Moon chemistry, emotional patterns, and encounter windows.',
    long_description:
      'Explores romantic attraction style, karmic attachment triggers, and high-probability seasonal & Dasha timing windows for meaningful connection.',
    price_credits: 2200,
    sort_order: 5,
    prompt_chain_json: [
      {
        stepNumber: 1,
        title: 'Pass 1 · 5th House, Venus, Moon & Romantic Signatures',
        instruction:
          'Analyze the 5th house/lord, Venus, Moon, Mars-Venus interplay, and D9 romantic undertones.',
      },
      {
        stepNumber: 2,
        title: 'Pass 2 · KP 5-7-11 Significators & Karmic Patterns',
        instruction:
          'Check KP 5th and 7th Cuspal Sub-Lords plus Rahu/Ketu and Jaimini Darakaraka influences on attraction and bonding.',
      },
      {
        stepNumber: 3,
        title: 'Pass 3 · Upcoming Romantic Windows (18 Months)',
        instruction:
          'Detail active Dasha-Bhukti periods and Venus/Jupiter transits opening resonance and connection.',
      },
      {
        stepNumber: 4,
        title: 'Pass 4 · Relational Clarity Synthesis',
        instruction:
          'Deliver a warm, insightful Love & Romantic Timing Dossier answering all submitted questions thoroughly.',
      },
    ],
  },
  {
    slug: 'health-vitality-constitution',
    name: 'Vitality, Constitution & Resilience Report',
    category: 'Health & Vitality',
    short_description:
      'Preventive Vedic constitution pacing across Lagna, Sun, Moon, 6th/8th/12th stress windows & routines.',
    long_description:
      'Maps constitutional stamina, mental recovery rhythms, Ashtakavarga vulnerable zones, and Dasha pacing windows so you can align workload and rest intelligently.',
    price_credits: 2200,
    sort_order: 6,
    prompt_chain_json: [
      {
        stepNumber: 1,
        title: 'Pass 1 · Lagna Vitality, Moon Mind & Ashtakavarga Resilience',
        instruction:
          'Assess Lagna lord strength, Sun (vitality), Moon (nervous/emotional balance), 6th/8th/12th houses, and low/high Ashtakavarga houses.',
      },
      {
        stepNumber: 2,
        title: 'Pass 2 · KP 1st/6th/8th/12th Indicators & Stress Triggers',
        instruction:
          'Evaluate KP 1st and 6th Cuspal Sub-Lords and D30/D12 subtle indicators purely from a preventive constitutional perspective.',
      },
      {
        stepNumber: 3,
        title: 'Pass 3 · Recovery & High-Load Pacing Windows',
        instruction:
          'Outline upcoming Dasha and Saturn/Mars transit phases calling for rest, pacing, and stress hygiene.',
      },
      {
        stepNumber: 4,
        title: 'Pass 4 · Preventive Vitality Synthesis (Non-Medical)',
        instruction:
          'Synthesize Passes 1–3 into an empowering, non-diagnostic vitality dossier reminding the reader that astrological insights complement—never replace—qualified medical care.',
      },
    ],
  },
];

let seededCatalogOnce = false;

export async function ensureReportCatalogSeeded(): Promise<void> {
  if (seededCatalogOnce) return;
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  try {
    const { count } = await supabaseAdmin
      .from('report_catalog')
      .select('id', { count: 'exact', head: true });

    if ((count || 0) === 0) {
      await supabaseAdmin.from('report_catalog').upsert(
        DEFAULT_REPORT_CATALOG.map((item) => ({
          slug: item.slug,
          name: item.name,
          category: item.category,
          short_description: item.short_description,
          long_description: item.long_description,
          price_credits: item.price_credits,
          prompt_chain_json: item.prompt_chain_json,
          sort_order: item.sort_order,
          is_active: true,
        })),
        { onConflict: 'slug' }
      );
    }
    seededCatalogOnce = true;
  } catch (err) {
    console.warn('[reportDefaults] Seed warning:', err);
  }
}
