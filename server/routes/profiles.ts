import { Router } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import {
  isAstrologyApiConfigured,
  getOrFetchDailyTransits,
  searchBirthPlaces,
} from '../services/astrologyApi';
import { compileBirthChart } from '../services/chartCompiler';
import { rewardReferralIfEligible } from '../services/referralReward';
import {
  checkDuplicateChartAbuse,
  checkRateLimit,
  computeChartFingerprint,
} from '../services/abuseGuard';
import { getPricingConfig } from '../services/platformSettings';

const router = Router();

const TIER_PROFILE_LIMITS: Record<string, number> = {
  personal: 10,
  pro: 100,
  guru: 200,
};

// Chart activations are free for all tiers
const TIER_ACTIVATION_CREDITS: Record<string, number> = {
  personal: 0,
  pro: 0,
  guru: 0,
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

  const pricing = await getPricingConfig();
  const tierConfig = pricing.membership_tiers.find((t) => t.slug === req.appUser?.tier);
  const tierLimit = tierConfig?.profileLimit ?? TIER_PROFILE_LIMITS[req.appUser.tier] ?? 10;
  const activationCost = tierConfig?.activationCostCredits ?? TIER_ACTIVATION_CREDITS[req.appUser.tier] ?? 0;

  res.json({
    profiles: sorted,
    tierLimit,
    activationCost,
    astrologyApiConfigured: isAstrologyApiConfigured(),
  });
});

function parseNaturalPlace(
  placeQuery?: string | null,
  fallbackCity?: string | null,
  fallbackState?: string | null,
  fallbackCountry?: string | null
): { birthCity: string; birthState: string | null; birthCountry: string } {
  const rawCity = (fallbackCity || '').trim();
  const rawState = (fallbackState || '').trim() || null;
  const rawCountry = (fallbackCountry || '').trim();

  if (rawCity && rawCountry) {
    return { birthCity: rawCity, birthState: rawState, birthCountry: rawCountry };
  }

  const parts = String(placeQuery || rawCity || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    return {
      birthCity: rawCity || parts[0],
      birthState: rawState || parts.slice(1, -1).join(', '),
      birthCountry: rawCountry || parts[parts.length - 1],
    };
  }
  if (parts.length === 2) {
    return {
      birthCity: rawCity || parts[0],
      birthState: rawState,
      birthCountry: rawCountry || parts[1],
    };
  }
  return {
    birthCity: rawCity || parts[0] || '',
    birthState: rawState,
    birthCountry: rawCountry || '',
  };
}

// Natural Place of Birth search proxy (must be registered before /:id)
router.get('/places', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) {
    res.json({ places: [], configured: isAstrologyApiConfigured() });
    return;
  }

  if (!isAstrologyApiConfigured()) {
    res.json({ places: [], configured: false });
    return;
  }

  if (!req.appUser.is_admin) {
    const rate = checkRateLimit(`place_search:${req.appUser.id}`, 45, 5 * 60 * 1000);
    if (!rate.allowed) {
      res.status(429).json({ error: 'Please pause a moment before searching more places.' });
      return;
    }
  }

  try {
    const places = await searchBirthPlaces(q);
    res.json({ places, configured: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to look up place';
    res.status(502).json({ error: message, places: [] });
  }
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

  // Silently compile any legacy unactivated profile when inspected so no user ever sees an "Activate" button
  let profilePayload: Record<string, unknown> = data as unknown as Record<string, unknown>;
  if (includeChart && (!profilePayload.is_activated || !profilePayload.chart_json) && isAstrologyApiConfigured()) {
    try {
      const compiled = await compileBirthChart({
        name: String(profilePayload.name || 'Profile'),
        birthDate: String(profilePayload.birth_date),
        birthTime: String(profilePayload.birth_time),
        birthCity: String(profilePayload.birth_city || ''),
        birthState: (profilePayload.birth_state as string | null) ?? null,
        birthCountry: String(profilePayload.birth_country || ''),
        latitude: typeof profilePayload.latitude === 'number' ? profilePayload.latitude : null,
        longitude: typeof profilePayload.longitude === 'number' ? profilePayload.longitude : null,
        timezoneOffset: typeof profilePayload.timezone_offset === 'number' ? profilePayload.timezone_offset : null,
      });

      const { data: updated } = await supabaseAdmin
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
        .eq('id', String(profilePayload.id))
        .select(PROFILE_DETAIL_COLUMNS)
        .single();

      if (updated) {
        profilePayload = updated as unknown as Record<string, unknown>;
      }
    } catch {
      // Return existing record gracefully if ephemeris call temporarily fails
    }
  }

  res.json({ profile: profilePayload });
});

