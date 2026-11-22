import React, { useState } from 'react';
import { Currency, Product, Category, formatCurrencyPrice } from '../../types';

interface ProductCardProps {
  product: Product;
  currency: Currency;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClick: () => void;
  delay?: number;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, currency, isFavorite, onToggleFavorite, onClick, delay = 0 }) => {
  const [copied, setCopied] = useState(false);

  const getFormattedPrice = () => {
    return formatCurrencyPrice(product.priceINR, currency);
  };

  const getDeliveryTime = () => {
    if (product.priceINR > 10000) return "10-15 days";
    return "7-10 days";
  };

  const getCategoryGradient = () => {
    switch (product.category) {
      case Category.CONSULTATIONS: return 'card-grad-consultation';
      case Category.LOVE: return 'card-grad-love';
      case Category.MARRIAGE: return 'card-grad-marriage';
      case Category.CAREER: return 'card-grad-career';
      case Category.FINANCE: return 'card-grad-wealth';
      case Category.HEALTH: return 'card-grad-health';
      default: return 'bg-white';
    }
  };

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(product.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className={`group relative rounded-[2rem] p-8 border border-indigo-50/50 shadow-sm hover:shadow-[0_30px_60px_-15px_rgba(26,28,46,0.08)] hover:-translate-y-2 active:scale-[0.98] transition-silky cursor-pointer flex flex-col h-full animate-slide-up-fade opacity-0 ${getCategoryGradient()}`}
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute top-8 right-8 z-10">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={`p-2.5 rounded-full transition-silky active:scale-150 ${isFavorite ? 'text-rose-500 scale-110 shadow-lg shadow-rose-100' : 'text-slate-200 hover:text-rose-200'}`}
        >
          <svg className={`w-6 h-6 ${isFavorite ? 'fill-current' : 'fill-none'} stroke-current`} viewBox="0 0 24 24" strokeWidth="1.5">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </button>
      </div>

      <div className="flex-grow">
        <div className="mb-4 flex items-center gap-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-300 font-bold">ID: {product.id}</p>
          <button 
            onClick={handleCopyId}
            className={`p-1 transition-colors ${copied ? 'text-emerald-500' : 'text-indigo-200 hover:text-indigo-400'}`}
            aria-label="Copy ID"
          >
            {copied ? (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
            )}
          </button>
        </div>
        
        <h3 className="font-serif text-2xl text-indigo-950 mb-4 font-semibold tracking-tight group-hover:text-indigo-700 transition-silky">
          {product.name}
        </h3>
        
        <p className={`text-lg leading-relaxed mb-6 font-light ${product.id === '1042' ? 'text-red-600' : 'text-slate-600'}`}>
          {product.id === '1042' ? "Currently only available for students under 20 and special cases" : product.shortDescription}
        </p>
      </div>

      <div className="mt-auto pt-8 border-t border-indigo-900/5">
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex items-center gap-2 text-indigo-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="text-xs font-medium">Delivered in {getDeliveryTime()}</span>
          </div>
          <p className="text-[9px] text-slate-400/80 italic">Report delivered to your email</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.2em] text-indigo-300 font-bold mb-1">Price</span>
            <span className="text-2xl font-semibold text-indigo-950">{getFormattedPrice()}</span>
          </div>
          
          <button className="px-7 py-3.5 btn-gradient-emerald text-white rounded-2xl text-sm font-bold tracking-wide hover:brightness-110 active:scale-95 transition-silky shadow-xl shadow-emerald-100">
            Book Your Reading
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;