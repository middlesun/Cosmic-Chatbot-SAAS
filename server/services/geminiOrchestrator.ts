import crypto from 'crypto';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { getOrFetchDailyTransits, isAstrologyApiConfigured } from './astrologyApi';
import { formatChartForLLM, type CompiledChartData } from './chartCompiler';
import {
  drawTarotSpread,
  extractNumerologyHintsFromPrompt,
  formatPythagoreanNumerologyContext,
  formatTarotSpreadContext,
  formatTropicalWesternContext,
} from './divinationEngines';
import {
  buildClaritySystemPrompt,
  buildCompanionSystemPrompt,
  type ChatPillar,
  type CompanionPersona,
} from './companionEngine';
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
  getSuggestionsConfig,
  type ChatBillingWeights,
  type SuggestionsConfig,
} from './platformSettings';
import {
  PROMPT_EXTRACTION_REFUSAL,
  containsInternalPromptLeak,
  detectPromptExtractionAttempt,
  sanitizeAssistantOutput,
  sanitizeSutraProse,
} from './abuseGuard';
import type { LifeContextData } from '../../lib/lifeContextSchema';
import type { SutraSynthesisMeta, UserFluencyTier } from '../../lib/sutraTypes';
import {
  compileStage2ContextPackage,
  type DailyTransitSliceInput,
  type ExtraProfileSliceInput,
  type Stage2ContextPackage,
} from './contextSlicer';
import { runDeepCouncilAudit } from './deepCouncilAudit';
import {
  evaluateStage1Routing,
  type Stage1RoutingDecision,
} from './intentRouter';
import type { NatalTruthDossierV1 } from './natalDossier';
import {
  buildShortReplyBreakdownInstruction,
  buildSutraPathAPrompt,
  extractTechBreakdown,
  type SutraVoicePreset,
} from './sutraSynthesizer';

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

export interface SuggestionItem {
  id: string;
  text: string;
  technical_directive?: string;
}

export interface MessageSuggestions {
  followups: SuggestionItem[];
  deeper_analysis: SuggestionItem[];
}

export interface ConsultationProfileRecord {
  id: string;
  name: string;
  is_activated: boolean;
  chart_text_context: string | null;
  chart_json?: CompiledChartData | null;
  profile_memory_summary: string | null;
  life_context_json?: LifeContextData | null;
  life_context_completeness?: number | null;
  natal_truth_dossier_json?: NatalTruthDossierV1 | null;
  birth_date: string;
  birth_time: string;
  birth_city: string;
  birth_country: string;
  current_city?: string | null;
  current_state?: string | null;
  current_country?: string | null;
}

