// Cosmic Council PRO - Blog, FAQ Section, Breadcrumbs and Structured JSON-LD Schema Update
import React, { useState, useEffect } from 'react';
import { Currency, Product, Category, slugify } from './types';
import Header from './components/Header';
import Hero from './components/Hero';
import Shop from './components/Shop';
import ProductDetail from './components/ProductDetail';
import Footer from './components/Footer';
import Testimonials from './components/Testimonials';
import ContactForm from './components/ContactForm';
import WhyUs from './components/WhyUs';
import QuickContact from './components/QuickContact';
import QuickPayment from './components/QuickPayment';
import QuickOrder from './components/QuickOrder';
import { PRODUCTS } from './constants';
import TrustMethodology from './components/TrustMethodology';
import ReadingMethodology from './components/ReadingMethodology';
import MultiSystemAnalysis from './components/MultiSystemAnalysis';
import PatternsOverPredictions from './components/PatternsOverPredictions';
import WhyWritten from './components/WhyWritten';
import MyThoughts from './components/MyThoughts';
import FAQSection from './components/FAQSection';
import DisclaimerCTA from './components/DisclaimerCTA';
import MetaTags from './components/MetaTags';
import { Routes, Route, useNavigate, useLocation, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { articlesData } from './components/articleData';
import type { SanityArticleItem } from './lib/sanity';
import AppRoutes from './components/app/AppRoutes';
import NewLandingPage from './components/NewLandingPage';

const App: React.FC = () => {
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
  const [sanityPosts, setSanityPosts] = useState<SanityArticleItem[]>([]);
  const [sanityLoaded, setSanityLoaded] = useState(false);

  useEffect(() => {
    if (location.pathname.startsWith('/app')) return;
    let cancelled = false;
    fetch('/api/blog/posts')
      .then((res) => (res.ok ? res.json() : { posts: [] }))
      .then((json: { posts?: SanityArticleItem[] }) => {
        if (!cancelled && Array.isArray(json.posts)) {
          setSanityPosts(json.posts);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSanityLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem('cc_currency', currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem('cc_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
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

  // Dedicated Wrapper for Service Detail Page Router
  const ServiceDetailWrapper: React.FC = () => {
    const { slug } = useParams<{ slug?: string }>();
    const product = PRODUCTS.find(p => slugify(p.name) === slug);
    
    if (!product) {
      return (
        <div className="py-24 text-center">
          <h2 className="font-serif text-3xl text-indigo-950 font-semibold mb-6">Service Not Found</h2>
          <button onClick={goHome} className="text-[#7c6d5e] underline font-medium">Go Home</button>
        </div>
      );
    }

    const getNumericPrice = (amountINR: number, curr: Currency): number => {
      if (curr === Currency.INR) return amountINR;
      const map: Record<number, { usd: number; eur: number }> = {
        0: { usd: 0, eur: 0 },
        799: { usd: 18, eur: 18 },
        999: { usd: 19, eur: 19 },
        1299: { usd: 25, eur: 29 },
        1999: { usd: 39, eur: 39 },
        3999: { usd: 69, eur: 64 },
        5999: { usd: 118, eur: 118 },
        19999: { usd: 378, eur: 398 }
      };
      if (map[amountINR]) {
        return curr === Currency.USD ? map[amountINR].usd : map[amountINR].eur;
      }
      const premium = amountINR * 1.3;
      const rawValue = curr === Currency.USD ? premium / 70 : premium / 65;
      const roundPsychologically = (val: number): number => {
        if (val <= 0) return 0;
        const ceil = Math.ceil(val);
        const last = ceil % 10;
        if (last <= 5) return Math.floor(ceil / 10) * 10 + 5;
        return Math.floor(ceil / 10) * 10 + 9;
      };
      return roundPsychologically(rawValue);
    };

    const price = getNumericPrice(product.priceINR, currency);
    const currencyStr = currency === Currency.USD ? "USD" : currency === Currency.EUR ? "EUR" : "INR";

    const productSchema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Product",
          "@id": `https://www.cosmiccouncil.pro/services/${slug}#product`,
          "name": product.name,
          "description": product.shortDescription,
          "image": "https://www.cosmiccouncil.pro/logo.png",
          "offers": {
            "@type": "Offer",
            "price": price,
            "priceCurrency": currencyStr,
            "availability": "https://schema.org/InStock",
            "url": `https://www.cosmiccouncil.pro/services/${slug}`
          }
        },
        {
          "@type": "BreadcrumbList",
          "@id": `https://www.cosmiccouncil.pro/services/${slug}#breadcrumb`,
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "https://www.cosmiccouncil.pro/"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "Services",
              "item": "https://www.cosmiccouncil.pro/#shop-section"
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": product.name,
              "item": `https://www.cosmiccouncil.pro/services/${slug}`
            }
          ]
        }
      ]
    };

    return (
      <>
        <MetaTags 
          title={`${product.name} | Professional Vedic Astrology Reading`}
          description={product.shortDescription}
          canonicalUrl={`https://www.cosmiccouncil.pro/services/${slug}`}
          schemaData={productSchema}
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

  // Dedicated Wrapper for Blog Detail Page Router
  const EssayDetailWrapper: React.FC = () => {
    const { slug } = useParams<{ slug?: string }>();
    const staticArticle = articlesData.find(art => slugify(art.title) === slug);
    const sanityArticle = !staticArticle ? sanityPosts.find(p => p.slug === slug) : undefined;
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
          <h2 className="font-serif text-3xl text-indigo-950 font-semibold mb-6">Article Not Found</h2>
          <button onClick={goHome} className="text-[#7c6d5e] underline font-medium">Go Home</button>
        </div>
      );
    }

    const articleSchema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BlogPosting",
          "@id": `https://www.cosmiccouncil.pro/blog/${slug}#article`,
          "headline": article.title,
          "description": article.description,
          "datePublished": sanityArticle?.publishedAt || "2026-07-14",
          "author": {
            "@type": "Person",
            "name": "Cosmic Council PRO Astrologer"
          },
          "publisher": {
            "@id": "https://www.cosmiccouncil.pro/#organization"
          },
          "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": `https://www.cosmiccouncil.pro/blog/${slug}`
          }
        },
        {
          "@type": "BreadcrumbList",
          "@id": `https://www.cosmiccouncil.pro/blog/${slug}#breadcrumb`,
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "https://www.cosmiccouncil.pro/"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "Blog",
              "item": "https://www.cosmiccouncil.pro/blog"
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": article.title,
              "item": `https://www.cosmiccouncil.pro/blog/${slug}`
            }
          ]
        }
      ]
    };

    return (
      <>
        <MetaTags 
          title={`${article.title} | Vedic Astrology Blog`}
          description={article.description}
          canonicalUrl={`https://www.cosmiccouncil.pro/blog/${slug}`}
          ogType="article"
          schemaData={articleSchema}
        />
        <MyThoughts onBookReading={() => goQuickOrder()} sanityPosts={sanityPosts} />
      </>
    );
  };

  const NavigateToBlogSlug: React.FC = () => {
    const { slug } = useParams<{ slug?: string }>();
    return <Navigate to={`/blog/${slug}`} replace />;
  };

  if (!location.pathname.startsWith('/app')) {
    const hasOAuthHash =
      location.hash.includes('access_token=') ||
      location.hash.includes('refresh_token=') ||
      location.hash.includes('error_description=');
    const searchObj = new URLSearchParams(location.search);
    const hasAuthCode = searchObj.has('code') || searchObj.has('error_description');

    if (hasOAuthHash || hasAuthCode) {
      const hasError =
        location.hash.includes('error=') ||
        location.hash.includes('error_description=') ||
        searchObj.has('error') ||
        searchObj.has('error_description');
      const target = hasError ? '/app/login' : '/app/chat';
      return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
    }
  }

  if (location.pathname.startsWith('/app')) {
    return (
      <Routes>
        <Route path="/app/*" element={<AppRoutes />} />
      </Routes>
    );
  }

  const homeMetaTags = (
    <MetaTags 
      title="CosmicCouncil - Your personal AI astrologer"
      description="Get highly accurate, multi-system cross-verified Vedic astrology consultations. Rely on precise chart predictions combining Parashari, Jaimini, KP, and Nadi methodologies."
      canonicalUrl="https://www.cosmiccouncil.pro/"
      schemaData={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": "https://www.cosmiccouncil.pro/#organization",
            "name": "Cosmic Council PRO",
            "url": "https://www.cosmiccouncil.pro/",
            "logo": {
              "@type": "ImageObject",
              "url": "https://www.cosmiccouncil.pro/logo.png",
              "caption": "Cosmic Council PRO"
            }
          },
          {
            "@type": "LocalBusiness",
            "@id": "https://www.cosmiccouncil.pro/#localbusiness",
            "name": "Cosmic Council PRO",
            "image": "https://www.cosmiccouncil.pro/logo.png",
            "url": "https://www.cosmiccouncil.pro/",
            "priceRange": "$$",
            "address": {
              "@type": "PostalAddress",
              "addressCountry": "IN"
            }
          },
          {
            "@type": "WebSite",
            "@id": "https://www.cosmiccouncil.pro/#website",
            "url": "https://www.cosmiccouncil.pro/",
            "name": "Cosmic Council PRO",
            "publisher": {
              "@id": "https://www.cosmiccouncil.pro/#organization"
            }
          },
          {
            "@type": "FAQPage",
            "@id": "https://www.cosmiccouncil.pro/#faq",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "What astrological systems do you use?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "I use a disciplined multi-system cross-verified approach. Every consultation combines Parashari Jyotish, Jaimini Jyotish, KP Astrology, and Siddha Nadi principles."
                }
              },
              {
                "@type": "Question",
                "name": "Why are your consultations delivered as written reports instead of live calls?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "A written report is a deliberate choice for uncompromised accuracy. Live calls require real-time improvisation, whereas a written consultation allows me to spend 3-5 hours carefully analyzing and cross-verifying natal and divisional charts."
                }
              },
              {
                "@type": "Question",
                "name": "How long does it take to receive my written consultation?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Written consultations are typically delivered directly to your email address within 7-10 business Days of receiving your confirmed order and exact birth details."
                }
              }
            ]
          }
        ]
      }}
    />
  );

  if (location.pathname === '/') {
    return (
      <>
        {homeMetaTags}
        <NewLandingPage
          currency={currency}
          setCurrency={setCurrency}
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
          sanityPosts={sanityPosts}
          onSelectProduct={handleProductSelect}
          onQuickOrder={goQuickOrder}
          onWhyUs={goWhyUs}
          onContact={goContact}
          onPay={goPay}
        />
      </>
    );
  }

  const archivedLegacyHomepage = (
    <>
      {homeMetaTags}
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
            All analyses and predictions are conducted using <span className="text-soft-gold font-semibold">Vedic Astrology systems</span>. Consultations are provided <span className="text-indigo-950 font-semibold underline underline-offset-4 decoration-indigo-950/30">exclusively via email</span>.
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
          <Route path="/legacy" element={archivedLegacyHomepage} />
          <Route path="/written-consultations" element={<Navigate to="/legacy" replace />} />

          <Route path="/why-us" element={
            <>
              <MetaTags 
                title="Why Choose Cosmic Council PRO | Accurate Vedic Astrology Methodology"
                description="Understand why written consultations are far superior to live Zoom calls. Learn about my multi-system approach, focus on structural promises, and patterns over predictions."
                canonicalUrl="https://www.cosmiccouncil.pro/why-us"
                schemaData={{
                  "@context": "https://schema.org",
                  "@type": "BreadcrumbList",
                  "itemListElement": [
                    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.cosmiccouncil.pro/" },
                    { "@type": "ListItem", "position": 2, "name": "Why Me", "item": "https://www.cosmiccouncil.pro/why-us" }
                  ]
                }}
              />
              <WhyUs 
                onBack={goHome} 
                onAllProducts={() => onCategoryClick(Category.ALL)} 
                onPlaceOrder={goQuickOrder} 
                currency={currency} 
              />
            </>
          } />

          <Route path="/contact" element={
            <>
              <MetaTags 
                title="Contact Cosmic Council PRO | Get in Touch with a Professional Astrologer"
                description="Submit your query, questions, or reach out directly. Confidential and dedicated support for all your Vedic astrology consultations."
                canonicalUrl="https://www.cosmiccouncil.pro/contact"
                schemaData={{
                  "@context": "https://schema.org",
                  "@type": "BreadcrumbList",
                  "itemListElement": [
                    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.cosmiccouncil.pro/" },
                    { "@type": "ListItem", "position": 2, "name": "Contact", "item": "https://www.cosmiccouncil.pro/contact" }
                  ]
                }}
              />
              <ContactForm onBack={goHome} />
            </>
          } />

          <Route path="/pay" element={
            <>
              <MetaTags 
                title="Secure Custom Payments | Cosmic Council PRO"
                description="Make custom payments securely for custom chart analysis and specialized Vedic astrology readings. Multi-currency and safe options available."
                canonicalUrl="https://www.cosmiccouncil.pro/pay"
                schemaData={{
                  "@context": "https://schema.org",
                  "@type": "BreadcrumbList",
                  "itemListElement": [
                    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.cosmiccouncil.pro/" },
                    { "@type": "ListItem", "position": 2, "name": "Quick Payment", "item": "https://www.cosmiccouncil.pro/pay" }
                  ]
                }}
              />
              <QuickPayment onBack={goHome} />
            </>
          } />

          <Route path="/book" element={
            <>
              <MetaTags 
                title="Book Your Vedic Astrology Reading | Cosmic Council PRO"
                description="Select your package and enter your birth details to receive a comprehensive, deeply-researched written astrology report."
                canonicalUrl="https://www.cosmiccouncil.pro/book"
                schemaData={{
                  "@context": "https://schema.org",
                  "@type": "BreadcrumbList",
                  "itemListElement": [
                    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.cosmiccouncil.pro/" },
                    { "@type": "ListItem", "position": 2, "name": "Book Reading", "item": "https://www.cosmiccouncil.pro/book" }
                  ]
                }}
              />
              <QuickOrder 
                onBack={goHome} 
                currency={currency} 
                setCurrency={setCurrency} 
                initialPackageName={searchParams.get('package') || undefined} 
              />
            </>
          } />

          <Route path="/blog" element={
            <>
              <MetaTags 
                title="Vedic Astrology Blog, Insights & Essays | Cosmic Council PRO"
                description="Read our latest Vedic astrology blog posts, expert insights, compatibility analysis techniques, and predictive indicators by Cosmic Council PRO."
                canonicalUrl="https://www.cosmiccouncil.pro/blog"
                schemaData={{
                  "@context": "https://schema.org",
                  "@graph": [
                    {
                      "@type": "CollectionPage",
                      "@id": "https://www.cosmiccouncil.pro/blog#webpage",
                      "url": "https://www.cosmiccouncil.pro/blog",
                      "name": "Vedic Astrology Blog, Insights & Essays | Cosmic Council PRO",
                      "description": "Read our latest Vedic astrology blog posts, expert insights, compatibility analysis techniques, and predictive indicators by Cosmic Council PRO."
                    },
                    {
                      "@type": "BreadcrumbList",
                      "@id": "https://www.cosmiccouncil.pro/blog#breadcrumb",
                      "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.cosmiccouncil.pro/" },
                        { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://www.cosmiccouncil.pro/blog" }
                      ]
                    }
                  ]
                }}
              />
              <MyThoughts onBookReading={() => goQuickOrder()} sanityPosts={sanityPosts} />
            </>
          } />

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
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M15 19l-7-7 7-7"/></svg>
          Back
        </button>
      )}
    </div>
  );
};

export default App;
