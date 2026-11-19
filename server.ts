import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import crypto from 'crypto';
import fs from 'fs';
import { loadPromptTemplates, savePromptTemplate, getDefaultPrompts } from './functions/api/admin/prompts.ts';
import { buildThreadSuggestionsPrompts, parseThreadSuggestionsResponse } from './functions/lib/thread-suggestions.ts';
import {
  buildAutoVaryBatchPrompts,
  buildAutoVaryLocalFallback,
  filterValidatedAutoVariations,
  normalizeCreativityLevel,
  parseVariationsJsonOrList,
} from './functions/lib/auto-variation.ts';
import {
  formatTierDisplayName,
  getDodoPlanCatalog,
  getDodoProductIdForPlan,
  patchSupabaseProfileSafe,
  PLAN_SPECS,
  resolveBillingInterval,
  resolveCheckoutPlan,
  resolveDodoWebhookOutcome,
  verifyDodoWebhookSignature,
} from './functions/lib/pricing.ts';
import {
  loadDirectories,
  upsertDirectory,
  upsertDirectoriesBulk,
  deleteDirectory,
  buildDirectoryListsByCategory,
  getWorkspaceSelectorRecipes,
  getWorkspaceRandomnessDicts,
  loadReleases,
  upsertRelease,
  deleteRelease,
  loadChangelog,
  upsertChangelog,
  deleteChangelog,
  loadUserWorkspacePrefs,
  saveUserWorkspacePrefs,
  loadUserCloudState,
  saveUserCloudState,
  loadExtensionVault,
  saveExtensionVault,
  uploadUserBrandMedia,
  deleteUserBrandMedia,
  calculateBrandsAssistantStorageBytes,
  getUserStorageUsageBytes,
  getStorageQuotaBytesForTier,
  runResearchDiscovery,
} from './server-catalog.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({
  limit: '10mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));

