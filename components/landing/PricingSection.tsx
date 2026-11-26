import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { EditorialReveal } from './EditorialPrimitives';

type PricingCurrency = 'INR' | 'USD' | 'AED' | 'EUR';

interface PublicMembershipTier {
  slug: 'personal' | 'pro' | 'guru';
  name: string;
  profileLimit: number;
  activationCostCredits: number;
  includedMonthlyCredits: number;
  prices: Record<PricingCurrency, number>;
  features: string[];
}

interface PublicCreditPack {
  slug: string;
  name: string;
  subtitle: string;
  credits: number;
  highlight?: string;
  prices: Record<PricingCurrency, number>;
}

const CURRENCIES: PricingCurrency[] = ['INR', 'USD', 'AED', 'EUR'];

const CURRENCY_SYMBOLS: Record<PricingCurrency, string> = {
  INR: '₹',
  USD: '$',
  AED: 'AED ',
  EUR: '€',
};

const DEFAULT_PUBLIC_TIERS: PublicMembershipTier[] = [
  {
    slug: 'personal',
    name: 'Personal Plan',
    profileLimit: 10,
    activationCostCredits: 0,
    includedMonthlyCredits: 0,
    prices: { INR: 0, USD: 0, AED: 0, EUR: 0 },
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
    prices: { INR: 1599, USD: 19, AED: 70, EUR: 18 },
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
    prices: { INR: 6999, USD: 79, AED: 290, EUR: 74 },
    features: [
      'Up to 200 saved client birth profiles',
      '80,000 credits included upon upgrade / renewal',
      'Unlimited free birth chart activations',
      'Built for practicing astrologers & family archives',
    ],
  },
];

const DEFAULT_PUBLIC_PACKS: PublicCreditPack[] = [
  {
    slug: 'pack_10k',
    name: 'Observatory Essential',
    subtitle:
      'Minimum standard top-up for focused Vedic consultations and deep research reports.',
    credits: 10000,
    prices: { INR: 1000, USD: 12, AED: 45, EUR: 11 },
  },
  {
    slug: 'pack_30k',
    name: 'Council Deep Practice',
    subtitle:
      'Ideal for active multi-profile explorations and Deep Research PDF reports.',
    credits: 30000,
    highlight: 'Most Popular',
    prices: { INR: 2700, USD: 32, AED: 118, EUR: 30 },
  },
  {
    slug: 'pack_75k',
    name: 'Jyotish Studio Reserve',
    subtitle:
      'High-capacity reserve for client practices and longitudinal chart consultations.',
    credits: 75000,
    highlight: 'Best Value',
    prices: { INR: 6000, USD: 72, AED: 265, EUR: 66 },
  },
];

function formatCurrencyAmount(amount: number, currency: PricingCurrency): string {
  if (amount === 0) return 'Free';
  return `${CURRENCY_SYMBOLS[currency]}${amount.toLocaleString()}`;
}

