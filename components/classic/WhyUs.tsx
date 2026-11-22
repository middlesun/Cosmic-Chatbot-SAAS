import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Currency } from '../../types';

interface WhyUsProps {
  onBack: () => void;
  onAllProducts: () => void;
  onPlaceOrder: () => void;
  currency: Currency;
}

const WhyUs: React.FC<WhyUsProps> = ({ onBack, onAllProducts, onPlaceOrder, currency }) => {
  const navigate = useNavigate();
  const getCurrencyIcon = () => {
    if (currency === Currency.USD) return "$";
    if (currency === Currency.EUR) return "€";
    return "₹";
  };

  const highlightClass = "p-8 rounded-[2rem] bg-[#7c6d5e]/10 border border-[#7c6d5e]/20 shadow-sm my-8";

  const sections = [
    {
      title: "I Begin With the Full Context — Not Just the Question",
      content: [
        "No question exists in isolation.",
        "Before addressing what you asked, I study the larger structure of your life through:",
        <strong className="text-indigo-900 font-bold">• Your complete natal chart (D1)</strong>,
        <strong className="text-indigo-900 font-bold">• Relevant divisional charts connected to the concern</strong>,
        <strong className="text-indigo-900 font-bold">• Current and upcoming Dashas</strong>,
        <strong className="text-indigo-900 font-bold">• Active and approaching transits</strong>,
        "This ensures your situation is understood within the broader arc of your life, not as a standalone incident.",
        "It’s why my responses tend to feel grounded, specific, and sometimes unexpectedly accurate—without leaning on exaggeration or reassurance for its own sake."
      ]
    },
    {
      title: "A Multi-System, Cross-Verified Method",
      isHighlighted: true,
      content: [
        "I don’t rely on a single school of astrology to explain everything.",
        "Each consultation synthesizes multiple authoritative Vedic systems—used for what they do best:",
        <div className="space-y-2">
          <span>• <strong className="text-indigo-900 font-bold">Parashari Jyotish</strong> for life structure, relationships, destiny indicators, and long-term karmic themes</span><br/>
          <span>• <strong className="text-indigo-900 font-bold">Jaimini Jyotish</strong> for events, transitions, and fate-driven turning points through Chara Karakas and Dashas</span><br/>
          <span>• <strong className="text-indigo-900 font-bold">KP Astrology</strong> for precision and confirmation using Nakshatra sub-lords and ruling planet logic</span><br/>
          <span>• <strong className="text-indigo-900 font-bold">Siddha Nadi</strong> principles to identify repeating karmic patterns and time-bound triggers</span>
        </div>,
        "No system is used in isolation. Each insight is checked against the others to eliminate contradiction and over-interpretation."
      ]
    },
    {
      title: "A Strict Hierarchy — Not Random Technique Mixing",
      isHighlighted: true,
      content: [
        "Astrology often feels inconsistent because techniques are blended without discipline.",
        "I follow a non-negotiable analytical hierarchy in every consultation:",
        <div className="font-bold text-[#7c6d5e] py-2">Birth Chart → Navamsa → Relevant Divisional Charts → Dasha Activation → Transits → Strength Analysis → KP Confirmation</div>,
        "This structure ensures:",
        "• Core chart truths are never overridden by minor indicators",
        "• Timing is validated before conclusions are drawn",
        "• Interpretations remain coherent, even for complex or emotionally charged questions",
        "It’s also why I’m willing to say no when the chart doesn’t support an outcome—and yes only when it truly does."
      ]
    },
    {
      title: "Timing Is Central — Not an Afterthought",
      content: [
        "Most people don’t just want to know what is happening. They want to know how long it will last, and when it changes.",
        "That’s why every consultation places strong emphasis on:",
        <strong className="text-indigo-900 font-bold">• Active and upcoming Dashas</strong>,
        <strong className="text-indigo-900 font-bold">• Planetary activation periods</strong>,
        <strong className="text-indigo-900 font-bold">• Transitional windows indicating pressure, relief, or opportunity</strong>,
        "This often brings clarity around:",
        <strong className="text-indigo-900 font-bold">• Whether it’s a phase to act or to wait</strong>,
        <strong className="text-indigo-900 font-bold">• Why effort hasn’t yielded results yet</strong>,
        <strong className="text-indigo-900 font-bold">• How much patience is realistically required</strong>,
        "For many clients, understanding timing alone brings relief—and the strength to endure what cannot yet be rushed."
      ]
    },
    {
      title: "Patterns Over Predictions",
      content: [
        "I don’t focus on dramatic forecasts.",
        "Instead, I look for:",
        "• Repeating life patterns",
        "• Emotional and relational dynamics",
        "• Decision-making cycles that quietly shape outcomes",
        <span>This approach allows you to <strong className="text-indigo-900 font-bold">make informed choices without fear, understand what is within your control, and move through difficult periods without losing perspective.</strong></span>,
        "Astrology, when applied correctly, should strengthen judgment, not replace it.",
        "When relevant, I may include strategic suggestions aligned with timing, simple, non-invasive remedies, or practical reframing of decisions. Nothing is prescribed blindly."
      ]
    },
    {
      title: "Written, Email-Based Consultations — By Design",
      content: [
        "All consultations are delivered via email. This is intentional.",
        "It allows the analysis to remain structured and precise, thoughtfully composed, and free from emotional pressure or real-time reaction.",
        <strong className="text-indigo-900 font-bold">You can revisit the guidance over time, especially as situations evolve. And I’m able to work carefully—without haste—which is essential for accurate chart synthesis.</strong>
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-20">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-[#7c6d5e]/70 uppercase tracking-widest mb-6">
        <span className="hover:text-indigo-950 cursor-pointer transition-colors" onClick={() => navigate('/')}>Home</span>
        <span>/</span>
        <span className="text-indigo-950 font-bold">Why Me</span>
      </nav>

      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-indigo-400 hover:text-indigo-900 transition-silky mb-12 group animate-fade-in"
      >
        <svg className="w-5 h-5 group-hover:-translate-x-1.5 transition-silky" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-sm font-bold uppercase tracking-[0.2em]">Back</span>
      </button>

      <div className="animate-slide-up-fade">
        <header className="mb-20">
          <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-soft-gold mb-6">The Standard I Work By</p>
          <h1 className="font-serif text-5xl md:text-7xl text-indigo-950 font-semibold leading-[1.1] mb-8 tracking-tight">Why Me</h1>
          <p className="text-xl md:text-2xl text-slate-600 font-light leading-relaxed">
            At CosmicCouncil, I approach astrology as a diagnostic and timing science—one that demands patience, structure, and verification. 
            <span className="block mt-4 italic">Not intuition alone. Not shortcuts. And never guesswork.</span>
          </p>
        </header>

        <div className="space-y-16 mb-24">
          {sections.map((section, idx) => (
            <section key={idx} className={section.isHighlighted ? highlightClass : ""}>
              <h2 className="font-serif text-3xl md:text-4xl text-indigo-950 font-semibold mb-8 tracking-tight">
                {section.title}
              </h2>
              <div className="space-y-6">
                {section.content.map((p, pIdx) => (
                  <div key={pIdx} className="text-xl md:text-2xl text-slate-600 font-light leading-relaxed">
                    {p}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-24">
          <button 
            onClick={onBack}
            className="flex-1 w-full md:w-auto px-8 py-4 border-2 border-[#7c6d5e] text-[#7c6d5e] rounded-2xl font-bold uppercase tracking-widest transition-all hover:bg-[#7c6d5e] hover:text-white flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back Home
          </button>
          <button 
            onClick={onAllProducts}
            className="flex-1 w-full md:w-auto px-8 py-4 border-2 border-[#7c6d5e] text-[#7c6d5e] rounded-2xl font-bold uppercase tracking-widest transition-all hover:bg-[#7c6d5e] hover:text-white flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            All Products
          </button>
          <button 
            onClick={onPlaceOrder}
            className="flex-1 w-full md:w-auto px-8 py-4 bg-[#7c6d5e] text-[#fdfce9] rounded-2xl font-bold uppercase tracking-widest transition-all hover:brightness-110 flex items-center justify-center gap-2 shadow-lg"
          >
            <span className="text-xl font-bold leading-none">{getCurrencyIcon()}</span>
            Place order
          </button>
        </div>

        <footer className="w-full p-10 md:p-12 bg-indigo-950 rounded-[2.5rem] md:rounded-[3rem] text-center text-white">
          <p className="text-indigo-200 font-light text-xl md:text-2xl leading-relaxed max-w-2xl mx-auto">
            Astrology is not about certainty. It’s about clarity, timing, and perspective. 
            That is what I aim to offer—quietly, carefully, and with respect for the complexity of your life.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default WhyUs;