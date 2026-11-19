import { Router } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { isAstrologyApiConfigured, getOrFetchDailyTransits } from '../services/astrologyApi';
import { compileBirthChart } from '../services/chartCompiler';
import { rewardReferralIfEligible } from '../services/referralReward';

const router = Router();

const TIER_PROFILE_LIMITS: Record<string, number> = {
  personal: 5,
  pro: 50,
  guru: 200,
};

// Activation cost by tier (credits): configurable & transparent
const TIER_ACTIVATION_CREDITS: Record<string, number> = {
  personal: Number(process.env.ACTIVATION_CREDITS_PERSONAL) || 2000,
  pro: Number(process.env.ACTIVATION_CREDITS_PRO) || 1000,
  guru: Number(process.env.ACTIVATION_CREDITS_GURU) || 0,
};

const BASE_PROFILE_SUMMARY_COLUMNS =
  'id, user_id, name, birth_date, birth_time, birth_city, birth_state, birth_country, latitude, longitude, timezone_offset, gender, relationship, birth_chart_pdf_url, is_activated, activated_at, created_at, updated_at';

const PROFILE_SUMMARY_COLUMNS =
  'id, user_id, name, short_name, is_default, birth_date, birth_time, birth_city, birth_state, birth_country, latitude, longitude, timezone_offset, gender, relationship, birth_chart_pdf_url, is_activated, activated_at, created_at, updated_at';

const PROFILE_DETAIL_COLUMNS = `${PROFILE_SUMMARY_COLUMNS}, chart_json`;

router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  let rows: Array<Record<string, unknown>> = [];

  const primaryRes = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_SUMMARY_COLUMNS)
    .eq('user_id', req.appUser.id)
    .order('created_at', { ascending: false });

  if (primaryRes.error) {
    const fallbackRes = await supabaseAdmin
      .from('profiles')
      .select(BASE_PROFILE_SUMMARY_COLUMNS)
      .eq('user_id', req.appUser.id)
      .order('created_at', { ascending: false });

    if (fallbackRes.error) {
      res.status(500).json({ error: 'Failed to load profiles' });
      return;
    }
    rows = (fallbackRes.data || []).map((r) => ({
      ...r,
      short_name: null,
      is_default: false,
    }));
  } else {
    rows = (primaryRes.data || []) as Array<Record<string, unknown>>;
  }

  const sorted = [...rows].sort((a, b) => {
    return (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0);
  });

  const tierLimit = TIER_PROFILE_LIMITS[req.appUser.tier] ?? 5;
  const activationCost = TIER_ACTIVATION_CREDITS[req.appUser.tier] ?? 2000;

  res.json({
    profiles: sorted,
    tierLimit,
    activationCost,
    astrologyApiConfigured: isAstrologyApiConfigured(),
  });
});

router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const includeChart = req.query.includeChart !== '0';
  const selectColumns = includeChart ? PROFILE_DETAIL_COLUMNS : PROFILE_SUMMARY_COLUMNS;

  let { data, error } = await supabaseAdmin
    .from('profiles')
    .select(selectColumns)
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  if (error) {
    const baseCols = includeChart
      ? `${BASE_PROFILE_SUMMARY_COLUMNS}, chart_json`
      : BASE_PROFILE_SUMMARY_COLUMNS;
    const fallback = await supabaseAdmin
      .from('profiles')
      .select(baseCols)
      .eq('id', req.params.id)
      .eq('user_id', req.appUser.id)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error || !data) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  res.json({ profile: data });
});

router.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const tierLimit = TIER_PROFILE_LIMITS[req.appUser.tier] ?? 5;
  const { count } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.appUser.id);

  if ((count || 0) >= tierLimit) {
    res.status(403).json({
      error: `Your ${req.appUser.tier} plan supports up to ${tierLimit} saved profiles. Upgrade your tier to add more.`,
    });
    return;
  }

  const {
    name,
    short_name,
    is_default,
    birth_date,
    birth_time,
    birth_city,
    birth_state,
    birth_country,
    gender,
    relationship,
    birth_chart_pdf_url,
  } = req.body || {};

  if (!name?.trim() || !birth_date || !birth_time || !birth_city?.trim() || !birth_country?.trim()) {
    res.status(400).json({ error: 'Name, birth date, birth time, city, and country are required.' });
    return;
  }

  const wantsDefault = Boolean(is_default);
  if (wantsDefault) {
    await supabaseAdmin
      .from('profiles')
      .update({ is_default: false })
      .eq('user_id', req.appUser.id)
      .eq('is_default', true);
  }

  const basePayload = {
    user_id: req.appUser.id,
    name: name.trim(),
    birth_date,
    birth_time: birth_time.length === 5 ? `${birth_time}:00` : birth_time,
    birth_city: birth_city.trim(),
    birth_state: birth_state?.trim() || null,
    birth_country: birth_country.trim(),
    gender: ['male', 'female', 'non-binary'].includes(gender) ? gender : null,
    relationship: relationship?.trim() || null,
    birth_chart_pdf_url: birth_chart_pdf_url?.trim() || null,
    is_activated: false,
  };

  let { data, error } = await supabaseAdmin
    .from('profiles')
    .insert({
      ...basePayload,
      short_name: typeof short_name === 'string' && short_name.trim() ? short_name.trim().slice(0, 40) : null,
      is_default: wantsDefault,
    })
    .select(PROFILE_SUMMARY_COLUMNS)
    .single();

  if (error) {
    const fallback = await supabaseAdmin
      .from('profiles')
      .insert(basePayload)
      .select(BASE_PROFILE_SUMMARY_COLUMNS)
      .single();
    if (fallback.error || !fallback.data) {
      res.status(500).json({ error: 'Failed to save birth profile' });
      return;
    }
    data = { ...fallback.data, short_name: null, is_default: false };
  }

  res.status(201).json({ profile: data });
});

