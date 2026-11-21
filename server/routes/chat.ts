import crypto from 'crypto';
import { Router } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import {
  PROMPT_EXTRACTION_REFUSAL,
  countWords,
  detectPromptExtractionAttempt,
  generateConversationTitle,
  generateMoreStructuredSuggestions,
  generateStructuredSuggestions,
  isOpenRouterConfiguredAsync,
  runQuickTool,
  sanitizeAssistantOutput,
  streamConsultationResponse,
  type MessageSuggestions,
} from '../services/geminiOrchestrator';
import { isAstrologyApiConfigured } from '../services/astrologyApi';
import { compileBirthChart, type CompiledChartData } from '../services/chartCompiler';
import {
  rebuildProfileMemory,
  updateProfileMemoryAfterTurn,
} from '../services/memoryArchivist';
import { getPublicChatCatalogCached } from '../services/promptDefaults';
import {
  getPricingConfig,
  getPublicChatbotUiConfig,
  getPublicSuggestionsConfig,
} from '../services/platformSettings';
import { checkRateLimit } from '../services/abuseGuard';
import {
  COMPANION_ARCHETYPES,
  generateMatchedCompanions,
  type ChatPillar,
  type CompanionArchetypeSlug,
  type CompanionPersona,
} from '../services/companionEngine';
import {
  evaluateStage1Routing,
  type Stage1RoutingDecision,
} from '../services/intentRouter';
import {
  mergeLifeContextPatch,
  type LifeContextData,
} from '../services/lifeContextGuard';
import type { NatalTruthDossierV1 } from '../services/natalDossier';
import { getPlaybookById } from '../services/canonicalPlaybooks';
import { compileStage2ContextPackage } from '../services/contextSlicer';
import {
  generateAlignedStage4Suggestions,
  generateMoreAlignedStage4Suggestions,
} from '../services/suggestionEngine';
import { USE_DECOUPLED_STAGE4_SUGGESTIONS } from '../services/sutraSynthesizer';
import type {
  Stage1RouterResult,
  SutraSynthesisMeta,
  UserFluencyTier,
} from '../../lib/sutraTypes';

const router = Router();

const MAX_ACTIVE_TABS = 10;

const CONVERSATION_LIST_COLUMNS_BASE =
  'id, user_id, profile_id, linked_report_id, title, mode_type, is_bookmarked, total_word_count, use_full_profile_memory, updated_at, created_at';
const CONVERSATION_LIST_COLUMNS_V5 = `${CONVERSATION_LIST_COLUMNS_BASE}, ask_later_json`;
const CONVERSATION_LIST_COLUMNS_V6 = `${CONVERSATION_LIST_COLUMNS_V5}, pillar, is_active_tab, active_tab_order, companion_type, companion_persona_json`;

const MESSAGE_SELECT_COLUMNS_BASE =
  'id, conversation_id, parent_message_id, role, content, word_count, expert_used, mode_used, output_format_used, language_used, is_starred, excluded_from_context, followups_json, credits_charged, created_at';
const MESSAGE_SELECT_COLUMNS = `${MESSAGE_SELECT_COLUMNS_BASE}, suggestions_json`;

function normalizeConversationDefaults(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ask_later_json: [],
    pillar: 'council',
    is_active_tab: false,
    active_tab_order: 0,
    companion_type: null,
    companion_persona_json: null,
    ...row,
  };
}

function isValidPillar(v: unknown): v is ChatPillar {
  return v === 'council' || v === 'companion' || v === 'clarity';
}

function isValidCompanionType(v: unknown): v is CompanionArchetypeSlug {
  return COMPANION_ARCHETYPES.some((a) => a.slug === v);
}

// 1. Public-safe Chat Catalog + Dynamic Chatbot UI Config (never raw prompts)
router.get('/config', requireAuth, async (_req: AuthenticatedRequest, res) => {
  const [catalog, chatbotConfig, suggestionsConfig, pricingConfig, openrouterReady] =
    await Promise.all([
      getPublicChatCatalogCached(),
      getPublicChatbotUiConfig(),
      getPublicSuggestionsConfig(),
      getPricingConfig(),
      isOpenRouterConfiguredAsync(),
    ]);
  res.setHeader('Cache-Control', 'private, no-cache');
  res.json({
    catalog,
    chatbotConfig,
    suggestionsConfig,
    openrouterConfigured: openrouterReady,
    minCreditsRequired: pricingConfig.min_credits_to_chat,
  });
});

// 2. List conversations + profile folders for sidebar grouping
router.get('/conversations', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const sortBy = req.query.sort === 'longest' ? 'longest' : 'newest';
  const queryText = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  const buildConvQuery = (columns: string) => {
    let q = supabaseAdmin
      .from('conversations')
      .select(columns)
      .eq('user_id', req.appUser!.id);
    if (queryText) {
      q = q.ilike('title', `%${queryText}%`);
    }
    if (sortBy === 'longest') {
      return q
        .order('is_bookmarked', { ascending: false })
        .order('total_word_count', { ascending: false })
        .order('updated_at', { ascending: false });
    }
    return q
      .order('is_bookmarked', { ascending: false })
      .order('updated_at', { ascending: false });
  };

  const [convResPrimary, primaryProfRes] = await Promise.all([
    buildConvQuery(CONVERSATION_LIST_COLUMNS_V6),
    supabaseAdmin
      .from('profiles')
      .select(
        'id, name, short_name, is_default, birth_date, birth_city, birth_country, current_city, current_state, current_country, relationship, is_activated'
      )
      .eq('user_id', req.appUser.id)
      .order('created_at', { ascending: false }),
  ]);

  let convRows: Array<Record<string, unknown>> = [];
  if (convResPrimary.error) {
    const convResV5 = await buildConvQuery(CONVERSATION_LIST_COLUMNS_V5);
    if (!convResV5.error && convResV5.data) {
      convRows = ((convResV5.data || []) as unknown as Array<Record<string, unknown>>).map(
        normalizeConversationDefaults
      );
    } else {
      const convResFallback = await buildConvQuery(CONVERSATION_LIST_COLUMNS_BASE);
      if (convResFallback.error) {
        res.status(500).json({ error: 'Failed to load consultations' });
        return;
      }
      convRows = ((convResFallback.data || []) as unknown as Array<Record<string, unknown>>).map(
        normalizeConversationDefaults
      );
    }
  } else {
    convRows = ((convResPrimary.data || []) as unknown as Array<Record<string, unknown>>).map(
      normalizeConversationDefaults
    );
  }

  let profileRows: Array<Record<string, unknown>> = [];
  if (primaryProfRes.error) {
    const v2ProfRes = await supabaseAdmin
      .from('profiles')
      .select('id, name, short_name, is_default, birth_date, birth_city, birth_country, relationship, is_activated')
      .eq('user_id', req.appUser.id)
      .order('created_at', { ascending: false });
    if (!v2ProfRes.error && v2ProfRes.data) {
      profileRows = (v2ProfRes.data as Array<Record<string, unknown>>).map((r) => ({
        ...r,
        current_city: null,
        current_state: null,
        current_country: null,
      }));
    } else {
      const fallbackProfRes = await supabaseAdmin
        .from('profiles')
        .select('id, name, birth_date, birth_city, birth_country, relationship, is_activated')
        .eq('user_id', req.appUser.id)
        .order('created_at', { ascending: false });
      profileRows = (fallbackProfRes.data || []).map((r) => ({
        ...r,
        short_name: null,
        is_default: false,
        current_city: null,
        current_state: null,
        current_country: null,
      }));
    }
  } else {
    profileRows = (primaryProfRes.data || []) as Array<Record<string, unknown>>;
  }

  const sortedProfiles = [...profileRows].sort((a, b) => {
    return (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0);
  });

  res.json({
    conversations: convRows,
    profiles: sortedProfiles,
  });
});

// 3. Create new conversation (Council, Companion, or Clarity)
router.post('/conversations', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const {
    profile_id,
    mode_type,
    title,
    use_full_profile_memory,
    pillar,
    is_active_tab,
    active_tab_order,
    companion_type,
    companion_persona_json,
  } = req.body || {};

  const normalizedPillar: ChatPillar = isValidPillar(pillar) ? pillar : 'council';
  const effectiveProfileId = normalizedPillar === 'council' ? profile_id || null : null;

  if (effectiveProfileId) {
    const { data: ownedProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', effectiveProfileId)
      .eq('user_id', req.appUser.id)
      .maybeSingle();

    if (!ownedProfile) {
      res.status(404).json({ error: 'Selected birth profile not found' });
      return;
    }
  }

  const normalizedModeType =
    mode_type === 'learn_astrology' || mode_type === 'report_followup'
      ? mode_type
      : 'reading';

  const defaultTitle =
    normalizedPillar === 'clarity'
      ? 'Clarity'
      : normalizedPillar === 'companion'
      ? (typeof companion_persona_json?.name === 'string' && companion_persona_json.name.trim()
          ? companion_persona_json.name.trim()
          : 'Companion Chat')
      : 'New Consultation';

  const defaultMemory =
    typeof use_full_profile_memory === 'boolean'
      ? use_full_profile_memory
      : normalizedPillar === 'clarity'
      ? false
      : true;

  const basePayload = {
    user_id: req.appUser.id,
    profile_id: effectiveProfileId,
    mode_type: normalizedModeType,
    title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 80) : defaultTitle,
    use_full_profile_memory: defaultMemory,
  };

  const extendedPayload = {
    ...basePayload,
    pillar: normalizedPillar,
    is_active_tab: Boolean(is_active_tab),
    active_tab_order: Number.isFinite(Number(active_tab_order)) ? Math.trunc(Number(active_tab_order)) : 0,
    companion_type: isValidCompanionType(companion_type) ? companion_type : null,
    companion_persona_json:
      companion_persona_json && typeof companion_persona_json === 'object'
        ? companion_persona_json
        : null,
  };

  const primaryInsert = await supabaseAdmin
    .from('conversations')
    .insert(extendedPayload)
    .select('*')
    .single();

  if (!primaryInsert.error && primaryInsert.data) {
    res.status(201).json({
      conversation: normalizeConversationDefaults(
        primaryInsert.data as unknown as Record<string, unknown>
      ),
      persistedPillar: true,
    });
    return;
  }

  // Graceful fallback if migration 006 hasn't been executed yet
  const fallbackInsert = await supabaseAdmin
    .from('conversations')
    .insert(basePayload)
    .select('*')
    .single();

  if (fallbackInsert.error || !fallbackInsert.data) {
    res.status(500).json({ error: 'Failed to create consultation' });
    return;
  }

  res.status(201).json({
    conversation: normalizeConversationDefaults({
      ...(fallbackInsert.data as unknown as Record<string, unknown>),
      pillar: normalizedPillar,
      is_active_tab: Boolean(is_active_tab),
      active_tab_order: extendedPayload.active_tab_order,
      companion_type: extendedPayload.companion_type,
      companion_persona_json: extendedPayload.companion_persona_json,
    }),
    persistedPillar: false,
  });
});

