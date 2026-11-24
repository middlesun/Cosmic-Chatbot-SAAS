import { Router } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import {
  isAstrologyApiConfigured,
  getOrFetchDailyTransits,
  searchBirthPlaces,
} from '../services/astrologyApi';
import { compileBirthChart, enrichCompiledChart, type CompiledChartData } from '../services/chartCompiler';
import { rewardReferralIfEligible } from '../services/referralReward';
import {
  checkDuplicateChartAbuse,
  checkRateLimit,
  computeChartFingerprint,
} from '../services/abuseGuard';
import { getPricingConfig } from '../services/platformSettings';
import {
  mergeLifeContextPatch,
  sanitizeLifeContext,
  type LifeContextData,
} from '../services/lifeContextGuard';
import {
  buildNatalTruthDossierLayerA,
  buildWesternTruthDossier,
  compileNatalTruthDossier,
  CURRENT_NATAL_DOSSIER_VERSION,
} from '../services/natalDossier';

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

const V2_PROFILE_SUMMARY_COLUMNS =
  'id, user_id, name, short_name, is_default, birth_date, birth_time, birth_city, birth_state, birth_country, latitude, longitude, timezone_offset, gender, relationship, birth_chart_pdf_url, is_activated, activated_at, created_at, updated_at';

const V3_PROFILE_SUMMARY_COLUMNS =
  'id, user_id, name, short_name, is_default, birth_date, birth_time, birth_city, birth_state, birth_country, current_city, current_state, current_country, current_timezone_offset, latitude, longitude, timezone_offset, gender, relationship, birth_chart_pdf_url, is_activated, activated_at, created_at, updated_at';

const PROFILE_SUMMARY_COLUMNS =
  'id, user_id, name, short_name, is_default, is_starred, tags, birth_date, birth_time, birth_city, birth_state, birth_country, current_city, current_state, current_country, current_timezone_offset, latitude, longitude, timezone_offset, gender, relationship, birth_chart_pdf_url, is_activated, activated_at, created_at, updated_at';

// CRITICAL EGRESS GUARD: Summary columns NEVER select chart_json, chart_text_context, or natal_truth_dossier_json
const VEDIC_PROFILE_SUMMARY_COLUMNS =
  `${PROFILE_SUMMARY_COLUMNS}, life_context_json, life_context_completeness, natal_dossier_version`;

const PROFILE_DETAIL_COLUMNS = `${PROFILE_SUMMARY_COLUMNS}, chart_json`;
const VEDIC_PROFILE_DETAIL_COLUMNS = `${VEDIC_PROFILE_SUMMARY_COLUMNS}, chart_json, natal_truth_dossier_json`;

function withEmptyCurrentLocation<T extends Record<string, unknown>>(row: T): T & {
  current_city: null;
  current_state: null;
  current_country: null;
  current_timezone_offset: null;
} {
  return {
    ...row,
    current_city: null,
    current_state: null,
    current_country: null,
    current_timezone_offset: null,
  };
}

function withDefaultMetaFields<T extends Record<string, unknown>>(row: T): T & {
  is_starred: boolean;
  tags: string[];
  life_context_json: Record<string, unknown>;
  life_context_completeness: number;
  natal_dossier_version: number;
} {
  const rawCtx = row.life_context_json;
  const safeCtx =
    rawCtx && typeof rawCtx === 'object' && !Array.isArray(rawCtx)
      ? (rawCtx as Record<string, unknown>)
      : {};
  return {
    ...row,
    is_starred: typeof row.is_starred === 'boolean' ? row.is_starred : false,
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    life_context_json: safeCtx,
    life_context_completeness:
      typeof row.life_context_completeness === 'number' ? row.life_context_completeness : 0,
    natal_dossier_version:
      typeof row.natal_dossier_version === 'number' ? row.natal_dossier_version : 0,
  };
}

function normalizeProfileTags(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const item of raw) {
    const t = String(item ?? '').trim().slice(0, 24);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(t);
    if (cleaned.length >= 10) break;
  }
  return cleaned;
}

