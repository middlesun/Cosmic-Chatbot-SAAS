import React, { useEffect, useState } from 'react';
import { Check, KeyRound, Save } from 'lucide-react';
import { useAuth } from './AuthContext';
import { getSupabaseClient } from '../../lib/supabaseClient';

const SettingsPage: React.FC = () => {
  const { appUser, getAccessToken, refreshUser } = useAuth();

  const [fullName, setFullName] = useState(appUser?.full_name || '');
  const [currencyPref, setCurrencyPref] = useState<'INR' | 'USD' | 'AED' | 'EUR'>(
    appUser?.currency_pref || 'INR'
  );
  const [defaultExpert, setDefaultExpert] = useState(
    appUser?.default_expert || 'council_synthesis'
  );
  const [defaultOutput, setDefaultOutput] = useState(
    appUser?.default_output || 'detailed'
  );
  const [defaultLanguage, setDefaultLanguage] = useState(
    appUser?.default_language || 'English'
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    if (appUser) {
      setFullName(appUser.full_name || '');
      setCurrencyPref(appUser.currency_pref || 'INR');
      setDefaultExpert(appUser.default_expert || 'council_synthesis');
      setDefaultOutput(appUser.default_output || 'detailed');
      setDefaultLanguage(appUser.default_language || 'English');
    }
  }, [appUser]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage(null);
    setErrorMessage(null);
    setIsSaving(true);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');

      const res = await fetch('/api/app/me/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          currency_pref: currencyPref,
          default_expert: defaultExpert,
          default_output: defaultOutput,
          default_language: defaultLanguage,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save settings');

      await refreshUser();
      setSaveMessage('Consultation defaults and account preferences saved.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendPasswordReset = async () => {
    setResetMessage(null);
    const supabase = getSupabaseClient();
    if (!supabase || !appUser?.email) return;

    const { error } = await supabase.auth.resetPasswordForEmail(appUser.email, {
      redirectTo: `${window.location.origin}/app/dashboard`,
    });

    if (error) {
      setResetMessage(error.message);
    } else {
      setResetMessage(`Password reset link sent to ${appUser.email}.`);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <section className="border-b border-[#3D3830]/10 pb-6">
        <p className="text-xs text-[#8B8275] mb-2">
          Account & Consultation Preferences
        </p>
        <h1 className="font-serif text-4xl font-medium text-[#3D3830] tracking-tight">
          Settings
        </h1>
        <p className="mt-2 text-sm text-[#5C5449]">
          Configure your default astrological council discipline, output format, language, and billing currency.
        </p>
      </section>

      <form
        onSubmit={handleSave}
        className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-6 md:p-8 space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:outline-none focus:border-[#3D3830]/40"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
              Preferred Billing Currency
            </label>
            <select
              value={currencyPref}
              onChange={(e) =>
                setCurrencyPref(e.target.value as 'INR' | 'USD' | 'AED' | 'EUR')
              }
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:outline-none focus:border-[#3D3830]/40"
            >
              <option value="INR">INR (₹ Indian Rupee)</option>
              <option value="USD">USD ($ US Dollar)</option>
              <option value="AED">AED (UAE Dirham)</option>
              <option value="EUR">EUR (€ Euro)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2 border-t border-[#3D3830]/8">
          <div>
            <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
              Default Council Expert
            </label>
            <select
              value={defaultExpert}
              onChange={(e) => setDefaultExpert(e.target.value)}
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:outline-none"
            >
              <option value="council_synthesis">Council Synthesis</option>
              <option value="parashari">Parashari Strategist</option>
              <option value="kp_precision">KP Precision Analyst</option>
              <option value="jaimini">Jaimini & Karma Reader</option>
              <option value="nadi">Nadi Synthesizer</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
              Default Output Format
            </label>
            <select
              value={defaultOutput}
              onChange={(e) => setDefaultOutput(e.target.value)}
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:outline-none"
            >
              <option value="detailed">Detailed Explanation</option>
              <option value="concise">Concise Summary</option>
              <option value="bullets">Structured Bullet Points</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
              Default Language
            </label>
            <select
              value={defaultLanguage}
              onChange={(e) => setDefaultLanguage(e.target.value)}
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:outline-none"
            >
              <option value="English">English</option>
              <option value="Hindi">Hindi (हिन्दी)</option>
              <option value="Hinglish">Hinglish</option>
            </select>
          </div>
        </div>

        {saveMessage && (
          <div className="flex items-center gap-2 rounded-2xl bg-[#F1ECE3] px-4 py-3 text-xs text-[#3D3830]">
            <Check className="h-4 w-4 text-[#2D6A4F]" />
            <span>{saveMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl bg-[#7A3E36]/10 px-4 py-3 text-xs text-[#7A3E36]">
            {errorMessage}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-6 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Preferences'}</span>
          </button>
        </div>
      </form>

      {/* Account Security Card */}
      <section className="rounded-3xl bg-[#F1ECE3] border border-[#3D3830]/10 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-serif text-xl font-medium text-[#3D3830]">
            Account Credentials
          </h2>
          <p className="text-xs text-[#5C5449]">
            Signed in as <span className="font-medium text-[#3D3830]">{appUser?.email}</span> · Referral Code:{' '}
            <span className="font-['JetBrains_Mono',monospace] text-[#3D3830]">
              {appUser?.referral_code}
            </span>
          </p>
          {resetMessage && (
            <p className="text-xs text-[#3D3830] pt-1">{resetMessage}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleSendPasswordReset()}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/20 bg-[#FAF7F2] px-4 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#FDFBF7] shrink-0"
        >
          <KeyRound className="h-3.5 w-3.5" />
          <span>Send Password Reset Email</span>
        </button>
      </section>
    </div>
  );
};

export default SettingsPage;
