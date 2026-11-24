import { Router } from 'express';
import {
  DEFAULT_COUNCIL_EXPERT_SLUG,
  normalizeCouncilSlug,
} from '../../lib/vedicTypes';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import {
  createOpenRouterCompletion,
  getUtilityModelAsync,
  isOpenRouterConfiguredAsync,
  safeExtractJson,
} from '../services/openrouter';
import { getOrFetchDailyTransits, isAstrologyApiConfigured } from '../services/astrologyApi';
import { enrichCompiledChart, type CompiledChartData } from '../services/chartCompiler';
import type { PlanetPosition, WesternPlanetPosition } from '../services/jyotishMath';
import {
  BIRTH_CHART_DOMAINS,
  FALLBACK_PLANET_QUIZ,
  PLANET_STRENGTH_PLANETS,
  buildFallbackMarkdownForApp,
  buildMiniAppPrompt,
  buildPlanetQuizGenerationPrompt,
  buildStructuredHeaderForApp,
  computeAppCacheKey,
} from '../services/miniAppsCatalog';
import {
  getDynamicAppBySlug,
  getDynamicMiniAppsPublicCatalog,
} from '../services/miniAppsRegistry';
import { getMiniAppsConfig } from '../services/platformSettings';
import { getPublicCompanionsCatalogCached } from '../services/companionPresets';
import type { PublicCompanionCard } from '../../components/app/chatTypes';
import type {
  MiniAppDefinition,
  MiniAppStructuredHeader,
  PlanetStrengthQuestion,
} from '../../components/app/miniAppsTypes';

const router = Router();

// In-memory cache fallback when migration 007 hasn't been applied yet
const memoryAppCache = new Map<
  string,
  {
    markdown: string;
    structured: MiniAppStructuredHeader | null;
    cachedAt: string;
  }
>();

export function clearMiniAppsMemoryCache(appSlug?: string): number {
  if (!appSlug) {
    const count = memoryAppCache.size;
    memoryAppCache.clear();
    return count;
  }
  let removed = 0;
  const marker = `:${appSlug}:`;
  for (const key of memoryAppCache.keys()) {
    if (key.includes(marker)) {
      memoryAppCache.delete(key);
      removed += 1;
    }
  }
  return removed;
}

// Helper removed in favor of getDynamicMiniAppsPublicCatalog() from miniAppsRegistry.ts

const EXPERT_META: Record<string, { title: string; subtitle: string }> = {
  [DEFAULT_COUNCIL_EXPERT_SLUG]: {
    title: 'Vedic Astrologer',
    subtitle: 'Parashari, KP, Jaimini & Dasha synthesis',
  },
  kp_precision: {
    title: 'KP Astrology',
    subtitle: 'Placidus Cuspal Sub-Lords & event timing',
  },
  jaimini: {
    title: 'Jaimini Jyotish',
    subtitle: 'Chara Karakas, Karakamsha & Chara Dasha',
  },
  western_astrologer: {
    title: 'Western Astrologer',
    subtitle: 'Tropical Zodiac, Placidus & aspects',
  },
  hellenistic_astrologer: {
    title: 'Hellenistic Astrologer',
    subtitle: 'Whole Sign houses, Sect, Hermetic Lots & Profections',
  },
  learn_astrology: {
    title: 'Learn Astrology',
    subtitle: 'Step-by-step Jyotish principles & chart mechanics',
  },
  modern_astrologer: {
    title: 'Modern Astrologer',
    subtitle: 'Psychological & evolutionary astrology',
  },
  tarot_reader: {
    title: 'Tarot',
    subtitle: '78-card Rider-Waite symbolic spreads',
  },
  numerologist: {
    title: 'Numerology',
    subtitle: 'Pythagorean Life Path & timing cycles',
  },
};

function formatTransitsSummary(
  planets: PlanetPosition[],
  chartJson?: CompiledChartData | null
): string {
  if (!planets.length) return '';
  const asc = chartJson?.planets?.find((p) => p.name === 'Ascendant');
  const moon = chartJson?.planets?.find((p) => p.name === 'Moon');
  const savArr = chartJson?.ashtakavarga?.sarva || [];
  const ascIdx = asc?.signIndex ?? null;
  const moonIdx = moon?.signIndex ?? null;

  return planets
    .filter((p) => p.name !== 'Ascendant')
    .map((p) => {
      const hLagna = ascIdx !== null ? `H${((p.signIndex - ascIdx + 12) % 12) + 1} Lagna` : '';
      const hMoon = moonIdx !== null ? `H${((p.signIndex - moonIdx + 12) % 12) + 1} Moon` : '';
      const sav = savArr.length === 12 ? `SAV ${savArr[p.signIndex] ?? 28}` : '';
      const extra = [hLagna, hMoon, sav].filter(Boolean).join(', ');
      return `- ${p.name}${p.isRetrograde ? ' (R)' : ''}: ${p.sign} ${p.dms} (${p.nakshatra})${extra ? ` [${extra}]` : ''}`;
    })
    .join('\n');
}

