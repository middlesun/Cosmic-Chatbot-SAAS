import React, { useState } from 'react';

interface Layer {
  title: string;
  subtitle: string;
  description: string;
  items: string[];
}

interface ReadingMethodologyProps {
  onBookReading?: () => void;
}

const ReadingMethodology: React.FC<ReadingMethodologyProps> = ({ onBookReading }) => {
  const [activeLayer, setActiveLayer] = useState<number>(0);

  const layers: Layer[] = [
    {
      title: "Layer 01: Foundational Structural Promise",
      subtitle: "Verifying the latent capacity in the chart",
      description: "I begin by analyzing the fundamental architecture of your sky. This acts as the baseline capacity constraint for any major life event (career, marriage, children, wealth).",
      items: [
        "Birth Chart (D1) - the structural foundation of the chart",
        "Relevant Divisional Charts (D9 Navamsha, D10 Dashamsha, D7 Saptamsha, D30, D60, and others where applicable)",
        "Planetary dignity, Shadbala (six-fold strength) and Bhava Bala (house strength)"
      ]
    },
    {
      title: "Layer 02: Karmic Blueprints & Behavioral Dynamics",
      subtitle: "Detecting subconscious scripts and patterns",
      description: "Once capacity is established, I map the psychological and karmic scripts that govern how you act on your chart's capacity.",
      items: [
        "Yogas, Doshas, and repeating karmic patterns",
        "Nakshatras (lunar mansions) and detailed Pada analysis",
        "Chara Karakas and key Jaimini astrology principles"
      ]
    },
    {
      title: "Layer 03: Multi-System Cross-Verification",
      subtitle: "Confirming patterns across independent mathematical lenses",
      description: "I run your chart through multiple independent frameworks. If a pattern shows up in Parashari but is rejected by KP or Nadi, I discard or weaken the conclusion.",
      items: [
        "Ashtakavarga strength, contribution, and bindu distribution",
        "KP Astrology (Krishnamurti Paddhati) for sub-lord level precision and confirmation",
        "Siddha Nadi principles for recurring ancestral karmas and time-bound triggers"
      ]
    },
    {
      title: "Layer 04: Dynamic Timing & Event Synthesis",
      subtitle: "Determining precisely when potential translates to experience",
      description: "Finally, I overlay time. I search for periods where the planetary dasha periods, current transits, and KP indicators converge on a single timing window.",
      items: [
        "Active Dasha, Bhukti, and Antar-Dasha cycles",
        "Current and upcoming major planetary transits (Gochar)",
        "Timing windows derived by synthesizing Dashas, Transits, and KP techniques"
      ]
    }
  ];

  return (
    <section className="bg-[#FAF9F6] py-16 md:py-24 border-t border-[#7c6d5e]/10">
      <div className="max-w-6xl mx-auto px-6">
        
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="font-serif text-3xl md:text-5xl font-semibold text-slate-900 tracking-tight leading-tight">
            How Every Reading Is Done
          </h2>
          <p className="text-slate-600 font-light text-base md:text-lg leading-relaxed">
            "No important prediction is based on a single indicator. Every major conclusion is tested across multiple independent techniques before it becomes part of my final assessment."
          </p>
        </div>

        {/* Diagnostic Funnel Diagram / Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left: The Visual Funnel */}
          <div className="lg:col-span-5 space-y-3">
            {layers.map((layer, index) => {
              const isActive = activeLayer === index;
              return (
                <div 
                  key={index}
                  onClick={() => setActiveLayer(index)}
                  className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer text-left relative overflow-hidden flex items-center justify-between ${
                    isActive 
                      ? 'bg-[#FAF9F6] border-[#7c6d5e]/20 shadow-md scale-[1.02] translate-x-1' 
                      : 'bg-slate-50/50 hover:bg-slate-50 border-slate-100 opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isActive && (
                      <span className="text-[#C5A059] text-base animate-pulse">✦</span>
                    )}
                    <div>
                      <p className={`text-[10px] uppercase font-mono font-bold tracking-wider ${isActive ? 'text-[#7c6d5e]' : 'text-slate-400'}`}>
                        Layer 0{index + 1}
                      </p>
                      <h4 className={`font-serif text-base md:text-lg font-bold mt-1 ${isActive ? 'text-indigo-950' : 'text-slate-600 font-medium'}`}>
                        {layer.title.split(': ')[1]}
                      </h4>
                    </div>
                  </div>
                  <svg className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'text-[#7c6d5e]' : 'text-slate-300 rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              );
            })}

            {/* Funnel convergence indicator */}
            <div className="pt-4 flex items-center justify-center">
              <div className="w-full h-px bg-dashed bg-slate-200 flex items-center justify-center relative">
                <span className="bg-[#FAF9F6] px-4 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </span>
              </div>
            </div>
          </div>

          {/* Right: Detailed Layer Display */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-8 md:p-12 border border-indigo-50 shadow-sm min-h-[420px] flex flex-col justify-between">
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-mono font-bold text-indigo-600 uppercase tracking-widest">
                  {layers[activeLayer].title}
                </p>
                <h3 className="font-serif text-2xl md:text-3xl font-semibold text-slate-900 leading-tight">
                  {layers[activeLayer].subtitle}
                </h3>
                <p className="text-slate-500 font-light text-sm md:text-base leading-relaxed">
                  {layers[activeLayer].description}
                </p>
              </div>

              <div className="h-px bg-slate-100" />

              <div className="space-y-4">
                <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Analysis Includes:</p>
                <ul className="space-y-3">
                  {layers[activeLayer].items.map((item, idx) => (
                    <li key={idx} className="flex gap-3 items-start text-sm text-slate-600">
                      <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-50 text-xs text-slate-400 italic">
              *Each analytical layer either strengthens, weakens, confirms or rejects previous observations until only the strongest, most stable conclusions remain.
            </div>
          </div>

        </div>

        {onBookReading && (
          <div className="mt-16 text-center animate-fade-in">
            <button 
              onClick={onBookReading}
              className="inline-flex items-center gap-2 px-12 py-4 bg-[#10B981] hover:bg-[#059669] text-white rounded-full text-lg font-bold shadow-xl transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
            >
              Book your Reading
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

export default ReadingMethodology;
