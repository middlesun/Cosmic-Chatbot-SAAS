import React, { useEffect, useState } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { Category, Currency, Product, slugify } from '../../types';
import { PRODUCTS } from '../../constants';
import type { SanityArticleItem } from '../../lib/sanity';
import MetaTags from '../MetaTags';
import Header from './Header';
import Hero from './Hero';
import TrustMethodology from './TrustMethodology';
import ReadingMethodology from './ReadingMethodology';
import MultiSystemAnalysis from './MultiSystemAnalysis';
import PatternsOverPredictions from './PatternsOverPredictions';
import WhyWritten from './WhyWritten';
import Shop from './Shop';
import DisclaimerCTA from './DisclaimerCTA';
import Testimonials from './Testimonials';
import QuickContact from './QuickContact';
import FAQSection from './FAQSection';
import Footer from './Footer';
import WhyUs from './WhyUs';
import ContactForm from './ContactForm';
import QuickPayment from './QuickPayment';
import QuickOrder from './QuickOrder';
import ProductDetail from './ProductDetail';
import MyThoughts from './MyThoughts';
import { articlesData } from '../articleData';

interface ClassicAppProps {
  sanityPosts: SanityArticleItem[];
  sanityLoaded: boolean;
}

const ClassicApp: React.FC<ClassicAppProps> = ({ sanityPosts, sanityLoaded }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [currency, setCurrency] = useState<Currency>(() => {
    const saved = localStorage.getItem('cc_currency');
    return (saved as Currency) || Currency.INR;
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('cc_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeCategory, setActiveCategory] = useState<Category>(Category.TOP);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc'>('default');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  useEffect(() => {
    localStorage.setItem('cc_currency', currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem('cc_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const goHome = () => {
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goContact = () => {
    navigate('/contact');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goWhyUs = () => {
    navigate('/why-us');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goPay = () => {
    navigate('/pay');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goQuickOrder = (packageName?: string) => {
    if (packageName) {
      navigate(`/book?package=${encodeURIComponent(packageName)}`);
    } else {
      navigate('/book');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProductSelect = (product: Product) => {
    navigate(`/services/${slugify(product.name)}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToTestimonials = () => {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        document.getElementById('testimonials')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } else {
      document.getElementById('testimonials')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToEssays = () => {
    navigate('/blog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToFAQs = () => {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } else {
      document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const onCategoryClick = (cat: Category) => {
    setActiveCategory(cat);
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        document.getElementById('shop-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } else {
      document.getElementById('shop-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const ServiceDetailWrapper: React.FC = () => {
    const { slug } = useParams<{ slug?: string }>();
    const product = PRODUCTS.find((p) => slugify(p.name) === slug);

    if (!product) {
      return (
        <div className="py-24 text-center">
          <h2 className="font-serif text-3xl text-indigo-950 font-semibold mb-6">
            Service Not Found
          </h2>
          <button onClick={goHome} className="text-[#7c6d5e] underline font-medium">
            Go Home
          </button>
        </div>
      );
    }

    return (
      <>
        <MetaTags
          title={`${product.name} | Professional Vedic Astrology Reading`}
          description={product.shortDescription}
          canonicalUrl={`https://www.cosmiccouncil.pro/services/${slug}`}
          noIndex
        />
        <ProductDetail
          product={product}
          currency={currency}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          onBack={goHome}
        />
      </>
    );
  };

  const EssayDetailWrapper: React.FC = () => {
    const { slug } = useParams<{ slug?: string }>();
    const staticArticle = articlesData.find((art) => slugify(art.title) === slug);
    const sanityArticle = !staticArticle
      ? sanityPosts.find((p) => p.slug === slug)
      : undefined;
    const article = staticArticle || sanityArticle;

    if (!article && !sanityLoaded) {
      return (
        <div className="py-24 text-center">
          <p className="font-serif text-xl text-indigo-950/70">Loading essay...</p>
        </div>
      );
    }

    if (!article) {
      return (
        <div className="py-24 text-center">
          <h2 className="font-serif text-3xl text-indigo-950 font-semibold mb-6">
            Article Not Found
          </h2>
          <button onClick={goHome} className="text-[#7c6d5e] underline font-medium">
            Go Home
          </button>
        </div>
      );
    }

    return (
      <>
        <MetaTags
          title={`${article.title} | Vedic Astrology Blog`}
          description={article.description}
          canonicalUrl={`https://www.cosmiccouncil.pro/blog/${slug}`}
          ogType="article"
          noIndex
        />
        <MyThoughts onBookReading={() => goQuickOrder()} sanityPosts={sanityPosts} />
      </>
    );
  };

  const NavigateToBlogSlug: React.FC = () => {
    const { slug } = useParams<{ slug?: string }>();
    return <Navigate to={`/blog/${slug}`} replace />;
  };

  const classicHomepage = (
    <>
      <MetaTags
        title="CosmicCouncil - Vedic Astrology Consultations"
        description="Multi-system cross-verified Vedic astrology written consultations."
        canonicalUrl="https://www.cosmiccouncil.pro/"
        noIndex
      />
      <Hero
        onLearnMore={goWhyUs}
        onPlaceOrder={() => goQuickOrder()}
        onAllProducts={() => onCategoryClick(Category.ALL)}
        currency={currency}
      />

      <TrustMethodology />
      <ReadingMethodology onBookReading={() => goQuickOrder()} />
      <MultiSystemAnalysis onGetStarted={() => goQuickOrder()} />
      <PatternsOverPredictions />
      <WhyWritten />

      <Shop
        currency={currency}
        setCurrency={setCurrency}
        onSelectProduct={handleProductSelect}
        favorites={favorites}
        toggleFavorite={toggleFavorite}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        showOnlyFavorites={showOnlyFavorites}
        setShowOnlyFavorites={setShowOnlyFavorites}
      />

      <div className="max-w-7xl mx-auto px-6 mb-20 animate-fade-in">
        <div className="p-8 bg-[#E8E2D9] rounded-[2.5rem] border border-[#D9D1C5] shadow-lg text-center">
          <p className="text-indigo-950/80 text-sm font-light leading-relaxed max-w-2xl mx-auto">
            All analyses and predictions are conducted using{' '}
            <span className="text-soft-gold font-semibold">Vedic Astrology systems</span>.
            Consultations are provided{' '}
            <span className="text-indigo-950 font-semibold underline underline-offset-4 decoration-indigo-950/30">
              exclusively via email
            </span>
            .
          </p>
        </div>
      </div>

      <div id="my-thoughts-section">
        <MyThoughts onBookReading={() => goQuickOrder()} sanityPosts={sanityPosts} />
      </div>
      <FAQSection />
      <DisclaimerCTA onBookConsultation={() => goQuickOrder()} />
      <Testimonials onBookReading={() => goQuickOrder()} />
      <QuickContact />
    </>
  );

  return (
    <div className="flex flex-col min-h-screen selection:bg-indigo-100">
      <Header
        currency={currency}
        setCurrency={setCurrency}
        onLogoClick={goHome}
        onCategoryClick={onCategoryClick}
        onContactClick={goContact}
        onTestimonialsClick={scrollToTestimonials}
        onWhyUsClick={goWhyUs}
        onPayClick={goPay}
        onQuickOrderClick={goQuickOrder}
        onMyEssaysClick={scrollToEssays}
        onFAQsClick={scrollToFAQs}
      />

      <main className="flex-grow">
        <Routes>
          <Route path="/" element={classicHomepage} />
          <Route path="/legacy" element={<Navigate to="/" replace />} />
          <Route path="/written-consultations" element={<Navigate to="/" replace />} />
          <Route
            path="/why-us"
            element={
              <>
                <MetaTags
                  title="Why Choose Cosmic Council PRO | Accurate Vedic Astrology Methodology"
                  description="Understand why written consultations are far superior to live Zoom calls."
                  canonicalUrl="https://www.cosmiccouncil.pro/why-us"
                  noIndex
                />
                <WhyUs
                  onBack={goHome}
                  onAllProducts={() => onCategoryClick(Category.ALL)}
                  onPlaceOrder={goQuickOrder}
                  currency={currency}
                />
              </>
            }
          />
          <Route
            path="/contact"
            element={
              <>
                <MetaTags
                  title="Contact Cosmic Council PRO"
                  description="Submit your query or reach out directly."
                  canonicalUrl="https://www.cosmiccouncil.pro/contact"
                  noIndex
                />
                <ContactForm onBack={goHome} />
              </>
            }
          />
          <Route
            path="/pay"
            element={
              <>
                <MetaTags
                  title="Secure Custom Payments | Cosmic Council PRO"
                  description="Make custom payments securely for chart analysis."
                  canonicalUrl="https://www.cosmiccouncil.pro/pay"
                  noIndex
                />
                <QuickPayment onBack={goHome} />
              </>
            }
          />
          <Route
            path="/book"
            element={
              <>
                <MetaTags
                  title="Book Your Vedic Astrology Reading | Cosmic Council PRO"
                  description="Select your package and enter your birth details."
                  canonicalUrl="https://www.cosmiccouncil.pro/book"
                  noIndex
                />
                <QuickOrder
                  onBack={goHome}
                  currency={currency}
                  setCurrency={setCurrency}
                  initialPackageName={searchParams.get('package') || undefined}
                />
              </>
            }
          />
          <Route
            path="/blog"
            element={
              <>
                <MetaTags
                  title="Vedic Astrology Blog, Insights & Essays | Cosmic Council PRO"
                  description="Read our latest Vedic astrology blog posts and expert insights."
                  canonicalUrl="https://www.cosmiccouncil.pro/blog"
                  noIndex
                />
                <MyThoughts onBookReading={() => goQuickOrder()} sanityPosts={sanityPosts} />
              </>
            }
          />
          <Route path="/blog/:slug" element={<EssayDetailWrapper />} />
          <Route path="/essays" element={<Navigate to="/blog" replace />} />
          <Route path="/essays/:slug" element={<NavigateToBlogSlug />} />
          <Route path="/services/:slug" element={<ServiceDetailWrapper />} />
        </Routes>
      </main>

      <Footer
        onCategoryClick={onCategoryClick}
        onHomeClick={goHome}
        onTestimonialsClick={scrollToTestimonials}
        onContactClick={goContact}
        onWhyUsClick={goWhyUs}
        onPayClick={goPay}
        onQuickOrderClick={goQuickOrder}
        onMyEssaysClick={scrollToEssays}
        onFAQsClick={scrollToFAQs}
        currency={currency}
      />

      {location.pathname !== '/' && (
        <button
          onClick={() => navigate(-1)}
          className="fixed bottom-6 left-6 z-[250] bg-white/95 hover:bg-white text-indigo-950/80 hover:text-indigo-950 backdrop-blur-md border border-indigo-100 shadow-lg rounded-full px-4 py-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-all duration-300 scale-95 hover:scale-100"
          id="floating-back-btn"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
          >
            <path d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      )}
    </div>
  );
};

export default ClassicApp;
