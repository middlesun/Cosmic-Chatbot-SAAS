import React, { useMemo } from 'react';
import { Currency, Product, Category } from '../types';
import { PRODUCTS } from '../constants';
import ProductCard from './ProductCard';

interface ShopProps {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  onSelectProduct: (p: Product) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  activeCategory: Category;
  setActiveCategory: (cat: Category) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: 'default' | 'price-asc' | 'price-desc';
  setSortBy: (sort: 'default' | 'price-asc' | 'price-desc') => void;
  showOnlyFavorites: boolean;
  setShowOnlyFavorites: (show: boolean) => void;
}

const Shop: React.FC<ShopProps> = ({ 
  currency, setCurrency, onSelectProduct, favorites, toggleFavorite,
  activeCategory, setActiveCategory,
  searchQuery, setSearchQuery,
  sortBy, setSortBy,
  showOnlyFavorites, setShowOnlyFavorites
}) => {
  const filteredProducts = useMemo(() => {
    let result = PRODUCTS.filter(p => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(q) || 
                           p.shortDescription.toLowerCase().includes(q) ||
                           p.id.toLowerCase().includes(q);
      
      const matchesCategory = searchQuery !== '' ? true : (
        activeCategory === Category.ALL || 
        (activeCategory === Category.TOP 
         ? ['2093', '3072', '4045'].includes(p.id) 
         : p.category === activeCategory)
      );

      const matchesFavorites = !showOnlyFavorites || favorites.includes(p.id);
      return matchesCategory && matchesSearch && matchesFavorites;
    });

    if (sortBy === 'price-asc') {
      result.sort((a, b) => a.priceINR - b.priceINR);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.priceINR - a.priceINR);
    }

    return result;
  }, [activeCategory, searchQuery, sortBy, favorites, showOnlyFavorites]);

  const categories = [Category.TOP, Category.CONSULTATIONS, Category.LOVE, Category.MARRIAGE, Category.CAREER, Category.FINANCE, Category.HEALTH, Category.ALL];

  const handlePriceSortCycle = () => {
    if (sortBy === 'default') setSortBy('price-asc');
    else if (sortBy === 'price-asc') setSortBy('price-desc');
    else setSortBy('default');
  };

  const getSortIcon = () => {
    if (sortBy === 'price-asc') {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
        </svg>
      );
    }
    if (sortBy === 'price-desc') {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  };

  const getActiveFilterStyle = (cat: Category) => {
    if (activeCategory !== cat) return 'bg-white/10 backdrop-blur-md border-white/10 text-indigo-100 hover:border-indigo-400 hover:text-white';
    
    switch(cat) {
      case Category.CONSULTATIONS: return 'bg-purple-600 border-purple-600 text-white shadow-xl scale-105';
      case Category.LOVE: return 'bg-pink-500 border-pink-500 text-white shadow-xl scale-105';
      case Category.MARRIAGE: return 'bg-rose-600 border-rose-600 text-white shadow-xl scale-105';
      case Category.CAREER: return 'bg-blue-600 border-blue-600 text-white shadow-xl scale-105';
      case Category.FINANCE: return 'bg-emerald-600 border-emerald-600 text-white shadow-xl scale-105';
      case Category.HEALTH: return 'bg-[#00cec9] border-[#00cec9] text-white shadow-xl scale-105';
      case Category.TOP: return 'bg-[#E8E2D9] border-[#D9D1C5] text-indigo-950 shadow-xl scale-105';
      default: return 'filter-active-gradient border-transparent text-white shadow-xl scale-105';
    }
  };

  return (
    <section id="shop-section" className="relative px-4 md:px-6 pb-24 pt-16 max-w-7xl mx-auto rounded-[3rem] overflow-hidden mt-4 mb-4 bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#1E1B4B] shadow-inner">
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23C5A059' fill-opacity='0.4' fill-rule='evenodd'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' /%3E%3C/g%3E%3C/svg%3E")` }}></div>

      {/* Editorial Heading & Introduction */}
      <div className="relative z-10 max-w-3xl mx-auto text-center mb-16 space-y-4">
        <h2 className="font-serif text-3xl md:text-5xl font-medium text-white tracking-tight leading-tight">
          Choose Your Consultation
        </h2>
      </div>

      <div className="relative z-10 flex flex-col gap-8 mb-12">
        <div className="space-y-6">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-4 px-2 -mx-2 -mt-4">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-semibold tracking-wide transition-silky border ${getActiveFilterStyle(cat)}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between animate-slide-up-fade">
            <div className="flex flex-nowrap w-full gap-2 items-center">
              <div className="relative flex-grow min-w-0">
                <input 
                  type="text" 
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-[56px] pl-10 pr-4 bg-white/10 backdrop-blur-md border-2 border-white/10 rounded-2xl text-sm text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/30 focus:border-indigo-400 transition-silky placeholder:text-indigo-300 shadow-sm"
                />
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <button 
                onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                className={`h-[56px] w-[56px] flex-shrink-0 rounded-2xl border-2 transition-silky shadow-sm flex items-center justify-center ${showOnlyFavorites ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white/10 backdrop-blur-md border-white/10 text-indigo-300 hover:text-rose-400'}`}
              >
                <svg className={`w-5 h-5 ${showOnlyFavorites ? 'fill-current' : 'fill-none'} stroke-current`} viewBox="0 0 24 24" strokeWidth="2">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </button>

              <button 
                onClick={handlePriceSortCycle}
                className={`h-[56px] w-[56px] flex-shrink-0 rounded-2xl border-2 transition-silky shadow-sm flex items-center justify-center ${sortBy !== 'default' ? 'bg-indigo-500 border-indigo-500 text-white shadow-md' : 'bg-white/10 backdrop-blur-md border-white/10 text-indigo-300 hover:text-white'}`}
                aria-label="Sort by price"
              >
                {getSortIcon()}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10">
        {filteredProducts.length > 0 ? (
          <div 
            key={activeCategory + searchQuery + sortBy + showOnlyFavorites}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {filteredProducts.map((p, idx) => (
              <ProductCard 
                key={p.id} 
                product={p} 
                currency={currency} 
                isFavorite={favorites.includes(p.id)}
                onToggleFavorite={() => toggleFavorite(p.id)}
                onClick={() => onSelectProduct(p)}
                delay={idx * 150}
              />
            ))}
          </div>
        ) : (
          <div className="py-24 text-center animate-fade-in">
            <p className="text-indigo-300 font-light italic">No consultations found matching your search.</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default Shop;