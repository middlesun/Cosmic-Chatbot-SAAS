import type { PlanTier } from './workspace-auth.ts';

export type BillingInterval = 'monthly' | 'yearly';
export type CheckoutPlan = 'pro' | 'studio' | 'agency';

export interface PlanSpec {
  id: 'free' | CheckoutPlan;
  tier: PlanTier;
  name: string;
  monthlyPriceUsd: number;
  yearlyPriceUsd: number;
  productLimit: number | null;
  storageLimitBytes: number;
  storageLimitLabel: string;
}

export const PLAN_SPECS: Record<'free' | CheckoutPlan, PlanSpec> = {
  free: {
    id: 'free',
    tier: 'basic',
    name: 'Free Starter',
    monthlyPriceUsd: 0,
    yearlyPriceUsd: 0,
    productLimit: 1,
    storageLimitBytes: 15 * 1024 * 1024,
    storageLimitLabel: '15 MB',
  },
  pro: {
    id: 'pro',
    tier: 'pro',
    name: 'Pro',
    monthlyPriceUsd: 9,
    yearlyPriceUsd: 69,
    productLimit: 3,
    storageLimitBytes: 250 * 1024 * 1024,
    storageLimitLabel: '250 MB',
  },
  studio: {
    id: 'studio',
    tier: 'studio',
    name: 'Studio',
    monthlyPriceUsd: 29,
    yearlyPriceUsd: 239,
    productLimit: 10,
    storageLimitBytes: 1024 * 1024 * 1024,
    storageLimitLabel: '1 GB',
  },
  agency: {
    id: 'agency',
    tier: 'unlimited',
    name: 'Agency',
    monthlyPriceUsd: 59,
    yearlyPriceUsd: 489,
    productLimit: 25,
    storageLimitBytes: 5 * 1024 * 1024 * 1024,
    storageLimitLabel: '5 GB',
  },
};

function readEnv(env: any, key: string): string {
  const pEnv = typeof process !== 'undefined' && process?.env ? process.env : {};
  const gEnv = typeof globalThis !== 'undefined' ? (globalThis as any) : {};
  return String(env?.[key] ?? pEnv[key] ?? gEnv[key] ?? '').trim();
}

export function resolveBillingInterval(rawInterval: unknown): BillingInterval {
  const clean = String(rawInterval || 'monthly').trim().toLowerCase();
  if (clean === 'yearly' || clean === 'annual' || clean === 'annually' || clean === 'year') {
    return 'yearly';
  }
  return 'monthly';
}

export function resolveCheckoutPlan(rawPlan: unknown): CheckoutPlan {
  const clean = String(rawPlan || 'pro').trim().toLowerCase();
  if (
    clean === 'agency' ||
    clean === 'unlimited' ||
    clean === 'team' ||
    clean === 'ultra' ||
    clean.startsWith('unlimited') ||
    clean.startsWith('agency')
  ) {
    return 'agency';
  }
  if (clean === 'studio' || clean === 'growth' || clean.startsWith('studio')) {
    return 'studio';
  }
  return 'pro';
}

export function checkoutPlanToTier(plan: CheckoutPlan): PlanTier {
  if (plan === 'agency') return 'unlimited';
  if (plan === 'studio') return 'studio';
  return 'pro';
}

