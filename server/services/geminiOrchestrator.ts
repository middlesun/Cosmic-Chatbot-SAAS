import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { getOrFetchDailyTransits, isAstrologyApiConfigured } from './astrologyApi';
import {
  createOpenRouterCompletion,
  getConsultationModel,
  getUtilityModel,
  isOpenRouterConfigured,
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
  PROMPT_EXTRACTION_REFUSAL,
  containsInternalPromptLeak,
  detectPromptExtractionAttempt,
  sanitizeAssistantOutput,
} from './abuseGuard';

export {
  getConsultationModel,
  isOpenRouterConfigured,
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
  responseText: string
): number {
  const estimatedOut = tokensOut > 0 ? tokensOut : Math.ceil(responseText.length / 4);
  const estimatedIn = tokensIn > 0 ? tokensIn : 600;
  const weighted = Math.ceil(estimatedOut * 0.25 + estimatedIn * 0.015);
  return Math.max(25, Math.min(weighted, 1500));
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

export interface StreamConsultationResult {
  fullText: string;
  tokensIn: number;
  tokensOut: number;
  creditsCharged: number;
  aborted: boolean;
  leakIntercepted?: boolean;
}

async function buildStaticSystemInstruction(params: {
  expertSlug: string;
  modeSlug: string;
  outputSlug: string;
  languageSlug: string;
  toneMode: 'friendly' | 'technical';
  responseLength: 'short' | 'detailed';
  preferredCallName?: string | null;
  profile: StreamConsultationParams['profile'];
  extraProfiles?: ConsultationProfileRecord[];
}): Promise<{ systemInstruction: string; modelOverride: string | null }> {
  const { bodies: promptBodies, models: promptModels } = await resolvePromptModules([
    params.expertSlug,
    params.modeSlug,
    params.outputSlug,
    params.languageSlug,
  ]);

  const modelOverride =
    promptModels[params.expertSlug] ||
    promptModels[params.modeSlug] ||
    promptModels[params.outputSlug] ||
    promptModels[params.languageSlug] ||
    null;

  const sections: string[] = [
    CORE_COUNCIL_CONSTITUTION,
    promptBodies[params.expertSlug] || '',
    promptBodies[params.modeSlug] || '',
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
    sections.push(`USER ADDRESS PREFERENCE: Address the user warmly and naturally as "${params.preferredCallName.trim()}" when appropriate.`);
  }

  if (params.profile) {
    if (params.profile.is_activated && params.profile.chart_text_context) {
      sections.push(`ACTIVE NATAL CHART CONTEXT (VERIFIED EPHEMERIS):
${params.profile.chart_text_context}`);
    } else {
      sections.push(`SELECTED PROFILE (NOT YET ACTIVATED):
Name: ${params.profile.name} | Born: ${params.profile.birth_date} ${params.profile.birth_time} in ${params.profile.birth_city}, ${params.profile.birth_country}.
Note: Full planetary ephemeris calculations have not been activated yet for this profile. Be transparent about needing chart activation for exact degree/Dasha timing while still answering conceptual or general astrological questions helpfully.`);
    }
  } else {
    sections.push(`SESSION SCOPE: GENERAL / LEARN ASTROLOGY (No primary natal chart attached).`);
  }

  if (params.extraProfiles && params.extraProfiles.length > 0) {
    const extraBlocks = params.extraProfiles.map((ep, idx) => {
      if (ep.is_activated && ep.chart_text_context) {
        return `ADDITIONAL ATTACHED CHART #${idx + 1} (${ep.name}):\n${ep.chart_text_context}`;
      }
      return `ADDITIONAL ATTACHED PROFILE #${idx + 1} (NOT YET ACTIVATED): Name: ${ep.name} | Born: ${ep.birth_date} ${ep.birth_time} in ${ep.birth_city}, ${ep.birth_country}.`;
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
  const toneMode = params.toneMode === 'friendly' ? 'friendly' : 'technical';
  const responseLength = params.responseLength === 'short' ? 'short' : 'detailed';

  const { systemInstruction: staticSystemInstruction, modelOverride } =
    await buildStaticSystemInstruction({
      expertSlug: params.expertSlug,
      modeSlug: params.modeSlug,
      outputSlug: params.outputSlug,
      languageSlug: params.languageSlug,
      toneMode,
      responseLength,
      preferredCallName: params.preferredCallName,
      profile: params.profile,
      extraProfiles: params.extraProfiles,
    });

  const model = modelOverride || getConsultationModel();

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

  // Filter out messages excluded from context
  const activeHistory = params.historyMessages.filter((m) => !m.excluded_from_context);
  const messages: OpenRouterMessage[] = activeHistory.slice(-24).map((m) => ({
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
  const HOLD_BACK_CHARS = 64;

  try {
    const streamResult = await streamOpenRouterCompletion({
      model,
      system: systemInstructionWithDynamic,
      messages,
      abortSignal: internalAbortController.signal,
      onChunk: (chunkText) => {
        if (leakIntercepted) return;
        rawAccumulated += chunkText;
        if (containsInternalPromptLeak(rawAccumulated)) {
          leakIntercepted = true;
          internalAbortController.abort();
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
      };
    }

    if (rawAccumulated.length > flushedLength) {
      params.onChunk(rawAccumulated.slice(flushedLength));
      flushedLength = rawAccumulated.length;
    }

    const sanitized = sanitizeAssistantOutput(streamResult.fullText);
    if (sanitized.leaked) {
      return {
        fullText: sanitized.text,
        tokensIn: streamResult.tokensIn,
        tokensOut: streamResult.tokensOut,
        creditsCharged: 0,
        aborted: false,
        leakIntercepted: true,
      };
    }

    const creditsCharged = calculateCreditsFromUsage(
      streamResult.tokensIn,
      streamResult.tokensOut,
      streamResult.fullText
    );

    return {
      fullText: streamResult.fullText,
      tokensIn: streamResult.tokensIn,
      tokensOut: streamResult.tokensOut,
      creditsCharged,
      aborted: streamResult.aborted && !leakIntercepted,
      leakIntercepted: false,
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
    const completion = await createOpenRouterCompletion({
      model: getUtilityModel(),
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
    const completion = await createOpenRouterCompletion({
      model: getUtilityModel(),
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
  const { bodies: promptBodies, models: promptModels } = await resolvePromptModules([
    params.toolSlug,
  ]);
  const toolInstruction = promptBodies[params.toolSlug] || '';
  const toolModel = promptModels[params.toolSlug] || getUtilityModel();

  let profileContext = '';
  if (params.profileId && supabaseAdmin) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('name, is_activated, chart_text_context')
      .eq('id', params.profileId)
      .eq('user_id', params.userId)
      .maybeSingle();

    if (profile) {
      profileContext = profile.is_activated && profile.chart_text_context
        ? `PROFILE CONTEXT (${profile.name}):\n${profile.chart_text_context.slice(0, 2800)}`
        : `PROFILE NAME: ${profile.name} (chart not activated yet)`;
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