// 4. Update conversation (rename, pin/bookmark, toggle profile memory, active tab pinning, attach/switch profile mid-chat)
router.patch('/conversations/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const {
    title,
    is_bookmarked,
    profile_id,
    use_full_profile_memory,
    mode_type,
    is_active_tab,
    active_tab_order,
    pillar,
    companion_persona_json,
  } = req.body || {};

  const baseUpdates: Record<string, unknown> = {};
  const v6Updates: Record<string, unknown> = {};

  if (typeof title === 'string' && title.trim()) {
    baseUpdates.title = title.trim().slice(0, 90);
  }
  if (typeof is_bookmarked === 'boolean') {
    baseUpdates.is_bookmarked = is_bookmarked;
  }
  if (typeof use_full_profile_memory === 'boolean') {
    baseUpdates.use_full_profile_memory = use_full_profile_memory;
  }
  if (mode_type === 'reading' || mode_type === 'learn_astrology' || mode_type === 'report_followup') {
    baseUpdates.mode_type = mode_type;
  }
  if (profile_id !== undefined) {
    if (profile_id === null || profile_id === '') {
      baseUpdates.profile_id = null;
    } else {
      const { data: ownedProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', profile_id)
        .eq('user_id', req.appUser.id)
        .maybeSingle();

      if (!ownedProfile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }
      baseUpdates.profile_id = profile_id;
    }
  }

  if (typeof is_active_tab === 'boolean') {
    if (is_active_tab) {
      // Enforce max 5 active pinned tabs cleanly when column exists
      const countRes = await supabaseAdmin
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', req.appUser.id)
        .eq('is_active_tab', true)
        .neq('id', req.params.id);
      if (!countRes.error && (countRes.count || 0) >= MAX_ACTIVE_TABS) {
        res.status(400).json({
          error: `Maximum ${MAX_ACTIVE_TABS} active tabs allowed. Close one tab first.`,
          code: 'MAX_ACTIVE_TABS',
        });
        return;
      }
    }
    v6Updates.is_active_tab = is_active_tab;
  }
  if (Number.isFinite(Number(active_tab_order))) {
    v6Updates.active_tab_order = Math.trunc(Number(active_tab_order));
  }
  if (isValidPillar(pillar)) {
    v6Updates.pillar = pillar;
  }
  if (companion_persona_json !== undefined) {
    v6Updates.companion_persona_json =
      companion_persona_json && typeof companion_persona_json === 'object'
        ? companion_persona_json
        : null;
  }

  const allUpdates = { ...baseUpdates, ...v6Updates };
  if (Object.keys(allUpdates).length === 0) {
    res.status(400).json({ error: 'No valid update fields supplied' });
    return;
  }

  const primaryPatch = await supabaseAdmin
    .from('conversations')
    .update({ ...allUpdates, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id)
    .select('*')
    .maybeSingle();

  if (!primaryPatch.error && primaryPatch.data) {
    res.json({
      conversation: normalizeConversationDefaults(
        primaryPatch.data as unknown as Record<string, unknown>
      ),
      persisted: true,
    });
    return;
  }

  // Graceful fallback before migration 006 runs
  if (Object.keys(v6Updates).length > 0) {
    if (Object.keys(baseUpdates).length > 0) {
      const basePatch = await supabaseAdmin
        .from('conversations')
        .update({ ...baseUpdates, updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .eq('user_id', req.appUser.id)
        .select('*')
        .maybeSingle();
      if (!basePatch.error && basePatch.data) {
        res.json({
          conversation: normalizeConversationDefaults({
            ...(basePatch.data as unknown as Record<string, unknown>),
            ...v6Updates,
          }),
          persisted: false,
        });
        return;
      }
    } else {
      const existing = await supabaseAdmin
        .from('conversations')
        .select(CONVERSATION_LIST_COLUMNS_BASE)
        .eq('id', req.params.id)
        .eq('user_id', req.appUser.id)
        .maybeSingle();
      if (existing.data) {
        res.json({
          conversation: normalizeConversationDefaults({
            ...(existing.data as unknown as Record<string, unknown>),
            ...v6Updates,
          }),
          persisted: false,
        });
        return;
      }
    }
  }

  res.status(404).json({ error: 'Consultation not found' });
});

// 4b. Dynamic Companion Matching (generates 4 realistic companions: 2 Female, 2 Male)
router.post('/companions/match', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  if (!req.appUser.is_admin) {
    const rate = checkRateLimit(`companion_match:${req.appUser.id}`, 18, 10 * 60 * 1000);
    if (!rate.allowed) {
      res.status(429).json({
        error: 'Please pause a moment before generating more companion matches.',
      });
      return;
    }
  }

  const {
    companionType,
    topic,
    preference,
    religiousness,
    primaryReligion,
    secondaryReligion,
    excludeNames,
  } = req.body || {};

  const safeType: CompanionArchetypeSlug = isValidCompanionType(companionType)
    ? companionType
    : 'find_someone';

  // Quietly read user's default profile age/gender (if any) strictly for natural relatable age calibration
  let userAgeHint: number | null = null;
  let userGenderHint: string | null = null;
  if (supabaseAdmin) {
    try {
      const { data: ownProfile } = await supabaseAdmin
        .from('profiles')
        .select('birth_date, gender, is_default')
        .eq('user_id', req.appUser.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (ownProfile?.birth_date) {
        const year = Number(String(ownProfile.birth_date).slice(0, 4));
        const currentYear = new Date().getFullYear();
        if (Number.isFinite(year) && year > 1920 && year < currentYear - 12) {
          userAgeHint = currentYear - year;
        }
      }
      if (typeof ownProfile?.gender === 'string' && ownProfile.gender.trim()) {
        userGenderHint = ownProfile.gender.trim();
      }
    } catch {
      // Non-critical calibration hint
    }
  }

  const companions = await generateMatchedCompanions({
    companionType: safeType,
    topic: typeof topic === 'string' ? topic.trim().slice(0, 400) : undefined,
    preference: typeof preference === 'string' ? preference.trim().slice(0, 300) : undefined,
    religiousness: Number.isFinite(Number(religiousness)) ? Number(religiousness) : undefined,
    primaryReligion:
      typeof primaryReligion === 'string' ? primaryReligion.trim().slice(0, 80) : undefined,
    secondaryReligion:
      typeof secondaryReligion === 'string' ? secondaryReligion.trim().slice(0, 80) : undefined,
    excludeNames: Array.isArray(excludeNames)
      ? excludeNames.filter((n): n is string => typeof n === 'string').slice(0, 20)
      : [],
    userAgeHint,
    userGenderHint,
    preferredCallName: req.appUser.preferred_call_name || req.appUser.full_name || null,
  });

  res.json({ companions });
});

// 4c. Start a live Companion conversation with opening greeting persisted
router.post('/companions/start', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const rawPersona = req.body?.persona as CompanionPersona | undefined;
  if (!rawPersona || typeof rawPersona !== 'object' || !rawPersona.name) {
    res.status(400).json({ error: 'Selected companion persona is required' });
    return;
  }

  const safeType: CompanionArchetypeSlug = isValidCompanionType(rawPersona.companion_type)
    ? rawPersona.companion_type
    : 'find_someone';

  const cleanPersona: CompanionPersona = {
    id: typeof rawPersona.id === 'string' && rawPersona.id ? rawPersona.id : `comp_${crypto.randomBytes(4).toString('hex')}`,
    name: String(rawPersona.name).trim().slice(0, 50),
    age: Number.isFinite(Number(rawPersona.age)) ? Math.round(Number(rawPersona.age)) : 32,
    gender: rawPersona.gender === 'M' ? 'M' : 'F',
    companion_type: safeType,
    role_label: String(rawPersona.role_label || 'Companion').trim().slice(0, 60),
    background: String(rawPersona.background || '').trim().slice(0, 140),
    tagline: String(rawPersona.tagline || '').trim().slice(0, 160),
    bio: String(rawPersona.bio || '').trim().slice(0, 360),
    conversation_style: String(rawPersona.conversation_style || '').trim().slice(0, 140),
    opening_message: String(
      rawPersona.opening_message || `Hey — I am ${rawPersona.name}. What is on your mind today?`
    )
      .trim()
      .slice(0, 400),
    system_prompt: String(rawPersona.system_prompt || '').trim().slice(0, 2000),
    topic_context: rawPersona.topic_context
      ? String(rawPersona.topic_context).trim().slice(0, 300)
      : undefined,
    religion_profile: rawPersona.religion_profile,
  };

  const threadTitle = cleanPersona.topic_context
    ? `${cleanPersona.name} · ${cleanPersona.topic_context.slice(0, 42)}`
    : `${cleanPersona.name} · ${cleanPersona.role_label}`;

  const basePayload = {
    user_id: req.appUser.id,
    profile_id: null,
    mode_type: 'reading' as const,
    title: threadTitle.slice(0, 80),
    use_full_profile_memory: true,
  };

  let createdConv: Record<string, unknown> | null = null;
  let persistedPillar = true;

  const primaryInsert = await supabaseAdmin
    .from('conversations')
    .insert({
      ...basePayload,
      pillar: 'companion',
      is_active_tab: Boolean(req.body?.pinAsTab),
      companion_type: safeType,
      companion_persona_json: cleanPersona,
    })
    .select('*')
    .single();

  if (!primaryInsert.error && primaryInsert.data) {
    createdConv = normalizeConversationDefaults(
      primaryInsert.data as unknown as Record<string, unknown>
    );
  } else {
    persistedPillar = false;
    const fallbackInsert = await supabaseAdmin
      .from('conversations')
      .insert(basePayload)
      .select('*')
      .single();
    if (fallbackInsert.error || !fallbackInsert.data) {
      res.status(500).json({ error: 'Could not start companion conversation' });
      return;
    }
    createdConv = normalizeConversationDefaults({
      ...(fallbackInsert.data as unknown as Record<string, unknown>),
      pillar: 'companion',
      is_active_tab: Boolean(req.body?.pinAsTab),
      companion_type: safeType,
      companion_persona_json: cleanPersona,
    });
  }

  // Insert companion's warm opening message so conversation feels alive right away
  let openingMsgRecord: Record<string, unknown> | null = null;
  const openingWords = countWords(cleanPersona.opening_message);
  const { data: msgData } = await supabaseAdmin
    .from('messages')
    .insert({
      conversation_id: String(createdConv.id),
      role: 'assistant',
      content: cleanPersona.opening_message,
      word_count: openingWords,
      expert_used: `companion:${safeType}`,
      mode_used: safeType,
      output_format_used: 'conversational',
      language_used: req.appUser.default_language || 'English',
      followups_json: [],
      tokens_in: 0,
      tokens_out: 0,
      credits_charged: 0,
    })
    .select('*')
    .single();

  if (msgData) {
    openingMsgRecord = msgData as unknown as Record<string, unknown>;
  }

  res.status(201).json({
    conversation: createdConv,
    openingMessage: openingMsgRecord,
    persistedPillar,
  });
});

// 5. Delete conversation
router.delete('/conversations/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { error } = await supabaseAdmin
    .from('conversations')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id);

  if (error) {
    res.status(500).json({ error: 'Failed to delete consultation' });
    return;
  }

  res.json({ deleted: true });
});

