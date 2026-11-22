import express, { type Express } from 'express';
import { getSupabaseAdmin, isSupabaseServerConfigured } from './lib/supabaseAdmin';
import { requireAuth, type AuthenticatedRequest } from './middleware/auth';
import profilesRouter from './routes/profiles';
import chatRouter from './routes/chat';
import paymentsRouter, { dodoWebhookMiddleware } from './routes/payments';
import radarRouter from './routes/radar';
import reportsRouter from './routes/reports';
import adminRouter from './routes/admin';
import appsRouter from './routes/apps';
import notesRouter from './routes/notes';
import favouritesRouter from './routes/favourites';
import { getOrFetchDailyTransits, isAstrologyApiConfigured } from './services/astrologyApi';
import { fetchSanityBlogPosts, isSanityConfigured } from '../lib/sanity';
import { normalizeCouncilSlug } from '../lib/vedicTypes';
import { ALLOWED_CHAT_NUMERIC_FONTS } from './services/platformSettings';

export function createExpressApp(): Express {
  const app = express();

  // Dodo webhook needs raw body for HMAC-SHA256 verification before express.json()
  app.post('/api/payments/webhook', ...dodoWebhookMiddleware);

  app.use(express.json({ limit: '15mb' }));

  // Public client-safe Supabase config fallback for static builds without compile-time VITE_* env injection
  app.get('/api/config/public', (_req, res) => {
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
    const supabaseAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ supabaseUrl, supabaseAnonKey });
  });

  // Health & Environment readiness check (never exposes secret values)
  app.get('/api/health', (_req, res) => {
    const hasPublicUrl = Boolean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
    const hasPublicAnon = Boolean(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      integrations: {
        supabaseServer: isSupabaseServerConfigured(),
        supabaseClient: hasPublicUrl && hasPublicAnon,
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

    void Promise.resolve(
      supabaseAdmin
        .from('users')
        .update({
          last_active_at: new Date().toISOString(),
          ...(countryHeader && !req.appUser.location_country ? { location_country: countryHeader } : {}),
          ...(cityHeader && !req.appUser.location_city ? { location_city: decodeURIComponent(cityHeader) } : {}),
        })
        .eq('id', req.appUser.id)
    ).catch(() => null);

    const [{ count: profileCount }, { count: referralCount }] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', req.appUser.id),
      supabaseAdmin
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_id', req.appUser.id)
        .eq('status', 'rewarded'),
    ]);

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

    const {
      full_name,
      currency_pref,
      default_expert,
      default_output,
      default_language,
      default_astrology_mode,
      preferred_call_name,
      chat_font_size,
      chat_numeric_font,
      suggestions_auto_expand,
    } = req.body || {};
    const updates: Record<string, string | boolean | null> = {};

    if (typeof full_name === 'string' && full_name.trim()) {
      updates.full_name = full_name.trim().slice(0, 100);
    }
    if (['INR', 'USD', 'AED', 'EUR'].includes(currency_pref)) {
      updates.currency_pref = currency_pref;
    }
    if (typeof default_expert === 'string' && default_expert.trim()) {
      updates.default_expert = normalizeCouncilSlug(default_expert);
    }
    if (typeof default_output === 'string' && default_output.trim()) {
      updates.default_output = default_output.trim();
    }
    if (typeof default_language === 'string' && default_language.trim()) {
      updates.default_language = default_language.trim();
    }
    if (default_astrology_mode === 'vedic' || default_astrology_mode === 'western') {
      updates.default_astrology_mode = default_astrology_mode;
    }
    if (typeof preferred_call_name === 'string') {
      updates.preferred_call_name = preferred_call_name.trim().slice(0, 60) || null;
    }
    if (['sm', 'base', 'lg'].includes(chat_font_size)) {
      updates.chat_font_size = chat_font_size;
    }
    if (chat_numeric_font === null || chat_numeric_font === 'default') {
      updates.chat_numeric_font = null;
    } else if (
      typeof chat_numeric_font === 'string' &&
      (ALLOWED_CHAT_NUMERIC_FONTS as readonly string[]).includes(chat_numeric_font)
    ) {
      updates.chat_numeric_font = chat_numeric_font;
    }
    if (typeof suggestions_auto_expand === 'boolean') {
      updates.suggestions_auto_expand = suggestions_auto_expand;
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
      // Safe fallback if newer columns aren't migrated yet
      const withoutNumericFont = { ...updates };
      delete withoutNumericFont.chat_numeric_font;

      if (Object.keys(withoutNumericFont).length > 0 && 'chat_numeric_font' in updates) {
        const nfFallback = await supabaseAdmin
          .from('users')
          .update({ ...withoutNumericFont, updated_at: new Date().toISOString() })
          .eq('id', req.appUser.id)
          .select('*')
          .single();

        if (!nfFallback.error && nfFallback.data) {
          res.json({
            user: {
              ...nfFallback.data,
              ...(updates.chat_numeric_font !== undefined
                ? { chat_numeric_font: updates.chat_numeric_font }
                : {}),
            },
          });
          return;
        }
      }

      const v7Updates = { ...withoutNumericFont };
      delete v7Updates.default_astrology_mode;

      if (Object.keys(v7Updates).length > 0) {
        const v7Fallback = await supabaseAdmin
          .from('users')
          .update({ ...v7Updates, updated_at: new Date().toISOString() })
          .eq('id', req.appUser.id)
          .select('*')
          .single();

        if (!v7Fallback.error && v7Fallback.data) {
          res.json({
            user: {
              ...v7Fallback.data,
              ...(default_astrology_mode ? { default_astrology_mode } : {}),
              ...(updates.chat_numeric_font !== undefined
                ? { chat_numeric_font: updates.chat_numeric_font }
                : {}),
            },
          });
          return;
        }
      }

      const v2Updates = { ...v7Updates };
      delete v2Updates.suggestions_auto_expand;

      if (Object.keys(v2Updates).length > 0) {
        const v2Fallback = await supabaseAdmin
          .from('users')
          .update({ ...v2Updates, updated_at: new Date().toISOString() })
          .eq('id', req.appUser.id)
          .select('*')
          .single();

        if (!v2Fallback.error && v2Fallback.data) {
          res.json({
            user: {
              ...v2Fallback.data,
              ...(typeof suggestions_auto_expand === 'boolean'
                ? { suggestions_auto_expand }
                : {}),
              ...(default_astrology_mode ? { default_astrology_mode } : {}),
              ...(updates.chat_numeric_font !== undefined
                ? { chat_numeric_font: updates.chat_numeric_font }
                : {}),
            },
          });
          return;
        }
      }

      const baseUpdates = { ...v2Updates };
      delete baseUpdates.preferred_call_name;
      delete baseUpdates.chat_font_size;

      if (Object.keys(baseUpdates).length > 0) {
        const fallback = await supabaseAdmin
          .from('users')
          .update({ ...baseUpdates, updated_at: new Date().toISOString() })
          .eq('id', req.appUser.id)
          .select('*')
          .single();

        if (!fallback.error && fallback.data) {
          res.json({ user: fallback.data });
          return;
        }
      }

      // If only newer-migration fields were sent before migration ran, return non-blocking success
      if (
        (Object.keys(updates).length === 1 && typeof suggestions_auto_expand === 'boolean') ||
        (Object.keys(updates).length === 1 && Boolean(default_astrology_mode)) ||
        (Object.keys(updates).length === 1 && 'chat_numeric_font' in updates)
      ) {
        res.json({
          user: {
            ...req.appUser,
            ...(typeof suggestions_auto_expand === 'boolean' ? { suggestions_auto_expand } : {}),
            ...(default_astrology_mode ? { default_astrology_mode } : {}),
            ...(updates.chat_numeric_font !== undefined
              ? { chat_numeric_font: updates.chat_numeric_font }
              : {}),
          },
          persisted: false,
        });
        return;
      }

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

    const { getPricingConfig } = await import('./services/platformSettings');
    const pricing = await getPricingConfig();

    await supabaseAdmin
      .from('referrals')
      .upsert(
        {
          referrer_id: referrer.id,
          referee_id: req.appUser.id,
          status: 'pending',
          reward_credits: pricing.referral_reward_credits,
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
  app.use('/api/apps', appsRouter);
  app.use('/api/notes', notesRouter);
  app.use('/api/favourites', favouritesRouter);

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

  // Business Support Contact Submission
  app.post('/api/app/support', requireAuth, async (req: AuthenticatedRequest, res) => {
    if (!req.appUser) {
      res.status(503).json({ error: 'Backend unavailable' });
      return;
    }

    const { name, email, category, subject, message } = req.body || {};
    const cleanSubject = typeof subject === 'string' ? subject.trim().slice(0, 140) : '';
    const cleanMessage = typeof message === 'string' ? message.trim().slice(0, 4000) : '';
    const cleanCategory = typeof category === 'string' && category.trim() ? category.trim().slice(0, 60) : 'General Support';
    const fromName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 100) : (req.appUser.full_name || 'Member');
    const fromEmail = typeof email === 'string' && email.trim() ? email.trim().slice(0, 140) : req.appUser.email;

    if (!cleanSubject || !cleanMessage) {
      res.status(400).json({ error: 'Subject and message are required.' });
      return;
    }

    const supabaseAdmin = getSupabaseAdmin();
    let ticketId: string | null = null;
    if (supabaseAdmin) {
      try {
        const { data: insertedTicket } = await supabaseAdmin
          .from('support_tickets')
          .insert({
            user_id: req.appUser.id,
            from_name: fromName,
            from_email: fromEmail,
            category: cleanCategory,
            subject: cleanSubject,
            message: cleanMessage,
            status: 'open',
            priority: 'normal',
          })
          .select('id')
          .maybeSingle();
        if (insertedTicket?.id) {
          ticketId = insertedTicket.id;
        }
      } catch {
        // Non-fatal if migration 004 has not been executed yet
      }
    }

    const { sendSupportInquiryEmail } = await import('./services/email');
    const delivery = await sendSupportInquiryEmail({
      fromName,
      fromEmail,
      category: cleanCategory,
      subject: cleanSubject,
      message: cleanMessage,
      userId: req.appUser.id,
    });

    res.json({
      ok: true,
      ticketId,
      deliveredViaEmail: delivery.sent,
      message: delivery.sent
        ? 'Your support inquiry has been sent. Our team will respond via email shortly.'
        : 'Your support inquiry has been recorded by Cosmic Council concierge.',
    });
  });

  // Full User Data Export (Backup .json)
  app.get('/api/app/data/export', requireAuth, async (req: AuthenticatedRequest, res) => {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin || !req.appUser) {
      res.status(503).json({ error: 'Backend unavailable' });
      return;
    }

    const [profilesRes, convsRes, promptsRes, reportsRes] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id, name, short_name, is_default, birth_date, birth_time, birth_city, birth_state, birth_country, latitude, longitude, timezone_offset, gender, relationship, profile_memory_summary, is_activated, created_at')
        .eq('user_id', req.appUser.id)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('conversations')
        .select('id, profile_id, title, mode_type, is_bookmarked, use_full_profile_memory, created_at, updated_at')
        .eq('user_id', req.appUser.id)
        .order('updated_at', { ascending: false }),
      supabaseAdmin
        .from('custom_prompts')
        .select('id, title, prompt_text, created_at')
        .eq('user_id', req.appUser.id)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('report_orders')
        .select('id, profile_id, report_slug, status, final_markdown, created_at, completed_at')
        .eq('user_id', req.appUser.id)
        .order('created_at', { ascending: false }),
    ]);

    const convs = convsRes.data || [];
    const convIds = convs.map((c) => c.id);
    let messagesByConv: Record<string, Array<Record<string, unknown>>> = {};

    if (convIds.length > 0) {
      const { data: msgRows } = await supabaseAdmin
        .from('messages')
        .select('conversation_id, role, content, expert_used, mode_used, output_format_used, language_used, is_starred, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: true });

      for (const m of msgRows || []) {
        const key = String(m.conversation_id);
        if (!messagesByConv[key]) messagesByConv[key] = [];
        messagesByConv[key].push(m);
      }
    }

    const exportBundle = {
      format: 'cosmic-council-backup-v1',
      exportedAt: new Date().toISOString(),
      preferences: {
        full_name: req.appUser.full_name,
        preferred_call_name: req.appUser.preferred_call_name ?? null,
        chat_font_size: req.appUser.chat_font_size ?? 'base',
        currency_pref: req.appUser.currency_pref,
        default_expert: normalizeCouncilSlug(req.appUser.default_expert),
        default_output: req.appUser.default_output,
        default_language: req.appUser.default_language,
        default_astrology_mode: req.appUser.default_astrology_mode ?? 'vedic',
      },
      profiles: profilesRes.data || [],
      customPrompts: promptsRes.data || [],
      conversations: convs.map((c) => ({
        ...c,
        messages: messagesByConv[c.id] || [],
      })),
      reports: reportsRes.data || [],
    };

    res.json(exportBundle);
  });

  // Restore / Import Data Backup (Profiles, Custom Prompts, Preferences)
  app.post('/api/app/data/import', requireAuth, async (req: AuthenticatedRequest, res) => {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin || !req.appUser) {
      res.status(503).json({ error: 'Backend unavailable' });
      return;
    }

    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Invalid backup JSON payload.' });
      return;
    }

    const tierLimits: Record<string, number> = { personal: 10, pro: 100, guru: 200 };
    const maxProfiles = tierLimits[req.appUser.tier] ?? 10;

    let importedProfiles = 0;
    let importedPrompts = 0;
    let updatedPreferences = false;

    // 1. Restore Preferences if present
    if (payload.preferences && typeof payload.preferences === 'object') {
      const p = payload.preferences as Record<string, unknown>;
      const prefUpdates: Record<string, unknown> = {};
      if (typeof p.preferred_call_name === 'string') {
        prefUpdates.preferred_call_name = p.preferred_call_name.trim().slice(0, 60) || null;
      }
      if (['sm', 'base', 'lg'].includes(String(p.chat_font_size))) {
        prefUpdates.chat_font_size = p.chat_font_size;
      }
      if (['INR', 'USD', 'AED', 'EUR'].includes(String(p.currency_pref))) {
        prefUpdates.currency_pref = p.currency_pref;
      }
      if (typeof p.default_expert === 'string' && p.default_expert.trim()) {
        prefUpdates.default_expert = normalizeCouncilSlug(p.default_expert);
      }
      if (typeof p.default_output === 'string' && p.default_output.trim()) {
        prefUpdates.default_output = p.default_output.trim();
      }
      if (typeof p.default_language === 'string' && p.default_language.trim()) {
        prefUpdates.default_language = p.default_language.trim();
      }
      if (p.default_astrology_mode === 'vedic' || p.default_astrology_mode === 'western') {
        prefUpdates.default_astrology_mode = p.default_astrology_mode;
      }
      if (Object.keys(prefUpdates).length > 0) {
        await supabaseAdmin
          .from('users')
          .update({ ...prefUpdates, updated_at: new Date().toISOString() })
          .eq('id', req.appUser.id);
        updatedPreferences = true;
      }
    }

    // 2. Import non-duplicate Profiles (respecting tier limit)
    if (Array.isArray(payload.profiles) && payload.profiles.length > 0) {
      const { data: existingProfs } = await supabaseAdmin
        .from('profiles')
        .select('name, birth_date, birth_time')
        .eq('user_id', req.appUser.id);

      const existingKeys = new Set(
        (existingProfs || []).map(
          (e) => `${String(e.name).toLowerCase()}|${e.birth_date}|${String(e.birth_time).slice(0, 5)}`
        )
      );
      let currentCount = (existingProfs || []).length;

      for (const raw of payload.profiles) {
        if (currentCount >= maxProfiles) break;
        if (!raw || typeof raw !== 'object') continue;
        const r = raw as Record<string, unknown>;
        const name = typeof r.name === 'string' ? r.name.trim() : '';
        const birthDate = typeof r.birth_date === 'string' ? r.birth_date.trim() : '';
        const birthTime = typeof r.birth_time === 'string' ? r.birth_time.trim() : '';
        const birthCity = typeof r.birth_city === 'string' ? r.birth_city.trim() : '';
        const birthCountry = typeof r.birth_country === 'string' ? r.birth_country.trim() : '';
        if (!name || !birthDate || !birthTime || !birthCity || !birthCountry) continue;

        const key = `${name.toLowerCase()}|${birthDate}|${birthTime.slice(0, 5)}`;
        if (existingKeys.has(key)) continue;

        const { error: insErr } = await supabaseAdmin.from('profiles').insert({
          user_id: req.appUser.id,
          name: name.slice(0, 100),
          short_name: typeof r.short_name === 'string' ? r.short_name.trim().slice(0, 40) || null : null,
          is_default: false,
          birth_date: birthDate,
          birth_time: birthTime,
          birth_city: birthCity,
          birth_state: typeof r.birth_state === 'string' ? r.birth_state : null,
          birth_country: birthCountry,
          latitude: Number.isFinite(Number(r.latitude)) ? Number(r.latitude) : 0,
          longitude: Number.isFinite(Number(r.longitude)) ? Number(r.longitude) : 0,
          timezone_offset: Number.isFinite(Number(r.timezone_offset)) ? Number(r.timezone_offset) : 5.5,
          gender: typeof r.gender === 'string' ? r.gender : null,
          relationship: typeof r.relationship === 'string' ? r.relationship : null,
          is_activated: false,
        });
        if (!insErr) {
          existingKeys.add(key);
          currentCount += 1;
          importedProfiles += 1;
        }
      }
    }

    // 3. Import non-duplicate Custom Prompts (max 10 total)
    if (Array.isArray(payload.customPrompts) && payload.customPrompts.length > 0) {
      const { data: existingPrompts } = await supabaseAdmin
        .from('custom_prompts')
        .select('title')
        .eq('user_id', req.appUser.id);

      const promptTitles = new Set(
        (existingPrompts || []).map((p) => String(p.title).toLowerCase())
      );
      let promptCount = (existingPrompts || []).length;

      for (const raw of payload.customPrompts) {
        if (promptCount >= 10) break;
        if (!raw || typeof raw !== 'object') continue;
        const p = raw as Record<string, unknown>;
        const title = typeof p.title === 'string' ? p.title.trim().slice(0, 80) : '';
        const promptText = typeof p.prompt_text === 'string' ? p.prompt_text.trim().slice(0, 4000) : '';
        if (!title || !promptText || promptTitles.has(title.toLowerCase())) continue;

        const { error: pErr } = await supabaseAdmin.from('custom_prompts').insert({
          user_id: req.appUser.id,
          title,
          prompt_text: promptText,
        });
        if (!pErr) {
          promptTitles.add(title.toLowerCase());
          promptCount += 1;
          importedPrompts += 1;
        }
      }
    }

    res.json({
      ok: true,
      importedProfiles,
      importedPrompts,
      updatedPreferences,
    });
  });

  return app;
}
