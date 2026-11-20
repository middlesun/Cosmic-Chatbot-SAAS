import { Router } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import {
  PROMPT_EXTRACTION_REFUSAL,
  countWords,
  detectPromptExtractionAttempt,
  generateConversationTitle,
  generateFollowUpQuestions,
  isOpenRouterConfiguredAsync,
  runQuickTool,
  sanitizeAssistantOutput,
  streamConsultationResponse,
} from '../services/geminiOrchestrator';
import { isAstrologyApiConfigured } from '../services/astrologyApi';
import { compileBirthChart } from '../services/chartCompiler';
import {
  rebuildProfileMemory,
  updateProfileMemoryAfterTurn,
} from '../services/memoryArchivist';
import { getPublicChatCatalogCached } from '../services/promptDefaults';
import { getPricingConfig, getPublicChatbotUiConfig } from '../services/platformSettings';
import { checkRateLimit } from '../services/abuseGuard';

const router = Router();

const CONVERSATION_LIST_COLUMNS =
  'id, user_id, profile_id, linked_report_id, title, mode_type, is_bookmarked, total_word_count, use_full_profile_memory, updated_at, created_at';
const MESSAGE_SELECT_COLUMNS =
  'id, conversation_id, parent_message_id, role, content, word_count, expert_used, mode_used, output_format_used, language_used, is_starred, excluded_from_context, followups_json, credits_charged, created_at';

