import {
  getDodoProductIdForPlan,
  resolveBillingInterval,
  resolveCheckoutPlan,
} from '../../lib/pricing';

interface Env {
  DODO_PAYMENTS_API_KEY?: string;
  DODO_PAYMENTS_PRODUCT_ID?: string;
  DODO_PAYMENTS_UNLIMITED_PRODUCT_ID?: string;
  DODO_PAYMENTS_PRO_MONTHLY_PRODUCT_ID?: string;
  DODO_PAYMENTS_PRO_YEARLY_PRODUCT_ID?: string;
  DODO_PAYMENTS_STUDIO_MONTHLY_PRODUCT_ID?: string;
  DODO_PAYMENTS_STUDIO_YEARLY_PRODUCT_ID?: string;
  DODO_PAYMENTS_AGENCY_MONTHLY_PRODUCT_ID?: string;
  DODO_PAYMENTS_AGENCY_YEARLY_PRODUCT_ID?: string;
  DODO_PAYMENTS_MODE?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  return handleCheckout(context.request, context.env, 'GET');
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  return handleCheckout(context.request, context.env, 'POST');
}

async function handleCheckout(request: Request, env: Env, method: 'GET' | 'POST') {
  try {
    const url = new URL(request.url);
    let email = (url.searchParams.get('email') || '').trim().toLowerCase();
    let userId = (url.searchParams.get('userId') || '').trim();
    let returnUrl = (url.searchParams.get('returnUrl') || '').trim();
    let requestedPlanRaw = (url.searchParams.get('plan') || 'pro').trim().toLowerCase();
    let requestedIntervalRaw = (url.searchParams.get('interval') || 'monthly').trim().toLowerCase();
    const isJson = Boolean(url.searchParams.get('json'));

    if (method === 'POST') {
      try {
        const body = (await request.json()) as any;
        if (body.email) email = body.email.trim().toLowerCase();
        if (body.userId) userId = body.userId.trim();
        if (body.returnUrl) returnUrl = body.returnUrl.trim();
        if (body.plan) requestedPlanRaw = String(body.plan).trim().toLowerCase();
        if (body.interval) requestedIntervalRaw = String(body.interval).trim().toLowerCase();
      } catch (_) {}
    }

    const resolvedPlan = resolveCheckoutPlan(requestedPlanRaw);
    const resolvedInterval = resolveBillingInterval(requestedIntervalRaw);
    const productId = getDodoProductIdForPlan(env, resolvedPlan, resolvedInterval);

    const apiKey = (env.DODO_PAYMENTS_API_KEY || '').trim();
    const isLive = env.DODO_PAYMENTS_MODE === 'live';
    const origin = url.origin;
    const finalReturnUrl =
      returnUrl ||
      `${origin}/dashboard?payment=success&plan=${resolvedPlan}&interval=${resolvedInterval}`;

    const directCheckoutUrl = `https://checkout.dodopayments.com/buy/${productId}?email=${encodeURIComponent(email)}&metadata[userId]=${encodeURIComponent(userId)}&metadata[plan]=${encodeURIComponent(resolvedPlan)}&metadata[interval]=${encodeURIComponent(resolvedInterval)}&return_url=${encodeURIComponent(finalReturnUrl)}`;

    if (apiKey) {
      try {
        const dodoBase = isLive ? 'https://api.dodopayments.com' : 'https://test.dodopayments.com';
        const requestBody: Record<string, any> = {
          product_cart: [{ product_id: productId, quantity: 1 }],
          metadata: { userId, email, plan: resolvedPlan, interval: resolvedInterval },
          return_url: finalReturnUrl,
        };
        if (email) {
          requestBody.customer = {
            email,
            name: email.split('@')[0],
          };
        }

        let dodoRes = await fetch(`${dodoBase}/checkouts`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!dodoRes.ok) {
          const paymentBody: Record<string, any> = { ...requestBody };
          if (email) paymentBody.billing = { email };
          dodoRes = await fetch(`${dodoBase}/payments`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(paymentBody),
          });
        }

        if (dodoRes.ok) {
          const session: any = await dodoRes.json();
          const checkoutUrl = session.checkout_url || session.payment_link || session.url || directCheckoutUrl;
          if (method === 'GET' && !isJson) {
            return Response.redirect(checkoutUrl, 302);
          }
          return new Response(
            JSON.stringify({
              success: true,
              plan: resolvedPlan,
              interval: resolvedInterval,
              checkoutUrl,
              source: 'api',
            }),
            { status: 200, headers: corsHeaders }
          );
        }
      } catch (err: any) {
        console.warn('Dodo API error, using direct checkout link:', err.message);
      }
    }

    if (method === 'GET' && !isJson) {
      return Response.redirect(directCheckoutUrl, 302);
    }

    return new Response(
      JSON.stringify({
        success: true,
        plan: resolvedPlan,
        interval: resolvedInterval,
        checkoutUrl: directCheckoutUrl,
        source: 'direct',
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
