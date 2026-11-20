import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, LifeBuoy, Loader2, Send, X } from 'lucide-react';
import CustomSelect from './CustomSelect';
import { useAuth } from './AuthContext';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SUPPORT_TOPICS = [
  { value: 'General Support', label: 'General Support' },
  { value: 'Account & Credits', label: 'Account & Credits' },
  { value: 'Chart & Readings', label: 'Chart & Readings' },
  { value: 'Billing & Invoices', label: 'Billing & Invoices' },
  { value: 'Professional / Business', label: 'Professional / Business' },
  { value: 'Feature request', label: 'Feature request' },
  { value: 'Bug Report', label: 'Technical Issue / Bug' },
];

const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const { appUser, isPreviewMode, getAccessToken } = useAuth();
  const [name, setName] = useState(
    appUser?.preferred_call_name?.trim() || appUser?.full_name?.trim() || ''
  );
  const nameTouchedRef = useRef(false);
  const [email, setEmail] = useState(appUser?.email || '');
  const [category, setCategory] = useState('General Support');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const baseFallback =
      appUser?.preferred_call_name?.trim() || appUser?.full_name?.trim() || '';
    setName(baseFallback);
    nameTouchedRef.current = false;
    setEmail(appUser?.email || '');
    setError(null);
    setSuccessMsg(null);

    if (isPreviewMode) {
      return;
    }

    (async () => {
      try {
        const token = await getAccessToken();
        if (!token || !active) return;
        const res = await fetch('/api/profiles', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || !active) return;
        const data = await res.json();
        const profiles = (data.profiles || []) as Array<{ name?: string; is_default?: boolean }>;
        const youProfile = profiles.find((p) => p.is_default);
        const preferredName =
          youProfile?.name?.trim() ||
          appUser?.preferred_call_name?.trim() ||
          appUser?.full_name?.trim() ||
          '';
        if (preferredName && active) {
          setName((prev) => (nameTouchedRef.current ? prev : preferredName));
        }
      } catch {
        // Keep base fallback cleanly
      }
    })();

    return () => {
      active = false;
    };
  }, [isOpen, isPreviewMode, getAccessToken, appUser?.preferred_call_name, appUser?.full_name, appUser?.email]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!subject.trim() || !message.trim()) {
      setError('Please enter both a subject and your message.');
      return;
    }

    if (isPreviewMode) {
      setSuccessMsg(
        'Preview mode: Sign in to submit a live inquiry to Cosmic Council support.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required.');

      const res = await fetch('/api/app/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: (appUser?.email || email).trim(),
          category,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Could not send support inquiry.');
      }

      setSuccessMsg(
        data.message || 'Your message has been sent to Cosmic Council support.'
      );
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send support message.');
    } finally {
      setSubmitting(false);
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
            <LifeBuoy className="h-5 w-5 text-[#8B7355]" />
            <div>
              <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                Support
              </h2>
              <p className="text-[11px] text-[#8B8275]">
                Reach Cosmic Council business &amp; technical support
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close support modal"
            className="p-2 rounded-full text-[#8B8275] hover:text-[#3D3830] hover:bg-[#3D3830]/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80dvh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  nameTouchedRef.current = true;
                  setName(e.target.value);
                }}
                required
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-2.5 text-sm text-[#3D3830] focus:border-[#4A453D] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                Reply Email
              </label>
              <input
                type="email"
                value={email}
                readOnly
                aria-readonly="true"
                className="w-full rounded-xl border border-[#3D3830]/12 bg-[#F1ECE3]/80 px-3.5 py-2.5 text-sm text-[#5C5449] cursor-not-allowed focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
              Topic
            </label>
            <CustomSelect
              value={category}
              onChange={setCategory}
              ariaLabel="Support topic"
              size="md"
              surface="elevated"
              className="w-full"
              options={SUPPORT_TOPICS}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={140}
              required
              placeholder="Brief summary of your question or request"
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-2.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#4A453D] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
              Message
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={4000}
              required
              placeholder="Share details so our team can help quickly..."
              className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3.5 text-sm text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#4A453D] focus:outline-none resize-none"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-[#7A3E36]/10 px-3.5 py-2.5 text-xs text-[#7A3E36]">
              {error}
            </p>
          )}

          {successMsg && (
            <div className="flex items-start gap-2 rounded-xl bg-[#2D6A4F]/10 border border-[#2D6A4F]/20 px-3.5 py-2.5 text-xs text-[#2D6A4F]">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
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
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>{submitting ? 'Sending...' : 'Send Message'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupportModal;