router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id, is_activated')
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  if (!existing) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  const {
    name,
    short_name,
    is_default,
    relationship,
    birth_chart_pdf_url,
    birth_date,
    birth_time,
    birth_city,
    birth_state,
    birth_country,
    gender,
  } = req.body || {};
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof name === 'string' && name.trim()) updates.name = name.trim();
  if (typeof short_name === 'string') updates.short_name = short_name.trim().slice(0, 40) || null;
  if (typeof is_default === 'boolean') {
    if (is_default) {
      await supabaseAdmin
        .from('profiles')
        .update({ is_default: false })
        .eq('user_id', req.appUser.id)
        .eq('is_default', true);
    }
    updates.is_default = is_default;
  }
  if (typeof relationship === 'string') updates.relationship = relationship.trim() || null;
  if (typeof birth_chart_pdf_url === 'string') updates.birth_chart_pdf_url = birth_chart_pdf_url.trim() || null;

  // Birth coordinates/times can only be modified before activation to protect chart integrity
  if (!existing.is_activated) {
    if (birth_date) updates.birth_date = birth_date;
    if (birth_time) updates.birth_time = birth_time.length === 5 ? `${birth_time}:00` : birth_time;
    if (birth_city?.trim()) updates.birth_city = birth_city.trim();
    if (typeof birth_state === 'string') updates.birth_state = birth_state.trim() || null;
    if (birth_country?.trim()) updates.birth_country = birth_country.trim();
    if (['male', 'female', 'non-binary'].includes(gender)) updates.gender = gender;
  }

  let { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', existing.id)
    .select(PROFILE_SUMMARY_COLUMNS)
    .single();

  if (error) {
    const baseUpdates = { ...updates };
    delete baseUpdates.short_name;
    delete baseUpdates.is_default;
    const fallback = await supabaseAdmin
      .from('profiles')
      .update(baseUpdates)
      .eq('id', existing.id)
      .select(BASE_PROFILE_SUMMARY_COLUMNS)
      .single();
    if (fallback.error || !fallback.data) {
      res.status(500).json({ error: 'Failed to update profile' });
      return;
    }
    data = { ...fallback.data, short_name: null, is_default: false };
  }

  res.json({ profile: data });
});

router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id);

  if (error) {
    res.status(500).json({ error: 'Failed to delete profile' });
    return;
  }

  res.json({ deleted: true });
});

// Activate Profile: Atomically deducts credits, compiles full Vedic+KP+Jaimini chart, refunds on failure
router.post('/:id/activate', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  if (!isAstrologyApiConfigured()) {
    res.status(503).json({
      error: 'FREE_ASTROLOGY_API_KEY is not configured yet. Add your FreeAstrologyAPI key to activate charts.',
      code: 'ASTROLOGY_API_NOT_CONFIGURED',
    });
    return;
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_DETAIL_COLUMNS)
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  if (!profile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  if (profile.is_activated) {
    res.json({ profile, alreadyActivated: true });
    return;
  }

  const activationCost = TIER_ACTIVATION_CREDITS[req.appUser.tier] ?? 2000;
  let deducted = false;

  if (activationCost > 0) {
    const { error: deductErr } = await supabaseAdmin.rpc('deduct_user_credits', {
      p_user_id: req.appUser.id,
      p_amount: activationCost,
      p_tx_type: 'profile_activation',
      p_reference_id: profile.id,
      p_description: `Birth chart activation for ${profile.name}`,
    });

    if (deductErr) {
      res.status(402).json({
        error: deductErr.message || 'Insufficient credits to activate this profile.',
        requiredCredits: activationCost,
        availableCredits: req.appUser.credits_balance,
      });
      return;
    }
    deducted = true;
  }

  try {
    const compiled = await compileBirthChart({
      name: profile.name,
      birthDate: profile.birth_date,
      birthTime: profile.birth_time,
      birthCity: profile.birth_city,
      birthState: profile.birth_state,
      birthCountry: profile.birth_country,
      latitude: profile.latitude,
      longitude: profile.longitude,
      timezoneOffset: profile.timezone_offset,
    });

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        latitude: compiled.location.latitude,
        longitude: compiled.location.longitude,
        timezone_offset: compiled.location.timezoneOffset,
        chart_json: compiled.chartJson,
        chart_text_context: compiled.chartTextContext,
        is_activated: true,
        activated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)
      .select(PROFILE_DETAIL_COLUMNS)
      .single();

    if (updateErr) {
      throw new Error(updateErr.message);
    }

    // Also warm global daily transit cache if needed (best effort)
    getOrFetchDailyTransits().catch(() => null);

    // Unlock referral bonus if this was a paid activation
    if (activationCost > 0) {
      void rewardReferralIfEligible(req.appUser.id);
    }

    res.json({ profile: updated, creditsCharged: activationCost });
  } catch (err) {
    // Roll back deducted credits on ephemeris API failure so user never loses credits
    if (deducted && activationCost > 0) {
      await supabaseAdmin.rpc('grant_user_credits', {
        p_user_id: req.appUser.id,
        p_amount: activationCost,
        p_tx_type: 'refund',
        p_reference_id: profile.id,
        p_description: `Automatic refund: chart activation failed for ${profile.name}`,
      });
    }

    const message = err instanceof Error ? err.message : 'Chart compilation failed';
    res.status(500).json({ error: message });
  }
});

export default router;
