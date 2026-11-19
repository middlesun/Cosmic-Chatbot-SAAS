export const ADMIN_EMAILS = ['fintasticapps@gmail.com', 'domlord369@gmail.com'];
export const ENTITLEMENT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const DOWNLOAD_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

export type PlanTier = 'basic' | 'pro' | 'studio' | 'unlimited';

export interface VerifiedAuthUser {
  userId: string;
  email: string;
  tier: PlanTier;
  role: 'user' | 'admin';
  fullName?: string;
  avatarUrl?: string;
  billingInterval?: 'monthly' | 'yearly';
  subscriptionStatus?: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  source?: string;
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export function getEnvValue(env: any, key: string): string {
  const pEnv = typeof process !== 'undefined' && process?.env ? process.env : {};
  const gEnv = typeof globalThis !== 'undefined' ? (globalThis as any) : {};
  return String(env?.[key] ?? pEnv[key] ?? gEnv[key] ?? '').trim();
}

export function getSupabaseCreds(env: any) {
  const url = (getEnvValue(env, 'SUPABASE_URL') || getEnvValue(env, 'VITE_SUPABASE_URL')).replace(/\/+$/, '');
  const anonKey = getEnvValue(env, 'SUPABASE_ANON_KEY') || getEnvValue(env, 'VITE_SUPABASE_ANON_KEY');
  const serviceKey = getEnvValue(env, 'SUPABASE_SERVICE_ROLE_KEY') || getEnvValue(env, 'SUPABASE_SERVICE_ROLE_KE');
  return { url, anonKey, serviceKey };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(b64u: string): string {
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const binary = atob(b64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const keyData = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(sig));
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function getEntitlementSigningSecret(env: any): Promise<string> {
  const configured = getEnvValue(env, 'ENTITLEMENT_SIGNING_SECRET');
  if (configured) return configured;

  const { anonKey, serviceKey } = getSupabaseCreds(env);
  const adminPass = getEnvValue(env, 'ADMIN_PASSWORD');
  const seed = [serviceKey, anonKey, adminPass, 'smart-poster-entitlement-dev-v1'].join('|');
  return sha256Hex(seed);
}

export function normalizeTierValue(rawTier: unknown, role: 'user' | 'admin' = 'user'): PlanTier {
  if (role === 'admin') return 'unlimited';
  const t = String(rawTier || 'basic').trim().toLowerCase();
  if (
    t === 'unlimited' ||
    t === 'unlimited_lifetime' ||
    t === 'unlimited-lifetime' ||
    t === 'agency' ||
    t === 'team' ||
    t === 'ultra' ||
    t.startsWith('unlimited')
  ) {
    return 'unlimited';
  }
  if (t === 'studio' || t === 'growth') {
    return 'studio';
  }
  if (t === 'pro' || t === 'pro_lifetime' || t === 'pro-lifetime' || t === 'lifetime' || t === 'premium' || t.startsWith('pro')) {
    return 'pro';
  }
  return 'basic';
}

export function hasProFeatures(user?: VerifiedAuthUser | null): boolean {
  return Boolean(user && (user.tier === 'pro' || user.tier === 'studio' || user.tier === 'unlimited' || user.role === 'admin'));
}

export function isUnlimitedTier(user?: VerifiedAuthUser | null): boolean {
  return Boolean(user && (user.tier === 'unlimited' || user.role === 'admin'));
}

export async function signEntitlementClaim(env: any, userId: string, tier: PlanTier) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + ENTITLEMENT_TTL_MS;
  const payload = `${userId}|${tier}|${expiresAt}`;
  const secret = await getEntitlementSigningSecret(env);
  const signature = await hmacSha256Hex(secret, payload);
  return { issuedAt, expiresAt, signature };
}

export async function createAdminSessionToken(env: any, userId: string, email: string): Promise<string> {
  const payloadObj = {
    userId,
    email,
    role: 'admin' as const,
    tier: 'unlimited' as const,
    exp: Date.now() + ENTITLEMENT_TTL_MS,
  };
  const payloadB64 = toBase64Url(JSON.stringify(payloadObj));
  const secret = await getEntitlementSigningSecret(env);
  const sig = await hmacSha256Hex(secret, `adm|${payloadB64}`);
  return `sp_adm.${payloadB64}.${sig}`;
}

export async function verifyAdminSessionToken(env: any, token: string): Promise<VerifiedAuthUser | null> {
  if (!token || !token.startsWith('sp_adm.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  const secret = await getEntitlementSigningSecret(env);
  const expectedSig = await hmacSha256Hex(secret, `adm|${payloadB64}`);
  if (!timingSafeEqualHex(sig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(payloadB64));
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp <= Date.now()) return null;
    if (parsed.role !== 'admin') return null;
    return {
      userId: String(parsed.userId || 'admin-session'),
      email: String(parsed.email || 'fintasticapps@gmail.com'),
      tier: 'unlimited',
      role: 'admin',
      source: 'admin-session',
    };
  } catch {
    return null;
  }
}

export async function createDownloadToken(env: any, user: VerifiedAuthUser): Promise<string> {
  const payloadObj = {
    userId: user.userId,
    email: user.email,
    tier: user.tier,
    role: user.role,
    exp: Date.now() + DOWNLOAD_TOKEN_TTL_MS,
  };
  const payloadB64 = toBase64Url(JSON.stringify(payloadObj));
  const secret = await getEntitlementSigningSecret(env);
  const sig = await hmacSha256Hex(secret, `dl|${payloadB64}`);
  return `${payloadB64}.${sig}`;
}

export async function verifyDownloadToken(env: any, token: string): Promise<VerifiedAuthUser | null> {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB4Valid(payloadB64) || !sig) return null;

  const secret = await getEntitlementSigningSecret(env);
  const expectedSig = await hmacSha256Hex(secret, `dl|${payloadB64}`);
  if (!timingSafeEqualHex(sig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(payloadB64));
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp <= Date.now()) return null;
    const email = String(parsed.email || '').trim().toLowerCase();
    const role: 'user' | 'admin' = parsed.role === 'admin' || ADMIN_EMAILS.includes(email) ? 'admin' : 'user';
    return {
      userId: String(parsed.userId || ''),
      email,
      tier: normalizeTierValue(parsed.tier, role),
      role,
      source: 'download-token',
    };
  } catch {
    return null;
  }
}

function payloadB4Valid(s: string): boolean {
  return Boolean(s && /^[A-Za-z0-9_-]+$/.test(s));
}

export function extractBearerToken(request: Request): string {
  const authHeader = String(request.headers.get('Authorization') || request.headers.get('authorization') || '').trim();
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

export async function verifyBearerToken(
  env: any,
  token: string
): Promise<{ ok: true; user: VerifiedAuthUser } | { ok: false; status: number; error: string }> {
  if (!token) {
    return { ok: false, status: 401, error: 'Missing Authorization Bearer token' };
  }

  const adminUser = await verifyAdminSessionToken(env, token);
  if (adminUser) {
    return { ok: true, user: adminUser };
  }

  const { url: supabaseUrl, anonKey, serviceKey } = getSupabaseCreds(env);
  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 401, error: 'Authentication verification unavailable (Supabase not configured)' };
  }

  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!userRes.ok) {
      return { ok: false, status: 401, error: 'Invalid or expired Supabase session token' };
    }

    const u: any = await userRes.json();
    const userId = String(u?.id || '').trim();
    const email = String(u?.email || '').trim().toLowerCase();
    if (!userId) {
      return { ok: false, status: 401, error: 'Invalid Supabase user payload' };
    }

    let profileRole: 'user' | 'admin' = ADMIN_EMAILS.includes(email) ? 'admin' : 'user';
    let profileTier: PlanTier = profileRole === 'admin' ? 'unlimited' : 'basic';
    let fullName = String(u?.user_metadata?.full_name || u?.user_metadata?.name || '');
    let avatarUrl = String(u?.user_metadata?.avatar_url || u?.user_metadata?.picture || '');

    const profileAuthKey = serviceKey || token;
    const profileApiKey = serviceKey || anonKey;

    let billingInterval: 'monthly' | 'yearly' = 'monthly';
    let subscriptionStatus = 'inactive';
    let currentPeriodEnd: string | null = null;
    let cancelAtPeriodEnd = false;

    try {
      let p: any = null;
      const fetchProfileRow = async (filterStr: string) => {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/profiles?${filterStr}&select=id,email,full_name,avatar_url,tier,role,billing_interval,subscription_status,current_period_end,cancel_at_period_end`,
          {
            headers: {
              apikey: profileApiKey,
              Authorization: `Bearer ${profileAuthKey}`,
            },
          }
        );
        if (res.status === 400) {
          return fetch(
            `${supabaseUrl}/rest/v1/profiles?${filterStr}&select=id,email,full_name,avatar_url,tier,role`,
            {
              headers: {
                apikey: profileApiKey,
                Authorization: `Bearer ${profileAuthKey}`,
              },
            }
          );
        }
        return res;
      };

      const pRes = await fetchProfileRow(`id=eq.${encodeURIComponent(userId)}`);
      if (pRes.ok) {
        const rows: any = await pRes.json();
        p = Array.isArray(rows) ? rows[0] : null;
      }
      if (!p && email) {
        const byEmailRes = await fetchProfileRow(`email=eq.${encodeURIComponent(email)}`);
        if (byEmailRes.ok) {
          const emailRows: any = await byEmailRes.json();
          p = Array.isArray(emailRows) ? emailRows[0] : null;
        }
      }
      if (p) {
        if (String(p.role || '').toLowerCase() === 'admin' || ADMIN_EMAILS.includes(email)) {
          profileRole = 'admin';
        }
        profileTier = normalizeTierValue(p.tier, profileRole);
        if (p.full_name) fullName = String(p.full_name);
        if (p.avatar_url) avatarUrl = String(p.avatar_url);
        if (p.billing_interval === 'yearly') billingInterval = 'yearly';
        if (p.subscription_status) subscriptionStatus = String(p.subscription_status);
        if (p.current_period_end) currentPeriodEnd = String(p.current_period_end);
        cancelAtPeriodEnd = Boolean(p.cancel_at_period_end);
      } else if (profileRole === 'admin') {
        profileTier = 'unlimited';
      }
    } catch {
      if (profileRole === 'admin') profileTier = 'unlimited';
    }

    return {
      ok: true,
      user: {
        userId,
        email,
        tier: profileTier,
        role: profileRole,
        fullName,
        avatarUrl,
        billingInterval,
        subscriptionStatus,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        source: 'supabase-jwt',
      },
    };
  } catch (err: any) {
    return { ok: false, status: 401, error: err?.message || 'Failed verifying session token' };
  }
}

export const STORAGE_QUOTAS = {
  basic: 15 * 1024 * 1024,          // 15 MB
  pro: 250 * 1024 * 1024,           // 250 MB
  studio: 1024 * 1024 * 1024,       // 1 GB
  unlimited: 5 * 1024 * 1024 * 1024 // 5 GB
} as const;

export const MAX_SINGLE_MEDIA_BYTES = Math.floor(1.5 * 1024 * 1024); // 1.5 MB per image upload
const MAX_INLINE_DATA_URL_CHARS = 250_000;

export function getStorageQuotaBytesForTier(tier: unknown): number {
  const t = String(tier || 'basic').trim().toLowerCase();
  if (t === 'unlimited' || t === 'agency' || t === 'admin' || t === 'team' || t === 'ultra' || t.startsWith('unlimited')) {
    return STORAGE_QUOTAS.unlimited;
  }
  if (t === 'studio' || t === 'growth') {
    return STORAGE_QUOTAS.studio;
  }
  if (t === 'pro' || t === 'lifetime' || t === 'premium' || t.startsWith('pro')) {
    return STORAGE_QUOTAS.pro;
  }
  return STORAGE_QUOTAS.basic;
}

function stripOversizedInlineDataUrls(val: any, depth = 0): any {
  if (depth > 8 || val == null) return val;
  if (typeof val === 'string') {
    if (val.startsWith('data:image/') && val.length > MAX_INLINE_DATA_URL_CHARS) {
      return '';
    }
    return val;
  }
  if (Array.isArray(val)) {
    return val.map((item) => stripOversizedInlineDataUrls(item, depth + 1));
  }
  if (typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = stripOversizedInlineDataUrls(v, depth + 1);
    }
    return out;
  }
  return val;
}

export function sanitizeBrandMediaPayloads(brands: any[]): any[] {
  if (!Array.isArray(brands)) return [];
  return brands.map((brand) => {
    if (!brand || typeof brand !== 'object') return brand;
    const cleaned = stripOversizedInlineDataUrls(brand);
    if (Array.isArray(cleaned.gallery)) {
      cleaned.gallery = cleaned.gallery.filter((item: any) => item && String(item.url || '').trim().length > 0);
    }
    return cleaned;
  });
}

export function calculateBrandsAssistantStorageBytesCf(brands: any[]): number {
  if (!Array.isArray(brands) || brands.length === 0) return 0;
  const encoder = new TextEncoder();
  let total = 0;
  for (const b of brands) {
    if (!b || typeof b !== 'object' || b.deletedAt) continue;
    try {
      const hasSessions = Array.isArray(b.assistantSessions) && b.assistantSessions.length > 0;
      if (hasSessions) {
        total += encoder.encode(JSON.stringify(b.assistantSessions)).length;
      } else if (b.assistantChat && typeof b.assistantChat === 'object') {
        const msgCount = Array.isArray(b.assistantChat.messages) ? b.assistantChat.messages.length : 0;
        const ctxCount = Array.isArray(b.assistantChat.scannedContexts) ? b.assistantChat.scannedContexts.length : 0;
        if (msgCount > 0 || ctxCount > 0) {
          total += encoder.encode(JSON.stringify(b.assistantChat)).length;
        }
      }
      if (Array.isArray(b.contentVault) && b.contentVault.length > 0) {
        total += encoder.encode(JSON.stringify(b.contentVault)).length;
      }
    } catch {}
  }
  return total;
}

export async function getUserStorageUsageBytes(
  env: any,
  userId: string,
  userToken?: string,
  preloadedBrands?: any[]
): Promise<number> {
  if (!userId) return 0;
  const { url, anonKey, serviceKey } = getSupabaseCreds(env);
  const apiKey = serviceKey || anonKey;
  if (!url || !apiKey) {
    return Array.isArray(preloadedBrands) ? calculateBrandsAssistantStorageBytesCf(preloadedBrands) : 0;
  }
  try {
    const authHeader = userToken ? `Bearer ${userToken}` : `Bearer ${serviceKey || anonKey}`;
    const storagePromise = fetch(`${url}/storage/v1/object/list/brand-assets`, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prefix: `${userId}/`,
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      }),
    });

    const brandsPromise = Array.isArray(preloadedBrands)
      ? Promise.resolve(null)
      : fetch(`${url}/rest/v1/brands?user_id=eq.${encodeURIComponent(userId)}&deleted_at=is.null&select=id,data`, {
          headers: { apikey: apiKey, Authorization: authHeader },
        });

    const [res, brandsRes] = await Promise.all([storagePromise, brandsPromise]);
    let mediaBytes = 0;
    if (res.ok) {
      const rows: any = await res.json().catch(() => []);
      if (Array.isArray(rows)) {
        mediaBytes = rows.reduce((sum, item) => sum + Number(item?.metadata?.size || item?.size || 0), 0);
      }
    }

    let brandsList: any[] = Array.isArray(preloadedBrands) ? preloadedBrands : [];
    if (!Array.isArray(preloadedBrands) && brandsRes && brandsRes.ok) {
      const brandRows: any = await brandsRes.json().catch(() => []);
      if (Array.isArray(brandRows)) {
        brandsList = brandRows.map((r: any) => (r?.data && typeof r.data === 'object' ? r.data : {})).filter(Boolean);
      }
    }

    const assistantTextBytes = calculateBrandsAssistantStorageBytesCf(brandsList);
    return mediaBytes + assistantTextBytes;
  } catch {
    return Array.isArray(preloadedBrands) ? calculateBrandsAssistantStorageBytesCf(preloadedBrands) : 0;
  }
}

export async function deleteUserBrandMedia(
  env: any,
  userId: string,
  assetUrlOrPath: string,
  userToken?: string
): Promise<{ success: boolean; deletedPath?: string }> {
  const raw = String(assetUrlOrPath || '').trim();
  if (!userId || !raw) return { success: false };

  let objectPath = raw;
  const marker = '/brand-assets/';
  const markerIdx = raw.indexOf(marker);
  if (markerIdx !== -1) {
    objectPath = raw.slice(markerIdx + marker.length).split('?')[0];
  }
  objectPath = objectPath.replace(/^\/+/, '');
  if (!objectPath.startsWith(`${userId}/`)) {
    return { success: false };
  }

  const { url, anonKey, serviceKey } = getSupabaseCreds(env);
  const apiKey = serviceKey || anonKey;
  if (!url || !apiKey) return { success: true, deletedPath: objectPath };
  try {
    const authHeader = userToken ? `Bearer ${userToken}` : `Bearer ${serviceKey || anonKey}`;
    const res = await fetch(`${url}/storage/v1/object/brand-assets/${objectPath}`, {
      method: 'DELETE',
      headers: {
        apikey: apiKey,
        Authorization: authHeader,
      },
    });
    return { success: res.ok, deletedPath: objectPath };
  } catch {
    return { success: false };
  }
}

export async function uploadUserBrandMediaCf(
  env: any,
  userId: string,
  dataUrl: string,
  filename: string,
  userToken?: string,
  tier: string = 'basic'
): Promise<{
  success: boolean;
  url: string;
  path?: string;
  sizeBytes?: number;
  storageUsedBytes?: number;
  storageLimitBytes?: number;
  storage: 'supabase' | 'inline';
  status?: number;
  quotaExceeded?: boolean;
  error?: string;
}> {
  const cleanDataUrl = String(dataUrl || '').trim();
  if (!cleanDataUrl.startsWith('data:image/')) {
    return { success: false, url: cleanDataUrl, storage: 'inline', status: 400, error: 'Valid image dataUrl is required.' };
  }
  const match = cleanDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return { success: false, url: '', storage: 'inline', status: 400, error: 'Invalid base64 image payload.' };
  }
  const mimeType = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const sizeBytes = bytes.byteLength;
  const storageLimitBytes = getStorageQuotaBytesForTier(tier);

  if (sizeBytes > MAX_SINGLE_MEDIA_BYTES) {
    return {
      success: false,
      url: '',
      sizeBytes,
      storageLimitBytes,
      storage: 'inline',
      status: 413,
      quotaExceeded: false,
      error: 'Compressed image still exceeds 1.5 MB limit. Please upload a smaller image.',
    };
  }

  const { url, anonKey, serviceKey } = getSupabaseCreds(env);
  const apiKey = serviceKey || anonKey;
  if (!url || !apiKey || !userId) {
    if (cleanDataUrl.length > MAX_INLINE_DATA_URL_CHARS) {
      return {
        success: false,
        url: '',
        sizeBytes,
        storageLimitBytes,
        storage: 'inline',
        status: 413,
        quotaExceeded: true,
        error: 'Image is too large for inline fallback storage. Please configure cloud media storage or compress further.',
      };
    }
    return {
      success: true,
      url: cleanDataUrl,
      sizeBytes,
      storageUsedBytes: sizeBytes,
      storageLimitBytes,
      storage: 'inline',
    };
  }

  const usedBytes = await getUserStorageUsageBytes(env, userId, userToken);
  if (usedBytes + sizeBytes > storageLimitBytes) {
    const usedMb = (usedBytes / (1024 * 1024)).toFixed(1);
    const limitMb = Math.round(storageLimitBytes / (1024 * 1024));
    return {
      success: false,
      url: '',
      sizeBytes,
      storageUsedBytes: usedBytes,
      storageLimitBytes,
      storage: 'supabase',
      status: 413,
      quotaExceeded: true,
      error: `Media storage quota reached (${usedMb} MB / ${limitMb} MB). Delete old images or upgrade your plan for more storage.`,
    };
  }

  try {
    const safeName = String(filename || `asset-${Date.now()}.webp`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `${userId}/${Date.now()}-${safeName}`;
    const authHeader = userToken ? `Bearer ${userToken}` : `Bearer ${serviceKey || anonKey}`;

    const res = await fetch(`${url}/storage/v1/object/brand-assets/${objectPath}`, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        Authorization: authHeader,
        'Content-Type': mimeType,
        'x-upsert': 'true',
      },
      body: bytes,
    });

    if (res.ok) {
      return {
        success: true,
        url: `${url}/storage/v1/object/public/brand-assets/${objectPath}`,
        path: objectPath,
        sizeBytes,
        storageUsedBytes: usedBytes + sizeBytes,
        storageLimitBytes,
        storage: 'supabase',
      };
    }

    const errTxt = await res.text().catch(() => '');
    return {
      success: false,
      url: '',
      sizeBytes,
      storageUsedBytes: usedBytes,
      storageLimitBytes,
      storage: 'supabase',
      status: res.status === 413 ? 413 : 502,
      quotaExceeded: res.status === 413,
      error: errTxt ? `Cloud storage upload failed (${res.status}): ${errTxt.slice(0, 180)}` : `Cloud storage upload failed (HTTP ${res.status}).`,
    };
  } catch (err: any) {
    return {
      success: false,
      url: '',
      sizeBytes,
      storageUsedBytes: usedBytes,
      storageLimitBytes,
      storage: 'supabase',
      status: 502,
      error: err?.message || 'Cloud media upload failed.',
    };
  }
}

export async function callUserGeminiRestCf(opts: {
  apiKey: string;
  model?: string;
  systemInstruction?: string;
  prompt: string;
  images?: Array<{ mimeType: string; data: string }>;
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
}): Promise<{ ok: boolean; text: string; status: number; error?: string; model: string }> {
  const cleanKey = String(opts.apiKey || '').trim();
  if (!cleanKey) return { ok: false, text: '', status: 401, error: 'Missing Google Gemini API key', model: 'gemini-2.5-flash' };
  const rawModel = String(opts.model || '').trim().replace(/^google\//i, '');
  const modelName = /^gemini-/i.test(rawModel) ? rawModel : 'gemini-2.5-flash';
  const parts: any[] = [{ text: opts.prompt }];
  if (Array.isArray(opts.images)) {
    for (const img of opts.images) {
      if (img?.mimeType && img?.data) {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      }
    }
  }
  const body: any = {
    contents: [{ parts }],
    generationConfig: {
      ...(typeof opts.temperature === 'number' ? { temperature: opts.temperature } : {}),
      ...(typeof opts.maxOutputTokens === 'number' ? { maxOutputTokens: opts.maxOutputTokens } : {}),
      ...(opts.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(cleanKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let errMsg = `Gemini API returned HTTP ${res.status}`;
    try {
      const parsedErr = JSON.parse(errText);
      if (parsedErr?.error?.message) errMsg = parsedErr.error.message;
    } catch {
      if (errText) errMsg = errText.slice(0, 220);
    }
    return { ok: false, text: '', status: res.status, error: errMsg, model: modelName };
  }
  const data: any = await res.json().catch(() => ({}));
  const text = String(data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  return { ok: Boolean(text), text, status: res.status, model: modelName };
}
