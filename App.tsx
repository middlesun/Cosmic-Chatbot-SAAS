import React, { useEffect, useState } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { Category, Currency, Product } from './types';
import MetaTags from './components/MetaTags';
import type { SanityArticleItem } from './lib/sanity';
import AppRoutes from './components/app/AppRoutes';
import NewLandingPage from './components/NewLandingPage';
import BlogPage from './components/BlogPage';
import ComingSoonPage from './components/ComingSoonPage';

const NavigateToBlogSlug: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  return <Navigate to={slug ? `/blog/${slug}` : '/blog'} replace />;
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [siteUnlocked, setSiteUnlocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('cc_coming_soon_unlocked') === 'true';
    } catch {
      return false;
    }
  });

  const handleUnlockSite = () => {
    try {
      localStorage.setItem('cc_coming_soon_unlocked', 'true');
    } catch {
      // Ignore storage errors
    }
    setSiteUnlocked(true);
  };

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
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
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
      const target = hasError ? '/app/login' : '/app/home';
      return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
    }
  }

  if (!siteUnlocked) {
    return <ComingSoonPage onUnlock={handleUnlockSite} />;
  }

  if (location.pathname.startsWith('/app')) {
    return (
      <Routes>
        <Route path="/app/*" element={<AppRoutes />} />
      </Routes>
    );
  }

  const scrollToLandingSection = (id: string) => {
    if (location.pathname !== '/') {
      navigate('/');
      window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 250);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectProduct = (_product: Product) => {
    navigate('/app/login');
  };

  const homeMetaTags = (
    <MetaTags
      title="CosmicCouncil - Your personal AI astrologer"
      description="Get highly accurate, multi-system cross-verified Vedic astrology consultations. Rely on precise chart predictions combining Parashari, Jaimini, KP, and Nadi methodologies."
      canonicalUrl="https://www.cosmiccouncil.pro/"
      schemaData={{
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': 'https://www.cosmiccouncil.pro/#organization',
            name: 'Cosmic Council PRO',
            url: 'https://www.cosmiccouncil.pro/',
            logo: {
              '@type': 'ImageObject',
              url: 'https://www.cosmiccouncil.pro/logo.png',
              caption: 'Cosmic Council PRO',
            },
          },
          {
            '@type': 'WebSite',
            '@id': 'https://www.cosmiccouncil.pro/#website',
            url: 'https://www.cosmiccouncil.pro/',
            name: 'Cosmic Council PRO',
            publisher: {
              '@id': 'https://www.cosmiccouncil.pro/#organization',
            },
          },
        ],
      }}
    />
  );

  return (
    <Routes>
      <Route
        path="/"
        element={
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
              onSelectProduct={handleSelectProduct}
              onQuickOrder={() => scrollToLandingSection('shop-section')}
              onWhyUs={() => scrollToLandingSection('methodology-section')}
              onContact={() => scrollToLandingSection('contact-section')}
              onPay={() => navigate('/app/login')}
            />
          </>
        }
      />
      <Route
        path="/blog"
        element={<BlogPage sanityPosts={sanityPosts} sanityLoaded={sanityLoaded} />}
      />
      <Route
        path="/blog/:slug"
        element={<BlogPage sanityPosts={sanityPosts} sanityLoaded={sanityLoaded} />}
      />
      <Route path="/essays" element={<Navigate to="/blog" replace />} />
      <Route path="/essays/:slug" element={<NavigateToBlogSlug />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
