import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check, ArrowRight, MessageSquare, UserPlus, FileText, CreditCard } from 'lucide-react';
import { useAuth } from './AuthContext';
import TimingRadarDashboard from './TimingRadarDashboard';

interface HealthStatus {
  status: string;
  integrations: {
    supabaseServer: boolean;
    supabaseClient: boolean;
    openrouter: boolean;
    freeAstrologyApi: boolean;
    dodoPayments: boolean;
    resend: boolean;
  };
}

const AppDashboardHome: React.FC = () => {
  const { appUser, stats } = useAuth();
  const [copied, setCopied] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch(() => null);
  }, []);

  const referralUrl = appUser
    ? `${window.location.origin}/app/login?ref=${appUser.referral_code}`
    : '';

  const copyReferral = async () => {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tierProfileLimit =
    appUser?.tier === 'guru' ? 200 : appUser?.tier === 'pro' ? 50 : 5;

  const tierLabel =
    appUser?.tier === 'guru'
      ? 'Guru Plan'
      : appUser?.tier === 'pro'
      ? 'Professional Plan'
      : 'Personal Plan';

  return (
    <div className="space-y-8">
      {/* Editorial Greeting Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#3D3830]/10 pb-8">
        <div>
          <p className="text-xs text-[#8B8275] mb-2">
            {tierLabel} · {appUser?.currency_pref || 'INR'} · {appUser?.email}
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-medium text-[#3D3830] tracking-tight">
            Welcome, {appUser?.full_name || 'Seeker'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5C5449] leading-relaxed">
            Your private Cosmic Council observatory is authenticated and ready. Manage birth chart profiles, track planetary timing phases, or open a multi-system consultation.
          </p>
        </div>

        <Link
          to="/app/chat"
          className="inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-6 py-3 text-sm font-medium text-[#FAF7F2] transition-colors hover:bg-[#38342E] whitespace-nowrap shrink-0"
        >
          <span>Open Chat Studio</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Personal Timing Radar (Observatory Night Surface) */}
      <TimingRadarDashboard />

      {/* Account Capacity & Balance Snapshot */}
      <section className="rounded-3xl bg-[#F1ECE3] p-7 md:p-8 border border-[#3D3830]/10 text-[#3D3830]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div>
            <p className="text-xs text-[#8B8275] mb-1.5">Account Snapshot</p>
            <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
              Balance & Capacity
            </h2>
            <p className="mt-1.5 text-sm text-[#5C5449] max-w-xl">
              Credits power multi-system Vedic consultations, profile chart activations, and deep research reports.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-6 md:gap-10">
            <div>
              <p className="text-xs text-[#8B8275] mb-1">Credits</p>
              <p className="font-['JetBrains_Mono',monospace] tabular-nums text-2xl md:text-3xl font-medium text-[#3D3830]">
                {(appUser?.credits_balance ?? 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8B8275] mb-1">Saved Profiles</p>
              <p className="font-['JetBrains_Mono',monospace] tabular-nums text-2xl md:text-3xl font-medium text-[#3D3830]">
                {stats.savedProfiles}
                <span className="text-sm text-[#8B8275]">/{tierProfileLimit}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8B8275] mb-1">Referrals</p>
              <p className="font-['JetBrains_Mono',monospace] tabular-nums text-2xl md:text-3xl font-medium text-[#3D3830]">
                {stats.successfulReferrals}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Primary Workspace Actions */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Link
          to="/app/profiles"
          className="group rounded-3xl bg-[#FDFBF7] p-6 border border-[#3D3830]/10 transition-all hover:bg-[#F1ECE3]"
        >
          <UserPlus className="h-5 w-5 text-[#5C5449] mb-4" />
          <h3 className="font-serif text-xl font-medium text-[#3D3830]">Birth Profiles</h3>
          <p className="mt-1.5 text-xs text-[#5C5449] leading-relaxed">
            Save birth details and activate AstroSage-calibrated Parashari, KP, and Jaimini charts.
          </p>
        </Link>

        <Link
          to="/app/chat"
          className="group rounded-3xl bg-[#FDFBF7] p-6 border border-[#3D3830]/10 transition-all hover:bg-[#F1ECE3]"
        >
          <MessageSquare className="h-5 w-5 text-[#5C5449] mb-4" />
          <h3 className="font-serif text-xl font-medium text-[#3D3830]">Consultation Chat</h3>
          <p className="mt-1.5 text-xs text-[#5C5449] leading-relaxed">
            Switch disciplines mid-chat, save custom prompts, and star insights per profile.
          </p>
        </Link>

        <Link
          to="/app/reports"
          className="group rounded-3xl bg-[#FDFBF7] p-6 border border-[#3D3830]/10 transition-all hover:bg-[#F1ECE3]"
        >
          <FileText className="h-5 w-5 text-[#5C5449] mb-4" />
          <h3 className="font-serif text-xl font-medium text-[#3D3830]">Research Reports</h3>
          <p className="mt-1.5 text-xs text-[#5C5449] leading-relaxed">
            Order multi-pass PDF reports and continue with interactive follow-up questions.
          </p>
        </Link>

        <Link
          to="/app/billing"
          className="group rounded-3xl bg-[#FDFBF7] p-6 border border-[#3D3830]/10 transition-all hover:bg-[#F1ECE3]"
        >
          <CreditCard className="h-5 w-5 text-[#5C5449] mb-4" />
          <h3 className="font-serif text-xl font-medium text-[#3D3830]">Credits & Tiers</h3>
          <p className="mt-1.5 text-xs text-[#5C5449] leading-relaxed">
            Top up credits starting at ₹1,000 or upgrade to Professional and Guru plans.
          </p>
        </Link>
      </section>

      {/* Referral & Environment Connection Strip */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-3xl bg-[#F1ECE3] p-6 border border-[#3D3830]/10">
          <h3 className="font-serif text-2xl font-medium text-[#3D3830]">Invite & Earn 5,000 Credits</h3>
          <p className="mt-1.5 text-xs text-[#5C5449] leading-relaxed">
            Share your personal link. When a friend signs up and completes their first paid credit purchase or profile activation, you both receive 5,000 credits.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={referralUrl}
              aria-label="Your referral link"
              className="flex-1 rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs font-['JetBrains_Mono',monospace] text-[#3D3830]"
            />
            <button
              type="button"
              onClick={copyReferral}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Link'}</span>
            </button>
          </div>
        </div>

        <div className="rounded-3xl bg-[#FDFBF7] p-6 border border-[#3D3830]/10">
          <h3 className="font-serif text-2xl font-medium text-[#3D3830]">Platform Environment Readiness</h3>
          <p className="mt-1 text-xs text-[#8B8275]">
            Backend key configuration status across upcoming rollout phases.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-[#3D3830]/10 pb-1.5">
              <span className="text-[#5C5449]">Supabase DB & Auth</span>
              <span className="font-['JetBrains_Mono',monospace] text-[#3D3830]">
                {health?.integrations.supabaseServer ? 'Ready' : 'Pending Key'}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-[#3D3830]/10 pb-1.5">
              <span className="text-[#5C5449]">FreeAstrologyAPI</span>
              <span className="font-['JetBrains_Mono',monospace] text-[#3D3830]">
                {health?.integrations.freeAstrologyApi ? 'Ready' : 'Phase 2'}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-[#3D3830]/10 pb-1.5">
              <span className="text-[#5C5449]">OpenRouter AI Council</span>
              <span className="font-['JetBrains_Mono',monospace] text-[#3D3830]">
                {health?.integrations.openrouter ? 'Ready' : 'Pending Key'}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-[#3D3830]/10 pb-1.5">
              <span className="text-[#5C5449]">Dodo Payments & Resend</span>
              <span className="font-['JetBrains_Mono',monospace] text-[#3D3830]">
                {health?.integrations.dodoPayments && health?.integrations.resend ? 'Ready' : 'Phase 4'}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AppDashboardHome;
