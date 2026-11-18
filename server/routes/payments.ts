import crypto from 'crypto';
import express, { Router, type Request, type Response } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { sendPaymentReceiptEmail } from '../services/email';
import { rewardReferralIfEligible } from '../services/referralReward';

const router = Router();

export type SupportedCurrency = 'INR' | 'USD' | 'AED' | 'EUR';

export interface CreditPackItem {
  slug: string;
  name: string;
  subtitle: string;
  credits: number;
  highlight?: string;
  prices: Record<SupportedCurrency, number>;
}

export interface MembershipTierItem {
  slug: 'personal' | 'pro' | 'guru';
  name: string;
  profileLimit: number;
  activationCostCredits: number;
  includedMonthlyCredits: number;
  prices: Record<SupportedCurrency, number>;
  features: string[];
}

export const CREDIT_PACKS: CreditPackItem[] = [
  {
    slug: 'pack_10k',
    name: 'Observatory Essential',
    subtitle: 'Minimum standard top-up for focused Vedic consultations and chart activations.',
    credits: 10000,
    prices: { INR: 1000, USD: 12, AED: 45, EUR: 11 },
  },
  {
    slug: 'pack_30k',
    name: 'Council Deep Practice',
    subtitle: 'Ideal for active multi-profile explorations and Deep Research PDF reports.',
    credits: 30000,
    highlight: 'Most Popular',
    prices: { INR: 2700, USD: 32, AED: 118, EUR: 30 },
  },
  {
    slug: 'pack_75k',
    name: 'Jyotish Studio Reserve',
    subtitle: 'High-capacity reserve for client practices and longitudinal chart consultations.',
    credits: 75000,
    highlight: 'Best Value',
    prices: { INR: 6000, USD: 72, AED: 265, EUR: 66 },
  },
];

export const MEMBERSHIP_TIERS: MembershipTierItem[] = [
  {
    slug: 'personal',
    name: 'Personal Plan',
    profileLimit: 5,
    activationCostCredits: Number(process.env.ACTIVATION_CREDITS_PERSONAL) || 2000,
    includedMonthlyCredits: 0,
    prices: { INR: 0, USD: 0, AED: 0, EUR: 0 },
    features: [
      'Up to 5 saved birth profiles',
      '2,000 credits per birth chart activation',
      'Full D1–D60, KP Sub-Lords & Jaimini viewer',
      'Timing Radar & multi-system Chat Studio',
    ],
  },
  {
    slug: 'pro',
    name: 'Professional Plan',
    profileLimit: 50,
    activationCostCredits: Number(process.env.ACTIVATION_CREDITS_PRO) || 1000,
    includedMonthlyCredits: 25000,
    prices: { INR: 2499, USD: 29, AED: 108, EUR: 27 },
    features: [
      'Up to 50 saved birth profiles',
      '1,000 credits per birth chart activation (50% off)',
      'Includes 25,000 credits upon upgrade / renewal',
      'Priority Deep Research report queue',
    ],
  },
  {
    slug: 'guru',
    name: 'Guru Plan',
    profileLimit: 200,
    activationCostCredits: Number(process.env.ACTIVATION_CREDITS_GURU) || 0,
    includedMonthlyCredits: 80000,
    prices: { INR: 6999, USD: 79, AED: 290, EUR: 74 },
    features: [
      'Up to 200 saved client birth profiles',
      '0 credits per activation (unlimited free activations)',
      'Includes 80,000 credits upon upgrade / renewal',
      'Built for practicing astrologers & family archives',
    ],
  },
];

function getDodoBaseUrl(): string {
  return process.env.DODO_ENVIRONMENT === 'live'
    ? 'https://live.dodopayments.com'
    : 'https://test.dodopayments.com';
}

export function isDodoConfigured(): boolean {
  return Boolean(process.env.DODO_API_KEY);
}

function getSmallestUnitAmount(amount: number): number {
  // Dodo Payments expects minor currency units (paise/cents/fils)
  return Math.round(amount * 100);
}

// 1. Catalog + User Ledger + Payment Orders + Referral Summary
router.get('/catalog', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const [{ data: transactions }, { data: orders }, { data: referrals }] = await Promise.all([
    supabaseAdmin
      .from('credit_transactions')
      .select('*')
      .eq('user_id', req.appUser.id)
      .order('created_at', { ascending: false })
      .limit(40),
    supabaseAdmin
      .from('payment_orders')
      .select('*')
      .eq('user_id', req.appUser.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('referrals')
      .select('id, status, reward_credits, created_at, rewarded_at')
      .eq('referrer_id', req.appUser.id)
      .order('created_at', { ascending: false }),
  ]);

  res.json({
    creditPacks: CREDIT_PACKS,
    tiers: MEMBERSHIP_TIERS,
    dodoConfigured: isDodoConfigured(),
    transactions: transactions || [],
    orders: orders || [],
    referrals: referrals || [],
  });
});

