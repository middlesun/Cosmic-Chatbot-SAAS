import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getSupabaseClient, loadSupabasePublicConfig } from '../../lib/supabaseClient';
import { useAuth, getPendingReferral, storePendingReferral } from './AuthContext';

type AuthView = 'signin' | 'signup' | 'forgot';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { session, isLoading, enterPreviewMode } = useAuth();

  const [view, setView] = useState<AuthView>('signin');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [referralCode, setReferralCode] = useState(() => getPendingReferral() || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && session) {
      navigate('/app/home', { replace: true });
    }
  }, [isLoading, session, navigate]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const oauthErrDesc =
      hashParams.get('error_description') ||
      searchParams.get('error_description') ||
      hashParams.get('error') ||
      searchParams.get('error');
    if (oauthErrDesc) {
      setError(oauthErrDesc.replace(/\+/g, ' '));
    }
  }, []);

  const handleGoogleLogin = async () => {
    setError(null);
    setSubmitting(true);

    let supabase = getSupabaseClient();
    if (!supabase) {
      await loadSupabasePublicConfig();
      supabase = getSupabaseClient();
    }

    if (!supabase) {
      setError('Authentication is temporarily unavailable. Please verify Supabase public environment variables.');
      setSubmitting(false);
      return;
    }

    if (referralCode.trim()) {
      storePendingReferral(referralCode.trim());
    }

    const redirectTo = `${window.location.origin}/app/home`;
    const isInIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    if (isInIframe) {
      const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (oauthErr || !data?.url) {
        setError(oauthErr?.message || 'Unable to start Google sign-in.');
        setSubmitting(false);
        return;
      }
      try {
        window.top?.location.assign(data.url);
      } catch {
        window.location.assign(data.url);
      }
      return;
    }

    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });
    if (oauthErr) {
      setError(oauthErr.message);
      setSubmitting(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    let supabase = getSupabaseClient();
    if (!supabase) {
      await loadSupabasePublicConfig();
      supabase = getSupabaseClient();
    }

    if (!supabase) {
      setError('Authentication is temporarily unavailable. Please verify Supabase public environment variables.');
      setSubmitting(false);
      return;
    }

    try {
      if (view === 'signin') {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInErr) {
          setError(signInErr.message);
        } else {
          navigate('/app/home');
        }
      } else if (view === 'signup') {
        if (password.length < 8) {
          setError('Password must be at least 8 characters.');
          setSubmitting(false);
          return;
        }
        if (referralCode.trim()) {
          storePendingReferral(referralCode.trim());
        }
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app/home`,
            data: {
              full_name: fullName.trim() || email.split('@')[0],
              referral_code: referralCode.trim().toUpperCase() || undefined,
            },
          },
        });
        if (signUpErr) {
          setError(signUpErr.message);
        } else if (data.session) {
          navigate('/app/home');
        } else {
          setNotice('Check your email for the confirmation link to activate your account.');
        }
      } else if (view === 'forgot') {
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/app/home`,
        });
        if (resetErr) {
          setError(resetErr.message);
        } else {
          setNotice('Password reset instructions have been sent to your email.');
        }
      }
    } catch {
      setError('Unexpected authentication error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#3D3830] font-['Plus_Jakarta_Sans',sans-serif] flex flex-col">
      {/* Minimal Frosted Top Bar */}
      <header className="sticky top-0 z-20 mx-auto w-full max-w-6xl px-6 pt-5">
        <div className="flex items-center justify-between rounded-2xl bg-[#EAE3D7]/70 backdrop-blur-md px-6 py-3.5 border border-[#3D3830]/10">
          <Link
            to="/"
            className="font-serif text-xl font-medium tracking-tight text-[#3D3830] whitespace-nowrap shrink-0"
          >
            Cosmic Council
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Return to main site
          </Link>
        </div>
      </header>

      {/* Main Auth Container */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-3xl bg-[#FDFBF7] p-8 md:p-10 shadow-[0_20px_50px_-20px_rgba(61,56,48,0.12)] border border-[#3D3830]/10">
          <div className="mb-8 text-center">
            <h1 className="font-serif text-3xl md:text-4xl font-medium text-[#3D3830] tracking-tight">
              {view === 'signin' && 'Enter CosmicCouncil'}
              {view === 'signup' && 'Create Your Account'}
              {view === 'forgot' && 'Reset Password'}
            </h1>
            <p className="mt-2 text-sm text-[#5C5449] leading-relaxed">
              {view === 'signin' && 'Access your saved birth charts, consultation threads, and reports.'}
              {view === 'signup' && 'Save profiles, track planetary timing, and consult the AI Council.'}
              {view === 'forgot' && 'Enter your email address to receive a secure password reset link.'}
            </p>
          </div>

          {view !== 'forgot' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-3 rounded-full bg-[#4A453D] px-6 py-4 text-sm font-medium text-[#FAF7F2] shadow-[0_12px_28px_-12px_rgba(61,56,48,0.45)] transition-all duration-200 hover:bg-[#38342E] hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 whitespace-nowrap"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                  />
                </svg>
                <span>Continue with Gmail</span>
              </button>

              <div className="flex items-center gap-3 pt-1">
                <div className="h-px flex-1 bg-[#3D3830]/10" />
                <span className="text-[11px] text-[#8B8275]">or</span>
                <div className="h-px flex-1 bg-[#3D3830]/10" />
              </div>

              {!showEmailForm && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setNotice(null);
                    setShowEmailForm(true);
                  }}
                  className="w-full rounded-full border border-[#3D3830]/15 bg-transparent px-5 py-2.5 text-xs font-medium text-[#5C5449] transition-colors hover:bg-[#F1ECE3]/70 hover:text-[#3D3830]"
                >
                  Use email &amp; password instead
                </button>
              )}
            </div>
          )}

          {error && !showEmailForm && view !== 'forgot' && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#A94438]/10 px-3.5 py-2.5 text-xs font-medium text-[#A94438]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {(showEmailForm || view === 'forgot') && (
            <div className="mt-4 pt-2 animate-cc-tab-panel">
              <form onSubmit={handleEmailAuth} className="space-y-3.5">
                {view === 'signup' && (
                  <div>
                    <label htmlFor="auth-fullname" className="block text-xs font-medium text-[#5C5449] mb-1.5">
                      Full Name
                    </label>
                    <input
                      id="auth-fullname"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your name"
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-4 py-2.5 text-sm text-[#3D3830] placeholder:text-[#8B8275]/70 focus:border-[#4A453D] focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="auth-email" className="block text-xs font-medium text-[#5C5449] mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#8B8275]" />
                    <input
                      id="auth-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] pl-10 pr-4 py-2.5 text-sm text-[#3D3830] placeholder:text-[#8B8275]/70 focus:border-[#4A453D] focus:outline-none"
                    />
                  </div>
                </div>

                {view !== 'forgot' && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="auth-password" className="text-xs font-medium text-[#5C5449]">
                        Password
                      </label>
                      {view === 'signin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setNotice(null);
                            setView('forgot');
                          }}
                          className="text-xs text-[#8B8275] hover:text-[#3D3830] underline underline-offset-4"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#8B8275]" />
                      <input
                        id="auth-password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={view === 'signup' ? 'Minimum 8 characters' : 'Enter password'}
                        className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] pl-10 pr-4 py-2.5 text-sm text-[#3D3830] placeholder:text-[#8B8275]/70 focus:border-[#4A453D] focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {view === 'signup' && (
                  <div>
                    <label htmlFor="auth-referral" className="block text-xs font-medium text-[#5C5449] mb-1.5">
                      Referral Code (Optional)
                    </label>
                    <input
                      id="auth-referral"
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value)}
                      placeholder="CC-XXXXXX"
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-4 py-2.5 text-sm font-['DM_Sans',sans-serif] text-[#3D3830] placeholder:text-[#8B8275]/70 focus:border-[#4A453D] focus:outline-none uppercase"
                    />
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 rounded-xl bg-[#A94438]/10 px-3.5 py-2.5 text-xs font-medium text-[#A94438]">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {notice && (
                  <div className="flex items-start gap-2 rounded-xl bg-[#5B7056]/10 px-3.5 py-2.5 text-xs font-medium text-[#465941]">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{notice}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full border border-[#3D3830]/20 bg-[#F1ECE3] px-6 py-2.5 text-xs font-medium text-[#3D3830] transition-colors hover:bg-[#E7E0D3] disabled:opacity-50"
                >
                  {submitting
                    ? 'Please wait...'
                    : view === 'signin'
                    ? 'Sign In with Email'
                    : view === 'signup'
                    ? 'Create Account with Email'
                    : 'Send Reset Link'}
                </button>
              </form>

              <div className="mt-4 text-center text-xs text-[#5C5449]">
                {view === 'signin' && (
                  <>
                    Using email?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setNotice(null);
                        setView('signup');
                      }}
                      className="font-medium text-[#3D3830] underline underline-offset-4"
                    >
                      Create an account
                    </button>
                  </>
                )}
                {view === 'signup' && (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setNotice(null);
                        setView('signin');
                      }}
                      className="font-medium text-[#3D3830] underline underline-offset-4"
                    >
                      Sign in
                    </button>
                  </>
                )}
                {view === 'forgot' && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setNotice(null);
                      setView('signin');
                    }}
                    className="font-medium text-[#3D3830] underline underline-offset-4"
                  >
                    Back to Sign In
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="mt-7 pt-5 border-t border-[#3D3830]/10 text-center">
            <button
              type="button"
              onClick={() => {
                enterPreviewMode();
                navigate('/app/home');
              }}
              className="w-full rounded-full border border-[#3D3830]/15 bg-transparent px-5 py-2.5 text-xs font-medium text-[#5C5449] transition-colors hover:bg-[#F1ECE3]/70 hover:text-[#3D3830]"
            >
              Preview without login
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AuthPage;
