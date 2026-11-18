import React, { useState } from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { useAuth } from './AuthContext';

interface SetPasswordModalProps {
  mode: 'onboarding' | 'recovery';
}

const SetPasswordModal: React.FC<SetPasswordModalProps> = ({ mode }) => {
  const { refreshUser, clearPasswordRecovery, getAccessToken } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setError('Supabase client is not configured.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        setError(updateErr.message);
        setSubmitting(false);
        return;
      }

      const token = await getAccessToken();
      if (token) {
        await fetch('/api/app/me/password-completed', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      setDone(true);
      await refreshUser();
      clearPasswordRecovery();
    } catch {
      setError('Unexpected error updating password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2229]/60 backdrop-blur-sm p-4 font-['Plus_Jakarta_Sans',sans-serif]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="set-password-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-[#FAF7F2] p-8 shadow-2xl border border-[#3D3830]/10">
        <div className="mb-6 flex items-center gap-3 text-[#3D3830]">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F1ECE3] text-[#4A453D]">
            {done ? <CheckCircle2 className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </div>
          <div>
            <h2 id="set-password-title" className="font-serif text-2xl font-medium text-[#3D3830]">
              {mode === 'onboarding' ? 'Set Your Account Password' : 'Reset Your Password'}
            </h2>
            <p className="text-xs text-[#8B8275]">
              {mode === 'onboarding'
                ? 'Welcome to Cosmic Council. Secure your invited account before continuing.'
                : 'Choose a new password for your Cosmic Council account.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="block text-xs font-medium text-[#5C5449] mb-1.5">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-4 py-3 text-sm text-[#3D3830] placeholder:text-[#8B8275]/60 focus:border-[#4A453D] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-xs font-medium text-[#5C5449] mb-1.5">
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-4 py-3 text-sm text-[#3D3830] placeholder:text-[#8B8275]/60 focus:border-[#4A453D] focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-xs font-medium text-[#A94438] bg-[#A94438]/10 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-[#4A453D] px-6 py-3 text-sm font-medium text-[#FAF7F2] transition-colors hover:bg-[#38342E] disabled:opacity-60"
          >
            {submitting ? 'Saving Password...' : 'Save Password & Enter Studio'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetPasswordModal;