export const PricingSection: React.FC = () => {
  const [currency, setCurrency] = useState<PricingCurrency>(() => {
    if (typeof window === 'undefined') return 'INR';
    try {
      const saved = localStorage.getItem('cc_currency');
      if (saved === 'INR' || saved === 'USD' || saved === 'AED' || saved === 'EUR') {
        return saved;
      }
    } catch {
      // Ignore storage access errors
    }
    return 'INR';
  });
  const [tiers, setTiers] = useState<PublicMembershipTier[]>(DEFAULT_PUBLIC_TIERS);
  const [creditPacks, setCreditPacks] = useState<PublicCreditPack[]>(DEFAULT_PUBLIC_PACKS);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/pricing')
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            tiers?: PublicMembershipTier[];
            creditPacks?: PublicCreditPack[];
          } | null
        ) => {
          if (cancelled || !data) return;
          if (Array.isArray(data.tiers) && data.tiers.length > 0) {
            setTiers(data.tiers);
          }
          if (Array.isArray(data.creditPacks) && data.creditPacks.length > 0) {
            setCreditPacks(data.creditPacks);
          }
        }
      )
      .catch(() => {
        // Keep default existing pricing cleanly
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectCurrency = (next: PricingCurrency) => {
    setCurrency(next);
    try {
      localStorage.setItem('cc_currency', next);
    } catch {
      // Ignore storage access errors
    }
  };

  return (
    <section
      id="pricing"
      className="scroll-mt-24 bg-gradient-to-b from-[#FAF7F2] via-[#F7F2EA] to-[#F4EFE6] pt-16 sm:pt-24 pb-20 sm:pb-28 border-t border-[#3D3830]/10"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8 space-y-14 sm:space-y-16">
        {/* Section Header + Currency Selector */}
        <EditorialReveal>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-2xl space-y-3.5">
              <span className="inline-flex items-center rounded-full border border-[#3D3830]/14 bg-[#EAE2D3]/75 px-3.5 py-1 text-xs font-medium text-[#6B5A45]">
                Pricing
              </span>
              <h2
                className="font-['Cormorant_Garamond',serif] text-[clamp(2rem,4.2vw,3.35rem)] font-medium leading-[1.08] tracking-tight text-[#3D3830]"
                style={{ textWrap: 'balance' }}
              >
                Simple plans &amp; Credit Points
              </h2>
              <p className="text-base sm:text-lg leading-[1.65] text-[#5C5449]">
                Start free with 5,000 Credit Points on signup, expand saved birth profile capacity with a membership plan, or top up credits whenever you need.
              </p>
            </div>

            <div
              role="group"
              aria-label="Select pricing currency"
              className="inline-flex items-center gap-1 rounded-2xl bg-[#EFE8DC] p-1 border border-[#3D3830]/12 self-start lg:self-auto"
            >
              {CURRENCIES.map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => handleSelectCurrency(curr)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
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
        </EditorialReveal>

        {/* Membership Plans */}
        <div className="space-y-6">
          <EditorialReveal>
            <div className="space-y-1">
              <h3 className="font-['Cormorant_Garamond',serif] text-2xl sm:text-3xl font-medium text-[#3D3830]">
                Membership Plans
              </h3>
              <p className="text-xs sm:text-sm text-[#5C5449]">
                Expand saved birth profile capacity and receive included monthly Credit Points.
              </p>
            </div>
          </EditorialReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {tiers.map((tier, idx) => {
              const price = tier.prices[currency] ?? tier.prices.INR;
              const isHighlighted = tier.slug === 'pro';
              return (
                <EditorialReveal
                  key={tier.slug}
                  delay={idx * 70}
                  className="h-full"
                >
                  <div
                    className={`h-full rounded-3xl border p-6 sm:p-7 flex flex-col justify-between gap-6 transition-colors duration-200 ${
                      isHighlighted
                        ? 'bg-[#F1ECE3] border-[#3D3830]/25'
                        : 'bg-[#FDFBF7] border-[#3D3830]/12'
                    }`}
                  >
                    <div className="space-y-5">
                      <div className="flex items-center justify-between gap-2 text-xs text-[#8B8275]">
                        <span className="font-['DM_Sans',sans-serif] tabular-nums">
                          {tier.profileLimit} Profiles
                        </span>
                        {tier.includedMonthlyCredits > 0 && (
                          <span className="font-['DM_Sans',sans-serif] tabular-nums text-[#6B5A45]">
                            +{tier.includedMonthlyCredits.toLocaleString()} credits
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="font-['Cormorant_Garamond',serif] text-2xl font-medium text-[#3D3830]">
                          {tier.name}
                        </h4>
                        <p className="mt-2 font-['DM_Sans',sans-serif] tabular-nums text-2xl font-medium text-[#3D3830]">
                          {formatCurrencyAmount(price, currency)}
                          {price > 0 && (
                            <span className="font-['Plus_Jakarta_Sans',sans-serif] text-xs font-normal text-[#8B8275]">
                              {' '}
                              / month
                            </span>
                          )}
                        </p>
                      </div>

                      <ul className="space-y-2.5 text-sm text-[#5C5449]">
                        {tier.features.map((feat) => (
                          <li key={feat} className="flex items-start gap-2.5">
                            <Check className="h-4 w-4 text-[#8B7355] shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-4 border-t border-[#3D3830]/10">
                      <Link
                        to={tier.slug === 'personal' ? '/app/login' : '/app/billing'}
                        className={`w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          tier.slug === 'personal'
                            ? 'border border-[#3D3830]/20 bg-[#FAF7F2] text-[#3D3830] hover:bg-[#EAE3D7]'
                            : 'bg-[#4A453D] text-[#FAF7F2] hover:bg-[#38342E]'
                        }`}
                      >
                        <span>
                          {tier.slug === 'personal'
                            ? 'Start Free'
                            : `Choose ${tier.name.replace(' Plan', '')}`}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </EditorialReveal>
              );
            })}
          </div>
        </div>

        {/* Top-Up Credit Packs */}
        <div className="space-y-6 pt-4 border-t border-[#3D3830]/10">
          <EditorialReveal>
            <div className="space-y-1">
              <h3 className="font-['Cormorant_Garamond',serif] text-2xl sm:text-3xl font-medium text-[#3D3830]">
                Top Up Credit Points
              </h3>
              <p className="text-xs sm:text-sm text-[#5C5449]">
                Credits never expire and work across Chat consultations and Deep Research reports.
              </p>
            </div>
          </EditorialReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {creditPacks.map((pack, idx) => {
              const packPrice = pack.prices[currency] ?? pack.prices.INR;
              return (
                <EditorialReveal
                  key={pack.slug}
                  delay={idx * 70}
                  className="h-full"
                >
                  <div className="h-full rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-6 sm:p-7 flex flex-col justify-between gap-6 hover:border-[#8B7355]/45 transition-colors">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-[#8B8275]">{pack.name}</span>
                        {pack.highlight && (
                          <span className="font-medium text-[#8B7355]">{pack.highlight}</span>
                        )}
                      </div>

                      <div>
                        <p className="font-['DM_Sans',sans-serif] tabular-nums text-3xl font-medium text-[#3D3830] leading-tight">
                          {pack.credits.toLocaleString()}
                        </p>
                        <p className="text-sm font-medium text-[#5C5449] mt-0.5">
                          Credit Points
                        </p>
                      </div>

                      <p className="text-xs sm:text-sm text-[#5C5449] leading-relaxed">
                        {pack.subtitle}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-[#3D3830]/10 flex items-center justify-between gap-4">
                      <span className="font-['DM_Sans',sans-serif] tabular-nums text-xl font-medium text-[#3D3830]">
                        {formatCurrencyAmount(packPrice, currency)}
                      </span>
                      <Link
                        to="/app/billing"
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-2xl bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors whitespace-nowrap shrink-0"
                      >
                        <span>Buy Now</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </EditorialReveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
