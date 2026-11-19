import {
  ADMIN_EMAILS,
  corsHeaders,
  createAdminSessionToken,
  getSupabaseCreds,
  signEntitlementClaim,
} from '../../lib/workspace-auth';

interface Env {
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KE?: string;
}

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const body = (await context.request.json().catch(() => ({}))) as { accessToken?: string };
    const accessToken = (body.accessToken || '').trim();

    const { url: supabaseUrl, anonKey, serviceKey } = getSupabaseCreds(context.env);
    const effectiveServiceKey = serviceKey || anonKey;

    if (!supabaseUrl || !anonKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Supabase Google OAuth is not configured on the server.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Google OAuth access token.' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Google session expired or invalid.' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const u = (await userRes.json()) as { id?: string; email?: string };
    const email = String(u?.email || '').trim().toLowerCase();
    const userId = String(u?.id || '').trim();

    let hasAdminRoleInDb = false;
    if (effectiveServiceKey && (userId || email)) {
      try {
        const filter = userId ? `id=eq.${encodeURIComponent(userId)}` : `email=eq.${encodeURIComponent(email)}`;
        const pRes = await fetch(`${supabaseUrl}/rest/v1/profiles?${filter}&select=id,email,role,tier`, {
          headers: { apikey: effectiveServiceKey, Authorization: `Bearer ${effectiveServiceKey}` },
        });
        if (pRes.ok) {
          const rows = (await pRes.json()) as Array<{ role?: string }>;
          if (String(rows?.[0]?.role || '').toLowerCase() === 'admin') {
            hasAdminRoleInDb = true;
          }
        }
      } catch (_) {}
    }

    if (email && (ADMIN_EMAILS.includes(email) || hasAdminRoleInDb)) {
      const resolvedId = userId || `admin-${email}`;
      const token = await createAdminSessionToken(context.env, resolvedId, email);
      const claim = await signEntitlementClaim(context.env, resolvedId, 'unlimited');
      return new Response(
        JSON.stringify({
          success: true,
          token,
          user: {
            id: resolvedId,
            email,
            role: 'admin',
            tier: 'unlimited',
            plan: 'unlimited_lifetime',
          },
          entitlement: {
            userId: resolvedId,
            email,
            tier: 'unlimited',
            role: 'admin',
            ...claim,
          },
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: email ? `Access denied: ${email} is not registered as an administrator.` : 'Google authentication required.',
      }),
      { status: 403, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Admin verification failed' }),
      { status: 500, headers: corsHeaders }
    );
  }
};
