import crypto from 'crypto';
import { Router } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { sanitizeHumanCallName } from '../services/abuseGuard';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import {
  PROMPT_EXTRACTION_REFUSAL,
  countWords,
  detectPromptExtractionAttempt,
  generateMoreStructuredSuggestions,
  generateStructuredSuggestions,
  isOpenRouterConfiguredAsync,
  runQuickTool,
  sanitizeAssistantOutput,
  streamConsultationResponse,
  type MessageSuggestions,
} from '../services/geminiOrchestrator';
import { isAstrologyApiConfigured } from '../services/astrologyApi';
import { compileBirthChart, enrichCompiledChart, type CompiledChartData } from '../services/chartCompiler';
import {
  compactConversationThreadMemory,
  deleteUserMemoryItem,
  extractAndPersistCouncilAnalystNotes,
  getCompanionBond,
  getUserLivingContextState,
  getUserMemorySnapshot,
  rebuildProfileMemory,
  recordCompanionBubbleReactionBond,
  resetCompanionBond,
  updateCompanionBondAfterTurn,
  updateCompanionBondManual,
  updateCompanionProfileMemoryAfterTurn,
  updateProfileMemoryAfterTurn,
  updateUserMemorySnapshot,
  type CompanionBondState,
} from '../services/memoryArchivist';
import { getPublicChatCatalogCached } from '../services/promptDefaults';
import {
  getEnginePromptOverrides,
  getPricingConfig,
  getPublicChatbotUiConfig,
  getPublicSuggestionsConfig,
  getResolvedGuideConfig,
} from '../services/platformSettings';
import { checkRateLimit } from '../services/abuseGuard';
import {
  COMPANION_ARCHETYPES,
  analyzeCompanionTurnContext,
  generateContextualCompanionReturnGreeting,
  generateMatchedCompanions,
  type ChatPillar,
  type CompanionArchetypeSlug,
  type CompanionPersona,
  type CompanionPromptProfileContext,
} from '../services/companionEngine';
import {
  ensureCompanionV2Initialized,
  mapCustomPersonaToV2PresetRecord,
} from '../services/companionV2Mapper';
import {
  getCompanionBySlug,
  getPublicCompanionsCatalogCached,
  normalizeCompanionSlug,
  resolveCompanionCapabilities,
  toPublicCompanionCard,
  type CompanionPresetRecord,
} from '../services/companionPresets';
import {
  deleteSharedReadingNote,
  formatCouncilReadingNotesForCompanion,
  listSharedReadingNotes,
  saveSharedReadingNote,
} from '../services/readingNotes';
import type {
  ChatStyle,
  CompanionChatCue,
  MessageReaction,
  PublicCompanionCard,
} from '../../components/app/chatTypes';
import {
  evaluateStage1Routing,
  type Stage1RoutingDecision,
} from '../services/intentRouter';
import {
  mergeLifeContextPatch,
  mergeUserAndProfileContextForPrompt,
  type LifeContextData,
} from '../services/lifeContextGuard';
import type {
  ConversationThreadKind,
  CouncilAnalystNote,
  DeepProfileBucketKey,
  DeepProfileData,
  UserContextPreferences,
} from '../../lib/lifeContextSchema';
import {
  buildNatalTruthDossierLayerA,
  buildWesternTruthDossier,
  CURRENT_NATAL_DOSSIER_VERSION,
  type NatalTruthDossierV1,
} from '../services/natalDossier';
import {
  generateAlignedStage4Suggestions,
  generateFastMoreStage4Suggestions,
} from '../services/suggestionEngine';
import { USE_DECOUPLED_STAGE4_SUGGESTIONS } from '../services/vedicAstrologerEngine';
import { recordChatbotPipelineLog } from '../services/pipelineLogger';
import { scheduleBackgroundTask } from '../lib/backgroundTask';
import {
  DEFAULT_COUNCIL_EXPERT_SLUG,
  normalizeCouncilSlug,
  type Stage1RouterResult,
  type UserFluencyTier,
  type VedicSynthesisMeta,
} from '../../lib/vedicTypes';

const router = Router();

const MAX_ACTIVE_TABS = 10;

const CONVERSATION_LIST_COLUMNS_BASE =
  'id, user_id, profile_id, linked_report_id, title, mode_type, is_bookmarked, total_word_count, use_full_profile_memory, updated_at, created_at';
const CONVERSATION_LIST_COLUMNS_V5 = `${CONVERSATION_LIST_COLUMNS_BASE}, ask_later_json`;
const CONVERSATION_LIST_COLUMNS_V6 = `${CONVERSATION_LIST_COLUMNS_V5}, pillar, is_active_tab, active_tab_order, companion_type, companion_persona_json`;
const CONVERSATION_LIST_COLUMNS_V7 = `${CONVERSATION_LIST_COLUMNS_V6}, companion_slug, companion_chat_mode`;
const CONVERSATION_LIST_COLUMNS_V8 = `${CONVERSATION_LIST_COLUMNS_V7}, thread_kind`;
const CONVERSATION_TURN_COLUMNS_V8 = `${CONVERSATION_LIST_COLUMNS_V7}, thread_memory_summary, thread_memory_msg_count`;

const MESSAGE_SELECT_COLUMNS_BASE =
  'id, conversation_id, parent_message_id, role, content, word_count, expert_used, mode_used, output_format_used, language_used, is_starred, excluded_from_context, followups_json, credits_charged, created_at';
const MESSAGE_SELECT_COLUMNS = `${MESSAGE_SELECT_COLUMNS_BASE}, suggestions_json`;
const MESSAGE_SELECT_COLUMNS_V2 = `${MESSAGE_SELECT_COLUMNS}, reaction, render_style, referral_json`;

function normalizeConversationDefaults(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ask_later_json: [],
    pillar: 'council',
    is_active_tab: false,
    active_tab_order: 0,
    companion_type: null,
    companion_slug: null,
    companion_chat_mode: null,
    companion_persona_json: null,
    thread_kind: 'chat',
    ...row,
  };
}

function normalizeMessageDefaults(row: Record<string, unknown>): Record<string, unknown> {
  return {
    suggestions_json: null,
    reaction: null,
    render_style: null,
    referral_json: null,
    ...row,
  };
}

function isValidPillar(v: unknown): v is ChatPillar {
  return v === 'council' || v === 'companion' || v === 'clarity';
}

function isValidCompanionType(v: unknown): v is CompanionArchetypeSlug {
  return COMPANION_ARCHETYPES.some((a) => a.slug === v);
}

function isValidCompanionChatCue(v: unknown): v is CompanionChatCue {
  return v === 'natural' || v === 'just_listen' || v === 'help_think';
}

function isValidThreadKind(v: unknown): v is ConversationThreadKind {
  return v === 'chat' || v === 'journal' || v === 'checkin' || v === 'goal_review';
}

function isChatModeConstraintError(
  err: { code?: string; message?: string } | null | undefined
): boolean {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  return (
    (err.code === '23514' || msg.includes('check constraint')) &&
    msg.includes('companion_chat_mode')
  );
}

function buildPublicCompanionPersonaSnapshot(preset: CompanionPresetRecord): Record<string, unknown> {
  return {
    id: preset.id,
    slug: preset.slug,
    name: preset.name,
    age: preset.age,
    gender: preset.sex,
    companion_type: 'friend' as CompanionArchetypeSlug,
    role_label: preset.primary_expertise,
    background: preset.cultural_fluency,
    tagline: preset.tagline,
    card_subtitle: preset.card_subtitle || undefined,
    bio: preset.short_bio || preset.full_bio,
    how_conversations_feel: preset.how_conversations_feel || undefined,
    conversation_style: preset.primary_expertise,
    opening_message: preset.welcome_messages[0] || '',
    avatar_url: preset.avatar_url,
    monogram_palette: preset.monogram_palette,
    chat_style: preset.chat_style,
    skill_level: preset.skill_level,
    tts_voice_profile: preset.tts_voice_profile,
    supports_listening_cue: preset.supports_listening_cue,
  };
}

function stripSensitivePersonaFields(persona: unknown): Record<string, unknown> | null {
  if (!persona || typeof persona !== 'object') return null;
  const {
    system_prompt: _sp,
    backstory: _bs,
    soul_consciousness: _sc,
    hard_rules: _hr,
    soft_rules: _sr,
    model_id: _mi,
    personality_v2_json: _pv2,
    draft_payload_json: _dp,
    core_identity_locked: _cil,
    ...safe
  } = persona as Record<string, unknown>;
  return safe;
}

const COUNCIL_EXPERT_FALLBACK_NAMES: Record<string, string> = {
  [DEFAULT_COUNCIL_EXPERT_SLUG]: 'Vedic Astrologer',
  kp_precision: 'KP Astrology',
  jaimini: 'Jaimini Jyotish',
  western_astrologer: 'Western Astrologer',
  modern_astrologer: 'Modern Astrologer',
  tarot_reader: 'Tarot',
  numerologist: 'Numerology',
  hellenistic_astrologer: 'Hellenistic Astrologer',
  learn_astrology: 'Learn Astrology',
};

function getCouncilExpertDisplayName(
  slug: string,
  catalog?: { experts?: Array<{ slug: string; displayName: string }> } | null
): string {
  const fromCatalog = catalog?.experts?.find((e) => e.slug === slug)?.displayName?.trim();
  if (fromCatalog) return fromCatalog;
  return COUNCIL_EXPERT_FALLBACK_NAMES[slug] || 'Vedic Astrologer';
}

function buildDeterministicCouncilTitle(params: {
  profileName?: string | null;
  profileShortName?: string | null;
  councilDisplayName: string;
}): string {
  const person =
    params.profileShortName?.trim() ||
    params.profileName?.trim() ||
    'General';
  return `${person} (${params.councilDisplayName})`.slice(0, 80);
}

