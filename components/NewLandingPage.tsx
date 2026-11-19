import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Heart,
  Menu,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react';
import { Category, Currency, Product, formatCurrencyPrice, slugify } from '../types';
import { PRODUCTS, TESTIMONIALS } from '../constants';
import { articlesData } from './articleData';
import type { SanityArticleItem } from '../lib/sanity';

interface NewLandingPageProps {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  activeCategory: Category;
  setActiveCategory: (cat: Category) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortBy: 'default' | 'price-asc' | 'price-desc';
  setSortBy: (s: 'default' | 'price-asc' | 'price-desc') => void;
  showOnlyFavorites: boolean;
  setShowOnlyFavorites: (show: boolean) => void;
  sanityPosts: SanityArticleItem[];
  onSelectProduct: (product: Product) => void;
  onQuickOrder: (packageName?: string) => void;
  onWhyUs: () => void;
  onContact: () => void;
  onPay: () => void;
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
      { threshold: 0.06, rootMargin: '0px 0px -36px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  const hiddenTransform: Record<RevealDirection, string> = {
    up: 'translate-y-6 opacity-0',
    down: '-translate-y-5 opacity-0',
    left: '-translate-x-7 opacity-0',
    right: 'translate-x-7 opacity-0',
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

interface MethodologyLayer {
  title: string;
  subtitle: string;
  description: string;
  items: string[];
}

const READING_LAYERS: MethodologyLayer[] = [
  {
    title: 'Layer 01: Foundational Structural Promise',
    subtitle: 'Verifying the latent capacity in the chart',
    description:
      'I begin by analyzing the fundamental architecture of your sky. This acts as the baseline capacity constraint for any major life event (career, marriage, children, wealth).',
    items: [
      'Birth Chart (D1) - the structural foundation of the chart',
      'Relevant Divisional Charts (D9 Navamsha, D10 Dashamsha, D7 Saptamsha, D30, D60, and others where applicable)',
      'Planetary dignity, Shadbala (six-fold strength) and Bhava Bala (house strength)',
    ],
  },
  {
    title: 'Layer 02: Karmic Blueprints & Behavioral Dynamics',
    subtitle: 'Detecting subconscious scripts and patterns',
    description:
      "Once capacity is established, I map the psychological and karmic scripts that govern how you act on your chart's capacity.",
    items: [
      'Yogas, Doshas, and repeating karmic patterns',
      'Nakshatras (lunar mansions) and detailed Pada analysis',
      'Chara Karakas and key Jaimini astrology principles',
    ],
  },
  {
    title: 'Layer 03: Multi-System Cross-Verification',
    subtitle: 'Confirming patterns across independent mathematical lenses',
    description:
      'I run your chart through multiple independent frameworks. If a pattern shows up in Parashari but is rejected by KP or Nadi, I discard or weaken the conclusion.',
    items: [
      'Ashtakavarga strength, contribution, and bindu distribution',
      'KP Astrology (Krishnamurti Paddhati) for sub-lord level precision and confirmation',
      'Siddha Nadi principles for recurring ancestral karmas and time-bound triggers',
    ],
  },
  {
    title: 'Layer 04: Dynamic Timing & Event Synthesis',
    subtitle: 'Determining precisely when potential translates to experience',
    description:
      'Finally, I overlay time. I search for periods where the planetary dasha periods, current transits, and KP indicators converge on a single timing window.',
    items: [
      'Active Dasha, Bhukti, and Antar-Dasha cycles',
      'Current and upcoming major planetary transits (Gochar)',
      'Timing windows derived by synthesizing Dashas, Transits, and KP techniques',
    ],
  },
];

const PATTERNS_LIST = [
  {
    number: '01',
    title: 'Recurring Life Cycles',
    body: 'Identifying repeating themes and experiences that keep showing up in your career, relationships, or health.',
  },
  {
    number: '02',
    title: 'Relationship Dynamics',
    body: 'Unveiling core emotional needs, recurring attraction patterns, and deep-seated behavioral blocks.',
  },
  {
    number: '03',
    title: 'Decision-Making Cycles',
    body: 'Spotting subconscious habits and cycles that govern your risk assessments and critical choices.',
  },
  {
    number: '04',
    title: 'Karmic Tendencies',
    body: 'Diagnosing long-term structural strengths, repeating challenges, and heavy ancestral themes.',
  },
  {
    number: '05',
    title: 'Favourable & Pressured Phases',
    body: 'Mapping high-tide phases for growth and expansion, and low-tide phases demanding consolidation and patience.',
  },
  {
    number: '06',
    title: 'Growth Timing Patterns',
    body: 'Pinpointing exact dynamic windows for career progression, relocation, or relational transitions.',
  },
];

const WHY_WRITTEN_POINTS = [
  {
    number: '01',
    title: 'Uncompromised Time & Care',
    body: 'A spontaneous live call or voice note restricts analysis to real-time improvisation. A written report allows me to think through various aspects more deeply, to refine my analysis, choose the right words carefully to describe my observations',
  },
  {
    number: '02',
    title: 'Systematic Cross-Verification',
    body: 'Rather than jumping to immediate, intuitive conclusions, I like to refine my readings by cross-verifying various attributes patiently before putting pen to paper.',
  },
  {
    number: '03',
    title: 'Distraction-Free Focus',
    body: 'Without the conversational white noise, small talk, or immediate feedback loops of a live call, my analytical focus remains 100% on the structural reality of your chart.',
  },
  {
    number: '04',
    title: 'Detailed Explanation',
    body: "In written consultation, you just don't get what is on top of my head - I've the freedom to share all the underlying observations that were made during the analysis for you to get the deepest possible understanding of your situation.",
  },
  {
    number: '05',
    title: 'Lifetime Reference Document',
    body: 'Even though a recorded call or a voice note seem to be easier to listen to, but a written document is far easier to navigate around, read specific parts more deeply, highlight and annotate for life long use.',
  },
];

const FAQS = [
  {
    question: 'What astrological systems do you use?',
    answer:
      'I use a disciplined multi-system cross-verified approach. Every consultation combines Parashari Jyotish (for overall life destiny and karmic themes), Jaimini Jyotish (for events and major transitions), KP Astrology (for precise timing verification), and Siddha Nadi principles (to reveal repeating family and ancestral patterns). No technique is used in isolation.',
  },
  {
    question: 'Why are your consultations delivered as written reports instead of live calls?',
    answer:
      "A written report is a deliberate choice for uncompromised accuracy. Live calls require real-time improvisation, whereas a written consultation allows me to spend 3-5 hours carefully analyzing and cross-verifying your main natal chart (D1) against various divisional charts (D9, D10, D7, etc.), current dashas, and active transits. This produces a cohesive, lasting document of your life's blueprint that you can revisit for years.",
  },
  {
    question: 'How long does it take to receive my written consultation?',
    answer:
      'Written consultations are typically delivered directly to your email address within 7-10 business Days of receiving your confirmed order and exact birth details.',
  },
  {
    question: 'What birth details are required for a precise reading?',
    answer:
      'To generate highly accurate divisional charts and timing, you will need to provide your Date of Birth, exact Time of Birth (with AM/PM), and Place/City of Birth. If your birth time is approximate, please mention it during checkout so I can adjust the window of analysis.',
  },
  {
    question: 'Are my personal details and birth chart kept confidential?',
    answer:
      'Yes, 100% confidential. Your birth charts, personal narratives, and counseling queries are encrypted and processed solely by me. No details are ever shared with third parties or stored in public databases.',
  },
  {
    question: 'Can I ask follow-up questions after receiving my report?',
    answer:
      'Yes. Every consultation includes a dedicated email window where you can ask clarifying questions about the specific insights, planetary timelines, or themes covered in your custom written report.',
  },
];

const DISCLAIMER_POINTS = [
  {
    title: 'I do not fix real-world problems.',
    body: 'An astrological perspective provides strategic clarity and highlights timing windows, but actual resolution requires your direct action, decisions, and agency in the physical world.',
  },
  {
    title: 'I do not promise miraculous recoveries.',
    body: 'I offer analysis of planetary indicators related to physical pressure and wellness, but this is never a substitute for professional medical diagnosis, treatment, or scientific healthcare.',
  },
  {
    title: 'I do not guarantee absolute remedy outcomes.',
    body: "While aligning your lifestyle or implementing classical remedial recommendations supports personal focus, they are not magical switches to bypass life's natural learning phases or karmic cycles.",
  },
  {
    title: 'I do not claim perfect mathematical certainty.',
    body: 'Although my cross-verified methods provide exceptional historical accuracy, human choices, environmental factors, and free will are infinite. No responsible astrologer should promise 100% predictive certainty.',
  },
];

const CATEGORIES = [
  Category.TOP,
  Category.CONSULTATIONS,
  Category.LOVE,
  Category.MARRIAGE,
  Category.CAREER,
  Category.FINANCE,
  Category.HEALTH,
  Category.ALL,
];

function estimateReadingTime(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const mins = Math.max(2, Math.round(words / 200));
  return `${mins} min read`;
}

function renderTestimonialQuote(text: string) {
  const parts = text.split(/(\(.*?\)-bold)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('(') && part.endsWith(')-bold')) {
      const content = part.substring(1, part.length - 6);
      return (
        <strong key={idx} className="font-semibold text-[#3D3830] not-italic">
          {content}
        </strong>
      );
    }
    return part;
  });
}

