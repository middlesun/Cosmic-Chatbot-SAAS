import React from 'react';
import { Category, Currency } from '../types';

interface FooterProps {
  onCategoryClick: (cat: Category) => void;
  onHomeClick: () => void;
  onTestimonialsClick: () => void;
  onContactClick: () => void;
  onWhyUsClick: () => void;
  onPayClick: () => void;
  onQuickOrderClick: () => void;
  onMyEssaysClick: () => void;
  onFAQsClick: () => void;
  currency: Currency;
}

const Footer: React.FC<FooterProps> = ({ onCategoryClick, onHomeClick, onTestimonialsClick, onContactClick, onWhyUsClick, onPayClick, onQuickOrderClick, onMyEssaysClick, onFAQsClick, currency }) => {
  const getCurrencyIcon = () => {
    if (currency === Currency.USD) return '$';
    if (currency === Currency.EUR) return '€';
    return '₹';
  };

  const btnClass = "w-full py-4 px-4 bg-[#7c6d5e] text-[#fdfce9] rounded-xl font-bold tracking-widest uppercase shadow-sm transition-silky hover:brightness-110 active:scale-[0.98] text-[10px] flex items-center justify-center gap-3";
  
  return (
    <footer className="relative bg-[#E8E2D9] border-t border-indigo-50/50 px-6 py-20 overflow-hidden">
      <div className="absolute -bottom-20 -left-20 w-80 h-80 border border-soft-gold/5 rounded-full pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-wrap lg:flex-nowrap gap-12">
          {/* Col 1: Logo & Desc - 40% */}
          <div className="w-full lg:w-[40%] space-y-8">
            <div className="flex items-center gap-2">
              <img 
                src="https://www.cosmiccouncil.pro/logo.png" 
                alt="CosmicCouncil PRO" 
                className="h-10 w-auto cursor-pointer object-contain" 
                onClick={onHomeClick} 
                style={{ imageRendering: '-webkit-optimize-contrast', transform: 'translateZ(0)' }}
              />
            </div>
            <p className="text-slate-600 text-xl md:text-2xl font-light leading-relaxed">
              I use a multi-system cross-verified approach, combining Parashari, Jaimini, KP, and Siddha Nadi techniques providing a highly accurate, dependable, authentic prediction framework that can be relied on.
            </p>
          </div>

          {/* Other 4 columns - 20% each */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
            <div className="space-y-6">
              <h4 className="font-serif text-2xl text-indigo-950 font-medium tracking-tight">Packages</h4>
              <ul className="space-y-4 text-xl text-slate-500 font-light">
                <li onClick={() => onCategoryClick(Category.TOP)} className="hover:text-indigo-900 transition-silky cursor-pointer flex items-center gap-2">Top</li>
                <li onClick={() => onCategoryClick(Category.CONSULTATIONS)} className="hover:text-indigo-900 transition-silky cursor-pointer flex items-center gap-2">Consultations</li>
                <li onClick={() => onCategoryClick(Category.LOVE)} className="hover:text-indigo-900 transition-silky cursor-pointer flex items-center gap-2">Love</li>
                <li onClick={() => onCategoryClick(Category.MARRIAGE)} className="hover:text-indigo-900 transition-silky cursor-pointer flex items-center gap-2">Marriage</li>
              </ul>
            </div>

            <div className="space-y-6 lg:mt-12">
              <ul className="space-y-4 text-xl text-slate-500 font-light">
                <li onClick={() => onCategoryClick(Category.CAREER)} className="hover:text-indigo-900 transition-silky cursor-pointer flex items-center gap-2">Career</li>
                <li onClick={() => onCategoryClick(Category.FINANCE)} className="hover:text-indigo-900 transition-silky cursor-pointer flex items-center gap-2">Finance</li>
                <li onClick={() => onCategoryClick(Category.HEALTH)} className="hover:text-indigo-900 transition-silky cursor-pointer flex items-center gap-2">Health</li>
                <li onClick={() => onCategoryClick(Category.ALL)} className="hover:text-indigo-900 transition-silky cursor-pointer flex items-center gap-2">All Packages</li>
              </ul>
            </div>

            <div className="space-y-6">
              <h4 className="font-serif text-2xl text-indigo-950 font-medium tracking-tight">About</h4>
              <ul className="space-y-4 text-xl text-slate-500 font-light">
                <li onClick={onHomeClick} className="hover:text-indigo-900 transition-silky cursor-pointer flex items-center gap-2">Home</li>
                <li onClick={onWhyUsClick} className="hover:text-indigo-900 transition-silky cursor-pointer flex items-center gap-2">Why Me</li>
                <li onClick={onTestimonialsClick} className="hover:text-indigo-900 transition-silky cursor-pointer flex items-center gap-2">Testimonials</li>
                <li onClick={onMyEssaysClick} className="hover:text-indigo-900 transition-silky cursor-pointer flex items-center gap-2">Blog</li>
                <li onClick={onFAQsClick} className="hover:text-indigo-900 transition-silky cursor-pointer flex items-center gap-2">FAQs</li>
                <li onClick={onContactClick} className="hover:text-indigo-900 transition-silky cursor-pointer flex items-center gap-2">Contact</li>
              </ul>
            </div>

            <div className="space-y-6">
              <div className="flex flex-col gap-3">
                <button onClick={onQuickOrderClick} className={btnClass}>
                  <span className="text-lg opacity-80">{getCurrencyIcon()}</span>
                  ORDER
                </button>
                <button onClick={onPayClick} className={btnClass}>
                  <span className="text-lg opacity-80">{getCurrencyIcon()}</span>
                  PAYMENT
                </button>
                <button onClick={onContactClick} className={btnClass}>
                  <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  CONTACT
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-20 pt-8 border-t border-indigo-950/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400 font-medium tracking-wider uppercase">
          <p>© {new Date().getFullYear()} CosmicCouncil.pro - All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-indigo-900 transition-colors">Privacy</a>
            <a href="#" className="hover:text-indigo-900 transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;