// 6. Get paginated messages for a conversation (supports ?limit=40&before=<ISO>)
router.get('/conversations/:id/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  let conversation: Record<string, unknown> | null = null;
  const convPrimary = await supabaseAdmin
    .from('conversations')
    .select(CONVERSATION_LIST_COLUMNS_V6)
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  if (convPrimary.error) {
    const convV5 = await supabaseAdmin
      .from('conversations')
      .select(CONVERSATION_LIST_COLUMNS_V5)
      .eq('id', req.params.id)
      .eq('user_id', req.appUser.id)
      .maybeSingle();
    if (!convV5.error && convV5.data) {
      conversation = normalizeConversationDefaults(
        convV5.data as unknown as Record<string, unknown>
      );
    } else {
      const convFallback = await supabaseAdmin
        .from('conversations')
        .select(CONVERSATION_LIST_COLUMNS_BASE)
        .eq('id', req.params.id)
        .eq('user_id', req.appUser.id)
        .maybeSingle();
      conversation = convFallback.data
        ? normalizeConversationDefaults(convFallback.data as unknown as Record<string, unknown>)
        : null;
    }
  } else {
    conversation = convPrimary.data
      ? normalizeConversationDefaults(convPrimary.data as unknown as Record<string, unknown>)
      : null;
  }

  if (!conversation) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }

  const parsedLimit = Number(req.query.limit);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.trunc(parsedLimit), 10), 100)
    : 40;
  const before = typeof req.query.before === 'string' && req.query.before.trim()
    ? req.query.before.trim()
    : '';

  const buildMsgQuery = (columns: string) => {
    let q = supabaseAdmin
      .from('messages')
      .select(columns)
      .eq('conversation_id', String(conversation!.id));
    if (before) {
      q = q.lt('created_at', before);
    }
    return q.order('created_at', { ascending: false }).limit(limit + 1);
  };

  let rawRows: Array<Record<string, unknown>> = [];
  const msgPrimary = await buildMsgQuery(MESSAGE_SELECT_COLUMNS);
  if (msgPrimary.error) {
    const msgFallback = await buildMsgQuery(MESSAGE_SELECT_COLUMNS_BASE);
    if (msgFallback.error) {
      res.status(500).json({ error: 'Failed to load messages' });
      return;
    }
    rawRows = ((msgFallback.data || []) as unknown as Array<Record<string, unknown>>).map((m) => ({
      ...m,
      suggestions_json: null,
    }));
  } else {
    rawRows = (msgPrimary.data || []) as unknown as Array<Record<string, unknown>>;
  }

  const hasMore = rawRows.length > limit;
  const pageDesc = hasMore ? rawRows.slice(0, limit) : rawRows;
  const messages = [...pageDesc].reverse();

  res.json({ conversation, messages, hasMore });
});

// 6b. Toggle / Manage Per-Conversation "Ask later" Saved Suggestions
router.post('/conversations/:id/ask-later', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { action = 'toggle', item, items } = req.body || {};
  const text = typeof item?.text === 'string' ? item.text.trim().slice(0, 260) : '';
  const itemId = typeof item?.id === 'string' && item.id.trim() ? item.id.trim() : '';

  if (action !== 'add_many' && !text && action !== 'remove') {
    res.status(400).json({ error: 'Suggestion text is required' });
    return;
  }

  if (action === 'add_many' && (!Array.isArray(items) || items.length === 0)) {
    res.status(400).json({ error: 'At least one suggestion item is required' });
    return;
  }

  const { data: convRow, error: convErr } = await supabaseAdmin
    .from('conversations')
    .select('id, user_id, ask_later_json')
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  type StoredAskLater = {
    id: string;
    text: string;
    tier: 'followup' | 'deeper_analysis';
    technical_directive?: string;
    source_message_id?: string;
    saved_at: string;
  };

  const normalizeEntry = (raw: any): StoredAskLater | null => {
    const cleanText = typeof raw?.text === 'string' ? raw.text.trim().slice(0, 260) : '';
    if (!cleanText) return null;
    const rawId = typeof raw?.id === 'string' && raw.id.trim() ? raw.id.trim() : '';
    return {
      id: rawId || `ask_${crypto.randomBytes(4).toString('hex')}`,
      text: cleanText,
      tier: raw?.tier === 'deeper_analysis' ? 'deeper_analysis' : 'followup',
      technical_directive:
        typeof raw?.technical_directive === 'string' && raw.technical_directive.trim()
          ? raw.technical_directive.trim().slice(0, 600)
          : undefined,
      source_message_id:
        typeof raw?.source_message_id === 'string' ? raw.source_message_id : undefined,
      saved_at: new Date().toISOString(),
    };
  };

  if (convErr) {
    // Graceful fallback if migration 005 hasn't added ask_later_json yet
    const msg = String(convErr.message || '').toLowerCase();
    if (convErr.code === '42703' || msg.includes('ask_later_json') || msg.includes('column')) {
      if (action === 'add_many') {
        const normalizedMany = (items as any[])
          .map(normalizeEntry)
          .filter((e): e is StoredAskLater => Boolean(e));
        res.json({ items: normalizedMany, saved: true, persisted: false });
        return;
      }
      const normalizedItem = normalizeEntry({ ...item, id: itemId, text });
      res.json({
        items: action === 'remove' || !normalizedItem ? [] : [normalizedItem],
        saved: action !== 'remove',
        persisted: false,
      });
      return;
    }
    res.status(500).json({ error: 'Failed to load conversation' });
    return;
  }

  if (!convRow) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }

  const currentList: StoredAskLater[] = Array.isArray(convRow.ask_later_json)
    ? (convRow.ask_later_json as StoredAskLater[])
    : [];

  let nextList = [...currentList];
  let saved = false;

  if (action === 'add_many') {
    const incoming = (items as any[])
      .slice(0, 10)
      .map(normalizeEntry)
      .filter((e): e is StoredAskLater => Boolean(e));
    for (const entry of [...incoming].reverse()) {
      const key = entry.text.toLowerCase();
      const dup = nextList.some(
        (existing) =>
          existing.id === entry.id ||
          String(existing.text || '').trim().toLowerCase() === key
      );
      if (!dup) {
        nextList = [entry, ...nextList];
      }
    }
    nextList = nextList.slice(0, 50);
    saved = true;
  } else {
    const normalizedKey = text.toLowerCase();
    const existingIndex = currentList.findIndex(
      (entry) =>
        (itemId && entry.id === itemId) ||
        (normalizedKey && String(entry.text || '').trim().toLowerCase() === normalizedKey)
    );

    if (action === 'remove' || (action === 'toggle' && existingIndex !== -1)) {
      if (existingIndex !== -1) {
        nextList.splice(existingIndex, 1);
      }
      saved = false;
    } else {
      const newEntry = normalizeEntry({ ...item, id: itemId, text });
      if (newEntry && existingIndex === -1) {
        nextList = [newEntry, ...nextList].slice(0, 50);
      }
      saved = true;
    }
  }

  const { error: updateErr } = await supabaseAdmin
    .from('conversations')
    .update({ ask_later_json: nextList })
    .eq('id', convRow.id)
    .eq('user_id', req.appUser.id);

  if (updateErr) {
    res.status(500).json({ error: 'Failed to update Ask later library' });
    return;
  }

  res.json({ items: nextList, saved, persisted: true });
});

