import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Check,
  Coins,
  Copy,
  Gift,
  LayoutGrid,
  Plus,
  Receipt,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from './AuthContext';

type SupportedCurrency = 'INR' | 'USD' | 'AED' | 'EUR';

interface CreditPackItem {
  slug: string;
  name: string;
  subtitle: string;
  credits: number;
  highlight?: string;
  prices: Record<SupportedCurrency, number>;
}

interface MembershipTierItem {
  slug: 'personal' | 'pro' | 'guru';
  name: string;
  profileLimit: number;
  activationCostCredits: number;
  includedMonthlyCredits: number;
  prices: Record<SupportedCurrency, number>;
  features: string[];
}

interface CreditTransaction {
  id: string;
  amount: number;
  balance_after: number;
  tx_type: string;
  description: string | null;
  created_at: string;
}

interface ReferralItem {
  id: string;
  status: 'pending' | 'rewarded';
  reward_credits: number;
  created_at: string;
  rewarded_at: string | null;
}

interface UsageSummaryResponse {
  periodDays: number;
  creditsBalance: number;
  creditBaseline: number;
  lowCreditsThreshold: number;
  isLowCredits: boolean;
  miniApps: {
    totalRuns: number;
    cachedRuns: number;
    freshRuns: number;
    topApps: Array<{
      slug: string;
      title: string;
      runs: number;
      lastUsedAt: string;
    }>;
  };
  chatQuestions30d: number;
  reportOrders30d: number;
}

const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  INR: '₹',
  USD: '$',
  AED: 'AED ',
  EUR: '€',
};