router.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  if (!req.appUser.is_admin) {
    const userRate = checkRateLimit(`profile_create:${req.appUser.id}`, 12, 10 * 60 * 1000);
    if (!userRate.allowed) {
      res.status(429).json({
        error: 'Too many birth profiles created recently. Please wait a few minutes and try again.',
      });
      return;
    }
    if (req.clientIpHash) {
      const ipRate = checkRateLimit(`profile_create_ip:${req.clientIpHash}`, 20, 10 * 60 * 1000);
      if (!ipRate.allowed) {
        res.status(429).json({
          error: 'Too many birth profiles created from this network recently. Please try again shortly.',
        });
        return;
      }
    }
  }

  const pricing = await getPricingConfig();
  const tierConfig = pricing.membership_tiers.find((t) => t.slug === req.appUser?.tier);
  const tierLimit = tierConfig?.profileLimit ?? TIER_PROFILE_LIMITS[req.appUser.tier] ?? 10;
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
    place_query,
    birth_city,
    birth_state,
    birth_country,
    latitude,
    longitude,
    timezone_offset,
    gender,
    relationship,
    birth_chart_pdf_url,
  } = req.body || {};

  const parsedPlace = parseNaturalPlace(place_query, birth_city, birth_state, birth_country);

  if (!name?.trim() || !birth_date || !birth_time || !parsedPlace.birthCity) {
    res.status(400).json({
      error: 'Name, date of birth, time of birth, and place of birth are required.',
    });
    return;
  }

  if (!isAstrologyApiConfigured()) {
    res.status(503).json({
      error: 'Birth chart engine is not configured yet (FREE_ASTROLOGY_API_KEY missing).',
      code: 'ASTROLOGY_API_NOT_CONFIGURED',
    });
    return;
  }

  const normalizedBirthTime = birth_time.length === 5 ? `${birth_time}:00` : birth_time;
  const parsedLat = typeof latitude === 'number' && !Number.isNaN(latitude) ? latitude : null;
  const parsedLon = typeof longitude === 'number' && !Number.isNaN(longitude) ? longitude : null;
  const parsedTz =
    typeof timezone_offset === 'number' && !Number.isNaN(timezone_offset)
      ? timezone_offset
      : null;

  const preAbuseCheck = await checkDuplicateChartAbuse({
    supabaseAdmin,
    user: req.appUser,
    ipHash: req.clientIpHash ?? null,
    birthDate: birth_date,
    birthTime: normalizedBirthTime,
    birthCity: parsedPlace.birthCity,
    birthCountry: parsedPlace.birthCountry || parsedPlace.birthCity,
    latitude: parsedLat,
    longitude: parsedLon,
  });

  if (preAbuseCheck.blocked) {
    res.status(403).json({
      error: preAbuseCheck.reason,
      code: 'DUPLICATE_CHART_NETWORK_LIMIT',
    });
    return;
  }

  // Compile full ephemeris + Parashari/KP/Jaimini/Ashtakavarga/Dasha chart ONCE right at creation
  let compiled;
  try {
    compiled = await compileBirthChart({
      name: name.trim(),
      birthDate: birth_date,
      birthTime: normalizedBirthTime,
      birthCity: parsedPlace.birthCity,
      birthState: parsedPlace.birthState,
      birthCountry: parsedPlace.birthCountry,
      latitude: parsedLat,
      longitude: parsedLon,
      timezoneOffset: parsedTz,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not build birth chart for those birth details.';
    res.status(400).json({ error: message });
    return;
  }

  // Fill canonical city / state / country from geocoder if user entered a short natural query (e.g. "Pune")
  const resolvedLabelParts = compiled.location.locationLabel
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const finalCity = parsedPlace.birthCity || resolvedLabelParts[0] || 'Unknown';
  const finalState =
    parsedPlace.birthState ||
    (resolvedLabelParts.length >= 3 ? resolvedLabelParts.slice(1, -1).join(', ') : null);
  const finalCountry =
    parsedPlace.birthCountry ||
    (resolvedLabelParts.length >= 2
      ? resolvedLabelParts[resolvedLabelParts.length - 1]
      : 'India');

  const postAbuseCheck = await checkDuplicateChartAbuse({
    supabaseAdmin,
    user: req.appUser,
    ipHash: req.clientIpHash ?? null,
    birthDate: birth_date,
    birthTime: normalizedBirthTime,
    birthCity: finalCity,
    birthCountry: finalCountry,
    latitude: compiled.location.latitude,
    longitude: compiled.location.longitude,
  });

  if (postAbuseCheck.blocked) {
    res.status(403).json({
      error: postAbuseCheck.reason,
      code: 'DUPLICATE_CHART_NETWORK_LIMIT',
    });
    return;
  }

  const wantsDefault = Boolean(is_default) || (count || 0) === 0;
  if (wantsDefault) {
    await supabaseAdmin
      .from('profiles')
      .update({ is_default: false })
      .eq('user_id', req.appUser.id)
      .eq('is_default', true);
  }

  const chartFingerprint = computeChartFingerprint({
    birthDate: birth_date,
    birthTime: normalizedBirthTime,
    birthCity: finalCity,
    birthCountry: finalCountry,
    latitude: compiled.location.latitude,
    longitude: compiled.location.longitude,
  });

  const nowIso = new Date().toISOString();
  const basePayload = {
    user_id: req.appUser.id,
    name: name.trim(),
    birth_date,
    birth_time: normalizedBirthTime,
    birth_city: finalCity,
    birth_state: finalState,
    birth_country: finalCountry,
    latitude: compiled.location.latitude,
    longitude: compiled.location.longitude,
    timezone_offset: compiled.location.timezoneOffset,
    gender: ['male', 'female', 'non-binary'].includes(gender) ? gender : null,
    relationship: relationship?.trim() || null,
    birth_chart_pdf_url: birth_chart_pdf_url?.trim() || null,
    chart_json: compiled.chartJson,
    chart_text_context: compiled.chartTextContext,
    is_activated: true,
    activated_at: nowIso,
  };

  let { data, error } = await supabaseAdmin
    .from('profiles')
    .insert({
      ...basePayload,
      short_name:
        typeof short_name === 'string' && short_name.trim()
          ? short_name.trim().slice(0, 40)
          : null,
      is_default: wantsDefault,
      chart_fingerprint: chartFingerprint,
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
      res.status(500).json({ error: 'Failed to save birth chart profile.' });
      return;
    }
    data = { ...fallback.data, short_name: null, is_default: false };
  }

  // Warm global daily transit cache in background (best effort)
  getOrFetchDailyTransits().catch(() => null);

  res.status(201).json({ profile: data, chartReady: true });
});

