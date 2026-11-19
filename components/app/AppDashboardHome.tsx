import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageSquare, UserPlus, FileText, CreditCard } from 'lucide-react';
import { useAuth } from './AuthContext';
import TimingRadarDashboard from './TimingRadarDashboard';

const AppDashboardHome: React.FC = () => {
  const { appUser, stats } = useAuth();

  const tierProfileLimit =
    appUser?.tier === 'guru' ? 200 : appUser?.tier === 'pro' ? 100 : 10;

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
            Welcome back
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5C5449] leading-relaxed">
            Your personal Vedic astrologer. Analyse charts, generate reports, track dashas and transits and get real time insights
          </p>
        </div>

        <Link
          to="/app/chat"
          className="inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-6 py-3 text-sm font-medium text-[#FAF7F2] transition-colors hover:bg-[#38342E] whitespace-nowrap shrink-0"
        >
          <span>Open Chat</span>
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
              Credits power multi-system Vedic consultations and deep research reports.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-6 md:gap-10">
            <div>
              <p className="text-xs text-[#8B8275] mb-1">Credits</p>
              <p className="font-['DM_Sans',sans-serif] tabular-nums text-2xl md:text-3xl font-medium text-[#3D3830]">
                {(appUser?.credits_balance ?? 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8B8275] mb-1">Saved Profiles</p>
              <p className="font-['DM_Sans',sans-serif] tabular-nums text-2xl md:text-3xl font-medium text-[#3D3830]">
                {stats.savedProfiles}
                <span className="text-sm text-[#8B8275]">/{tierProfileLimit}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8B8275] mb-1">Referrals</p>
              <p className="font-['DM_Sans',sans-serif] tabular-nums text-2xl md:text-3xl font-medium text-[#3D3830]">
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
    </div>
  );
};

export default AppDashboardHome;
