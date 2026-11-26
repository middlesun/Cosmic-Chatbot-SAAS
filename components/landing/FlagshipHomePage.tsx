import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  Compass,
  Heart,
  Menu,
  RefreshCw,
  Scale,
  Sprout,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import FloatingScrollControls from '../FloatingScrollControls';
import ChartViewer from '../app/ChartViewer';
import {
  PREVIEW_CHART_JSON,
  PREVIEW_DAILY_TRANSITS,
} from '../app/previewFixtures';
import heroHumanCounselImg from '../../src/assets/images/hero_human_counsel_1795581606668.jpg';
import heroHumanReflectionImg from '../../src/assets/images/hero_human_reflection_1795582207524.jpg';
import heroHumanClarityImg from '../../src/assets/images/hero_human_clarity_1795582208303.jpg';
import {
  CompanionCarousel,
  EditorialImage,
  EditorialReveal,
  ParallaxFrame,
} from './EditorialPrimitives';
import {
  BIRTHCHART_CONTENT,
  CONSULTATION_CONTENT,
  GUIDANCE_CONTENT,
  HERO_CONTENT,
  SUPPORT_CONTENT,
  type CompanionCarouselItem,
  type HeroBackdropOption,
} from './landingData';
import {
  FLAGSHIP_CONSULTATION_SCENARIOS,
  FLAGSHIP_GUIDANCE_SCENARIOS,
  FLAGSHIP_SUPPORT_SCENARIOS,
} from './flagshipTranscripts';
import PricingSection from './PricingSection';

type NavSectionId = 'home' | 'birthchart' | 'consultation' | 'guidance' | 'support' | 'pricing';
type AstrologySystemId = 'vedic' | 'kp' | 'jaimini' | 'western' | 'hellenistic' | 'modern';

const HERO_LAST_BACKDROP_KEY = 'cc_last_hero_backdrop';

function pickRandomBackdrop(): HeroBackdropOption {
  const options = HERO_CONTENT.backdrops;
  if (typeof window === 'undefined') return options[0];
  try {
    const lastId = sessionStorage.getItem(HERO_LAST_BACKDROP_KEY);
    const pool = lastId && options.length > 1 ? options.filter((b) => b.id !== lastId) : options;
    const chosen = pool[Math.floor(Math.random() * pool.length)] || options[0];
    sessionStorage.setItem(HERO_LAST_BACKDROP_KEY, chosen.id);
    return chosen;
  } catch {
    return options[Math.floor(Math.random() * options.length)] || options[0];
  }
}

const TRADITION_CARDS: Array<{
  id: AstrologySystemId;
  label: string;
  viewerMode: 'vedic' | 'western';
  viewerVedicTab?: 'chart' | 'overview' | 'kp' | 'jaimini';
}> = [
  { id: 'vedic', label: 'Vedic', viewerMode: 'vedic', viewerVedicTab: 'chart' },
  { id: 'kp', label: 'KP', viewerMode: 'vedic', viewerVedicTab: 'kp' },
  { id: 'jaimini', label: 'Jaimini', viewerMode: 'vedic', viewerVedicTab: 'jaimini' },
  { id: 'western', label: 'Western', viewerMode: 'western' },
  { id: 'hellenistic', label: 'Hellenistic', viewerMode: 'western' },
  { id: 'modern', label: 'Modern', viewerMode: 'western' },
];

const TraditionIcon: React.FC<{ id: AstrologySystemId }> = ({ id }) => {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'h-5 w-5',
    'aria-hidden': true,
  };

  switch (id) {
    case 'vedic':
      return (
        <svg {...commonProps}>
          <rect x="4.5" y="4.5" width="15" height="15" rx="1.5" strokeOpacity="0.8" />
          <path d="M4.5 4.5 19.5 19.5M19.5 4.5 4.5 19.5" strokeOpacity="0.55" />
          <polygon points="12 4.5 19.5 12 12 19.5 4.5 12" />
        </svg>
      );
    case 'kp':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8.5" strokeOpacity="0.45" />
          <path d="M12 3.5v17M3.5 12h17" strokeOpacity="0.7" />
          <circle cx="12" cy="12" r="2.25" />
        </svg>
      );
    case 'jaimini':
      return (
        <svg {...commonProps}>
          <polygon points="12 4 19 16 5 16" strokeOpacity="0.85" />
          <polygon points="12 20 19 8 5 8" strokeOpacity="0.45" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'western':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4" strokeOpacity="0.5" />
          <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2" />
        </svg>
      );
    case 'hellenistic':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8.5" strokeOpacity="0.85" />
          <path d="M12 3.5 16.5 12 12 20.5 7.5 12Z" strokeOpacity="0.65" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'modern':
    default:
      return (
        <svg {...commonProps}>
          <path d="M5.5 16.5a8.5 8.5 0 0 1 13-10.5" strokeOpacity="0.85" />
          <path d="M18.5 7.5a8.5 8.5 0 0 1-13 10.5" strokeOpacity="0.45" />
          <circle cx="12" cy="12" r="2.2" />
        </svg>
      );
  }
};

// Dedicated Per-Pillar Companion Carousels (using existing project characters & specialisations)
const SPIRITUAL_GUIDES_CAROUSEL: CompanionCarouselItem[] = [
  {
    name: 'Dev',
    role: 'Vedic Astrology',
    imageUrl: '/assets/landing/astrologer-man.jpg',
    alt: 'Dev — Vedic Astrology portrait',
  },
  {
    name: 'Nandini',
    role: 'Vedic Astrology',
    imageUrl: '/assets/companions/nandini.jpg',
    alt: 'Nandini — Vedic Astrology portrait',
  },
  {
    name: 'Marc',
    role: 'Western Astrology',
    imageUrl: '/assets/companions/julian.jpg',
    alt: 'Marc — Western Astrology portrait',
  },
  {
    name: 'Sofia',
    role: 'Evolutionary Astrology',
    imageUrl: '/assets/landing/astrologer-woman.jpg',
    alt: 'Sofia — Evolutionary Astrology portrait',
  },
  {
    name: 'Bella',
    role: 'Tarot',
    imageUrl: '/assets/landing/dp-bella.jpg',
    alt: 'Bella — Tarot portrait',
  },
];

const LIFE_COMPANIONS_CAROUSEL: CompanionCarouselItem[] = [
  {
    name: 'Isla',
    role: 'Relationships',
    imageUrl: '/assets/landing/dp-isla.jpg',
    alt: 'Isla — Relationships portrait',
  },
  {
    name: 'Neha',
    role: 'Career',
    imageUrl: '/assets/landing/dp-neha.jpg',
    alt: 'Neha — Career portrait',
  },
  {
    name: 'Nikhil',
    role: 'Business',
    imageUrl: '/assets/landing/dp-nikhil.jpg',
    alt: 'Nikhil — Business portrait',
  },
  {
    name: 'Maya',
    role: 'Mentorship',
    imageUrl: '/assets/companions/maya.jpg',
    alt: 'Maya — Mentorship portrait',
  },
  {
    name: 'Ethan',
    role: 'Candid Friend',
    imageUrl: '/assets/landing/dp-lucas.jpg',
    alt: 'Ethan — Candid Friend portrait',
  },
  {
    name: 'Elena',
    role: 'Decision Partner',
    imageUrl: '/assets/landing/life-career.jpg',
    alt: 'Elena — Decision Partner portrait',
  },
];

