import React from 'react';

const TrustMethodology: React.FC = () => {
  return (
    <section className="bg-white py-24 md:py-32 border-y border-[#7c6d5e]/15">
      <div className="max-w-6xl mx-auto px-6">
        
        {/* Two-Column Essay / Comparison Spread */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          
          {/* Left Column: Common Shortcomings (Editorial Essay Style) */}
          <div className="space-y-10">
            <div className="border-b border-slate-200 pb-6">
              <h3 className="font-serif text-2xl md:text-3xl font-medium text-slate-900 leading-tight">
                Most Astrology Today Suffers From Three Problems
              </h3>
            </div>
            
            <div className="space-y-8">
              <div className="space-y-2">
                <h4 className="font-serif text-lg font-semibold text-slate-900">
                  01. Surface-Level Indicators
                </h4>
                <p className="text-slate-600 text-sm md:text-base leading-relaxed font-light">
                  Making wide predictions based only on obvious zodiac signs or single planetary placements. This standard practice completely ignores the vital, layered calculations of divisional charts where actual capacity is mapped.
                </p>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-serif text-lg font-semibold text-slate-900">
                  02. Purely Textbook Knowledge
                </h4>
                <p className="text-slate-600 text-sm md:text-base leading-relaxed font-light">
                  Regurgitating generic textbook sentences instead of conducting personalized synthesis. True astrology requires translating ancient guidelines to match your unique modern environment, background, and specific lifestyle.
                </p>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-serif text-lg font-semibold text-slate-900">
                  03. Single-System Over-Reliance
                </h4>
                <p className="text-slate-600 text-sm md:text-base leading-relaxed font-light">
                  Basing critical life decisions on a single system or placement. Without the analytical safety of multi-system cross-verification, isolated observations lead to false timing or skewed interpretations.
                </p>
              </div>
            </div>
          </div>
          
          {/* Right Column: My Philosophy (Premium Document Style) */}
          <div className="bg-[#FAF9F6] rounded-3xl p-8 md:p-12 border border-[#7c6d5e]/15 relative overflow-hidden space-y-10">
            <div className="space-y-3">
              <span className="text-[#7c6d5e] uppercase tracking-widest text-xs font-bold font-mono">My Commitment</span>
              <h3 className="font-serif text-3xl md:text-4xl font-medium text-indigo-950 leading-tight">
                I approach it differently..
              </h3>
            </div>
            
            <div className="space-y-6 text-slate-700 text-sm md:text-base leading-relaxed font-light">
              <p>
                Every consultation begins by <span className="text-[#7c6d5e] font-semibold underline underline-offset-4 decoration-[#7c6d5e]/30">validating the structural promise</span> of your chart. If the foundational configuration doesn't support an event, I do not promise it.
              </p>
              <p>
                Every important conclusion is <span className="text-[#7c6d5e] font-semibold underline underline-offset-4 decoration-[#7c6d5e]/30">cross-verified using multiple independent systems</span> before I formulate any final event timeline.
              </p>
              
              <p>
                Astrology is not a system of flattering illusions. It is a tool for diagnostic reality, empowering you to navigate transitions with clarity and strategy.
              </p>
            </div>
          </div>

        </div>


      </div>
    </section>
  );
};

export default TrustMethodology;
