import { extractBearerToken, verifyBearerToken } from '../../lib/workspace-auth';
import { buildVaultCorsHeaders, getSupabaseRestContext } from '../../lib/cloud-state';

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  cookieHeader.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) {
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
  });
  return out;
}

function resolveVaultId(request: Request): string {
  const headerId = String(request.headers.get('X-SP-Vault-Id') || '').trim();
  if (/^[a-zA-Z0-9_-]{16,128}$/.test(headerId)) return headerId;
  const cookies = parseCookies(request.headers.get('Cookie'));
  const cookieId = String(cookies.sp_vault_id || '').trim();
  if (/^[a-zA-Z0-9_-]{16,128}$/.test(cookieId)) return cookieId;
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `spv_${hex}`;
}

function makeVaultCookie(request: Request, vaultId: string): string {
  const isHttps = request.url.startsWith('https://') || request.headers.get('x-forwarded-proto') === 'https';
  return [
    `sp_vault_id=${encodeURIComponent(vaultId)}`,
    'Path=/',
    'Max-Age=31536000',
    'HttpOnly',
    isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax',
  ].join('; ');
}

export async function onRequestOptions(context: { request: Request }) {
  return new Response(null, {
    status: 200,
    headers: buildVaultCorsHeaders(context.request),
  });
}

export async function onRequestGet(context: { request: Request; env: any }) {
  const headers = buildVaultCorsHeaders(context.request);
  const vaultId = resolveVaultId(context.request);
  headers['Set-Cookie'] = makeVaultCookie(context.request, vaultId);

  try {
    const token = extractBearerToken(context.request);
    if (token) {
      const auth = await verifyBearerToken(context.env, token);
      if (auth.ok) {
        const sb = getSupabaseRestContext(context.env, token);
        if (sb.configured) {
          const res = await fetch(
            `${sb.url}/rest/v1/user_settings?user_id=eq.${encodeURIComponent(auth.user.userId)}&select=settings,updated_at`,
            { headers: sb.baseHeaders }
          );
          if (res.ok) {
            const rows: any = await res.json().catch(() => []);
            const vault = rows?.[0]?.settings?.__extensionVault || null;
            if (vault) {
              return new Response(
                JSON.stringify({
                  success: true,
                  vaultId,
                  snapshot: vault.snapshot || vault,
                  updatedAt: vault.updatedAt || rows[0]?.updated_at || null,
                }),
                { status: 200, headers }
              );
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        vaultId,
        snapshot: null,
        updatedAt: null,
      }),
      { status: 200, headers }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Vault load failed' }),
      { status: 500, headers }
    );
  }
}

export async function onRequestPost(context: { request: Request; env: any }) {
  const headers = buildVaultCorsHeaders(context.request);
  const vaultId = resolveVaultId(context.request);
  headers['Set-Cookie'] = makeVaultCookie(context.request, vaultId);

  try {
    const body: any = await context.request.json().catch(() => ({}));
    const snapshot = body?.snapshot && typeof body.snapshot === 'object' ? body.snapshot : body || {};
    const nowIso = snapshot?.updatedAt || new Date().toISOString();

    const token = extractBearerToken(context.request);
    if (token) {
      const auth = await verifyBearerToken(context.env, token);
      if (auth.ok) {
        const sb = getSupabaseRestContext(context.env, token);
        if (sb.configured) {
          let currentSettings: Record<string, any> = {};
          const curRes = await fetch(
            `${sb.url}/rest/v1/user_settings?user_id=eq.${encodeURIComponent(auth.user.userId)}&select=settings`,
            { headers: sb.baseHeaders }
          ).catch(() => null);
          if (curRes && curRes.ok) {
            const rows: any = await curRes.json().catch(() => []);
            if (rows?.[0]?.settings && typeof rows[0].settings === 'object') {
              currentSettings = rows[0].settings;
            }
          }
          await fetch(`${sb.url}/rest/v1/user_settings?on_conflict=user_id`, {
            method: 'POST',
            headers: sb.upsertHeaders,
            body: JSON.stringify([
              {
                user_id: auth.user.userId,
                settings: {
                  ...currentSettings,
                  __extensionVault: { vaultId, snapshot, updatedAt: nowIso },
                },
                updated_at: nowIso,
              },
            ]),
          }).catch(() => null);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        vaultId,
        updatedAt: nowIso,
      }),
      { status: 200, headers }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Vault save failed' }),
      { status: 500, headers }
    );
  }
}
