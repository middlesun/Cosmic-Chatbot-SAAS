import React, { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs: FAQItem[] = [
    {
      question: "What astrological systems do you use?",
      answer: "I use a disciplined multi-system cross-verified approach. Every consultation combines Parashari Jyotish (for overall life destiny and karmic themes), Jaimini Jyotish (for events and major transitions), KP Astrology (for precise timing verification), and Siddha Nadi principles (to reveal repeating family and ancestral patterns). No technique is used in isolation."
    },
    {
      question: "Why are your consultations delivered as written reports instead of live calls?",
      answer: "A written report is a deliberate choice for uncompromised accuracy. Live calls require real-time improvisation, whereas a written consultation allows me to spend 3-5 hours carefully analyzing and cross-verifying your main natal chart (D1) against various divisional charts (D9, D10, D7, etc.), current dashas, and active transits. This produces a cohesive, lasting document of your life's blueprint that you can revisit for years."
    },
    {
      question: "How long does it take to receive my written consultation?",
      answer: "Written consultations are typically delivered directly to your email address within 7-10 business Days of receiving your confirmed order and exact birth details."
    },
    {
      question: "What birth details are required for a precise reading?",
      answer: "To generate highly accurate divisional charts and timing, you will need to provide your Date of Birth, exact Time of Birth (with AM/PM), and Place/City of Birth. If your birth time is approximate, please mention it during checkout so I can adjust the window of analysis."
    },
    {
      question: "Are my personal details and birth chart kept confidential?",
      answer: "Yes, 100% confidential. Your birth charts, personal narratives, and counseling queries are encrypted and processed solely by me. No details are ever shared with third parties or stored in public databases."
    },
    {
      question: "Can I ask follow-up questions after receiving my report?",
      answer: "Yes. Every consultation includes a dedicated email window where you can ask clarifying questions about the specific insights, planetary timelines, or themes covered in your custom written report."
    }
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="bg-[#FAF9F6] py-24 md:py-32 border-t border-[#7c6d5e]/15" id="faq-section">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-16 space-y-4">
          <span className="text-[#7c6d5e] uppercase tracking-[0.3em] text-xs font-bold font-mono">Direct Answers</span>
          <h2 className="font-serif text-3xl md:text-5xl font-medium text-indigo-950 tracking-tight leading-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-500 font-light text-base md:text-lg max-w-2xl mx-auto">
            Clear, transparent answers to help you understand my methodology, delivery format, and consulting principles.
          </p>
        </div>

        <div className="space-y-4" id="faq-accordion">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div 
                key={idx}
                className="bg-white border border-[#7c6d5e]/15 rounded-2xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md"
              >
                <button
                  onClick={() => toggleFAQ(idx)}
                  className="w-full px-6 py-5 md:px-8 md:py-6 text-left flex justify-between items-center gap-4 text-indigo-950 hover:text-[#7c6d5e] transition-colors focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="font-serif text-lg md:text-xl font-semibold leading-snug">
                    {faq.question}
                  </span>
                  <span className={`flex-shrink-0 w-8 h-8 rounded-full border border-indigo-50 bg-indigo-50/30 flex items-center justify-center transition-transform duration-300 ${isOpen ? 'rotate-180 bg-indigo-50 text-indigo-900' : 'text-slate-400'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>

                <div 
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[500px] border-t border-indigo-50/50' : 'max-h-0'}`}
                >
                  <div className="px-6 py-5 md:px-8 md:py-6 text-slate-600 text-sm md:text-base leading-relaxed font-light">
                    {faq.answer}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
