import React, { useMemo, useState } from 'react';
import { TESTIMONIALS } from '../constants';

interface TestimonialsProps {
  onBookReading?: () => void;
}

const Testimonials: React.FC<TestimonialsProps> = ({ onBookReading }) => {
  const [visibleCount, setVisibleCount] = useState(6);

  const shuffledTestimonials = useMemo(() => {
    return [...TESTIMONIALS].sort(() => Math.random() - 0.5);
  }, []);

  const visibleTestimonials = useMemo(() => {
    return shuffledTestimonials.slice(0, visibleCount);
  }, [shuffledTestimonials, visibleCount]);

  const hasMore = visibleCount < shuffledTestimonials.length;

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 6);
  };

  const renderQuote = (text: string) => {
    const parts = text.split(/(\(.*?\)-bold)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('(') && part.endsWith(')-bold')) {
        const content = part.substring(1, part.length - 6);
        return <strong key={idx} className="font-semibold text-indigo-950 italic">{content}</strong>;
      }
      return part;
    });
  };

  return (
    <section id="testimonials" className="px-6 py-24 bg-white/40 backdrop-blur-sm border-y border-indigo-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 animate-slide-up-fade">
          <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-indigo-400 mb-4">See what others are saying</p>
          <h2 className="font-serif text-4xl md:text-6xl text-indigo-950 font-semibold mb-8">Real Testimonials</h2>
          <div className="w-24 h-0.5 bg-indigo-950 mx-auto"></div>
        </div>

        {/* Masonry-style Layout */}
        <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8 [column-fill:_balance]">
          {visibleTestimonials.map((t, idx) => (
            <div 
              key={idx} 
              className="break-inside-avoid inline-block w-full p-10 rounded-[2.5rem] bg-white/80 backdrop-blur-md border border-indigo-100/30 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-silky animate-slide-up-fade"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <div className="flex gap-1 text-soft-gold mb-6">
                 {[...Array(5)].map((_, i) => (
                   <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                 ))}
              </div>
              <p className="text-slate-600 font-light italic leading-relaxed mb-8 text-lg">"{renderQuote(t.quote)}"</p>
              <div className="flex items-center gap-4 border-t border-indigo-900/5 pt-6">
                <div className="w-10 h-10 rounded-full bg-indigo-50/50 border border-indigo-100 flex items-center justify-center text-indigo-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-serif text-lg text-indigo-950 font-semibold">{t.name}</h4>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-indigo-300">{t.area}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {hasMore && (
          <div className="text-center mt-16 animate-fade-in">
            <button 
              onClick={handleLoadMore} 
              className="px-10 py-4 border-2 border-indigo-200 hover:border-indigo-950 text-indigo-900 hover:bg-indigo-50 rounded-full font-bold transition-all duration-300 uppercase tracking-widest text-xs"
            >
              Load more testimonials
            </button>
          </div>
        )}

        {onBookReading && (
          <div className="mt-16 text-center animate-fade-in">
            <button 
              onClick={onBookReading}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#7c6d5e] border-b border-[#7c6d5e]/30 pb-1 hover:border-[#7c6d5e] transition-colors cursor-pointer group"
            >
              Ready to understand your own chart? Book Your Reading
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
        )}

      </div>
    </section>
  );
};

export default Testimonials;