// 7. Starred Favorites across conversations (filterable by profileId)
router.get('/favorites', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const profileId = typeof req.query.profileId === 'string' ? req.query.profileId : '';

  let convQuery = supabaseAdmin
    .from('conversations')
    .select('id, title, profile_id')
    .eq('user_id', req.appUser.id);

  if (profileId === 'general') {
    convQuery = convQuery.is('profile_id', null);
  } else if (profileId) {
    convQuery = convQuery.eq('profile_id', profileId);
  }

  const { data: convs } = await convQuery;
  if (!convs || convs.length === 0) {
    res.json({ favorites: [] });
    return;
  }

  const convMap = new Map(convs.map((c) => [c.id, c]));
  const { data: starred, error } = await supabaseAdmin
    .from('messages')
    .select(MESSAGE_SELECT_COLUMNS_BASE)
    .in('conversation_id', convs.map((c) => c.id))
    .eq('is_starred', true)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    res.status(500).json({ error: 'Failed to load starred favorites' });
    return;
  }

  const enriched = (starred || []).map((m) => ({
    ...m,
    conversation_title: convMap.get(m.conversation_id)?.title || 'Consultation',
    profile_id: convMap.get(m.conversation_id)?.profile_id || null,
  }));

  res.json({ favorites: enriched });
});

