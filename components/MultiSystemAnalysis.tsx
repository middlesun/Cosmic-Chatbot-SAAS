import React from 'react';

interface MultiSystemAnalysisProps {
  onGetStarted?: () => void;
}

const MultiSystemAnalysis: React.FC<MultiSystemAnalysisProps> = ({ onGetStarted }) => {
  return (
    <section className="bg-white py-24 md:py-32 border-t border-[#7c6d5e]/10">
      <div className="max-w-6xl mx-auto px-6">
        
        {/* Editorial Header */}
        <div className="max-w-3xl mx-auto text-center mb-20 space-y-4">
          <h2 className="font-serif text-3xl md:text-5xl font-medium text-indigo-950 tracking-tight leading-tight">
            Multi-System Cross-Verified Analysis
          </h2>
          <p className="text-slate-600 font-light text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
            I do not restrict my analysis to a single school of thought. Every system is selected because it solves a different part of the puzzle, providing a robust web of converging evidence.
          </p>
        </div>

        {/* Horizontal Three-Step Process */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Card 1: Parashari Jyotish */}
          <div className="bg-[#FAF9F6] border border-[#7c6d5e]/15 rounded-2xl p-8 md:p-10 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <span className="text-[10px] font-mono font-bold tracking-widest text-[#7c6d5e] uppercase">01 / Primary Layer</span>
              <h3 className="font-serif text-2xl font-bold text-slate-900 leading-tight">Parashari Jyotish</h3>
              <p className="text-slate-600 text-sm leading-relaxed font-light">
                The structural foundation of the analysis. Used to analyze major themes, planetary alignments, yogas, doshas, and the raw potential within the chart.
              </p>
            </div>
          </div>

          {/* Card 2: Jaimini Jyotish */}
          <div className="bg-[#FAF9F6] border border-[#7c6d5e]/15 rounded-2xl p-8 md:p-10 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <span className="text-[10px] font-mono font-bold tracking-widest text-[#7c6d5e] uppercase">02 / Verification Layer</span>
              <h3 className="font-serif text-2xl font-bold text-slate-900 leading-tight">Jaimini Jyotish</h3>
              <p className="text-slate-600 text-sm leading-relaxed font-light">
                Acts as an independent verifier. By analyzing Chara Karakas, destiny triggers, and major cycles from a completely separate perspective, I can cross-check Parashari's findings.
              </p>
            </div>
          </div>

          {/* Card 3: KP Astrology */}
          <div className="bg-[#FAF9F6] border border-[#7c6d5e]/15 rounded-2xl p-8 md:p-10 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <span className="text-[10px] font-mono font-bold tracking-widest text-[#7c6d5e] uppercase">03 / Timing Precision</span>
              <h3 className="font-serif text-2xl font-bold text-slate-900 leading-tight">KP Astrology</h3>
              <p className="text-slate-600 text-sm leading-relaxed font-light">
                Used for exact timelines and event confirmation. Provides sub-lord level accuracy that allows me to narrow down timing windows with mathematical reliability.
              </p>
            </div>
          </div>
        </div>

        {/* Quote Block */}
        <div className="mt-20 p-8 md:p-14 bg-indigo-950 text-white rounded-3xl border border-indigo-900 shadow-xl text-center max-w-4xl mx-auto relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/5 rounded-full blur-2xl pointer-events-none" />
          <p className="font-serif text-lg md:text-xl leading-relaxed text-indigo-100 max-w-3xl mx-auto font-light">
            "Every prediction is independently verified across multiple classical and modern Vedic astrology systems - including Parashari, Jaimini, KP, Nadi, divisional charts, Dashas, transits, Ashtakavarga, and planetary strength analysis - so your reading is based on converging evidence, not a single technique."
          </p>
        </div>

        {onGetStarted && (
          <div className="mt-16 text-center animate-fade-in">
            <button 
              onClick={onGetStarted}
              className="inline-flex items-center gap-2 px-12 py-4 bg-[#10B981] hover:bg-[#059669] text-white rounded-full text-lg font-bold shadow-xl transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
            >
              Get Started Here
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
        )}

      </div>
    </section>
  );
};

export default MultiSystemAnalysis;