// 1. Public-safe Chat Catalog + Dynamic Chatbot UI Config (never raw prompts)
router.get('/config', requireAuth, async (_req: AuthenticatedRequest, res) => {
  const [catalog, chatbotConfig, pricingConfig, openrouterReady] = await Promise.all([
    getPublicChatCatalogCached(),
    getPublicChatbotUiConfig(),
    getPricingConfig(),
    isOpenRouterConfiguredAsync(),
  ]);
  res.setHeader('Cache-Control', 'private, no-cache');
  res.json({
    catalog,
    chatbotConfig,
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

  let convQuery = supabaseAdmin
    .from('conversations')
    .select(CONVERSATION_LIST_COLUMNS)
    .eq('user_id', req.appUser.id);

  if (queryText) {
    convQuery = convQuery.ilike('title', `%${queryText}%`);
  }

  if (sortBy === 'longest') {
    convQuery = convQuery
      .order('is_bookmarked', { ascending: false })
      .order('total_word_count', { ascending: false })
      .order('updated_at', { ascending: false });
  } else {
    convQuery = convQuery
      .order('is_bookmarked', { ascending: false })
      .order('updated_at', { ascending: false });
  }

  const [convRes, primaryProfRes] = await Promise.all([
    convQuery,
    supabaseAdmin
      .from('profiles')
      .select('id, name, short_name, is_default, birth_date, birth_city, birth_country, relationship, is_activated')
      .eq('user_id', req.appUser.id)
      .order('created_at', { ascending: false }),
  ]);

  if (convRes.error) {
    res.status(500).json({ error: 'Failed to load consultations' });
    return;
  }

  let profileRows = primaryProfRes.data;
  if (primaryProfRes.error) {
    const fallbackProfRes = await supabaseAdmin
      .from('profiles')
      .select('id, name, birth_date, birth_city, birth_country, relationship, is_activated')
      .eq('user_id', req.appUser.id)
      .order('created_at', { ascending: false });
    profileRows = (fallbackProfRes.data || []).map((r) => ({
      ...r,
      short_name: null,
      is_default: false,
    }));
  }

  const sortedProfiles = [...(profileRows || [])].sort((a, b) => {
    return (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0);
  });

  res.json({
    conversations: convRes.data || [],
    profiles: sortedProfiles,
  });
});

// 3. Create new conversation (Profile folder or General / Learn Astrology)
router.post('/conversations', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { profile_id, mode_type, title, use_full_profile_memory } = req.body || {};

  if (profile_id) {
    const { data: ownedProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', profile_id)
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

  const { data, error } = await supabaseAdmin
    .from('conversations')
    .insert({
      user_id: req.appUser.id,
      profile_id: profile_id || null,
      mode_type: normalizedModeType,
      title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 80) : 'New Consultation',
      use_full_profile_memory: typeof use_full_profile_memory === 'boolean' ? use_full_profile_memory : true,
    })
    .select('*')
    .single();

  if (error || !data) {
    res.status(500).json({ error: 'Failed to create consultation' });
    return;
  }

  res.status(201).json({ conversation: data });
});

// 4. Update conversation (rename, pin/bookmark, toggle profile memory, attach/switch profile mid-chat)
router.patch('/conversations/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !req.appUser) {
    res.status(503).json({ error: 'Backend unavailable' });
    return;
  }

  const { title, is_bookmarked, profile_id, use_full_profile_memory, mode_type } = req.body || {};
  const updates: Record<string, unknown> = {};

  if (typeof title === 'string' && title.trim()) {
    updates.title = title.trim().slice(0, 90);
  }
  if (typeof is_bookmarked === 'boolean') {
    updates.is_bookmarked = is_bookmarked;
  }
  if (typeof use_full_profile_memory === 'boolean') {
    updates.use_full_profile_memory = use_full_profile_memory;
  }
  if (mode_type === 'reading' || mode_type === 'learn_astrology' || mode_type === 'report_followup') {
    updates.mode_type = mode_type;
  }
  if (profile_id !== undefined) {
    if (profile_id === null || profile_id === '') {
      updates.profile_id = null;
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
      updates.profile_id = profile_id;
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No valid update fields supplied' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('conversations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id)
    .select('*')
    .maybeSingle();

  if (error || !data) {
    res.status(404).json({ error: 'Consultation not found' });
    return;
  }

  res.json({ conversation: data });
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

  const { data: conversation } = await supabaseAdmin
    .from('conversations')
    .select(CONVERSATION_LIST_COLUMNS)
    .eq('id', req.params.id)
    .eq('user_id', req.appUser.id)
    .maybeSingle();

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

  let msgQuery = supabaseAdmin
    .from('messages')
    .select(MESSAGE_SELECT_COLUMNS)
    .eq('conversation_id', conversation.id);

  if (before) {
    msgQuery = msgQuery.lt('created_at', before);
  }

  const { data: rows, error } = await msgQuery
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (error) {
    res.status(500).json({ error: 'Failed to load messages' });
    return;
  }

  const rawRows = rows || [];
  const hasMore = rawRows.length > limit;
  const pageDesc = hasMore ? rawRows.slice(0, limit) : rawRows;
  const messages = [...pageDesc].reverse();

  res.json({ conversation, messages, hasMore });
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
    .select(MESSAGE_SELECT_COLUMNS)
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
    expert,
    mode,
    outputFormat,
    language,
    toneMode,
    responseLength,
    extraProfileIds,
    attachments,
    parentMessageId,
  } = req.body || {};

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

  const isExtractionProbe = detectPromptExtractionAttempt(promptText);
  if (isExtractionProbe) {
    const userProbeRate = checkRateLimit(`extract_probe:${req.appUser.id}`, 5, 15 * 60 * 1000);
    const ipProbeAllowed = req.clientIpHash
      ? checkRateLimit(`extract_probe_ip:${req.clientIpHash}`, 8, 15 * 60 * 1000).allowed
      : true;

    if (!userProbeRate.allowed || !ipProbeAllowed) {
      res.status(429).json({
        error: 'Too many invalid policy requests. Please wait a few minutes and ask a chart-related question.',
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

    const minCredits = pricingConfig.min_credits_to_chat;
    if (req.appUser.credits_balance < minCredits) {
      res.status(402).json({
        error: `Minimum ${minCredits} credits required to start a consultation. Please top up credits.`,
        code: 'INSUFFICIENT_CREDITS',
      });
      return;
    }
  }

  let profileData = null;
  let scopeMemoryContext: string | null = null;
  if (conversation.profile_id) {
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select(
        'id, name, is_activated, chart_text_context, profile_memory_summary, birth_date, birth_time, birth_city, birth_state, birth_country, gender, relationship, latitude, longitude, timezone_offset'
      )
      .eq('id', conversation.profile_id)
      .eq('user_id', req.appUser.id)
      .maybeSingle();

    if (prof && !prof.chart_text_context && isAstrologyApiConfigured()) {
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
      } catch {
        // Proceed gracefully even if live ephemeris fetch fails transiently
      }
    }

    profileData = prof || null;
  } else if (conversation.use_full_profile_memory) {
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
  }

  const extraIdsFiltered = normalizedExtraProfileIds.filter(
    (id) => id !== conversation.profile_id
  );
  let extraProfilesData: Array<{
    id: string;
    name: string;
    is_activated: boolean;
    chart_text_context: string | null;
    profile_memory_summary: string | null;
    birth_date: string;
    birth_time: string;
    birth_city: string;
    birth_country: string;
  }> = [];

  if (extraIdsFiltered.length > 0) {
    const { data: extraProfs } = await supabaseAdmin
      .from('profiles')
      .select(
        'id, name, is_activated, chart_text_context, profile_memory_summary, birth_date, birth_time, birth_city, birth_country'
      )
      .in('id', extraIdsFiltered)
      .eq('user_id', req.appUser.id);
    extraProfilesData = extraProfs || [];
  }

  const expertSlug = typeof expert === 'string' && expert ? expert : req.appUser.default_expert || 'council_synthesis';
  const modeSlug = typeof mode === 'string' && mode ? mode : (conversation.mode_type === 'learn_astrology' ? 'learn_astrology' : 'general');
  const outputSlug = typeof outputFormat === 'string' && outputFormat ? outputFormat : req.appUser.default_output || 'detailed';
  const languageSlug = typeof language === 'string' && language ? language : req.appUser.default_language || 'English';
  const normalizedToneMode = toneMode === 'friendly' ? 'friendly' : 'technical';
  const normalizedResponseLength = responseLength === 'short' ? 'short' : 'detailed';

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

  const abortController = new AbortController();
  const handleDisconnect = () => {
    abortController.abort();
  };
  req.on('close', handleDisconnect);

  try {
    const streamResult = await streamConsultationResponse({
      userId: req.appUser.id,
      conversation,
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
      expertSlug,
      modeSlug,
      outputSlug,
      languageSlug,
      toneMode: normalizedToneMode,
      responseLength: normalizedResponseLength,
      preferredCallName: req.appUser.preferred_call_name || req.appUser.full_name || null,
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
        p_description: `Consultation (${expertSlug} · ${modeSlug})`,
      });
      if (!creditErr && typeof newBal === 'number') {
        updatedBalance = newBal;
      }
    }

    // Generate 5–6 JSON follow-ups + auto-title (if first exchange) in parallel when not aborted/leaked
    const pendingProfile =
      !streamResult.aborted && !wasLeakIntercepted ? streamResult.pendingProfile || null : null;
    const isFirstTurn = (historyRows || []).length === 0 && conversation.title === 'New Consultation';
    const [followups, generatedTitle] = await Promise.all([
      streamResult.aborted || wasLeakIntercepted || Boolean(pendingProfile)
        ? Promise.resolve([])
        : generateFollowUpQuestions({
            userQuestion: promptText,
            assistantAnswer: finalAssistantText,
            modeSlug,
            languageSlug,
            hasProfile: Boolean(profileData?.chart_text_context || profileData?.is_activated),
          }),
      isFirstTurn && !wasLeakIntercepted
        ? generateConversationTitle(promptText, profileData?.name)
        : Promise.resolve(conversation.title),
    ]);

    const { data: assistantMessage } = await supabaseAdmin
      .from('messages')
      .insert({
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
      })
      .select('*')
      .single();

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

    // Async non-blocking Profile Memory update
    if (conversation.profile_id && !streamResult.aborted && !wasLeakIntercepted) {
      void updateProfileMemoryAfterTurn(conversation.profile_id, req.appUser.id);
    }

    sendEvent({
      type: 'done',
      assistantMessage,
      followups,
      pendingProfile,
      conversation: updatedConversation || conversation,
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