export interface StreamConsultationParams {
  userId: string;
  pillar?: ChatPillar;
  companionPersona?: CompanionPersona | null;
  conversation: {
    id: string;
    profile_id: string | null;
    mode_type: string;
    use_full_profile_memory: boolean;
    title: string;
    pillar?: ChatPillar;
    companion_persona_json?: CompanionPersona | null;
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
  technicalDirective?: string | null;
  expertSlug: string;
  modeSlug: string;
  outputSlug: string;
  languageSlug: string;
  toneMode?: 'friendly' | 'technical';
  responseLength?: 'short' | 'detailed';
  preferredCallName?: string | null;
  stage1Decision?: Stage1RoutingDecision | null;
  userPriorFluency?: UserFluencyTier | null;
  deepAudit?: boolean;
  voicePreset?: SutraVoicePreset;
  dailyTransitsOverride?: DailyTransitSliceInput | null;
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
  techBreakdown?: string | null;
  tokensIn: number;
  tokensOut: number;
  creditsCharged: number;
  aborted: boolean;
  leakIntercepted?: boolean;
  pendingProfile?: PendingBirthProfileDraft | null;
  suggestions?: MessageSuggestions | null;
  sutraMeta?: SutraSynthesisMeta | null;
  stage2Pkg?: Stage2ContextPackage | null;
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
const SUGGESTIONS_BLOCK_REGEX = /<<<SUGGESTIONS_JSON>>>([\s\S]*?)<<<END_SUGGESTIONS_JSON>>>/i;
const PARTIAL_SUGGESTIONS_REGEX = /<<<SUGGESTIONS(?:_JSON)?[\s\S]*$/i;

function makeSuggestionId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(4).toString('hex')}`;
}

function normalizeSuggestionList(
  rawList: unknown,
  prefix: string,
  maxItems: number,
  includeDirective: boolean
): SuggestionItem[] {
  if (!Array.isArray(rawList)) return [];
  const seen = new Set<string>();
  const out: SuggestionItem[] = [];

  for (const entry of rawList) {
    let rawText = '';
    let rawDirective = '';
    if (typeof entry === 'string') {
      rawText = entry;
    } else if (entry && typeof entry === 'object') {
      const rec = entry as Record<string, unknown>;
      rawText = typeof rec.text === 'string' ? rec.text : typeof rec.question === 'string' ? rec.question : '';
      rawDirective =
        typeof rec.technical_directive === 'string'
          ? rec.technical_directive
          : typeof rec.directive === 'string'
          ? rec.directive
          : '';
    }

    const cleanedText = rawText
      .replace(/^\d+[\).\s-]+/, '')
      .replace(/^[-•*]\s+/, '')
      .trim()
      .slice(0, 220);

    if (!cleanedText || cleanedText.length < 6) continue;
    const key = cleanedText.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const item: SuggestionItem = {
      id: makeSuggestionId(prefix),
      text: cleanedText,
    };
    if (includeDirective && rawDirective.trim()) {
      item.technical_directive = rawDirective.trim().slice(0, 600);
    }
    out.push(item);
    if (out.length >= maxItems) break;
  }

  return out;
}

export function extractHiddenDirectives(
  rawText: string,
  suggestionsConfig?: Pick<
    SuggestionsConfig,
    'followups_enabled' | 'deeper_analysis_enabled' | 'max_followups' | 'max_deeper_analysis'
  >
): {
  cleanText: string;
  techBreakdown: string | null;
  pendingProfile: PendingBirthProfileDraft | null;
  suggestions: MessageSuggestions | null;
} {
  let pendingProfile: PendingBirthProfileDraft | null = null;
  const profileMatch = PROFILE_CONFIRM_REGEX.exec(rawText);

  if (profileMatch && profileMatch[1]) {
    try {
      const parsed = JSON.parse(profileMatch[1].trim()) as Record<string, unknown>;
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

  let suggestions: MessageSuggestions | null = null;
  const sugMatch = SUGGESTIONS_BLOCK_REGEX.exec(rawText);
  if (sugMatch && sugMatch[1] && !pendingProfile) {
    const parsed = safeExtractJson<{
      followups?: unknown;
      deeper_analysis?: unknown;
    }>(sugMatch[1].trim(), {});

    const maxF = suggestionsConfig?.max_followups ?? 4;
    const maxD = suggestionsConfig?.max_deeper_analysis ?? 4;
    const followups =
      suggestionsConfig?.followups_enabled === false
        ? []
        : normalizeSuggestionList(parsed.followups, 'fu', maxF, false);
    const deeperAnalysis =
      suggestionsConfig?.deeper_analysis_enabled === false
        ? []
        : normalizeSuggestionList(parsed.deeper_analysis, 'da', maxD, true);

    if (followups.length > 0 || deeperAnalysis.length > 0) {
      suggestions = {
        followups,
        deeper_analysis: deeperAnalysis,
      };
    }
  }

  const strippedBase = rawText
    .replace(PROFILE_CONFIRM_REGEX, '')
    .replace(SUGGESTIONS_BLOCK_REGEX, '')
    .replace(PARTIAL_PROFILE_CONFIRM_REGEX, '')
    .replace(PARTIAL_SUGGESTIONS_REGEX, '');

  const { mainText: cleanText, techBreakdown } = extractTechBreakdown(strippedBase);

  return { cleanText, techBreakdown, pendingProfile, suggestions };
}

export function extractPendingProfileConfirmation(rawText: string): {
  cleanText: string;
  pendingProfile: PendingBirthProfileDraft | null;
} {
  const { cleanText, pendingProfile } = extractHiddenDirectives(rawText);
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
  userPrompt: string;
  historyMessages: StreamConsultationParams['historyMessages'];
  technicalDirective?: string | null;
  suggestionsConfig: SuggestionsConfig;
}): Promise<{ systemInstruction: string; modelOverride: string | null; wantsSuggestions: boolean }> {
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

  const isWesternOrModern =
    params.expertSlug === 'western_astrologer' || params.expertSlug === 'modern_astrologer';
  const isTarot = params.expertSlug === 'tarot_reader';
  const isNumerology = params.expertSlug === 'numerologist';

  if (params.toneMode === 'friendly') {
    sections.push(
      `COMMUNICATION DEPTH — FRIENDLY MODE (NON-TECHNICAL): Perform all analytical synthesis silently behind the scenes, then explain your answer in warm, clear, everyday conversational language. Avoid overwhelming technical jargon, raw planetary degrees, Nakshatra pada math, or dense chains unless the user explicitly asks to see the technical breakdown. Translate factors directly into relatable life guidance and clear calendar timing windows.`
    );
  } else if (isWesternOrModern) {
    sections.push(
      `COMMUNICATION DEPTH — TECHNICAL MODE: Include authentic Tropical Western technical precision—citing exact Tropical sign placements, degrees, house cusps, tight Ptolemaic aspect orbs, elemental/modal balance, and transit timing cycles.`
    );
  } else if (!isTarot && !isNumerology) {
    sections.push(
      `COMMUNICATION DEPTH — TECHNICAL MODE: Include authentic Jyotish technical precision—citing exact Rashi placements, house lordships, planetary strengths/Shadbala/Ashtakavarga, Nakshatra & KP Sub-Lord significators, divisional Vargas (D9/D10), and active Vimshottari Mahadasha–Antardasha–Pratyantardasha mechanics.`
    );
  }

  if (params.responseLength === 'short') {
    sections.push(
      `RESPONSE LENGTH — SHORT: Keep the answer crisp, high-signal, and concise (around 120–200 words max). Lead with the direct conclusion upfront, give the top 2–3 key insights or timing dates, and skip unnecessary filler or lengthy preambles.`
    );
    if (!isTarot && !isNumerology && params.modeType !== 'learn_astrology') {
      sections.push(
        buildShortReplyBreakdownInstruction(
          params.toneMode === 'friendly' ? 'beginner' : 'guided_bridge',
          params.languageSlug
        )
      );
    }
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

  const currentLocationLabel = params.profile
    ? [params.profile.current_city, params.profile.current_state, params.profile.current_country]
        .filter((s) => typeof s === 'string' && s.trim().length > 0)
        .join(', ')
    : '';

  // Discipline-specific deterministic engines & profile context injection
  if (isTarot) {
    const drawnSpread = drawTarotSpread(params.userPrompt);
    sections.push(formatTarotSpreadContext(drawnSpread));
    if (params.profile) {
      sections.push(
        `OPTIONAL PROFILE CONTEXT (Background Only): Reading for ${params.profile.name}${
          currentLocationLabel ? ` (currently in ${currentLocationLabel})` : ''
        }. Keep the Tarot cards as the primary lens.`
      );
    }
  } else if (isNumerology) {
    let targetName = params.profile?.name || '';
    let targetDob = params.profile?.birth_date || '';
    if (!targetName || !targetDob) {
      const combinedRecentUserText = [
        ...params.historyMessages
          .filter((m) => m.role === 'user')
          .slice(-4)
          .map((m) => m.content),
        params.userPrompt,
      ].join('\n');
      const extracted = extractNumerologyHintsFromPrompt(combinedRecentUserText);
      if (!targetName && extracted.name) targetName = extracted.name;
      if (!targetDob && extracted.birthDate) targetDob = extracted.birthDate;
    }

    const numerologyBlock = formatPythagoreanNumerologyContext({
      fullName: targetName,
      birthDate: targetDob,
    });
    if (numerologyBlock) {
      sections.push(numerologyBlock);
    } else {
      sections.push(
        `NUMEROLOGY SCOPE: No birth profile or personal name/birth date has been provided yet. Answer general numerology questions directly; if the user wants a personal chart reading, warmly ask for their full name and date of birth.`
      );
    }
  } else if (isWesternOrModern) {
    if (params.profile) {
      const tropicalBlock = formatTropicalWesternContext({
        chartJson: params.profile.chart_json,
        birthDate: params.profile.birth_date,
        profileName: params.profile.name,
        currentLocationLabel: currentLocationLabel || null,
      });
      if (tropicalBlock) {
        sections.push(tropicalBlock);
      } else {
        sections.push(
          `SELECTED PROFILE: Name: ${params.profile.name} | Born: ${params.profile.birth_date} ${params.profile.birth_time} in ${params.profile.birth_city}, ${params.profile.birth_country}.${
            currentLocationLabel ? ` | Currently lives in: ${currentLocationLabel}.` : ''
          }\nNote: Full Tropical chart coordinates are being prepared. Do not guess exact planetary degrees or Rising sign if the Tropical chart block is absent.`
        );
      }
    } else {
      sections.push(
        `SESSION SCOPE: GENERAL WESTERN / MODERN ASTROLOGY (No birth chart attached yet).`
      );
    }
  } else {
    // Vedic Astrologer (default Council guide) & legacy analysis modes
    if (params.profile) {
      const richVedicContext =
        params.profile.chart_text_context?.startsWith('VERIFIED CANONICAL VEDIC CHART JSON:')
          ? params.profile.chart_text_context
          : params.profile.chart_json
          ? formatChartForLLM(params.profile.chart_json, 'vedic')
          : params.profile.chart_text_context;

      if (richVedicContext) {
        sections.push(
          `ACTIVE NATAL CHART CONTEXT (VERIFIED EPHEMERIS):\n${richVedicContext}${
            currentLocationLabel
              ? `\n\nCURRENT RESIDENCE / LOCATION: ${currentLocationLabel} (Note for relocation, foreign settlement, travel, and local transit timing context).`
              : ''
          }`
        );
      } else {
        sections.push(`SELECTED PROFILE:
Name: ${params.profile.name} | Born: ${params.profile.birth_date} ${params.profile.birth_time} in ${params.profile.birth_city}, ${params.profile.birth_country}.${
          currentLocationLabel ? ` | Currently lives in: ${currentLocationLabel}.` : ''
        }
Note: Full planetary ephemeris data is being prepared for this profile. Do not guess exact planetary degrees or Dashas if ephemeris context is absent.`);
      }
    } else {
      sections.push(`SESSION SCOPE: GENERAL / LEARN ASTROLOGY (No primary natal chart attached yet).`);
    }
  }

  // Birth-chart natural intake helper applies ONLY to Astrology guides when no profile is attached
  if (
    !params.profile &&
    !isTarot &&
    !isNumerology &&
    params.modeType !== 'learn_astrology' &&
    chatbotConfig.features.auto_intake !== false
  ) {
    sections.push(`CONVERSATIONAL BIRTH CHART INTAKE (WHEN NO CHART IS ATTACHED):
- If the user asks a general astrology question (concepts, transits, meanings), answer it directly and helpfully without demanding birth details.
- If the user asks for a personal reading or shares someone's birth details in natural language (for example: "Hey I need a reading about Sam, born on 11th July 2001"), NEVER invent or guess Lagna/Rising, Moon sign, planetary degrees, or Dashas from memory.
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

