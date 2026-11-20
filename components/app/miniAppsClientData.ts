import React from 'react';
import {
  Briefcase,
  CalendarDays,
  CloudMoon,
  Compass,
  Feather,
  Flame,
  Gauge,
  Hash,
  Heart,
  HeartHandshake,
  Hourglass,
  Landmark,
  Moon,
  Orbit,
  PawPrint,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  Users,
} from 'lucide-react';
import type {
  BreakdownDomain,
  HomeSummaryResponse,
  MiniAppDefinition,
  MiniAppRunResponse,
  PlanetStrengthQuestion,
} from './miniAppsTypes';

export const CLIENT_MINI_APPS: MiniAppDefinition[] = [
  {
    slug: 'daily-horoscope',
    title: 'Daily Horoscope',
    shortTitle: 'Daily Horoscope',
    tagline: 'Personal transit & lunar rhythm for today',
    description:
      'Combines today’s Sidereal sky movements, active Moon Nakshatra, and your current Vimshottari Dasha into clear, grounded daily counsel.',
    category: 'daily_timing',
    categoryLabel: 'Daily & Timing',
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
    categoryLabel: 'Daily & Timing',
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
    categoryLabel: 'Daily & Timing',
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
    categoryLabel: 'Daily & Timing',
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
    categoryLabel: 'Daily & Timing',
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
    categoryLabel: 'Self & Chart',
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
    categoryLabel: 'Self & Chart',
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
    categoryLabel: 'Self & Chart',
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
  // ---------------- WAVE 2 GROUNDED MINI-APPS ----------------
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
    categoryLabel: 'Self & Chart',
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
    categoryLabel: 'Self & Chart',
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

export const CLIENT_BREAKDOWN_DOMAINS: BreakdownDomain[] = [
  {
    id: 'gifts',
    title: 'My Gifts',
    subtitle: 'Natural aptitudes, distinctive talents & hidden chart strengths',
    topics: [
      { id: 'natural-talents', label: 'Natural Talents', summary: 'Core innate strengths from Lagna, Sun, Moon & Kendra lords' },
      { id: 'hidden-strengths', label: 'Hidden Strengths', summary: 'Subtle capabilities shown in Nakshatras & Navamsa (D9)' },
      { id: 'karmic-boons', label: 'Supportive Blessings', summary: '9th house grace, benefics & protective yogas' },
    ],
  },
  {
    id: 'personality',
    title: 'Personality',
    subtitle: 'Core temperament, emotional instincts & outward presence',
    topics: [
      { id: 'core-identity', label: 'Core Identity', summary: 'Ascendant sign, Lagna lord & Moon Nakshatra signature' },
      { id: 'shadow-patterns', label: 'Blind Spots & Stress Patterns', summary: 'How Saturn, Rahu/Ketu or 8th/12th placements show up under stress' },
      { id: 'social-presence', label: 'How Others Experience You', summary: 'First impression via 1st, 3rd & Venus/Mercury style' },
    ],
  },
  {
    id: 'strength',
    title: 'Planetary Strength',
    subtitle: 'Anchor planets, sensitive placements & practical balance',
    topics: [
      { id: 'strongest-planets', label: 'Strongest Pillars', summary: 'Exalted, own-sign, directional & high-SAV planets' },
      { id: 'sensitive-planets', label: 'Sensitive Placements', summary: 'Debilitated, combust or pressured planets needing conscious care' },
      { id: 'practical-balance', label: 'Harmonizing Habits', summary: 'Grounded behavioral routines to support planetary balance' },
    ],
  },
  {
    id: 'yogas',
    title: 'Yogas & Patterns',
    subtitle: 'Dhana Yogas, Raja Yogas & structural life lessons',
    topics: [
      { id: 'wealth-yogas', label: 'Wealth Yogas', summary: '2nd, 5th, 9th & 11th house Dhana combinations' },
      { id: 'raja-yogas', label: 'Leadership & Raja Yogas', summary: 'Kendra–Trikona connections across D1 and D9' },
      { id: 'structural-lessons', label: 'Karmic Friction Points', summary: 'Constructive reading of challenging yogas or house tensions' },
    ],
  },
  {
    id: 'love',
    title: 'Love Life',
    subtitle: 'Relational style, emotional language & recurring patterns',
    topics: [
      { id: 'as-a-partner', label: 'You as a Partner', summary: '7th lord, Venus & emotional loyalty style' },
      { id: 'love-language', label: 'Emotional Needs & Love Language', summary: 'Moon Nakshatra, 5th house & Venus expression' },
      { id: 'watch-outs', label: 'Relationship Watch-Outs', summary: 'Recurring friction triggers & communication blind spots' },
      { id: 'karmic-ties', label: 'Nodal Attraction Patterns', summary: 'Rahu/Ketu lessons around partnership & independence' },
    ],
  },
  {
    id: 'marriage',
    title: 'Marriage',
    subtitle: 'Long-term partnership timing, spouse archetype & family life',
    topics: [
      { id: 'marriage-timing', label: 'Commitment Timing', summary: '7th lord Dasha, KP 7th CSL & Jupiter/Saturn transits' },
      { id: 'spouse-profile', label: 'Partner Archetype', summary: 'Darakaraka, 7th house & Navamsa 7th indications' },
      { id: 'post-marriage', label: 'Life After Commitment', summary: 'How partnership reshapes stability, finances & growth' },
      { id: 'children-family', label: 'Children & Creative Legacy', summary: '5th house, Jupiter & nurturing dynamics' },
    ],
  },
  {
    id: 'career',
    title: 'Career',
    subtitle: 'Vocation, employment vs autonomy & ideal fields',
    topics: [
      { id: 'ideal-path', label: 'Ideal Vocational Path', summary: '10th house, D10 Dasamsa & Amatyakaraka calling' },
      { id: 'job-vs-business', label: 'Employment vs Independence', summary: 'Comparing 6th, 7th & 10th house structural fit' },
      { id: 'aligned-industries', label: 'Aligned Industries', summary: 'Sectors matching your dominant planetary signatures' },
      { id: 'career-friction', label: 'Growth Bottlenecks', summary: 'Workplace habits & timing hurdles to navigate wisely' },
    ],
  },
  {
    id: 'settlement',
    title: 'Travel & Relocation',
    subtitle: 'Foreign ties, relocation fit & sense of home',
    topics: [
      { id: 'relocation-potential', label: 'Relocation Potential', summary: '4th, 9th & 12th house ties + Rahu/Ketu influence' },
      { id: 'environment-fit', label: 'Thriving Environments', summary: 'Cultural, directional & geographic settings that suit you' },
      { id: 'rooting-challenges', label: 'Staying Grounded Abroad', summary: 'Balancing ambition away from home with inner stability' },
    ],
  },
  {
    id: 'wealth',
    title: 'Wealth',
    subtitle: 'Income channels, compounding style & risk awareness',
    topics: [
      { id: 'primary-source', label: 'Primary Earning Engines', summary: '2nd & 11th house lords + D2 Hora indications' },
      { id: 'volatility-windfalls', label: 'Risk & Upside Dynamics', summary: '5th & 8th house appetite for equity, markets & pivots' },
      { id: 'financial-leaks', label: 'Expense & Debt Discipline', summary: '6th & 12th house spending triggers to manage' },
    ],
  },
  {
    id: 'health',
    title: 'Vitality & Pacing',
    subtitle: 'Constitutional tendencies, stress recovery & sustainable energy',
    topics: [
      { id: 'constitution', label: 'Energy & Stress Tendencies', summary: 'Lagna, Moon & 6th house lifestyle sensitivities' },
      { id: 'preventive-rhythms', label: 'Restorative Routines', summary: 'Daily pacing, sleep & recovery matched to your Moon' },
      { id: 'burnout-signals', label: 'Early Burnout Signals', summary: 'Knowing when to slow down during intense transits' },
    ],
  },
  {
    id: 'family',
    title: 'Family & Roots',
    subtitle: 'Home atmosphere, parental themes & generational strengths',
    topics: [
      { id: 'parental-themes', label: 'Parental & Lineage Themes', summary: '4th house (mother/home) & 9th house (father/mentors)' },
      { id: 'sibling-peers', label: 'Siblings & Close Circle', summary: '3rd & 11th house communication and support dynamics' },
      { id: 'home-sanctuary', label: 'Creating Your Sanctuary', summary: '4th house needs for emotional peace & domestic rhythm' },
    ],
  },
];

export const CLIENT_PLANET_QUIZ_PREVIEW: Record<string, PlanetStrengthQuestion[]> = {
  Sun: [
    {
      question: 'When a group decision needs clear leadership, how do you typically respond?',
      options: [
        'I stay completely quiet and prefer others steer.',
        'I hold back unless directly invited to weigh in.',
        'I share structured direction whenever the outcome matters.',
        'I naturally anchor the conversation with calm ownership.',
      ],
    },
    {
      question: 'How steady is your self-respect when external recognition is absent?',
      options: [
        'My confidence drops sharply without validation.',
        'I second-guess myself after quiet criticism.',
        'I wobble briefly, then reconnect with my own standards.',
        'My inner compass stays steady regardless of applause.',
      ],
    },
    {
      question: 'How consistent is your morning clarity and focus on core priorities?',
      options: [
        'Often drained or scattered as the day opens.',
        'Strong bursts followed by noticeable dips.',
        'Reliable when I protect my morning rhythm.',
        'Clear, energized, and purposeful most mornings.',
      ],
    },
    {
      question: 'What pattern shows up most with authority figures or senior mentors?',
      options: [
        'Frequent friction or feeling quietly overlooked.',
        'Hesitation when voicing honest disagreement.',
        'Constructive respect with occasional boundary tension.',
        'Mutual candor, ease, and reciprocal trust.',
      ],
    },
    {
      question: 'How clearly do you know what you are building toward this season?',
      options: [
        'Things feel mostly reactive and foggy.',
        'Several competing ideas without firm commitment.',
        'Main direction is clear with details refining.',
        'Priorities are unmistakable and visible in my week.',
      ],
    },
  ],
};

export function renderMiniAppIcon(iconKey: string, className = 'h-5 w-5'): React.ReactNode {
  switch (iconKey) {
    case 'sun':
      return React.createElement(Sun, { className });
    case 'calendar-days':
      return React.createElement(CalendarDays, { className });
    case 'moon':
      return React.createElement(Moon, { className });
    case 'orbit':
      return React.createElement(Orbit, { className });
    case 'hourglass':
      return React.createElement(Hourglass, { className });
    case 'compass':
      return React.createElement(Compass, { className });
    case 'landmark':
      return React.createElement(Landmark, { className });
    case 'heart':
      return React.createElement(Heart, { className });
    case 'briefcase':
      return React.createElement(Briefcase, { className });
    case 'hash':
      return React.createElement(Hash, { className });
    case 'gauge':
      return React.createElement(Gauge, { className });
    case 'heart-handshake':
      return React.createElement(HeartHandshake, { className });
    case 'scale':
      return React.createElement(Scale, { className });
    case 'cloud-moon':
      return React.createElement(CloudMoon, { className });
    case 'feather':
      return React.createElement(Feather, { className });
    case 'users':
      return React.createElement(Users, { className });
    case 'shield-check':
      return React.createElement(ShieldCheck, { className });
    case 'refresh-cw':
      return React.createElement(RefreshCw, { className });
    case 'sparkles':
      return React.createElement(Sparkles, { className });
    case 'trending-up':
      return React.createElement(TrendingUp, { className });
    case 'flame':
      return React.createElement(Flame, { className });
    case 'paw-print':
      return React.createElement(PawPrint, { className });
    default:
      return React.createElement(Compass, { className });
  }
}

export const PREVIEW_HOME_SUMMARY: HomeSummaryResponse = {
  recentConversations: [
    {
      id: 'preview-conv-1',
      title: 'Career Pivot Timing & D10 Alignment',
      pillar: 'council',
      profile_id: 'preview-prof-1',
      profile_label: 'You (Aarav)',
      companion_name: null,
      companion_role: null,
      updated_at: '2026-11-17T18:30:00.000Z',
    },
    {
      id: 'preview-conv-companion-1',
      title: 'Nadia · Career Crossroads Decompression',
      pillar: 'companion',
      profile_id: null,
      profile_label: null,
      companion_name: 'Nadia',
      companion_role: 'Thoughtful Confidante',
      updated_at: '2026-11-17T17:15:00.000Z',
    },
    {
      id: 'preview-conv-2',
      title: 'Understanding KP 10th Cusp Sub-Lord',
      pillar: 'council',
      profile_id: null,
      profile_label: null,
      companion_name: null,
      companion_role: null,
      updated_at: '2026-11-16T14:10:00.000Z',
    },
  ],
  recentGuides: [
    {
      kind: 'council',
      id: 'expert-council_synthesis',
      title: 'Vedic Astrologer',
      subtitle: 'Parashari, KP, Jaimini & Dasha synthesis',
      expertSlug: 'council_synthesis',
      conversationId: 'preview-conv-1',
      lastActiveAt: '2026-11-17T18:30:00.000Z',
    },
    {
      kind: 'companion',
      id: 'comp-preview-conv-companion-1',
      title: 'Nadia',
      subtitle: 'Thoughtful Confidante',
      conversationId: 'preview-conv-companion-1',
      lastActiveAt: '2026-11-17T17:15:00.000Z',
    },
    {
      kind: 'council',
      id: 'expert-tarot_reader',
      title: 'Tarot',
      subtitle: '78-card Rider-Waite symbolic spreads',
      expertSlug: 'tarot_reader',
    },
    {
      kind: 'council',
      id: 'expert-western_astrologer',
      title: 'Western Astrologer',
      subtitle: 'Tropical Zodiac, Placidus & aspects',
      expertSlug: 'western_astrologer',
    },
    {
      kind: 'council',
      id: 'expert-numerologist',
      title: 'Numerology',
      subtitle: 'Pythagorean Life Path & timing cycles',
      expertSlug: 'numerologist',
    },
  ],
  favoriteAppSlugs: ['daily-horoscope', 'dasha-analysis', 'birth-chart-breakdown'],
  recentAppRuns: [
    { app_slug: 'daily-horoscope', updated_at: '2026-11-17T08:15:00.000Z' },
    { app_slug: 'current-transits', updated_at: '2026-11-16T19:00:00.000Z' },
  ],
};

export function buildPreviewAppResult(
  slug: string,
  inputs?: Record<string, unknown>
): MiniAppRunResponse {
  const nowIso = new Date().toISOString();
  const profileUsed = { id: 'preview-prof-1', name: 'Aarav Mehta (Sample)', short_name: 'Aarav' };

  if (slug === 'current-transits') {
    return {
      slug,
      cacheHit: true,
      cachedAt: nowIso,
      profileUsed,
      structured: {
        eyebrow: 'Verified Sidereal Gochar · Sample Observatory Sky',
        headline: 'Live Sky Mapped to Aarav’s Virgo Lagna',
        table: {
          columns: ['Planet', 'Sign & Degree', 'Nakshatra', 'From Lagna', 'From Moon', 'SAV'],
          rows: [
            ['Jupiter (R)', 'Gemini 18°42\'', 'Ardra', 'H10', 'H10', '33'],
            ['Saturn', 'Pisces 11°09\'', 'Uttara Bhadrapada', 'H7', 'H7', '29'],
            ['Rahu (R)', 'Aquarius 24°15\'', 'Purva Bhadrapada', 'H6', 'H6', '31'],
            ['Ketu (R)', 'Leo 24°15\'', 'Purva Phalguni', 'H12', 'H12', '26'],
            ['Sun', 'Scorpio 01°22\'', 'Vishakha', 'H3', 'H3', '30'],
            ['Venus', 'Libra 19°40\'', 'Swati', 'H2', 'H2', '32'],
          ],
        },
      },
      markdown: `### Sky Weather Overview
Today’s Sidereal alignment pairs **Jupiter retrograde in your 10th house (Gemini, 33 SAV)** with **Saturn steadying your 7th house (Pisces, 29 SAV)**. Visibility and structured negotiations remain strongly supported.

### Key House Activations
- **10th House (Career & Reputation):** Jupiter brings thoughtful review of past opportunities and high-trust advisory conversations.
- **7th House (Partnerships & Contracts):** Saturn asks for clear written terms and patience rather than rushed verbal commitments.
- **2nd House (Resources & Voice):** Venus in own sign Libra softens tone and supports calm pricing discussions.

### Practical Navigation
- Revisit one strong professional lead from the past 60 days rather than chasing cold outreach.
- Put scope expectations in writing before closing agreements.`,
    };
  }

  if (slug === 'dasha-analysis') {
    return {
      slug,
      cacheHit: true,
      cachedAt: nowIso,
      profileUsed,
      structured: {
        eyebrow: 'Active Vimshottari Ladder · Virgo Lagna · Hasta Moon',
        headline: 'Saturn–Jupiter Planetary Chapter',
        metrics: [
          { label: 'Mahadasha', value: 'Saturn', hint: '2018-04-10 → 2037-04-10' },
          { label: 'Antardasha', value: 'Jupiter', hint: '2025-11-04 → 2028-05-17' },
          { label: 'Pratyantardasha', value: 'Mercury', hint: '2026-09-20 → 2027-01-28' },
        ],
      },
      markdown: `### Your Active Planetary Chapter
You are moving through **Saturn Mahadasha → Jupiter Antardasha → Mercury Pratyantardasha**. Together, these three lords activate structured mastery (5th/6th Saturn), strategic counsel & partnership wisdom (4th/7th Jupiter), and vocal career leverage (1st/10th Mercury).

### Psychological & Material Themes Right Now
- **Career Trajectory:** Favors transitioning from pure execution into advisory authority, architecture, or specialized ownership.
- **Inner Pacing:** Saturn demands realism while Jupiter widens perspective — the most durable decisions combine cautious math with long-term vision.

### Next 12-Month Trajectory & Upcoming Shifts
On **January 28, 2027**, the micro-period shifts from **Mercury to Ketu Pratyantardasha** — a natural 3-month phase for streamlining routines, letting go of low-value obligations, and focusing deeply on your sharpest craft.

### Aligning Constructively With This Period
Keep commitments lean, document milestones clearly, and protect regular weekly quiet for strategic thinking.`,
    };
  }

  if (slug === 'numerology') {
    return {
      slug,
      cacheHit: true,
      cachedAt: nowIso,
      profileUsed,
      structured: {
        eyebrow: 'Deterministic Pythagorean Matrix · 1992-08-14',
        headline: 'Aarav Mehta Core Numbers',
        metrics: [
          { label: 'Life Path', value: '7', hint: 'Analytical Seeker' },
          { label: 'Expression', value: '8', hint: 'Executive Builder' },
          { label: 'Soul Urge', value: '3', hint: 'Articulate Creator' },
          { label: 'Personality', value: '5', hint: 'Adaptable Voice' },
          { label: 'Personal Year', value: '4', hint: 'Foundations & Craft' },
          { label: 'Personal Day', value: '9', hint: 'Completion & Clarity' },
        ],
      },
      markdown: `### Core Vibrational Summary
Your **Life Path 7** pairs perceptive research instincts with the structural leadership drive of **Expression 8**. While you value quiet depth and independence, your destiny number consistently draws you into building tangible, well-organized ventures.

### Strengths & Growth Edge
- **Core Strength:** Spotting root causes quickly and translating insight into practical executive systems.
- **Growth Edge:** Balancing 7’s desire to keep refining privately with 8’s need to publish, delegate, and claim fair value.

### Active Timing Cycle
Your **Personal Year 4** rewards clean foundations — repeatable workflows, transparent agreements, and disciplined financial habits that pay dividends throughout the next nine-year cycle.`,
    };
  }

  if (slug === 'daily-horoscope') {
    return {
      slug,
      cacheHit: true,
      cachedAt: nowIso,
      profileUsed,
      structured: {
        eyebrow: 'Aarav Mehta · Virgo Lagna · Hasta Moon',
        headline: 'Today’s Observatory Brief',
        metrics: [
          { label: 'Active Dasha', value: 'Saturn–Jupiter', hint: 'PD: Mercury' },
          { label: 'Today’s Moon', value: 'Virgo', hint: 'Hasta Nakshatra' },
          { label: 'Jupiter Gochar', value: 'Gemini', hint: 'House 10 from Lagna' },
        ],
      },
      markdown: `### Today’s Rhythm & Tone
With **Mercury Pratyantardasha** synchronized with **Jupiter in your 10th house (33 SAV)**, today brings crisp executive clarity. Conversations that felt slightly circular earlier in the month click cleanly into focus when you lead with concise written points.

### Work, Decisions & Timing
- Use morning hours for scope definition, client proposals, or strategic writing.
- Review fine print calmly before afternoon commitments — Venus in your 2nd house supports respectful negotiation.

### Heart & Relationships
Lead with unhurried listening tonight. Sharing one honest reflection rather than offering instant solutions deepens warmth effortlessly.

### Practical Grounding Focus
Close one open strategic decision cleanly before sunset instead of starting three parallel threads.`,
    };
  }

  if (slug === 'birth-chart-breakdown') {
    const topicLabel = String(inputs?.topicLabel || 'Natural Talents');
    return {
      slug,
      cacheHit: true,
      cachedAt: nowIso,
      profileUsed,
      structured: null,
      markdown: `### ${topicLabel}
Anchored by **Virgo Lagna** and **Hasta Moon**, your chart combines tactile precision with clear strategic synthesis. Mercury as both 1st and 10th lord places intellect, language, and systems craftsmanship directly at the center of your public reputation.

### Verified Planetary Mechanics
- **Lagna & 10th Lord Mercury (Magha, 11H):** Translates specialized expertise into respected networks and executive counsel.
- **Amatyakaraka Saturn (5H Capricorn):** Adds uncommon endurance — you build credibility steadily rather than relying on short-lived momentum.
- **Navamsa (D9) Alignment:** Confirms that your sharpest capabilities mature substantially after age 30 as clarity replaces self-doubt.

### Practical Takeaway
Lean into work that rewards careful judgment and clear architecture rather than high-noise reactive environments.`,
    };
  }

  if (slug === 'love-compatibility') {
    const partnerName = String(inputs?.partnerName || 'Partner');
    return {
      slug,
      cacheHit: false,
      cachedAt: nowIso,
      profileUsed,
      markdown: `### Compatibility Overview & Core Chemistry
Between **Aarav** and **${partnerName}**, the dominant tone is **grounded mutual respect paired with complementary pacing**. Where one brings analytical steadiness and careful planning, the other contributes warmth and fresh perspective.

### Astrological & Moon/Venus Resonance
- **Emotional Language:** Both value reliability and sincerity over performative gestures. Trust deepens rapidly when small promises are kept consistently.
- **Communication Style:** Calm, honest dialogue resolves friction quickly; unspoken assumptions are the main avoidable blind spot.

### Three Practical Ways to Strengthen Trust
1. Name expectations around quiet recharge time openly so space is never misread as distance.
2. Keep logistics discussions separate from quality time together.
3. Revisit shared seasonal goals once a quarter so both feel genuinely aligned.`,
    };
  }

  if (slug === 'planet-strength-tester') {
    const planet = String(inputs?.planet || 'Sun');
    const score = Number(inputs?.totalScore || 15);
    return {
      slug,
      cacheHit: false,
      cachedAt: nowIso,
      profileUsed,
      markdown: `### Functional Status: Balanced & Expressive (${score}/20)
Your lived responses align closely with a constructively placed **${planet}** in your chart. Core expression is steady and conscious, with modest room to refine pacing under high-pressure weeks.

### How ${planet} Is Showing Up in Daily Life
- **Strengths:** Clear self-awareness, grounded follow-through, and dependable standards.
- **Watch-Outs:** Occasional perfectionism or taking on silent responsibility before asking for fair collaboration.

### Practical Harmonizers
1. Guard one uninterrupted weekly ritual that nourishes ${planet}’s primary life domain.
2. Notice early fatigue signals before pushing into over-correction.
3. Share clear boundaries early rather than waiting until pressure peaks.`,
    };
  }

  if (slug === 'soul-compass' || slug === 'cosmic-archetype') {
    return {
      slug,
      cacheHit: true,
      cachedAt: nowIso,
      profileUsed,
      structured: {
        eyebrow: 'Aarav Mehta · Core Sidereal Signature',
        headline:
          slug === 'soul-compass'
            ? 'Nodal Axis & Dharma Compass'
            : 'Virgo Lagna · Hasta Moon',
        metrics: [
          { label: 'Ascendant (Lagna)', value: 'Virgo', hint: 'Uttara Phalguni Pada 3' },
          { label: 'Natal Moon', value: 'Virgo', hint: 'Hasta · House 1' },
          { label: 'Atmakaraka (AK)', value: 'Saturn', hint: 'Capricorn · Soul significator' },
          { label: 'Rahu / Ketu Axis', value: 'H5 / H11', hint: 'Capricorn ↔ Cancer' },
        ],
      },
      markdown:
        slug === 'soul-compass'
          ? `### Your Evolutionary Arc (Ketu to Rahu)
Ketu in your 11th house reflects natural mastery in collaborative circles and networks, while Rahu in the 5th house invites you toward original creative authorship, independent conviction, and visible leadership.

### Atmakaraka & Core Life Lesson
With Saturn as Atmakaraka in Capricorn, enduring satisfaction arrives through craft, restraint, and building systems that outlast short-term noise.

### Living Your Compass Practically
1. Carve out dedicated time each week for original creative or strategic work that reflects your personal voice.
2. Trade perfectionistic hesitation for steady, principled iteration.`
          : `### Your Signature Archetype: The Quiet Architect
Virgo Lagna paired with Hasta Moon and Capricorn Saturn blends keen analytical discernment with steady long-range craftsmanship.

### How You Think, Feel & Decide
You prefer clear facts, calm pacing, and tangible outcomes — noticing small inconsistencies long before they surface publicly.

### Subtle Shadow Tendencies & Balance Keys
Watch for quietly carrying more operational load than necessary; explicit scope and unhurried rest keep your sharpest judgment clear.`,
    };
  }

  if (slug === 'jupiter-opportunities') {
    return {
      slug,
      cacheHit: true,
      cachedAt: nowIso,
      profileUsed,
      structured: {
        eyebrow: 'Aarav Mehta · Jupiter Expansion Telemetry',
        headline: 'Jupiter transiting Gemini (House 10)',
        metrics: [
          { label: 'Natal Jupiter', value: 'Gemini · H10', hint: 'Mrigashira · Digbala' },
          { label: 'Gochar Position', value: 'Gemini 16°11′', hint: 'House 10 · SAV 33 bindus' },
          { label: 'Active Dasha', value: 'Jupiter–Saturn', hint: 'Structured expansion window' },
        ],
      },
      markdown: `### Jupiter’s Current Role in Your Chart
Transiting Jupiter over your 10th house (with strong 33-bindu Ashtakavarga support) activates career visibility, credible alliances, and strategic advisory opportunities.

### Where Expansion Naturally Opens Next
- **Leadership & Craft:** Roles rewarding deep synthesis, teaching, or architectural judgment gain clear traction.
- **Mentorship & Network:** Trusted senior voices accelerate decisions that previously felt stalled.

### Turning Good Timing Into Real Results
Document flagship outcomes now and proactively initiate two high-trust conversations each month during this cycle.`,
    };
  }

  return {
    slug,
    cacheHit: false,
    cachedAt: nowIso,
    profileUsed,
    markdown: `### Observatory Reading for Aarav Mehta
This sample reading demonstrates Cosmic Council’s grounded editorial Mini-App format. Sign in to run personalized readings powered by your verified Sidereal chart, live Gochar transits, and Pythagorean calculations.

### Key Highlights
- **Clarity Over Clutter:** Structured, calm counsel grounded in exact planetary placements.
- **Zero Per-Run Friction:** Revisit cached briefs anytime or continue directly into Consultation Chat.`,
  };
}
