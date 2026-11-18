import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Product, Currency, Category } from '../types';
import OrderForm from './OrderForm';

interface ProductDetailProps {
  product: Product;
  currency: Currency;
  favorites?: string[];
  toggleFavorite?: (id: string) => void;
  onBack: () => void;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ product, currency, favorites = [], toggleFavorite, onBack }) => {
  const navigate = useNavigate();
  const isFavorite = favorites.includes(product.id);

  const getCategoryGradient = () => {
    switch (product.category) {
      case Category.CONSULTATIONS: return 'card-grad-consultation';
      case Category.LOVE: return 'card-grad-love';
      case Category.MARRIAGE: return 'card-grad-marriage';
      case Category.CAREER: return 'card-grad-career';
      case Category.FINANCE: return 'card-grad-wealth';
      case Category.HEALTH: return 'card-grad-health';
      default: return '';
    }
  };

  // Helper to render text with paragraphs and specific bold formatting
  const renderDescription = (text: string) => {
    return text.split('\n\n').map((paragraph, pIdx) => {
      // Handle the (text)-bold pattern
      const parts = paragraph.split(/(\(.*?\)-bold)/g);
      
      return (
        <p key={pIdx} className="mb-6 last:mb-0">
          {parts.map((part, idx) => {
            if (part.startsWith('(') && part.endsWith(')-bold')) {
              const content = part.substring(1, part.length - 6);
              return <strong key={idx} className="font-semibold text-indigo-950 italic">{content}</strong>;
            }
            return part;
          })}
        </p>
      );
    });
  };

  return (
    <div className={`min-h-screen transition-silky ${getCategoryGradient()} bg-opacity-30`}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs font-semibold text-[#7c6d5e]/70 uppercase tracking-widest mb-6">
          <span className="hover:text-indigo-950 cursor-pointer transition-colors" onClick={() => navigate('/')}>Home</span>
          <span>/</span>
          <span className="hover:text-indigo-950 cursor-pointer transition-colors" onClick={() => { navigate('/'); setTimeout(() => { document.getElementById('shop-section')?.scrollIntoView({ behavior: 'smooth' }); }, 300); }}>Services</span>
          <span>/</span>
          <span className="text-indigo-950 font-bold">{product.name}</span>
        </nav>

        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-indigo-400 hover:text-indigo-900 transition-silky mb-10 group animate-fade-in"
        >
          <svg className="w-5 h-5 group-hover:-translate-x-1.5 transition-silky" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-bold uppercase tracking-[0.2em]">Back</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Left: Sales Copy */}
          <div className="space-y-12 animate-slide-up-fade opacity-0">
            <div>
              <div className="flex items-center justify-between mb-8">
                <div className="inline-block px-5 py-2 rounded-full bg-white text-indigo-900 text-[10px] font-bold tracking-[0.2em] uppercase border border-indigo-100 shadow-sm">
                  {product.category}
                </div>
                {toggleFavorite && (
                   <button 
                    onClick={() => toggleFavorite(product.id)}
                    className={`p-3 rounded-full transition-silky active:scale-150 border ${isFavorite ? 'text-rose-500 bg-white border-rose-100 shadow-xl' : 'text-slate-300 bg-white border-slate-100 hover:border-rose-200 hover:text-rose-200'}`}
                  >
                    <svg className={`w-6 h-6 ${isFavorite ? 'fill-current' : 'fill-none'} stroke-current`} viewBox="0 0 24 24" strokeWidth="1.5">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </button>
                )}
              </div>
              
              <h1 className="font-serif text-5xl md:text-7xl text-indigo-950 font-semibold leading-[1.1] mb-10 tracking-tight">
                {product.name}
              </h1>

              {product.id === '1042' && (
                <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-[2rem] mb-10 shadow-sm animate-fade-in flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-indigo-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-red-600 font-bold italic text-sm leading-relaxed">
                    Note: Currently only available for students under 20 and special cases
                  </p>
                </div>
              )}

              <div className="text-xl md:text-2xl text-slate-600 font-light leading-relaxed max-w-xl">
                {renderDescription(product.longDescription)}
              </div>
            </div>

            <div className="space-y-8">
              <h3 className="font-serif text-3xl text-indigo-950 font-semibold">Key highlights</h3>
              <ul className="grid grid-cols-1 gap-5">
                {product.bullets?.map((bullet, idx) => (
                  <li 
                    key={idx} 
                    className="flex items-start gap-5 p-6 rounded-[2rem] bg-white bg-opacity-80 backdrop-blur-sm border border-indigo-50/50 shadow-sm animate-slide-up-fade opacity-0 hover:shadow-lg transition-silky"
                    style={{ animationDelay: `${300 + idx * 150}ms` }}
                  >
                    <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-1">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-slate-700 leading-relaxed font-light text-lg">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right: Order Form */}
          <div className="lg:sticky lg:top-32 self-start animate-slide-up-fade opacity-0" style={{ animationDelay: '400ms' }}>
            <OrderForm product={product} currency={currency} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;