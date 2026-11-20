import { enrichCompiledChart, formatChartForLLM, type CompiledChartData } from './chartCompiler';
import type { PlanetPosition, DashaNode, WesternPlanetPosition } from './jyotishMath';
import { formatPythagoreanNumerologyContext } from './divinationEngines';
import type {
  BreakdownDomain,
  MiniAppDefinition,
  MiniAppStructuredHeader,
  PlanetStrengthQuestion,
} from '../../components/app/miniAppsTypes';

// =============================================================================
// WAVE 1 MINI-APPS CATALOG (15 Editorial Apps across 4 Reusable Templates)
// =============================================================================

export const MINI_APPS_CATALOG: MiniAppDefinition[] = [
  {
    slug: 'daily-horoscope',
    title: 'Daily Horoscope',
    shortTitle: 'Daily Horoscope',
    tagline: 'Personal transit & lunar rhythm for today',
    description:
      'Combines today’s Sidereal sky movements, active Moon Nakshatra, and your current Vimshottari Dasha into clear, grounded daily counsel.',
    category: 'daily_timing',
    categoryLabel: 'Timing',
    template: 'auto_brief',
    iconKey: 'sun',
    popular: true,
    featuredOnHome: true,
    requiresProfile: true,
    cacheScope: 'daily',
    chatSeedPrompt: 'Walk me deeper through today’s transit timing and where I should focus my energy.',
    estimatedRead: '2 min read',
  },
  {
    slug: 'weekly-horoscope',
    title: 'Weekly Horoscope',
    shortTitle: 'Weekly Horoscope',
    tagline: 'Seven-day pacing across work, energy & relationships',
    description:
      'Maps the week’s lunar arc and planetary aspects against your natal houses so you know which days suit action and which invite reflection.',
    category: 'daily_timing',
    categoryLabel: 'Timing',
    template: 'auto_brief',
    iconKey: 'calendar-days',
    popular: true,
    featuredOnHome: true,
    requiresProfile: true,
    cacheScope: 'weekly',
    chatSeedPrompt: 'Which specific days this week carry the best alignment for important conversations or decisions?',
    estimatedRead: '3 min read',
  },
  {
    slug: 'monthly-horoscope',
    title: 'Monthly Horoscope',
    shortTitle: 'Monthly Horizon',
    tagline: 'Long-range strategic themes for the month ahead',
    description:
      'Synthesizes slow-moving Jupiter, Saturn, and nodal transits with your Antardasha cycle to frame key priorities for the month.',
    category: 'daily_timing',
    categoryLabel: 'Timing',
    template: 'auto_brief',
    iconKey: 'moon',
    popular: true,
    featuredOnHome: true,
    requiresProfile: true,
    cacheScope: 'monthly',
    chatSeedPrompt: 'Help me plan my key priorities for this month based on my current monthly horizon.',
    estimatedRead: '3 min read',
  },
  {
    slug: 'current-transits',
    title: 'Current Transits',
    shortTitle: 'Current Transits',
    tagline: 'Live Sidereal planetary sky mapped to your natal houses',
    description:
      'Inspect exact current Gochar planetary degrees, retrogrades, Ashtakavarga bindus, and how today’s sky activates your Lagna and Moon.',
    category: 'daily_timing',
    categoryLabel: 'Timing',
    template: 'auto_brief',
    iconKey: 'orbit',
    popular: true,
    featuredOnHome: true,
    requiresProfile: false,
    cacheScope: 'daily',
    chatSeedPrompt: 'Explain which active transit in today’s sky matters most for my chart right now.',
    estimatedRead: '3 min read',
  },
  {
    slug: 'dasha-analysis',
    title: 'Dasha Analysis',
    shortTitle: 'Dasha Analysis',
    tagline: 'Vimshottari Mahadasha, Antardasha & next 12-month arc',
    description:
      'Decodes the exact planetary chapters governing your life right now, upcoming sub-period pivots, and practical ways to align with them.',
    category: 'daily_timing',
    categoryLabel: 'Timing',
    template: 'auto_brief',
    iconKey: 'hourglass',
    popular: true,
    featuredOnHome: true,
    requiresProfile: true,
    cacheScope: 'monthly',
    chatSeedPrompt: 'Cross-check my active Mahadasha and Antardasha across KP Sub-Lords and D9/D10.',
    estimatedRead: '4 min read',
  },
  {
    slug: 'birth-chart-breakdown',
    title: 'Birth Chart Breakdown',
    shortTitle: 'Chart Breakdown',
    tagline: 'One-click explorer across 11 life domains & 35+ chart topics',
    description:
      'Browse natural gifts, shadow traits, planetary strength, Raja Yogas, marriage, career, wealth, health, and roots — cached per chart.',
    category: 'self_chart',
    categoryLabel: 'Identity',
    template: 'domain_explorer',
    iconKey: 'compass',
    popular: true,
    featuredOnHome: true,
    requiresProfile: true,
    cacheScope: 'chart',
    chatSeedPrompt: 'Let’s dive deeper into the key yogas and house strengths highlighted in my Birth Chart Breakdown.',
    estimatedRead: 'Interactive',
  },
  {
    slug: 'wealth-blueprint',
    title: 'Wealth Blueprint',
    shortTitle: 'Wealth Blueprint',
    tagline: '2nd & 11th house Dhana Yogas, earning style & blind spots',
    description:
      'Uncovers how your chart naturally builds, scales, and retains capital across 2nd/11th lords, D2 Hora, and Jupiter transit timing.',
    category: 'money_career',
    categoryLabel: 'Money & Career',
    template: 'auto_brief',
    iconKey: 'landmark',
    popular: true,
    featuredOnHome: true,
    requiresProfile: true,
    cacheScope: 'monthly',
    chatSeedPrompt: 'Audit my 2nd and 11th house Dhana Yogas and upcoming financial expansion windows.',
    estimatedRead: '3 min read',
  },
  {
    slug: 'love-forecast',
    title: 'Love Forecast',
    shortTitle: 'Love Forecast',
    tagline: 'Venus cycles, romantic timing & emotional resonance',
    description:
      'Tracks Venus, 5th/7th house activations, and Navamsa themes to reveal upcoming connection windows and relationship pacing.',
    category: 'love',
    categoryLabel: 'Love',
    template: 'auto_brief',
    iconKey: 'heart',
    popular: true,
    featuredOnHome: true,
    requiresProfile: true,
    cacheScope: 'monthly',
    chatSeedPrompt: 'Explore my upcoming love and partnership windows using Venus, 7th house, and D9 Navamsa.',
    estimatedRead: '3 min read',
  },
  {
    slug: 'career-navigator',
    title: 'Career Navigator',
    shortTitle: 'Career Navigator',
    tagline: '10th house vocation, D10 Dasamsa & 12-month trajectory',
    description:
      'Clarifies your vocational strengths, daily work style (6th vs 10th house), aligned industries, and key career shifts over the next year.',
    category: 'money_career',
    categoryLabel: 'Money & Career',
    template: 'auto_brief',
    iconKey: 'briefcase',
    popular: false,
    featuredOnHome: false,
    requiresProfile: true,
    cacheScope: 'monthly',
    chatSeedPrompt: 'Analyze my career roadmap using D10 Dasamsa, Amatyakaraka, and KP 10th Cusp Sub-Lord.',
    estimatedRead: '3 min read',
  },
  {
    slug: 'numerology',
    title: 'Numerology Blueprint',
    shortTitle: 'Numerology',
    tagline: 'Verified Pythagorean Life Path, Destiny & Personal Year',
    description:
      'Computes exact Pythagorean numbers (preserving Master Numbers 11, 22, 33) and translates them into career, love, and timing clarity.',
    category: 'self_chart',
    categoryLabel: 'Identity',
    template: 'auto_brief',
    iconKey: 'hash',
    popular: false,
    featuredOnHome: false,
    requiresProfile: true,
    cacheScope: 'monthly',
    chatSeedPrompt: 'How do my Numerology Life Path and Personal Year reinforce what my Vedic chart shows right now?',
    estimatedRead: '3 min read',
  },
  {
    slug: 'planet-strength-tester',
    title: 'Planet Strength Tester',
    shortTitle: 'Planet Strength',
    tagline: 'Interactive 5-question assessment + real chart dignity audit',
    description:
      'Test how Sun, Moon, Mars, Mercury, Jupiter, Venus, or Saturn expresses in daily life — cross-referenced against your actual chart placement.',
    category: 'self_chart',
    categoryLabel: 'Identity',
    template: 'guided_quiz',
    iconKey: 'gauge',
    popular: false,
    featuredOnHome: false,
    requiresProfile: false,
    cacheScope: 'none',
    chatSeedPrompt: 'Help me work constructively with my planetary strengths and practical habits to balance weaker placements.',
    estimatedRead: '2 min quiz',
  },
  {
    slug: 'love-compatibility',
    title: 'Love Compatibility',
    shortTitle: 'Compatibility',
    tagline: 'Two-person relational dynamics, harmony & friction guide',
    description:
      'Compare your chart with a partner’s saved profile or birth date for grounded synastry, numerological resonance, and practical navigation tips.',
    category: 'love',
    categoryLabel: 'Love',
    template: 'form_reading',
    iconKey: 'heart-handshake',
    popular: true,
    featuredOnHome: false,
    requiresProfile: true,
    cacheScope: 'none',
    chatSeedPrompt: 'Let’s explore deeper relationship compatibility and communication patterns between our two charts.',
    estimatedRead: 'Interactive',
  },
  {
    slug: 'salary-negotiator',
    title: 'Salary & Offer Strategist',
    shortTitle: 'Salary Strategist',
    tagline: 'Three tailored negotiation scripts timed to Mercury & Jupiter',
    description:
      'Share your offer or promotion context to receive Confident, Analytical, and Collaborative scripts plus favorable communication timing.',
    category: 'money_career',
    categoryLabel: 'Money & Career',
    template: 'form_reading',
    iconKey: 'scale',
    popular: false,
    featuredOnHome: false,
    requiresProfile: true,
    cacheScope: 'none',
    chatSeedPrompt: 'Help me time and prepare for my upcoming compensation conversation using my 2nd, 6th, and 10th houses.',
    estimatedRead: 'Interactive',
  },
  {
    slug: 'dream-interpreter',
    title: 'Dream Interpreter',
    shortTitle: 'Dream Interpreter',
    tagline: 'Archetypal symbol reading linked to your Moon & 12th house',
    description:
      'Log a vivid or recurring dream to unpack its psychological symbols, natal Moon/12th-house echoes, and calm grounding reflections.',
    category: 'mind_wellness',
    categoryLabel: 'Mind & Wellness',
    template: 'form_reading',
    iconKey: 'cloud-moon',
    popular: false,
    featuredOnHome: false,
    requiresProfile: false,
    cacheScope: 'none',
    chatSeedPrompt: 'Can we reflect further on the subconscious themes and 12th-house/Moon transits behind my recent dreams?',
    estimatedRead: 'Interactive',
  },
  {
    slug: 'affirmations-generator',
    title: 'Affirmations Generator',
    shortTitle: 'Affirmations',
    tagline: 'Chart-grounded reflections tailored to your current chapter',
    description:
      'Share what you are navigating to receive grounded, realistic personal affirmations anchored in your Moon, Venus, 2nd house, and Jupiter.',
    category: 'mind_wellness',
    categoryLabel: 'Mind & Wellness',
    template: 'form_reading',
    iconKey: 'feather',
    popular: false,
    featuredOnHome: false,
    requiresProfile: true,
    cacheScope: 'none',
    chatSeedPrompt: 'Suggest practical daily grounding habits aligned with my Moon Nakshatra and current Dasha.',
    estimatedRead: 'Interactive',
  },
  // ---------------- WAVE 2 GROUNDED MINI-APPS (7 Additional Editorial Apps) ----------------
  {
    slug: 'birth-chart-matching',
    title: 'Birth Chart Matching',
    shortTitle: 'Chart Matching',
    tagline: 'Vedic Ashtakoot harmony, Moon resonance & long-term partnership alignment',
    description:
      'Compares two birth charts across Moon Nakshatras, 7th-house balance, Mars/Venus interplay, and emotional longevity — grounded and clear, never fear-based.',
    category: 'love',
    categoryLabel: 'Love',
    template: 'form_reading',
    iconKey: 'users',
    popular: true,
    featuredOnHome: false,
    requiresProfile: true,
    cacheScope: 'none',
    chatSeedPrompt: 'Walk me through a full Ashtakoot, Navamsa (D9), and Venus/Mars comparison between our two charts.',
    estimatedRead: 'Interactive',
  },
  {
    slug: 'breakup-clarity',
    title: 'Breakup Clarity & Closure',
    shortTitle: 'Breakup Closure',
    tagline: 'Compassionate timing perspective & grounded emotional recovery after a parting',
    description:
      'Explores why a relationship chapter closed through Dasha, Saturn/Rahu transits, and Moon healing cycles — offering steady emotional pacing and closure.',
    category: 'love',
    categoryLabel: 'Love',
    template: 'form_reading',
    iconKey: 'shield-check',
    popular: false,
    featuredOnHome: false,
    requiresProfile: true,
    cacheScope: 'none',
    chatSeedPrompt: 'Help me understand the Dasha and transit lesson behind my recent breakup and when emotional steadiness returns.',
    estimatedRead: 'Interactive',
  },
  {
    slug: 'relationship-patterns',
    title: 'Relationship Pattern Decoder',
    shortTitle: 'Pattern Decoder',
    tagline: '7th house, Venus & Rahu-Ketu recurring dynamics in love',
    description:
      'Uncovers why certain emotional dynamics or partner archetypes repeat across your life and how to step into healthier mutual reciprocity.',
    category: 'love',
    categoryLabel: 'Love',
    template: 'form_reading',
    iconKey: 'refresh-cw',
    popular: false,
    featuredOnHome: false,
    requiresProfile: true,
    cacheScope: 'none',
    chatSeedPrompt: 'Examine my 7th house, Venus, Darakaraka, and Rahu-Ketu axis to explain recurring relationship patterns.',
    estimatedRead: 'Interactive',
  },
  {
    slug: 'soul-compass',
    title: 'Soul Purpose & Nodal Compass',
    shortTitle: 'Soul Compass',
    tagline: 'Rahu-Ketu evolutionary axis, Atmakaraka & D9 Dharma synthesis',
    description:
      'Maps your lifelong growth arc from familiar past strengths (Ketu) toward uncharted purpose (Rahu), anchored by your Jaimini Atmakaraka and 9th house.',
    category: 'self_chart',
    categoryLabel: 'Identity',
    template: 'auto_brief',
    iconKey: 'sparkles',
    popular: true,
    featuredOnHome: false,
    requiresProfile: true,
    cacheScope: 'chart',
    chatSeedPrompt: 'Explore my Atmakaraka, Karakamsha, and Rahu-Ketu axis in deeper detail for my long-term purpose.',
    estimatedRead: '3 min read',
  },
  {
    slug: 'jupiter-opportunities',
    title: 'Jupiter Expansion Windows',
    shortTitle: 'Jupiter Windows',
    tagline: 'Growth, mentorship, learning & fortunate timing windows ahead',
    description:
      'Tracks Jupiter’s Sidereal transit through your natal houses, Ashtakavarga support, and Dasha links to spot realistic growth and opportunity stretches.',
    category: 'money_career',
    categoryLabel: 'Money & Career',
    template: 'auto_brief',
    iconKey: 'trending-up',
    popular: false,
    featuredOnHome: false,
    requiresProfile: true,
    cacheScope: 'monthly',
    chatSeedPrompt: 'Pinpoint my strongest Jupiter expansion windows over the next 12 months across career, study, and finances.',
    estimatedRead: '3 min read',
  },
  {
    slug: 'cosmic-archetype',
    title: 'Cosmic Archetype Profile',
    shortTitle: 'Cosmic Archetype',
    tagline: 'Your signature Lagna, Moon Nakshatra & elemental temperament portrait',
    description:
      'Distills your Ascendant, Moon Nakshatra, dominant planetary lord, and Atmakaraka into a concise editorial portrait of how you think, decide, and lead.',
    category: 'self_chart',
    categoryLabel: 'Identity',
    template: 'auto_brief',
    iconKey: 'flame',
    popular: false,
    featuredOnHome: false,
    requiresProfile: true,
    cacheScope: 'chart',
    chatSeedPrompt: 'Explain how my Ascendant, Moon Nakshatra, and Atmakaraka work together in my core personality.',
    estimatedRead: '3 min read',
  },
  {
    slug: 'pet-bond',
    title: 'Pet Temperament & Bond',
    shortTitle: 'Pet Bond',
    tagline: 'Warm character reading of your companion animal & shared rhythm',
    description:
      'Share your pet’s name, species, and birth or adoption date for a lighthearted, thoughtful portrait of their temperament and bond with your home.',
    category: 'mind_wellness',
    categoryLabel: 'Mind & Wellness',
    template: 'form_reading',
    iconKey: 'paw-print',
    popular: false,
    featuredOnHome: false,
    requiresProfile: false,
    cacheScope: 'none',
    chatSeedPrompt: 'Tell me more about my 4th and 6th house themes around home sanctuary and caring for animals.',
    estimatedRead: 'Interactive',
  },
];