function isAutoGeneratedCouncilTitle(
  title: unknown,
  knownCouncilNames: string[] = []
): boolean {
  const clean = typeof title === 'string' ? title.trim().toLowerCase() : '';
  if (!clean || clean === 'new consultation' || clean === 'new chat') {
    return true;
  }
  const match = clean.match(/^.+?\s*\(([^()]+)\)$/);
  if (!match) return false;
  const inner = match[1].trim().toLowerCase();
  const validSet = new Set([
    ...Object.values(COUNCIL_EXPERT_FALLBACK_NAMES).map((v) => v.toLowerCase()),
    ...knownCouncilNames.map((v) => v.trim().toLowerCase()).filter(Boolean),
  ]);
  return validSet.has(inner);
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
    buildConvQuery(CONVERSATION_LIST_COLUMNS_V8),
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
    const convResV7 = await buildConvQuery(CONVERSATION_LIST_COLUMNS_V7);
    if (!convResV7.error && convResV7.data) {
      convRows = ((convResV7.data || []) as unknown as Array<Record<string, unknown>>).map(
        normalizeConversationDefaults
      );
    } else {
      const convResV6 = await buildConvQuery(CONVERSATION_LIST_COLUMNS_V6);
      if (!convResV6.error && convResV6.data) {
        convRows = ((convResV6.data || []) as unknown as Array<Record<string, unknown>>).map(
          normalizeConversationDefaults
        );
      } else {
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
      }
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

  // Fetch lightweight single-line last-message snippet strictly for past companion conversations
  const companionIds = convRows
    .filter((c) => c.pillar === 'companion' || Boolean(c.companion_persona_json))
    .map((c) => String(c.id))
    .slice(0, 15);

  if (companionIds.length > 0) {
    const { data: recentCompanionMsgs } = await supabaseAdmin
      .from('messages')
      .select('conversation_id, content, created_at')
      .in('conversation_id', companionIds)
      .order('created_at', { ascending: false })
      .limit(Math.max(20, companionIds.length * 4));

    if (Array.isArray(recentCompanionMsgs) && recentCompanionMsgs.length > 0) {
      const latestByConv = new Map<string, string>();
      for (const row of recentCompanionMsgs as Array<{ conversation_id?: string; content?: string }>) {
        const cid = row.conversation_id;
        if (!cid || latestByConv.has(cid)) continue;
        const clean = String(row.content || '')
          .replace(/\[\[BUBBLE\]\]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (clean) {
          latestByConv.set(cid, clean.length > 100 ? `${clean.slice(0, 97).trim()}…` : clean);
        }
      }
      convRows = convRows.map((c) => {
        const preview = latestByConv.get(String(c.id));
        return preview ? { ...c, last_message_preview: preview } : c;
      });
    }
  }

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
    expert_slug,
    title,
    use_full_profile_memory,
    pillar,
    is_active_tab,
    active_tab_order,
    companion_type,
    companion_persona_json,
    thread_kind,
  } = req.body || {};

  const normalizedPillar: ChatPillar = isValidPillar(pillar) ? pillar : 'council';
  const resolvedThreadKind: ConversationThreadKind = isValidThreadKind(thread_kind)
    ? thread_kind
    : 'chat';
  const effectiveProfileId =
    normalizedPillar === 'council' || normalizedPillar === 'companion'
      ? profile_id || null
      : null;

  let ownedProfileMeta: { id: string; name?: string | null; short_name?: string | null } | null = null;
  if (effectiveProfileId) {
    const profWithShort = await supabaseAdmin
      .from('profiles')
      .select('id, name, short_name')
      .eq('id', effectiveProfileId)
      .eq('user_id', req.appUser.id)
      .maybeSingle();

    if (profWithShort.error) {
      const profBasic = await supabaseAdmin
        .from('profiles')
        .select('id, name')
        .eq('id', effectiveProfileId)
        .eq('user_id', req.appUser.id)
        .maybeSingle();
      ownedProfileMeta = profBasic.data as { id: string; name?: string | null } | null;
    } else {
      ownedProfileMeta = profWithShort.data as {
        id: string;
        name?: string | null;
        short_name?: string | null;
      } | null;
    }

    if (!ownedProfileMeta) {
      res.status(404).json({ error: 'Selected birth profile not found' });
      return;
    }
  }

  const normalizedModeType =
    mode_type === 'learn_astrology' || mode_type === 'report_followup'
      ? mode_type
      : 'reading';

  let defaultTitle = 'New Consultation';
  if (normalizedPillar === 'clarity') {
    defaultTitle = 'Clarity';
  } else if (normalizedPillar === 'companion') {
    defaultTitle =
      typeof companion_persona_json?.name === 'string' && companion_persona_json.name.trim()
        ? companion_persona_json.name.trim()
        : 'Companion Chat';
  } else {
    const publicCatalog = await getPublicChatCatalogCached();
    const fallbackCouncilExpert =
      req.appUser.default_astrology_mode === 'western'
        ? req.appUser.default_expert === 'modern_astrologer' ||
          req.appUser.default_expert === 'hellenistic_astrologer'
          ? req.appUser.default_expert
          : 'western_astrologer'
        : normalizeCouncilSlug(req.appUser.default_expert);
    const initialExpertSlug =
      normalizedModeType === 'learn_astrology'
        ? 'learn_astrology'
        : typeof expert_slug === 'string' && expert_slug.trim()
        ? normalizeCouncilSlug(expert_slug)
        : fallbackCouncilExpert;
    defaultTitle = buildDeterministicCouncilTitle({
      profileName: ownedProfileMeta?.name,
      profileShortName: ownedProfileMeta?.short_name,
      councilDisplayName: getCouncilExpertDisplayName(initialExpertSlug, publicCatalog),
    });
  }

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

  const v8Insert = await supabaseAdmin
    .from('conversations')
    .insert({ ...extendedPayload, thread_kind: resolvedThreadKind })
    .select(CONVERSATION_LIST_COLUMNS_V8)
    .single();

  if (!v8Insert.error && v8Insert.data) {
    res.status(201).json({
      conversation: normalizeConversationDefaults(
        v8Insert.data as unknown as Record<string, unknown>
      ),
      persistedPillar: true,
    });
    return;
  }

  const primaryInsert = await supabaseAdmin
    .from('conversations')
    .insert(extendedPayload)
    .select(CONVERSATION_LIST_COLUMNS_V7)
    .single();

  if (!primaryInsert.error && primaryInsert.data) {
    res.status(201).json({
      conversation: normalizeConversationDefaults({
        ...(primaryInsert.data as unknown as Record<string, unknown>),
        thread_kind: resolvedThreadKind,
      }),
      persistedPillar: true,
    });
    return;
  }

  // Graceful fallback if migration 006 hasn't been executed yet
  const fallbackInsert = await supabaseAdmin
    .from('conversations')
    .insert(basePayload)
    .select(CONVERSATION_LIST_COLUMNS_BASE)
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
      thread_kind: resolvedThreadKind,
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
    companion_chat_mode,
  } = req.body || {};

  const baseUpdates: Record<string, unknown> = {};
  const v6Updates: Record<string, unknown> = {};
  const v7Updates: Record<string, unknown> = {};

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
  if (companion_chat_mode !== undefined) {
    v7Updates.companion_chat_mode = isValidCompanionChatCue(companion_chat_mode)
      ? companion_chat_mode
      : null;
  }

  const allUpdates = { ...baseUpdates, ...v6Updates, ...v7Updates };
  if (Object.keys(allUpdates).length === 0) {
    res.status(400).json({ error: 'No valid update fields supplied' });
    return;
  }

  const primaryPatch = await supabaseAdmin
    .from('conversations')
    .update({ ...allUpdates, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id)
    .select(CONVERSATION_LIST_COLUMNS_V7)
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

  // Safe fallback if Migration 020 has not yet added 'natural' to DB check constraint
  if (isChatModeConstraintError(primaryPatch.error) && v7Updates.companion_chat_mode === 'natural') {
    const compatPatch = await supabaseAdmin
      .from('conversations')
      .update({
        ...baseUpdates,
        ...v6Updates,
        companion_chat_mode: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('user_id', req.appUser.id)
      .select(CONVERSATION_LIST_COLUMNS_V7)
      .maybeSingle();
    if (!compatPatch.error && compatPatch.data) {
      res.json({
        conversation: normalizeConversationDefaults({
          ...(compatPatch.data as unknown as Record<string, unknown>),
          companion_chat_mode: 'natural',
        }),
        persisted: true,
      });
      return;
    }
  }

  // Graceful fallback before migration 015 / 006 runs
  if (Object.keys(v7Updates).length > 0 && Object.keys({ ...baseUpdates, ...v6Updates }).length > 0) {
    const v6Patch = await supabaseAdmin
      .from('conversations')
      .update({ ...baseUpdates, ...v6Updates, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.appUser.id)
      .select(CONVERSATION_LIST_COLUMNS_V6)
      .maybeSingle();
    if (!v6Patch.error && v6Patch.data) {
      res.json({
        conversation: normalizeConversationDefaults({
          ...(v6Patch.data as unknown as Record<string, unknown>),
          ...v7Updates,
        }),
        persisted: false,
      });
      return;
    }
  }

  if (Object.keys(v6Updates).length > 0 || Object.keys(v7Updates).length > 0) {
    if (Object.keys(baseUpdates).length > 0) {
      const basePatch = await supabaseAdmin
        .from('conversations')
        .update({ ...baseUpdates, updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .eq('user_id', req.appUser.id)
        .select(CONVERSATION_LIST_COLUMNS_BASE)
        .maybeSingle();
      if (!basePatch.error && basePatch.data) {
        res.json({
          conversation: normalizeConversationDefaults({
            ...(basePatch.data as unknown as Record<string, unknown>),
            ...v6Updates,
            ...v7Updates,
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
            ...v7Updates,
          }),
          persisted: false,
        });
        return;
      }
    }
  }

  res.status(404).json({ error: 'Consultation not found' });
});

// 4a. List Active Preset Companions + User Custom Companions with recent thread stats
router.get('/companions', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const catalog = await getPublicCompanionsCatalogCached();

  type CompanionThreadMeta = {
    last_conversation_id: string | null;
    last_interaction_at: string | null;
    thread_count: number;
  };
  const statsBySlug = new Map<string, CompanionThreadMeta>();

  const convSlugRes = await supabaseAdmin
    .from('conversations')
    .select('id, companion_slug, companion_persona_json, updated_at')
    .eq('user_id', req.appUser.id)
    .eq('pillar', 'companion')
    .order('updated_at', { ascending: false })
    .limit(120);

  let convRows: Array<Record<string, unknown>> = [];
  if (!convSlugRes.error && convSlugRes.data) {
    convRows = convSlugRes.data as unknown as Array<Record<string, unknown>>;
  } else {
    const convFallbackRes = await supabaseAdmin
      .from('conversations')
      .select('id, companion_persona_json, updated_at')
      .eq('user_id', req.appUser.id)
      .eq('pillar', 'companion')
      .order('updated_at', { ascending: false })
      .limit(120);
    if (!convFallbackRes.error && convFallbackRes.data) {
      convRows = convFallbackRes.data as unknown as Array<Record<string, unknown>>;
    }
  }

  for (const row of convRows) {
    const rawSlug =
      (typeof row.companion_slug === 'string' && row.companion_slug) ||
      (row.companion_persona_json &&
      typeof row.companion_persona_json === 'object' &&
      typeof (row.companion_persona_json as Record<string, unknown>).slug === 'string'
        ? String((row.companion_persona_json as Record<string, unknown>).slug)
        : '');
    const slug = normalizeCompanionSlug(rawSlug);
    if (!slug) continue;

    const existing = statsBySlug.get(slug);
    const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : null;
    if (!existing) {
      statsBySlug.set(slug, {
        last_conversation_id: String(row.id),
        last_interaction_at: updatedAt,
        thread_count: 1,
      });
    } else {
      existing.thread_count += 1;
    }
  }

  const enrichedCompanions: PublicCompanionCard[] = catalog.map((card) => {
    const meta = statsBySlug.get(card.slug.toLowerCase());
    return meta
      ? {
          ...card,
          last_conversation_id: meta.last_conversation_id,
          last_interaction_at: meta.last_interaction_at,
          thread_count: meta.thread_count,
        }
      : {
          ...card,
          last_conversation_id: null,
          last_interaction_at: null,
          thread_count: 0,
        };
  });

  // Load saved custom companions from "Find someone new" (graceful if migration 015 hasn't run)
  let customCompanions: Array<{
    id: string;
    slug: string;
    persona: Record<string, unknown>;
    last_conversation_id: string | null;
    last_interaction_at: string | null;
    thread_count: number;
  }> = [];

  try {
    const customRes = await supabaseAdmin
      .from('user_custom_companions')
      .select('id, slug, persona_json, last_conversation_id, updated_at')
      .eq('user_id', req.appUser.id)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (!customRes.error && customRes.data) {
      customCompanions = (customRes.data as Array<Record<string, unknown>>)
        .map((row) => {
          const slug = normalizeCompanionSlug(String(row.slug || ''));
          const safePersona = stripSensitivePersonaFields(row.persona_json);
          if (!slug || !safePersona) return null;
          const meta = statsBySlug.get(slug);
          return {
            id: String(row.id),
            slug,
            persona: { ...safePersona, slug },
            last_conversation_id:
              meta?.last_conversation_id ||
              (typeof row.last_conversation_id === 'string' ? row.last_conversation_id : null),
            last_interaction_at:
              meta?.last_interaction_at ||
              (typeof row.updated_at === 'string' ? row.updated_at : null),
            thread_count: meta?.thread_count || 0,
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));
    }
  } catch {
    customCompanions = [];
  }

  res.setHeader('Cache-Control', 'private, no-cache');
  res.json({
    companions: enrichedCompanions,
    customCompanions,
  });
});

// 4a-ii. List a User's Threads for a Specific Companion Slug
router.get('/companions/:slug/threads', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const rawSlugParam = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const normalizedSlug = normalizeCompanionSlug(typeof rawSlugParam === 'string' ? rawSlugParam : '');
  if (!normalizedSlug) {
    res.status(400).json({ error: 'Companion slug is required' });
    return;
  }

  let threads: Array<Record<string, unknown>> = [];
  const primaryRes = await supabaseAdmin
    .from('conversations')
    .select(CONVERSATION_LIST_COLUMNS_V7)
    .eq('user_id', req.appUser.id)
    .eq('pillar', 'companion')
    .eq('companion_slug', normalizedSlug)
    .order('updated_at', { ascending: false })
    .limit(40);

  if (!primaryRes.error && primaryRes.data) {
    threads = (primaryRes.data as unknown as Array<Record<string, unknown>>).map(
      normalizeConversationDefaults
    );
  } else {
    // Graceful pre-migration fallback matching persona slug in memory
    const fallbackRes = await supabaseAdmin
      .from('conversations')
      .select(CONVERSATION_LIST_COLUMNS_V6)
      .eq('user_id', req.appUser.id)
      .eq('pillar', 'companion')
      .order('updated_at', { ascending: false })
      .limit(80);
    if (!fallbackRes.error && fallbackRes.data) {
      threads = (fallbackRes.data as unknown as Array<Record<string, unknown>>)
        .filter((row) => {
          const p = row.companion_persona_json as Record<string, unknown> | null;
          return normalizeCompanionSlug(typeof p?.slug === 'string' ? p.slug : '') === normalizedSlug;
        })
        .map(normalizeConversationDefaults);
    }
  }

  if (threads.length > 0) {
    const ids = threads.map((t) => String(t.id));
    const { data: recentMsgs } = await supabaseAdmin
      .from('messages')
      .select('conversation_id, content, created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false })
      .limit(Math.max(20, ids.length * 3));

    if (Array.isArray(recentMsgs) && recentMsgs.length > 0) {
      const latestMap = new Map<string, string>();
      for (const m of recentMsgs as Array<{ conversation_id?: string; content?: string }>) {
        const cid = m.conversation_id;
        if (!cid || latestMap.has(cid)) continue;
        const clean = String(m.content || '')
          .replace(/\[\[BUBBLE\]\]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (clean) {
          latestMap.set(cid, clean.length > 100 ? `${clean.slice(0, 97).trim()}…` : clean);
        }
      }
      threads = threads.map((t) => {
        const preview = latestMap.get(String(t.id));
        return preview ? { ...t, last_message_preview: preview } : t;
      });
    }
  }

  res.json({ threads });
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
    preferredCallName:
      sanitizeHumanCallName(req.appUser.preferred_call_name) ||
      sanitizeHumanCallName(req.appUser.full_name) ||
      null,
  });

  res.json({ companions });
});

// 4b-ii. Shared Council Reading Notes (Council -> Companion Handoff & Context Bridge)
router.get('/reading-notes', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }
  const profileId =
    typeof req.query.profileId === 'string' && req.query.profileId.trim()
      ? req.query.profileId.trim()
      : null;

  const notes = await listSharedReadingNotes(supabaseAdmin, req.appUser.id, profileId);
  res.json({ notes });
});

router.post('/reading-notes', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }
  const body = (req.body || {}) as Record<string, unknown>;
  const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
  if (!summary) {
    res.status(400).json({ error: 'Reading note summary is required.' });
    return;
  }
  const entry = await saveSharedReadingNote(supabaseAdmin, req.appUser.id, {
    profile_id: typeof body.profile_id === 'string' ? body.profile_id : null,
    profile_label: typeof body.profile_label === 'string' ? body.profile_label : null,
    expert_slug: typeof body.expert_slug === 'string' ? body.expert_slug : null,
    expert_label: typeof body.expert_label === 'string' ? body.expert_label : 'Council Reading',
    astrology_mode:
      body.astrology_mode === 'vedic' || body.astrology_mode === 'western'
        ? body.astrology_mode
        : null,
    conversation_id: typeof body.conversation_id === 'string' ? body.conversation_id : null,
    message_id: typeof body.message_id === 'string' ? body.message_id : null,
    title: typeof body.title === 'string' ? body.title : null,
    summary,
  });
  if (!entry) {
    res.status(400).json({ error: 'Could not save reading note.' });
    return;
  }
  res.status(201).json({ note: entry });
});

router.delete('/reading-notes/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }
  const noteId = String(req.params.id || '').trim();
  const removed = await deleteSharedReadingNote(supabaseAdmin, req.appUser.id, noteId);
  res.json({ deleted: removed, id: noteId });
});

