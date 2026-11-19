import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Check, Coins, Gift, Receipt, Shield } from 'lucide-react';
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

const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  INR: '₹',
  USD: '$',
  AED: 'AED ',
  EUR: '€',
};

const BillingCredits: React.FC = () => {
  const { appUser, getAccessToken, refreshUser } = useAuth();
  const [currency, setCurrency] = useState<SupportedCurrency>(
    (appUser?.currency_pref as SupportedCurrency) || 'INR'
  );
  const [creditPacks, setCreditPacks] = useState<CreditPackItem[]>([]);
  const [tiers, setTiers] = useState<MembershipTierItem[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [dodoConfigured, setDodoConfigured] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [checkoutLoadingSlug, setCheckoutLoadingSlug] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (appUser?.currency_pref) {
      setCurrency(appUser.currency_pref as SupportedCurrency);
    }
  }, [appUser?.currency_pref]);

  const loadBillingData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch('/api/payments/catalog', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCreditPacks(data.creditPacks || []);
        setTiers(data.tiers || []);
        setTransactions(data.transactions || []);
        setReferrals(data.referrals || []);
        setDodoConfigured(Boolean(data.dodoConfigured));
      }
    } catch {
      setErrorMessage('Unable to load billing catalog.');
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

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

  return (
    <div className="space-y-10">
      {/* Editorial Header + Currency Switcher */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#3D3830]/10 pb-8">
        <div>
          <p className="text-xs text-[#8B8275] mb-2">
            Credits & Membership · Transparent Usage Ledger
          </p>
          <h1 className="font-serif text-4xl font-medium text-[#3D3830] tracking-tight">
            Credits, Plans & Billing
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5C5449] leading-relaxed">
            Top up consultation credits starting at ₹1,000 (10,000 Credits) or upgrade your membership tier for higher saved profile limits and discounted chart activations.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-[#F1ECE3] p-1.5 border border-[#3D3830]/10 shrink-0">
          {(['INR', 'USD', 'AED', 'EUR'] as SupportedCurrency[]).map((curr) => (
            <button
              key={curr}
              type="button"
              onClick={() => void handleCurrencySwitch(curr)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-medium font-['JetBrains_Mono',monospace] transition-colors ${
                currency === curr
                  ? 'bg-[#4A453D] text-[#FAF7F2]'
                  : 'text-[#5C5449] hover:text-[#3D3830]'
              }`}
            >
              {curr}
            </button>
          ))}
        </div>
      </section>

      {/* Current Balance Snapshot */}
      <section className="rounded-3xl bg-gradient-to-br from-[#1F2229] to-[#292D36] p-7 text-[#F4EFE6] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-[#F4EFE6]/65">
            <Coins className="h-4 w-4 text-[#B8965A]" />
            <span>Available Balance</span>
          </div>
          <p className="font-['JetBrains_Mono',monospace] tabular-nums text-3xl md:text-4xl font-medium">
            {(appUser?.credits_balance ?? 0).toLocaleString()}{' '}
            <span className="text-base font-normal text-[#F4EFE6]/65">Credits</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div>
            <p className="text-[#F4EFE6]/55">Current Tier</p>
            <p className="mt-0.5 font-medium text-sm capitalize text-[#F4EFE6]">
              {appUser?.tier === 'guru'
                ? 'Guru Plan'
                : appUser?.tier === 'pro'
                ? 'Professional Plan'
                : 'Personal Plan'}
            </p>
          </div>
          <div>
            <p className="text-[#F4EFE6]/55">Referrals Rewarded</p>
            <p className="mt-0.5 font-['JetBrains_Mono',monospace] text-sm text-[#F4EFE6]">
              {rewardedReferralsCount} rewarded · {pendingReferralsCount} pending
            </p>
          </div>
        </div>
      </section>

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
      <section className="space-y-4">
        <div>
          <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
            Top-Up Credit Packs
          </h2>
          <p className="text-xs text-[#5C5449]">
            Credits never expire and work across Chat Studio consultations, chart activations, and Deep Research reports.
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
                <p className="font-['JetBrains_Mono',monospace] tabular-nums text-lg font-medium text-[#3D3830]">
                  {pack.credits.toLocaleString()} Credits
                </p>
                <p className="text-xs text-[#5C5449] leading-relaxed">{pack.subtitle}</p>
              </div>

              <div className="pt-4 border-t border-[#3D3830]/10 flex items-center justify-between gap-4">
                <span className="font-['JetBrains_Mono',monospace] tabular-nums text-xl font-medium text-[#3D3830]">
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
            Expand saved birth profile capacity and reduce or eliminate per-chart activation costs.
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
                    <p className="mt-1 font-['JetBrains_Mono',monospace] tabular-nums text-xl font-medium text-[#3D3830]">
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

      {/* Referral Tracking Note */}
      <section className="rounded-3xl bg-[#F1ECE3] border border-[#3D3830]/10 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Gift className="h-5 w-5 text-[#8B7355] shrink-0 mt-0.5" />
          <div>
            <h3 className="font-serif text-xl font-medium text-[#3D3830]">
              Payment-Gated Referral Rewards (+5,000 Credits Each)
            </h3>
            <p className="text-xs text-[#5C5449] mt-1 leading-relaxed">
              Your referral bonus unlocks automatically for both you and your invited friend as soon as they complete their first real credit purchase or paid profile activation.
            </p>
          </div>
        </div>
        <div className="font-['JetBrains_Mono',monospace] tabular-nums text-xs text-[#3D3830] shrink-0">
          {rewardedReferralsCount} Rewarded · {pendingReferralsCount} Pending
        </div>
      </section>

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
                      <td className="px-5 py-3 font-['JetBrains_Mono',monospace] tabular-nums text-[#8B8275] whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 capitalize text-[#3D3830] whitespace-nowrap">
                        {tx.tx_type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-5 py-3 text-[#5C5449]">
                        {tx.description || '—'}
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-['JetBrains_Mono',monospace] tabular-nums whitespace-nowrap ${
                          tx.amount >= 0 ? 'text-[#2D6A4F]' : 'text-[#3D3830]'
                        }`}
                      >
                        {tx.amount >= 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right font-['JetBrains_Mono',monospace] tabular-nums text-[#3D3830] whitespace-nowrap">
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
  );
};

export default BillingCredits;
