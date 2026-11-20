import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { getOrFetchDailyTransits, isAstrologyApiConfigured } from './astrologyApi';
import {
  createOpenRouterCompletion,
  getConsultationModel,
  getConsultationModelAsync,
  getUtilityModel,
  getUtilityModelAsync,
  isOpenRouterConfigured,
  isOpenRouterConfiguredAsync,
  safeExtractJson,
  streamOpenRouterCompletion,
  type OpenRouterContentPart,
  type OpenRouterMessage,
} from './openrouter';
import {
  CORE_COUNCIL_CONSTITUTION,
  resolvePromptModules,
} from './promptDefaults';
import {
  getActiveRecipeForTarget,
  getChatbotConfig,
  getPricingConfig,
  getResolvedOpenRouterRuntime,
  type ChatBillingWeights,
} from './platformSettings';
import {
  PROMPT_EXTRACTION_REFUSAL,
  containsInternalPromptLeak,
  detectPromptExtractionAttempt,
  sanitizeAssistantOutput,
} from './abuseGuard';

export {
  getConsultationModel,
  getConsultationModelAsync,
  isOpenRouterConfigured,
  isOpenRouterConfiguredAsync,
  detectPromptExtractionAttempt,
  PROMPT_EXTRACTION_REFUSAL,
  sanitizeAssistantOutput,
};

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function calculateCreditsFromUsage(
  tokensIn: number,
  tokensOut: number,
  responseText: string,
  weights?: ChatBillingWeights
): number {
  const outWeight = weights?.output_token_weight ?? 0.25;
  const inWeight = weights?.input_token_weight ?? 0.015;
  const minCredits = weights?.min_credits_per_reply ?? 25;
  const maxCredits = weights?.max_credits_per_reply ?? 1500;
  const estimatedOut = tokensOut > 0 ? tokensOut : Math.ceil(responseText.length / 4);
  const estimatedIn = tokensIn > 0 ? tokensIn : 600;
  const weighted = Math.ceil(estimatedOut * outWeight + estimatedIn * inWeight);
  return Math.max(minCredits, Math.min(weighted, maxCredits));
}

export interface ConsultationAttachmentInput {
  kind: 'image' | 'pdf';
  name: string;
  mimeType: string;
  dataUrl: string;
}

export interface ConsultationProfileRecord {
  id: string;
  name: string;
  is_activated: boolean;
  chart_text_context: string | null;
  profile_memory_summary: string | null;
  birth_date: string;
  birth_time: string;
  birth_city: string;
  birth_country: string;
}

export interface StreamConsultationParams {
  userId: string;
  conversation: {
    id: string;
    profile_id: string | null;
    mode_type: string;
    use_full_profile_memory: boolean;
    title: string;
  };
  profile: ConsultationProfileRecord | null;
  scopeMemoryContext?: string | null;
  extraProfiles?: ConsultationProfileRecord[];
  attachments?: ConsultationAttachmentInput[];
  historyMessages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    excluded_from_context: boolean;
  }>;
  parentQuoteMessage: {
    id: string;
    role: string;
    content: string;
  } | null;
  userPrompt: string;
  expertSlug: string;
  modeSlug: string;
  outputSlug: string;
  languageSlug: string;
  toneMode?: 'friendly' | 'technical';
  responseLength?: 'short' | 'detailed';
  preferredCallName?: string | null;
  abortSignal: AbortSignal;
  onChunk: (chunkText: string) => void;
}

export interface PendingBirthProfileDraft {
  name: string;
  birth_date: string; // YYYY-MM-DD
  birth_time: string; // HH:MM (24-hour)
  birth_time_display?: string;
  place_query: string;
  birth_city?: string;
  birth_state?: string;
  birth_country?: string;
  gender?: string;
  relationship?: string;
  original_question?: string;
}

export interface StreamConsultationResult {
  fullText: string;
  tokensIn: number;
  tokensOut: number;
  creditsCharged: number;
  aborted: boolean;
  leakIntercepted?: boolean;
  pendingProfile?: PendingBirthProfileDraft | null;
}