export function getDodoPlanCatalog(env: any) {
  const legacyPro =
    readEnv(env, 'DODO_PAYMENTS_PRODUCT_ID') ||
    readEnv(env, 'DODO_PAYMENTS_PRODUCT_') ||
    'pdt_0NrfQ7YjOP1Tv9MLLRu02';
  const legacyUnlimited = readEnv(env, 'DODO_PAYMENTS_UNLIMITED_PRODUCT_ID') || legacyPro;

  const proMonthly = readEnv(env, 'DODO_PAYMENTS_PRO_MONTHLY_PRODUCT_ID') || legacyPro;
  const proYearly = readEnv(env, 'DODO_PAYMENTS_PRO_YEARLY_PRODUCT_ID') || proMonthly;

  const studioMonthly = readEnv(env, 'DODO_PAYMENTS_STUDIO_MONTHLY_PRODUCT_ID') || legacyUnlimited;
  const studioYearly = readEnv(env, 'DODO_PAYMENTS_STUDIO_YEARLY_PRODUCT_ID') || studioMonthly;

  const agencyMonthly = readEnv(env, 'DODO_PAYMENTS_AGENCY_MONTHLY_PRODUCT_ID') || legacyUnlimited;
  const agencyYearly = readEnv(env, 'DODO_PAYMENTS_AGENCY_YEARLY_PRODUCT_ID') || agencyMonthly;

  return {
    legacyPro,
    legacyUnlimited,
    proMonthly,
    proYearly,
    studioMonthly,
    studioYearly,
    agencyMonthly,
    agencyYearly,
  };
}

export function getDodoProductIdForPlan(env: any, plan: CheckoutPlan, interval: BillingInterval): string {
  const cat = getDodoPlanCatalog(env);
  if (plan === 'agency') {
    return interval === 'yearly' ? cat.agencyYearly : cat.agencyMonthly;
  }
  if (plan === 'studio') {
    return interval === 'yearly' ? cat.studioYearly : cat.studioMonthly;
  }
  return interval === 'yearly' ? cat.proYearly : cat.proMonthly;
}

export function formatTierDisplayName(tier: PlanTier): string {
  if (tier === 'unlimited') return 'Agency';
  if (tier === 'studio') return 'Studio';
  if (tier === 'pro') return 'Pro';
  return 'Free Starter';
}

