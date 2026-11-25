import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Compass,
  Eye,
  Menu,
  MessageSquare,
  Sparkles,
  X,
} from 'lucide-react';
import type { Category, Currency, Product } from '../types';
import type { SanityArticleItem } from '../lib/sanity';
import FloatingScrollControls from './FloatingScrollControls';
import LandingBirthChartCard from './LandingBirthChartCard';
import CompanionAvatar from './app/CompanionAvatar';
import CompanionProfileSheet from './app/CompanionProfileSheet';
import ChartViewer from './app/ChartViewer';
import TarotStyleShowcase from './TarotStyleShowcase';
import {
  PREVIEW_CHART_JSON,
  PREVIEW_DAILY_TRANSITS,
  PREVIEW_PUBLIC_COMPANIONS,
} from './app/previewFixtures';
import { CLIENT_MINI_APPS, renderMiniAppIcon } from './app/miniAppsClientData';
import CompanionDiscoveryControls from './app/CompanionDiscoveryControls';
import {
  matchesCompanionDiscoveryFilter,
  type CompanionDiscoveryTabId,
  type PublicCompanionCard,
} from './app/chatTypes';
import {
  DEFAULT_COMPANION_SPECIALIZATIONS,
  type CompanionSpecializationTag,
} from '../lib/companionV2Schema';
import { updatePendingOnboardingCompanion } from '../lib/pendingOnboarding';

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
  'AI companions to explore and discuss your life',
  "Better understand your life's journey and purpose",
  'Fully private, secure & anonymous',
];

function shuffleFisherYates<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const TRADITION_LENSES = [
  {
    id: 'vedic',
    label: 'Vedic',
    systemNote: 'Parashari · D10 Dasamsa · Ashtakavarga',
    answer:
      'Your 10th house holds Ketu in Gemini while your AmK Jupiter sits with Mercury in Leo. Rather than an impulsive exit, your current Saturn-Jupiter cycle favors consolidating an advisory niche quietly until early autumn, when public recognition sharpens.',
    metrics: 'D10 Lagna Taurus · SAV 10th: 29 bindus · Saturn MD / Jupiter AD',
  },
  {
    id: 'kp',
    label: 'KP',
    systemNote: 'Krishnamurti Paddhati · Cuspal Sub-Lords',
    answer:
      'Your 10th cusp Sub-Lord is Jupiter, signifying houses 2, 4, 7, 9, 10, and 12 through its star lord Venus. That combination strongly supports consulting or independent practice over salaried monotony—especially once Mercury Pratyantardasha activates.',
    metrics: '10th Cusp Gemini 14°08′ · Star Rahu · Sub Jupiter',
  },
  {
    id: 'western',
    label: 'Western',
    systemNote: 'Tropical Placidus · Transits & Aspects',
    answer:
      'With your Virgo Mercury and Venus tightly grouped in the 12th house opposite Aquarius Saturn, clarity arrives when you work behind the scenes first. Give ideas three quiet months to mature before launching outwardly.',
    metrics: 'Sun Leo 21°33′ · Moon Libra 12°39′ · MC Cancer 07°48′',
  },
  {
    id: 'modern',
    label: 'Modern',
    systemNote: 'Evolutionary · Psychological Transits',
    answer:
      'Restlessness here isn’t failure—it’s your Virgo 12th-house stellium outgrowing roles that underuse your analytical voice. Use the next quarter to prototype work that feels self-authored rather than reacting to burnout.',
    metrics: 'North Node Sagittarius 3rd · Saturn Opp. Mercury · Evolutionary Cycle',
  },
  {
    id: 'hellenistic',
    label: 'Hellenistic',
    systemNote: 'Whole Sign Houses · Annual Profections & Time-Lord',
    answer:
      'In a 5th-House Saturn Profection year with the Lot of Fortune anchored in your 11th house of alliances, quiet mastery pays more than a dramatic leap. Build the body of work now while Saturn prepares your next career station.',
    metrics: 'Annual Profection: 5th House · Time-Lord: Saturn · Lot of Fortune: 11th',
  },
] as const;

const LANDING_MINI_APP_SLUGS = [
  'daily-horoscope',
  'current-transits',
  'dasha-analysis',
  'career-navigator',
  'birth-chart-breakdown',
  'birth-chart-matching',
] as const;

