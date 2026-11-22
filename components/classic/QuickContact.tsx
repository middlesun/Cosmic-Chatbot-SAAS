import React, { useState } from 'react';

const QuickContact: React.FC = () => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '', botcheck: '' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMessage('');
    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          access_key: import.meta.env.VITE_WEB3FORMS_ACCESS_KEY,
          subject: 'Query',
          Name: formData.name,
          Email: formData.email,
          Message: formData.message,
          botcheck: formData.botcheck
        }),
      });
      const data = await response.json();
      if (data.success) {
        setStatus('success');
        setFormData({ name: '', email: '', message: '', botcheck: '' });
        setTimeout(() => setStatus('idle'), 5000);
      } else {
        setStatus('error');
        setErrorMessage(data.message || 'Failed to send message. Please try again.');
        setTimeout(() => setStatus('idle'), 5000);
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage('A network error occurred. Please try again.');
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-6 pt-20 mb-24">
      <div className="p-8 md:p-10 bg-white rounded-[2.5rem] border border-indigo-50 shadow-xl relative overflow-hidden">
        {status === 'success' ? (
          <div className="flex flex-col items-center justify-center py-10 animate-fade-in text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-100/50 animate-bounce">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-indigo-950 font-serif text-xl">Message Sent Successfully</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <p className="text-[9px] uppercase font-bold tracking-[0.3em] text-indigo-300 mb-2">Have a quick question?</p>
              <h3 className="font-serif text-2xl text-indigo-950 font-semibold">Quick Contact</h3>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input 
                  type="text" required placeholder="Name"
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-5 py-4 bg-indigo-50/20 border border-indigo-50 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-silky"
                />
                <input 
                  type="email" required placeholder="Email"
                  value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full px-5 py-4 bg-indigo-50/20 border border-indigo-50 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-silky"
                />
              </div>
              <textarea 
                required placeholder="Message"
                value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})}
                className="w-full px-5 py-4 bg-indigo-50/20 border border-indigo-50 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-silky min-h-[100px] resize-none"
              />
              <input 
                type="text" 
                name="botcheck" 
                value={formData.botcheck} 
                onChange={e => setFormData({...formData, botcheck: e.target.value})} 
                className="hidden" 
                style={{ display: "none" }} 
              />
              {status === 'error' && (
                <p className="text-xs text-rose-500 font-bold mt-2 text-center">{errorMessage}</p>
              )}
              <button 
                type="submit" disabled={status === 'submitting'}
                className="w-full py-4 btn-gradient-indigo text-white rounded-2xl font-bold tracking-widest uppercase hover:brightness-110 active:scale-95 transition-silky shadow-lg shadow-indigo-100 text-xs"
              >
                {status === 'submitting' ? 'Sending...' : 'Send message'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default QuickContact;