const EVERYDAY_COMPANIONS_CAROUSEL: CompanionCarouselItem[] = [
  {
    name: 'Mira',
    role: 'Listener',
    imageUrl: '/assets/aistudio/image_e0027d30.png',
    alt: 'Mira — Listener portrait',
  },
  {
    name: 'Aira',
    role: 'Mood Lifter',
    imageUrl: '/assets/landing/dp-aira.jpg',
    alt: 'Aira — Mood Lifter portrait',
  },
  {
    name: 'Noah',
    role: 'Comforter',
    imageUrl: '/assets/companions/samir.jpg',
    alt: 'Noah — Comforter portrait',
  },
  {
    name: 'Sienna',
    role: 'Heartbreak',
    imageUrl: heroHumanClarityImg,
    alt: 'Sienna — Heartbreak companion portrait',
    imgClassName: 'object-[98%_22%]',
  },
  {
    name: 'Nora',
    role: 'Calming Companion',
    imageUrl: heroHumanCounselImg,
    alt: 'Nora — Calming Companion portrait',
    imgClassName: 'object-[94%_24%]',
  },
  {
    name: 'Samir',
    role: 'Open Conversations',
    imageUrl: heroHumanReflectionImg,
    alt: 'Samir — Open Conversations portrait',
    imgClassName: 'object-[98%_22%]',
  },
];

const STRATEGIC_LIFE_AREAS = [
  { title: 'Love & Relationships', icon: Heart },
  { title: 'Career & Business', icon: Briefcase },
  { title: 'Family & Parenthood', icon: Users },
  { title: 'Money & Finances', icon: Wallet },
  { title: 'Life Direction', icon: Compass },
  { title: 'Personal Growth', icon: Sprout },
  { title: 'Legal Challenges', icon: Scale },
  { title: 'Life Transitions', icon: RefreshCw },
] as const;

const FlagshipIcon: React.FC<{
  section: 'birthchart' | 'consultation' | 'guidance' | 'support';
  index: number;
}> = ({ section, index }) => {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.35,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'h-[18px] w-[18px]',
    'aria-hidden': true,
  };

  if (section === 'birthchart') {
    switch (index) {
      case 0:
        return (
          <svg {...commonProps}>
            <circle cx="12" cy="12" r="9" strokeOpacity="0.45" />
            <circle cx="12" cy="12" r="5.25" strokeOpacity="0.85" />
            <path d="M12 9.5v5M9.5 12h5" />
          </svg>
        );
      case 1:
        return (
          <svg {...commonProps}>
            <path d="M12 4v15.5M8.5 19.5h7" />
            <path d="M5 8.5 12 6.5l7 2" />
            <path d="M5 8.5 3.3 13a2.2 2.2 0 0 0 3.4 0L5 8.5Z" />
            <path d="M19 8.5 17.3 13a2.2 2.2 0 0 0 3.4 0L19 8.5Z" />
          </svg>
        );
      case 2:
        return (
          <svg {...commonProps}>
            <polygon points="12 3.5 19.2 16 4.8 16" strokeOpacity="0.85" />
            <polygon points="12 20.5 19.2 8 4.8 8" strokeOpacity="0.45" />
            <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
          </svg>
        );
      case 3:
        return (
          <svg {...commonProps}>
            <circle cx="12" cy="12" r="2.2" />
            <path d="M4.5 5.5 10.3 10.3M19.5 5.5 13.7 10.3M4.5 18.5 10.3 13.7M19.5 18.5 13.7 13.7" />
            <circle cx="4.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
            <circle cx="19.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
            <circle cx="4.5" cy="18.5" r="1" fill="currentColor" stroke="none" />
            <circle cx="19.5" cy="18.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        );
      case 4:
        return (
          <svg {...commonProps}>
            <path d="M3 12h18" strokeOpacity="0.35" />
            <path d="M3.5 12c2-6 4.5-6 6.5 0s4.5 6 6.5 0c1-3 2.5-4.5 4-4.5" />
            <circle cx="6.75" cy="7.5" r="1.15" fill="currentColor" stroke="none" />
            <circle cx="13.25" cy="16.5" r="1.15" fill="currentColor" stroke="none" />
          </svg>
        );
      default:
        return (
          <svg {...commonProps}>
            <path d="M3.5 16.5C6.5 9 11.5 6.5 20.5 7.5" />
            <circle cx="5.5" cy="13.5" r="1.6" fill="#FAF7F2" />
            <circle cx="12" cy="8.5" r="1.8" fill="currentColor" stroke="none" />
            <circle cx="18.8" cy="7.5" r="1.6" fill="#FAF7F2" />
            <path d="M3.5 19.5h17" strokeOpacity="0.35" />
          </svg>
        );
    }
  }

  if (section === 'consultation') {
    switch (index) {
      case 0:
        return (
          <svg {...commonProps}>
            <circle cx="12" cy="8.5" r="3" />
            <path d="M6.5 18.5a5.5 5.5 0 0 1 11 0" />
            <circle cx="12" cy="12" r="9.2" strokeOpacity="0.35" />
          </svg>
        );
      case 1:
        return (
          <svg {...commonProps}>
            <path d="M4 17.5V6.5a2 2 0 0 1 2-2h6.5L15 7h3a2 2 0 0 1 2 2v8.5" />
            <path d="M8 12h8M8 15.5h5" strokeOpacity="0.7" />
          </svg>
        );
      case 2:
        return (
          <svg {...commonProps}>
            <circle cx="10.5" cy="10.5" r="6" />
            <path d="m15 15 4.5 4.5" />
            <path d="M10.5 8v5M8 10.5h5" strokeOpacity="0.75" />
          </svg>
        );
      case 3:
        return (
          <svg {...commonProps}>
            <circle cx="8.5" cy="12" r="4.5" strokeOpacity="0.85" />
            <circle cx="15.5" cy="12" r="4.5" strokeOpacity="0.55" />
          </svg>
        );
      case 4:
        return (
          <svg {...commonProps}>
            <path d="M3.5 16h17" />
            <path d="M6.5 16a5.5 5.5 0 0 1 11 0" />
            <path d="M12 5v2.5M6.2 8.2l1.6 1.6M17.8 8.2l-1.6 1.6" strokeOpacity="0.7" />
          </svg>
        );
      case 5:
        return (
          <svg {...commonProps}>
            <path d="M12 3.8 18.5 6.5v5.3c0 4.2-2.7 7.4-6.5 8.7-3.8-1.3-6.5-4.5-6.5-8.7V6.5L12 3.8Z" />
            <path d="m9.5 12 1.8 1.8 3.4-3.6" />
          </svg>
        );
      case 6:
        return (
          <svg {...commonProps}>
            <path d="M5 17.5 4 20l3.2-1.2A8 8 0 1 0 5 17.5Z" />
            <path d="M10.2 9.8a2 2 0 0 1 3.7 1c0 1.4-1.9 1.7-1.9 3" />
            <circle cx="12" cy="15.7" r="0.7" fill="currentColor" stroke="none" />
          </svg>
        );
      default:
        return (
          <svg {...commonProps}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5v4.8l3.2 1.9" />
          </svg>
        );
    }
  }

  if (section === 'guidance') {
    switch (index) {
      case 0:
        return (
          <svg {...commonProps}>
            <circle cx="12" cy="10" r="4.5" />
            <path d="M9.5 14.2 10 18h4l.5-3.8" />
            <path d="M10.5 20.2h3" />
          </svg>
        );
      case 1:
        return (
          <svg {...commonProps}>
            <path d="M12 20v-7" />
            <path d="M12 13 6 7M12 13l6-6" />
            <path d="M6 10.5V7h3.5M14.5 7H18v3.5" />
          </svg>
        );
      case 2:
        return (
          <svg {...commonProps}>
            <path d="M4 15c2.2-5 5-5 7.5 0s5.5 5 8.5-2" />
            <circle cx="19.5" cy="9.5" r="1.5" />
          </svg>
        );
      case 3:
        return (
          <svg {...commonProps}>
            <path d="M12 20V10" />
            <path d="M12 13c-3.8 0-6-2.5-6-6 3.5 0 6 2.2 6 6Z" />
            <path d="M12 11c3.5 0 5.5-2.2 5.5-5.5-3.2 0-5.5 2-5.5 5.5Z" strokeOpacity="0.65" />
          </svg>
        );
      case 4:
        return (
          <svg {...commonProps}>
            <circle cx="12" cy="12" r="8" strokeOpacity="0.4" />
            <circle cx="12" cy="12" r="4" strokeOpacity="0.8" />
            <path d="m12 12 7-7M15.5 5H19v3.5" />
          </svg>
        );
      default:
        return (
          <svg {...commonProps}>
            <circle cx="12" cy="6.5" r="2.2" />
            <circle cx="6.5" cy="16.5" r="2.2" />
            <circle cx="17.5" cy="16.5" r="2.2" />
            <path d="M10.4 8.3 7.7 14.4M13.6 8.3l2.7 6.1M8.8 16.5h6.4" strokeOpacity="0.6" />
          </svg>
        );
    }
  }

  switch (index) {
    case 0:
      return (
        <svg {...commonProps}>
          <path d="M8.5 17.5A6.5 6.5 0 1 1 18.5 12" />
          <path d="M10.5 14.5A3.2 3.2 0 1 1 15.2 12" />
          <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 1:
      return (
        <svg {...commonProps}>
          <path d="M4 9.5h11a2.5 2.5 0 1 0-2.5-2.5" />
          <path d="M4 14.5h14a2.5 2.5 0 1 1-2.5 2.5" strokeOpacity="0.7" />
        </svg>
      );
    case 2:
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="3.8" />
          <path
            d="M12 4v2.2M12 17.8V20M4 12h2.2M17.8 12H20M6.4 6.4l1.5 1.5M16.1 16.1l1.5 1.5M17.6 6.4l-1.5 1.5M7.9 16.1l-1.5 1.5"
            strokeOpacity="0.75"
          />
        </svg>
      );
    case 3:
      return (
        <svg {...commonProps}>
          <path d="M17.5 14.8A6.8 6.8 0 0 1 9.2 6.5a6.8 6.8 0 1 0 8.3 8.3Z" />
          <path d="M5 19.5h14" strokeOpacity="0.4" />
        </svg>
      );
    case 4:
      return (
        <svg {...commonProps}>
          <path d="M4.5 14.5V8a2.5 2.5 0 0 1 2.5-2.5h7a2.5 2.5 0 0 1 2.5 2.5v4a2.5 2.5 0 0 1-2.5 2.5H8l-3.5 2.5Z" />
          <path d="M14 16.5h2.5L19.5 19v-2.5a2 2 0 0 0 1.5-2v-3a2 2 0 0 0-2-2" strokeOpacity="0.6" />
        </svg>
      );
    default:
      return (
        <svg {...commonProps}>
          <path d="M6 10.5h9.5v4.2a4.75 4.75 0 0 1-9.5 0v-4.2Z" />
          <path d="M15.5 11.5h1.8a1.7 1.7 0 0 1 0 3.4h-1.8" />
          <path d="M8.5 7.5c0-1 .8-1.5.8-2.5M12 7.5c0-1 .8-1.5.8-2.5" strokeOpacity="0.65" />
          <path d="M5 19.5h12" strokeOpacity="0.4" />
        </svg>
      );
  }
};

