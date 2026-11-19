import { getDodoPlanCatalog, PLAN_SPECS } from '../lib/pricing';

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
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
export async function onRequestGet(context: any) {
  const cEnv = context?.env || context || {};
  const gEnv = typeof globalThis !== 'undefined' ? (globalThis as any) : {};
  const pEnv = typeof process !== 'undefined' && process?.env ? process.env : {};

  const mergedEnv = { ...pEnv, ...gEnv, ...cEnv };
  const rawUrl =
    cEnv.SUPABASE_URL ||
    cEnv.VITE_SUPABASE_URL ||
    gEnv.SUPABASE_URL ||
    gEnv.VITE_SUPABASE_URL ||
    pEnv.SUPABASE_URL ||
    pEnv.VITE_SUPABASE_URL ||
    '';

  const supabaseUrl = String(rawUrl || '').trim().replace(/\/+$/, '');

  const rawKey =
    cEnv.SUPABASE_ANON_KEY ||
    cEnv.VITE_SUPABASE_ANON_KEY ||
    gEnv.SUPABASE_ANON_KEY ||
    gEnv.VITE_SUPABASE_ANON_KEY ||
    pEnv.SUPABASE_ANON_KEY ||
    pEnv.VITE_SUPABASE_ANON_KEY ||
    '';

  const supabaseAnonKey = String(rawKey || '').trim();

  const dodoCatalog = getDodoPlanCatalog(mergedEnv);
  const hasDodoKey = Boolean(cEnv.DODO_PAYMENTS_API_KEY || pEnv.DODO_PAYMENTS_API_KEY);
  const dodoMode = cEnv.DODO_PAYMENTS_MODE || pEnv.DODO_PAYMENTS_MODE || 'test';

  const payload = {
    success: true,
    supabase: {
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      isConfigured: Boolean(supabaseUrl && supabaseAnonKey),
    },
    dodo: {
      productId: dodoCatalog.legacyPro,
      unlimitedProductId: dodoCatalog.legacyUnlimited,
      products: {
        pro: { monthly: dodoCatalog.proMonthly, yearly: dodoCatalog.proYearly },
        studio: { monthly: dodoCatalog.studioMonthly, yearly: dodoCatalog.studioYearly },
        agency: { monthly: dodoCatalog.agencyMonthly, yearly: dodoCatalog.agencyYearly },
      },
      isConfigured: Boolean(hasDodoKey || dodoCatalog.legacyPro),
      mode: dodoMode,
    },
    pricing: {
      model: 'subscription',
      plans: PLAN_SPECS,
    },
    features: {
      aiAssistant: false,
      byokAi: true,
      cloudSync: Boolean(supabaseUrl && supabaseAnonKey),
      proPayments: true,
    },
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: corsHeaders,
  });
}
