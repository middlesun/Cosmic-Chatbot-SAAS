import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Currency, Category } from '../types';

interface HeaderProps {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  onLogoClick: () => void;
  onCategoryClick: (c: Category) => void;
  onContactClick: () => void;
  onTestimonialsClick: () => void;
  onWhyUsClick: () => void;
  onPayClick: () => void;
  onQuickOrderClick: () => void;
  onMyEssaysClick: () => void;
  onFAQsClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ currency, setCurrency, onLogoClick, onCategoryClick, onContactClick, onTestimonialsClick, onWhyUsClick, onPayClick, onQuickOrderClick, onMyEssaysClick, onFAQsClick }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showGoTop, setShowGoTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowGoTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const getCurrencyIcon = () => {
    if (currency === Currency.USD) return '$';
    if (currency === Currency.EUR) return '€';
    return '₹';
  };

  return (
    <>
      <header className="sticky top-0 z-[100] bg-white/80 backdrop-blur-xl border-b border-indigo-50 px-4 md:px-6 py-4 flex items-center justify-between">
        <div 
          className="flex items-center gap-1 md:gap-2 cursor-pointer group"
          onClick={onLogoClick}
        >
          <img 
            src="https://www.cosmiccouncil.pro/logo.png" 
            alt="CosmicCouncil PRO" 
            className="h-8 md:h-10 w-auto object-contain" 
            style={{ imageRendering: '-webkit-optimize-contrast', transform: 'translateZ(0)' }}
          />
        </div>

        <nav className="hidden lg:flex items-center gap-x-6 xl:gap-x-8">
          <button onClick={onLogoClick} className="font-sans text-[15px] xl:text-[16px] font-semibold tracking-wide text-indigo-950/80 hover:text-indigo-950 transition-colors duration-300 relative py-1">
            Home
          </button>
          <button onClick={onMyEssaysClick} className="font-sans text-[15px] xl:text-[16px] font-semibold tracking-wide text-indigo-950/80 hover:text-indigo-950 transition-colors duration-300 relative py-1">
            Blog
          </button>
          <button onClick={onWhyUsClick} className="font-sans text-[15px] xl:text-[16px] font-semibold tracking-wide text-indigo-950/80 hover:text-indigo-950 transition-colors duration-300 relative py-1">
            Why Me
          </button>
          <button onClick={onTestimonialsClick} className="font-sans text-[15px] xl:text-[16px] font-semibold tracking-wide text-indigo-950/80 hover:text-indigo-950 transition-colors duration-300 relative py-1">
            Testimonials
          </button>
          <button onClick={onFAQsClick} className="font-sans text-[15px] xl:text-[16px] font-semibold tracking-wide text-indigo-950/80 hover:text-indigo-950 transition-colors duration-300 relative py-1">
            FAQs
          </button>
          <button onClick={() => onCategoryClick(Category.ALL)} className="font-sans text-[15px] xl:text-[16px] font-semibold tracking-wide text-indigo-950/80 hover:text-indigo-950 transition-colors duration-300 relative py-1">
            Packages
          </button>
          <button onClick={onPayClick} className="font-sans text-[15px] xl:text-[16px] font-semibold tracking-wide text-indigo-950/80 hover:text-indigo-950 transition-colors duration-300 relative py-1">
            Pay here
          </button>
          <button 
            onClick={onContactClick} 
            className="px-5 py-2 btn-gradient-indigo text-white rounded-full font-sans text-[14px] xl:text-[15px] font-bold tracking-wide transition-all duration-300 whitespace-nowrap shadow-md hover:shadow-lg hover:brightness-110 active:scale-95"
          >
            Contact
          </button>
          <button 
            onClick={onQuickOrderClick} 
            className="px-5 py-2 btn-gradient-emerald text-white rounded-full font-sans text-[14px] xl:text-[15px] font-bold tracking-wide transition-all duration-300 ml-2 whitespace-nowrap shadow-md hover:shadow-lg hover:brightness-110 active:scale-95"
          >
            Book reading
          </button>
          <Link
            to="/app/login"
            className="px-4 py-2 rounded-full border border-indigo-950/20 text-indigo-950 hover:bg-indigo-950 hover:text-white font-sans text-[13px] xl:text-[14px] font-semibold tracking-wide transition-all duration-300 whitespace-nowrap"
          >
            Login
          </Link>
        </nav>

        <div className="flex items-center gap-2 md:gap-6">
          <div className="flex bg-indigo-50/50 p-1 rounded-full border border-indigo-100">
            {Object.values(Currency).map(c => (
              <button 
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-2 md:px-3 py-1 rounded-full text-[9px] md:text-[10px] font-bold tracking-wider transition-silky ${currency === c ? 'bg-white text-indigo-950 shadow-sm' : 'text-indigo-300 hover:text-indigo-500'}`}
              >
                {c}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-indigo-900 focus:outline-none p-1 group z-[120] relative scale-90 md:scale-100"
          >
            <div className="space-y-1.5">
              <div className={`h-0.5 bg-indigo-900 transition-all duration-300 ${isMenuOpen ? 'w-6 rotate-45 translate-y-2' : 'w-6'}`}></div>
              <div className={`h-0.5 bg-indigo-900 transition-all duration-300 ${isMenuOpen ? 'opacity-0' : 'w-4 ml-auto'}`}></div>
              <div className={`h-0.5 bg-indigo-900 transition-all duration-300 ${isMenuOpen ? 'w-6 -rotate-45 -translate-y-2' : 'w-6 ml-auto'}`}></div>
            </div>
          </button>
        </div>
      </header>

      {/* Sliding Sidebar Menu */}
      <div 
        className={`fixed inset-0 bg-indigo-950/40 backdrop-blur-sm z-[110] transition-opacity duration-700 ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsMenuOpen(false)}
      >
        <div 
          className={`absolute right-0 top-0 h-full w-4/5 md:w-[450px] bg-[#F7F3EF] shadow-2xl transition-transform duration-700 cubic-bezier(0.2, 0.8, 0.2, 1) overflow-hidden flex flex-col ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute top-0 right-0 w-full h-full opacity-5 pointer-events-none">
            <svg width="100%" height="100%" className="fill-soft-gold">
              <circle cx="10%" cy="10%" r="100" fill="none" stroke="currentColor" strokeWidth="1"/>
              <circle cx="90%" cy="50%" r="150" fill="none" stroke="currentColor" strokeWidth="1"/>
              <circle cx="20%" cy="80%" r="80" fill="none" stroke="currentColor" strokeWidth="1"/>
            </svg>
          </div>

          <div className="relative p-6 md:p-8 flex flex-col h-full overflow-y-auto no-scrollbar">
            {/* 1. Logo at Top of Sidebar */}
            <div className="mb-12 flex justify-start">
              <img 
                src="https://www.cosmiccouncil.pro/logo.png" 
                alt="CosmicCouncil PRO" 
                className="h-10 w-auto object-contain"
                style={{ imageRendering: '-webkit-optimize-contrast', transform: 'translateZ(0)' }}
              />
            </div>

            {/* 2. Main Links List */}
            <div className="flex flex-col gap-y-5 mb-12">
              <a href="#" onClick={(e) => { e.preventDefault(); onLogoClick(); setIsMenuOpen(false); }} className="font-serif text-xl md:text-3xl text-indigo-950 hover:text-soft-gold transition-silky">Home</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onWhyUsClick(); setIsMenuOpen(false); }} className="font-serif text-xl md:text-3xl text-indigo-950 hover:text-soft-gold transition-silky">Why Me</a>
              <a href="#testimonials" onClick={(e) => { e.preventDefault(); onTestimonialsClick(); setIsMenuOpen(false); }} className="font-serif text-xl md:text-3xl text-indigo-950 hover:text-soft-gold transition-silky">Testimonials</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onMyEssaysClick(); setIsMenuOpen(false); }} className="font-serif text-xl md:text-3xl text-indigo-950 hover:text-soft-gold transition-silky">Blog</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onFAQsClick(); setIsMenuOpen(false); }} className="font-serif text-xl md:text-3xl text-indigo-950 hover:text-soft-gold transition-silky">FAQs</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onContactClick(); setIsMenuOpen(false); }} className="font-serif text-xl md:text-3xl text-indigo-950 hover:text-soft-gold transition-silky">Contact</a>
              <Link to="/app/login" onClick={() => setIsMenuOpen(false)} className="font-serif text-xl md:text-3xl text-indigo-950 hover:text-soft-gold transition-silky">Login</Link>
            </div>

            {/* 3. Shop Section */}
            <div className="space-y-6 pt-6 border-t border-indigo-100">
               <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-indigo-300">Shop</p>
               <div className="grid grid-cols-2 gap-y-6 gap-x-2">
                  {[
                    { cat: Category.TOP, label: "Top Packages" },
                    { cat: Category.CONSULTATIONS, label: "Consultations" },
                    { cat: Category.LOVE, label: "Love" },
                    { cat: Category.MARRIAGE, label: "Marriage" },
                    { cat: Category.CAREER, label: "Career" },
                    { cat: Category.FINANCE, label: "Finance" },
                    { cat: Category.HEALTH, label: "Health" },
                    { cat: Category.ALL, label: "All Packages" }
                  ].map((item) => (
                    <a 
                      key={item.cat} 
                      href="#shop-section" 
                      onClick={(e) => { 
                        e.preventDefault();
                        onCategoryClick(item.cat);
                        setIsMenuOpen(false); 
                      }} 
                      className="text-base md:text-2xl font-light text-slate-600 hover:text-indigo-950 transition-silky flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-soft-gold/30"></span>
                      {item.label}
                    </a>
                  ))}
               </div>
            </div>

            {/* 4. Bottom Buttons */}
            <div className="mt-auto pt-10 border-t border-indigo-900/5 grid grid-cols-2 gap-3">
              <button 
                onClick={() => { onQuickOrderClick(); setIsMenuOpen(false); }} 
                className="py-4 px-4 rounded-xl font-bold tracking-widest text-[#fdfce9] bg-[#7c6d5e] shadow-sm transition-silky hover:brightness-110 active:scale-[0.98] text-[8px] md:text-[11px] flex items-center justify-center gap-2 uppercase"
              >
                <span className="text-sm md:text-lg opacity-80">{getCurrencyIcon()}</span>
                QUICK ORDER
              </button>
              <button 
                onClick={() => { onPayClick(); setIsMenuOpen(false); }} 
                className="py-4 px-4 rounded-xl font-bold tracking-widest text-[#fdfce9] bg-[#7c6d5e] shadow-sm transition-silky hover:brightness-110 active:scale-[0.98] text-[8px] md:text-[11px] flex items-center justify-center gap-2 uppercase"
              >
                <span className="text-sm md:text-lg opacity-80">{getCurrencyIcon()}</span>
                QUICK PAYMENT
              </button>
            </div>
            <p className="mt-4 text-[9px] text-slate-400 italic leading-relaxed text-center">Secure protocol established. All consultations are confidential.</p>
          </div>
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-3">
        <button 
          onClick={scrollToTop}
          title="Jump to Top"
          className={`w-14 h-14 bg-indigo-950 text-white rounded-full shadow-2xl transition-all duration-700 transform hover:scale-110 active:scale-95 flex items-center justify-center ${showGoTop ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>
        </button>
        <button 
          onClick={scrollToBottom}
          title="Jump to Bottom"
          className={`w-14 h-14 bg-indigo-950 text-white rounded-full shadow-2xl transition-all duration-700 transform hover:scale-110 active:scale-95 flex items-center justify-center ${showGoTop ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
        </button>
      </div>
    </>
  );
};

export default Header;