export const MINI_APPS_BY_SLUG: Record<string, MiniAppDefinition> = Object.fromEntries(
  MINI_APPS_CATALOG.map((app) => [app.slug, app])
);

// =============================================================================
// BIRTH CHART BREAKDOWN DOMAINS (11 Domains × 3-4 Focused Topics)
// =============================================================================

export interface ServerBreakdownTopic {
  id: string;
  label: string;
  summary: string;
  instruction: string;
}

export interface ServerBreakdownDomain extends BreakdownDomain {
  topics: ServerBreakdownTopic[];
}

export const BIRTH_CHART_DOMAINS: ServerBreakdownDomain[] = [
  {
    id: 'gifts',
    title: 'My Gifts',
    subtitle: 'Natural aptitudes, distinctive talents & hidden chart strengths',
    topics: [
      {
        id: 'natural-talents',
        label: 'Natural Talents',
        summary: 'Core innate strengths from Lagna, Sun, Moon & Kendra lords',
        instruction: 'Analyze natural innate talents using Lagna, Sun, Moon, Jupiter, and strong Kendra/Trikona placements.',
      },
      {
        id: 'hidden-strengths',
        label: 'Hidden Strengths',
        summary: 'Subtle capabilities shown in Nakshatras & Navamsa (D9)',
        instruction: 'Identify understated strengths using Vargottama/exalted placements, Nakshatra lords, and D9 Navamsa support.',
      },
      {
        id: 'karmic-boons',
        label: 'Supportive Blessings',
        summary: '9th house grace, benefics & protective yogas',
        instruction: 'Reveal supportive 9th house, 5th house, and benefic combinations that act as natural tailwinds across life.',
      },
    ],
  },
  {
    id: 'personality',
    title: 'Personality',
    subtitle: 'Core temperament, emotional instincts & outward presence',
    topics: [
      {
        id: 'core-identity',
        label: 'Core Identity',
        summary: 'Ascendant sign, Lagna lord & Moon Nakshatra signature',
        instruction: 'Describe core identity using the Ascendant, Lagna lord placement, and Moon sign/Nakshatra.',
      },
      {
        id: 'shadow-patterns',
        label: 'Blind Spots & Stress Patterns',
        summary: 'How Saturn, Rahu/Ketu or 8th/12th placements show up under stress',
        instruction: 'Explain recurring emotional blind spots and stress habits constructively via Moon aspects, Saturn, and Rahu/Ketu axis.',
      },
      {
        id: 'social-presence',
        label: 'How Others Experience You',
        summary: 'First impression via 1st, 3rd & Venus/Mercury style',
        instruction: 'Reveal outward social style and communication tone using Ascendant, 3rd house, Mercury, and Venus.',
      },
    ],
  },
  {
    id: 'strength',
    title: 'Planetary Strength',
    subtitle: 'Anchor planets, sensitive placements & practical balance',
    topics: [
      {
        id: 'strongest-planets',
        label: 'Strongest Pillars',
        summary: 'Exalted, own-sign, directional & high-SAV planets',
        instruction: 'Identify the strongest functional planets in D1/D9 (dignity, house strength, Ashtakavarga bindus) and how to lean on them.',
      },
      {
        id: 'sensitive-planets',
        label: 'Sensitive Placements',
        summary: 'Debilitated, combust or pressured planets needing conscious care',
        instruction: 'Identify sensitive or heavily tested planets without fear-mongering, noting Neecha Bhanga or Navamsa recovery where present.',
      },
      {
        id: 'practical-balance',
        label: 'Harmonizing Habits',
        summary: 'Grounded behavioral routines to support planetary balance',
        instruction: 'Suggest grounded lifestyle, communication, and mindset habits (zero expensive rituals or superstition) to support the chart’s sensitive planets.',
      },
    ],
  },
  {
    id: 'yogas',
    title: 'Yogas & Patterns',
    subtitle: 'Dhana Yogas, Raja Yogas & structural life lessons',
    topics: [
      {
        id: 'wealth-yogas',
        label: 'Wealth Yogas',
        summary: '2nd, 5th, 9th & 11th house Dhana combinations',
        instruction: 'Analyze verified Parashari Dhana Yogas across houses 2, 5, 9, and 11 and explain when their Dashas activate them.',
      },
      {
        id: 'raja-yogas',
        label: 'Leadership & Raja Yogas',
        summary: 'Kendra–Trikona connections across D1 and D9',
        instruction: 'Identify verified Kendra–Trikona Raja Yogas and Pancha Mahapurusha/Gajakesari combinations in D1 and D9.',
      },
      {
        id: 'structural-lessons',
        label: 'Karmic Friction Points',
        summary: 'Constructive reading of challenging yogas or house tensions',
        instruction: 'Examine real structural friction points (e.g., Kemadruma cancellations, 6/8/12 ties, nodal pressure) calmly and practically.',
      },
    ],
  },
  {
    id: 'love',
    title: 'Love Life',
    subtitle: 'Relational style, emotional language & recurring patterns',
    topics: [
      {
        id: 'as-a-partner',
        label: 'You as a Partner',
        summary: '7th lord, Venus & emotional loyalty style',
        instruction: 'Analyze how the native shows up in committed relationships via the 7th house, 7th lord, Venus, and Moon.',
      },
      {
        id: 'love-language',
        label: 'Emotional Needs & Love Language',
        summary: 'Moon Nakshatra, 5th house & Venus expression',
        instruction: 'Identify emotional needs, affection style, and what makes the native feel genuinely secure in love.',
      },
      {
        id: 'watch-outs',
        label: 'Relationship Watch-Outs',
        summary: 'Recurring friction triggers & communication blind spots',
        instruction: 'Highlight relationship patterns to watch constructively (e.g. Venus retrograde, Mars/Saturn influences on 5th/7th, Darakaraka dynamics).',
      },
      {
        id: 'karmic-ties',
        label: 'Nodal Attraction Patterns',
        summary: 'Rahu/Ketu lessons around partnership & independence',
        instruction: 'Interpret the Rahu/Ketu axis as it relates to attachment, boundaries, and growth through close partnerships.',
      },
    ],
  },
  {
    id: 'marriage',
    title: 'Marriage',
    subtitle: 'Long-term partnership timing, spouse archetype & family life',
    topics: [
      {
        id: 'marriage-timing',
        label: 'Commitment Timing',
        summary: '7th lord Dasha, KP 7th CSL & Jupiter/Saturn transits',
        instruction: 'Analyze key windows for serious commitment or marriage renewal using 7th house, D9 Navamsa, KP 7th Sub-Lord, and Vimshottari Dasha.',
      },
      {
        id: 'spouse-profile',
        label: 'Partner Archetype',
        summary: 'Darakaraka, 7th house & Navamsa 7th indications',
        instruction: 'Describe partner temperament and shared life themes via Jaimini Darakaraka, 7th house/lord, and D9 7th house.',
      },
      {
        id: 'post-marriage',
        label: 'Life After Commitment',
        summary: 'How partnership reshapes stability, finances & growth',
        instruction: 'Analyze how long-term partnership influences stability, home life (2nd/4th), and shared fortune (9th/11th).',
      },
      {
        id: 'children-family',
        label: 'Children & Creative Legacy',
        summary: '5th house, Jupiter & nurturing dynamics',
        instruction: 'Examine the 5th house, 5th lord, and Jupiter for creative fulfillment, parenting style, and joyful legacy.',
      },
    ],
  },
  {
    id: 'career',
    title: 'Career',
    subtitle: 'Vocation, employment vs autonomy & ideal fields',
    topics: [
      {
        id: 'ideal-path',
        label: 'Ideal Vocational Path',
        summary: '10th house, D10 Dasamsa & Amatyakaraka calling',
        instruction: 'Map the ideal vocational direction using the 10th house, 10th lord, D10 Dasamsa, and Jaimini Amatyakaraka.',
      },
      {
        id: 'job-vs-business',
        label: 'Employment vs Independence',
        summary: 'Comparing 6th, 7th & 10th house structural fit',
        instruction: 'Compare salaried leadership (6th/10th) versus consulting, ownership, or partnerships (7th/10th/11th) with balanced nuance.',
      },
      {
        id: 'aligned-industries',
        label: 'Aligned Industries',
        summary: 'Sectors matching your dominant planetary signatures',
        instruction: 'Identify 4–5 concrete modern industries aligned with the chart’s 10th lord, Nakshatra, and Amatyakaraka.',
      },
      {
        id: 'career-friction',
        label: 'Growth Bottlenecks',
        summary: 'Workplace habits & timing hurdles to navigate wisely',
        instruction: 'Identify career bottlenecks (e.g., Saturn delays, restlessness, over-delegation) and strategic countermeasures.',
      },
    ],
  },
  {
    id: 'settlement',
    title: 'Travel & Relocation',
    subtitle: 'Foreign ties, relocation fit & sense of home',
    topics: [
      {
        id: 'relocation-potential',
        label: 'Relocation Potential',
        summary: '4th, 9th & 12th house ties + Rahu/Ketu influence',
        instruction: 'Evaluate foreign work, travel, or long-term relocation potential using 4th, 9th, and 12th houses and nodal links.',
      },
      {
        id: 'environment-fit',
        label: 'Thriving Environments',
        summary: 'Cultural, directional & geographic settings that suit you',
        instruction: 'Describe the types of cities, climates, and global vs local environments where the native thrives based on 4th/9th/12th signs.',
      },
      {
        id: 'rooting-challenges',
        label: 'Staying Grounded Abroad',
        summary: 'Balancing ambition away from home with inner stability',
        instruction: 'Discuss practical emotional and logistical considerations when relocating away from one’s birthplace.',
      },
    ],
  },
  {
    id: 'wealth',
    title: 'Wealth',
    subtitle: 'Income channels, compounding style & risk awareness',
    topics: [
      {
        id: 'primary-source',
        label: 'Primary Earning Engines',
        summary: '2nd & 11th house lords + D2 Hora indications',
        instruction: 'Identify primary wealth generation channels using 2nd house, 11th house, D2 Hora, and active planetary significators.',
      },
      {
        id: 'volatility-windfalls',
        label: 'Risk & Upside Dynamics',
        summary: '5th & 8th house appetite for equity, markets & pivots',
        instruction: 'Assess structured compounding vs speculative or lumpy gains using 5th, 8th, and 11th house interactions (no guaranteed financial claims).',
      },
      {
        id: 'financial-leaks',
        label: 'Expense & Debt Discipline',
        summary: '6th & 12th house spending triggers to manage',
        instruction: 'Identify financial blind spots via 6th and 12th house influences and offer clear budgeting habits.',
      },
    ],
  },
  {
    id: 'health',
    title: 'Vitality & Pacing',
    subtitle: 'Constitutional tendencies, stress recovery & sustainable energy',
    topics: [
      {
        id: 'constitution',
        label: 'Energy & Stress Tendencies',
        summary: 'Lagna, Moon & 6th house lifestyle sensitivities',
        instruction: 'Discuss general constitutional energy patterns and stress sensitivities from Lagna, Sun, Moon, and 6th house (strictly non-medical wellness framing).',
      },
      {
        id: 'preventive-rhythms',
        label: 'Restorative Routines',
        summary: 'Daily pacing, sleep & recovery matched to your Moon',
        instruction: 'Suggest practical, non-medical restorative rhythms (rest, breathwork, pacing, boundaries) aligned with Moon Nakshatra and Saturn/Mars.',
      },
      {
        id: 'burnout-signals',
        label: 'Early Burnout Signals',
        summary: 'Knowing when to slow down during intense transits',
        instruction: 'Explain how overextension tends to show up for this chart and how to recalibrate early.',
      },
    ],
  },
  {
    id: 'family',
    title: 'Family & Roots',
    subtitle: 'Home atmosphere, parental themes & generational strengths',
    topics: [
      {
        id: 'parental-themes',
        label: 'Parental & Lineage Themes',
        summary: '4th house (mother/home) & 9th house (father/mentors)',
        instruction: 'Explore emotional foundations and inherited values through the 4th house/Moon and 9th house/Sun thoughtfully.',
      },
      {
        id: 'sibling-peers',
        label: 'Siblings & Close Circle',
        summary: '3rd & 11th house communication and support dynamics',
        instruction: 'Analyze sibling, peer, and community dynamics via the 3rd house, Mars, Mercury, and 11th house.',
      },
      {
        id: 'home-sanctuary',
        label: 'Creating Your Sanctuary',
        summary: '4th house needs for emotional peace & domestic rhythm',
        instruction: 'Describe what kind of living space, boundaries, and family rhythm brings deep inner peace based on the 4th house.',
      },
    ],
  },
];