router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id, is_activated, birth_date, birth_time, birth_city, birth_country')
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

    if (birth_date || birth_time || birth_city?.trim() || birth_country?.trim()) {
      const nextFp = computeChartFingerprint({
        birthDate: String(updates.birth_date || existing.birth_date),
        birthTime: String(updates.birth_time || existing.birth_time),
        birthCity: String(updates.birth_city || existing.birth_city),
        birthCountry: String(updates.birth_country || existing.birth_country),
      });
      if (nextFp) updates.chart_fingerprint = nextFp;
    }
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
    delete baseUpdates.chart_fingerprint;
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

  if (!req.appUser.is_admin) {
    const activateRate = checkRateLimit(`profile_activate:${req.appUser.id}`, 10, 10 * 60 * 1000);
    if (!activateRate.allowed) {
      res.status(429).json({
        error: 'Too many chart activation attempts recently. Please wait a few minutes and try again.',
      });
      return;
    }
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

  const preCheck = await checkDuplicateChartAbuse({
    supabaseAdmin,
    user: req.appUser,
    ipHash: req.clientIpHash ?? null,
    birthDate: profile.birth_date,
    birthTime: profile.birth_time,
    birthCity: profile.birth_city,
    birthCountry: profile.birth_country,
    latitude: profile.latitude,
    longitude: profile.longitude,
    excludeProfileId: profile.id,
  });

  if (preCheck.blocked) {
    res.status(403).json({
      error: preCheck.reason,
      code: 'DUPLICATE_CHART_NETWORK_LIMIT',
    });
    return;
  }

  const activationCost = TIER_ACTIVATION_CREDITS[req.appUser.tier] ?? 0;
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

    const postGeoCheck = await checkDuplicateChartAbuse({
      supabaseAdmin,
      user: req.appUser,
      ipHash: req.clientIpHash ?? null,
      birthDate: profile.birth_date,
      birthTime: profile.birth_time,
      birthCity: profile.birth_city,
      birthCountry: profile.birth_country,
      latitude: compiled.location.latitude,
      longitude: compiled.location.longitude,
      excludeProfileId: profile.id,
    });

    if (postGeoCheck.blocked) {
      if (deducted && activationCost > 0) {
        await supabaseAdmin.rpc('grant_user_credits', {
          p_user_id: req.appUser.id,
          p_amount: activationCost,
          p_tx_type: 'refund',
          p_reference_id: profile.id,
          p_description: `Automatic refund: duplicate network chart check for ${profile.name}`,
        });
      }
      res.status(403).json({
        error: postGeoCheck.reason,
        code: 'DUPLICATE_CHART_NETWORK_LIMIT',
      });
      return;
    }

    const geoFingerprint = computeChartFingerprint({
      birthDate: profile.birth_date,
      birthTime: profile.birth_time,
      birthCity: profile.birth_city,
      birthCountry: profile.birth_country,
      latitude: compiled.location.latitude,
      longitude: compiled.location.longitude,
    });

    const activationPayload = {
      latitude: compiled.location.latitude,
      longitude: compiled.location.longitude,
      timezone_offset: compiled.location.timezoneOffset,
      chart_json: compiled.chartJson,
      chart_text_context: compiled.chartTextContext,
      is_activated: true,
      activated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let { data: updated, error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        ...activationPayload,
        ...(geoFingerprint ? { chart_fingerprint: geoFingerprint } : {}),
      })
      .eq('id', profile.id)
      .select(PROFILE_DETAIL_COLUMNS)
      .single();

    if (updateErr && geoFingerprint) {
      const retry = await supabaseAdmin
        .from('profiles')
        .update(activationPayload)
        .eq('id', profile.id)
        .select(PROFILE_DETAIL_COLUMNS)
        .single();
      updated = retry.data;
      updateErr = retry.error;
    }

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