router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  let rows: Array<Record<string, unknown>> = [];

  const vedicPrimaryRes = await supabaseAdmin
    .from('profiles')
    .select(VEDIC_PROFILE_SUMMARY_COLUMNS)
    .eq('user_id', req.appUser.id)
    .order('created_at', { ascending: false });

  if (!vedicPrimaryRes.error && vedicPrimaryRes.data) {
    rows = (vedicPrimaryRes.data || []).map((r) =>
      withDefaultMetaFields(r as unknown as Record<string, unknown>)
    );
  } else {
    const primaryRes = await supabaseAdmin
      .from('profiles')
      .select(PROFILE_SUMMARY_COLUMNS)
      .eq('user_id', req.appUser.id)
      .order('created_at', { ascending: false });

    if (primaryRes.error) {
      const v3Res = await supabaseAdmin
        .from('profiles')
        .select(V3_PROFILE_SUMMARY_COLUMNS)
        .eq('user_id', req.appUser.id)
        .order('created_at', { ascending: false });

      if (!v3Res.error && v3Res.data) {
        rows = (v3Res.data as Array<Record<string, unknown>>).map((r) => withDefaultMetaFields(r));
      } else {
        const v2Res = await supabaseAdmin
          .from('profiles')
          .select(V2_PROFILE_SUMMARY_COLUMNS)
          .eq('user_id', req.appUser.id)
          .order('created_at', { ascending: false });

        if (!v2Res.error && v2Res.data) {
          rows = (v2Res.data as Array<Record<string, unknown>>).map((r) =>
            withDefaultMetaFields(withEmptyCurrentLocation(r))
          );
        } else {
          const fallbackRes = await supabaseAdmin
            .from('profiles')
            .select(BASE_PROFILE_SUMMARY_COLUMNS)
            .eq('user_id', req.appUser.id)
            .order('created_at', { ascending: false });

          if (fallbackRes.error) {
            res.status(500).json({ error: 'Failed to load profiles' });
            return;
          }
          rows = (fallbackRes.data || []).map((r) =>
            withDefaultMetaFields(
              withEmptyCurrentLocation({
                ...r,
                short_name: null,
                is_default: false,
              })
            )
          );
        }
      }
    } else {
      rows = (primaryRes.data || []).map((r) =>
        withDefaultMetaFields(r as unknown as Record<string, unknown>)
      );
    }
  }

  // Attach Council-only conversation metadata per profile (zero heavy columns)
  const councilByProfile = new Map<string, { count: number; latestId: string }>();
  try {
    const convRes = await supabaseAdmin
      .from('conversations')
      .select('id, profile_id, pillar, updated_at')
      .eq('user_id', req.appUser.id)
      .not('profile_id', 'is', null)
      .order('updated_at', { ascending: false });

    let convRows: Array<{ id: string; profile_id: string | null; pillar?: string | null }> = [];
    if (!convRes.error && convRes.data) {
      convRows = convRes.data as Array<{ id: string; profile_id: string | null; pillar?: string | null }>;
    } else {
      const convFallback = await supabaseAdmin
        .from('conversations')
        .select('id, profile_id, updated_at')
        .eq('user_id', req.appUser.id)
        .not('profile_id', 'is', null)
        .order('updated_at', { ascending: false });
      convRows = (convFallback.data || []) as Array<{ id: string; profile_id: string | null }>;
    }

    for (const c of convRows) {
      if (!c.profile_id) continue;
      if (c.pillar === 'companion' || c.pillar === 'clarity') continue;
      const existing = councilByProfile.get(c.profile_id);
      if (!existing) {
        councilByProfile.set(c.profile_id, { count: 1, latestId: c.id });
      } else {
        existing.count += 1;
      }
    }
  } catch {
    // Non-fatal fallback
  }

  const enrichedRows = rows.map((r) => {
    const stats = councilByProfile.get(String(r.id));
    return {
      ...r,
      council_thread_count: stats?.count || 0,
      latest_council_conv_id: stats?.latestId || null,
    };
  });

  const sorted = [...enrichedRows].sort((a, b) => {
    return ((b as Record<string, unknown>).is_default ? 1 : 0) - ((a as Record<string, unknown>).is_default ? 1 : 0);
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
  const vedicSelectColumns = includeChart ? VEDIC_PROFILE_DETAIL_COLUMNS : VEDIC_PROFILE_SUMMARY_COLUMNS;
  const legacySelectColumns = includeChart ? PROFILE_DETAIL_COLUMNS : PROFILE_SUMMARY_COLUMNS;

  const vedicQuery = await supabaseAdmin
    .from('profiles')
    .select(vedicSelectColumns)
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  let rawProfile: Record<string, unknown> | null = vedicQuery.data
    ? withDefaultMetaFields(vedicQuery.data as unknown as Record<string, unknown>)
    : null;
  let queryError = vedicQuery.error;

  if (queryError) {
    const initialQuery = await supabaseAdmin
      .from('profiles')
      .select(legacySelectColumns)
      .eq('id', req.params.id)
      .eq('user_id', req.appUser.id)
      .maybeSingle();

    rawProfile = initialQuery.data
      ? withDefaultMetaFields(initialQuery.data as unknown as Record<string, unknown>)
      : null;
    queryError = initialQuery.error;
  }

  if (queryError) {
    const v3Cols = includeChart
      ? `${V3_PROFILE_SUMMARY_COLUMNS}, chart_json`
      : V3_PROFILE_SUMMARY_COLUMNS;
    const v3Fallback = await supabaseAdmin
      .from('profiles')
      .select(v3Cols)
      .eq('id', req.params.id)
      .eq('user_id', req.appUser.id)
      .maybeSingle();

    if (!v3Fallback.error && v3Fallback.data) {
      rawProfile = withDefaultMetaFields(
        v3Fallback.data as unknown as Record<string, unknown>
      );
      queryError = null;
    } else {
      const v2Cols = includeChart
        ? `${V2_PROFILE_SUMMARY_COLUMNS}, chart_json`
        : V2_PROFILE_SUMMARY_COLUMNS;
      const v2Fallback = await supabaseAdmin
        .from('profiles')
        .select(v2Cols)
        .eq('id', req.params.id)
        .eq('user_id', req.appUser.id)
        .maybeSingle();

      if (!v2Fallback.error && v2Fallback.data) {
        rawProfile = withDefaultMetaFields(
          withEmptyCurrentLocation(
            v2Fallback.data as unknown as Record<string, unknown>
          )
        );
        queryError = null;
      } else {
        const baseCols = includeChart
          ? `${BASE_PROFILE_SUMMARY_COLUMNS}, chart_json`
          : BASE_PROFILE_SUMMARY_COLUMNS;
        const fallback = await supabaseAdmin
          .from('profiles')
          .select(baseCols)
          .eq('id', req.params.id)
          .eq('user_id', req.appUser.id)
          .maybeSingle();
        rawProfile = fallback.data
          ? withDefaultMetaFields(
              withEmptyCurrentLocation(fallback.data as unknown as Record<string, unknown>)
            )
          : null;
        queryError = fallback.error;
      }
    }
  }

  if (queryError || !rawProfile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  // Silently compile any legacy unactivated profile when inspected so no user ever sees an "Activate" button
  let profilePayload: Record<string, unknown> = rawProfile;
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

      const dossier = await compileNatalTruthDossier(compiled.chartJson, {
        lifeContext: profilePayload.life_context_json as LifeContextData,
        includeNarrativeKernel: true,
      }).catch(() => null);

      const baseUpdatePayload = {
        latitude: compiled.location.latitude,
        longitude: compiled.location.longitude,
        timezone_offset: compiled.location.timezoneOffset,
        chart_json: compiled.chartJson,
        chart_text_context: compiled.chartTextContext,
        is_activated: true,
        activated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const vedicRes = await supabaseAdmin
        .from('profiles')
        .update({
          ...baseUpdatePayload,
          ...(dossier
            ? {
                natal_truth_dossier_json: dossier,
                natal_dossier_version: CURRENT_NATAL_DOSSIER_VERSION,
              }
            : {}),
        })
        .eq('id', String(profilePayload.id))
        .select(VEDIC_PROFILE_DETAIL_COLUMNS)
        .single();

      if (!vedicRes.error && vedicRes.data) {
        profilePayload = withDefaultMetaFields(
          vedicRes.data as unknown as Record<string, unknown>
        );
      } else {
        const { data: updated } = await supabaseAdmin
          .from('profiles')
          .update(baseUpdatePayload)
          .eq('id', String(profilePayload.id))
          .select(PROFILE_DETAIL_COLUMNS)
          .single();

        if (updated) {
          profilePayload = withDefaultMetaFields(updated as unknown as Record<string, unknown>);
        }
      }
    } catch {
      // Return existing record gracefully if ephemeris call temporarily fails
    }
  } else if (includeChart && profilePayload.chart_json) {
    try {
      const enriched = enrichCompiledChart(profilePayload.chart_json as CompiledChartData);
      const existingDossier =
        profilePayload.natal_truth_dossier_json &&
        typeof profilePayload.natal_truth_dossier_json === 'object'
          ? (profilePayload.natal_truth_dossier_json as Record<string, unknown>)
          : null;
      const needsDossier =
        !existingDossier ||
        !existingDossier.western_dossier ||
        Number(profilePayload.natal_dossier_version || 0) < CURRENT_NATAL_DOSSIER_VERSION;

      let compiledDossier: Record<string, unknown> | null = null;
      if (needsDossier) {
        const layerA = buildNatalTruthDossierLayerA(
          enriched.chartJson,
          profilePayload.life_context_json as LifeContextData
        );
        const westernDossier = buildWesternTruthDossier(
          enriched.chartJson,
          profilePayload.life_context_json as LifeContextData
        );
        compiledDossier = {
          version: CURRENT_NATAL_DOSSIER_VERSION,
          generated_at: new Date().toISOString(),
          layer_a: layerA,
          layer_b: existingDossier?.layer_b ?? null,
          western_dossier: westernDossier,
        };
        profilePayload = {
          ...profilePayload,
          natal_truth_dossier_json: compiledDossier,
          natal_dossier_version: CURRENT_NATAL_DOSSIER_VERSION,
        };
      }

      if (enriched.wasEnriched || compiledDossier) {
        profilePayload = {
          ...profilePayload,
          chart_json: enriched.chartJson,
        };
        const patch: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (enriched.wasEnriched) {
          patch.chart_json = enriched.chartJson;
          patch.chart_text_context = enriched.chartTextContext;
        }
        if (compiledDossier) {
          patch.natal_truth_dossier_json = compiledDossier;
          patch.natal_dossier_version = CURRENT_NATAL_DOSSIER_VERSION;
        }
        void supabaseAdmin
          .from('profiles')
          .update(patch)
          .eq('id', String(profilePayload.id))
          .then(({ error: bgErr }) => {
            // If migration 011 columns don't exist yet, retry without dossier columns
            if (bgErr && enriched.wasEnriched) {
              void supabaseAdmin
                .from('profiles')
                .update({
                  chart_json: enriched.chartJson,
                  chart_text_context: enriched.chartTextContext,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', String(profilePayload.id));
            }
          });
      }
    } catch {
      // Keep original chart_json if enrichment skips cleanly
    }
  }

  let dailyTransits: unknown = null;
  if (includeChart && isAstrologyApiConfigured()) {
    try {
      dailyTransits = await getOrFetchDailyTransits();
    } catch {
      dailyTransits = null;
    }
  }

  res.json({ profile: profilePayload, dailyTransits });
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
    current_place_query,
    current_city,
    current_state,
    current_country,
    current_timezone_offset,
    latitude,
    longitude,
    timezone_offset,
    gender,
    relationship,
    birth_chart_pdf_url,
  } = req.body || {};

  const parsedPlace = parseNaturalPlace(place_query, birth_city, birth_state, birth_country);
  const parsedCurrentPlace =
    current_place_query || current_city || current_country
      ? parseNaturalPlace(current_place_query, current_city, current_state, current_country)
      : null;
  const parsedCurrentTz =
    typeof current_timezone_offset === 'number' && !Number.isNaN(current_timezone_offset)
      ? current_timezone_offset
      : null;

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

  const v2ExtraPayload = {
    short_name:
      typeof short_name === 'string' && short_name.trim()
        ? short_name.trim().slice(0, 40)
        : null,
    is_default: wantsDefault,
    chart_fingerprint: chartFingerprint,
  };

  const currentLocPayload = {
    current_city: parsedCurrentPlace?.birthCity?.trim() || null,
    current_state: parsedCurrentPlace?.birthState?.trim() || null,
    current_country: parsedCurrentPlace?.birthCountry?.trim() || null,
    current_timezone_offset: parsedCurrentTz,
  };

  // Compile 1-time NatalTruthDossierV1 cleanly alongside birth chart creation
  const initialDossier = await compileNatalTruthDossier(compiled.chartJson, {
    includeNarrativeKernel: true,
  }).catch(() => null);

  const vedicInsertFields = initialDossier
    ? {
        natal_truth_dossier_json: initialDossier,
        natal_dossier_version: CURRENT_NATAL_DOSSIER_VERSION,
      }
    : {};

  let { data, error } = await supabaseAdmin
    .from('profiles')
    .insert({
      ...basePayload,
      ...v2ExtraPayload,
      ...currentLocPayload,
      ...vedicInsertFields,
    })
    .select(VEDIC_PROFILE_SUMMARY_COLUMNS)
    .single();

  if (error) {
    // Fallback if migration 011 dossier columns haven't been executed yet
    const legacyPrimary = await supabaseAdmin
      .from('profiles')
      .insert({
        ...basePayload,
        ...v2ExtraPayload,
        ...currentLocPayload,
      })
      .select(PROFILE_SUMMARY_COLUMNS)
      .single();

    if (!legacyPrimary.error && legacyPrimary.data) {
      data = withDefaultMetaFields(
        legacyPrimary.data as unknown as Record<string, unknown>
      ) as typeof data;
      error = null;
    } else {
      // Fallback if migration 005 (current_*) hasn't been executed yet
      const v2Retry = await supabaseAdmin
        .from('profiles')
        .insert({
          ...basePayload,
          ...v2ExtraPayload,
        })
        .select(V2_PROFILE_SUMMARY_COLUMNS)
        .single();

      if (!v2Retry.error && v2Retry.data) {
        data = withDefaultMetaFields(
          withEmptyCurrentLocation(v2Retry.data as unknown as Record<string, unknown>)
        ) as typeof data;
        error = null;
      } else {
        const fallback = await supabaseAdmin
          .from('profiles')
          .insert(basePayload)
          .select(BASE_PROFILE_SUMMARY_COLUMNS)
          .single();
        if (fallback.error || !fallback.data) {
          res.status(500).json({ error: 'Failed to save birth chart profile.' });
          return;
        }
        data = withDefaultMetaFields(
          withEmptyCurrentLocation({
            ...fallback.data,
            short_name: null,
            is_default: false,
          })
        ) as typeof data;
      }
    }
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
    is_starred,
    tags,
    relationship,
    birth_chart_pdf_url,
    birth_date,
    birth_time,
    birth_city,
    birth_state,
    birth_country,
    current_place_query,
    current_city,
    current_state,
    current_country,
    current_timezone_offset,
    gender,
  } = req.body || {};
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof name === 'string' && name.trim()) updates.name = name.trim();
  if (typeof short_name === 'string') updates.short_name = short_name.trim().slice(0, 40) || null;
  if (typeof is_starred === 'boolean') updates.is_starred = is_starred;
  const cleanedTags = normalizeProfileTags(tags);
  if (cleanedTags !== undefined) updates.tags = cleanedTags;
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

  // Current Location can always be updated even after chart activation
  if (
    current_place_query !== undefined ||
    current_city !== undefined ||
    current_state !== undefined ||
    current_country !== undefined
  ) {
    const hasAnyCurrent = Boolean(
      (typeof current_place_query === 'string' && current_place_query.trim()) ||
        (typeof current_city === 'string' && current_city.trim()) ||
        (typeof current_country === 'string' && current_country.trim())
    );
    if (!hasAnyCurrent) {
      updates.current_city = null;
      updates.current_state = null;
      updates.current_country = null;
      updates.current_timezone_offset = null;
    } else {
      const parsedCur = parseNaturalPlace(
        current_place_query,
        current_city,
        current_state,
        current_country
      );
      updates.current_city = parsedCur.birthCity || null;
      updates.current_state = parsedCur.birthState || null;
      updates.current_country = parsedCur.birthCountry || null;
      if (typeof current_timezone_offset === 'number' && !Number.isNaN(current_timezone_offset)) {
        updates.current_timezone_offset = current_timezone_offset;
      } else if (current_timezone_offset === null) {
        updates.current_timezone_offset = null;
      }
    }
  } else if (typeof current_timezone_offset === 'number' && !Number.isNaN(current_timezone_offset)) {
    updates.current_timezone_offset = current_timezone_offset;
  }

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
    const v3Updates = { ...updates };
    delete v3Updates.is_starred;
    delete v3Updates.tags;

    const v3Retry = await supabaseAdmin
      .from('profiles')
      .update(v3Updates)
      .eq('id', existing.id)
      .select(V3_PROFILE_SUMMARY_COLUMNS)
      .single();

    if (!v3Retry.error && v3Retry.data) {
      data = withDefaultMetaFields(
        v3Retry.data as unknown as Record<string, unknown>
      ) as unknown as typeof data;
      error = null;
    } else {
      const v2Updates = { ...v3Updates };
      delete v2Updates.current_city;
      delete v2Updates.current_state;
      delete v2Updates.current_country;
      delete v2Updates.current_timezone_offset;

      const v2Retry = await supabaseAdmin
        .from('profiles')
        .update(v2Updates)
        .eq('id', existing.id)
        .select(V2_PROFILE_SUMMARY_COLUMNS)
        .single();

      if (!v2Retry.error && v2Retry.data) {
        data = withDefaultMetaFields(
          withEmptyCurrentLocation(v2Retry.data as unknown as Record<string, unknown>)
        ) as unknown as typeof data;
        error = null;
      } else {
        const baseUpdates = { ...v2Updates };
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
        data = withDefaultMetaFields(
          withEmptyCurrentLocation({
            ...fallback.data,
            short_name: null,
            is_default: false,
          })
        ) as unknown as typeof data;
      }
    }
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

    const activationDossier = await compileNatalTruthDossier(compiled.chartJson, {
      includeNarrativeKernel: true,
    }).catch(() => null);

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

    const vedicActivationFields = activationDossier
      ? {
          natal_truth_dossier_json: activationDossier,
          natal_dossier_version: CURRENT_NATAL_DOSSIER_VERSION,
        }
      : {};

    let { data: updated, error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        ...activationPayload,
        ...vedicActivationFields,
        ...(geoFingerprint ? { chart_fingerprint: geoFingerprint } : {}),
      })
      .eq('id', profile.id)
      .select(VEDIC_PROFILE_DETAIL_COLUMNS)
      .single();

    if (updateErr) {
      const legacyRetry = await supabaseAdmin
        .from('profiles')
        .update({
          ...activationPayload,
          ...(geoFingerprint ? { chart_fingerprint: geoFingerprint } : {}),
        })
        .eq('id', profile.id)
        .select(PROFILE_DETAIL_COLUMNS)
        .single();
      updated = legacyRetry.data as typeof updated;
      updateErr = legacyRetry.error;
    }

    if (updateErr && geoFingerprint) {
      const retry = await supabaseAdmin
        .from('profiles')
        .update(activationPayload)
        .eq('id', profile.id)
        .select(PROFILE_DETAIL_COLUMNS)
        .single();
      updated = retry.data as typeof updated;
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

// Desh-Kaal-Patra: Save sanitized Life Context & compute deterministic 0-100% completeness
router.patch('/:id/life-context', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  if (!req.appUser.is_admin) {
    const rate = checkRateLimit(`life_context:${req.appUser.id}`, 40, 10 * 60 * 1000);
    if (!rate.allowed) {
      res.status(429).json({ error: 'Too many context updates recently. Please pause briefly.' });
      return;
    }
  }

  const isPatchRequest =
    Boolean(req.body) &&
    typeof req.body === 'object' &&
    !Array.isArray(req.body) &&
    Boolean((req.body as Record<string, unknown>).patch) &&
    typeof (req.body as Record<string, unknown>).patch === 'object';

  const selectCols = 'id, life_context_json';
  const primaryFetch = await supabaseAdmin
    .from('profiles')
    .select(selectCols)
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  let existing = primaryFetch.data as unknown as {
    id: string;
    life_context_json?: unknown;
  } | null;
  if (primaryFetch.error) {
    const fallbackFetch = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.appUser.id)
      .maybeSingle();
    existing = fallbackFetch.data as unknown as { id: string } | null;
  }

  if (!existing) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  const existingObj =
    existing.life_context_json &&
    typeof existing.life_context_json === 'object' &&
    !Array.isArray(existing.life_context_json)
      ? (existing.life_context_json as Record<string, unknown>)
      : {};

  let sanitizedPayload: ReturnType<typeof sanitizeLifeContext>;
  if (isPatchRequest) {
    sanitizedPayload = mergeLifeContextPatch(
      existingObj,
      (req.body as { patch: Partial<LifeContextData> }).patch
    );
  } else {
    const incomingBody =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};
    const preservedBody: Record<string, unknown> = { ...incomingBody };
    for (const bgKey of [
      'core_stress_areas',
      'cited_insights',
      'workplace_context',
      'children_summary',
    ]) {
      if (preservedBody[bgKey] === undefined && existingObj[bgKey] !== undefined) {
        preservedBody[bgKey] = existingObj[bgKey];
      }
    }
    sanitizedPayload = sanitizeLifeContext(preservedBody);
  }
  const { sanitized, completeness } = sanitizedPayload;
  const { data: updated, error } = await supabaseAdmin
    .from('profiles')
    .update({
      life_context_json: sanitized,
      life_context_completeness: completeness,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .eq('user_id', req.appUser.id)
    .select(VEDIC_PROFILE_SUMMARY_COLUMNS)
    .single();

  if (error || !updated) {
    const msg = String(error?.message || '');
    if (msg.toLowerCase().includes('life_context')) {
      res.status(503).json({
        error: 'Database migration 011 is required before saving Life Context details.',
        code: 'MIGRATION_011_REQUIRED',
      });
      return;
    }
    res.status(500).json({ error: 'Failed to save life context.' });
    return;
  }

  res.json({
    profile: withDefaultMetaFields(updated as unknown as Record<string, unknown>),
    life_context_json: sanitized,
    completeness,
  });
});

// Explicit Vedic NatalTruthDossierV1 recomputation (Layer A + Layer B)
router.post('/:id/recompute-dossier', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  if (!req.appUser.is_admin) {
    const rate = checkRateLimit(`recompute_dossier:${req.appUser.id}`, 8, 10 * 60 * 1000);
    if (!rate.allowed) {
      res.status(429).json({ error: 'Please wait a few minutes before refreshing another dossier.' });
      return;
    }
  }

  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from('profiles')
    .select('id, chart_json, life_context_json')
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  if (fetchErr || !profile) {
    // Fallback query if migration 011 column life_context_json doesn't exist yet
    const fallbackProfile = await supabaseAdmin
      .from('profiles')
      .select('id, chart_json')
      .eq('id', req.params.id)
      .eq('user_id', req.appUser.id)
      .maybeSingle();

    if (fallbackProfile.error || !fallbackProfile.data) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    if (!fallbackProfile.data.chart_json) {
      res.status(400).json({ error: 'Birth chart must be compiled before computing dossier.' });
      return;
    }

    const enrichedFallback = enrichCompiledChart(fallbackProfile.data.chart_json as CompiledChartData);
    const dossierFallback = await compileNatalTruthDossier(enrichedFallback.chartJson, {
      includeNarrativeKernel: true,
    });
    res.json({
      natal_truth_dossier_json: dossierFallback,
      natal_dossier_version: CURRENT_NATAL_DOSSIER_VERSION,
      persisted: false,
    });
    return;
  }

  if (!profile.chart_json) {
    res.status(400).json({ error: 'Birth chart must be compiled before computing dossier.' });
    return;
  }

  try {
    const enriched = enrichCompiledChart(profile.chart_json as CompiledChartData);
    const dossier = await compileNatalTruthDossier(enriched.chartJson, {
      lifeContext: profile.life_context_json as LifeContextData,
      includeNarrativeKernel: true,
    });

    const patch: Record<string, unknown> = {
      natal_truth_dossier_json: dossier,
      natal_dossier_version: CURRENT_NATAL_DOSSIER_VERSION,
      updated_at: new Date().toISOString(),
    };
    if (enriched.wasEnriched) {
      patch.chart_json = enriched.chartJson;
      patch.chart_text_context = enriched.chartTextContext;
    }

    const { error: saveErr } = await supabaseAdmin
      .from('profiles')
      .update(patch)
      .eq('id', profile.id)
      .eq('user_id', req.appUser.id);

    res.json({
      natal_truth_dossier_json: dossier,
      natal_dossier_version: CURRENT_NATAL_DOSSIER_VERSION,
      persisted: !saveErr,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to recompute dossier';
    res.status(500).json({ error: msg });
  }
});

export default router;