export const PLANET_STRENGTH_PLANETS = [
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
] as const;

export const FALLBACK_PLANET_QUIZ: Record<string, PlanetStrengthQuestion[]> = {
  Sun: [
    {
      question: 'When you walk into a room where a decision needs leadership, how do you typically respond?',
      options: [
        'I prefer to stay completely invisible and let others steer.',
        'I hold back unless directly invited to speak up.',
        'I contribute clear direction when the topic matters to me.',
        'I naturally anchor the room with calm clarity and ownership.',
      ],
    },
    {
      question: 'How steady is your core self-respect when external praise disappears?',
      options: [
        'My confidence drops sharply without reassurance.',
        'I second-guess myself for days after quiet criticism.',
        'I feel a brief wobble, then reconnect with my own standards.',
        'My sense of worth stays grounded regardless of applause.',
      ],
    },
    {
      question: 'How consistent is your morning vitality and focus on meaningful goals?',
      options: [
        'Often drained or scattered before the day begins.',
        'Inconsistent — strong bursts followed by long dips.',
        'Generally steady when my routine is protected.',
        'Clear, energized, and purposeful most mornings.',
      ],
    },
    {
      question: 'When dealing with authority figures or mentors, what pattern shows up most?',
      options: [
        'Frequent friction, resentment, or feeling overlooked.',
        'Quiet intimidation or difficulty voicing disagreement.',
        'Constructive respect with occasional boundary tension.',
        'Mutual respect, candor, and easy collaboration.',
      ],
    },
    {
      question: 'How clearly do you know what you are building toward this year?',
      options: [
        'Everything feels foggy and reactive right now.',
        'I have several competing ideas but struggle to commit.',
        'My main direction is clear, with a few details evolving.',
        'My priorities are unmistakable and my calendar reflects them.',
      ],
    },
  ],
  Moon: [
    {
      question: 'When an unexpected emotional setback lands, how quickly does your inner weather settle?',
      options: [
        'I ruminate intensely and feel overwhelmed for days.',
        'It lingers in the background and colors my sleep or focus.',
        'I feel it honestly, talk or journal through it, and recalibrate.',
        'I stay calm, observant, and emotionally resilient.',
      ],
    },
    {
      question: 'How restorative is your sleep and daily mental quiet?',
      options: [
        'Racing thoughts make deep rest rare.',
        'Light or irregular whenever life gets busy.',
        'Mostly restful when I guard evening wind-down time.',
        'Consistently deep, steady, and refreshing.',
      ],
    },
    {
      question: 'How easily do you sense what you truly feel versus absorbing others’ moods?',
      options: [
        'I absorb everyone’s tension and lose track of myself.',
        'I often realize how I felt only hours later.',
        'I usually notice the boundary between my mood and theirs.',
        'I stay warmly empathetic without losing inner steadiness.',
      ],
    },
    {
      question: 'How nourishing do your home environment and daily habits feel right now?',
      options: [
        'Unsettled or draining — hard to unwind.',
        'Functional, though rarely peaceful.',
        'Comfortable and supportive most of the time.',
        'Genuinely grounding and restorative.',
      ],
    },
    {
      question: 'How much do you trust your quiet intuition on people and timing?',
      options: [
        'Anxiety makes it hard to tell intuition from worry.',
        'I get good hunches but regularly talk myself out of them.',
        'My instincts are reliable more often than not.',
        'My emotional clarity and intuition work seamlessly together.',
      ],
    },
  ],
  Mars: [
    {
      question: 'When a difficult task sits on your list, how quickly do you move from thought to action?',
      options: [
        'I delay endlessly until urgency forces my hand.',
        'I start slowly and lose momentum halfway through.',
        'I break it down and tackle it steadily.',
        'I engage decisively with focused stamina.',
      ],
    },
    {
      question: 'How do you handle frustration, conflict, or crossed boundaries?',
      options: [
        'Either bottled resentment or sudden reactive flare-ups.',
        'I avoid confrontation even when a boundary matters.',
        'I address issues directly once I take a brief breath.',
        'I set firm, clean boundaries without losing composure.',
      ],
    },
    {
      question: 'How would you describe your physical stamina and follow-through?',
      options: [
        'Low drive or frequent burnout cycles.',
        'High bursts of sprint energy followed by fatigue.',
        'Reliable endurance when I pace my workload.',
        'Strong, disciplined vitality and consistent execution.',
      ],
    },
    {
      question: 'When facing healthy competition or an ambitious stretch target, you feel:',
      options: [
        'Immediately discouraged or anxious.',
        'Cautious and hesitant to put myself forward.',
        'Motivated to prepare well and hold my own.',
        'Energized, sharp, and ready to rise to the challenge.',
      ],
    },
    {
      question: 'When plans hit a sudden obstacle, what is your default instinct?',
      options: [
        'Freeze or abandon the effort.',
        'Push harder in frustration even if the method is stuck.',
        'Pause, troubleshoot, and try a cleaner angle.',
        'Stay composed and cut straight through the bottleneck.',
      ],
    },
  ],
  Mercury: [
    {
      question: 'When explaining a complex idea in writing or conversation, how smoothly does it land?',
      options: [
        'I often feel misunderstood or lose my thread mid-sentence.',
        'I over-explain or circle around the core point.',
        'Usually clear once I organize my thoughts.',
        'Crisp, articulate, and effortless for others to follow.',
      ],
    },
    {
      question: 'How calm and organized is your decision-making when comparing options?',
      options: [
        'Analysis paralysis keeps me looping endlessly.',
        'I jump between options without a clear rubric.',
        'I weigh pros and cons cleanly and choose well.',
        'Sharp pattern recognition lets me decide with ease.',
      ],
    },
    {
      question: 'How comfortably do you learn new tools, skills, or unfamiliar subjects?',
      options: [
        'New systems feel overwhelming and slow to stick.',
        'I manage with effort, though detail fatigue sets in.',
        'I pick up new skills steadily through practice.',
        'I absorb new frameworks quickly and enjoy connecting dots.',
      ],
    },
    {
      question: 'How well do you manage details, schedules, and agreements?',
      options: [
        'Small details frequently slip through the cracks.',
        'Organized in bursts, then cluttered again.',
        'Reliable systems keep most commitments clean.',
        'Precise, agile, and rarely caught off guard.',
      ],
    },
    {
      question: 'In negotiations or playful dialogue, how adaptable is your voice?',
      options: [
        'I freeze up or say what I think later.',
        'I rely on a rigid script and struggle when plans shift.',
        'I listen well and adjust thoughtfully in real time.',
        'Quick-witted, diplomatic, and grounded under pressure.',
      ],
    },
  ],
  Jupiter: [
    {
      question: 'When life delivers an unexpected detour, what story do you tell yourself?',
      options: [
        'Things rarely work out smoothly for me.',
        'I focus mostly on what was lost or delayed.',
        'After the sting fades, I usually spot the broader lesson.',
        'I keep perspective and consistently turn detours into growth.',
      ],
    },
    {
      question: 'How strong is your access to wise mentors, good timing, or supportive allies?',
      options: [
        'I often feel isolated and unsupported.',
        'Help appears occasionally, but rarely when I need it most.',
        'A few trusted voices reliably steady my perspective.',
        'Right-timed counsel and generous alliances show up regularly.',
      ],
    },
    {
      question: 'How well do your daily choices match your deeper principles and ethics?',
      options: [
        'Frequent disconnect between what I value and what I do.',
        'I compromise on priorities whenever pressure rises.',
        'Mostly aligned, with conscious course-corrections.',
        'Deep integrity gives my decisions quiet confidence.',
      ],
    },
    {
      question: 'How do you relate to financial and intellectual expansion?',
      options: [
        'Scarcity thinking or over-stretching creates stress.',
        'Cautious and reluctant to invest in long-term growth.',
        'Thoughtful compounding with steady curiosity.',
        'Measured optimism, sound judgment, and sustainable abundance.',
      ],
    },
    {
      question: 'How naturally do you synthesize wisdom rather than merely collecting information?',
      options: [
        'I consume a lot but still feel ungrounded.',
        'I understand concepts in theory, less so in practice.',
        'I translate insights into real habits fairly well.',
        'People regularly seek me out for balanced perspective.',
      ],
    },
  ],
  Venus: [
    {
      question: 'How balanced is the give-and-take in your closest relationships?',
      options: [
        'Frequently lopsided — over-giving or feeling undervalued.',
        'Warm at first, then strained by unspoken expectations.',
        'Mostly reciprocal with honest check-ins.',
        'Harmonious, respectful, and mutually nourishing.',
      ],
    },
    {
      question: 'How easily do you allow yourself genuine enjoyment, beauty, and rest without guilt?',
      options: [
        'I struggle to relax or enjoy good things guilt-free.',
        'I swing between strict deprivation and over-indulgence.',
        'I make intentional space for beauty and simple pleasures.',
        'I savor elegance, calm, and joy with effortless balance.',
      ],
    },
    {
      question: 'How harmonious is your creative taste and everyday aesthetic environment?',
      options: [
        'Disconnected from creativity or visual calm.',
        'I appreciate beauty in others’ work more than my own life.',
        'I curate thoughtful touches that lift my mood.',
        'My surroundings and creative expression feel deeply aligned.',
      ],
    },
    {
      question: 'How comfortably do you receive compliments, affection, and financial value?',
      options: [
        'I deflect praise and underprice my own worth.',
        'It feels slightly awkward even when I appreciate it.',
        'I accept appreciation graciously most of the time.',
        'I receive warmth and fair value with relaxed ease.',
      ],
    },
    {
      question: 'When relationship tension arises, how well do you preserve grace and warmth?',
      options: [
        'Tension quickly turns cold or overly dramatic.',
        'I smooth over issues to keep peace while quietly withdrawing.',
        'I aim for honest dialogue without harshness.',
        'I hold warmth, tact, and clarity at the same time.',
      ],
    },
  ],
  Saturn: [
    {
      question: 'How consistently do you show up for long-term commitments after initial excitement fades?',
      options: [
        'I struggle to sustain routines past the first few weeks.',
        'Consistency depends heavily on my mood that week.',
        'Steady follow-through on my core responsibilities.',
        'Quiet, reliable discipline is one of my strongest assets.',
      ],
    },
    {
      question: 'How do you respond when meaningful results take longer than expected?',
      options: [
        'Impatience or discouragement makes me quit early.',
        'I feel heavy dread and question whether it is worth it.',
        'I stay patient, though I occasionally need reassurance.',
        'I respect slow compounding and let time do its work.',
      ],
    },
    {
      question: 'How healthy is your relationship with responsibility and boundaries around work?',
      options: [
        'Either avoiding weight altogether or crushing myself with guilt.',
        'I carry too much silently and resent the load.',
        'Generally realistic commitments with occasional stretch.',
        'Clear, sustainable ownership without martyrdom.',
      ],
    },
    {
      question: 'When feedback highlights a real structural weakness, how do you react?',
      options: [
        'Harsh inner critic or shutting down completely.',
        'Defensive at first, slow to adjust.',
        'Reflective — I inspect what is true and refine it.',
        'Grateful for reality checks; I turn them into durable upgrades.',
      ],
    },
    {
      question: 'How orderly are the foundational pillars of your life (finances, time, promises)?',
      options: [
        'Often feels chaotic or reactive.',
        'Held together mostly by last-minute effort.',
        'Solid structure with room to tighten a few corners.',
        'Clean, dependable foundations that give me real freedom.',
      ],
    },
  ],
};

// =============================================================================
// CACHE BUCKET & DETERMINISTIC EXTRACTION HELPERS
// =============================================================================

export function getIsoWeekBucket(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function computeAppCacheKey(
  app: MiniAppDefinition,
  extra?: { domainId?: string; topicId?: string; astrologyMode?: 'vedic' | 'western' }
): string {
  const mode = extra?.astrologyMode === 'western' ? 'western' : 'vedic';
  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);
  if (app.slug === 'birth-chart-breakdown' && extra?.domainId && extra?.topicId) {
    return `${mode}:breakdown:${extra.domainId}:${extra.topicId}`;
  }
  switch (app.cacheScope) {
    case 'daily':
      return `${mode}:daily:${todayISO}`;
    case 'weekly':
      return `${mode}:weekly:${getIsoWeekBucket(now)}`;
    case 'monthly':
      return `${mode}:monthly:${todayISO.slice(0, 7)}`;
    case 'chart':
      return `${mode}:chart:v1`;
    default:
      return `${mode}:live:${Date.now()}`;
  }
}

function findActiveDashaSummary(chartJson: CompiledChartData | null | undefined): {
  mahadasha?: DashaNode;
  antardasha?: DashaNode;
  pratyantardasha?: DashaNode;
  line: string;
} {
  const timeline = chartJson?.vimshottari?.timeline || [];
  if (!timeline.length) return { line: 'Vimshottari Dasha timeline unavailable' };
  const todayISO = new Date().toISOString().slice(0, 10);
  const md = timeline.find((n) => n.startDate <= todayISO && todayISO <= n.endDate) || timeline[0];
  const ad = md?.children?.find((n) => n.startDate <= todayISO && todayISO <= n.endDate) || md?.children?.[0];
  const pd = ad?.children?.find((n) => n.startDate <= todayISO && todayISO <= n.endDate) || ad?.children?.[0];
  const parts = [
    md ? `${md.lord} Mahadasha (${md.startDate} to ${md.endDate})` : '',
    ad ? `${ad.lord} Antardasha (${ad.startDate} to ${ad.endDate})` : '',
    pd ? `${pd.lord} Pratyantardasha (${pd.startDate} to ${pd.endDate})` : '',
  ].filter(Boolean);
  return { mahadasha: md, antardasha: ad, pratyantardasha: pd, line: parts.join(' → ') };
}

