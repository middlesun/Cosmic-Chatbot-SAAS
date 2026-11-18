import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';

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
}

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
      res.status(500).json({ error: 'Failed to load user account' });
      return;
    }

    // Fallback bootstrap if user existed in auth.users before trigger migration ran
    if (!appUser) {
      const randomCode = `CC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authData.user.id,
          email: authData.user.email || '',
          full_name:
            (authData.user.user_metadata?.full_name as string) ||
            authData.user.email?.split('@')[0] ||
            'Member',
          referral_code: randomCode,
          must_change_password: Boolean(authData.user.user_metadata?.must_change_password),
        })
        .select('*')
        .single();

      if (insertError) {
        res.status(500).json({ error: 'Failed to initialize user record' });
        return;
      }
      appUser = inserted;
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