// 2. Initiate Dodo Payments Checkout Session
router.post('/checkout', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const dodoKey = process.env.DODO_API_KEY;
  if (!dodoKey) {
    res.status(503).json({
      error: 'DODO_API_KEY is not configured yet. Add your Dodo Payments key in environment secrets to accept live/test payments.',
      code: 'DODO_NOT_CONFIGURED',
    });
    return;
  }

  const { orderType, slug, currency } = req.body || {};
  const selectedCurrency: SupportedCurrency = ['INR', 'USD', 'AED', 'EUR'].includes(currency)
    ? currency
    : req.appUser.currency_pref || 'INR';

  let itemName = '';
  let priceMajor = 0;
  let creditsToGrant = 0;
  let targetTier: 'personal' | 'pro' | 'guru' | null = null;
  let normalizedType: 'credit_pack' | 'subscription' = 'credit_pack';

  if (orderType === 'subscription') {
    const tier = MEMBERSHIP_TIERS.find((t) => t.slug === slug && t.slug !== 'personal');
    if (!tier) {
      res.status(400).json({ error: 'Invalid membership tier selected.' });
      return;
    }
    normalizedType = 'subscription';
    itemName = `Cosmic Council ${tier.name}`;
    priceMajor = tier.prices[selectedCurrency];
    creditsToGrant = tier.includedMonthlyCredits;
    targetTier = tier.slug;
  } else {
    const pack = CREDIT_PACKS.find((p) => p.slug === slug);
    if (!pack) {
      res.status(400).json({ error: 'Invalid credit pack selected.' });
      return;
    }
    normalizedType = 'credit_pack';
    itemName = `${pack.name} (${pack.credits.toLocaleString()} Credits)`;
    priceMajor = pack.prices[selectedCurrency];
    creditsToGrant = pack.credits;
  }

  const origin = `${req.protocol}://${req.get('host')}`;
  const returnUrl = `${origin}/app/billing?payment=returned`;

  // Optional mapping to pre-created Dodo Product IDs in env, or dynamic checkout product_cart
  const dodoProductEnvKey = `DODO_PRODUCT_${String(slug).toUpperCase()}`;
  const configuredProductId = process.env[dodoProductEnvKey];

  try {
    const payload: Record<string, unknown> = {
      customer: {
        email: req.appUser.email,
        name: req.appUser.full_name || req.appUser.email,
      },
      billing_currency: selectedCurrency,
      return_url: returnUrl,
      metadata: {
        user_id: req.appUser.id,
        order_type: normalizedType,
        package_slug: slug,
        credits_to_grant: String(creditsToGrant),
        target_tier: targetTier || '',
        currency: selectedCurrency,
        amount_major: String(priceMajor),
      },
    };

    if (configuredProductId) {
      payload.product_cart = [{ product_id: configuredProductId, quantity: 1 }];
    } else {
      // Dynamic payment link amount payload supported by Dodo Payments checkouts
      payload.product_cart = [
        {
          name: itemName,
          amount: getSmallestUnitAmount(priceMajor),
          quantity: 1,
        },
      ];
    }

    const dodoRes = await fetch(`${getDodoBaseUrl()}/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${dodoKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const dodoData = (await dodoRes.json().catch(() => ({}))) as {
      session_id?: string;
      payment_id?: string;
      checkout_url?: string;
      message?: string;
      error?: string;
    };

    if (!dodoRes.ok || !dodoData.checkout_url) {
      throw new Error(
        dodoData.message || dodoData.error || `Dodo checkout creation failed (${dodoRes.status})`
      );
    }

    const dodoRefId = dodoData.payment_id || dodoData.session_id || `dodo_${Date.now()}`;

    await supabaseAdmin.from('payment_orders').insert({
      user_id: req.appUser.id,
      dodo_payment_id: dodoRefId,
      order_type: normalizedType,
      package_slug: String(slug),
      amount_paid: priceMajor,
      currency: selectedCurrency,
      credits_granted: creditsToGrant,
      status: 'pending',
      metadata: {
        target_tier: targetTier,
        item_name: itemName,
        session_id: dodoData.session_id || null,
      },
    });

    res.json({
      checkoutUrl: dodoData.checkout_url,
      dodoReferenceId: dodoRefId,
    });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Unable to start payment session',
    });
  }
});

// Verify Standard Webhooks / Dodo Payments HMAC-SHA256 signature cleanly
function verifyDodoWebhookSignature(
  rawBody: Buffer,
  headers: Request['headers'],
  secret: string
): boolean {
  const sigHeader = String(headers['webhook-signature'] || '');
  const msgId = String(headers['webhook-id'] || '');
  const msgTimestamp = String(headers['webhook-timestamp'] || '');

  if (!sigHeader || !msgId || !msgTimestamp) {
    return false;
  }

  // Standard Webhooks secret starts with whsec_<base64> or raw string
  const secretKey = secret.startsWith('whsec_')
    ? Buffer.from(secret.slice(6), 'base64')
    : Buffer.from(secret, 'utf8');

  const signedContent = `${msgId}.${msgTimestamp}.${rawBody.toString('utf8')}`;
  const expectedSig = crypto
    .createHmac('sha256', secretKey)
    .update(signedContent)
    .digest('base64');

  const candidates = sigHeader.split(' ').map((part) => {
    const [, val] = part.split(',');
    return val || part;
  });

  return candidates.some((candidate) => {
    try {
      const a = Buffer.from(candidate);
      const b = Buffer.from(expectedSig);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

// 3. Dodo Payments Webhook Handler (Raw body required for HMAC signature verification)
export const dodoWebhookMiddleware = [
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Backend unavailable' });
      return;
    }

    const webhookSecret = process.env.DODO_WEBHOOK_SECRET;
    const rawBuffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body || {}));

    if (webhookSecret) {
      const valid = verifyDodoWebhookSignature(rawBuffer, req.headers, webhookSecret);
      if (!valid) {
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }
    }

    let event: {
      type?: string;
      data?: {
        payment_id?: string;
        subscription_id?: string;
        checkout_session_id?: string;
        total_amount?: number;
        currency?: string;
        metadata?: Record<string, string>;
      };
    };

    try {
      event = JSON.parse(rawBuffer.toString('utf8'));
    } catch {
      res.status(400).json({ error: 'Malformed JSON webhook body' });
      return;
    }

    const eventType = event.type || '';
    const data = event.data || {};
    const meta = data.metadata || {};

    // Process only successful payment or subscription activation events
    if (
      eventType !== 'payment.succeeded' &&
      eventType !== 'subscription.active' &&
      eventType !== 'subscription.renewed'
    ) {
      res.json({ received: true, ignored: eventType });
      return;
    }

    const dodoPaymentId =
      data.payment_id || data.checkout_session_id || data.subscription_id;
    const userId = meta.user_id;
    const creditsToGrant = Number(meta.credits_to_grant) || 0;
    const targetTier = meta.target_tier as 'personal' | 'pro' | 'guru' | '';
    const orderType = meta.order_type === 'subscription' ? 'subscription' : 'credit_pack';
    const packageSlug = meta.package_slug || 'pack_10k';
    const amountPaid =
      Number(meta.amount_major) ||
      (typeof data.total_amount === 'number' ? data.total_amount / 100 : 0);
    const currency = (data.currency || meta.currency || 'INR').toUpperCase();

    if (!dodoPaymentId || !userId) {
      res.status(400).json({ error: 'Missing payment reference or user metadata' });
      return;
    }

    try {
      // Idempotency guard: ensure payment is processed at most once
      const { data: existingOrder } = await supabaseAdmin
        .from('payment_orders')
        .select('*')
        .eq('dodo_payment_id', dodoPaymentId)
        .maybeSingle();

      if (existingOrder?.status === 'succeeded') {
        res.json({ received: true, idempotent: true });
        return;
      }

      if (existingOrder) {
        const { data: locked } = await supabaseAdmin
          .from('payment_orders')
          .update({ status: 'succeeded' })
          .eq('id', existingOrder.id)
          .neq('status', 'succeeded')
          .select('*')
          .maybeSingle();

        if (!locked) {
          res.json({ received: true, idempotent: true });
          return;
        }
      } else {
        await supabaseAdmin.from('payment_orders').insert({
          user_id: userId,
          dodo_payment_id: dodoPaymentId,
          order_type: orderType,
          package_slug: packageSlug,
          amount_paid: amountPaid,
          currency,
          credits_granted: creditsToGrant,
          status: 'succeeded',
          metadata: meta,
        });
      }

      // Grant credits atomically
      if (creditsToGrant > 0) {
        await supabaseAdmin.rpc('grant_user_credits', {
          p_user_id: userId,
          p_amount: creditsToGrant,
          p_tx_type: orderType === 'subscription' ? 'subscription_grant' : 'purchase',
          p_reference_id: dodoPaymentId,
          p_description: `${orderType === 'subscription' ? 'Membership' : 'Credit Pack'} (${packageSlug})`,
        });
      }

      // Upgrade membership tier if subscription checkout
      if (targetTier && ['pro', 'guru'].includes(targetTier)) {
        await supabaseAdmin
          .from('users')
          .update({ tier: targetTier, updated_at: new Date().toISOString() })
          .eq('id', userId);
      }

      // Unlock payment-gated +5,000 referral bonus if user was referred
      await rewardReferralIfEligible(userId);

      // Send Resend receipt email (best-effort)
      const { data: userRow } = await supabaseAdmin
        .from('users')
        .select('email, full_name')
        .eq('id', userId)
        .maybeSingle();

      if (userRow?.email) {
        void sendPaymentReceiptEmail({
          to: userRow.email,
          name: userRow.full_name,
          amountPaid,
          currency,
          creditsGranted: creditsToGrant,
          packageLabel: packageSlug,
          orderId: dodoPaymentId,
        });
      }

      res.json({ received: true, processed: true });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Webhook processing failed',
      });
    }
  },
];

export default router;