export function buildStructuredHeaderForApp(params: {
  slug: string;
  profileName?: string | null;
  birthDate?: string | null;
  chartJson?: CompiledChartData | null;
  transitPlanets?: PlanetPosition[];
  westernTransitPlanets?: WesternPlanetPosition[];
  transitDate?: string | null;
  astrologyMode?: 'vedic' | 'western';
}): MiniAppStructuredHeader | null {
  const {
    slug,
    profileName,
    birthDate,
    chartJson,
    transitPlanets = [],
    westernTransitPlanets = [],
    transitDate,
    astrologyMode = 'vedic',
  } = params;

  const isWestern = astrologyMode === 'western';
  const modeTag = isWestern ? 'Western' : 'Vedic';
  const formattedToday = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  if (isWestern) {
    const resolvedChart =
      chartJson && !chartJson.western && chartJson.planets?.length
        ? enrichCompiledChart(chartJson).chartJson
        : chartJson;
    const western = resolvedChart?.western;
    const wSun = western?.planets?.find((p) => p.name === 'Sun');
    const wMoon = western?.planets?.find((p) => p.name === 'Moon');
    const wAsc = western?.angles?.ascendant;
    const wAscIdx = typeof wAsc?.longitude === 'number' ? Math.floor(wAsc.longitude / 30) : null;

    if (slug === 'current-transits' && westernTransitPlanets.length > 0) {
      const cusps = western?.cusps || [];
      const findPlacidusHouse = (lon: number): string => {
        if (cusps.length !== 12) {
          return wAscIdx !== null ? `H${((Math.floor(lon / 30) - wAscIdx + 12) % 12) + 1}` : '—';
        }
        for (let i = 0; i < 12; i++) {
          const cStart = cusps[i].longitude;
          const cNext = cusps[(i + 1) % 12].longitude;
          if (cStart < cNext) {
            if (lon >= cStart && lon < cNext) return `H${cusps[i].house}`;
          } else if (lon >= cStart || lon < cNext) {
            return `H${cusps[i].house}`;
          }
        }
        return '—';
      };

      const rows = westernTransitPlanets
        .filter((p) => p.name !== 'Ascendant')
        .slice(0, 12)
        .map((p) => {
          const wholeSignH =
            wAscIdx !== null ? `H${((p.signIndex - wAscIdx + 12) % 12) + 1}` : '—';
          return [
            `${p.name}${p.isRetrograde ? ' (Rx)' : ''}`,
            `${p.sign} ${p.dms}`,
            findPlacidusHouse(p.longitude),
            wholeSignH,
          ];
        });

      return {
        eyebrow: `Verified Tropical Sky · ${transitDate || new Date().toISOString().slice(0, 10)} (Western)`,
        headline: profileName
          ? `Live Tropical Sky Mapped to ${profileName}’s Chart`
          : 'Live Tropical Planetary Positions (Western)',
        table: {
          columns: ['Planet', 'Tropical Sign & Degree', 'Placidus House', 'Whole-Sign'],
          rows,
        },
      };
    }

    if (['daily-horoscope', 'weekly-horoscope', 'monthly-horoscope'].includes(slug) && western) {
      const jupTransit = westernTransitPlanets.find((p) => p.name === 'Jupiter');
      const moonTransit = westernTransitPlanets.find((p) => p.name === 'Moon');
      return {
        eyebrow: `${profileName || 'Chart'} · ${wSun?.sign || ''} Sun · ${wMoon?.sign || ''} Moon · ${wAsc?.sign || ''} Rising (Western)`,
        headline:
          slug === 'daily-horoscope'
            ? `Today’s Horoscope`
            : slug === 'weekly-horoscope'
            ? `Seven-Day Trajectory (${getIsoWeekBucket()}) · Western`
            : `Monthly Horizon (${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}) · Western`,
        metrics: [
          ...(wSun
            ? [{ label: 'Natal Sun / Moon', value: `${wSun.sign} / ${wMoon?.sign || '—'}`, hint: `${wAsc?.sign || '—'} Rising` }]
            : []),
          ...(moonTransit
            ? [{ label: 'Today’s Moon', value: moonTransit.sign, hint: `${moonTransit.dms} Tropical` }]
            : []),
          ...(jupTransit
            ? [
                {
                  label: 'Jupiter Transit',
                  value: jupTransit.sign,
                  hint:
                    wAscIdx !== null
                      ? `House ${((jupTransit.signIndex - wAscIdx + 12) % 12) + 1} from Rising`
                      : `${jupTransit.dms}`,
                },
              ]
            : []),
        ],
      };
    }

    if (slug === 'jupiter-opportunities' && western) {
      const jupNatal = western.planets?.find((p) => p.name === 'Jupiter');
      const jupTransit = westernTransitPlanets.find((p) => p.name === 'Jupiter');
      const jupHouse =
        jupTransit && wAscIdx !== null
          ? ((jupTransit.signIndex - wAscIdx + 12) % 12) + 1
          : null;
      return {
        eyebrow: `${profileName || 'Chart'} · Jupiter Expansion Summary (Western)`,
        headline: jupTransit
          ? `Jupiter transiting ${jupTransit.sign}${jupHouse ? ` (House ${jupHouse})` : ''}`
          : `Natal Jupiter in ${jupNatal?.sign || 'Chart'}`,
        metrics: [
          ...(jupNatal
            ? [{ label: 'Natal Jupiter', value: `${jupNatal.sign} · H${jupNatal.house}`, hint: jupNatal.dignity || 'Tropical Chart' }]
            : []),
          ...(jupTransit
            ? [{ label: 'Transit Position', value: `${jupTransit.sign} ${jupTransit.dms}`, hint: jupHouse ? `House ${jupHouse} from Rising` : 'Tropical Sky' }]
            : []),
        ],
      };
    }

    if ((slug === 'soul-compass' || slug === 'cosmic-archetype') && western) {
      const nNode = western.planets?.find((p) => p.name === 'True Node' || p.name === 'North Node' || p.name === 'Rahu');
      return {
        eyebrow: `${profileName || 'Chart'} · Core Tropical Signature (Western)`,
        headline:
          slug === 'soul-compass'
            ? 'North / South Node Compass (Western)'
            : `${wSun?.sign || ''} Sun · ${wMoon?.sign || ''} Moon · ${wAsc?.sign || ''} Rising`,
        metrics: [
          ...(wAsc ? [{ label: 'Ascendant (Rising)', value: wAsc.sign, hint: `${wAsc.dms} Placidus` }] : []),
          ...(wSun ? [{ label: 'Natal Sun', value: wSun.sign, hint: `House ${wSun.house}` }] : []),
          ...(wMoon ? [{ label: 'Natal Moon', value: wMoon.sign, hint: `House ${wMoon.house}` }] : []),
          ...(nNode ? [{ label: 'North Node', value: nNode.sign, hint: `House ${nNode.house}` }] : []),
        ],
      };
    }
  }

  const asc = chartJson?.planets?.find((p) => p.name === 'Ascendant');
  const moon = chartJson?.planets?.find((p) => p.name === 'Moon');
  const dasha = findActiveDashaSummary(chartJson);

  if (slug === 'current-transits' && transitPlanets.length > 0) {
    const ascSignIdx = asc?.signIndex ?? null;
    const moonSignIdx = moon?.signIndex ?? null;
    const savArr = chartJson?.ashtakavarga?.sarva || [];
    const ordered = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
    const rows = ordered
      .map((name) => transitPlanets.find((p) => p.name === name))
      .filter((p): p is PlanetPosition => Boolean(p))
      .map((p) => {
        const hLagna = ascSignIdx !== null ? `H${((p.signIndex - ascSignIdx + 12) % 12) + 1}` : '—';
        const hMoon = moonSignIdx !== null ? `H${((p.signIndex - moonSignIdx + 12) % 12) + 1}` : '—';
        const sav = savArr.length === 12 ? String(savArr[p.signIndex] ?? '—') : '—';
        return [
          `${p.name}${p.isRetrograde ? ' (R)' : ''}`,
          `${p.sign} ${p.dms}`,
          p.nakshatra,
          hLagna,
          hMoon,
          sav,
        ];
      });

    return {
      eyebrow: `Verified Sidereal Gochar · ${transitDate || new Date().toISOString().slice(0, 10)} (${modeTag})`,
      headline: profileName
        ? `Live Sky Mapped to ${profileName}’s Chart`
        : 'Live Sidereal Planetary Positions',
      table: {
        columns: ['Planet', 'Sign & Degree', 'Nakshatra', 'From Lagna', 'From Moon', 'SAV'],
        rows,
      },
    };
  }

  if (slug === 'dasha-analysis' && dasha.mahadasha) {
    return {
      eyebrow: `Active Vimshottari Ladder${asc ? ` · ${asc.sign} Lagna` : ''}${moon ? ` · ${moon.nakshatra} Moon` : ''} (${modeTag})`,
      headline: `${dasha.mahadasha.lord}${dasha.antardasha ? `–${dasha.antardasha.lord}` : ''} Planetary Chapter`,
      metrics: [
        {
          label: 'Mahadasha',
          value: dasha.mahadasha.lord,
          hint: `${dasha.mahadasha.startDate} → ${dasha.mahadasha.endDate}`,
        },
        ...(dasha.antardasha
          ? [
              {
                label: 'Antardasha',
                value: dasha.antardasha.lord,
                hint: `${dasha.antardasha.startDate} → ${dasha.antardasha.endDate}`,
              },
            ]
          : []),
        ...(dasha.pratyantardasha
          ? [
              {
                label: 'Pratyantardasha',
                value: dasha.pratyantardasha.lord,
                hint: `${dasha.pratyantardasha.startDate} → ${dasha.pratyantardasha.endDate}`,
              },
            ]
          : []),
      ],
    };
  }

  if (slug === 'numerology' && (profileName || birthDate)) {
    const ctx = formatPythagoreanNumerologyContext({
      fullName: profileName,
      birthDate,
    });
    if (ctx) {
      const extractLine = (label: string): string => {
        const re = new RegExp(`^- ${label}:\\s*(.+)$`, 'm');
        const m = re.exec(ctx);
        return m?.[1]?.trim() || '—';
      };
      return {
        eyebrow: `Deterministic Pythagorean Matrix · ${birthDate || 'Name Analysis'} (${modeTag})`,
        headline: `${profileName || 'Personal'} Core Numbers`,
        metrics: [
          { label: 'Life Path', value: extractLine('Life Path Number') },
          { label: 'Expression', value: extractLine('Expression / Destiny Number') },
          { label: 'Soul Urge', value: extractLine("Soul Urge \\(Heart's Desire\\) Number") },
          { label: 'Personality', value: extractLine('Personality Number') },
          { label: 'Personal Year', value: extractLine(`Personal Year \\(${new Date().getUTCFullYear()}\\)`) },
          { label: 'Personal Day', value: extractLine('Personal Day \\(Today\\)') },
        ],
      };
    }
  }

  if (['daily-horoscope', 'weekly-horoscope', 'monthly-horoscope'].includes(slug) && asc && moon) {
    const jupTransit = transitPlanets.find((p) => p.name === 'Jupiter');
    const moonTransit = transitPlanets.find((p) => p.name === 'Moon');
    return {
      eyebrow: `${profileName || 'Chart'} · ${asc.sign} Lagna · ${moon.sign} Moon (${modeTag})`,
      headline:
        slug === 'daily-horoscope'
          ? `Today’s Horoscope · ${formattedToday}`
          : slug === 'weekly-horoscope'
          ? `Seven-Day Trajectory (${getIsoWeekBucket()})`
          : `Monthly Horizon (${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})`,
      metrics: [
        ...(dasha.mahadasha
          ? [
              {
                label: 'Active Dasha',
                value: `${dasha.mahadasha.lord}${dasha.antardasha ? `–${dasha.antardasha.lord}` : ''}`,
                hint: dasha.pratyantardasha ? `PD: ${dasha.pratyantardasha.lord}` : undefined,
              },
            ]
          : []),
        ...(moonTransit
          ? [
              {
                label: 'Today’s Moon',
                value: `${moonTransit.sign}`,
                hint: `${moonTransit.nakshatra} Nakshatra`,
              },
            ]
          : []),
        ...(jupTransit
          ? [
              {
                label: 'Jupiter Gochar',
                value: `${jupTransit.sign}`,
                hint: `House ${((jupTransit.signIndex - asc.signIndex + 12) % 12) + 1} from Lagna`,
              },
            ]
          : []),
      ],
    };
  }

  if (slug === 'jupiter-opportunities' && asc) {
    const jupNatal = chartJson?.planets?.find((p) => p.name === 'Jupiter');
    const jupTransit = transitPlanets.find((p) => p.name === 'Jupiter');
    const savArr = chartJson?.ashtakavarga?.sarva || [];
    const jupHouse = jupTransit ? ((jupTransit.signIndex - asc.signIndex + 12) % 12) + 1 : null;
    const jupSav = jupTransit && savArr.length === 12 ? savArr[jupTransit.signIndex] : null;
    return {
      eyebrow: `${profileName || 'Chart'} · Jupiter Expansion Summary (${modeTag})`,
      headline: jupTransit
        ? `Jupiter transiting ${jupTransit.sign} (House ${jupHouse})`
        : `Natal Jupiter in ${jupNatal?.sign || 'Chart'}`,
      metrics: [
        ...(jupNatal
          ? [
              {
                label: 'Natal Jupiter',
                value: `${jupNatal.sign} · H${jupNatal.house}`,
                hint: `${jupNatal.nakshatra}${jupNatal.dignity ? ` · ${jupNatal.dignity}` : ''}`,
              },
            ]
          : []),
        ...(jupTransit
          ? [
              {
                label: 'Gochar Position',
                value: `${jupTransit.sign} ${jupTransit.dms}`,
                hint: jupSav !== null ? `House ${jupHouse} · SAV ${jupSav} bindus` : `House ${jupHouse} from Lagna`,
              },
            ]
          : []),
        ...(dasha.mahadasha
          ? [
              {
                label: 'Active Dasha',
                value: `${dasha.mahadasha.lord}${dasha.antardasha ? `–${dasha.antardasha.lord}` : ''}`,
                hint: dasha.antardasha ? `Until ${dasha.antardasha.endDate}` : undefined,
              },
            ]
          : []),
      ],
    };
  }

  if ((slug === 'soul-compass' || slug === 'cosmic-archetype') && asc && moon) {
    const rahu = chartJson?.planets?.find((p) => p.name === 'Rahu');
    const ketu = chartJson?.planets?.find((p) => p.name === 'Ketu');
    const ak = chartJson?.jaimini?.karakas?.find(
      (k) => k.code === 'AK' || k.title === 'Atmakaraka'
    );
    return {
      eyebrow: `${profileName || 'Chart'} · Core Sidereal Signature (${modeTag})`,
      headline:
        slug === 'soul-compass'
          ? 'Nodal Axis & Dharma Compass'
          : `${asc.sign} Lagna · ${moon.nakshatra} Moon`,
      metrics: [
        {
          label: 'Ascendant (Lagna)',
          value: asc.sign,
          hint: `${asc.nakshatra} Pada ${asc.pada}`,
        },
        {
          label: 'Natal Moon',
          value: moon.sign,
          hint: `${moon.nakshatra} · House ${moon.house}`,
        },
        ...(ak
          ? [
              {
                label: 'Atmakaraka (AK)',
                value: ak.planet,
                hint: `${ak.sign} · Soul significator`,
              },
            ]
          : []),
        ...(rahu && ketu
          ? [
              {
                label: 'Rahu / Ketu Axis',
                value: `H${rahu.house} / H${ketu.house}`,
                hint: `${rahu.sign} ↔ ${ketu.sign}`,
              },
            ]
          : []),
      ],
    };
  }

  return null;
}

