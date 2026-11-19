import {
  formatTierDisplayName,
  patchSupabaseProfileSafe,
  resolveDodoWebhookOutcome,
  verifyDodoWebhookSignature,
} from '../../lib/pricing';

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  DODO_PAYMENTS_WEBHOOK_KEY?: string;
  DODO_PAYMENTS_PRODUCT_ID?: string;
  DODO_PAYMENTS_UNLIMITED_PRODUCT_ID?: string;
  DODO_PAYMENTS_PRO_MONTHLY_PRODUCT_ID?: string;
  DODO_PAYMENTS_PRO_YEARLY_PRODUCT_ID?: string;
  DODO_PAYMENTS_STUDIO_MONTHLY_PRODUCT_ID?: string;
  DODO_PAYMENTS_STUDIO_YEARLY_PRODUCT_ID?: string;
  DODO_PAYMENTS_AGENCY_MONTHLY_PRODUCT_ID?: string;
  DODO_PAYMENTS_AGENCY_YEARLY_PRODUCT_ID?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, webhook-id, webhook-signature, webhook-timestamp, x-dodo-signature',
  'Content-Type': 'application/json',
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

function getSupabaseConfig(env: any) {
  const cEnv = env || {};
  const rawUrl = cEnv.SUPABASE_URL || cEnv.VITE_SUPABASE_URL || '';
  const url = rawUrl.trim().replace(/\/+$/, '');
  const key = cEnv.SUPABASE_SERVICE_ROLE_KEY || cEnv.SUPABASE_SERVICE_ROLE_KE || cEnv.SUPABASE_ANON_KEY || cEnv.VITE_SUPABASE_ANON_KEY || '';
  return { url, key };
}

// POST /api/webhooks/dodo - Dodo Payments Subscription & Checkout Webhook Handler
export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const rawBody = await context.request.text();
    const webhookSecret = (context.env.DODO_PAYMENTS_WEBHOOK_KEY || (context.env as any).DODO_PAYMENTS_WEBHOOK_ || '').trim();

    if (webhookSecret) {
      const sigResult = await verifyDodoWebhookSignature(webhookSecret, rawBody, {
        webhookId: context.request.headers.get('webhook-id'),
        webhookTimestamp: context.request.headers.get('webhook-timestamp'),
        webhookSignature: context.request.headers.get('webhook-signature'),
        legacySignature: context.request.headers.get('x-dodo-signature'),
      });
      if (!sigResult.valid) {
        console.warn('[Dodo Webhook] Rejected invalid signature:', sigResult.reason);
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid webhook signature' }),
          { status: 401, headers: corsHeaders }
        );
      }
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON payload' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const outcome = resolveDodoWebhookOutcome(payload, context.env);
    if (outcome.action === 'ignore') {
      return new Response(
        JSON.stringify({ success: true, message: `Ignored unhandled event: ${outcome.eventType}` }),
        { status: 200, headers: corsHeaders }
      );
    }

    if (!outcome.email && !outcome.userId && !outcome.dodoSubscriptionId) {
      console.warn('[Dodo Webhook] No customer email, userId, or subscription_id found in payload');
      return new Response(
        JSON.stringify({ success: true, warning: 'Webhook received but no user identifier found' }),
        { status: 200, headers: corsHeaders }
      );
    }

    const { url, key } = getSupabaseConfig(context.env);
    if (!url || !key) {
      console.warn('[Dodo Webhook] Supabase credentials not configured in environment');
      return new Response(
        JSON.stringify({
          success: true,
          warning: 'Supabase offline; recorded webhook',
          action: outcome.action,
          tier: outcome.tier,
          interval: outcome.interval,
          subscriptionStatus: outcome.subscriptionStatus,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const filter = outcome.userId
      ? `id=eq.${encodeURIComponent(outcome.userId)}`
      : (outcome.email
        ? `email=eq.${encodeURIComponent(outcome.email)}`
        : `dodo_subscription_id=eq.${encodeURIComponent(outcome.dodoSubscriptionId)}`);

    const nowIso = new Date().toISOString();
    const fullUpdate: Record<string, any> = {
      tier: outcome.tier,
      billing_interval: outcome.interval,
      subscription_status: outcome.subscriptionStatus,
      cancel_at_period_end: outcome.cancelAtPeriodEnd,
      updated_at: nowIso,
    };
    if (outcome.dodoSubscriptionId) fullUpdate.dodo_subscription_id = outcome.dodoSubscriptionId;
    if (outcome.dodoCustomerId) fullUpdate.dodo_customer_id = outcome.dodoCustomerId;
    if (outcome.currentPeriodEnd) fullUpdate.current_period_end = outcome.currentPeriodEnd;

    const patchResult = await patchSupabaseProfileSafe(url, key, filter, fullUpdate, {
      tier: outcome.tier,
      updated_at: nowIso,
    });

    if (patchResult.ok) {
      const label = formatTierDisplayName(outcome.tier);
      const verb = outcome.action === 'cancel' ? 'subscription updated' : 'upgraded';
      return new Response(
        JSON.stringify({
          success: true,
          message: `Account ${verb} to ${label} (${outcome.subscriptionStatus})`,
          tier: outcome.tier,
          interval: outcome.interval,
          subscriptionStatus: outcome.subscriptionStatus,
          user: patchResult.rows?.[0] || { email: outcome.email, userId: outcome.userId, tier: outcome.tier },
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    console.warn(`[Dodo Webhook] Supabase patch status: ${patchResult.status}`);
    return new Response(
      JSON.stringify({ success: true, message: `Processed with Supabase status ${patchResult.status}` }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('[Dodo Webhook Error]:', err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
