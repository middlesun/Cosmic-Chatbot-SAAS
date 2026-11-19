import express, { type Express } from 'express';
import { getSupabaseAdmin, isSupabaseServerConfigured } from './lib/supabaseAdmin';
import { requireAuth, type AuthenticatedRequest } from './middleware/auth';
import profilesRouter from './routes/profiles';
import chatRouter from './routes/chat';
import paymentsRouter, { dodoWebhookMiddleware } from './routes/payments';
import radarRouter from './routes/radar';
import reportsRouter from './routes/reports';
import adminRouter from './routes/admin';
import { getOrFetchDailyTransits, isAstrologyApiConfigured } from './services/astrologyApi';
import { fetchSanityBlogPosts, isSanityConfigured } from '../lib/sanity';

export function createExpressApp(): Express {
  const app = express();

  // Dodo webhook needs raw body for HMAC-SHA256 verification before express.json()
  app.post('/api/payments/webhook', ...dodoWebhookMiddleware);

  app.use(express.json({ limit: '2mb' }));

  // Health & Environment readiness check (never exposes secret values)
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      integrations: {
        supabaseServer: isSupabaseServerConfigured(),
        supabaseClient: Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY),
        openrouter: Boolean(process.env.OPENROUTER_API_KEY),
        freeAstrologyApi: Boolean(process.env.FREE_ASTROLOGY_API_KEY),
        dodoPayments: Boolean(process.env.DODO_API_KEY),
        resend: Boolean(process.env.RESEND_API_KEY),
        sanityBlog: isSanityConfigured(),
      },
    });
  });

  // Current authenticated user record + activity ping
  app.get('/api/app/me', requireAuth, async (req: AuthenticatedRequest, res) => {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin || !req.appUser) {
      res.status(503).json({ error: 'Backend unavailable' });
      return;
    }

    // Best-effort location/activity tracking from headers (supports Cloudflare & Vercel headers)
    const countryHeader =
      (req.headers['cf-ipcountry'] as string) ||
      (req.headers['x-vercel-ip-country'] as string) ||
      null;
    const cityHeader = (req.headers['x-vercel-ip-city'] as string) || null;

    await supabaseAdmin
      .from('users')
      .update({
        last_active_at: new Date().toISOString(),
        ...(countryHeader && !req.appUser.location_country ? { location_country: countryHeader } : {}),
        ...(cityHeader && !req.appUser.location_city ? { location_city: decodeURIComponent(cityHeader) } : {}),
      })
      .eq('id', req.appUser.id);

    const { count: profileCount } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.appUser.id);

    const { count: referralCount } = await supabaseAdmin
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', req.appUser.id)
      .eq('status', 'rewarded');

    res.json({
      user: req.appUser,
      stats: {
        savedProfiles: profileCount || 0,
        successfulReferrals: referralCount || 0,
      },
    });
  });

  // Update user defaults (expert, output format, currency, display name)
  app.patch('/api/app/me/preferences', requireAuth, async (req: AuthenticatedRequest, res) => {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin || !req.appUser) {
      res.status(503).json({ error: 'Backend unavailable' });
      return;
    }

    const { full_name, currency_pref, default_expert, default_output, default_language } = req.body || {};
    const updates: Record<string, string> = {};

    if (typeof full_name === 'string' && full_name.trim()) {
      updates.full_name = full_name.trim().slice(0, 100);
    }
    if (['INR', 'USD', 'AED', 'EUR'].includes(currency_pref)) {
      updates.currency_pref = currency_pref;
    }
    if (typeof default_expert === 'string' && default_expert.trim()) {
      updates.default_expert = default_expert.trim();
    }
    if (typeof default_output === 'string' && default_output.trim()) {
      updates.default_output = default_output.trim();
    }
    if (typeof default_language === 'string' && default_language.trim()) {
      updates.default_language = default_language.trim();
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid preference fields supplied' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', req.appUser.id)
      .select('*')
      .single();

    if (error) {
      res.status(500).json({ error: 'Failed to update preferences' });
      return;
    }

    res.json({ user: data });
  });

  // Clear forced password reset flag after invited old client sets new password
  app.post('/api/app/me/password-completed', requireAuth, async (req: AuthenticatedRequest, res) => {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin || !req.appUser) {
      res.status(503).json({ error: 'Backend unavailable' });
      return;
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq('id', req.appUser.id);

    if (error) {
      res.status(500).json({ error: 'Failed to clear password requirement' });
      return;
    }

    await supabaseAdmin.auth.admin.updateUserById(req.appUser.id, {
      user_metadata: { must_change_password: false },
    });

    res.json({ ok: true });
  });

  // Attach referral code post-OAuth if user signed up via referral link and doesn't already have referred_by
  app.post('/api/app/referral/apply', requireAuth, async (req: AuthenticatedRequest, res) => {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin || !req.appUser) {
      res.status(503).json({ error: 'Backend unavailable' });
      return;
    }

    if (req.appUser.referred_by) {
      res.json({ applied: false, reason: 'Referral already recorded' });
      return;
    }

    const rawCode = typeof req.body?.referralCode === 'string' ? req.body.referralCode.trim().toUpperCase() : '';
    if (!rawCode || rawCode === req.appUser.referral_code) {
      res.json({ applied: false, reason: 'Invalid referral code' });
      return;
    }

    const { data: referrer } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('referral_code', rawCode)
      .maybeSingle();

    if (!referrer || referrer.id === req.appUser.id) {
      res.json({ applied: false, reason: 'Referral code not found' });
      return;
    }

    await supabaseAdmin
      .from('users')
      .update({ referred_by: referrer.id })
      .eq('id', req.appUser.id);

    await supabaseAdmin
      .from('referrals')
      .upsert(
        {
          referrer_id: referrer.id,
          referee_id: req.appUser.id,
          status: 'pending',
          reward_credits: 5000,
        },
        { onConflict: 'referee_id' }
      );

    res.json({ applied: true });
  });

  app.use('/api/profiles', profilesRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/radar', radarRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/admin', adminRouter);

  app.get('/api/blog/posts', async (_req, res) => {
    const posts = await fetchSanityBlogPosts();
    res.json({ sanityConfigured: isSanityConfigured(), posts });
  });

  app.get('/api/transits/today', requireAuth, async (_req, res) => {
    if (!isAstrologyApiConfigured()) {
      res.status(503).json({ error: 'FREE_ASTROLOGY_API_KEY not configured' });
      return;
    }
    try {
      const data = await getOrFetchDailyTransits();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch daily transits' });
    }
  });

  return app;
}