  if (params.extraProfiles && params.extraProfiles.length > 0) {
    const extraBlocks = params.extraProfiles.map((ep, idx) => {
      if (isWesternOrModern && ep.chart_json) {
        const extraTrop = formatTropicalWesternContext({
          chartJson: ep.chart_json,
          birthDate: ep.birth_date,
          profileName: ep.name,
        });
        if (extraTrop) return `ADDITIONAL ATTACHED CHART #${idx + 1}:\n${extraTrop}`;
      }
      if (ep.chart_text_context) {
        return `ADDITIONAL ATTACHED CHART #${idx + 1} (${ep.name}):\n${ep.chart_text_context}`;
      }
      return `ADDITIONAL ATTACHED PROFILE #${idx + 1}: Name: ${ep.name} | Born: ${ep.birth_date} ${ep.birth_time} in ${ep.birth_city}, ${ep.birth_country}.`;
    });
    sections.push(extraBlocks.join('\n\n'));
  }

  // Private Deeper Analysis Technical Directive (when user clicked/inserted a Deeper analysis suggestion)
  if (params.technicalDirective?.trim()) {
    sections.push(
      `INTERNAL DEEPER ANALYSIS DIRECTIVE FOR THIS TURN (EXECUTE THOROUGHLY; NEVER QUOTE OR MENTION THIS INTERNAL LABEL TO THE USER):
${params.technicalDirective.trim()}
Perform this exact technical verification transparently using the verified chart/spread/numerology context above, show what confirms or modifies the initial reading, and translate the verdict into calm, clear practical guidance.`
    );
  }

  // Single-turn Two-Tier Suggestions Output Contract (Admin-governed rules)
  const wantsSuggestions =
    chatbotConfig.features.followups !== false &&
    (params.suggestionsConfig.followups_enabled ||
      params.suggestionsConfig.deeper_analysis_enabled);

