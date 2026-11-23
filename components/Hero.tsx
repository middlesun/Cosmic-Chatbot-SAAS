import React from 'react';
import { Currency } from '../types';

interface HeroProps {
  onLearnMore: () => void;
  onPlaceOrder: () => void;
  onAllProducts: () => void;
  currency: Currency;
}

const Hero: React.FC<HeroProps> = ({ onLearnMore, onPlaceOrder, onAllProducts, currency }) => {
  return (
    <section className="relative px-6 pt-24 pb-16 md:pt-40 md:pb-24 text-center max-w-5xl mx-auto overflow-hidden">
      {/* Background celestial aesthetics */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] celestial-arc opacity-30 pointer-events-none animate-slide-up-fade" style={{ animationDelay: '0ms' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] celestial-arc opacity-15 pointer-events-none animate-slide-up-fade" style={{ animationDelay: '100ms' }}></div>

      <div className="relative z-10 flex flex-col items-center">
        {/* 1. Trust Indicator - Moved Above Headline */}
        <div className="mb-10 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-sky-50 border border-sky-100 backdrop-blur-sm text-sky-700 text-xs font-semibold tracking-wider uppercase animate-slide-up-fade opacity-0 shadow-sm" style={{ animationDelay: '200ms' }}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
          </span>
          3280 happy clients globally
        </div>

        {/* 2. Headline */}
        <h1 className="font-serif text-5xl md:text-8xl text-indigo-950 leading-[1.05] mb-12 font-medium tracking-tight max-w-4xl animate-slide-up-fade opacity-0" style={{ animationDelay: '300ms' }}>
          Astrology for Life's Most Critical Phases
        </h1>

        {/* 3. Short Explanation - Prominent Highlighted Card (Moved right under headline) */}
        <div className="max-w-4xl mx-auto mb-12 animate-slide-up-fade opacity-0 px-8 py-10 md:px-16 md:py-12 bg-[#FAF9F6] text-[#5a4e42] rounded-[2.5rem] shadow-sm border border-stone-300/80" style={{ animationDelay: '400ms' }}>
          <p className="text-base md:text-xl font-medium leading-relaxed">
            I use a multi-system cross-verified approach, combining Parashari, Jaimini, KP, and Siddha Nadi techniques providing a highly accurate, dependable, authentic prediction framework that has helped thousands of people
          </p>
        </div>

        {/* 4. Core Philosophy (Pull Quote) (Moved below short explanation) */}
        <div className="max-w-4xl mx-auto mb-12 animate-slide-up-fade opacity-0" style={{ animationDelay: '500ms' }}>
          <div className="relative py-4 px-6 md:px-12 border-y border-[#7c6d5e]/15">
            <p className="text-xl md:text-3xl text-[#7c6d5e] leading-relaxed tracking-wide" style={{ fontFamily: 'Roboto, sans-serif' }}>
              "No vague predictions. No false promises. Just an honest, grounded assessment of your situation."
            </p>
          </div>
        </div>

        {/* 5 & 6. Primary and Secondary CTAs */}
        <div className="flex flex-col items-center justify-center gap-5 w-full animate-slide-up-fade opacity-0" style={{ animationDelay: '600ms' }}>
          <button 
            onClick={onPlaceOrder} 
            className="w-full sm:w-auto px-16 py-5 bg-[#10B981] text-white hover:bg-[#FACC15] hover:text-[#1E1B4B] rounded-full text-lg font-bold shadow-xl transition-all duration-300 ease-out text-center cursor-pointer min-h-[60px] flex items-center justify-center"
          >
            Book Your Reading
          </button>
          
          <button 
            onClick={onLearnMore} 
            className="text-[#7c6d5e] hover:text-indigo-950 text-sm font-semibold tracking-widest uppercase underline underline-offset-4 decoration-[#7c6d5e]/25 hover:decoration-indigo-950/50 transition-all duration-300"
          >
            How it works
          </button>
        </div>
      </div>
    </section>
  );
};

export default Hero;