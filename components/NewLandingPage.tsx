import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  Compass,
  Eye,
  HeartHandshake,
  Layers,
  Menu,
  Orbit,
  RotateCcw,
  Scale,
  Sparkles,
  Sun,
  UserCheck,
  X,
} from 'lucide-react';
import type { Category, Currency, Product } from '../types';
import type { SanityArticleItem } from '../lib/sanity';
import FloatingScrollControls from './FloatingScrollControls';
import LandingBirthChartCard from './LandingBirthChartCard';
import ChartViewer from './app/ChartViewer';
import TarotCardSpread from './app/TarotCardSpread';
import type { DrawnTarotSpread } from '../lib/tarotDeck';
import PricingSection from './landing/PricingSection';
import {
  BIRTHCHART_CONTENT,
  CONSULTATION_CONTENT,
  type CompanionCarouselItem,
} from './landing/landingData';
import { FLAGSHIP_CONSULTATION_SCENARIOS } from './landing/flagshipTranscripts';
import { EditorialImage } from './landing/EditorialPrimitives';
import {
  PREVIEW_CHART_JSON,
  PREVIEW_DAILY_TRANSITS,
} from './app/previewFixtures';
import { CLIENT_MINI_APPS, renderMiniAppIcon } from './app/miniAppsClientData';
import { isConsultantCatalogEntryAllowed } from '../lib/companionV2Schema';
import guideVedicDevImg from '../src/assets/images/guide_vedic_dev_1795649705038.jpg';
import guideVedicNandiniImg from '../src/assets/images/guide_vedic_nandini_1795649705091.jpg';
import guideWesternMarcImg from '../src/assets/images/guide_western_marc_1795649706257.jpg';
import guideTarotAnanyaImg from '../src/assets/images/guide_tarot_ananya_1795649706141.jpg';
import guideTarotBellaImg from '../src/assets/images/guide_tarot_bella_1795649707930.jpg';
import guideAstroLunaImg from '../src/assets/images/guide_astro_luna_1795650264334.jpg';
import guideAstroVikramImg from '../src/assets/images/guide_astro_vikram_1795650264703.jpg';
import guideAstroSofiaImg from '../src/assets/images/guide_astro_sofia_1795650265131.jpg';
import guideAstroKaiImg from '../src/assets/images/guide_astro_kai_1795650265084.jpg';
import heroHumanCounselImg from '../src/assets/images/hero_human_counsel_1795581606668.jpg';
import heroHumanClarityImg from '../src/assets/images/hero_human_clarity_1795582208303.jpg';

interface NewLandingPageProps {
  currency?: Currency;
  setCurrency?: (c: Currency) => void;
  favorites?: string[];
  toggleFavorite?: (id: string) => void;
  activeCategory?: Category;
  setActiveCategory?: (cat: Category) => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  sortBy?: 'default' | 'price-asc' | 'price-desc';
  setSortBy?: (s: 'default' | 'price-asc' | 'price-desc') => void;
  showOnlyFavorites?: boolean;
  setShowOnlyFavorites?: (show: boolean) => void;
  sanityPosts?: SanityArticleItem[];
  onSelectProduct?: (product: Product) => void;
  onQuickOrder?: (packageName?: string) => void;
  onWhyUs?: () => void;
  onContact?: () => void;
  onPay?: () => void;
}

type RevealDirection = 'up' | 'down' | 'left' | 'right' | 'fade';

interface RevealProps {
  children: React.ReactNode;
  direction?: RevealDirection;
  delay?: number;
  className?: string;
}