const buildWarmHandoffGreeting = (
  targetName: string,
  chatStyle: ChatStyle,
  handoffFromName?: string,
  handoffNote?: string
): string | null => {
  const cleanNote = String(handoffNote || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
  if (!cleanNote) return null;

  const fromLabel = String(handoffFromName || '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 40);
  const firstLine = fromLabel
    ? `Hey — ${fromLabel} mentioned you wanted to talk through this together: ${cleanNote}`
    : `Hey — glad you came over. Looking at what you just shared: ${cleanNote}`;
  const secondLine =
    `No need to repeat everything from scratch. What part of this feels most helpful to look at first, ${targetName ? 'whenever you are ready' : 'right now'}?`;

  if (chatStyle === 'chat_bubbles') {
    return `${firstLine} [[BUBBLE]] ${secondLine}`;
  }
  return `${firstLine}\n\n${secondLine}`;
};

// 4c. Start or Resume a Companion Conversation (Preset Companion by slug OR Custom "Find someone new")
router.post('/companions/start', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const rawCompanionSlug =
    typeof req.body?.companionSlug === 'string' ? req.body.companionSlug.trim() : '';
  const forceNew = Boolean(req.body?.forceNew);
  const explicitRequestedChatMode: CompanionChatCue | null = isValidCompanionChatCue(
    req.body?.chatMode
  )
    ? req.body.chatMode
    : null;
  const requestedChatMode: CompanionChatCue = explicitRequestedChatMode ?? 'natural';
  const pinAsTab = Boolean(req.body?.pinAsTab);
  const handoffNote =
    typeof req.body?.handoffNote === 'string' ? req.body.handoffNote.trim().slice(0, 240) : '';
  const handoffFromName =
    typeof req.body?.handoffFromName === 'string'
      ? req.body.handoffFromName.trim().slice(0, 40)
      : '';
  const handoffFullContext =
    typeof req.body?.handoffFullContext === 'string'
      ? req.body.handoffFullContext.trim().slice(0, 1400)
      : '';
  const handoffTitle =
    typeof req.body?.handoffTitle === 'string' ? req.body.handoffTitle.trim().slice(0, 140) : '';
  const handoffExpertLabel =
    typeof req.body?.handoffExpertLabel === 'string'
      ? req.body.handoffExpertLabel.trim().slice(0, 80)
      : '';
  const handoffExpertSlug =
    typeof req.body?.handoffExpertSlug === 'string'
      ? req.body.handoffExpertSlug.trim().slice(0, 80)
      : null;
  const handoffMessageId =
    typeof req.body?.handoffMessageId === 'string'
      ? req.body.handoffMessageId.trim().slice(0, 120)
      : null;
  const handoffConversationId =
    typeof req.body?.handoffConversationId === 'string'
      ? req.body.handoffConversationId.trim().slice(0, 120)
      : null;
  const handoffAstrologyMode =
    req.body?.handoffAstrologyMode === 'vedic' || req.body?.handoffAstrologyMode === 'western'
      ? (req.body.handoffAstrologyMode as 'vedic' | 'western')
      : null;
  const rememberReadingNote = req.body?.rememberReadingNote !== false;
  const requestedProfileId =
    typeof req.body?.profileId === 'string' && req.body.profileId.trim()
      ? req.body.profileId.trim()
      : null;
  const requestedThreadKind: ConversationThreadKind = isValidThreadKind(req.body?.threadKind)
    ? req.body.threadKind
    : 'chat';
  const rawClientLocalHour =
    typeof req.body?.clientLocalHour === 'number' && Number.isFinite(req.body.clientLocalHour)
      ? Math.trunc(req.body.clientLocalHour)
      : null;

  let verifiedCompanionProfileId: string | null = null;
  if (requestedProfileId) {
    const { data: ownedProf } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', requestedProfileId)
      .eq('user_id', req.appUser.id)
      .maybeSingle();
    if (!ownedProf) {
      res.status(404).json({ error: 'Selected birth profile not found' });
      return;
    }
    verifiedCompanionProfileId = requestedProfileId;
  }

  if (handoffFullContext && rememberReadingNote) {
    await saveSharedReadingNote(supabaseAdmin, req.appUser.id, {
      profile_id: verifiedCompanionProfileId,
      expert_slug: handoffExpertSlug,
      expert_label: handoffExpertLabel || handoffFromName || 'Council Reading',
      astrology_mode: handoffAstrologyMode,
      conversation_id: handoffConversationId,
      message_id: handoffMessageId,
      title: handoffTitle || 'Shared Council Reading Note',
      summary: handoffFullContext,
    });
  }

  // ── FLOW A: Preset Admin-Governed Companion ────────────────────────────────
  if (rawCompanionSlug && !rawCompanionSlug.startsWith('custom_')) {
    const preset = await getCompanionBySlug(rawCompanionSlug);
    if (!preset) {
      res.status(404).json({ error: 'Companion not found or currently unavailable' });
      return;
    }

    const warmHandoffText = buildWarmHandoffGreeting(
      preset.name,
      preset.chat_style,
      handoffFromName,
      handoffNote
    );

    // Resume most recent conversation with this companion unless forceNew is requested
    if (!forceNew) {
      let existingConv: Record<string, unknown> | null = null;
      const resumePrimary = await supabaseAdmin
        .from('conversations')
        .select(CONVERSATION_LIST_COLUMNS_V7)
        .eq('user_id', req.appUser.id)
        .eq('pillar', 'companion')
        .eq('companion_slug', preset.slug)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!resumePrimary.error && resumePrimary.data) {
        existingConv = resumePrimary.data as unknown as Record<string, unknown>;
      } else {
        const resumeFallback = await supabaseAdmin
          .from('conversations')
          .select(CONVERSATION_LIST_COLUMNS_V6)
          .eq('user_id', req.appUser.id)
          .eq('pillar', 'companion')
          .order('updated_at', { ascending: false })
          .limit(30);
        if (!resumeFallback.error && resumeFallback.data) {
          const found = (resumeFallback.data as unknown as Array<Record<string, unknown>>).find(
            (r) => {
              const p = r.companion_persona_json as Record<string, unknown> | null;
              return normalizeCompanionSlug(typeof p?.slug === 'string' ? p.slug : '') === preset.slug;
            }
          );
          if (found) existingConv = found;
        }
      }

      if (existingConv) {
        if (
          verifiedCompanionProfileId &&
          existingConv.profile_id !== verifiedCompanionProfileId
        ) {
          await supabaseAdmin
            .from('conversations')
            .update({ profile_id: verifiedCompanionProfileId })
            .eq('id', String(existingConv.id))
            .eq('user_id', req.appUser.id)
            .then(() => undefined, () => undefined);
          existingConv.profile_id = verifiedCompanionProfileId;
        }
        if (
          explicitRequestedChatMode &&
          existingConv.companion_chat_mode !== explicitRequestedChatMode
        ) {
          const modeUpdateRes = await supabaseAdmin
            .from('conversations')
            .update({ companion_chat_mode: explicitRequestedChatMode })
            .eq('id', String(existingConv.id))
            .eq('user_id', req.appUser.id);
          if (
            modeUpdateRes.error &&
            isChatModeConstraintError(modeUpdateRes.error) &&
            explicitRequestedChatMode === 'natural'
          ) {
            await supabaseAdmin
              .from('conversations')
              .update({ companion_chat_mode: null })
              .eq('id', String(existingConv.id))
              .eq('user_id', req.appUser.id)
              .then(() => undefined, () => undefined);
          }
          existingConv.companion_chat_mode = explicitRequestedChatMode;
        }

        let handoffMsgRecord: Record<string, unknown> | null = null;
        if (warmHandoffText) {
          const handoffRow = {
            conversation_id: String(existingConv.id),
            role: 'assistant',
            content: warmHandoffText,
            word_count: countWords(warmHandoffText),
            expert_used: `companion:${preset.slug}`,
            mode_used: preset.category_tag,
            output_format_used: preset.chat_style,
            language_used: req.appUser.default_language || 'English',
            followups_json: [],
            tokens_in: 0,
            tokens_out: 0,
            credits_charged: 0,
          };
          const hPrimary = await supabaseAdmin
            .from('messages')
            .insert({ ...handoffRow, render_style: preset.chat_style })
            .select(MESSAGE_SELECT_COLUMNS_V2)
            .single();
          if (!hPrimary.error && hPrimary.data) {
            handoffMsgRecord = normalizeMessageDefaults(
              hPrimary.data as unknown as Record<string, unknown>
            );
          } else {
            const hFallback = await supabaseAdmin
              .from('messages')
              .insert(handoffRow)
              .select(MESSAGE_SELECT_COLUMNS_BASE)
              .single();
            if (hFallback.data) {
              handoffMsgRecord = normalizeMessageDefaults({
                ...(hFallback.data as unknown as Record<string, unknown>),
                render_style: preset.chat_style,
              });
            }
          }
          await supabaseAdmin
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', String(existingConv.id))
            .eq('user_id', req.appUser.id)
            .then(() => undefined, () => undefined);
        }

        res.status(200).json({
          conversation: normalizeConversationDefaults(existingConv),
          companionCard: toPublicCompanionCard(preset),
          ...(handoffMsgRecord ? { openingMessage: handoffMsgRecord, handoffAppended: true } : {}),
          resumed: true,
          persistedPillar: true,
        });
        return;
      }
    }

    // Pick a contextual returning greeting if returning via forceNew, else rotate unused welcome lines
    const welcomePool =
      preset.welcome_messages.length > 0
        ? preset.welcome_messages
        : [`Hey — I am ${preset.name}. Good to have you here.`];
    let selectedWelcome = warmHandoffText || welcomePool[0];
    let usedContextualReturn = false;

    if (!warmHandoffText && forceNew) {
      const bond = await getCompanionBond(req.appUser.id, preset.slug).catch(() => null);
      if (bond && ((bond.relationship_state?.total_turns || 0) > 0 || bond.last_interaction_at)) {
        const contextual = await generateContextualCompanionReturnGreeting({
          name: preset.name,
          roleLabel: preset.primary_expertise,
          culturalFluency: preset.cultural_fluency,
          tagline: preset.tagline,
          systemPromptSnippet: preset.system_prompt,
          soulSnippet: preset.soul_consciousness,
          chatStyle: preset.chat_style,
          languageSlug: req.appUser.default_language || 'English',
          preferredCallName: req.appUser.preferred_call_name,
          bond,
          clientLocalHour: rawClientLocalHour,
          modelId: preset.model_id,
        });
        if (contextual) {
          selectedWelcome = contextual;
          usedContextualReturn = true;
        }
      }
    }

    if (!warmHandoffText && !usedContextualReturn && welcomePool.length > 1) {
      const recentThreadRes = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('user_id', req.appUser.id)
        .eq('pillar', 'companion')
        .eq('companion_slug', preset.slug)
        .order('created_at', { ascending: false })
        .limit(3);
      const recentIds = ((recentThreadRes.data || []) as Array<{ id: string }>).map((r) => r.id);
      let usedTexts = new Set<string>();
      if (recentIds.length > 0) {
        const { data: pastOpeners } = await supabaseAdmin
          .from('messages')
          .select('content')
          .in('conversation_id', recentIds)
          .eq('role', 'assistant')
          .order('created_at', { ascending: true })
          .limit(6);
        usedTexts = new Set(
          ((pastOpeners || []) as Array<{ content?: string }>).map((m) =>
            String(m.content || '').trim()
          )
        );
      }
      const unused = welcomePool.filter((w) => !usedTexts.has(w.trim()));
      const candidates = unused.length > 0 ? unused : welcomePool;
      selectedWelcome = candidates[crypto.randomInt(0, candidates.length)];
    }

    const publicSnapshot = buildPublicCompanionPersonaSnapshot(preset);
    const basePayload = {
      user_id: req.appUser.id,
      profile_id: verifiedCompanionProfileId,
      mode_type: 'reading' as const,
      title: preset.name.slice(0, 80),
      use_full_profile_memory: true,
    };

    let createdConv: Record<string, unknown> | null = null;
    let persistedPillar = true;

    let v7Insert = await supabaseAdmin
      .from('conversations')
      .insert({
        ...basePayload,
        pillar: 'companion',
        is_active_tab: pinAsTab,
        companion_type: 'friend',
        companion_slug: preset.slug,
        companion_chat_mode: requestedChatMode,
        companion_persona_json: publicSnapshot,
        thread_kind: requestedThreadKind,
      })
      .select(CONVERSATION_LIST_COLUMNS_V8)
      .single();

    if (
      v7Insert.error &&
      String(v7Insert.error.message || '').toLowerCase().includes('thread_kind')
    ) {
      v7Insert = await supabaseAdmin
        .from('conversations')
        .insert({
          ...basePayload,
          pillar: 'companion',
          is_active_tab: pinAsTab,
          companion_type: 'friend',
          companion_slug: preset.slug,
          companion_chat_mode: requestedChatMode,
          companion_persona_json: publicSnapshot,
        })
        .select(CONVERSATION_LIST_COLUMNS_V7)
        .single();
    }

    if (
      v7Insert.error &&
      isChatModeConstraintError(v7Insert.error) &&
      requestedChatMode === 'natural'
    ) {
      v7Insert = await supabaseAdmin
        .from('conversations')
        .insert({
          ...basePayload,
          pillar: 'companion',
          is_active_tab: pinAsTab,
          companion_type: 'friend',
          companion_slug: preset.slug,
          companion_chat_mode: null,
          companion_persona_json: publicSnapshot,
        })
        .select(CONVERSATION_LIST_COLUMNS_V7)
        .single();
    }

    if (!v7Insert.error && v7Insert.data) {
      createdConv = normalizeConversationDefaults({
        ...(v7Insert.data as unknown as Record<string, unknown>),
        companion_chat_mode:
          (v7Insert.data as unknown as Record<string, unknown>).companion_chat_mode ||
          requestedChatMode,
        thread_kind:
          (v7Insert.data as unknown as Record<string, unknown>).thread_kind ||
          requestedThreadKind,
      });
    } else {
      const v6Insert = await supabaseAdmin
        .from('conversations')
        .insert({
          ...basePayload,
          pillar: 'companion',
          is_active_tab: pinAsTab,
          companion_type: 'friend',
          companion_persona_json: publicSnapshot,
        })
        .select(CONVERSATION_LIST_COLUMNS_V6)
        .single();

      if (!v6Insert.error && v6Insert.data) {
        persistedPillar = false;
        createdConv = normalizeConversationDefaults({
          ...(v6Insert.data as unknown as Record<string, unknown>),
          companion_slug: preset.slug,
          companion_chat_mode: requestedChatMode,
        });
      } else {
        persistedPillar = false;
        const baseInsert = await supabaseAdmin
          .from('conversations')
          .insert(basePayload)
          .select(CONVERSATION_LIST_COLUMNS_BASE)
          .single();
        if (baseInsert.error || !baseInsert.data) {
          res.status(500).json({ error: 'Could not start companion conversation' });
          return;
        }
        createdConv = normalizeConversationDefaults({
          ...(baseInsert.data as unknown as Record<string, unknown>),
          pillar: 'companion',
          is_active_tab: pinAsTab,
          companion_type: 'friend',
          companion_slug: preset.slug,
          companion_chat_mode: requestedChatMode,
          companion_persona_json: publicSnapshot,
        });
      }
    }

    let openingMsgRecord: Record<string, unknown> | null = null;
    const baseOpeningRow = {
      conversation_id: String(createdConv.id),
      role: 'assistant',
      content: selectedWelcome,
      word_count: countWords(selectedWelcome),
      expert_used: `companion:${preset.slug}`,
      mode_used: preset.category_tag,
      output_format_used: preset.chat_style,
      language_used: req.appUser.default_language || 'English',
      followups_json: [],
      tokens_in: 0,
      tokens_out: 0,
      credits_charged: 0,
    };

    const msgPrimary = await supabaseAdmin
      .from('messages')
      .insert({
        ...baseOpeningRow,
        render_style: preset.chat_style,
      })
      .select(MESSAGE_SELECT_COLUMNS_V2)
      .single();

    if (!msgPrimary.error && msgPrimary.data) {
      openingMsgRecord = normalizeMessageDefaults(
        msgPrimary.data as unknown as Record<string, unknown>
      );
    } else {
      const msgFallback = await supabaseAdmin
        .from('messages')
        .insert(baseOpeningRow)
        .select(MESSAGE_SELECT_COLUMNS_BASE)
        .single();
      if (msgFallback.data) {
        openingMsgRecord = normalizeMessageDefaults({
          ...(msgFallback.data as unknown as Record<string, unknown>),
          render_style: preset.chat_style,
        });
      }
    }

    res.status(201).json({
      conversation: createdConv,
      openingMessage: openingMsgRecord,
      companionCard: toPublicCompanionCard(preset),
      resumed: false,
      persistedPillar,
    });
    return;
  }

  // ── FLOW B: Custom "Find someone new" Matched Persona OR Resuming custom_* ─
  let customSlug = rawCompanionSlug.startsWith('custom_')
    ? normalizeCompanionSlug(rawCompanionSlug)
    : '';
  let rawPersona = req.body?.persona as CompanionPersona | undefined;

  if (customSlug && (!rawPersona || !rawPersona.name)) {
    const savedCustom = await supabaseAdmin
      .from('user_custom_companions')
      .select('slug, persona_json, last_conversation_id')
      .eq('user_id', req.appUser.id)
      .eq('slug', customSlug)
      .maybeSingle();
    if (!savedCustom.error && savedCustom.data?.persona_json) {
      rawPersona = savedCustom.data.persona_json as CompanionPersona;
      if (!forceNew && savedCustom.data.last_conversation_id) {
        const existingCustomConv = await supabaseAdmin
          .from('conversations')
          .select(CONVERSATION_LIST_COLUMNS_V7)
          .eq('id', String(savedCustom.data.last_conversation_id))
          .eq('user_id', req.appUser.id)
          .maybeSingle();
        if (!existingCustomConv.error && existingCustomConv.data) {
          res.status(200).json({
            conversation: normalizeConversationDefaults(
              existingCustomConv.data as unknown as Record<string, unknown>
            ),
            resumed: true,
            persistedPillar: true,
          });
          return;
        }
      }
    }
  }

  if (!rawPersona || typeof rawPersona !== 'object' || !rawPersona.name) {
    res.status(400).json({ error: 'Selected companion persona or slug is required' });
    return;
  }

  const safeType: CompanionArchetypeSlug = isValidCompanionType(rawPersona.companion_type)
    ? rawPersona.companion_type
    : 'find_someone';

  if (!customSlug) {
    const rawSlugBase = String(rawPersona.name || 'companion')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 20);
    customSlug =
      typeof rawPersona.slug === 'string' && rawPersona.slug.startsWith('custom_')
        ? normalizeCompanionSlug(rawPersona.slug)
        : `custom_${rawSlugBase || 'friend'}_${crypto.randomBytes(2).toString('hex')}`;
  }

  const cleanPersona: CompanionPersona = {
    id:
      typeof rawPersona.id === 'string' && rawPersona.id
        ? rawPersona.id
        : `comp_${crypto.randomBytes(4).toString('hex')}`,
    slug: customSlug,
    name: String(rawPersona.name).trim().slice(0, 50),
    age: Number.isFinite(Number(rawPersona.age)) ? Math.round(Number(rawPersona.age)) : 32,
    gender: rawPersona.gender === 'M' ? 'M' : rawPersona.gender === 'NB' ? 'NB' : 'F',
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
    backstory:
      typeof rawPersona.backstory === 'string' && rawPersona.backstory.trim()
        ? rawPersona.backstory.trim().slice(0, 1200)
        : undefined,
    soul_consciousness:
      typeof rawPersona.soul_consciousness === 'string' && rawPersona.soul_consciousness.trim()
        ? rawPersona.soul_consciousness.trim().slice(0, 1200)
        : undefined,
    chat_style: 'chat_bubbles',
    skill_level: 'none_emotional',
    supports_listening_cue: true,
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
    profile_id: verifiedCompanionProfileId,
    mode_type: 'reading' as const,
    title: threadTitle.slice(0, 80),
    use_full_profile_memory: true,
  };

  let createdConv: Record<string, unknown> | null = null;
  let persistedPillar = true;

  let primaryInsert = await supabaseAdmin
    .from('conversations')
    .insert({
      ...basePayload,
      pillar: 'companion',
      is_active_tab: pinAsTab,
      companion_type: safeType,
      companion_slug: customSlug,
      companion_chat_mode: requestedChatMode,
      companion_persona_json: cleanPersona,
      thread_kind: requestedThreadKind,
    })
    .select(CONVERSATION_LIST_COLUMNS_V8)
    .single();

  if (
    primaryInsert.error &&
    String(primaryInsert.error.message || '').toLowerCase().includes('thread_kind')
  ) {
    primaryInsert = await supabaseAdmin
      .from('conversations')
      .insert({
        ...basePayload,
        pillar: 'companion',
        is_active_tab: pinAsTab,
        companion_type: safeType,
        companion_slug: customSlug,
        companion_chat_mode: requestedChatMode,
        companion_persona_json: cleanPersona,
      })
      .select(CONVERSATION_LIST_COLUMNS_V7)
      .single();
  }

  if (
    primaryInsert.error &&
    isChatModeConstraintError(primaryInsert.error) &&
    requestedChatMode === 'natural'
  ) {
    primaryInsert = await supabaseAdmin
      .from('conversations')
      .insert({
        ...basePayload,
        pillar: 'companion',
        is_active_tab: pinAsTab,
        companion_type: safeType,
        companion_slug: customSlug,
        companion_chat_mode: null,
        companion_persona_json: cleanPersona,
      })
      .select(CONVERSATION_LIST_COLUMNS_V7)
      .single();
  }

  if (!primaryInsert.error && primaryInsert.data) {
    createdConv = normalizeConversationDefaults({
      ...(primaryInsert.data as unknown as Record<string, unknown>),
      companion_chat_mode:
        (primaryInsert.data as unknown as Record<string, unknown>).companion_chat_mode ||
        requestedChatMode,
      thread_kind:
        (primaryInsert.data as unknown as Record<string, unknown>).thread_kind ||
        requestedThreadKind,
    });
  } else {
    const v6Insert = await supabaseAdmin
      .from('conversations')
      .insert({
        ...basePayload,
        pillar: 'companion',
        is_active_tab: pinAsTab,
        companion_type: safeType,
        companion_persona_json: cleanPersona,
      })
      .select(CONVERSATION_LIST_COLUMNS_V6)
      .single();

    if (!v6Insert.error && v6Insert.data) {
      persistedPillar = false;
      createdConv = normalizeConversationDefaults({
        ...(v6Insert.data as unknown as Record<string, unknown>),
        companion_slug: customSlug,
        companion_chat_mode: requestedChatMode,
      });
    } else {
      persistedPillar = false;
      const fallbackInsert = await supabaseAdmin
        .from('conversations')
        .insert(basePayload)
        .select(CONVERSATION_LIST_COLUMNS_BASE)
        .single();
      if (fallbackInsert.error || !fallbackInsert.data) {
        res.status(500).json({ error: 'Could not start companion conversation' });
        return;
      }
      createdConv = normalizeConversationDefaults({
        ...(fallbackInsert.data as unknown as Record<string, unknown>),
        pillar: 'companion',
        is_active_tab: pinAsTab,
        companion_type: safeType,
        companion_slug: customSlug,
        companion_chat_mode: requestedChatMode,
        companion_persona_json: cleanPersona,
      });
    }
  }

  // Persist custom companion so user can always return to them later
  await supabaseAdmin
    .from('user_custom_companions')
    .upsert(
      {
        user_id: req.appUser.id,
        slug: customSlug,
        persona_json: cleanPersona,
        last_conversation_id: String(createdConv.id),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,slug' }
    )
    .then(() => undefined, () => undefined);

  let customOpeningText = cleanPersona.opening_message;
  if (forceNew && customSlug) {
    const customBond = await getCompanionBond(req.appUser.id, customSlug).catch(() => null);
    if (
      customBond &&
      ((customBond.relationship_state?.total_turns || 0) > 0 || customBond.last_interaction_at)
    ) {
      const contextual = await generateContextualCompanionReturnGreeting({
        name: cleanPersona.name,
        roleLabel: cleanPersona.role_label,
        culturalFluency: cleanPersona.background,
        tagline: cleanPersona.tagline,
        systemPromptSnippet: cleanPersona.system_prompt || cleanPersona.bio,
        soulSnippet: cleanPersona.soul_consciousness,
        chatStyle: cleanPersona.chat_style || 'chat_bubbles',
        languageSlug: req.appUser.default_language || 'English',
        preferredCallName: req.appUser.preferred_call_name,
        bond: customBond,
        clientLocalHour: rawClientLocalHour,
      });
      if (contextual) {
        customOpeningText = contextual;
      }
    }
  }

  let openingMsgRecord: Record<string, unknown> | null = null;
  const baseOpeningRow = {
    conversation_id: String(createdConv.id),
    role: 'assistant',
    content: customOpeningText,
    word_count: countWords(customOpeningText),
    expert_used: `companion:${customSlug}`,
    mode_used: safeType,
    output_format_used: cleanPersona.chat_style || 'chat_bubbles',
    language_used: req.appUser.default_language || 'English',
    followups_json: [],
    tokens_in: 0,
    tokens_out: 0,
    credits_charged: 0,
  };

  const msgPrimary = await supabaseAdmin
    .from('messages')
    .insert({
      ...baseOpeningRow,
      render_style: 'chat_bubbles' as ChatStyle,
    })
    .select(MESSAGE_SELECT_COLUMNS_V2)
    .single();

  if (!msgPrimary.error && msgPrimary.data) {
    openingMsgRecord = normalizeMessageDefaults(
      msgPrimary.data as unknown as Record<string, unknown>
    );
  } else {
    const msgFallback = await supabaseAdmin
      .from('messages')
      .insert(baseOpeningRow)
      .select(MESSAGE_SELECT_COLUMNS_BASE)
      .single();
    if (msgFallback.data) {
      openingMsgRecord = normalizeMessageDefaults({
        ...(msgFallback.data as unknown as Record<string, unknown>),
        render_style: 'chat_bubbles',
      });
    }
  }

  res.status(201).json({
    conversation: createdConv,
    openingMessage: openingMsgRecord,
    resumed: false,
    persistedPillar,
  });
});