// =============================================================================
// SERVER PROMPT BUILDERS (Grounded in Real Ephemeris + Editorial Constitution)
// =============================================================================

const EDITORIAL_APP_GUARDRAIL_VEDIC = `STYLE & PHILOSOPHY CONSTITUTION (NON-NEGOTIABLE):
- Voice: Calm, perceptive, grounded editorial journal (clear, warm, practical, respectful of human agency).
- Astrology System: **Vedic Astrology (Sidereal Lahiri Zodiac, KP, Jaimini, Nakshatras & Vimshottari Dasha)**. Always include **(Vedic)** visibly in the main header or opening line of your output.
- Zero fear-mongering, zero doom predictions, zero superstition, zero expensive ritual upsells, and no medical, legal, or guaranteed financial claims.
- Pair authentic Jyotish terms (Mahadasha, Gochar, Navamsa, Nakshatra, Ashtakavarga) with plain-English meaning so any reader immediately understands.
- Never use clickbait hype, excessive emojis, or generic sun-sign filler. Anchor every insight directly in the verified chart/transit/numerology data provided below.
- Format cleanly in Markdown using ### section headings, concise scannable paragraphs, bullet points, and **bold** emphasis for key placements and windows.`;

const EDITORIAL_APP_GUARDRAIL_WESTERN = `STYLE & PHILOSOPHY CONSTITUTION (NON-NEGOTIABLE):
- Voice: Calm, perceptive, grounded editorial journal (clear, warm, practical, respectful of human agency).
- Astrology System: **Western Tropical Astrology (Tropical Zodiac, Placidus Houses, Sun/Moon/Rising, Planetary Aspects, Elements, Modalities & Transits)**. Always include **(Western)** visibly in the main header or opening line of your output.
- Frame all insights strictly in authentic Western Tropical astrology terminology (Sun/Moon/Rising signs, Placidus & angular houses, conjunctions/trines/squares/oppositions/sextiles, retrogrades, Chiron, Nodes, Elements & Modalities). Do NOT default to Vedic/Sanskrit jargon unless noting a brief comparison.
- Zero fear-mongering, zero doom predictions, zero superstition, and no medical, legal, or guaranteed financial claims.
- Never use clickbait hype, excessive emojis, or generic sun-sign filler. Anchor every insight directly in the verified Western chart/transit/numerology data provided below.
- Format cleanly in Markdown using ### section headings, concise scannable paragraphs, bullet points, and **bold** emphasis for key placements and aspects.`;