function normalizeDraftBirthTime(raw: string): string | null {
  const cleaned = raw.trim();
  const match24 = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(cleaned);
  if (match24) {
    const h = Number(match24[1]);
    const m = Number(match24[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  const match12 = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i.exec(cleaned);
  if (match12) {
    let h = Number(match12[1]);
    const m = Number(match12[2] || '0');
    const period = match12[3].toLowerCase();
    if (h >= 1 && h <= 12 && m >= 0 && m <= 59) {
      if (period === 'pm' && h !== 12) h += 12;
      if (period === 'am' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  return null;
}

function formatTime12Hour(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

const PROFILE_CONFIRM_REGEX = /<CC_PROFILE_CONFIRM>([\s\S]*?)<\/CC_PROFILE_CONFIRM>/i;
const PARTIAL_PROFILE_CONFIRM_REGEX = /<CC_PROFILE_CONFIRM[\s\S]*$/i;

export function extractPendingProfileConfirmation(rawText: string): {
  cleanText: string;
  pendingProfile: PendingBirthProfileDraft | null;
} {
  let pendingProfile: PendingBirthProfileDraft | null = null;
  const match = PROFILE_CONFIRM_REGEX.exec(rawText);

  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1].trim()) as Record<string, unknown>;
      const name = typeof parsed.name === 'string' ? parsed.name.trim().slice(0, 80) : '';
      const birthDate = typeof parsed.birth_date === 'string' ? parsed.birth_date.trim() : '';
      const rawTime = typeof parsed.birth_time === 'string' ? parsed.birth_time.trim() : '';
      const normalizedTime = normalizeDraftBirthTime(rawTime);
      const birthCity = typeof parsed.birth_city === 'string' ? parsed.birth_city.trim().slice(0, 80) : '';
      const birthState = typeof parsed.birth_state === 'string' ? parsed.birth_state.trim().slice(0, 80) : '';
      const birthCountry = typeof parsed.birth_country === 'string' ? parsed.birth_country.trim().slice(0, 80) : '';
      const rawPlaceQuery = typeof parsed.place_query === 'string' ? parsed.place_query.trim().slice(0, 180) : '';
      const placeQuery =
        rawPlaceQuery || [birthCity, birthState, birthCountry].filter(Boolean).join(', ');

      if (name && /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && normalizedTime && placeQuery) {
        pendingProfile = {
          name,
          birth_date: birthDate,
          birth_time: normalizedTime,
          birth_time_display:
            typeof parsed.birth_time_display === 'string' && parsed.birth_time_display.trim()
              ? parsed.birth_time_display.trim()
              : formatTime12Hour(normalizedTime),
          place_query: placeQuery,
          birth_city: birthCity || undefined,
          birth_state: birthState || undefined,
          birth_country: birthCountry || undefined,
          gender: typeof parsed.gender === 'string' && parsed.gender.trim() ? parsed.gender.trim() : undefined,
          relationship:
            typeof parsed.relationship === 'string' && parsed.relationship.trim()
              ? parsed.relationship.trim()
              : undefined,
          original_question:
            typeof parsed.original_question === 'string' && parsed.original_question.trim()
              ? parsed.original_question.trim().slice(0, 400)
              : undefined,
        };
      }
    } catch {
      pendingProfile = null;
    }
  }

  const cleanText = rawText
    .replace(PROFILE_CONFIRM_REGEX, '')
    .replace(PARTIAL_PROFILE_CONFIRM_REGEX, '')
    .replace(/\n{3,}$/g, '\n\n')
    .trim();

  return { cleanText, pendingProfile };
}

async function buildStaticSystemInstruction(params: {
  expertSlug: string;
  modeSlug: string;
  outputSlug: string;
  languageSlug: string;
  modeType?: string;
  toneMode: 'friendly' | 'technical';
  responseLength: 'short' | 'detailed';
  preferredCallName?: string | null;
  turnCount: number;
  profile: StreamConsultationParams['profile'];
  extraProfiles?: ConsultationProfileRecord[];
}): Promise<{ systemInstruction: string; modelOverride: string | null }> {
  const [chatbotConfig, activeModeRecipe] = await Promise.all([
    getChatbotConfig(),
    getActiveRecipeForTarget('mode', params.modeSlug),
  ]);

  const recipeSteps = activeModeRecipe
    ? (activeModeRecipe.steps_json || []).filter((s) => s && s.enabled !== false && s.prompt_slug)
    : [];
  const slugsToResolve = Array.from(
    new Set([
      params.expertSlug,
      params.modeSlug,
      params.outputSlug,
      params.languageSlug,
      ...recipeSteps.map((s) => s.prompt_slug),
    ])
  );

  const { bodies: promptBodies, models: promptModels } = await resolvePromptModules(slugsToResolve);

  const modelOverride =
    activeModeRecipe?.model_id ||
    promptModels[params.expertSlug] ||
    promptModels[params.modeSlug] ||
    promptModels[params.outputSlug] ||
    promptModels[params.languageSlug] ||
    null;

  const recipeBlocks: string[] = [];
  for (const step of recipeSteps) {
    const body =
      typeof step.inline_override === 'string' && step.inline_override.trim()
        ? step.inline_override.trim()
        : promptBodies[step.prompt_slug];
    if (body) {
      recipeBlocks.push(body);
    }
  }

  const sections: string[] = [
    CORE_COUNCIL_CONSTITUTION,
    chatbotConfig.conversational_rules || '',
    promptBodies[params.expertSlug] || '',
    promptBodies[params.modeSlug] || '',
    ...recipeBlocks,
    promptBodies[params.outputSlug] || '',
    promptBodies[params.languageSlug] || '',
  ].filter(Boolean);

  if (params.toneMode === 'friendly') {
    sections.push(
      `COMMUNICATION DEPTH — FRIENDLY MODE (NON-TECHNICAL): Perform all Vedic/KP/Jaimini/Dasha chart synthesis silently behind the scenes, then explain your answer in warm, clear, everyday conversational language. Avoid overwhelming technical jargon, raw planetary degrees, Nakshatra pada math, or long Sanskrit sub-lord chains unless the user explicitly asks to see the technical breakdown. Translate chart factors directly into relatable life guidance and plain calendar timing windows.`
    );
  } else {
    sections.push(
      `COMMUNICATION DEPTH — TECHNICAL MODE: Include authentic Jyotish technical precision—citing exact Rashi placements, house lordships, planetary strengths/Shadbala/Ashtakavarga, Nakshatra & KP Sub-Lord significators, divisional Vargas (D9/D10), and active Vimshottari Mahadasha–Antardasha–Pratyantardasha mechanics.`
    );
  }

  if (params.responseLength === 'short') {
    sections.push(
      `RESPONSE LENGTH — SHORT: Keep the answer crisp, high-signal, and concise (around 120–200 words max). Lead with the direct conclusion upfront, give the top 2–3 key insights or timing dates, and skip unnecessary filler or lengthy preambles.`
    );
  } else {
    sections.push(
      `RESPONSE LENGTH — DETAILED: Provide a thorough, well-paced, comprehensive reading that unpacks the reasoning, relevant timing shifts, and practical next steps without cutting corners.`
    );
  }

  if (params.preferredCallName?.trim()) {
    const safeName = params.preferredCallName.trim();
    sections.push(
      `USER NAME CONTEXT: The person you are speaking with goes by "${safeName}". NEVER start your message with "Hello ${safeName},", "Hi ${safeName},", "Dear ${safeName},", or any email-style salutation header. Respond directly to their question in natural conversation, and only weave their name in sparingly inside a sentence if it feels genuinely organic.`
    );
  }

  if (params.turnCount > 0) {
    sections.push(
      `ONGOING CONVERSATION CONTINUITY (Message #${params.turnCount + 1} in this thread): Continue the live dialogue naturally from the previous exchange. Do NOT greet the user again, do NOT say hello, and do NOT re-introduce yourself.`
    );
  }

  if (params.profile) {
    if (params.profile.chart_text_context) {
      sections.push(`ACTIVE NATAL CHART CONTEXT (VERIFIED EPHEMERIS):
${params.profile.chart_text_context}`);
    } else {
      sections.push(`SELECTED PROFILE:
Name: ${params.profile.name} | Born: ${params.profile.birth_date} ${params.profile.birth_time} in ${params.profile.birth_city}, ${params.profile.birth_country}.
Note: Full planetary ephemeris data is being prepared for this profile. Do not guess exact planetary degrees or Dashas if ephemeris context is absent.`);
    }
  } else {
    sections.push(`SESSION SCOPE: GENERAL / LEARN ASTROLOGY (No primary natal chart attached yet).`);

    if (params.modeType !== 'learn_astrology' && chatbotConfig.features.auto_intake !== false) {
      sections.push(`CONVERSATIONAL BIRTH CHART INTAKE (WHEN NO CHART IS ATTACHED):
- If the user asks a general Vedic astrology question (concepts, transits, remedies, meanings), answer it directly and helpfully without demanding birth details.
- If the user asks for a personal reading or shares someone's birth details in natural language (for example: "Hey I need a reading about Sam, born on 11th July 2001"), NEVER invent or guess Lagna, Moon sign, planetary degrees, or Dashas from memory.
- Instead, warmly collect ONLY the missing required details among these 4 fields:
  1. Name (whose chart is this — if the user says "my chart" and you know their name, use it or ask warmly)
  2. Date of Birth
  3. Time of Birth (in AM/PM — if they say they don't know the exact time, offer to use 12:00 PM approximate)
  4. Place of Birth (City, State/Country)
- Keep your intake follow-up short, warm, and effortless to answer.
- The moment ALL 4 details (Name, Date, Time, and Place) are gathered across the conversation, present them clearly in a short summary (using a readable date like "11 July 2001" and 12-hour AM/PM time) and end by asking: "Kindly confirm if these details are accurate?"
- On the very last line of ONLY that confirmation message (never before all 4 fields are known, never inside code fences, and never mention this hidden tag to the user), append exactly:
<CC_PROFILE_CONFIRM>{"name":"Full Name","birth_date":"YYYY-MM-DD","birth_time":"HH:MM","birth_time_display":"h:mm AM/PM","place_query":"City, State, Country","birth_city":"City","birth_state":"State","birth_country":"Country","relationship":"Self or Other","original_question":"short summary of what the user asked"}</CC_PROFILE_CONFIRM>
- Wait for the user's confirmation before giving any chart reading.`);
    }
  }

  if (params.extraProfiles && params.extraProfiles.length > 0) {
    const extraBlocks = params.extraProfiles.map((ep, idx) => {
      if (ep.chart_text_context) {
        return `ADDITIONAL ATTACHED CHART #${idx + 1} (${ep.name}):\n${ep.chart_text_context}`;
      }
      return `ADDITIONAL ATTACHED PROFILE #${idx + 1}: Name: ${ep.name} | Born: ${ep.birth_date} ${ep.birth_time} in ${ep.birth_city}, ${ep.birth_country}.`;
    });
    sections.push(extraBlocks.join('\n\n'));
  }

  return {
    systemInstruction: sections.join('\n\n---\n\n'),
    modelOverride,
  };
}

export async function streamConsultationResponse(
  params: StreamConsultationParams
): Promise<StreamConsultationResult> {
  const [runtime, pricingConfig] = await Promise.all([
    getResolvedOpenRouterRuntime(),
    getPricingConfig(),
  ]);

  const toneMode = params.toneMode === 'friendly' ? 'friendly' : 'technical';
  const responseLength = params.responseLength === 'short' ? 'short' : 'detailed';
  const activeHistory = params.historyMessages.filter((m) => !m.excluded_from_context);

  const { systemInstruction: staticSystemInstruction, modelOverride } =
    await buildStaticSystemInstruction({
      expertSlug: params.expertSlug,
      modeSlug: params.modeSlug,
      outputSlug: params.outputSlug,
      languageSlug: params.languageSlug,
      modeType: params.conversation.mode_type,
      toneMode,
      responseLength,
      preferredCallName: params.preferredCallName,
      turnCount: activeHistory.length,
      profile: params.profile,
      extraProfiles: params.extraProfiles,
    });

  const model = modelOverride || runtime.consultationModel || getConsultationModel();
  const maxOutputTokens =
    responseLength === 'short'
      ? runtime.tokenLimits.chat_short
      : runtime.tokenLimits.chat_detailed;
  const maxHistoryTurns = runtime.tokenLimits.max_history_turns || 24;

  // Fetch today's cached Gochar transits (max 1 API call/day across platform)
  let gocharContext = '';
  if (isAstrologyApiConfigured()) {
    try {
      const daily = await getOrFetchDailyTransits();
      gocharContext = daily.transitsText;
    } catch {
      gocharContext = '';
    }
  }

  const dynamicContextBlocks: string[] = [];
  if (gocharContext) {
    dynamicContextBlocks.push(gocharContext);
  }
  if (params.conversation.use_full_profile_memory) {
    if (params.profile?.profile_memory_summary) {
      dynamicContextBlocks.push(
        `LONGITUDINAL PROFILE MEMORY (Themes from earlier active sessions):\n${params.profile.profile_memory_summary}`
      );
    } else if (params.scopeMemoryContext?.trim()) {
      const scopeTitle =
        params.conversation.mode_type === 'learn_astrology' ? 'LEARNING' : 'GENERAL';
      dynamicContextBlocks.push(
        `LONGITUDINAL ${scopeTitle} MEMORY (Themes and progress from earlier active sessions):\n${params.scopeMemoryContext.trim()}`
      );
    }
  }

  const systemInstructionWithDynamic = [
    staticSystemInstruction,
    ...dynamicContextBlocks,
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');

  // Filter out messages excluded from context (already filtered above)
  const messages: OpenRouterMessage[] = activeHistory.slice(-maxHistoryTurns).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  let finalUserText = params.userPrompt.trim();
  if (params.parentQuoteMessage) {
    const snippet = params.parentQuoteMessage.content.slice(0, 900);
    finalUserText = `[Replying directly to this earlier insight from the Council:]
"""
${snippet}
"""

User's specific question: ${finalUserText}`;
  }

  if (params.attachments && params.attachments.length > 0) {
    const contentParts: OpenRouterContentPart[] = [
      { type: 'text', text: finalUserText },
    ];
    for (const att of params.attachments) {
      if (att.kind === 'image' && att.dataUrl.startsWith('data:image/')) {
        contentParts.push({
          type: 'image_url',
          image_url: { url: att.dataUrl },
        });
      } else if (att.kind === 'pdf' && att.dataUrl.startsWith('data:application/pdf')) {
        contentParts.push({
          type: 'file',
          file: {
            filename: att.name || 'document.pdf',
            file_data: att.dataUrl,
          },
        });
      }
    }
    messages.push({
      role: 'user',
      content: contentParts,
    });
  } else {
    messages.push({
      role: 'user',
      content: finalUserText,
    });
  }

  const internalAbortController = new AbortController();
  const forwardAbort = () => internalAbortController.abort();
  if (params.abortSignal.aborted) {
    internalAbortController.abort();
  } else {
    params.abortSignal.addEventListener('abort', forwardAbort, { once: true });
  }

  let rawAccumulated = '';
  let flushedLength = 0;
  let leakIntercepted = false;
  let confirmTagHoldStarted = false;
  const HOLD_BACK_CHARS = 64;

  try {
    const streamResult = await streamOpenRouterCompletion({
      model,
      system: systemInstructionWithDynamic,
      messages,
      maxTokens: maxOutputTokens,
      abortSignal: internalAbortController.signal,
      onChunk: (chunkText) => {
        if (leakIntercepted) return;
        rawAccumulated += chunkText;
        if (containsInternalPromptLeak(rawAccumulated)) {
          leakIntercepted = true;
          internalAbortController.abort();
          return;
        }
        if (confirmTagHoldStarted) return;

        const tagIndex = rawAccumulated.search(/<CC_PROFILE_CONFIRM/i);
        if (tagIndex !== -1) {
          if (tagIndex > flushedLength) {
            const beforeTag = rawAccumulated.slice(flushedLength, tagIndex).replace(/\s+$/, '');
            if (beforeTag) {
              params.onChunk(beforeTag);
            }
            flushedLength = tagIndex;
          }
          confirmTagHoldStarted = true;
          return;
        }

        const safeEnd = rawAccumulated.length - HOLD_BACK_CHARS;
        if (safeEnd > flushedLength) {
          const toEmit = rawAccumulated.slice(flushedLength, safeEnd);
          flushedLength = safeEnd;
          params.onChunk(toEmit);
        }
      },
    });

    if (leakIntercepted || containsInternalPromptLeak(streamResult.fullText)) {
      return {
        fullText: PROMPT_EXTRACTION_REFUSAL,
        tokensIn: streamResult.tokensIn,
        tokensOut: streamResult.tokensOut,
        creditsCharged: 0,
        aborted: false,
        leakIntercepted: true,
        pendingProfile: null,
      };
    }

    const extractedFromAccumulated = extractPendingProfileConfirmation(rawAccumulated);
    if (!confirmTagHoldStarted && extractedFromAccumulated.cleanText.length > flushedLength) {
      params.onChunk(extractedFromAccumulated.cleanText.slice(flushedLength));
      flushedLength = extractedFromAccumulated.cleanText.length;
    }

    const extractedFinal = extractPendingProfileConfirmation(streamResult.fullText);
    const sanitized = sanitizeAssistantOutput(extractedFinal.cleanText);
    if (sanitized.leaked) {
      return {
        fullText: sanitized.text,
        tokensIn: streamResult.tokensIn,
        tokensOut: streamResult.tokensOut,
        creditsCharged: 0,
        aborted: false,
        leakIntercepted: true,
        pendingProfile: null,
      };
    }

    const creditsCharged = calculateCreditsFromUsage(
      streamResult.tokensIn,
      streamResult.tokensOut,
      sanitized.text,
      pricingConfig.chat_billing
    );

    return {
      fullText: sanitized.text,
      tokensIn: streamResult.tokensIn,
      tokensOut: streamResult.tokensOut,
      creditsCharged,
      aborted: streamResult.aborted && !leakIntercepted,
      leakIntercepted: false,
      pendingProfile: streamResult.aborted ? null : extractedFinal.pendingProfile,
    };
  } finally {
    params.abortSignal.removeEventListener('abort', forwardAbort);
  }
}

export async function generateFollowUpQuestions(params: {
  userQuestion: string;
  assistantAnswer: string;
  modeSlug: string;
  languageSlug: string;
  hasProfile: boolean;
}): Promise<string[]> {
  try {
    const [chatbotConfig, runtime] = await Promise.all([
      getChatbotConfig(),
      getResolvedOpenRouterRuntime(),
    ]);
    if (chatbotConfig.features.followups === false) {
      return [];
    }
    const completion = await createOpenRouterCompletion({
      model: runtime.utilityModel || getUtilityModel(),
      maxTokens: runtime.tokenLimits.utility,
      jsonMode: true,
      temperature: 0.4,
      messages: [
        {
          role: 'user',
          content: `Based on this Vedic Astrology consultation exchange, propose 5 to 6 insightful, specific follow-up questions the user would naturally want to explore next.
- Match the language: ${params.languageSlug}.
- Mode focus: ${params.modeSlug}.
- ${params.hasProfile ? 'Reference Dasha timing, divisional charts (D9/D10), KP sub-lords, or Gochar transits naturally.' : 'Focus on clarifying Jyotish concepts or applying them step by step.'}
- Keep each question concise (10-18 words), sharp, and actionable. Do NOT prefix with numbers.
- Return STRICTLY a JSON object with shape: { "questions": ["...", "..."] }

USER QUESTION:
${params.userQuestion.slice(0, 600)}

COUNCIL ANSWER EXCERPT:
${params.assistantAnswer.slice(0, 1800)}`,
        },
      ],
    });

    const parsed = safeExtractJson<{ questions?: unknown } | unknown[]>(completion.text, {});
    const rawList = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { questions?: unknown })?.questions)
      ? ((parsed as { questions: unknown[] }).questions)
      : [];

    return rawList
      .map((q) => String(q).replace(/^\d+[\).\s-]+/, '').trim())
      .filter(Boolean)
      .slice(0, 6);
  } catch {
    return [];
  }
}

export async function generateConversationTitle(
  firstQuestion: string,
  profileName?: string | null
): Promise<string> {
  try {
    const runtime = await getResolvedOpenRouterRuntime();
    const completion = await createOpenRouterCompletion({
      model: runtime.utilityModel || getUtilityModel(),
      maxTokens: Math.min(120, runtime.tokenLimits.utility),
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `Generate a refined 3-to-5-word title for this Vedic astrology consultation thread${profileName ? ` for ${profileName}` : ''}. No quotes, no punctuation at the end, Title Case.

Question: ${firstQuestion.slice(0, 400)}`,
        },
      ],
    });
    const cleaned = completion.text.replace(/["'*#]/g, '').trim();
    return cleaned ? cleaned.slice(0, 70) : 'Consultation Insight';
  } catch {
    return firstQuestion.trim().slice(0, 48) || 'Consultation Insight';
  }
}

export async function runQuickTool(params: {
  toolSlug: 'question_generator' | 'prompt_expander' | 'prompt_optimizer';
  inputText: string;
  modeSlug?: string;
  languageSlug?: string;
  profileId?: string | null;
  userId: string;
}): Promise<{ items?: string[]; resultText: string }> {
  const supabaseAdmin = getSupabaseAdmin();
  const [{ bodies: promptBodies, models: promptModels }, runtime] = await Promise.all([
    resolvePromptModules([params.toolSlug]),
    getResolvedOpenRouterRuntime(),
  ]);
  const toolInstruction = promptBodies[params.toolSlug] || '';
  const toolModel = promptModels[params.toolSlug] || runtime.utilityModel || getUtilityModel();

  let profileContext = '';
  if (params.profileId && supabaseAdmin) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('name, is_activated, chart_text_context')
      .eq('id', params.profileId)
      .eq('user_id', params.userId)
      .maybeSingle();

    if (profile) {
      profileContext = profile.chart_text_context
        ? `PROFILE CONTEXT (${profile.name}):\n${profile.chart_text_context.slice(0, 2800)}`
        : `PROFILE NAME: ${profile.name}`;
    }
  }

  if (params.toolSlug === 'question_generator') {
    const completion = await createOpenRouterCompletion({
      model: toolModel,
      system: toolInstruction,
      jsonMode: true,
      temperature: 0.5,
      messages: [
        {
          role: 'user',
          content: `${profileContext ? profileContext + '\n\n' : ''}Topic / Goal: ${params.inputText || 'General life & career strategy'}
Mode: ${params.modeSlug || 'general'}
Language: ${params.languageSlug || 'English'}
Return STRICTLY a JSON object with shape: { "items": ["question 1", "question 2", ...] }`,
        },
      ],
    });

    const parsed = safeExtractJson<{ items?: unknown; questions?: unknown } | unknown[]>(
      completion.text,
      {}
    );
    const rawItems = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { items?: unknown }).items)
      ? (parsed as { items: unknown[] }).items
      : Array.isArray((parsed as { questions?: unknown }).questions)
      ? (parsed as { questions: unknown[] }).questions
      : [];

    const items = rawItems.map((q) => String(q).trim()).filter(Boolean).slice(0, 6);
    return {
      items,
      resultText: items.join('\n'),
    };
  }

  const completion = await createOpenRouterCompletion({
    model: toolModel,
    system: toolInstruction,
    temperature: 0.4,
    messages: [
      {
        role: 'user',
        content: `${profileContext ? profileContext + '\n\n' : ''}Draft Input: ${params.inputText}
Mode: ${params.modeSlug || 'general'}
Language: ${params.languageSlug || 'English'}
Return ONLY the refined prompt text ready to send—no preamble or meta-commentary.`,
      },
    ],
  });

  return {
    resultText: completion.text.trim(),
  };
}