// 4d. Remove a saved custom companion from the user's matched list (leaves threads intact)
router.delete('/companions/custom/:slug', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const rawSlug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const cleanSlug = normalizeCompanionSlug(typeof rawSlug === 'string' ? rawSlug : '');
  if (!cleanSlug || !cleanSlug.startsWith('custom_')) {
    res.status(400).json({ error: 'Valid custom companion slug is required' });
    return;
  }

  const { error } = await supabaseAdmin
    .from('user_custom_companions')
    .delete()
    .eq('user_id', req.appUser.id)
    .eq('slug', cleanSlug);

  if (error) {
    res.status(500).json({ error: 'Could not remove matched companion' });
    return;
  }

  res.json({ deleted: true, slug: cleanSlug });
});

// 5. Delete conversation
router.delete('/conversations/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const convId = String(req.params.id || '').trim();
  if (!convId) {
    res.status(400).json({ error: 'Consultation ID is required' });
    return;
  }

  const { data: existingConv, error: lookupError } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('id', convId)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  if (lookupError) {
    res.status(500).json({ error: 'Failed to verify consultation ownership' });
    return;
  }

  if (!existingConv) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }

  // Clear self-referencing parent_message_id links before deleting child messages to avoid FK trigger edge cases
  await supabaseAdmin
    .from('messages')
    .update({ parent_message_id: null })
    .eq('conversation_id', convId);

  await supabaseAdmin.from('messages').delete().eq('conversation_id', convId);
  await supabaseAdmin.from('chatbot_pipeline_logs').delete().eq('conversation_id', convId);

  const { data: deletedRows, error } = await supabaseAdmin
    .from('conversations')
    .delete()
    .eq('id', convId)
    .eq('user_id', req.appUser.id)
    .select('id');

  if (error || !deletedRows || deletedRows.length === 0) {
    res.status(500).json({ error: 'Failed to delete consultation' });
    return;
  }

  res.json({ deleted: true, id: convId });
});

