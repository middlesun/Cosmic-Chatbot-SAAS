import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface ContactFormProps {
  onBack: () => void;
}

const ContactForm: React.FC<ContactFormProps> = ({ onBack }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    botcheck: ''
  });
  const [myChart, setMyChart] = useState<File | null>(null);
  const [secondChart, setSecondChart] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          subject: `New Contact Message: ${formData.subject}`,
          Name: formData.name,
          Email: formData.email,
          Subject: formData.subject,
          Message: formData.message,
          botcheck: formData.botcheck,
          My_Chart: myChart ? myChart.name : "None",
          Second_Person_Chart: secondChart ? secondChart.name : "None"
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setSubmittedEmail(formData.email);
        setSubmitted(true);
        setFormData({ name: '', email: '', subject: '', message: '', botcheck: '' });
        setMyChart(null);
        setSecondChart(null);
      } else {
        setError(data.message || "Failed to send message. Please try again.");
      }
    } catch (err) {
      console.error("Contact Form submission error:", err);
      setError("A network error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center animate-slide-up-fade">
        <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-10 shadow-xl shadow-emerald-100/50 animate-bounce">
          <svg className="w-12 h-12 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-serif text-4xl text-indigo-950 font-bold mb-6">Message Received</h2>
        <p className="text-slate-500 text-lg font-light leading-relaxed mb-12">
          Your inquiry has been encrypted and delivered to me. Expect a response to <span className="text-indigo-900 font-semibold">{submittedEmail}</span> within 2-3 Days.
        </p>
        <button 
          onClick={onBack}
          className="px-12 py-5 btn-gradient-indigo text-white rounded-[1.5rem] font-bold tracking-widest uppercase hover:brightness-110 active:scale-95 transition-silky shadow-2xl shadow-indigo-200"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-[#7c6d5e]/70 uppercase tracking-widest mb-6">
        <span className="hover:text-indigo-950 cursor-pointer transition-colors" onClick={() => navigate('/')}>Home</span>
        <span>/</span>
        <span className="text-indigo-950 font-bold">Contact</span>
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

      <div className="bg-white rounded-[3rem] border border-indigo-50 shadow-2xl overflow-hidden animate-slide-up-fade">
        <div className="p-12 bg-indigo-950 text-white border-b border-white/10">
          <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-soft-gold mb-4">I'm always happy to hear from you</p>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold uppercase">contact me</h1>
        </div>

        <form onSubmit={handleSubmit} className="p-10 md:p-12 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full p-5 bg-indigo-50/20 border-2 border-indigo-50 rounded-2xl text-base focus:outline-none transition-silky" placeholder="Full Name" />
            <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full p-5 bg-indigo-50/20 border-2 border-indigo-50 rounded-2xl text-base focus:outline-none transition-silky" placeholder="Email Address" />
          </div>

          <input type="text" required value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})} className="w-full p-5 bg-indigo-50/20 border-2 border-indigo-50 rounded-2xl text-base focus:outline-none transition-silky" placeholder="Subject" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-indigo-50/20 rounded-2xl border border-indigo-100">
            <div>
              <label className="text-[9px] uppercase font-bold text-indigo-300 tracking-[0.2em] mb-2 block">My Chart (Image/PDF)</label>
              <input type="file" accept="image/*,.pdf" onChange={(e) => setMyChart(e.target.files?.[0] || null)} className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-white file:text-indigo-700 hover:file:bg-indigo-50 transition-silky" />
            </div>
            <div>
              <label className="text-[9px] uppercase font-bold text-indigo-300 tracking-[0.2em] mb-2 block">Second person's Chart</label>
              <input type="file" accept="image/*,.pdf" onChange={(e) => setSecondChart(e.target.files?.[0] || null)} className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-white file:text-indigo-700 hover:file:bg-indigo-50 transition-silky" />
            </div>
          </div>

          <textarea required value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})} className="w-full p-6 bg-indigo-50/20 border-2 border-indigo-50 rounded-[2rem] text-base focus:outline-none transition-silky min-h-[160px] resize-none" placeholder="Your Message..." />

          <input 
            type="text" 
            name="botcheck" 
            value={formData.botcheck} 
            onChange={(e) => setFormData({...formData, botcheck: e.target.value})} 
            className="hidden" 
            style={{ display: "none" }} 
          />

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 font-bold text-sm text-center">
              {error}
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className={`w-full py-6 btn-gradient-indigo text-white rounded-[1.5rem] font-bold tracking-[0.2em] uppercase hover:brightness-110 active:scale-[0.98] transition-silky shadow-2xl shadow-indigo-200 flex items-center justify-center gap-4 group ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}>
            {isSubmitting ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ContactForm;