function formatWesternTransitsSummary(
  westernPlanets: WesternPlanetPosition[],
  chartJson?: CompiledChartData | null
): string {
  if (!westernPlanets.length) return '';
  const western = chartJson?.western;
  const ascLon = western?.angles?.ascendant?.longitude;
  const ascIdx = typeof ascLon === 'number' ? Math.floor(ascLon / 30) : null;
  const cusps = western?.cusps || [];

  const findPlacidusHouse = (lon: number): string => {
    if (cusps.length !== 12) return '';
    for (let i = 0; i < 12; i++) {
      const cStart = cusps[i].longitude;
      const cNext = cusps[(i + 1) % 12].longitude;
      if (cStart < cNext) {
        if (lon >= cStart && lon < cNext) return `Placidus H${cusps[i].house}`;
      } else if (lon >= cStart || lon < cNext) {
        return `Placidus H${cusps[i].house}`;
      }
    }
    return '';
  };

  return westernPlanets
    .filter((p) => p.name !== 'Ascendant')
    .map((p) => {
      const pHouse = findPlacidusHouse(p.longitude);
      const wsHouse = ascIdx !== null ? `WS H${((p.signIndex - ascIdx + 12) % 12) + 1}` : '';
      const extra = [pHouse, wsHouse].filter(Boolean).join(', ');
      return `- ${p.name}${p.isRetrograde ? ' (Rx)' : ''}: ${p.sign} ${p.dms}${extra ? ` [${extra}]` : ''}`;
    })
    .join('\n');
}

async function logAppUsageSafe(params: {
  userId: string;
  profileId: string | null;
  appSlug: string;
  cacheHit: boolean;
  tokensIn: number;
  tokensOut: number;
  modelUsed: string | null;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.from('app_usage_logs').insert({
      user_id: params.userId,
      profile_id: params.profileId,
      app_slug: params.appSlug,
      cache_hit: params.cacheHit,
      tokens_in: params.tokensIn,
      tokens_out: params.tokensOut,
      model_used: params.modelUsed,
    });
  } catch {
    // Non-fatal if migration 007 has not run yet
  }
}

// =============================================================================
// GET /api/apps/catalog — Full catalog, Breakdown domains, favorites, recent runs
// =============================================================================
router.get('/catalog', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  let favoriteSlugs: string[] = [];
  let recentRuns: Array<{ app_slug: string; created_at: string }> = [];

  try {
    const [favRes, logRes] = await Promise.all([
      supabaseAdmin
        .from('user_favorite_apps')
        .select('app_slug')
        .eq('user_id', req.appUser.id),
      supabaseAdmin
        .from('app_usage_logs')
        .select('app_slug, created_at')
        .eq('user_id', req.appUser.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (!favRes.error && favRes.data) {
      favoriteSlugs = favRes.data.map((r) => String(r.app_slug));
    }
    if (!logRes.error && logRes.data) {
      const seen = new Set<string>();
      for (const row of logRes.data) {
        const slug = String(row.app_slug);
        if (!seen.has(slug)) {
          seen.add(slug);
          recentRuns.push({ app_slug: slug, created_at: String(row.created_at) });
        }
        if (recentRuns.length >= 6) break;
      }
    }
  } catch {
    // Graceful pre-migration fallback
  }

  const publicCatalog = await getDynamicMiniAppsPublicCatalog();

  res.json({
    categories: publicCatalog.categories,
    apps: publicCatalog.apps,
    breakdownDomains: BIRTH_CHART_DOMAINS.map((d) => ({
      id: d.id,
      title: d.title,
      subtitle: d.subtitle,
      topics: d.topics.map((t) => ({
        id: t.id,
        label: t.label,
        summary: t.summary,
      })),
    })),
    favoriteSlugs,
    recentRuns,
  });
});

// =============================================================================
// GET /api/apps/usage-summary — Calm 30-day feature activity summary for user
// =============================================================================
router.get('/usage-summary', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const tier = req.appUser.tier || 'personal';
  const creditBaseline = tier === 'guru' ? 80000 : tier === 'pro' ? 25000 : 5000;
  const lowCreditsThreshold = Math.round(creditBaseline * 0.1);

  let totalAppRuns30d = 0;
  let cachedAppRuns30d = 0;
  let freshAppRuns30d = 0;
  let topApps: Array<{ slug: string; title: string; runs: number; lastUsedAt: string }> = [];
  let chatMessages30d = 0;
  let reportOrders30d = 0;

  try {
    const [appLogsRes, userConvsRes, reportOrdersRes] = await Promise.all([
      supabaseAdmin
        .from('app_usage_logs')
        .select('app_slug, cache_hit, created_at')
        .eq('user_id', req.appUser.id)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(500),
      supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('user_id', req.appUser.id)
        .gte('updated_at', thirtyDaysAgo)
        .limit(200),
      supabaseAdmin
        .from('report_orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', req.appUser.id)
        .gte('created_at', thirtyDaysAgo),
    ]);

    if (!appLogsRes.error && Array.isArray(appLogsRes.data)) {
      const bySlug = new Map<string, { runs: number; lastUsedAt: string }>();
      for (const row of appLogsRes.data) {
        totalAppRuns30d += 1;
        if (row.cache_hit) {
          cachedAppRuns30d += 1;
        } else {
          freshAppRuns30d += 1;
        }
        const slug = String(row.app_slug || '');
        if (!slug) continue;
        const existing = bySlug.get(slug);
        const createdAt = String(row.created_at || '');
        if (!existing) {
          bySlug.set(slug, { runs: 1, lastUsedAt: createdAt });
        } else {
          existing.runs += 1;
        }
      }
      const { apps: catalogApps } = await getDynamicMiniAppsPublicCatalog();
      const titleLookup = new Map<string, string>(
        catalogApps.map((a) => [a.slug, a.shortTitle || a.title])
      );
      topApps = Array.from(bySlug.entries())
        .map(([slug, info]) => ({
          slug,
          title: titleLookup.get(slug) || slug,
          runs: info.runs,
          lastUsedAt: info.lastUsedAt,
        }))
        .sort((a, b) => b.runs - a.runs)
        .slice(0, 8);
    }

    if (!userConvsRes.error && Array.isArray(userConvsRes.data) && userConvsRes.data.length > 0) {
      const convIds = userConvsRes.data.map((c) => c.id);
      const { count } = await supabaseAdmin
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .eq('role', 'user')
        .gte('created_at', thirtyDaysAgo);
      chatMessages30d = count || 0;
    }

    if (!reportOrdersRes.error && typeof reportOrdersRes.count === 'number') {
      reportOrders30d = reportOrdersRes.count;
    }
  } catch {
    // Graceful pre-migration fallback
  }

  res.json({
    periodDays: 30,
    creditsBalance: req.appUser.credits_balance,
    creditBaseline,
    lowCreditsThreshold,
    isLowCredits: req.appUser.credits_balance < lowCreditsThreshold,
    miniApps: {
      totalRuns: totalAppRuns30d,
      cachedRuns: cachedAppRuns30d,
      freshRuns: freshAppRuns30d,
      topApps,
    },
    chatQuestions30d: chatMessages30d,
    reportOrders30d,
  });
});

// =============================================================================
// POST /api/apps/favorites/toggle — Favorite / un-favorite a Mini-App
// =============================================================================
router.post('/favorites/toggle', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const appSlug = typeof req.body?.appSlug === 'string' ? req.body.appSlug.trim() : '';
  const matchedApp = appSlug ? await getDynamicAppBySlug(appSlug) : null;
  if (!appSlug || !matchedApp) {
    res.status(400).json({ error: 'Unknown mini-app slug' });
    return;
  }

  try {
    const { data: existing, error: selErr } = await supabaseAdmin
      .from('user_favorite_apps')
      .select('app_slug')
      .eq('user_id', req.appUser.id)
      .eq('app_slug', appSlug)
      .maybeSingle();

    if (selErr) {
      res.json({ appSlug, isFavorite: Boolean(req.body?.desired), persisted: false });
      return;
    }

    if (existing) {
      await supabaseAdmin
        .from('user_favorite_apps')
        .delete()
        .eq('user_id', req.appUser.id)
        .eq('app_slug', appSlug);
      res.json({ appSlug, isFavorite: false, persisted: true });
      return;
    }

    await supabaseAdmin.from('user_favorite_apps').insert({
      user_id: req.appUser.id,
      app_slug: appSlug,
    });
    res.json({ appSlug, isFavorite: true, persisted: true });
  } catch {
    res.json({ appSlug, isFavorite: Boolean(req.body?.desired), persisted: false });
  }
});

