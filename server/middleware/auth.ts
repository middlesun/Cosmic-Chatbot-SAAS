import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { getClientIpHash } from '../services/abuseGuard';

export const PRIMARY_ADMIN_EMAIL = 'fintasticapps@gmail.com';

export function isPrimaryAdminEmail(email?: string | null): boolean {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return false;
  const envAdmin = (process.env.PRIMARY_ADMIN_EMAIL || '').trim().toLowerCase();
  return normalized === PRIMARY_ADMIN_EMAIL || (Boolean(envAdmin) && normalized === envAdmin);
}

export interface AppUserRecord {
  id: string;
  email: string;
  full_name: string | null;
  tier: 'personal' | 'pro' | 'guru';
  credits_balance: number;
  currency_pref: 'INR' | 'USD' | 'AED' | 'EUR';
  default_expert: string;
  default_output: string;
  default_language: string;
  preferred_call_name?: string | null;
  chat_font_size?: 'sm' | 'base' | 'lg' | null;
  signup_ip_hash?: string | null;
  last_ip_hash?: string | null;
  referral_code: string;
  referred_by: string | null;
  must_change_password: boolean;
  is_admin: boolean;
  account_status: 'active' | 'suspended';
  location_country: string | null;
  location_city: string | null;
  last_active_at: string | null;
  created_at: string;
}

export interface AuthenticatedRequest extends Request {
  authUser?: {
    id: string;
    email: string;
  };
  appUser?: AppUserRecord;
  clientIpHash?: string | null;
}

const ipSyncCache = new Map<string, { hash: string; syncedAt: number }>();
const IP_SYNC_DEBOUNCE_MS = 10 * 60 * 1000;

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(503).json({
      error: 'Supabase backend credentials are not configured yet.',
      code: 'SUPABASE_NOT_CONFIGURED',
    });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) {
      res.status(401).json({ error: 'Invalid or expired session token' });
      return;
    }

    const ipHash = getClientIpHash(req);
    req.clientIpHash = ipHash;
    req.authUser = {
      id: authData.user.id,
      email: authData.user.email || '',
    };

    let { data: appUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (userError) {
      console.error('[auth] Failed to load user account from public.users:', {
        code: userError.code,
        message: userError.message,
        details: userError.details,
        hint: userError.hint,
      });
      res.status(500).json({
        error: userError.code
          ? `Failed to load user account (${userError.code}: ${userError.message})`
          : `Failed to load user account (${userError.message || 'database error'})`,
        code: userError.code,
        details: userError.message,
      });
      return;
    }

    const isPrimaryAdmin = isPrimaryAdminEmail(authData.user.email);

    // Fallback bootstrap if user existed in auth.users before trigger migration ran
    if (!appUser) {
      const { getPricingConfig } = await import('../services/platformSettings');
      const pricing = await getPricingConfig();
      const welcomeCredits = pricing.signup_welcome_credits;
      const randomCode = `CC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const baseInsert = {
        id: authData.user.id,
        email: authData.user.email || '',
        full_name:
          (authData.user.user_metadata?.full_name as string) ||
          authData.user.email?.split('@')[0] ||
          'Member',
        credits_balance: welcomeCredits,
        referral_code: randomCode,
        is_admin: isPrimaryAdmin,
        must_change_password: Boolean(authData.user.user_metadata?.must_change_password),
      };

      let { data: inserted, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          ...baseInsert,
          ...(ipHash ? { signup_ip_hash: ipHash, last_ip_hash: ipHash } : {}),
        })
        .select('*')
        .single();

      if (insertError && ipHash) {
        // Safe fallback if 002_v2_foundations.sql columns aren't migrated yet
        const retry = await supabaseAdmin
          .from('users')
          .insert(baseInsert)
          .select('*')
          .single();
        inserted = retry.data;
        insertError = retry.error;
      }

      if (insertError || !inserted) {
        console.error('[auth] Failed to initialize user record in public.users:', {
          code: insertError?.code,
          message: insertError?.message,
          details: insertError?.details,
          hint: insertError?.hint,
        });
        res.status(500).json({
          error: insertError?.code
            ? `Failed to initialize user record (${insertError.code}: ${insertError.message})`
            : 'Failed to initialize user record',
          code: insertError?.code,
          details: insertError?.message,
        });
        return;
      }

      if (welcomeCredits > 0) {
        await supabaseAdmin.from('credit_transactions').insert({
          user_id: inserted.id,
          amount: welcomeCredits,
          balance_after: welcomeCredits,
          tx_type: 'welcome_bonus',
          reference_id: inserted.id,
          description: `Welcome bonus — ${welcomeCredits.toLocaleString()} free signup credits`,
        });
      }

      appUser = inserted;
    } else {
      // Idempotent welcome-credit grant if trigger created user at 0 before migration 003 ran
      const createdRecently =
        Date.now() - new Date(appUser.created_at).getTime() < 15 * 60 * 1000;
      if (appUser.credits_balance === 0 && createdRecently) {
        const { count: txCount } = await supabaseAdmin
          .from('credit_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', appUser.id);
        if (txCount === 0) {
          const { getPricingConfig } = await import('../services/platformSettings');
          const pricing = await getPricingConfig();
          const welcomeCredits = pricing.signup_welcome_credits;
          if (welcomeCredits > 0) {
            const { data: nextBal, error: grantErr } = await supabaseAdmin.rpc(
              'grant_user_credits',
              {
                p_user_id: appUser.id,
                p_amount: welcomeCredits,
                p_tx_type: 'welcome_bonus',
                p_reference_id: appUser.id,
                p_description: `Welcome bonus — ${welcomeCredits.toLocaleString()} free signup credits`,
              }
            );
            if (!grantErr && typeof nextBal === 'number') {
              appUser.credits_balance = nextBal;
            }
          }
        }
      }

      if (ipHash) {
        const needsSignupHash = !appUser.signup_ip_hash;
        const needsLastHash = appUser.last_ip_hash !== ipHash;
        if (needsSignupHash || needsLastHash) {
          const cached = ipSyncCache.get(appUser.id);
          const now = Date.now();
          if (!cached || cached.hash !== ipHash || now - cached.syncedAt > IP_SYNC_DEBOUNCE_MS) {
            ipSyncCache.set(appUser.id, { hash: ipHash, syncedAt: now });
            const ipUpdates: Record<string, string> = { last_ip_hash: ipHash };
            if (needsSignupHash) {
              ipUpdates.signup_ip_hash = ipHash;
              appUser.signup_ip_hash = ipHash;
            }
            appUser.last_ip_hash = ipHash;
            void Promise.resolve(
              supabaseAdmin.from('users').update(ipUpdates).eq('id', appUser.id)
            ).catch(() => null);
          }
        }
      }
      if (isPrimaryAdmin && (!appUser.is_admin || appUser.account_status !== 'active')) {
        const { error: promoteErr } = await supabaseAdmin
          .from('users')
          .update({
            is_admin: true,
            account_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', appUser.id);
        if (!promoteErr) {
          appUser.is_admin = true;
          appUser.account_status = 'active';
        }
      }
    }

    if (appUser.account_status === 'suspended') {
      res.status(403).json({ error: 'Account suspended. Please contact support.' });
      return;
    }

    req.appUser = appUser as AppUserRecord;
    next();
  } catch (err) {
    console.error('[auth] Unexpected error validating token:', err);
    res.status(500).json({ error: 'Authentication check failed' });
  }
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.appUser?.is_admin) {
    res.status(403).json({ error: 'Administrator access required' });
    return;
  }
  next();
};
