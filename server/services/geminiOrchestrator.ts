import crypto from 'crypto';
import type {
  ChatStyle,
  CompanionChatCue,
  MessageReferralPayload,
} from '../../components/app/chatTypes';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { getOrFetchDailyTransits, isAstrologyApiConfigured } from './astrologyApi';
import { formatChartForLLM, type CompiledChartData } from './chartCompiler';
import {
  normalizeCompanionSlug,
  type CompanionPresetRecord,
  type ResolvedCompanionCapabilities,
} from './companionPresets';
import {
  drawTarotSpread,
  extractNumerologyHintsFromPrompt,
  formatPythagoreanNumerologyContext,
  formatTarotSpreadContext,
  formatTropicalWesternContext,
  type DrawnTarotSpread,
} from './divinationEngines';
import {
  applyCompanionTurnVerification,
  buildChatStyleInstruction,
  buildClaritySystemPromptAsync,
  buildCompanionSystemPromptAsync,
  resolveCompanionTemperature,
  type ChatPillar,
  type CompanionDiagnosticTelemetry,
  type CompanionPersona,
  type ReferrableCompanionSummary,
} from './companionEngine';
import { capTelemetryPreview, isPipelineLoggingEnabled } from './pipelineLogger';
import type { CompanionVerificationMode } from '../../lib/companionV2Schema';
import type { CompanionBondState } from './memoryArchivist';
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
  getCoreCouncilConstitutionAsync,
  getWesternCoreCouncilConstitutionAsync,
  resolvePromptModules,
} from './promptDefaults';
import {
  getActiveRecipeForTarget,
  getEnginePromptOverrides,
  getPricingConfig,
  getResolvedGuideConfig,
  getResolvedOpenRouterRuntime,
  type ChatBillingWeights,
  type GuideSuggestionsConfig,
  type SuggestionsConfig,
} from './platformSettings';
import {
  PROMPT_EXTRACTION_REFUSAL,
  containsInternalPromptLeak,
  detectPromptExtractionAttempt,
  sanitizeAssistantOutput,
  sanitizeVedicProse,
} from './abuseGuard';
import type {
  CouncilAnalystNote,
  DeepProfileData,
  LifeContextData,
} from '../../lib/lifeContextSchema';
import { formatDeepProfileForLLM } from './lifeContextGuard';
import {
  DEFAULT_COUNCIL_EXPERT_SLUG,
  normalizeCouncilSlug,
  type TimingProgressWidget,
  type UserFluencyTier,
  type VedicSynthesisMeta,
} from '../../lib/vedicTypes';
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
  appendTurnVerificationModifier,
  buildShortReplyBreakdownInstruction,
  buildVedicPathAPrompt,
  extractTechBreakdown,
  type VedicVoicePreset,
} from './vedicAstrologerEngine';

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
  short_name?: string | null;
  is_default?: boolean;
  gender?: string | null;
  is_activated: boolean;
  has_birth_chart?: boolean;
  chart_text_context: string | null;
  chart_json?: CompiledChartData | null;
  profile_memory_summary: string | null;
  life_context_json?: LifeContextData | null;
  life_context_completeness?: number | null;
  deep_profile_json?: DeepProfileData | null;
  analyst_notes_json?: CouncilAnalystNote[] | null;
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
  companionPreset?: CompanionPresetRecord | null;
  companionBond?: CompanionBondState | null;
  companionChatMode?: CompanionChatCue | null;
  companionCrossThreadSummary?: string | null;
  councilReadingNotesText?: string | null;
  referrableCompanions?: ReferrableCompanionSummary[];
  clientLocalHour?: number | null;
  adminPreview?: boolean;
  conversation: {
    id: string;
    profile_id: string | null;
    mode_type: string;
    use_full_profile_memory: boolean;
    title: string;
    pillar?: ChatPillar;
    companion_slug?: string | null;
    companion_chat_mode?: CompanionChatCue | null;
    companion_persona_json?: CompanionPersona | null;
    thread_memory_summary?: string | null;
    thread_memory_msg_count?: number | null;
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
  voicePreset?: VedicVoicePreset;
  dailyTransitsOverride?: DailyTransitSliceInput | null;
  abortSignal: AbortSignal;
  onStatus?: (statusText: string) => void;
  onTimingWidgets?: (widgets: TimingProgressWidget[]) => void;
  onTarotSpread?: (spread: DrawnTarotSpread) => void;
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

export interface CompanionAnalyticalStageSlot {
  stage: number;
  key: string;
  label: string;
  status: 'executed' | 'skipped' | 'reserved_future';
  notes?: string;
}

export interface CompanionPipelineTelemetryPayload extends CompanionDiagnosticTelemetry {
  appliedVerificationMode?: CompanionVerificationMode | 'skipped';
  executionMode: 'single_pass';
  modelId: string;
  maxOutputTokens: number;
  systemPromptPreview?: string | null;
  analyticalStages: CompanionAnalyticalStageSlot[];
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
  referral?: MessageReferralPayload | null;
  renderStyle?: ChatStyle;
  vedicMeta?: VedicSynthesisMeta | null;
  stage2Pkg?: Stage2ContextPackage | null;
  timingWidgets?: TimingProgressWidget[];
  tarotSpread?: DrawnTarotSpread | null;
  companionTelemetry?: CompanionPipelineTelemetryPayload | null;
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
const REFERRAL_BLOCK_REGEX = /<<<REFERRAL:([\s\S]*?)>>>/i;
const PARTIAL_REFERRAL_REGEX = /<<<REFERRAL[\s\S]*$/i;

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
  >,
  referrableCompanions?: ReferrableCompanionSummary[]
): {
  cleanText: string;
  techBreakdown: string | null;
  pendingProfile: PendingBirthProfileDraft | null;
  suggestions: MessageSuggestions | null;
  referral: MessageReferralPayload | null;
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

  let referral: MessageReferralPayload | null = null;
  const refMatch = REFERRAL_BLOCK_REGEX.exec(rawText);
  if (refMatch && refMatch[1]) {
    const parsed = safeExtractJson<{
      slug?: unknown;
      name?: unknown;
      reason?: unknown;
    }>(refMatch[1].trim(), {});
    const normalizedSlug = normalizeCompanionSlug(
      typeof parsed.slug === 'string' ? parsed.slug : ''
    );
    if (normalizedSlug) {
      const matched =
        referrableCompanions?.find((c) => c.slug.toLowerCase() === normalizedSlug) || null;
      if (!referrableCompanions || referrableCompanions.length === 0 || matched) {
        referral = {
          slug: matched ? matched.slug : normalizedSlug,
          name:
            matched?.name ||
            (typeof parsed.name === 'string' && parsed.name.trim()
              ? parsed.name.trim().slice(0, 60)
              : normalizedSlug),
          reason:
            typeof parsed.reason === 'string' && parsed.reason.trim()
              ? parsed.reason.trim().slice(0, 220)
              : undefined,
        };
      }
    }
  }

  const strippedBase = rawText
    .replace(PROFILE_CONFIRM_REGEX, '')
    .replace(SUGGESTIONS_BLOCK_REGEX, '')
    .replace(REFERRAL_BLOCK_REGEX, '')
    .replace(PARTIAL_PROFILE_CONFIRM_REGEX, '')
    .replace(PARTIAL_SUGGESTIONS_REGEX, '')
    .replace(PARTIAL_REFERRAL_REGEX, '')
    .trimEnd();

  const { mainText: cleanText, techBreakdown } = extractTechBreakdown(strippedBase);

  return { cleanText, techBreakdown, pendingProfile, suggestions, referral };
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
}): Promise<{
  systemInstruction: string;
  modelOverride: string | null;
  wantsSuggestions: boolean;
  resolvedSuggestions: GuideSuggestionsConfig;
  chatStyle: ChatStyle;
  tarotSpread?: DrawnTarotSpread | null;
}> {
  const [guideCfg, coreConstitution, activeModeRecipe] = await Promise.all([
    getResolvedGuideConfig(params.expertSlug),
    getCoreCouncilConstitutionAsync(),
    getActiveRecipeForTarget('mode', params.modeSlug),
  ]);

  const recipeSteps = activeModeRecipe
    ? (activeModeRecipe.steps_json || []).filter((s) => s && s.enabled !== false && s.prompt_slug)
    : [];
  const isLearnAstrology =
    params.expertSlug === 'learn_astrology' || params.modeType === 'learn_astrology';

  const slugsToResolve = Array.from(
    new Set([
      params.expertSlug,
      ...(isLearnAstrology ? ['learn_astrology'] : []),
      params.languageSlug,
      ...recipeSteps.map((s) => s.prompt_slug),
    ])
  );

  const { bodies: promptBodies, models: promptModels } = await resolvePromptModules(slugsToResolve);

  const modelOverride =
    activeModeRecipe?.model_id ||
    promptModels[params.expertSlug] ||
    guideCfg.model_id ||
    (isLearnAstrology ? promptModels['learn_astrology'] : null) ||
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

  const primaryExpertPrompt =
    promptBodies[params.expertSlug] ||
    (isLearnAstrology ? promptBodies['learn_astrology'] : '') ||
    '';

  const isHellenistic = params.expertSlug === 'hellenistic_astrologer';
  const isWesternOrModern =
    params.expertSlug === 'western_astrologer' ||
    params.expertSlug === 'modern_astrologer' ||
    isHellenistic;
  const isTarot = params.expertSlug === 'tarot_reader';
  const isNumerology = params.expertSlug === 'numerologist';
  const westernConstitution = isWesternOrModern
    ? await getWesternCoreCouncilConstitutionAsync()
    : coreConstitution;

  const sections: string[] = [
    isWesternOrModern ? westernConstitution : coreConstitution,
    guideCfg.combined_rules_text || '',
    primaryExpertPrompt,
    ...recipeBlocks,
    promptBodies[params.languageSlug] || '',
  ].filter(Boolean);

  if (params.toneMode === 'friendly') {
    sections.push(
      isWesternOrModern
        ? `COMMUNICATION DEPTH — FRIENDLY MODE (NON-TECHNICAL): Perform all analytical synthesis silently behind the scenes, then explain your answer in warm, clear, everyday conversational language. Avoid overwhelming technical jargon, raw degrees, or dense aspect chains unless the user explicitly asks to see the technical breakdown. Translate factors directly into relatable life guidance and clear calendar timing windows.`
        : `COMMUNICATION DEPTH — FRIENDLY MODE (NON-TECHNICAL): Perform all analytical synthesis silently behind the scenes, then explain your answer in warm, clear, everyday conversational language. Avoid overwhelming technical jargon, raw planetary degrees, Nakshatra pada math, or dense chains unless the user explicitly asks to see the technical breakdown. Translate factors directly into relatable life guidance and clear calendar timing windows.`
    );
  } else if (isHellenistic) {
    sections.push(
      `COMMUNICATION DEPTH — DETAILED MODE (HELLENISTIC CLASSICAL): Ground your analysis in Tropical Whole Sign houses (wsH), Day/Night Sect (lights & benefics/malefics of and contrary to sect), essential dignity & Egyptian Bounds (terms), the Hermetic Lots (Fortune, Spirit, Eros, Necessity), Annual Profections & Lord of the Year, and Zodiacal Releasing (Spirit/Fortune L1–L2 chapters) wherever it sharpens and illuminates the answer, keeping prose calm and cohesive.`
    );
  } else if (isWesternOrModern) {
    sections.push(
      `COMMUNICATION DEPTH — DETAILED MODE: You are free to weave in authentic Tropical Western technical precision—exact Tropical sign placements, degrees, house cusps, tight Ptolemaic aspect orbs, elemental/modal balance, and transit timing cycles—wherever it clarifies and deepens the explanation, keeping the prose natural rather than forcefully academic.`
    );
  } else if (!isTarot && !isNumerology) {
    sections.push(
      `COMMUNICATION DEPTH — DETAILED MODE: You are free to weave in authentic Jyotish technical precision—Rashi placements, house lordships, planetary strengths/Shadbala/Ashtakavarga, Nakshatra & KP Sub-Lord significators, divisional Vargas (D9/D10), and active Vimshottari Mahadasha–Antardasha–Pratyantardasha cycles—wherever it illuminates the reasoning, keeping the explanation clear and natural rather than forcefully jargon-heavy.`
    );
  }

  if (params.responseLength === 'short') {
    sections.push(
      `RESPONSE LENGTH — SHORT: Keep the answer crisp, high-signal, and concise (around 120–200 words max). Lead with the direct conclusion upfront, give the top 2–3 key insights or timing dates, and skip unnecessary filler or lengthy preambles.`
    );
    if (!isTarot && !isNumerology && !isLearnAstrology) {
      sections.push(
        buildShortReplyBreakdownInstruction(
          params.toneMode === 'friendly' ? 'beginner' : 'guided_bridge',
          params.languageSlug,
          isWesternOrModern ? 'western' : 'vedic'
        )
      );
    }
  } else {
    sections.push(
      `RESPONSE LENGTH — DETAILED: Provide a thorough, well-paced, comprehensive reading that unpacks the reasoning, relevant timing shifts, and practical next steps without cutting corners.`
    );
  }

  sections.push(buildChatStyleInstruction(guideCfg.chat_style, { isCouncil: true }));

  // Speak naturally with "you/your" directly rather than addressing the user by name or account handle.

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
  let drawnSpread: DrawnTarotSpread | null = null;
  if (isTarot) {
    drawnSpread = drawTarotSpread(params.userPrompt);
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
    !isLearnAstrology &&
    guideCfg.features.auto_intake !== false
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

  // Single-turn Two-Tier Suggestions Output Contract (Admin-governed per-guide rules)
  const guideSug = guideCfg.suggestions;
  const wantsSuggestions =
    guideSug.enabled &&
    guideCfg.features.followups !== false &&
    (guideSug.followups_enabled || guideSug.deeper_analysis_enabled);

  if (wantsSuggestions) {
    const fCount = guideSug.followups_enabled
      ? Math.max(1, Math.min(6, guideSug.max_followups || 4))
      : 0;
    const dCount = guideSug.deeper_analysis_enabled
      ? Math.max(1, Math.min(6, guideSug.max_deeper_analysis || 4))
      : 0;

    const tierRuleBlocks: string[] = [];
    if (fCount > 0) {
      tierRuleBlocks.push(
        `Generate ${Math.min(3, fCount)} to ${fCount} items in "followups":\n${guideSug.followups_rules}`
      );
    }
    if (dCount > 0) {
      tierRuleBlocks.push(
        `Generate ${Math.min(3, dCount)} to ${dCount} items in "deeper_analysis":\n${guideSug.deeper_analysis_rules}`
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
    resolvedSuggestions: guideSug,
    chatStyle: guideCfg.chat_style,
    tarotSpread: drawnSpread,
  };
}

export async function streamConsultationResponse(
  params: StreamConsultationParams
): Promise<StreamConsultationResult> {
  const [runtime, pricingConfig, engineOverrides] = await Promise.all([
    getResolvedOpenRouterRuntime(),
    getPricingConfig(),
    getEnginePromptOverrides(),
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
  const verbatimWindowSize = Math.max(
    14,
    Math.min(20, runtime.tokenLimits.max_history_turns || 18)
  );
  const verbatimHistory = activeHistory.slice(-verbatimWindowSize);
  const historyOpenRouterMessages: OpenRouterMessage[] = [];

  if (activeHistory.length > verbatimWindowSize) {
    const olderTurns = activeHistory.slice(0, activeHistory.length - verbatimWindowSize);
    const storedSummary = params.conversation.thread_memory_summary?.trim();
    const fallbackOlderDigest = !storedSummary
      ? olderTurns
          .slice(-14)
          .map(
            (m) =>
              `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${String(m.content || '')
                .replace(/\[\[BUBBLE\]\]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 140)}`
          )
          .join('\n')
          .slice(0, 1600)
      : '';
    const compactionBrief = storedSummary || fallbackOlderDigest;
    if (compactionBrief) {
      historyOpenRouterMessages.push({
        role: 'user',
        content: `[LOSSLESS THREAD CONTINUITY SUMMARY — EARLIER CONVERSATION CONTEXT]\n${compactionBrief}\n[Use this summary to maintain 100% continuity on personal facts, prior conclusions, and chart elements already covered without repeating basic introductions.]`,
      });
      if (verbatimHistory[0]?.role !== 'assistant') {
        historyOpenRouterMessages.push({
          role: 'assistant',
          content:
            'Understood — I have the full continuity from our earlier messages and will build directly on it.',
        });
      }
    }
  }

  for (const m of verbatimHistory) {
    historyOpenRouterMessages.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    });
  }

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
  // ASTROLOGY STAGE 2 -> STAGE 3 DUAL SYNTHESIS (Vedic + Western/Modern Council)
  // Keeps Companion, Clarity, Tarot, Numerology, learn_astrology,
  // report_followup, attachments, & birth intake cleanly isolated.
  // =========================================================================
  const normalizedExpertSlug = normalizeCouncilSlug(params.expertSlug);
  const isWesternCouncilTurn =
    activePillar === 'council' &&
    (normalizedExpertSlug === 'western_astrologer' ||
      normalizedExpertSlug === 'modern_astrologer' ||
      normalizedExpertSlug === 'hellenistic_astrologer') &&
    params.modeSlug !== 'learn_astrology' &&
    params.conversation.mode_type !== 'learn_astrology' &&
    params.conversation.mode_type !== 'report_followup' &&
    (!params.attachments || params.attachments.length === 0) &&
    Boolean(params.profile?.chart_json);
  const isVedicCouncilTurn =
    activePillar === 'council' &&
    !isWesternCouncilTurn &&
    normalizedExpertSlug !== 'western_astrologer' &&
    normalizedExpertSlug !== 'modern_astrologer' &&
    normalizedExpertSlug !== 'hellenistic_astrologer' &&
    normalizedExpertSlug !== 'tarot_reader' &&
    normalizedExpertSlug !== 'numerologist' &&
    normalizedExpertSlug !== 'learn_astrology' &&
    params.modeSlug !== 'learn_astrology' &&
    params.conversation.mode_type !== 'learn_astrology' &&
    params.conversation.mode_type !== 'report_followup' &&
    (!params.attachments || params.attachments.length === 0) &&
    Boolean(params.profile?.chart_json);

  const isStructuredAstrologyTurn = isVedicCouncilTurn || isWesternCouncilTurn;
  const astroTradition: 'vedic' | 'western' = isWesternCouncilTurn ? 'western' : 'vedic';

  if (isStructuredAstrologyTurn && params.profile?.chart_json) {
    const [guideCfg, coreConstitution, activeModeRecipe] = await Promise.all([
      getResolvedGuideConfig(normalizedExpertSlug),
      getCoreCouncilConstitutionAsync(),
      getActiveRecipeForTarget('mode', params.modeSlug),
    ]);

    const effectiveConstitution = isWesternCouncilTurn
      ? engineOverrides.western_core_council_constitution?.trim() ||
        (await getWesternCoreCouncilConstitutionAsync())
      : coreConstitution;

    const recipeSteps = activeModeRecipe
      ? (activeModeRecipe.steps_json || []).filter((s) => s && s.enabled !== false && s.prompt_slug)
      : [];
    const slugsToResolve = Array.from(
      new Set([normalizedExpertSlug, ...recipeSteps.map((s) => s.prompt_slug)])
    );

    const [{ bodies: promptBodies, models: promptModels }, dailyTransitData, resolvedDecision] =
      await Promise.all([
        resolvePromptModules(slugsToResolve),
        (async (): Promise<{ slice: DailyTransitSliceInput | null; feedText: string | null }> => {
          if (params.dailyTransitsOverride) {
            return { slice: params.dailyTransitsOverride, feedText: null };
          }
          try {
            const daily = await getOrFetchDailyTransits();
            return {
              slice: {
                transitDate: daily.transitDate,
                planets: daily.planets,
                slowTransitPairs: daily.slowTransitPairs,
                westernPlanets: daily.westernPlanets,
              },
              feedText: isWesternCouncilTurn ? daily.westernTransitsText : daily.transitsText,
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
              tradition: astroTradition,
            }),
      ]);

    const astroModelOverride =
      activeModeRecipe?.model_id ||
      promptModels[normalizedExpertSlug] ||
      guideCfg.model_id ||
      null;
    const vedicModel = astroModelOverride || runtime.consultationModel || getConsultationModel();

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
      tradition: astroTradition,
      routerResult: resolvedDecision.routerResult,
      playbook: resolvedDecision.playbook,
      chart: params.profile.chart_json,
      dossier: params.profile.natal_truth_dossier_json || null,
      lifeContext: params.profile.life_context_json || null,
      dailyTransits: dailyTransitData.slice,
      extraProfiles: extraSlices,
      contextTrapPromptNote: resolvedDecision.contextTrapPromptNote || null,
      userPrompt: params.userPrompt,
      expertSlug: normalizedExpertSlug,
    });

    if (stage2Pkg.timingWidgets && stage2Pkg.timingWidgets.length > 0) {
      params.onTimingWidgets?.(stage2Pkg.timingWidgets);
    }

    const vedicBaseTokens =
      responseLength === 'short'
        ? Math.max(runtime.tokenLimits.chat_short + 400, 1200)
        : Math.max(runtime.tokenLimits.chat_detailed, 4800);

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

    const deepProfileBlock =
      params.conversation.use_full_profile_memory && params.profile.deep_profile_json
        ? formatDeepProfileForLLM(params.profile.deep_profile_json, {
            maxItemsPerBucket: 3,
            maxEntries: 8,
          })
        : '';
    const memoryParts = [
      params.conversation.use_full_profile_memory && params.profile.profile_memory_summary
        ? params.profile.profile_memory_summary
        : '',
      deepProfileBlock
        ? `CITED DEEP PROFILE CONTEXT (Emotional reality, practical constraints & goals — weave gently):\n${deepProfileBlock}`
        : '',
    ].filter(Boolean);
    const memoryText = memoryParts.length > 0 ? memoryParts.join('\n\n') : null;

    // Path B: Explicit 4-Lens Parallel Deep Council Audit + Adjudicator
    if (params.deepAudit) {
      const deepRes = await runDeepCouncilAudit({
        model: vedicModel,
        constitutionPrompt: effectiveConstitution,
        conversationalRules: guideCfg.combined_rules_text,
        expertDirective: promptBodies[normalizedExpertSlug] || '',
        modeRecipeBlocks,
        engineOverrides,
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
        maxOutputTokens: vedicBaseTokens,
        chatStyle: guideCfg.chat_style,
        abortSignal: params.abortSignal,
        onStatus: params.onStatus,
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
        timingWidgets: deepRes.timingWidgets || stage2Pkg.timingWidgets,
        tokensIn: deepRes.tokensIn,
        tokensOut: deepRes.tokensOut,
        creditsCharged: deepCreditsCharged,
        aborted: deepRes.aborted,
        leakIntercepted: deepRes.leakIntercepted,
        pendingProfile: null,
        suggestions: null,
        vedicMeta: deepRes.meta,
        stage2Pkg,
        renderStyle: guideCfg.chat_style,
      };
    }

    // Path A: Fast Focused Stage 3 Synthesis
    const pathAPrompt = buildVedicPathAPrompt({
      constitutionPrompt: effectiveConstitution,
      conversationalRules: guideCfg.combined_rules_text,
      expertDirective: promptBodies[normalizedExpertSlug] || '',
      modeRecipeBlocks,
      engineOverrides,
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
      chatStyle: guideCfg.chat_style,
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
    const allowedTimingWidgetIds = new Set(
      (stage2Pkg.timingWidgets || []).map((w) => w.id)
    );

    try {
      const handlePathAChunk = (chunkText: string) => {
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
            const beforeTag = sanitizeVedicProse(
              rawAccumulated.slice(flushedLength, breakdownIdx).replace(/\s+$/, ''),
              allowedTimingWidgetIds
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
          const trailingNative = /\b(?:the|a)(?:\s+native['’]?s?)?$/i.exec(tentative);
          if (trailingNative) {
            safeEnd -= trailingNative[0].length;
          } else {
            const trailingMarker =
              /(?:^|\r?\n)[ \t]*(?::{1,3}[a-zA-Z0-9_-]*|(?:prediction|ediction|analysis)\b[ \t]*[:\-]?|\[(?:CONFIDENCE|FOLLOWUP)[^\]]*)|\[\[?TIMING_BAR[^\]]*$/i.exec(
                tentative
              );
            if (trailingMarker) {
              safeEnd -= trailingMarker[0].length;
            }
          }
          if (safeEnd > flushedLength) {
            const toEmit = sanitizeVedicProse(
              rawAccumulated.slice(flushedLength, safeEnd),
              allowedTimingWidgetIds
            );
            flushedLength = safeEnd;
            if (toEmit) params.onChunk(toEmit);
          }
        }
      };

      const pathAUserText = appendTurnVerificationModifier(
        finalUserText,
        astroTradition,
        engineOverrides
      );

      const streamResult = await streamOpenRouterCompletion({
        model: vedicModel,
        system: pathAPrompt.systemInstruction,
        messages: [
          ...historyOpenRouterMessages,
          { role: 'user', content: pathAUserText },
        ],
        maxTokens: vedicBaseTokens,
        abortSignal: pathAAbortController.signal,
        onChunk: handlePathAChunk,
      });

      let contTokensIn = 0;
      let contTokensOut = 0;
      let contAborted = false;
      if (
        streamResult.finishReason === 'length' &&
        !streamResult.aborted &&
        !leakIntercepted &&
        !hiddenBreakdownHoldStarted &&
        rawAccumulated.trim().length > 0 &&
        !/[.!?)"'\]\*\`]\s*$/.test(rawAccumulated)
      ) {
        const contResult = await streamOpenRouterCompletion({
          model: vedicModel,
          system: pathAPrompt.systemInstruction,
          messages: [
            ...historyOpenRouterMessages,
            { role: 'user', content: pathAUserText },
            { role: 'assistant', content: rawAccumulated },
            {
              role: 'user',
              content:
                'Continue seamlessly from your exact last word to finish this sentence and complete your reading cleanly without repeating anything already written.',
            },
          ],
          maxTokens: 1800,
          abortSignal: pathAAbortController.signal,
          onChunk: handlePathAChunk,
        });
        contTokensIn = contResult.tokensIn;
        contTokensOut = contResult.tokensOut;
        contAborted = contResult.aborted;
      }

      const totalTokensIn = streamResult.tokensIn + contTokensIn;
      const totalTokensOut = streamResult.tokensOut + contTokensOut;

      if (leakIntercepted || containsInternalPromptLeak(rawAccumulated)) {
        return {
          fullText: PROMPT_EXTRACTION_REFUSAL,
          techBreakdown: null,
          tokensIn: totalTokensIn,
          tokensOut: totalTokensOut,
          creditsCharged: 0,
          aborted: false,
          leakIntercepted: true,
          pendingProfile: null,
          suggestions: null,
          vedicMeta: pathAPrompt.meta,
          renderStyle: guideCfg.chat_style,
        };
      }

      const extractedAccumulated = extractTechBreakdown(rawAccumulated);
      if (!hiddenBreakdownHoldStarted && extractedAccumulated.mainText.length > flushedLength) {
        const remaining = sanitizeVedicProse(
          extractedAccumulated.mainText.slice(flushedLength),
          allowedTimingWidgetIds
        );
        flushedLength = extractedAccumulated.mainText.length;
        if (remaining) params.onChunk(remaining);
      }

      const extractedFinal = extractTechBreakdown(rawAccumulated.trim());
      const sanitized = sanitizeAssistantOutput(
        extractedFinal.mainText,
        allowedTimingWidgetIds
      );
      if (sanitized.leaked) {
        return {
          fullText: sanitized.text,
          techBreakdown: null,
          tokensIn: totalTokensIn,
          tokensOut: totalTokensOut,
          creditsCharged: 0,
          aborted: false,
          leakIntercepted: true,
          pendingProfile: null,
          suggestions: null,
          vedicMeta: pathAPrompt.meta,
          renderStyle: guideCfg.chat_style,
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
        totalTokensIn,
        totalTokensOut,
        sanitized.text,
        pricingConfig.chat_billing
      );

      return {
        fullText: sanitized.text,
        techBreakdown: safeBreakdown,
        timingWidgets: stage2Pkg.timingWidgets,
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        creditsCharged,
        aborted: (streamResult.aborted || contAborted) && !leakIntercepted,
        leakIntercepted: false,
        pendingProfile: null,
        suggestions: null,
        vedicMeta: pathAPrompt.meta,
        stage2Pkg,
        renderStyle: guideCfg.chat_style,
      };
    } finally {
      params.abortSignal.removeEventListener('abort', forwardPathAAbort);
    }
  }

  let systemInstructionWithDynamic = '';
  let modelOverride: string | null = null;
  let wantsSuggestions = false;
  let activeSuggestionsSpec: SuggestionsConfig | undefined;
  let resolvedRenderStyle: ChatStyle | undefined;
  let activeTarotSpread: DrawnTarotSpread | null = null;
  let companionCaps: ResolvedCompanionCapabilities | null = null;
  let companionInvitedEsoteric = false;
  let companionVerificationMode: CompanionVerificationMode = 'neutral';
  let companionTemperature: number = resolveCompanionTemperature(params.companionPreset);
  let companionRawTelemetry: CompanionDiagnosticTelemetry | null = null;

  if (activePillar === 'companion') {
    const builtComp = await buildCompanionSystemPromptAsync({
      preset: params.companionPreset || null,
      persona: activeCompanionPersona,
      languageSlug: params.languageSlug,
      preferredCallName: params.preferredCallName,
      turnCount: activeHistory.length,
      memorySnippets: params.conversation.use_full_profile_memory
        ? params.scopeMemoryContext
        : null,
      bond: params.companionBond || null,
      crossThreadSnippets: params.companionCrossThreadSummary || null,
      councilReadingNotesText: params.councilReadingNotesText || null,
      userDefaultProfile: params.profile,
      userPrompt: params.userPrompt,
      historyMessages: activeHistory,
      companionChatMode:
        params.companionChatMode ?? params.conversation.companion_chat_mode ?? null,
      referrableCompanions: params.referrableCompanions,
      clientLocalHour: params.clientLocalHour,
      adminPreview: params.adminPreview,
    });
    systemInstructionWithDynamic = builtComp.systemInstruction;
    modelOverride = builtComp.modelOverride;
    resolvedRenderStyle = builtComp.chatStyle;
    activeTarotSpread = builtComp.tarotSpread || null;
    companionCaps = builtComp.capabilities;
    companionInvitedEsoteric = builtComp.invitedEsoteric;
    companionVerificationMode = builtComp.verificationMode;
    companionTemperature = builtComp.temperature;
    companionRawTelemetry = builtComp.telemetry;
    wantsSuggestions = false;
  } else if (activePillar === 'clarity') {
    const builtClarity = await buildClaritySystemPromptAsync({
      languageSlug: params.languageSlug,
      preferredCallName: params.preferredCallName,
      turnCount: activeHistory.length,
      memorySnippets: params.conversation.use_full_profile_memory
        ? params.scopeMemoryContext
        : null,
    });
    systemInstructionWithDynamic = builtClarity.systemInstruction;
    modelOverride = builtClarity.modelOverride;
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
    });
    modelOverride = built.modelOverride;
    wantsSuggestions = built.wantsSuggestions;
    activeSuggestionsSpec = built.resolvedSuggestions;
    resolvedRenderStyle = built.chatStyle;
    activeTarotSpread = built.tarotSpread || null;

    // Fetch today's cached Gochar transits (max 1 API call/day across platform, with deterministic fallback)
    let gocharContext = '';
    const needsTransits =
      params.expertSlug !== 'tarot_reader' && params.expertSlug !== 'numerologist';
    if (needsTransits) {
      try {
        const daily = await getOrFetchDailyTransits();
        gocharContext =
          params.expertSlug === 'western_astrologer' ||
          params.expertSlug === 'modern_astrologer' ||
          params.expertSlug === 'hellenistic_astrologer'
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
      const deepProfileCouncilBlock = params.profile?.deep_profile_json
        ? formatDeepProfileForLLM(params.profile.deep_profile_json, {
            maxItemsPerBucket: 3,
            maxEntries: 8,
          })
        : '';
      if (deepProfileCouncilBlock) {
        dynamicContextBlocks.push(
          `CITED DEEP PROFILE CONTEXT (Practical reality, emotional patterns & goals — weave quietly):\n${deepProfileCouncilBlock}`
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

  if (activeTarotSpread && activeTarotSpread.cards.length > 0) {
    params.onTarotSpread?.(activeTarotSpread);
  }

  const rawCompanionTokenCap =
    params.companionPreset?.max_output_tokens ?? activeCompanionPersona?.max_output_tokens;
  const companionPresetTokens =
    typeof rawCompanionTokenCap === 'number' && rawCompanionTokenCap >= 300
      ? Math.round(rawCompanionTokenCap)
      : null;
  const companionGroupTokens =
    companionCaps &&
    typeof engineOverrides.companion_group_configs?.[companionCaps.companion_group]
      ?.default_max_output_tokens === 'number' &&
    engineOverrides.companion_group_configs[companionCaps.companion_group]!
      .default_max_output_tokens! >= 300
      ? Math.round(
          engineOverrides.companion_group_configs[companionCaps.companion_group]!
            .default_max_output_tokens!
        )
      : null;
  const companionMaxOutputTokens =
    companionPresetTokens ??
    companionGroupTokens ??
    Math.max(
      runtime.tokenLimits.companion_detailed || companionCaps?.max_output_tokens || 3200,
      2800
    );

  const model = modelOverride || runtime.consultationModel || getConsultationModel();
  const baseOutputTokens =
    activePillar === 'companion'
      ? companionMaxOutputTokens
      : activePillar === 'clarity'
      ? Math.max(Math.min(runtime.tokenLimits.chat_detailed, 1800), 1400)
      : responseLength === 'short'
      ? Math.max(runtime.tokenLimits.chat_short + 400, 1200)
      : Math.max(runtime.tokenLimits.chat_detailed, 4800);
  // Reserve headroom for compact single-turn suggestions JSON so prose is never clipped
  const maxOutputTokens = wantsSuggestions ? baseOutputTokens + 420 : baseOutputTokens;

  let requestUserText = finalUserText;
  let companionAppliedVerificationMode: CompanionVerificationMode | 'skipped' = 'skipped';
  if (activePillar === 'companion') {
    const hasChartData = Boolean(
      params.profile?.chart_json || params.profile?.chart_text_context?.trim()
    );
    const verifiedTurn = applyCompanionTurnVerification({
      userText: finalUserText,
      verificationMode: companionVerificationMode,
      capabilities: companionCaps,
      invitedEsoteric: companionInvitedEsoteric,
      hasChartData,
      engineOverrides,
    });
    requestUserText = verifiedTurn.userText;
    companionAppliedVerificationMode = verifiedTurn.appliedMode;
  }

  let companionTelemetryPayload: CompanionPipelineTelemetryPayload | null = null;
  if (activePillar === 'companion' && companionRawTelemetry && (await isPipelineLoggingEnabled())) {
    companionTelemetryPayload = {
      ...companionRawTelemetry,
      appliedVerificationMode: companionAppliedVerificationMode,
      executionMode: 'single_pass',
      modelId: model,
      maxOutputTokens,
      systemPromptPreview: capTelemetryPreview(systemInstructionWithDynamic),
      analyticalStages: [
        {
          stage: 1,
          key: 'turn_context_and_intent',
          label: 'Turn Context & Esoteric Relevance',
          status: 'executed',
          notes: `verification=${companionAppliedVerificationMode}`,
        },
        {
          stage: 2,
          key: 'chart_and_memory_assembly',
          label: 'Dual-Tradition Chart & Memory Isolation Assembly',
          status: 'executed',
          notes: `memory_mode=${companionRawTelemetry.astrologicalMemoryMode}`,
        },
        {
          stage: 3,
          key: 'single_pass_synthesis',
          label: 'Single-Pass Companion Synthesis',
          status: 'executed',
          notes: `model=${model} temp=${companionTemperature}`,
        },
        {
          stage: 4,
          key: 'future_chart_prepass',
          label: 'Stage 4 · Reserved Multi-Pass Slot',
          status: 'reserved_future',
        },
        {
          stage: 5,
          key: 'future_verification_pass',
          label: 'Stage 5 · Reserved Multi-Pass Slot',
          status: 'reserved_future',
        },
        {
          stage: 6,
          key: 'future_refinement_pass',
          label: 'Stage 6 · Reserved Multi-Pass Slot',
          status: 'reserved_future',
        },
        {
          stage: 7,
          key: 'future_post_audit_pass',
          label: 'Stage 7 · Reserved Multi-Pass Slot',
          status: 'reserved_future',
        },
      ],
    };
  }

  // Filter out messages excluded from context (already filtered above)
  const messages: OpenRouterMessage[] = [...historyOpenRouterMessages];

  if (params.attachments && params.attachments.length > 0) {
    const contentParts: OpenRouterContentPart[] = [
      { type: 'text', text: requestUserText },
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
      content: requestUserText,
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
      text.search(/<<<REFERRAL/i),
    ].filter((idx) => idx !== -1);
    return indices.length > 0 ? Math.min(...indices) : -1;
  };

  try {
    const handlePathBChunk = (chunkText: string) => {
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
          const beforeTag = sanitizeVedicProse(
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
        const trailingNative = /\b(?:the|a)(?:\s+native['’]?s?)?$/i.exec(tentative);
        if (trailingNative) {
          safeEnd -= trailingNative[0].length;
        } else {
          const trailingMarker =
            /(?:^|\r?\n)[ \t]*(?::{1,3}[a-zA-Z0-9_-]*|(?:prediction|ediction|analysis)\b[ \t]*[:\-]?|\[(?:CONFIDENCE|FOLLOWUP)[^\]]*)$/i.exec(
              tentative
            );
          if (trailingMarker) {
            safeEnd -= trailingMarker[0].length;
          }
        }
        if (safeEnd > flushedLength) {
          const toEmit = sanitizeVedicProse(rawAccumulated.slice(flushedLength, safeEnd));
          flushedLength = safeEnd;
          if (toEmit) params.onChunk(toEmit);
        }
      }
    };

    const streamResult = await streamOpenRouterCompletion({
      model,
      system: systemInstructionWithDynamic,
      messages,
      maxTokens: maxOutputTokens,
      temperature: activePillar === 'companion' ? companionTemperature : undefined,
      abortSignal: internalAbortController.signal,
      onChunk: handlePathBChunk,
    });

    let contTokensIn = 0;
    let contTokensOut = 0;
    let contAborted = false;
    if (
      streamResult.finishReason === 'length' &&
      !streamResult.aborted &&
      !leakIntercepted &&
      !hiddenBlockHoldStarted &&
      rawAccumulated.trim().length > 0 &&
      !/[.!?)"'\]\*\`]\s*$/.test(rawAccumulated)
    ) {
      const contResult = await streamOpenRouterCompletion({
        model,
        system: systemInstructionWithDynamic,
        messages: [
          ...messages,
          { role: 'assistant', content: rawAccumulated },
          {
            role: 'user',
            content:
              'Continue seamlessly from your exact last word to finish this sentence and complete your response cleanly without repeating anything already written.',
          },
        ],
        maxTokens: 1600,
        temperature: activePillar === 'companion' ? companionTemperature : undefined,
        abortSignal: internalAbortController.signal,
        onChunk: handlePathBChunk,
      });
      contTokensIn = contResult.tokensIn;
      contTokensOut = contResult.tokensOut;
      contAborted = contResult.aborted;
    }

    const totalTokensIn = streamResult.tokensIn + contTokensIn;
    const totalTokensOut = streamResult.tokensOut + contTokensOut;

    if (leakIntercepted || containsInternalPromptLeak(rawAccumulated)) {
      return {
        fullText: PROMPT_EXTRACTION_REFUSAL,
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        creditsCharged: 0,
        aborted: false,
        leakIntercepted: true,
        pendingProfile: null,
        suggestions: null,
        companionTelemetry: companionTelemetryPayload,
      };
    }

    const extractedFromAccumulated = extractHiddenDirectives(
      rawAccumulated,
      activeSuggestionsSpec,
      params.referrableCompanions
    );
    if (!hiddenBlockHoldStarted && extractedFromAccumulated.cleanText.length > flushedLength) {
      params.onChunk(sanitizeVedicProse(extractedFromAccumulated.cleanText.slice(flushedLength)));
      flushedLength = extractedFromAccumulated.cleanText.length;
    }

    const extractedFinal = extractHiddenDirectives(
      rawAccumulated,
      activeSuggestionsSpec,
      params.referrableCompanions
    );
    const sanitized = sanitizeAssistantOutput(extractedFinal.cleanText);
    if (sanitized.leaked) {
      return {
        fullText: sanitized.text,
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        creditsCharged: 0,
        aborted: false,
        leakIntercepted: true,
        pendingProfile: null,
        suggestions: null,
        referral: null,
        renderStyle: resolvedRenderStyle,
        companionTelemetry: companionTelemetryPayload,
      };
    }

    const creditsCharged = calculateCreditsFromUsage(
      totalTokensIn,
      totalTokensOut,
      sanitized.text,
      pricingConfig.chat_billing
    );

    let safeLegacyBreakdown: string | null = null;
    if (!streamResult.aborted && !contAborted && extractedFinal.techBreakdown) {
      const bdSanitized = sanitizeAssistantOutput(extractedFinal.techBreakdown);
      if (!bdSanitized.leaked && bdSanitized.text.trim()) {
        safeLegacyBreakdown = bdSanitized.text.trim();
      }
    }

    return {
      fullText: sanitized.text,
      techBreakdown: safeLegacyBreakdown,
      tarotSpread: streamResult.aborted || contAborted ? null : activeTarotSpread,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      creditsCharged,
      aborted: (streamResult.aborted || contAborted) && !leakIntercepted,
      leakIntercepted: false,
      pendingProfile: streamResult.aborted || contAborted ? null : extractedFinal.pendingProfile,
      suggestions: streamResult.aborted || contAborted ? null : extractedFinal.suggestions,
      referral: streamResult.aborted || contAborted ? null : extractedFinal.referral,
      renderStyle: resolvedRenderStyle,
      companionTelemetry: companionTelemetryPayload,
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
    const isCompanionSug =
      params.expertSlug === 'companion' || params.expertSlug.startsWith('companion:');
    const guideLookupSlug = isCompanionSug
      ? 'companion'
      : normalizeCouncilSlug(params.expertSlug);
    const [guideCfg, runtime] = await Promise.all([
      getResolvedGuideConfig(guideLookupSlug),
      getResolvedOpenRouterRuntime(),
    ]);
    const suggestionsConfig = guideCfg.suggestions;

    if (
      (!isCompanionSug && !suggestionsConfig.enabled) ||
      guideCfg.features.followups === false ||
      (!isCompanionSug &&
        !suggestionsConfig.followups_enabled &&
        !suggestionsConfig.deeper_analysis_enabled)
    ) {
      return { followups: [], deeper_analysis: [] };
    }

    const maxF = isCompanionSug
      ? Math.max(2, Math.min(4, suggestionsConfig.max_followups || 3))
      : suggestionsConfig.followups_enabled
      ? Math.max(1, Math.min(6, suggestionsConfig.max_followups || 4))
      : 0;
    const maxD = isCompanionSug
      ? 0
      : suggestionsConfig.deeper_analysis_enabled
      ? Math.max(1, Math.min(6, suggestionsConfig.max_deeper_analysis || 4))
      : 0;

    const cleanAnswerPreview = String(params.assistantAnswer || '')
      .replace(/\[\[BUBBLE\]\]/g, ' ')
      .slice(0, 1800);

    const promptBody = isCompanionSug
      ? `Generate 3 natural, human, first-person quick-reply options the USER might text next in this friend/companion conversation.
Language: ${params.languageSlug}

WHAT THE USER JUST SAID:
${params.userQuestion.slice(0, 500)}

WHAT THE COMPANION JUST REPLIED:
${cleanAnswerPreview}

RULES:
- Sound like real everyday texts a person would actually tap to send (short, candid, human—6 to 14 words max).
- Vary naturally: e.g. one emotional continuation or confession, one question back to the companion, one lighter/pivot option.
- NEVER write stiff clinical astrology checklists or "analyze my Dasha/chart deeper" unless the companion explicitly brought it up.
- Return STRICTLY JSON with shape: { "followups": [{ "text": "..." }], "deeper_analysis": [] }`
      : `Generate structured two-tier suggestions STRICTLY anchored to the user's LAST question and the answer just given.
Active Council Guide: ${params.expertSlug}
Topic Mode: ${params.modeSlug}
Language: ${params.languageSlug}
Chart Attached: ${params.hasProfile ? 'Yes' : 'No'}

USER QUESTION (PRIMARY ANCHOR — NEVER DRIFT TO UNRELATED LIFE AREAS):
${params.userQuestion.slice(0, 600)}

COUNCIL ANSWER EXCERPT:
${cleanAnswerPreview}

${maxF > 0 ? `TIER 1 — "followups" (${Math.min(3, maxF)}–${maxF} items):\n${suggestionsConfig.followups_rules}\n` : ''}
${maxD > 0 ? `TIER 2 — "deeper_analysis" (${Math.min(3, maxD)}–${maxD} items):\n${suggestionsConfig.deeper_analysis_rules}\n` : ''}

Return STRICTLY JSON with shape:
{
  "followups": ${maxF > 0 ? '[{ "text": "..." }]' : '[]'},
  "deeper_analysis": ${maxD > 0 ? '[{ "text": "...", "technical_directive": "..." }]' : '[]'}
}`;

    const completion = await createOpenRouterCompletion({
      model: runtime.utilityModel || getUtilityModel(),
      maxTokens: Math.max(500, runtime.tokenLimits.utility),
      jsonMode: true,
      disableReasoning: true,
      temperature: isCompanionSug ? 0.65 : 0.45,
      messages: [{ role: 'user', content: promptBody }],
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
    const isCompanionSug =
      params.expertSlug === 'companion' || params.expertSlug.startsWith('companion:');
    const guideLookupSlug = isCompanionSug
      ? 'companion'
      : normalizeCouncilSlug(params.expertSlug);
    const [guideCfg, runtime] = await Promise.all([
      getResolvedGuideConfig(guideLookupSlug),
      getResolvedOpenRouterRuntime(),
    ]);
    const suggestionsConfig = guideCfg.suggestions;

    if (
      (!isCompanionSug && !suggestionsConfig.enabled) ||
      guideCfg.features.followups === false ||
      (!isCompanionSug &&
        !suggestionsConfig.followups_enabled &&
        !suggestionsConfig.deeper_analysis_enabled)
    ) {
      return { followups: [], deeper_analysis: [] };
    }

    const totalTarget = Math.max(2, Math.min(12, params.count || (isCompanionSug ? 4 : 8)));
    const bothEnabled =
      !isCompanionSug &&
      suggestionsConfig.followups_enabled &&
      suggestionsConfig.deeper_analysis_enabled;
    const countF = isCompanionSug
      ? totalTarget
      : bothEnabled
      ? Math.ceil(totalTarget / 2)
      : suggestionsConfig.followups_enabled
      ? totalTarget
      : 0;
    const countD = isCompanionSug
      ? 0
      : bothEnabled
      ? Math.floor(totalTarget / 2)
      : suggestionsConfig.deeper_analysis_enabled
      ? totalTarget
      : 0;

    const existingListBlock = params.existingTexts
      .slice(0, 24)
      .map((t, i) => `${i + 1}. ${t}`)
      .join('\n');

    const cleanAnswerPreview = String(params.assistantAnswer || '')
      .replace(/\[\[BUBBLE\]\]/g, ' ')
      .slice(0, 1800);

    const promptBody = isCompanionSug
      ? `Generate ${countF} BRAND-NEW short, natural first-person user texting replies to continue this conversation.
Language: ${params.languageSlug}

WHAT THE USER SAID:
${params.userQuestion.slice(0, 500)}

COMPANION REPLY:
${cleanAnswerPreview}

DO NOT REPEAT ANY OF THESE:
${existingListBlock || '(none yet)'}

Return STRICTLY JSON: { "followups": [{ "text": "..." }], "deeper_analysis": [] }`
      : `Generate ${totalTarget} BRAND-NEW structured suggestions tightly anchored to the USER QUESTION and COUNCIL ANSWER EXCERPT below. Do NOT drift into unrelated topics (e.g. marriage, promotion, contracts) unless the user asked about them.
Active Council Guide: ${params.expertSlug}
Topic Mode: ${params.modeSlug}
Language: ${params.languageSlug}
Chart Attached: ${params.hasProfile ? 'Yes' : 'No'}

USER QUESTION (PRIMARY ANCHOR):
${params.userQuestion.slice(0, 600)}

COUNCIL ANSWER EXCERPT:
${cleanAnswerPreview}

${countF > 0 ? `TIER 1 — "followups" (EXACTLY ${countF} new items):\n${suggestionsConfig.followups_rules}\n` : ''}
${countD > 0 ? `TIER 2 — "deeper_analysis" (EXACTLY ${countD} new items):\n${suggestionsConfig.deeper_analysis_rules}\n` : ''}

CRITICAL DEDUPLICATION RULE:
Do NOT repeat, reword, or closely overlap with any of these ALREADY SHOWN questions:
${existingListBlock || '(none yet)'}

Return STRICTLY JSON with shape:
{
  "followups": ${countF > 0 ? '[{ "text": "..." }]' : '[]'},
  "deeper_analysis": ${countD > 0 ? '[{ "text": "...", "technical_directive": "..." }]' : '[]'}
}`;

    const completion = await createOpenRouterCompletion({
      model: runtime.utilityModel || getUtilityModel(),
      maxTokens: 640,
      jsonMode: true,
      disableReasoning: true,
      temperature: 0.65,
      messages: [{ role: 'user', content: promptBody }],
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
    expertSlug: DEFAULT_COUNCIL_EXPERT_SLUG,
  });
  return structured.followups.map((item) => item.text);
}

export async function generateConversationTitle(
  _firstQuestion: string,
  profileName?: string | null,
  pillar: ChatPillar = 'council',
  companionName?: string | null,
  councilDisplayName?: string | null
): Promise<string> {
  if (pillar === 'clarity') return 'Clarity';
  if (pillar === 'companion') {
    return companionName?.trim() ? companionName.trim().slice(0, 80) : 'Companion Chat';
  }
  const person = profileName?.trim() || 'General';
  const council = councilDisplayName?.trim() || 'Vedic Astrologer';
  return `${person} (${council})`.slice(0, 80);
}

export async function runQuickTool(params: {
  toolSlug: 'question_generator' | 'prompt_expander' | 'prompt_optimizer';
  inputText: string;
  modeSlug?: string;
  languageSlug?: string;
  profileId?: string | null;
  expertSlug?: string | null;
  tradition?: 'vedic' | 'western';
  userId: string;
}): Promise<{ items?: string[]; resultText: string }> {
  const supabaseAdmin = getSupabaseAdmin();
  const isWestern =
    params.tradition === 'western' ||
    params.expertSlug === 'western_astrologer' ||
    params.expertSlug === 'modern_astrologer' ||
    params.expertSlug === 'hellenistic_astrologer';
  const [{ bodies: promptBodies, models: promptModels }, runtime] = await Promise.all([
    resolvePromptModules([params.toolSlug]),
    getResolvedOpenRouterRuntime(),
  ]);
  const baseToolInstruction = promptBodies[params.toolSlug] || '';
  const toolInstruction = isWestern
    ? `${baseToolInstruction}\n\nTRADITION OVERRIDE — WESTERN TROPICAL ASTROLOGY: Frame every question or refined prompt strictly using Western Tropical astrology concepts (Tropical zodiac, Placidus houses, tight aspects, Day/Night Sect, Annual Profections, Secondary Progressions, Solar Return, Outer Transits). NEVER include Vedic or Sanskrit terminology (no Lagna, D9/D10, Nakshatra, Dasha, Gochar, KP Sub-Lord, or Ashtakavarga).`
    : baseToolInstruction;
  const toolModel = promptModels[params.toolSlug] || runtime.utilityModel || getUtilityModel();

  let profileContext = '';
  if (params.profileId && supabaseAdmin) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select(
        isWestern
          ? 'name, is_activated, birth_date, chart_text_context, chart_json'
          : 'name, is_activated, chart_text_context'
      )
      .eq('id', params.profileId)
      .eq('user_id', params.userId)
      .maybeSingle();

    if (profile) {
      const profRec = profile as unknown as {
        name: string;
        birth_date?: string;
        chart_text_context?: string | null;
        chart_json?: CompiledChartData | null;
      };
      if (isWestern && profRec.chart_json) {
        const tropicalText = formatTropicalWesternContext({
          chartJson: profRec.chart_json,
          birthDate: profRec.birth_date || '1990-01-01',
          profileName: profRec.name,
        });
        profileContext = tropicalText
          ? `TROPICAL WESTERN PROFILE CONTEXT (${profRec.name}):\n${tropicalText.slice(0, 2800)}`
          : `PROFILE NAME: ${profRec.name}`;
      } else {
        profileContext = profRec.chart_text_context
          ? `PROFILE CONTEXT (${profRec.name}):\n${profRec.chart_text_context.slice(0, 2800)}`
          : `PROFILE NAME: ${profRec.name}`;
      }
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