  if (wantsSuggestions) {
    const fCount = params.suggestionsConfig.followups_enabled
      ? Math.max(1, Math.min(6, params.suggestionsConfig.max_followups || 4))
      : 0;
    const dCount = params.suggestionsConfig.deeper_analysis_enabled
      ? Math.max(1, Math.min(6, params.suggestionsConfig.max_deeper_analysis || 4))
      : 0;

    const tierRuleBlocks: string[] = [];
    if (fCount > 0) {
      tierRuleBlocks.push(
        `Generate ${Math.min(3, fCount)} to ${fCount} items in "followups":\n${params.suggestionsConfig.followups_rules}`
      );
    }
    if (dCount > 0) {
      tierRuleBlocks.push(
        `Generate ${Math.min(3, dCount)} to ${dCount} items in "deeper_analysis":\n${params.suggestionsConfig.deeper_analysis_rules}`
      );
    }

    sections.push(`STRUCTURED NEXT-STEP SUGGESTIONS BLOCK (APPEND AT THE VERY END OF YOUR RESPONSE):
After finishing your main reply — UNLESS you are outputting <CC_PROFILE_CONFIRM> to confirm birth details — append ONE single compact JSON line wrapped in exact delimiters (never inside markdown code fences, and never mention this block in prose):
<<<SUGGESTIONS_JSON>>>{"followups":${fCount > 0 ? '[{"text":"..."}]' : '[]'},"deeper_analysis":${dCount > 0 ? '[{"text":"...","technical_directive":"..."}]' : '[]'}}<<<END_SUGGESTIONS_JSON>>>

${tierRuleBlocks.join('\n\n')}

Keep the JSON strictly valid UTF-8 single-line JSON with double quotes and no trailing commas.`);
  }

  return {
    systemInstruction: sections.join('\n\n---\n\n'),
    modelOverride,
    wantsSuggestions,
  };
}

