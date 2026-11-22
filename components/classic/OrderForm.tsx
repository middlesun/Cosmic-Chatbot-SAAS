import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Product, Currency, BirthDetails, formatCurrencyPrice } from '../../types';

interface SectionProps {
  index: number;
  title: string;
  children: React.ReactNode;
  activeSection: number;
  setActiveSection: (index: number) => void;
}

const Section: React.FC<SectionProps> = ({ index, title, children, activeSection, setActiveSection }) => (
  <div className={`border-b border-indigo-50/50 last:border-0 overflow-hidden transition-all duration-700 ease-in-out`}>
    <button 
      type="button"
      onClick={() => setActiveSection(activeSection === index ? -1 : index)}
      className="w-full py-4 sm:py-6 px-4 sm:px-8 flex items-center justify-between text-left group hover:bg-indigo-50/20 transition-silky"
    >
      <span className="font-serif text-lg sm:text-xl text-indigo-950 group-hover:text-indigo-600 transition-silky flex items-center gap-3 sm:gap-5">
        <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-50 text-indigo-400 text-[10px] sm:text-[11px] flex items-center justify-center font-bold group-hover:bg-indigo-950 group-hover:text-white transition-silky">0{index + 1}</span>
        {title}
      </span>
      <svg 
        className={`w-5 h-5 sm:w-6 sm:h-6 text-indigo-200 transition-silky ${activeSection === index ? 'rotate-180 text-indigo-600' : ''}`} 
        fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    <div className={`transition-all duration-700 ease-in-out overflow-hidden ${activeSection === index ? 'max-h-[3500px] opacity-100 pb-8 sm:pb-12' : 'max-h-0 opacity-0 pointer-events-none'}`}>
      <div className="pt-2 sm:pt-4 px-4 sm:px-8">
        {children}
      </div>
    </div>
  </div>
);