// =============================================================================
// GET /api/apps/home-summary — Lightweight payload for Unified Home Hub
// =============================================================================
router.get('/home-summary', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  // 1. Minimal profile map (never select chart_json / chart_text_context / natal_truth_dossier_json)
  const profileMap = new Map<string, string>();
  let primaryProfile: {
    id: string;
    name: string;
    short_name: string | null;
    is_default: boolean;
    life_context_json: Record<string, unknown>;
    life_context_completeness: number;
  } | null = null;

  const profSummaryRes = await supabaseAdmin
    .from('profiles')
    .select('id, name, short_name, is_default, life_context_json, life_context_completeness')
    .eq('user_id', req.appUser.id)
    .order('created_at', { ascending: false });

  if (!profSummaryRes.error && profSummaryRes.data) {
    for (const p of profSummaryRes.data) {
      const label = p.is_default
        ? p.short_name
          ? `You (${p.short_name})`
          : 'You'
        : String(p.short_name || p.name);
      profileMap.set(String(p.id), label);

      const candidate = {
        id: String(p.id),
        name: String(p.name),
        short_name: p.short_name ? String(p.short_name) : null,
        is_default: Boolean(p.is_default),
        life_context_json:
          p.life_context_json && typeof p.life_context_json === 'object' && !Array.isArray(p.life_context_json)
            ? (p.life_context_json as Record<string, unknown>)
            : {},
        life_context_completeness:
          typeof p.life_context_completeness === 'number' ? p.life_context_completeness : 0,
      };
      if (!primaryProfile || (candidate.is_default && !primaryProfile.is_default)) {
        primaryProfile = candidate;
      }
    }
  } else {
    const profRes = await supabaseAdmin
      .from('profiles')
      .select('id, name, short_name, is_default')
      .eq('user_id', req.appUser.id);
    if (!profRes.error && profRes.data) {
      for (const p of profRes.data) {
        const label = p.is_default
          ? p.short_name
            ? `You (${p.short_name})`
            : 'You'
          : String(p.short_name || p.name);
        profileMap.set(String(p.id), label);

        const candidate = {
          id: String(p.id),
          name: String(p.name),
          short_name: p.short_name ? String(p.short_name) : null,
          is_default: Boolean(p.is_default),
          life_context_json: {},
          life_context_completeness: 0,
        };
        if (!primaryProfile || (candidate.is_default && !primaryProfile.is_default)) {
          primaryProfile = candidate;
        }
      }
    } else {
      const profFallback = await supabaseAdmin
        .from('profiles')
        .select('id, name')
        .eq('user_id', req.appUser.id);
      for (const p of profFallback.data || []) {
        profileMap.set(String(p.id), String(p.name));
        if (!primaryProfile) {
          primaryProfile = {
            id: String(p.id),
            name: String(p.name),
            short_name: null,
            is_default: true,
            life_context_json: {},
            life_context_completeness: 0,
          };
        }
      }
    }
  }

  // 2. Recent conversations (3-tier migration-safe select, zero heavy columns)
  interface RawConvRow {
    id: string;
    title: string;
    profile_id: string | null;
    pillar?: string | null;
    companion_slug?: string | null;
    companion_persona_json?: {
      slug?: string;
      name?: string;
      role_label?: string;
      avatar_url?: string | null;
      monogram_palette?: { bg: string; ring: string; ink: string } | null;
    } | null;
    updated_at: string;
  }

  let convRows: RawConvRow[] = [];
  const convV7 = await supabaseAdmin
    .from('conversations')
    .select('id, title, profile_id, pillar, companion_slug, companion_persona_json, updated_at')
    .eq('user_id', req.appUser.id)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (!convV7.error && convV7.data) {
    convRows = convV7.data as RawConvRow[];
  } else {
    const convV6 = await supabaseAdmin
      .from('conversations')
      .select('id, title, profile_id, pillar, companion_persona_json, updated_at')
      .eq('user_id', req.appUser.id)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (!convV6.error && convV6.data) {
      convRows = convV6.data as RawConvRow[];
    } else {
      const convBase = await supabaseAdmin
        .from('conversations')
        .select('id, title, profile_id, updated_at')
        .eq('user_id', req.appUser.id)
        .order('updated_at', { ascending: false })
        .limit(20);
      convRows = (convBase.data || []) as RawConvRow[];
    }
  }

  const companionCatalog = await getPublicCompanionsCatalogCached().catch(
    (): PublicCompanionCard[] => []
  );
  const companionBySlug = new Map<string, PublicCompanionCard>(
    companionCatalog.map((c): [string, PublicCompanionCard] => [c.slug.toLowerCase(), c])
  );
  const lastConvIdBySlug = new Map<string, string>();
  for (const c of convRows) {
    const slugKey = String(
      c.companion_slug || c.companion_persona_json?.slug || ''
    )
      .trim()
      .toLowerCase();
    if (slugKey && !lastConvIdBySlug.has(slugKey)) {
      lastConvIdBySlug.set(slugKey, c.id);
    }
  }

  const visibleConvs = convRows.filter((c) => c.pillar !== 'clarity');
  const recentConversations = visibleConvs.slice(0, 4).map((c) => {
    const isCompanion = c.pillar === 'companion' || Boolean(c.companion_persona_json?.name);
    const resolvedSlug = String(
      c.companion_slug || c.companion_persona_json?.slug || ''
    )
      .trim()
      .toLowerCase();
    const matchedCard = resolvedSlug ? companionBySlug.get(resolvedSlug) : undefined;
    return {
      id: c.id,
      title: c.title,
      pillar: (isCompanion ? 'companion' : 'council') as 'council' | 'companion' | 'clarity',
      profile_id: c.profile_id || null,
      profile_label: c.profile_id ? profileMap.get(c.profile_id) || null : null,
      companion_slug: resolvedSlug || null,
      companion_name: matchedCard?.name || c.companion_persona_json?.name || null,
      companion_role: matchedCard?.primary_expertise || c.companion_persona_json?.role_label || null,
      avatar_url: matchedCard?.avatar_url ?? c.companion_persona_json?.avatar_url ?? null,
      monogram_palette:
        matchedCard?.monogram_palette ?? c.companion_persona_json?.monogram_palette ?? null,
      updated_at: c.updated_at,
    };
  });

  // 3. Council Guides (All 6 Council experts; Companions render in the Companions grid below)

  const featuredSlugs = ['dev', 'nandini', 'luna', 'marc', 'bella', 'mira', 'aira', 'kabir', 'rohan', 'nikhil', 'neha', 'robin'];
  const featuredSet = new Set<string>();
  const orderedFeaturedCards = [];
  for (const slug of featuredSlugs) {
    const card = companionBySlug.get(slug);
    if (card && !featuredSet.has(card.slug)) {
      featuredSet.add(card.slug);
      orderedFeaturedCards.push(card);
    }
  }
  for (const card of companionCatalog) {
    if (!featuredSet.has(card.slug)) {
      featuredSet.add(card.slug);
      orderedFeaturedCards.push(card);
    }
  }
  const featuredCompanions = orderedFeaturedCards.map((card) => ({
    slug: card.slug,
    name: card.name,
    age: card.age,
    sex: card.sex,
    primary_expertise: card.primary_expertise,
    card_subtitle: card.card_subtitle,
    secondary_expertise: card.secondary_expertise,
    category_tag: card.category_tag,
    companion_group: card.companion_group,
    advisory_mode: card.advisory_mode,
    chart_access: card.chart_access,
    discoverable_tags: card.discoverable_tags,
    situation_tags: card.situation_tags,
    gender_variants: card.gender_variants,
    supports_gender_toggle: card.supports_gender_toggle,
    skill_level: card.skill_level,
    tagline: card.tagline,
    short_bio: card.short_bio,
    how_conversations_feel: card.how_conversations_feel,
    avatar_url: card.avatar_url,
    monogram_palette: card.monogram_palette,
    last_conversation_id: lastConvIdBySlug.get(card.slug.toLowerCase()) || null,
  }));

  // Look up latest activity per Council guide across recent conversations
  const councilConvIds = visibleConvs
    .filter((c) => c.pillar !== 'companion' && !c.companion_persona_json?.name)
    .slice(0, 12)
    .map((c) => c.id);

  const expertActivity = new Map<string, { conversationId: string; lastActiveAt: string }>();
  if (councilConvIds.length > 0) {
    const { data: msgExperts } = await supabaseAdmin
      .from('messages')
      .select('conversation_id, expert_used, created_at')
      .in('conversation_id', councilConvIds)
      .eq('role', 'assistant')
      .not('expert_used', 'is', null)
      .order('created_at', { ascending: false })
      .limit(36);

    for (const m of msgExperts || []) {
      const rawSlug = String(m.expert_used || '').trim();
      if (!rawSlug || rawSlug.startsWith('companion') || rawSlug === 'clarity') {
        continue;
      }
      const slug = normalizeCouncilSlug(rawSlug);
      if (expertActivity.has(slug)) continue;
      expertActivity.set(slug, {
        conversationId: String(m.conversation_id),
        lastActiveAt: String(m.created_at),
      });
    }
  }

  const orderedSlugs = [
    DEFAULT_COUNCIL_EXPERT_SLUG,
    'kp_precision',
    'jaimini',
    'western_astrologer',
    'hellenistic_astrologer',
    'learn_astrology',
  ] as const;

  const recentGuides: Array<{
    kind: 'council' | 'companion';
    id: string;
    title: string;
    subtitle: string;
    expertSlug?: string;
    companionSlug?: string;
    avatarUrl?: string | null;
    monogramPalette?: { bg: string; ring: string; ink: string } | null;
    conversationId?: string;
    lastActiveAt?: string;
  }> = [
    ...orderedSlugs.map((slug) => {
      const meta = EXPERT_META[slug];
      const act = expertActivity.get(slug);
      return {
        kind: 'council' as const,
        id: `expert-${slug}`,
        title: meta.title,
        subtitle: meta.subtitle,
        expertSlug: slug,
        ...(act ? { conversationId: act.conversationId, lastActiveAt: act.lastActiveAt } : {}),
      };
    }),
  ];

  // 4. Favorites & recent Mini-App runs
  let favoriteAppSlugs: string[] = [];
  let recentAppRuns: Array<{ app_slug: string; updated_at: string }> = [];
  try {
    const [favRes, usageRes] = await Promise.all([
      supabaseAdmin
        .from('user_favorite_apps')
        .select('app_slug')
        .eq('user_id', req.appUser.id),
      supabaseAdmin
        .from('app_usage_logs')
        .select('app_slug, created_at')
        .eq('user_id', req.appUser.id)
        .order('created_at', { ascending: false })
        .limit(12),
    ]);
    if (!favRes.error && favRes.data) {
      favoriteAppSlugs = favRes.data.map((r) => String(r.app_slug));
    }
    if (!usageRes.error && usageRes.data) {
      const seenApps = new Set<string>();
      for (const r of usageRes.data) {
        const slug = String(r.app_slug);
        if (!seenApps.has(slug)) {
          seenApps.add(slug);
          recentAppRuns.push({ app_slug: slug, updated_at: String(r.created_at) });
        }
        if (recentAppRuns.length >= 4) break;
      }
    }
  } catch {
    // Graceful pre-migration fallback
  }

  res.json({
    recentConversations,
    recentGuides: recentGuides.slice(0, 6),
    featuredCompanions,
    favoriteAppSlugs,
    recentAppRuns,
    primaryProfile,
  });
});