export async function streamConsultationResponse(
  params: StreamConsultationParams
): Promise<StreamConsultationResult> {
  const [runtime, pricingConfig, suggestionsConfig] = await Promise.all([
    getResolvedOpenRouterRuntime(),
    getPricingConfig(),
    getSuggestionsConfig(),
  ]);

  const activePillar: ChatPillar =
    params.pillar ||
    params.conversation.pillar ||
    'council';
  const activeCompanionPersona =
    params.companionPersona || params.conversation.companion_persona_json || null;

  const toneMode = params.toneMode === 'friendly' ? 'friendly' : 'technical';
  const responseLength = params.responseLength === 'short' ? 'short' : 'detailed';
  const activeHistory = params.historyMessages.filter((m) => !m.excluded_from_context);
  const maxHistoryTurns = runtime.tokenLimits.max_history_turns || 24;

  const historyOpenRouterMessages: OpenRouterMessage[] = activeHistory
    .slice(-maxHistoryTurns)
    .map((m) => ({
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

  // =========================================================================
  // SUTRADHARA STAGE 2 -> STAGE 3 DUAL SYNTHESIS (Vedic Council Reading Path)
  // Keeps Companion, Clarity, Tarot, Numerology, Western/Modern,
  // learn_astrology, report_followup, attachments, & birth intake isolated.
  // =========================================================================
  const isVedicCouncilSutradharaTurn =
    activePillar === 'council' &&
    params.expertSlug !== 'western_astrologer' &&
    params.expertSlug !== 'modern_astrologer' &&
    params.expertSlug !== 'tarot_reader' &&
    params.expertSlug !== 'numerologist' &&
    params.modeSlug !== 'learn_astrology' &&
    params.conversation.mode_type !== 'learn_astrology' &&
    params.conversation.mode_type !== 'report_followup' &&
    (!params.attachments || params.attachments.length === 0) &&
    Boolean(params.profile?.chart_json);

  if (isVedicCouncilSutradharaTurn && params.profile?.chart_json) {
    const [chatbotConfig, activeModeRecipe] = await Promise.all([
      getChatbotConfig(),
      getActiveRecipeForTarget('mode', params.modeSlug),
    ]);

    const recipeSteps = activeModeRecipe
      ? (activeModeRecipe.steps_json || []).filter((s) => s && s.enabled !== false && s.prompt_slug)
      : [];
    const slugsToResolve = Array.from(
      new Set([params.expertSlug, ...recipeSteps.map((s) => s.prompt_slug)])
    );

    const [{ bodies: promptBodies, models: promptModels }, dailyTransitData, resolvedDecision] =
      await Promise.all([
        resolvePromptModules(slugsToResolve),
        (async (): Promise<{ slice: DailyTransitSliceInput | null; feedText: string | null }> => {
          if (params.dailyTransitsOverride) {
            return { slice: params.dailyTransitsOverride, feedText: null };
          }
          if (!isAstrologyApiConfigured()) {
            return { slice: null, feedText: null };
          }
          try {
            const daily = await getOrFetchDailyTransits();
            return {
              slice: {
                transitDate: daily.transitDate,
                planets: daily.planets,
                slowTransitPairs: daily.slowTransitPairs,
              },
              feedText: daily.transitsText,
            };
          } catch {
            return { slice: null, feedText: null };
          }
        })(),
        params.stage1Decision
          ? Promise.resolve(params.stage1Decision)
          : evaluateStage1Routing({
              userPrompt: params.userPrompt,
              lifeContext: params.profile.life_context_json || null,
              profileName: params.profile.name,
              hasPrimaryProfile: true,
              extraProfilesCount: params.extraProfiles?.length || 0,
              modeSlug: params.modeSlug,
              isFollowUpTurn: activeHistory.some((m) => m.role === 'user'),
              bypassClarification: true,
              technicalDirective: params.technicalDirective,
            }),
      ]);

    const sutraModelOverride =
      activeModeRecipe?.model_id || promptModels[params.expertSlug] || null;
    const sutraModel = sutraModelOverride || runtime.consultationModel || getConsultationModel();

    const modeRecipeBlocks: string[] = [];
    for (const step of recipeSteps) {
      const body =
        typeof step.inline_override === 'string' && step.inline_override.trim()
          ? step.inline_override.trim()
          : promptBodies[step.prompt_slug];
      if (body) modeRecipeBlocks.push(body);
    }

    const extraSlices: ExtraProfileSliceInput[] = (params.extraProfiles || [])
      .filter((ep): ep is ConsultationProfileRecord & { chart_json: CompiledChartData } =>
        Boolean(ep.chart_json)
      )
      .map((ep) => ({
        label: ep.name,
        chart: ep.chart_json,
        dossier: ep.natal_truth_dossier_json || null,
      }));

    const stage2Pkg = await compileStage2ContextPackage({
      routerResult: resolvedDecision.routerResult,
      playbook: resolvedDecision.playbook,
      chart: params.profile.chart_json,
      dossier: params.profile.natal_truth_dossier_json || null,
      lifeContext: params.profile.life_context_json || null,
      dailyTransits: dailyTransitData.slice,
      extraProfiles: extraSlices,
      contextTrapPromptNote: resolvedDecision.contextTrapPromptNote || null,
    });

    const sutraBaseTokens =
      responseLength === 'short'
        ? Math.max(runtime.tokenLimits.chat_short + 350, 900)
        : runtime.tokenLimits.chat_detailed;

    const currentLocationLabel = [
      params.profile.current_city,
      params.profile.current_state,
      params.profile.current_country,
    ]
      .filter((s) => typeof s === 'string' && s.trim().length > 0)
      .join(', ');
    const gocharWithLocation = [
      dailyTransitData.feedText || '',
      currentLocationLabel
        ? `CURRENT RESIDENCE / LOCATION: ${currentLocationLabel} (Note for relocation and local timing context).`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const memoryText =
      params.conversation.use_full_profile_memory && params.profile.profile_memory_summary
        ? params.profile.profile_memory_summary
        : null;

    // Path B: Explicit 4-Lens Parallel Deep Council Audit + Adjudicator
    if (params.deepAudit) {
      const deepRes = await runDeepCouncilAudit({
        model: sutraModel,
        constitutionPrompt: CORE_COUNCIL_CONSTITUTION,
        conversationalRules: chatbotConfig.conversational_rules,
        expertDirective: promptBodies[params.expertSlug] || '',
        modeRecipeBlocks,
        pkg: stage2Pkg,
        chart: params.profile.chart_json,
        routerFluency: resolvedDecision.routerResult.detected_user_fluency,
        toneMode,
        responseLength,
        outputSlug: params.outputSlug,
        languageSlug: params.languageSlug,
        voicePreset: params.voicePreset,
        gocharFeedText: gocharWithLocation || null,
        profileMemorySummary: memoryText,
        preferredCallName: params.preferredCallName,
        turnCount: activeHistory.length,
        historyMessages: historyOpenRouterMessages,
        finalUserText,
        technicalDirective: params.technicalDirective,
        priorInferredFluency: params.userPriorFluency,
        maxOutputTokens: sutraBaseTokens,
        abortSignal: params.abortSignal,
        onChunk: params.onChunk,
      });

      const deepCreditsCharged = deepRes.leakIntercepted
        ? 0
        : calculateCreditsFromUsage(deepRes.tokensIn, deepRes.tokensOut, deepRes.fullText, {
            ...pricingConfig.chat_billing,
            min_credits_per_reply: Math.max(
              pricingConfig.chat_billing.min_credits_per_reply * 2,
              50
            ),
            max_credits_per_reply: pricingConfig.chat_billing.max_credits_per_reply * 2,
          });

      return {
        fullText: deepRes.fullText,
        techBreakdown: deepRes.techBreakdown || null,
        tokensIn: deepRes.tokensIn,
        tokensOut: deepRes.tokensOut,
        creditsCharged: deepCreditsCharged,
        aborted: deepRes.aborted,
        leakIntercepted: deepRes.leakIntercepted,
        pendingProfile: null,
        suggestions: null,
        sutraMeta: deepRes.meta,
        stage2Pkg,
      };
    }

    // Path A: Fast Focused Stage 3 Synthesis
    const pathAPrompt = buildSutraPathAPrompt({
      constitutionPrompt: CORE_COUNCIL_CONSTITUTION,
      conversationalRules: chatbotConfig.conversational_rules,
      expertDirective: promptBodies[params.expertSlug] || '',
      modeRecipeBlocks,
      pkg: stage2Pkg,
      chart: params.profile.chart_json,
      routerFluency: resolvedDecision.routerResult.detected_user_fluency,
      toneMode,
      responseLength,
      outputSlug: params.outputSlug,
      languageSlug: params.languageSlug,
      voicePreset: params.voicePreset,
      gocharFeedText: gocharWithLocation || null,
      profileMemorySummary: memoryText,
      preferredCallName: params.preferredCallName,
      turnCount: activeHistory.length,
      technicalDirective: params.technicalDirective,
      priorInferredFluency: params.userPriorFluency,
    });

    const pathAAbortController = new AbortController();
    const forwardPathAAbort = () => pathAAbortController.abort();
    if (params.abortSignal.aborted) {
      pathAAbortController.abort();
    } else {
      params.abortSignal.addEventListener('abort', forwardPathAAbort, { once: true });
    }

    let rawAccumulated = '';
    let flushedLength = 0;
    let leakIntercepted = false;
    let hiddenBreakdownHoldStarted = false;
    const HOLD_BACK_CHARS = 72;

    try {
      const streamResult = await streamOpenRouterCompletion({
        model: sutraModel,
        system: pathAPrompt.systemInstruction,
        messages: [
          ...historyOpenRouterMessages,
          { role: 'user', content: finalUserText },
        ],
        maxTokens: sutraBaseTokens,
        abortSignal: pathAAbortController.signal,
        onChunk: (chunkText) => {
          if (leakIntercepted) return;
          rawAccumulated += chunkText;
          if (containsInternalPromptLeak(rawAccumulated)) {
            leakIntercepted = true;
            pathAAbortController.abort();
            return;
          }
          if (hiddenBreakdownHoldStarted) return;

          const breakdownIdx = rawAccumulated.search(/<<<TECH_BREAKDOWN/i);
          if (breakdownIdx !== -1) {
            if (breakdownIdx > flushedLength) {
              const beforeTag = sanitizeSutraProse(
                rawAccumulated.slice(flushedLength, breakdownIdx).replace(/\s+$/, '')
              );
              if (beforeTag) params.onChunk(beforeTag);
              flushedLength = breakdownIdx;
            }
            hiddenBreakdownHoldStarted = true;
            return;
          }

          let safeEnd = rawAccumulated.length - HOLD_BACK_CHARS;
          if (safeEnd > flushedLength) {
            const tentative = rawAccumulated.slice(flushedLength, safeEnd);
            const trailingMatch = /\b(?:the|a)(?:\s+native['’]?s?)?$/i.exec(tentative);
            if (trailingMatch) {
              safeEnd -= trailingMatch[0].length;
            }
            if (safeEnd > flushedLength) {
              const toEmit = sanitizeSutraProse(rawAccumulated.slice(flushedLength, safeEnd));
              flushedLength = safeEnd;
              if (toEmit) params.onChunk(toEmit);
            }
          }
        },
      });

      if (leakIntercepted || containsInternalPromptLeak(streamResult.fullText)) {
        return {
          fullText: PROMPT_EXTRACTION_REFUSAL,
          techBreakdown: null,
          tokensIn: streamResult.tokensIn,
          tokensOut: streamResult.tokensOut,
          creditsCharged: 0,
          aborted: false,
          leakIntercepted: true,
          pendingProfile: null,
          suggestions: null,
          sutraMeta: pathAPrompt.meta,
        };
      }

      const extractedAccumulated = extractTechBreakdown(rawAccumulated);
      if (!hiddenBreakdownHoldStarted && extractedAccumulated.mainText.length > flushedLength) {
        const remaining = sanitizeSutraProse(extractedAccumulated.mainText.slice(flushedLength));
        flushedLength = extractedAccumulated.mainText.length;
        if (remaining) params.onChunk(remaining);
      }

      const extractedFinal = extractTechBreakdown(streamResult.fullText.trim());
      const sanitized = sanitizeAssistantOutput(extractedFinal.mainText);
      if (sanitized.leaked) {
        return {
          fullText: sanitized.text,
          techBreakdown: null,
          tokensIn: streamResult.tokensIn,
          tokensOut: streamResult.tokensOut,
          creditsCharged: 0,
          aborted: false,
          leakIntercepted: true,
          pendingProfile: null,
          suggestions: null,
          sutraMeta: pathAPrompt.meta,
        };
      }

      let safeBreakdown: string | null = null;
      if (extractedFinal.techBreakdown) {
        const bdSanitized = sanitizeAssistantOutput(extractedFinal.techBreakdown);
        if (!bdSanitized.leaked && bdSanitized.text.trim()) {
          safeBreakdown = bdSanitized.text.trim();
        }
      }

      const creditsCharged = calculateCreditsFromUsage(
        streamResult.tokensIn,
        streamResult.tokensOut,
        sanitized.text,
        pricingConfig.chat_billing
      );

      return {
        fullText: sanitized.text,
        techBreakdown: safeBreakdown,
        tokensIn: streamResult.tokensIn,
        tokensOut: streamResult.tokensOut,
        creditsCharged,
        aborted: streamResult.aborted && !leakIntercepted,
        leakIntercepted: false,
        pendingProfile: null,
        suggestions: null,
        sutraMeta: pathAPrompt.meta,
        stage2Pkg,
      };
    } finally {
      params.abortSignal.removeEventListener('abort', forwardPathAAbort);
    }
  }

  let systemInstructionWithDynamic = '';
  let modelOverride: string | null = null;
  let wantsSuggestions = false;

  if (activePillar === 'companion') {
    systemInstructionWithDynamic = buildCompanionSystemPrompt({
      persona: activeCompanionPersona,
      languageSlug: params.languageSlug,
      preferredCallName: params.preferredCallName,
      turnCount: activeHistory.length,
      memorySnippets: params.conversation.use_full_profile_memory
        ? params.scopeMemoryContext
        : null,
    });
    wantsSuggestions = false;
  } else if (activePillar === 'clarity') {
    systemInstructionWithDynamic = buildClaritySystemPrompt({
      languageSlug: params.languageSlug,
      preferredCallName: params.preferredCallName,
      turnCount: activeHistory.length,
      memorySnippets: params.conversation.use_full_profile_memory
        ? params.scopeMemoryContext
        : null,
    });
    wantsSuggestions = false;
  } else {
    const built = await buildStaticSystemInstruction({
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
      userPrompt: params.userPrompt,
      historyMessages: activeHistory,
      technicalDirective: params.technicalDirective,
      suggestionsConfig,
    });
    modelOverride = built.modelOverride;
    wantsSuggestions = built.wantsSuggestions;

    // Fetch today's cached Gochar transits (max 1 API call/day across platform) for Astrology guides
    let gocharContext = '';
    const needsTransits =
      params.expertSlug !== 'tarot_reader' && params.expertSlug !== 'numerologist';
    if (needsTransits && isAstrologyApiConfigured()) {
      try {
        const daily = await getOrFetchDailyTransits();
        gocharContext =
          params.expertSlug === 'western_astrologer' || params.expertSlug === 'modern_astrologer'
            ? daily.westernTransitsText
            : daily.transitsText;
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

    systemInstructionWithDynamic = [
      built.systemInstruction,
      ...dynamicContextBlocks,
    ]
      .filter(Boolean)
      .join('\n\n---\n\n');
  }

  const model = modelOverride || runtime.consultationModel || getConsultationModel();
  const baseOutputTokens =
    activePillar === 'companion'
      ? Math.min(runtime.tokenLimits.chat_detailed, 1100)
      : activePillar === 'clarity'
      ? Math.min(runtime.tokenLimits.chat_detailed, 1400)
      : responseLength === 'short'
      ? Math.max(runtime.tokenLimits.chat_short + 350, 900)
      : runtime.tokenLimits.chat_detailed;
  // Reserve headroom for compact single-turn suggestions JSON so prose is never clipped
  const maxOutputTokens = wantsSuggestions ? baseOutputTokens + 420 : baseOutputTokens;

  // Filter out messages excluded from context (already filtered above)
  const messages: OpenRouterMessage[] = [...historyOpenRouterMessages];

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
  let hiddenBlockHoldStarted = false;
  const HOLD_BACK_CHARS = 72;

  const findEarliestHiddenTagIndex = (text: string): number => {
    const indices = [
      text.search(/<CC_PROFILE_CONFIRM/i),
      text.search(/<<<SUGGESTIONS/i),
      text.search(/<<<TECH_BREAKDOWN/i),
    ].filter((idx) => idx !== -1);
    return indices.length > 0 ? Math.min(...indices) : -1;
  };

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
        if (hiddenBlockHoldStarted) return;

        const tagIndex = findEarliestHiddenTagIndex(rawAccumulated);
        if (tagIndex !== -1) {
          if (tagIndex > flushedLength) {
            const beforeTag = sanitizeSutraProse(
              rawAccumulated.slice(flushedLength, tagIndex).replace(/\s+$/, '')
            );
            if (beforeTag) {
              params.onChunk(beforeTag);
            }
            flushedLength = tagIndex;
          }
          hiddenBlockHoldStarted = true;
          return;
        }

        let safeEnd = rawAccumulated.length - HOLD_BACK_CHARS;
        if (safeEnd > flushedLength) {
          const tentative = rawAccumulated.slice(flushedLength, safeEnd);
          const trailingMatch = /\b(?:the|a)(?:\s+native['’]?s?)?$/i.exec(tentative);
          if (trailingMatch) {
            safeEnd -= trailingMatch[0].length;
          }
          if (safeEnd > flushedLength) {
            const toEmit = sanitizeSutraProse(rawAccumulated.slice(flushedLength, safeEnd));
            flushedLength = safeEnd;
            if (toEmit) params.onChunk(toEmit);
          }
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
        suggestions: null,
      };
    }

    const extractedFromAccumulated = extractHiddenDirectives(rawAccumulated, suggestionsConfig);
    if (!hiddenBlockHoldStarted && extractedFromAccumulated.cleanText.length > flushedLength) {
      params.onChunk(sanitizeSutraProse(extractedFromAccumulated.cleanText.slice(flushedLength)));
      flushedLength = extractedFromAccumulated.cleanText.length;
    }

    const extractedFinal = extractHiddenDirectives(streamResult.fullText, suggestionsConfig);
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
        suggestions: null,
      };
    }

    const creditsCharged = calculateCreditsFromUsage(
      streamResult.tokensIn,
      streamResult.tokensOut,
      sanitized.text,
      pricingConfig.chat_billing
    );

    let safeLegacyBreakdown: string | null = null;
    if (!streamResult.aborted && extractedFinal.techBreakdown) {
      const bdSanitized = sanitizeAssistantOutput(extractedFinal.techBreakdown);
      if (!bdSanitized.leaked && bdSanitized.text.trim()) {
        safeLegacyBreakdown = bdSanitized.text.trim();
      }
    }

    return {
      fullText: sanitized.text,
      techBreakdown: safeLegacyBreakdown,
      tokensIn: streamResult.tokensIn,
      tokensOut: streamResult.tokensOut,
      creditsCharged,
      aborted: streamResult.aborted && !leakIntercepted,
      leakIntercepted: false,
      pendingProfile: streamResult.aborted ? null : extractedFinal.pendingProfile,
      suggestions: streamResult.aborted ? null : extractedFinal.suggestions,
    };
  } finally {
    params.abortSignal.removeEventListener('abort', forwardAbort);
  }
}

export async function generateStructuredSuggestions(params: {
  userQuestion: string;
  assistantAnswer: string;
  expertSlug: string;
  modeSlug: string;
  languageSlug: string;
  hasProfile: boolean;
}): Promise<MessageSuggestions> {
  try {
    const [chatbotConfig, suggestionsConfig, runtime] = await Promise.all([
      getChatbotConfig(),
      getSuggestionsConfig(),
      getResolvedOpenRouterRuntime(),
    ]);

    if (
      chatbotConfig.features.followups === false ||
      (!suggestionsConfig.followups_enabled && !suggestionsConfig.deeper_analysis_enabled)
    ) {
      return { followups: [], deeper_analysis: [] };
    }

    const maxF = suggestionsConfig.followups_enabled
      ? Math.max(1, Math.min(6, suggestionsConfig.max_followups || 4))
      : 0;
    const maxD = suggestionsConfig.deeper_analysis_enabled
      ? Math.max(1, Math.min(6, suggestionsConfig.max_deeper_analysis || 4))
      : 0;

    const completion = await createOpenRouterCompletion({
      model: runtime.utilityModel || getUtilityModel(),
      maxTokens: Math.max(600, runtime.tokenLimits.utility),
      jsonMode: true,
      temperature: 0.45,
      messages: [
        {
          role: 'user',
          content: `Generate structured two-tier suggestions for this Cosmic Council consultation exchange.
Active Council Guide: ${params.expertSlug}
Topic Mode: ${params.modeSlug}
Language: ${params.languageSlug}
Chart Attached: ${params.hasProfile ? 'Yes' : 'No'}

${maxF > 0 ? `TIER 1 — "followups" (${Math.min(3, maxF)}–${maxF} items):\n${suggestionsConfig.followups_rules}\n` : ''}
${maxD > 0 ? `TIER 2 — "deeper_analysis" (${Math.min(3, maxD)}–${maxD} items):\n${suggestionsConfig.deeper_analysis_rules}\n` : ''}

Return STRICTLY JSON with shape:
{
  "followups": ${maxF > 0 ? '[{ "text": "..." }]' : '[]'},
  "deeper_analysis": ${maxD > 0 ? '[{ "text": "...", "technical_directive": "..." }]' : '[]'}
}

USER QUESTION:
${params.userQuestion.slice(0, 600)}

COUNCIL ANSWER EXCERPT:
${params.assistantAnswer.slice(0, 1800)}`,
        },
      ],
    });

    const parsed = safeExtractJson<{
      followups?: unknown;
      deeper_analysis?: unknown;
    }>(completion.text, {});

    return {
      followups:
        maxF > 0 ? normalizeSuggestionList(parsed.followups, 'fu', maxF, false) : [],
      deeper_analysis:
        maxD > 0 ? normalizeSuggestionList(parsed.deeper_analysis, 'da', maxD, true) : [],
    };
  } catch {
    return { followups: [], deeper_analysis: [] };
  }
}

export async function generateMoreStructuredSuggestions(params: {
  userQuestion: string;
  assistantAnswer: string;
  expertSlug: string;
  modeSlug: string;
  languageSlug: string;
  hasProfile: boolean;
  existingTexts: string[];
  count?: number;
}): Promise<MessageSuggestions> {
  try {
    const [chatbotConfig, suggestionsConfig, runtime] = await Promise.all([
      getChatbotConfig(),
      getSuggestionsConfig(),
      getResolvedOpenRouterRuntime(),
    ]);

    if (
      chatbotConfig.features.followups === false ||
      (!suggestionsConfig.followups_enabled && !suggestionsConfig.deeper_analysis_enabled)
    ) {
      return { followups: [], deeper_analysis: [] };
    }

    const totalTarget = Math.max(2, Math.min(12, params.count || 8));
    const bothEnabled =
      suggestionsConfig.followups_enabled && suggestionsConfig.deeper_analysis_enabled;
    const countF = bothEnabled
      ? Math.ceil(totalTarget / 2)
      : suggestionsConfig.followups_enabled
      ? totalTarget
      : 0;
    const countD = bothEnabled
      ? Math.floor(totalTarget / 2)
      : suggestionsConfig.deeper_analysis_enabled
      ? totalTarget
      : 0;

    const existingListBlock = params.existingTexts
      .slice(0, 24)
      .map((t, i) => `${i + 1}. ${t}`)
      .join('\n');

    const completion = await createOpenRouterCompletion({
      model: runtime.utilityModel || getUtilityModel(),
      maxTokens: Math.max(950, runtime.tokenLimits.utility),
      jsonMode: true,
      temperature: 0.65,
      messages: [
        {
          role: 'user',
          content: `Generate ${totalTarget} BRAND-NEW structured suggestions for this Cosmic Council consultation exchange.
Active Council Guide: ${params.expertSlug}
Topic Mode: ${params.modeSlug}
Language: ${params.languageSlug}
Chart Attached: ${params.hasProfile ? 'Yes' : 'No'}

${countF > 0 ? `TIER 1 — "followups" (EXACTLY ${countF} new items):\n${suggestionsConfig.followups_rules}\n` : ''}
${countD > 0 ? `TIER 2 — "deeper_analysis" (EXACTLY ${countD} new items):\n${suggestionsConfig.deeper_analysis_rules}\n` : ''}

CRITICAL DEDUPLICATION RULE:
Do NOT repeat, reword, or closely overlap with any of these ALREADY SHOWN questions:
${existingListBlock || '(none yet)'}

Return STRICTLY JSON with shape:
{
  "followups": ${countF > 0 ? '[{ "text": "..." }]' : '[]'},
  "deeper_analysis": ${countD > 0 ? '[{ "text": "...", "technical_directive": "..." }]' : '[]'}
}

USER QUESTION:
${params.userQuestion.slice(0, 600)}

COUNCIL ANSWER EXCERPT:
${params.assistantAnswer.slice(0, 1800)}`,
        },
      ],
    });

    const parsed = safeExtractJson<{
      followups?: unknown;
      deeper_analysis?: unknown;
    }>(completion.text, {});

    const existingKeys = new Set(
      params.existingTexts.map((t) => t.trim().toLowerCase()).filter(Boolean)
    );

    const filterFresh = (list: SuggestionItem[]) =>
      list.filter((item) => {
        const key = item.text.trim().toLowerCase();
        if (!key || existingKeys.has(key)) return false;
        existingKeys.add(key);
        return true;
      });

    return {
      followups:
        countF > 0
          ? filterFresh(normalizeSuggestionList(parsed.followups, 'fu', countF + 2, false)).slice(0, countF)
          : [],
      deeper_analysis:
        countD > 0
          ? filterFresh(normalizeSuggestionList(parsed.deeper_analysis, 'da', countD + 2, true)).slice(0, countD)
          : [],
    };
  } catch {
    return { followups: [], deeper_analysis: [] };
  }
}

export async function generateFollowUpQuestions(params: {
  userQuestion: string;
  assistantAnswer: string;
  modeSlug: string;
  languageSlug: string;
  hasProfile: boolean;
}): Promise<string[]> {
  const structured = await generateStructuredSuggestions({
    ...params,
    expertSlug: 'council_synthesis',
  });
  return structured.followups.map((item) => item.text);
}

export async function generateConversationTitle(
  firstQuestion: string,
  profileName?: string | null,
  pillar: ChatPillar = 'council',
  companionName?: string | null
): Promise<string> {
  try {
    const runtime = await getResolvedOpenRouterRuntime();
    const subjectContext =
      pillar === 'companion'
        ? `this personal conversation${companionName ? ` with ${companionName}` : ''}`
        : pillar === 'clarity'
        ? 'this quick Clarity helper thread'
        : `this consultation thread${profileName ? ` for ${profileName}` : ''}`;

    const completion = await createOpenRouterCompletion({
      model: runtime.utilityModel || getUtilityModel(),
      maxTokens: Math.min(120, runtime.tokenLimits.utility),
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `Generate a refined 3-to-5-word title for ${subjectContext}. No quotes, no punctuation at the end, Title Case.

Message: ${firstQuestion.slice(0, 400)}`,
        },
      ],
    });
    const cleaned = completion.text.replace(/["'*#]/g, '').trim();
    if (cleaned) {
      return cleaned.slice(0, 70);
    }
    return pillar === 'companion'
      ? companionName || 'Companion Chat'
      : pillar === 'clarity'
      ? 'Clarity'
      : 'Consultation Insight';
  } catch {
    return (
      firstQuestion.trim().slice(0, 48) ||
      (pillar === 'companion'
        ? companionName || 'Companion Chat'
        : pillar === 'clarity'
        ? 'Clarity'
        : 'Consultation Insight')
    );
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
