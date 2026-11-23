import React, { useState, useEffect } from 'react';
import { Currency } from '../types';

interface QuickPaymentProps {
  onBack: () => void;
}

const QuickPayment: React.FC<QuickPaymentProps> = ({ onBack }) => {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', amount: '', message: '', reference: '', botcheck: '' });
  const [myChart, setMyChart] = useState<File | null>(null);
  const [secondChart, setSecondChart] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [orderState, setOrderState] = useState<'selection' | 'form' | 'inr-payment' | 'success'>('selection');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('cc_quick_pay_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      setFormData(prev => ({ ...prev, ...parsed, botcheck: '' }));
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    setAutoSaveStatus('saving');
    const timer = setTimeout(() => {
      localStorage.setItem('cc_quick_pay_v2', JSON.stringify(formData));
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    }, 1000);
    return () => clearTimeout(timer);
  }, [formData, isLoaded]);

  const handleCurrencySelect = (c: Currency) => {
    setSelectedCurrency(c);
    if (c === Currency.INR) {
      setOrderState('inr-payment');
    } else {
      setOrderState('form');
    }
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('cosmiccouncil.services@gmail.com');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInternalBack = () => {
    if (orderState === 'selection') onBack();
    else setOrderState('selection');
  };

  const clearField = (field: keyof typeof formData) => {
    setFormData(prev => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(formData.amount) < 9) {
      alert("Minimum payment amount is 9");
      return;
    }

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
          subject: `Quick Payment - ${formData.name} - ${selectedCurrency}${formData.amount}`,
          "Service Name": "Personalised Birth Chart Reading Service",
          "Native Name": formData.name,
          "Your Email": formData.email,
          Amount: `${selectedCurrency} ${formData.amount}`,
          Message: formData.message,
          Reference: formData.reference,
          botcheck: formData.botcheck,
          My_Chart: myChart ? myChart.name : "None",
          Second_Person_Chart: secondChart ? secondChart.name : "None"
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Reset form details
        localStorage.removeItem('cc_quick_pay_v2');
        setFormData({ name: '', email: '', amount: '', message: '', reference: '', botcheck: '' });
        setMyChart(null);
        setSecondChart(null);

        const paypalUrl = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=chrisbasu7@gmail.com&item_name=${encodeURIComponent('Personalised Birth Chart Reading Service')}&amount=${formData.amount}&currency_code=${selectedCurrency}`;
        window.location.href = paypalUrl;
      } else {
        setError(data.message || "Failed to submit details. Please try again.");
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      setError("A network error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  const FilePreview = ({ file, onClear }: { file: File | null, onClear: () => void }) => {
    if (!file) return null;
    return (
      <div className="mt-2 flex items-center gap-3 p-3 bg-indigo-50 rounded-xl animate-fade-in relative border border-indigo-100 shadow-sm">
        {file.type.startsWith('image/') ? (
          <img src={URL.createObjectURL(file)} alt="Preview" className="w-14 h-14 object-cover rounded-lg shadow-sm" />
        ) : (
          <div className="w-14 h-14 bg-indigo-200 rounded-lg flex items-center justify-center"><svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" strokeWidth="2"/></svg></div>
        )}
        <div className="flex-1 min-w-0"><p className="text-xs text-indigo-900 font-bold truncate">{file.name}</p></div>
        <button type="button" onClick={onClear} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-full transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg></button>
      </div>
    );
  };

  if (orderState === 'inr-payment') {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center animate-slide-up-fade">
        <button onClick={() => setOrderState('selection')} className="mb-12 text-indigo-400 font-bold uppercase tracking-widest flex items-center gap-2 mx-auto">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> Back to Selection
        </button>
        <div className="bg-white rounded-[3rem] p-10 border border-indigo-50 shadow-2xl space-y-10">
          <h2 className="font-serif text-3xl text-indigo-950 font-bold">Complete Your Payment</h2>
          <div className="mx-auto w-64 h-64 bg-slate-50 border-4 border-indigo-950 rounded-3xl overflow-hidden shadow-2xl p-2">
            <img src="https://www.cosmiccouncil.pro/qr.jpeg" alt="UPI QR Code" className="w-full h-full object-contain" />
          </div>
          <div className="space-y-2">
            <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">UPI ID</p>
            <p className="text-2xl font-bold text-indigo-950">chrisbasu7@ybl</p>
          </div>
          <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 text-sm">
            <p className="text-slate-600 leading-relaxed">Once payment is made, send the payment screenshot from your email to <span className="font-bold text-indigo-950">cosmiccouncil.services@gmail.com</span> as confirmation.</p>
          </div>
          <div className="space-y-3">
            <button onClick={onBack} className="w-full py-5 btn-gradient-indigo text-white rounded-[1.5rem] font-bold tracking-widest uppercase shadow-xl">Return Home</button>
            <button onClick={() => setOrderState('selection')} className="w-full py-4 border-2 border-indigo-50 text-indigo-400 rounded-[1.5rem] font-bold uppercase tracking-widest text-sm">Back</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-20 animate-fade-in relative">
      <div className={`fixed top-24 right-6 z-[200] px-4 py-2 rounded-full bg-white/80 backdrop-blur-md border border-indigo-100 shadow-lg text-[10px] font-bold uppercase tracking-widest text-indigo-600 flex items-center gap-2 transition-all duration-500 ${autoSaveStatus !== 'idle' ? 'translate-y-0 opacity-100' : '-translate-y-20 opacity-0'}`}>
        {autoSaveStatus === 'saving' ? 'Auto-saving...' : 'Auto-saved'}
      </div>

      <button onClick={handleInternalBack} className="flex items-center gap-2 text-indigo-400 hover:text-indigo-950 transition-silky mb-12 group">
        <svg className="w-5 h-5 group-hover:-translate-x-1.5 transition-silky" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="text-sm font-bold uppercase tracking-[0.2em]">{orderState === 'selection' ? 'Back' : 'Back to Selection'}</span>
      </button>

      {orderState === 'selection' ? (
        <div className="text-center space-y-12">
          <h1 className="font-serif text-5xl md:text-6xl text-indigo-950 font-semibold">Quick Payment</h1>
          <p className="text-slate-500 text-xl font-light">Choose your payment currency to proceed</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <button onClick={() => handleCurrencySelect(Currency.INR)} className="p-10 rounded-[2.5rem] bg-white border-2 border-indigo-50 hover:border-indigo-600 hover:shadow-2xl transition-silky group">
              <span className="block text-5xl mb-4 group-hover:scale-110 transition-transform">₹</span>
              <span className="text-sm font-bold uppercase tracking-widest text-indigo-300 group-hover:text-indigo-950">Indian Rupees</span>
            </button>
            <button onClick={() => handleCurrencySelect(Currency.USD)} className="p-10 rounded-[2.5rem] bg-white border-2 border-indigo-50 hover:border-indigo-600 hover:shadow-2xl transition-silky group">
              <span className="block text-5xl mb-4 group-hover:scale-110 transition-transform">$</span>
              <span className="text-sm font-bold uppercase tracking-widest text-indigo-300 group-hover:text-indigo-950">US Dollars</span>
            </button>
            <button onClick={() => handleCurrencySelect(Currency.EUR)} className="p-10 rounded-[2.5rem] bg-white border-2 border-indigo-50 hover:border-indigo-600 hover:shadow-2xl transition-silky group">
              <span className="block text-5xl mb-4 group-hover:scale-110 transition-transform">€</span>
              <span className="text-sm font-bold uppercase tracking-widest text-indigo-300 group-hover:text-indigo-950">Euro</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[3rem] border border-indigo-50 shadow-2xl overflow-hidden animate-slide-up-fade">
          <div className="p-10 bg-indigo-950 text-white flex items-center justify-between">
            <h2 className="font-serif text-3xl font-semibold">Payment Details ({selectedCurrency})</h2>
            <button onClick={() => setOrderState('selection')} className="text-indigo-300 text-[10px] uppercase font-bold tracking-widest hover:text-white">Change Currency</button>
          </div>
          <form onSubmit={handleSubmit} className="p-10 md:p-12 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="relative">
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-5 bg-indigo-50/20 border-2 border-indigo-50 rounded-2xl text-base focus:outline-none transition-silky pr-12" placeholder="Native Name" />
                <button type="button" onClick={() => clearField('name')} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 hover:text-rose-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg></button>
              </div>
              <div className="relative">
                <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-5 bg-indigo-50/20 border-2 border-indigo-50 rounded-2xl text-base focus:outline-none transition-silky pr-12" placeholder="Email Address" />
                <button type="button" onClick={() => clearField('email')} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 hover:text-rose-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg></button>
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-300 font-bold">{selectedCurrency === Currency.USD ? '$' : '€'}</span>
              <input type="number" required min="9" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full h-14 px-5 pl-12 pr-12 bg-indigo-50/20 border-2 border-indigo-50 rounded-2xl text-base focus:outline-none transition-silky" placeholder="Custom Amount" />
              <button type="button" onClick={() => clearField('amount')} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 hover:text-rose-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-indigo-50/20 rounded-2xl border border-indigo-100">
              <div>
                <label className="text-[9px] uppercase font-bold text-indigo-300 tracking-[0.2em] mb-2 block">My Chart <span className="text-slate-400 italic">(Optional)</span></label>
                <input type="file" accept="image/*,.pdf" onChange={e => setMyChart(e.target.files?.[0] || null)} className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-white file:text-indigo-700" />
                <FilePreview file={myChart} onClear={() => setMyChart(null)} />
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-indigo-300 tracking-[0.2em] mb-2 block">Second person's Chart <span className="text-slate-400 italic">(Optional)</span></label>
                <input type="file" accept="image/*,.pdf" onChange={e => setSecondChart(e.target.files?.[0] || null)} className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-white file:text-indigo-700" />
                <FilePreview file={secondChart} onClear={() => setSecondChart(null)} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <textarea required value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} className="w-full p-6 bg-indigo-50/20 border-2 border-indigo-50 rounded-[2rem] text-base focus:outline-none transition-silky min-h-[140px] resize-none pr-12" placeholder="Message or Context..." />
                <button type="button" onClick={() => clearField('message')} className="absolute right-6 top-6 text-indigo-300 hover:text-rose-500 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg></button>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-indigo-300 tracking-[0.2em] mb-2 block">Reference* <span className="text-[8px] italic font-normal">(Share your Reddit, Instagram ID)</span></label>
                <div className="relative">
                  <input type="text" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} className="w-full p-5 bg-indigo-50/20 border-2 border-indigo-50 rounded-2xl text-base focus:outline-none transition-silky pr-12" placeholder="Handle ID..." />
                  <button type="button" onClick={() => clearField('reference')} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 hover:text-rose-500 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5"/></svg></button>
                </div>
              </div>
            </div>
            
            <input 
              type="text" 
              name="botcheck" 
              value={formData.botcheck} 
              onChange={e => setFormData({...formData, botcheck: e.target.value})} 
              className="hidden" 
              style={{ display: "none" }} 
            />

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 font-bold text-sm text-center">
                {error}
              </div>
            )}

            <button type="submit" disabled={isSubmitting} className="w-full py-6 btn-gradient-indigo text-white rounded-[1.5rem] font-bold tracking-[0.2em] uppercase hover:brightness-110 transition-silky shadow-2xl">
              {isSubmitting ? 'Processing...' : `Pay ${formData.amount || '0'} ${selectedCurrency} via PayPal`}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default QuickPayment;