export function buildMiniAppPrompt(params: {
  slug: string;
  astrologyMode?: 'vedic' | 'western';
  profile?: {
    name: string;
    birth_date: string;
    birth_time?: string | null;
    birth_city?: string | null;
    birth_country?: string | null;
    gender?: string | null;
    current_city?: string | null;
    current_country?: string | null;
    chart_text_context?: string | null;
    chart_json?: CompiledChartData | null;
  } | null;
  partnerProfile?: {
    name: string;
    birth_date: string;
    chart_text_context?: string | null;
    chart_json?: CompiledChartData | null;
  } | null;
  transitSummary?: string | null;
  inputs?: Record<string, unknown>;
}): { system: string; user: string } {
  const { slug, astrologyMode = 'vedic', profile, partnerProfile, transitSummary, inputs = {} } = params;
  const isWestern = astrologyMode === 'western';
  const modeLabel = isWestern ? 'Western' : 'Vedic';
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedDayMonthYear = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const dasha = findActiveDashaSummary(profile?.chart_json);

  const profileContextLines: string[] = [];
  profileContextLines.push(`SELECTED ASTROLOGY SYSTEM: ${isWestern ? 'Western Tropical (Placidus)' : 'Vedic Sidereal (Lahiri)'} — MUST be clearly labeled (${modeLabel}) in output.`);

  if (profile) {
    profileContextLines.push(
      `SUBJECT PROFILE: ${profile.name} | Born ${profile.birth_date}${profile.birth_time ? ` at ${profile.birth_time}` : ''}${profile.birth_city ? ` in ${profile.birth_city}${profile.birth_country ? `, ${profile.birth_country}` : ''}` : ''}${profile.gender ? ` | Gender: ${profile.gender}` : ''}${profile.current_city ? ` | Current location: ${profile.current_city}${profile.current_country ? `, ${profile.current_country}` : ''}` : ''}`
    );
    if (!isWestern && dasha.line) {
      profileContextLines.push(`ACTIVE VIMSHOTTARI DASHA: ${dasha.line}`);
    }
    if (isWestern && profile.chart_json) {
      const westernCtx = formatChartForLLM(profile.chart_json, 'western');
      profileContextLines.push(
        `\nVERIFIED WESTERN TROPICAL CHART DATA (Authoritative — cite these Tropical signs, Placidus houses & aspects):\n${westernCtx.slice(0, 6200)}`
      );
    } else if (profile.chart_text_context) {
      profileContextLines.push(
        `\nVERIFIED NATAL CHART DATA (Authoritative — cite these placements, never invent contrary degrees):\n${profile.chart_text_context.slice(0, 6200)}`
      );
    }
  } else {
    profileContextLines.push('NO BIRTH PROFILE ATTACHED — provide grounded general astrology guidance.');
  }

  if (transitSummary) {
    profileContextLines.push(
      `\nVERIFIED CURRENT ${isWestern ? 'TROPICAL' : 'SIDEREAL GOCHAR'} TRANSITS (${now.toISOString().slice(0, 10)}):\n${transitSummary}`
    );
  }

  const baseContext = `AUTHORITATIVE CURRENT DATE: ${dateStr}\n${profileContextLines.join('\n')}`;
  const system = isWestern
    ? `You are Cosmic Council’s senior Western Tropical astrologer composing a focused editorial reading.\n\n${EDITORIAL_APP_GUARDRAIL_WESTERN}`
    : `You are Cosmic Council’s senior Vedic & multi-system astrology analyst composing a focused editorial reading.\n\n${EDITORIAL_APP_GUARDRAIL_VEDIC}`;

  const partnerWesternCtx =
    isWestern && partnerProfile?.chart_json
      ? formatChartForLLM(partnerProfile.chart_json, 'western').slice(0, 4200)
      : partnerProfile?.chart_text_context?.slice(0, 4200) || '';

  switch (slug) {
    case 'daily-horoscope':
      return {
        system,
        user: `${baseContext}

TASK: Compose a deeply personal Daily Horoscope for ${dateStr}.
Begin your response with this exact opening line:
Here is your daily horoscope report for **${formattedDayMonthYear}** (**${profile?.name || 'Your Chart'}**) — **(${modeLabel})**:

Then structure with these ### headings:
### Today’s Rhythm & Tone
(${isWestern ? 'Explain how today’s transiting Tropical Moon, Sun, and planetary aspects interact with natal Sun, Moon, Rising, and Placidus houses.' : 'Explain how today’s transiting Moon Nakshatra and key planetary Gochar interact with the natal Moon, Lagna, and active Dasha.'})
### Work, Decisions & Timing
(Concrete guidance on meetings, focused work, negotiations, or pacing today.)
### Heart & Relationships
(How Venus, Moon, and Mars influence tone, listening, and emotional clarity today.)
### Practical Grounding Focus
(One simple, realistic habit or reflection that helps optimize today’s energy.)`,
      };

    case 'weekly-horoscope':
      return {
        system,
        user: `${baseContext}

TASK: Compose a strategic 7-day Weekly Horoscope starting ${dateStr} (**${modeLabel}**).
Begin with a clear line or header indicating **(${modeLabel})**.
Structure with these ### headings:
### Weekly Theme
(${isWestern ? 'A concise framing title and core 7-day synthesis anchored in active outer-planet transits, lunations, and aspects to your natal Sun, Moon, and Rising.' : 'A concise framing title and core 7-day synthesis anchored in active Dasha and slow/fast Gochar transits.'})
### Seven-Day Celestial Flow
(Early week, mid-week, and weekend shifts as the ${isWestern ? 'Tropical Moon transits your Placidus houses and aspects key natal planets.' : 'Moon moves across natal houses and Nakshatras.'})
### Career & Financial Pacing
(Best windows for outreach, deep work, and careful review over the next 7 days.)
### Relationships & Social Energy
(How to navigate conversations, affection, and personal boundaries this week.)
### Grounding Anchor for the Week
(One practical behavioral focus to stay steady.)`,
      };

    case 'monthly-horoscope':
      return {
        system,
        user: `${baseContext}

TASK: Compose a strategic Monthly Horizon for ${monthYear} (**${modeLabel}**).
Begin with a clear line or header indicating **(${modeLabel})**.
Structure with these ### headings:
### Core Theme for ${monthYear}
(${isWestern ? 'High-level synthesis of the month’s Tropical Sun progression, Jupiter/Saturn/outer-planet transits, and major natal aspects.' : 'High-level synthesis of the month’s active Dasha + Saturn/Jupiter/Rahu-Ketu transit posture.'})
### Slow-Planet & Transit Architecture
(${isWestern ? 'How slow-moving transits over your Placidus angular houses and natal aspects shape this month’s momentum.' : 'How major transits over natal houses and Ashtakavarga bindus shape this month’s momentum.'})
### Work, Craft & Resources
(Where steady effort compounds and where patience protects capital or reputation.)
### Relationships & Inner Life
(Key relational themes and emotional recalibrations across the month.)
### Strategic Focus for the Next 30 Days
(3 concise, actionable priorities.)`,
      };

    case 'current-transits':
      return {
        system,
        user: `${baseContext}

TASK: Compose a precise Current Planetary Transits${isWestern ? ' (Tropical Sky)' : ' (Gochar)'} briefing for ${dateStr} (**${modeLabel}**).
Begin with a clear line or header indicating **(${modeLabel})**.
Structure with these ### headings:
### Sky Weather Overview
(${isWestern ? 'Concise summary of dominant Tropical planetary alignments, aspects, and retrogrades active today.' : 'Concise summary of the dominant Sidereal planetary alignments and retrogrades active today.'})
### Key House Activations
(${isWestern ? 'Explain clearly how transiting Jupiter, Saturn, Uranus/Neptune/Pluto, Nodes, and inner planets interact with your Placidus 1st, 4th, 7th, and 10th houses — or general collective themes if no profile is linked.' : 'Explain clearly how Jupiter, Saturn, Rahu/Ketu, and faster planets impact the 1st, 4th, 7th, and 10th houses — or general collective themes if no profile is linked.'})
### High-Attention Windows & Opportunities
(${isWestern ? 'Highlight flowing trine/sextile transits alongside square/opposition tension points calling for measured patience.' : 'Highlight supportive high-SAV transits alongside areas calling for measured patience.'})
### Practical Navigation
(3 grounded pointers for working constructively with today’s sky.)`,
      };

    case 'dasha-analysis':
      return {
        system,
        user: `${baseContext}

${
  isWestern
    ? `NOTE: The user is currently viewing in **Western (${modeLabel})** mode, and this module focuses on planetary life chapters & timing cycles. Keep the primary lens grounded in Western timing cycles (Saturn/Jupiter transits, Profection years, and progressions alongside the active timing data provided), clearly labeling **(${modeLabel})**.
TASK: Perform a scholarly yet accessible Planetary Timing & Life Chapter Analysis as of ${dateStr}.
Structure with these ### headings:
### Your Active Planetary Chapter (${modeLabel})
(Synthesize current major transits—Saturn, Jupiter, Nodes—and developmental house activations shaping this life chapter.)
### Psychological & Material Themes Right Now
(How these planetary activations express in mindset, career, relationships, and growth.)
### Next 12-Month Trajectory & Upcoming Shifts
(Note upcoming transit shifts and major aspect openings over the next year.)
### Aligning Constructively With This Period
(Practical, non-superstitious behavioral adjustments and focus areas.)`
    : `TASK: Perform a scholarly yet accessible Vimshottari Dasha Analysis as of ${dateStr} (**${modeLabel}**).
Structure with these ### headings:
### Your Active Planetary Chapter
(Explain the active Mahadasha, Antardasha, and Pratyantardasha lords — their natal house ownership, placement, dignity, and what life themes they govern.)
### Psychological & Material Themes Right Now
(How this specific planetary pairing expresses in mindset, career, relationships, and growth.)
### Next 12-Month Trajectory & Upcoming Shifts
(Note upcoming Antardasha or Pratyantardasha transitions and how the tone evolves over the next year.)
### Aligning Constructively With This Period
(Practical, non-superstitious behavioral adjustments and focus areas that honor the Dasha lords.)`
}`,
      };

    case 'birth-chart-breakdown': {
      const domainId = String(inputs.domainId || 'gifts');
      const topicId = String(inputs.topicId || 'natural-talents');
      const domain = BIRTH_CHART_DOMAINS.find((d) => d.id === domainId) || BIRTH_CHART_DOMAINS[0];
      const topic = domain.topics.find((t) => t.id === topicId) || domain.topics[0];
      return {
        system,
        user: `${baseContext}

TASK: Perform a focused "Birth Chart Breakdown" module on **${domain.title} → ${topic.label}** (**${modeLabel}**).
Specific Analytical Lens: ${topic.instruction}

Requirements:
- Begin by clearly stating **(${modeLabel})** in your opening line or first heading.
- Go straight into high-signal analysis (3–4 well-structured sections or 280–420 words).
- ${
  isWestern
    ? 'Cite exact verified placements from the Western Tropical chart above (Tropical signs, Placidus houses, Midheaven/Ascendant, Chiron, Nodes, and major aspects).'
    : 'Cite exact verified placements from the Sidereal Vedic chart above (signs, houses, Nakshatras, divisional D9/D10 links where relevant).'
}
- Close with a **Practical Takeaway** section giving one clear, actionable perspective.`,
      };
    }

    case 'wealth-blueprint':
      return {
        system,
        user: `${baseContext}

TASK: Compose a grounded "Wealth Blueprint" analysis as of ${dateStr} (**${modeLabel}**).
Include **(${modeLabel})** in the opening heading or line.
Structure with these ### headings:
### Financial Archetype & Earning Style
(${isWestern ? 'Derive a clear, realistic financial archetype from your 2nd house, 8th/11th houses, Venus/Jupiter placements, Midheaven, and dominant aspects.' : 'Derive a clear, realistic financial archetype from the 2nd house, 11th house, D2 Hora, and dominant planetary lords.'})
### Core Treasury & Income Channels (2nd & 11th Houses)
(How resources naturally accumulate, scale, and compound in this chart.)
### Aligned Industries & Leverage Points
(3–4 realistic domains or leverage models suited to the 10th/11th house signature.)
### Timing Windows & Jupiter/Saturn Pacing
(${isWestern ? 'How current Jupiter and Saturn transits over your Placidus houses shape financial decisions over the next 12 months.' : 'How current Dasha and slow-planet transits shape financial decisions over the next 12 months.'})
### Financial Blind Spots & Guardrails
(Realistic leakage patterns and grounded discipline habits. Avoid guaranteed profit promises.)`,
      };

    case 'love-forecast':
      return {
        system,
        user: `${baseContext}

TASK: Compose a grounded, empathetic "Love Forecast" starting ${dateStr} (**${modeLabel}**).
Include **(${modeLabel})** in the opening heading or line.
Structure with these ### headings:
### Current Relational Climate
(${isWestern ? 'How current Venus, Mars, and slow-planet transits interact with your natal Venus, Moon, 5th/7th Placidus houses, and Descendant right now.' : 'How active Dasha, Venus, 5th/7th house lords, and Moon shape romantic energy right now.'})
### Upcoming Connection & Alignment Windows
(Key stretches over the next 3–6 months supporting meeting someone, deepening commitment, or clearing communication.)
### ${isWestern ? 'Your Venus, Moon & 7th House Signature' : 'Your Venus & Navamsa Signature'}
(What genuinely attracts and sustains mutual respect for this chart — emotional style, pacing, and values.)
### Grounded Guidance for the Heart
(Practical relational counsel that works equally well for singles or committed partners.)`,
      };

    case 'career-navigator':
      return {
        system,
        user: `${baseContext}

TASK: Compose a strategic "Career Navigator" vocational reading starting ${dateStr} (**${modeLabel}**).
Include **(${modeLabel})** in the opening heading or line.
Structure with these ### headings:
### Vocational Calling & Public Signature (${isWestern ? '10th House & Midheaven' : '10th House & D10'})
(${isWestern ? 'Core strengths, authority style, and leadership archetype from your Midheaven (MC), 10th house, Saturn, and Sun/Mercury placements.' : 'Core strengths, authority style, and leadership archetype from 10th house, D10 Dasamsa, and Amatyakaraka.'})
### Daily Work Rhythm (6th vs 10th House)
(Ideal operating environment, collaboration style, and how you sustain high performance without friction.)
### Aligned Career Lanes
(3–4 concrete fields or role archetypes where this chart has structural edge.)
### Workplace Blind Spots to Watch
(Patterns that create friction or slow progress, plus how to counter them calmly.)
### Next 12-Month Career Horizon
(${isWestern ? 'How current Saturn and Jupiter transits across your 10th/6th/2nd houses influence promotions, pivots, or visibility.' : 'How current Dasha and Saturn/Jupiter transits influence promotions, pivots, or visibility.'})`,
      };

    case 'numerology': {
      const numCtx = formatPythagoreanNumerologyContext({
        fullName: profile?.name,
        birthDate: profile?.birth_date,
      });
      return {
        system,
        user: `${baseContext}

${numCtx || 'Compute Pythagorean numbers cleanly from the provided name and birth date.'}

TASK: Compose a refined "Numerology Blueprint" reading based STRICTLY on the verified Pythagorean calculations above (never alter or recalculate the numbers). Note **(${modeLabel})** context where referencing supporting chart temperament.
Structure with these ### headings:
### Core Vibrational Summary
(Synthesize Life Path, Expression/Destiny, Soul Urge, and Personality numbers into a cohesive portrait.)
### Strengths, Blind Spots & Karmic Lessons
(Highlight master numbers or karmic debt numbers if present, and explain their practical expression.)
### Career & Relational Resonance
(Work styles and interpersonal rhythms that fit this numerological signature.)
### Active Timing Cycle (${now.getUTCFullYear()})
(Interpret the verified Personal Year, Personal Month, and Personal Day numbers with clear practical focus.)`,
      };
    }

    case 'love-compatibility': {
      const partnerName = String(inputs.partnerName || partnerProfile?.name || 'Partner').trim();
      const partnerDob = String(inputs.partnerDob || partnerProfile?.birth_date || '').trim();
      const userNum = formatPythagoreanNumerologyContext({
        fullName: profile?.name,
        birthDate: profile?.birth_date,
      });
      const partnerNum = formatPythagoreanNumerologyContext({
        fullName: partnerName,
        birthDate: partnerDob,
      });
      return {
        system,
        user: `${baseContext}

PARTNER DETAILS:
Name: ${partnerName}
Date of Birth: ${partnerDob || 'Not provided'}
${partnerWesternCtx ? `\nVERIFIED PARTNER NATAL CHART DATA (${modeLabel}):\n${partnerWesternCtx}` : ''}

PERSON A VERIFIED NUMEROLOGY:
${userNum || 'N/A'}

PERSON B VERIFIED NUMEROLOGY:
${partnerNum || 'N/A'}

TASK: Compose a thoughtful, honest "Love Compatibility" reading between ${profile?.name || 'Person A'} and ${partnerName} (**${modeLabel}**).
Include **(${modeLabel})** visibly at the start.
Structure with these ### headings:
### Compatibility Overview & Core Chemistry
(Give a grounded, balanced overview of how these two personalities meet — avoid fatalistic "doomed" or shallow 100% claims.)
### Astrological & Moon/Venus Resonance
(${isWestern ? 'Compare Tropical Sun/Moon/Venus/Mars aspects, elemental balance, and synastry dynamics using verified chart data.' : 'Compare emotional rhythms, Moon Nakshatra pacing, Venus/Mars chemistry, and partnership needs using verified chart data.'})
### Numerological Harmony
(Compare their verified Life Path and Expression dynamics cleanly.)
### Friction Points & How to Navigate Them
(3 honest, practical habits that help this specific pairing communicate clearly and build lasting trust.)`,
      };
    }

    case 'salary-negotiator': {
      const offerContext = String(inputs.offerContext || '').trim();
      return {
        system,
        user: `${baseContext}

USER OFFER / NEGOTIATION CONTEXT:
"${offerContext}"

TASK: Compose a sharp, practical "Salary & Offer Strategist" briefing as of ${dateStr} (**${modeLabel}**).
Include **(${modeLabel})** visibly at the start.
Structure with these ### headings:
### Strategic Positioning & Chart Leverage
(${isWestern ? 'Briefly connect the user’s 2nd house, 10th house/Midheaven, Mercury communication style, and current transits to their strongest negotiating posture.' : 'Briefly connect the user’s 2nd house, 10th house, Mercury communication tone, and active Dasha to their strongest negotiating posture.'})
### Three Tailored Scripts
Provide three crisp, ready-to-adapt templates (use clean blockquotes or clear subsections):
1. **The Confident Anchor** (direct, value-led)
2. **The Analytical Case** (data, scope, and benchmark-led)
3. **The Collaborative Bridge** (partnership and total-package focused)
### Timing & Delivery Notes
(Practical timing guidance based on active Mercury/Jupiter transits and pacing.)`,
      };
    }

    case 'dream-interpreter': {
      const dreamText = String(inputs.dreamText || '').trim();
      return {
        system,
        user: `${baseContext}

USER DREAM LOG:
"${dreamText}"

TASK: Compose a thoughtful, grounded "Dream Interpreter" reflection combining Jungian/archetypal psychology with ${isWestern ? 'Western Moon, Neptune & 12th-house symbolism' : 'Vedic Moon & 12th-house symbolism'} (**${modeLabel}**).
Include **(${modeLabel})** visibly at the start.
Structure with these ### headings:
### Core Symbols & Archetypal Themes
(Unpack the 3–4 standout images, settings, or emotional shifts in the dream.)
### Chart & Subconscious Echoes
(${isWestern ? 'If a birth chart is provided, gently link the dream’s tone to the Tropical Moon, Neptune/12th house, or current transits; otherwise focus cleanly on inner emotional currents.' : 'If a birth chart is provided, gently link the dream’s tone to the Moon Nakshatra, 12th house, or current Dasha/transit phase; otherwise focus cleanly on inner emotional currents.'})
### What Your Mind May Be Processing
(Translate the symbolism into plain, compassionate real-life reflection questions.)
### Grounding Practice
(One calm sleep-hygiene or journaling prompt to integrate the insight.)`,
      };
    }

    case 'affirmations-generator': {
      const situation = String(inputs.situation || '').trim();
      return {
        system,
        user: `${baseContext}

USER SITUATION / INTENTION:
"${situation}"

TASK: Craft 5 calm, believable, deeply personal affirmations grounded in the user’s actual chart placements (${isWestern ? 'Tropical Sun, Moon, Rising, 2nd house, Venus, and Jupiter aspects' : 'Moon Nakshatra, Ascendant, 2nd house, Venus, and Jupiter'}) (**${modeLabel}**) — never hollow toxic positivity.
Include **(${modeLabel})** visibly at the start.
Structure with these ### headings:
### Anchoring Theme
(Two sentences connecting their current situation to their chart’s innate strengths.)
### Five Chart-Aligned Affirmations
For each affirmation:
- Present the **affirmation statement** in clean bold prose (first person, present, grounded).
- Follow with a concise italicized line explaining *which verified natal placement or transit supports it*.
### Daily Integration Practice
(A brief 2-minute morning or evening cue for practicing these naturally.)`,
      };
    }

    case 'planet-strength-tester': {
      const planet = String(inputs.planet || 'Sun');
      const totalScore = Number(inputs.totalScore || 12);
      const answersSummary = Array.isArray(inputs.answersSummary)
        ? (inputs.answersSummary as Array<{ question: string; answer: string; score: number }>)
            .map((a, idx) => `${idx + 1}. ${a.question} -> "${a.answer}" (${a.score}/4)`)
            .join('\n')
        : '';
      const enrichedChart =
        profile?.chart_json && !profile.chart_json.western && profile.chart_json.planets?.length
          ? enrichCompiledChart(profile.chart_json).chartJson
          : profile?.chart_json;
      const westernPlanet = enrichedChart?.western?.planets?.find((p) => p.name === planet);
      const vedicPlanet = enrichedChart?.planets?.find((p) => p.name === planet);
      const natalNote = isWestern
        ? westernPlanet
          ? `VERIFIED NATAL TROPICAL ${planet.toUpperCase()} PLACEMENT: ${westernPlanet.sign} ${westernPlanet.dms} (Placidus House ${westernPlanet.house}${westernPlanet.isRetrograde ? ', Retrograde' : ''})`
          : `No saved Western chart attached — interpret primarily from the lived-experience responses.`
        : vedicPlanet
        ? `VERIFIED NATAL SIDEREAL ${planet.toUpperCase()} PLACEMENT: ${vedicPlanet.sign} ${vedicPlanet.dms} (House ${vedicPlanet.house}, ${vedicPlanet.nakshatra} Pada ${vedicPlanet.pada}, Dignity: ${vedicPlanet.dignity}${vedicPlanet.isRetrograde ? ', Retrograde' : ''})`
        : `No saved natal chart attached — interpret primarily from the lived-experience responses.`;

      return {
        system,
        user: `${baseContext}

${natalNote}

PLANET TESTED: ${planet}
LIVED-EXPERIENCE SCORE: ${totalScore}/20
USER RESPONSES:
${answersSummary}

TASK: Compose a clear, honest "Planet Strength Assessment" for **${planet}** (**${modeLabel}**).
Include **(${modeLabel})** visibly at the start.
Structure with these ### headings:
### Functional Status: [Balanced & Expressive / Developing & Mixed / Strained & Seeking Support]
(Synthesize the ${totalScore}/20 lived score alongside the verified ${modeLabel} natal placement above — noting where lived habits reinforce or override chart placement.)
### How ${planet} Is Showing Up in Daily Life
(Highlight concrete behavioral strengths and friction patterns reflected in their answers.)
### Practical Harmonizers
(3 grounded, zero-superstition habits, mindset shifts, or weekly practices to strengthen and refine ${planet}’s expression.)`,
      };
    }

    case 'birth-chart-matching': {
      const partnerName = String(inputs.partnerName || partnerProfile?.name || 'Partner').trim();
      const partnerDob = String(inputs.partnerDob || partnerProfile?.birth_date || '').trim();
      const partnerBirthTime = String(inputs.partnerBirthTime || '').trim();
      const partnerBirthPlace = String(inputs.partnerBirthPlace || '').trim();
      const relationshipIntent = String(inputs.relationshipIntent || 'Long-term partnership / marriage').trim();
      return {
        system,
        user: `${baseContext}

PARTNER DETAILS FOR CHART MATCHING (${modeLabel}):
Name: ${partnerName}
Date of Birth: ${partnerDob || 'Not provided'}
${partnerBirthTime ? `Birth Time: ${partnerBirthTime}` : ''}
${partnerBirthPlace ? `Birth Place: ${partnerBirthPlace}` : ''}
Context / Goal: ${relationshipIntent}
${partnerWesternCtx ? `\nVERIFIED PARTNER NATAL CHART DATA (${modeLabel}):\n${partnerWesternCtx}` : ''}

TASK: Compose a thoughtful, scholarly, and strictly non-fear-based "Birth Chart Matching" synthesis between ${profile?.name || 'Person A'} and ${partnerName} (**${modeLabel}**).
Include **(${modeLabel})** visibly at the start.
Structure with these ### headings:
### Partnership Alignment Summary
(Give a balanced, honest overall synthesis of emotional resonance, practical compatibility, and long-term partnership durability. Never use fear-mongering — explain balances and practical mitigations clearly.)
### ${isWestern ? 'Sun, Moon & Synastry Aspects' : 'Moon, Nakshatra & Emotional Rhythm (Ashtakoot Lens)'}
(${isWestern ? 'Examine Tropical Moon signs, Sun/Moon harmony, Mercury communication rhythm, and elemental balance using the verified placements available.' : 'Examine Moon sign / Nakshatra harmony, temperament pacing, and mental ease using the verified placements available.'})
### ${isWestern ? 'Venus, Mars, 7th House & House Overlays' : 'Venus, Mars & 7th House / Navamsa Interplay'}
(Compare affection styles, conflict resolution, and shared life values.)
### Strengths to Lean Into & Growth Edges
(List 3 genuine pillars of strength and 2–3 realistic habits that protect mutual trust over the years.)`,
      };
    }

    case 'breakup-clarity': {
      const breakupContext = String(inputs.breakupContext || '').trim();
      const timeframe = String(inputs.timeframe || 'Recently').trim();
      return {
        system,
        user: `${baseContext}

USER CONTEXT:
Timeline: ${timeframe}
What happened / how they feel: "${breakupContext}"

TASK: Compose a calm, deeply empathetic "Breakup Clarity & Closure" reflection as of ${dateStr} (**${modeLabel}**).
Important: Never guarantee an ex will return, never encourage obsession or stalking, and never frame heartbreak as a curse. Honor emotional dignity and genuine healing.
Include **(${modeLabel})** visibly at the start.
Structure with these ### headings:
### Making Sense of This Turning Point
(${isWestern ? 'Contextualize the timing gently through Saturn/Uranus/Pluto/Nodal transits or Venus cycles, and what chapter was naturally completing.' : 'Contextualize the timing gently through active Mahadasha/Antardasha, Saturn/Rahu-Ketu or Venus transits, and what chapter was naturally completing.'})
### What Your Moon & 7th House Are Asking For Right Now
(${isWestern ? 'Acknowledge the emotional weather honestly using their Tropical Moon sign, Venus, and 7th Placidus house rhythm.' : 'Acknowledge the emotional weather honestly using their natal Moon Nakshatra and Venus/7th house rhythm.'})
### Healing & Reset Windows Ahead
(Note constructive phases over the next 3–6 months where emotional clarity, self-respect, and fresh openness rebuild.)
### Grounded Steps Toward Closure
(3 calm, practical actions that help reclaim steadiness and self-trust this week.)`,
      };
    }

    case 'relationship-patterns': {
      const patternFocus = String(inputs.patternFocus || '').trim();
      return {
        system,
        user: `${baseContext}

USER REFLECTION ON RECURRING PATTERNS:
"${patternFocus || 'Help me understand the recurring patterns in my romantic relationships and how to shift them.'}"

TASK: Compose an insightful, non-judgmental "Relationship Pattern Decoder" analysis (**${modeLabel}**).
Include **(${modeLabel})** visibly at the start.
Structure with these ### headings:
### The Core Pattern Reflected in Your Chart
(${isWestern ? 'Synthesize Descendant/7th Placidus house, Venus, Moon, Mars, Chiron, and North/South Node axis to explain what draws you in and where tension repeats.' : 'Synthesize 7th house, 7th lord, Venus, Moon, Darakaraka, and Rahu/Ketu axis to explain what draws you in and where tension repeats.'})
### What You Often Attract vs. What Truly Nourishes You
(${isWestern ? 'Contrast surface chemistry or Descendant projections with the deeper qualities your Tropical Moon, Venus aspects, and 4th/7th houses genuinely thrive on.' : 'Contrast surface chemistry or familiar conditioning with the deeper qualities your Navamsa (D9) and Moon genuinely thrive on.'})
### Early Red Flags & Self-Protective Habits
(Name 2–3 subtle behavioral loops honestly without blame.)
### Rewriting the Pattern Going Forward
(3 clear relational boundaries or pacing practices to build healthier reciprocity.)`,
      };
    }

    case 'soul-compass':
      return {
        system,
        user: `${baseContext}

TASK: Compose a luminous yet grounded "Soul Purpose & Nodal Compass" reading (**${modeLabel}**).
Include **(${modeLabel})** visibly at the start.
Structure with these ### headings:
### ${isWestern ? 'Your Evolutionary Arc (South Node to North Node)' : 'Your Evolutionary Arc (Ketu to Rahu)'}
(${isWestern ? 'Explain the comfort zone and innate mastery shown by your Tropical South Node house/sign versus the stretch and calling represented by your North Node house/sign.' : 'Explain the comfort zone and innate mastery shown by Ketu’s house/sign versus the stretch and calling represented by Rahu’s house/sign.'})
### ${isWestern ? 'Sun, Midheaven & Core Life Lesson' : 'Atmakaraka & Core Life Lesson'}
(${isWestern ? 'Interpret your natal Sun, Chiron, and 9th/10th Placidus house/Midheaven themes in plain, practical language.' : 'Interpret the Jaimini Atmakaraka and 9th/10th house Dharma themes in plain, practical language.'})
### ${isWestern ? 'Long-Term Maturation & Inner Alignment' : 'Navamsa (D9) Maturity & Inner Alignment'}
(Describe how your sense of purpose refines with experience and what kind of contribution feels deeply worthwhile.)
### Living Your Compass Practically
(3 concrete ways to align daily work, creativity, and choices with this evolutionary direction right now.)`,
      };

    case 'jupiter-opportunities':
      return {
        system,
        user: `${baseContext}

TASK: Compose a strategic, grounded "Jupiter Expansion Windows" briefing starting ${dateStr} (**${modeLabel}**).
Important: Zero lottery/gambling/instant-riches promises — frame Jupiter authentically as wisdom, mentorship, strategic leverage, education, and compounding opportunity.
Include **(${modeLabel})** visibly at the start.
Structure with these ### headings:
### Jupiter’s Current Role in Your Chart
(${isWestern ? 'Explain natal Tropical Jupiter’s sign/Placidus house/aspects alongside current transiting Jupiter house activation and aspects.' : 'Explain natal Jupiter’s house/dignity alongside current Jupiter Gochar house activation and Ashtakavarga bindu support.'})
### Where Expansion Naturally Opens Next
(Identify the specific life arenas—2nd/5th/9th/10th/11th themes—most supported for growth, allies, learning, or income expansion over the coming months.)
### Timing Windows to Prepare For
(${isWestern ? 'Highlight how current transits and Jupiter’s pace reward proactive preparation versus premature over-extension.' : 'Highlight how current Dasha and Jupiter’s pace reward proactive preparation versus premature over-extension.'})
### Turning Good Timing Into Real Results
(3 practical habits to capitalize on supportive cycles with discipline.)`,
      };

    case 'cosmic-archetype':
      return {
        system,
        user: `${baseContext}

TASK: Compose a vivid, editorial "Cosmic Archetype Profile" portrait (**${modeLabel}**).
Include **(${modeLabel})** visibly at the start.
Structure with these ### headings:
### Your Signature Archetype Title
(${isWestern ? 'Create a refined, memorable two-to-four word editorial archetype grounded directly in your Tropical Sun, Moon, Rising, and chart ruler — zero cliché hype.' : 'Create a refined, memorable two-to-four word editorial archetype grounded directly in Lagna, Moon Nakshatra, and Atmakaraka — zero cliché hype.'})
### How You Think, Feel & Decide
(${isWestern ? 'Synthesize Rising sign style, Tropical Moon emotional cadence, and Mercury/Sun operating patterns.' : 'Synthesize Ascendant style, Moon Nakshatra emotional cadence, and Mercury/Sun operating patterns.'})
### Dominant Strengths & Natural Environment
(Where you feel effortlessly in flow and what kind of people or work bring out your best.)
### Subtle Shadow Tendencies & Balance Keys
(Honest, compassionate look at stress habits and one stabilizing anchor for everyday equilibrium.)`,
      };

    case 'pet-bond': {
      const petName = String(inputs.petName || 'Your Pet').trim();
      const petSpecies = String(inputs.petSpecies || 'Companion animal').trim();
      const petDate = String(inputs.petDate || '').trim();
      const petQuirks = String(inputs.petQuirks || '').trim();
      return {
        system,
        user: `${baseContext}

PET DETAILS:
Name: ${petName}
Species / Breed: ${petSpecies}
Birth or Adoption Date: ${petDate || 'Approximate / Unknown'}
Personality & Quirks: "${petQuirks || 'Affectionate, observant, and part of the household rhythm.'}"

TASK: Compose a warm, charming, grounded "Pet Temperament & Bond" reading celebrating ${petName} and their connection with ${profile?.name || 'their human'} (**${modeLabel}**).
Keep it joyful, affectionate, and sensible (no medical veterinary advice). Include **(${modeLabel})** visibly.
Structure with these ### headings:
### ${petName}’s Temperament Portrait
(Describe their natural rhythm, curiosity, loyalty, and comfort style.)
### The Bond Between You Two
(Reflect warmly on how ${petName} complements your home energy, 4th/6th house themes, and emotional pace.)
### How ${petName} Thrives Best Day-to-Day
(Play, routine, rest, and affection cues that bring out their happiest self.)`,
      };
    }

    default:
      return {
        system,
        user: `${baseContext}\n\nProvide a calm, grounded ${modeLabel} astrology insight labeled (${modeLabel}).`,
      };
  }
}