// 8. Stream AI Consultation Response (SSE with AbortController + Atomic Credit Deduction + Follow-ups)
router.post('/conversations/:id/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  if (!req.appUser.is_admin) {
    const burst = checkRateLimit(`chat_msg:${req.appUser.id}`, 20, 2 * 60 * 1000);
    if (!burst.allowed) {
      res.status(429).json({
        error: 'Please pause a moment before sending another message.',
      });
      return;
    }
  }

  const {
    content,
    technicalDirective,
    pillar: requestedPillar,
    companionPersona: requestedCompanionPersona,
    expert,
    mode,
    outputFormat,
    language,
    toneMode,
    responseLength,
    extraProfileIds,
    attachments,
    parentMessageId,
    bypassClarification,
    clarifiedPlaybookId,
    clarifiedContextPatch,
    deepAudit,
  } = req.body || {};

  const safeTechnicalDirective =
    typeof technicalDirective === 'string' && technicalDirective.trim()
      ? technicalDirective.trim().slice(0, 1200)
      : null;

  const validAttachments: Array<{
    kind: 'image' | 'pdf';
    name: string;
    mimeType: string;
    dataUrl: string;
  }> = Array.isArray(attachments)
    ? attachments
        .slice(0, 4)
        .filter((att): att is { kind: 'image' | 'pdf'; name: string; mimeType: string; dataUrl: string } => {
          if (!att || typeof att !== 'object') return false;
          const d = typeof att.dataUrl === 'string' ? att.dataUrl : '';
          if (att.kind === 'image' && d.startsWith('data:image/')) return true;
          if (att.kind === 'pdf' && d.startsWith('data:application/pdf')) return true;
          return false;
        })
        .map((att) => ({
          kind: att.kind,
          name: typeof att.name === 'string' && att.name.trim() ? att.name.trim().slice(0, 120) : (att.kind === 'pdf' ? 'document.pdf' : 'image.jpg'),
          mimeType: typeof att.mimeType === 'string' ? att.mimeType : (att.kind === 'pdf' ? 'application/pdf' : 'image/jpeg'),
          dataUrl: att.dataUrl,
        }))
    : [];

  const rawPromptText = typeof content === 'string' ? content.trim() : '';
  if (!rawPromptText && validAttachments.length === 0) {
    res.status(400).json({ error: 'Message content cannot be empty' });
    return;
  }

  const normalizedExtraProfileIds: string[] = Array.isArray(extraProfileIds)
    ? Array.from(
        new Set(
          extraProfileIds
            .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
            .slice(0, 3)
        )
      )
    : [];

  const promptText =
    rawPromptText ||
    'Please analyze the attached file(s) in the context of this consultation.';

  const { data: conversation } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  if (!conversation) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }

  const convRecord = conversation as Record<string, unknown>;
  const activePillar: ChatPillar = isValidPillar(convRecord.pillar)
    ? (convRecord.pillar as ChatPillar)
    : isValidPillar(requestedPillar)
    ? requestedPillar
    : 'council';

  const activeCompanionPersona: CompanionPersona | null =
    (convRecord.companion_persona_json as CompanionPersona | null | undefined) ||
    (requestedCompanionPersona && typeof requestedCompanionPersona === 'object'
      ? (requestedCompanionPersona as CompanionPersona)
      : null);

  const isExtractionProbe = detectPromptExtractionAttempt(promptText);
  if (isExtractionProbe) {
    const userProbeRate = checkRateLimit(`extract_probe:${req.appUser.id}`, 5, 15 * 60 * 1000);
    const ipProbeAllowed = req.clientIpHash
      ? checkRateLimit(`extract_probe_ip:${req.clientIpHash}`, 8, 15 * 60 * 1000).allowed
      : true;

    if (!userProbeRate.allowed || !ipProbeAllowed) {
      res.status(429).json({
        error: 'Too many invalid policy requests. Please wait a few minutes and try again.',
      });
      return;
    }
  } else {
    const [openrouterReady, pricingConfig] = await Promise.all([
      isOpenRouterConfiguredAsync(),
      getPricingConfig(),
    ]);
    if (!openrouterReady) {
      res.status(503).json({ error: 'OPENROUTER_API_KEY is not configured on the server.' });
      return;
    }

    const useDeepAuditRequested =
      Boolean(deepAudit) &&
      activePillar === 'council' &&
      Boolean(convRecord.profile_id) &&
      expert !== 'western_astrologer' &&
      expert !== 'modern_astrologer' &&
      expert !== 'tarot_reader' &&
      expert !== 'numerologist';
    const minCredits = useDeepAuditRequested
      ? Math.max(pricingConfig.min_credits_to_chat * 3, 75)
      : pricingConfig.min_credits_to_chat;
    if (req.appUser.credits_balance < minCredits) {
      res.status(402).json({
        error: useDeepAuditRequested
          ? `Deep Council Audit requires at least ${minCredits} credits. Please top up credits or turn off Deep Audit.`
          : `Minimum ${minCredits} credits required to start a consultation. Please top up credits.`,
        code: 'INSUFFICIENT_CREDITS',
      });
      return;
    }
  }

  const fallbackCouncilExpert =
    req.appUser.default_astrology_mode === 'western'
      ? req.appUser.default_expert === 'modern_astrologer'
        ? 'modern_astrologer'
        : 'western_astrologer'
      : req.appUser.default_expert || 'council_synthesis';

  const expertSlug =
    activePillar === 'companion'
      ? `companion:${activeCompanionPersona?.companion_type || 'friend'}`
      : activePillar === 'clarity'
      ? 'clarity_helper'
      : typeof expert === 'string' && expert
      ? expert
      : fallbackCouncilExpert;
  const modeSlug =
    activePillar === 'companion'
      ? activeCompanionPersona?.companion_type || 'companion'
      : activePillar === 'clarity'
      ? 'clarity'
      : typeof mode === 'string' && mode
      ? mode
      : conversation.mode_type === 'learn_astrology'
      ? 'learn_astrology'
      : 'general';
  const outputSlug =
    activePillar === 'council'
      ? typeof outputFormat === 'string' && outputFormat
        ? outputFormat
        : req.appUser.default_output || 'detailed'
      : 'conversational';
  const languageSlug =
    typeof language === 'string' && language
      ? language
      : req.appUser.default_language || 'English';
  const normalizedToneMode = toneMode === 'friendly' ? 'friendly' : 'technical';
  const normalizedResponseLength = responseLength === 'short' ? 'short' : 'detailed';

  const isVedicCouncilTurn =
    activePillar === 'council' &&
    expertSlug !== 'western_astrologer' &&
    expertSlug !== 'modern_astrologer' &&
    expertSlug !== 'tarot_reader' &&
    expertSlug !== 'numerologist';
  const isVedicReadingTurn =
    isVedicCouncilTurn &&
    modeSlug !== 'learn_astrology' &&
    conversation.mode_type !== 'learn_astrology' &&
    conversation.mode_type !== 'report_followup';
  const useDeepAudit =
    Boolean(deepAudit) &&
    isVedicReadingTurn &&
    Boolean(conversation.profile_id) &&
    validAttachments.length === 0;

  // Fetch heavy chart_json ONLY inside single-turn message POST for Western/Modern or Vedic Reading Stage 2/3 turns
  const needsChartJson =
    activePillar === 'council' &&
    (expertSlug === 'western_astrologer' ||
      expertSlug === 'modern_astrologer' ||
      isVedicReadingTurn);

  let profileData: {
    id: string;
    name: string;
    is_activated: boolean;
    chart_text_context: string | null;
    chart_json?: CompiledChartData | null;
    natal_truth_dossier_json?: NatalTruthDossierV1 | null;
    profile_memory_summary: string | null;
    life_context_json?: LifeContextData | null;
    life_context_completeness?: number | null;
    birth_date: string;
    birth_time: string;
    birth_city: string;
    birth_state?: string | null;
    birth_country: string;
    current_city?: string | null;
    current_state?: string | null;
    current_country?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    timezone_offset?: number | null;
  } | null = null;
  let scopeMemoryContext: string | null = null;

  if (activePillar === 'council' && conversation.profile_id) {
    const baseCols =
      'id, name, is_activated, chart_text_context, profile_memory_summary, birth_date, birth_time, birth_city, birth_state, birth_country, gender, relationship, latitude, longitude, timezone_offset';
    const fullCols = `${baseCols}, current_city, current_state, current_country, life_context_json, life_context_completeness${
      needsChartJson ? ', chart_json' : ''
    }${isVedicReadingTurn ? ', natal_truth_dossier_json' : ''}`;
    const fallbackCols = `${baseCols}${needsChartJson ? ', chart_json' : ''}`;

    const profPrimary = await supabaseAdmin
      .from('profiles')
      .select(fullCols)
      .eq('id', conversation.profile_id)
      .eq('user_id', req.appUser.id)
      .maybeSingle();

    let prof = profPrimary.data as unknown as typeof profileData;
    if (profPrimary.error) {
      const profFallback = await supabaseAdmin
        .from('profiles')
        .select(fallbackCols)
        .eq('id', conversation.profile_id)
        .eq('user_id', req.appUser.id)
        .maybeSingle();
      prof = profFallback.data as unknown as typeof profileData;
    }

    if (prof && (!prof.chart_text_context || (needsChartJson && !prof.chart_json)) && isAstrologyApiConfigured()) {
      try {
        const compiled = await compileBirthChart({
          name: prof.name,
          birthDate: prof.birth_date,
          birthTime: prof.birth_time,
          birthCity: prof.birth_city,
          birthState: prof.birth_state || null,
          birthCountry: prof.birth_country,
          latitude: prof.latitude ?? null,
          longitude: prof.longitude ?? null,
          timezoneOffset: prof.timezone_offset ?? null,
        });
        await supabaseAdmin
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
          .eq('id', prof.id)
          .eq('user_id', req.appUser.id);

        prof.is_activated = true;
        prof.chart_text_context = compiled.chartTextContext;
        if (needsChartJson) {
          prof.chart_json = compiled.chartJson;
        }
      } catch {
        // Proceed gracefully even if live ephemeris fetch fails transiently
      }
    }

    profileData = prof || null;
  } else if (activePillar === 'council' && conversation.use_full_profile_memory) {
    const targetModeType =
      conversation.mode_type === 'learn_astrology' ? 'learn_astrology' : 'reading';
    const { data: priorConvs } = await supabaseAdmin
      .from('conversations')
      .select('id, title')
      .eq('user_id', req.appUser.id)
      .is('profile_id', null)
      .eq('mode_type', targetModeType)
      .neq('id', conversation.id)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (priorConvs && priorConvs.length > 0) {
      const priorIds = priorConvs.map((c) => c.id);
      const { data: priorMsgs } = await supabaseAdmin
        .from('messages')
        .select('conversation_id, role, content, created_at')
        .in('conversation_id', priorIds)
        .eq('excluded_from_context', false)
        .order('created_at', { ascending: false })
        .limit(12);

      if (priorMsgs && priorMsgs.length > 0) {
        const titleMap = new Map(priorConvs.map((c) => [c.id, c.title]));
        const ordered = [...priorMsgs].reverse();
        const snippets = ordered.map((m) => {
          const prefix = m.role === 'user' ? 'User' : 'Council';
          const topic = titleMap.get(m.conversation_id) || 'Earlier Session';
          return `[${topic}] ${prefix}: ${String(m.content || '').slice(0, 220)}`;
        });
        scopeMemoryContext = snippets.join('\n').slice(0, 1800);
      }
    }
  } else if (activePillar === 'clarity' && conversation.use_full_profile_memory) {
    // Only load prior Clarity threads when the user explicitly turns Memory ON for Clarity
    const priorClarity = await supabaseAdmin
      .from('conversations')
      .select('id, title')
      .eq('user_id', req.appUser.id)
      .eq('pillar', 'clarity')
      .neq('id', conversation.id)
      .order('updated_at', { ascending: false })
      .limit(3);

    if (!priorClarity.error && priorClarity.data && priorClarity.data.length > 0) {
      const priorIds = priorClarity.data.map((c) => c.id);
      const { data: priorMsgs } = await supabaseAdmin
        .from('messages')
        .select('conversation_id, role, content, created_at')
        .in('conversation_id', priorIds)
        .eq('excluded_from_context', false)
        .order('created_at', { ascending: false })
        .limit(8);

      if (priorMsgs && priorMsgs.length > 0) {
        const ordered = [...priorMsgs].reverse();
        scopeMemoryContext = ordered
          .map((m) => `${m.role === 'user' ? 'User' : 'Clarity'}: ${String(m.content || '').slice(0, 200)}`)
          .join('\n')
          .slice(0, 1400);
      }
    }
  }

  const extraIdsFiltered =
    activePillar === 'council'
      ? normalizedExtraProfileIds.filter((id) => id !== conversation.profile_id)
      : [];
  let extraProfilesData: Array<{
    id: string;
    name: string;
    is_activated: boolean;
    chart_text_context: string | null;
    chart_json?: CompiledChartData | null;
    natal_truth_dossier_json?: NatalTruthDossierV1 | null;
    profile_memory_summary: string | null;
    birth_date: string;
    birth_time: string;
    birth_city: string;
    birth_country: string;
  }> = [];

  if (extraIdsFiltered.length > 0) {
    const extraBaseCols = `id, name, is_activated, chart_text_context, profile_memory_summary, birth_date, birth_time, birth_city, birth_country${
      needsChartJson ? ', chart_json' : ''
    }`;
    const extraFullCols = `${extraBaseCols}${isVedicReadingTurn ? ', natal_truth_dossier_json' : ''}`;
    const extraPrimary = await supabaseAdmin
      .from('profiles')
      .select(extraFullCols)
      .in('id', extraIdsFiltered)
      .eq('user_id', req.appUser.id);
    if (!extraPrimary.error && extraPrimary.data) {
      extraProfilesData = extraPrimary.data as unknown as typeof extraProfilesData;
    } else {
      const { data: extraFallback } = await supabaseAdmin
        .from('profiles')
        .select(extraBaseCols)
        .in('id', extraIdsFiltered)
        .eq('user_id', req.appUser.id);
      extraProfilesData = (extraFallback || []) as unknown as typeof extraProfilesData;
    }
  }

  const contextTags: string[] = [];
  if (extraProfilesData.length > 0) {
    contextTags.push(`[Added chart(s): ${extraProfilesData.map((p) => p.name).join(', ')}]`);
  }
  if (validAttachments.length > 0) {
    contextTags.push(`[Attached: ${validAttachments.map((a) => a.name).join(', ')}]`);
  }
  const persistedUserContent =
    contextTags.length > 0 ? `${contextTags.join(' ')}\n${promptText}` : promptText;

  const [{ data: historyRows }, parentQuote] = await Promise.all([
    supabaseAdmin
      .from('messages')
      .select('id, role, content, excluded_from_context')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true }),
    parentMessageId
      ? supabaseAdmin
          .from('messages')
          .select('id, role, content')
          .eq('id', parentMessageId)
          .eq('conversation_id', conversation.id)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);

  // Save User Message immediately (lightweight metadata tags only — never raw binary blobs)
  const userWordCount = countWords(persistedUserContent);
  const { data: userMessage, error: userInsertErr } = await supabaseAdmin
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      parent_message_id: parentQuote?.id || null,
      role: 'user',
      content: persistedUserContent,
      word_count: userWordCount,
      expert_used: expertSlug,
      mode_used: modeSlug,
      output_format_used: outputSlug,
      language_used: languageSlug,
    })
    .select('*')
    .single();

  if (userInsertErr || !userMessage) {
    res.status(500).json({ error: 'Failed to persist your message' });
    return;
  }

  // Configure SSE headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (payload: Record<string, unknown>) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };

  sendEvent({ type: 'user_message', message: userMessage });

  if (isExtractionProbe) {
    const refusalText = PROMPT_EXTRACTION_REFUSAL;
    const refusalWordCount = countWords(refusalText);
    sendEvent({ type: 'chunk', text: refusalText });

    const { data: assistantMessage } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        parent_message_id: userMessage.id,
        role: 'assistant',
        content: refusalText,
        word_count: refusalWordCount,
        expert_used: expertSlug,
        mode_used: modeSlug,
        output_format_used: outputSlug,
        language_used: languageSlug,
        followups_json: [],
        tokens_in: 0,
        tokens_out: 0,
        credits_charged: 0,
      })
      .select('*')
      .single();

    const nextTotalWords =
      (conversation.total_word_count || 0) + userWordCount + refusalWordCount;
    const { data: updatedConversation } = await supabaseAdmin
      .from('conversations')
      .update({
        total_word_count: nextTotalWords,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation.id)
      .select('*')
      .single();

    sendEvent({
      type: 'done',
      assistantMessage,
      followups: [],
      conversation: updatedConversation || conversation,
      creditsBalance: req.appUser.credits_balance,
      creditsCharged: 0,
      aborted: false,
    });
    res.end();
    return;
  }

  // Apply explicit clarification chip patch if sent inline alongside the follow-up message
  if (
    isVedicCouncilTurn &&
    profileData &&
    clarifiedContextPatch &&
    typeof clarifiedContextPatch === 'object' &&
    !Array.isArray(clarifiedContextPatch)
  ) {
    try {
      const merged = mergeLifeContextPatch(
        profileData.life_context_json || {},
        clarifiedContextPatch as Partial<LifeContextData>
      );
      profileData.life_context_json = merged.sanitized;
      profileData.life_context_completeness = merged.completeness;
      await supabaseAdmin
        .from('profiles')
        .update({
          life_context_json: merged.sanitized,
          life_context_completeness: merged.completeness,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileData.id)
        .eq('user_id', req.appUser.id);
    } catch {
      // Non-fatal pre-migration or transient update failure
    }
  }

  let stage1Decision: Stage1RoutingDecision | null = null;
  if (isVedicCouncilTurn && validAttachments.length === 0) {
    const isBirthDetailsIntake =
      !profileData &&
      /\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2})\b/i.test(
        promptText
      );
    const isFollowUpTurn = (historyRows || []).some((m) => m.role === 'user');
    const historySummary = (historyRows || [])
      .slice(-4)
      .map((m) => `${m.role}: ${String(m.content || '').slice(0, 140)}`)
      .join('\n');

    try {
      stage1Decision = await evaluateStage1Routing({
        userPrompt: promptText,
        historySummary,
        lifeContext: profileData?.life_context_json || null,
        profileName: profileData?.name || null,
        hasPrimaryProfile: Boolean(profileData),
        extraProfilesCount: extraProfilesData.length,
        modeSlug,
        isFollowUpTurn,
        bypassClarification: Boolean(bypassClarification),
        explicitPlaybookId:
          typeof clarifiedPlaybookId === 'string' ? clarifiedPlaybookId : null,
        technicalDirective: safeTechnicalDirective,
        isBirthDetailsIntake,
      });
    } catch {
      stage1Decision = null;
    }
  }

  if (stage1Decision?.action === 'refuse_extraction') {
    const refusalText = stage1Decision.refusalText || PROMPT_EXTRACTION_REFUSAL;
    const refusalWordCount = countWords(refusalText);
    sendEvent({ type: 'chunk', text: refusalText });

    const { data: assistantMessage } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        parent_message_id: userMessage.id,
        role: 'assistant',
        content: refusalText,
        word_count: refusalWordCount,
        expert_used: expertSlug,
        mode_used: modeSlug,
        output_format_used: outputSlug,
        language_used: languageSlug,
        followups_json: [],
        tokens_in: 0,
        tokens_out: 0,
        credits_charged: 0,
      })
      .select('*')
      .single();

    const nextTotalWords =
      (conversation.total_word_count || 0) + userWordCount + refusalWordCount;
    const { data: updatedConversation } = await supabaseAdmin
      .from('conversations')
      .update({
        total_word_count: nextTotalWords,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation.id)
      .select('*')
      .single();

    sendEvent({
      type: 'done',
      assistantMessage,
      followups: [],
      conversation: updatedConversation || conversation,
      creditsBalance: req.appUser.credits_balance,
      creditsCharged: 0,
      aborted: false,
    });
    res.end();
    return;
  }

  if (
    stage1Decision &&
    (stage1Decision.action === 'clarify' || stage1Decision.action === 'prompt_partner_chart') &&
    stage1Decision.clarification
  ) {
    const clarificationText = stage1Decision.clarification.message;
    const clarificationWordCount = countWords(clarificationText);
    sendEvent({ type: 'chunk', text: clarificationText });

    const clarifySuggestionsPayload = {
      followups: [],
      deeper_analysis: [],
      clarification: stage1Decision.clarification,
      sutra_stage1: stage1Decision.routerResult,
    };

    const baseClarifyRow = {
      conversation_id: conversation.id,
      parent_message_id: userMessage.id,
      role: 'assistant',
      content: clarificationText,
      word_count: clarificationWordCount,
      expert_used: expertSlug,
      mode_used: modeSlug,
      output_format_used: outputSlug,
      language_used: languageSlug,
      followups_json: [],
      tokens_in: 0,
      tokens_out: 0,
      credits_charged: 0,
    };

    let assistantMessage: Record<string, unknown> | null = null;
    const insertClarify = await supabaseAdmin
      .from('messages')
      .insert({
        ...baseClarifyRow,
        suggestions_json: clarifySuggestionsPayload,
      })
      .select('*')
      .single();

    if (insertClarify.error) {
      const insertFallback = await supabaseAdmin
        .from('messages')
        .insert(baseClarifyRow)
        .select('*')
        .single();
      assistantMessage = insertFallback.data
        ? {
            ...(insertFallback.data as unknown as Record<string, unknown>),
            suggestions_json: clarifySuggestionsPayload,
          }
        : null;
    } else {
      assistantMessage = insertClarify.data as unknown as Record<string, unknown>;
    }

    const nextTotalWords =
      (conversation.total_word_count || 0) + userWordCount + clarificationWordCount;
    const { data: updatedConversation } = await supabaseAdmin
      .from('conversations')
      .update({
        total_word_count: nextTotalWords,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation.id)
      .select('*')
      .single();

    const enrichedConversation = normalizeConversationDefaults({
      ...((updatedConversation || conversation) as Record<string, unknown>),
      pillar: activePillar,
      companion_persona_json: activeCompanionPersona,
    });

    sendEvent({
      type: 'done',
      assistantMessage,
      followups: [],
      suggestions: clarifySuggestionsPayload,
      clarification: stage1Decision.clarification,
      pendingProfile: null,
      conversation: enrichedConversation,
      creditsBalance: req.appUser.credits_balance,
      creditsCharged: 0,
      aborted: false,
    });
    res.end();
    return;
  }

  const abortController = new AbortController();
  const handleDisconnect = () => {
    abortController.abort();
  };
  req.on('close', handleDisconnect);

  try {
    const streamResult = await streamConsultationResponse({
      userId: req.appUser.id,
      pillar: activePillar,
      companionPersona: activeCompanionPersona,
      conversation: {
        ...conversation,
        pillar: activePillar,
        companion_persona_json: activeCompanionPersona,
      },
      profile: profileData,
      scopeMemoryContext,
      extraProfiles: extraProfilesData,
      attachments: validAttachments,
      historyMessages: (historyRows || []) as Array<{
        id: string;
        role: 'user' | 'assistant';
        content: string;
        excluded_from_context: boolean;
      }>,
      parentQuoteMessage: parentQuote,
      userPrompt: promptText,
      technicalDirective: activePillar === 'council' ? safeTechnicalDirective : null,
      expertSlug,
      modeSlug,
      outputSlug,
      languageSlug,
      toneMode: normalizedToneMode,
      responseLength: normalizedResponseLength,
      preferredCallName: req.appUser.preferred_call_name || req.appUser.full_name || null,
      stage1Decision,
      userPriorFluency: req.appUser.sutra_user_profile_json?.inferred_fluency || null,
      deepAudit: useDeepAudit,
      abortSignal: abortController.signal,
      onChunk: (chunkText) => {
        sendEvent({ type: 'chunk', text: chunkText });
      },
    });

    req.off('close', handleDisconnect);

    const rawFinalText =
      streamResult.fullText.trim() ||
      (streamResult.aborted ? '*(Generation stopped by user.)*' : '');

    if (!rawFinalText) {
      sendEvent({ type: 'error', error: 'No response generated from OpenRouter.' });
      res.end();
      return;
    }

    const sanitizedFinal = sanitizeAssistantOutput(rawFinalText);
    const finalAssistantText = sanitizedFinal.text;
    const wasLeakIntercepted = Boolean(streamResult.leakIntercepted || sanitizedFinal.leaked);
    const assistantWordCount = countWords(finalAssistantText);

    // Deduct credits atomically (zero charge if leak intercepted; capped cleanly otherwise)
    const chargeTarget = wasLeakIntercepted
      ? 0
      : Math.min(streamResult.creditsCharged, req.appUser.credits_balance);
    let updatedBalance = req.appUser.credits_balance;

    if (chargeTarget > 0) {
      const { data: newBal, error: creditErr } = await supabaseAdmin.rpc('deduct_user_credits', {
        p_user_id: req.appUser.id,
        p_amount: chargeTarget,
        p_tx_type: 'chat_usage',
        p_reference_id: conversation.id,
        p_description:
          activePillar === 'companion'
            ? `Companion (${activeCompanionPersona?.name || 'Chat'})`
            : activePillar === 'clarity'
            ? 'Clarity Sidekick'
            : useDeepAudit
            ? `Deep Council Audit (${expertSlug} · ${modeSlug})`
            : `Consultation (${expertSlug} · ${modeSlug})`,
      });
      if (!creditErr && typeof newBal === 'number') {
        updatedBalance = newBal;
      }
    }

    // Two-tier structured suggestions apply strictly to Council consultations (not Companion/Clarity)
    const pendingProfile =
      activePillar === 'council' && !streamResult.aborted && !wasLeakIntercepted
        ? streamResult.pendingProfile || null
        : null;
    const isDefaultUntouchedTitle =
      conversation.title === 'New Consultation' ||
      conversation.title === 'Clarity' ||
      conversation.title === 'Companion Chat';
    const isFirstUserTurn =
      (historyRows || []).filter((m) => m.role === 'user').length === 0 && isDefaultUntouchedTitle;
    const hasInlineSuggestions = Boolean(
      activePillar === 'council' &&
        streamResult.suggestions &&
        (streamResult.suggestions.followups.length > 0 ||
          streamResult.suggestions.deeper_analysis.length > 0)
    );

    const useStage4AlignedSuggestions =
      activePillar === 'council' &&
      USE_DECOUPLED_STAGE4_SUGGESTIONS &&
      Boolean(streamResult.stage2Pkg) &&
      Boolean(streamResult.sutraMeta);

    const [structuredSuggestions, generatedTitle] = await Promise.all([
      activePillar !== 'council' ||
      streamResult.aborted ||
      wasLeakIntercepted ||
      Boolean(pendingProfile)
        ? Promise.resolve<MessageSuggestions>({ followups: [], deeper_analysis: [] })
        : hasInlineSuggestions && streamResult.suggestions
        ? Promise.resolve<MessageSuggestions>(streamResult.suggestions)
        : useStage4AlignedSuggestions && streamResult.stage2Pkg && streamResult.sutraMeta
        ? generateAlignedStage4Suggestions({
            stage2Pkg: streamResult.stage2Pkg,
            dossier: profileData?.natal_truth_dossier_json || null,
            routerResult: stage1Decision?.routerResult || null,
            sutraMeta: streamResult.sutraMeta,
            userQuestion: promptText,
            assistantAnswer: finalAssistantText,
            languageSlug,
            userFluency: streamResult.sutraMeta.effectiveFluency,
          })
        : generateStructuredSuggestions({
            userQuestion: promptText,
            assistantAnswer: finalAssistantText,
            expertSlug,
            modeSlug,
            languageSlug,
            hasProfile: Boolean(profileData?.chart_text_context || profileData?.is_activated),
          }),
      isFirstUserTurn && !wasLeakIntercepted && activePillar !== 'clarity'
        ? generateConversationTitle(
            promptText,
            profileData?.name,
            activePillar,
            activeCompanionPersona?.name
          )
        : Promise.resolve(conversation.title),
    ]);

    const followups = structuredSuggestions.followups.map((item) => item.text);
    const hasAnyStructured =
      structuredSuggestions.followups.length > 0 ||
      structuredSuggestions.deeper_analysis.length > 0;
    const hasSutraMetadata = Boolean(stage1Decision?.routerResult || streamResult.sutraMeta);
    const persistedSuggestionsPayload =
      hasAnyStructured || hasSutraMetadata
        ? {
            ...structuredSuggestions,
            ...(stage1Decision?.routerResult ? { sutra_stage1: stage1Decision.routerResult } : {}),
            ...(streamResult.sutraMeta ? { sutra_meta: streamResult.sutraMeta } : {}),
          }
        : null;

    const baseAssistantRow = {
      conversation_id: conversation.id,
      parent_message_id: userMessage.id,
      role: 'assistant',
      content: finalAssistantText,
      word_count: assistantWordCount,
      expert_used: expertSlug,
      mode_used: modeSlug,
      output_format_used: outputSlug,
      language_used: languageSlug,
      followups_json: followups,
      tokens_in: streamResult.tokensIn,
      tokens_out: streamResult.tokensOut,
      credits_charged: chargeTarget,
    };

    let assistantMessage: Record<string, unknown> | null = null;
    const insertWithSug = await supabaseAdmin
      .from('messages')
      .insert({
        ...baseAssistantRow,
        suggestions_json: persistedSuggestionsPayload,
      })
      .select('*')
      .single();

    if (insertWithSug.error) {
      // Graceful fallback if migration 005 (messages.suggestions_json) hasn't run yet
      const insertBase = await supabaseAdmin
        .from('messages')
        .insert(baseAssistantRow)
        .select('*')
        .single();
      assistantMessage = insertBase.data
        ? {
            ...(insertBase.data as unknown as Record<string, unknown>),
            suggestions_json: persistedSuggestionsPayload,
          }
        : null;
    } else {
      assistantMessage = insertWithSug.data as unknown as Record<string, unknown>;
    }

    // Update conversation total_word_count & title & updated_at
    const nextTotalWords = (conversation.total_word_count || 0) + userWordCount + assistantWordCount;
    const { data: updatedConversation } = await supabaseAdmin
      .from('conversations')
      .update({
        title: generatedTitle,
        total_word_count: nextTotalWords,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation.id)
      .select('*')
      .single();

    // Async non-blocking Profile Memory v2 update — STRICTLY Council profile threads only (never Clarity or Companion)
    if (
      activePillar === 'council' &&
      conversation.profile_id &&
      !streamResult.aborted &&
      !wasLeakIntercepted
    ) {
      const archivistTradition: 'vedic' | 'western' =
        expertSlug === 'western_astrologer' || expertSlug === 'modern_astrologer'
          ? 'western'
          : 'vedic';
      void updateProfileMemoryAfterTurn(conversation.profile_id, req.appUser.id, {
        routerResult: stage1Decision?.routerResult || null,
        domain: streamResult.sutraMeta?.domain || modeSlug,
        effectiveFluency: streamResult.sutraMeta?.effectiveFluency || null,
        hasTechnicalDirective: Boolean(safeTechnicalDirective),
        isDeepAudit: useDeepAudit,
        tradition: archivistTradition,
      });
    }

    const enrichedConversation = normalizeConversationDefaults({
      ...((updatedConversation || conversation) as Record<string, unknown>),
      pillar: activePillar,
      companion_persona_json: activeCompanionPersona,
    });

    sendEvent({
      type: 'done',
      assistantMessage,
      followups,
      suggestions: persistedSuggestionsPayload,
      sutraMeta: streamResult.sutraMeta || null,
      pendingProfile,
      conversation: enrichedConversation,
      creditsBalance: updatedBalance,
      creditsCharged: chargeTarget,
      aborted: streamResult.aborted,
    });
    res.end();
  } catch (err) {
    req.off('close', handleDisconnect);
    const message = err instanceof Error ? err.message : 'Consultation generation failed';
    sendEvent({ type: 'error', error: message });
    res.end();
  }
});

