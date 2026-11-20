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
} from 'lucide-react';
import { useAuth } from './AuthContext';

type BillingCurrency = 'INR' | 'USD' | 'EUR';

interface CreditPackItem {
  slug: string;
  name: string;
  subtitle: string;
  credits: number;
  highlight?: string;
  prices: Record<BillingCurrency, number>;
}

interface MembershipTierItem {
  slug: 'personal' | 'pro' | 'guru';
  name: string;
  profileLimit: number;
  activationCostCredits: number;
  includedMonthlyCredits: number;
  prices: Record<BillingCurrency, number>;
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

const CURRENCY_SYMBOLS: Record<BillingCurrency, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
};

const SUPPORTED_CURRENCIES: BillingCurrency[] = ['INR', 'USD', 'EUR'];

function normalizeCurrency(pref?: string | null): BillingCurrency {
  if (pref === 'USD' || pref === 'EUR' || pref === 'INR') return pref;
  return 'INR';
}

const PREVIEW_PACKS: CreditPackItem[] = [
  {
    slug: 'pack_10k',
    name: '10,000 Credit Points',
    subtitle: 'Credits never expire',
    credits: 10000,
    prices: { INR: 1000, USD: 12, EUR: 11 },
  },
  {
    slug: 'pack_30k',
    name: '30,000 Credit Points',
    subtitle: 'Credits never expire',
    credits: 30000,
    highlight: 'Most Popular',
    prices: { INR: 2700, USD: 32, EUR: 30 },
  },
  {
    slug: 'pack_75k',
    name: '75,000 Credit Points',
    subtitle: 'Credits never expire',
    credits: 75000,
    highlight: 'Best Value',
    prices: { INR: 6000, USD: 72, EUR: 66 },
  },
];

const PREVIEW_TIERS: MembershipTierItem[] = [
  {
    slug: 'personal',
    name: 'Personal Plan',
    profileLimit: 10,
    activationCostCredits: 0,
    includedMonthlyCredits: 0,
    prices: { INR: 0, USD: 0, EUR: 0 },
    features: [
      'Up to 10 saved birth profiles',
      '5,000 free credits on signup',
      'Unlimited free birth chart activations',
      'Full access to all platform features',
    ],
  },
  {
    slug: 'pro',
    name: 'Professional Plan',
    profileLimit: 100,
    activationCostCredits: 0,
    includedMonthlyCredits: 25000,
    prices: { INR: 1599, USD: 19, EUR: 18 },
    features: [
      'Up to 100 saved birth profiles',
      '25,000 credits included upon upgrade / renewal',
      'Unlimited free birth chart activations',
      'Full access to all platform features',
    ],
  },
  {
    slug: 'guru',
    name: 'Guru Plan',
    profileLimit: 200,
    activationCostCredits: 0,
    includedMonthlyCredits: 80000,
    prices: { INR: 6999, USD: 79, EUR: 74 },
    features: [
      'Up to 200 saved client birth profiles',
      '80,000 credits included upon upgrade / renewal',
      'Unlimited free birth chart activations',
      'Built for practicing astrologers & family archives',
    ],
  },
];

const PREVIEW_TRANSACTIONS: CreditTransaction[] = [
  {
    id: 'preview-tx-1',
    amount: 5000,
    balance_after: 14500,
    tx_type: 'signup_bonus',
    description: 'Welcome credit allocation',
    created_at: '2026-11-15T09:00:00.000Z',
  },
  {
    id: 'preview-tx-2',
    amount: -120,
    balance_after: 14380,
    tx_type: 'consultation',
    description: 'Career Pivot Timing & D10 Alignment',
    created_at: '2026-11-17T18:22:18.000Z',
  },
];