export function buildPlanetQuizGenerationPrompt(planet: string): { system: string; user: string } {
  return {
    system:
      'You are a thoughtful astrologer & behavioral psychology designer. Return strictly valid JSON with no markdown fences.',
    user: `Generate a 5-question multiple-choice self-assessment to observe how the planet **${planet}** expresses in everyday modern life (e.g., vitality/confidence for Sun, emotional steadiness for Moon, action/boundaries for Mars, clarity/communication for Mercury, wisdom/growth for Jupiter, harmony/pleasure for Venus, discipline/patience for Saturn).
Rules:
- Each question must be grounded in realistic daily behavior (zero astrology jargon in the questions).
- Each question must have exactly 4 distinct options ordered from lowest functional harmony (1 point) to highest functional harmony (4 points).
- Return strictly JSON object: { "questions": [ { "question": "...", "options": ["...", "...", "...", "..."] } ] }`,
  };
}

export function buildFallbackMarkdownForApp(params: {
  slug: string;
  profileName?: string;
  inputs?: Record<string, unknown>;
  astrologyMode?: 'vedic' | 'western';
}): string {
  const who = params.profileName || 'your chart';
  const modeTag = params.astrologyMode === 'western' ? 'Western' : 'Vedic';
  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  switch (params.slug) {
    case 'daily-horoscope':
      return `Here is your daily horoscope report for **${todayFormatted}** (**${who}**) — **(${modeTag})**:

### Today’s Rhythm & Tone
Today favors steady, deliberate execution for **${who}**. With active transits encouraging thoughtful pacing over rushed commitments, clarity arrives fastest when you protect one uninterrupted morning block for high-value decisions.

### Work, Decisions & Timing
- Prioritize written agreements, structured planning, and clear milestone check-ins before evening.
- Avoid over-committing to speculative side requests; refine what is already in motion.

### Heart & Relationships
Warmth flows naturally through unhurried listening rather than trying to solve everything at once. Keep expectations clear and calm.

### Practical Grounding Focus
Choose **one single priority** that genuinely moves the needle today and complete it cleanly before opening new tabs.`;

    case 'weekly-horoscope':
      return `### Weekly Theme: Steady Consolidation & Clear Voice
This week brings a constructive blend of structure and insight for **${who}**. Early week favors organization and quiet preparation, mid-week opens stronger dialogue and visibility, and the weekend restores inner equilibrium.

### Seven-Day Celestial Flow
- **Days 1–2:** Audit obligations, refine schedules, and clear lingering administrative details.
- **Days 3–5:** Best stretch for pitches, key conversations, and collaborative alignment.
- **Days 6–7:** Step back from noise, reset sleep rhythm, and reflect on next month’s focus.

### Career & Financial Pacing
Lean on documented evidence and measured timelines during negotiations. Avoid reactive purchases or hasty commitments.

### Relationships & Social Energy
Honest, unhurried check-ins deepen trust far more than grand gestures this week.

### Grounding Anchor for the Week
Review your top three commitments each morning and trim one non-essential obligation.`;

    case 'monthly-horoscope':
      return `### Core Theme for the Month
Across this month, **${who}** is invited into durable progress: consolidating reputation, sharpening core craft, and aligning daily habits with longer-term ambitions.

### Slow-Planet & Transit Architecture
Slow-moving transits reward patience and structural consistency. Projects started with realistic milestones gain visible traction by the final third of the month.

### Work, Craft & Resources
Focus on deepening trust with key stakeholders and tightening operational systems. Steady compounding beats rushed expansion.

### Relationships & Inner Life
Clear boundaries strengthen affection. Make intentional room for restorative quiet alongside outward responsibilities.

### Strategic Focus for the Next 30 Days
- Lock one flagship deliverable with clean scope.
- Review recurring financial commitments and eliminate low-value leakage.
- Protect consistent sleep and evening decompression routines.`;

    case 'current-transits':
      return `### Sky Weather Overview
Today’s Sidereal sky balances structural discipline with analytical curiosity. Slow-moving outer influences emphasize patient craftsmanship while faster lunar movement highlights communication and emotional responsiveness.

### Key House Activations
- **1st & 10th Houses (Identity & Vocation):** Rewards calm leadership, clear scope, and visible follow-through.
- **4th & 7th Houses (Home & Partnerships):** Encourages honest pacing and practical domestic balance.

### Practical Navigation
- Anchor major conversations in written clarity.
- Pace energy deliberately during afternoon transitions.
- Use evening hours for reflection rather than high-stakes debate.`;

    case 'dasha-analysis':
      return `### Your Active Planetary Chapter
Your current **Vimshottari Mahadasha and Antardasha** period emphasizes structured maturity, credibility, and thoughtful expansion for **${who}**. Rather than dramatic overnight leaps, this chapter rewards disciplined craftsmanship and clear long-term architecture.

### Psychological & Material Themes Right Now
- **Mindset:** Growing preference for substance, autonomy, and quiet competence over superficial noise.
- **Material Progress:** Gains compound through consistency, specialized counsel, and durable alliances.

### Next 12-Month Trajectory & Upcoming Shifts
As the upcoming Pratyantardasha pivot approaches, expect a natural shift from outward execution toward strategic review and recalibration — ideal for pruning low-leverage commitments before the next expansion wave.

### Aligning Constructively With This Period
Honor the active Dasha lords through consistent daily routines, transparent agreements, and periodic mentorship check-ins.`;

    case 'birth-chart-breakdown': {
      const topicLabel = String(params.inputs?.topicLabel || 'Core Chart Theme');
      return `### ${topicLabel}
For **${who}**, your natal configuration highlights a clear interplay between disciplined execution and perceptive intuition. Your dominant Kendra and Trikona placements work best when curiosity is paired with structured follow-through.

### Key Planetary Mechanics
- **Ascendant & Moon Balance:** Grounds emotional responsiveness in analytical clarity, helping you notice nuance others rush past.
- **Navamsa (D9) Support:** Reinforces steady maturation — capabilities that feel understated early on deepen significantly with experience.

### Practical Takeaway
Trust repeatable systems over bursts of urgency. When you pair your natural insight with clean boundaries, your strongest chart yogas express effortlessly.`;
    }

    case 'wealth-blueprint':
      return `### Financial Archetype: The Methodical Architect
For **${who}**, sustainable wealth builds most reliably through compounding credibility, specialized judgment, and structured recurring models rather than speculative leaps.

### Core Treasury & Income Channels (2nd & 11th Houses)
Your 2nd and 11th house patterns favor high-trust advisory, skill-based equity, and durable network referrals. Clear pricing and written retainers protect consistent cash flow.

### Aligned Industries & Leverage Points
- **Strategy, Advisory & Research** — turning complexity into structured decisions.
- **Technology & Systems Architecture** — building repeatable leverage.
- **Curated Education & Media** — scaling thoughtful expertise.

### Financial Blind Spots & Guardrails
Watch for quiet expense creep during busy stretches and underpricing early engagements. Schedule a calm monthly treasury review to keep savings automated.`;

    case 'love-forecast':
      return `### Current Relational Climate
For **${who}**, Venus and active Dasha themes highlight authenticity, emotional clarity, and mature reciprocity over surface intensity.

### Upcoming Connection & Alignment Windows
- **Near-Term (Next 4–6 Weeks):** Strong support for candid conversations that reset mutual expectations cleanly.
- **Medium-Term (2–4 Months):** Warmer social ease and deeper alignment with people who value consistency and curiosity.

### Your Venus & Navamsa Signature
You thrive alongside partners who communicate directly, respect quiet space, and match words with dependable follow-through.

### Grounded Guidance for the Heart
Lead with calm honesty about what matters to you rather than editing yourself to keep temporary harmony.`;

    case 'career-navigator':
      return `### Vocational Calling & Public Signature
Your 10th house and D10 Dasamsa profile points toward **high-trust leadership and structured problem-solving** for **${who}**. You do your finest work where judgment, craftsmanship, and autonomy are valued.

### Daily Work Rhythm (6th vs 10th House)
You perform best with clear ownership of outcomes and protected deep-work blocks rather than reactive micro-management.

### Aligned Career Lanes
- Executive strategy, consulting, or product architecture
- Analytical research, finance, or systems design
- Independent advisory or specialist leadership

### Workplace Blind Spots to Watch
Taking on quiet operational overload without renegotiating scope. Name trade-offs clearly before accepting parallel mandates.`;

    case 'numerology':
      return `### Core Vibrational Summary
Your verified Pythagorean numbers reveal a blend of **independent initiative, perceptive reflection, and practical follow-through** for **${who}**. Together, your Life Path and Expression numbers favor meaningful mastery over scattered pursuits.

### Strengths & Growth Edge
- **Core Strength:** Translating complex ideas into calm, trustworthy execution.
- **Growth Edge:** Avoiding perfectionistic hesitation when an 85%-ready start would teach faster.

### Career & Relational Resonance
You flourish in roles offering intellectual depth and with partners who honor honesty and mutual autonomy.

### Active Timing Cycle
This Personal Year emphasizes tightening foundations, clarifying long-range commitments, and investing steadily in durable skills.`;

    case 'love-compatibility': {
      const partnerName = String(params.inputs?.partnerName || 'your partner');
      return `### Compatibility Overview & Core Chemistry
Between **${who}** and **${partnerName}**, there is a grounded blend of complementary temperament and shared curiosity. One tends to bring structured pacing while the other adds adaptability and perspective.

### Emotional & Communication Resonance
- **Harmony:** Genuine mutual respect grows quickly when both feel heard without rush or judgment.
- **Growth Edge:** Different processing speeds under stress — one may want immediate dialogue while the other prefers quiet time first.

### Three Practical Ways to Strengthen Trust
1. Agree on a brief pause signal when discussions get heated so neither feels dismissed.
2. Share expectations explicitly around time, rest, and shared commitments.
3. Protect regular unhurried time together free of logistics and screens.`;
    }

    case 'salary-negotiator':
      return `### Strategic Positioning & Chart Leverage
Lead with calm precision, documented impact, and collaborative curiosity. Anchor your value in measurable outcomes rather than personal urgency.

### Three Tailored Scripts

#### 1. The Confident Anchor
> "Thank you for sharing the offer — I’m genuinely excited about the scope and the team. Based on the ownership expected across this role and market benchmarks for this level, I’m targeting **[Target Figure]** in base compensation. How close can we get to that number?"

#### 2. The Analytical Case
> "I’ve mapped out the key deliverables for the first 6 months alongside current market ranges for similar scope. Given my track record delivering **[Key Outcome]**, a package around **[Target Figure]** aligns cleanly with the value I’ll bring from quarter one. Would you be open to revisiting the structure together?"

#### 3. The Collaborative Bridge
> "I want to make sure we structure something that works smoothly for both sides. If base salary has a firm band ceiling, could we explore bridging the gap through a signing bonus, equity adjustment, or a 6-month performance review tied to clear milestones?"

### Timing & Delivery Notes
Send written proposals during clear mid-morning hours and follow up concisely within 48 hours if needed.`;

    case 'dream-interpreter':
      return `### Core Symbols & Archetypal Themes
Your dream weaves together themes of **transition, emotional containment, and searching for clarity**. Vivid landscapes and recurring thresholds often appear when your waking mind is quietly reorganizing priorities.

### Subconscious & Chart Echoes
When the Moon and 12th-house currents are active, unfinished daytime conversations often resurface as layered imagery. Rather than a literal omen, this reflects your mind integrating recent decisions.

### Reflection Questions
- Which moment in the dream carried the strongest emotional shift (relief, urgency, curiosity)?
- Where in waking life are you holding a similar threshold without quite naming it yet?

### Grounding Practice
Before sleep tonight, jot down two sentences naming one thing you can safely release until morning.`;

    case 'affirmations-generator':
      return `### Anchoring Theme
Your chart’s steadiness grows strongest when self-trust is anchored in calm reality rather than pressure. Practice these slowly — noticing which phrase feels most honest today.

### Five Chart-Aligned Affirmations
1. **I move at a calm, deliberate pace and trust the compounding power of clear choices.**
   *Rooted in your Saturn and Ascendant discipline — honoring steady timing over urgency.*
2. **My voice is clear, measured, and worthy of being heard without over-explaining.**
   *Aligned with Mercury’s clarity — keeping communication crisp and grounded.*
3. **I receive fair value, support, and warmth with relaxed ease.**
   *Echoing your 2nd house and Venus balance — normalizing healthy reciprocity.*
4. **Even when the full horizon is still unfolding, my next right step is enough.**
   *Guided by Jupiter’s broader perspective — trading anxious control for quiet wisdom.*
5. **I protect my inner steadiness so my energy stays clear for what truly matters.**
   *Anchored in your Moon Nakshatra — honoring rest as part of clarity.*

### Daily Integration Practice
Read one affirmation aloud once in the morning alongside three slow breaths before checking messages.`;

    case 'planet-strength-tester': {
      const planet = String(params.inputs?.planet || 'Sun');
      const score = Number(params.inputs?.totalScore || 14);
      const status =
        score >= 16
          ? 'Balanced & Expressive'
          : score >= 11
          ? 'Developing & Mixed'
          : 'Strained & Seeking Support';
      return `### Functional Status: ${status} (${score}/20)
Your reflections indicate that **${planet}** is currently operating in a **${status.toLowerCase()}** band. Core strengths are already present, and a few deliberate daily adjustments can make its expression noticeably steadier.

### How ${planet} Is Showing Up in Daily Life
- **Active Strength:** Clear awareness of where your energy thrives and when friction appears.
- **Refinement Opportunity:** Replacing reactive habits under stress with small, repeatable anchors.

### Practical Harmonizers
1. Create one consistent 15-minute weekly check-in dedicated to ${planet}’s core life area.
2. Notice early fatigue or frustration cues before they compound into over-correction.
3. Pair ambition with realistic pacing so progress stays sustainable across the season.`;
    }

    case 'birth-chart-matching': {
      const partnerName = String(params.inputs?.partnerName || 'your partner');
      return `### Partnership Alignment Summary
Comparing **${who}** and **${partnerName}** highlights strong potential for steady mutual respect when communication stays open and unhurried. Both charts value dependability and thoughtful shared goals over fleeting drama.

### Moon, Nakshatra & Emotional Rhythm
- **Emotional Resonance:** Natural warmth builds around shared routines, honest check-ins, and calm domestic rhythm.
- **Pacing Differences:** Under pressure, one prefers direct resolution while the other benefits from brief reflection before responding.

### Strengths to Lean Into & Growth Edges
1. Protect clear, direct dialogue around finances, family boundaries, and future milestones.
2. Celebrate differences in temperament as complementary rather than conflicting.
3. Build small weekly rituals together that keep emotional closeness effortless.`;
    }

    case 'breakup-clarity':
      return `### Making Sense of This Turning Point
Endings frequently arrive during Dasha or slow-planet transit pivots when two people’s growth trajectories no longer move in the same rhythm. For **${who}**, this chapter points toward clearing quiet emotional strain so steadier alignment can emerge.

### What Your Moon & 7th House Are Asking For Right Now
Your emotional rhythm thrives on honesty and nervous-system calm rather than prolonged uncertainty. Allow yourself space to grieve cleanly without rewriting the past or rushing into immediate distraction.

### Grounded Steps Toward Closure
1. Limit digital check-ins for 30 days so your emotional focus settles back into your own life.
2. Write down two lessons you are grateful to carry forward and one boundary you will protect next time.
3. Re-anchor your week with steady sleep, movement, and trusted friends.`;

    case 'relationship-patterns':
      return `### The Core Pattern Reflected in Your Chart
For **${who}**, 7th-house and Venus dynamics reveal a recurring pull between wanting deep emotional safety and being drawn to intense, unpredictable chemistry.

### What You Often Attract vs. What Truly Nourishes You
- **Familiar Pull:** High initial intensity that later demands constant emotional guessing.
- **True Nourishment:** Consistent follow-through, direct kindness, and quiet intellectual respect.

### Rewriting the Pattern Going Forward
1. Pace early trust by observing consistency over 90 days rather than early promises.
2. Voice core needs calmly early on instead of accommodating silently until resentment builds.
3. Choose reciprocity where both people invest equally in repair and clarity.`;

    case 'soul-compass':
      return `### Your Evolutionary Arc (Ketu to Rahu)
For **${who}**, Ketu reflects innate competence in self-reliance, analysis, and quiet discernment — while Rahu invites you outward into visible contribution, collaborative impact, and courageous new territory.

### Atmakaraka & Core Life Lesson
Your deeper satisfaction arrives when skill and integrity serve something larger than short-term validation. Meaning deepens whenever you trade perfectionistic hesitation for steady, principled action.

### Living Your Compass Practically
1. Dedicate weekly time to a craft or contribution that stretches you beyond your comfort zone.
2. Notice when familiar habits keep you playing small out of habit rather than wisdom.
3. Measure progress by inner alignment and durability, not external applause.`;

    case 'jupiter-opportunities':
      return `### Jupiter’s Current Role in Your Chart
For **${who}**, Jupiter’s cycle emphasizes compounding credibility, wise alliances, and structured expansion rather than sudden shortcuts.

### Where Expansion Naturally Opens Next
- **Knowledge & Craft:** Upgrading a high-leverage skill or advisory credential pays disproportionate returns.
- **Allies & Mentors:** Conversations with experienced peers unlock clarity and introductions.
- **Measured Financial Growth:** Consistent systems and clear pricing outperform speculative detours.

### Turning Good Timing Into Real Results
Prepare your flagship work cleanly now so when openings surface over the coming quarters, you can step into them without scrambling.`;

    case 'cosmic-archetype':
      return `### Your Signature Archetype: The Quiet Architect
For **${who}**, your Ascendant, Moon Nakshatra, and planetary balance blend perceptive intuition with methodical execution. You notice subtle undercurrents quickly, yet prefer building durable outcomes over chasing noise.

### How You Think, Feel & Decide
You process major decisions best with a brief window of quiet reflection followed by decisive follow-through.

### Subtle Shadow Tendencies & Balance Keys
Watch for over-carrying silent responsibility when delegating or naming limits would protect your energy. Regular unhurried downtime keeps your sharpest intuition clear.`;

    case 'pet-bond': {
      const petName = String(params.inputs?.petName || 'Your companion');
      return `### ${petName}’s Temperament Portrait
**${petName}** carries an observant, loyal, and comfort-loving presence — keenly attuned to household tone and happiest when daily rhythms feel predictable and warm.

### The Bond Between You Two
Your connection acts as a natural grounding anchor: ${petName} responds closely to your calm presence and brings lighthearted ease into busy weeks.

### How ${petName} Thrives Best Day-to-Day
Consistent meal and play rhythms, gentle verbal reassurance, and a favorite sunny or cozy corner will keep ${petName} relaxed and deeply content.`;
    }

    default:
      return `### Reading Summary (${modeTag})\nYour reading is ready. Use the button below to continue exploring this theme in Chat.`;
  }
}