const Reveal: React.FC<RevealProps> = ({
  children,
  direction = 'up',
  delay = 0,
  className = '',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  });

  useEffect(() => {
    if (visible) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.05, rootMargin: '0px 0px -24px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  const hiddenTransform: Record<RevealDirection, string> = {
    up: 'translate-y-5 opacity-0',
    down: '-translate-y-4 opacity-0',
    left: '-translate-x-6 opacity-0',
    right: 'translate-x-6 opacity-0',
    fade: 'opacity-0',
  };

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,opacity] motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100 ${
        visible ? 'translate-x-0 translate-y-0 opacity-100' : hiddenTransform[direction]
      } ${className}`}
    >
      {children}
    </div>
  );
};

const HERO_BULLET_POINTS = [
  'Holistic birth chart analysis with 600+ data points',
  'Cross verify using different traditions & techniques',
  'Never repeat your life story, context, events, goals',
  "Better understand your life's journey and purpose",
  'Fully private, secure & anonymous',
];

const PERSONAL_USE_CARDS = [
  {
    title: 'Your personal astrologer',
    description:
      "Chat just like you're chatting with your personal astrologer. Get genuine guidance for you and your loved ones on any topic.",
  },
  {
    title: 'Deep analysis',
    description:
      'Unlike human astrologers who are time and scope bound, AI takes your entire birth chart into consideration for every interpretation',
  },
  {
    title: 'Synthesized interpretations',
    description:
      'Get accurate, balanced predictions that are based on synthesized interpretations across different techniques, disciplines & planetary strengths',
  },
  {
    title: 'Ask follow ups freely',
    description:
      'Ask as many follow up questions, technical clarifications or remedial guidance as possible without worrying about time',
  },
  {
    title: 'Never repeat your story',
    description:
      'Your life story, birth chart, ongoing conversation, current life affairs & dilemmas are all saved - never having to repeat yourself',
  },
  {
    title: 'No fear mongering',
    description:
      'We understand the limits of astrology hence our AI is designed to show possibilities with confidence scoring and not give absolute verdicts',
  },
  {
    title: 'Learn astrology',
    description:
      "The 'Learning Mode' is designed for astrology enthusiasts and professionals to deepen your understanding and improve their skills.",
  },
  {
    title: 'Fully private & secure',
    description:
      'Except for your Birth Chart details, everything is encrypted. All your conversations are fully private & secured',
  },
  {
    title: 'No monthly fees',
    description:
      'Unlike most apps charging monthly subscription, VedicAstro does not charge you a fixed fees. You only pay for what you use',
  },
] as const;

const PROFESSIONAL_USE_CARDS = [
  {
    title: 'Refine your analysis',
    description:
      'VedicAstro can help you refine your own analysis, score planetary combinations and get deeper technical understanding of any chart',
  },
  {
    title: '600+ Data points',
    description:
      'Have the most advanced birth chart breakdown, use them as you like - answer complex questions, discover unseen patterns',
  },
  {
    title: 'Client satisfaction',
    description:
      'Always have your clients life story, historical analysis, current affairs, challenges, family history & notes in one place',
  },
  {
    title: 'Client management',
    description:
      'Save hundreds of profiles with all historical data, add notes for each client, easily search and switch between profiles',
  },
  {
    title: 'Add your own formulas',
    description:
      'Add your own custom prompts, formulas & and logic making each analysis based around your signature style',
  },
  {
    title: 'Important date tracker',
    description:
      'Add reminders for important dates, dasha and transit changes and follow ups for your clients',
  },
  {
    title: 'Generate reports quickly',
    description:
      'Setup your own reports generator based on your personal logic, using your own prompts and output style',
  },
  {
    title: 'Your data is completely yours',
    description:
      'All your analysis, conversations, custom prompts, historical data are not only private but you can export them in one click',
  },
  {
    title: 'Just $29/month',
    description:
      'For a flat monthly fee, save upto 100 profiles, with 5GB of storage. Bring all your analysis, reporting, question & answer in one place.',
  },
] as const;

const METHODOLOGY_CARDS = [
  {
    id: 'vedic_astrologer',
    title: 'Vedic Astrologer',
    description:
      'Complete Jyotish synthesis across Parashari, KP Sub-Lords, Jaimini, Nadi & Vargas.',
    icon: Compass,
  },
  {
    id: 'kp_precision',
    title: 'KP Astrology',
    description:
      'Krishnamurti Paddhati cuspal Sub-Lords, house significator chains & Ruling Planets.',
    icon: Layers,
  },
  {
    id: 'jaimini',
    title: 'Jaimini Jyotish',
    description:
      'Chara Karakas, Karakamsha, Arudha Padas, Argala & Chara Dasha timing.',
    icon: Compass,
  },
  {
    id: 'western_astrologer',
    title: 'Western Astrologer',
    description:
      'Tropical Zodiac, Placidus houses, planetary aspects, progressions & transits.',
    icon: Orbit,
  },
  {
    id: 'hellenistic_astrologer',
    title: 'Hellenistic Astrologer',
    description:
      'Whole Sign houses, Sect, Hermetic Lots, Egyptian Bounds & Annual Profections.',
    icon: Sun,
  },
  {
    id: 'modern_astrologer',
    title: 'Modern Astrology',
    description:
      'Psychological & evolutionary astrology for repeating patterns, clarity & growth.',
    icon: Sparkles,
  },
] as const;

const AI_ADVANTAGE_CARDS = [
  {
    number: '01',
    title: 'The whole chart, not just its highlights',
    description:
      'A birth chart is an interconnected system. CosmicCouncil examines planetary placements, house lordships, aspects, divisional charts, strengths and combinations together, rather than interpreting individual placements in isolation.',
  },
  {
    number: '02',
    title: 'Every promise examined',
    description:
      'A favourable yoga does not necessarily produce favourable results. CosmicCouncil examines chart promises against cancellations, afflictions, planetary weaknesses and other modifying influences before synthesising an interpretation.',
  },
  {
    number: '03',
    title: 'Beyond a single school of astrology',
    description:
      'Explore your chart through Parashari, KP, Jaimini, Western, Hellenistic and Modern astrology. Understand where different methodologies agree, where they differ and what each brings to the interpretation.',
  },
  {
    number: '04',
    title: 'Intelligent synthesis, not isolated predictions',
    description:
      'Hundreds of individual astrological observations are brought together into a coherent interpretation, considering how different influences reinforce, contradict or modify one another.',
  },
  {
    number: '05',
    title: 'Strengths and weaknesses evaluated systematically',
    description:
      'Through multi-step scoring, ranking and evaluation, CosmicCouncil examines the relative strengths of planets, houses and combinations rather than treating every astrological indicator as equally significant.',
  },
  {
    number: '06',
    title: 'Your chart across the timeline of your life',
    description:
      'Explore past experiences, recurring life themes and upcoming planetary periods together. Examine how different phases of your life relate to traditional astrological timing frameworks.',
  },
] as const;

const AiAdvantageIcon: React.FC<{ index: number }> = ({ index }) => {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.45,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'h-[18px] w-[18px]',
    'aria-hidden': true,
  };

  switch (index) {
    case 0:
      // Layered interconnected chart system
      return (
        <svg {...commonProps}>
          <rect x="4" y="6" width="16" height="12" rx="2.5" />
          <path d="M4 10.5h16M8.5 14.5h7" strokeOpacity="0.8" />
        </svg>
      );
    case 1:
      // Scales balancing promises & cancellations
      return (
        <svg {...commonProps}>
          <path d="M12 4v15.5M8.5 19.5h7" />
          <path d="M5 8.5 12 6.5l7 2" />
          <path d="M5 8.5 3.3 13a2.2 2.2 0 0 0 3.4 0L5 8.5Z" />
          <path d="M19 8.5 17.3 13a2.2 2.2 0 0 0 3.4 0L19 8.5Z" />
        </svg>
      );
    case 2:
      // Multiple schools orbital nodes
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="6.5" strokeOpacity="0.75" />
          <circle cx="12" cy="12" r="2.1" />
          <circle cx="17.2" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="6.8" cy="16.5" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case 3:
      // Intelligent synthesis node graph
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="6.5" r="2" />
          <circle cx="7" cy="17" r="2" />
          <circle cx="17" cy="17" r="2" />
          <path d="M12 8.5v3.2M12 11.7 8 15.2M12 11.7l4 3.5" />
        </svg>
      );
    case 4:
      // Multi-step scoring bars
      return (
        <svg {...commonProps}>
          <path d="M6.5 18v-4.5M12 18V7.5M17.5 18v-7.5" />
          <path d="M4 19.5h16" strokeOpacity="0.4" />
        </svg>
      );
    default:
      // Life timeline calendar
      return (
        <svg {...commonProps}>
          <rect x="4" y="5.5" width="16" height="14" rx="2.2" />
          <path d="M8 3.8v3.2M16 3.8v3.2M4 9.5h16" />
          <path d="M8 13.2h3.5M8 16h6" strokeOpacity="0.8" />
        </svg>
      );
  }
};

interface SpiritualGuideMasonryItem extends CompanionCarouselItem {
  slug: string;
  companionGroup: 'spiritual_guides' | 'everyday_companions' | 'life_companions';
  aspectClass: string;
}

const SPIRITUAL_GUIDES_MASONRY: SpiritualGuideMasonryItem[] = [
  // Original Spiritual Guides
  {
    slug: 'dev',
    companionGroup: 'spiritual_guides',
    name: 'Dev',
    role: 'Vedic Astrology',
    imageUrl: guideVedicDevImg,
    alt: 'Dev — Vedic Astrology portrait',
    aspectClass: 'aspect-[3/4]',
    imgClassName: 'object-center',
  },
  {
    slug: 'nandini',
    companionGroup: 'spiritual_guides',
    name: 'Nandini',
    role: 'Vedic Astrology',
    imageUrl: guideVedicNandiniImg,
    alt: 'Nandini — Vedic Astrology portrait',
    aspectClass: 'aspect-[2/3]',
    imgClassName: 'object-top',
  },
  {
    slug: 'marc',
    companionGroup: 'spiritual_guides',
    name: 'Marc',
    role: 'Western Astrology',
    imageUrl: guideWesternMarcImg,
    alt: 'Marc — Western Astrology portrait',
    aspectClass: 'aspect-[4/5]',
    imgClassName: 'object-top',
  },
  {
    slug: 'kavya',
    companionGroup: 'spiritual_guides',
    name: 'Kavya',
    role: 'Evolutionary Astrology',
    imageUrl: '/assets/landing/guide-kavya.jpg',
    alt: 'Kavya — Evolutionary Astrology portrait',
    aspectClass: 'aspect-[3/4]',
    imgClassName: 'object-top',
  },
  {
    slug: 'ananya',
    companionGroup: 'spiritual_guides',
    name: 'Ananya',
    role: 'Tarot',
    imageUrl: guideTarotAnanyaImg,
    alt: 'Ananya — Tarot portrait',
    aspectClass: 'aspect-[3/4]',
    imgClassName: 'object-center',
  },
  // Additional Astrology & Tarot Guides
  {
    slug: 'tara',
    companionGroup: 'spiritual_guides',
    name: 'Tara',
    role: 'Western Astrology',
    imageUrl: '/assets/aistudio/image_81038a2a.png',
    alt: 'Tara — Western Astrology portrait',
    aspectClass: 'aspect-square',
    imgClassName: 'object-[50%_20%]',
  },
  {
    slug: 'bella',
    companionGroup: 'spiritual_guides',
    name: 'Bella',
    role: 'Tarot',
    imageUrl: guideTarotBellaImg,
    alt: 'Bella — Tarot portrait',
    aspectClass: 'aspect-[4/5]',
    imgClassName: 'object-top',
  },
  {
    slug: 'luna',
    companionGroup: 'spiritual_guides',
    name: 'Luna',
    role: 'Western Astrology · Love & Synastry',
    imageUrl: guideAstroLunaImg,
    alt: 'Luna — Western Astrology portrait',
    aspectClass: 'aspect-[3/4]',
    imgClassName: 'object-top',
  },
  {
    slug: 'vikram',
    companionGroup: 'spiritual_guides',
    name: 'Vikram',
    role: 'Vedic Astrology · Dharma & Karma',
    imageUrl: guideAstroVikramImg,
    alt: 'Vikram — Vedic Astrology portrait',
    aspectClass: 'aspect-[2/3]',
    imgClassName: 'object-top',
  },
  {
    slug: 'sofia',
    companionGroup: 'spiritual_guides',
    name: 'Sofia',
    role: 'Evolutionary Astrology',
    imageUrl: guideAstroSofiaImg,
    alt: 'Sofia — Evolutionary Astrology portrait',
    aspectClass: 'aspect-square',
    imgClassName: 'object-top',
  },
  {
    slug: 'kai',
    companionGroup: 'spiritual_guides',
    name: 'Kai',
    role: 'Numerology & Timing',
    imageUrl: guideAstroKaiImg,
    alt: 'Kai — Numerology & Timing portrait',
    aspectClass: 'aspect-[3/4]',
    imgClassName: 'object-top',
  },
  {
    slug: 'ines',
    companionGroup: 'spiritual_guides',
    name: 'Inés',
    role: 'Modern Astrology',
    imageUrl: '/assets/landing/astrologer-woman.jpg',
    alt: 'Inés — Modern Astrology portrait',
    aspectClass: 'aspect-[4/5]',
    imgClassName: 'object-top',
  },
  {
    slug: 'julian',
    companionGroup: 'spiritual_guides',
    name: 'Julian',
    role: 'Tarot · Crossroads & Clarity',
    imageUrl: '/assets/companions/julian.jpg',
    alt: 'Julian — Tarot portrait',
    aspectClass: 'aspect-square',
    imgClassName: 'object-top',
  },
  {
    slug: 'anya',
    companionGroup: 'spiritual_guides',
    name: 'Anya',
    role: 'Vedic Astrology · Karmic Patterns',
    imageUrl: '/assets/landing/dp-neha.jpg',
    alt: 'Anya — Vedic Astrology portrait',
    aspectClass: 'aspect-[4/5]',
    imgClassName: 'object-top',
  },
  {
    slug: 'samir',
    companionGroup: 'everyday_companions',
    name: 'Samir',
    role: 'Vedic & Everyday Counsel',
    imageUrl: '/assets/companions/samir.jpg',
    alt: 'Samir — Vedic & Everyday Counsel portrait',
    aspectClass: 'aspect-square',
    imgClassName: 'object-top',
  },
  {
    slug: 'omar',
    companionGroup: 'spiritual_guides',
    name: 'Omar',
    role: 'Spiritual Philosophy',
    imageUrl: '/assets/landing/astrologer-man.jpg',
    alt: 'Omar — Spiritual Philosophy portrait',
    aspectClass: 'aspect-[3/4]',
    imgClassName: 'object-top',
  },
  // Demo Chat Personalities
  {
    slug: 'ethan',
    companionGroup: 'everyday_companions',
    name: 'Ethan',
    role: 'Candid Friend',
    imageUrl: '/assets/landing/dp-lucas.jpg',
    alt: 'Ethan — Candid Friend portrait',
    aspectClass: 'aspect-[3/4]',
    imgClassName: 'object-top',
  },
  {
    slug: 'isla',
    companionGroup: 'life_companions',
    name: 'Isla',
    role: 'Love & Relationships',
    imageUrl: '/assets/landing/dp-isla.jpg',
    alt: 'Isla — Love & Relationships portrait',
    aspectClass: 'aspect-[4/5]',
    imgClassName: 'object-top',
  },
  {
    slug: 'nikhil',
    companionGroup: 'life_companions',
    name: 'Nikhil',
    role: 'Business & Entrepreneurship',
    imageUrl: '/assets/landing/dp-nikhil.jpg',
    alt: 'Nikhil — Business & Entrepreneurship portrait',
    aspectClass: 'aspect-[3/4]',
    imgClassName: 'object-top',
  },
  {
    slug: 'maya',
    companionGroup: 'everyday_companions',
    name: 'Maya',
    role: 'Wise Mentor',
    imageUrl: '/assets/companions/maya.jpg',
    alt: 'Maya — Wise Mentor portrait',
    aspectClass: 'aspect-square',
    imgClassName: 'object-top',
  },
  {
    slug: 'mira',
    companionGroup: 'everyday_companions',
    name: 'Mira',
    role: 'Listener',
    imageUrl: '/assets/landing/support-window.jpg',
    alt: 'Mira — Listener portrait',
    aspectClass: 'aspect-[4/5]',
    imgClassName: 'object-[42%_24%]',
  },
  {
    slug: 'sienna',
    companionGroup: 'life_companions',
    name: 'Sienna',
    role: 'Heartbreak',
    imageUrl: heroHumanClarityImg,
    alt: 'Sienna — Heartbreak companion portrait',
    aspectClass: 'aspect-[4/5]',
    imgClassName: 'object-[85%_22%]',
  },
  {
    slug: 'nora',
    companionGroup: 'everyday_companions',
    name: 'Nora',
    role: 'Calm & Overthinking',
    imageUrl: heroHumanCounselImg,
    alt: 'Nora — Calm & Overthinking companion portrait',
    aspectClass: 'aspect-[3/4]',
    imgClassName: 'object-[78%_22%]',
  },
  {
    slug: 'aira',
    companionGroup: 'everyday_companions',
    name: 'Aira',
    role: 'Everyday Companionship',
    imageUrl: '/assets/landing/dp-aira.jpg',
    alt: 'Aira — Everyday Companionship portrait',
    aspectClass: 'aspect-[4/5]',
    imgClassName: 'object-top',
  },
];

const ACTIVE_SPIRITUAL_GUIDES_MASONRY = SPIRITUAL_GUIDES_MASONRY.filter((guide) =>
  isConsultantCatalogEntryAllowed({
    slug: guide.slug,
    companion_group: guide.companionGroup,
  })
);

function shuffleGuideItems<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const LANDING_BENEFITS = [
  {
    title: 'An astrologer who knows your story',
    description:
      'Explore your chart with AI astrologers who understand your circumstances, aspirations, past experiences and ongoing challenges.',
  },
  {
    title: 'Go beyond surface-level interpretations',
    description:
      'Explore the deeper layers of your chart, examine conflicting planetary influences and understand the reasoning behind interpretations.',
  },
  {
    title: 'Conversations that evolve with you',
    description:
      'Build upon previous consultations as your circumstances change, without having to explain your life from the beginning every time.',
  },
  {
    title: 'One chart. Multiple perspectives.',
    description:
      'Examine the same questions through different astrological traditions, comparing interpretations and discovering where they converge or differ.',
  },
  {
    title: 'Understand your changing life phases',
    description:
      'Explore planetary periods, upcoming transits and traditional timing techniques in the context of your personal circumstances.',
  },
  {
    title: 'Question, challenge and explore',
    description:
      "Never settle for an interpretation you don't understand. Ask for explanations, examine alternative possibilities and explore further.",
  },
  {
    title: 'Astrology without fear',
    description:
      'Explore challenging planetary influences without alarming predictions, fatalistic interpretations or unnecessary anxiety.',
  },
  {
    title: 'Discuss what truly matters to you',
    description:
      'Explore sensitive questions about relationships, ambitions, disappointments and personal struggles at your own pace.',
  },
  {
    title: 'Make astrology part of everyday life',
    description:
      'Explore personalised daily horoscopes, current planetary influences and their traditional significance beyond generic zodiac forecasts.',
  },
  {
    title: 'Look beyond a single planetary placement',
    description:
      'Consider planetary strengths, supporting combinations, afflictions and modifying influences before drawing conclusions.',
  },
  {
    title: 'Explore possibilities, not predetermined outcomes',
    description:
      'Use astrology as a framework for understanding possibilities while retaining the freedom to make your own decisions.',
  },
  {
    title: 'No pressure to finish the conversation',
    description:
      'Take your time, reflect on an interpretation and return with new questions whenever you wish to explore further.',
  },
] as const;

const COMPARISON_METRICS = [
  { value: '600+', label: 'Astrological data points' },
  { value: '6', label: 'Astrological methodologies' },
  { value: '24/7', label: 'Personal consultations' },
] as const;

const COMPARISON_ROWS = [
  {
    capability: 'Depth of analysis',
    icon: Layers,
    conventional: 'Often prioritises the most prominent chart indicators within the available time.',
    cosmicCouncil: 'Examines hundreds of interconnected chart indicators.',
  },
  {
    capability: 'Astrological knowledge',
    icon: BookOpen,
    conventional: "Depends on the astrologer's training, experience and specialisation.",
    cosmicCouncil: 'Draws upon multiple supported astrological traditions and techniques.',
  },
  {
    capability: 'Conflicting influences',
    icon: Scale,
    conventional: 'Requires considerable manual examination.',
    cosmicCouncil: 'Evaluates supporting, opposing and modifying influences together.',
  },
  {
    capability: 'Chart promises',
    icon: Sparkles,
    conventional: 'May focus on prominent yogas and combinations.',
    cosmicCouncil: 'Examines combinations alongside cancellations, afflictions and planetary condition.',
  },
  {
    capability: 'Planetary evaluation',
    icon: BarChart3,
    conventional: "Depends on the practitioner's preferred assessment methods.",
    cosmicCouncil: 'Multi-step scoring, ranking and evaluation of planetary and house strengths.',
  },
  {
    capability: 'Timing analysis',
    icon: CalendarClock,
    conventional: 'Typically focuses on selected planetary periods and transits.',
    cosmicCouncil: 'Explores multiple timing techniques alongside the underlying chart.',
  },
  {
    capability: 'Consistency',
    icon: Compass,
    conventional: 'Interpretations can vary between practitioners and sessions.',
    cosmicCouncil: 'Standardised calculations and analytical frameworks.',
  },
  {
    capability: 'Transparency',
    icon: Eye,
    conventional: 'The reasoning behind an interpretation may not always be explained.',
    cosmicCouncil: 'Ask how an interpretation was reached and examine its supporting indicators.',
  },
  {
    capability: 'Personal context',
    icon: UserCheck,
    conventional: 'Depends on the information shared and retained during consultations.',
    cosmicCouncil: 'Builds upon your chart, shared circumstances and previous conversations.',
  },
  {
    capability: 'Consultation duration',
    icon: Clock,
    conventional: 'Usually limited to a scheduled appointment.',
    cosmicCouncil: 'Explore questions at your own pace and return whenever needed.',
  },
  {
    capability: 'Different perspectives',
    icon: Orbit,
    conventional: 'May require consulting several astrologers.',
    cosmicCouncil: 'Explore different supported methodologies within one platform.',
  },
  {
    capability: 'Human understanding',
    icon: HeartHandshake,
    conventional: 'Personal intuition, lived experience and genuine human connection.',
    cosmicCouncil: 'Context-aware AI conversations, without human lived experience.',
  },
] as const;

type ObjectionComparisonTabId = 'human' | 'ai' | 'apps' | 'paid';

interface ObjectionComparisonTab {
  id: ObjectionComparisonTabId;
  tabLabel: string;
  menuLabel: string;
  heading: string;
  intro: string;
  competitorColumnLabel: string;
  rows: ReadonlyArray<{
    capability: string;
    competitor: string;
    cosmicCouncil: string;
  }>;
}

const OBJECTION_COMPARISON_TABS: readonly ObjectionComparisonTab[] = [
  {
    id: 'human',
    tabLabel: 'Human astrologers',
    menuLabel: 'Human vs AI Astrology',
    heading: 'Beyond the limits of a single consultation.',
    intro:
      'Human astrologers bring experience, intuition and personal understanding. CosmicCouncil offers a different approach through systematic analysis, methodological breadth and ongoing access.',
    competitorColumnLabel: 'Human astrologer',
    rows: [
      {
        capability: 'Analytical coverage',
        competitor: 'Depends on preparation, time and methodology',
        cosmicCouncil: 'Hundreds of interconnected chart indicators',
      },
      {
        capability: 'Astrological traditions',
        competitor: 'Depends on individual expertise',
        cosmicCouncil: 'Multiple supported astrological systems',
      },
      {
        capability: 'Conflicting influences',
        competitor: 'Manual evaluation',
        cosmicCouncil: 'Systematic examination of modifying influences',
      },
      {
        capability: 'Consultation duration',
        competitor: 'Typically appointment-based',
        cosmicCouncil: 'Explore at your own pace',
      },
      {
        capability: 'Follow-up questions',
        competitor: 'May require another consultation',
        cosmicCouncil: 'Return to previous conversations',
      },
      {
        capability: 'Personal context',
        competitor: 'Depends on practitioner records and familiarity',
        cosmicCouncil: 'Build upon your chart and shared context',
      },
      {
        capability: 'Interpretive reasoning',
        competitor: "Depends on the practitioner's approach",
        cosmicCouncil: 'Request explanations and supporting indicators',
      },
      {
        capability: 'Human experience',
        competitor: 'Genuine lived experience and intuition',
        cosmicCouncil: 'AI interpretation without lived experience',
      },
    ],
  },
  {
    id: 'ai',
    tabLabel: 'ChatGPT & Claude',
    menuLabel: 'ChatGPT vs CosmicCouncil',
    heading: 'More than a general-purpose AI reading.',
    intro:
      'General-purpose AI can discuss astrological concepts. CosmicCouncil is designed around dedicated chart calculations, structured astrological data and specialised interpretation workflows.',
    competitorColumnLabel: 'General-purpose AI',
    rows: [
      {
        capability: 'Birth chart calculations',
        competitor: 'Requires reliable data, tools or integrations',
        cosmicCouncil: 'Dedicated astrological calculation architecture',
      },
      {
        capability: 'Astrological data',
        competitor: 'Depends on supplied or retrieved information',
        cosmicCouncil: 'Structured chart data available to the AI',
      },
      {
        capability: 'Divisional charts',
        competitor: 'May require external calculations',
        cosmicCouncil: 'Integrated supported divisional charts',
      },
      {
        capability: 'Planetary strengths',
        competitor: 'Depends on available data and tools',
        cosmicCouncil: 'Dedicated strength evaluation',
      },
      {
        capability: 'Timing systems',
        competitor: 'Requires appropriate data and calculation methods',
        cosmicCouncil: 'Integrated supported timing systems',
      },
      {
        capability: 'Analytical workflow',
        competitor: 'General-purpose reasoning',
        cosmicCouncil: 'Astrology-specific analytical frameworks',
      },
      {
        capability: 'Chart management',
        competitor: 'General conversation or file organisation',
        cosmicCouncil: 'Dedicated birth chart profiles',
      },
      {
        capability: 'AI specialisation',
        competitor: 'Broad general-purpose capabilities',
        cosmicCouncil: 'Astrology-focused consultation experience',
      },
    ],
  },
  {
    id: 'apps',
    tabLabel: 'Astrology apps',
    menuLabel: 'Astrology Apps vs CosmicCouncil',
    heading: 'Go beyond knowing where your planets are.',
    intro:
      'Conventional chart applications are valuable for generating and displaying astrological information. CosmicCouncil brings chart exploration and interactive interpretation into one workspace.',
    competitorColumnLabel: 'Chart-focused apps',
    rows: [
      {
        capability: 'Birth chart generation',
        competitor: 'Core functionality',
        cosmicCouncil: 'Integrated chart generation',
      },
      {
        capability: 'Planetary placements',
        competitor: 'Displayed in charts and tables',
        cosmicCouncil: 'Available for interactive exploration',
      },
      {
        capability: 'Interpretations',
        competitor: 'Often predefined or placement-based',
        cosmicCouncil: 'Contextual AI-generated interpretations',
      },
      {
        capability: 'Follow-up questions',
        competitor: 'Varies by application',
        cosmicCouncil: 'Conversational exploration',
      },
      {
        capability: 'Conflicting influences',
        competitor: 'May require manual interpretation',
        cosmicCouncil: 'Combined analytical exploration',
      },
      {
        capability: 'Methodology comparison',
        competitor: 'Depends on supported systems',
        cosmicCouncil: 'Multiple supported traditions',
      },
      {
        capability: 'Personal circumstances',
        competitor: 'Often limited to birth information',
        cosmicCouncil: 'Discuss actual circumstances and experiences',
      },
      {
        capability: 'Professional tools',
        competitor: 'Varies considerably',
        cosmicCouncil: 'Integrated analytical workspace',
      },
    ],
  },
  {
    id: 'paid',
    tabLabel: 'Paid consultations',
    menuLabel: 'Paid Consultations vs CosmicCouncil',
    heading: 'Make your astrology budget go further.',
    intro:
      'An individual consultation provides access to a practitioner for a particular session. A CosmicCouncil membership provides ongoing access to a wider collection of astrological capabilities, subject to plan limits.',
    competitorColumnLabel: 'Pay-per-consultation',
    rows: [
      {
        capability: 'Payment model',
        competitor: 'Typically per appointment',
        cosmicCouncil: 'Membership with included usage',
      },
      {
        capability: 'Follow-up questions',
        competitor: 'May incur additional fees',
        cosmicCouncil: 'Use included membership allowance',
      },
      {
        capability: 'Different life topics',
        competitor: 'Discuss within the booked session',
        cosmicCouncil: 'Explore multiple topics over time',
      },
      {
        capability: 'Chart analysis',
        competitor: 'Depends on consultation package',
        cosmicCouncil: 'Access dedicated analysis tools',
      },
      {
        capability: 'Different methodologies',
        competitor: 'May require separate practitioners',
        cosmicCouncil: 'Explore supported traditions',
      },
      {
        capability: 'Daily exploration',
        competitor: 'Usually not included',
        cosmicCouncil: 'Access supported daily astrology features',
      },
      {
        capability: 'Conversation history',
        competitor: 'Depends on service',
        cosmicCouncil: 'Revisit saved conversations',
      },
      {
        capability: 'Additional profiles',
        competitor: 'May require separate readings',
        cosmicCouncil: 'Subject to membership profile allowance',
      },
    ],
  },
];

const ConsultationBenefitIcon: React.FC<{ index: number }> = ({ index }) => {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.55,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'h-[18px] w-[18px]',
    'aria-hidden': true,
  };

  switch (index) {
    case 0:
      // User profile
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8.5" r="3.2" />
          <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
        </svg>
      );
    case 1:
      // Layered archive / depth
      return (
        <svg {...commonProps}>
          <rect x="4" y="6" width="16" height="12" rx="2.5" />
          <path d="M4 10.5h16M8.5 14.5h7" strokeOpacity="0.8" />
        </svg>
      );
    case 2:
      // Evolving conversations (dual speech bubbles)
      return (
        <svg {...commonProps}>
          <path d="M4.5 7.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H9l-3 2.5V13.5a2 2 0 0 1-1.5-2v-4Z" />
          <path d="M16.5 10.5h1a2 2 0 0 1 2 2v3.5a2 2 0 0 1-1 1.7l-1.5 1.3v-1.5h-4.5a1.5 1.5 0 0 1-1.5-1.5" strokeOpacity="0.7" />
        </svg>
      );
    case 3:
      // Multiple perspectives (orbital nodes)
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="6.5" strokeOpacity="0.75" />
          <circle cx="12" cy="12" r="2.1" />
          <circle cx="17.2" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="6.8" cy="16.5" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case 4:
      // Changing life phases (calendar + timing clock)
      return (
        <svg {...commonProps}>
          <rect x="4" y="5.5" width="16" height="14" rx="2.2" />
          <path d="M8 3.8v3.2M16 3.8v3.2M4 9.5h16" />
          <circle cx="14.5" cy="14.5" r="2.7" strokeOpacity="0.85" />
          <path d="M14.5 13.4v1.2l.8.6" strokeOpacity="0.85" />
        </svg>
      );
    case 5:
      // Question, challenge & explore (magnifying glass)
      return (
        <svg {...commonProps}>
          <circle cx="10.8" cy="10.8" r="5.8" />
          <path d="m15.2 15.2 4.3 4.3" />
        </svg>
      );
    case 6:
      // Astrology without fear (shield check)
      return (
        <svg {...commonProps}>
          <path d="M12 3.8 18.5 6.5v5.3c0 4.2-2.7 7.4-6.5 8.7-3.8-1.3-6.5-4.5-6.5-8.7V6.5L12 3.8Z" />
          <path d="m9.5 12 1.8 1.8 3.4-3.6" />
        </svg>
      );
    case 7:
      // Private / sensitive matters (padlock)
      return (
        <svg {...commonProps}>
          <rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2" />
          <path d="M8.5 10.5V7.8a3.5 3.5 0 1 1 7 0v2.7" />
          <circle cx="12" cy="15.2" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 8:
      // Everyday life (sun)
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="3.6" />
          <path d="M12 3.8v2.1M12 18.1v2.1M3.8 12h2.1M18.1 12h2.1M6.2 6.2l1.5 1.5M16.3 16.3l1.5 1.5M17.8 6.2l-1.5 1.5M7.7 16.3l-1.5 1.5" />
        </svg>
      );
    case 9:
      // Connected placements (network nodes)
      return (
        <svg {...commonProps}>
          <circle cx="7" cy="7" r="2.2" />
          <circle cx="17" cy="17" r="2.2" />
          <path d="M9.2 7h3.3a2.5 2.5 0 0 1 2.5 2.5v2M14.8 17h-3.3A2.5 2.5 0 0 1 9 14.5v-2" />
          <circle cx="17" cy="7" r="1.4" strokeOpacity="0.65" />
        </svg>
      );
    case 10:
      // Possibilities / compass
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8.5" />
          <polygon points="14.8 9.2 13.1 13.1 9.2 14.8 10.9 10.9 14.8 9.2" />
        </svg>
      );
    default:
      // Unhurried conversation (clock)
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5v4.8l3.2 1.9" />
        </svg>
      );
  }
};

const TAROT_CUSTOM_CARD_MEANINGS: Record<number, string> = {
  0: 'Eight of Pentacles · You have been putting in steady, quiet effort—you have built more solid ground here than it feels like right now.',
  1: 'XVII · The Star · A calm clearing after mental fatigue. Hope feels quieter and steadier when you stop forcing an immediate leap.',
  2: 'Ace of Wands · A fresh creative spark is ready to test on one small, low-risk step before making any big commitment.',
};

const TAROT_REVERSED_THIRD_CARD_MEANING =
  'Ace of Wands (Reversed) · You already feel ready for something new, even if timing or confidence feels a little hesitant right now. Try one quiet step first instead of forcing a huge change.';

const NewLandingPage: React.FC<NewLandingPageProps> = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openNavDropdown, setOpenNavDropdown] = useState<'products' | 'compare' | null>(null);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const [mobileComparisonOpen, setMobileComparisonOpen] = useState(false);
  const [activeComparisonTab, setActiveComparisonTab] =
    useState<ObjectionComparisonTabId>('human');
  const navRef = useRef<HTMLElement>(null);
  const closeDropdownTimerRef = useRef<number | null>(null);

  // Spiritual Guides Masonry — randomized once per page refresh, paginated 9 at a time
  const [shuffledGuides] = useState<SpiritualGuideMasonryItem[]>(() =>
    shuffleGuideItems(ACTIVE_SPIRITUAL_GUIDES_MASONRY)
  );
  const [visibleGuideCount, setVisibleGuideCount] = useState<number>(9);
  const [masonryCols, setMasonryCols] = useState<number>(() => {
    if (typeof window === 'undefined') return 3;
    return window.innerWidth >= 1024 ? 3 : 2;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const updateCols = () => setMasonryCols(mq.matches ? 3 : 2);
    updateCols();
    mq.addEventListener('change', updateCols);
    return () => mq.removeEventListener('change', updateCols);
  }, []);

  useEffect(() => {
    return () => {
      if (closeDropdownTimerRef.current !== null) {
        window.clearTimeout(closeDropdownTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!openNavDropdown) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenNavDropdown(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenNavDropdown(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openNavDropdown]);

  const handleDropdownMouseEnter = (dropdown: 'products' | 'compare') => {
    if (closeDropdownTimerRef.current !== null) {
      window.clearTimeout(closeDropdownTimerRef.current);
      closeDropdownTimerRef.current = null;
    }
    setOpenNavDropdown(dropdown);
  };

  const handleDropdownMouseLeave = (dropdown: 'products' | 'compare') => {
    if (closeDropdownTimerRef.current !== null) {
      window.clearTimeout(closeDropdownTimerRef.current);
    }
    closeDropdownTimerRef.current = window.setTimeout(() => {
      setOpenNavDropdown((prev) => (prev === dropdown ? null : prev));
      closeDropdownTimerRef.current = null;
    }, 120);
  };

  const visibleGuides = useMemo(
    () => shuffledGuides.slice(0, visibleGuideCount),
    [shuffledGuides, visibleGuideCount]
  );

  const masonryColumns = useMemo(() => {
    const cols: SpiritualGuideMasonryItem[][] = Array.from({ length: masonryCols }, () => []);
    visibleGuides.forEach((guide, idx) => {
      cols[idx % masonryCols].push(guide);
    });
    return cols;
  }, [visibleGuides, masonryCols]);

  // Interactive Showcase State
  const [useCaseMode, setUseCaseMode] = useState<'personal' | 'professional'>('personal');
  const [consultationTabId, setConsultationTabId] = useState<string>(
    FLAGSHIP_CONSULTATION_SCENARIOS[0].id
  );
  const [previewReversed, setPreviewReversed] = useState<boolean>(false);
  const consultationScrollRef = useRef<HTMLDivElement>(null);

  const isTarotConsultation = consultationTabId === 'tarot-chat';

  const activeConsultation = useMemo(
    () =>
      FLAGSHIP_CONSULTATION_SCENARIOS.find((s) => s.id === consultationTabId) ||
      FLAGSHIP_CONSULTATION_SCENARIOS[0],
    [consultationTabId]
  );

  const activeObjectionComparison = useMemo(
    () =>
      OBJECTION_COMPARISON_TABS.find((tab) => tab.id === activeComparisonTab) ||
      OBJECTION_COMPARISON_TABS[0],
    [activeComparisonTab]
  );

  const landingSpread = useMemo<DrawnTarotSpread>(
    () => ({
      spreadName: '3-Card Clarity Spread',
      cards: [
        {
          position: '1. Root Influence',
          card: 'Eight of Pentacles',
          orientation: 'Upright',
          arcana: 'Minor',
        },
        {
          position: '2. Present Energy',
          card: 'XVII · The Star',
          orientation: 'Upright',
          arcana: 'Major',
        },
        {
          position: '3. Next Movement',
          card: 'Ace of Wands',
          orientation: previewReversed ? 'Reversed' : 'Upright',
          arcana: 'Minor',
        },
      ],
    }),
    [previewReversed]
  );

  const tarotCustomMeanings = useMemo<Record<number, string>>(
    () => ({
      ...TAROT_CUSTOM_CARD_MEANINGS,
      2: previewReversed ? TAROT_REVERSED_THIRD_CARD_MEANING : TAROT_CUSTOM_CARD_MEANINGS[2],
    }),
    [previewReversed]
  );

  useEffect(() => {
    if (consultationScrollRef.current) consultationScrollRef.current.scrollTop = 0;
  }, [consultationTabId]);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    setMobileProductsOpen(false);
    setMobileComparisonOpen(false);
    setOpenNavDropdown(null);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectComparisonOption = (tabId: ObjectionComparisonTabId) => {
    setActiveComparisonTab(tabId);
    setOpenNavDropdown(null);
    setMobileProductsOpen(false);
    setMobileComparisonOpen(false);
    setMobileMenuOpen(false);
    document.getElementById('why-cosmiccouncil-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#3D3830] font-['Plus_Jakarta_Sans',sans-serif] selection:bg-[#EAE3D7] flex flex-col overflow-x-clip">
      {/* Three-Zone Frosted Top Bar Contract */}
      <header className="fixed top-0 inset-x-0 z-40 w-full px-4 md:px-8 pt-4 animate-cc-slide-down">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-8 rounded-2xl bg-[#EAE3D7]/80 backdrop-blur-md px-5 py-3.5 border border-[#3D3830]/10">
          {/* Zone 1: Single-line Brand Wordmark */}
          <Link
            to="/"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="font-serif text-xl font-medium tracking-tight text-[#3D3830] whitespace-nowrap shrink-0 transition-opacity duration-200 hover:opacity-80"
          >
            Cosmic Council
          </Link>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav ref={navRef} className="hidden md:flex items-center gap-4 lg:gap-6">
            <Link
              to="/"
              onClick={() => {
                setOpenNavDropdown(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="text-sm font-medium text-[#3D3830] transition-colors duration-200 whitespace-nowrap shrink-0 py-1 border-b border-[#3D3830]/60"
            >
              Home
            </Link>
            <button
              type="button"
              onClick={() => scrollToSection('traditions-showcase')}
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors duration-200 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#3D3830]/40 cursor-pointer"
            >
              Methodologies
            </button>

            {/* Products Hover Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => handleDropdownMouseEnter('products')}
              onMouseLeave={() => handleDropdownMouseLeave('products')}
            >
              <button
                type="button"
                aria-expanded={openNavDropdown === 'products'}
                aria-haspopup="menu"
                onClick={() =>
                  setOpenNavDropdown((prev) => (prev === 'products' ? null : 'products'))
                }
                className={`inline-flex items-center gap-1 text-sm font-medium transition-colors duration-200 whitespace-nowrap shrink-0 py-1 border-b cursor-pointer ${
                  openNavDropdown === 'products'
                    ? 'text-[#3D3830] border-[#3D3830]/50'
                    : 'text-[#5C5449] hover:text-[#3D3830] border-transparent hover:border-[#3D3830]/40'
                }`}
              >
                <span>Products</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    openNavDropdown === 'products' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openNavDropdown === 'products' && (
                <div className="absolute left-0 top-full pt-2.5 z-50">
                  <div
                    role="menu"
                    aria-label="Products"
                    className="w-60 rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-1.5 shadow-[0_18px_40px_-14px_rgba(61,56,48,0.28)] animate-cc-drawer-in"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => scrollToSection('observatory-showcase')}
                      className="w-full text-left rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#5C5449] hover:bg-[#F1ECE3] hover:text-[#3D3830] transition-colors cursor-pointer block"
                    >
                      Birth Chart Analysis
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => scrollToSection('consultation')}
                      className="w-full text-left rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#5C5449] hover:bg-[#F1ECE3] hover:text-[#3D3830] transition-colors cursor-pointer block"
                    >
                      AI Consultations
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => scrollToSection('miniapps-showcase')}
                      className="w-full text-left rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#5C5449] hover:bg-[#F1ECE3] hover:text-[#3D3830] transition-colors cursor-pointer block"
                    >
                      Astrology Apps
                    </button>
                    <Link
                      to="/app/reports?preview=1"
                      role="menuitem"
                      onClick={() => setOpenNavDropdown(null)}
                      className="w-full text-left rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#5C5449] hover:bg-[#F1ECE3] hover:text-[#3D3830] transition-colors block"
                    >
                      Astrology Reports
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Compare Hover Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => handleDropdownMouseEnter('compare')}
              onMouseLeave={() => handleDropdownMouseLeave('compare')}
            >
              <button
                type="button"
                aria-expanded={openNavDropdown === 'compare'}
                aria-haspopup="menu"
                onClick={() =>
                  setOpenNavDropdown((prev) => (prev === 'compare' ? null : 'compare'))
                }
                className={`inline-flex items-center gap-1 text-sm font-medium transition-colors duration-200 whitespace-nowrap shrink-0 py-1 border-b cursor-pointer ${
                  openNavDropdown === 'compare'
                    ? 'text-[#3D3830] border-[#3D3830]/50'
                    : 'text-[#5C5449] hover:text-[#3D3830] border-transparent hover:border-[#3D3830]/40'
                }`}
              >
                <span>Compare</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    openNavDropdown === 'compare' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openNavDropdown === 'compare' && (
                <div className="absolute left-0 top-full pt-2.5 z-50">
                  <div
                    role="menu"
                    aria-label="Compare options"
                    className="w-72 rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-1.5 shadow-[0_18px_40px_-14px_rgba(61,56,48,0.28)] animate-cc-drawer-in"
                  >
                    {OBJECTION_COMPARISON_TABS.map((option) => {
                      const isSelected = activeComparisonTab === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="menuitem"
                          onClick={() => handleSelectComparisonOption(option.id)}
                          className={`w-full text-left rounded-xl px-3.5 py-2.5 text-xs font-medium transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-[#EAE3D7] text-[#3D3830]'
                              : 'text-[#5C5449] hover:bg-[#F1ECE3] hover:text-[#3D3830]'
                          }`}
                        >
                          <span>{option.menuLabel}</span>
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-[#8B7355]" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => scrollToSection('benefits')}
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors duration-200 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#3D3830]/40 cursor-pointer"
            >
              Benefits
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('pricing')}
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors duration-200 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#3D3830]/40 cursor-pointer"
            >
              Pricing
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('support')}
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors duration-200 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#3D3830]/40 cursor-pointer"
            >
              Support
            </button>
          </nav>

          {/* Zone 3: Single Primary Action + Mobile Drawer Toggle */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/app/login"
              className="group inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] transition-all duration-200 hover:bg-[#38342E] active:scale-[0.97] whitespace-nowrap shrink-0"
            >
              <span>Login</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>

            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden inline-flex items-center justify-center rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] p-2 text-[#3D3830] hover:bg-[#F1ECE3] active:scale-95 transition-all duration-200"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden mx-auto max-w-7xl mt-2 rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 shadow-lg space-y-4 animate-cc-drawer-in">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Link
                to="/"
                onClick={() => {
                  setMobileMenuOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                Home
              </Link>
              <button
                type="button"
                onClick={() => scrollToSection('traditions-showcase')}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                Methodologies
              </button>
              <button
                type="button"
                aria-expanded={mobileProductsOpen}
                onClick={() => setMobileProductsOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-left font-medium text-[#3D3830] py-1.5"
              >
                <span>Products</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    mobileProductsOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <button
                type="button"
                aria-expanded={mobileComparisonOpen}
                onClick={() => setMobileComparisonOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-left font-medium text-[#3D3830] py-1.5"
              >
                <span>Compare</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    mobileComparisonOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {mobileProductsOpen && (
                <div className="col-span-2 rounded-xl border border-[#3D3830]/10 bg-[#F1ECE3]/70 p-2 space-y-1">
                  <button
                    type="button"
                    onClick={() => scrollToSection('observatory-showcase')}
                    className="w-full text-left rounded-lg px-3 py-2 text-xs font-medium text-[#5C5449] hover:bg-[#FDFBF7]/70 hover:text-[#3D3830] transition-colors"
                  >
                    Birth Chart Analysis
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection('consultation')}
                    className="w-full text-left rounded-lg px-3 py-2 text-xs font-medium text-[#5C5449] hover:bg-[#FDFBF7]/70 hover:text-[#3D3830] transition-colors"
                  >
                    AI Consultations
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection('miniapps-showcase')}
                    className="w-full text-left rounded-lg px-3 py-2 text-xs font-medium text-[#5C5449] hover:bg-[#FDFBF7]/70 hover:text-[#3D3830] transition-colors"
                  >
                    Astrology Apps
                  </button>
                  <Link
                    to="/app/reports?preview=1"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block w-full text-left rounded-lg px-3 py-2 text-xs font-medium text-[#5C5449] hover:bg-[#FDFBF7]/70 hover:text-[#3D3830] transition-colors"
                  >
                    Astrology Reports
                  </Link>
                </div>
              )}

              {mobileComparisonOpen && (
                <div className="col-span-2 rounded-xl border border-[#3D3830]/10 bg-[#F1ECE3]/70 p-2 space-y-1">
                  {OBJECTION_COMPARISON_TABS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleSelectComparisonOption(option.id)}
                      className={`w-full text-left rounded-lg px-3 py-2 text-xs font-medium transition-colors flex items-center justify-between gap-2 ${
                        activeComparisonTab === option.id
                          ? 'bg-[#FDFBF7] text-[#3D3830]'
                          : 'text-[#5C5449] hover:bg-[#FDFBF7]/70 hover:text-[#3D3830]'
                      }`}
                    >
                      <span>{option.menuLabel}</span>
                      {activeComparisonTab === option.id && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-[#8B7355]" aria-hidden="true" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => scrollToSection('benefits')}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                Benefits
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('pricing')}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                Pricing
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('support')}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                Support
              </button>
              <Link
                to="/app/home?preview=1"
                onClick={() => setMobileMenuOpen(false)}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                Live preview
              </Link>
            </div>
            <div className="pt-3 border-t border-[#3D3830]/10 flex items-center gap-3">
              <Link
                to="/app/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 text-center rounded-full bg-[#4A453D] px-4 py-2.5 text-xs font-medium text-[#FAF7F2] active:scale-[0.98] transition-transform"
              >
                Login with Gmail
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* 1. TWO-COLUMN HERO SECTION */}
        <section
          id="hero-birth-chart"
          className="relative overflow-hidden bg-gradient-to-b from-[#EFE9DF] via-[#FAF7F2] to-[#FAF7F2]"
        >
          {/* Subtle Observatory Atmospheric Texture & Orbital Arcs */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  'radial-gradient(rgba(61, 56, 48, 0.11) 1px, transparent 1px)',
                backgroundSize: '26px 26px',
                maskImage:
                  'radial-gradient(ellipse 85% 65% at 50% 35%, #000 35%, transparent 100%)',
                WebkitMaskImage:
                  'radial-gradient(ellipse 85% 65% at 50% 35%, #000 35%, transparent 100%)',
              }}
            />
            <div
              className="absolute right-[10%] top-[42%] h-[480px] w-[620px] -translate-y-1/2 rounded-full blur-3xl"
              style={{
                background:
                  'radial-gradient(circle, rgba(184, 150, 90, 0.16) 0%, rgba(234, 227, 215, 0.25) 45%, transparent 75%)',
              }}
            />
            <svg
              viewBox="0 0 1440 760"
              fill="none"
              className="absolute left-1/2 top-0 h-[760px] w-[1440px] -translate-x-1/2 opacity-55"
            >
              <circle
                cx="720"
                cy="360"
                r="310"
                stroke="#3D3830"
                strokeOpacity="0.06"
                strokeWidth="1"
              />
              <circle
                cx="720"
                cy="360"
                r="470"
                stroke="#B8965A"
                strokeOpacity="0.14"
                strokeWidth="1"
                strokeDasharray="4 8"
              />
            </svg>
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-6 pt-36 pb-16 sm:pt-40 md:pt-44 md:pb-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
              {/* LEFT COLUMN: Exact User Headline, Description & Animated Line Cards */}
              <div className="lg:col-span-7 space-y-6">
                <div className="space-y-3.5 animate-cc-slide-up" style={{ animationDelay: '40ms' }}>
                  <p className="text-xs sm:text-[13px] font-medium uppercase tracking-[0.14em] text-[#8B7355]">
                    ANCIENT WISDOM. MODERN INTELLIGENCE.
                  </p>

                  <h1
                    className="font-['Cormorant_Garamond',serif] text-4xl sm:text-5xl md:text-[56px] font-medium text-[#3D3830] tracking-tight leading-[1.05]"
                    style={{ textWrap: 'balance' }}
                  >
                    Explore the deeper patterns of your life.
                  </h1>

                  <p className="max-w-xl text-base sm:text-lg text-[#5C5449] leading-relaxed">
                    Advanced birth chart analysis, multiple astrological traditions and personalised AI consultations.
                  </p>

                  {/* Mobile quick-jump to form */}
                  <div className="pt-1 lg:hidden">
                    <button
                      type="button"
                      onClick={() => scrollToSection('hero-chart-form-card')}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3D3830] underline underline-offset-4 cursor-pointer"
                    >
                      <span>Enter your birth details</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* 6 Premium Line Cards with Soft Sublime Sliding Animations */}
                <ul className="space-y-3 pt-2">
                  {HERO_BULLET_POINTS.map((point, idx) => (
                    <li key={point}>
                      <Reveal direction="left" delay={80 + idx * 60}>
                        <div className="group inline-flex w-fit max-w-full items-center gap-3.5 rounded-xl border border-[#3D3830]/16 bg-[#FDFBF7] px-5 py-3 shadow-[0_6px_18px_-10px_rgba(61,56,48,0.18)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:translate-x-1.5 hover:border-[#B8965A]/65 hover:shadow-[0_10px_24px_-10px_rgba(61,56,48,0.24)]">
                          <span
                            aria-hidden="true"
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EAE3D7] text-[#8B7355] transition-colors duration-300 group-hover:bg-[#4A453D] group-hover:text-[#FAF7F2]"
                          >
                            <Check className="h-3 w-3 stroke-[2.25]" />
                          </span>
                          <span className="text-[15px] sm:text-base font-medium text-[#3D3830] leading-snug">
                            {point}
                          </span>
                        </div>
                      </Reveal>
                    </li>
                  ))}
                </ul>

                <Reveal direction="up" delay={440}>
                  <div className="pt-2 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3.5">
                    <Link
                      to="/app/login"
                      className="group inline-flex min-h-[54px] items-center justify-center gap-3 rounded-full border border-[#3D3830]/25 bg-gradient-to-b from-[#EDE6DA] to-[#DFD5C5] px-7 py-3.5 text-[15px] font-medium text-[#3D3830] shadow-[0_10px_26px_-14px_rgba(61,56,48,0.28),inset_0_1px_0_rgba(255,255,255,0.55)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-[#B8965A]/80 hover:from-[#E7DFD1] hover:to-[#D6C9B5] hover:shadow-[0_14px_32px_-12px_rgba(61,56,48,0.32)] active:translate-y-0 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8965A] whitespace-nowrap"
                    >
                      <svg className="h-4 w-4 shrink-0 text-[#7A6245]" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                        />
                      </svg>
                      <span>Login with Gmail</span>
                      <ArrowRight className="h-4 w-4 text-[#7A6245] transition-transform duration-300 group-hover:translate-x-0.5" />
                    </Link>

                    <Link
                      to="/app/home?preview=1"
                      className="group inline-flex min-h-[54px] items-center justify-center gap-3 rounded-full border border-[#3D3830]/25 bg-gradient-to-b from-[#EDE6DA] to-[#DFD5C5] px-7 py-3.5 text-[15px] font-medium text-[#3D3830] shadow-[0_10px_26px_-14px_rgba(61,56,48,0.28),inset_0_1px_0_rgba(255,255,255,0.55)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-[#B8965A]/80 hover:from-[#E7DFD1] hover:to-[#D6C9B5] hover:shadow-[0_14px_32px_-12px_rgba(61,56,48,0.32)] active:translate-y-0 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8965A] whitespace-nowrap"
                    >
                      <Eye className="h-4 w-4 shrink-0 text-[#7A6245]" />
                      <span>Live Preview</span>
                      <ArrowRight className="h-4 w-4 text-[#7A6245] transition-transform duration-300 group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </Reveal>
              </div>

              {/* RIGHT COLUMN: Single-Page Birth Chart Form -> Inline Gmail Handoff + Live Preview */}
              <div
                id="hero-chart-form-card"
                className="lg:col-span-5 lg:sticky lg:top-24 space-y-4 animate-cc-slide-up"
                style={{ animationDelay: '160ms' }}
              >
                <LandingBirthChartCard variant="hero" />

                <div className="flex flex-wrap items-center justify-between gap-3 px-2">
                  <Link
                    to="/app/home?preview=1"
                    className="group inline-flex items-center gap-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5 text-[#8B7355]" />
                    <span className="underline underline-offset-4">Explore live preview</span>
                    <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>

                  <Link
                    to="/app/login"
                    className="text-xs text-[#8B8275] hover:text-[#3D3830] transition-colors"
                  >
                    Already have an account? Sign in
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 1A. 6 WAYS AI ASTROLOGY IS BETTER THAN HUMAN ASTROLOGY */}
        <section
          id="ai-advantage-section"
          className="bg-gradient-to-br from-[#1F2229] via-[#242832] to-[#292D36] text-[#F4EFE6] py-16 sm:py-20 lg:py-24 border-t border-[#3D3830]/15"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-6">
            <Reveal direction="up">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
                <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-28">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#B8965A]">
                    THE COSMICCOUNCIL ADVANTAGE
                  </p>
                  <h2
                    className="font-['Cormorant_Garamond',serif] text-[clamp(2rem,3.6vw,3rem)] font-medium leading-[1.08] text-[#F4EFE6]"
                    style={{ textWrap: 'balance' }}
                  >
                    The depth of astrology.
                    <br />
                    <span className="text-[#B8965A]">The power of AI.</span>
                  </h2>
                  <div className="h-px w-12 bg-[#B8965A]" aria-hidden="true" />
                  <p className="text-base sm:text-lg font-medium text-[#F4EFE6] leading-snug">
                    Traditional knowledge. Extraordinary analytical depth.
                  </p>
                  <p className="text-sm sm:text-base leading-[1.72] text-[#D2CBC0]">
                    Hundreds of astrological indicators. Multiple schools of interpretation. Complex planetary interactions. CosmicCouncil brings them together to offer a more comprehensive and deeply personal astrology experience.
                  </p>
                </div>

                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  {AI_ADVANTAGE_CARDS.map((item, idx) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 sm:p-6 flex flex-col items-start text-left space-y-3 transition-colors duration-200 hover:bg-white/[0.07] hover:border-[#B8965A]/35"
                    >
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#B8965A]/15 border border-[#B8965A]/30 text-[#D6B77D]">
                          <AiAdvantageIcon index={idx} />
                        </span>
                        <span className="text-xs font-medium text-[#8B8275] tabular-nums">
                          {item.number}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-[#F4EFE6] leading-snug">
                        {item.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-[#C8C0B4]">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 1B. PERSONAL / PROFESSIONAL USE CASE TOGGLE CARDS */}
        <section
          id="use-case-toggle-section"
          className="border-t border-[#3D3830]/10 bg-[#FAF7F2] py-16 md:py-20"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-6 space-y-10">
            <Reveal direction="up">
              <div className="flex flex-col items-center text-center space-y-4">
                <div
                  role="tablist"
                  aria-label="Choose personal or professional use"
                  className="inline-flex items-center rounded-full border border-[#3D3830]/12 bg-[#EAE3D7]/70 p-1"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={useCaseMode === 'personal'}
                    onClick={() => setUseCaseMode('personal')}
                    className={`rounded-full px-5 sm:px-6 py-2 text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                      useCaseMode === 'personal'
                        ? 'bg-[#4A453D] text-[#FAF7F2] shadow-xs'
                        : 'text-[#5C5449] hover:text-[#3D3830]'
                    }`}
                  >
                    For personal use
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={useCaseMode === 'professional'}
                    onClick={() => setUseCaseMode('professional')}
                    className={`rounded-full px-5 sm:px-6 py-2 text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                      useCaseMode === 'professional'
                        ? 'bg-[#4A453D] text-[#FAF7F2] shadow-xs'
                        : 'text-[#5C5449] hover:text-[#3D3830]'
                    }`}
                  >
                    For professional use
                  </button>
                </div>

                <p className="max-w-xl text-xs sm:text-sm text-[#5C5449] leading-relaxed">
                  Designed for personal use and for professional consultants - both. Easily switch between casual friendly chat and highly technical breakdown.
                </p>
              </div>
            </Reveal>

            <div
              key={useCaseMode}
              role="tabpanel"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 animate-cc-tab-panel"
            >
              {(useCaseMode === 'personal'
                ? PERSONAL_USE_CARDS
                : PROFESSIONAL_USE_CARDS
              ).map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-[#3D3830]/8 bg-[#EDE8DF] p-6 sm:p-7 flex flex-col justify-start gap-2.5"
                >
                  <h3 className="font-serif text-2xl font-medium text-[#3D3830] leading-snug">
                    {card.title}
                  </h3>
                  <p className="text-xs sm:text-[13.5px] text-[#5C5449] leading-relaxed">
                    {card.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2. METHODOLOGIES: 6 LARGE CARDS */}
        <section
          id="traditions-showcase"
          className="scroll-mt-24 border-t border-[#3D3830]/10 bg-[#F1ECE3]/55 py-16 md:py-24"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-6 space-y-10">
            <Reveal direction="up">
              <div className="text-center space-y-2 max-w-2xl mx-auto">
                <h2
                  className="font-serif text-3xl sm:text-4xl font-medium text-[#3D3830] tracking-tight"
                  style={{ textWrap: 'balance' }}
                >
                  Methodologies
                </h2>
              </div>
            </Reveal>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {METHODOLOGY_CARDS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <Reveal key={item.id} direction="up" delay={(idx % 3) * 50} className="h-full">
                    <div className="h-full rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-7 sm:p-8 flex flex-col justify-start gap-4 transition-colors duration-200 hover:border-[#3D3830]/25">
                      <div className="h-11 w-11 rounded-2xl bg-[#EAE3D7]/70 border border-[#3D3830]/10 flex items-center justify-center text-[#8B7355] shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-serif text-2xl sm:text-[26px] font-medium text-[#3D3830] leading-snug">
                          {item.title}
                        </h3>
                        <p className="text-sm text-[#5C5449] leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3. PRODUCTS A: BIRTH CHART ANALYSIS */}
        <section
          id="observatory-showcase"
          className="scroll-mt-24 border-t border-[#3D3830]/10 bg-[#FDFBF7] py-16 md:py-24"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-6 space-y-10 sm:space-y-12">
            <Reveal direction="up">
              <div className="max-w-3xl space-y-4 text-left">
                <h2
                  className="font-['Cormorant_Garamond',serif] text-[clamp(2.5rem,5.4vw,4.35rem)] font-medium leading-[1.02] tracking-tight text-[#3D3830]"
                  style={{ textWrap: 'balance' }}
                >
                  Deep Birth Chart Analysis
                </h2>
                <p
                  className="font-['Cormorant_Garamond',serif] text-xl sm:text-3xl font-medium leading-[1.2] text-[#5C5449]"
                  style={{ textWrap: 'balance' }}
                >
                  {BIRTHCHART_CONTENT.headline}
                </p>
                <p className="text-base sm:text-lg leading-[1.68] text-[#5C5449]">
                  {BIRTHCHART_CONTENT.lead}
                </p>
              </div>
            </Reveal>

            <Reveal direction="up" delay={70}>
              <ChartViewer
                chart={PREVIEW_CHART_JSON}
                dailyTransits={PREVIEW_DAILY_TRANSITS}
                initialMode="vedic"
                gender="Male"
              />
            </Reveal>
          </div>
        </section>

        {/* 2B. ONE-ON-ONE CONSULTATION SHOWCASE */}
        <section
          id="consultation"
          className="scroll-mt-24 bg-[#F1ECE3]/50 pt-20 sm:pt-28 pb-20 sm:pb-28 border-t border-[#3D3830]/10"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8 space-y-16 sm:space-y-24">
            <Reveal direction="up">
              <div className="max-w-3xl space-y-4 text-left">
                <h2
                  className="font-['Cormorant_Garamond',serif] text-[clamp(2.5rem,5.4vw,4.35rem)] font-medium leading-[1.02] tracking-tight text-[#3D3830]"
                  style={{ textWrap: 'balance' }}
                >
                  One-on-One Consultation
                </h2>
                <p className="text-base sm:text-lg leading-[1.68] text-[#5C5449]">
                  Chat with AI astrologers who deeply understand you, your chart and your current
                  phase. Unlike human astrologers, an AI astrologer fully understands the context of
                  your life and explore your questions in as much depth as you need. Without rushing
                  through a consultation or having to explain your circumstances all over again.
                </p>
              </div>
            </Reveal>

            {/* Interactive Astrological Consultation Showcase */}
            <Reveal direction="up" delay={70}>
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div
                    role="tablist"
                    aria-label="Astrological consultation topics"
                    className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#EFE8DA]/85 p-1.5 border border-[#3D3830]/10"
                  >
                    {FLAGSHIP_CONSULTATION_SCENARIOS.map((scenario) => {
                      const selected = scenario.id === consultationTabId;
                      return (
                        <button
                          key={scenario.id}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          onClick={() => setConsultationTabId(scenario.id)}
                          className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            selected
                              ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                              : 'text-[#5C5449] hover:text-[#3D3830]'
                          }`}
                        >
                          {scenario.situationLabel}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isTarotConsultation}
                      onClick={() => setConsultationTabId('tarot-chat')}
                      className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        isTarotConsultation
                          ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                          : 'text-[#5C5449] hover:text-[#3D3830]'
                      }`}
                    >
                      Tarot Chat
                    </button>
                  </div>
                </div>

                <div
                  key={consultationTabId}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-8 lg:p-10 animate-cc-tab-panel"
                >
                  {/* Left: Large 3:4 Astrologer / Tarot Portrait */}
                  <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                    <div className="aspect-[3/4] w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-[#3D3830]/10">
                      <EditorialImage
                        src={isTarotConsultation ? '/assets/landing/guide-ananya.jpg' : activeConsultation.portraitUrl}
                        alt={isTarotConsultation ? 'Ananya — Tarot Companion portrait' : activeConsultation.portraitAlt}
                        className="h-full w-full"
                        imgClassName="object-top"
                      />
                    </div>
                    <div className="flex items-end justify-between gap-3 px-1">
                      <div>
                        <p className="font-['Cormorant_Garamond',serif] text-2xl sm:text-3xl font-medium text-[#3D3830] leading-tight">
                          {isTarotConsultation ? 'Ananya' : activeConsultation.companionName}
                        </p>
                        <p className="text-xs sm:text-sm text-[#6B6256] mt-0.5">
                          {isTarotConsultation ? 'Tarot Companion' : activeConsultation.companionRole}
                        </p>
                      </div>
                      <Link
                        to="/app/login"
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors whitespace-nowrap shrink-0"
                      >
                        <span>Consult {isTarotConsultation ? 'Ananya' : activeConsultation.companionName}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Right: Long Scrollable Astrological Consultation or Tarot Chat Dialogue */}
                  <div className="lg:col-span-7 flex flex-col justify-between gap-4 lg:pl-4">
                    <div className="flex flex-wrap items-end justify-between gap-3 pb-4 border-b border-[#3D3830]/10">
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-[#8B8275]">
                          {isTarotConsultation ? 'Tarot in Chat' : activeConsultation.situationLabel}
                        </p>
                        <h3 className="font-['Cormorant_Garamond',serif] text-2xl sm:text-3xl font-medium text-[#3D3830] leading-snug">
                          {isTarotConsultation
                            ? 'Tarot to give you more clarity'
                            : activeConsultation.heading}
                        </h3>
                      </div>

                      {isTarotConsultation && (
                        <button
                          type="button"
                          onClick={() => setPreviewReversed((prev) => !prev)}
                          className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                            previewReversed
                              ? 'border-[#7A3E36]/40 bg-[#7A3E36]/10 text-[#7A3E36]'
                              : 'border-[#3D3830]/15 bg-[#FAF7F2] text-[#5C5449] hover:text-[#3D3830]'
                          }`}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>{previewReversed ? 'Card 3: Reversed' : 'Preview Reversed'}</span>
                        </button>
                      )}
                    </div>

                    <div
                      ref={consultationScrollRef}
                      tabIndex={0}
                      aria-label={`${isTarotConsultation ? 'Ananya tarot' : activeConsultation.companionName} consultation conversation`}
                      className="h-[430px] sm:h-[490px] lg:h-[520px] overflow-y-auto cc-chat-scroll bg-transparent pr-2 sm:pr-3 py-4 focus:outline-none"
                      style={{
                        maskImage:
                          'linear-gradient(to bottom, transparent 0%, black 16px, black calc(100% - 22px), transparent 100%)',
                        WebkitMaskImage:
                          'linear-gradient(to bottom, transparent 0%, black 16px, black calc(100% - 22px), transparent 100%)',
                      }}
                    >
                      {isTarotConsultation ? (
                        <div className="space-y-4">
                          <div className="flex justify-end">
                            <p className="max-w-[90%] sm:max-w-[82%] rounded-2xl rounded-br-sm bg-[#EAE2D4] px-4 sm:px-5 py-3 text-[15px] sm:text-base leading-[1.6] text-[#3D3830]">
                              Can you pull a 3-card spread on my career direction right now?
                            </p>
                          </div>
                          <div className="flex justify-start">
                            <p className="max-w-[90%] sm:max-w-[82%] rounded-2xl rounded-bl-sm bg-[#FAF7F2] border border-[#3D3830]/10 px-4 sm:px-5 py-3 text-[15px] sm:text-base leading-[1.6] text-[#3D3830]">
                              Let&apos;s look calmly at where your effort sits, what is shifting right now, and one grounded next move.
                            </p>
                          </div>
                          <TarotCardSpread
                            spread={landingSpread}
                            initialRevealed={false}
                            customMeanings={tarotCustomMeanings}
                            compact
                          />
                          <div className="flex justify-start">
                            <p className="max-w-[90%] sm:max-w-[82%] rounded-2xl rounded-bl-sm bg-[#FAF7F2] border border-[#3D3830]/10 px-4 sm:px-5 py-3 text-[15px] sm:text-base leading-[1.6] text-[#3D3830]">
                              Ask for a single card for today or a spread for a bigger decision. Every reading stays saved in your chat so you can revisit it anytime.
                            </p>
                          </div>
                        </div>
                      ) : (
                        activeConsultation.lines.map((line, index) => {
                          const isUser = line.sender === 'user';
                          const prevSameSender =
                            index > 0 && activeConsultation.lines[index - 1].sender === line.sender;
                          return (
                            <div
                              key={`${activeConsultation.id}-${index}`}
                              className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${
                                index === 0 ? '' : prevSameSender ? 'mt-2' : 'mt-4'
                              }`}
                            >
                              <p
                                className={`max-w-[90%] sm:max-w-[82%] rounded-2xl px-4 sm:px-5 py-3 text-[15px] sm:text-base leading-[1.6] ${
                                  isUser
                                    ? 'bg-[#EAE2D4] text-[#3D3830] rounded-br-sm'
                                    : 'bg-[#FAF7F2] text-[#3D3830] border border-[#3D3830]/10 rounded-bl-sm'
                                }`}
                              >
                                {line.text}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="pt-3.5 border-t border-[#3D3830]/10 flex flex-wrap items-center justify-between gap-3 text-xs text-[#6B6256]">
                      <span>
                        {isTarotConsultation
                          ? 'Tap any card to turn it over and read inside chat'
                          : 'Scroll to read full consultation'}
                      </span>
                      <Link
                        to="/app/login"
                        className="font-medium text-[#3D3830] underline underline-offset-4 hover:text-[#5C5449] whitespace-nowrap"
                      >
                        Login to start chatting
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Dedicated Masonry Grid — Spiritual Guides */}
            <Reveal direction="up">
              <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <h3 className="font-['Cormorant_Garamond',serif] text-2xl sm:text-3xl font-medium text-[#3D3830] tracking-tight">
                    Meet your spiritual guides.
                  </h3>
                  <p className="max-w-xl text-sm sm:text-base text-[#5C5449] leading-relaxed">
                    Personal astrologers, esoteric specialists, and spiritual guides across Vedic, Western, Evolutionary, and Tarot traditions.
                  </p>
                </div>

                <div
                  className={`grid gap-4 sm:gap-5 items-start ${
                    masonryCols === 3 ? 'grid-cols-3' : 'grid-cols-2'
                  }`}
                >
                  {masonryColumns.map((col, colIdx) => (
                    <div key={`masonry-col-${colIdx}`} className="space-y-4 sm:space-y-5">
                      {col.map((guide) => (
                        <figure
                          key={`${guide.name}-${guide.role}`}
                          className="group space-y-2.5"
                        >
                          <div
                            className={`relative ${guide.aspectClass} w-full rounded-2xl overflow-hidden border border-[#3D3830]/12 bg-[#231F1A]`}
                          >
                            <img
                              src={guide.imageUrl}
                              alt={guide.alt}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              className={`h-full w-full object-cover sepia-[0.14] saturate-[0.96] contrast-[1.03] brightness-[0.95] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03] ${
                                guide.imgClassName || 'object-top'
                              }`}
                            />
                            <div
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-0 bg-[#B8965A]/[0.08] mix-blend-multiply"
                            />
                            <div
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#2D2419]/[0.06] via-transparent to-[#211A12]/[0.32] ring-1 ring-inset ring-[#3D3830]/14 rounded-2xl"
                            />
                          </div>
                          <figcaption className="px-0.5">
                            <p className="text-sm font-semibold text-[#3D3830] leading-snug">
                              {guide.name}
                            </p>
                            <p className="text-xs text-[#6B6256] leading-snug">{guide.role}</p>
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  ))}
                </div>

                {visibleGuideCount < shuffledGuides.length && (
                  <div className="pt-2 flex justify-center">
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleGuideCount((prev) =>
                          Math.min(shuffledGuides.length, prev + 9)
                        )
                      }
                      className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-[#3D3830]/20 bg-[#FAF7F2] px-6 py-2.5 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7] transition-colors cursor-pointer"
                    >
                      Load more
                    </button>
                  </div>
                )}
              </div>
            </Reveal>

          </div>
        </section>

        {/* 3C. PRODUCTS C: ASTROLOGY APPS */}
        <section
          id="miniapps-showcase"
          className="scroll-mt-24 border-t border-[#3D3830]/10 bg-[#FAF7F2] py-16 md:py-24"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-6 space-y-8">
            <Reveal direction="up">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                  <h2
                    className="font-['Cormorant_Garamond',serif] text-3xl sm:text-4xl font-medium text-[#3D3830] tracking-tight"
                    style={{ textWrap: 'balance' }}
                  >
                    Explore every dimension of your chart.
                  </h2>
                  <p className="text-sm sm:text-base text-[#5C5449] leading-relaxed">
                    Specialised astrological tools for deeper exploration.
                  </p>
                </div>
                <Link
                  to="/app/apps?preview=1"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3D3830] underline underline-offset-4 hover:text-[#5C5449] whitespace-nowrap shrink-0"
                >
                  <span>Browse all tools in preview</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Reveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {CLIENT_MINI_APPS.map((app) => (
                <Link
                  key={app.slug}
                  to={`/app/apps/${encodeURIComponent(app.slug)}?preview=1`}
                  className="group rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-6 sm:p-7 flex flex-col items-start gap-4 transition-all duration-200 hover:border-[#3D3830]/28 hover:-translate-y-0.5"
                >
                  <span className="h-11 w-11 rounded-xl bg-[#EAE3D7]/80 border border-[#3D3830]/10 flex items-center justify-center text-[#8B7355] shrink-0 transition-colors group-hover:bg-[#EAE3D7]">
                    {renderMiniAppIcon(app.iconKey, 'h-5 w-5')}
                  </span>
                  <div className="space-y-1">
                    <span className="block font-['Plus_Jakarta_Sans',sans-serif] text-base sm:text-[17px] font-medium tracking-[-0.015em] text-[#3D3830] leading-snug">
                      {app.title}
                    </span>
                    <span className="block text-xs sm:text-[13px] text-[#6B6256] leading-relaxed">
                      {app.tagline}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 4B. COMPARISON: CONVENTIONAL ASTROLOGY VS COSMICCOUNCIL */}
        <section
          id="comparison-section"
          className="bg-gradient-to-br from-[#1F2229] via-[#242832] to-[#292D36] text-[#F4EFE6] py-16 sm:py-20 lg:py-24 border-t border-[#3D3830]/15"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-6 space-y-10 sm:space-y-12">
            <Reveal direction="up">
              <div className="max-w-4xl space-y-5">
                <div className="h-px w-12 bg-[#B8965A]" aria-hidden="true" />
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#B8965A]">
                  THE COSMICCOUNCIL ADVANTAGE
                </p>
                <h2
                  className="font-['Cormorant_Garamond',serif] text-[clamp(2rem,3.6vw,3rem)] font-medium leading-[1.08] text-[#F4EFE6]"
                  style={{ textWrap: 'balance' }}
                >
                  What happens when astrology is no longer limited by human capacity?
                </h2>
                <div className="space-y-4 text-sm sm:text-base leading-[1.72] text-[#D2CBC0]">
                  <p>
                    A birth chart contains hundreds of interconnected indicators. Examining every planetary placement, combination, cancellation, divisional chart and timing sequence within a conventional consultation is an enormous undertaking.
                  </p>
                  <p>
                    CosmicCouncil brings together dedicated astrological calculations, multiple analytical techniques and AI reasoning to explore your chart with a breadth and depth that would otherwise require considerable time and effort.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 pt-3">
                  {COMPARISON_METRICS.map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 space-y-1"
                    >
                      <p className="font-['DM_Sans',sans-serif] text-2xl sm:text-3xl font-medium text-[#C9A769] tabular-nums">
                        {metric.value}
                      </p>
                      <p className="text-xs sm:text-sm text-[#D2CBC0]">{metric.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal direction="up" delay={60}>
              <div className="rounded-3xl border border-white/10 bg-[#1B1E25]/75 p-4 sm:p-6 lg:p-7 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)]">
                {/* Desktop Comparison Table */}
                <div className="hidden md:block space-y-1.5">
                  <div className="grid grid-cols-12 gap-5 px-4 py-3.5 rounded-2xl bg-white/[0.05] items-center">
                    <div className="col-span-3 text-[11px] font-medium uppercase tracking-[0.12em] text-[#9D9589]">
                      CAPABILITY
                    </div>
                    <div className="col-span-4 text-sm font-semibold text-[#F4EFE6]">
                      Conventional astrology
                    </div>
                    <div className="col-span-5 text-sm font-semibold text-[#C9A769]">
                      CosmicCouncil
                    </div>
                  </div>

                  <div className="space-y-1">
                    {COMPARISON_ROWS.map((row, idx) => {
                      const TopicIcon = row.icon;
                      return (
                        <div
                          key={row.capability}
                          className={`grid grid-cols-12 gap-5 px-4 py-4 rounded-2xl items-start transition-colors duration-200 hover:bg-white/[0.045] ${
                            idx % 2 === 1 ? 'bg-white/[0.02]' : ''
                          }`}
                        >
                          <div className="col-span-3 flex items-center gap-3 text-sm font-medium text-[#F4EFE6] leading-snug">
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#B8965A]/15 border border-[#B8965A]/25 text-[#D6B77D]">
                              <TopicIcon className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <span>{row.capability}</span>
                          </div>
                          <div className="col-span-4 flex items-start gap-2.5 text-sm text-[#B8B0A4] leading-relaxed pt-0.5">
                            <AlertCircle
                              className="h-4 w-4 shrink-0 text-[#D48C70] mt-0.5"
                              aria-hidden="true"
                            />
                            <span>{row.conventional}</span>
                          </div>
                          <div className="col-span-5 flex items-start gap-2.5 text-sm text-[#F4EFE6] leading-relaxed pt-0.5">
                            <Check
                              className="h-4 w-4 shrink-0 text-[#C9A769] mt-0.5"
                              aria-hidden="true"
                            />
                            <span>{row.cosmicCouncil}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Mobile Stacked Comparison Cards */}
                <div className="md:hidden space-y-3">
                  {COMPARISON_ROWS.map((row) => {
                    const TopicIcon = row.icon;
                    return (
                      <div
                        key={row.capability}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#B8965A]/15 border border-[#B8965A]/25 text-[#D6B77D]">
                            <TopicIcon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <p className="text-sm font-semibold text-[#F4EFE6]">{row.capability}</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-start gap-2 text-xs text-[#B8B0A4] leading-relaxed">
                            <AlertCircle
                              className="h-3.5 w-3.5 shrink-0 text-[#D48C70] mt-0.5"
                              aria-hidden="true"
                            />
                            <span>
                              <span className="font-medium text-[#D2CBC0]">Conventional astrology: </span>
                              {row.conventional}
                            </span>
                          </div>
                          <div className="flex items-start gap-2 rounded-xl bg-[#B8965A]/[0.08] p-2.5 text-xs text-[#F4EFE6] leading-relaxed">
                            <Check
                              className="h-3.5 w-3.5 shrink-0 text-[#C9A769] mt-0.5"
                              aria-hidden="true"
                            />
                            <span>
                              <span className="font-medium text-[#C9A769]">CosmicCouncil: </span>
                              {row.cosmicCouncil}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Reveal>

            <Reveal direction="up" delay={100}>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 sm:p-8 space-y-2.5">
                <h3
                  className="font-['Cormorant_Garamond',serif] text-2xl sm:text-[28px] font-medium text-[#F4EFE6] leading-snug"
                  style={{ textWrap: 'balance' }}
                >
                  More indicators considered. More perspectives explored. More room for questions.
                </h3>
                <p className="max-w-4xl text-xs sm:text-sm leading-relaxed text-[#9D9589]">
                  Greater analytical coverage does not guarantee predictive accuracy. Astrology remains an interpretive practice, and no system can predict life&apos;s outcomes with certainty.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 4C. TABBED COMPARISON: WHY CHOOSE COSMICCOUNCIL */}
        <section
          id="why-cosmiccouncil-section"
          className="scroll-mt-24 bg-gradient-to-b from-[#1A1D24] via-[#1F2229] to-[#242832] text-[#F4EFE6] py-16 sm:py-20 lg:py-24 border-t border-white/10"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-6 space-y-8 sm:space-y-10">
            <Reveal direction="up">
              <div className="space-y-5">
                <div className="space-y-2.5 max-w-3xl">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#B8965A]">
                    THE COSMICCOUNCIL ADVANTAGE
                  </p>
                  <h2
                    className="font-['Cormorant_Garamond',serif] text-[clamp(2rem,3.6vw,3rem)] font-medium leading-[1.08] text-[#F4EFE6]"
                    style={{ textWrap: 'balance' }}
                  >
                    Why choose CosmicCouncil?
                  </h2>
                  <p className="text-sm sm:text-base leading-[1.7] text-[#D2CBC0]">
                    Explore how a dedicated AI-powered astrology platform compares with the alternatives.
                  </p>
                </div>

                {/* 4 Comparison Tabs */}
                <div
                  role="tablist"
                  aria-label="Compare CosmicCouncil with alternatives"
                  className="flex flex-wrap items-center gap-2.5 pt-1"
                >
                  {OBJECTION_COMPARISON_TABS.map((tab) => {
                    const isActive = activeComparisonTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveComparisonTab(tab.id)}
                        className={`min-h-[42px] rounded-xl px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                          isActive
                            ? 'bg-[#C9A769] text-[#1F2229] font-semibold shadow-[0_8px_20px_-8px_rgba(201,167,105,0.45)]'
                            : 'border border-white/10 bg-white/[0.05] text-[#D2CBC0] hover:bg-white/[0.09] hover:text-[#F4EFE6]'
                        }`}
                      >
                        {tab.tabLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Reveal>

            <Reveal direction="up" delay={50}>
              <div
                key={activeObjectionComparison.id}
                role="tabpanel"
                className="rounded-3xl border border-white/10 bg-[#1B1E25]/80 p-5 sm:p-7 lg:p-8 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)] space-y-6 animate-cc-tab-panel"
              >
                <div className="max-w-3xl space-y-2">
                  <h3
                    className="font-['Cormorant_Garamond',serif] text-2xl sm:text-3xl font-medium text-[#F4EFE6] leading-snug"
                    style={{ textWrap: 'balance' }}
                  >
                    {activeObjectionComparison.heading}
                  </h3>
                  <p className="text-sm sm:text-base leading-[1.68] text-[#D2CBC0]">
                    {activeObjectionComparison.intro}
                  </p>
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block space-y-1.5">
                  <div className="grid grid-cols-12 gap-5 px-4 py-3.5 rounded-2xl bg-white/[0.05] items-center">
                    <div className="col-span-4 text-[11px] font-medium uppercase tracking-[0.12em] text-[#9D9589]">
                      CAPABILITY
                    </div>
                    <div className="col-span-4 text-sm font-semibold text-[#F4EFE6]">
                      {activeObjectionComparison.competitorColumnLabel}
                    </div>
                    <div className="col-span-4 text-sm font-semibold text-[#C9A769]">
                      CosmicCouncil
                    </div>
                  </div>

                  <div className="space-y-1">
                    {activeObjectionComparison.rows.map((row, idx) => (
                      <div
                        key={row.capability}
                        className={`grid grid-cols-12 gap-5 px-4 py-3.5 rounded-2xl items-center transition-colors duration-200 hover:bg-white/[0.045] ${
                          idx % 2 === 1 ? 'bg-white/[0.02]' : ''
                        }`}
                      >
                        <div className="col-span-4 text-sm font-medium text-[#F4EFE6]">
                          {row.capability}
                        </div>
                        <div className="col-span-4 flex items-start gap-2.5 text-sm text-[#B8B0A4] leading-relaxed">
                          <AlertCircle
                            className="h-4 w-4 shrink-0 text-[#D48C70] mt-0.5"
                            aria-hidden="true"
                          />
                          <span>{row.competitor}</span>
                        </div>
                        <div className="col-span-4 flex items-start gap-2.5 text-sm text-[#F4EFE6] leading-relaxed">
                          <Check
                            className="h-4 w-4 shrink-0 text-[#C9A769] mt-0.5"
                            aria-hidden="true"
                          />
                          <span>{row.cosmicCouncil}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mobile Stacked Cards */}
                <div className="md:hidden space-y-3">
                  {activeObjectionComparison.rows.map((row) => (
                    <div
                      key={row.capability}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2.5"
                    >
                      <p className="text-sm font-semibold text-[#F4EFE6]">{row.capability}</p>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 text-xs text-[#B8B0A4] leading-relaxed">
                          <AlertCircle
                            className="h-3.5 w-3.5 shrink-0 text-[#D48C70] mt-0.5"
                            aria-hidden="true"
                          />
                          <span>
                            <span className="font-medium text-[#D2CBC0]">
                              {activeObjectionComparison.competitorColumnLabel}:{' '}
                            </span>
                            {row.competitor}
                          </span>
                        </div>
                        <div className="flex items-start gap-2 rounded-xl bg-[#B8965A]/[0.08] p-2.5 text-xs text-[#F4EFE6] leading-relaxed">
                          <Check
                            className="h-3.5 w-3.5 shrink-0 text-[#C9A769] mt-0.5"
                            aria-hidden="true"
                          />
                          <span>
                            <span className="font-medium text-[#C9A769]">CosmicCouncil: </span>
                            {row.cosmicCouncil}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal direction="up" delay={90}>
              <p className="max-w-4xl text-xs sm:text-sm leading-relaxed text-[#9D9589]">
                Capabilities vary between practitioners, applications and AI configurations. Greater analytical coverage does not establish greater predictive accuracy.
              </p>
            </Reveal>
          </div>
        </section>

        {/* 5. BENEFITS: 12 CONSULTATION-SPECIFIC BENEFITS */}
        <section
          id="benefits"
          className="scroll-mt-24 border-t border-[#3D3830]/10 bg-[#FDFBF7] py-16 md:py-24"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-6 space-y-8">
            <Reveal direction="up">
              <div className="max-w-3xl space-y-2.5">
                <p className="text-xs sm:text-[13px] font-medium uppercase tracking-[0.14em] text-[#8B7355]">
                  A MORE PERSONAL APPROACH TO ASTROLOGY
                </p>
                <h2
                  className="font-['Cormorant_Garamond',serif] text-3xl sm:text-4xl md:text-[42px] font-medium text-[#3D3830] tracking-tight leading-[1.08]"
                  style={{ textWrap: 'balance' }}
                >
                  Beyond a conventional astrology consultation.
                </h2>
                <p className="text-sm sm:text-base text-[#5C5449] leading-relaxed">
                  Explore your birth chart, understand its many layers and discuss the questions that matter to you, without the limitations of a conventional consultation.
                </p>
              </div>
            </Reveal>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {LANDING_BENEFITS.map((item, idx) => (
                <Reveal
                  key={item.title}
                  delay={(idx % 2) * 65}
                  className="h-full"
                >
                  <div className="h-full rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-6 sm:p-7 flex flex-col items-start text-left gap-4 shadow-[0_8px_24px_-18px_rgba(61,56,48,0.18)] transition-colors duration-200 hover:border-[#3D3830]/25">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAE3D7]/80 border border-[#3D3830]/10 text-[#8B7355]">
                      <ConsultationBenefitIcon index={idx} />
                    </span>
                    <div className="space-y-1.5">
                      <h3 className="text-base sm:text-[17px] font-semibold text-[#3D3830] leading-snug">
                        {item.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-[#5C5449]">{item.description}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 6. PRICING SECTION */}
        <PricingSection />
      </main>

      {/* 7. QUIET FOOTER & SUPPORT */}
      <footer id="support" className="scroll-mt-24 border-t border-[#3D3830]/10 bg-[#F1ECE3] py-10">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5C5449]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-serif text-lg font-medium text-[#3D3830]">
              Cosmic Council
            </span>
            <span aria-hidden="true">·</span>
            <span>Private, encrypted &amp; personalized to your birth chart</span>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <a
              href="mailto:support@cosmiccouncil.pro"
              className="hover:text-[#3D3830] transition-colors"
            >
              Support
            </a>
            <Link to="/privacy" className="hover:text-[#3D3830] transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-[#3D3830] transition-colors">
              Terms
            </Link>
            <Link to="/app/home?preview=1" className="hover:text-[#3D3830] transition-colors">
              Live Preview
            </Link>
            <Link to="/app/login" className="hover:text-[#3D3830] transition-colors">
              Login with Gmail
            </Link>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="hover:text-[#3D3830] transition-colors cursor-pointer"
            >
              Back to top
            </button>
          </div>
        </div>
      </footer>

      <FloatingScrollControls />
    </div>
  );
};

export default NewLandingPage;