// 9. Update message (star to favorites or toggle excluded_from_context)
router.patch('/messages/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { data: msg } = await supabaseAdmin
    .from('messages')
    .select('id, conversation_id')
    .eq('id', req.params.id)
    .maybeSingle();

  if (!msg) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }

  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('id, user_id, profile_id')
    .eq('id', msg.conversation_id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  if (!conv) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { is_starred, excluded_from_context } = req.body || {};
  const updates: Record<string, boolean> = {};
  if (typeof is_starred === 'boolean') updates.is_starred = is_starred;
  if (typeof excluded_from_context === 'boolean') updates.excluded_from_context = excluded_from_context;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No valid message fields supplied' });
    return;
  }

  const { data: updated, error } = await supabaseAdmin
    .from('messages')
    .update(updates)
    .eq('id', msg.id)
    .select('*')
    .single();

  if (error) {
    res.status(500).json({ error: 'Failed to update message' });
    return;
  }

  // If context exclusion changed on a profile thread, rebuild memory faithfully
  if (typeof excluded_from_context === 'boolean' && conv.profile_id) {
    void rebuildProfileMemory(conv.profile_id, req.appUser.id);
  }

  res.json({ message: updated });
});

// 9b. Generate 8 More Followup / Deeper Analysis Suggestions for an assistant message
router.post('/messages/:id/suggestions/more', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  if (!(await isOpenRouterConfiguredAsync())) {
    res.status(503).json({ error: 'OPENROUTER_API_KEY is not configured on the server.' });
    return;
  }

  const msgResPrimary = await supabaseAdmin
    .from('messages')
    .select(MESSAGE_SELECT_COLUMNS)
    .eq('id', req.params.id)
    .maybeSingle();

  let msgRow: Record<string, unknown> | null = null;
  if (msgResPrimary.error) {
    const msgResFallback = await supabaseAdmin
      .from('messages')
      .select(MESSAGE_SELECT_COLUMNS_BASE)
      .eq('id', req.params.id)
      .maybeSingle();
    if (msgResFallback.data) {
      msgRow = {
        ...(msgResFallback.data as unknown as Record<string, unknown>),
        suggestions_json: null,
      };
    }
  } else if (msgResPrimary.data) {
    msgRow = msgResPrimary.data as unknown as Record<string, unknown>;
  }

  if (!msgRow) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }

  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('id, user_id, profile_id')
    .eq('id', String(msgRow.conversation_id))
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  if (!conv) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  if (msgRow.role !== 'assistant') {
    res.status(400).json({ error: 'Suggestions can only be extended for assistant replies' });
    return;
  }

  // Gather preceding user question + profile status
  let userQuestion = '';
  if (typeof msgRow.parent_message_id === 'string' && msgRow.parent_message_id) {
    const { data: parentMsg } = await supabaseAdmin
      .from('messages')
      .select('content')
      .eq('id', msgRow.parent_message_id)
      .maybeSingle();
    if (parentMsg?.content) {
      userQuestion = String(parentMsg.content);
    }
  }
  if (!userQuestion) {
    const { data: prevUser } = await supabaseAdmin
      .from('messages')
      .select('content')
      .eq('conversation_id', conv.id)
      .eq('role', 'user')
      .lt('created_at', String(msgRow.created_at))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prevUser?.content) {
      userQuestion = String(prevUser.content);
    }
  }

  let hasProfile = false;
  let moreProfileData: {
    chart_json?: CompiledChartData | null;
    natal_truth_dossier_json?: NatalTruthDossierV1 | null;
    life_context_json?: LifeContextData | null;
    chart_text_context?: string | null;
    is_activated?: boolean;
  } | null = null;

  const rawExisting = (msgRow.suggestions_json || null) as
    | (MessageSuggestions & {
        sutra_stage1?: Stage1RouterResult | null;
        sutra_meta?: SutraSynthesisMeta | null;
      })
    | null;

  const msgExpert =
    typeof msgRow.expert_used === 'string' && msgRow.expert_used
      ? msgRow.expert_used
      : 'council_synthesis';
  const msgMode =
    typeof msgRow.mode_used === 'string' && msgRow.mode_used ? msgRow.mode_used : 'general';
  const msgLang =
    typeof msgRow.language_used === 'string' && msgRow.language_used
      ? msgRow.language_used
      : req.appUser.default_language || 'English';

  const isEligibleForStage4More =
    Boolean(conv.profile_id) &&
    USE_DECOUPLED_STAGE4_SUGGESTIONS &&
    msgExpert !== 'western_astrologer' &&
    msgExpert !== 'modern_astrologer' &&
    msgExpert !== 'tarot_reader' &&
    msgExpert !== 'numerologist' &&
    msgMode !== 'learn_astrology';

  if (conv.profile_id) {
    if (isEligibleForStage4More) {
      const profRes = await supabaseAdmin
        .from('profiles')
        .select('is_activated, chart_text_context, chart_json, natal_truth_dossier_json, life_context_json')
        .eq('id', conv.profile_id)
        .maybeSingle();
      if (!profRes.error && profRes.data) {
        moreProfileData = profRes.data as unknown as typeof moreProfileData;
      } else {
        const profFallback = await supabaseAdmin
          .from('profiles')
          .select('is_activated, chart_text_context, chart_json')
          .eq('id', conv.profile_id)
          .maybeSingle();
        moreProfileData = (profFallback.data || null) as unknown as typeof moreProfileData;
      }
    } else {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('is_activated, chart_text_context')
        .eq('id', conv.profile_id)
        .maybeSingle();
      moreProfileData = (prof || null) as unknown as typeof moreProfileData;
    }
    hasProfile = Boolean(moreProfileData?.chart_text_context || moreProfileData?.is_activated);
  }

  const legacyFollowups = Array.isArray(msgRow.followups_json)
    ? (msgRow.followups_json as unknown[])
        .filter((q): q is string => typeof q === 'string' && Boolean(q.trim()))
        .map((q, idx) => ({ id: `legacy_${idx + 1}`, text: q.trim() }))
    : [];

  const existingFollowups =
    Array.isArray(rawExisting?.followups) && rawExisting.followups.length > 0
      ? rawExisting.followups
      : legacyFollowups;
  const existingDeeper = Array.isArray(rawExisting?.deeper_analysis)
    ? rawExisting.deeper_analysis
    : [];

  const existingTexts = [
    ...existingFollowups.map((item) => item.text),
    ...existingDeeper.map((item) => item.text),
  ].filter(Boolean);

  let generated: MessageSuggestions;
  if (isEligibleForStage4More && moreProfileData?.chart_json && (rawExisting?.sutra_meta || rawExisting?.sutra_stage1)) {
    const savedPlaybookId =
      rawExisting?.sutra_meta?.playbookId ||
      rawExisting?.sutra_stage1?.playbook_id ||
      'OPEN_ENDED_SYNTHESIS';
    const savedPlaybook = getPlaybookById(savedPlaybookId);
    const fallbackRouter: Stage1RouterResult = rawExisting?.sutra_stage1 || {
      playbook_id: savedPlaybook.id,
      playbook_confidence: 0.9,
      intent: rawExisting?.sutra_meta?.intent || savedPlaybook.defaultIntent,
      intent_confidence: 0.9,
      detected_user_fluency:
        (rawExisting?.sutra_meta?.effectiveFluency as UserFluencyTier) ||
        req.appUser.sutra_user_profile_json?.inferred_fluency ||
        'beginner',
      is_prompt_extraction: false,
      needs_clarification: false,
      requires_synastry_partner: savedPlaybook.requiresSynastry,
      requests_remedy_or_guidance: false,
      complexity_intensity: 6,
      provider_used: 'rule_guard',
      latency_ms: 0,
    };
    const stage2ForMore = await compileStage2ContextPackage({
      routerResult: fallbackRouter,
      playbook: savedPlaybook,
      chart: moreProfileData.chart_json,
      dossier: moreProfileData.natal_truth_dossier_json || null,
      lifeContext: moreProfileData.life_context_json || null,
    });
    const metaForMore: SutraSynthesisMeta = rawExisting?.sutra_meta || {
      intent: fallbackRouter.intent,
      playbookId: savedPlaybook.id,
      domain: savedPlaybook.domain,
      convergencePillarsAligned: 3,
      convergenceBandLabel: '3/5 Pillars Aligned',
      effectiveFluency: fallbackRouter.detected_user_fluency,
      isDeepAudit: false,
      cancellationsCount: stage2ForMore.triggeredCancellations.length,
    };
    generated = await generateMoreAlignedStage4Suggestions({
      stage2Pkg: stage2ForMore,
      dossier: moreProfileData.natal_truth_dossier_json || null,
      routerResult: fallbackRouter,
      sutraMeta: metaForMore,
      userQuestion: userQuestion || 'Follow-up reading insight',
      assistantAnswer: String(msgRow.content || ''),
      languageSlug: msgLang,
      userFluency: metaForMore.effectiveFluency,
      existingTexts,
      count: 8,
    });
  } else {
    generated = await generateMoreStructuredSuggestions({
      userQuestion: userQuestion || 'Follow-up reading insight',
      assistantAnswer: String(msgRow.content || ''),
      expertSlug: msgExpert,
      modeSlug: msgMode,
      languageSlug: msgLang,
      hasProfile,
      existingTexts,
      count: 8,
    });
  }

  const merged: MessageSuggestions & {
    sutra_stage1?: Stage1RouterResult | null;
    sutra_meta?: SutraSynthesisMeta | null;
  } = {
    ...(rawExisting?.sutra_stage1 ? { sutra_stage1: rawExisting.sutra_stage1 } : {}),
    ...(rawExisting?.sutra_meta ? { sutra_meta: rawExisting.sutra_meta } : {}),
    followups: [...existingFollowups, ...generated.followups],
    deeper_analysis: [...existingDeeper, ...generated.deeper_analysis],
  };

  const mergedFollowupsStrings = merged.followups.map((f) => f.text);

  const updatePrimary = await supabaseAdmin
    .from('messages')
    .update({
      suggestions_json: merged,
      followups_json: mergedFollowupsStrings,
    })
    .eq('id', String(msgRow.id));

  if (updatePrimary.error) {
    // Graceful fallback if migration 005 hasn't added suggestions_json
    await supabaseAdmin
      .from('messages')
      .update({
        followups_json: mergedFollowupsStrings,
      })
      .eq('id', String(msgRow.id));
  }

  const addedCount = generated.followups.length + generated.deeper_analysis.length;
  res.json({
    suggestions: merged,
    addedCount,
  });
});

