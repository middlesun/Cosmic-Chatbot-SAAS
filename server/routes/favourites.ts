import { Router } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import type { MiniAppDefinition } from '../../components/app/miniAppsTypes';
import { getDynamicMiniAppsPublicCatalog } from '../services/miniAppsRegistry';

const router = Router();

function formatProfileLabel(p: {
  name?: string | null;
  short_name?: string | null;
  is_default?: boolean | null;
}): string {
  const short = typeof p.short_name === 'string' ? p.short_name.trim() : '';
  if (p.is_default) {
    return short ? `You (${short})` : 'You';
  }
  return short || String(p.name || 'Chart');
}

// GET /api/favourites — Aggregated lightweight list of all starred items (Apps, Reports, Chats & Companions, Messages, Profiles)
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const userId = req.appUser.id;

  const [
    favAppsRes,
    favReportsRes,
    bookmarkedConvsV6,
    allUserConvsForMessages,
    allProfilesResV8,
  ] = await Promise.all([
    supabaseAdmin
      .from('user_favorite_apps')
      .select('app_slug, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('user_favorite_reports')
      .select('report_catalog_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('conversations')
      .select(
        'id, title, profile_id, mode_type, pillar, companion_type, companion_persona_json, updated_at, created_at'
      )
      .eq('user_id', userId)
      .eq('is_bookmarked', true)
      .order('updated_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('conversations')
      .select('id, title, profile_id, pillar, companion_persona_json')
      .eq('user_id', userId)
      .limit(200),
    supabaseAdmin
      .from('profiles')
      .select(
        'id, name, short_name, is_default, is_starred, tags, birth_date, birth_city, birth_country, relationship, is_activated, created_at'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  // Resolve lightweight profile lookup map (fallback gracefully if migration 008 columns aren't applied yet)
  let profileRows: Array<{
    id: string;
    name: string;
    short_name?: string | null;
    is_default?: boolean | null;
    is_starred?: boolean | null;
    tags?: string[] | null;
    birth_date: string;
    birth_city: string;
    birth_country: string;
    relationship?: string | null;
    is_activated: boolean;
    created_at: string;
  }> = [];

  if (!allProfilesResV8.error && allProfilesResV8.data) {
    profileRows = allProfilesResV8.data as unknown as typeof profileRows;
  } else {
    const profFallback = await supabaseAdmin
      .from('profiles')
      .select('id, name, short_name, is_default, birth_date, birth_city, birth_country, relationship, is_activated, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!profFallback.error && profFallback.data) {
      profileRows = (profFallback.data as unknown as typeof profileRows).map((p) => ({
        ...p,
        is_starred: false,
        tags: [],
      }));
    } else {
      const profBase = await supabaseAdmin
        .from('profiles')
        .select('id, name, birth_date, birth_city, birth_country, relationship, is_activated, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      profileRows = (profBase.data || []).map((p) => ({
        ...p,
        short_name: null,
        is_default: false,
        is_starred: false,
        tags: [],
      }));
    }
  }

  const profileMap = new Map<string, string>();
  for (const p of profileRows) {
    profileMap.set(p.id, formatProfileLabel(p));
  }

  // 1. Starred Apps
  const { apps: dynamicApps } = await getDynamicMiniAppsPublicCatalog().catch(() => ({
    apps: [] as MiniAppDefinition[],
  }));
  const dynamicBySlug = new Map<string, MiniAppDefinition>(
    dynamicApps.map((a) => [a.slug, a] as const)
  );

  const apps = (!favAppsRes.error && favAppsRes.data ? favAppsRes.data : [])
    .map((row) => {
      const slugKey = String(row.app_slug);
      const def = dynamicBySlug.get(slugKey);
      if (!def) return null;
      return {
        slug: def.slug,
        title: def.title,
        subtitle: def.tagline,
        category: def.categoryLabel || def.category,
        supportsModes: true,
        starredAt: String(row.created_at),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  // 2. Starred Reports
  let reports: Array<{
    id: string;
    slug: string;
    name: string;
    category: string;
    short_description: string;
    price_credits: number;
    starredAt: string;
  }> = [];

  if (!favReportsRes.error && favReportsRes.data && favReportsRes.data.length > 0) {
    const reportIds = favReportsRes.data.map((r) => String(r.report_catalog_id));
    const starredAtMap = new Map(
      favReportsRes.data.map((r) => [String(r.report_catalog_id), String(r.created_at)])
    );
    const { data: catalogRows } = await supabaseAdmin
      .from('report_catalog')
      .select('id, slug, name, category, short_description, price_credits')
      .in('id', reportIds)
      .eq('is_active', true);

    reports = (catalogRows || []).map((c) => ({
      id: String(c.id),
      slug: String(c.slug),
      name: String(c.name),
      category: String(c.category || 'Research Dossier'),
      short_description: String(c.short_description || ''),
      price_credits: Number(c.price_credits || 0),
      starredAt: starredAtMap.get(String(c.id)) || new Date().toISOString(),
    }));
  }

  // 3. Starred Conversations (Council & Companions)
  let rawBookmarkedConvs: Array<Record<string, unknown>> = [];
  if (!bookmarkedConvsV6.error && bookmarkedConvsV6.data) {
    rawBookmarkedConvs = bookmarkedConvsV6.data as unknown as Array<Record<string, unknown>>;
  } else {
    const convFallback = await supabaseAdmin
      .from('conversations')
      .select('id, title, profile_id, mode_type, updated_at, created_at')
      .eq('user_id', userId)
      .eq('is_bookmarked', true)
      .order('updated_at', { ascending: false })
      .limit(100);
    rawBookmarkedConvs = (convFallback.data || []) as unknown as Array<Record<string, unknown>>;
  }

  const conversations = rawBookmarkedConvs
    .filter((c) => c.pillar !== 'clarity')
    .map((c) => {
      const persona =
        c.companion_persona_json && typeof c.companion_persona_json === 'object'
          ? (c.companion_persona_json as { name?: string; role_label?: string })
          : null;
      const isCompanion = c.pillar === 'companion' || Boolean(persona);
      const profileId = typeof c.profile_id === 'string' ? c.profile_id : null;
      return {
        id: String(c.id),
        title: String(c.title || 'Consultation'),
        kind: isCompanion ? ('companion' as const) : ('council' as const),
        companionName: persona?.name || null,
        companionRole: persona?.role_label || null,
        profile_id: profileId,
        profile_label: profileId ? profileMap.get(profileId) || null : null,
        mode_type: String(c.mode_type || 'reading'),
        updated_at: String(c.updated_at || c.created_at),
      };
    });

  // 4. Starred Messages / Insights across Council & Companion threads
  let convLookupRows: Array<Record<string, unknown>> = [];
  if (!allUserConvsForMessages.error && allUserConvsForMessages.data) {
    convLookupRows = allUserConvsForMessages.data as unknown as Array<Record<string, unknown>>;
  } else {
    const convFallbackForMsgs = await supabaseAdmin
      .from('conversations')
      .select('id, title, profile_id')
      .eq('user_id', userId)
      .limit(200);
    convLookupRows = (convFallbackForMsgs.data || []) as unknown as Array<Record<string, unknown>>;
  }

  let starredMessages: Array<{
    id: string;
    conversation_id: string;
    conversation_title: string;
    kind: 'council' | 'companion';
    profile_id: string | null;
    profile_label: string | null;
    expert_used: string | null;
    snippet: string;
    created_at: string;
  }> = [];

  if (convLookupRows.length > 0) {
    const convLookup = new Map(convLookupRows.map((c) => [String(c.id), c]));
    const { data: msgRows } = await supabaseAdmin
      .from('messages')
      .select('id, conversation_id, content, expert_used, created_at')
      .in(
        'conversation_id',
        convLookupRows.map((c) => String(c.id))
      )
      .eq('is_starred', true)
      .order('created_at', { ascending: false })
      .limit(60);

    starredMessages = (msgRows || []).map((m) => {
      const parent = convLookup.get(String(m.conversation_id));
      const isComp =
        parent?.pillar === 'companion' ||
        Boolean(parent?.companion_persona_json) ||
        String(m.expert_used || '').startsWith('companion:');
      const profileId = typeof parent?.profile_id === 'string' ? parent.profile_id : null;
      const cleanSnippet = String(m.content || '')
        .replace(/^#+\s*/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .trim()
        .slice(0, 260);
      return {
        id: String(m.id),
        conversation_id: String(m.conversation_id),
        conversation_title: String(parent?.title || 'Consultation'),
        kind: isComp ? ('companion' as const) : ('council' as const),
        profile_id: profileId,
        profile_label: profileId ? profileMap.get(profileId) || null : null,
        expert_used: typeof m.expert_used === 'string' ? m.expert_used : null,
        snippet: cleanSnippet,
        created_at: String(m.created_at),
      };
    });
  }

  // 5. Starred Profiles
  const profiles = profileRows
    .filter((p) => Boolean(p.is_starred))
    .map((p) => ({
      id: p.id,
      name: p.name,
      short_name: p.short_name || null,
      display_label: formatProfileLabel(p),
      is_default: Boolean(p.is_default),
      birth_date: p.birth_date,
      birth_city: p.birth_city,
      birth_country: p.birth_country,
      tags: Array.isArray(p.tags) ? p.tags : [],
      is_activated: Boolean(p.is_activated),
    }));

  res.json({
    apps,
    reports,
    conversations,
    starredMessages,
    profiles,
  });
});

export default router;
