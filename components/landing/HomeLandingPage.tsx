import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import FloatingScrollControls from '../FloatingScrollControls';
import { BirthChartPreviewPanel } from './BirthChartPreviewPanel';
import {
  CompanionCarousel,
  DialogueShowcase,
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
  type HeroBackdropOption,
} from './landingData';
import PricingSection from './PricingSection';

type PillarId = (typeof HERO_CONTENT.pillars)[number]['id'];
type ActiveNavId = 'home' | PillarId | 'pricing';

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

const LandingFeatureIcon: React.FC<{
  section: PillarId;
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

  // section === 'support'
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
          <path d="M12 4v2.2M12 17.8V20M4 12h2.2M17.8 12H20M6.4 6.4l1.5 1.5M16.1 16.1l1.5 1.5M17.6 6.4l-1.5 1.5M7.9 16.1l-1.5 1.5" strokeOpacity="0.75" />
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

const HomeLandingPage: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroScrollY, setHeroScrollY] = useState(0);
  const [activeNav, setActiveNav] = useState<ActiveNavId>('home');
  const [activeBackdrop] = useState<HeroBackdropOption>(() => pickRandomBackdrop());
  const manualNavLockUntilRef = React.useRef<number>(0);

  const isDarkHero = activeBackdrop.tone === 'dark';

  // Track subtle hero parallax & active section state cleanly on scroll
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const sectionIds: Array<Exclude<ActiveNavId, 'home'>> = [
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

      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 40
      ) {
        setActiveNav('pricing');
        return;
      }

      const threshold = window.innerHeight * 0.36;
      let current: ActiveNavId = 'home';
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

  const scrollToSection = (id: Exclude<ActiveNavId, 'home'>) => {
    manualNavLockUntilRef.current = Date.now() + 750;
    setActiveNav(id);
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#3D3830] font-['Plus_Jakarta_Sans',sans-serif] selection:bg-[#EAE3D7] flex flex-col overflow-x-clip">
      {/* Three-Zone Frosted Top Bar */}
      <header className="fixed top-0 inset-x-0 z-40 w-full px-4 md:px-8 pt-3.5 sm:pt-4 animate-cc-slide-down">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-8 rounded-2xl bg-[#EAE3D7]/80 backdrop-blur-md px-5 py-3 border border-[#3D3830]/10">
          {/* Zone 1: Single-line Brand Wordmark */}
          <Link
            to="/"
            className="font-['Cormorant_Garamond',serif] text-xl font-medium tracking-tight text-[#3D3830] whitespace-nowrap shrink-0 transition-opacity duration-200 hover:opacity-80"
          >
            Cosmic Council
          </Link>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-4 lg:gap-6">
            <Link
              to="/"
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] py-1 border-b-2 border-transparent hover:border-[#3D3830]/35 transition-colors duration-200 whitespace-nowrap shrink-0"
            >
              Home
            </Link>
            <Link
              to="/home-2"
              onClick={scrollToHome}
              aria-current={activeNav === 'home' ? 'page' : undefined}
              className={`text-sm py-1 border-b-2 transition-colors duration-200 whitespace-nowrap shrink-0 ${
                activeNav === 'home'
                  ? 'font-semibold text-[#26201A] border-[#3D3830]'
                  : 'font-medium text-[#5C5449] border-transparent hover:text-[#3D3830] hover:border-[#3D3830]/35'
              }`}
            >
              Home #2
            </Link>
            <Link
              to="/home-3"
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] py-1 border-b-2 border-transparent hover:border-[#3D3830]/35 transition-colors duration-200 whitespace-nowrap shrink-0"
            >
              Home #3
            </Link>
            {HERO_CONTENT.pillars.map((pillar) => {
              const isActive = activeNav === pillar.id;
              return (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => scrollToSection(pillar.id)}
                  aria-current={isActive ? 'location' : undefined}
                  className={`text-sm py-1 border-b-2 transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'font-semibold text-[#26201A] border-[#3D3830]'
                      : 'font-medium text-[#5C5449] border-transparent hover:text-[#3D3830] hover:border-[#3D3830]/35'
                  }`}
                >
                  {pillar.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => scrollToSection('pricing')}
              aria-current={activeNav === 'pricing' ? 'location' : undefined}
              className={`text-sm py-1 border-b-2 transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                activeNav === 'pricing'
                  ? 'font-semibold text-[#26201A] border-[#3D3830]'
                  : 'font-medium text-[#5C5449] border-transparent hover:text-[#3D3830] hover:border-[#3D3830]/35'
              }`}
            >
              Pricing
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
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] text-[#3D3830] hover:bg-[#F1ECE3] active:scale-95 transition-all duration-200 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden mx-auto max-w-7xl mt-2 rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 shadow-lg space-y-4 animate-cc-drawer-in">
            <div className="grid grid-cols-2 gap-2.5 text-sm">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="text-left rounded-xl px-3 py-2 font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3]/60 transition-colors"
              >
                Home
              </Link>
              <Link
                to="/home-2"
                onClick={scrollToHome}
                aria-current={activeNav === 'home' ? 'page' : undefined}
                className={`text-left rounded-xl px-3 py-2 transition-colors ${
                  activeNav === 'home'
                    ? 'bg-[#EAE3D7]/80 font-semibold text-[#26201A]'
                    : 'font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3]/60'
                }`}
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
              {HERO_CONTENT.pillars.map((pillar) => {
                const isActive = activeNav === pillar.id;
                return (
                  <button
                    key={pillar.id}
                    type="button"
                    onClick={() => scrollToSection(pillar.id)}
                    aria-current={isActive ? 'location' : undefined}
                    className={`text-left rounded-xl px-3 py-2 cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#EAE3D7]/80 font-semibold text-[#26201A]'
                        : 'font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3]/60'
                    }`}
                  >
                    {pillar.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => scrollToSection('pricing')}
                aria-current={activeNav === 'pricing' ? 'location' : undefined}
                className={`text-left rounded-xl px-3 py-2 cursor-pointer transition-colors ${
                  activeNav === 'pricing'
                    ? 'bg-[#EAE3D7]/80 font-semibold text-[#26201A]'
                    : 'font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3]/60'
                }`}
              >
                Pricing
              </button>
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
        {/* HERO SECTION — Editorial Backdrop Options with High-Contrast Reading Scrim */}
        <section
          className={`relative min-h-[84svh] sm:min-h-[88svh] flex flex-col justify-between overflow-hidden transition-colors duration-300 ${activeBackdrop.canvasBgClass}`}
        >
          {/* Scenic / Human Backdrop with Gentle Scroll Parallax */}
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

          {/* Mobile Top-Weighted Scrim — guarantees high contrast above the fold without merging */}
          <div
            aria-hidden="true"
            className={`md:hidden pointer-events-none absolute inset-0 ${
              isDarkHero
                ? 'bg-[linear-gradient(180deg,rgba(20,22,28,0.95)_0%,rgba(20,22,28,0.88)_54%,rgba(20,22,28,0.52)_80%,rgba(20,22,28,0.28)_100%)]'
                : 'bg-[linear-gradient(180deg,rgba(250,247,242,0.96)_0%,rgba(250,247,242,0.90)_54%,rgba(250,247,242,0.54)_80%,rgba(250,247,242,0.22)_100%)]'
            }`}
          />

          {/* Desktop Left-to-Right Directional Scrim — protects left reading column while keeping subject clear */}
          <div
            aria-hidden="true"
            className={`hidden md:block pointer-events-none absolute inset-0 ${
              isDarkHero
                ? 'bg-[linear-gradient(90deg,rgba(20,22,28,0.95)_0%,rgba(20,22,28,0.86)_38%,rgba(20,22,28,0.48)_64%,rgba(20,22,28,0.12)_88%,rgba(20,22,28,0.04)_100%)]'
                : 'bg-[linear-gradient(90deg,rgba(250,247,242,0.96)_0%,rgba(250,247,242,0.90)_38%,rgba(250,247,242,0.58)_60%,rgba(250,247,242,0.14)_84%,rgba(250,247,242,0.04)_100%)]'
            }`}
          />

          {/* Soft Bottom Seam into Pillar 01 */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#F4EFE6] via-[#F4EFE6]/60 to-transparent"
          />

          {/* Hero Copy Block — Anchored in Protected Left Reading Zone */}
          <div className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8 pt-28 sm:pt-36 md:pt-40 pb-12 sm:pb-16">
            <div className="max-w-[36rem] lg:max-w-[40rem] space-y-5 sm:space-y-6 animate-cc-slide-up">
              <h1
                className={`font-['Cormorant_Garamond',serif] text-[clamp(2.4rem,5.5vw,4.5rem)] font-medium leading-[1.04] tracking-[-0.015em] ${
                  isDarkHero ? 'text-[#FAF7F2]' : 'text-[#26201A]'
                }`}
                style={{ textWrap: 'balance' }}
              >
                <span className="block">{HERO_CONTENT.headlineLine1}</span>
                <span className="block">{HERO_CONTENT.headlineLine2}</span>
              </h1>

              <p
                className={`max-w-[56ch] text-[15px] sm:text-lg leading-[1.68] ${
                  isDarkHero
                    ? 'text-[#E8E1D5] tracking-[0.005em]'
                    : 'text-[#3D352C]'
                }`}
              >
                {HERO_CONTENT.body}
              </p>
            </div>
          </div>

          {/* Bottom breathing room above soft transition */}
          <div className="relative z-10 h-12 sm:h-16" aria-hidden="true" />
        </section>

        {/* PILLAR 01 — DEEP BIRTH CHART ANALYSIS (Warm Champagne Parchment) */}
        <section
          id="birthchart"
          className="scroll-mt-24 bg-gradient-to-b from-[#F4EFE6] via-[#F4EFE6] to-[#F8F4EC] pt-14 sm:pt-20 pb-20 sm:pb-28"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-8 space-y-16 sm:space-y-24">
            {/* Editorial Opener */}
            <EditorialReveal>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end">
                <div className="lg:col-span-7 space-y-3.5">
                  <span className="inline-flex items-center rounded-full border border-[#3D3830]/14 bg-[#EAE2D3]/75 px-3.5 py-1 text-xs font-medium text-[#6B5A45]">
                    {BIRTHCHART_CONTENT.indexLabel}
                  </span>
                  <h2
                    className="font-['Cormorant_Garamond',serif] text-[clamp(2rem,4.2vw,3.35rem)] font-medium leading-[1.08] tracking-tight text-[#3D3830]"
                    style={{ textWrap: 'balance' }}
                  >
                    {BIRTHCHART_CONTENT.headline}
                  </h2>
                </div>
                <p className="lg:col-span-5 text-base sm:text-lg leading-[1.65] text-[#5C5449]">
                  {BIRTHCHART_CONTENT.lead}
                </p>
              </div>
            </EditorialReveal>

            {/* Luminous Parchment Birth Chart + Interactive Multi-Layer Indicators */}
            <EditorialReveal delay={80}>
              <div className="space-y-7">
                <BirthChartPreviewPanel />
                <p className="max-w-3xl text-base sm:text-lg leading-[1.7] text-[#4C443B]">
                  {BIRTHCHART_CONTENT.closingLead}
                </p>
              </div>
            </EditorialReveal>

            {/* Depth of Analysis — Asymmetric Editorial Specification */}
            <div className="pt-8 border-t border-[#3D3830]/12 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
              <EditorialReveal direction="left" className="lg:col-span-5 space-y-4 lg:sticky lg:top-28">
                <h3
                  className="font-['Cormorant_Garamond',serif] text-[clamp(1.75rem,3vw,2.5rem)] font-medium leading-[1.12] text-[#3D3830]"
                  style={{ textWrap: 'balance' }}
                >
                  {BIRTHCHART_CONTENT.depthHeading}
                </h3>
                <p className="text-sm sm:text-base leading-[1.7] text-[#5C5449]">
                  {BIRTHCHART_CONTENT.depthIntro}
                </p>
              </EditorialReveal>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-8">
                {BIRTHCHART_CONTENT.features.map((item, idx) => (
                  <EditorialReveal
                    key={item.title}
                    delay={(idx % 2) * 80}
                    className="pt-5 border-t border-[#3D3830]/12 flex flex-col items-start text-left space-y-2.5"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAE3D7]/75 border border-[#3D3830]/10 text-[#6E5B43]">
                      <LandingFeatureIcon section="birthchart" index={idx} />
                    </span>
                    <h4 className="text-base font-semibold text-[#3D3830] leading-snug">
                      {item.title}
                    </h4>
                    <p className="text-sm leading-relaxed text-[#5C5449]">
                      {item.description}
                    </p>
                  </EditorialReveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* PILLAR 02 — ONE-ON-ONE CONSULTATIONS (Luminous Warm Ivory) */}
        <section
          id="consultation"
          className="scroll-mt-24 bg-gradient-to-b from-[#F8F4EC] via-[#FAF7F2] to-[#F7F3EB] pt-16 sm:pt-24 pb-20 sm:pb-28 border-t border-[#3D3830]/8"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-8 space-y-16 sm:space-y-24">
            {/* Editorial Opener + Triptych */}
            <div className="space-y-10 sm:space-y-12">
              <EditorialReveal>
                <div className="max-w-3xl space-y-4">
                  <span className="inline-flex items-center rounded-full border border-[#3D3830]/14 bg-[#EFE8DA]/80 px-3.5 py-1 text-xs font-medium text-[#6B5A45]">
                    {CONSULTATION_CONTENT.indexLabel}
                  </span>
                  <h2
                    className="font-['Cormorant_Garamond',serif] text-[clamp(2rem,4.2vw,3.35rem)] font-medium leading-[1.08] tracking-tight text-[#3D3830]"
                    style={{ textWrap: 'balance' }}
                  >
                    {CONSULTATION_CONTENT.headline}
                  </h2>
                  <p className="text-base sm:text-lg leading-[1.65] text-[#5C5449]">
                    {CONSULTATION_CONTENT.lead}
                  </p>
                </div>
              </EditorialReveal>

              {/* Staggered 3-Portrait Editorial Gallery */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 items-start">
                {CONSULTATION_CONTENT.triptych.map((portrait, idx) => (
                  <EditorialReveal
                    key={portrait.alt}
                    delay={idx * 90}
                    className={`space-y-2.5 ${
                      idx === 1 ? 'sm:mt-6' : idx === 2 ? 'sm:mt-3' : ''
                    }`}
                  >
                    <figure className="space-y-2.5">
                      <ParallaxFrame
                        strength={idx === 1 ? 14 : 9}
                        className="aspect-[3/4] rounded-2xl sm:rounded-3xl border border-[#3D3830]/10"
                      >
                        <EditorialImage
                          src={portrait.src}
                          alt={portrait.alt}
                          className="h-full w-full"
                          imgClassName="object-top"
                        />
                      </ParallaxFrame>
                      <figcaption className="text-xs text-[#7D6C58] px-1">
                        {portrait.caption}
                      </figcaption>
                    </figure>
                  </EditorialReveal>
                ))}
              </div>

              <EditorialReveal>
                <p className="max-w-3xl text-base sm:text-lg leading-[1.7] text-[#4C443B]">
                  {CONSULTATION_CONTENT.bridgeCopy}
                </p>
              </EditorialReveal>
            </div>

            {/* Realistic Animated Consultation Dialogue (Dev) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
              <EditorialReveal direction="left" className="lg:col-span-5 space-y-4 lg:pt-4">
                <h3
                  className="font-['Cormorant_Garamond',serif] text-[clamp(1.75rem,3.2vw,2.6rem)] font-medium leading-[1.12] text-[#3D3830]"
                  style={{ textWrap: 'balance' }}
                >
                  {CONSULTATION_CONTENT.dialogueHeading}
                </h3>
                <p className="text-sm sm:text-base leading-[1.7] text-[#5C5449]">
                  {CONSULTATION_CONTENT.bridgeCopy}
                </p>
              </EditorialReveal>

              <EditorialReveal direction="right" delay={80} className="lg:col-span-7">
                <DialogueShowcase
                  companion={CONSULTATION_CONTENT.dialogueCompanion}
                  lines={CONSULTATION_CONTENT.dialogueLines}
                  footnote={CONSULTATION_CONTENT.dialogueFootnote}
                  surfaceClassName="bg-[#FDFBF7]"
                  userBubbleClassName="bg-[#EBE4D8] text-[#3D3830]"
                  companionBubbleClassName="bg-[#F6F2EA] text-[#3D3830] border border-[#3D3830]/10"
                />
              </EditorialReveal>
            </div>

            {/* 8 Consultation Qualities */}
            <div className="pt-8 border-t border-[#3D3830]/12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-9">
              {CONSULTATION_CONTENT.features.map((item, idx) => (
                <EditorialReveal
                  key={item.title}
                  delay={(idx % 4) * 65}
                  className="flex flex-col items-start text-left space-y-2.5"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFE8DA]/80 border border-[#3D3830]/10 text-[#6E5B43]">
                    <LandingFeatureIcon section="consultation" index={idx} />
                  </span>
                  <h4 className="text-base font-semibold text-[#3D3830] leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-sm leading-relaxed text-[#5C5449]">
                    {item.description}
                  </p>
                </EditorialReveal>
              ))}
            </div>

            {/* Horizontal Companion Carousel — Esoteric Guides */}
            <EditorialReveal>
              <div className="pt-4">
                <CompanionCarousel
                  title={CONSULTATION_CONTENT.carouselTitle}
                  items={CONSULTATION_CONTENT.carouselItems}
                />
              </div>
            </EditorialReveal>
          </div>
        </section>

        {/* PILLAR 03 — FINDING REAL SOLUTIONS (Soft Sage Mist) */}
        <section
          id="guidance"
          className="scroll-mt-24 bg-gradient-to-b from-[#F2F3EE] via-[#EFF2EC] to-[#EEF1EB] pt-16 sm:pt-24 pb-20 sm:pb-28 border-t border-[#3D3830]/8"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-8 space-y-16 sm:space-y-24">
            {/* Opener + Expansive Sunlit Studio Photo */}
            <div className="space-y-10 sm:space-y-12">
              <EditorialReveal>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end">
                  <div className="lg:col-span-6 space-y-3.5">
                    <span className="inline-flex items-center rounded-full border border-[#343A32]/14 bg-[#E2E8DE]/85 px-3.5 py-1 text-xs font-medium text-[#4B5847]">
                      {GUIDANCE_CONTENT.indexLabel}
                    </span>
                    <h2
                      className="font-['Cormorant_Garamond',serif] text-[clamp(2rem,4.2vw,3.35rem)] font-medium leading-[1.08] tracking-tight text-[#343A32]"
                      style={{ textWrap: 'balance' }}
                    >
                      {GUIDANCE_CONTENT.headline}
                    </h2>
                  </div>
                  <div className="lg:col-span-6 space-y-3">
                    <p className="text-base sm:text-lg leading-[1.65] text-[#4E574B]">
                      {GUIDANCE_CONTENT.lead1}
                    </p>
                    <p className="text-base sm:text-lg font-medium leading-[1.6] text-[#343A32]">
                      {GUIDANCE_CONTENT.lead2}
                    </p>
                  </div>
                </div>
              </EditorialReveal>

              <EditorialReveal delay={80}>
                <ParallaxFrame
                  strength={16}
                  className="aspect-[16/10] sm:aspect-[16/9] rounded-3xl border border-[#343A32]/12"
                >
                  <EditorialImage
                    src={GUIDANCE_CONTENT.studioImageUrl}
                    alt={GUIDANCE_CONTENT.studioImageAlt}
                    className="h-full w-full"
                    warmGrade={false}
                  />
                </ParallaxFrame>
              </EditorialReveal>
            </div>

            {/* Reversed Dialogue Split (Ethan — Candid Friend) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
              <EditorialReveal direction="right" className="lg:col-span-5 lg:order-2 space-y-4 lg:pt-4">
                <h3
                  className="font-['Cormorant_Garamond',serif] text-[clamp(1.75rem,3.2vw,2.6rem)] font-medium leading-[1.12] text-[#343A32]"
                  style={{ textWrap: 'balance' }}
                >
                  <span className="block">{GUIDANCE_CONTENT.dialogueHeadingLine1}</span>
                  <span className="block">{GUIDANCE_CONTENT.dialogueHeadingLine2}</span>
                </h3>
                <p className="text-sm sm:text-base leading-[1.7] text-[#4E574B]">
                  {GUIDANCE_CONTENT.dialogueIntro}
                </p>
              </EditorialReveal>

              <EditorialReveal direction="left" delay={80} className="lg:col-span-7 lg:order-1">
                <DialogueShowcase
                  companion={GUIDANCE_CONTENT.dialogueCompanion}
                  lines={GUIDANCE_CONTENT.dialogueLines}
                  footnote={GUIDANCE_CONTENT.dialogueFootnote}
                  surfaceClassName="bg-[#FAFBF8]"
                  userBubbleClassName="bg-[#E1E6DC] text-[#343A32]"
                  companionBubbleClassName="bg-[#F2F5EF] text-[#343A32] border border-[#343A32]/10"
                />
              </EditorialReveal>
            </div>

            {/* 4 Life Areas Editorial Photography Grid */}
            <div className="space-y-8">
              <EditorialReveal>
                <h3
                  className="font-['Cormorant_Garamond',serif] text-[clamp(1.75rem,3.2vw,2.6rem)] font-medium leading-[1.12] text-[#343A32]"
                  style={{ textWrap: 'balance' }}
                >
                  {GUIDANCE_CONTENT.lifeAreasTitle}
                </h3>
              </EditorialReveal>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                {GUIDANCE_CONTENT.lifeAreas.map((area, idx) => (
                  <EditorialReveal key={area.title} delay={(idx % 2) * 80}>
                    <article className="space-y-3.5 group">
                      <div className="aspect-[4/3] w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-[#343A32]/10">
                        <EditorialImage
                          src={area.imageUrl}
                          alt={area.alt}
                          className="h-full w-full"
                          imgClassName="transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                        />
                      </div>
                      <div className="space-y-1 px-0.5">
                        <h4 className="text-base sm:text-lg font-semibold text-[#343A32]">
                          {area.title}
                        </h4>
                        <p className="text-sm leading-relaxed text-[#4E574B]">
                          {area.description}
                        </p>
                      </div>
                    </article>
                  </EditorialReveal>
                ))}
              </div>
            </div>

            {/* 6 Real-Solutions Pillars */}
            <div className="pt-8 border-t border-[#343A32]/12 space-y-10">
              <EditorialReveal>
                <h3
                  className="font-['Cormorant_Garamond',serif] text-[clamp(1.75rem,3vw,2.5rem)] font-medium leading-[1.12] text-[#343A32]"
                  style={{ textWrap: 'balance' }}
                >
                  {GUIDANCE_CONTENT.featuresTitle}
                </h3>
              </EditorialReveal>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
                {GUIDANCE_CONTENT.features.map((item, idx) => (
                  <EditorialReveal
                    key={item.title}
                    delay={(idx % 3) * 70}
                    className="pt-5 border-t border-[#343A32]/10 flex flex-col items-start text-left space-y-2.5"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E2E8DE]/80 border border-[#343A32]/10 text-[#4B5847]">
                      <LandingFeatureIcon section="guidance" index={idx} />
                    </span>
                    <h4 className="text-base font-semibold text-[#343A32] leading-snug">
                      {item.title}
                    </h4>
                    <p className="text-sm leading-relaxed text-[#4E574B]">
                      {item.description}
                    </p>
                  </EditorialReveal>
                ))}
              </div>
            </div>

            {/* Horizontal Carousel — Your Own Circle of Guidance */}
            <EditorialReveal>
              <CompanionCarousel
                title={GUIDANCE_CONTENT.carouselTitle}
                items={GUIDANCE_CONTENT.carouselItems}
                caption={GUIDANCE_CONTENT.carouselCaption}
              />
            </EditorialReveal>
          </div>
        </section>

        {/* PILLAR 04 — EMOTIONAL SUPPORT (Earthy Peach Linen) */}
        <section
          id="support"
          className="scroll-mt-24 bg-gradient-to-b from-[#F5ECE4] via-[#F6ECE4] to-[#F3E7DD] pt-16 sm:pt-24 pb-24 sm:pb-32 border-t border-[#3D3830]/8"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-8 space-y-16 sm:space-y-24">
            {/* Opener + Warm Sunlit Window Photo */}
            <div className="space-y-10 sm:space-y-12">
              <EditorialReveal>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end">
                  <div className="lg:col-span-6 space-y-3.5">
                    <span className="inline-flex items-center rounded-full border border-[#3D342E]/14 bg-[#ECDFD3]/85 px-3.5 py-1 text-xs font-medium text-[#6B5449]">
                      {SUPPORT_CONTENT.indexLabel}
                    </span>
                    <h2
                      className="font-['Cormorant_Garamond',serif] text-[clamp(2rem,4.2vw,3.35rem)] font-medium leading-[1.08] tracking-tight text-[#3D342E]"
                      style={{ textWrap: 'balance' }}
                    >
                      <span className="block">{SUPPORT_CONTENT.headlineLine1}</span>
                      <span className="block">{SUPPORT_CONTENT.headlineLine2}</span>
                    </h2>
                  </div>
                  <div className="lg:col-span-6 space-y-3">
                    <p className="text-base sm:text-lg leading-[1.65] text-[#66544B]">
                      {SUPPORT_CONTENT.lead1}
                    </p>
                    <p className="text-sm sm:text-base leading-[1.7] text-[#4D4039]">
                      {SUPPORT_CONTENT.lead2}
                    </p>
                  </div>
                </div>
              </EditorialReveal>

              <EditorialReveal delay={80}>
                <ParallaxFrame
                  strength={16}
                  className="aspect-[16/10] sm:aspect-[16/9] rounded-3xl border border-[#3D342E]/12"
                >
                  <EditorialImage
                    src={SUPPORT_CONTENT.windowImageUrl}
                    alt={SUPPORT_CONTENT.windowImageAlt}
                    className="h-full w-full"
                    warmGrade={false}
                  />
                </ParallaxFrame>
              </EditorialReveal>
            </div>

            {/* Dialogue 1 — Mira (Listener) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
              <EditorialReveal direction="left" className="lg:col-span-5 space-y-4 lg:pt-4">
                <h3
                  className="font-['Cormorant_Garamond',serif] text-[clamp(1.75rem,3.2vw,2.6rem)] font-medium leading-[1.12] text-[#3D342E]"
                  style={{ textWrap: 'balance' }}
                >
                  {SUPPORT_CONTENT.dialogue1Heading}
                </h3>
                <p className="text-sm sm:text-base leading-[1.7] text-[#5C4C44]">
                  {SUPPORT_CONTENT.dialogue1Intro}
                </p>
              </EditorialReveal>

              <EditorialReveal direction="right" delay={80} className="lg:col-span-7">
                <DialogueShowcase
                  companion={SUPPORT_CONTENT.dialogue1Companion}
                  lines={SUPPORT_CONTENT.dialogue1Lines}
                  footnote={SUPPORT_CONTENT.dialogueFootnote}
                  surfaceClassName="bg-[#FDF9F6]"
                  userBubbleClassName="bg-[#ECE0D6] text-[#3D342E]"
                  companionBubbleClassName="bg-[#F9F2EC] text-[#3D342E] border border-[#3D342E]/10"
                />
              </EditorialReveal>
            </div>

            {/* 6 Emotional Support Qualities */}
            <div className="pt-8 border-t border-[#3D342E]/12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
              {SUPPORT_CONTENT.features.map((item, idx) => (
                <EditorialReveal
                  key={item.title}
                  delay={(idx % 3) * 70}
                  className="pt-5 border-t border-[#3D342E]/10 flex flex-col items-start text-left space-y-2.5"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ECDFD3]/80 border border-[#3D342E]/10 text-[#6B5449]">
                    <LandingFeatureIcon section="support" index={idx} />
                  </span>
                  <h4 className="text-base font-semibold text-[#3D342E] leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-sm leading-relaxed text-[#5C4C44]">
                    {item.description}
                  </p>
                </EditorialReveal>
              ))}
            </div>

            {/* Dialogue 2 — Aira (Mood Lifter) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              <EditorialReveal direction="right" className="lg:col-span-5 lg:order-2 space-y-3">
                <h3
                  className="font-['Cormorant_Garamond',serif] text-[clamp(1.75rem,3.2vw,2.6rem)] font-medium leading-[1.12] text-[#3D342E]"
                  style={{ textWrap: 'balance' }}
                >
                  {SUPPORT_CONTENT.dialogue2Heading}
                </h3>
              </EditorialReveal>

              <EditorialReveal direction="left" delay={80} className="lg:col-span-7 lg:order-1">
                <DialogueShowcase
                  companion={SUPPORT_CONTENT.dialogue2Companion}
                  lines={SUPPORT_CONTENT.dialogue2Lines}
                  footnote={SUPPORT_CONTENT.dialogueFootnote}
                  surfaceClassName="bg-[#FDF9F6]"
                  userBubbleClassName="bg-[#ECE0D6] text-[#3D342E]"
                  companionBubbleClassName="bg-[#F9F2EC] text-[#3D342E] border border-[#3D342E]/10"
                />
              </EditorialReveal>
            </div>

            {/* Horizontal Carousel — Different Personalities */}
            <EditorialReveal>
              <CompanionCarousel
                title={SUPPORT_CONTENT.carouselTitle}
                items={SUPPORT_CONTENT.carouselItems}
              />
            </EditorialReveal>
          </div>
        </section>
        {/* PRICING SECTION — Existing Membership Plans & Credit Packs */}
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
            <Link to="/" className="hover:text-[#3D3830] transition-colors">
              Home
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

export default HomeLandingPage;
