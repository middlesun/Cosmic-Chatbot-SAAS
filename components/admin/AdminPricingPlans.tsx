import React, { useEffect, useState } from 'react';
import {
  Check,
  Coins,
  CreditCard,
  Crown,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';

type SupportedCurrency = 'INR' | 'USD' | 'AED' | 'EUR';

interface CreditPackConfig {
  slug: string;
  name: string;
  subtitle: string;
  credits: number;
  highlight?: string;
  prices: Record<SupportedCurrency, number>;
  dodo_product_id?: string;
  is_active: boolean;
}

interface MembershipTierConfig {
  slug: 'personal' | 'pro' | 'guru';
  name: string;
  profileLimit: number;
  activationCostCredits: number;
  includedMonthlyCredits: number;
  prices: Record<SupportedCurrency, number>;
  features: string[];
  dodo_product_id?: string;
}

interface PricingConfig {
  signup_welcome_credits: number;
  referral_reward_credits: number;
  min_credits_to_chat: number;
  chat_billing: {
    output_token_weight: number;
    input_token_weight: number;
    min_credits_per_reply: number;
    max_credits_per_reply: number;
  };
  credit_packs: CreditPackConfig[];
  membership_tiers: MembershipTierConfig[];
}

interface AdminPricingPlansProps {
  getAccessToken: () => Promise<string | null>;
}

const CURRENCIES: SupportedCurrency[] = ['INR', 'USD', 'AED', 'EUR'];

const AdminPricingPlans: React.FC<AdminPricingPlansProps> = ({ getAccessToken }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PricingConfig | null>(null);

  const loadPricing = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/settings/pricing', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load pricing settings');
      setPricing(data.pricing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load pricing settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPricing();
  }, []);

  const handleSave = async () => {
    if (!pricing) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/settings/pricing', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(pricing),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save pricing');
      setPricing(data.pricing);
      setFeedback('Pricing, membership tiers, and credit billing rules are now live across the platform.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pricing settings');
    } finally {
      setSaving(false);
    }
  };

  const updatePack = (index: number, patch: Partial<CreditPackConfig>) => {
    setPricing((prev) => {
      if (!prev) return prev;
      const next = [...prev.credit_packs];
      next[index] = { ...next[index], ...patch };
      return { ...prev, credit_packs: next };
    });
  };

  const updatePackPrice = (index: number, currency: SupportedCurrency, value: number) => {
    setPricing((prev) => {
      if (!prev) return prev;
      const next = [...prev.credit_packs];
      next[index] = {
        ...next[index],
        prices: { ...next[index].prices, [currency]: Math.max(0, value) },
      };
      return { ...prev, credit_packs: next };
    });
  };

  const addPack = () => {
    setPricing((prev) => {
      if (!prev) return prev;
      const idx = prev.credit_packs.length + 1;
      return {
        ...prev,
        credit_packs: [
          ...prev.credit_packs,
          {
            slug: `pack_custom_${idx}`,
            name: `Custom Pack ${idx}`,
            subtitle: 'Flexible consultation & deep research credits.',
            credits: 15000,
            prices: { INR: 1499, USD: 18, AED: 65, EUR: 17 },
            is_active: true,
          },
        ],
      };
    });
  };

  const removePack = (index: number) => {
    setPricing((prev) => {
      if (!prev || prev.credit_packs.length <= 1) return prev;
      return {
        ...prev,
        credit_packs: prev.credit_packs.filter((_, i) => i !== index),
      };
    });
  };

  const updateTier = (index: number, patch: Partial<MembershipTierConfig>) => {
    setPricing((prev) => {
      if (!prev) return prev;
      const next = [...prev.membership_tiers];
      next[index] = { ...next[index], ...patch };
      return { ...prev, membership_tiers: next };
    });
  };

  const updateTierPrice = (index: number, currency: SupportedCurrency, value: number) => {
    setPricing((prev) => {
      if (!prev) return prev;
      const next = [...prev.membership_tiers];
      next[index] = {
        ...next[index],
        prices: { ...next[index].prices, [currency]: Math.max(0, value) },
      };
      return { ...prev, membership_tiers: next };
    });
  };

  if (loading || !pricing) {
    return (
      <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-10 text-center text-sm text-[#8B8275]">
        Loading Pricing & Plans configuration...
      </div>
    );
  }

  const sampleDetailedCredits = Math.max(
    pricing.chat_billing.min_credits_per_reply,
    Math.min(
      pricing.chat_billing.max_credits_per_reply,
      Math.ceil(900 * pricing.chat_billing.output_token_weight + 2200 * pricing.chat_billing.input_token_weight)
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-medium text-[#3D3830]">Pricing & Plans</h2>
          <p className="mt-1 text-xs text-[#5C5449]">
            Configure credit packs, membership tiers, multi-currency pricing, signup/referral bonuses, and chat credit rates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadPricing()}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save Pricing & Plans'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-4 py-3 text-xs text-[#7A3E36]">
          {error}
        </div>
      )}
      {feedback && (
        <div className="rounded-2xl border border-[#2D6A4F]/25 bg-[#2D6A4F]/8 px-4 py-3 text-xs text-[#2D6A4F] flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* 1. Credit Economy & Chat Metering */}
      <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-[#EAE3D7]/80 flex items-center justify-center text-[#3D3830]">
              <Coins className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#3D3830]">Credit Economy & Chat Metering</h3>
              <p className="text-xs text-[#8B8275]">
                Controls signup bonuses, referral rewards, and per-message credit calculation.
              </p>
            </div>
          </div>
          <div className="text-xs text-[#5C5449] rounded-xl bg-[#F1ECE3]/75 px-3 py-1.5 font-mono tabular-nums">
            Sample 900-tok reply ≈ <strong>{sampleDetailedCredits} credits</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div>
            <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
              Signup Welcome Credits
            </label>
            <input
              type="number"
              min={0}
              value={pricing.signup_welcome_credits}
              onChange={(e) =>
                setPricing((prev) =>
                  prev ? { ...prev, signup_welcome_credits: Number(e.target.value) || 0 } : prev
                )
              }
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
              Referral Bonus Credits (each)
            </label>
            <input
              type="number"
              min={0}
              value={pricing.referral_reward_credits}
              onChange={(e) =>
                setPricing((prev) =>
                  prev ? { ...prev, referral_reward_credits: Number(e.target.value) || 0 } : prev
                )
              }
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
              Min Balance to Send Chat
            </label>
            <input
              type="number"
              min={0}
              value={pricing.min_credits_to_chat}
              onChange={(e) =>
                setPricing((prev) =>
                  prev ? { ...prev, min_credits_to_chat: Number(e.target.value) || 0 } : prev
                )
              }
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
              Min / Max Credits per Reply
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={pricing.chat_billing.min_credits_per_reply}
                onChange={(e) =>
                  setPricing((prev) =>
                    prev
                      ? {
                          ...prev,
                          chat_billing: {
                            ...prev.chat_billing,
                            min_credits_per_reply: Number(e.target.value) || 0,
                          },
                        }
                      : prev
                  )
                }
                className="w-1/2 rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-2.5 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
              />
              <input
                type="number"
                min={10}
                value={pricing.chat_billing.max_credits_per_reply}
                onChange={(e) =>
                  setPricing((prev) =>
                    prev
                      ? {
                          ...prev,
                          chat_billing: {
                            ...prev.chat_billing,
                            max_credits_per_reply: Number(e.target.value) || 100,
                          },
                        }
                      : prev
                  )
                }
                className="w-1/2 rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-2.5 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
              Output Token Weight
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={pricing.chat_billing.output_token_weight}
              onChange={(e) =>
                setPricing((prev) =>
                  prev
                    ? {
                        ...prev,
                        chat_billing: {
                          ...prev.chat_billing,
                          output_token_weight: Number(e.target.value) || 0,
                        },
                      }
                    : prev
                )
              }
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
              Input Token Weight
            </label>
            <input
              type="number"
              step="0.005"
              min={0}
              value={pricing.chat_billing.input_token_weight}
              onChange={(e) =>
                setPricing((prev) =>
                  prev
                    ? {
                        ...prev,
                        chat_billing: {
                          ...prev.chat_billing,
                          input_token_weight: Number(e.target.value) || 0,
                        },
                      }
                    : prev
                )
              }
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
            />
          </div>
        </div>
      </section>

      {/* 2. Credit Top-Up Packs */}
      <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-[#EAE3D7]/80 flex items-center justify-center text-[#3D3830]">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#3D3830]">Credit Top-Up Packs</h3>
              <p className="text-xs text-[#8B8275]">
                Displayed directly on the user Credits & Billing store across INR, USD, AED, and EUR.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={addPack}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7]/70 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Credit Pack
          </button>
        </div>

        <div className="space-y-4">
          {pricing.credit_packs.map((pack, idx) => (
            <div
              key={`${pack.slug}-${idx}`}
              className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-[#8B8275]">#{idx + 1}</span>
                  <label className="inline-flex items-center gap-1.5 text-xs text-[#3D3830] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pack.is_active !== false}
                      onChange={(e) => updatePack(idx, { is_active: e.target.checked })}
                      className="accent-[#4A453D]"
                    />
                    Active in store
                  </label>
                </div>
                {pricing.credit_packs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePack(idx)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[#7A3E36] hover:bg-[#7A3E36]/10 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#8B8275] mb-1">
                    Pack Name
                  </label>
                  <input
                    type="text"
                    value={pack.name}
                    onChange={(e) => updatePack(idx, { name: e.target.value })}
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 text-xs text-[#3D3830]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#8B8275] mb-1">
                    Slug
                  </label>
                  <input
                    type="text"
                    value={pack.slug}
                    onChange={(e) => updatePack(idx, { slug: e.target.value })}
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 font-mono text-xs text-[#5C5449]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#8B8275] mb-1">
                    Credits Granted
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={pack.credits}
                    onChange={(e) => updatePack(idx, { credits: Number(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#8B8275] mb-1">
                    Highlight Label (optional)
                  </label>
                  <input
                    type="text"
                    value={pack.highlight || ''}
                    onChange={(e) => updatePack(idx, { highlight: e.target.value })}
                    placeholder="Most Popular"
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 text-xs text-[#3D3830]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#8B8275] mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={pack.subtitle}
                    onChange={(e) => updatePack(idx, { subtitle: e.target.value })}
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 text-xs text-[#3D3830]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#8B8275] mb-1">
                    Dodo Product ID (optional override)
                  </label>
                  <input
                    type="text"
                    value={pack.dodo_product_id || ''}
                    onChange={(e) => updatePack(idx, { dodo_product_id: e.target.value })}
                    placeholder="pdt_..."
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 font-mono text-xs text-[#5C5449]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {CURRENCIES.map((curr) => (
                  <div key={curr}>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8B8275] mb-1">
                      Price ({curr})
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={pack.prices[curr] ?? 0}
                      onChange={(e) => updatePackPrice(idx, curr, Number(e.target.value) || 0)}
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Membership Tiers */}
      <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-2xl bg-[#EAE3D7]/80 flex items-center justify-center text-[#3D3830]">
            <Crown className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#3D3830]">Membership Plans (Personal · Pro · Guru)</h3>
            <p className="text-xs text-[#8B8275]">
              Profile limits enforce immediately when users create birth profiles; prices and included credits apply to Dodo upgrades.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {pricing.membership_tiers.map((tier, idx) => (
            <div
              key={tier.slug}
              className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#8B7355]">
                  {tier.slug}
                </span>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#8B8275] mb-1">
                  Plan Name
                </label>
                <input
                  type="text"
                  value={tier.name}
                  onChange={(e) => updateTier(idx, { name: e.target.value })}
                  className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 text-xs font-medium text-[#3D3830]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#8B8275] mb-1">
                    Profile Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={tier.profileLimit}
                    onChange={(e) =>
                      updateTier(idx, { profileLimit: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#8B8275] mb-1">
                    Monthly Credits
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={tier.includedMonthlyCredits}
                    onChange={(e) =>
                      updateTier(idx, { includedMonthlyCredits: Number(e.target.value) || 0 })
                    }
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {CURRENCIES.map((curr) => (
                  <div key={curr}>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8B8275] mb-1">
                      {curr}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={tier.prices[curr] ?? 0}
                      onChange={(e) => updateTierPrice(idx, curr, Number(e.target.value) || 0)}
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[#3D3830]"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#8B8275] mb-1">
                  Dodo Product ID (optional)
                </label>
                <input
                  type="text"
                  value={tier.dodo_product_id || ''}
                  onChange={(e) => updateTier(idx, { dodo_product_id: e.target.value })}
                  placeholder="pdt_..."
                  className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 font-mono text-[11px] text-[#5C5449]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#8B8275] mb-1">
                  Features (one per line)
                </label>
                <textarea
                  rows={4}
                  value={(tier.features || []).join('\n')}
                  onChange={(e) =>
                    updateTier(idx, {
                      features: e.target.value
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 text-xs text-[#3D3830] leading-relaxed"
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminPricingPlans;
