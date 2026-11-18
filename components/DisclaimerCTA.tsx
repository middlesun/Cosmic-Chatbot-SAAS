import React from 'react';

interface DisclaimerCTAProps {
  onBookConsultation: () => void;
}

const DisclaimerCTA: React.FC<DisclaimerCTAProps> = ({ onBookConsultation }) => {
  return (
    <section className="bg-white py-24 md:py-32 border-t border-[#7c6d5e]/10">
      <div className="max-w-3xl mx-auto px-6">
        
        {/* Open Letter / Signed Statement style */}
        <div className="space-y-12 text-left mb-24">
          <div className="space-y-4 border-b border-[#7c6d5e]/15 pb-6">
            <h2 className="font-serif text-3xl md:text-4xl font-medium text-indigo-950 tracking-tight leading-tight">
              An Honest Statement on What I Cannot Promise
            </h2>
          </div>

          <div className="space-y-8 text-slate-700 text-sm md:text-base leading-relaxed font-light">
            <p>
              In a field often crowded with dramatic claims, I believe professional credibility starts with absolute transparency. It is vital to outline what this consultation cannot achieve for you:
            </p>
            
            <ul className="space-y-6 pl-4 border-l-2 border-[#7c6d5e]/20">
              <li>
                <strong className="font-serif text-[#5a4e42] font-semibold block mb-1">I do not fix real-world problems.</strong>
                An astrological perspective provides strategic clarity and highlights timing windows, but actual resolution requires your direct action, decisions, and agency in the physical world.
              </li>
              <li>
                <strong className="font-serif text-[#5a4e42] font-semibold block mb-1">I do not promise miraculous recoveries.</strong>
                I offer analysis of planetary indicators related to physical pressure and wellness, but this is never a substitute for professional medical diagnosis, treatment, or scientific healthcare.
              </li>
              <li>
                <strong className="font-serif text-[#5a4e42] font-semibold block mb-1">I do not guarantee absolute remedy outcomes.</strong>
                While aligning your lifestyle or implementing classical remedial recommendations supports personal focus, they are not magical switches to bypass life's natural learning phases or karmic cycles.
              </li>
              <li>
                <strong className="font-serif text-[#5a4e42] font-semibold block mb-1">I do not claim perfect mathematical certainty.</strong>
                Although my cross-verified methods provide exceptional historical accuracy, human choices, environmental factors, and free will are infinite. No responsible astrologer should promise 100% predictive certainty.
              </li>
            </ul>

            <p className="pt-4">
              Human life is an elegant dance between destiny's map and the choices we make. I choose to be completely honest about these realities so we can focus on building authentic strategic clarity for your situation.
            </p>
          </div>
        </div>

        {/* Visually Prominent Final CTA Section */}
        <div className="bg-[#1E1B4B] border border-indigo-900 rounded-3xl p-10 md:p-16 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-amber-400/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
            <h3 className="font-serif text-3xl md:text-4xl font-medium tracking-tight leading-tight text-white">
              Want me to analyse YOUR chart?
            </h3>
            <p className="text-indigo-100 font-light text-sm md:text-base max-w-lg mx-auto">
              Get an honest, multi-system, deeply cross-verified analysis of your career, relationships, or upcoming life phases delivered in a detailed written report.
            </p>
            
            <div className="pt-4">
              <button 
                onClick={onBookConsultation}
                className="w-full sm:w-auto px-16 py-5 bg-[#10B981] text-white hover:bg-[#FACC15] hover:text-[#1E1B4B] rounded-full text-lg font-bold shadow-xl transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
              >
                Book Your Reading
              </button>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default DisclaimerCTA;