const BillingCredits: React.FC = () => {
  const { appUser, isPreviewMode, getAccessToken, refreshUser } = useAuth();
  const [currency, setCurrency] = useState<BillingCurrency>(() =>
    normalizeCurrency(appUser?.currency_pref)
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

  useEffect(() => {
    if (appUser?.currency_pref) {
      setCurrency(normalizeCurrency(appUser.currency_pref));
    }
  }, [appUser?.currency_pref]);

  const loadBillingData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isPreviewMode) {
        setCreditPacks(PREVIEW_PACKS);
        setTiers(PREVIEW_TIERS);
        setTransactions(PREVIEW_TRANSACTIONS);
        setUsageSummary({
          periodDays: 30,
          creditsBalance: appUser?.credits_balance ?? 14500,
          creditBaseline: 25000,
          lowCreditsThreshold: 2500,
          isLowCredits: (appUser?.credits_balance ?? 14500) < 2500,
          miniApps: {
            totalRuns: 9,
            cachedRuns: 6,
            freshRuns: 3,
            topApps: [
              {
                slug: 'daily-horoscope',
                title: 'Daily Horoscope',
                runs: 4,
                lastUsedAt: new Date().toISOString(),
              },
              {
                slug: 'current-transits',
                title: 'Current Transits',
                runs: 3,
                lastUsedAt: new Date().toISOString(),
              },
              {
                slug: 'dasha-analysis',
                title: 'Dasha Analysis',
                runs: 2,
                lastUsedAt: new Date().toISOString(),
              },
            ],
          },
          chatQuestions30d: 14,
          reportOrders30d: 1,
        });
        setIsLoading(false);
        return;
      }

      const token = await getAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

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

  const handleCurrencySwitch = async (next: BillingCurrency) => {
    setCurrency(next);
    if (isPreviewMode) return;
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

    if (isPreviewMode) {
      setErrorMessage('This is a preview, login to purchase credits or upgrade your plan.');
      return;
    }

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

  const handleCopyReferral = async () => {
    await navigator.clipboard.writeText(referralUrl);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2000);
  };

  return (
    <div className="min-h-full bg-[#FAF7F2] px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header + Top Section Jump Navigation */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#3D3830]/10 pb-6">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-medium text-[#3D3830] tracking-tight">
              Billing
            </h1>
            <p className="mt-1 text-sm text-[#5C5449]">
              Manage your Credit Points, consultant membership, usage activity, and ledger history.
            </p>
          </div>

          <nav
            aria-label="Billing sections"
            className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-1 self-start md:self-auto"
          >
            {[
              { id: 'top-up', label: 'Top up' },
              { id: 'upgrade', label: 'Upgrade' },
              { id: 'usage', label: 'Usage' },
              { id: 'history', label: 'History' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="rounded-xl px-3.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer whitespace-nowrap"
              >
                {item.label}
              </button>
            ))}
          </nav>
        </section>

        {/* 3-Card KPI Row */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Available Balance + Top up */}
          <div className="rounded-3xl bg-gradient-to-br from-[#1F2229] to-[#292D36] p-6 text-[#F4EFE6] flex flex-col justify-between min-h-[168px]">
            <div className="flex items-center justify-between gap-3">
              <Coins className="h-5 w-5 text-[#B8965A]" />
              <button
                type="button"
                onClick={() => scrollToSection('top-up')}
                className="inline-flex items-center gap-1 rounded-xl bg-[#F4EFE6]/12 hover:bg-[#F4EFE6]/20 border border-[#F4EFE6]/15 px-3 py-1.5 text-xs font-medium text-[#F4EFE6] transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 text-[#B8965A]" />
                <span>Top up</span>
              </button>
            </div>
            <div className="mt-4">
              <p className="text-xs text-[#F4EFE6]/70">Available Balance</p>
              <p className="mt-1 font-['DM_Sans',sans-serif] tabular-nums text-3xl font-medium text-[#F4EFE6]">
                {(appUser?.credits_balance ?? 0).toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs text-[#F4EFE6]/75">Credit Points</p>
              {isLowCredits && (
                <p className="mt-1.5 text-xs font-medium text-[#E5B391] inline-flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Below 10% remaining</span>
                </p>
              )}
            </div>
          </div>

          {/* Card 2: Current Plan */}
          <div className="rounded-3xl bg-[#FDFBF7] p-6 border border-[#3D3830]/12 flex flex-col justify-between min-h-[168px]">
            <div className="flex items-center justify-between gap-2">
              <Shield className="h-5 w-5 text-[#8B7355]" />
              {appUser?.tier !== 'guru' && (
                <button
                  type="button"
                  onClick={() => scrollToSection('upgrade')}
                  className="text-xs font-medium text-[#5C5449] hover:text-[#3D3830] underline underline-offset-4 cursor-pointer"
                >
                  Upgrade
                </button>
              )}
            </div>
            <div className="mt-4">
              <p className="text-xs text-[#8B8275]">Current Plan</p>
              <h2 className="mt-1 font-serif text-2xl font-medium text-[#3D3830]">
                {currentTierLabel}
              </h2>
              <p className="mt-1 text-xs text-[#5C5449]">
                Up to {tierProfileLimit} saved birth profiles
              </p>
            </div>
          </div>

          {/* Card 3: Referrals Earned */}
          <div className="rounded-3xl bg-[#FDFBF7] p-6 border border-[#3D3830]/12 flex flex-col justify-between min-h-[168px]">
            <Gift className="h-5 w-5 text-[#8B7355]" />
            <div className="mt-4">
              <p className="text-xs text-[#8B8275]">Referrals Earned</p>
              <p className="mt-1 font-['DM_Sans',sans-serif] tabular-nums text-2xl font-medium text-[#3D3830]">
                {rewardedReferralsCount}{' '}
                <span className="font-sans text-sm font-normal text-[#5C5449]">rewarded</span>
              </p>
              <p className="mt-1 text-xs text-[#5C5449]">
                {pendingReferralsCount} pending · +5,000 Credit Points each
              </p>
            </div>
          </div>
        </section>

        {/* Compact Refer & Earn Banner Directly Below Top KPI Row */}
        <section
          id="refer-and-earn"
          className="rounded-3xl bg-[#F1ECE3] border border-[#3D3830]/12 px-5 py-4 sm:px-6 sm:py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3 min-w-0">
            <Gift className="h-5 w-5 text-[#8B7355] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h2 className="font-serif text-xl font-medium text-[#3D3830]">
                Refer &amp; Earn +5,000 Credit Points
              </h2>
              <p className="text-xs text-[#5C5449] mt-0.5 leading-relaxed">
                Share your referral link. When a friend completes their first paid top-up or plan upgrade, you both receive 5,000 Credit Points.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 lg:w-[420px]">
            <input
              type="text"
              readOnly
              value={referralUrl}
              aria-label="Your personal referral link"
              className="flex-1 min-w-0 rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs text-[#3D3830] truncate"
            />
            <button
              type="button"
              onClick={() => void handleCopyReferral()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#4A453D] hover:bg-[#38342E] px-4 py-2 text-xs font-medium text-[#FAF7F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedReferral ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedReferral ? 'Copied' : 'Copy Link'}</span>
            </button>
          </div>
        </section>

        {isLowCredits && (
          <div className="rounded-2xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#7A3E36]">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Your balance is below 10% ({(appUser?.credits_balance ?? 0).toLocaleString()} /{' '}
                {creditBaseline.toLocaleString()} baseline). Top up below whenever you are ready to continue consultations or reports.
              </span>
            </div>
            <button
              type="button"
              onClick={() => scrollToSection('top-up')}
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

        {!dodoConfigured && !isPreviewMode && (
          <div className="rounded-2xl bg-[#F1ECE3] border border-[#3D3830]/15 px-5 py-3.5 text-xs text-[#5C5449]">
            Checkout is currently awaiting payment configuration in backend environment settings. Pricing and tiers shown below reflect your live catalog.
          </div>
        )}

        {/* Top-Up Credit Packs + Currency Switcher Above Packs */}
        <section id="top-up" className="space-y-4 scroll-mt-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl sm:text-3xl font-medium text-[#3D3830]">
                Top Up Credit Points
              </h2>
              <p className="mt-1 text-xs text-[#5C5449]">
                Credits never expire and work across Chat consultations and Deep Research reports.
              </p>
            </div>

            <div className="inline-flex items-center gap-1 rounded-2xl bg-[#F1ECE3] p-1 border border-[#3D3830]/10 self-start sm:self-auto">
              {SUPPORTED_CURRENCIES.map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => void handleCurrencySwitch(curr)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-['DM_Sans',sans-serif] font-medium transition-colors cursor-pointer ${
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {creditPacks.map((pack) => (
              <div
                key={pack.slug}
                className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-6 flex flex-col justify-between space-y-6 hover:border-[#8B7355]/45 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 min-h-[18px] text-xs">
                    <span className="text-[#8B8275]">Top-Up Pack</span>
                    {pack.highlight && (
                      <span className="font-medium text-[#8B7355]">{pack.highlight}</span>
                    )}
                  </div>

                  <div className="pt-1">
                    <p className="font-['DM_Sans',sans-serif] tabular-nums text-3xl font-medium text-[#3D3830] leading-tight">
                      {pack.credits.toLocaleString()}
                    </p>
                    <p className="text-sm font-medium text-[#5C5449] mt-0.5">
                      Credit Points
                    </p>
                  </div>

                  <p className="text-xs text-[#8B8275] pt-1">Credits never expire</p>
                </div>

                <div className="pt-4 border-t border-[#3D3830]/10 flex items-center justify-between gap-4">
                  <span className="font-['DM_Sans',sans-serif] tabular-nums text-xl font-medium text-[#3D3830]">
                    {formatPrice(pack.prices[currency] ?? pack.prices.INR)}
                  </span>
                  <button
                    type="button"
                    disabled={checkoutLoadingSlug === pack.slug || isLoading}
                    onClick={() => void handleStartCheckout('credit_pack', pack.slug)}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <span>
                      {checkoutLoadingSlug === pack.slug ? 'Redirecting...' : 'Buy Now'}
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Plans for Consultants */}
        <section id="upgrade" className="space-y-4 scroll-mt-8">
          <div>
            <h2 className="font-serif text-2xl sm:text-3xl font-medium text-[#3D3830]">
              Plans for Consultants
            </h2>
            <p className="mt-1 text-xs text-[#5C5449]">
              Expand saved birth profile capacity and receive included monthly Credit Points.
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
                      <span className="font-['DM_Sans',sans-serif] tabular-nums">{tier.profileLimit} Profiles</span>
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
                        {formatPrice(tier.prices[currency] ?? tier.prices.INR)}
                        {(tier.prices[currency] ?? tier.prices.INR) > 0 && (
                          <span className="font-sans text-xs font-normal text-[#8B8275]">
                            {' '}
                            / month
                          </span>
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
                      <span className="text-xs text-[#8B8275]">Included base tier</span>
                    ) : isCurrent ? (
                      <button
                        type="button"
                        disabled={checkoutLoadingSlug === tier.slug}
                        onClick={() => void handleStartCheckout('subscription', tier.slug)}
                        className="w-full rounded-2xl border border-[#3D3830]/25 px-4 py-2.5 text-xs font-medium text-[#3D3830] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                      >
                        Renew / Add Cycle
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={checkoutLoadingSlug === tier.slug}
                        onClick={() => void handleStartCheckout('subscription', tier.slug)}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[#4A453D] px-4 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors cursor-pointer"
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

        {/* 30-Day Usage Summary */}
        {usageSummary && (
          <section id="usage" className="space-y-4 scroll-mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#8B7355]" />
                  <h2 className="font-serif text-2xl sm:text-3xl font-medium text-[#3D3830]">
                    Usage Summary
                  </h2>
                </div>
                <p className="mt-1 text-xs text-[#5C5449]">
                  Your activity across the last {usageSummary.periodDays} days. Chart Mini-Apps are included; Credit Points power Chat consultations and Deep Research reports.
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
              <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 space-y-1.5">
                <p className="text-xs text-[#8B8275]">Mini-Apps Opened</p>
                <p className="font-['DM_Sans',sans-serif] tabular-nums text-2xl font-medium text-[#3D3830]">
                  {usageSummary.miniApps.totalRuns.toLocaleString()}
                </p>
                <p className="text-xs text-[#5C5449]">
                  {usageSummary.miniApps.freshRuns} fresh · {usageSummary.miniApps.cachedRuns} instant cached
                </p>
              </div>

              <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 space-y-1.5">
                <p className="text-xs text-[#8B8275]">Chat Questions</p>
                <p className="font-['DM_Sans',sans-serif] tabular-nums text-2xl font-medium text-[#3D3830]">
                  {usageSummary.chatQuestions30d.toLocaleString()}
                </p>
                <p className="text-xs text-[#5C5449]">
                  Across Council, Companions &amp; Clarity threads
                </p>
              </div>

              <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 space-y-1.5">
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
              <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 space-y-3">
                <p className="text-xs font-medium text-[#8B8275]">
                  Most Reopened Mini-Apps (Last {usageSummary.periodDays} Days)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {usageSummary.miniApps.topApps.map((item) => (
                    <Link
                      key={item.slug}
                      to={`/app/apps/${item.slug}`}
                      className="group flex items-center justify-between gap-2 rounded-2xl border border-[#3D3830]/10 bg-[#FAF7F2] px-3.5 py-2.5 text-xs hover:border-[#3D3830]/25 hover:bg-[#F1ECE3]/70 transition-colors"
                    >
                      <span className="font-medium text-[#3D3830] truncate">{item.title}</span>
                      <span className="font-['DM_Sans',sans-serif] tabular-nums text-[#8B8275] group-hover:text-[#3D3830] shrink-0">
                        {item.runs}×
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Credit History Ledger */}
        <section id="history" className="space-y-4 scroll-mt-8">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-[#8B7355]" />
            <h2 className="font-serif text-2xl sm:text-3xl font-medium text-[#3D3830]">
              History
            </h2>
          </div>

          <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 overflow-hidden">
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
                  <tbody className="divide-y divide-[#3D3830]/10">
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="px-5 py-3 font-['DM_Sans',sans-serif] tabular-nums text-[#8B8275] whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
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
                          {tx.amount >= 0
                            ? `+${tx.amount.toLocaleString()}`
                            : tx.amount.toLocaleString()}
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
      </div>
    </div>
  );
};

export default BillingCredits;