// 10. Delete individual message + recalculate total_word_count + rebuild memory
router.delete('/messages/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { data: msg } = await supabaseAdmin
    .from('messages')
    .select('id, conversation_id, word_count')
    .eq('id', req.params.id)
    .maybeSingle();

  if (!msg) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }

  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('id, user_id, profile_id, total_word_count')
    .eq('id', msg.conversation_id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  if (!conv) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { error: delErr } = await supabaseAdmin.from('messages').delete().eq('id', msg.id);
  if (delErr) {
    res.status(500).json({ error: 'Failed to delete message' });
    return;
  }

  const nextTotalWords = Math.max(0, (conv.total_word_count || 0) - (msg.word_count || 0));
  await supabaseAdmin
    .from('conversations')
    .update({ total_word_count: nextTotalWords })
    .eq('id', conv.id);

  if (conv.profile_id) {
    void rebuildProfileMemory(conv.profile_id, req.appUser.id);
  }

  res.json({ deleted: true, total_word_count: nextTotalWords });
});

// 11. Quick Tools (Question Generator, Prompt Expander, Prompt Optimizer)
router.post('/tools', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }
  if (!(await isOpenRouterConfiguredAsync())) {
    res.status(503).json({ error: 'OPENROUTER_API_KEY is not configured on the server.' });
    return;
  }

  const { toolSlug, inputText, modeSlug, languageSlug, profileId } = req.body || {};
  if (
    toolSlug !== 'question_generator' &&
    toolSlug !== 'prompt_expander' &&
    toolSlug !== 'prompt_optimizer'
  ) {
    res.status(400).json({ error: 'Unsupported tool slug' });
    return;
  }

  if ((toolSlug === 'prompt_expander' || toolSlug === 'prompt_optimizer') && !String(inputText || '').trim()) {
    res.status(400).json({ error: 'Please enter a draft question or phrase first.' });
    return;
  }

  try {
    const result = await runQuickTool({
      toolSlug,
      inputText: String(inputText || ''),
      modeSlug: typeof modeSlug === 'string' ? modeSlug : 'general',
      languageSlug: typeof languageSlug === 'string' ? languageSlug : req.appUser.default_language,
      profileId: typeof profileId === 'string' ? profileId : null,
      userId: req.appUser.id,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Quick tool failed' });
  }
});

