import React, { useEffect, useState } from 'react';
import { Check, KeyRound, Loader2, Settings2, X } from 'lucide-react';
import { useAuth, type AstrologyMode } from './AuthContext';
import { getSupabaseClient } from '../../lib/supabaseClient';
import AstrologyModeToggle from './AstrologyModeToggle';
import CustomSelect from './CustomSelect';
import UserAvatar from './UserAvatar';
import type { ChatCatalog } from './chatTypes';
import type { ChatFontSize } from './ChatSettingsModal';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FALLBACK_EXPERTS = [
  { value: 'council_synthesis', label: 'Vedic Astrologer' },
  { value: 'western_astrologer', label: 'Western Astrologer' },
  { value: 'modern_astrologer', label: 'Modern Astrologer' },
  { value: 'tarot_reader', label: 'Tarot' },
  { value: 'numerologist', label: 'Numerology' },
  { value: 'learn_astrology', label: 'Learn Astrology' },
];

const FALLBACK_LANGUAGES = [
  { value: 'English', label: 'English' },
  { value: 'Hindi', label: 'Hindi (हिन्दी)' },
  { value: 'Hinglish', label: 'Hinglish' },
];

const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { appUser, isPreviewMode, getAccessToken, refreshUser, setAstrologyMode } = useAuth();
  const [catalog, setCatalog] = useState<ChatCatalog | null>(null);

  const [fullName, setFullName] = useState(appUser?.full_name || '');
  const [callName, setCallName] = useState(appUser?.preferred_call_name || '');
  const [fontSize, setFontSize] = useState<ChatFontSize>(appUser?.chat_font_size || 'base');
  const [defaultAstrologyMode, setDefaultAstrologyMode] = useState<AstrologyMode>(
    appUser?.default_astrology_mode === 'western' ? 'western' : 'vedic'
  );
  const [currencyPref, setCurrencyPref] = useState<'INR' | 'USD' | 'AED' | 'EUR'>(
    appUser?.currency_pref || 'INR'
  );
  const [defaultExpert, setDefaultExpert] = useState(
    appUser?.default_expert || 'council_synthesis'
  );
  const [defaultLanguage, setDefaultLanguage] = useState(
    appUser?.default_language || 'English'
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && appUser) {
      setFullName(appUser.full_name || '');
      setCallName(appUser.preferred_call_name || '');
      setFontSize(appUser.chat_font_size || 'base');
      setDefaultAstrologyMode(
        appUser.default_astrology_mode === 'western' ? 'western' : 'vedic'
      );
      setCurrencyPref(appUser.currency_pref || 'INR');
      setDefaultExpert(appUser.default_expert || 'council_synthesis');
      setDefaultLanguage(appUser.default_language || 'English');
      setError(null);
      setSaveMessage(null);
      setResetMessage(null);
    }
  }, [isOpen, appUser]);

  useEffect(() => {
    if (!isOpen || isPreviewMode) return;
    let active = true;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await fetch('/api/chat/config', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && active) {
          const data = await res.json();
          if (data.catalog) setCatalog(data.catalog);
        }
      } catch {
        // Fallback options used cleanly
      }
    })();
    return () => {
      active = false;
    };
  }, [isOpen, isPreviewMode, getAccessToken]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaveMessage(null);

    if (isPreviewMode) {
      setAstrologyMode(defaultAstrologyMode);
      setSaveMessage('Preview mode: Sign in to save permanent account preferences.');
      return;
    }

    setSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Please sign in to save settings.');

      const res = await fetch('/api/app/me/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          preferred_call_name: callName.trim(),
          chat_font_size: fontSize,
          default_astrology_mode: defaultAstrologyMode,
          currency_pref: currencyPref,
          default_expert: defaultExpert,
          default_language: defaultLanguage,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save settings.');

      setAstrologyMode(defaultAstrologyMode);
      await refreshUser();
      setSaveMessage('Settings and defaults saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendPasswordReset = async () => {
    setResetMessage(null);
    if (isPreviewMode) {
      setResetMessage('Preview mode: Sign in to manage account security.');
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase || !appUser?.email) return;

    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(appUser.email, {
      redirectTo: `${window.location.origin}/app/chat`,
    });
    if (resetErr) {
      setResetMessage(resetErr.message);
    } else {
      setResetMessage(`Password reset link sent to ${appUser.email}.`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2229]/45 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-cc-drawer-in w-full max-w-lg rounded-3xl border border-[#3D3830]/15 bg-[#FAF7F2] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 bg-[#F1ECE3] border-b border-[#3D3830]/10">
          <div className="flex items-center gap-2.5">
            <Settings2 className="h-5 w-5 text-[#8B7355]" />
            <div>
              <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                Settings
              </h2>
              <p className="text-[11px] text-[#8B8275]">
                Account profile, consultation defaults, language, and display
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-2 rounded-full text-[#8B8275] hover:text-[#3D3830] hover:bg-[#3D3830]/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[80dvh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-2.5 text-sm text-[#3D3830] focus:border-[#4A453D] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                Personal Call Name
              </label>
              <input
                type="text"
                value={callName}
                onChange={(e) => setCallName(e.target.value)}
                maxLength={60}
                placeholder="What should we call you?"
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-2.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#4A453D] focus:outline-none"
              />
            </div>
          </div>

          {/* Default Astrology Mode: Vedic | Western */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-[#F1ECE3]/75 border border-[#3D3830]/10 p-4">
            <div>
              <p className="text-xs font-medium text-[#3D3830]">Default Astrology Mode</p>
              <p className="text-[11px] text-[#8B8275] mt-0.5">
                Sets default chart view, readings, and default astrologer alignment.
              </p>
            </div>
            <AstrologyModeToggle
              value={defaultAstrologyMode}
              onChange={(mode) => {
                setDefaultAstrologyMode(mode);
                if (mode === 'western' && defaultExpert === 'council_synthesis') {
                  setDefaultExpert('western_astrologer');
                } else if (mode === 'vedic' && defaultExpert === 'western_astrologer') {
                  setDefaultExpert('council_synthesis');
                }
              }}
              size="sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                Billing Currency
              </label>
              <CustomSelect
                value={currencyPref}
                onChange={(val) =>
                  setCurrencyPref(val as 'INR' | 'USD' | 'AED' | 'EUR')
                }
                ariaLabel="Billing Currency"
                size="md"
                surface="elevated"
                className="w-full"
                options={[
                  { value: 'INR', label: 'INR (₹ Indian Rupee)' },
                  { value: 'USD', label: 'USD ($ US Dollar)' },
                  { value: 'AED', label: 'AED (UAE Dirham)' },
                  { value: 'EUR', label: 'EUR (€ Euro)' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                Default Astrologer
              </label>
              <CustomSelect
                value={defaultExpert}
                onChange={setDefaultExpert}
                ariaLabel="Default Astrologer"
                size="md"
                surface="elevated"
                className="w-full"
                options={
                  catalog?.experts.length
                    ? catalog.experts.map((o) => ({ value: o.slug, label: o.displayName }))
                    : FALLBACK_EXPERTS
                }
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
              Default Language
            </label>
            <CustomSelect
              value={defaultLanguage}
              onChange={setDefaultLanguage}
              ariaLabel="Default Language"
              size="md"
              surface="elevated"
              className="w-full"
              options={
                catalog?.languages.length
                  ? catalog.languages.map((o) => ({ value: o.slug, label: o.displayName }))
                  : FALLBACK_LANGUAGES
              }
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
              Reading Font Size
            </label>
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#F1ECE3] p-1 border border-[#3D3830]/10">
              {(
                [
                  { id: 'sm', label: 'Compact' },
                  { id: 'base', label: 'Balanced' },
                  { id: 'lg', label: 'Large' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFontSize(opt.id)}
                  className={`rounded-xl py-2 text-xs font-medium transition-colors ${
                    fontSize === opt.id
                      ? 'bg-[#4A453D] text-[#FAF7F2]'
                      : 'text-[#5C5449] hover:text-[#3D3830]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Account Security strip */}
          <div className="rounded-2xl bg-[#F1ECE3]/75 border border-[#3D3830]/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <UserAvatar size="md" />
              <div className="text-xs text-[#5C5449] min-w-0">
                <p className="font-medium text-[#3D3830] truncate">{appUser?.email}</p>
                <p className="font-['DM_Sans',sans-serif] text-[11px]">
                  Referral: {appUser?.referral_code}
                </p>
                {resetMessage && <p className="mt-1 text-[#3D3830]">{resetMessage}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleSendPasswordReset()}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/20 bg-[#FDFBF7] px-3.5 py-2 text-[11px] font-medium text-[#3D3830] hover:bg-[#FAF7F2] shrink-0"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Password Reset</span>
            </button>
          </div>

          {error && (
            <p className="rounded-xl bg-[#7A3E36]/10 px-3.5 py-2.5 text-xs text-[#7A3E36]">
              {error}
            </p>
          )}

          {saveMessage && (
            <p className="rounded-xl bg-[#2D6A4F]/10 border border-[#2D6A4F]/20 px-3.5 py-2.5 text-xs text-[#2D6A4F]">
              {saveMessage}
            </p>
          )}

          <div className="pt-2 border-t border-[#3D3830]/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830]"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccountSettingsModal;