// =============================================================================
// GET /api/apps/:slug/readings — Past readings history for a Mini-App
// =============================================================================
router.get('/:slug/readings', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const slug = String(req.params.slug || '').trim();
  const appDef = await getDynamicAppBySlug(slug);
  if (!appDef) {
    res.status(404).json({ error: 'Mini-App not found' });
    return;
  }

  const profileId =
    typeof req.query.profileId === 'string' && req.query.profileId.trim()
      ? req.query.profileId.trim()
      : null;
  const astrologyMode =
    req.query.astrologyMode === 'vedic' || req.query.astrologyMode === 'western'
      ? req.query.astrologyMode
      : null;

  try {
    let query = supabaseAdmin
      .from('mini_app_readings')
      .select('id, profile_id, app_slug, astrology_mode, title, inputs_json, structured_json, markdown, created_at')
      .eq('user_id', req.appUser.id)
      .eq('app_slug', slug)
      .order('created_at', { ascending: false })
      .limit(20);

    if (profileId) {
      query = query.eq('profile_id', profileId);
    }
    if (astrologyMode) {
      query = query.eq('astrology_mode', astrologyMode);
    }

    const { data: rows, error } = await query;
    if (error || !rows) {
      res.json({ readings: [] });
      return;
    }

    const { data: profRows } = await supabaseAdmin
      .from('profiles')
      .select('id, name, short_name, is_default')
      .eq('user_id', req.appUser.id);
    const profMap = new Map<string, string>();
    for (const p of profRows || []) {
      const label = p.is_default
        ? p.short_name
          ? `You (${p.short_name})`
          : 'You'
        : String(p.short_name || p.name);
      profMap.set(String(p.id), label);
    }

    const readings = rows.map((r) => ({
      id: r.id,
      profile_id: r.profile_id,
      profile_name: r.profile_id ? profMap.get(String(r.profile_id)) || null : null,
      app_slug: r.app_slug,
      astrology_mode: (r.astrology_mode === 'western' ? 'western' : 'vedic') as 'vedic' | 'western',
      title: r.title,
      inputs_json: r.inputs_json,
      structured_json: (r.structured_json as MiniAppStructuredHeader | null) || null,
      markdown: r.markdown,
      created_at: r.created_at,
    }));

    res.json({ readings });
  } catch {
    res.json({ readings: [] });
  }
});