// 12. User Custom Prompts ("My Prompts", max 10)
router.get('/custom-prompts', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('custom_prompts')
    .select('*')
    .eq('user_id', req.appUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: 'Failed to load custom prompts' });
    return;
  }

  res.json({ prompts: data || [], maxLimit: 10 });
});

router.post('/custom-prompts', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { title, prompt_text } = req.body || {};
  if (!String(title || '').trim() || !String(prompt_text || '').trim()) {
    res.status(400).json({ error: 'Title and prompt text are required.' });
    return;
  }

  const { count } = await supabaseAdmin
    .from('custom_prompts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.appUser.id);

  if ((count || 0) >= 10) {
    res.status(400).json({ error: 'Maximum of 10 custom prompts reached. Delete one to add another.' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('custom_prompts')
    .insert({
      user_id: req.appUser.id,
      title: String(title).trim().slice(0, 80),
      prompt_text: String(prompt_text).trim().slice(0, 4000),
    })
    .select('*')
    .single();

  if (error || !data) {
    res.status(500).json({ error: error?.message || 'Failed to save custom prompt' });
    return;
  }

  res.status(201).json({ prompt: data });
});

router.delete('/custom-prompts/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { error } = await supabaseAdmin
    .from('custom_prompts')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id);

  if (error) {
    res.status(500).json({ error: 'Failed to delete prompt' });
    return;
  }

  res.json({ deleted: true });
});

export default router;
