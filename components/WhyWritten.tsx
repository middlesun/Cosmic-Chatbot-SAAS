import React from 'react';

const WhyWritten: React.FC = () => {
  return (
    <section className="bg-white py-24 md:py-32 border-t border-[#7c6d5e]/10">
      <div className="max-w-6xl mx-auto px-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-start">
          
          {/* Left Column: Thesis & Callout */}
          <div className="lg:col-span-5 space-y-10 lg:sticky lg:top-24">
            <div className="space-y-4">
              <span className="text-[#7c6d5e] uppercase tracking-widest text-xs font-semibold font-mono">a Deliberate Choice</span>
              <h2 className="font-serif text-3xl md:text-5xl font-medium text-indigo-950 tracking-tight leading-tight">
                Why Written Consultations?
              </h2>
              <p className="text-slate-600 font-light text-base md:text-lg leading-relaxed">
                I intentionally deliver all my readings as comprehensive, structured written reports rather than live phone calls. This is a deliberate design choice built to maximize the depth, accuracy, and lasting value of your consultation.
              </p>
            </div>

            <div className="p-8 bg-indigo-950 text-indigo-100 rounded-3xl border border-indigo-900 shadow-lg space-y-3">
              <h4 className="font-serif font-semibold text-white text-base md:text-lg">Synthesis Takes Time</h4>
              <p className="text-xs md:text-sm leading-relaxed font-light">
                Many crucial, repeating insights only reveal themselves after spending considerable time synthesizing the intersecting layers of a chart - which is mathematically impossible in a live, real-time consultation.
              </p>
            </div>
          </div>

          {/* Right Column: Premium Document-Styled Notes */}
          <div className="lg:col-span-7 space-y-10 border-t border-[#7c6d5e]/10 lg:border-t-0 pt-10 lg:pt-0">
            
            <div className="border-b border-[#7c6d5e]/10 pb-8 space-y-3">
              <div className="text-[#7c6d5e] font-serif font-bold text-sm">01 / Uncompromised Time & Care</div>
              <p className="text-slate-600 text-sm md:text-base leading-relaxed font-light">
                A spontaneous live call or voice note restricts analysis to real-time improvisation. A written report allows me to think through various aspects more deeply, to refine my analysis, choose the right words carefully to describe my observations
              </p>
            </div>

            <div className="border-b border-[#7c6d5e]/10 pb-8 space-y-3">
              <div className="text-[#7c6d5e] font-serif font-bold text-sm">02 / Systematic Cross-Verification</div>
              <p className="text-slate-600 text-sm md:text-base leading-relaxed font-light">
                Rather than jumping to immediate, intuitive conclusions, I like to refine my readings by cross-verifying various attributes patiently before putting pen to paper.
              </p>
            </div>

            <div className="border-b border-[#7c6d5e]/10 pb-8 space-y-3">
              <div className="text-[#7c6d5e] font-serif font-bold text-sm">03 / Distraction-Free Focus</div>
              <p className="text-slate-600 text-sm md:text-base leading-relaxed font-light">
                Without the conversational white noise, small talk, or immediate feedback loops of a live call, my analytical focus remains 100% on the structural reality of your chart.
              </p>
            </div>

            <div className="border-b border-[#7c6d5e]/10 pb-8 space-y-3">
              <div className="text-[#7c6d5e] font-serif font-bold text-sm">04 / Detailed explanation</div>
              <p className="text-slate-600 text-sm md:text-base leading-relaxed font-light">
                In written consultation, you just don't get what is on top of my head - I've the freedom to share all the underlying observations that were made during the analysis for you to get the deepest possible understanding of your situation.
              </p>
            </div>

            <div className="pb-8 space-y-3">
              <div className="text-[#7c6d5e] font-serif font-bold text-sm">05 / Lifetime Reference Document</div>
              <p className="text-slate-600 text-sm md:text-base leading-relaxed font-light">
                Even though a recorded call or a voice note seem to be easier to listen to, but a written document is far easier to navigate around, read specific parts more deeply, highlight and annotate for life long use.
              </p>
            </div>

          </div>

        </div>

        {/* Closing Quote */}
        <div className="mt-20 p-8 bg-[#FAF9F6] border border-[#7c6d5e]/15 rounded-3xl text-center max-w-4xl mx-auto">
          <p className="font-serif text-base md:text-lg text-indigo-950 font-light leading-relaxed max-w-3xl mx-auto italic">
            "I believe thoughtful analysis deserves thoughtful delivery. A carefully written consultation allows me to spend more time understanding your chart - and gives you guidance that remains valuable long after you've finished reading it."
          </p>
        </div>

      </div>
    </section>
  );
};

export default WhyWritten;