const MINI_APP_SAMPLE_OUTPUTS: Record<string, { headline: string; preview: string; focus: string }> = {
  'daily-horoscope': {
    headline: 'Quiet momentum favors finishing one high-focus task before noon',
    preview:
      'With the Moon moving through Shravana across your 5th house, analytical clarity peaks early. Hold major financial talks until after 4:30 PM when emotional friction settles.',
    focus: 'Moon 22°48′ Capricorn · Hasta -> Shravana resonance',
  },
  'current-transits': {
    headline: 'Jupiter’s retrograde review across your 10th house asks for refinement',
    preview:
      'Slow-moving Saturn in your 7th house stabilizes long-term commitments, while retrograde Jupiter re-opens an opportunity or collaboration first discussed four months ago.',
    focus: 'Saturn 11°09′ Pisces · Jupiter 18°42′ Gemini (R)',
  },
  'dasha-analysis': {
    headline: 'Saturn Mahadasha · Jupiter Antardasha (Active through May 2028)',
    preview:
      'Saturn anchors your 5th house of disciplined skill while Jupiter expands advisory reach from the 12th. Growth comes through depth, patience, and teaching rather than shortcuts.',
    focus: 'Mercury Pratyantardasha opens 20 Sep 2026',
  },
  'career-navigator': {
    headline: 'Best fit: Strategic, research-led or independent advisory roles',
    preview:
      'Strong Mercury-Jupiter alignment paired with 10th-cusp sub-lord Jupiter points toward work where complex synthesis turns into clear decisions for others.',
    focus: 'D10 Strength: High · 2/6/10/11 KP links active',
  },
  'birth-chart-breakdown': {
    headline: 'Virgo Ascendant · Steady outer composure, restless analytical depth',
    preview:
      'An Earth-dominant Lagna anchored by Swakshetra Saturn gives you rare endurance. Your blind spot is over-editing decisions out of fear of imperfection.',
    focus: 'Atmakaraka Sun · Amatyakaraka Jupiter',
  },
  'birth-chart-matching': {
    headline: 'Emotional pacing & communication alignment checked across D1 + D9',
    preview:
      'Cross-verifies Moon Nakshatra temperament, Venus-Jupiter synastry, D9 Navamsa stability, and timing overlap across both charts without fear-mongering scores.',
    focus: 'Parashari Synastry · Ashtakoota · D9 Alignment',
  },
};