// =============================================================================
// POST /api/apps/:slug/run — Execute any Mini-App with DB caching, history & logs
// =============================================================================
router.post('/:slug/run', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const slug = String(req.params.slug || '').trim();
  const appDef = await getDynamicAppBySlug(slug);
  if (!appDef) {
    res.status(404).json({ error: 'Mini-App not found' });
    return;
  }

  const miniAppsCfg = await getMiniAppsConfig();
  const appOverride = miniAppsCfg.overrides[slug];
  if (!appDef.isActive || (appOverride && appOverride.enabled === false)) {
    res.status(403).json({
      error: 'This app is currently paused.',
      code: 'APP_DISABLED',
    });
    return;
  }

  const body = (req.body || {}) as {
    profileId?: string | null;
    partnerProfileId?: string | null;
    forceRefresh?: boolean;
    astrologyMode?: 'vedic' | 'western' | string;
    action?: 'run' | 'generate_quiz';
    inputs?: Record<string, unknown>;
  };

  const astrologyMode: 'vedic' | 'western' =
    body.astrologyMode === 'western'
      ? 'western'
      : body.astrologyMode === 'vedic'
      ? 'vedic'
      : req.appUser.default_astrology_mode === 'western'
      ? 'western'
      : 'vedic';

  const inputs = body.inputs || {};
  const forceRefresh = Boolean(body.forceRefresh);
  const requestedProfileId =
    typeof body.profileId === 'string' && body.profileId.trim() ? body.profileId.trim() : null;

  // Load selected profile (or user's default/first activated profile)
  interface FullProfileRow {
    id: string;
    name: string;
    short_name?: string | null;
    is_default?: boolean | null;
    birth_date: string;
    birth_time: string;
    birth_city: string;
    birth_country: string;
    current_city?: string | null;
    current_country?: string | null;
    gender?: string | null;
    is_activated: boolean;
    chart_json?: CompiledChartData | null;
    chart_text_context?: string | null;
  }

  let profile: FullProfileRow | null = null;
  const selectWithV5 =
    'id, name, short_name, is_default, birth_date, birth_time, birth_city, birth_country, current_city, current_country, gender, is_activated, chart_json, chart_text_context';
  const selectBase =
    'id, name, birth_date, birth_time, birth_city, birth_country, gender, is_activated, chart_json, chart_text_context';

  const loadSingleProfile = async (pid: string): Promise<FullProfileRow | null> => {
    const r1 = await supabaseAdmin
      .from('profiles')
      .select(selectWithV5)
      .eq('id', pid)
      .eq('user_id', req.appUser!.id)
      .maybeSingle();
    if (!r1.error && r1.data) return r1.data as FullProfileRow;
    const r2 = await supabaseAdmin
      .from('profiles')
      .select(selectBase)
      .eq('id', pid)
      .eq('user_id', req.appUser!.id)
      .maybeSingle();
    return (r2.data as FullProfileRow) || null;
  };

  if (requestedProfileId) {
    profile = await loadSingleProfile(requestedProfileId);
  } else {
    // Pick user's default profile or most recent activated profile
    const listRes = await supabaseAdmin
      .from('profiles')
      .select('id, is_default, is_activated, created_at')
      .eq('user_id', req.appUser.id)
      .order('created_at', { ascending: false });
    const rows = listRes.error
      ? (
          await supabaseAdmin
            .from('profiles')
            .select('id, is_activated, created_at')
            .eq('user_id', req.appUser.id)
            .order('created_at', { ascending: false })
        ).data || []
      : listRes.data || [];

    const chosen =
      rows.find((r: Record<string, unknown>) => Boolean(r.is_default)) ||
      rows.find((r: Record<string, unknown>) => Boolean(r.is_activated)) ||
      rows[0];
    if (chosen?.id) {
      profile = await loadSingleProfile(String(chosen.id));
    }
  }

  // Enrich legacy Vedic-only compiled charts in memory when running in Western mode
  if (profile?.chart_json && !profile.chart_json.western && profile.chart_json.planets?.length) {
    try {
      profile = {
        ...profile,
        chart_json: enrichCompiledChart(profile.chart_json).chartJson,
      };
    } catch {
      // Keep original chart_json if enrichment fails
    }
  }

  // Special flow: Planet Strength Tester — Generate Quiz Questions
  if (slug === 'planet-strength-tester' && body.action === 'generate_quiz') {
    const rawPlanet = String(inputs.planet || 'Sun').trim();
    const planet = (PLANET_STRENGTH_PLANETS as readonly string[]).includes(rawPlanet)
      ? rawPlanet
      : 'Sun';

    const westernPlanet = profile?.chart_json?.western?.planets?.find((p) => p.name === planet) || null;
    const natalPlanet = profile?.chart_json?.planets?.find((p) => p.name === planet) || null;
    let questions: PlanetStrengthQuestion[] = FALLBACK_PLANET_QUIZ[planet] || FALLBACK_PLANET_QUIZ.Sun;

    if (await isOpenRouterConfiguredAsync()) {
      try {
        const model = await getUtilityModelAsync();
        const promptSpec = buildPlanetQuizGenerationPrompt(planet);
        const completion = await createOpenRouterCompletion({
          model,
          system: promptSpec.system,
          messages: [{ role: 'user', content: promptSpec.user }],
          jsonMode: true,
          temperature: 0.5,
          maxTokens: 900,
        });
        const parsed = safeExtractJson<{ questions?: PlanetStrengthQuestion[] }>(completion.text, {});
        if (
          Array.isArray(parsed.questions) &&
          parsed.questions.length === 5 &&
          parsed.questions.every(
            (q) => typeof q.question === 'string' && Array.isArray(q.options) && q.options.length === 4
          )
        ) {
          questions = parsed.questions;
        }
      } catch {
        // Use curated fallback quiz questions
      }
    }

    res.json({
      slug,
      markdown: '',
      structured: null,
      cacheHit: false,
      cachedAt: new Date().toISOString(),
      astrologyMode,
      profileUsed: profile
        ? { id: profile.id, name: profile.name, short_name: profile.short_name ?? null }
        : null,
      questions,
      planetNatalContext:
        astrologyMode === 'western' && westernPlanet
          ? {
              planet: westernPlanet.name,
              sign: westernPlanet.sign,
              house: westernPlanet.house,
              isRetrograde: westernPlanet.isRetrograde,
            }
          : natalPlanet
          ? {
              planet: natalPlanet.name,
              sign: natalPlanet.sign,
              house: natalPlanet.house,
              nakshatra: natalPlanet.nakshatra,
              dignity: natalPlanet.dignity,
              isRetrograde: natalPlanet.isRetrograde,
            }
          : null,
    });
    return;
  }

  if (appDef.requiresProfile && !profile) {
    res.status(400).json({
      error: 'Please add a birth profile first to personalize this app.',
      code: 'PROFILE_REQUIRED',
    });
    return;
  }

  // Compute cache key for cacheable apps (mode-scoped!)
  const isCacheable = appDef.cacheScope !== 'none';
  const cacheKey = computeAppCacheKey(appDef, {
    domainId: typeof inputs.domainId === 'string' ? inputs.domainId : undefined,
    topicId: typeof inputs.topicId === 'string' ? inputs.topicId : undefined,
    astrologyMode,
  });
  const memKey = `${req.appUser.id}:${profile?.id || 'none'}:${slug}:${astrologyMode}:${cacheKey}`;

  if (isCacheable && !forceRefresh) {
    // 1. Check Supabase app_cache first
    try {
      let query = supabaseAdmin
        .from('app_cache')
        .select('content_markdown, structured_json, updated_at')
        .eq('user_id', req.appUser.id)
        .eq('app_slug', slug)
        .eq('cache_key', cacheKey);

      query = profile?.id ? query.eq('profile_id', profile.id) : query.is('profile_id', null);

      const { data: cachedRow, error: cacheErr } = await query.maybeSingle();
      if (!cacheErr && cachedRow?.content_markdown) {
        void logAppUsageSafe({
          userId: req.appUser.id,
          profileId: profile?.id || null,
          appSlug: slug,
          cacheHit: true,
          tokensIn: 0,
          tokensOut: 0,
          modelUsed: null,
        });
        res.json({
          slug,
          markdown: String(cachedRow.content_markdown),
          structured: (cachedRow.structured_json as MiniAppStructuredHeader | null) || null,
          cacheHit: true,
          cachedAt: String(cachedRow.updated_at),
          astrologyMode,
          readingId: null,
          profileUsed: profile
            ? { id: profile.id, name: profile.name, short_name: profile.short_name ?? null }
            : null,
        });
        return;
      }
    } catch {
      // Fall through to memory cache
    }

    // 2. Check in-memory cache fallback
    const memHit = memoryAppCache.get(memKey);
    if (memHit) {
      void logAppUsageSafe({
        userId: req.appUser.id,
        profileId: profile?.id || null,
        appSlug: slug,
        cacheHit: true,
        tokensIn: 0,
        tokensOut: 0,
        modelUsed: null,
      });
      res.json({
        slug,
        markdown: memHit.markdown,
        structured: memHit.structured,
        cacheHit: true,
        cachedAt: memHit.cachedAt,
        astrologyMode,
        readingId: null,
        profileUsed: profile
          ? { id: profile.id, name: profile.name, short_name: profile.short_name ?? null }
          : null,
      });
      return;
    }
  }

  // Load optional partner profile for Love Compatibility & Birth Chart Matching
  let partnerProfile: FullProfileRow | null = null;
  if (
    (slug === 'love-compatibility' || slug === 'birth-chart-matching') &&
    typeof body.partnerProfileId === 'string' &&
    body.partnerProfileId.trim()
  ) {
    partnerProfile = await loadSingleProfile(body.partnerProfileId.trim());
    if (
      partnerProfile?.chart_json &&
      !partnerProfile.chart_json.western &&
      partnerProfile.chart_json.planets?.length
    ) {
      try {
        partnerProfile = {
          ...partnerProfile,
          chart_json: enrichCompiledChart(partnerProfile.chart_json).chartJson,
        };
      } catch {
        // Keep original partner chart_json
      }
    }
  }

  // Enforce generous daily live-run soft cap (cached reads never count against cap; admins exempt)
  if (!req.appUser.is_admin && miniAppsCfg.daily_live_runs_soft_cap > 0) {
    try {
      const startOfUtcDay = new Date();
      startOfUtcDay.setUTCHours(0, 0, 0, 0);
      const { count, error: capErr } = await supabaseAdmin
        .from('app_usage_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', req.appUser.id)
        .eq('cache_hit', false)
        .gte('created_at', startOfUtcDay.toISOString());

      if (!capErr && typeof count === 'number' && count >= miniAppsCfg.daily_live_runs_soft_cap) {
        res.status(429).json({
          error: `You have reached today’s complimentary fresh-reading limit (${miniAppsCfg.daily_live_runs_soft_cap} live generations/day). Saved/cached readings remain open, or continue exploring anytime in Chat.`,
          code: 'DAILY_APP_CAP',
        });
        return;
      }
    } catch {
      // Non-fatal if migration 007 hasn't run yet
    }
  }

  // Fetch live platform-cached Gochar + Tropical transits for timing-aware apps
  const needsTransits =
    [
      'daily-horoscope',
      'weekly-horoscope',
      'monthly-horoscope',
      'current-transits',
      'dasha-analysis',
      'wealth-blueprint',
      'love-forecast',
      'career-navigator',
      'salary-negotiator',
      'jupiter-opportunities',
      'breakup-clarity',
    ].includes(slug) ||
    appDef.category === 'daily_timing' ||
    ['daily', 'weekly', 'monthly'].includes(appDef.cacheScope);

  let transitPlanets: PlanetPosition[] = [];
  let westernTransitPlanets: WesternPlanetPosition[] = [];
  let transitDate: string | null = null;
  if (needsTransits && isAstrologyApiConfigured()) {
    try {
      const gochar = await getOrFetchDailyTransits();
      transitPlanets = gochar.planets;
      westernTransitPlanets = gochar.westernPlanets || [];
      transitDate = gochar.transitDate;
    } catch {
      // Proceed gracefully without Gochar table if API temporarily unavailable
    }
  }

  const structured = buildStructuredHeaderForApp({
    slug,
    profileName: profile?.name,
    birthDate: profile?.birth_date,
    chartJson: profile?.chart_json || null,
    transitPlanets,
    westernTransitPlanets,
    transitDate,
    astrologyMode,
  });

  const transitSummary =
    astrologyMode === 'western'
      ? formatWesternTransitsSummary(westernTransitPlanets, profile?.chart_json || null)
      : formatTransitsSummary(transitPlanets, profile?.chart_json || null);

  const promptSpec = buildMiniAppPrompt({
    slug,
    astrologyMode,
    profile,
    partnerProfile,
    transitSummary: transitSummary || null,
    inputs,
    customPrompts: {
      vedicPrompt: appDef.vedicPrompt,
      westernPrompt: appDef.westernPrompt,
      systemOverride: appDef.systemOverride,
      rules: appDef.rules,
      title: appDef.title,
      description: appDef.description,
    },
  });

  let markdown = '';
  let tokensIn = 0;
  let tokensOut = 0;
  let modelUsed: string | null = null;

  if (await isOpenRouterConfiguredAsync()) {
    try {
      const fallbackUtilityModel = await getUtilityModelAsync();
      modelUsed =
        appDef.modelId || appOverride?.model_id || miniAppsCfg.default_model_id || fallbackUtilityModel;
      const completion = await createOpenRouterCompletion({
        model: modelUsed,
        system: promptSpec.system,
        messages: [{ role: 'user', content: promptSpec.user }],
        temperature: 0.45,
        maxTokens: 1600,
      });
      markdown = completion.text.trim();
      tokensIn = completion.tokensIn;
      tokensOut = completion.tokensOut;
    } catch {
      markdown = '';
    }
  }

  if (!markdown) {
    markdown = buildFallbackMarkdownForApp({
      slug,
      title: appDef.title,
      profileName: profile?.name,
      inputs,
      astrologyMode,
    });
  }

  const nowIso = new Date().toISOString();

  // Save to cache if cacheable
  if (isCacheable) {
    memoryAppCache.set(memKey, {
      markdown,
      structured,
      cachedAt: nowIso,
    });

    try {
      // Update existing or insert cleanly (avoiding functional index conflict mismatch)
      let existQuery = supabaseAdmin
        .from('app_cache')
        .select('id')
        .eq('user_id', req.appUser.id)
        .eq('app_slug', slug)
        .eq('cache_key', cacheKey);
      existQuery = profile?.id ? existQuery.eq('profile_id', profile.id) : existQuery.is('profile_id', null);

      const { data: existingCache } = await existQuery.maybeSingle();
      if (existingCache?.id) {
        await supabaseAdmin
          .from('app_cache')
          .update({
            content_markdown: markdown,
            structured_json: structured || {},
            model_used: modelUsed,
            updated_at: nowIso,
          })
          .eq('id', existingCache.id);
      } else {
        await supabaseAdmin.from('app_cache').insert({
          user_id: req.appUser.id,
          profile_id: profile?.id || null,
          app_slug: slug,
          cache_key: cacheKey,
          content_markdown: markdown,
          structured_json: structured || {},
          model_used: modelUsed,
          updated_at: nowIso,
        });
      }
    } catch {
      // Non-fatal if migration 007 hasn't run yet
    }
  }

  // Persist reading to mini_app_readings for Past Readings history (best-effort)
  let readingId: string | null = null;
  try {
    const modeTag = astrologyMode === 'western' ? 'Western' : 'Vedic';
    const readingTitle =
      slug === 'birth-chart-breakdown' && typeof inputs.topicLabel === 'string'
        ? `${appDef.title}: ${inputs.topicLabel} (${modeTag})`
        : slug === 'planet-strength-tester' && typeof inputs.planet === 'string'
        ? `${appDef.title}: ${inputs.planet} (${modeTag})`
        : `${appDef.title} (${modeTag})`;

    const { data: insertedReading } = await supabaseAdmin
      .from('mini_app_readings')
      .insert({
        user_id: req.appUser.id,
        profile_id: profile?.id || null,
        app_slug: slug,
        astrology_mode: astrologyMode,
        title: readingTitle.slice(0, 140),
        inputs_json: inputs || {},
        structured_json: structured || {},
        markdown,
      })
      .select('id')
      .single();

    if (insertedReading?.id) {
      readingId = String(insertedReading.id);
    }
  } catch {
    // Non-fatal if migration 008 hasn't run yet
  }

  // Record token usage for telemetry (free for user — zero credit deduction)
  void logAppUsageSafe({
    userId: req.appUser.id,
    profileId: profile?.id || null,
    appSlug: slug,
    cacheHit: false,
    tokensIn,
    tokensOut,
    modelUsed,
  });

  res.json({
    slug,
    markdown,
    structured,
    cacheHit: false,
    cachedAt: nowIso,
    astrologyMode,
    readingId,
    profileUsed: profile
      ? { id: profile.id, name: profile.name, short_name: profile.short_name ?? null }
      : null,
  });
});

export default router;
