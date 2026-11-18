import React from 'react';

const PatternsOverPredictions: React.FC = () => {
  return (
    <section className="bg-white py-24 md:py-32 border-t border-[#7c6d5e]/10">
      <div className="max-w-6xl mx-auto px-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-start">
          
          {/* Left Column: Editorial Statement (Oversized & Clean) */}
          <div className="lg:col-span-5 space-y-8 text-left lg:sticky lg:top-24">
            <span className="text-[#7c6d5e] uppercase tracking-widest text-xs font-semibold font-mono">My Philosophy</span>
            <h2 className="font-serif text-4xl md:text-6xl font-medium text-indigo-950 tracking-tight leading-[1.1]">
              Patterns Over Predictions
            </h2>
            <p className="text-slate-600 font-light text-base md:text-lg leading-relaxed">
              Astrology is most powerful when it acts as a compass, not a crystal ball. My consultations are not built around dramatic, sensational forecasts. Instead, they aim to identify the deeper, underlying structures that shape your reality.
            </p>
            <p className="text-slate-500 font-light text-sm md:text-base leading-relaxed">
              When you understand the recurring currents in your life, you stop reacting blindly and start acting with strategic perspective.
            </p>
          </div>

          {/* Right Column: Premium Text-Driven Timeline/List (No cards or icons) */}
          <div className="lg:col-span-7 space-y-12 border-l border-[#7c6d5e]/10 pl-8 md:pl-12">
            
            <div className="space-y-4">
              <span className="font-serif text-lg font-semibold text-[#7c6d5e] block">01 / Recurring Life Cycles</span>
              <p className="text-slate-600 text-sm md:text-base leading-relaxed font-light">
                Identifying repeating themes and experiences that keep showing up in your career, relationships, or health.
              </p>
            </div>

            <div className="space-y-4">
              <span className="font-serif text-lg font-semibold text-[#7c6d5e] block">02 / Relationship Dynamics</span>
              <p className="text-slate-600 text-sm md:text-base leading-relaxed font-light">
                Unveiling core emotional needs, recurring attraction patterns, and deep-seated behavioral blocks.
              </p>
            </div>

            <div className="space-y-4">
              <span className="font-serif text-lg font-semibold text-[#7c6d5e] block">03 / Decision-Making Cycles</span>
              <p className="text-slate-600 text-sm md:text-base leading-relaxed font-light">
                Spotting subconscious habits and cycles that govern your risk assessments and critical choices.
              </p>
            </div>

            <div className="space-y-4">
              <span className="font-serif text-lg font-semibold text-[#7c6d5e] block">04 / Karmic Tendencies</span>
              <p className="text-slate-600 text-sm md:text-base leading-relaxed font-light">
                Diagnosing long-term structural strengths, repeating challenges, and heavy ancestral themes.
              </p>
            </div>

            <div className="space-y-4">
              <span className="font-serif text-lg font-semibold text-[#7c6d5e] block">05 / Favourable & Pressured Phases</span>
              <p className="text-slate-600 text-sm md:text-base leading-relaxed font-light">
                Mapping high-tide phases for growth and expansion, and low-tide phases demanding consolidation and patience.
              </p>
            </div>

            <div className="space-y-4">
              <span className="font-serif text-lg font-semibold text-[#7c6d5e] block">06 / Growth Timing Patterns</span>
              <p className="text-slate-600 text-sm md:text-base leading-relaxed font-light">
                Pinpointing exact dynamic windows for career progression, relocation, or relational transitions.
              </p>
            </div>

          </div>

        </div>

        {/* Editorial Quote Box */}
        <div className="mt-24 p-10 border-y border-[#7c6d5e]/15 text-center max-w-4xl mx-auto">
          <p className="font-serif text-xl md:text-2xl leading-relaxed text-[#5a4e42] font-semibold italic">
            "The goal isn't simply to predict the future. It's to help you understand the patterns shaping your life, recognise what is within your control, and make better-informed decisions as your circumstances evolve."
          </p>
        </div>

      </div>
    </section>
  );
};

export default PatternsOverPredictions;