const NewLandingPage: React.FC<NewLandingPageProps> = ({
  currency,
  setCurrency,
  favorites,
  toggleFavorite,
  activeCategory,
  setActiveCategory,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  showOnlyFavorites,
  setShowOnlyFavorites,
  sanityPosts,
  onSelectProduct,
  onQuickOrder,
  onWhyUs,
  onContact,
  onPay,
}) => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeLayer, setActiveLayer] = useState<number>(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [visibleTestimonialsCount, setVisibleTestimonialsCount] = useState(6);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: '',
    botcheck: '',
  });
  const [contactStatus, setContactStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [contactError, setContactError] = useState('');

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const filteredProducts = useMemo(() => {
    const result = PRODUCTS.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        p.name.toLowerCase().includes(q) ||
        p.shortDescription.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q);

      const matchesCategory =
        searchQuery !== ''
          ? true
          : activeCategory === Category.ALL ||
            (activeCategory === Category.TOP
              ? ['2093', '3072', '4045'].includes(p.id)
              : p.category === activeCategory);

      const matchesFavorites = !showOnlyFavorites || favorites.includes(p.id);
      return matchesCategory && matchesSearch && matchesFavorites;
    });

    if (sortBy === 'price-asc') {
      return [...result].sort((a, b) => a.priceINR - b.priceINR);
    }
    if (sortBy === 'price-desc') {
      return [...result].sort((a, b) => b.priceINR - a.priceINR);
    }
    return result;
  }, [activeCategory, searchQuery, sortBy, favorites, showOnlyFavorites]);

  const combinedEssays = useMemo(() => {
    const staticItems = articlesData.map((art) => ({
      slug: slugify(art.title),
      title: art.title,
      description: art.description,
      category: art.category,
      readingTime: art.readingTime,
    }));
    const seen = new Set(staticItems.map((i) => i.slug));
    const dynamicItems = sanityPosts
      .filter((p) => p.slug && p.title && !seen.has(p.slug))
      .map((p) => ({
        slug: p.slug,
        title: p.title,
        description: p.description,
        category: p.category || 'Jyotish Essay',
        readingTime: estimateReadingTime(p.content || p.description || ''),
      }));
    return [...dynamicItems, ...staticItems];
  }, [sanityPosts]);

  const shuffledTestimonials = useMemo(() => {
    return [...TESTIMONIALS].sort(() => Math.random() - 0.5);
  }, []);

  const visibleTestimonials = useMemo(
    () => shuffledTestimonials.slice(0, visibleTestimonialsCount),
    [shuffledTestimonials, visibleTestimonialsCount]
  );

  const cycleSort = () => {
    if (sortBy === 'default') setSortBy('price-asc');
    else if (sortBy === 'price-asc') setSortBy('price-desc');
    else setSortBy('default');
  };

  const handleCopyProductId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactStatus('submitting');
    setContactError('');
    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: import.meta.env.VITE_WEB3FORMS_ACCESS_KEY,
          subject: 'Query',
          Name: contactForm.name,
          Email: contactForm.email,
          Message: contactForm.message,
          botcheck: contactForm.botcheck,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setContactStatus('success');
        setContactForm({ name: '', email: '', message: '', botcheck: '' });
        setTimeout(() => setContactStatus('idle'), 5000);
      } else {
        setContactStatus('error');
        setContactError(data.message || 'Failed to send message. Please try again.');
        setTimeout(() => setContactStatus('idle'), 5000);
      }
    } catch {
      setContactStatus('error');
      setContactError('A network error occurred. Please try again.');
      setTimeout(() => setContactStatus('idle'), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#3D3830] font-['Plus_Jakarta_Sans',sans-serif] selection:bg-[#EAE3D7] flex flex-col overflow-x-hidden">
      {/* Three-Zone Frosted Top Bar Contract */}
      <header className="sticky top-0 z-40 w-full px-4 md:px-8 pt-4 animate-cc-slide-down">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-8 rounded-2xl bg-[#EAE3D7]/75 backdrop-blur-md px-5 py-3.5 border border-[#3D3830]/10 transition-shadow duration-300">
          {/* Zone 1: Single-line Brand Wordmark */}
          <Link
            to="/"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="font-serif text-xl font-medium tracking-tight text-[#3D3830] whitespace-nowrap shrink-0 transition-opacity duration-200 hover:opacity-80"
          >
            Cosmic Council
          </Link>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-6">
            <button
              type="button"
              onClick={() => scrollToSection('methodology-section')}
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors duration-200 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#3D3830]/40 cursor-pointer"
            >
              Methodology
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('shop-section')}
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors duration-200 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#3D3830]/40 cursor-pointer"
            >
              Packages
            </button>
            <Link
              to="/blog"
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors duration-200 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#3D3830]/40"
            >
              Blog
            </Link>
            <button
              type="button"
              onClick={() => scrollToSection('testimonials')}
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors duration-200 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#3D3830]/40 cursor-pointer"
            >
              Testimonials
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('faq-section')}
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors duration-200 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#3D3830]/40 cursor-pointer"
            >
              FAQs
            </button>
          </nav>

          {/* Zone 3: Primary Action + Mobile Drawer Toggle */}
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
              <button
                type="button"
                onClick={() => scrollToSection('methodology-section')}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                Methodology
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('shop-section')}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                Packages
              </button>
              <Link
                to="/blog"
                onClick={() => setMobileMenuOpen(false)}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                Blog
              </Link>
              <button
                type="button"
                onClick={() => scrollToSection('testimonials')}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                Testimonials
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('faq-section')}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                FAQs
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onWhyUs();
                }}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                Why Me
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onContact();
                }}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                Contact
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onPay();
                }}
                className="text-left font-medium text-[#3D3830] py-1.5"
              >
                Pay here
              </button>
            </div>
            <div className="pt-3 border-t border-[#3D3830]/10 flex items-center justify-between gap-3">
              <Link
                to="/app/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 text-center rounded-full bg-[#4A453D] px-4 py-2.5 text-xs font-medium text-[#FAF7F2] active:scale-[0.98] transition-transform"
              >
                Login with Gmail
              </Link>
              <Link
                to="/legacy"
                onClick={() => setMobileMenuOpen(false)}
                className="text-xs text-[#8B8275] underline underline-offset-4 whitespace-nowrap"
              >
                Classic View
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* 1. HERO SECTION */}
        <section className="mx-auto max-w-5xl px-6 pt-16 pb-20 md:pt-28 md:pb-28 text-center">
          <p
            className="text-xs font-medium text-[#8B8275] tracking-wide mb-6 animate-cc-slide-down"
            style={{ animationDelay: '40ms' }}
          >
            Ask unlimited questions privately
          </p>

          <h1
            className="font-serif text-4xl sm:text-5xl md:text-7xl font-medium text-[#3D3830] tracking-tight leading-[1.06] max-w-4xl mx-auto mb-10 animate-cc-slide-up"
            style={{ textWrap: 'balance', animationDelay: '100ms' }}
          >
            AI for professional Vedic astrology
          </h1>

          <div
            className="max-w-3xl mx-auto mb-12 rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 px-7 py-8 md:px-12 md:py-10 animate-cc-slide-up"
            style={{ animationDelay: '180ms' }}
          >
            <p className="text-base md:text-lg text-[#5C5449] leading-relaxed">
              Imagine if ChatGPT had the most granular details of your divisional charts, KP charts, Ashtakavarga, Shadbala, Jaimini Karakas, Dashas, and live transits—and was trained on advanced Vedic astrology principles so every prediction is cross-verified across multiple systems before answering you.
            </p>
          </div>

          <div
            className="flex flex-col items-center justify-center gap-4 animate-cc-slide-up"
            style={{ animationDelay: '320ms' }}
          >
            <Link
              to="/app/login"
              className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-[#4A453D] px-10 py-4 text-sm font-medium text-[#FAF7F2] transition-all duration-200 hover:bg-[#38342E] hover:-translate-y-0.5 active:scale-[0.98] whitespace-nowrap cursor-pointer"
            >
              <span>Login with Gmail</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>

            <div className="flex flex-wrap items-center justify-center gap-6 pt-1 text-xs font-medium text-[#8B8275]">
              <button
                type="button"
                onClick={onWhyUs}
                className="hover:text-[#3D3830] underline underline-offset-4 transition-colors duration-200 cursor-pointer"
              >
                How it works
              </button>
              <span aria-hidden="true">·</span>
              <Link
                to="/app/chat?preview=1"
                className="hover:text-[#3D3830] underline underline-offset-4 transition-colors duration-200"
              >
                Preview AI Observatory
              </Link>
            </div>
          </div>
        </section>

        {/* 2. TRUST METHODOLOGY */}
        <section className="border-t border-[#3D3830]/10 bg-[#FDFBF7] py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-6 grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-20 items-start">
            <div className="space-y-8">
              <Reveal direction="down">
                <div className="border-b border-[#3D3830]/10 pb-6">
                  <h2 className="font-serif text-3xl md:text-4xl font-medium text-[#3D3830] leading-tight">
                    Most Astrology Today Suffers From Three Problems
                  </h2>
                </div>
              </Reveal>

              <div className="space-y-7">
                <Reveal direction="left" delay={60}>
                  <div className="space-y-2 pb-6 border-b border-[#3D3830]/10">
                    <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                      <span className="font-['JetBrains_Mono',monospace] text-xs text-[#8B8275] mr-2.5 tabular-nums">
                        01.
                      </span>
                      Surface-Level Indicators
                    </h3>
                    <p className="text-sm md:text-base text-[#5C5449] leading-relaxed">
                      Making wide predictions based only on obvious zodiac signs or single planetary placements. This standard practice completely ignores the vital, layered calculations of divisional charts where actual capacity is mapped.
                    </p>
                  </div>
                </Reveal>

                <Reveal direction="left" delay={140}>
                  <div className="space-y-2 pb-6 border-b border-[#3D3830]/10">
                    <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                      <span className="font-['JetBrains_Mono',monospace] text-xs text-[#8B8275] mr-2.5 tabular-nums">
                        02.
                      </span>
                      Purely Textbook Knowledge
                    </h3>
                    <p className="text-sm md:text-base text-[#5C5449] leading-relaxed">
                      Regurgitating generic textbook sentences instead of conducting personalized synthesis. True astrology requires translating ancient guidelines to match your unique modern environment, background, and specific lifestyle.
                    </p>
                  </div>
                </Reveal>

                <Reveal direction="left" delay={220}>
                  <div className="space-y-2">
                    <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                      <span className="font-['JetBrains_Mono',monospace] text-xs text-[#8B8275] mr-2.5 tabular-nums">
                        03.
                      </span>
                      Single-System Over-Reliance
                    </h3>
                    <p className="text-sm md:text-base text-[#5C5449] leading-relaxed">
                      Basing critical life decisions on a single system or placement. Without the analytical safety of multi-system cross-verification, isolated observations lead to false timing or skewed interpretations.
                    </p>
                  </div>
                </Reveal>
              </div>
            </div>

            <Reveal direction="right" delay={140}>
              <div className="rounded-3xl bg-[#F1ECE3] p-8 md:p-12 border border-[#3D3830]/10 space-y-7 transition-transform duration-300 hover:-translate-y-0.5">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[#8B8275]">My Commitment</p>
                  <h3 className="font-serif text-3xl md:text-4xl font-medium text-[#3D3830] leading-tight">
                    I approach it differently..
                  </h3>
                </div>

                <div className="space-y-5 text-sm md:text-base text-[#5C5449] leading-relaxed">
                  <p>
                    Every consultation begins by{' '}
                    <span className="font-medium text-[#3D3830] underline underline-offset-4 decoration-[#B8965A]">
                      validating the structural promise
                    </span>{' '}
                    of your chart. If the foundational configuration doesn&apos;t support an event, I do not promise it.
                  </p>
                  <p>
                    Every important conclusion is{' '}
                    <span className="font-medium text-[#3D3830] underline underline-offset-4 decoration-[#B8965A]">
                      cross-verified using multiple independent systems
                    </span>{' '}
                    before I formulate any final event timeline.
                  </p>
                  <p>
                    Astrology is not a system of flattering illusions. It is a tool for diagnostic reality, empowering you to navigate transitions with clarity and strategy.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 3. HOW EVERY READING IS DONE */}
        <section id="methodology-section" className="border-t border-[#3D3830]/10 bg-[#FAF7F2] py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal direction="down">
              <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
                <h2 className="font-serif text-3xl md:text-5xl font-medium text-[#3D3830] tracking-tight leading-tight">
                  How Every Reading Is Done
                </h2>
                <p className="text-sm md:text-base text-[#5C5449] leading-relaxed">
                  &ldquo;No important prediction is based on a single indicator. Every major conclusion is tested across multiple independent techniques before it becomes part of my final assessment.&rdquo;
                </p>
              </div>
            </Reveal>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-5 space-y-3">
                {READING_LAYERS.map((layer, index) => {
                  const isActive = activeLayer === index;
                  return (
                    <Reveal key={layer.title} direction="left" delay={index * 70}>
                      <button
                        type="button"
                        onClick={() => setActiveLayer(index)}
                        className={`w-full text-left rounded-2xl p-5 border transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center justify-between gap-4 cursor-pointer active:scale-[0.99] ${
                          isActive
                            ? 'bg-[#FDFBF7] border-[#3D3830]/30 translate-x-1 shadow-sm'
                            : 'bg-[#F1ECE3]/65 border-[#3D3830]/10 hover:bg-[#F1ECE3] hover:translate-x-0.5'
                        }`}
                      >
                        <div className="min-w-0">
                          <p
                            className={`font-['JetBrains_Mono',monospace] text-[11px] tabular-nums transition-colors duration-200 ${
                              isActive ? 'text-[#B8965A]' : 'text-[#8B8275]'
                            }`}
                          >
                            Layer 0{index + 1}
                          </p>
                          <h3
                            className={`font-serif text-lg mt-0.5 transition-colors duration-200 ${
                              isActive ? 'font-medium text-[#3D3830]' : 'text-[#5C5449]'
                            }`}
                          >
                            {layer.title.split(': ')[1]}
                          </h3>
                        </div>
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 transition-all duration-300 ${
                            isActive ? 'text-[#B8965A] translate-x-1' : 'text-[#8B8275]'
                          }`}
                        />
                      </button>
                    </Reveal>
                  );
                })}
              </div>

              <Reveal direction="right" delay={120} className="lg:col-span-7">
                <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-8 md:p-10 min-h-[380px] flex flex-col justify-between overflow-hidden">
                  <div key={activeLayer} className="space-y-5 animate-cc-tab-panel">
                    <div className="space-y-2">
                      <p className="font-['JetBrains_Mono',monospace] text-xs text-[#B8965A]">
                        {READING_LAYERS[activeLayer].title}
                      </p>
                      <h3 className="font-serif text-2xl md:text-3xl font-medium text-[#3D3830] leading-tight">
                        {READING_LAYERS[activeLayer].subtitle}
                      </h3>
                      <p className="text-sm md:text-base text-[#5C5449] leading-relaxed">
                        {READING_LAYERS[activeLayer].description}
                      </p>
                    </div>

                    <div className="h-px bg-[#3D3830]/10" />

                    <div className="space-y-3">
                      <p className="text-xs font-medium text-[#8B8275]">Analysis Includes:</p>
                      <ul className="space-y-3">
                        {READING_LAYERS[activeLayer].items.map((item, idx) => (
                          <li
                            key={item}
                            style={{ animationDelay: `${idx * 55}ms` }}
                            className="flex items-start gap-3 text-sm text-[#5C5449] animate-cc-tab-panel"
                          >
                            <Check className="h-4 w-4 text-[#B8965A] shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <p className="mt-8 pt-5 border-t border-[#3D3830]/10 text-xs text-[#8B8275] italic">
                    *Each analytical layer either strengthens, weakens, confirms or rejects previous observations until only the strongest, most stable conclusions remain.
                  </p>
                </div>
              </Reveal>
            </div>

            <Reveal direction="up" delay={100}>
              <div className="mt-12 text-center">
                <button
                  type="button"
                  onClick={() => onQuickOrder()}
                  className="group inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-8 py-3.5 text-sm font-medium text-[#FAF7F2] hover:bg-[#38342E] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 whitespace-nowrap cursor-pointer"
                >
                  <span>Book your Reading</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 4. MULTI-SYSTEM CROSS-VERIFIED ANALYSIS */}
        <section className="border-t border-[#3D3830]/10 bg-[#FDFBF7] py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal direction="down">
              <div className="max-w-3xl mx-auto text-center mb-14 space-y-4">
                <h2 className="font-serif text-3xl md:text-5xl font-medium text-[#3D3830] tracking-tight leading-tight">
                  Multi-System Cross-Verified Analysis
                </h2>
                <p className="text-sm md:text-base text-[#5C5449] leading-relaxed">
                  I do not restrict my analysis to a single school of thought. Every system is selected because it solves a different part of the puzzle, providing a robust web of converging evidence.
                </p>
              </div>
            </Reveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <Reveal direction="up" delay={0}>
                <div className="h-full rounded-3xl bg-[#F1ECE3] border border-[#3D3830]/10 p-7 md:p-8 space-y-3 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-[#3D3830]/25">
                  <p className="font-['JetBrains_Mono',monospace] text-xs text-[#8B8275]">
                    01 · Primary Layer
                  </p>
                  <h3 className="font-serif text-2xl font-medium text-[#3D3830]">Parashari Jyotish</h3>
                  <p className="text-sm text-[#5C5449] leading-relaxed">
                    The structural foundation of the analysis. Used to analyze major themes, planetary alignments, yogas, doshas, and the raw potential within the chart.
                  </p>
                </div>
              </Reveal>

              <Reveal direction="up" delay={100}>
                <div className="h-full rounded-3xl bg-[#F1ECE3] border border-[#3D3830]/10 p-7 md:p-8 space-y-3 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-[#3D3830]/25">
                  <p className="font-['JetBrains_Mono',monospace] text-xs text-[#8B8275]">
                    02 · Verification Layer
                  </p>
                  <h3 className="font-serif text-2xl font-medium text-[#3D3830]">Jaimini Jyotish</h3>
                  <p className="text-sm text-[#5C5449] leading-relaxed">
                    Acts as an independent verifier. By analyzing Chara Karakas, destiny triggers, and major cycles from a completely separate perspective, I can cross-check Parashari&apos;s findings.
                  </p>
                </div>
              </Reveal>

              <Reveal direction="up" delay={200}>
                <div className="h-full rounded-3xl bg-[#F1ECE3] border border-[#3D3830]/10 p-7 md:p-8 space-y-3 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-[#3D3830]/25">
                  <p className="font-['JetBrains_Mono',monospace] text-xs text-[#8B8275]">
                    03 · Timing Precision
                  </p>
                  <h3 className="font-serif text-2xl font-medium text-[#3D3830]">KP Astrology</h3>
                  <p className="text-sm text-[#5C5449] leading-relaxed">
                    Used for exact timelines and event confirmation. Provides sub-lord level accuracy that allows me to narrow down timing windows with mathematical reliability.
                  </p>
                </div>
              </Reveal>
            </div>

            {/* Observatory Night Accent Callout */}
            <Reveal direction="up" delay={120}>
              <div className="mt-14 rounded-3xl bg-[#1F2229] text-[#F4EFE6] p-8 md:p-12 max-w-4xl mx-auto text-center border border-white/10">
                <p className="font-serif text-lg md:text-2xl leading-relaxed tracking-wide">
                  &ldquo;Every prediction is independently verified across multiple classical and modern Vedic astrology systems - including Parashari, Jaimini, KP, Nadi, divisional charts, Dashas, transits, Ashtakavarga, and planetary strength analysis - so your reading is based on converging evidence, not a single technique.&rdquo;
                </p>
              </div>
            </Reveal>

            <Reveal direction="up" delay={160}>
              <div className="mt-12 text-center">
                <button
                  type="button"
                  onClick={() => onQuickOrder()}
                  className="group inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-8 py-3.5 text-sm font-medium text-[#FAF7F2] hover:bg-[#38342E] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 whitespace-nowrap cursor-pointer"
                >
                  <span>Get Started Here</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 5. PATTERNS OVER PREDICTIONS */}
        <section className="border-t border-[#3D3830]/10 bg-[#FAF7F2] py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 lg:gap-20 items-start">
              <Reveal direction="left" className="lg:col-span-5 lg:sticky lg:top-28">
                <div className="space-y-6">
                  <p className="text-xs font-medium text-[#8B8275]">My Philosophy</p>
                  <h2 className="font-serif text-4xl md:text-5xl font-medium text-[#3D3830] tracking-tight leading-[1.1]">
                    Patterns Over Predictions
                  </h2>
                  <p className="text-sm md:text-base text-[#5C5449] leading-relaxed">
                    Astrology is most powerful when it acts as a compass, not a crystal ball. My consultations are not built around dramatic, sensational forecasts. Instead, they aim to identify the deeper, underlying structures that shape your reality.
                  </p>
                  <p className="text-sm md:text-base text-[#8B8275] leading-relaxed">
                    When you understand the recurring currents in your life, you stop reacting blindly and start acting with strategic perspective.
                  </p>
                </div>
              </Reveal>

              <div className="lg:col-span-7 divide-y divide-[#3D3830]/10 border-t border-b border-[#3D3830]/10">
                {PATTERNS_LIST.map((item, idx) => (
                  <Reveal key={item.number} direction="right" delay={idx * 65}>
                    <div className="py-7 space-y-2 transition-transform duration-200 hover:translate-x-1">
                      <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                        <span className="font-['JetBrains_Mono',monospace] text-xs text-[#B8965A] mr-3 tabular-nums">
                          {item.number}
                        </span>
                        {item.title}
                      </h3>
                      <p className="text-sm md:text-base text-[#5C5449] leading-relaxed">{item.body}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>

            <Reveal direction="up" delay={100}>
              <div className="mt-16 py-8 border-y border-[#3D3830]/10 text-center max-w-4xl mx-auto">
                <p className="font-serif text-xl md:text-2xl leading-relaxed text-[#3D3830] italic">
                  &ldquo;The goal isn&apos;t simply to predict the future. It&apos;s to help you understand the patterns shaping your life, recognise what is within your control, and make better-informed decisions as your circumstances evolve.&rdquo;
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 6. WHY WRITTEN CONSULTATIONS */}
        <section className="border-t border-[#3D3830]/10 bg-[#FDFBF7] py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 lg:gap-20 items-start">
              <Reveal direction="left" className="lg:col-span-5 lg:sticky lg:top-28">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <p className="text-xs font-medium text-[#8B8275]">A Deliberate Choice</p>
                    <h2 className="font-serif text-3xl md:text-5xl font-medium text-[#3D3830] tracking-tight leading-tight">
                      Why Written Consultations?
                    </h2>
                    <p className="text-sm md:text-base text-[#5C5449] leading-relaxed">
                      I intentionally deliver all my readings as comprehensive, structured written reports rather than live phone calls. This is a deliberate design choice built to maximize the depth, accuracy, and lasting value of your consultation.
                    </p>
                  </div>

                  <div className="rounded-3xl bg-[#1F2229] text-[#F4EFE6] p-7 md:p-8 space-y-3 border border-white/10 transition-transform duration-300 hover:-translate-y-0.5">
                    <h3 className="font-serif text-xl font-medium text-[#F4EFE6]">Synthesis Takes Time</h3>
                    <p className="text-sm text-[#F4EFE6]/80 leading-relaxed">
                      Many crucial, repeating insights only reveal themselves after spending considerable time synthesizing the intersecting layers of a chart - which is mathematically impossible in a live, real-time consultation.
                    </p>
                  </div>
                </div>
              </Reveal>

              <div className="lg:col-span-7 divide-y divide-[#3D3830]/10 border-t border-b border-[#3D3830]/10">
                {WHY_WRITTEN_POINTS.map((item, idx) => (
                  <Reveal key={item.number} direction="right" delay={idx * 65}>
                    <div className="py-7 space-y-2 transition-transform duration-200 hover:translate-x-1">
                      <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                        <span className="font-['JetBrains_Mono',monospace] text-xs text-[#B8965A] mr-3 tabular-nums">
                          {item.number}
                        </span>
                        {item.title}
                      </h3>
                      <p className="text-sm md:text-base text-[#5C5449] leading-relaxed">{item.body}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>

            <Reveal direction="up" delay={100}>
              <div className="mt-16 rounded-3xl bg-[#F1ECE3] border border-[#3D3830]/10 p-8 md:p-10 text-center max-w-4xl mx-auto">
                <p className="font-serif text-lg md:text-xl text-[#3D3830] leading-relaxed italic">
                  &ldquo;I believe thoughtful analysis deserves thoughtful delivery. A carefully written consultation allows me to spend more time understanding your chart - and gives you guidance that remains valuable long after you&apos;ve finished reading it.&rdquo;
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 7. CHOOSE YOUR CONSULTATION (OBSERVATORY NIGHT CATALOG) */}
        <section id="shop-section" className="bg-[#1F2229] text-[#F4EFE6] py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <Reveal direction="left">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[#B8965A]">Written Reports &amp; Consultations</p>
                  <h2 className="font-serif text-3xl md:text-5xl font-medium text-[#F4EFE6] tracking-tight leading-tight">
                    Choose Your Consultation
                  </h2>
                </div>
              </Reveal>

              {/* Currency Switcher */}
              <Reveal direction="right">
                <div className="inline-flex items-center gap-1 rounded-full bg-[#292D36] p-1 border border-white/10 self-start md:self-auto">
                  {Object.values(Currency).map((curr) => (
                    <button
                      type="button"
                      key={curr}
                      onClick={() => setCurrency(curr)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-['JetBrains_Mono',monospace] transition-all duration-200 active:scale-95 cursor-pointer ${
                        currency === curr
                          ? 'bg-[#FAF7F2] text-[#1F2229] font-medium shadow-sm'
                          : 'text-[#F4EFE6]/70 hover:text-[#F4EFE6]'
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* Filter & Search Toolbar */}
            <Reveal direction="up" delay={60}>
              <div className="space-y-5 mb-10">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {CATEGORIES.map((cat) => {
                    const active = activeCategory === cat;
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`whitespace-nowrap shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 active:scale-95 cursor-pointer border ${
                          active
                            ? 'bg-[#FAF7F2] text-[#1F2229] border-[#FAF7F2] shadow-sm'
                            : 'bg-[#292D36] text-[#F4EFE6]/80 border-white/10 hover:border-white/25 hover:text-[#F4EFE6]'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="relative flex-1 min-w-0">
                    <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#F4EFE6]/50" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name or ID..."
                      className="w-full rounded-2xl bg-[#292D36] border border-white/10 pl-11 pr-4 py-3 text-sm text-[#F4EFE6] placeholder:text-[#F4EFE6]/45 focus:outline-none focus:border-[#B8965A] transition-colors duration-200"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                    title="Filter saved consultations"
                    className={`h-[46px] w-[46px] shrink-0 rounded-2xl border flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer ${
                      showOnlyFavorites
                        ? 'bg-[#B8965A] border-[#B8965A] text-[#1F2229]'
                        : 'bg-[#292D36] border-white/10 text-[#F4EFE6]/70 hover:text-[#F4EFE6]'
                    }`}
                  >
                    <Heart className={`h-4 w-4 transition-transform duration-200 ${showOnlyFavorites ? 'fill-current scale-110' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={cycleSort}
                    title="Sort by price"
                    className={`h-[46px] px-4 shrink-0 rounded-2xl border flex items-center gap-2 text-xs font-medium transition-all duration-200 active:scale-95 cursor-pointer ${
                      sortBy !== 'default'
                        ? 'bg-[#FAF7F2] border-[#FAF7F2] text-[#1F2229]'
                        : 'bg-[#292D36] border-white/10 text-[#F4EFE6]/75 hover:text-[#F4EFE6]'
                    }`}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    <span className="hidden sm:inline whitespace-nowrap">
                      {sortBy === 'price-asc'
                        ? 'Price: Low'
                        : sortBy === 'price-desc'
                        ? 'Price: High'
                        : 'Sort'}
                    </span>
                  </button>
                </div>
              </div>
            </Reveal>

            {filteredProducts.length > 0 ? (
              <div
                key={`${activeCategory}-${sortBy}-${showOnlyFavorites}`}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {filteredProducts.map((product, idx) => {
                  const isFav = favorites.includes(product.id);
                  const deliveryTime = product.priceINR > 10000 ? '10-15 days' : '7-10 days';
                  return (
                    <div
                      key={product.id}
                      onClick={() => onSelectProduct(product)}
                      style={{ animationDelay: `${Math.min(idx, 6) * 55}ms` }}
                      className="group rounded-3xl bg-[#292D36] border border-white/10 p-7 flex flex-col justify-between hover:border-[#B8965A]/55 hover:-translate-y-1.5 active:scale-[0.99] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer animate-cc-tab-panel"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <div className="flex items-center gap-2 text-xs font-['JetBrains_Mono',monospace] text-[#F4EFE6]/55">
                            <span>ID: {product.id}</span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyProductId(e, product.id)}
                              title="Copy ID"
                              className="text-[#F4EFE6]/50 hover:text-[#F4EFE6] transition-colors"
                            >
                              {copiedId === product.id ? (
                                <Check className="h-3.5 w-3.5 text-[#B8965A]" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <span aria-hidden="true">·</span>
                            <span>{product.category}</span>
                          </div>

                          <button
                            type="button"
                            aria-label="Toggle favorite"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(product.id);
                            }}
                            className={`p-1.5 rounded-full transition-all duration-200 active:scale-125 ${
                              isFav ? 'text-[#B8965A]' : 'text-[#F4EFE6]/40 hover:text-[#F4EFE6]'
                            }`}
                          >
                            <Heart className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
                          </button>
                        </div>

                        <h3 className="font-serif text-2xl font-medium text-[#F4EFE6] mb-3 group-hover:text-[#B8965A] transition-colors duration-200">
                          {product.name}
                        </h3>

                        <p className="text-sm text-[#F4EFE6]/75 leading-relaxed mb-6">
                          {product.id === '1042'
                            ? 'Currently only available for students under 20 and special cases'
                            : product.shortDescription}
                        </p>
                      </div>

                      <div className="pt-5 border-t border-white/10 space-y-4">
                        <p className="text-xs text-[#F4EFE6]/60">
                          Delivered in {deliveryTime} · Report delivered to your email
                        </p>

                        <div className="flex items-center justify-between gap-4">
                          <div className="font-['JetBrains_Mono',monospace] tabular-nums text-xl font-medium text-[#F4EFE6]">
                            {formatCurrencyPrice(product.priceINR, currency)}
                          </div>

                          <Link
                            to="/app/login"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF7F2] px-4 py-2 text-xs font-medium text-[#1F2229] hover:bg-[#B8965A] hover:text-[#1F2229] transition-colors duration-200 whitespace-nowrap"
                          >
                            Login with Gmail
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center rounded-3xl bg-[#292D36] border border-white/10 animate-cc-tab-panel">
                <p className="text-sm text-[#F4EFE6]/70">
                  No consultations found matching your search.
                </p>
              </div>
            )}

            <Reveal direction="up" delay={100}>
              <div className="mt-12 rounded-2xl bg-[#292D36] border border-white/10 px-6 py-5 text-center max-w-3xl mx-auto">
                <p className="text-sm text-[#F4EFE6]/85 leading-relaxed">
                  All analyses and predictions are conducted using{' '}
                  <span className="text-[#B8965A] font-medium">Vedic Astrology systems</span>.
                  Consultations are provided{' '}
                  <span className="font-medium underline underline-offset-4 decoration-[#B8965A]/60">
                    exclusively via email
                  </span>
                  .
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 8. VEDIC ASTROLOGY BLOG & ESSAYS */}
        <section id="my-thoughts-section" className="bg-[#FAF7F2] py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <Reveal direction="left">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[#8B8275]">Essays &amp; Research Notes</p>
                  <h2 className="font-serif text-3xl md:text-5xl font-medium text-[#3D3830] tracking-tight leading-tight">
                    Vedic Astrology Blog &amp; Essays
                  </h2>
                </div>
              </Reveal>
              <Reveal direction="right">
                <Link
                  to="/blog"
                  className="group inline-flex items-center gap-2 text-sm font-medium text-[#3D3830] underline underline-offset-4 hover:text-[#5C5449] whitespace-nowrap shrink-0"
                >
                  <span>View all essays</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </Reveal>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {combinedEssays.map((art, idx) => (
                <Reveal key={art.slug} direction="up" delay={(idx % 4) * 70}>
                  <article
                    onClick={() => navigate(`/blog/${art.slug}`)}
                    className="group h-full rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-8 flex flex-col justify-between hover:border-[#3D3830]/25 hover:-translate-y-1 active:scale-[0.99] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs text-[#8B8275]">
                        <span className="font-medium text-[#5C5449]">{art.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-['JetBrains_Mono',monospace] tabular-nums">
                          {art.readingTime}
                        </span>
                      </div>
                      <h3 className="font-serif text-2xl font-medium text-[#3D3830] group-hover:text-[#5C5449] transition-colors duration-200 leading-snug">
                        {art.title}
                      </h3>
                      <p className="text-sm text-[#5C5449] leading-relaxed line-clamp-3">
                        {art.description}
                      </p>
                    </div>

                    <div className="pt-6">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3D3830] underline underline-offset-4">
                        <span>Read Now</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                      </span>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 9. FREQUENTLY ASKED QUESTIONS */}
        <section id="faq-section" className="border-t border-[#3D3830]/10 bg-[#FDFBF7] py-20 md:py-28">
          <div className="mx-auto max-w-4xl px-6">
            <Reveal direction="down">
              <div className="text-center mb-14 space-y-3">
                <p className="text-xs font-medium text-[#8B8275]">Direct Answers</p>
                <h2 className="font-serif text-3xl md:text-5xl font-medium text-[#3D3830] tracking-tight leading-tight">
                  Frequently Asked Questions
                </h2>
                <p className="text-sm md:text-base text-[#5C5449] max-w-2xl mx-auto">
                  Clear, transparent answers to help you understand my methodology, delivery format, and consulting principles.
                </p>
              </div>
            </Reveal>

            <div className="space-y-3">
              {FAQS.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <Reveal key={faq.question} direction="up" delay={idx * 55}>
                    <div
                      className={`rounded-2xl bg-[#FAF7F2] border transition-colors duration-200 overflow-hidden ${
                        isOpen ? 'border-[#3D3830]/25' : 'border-[#3D3830]/10'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        aria-expanded={isOpen}
                        className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 text-[#3D3830] hover:bg-[#F1ECE3]/60 transition-colors duration-200 cursor-pointer"
                      >
                        <span className="font-serif text-lg md:text-xl font-medium leading-snug">
                          {faq.question}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-[#8B8275] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                            isOpen ? 'rotate-180 text-[#3D3830]' : ''
                          }`}
                        />
                      </button>

                      <div
                        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="px-6 pb-6 pt-3 border-t border-[#3D3830]/10 text-sm md:text-base text-[#5C5449] leading-relaxed">
                            {faq.answer}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* 10. HONEST STATEMENT & FINAL CTA */}
        <section className="border-t border-[#3D3830]/10 bg-[#FAF7F2] py-20 md:py-28">
          <div className="mx-auto max-w-3xl px-6 space-y-16">
            <div className="space-y-8">
              <Reveal direction="down">
                <div className="border-b border-[#3D3830]/10 pb-5">
                  <h2 className="font-serif text-3xl md:text-4xl font-medium text-[#3D3830] leading-tight">
                    An Honest Statement on What I Cannot Promise
                  </h2>
                </div>
              </Reveal>

              <Reveal direction="up" delay={60}>
                <p className="text-sm md:text-base text-[#5C5449] leading-relaxed">
                  In a field often crowded with dramatic claims, I believe professional credibility starts with absolute transparency. It is vital to outline what this consultation cannot achieve for you:
                </p>
              </Reveal>

              <ul className="divide-y divide-[#3D3830]/10 border-t border-b border-[#3D3830]/10">
                {DISCLAIMER_POINTS.map((item, idx) => (
                  <Reveal key={item.title} direction="left" delay={idx * 70}>
                    <li className="py-5 space-y-1.5">
                      <strong className="font-serif text-lg font-medium text-[#3D3830] block">
                        {item.title}
                      </strong>
                      <p className="text-sm md:text-base text-[#5C5449] leading-relaxed">
                        {item.body}
                      </p>
                    </li>
                  </Reveal>
                ))}
              </ul>

              <Reveal direction="up" delay={100}>
                <p className="text-sm md:text-base text-[#5C5449] leading-relaxed">
                  Human life is an elegant dance between destiny&apos;s map and the choices we make. I choose to be completely honest about these realities so we can focus on building authentic strategic clarity for your situation.
                </p>
              </Reveal>
            </div>

            <Reveal direction="up" delay={120}>
              <div className="rounded-3xl bg-[#1F2229] text-[#F4EFE6] p-10 md:p-14 text-center space-y-6 border border-white/10">
                <h3 className="font-serif text-3xl md:text-4xl font-medium tracking-tight leading-tight">
                  Want me to analyse YOUR chart?
                </h3>
                <p className="text-sm md:text-base text-[#F4EFE6]/80 max-w-lg mx-auto leading-relaxed">
                  Get an honest, multi-system, deeply cross-verified analysis of your career, relationships, or upcoming life phases delivered in a detailed written report.
                </p>
                <div className="pt-2">
                  <Link
                    to="/app/login"
                    className="group inline-flex items-center gap-2 rounded-full bg-[#FAF7F2] px-9 py-3.5 text-sm font-medium text-[#1F2229] hover:bg-[#B8965A] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 whitespace-nowrap cursor-pointer"
                  >
                    <span>Login with Gmail</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 11. REAL TESTIMONIALS */}
        <section id="testimonials" className="border-t border-[#3D3830]/10 bg-[#FDFBF7] py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal direction="down">
              <div className="text-center mb-14 space-y-3">
                <p className="text-xs font-medium text-[#8B8275]">See what others are saying</p>
                <h2 className="font-serif text-3xl md:text-5xl font-medium text-[#3D3830] tracking-tight">
                  Real Testimonials
                </h2>
              </div>
            </Reveal>

            <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6 [column-fill:_balance]">
              {visibleTestimonials.map((t, idx) => (
                <div
                  key={`${t.name}-${idx}`}
                  style={{ animationDelay: `${(idx % 6) * 55}ms` }}
                  className="break-inside-avoid rounded-3xl bg-[#FAF7F2] border border-[#3D3830]/10 p-7 space-y-5 hover:-translate-y-1 hover:border-[#3D3830]/20 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] animate-cc-tab-panel"
                >
                  <div className="flex items-center gap-1 text-[#B8965A]" aria-label="5 out of 5 stars">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-current" />
                    ))}
                  </div>
                  <p className="text-sm md:text-base text-[#5C5449] leading-relaxed italic">
                    &ldquo;{renderTestimonialQuote(t.quote)}&rdquo;
                  </p>
                  <div className="pt-4 border-t border-[#3D3830]/10 flex items-center justify-between gap-2 text-xs">
                    <span className="font-serif text-base font-medium text-[#3D3830]">{t.name}</span>
                    <span className="text-[#8B8275]">{t.area}</span>
                  </div>
                </div>
              ))}
            </div>

            {visibleTestimonialsCount < shuffledTestimonials.length && (
              <Reveal direction="up">
                <div className="mt-12 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleTestimonialsCount((c) => c + 6)}
                    className="rounded-full border border-[#3D3830]/20 bg-[#F1ECE3] px-7 py-3 text-xs font-medium text-[#3D3830] hover:bg-[#E7E0D3] active:scale-95 transition-all duration-200 cursor-pointer"
                  >
                    Load more testimonials
                  </button>
                </div>
              </Reveal>
            )}

            <Reveal direction="up" delay={80}>
              <div className="mt-10 text-center">
                <Link
                  to="/app/login"
                  className="group inline-flex items-center gap-2 text-sm font-medium text-[#3D3830] underline underline-offset-4 hover:text-[#5C5449] cursor-pointer"
                >
                  <span>Ready to understand your own chart? Login with Gmail</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 12. QUICK CONTACT */}
        <section className="border-t border-[#3D3830]/10 bg-[#FAF7F2] py-20">
          <div className="mx-auto max-w-xl px-6">
            <Reveal direction="up">
              <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-8 md:p-10">
                {contactStatus === 'success' ? (
                  <div className="py-8 text-center space-y-3 animate-cc-tab-panel">
                    <Check className="h-8 w-8 text-[#5B7056] mx-auto" />
                    <h3 className="font-serif text-2xl font-medium text-[#3D3830]">
                      Message Sent Successfully
                    </h3>
                  </div>
                ) : (
                  <>
                    <div className="text-center mb-7 space-y-1.5">
                      <p className="text-xs font-medium text-[#8B8275]">Have a quick question?</p>
                      <h3 className="font-serif text-2xl md:text-3xl font-medium text-[#3D3830]">
                        Quick Contact
                      </h3>
                    </div>

                    <form onSubmit={handleContactSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <input
                          type="text"
                          required
                          placeholder="Name"
                          value={contactForm.name}
                          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                          className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-4 py-3 text-sm text-[#3D3830] placeholder:text-[#8B8275]/75 focus:border-[#4A453D] focus:outline-none transition-colors duration-200"
                        />
                        <input
                          type="email"
                          required
                          placeholder="Email"
                          value={contactForm.email}
                          onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                          className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-4 py-3 text-sm text-[#3D3830] placeholder:text-[#8B8275]/75 focus:border-[#4A453D] focus:outline-none transition-colors duration-200"
                        />
                      </div>
                      <textarea
                        required
                        placeholder="Message"
                        value={contactForm.message}
                        onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                        className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-4 py-3 text-sm text-[#3D3830] placeholder:text-[#8B8275]/75 focus:border-[#4A453D] focus:outline-none min-h-[110px] resize-none transition-colors duration-200"
                      />
                      <input
                        type="text"
                        name="botcheck"
                        value={contactForm.botcheck}
                        onChange={(e) => setContactForm({ ...contactForm, botcheck: e.target.value })}
                        className="hidden"
                        tabIndex={-1}
                        autoComplete="off"
                      />
                      {contactStatus === 'error' && (
                        <p className="text-xs text-[#A94438] text-center">{contactError}</p>
                      )}
                      <button
                        type="submit"
                        disabled={contactStatus === 'submitting'}
                        className="w-full rounded-full bg-[#4A453D] px-6 py-3.5 text-sm font-medium text-[#FAF7F2] hover:bg-[#38342E] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 cursor-pointer"
                      >
                        {contactStatus === 'submitting' ? 'Sending...' : 'Send message'}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* QUIET EDITORIAL FOOTER */}
      <footer className="border-t border-[#3D3830]/10 bg-[#F1ECE3] py-16">
        <Reveal direction="up">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-[#3D3830]/10">
              <div className="md:col-span-5 space-y-4">
                <p className="font-serif text-2xl font-medium text-[#3D3830]">Cosmic Council</p>
                <p className="text-sm text-[#5C5449] leading-relaxed max-w-md">
                  I use a multi-system cross-verified approach, combining Parashari, Jaimini, KP, and Siddha Nadi techniques providing a highly accurate, dependable, authentic prediction framework that can be relied on.
                </p>
              </div>

              <div className="md:col-span-2 space-y-3 text-sm">
                <p className="text-xs font-medium text-[#8B8275]">Packages</p>
                <ul className="space-y-2 text-[#5C5449]">
                  {[
                    Category.TOP,
                    Category.CONSULTATIONS,
                    Category.LOVE,
                    Category.MARRIAGE,
                    Category.CAREER,
                    Category.FINANCE,
                    Category.HEALTH,
                    Category.ALL,
                  ].map((cat) => (
                    <li key={cat}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCategory(cat);
                          scrollToSection('shop-section');
                        }}
                        className="hover:text-[#3D3830] transition-colors cursor-pointer"
                      >
                        {cat}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="md:col-span-2 space-y-3 text-sm">
                <p className="text-xs font-medium text-[#8B8275]">About</p>
                <ul className="space-y-2 text-[#5C5449]">
                  <li>
                    <button
                      type="button"
                      onClick={onWhyUs}
                      className="hover:text-[#3D3830] transition-colors cursor-pointer"
                    >
                      Why Me
                    </button>
                  </li>
                  <li>
                    <Link to="/blog" className="hover:text-[#3D3830] transition-colors">
                      Blog
                    </Link>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => scrollToSection('testimonials')}
                      className="hover:text-[#3D3830] transition-colors cursor-pointer"
                    >
                      Testimonials
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => scrollToSection('faq-section')}
                      className="hover:text-[#3D3830] transition-colors cursor-pointer"
                    >
                      FAQs
                    </button>
                  </li>
                  <li>
                    <Link to="/app/login" className="hover:text-[#3D3830] transition-colors">
                      Login
                    </Link>
                  </li>
                  <li>
                    <Link to="/legacy" className="hover:text-[#3D3830] transition-colors">
                      Classic Homepage
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="md:col-span-3 space-y-3">
                <p className="text-xs font-medium text-[#8B8275]">Direct Actions</p>
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => onQuickOrder()}
                    className="w-full rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] active:scale-[0.98] transition-all duration-200 cursor-pointer"
                  >
                    Order Reading
                  </button>
                  <button
                    type="button"
                    onClick={onPay}
                    className="w-full rounded-full border border-[#3D3830]/20 bg-[#FDFBF7] px-5 py-2.5 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7] active:scale-[0.98] transition-all duration-200 cursor-pointer"
                  >
                    Quick Payment
                  </button>
                  <button
                    type="button"
                    onClick={onContact}
                    className="w-full rounded-full border border-[#3D3830]/20 bg-[#FDFBF7] px-5 py-2.5 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7] active:scale-[0.98] transition-all duration-200 cursor-pointer"
                  >
                    Contact
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8B8275]">
              <p>© {new Date().getFullYear()} CosmicCouncil.pro · All rights reserved.</p>
              <div className="flex items-center gap-6">
                <Link to="/legacy" className="hover:text-[#3D3830] transition-colors">
                  Archived Classic View
                </Link>
                <Link to="/app/login" className="hover:text-[#3D3830] transition-colors">
                  Member Observatory
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </footer>
    </div>
  );
};

export default NewLandingPage;