const AmPmDropdown = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative h-14 w-full" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="h-full w-full bg-white border-2 border-indigo-50 rounded-xl flex items-center justify-between px-3 cursor-pointer hover:border-indigo-200 transition-all duration-300 shadow-sm"
      >
        <span className="text-xs font-bold text-indigo-950">{value}</span>
        <svg className={`w-4 h-4 text-indigo-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2.5"/></svg>
      </div>
      {isOpen && (
        <div className="absolute bottom-full left-0 w-full mb-1 bg-white border border-indigo-100 rounded-xl shadow-xl z-[100] animate-fade-in overflow-hidden">
          {['AM', 'PM'].map((opt) => (
            <div 
              key={opt}
              onClick={() => { onChange(opt); setIsOpen(false); }}
              className={`px-3 py-3 text-xs font-bold hover:bg-indigo-50 cursor-pointer transition-colors ${value === opt ? 'bg-indigo-50 text-indigo-600' : 'text-indigo-400'}`}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const BirthFields = ({ details, setDetails, showRelation = false, title }: { details: any, setDetails: (d: any) => void, showRelation?: boolean, title: string }) => (
  <div className="space-y-6 animate-fade-in w-full">
    <h4 className="font-serif text-xl font-semibold text-indigo-900 border-b border-indigo-100 pb-2">{title}</h4>
    {showRelation && <input type="text" required value={details.relationship} onChange={e => setDetails({...details, relationship: e.target.value})} className="w-full h-14 px-5 bg-indigo-50/50 border-2 border-indigo-100 rounded-xl focus:border-indigo-300 focus:outline-none" placeholder="How are you related?" />}
    <div className="relative">
      <input type="text" value={details.name} onChange={e => setDetails({...details, name: e.target.value})} className="w-full h-14 p-4 bg-indigo-50/20 border-2 border-indigo-50 rounded-xl pr-12 focus:border-indigo-300 focus:outline-none" placeholder="Native's name" />
      <button type="button" onClick={() => setDetails({...details, name: ''})} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-200 hover:text-rose-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg></button>
    </div>
    <div>
      <label className="text-[10px] uppercase font-bold text-indigo-500 tracking-widest mb-2 block">Sex</label>
      <div className="grid grid-cols-3 gap-2 p-1 bg-indigo-50/30 rounded-2xl border-2 border-indigo-50 h-14">
        {['male', 'female', 'non-binary'].map(s => (
          <button key={s} type="button" onClick={() => setDetails({...details, sex: s as any})} className={`h-full rounded-xl text-[10px] font-bold uppercase transition-all ${details.sex === s ? 'bg-white text-indigo-950 shadow-sm' : 'text-indigo-400'}`}>{s}</button>
        ))}
      </div>
    </div>
    <div className="grid grid-cols-3 gap-3">
      <input type="text" required placeholder="DD" value={details.day} onChange={e => setDetails({...details, day: e.target.value})} className="h-14 px-4 bg-indigo-50/20 border-2 border-indigo-50 rounded-xl focus:border-indigo-300 focus:outline-none" />
      <input type="text" required placeholder="MM" value={details.month} onChange={e => setDetails({...details, month: e.target.value})} className="h-14 px-4 bg-indigo-50/20 border-2 border-indigo-50 rounded-xl focus:border-indigo-300 focus:outline-none" />
      <input type="text" required placeholder="YYYY" value={details.year} onChange={e => setDetails({...details, year: e.target.value})} className="h-14 px-4 bg-indigo-50/20 border-2 border-indigo-50 rounded-xl focus:border-indigo-300 focus:outline-none" />
    </div>
    <div className="grid grid-cols-4 gap-2">
       <input type="text" placeholder="HH" value={details.tobH} onChange={e => setDetails({...details, tobH: e.target.value})} className="h-14 bg-indigo-50/20 border-2 border-indigo-50 rounded-xl text-center focus:border-indigo-300 focus:outline-none" />
       <input type="text" placeholder="MM" value={details.tobM} onChange={e => setDetails({...details, tobM: e.target.value})} className="h-14 bg-indigo-50/20 border-2 border-indigo-50 rounded-xl text-center focus:border-indigo-300 focus:outline-none" />
       <input type="text" placeholder="SS" value={details.tobS} onChange={e => setDetails({...details, tobS: e.target.value})} className="h-14 bg-indigo-50/20 border-2 border-indigo-50 rounded-xl text-center focus:border-indigo-300 focus:outline-none" />
       <AmPmDropdown value={details.tobAP} onChange={v => setDetails({...details, tobAP: v})} />
    </div>
    <input type="text" required placeholder="Birth City/Country" value={details.city} onChange={e => setDetails({...details, city: e.target.value})} className="w-full h-14 px-4 bg-indigo-50/20 border-2 border-indigo-50 rounded-xl focus:border-indigo-300 focus:outline-none" />
  </div>
);

const FilePreview = ({ file, onClear }: { file: File | null, onClear: () => void }) => {
  if (!file) return null;
  return (
    <div className="mt-2 flex items-center gap-3 p-3 bg-indigo-50 rounded-xl relative border border-indigo-100 shadow-sm animate-fade-in">
      {file.type.startsWith('image/') ? <img src={URL.createObjectURL(file)} className="w-14 h-14 object-cover rounded-lg" /> : <div className="w-14 h-14 bg-indigo-200 rounded-lg flex items-center justify-center"><svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" strokeWidth="2"/></svg></div>}
      <div className="flex-1 min-w-0 font-bold text-xs text-indigo-900 truncate">{file.name}</div>
      <button type="button" onClick={onClear} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-full transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg></button>
    </div>
  );
};

interface OrderFormProps {
  product: Product;
  currency: Currency;
}

const OrderForm: React.FC<OrderFormProps> = memo(({ product, currency: parentCurrency }) => {
  const [chartMode, setChartMode] = useState<'my' | 'someone' | 'both'>('my');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [birthDetails, setBirthDetails] = useState({ 
    name: '', day: '', month: '', year: '', tobH: '', tobM: '', tobS: '', tobAP: 'AM', city: '', state: '', country: '', sex: 'male' 
  });
  const [secondBirthDetails, setSecondBirthDetails] = useState({ 
    name: '', day: '', month: '', year: '', tobH: '', tobM: '', tobS: '', tobAP: 'AM', city: '', state: '', country: '', sex: 'male', relationship: '' 
  });
  
  const [personalDetails, setPersonalDetails] = useState({ name: '', email: '', country: '', botcheck: '' });
  const [question, setQuestion] = useState('');
  const [activeSection, setActiveSection] = useState<number>(0);
  const [orderState, setOrderState] = useState<'form' | 'review' | 'inr-payment' | 'success'>('form');

  const [myChart, setMyChart] = useState<File | null>(null);
  const [secondChart, setSecondChart] = useState<File | null>(null);

  useEffect(() => {
    const savedPersonal = localStorage.getItem('cc_order_personal_v5');
    if (savedPersonal) {
      const parsed = JSON.parse(savedPersonal);
      setPersonalDetails({ name: parsed.name || '', email: parsed.email || '', country: parsed.country || '', botcheck: '' });
    }
    const savedQuestion = localStorage.getItem('cc_order_question_v5');
    if (savedQuestion) setQuestion(savedQuestion);
    const savedMain = localStorage.getItem('cc_order_main_v5');
    if (savedMain) setBirthDetails(JSON.parse(savedMain));
    const savedSecond = localStorage.getItem('cc_order_second_v5');
    if (savedSecond) setSecondBirthDetails(JSON.parse(savedSecond));
    const savedMode = localStorage.getItem('cc_order_mode_v5');
    if (savedMode) setChartMode(savedMode as any);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    setAutoSaveStatus('saving');
    const timer = setTimeout(() => {
      localStorage.setItem('cc_order_main_v5', JSON.stringify(birthDetails));
      localStorage.setItem('cc_order_second_v5', JSON.stringify(secondBirthDetails));
      localStorage.setItem('cc_order_personal_v5', JSON.stringify(personalDetails));
      localStorage.setItem('cc_order_question_v5', question);
      localStorage.setItem('cc_order_mode_v5', chartMode);
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    }, 2000);
    return () => clearTimeout(timer);
  }, [birthDetails, secondBirthDetails, personalDetails, question, chartMode, isLoaded]);

  const getPrice = useCallback(() => formatCurrencyPrice(product.priceINR, parentCurrency), [product.priceINR, parentCurrency]);

  const getDeliveryTime = useCallback(() => {
    if (product.priceINR > 10000) return "10-15 days";
    return "7-10 days";
  }, [product.priceINR]);

  const formatBirthDetails = (details: any) => {
    return `Name: ${details.name || 'Anonymous'}
DOB : ${details.day}/${details.month}/${details.year}
TOB : ${details.tobH}:${details.tobM} (${details.tobAP})
POB : ${details.city}${details.state ? ', ' + details.state : ''}${details.country ? ', ' + details.country : ''}
Sex : ${details.sex}`;
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          access_key: import.meta.env.VITE_WEB3FORMS_ACCESS_KEY,
          subject: `New Order - ${product.name} - ${getPrice()}`,
          Package: product.name,
          Price: getPrice(),
          "Your Email": personalDetails.email,
          "Chart owner": chartMode,
          "Birth details": formatBirthDetails(birthDetails),
          "Second Profile": chartMode !== 'my' ? formatBirthDetails(secondBirthDetails) : "None",
          Questions: question || 'No specific question provided',
          botcheck: personalDetails.botcheck,
          My_Chart: myChart ? myChart.name : "None",
          Second_Chart: secondChart ? secondChart.name : "None",
        }),
      });

      const data = await response.json();
      if (data.success) {
        if (parentCurrency === Currency.INR) {
          setOrderState('inr-payment');
          setIsSubmitting(false);
        } else {
          localStorage.removeItem('cc_order_main_v5');
          localStorage.removeItem('cc_order_second_v5');
          localStorage.removeItem('cc_order_personal_v5');
          localStorage.removeItem('cc_order_question_v5');
          localStorage.removeItem('cc_order_mode_v5');

          const priceText = getPrice().replace(/[^0-9.]/g, '');
          window.location.href = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=chrisbasu7@gmail.com&item_name=${encodeURIComponent(product.name)}&amount=${priceText}&currency_code=${parentCurrency}`;
        }
      } else {
        setError(data.message || "Failed to submit order. Please try again.");
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      setError("A network error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (orderState === 'inr-payment') {
    return (
      <div className="bg-white rounded-[2.5rem] p-6 md:p-10 border border-indigo-50 shadow-2xl space-y-6 md:space-y-10 text-center animate-slide-up-fade">
        <h2 className="font-serif text-2xl md:text-3xl text-indigo-950 font-bold">Complete Your Order</h2>
        <div className="space-y-1">
          <p className="font-bold text-indigo-950 uppercase tracking-tight text-lg">{product.name}</p>
          <p className="text-indigo-600 font-bold text-xl">{getPrice()}</p>
        </div>
        <div className="mx-auto w-56 h-56 md:w-64 md:h-64 border-4 border-indigo-950 rounded-3xl overflow-hidden p-2 shadow-2xl">
          <img src="https://www.cosmiccouncil.pro/qr.jpeg" className="w-full h-full object-contain" alt="QR" />
        </div>
        <div className="space-y-2">
          <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">UPI ID</p>
          <p className="text-2xl font-bold text-indigo-950">chrisbasu7@ybl</p>
          <p className="text-xs text-slate-600 mt-4 leading-relaxed">Once payment is made, send the payment screenshot from your email to <br/><span className="font-bold text-indigo-950">cosmiccouncil.services@gmail.com</span> as confirmation.</p>
        </div>
        <div className="space-y-3">
          <button onClick={() => window.location.reload()} className="w-full py-4 md:py-5 btn-gradient-indigo text-white rounded-2xl md:rounded-3xl font-bold uppercase tracking-widest text-sm md:text-base shadow-lg">Done</button>
          <button onClick={() => setOrderState('form')} className="w-full py-4 md:py-5 border-2 border-indigo-50 text-indigo-400 rounded-2xl md:rounded-3xl font-bold uppercase tracking-widest text-sm md:text-base">Back</button>
        </div>
      </div>
    );
  }

  if (orderState === 'success') {
    return (
      <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-indigo-50 shadow-2xl text-center space-y-6 md:space-y-8">
        <div className="w-20 h-20 md:w-24 md:h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto animate-bounce shadow-xl shadow-emerald-100/50"><svg className="w-10 h-10 md:w-12 md:h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg></div>
        <h2 className="font-serif text-3xl md:text-4xl text-indigo-950 font-bold">Success!</h2>
        <p className="text-slate-500 text-sm md:text-base">Expect a response within {getDeliveryTime()}</p>
        <button onClick={() => window.location.reload()} className="w-full py-4 md:py-5 btn-gradient-indigo text-white rounded-2xl md:rounded-3xl font-bold uppercase tracking-widest text-sm md:text-base">Return</button>
      </div>
    );
  }

  if (orderState === 'review') {
    return (
      <div className="bg-white rounded-[2.5rem] p-6 md:p-10 border border-indigo-50 shadow-2xl space-y-8 md:space-y-10 animate-slide-up-fade">
        <h2 className="font-serif text-2xl md:text-3xl text-indigo-950 text-center font-bold">Confirm your order</h2>
        <div className="space-y-6 text-xs md:text-sm">
          <div className="p-5 md:p-6 bg-indigo-950 rounded-[1.5rem] md:rounded-3xl text-white">
            <p className="text-soft-gold uppercase tracking-widest text-[9px] md:text-[10px] mb-2 font-bold">Service Package</p>
            <div className="flex justify-between items-center"><span className="font-serif text-xl md:text-2xl font-semibold text-white">{product.name}</span><span className="font-bold text-base md:text-lg text-white">{getPrice()}</span></div>
            <p className="mt-2 text-[9px] md:text-[10px] uppercase font-bold text-indigo-300 flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2.5"/></svg>
              Delivered in {getDeliveryTime()}
            </p>
          </div>
          <div className="p-5 md:p-6 bg-indigo-50/50 rounded-[1.5rem] md:rounded-3xl border border-indigo-100 space-y-4 md:space-y-6">
            <div><p className="text-slate-400 text-[9px] md:text-[10px] uppercase font-bold mb-1">Mode</p><p className="font-semibold text-indigo-950 uppercase">{chartMode}</p></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><p className="text-slate-400 text-[9px] md:text-[10px] uppercase font-bold mb-1">Primary Native</p><p className="font-semibold text-indigo-950">{birthDetails.name || 'Anonymous'}</p></div>
              {chartMode !== 'my' && <div className="col-span-2"><p className="text-slate-400 text-[9px] md:text-[10px] uppercase font-bold mb-1">Secondary Native</p><p className="font-semibold text-indigo-950">{secondBirthDetails.name || 'Anonymous'}</p></div>}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 font-bold text-sm text-center">
              {error}
            </div>
          )}
          <button onClick={handleConfirm} disabled={isSubmitting} className="w-full py-4 md:py-5 btn-gradient-emerald text-white rounded-xl md:rounded-3xl font-bold uppercase tracking-widest shadow-xl hover:brightness-110 transition-all text-xs md:text-base">{isSubmitting ? 'Processing...' : (parentCurrency === Currency.INR ? 'Proceed to Pay' : 'Pay via PayPal')}</button>
          <button onClick={() => setOrderState('form')} className="w-full py-4 md:py-5 bg-white text-indigo-400 border border-indigo-50 rounded-xl md:rounded-3xl font-bold uppercase tracking-widest transition-all text-xs md:text-base">Edit Details</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); setOrderState('review'); }} className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-indigo-50 shadow-2xl overflow-hidden relative">
      <div className={`absolute top-4 right-4 z-[50] px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm border border-indigo-50 text-[8px] font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2 transition-opacity duration-500 ${autoSaveStatus !== 'idle' ? 'opacity-100' : 'opacity-0'}`}>
        {autoSaveStatus === 'saving' ? 'Saving...' : 'Saved'}
      </div>
      <div className="p-6 md:p-10 bg-indigo-950 text-white border-b border-white/10">
        <div className="flex items-center justify-between"><h2 className="font-serif text-2xl md:text-3xl font-semibold">{product.name}</h2><span className="text-xl md:text-2xl font-bold">{getPrice()}</span></div>
        <p className="mt-2 text-[9px] md:text-[10px] uppercase font-bold text-indigo-300 flex items-center gap-2">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2.5"/></svg>
          Delivered in {getDeliveryTime()}
        </p>
      </div>
      <div className="divide-y divide-indigo-50">
        <Section index={0} title="Birth Credentials" activeSection={activeSection} setActiveSection={setActiveSection}>
          <div className="space-y-8 md:space-y-10">
            <div className="flex bg-indigo-50/50 p-1 rounded-xl md:rounded-2xl border border-indigo-100 w-full mx-auto">
              <button type="button" onClick={() => setChartMode('my')} className={`flex-1 h-10 md:h-12 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-bold uppercase transition-all ${chartMode === 'my' ? 'bg-white text-indigo-950 shadow-sm' : 'text-indigo-500'}`}>My Chart</button>
              <button type="button" onClick={() => setChartMode('someone')} className={`flex-1 h-10 md:h-12 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-bold uppercase transition-all ${chartMode === 'someone' ? 'bg-white text-indigo-950 shadow-sm' : 'text-indigo-500'}`}>Someone's</button>
              <button type="button" onClick={() => setChartMode('both')} className={`flex-1 h-10 md:h-12 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-bold uppercase transition-all ${chartMode === 'both' ? 'bg-white text-indigo-950 shadow-sm' : 'text-indigo-500'}`}>Both</button>
            </div>

            <div className="space-y-10 md:space-y-12">
              {(chartMode === 'my' || chartMode === 'both') && (
                <div className="space-y-6">
                  <BirthFields title={chartMode === 'both' ? "First Profile" : "Birth Details"} details={birthDetails} setDetails={setBirthDetails} />
                </div>
              )}
              {(chartMode === 'someone' || chartMode === 'both') && (
                <div className={chartMode === 'both' ? "pt-10 md:pt-12 border-t border-dashed border-indigo-100" : ""}>
                  <BirthFields title={chartMode === 'both' ? "Second Profile" : "Native's Details"} details={secondBirthDetails} setDetails={setSecondBirthDetails} showRelation={true} />
                </div>
              )}
            </div>
          </div>
        </Section>
        <Section index={1} title="Chart Uploads" activeSection={activeSection} setActiveSection={setActiveSection}>
           <div className="space-y-6">
             <div><label className="text-[10px] uppercase font-bold text-indigo-500 tracking-widest block mb-2">My Chart (Optional)</label><input type="file" onChange={e => setMyChart(e.target.files?.[0] || null)} className="w-full text-[10px] text-indigo-200 file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-50 file:text-indigo-700 focus:outline-none" /><FilePreview file={myChart} onClear={() => setMyChart(null)} /></div>
             <div><label className="text-[10px] uppercase font-bold text-indigo-500 tracking-widest block mb-2">Second Chart (Optional)</label><input type="file" onChange={e => setSecondChart(e.target.files?.[0] || null)} className="w-full text-[10px] text-indigo-200 file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-50 file:text-indigo-700 focus:outline-none" /><FilePreview file={secondChart} onClear={() => setSecondChart(null)} /></div>
           </div>
        </Section>
        <Section index={2} title="Your questions & context" activeSection={activeSection} setActiveSection={setActiveSection}>
          <div className="relative">
            <textarea value={question} onChange={e => setQuestion(e.target.value)} className="w-full p-4 md:p-6 bg-indigo-50/30 border-2 border-indigo-50 rounded-2xl md:rounded-3xl text-sm min-h-[220px] md:min-h-[300px] focus:outline-none pr-10 md:pr-12" />
            <button type="button" onClick={() => setQuestion('')} className="absolute right-4 md:right-6 top-4 md:top-6 text-indigo-200 hover:text-rose-500 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg></button>
          </div>
          <p className="text-[11px] md:text-xs text-indigo-500 mt-2 block leading-relaxed font-medium">
            Feel free to provide as much context and detail as you'd like. The more context you provide, the more accurate and relevant my analysis is likely to be.
          </p>
        </Section>
        <Section index={3} title="Personal details" activeSection={activeSection} setActiveSection={setActiveSection}>
          <div className="space-y-4">
             <div className="relative"><input type="text" required value={personalDetails.name} onChange={e => setPersonalDetails({...personalDetails, name: e.target.value})} className="w-full h-14 p-4 bg-indigo-50/30 border-2 border-indigo-50 rounded-xl pr-10 md:pr-12 focus:outline-none text-sm md:text-base" placeholder="Your Name" /></div>
             <div className="relative"><input type="email" required value={personalDetails.email} onChange={e => setPersonalDetails({...personalDetails, email: e.target.value})} className="w-full h-14 p-4 bg-indigo-50/30 border-2 border-indigo-50 rounded-xl pr-10 md:pr-12 focus:outline-none text-sm md:text-base" placeholder="Email Address" /><button type="button" onClick={() => setPersonalDetails({...personalDetails, email: ''})} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-200 hover:text-rose-500 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg></button></div>
             <input type="text" name="botcheck" value={personalDetails.botcheck} onChange={e => setPersonalDetails({...personalDetails, botcheck: e.target.value})} className="hidden" style={{ display: 'none' }} />
          </div>
        </Section>
        <div className="p-6 md:p-8 bg-slate-50/30 border-t border-indigo-50"><button type="submit" className="w-full py-4 md:py-6 btn-gradient-indigo text-white rounded-xl md:rounded-3xl font-bold uppercase tracking-[0.1em] md:tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 group transition-all duration-300 hover:brightness-110 text-sm md:text-base">Continue <svg className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div>
      </div>
    </form>
  );
});

export default OrderForm;