const FlagshipHomePage: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroScrollY, setHeroScrollY] = useState(0);
  const [activeNav, setActiveNav] = useState<NavSectionId>('home');
  const [activeBackdrop] = useState<HeroBackdropOption>(() => pickRandomBackdrop());
  const manualNavLockUntilRef = React.useRef<number>(0);

  // Pillar 1: 6 Astrological Tradition Card Tabs
  const [activeSystemId, setActiveSystemId] = useState<AstrologySystemId>('vedic');

  // Pillar 2: One-on-One Consultation Scrollable Chat (4 full transcripts)
  const [consultationTabId, setConsultationTabId] = useState<string>(
    FLAGSHIP_CONSULTATION_SCENARIOS[0].id
  );
  const consultationScrollRef = React.useRef<HTMLDivElement>(null);

  // Pillar 3: Strategic Guidance Scrollable Chat (4 full transcripts)
  const [guidanceTabId, setGuidanceTabId] = useState<string>(FLAGSHIP_GUIDANCE_SCENARIOS[0].id);
  const guidanceScrollRef = React.useRef<HTMLDivElement>(null);

  // Pillar 4: Emotional Support Scrollable Chat (4 full transcripts)
  const [supportTabId, setSupportTabId] = useState<string>(FLAGSHIP_SUPPORT_SCENARIOS[0].id);
  const supportScrollRef = React.useRef<HTMLDivElement>(null);

  const activeTradition = useMemo(
    () => TRADITION_CARDS.find((s) => s.id === activeSystemId) || TRADITION_CARDS[0],
    [activeSystemId]
  );

  const activeConsultation = useMemo(
    () =>
      FLAGSHIP_CONSULTATION_SCENARIOS.find((s) => s.id === consultationTabId) ||
      FLAGSHIP_CONSULTATION_SCENARIOS[0],
    [consultationTabId]
  );

  const activeGuidance = useMemo(
    () =>
      FLAGSHIP_GUIDANCE_SCENARIOS.find((s) => s.id === guidanceTabId) ||
      FLAGSHIP_GUIDANCE_SCENARIOS[0],
    [guidanceTabId]
  );

  const activeSupport = useMemo(
    () =>
      FLAGSHIP_SUPPORT_SCENARIOS.find((s) => s.id === supportTabId) ||
      FLAGSHIP_SUPPORT_SCENARIOS[0],
    [supportTabId]
  );

  useEffect(() => {
    if (consultationScrollRef.current) consultationScrollRef.current.scrollTop = 0;
  }, [activeConsultation.id]);

  useEffect(() => {
    if (guidanceScrollRef.current) guidanceScrollRef.current.scrollTop = 0;
  }, [activeGuidance.id]);

  useEffect(() => {
    if (supportScrollRef.current) supportScrollRef.current.scrollTop = 0;
  }, [activeSupport.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const sectionIds: Array<Exclude<NavSectionId, 'home'>> = [
      'birthchart',
      'consultation',
      'guidance',
      'support',
      'pricing',
    ];

    let rafId = 0;
    const updateOnScroll = () => {
      rafId = 0;
      if (!reducedMotion) {
        setHeroScrollY(Math.min(window.scrollY, 700));
      }

      if (Date.now() < manualNavLockUntilRef.current) return;

      if (window.scrollY < 160) {
        setActiveNav('home');
        return;
      }

      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 40) {
        setActiveNav('pricing');
        return;
      }

      const threshold = window.innerHeight * 0.36;
      let current: NavSectionId = 'home';
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= threshold) {
          current = id;
        }
      }
      setActiveNav(current);
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(updateOnScroll);
    };

    updateOnScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const scrollToHome = () => {
    manualNavLockUntilRef.current = Date.now() + 750;
    setActiveNav('home');
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (id: Exclude<NavSectionId, 'home'>) => {
    manualNavLockUntilRef.current = Date.now() + 750;
    setActiveNav(id);
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const isDarkHero = activeBackdrop.tone === 'dark';

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#3D3830] font-['Plus_Jakarta_Sans',sans-serif] selection:bg-[#EAE3D7] flex flex-col overflow-x-clip">
      {/* Three-Zone Frosted Top Bar */}
      <header className="fixed top-0 inset-x-0 z-40 w-full px-4 md:px-8 pt-3.5 sm:pt-4 animate-cc-slide-down">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-6 rounded-2xl bg-[#EAE3D7]/95 backdrop-blur-xl px-5 py-3 border border-[#3D3830]/15 shadow-[0_8px_28px_-10px_rgba(61,56,48,0.14)]">
          <Link
            to="/"
            onClick={scrollToHome}
            className="font-['Cormorant_Garamond',serif] text-xl font-medium tracking-tight text-[#3D3830] whitespace-nowrap shrink-0 transition-opacity duration-200 hover:opacity-80"
          >
            Cosmic Council
          </Link>

          <nav className="hidden md:flex items-center gap-4 lg:gap-6">
            <Link
              to="/"
              onClick={scrollToHome}
              aria-current={activeNav === 'home' ? 'page' : undefined}
              className={`text-sm py-1 border-b-2 transition-colors duration-200 whitespace-nowrap shrink-0 ${
                activeNav === 'home'
                  ? 'font-semibold text-[#26201A] border-[#3D3830]'
                  : 'font-medium text-[#5C5449] border-transparent hover:text-[#3D3830] hover:border-[#3D3830]/35'
              }`}
            >
              Home
            </Link>
            <Link
              to="/home-2"
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] py-1 border-b-2 border-transparent hover:border-[#3D3830]/35 transition-colors duration-200 whitespace-nowrap shrink-0"
            >
              Home #2
            </Link>
            <Link
              to="/home-3"
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] py-1 border-b-2 border-transparent hover:border-[#3D3830]/35 transition-colors duration-200 whitespace-nowrap shrink-0"
            >
              Home #3
            </Link>
            {(
              [
                { id: 'birthchart', label: 'Birth Chart' },
                { id: 'consultation', label: 'Consultation' },
                { id: 'guidance', label: 'Guidance' },
                { id: 'support', label: 'Support' },
                { id: 'pricing', label: 'Pricing' },
              ] as const
            ).map((item) => {
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  aria-current={isActive ? 'location' : undefined}
                  className={`text-sm py-1 border-b-2 transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'font-semibold text-[#26201A] border-[#3D3830]'
                      : 'font-medium text-[#5C5449] border-transparent hover:text-[#3D3830] hover:border-[#3D3830]/35'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

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
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] text-[#3D3830] hover:bg-[#F1ECE3] active:scale-95 transition-all duration-200 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden mx-auto max-w-7xl mt-2 rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 shadow-lg space-y-4 animate-cc-drawer-in">
            <div className="grid grid-cols-2 gap-2.5 text-sm">
              <Link
                to="/"
                onClick={scrollToHome}
                aria-current={activeNav === 'home' ? 'page' : undefined}
                className={`text-left rounded-xl px-3 py-2 transition-colors ${
                  activeNav === 'home'
                    ? 'bg-[#EAE3D7]/80 font-semibold text-[#26201A]'
                    : 'font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3]/60'
                }`}
              >
                Home
              </Link>
              <Link
                to="/home-2"
                onClick={() => setMobileMenuOpen(false)}
                className="text-left rounded-xl px-3 py-2 font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3]/60 transition-colors"
              >
                Home #2
              </Link>
              <Link
                to="/home-3"
                onClick={() => setMobileMenuOpen(false)}
                className="text-left rounded-xl px-3 py-2 font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3]/60 transition-colors"
              >
                Home #3
              </Link>
              {(
                [
                  { id: 'birthchart', label: 'Birth Chart' },
                  { id: 'consultation', label: 'Consultation' },
                  { id: 'guidance', label: 'Guidance' },
                  { id: 'support', label: 'Support' },
                  { id: 'pricing', label: 'Pricing' },
                ] as const
              ).map((item) => {
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    aria-current={isActive ? 'location' : undefined}
                    className={`text-left rounded-xl px-3 py-2 cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#EAE3D7]/80 font-semibold text-[#26201A]'
                        : 'font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3]/60'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
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
        {/* ================================================================
            HERO SECTION (Preserved Unchanged as Requested)
            ================================================================ */}
        <section
          className={`relative min-h-[86svh] sm:min-h-[90svh] flex flex-col justify-between overflow-hidden transition-colors duration-300 ${activeBackdrop.canvasBgClass}`}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 will-change-transform motion-reduce:transform-none"
            style={{
              transform: `translate3d(0, ${(heroScrollY * 0.14).toFixed(1)}px, 0) scale(${(
                1.03 +
                heroScrollY * 0.00008
              ).toFixed(4)})`,
            }}
          >
            <img
              key={activeBackdrop.id}
              src={activeBackdrop.imageUrl}
              alt={activeBackdrop.imageAlt}
              loading="eager"
              referrerPolicy="no-referrer"
              className={`h-full w-full object-cover transition-opacity duration-300 ${activeBackdrop.objectPositionClass}`}
            />
          </div>

          <div
            aria-hidden="true"
            className={`md:hidden pointer-events-none absolute inset-0 ${
              isDarkHero
                ? 'bg-[linear-gradient(180deg,rgba(20,22,28,0.95)_0%,rgba(20,22,28,0.88)_54%,rgba(20,22,28,0.52)_80%,rgba(20,22,28,0.28)_100%)]'
                : 'bg-[linear-gradient(180deg,rgba(250,247,242,0.96)_0%,rgba(250,247,242,0.90)_54%,rgba(250,247,242,0.54)_80%,rgba(250,247,242,0.22)_100%)]'
            }`}
          />

          <div
            aria-hidden="true"
            className={`hidden md:block pointer-events-none absolute inset-0 ${
              isDarkHero
                ? 'bg-[linear-gradient(90deg,rgba(20,22,28,0.95)_0%,rgba(20,22,28,0.86)_38%,rgba(20,22,28,0.48)_64%,rgba(20,22,28,0.12)_88%,rgba(20,22,28,0.04)_100%)]'
                : 'bg-[linear-gradient(90deg,rgba(250,247,242,0.96)_0%,rgba(250,247,242,0.90)_38%,rgba(250,247,242,0.58)_60%,rgba(250,247,242,0.14)_84%,rgba(250,247,242,0.04)_100%)]'
            }`}
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#FAF7F2] via-[#FAF7F2]/65 to-transparent"
          />

          <div className="relative z-10 mx-auto w-full max-w-7xl px-5 sm:px-8 pt-28 sm:pt-36 md:pt-40 pb-10 sm:pb-14">
            <div className="max-w-[40rem] space-y-6 sm:space-y-7 animate-cc-slide-up">
              <h1
                className={`font-['Cormorant_Garamond',serif] text-[clamp(2.65rem,6vw,4.9rem)] font-medium leading-[1.02] tracking-[-0.02em] ${
                  isDarkHero ? 'text-[#FAF7F2]' : 'text-[#26201A]'
                }`}
                style={{ textWrap: 'balance' }}
              >
                <span className="block">{HERO_CONTENT.headlineLine1}</span>
                <span className="block">{HERO_CONTENT.headlineLine2}</span>
              </h1>

              <p
                className={`max-w-[54ch] text-[15px] sm:text-lg leading-[1.68] ${
                  isDarkHero ? 'text-[#E8E1D5]' : 'text-[#3D352C]'
                }`}
              >
                {HERO_CONTENT.body}
              </p>

              <div className="pt-1 flex flex-wrap items-center gap-3.5">
                <Link
                  to="/app/login"
                  className="group inline-flex min-h-[48px] items-center gap-2.5 rounded-full bg-[#4A453D] px-6 py-3 text-sm font-medium text-[#FAF7F2] transition-all duration-200 hover:bg-[#38342E] active:scale-[0.98] whitespace-nowrap"
                >
                  <span>Login with Gmail</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
                <Link
                  to="/app/home?preview=1"
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-[#3D3830]/20 bg-[#FDFBF7]/85 backdrop-blur-sm px-5 py-3 text-sm font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors whitespace-nowrap"
                >
                  <span>Live preview</span>
                </Link>
              </div>
            </div>
          </div>

          <div className="relative z-10 h-10 sm:h-12" aria-hidden="true" />
        </section>

        {/* COMPACT FOUR-PILLAR DOORWAYS */}
        <section className="bg-[#FAF7F2] border-b border-[#3D3830]/10 py-8 sm:py-10">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {(
                [
                  {
                    id: 'birthchart',
                    title: 'Deep Birth Chart Analysis',
                    meta: '600+ chart data points · 6 traditions',
                  },
                  {
                    id: 'consultation',
                    title: 'One-on-One Consultation',
                    meta: 'Personal astrologers & spiritual guides',
                  },
                  {
                    id: 'guidance',
                    title: 'Strategic Guidance',
                    meta: 'Decisions, career & real solutions',
                  },
                  {
                    id: 'support',
                    title: 'Emotional Support',
                    meta: 'Someone warm to talk to anytime',
                  },
                ] as const
              ).map((pillar) => (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => scrollToSection(pillar.id)}
                  className="group text-left rounded-2xl border border-[#3D3830]/10 bg-[#FDFBF7] px-4 py-4 sm:px-5 sm:py-4 hover:border-[#3D3830]/28 hover:bg-[#F4EFE6]/70 transition-all duration-200 cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-['Cormorant_Garamond',serif] text-lg sm:text-xl font-medium text-[#3D3830] leading-tight">
                      {pillar.title}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-1 text-[#8B8275] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[#3D3830]" />
                  </div>
                  <p className="mt-1.5 text-xs text-[#6B6256]">{pillar.meta}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================
            PILLAR 1 — DEEP BIRTH CHART ANALYSIS
            ================================================================ */}
        <section
          id="birthchart"
          className="scroll-mt-24 bg-gradient-to-b from-[#FAF7F2] via-[#F6F1E8] to-[#F4EFE6] pt-16 sm:pt-24 pb-20 sm:pb-28"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8 space-y-14 sm:space-y-20">
            {/* Primary Section Headline + Supporting Editorial Headline */}
            <EditorialReveal>
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
            </EditorialReveal>

            {/* Large Interactive Birth Chart Demonstration */}
            <EditorialReveal delay={70}>
              <div className="rounded-3xl border border-[#3D3830]/14 bg-[#FDFBF7] p-4 sm:p-6 lg:p-8 space-y-6 shadow-[0_24px_60px_-34px_rgba(61,56,48,0.22)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#3D3830]/10">
                  <div>
                    <p className="text-xs font-medium text-[#6B5A45]">Interactive Birth Chart Engine</p>
                    <p className="font-['Cormorant_Garamond',serif] text-xl sm:text-2xl font-medium text-[#3D3830]">
                      Explore multi-layer Vedic &amp; Western calculations live
                    </p>
                  </div>
                  <p className="font-['JetBrains_Mono',monospace] tabular-nums text-xs text-[#6B6256]">
                    D1 · D9 · D10 · Shadbala · KP · Jaimini · Transits
                  </p>
                </div>

                <ChartViewer
                  key={`${activeTradition.viewerMode}-${activeTradition.viewerVedicTab || 'default'}`}
                  chart={PREVIEW_CHART_JSON}
                  dailyTransits={PREVIEW_DAILY_TRANSITS}
                  initialMode={activeTradition.viewerMode}
                  initialVedicTab={activeTradition.viewerVedicTab}
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-[#3D3830]/10">
                  <p className="max-w-3xl text-sm leading-relaxed text-[#4C443B]">
                    {BIRTHCHART_CONTENT.closingLead}
                  </p>
                  <Link
                    to="/app/home?preview=1"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3D3830] underline underline-offset-4 hover:text-[#5C5449] whitespace-nowrap shrink-0"
                  >
                    <span>Explore full app preview</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </EditorialReveal>

            {/* 6 Astrological Tradition Card Tabs (Icons & Text Only) */}
            <EditorialReveal delay={80}>
              <div
                role="tablist"
                aria-label="Astrological systems supported"
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4"
              >
                {TRADITION_CARDS.map((card) => {
                  const selected = card.id === activeTradition.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setActiveSystemId(card.id)}
                      className={`group rounded-2xl border px-4 py-6 flex flex-col items-center justify-center text-center gap-3 transition-all duration-200 cursor-pointer ${
                        selected
                          ? 'border-[#3D3830]/35 bg-[#FDFBF7] text-[#3D3830] shadow-[0_14px_34px_-20px_rgba(61,56,48,0.28)]'
                          : 'border-[#3D3830]/10 bg-[#FDFBF7]/80 text-[#5C5449] hover:border-[#3D3830]/25 hover:bg-[#FDFBF7] hover:text-[#3D3830]'
                      }`}
                    >
                      <span
                        className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${
                          selected
                            ? 'bg-[#EAE3D7] border-[#3D3830]/15 text-[#3D3830]'
                            : 'bg-[#F1ECE3] border-[#3D3830]/10 text-[#6E5B43] group-hover:text-[#3D3830]'
                        }`}
                      >
                        <TraditionIcon id={card.id} />
                      </span>
                      <span className="text-sm sm:text-base font-medium tracking-tight whitespace-nowrap">
                        {card.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </EditorialReveal>

            {/* Technical Differentiators — Highlighted & Prominent Observatory Feature Block */}
            <EditorialReveal delay={90}>
              <div className="rounded-3xl bg-gradient-to-br from-[#1F2229] via-[#242832] to-[#292D36] text-[#F4EFE6] p-7 sm:p-10 lg:p-14 border border-[#3D3830]/20 shadow-[0_28px_70px_-30px_rgba(31,34,41,0.45)] grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
                <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-28">
                  <div className="h-px w-12 bg-[#B8965A]" aria-hidden="true" />
                  <h3
                    className="font-['Cormorant_Garamond',serif] text-[clamp(2rem,3.6vw,3rem)] font-medium leading-[1.08] text-[#F4EFE6]"
                    style={{ textWrap: 'balance' }}
                  >
                    {BIRTHCHART_CONTENT.depthHeading}
                  </h3>
                  <p className="text-sm sm:text-base leading-[1.72] text-[#D2CBC0]">
                    {BIRTHCHART_CONTENT.depthIntro}
                  </p>
                </div>

                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  {BIRTHCHART_CONTENT.features.map((item, idx) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 sm:p-6 flex flex-col items-start text-left space-y-3 transition-colors duration-200 hover:bg-white/[0.07] hover:border-[#B8965A]/35"
                    >
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#B8965A]/15 border border-[#B8965A]/30 text-[#D6B77D]">
                        <FlagshipIcon section="birthchart" index={idx} />
                      </span>
                      <h4 className="text-base font-semibold text-[#F4EFE6] leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-sm leading-relaxed text-[#C8C0B4]">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </EditorialReveal>
          </div>
        </section>

        {/* ================================================================
            PILLAR 2 — ONE-ON-ONE CONSULTATION
            (Exclusively Personal Astrological & Spiritual Consultations)
            ================================================================ */}
        <section
          id="consultation"
          className="scroll-mt-24 bg-[#FDFBF7] pt-20 sm:pt-28 pb-20 sm:pb-28 border-t border-[#3D3830]/10"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8 space-y-16 sm:space-y-24">
            {/* Primary Headline + Storytelling Lead */}
            <EditorialReveal>
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
            </EditorialReveal>

            {/* Interactive Astrological Consultation Showcase (Composition A: Left Portrait / Right Scrollable Long Dialogue) */}
            <EditorialReveal delay={70}>
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div
                    role="tablist"
                    aria-label="Astrological consultation topics"
                    className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#EFE8DA]/85 p-1.5 border border-[#3D3830]/10"
                  >
                    {FLAGSHIP_CONSULTATION_SCENARIOS.map((scenario) => {
                      const selected = scenario.id === activeConsultation.id;
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
                  </div>
                </div>

                <div
                  key={activeConsultation.id}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start rounded-3xl border border-[#3D3830]/12 bg-[#FAF7F2] p-5 sm:p-8 lg:p-10 animate-cc-tab-panel"
                >
                  {/* Left: Large 3:4 Astrologer Portrait */}
                  <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                    <div className="aspect-[3/4] w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-[#3D3830]/10">
                      <EditorialImage
                        src={activeConsultation.portraitUrl}
                        alt={activeConsultation.portraitAlt}
                        className="h-full w-full"
                        imgClassName="object-top"
                      />
                    </div>
                    <div className="flex items-end justify-between gap-3 px-1">
                      <div>
                        <p className="font-['Cormorant_Garamond',serif] text-2xl sm:text-3xl font-medium text-[#3D3830] leading-tight">
                          {activeConsultation.companionName}
                        </p>
                        <p className="text-xs sm:text-sm text-[#6B6256] mt-0.5">
                          {activeConsultation.companionRole}
                        </p>
                      </div>
                      <Link
                        to="/app/login"
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors whitespace-nowrap shrink-0"
                      >
                        <span>Consult {activeConsultation.companionName}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Right: Long Scrollable Astrological Consultation Dialogue */}
                  <div className="lg:col-span-7 flex flex-col justify-between gap-4 lg:pl-4">
                    <div className="space-y-1.5 pb-4 border-b border-[#3D3830]/10">
                      <p className="text-xs font-medium text-[#8B8275]">
                        {activeConsultation.situationLabel}
                      </p>
                      <h3 className="font-['Cormorant_Garamond',serif] text-2xl sm:text-3xl font-medium text-[#3D3830] leading-snug">
                        {activeConsultation.heading}
                      </h3>
                    </div>

                    <div
                      ref={consultationScrollRef}
                      tabIndex={0}
                      aria-label={`${activeConsultation.companionName} consultation conversation`}
                      className="h-[430px] sm:h-[490px] lg:h-[520px] overflow-y-auto cc-chat-scroll bg-transparent pr-2 sm:pr-3 py-4 focus:outline-none"
                      style={{
                        maskImage:
                          'linear-gradient(to bottom, transparent 0%, black 16px, black calc(100% - 22px), transparent 100%)',
                        WebkitMaskImage:
                          'linear-gradient(to bottom, transparent 0%, black 16px, black calc(100% - 22px), transparent 100%)',
                      }}
                    >
                      {activeConsultation.lines.map((line, index) => {
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
                                  : 'bg-[#FDFBF7] text-[#3D3830] border border-[#3D3830]/10 rounded-bl-sm'
                              }`}
                            >
                              {line.text}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-3.5 border-t border-[#3D3830]/10 flex flex-wrap items-center justify-between gap-3 text-xs text-[#6B6256]">
                      <span>Scroll to read full consultation</span>
                      <Link
                        to="/app/home?preview=1"
                        className="font-medium text-[#3D3830] underline underline-offset-4 hover:text-[#5C5449] whitespace-nowrap"
                      >
                        Try in workspace preview
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </EditorialReveal>

            {/* Dedicated Carousel — Spiritual Guides */}
            <EditorialReveal>
              <div className="rounded-3xl bg-[#FAF7F2] border border-[#3D3830]/10 p-5 sm:p-8">
                <CompanionCarousel
                  title="Meet your spiritual guides."
                  items={SPIRITUAL_GUIDES_CAROUSEL}
                  caption="Personal astrologers, esoteric specialists, and spiritual guides across Vedic, Western, Evolutionary, and Tarot traditions."
                />
              </div>
            </EditorialReveal>

            {/* 8 Consultation-Specific Benefits */}
            <div className="pt-8 border-t border-[#3D3830]/12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-9">
              {CONSULTATION_CONTENT.features.map((item, idx) => (
                <EditorialReveal
                  key={item.title}
                  delay={(idx % 4) * 65}
                  className="flex flex-col items-start text-left space-y-2.5"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFE8DA]/80 border border-[#3D3830]/10 text-[#6E5B43]">
                    <FlagshipIcon section="consultation" index={idx} />
                  </span>
                  <h4 className="text-base font-semibold text-[#3D3830] leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-sm leading-relaxed text-[#5C5449]">{item.description}</p>
                </EditorialReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================
            PILLAR 3 — STRATEGIC GUIDANCE (Soft Sage Mist · Distinctly Action-Oriented)
            ================================================================ */}
        <section
          id="guidance"
          className="scroll-mt-24 bg-gradient-to-b from-[#F2F3EE] via-[#EFF2EC] to-[#EEF1EB] pt-20 sm:pt-28 pb-20 sm:pb-28 border-t border-[#3D3830]/8"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8 space-y-16 sm:space-y-24">
            {/* Primary Headline + Action-Oriented Lead */}
            <EditorialReveal>
              <div className="max-w-3xl space-y-4 text-left">
                <h2
                  className="font-['Cormorant_Garamond',serif] text-[clamp(2.5rem,5.4vw,4.35rem)] font-medium leading-[1.02] tracking-tight text-[#343A32]"
                  style={{ textWrap: 'balance' }}
                >
                  Strategic Guidance
                </h2>
                <p className="text-base sm:text-lg leading-[1.68] text-[#4E574B]">
                  While astrology can help us give more clarity on why things are happening, what to
                  expect and how long certain phases will last but at the end of the day we need to
                  strategize, act and proactively work on solving our problems
                </p>
              </div>
            </EditorialReveal>

            {/* Interactive Strategic Guidance Conversation Showcase
                (Composition B: Visually Distinct — Scrollable Dialogue Left / Companion Right Strategy Frame) */}
            <EditorialReveal delay={70}>
              <div className="space-y-6">
                {/* Situation Switcher Tabs */}
                <div
                  role="tablist"
                  aria-label="Strategic guidance situations"
                  className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#E2E8DE]/85 p-1.5 border border-[#343A32]/10"
                >
                  {FLAGSHIP_GUIDANCE_SCENARIOS.map((scenario) => {
                    const selected = scenario.id === activeGuidance.id;
                    return (
                      <button
                        key={scenario.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setGuidanceTabId(scenario.id)}
                        className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          selected
                            ? 'bg-[#FAFBF8] text-[#343A32] shadow-xs'
                            : 'text-[#4E574B] hover:text-[#343A32]'
                        }`}
                      >
                        {scenario.situationLabel}
                      </button>
                    );
                  })}
                </div>

                {/* Reversed Asymmetric Card: Left Scrollable Dialogue / Right Portrait */}
                <div
                  key={activeGuidance.id}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start rounded-3xl border border-[#343A32]/12 bg-[#FAFBF8] p-5 sm:p-8 lg:p-10 animate-cc-tab-panel"
                >
                  {/* Left: Long Scrollable Strategy Dialogue Column */}
                  <div className="lg:col-span-7 lg:order-1 order-2 flex flex-col justify-between gap-4 lg:pr-4">
                    <div className="space-y-1.5 pb-4 border-b border-[#343A32]/10">
                      <p className="text-xs font-medium text-[#4B5847]">
                        {activeGuidance.situationLabel} · {activeGuidance.companionRole}
                      </p>
                      <h4 className="font-['Cormorant_Garamond',serif] text-2xl sm:text-3xl font-medium text-[#343A32] leading-snug">
                        {activeGuidance.heading}
                      </h4>
                    </div>

                    <div
                      ref={guidanceScrollRef}
                      tabIndex={0}
                      aria-label={`${activeGuidance.companionName} strategic guidance conversation`}
                      className="h-[430px] sm:h-[490px] lg:h-[520px] overflow-y-auto cc-chat-scroll bg-transparent pr-2 sm:pr-3 py-4 focus:outline-none"
                      style={{
                        maskImage:
                          'linear-gradient(to bottom, transparent 0%, black 16px, black calc(100% - 22px), transparent 100%)',
                        WebkitMaskImage:
                          'linear-gradient(to bottom, transparent 0%, black 16px, black calc(100% - 22px), transparent 100%)',
                      }}
                    >
                      {activeGuidance.lines.map((line, index) => {
                        const isUser = line.sender === 'user';
                        const prevSameSender =
                          index > 0 && activeGuidance.lines[index - 1].sender === line.sender;
                        return (
                          <div
                            key={`${activeGuidance.id}-${index}`}
                            className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${
                              index === 0 ? '' : prevSameSender ? 'mt-2' : 'mt-4'
                            }`}
                          >
                            <p
                              className={`max-w-[90%] sm:max-w-[82%] rounded-2xl px-4 sm:px-5 py-3 text-[15px] sm:text-base leading-[1.6] ${
                                isUser
                                  ? 'bg-[#DCE4D7] text-[#2F362D] rounded-br-sm'
                                  : 'bg-[#FFFFFF] text-[#343A32] border border-[#343A32]/12 rounded-bl-sm'
                              }`}
                            >
                              {line.text}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-3.5 border-t border-[#343A32]/10 flex flex-wrap items-center justify-between gap-3 text-xs text-[#4E574B]">
                      <span>Scroll to read full conversation</span>
                      <Link
                        to="/app/login"
                        className="inline-flex items-center gap-1.5 font-medium text-[#343A32] underline underline-offset-4 hover:text-[#4B5847] whitespace-nowrap"
                      >
                        <span>Start a strategy session</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Right: Companion Portrait Card */}
                  <div className="lg:col-span-5 lg:order-2 order-1 flex flex-col justify-between gap-4">
                    <div className="aspect-[3/4] w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-[#343A32]/12">
                      <EditorialImage
                        src={activeGuidance.portraitUrl}
                        alt={activeGuidance.portraitAlt}
                        className="h-full w-full"
                        imgClassName="object-top"
                      />
                    </div>
                    <div className="flex items-end justify-between gap-3 px-1">
                      <div>
                        <p className="font-['Cormorant_Garamond',serif] text-2xl sm:text-3xl font-medium text-[#343A32] leading-tight">
                          {activeGuidance.companionName}
                        </p>
                        <p className="text-xs sm:text-sm text-[#4E574B] mt-0.5">
                          {activeGuidance.companionRole}
                        </p>
                      </div>
                      <Link
                        to="/app/login"
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#343A32] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#262B25] transition-colors whitespace-nowrap shrink-0"
                      >
                        <span>Talk to {activeGuidance.companionName}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </EditorialReveal>

            {/* Dedicated Carousel — Life Companions */}
            <EditorialReveal>
              <div className="rounded-3xl bg-[#E7ECE3]/80 border border-[#343A32]/10 p-5 sm:p-8">
                <CompanionCarousel
                  title="Meet your life companions."
                  items={LIFE_COMPANIONS_CAROUSEL}
                  caption="Thought partners, mentors, and domain-focused guides to help you think clearly, weigh real options, and act with conviction."
                />
              </div>
            </EditorialReveal>

            {/* 8 Strategic Areas of Life */}
            <EditorialReveal>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                {STRATEGIC_LIFE_AREAS.map(({ title, icon: Icon }) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-[#343A32]/12 bg-[#FAFBF8] px-4 py-4 flex flex-col items-start gap-2.5"
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#E4EAE0] text-[#4B5847]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="text-sm font-semibold text-[#343A32]">{title}</p>
                  </div>
                ))}
              </div>
            </EditorialReveal>

            {/* 6 Practical Strategic Guidance Benefits */}
            <div className="pt-8 border-t border-[#343A32]/12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
              {GUIDANCE_CONTENT.features.map((item, idx) => (
                <EditorialReveal
                  key={item.title}
                  delay={(idx % 3) * 70}
                  className="pt-5 border-t border-[#343A32]/10 flex flex-col items-start text-left space-y-2.5"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E2E8DE]/80 border border-[#343A32]/10 text-[#4B5847]">
                    <FlagshipIcon section="guidance" index={idx} />
                  </span>
                  <h4 className="text-base font-semibold text-[#343A32] leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-sm leading-relaxed text-[#4E574B]">{item.description}</p>
                </EditorialReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================
            PILLAR 4 — EMOTIONAL SUPPORT (Warm Intimate Linen)
            ================================================================ */}
        <section
          id="support"
          className="scroll-mt-24 bg-gradient-to-b from-[#F5ECE4] via-[#F6ECE4] to-[#F3E7DD] pt-20 sm:pt-28 pb-20 sm:pb-28 border-t border-[#3D3830]/8"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8 space-y-16 sm:space-y-24">
            {/* Primary Headline + Left-Aligned Lead */}
            <EditorialReveal>
              <div className="max-w-3xl space-y-4 text-left">
                <h2
                  className="font-['Cormorant_Garamond',serif] text-[clamp(2.5rem,5.4vw,4.35rem)] font-medium leading-[1.02] tracking-tight text-[#3D342E]"
                  style={{ textWrap: 'balance' }}
                >
                  Emotional Support
                </h2>
                <p className="text-base sm:text-lg leading-[1.7] text-[#5C4C44]">
                  As we grow old in life, we have fewer and fewer people to discuss and share our
                  life with and often we have no one as trusted to share the awkward situations and
                  inner most confusions we&apos;re going through. At CosmicCouncil - it is going to
                  be your safe place to feel understood, energised &amp; uplifted.
                </p>
              </div>
            </EditorialReveal>

            {/* Evocative Warm Sunlit Photography */}
            <EditorialReveal delay={60}>
              <ParallaxFrame
                strength={14}
                className="aspect-[16/10] sm:aspect-[16/8.5] w-full rounded-3xl border border-[#3D342E]/12"
              >
                <EditorialImage
                  src={SUPPORT_CONTENT.windowImageUrl}
                  alt={SUPPORT_CONTENT.windowImageAlt}
                  className="h-full w-full"
                  imgClassName="object-center"
                  warmGrade={false}
                />
              </ParallaxFrame>
            </EditorialReveal>

            {/* Interactive Emotional Support & Everyday Companionship Showcase
                (Composition C: Intimate Journal Stage — Warm Compact Top Header + Scrollable Full Conversation) */}
            <EditorialReveal delay={80}>
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div
                    role="tablist"
                    aria-label="Emotional support situations"
                    className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#ECDFD3]/85 p-1.5 border border-[#3D342E]/10"
                  >
                    {FLAGSHIP_SUPPORT_SCENARIOS.map((scenario) => {
                      const selected = scenario.id === activeSupport.id;
                      return (
                        <button
                          key={scenario.id}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          onClick={() => setSupportTabId(scenario.id)}
                          className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            selected
                              ? 'bg-[#FDF9F6] text-[#3D342E] shadow-xs'
                              : 'text-[#5C4C44] hover:text-[#3D342E]'
                          }`}
                        >
                          {scenario.situationLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  key={activeSupport.id}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start rounded-3xl border border-[#3D342E]/12 bg-[#FDF9F6] p-5 sm:p-8 lg:p-10 animate-cc-tab-panel"
                >
                  {/* Left: Large 3:4 Companion Portrait */}
                  <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                    <div className="aspect-[3/4] w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-[#3D342E]/12">
                      <EditorialImage
                        src={activeSupport.portraitUrl}
                        alt={activeSupport.portraitAlt}
                        className="h-full w-full"
                        imgClassName={activeSupport.portraitImgClassName || 'object-top'}
                      />
                    </div>
                    <div className="flex items-end justify-between gap-3 px-1">
                      <div>
                        <p className="font-['Cormorant_Garamond',serif] text-2xl sm:text-3xl font-medium text-[#3D342E] leading-tight">
                          {activeSupport.companionName}
                        </p>
                        <p className="text-xs sm:text-sm text-[#7A6659] mt-0.5">
                          {activeSupport.companionRole}
                        </p>
                      </div>
                      <Link
                        to="/app/login"
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors whitespace-nowrap shrink-0"
                      >
                        <span>Chat with {activeSupport.companionName}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Right: Long Scrollable Intimate Dialogue */}
                  <div className="lg:col-span-7 flex flex-col justify-between gap-4 lg:pl-4">
                    <div className="space-y-1.5 pb-4 border-b border-[#3D342E]/10">
                      <p className="text-xs font-medium text-[#7A6659]">
                        {activeSupport.situationLabel}
                      </p>
                      <h3 className="font-['Cormorant_Garamond',serif] text-2xl sm:text-3xl font-medium text-[#3D342E] leading-snug">
                        {activeSupport.heading}
                      </h3>
                    </div>

                    <div
                      ref={supportScrollRef}
                      tabIndex={0}
                      aria-label={`${activeSupport.companionName} support conversation`}
                      className="h-[430px] sm:h-[490px] lg:h-[520px] overflow-y-auto cc-chat-scroll bg-transparent pr-2 sm:pr-3 py-4 focus:outline-none"
                      style={{
                        maskImage:
                          'linear-gradient(to bottom, transparent 0%, black 16px, black calc(100% - 22px), transparent 100%)',
                        WebkitMaskImage:
                          'linear-gradient(to bottom, transparent 0%, black 16px, black calc(100% - 22px), transparent 100%)',
                      }}
                    >
                      {activeSupport.lines.map((line, index) => {
                        const isUser = line.sender === 'user';
                        const prevSameSender =
                          index > 0 && activeSupport.lines[index - 1].sender === line.sender;
                        return (
                          <div
                            key={`${activeSupport.id}-${index}`}
                            className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${
                              index === 0 ? '' : prevSameSender ? 'mt-2' : 'mt-4'
                            }`}
                          >
                            <p
                              className={`max-w-[90%] sm:max-w-[82%] rounded-2xl px-4 sm:px-5 py-3 text-[15px] sm:text-base leading-[1.6] ${
                                isUser
                                  ? 'bg-[#ECE0D6] text-[#3D342E] rounded-br-sm'
                                  : 'bg-[#F9F2EC] text-[#3D342E] border border-[#3D342E]/10 rounded-bl-sm'
                              }`}
                            >
                              {line.text}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-3.5 border-t border-[#3D342E]/10 flex flex-wrap items-center justify-between gap-3 text-xs text-[#7A6659]">
                      <span>Scroll to read full conversation</span>
                      <Link
                        to="/app/home?preview=1"
                        className="font-medium text-[#3D342E] underline underline-offset-4 hover:text-[#5C4C44] whitespace-nowrap"
                      >
                        Try in workspace preview
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </EditorialReveal>

            {/* Dedicated Carousel — Everyday Companions */}
            <EditorialReveal>
              <div className="rounded-3xl bg-[#EFE3D8]/85 border border-[#3D342E]/10 p-5 sm:p-8">
                <CompanionCarousel
                  title="Meet your everyday companions."
                  items={EVERYDAY_COMPANIONS_CAROUSEL}
                  caption="Compassionate listeners, calming presences, and upbeat friends for heavy evenings, quiet reflection, and everyday joy."
                />
              </div>
            </EditorialReveal>

            {/* 6 Emotional & Everyday Companionship Benefits */}
            <div className="pt-8 border-t border-[#3D342E]/12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
              {SUPPORT_CONTENT.features.map((item, idx) => (
                <EditorialReveal
                  key={item.title}
                  delay={(idx % 3) * 70}
                  className="pt-5 border-t border-[#3D342E]/10 flex flex-col items-start text-left space-y-2.5"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ECDFD3]/80 border border-[#3D342E]/10 text-[#6B5449]">
                    <FlagshipIcon section="support" index={idx} />
                  </span>
                  <h4 className="text-base font-semibold text-[#3D342E] leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-sm leading-relaxed text-[#5C4C44]">{item.description}</p>
                </EditorialReveal>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING SECTION */}
        <PricingSection />
      </main>

      {/* QUIET FOOTER */}
      <footer className="border-t border-[#3D3830]/10 bg-[#EFE7DD] py-9">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5C5449]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-['Cormorant_Garamond',serif] text-lg font-medium text-[#3D3830]">
              Cosmic Council
            </span>
            <span aria-hidden="true">·</span>
            <span>Clarity, counsel &amp; emotional companionship</span>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => scrollToSection('pricing')}
              className="hover:text-[#3D3830] transition-colors cursor-pointer"
            >
              Pricing
            </button>
            <Link to="/home-2" className="hover:text-[#3D3830] transition-colors">
              Home #2
            </Link>
            <Link to="/home-3" className="hover:text-[#3D3830] transition-colors">
              Home #3
            </Link>
            <Link to="/blog" className="hover:text-[#3D3830] transition-colors">
              Journal
            </Link>
            <Link to="/privacy" className="hover:text-[#3D3830] transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-[#3D3830] transition-colors">
              Terms
            </Link>
            <Link to="/app/login" className="hover:text-[#3D3830] transition-colors">
              Login
            </Link>
          </div>
        </div>
      </footer>

      <FloatingScrollControls />
    </div>
  );
};

export default FlagshipHomePage;