// Enable CORS for Chrome Extension and local clients (supporting credentialed vault cookies)
app.use((req, res, next) => {
  const reqOrigin = req.headers.origin;
  if (reqOrigin) {
    res.header('Access-Control-Allow-Origin', reqOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-SP-Vault-Id');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Lazy Gemini Client initializer
let _aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!_aiClient) {
    _aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return _aiClient;
}

async function callUserGeminiRest(opts: {
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

// Dynamic Environment Configuration Endpoint (Serves client & extension from process.env)
app.get('/api/config', (_req: Request, res: Response) => {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseUrl = rawUrl.trim().replace(/\/+$/, '');
  const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const dodoCatalog = getDodoPlanCatalog(process.env);
  const hasDodoKey = Boolean(process.env.DODO_PAYMENTS_API_KEY);

  res.json({
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
      mode: process.env.DODO_PAYMENTS_MODE || 'test',
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
  });
});

const ADMIN_EMAILS = ['fintasticapps@gmail.com', 'domlord369@gmail.com'];

type PlanTier = 'basic' | 'pro' | 'studio' | 'unlimited';

function normalizeTierValue(rawTier: unknown, role: 'user' | 'admin' = 'user'): PlanTier {
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

function hasProFeatures(user?: VerifiedAuthUser | null): boolean {
  return Boolean(user && (user.tier === 'pro' || user.tier === 'studio' || user.tier === 'unlimited' || user.role === 'admin'));
}

function isUnlimitedTier(user?: VerifiedAuthUser | null): boolean {
  return Boolean(user && (user.tier === 'unlimited' || user.role === 'admin'));
}

interface VerifiedAuthUser {
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

interface AuthedRequest extends Request {
  authUser?: VerifiedAuthUser | null;
}

let _warnedDefaultEntitlementSecret = false;
function getEntitlementSigningSecret(): string {
  const configured = (process.env.ENTITLEMENT_SIGNING_SECRET || '').trim();
  if (configured) return configured;

  if (process.env.NODE_ENV === 'production' && !_warnedDefaultEntitlementSecret) {
    _warnedDefaultEntitlementSecret = true;
    console.warn('[Security] ENTITLEMENT_SIGNING_SECRET is not set; using process-derived fallback.');
  }
  const seed = [
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KE || '',
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
    process.env.ADMIN_PASSWORD || '',
    'smart-poster-entitlement-dev-v1',
  ].join('|');
  return crypto.createHash('sha256').update(seed).digest('hex');
}

const ENTITLEMENT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DOWNLOAD_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes
const JWT_CACHE_TTL_MS = 60 * 1000; // 60 seconds

const jwtVerificationCache = new Map<string, { user: VerifiedAuthUser; cachedAt: number }>();

function invalidateAuthCacheForUser(userId?: string, email?: string) {
  const idClean = (userId || '').trim();
  const emailClean = (email || '').trim().toLowerCase();
  for (const [hash, entry] of jwtVerificationCache.entries()) {
    if ((idClean && entry.user.userId === idClean) || (emailClean && entry.user.email.toLowerCase() === emailClean)) {
      jwtVerificationCache.delete(hash);
    }
  }
}

function signEntitlementClaim(userId: string, tier: PlanTier) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + ENTITLEMENT_TTL_MS;
  const payload = `${userId}|${tier}|${expiresAt}`;
  const signature = crypto
    .createHmac('sha256', getEntitlementSigningSecret())
    .update(payload)
    .digest('hex');
  return { issuedAt, expiresAt, signature };
}

function createAdminSessionToken(userId: string, email: string): string {
  const payloadObj = {
    userId,
    email,
    role: 'admin' as const,
    tier: 'unlimited' as const,
    exp: Date.now() + ENTITLEMENT_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getEntitlementSigningSecret())
    .update(`adm|${payloadB64}`)
    .digest('hex');
  return `sp_adm.${payloadB64}.${sig}`;
}

function verifyAdminSessionToken(token: string): VerifiedAuthUser | null {
  if (!token || !token.startsWith('sp_adm.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getEntitlementSigningSecret())
    .update(`adm|${payloadB64}`)
    .digest('hex');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
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

function createDownloadToken(user: VerifiedAuthUser): string {
  const payloadObj = {
    userId: user.userId,
    email: user.email,
    tier: user.tier,
    role: user.role,
    exp: Date.now() + DOWNLOAD_TOKEN_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getEntitlementSigningSecret())
    .update(`dl|${payloadB64}`)
    .digest('hex');
  return `${payloadB64}.${sig}`;
}

function verifyDownloadToken(token: string): VerifiedAuthUser | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getEntitlementSigningSecret())
    .update(`dl|${payloadB64}`)
    .digest('hex');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp <= Date.now() || !parsed.userId) {
      return null;
    }
    const role: 'user' | 'admin' = parsed.role === 'admin' ? 'admin' : 'user';
    return {
      userId: String(parsed.userId),
      email: String(parsed.email || ''),
      tier: normalizeTierValue(parsed.tier, role),
      role,
      source: 'download-token',
    };
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string {
  const authHeader = String(req.headers.authorization || '').trim();
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function verifyBearerToken(token: string): Promise<{ ok: true; user: VerifiedAuthUser } | { ok: false; status: number; error: string }> {
  if (!token) {
    return { ok: false, status: 401, error: 'Missing Authorization Bearer token' };
  }

  // 1. Check server-signed admin session token
  const adminUser = verifyAdminSessionToken(token);
  if (adminUser) {
    return { ok: true, user: adminUser };
  }

  // 2. Check 60s in-memory cache keyed by SHA-256 hash of Supabase JWT
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const cached = jwtVerificationCache.get(tokenHash);
  if (cached && Date.now() - cached.cachedAt < JWT_CACHE_TTL_MS) {
    return { ok: true, user: cached.user };
  }

  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseUrl = rawUrl.trim().replace(/\/+$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KE || '').trim();

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
      jwtVerificationCache.delete(tokenHash);
      return { ok: false, status: 401, error: 'Invalid or expired Supabase session token' };
    }

    const u: any = await userRes.json();
    const userId = String(u?.id || '').trim();
    const email = String(u?.email || '').trim().toLowerCase();
    if (!userId) {
      return { ok: false, status: 401, error: 'Invalid Supabase user payload' };
    }

    let profileTier: PlanTier = 'basic';
    let profileRole: 'user' | 'admin' = ADMIN_EMAILS.includes(email) ? 'admin' : 'user';
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
      const fetchProfileRow = async (filterStr: string, authK: string, apiK: string) => {
        const r = await fetch(
          `${supabaseUrl}/rest/v1/profiles?${filterStr}&select=id,email,full_name,avatar_url,tier,role,billing_interval,subscription_status,current_period_end,cancel_at_period_end`,
          {
            headers: {
              apikey: apiK,
              Authorization: `Bearer ${authK}`,
            },
          }
        );
        if (r.status === 400) {
          return fetch(
            `${supabaseUrl}/rest/v1/profiles?${filterStr}&select=id,email,full_name,avatar_url,tier,role`,
            {
              headers: {
                apikey: apiK,
                Authorization: `Bearer ${authK}`,
              },
            }
          );
        }
        return r;
      };

      const pRes = await fetchProfileRow(`id=eq.${encodeURIComponent(userId)}`, profileAuthKey, profileApiKey);
      if (pRes.ok) {
        const rows: any = await pRes.json();
        p = Array.isArray(rows) ? rows[0] : null;
      }
      if (!p && serviceKey && email) {
        const byEmailRes = await fetchProfileRow(`email=eq.${encodeURIComponent(email)}`, serviceKey, serviceKey);
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
    } catch (profErr: any) {
      console.warn('[Auth] Failed reading public.profiles:', profErr?.message || profErr);
      if (profileRole === 'admin') {
        profileTier = 'unlimited';
      }
    }

    const verifiedUser: VerifiedAuthUser = {
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
    };

    jwtVerificationCache.set(tokenHash, { user: verifiedUser, cachedAt: Date.now() });
    if (jwtVerificationCache.size > 2000) {
      const now = Date.now();
      for (const [k, v] of jwtVerificationCache.entries()) {
        if (now - v.cachedAt >= JWT_CACHE_TTL_MS) {
          jwtVerificationCache.delete(k);
        }
      }
    }

    return { ok: true, user: verifiedUser };
  } catch (err: any) {
    return { ok: false, status: 401, error: err?.message || 'Failed verifying session token' };
  }
}

async function optionalVerifiedAuth(req: AuthedRequest, res: Response, next: express.NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    req.authUser = null;
    next();
    return;
  }
  const verified = await verifyBearerToken(token);
  if (!verified.ok) {
    res.status(verified.status).json({ success: false, error: verified.error });
    return;
  }
  req.authUser = verified.user;
  next();
}

async function requireVerifiedAuth(req: AuthedRequest, res: Response, next: express.NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  const verified = await verifyBearerToken(token);
  if (!verified.ok) {
    res.status(verified.status).json({ success: false, error: verified.error });
    return;
  }
  req.authUser = verified.user;
  next();
}

function requireAdminAuth(req: AuthedRequest, res: Response, next: express.NextFunction) {
  requireVerifiedAuth(req, res, () => {
    if (!req.authUser || req.authUser.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Administrator privileges required' });
      return;
    }
    next();
  });
}

const inMemoryUsers: any[] = [
  {
    id: 'admin-fintasticapps',
    email: 'fintasticapps@gmail.com',
    full_name: 'Smart Poster Administrator',
    role: 'admin',
    tier: 'unlimited',
    plan: 'unlimited_lifetime',
    comments_posted: 142,
    created_at: new Date().toISOString()
  }
];

// Admin Authentication Endpoint
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username = '', password = '' } = req.body;
  const userClean = username.trim().toLowerCase();
  const passClean = password.trim();
  const envUser = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  const envPass = (process.env.ADMIN_PASSWORD || '').trim();
  const isAdminUser =
    userClean === 'admin' ||
    (envUser !== '' && userClean === envUser) ||
    ADMIN_EMAILS.includes(userClean);
  const isValidPass =
    passClean === 'pass369' ||
    passClean === 'admin369' ||
    (envPass !== '' && passClean === envPass);

  if (isAdminUser && isValidPass) {
    const adminEmail = userClean.includes('@') ? userClean : 'fintasticapps@gmail.com';
    const adminId = `admin-${adminEmail}`;
    const token = createAdminSessionToken(adminId, adminEmail);
    const claim = signEntitlementClaim(adminId, 'unlimited');
    res.json({
      success: true,
      token,
      user: {
        id: adminId,
        username: userClean,
        email: adminEmail,
        role: 'admin',
        tier: 'unlimited',
        plan: 'unlimited_lifetime'
      },
      entitlement: {
        userId: adminId,
        email: adminEmail,
        tier: 'unlimited',
        role: 'admin',
        ...claim,
      }
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid username or password'
    });
  }
});

// Admin Google / Gmail OAuth Verification Endpoint
app.post('/api/auth/admin-google', async (req: Request, res: Response) => {
  try {
    const accessToken = (req.body?.accessToken || '').trim();
    let email = '';
    let userId = '';

    const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseUrl = rawUrl.trim().replace(/\/+$/, '');
    const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KE || anonKey).trim();

    if (!supabaseUrl || !anonKey) {
      return res.status(400).json({
        success: false,
        error: 'Supabase Google OAuth is not configured on the server. Use Username / Email credentials below.'
      });
    }

    if (!accessToken) {
      return res.status(401).json({ success: false, error: 'Missing Google OAuth access token.' });
    }

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` }
    });
    if (!userRes.ok) {
      return res.status(401).json({ success: false, error: 'Google session expired or invalid. Please sign in again.' });
    }
    const u = await userRes.json();
    email = String(u?.email || '').trim().toLowerCase();
    userId = String(u?.id || '').trim();

    let hasAdminRoleInDb = false;
    if (serviceKey && (userId || email)) {
      try {
        const filter = userId ? `id=eq.${encodeURIComponent(userId)}` : `email=eq.${encodeURIComponent(email)}`;
        const pRes = await fetch(`${supabaseUrl}/rest/v1/profiles?${filter}&select=id,email,role,tier`, {
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
        });
        if (pRes.ok) {
          const rows = await pRes.json();
          if (rows?.[0]?.role === 'admin') {
            hasAdminRoleInDb = true;
          }
        }
      } catch (_) {}
    }

    if (email && (ADMIN_EMAILS.includes(email) || hasAdminRoleInDb)) {
      const resolvedId = userId || `admin-${email}`;
      const token = createAdminSessionToken(resolvedId, email);
      const claim = signEntitlementClaim(resolvedId, 'unlimited');
      return res.json({
        success: true,
        token,
        user: {
          id: resolvedId,
          email,
          role: 'admin',
          tier: 'unlimited',
          plan: 'unlimited_lifetime'
        },
        entitlement: {
          userId: resolvedId,
          email,
          tier: 'unlimited',
          role: 'admin',
          ...claim,
        }
      });
    }

    res.status(403).json({
      success: false,
      error: email
        ? `Access denied: ${email} is not registered as an administrator.`
        : 'Google authentication required.'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Admin verification failed' });
  }
});

// Signed Entitlement Claim Endpoint (Authenticated via Supabase JWT)
app.get('/api/auth/entitlement', requireVerifiedAuth, async (req: AuthedRequest, res: Response) => {
  const user = req.authUser!;
  const token = extractBearerToken(req) || undefined;
  const claim = signEntitlementClaim(user.userId, user.tier);
  const storageLimitBytes = getStorageQuotaBytesForTier(user.tier);
  const storageUsedBytes = await getUserStorageUsageBytes(user.userId, token);
  const campaignLimit = user.role === 'admin'
    ? null
    : (user.tier === 'unlimited' ? PLAN_SPECS.agency.productLimit : (user.tier === 'studio' ? PLAN_SPECS.studio.productLimit : (user.tier === 'pro' ? PLAN_SPECS.pro.productLimit : PLAN_SPECS.free.productLimit)));
  const entitlement = {
    userId: user.userId,
    email: user.email,
    tier: user.tier,
    role: user.role,
    billingInterval: user.billingInterval || 'monthly',
    subscriptionStatus: user.subscriptionStatus || 'inactive',
    currentPeriodEnd: user.currentPeriodEnd || null,
    cancelAtPeriodEnd: Boolean(user.cancelAtPeriodEnd),
    campaignLimit,
    issuedAt: claim.issuedAt,
    expiresAt: claim.expiresAt,
    signature: claim.signature,
    storageUsedBytes,
    storageLimitBytes,
  };
  res.json({
    success: true,
    ...entitlement,
    entitlement,
  });
});

// Short-Lived Signed Download Token Endpoint (Authenticated)
app.get('/api/auth/download-token', requireVerifiedAuth, (req: AuthedRequest, res: Response) => {
  const user = req.authUser!;
  const token = createDownloadToken(user);
  res.json({
    success: true,
    token,
    downloadToken: token,
    expiresInSeconds: Math.floor(DOWNLOAD_TOKEN_TTL_MS / 1000),
  });
});

// Admin: Fetch all registered users from public.profiles
app.get('/api/admin/users', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseUrl = rawUrl.trim().replace(/\/+$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KE || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    const defaultAdmin = inMemoryUsers[0];

    if (!supabaseUrl || !key) {
      res.json({ success: true, users: inMemoryUsers });
      return;
    }

    const endpoint = `${supabaseUrl}/rest/v1/profiles?select=*&order=created_at.desc&limit=100`;
    const sbRes = await fetch(endpoint, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    });

    if (sbRes.ok) {
      const users: any[] = await sbRes.json();
      const normalizedUsers = users.map((u: any) => {
        const emailLower = String(u.email || '').trim().toLowerCase();
        const isAdmin = String(u.role || '').toLowerCase() === 'admin' || ADMIN_EMAILS.includes(emailLower);
        const resolvedTier = normalizeTierValue(u.tier, isAdmin ? 'admin' : 'user');
        return {
          ...u,
          role: isAdmin ? 'admin' : (u.role || 'user'),
          tier: resolvedTier
        };
      });
      const hasAdmin = normalizedUsers.some(u => (u.email || '').toLowerCase() === 'fintasticapps@gmail.com');
      if (!hasAdmin) {
        normalizedUsers.unshift(defaultAdmin);
      }
      res.json({ success: true, users: normalizedUsers });
      return;
    }

    res.json({ success: true, users: inMemoryUsers });
  } catch (err: any) {
    res.json({ success: false, error: err.message, users: [] });
  }
});

// Admin: Toggle or Update User Tier ('basic' | 'pro' | 'unlimited')
app.post('/api/admin/users/tier', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseUrl = rawUrl.trim().replace(/\/+$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KE || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    const { email = '', id = '', tier = 'basic' } = req.body;
    const targetEmail = String(email || '').trim().toLowerCase();
    const targetId = String(id || '').trim();
    const targetTier: PlanTier = normalizeTierValue(tier, 'user');
    invalidateAuthCacheForUser(targetId, targetEmail);

    const memIdx = inMemoryUsers.findIndex(
      (u) => (targetId && u.id === targetId) || (targetEmail && (u.email || '').toLowerCase() === targetEmail)
    );
    if (memIdx >= 0) {
      inMemoryUsers[memIdx] = {
        ...inMemoryUsers[memIdx],
        tier: targetTier,
        updated_at: new Date().toISOString()
      };
    }

    if (!supabaseUrl || !key) {
      res.json({
        success: true,
        message: `User ${email || id} updated to ${targetTier.toUpperCase()} plan.`,
        user: memIdx >= 0 ? inMemoryUsers[memIdx] : { id: targetId, email: targetEmail, tier: targetTier }
      });
      return;
    }

    const patchProfiles = async (filterStr: string) => {
      const endpoint = `${supabaseUrl}/rest/v1/profiles?${filterStr}`;
      return fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          tier: targetTier,
          updated_at: new Date().toISOString()
        })
      });
    };

    const primaryFilter = targetId && !targetId.startsWith('admin-')
      ? `id=eq.${encodeURIComponent(targetId)}`
      : (targetEmail ? `email=eq.${encodeURIComponent(targetEmail)}` : `id=eq.${encodeURIComponent(targetId)}`);

    let sbRes = await patchProfiles(primaryFilter);
    let updated: any[] = sbRes.ok ? await sbRes.json().catch(() => []) : [];

    if (sbRes.ok && (!Array.isArray(updated) || updated.length === 0) && targetEmail && !primaryFilter.startsWith('email=')) {
      sbRes = await patchProfiles(`email=eq.${encodeURIComponent(targetEmail)}`);
      if (sbRes.ok) {
        updated = await sbRes.json().catch(() => []);
      }
    }

    if (sbRes.ok) {
      res.json({
        success: true,
        message: `User ${email || id} updated to ${targetTier.toUpperCase()} plan.`,
        user: updated?.[0] || { id: targetId, email: targetEmail, tier: targetTier }
      });
      return;
    }

    res.status(sbRes.status).json({ success: false, error: `Supabase error HTTP ${sbRes.status}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Ban / Delete User Account
app.post(['/api/admin/users/ban', '/api/admin/users/:id/ban'], requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseUrl = rawUrl.trim().replace(/\/+$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KE || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    const email = (req.body?.email || '').trim().toLowerCase();
    const id = (req.params?.id || req.body?.id || '').trim();
    invalidateAuthCacheForUser(id, email);

    if (ADMIN_EMAILS.includes(email)) {
      return res.status(403).json({ success: false, error: 'Cannot ban system administrator' });
    }

    if (!supabaseUrl || !key) {
      const idx = inMemoryUsers.findIndex(
        (u) => (id && u.id === id) || (email && (u.email || '').toLowerCase() === email)
      );
      if (idx >= 0) {
        inMemoryUsers.splice(idx, 1);
      }
      return res.json({
        success: true,
        message: `User ${email || id} access revoked and profile removed.`,
        banned: true
      });
    }

    const filter = id ? `id=eq.${encodeURIComponent(id)}` : `email=eq.${encodeURIComponent(email)}`;
    const endpoint = `${supabaseUrl}/rest/v1/profiles?${filter}`;

    await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      message: `User ${email || id} access revoked and profile removed.`,
      banned: true
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Update User Role
app.post(['/api/admin/users/role', '/api/admin/users/:id/role'], requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseUrl = rawUrl.trim().replace(/\/+$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KE || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    const email = (req.body?.email || '').trim().toLowerCase();
    const id = (req.params?.id || req.body?.id || '').trim();
    const role: 'user' | 'admin' = (req.body?.role || 'user').trim().toLowerCase() === 'admin' ? 'admin' : 'user';
    const tier: PlanTier = normalizeTierValue(req.body?.tier || (role === 'admin' ? 'unlimited' : 'basic'), role);
    invalidateAuthCacheForUser(id, email);

    if (!supabaseUrl || !key) {
      const idx = inMemoryUsers.findIndex(
        (u) => (id && u.id === id) || (email && (u.email || '').toLowerCase() === email)
      );
      if (idx >= 0) {
        inMemoryUsers[idx] = {
          ...inMemoryUsers[idx],
          role,
          tier,
          updated_at: new Date().toISOString()
        };
      }
      return res.json({
        success: true,
        message: `User ${email || id} role updated to ${role}.`,
        user: idx >= 0 ? inMemoryUsers[idx] : { email, id, role, tier }
      });
    }

    const filter = id ? `id=eq.${encodeURIComponent(id)}` : `email=eq.${encodeURIComponent(email)}`;
    const endpoint = `${supabaseUrl}/rest/v1/profiles?${filter}`;

    const patchRes = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        role,
        tier,
        updated_at: new Date().toISOString()
      })
    });

    if (patchRes.ok) {
      const updated = await patchRes.json();
      return res.json({
        success: true,
        message: `User ${email || id} role updated.`,
        user: updated?.[0] || { email, role, tier }
      });
    }

    res.status(patchRes.status).json({ success: false, error: `Supabase error HTTP ${patchRes.status}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// Dynamic Prompt Studio Endpoints
// ==============================================================================

// GET /api/admin/prompts - Fetch all dynamic system prompt templates
app.get('/api/admin/prompts', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const prompts = await loadPromptTemplates();
    res.json({ success: true, prompts });
  } catch (err: any) {
    res.json({ success: true, prompts: getDefaultPrompts(), warning: err.message });
  }
});

// POST /api/admin/prompts - Save/Deploy dynamic system prompt template
const handleSaveAdminPrompt = async (req: Request, res: Response) => {
  try {
    const { id = req.params?.id, name, system_instruction, temperature, updated_by } = req.body;
    if (!id || !system_instruction) {
      return res.status(400).json({ success: false, error: 'id and system_instruction are required' });
    }
    const saved = await savePromptTemplate({
      id,
      name: name || id,
      system_instruction,
      temperature: Number(temperature) ?? 0.7,
      updated_by: updated_by || 'admin'
    });
    res.json({ success: true, prompt: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/admin/prompts/test - Live sandbox execution test against OpenRouter / Gemini
app.post('/api/admin/prompts/test', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const {
      templateId = 'organic',
      systemInstructionOverride = '',
      threadTitle = '',
      threadBody = '',
      brand = {},
      openRouterKey = '',
      aiModel = ''
    } = req.body;

    const templates = await loadPromptTemplates();
    const activeTemplate = templates.find((t: any) => t.id === templateId) || templates[0] || {};
    const systemPrompt = systemInstructionOverride || activeTemplate.system_instruction || 'You are an elite growth strategist.';
    const temp = Number(activeTemplate.temperature) || 0.7;

    const brandName = brand.name || 'Focus Gummies';
    const brandUrl = brand.website || 'https://focusgummies.com';
    const brandPitch = brand.pitch || 'Clean crash-free deep work nootropics';

    const samplePrompt = `Thread Title: ${threadTitle || 'How do founders stay productive for 10+ hours?'}
Thread Content: ${threadBody || 'I find myself hitting a massive wall around 2pm every day and lose all concentration.'}
Active Brand: ${brandName}
Brand Pitch: ${brandPitch}
Brand Link: ${brandUrl}

Provide an example comment output for this thread according to your system instructions.`;

    const orKey = openRouterKey || process.env.OPENROUTER_API_KEY || '';
    if (orKey) {
      try {
        const orModel = aiModel || 'deepseek/deepseek-chat';
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${orKey}`,
          },
          body: JSON.stringify({
            model: orModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: samplePrompt }
            ],
            temperature: temp,
            max_tokens: 600,
          }),
        });

        if (orRes.ok) {
          const orData = await orRes.json();
          const content = orData.choices?.[0]?.message?.content || '';
          return res.json({
            success: true,
            output: content,
            templateId,
            source: `OpenRouter (${orModel})`,
            tokens: orData.usage?.total_tokens || null
          });
        }
      } catch (orErr: any) {
        console.warn('Sandbox OpenRouter execution failed, trying Gemini:', orErr.message);
      }
    }

    if (process.env.GEMINI_API_KEY) {
      try {
        const response = await getGeminiClient().models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: samplePrompt,
          config: {
            systemInstruction: systemPrompt,
          },
        });
        return res.json({
          success: true,
          output: (response.text || '').trim(),
          templateId,
          source: 'Gemini 4 Hydrogen'
        });
      } catch (gemErr: any) {
        console.warn('Sandbox Gemini execution failed, falling back:', gemErr.message);
      }
    }

    // Smart Local Sandbox Fallback
    res.json({
      success: true,
      output: `[Test Sandbox Simulation - ${templateId.toUpperCase()}]\nBased on System Prompt: "${systemPrompt.slice(0, 100)}..."\n\nGenerated comment: "The afternoon slump usually comes down to blood sugar spikes and adenosine buildup. Tracking my peak cognitive hours and replacing heavy carbs with clean nootropics completely fixed that 2pm wall for me."`,
      templateId,
      source: 'Local Simulation'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/prompts', requireAdminAuth, handleSaveAdminPrompt);
app.post('/api/admin/prompts/:id', requireAdminAuth, handleSaveAdminPrompt);

// ==============================================================================
// Dodo Payments Integration (Pro $9/mo · Studio $29/mo · Agency $59/mo) & Webhooks
// ==============================================================================

// 1. Dodo Payments Checkout Trigger (POST & GET)
const handleDodoCheckout = async (req: Request, res: Response) => {
  try {
    const email = (req.body?.email || req.query?.email || '').toString().trim().toLowerCase();
    const userId = (req.body?.userId || req.query?.userId || '').toString().trim();
    const returnUrlParam = (req.body?.returnUrl || req.query?.returnUrl || '').toString().trim();
    const requestedPlanRaw = (req.body?.plan || req.query?.plan || 'pro').toString().trim().toLowerCase();
    const requestedIntervalRaw = (req.body?.interval || req.query?.interval || 'monthly').toString().trim().toLowerCase();

    const resolvedPlan = resolveCheckoutPlan(requestedPlanRaw);
    const resolvedInterval = resolveBillingInterval(requestedIntervalRaw);
    const productId = getDodoProductIdForPlan(process.env, resolvedPlan, resolvedInterval);

    const apiKey = (process.env.DODO_PAYMENTS_API_KEY || '').trim();
    const isLive = process.env.DODO_PAYMENTS_MODE === 'live';
    const origin = req.headers.origin || `http://${req.headers.host}`;
    const returnUrl = returnUrlParam || `${origin}/dashboard?payment=success&plan=${resolvedPlan}&interval=${resolvedInterval}`;

    // Direct hosted fallback checkout link
    const directCheckoutUrl = `https://checkout.dodopayments.com/buy/${productId}?email=${encodeURIComponent(email)}&metadata[userId]=${encodeURIComponent(userId)}&metadata[plan]=${encodeURIComponent(resolvedPlan)}&metadata[interval]=${encodeURIComponent(resolvedInterval)}&return_url=${encodeURIComponent(returnUrl)}`;

    if (apiKey) {
      try {
        const dodoBase = isLive ? 'https://api.dodopayments.com' : 'https://test.dodopayments.com';
        const requestBody: Record<string, any> = {
          product_cart: [{ product_id: productId, quantity: 1 }],
          metadata: { userId, email, plan: resolvedPlan, interval: resolvedInterval },
          return_url: returnUrl,
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
            'Authorization': `Bearer ${apiKey}`,
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
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(paymentBody),
          });
        }

        if (dodoRes.ok) {
          const session = await dodoRes.json();
          const checkoutUrl = session.checkout_url || session.payment_link || session.url || directCheckoutUrl;
          if (req.method === 'GET' && !req.query.json) {
            return res.redirect(checkoutUrl);
          }
          return res.json({
            success: true,
            plan: resolvedPlan,
            interval: resolvedInterval,
            checkoutUrl,
            source: 'api',
          });
        }
        console.warn('[Dodo API] Session response not ok:', dodoRes.status);
      } catch (apiErr: any) {
        console.warn('[Dodo API Error]:', apiErr.message);
      }
    }

    if (req.method === 'GET' && !req.query.json) {
      return res.redirect(directCheckoutUrl);
    }
    res.json({
      success: true,
      plan: resolvedPlan,
      interval: resolvedInterval,
      checkoutUrl: directCheckoutUrl,
      source: 'direct',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

app.post('/api/dodo/checkout', handleDodoCheckout);
app.get('/api/dodo/checkout', handleDodoCheckout);

// 2. Dodo Payments Subscription & Checkout Webhook Handler
const handleDodoWebhook = async (req: Request, res: Response) => {
  try {
    const rawSecret = (process.env.DODO_PAYMENTS_WEBHOOK_KEY || process.env.DODO_PAYMENTS_WEBHOOK_ || '').trim();
    if (rawSecret) {
      const rawBody = typeof (req as any).rawBody === 'string'
        ? (req as any).rawBody
        : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
      const sigResult = await verifyDodoWebhookSignature(rawSecret, rawBody, {
        webhookId: req.headers['webhook-id']?.toString(),
        webhookTimestamp: req.headers['webhook-timestamp']?.toString(),
        webhookSignature: req.headers['webhook-signature']?.toString(),
        legacySignature: req.headers['x-dodo-signature']?.toString(),
      });
      if (!sigResult.valid) {
        console.warn('[Dodo Webhook] Rejected invalid signature:', sigResult.reason);
        return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
      }
    }

    const payload = req.body || {};
    const outcome = resolveDodoWebhookOutcome(payload, process.env);

    if (outcome.action === 'ignore') {
      return res.status(200).json({ success: true, message: `Ignored event: ${outcome.eventType}` });
    }

    if (!outcome.email && !outcome.userId && !outcome.dodoSubscriptionId) {
      console.warn('[Dodo Webhook] Webhook missing customer email, userId, and subscription_id');
      return res.status(200).json({ success: true, warning: 'No user identifier found in payload' });
    }

    const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseUrl = rawUrl.trim().replace(/\/+$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KE || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !key) {
      console.warn('[Dodo Webhook] Supabase credentials not set in environment.');
      return res.status(200).json({
        success: true,
        warning: 'Payment logged; Supabase offline',
        action: outcome.action,
        tier: outcome.tier,
        interval: outcome.interval,
        subscriptionStatus: outcome.subscriptionStatus,
      });
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

    const patchResult = await patchSupabaseProfileSafe(supabaseUrl, key, filter, fullUpdate, {
      tier: outcome.tier,
      updated_at: nowIso,
    });

    if (patchResult.ok) {
      invalidateAuthCacheForUser(outcome.userId, outcome.email);
      const label = formatTierDisplayName(outcome.tier);
      const verb = outcome.action === 'cancel' ? 'subscription updated' : 'upgraded';
      return res.status(200).json({
        success: true,
        message: `Account ${verb} to ${label} (${outcome.subscriptionStatus})`,
        tier: outcome.tier,
        interval: outcome.interval,
        subscriptionStatus: outcome.subscriptionStatus,
        user: patchResult.rows?.[0] || { email: outcome.email, userId: outcome.userId, tier: outcome.tier },
      });
    }

    console.warn(`[Dodo Webhook] Supabase update status: ${patchResult.status}`);
    res.status(200).json({ success: true, message: `Processed (Supabase status ${patchResult.status})` });
  } catch (err: any) {
    console.error('[Dodo Webhook Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

app.post('/api/webhooks/dodo', handleDodoWebhook);
app.post('/api/dodo/webhook', handleDodoWebhook);

// 3. Extension Distribution Download Endpoint (Authenticated via Bearer JWT or Signed Download Token)
async function requireExtensionDownloadAuth(req: AuthedRequest, res: Response, next: express.NextFunction) {
  const bearer = extractBearerToken(req);
  if (bearer) {
    const verified = await verifyBearerToken(bearer);
    if (!verified.ok) {
      res.status(401).json({ success: false, error: verified.error });
      return;
    }
    req.authUser = verified.user;
    next();
    return;
  }

  const dt = String(req.query?.dt || '').trim();
  if (dt) {
    const tokenUser = verifyDownloadToken(dt);
    if (!tokenUser) {
      res.status(401).json({ success: false, error: 'Invalid or expired download token' });
      return;
    }
    req.authUser = tokenUser;
    next();
    return;
  }

  res.status(401).json({ success: false, error: 'Authentication required to download the extension' });
}

app.get(['/api/download/extension', '/downloads/smart-poster-extension-:version.zip'], requireExtensionDownloadAuth, (req: Request, res: Response) => {
  const rawVersion = String(req.params?.version || req.query?.version || 'v1.3.0').replace(/[^a-zA-Z0-9._-]/g, '');
  const reqVersion = rawVersion ? (/^\d/.test(rawVersion) ? `v${rawVersion}` : rawVersion) : 'v1.3.0';
  const downloadsDir = path.join(__dirname, 'public', 'downloads');
  const candidateNames = [
    `smart-poster-extension-${reqVersion}.zip`,
    'smart-poster-extension-v1.3.0.zip',
  ];

  for (const fileName of candidateNames) {
    const zipPath = path.join(downloadsDir, fileName);
    if (fs.existsSync(zipPath)) {
      res.setHeader('Content-Disposition', `attachment; filename="smart-poster-extension-${reqVersion}.zip"`);
      res.setHeader('Content-Type', 'application/zip');
      return res.sendFile(zipPath);
    }
  }
  res.status(404).json({ success: false, error: 'Extension archive not found' });
});

// Prevent unauthenticated static serving of /downloads/*
app.use('/downloads', requireExtensionDownloadAuth);

// 4. Customer Dashboard & Login Direct Static Routing
app.get(['/dashboard', '/dashboard.html'], (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get(['/login', '/login.html'], (_req: Request, res: Response) => {
  const loginPath = process.env.NODE_ENV === 'production'
    ? path.join(__dirname, 'dist', 'login.html')
    : path.join(__dirname, 'login.html');
  if (fs.existsSync(loginPath)) {
    return res.sendFile(loginPath);
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get(['/admin', '/admin.html'], (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get(['/auth/callback', '/auth/callback.html'], (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'auth', 'callback.html'));
});

app.get(['/privacy', '/privacy.html'], (_req: Request, res: Response) => {
  const prodPath = path.join(__dirname, 'dist', 'privacy.html');
  if (process.env.NODE_ENV === 'production' && fs.existsSync(prodPath)) {
    return res.sendFile(prodPath);
  }
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

app.get(['/terms', '/terms.html'], (_req: Request, res: Response) => {
  const prodPath = path.join(__dirname, 'dist', 'terms.html');
  if (process.env.NODE_ENV === 'production' && fs.existsSync(prodPath)) {
    return res.sendFile(prodPath);
  }
  res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

app.get(['/opengrapgh', '/opengrapgh.html', '/opengraph', '/opengraph.html'], (_req: Request, res: Response) => {
  const prodPath = path.join(__dirname, 'dist', 'opengrapgh.html');
  if (process.env.NODE_ENV === 'production' && fs.existsSync(prodPath)) {
    return res.sendFile(prodPath);
  }
  res.sendFile(path.join(__dirname, 'public', 'opengrapgh.html'));
});

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

function buildFullBrandContextBlock(brand: any): string {
  if (!brand || typeof brand !== 'object') return 'Use ONLY the provided text context.';
  const lines: string[] = [];
  const push = (label: string, val: any, maxLen = 400) => {
    const str = String(val || '').trim();
    if (str) lines.push(`${label}: ${str.slice(0, maxLen)}`);
  };
  const listTexts = (arr: any[], maxItems = 4, maxLen = 220): string => {
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return arr
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          if (item.subject && item.body) return `Subject: ${String(item.subject).trim()} | Body: ${String(item.body).trim()}`;
          if (item.title && item.body) return `${String(item.title).trim()}: ${String(item.body).trim()}`;
          return String(item.text || item.message || item.body || item.title || '').trim();
        }
        return '';
      })
      .filter(Boolean)
      .slice(0, maxItems)
      .map((s) => s.slice(0, maxLen))
      .join(' || ');
  };

  push('Brand / Product Name', brand.name || brand.brandName, 120);
  push('Website URL', brand.website || brand.url, 200);
  push('One-Line Tagline', brand.tagline, 200);
  const shortPitchVal = brand.shortPitch || brand.brandAssets?.shortPitch || brand.pitch;
  push('Short Pitch', shortPitchVal, 600);
  const shortVars = Array.isArray(brand.brandAssets?.shortPitches)
    ? brand.brandAssets.shortPitches.map((s: any) => String(typeof s === 'string' ? s : s?.text || '').trim()).filter(Boolean)
    : [];
  if (shortVars.length > 1) {
    lines.push(`Short Pitch Variations: ${shortVars.slice(0, 5).map((s: string) => s.slice(0, 400)).join(' || ')}`);
  }
  push('Long Pitch / Description', brand.longPitch || brand.brandAssets?.longPitch || brand.description || brand.pitch, 2500);
  if (brand.description && brand.description !== brand.pitch && brand.description !== brand.longPitch) {
    push('Extended Product Description', brand.description, 1500);
  }
  push('Target Audience', brand.targetAudience || brand.brandAssets?.targetAudience, 350);
  push('Pricing & Offer Summary', brand.pricingSummary || brand.brandAssets?.pricingSummary || brand.pricing, 400);
  push('Founder Story', brand.founderStory || brand.brandAssets?.founderStory, 500);
  push('Twitter / X Handle', brand.twitter || brand.brandAssets?.handles?.twitter, 80);
  push('Instagram Handle', brand.instagram || brand.brandAssets?.handles?.instagram, 80);

  const ba = brand.brandAssets;
  if (ba && typeof ba === 'object') {
    const fmtPairList = (arr: any[], maxItems = 6) => (Array.isArray(arr) ? arr : [])
      .map((x: any) => (typeof x === 'string' ? x.trim() : [x?.title || x?.name, x?.detail].filter(Boolean).join(': ')))
      .filter(Boolean)
      .slice(0, maxItems)
      .map((s: string) => s.slice(0, 160))
      .join(' | ');
    const feats = fmtPairList(ba.features, 6);
    if (feats) lines.push(`Key Features: ${feats}`);
    const bens = fmtPairList(ba.benefits, 5);
    if (bens) lines.push(`Core Benefits: ${bens}`);
    const comps = (Array.isArray(ba.competitors) ? ba.competitors : [])
      .filter((c: any) => c?.name || c?.advantage)
      .slice(0, 4)
      .map((c: any) => `${String(c.name || '').trim()}: ${String(c.advantage || '').trim()}${c.recommendWhen ? ` (When: ${String(c.recommendWhen).trim()})` : ''}`.slice(0, 200));
    if (comps.length > 0) lines.push(`Competitor Comparisons: ${comps.join(' || ')}`);
    const tests = (Array.isArray(ba.proof?.testimonials) ? ba.proof.testimonials : [])
      .filter((t: any) => t?.quote)
      .slice(0, 2)
      .map((t: any) => `"${String(t.quote).trim().slice(0, 180)}"${t.author ? ` — ${String(t.author).trim()}` : ''}`);
    if (tests.length > 0) lines.push(`Testimonials: ${tests.join(' || ')}`);
    const customLinks = (Array.isArray(ba.customLinks) ? ba.customLinks : [])
      .filter((l: any) => l?.name && l?.url)
      .slice(0, 6)
      .map((l: any) => `${String(l.name).trim()}=${String(l.url).trim()}`);
    const extraLinks = [ba.links?.pricingUrl ? `Pricing=${ba.links.pricingUrl}` : '', ba.links?.docsUrl ? `Docs=${ba.links.docsUrl}` : '', ba.links?.bookingUrl ? `Booking=${ba.links.bookingUrl}` : '', ba.videos?.demoUrl ? `Demo=${ba.videos.demoUrl}` : '', ...customLinks].filter(Boolean);
    if (extraLinks.length > 0) lines.push(`Key Links & Videos: ${extraLinks.join(' | ').slice(0, 450)}`);
    const extraHandles = [ba.handles?.linkedin ? `LinkedIn=${ba.handles.linkedin}` : '', ba.handles?.github ? `GitHub=${ba.handles.github}` : '', ba.handles?.youtube ? `YouTube=${ba.handles.youtube}` : '', ba.handles?.productHunt ? `PH=${ba.handles.productHunt}` : ''].filter(Boolean);
    if (extraHandles.length > 0) lines.push(`Social Handles: ${extraHandles.join(' | ').slice(0, 220)}`);
    push('Forbidden Words / Claims (NEVER USE)', ba.tone?.forbiddenWords, 200);
    const customSections = (Array.isArray(ba.customSections) ? ba.customSections : [])
      .filter((s: any) => s?.title && s?.content)
      .slice(0, 5);
    for (const sec of customSections) {
      push(String(sec.title).trim().slice(0, 80), String(sec.content).trim(), 350);
    }
  }

  const dir = brand.directory;
  if (dir && typeof dir === 'object') {
    push('Directory Product Name', dir.productName, 100);
    push('Category', dir.category, 80);
    push('Pricing Model', [dir.pricingModel, dir.startingPrice].filter(Boolean).join(' — '), 120);
    push('Demo URL', dir.demoUrl, 200);
    const dirTags = listTexts(dir.taglines, 12, 100);
    const dirPitches = listTexts(dir.pitches, 12, 180);
    const dirSummaries = listTexts(dir.summaries, 10, 280);
    const dirDescs = listTexts(dir.descriptions, 8, 600);
    if (dirTags) lines.push(`Directory Taglines: ${dirTags}`);
    if (dirPitches) lines.push(`Directory Pitches: ${dirPitches}`);
    if (dirSummaries) lines.push(`Directory Summaries: ${dirSummaries}`);
    if (dirDescs) lines.push(`Directory Descriptions: ${dirDescs}`);
  }

  const contact = brand.contact;
  if (contact && typeof contact === 'object') {
    push('Sender Name', contact.senderName, 100);
    push('Company', contact.company, 100);
    push('Contact Default Subject', contact.subject, 160);
    const contactMsgs = listTexts(contact.messages, 15, 360) || String(contact.message || '').trim().slice(0, 360);
    if (contactMsgs) lines.push(`Contact Form Message Samples: ${contactMsgs}`);
  }

  const commentSamples = listTexts(brand.comments, 25, 300);
  if (commentSamples) lines.push(`Saved Comment Templates (${Array.isArray(brand.comments) ? brand.comments.length : 0}): ${commentSamples}`);
  const emailSamples = listTexts(brand.emails, 15, 450);
  if (emailSamples) lines.push(`Cold Email Templates (${Array.isArray(brand.emails) ? brand.emails.length : 0}): ${emailSamples}`);
  const dmSamples = listTexts(brand.dms, 15, 320);
  if (dmSamples) lines.push(`DM Templates (${Array.isArray(brand.dms) ? brand.dms.length : 0}): ${dmSamples}`);
  const socialPostSamples = (Array.isArray(brand.socialPosts) ? brand.socialPosts : [])
    .slice(0, 15)
    .map((p: any) => [p?.platform ? `[${String(p.platform).trim()}]` : '', p?.hook || '', p?.body || p?.text || ''].filter(Boolean).join(' ').slice(0, 320))
    .filter(Boolean)
    .join(' || ');
  if (socialPostSamples) lines.push(`Social Post Samples (${Array.isArray(brand.socialPosts) ? brand.socialPosts.length : 0}): ${socialPostSamples}`);
  const faqSamples = (Array.isArray(brand.support?.faqs) ? brand.support.faqs : [])
    .slice(0, 15)
    .map((f: any) => `${String(f?.question || '').trim()}: ${String(f?.answer || '').trim()}`.slice(0, 260))
    .filter((s: string) => s.length > 2)
    .join(' || ');
  if (faqSamples) lines.push(`Support FAQs (${Array.isArray(brand.support?.faqs) ? brand.support.faqs.length : 0}): ${faqSamples}`);
  const macroSamples = listTexts(brand.support?.macros, 15, 280);
  if (macroSamples) lines.push(`Support Macros (${Array.isArray(brand.support?.macros) ? brand.support.macros.length : 0}): ${macroSamples}`);
  const articleSamples = listTexts(brand.articles, 10, 500);
  if (articleSamples) lines.push(`Articles & Blogs (${Array.isArray(brand.articles) ? brand.articles.length : 0}): ${articleSamples}`);
  const vaultSamples = (Array.isArray(brand.contentVault) ? brand.contentVault : [])
    .slice(0, 20)
    .map((v: any) => `${v?.title ? `[${String(v.title).trim()}] ` : ''}${String(v?.body || '').trim()}`.slice(0, 260))
    .filter(Boolean)
    .join(' || ');
  if (vaultSamples) lines.push(`Content Vault Ideas & Drafts (${Array.isArray(brand.contentVault) ? brand.contentVault.length : 0}): ${vaultSamples}`);

  return lines.length > 0 ? lines.join('\n').slice(0, 18000) : 'Use ONLY the provided text context.';
}

function getModuleFormatGuidance(moduleType: string): string {
  const m = String(moduleType || '').toLowerCase();
  if (m === 'directory_tagline' || m === 'directory-taglines' || m === 'taglines') {
    return 'Target Module: Directory Tagline. Keep it crisp and STRICTLY under 60 characters.';
  }
  if (m === 'directory_pitch' || m === 'directory-pitches' || m === 'pitches') {
    return 'Target Module: Directory Elevator Pitch. Keep it compelling and STRICTLY under 140 characters.';
  }
  if (m === 'directory_summary' || m === 'directory-summaries' || m === 'summaries') {
    return 'Target Module: Directory Short Summary. Keep it clear and STRICTLY under 250 characters.';
  }
  if (m === 'directory_description' || m === 'directory-descriptions' || m === 'descriptions') {
    return 'Target Module: Directory Full Description. Provide a well-structured, informative product description.';
  }
  if (m === 'contact_message' || m === 'contact-message' || m === 'contact') {
    return 'Target Module: Contact Form Message body. Write a direct, human B2B/outreach contact form message body (no subject line unless requested).';
  }
  if (m === 'email') {
    return 'Target Module: Cold Outreach Email body. Write a clean, high-converting email body (without prepending "Subject:" unless explicitly requested).';
  }
  if (m === 'dm') {
    return 'Target Module: Direct Message (DM). Write a conversational, natural DM suitable for Twitter/X, LinkedIn, Reddit, or Instagram.';
  }
  if (m === 'social_post' || m === 'social-post' || m === 'social') {
    return 'Target Module: Native Social Post (X/Twitter, LinkedIn, Threads, Reddit). Write a punchy hook + clean post body. Avoid "https://" for X/Twitter posts unless explicitly requested.';
  }
  if (m === 'support_faq' || m === 'support-faq') {
    return 'Target Module: Customer Support FAQ Answer. Write a clear, concise, helpful answer grounded strictly in the product details, pricing, and documentation links.';
  }
  if (m === 'support_macro' || m === 'support-macro' || m === 'support') {
    return 'Target Module: Customer Support Reply / Canned Macro. Write a warm, human, non-robotic support reply addressing the issue or feature question clearly.';
  }
  if (m === 'article') {
    return 'Target Module: Long-Form Article / Blog Post body. Write well-structured, engaging SEO-friendly article prose.';
  }
  return 'Target Module: Social Comment / Outreach post. Keep it natural, human, and concise (under 280 chars if short social reply).';
}

// Phase 4 & 5: Scoped AI Content Actions (OpenRouter BYOK + Server-Hosted Pro AI)
// Actions: 'generate' | 'regenerate' | 'rewrite' | 'refine' | 'add_emojis' | 'custom'
function parseVariationsFromAiOutput(rawOutput: string, expectedCount: number): string[] {
  const cleaned = String(rawOutput || '').trim();
  if (!cleaned) return [];
  if (expectedCount <= 1) return [cleaned];

  const tryJson = (candidate: string): string[] => {
    try {
      const parsed = JSON.parse(candidate);
      const arr = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed?.variations) ? parsed.variations : []);
      return arr.map((x: unknown) => String(x || '').trim()).filter(Boolean);
    } catch {
      return [];
    }
  };

  const unfenced = cleaned
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let items = tryJson(unfenced);
  if (items.length === 0) {
    const jsonMatch = unfenced.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      items = tryJson(jsonMatch[0]);
    }
  }
  if (items.length === 0) {
    items = unfenced
      .split(/\n(?=\s*(?:\d+[.)]|[-*•])\s+)/)
      .map((s) => s.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, '').replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);
  }
  if (items.length === 0) {
    items = [cleaned];
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique.slice(0, expectedCount);
}

app.post('/api/ai/action', optionalVerifiedAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const {
      action,
      text = '',
      customPrompt = '',
      moduleType = '',
      brand = {},
      openRouterKey = '',
      geminiApiKey = '',
      aiModel = '',
      templateId = '',
      variationCount,
      existingTexts = [],
      creativityLevel = 4,
      protectedTokens = []
    } = req.body;

    const userByokKey = String(openRouterKey || '').trim();
    const userGeminiKey = String(geminiApiKey || '').trim();
    if (!userByokKey && !userGeminiKey) {
      return res.status(401).json({
        success: false,
        needsApiKey: true,
        error: 'Add your OpenRouter or Google Gemini API key in Settings to use AI actions.',
      });
    }

    const isAutoVaryBatch = action === 'auto_vary_batch';
    const normalizedCreativity = normalizeCreativityLevel(creativityLevel);
    const defaultCount = isAutoVaryBatch ? 6 : 1;
    const parsedCount = Math.max(1, Math.min(10, parseInt(String(variationCount ?? defaultCount), 10) || defaultCount));
    const excludeList: string[] = Array.isArray(existingTexts)
      ? existingTexts.map((x: unknown) => String(x || '').trim()).filter(Boolean).slice(0, 12)
      : [];
    const explicitProtectedTokens: string[] = Array.isArray(protectedTokens)
      ? protectedTokens.map((x: unknown) => String(x || '').trim()).filter(Boolean).slice(0, 24)
      : [];

    const brandName = String(brand?.name || brand?.brandName || '').trim();
    const brandTagline = String(brand?.tagline || '').trim();
    const brandPitch = String(brand?.pitch || brand?.description || '').trim();
    const brandWebsite = String(brand?.website || brand?.url || '').trim();
    const brandContextBlock = buildFullBrandContextBlock(brand);
    const moduleGuidance = getModuleFormatGuidance(moduleType);
    const cleanCustomPrompt = String(customPrompt || '').trim();
    const hasBoxText = Boolean(String(text || '').trim());

    if (action === 'custom' && !cleanCustomPrompt) {
      res.status(400).json({ success: false, error: 'Please enter a custom instruction.' });
      return;
    }

    if (isAutoVaryBatch && !hasBoxText) {
      res.status(400).json({ success: false, error: 'Source text is required for auto_vary_batch.' });
      return;
    }

    const supportedActions = [
      'generate',
      'regenerate',
      'rewrite',
      'refine',
      'add_emojis',
      'custom',
      'auto_vary_batch',
      'humanize',
      'shorter',
      'less_salesy',
      'more_casual',
      'spintax',
      'strip_urls_x',
      'translate',
    ];
    if (!supportedActions.includes(action)) {
      res.status(400).json({ success: false, error: `Unsupported AI action: ${action}` });
      return;
    }

    let systemInstruction = '';
    let prompt = '';

    // Check dynamic prompt templates if a specific templateId was supplied or default
    if (templateId && action !== 'custom') {
      try {
        const templates = await loadPromptTemplates();
        const matched = templates.find((t: any) => t.id === templateId);
        if (matched?.system_instruction) {
          systemInstruction = matched.system_instruction;
        }
      } catch (tErr) {
        console.warn('Could not load templateId:', tErr);
      }
    }

    const avoidBlock = excludeList.length > 0
      ? `\n\nExisting Variations to Avoid Repeating (write something genuinely fresh and distinct):\n${excludeList.slice(0, 6).map((s, i) => `${i + 1}. ${s.slice(0, 220)}`).join('\n')}`
      : '';

    const multiVarRule = parsedCount > 1
      ? `\n\nCRITICAL OUTPUT FORMAT: Generate EXACTLY ${parsedCount} distinct, non-repetitive variations. Each variation must use a noticeably different hook, angle, or phrasing. Return ONLY valid JSON in the exact format: {"variations": ["...", "..."]} containing ${parsedCount} string items.`
      : '';

    let batchMeta: { protectedTokens: string[]; temperature: number } | null = null;
    if (isAutoVaryBatch) {
      const batchPrompts = buildAutoVaryBatchPrompts({
        text,
        creativityLevel: normalizedCreativity,
        variationCount: parsedCount,
        brand,
        brandContextBlock,
        moduleType,
        protectedTokens: explicitProtectedTokens,
        existingTexts: excludeList,
      });
      systemInstruction = batchPrompts.systemInstruction;
      prompt = batchPrompts.prompt;
      batchMeta = {
        protectedTokens: batchPrompts.protectedTokens,
        temperature: batchPrompts.temperature,
      };
    } else if (!systemInstruction) {
      if (action === 'rewrite') {
        systemInstruction =
          "You are an expert copywriter. Create another distinct variation of the provided text while keeping the core message, pitch, links/URLs, and exact tone/voice consistent. CRITICAL RULES: 1) Do NOT change the tone (if it is casual keep it casual, if it is direct keep it direct). 2) Do NOT simply reorder or reverse sentences — genuinely rephrase sentences cleanly. 3) Keep all URLs, brand names, and product facts exact. 4) Write natural, grammatically fluent English. 5) Output ONLY the rewritten text, with no quotes or commentary.";
      } else if (action === 'refine') {
        systemInstruction =
          "You are an expert copy editor. Make the provided text tighter, sharper, clearer, and more effective. CRITICAL RULES: 1) Cut filler words, fluff, and redundancy so it reads crisper and stronger. 2) Keep the exact same core message, links/URLs, pitch, and original tone/voice. 3) Do NOT invent new claims or rewrite into a different style. 4) Output ONLY the refined text, with no quotes or commentary.";
      } else if (action === 'humanize') {
        systemInstruction =
          "You are a ruthless human editor who removes all traces of AI-sounding writing. Strip robotic buzzwords ('delve', 'testament', 'game-changer', 'revolutionize', 'unlock your potential', 'in today\\'s fast-paced', 'elevate', 'seamless', 'leverage', 'cutting-edge'), eliminate rigid symmetrical templates, vary sentence cadence naturally like a real founder typing to a peer, respect all brand forbidden words, and preserve all core product facts and links. Output ONLY the humanized text.";
      } else if (action === 'shorter') {
        systemInstruction =
          "You are a concise copy editor. Trim the text down by ~35-50% while preserving the hook, core value, CTA, links, and brand voice. Cut every unnecessary word. Output ONLY the shortened text.";
      } else if (action === 'less_salesy') {
        systemInstruction =
          "You are an organic community copywriter. Rewrite the draft so it sounds 100% genuine, peer-to-peer, helpful, and non-pushy—removing hype, urgency gimmicks, and promotional adjectives while keeping helpful context and natural product alignment. Output ONLY the updated text.";
      } else if (action === 'more_casual') {
        systemInstruction =
          "You are a conversational founder. Rewrite the text to sound relaxed, natural, warm, and unscripted while preserving all product facts and links. Output ONLY the updated text.";
      } else if (action === 'spintax') {
        systemInstruction =
          "You are a Smart Poster spintax specialist. Convert key interchangeable words and short phrases in the provided text into clean single-level {option1|option2|option3} spintax syntax compatible with Smart Poster's Randomness Engine. NEVER spin URLs, domain names, email addresses, or brand names. Keep natural grammar across every combination. Output ONLY the spintax-formatted text.";
      } else if (action === 'strip_urls_x') {
        systemInstruction =
          "You are an X / Twitter formatting specialist. Strip 'https://' and 'http://' from URLs (converting to clean domain/path text like 'domain.com') and tighten phrasing cleanly to fit X/Twitter norms without losing impact. Output ONLY the formatted post.";
      } else if (action === 'translate') {
        systemInstruction =
          "You are an idiomatic native marketing translator. Translate the provided text into the target language requested by the user while preserving brand voice, persuasion, product names, URLs, and formatting (NOT word-for-word literal translation). Output ONLY the translated text.";
      } else if (action === 'add_emojis') {
        systemInstruction =
          "You are a social engagement specialist. Add 2 to 3 relevant, tasteful emojis to the text at natural breaks. Do NOT alter, add, or delete any words or links. Output ONLY the updated text.";
      } else if (action === 'generate') {
        systemInstruction =
          "You are an expert outreach copywriter. Write fresh, natural, grammatically fluent, high-converting copy grounded strictly in the complete active Brand / Campaign details. Automatically match the tone and language of the Brand Assets & existing Product content first, falling back to the Product website voice or inferred niche. Never invent unrelated products or fake URLs. Vary your angle and phrasing from any existing variations. Output ONLY the final copy text, with no quotes or commentary.";
      } else if (action === 'regenerate') {
        systemInstruction =
          "You are an expert outreach copywriter. Regenerate a completely fresh, natural, grammatically fluent alternative based on the complete active Brand / Campaign context. Automatically match the tone and language of the Brand Assets & existing Product content first, falling back to website voice or niche. It MUST differ meaningfully in wording, hook, and structure from the previous draft and any existing variations. Output ONLY the regenerated copy text, with no quotes or commentary.";
      } else if (action === 'custom') {
        systemInstruction =
          "You are an expert marketing and outreach copywriter inside Smart Poster. Execute the user's custom instruction precisely using BOTH the provided draft text (if present) AND the complete active campaign/brand materials provided in context. Adapt automatically to the tone/language of Brand Assets & saved content first, then website copy, then niche. Never invent unrelated products or fake URLs. Respect any module character limits or formatting guidance." +
          (parsedCount > 1
            ? ` Generate EXACTLY ${parsedCount} distinct variations and return ONLY valid JSON: {"variations": ["..."]}.`
            : ' Output ONLY the final copy text with no surrounding quotes, labels, or commentary.');
      }
    } else if (parsedCount > 1) {
      systemInstruction += multiVarRule;
    }

    if (!isAutoVaryBatch) {
      if (action === 'rewrite') {
        prompt = `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}\n\nText Currently in Box (rewrite this keeping the same pitch, links, and tone):\n${text}${avoidBlock}\n\nRewritten variation:`;
      } else if (action === 'refine') {
        prompt = `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}\n\nText Currently in Box (tighten and sharpen without changing meaning or tone):\n${text}\n\nRefined text:`;
      } else if (['humanize', 'shorter', 'less_salesy', 'more_casual', 'spintax', 'strip_urls_x', 'translate'].includes(action)) {
        prompt = `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}\n\nOriginal Copy:\n${text}${cleanCustomPrompt ? `\n\nAdditional Instruction:\n${cleanCustomPrompt}` : ''}\n\nDeliver ONLY the updated copy:`;
      } else if (action === 'add_emojis') {
        prompt = `Text Currently in Box:\n${text}\n\nReturn the exact text with 2-3 relevant emojis inserted naturally:`;
      } else if (action === 'generate') {
        prompt = hasBoxText
          ? `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}\n\nReference Text Currently in Box:\n${text}${avoidBlock}\n\nGenerate fresh, high-converting copy for this campaign that takes a fresh angle:`
          : `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}${avoidBlock}\n\nGenerate fresh, natural, high-converting copy for this active campaign:`;
      } else if (action === 'regenerate') {
        prompt = hasBoxText
          ? `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}\n\nPrevious Version to Replace (do NOT repeat this phrasing or structure):\n${text}${avoidBlock}\n\nRegenerate a fresh, distinct alternative for this campaign:`
          : `${moduleGuidance}\n\nActive Campaign Context:\n${brandContextBlock}${avoidBlock}\n\nRegenerate a fresh, distinct piece of copy for this active campaign:`;
      } else if (action === 'custom') {
        prompt = `${moduleGuidance}\n\nComplete Active Brand / Campaign Materials:\n${brandContextBlock}\n\n${hasBoxText ? `Current Text in Box:\n${text}\n\n` : 'Current Text in Box: (empty — generate directly from the brand/campaign materials above)\n\n'}User Custom Requirement:\n${cleanCustomPrompt}${avoidBlock}${multiVarRule}\n\n${parsedCount > 1 ? `Return valid JSON with ${parsedCount} distinct variations:` : 'Deliver ONLY the final updated copy:'}`;
      }
    }

    const finalizeActionVariations = (rawItems: string[]): { variations: string[]; rejectedCount: number; protectedTokens: string[] } => {
      if (isAutoVaryBatch) {
        const filtered = filterValidatedAutoVariations(text, rawItems, {
          level: normalizedCreativity,
          brandName,
          protectedTokens: batchMeta?.protectedTokens || explicitProtectedTokens,
          existingTexts: excludeList,
          maxCount: parsedCount,
        });
        if (filtered.valid.length >= parsedCount) {
          return {
            variations: filtered.valid.slice(0, parsedCount),
            rejectedCount: filtered.rejectedCount,
            protectedTokens: filtered.protectedTokens,
          };
        }
        const extras = buildAutoVaryLocalFallback({
          text,
          creativityLevel: normalizedCreativity,
          count: parsedCount - filtered.valid.length,
          brandName,
          protectedTokens: filtered.protectedTokens,
          existingTexts: [...excludeList, ...filtered.valid],
        });
        return {
          variations: [...filtered.valid, ...extras].slice(0, parsedCount),
          rejectedCount: filtered.rejectedCount,
          protectedTokens: filtered.protectedTokens,
        };
      }

      const cleanItems = rawItems.map((s) => String(s || '').trim()).filter(Boolean);
      if (cleanItems.length >= parsedCount) {
        return { variations: cleanItems.slice(0, parsedCount), rejectedCount: 0, protectedTokens: [] };
      }
      const extras = buildLocalAiVariations(
        action,
        text,
        { brandName, brandTagline, brandPitch, brandWebsite, moduleType, brand },
        cleanCustomPrompt,
        parsedCount - cleanItems.length,
        [...excludeList, ...cleanItems]
      );
      return {
        variations: [...cleanItems, ...extras].slice(0, parsedCount),
        rejectedCount: 0,
        protectedTokens: [],
      };
    };

    // Priority 1: User BYOK OpenRouter API execution ($0 server AI cost)
    let lastProviderError = '';
    let lastProviderStatus = 0;
    if (userByokKey) {
      try {
        const orModel = aiModel || 'deepseek/deepseek-chat';
        const baseMaxTokens = String(moduleType || '').toLowerCase() === 'article' ? 1400 : 700;
        const temperature = batchMeta
          ? batchMeta.temperature
          : (action === 'refine' ? 0.35 : (action === 'regenerate' ? 0.85 : 0.72));
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userByokKey}`,
          },
          body: JSON.stringify({
            model: orModel,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: prompt }
            ],
            temperature,
            max_tokens: parsedCount > 1 ? Math.min(4000, baseMaxTokens * Math.min(parsedCount, 5)) : baseMaxTokens,
          }),
        });

        if (orRes.ok) {
          const orData = await orRes.json();
          const resultText = (orData.choices?.[0]?.message?.content || '').trim();
          if (resultText) {
            const parsedList = isAutoVaryBatch
              ? parseVariationsJsonOrList(resultText, parsedCount)
              : parseVariationsFromAiOutput(resultText, parsedCount);
            const finalized = finalizeActionVariations(parsedList);
            return res.json({
              success: true,
              text: finalized.variations[0] || '',
              variations: finalized.variations,
              ...(isAutoVaryBatch ? {
                creativityLevel: normalizedCreativity,
                protectedTokens: finalized.protectedTokens,
                rejectedCount: finalized.rejectedCount,
              } : {}),
              source: `openrouter (${orModel})`
            });
          }
        } else {
          lastProviderStatus = orRes.status;
          const errText = await orRes.text().catch(() => '');
          lastProviderError = `OpenRouter returned HTTP ${orRes.status}`;
          try {
            const parsedErr = JSON.parse(errText);
            if (parsedErr?.error?.message) lastProviderError = parsedErr.error.message;
          } catch {
            if (errText) lastProviderError = errText.slice(0, 220);
          }
        }
      } catch (orErr: any) {
        lastProviderError = orErr?.message || 'OpenRouter request failed';
        console.warn('OpenRouter action failed:', lastProviderError);
      }
    }

    // Priority 2: User BYOK Google Gemini API execution ($0 server AI cost)
    if (userGeminiKey) {
      try {
        const gemRes = await callUserGeminiRest({
          apiKey: userGeminiKey,
          model: aiModel,
          systemInstruction,
          prompt,
          temperature: batchMeta ? batchMeta.temperature : (action === 'refine' ? 0.35 : (action === 'regenerate' ? 0.85 : 0.72)),
          jsonMode: parsedCount > 1 || isAutoVaryBatch,
        });
        if (gemRes.ok && gemRes.text) {
          const parsedList = isAutoVaryBatch
            ? parseVariationsJsonOrList(gemRes.text, parsedCount)
            : parseVariationsFromAiOutput(gemRes.text, parsedCount);
          const finalized = finalizeActionVariations(parsedList);
          return res.json({
            success: true,
            text: finalized.variations[0] || '',
            variations: finalized.variations,
            ...(isAutoVaryBatch ? {
              creativityLevel: normalizedCreativity,
              protectedTokens: finalized.protectedTokens,
              rejectedCount: finalized.rejectedCount,
            } : {}),
            source: `gemini-byok (${gemRes.model})`
          });
        }
        lastProviderStatus = gemRes.status || lastProviderStatus;
        lastProviderError = gemRes.error || lastProviderError;
      } catch (gemErr: any) {
        lastProviderError = gemErr?.message || lastProviderError;
      }
    }

    const errStatus = lastProviderStatus === 401 || lastProviderStatus === 403 ? 401 : (lastProviderStatus || 502);
    return res.status(errStatus).json({
      success: false,
      needsApiKey: lastProviderStatus === 401 || lastProviderStatus === 403,
      error: lastProviderError || 'AI generation failed with the configured BYOK key. Please verify your API key and model in Settings.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function normalizeClauseForJoin(raw: string): string {
  const s = String(raw || '').trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
  if (!s) return '';
  if (/^[A-Z][a-z]/.test(s)) {
    return s.charAt(0).toLowerCase() + s.slice(1);
  }
  return s;
}

function formatSentenceCase(raw: string): string {
  const s = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  const capped = /^[a-z]/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

function startsWithImperativeVerb(raw: string): boolean {
  const first = String(raw || '').trim().toLowerCase().split(/\s+/)[0] || '';
  const verbs = new Set([
    'automate', 'boost', 'build', 'connect', 'convert', 'create', 'discover', 'drive',
    'eliminate', 'find', 'fix', 'generate', 'get', 'grow', 'help', 'increase', 'launch',
    'manage', 'optimize', 'promote', 'reduce', 'run', 'save', 'scale', 'schedule',
    'send', 'ship', 'simplify', 'speed', 'streamline', 'submit', 'track', 'transform',
    'turn', 'unlock', 'write'
  ]);
  return verbs.has(first);
}

function formatSuperlativePhrase(raw: string): string {
  const s = normalizeClauseForJoin(raw);
  if (!s) return '';
  if (/^(easiest|best|fastest|simplest|quickest|smartest|most|top)\b/i.test(s) && !/^the\s+/i.test(s)) {
    return `the ${s}`;
  }
  return s;
}

function buildCampaignCandidatePool(
  brand: { brandName: string; brandTagline: string; brandPitch: string; brandWebsite: string; moduleType?: string; brand?: any },
  customPrompt = ''
): string[] {
  const name = brand.brandName || 'this tool';
  const site = brand.brandWebsite || '';
  const rawTag = String(brand.brandTagline || '').trim();
  const rawPitch = String(brand.brandPitch || '').trim();
  const firstPitchSentence = rawPitch.split(/(?<=[.!?])\s+/)[0] || rawPitch;
  const tagJoined = formatSuperlativePhrase(rawTag);
  const pitchJoined = normalizeClauseForJoin(firstPitchSentence);
  const valueSentence = formatSentenceCase(rawPitch || rawTag || 'Built to save hours of manual work');
  const mod = String(brand.moduleType || '').toLowerCase();
  const senderName = String(brand.brand?.contact?.senderName || '').trim();
  const reqLower = String(customPrompt || '').toLowerCase();

  const pool: string[] = [];
  const siteTail = site ? ` (${site})` : '';
  const siteDash = site ? ` — ${site}` : '';
  const siteAt = site ? ` at ${site}` : '';

  if (mod.includes('tagline')) {
    if (rawTag) pool.push(rawTag.slice(0, 60));
    if (tagJoined) pool.push(`${name}: ${tagJoined}`.slice(0, 60));
    if (pitchJoined) pool.push(formatSentenceCase(firstPitchSentence).replace(/\.$/, '').slice(0, 60));
    pool.push(`${name} — Faster, smarter outreach`.slice(0, 60));
    pool.push(`${name} — Built for effortless growth`.slice(0, 60));
  } else if (mod.includes('pitch')) {
    if (rawTag) {
      const verb = startsWithImperativeVerb(rawTag);
      pool.push((verb ? `${name} lets you ${normalizeClauseForJoin(rawTag)}${siteDash}` : `${name} is ${tagJoined}${siteDash}`).slice(0, 140));
    }
    if (firstPitchSentence) pool.push(`${name}: ${formatSentenceCase(firstPitchSentence)}`.slice(0, 140));
    pool.push(`Meet ${name}${tagJoined ? ` — ${tagJoined}` : ''}${siteAt}.`.slice(0, 140));
    pool.push(`${name} streamlines your workflow${site ? ` — explore more at ${site}` : '.'}`.slice(0, 140));
  } else if (mod.includes('summary') || mod.includes('summaries')) {
    const core = rawPitch || rawTag || 'Streamlines daily outreach and saves hours every week.';
    pool.push(`${name}: ${formatSentenceCase(core)}${site ? ` Learn more at ${site}.` : ''}`.slice(0, 250));
    if (tagJoined) {
      pool.push(`Designed as ${tagJoined}, ${name} ${pitchJoined ? `offers ${pitchJoined}` : 'helps teams ship faster'}${siteAt}.`.slice(0, 250));
    }
    pool.push(`If you want a simpler workflow, ${name} brings everything into one place${siteDash}.`.slice(0, 250));
  } else if (mod === 'email') {
    const signOff = senderName ? `\n\nBest,\n${senderName}` : '';
    pool.push(`Hi there,\n\nI wanted to share ${name}${tagJoined ? ` — ${tagJoined}` : ''}. ${valueSentence}${site ? `\n\nYou can take a quick look here: ${site}` : ''}${signOff}`);
    pool.push(`Hello,\n\nQuick note: we built ${name} for teams looking for ${tagJoined || 'a faster workflow'}. ${valueSentence}${site ? `\n\nHappy to share more details or you can explore it at ${site}.` : ''}${signOff}`);
    pool.push(`Hi,\n\nIf ${tagJoined || 'saving time on manual outreach'} is on your radar this quarter, ${name} might be helpful. ${valueSentence}${site ? `\n\nMore info: ${site}` : ''}${signOff}`);
  } else if (mod === 'dm') {
    pool.push(`Hey! Saw your post and thought ${name} might be useful${tagJoined ? ` — it's ${tagJoined}` : ''}.${site ? ` Happy to share the link if helpful: ${site}` : ''}`);
    pool.push(`Quick heads up — if you're exploring options for ${tagJoined || 'this workflow'}, ${name} is worth a look${siteAt}.`);
    pool.push(`Hey! Have you tried ${name} yet? ${valueSentence}${site ? ` ${site}` : ''}`);
  } else if (mod.includes('contact')) {
    const signOff = senderName ? `\n\nThanks,\n${senderName}` : '';
    pool.push(`Hi team,\n\nReaching out regarding ${name}${tagJoined ? ` (${tagJoined})` : ''}. ${valueSentence}${site ? ` Feel free to check out ${site} if that sounds relevant.` : ''}${signOff}`);
    pool.push(`Hello,\n\nWanted to introduce ${name}. ${valueSentence}${site ? ` You can see how it works at ${site}.` : ''}${signOff}`);
    pool.push(`Hi there,\n\nWe've been helping teams with ${tagJoined || 'faster outreach'} through ${name}. ${valueSentence}${site ? ` More details at ${site}.` : ''}${signOff}`);
  } else if (mod === 'article') {
    pool.push(`## Why ${name} Stands Out\n\n${valueSentence}\n\nWhether you're just getting started or scaling an existing workflow${tagJoined ? `, ${name} gives you ${tagJoined}` : ''}.${site ? ` Explore the full feature set at ${site}.` : ''}`);
    pool.push(`### A Smarter Approach with ${name}\n\n${rawTag ? `${formatSentenceCase(rawTag)} ` : ''}${valueSentence}${site ? `\n\nLearn more at ${site}.` : ''}`);
  } else {
    // Comments / general outreach
    if (rawTag && startsWithImperativeVerb(rawTag)) {
      pool.push(`${name} makes it easy to ${normalizeClauseForJoin(rawTag)}${siteDash}`);
      pool.push(`Been using ${name} to ${normalizeClauseForJoin(rawTag)}${site ? ` — worth checking out at ${site}` : '.'}`);
    } else if (tagJoined) {
      pool.push(`${name} has been my go-to for ${tagJoined}${siteDash}`);
      pool.push(`If you're looking for ${tagJoined}, ${name} is worth a look${siteAt}.`);
      pool.push(`I've been using ${name} lately (${tagJoined})${site ? ` — you can check it out at ${site}` : '.'}`);
      pool.push(`Quick recommendation: ${name} is ${tagJoined}${siteTail}.`);
    }
    if (firstPitchSentence) {
      pool.push(`${formatSentenceCase(firstPitchSentence)} That's why I like ${name}${siteAt}.`);
      pool.push(`Worth checking out ${name} — ${normalizeClauseForJoin(firstPitchSentence)}${siteAt}.`);
    }
    pool.push(`You might find ${name} helpful${tagJoined ? ` if you want ${tagJoined}` : ''}${siteDash}`);
    pool.push(`Check out ${name}${siteAt} — ${rawPitch ? normalizeClauseForJoin(firstPitchSentence) : (tagJoined || 'solid workflow tool')}.`);
    pool.push(`Been testing ${name} recently and it saves a ton of time${site ? ` (${site})` : '.'}`);
    pool.push(`Sharing ${name} in case it helps here${tagJoined ? ` — great for ${tagJoined}` : ''}${siteDash}`);
  }

  // Optional custom instruction adjustments
  if (reqLower) {
    return pool.map((item) => {
      let out = item;
      if (/\b(emoji|emojis)\b/.test(reqLower) && !/[✨🚀💡🔥]/.test(out)) {
        out = `${out} ✨`;
      }
      if (/\b(short|concise|brief|shorter)\b/.test(reqLower) && out.length > 140) {
        out = out.slice(0, 137).replace(/\s+\S*$/, '').trim() + '...';
      }
      if (/\b(professional|formal|b2b|polite)\b/.test(reqLower)) {
        out = out.replace(/^Hey!\s*/i, 'Hello — ').replace(/\bcheck out\b/gi, 'explore');
      }
      return out;
    });
  }

  return pool;
}

function buildLocalAiVariations(
  action: string,
  rawText: string,
  brand: { brandName: string; brandTagline: string; brandPitch: string; brandWebsite: string; moduleType?: string; brand?: any },
  customPrompt = '',
  count = 1,
  excludeTexts: string[] = []
): string[] {
  const n = Math.max(1, Math.min(10, count));
  const excluded = new Set(
    [rawText, ...excludeTexts]
      .map((s) => String(s || '').trim().toLowerCase())
      .filter(Boolean)
  );

  if (action === 'generate' || action === 'regenerate' || (action === 'custom' && !String(rawText || '').trim())) {
    const pool = buildCampaignCandidatePool(brand, customPrompt);
    const results: string[] = [];
    for (const cand of pool) {
      const cleanCand = cand.trim();
      if (!cleanCand) continue;
      if (!excluded.has(cleanCand.toLowerCase())) {
        excluded.add(cleanCand.toLowerCase());
        results.push(cleanCand);
        if (results.length >= n) break;
      }
    }
    // If all pool items were already excluded, pick non-identical rotated options
    let fallbackIdx = 0;
    while (results.length < n && pool.length > 0) {
      const base = pool[fallbackIdx % pool.length].trim();
      const suffix = fallbackIdx >= pool.length ? ` (v${Math.floor(fallbackIdx / pool.length) + 1})` : '';
      const candidate = `${base}${suffix}`;
      if (!results.includes(candidate)) {
        results.push(candidate);
      }
      fallbackIdx++;
      if (fallbackIdx > 30) break;
    }
    return results.length > 0 ? results : [pool[0] || `${brand.brandName || 'Our product'}: ${brand.brandWebsite || ''}`.trim()];
  }

  const results: string[] = [];
  let seed = rawText;
  for (let i = 0; i < n; i++) {
    const next = buildLocalAiFallback(action, seed, brand, customPrompt);
    const finalItem = next && !results.includes(next)
      ? next
      : (buildCampaignCandidatePool(brand, customPrompt).find((c) => !excluded.has(c.toLowerCase()) && !results.includes(c)) || next);
    if (finalItem) {
      results.push(finalItem);
      excluded.add(finalItem.toLowerCase());
      seed = finalItem;
    }
  }
  return results;
}

function buildLocalAiFallback(
  action: string,
  rawText: string,
  brand: { brandName: string; brandTagline: string; brandPitch: string; brandWebsite: string; moduleType?: string; brand?: any },
  customPrompt = ''
): string {
  const clean = String(rawText || '').trim();
  const protectedUrls: string[] = [];
  const mask = (s: string) =>
    s.replace(/https?:\/\/[^\s]+|\b(?:[a-z0-9-]+\.)+(?:com|org|net|io|ai|co|work|dev|app|xyz)(?:\/[^\s]*)?/gi, (m) => {
      const idx = protectedUrls.length;
      protectedUrls.push(m);
      return `__URL_${idx}__`;
    });
  const unmask = (s: string) => s.replace(/__URL_(\d+)__/g, (_, i) => protectedUrls[Number(i)] || '');

  if (action === 'custom') {
    const reqLower = String(customPrompt || '').toLowerCase();
    if (!clean) {
      return buildCampaignCandidatePool(brand, customPrompt)[0] || '';
    }
    if (/\b(short|concise|brief|shorter|condense)\b/.test(reqLower)) {
      return buildLocalAiFallback('refine', clean, brand);
    }
    if (/\bemoji\b/.test(reqLower)) {
      return `${clean} ✨`;
    }
    if (/\b(professional|formal|b2b|polite|business)\b/.test(reqLower)) {
      let out = mask(clean)
        .replace(/^(hey|yo|hiya|hi there)[,!.\s]+/i, 'Hello, ')
        .replace(/\bawesome\b/gi, 'valuable')
        .replace(/\bsuper\b/gi, 'highly')
        .replace(/\bcheck out\b/gi, 'explore')
        .replace(/\bguys\b/gi, 'team')
        .replace(/!{2,}/g, '.');
      return unmask(out.replace(/\s{2,}/g, ' ').trim());
    }
    return buildLocalAiFallback('rewrite', clean, brand);
  }

  if (action === 'refine') {
    if (!clean) return '';
    let out = mask(clean)
      .replace(/\b(basically|actually|honestly|literally|really|very|quite|simply|just|kind of|sort of)\b\s*/gi, '')
      .replace(/\bin order to\b/gi, 'to')
      .replace(/\bdue to the fact that\b/gi, 'because')
      .replace(/\ba lot of\b/gi, 'many')
      .replace(/\bis able to\b/gi, 'can')
      .replace(/\bmake sure to\b/gi, '')
      .replace(/\s+([,.!?;:])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (out.length > 0) out = out.charAt(0).toUpperCase() + out.slice(1);
    return unmask(out) || clean;
  }

  if (action === 'rewrite') {
    if (!clean) return '';
    let out = mask(clean);
    const swaps: Array<[RegExp, string]> = [
      [/\bcheck out\b/gi, 'take a look at'],
      [/\btake a look at\b/gi, 'try out'],
      [/\bhelps you\b/gi, 'makes it easy to'],
      [/\blets you\b/gi, 'helps you'],
      [/\bbuilt\b/gi, 'put together'],
      [/\bcreated\b/gi, 'built'],
      [/\bgreat\b/gi, 'solid'],
      [/\bawesome\b/gi, 'really helpful'],
      [/\bquick\b/gi, 'fast'],
      [/\bsimple\b/gi, 'straightforward'],
      [/\bwithout\b/gi, 'minus'],
      [/\bbecause\b/gi, 'since'],
    ];
    let changed = false;
    for (const [re, rep] of swaps) {
      if (re.test(out)) {
        out = out.replace(re, rep);
        changed = true;
      }
    }
    if (!changed) {
      out = out.replace(/^(Hey|Hi)[,!\s]+/i, '') || out;
      out = `Worth sharing — ${out.charAt(0).toLowerCase() + out.slice(1)}`;
    }
    return unmask(out.replace(/\s{2,}/g, ' ').trim());
  }

  if (action === 'add_emojis') {
    return clean ? `${clean} ✨🚀` : '';
  }

  // generate / regenerate
  const pool = buildCampaignCandidatePool(brand, customPrompt);
  return pool.find((c) => c.trim().toLowerCase() !== clean.toLowerCase()) || pool[0] || clean;
}

// Phase 4: Context-Aware Variation Matching (BYOK or $0 keyword overlap heuristic)
app.post('/api/ai/match-context', optionalVerifiedAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { threadTitle = '', threadBody = '', variations = [], openRouterKey = '', geminiApiKey = '', aiModel = '' } = req.body || {};
    const userByokKey = String(openRouterKey || '').trim();
    const userGeminiKey = String(geminiApiKey || '').trim();

    if (!Array.isArray(variations) || variations.length === 0) {
      res.json({ success: true, bestIndex: 0 });
      return;
    }
    if (variations.length === 1) {
      res.json({ success: true, bestIndex: 0 });
      return;
    }

    const variationsList = variations
      .map((v: any, i: number) => `[Index ${i}]: "${String(v).replace(/"/g, '\\"')}"`)
      .join('\n\n');
    const matchPrompt = `Analyze thread:\nTitle: ${threadTitle}\nPost Content: ${threadBody.slice(0, 1500)}\n\nCandidate variations:\n${variationsList}\n\nRespond ONLY with JSON: {"bestIndex": <number>, "reason": "<brief explanation>"}`;

    if (userByokKey) {
      try {
        const orModel = aiModel || 'deepseek/deepseek-chat';
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userByokKey}`,
          },
          body: JSON.stringify({
            model: orModel,
            messages: [{ role: 'user', content: matchPrompt }],
            temperature: 0.2,
            max_tokens: 150,
          }),
        });
        if (orRes.ok) {
          const orData: any = await orRes.json();
          const rawOr = String(orData.choices?.[0]?.message?.content || '').trim();
          const parsed = JSON.parse(rawOr.replace(/^```json/m, '').replace(/^```/m, '').trim());
          if (typeof parsed.bestIndex === 'number' && parsed.bestIndex >= 0 && parsed.bestIndex < variations.length) {
            res.json({ success: true, bestIndex: parsed.bestIndex, reason: parsed.reason || 'BYOK OpenRouter match' });
            return;
          }
        }
      } catch (_) {}
    }

    if (userGeminiKey) {
      try {
        const gemRes = await callUserGeminiRest({
          apiKey: userGeminiKey,
          model: aiModel,
          prompt: matchPrompt,
          temperature: 0.2,
          maxOutputTokens: 150,
          jsonMode: true,
        });
        if (gemRes.ok && gemRes.text) {
          const parsed = JSON.parse(gemRes.text.replace(/^```json/m, '').replace(/^```/m, '').trim());
          if (typeof parsed.bestIndex === 'number' && parsed.bestIndex >= 0 && parsed.bestIndex < variations.length) {
            res.json({ success: true, bestIndex: parsed.bestIndex, reason: parsed.reason || 'BYOK Gemini match' });
            return;
          }
        }
      } catch (_) {}
    }

    // Zero-cost keyword overlap fallback when no BYOK key is supplied
    const combinedThread = `${threadTitle} ${threadBody}`.toLowerCase();
    let bestScore = -1;
    let bestIdx = 0;
    variations.forEach((v: string, idx: number) => {
      const words = (v || '').toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      let score = 0;
      words.forEach((w) => {
        if (combinedThread.includes(w)) score++;
      });
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });
    res.json({ success: true, bestIndex: bestIdx, reason: 'Keyword overlap alignment' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Context match error' });
  }
});

// Phase 2: Instant Thread-Context Adaptation & 12-Suggestion Matrix (Pure BYOK AI)
app.post('/api/ai/thread-suggestions', optionalVerifiedAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const {
      threadTitle = '',
      threadBody = '',
      threadContext = null,
      platform = 'twitter',
      brand = {},
      campaign = {},
      openRouterKey = '',
      geminiApiKey = '',
      aiModel = '',
      count = 6,
    } = req.body || {};

    const userByokKey = String(openRouterKey || '').trim();
    const userGeminiKey = String(geminiApiKey || '').trim();

    if (!userByokKey && !userGeminiKey) {
      return res.status(401).json({
        success: false,
        needsApiKey: true,
        error: 'Add your OpenRouter or Google Gemini API key in Settings to generate AI Auto Comments.',
      });
    }

    const activeBrand = campaign && typeof campaign === 'object' && Object.keys(campaign).length > 0 ? campaign : brand;
    const targetCount = Math.max(3, Math.min(8, Number(count) || 6));

    const templates = await loadPromptTemplates().catch(() => []);
    const organicTpl = Array.isArray(templates) ? templates.find((t: any) => t.id === 'organic') : null;
    const trojanTpl = Array.isArray(templates) ? templates.find((t: any) => t.id === 'trojan') : null;

    const { systemPrompt, userPrompt } = buildThreadSuggestionsPrompts({
      platform,
      threadTitle,
      threadBody,
      threadContext,
      brand: activeBrand,
      organicGuidelines: organicTpl?.system_instruction || '',
      trojanGuidelines: trojanTpl?.system_instruction || '',
      count: targetCount,
    });

    const configuredModel = String(aiModel || '').trim();
    const effectiveOrModel = configuredModel || 'deepseek/deepseek-chat';
    let parsedSuggestions: ReturnType<typeof parseThreadSuggestionsResponse> = null;
    let responseSource = '';
    let responseModel = effectiveOrModel;
    let lastProviderStatus = 0;
    let lastProviderError = '';

    // Priority 1: User BYOK OpenRouter
    if (userByokKey) {
      try {
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userByokKey}`,
          },
          body: JSON.stringify({
            model: effectiveOrModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.75,
            max_tokens: 1800,
          }),
        });

        if (orRes.ok) {
          const orData: any = await orRes.json();
          const content = String(orData.choices?.[0]?.message?.content || '').trim();
          parsedSuggestions = parseThreadSuggestionsResponse(content, targetCount);
          if (parsedSuggestions) {
            responseSource = 'openrouter';
          }
        } else {
          lastProviderStatus = orRes.status;
          const errText = await orRes.text().catch(() => '');
          lastProviderError = `OpenRouter returned HTTP ${orRes.status}`;
          try {
            const parsedErr = JSON.parse(errText);
            if (parsedErr?.error?.message) lastProviderError = parsedErr.error.message;
          } catch {
            if (errText) lastProviderError = errText.slice(0, 220);
          }
        }
      } catch (orErr: any) {
        lastProviderError = orErr?.message || 'OpenRouter request failed';
        console.warn('OpenRouter thread suggestions failed:', lastProviderError);
      }
    }

    // Priority 2: User BYOK Google Gemini
    if (!parsedSuggestions && userGeminiKey) {
      try {
        const gemRes = await callUserGeminiRest({
          apiKey: userGeminiKey,
          model: configuredModel,
          systemInstruction: systemPrompt,
          prompt: userPrompt,
          temperature: 0.75,
          maxOutputTokens: 2048,
          jsonMode: true,
        });
        if (gemRes.ok && gemRes.text) {
          parsedSuggestions = parseThreadSuggestionsResponse(gemRes.text, targetCount);
          if (parsedSuggestions) {
            responseSource = 'gemini-byok';
            responseModel = gemRes.model;
          }
        } else {
          lastProviderStatus = gemRes.status || lastProviderStatus;
          lastProviderError = gemRes.error || lastProviderError;
        }
      } catch (geminiErr: any) {
        lastProviderError = geminiErr?.message || lastProviderError;
        console.warn('Gemini BYOK thread suggestions failed:', lastProviderError);
      }
    }

    if (!parsedSuggestions) {
      if (lastProviderStatus) {
        return res.status(lastProviderStatus).json({
          success: false,
          needsApiKey: lastProviderStatus === 401 || lastProviderStatus === 403,
          error: lastProviderError || 'AI generation failed.',
        });
      }
      return res.status(502).json({
        success: false,
        error: lastProviderError || 'AI could not generate valid replies for this thread. Please try again.',
      });
    }

    return res.json({
      success: true,
      suggestions: parsedSuggestions,
      model: responseModel,
      source: responseSource,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Thread suggestions error' });
  }
});

// ==============================================================================
// AI Marketer Assistant: Website Copy Scanner & Conversational Chat Endpoint
// ==============================================================================

interface ExtractedBrandProfile {
  name?: string;
  tagline?: string;
  shortPitch?: string;
  shortPitches?: string[];
  longPitch?: string;
  targetAudience?: string;
  pricingSummary?: string;
  pricingModel?: string;
  startingPrice?: string;
  founderStory?: string;
  ogCoverUrl?: string;
  logoUrl?: string;
  features?: Array<{ title: string; detail: string }>;
  benefits?: Array<{ title: string; detail: string }>;
  competitors?: Array<{ name: string; advantage: string; recommendWhen?: string }>;
  links?: {
    pricingUrl?: string;
    docsUrl?: string;
    bookingUrl?: string;
  };
  videos?: {
    demoUrl?: string;
    explainerUrl?: string;
    onboardingUrl?: string;
  };
  customLinks?: Array<{ name: string; url: string }>;
  handles?: {
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    github?: string;
    youtube?: string;
    productHunt?: string;
  };
  testimonials?: Array<{ quote: string; author: string }>;
}

interface ScannedPageContext {
  sourceType: 'tab' | 'url' | 'brand';
  url: string;
  domain: string;
  title: string;
  metaTitle?: string;
  metaDescription: string;
  description: string;
  heroHeadline?: string;
  heroText?: string;
  headings: string[];
  ctaTexts: string[];
  bodyCopy: string;
  copy: string;
  logoUrl?: string;
  ogCoverUrl?: string;
  faviconUrl?: string;
  twitter?: string;
  brandProfile?: ExtractedBrandProfile;
  platform?: string;
  scannedAt?: string;
}

function isPublicHttpUrl(rawUrl: string): URL | null {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return null;
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(normalized);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      !host ||
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host === '::' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^0\./.test(host) ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
      /^(fe80|fc00|fd00|::ffff:127\.|::ffff:10\.|::ffff:192\.168\.|::ffff:169\.254\.|::ffff:172\.(1[6-9]|2\d|3[0-1])\.)/i.test(host)
    ) {
      return null;
    }
    return u;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(input: string): string {
  return String(input || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) && code > 0 && code < 65535 ? String.fromCharCode(code) : ' ';
    });
}

function stripTagsAndNormalize(htmlFragment: string): string {
  return decodeHtmlEntities(String(htmlFragment || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMetaContent(html: string, names: string[]): string {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re1 = new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i');
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["']`, 'i');
    const m = html.match(re1) || html.match(re2);
    if (m && m[1]) {
      const cleaned = decodeHtmlEntities(m[1]).replace(/\s+/g, ' ').trim();
      if (cleaned) return cleaned;
    }
  }
  return '';
}

function resolveAbsoluteUrl(raw: string, baseOrigin: string): string {
  const cleaned = decodeHtmlEntities(String(raw || '').trim());
  if (!cleaned || cleaned.startsWith('#') || /^(?:javascript|mailto|tel|data):/i.test(cleaned)) return '';
  try {
    return new URL(cleaned, baseOrigin).href;
  } catch {
    return '';
  }
}

function extractFaviconUrlFromHtml(html: string, urlObj: URL): string {
  const m =
    html.match(/<link[^>]+rel=["'][^"']*(?:shortcut\s+icon|icon|apple-touch-icon)[^"']*["'][^>]+href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*(?:shortcut\s+icon|icon|apple-touch-icon)[^"']*["']/i);
  if (m && m[1]) {
    const resolved = resolveAbsoluteUrl(m[1], urlObj.origin);
    if (resolved) return resolved;
  }
  return `${urlObj.origin}/favicon.ico`;
}

function extractRichBrandProfileFromHtml(
  safeHtml: string,
  urlObj: URL,
  base: {
    siteName: string;
    title: string;
    metaTitle: string;
    metaDescription: string;
    heroHeadline: string;
    heroText: string;
    headings: string[];
    bodyCopy: string;
    ogCoverUrl: string;
    twitter: string;
  }
): ExtractedBrandProfile {
  const handles: NonNullable<ExtractedBrandProfile['handles']> = {};
  if (base.twitter) handles.twitter = base.twitter.replace(/^@/, '');

  const links: NonNullable<ExtractedBrandProfile['links']> = {};
  const videos: NonNullable<ExtractedBrandProfile['videos']> = {};
  const customLinks: Array<{ name: string; url: string }> = [];
  const seenCustomUrls = new Set<string>();
  const videoCandidates: Array<{ url: string; kind: 'demo' | 'explainer' | 'onboarding' | 'any' }> = [];
  const pushVideo = (url: string, label = '') => {
    if (!url || videoCandidates.some(v => v.url === url)) return;
    const low = `${url} ${label}`.toLowerCase();
    const kind = /onboard|getting.?started|setup|tutorial|walkthrough/.test(low)
      ? 'onboarding'
      : /explain|overview|intro|how.?it.?works/.test(low)
        ? 'explainer'
        : /demo|watch|preview/.test(low)
          ? 'demo'
          : 'any';
    videoCandidates.push({ url, kind });
  };

  // 1. Parse JSON-LD structured data
  let ldName = '';
  let ldDesc = '';
  let ldTagline = '';
  let ldLogo = '';
  let ldAudience = '';
  let ldPrice = '';
  const ldFeatureStrings: string[] = [];
  const ldScriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ldm: RegExpExecArray | null;
  const flattenLd = (node: any): any[] => {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(flattenLd);
    if (Array.isArray(node['@graph'])) return [node, ...flattenLd(node['@graph'])];
    return [node];
  };
  const sameAsUrls: string[] = [];
  while ((ldm = ldScriptRe.exec(safeHtml)) !== null) {
    try {
      const parsed = JSON.parse(ldm[1].trim());
      for (const item of flattenLd(parsed)) {
        const typ = String(item?.['@type'] || '').toLowerCase();
        if (!ldName && item?.name && typeof item.name === 'string' && !/breadcrumb|webpage|list/i.test(typ)) {
          ldName = item.name.trim();
        }
        if (!ldDesc && item?.description && typeof item.description === 'string') {
          ldDesc = item.description.trim();
        }
        if (!ldTagline && item?.slogan && typeof item.slogan === 'string') {
          ldTagline = item.slogan.trim();
        }
        const logoCandidate = typeof item?.logo === 'string' ? item.logo : (item?.logo?.url || '');
        if (!ldLogo && logoCandidate) {
          ldLogo = resolveAbsoluteUrl(logoCandidate, urlObj.origin) || logoCandidate;
        }
        if (!ldAudience && item?.audience) {
          ldAudience = typeof item.audience === 'string'
            ? item.audience
            : (item.audience.audienceType || item.audience.name || '');
        }
        if (item?.offers) {
          const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
          for (const off of offers) {
            if (off?.price !== undefined && off?.price !== '') {
              const cur = off.priceCurrency === 'USD' || !off.priceCurrency ? '$' : `${off.priceCurrency} `;
              const pr = Number(off.price) === 0 ? 'Free' : `${cur}${off.price}`;
              if (!ldPrice) ldPrice = pr;
            }
          }
        }
        if (Array.isArray(item?.featureList)) {
          for (const f of item.featureList) {
            if (typeof f === 'string' && f.trim()) ldFeatureStrings.push(f.trim());
          }
        }
        if (Array.isArray(item?.sameAs)) {
          for (const u of item.sameAs) {
            if (typeof u === 'string') sameAsUrls.push(u.trim());
          }
        } else if (typeof item?.sameAs === 'string') {
          sameAsUrls.push(item.sameAs.trim());
        }
      }
    } catch {}
  }

  // 2. Classify social handles, key URLs, videos & custom links across full HTML (including nav & footer)
  const classifyHref = (rawHref: string, labelText = '') => {
    const abs = resolveAbsoluteUrl(rawHref, urlObj.origin);
    if (!abs) return;
    let u: URL;
    try {
      u = new URL(abs);
    } catch {
      return;
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/+$/, '');
    const lowLabel = labelText.toLowerCase();

    if ((host === 'twitter.com' || host === 'x.com') && path && !/^\/(?:intent|share|home|search|hashtag|i|explore)\b/i.test(path)) {
      const h = path.split('/').filter(Boolean)[0];
      if (h && !handles.twitter) handles.twitter = h.replace(/^@/, '');
      return;
    }
    if (host === 'instagram.com' && path && !/^\/(?:p|reel|stories|explore|accounts)\b/i.test(path)) {
      const h = path.split('/').filter(Boolean)[0];
      if (h && !handles.instagram) handles.instagram = h.replace(/^@/, '');
      return;
    }
    if (host.endsWith('linkedin.com') && /^\/(?:company|in|showcase)\//i.test(path)) {
      if (!handles.linkedin) handles.linkedin = path.slice(1);
      return;
    }
    if (host === 'github.com' && path && !/^\/(?:features|pricing|sponsors|topics|explore|login|signup|settings)\b/i.test(path)) {
      const segs = path.split('/').filter(Boolean).slice(0, 2);
      if (segs.length && !handles.github) handles.github = segs.join('/');
      return;
    }
    if ((host === 'youtube.com' || host === 'm.youtube.com') && /^\/(?:@|c\/|channel\/|user\/)/i.test(path)) {
      if (!handles.youtube) handles.youtube = path.replace(/^\/@?/, '@').replace(/^@@/, '@');
      return;
    }
    if (host === 'producthunt.com' && path) {
      if (!handles.productHunt && (/^\/(?:posts|products)\//i.test(path) || path.startsWith('/@'))) {
        handles.productHunt = path.slice(1);
      }
      return;
    }

    if (
      host === 'youtube.com' ||
      host === 'youtu.be' ||
      host.includes('loom.com') ||
      host.includes('vimeo.com') ||
      /\.(?:mp4|webm)(?:\?|$)/i.test(abs)
    ) {
      pushVideo(abs, labelText);
      return;
    }

    if (
      /cal\.com|calendly\.com|tidycal\.com|savvycal\.com|meetings\.hubspot\.com/i.test(host) ||
      (/book|schedule|demo.?call/i.test(`${path} ${lowLabel}`) && /demo|call|meeting|consult/i.test(lowLabel))
    ) {
      if (!links.bookingUrl) links.bookingUrl = abs;
      return;
    }

    const baseHost = urlObj.hostname.toLowerCase().replace(/^www\./, '');
    const isSameSite = host === baseHost || host.endsWith(`.${baseHost}`);
    if (isSameSite || /docs\.|help\.|blog\.|status\.|chromewebstore\.google\.com|chrome\.google\.com\/webstore|apps\.apple\.com|play\.google\.com/i.test(host + abs)) {
      if (!links.pricingUrl && (/\/(?:pricing|plans|plan)(?:\/|$)/i.test(path) || /^pricing(?:\s|$)/i.test(lowLabel))) {
        links.pricingUrl = abs;
        return;
      }
      if (!links.docsUrl && (/\/(?:docs|documentation|changelog|guides|api|help|kb)(?:\/|$)/i.test(path) || /^(?:docs|documentation|changelog|guides|api)$/i.test(lowLabel) || /^docs\./i.test(host))) {
        links.docsUrl = abs;
        return;
      }
      const normKey = `${u.origin}${path}`;
      const rootKey = `${urlObj.origin}`;
      if (
        normKey !== rootKey &&
        normKey !== `${rootKey}/` &&
        !seenCustomUrls.has(normKey) &&
        customLinks.length < 8 &&
        !/\/(?:login|signin|sign-in|signup|sign-up|register|auth|cart|checkout|logout|cdn-cgi)\b/i.test(path)
      ) {
        let niceName = labelText.replace(/\s+/g, ' ').trim();
        if (!niceName || niceName.length < 2 || niceName.length > 36) {
          const seg = path.split('/').filter(Boolean).pop() || '';
          niceName = seg ? seg.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
        }
        if (niceName && niceName.length >= 2 && niceName.length <= 36) {
          seenCustomUrls.add(normKey);
          customLinks.push({ name: niceName, url: abs });
        }
      }
    }
  };

  for (const sUrl of sameAsUrls) classifyHref(sUrl, '');

  const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let am: RegExpExecArray | null;
  while ((am = anchorRe.exec(safeHtml)) !== null) {
    classifyHref(am[1], stripTagsAndNormalize(am[2]));
  }

  // Video embeds (<iframe src>, <video src>, <source src>)
  const embedRe = /<(?:iframe|video|source)\b[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let em: RegExpExecArray | null;
  while ((em = embedRe.exec(safeHtml)) !== null) {
    const abs = resolveAbsoluteUrl(em[1], urlObj.origin);
    if (abs && (/youtube\.com|youtu\.be|loom\.com|vimeo\.com|wistia|\.(?:mp4|webm)(?:\?|$)/i.test(abs))) {
      pushVideo(abs, em[0]);
    }
  }
  for (const v of videoCandidates) {
    if (v.kind === 'demo' && !videos.demoUrl) videos.demoUrl = v.url;
    else if (v.kind === 'explainer' && !videos.explainerUrl) videos.explainerUrl = v.url;
    else if (v.kind === 'onboarding' && !videos.onboardingUrl) videos.onboardingUrl = v.url;
  }
  for (const v of videoCandidates) {
    if (!videos.demoUrl) videos.demoUrl = v.url;
    else if (!videos.explainerUrl && v.url !== videos.demoUrl) videos.explainerUrl = v.url;
    else if (!videos.onboardingUrl && v.url !== videos.demoUrl && v.url !== videos.explainerUrl) videos.onboardingUrl = v.url;
  }

  // Dedicated logo <img> scan (distinct from og:image cover)
  let detectedLogoImg = ldLogo;
  if (!detectedLogoImg) {
    const imgRe = /<img\b([^>]*)>/gi;
    let im: RegExpExecArray | null;
    while ((im = imgRe.exec(safeHtml)) !== null) {
      const attrs = im[1];
      const srcM = attrs.match(/src=["']([^"']+)["']/i);
      if (!srcM || !srcM[1]) continue;
      if (/(?:logo|brand|wordmark)/i.test(attrs)) {
        const resolved = resolveAbsoluteUrl(srcM[1], urlObj.origin);
        if (resolved && !/1x1|pixel|spacer|tracking/i.test(resolved)) {
          detectedLogoImg = resolved;
          break;
        }
      }
    }
  }

  // 3. Clean HTML for section / copy extraction
  const bodyHtml = safeHtml
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');

  const strippedMain = bodyHtml
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');

  const paragraphs: string[] = [];
  const seenParas = new Set<string>();
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pRe.exec(strippedMain)) !== null && paragraphs.length < 30) {
    const t = stripTagsAndNormalize(pm[1]);
    if (t && t.length >= 25 && t.length <= 500 && !seenParas.has(t.toLowerCase())) {
      seenParas.add(t.toLowerCase());
      paragraphs.push(t);
    }
  }

  const resolvedName = (ldName || base.siteName || (base.title || '').split(/[-|—]/)[0] || '').trim().slice(0, 80);
  let tagline = ldTagline || '';
  if (!tagline && (base.title.includes('|') || base.title.includes('—') || base.title.includes(' - '))) {
    const part = base.title.split(/\s*[|—]\s*|\s+-\s+/).slice(1).join(' — ').trim();
    if (part && part.length >= 4 && part.toLowerCase() !== resolvedName.toLowerCase()) tagline = part;
  }
  if (!tagline && base.heroHeadline && base.heroHeadline.toLowerCase() !== resolvedName.toLowerCase()) {
    tagline = base.heroHeadline;
  }
  if (!tagline && base.metaDescription) {
    tagline = base.metaDescription.split(/[.!?]/)[0].trim();
  }
  tagline = tagline.slice(0, 100);

  const fitShortPitch140 = (raw: string): string => {
    const s = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    if (s.length <= 140) return s;
    const sentences = s.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
    if (sentences[0] && sentences[0].length >= 45 && sentences[0].length <= 140) {
      return sentences[0];
    }
    const sliced = s.slice(0, 140);
    const lastSpace = sliced.lastIndexOf(' ');
    return (lastSpace > 75 ? sliced.slice(0, lastSpace) : sliced)
      .replace(/[,;:\-–—&+]+$/, '')
      .trim();
  };

  const shortPitchCandidates = [
    base.metaDescription,
    ldDesc,
    paragraphs.find(p => p.length >= 45 && p.length <= 220) || '',
    base.heroHeadline && base.heroText && base.heroText !== base.heroHeadline ? base.heroText : '',
    ...paragraphs.slice(0, 4),
    tagline && resolvedName ? `${resolvedName}: ${tagline}` : ''
  ];
  const shortPitches: string[] = [];
  const seenShortPrefixes = new Set<string>();
  for (const cand of shortPitchCandidates) {
    const fitted = fitShortPitch140(cand || '');
    if (!fitted || fitted.length < 25) continue;
    const key = fitted.toLowerCase().slice(0, 45);
    if (seenShortPrefixes.has(key) || shortPitches.some(x => x.toLowerCase() === fitted.toLowerCase())) continue;
    seenShortPrefixes.add(key);
    shortPitches.push(fitted);
    if (shortPitches.length >= 3) break;
  }
  const shortPitch = shortPitches[0] || '';

  // Target audience extraction
  let targetAudience = ldAudience.trim();
  if (!targetAudience) {
    const audSource = [base.metaDescription, base.heroText, ...paragraphs, ...base.headings].join(' . ');
    const audMatch = audSource.match(/\b(?:built for|designed for|made for|ideal for|perfect for|for)\s+((?:[a-z0-9,&\-\/]+\s+){1,10}(?:founders?|makers?|creators?|teams?|agencies?|marketers?|developers?|engineers?|designers?|startups?|businesses?|companies|freelancers?|solopreneurs?|educators?|students?|recruiters?|writers?|podcasters?|stores?|brands?|saas|builders?))/i);
    if (audMatch && audMatch[1]) {
      targetAudience = audMatch[1].trim().replace(/[.,;:]+$/, '');
    }
  }
  targetAudience = targetAudience.slice(0, 220);

  // Pricing summary extraction
  const priceTokens: string[] = [];
  const fullText = `${base.bodyCopy} ${stripTagsAndNormalize(bodyHtml)}`;
  if (/\bfree\s+(?:forever|plan|tier|starter|trial)\b|\$0\b/i.test(fullText)) {
    priceTokens.push('Free plan available');
  }
  const tierPriceRe = /(?:([A-Za-z][A-Za-z0-9+ ]{1,16})\s*[:\-–]?\s*)?(\$\s?\d{1,4}(?:\.\d{1,2})?(?:\s*\/\s*(?:mo|month|yr|year|user|seat|one[- ]time|lifetime))?)/gi;
  let tpm: RegExpExecArray | null;
  const seenPrices = new Set<string>();
  while ((tpm = tierPriceRe.exec(fullText)) !== null && priceTokens.length < 4) {
    const priceStr = tpm[2].replace(/\s+/g, '');
    if (priceStr === '$0' || seenPrices.has(priceStr)) continue;
    seenPrices.add(priceStr);
    const tierLabel = tpm[1] ? tpm[1].trim() : '';
    const skipWords = /^(?:save|only|just|from|for|to|at|or|and|with|under|over|about|up|per|get)$/i;
    priceTokens.push(tierLabel && !skipWords.test(tierLabel) ? `${tierLabel} ${priceStr}` : priceStr);
  }
  if (!priceTokens.length && ldPrice) priceTokens.push(ldPrice);
  const pricingSummary = priceTokens.join(', ').slice(0, 180);
  const startingPrice = ldPrice || (Array.from(seenPrices)[0] || '');
  const pricingModel = /\bfree\s+forever\b/i.test(fullText) && seenPrices.size === 0
    ? 'Free'
    : /\bfree\b/i.test(fullText) && seenPrices.size > 0
      ? 'Freemium'
      : /one[- ]time|lifetime/i.test(fullText)
        ? 'One-time'
        : seenPrices.size > 0
          ? 'Subscription'
          : '';

  // Founder story extraction
  let founderStory = '';
  const storyHeadingRe = /<h[2-4][^>]*>[^<]*(?:our story|founder|why we built|about us|the mission|why i built|origin)[^<]*<\/h[2-4]>[\s\S]{0,600}?<p[^>]*>([\s\S]*?)<\/p>/i;
  const storyM = strippedMain.match(storyHeadingRe);
  if (storyM && storyM[1]) {
    founderStory = stripTagsAndNormalize(storyM[1]).slice(0, 400);
  } else {
    const storyPara = paragraphs.find(p => /\b(?:i built|we built|we started|our mission|frustrated with|started this|founded)\b/i.test(p));
    if (storyPara) founderStory = storyPara.slice(0, 400);
  }

  // Features & Benefits card/list extraction
  const features: Array<{ title: string; detail: string }> = [];
  const benefits: Array<{ title: string; detail: string }> = [];
  const seenFeatTitles = new Set<string>();

  for (const lf of ldFeatureStrings) {
    if (features.length >= 6) break;
    const parts = lf.split(/:\s+|\s+-\s+/);
    const t = parts[0].trim().slice(0, 80);
    if (t && !seenFeatTitles.has(t.toLowerCase())) {
      seenFeatTitles.add(t.toLowerCase());
      features.push({ title: t, detail: parts.slice(1).join(' - ').trim().slice(0, 220) });
    }
  }

  const cardPairRe = /<(h[34]|strong|b)[^>]*>([\s\S]{3,100}?)<\/\1>(?:\s|<[^>]{0,80}>){0,4}<p[^>]*>([\s\S]{15,320}?)<\/p>/gi;
  let cpm: RegExpExecArray | null;
  while ((cpm = cardPairRe.exec(strippedMain)) !== null && (features.length < 6 || benefits.length < 5)) {
    const title = stripTagsAndNormalize(cpm[2]);
    const detail = stripTagsAndNormalize(cpm[3]);
    if (!title || title.length < 3 || title.length > 75 || !detail || detail.length < 15) continue;
    if (/cookie|privacy|copyright|subscribe|sign up|log in/i.test(`${title} ${detail}`)) continue;
    const low = `${title} ${detail}`.toLowerCase();
    if (seenFeatTitles.has(title.toLowerCase())) continue;
    seenFeatTitles.add(title.toLowerCase());
    if (/\b(?:save|faster|hours|boost|increase|reduce|never miss|peace of mind|roi|revenue|effortless|without)\b/i.test(low) && benefits.length < 5) {
      benefits.push({ title: title.slice(0, 80), detail: detail.slice(0, 220) });
    } else if (features.length < 6) {
      features.push({ title: title.slice(0, 80), detail: detail.slice(0, 220) });
    }
  }

  if (features.length < 4) {
    const liRe = /<li[^>]*>([\s\S]{10,240}?)<\/li>/gi;
    let lim: RegExpExecArray | null;
    while ((lim = liRe.exec(strippedMain)) !== null && features.length < 6) {
      const txt = stripTagsAndNormalize(lim[1]);
      if (!txt || txt.length < 12 || txt.length > 180) continue;
      if (/^(?:home|pricing|docs|blog|login|sign in|about|privacy|terms|contact)$/i.test(txt)) continue;
      const splitM = txt.match(/^([^:—\-]{3,55})\s*[:—\-]\s*(.+)$/);
      const fTitle = (splitM ? splitM[1] : txt.split(' ').slice(0, 5).join(' ')).trim();
      const fDetail = (splitM ? splitM[2] : txt).trim();
      if (fTitle && !seenFeatTitles.has(fTitle.toLowerCase())) {
        seenFeatTitles.add(fTitle.toLowerCase());
        features.push({ title: fTitle.slice(0, 80), detail: fDetail.slice(0, 220) });
      }
    }
  }

  // Competitors extraction
  const competitors: Array<{ name: string; advantage: string; recommendWhen?: string }> = [];
  const vsRe = /\b(?:alternative to|better than|compared to|instead of|vs\.?)\s+([A-Z][A-Za-z0-9.+ ]{1,28})/g;
  let vm: RegExpExecArray | null;
  const seenComps = new Set<string>();
  while ((vm = vsRe.exec(fullText)) !== null && competitors.length < 4) {
    const name = vm[1].trim().replace(/[.,;:!?]+$/, '');
    if (name && name.toLowerCase() !== resolvedName.toLowerCase() && !seenComps.has(name.toLowerCase())) {
      seenComps.add(name.toLowerCase());
      const snippet = fullText.slice(Math.max(0, vm.index - 20), vm.index + 160).trim();
      competitors.push({ name, advantage: snippet, recommendWhen: '' });
    }
  }

  // Testimonials extraction
  const testimonials: Array<{ quote: string; author: string }> = [];
  const bqRe = /<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi;
  let bm: RegExpExecArray | null;
  while ((bm = bqRe.exec(strippedMain)) !== null && testimonials.length < 3) {
    const txt = stripTagsAndNormalize(bm[1]);
    if (txt.length >= 20 && txt.length <= 320) {
      const splitA = txt.match(/^["“]?([\s\S]+?)["”]?\s*(?:—|--|-)\s*([^—]{2,60})$/);
      testimonials.push({
        quote: (splitA ? splitA[1] : txt).replace(/^["“]|["”]$/g, '').trim(),
        author: splitA ? splitA[2].trim() : ''
      });
    }
  }

  // Long Pitch: 150-200 word summarized landing sales pitch with bullet points in original tone & language
  const countWords = (s: string): number => String(s || '').replace(/•/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const trimToMaxWords = (s: string, maxW: number): string => {
    const words = String(s || '').trim().split(/\s+/).filter(Boolean);
    if (words.length <= maxW) return words.join(' ');
    const clipped = words.slice(0, maxW).join(' ').replace(/[,;:\-–—]+$/, '');
    return /[.!?]$/.test(clipped) ? clipped : `${clipped}.`;
  };
  const ensureSentence = (s: string): string => {
    const t = String(s || '').trim();
    if (!t) return '';
    return /[.!?]$/.test(t) ? t : `${t}.`;
  };
  const leadParts: string[] = [];
  if (base.heroHeadline && base.heroHeadline.toLowerCase() !== resolvedName.toLowerCase()) leadParts.push(ensureSentence(base.heroHeadline));
  const mainLeadPara = ldDesc || base.metaDescription || paragraphs[0] || '';
  if (mainLeadPara && !leadParts.some(x => x.toLowerCase().includes(mainLeadPara.toLowerCase().slice(0, 30)))) {
    leadParts.push(ensureSentence(mainLeadPara));
  }
  const secondLeadPara = paragraphs.find(p => p && p.toLowerCase() !== mainLeadPara.toLowerCase() && p.length >= 45);
  if (secondLeadPara && countWords(leadParts.join(' ')) < 42) {
    leadParts.push(ensureSentence(secondLeadPara));
  }
  let introBlock = leadParts.join(' ').replace(/\s+/g, ' ').trim();
  if (countWords(introBlock) > 62) introBlock = trimToMaxWords(introBlock, 55);

  const bulletPool: string[] = [];
  const seenBullet = new Set<string>();
  const addBullet = (rawLine: string) => {
    const clean = String(rawLine || '').replace(/\s+/g, ' ').replace(/^[•\-*]\s*/, '').trim();
    if (!clean || countWords(clean) < 4) return;
    const low = clean.toLowerCase();
    const key = low.slice(0, 40);
    if (seenBullet.has(key) || (introBlock && introBlock.toLowerCase().includes(key))) return;
    if (bulletPool.some(ex => {
      const exLow = ex.toLowerCase();
      return exLow.includes(low.slice(0, 35)) || low.includes(exLow.replace(/^•\s*/, '').slice(0, 35));
    })) return;
    seenBullet.add(key);
    bulletPool.push(`• ${trimToMaxWords(clean, 26)}`);
  };
  for (const b of benefits) addBullet(b.detail ? `${b.title}: ${b.detail}` : b.title);
  for (const f of features) addBullet(f.detail ? `${f.title}: ${f.detail}` : f.title);
  for (const p of paragraphs) {
    if (bulletPool.length >= 10) break;
    addBullet(p);
  }
  for (const h of base.headings) {
    if (bulletPool.length >= 10) break;
    if (h.toLowerCase() !== resolvedName.toLowerCase() && h.toLowerCase() !== (base.heroHeadline || '').toLowerCase()) {
      addBullet(h);
    }
  }

  const chosenBullets: string[] = [];
  for (const bul of bulletPool) {
    const candidateStr = [introBlock, chosenBullets.concat(bul).join('\n')].filter(Boolean).join('\n\n');
    if (countWords(candidateStr) <= 192 || chosenBullets.length < 3) {
      chosenBullets.push(bul);
    }
    if (countWords(candidateStr) >= 165 && chosenBullets.length >= 4) break;
  }

  let longPitchSections = [introBlock, chosenBullets.join('\n')].filter(Boolean);
  let longPitch = longPitchSections.join('\n\n').trim();

  if (countWords(longPitch) < 150) {
    const extraSentences = paragraphs
      .filter(p => !longPitch.toLowerCase().includes(p.toLowerCase().slice(0, 35)))
      .slice(0, 4);
    for (const ep of extraSentences) {
      if (countWords(longPitch) >= 155) break;
      const room = 195 - countWords(longPitch);
      if (room < 10) break;
      const snippet = trimToMaxWords(ep, Math.min(room, 40));
      longPitch = `${longPitch}\n\n${snippet}`.trim();
    }
    if (countWords(longPitch) < 150 && base.bodyCopy) {
      const bodySents = base.bodyCopy.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length >= 30);
      const normLP = longPitch.toLowerCase().replace(/[:;,.!?•]+/g, ' ').replace(/\s+/g, ' ');
      const closingChunks: string[] = [];
      for (const s of bodySents) {
        const normS = s.toLowerCase().replace(/[:;,.!?•]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (normLP.includes(normS.slice(0, 30))) continue;
        const proj = countWords(`${longPitch}\n\n${closingChunks.concat(s).join(' ')}`);
        if (proj <= 196) closingChunks.push(s);
        if (proj >= 165) break;
      }
      if (closingChunks.length) longPitch = `${longPitch}\n\n${closingChunks.join(' ')}`.trim();
    }
  }

  if (countWords(longPitch) > 200) {
    while (chosenBullets.length > 3 && countWords([introBlock, chosenBullets.join('\n')].filter(Boolean).join('\n\n')) > 200) {
      chosenBullets.pop();
    }
    longPitch = [introBlock, chosenBullets.join('\n')].filter(Boolean).join('\n\n').trim();
    if (countWords(longPitch) > 200) {
      longPitch = longPitch
        .split('\n')
        .reduce((acc: string[], line: string) => {
          const cur = acc.join('\n');
          if (!line.trim()) { acc.push(line); return acc; }
          if (countWords(`${cur}\n${line}`) <= 200) { acc.push(line); return acc; }
          const rem = 200 - countWords(cur);
          if (rem >= 8) acc.push(trimToMaxWords(line, rem));
          return acc;
        }, [])
        .join('\n')
        .trim();
    }
  }
  if (!longPitch) longPitch = trimToMaxWords(base.bodyCopy, 195);

  return {
    name: resolvedName || undefined,
    tagline: tagline || undefined,
    shortPitch: shortPitch || undefined,
    shortPitches: shortPitches.length ? shortPitches : undefined,
    longPitch: longPitch || undefined,
    targetAudience: targetAudience || undefined,
    pricingSummary: pricingSummary || undefined,
    pricingModel: pricingModel || undefined,
    startingPrice: startingPrice || undefined,
    founderStory: founderStory || undefined,
    ogCoverUrl: base.ogCoverUrl || undefined,
    logoUrl: detectedLogoImg || base.ogCoverUrl || undefined,
    features: features.length ? features : undefined,
    benefits: benefits.length ? benefits : undefined,
    competitors: competitors.length ? competitors : undefined,
    links: Object.keys(links).length ? links : undefined,
    videos: Object.keys(videos).length ? videos : undefined,
    customLinks: customLinks.length ? customLinks : undefined,
    handles: Object.keys(handles).length ? handles : undefined,
    testimonials: testimonials.length ? testimonials : undefined,
  };
}

function extractWebsiteCopyFromHtml(html: string, urlObj: URL): ScannedPageContext {
  const safeHtml = String(html || '').slice(0, 400000);
  const titleMatch = safeHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const docTitle = stripTagsAndNormalize(titleMatch ? titleMatch[1] : '');
  const ogTitle = extractMetaContent(safeHtml, ['og:title', 'twitter:title']);
  const siteName = extractMetaContent(safeHtml, ['og:site_name', 'application-name']);
  const metaTitle = (docTitle || ogTitle || urlObj.hostname).slice(0, 240);
  const title = (ogTitle || docTitle || urlObj.hostname).slice(0, 240);
  const metaDescription = extractMetaContent(safeHtml, ['description', 'og:description', 'twitter:description']);
  const rawOgImage = extractMetaContent(safeHtml, ['og:image', 'twitter:image', 'og:image:url']);
  const ogCoverUrl = rawOgImage ? (resolveAbsoluteUrl(rawOgImage, urlObj.origin) || rawOgImage) : '';
  const twitter = extractMetaContent(safeHtml, ['twitter:site', 'twitter:creator']).replace(/^@/, '');
  const faviconUrl = extractFaviconUrlFromHtml(safeHtml, urlObj);

  const h1Match = safeHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1Text = stripTagsAndNormalize(h1Match ? h1Match[1] : '');

  const headings: string[] = [];
  const seenHeadings = new Set<string>();
  const headingRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = headingRegex.exec(safeHtml)) !== null && headings.length < 12) {
    const text = stripTagsAndNormalize(hm[1]);
    if (text && text.length >= 3 && text.length <= 220 && !seenHeadings.has(text.toLowerCase())) {
      seenHeadings.add(text.toLowerCase());
      headings.push(text);
    }
  }

  const strippedForBody = safeHtml
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');

  const heroSectionMatch =
    strippedForBody.match(/<(?:section|div|header)[^>]+(?:id|class)=["'][^"']*hero[^"']*["'][^>]*>([\s\S]*?)<\/(?:section|div|header)>/i) ||
    strippedForBody.match(/<main[^>]*>\s*<(?:section|div)[^>]*>([\s\S]*?)<\/(?:section|div)>/i) ||
    strippedForBody.match(/<section[^>]*>([\s\S]*?)<\/section>/i);

  const heroRaw = stripTagsAndNormalize(heroSectionMatch ? heroSectionMatch[1] : '');
  const heroHeadline = (h1Text || headings[0] || '').slice(0, 220);

  const ctaTexts: string[] = [];
  const seenCtas = new Set<string>();
  const ctaRegex = /<(?:button|a)\b[^>]*>([\s\S]*?)<\/(?:button|a)>/gi;
  let cm: RegExpExecArray | null;
  while ((cm = ctaRegex.exec(strippedForBody)) !== null && ctaTexts.length < 8) {
    const text = stripTagsAndNormalize(cm[1]);
    if (text && text.length >= 2 && text.length <= 60 && !seenCtas.has(text.toLowerCase())) {
      seenCtas.add(text.toLowerCase());
      ctaTexts.push(text);
    }
  }

  const mainMatch =
    strippedForBody.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
    strippedForBody.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
    strippedForBody.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  const rawCopy = stripTagsAndNormalize(mainMatch ? mainMatch[1] : strippedForBody);
  const bodyCopy = rawCopy.slice(0, 3500);
  const heroFallback = heroHeadline && !bodyCopy.toLowerCase().startsWith(heroHeadline.toLowerCase().slice(0, 24))
    ? `${heroHeadline}. ${bodyCopy.slice(0, 600)}`
    : bodyCopy.slice(0, 600);
  const heroText = (heroRaw && heroRaw.length >= 20 ? heroRaw : heroFallback).trim().slice(0, 900);
  const cleanTitle = title.slice(0, 240);
  const cleanDesc = metaDescription.slice(0, 500);

  const brandProfile = extractRichBrandProfileFromHtml(safeHtml, urlObj, {
    siteName,
    title: cleanTitle,
    metaTitle,
    metaDescription: cleanDesc,
    heroHeadline,
    heroText,
    headings,
    bodyCopy,
    ogCoverUrl,
    twitter,
  });

  const resolvedLogoUrl = brandProfile.logoUrl || ogCoverUrl || '';

  return {
    sourceType: 'url',
    url: urlObj.href,
    domain: urlObj.hostname.replace(/^www\./, ''),
    title: cleanTitle,
    metaTitle,
    metaDescription: cleanDesc,
    description: cleanDesc,
    heroHeadline,
    heroText,
    headings,
    ctaTexts,
    bodyCopy,
    copy: bodyCopy,
    logoUrl: resolvedLogoUrl || undefined,
    ogCoverUrl: ogCoverUrl || undefined,
    faviconUrl: faviconUrl || undefined,
    twitter: brandProfile.handles?.twitter || twitter || undefined,
    brandProfile,
    scannedAt: new Date().toISOString(),
  };
}

async function readHtmlWithByteCap(resp: globalThis.Response, maxBytes = 512 * 1024): Promise<string> {
  if (!resp.body || typeof resp.body.getReader !== 'function') {
    const full = await resp.text();
    return full.slice(0, maxBytes);
  }
  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (totalBytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      const remaining = maxBytes - totalBytes;
      const slice = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      chunks.push(slice);
      totalBytes += slice.byteLength;
      if (totalBytes >= maxBytes) break;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {}
  }
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(combined);
}

async function fetchWebsiteCopy(rawUrl: string): Promise<{ success: true; context: ScannedPageContext } | { success: false; url: string; error: string }> {
  const urlObj = isPublicHttpUrl(rawUrl);
  if (!urlObj) {
    return { success: false, url: String(rawUrl || ''), error: 'Invalid or non-public HTTP/HTTPS URL.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(urlObj.href, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timer);

    if (!resp.ok) {
      return { success: false, url: urlObj.href, error: `HTTP ${resp.status} while fetching website.` };
    }

    const contentType = (resp.headers.get('content-type') || '').toLowerCase();
    if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml') && !contentType.includes('text/plain')) {
      return { success: false, url: urlObj.href, error: `Unsupported content type: ${contentType}` };
    }

    const html = await readHtmlWithByteCap(resp, 512 * 1024);
    const context = extractWebsiteCopyFromHtml(html, urlObj);
    return { success: true, context };
  } catch (err: any) {
    clearTimeout(timer);
    return { success: false, url: urlObj.href, error: err?.name === 'AbortError' ? 'Website scan timed out.' : (err?.message || 'Failed to fetch website.') };
  }
}

function extractUrlsFromText(text: string): string[] {
  const input = String(text || '');
  const found: string[] = [];
  const seenDomains = new Set<string>();

  const pushCandidate = (candidate: string) => {
    const cleaned = candidate.replace(/[),.;:!?'"`]+$/g, '').trim();
    const parsed = isPublicHttpUrl(cleaned);
    if (!parsed) return;
    const key = `${parsed.hostname.replace(/^www\./, '').toLowerCase()}${parsed.pathname.replace(/\/+$/, '')}`;
    if (!seenDomains.has(key) && found.length < 2) {
      seenDomains.add(key);
      found.push(parsed.href);
    }
  };

  // 1. Explicit http/https URLs
  const fullUrlRe = /https?:\/\/[^\s<>"'`]+/gi;
  let m: RegExpExecArray | null;
  while ((m = fullUrlRe.exec(input)) !== null) {
    pushCandidate(m[0]);
  }

  // 2. Bare domains (skip email addresses like name@domain.com)
  const bareDomainRe = /(^|[\s(])((?:[a-z0-9-]+\.)+(?:com|io|co|ai|app|org|net|dev|xyz|so|me|us|uk|ca|de|fr|in|tech|pro|gg|club|store|shop|site|online|blog|info|biz)(?:\/[^\s<>"'`]*)?)/gi;
  while ((m = bareDomainRe.exec(input)) !== null) {
    const startIdx = m.index + (m[1] ? m[1].length : 0);
    if (startIdx > 0 && input[startIdx - 1] === '@') continue;
    pushCandidate(m[2]);
  }

  return found;
}

type CanonicalAssetModule =
  | 'email'
  | 'comment'
  | 'contact'
  | 'dm'
  | 'article'
  | 'social_post'
  | 'support_faq'
  | 'support_macro'
  | 'directory_tagline'
  | 'directory_pitch'
  | 'directory_summary'
  | 'directory_description'
  | 'vault';

function parseAssistantStructuredJson(rawContent: string): { reply: string; assets: any[] } {
  const raw = String(rawContent || '').trim();
  if (!raw) return { reply: '', assets: [] };

  const tryParse = (candidate: string) => {
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const reply = typeof obj.reply === 'string' ? obj.reply.trim() : '';
        const rawAssets = Array.isArray(obj.assets)
          ? obj.assets
          : (Array.isArray(obj.deliverables) ? obj.deliverables : []);
        if (reply || rawAssets.length > 0) {
          return { reply: reply || 'Here are the generated variations:', assets: rawAssets };
        }
      }
    } catch {
      return null;
    }
    return null;
  };

  const fenceStripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const direct = tryParse(fenceStripped);
  if (direct) return direct;

  const firstBrace = fenceStripped.indexOf('{');
  const lastBrace = fenceStripped.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const sliced = tryParse(fenceStripped.slice(firstBrace, lastBrace + 1));
    if (sliced) return sliced;
  }

  return { reply: raw, assets: [] };
}

function normalizeMarketerAssets(rawList: any[]): any[] {
  const validModules = new Set<CanonicalAssetModule>([
    'email',
    'comment',
    'contact',
    'dm',
    'article',
    'social_post',
    'support_faq',
    'support_macro',
    'directory_tagline',
    'directory_pitch',
    'directory_summary',
    'directory_description',
    'vault',
  ]);

  return (Array.isArray(rawList) ? rawList : [])
    .map((item, idx) => {
      if (!item || typeof item !== 'object') return null;
      const body = String(item.body || item.content || item.text || item.answer || '').trim();
      if (!body) return null;

      let modRaw = String(item.suggestedModule || item.module || 'comment').toLowerCase().trim();
      const targetFieldRaw = String(item.targetField || '').trim().toLowerCase();

      if (modRaw === 'contact_form' || modRaw === 'contact-form' || modRaw === 'outreach') {
        modRaw = 'contact';
      } else if (modRaw === 'comments') {
        modRaw = 'comment';
      } else if (modRaw === 'emails') {
        modRaw = 'email';
      } else if (modRaw === 'dms') {
        modRaw = 'dm';
      } else if (modRaw === 'articles' || modRaw === 'blog' || modRaw === 'blogs') {
        modRaw = 'article';
      } else if (modRaw === 'social' || modRaw === 'social-post' || modRaw === 'social_posts' || modRaw === 'socialposts') {
        modRaw = 'social_post';
      } else if (modRaw === 'faq' || modRaw === 'faqs' || modRaw === 'support-faq') {
        modRaw = 'support_faq';
      } else if (modRaw === 'support' || modRaw === 'macro' || modRaw === 'macros' || modRaw === 'support-macro') {
        modRaw = 'support_macro';
      } else if (modRaw === 'content_vault' || modRaw === 'content-vault' || modRaw === 'idea') {
        modRaw = 'vault';
      } else if (modRaw === 'directory' || modRaw === 'directories') {
        if (targetFieldRaw === 'tagline') modRaw = 'directory_tagline';
        else if (targetFieldRaw === 'pitch' || targetFieldRaw === 'elevatorpitch') modRaw = 'directory_pitch';
        else if (targetFieldRaw === 'shortsummary' || targetFieldRaw === 'summary' || targetFieldRaw === 'mediumsummary') modRaw = 'directory_summary';
        else if (targetFieldRaw === 'fulldescription' || targetFieldRaw === 'description' || targetFieldRaw === 'longdescription') modRaw = 'directory_description';
        else if (body.length <= 60) modRaw = 'directory_tagline';
        else if (body.length <= 140) modRaw = 'directory_pitch';
        else if (body.length <= 250) modRaw = 'directory_summary';
        else modRaw = 'directory_description';
      }

      const suggestedModule: CanonicalAssetModule = validModules.has(modRaw as CanonicalAssetModule)
        ? (modRaw as CanonicalAssetModule)
        : 'comment';

      const targetField = suggestedModule === 'directory_tagline'
        ? 'tagline'
        : suggestedModule === 'directory_pitch'
          ? 'pitch'
          : suggestedModule === 'directory_summary'
            ? 'shortSummary'
            : suggestedModule === 'directory_description'
              ? 'fullDescription'
              : undefined;

      return {
        id: String(item.id || `asset-${Date.now()}-${idx + 1}`),
        suggestedModule,
        label: String(item.label || `Option ${idx + 1}`).slice(0, 90),
        platform: item.platform ? String(item.platform).trim().slice(0, 40) : undefined,
        format: item.format ? String(item.format).trim().slice(0, 30) : undefined,
        hook: item.hook ? String(item.hook).trim().slice(0, 180) : undefined,
        subject: item.subject ? String(item.subject).trim().slice(0, 180) : undefined,
        title: (item.title || item.question) ? String(item.title || item.question).trim().slice(0, 180) : undefined,
        category: item.category ? String(item.category).trim().slice(0, 60) : undefined,
        targetField,
        body,
        content: body,
      };
    })
    .filter(Boolean);
}

const handleAnalyzeUrl = async (req: AuthedRequest, res: Response) => {
  try {
    const { url = '', openRouterKey = '', geminiApiKey = '' } = req.body || {};
    const userByokKey = String(openRouterKey || '').trim();
    const userGeminiKey = String(geminiApiKey || '').trim();
    if (!userByokKey && !userGeminiKey && !req.authUser) {
      return res.status(401).json({
        success: false,
        needsApiKey: true,
        error: 'Sign in or provide an AI BYOK key to analyze URLs.',
      });
    }

    const result = await fetchWebsiteCopy(String(url || ''));
    if (!result.success) {
      return res.status(400).json({ success: false, url: result.url, error: result.error });
    }
    return res.json({ success: true, site: result.context, context: result.context });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'URL scan failed' });
  }
};

app.post('/api/ai/analyze-url', optionalVerifiedAuth, handleAnalyzeUrl);
app.post('/api/ai/scan-url', optionalVerifiedAuth, handleAnalyzeUrl);

const handleMarketerChat = async (req: AuthedRequest, res: Response) => {
  try {
    const {
      messages = [],
      brandContext = null,
      brand = {},
      scannedSites = [],
      scannedContexts = [],
      activeTabContext = null,
      autoScanUrls = true,
      openRouterKey = '',
      geminiApiKey = '',
      aiModel = '',
      postingRulesSummary = '',
      mode = 'chat',
      refineType = '',
      missingAssetsAudit = null,
    } = req.body || {};

    const userByokKey = String(openRouterKey || '').trim();
    const userGeminiKey = String(geminiApiKey || '').trim();

    if (!userByokKey && !userGeminiKey) {
      return res.status(401).json({
        success: false,
        needsApiKey: true,
        error: 'OpenRouter or Google Gemini API key required. Please configure your AI API key in Settings.',
      });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one chat message is required.' });
    }

    const sanitizedMessages = messages
      .filter((m: any) => {
        if (!m || (m.role !== 'user' && m.role !== 'assistant')) return false;
        const hasText = typeof m.content === 'string' && m.content.trim().length > 0;
        const hasImgs = Array.isArray(m.images) && m.images.length > 0;
        return hasText || hasImgs;
      })
      .slice(-16)
      .map((m: any) => {
        const imgs = (Array.isArray(m.images) ? m.images : [])
          .slice(0, 4)
          .map((img: any) => {
            if (!img) return null;
            const rawUrl = String(typeof img === 'string' ? img : (img.dataUrl || img.url || '')).trim();
            if (!rawUrl) return null;
            if (!rawUrl.startsWith('data:image/') && !/^https?:\/\//i.test(rawUrl)) return null;
            return {
              url: rawUrl,
              mimeType: typeof img === 'object' && img.mimeType ? String(img.mimeType) : '',
              name: typeof img === 'object' && img.name ? String(img.name).slice(0, 80) : '',
            };
          })
          .filter(Boolean) as Array<{ url: string; mimeType: string; name: string }>;
        return {
          role: m.role as 'user' | 'assistant',
          content: String(m.content || '').trim().slice(0, 12000),
          images: imgs,
        };
      });

    if (sanitizedMessages.length === 0) {
      return res.status(400).json({ success: false, error: 'Message content cannot be empty.' });
    }

    // Collect scanned site contexts (active tab + scannedSites/scannedContexts + auto-detected URLs from latest user message)
    const mergedContexts: ScannedPageContext[] = [];
    const seenContextDomains = new Set<string>();
    const addContext = (ctx: any) => {
      if (!ctx || typeof ctx !== 'object') return;
      const urlStr = String(ctx.url || '').trim();
      const domainStr = String(ctx.domain || '').trim() || (urlStr ? urlStr.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0] : '');
      const descStr = String(ctx.metaDescription || ctx.description || '').slice(0, 500);
      const bodyStr = String(ctx.bodyCopy || ctx.copy || '').slice(0, 3500);
      const key = `${domainStr.toLowerCase()}|${urlStr.toLowerCase()}`;
      if (!domainStr && !bodyStr && !ctx.title) return;
      if (seenContextDomains.has(key)) return;
      seenContextDomains.add(key);
      mergedContexts.push({
        sourceType: ctx.sourceType === 'tab' ? 'tab' : (ctx.sourceType === 'brand' ? 'brand' : 'url'),
        url: urlStr,
        domain: domainStr,
        title: String(ctx.title || '').slice(0, 240),
        metaDescription: descStr,
        description: descStr,
        headings: Array.isArray(ctx.headings) ? ctx.headings.slice(0, 12).map((h: any) => String(h).slice(0, 180)) : [],
        ctaTexts: Array.isArray(ctx.ctaTexts) ? ctx.ctaTexts.slice(0, 8).map((c: any) => String(c).slice(0, 80)) : [],
        bodyCopy: bodyStr,
        copy: bodyStr,
        platform: ctx.platform ? String(ctx.platform) : undefined,
        scannedAt: ctx.scannedAt ? String(ctx.scannedAt) : undefined,
      });
    };

    if (activeTabContext) addContext({ ...activeTabContext, sourceType: 'tab' });
    if (Array.isArray(scannedSites)) scannedSites.forEach(addContext);
    if (Array.isArray(scannedContexts)) scannedContexts.forEach(addContext);

    const activeBrand = (brandContext && typeof brandContext === 'object' && Object.keys(brandContext).length > 0)
      ? brandContext
      : (brand && typeof brand === 'object' ? brand : {});

    const brandName = String(activeBrand?.name || activeBrand?.brandName || '').trim();
    const brandUrl = String(activeBrand?.url || activeBrand?.website || activeBrand?.websiteUrl || '').trim();
    const brandTagline = String(activeBrand?.tagline || '').trim();
    const brandDesc = String(activeBrand?.description || activeBrand?.longPitch || activeBrand?.brandAssets?.longPitch || activeBrand?.pitch || '').trim();
    const brandCategory = String(activeBrand?.category || '').trim();
    const brandPricing = String(activeBrand?.pricingSummary || activeBrand?.brandAssets?.pricingSummary || activeBrand?.pricing || activeBrand?.pricingModel || '').trim();
    const brandPersona = String(activeBrand?.senderName || activeBrand?.persona || activeBrand?.authorName || '').trim();

    const newlyScannedSources: ScannedPageContext[] = [];
    if (autoScanUrls !== false) {
      const lastUserMsg = [...sanitizedMessages].reverse().find((m) => m.role === 'user');
      if (lastUserMsg) {
        const candidateUrls = extractUrlsFromText(lastUserMsg.content);
        for (const candidate of candidateUrls) {
          const parsed = isPublicHttpUrl(candidate);
          if (!parsed) continue;
          const domainKey = parsed.hostname.replace(/^www\./, '').toLowerCase();
          const alreadyScanned = mergedContexts.some((c) => c.domain.toLowerCase() === domainKey || c.url.toLowerCase() === parsed.href.toLowerCase());
          if (!alreadyScanned) {
            const scanRes = await fetchWebsiteCopy(parsed.href);
            if (scanRes.success) {
              addContext(scanRes.context);
              newlyScannedSources.push(scanRes.context);
            }
          }
        }
      }
      // Tier-2 Tone Cascade: If brandUrl is public and not yet in mergedContexts when brand assets are sparse, scan brandUrl
      if (brandUrl) {
        const parsedBrandUrl = isPublicHttpUrl(brandUrl);
        if (parsedBrandUrl) {
          const bDomain = parsedBrandUrl.hostname.replace(/^www\./, '').toLowerCase();
          const hasBrandSiteCtx = mergedContexts.some((c) => c.domain.toLowerCase() === bDomain || c.url.toLowerCase() === parsedBrandUrl.href.toLowerCase());
          const hasRichBrandCopy = Boolean(brandDesc.length > 140 || (Array.isArray(activeBrand?.comments) && activeBrand.comments.length > 0) || (Array.isArray(activeBrand?.emails) && activeBrand.emails.length > 0));
          if (!hasBrandSiteCtx && !hasRichBrandCopy) {
            const brandScan = await fetchWebsiteCopy(parsedBrandUrl.href).catch(() => null);
            if (brandScan && brandScan.success && brandScan.context) {
              addContext({ ...brandScan.context, sourceType: 'brand' });
              newlyScannedSources.push({ ...brandScan.context, sourceType: 'brand' });
            }
          }
        }
      }
    }

    const fullBrandBlock = buildFullBrandContextBlock({
      ...activeBrand,
      name: brandName,
      url: brandUrl,
      tagline: brandTagline,
      description: brandDesc,
      pricing: brandPricing,
    });

    const brandContextBlock = brandName || brandUrl || fullBrandBlock !== 'Use ONLY the provided text context.'
      ? `ACTIVE WORKSPACE PRODUCT / BRAND (always ground content in all saved Brand Assets, modules, and Vault items below unless the user explicitly points you at another product/URL):
- Brand Name: ${brandName || 'N/A'}
- Website: ${brandUrl || 'N/A'}
- Tagline: ${brandTagline || 'N/A'}
- Description / Pitch: ${brandDesc || 'N/A'}
- Category: ${brandCategory || 'N/A'}
- Pricing: ${brandPricing || 'N/A'}
- Sender / Persona: ${brandPersona || 'Co-Founder & Growth Marketer'}
${fullBrandBlock}`
      : 'No active workspace brand profile selected yet.';

    const scannedBlock = mergedContexts.length > 0
      ? `SCANNED WEBSITE / ACTIVE TAB / THREAD CONTEXTS:\n${mergedContexts.map((c, i) => [
          `[Source ${i + 1} — ${c.sourceType === 'tab' ? 'ACTIVE BROWSER TAB' : (c.sourceType === 'brand' ? 'BRAND WEBSITE' : 'SCANNED URL')}: ${c.domain || c.url}]`,
          c.url ? `URL: ${c.url}` : '',
          c.title ? `Title: ${c.title}` : '',
          c.metaDescription ? `Meta Description: ${c.metaDescription}` : '',
          c.headings.length ? `Key Headings: ${c.headings.join(' | ')}` : '',
          c.ctaTexts.length ? `Primary CTAs: ${c.ctaTexts.join(' | ')}` : '',
          c.bodyCopy ? `Extracted Copy Excerpt: ${c.bodyCopy}` : '',
        ].filter(Boolean).join('\n')).join('\n\n')}`
      : 'No external websites or browser tabs scanned yet in this conversation.';

    const extraPostingRules = String(postingRulesSummary || '').trim()
      ? `\nAdditional Campaign/Posting Rules:\n${String(postingRulesSummary).trim().slice(0, 1200)}`
      : '';

    const modeHintBlock = mode === 'complete_missing_assets'
      ? `\nTASK MODE — COMPLETE MISSING ASSETS AUDIT:\nMissing / under-populated Product slots to fill:\n${JSON.stringify(missingAssetsAudit || {}).slice(0, 2500)}\nGenerate ready-to-save structured deliverables in "assets" targeting each missing slot cleanly.`
      : (mode === 'refine' && refineType
        ? `\nTASK MODE — ONE-CLICK REFINEMENT ("${String(refineType).slice(0, 40)}"):\nApply the requested transformation cleanly while respecting the Product's voice, forbidden words, and platform rules.`
        : '');

    const systemPrompt = `You are a Master Growth Marketer, Copywriter, and Strategic Co-Founder inside Smart Poster. You help founders brainstorm positioning, dissect competitor pages/screenshots, plan GTM campaigns, engage organically in communities, and write persuasive copy across EVERY selling intensity—from 100% non-salesy organic insight to soft-promotional peer recommendations to direct hardcore sales copy—matched precisely to the user's request.

MANDATORY 3-TIER TONE & LANGUAGE ADAPTATION CASCADE:
1. TIER 1 (Brand Assets & Saved Content): First study the voice, tone, vocabulary, formality, emojis, sentence rhythm, and written language inside the Brand Assets, saved Comments, Emails, DMs, Social Posts, Articles, Support FAQs, and Content Vault below. Always write in that exact voice and language.
2. TIER 2 (Website Copy Fallback): If Brand Assets and existing module items are sparse or empty, infer the tone, voice, and language directly from the Product's website copy provided in context.
3. TIER 3 (Niche Fallback): If neither is available, adapt naturally to the conventions of the inferred Product category/niche.

CORE MARKETING & WRITING PRINCIPLES:
1. CO-FOUNDER THINKING + EXECUTION: When the user is brainstorming, planning, or analyzing a screenshot/competitor page, give sharp strategic insights ("assets": [] when no final copy was asked for). When asked to write copy, put each variation/deliverable cleanly inside "assets".
2. FULL SALES SPECTRUM CONTROL: Adapt selling intensity cleanly to the channel & prompt:
   - Community/Reddit/HN/Quora comments & organic engagement: Helpful, grounded, zero fluff, zero fake hype unless user explicitly asks for a launch pitch.
   - Direct outreach/landing copy/hardcore sales offers: Strong hooks, clear proof, concrete urgency/CTA without robotic AI clichés.
3. ANTI-SLOP & FORBIDDEN WORDS: Never use hollow AI filler ("As an AI...", "In today's fast-paced digital landscape...", "delve", "testament to", "game-changer", "unlock your potential", "revolutionize"). Strictly avoid any term listed under "Forbidden Words / Claims (NEVER USE)".
4. LONG-FORM DEPTH WHEN ASKED: For educational breakdowns, comparisons, or articles (600–1,500+ words), deliver substantive, structured value—not padded filler.
5. MULTIMODAL & SCREENSHOT ANALYSIS: When images/screenshots are attached (competitor pricing pages, Reddit threads, landing page heroes, ad creatives), inspect visual hierarchy, messaging gaps, objections, and copy angles specifically before drafting.
6. SEPARATE DELIVERABLES: Put each variation, email, social post, FAQ, or directory field length as its own object inside "assets".

PLATFORM & POSTING RULES (POSTING_RULES.md):
- Twitter / X: NEVER include "https://" or "http://"—use clean domains like "domain.com" so links post cleanly without truncation glitches.
- Formatting: Preserve clean line breaks and strip leading/trailing whitespace.
- Spintax: When asked for spintax, use clean single-level {option1|option2} compatible with Smart Poster's Randomness Engine (never spin URLs or brand names).
- Directory Submission Field Limits (STRICT):
  - "directory_tagline": <= 60 characters
  - "directory_pitch": <= 140 characters
  - "directory_summary": <= 250 characters
  - "directory_description": full product overview${extraPostingRules}${modeHintBlock}

SUPPORTED "suggestedModule" VALUES:
- "social_post" (Native social post — include "platform" e.g. X|LinkedIn|Reddit|Threads, optional "format" single|thread|launch, optional "hook", and post text in "body")
- "comment" (Reusable community/blog/forum comment template — include optional "platform", text in "body")
- "contact" (Contact Form Outreach — include "subject" and body in "body")
- "email" (Cold/outreach email — include "subject" and body in "body")
- "dm" (Social DM — include optional "platform" e.g. Twitter|LinkedIn|Instagram|Reddit, text in "body")
- "article" (Short or long-form article — include "title" and full article in "body")
- "support_faq" (Support FAQ — put customer question in "title" and answer in "body", optional "category")
- "support_macro" (Canned Support Reply — put macro title in "title" and reply in "body", optional "category")
- "directory_tagline" (<= 60 chars)
- "directory_pitch" (<= 140 chars)
- "directory_summary" (<= 250 chars)
- "directory_description" (full directory description)
- "vault" (Idea, angle, hook, or draft meant for the Product Content Vault — include "title" and content in "body")

${brandContextBlock}

${scannedBlock}

RESPONSE FORMAT (CRITICAL):
Respond with ONLY a valid JSON object matching this exact schema (no markdown code fences wrapping the outer JSON):
{
  "reply": "Conversational co-founder strategy, teardown notes, or concise summary in plain markdown",
  "assets": [
    {
      "id": "asset-1",
      "suggestedModule": "email",
      "label": "Short display label e.g. Email #1 - Direct Angle",
      "platform": "optional e.g. X|LinkedIn|Reddit",
      "hook": "optional opening hook for social_post",
      "title": "Article title / FAQ question / Macro title / Vault title",
      "subject": "Email or Contact subject if email/contact",
      "category": "optional Support FAQ/Macro category",
      "body": "Ready-to-use copy"
    }
  ]
}`;

    const effectiveModel = String(aiModel || '').trim() || 'deepseek/deepseek-chat';
    let rawContent = '';
    let responseSource = '';
    let responseModel = effectiveModel;
    let responseUsage: any = null;
    let lastOpenRouterStatus = 0;
    let lastOpenRouterError = '';

    const openRouterMessages = sanitizedMessages.map((m) => {
      if (m.images && m.images.length > 0 && m.role === 'user') {
        const contentParts: any[] = [];
        if (m.content) contentParts.push({ type: 'text', text: m.content });
        m.images.forEach((img) => {
          contentParts.push({ type: 'image_url', image_url: { url: img.url } });
        });
        return { role: m.role, content: contentParts };
      }
      return { role: m.role, content: m.content };
    });

    if (userByokKey) {
      const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userByokKey}`,
          'HTTP-Referer': 'https://smartposter.pro',
          'X-Title': 'Smart Poster AI Marketer Assistant',
        },
        body: JSON.stringify({
          model: effectiveModel,
          messages: [
            { role: 'system', content: systemPrompt },
            ...openRouterMessages,
          ],
          temperature: mode === 'refine' ? 0.45 : 0.72,
          max_tokens: 4000,
        }),
      });

      if (orRes.ok) {
        const orData: any = await orRes.json();
        rawContent = String(orData?.choices?.[0]?.message?.content || '').trim();
        responseSource = `openrouter (${effectiveModel})`;
        responseUsage = orData?.usage || null;
      } else {
        lastOpenRouterStatus = orRes.status;
        const errText = await orRes.text().catch(() => '');
        lastOpenRouterError = `OpenRouter returned HTTP ${orRes.status}`;
        try {
          const parsedErr = JSON.parse(errText);
          if (parsedErr?.error?.message) lastOpenRouterError = parsedErr.error.message;
        } catch {
          if (errText) lastOpenRouterError = errText.slice(0, 220);
        }
      }
    }

    if (!rawContent && userGeminiKey) {
      try {
        const geminiImages: Array<{ mimeType: string; data: string }> = [];
        for (const m of sanitizedMessages) {
          if (m.role !== 'user' || !m.images?.length) continue;
          for (const img of m.images) {
            if (geminiImages.length >= 4) break;
            if (img.url.startsWith('data:image/')) {
              const match = img.url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
              if (match) {
                geminiImages.push({ mimeType: match[1], data: match[2] });
              }
            } else if (/^https?:\/\//i.test(img.url)) {
              try {
                const imgRes = await fetch(img.url, { signal: AbortSignal.timeout(4000) });
                if (imgRes.ok) {
                  const ct = imgRes.headers.get('content-type') || 'image/webp';
                  const ab = await imgRes.arrayBuffer();
                  if (ab.byteLength <= 2_500_000) {
                    geminiImages.push({ mimeType: ct.split(';')[0], data: Buffer.from(ab).toString('base64') });
                  }
                }
              } catch {}
            }
          }
        }
        const transcriptPrompt = sanitizedMessages
          .map((m) => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}${m.images?.length ? ` [${m.images.length} attached image(s)]` : ''}`)
          .join('\n\n');
        const gemRes = await callUserGeminiRest({
          apiKey: userGeminiKey,
          model: effectiveModel,
          systemInstruction: systemPrompt,
          prompt: transcriptPrompt,
          images: geminiImages.length > 0 ? geminiImages : undefined,
          temperature: mode === 'refine' ? 0.45 : 0.72,
          maxOutputTokens: 4000,
          jsonMode: true,
        });
        if (gemRes.ok && gemRes.text) {
          rawContent = gemRes.text;
          responseSource = `gemini-byok (${gemRes.model})`;
          responseModel = gemRes.model;
        } else if (!lastOpenRouterError && gemRes.error) {
          lastOpenRouterStatus = gemRes.status || lastOpenRouterStatus;
          lastOpenRouterError = gemRes.error;
        }
      } catch (gemErr: any) {
        console.warn('[Marketer Chat] Gemini BYOK failed:', gemErr?.message || gemErr);
      }
    }

    if (!rawContent) {
      if (lastOpenRouterStatus) {
        return res.status(lastOpenRouterStatus).json({
          success: false,
          needsApiKey: lastOpenRouterStatus === 401 || lastOpenRouterStatus === 403,
          error: lastOpenRouterError,
        });
      }
      return res.status(502).json({ success: false, error: lastOpenRouterError || 'AI model returned an empty response.' });
    }

    const parsed = parseAssistantStructuredJson(rawContent);
    const assets = normalizeMarketerAssets(parsed.assets);

    return res.json({
      success: true,
      reply: parsed.reply,
      assets,
      deliverables: assets,
      scannedSources: newlyScannedSources,
      model: responseModel,
      source: responseSource,
      usage: responseUsage,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'AI Assistant chat error' });
  }
};

app.post('/api/ai/marketer-chat', optionalVerifiedAuth, handleMarketerChat);
app.post('/api/ai/assistant-chat', optionalVerifiedAuth, handleMarketerChat);
app.post('/api/ai-assistant/chat', optionalVerifiedAuth, handleMarketerChat);

app.post('/api/ai/fetch-site-metadata', optionalVerifiedAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const rawUrl = String(req.body?.url || '').trim();
    if (!rawUrl) {
      return res.status(400).json({ success: false, error: 'Website URL is required.' });
    }
    const result = await fetchWebsiteCopy(rawUrl);
    if (!result.success) {
      return res.status(400).json({ success: false, url: result.url, error: result.error });
    }
    return res.json({ success: true, site: result.context, context: result.context });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Site metadata scan failed' });
  }
});

type AutoGenModule = 'directory' | 'comments' | 'contact' | 'email' | 'dm' | 'articles' | 'social' | 'support';

function slugifySeoText(str: string): string {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'article';
}

function cleanDomainFromUrl(rawUrl: string): string {
  return String(rawUrl || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0];
}

function stripEndPunct(str: string): string {
  return String(str || '').trim().replace(/[.!?]+$/, '').trim();
}

function smartTruncate(str: string, maxLen: number): string {
  const s = String(str || '').replace(/\s+/g, ' ').trim();
  if (s.length <= maxLen) return s;
  const sliced = s.slice(0, maxLen);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > Math.floor(maxLen * 0.6) ? sliced.slice(0, lastSpace) : sliced)
    .replace(/[,;:\-–—&+]+$/, '')
    .trim();
}

function lcFirst(str: string): string {
  const s = String(str || '').trim();
  if (!s) return '';
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function buildAutoGenerateFallback(
  mod: AutoGenModule,
  brandCtx: {
    name: string;
    url: string;
    tagline: string;
    description: string;
    category: string;
    pricing: string;
    articlePreset?: string;
    targetKeyword?: string;
  },
  landing: {
    metaTitle: string;
    metaDescription: string;
    heroHeadline: string;
    heroText: string;
    headings: string[];
    ctaTexts: string[];
    bodyCopy: string;
  }
): Record<string, any> {
  const name = brandCtx.name || landing.metaTitle.split(/[-|—]/)[0].trim() || 'Our product';
  const url = brandCtx.url || '';
  const domain = cleanDomainFromUrl(url) || name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
  const metaTitlePart = stripEndPunct(
    landing.metaTitle.includes('-') || landing.metaTitle.includes('|')
      ? landing.metaTitle.split(/[-|—]/).slice(1).join(' ').trim()
      : landing.metaTitle
  );
  const heroHook = stripEndPunct(landing.heroHeadline || brandCtx.tagline || metaTitlePart || name);
  const corePromise = stripEndPunct(brandCtx.tagline || metaTitlePart || landing.heroHeadline || brandCtx.description || name);
  const detailCopy = stripEndPunct(landing.metaDescription || brandCtx.description || landing.heroText || corePromise);
  const sentences = detailCopy.split(/[.!?]+\s+/).map(stripEndPunct).filter(Boolean);
  const firstSentence = sentences[0] || corePromise;
  const secondSentence = sentences[1] || stripEndPunct(landing.headings[1] || '');
  const heroLine = stripEndPunct((landing.heroText || heroHook).slice(0, 200));
  const ctaHint = landing.ctaTexts[0] ? landing.ctaTexts[0] : '';

  if (mod === 'comments') {
    const comments = [
      {
        angle: 'Pain-Point Mirror',
        text: `Dealing with this exact bottleneck is why we built ${name}. ${firstSentence}. If you want the faster route without overthinking it, check out ${domain}.`,
      },
      {
        angle: 'Builder Story',
        text: `When we put ${name} together, the goal was straightforward: ${lcFirst(heroHook)}. Curious how others here handle this right now, or if ${domain} fits your flow.`,
      },
      {
        angle: 'Hero Outcome',
        text: `${heroHook} — that's the exact gap ${name} focuses on. ${secondSentence || firstSentence}. Worth a quick look at ${url || domain}.`,
      },
      {
        angle: 'Helpful Peer Tip',
        text: `What worked best for us was cutting out extra steps and keeping the workflow simple. We built ${name} (${domain}) around ${lcFirst(metaTitlePart || corePromise)}.`,
      },
      {
        angle: 'Fresh Take',
        text: `Most tools make this way heavier than it needs to be. ${name} keeps it light: ${firstSentence}. Easy to test out at ${domain}.`,
      },
      {
        angle: 'Short Micro-Pitch',
        text: `Quick share if this is on your radar: ${name} — ${corePromise}. Take a look at ${domain}.`,
      },
      {
        angle: 'Workflow Drop',
        text: `If you're stuck on this part of the process, ${name} handles it cleanly (${smartTruncate(heroLine, 120)}). Happy to share how we set it up at ${url || domain}.`,
      },
      {
        angle: 'Conversation Starter',
        text: `Honest question — what part of this eats up most of your week? We built ${name} around "${smartTruncate(heroHook, 90)}" to cut down the manual grind: ${domain}.`,
      },
    ];
    return { comments };
  }

  if (mod === 'directory') {
    const cleanName = smartTruncate(name, 40);
    const t1 = smartTruncate(metaTitlePart || corePromise, 60);
    const t2 = smartTruncate(heroHook, 60);
    const t3 = smartTruncate(`${cleanName}: ${firstSentence}`, 60);
    const taglines = Array.from(new Set([t1, t2, t3].filter(Boolean)));
    if (taglines.length < 2) taglines.push(smartTruncate(`${cleanName} — ${corePromise}`, 60));

    const pitch1 = smartTruncate(`${cleanName}: ${heroHook}. ${firstSentence}.`, 140);
    const pitch2 = smartTruncate(`${firstSentence}. Built to help you ${lcFirst(corePromise)}.`, 140);
    const pitch3 = smartTruncate(`${metaTitlePart || cleanName} — try ${domain} for a faster, simpler workflow.`, 140);
    const summary1 = smartTruncate(`${cleanName} (${domain}) — ${detailCopy}.`, 250);
    const summary2 = smartTruncate(`${heroHook}. ${detailCopy}.${ctaHint ? ` ${ctaHint} at ${domain}.` : ''}`, 250);
    const desc1 = `${cleanName} — ${heroHook}\n\n${detailCopy}.${landing.headings.length ? `\n\nHighlights: ${landing.headings.slice(0, 4).join(' • ')}` : ''}\n\nTry it at ${url || domain}.`.trim();
    const desc2 = `${detailCopy}.\n\n${landing.heroText ? `${stripEndPunct(landing.heroText.slice(0, 420))}.\n\n` : ''}Visit ${url || domain} to see ${cleanName} in action.`.trim();
    return {
      productName: cleanName,
      websiteUrl: url,
      category: brandCtx.category || 'Marketing & Sales',
      pricingModel: brandCtx.pricing || 'Freemium',
      taglines,
      pitches: Array.from(new Set([pitch1, pitch2, pitch3].filter(Boolean))),
      summaries: Array.from(new Set([summary1, summary2].filter(Boolean))),
      descriptions: [desc1, desc2].filter(Boolean),
    };
  }

  if (mod === 'contact') {
    // STRICT RULE: Never generate or return name, email, or phone fields
    return {
      company: name,
      website: url,
      subject: smartTruncate(`Introducing ${name} — ${heroHook}`, 75),
      message: `Hi there,\n\nI'm reaching out to introduce ${name} (${url || domain}) — ${lcFirst(firstSentence)}.\n\nWe built ${name} to help with ${lcFirst(corePromise)}${secondSentence ? ` (${lcFirst(secondSentence)})` : ''}.\n\nIf that's relevant to what you're working on, you can take a quick look at ${url || domain} — happy to answer any questions.`,
    };
  }

  if (mod === 'email') {
    return {
      emails: [
        {
          subject: smartTruncate(`Introducing ${name}: ${heroHook}`, 65),
          body: `Hi there,\n\nWanted to briefly introduce ${name} (${url || domain}).\n\n${firstSentence}.${secondSentence ? ` ${secondSentence}.` : ''}\n\nWe built it for people who want a simpler way to handle ${lcFirst(corePromise)} without bloated setup. You can take a quick look at ${url || domain} or reply if you'd like a walkthrough.\n\nBest,\n${name} Team`,
        },
        {
          subject: smartTruncate(`${name} — ${heroHook}`, 65),
          body: `Hi,\n\nI'm writing to introduce ${name} (${url || domain}).\n\nIn short: ${heroHook}. ${smartTruncate(detailCopy, 200)}.\n\nIf you're looking for a simpler way to handle this in your workflow, check out ${url || domain} — happy to share more details anytime.\n\nCheers,\n${name}`,
        },
        {
          subject: smartTruncate(`Meet ${name} (${domain})`, 65),
          body: `Hello,\n\nQuick introduction from our team at ${name} (${url || domain}).\n\nWe created ${name} to help with ${lcFirst(corePromise)}. ${firstSentence}.\n\nIf this fits what you're focused on right now, feel free to explore it at ${url || domain} and let me know what you think.\n\nBest,\n${name}`,
        },
        {
          subject: smartTruncate(`Quick intro: ${name} for ${brandCtx.category || 'your workflow'}`, 65),
          body: `Hi there,\n\nSharing a quick introduction to ${name} (${url || domain}).\n\nMost teams waste hours stitching together manual steps for something that should take minutes. ${name} gives you a direct solution: ${smartTruncate(detailCopy, 220)}.\n\nTake a look at ${url || domain} whenever you have a minute.\n\nBest,\n${name} Team`,
        },
      ],
    };
  }

  if (mod === 'dm') {
    return {
      dms: [
        {
          platform: 'Twitter',
          message: `Hey! Quick intro — we built ${name} (${domain}) to help with ${lcFirst(corePromise)}. Check it out if that's useful for your workflow!`,
        },
        {
          platform: 'LinkedIn',
          message: `Hi! Wanted to introduce ${name} (${url || domain}) — ${firstSentence}. Thought it could be useful for what you're working on.`,
        },
        {
          platform: 'Reddit',
          message: `Hey! Sharing a quick intro to ${name} (${domain}) — ${corePromise} without extra manual work. Happy to share how it works if you're interested.`,
        },
        {
          platform: 'Instagram',
          message: `Hey! Quick intro to ${name} (${domain}) — we built it to help with ${lcFirst(corePromise)}. Worth a quick peek!`,
        },
      ],
    };
  }

  if (mod === 'social') {
    return {
      socialPosts: [
        {
          platform: 'X / Twitter',
          format: 'single',
          hook: smartTruncate(`${heroHook}. Here's why we built ${name}:`, 120),
          body: smartTruncate(`${heroHook}.\n\n${firstSentence}.\n\nNo bloated setup — check out ${domain}`, 275),
          ctaUrl: url || `https://${domain}`,
        },
        {
          platform: 'LinkedIn',
          format: 'single',
          hook: smartTruncate(`Most teams waste hours on ${lcFirst(brandCtx.category || 'manual workflows')}.`, 140),
          body: `Most teams still stitch together disconnected steps to handle ${lcFirst(corePromise)}.\n\nWhen we built ${name}, we focused on one clear outcome: ${firstSentence}.\n\n${secondSentence ? `${secondSentence}.\n\n` : ''}See how it works at ${url || domain}.`,
          ctaUrl: url || `https://${domain}`,
        },
        {
          platform: 'Reddit',
          format: 'launch',
          hook: smartTruncate(`Show & Tell: I built ${name} to help with ${lcFirst(corePromise)}`, 140),
          body: `Hey everyone,\n\nI got tired of complicated workflows for ${lcFirst(corePromise)}, so I built ${name} (${domain}).\n\nWhat it does:\n- ${firstSentence}\n- ${secondSentence || heroHook}\n\nPricing: ${brandCtx.pricing || 'Freemium'}. Happy to hear honest feedback!`,
          ctaUrl: url || `https://${domain}`,
        },
        {
          platform: 'Threads',
          format: 'thread',
          hook: smartTruncate(`Quick breakdown on ${lcFirst(corePromise)} 🧵`, 110),
          body: `1/ The bottleneck: ${firstSentence}.\n\n2/ What actually moves the needle: ${heroHook}.\n\n3/ That's why we built ${name} (${domain}) — try it out when you get a minute.`,
          ctaUrl: url || `https://${domain}`,
        },
      ],
    };
  }

  if (mod === 'support') {
    return {
      faqs: [
        {
          category: 'General',
          question: `What is ${name} and who is it built for?`,
          answer: `${name} is built to help with ${lcFirst(corePromise)}. ${detailCopy}. You can explore full details at ${url || domain}.`,
        },
        {
          category: 'Pricing & Billing',
          question: `How does pricing work for ${name}?`,
          answer: `${name} offers ${brandCtx.pricing || 'flexible plans'}. Visit ${url || domain} for the latest plan breakdown and limits.`,
        },
        {
          category: 'Onboarding',
          question: `How quickly can I get started with ${name}?`,
          answer: `You can set up ${name} in a few minutes. Start by visiting ${url || domain} and following the quick-start workflow for ${lcFirst(corePromise)}.`,
        },
      ],
      macros: [
        {
          category: 'General',
          title: 'Quick Intro & Onboarding Help',
          body: `Hi there!\n\nThanks for reaching out about ${name}. To get started quickly, ${lcFirst(firstSentence)}. You can check ${url || domain} anytime — reply here if you'd like me to walk through your setup!`,
        },
        {
          category: 'Bug Report',
          title: 'Bug Triage & Follow-Up',
          body: `Hi! Thanks for flagging this. Could you share the page URL or a quick screenshot of what happened? We take reliability in ${name} seriously and will look into this right away.`,
        },
        {
          category: 'Feature Request',
          title: 'Feature Request Logged',
          body: `Appreciate you sharing that idea! We're actively improving ${name} (${domain}) around ${lcFirst(corePromise)}, and I've logged this request with our product notes so we can prioritize it.`,
        },
      ],
    };
  }

  // articles
  const preset = brandCtx.articlePreset || 'problem-solution';
  const kw = String(brandCtx.targetKeyword || '').trim() || smartTruncate(brandCtx.category || heroHook, 40);
  const headingsList = landing.headings.length ? landing.headings.slice(0, 4) : [heroHook, firstSentence];
  const title1 = preset === 'how-to'
    ? `How to Master ${smartTruncate(kw, 40)} Using ${name}`
    : preset === 'comparison'
      ? `Comparing Approaches to ${smartTruncate(kw, 36)}: Why ${name} Keeps It Simple`
      : preset === 'launch-story'
        ? `Why We Built ${name}: Solving ${smartTruncate(heroHook, 45)}`
        : `The Problem With ${smartTruncate(kw, 45)} — And a Simpler Solution`;
  const title2 = `Solving ${smartTruncate(heroHook, 55)}: How ${name} Helps Target Users`;
  return {
    articles: [
      {
        title: title1,
        preset,
        targetKeyword: kw,
        slug: slugifySeoText(title1),
        metaDescription: smartTruncate(`${firstSentence}. Discover how ${name} helps with ${lcFirst(corePromise)}.`, 158),
        body: `The Problem\nWhen you need better results with ${lcFirst(corePromise)}, you quickly run into the same bottleneck: too many disconnected steps, slow manual work, and inconsistent outcomes.\n\nWhy Current Workflows Fall Short\n${stripEndPunct(headingsList[0] || heroHook)}. Most tools either overcomplicate the setup or leave you doing the repetitive parts by hand, which eats up time every single week.\n\nThe Solution: How ${name} Helps\nThat's the exact problem ${name} (${url || domain}) is built to solve. ${detailCopy}.\n\nHere is how ${name} helps target users in practice:\n- Eliminates the manual bottleneck: ${firstSentence}.\n- Keeps execution focused: ${stripEndPunct(headingsList[1] || secondSentence || heroHook)}.\n- Gets you to results faster without heavy setup.\n\nIf you want a simpler way to handle ${lcFirst(corePromise)}, try ${name} at ${url || domain}.`,
      },
      {
        title: title2,
        preset: preset === 'problem-solution' ? 'how-to' : preset,
        targetKeyword: kw,
        slug: slugifySeoText(title2),
        metaDescription: smartTruncate(`${heroHook}. Practical guide to fixing ${lcFirst(corePromise)} with ${name}.`, 158),
        body: `The Problem\nGetting consistent outcomes around ${brandCtx.category || 'growth'} shouldn't require duct-taping multiple workflows together. Yet most people spend more time managing tools and manual tasks than actually shipping.\n\nThe Root Cause\n${landing.heroText ? `${stripEndPunct(landing.heroText.slice(0, 320))}.\n\n` : ''}${firstSentence}.\n\nThe Solution: How ${name} Helps You Fix It\nWe built ${name} (${url || domain}) around one goal: ${heroHook}.\n\nInstead of adding another complex dashboard, ${name} helps you directly:\n1. Cut out repetitive friction: ${firstSentence}.\n2. Focus on what actually moves the needle: ${secondSentence || smartTruncate(detailCopy, 180)}.\n3. Turn your workflow into a repeatable system you can run in minutes.\n\nSee how ${name} solves this for your workflow at ${url || domain}.`,
      },
    ],
  };
}

app.post('/api/ai/auto-generate-module', optionalVerifiedAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const {
      module: targetModuleRaw = '',
      brand = {},
      landingContext = null,
      openRouterKey = '',
      geminiApiKey = '',
      aiModel = '',
    } = req.body || {};

    const mod = String(targetModuleRaw || '').trim().toLowerCase() as AutoGenModule;
    const validModules = new Set<AutoGenModule>(['directory', 'comments', 'contact', 'email', 'dm', 'articles', 'social', 'support']);
    if (!validModules.has(mod)) {
      return res.status(400).json({ success: false, error: `Unsupported module: ${targetModuleRaw}` });
    }

    const brandName = String(brand.name || brand.brandName || '').trim();
    const brandUrl = String(brand.url || brand.websiteUrl || brand.website || '').trim();
    const brandTagline = String(brand.tagline || '').trim();
    const brandDescription = String(brand.description || '').trim();
    const brandCategory = String(brand.category || '').trim() || 'Marketing & Sales';
    const brandPricing = String(brand.pricing || brand.pricingModel || '').trim() || 'Freemium';

    let landing = {
      metaTitle: String(landingContext?.metaTitle || landingContext?.title || '').trim(),
      metaDescription: String(landingContext?.metaDescription || landingContext?.description || '').trim(),
      heroHeadline: String(landingContext?.heroHeadline || '').trim(),
      heroText: String(landingContext?.heroText || '').trim(),
      headings: Array.isArray(landingContext?.headings) ? landingContext.headings.map((h: any) => String(h).trim()).filter(Boolean).slice(0, 12) : [],
      ctaTexts: Array.isArray(landingContext?.ctaTexts) ? landingContext.ctaTexts.map((c: any) => String(c).trim()).filter(Boolean).slice(0, 8) : [],
      bodyCopy: String(landingContext?.bodyCopy || landingContext?.copy || '').trim(),
    };

    const hasInitialProductDetails = Boolean(
      (brandName && (brandUrl || brandTagline || brandDescription)) ||
      (brandUrl && (brandTagline || brandDescription)) ||
      landing.metaTitle ||
      landing.metaDescription ||
      landing.heroText ||
      landing.bodyCopy
    );

    if (!hasInitialProductDetails) {
      return res.status(400).json({
        success: false,
        error: 'Fill out or fetch Product Details first before auto-generating.',
      });
    }

    // If URL is provided and we don't yet have rich landing page hero/body copy, fetch live page context on the server
    if (brandUrl && (!landing.heroText || !landing.bodyCopy || !landing.metaTitle)) {
      try {
        const scanned = await fetchWebsiteCopy(brandUrl);
        if (scanned.success && scanned.context) {
          landing = {
            metaTitle: landing.metaTitle || scanned.context.metaTitle || scanned.context.title || '',
            metaDescription: landing.metaDescription || scanned.context.metaDescription || scanned.context.description || '',
            heroHeadline: landing.heroHeadline || scanned.context.heroHeadline || '',
            heroText: landing.heroText || scanned.context.heroText || '',
            headings: landing.headings.length ? landing.headings : (scanned.context.headings || []),
            ctaTexts: landing.ctaTexts.length ? landing.ctaTexts : (scanned.context.ctaTexts || []),
            bodyCopy: landing.bodyCopy || scanned.context.bodyCopy || '',
          };
        }
      } catch (scanErr: any) {
        console.warn('[AutoGenerate] Optional URL fetch skipped:', scanErr?.message || scanErr);
      }
    }

    const brandCtx = {
      name: brandName || landing.metaTitle.split(/[-|—]/)[0].trim() || 'Product',
      url: brandUrl,
      tagline: brandTagline || landing.heroHeadline || '',
      description: brandDescription || landing.metaDescription || '',
      category: brandCategory,
      pricing: brandPricing,
      articlePreset: String(req.body?.articlePreset || brand?.articlePreset || 'problem-solution').trim(),
      targetKeyword: String(req.body?.targetKeyword || brand?.targetKeyword || '').trim(),
    };

    const extraBrandBlock = buildFullBrandContextBlock(brand);
    const contextBrief = [
      `PRODUCT DETAILS / BRAND ASSETS:`,
      `- Name: ${brandCtx.name}`,
      `- Website URL: ${brandCtx.url || 'N/A'}`,
      `- Tagline: ${brandCtx.tagline || 'N/A'}`,
      `- Description: ${brandCtx.description || 'N/A'}`,
      `- Category: ${brandCtx.category}`,
      `- Pricing: ${brandCtx.pricing}`,
      extraBrandBlock ? `\nADDITIONAL STRUCTURED BRAND ASSETS:\n${extraBrandBlock}` : '',
      ``,
      `SITE LANDING CONTENT:`,
      `- Meta Title: ${landing.metaTitle || 'N/A'}`,
      `- Meta Description: ${landing.metaDescription || 'N/A'}`,
      `- Hero Headline: ${landing.heroHeadline || 'N/A'}`,
      `- Hero Section Copy: ${landing.heroText || 'N/A'}`,
      `- Key Headings: ${landing.headings.length ? landing.headings.join(' | ') : 'N/A'}`,
      `- Primary CTAs: ${landing.ctaTexts.length ? landing.ctaTexts.join(' | ') : 'N/A'}`,
      `- Landing Body Excerpt: ${landing.bodyCopy ? landing.bodyCopy.slice(0, 2200) : 'N/A'}`,
    ].filter(Boolean).join('\n');

    const toneRules = `CRITICAL TONE & QUALITY RULES:
1. MATCH THE PRODUCT & LANDING PAGE TONE & LANGUAGE EXACTLY: Study the voice, vocabulary, sentence rhythm, personality, and language of the Meta Title, Meta Description, Hero Section, Brand Assets, and Landing Body above. Write in THAT exact voice and language automatically.
2. NOT OVERLY PROFESSIONAL / NO CORPORATE STIFFNESS: Do NOT sound like a stiff B2B enterprise agency or generic brochure. Avoid words like "synergy", "leverage", "streamline your acquisition pipeline", "revolutionize", "game-changer", "unlock your potential", "elevate", "esteemed", "in today's fast-paced digital landscape", or "I hope this email finds you well".
3. NO FILLER: Every line must reflect concrete specifics from this product's landing copy (real problems, outcomes, features, and phrasing from the hero section, meta title, and description). Sound like a real maker/founder talking naturally to peers.`;

    let moduleInstructions = '';
    if (mod === 'comments') {
      moduleInstructions = `Generate 8 distinct, high-quality social/community comments for "${brandCtx.name}" using the site's Meta Title, Meta Description, and Hero Section.
Each comment MUST use a genuinely different pitch angle:
1. Pain-Point Mirror
2. Builder / Founder Note
3. Direct Hero Outcome
4. Helpful Peer Tip + Casual Mention
5. Fresh / Contrarian Take
6. Short Micro-Pitch (1-2 punchy sentences)
7. Workflow / How-It-Works Drop
8. Relatable Observation / Question Hook + Soft Mention
Keep each comment 20-65 words. Never use "https://" if writing Twitter-style short copy; clean domain or URL is fine where natural.
Return ONLY valid JSON:
{
  "comments": [
    { "angle": "Pain-Point Mirror", "text": "..." },
    ... (8 items total)
  ]
}`;
    } else if (mod === 'directory') {
      moduleInstructions = `Generate complete Directory Submission copy for "${brandCtx.name}" grounded in the site's Meta Title, Meta Description, and Hero Section, matching the landing page's voice.
STRICT LENGTH LIMITS:
- productName: <= 40 characters
- taglines: 3 distinct taglines, EACH <= 60 characters
- pitches: 3 distinct elevator pitches, EACH <= 140 characters
- summaries: 2 distinct summaries, EACH <= 250 characters
- descriptions: 2 rich, natural product descriptions (350-700 chars each, no corporate fluff)
- category: pick the single best match from ["Marketing & Sales","AI & Machine Learning","Developer Tools","Productivity & Workflow","Design & Creative","E-commerce & Retail","Finance & Fintech","Social & Community","Analytics & Data","Education & Learning","Other"]
- pricingModel: pick best match from ["Freemium","Free","Free Trial","Paid","Contact for Pricing"]
Return ONLY valid JSON:
{
  "productName": "...",
  "websiteUrl": "${brandCtx.url}",
  "category": "...",
  "pricingModel": "...",
  "taglines": ["...", "...", "..."],
  "pitches": ["...", "...", "..."],
  "summaries": ["...", "..."],
  "descriptions": ["...", "..."]
}`;
    } else if (mod === 'contact') {
      moduleInstructions = `Generate a DIRECT Product Introduction message for a website Contact Form, sent FROM the maker/team of "${brandCtx.name}" TO the recipient, grounded in the landing page copy and tone.
CRITICAL PERSPECTIVE RULE:
- Write FROM the team/maker of "${brandCtx.name}" directly introducing "${brandCtx.name}" TO the recipient (what "${brandCtx.name}" does, how it helps, and its URL).
- NEVER write as an external user/fan/customer emailing "${brandCtx.name}" or asking questions about "${brandCtx.name}" (e.g., NEVER write "Quick question about ${brandCtx.name}" or "I came across ${brandCtx.name} and love it").
- NEVER write a third-party recommendation email. It must be a direct introduction of "${brandCtx.name}" from us to them.
CRITICAL FIELD RULE: DO NOT generate, include, or invent a person's Name, Email Address, or Phone Number! Only return "company", "website", "subject", and "message".
Keep the subject direct and natural (e.g. "Introducing ${brandCtx.name} — ..."), and the message concise, clear, and human.
Return ONLY valid JSON:
{
  "company": "${brandCtx.name}",
  "website": "${brandCtx.url}",
  "subject": "...",
  "message": "..."
}`;
    } else if (mod === 'email') {
      moduleInstructions = `Generate 4 distinct DIRECT Introduction Email variations for "${brandCtx.name}" grounded in the site's Meta Title, Meta Description, and Hero Section.
CRITICAL PERSPECTIVE RULE:
- Every email MUST be written FROM the maker/team of "${brandCtx.name}" directly introducing "${brandCtx.name}" TO the recipient (what the product is, what problem it solves / how it helps, and its URL).
- NEVER write as a user asking questions about "${brandCtx.name}" or as a third-party recommending it.
Make them conversational, human, direct, and tone-matched to the landing page—NOT stiff corporate templates. Vary the opening hook across the 4 emails.
Return ONLY valid JSON:
{
  "emails": [
    { "subject": "...", "body": "..." },
    ... (4 items total)
  ]
}`;
    } else if (mod === 'dm') {
      moduleInstructions = `Generate 4 distinct SHORT Direct Messages (DMs) across platforms ("Twitter", "LinkedIn", "Reddit", "Instagram") that directly introduce "${brandCtx.name}" based on the landing page copy and hero section.
CRITICAL PERSPECTIVE RULE:
- Each DM must be short (1-2 crisp, natural sentences) sent FROM the maker/team directly introducing "${brandCtx.name}" (what it does / how it helps + link/domain).
- Keep it warm, peer-to-peer, and concise—not spammy or overly formal. For Twitter, use clean domain without "https://".
Return ONLY valid JSON:
{
  "dms": [
    { "platform": "Twitter", "message": "..." },
    { "platform": "LinkedIn", "message": "..." },
    { "platform": "Reddit", "message": "..." },
    { "platform": "Instagram", "message": "..." }
  ]
}`;
    } else if (mod === 'social') {
      moduleInstructions = `Generate 4 distinct, platform-native Social Posts for "${brandCtx.name}" grounded in the site's Meta Title, Meta Description, Hero Section, and Brand Assets.
Platforms & formats:
1. X / Twitter ("single" format, crisp hook + body <= 270 chars total, clean domain without "https://")
2. LinkedIn ("single" format, practical builder takeaway)
3. Reddit ("launch" format, honest maker Share & Tell without hype)
4. Threads ("thread" format, 3-part concise breakdown)
Return ONLY valid JSON:
{
  "socialPosts": [
    { "platform": "X / Twitter", "format": "single", "hook": "...", "body": "...", "ctaUrl": "${brandCtx.url}" },
    { "platform": "LinkedIn", "format": "single", "hook": "...", "body": "...", "ctaUrl": "${brandCtx.url}" },
    { "platform": "Reddit", "format": "launch", "hook": "...", "body": "...", "ctaUrl": "${brandCtx.url}" },
    { "platform": "Threads", "format": "thread", "hook": "...", "body": "...", "ctaUrl": "${brandCtx.url}" }
  ]
}`;
    } else if (mod === 'support') {
      moduleInstructions = `Generate Customer Support Knowledge Base entries for "${brandCtx.name}" grounded in the Brand Assets, pricing summary, features, and landing page copy.
Include 3 clear FAQs (covering General, Pricing & Billing, Onboarding) AND 3 warm, human canned Support Macros (General help, Bug Report follow-up, Feature Request acknowledgement).
Return ONLY valid JSON:
{
  "faqs": [
    { "category": "General", "question": "...", "answer": "..." },
    { "category": "Pricing & Billing", "question": "...", "answer": "..." },
    { "category": "Onboarding", "question": "...", "answer": "..." }
  ],
  "macros": [
    { "category": "General", "title": "...", "body": "..." },
    { "category": "Bug Report", "title": "...", "body": "..." },
    { "category": "Feature Request", "title": "...", "body": "..." }
  ]
}`;
    } else if (mod === 'articles') {
      const seoPresetHint = brandCtx.articlePreset ? `Preferred preset style: "${brandCtx.articlePreset}". ` : '';
      const seoKwHint = brandCtx.targetKeyword ? `Target SEO keyword to weave naturally: "${brandCtx.targetKeyword}". ` : '';
      moduleInstructions = `Generate 2 distinct, high-quality Problem/Solution or How-To articles for "${brandCtx.name}" grounded in the site's Meta Title, Meta Description, Hero Section, and landing page copy. ${seoPresetHint}${seoKwHint}
CRITICAL STRUCTURE RULE:
- Write each article around a clear theme focused on the target user:
  1. The Problem: Clearly describe the real pain point / bottleneck the target user struggles with.
  2. Why Existing Approaches Fall Short: Explain the friction or wasted effort in common workflows.
  3. The Solution & How "${brandCtx.name}" Helps: Show practically how "${brandCtx.name}" solves that problem and helps the target user get better results.
- Each article should be ~350-550 words, insightful and practical, matching the landing page's voice/tone (not stiff corporate fluff), with clean paragraph breaks and natural placement of ${brandCtx.url || brandCtx.name}.
- Also generate SEO metadata: "preset" ("problem-solution"|"how-to"|"comparison"|"launch-story"|"changelog"), "targetKeyword", "slug" (lowercase hyphenated), and "metaDescription" (STRICTLY <= 160 characters).
Return ONLY valid JSON:
{
  "articles": [
    { "title": "...", "preset": "problem-solution", "targetKeyword": "...", "slug": "...", "metaDescription": "...", "body": "..." },
    { "title": "...", "preset": "how-to", "targetKeyword": "...", "slug": "...", "metaDescription": "...", "body": "..." }
  ]
}`;
    }

    const systemInstruction = `${toneRules}\n\n${moduleInstructions}`;
    const userOrKey = String(openRouterKey || '').trim();
    const userGeminiKey = String(geminiApiKey || '').trim();
    let parsedPayload: Record<string, any> | null = null;
    let source = 'local-landing-synthesis';

    if (userOrKey) {
      try {
        const orModel = String(aiModel || '').trim() || 'deepseek/deepseek-chat';
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userOrKey}`,
            'HTTP-Referer': 'https://smartposter.pro',
            'X-Title': 'Smart Poster Auto Generate',
          },
          body: JSON.stringify({
            model: orModel,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: `${contextBrief}\n\nGenerate JSON now.` },
            ],
            temperature: 0.7,
            max_tokens: 3200,
          }),
        });
        if (orRes.ok) {
          const orData: any = await orRes.json();
          const raw = String(orData?.choices?.[0]?.message?.content || '').trim();
          const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
          const firstBrace = clean.indexOf('{');
          const lastBrace = clean.lastIndexOf('}');
          const jsonSlice = firstBrace !== -1 && lastBrace > firstBrace ? clean.slice(firstBrace, lastBrace + 1) : clean;
          const candidate = JSON.parse(jsonSlice);
          if (candidate && typeof candidate === 'object') {
            parsedPayload = candidate;
            source = `openrouter (${orModel})`;
          }
        }
      } catch (orErr: any) {
        console.warn('[AutoGenerate] OpenRouter failed, checking Gemini BYOK / local synthesis:', orErr?.message || orErr);
      }
    }

    if (!parsedPayload && userGeminiKey) {
      try {
        const gemRes = await callUserGeminiRest({
          apiKey: userGeminiKey,
          model: aiModel,
          systemInstruction,
          prompt: `${contextBrief}\n\nGenerate JSON now.`,
          temperature: 0.7,
          maxOutputTokens: 3200,
          jsonMode: true,
        });
        if (gemRes.ok && gemRes.text) {
          const clean = gemRes.text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
          const firstBrace = clean.indexOf('{');
          const lastBrace = clean.lastIndexOf('}');
          const jsonSlice = firstBrace !== -1 && lastBrace > firstBrace ? clean.slice(firstBrace, lastBrace + 1) : clean;
          const candidate = JSON.parse(jsonSlice);
          if (candidate && typeof candidate === 'object') {
            parsedPayload = candidate;
            source = `gemini-byok (${gemRes.model})`;
          }
        }
      } catch (gemErr: any) {
        console.warn('[AutoGenerate] Gemini BYOK failed, using landing-copy fallback:', gemErr?.message || gemErr);
      }
    }

    if (!parsedPayload) {
      parsedPayload = buildAutoGenerateFallback(mod, brandCtx, landing);
      source = 'local-landing-synthesis';
    }

    // Enforce strict guardrails on returned payload
    if (mod === 'contact') {
      delete parsedPayload.name;
      delete parsedPayload.senderName;
      delete parsedPayload.email;
      delete parsedPayload.senderEmail;
      delete parsedPayload.phone;
      parsedPayload.company = String(parsedPayload.company || brandCtx.name || '').trim();
      parsedPayload.website = String(parsedPayload.website || brandCtx.url || '').trim();
      parsedPayload.subject = String(parsedPayload.subject || '').trim();
      parsedPayload.message = String(parsedPayload.message || '').trim();
    } else if (mod === 'directory') {
      parsedPayload.productName = smartTruncate(String(parsedPayload.productName || brandCtx.name || ''), 40);
      parsedPayload.websiteUrl = String(parsedPayload.websiteUrl || brandCtx.url || '').trim();
      if (Array.isArray(parsedPayload.taglines)) {
        parsedPayload.taglines = parsedPayload.taglines.map((t: any) => smartTruncate(String(t || ''), 60)).filter(Boolean);
      }
      if (Array.isArray(parsedPayload.pitches)) {
        parsedPayload.pitches = parsedPayload.pitches.map((p: any) => smartTruncate(String(p || ''), 140)).filter(Boolean);
      }
      if (Array.isArray(parsedPayload.summaries)) {
        parsedPayload.summaries = parsedPayload.summaries.map((s: any) => smartTruncate(String(s || ''), 250)).filter(Boolean);
      }
      if (Array.isArray(parsedPayload.descriptions)) {
        parsedPayload.descriptions = parsedPayload.descriptions.map((d: any) => String(d || '').trim()).filter(Boolean);
      }
    } else if (mod === 'comments') {
      const list = Array.isArray(parsedPayload.comments) ? parsedPayload.comments : [];
      parsedPayload.comments = list
        .map((c: any, idx: number) => {
          if (typeof c === 'string') return { angle: `Pitch ${idx + 1}`, text: c.trim() };
          return { angle: String(c?.angle || `Pitch ${idx + 1}`).trim(), text: String(c?.text || '').trim() };
        })
        .filter((c: any) => c.text);
      if (parsedPayload.comments.length < 6) {
        const fallback = buildAutoGenerateFallback('comments', brandCtx, landing).comments;
        for (const fc of fallback) {
          if (parsedPayload.comments.length >= 8) break;
          parsedPayload.comments.push(fc);
        }
      }
    } else if (mod === 'articles' && Array.isArray(parsedPayload.articles)) {
      parsedPayload.articles = parsedPayload.articles
        .map((a: any) => {
          const title = String(a?.title || '').trim();
          const body = String(a?.body || '').trim();
          if (!title && !body) return null;
          return {
            title: title || `${brandCtx.name} Guide`,
            preset: String(a?.preset || brandCtx.articlePreset || 'problem-solution').trim(),
            targetKeyword: String(a?.targetKeyword || brandCtx.targetKeyword || '').trim(),
            slug: slugifySeoText(a?.slug || title || brandCtx.name),
            metaDescription: smartTruncate(String(a?.metaDescription || brandCtx.description || ''), 160),
            body,
          };
        })
        .filter(Boolean);
    } else if (mod === 'social') {
      const list = Array.isArray(parsedPayload.socialPosts) ? parsedPayload.socialPosts : [];
      parsedPayload.socialPosts = list
        .map((p: any) => ({
          platform: String(p?.platform || 'X / Twitter').trim(),
          format: String(p?.format || 'single').trim(),
          hook: String(p?.hook || '').trim(),
          body: String(p?.body || '').trim(),
          ctaUrl: String(p?.ctaUrl || brandCtx.url || '').trim(),
        }))
        .filter((p: any) => p.hook || p.body);
    } else if (mod === 'support') {
      const faqs = Array.isArray(parsedPayload.faqs) ? parsedPayload.faqs : [];
      const macros = Array.isArray(parsedPayload.macros) ? parsedPayload.macros : [];
      parsedPayload.faqs = faqs
        .map((f: any) => ({
          category: String(f?.category || 'General').trim(),
          question: String(f?.question || '').trim(),
          answer: String(f?.answer || '').trim(),
        }))
        .filter((f: any) => f.question || f.answer);
      parsedPayload.macros = macros
        .map((m: any) => ({
          category: String(m?.category || 'General').trim(),
          title: String(m?.title || '').trim(),
          body: String(m?.body || '').trim(),
        }))
        .filter((m: any) => m.title || m.body);
    }

    return res.json({
      success: true,
      module: mod,
      data: parsedPayload,
      landingContext: landing,
      source,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Auto-generate failed' });
  }
});

// ==============================================================================
// Catalog, User Workspace Sync & Research RSS Discovery Endpoints
// ==============================================================================

// Directories Database (Unrestricted reference catalog for all user tiers)
app.get('/api/directories', optionalVerifiedAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const result = await loadDirectories(false);
    const allItems = result.items || [];
    const tierLabel = req.authUser
      ? (isUnlimitedTier(req.authUser) ? 'unlimited' : (req.authUser.tier === 'studio' ? 'studio' : (hasProFeatures(req.authUser) ? 'pro' : 'basic')))
      : 'guest';

    res.json({
      success: true,
      directories: allItems,
      totalCount: allItems.length,
      isPreview: false,
      tier: tierLabel,
      source: result.source,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Phase C: Workspace Bootstrap Endpoint (Pure Non-Executable JSON Gated by Verified JWT + Tier)
const WORKSPACE_BOOTSTRAP_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
app.get('/api/workspace/bootstrap', requireVerifiedAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const authUser = req.authUser!;
    const token = extractBearerToken(req) || undefined;
    const isPro = hasProFeatures(authUser);
    const isUnlimited = isUnlimitedTier(authUser);
    const tier: PlanTier = isUnlimited ? 'unlimited' : (authUser.tier === 'studio' ? 'studio' : (isPro ? 'pro' : 'basic'));
    const catalogTier: 'basic' | 'pro' = isPro ? 'pro' : 'basic';
    const campaignLimit = authUser.role === 'admin' ? null : (tier === 'unlimited' ? PLAN_SPECS.agency.productLimit : (tier === 'studio' ? PLAN_SPECS.studio.productLimit : (isPro ? PLAN_SPECS.pro.productLimit : PLAN_SPECS.free.productLimit)));
    const storageLimitBytes = getStorageQuotaBytesForTier(tier);
    const storageUsedBytes = await getUserStorageUsageBytes(authUser.userId, token);

    const dirResult = await loadDirectories(false);
    const allDirs = dirResult.items || [];
    const directoryLists = buildDirectoryListsByCategory(allDirs);
    const selectorRecipes = getWorkspaceSelectorRecipes(catalogTier);
    const randomnessDicts = getWorkspaceRandomnessDicts(catalogTier);

    let promptRecipes: Array<{ id: string; name: string; system_instruction: string; temperature: number }> = [];
    if (isPro) {
      try {
        const templates = await loadPromptTemplates();
        promptRecipes = (Array.isArray(templates) ? templates : []).map((t: any) => ({
          id: String(t.id || ''),
          name: String(t.name || t.id || 'Prompt Recipe'),
          system_instruction: String(t.system_instruction || ''),
          temperature: Number(t.temperature ?? 0.7),
        }));
      } catch {
        promptRecipes = getDefaultPrompts().map((t: any) => ({
          id: String(t.id || ''),
          name: String(t.name || t.id || 'Prompt Recipe'),
          system_instruction: String(t.system_instruction || ''),
          temperature: Number(t.temperature ?? 0.7),
        }));
      }
    }

    const syncedAt = new Date().toISOString();
    res.json({
      success: true,
      version: '1.4.0',
      userId: authUser.userId,
      tier,
      role: authUser.role,
      isPro,
      isUnlimited,
      campaignLimit,
      billingInterval: authUser.billingInterval || 'monthly',
      subscriptionStatus: authUser.subscriptionStatus || 'inactive',
      currentPeriodEnd: authUser.currentPeriodEnd || null,
      cancelAtPeriodEnd: Boolean(authUser.cancelAtPeriodEnd),
      storageUsedBytes,
      storageLimitBytes,
      syncedAt,
      expiresAt: Date.now() + WORKSPACE_BOOTSTRAP_TTL_MS,
      ttlMs: WORKSPACE_BOOTSTRAP_TTL_MS,
      totalAvailableDirectories: allDirs.length,
      directoryCount: allDirs.length,
      isPreview: false,
      directories: allDirs,
      directoryLists,
      selectorRecipes,
      promptRecipes,
      randomnessDicts,
      source: dirResult.source,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Workspace bootstrap failed' });
  }
});

// Public Read: Extension Releases (Latest + Previous Versions)
app.get('/api/releases', async (_req: Request, res: Response) => {
  try {
    const result = await loadReleases();
    res.json({ success: true, releases: result.items, source: result.source });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Public Read: New Features & Bug Fixes Changelog
app.get('/api/changelog', async (_req: Request, res: Response) => {
  try {
    const result = await loadChangelog();
    res.json({ success: true, entries: result.items, source: result.source });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// User Workspace Prefs (Bookmarks, Custom Directories, Research Alerts Config)
app.get('/api/user/workspace', requireVerifiedAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const requestedUserId = String(req.query.userId || req.authUser?.userId || '').trim();
    const token = extractBearerToken(req) || undefined;
    if (!requestedUserId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    if (req.authUser?.role !== 'admin' && req.authUser?.userId !== requestedUserId) {
      return res.status(403).json({ success: false, error: 'Access denied for requested workspace' });
    }
    const prefs = await loadUserWorkspacePrefs(requestedUserId, token);
    res.json({ success: true, prefs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/user/workspace', requireVerifiedAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { userId, bookmarked_directory_ids, custom_directories, research_config } = req.body || {};
    const targetUserId = String(userId || req.authUser?.userId || '').trim();
    const token = extractBearerToken(req) || undefined;
    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    if (req.authUser?.role !== 'admin' && req.authUser?.userId !== targetUserId) {
      return res.status(403).json({ success: false, error: 'Access denied for target workspace' });
    }
    const prefs = await saveUserWorkspacePrefs(
      targetUserId,
      { bookmarked_directory_ids, custom_directories, research_config },
      token
    );
    res.json({ success: true, prefs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Full Web-Mode User Cloud State (Campaigns, Settings, Completed URLs, Logs, Prefs)
app.get('/api/user/cloud-state', requireVerifiedAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const requestedUserId = String(req.query.userId || req.authUser?.userId || '').trim();
    const token = extractBearerToken(req) || undefined;
    if (!requestedUserId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    if (req.authUser?.role !== 'admin' && req.authUser?.userId !== requestedUserId) {
      return res.status(403).json({ success: false, error: 'Access denied for requested cloud state' });
    }
    const cloudState = await loadUserCloudState(requestedUserId, token);
    res.json({ success: true, ...cloudState });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/user/cloud-state', requireVerifiedAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const body = req.body || {};
    const targetUserId = String(body.userId || req.authUser?.userId || '').trim();
    const token = extractBearerToken(req) || undefined;
    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    if (req.authUser?.role !== 'admin' && req.authUser?.userId !== targetUserId) {
      return res.status(403).json({ success: false, error: 'Access denied for target cloud state' });
    }

    const storageLimitBytes = getStorageQuotaBytesForTier(req.authUser?.tier || 'basic');
    if (Array.isArray(body.brands) && body.brands.length > 0) {
      const incomingTextBytes = calculateBrandsAssistantStorageBytes(body.brands);
      if (incomingTextBytes > 0) {
        const currentTotalBytes = await getUserStorageUsageBytes(targetUserId, token);
        const existingState = await loadUserCloudState(targetUserId, token);
        const prevTextBytes = calculateBrandsAssistantStorageBytes(existingState?.brands || []);
        const estimatedMediaBytes = Math.max(0, currentTotalBytes - prevTextBytes);
        const projectedTotalBytes = estimatedMediaBytes + incomingTextBytes;

        if (projectedTotalBytes > storageLimitBytes && incomingTextBytes > prevTextBytes) {
          const usedMb = (projectedTotalBytes / (1024 * 1024)).toFixed(1);
          const limitMb = Math.round(storageLimitBytes / (1024 * 1024));
          return res.status(413).json({
            success: false,
            quotaExceeded: true,
            storageUsedBytes: currentTotalBytes,
            storageLimitBytes,
            error: `Workspace storage quota exceeded (${usedMb} MB / ${limitMb} MB including AI chats & Vault). Delete old chats, Vault drafts, or images—or upgrade your plan.`,
          });
        }
      }
    }

    const result = await saveUserCloudState(targetUserId, body, token);
    const storageUsedBytes = await getUserStorageUsageBytes(
      targetUserId,
      token,
      Array.isArray(body.brands) && body.brands.length > 0 ? body.brands : undefined
    );
    res.json({
      ...result,
      storageUsedBytes,
      storageLimitBytes,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
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

function resolveVaultIdFromReq(req: Request): string {
  const headerId = String(req.headers['x-sp-vault-id'] || '').trim();
  if (/^[a-zA-Z0-9_-]{16,128}$/.test(headerId)) return headerId;
  const cookies = parseCookieHeader(req.headers.cookie);
  const cookieId = String(cookies.sp_vault_id || '').trim();
  if (/^[a-zA-Z0-9_-]{16,128}$/.test(cookieId)) return cookieId;
  return '';
}

function setVaultCookie(req: Request, res: Response, vaultId: string) {
  const isHttps = req.secure || String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
  const attrs = [
    `sp_vault_id=${encodeURIComponent(vaultId)}`,
    'Path=/',
    'Max-Age=31536000',
    'HttpOnly',
    isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax',
  ];
  res.setHeader('Set-Cookie', attrs.join('; '));
}

// Reinstall-Proof Per-Browser Extension Vault (Survives extension uninstall/reinstall even in Guest mode)
app.get('/api/extension/vault', (req: Request, res: Response) => {
  try {
    let vaultId = resolveVaultIdFromReq(req);
    if (!vaultId) {
      vaultId = `spv_${crypto.randomBytes(24).toString('hex')}`;
    }
    setVaultCookie(req, res, vaultId);
    const record = loadExtensionVault(vaultId);
    res.json({
      success: true,
      vaultId,
      snapshot: record?.snapshot || null,
      updatedAt: record?.updatedAt || null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Vault load failed' });
  }
});

app.post('/api/extension/vault', (req: Request, res: Response) => {
  try {
    let vaultId = resolveVaultIdFromReq(req);
    if (!vaultId) {
      vaultId = `spv_${crypto.randomBytes(24).toString('hex')}`;
    }
    setVaultCookie(req, res, vaultId);
    const snapshot = req.body?.snapshot && typeof req.body.snapshot === 'object' ? req.body.snapshot : (req.body || {});
    const saved = saveExtensionVault(vaultId, snapshot);
    res.json({
      success: true,
      vaultId,
      updatedAt: saved.updatedAt,
      preservedExisting: Boolean(saved.preservedExisting),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Vault save failed' });
  }
});

// Brand Media Asset Usage, Upload & Delete (Tier-Quota Enforced on Supabase Storage 'brand-assets')
app.get('/api/user/media/usage', requireVerifiedAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const authUser = req.authUser!;
    const token = extractBearerToken(req) || undefined;
    const storageUsedBytes = await getUserStorageUsageBytes(authUser.userId, token);
    const storageLimitBytes = getStorageQuotaBytesForTier(authUser.tier);
    res.json({
      success: true,
      tier: authUser.tier,
      storageUsedBytes,
      storageLimitBytes,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/user/media', requireVerifiedAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { userId, dataUrl, filename } = req.body || {};
    const targetUserId = String(userId || req.authUser?.userId || '').trim();
    const token = extractBearerToken(req) || undefined;
    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    if (req.authUser?.role !== 'admin' && req.authUser?.userId !== targetUserId) {
      return res.status(403).json({ success: false, error: 'Access denied for target user media' });
    }
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return res.status(400).json({ success: false, error: 'Valid image dataUrl is required' });
    }
    const uploaded = await uploadUserBrandMedia(
      targetUserId,
      dataUrl,
      String(filename || 'asset.webp'),
      token,
      req.authUser?.tier || 'basic'
    );
    if (!uploaded.success) {
      return res.status(uploaded.status || 400).json(uploaded);
    }
    res.json(uploaded);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/user/media', requireVerifiedAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { url, path: assetPath } = req.body || {};
    const targetUrl = String(assetPath || url || req.query.url || req.query.path || '').trim();
    const authUser = req.authUser!;
    const token = extractBearerToken(req) || undefined;
    if (!targetUrl) {
      return res.status(400).json({ success: false, error: 'Media url or path is required' });
    }
    const deleted = await deleteUserBrandMedia(authUser.userId, targetUrl, token);
    const storageUsedBytes = await getUserStorageUsageBytes(authUser.userId, token);
    const storageLimitBytes = getStorageQuotaBytesForTier(authUser.tier);
    res.json({
      success: deleted.success,
      deletedPath: deleted.deletedPath || null,
      storageUsedBytes,
      storageLimitBytes,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Research Discovery RSS Proxy (Auth-Gated + 10-Min TTL Response Cache; Extension does zero-cost browser-IP fetching)
const RESEARCH_FEED_CACHE_TTL_MS = 10 * 60 * 1000;
const researchFeedCache = new Map<string, { expiresAt: number; payload: any }>();

app.post('/api/research/fetch-feeds', requireVerifiedAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { keywords, competitorQueries, platforms, alertFeeds, quality, timeframe } = req.body || {};
    const validTimeframe =
      timeframe === '24h' || timeframe === 'week' || timeframe === 'month' || timeframe === 'all'
        ? timeframe
        : 'week';
    const normInput = {
      keywords: (Array.isArray(keywords) ? keywords : []).map((x: any) => String(x || '').trim()).filter(Boolean).sort(),
      competitorQueries: (Array.isArray(competitorQueries) ? competitorQueries : []).map((x: any) => String(x || '').trim()).filter(Boolean).sort(),
      platforms: platforms && typeof platforms === 'object'
        ? Object.keys(platforms).sort().reduce((acc: Record<string, any>, k) => {
            acc[k] = Boolean((platforms as any)[k]);
            return acc;
          }, {})
        : {},
      alertFeeds: (Array.isArray(alertFeeds) ? alertFeeds : []).map((f: any) => (typeof f === 'string' ? f.trim() : String(f?.url || '').trim())).filter(Boolean).sort(),
      quality: quality === 'all' ? 'all' : 'best',
      timeframe: validTimeframe,
    };
    const cacheKey = JSON.stringify(normInput);
    const cached = researchFeedCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return res.json({ success: true, cached: true, ...cached.payload });
    }
    const result = await runResearchDiscovery({
      keywords: Array.isArray(keywords) ? keywords : [],
      competitorQueries: Array.isArray(competitorQueries) ? competitorQueries : [],
      platforms: platforms && typeof platforms === 'object' ? platforms : {},
      alertFeeds: Array.isArray(alertFeeds) ? alertFeeds : [],
      quality: quality === 'all' ? 'all' : 'best',
      timeframe: validTimeframe,
    });
    if (researchFeedCache.size >= 200) {
      const oldestKey = researchFeedCache.keys().next().value;
      if (oldestKey) researchFeedCache.delete(oldestKey);
    }
    researchFeedCache.set(cacheKey, { expiresAt: now + RESEARCH_FEED_CACHE_TTL_MS, payload: result });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, threads: [] });
  }
});

function buildOpportunitySuggestionsFallback(opts: {
  brandName: string;
  brandUrl: string;
  brandTagline: string;
  brandDescription: string;
  brandCategory: string;
  seedNiche: string;
  landingTitle: string;
  landingDescription: string;
}) {
  const {
    brandName,
    brandTagline,
    brandDescription,
    brandCategory,
    seedNiche,
    landingTitle,
    landingDescription,
  } = opts;

  const rawText = [seedNiche, brandTagline, landingTitle, brandDescription, landingDescription, brandCategory]
    .filter(Boolean)
    .join(' ');
  const cleanTitle = String(seedNiche || brandTagline || landingTitle || brandCategory || brandName || 'productivity software')
    .replace(/https?:\/\/\S+/gi, '')
    .split(/[|—–]/)[0]
    .trim();
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'are', 'our', 'all', 'get',
    'into', 'more', 'how', 'what', 'best', 'tool', 'tools', 'app', 'software', 'platform', 'site',
    'com', 'www', 'http', 'https', 'without', 'using', 'make', 'build', 'built', 'help', 'helps',
    'will', 'can', 'just', 'like', 'than', 'have', 'has', 'about', 'into', 'over', 'very',
  ]);
  const tokens = rawText
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stopWords.has(w));
  const freq: Record<string, { count: number; firstIdx: number }> = {};
  tokens.forEach((t, idx) => {
    if (!freq[t]) freq[t] = { count: 0, firstIdx: idx };
    freq[t].count += 1;
  });
  const topTerms = Object.entries(freq)
    .sort((a, b) => (b[1].count - a[1].count) || (a[1].firstIdx - b[1].firstIdx))
    .slice(0, 6)
    .sort((a, b) => a[1].firstIdx - b[1].firstIdx)
    .map(([w]) => w);

  const coreTopic = (seedNiche || topTerms.slice(0, 2).join(' ') || brandCategory || 'workflow automation').trim();
  const secondaryTopic = topTerms.slice(2, 4).join(' ') || coreTopic;

  const keywords = Array.from(new Set([
    `best ${coreTopic} tool`,
    `${coreTopic} recommendation`,
    `looking for ${coreTopic} software`,
    `how to improve ${coreTopic}`,
    `${coreTopic} alternatives`,
    `${coreTopic} workflow tips`,
    secondaryTopic && secondaryTopic !== coreTopic ? `best ${secondaryTopic} tools` : `top ${coreTopic} apps`,
    `anyone using ${coreTopic}`,
    `${coreTopic} vs manual workflow`,
    `free ${coreTopic} tool`,
  ].map((k) => k.replace(/\s+/g, ' ').trim()).filter((k) => k.length > 4)));

  const catLower = `${brandCategory} ${rawText}`.toLowerCase();
  let competitors: Array<{ name: string; reason: string }> = [];
  if (/(pomodoro|focus|timer|deep work|productivity|task|todo|habit|time track)/.test(catLower)) {
    competitors = [
      { name: 'Forest', reason: 'Popular gamified focus timer' },
      { name: 'Pomofocus', reason: 'Minimal web Pomodoro timer' },
      { name: 'Toggl Track', reason: 'Time tracking & work blocks' },
      { name: 'Centered', reason: 'Flow-state focus sessions' },
      { name: 'Sunsama', reason: 'Daily planning & focus rituals' },
      { name: 'Motion', reason: 'Automated calendar scheduling' },
    ];
  } else if (/(outreach|cold email|lead gen|contact form|directory|marketing|seo|backlink|growth|social)/.test(catLower)) {
    competitors = [
      { name: 'Instantly', reason: 'Cold email outreach automation' },
      { name: 'Smartlead', reason: 'Multi-inbox outreach platform' },
      { name: 'Apollo.io', reason: 'B2B lead & outreach database' },
      { name: 'Lemlist', reason: 'Personalized outbound sequences' },
      { name: 'GummySearch', reason: 'Reddit audience & lead discovery' },
      { name: 'Syften', reason: 'Social keyword alert monitoring' },
    ];
  } else if (/(finance|stock|trading|invest|crypto|chart|portfolio)/.test(catLower)) {
    competitors = [
      { name: 'TradingView', reason: 'Market charting & community' },
      { name: 'Seeking Alpha', reason: 'Stock research & analysis' },
      { name: 'Finviz', reason: 'Stock screener & market maps' },
      { name: 'Simply Wall St', reason: 'Visual equity research' },
      { name: 'Koyfin', reason: 'Market analytics dashboard' },
      { name: 'Yahoo Finance', reason: 'Retail portfolio tracking' },
    ];
  } else {
    competitors = [
      { name: 'Product Hunt', reason: 'Launch & discovery community' },
      { name: 'AlternativeTo', reason: 'Software comparison directory' },
      { name: 'G2', reason: 'Buyer software reviews' },
      { name: 'Capterra', reason: 'SaaS category comparisons' },
      { name: 'Zapier', reason: 'Workflow automation ecosystem' },
      { name: 'Notion', reason: 'All-in-one team workspace' },
    ];
  }

  const brandLower = String(brandName || '').toLowerCase();
  competitors = competitors.filter((c) => c.name.toLowerCase() !== brandLower);

  return {
    nicheSummary: cleanTitle.slice(0, 72) || 'Niche Discovery',
    keywords: keywords.slice(0, 10),
    competitors: competitors.slice(0, 6),
  };
}

// AI Niche Keyword & Competitor Populator ("Fetch" in Opportunities)
const handleSuggestOpportunities = async (req: AuthedRequest, res: Response) => {
  try {
    const {
      brand = {},
      seedNiche = '',
      existingKeywords = [],
      existingCompetitors = [],
      openRouterKey = '',
      geminiApiKey = '',
      aiModel = '',
    } = req.body || {};

    const firstNonEmpty = (arr: any): string => {
      if (!Array.isArray(arr)) return '';
      for (const item of arr) {
        const txt = String(typeof item === 'string' ? item : item?.text || '').trim();
        if (txt) return txt;
      }
      return '';
    };

    const brandName = String(
      brand?.name || brand?.brandName || brand?.directory?.productName || ''
    ).trim();
    const rawBrandUrl = String(
      brand?.url ||
      brand?.website ||
      brand?.websiteUrl ||
      brand?.directory?.websiteUrl ||
      brand?.contact?.website ||
      brand?.directory?.demoUrl ||
      ''
    ).trim();
    const parsedBrandUrl = rawBrandUrl ? isPublicHttpUrl(rawBrandUrl) : null;
    const brandUrl = parsedBrandUrl ? parsedBrandUrl.href : rawBrandUrl;

    const brandTagline = String(
      brand?.tagline ||
      firstNonEmpty(brand?.directory?.taglines) ||
      firstNonEmpty(brand?.directory?.pitches) ||
      ''
    ).trim();
    const brandDescription = String(
      brand?.description ||
      brand?.pitch ||
      firstNonEmpty(brand?.directory?.descriptions) ||
      firstNonEmpty(brand?.directory?.summaries) ||
      firstNonEmpty(brand?.contact?.messages) ||
      brand?.contact?.message ||
      ''
    ).trim();
    const brandCategory = String(brand?.category || brand?.directory?.category || '').trim();
    const cleanSeed = String(seedNiche || '').trim();

    let landing = {
      metaTitle: '',
      metaDescription: '',
      heroHeadline: '',
      heroText: '',
      headings: [] as string[],
      bodyCopy: '',
    };

    if (parsedBrandUrl && (!brandTagline || !brandDescription)) {
      try {
        const scanned = await fetchWebsiteCopy(parsedBrandUrl.href);
        if (scanned.success && scanned.context) {
          landing = {
            metaTitle: String(scanned.context.metaTitle || scanned.context.title || '').trim(),
            metaDescription: String(scanned.context.metaDescription || scanned.context.description || '').trim(),
            heroHeadline: String(scanned.context.heroHeadline || '').trim(),
            heroText: String(scanned.context.heroText || '').trim(),
            headings: Array.isArray(scanned.context.headings) ? scanned.context.headings.slice(0, 10) : [],
            bodyCopy: String(scanned.context.bodyCopy || '').trim(),
          };
        }
      } catch (scanErr: any) {
        console.warn('[SuggestOpportunities] Optional URL scan skipped:', scanErr?.message || scanErr);
      }
    }

    const hasSignal = Boolean(
      brandName ||
      brandUrl ||
      brandTagline ||
      brandDescription ||
      cleanSeed ||
      landing.metaTitle ||
      landing.metaDescription
    );

    if (!hasSignal) {
      return res.status(400).json({
        success: false,
        error: 'Add a Campaign Website URL, Product Description, or Niche Seed first so AI can discover keywords and competitors.',
      });
    }

    const existingKwSet = new Set(
      (Array.isArray(existingKeywords) ? existingKeywords : [])
        .map((k: any) => String(k || '').trim().toLowerCase())
        .filter(Boolean)
    );
    const existingCompSet = new Set(
      (Array.isArray(existingCompetitors) ? existingCompetitors : [])
        .map((c: any) => String(typeof c === 'string' ? c : c?.name || '').trim().toLowerCase())
        .filter(Boolean)
    );

    const contextBrief = [
      `CAMPAIGN PROFILE:`,
      `- Product / Brand Name: ${brandName || 'N/A'}`,
      `- Website URL: ${brandUrl || 'N/A'}`,
      `- Category: ${brandCategory || 'N/A'}`,
      `- Tagline: ${brandTagline || 'N/A'}`,
      `- Description: ${brandDescription || 'N/A'}`,
      cleanSeed ? `- User Niche / Focus Seed: ${cleanSeed}` : '',
      ``,
      `WEBSITE CONTEXT:`,
      `- Meta Title: ${landing.metaTitle || 'N/A'}`,
      `- Meta Description: ${landing.metaDescription || 'N/A'}`,
      `- Hero Headline: ${landing.heroHeadline || 'N/A'}`,
      `- Hero Copy: ${landing.heroText || 'N/A'}`,
      `- Body Excerpt: ${landing.bodyCopy ? landing.bodyCopy.slice(0, 1600) : 'N/A'}`,
      existingKwSet.size ? `\nALREADY SAVED KEYWORDS (do not repeat): ${Array.from(existingKwSet).slice(0, 20).join(', ')}` : '',
      existingCompSet.size ? `\nALREADY SAVED COMPETITORS (do not repeat): ${Array.from(existingCompSet).slice(0, 15).join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const systemInstruction = `You are a practical buyer-intent research strategist helping a founder find live discussions and Google Alert feeds where ideal customers ask for recommendations, compare alternatives, or talk about problems this product solves.

Generate:
1. nicheSummary: Short 3-7 word description of the niche/market.
2. keywords: 10 specific, high-intent search phrases (2-6 words each) that real buyers/users type or post on Reddit, X/Twitter, YouTube, and forums (e.g. pain points, "best tool for ...", "how to ...", tool category requests). Do NOT include quotes, boolean operators (no site: or OR), or the user's own brand name. Do NOT repeat already saved keywords.
3. competitors: 6 to 8 real, well-known competing products, direct alternatives, or popular websites/tools in this exact niche. Each item must have "name" (clean product/brand name only, never the user's own brand) and "reason" (concise 3-7 word explanation of why it competes or overlaps). Do NOT repeat already saved competitors.

Return strictly valid JSON matching the schema.`;

    const userOrKey = String(openRouterKey || '').trim();
    const userGeminiKey = String(geminiApiKey || '').trim();
    let parsed: any = null;
    let source = 'local-niche-synthesis';

    if (userOrKey) {
      try {
        const orModel = String(aiModel || '').trim() || 'deepseek/deepseek-chat';
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userOrKey}`,
            'HTTP-Referer': 'https://smartposter.pro',
            'X-Title': 'Smart Poster Opportunities Fetch',
          },
          body: JSON.stringify({
            model: orModel,
            messages: [
              { role: 'system', content: systemInstruction },
              {
                role: 'user',
                content: `${contextBrief}\n\nReturn ONLY JSON: { "nicheSummary": "...", "keywords": ["..."], "competitors": [{ "name": "...", "reason": "..." }] }`,
              },
            ],
            temperature: 0.6,
            max_tokens: 1400,
          }),
        });
        if (orRes.ok) {
          const orData: any = await orRes.json();
          const raw = String(orData?.choices?.[0]?.message?.content || '').trim();
          const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
          const firstBrace = clean.indexOf('{');
          const lastBrace = clean.lastIndexOf('}');
          const slice = firstBrace !== -1 && lastBrace > firstBrace ? clean.slice(firstBrace, lastBrace + 1) : clean;
          const candidate = JSON.parse(slice);
          if (candidate && typeof candidate === 'object') {
            parsed = candidate;
            source = `openrouter (${orModel})`;
          }
        }
      } catch (orErr: any) {
        console.warn('[SuggestOpportunities] OpenRouter failed, checking Gemini BYOK / local synthesis:', orErr?.message || orErr);
      }
    }

    if (!parsed && userGeminiKey) {
      try {
        const gemRes = await callUserGeminiRest({
          apiKey: userGeminiKey,
          model: aiModel,
          systemInstruction,
          prompt: `${contextBrief}\n\nReturn ONLY JSON: { "nicheSummary": "...", "keywords": ["..."], "competitors": [{ "name": "...", "reason": "..." }] }`,
          temperature: 0.6,
          maxOutputTokens: 1600,
          jsonMode: true,
        });
        if (gemRes.ok && gemRes.text) {
          const clean = gemRes.text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
          const firstBrace = clean.indexOf('{');
          const lastBrace = clean.lastIndexOf('}');
          const slice = firstBrace !== -1 && lastBrace > firstBrace ? clean.slice(firstBrace, lastBrace + 1) : clean;
          const candidate = JSON.parse(slice);
          if (candidate && typeof candidate === 'object') {
            parsed = candidate;
            source = `gemini-byok (${gemRes.model})`;
          }
        }
      } catch (gemErr: any) {
        console.warn('[SuggestOpportunities] Gemini BYOK failed, using niche fallback:', gemErr?.message || gemErr);
      }
    }

    if (!parsed) {
      parsed = buildOpportunitySuggestionsFallback({
        brandName,
        brandUrl,
        brandTagline,
        brandDescription,
        brandCategory,
        seedNiche: cleanSeed,
        landingTitle: landing.metaTitle,
        landingDescription: landing.metaDescription,
      });
      source = 'local-niche-synthesis';
    }

    const brandLower = brandName.toLowerCase();
    const seenKw = new Set<string>(existingKwSet);
    const cleanKeywords: string[] = [];
    for (const rawKw of Array.isArray(parsed.keywords) ? parsed.keywords : []) {
      const kw = String(rawKw || '').replace(/^["'\s-]+|["'\s]+$/g, '').replace(/\s+/g, ' ').trim();
      const lower = kw.toLowerCase();
      if (!kw || kw.length < 3 || seenKw.has(lower)) continue;
      seenKw.add(lower);
      cleanKeywords.push(kw);
      if (cleanKeywords.length >= 12) break;
    }

    const seenComp = new Set<string>(existingCompSet);
    if (brandLower) seenComp.add(brandLower);
    const cleanCompetitors: Array<{ name: string; reason: string }> = [];
    for (const rawComp of Array.isArray(parsed.competitors) ? parsed.competitors : []) {
      const name = String(typeof rawComp === 'string' ? rawComp : rawComp?.name || '').replace(/\s+/g, ' ').trim();
      const reason = String(typeof rawComp === 'object' ? rawComp?.reason || '' : '').replace(/\s+/g, ' ').trim() || 'Niche competitor';
      const lower = name.toLowerCase();
      if (!name || name.length < 2 || seenComp.has(lower)) continue;
      seenComp.add(lower);
      cleanCompetitors.push({ name, reason });
      if (cleanCompetitors.length >= 8) break;
    }

    res.json({
      success: true,
      nicheSummary: String(parsed.nicheSummary || cleanSeed || brandCategory || brandName || 'Niche Opportunities').trim(),
      keywords: cleanKeywords,
      competitors: cleanCompetitors,
      source,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to suggest niche opportunities' });
  }
};

app.post('/api/research/suggest-opportunities', optionalVerifiedAuth, handleSuggestOpportunities);
app.post('/api/ai/suggest-opportunities', optionalVerifiedAuth, handleSuggestOpportunities);

// Admin CRUD: Directory Database
app.get('/api/admin/directories', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const result = await loadDirectories(true);
    res.json({ success: true, directories: result.items, source: result.source });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/directories', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (Array.isArray(body) || Array.isArray(body?.directories)) {
      const list = Array.isArray(body) ? body : body.directories;
      const result = await upsertDirectoriesBulk(list);
      return res.json({ success: true, directories: result.items, count: result.items.length, source: result.source });
    }
    const result = await upsertDirectory(body || {});
    res.json({ success: true, directory: result.item, source: result.source });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/directories/bulk', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const list = Array.isArray(req.body) ? req.body : (Array.isArray(req.body?.directories) ? req.body.directories : []);
    if (list.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one directory link is required' });
    }
    const result = await upsertDirectoriesBulk(list);
    res.json({ success: true, directories: result.items, count: result.items.length, source: result.source });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/directories/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    await deleteDirectory(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin CRUD: Extension Releases
app.get('/api/admin/releases', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const result = await loadReleases();
    res.json({ success: true, releases: result.items, source: result.source });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/releases', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const result = await upsertRelease(req.body || {});
    res.json({ success: true, release: result.item, source: result.source });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/releases/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    await deleteRelease(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin CRUD: New Features & Bug Fixes Changelog
app.get('/api/admin/changelog', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const result = await loadChangelog();
    res.json({ success: true, entries: result.items, source: result.source });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/changelog', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const result = await upsertChangelog(req.body || {});
    res.json({ success: true, entry: result.item, source: result.source });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/changelog/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    await deleteChangelog(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const DEFAULT_OG_ORIGIN = 'https://smartposter.pro';

function resolvePublicOrigin(req: Request): string {
  const configured = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  const protoHeader = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!hostHeader) return DEFAULT_OG_ORIGIN;
  const proto = protoHeader || 'https';
  return `${proto}://${hostHeader}`.replace(/\/+$/, '');
}

function applyOpenGraphOrigin(html: string, origin: string): string {
  if (!origin || origin === DEFAULT_OG_ORIGIN) return html;
  return html.split(DEFAULT_OG_ORIGIN).join(origin);
}

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(__dirname, 'dist');
    const serveProdIndex = (req: Request, res: Response) => {
      const indexPath = path.join(distDir, 'index.html');
      try {
        const rawHtml = fs.readFileSync(indexPath, 'utf-8');
        const html = applyOpenGraphOrigin(rawHtml, resolvePublicOrigin(req));
        res.status(200).type('html').send(html);
      } catch {
        res.sendFile(indexPath);
      }
    };

    app.get(['/', '/index.html'], serveProdIndex);
    app.get(['/opengraph', '/opengraph.html', '/opengrapgh'], (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'opengrapgh.html'));
    });
    app.get(['/auth/callback', '/auth/callback.html'], (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'auth', 'callback.html'));
    });
    app.use(express.static(distDir, { index: false, extensions: ['html'] }));
    app.use('/assets', express.static(path.join(__dirname, 'assets')));
    app.get('*', serveProdIndex);
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0' },
      appType: 'spa',
    });

    app.get(['/', '/index.html'], async (req: Request, res: Response, next) => {
      try {
        const rawHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        const html = applyOpenGraphOrigin(transformed, resolvePublicOrigin(req));
        res.status(200).type('html').send(html);
      } catch (err) {
        next(err);
      }
    });

    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Poster app listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