const NewLandingPage: React.FC<NewLandingPageProps> = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Randomized companions (shuffled once per page load)
  const [specialists, setSpecialists] = useState<PublicCompanionCard[]>(() =>
    shuffleFisherYates(PREVIEW_PUBLIC_COMPANIONS)
  );
  const [activeCompanionGroup, setActiveCompanionGroup] =
    useState<CompanionDiscoveryTabId>('spiritual_guides');
  const [activeSituationChip, setActiveSituationChip] = useState<string | null>(null);
  const [activeCompanionSpecialization, setActiveCompanionSpecialization] = useState<string | null>(null);
  const [companionSpecializations, setCompanionSpecializations] = useState<CompanionSpecializationTag[]>(
    DEFAULT_COMPANION_SPECIALIZATIONS
  );
  const [companionSearchQuery, setCompanionSearchQuery] = useState('');
  const [showAllCompanions, setShowAllCompanions] = useState(false);
  const [selectedCompanionForChart, setSelectedCompanionForChart] =
    useState<PublicCompanionCard | null>(null);
  const [aboutCompanion, setAboutCompanion] = useState<PublicCompanionCard | null>(null);

  // Interactive Showcase State
  const [traditionId, setTraditionId] = useState<string>(TRADITION_LENSES[0].id);
  const [selectedMiniAppSlug, setSelectedMiniAppSlug] = useState<string>(
    LANDING_MINI_APP_SLUGS[0]
  );

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/companions')
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            companions?: PublicCompanionCard[];
            specializations?: CompanionSpecializationTag[];
          } | null
        ) => {
          if (cancelled || !data) return;
          if (Array.isArray(data.companions) && data.companions.length > 0) {
            setSpecialists(shuffleFisherYates(data.companions));
          }
          if (Array.isArray(data.specializations) && data.specializations.length > 0) {
            setCompanionSpecializations(data.specializations);
          }
        }
      )
      .catch(() => {
        // Keep randomized fallback catalog cleanly
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedCompanionForChart) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedCompanionForChart(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedCompanionForChart]);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleOpenCompanionBirthChart = (card: PublicCompanionCard) => {
    updatePendingOnboardingCompanion(card.slug, card.name);
    setAboutCompanion(null);
    setSelectedCompanionForChart(card);
  };

  const activeTradition = useMemo(
    () => TRADITION_LENSES.find((t) => t.id === traditionId) || TRADITION_LENSES[0],
    [traditionId]
  );

  const filteredSpecialists = useMemo(
    () =>
      specialists.filter((card) =>
        matchesCompanionDiscoveryFilter(card, {
          groupTab: activeCompanionGroup,
          situationChipId: activeSituationChip,
          specializationSlug: activeCompanionSpecialization,
          searchQuery: companionSearchQuery,
        })
      ),
    [
      specialists,
      activeCompanionGroup,
      activeSituationChip,
      activeCompanionSpecialization,
      companionSearchQuery,
    ]
  );

  const isDefaultLandingCompanionView =
    !activeCompanionSpecialization &&
    !activeSituationChip &&
    !companionSearchQuery.trim();

  const displayedSpecialists = useMemo(() => {
    if (isDefaultLandingCompanionView && !showAllCompanions) {
      return filteredSpecialists.slice(0, 9);
    }
    return filteredSpecialists;
  }, [filteredSpecialists, isDefaultLandingCompanionView, showAllCompanions]);

  const showcaseMiniApps = useMemo(() => {
    return LANDING_MINI_APP_SLUGS.map((slug) =>
      CLIENT_MINI_APPS.find((a) => a.slug === slug)
    ).filter((a): a is NonNullable<typeof a> => Boolean(a));
  }, []);

  const activeMiniApp = useMemo(
    () =>
      showcaseMiniApps.find((a) => a.slug === selectedMiniAppSlug) ||
      showcaseMiniApps[0],
    [showcaseMiniApps, selectedMiniAppSlug]
  );

  const activeMiniAppSample =
    MINI_APP_SAMPLE_OUTPUTS[activeMiniApp?.slug || 'daily-horoscope'] ||
    MINI_APP_SAMPLE_OUTPUTS['daily-horoscope'];

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
          <nav className="hidden md:flex items-center gap-4 lg:gap-6">
            <Link
              to="/"
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors duration-200 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#3D3830]/40"
            >
              Home
            </Link>
            <Link
              to="/home-2"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-sm font-medium text-[#3D3830] transition-colors duration-200 whitespace-nowrap shrink-0 py-1 border-b border-[#3D3830]/60"
            >
              Home #2
            </Link>
            <button
              type="button"
              onClick={() => scrollToSection('specialists-section')}
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors duration-200 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#3D3830]/40 cursor-pointer"
            >
              Companions
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('observatory-showcase')}
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors duration-200 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#3D3830]/40 cursor-pointer"
            >
              Chart breakdown
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('traditions-showcase')}
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors duration-200 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#3D3830]/40 cursor-pointer"
            >
              Methodologies
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('miniapps-showcase')}
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors duration-200 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#3D3830]/40 cursor-pointer"
            >
              Apps
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('tarot-styles-showcase')}
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors duration-200 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#3D3830]/40 cursor-pointer"
            >
              Tarot
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
                onClick={() => setMobileMenuOpen(false)}
                className="text-left font-medium text-[#5C5449] hover:text-[#3D3830] py-1.5"
              >
                Home
              </Link>
              <Link
                to="/home-2"
                onClick={() => {
                  setMobileMenuOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                Home #2
              </Link>
              <button
                type="button"
                onClick={() => scrollToSection('specialists-section')}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                Companions
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('observatory-showcase')}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                Chart breakdown
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('traditions-showcase')}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                Methodologies
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('miniapps-showcase')}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                Apps
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('tarot-styles-showcase')}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                Tarot
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
                  <h1
                    className="font-serif text-4xl sm:text-5xl md:text-[56px] font-medium text-[#3D3830] tracking-tight leading-[1.05]"
                    style={{ textWrap: 'balance' }}
                  >
                    Chat with Ai Astrologers
                  </h1>

                  <p className="text-lg sm:text-xl font-medium text-[#3D3830] leading-snug">
                    who deeply understand your birthchart and your life
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

        {/* 2. RANDOMIZED SPECIALIST COMPANIONS (FULL VIEW COMPACT VERTICAL CARDS) */}
        <section
          id="specialists-section"
          className="border-t border-[#3D3830]/10 bg-[#FDFBF7] py-16 md:py-24"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-6 space-y-10">
            <Reveal direction="up">
              <div className="space-y-2 max-w-2xl">
                <p className="text-xs font-medium text-[#8B8275]">
                  Astrology · Tarot · Numerology · Past Life · Healing &amp; Support
                </p>
                <h2
                  className="font-serif text-3xl sm:text-4xl font-medium text-[#3D3830] tracking-tight leading-tight"
                  style={{ textWrap: 'balance' }}
                >
                  Life companions
                </h2>
              </div>
            </Reveal>

            <CompanionDiscoveryControls
              cards={specialists}
              activeGroup={activeCompanionGroup}
              onChangeGroup={(group) => {
                setActiveCompanionGroup(group);
                setShowAllCompanions(false);
              }}
              activeSituationChip={activeSituationChip}
              onChangeSituationChip={(chipId) => {
                setActiveSituationChip(chipId);
                setShowAllCompanions(false);
              }}
              specializations={companionSpecializations}
              activeSpecialization={activeCompanionSpecialization}
              onChangeSpecialization={(slug) => {
                setActiveCompanionSpecialization(slug);
                setShowAllCompanions(false);
              }}
              searchQuery={companionSearchQuery}
              onChangeSearchQuery={setCompanionSearchQuery}
              tabSurface="cream"
              showCounts
            />

            {displayedSpecialists.length === 0 ? (
              <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FAF7F2] p-8 text-center space-y-3">
                <p className="font-serif text-xl text-[#3D3830]">
                  No companions match this filter or search
                </p>
                <p className="text-xs text-[#5C5449]">
                  Try clearing your search or switching companion categories.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCompanionSpecialization(null);
                    setActiveSituationChip(null);
                    setCompanionSearchQuery('');
                  }}
                  className="min-h-[38px] inline-flex items-center justify-center rounded-full border border-[#3D3830]/18 bg-[#FDFBF7] px-4 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayedSpecialists.map((card, idx) => {
                    const secondary =
                      card.secondary_expertise?.[0] &&
                      card.secondary_expertise[0].toLowerCase() !==
                        card.primary_expertise.toLowerCase()
                        ? card.secondary_expertise[0]
                        : null;

                    return (
                      <Reveal
                        key={card.slug}
                        direction="up"
                        delay={(idx % 3) * 50}
                        className="h-full"
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => handleOpenCompanionBirthChart(card)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleOpenCompanionBirthChart(card);
                            }
                          }}
                          className="group h-full flex flex-col justify-between rounded-3xl border border-[#3D3830]/12 bg-[#FAF7F2] p-6 gap-5 text-left hover:border-[#3D3830]/28 hover:-translate-y-1 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8965A]"
                        >
                          <div className="space-y-4">
                            <div className="flex items-center gap-4">
                              <CompanionAvatar
                                name={card.name}
                                avatarUrl={card.avatar_url}
                                palette={card.monogram_palette}
                                size="lg"
                                shape="circle"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                  <h3 className="font-['Cormorant_Garamond',serif] text-2xl font-semibold text-[#3D3830] leading-tight truncate">
                                    {card.name}
                                  </h3>
                                  <span className="font-['JetBrains_Mono',monospace] tabular-nums text-xs text-[#8B8275] shrink-0">
                                    {card.age}
                                  </span>
                                </div>
                                <p className="text-xs sm:text-[13px] text-[#8B8275] truncate mt-0.5">
                                  {card.card_subtitle ||
                                    `${card.primary_expertise}${secondary ? ` · ${secondary}` : ''}`}
                                </p>
                              </div>
                            </div>

                            <p className="text-sm text-[#5C5449] leading-relaxed line-clamp-3">
                              {card.short_bio || card.tagline}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#3D3830]/10">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAboutCompanion(card);
                              }}
                              className="min-h-[36px] rounded-xl px-2.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#EAE3D7]/60 transition-colors cursor-pointer"
                            >
                              About
                            </button>

                            <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#EDE6DA] group-hover:bg-[#4A453D] px-3.5 py-1.5 text-xs font-medium text-[#3D3830] group-hover:text-[#FAF7F2] transition-colors whitespace-nowrap">
                              <span>Chat with {card.name}</span>
                              <ArrowRight className="h-3 w-3" />
                            </span>
                          </div>
                        </div>
                      </Reveal>
                    );
                  })}
                </div>

                {isDefaultLandingCompanionView && filteredSpecialists.length > 9 && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setShowAllCompanions((prev) => !prev)}
                      className="min-h-[42px] inline-flex items-center gap-2 rounded-full border border-[#3D3830]/18 bg-[#FAF7F2] px-5 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                    >
                      <span>
                        {showAllCompanions
                          ? 'Show fewer companions'
                          : `Show all ${filteredSpecialists.length} companions`}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* 3. INTERACTIVE SHOWCASE A: FULL DETAIL CHART BREAKDOWN (VEDIC & WESTERN MODULES) */}
        <section
          id="observatory-showcase"
          className="border-t border-[#3D3830]/10 bg-[#FAF7F2] py-16 md:py-24"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-6 space-y-8">
            <Reveal direction="up">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1.5">
                  <h2
                    className="font-serif text-3xl sm:text-4xl font-medium text-[#3D3830] tracking-tight leading-tight"
                    style={{ textWrap: 'balance' }}
                  >
                    Sample Chart
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-[#5C5449] max-w-xl leading-relaxed">
                  Vedic (Parashari, Divisional Vargas, KP Sub-Lords, Ashtakavarga, Jaimini Karakas, Shadbala &amp; Lal Kitab) and Tropical Western (Natal Wheel, Placidus Houses &amp; Aspects) — ready in one place.
                </p>
              </div>
            </Reveal>

            <Reveal direction="up" delay={70}>
              <ChartViewer
                chart={PREVIEW_CHART_JSON}
                dailyTransits={PREVIEW_DAILY_TRANSITS}
                initialMode="vedic"
              />
            </Reveal>
          </div>
        </section>

        {/* 4. INTERACTIVE SHOWCASE B: ONE QUESTION, DIFFERENT TRADITIONS */}
        <section
          id="traditions-showcase"
          className="border-t border-[#3D3830]/10 bg-[#FDFBF7] py-16 md:py-24"
        >
          <div className="mx-auto max-w-5xl px-5 sm:px-6 space-y-8">
            <Reveal direction="up">
              <div className="text-center space-y-2 max-w-2xl mx-auto">
                <p className="text-xs font-medium text-[#8B8275]">
                  Multi-System Synthesis
                </p>
                <h2
                  className="font-serif text-3xl sm:text-4xl font-medium text-[#3D3830] tracking-tight"
                  style={{ textWrap: 'balance' }}
                >
                  Same question, verified across disciplines
                </h2>
              </div>
            </Reveal>

            <Reveal direction="up" delay={60}>
              <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FAF7F2] p-5 sm:p-8 space-y-6">
                {/* User Sample Prompt */}
                <div className="flex justify-end">
                  <div className="max-w-xl rounded-2xl rounded-br-sm bg-[#4A453D] px-4 py-3 text-xs sm:text-sm text-[#FAF7F2] leading-relaxed">
                    &ldquo;I&apos;ve felt restless in my career for six months. Is this a time to leave or build quietly?&rdquo;
                  </div>
                </div>

                {/* Tradition Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#EAE3D7]/70 p-1.5 border border-[#3D3830]/10">
                  {TRADITION_LENSES.map((lens) => (
                    <button
                      key={lens.id}
                      type="button"
                      onClick={() => setTraditionId(lens.id)}
                      className={`rounded-xl px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        traditionId === lens.id
                          ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                          : 'text-[#5C5449] hover:text-[#3D3830]'
                      }`}
                    >
                      {lens.label}
                    </button>
                  ))}
                </div>

                {/* Assistant Lens Response */}
                <div
                  key={activeTradition.id}
                  className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 space-y-3 animate-cc-tab-panel"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#8B8275]">
                    <span className="font-medium text-[#3D3830] inline-flex items-center gap-1.5">
                      <Compass className="h-3.5 w-3.5 text-[#8B7355]" />
                      <span>{activeTradition.label}</span>
                    </span>
                    <span>{activeTradition.systemNote}</span>
                  </div>

                  <p className="text-sm text-[#3D3830] leading-relaxed">
                    {activeTradition.answer}
                  </p>

                  <p className="font-['JetBrains_Mono',monospace] tabular-nums text-[11px] text-[#8B8275] pt-2 border-t border-[#3D3830]/10">
                    {activeTradition.metrics}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <Link
                    to="/app/home?preview=1"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3D3830] underline underline-offset-4 hover:text-[#5C5449]"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-[#8B7355]" />
                    <span>Open full chat workspace preview</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => scrollToSection('hero-birth-chart')}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>Try with your own chart</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 5. INTERACTIVE SHOWCASE C: MINI-APPS & LIFE BRIEFS */}
        <section
          id="miniapps-showcase"
          className="border-t border-[#3D3830]/10 bg-[#FAF7F2] py-16 md:py-24"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-6 space-y-8">
            <Reveal direction="up">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-[#8B8275]">
                    Instant Chart Tools
                  </p>
                  <h2
                    className="font-serif text-3xl sm:text-4xl font-medium text-[#3D3830] tracking-tight"
                    style={{ textWrap: 'balance' }}
                  >
                    Focused briefs ready whenever you need clarity
                  </h2>
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {showcaseMiniApps.map((app) => {
                  const isSelected = app.slug === activeMiniApp?.slug;
                  return (
                    <button
                      key={app.slug}
                      type="button"
                      onClick={() => setSelectedMiniAppSlug(app.slug)}
                      className={`text-left rounded-2xl border p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? 'border-[#3D3830]/35 bg-[#EAE3D7]/80'
                          : 'border-[#3D3830]/12 bg-[#FDFBF7] hover:border-[#3D3830]/25'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 text-[#3D3830]">
                        <span className="h-8 w-8 rounded-xl bg-[#FAF7F2] border border-[#3D3830]/10 flex items-center justify-center text-[#8B7355] shrink-0">
                          {renderMiniAppIcon(app.iconKey, 'h-4 w-4')}
                        </span>
                        <span className="font-serif text-lg font-medium leading-tight truncate">
                          {app.shortTitle || app.title}
                        </span>
                      </div>
                      <p className="text-xs text-[#5C5449] leading-relaxed line-clamp-2">
                        {app.tagline}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="lg:col-span-6">
                <div
                  key={activeMiniApp?.slug}
                  className="h-full rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-6 sm:p-7 flex flex-col justify-between gap-6 animate-cc-tab-panel"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2 text-xs text-[#8B8275]">
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#3D3830]">
                        <Sparkles className="h-3.5 w-3.5 text-[#B8965A]" />
                        <span>{activeMiniApp?.title}</span>
                      </span>
                      <span>Sample Output</span>
                    </div>

                    <h3 className="font-serif text-2xl font-medium text-[#3D3830] leading-snug">
                      {activeMiniAppSample.headline}
                    </h3>

                    <p className="text-sm text-[#5C5449] leading-relaxed">
                      {activeMiniAppSample.preview}
                    </p>

                    <p className="font-['JetBrains_Mono',monospace] tabular-nums text-[11px] text-[#8B8275] pt-3 border-t border-[#3D3830]/10">
                      {activeMiniAppSample.focus}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => scrollToSection('hero-birth-chart')}
                      className="inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <span>Run on your birth chart</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <Link
                      to={`/app/apps/${encodeURIComponent(activeMiniApp?.slug || 'daily-horoscope')}?preview=1`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/18 bg-[#FAF7F2] px-4 py-2.5 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7] transition-colors whitespace-nowrap"
                    >
                      <span>Try in preview</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. INTERACTIVE TAROT STYLE COMPARISON & LIVE IN-CHAT FLIP PREVIEW */}
        <TarotStyleShowcase />
      </main>

      {/* QUIET FOOTER */}
      <footer className="border-t border-[#3D3830]/10 bg-[#F1ECE3] py-10">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5C5449]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-serif text-lg font-medium text-[#3D3830]">
              Cosmic Council
            </span>
            <span aria-hidden="true">·</span>
            <span>Private, encrypted &amp; personalized to your birth chart</span>
          </div>

          <div className="flex flex-wrap items-center gap-5">
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

      {/* Companion About Profile Sheet */}
      <CompanionProfileSheet
        companion={aboutCompanion}
        isOpen={Boolean(aboutCompanion)}
        onClose={() => setAboutCompanion(null)}
        onStartChat={(c) => handleOpenCompanionBirthChart(c)}
      />

      {/* Companion Birth Chart -> Gmail Login Popup Modal */}
      {selectedCompanionForChart && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1F2229]/50 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Enter birth chart to chat with ${selectedCompanionForChart.name}`}
          onClick={() => setSelectedCompanionForChart(null)}
        >
          <div
            className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[#3D3830]/14 bg-[#FDFBF7] p-6 sm:p-7 shadow-2xl animate-cc-message-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedCompanionForChart(null)}
              aria-label="Close modal"
              className="absolute right-4 top-4 min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-full text-[#8B8275] hover:text-[#3D3830] hover:bg-[#EAE3D7]/60 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <LandingBirthChartCard
              variant="modal"
              companion={selectedCompanionForChart}
            />
          </div>
        </div>
      )}

      <FloatingScrollControls />
    </div>
  );
};

export default NewLandingPage;