const BillingCredits: React.FC = () => {
  const { appUser, isPreviewMode, getAccessToken, refreshUser } = useAuth();
  const [currency, setCurrency] = useState<SupportedCurrency>(
    (appUser?.currency_pref as SupportedCurrency) || 'INR'
  );
  const [creditPacks, setCreditPacks] = useState<CreditPackItem[]>([]);
  const [tiers, setTiers] = useState<MembershipTierItem[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [usageSummary, setUsageSummary] = useState<UsageSummaryResponse | null>(null);
  const [dodoConfigured, setDodoConfigured] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [checkoutLoadingSlug, setCheckoutLoadingSlug] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);

  useEffect(() => {
    if (appUser?.currency_pref) {
      setCurrency(appUser.currency_pref as SupportedCurrency);
    }
  }, [appUser?.currency_pref]);

  const loadBillingData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isPreviewMode) {
        setUsageSummary({
          periodDays: 30,
          creditsBalance: appUser?.credits_balance ?? 5000,
          creditBaseline: 5000,
          lowCreditsThreshold: 500,
          isLowCredits: (appUser?.credits_balance ?? 5000) < 500,
          miniApps: {
            totalRuns: 9,
            cachedRuns: 6,
            freshRuns: 3,
            topApps: [
              { slug: 'daily-horoscope', title: 'Daily Forecast', runs: 4, lastUsedAt: new Date().toISOString() },
              { slug: 'current-transits', title: 'Current Transits', runs: 3, lastUsedAt: new Date().toISOString() },
              { slug: 'dasha-analysis', title: 'Dasha Explorer', runs: 2, lastUsedAt: new Date().toISOString() },
            ],
          },
          chatQuestions30d: 14,
          reportOrders30d: 1,
        });
        setIsLoading(false);
        return;
      }

      const token = await getAccessToken();
      if (!token) return;
      const [res, usageRes] = await Promise.all([
        fetch('/api/payments/catalog', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/apps/usage-summary', {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
      ]);
      if (res.ok) {
        const data = await res.json();
        setCreditPacks(data.creditPacks || []);
        setTiers(data.tiers || []);
        setTransactions(data.transactions || []);
        setReferrals(data.referrals || []);
        setDodoConfigured(Boolean(data.dodoConfigured));
      }
      if (usageRes && usageRes.ok) {
        const uData = (await usageRes.json()) as UsageSummaryResponse;
        setUsageSummary(uData);
      }
    } catch {
      setErrorMessage('Unable to load billing catalog.');
    } finally {
      setIsLoading(false);
    }
  }, [appUser?.credits_balance, getAccessToken, isPreviewMode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'returned') {
      setStatusMessage(
        'Returned from checkout. Credits and tier upgrades reflect automatically once Dodo webhook confirmation completes.'
      );
      void refreshUser();
    }
    void loadBillingData();
  }, [loadBillingData, refreshUser]);

  const handleCurrencySwitch = async (next: SupportedCurrency) => {
    setCurrency(next);
    const token = await getAccessToken();
    if (!token) return;
    await fetch('/api/app/me/preferences', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currency_pref: next }),
    }).catch(() => null);
    await refreshUser();
  };

  const handleStartCheckout = async (
    orderType: 'credit_pack' | 'subscription',
    slug: string
  ) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setCheckoutLoadingSlug(slug);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');

      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderType, slug, currency }),
      });

      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || 'Could not initiate checkout');
      }

      window.location.assign(data.checkoutUrl);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Checkout failed');
      setCheckoutLoadingSlug(null);
    }
  };

  const formatPrice = (amount: number) => {
    if (amount === 0) return 'Free';
    return `${CURRENCY_SYMBOLS[currency]}${amount.toLocaleString()}`;
  };

  const pendingReferralsCount = referrals.filter((r) => r.status === 'pending').length;
  const rewardedReferralsCount = referrals.filter((r) => r.status === 'rewarded').length;

  const referralUrl = appUser?.referral_code
    ? `${window.location.origin}/app/login?ref=${appUser.referral_code}`
    : `${window.location.origin}/app/login`;

  const tierProfileLimit =
    appUser?.tier === 'guru' ? 200 : appUser?.tier === 'pro' ? 100 : 10;

  const currentTierLabel =
    appUser?.tier === 'guru'
      ? 'Guru Plan'
      : appUser?.tier === 'pro'
      ? 'Professional Plan'
      : 'Personal Plan';

  const currentActivationRate = 'Free';

  const creditBaseline =
    appUser?.tier === 'guru' ? 80000 : appUser?.tier === 'pro' ? 25000 : 5000;
  const lowCreditsThreshold =
    usageSummary?.lowCreditsThreshold ?? Math.round(creditBaseline * 0.1);
  const isLowCredits =
    typeof appUser?.credits_balance === 'number' &&
    appUser.credits_balance < lowCreditsThreshold;

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (!showReferralModal) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowReferralModal(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [showReferralModal]);

  const handleCopyReferral = async () => {
    await navigator.clipboard.writeText(referralUrl);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2000);
  };

  return (
    <div className="space-y-10">
      {/* Editorial Header + Action Buttons + Currency Switcher */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-[#3D3830]/10 pb-8">
        <div>
          <p className="text-xs text-[#8B8275] mb-2">
            Credits & Membership · Transparent Usage Ledger
          </p>
          <h1 className="font-serif text-4xl font-medium text-[#3D3830] tracking-tight">
            Credits, Plans & Billing
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5C5449] leading-relaxed">
            Top up consultation credits starting at ₹1,000 (10,000 Credits) or upgrade your membership tier for higher saved profile limits and included monthly credits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => scrollToSection('add-credits')}
            className="inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-5 py-2.5 text-sm font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Add credits</span>
          </button>

          <button
            type="button"
            onClick={() => setShowReferralModal(true)}
            className="inline-flex items-center gap-2 rounded-full border border-[#3D3830]/20 bg-[#FDFBF7] px-5 py-2.5 text-sm font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors whitespace-nowrap"
          >
            <Gift className="h-4 w-4 text-[#8B7355]" />
            <span>Refer & Earn</span>
          </button>

          <div className="flex items-center gap-1 rounded-2xl bg-[#F1ECE3] p-1.5 border border-[#3D3830]/10">
            {(['INR', 'USD', 'AED', 'EUR'] as SupportedCurrency[]).map((curr) => (
              <button
                key={curr}
                type="button"
                onClick={() => void handleCurrencySwitch(curr)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium font-['DM_Sans',sans-serif] transition-colors ${
                  currency === curr
                    ? 'bg-[#4A453D] text-[#FAF7F2]'
                    : 'text-[#5C5449] hover:text-[#3D3830]'
                }`}
              >
                {curr}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Rounded-Corner Square Key Highlights Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="rounded-3xl bg-gradient-to-br from-[#1F2229] to-[#292D36] p-6 text-[#F4EFE6] flex flex-col justify-between min-h-[156px]">
          <div className="flex items-center justify-between">
            <Coins className="h-5 w-5 text-[#B8965A]" />
            <span className="text-[11px] font-['DM_Sans',sans-serif] text-[#F4EFE6]/60">
              {currency}
            </span>
          </div>
          <div>
            <p className="text-xs text-[#F4EFE6]/65">Available Balance</p>
            <p className="mt-1 font-['DM_Sans',sans-serif] tabular-nums text-2xl font-medium text-[#F4EFE6]">
              {(appUser?.credits_balance ?? 0).toLocaleString()}
            </p>
            {isLowCredits ? (
              <p className="mt-1 text-xs font-medium text-[#E5B391] inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Below 10% remaining</span>
              </p>
            ) : (
              <p className="mt-1 text-xs text-[#F4EFE6]/60">Credits ready to use</p>
            )}
          </div>
        </div>

        <div className="rounded-3xl bg-[#FDFBF7] p-6 border border-[#3D3830]/10 flex flex-col justify-between min-h-[156px]">
          <Shield className="h-5 w-5 text-[#5C5449]" />
          <div>
            <p className="text-xs text-[#8B8275]">Current Plan</p>
            <h2 className="mt-1 font-serif text-xl font-medium text-[#3D3830]">
              {currentTierLabel}
            </h2>
            <p className="mt-1 text-xs text-[#5C5449]">
              Up to {tierProfileLimit} saved birth profiles
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-[#FDFBF7] p-6 border border-[#3D3830]/10 flex flex-col justify-between min-h-[156px]">
          <Gift className="h-5 w-5 text-[#5C5449]" />
          <div>
            <p className="text-xs text-[#8B8275]">Referrals Earned</p>
            <p className="mt-1 font-['DM_Sans',sans-serif] tabular-nums text-2xl font-medium text-[#3D3830]">
              {rewardedReferralsCount}{' '}
              <span className="font-sans text-sm font-normal text-[#5C5449]">rewarded</span>
            </p>
            <p className="mt-1 text-xs text-[#5C5449]">
              {pendingReferralsCount} pending · +5,000 credits each
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-[#FDFBF7] p-6 border border-[#3D3830]/10 flex flex-col justify-between min-h-[156px]">
          <Sparkles className="h-5 w-5 text-[#5C5449]" />
          <div>
            <p className="text-xs text-[#8B8275]">Chart Activation Rate</p>
            <p className="mt-1 font-['DM_Sans',sans-serif] tabular-nums text-xl font-medium text-[#3D3830]">
              {currentActivationRate}
            </p>
            <p className="mt-1 text-xs text-[#5C5449]">
              Included free on all plans
            </p>
          </div>
        </div>
      </section>

      {isLowCredits && (
        <div className="rounded-2xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#7A3E36]">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Your credit balance is below 10% ({(appUser?.credits_balance ?? 0).toLocaleString()} /{' '}
              {creditBaseline.toLocaleString()} baseline). Top up below whenever you are ready to continue consultations or reports.
            </span>
          </div>
          <button
            type="button"
            onClick={() => scrollToSection('add-credits')}
            className="font-medium underline underline-offset-4 whitespace-nowrap cursor-pointer"
          >
            View top-up packs
          </button>
        </div>
      )}

      {statusMessage && (
        <div className="rounded-2xl bg-[#F1ECE3] border border-[#3D3830]/15 px-5 py-3.5 text-xs text-[#3D3830]">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-2xl bg-[#7A3E36]/10 border border-[#7A3E36]/20 px-5 py-3.5 text-xs text-[#7A3E36]">
          {errorMessage}
        </div>
      )}

      {!dodoConfigured && (
        <div className="rounded-2xl bg-[#F1ECE3] border border-[#3D3830]/15 px-5 py-3.5 text-xs text-[#5C5449]">
          Dodo Payments checkout is currently awaiting `DODO_API_KEY` configuration in backend environment variables. Pricing and tiers shown below reflect your live catalog.
        </div>
      )}

      {/* Credit Packs */}
      <section id="add-credits" className="space-y-4 scroll-mt-8">
        <div>
          <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
            Top-Up Credit Packs
          </h2>
          <p className="text-xs text-[#5C5449]">
            Credits never expire and work across Chat consultations and Deep Research reports.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {creditPacks.map((pack) => (
            <div
              key={pack.slug}
              className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-6 flex flex-col justify-between space-y-6"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs text-[#8B8275]">
                  <span>Credit Reserve</span>
                  {pack.highlight && (
                    <span className="font-medium text-[#8B7355]">{pack.highlight}</span>
                  )}
                </div>
                <h3 className="font-serif text-2xl font-medium text-[#3D3830]">
                  {pack.name}
                </h3>
                <p className="font-['DM_Sans',sans-serif] tabular-nums text-lg font-medium text-[#3D3830]">
                  {pack.credits.toLocaleString()} Credits
                </p>
                <p className="text-xs text-[#5C5449] leading-relaxed">{pack.subtitle}</p>
              </div>

              <div className="pt-4 border-t border-[#3D3830]/10 flex items-center justify-between gap-4">
                <span className="font-['DM_Sans',sans-serif] tabular-nums text-xl font-medium text-[#3D3830]">
                  {formatPrice(pack.prices[currency])}
                </span>
                <button
                  type="button"
                  disabled={checkoutLoadingSlug === pack.slug || isLoading}
                  onClick={() => void handleStartCheckout('credit_pack', pack.slug)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors disabled:opacity-50"
                >
                  <span>
                    {checkoutLoadingSlug === pack.slug ? 'Redirecting...' : 'Purchase'}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Membership Tiers */}
      <section className="space-y-4">
        <div>
          <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
            Observatory Membership Tiers
          </h2>
          <p className="text-xs text-[#5C5449]">
            Expand saved birth profile capacity and receive included monthly consultation credits.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {tiers.map((tier) => {
            const isCurrent = appUser?.tier === tier.slug;
            return (
              <div
                key={tier.slug}
                className={`rounded-3xl border p-6 flex flex-col justify-between space-y-6 ${
                  isCurrent
                    ? 'bg-[#F1ECE3] border-[#3D3830]/25'
                    : 'bg-[#FDFBF7] border-[#3D3830]/12'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-[#8B8275]">
                    <span>{tier.profileLimit} Profiles</span>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 font-medium text-[#3D3830]">
                        <Shield className="h-3.5 w-3.5" /> Active
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-serif text-2xl font-medium text-[#3D3830]">
                      {tier.name}
                    </h3>
                    <p className="mt-1 font-['DM_Sans',sans-serif] tabular-nums text-xl font-medium text-[#3D3830]">
                      {formatPrice(tier.prices[currency])}
                      {tier.prices[currency] > 0 && (
                        <span className="text-xs font-normal text-[#8B8275]"> / month</span>
                      )}
                    </p>
                  </div>

                  <ul className="space-y-2 text-xs text-[#5C5449]">
                    {tier.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 text-[#8B7355] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-[#3D3830]/10">
                  {tier.slug === 'personal' ? (
                    <span className="text-xs text-[#8B8275]">
                      Included base tier
                    </span>
                  ) : isCurrent ? (
                    <button
                      type="button"
                      disabled={checkoutLoadingSlug === tier.slug}
                      onClick={() => void handleStartCheckout('subscription', tier.slug)}
                      className="w-full rounded-full border border-[#3D3830]/25 px-4 py-2.5 text-xs font-medium text-[#3D3830] hover:bg-[#FAF7F2]"
                    >
                      Renew / Add Cycle
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={checkoutLoadingSlug === tier.slug}
                      onClick={() => void handleStartCheckout('subscription', tier.slug)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E]"
                    >
                      <span>
                        {checkoutLoadingSlug === tier.slug
                          ? 'Redirecting...'
                          : `Upgrade to ${tier.name.replace(' Plan', '')}`}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Interactive Refer & Earn (+5,000 Credits) Section */}
      <section
        id="refer-and-earn"
        className="rounded-3xl bg-[#F1ECE3] border border-[#3D3830]/10 p-6 md:p-7 space-y-4 scroll-mt-8"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Gift className="h-5 w-5 text-[#8B7355] shrink-0 mt-0.5" />
            <div>
              <h3 className="font-serif text-2xl font-medium text-[#3D3830]">
                Invite & Earn 5,000 Credits
              </h3>
              <p className="text-xs text-[#5C5449] mt-1 leading-relaxed max-w-2xl">
                Share your personal referral link. When a friend signs up and completes their first paid credit purchase or subscription upgrade, you both receive 5,000 credits.
              </p>
            </div>
          </div>
          <div className="font-['DM_Sans',sans-serif] tabular-nums text-xs text-[#3D3830] shrink-0">
            {rewardedReferralsCount} Rewarded · {pendingReferralsCount} Pending
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
          <input
            type="text"
            readOnly
            value={referralUrl}
            aria-label="Your personal referral link"
            className="flex-1 rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs font-['DM_Sans',sans-serif] text-[#3D3830]"
          />
          <button
            type="button"
            onClick={() => void handleCopyReferral()}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors whitespace-nowrap shrink-0"
          >
            {copiedReferral ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedReferral ? 'Copied' : 'Copy Link'}</span>
          </button>
        </div>
      </section>

      {/* Calm 30-Day Activity & Feature Usage Summary */}
      {usageSummary && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#8B8275]" />
                <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                  Activity &amp; Feature Usage
                </h2>
              </div>
              <p className="mt-1 text-xs text-[#5C5449]">
                Your activity across the last {usageSummary.periodDays} days. Daily &amp; chart Mini-Apps are included complimentary; credits are reserved for consultations and multi-pass research reports.
              </p>
            </div>
            <Link
              to="/app/apps"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors whitespace-nowrap"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-[#8B7355]" />
              <span>Explore Apps</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 space-y-1.5">
              <p className="text-xs text-[#8B8275]">Mini-Apps Opened</p>
              <p className="font-['DM_Sans',sans-serif] tabular-nums text-2xl font-medium text-[#3D3830]">
                {usageSummary.miniApps.totalRuns.toLocaleString()}
              </p>
              <p className="text-xs text-[#5C5449]">
                {usageSummary.miniApps.freshRuns} fresh · {usageSummary.miniApps.cachedRuns} instant cached · Complimentary
              </p>
            </div>

            <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 space-y-1.5">
              <p className="text-xs text-[#8B8275]">Chat Questions</p>
              <p className="font-['DM_Sans',sans-serif] tabular-nums text-2xl font-medium text-[#3D3830]">
                {usageSummary.chatQuestions30d.toLocaleString()}
              </p>
              <p className="text-xs text-[#5C5449]">
                Across Council, Companions &amp; Clarity threads
              </p>
            </div>

            <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 space-y-1.5">
              <p className="text-xs text-[#8B8275]">Research Reports</p>
              <p className="font-['DM_Sans',sans-serif] tabular-nums text-2xl font-medium text-[#3D3830]">
                {usageSummary.reportOrders30d.toLocaleString()}
              </p>
              <p className="text-xs text-[#5C5449]">
                Multi-pass dossiers generated this month
              </p>
            </div>
          </div>

          {usageSummary.miniApps.topApps.length > 0 && (
            <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 space-y-3">
              <p className="text-xs font-medium text-[#8B8275]">
                Most Reopened Mini-Apps (Last {usageSummary.periodDays} Days)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {usageSummary.miniApps.topApps.map((item) => (
                  <Link
                    key={item.slug}
                    to={`/app/apps/${item.slug}`}
                    className="group flex items-center justify-between gap-2 rounded-2xl border border-[#3D3830]/10 bg-[#FAF7F2] px-3.5 py-2.5 text-xs hover:border-[#3D3830]/22 hover:bg-[#F1ECE3]/70 transition-colors"
                  >
                    <span className="font-medium text-[#3D3830] truncate">{item.title}</span>
                    <span className="font-mono tabular-nums text-[#8B8275] group-hover:text-[#3D3830] shrink-0">
                      {item.runs}×
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Credit Transaction Ledger */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-[#8B8275]" />
          <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
            Credit Transaction Ledger
          </h2>
        </div>

        <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 overflow-hidden">
          {transactions.length === 0 ? (
            <p className="p-6 text-xs text-[#8B8275]">
              No credit transactions recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F1ECE3] text-[#5C5449] border-b border-[#3D3830]/10">
                  <tr>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Description</th>
                    <th className="px-5 py-3 font-medium text-right">Amount</th>
                    <th className="px-5 py-3 font-medium text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3D3830]/8">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-5 py-3 font-['DM_Sans',sans-serif] tabular-nums text-[#8B8275] whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 capitalize text-[#3D3830] whitespace-nowrap">
                        {tx.tx_type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-5 py-3 text-[#5C5449]">
                        {tx.description || '—'}
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-['DM_Sans',sans-serif] tabular-nums whitespace-nowrap ${
                          tx.amount >= 0 ? 'text-[#2D6A4F]' : 'text-[#3D3830]'
                        }`}
                      >
                        {tx.amount >= 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right font-['DM_Sans',sans-serif] tabular-nums text-[#3D3830] whitespace-nowrap">
                        {tx.balance_after.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Refer & Earn Modal */}
      {showReferralModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#3D3830]/40 backdrop-blur-sm p-4"
          onClick={() => setShowReferralModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="referral-modal-title"
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/15 p-6 md:p-8 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Gift className="h-5 w-5 text-[#8B7355] shrink-0 mt-1" />
                <div>
                  <h2
                    id="referral-modal-title"
                    className="font-serif text-2xl font-medium text-[#3D3830]"
                  >
                    Invite & Earn 5,000 Credits
                  </h2>
                  <p className="text-xs text-[#5C5449] mt-1 leading-relaxed">
                    Share your personal referral link. When a friend signs up and completes their first paid credit purchase or subscription upgrade, you both receive 5,000 credits.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReferralModal(false)}
                aria-label="Close referral modal"
                className="p-1.5 rounded-full text-[#8B8275] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-[#F1ECE3] px-4 py-3 flex items-center justify-between text-xs text-[#3D3830]">
              <span>Referral Status</span>
              <span className="font-['DM_Sans',sans-serif] tabular-nums">
                {rewardedReferralsCount} Rewarded · {pendingReferralsCount} Pending
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                type="text"
                readOnly
                value={referralUrl}
                aria-label="Your personal referral link"
                className="flex-1 rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs font-['DM_Sans',sans-serif] text-[#3D3830]"
              />
              <button
                type="button"
                onClick={() => void handleCopyReferral()}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors whitespace-nowrap shrink-0"
              >
                {copiedReferral ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedReferral ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingCredits;