// 6. Get paginated messages for a conversation (supports ?limit=40&before=<ISO>)
router.get('/conversations/:id/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  let conversation: Record<string, unknown> | null = null;
  const convV7 = await supabaseAdmin
    .from('conversations')
    .select(CONVERSATION_LIST_COLUMNS_V7)
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  if (!convV7.error && convV7.data) {
    conversation = normalizeConversationDefaults(
      convV7.data as unknown as Record<string, unknown>
    );
  } else {
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
  const msgV2 = await buildMsgQuery(MESSAGE_SELECT_COLUMNS_V2);
  if (!msgV2.error && msgV2.data) {
    rawRows = (msgV2.data as unknown as Array<Record<string, unknown>>).map(
      normalizeMessageDefaults
    );
  } else {
    const msgPrimary = await buildMsgQuery(MESSAGE_SELECT_COLUMNS);
    if (msgPrimary.error) {
      const msgFallback = await buildMsgQuery(MESSAGE_SELECT_COLUMNS_BASE);
      if (msgFallback.error) {
        res.status(500).json({ error: 'Failed to load messages' });
        return;
      }
      rawRows = (msgFallback.data as unknown as Array<Record<string, unknown>>).map(
        normalizeMessageDefaults
      );
    } else {
      rawRows = (msgPrimary.data as unknown as Array<Record<string, unknown>>).map(
        normalizeMessageDefaults
      );
    }
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
    companionSlug: requestedCompanionSlug,
    companionChatMode: requestedCompanionChatMode,
    clientLocalHour: rawClientLocalHour,
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
    curatedStarter,
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

  let conversation: {
    id: string;
    user_id: string;
    profile_id: string | null;
    title: string;
    mode_type: 'reading' | 'learn_astrology' | 'report_followup';
    pillar?: ChatPillar;
    use_full_profile_memory: boolean;
    total_word_count: number;
    companion_type?: CompanionArchetypeSlug | null;
    companion_slug?: string | null;
    companion_chat_mode?: CompanionChatCue | null;
    companion_persona_json?: CompanionPersona | null;
    thread_memory_summary?: string | null;
    thread_memory_msg_count?: number | null;
  } | null = null;

  const convLoadV8 = await supabaseAdmin
    .from('conversations')
    .select(CONVERSATION_TURN_COLUMNS_V8)
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  if (!convLoadV8.error && convLoadV8.data) {
    conversation = normalizeConversationDefaults(
      convLoadV8.data as unknown as Record<string, unknown>
    ) as unknown as typeof conversation;
  } else {
    const convLoadV7 = await supabaseAdmin
      .from('conversations')
      .select(CONVERSATION_LIST_COLUMNS_V7)
      .eq('id', req.params.id)
      .eq('user_id', req.appUser.id)
      .maybeSingle();

    if (!convLoadV7.error && convLoadV7.data) {
      conversation = normalizeConversationDefaults(
        convLoadV7.data as unknown as Record<string, unknown>
      ) as unknown as typeof conversation;
    } else {
      const convLoadV6 = await supabaseAdmin
        .from('conversations')
        .select(CONVERSATION_LIST_COLUMNS_V6)
        .eq('id', req.params.id)
        .eq('user_id', req.appUser.id)
        .maybeSingle();
      if (!convLoadV6.error && convLoadV6.data) {
        conversation = normalizeConversationDefaults(
          convLoadV6.data as unknown as Record<string, unknown>
        ) as unknown as typeof conversation;
      } else {
        const convLoadBase = await supabaseAdmin
          .from('conversations')
          .select(CONVERSATION_LIST_COLUMNS_BASE)
          .eq('id', req.params.id)
          .eq('user_id', req.appUser.id)
          .maybeSingle();
        if (convLoadBase.data) {
          conversation = normalizeConversationDefaults(
            convLoadBase.data as unknown as Record<string, unknown>
          ) as unknown as typeof conversation;
        }
      }
    }
  }

  if (!conversation) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }

  const convRecord = conversation as unknown as Record<string, unknown>;
  const activePillar: ChatPillar = isValidPillar(convRecord.pillar)
    ? (convRecord.pillar as ChatPillar)
    : isValidPillar(requestedPillar)
    ? requestedPillar
    : 'council';

  let activeCompanionPersona: CompanionPersona | null =
    (convRecord.companion_persona_json as CompanionPersona | null | undefined) ||
    (requestedCompanionPersona && typeof requestedCompanionPersona === 'object'
      ? (requestedCompanionPersona as CompanionPersona)
      : null);

  const effectiveCompanionSlug =
    activePillar === 'companion'
      ? normalizeCompanionSlug(
          (typeof convRecord.companion_slug === 'string' && convRecord.companion_slug) ||
            activeCompanionPersona?.slug ||
            (typeof requestedCompanionSlug === 'string' ? requestedCompanionSlug : '')
        )
      : '';

  const presetCompanion: CompanionPresetRecord | null =
    activePillar === 'companion' && effectiveCompanionSlug && !effectiveCompanionSlug.startsWith('custom_')
      ? await getCompanionBySlug(effectiveCompanionSlug)
      : null;

  if (
    activePillar === 'companion' &&
    !presetCompanion &&
    effectiveCompanionSlug.startsWith('custom_') &&
    (!activeCompanionPersona || !activeCompanionPersona.system_prompt)
  ) {
    const customRow = await supabaseAdmin
      .from('user_custom_companions')
      .select('persona_json')
      .eq('user_id', req.appUser.id)
      .eq('slug', effectiveCompanionSlug)
      .maybeSingle();
    if (!customRow.error && customRow.data?.persona_json) {
      activeCompanionPersona = customRow.data.persona_json as CompanionPersona;
    }
  }

  const effectiveCompanionChatMode: CompanionChatCue | null =
    activePillar === 'companion'
      ? requestedCompanionChatMode !== undefined
        ? isValidCompanionChatCue(requestedCompanionChatMode)
          ? requestedCompanionChatMode
          : 'natural'
        : isValidCompanionChatCue(convRecord.companion_chat_mode)
        ? convRecord.companion_chat_mode
        : 'natural'
      : null;

  if (
    activePillar === 'companion' &&
    requestedCompanionChatMode !== undefined &&
    isValidCompanionChatCue(requestedCompanionChatMode) &&
    effectiveCompanionChatMode !== (convRecord.companion_chat_mode ?? null)
  ) {
    const msgModeUpdate = await supabaseAdmin
      .from('conversations')
      .update({ companion_chat_mode: effectiveCompanionChatMode })
      .eq('id', conversation.id)
      .eq('user_id', req.appUser.id);
    if (
      msgModeUpdate.error &&
      isChatModeConstraintError(msgModeUpdate.error) &&
      effectiveCompanionChatMode === 'natural'
    ) {
      await supabaseAdmin
        .from('conversations')
        .update({ companion_chat_mode: null })
        .eq('id', conversation.id)
        .eq('user_id', req.appUser.id)
        .then(() => undefined, () => undefined);
    }
  }

  const clientLocalHour =
    Number.isFinite(Number(rawClientLocalHour)) &&
    Number(rawClientLocalHour) >= 0 &&
    Number(rawClientLocalHour) <= 23
      ? Math.trunc(Number(rawClientLocalHour))
      : null;

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
      expert !== 'tarot_reader' &&
      expert !== 'numerologist' &&
      expert !== 'learn_astrology';
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
      ? req.appUser.default_expert === 'modern_astrologer' ||
        req.appUser.default_expert === 'hellenistic_astrologer'
        ? req.appUser.default_expert
        : 'western_astrologer'
      : normalizeCouncilSlug(req.appUser.default_expert);

  const expertSlug =
    activePillar === 'companion'
      ? `companion:${
          presetCompanion?.slug ||
          effectiveCompanionSlug ||
          activeCompanionPersona?.companion_type ||
          'friend'
        }`
      : activePillar === 'clarity'
      ? 'clarity_helper'
      : typeof expert === 'string' && expert
      ? normalizeCouncilSlug(expert)
      : fallbackCouncilExpert;
  const isLearnAstrologyTurn =
    activePillar === 'council' &&
    (expertSlug === 'learn_astrology' || conversation.mode_type === 'learn_astrology');
  const modeSlug =
    activePillar === 'companion'
      ? presetCompanion?.category_tag || activeCompanionPersona?.companion_type || 'companion'
      : activePillar === 'clarity'
      ? 'clarity'
      : isLearnAstrologyTurn
      ? 'learn_astrology'
      : 'general';
  const normalizedToneMode = toneMode === 'friendly' ? 'friendly' : 'technical';
  const normalizedResponseLength = responseLength === 'short' ? 'short' : 'detailed';
  const outputSlug =
    activePillar === 'council'
      ? normalizedResponseLength === 'short'
        ? 'short'
        : 'detailed'
      : presetCompanion?.chat_style || activeCompanionPersona?.chat_style || 'conversational';
  const languageSlug =
    typeof language === 'string' && language
      ? language
      : req.appUser.default_language || 'English';

  const isWesternCouncilTurn =
    activePillar === 'council' &&
    (expertSlug === 'western_astrologer' ||
      expertSlug === 'modern_astrologer' ||
      expertSlug === 'hellenistic_astrologer');
  const isVedicCouncilTurn =
    activePillar === 'council' &&
    !isWesternCouncilTurn &&
    expertSlug !== 'tarot_reader' &&
    expertSlug !== 'numerologist';
  const isAstrologyCouncilTurn = isVedicCouncilTurn || isWesternCouncilTurn;
  const isAstrologyReadingTurn =
    isAstrologyCouncilTurn &&
    !isLearnAstrologyTurn &&
    conversation.mode_type !== 'report_followup';
  const useDeepAudit =
    Boolean(deepAudit) &&
    isAstrologyReadingTurn &&
    Boolean(conversation.profile_id) &&
    validAttachments.length === 0;

  // Fetch heavy chart_json & dossier ONLY inside single-turn message POST for Astrology Reading Stage 2/3 turns
  const needsChartJson =
    activePillar === 'council' && isAstrologyReadingTurn;

  let profileData: {
    id: string;
    name: string;
    short_name?: string | null;
    is_default?: boolean;
    gender?: string | null;
    is_activated: boolean;
    has_birth_chart?: boolean;
    chart_text_context: string | null;
    chart_json?: CompiledChartData | null;
    natal_truth_dossier_json?: NatalTruthDossierV1 | null;
    profile_memory_summary: string | null;
    life_context_json?: LifeContextData | null;
    life_context_completeness?: number | null;
    deep_profile_json?: DeepProfileData | null;
    analyst_notes_json?: CouncilAnalystNote[] | null;
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

  if (activePillar === 'council' && conversation.profile_id) {
    const baseCols =
      'id, name, is_activated, chart_text_context, profile_memory_summary, birth_date, birth_time, birth_city, birth_state, birth_country, gender, relationship, latitude, longitude, timezone_offset';
    const pre018Cols = `${baseCols}, short_name, current_city, current_state, current_country, life_context_json, life_context_completeness${
      needsChartJson ? ', chart_json' : ''
    }${isAstrologyReadingTurn ? ', natal_truth_dossier_json' : ''}`;
    const fullCols = `${pre018Cols}, deep_profile_json`;
    const fallbackCols = `${baseCols}${needsChartJson ? ', chart_json' : ''}`;

    const profPrimary = await supabaseAdmin
      .from('profiles')
      .select(fullCols)
      .eq('id', conversation.profile_id)
      .eq('user_id', req.appUser.id)
      .maybeSingle();

    let prof = profPrimary.data as unknown as typeof profileData;
    if (profPrimary.error) {
      const profPre018 = await supabaseAdmin
        .from('profiles')
        .select(pre018Cols)
        .eq('id', conversation.profile_id)
        .eq('user_id', req.appUser.id)
        .maybeSingle();
      if (!profPre018.error && profPre018.data) {
        prof = profPre018.data as unknown as typeof profileData;
      } else {
        const profFallback = await supabaseAdmin
          .from('profiles')
          .select(fallbackCols)
          .eq('id', conversation.profile_id)
          .eq('user_id', req.appUser.id)
          .maybeSingle();
        prof = profFallback.data as unknown as typeof profileData;
      }
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

    if (
      prof &&
      isWesternCouncilTurn &&
      prof.chart_json &&
      !prof.natal_truth_dossier_json?.western_dossier
    ) {
      try {
        const enriched = enrichCompiledChart(prof.chart_json);
        const existingDossier =
          prof.natal_truth_dossier_json && typeof prof.natal_truth_dossier_json === 'object'
            ? prof.natal_truth_dossier_json
            : null;
        const layerA =
          existingDossier?.layer_a ||
          buildNatalTruthDossierLayerA(
            enriched.chartJson,
            (prof.life_context_json as LifeContextData) || undefined
          );
        const westernDossier = buildWesternTruthDossier(
          enriched.chartJson,
          (prof.life_context_json as LifeContextData) || undefined
        );
        const nextDossier: NatalTruthDossierV1 = {
          version: CURRENT_NATAL_DOSSIER_VERSION,
          generated_at: existingDossier?.generated_at || new Date().toISOString(),
          layer_a: layerA,
          layer_b: existingDossier?.layer_b ?? null,
          western_dossier: westernDossier,
        };
        prof.chart_json = enriched.chartJson;
        prof.natal_truth_dossier_json = nextDossier;

        const profileIdToPatch = prof.id;
        const userIdToPatch = req.appUser.id;
        const bgPatch: Record<string, unknown> = {
          natal_truth_dossier_json: nextDossier,
          natal_dossier_version: CURRENT_NATAL_DOSSIER_VERSION,
          updated_at: new Date().toISOString(),
        };
        if (enriched.wasEnriched) {
          bgPatch.chart_json = enriched.chartJson;
          bgPatch.chart_text_context = enriched.chartTextContext;
        }
        scheduleBackgroundTask(async () => {
          await supabaseAdmin
            .from('profiles')
            .update(bgPatch)
            .eq('id', profileIdToPatch)
            .eq('user_id', userIdToPatch);
        });
      } catch {
        // Proceed gracefully even if lazy dossier enrichment fails
      }
    }

    profileData = prof || null;
  } else if (activePillar === 'companion') {
    // Companions share conversational bond across ALL conversations with this same companion slug,
    // honor the per-thread focused chart (conversation.profile_id) when set or fall back to the
    // user's default ("You") profile, and strictly isolate Council memory from Companions.
    const engineOverridesForComp = await getEnginePromptOverrides();
    const effectiveCompanionRecord =
      presetCompanion ||
      (activeCompanionPersona ? mapCustomPersonaToV2PresetRecord(activeCompanionPersona) : null);
    const companionCaps = resolveCompanionCapabilities(
      effectiveCompanionRecord,
      engineOverridesForComp
    );
    const companionV2 = effectiveCompanionRecord
      ? ensureCompanionV2Initialized(effectiveCompanionRecord)
      : null;
    const companionHistorySlice = ((historyRows || []) as Array<{
      role: 'user' | 'assistant';
      content: string;
      excluded_from_context?: boolean;
    }>)
      .filter((r) => !r.excluded_from_context)
      .slice(-6)
      .map((r) => ({ role: r.role, content: String(r.content || '') }));

    const preTurnAnalysis = analyzeCompanionTurnContext({
      userPrompt: promptText,
      historyMessages: companionHistorySlice,
      companionChatMode: effectiveCompanionChatMode,
      chartAccess: companionCaps.chart_access,
      personalityV2: companionV2,
      advisoryMode: companionCaps.advisory_mode,
    });

    const needsCompanionChartJson =
      preTurnAnalysis.should_load_chart &&
      Boolean(
        companionCaps.chart_access.vedic ||
          companionCaps.chart_access.western ||
          companionCaps.chart_access.past_life
      );
    const needsCompanionNotes = preTurnAnalysis.should_load_notes;
    const compBaseCols = `id, name, is_activated, birth_date, birth_time, birth_city, birth_state, birth_country, gender, latitude, longitude, timezone_offset${
      needsCompanionChartJson ? ', chart_text_context, chart_json' : ''
    }`;
    const compProfileColsPre018 = `${compBaseCols}, short_name, is_default, current_city, current_state, current_country, life_context_json`;
    const compProfileCols = `${compProfileColsPre018}, deep_profile_json${
      needsCompanionNotes ? ', analyst_notes_json' : ''
    }`;

    let focusedCompanionProf: NonNullable<typeof profileData> | null = null;
    if (conversation.profile_id) {
      const threadRes = await supabaseAdmin
        .from('profiles')
        .select(compProfileCols)
        .eq('id', conversation.profile_id)
        .eq('user_id', req.appUser.id)
        .maybeSingle();
      if (!threadRes.error && threadRes.data) {
        focusedCompanionProf = threadRes.data as unknown as NonNullable<typeof profileData>;
      } else if (threadRes.error) {
        const threadPre018 = await supabaseAdmin
          .from('profiles')
          .select(compProfileColsPre018)
          .eq('id', conversation.profile_id)
          .eq('user_id', req.appUser.id)
          .maybeSingle();
        if (!threadPre018.error && threadPre018.data) {
          focusedCompanionProf = threadPre018.data as unknown as NonNullable<typeof profileData>;
        } else {
          const threadFallback = await supabaseAdmin
            .from('profiles')
            .select(compBaseCols)
            .eq('id', conversation.profile_id)
            .eq('user_id', req.appUser.id)
            .maybeSingle();
          if (threadFallback.data) {
            focusedCompanionProf = threadFallback.data as unknown as NonNullable<typeof profileData>;
          }
        }
      }
    }

    if (!focusedCompanionProf) {
      const ownRes = await supabaseAdmin
        .from('profiles')
        .select(compProfileCols)
        .eq('user_id', req.appUser.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!ownRes.error && ownRes.data) {
        focusedCompanionProf = ownRes.data as unknown as NonNullable<typeof profileData>;
      } else if (ownRes.error) {
        const ownPre018 = await supabaseAdmin
          .from('profiles')
          .select(compProfileColsPre018)
          .eq('user_id', req.appUser.id)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!ownPre018.error && ownPre018.data) {
          focusedCompanionProf = ownPre018.data as unknown as NonNullable<typeof profileData>;
        } else {
          const ownFallback = await supabaseAdmin
            .from('profiles')
            .select(compBaseCols)
            .eq('user_id', req.appUser.id)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (ownFallback.data) {
            focusedCompanionProf = ownFallback.data as unknown as NonNullable<typeof profileData>;
          }
        }
      }
    }

    if (
      focusedCompanionProf &&
      needsCompanionChartJson &&
      (!focusedCompanionProf.chart_text_context || !focusedCompanionProf.chart_json) &&
      isAstrologyApiConfigured()
    ) {
      try {
        const compiled = await compileBirthChart({
          name: focusedCompanionProf.name,
          birthDate: focusedCompanionProf.birth_date,
          birthTime: focusedCompanionProf.birth_time,
          birthCity: focusedCompanionProf.birth_city,
          birthState: focusedCompanionProf.birth_state || null,
          birthCountry: focusedCompanionProf.birth_country,
          latitude: focusedCompanionProf.latitude ?? null,
          longitude: focusedCompanionProf.longitude ?? null,
          timezoneOffset: focusedCompanionProf.timezone_offset ?? null,
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
          .eq('id', focusedCompanionProf.id)
          .eq('user_id', req.appUser.id);

        focusedCompanionProf.is_activated = true;
        focusedCompanionProf.chart_text_context = compiled.chartTextContext;
        focusedCompanionProf.chart_json = compiled.chartJson;
      } catch {
        // Proceed gracefully even if live ephemeris fetch fails transiently
      }
    }

    const userLivingState = await getUserLivingContextState(req.appUser.id).catch(() => null);
    const allowCrossCompanion = userLivingState
      ? userLivingState.preferences.allow_cross_companion_memory !== false
      : true;

    if (focusedCompanionProf) {
      const hasBirthChart = Boolean(
        focusedCompanionProf.birth_date &&
          (focusedCompanionProf.is_activated ||
            focusedCompanionProf.chart_text_context ||
            focusedCompanionProf.chart_json ||
            Boolean(focusedCompanionProf.birth_city) ||
            needsCompanionChartJson)
      );
      const isSelfContextProfile =
        !conversation.profile_id || focusedCompanionProf.is_default === true;
      const mergedContext = mergeUserAndProfileContextForPrompt({
        userLivingContext: isSelfContextProfile ? userLivingState?.livingContext : null,
        userDeepProfile: isSelfContextProfile ? userLivingState?.deepProfile : null,
        profileLifeContext: focusedCompanionProf.life_context_json,
        profileDeepProfile: focusedCompanionProf.deep_profile_json,
        allowCrossCompanionMemory: allowCrossCompanion,
        activeCompanionSlug: effectiveCompanionSlug,
      });

      profileData = {
        ...focusedCompanionProf,
        has_birth_chart: hasBirthChart,
        life_context_json: mergedContext.life_context_json,
        deep_profile_json: mergedContext.deep_profile_json,
        profile_memory_summary: null, // Strictly isolate Council memory from Companions
      };
    } else {
      const mergedContext = mergeUserAndProfileContextForPrompt({
        userLivingContext: userLivingState?.livingContext,
        userDeepProfile: userLivingState?.deepProfile,
        allowCrossCompanionMemory: allowCrossCompanion,
        activeCompanionSlug: effectiveCompanionSlug,
      });
      profileData = {
        id: '',
        name: req.appUser.preferred_call_name || req.appUser.full_name || 'Friend',
        short_name: req.appUser.preferred_call_name || null,
        is_default: true,
        is_activated: false,
        has_birth_chart: false,
        chart_text_context: null,
        chart_json: null,
        profile_memory_summary: null,
        life_context_json: mergedContext.life_context_json,
        deep_profile_json: mergedContext.deep_profile_json,
        birth_date: '',
        birth_time: '',
        birth_city: '',
        birth_country: '',
        current_city: req.appUser.location_city || null,
        current_country: req.appUser.location_country || null,
      };
    }

    if (effectiveCompanionSlug) {
      const priorCompRes = await supabaseAdmin
        .from('conversations')
        .select('id, title')
        .eq('user_id', req.appUser.id)
        .eq('pillar', 'companion')
        .eq('companion_slug', effectiveCompanionSlug)
        .neq('id', conversation.id)
        .order('updated_at', { ascending: false })
        .limit(4);

      if (!priorCompRes.error && priorCompRes.data && priorCompRes.data.length > 0) {
        const priorIds = priorCompRes.data.map((c) => c.id);
        const { data: priorMsgs } = await supabaseAdmin
          .from('messages')
          .select('conversation_id, role, content, created_at')
          .in('conversation_id', priorIds)
          .eq('excluded_from_context', false)
          .order('created_at', { ascending: false })
          .limit(10);

        if (priorMsgs && priorMsgs.length > 0) {
          const companionSpeakerName =
            presetCompanion?.name || activeCompanionPersona?.name || 'You';
          const ordered = [...priorMsgs].reverse();
          scopeMemoryContext = ordered
            .map((m) => {
              const speaker = m.role === 'user' ? 'Friend' : companionSpeakerName;
              const cleaned = String(m.content || '').replace(/\[\[BUBBLE\]\]/g, ' ').slice(0, 220);
              return `${speaker}: ${cleaned}`;
            })
            .join('\n')
            .slice(0, 1800);
        }
      }
    }
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

  let companionBond: CompanionBondState | null = null;
  let referrableCompanions: Array<{ slug: string; name: string; primary_expertise: string }> = [];
  let councilReadingNotesText: string | null = null;
  if (activePillar === 'companion') {
    const [loadedBond, publicCompanionRoster, sharedNotes] = await Promise.all([
      effectiveCompanionSlug
        ? getCompanionBond(req.appUser.id, effectiveCompanionSlug)
        : Promise.resolve(null),
      getPublicCompanionsCatalogCached(),
      listSharedReadingNotes(
        supabaseAdmin,
        req.appUser.id,
        profileData?.id || conversation.profile_id || null
      ).catch(() => []),
    ]);
    companionBond = loadedBond;
    referrableCompanions = publicCompanionRoster.map((c) => ({
      slug: c.slug,
      name: c.name,
      primary_expertise: c.primary_expertise,
    }));
    const formattedNotes = formatCouncilReadingNotesForCompanion(sharedNotes, 4);
    councilReadingNotesText = formattedNotes || null;
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
    const extraFullCols = `${extraBaseCols}${isAstrologyReadingTurn ? ', natal_truth_dossier_json' : ''}`;
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
    .select(MESSAGE_SELECT_COLUMNS_BASE)
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
  const turnStartedAt = Date.now();

  const abortController = new AbortController();
  const handleDisconnect = () => {
    abortController.abort();
  };
  req.on('close', handleDisconnect);

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
      .select(MESSAGE_SELECT_COLUMNS_BASE)
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
      .select(CONVERSATION_LIST_COLUMNS_V7)
      .single()
      .then(
        (r) => r,
        async () =>
          supabaseAdmin
            .from('conversations')
            .update({
              total_word_count: nextTotalWords,
              updated_at: new Date().toISOString(),
            })
            .eq('id', conversation.id)
            .select(CONVERSATION_LIST_COLUMNS_BASE)
            .single()
      );

    scheduleBackgroundTask(() =>
      recordChatbotPipelineLog({
        user_id: req.appUser!.id,
        conversation_id: conversation.id,
        profile_id: conversation.profile_id,
        expert_slug: expertSlug,
        mode_slug: modeSlug,
        response_length: normalizedResponseLength,
        user_prompt_preview: promptText,
        action_taken: 'refuse_extraction',
        stage1_json: { provider_used: 'rule_guard', is_prompt_extraction: true },
        total_latency_ms: Date.now() - turnStartedAt,
      })
    );

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
    isAstrologyCouncilTurn &&
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
  if (isAstrologyCouncilTurn && validAttachments.length === 0) {
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
        isCuratedStarter: Boolean(curatedStarter),
        tradition: isWesternCouncilTurn ? 'western' : 'vedic',
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
      .select(MESSAGE_SELECT_COLUMNS_BASE)
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
      .select(CONVERSATION_LIST_COLUMNS_V7)
      .single()
      .then(
        (r) => r,
        async () =>
          supabaseAdmin
            .from('conversations')
            .update({
              total_word_count: nextTotalWords,
              updated_at: new Date().toISOString(),
            })
            .eq('id', conversation.id)
            .select(CONVERSATION_LIST_COLUMNS_BASE)
            .single()
      );

    scheduleBackgroundTask(() =>
      recordChatbotPipelineLog({
        user_id: req.appUser!.id,
        conversation_id: conversation.id,
        profile_id: conversation.profile_id,
        expert_slug: expertSlug,
        mode_slug: modeSlug,
        response_length: normalizedResponseLength,
        user_prompt_preview: promptText,
        action_taken: 'refuse_extraction',
        stage1_json: stage1Decision!.routerResult as unknown as Record<string, unknown>,
        total_latency_ms: Date.now() - turnStartedAt,
      })
    );

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
      vedic_stage1: stage1Decision.routerResult,
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
      .select(MESSAGE_SELECT_COLUMNS)
      .single();

    if (insertClarify.error) {
      const insertFallback = await supabaseAdmin
        .from('messages')
        .insert(baseClarifyRow)
        .select(MESSAGE_SELECT_COLUMNS_BASE)
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
      .select(CONVERSATION_LIST_COLUMNS_V7)
      .single()
      .then(
        (r) => r,
        async () =>
          supabaseAdmin
            .from('conversations')
            .update({
              total_word_count: nextTotalWords,
              updated_at: new Date().toISOString(),
            })
            .eq('id', conversation.id)
            .select(CONVERSATION_LIST_COLUMNS_BASE)
            .single()
      );

    const enrichedConversation = normalizeConversationDefaults({
      ...((updatedConversation || conversation) as Record<string, unknown>),
      pillar: activePillar,
      companion_persona_json: activeCompanionPersona,
    });

    scheduleBackgroundTask(() =>
      recordChatbotPipelineLog({
        user_id: req.appUser!.id,
        conversation_id: conversation.id,
        profile_id: conversation.profile_id,
        expert_slug: expertSlug,
        mode_slug: modeSlug,
        response_length: normalizedResponseLength,
        user_prompt_preview: promptText,
        action_taken: stage1Decision!.action,
        stage1_json: {
          ...stage1Decision!.routerResult,
          trap_id: stage1Decision!.trapCheck.trapId,
          clarification_kind: stage1Decision!.clarification!.kind,
        },
        total_latency_ms: Date.now() - turnStartedAt,
      })
    );

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

  if (abortController.signal.aborted) {
    req.off('close', handleDisconnect);
    scheduleBackgroundTask(() =>
      recordChatbotPipelineLog({
        user_id: req.appUser!.id,
        conversation_id: conversation.id,
        profile_id: conversation.profile_id,
        expert_slug: expertSlug,
        mode_slug: modeSlug,
        response_length: normalizedResponseLength,
        user_prompt_preview: promptText,
        action_taken: 'aborted',
        stage1_json: stage1Decision
          ? (stage1Decision.routerResult as unknown as Record<string, unknown>)
          : null,
        total_latency_ms: Date.now() - turnStartedAt,
      })
    );
    if (!res.writableEnded) {
      sendEvent({ type: 'aborted' });
      res.end();
    }
    return;
  }

  try {
    const streamResult = await streamConsultationResponse({
      userId: req.appUser.id,
      pillar: activePillar,
      companionPersona: activeCompanionPersona,
      companionPreset: presetCompanion,
      companionBond,
      companionChatMode: effectiveCompanionChatMode,
      companionCrossThreadSummary: activePillar === 'companion' ? scopeMemoryContext : null,
      councilReadingNotesText: activePillar === 'companion' ? councilReadingNotesText : null,
      referrableCompanions: activePillar === 'companion' ? referrableCompanions : undefined,
      clientLocalHour,
      conversation: {
        ...conversation,
        pillar: activePillar,
        companion_slug: effectiveCompanionSlug || conversation.companion_slug || null,
        companion_chat_mode: effectiveCompanionChatMode,
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
      preferredCallName:
        sanitizeHumanCallName(req.appUser.preferred_call_name) ||
        sanitizeHumanCallName(req.appUser.full_name) ||
        null,
      stage1Decision,
      userPriorFluency: req.appUser.sutra_user_profile_json?.inferred_fluency || null,
      deepAudit: useDeepAudit,
      abortSignal: abortController.signal,
      onStatus: (statusText) => {
        sendEvent({ type: 'status', text: statusText });
      },
      onTimingWidgets: (timingWidgets) => {
        sendEvent({ type: 'timing_widgets', timingWidgets });
      },
      onTarotSpread: (tarotSpread) => {
        sendEvent({ type: 'tarot_spread', tarotSpread });
      },
      onChunk: (chunkText) => {
        sendEvent({ type: 'chunk', text: chunkText });
      },
    });

    req.off('close', handleDisconnect);

    if (streamResult.aborted && !streamResult.fullText.trim()) {
      scheduleBackgroundTask(() =>
        recordChatbotPipelineLog({
          user_id: req.appUser!.id,
          conversation_id: conversation.id,
          profile_id: conversation.profile_id,
          expert_slug: expertSlug,
          mode_slug: modeSlug,
          response_length: normalizedResponseLength,
          user_prompt_preview: promptText,
          action_taken: 'aborted',
          stage1_json: stage1Decision
            ? (stage1Decision.routerResult as unknown as Record<string, unknown>)
            : null,
          total_latency_ms: Date.now() - turnStartedAt,
        })
      );
      if (!res.writableEnded) {
        sendEvent({ type: 'aborted' });
        res.end();
      }
      return;
    }

    const rawFinalText = streamResult.fullText.trim();

    if (!rawFinalText) {
      sendEvent({ type: 'error', error: 'No response generated from OpenRouter.' });
      res.end();
      return;
    }

    const allowedTimingWidgetIds =
      streamResult.timingWidgets && streamResult.timingWidgets.length > 0
        ? new Set(streamResult.timingWidgets.map((w) => w.id))
        : null;
    const sanitizedFinal = sanitizeAssistantOutput(rawFinalText, allowedTimingWidgetIds);
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

    // Two-tier structured suggestions governed cleanly per guide/pillar
    const resolvedGuideSlugForSug =
      activePillar === 'companion'
        ? 'companion'
        : activePillar === 'clarity'
        ? 'clarity'
        : expertSlug;
    const resolvedGuideCfgForSug = await getResolvedGuideConfig(resolvedGuideSlugForSug).catch(
      () => null
    );
    const guideAllowsSuggestions =
      activePillar === 'companion'
        ? (presetCompanion ? presetCompanion.suggestions_enabled : true) &&
          (resolvedGuideCfgForSug ? resolvedGuideCfgForSug.features.followups !== false : true)
        : resolvedGuideCfgForSug
        ? resolvedGuideCfgForSug.suggestions.enabled &&
          resolvedGuideCfgForSug.features.followups !== false &&
          (resolvedGuideCfgForSug.suggestions.followups_enabled ||
            resolvedGuideCfgForSug.suggestions.deeper_analysis_enabled)
        : activePillar === 'council';

    const pendingProfile =
      activePillar === 'council' && !streamResult.aborted && !wasLeakIntercepted
        ? streamResult.pendingProfile || null
        : null;
    const isFirstUserTurn =
      (historyRows || []).filter((m) => m.role === 'user').length === 0;
    const hasInlineSuggestions = Boolean(
      guideAllowsSuggestions &&
        streamResult.suggestions &&
        (streamResult.suggestions.followups.length > 0 ||
          streamResult.suggestions.deeper_analysis.length > 0)
    );

    const useStage4AlignedSuggestions =
      activePillar === 'council' &&
      USE_DECOUPLED_STAGE4_SUGGESTIONS &&
      Boolean(streamResult.stage2Pkg) &&
      Boolean(streamResult.vedicMeta);

    const needsAsyncSuggestions =
      guideAllowsSuggestions &&
      !streamResult.aborted &&
      !wasLeakIntercepted &&
      !pendingProfile &&
      !hasInlineSuggestions;

    let deterministicTitle = conversation.title;
    if (isFirstUserTurn && !wasLeakIntercepted) {
      if (activePillar === 'council') {
        const publicCatalog = await getPublicChatCatalogCached();
        const knownCouncilNames = (publicCatalog?.experts || []).map((e) => e.displayName);
        if (isAutoGeneratedCouncilTitle(conversation.title, knownCouncilNames)) {
          deterministicTitle = buildDeterministicCouncilTitle({
            profileName: profileData?.name,
            profileShortName: profileData?.short_name,
            councilDisplayName: getCouncilExpertDisplayName(expertSlug, publicCatalog),
          });
        }
      } else if (
        activePillar === 'companion' &&
        conversation.title === 'Companion Chat' &&
        (presetCompanion?.name || activeCompanionPersona?.name?.trim())
      ) {
        deterministicTitle = (presetCompanion?.name || activeCompanionPersona?.name || 'Companion Chat')
          .trim()
          .slice(0, 80);
      }
    }

    const initialStructuredSuggestions: MessageSuggestions =
      hasInlineSuggestions && streamResult.suggestions
        ? streamResult.suggestions
        : { followups: [], deeper_analysis: [] };

    const initialFollowups = initialStructuredSuggestions.followups.map((item) => item.text);
    const hasInitialStructured =
      initialStructuredSuggestions.followups.length > 0 ||
      initialStructuredSuggestions.deeper_analysis.length > 0;
    const hasVedicMetadata = Boolean(stage1Decision?.routerResult || streamResult.vedicMeta);
    const hasTechBreakdown = Boolean(streamResult.techBreakdown);
    const hasTimingWidgets = Boolean(
      streamResult.timingWidgets && streamResult.timingWidgets.length > 0
    );
    const hasTarotSpread = Boolean(
      streamResult.tarotSpread &&
        Array.isArray(streamResult.tarotSpread.cards) &&
        streamResult.tarotSpread.cards.length > 0
    );
    const initialSuggestionsPayload =
      hasInitialStructured || hasVedicMetadata || hasTechBreakdown || hasTimingWidgets || hasTarotSpread
        ? {
            ...initialStructuredSuggestions,
            ...(stage1Decision?.routerResult ? { vedic_stage1: stage1Decision.routerResult } : {}),
            ...(streamResult.vedicMeta ? { vedic_meta: streamResult.vedicMeta } : {}),
            ...(streamResult.techBreakdown ? { tech_breakdown: streamResult.techBreakdown } : {}),
            ...(hasTimingWidgets ? { timing_widgets: streamResult.timingWidgets } : {}),
            ...(hasTarotSpread ? { tarot_spread: streamResult.tarotSpread } : {}),
          }
        : null;

    const effectiveRenderStyle: ChatStyle | null =
      streamResult.renderStyle ||
      presetCompanion?.chat_style ||
      activeCompanionPersona?.chat_style ||
      null;
    const effectiveReferral =
      !streamResult.aborted && !wasLeakIntercepted ? streamResult.referral || null : null;

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
      followups_json: initialFollowups,
      tokens_in: streamResult.tokensIn,
      tokens_out: streamResult.tokensOut,
      credits_charged: chargeTarget,
    };

    let assistantMessage: Record<string, unknown> | null = null;
    const insertWithV2 = await supabaseAdmin
      .from('messages')
      .insert({
        ...baseAssistantRow,
        suggestions_json: initialSuggestionsPayload,
        render_style: effectiveRenderStyle,
        referral_json: effectiveReferral,
      })
      .select(MESSAGE_SELECT_COLUMNS_V2)
      .single();

    if (!insertWithV2.error && insertWithV2.data) {
      assistantMessage = normalizeMessageDefaults(
        insertWithV2.data as unknown as Record<string, unknown>
      );
    } else {
      const insertWithSug = await supabaseAdmin
        .from('messages')
        .insert({
          ...baseAssistantRow,
          suggestions_json: initialSuggestionsPayload,
        })
        .select(MESSAGE_SELECT_COLUMNS)
        .single();

      if (insertWithSug.error) {
        const insertBase = await supabaseAdmin
          .from('messages')
          .insert(baseAssistantRow)
          .select(MESSAGE_SELECT_COLUMNS_BASE)
          .single();
        assistantMessage = insertBase.data
          ? normalizeMessageDefaults({
              ...(insertBase.data as unknown as Record<string, unknown>),
              suggestions_json: initialSuggestionsPayload,
              render_style: effectiveRenderStyle,
              referral_json: effectiveReferral,
            })
          : null;
      } else {
        assistantMessage = normalizeMessageDefaults({
          ...(insertWithSug.data as unknown as Record<string, unknown>),
          render_style: effectiveRenderStyle,
          referral_json: effectiveReferral,
        });
      }
    }

    const nextTotalWords = (conversation.total_word_count || 0) + userWordCount + assistantWordCount;
    const { data: updatedConversation } = await supabaseAdmin
      .from('conversations')
      .update({
        total_word_count: nextTotalWords,
        ...(deterministicTitle !== conversation.title ? { title: deterministicTitle } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation.id)
      .select(CONVERSATION_LIST_COLUMNS_V7)
      .single()
      .then(
        (r) => r,
        async () =>
          supabaseAdmin
            .from('conversations')
            .update({
              total_word_count: nextTotalWords,
              ...(deterministicTitle !== conversation.title ? { title: deterministicTitle } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq('id', conversation.id)
            .select(CONVERSATION_LIST_COLUMNS_BASE)
            .single()
      );

    // Async non-blocking memory, deep-profile, analyst notes & rolling thread compaction
    if (!streamResult.aborted && !wasLeakIntercepted) {
      const postTurnActiveHistory = [
        ...(historyRows || [])
          .filter((m) => !m.excluded_from_context)
          .map((m) => ({ role: String(m.role), content: String(m.content || '') })),
        { role: 'user', content: persistedUserContent },
        { role: 'assistant', content: finalAssistantText },
      ];
      const verbatimWindow = 18;
      if (postTurnActiveHistory.length > verbatimWindow) {
        const targetCompactedCount = postTurnActiveHistory.length - verbatimWindow;
        const prevCompactedCount = Math.max(
          0,
          Math.trunc(Number(conversation.thread_memory_msg_count) || 0)
        );
        const hasPrevSummary = Boolean(conversation.thread_memory_summary?.trim());
        const shouldCompactThread =
          !hasPrevSummary || targetCompactedCount - prevCompactedCount >= 8;

        if (shouldCompactThread) {
          const sliceStart =
            hasPrevSummary && prevCompactedCount > 0 && prevCompactedCount < targetCompactedCount
              ? prevCompactedCount
              : 0;
          const messagesToCompact = postTurnActiveHistory.slice(sliceStart, targetCompactedCount);
          const convIdForCompact = conversation.id;
          const userIdForCompact = req.appUser.id;
          const prevSummaryForCompact =
            sliceStart > 0 ? conversation.thread_memory_summary || null : null;
          scheduleBackgroundTask(async () => {
            await compactConversationThreadMemory({
              conversationId: convIdForCompact,
              userId: userIdForCompact,
              previousSummary: prevSummaryForCompact,
              messagesToCompact,
              totalCompactedCount: targetCompactedCount,
            });
          });
        }
      }

      if (
        activePillar === 'council' &&
        conversation.profile_id &&
        conversation.use_full_profile_memory !== false
      ) {
        const archivistTradition: 'vedic' | 'western' =
          expertSlug === 'western_astrologer' ||
          expertSlug === 'modern_astrologer' ||
          expertSlug === 'hellenistic_astrologer'
            ? 'western'
            : 'vedic';
        const publicCatalogForMemory = await getPublicChatCatalogCached().catch(() => null);
        const councilDisplayLabel = getCouncilExpertDisplayName(expertSlug, publicCatalogForMemory);
        const profileIdForMemory = conversation.profile_id;
        const userIdForMemory = req.appUser.id;
        const convIdForMemory = conversation.id;

        scheduleBackgroundTask(async () => {
          await Promise.allSettled([
            updateProfileMemoryAfterTurn(profileIdForMemory, userIdForMemory, {
              routerResult: stage1Decision?.routerResult || null,
              domain: streamResult.vedicMeta?.domain || modeSlug,
              effectiveFluency: streamResult.vedicMeta?.effectiveFluency || null,
              hasTechnicalDirective: Boolean(safeTechnicalDirective),
              isDeepAudit: useDeepAudit,
              tradition: archivistTradition,
              latestUserPrompt: promptText,
              latestAssistantAnswer: finalAssistantText,
              actorCitation: `${councilDisplayLabel} (Council)`,
              actorSlug: expertSlug,
              conversationId: convIdForMemory,
            }),
            ...(isAstrologyReadingTurn
              ? [
                  extractAndPersistCouncilAnalystNotes({
                    profileId: profileIdForMemory,
                    userId: userIdForMemory,
                    conversationId: convIdForMemory,
                    expertLabel: councilDisplayLabel,
                    expertSlug,
                    userPrompt: promptText,
                    assistantAnswer: finalAssistantText,
                  }),
                ]
              : []),
          ]);
        });
      } else if (activePillar === 'companion' && effectiveCompanionSlug) {
        const companionName =
          presetCompanion?.name || activeCompanionPersona?.name || 'Companion';
        const companionRole =
          presetCompanion?.primary_expertise || activeCompanionPersona?.role_label || null;
        const companionProfileId =
          profileData?.id && profileData.id.trim()
            ? profileData.id
            : conversation.profile_id || null;
        const canUpdateProfileDeepMemory = conversation.use_full_profile_memory !== false;
        const activeUserId = req.appUser.id;
        const convIdForUpdate = conversation.id;
        scheduleBackgroundTask(async () => {
          await Promise.allSettled([
            updateCompanionBondAfterTurn({
              userId: activeUserId,
              companionSlug: effectiveCompanionSlug,
              companionName,
              userPrompt: promptText,
              assistantAnswer: finalAssistantText,
            }),
            ...(canUpdateProfileDeepMemory
              ? [
                  updateCompanionProfileMemoryAfterTurn({
                    profileId: companionProfileId,
                    userId: activeUserId,
                    companionName,
                    companionRole,
                    companionSlug: effectiveCompanionSlug,
                    conversationId: convIdForUpdate,
                    latestUserPrompt: promptText,
                    latestAssistantAnswer: finalAssistantText,
                  }),
                ]
              : []),
          ]);
          if (effectiveCompanionSlug.startsWith('custom_')) {
            await supabaseAdmin
              .from('user_custom_companions')
              .update({
                last_conversation_id: convIdForUpdate,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', activeUserId)
              .eq('slug', effectiveCompanionSlug)
              .then(() => undefined, () => undefined);
          }
        });
      }
    }

    const enrichedConversation = normalizeConversationDefaults({
      ...((updatedConversation || conversation) as Record<string, unknown>),
      pillar: activePillar,
      companion_slug: effectiveCompanionSlug || conversation.companion_slug || null,
      companion_chat_mode: effectiveCompanionChatMode,
      companion_persona_json: presetCompanion
        ? buildPublicCompanionPersonaSnapshot(presetCompanion)
        : stripSensitivePersonaFields(activeCompanionPersona),
    });

    // Unlock client composer & action bar the instant prose + DB persistence complete
    sendEvent({
      type: 'done',
      assistantMessage,
      followups: initialFollowups,
      suggestions: initialSuggestionsPayload,
      referral: effectiveReferral,
      render_style: effectiveRenderStyle,
      techBreakdown: streamResult.techBreakdown || null,
      timingWidgets: streamResult.timingWidgets || null,
      tarotSpread: streamResult.tarotSpread || null,
      vedicMeta: streamResult.vedicMeta || null,
      pendingProfile,
      conversation: enrichedConversation,
      creditsBalance: updatedBalance,
      creditsCharged: chargeTarget,
      aborted: streamResult.aborted,
    });

    const firstDoneLatencyMs = Date.now() - turnStartedAt;

    let finalStructuredSuggestions = initialStructuredSuggestions;

    if (needsAsyncSuggestions) {
      const asyncSuggestions =
        useStage4AlignedSuggestions && streamResult.stage2Pkg && streamResult.vedicMeta
          ? await generateAlignedStage4Suggestions({
              stage2Pkg: streamResult.stage2Pkg,
              dossier: profileData?.natal_truth_dossier_json || null,
              routerResult: stage1Decision?.routerResult || null,
              vedicMeta: streamResult.vedicMeta,
              userQuestion: promptText,
              assistantAnswer: finalAssistantText,
              languageSlug,
              userFluency: streamResult.vedicMeta.effectiveFluency,
              expertSlug,
            }).catch(() => ({ followups: [], deeper_analysis: [] }))
          : await generateStructuredSuggestions({
              userQuestion: promptText,
              assistantAnswer: finalAssistantText,
              expertSlug: resolvedGuideSlugForSug,
              modeSlug,
              languageSlug,
              hasProfile: Boolean(profileData?.chart_text_context || profileData?.is_activated),
            }).catch(() => ({ followups: [], deeper_analysis: [] }));

      finalStructuredSuggestions = asyncSuggestions;

      const finalFollowups = finalStructuredSuggestions.followups.map((item) => item.text);
      const hasAnyFinalStructured =
        finalStructuredSuggestions.followups.length > 0 ||
        finalStructuredSuggestions.deeper_analysis.length > 0;
      const finalSuggestionsPayload =
        hasAnyFinalStructured || hasVedicMetadata || hasTechBreakdown || hasTimingWidgets || hasTarotSpread
          ? {
              ...finalStructuredSuggestions,
              ...(stage1Decision?.routerResult ? { vedic_stage1: stage1Decision.routerResult } : {}),
              ...(streamResult.vedicMeta ? { vedic_meta: streamResult.vedicMeta } : {}),
              ...(streamResult.techBreakdown ? { tech_breakdown: streamResult.techBreakdown } : {}),
              ...(hasTimingWidgets ? { timing_widgets: streamResult.timingWidgets } : {}),
              ...(hasTarotSpread ? { tarot_spread: streamResult.tarotSpread } : {}),
            }
          : null;

      const assistantMsgId =
        assistantMessage && typeof assistantMessage.id === 'string'
          ? assistantMessage.id
          : null;

      if (assistantMsgId) {
        await supabaseAdmin
          .from('messages')
          .update({
            followups_json: finalFollowups,
            suggestions_json: finalSuggestionsPayload,
          })
          .eq('id', assistantMsgId)
          .then(() => undefined, () => undefined);
      }

      if (!res.writableEnded) {
        sendEvent({
          type: 'post_meta',
          messageId: assistantMsgId,
          conversationId: conversation.id,
          followups: finalFollowups,
          suggestions: finalSuggestionsPayload,
        });
      }
    }

    scheduleBackgroundTask(() =>
      recordChatbotPipelineLog({
        user_id: req.appUser!.id,
        conversation_id: conversation.id,
        profile_id: conversation.profile_id,
        expert_slug: expertSlug,
        mode_slug: modeSlug,
        response_length: normalizedResponseLength,
        user_prompt_preview: promptText,
        action_taken: streamResult.aborted ? 'aborted' : 'proceed',
        stage1_json: stage1Decision
          ? {
              ...stage1Decision.routerResult,
              trap_id: stage1Decision.trapCheck.trapId,
              bypass_clarification: Boolean(bypassClarification),
              is_curated_starter: Boolean(curatedStarter),
            }
          : null,
        stage2_json: streamResult.stage2Pkg
          ? {
              playbook_id: streamResult.stage2Pkg.playbookId,
              domain: streamResult.stage2Pkg.domain,
              intent: streamResult.stage2Pkg.intent,
              ...streamResult.stage2Pkg.metrics,
            }
          : null,
        stage3_json: {
          tokens_in: streamResult.tokensIn,
          tokens_out: streamResult.tokensOut,
          credits_charged: chargeTarget,
          has_tech_breakdown: Boolean(streamResult.techBreakdown),
          tech_breakdown_chars: streamResult.techBreakdown?.length || 0,
          leak_intercepted: wasLeakIntercepted,
          first_done_latency_ms: firstDoneLatencyMs,
          ...(streamResult.vedicMeta || {}),
        },
        stage4_json: {
          followups_count: finalStructuredSuggestions.followups.length,
          deeper_analysis_count: finalStructuredSuggestions.deeper_analysis.length,
          decoupled_stage4: useStage4AlignedSuggestions,
        },
        total_latency_ms: Date.now() - turnStartedAt,
      })
    );

    if (!res.writableEnded) {
      res.end();
    }
  } catch (err) {
    req.off('close', handleDisconnect);
    const message = err instanceof Error ? err.message : 'Consultation generation failed';
    scheduleBackgroundTask(() =>
      recordChatbotPipelineLog({
        user_id: req.appUser!.id,
        conversation_id: conversation.id,
        profile_id: conversation.profile_id,
        expert_slug: expertSlug,
        mode_slug: modeSlug,
        response_length: normalizedResponseLength,
        user_prompt_preview: promptText,
        action_taken: 'error',
        stage1_json: stage1Decision
          ? (stage1Decision.routerResult as unknown as Record<string, unknown>)
          : null,
        total_latency_ms: Date.now() - turnStartedAt,
        error_message: message,
      })
    );
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

  const convRes = await supabaseAdmin
    .from('conversations')
    .select('id, user_id, profile_id, pillar')
    .eq('id', msg.conversation_id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  const conv = !convRes.error
    ? (convRes.data as { id: string; user_id: string; profile_id: string | null; pillar?: string | null } | null)
    : (
        await supabaseAdmin
          .from('conversations')
          .select('id, user_id, profile_id')
          .eq('id', msg.conversation_id)
          .eq('user_id', req.appUser.id)
          .maybeSingle()
      ).data;

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

  let updatedMsgRes = await supabaseAdmin
    .from('messages')
    .update(updates)
    .eq('id', msg.id)
    .select(MESSAGE_SELECT_COLUMNS_V2)
    .single();
  if (updatedMsgRes.error) {
    updatedMsgRes = await supabaseAdmin
      .from('messages')
      .update(updates)
      .eq('id', msg.id)
      .select(MESSAGE_SELECT_COLUMNS_BASE)
      .single();
  }

  if (updatedMsgRes.error || !updatedMsgRes.data) {
    res.status(500).json({ error: 'Failed to update message' });
    return;
  }

  // If context exclusion changed on a Council profile thread, rebuild memory faithfully
  if (
    typeof excluded_from_context === 'boolean' &&
    conv.profile_id &&
    (!('pillar' in conv) || !conv.pillar || conv.pillar === 'council')
  ) {
    void rebuildProfileMemory(conv.profile_id, req.appUser.id);
  }

  res.json({
    message: normalizeMessageDefaults(updatedMsgRes.data as unknown as Record<string, unknown>),
  });
});

// 9a-ii. Toggle Heart / Felt Reaction on a Message Bubble & Feed Bond Memory
router.patch('/messages/:id/reaction', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const rawReaction = req.body?.reaction;
  if (rawReaction !== null && rawReaction !== 'heart' && rawReaction !== 'felt') {
    res.status(400).json({ error: 'Reaction must be "heart", "felt", or null' });
    return;
  }
  const nextReaction: MessageReaction | null = rawReaction;

  const { data: msg } = await supabaseAdmin
    .from('messages')
    .select('id, conversation_id, role, content')
    .eq('id', req.params.id)
    .maybeSingle();

  if (!msg) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }

  let conv: Record<string, unknown> | null = null;
  const convV7 = await supabaseAdmin
    .from('conversations')
    .select('id, user_id, pillar, companion_slug, companion_persona_json')
    .eq('id', msg.conversation_id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  if (!convV7.error && convV7.data) {
    conv = convV7.data as unknown as Record<string, unknown>;
  } else {
    const convFallback = await supabaseAdmin
      .from('conversations')
      .select('id, user_id, pillar, companion_persona_json')
      .eq('id', msg.conversation_id)
      .eq('user_id', req.appUser.id)
      .maybeSingle();
    if (convFallback.data) {
      conv = convFallback.data as unknown as Record<string, unknown>;
    }
  }

  if (!conv) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const updateRes = await supabaseAdmin
    .from('messages')
    .update({ reaction: nextReaction })
    .eq('id', msg.id)
    .select(MESSAGE_SELECT_COLUMNS_V2)
    .single();

  if (conv.pillar === 'companion' && msg.role === 'assistant') {
    const pJson = conv.companion_persona_json as Record<string, unknown> | null;
    const rawSlug =
      (typeof conv.companion_slug === 'string' && conv.companion_slug) ||
      (typeof pJson?.slug === 'string' ? pJson.slug : '');
    const normalizedSlug = normalizeCompanionSlug(rawSlug);
    if (normalizedSlug) {
      const activeUserId = req.appUser.id;
      const excerptText = String(msg.content || '');
      scheduleBackgroundTask(() =>
        recordCompanionBubbleReactionBond({
          userId: activeUserId,
          companionSlug: normalizedSlug,
          excerpt: excerptText,
          reacted: nextReaction,
        })
      );
    }
  }

  if (updateRes.error) {
    res.json({
      message: normalizeMessageDefaults({
        ...(msg as unknown as Record<string, unknown>),
        reaction: nextReaction,
      }),
      reaction: nextReaction,
      persisted: false,
    });
    return;
  }

  res.json({
    message: normalizeMessageDefaults(updateRes.data as unknown as Record<string, unknown>),
    reaction: nextReaction,
    persisted: true,
  });
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

  const msgExpert =
    typeof msgRow.expert_used === 'string' && msgRow.expert_used.trim()
      ? normalizeCouncilSlug(msgRow.expert_used)
      : DEFAULT_COUNCIL_EXPERT_SLUG;
  const msgMode =
    typeof msgRow.mode_used === 'string' && msgRow.mode_used.trim()
      ? msgRow.mode_used.trim()
      : 'general';
  const msgLang =
    typeof msgRow.language_used === 'string' && msgRow.language_used.trim()
      ? msgRow.language_used.trim()
      : 'english';

  const rawExisting =
    msgRow.suggestions_json && typeof msgRow.suggestions_json === 'object'
      ? (msgRow.suggestions_json as Partial<MessageSuggestions> & {
          vedic_stage1?: Stage1RouterResult | null;
          vedic_meta?: VedicSynthesisMeta | null;
          sutra_stage1?: Stage1RouterResult | null;
          sutra_meta?: VedicSynthesisMeta | null;
        })
      : null;

  const existingStage1 = rawExisting?.vedic_stage1 || rawExisting?.sutra_stage1 || null;
  const existingMeta = rawExisting?.vedic_meta || rawExisting?.sutra_meta || null;

  const resolvedMoreGuideSlug =
    msgExpert === 'clarity_tutor' || msgExpert === 'clarity'
      ? 'clarity'
      : msgExpert === 'companion'
      ? 'companion'
      : msgExpert;
  const moreGuideCfg = await getResolvedGuideConfig(resolvedMoreGuideSlug).catch(() => null);
  if (
    moreGuideCfg &&
    (!moreGuideCfg.suggestions.enabled ||
      moreGuideCfg.features.followups === false ||
      (!moreGuideCfg.suggestions.followups_enabled &&
        !moreGuideCfg.suggestions.deeper_analysis_enabled))
  ) {
    res.json({
      suggestions: {
        followups: [],
        deeper_analysis: [],
      },
      disabledForGuide: true,
    });
    return;
  }

  const isEligibleForStage4More =
    USE_DECOUPLED_STAGE4_SUGGESTIONS &&
    msgExpert !== 'clarity_tutor' &&
    Boolean(existingMeta || existingStage1);

  let hasProfile = isEligibleForStage4More;
  if (!hasProfile && conv.profile_id) {
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('is_activated')
      .eq('id', conv.profile_id)
      .maybeSingle();
    hasProfile = Boolean(prof?.is_activated);
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
  if (isEligibleForStage4More && (existingMeta || existingStage1)) {
    const savedPlaybookId =
      existingMeta?.playbookId ||
      existingStage1?.playbook_id ||
      'OPEN_ENDED_SYNTHESIS';
    const userFluency: UserFluencyTier =
      (existingMeta?.effectiveFluency as UserFluencyTier) ||
      existingStage1?.detected_user_fluency ||
      req.appUser.sutra_user_profile_json?.inferred_fluency ||
      'beginner';
    generated = await generateFastMoreStage4Suggestions({
      playbookId: savedPlaybookId,
      domain: existingMeta?.domain || msgMode || 'general',
      convergenceBandLabel: existingMeta?.convergenceBandLabel,
      userFluency,
      userQuestion: userQuestion || 'Follow-up reading insight',
      assistantAnswer: String(msgRow.content || ''),
      languageSlug: msgLang,
      expertSlug: resolvedMoreGuideSlug,
      existingTexts,
      count: 8,
    });
  } else {
    generated = await generateMoreStructuredSuggestions({
      userQuestion: userQuestion || 'Follow-up reading insight',
      assistantAnswer: String(msgRow.content || ''),
      expertSlug: resolvedMoreGuideSlug,
      modeSlug: msgMode,
      languageSlug: msgLang,
      hasProfile,
      existingTexts,
      count: 8,
    });
  }

  const merged: MessageSuggestions & {
    vedic_stage1?: Stage1RouterResult | null;
    vedic_meta?: VedicSynthesisMeta | null;
  } = {
    ...(existingStage1 ? { vedic_stage1: existingStage1 } : {}),
    ...(existingMeta ? { vedic_meta: existingMeta } : {}),
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

  const delConvRes = await supabaseAdmin
    .from('conversations')
    .select('id, user_id, profile_id, pillar, total_word_count')
    .eq('id', msg.conversation_id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

  const conv = !delConvRes.error
    ? (delConvRes.data as {
        id: string;
        user_id: string;
        profile_id: string | null;
        pillar?: string | null;
        total_word_count?: number;
      } | null)
    : (
        await supabaseAdmin
          .from('conversations')
          .select('id, user_id, profile_id, total_word_count')
          .eq('id', msg.conversation_id)
          .eq('user_id', req.appUser.id)
          .maybeSingle()
      ).data;

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

  if (conv.profile_id && (!('pillar' in conv) || !conv.pillar || conv.pillar === 'council')) {
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

  const { toolSlug, inputText, modeSlug, languageSlug, profileId, expertSlug, tradition } =
    req.body || {};
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

  const safeExpertSlug =
    typeof expertSlug === 'string' && expertSlug.trim()
      ? normalizeCouncilSlug(expertSlug.trim())
      : undefined;
  const safeTradition: 'vedic' | 'western' | undefined =
    tradition === 'western' || tradition === 'vedic'
      ? tradition
      : safeExpertSlug === 'western_astrologer' ||
        safeExpertSlug === 'modern_astrologer' ||
        safeExpertSlug === 'hellenistic_astrologer'
      ? 'western'
      : undefined;

  try {
    const result = await runQuickTool({
      toolSlug,
      inputText: String(inputText || ''),
      modeSlug: typeof modeSlug === 'string' ? modeSlug : 'general',
      languageSlug: typeof languageSlug === 'string' ? languageSlug : req.appUser.default_language,
      profileId: typeof profileId === 'string' ? profileId : null,
      userId: req.appUser.id,
      expertSlug: safeExpertSlug,
      tradition: safeTradition,
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
    .select('id, user_id, title, prompt_text, created_at')
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
    .select('id, user_id, title, prompt_text, created_at')
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

// 13. User-Facing Memory Inspector & Living Context (Chartless + Synced "You" Profile)
router.get('/memory', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  try {
    const companionsCatalog = await getPublicCompanionsCatalogCached().catch(
      (): PublicCompanionCard[] => []
    );
    const companionNames: Record<string, string> = {};
    for (const c of companionsCatalog) {
      companionNames[c.slug] = c.name;
    }

    const snapshot = await getUserMemorySnapshot(req.appUser.id, companionNames);
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to load companion memory',
    });
  }
});

router.patch('/memory', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const body =
    req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};

  let nextPreferences: Partial<UserContextPreferences> | undefined;
  if (
    body.preferences &&
    typeof body.preferences === 'object' &&
    !Array.isArray(body.preferences)
  ) {
    const rawPrefs = body.preferences as Record<string, unknown>;
    nextPreferences = {};
    if (typeof rawPrefs.memory_paused === 'boolean') {
      nextPreferences.memory_paused = rawPrefs.memory_paused;
    }
    if (typeof rawPrefs.allow_cross_companion_memory === 'boolean') {
      nextPreferences.allow_cross_companion_memory = rawPrefs.allow_cross_companion_memory;
    }
    if (Object.keys(nextPreferences).length === 0) {
      nextPreferences = undefined;
    }
  }

  let validatedTimezone: string | null | undefined;
  if (body.timezone === null || body.timezone === '') {
    validatedTimezone = null;
  } else if (typeof body.timezone === 'string') {
    const trimmed = body.timezone.trim().slice(0, 80);
    if (trimmed) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: trimmed });
        validatedTimezone = trimmed;
      } catch {
        res.status(400).json({ error: 'Invalid timezone identifier' });
        return;
      }
    }
  }

  try {
    const result = await updateUserMemorySnapshot(req.appUser.id, {
      livingContext: body.livingContext,
      deepProfile: body.deepProfile,
      preferences: nextPreferences,
      timezone: validatedTimezone,
      proactiveOptIn:
        typeof body.proactiveOptIn === 'boolean' ? body.proactiveOptIn : undefined,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to update companion memory',
    });
  }
});

router.delete('/memory/item', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const body =
    req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};
  const kind = body.kind;

  if (
    kind !== 'cited_insight' &&
    kind !== 'deep_entry' &&
    kind !== 'bucket_fact' &&
    kind !== 'stress_area' &&
    kind !== 'anchor'
  ) {
    res.status(400).json({ error: 'Unsupported memory item kind' });
    return;
  }

  try {
    const result = await deleteUserMemoryItem(req.appUser.id, {
      kind,
      id: typeof body.id === 'string' ? body.id : undefined,
      bucket:
        typeof body.bucket === 'string'
          ? (body.bucket as DeepProfileBucketKey)
          : undefined,
      text: typeof body.text === 'string' ? body.text : undefined,
      year: typeof body.year === 'number' ? body.year : undefined,
      tag: typeof body.tag === 'string' ? body.tag : undefined,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to delete memory item',
    });
  }
});

router.patch('/memory/bond/:slug', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const rawSlug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const companionSlug = normalizeCompanionSlug(typeof rawSlug === 'string' ? rawSlug : '');
  if (!companionSlug) {
    res.status(400).json({ error: 'Companion slug is required' });
    return;
  }

  const body =
    req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};

  try {
    const bond = await updateCompanionBondManual(req.appUser.id, companionSlug, {
      memory_summary:
        body.memorySummary === null
          ? null
          : typeof body.memorySummary === 'string'
          ? body.memorySummary
          : undefined,
      tone_preferences:
        Array.isArray(body.tonePreferences)
          ? body.tonePreferences.map((t) => String(t))
          : undefined,
      inside_references:
        Array.isArray(body.insideReferences)
          ? body.insideReferences.map((r) => String(r))
          : undefined,
    });
    res.json({ bond });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to update companion bond memory',
    });
  }
});

router.delete('/memory/bond/:slug', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const rawSlug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const companionSlug = normalizeCompanionSlug(typeof rawSlug === 'string' ? rawSlug : '');
  if (!companionSlug) {
    res.status(400).json({ error: 'Companion slug is required' });
    return;
  }

  try {
    const result = await resetCompanionBond(req.appUser.id, companionSlug);
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to reset companion bond memory',
    });
  }
});

export default router;
