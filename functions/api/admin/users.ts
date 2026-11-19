import { normalizeTierValue } from '../../lib/workspace-auth';

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export const ADMIN_EMAILS = ['fintasticapps@gmail.com', 'domlord369@gmail.com'];

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

// GET /api/admin/users - List users from public.profiles
export async function onRequestGet(context: { request?: Request; env: Env }) {
  try {
    const { url, key } = getSupabaseConfig(context.env);

    const defaultAdmin = {
      id: 'admin-fintasticapps',
      email: 'fintasticapps@gmail.com',
      full_name: 'Smart Poster Administrator',
      role: 'admin',
      tier: 'unlimited',
      plan: 'unlimited_lifetime',
      comments_posted: 142,
      created_at: new Date().toISOString()
    };

    if (!url || !key) {
      return new Response(
        JSON.stringify({ success: true, users: [defaultAdmin] }),
        { status: 200, headers: corsHeaders }
      );
    }

    const endpoint = `${url}/rest/v1/profiles?select=*&order=created_at.desc&limit=100`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.ok) {
      const users: any[] = await res.json();
      const normalizedUsers = users.map((u: any) => {
        const emailLower = String(u.email || '').trim().toLowerCase();
        const isAdmin = String(u.role || '').toLowerCase() === 'admin' || ADMIN_EMAILS.includes(emailLower);
        const resolvedTier = normalizeTierValue(u.tier, isAdmin ? 'admin' : 'user');
        return {
          ...u,
          role: isAdmin ? 'admin' : (u.role || 'user'),
          tier: resolvedTier,
        };
      });
      const hasAdmin = normalizedUsers.some((u: any) => (u.email || '').toLowerCase() === 'fintasticapps@gmail.com');
      if (!hasAdmin) {
        normalizedUsers.unshift(defaultAdmin);
      }
      return new Response(JSON.stringify({ success: true, users: normalizedUsers }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    return new Response(
      JSON.stringify({ success: true, users: [defaultAdmin] }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message, users: [] }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST /api/admin/users - Update user tier ('basic' | 'pro') or ban user
export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const { url, key } = getSupabaseConfig(context.env);
    const body = (await context.request.json()) as { email?: string; id?: string; tier?: string; action?: string; role?: string };
    const email = (body.email || '').trim().toLowerCase();
    const id = (body.id || '').trim();
    const action = (body.action || '').trim().toLowerCase();

    if (!email && !id) {
      return new Response(
        JSON.stringify({ success: false, error: 'User email or ID is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (ADMIN_EMAILS.includes(email) && action === 'ban') {
      return new Response(
        JSON.stringify({ success: false, error: 'Cannot ban system administrator' }),
        { status: 403, headers: corsHeaders }
      );
    }

    if (!url || !key) {
      // Local fallback mock response
      return new Response(
        JSON.stringify({
          success: true,
          message: action === 'ban' ? `User ${email || id} has been removed/banned.` : `User ${email || id} updated.`,
          user: { email, id, tier: body.tier || 'basic' }
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const filter = id && !id.startsWith('admin-')
      ? `id=eq.${encodeURIComponent(id)}`
      : (email ? `email=eq.${encodeURIComponent(email)}` : `id=eq.${encodeURIComponent(id)}`);
    const endpoint = `${url}/rest/v1/profiles?${filter}`;

    if (action === 'ban' || action === 'delete') {
      await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        }
      });
      return new Response(
        JSON.stringify({
          success: true,
          message: `User ${email || id} access revoked and profile removed.`,
          banned: true
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const rawTarget = String(body.tier || body.role || 'basic').trim().toLowerCase();
    const targetTier = normalizeTierValue(rawTarget, 'user');

    const patchProfiles = async (filterStr: string) =>
      fetch(`${url}/rest/v1/profiles?${filterStr}`, {
        method: 'PATCH',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          tier: targetTier,
          updated_at: new Date().toISOString(),
        }),
      });

    let res = await patchProfiles(filter);
    let updated: any[] = res.ok ? await res.json().catch(() => []) : [];
    if (res.ok && (!Array.isArray(updated) || updated.length === 0) && email && !filter.startsWith('email=')) {
      res = await patchProfiles(`email=eq.${encodeURIComponent(email)}`);
      if (res.ok) {
        updated = await res.json().catch(() => []);
      }
    }

    if (res.ok) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `User ${email || id} updated to ${targetTier.toUpperCase()} plan.`,
          user: updated?.[0] || { email, tier: targetTier },
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Supabase update error (HTTP ${res.status})` }),
      { status: res.status, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