export interface ResolvedWebhookOutcome {
  action: 'activate' | 'cancel' | 'ignore';
  eventType: string;
  email: string;
  userId: string;
  tier: PlanTier;
  interval: BillingInterval;
  subscriptionStatus: string;
  dodoSubscriptionId: string;
  dodoCustomerId: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export function resolveDodoWebhookOutcome(payload: any, env: any): ResolvedWebhookOutcome {
  const eventType = String(payload?.type || payload?.event || payload?.eventType || '').trim();
  const eventLower = eventType.toLowerCase();
  const data = payload?.data || payload || {};
  const dataStatus = String(data?.status || '').trim().toLowerCase();

  const email = String(
    data?.customer?.email ||
      data?.customer_email ||
      data?.metadata?.email ||
      data?.metadata?.user_email ||
      data?.billing?.email ||
      ''
  )
    .trim()
    .toLowerCase();

  const userId = String(
    data?.metadata?.userId ||
      data?.metadata?.user_id ||
      data?.customer?.metadata?.userId ||
      data?.customer?.metadata?.user_id ||
      ''
  ).trim();

  const dodoSubscriptionId = String(data?.subscription_id || (data?.object === 'subscription' ? data?.id : '') || '').trim();
  const dodoCustomerId = String(data?.customer?.customer_id || data?.customer_id || '').trim();
  const periodEndRaw = data?.next_billing_date || data?.current_period_end || data?.expires_at || null;
  const currentPeriodEnd = periodEndRaw ? new Date(periodEndRaw).toISOString() : null;
  const cancelAtPeriodEnd = Boolean(data?.cancel_at_next_billing_date || data?.cancel_at_period_end);

  const metadataPlan = String(data?.metadata?.plan || data?.customer?.metadata?.plan || '').trim().toLowerCase();
  const metadataInterval = resolveBillingInterval(
    data?.metadata?.interval || data?.payment_frequency_interval || data?.subscription_period_interval || 'monthly'
  );

  const cat = getDodoPlanCatalog(env);
  const paidProductId = String(data?.product_id || data?.product_cart?.[0]?.product_id || '').trim();
  const paidAmountCents = Number(data?.total_amount || data?.recurring_pre_tax_amount || data?.amount || 0);

  let resolvedTier: PlanTier = 'pro';
  if (
    metadataPlan === 'agency' ||
    metadataPlan === 'unlimited' ||
    metadataPlan.startsWith('unlimited') ||
    metadataPlan.startsWith('agency')
  ) {
    resolvedTier = 'unlimited';
  } else if (metadataPlan === 'studio' || metadataPlan.startsWith('studio')) {
    resolvedTier = 'studio';
  } else if (metadataPlan === 'pro' || metadataPlan.startsWith('pro')) {
    resolvedTier = 'pro';
  } else if (
    paidProductId &&
    ((readEnv(env, 'DODO_PAYMENTS_AGENCY_MONTHLY_PRODUCT_ID') && paidProductId === cat.agencyMonthly) ||
      (readEnv(env, 'DODO_PAYMENTS_AGENCY_YEARLY_PRODUCT_ID') && paidProductId === cat.agencyYearly) ||
      (readEnv(env, 'DODO_PAYMENTS_UNLIMITED_PRODUCT_ID') &&
        paidProductId === cat.legacyUnlimited &&
        cat.legacyUnlimited !== cat.legacyPro))
  ) {
    resolvedTier = 'unlimited';
  } else if (
    paidProductId &&
    ((readEnv(env, 'DODO_PAYMENTS_STUDIO_MONTHLY_PRODUCT_ID') && paidProductId === cat.studioMonthly) ||
      (readEnv(env, 'DODO_PAYMENTS_STUDIO_YEARLY_PRODUCT_ID') && paidProductId === cat.studioYearly))
  ) {
    resolvedTier = 'studio';
  } else if (metadataInterval === 'yearly') {
    if (paidAmountCents >= 45000) resolvedTier = 'unlimited';
    else if (paidAmountCents >= 20000) resolvedTier = 'studio';
    else resolvedTier = 'pro';
  } else {
    if (paidAmountCents >= 5000) resolvedTier = 'unlimited';
    else if (paidAmountCents >= 2500) resolvedTier = 'studio';
    else resolvedTier = 'pro';
  }

  const isCancelOrExpire =
    eventLower === 'subscription.expired' ||
    eventLower === 'subscription.cancelled' ||
    eventLower === 'subscription.on_hold' ||
    eventLower === 'subscription.failed' ||
    eventLower === 'subscription.paused' ||
    eventLower === 'refund.succeeded' ||
    eventLower === 'dispute.lost' ||
    dataStatus === 'expired' ||
    dataStatus === 'cancelled' ||
    dataStatus === 'on_hold' ||
    dataStatus === 'paused' ||
    dataStatus === 'refunded';

  if (isCancelOrExpire) {
    const hasFutureAccess =
      eventLower === 'subscription.cancelled' &&
      cancelAtPeriodEnd &&
      currentPeriodEnd &&
      Date.parse(currentPeriodEnd) > Date.now();
    const mappedStatus =
      eventLower === 'subscription.on_hold'
        ? 'on_hold'
        : eventLower === 'subscription.paused'
          ? 'paused'
          : eventLower === 'subscription.expired'
            ? 'expired'
            : eventLower === 'refund.succeeded'
              ? 'refunded'
              : 'cancelled';
    return {
      action: 'cancel',
      eventType,
      email,
      userId,
      tier: hasFutureAccess ? resolvedTier : 'basic',
      interval: metadataInterval,
      subscriptionStatus: mappedStatus,
      dodoSubscriptionId,
      dodoCustomerId,
      currentPeriodEnd,
      cancelAtPeriodEnd: eventLower === 'subscription.cancelled',
    };
  }

  const isSuccess =
    eventLower === 'payment.succeeded' ||
    eventLower === 'subscription.active' ||
    eventLower === 'subscription.renewed' ||
    eventLower === 'subscription.updated' ||
    eventLower === 'subscription.plan_changed' ||
    eventLower === 'subscription.unpaused' ||
    eventLower === 'checkout.session.completed' ||
    dataStatus === 'succeeded' ||
    dataStatus === 'paid' ||
    dataStatus === 'active';

  if (!isSuccess && eventType) {
    return {
      action: 'ignore',
      eventType,
      email,
      userId,
      tier: resolvedTier,
      interval: metadataInterval,
      subscriptionStatus: dataStatus || 'ignored',
      dodoSubscriptionId,
      dodoCustomerId,
      currentPeriodEnd,
      cancelAtPeriodEnd,
    };
  }

  return {
    action: 'activate',
    eventType,
    email,
    userId,
    tier: resolvedTier,
    interval: metadataInterval,
    subscriptionStatus: 'active',
    dodoSubscriptionId,
    dodoCustomerId,
    currentPeriodEnd,
    cancelAtPeriodEnd,
  };
}

export async function patchSupabaseProfileSafe(
  supabaseUrl: string,
  serviceOrAnonKey: string,
  filter: string,
  fullUpdate: Record<string, any>,
  minimalUpdate: Record<string, any>
): Promise<{ ok: boolean; status: number; rows: any[] }> {
  const endpoint = `${supabaseUrl}/rest/v1/profiles?${filter}`;
  const headers = {
    apikey: serviceOrAnonKey,
    Authorization: `Bearer ${serviceOrAnonKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  let res = await fetch(endpoint, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(fullUpdate),
  });

  if (res.status === 400 || res.status === 404) {
    // Graceful fallback if optional subscription columns have not yet been migrated
    res = await fetch(endpoint, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(minimalUpdate),
    });
  }

  const rows = res.ok ? await res.json().catch(() => []) : [];
  return { ok: res.ok, status: res.status, rows: Array.isArray(rows) ? rows : [] };
}

function timingSafeStringEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function decodeWebhookSecretBytes(secret: string): Uint8Array {
  const trimmed = secret.trim();
  const base64Part = trimmed.startsWith('whsec_') ? trimmed.slice(6) : '';
  if (base64Part) {
    try {
      const bin = atob(base64Part);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    } catch {
      // Fallback to raw UTF-8 bytes
    }
  }
  return new TextEncoder().encode(trimmed);
}

async function computeHmacSha256Bytes(keyBytes: Uint8Array, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
}

function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function bufferToBase64(buf: ArrayBuffer): string {
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export async function verifyDodoWebhookSignature(
  rawSecret: string,
  rawBody: string,
  headers: {
    webhookId?: string | null;
    webhookTimestamp?: string | null;
    webhookSignature?: string | null;
    legacySignature?: string | null;
  }
): Promise<{ valid: boolean; reason?: string }> {
  const secret = String(rawSecret || '').trim();
  if (!secret) return { valid: true, reason: 'no_secret_configured' };

  const webhookId = String(headers.webhookId || '').trim();
  const webhookTimestamp = String(headers.webhookTimestamp || '').trim();
  const webhookSignature = String(headers.webhookSignature || '').trim();
  const legacySignature = String(headers.legacySignature || '').trim();

  if (!webhookSignature && !legacySignature) {
    return { valid: false, reason: 'missing_signature_header' };
  }

  // 1. Standard Webhooks verification (used by Dodo Payments: webhook-id.webhook-timestamp.rawBody)
  if (webhookId && webhookTimestamp && webhookSignature) {
    const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody}`;
    const keyBytes = decodeWebhookSecretBytes(secret);
    const expectedB64 = bufferToBase64(await computeHmacSha256Bytes(keyBytes, signedPayload));
    const tokens = webhookSignature.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      const [version, sig] = token.split(',', 2);
      if (version === 'v1' && sig && timingSafeStringEqual(sig.trim(), expectedB64)) {
        return { valid: true };
      }
    }
  }

  // 2. Fallback: raw-body HMAC-SHA256 hex signature (for legacy custom/test callers)
  const rawUtf8Bytes = new TextEncoder().encode(secret);
  const expectedHex = bufferToHex(await computeHmacSha256Bytes(rawUtf8Bytes, rawBody)).toLowerCase();
  const candidate = (legacySignature || webhookSignature).toLowerCase();
  if (candidate) {
    const cleaned = candidate.replace(/^sha256=/, '').trim();
    if (timingSafeStringEqual(cleaned, expectedHex)) {
      return { valid: true };
    }
  }

  return { valid: false, reason: 'signature_mismatch' };
}

