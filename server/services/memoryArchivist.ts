import type {
  CareerContextMode,
  CitedInsightCategory,
  DeepProfileBucketKey,
  LocationContextStatus,
  RelationshipContextStatus,
} from '../../lib/lifeContextSchema';
import {
  DEEP_PROFILE_BUCKET_LABELS,
  VALID_ANCHOR_TAGS,
  VALID_CAREER_MODES,
  VALID_CITED_INSIGHT_CATEGORIES,
  VALID_LOCATION_STATUSES,
  VALID_RELATIONSHIP_STATUSES,
} from '../../lib/lifeContextSchema';
import type { Stage1RouterResult, UserFluencyTier, VedicUserProfile } from '../../lib/vedicTypes';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import {
  DEFAULT_MEMORY_COMPANION_BOND_PROMPT,
  DEFAULT_MEMORY_DEEP_PROFILE_EXTRACTOR_PROMPT,
  DEFAULT_MEMORY_PROFILE_SYNTHESIZER_PROMPT,
  DEFAULT_MEMORY_ROLLING_THREAD_COMPACTOR_PROMPT,
} from './enginePromptDefaults';
import {
  appendCouncilAnalystNotes,
  mergeExtractedDeepProfile,
  mergeExtractedLifeFacts,
  type ExtractedLifeFactsPatch,
} from './lifeContextGuard';
import {
  createOpenRouterCompletion,
  getUtilityModelAsync,
  isOpenRouterConfiguredAsync,
  safeExtractJson,
} from './openrouter';
import { getEnginePromptOverrides } from './platformSettings';

export interface ArchivistTurnContext {
  routerResult?: Stage1RouterResult | null;
  domain?: string | null;
  effectiveFluency?: UserFluencyTier | null;
  hasTechnicalDirective?: boolean;
  isDeepAudit?: boolean;
  tradition?: 'vedic' | 'western';
  latestUserPrompt?: string;
  latestAssistantAnswer?: string;
  extractedStressAreas?: string[];
  actorCitation?: string;
  actorSlug?: string;
  conversationId?: string | null;
}

const VALID_DEEP_BUCKETS = new Set<string>(Object.keys(DEEP_PROFILE_BUCKET_LABELS));
const TRIVIAL_ACK_RE = /^(ok|okay|k|kk|yes|yeah|yep|yup|no|nope|nah|thanks|thank you|thx|ty|hmm+|hm+|oh|ah|hi|hey|hello|cool|nice|sure|got it)[.!?]*$/i;

function applyPromptTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

const FLUENCY_ORDER: Record<UserFluencyTier, number> = {
  beginner: 0,
  guided_bridge: 1,
  practitioner: 2,
};

function stepFluencyUp(tier: UserFluencyTier): UserFluencyTier {
  if (tier === 'beginner') return 'guided_bridge';
  return 'practitioner';
}

export function mergeCoreStressAreas(
  existing?: string[] | null,
  incoming?: string[] | null
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...(existing || []), ...(incoming || [])]) {
    if (typeof raw !== 'string') continue;
    const cleaned = raw
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
    if (!cleaned || cleaned.length < 3) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * Pure helper computing the updated silent VedicUserProfile without network calls
 * so both runtime updates and CLI benchmarks can verify fluency & domain progression cleanly.
 */
export function computeUpdatedVedicUserProfile(
  existing: Partial<VedicUserProfile> | null | undefined,
  turnContext: ArchivistTurnContext
): VedicUserProfile {
  const prevFluency: UserFluencyTier =
    existing?.inferred_fluency && existing.inferred_fluency in FLUENCY_ORDER
      ? existing.inferred_fluency
      : 'beginner';

  let nextFluency: UserFluencyTier = prevFluency;
  const detected = turnContext.routerResult?.detected_user_fluency;

  if (turnContext.hasTechnicalDirective || turnContext.isDeepAudit) {
    // User explicitly engaged deeper analysis or Deep Council Audit -> step +1 rung
    const stepped = stepFluencyUp(prevFluency);
    nextFluency =
      detected && FLUENCY_ORDER[detected] > FLUENCY_ORDER[stepped]
        ? detected
        : stepped;
  } else if (detected) {
    if (FLUENCY_ORDER[detected] > FLUENCY_ORDER[prevFluency]) {
      nextFluency = detected;
    } else if (
      detected === 'beginner' &&
      prevFluency === 'guided_bridge' &&
      turnContext.effectiveFluency === 'beginner'
    ) {
      // Gently stay at guided_bridge unless sustained simple prompts; keep stable prior
      nextFluency = prevFluency;
    }
  }

  // Rolling domain weights (top 3 recurring non-generic domains)
  const weights: Record<string, number> = {
    ...(existing?.domain_weights || {}),
  };
  // Gentle decay so older topics fade naturally over time
  for (const [k, v] of Object.entries(weights)) {
    const decayed = Number((v * 0.92).toFixed(2));
    if (decayed < 0.25) {
      delete weights[k];
    } else {
      weights[k] = decayed;
    }
  }

  const rawDomain = (turnContext.domain || '').trim().toLowerCase();
  if (rawDomain && rawDomain !== 'open' && rawDomain !== 'general') {
    weights[rawDomain] = Number(((weights[rawDomain] || 0) + 1.0).toFixed(2));
  }

  // Keep top 12 entries stored compactly
  const sortedEntries = Object.entries(weights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  const compactWeights: Record<string, number> = Object.fromEntries(sortedEntries);
  const recurringDomains = sortedEntries.slice(0, 3).map(([k]) => k);

  let preferredTradition: VedicUserProfile['preferred_tradition'] =
    existing?.preferred_tradition || turnContext.tradition || 'vedic';
  if (
    turnContext.tradition &&
    existing?.preferred_tradition &&
    existing.preferred_tradition !== 'dual' &&
    existing.preferred_tradition !== turnContext.tradition
  ) {
    preferredTradition = 'dual';
  }

  const mergedStressAreas = mergeCoreStressAreas(
    existing?.core_stress_areas,
    turnContext.extractedStressAreas
  );

  return {
    inferred_fluency: nextFluency,
    recurring_domains: recurringDomains,
    domain_weights: compactWeights,
    ...(mergedStressAreas.length > 0 ? { core_stress_areas: mergedStressAreas } : {}),
    preferred_tradition: preferredTradition,
    last_updated_at: new Date().toISOString(),
  };
}

export async function extractAndPersistDeepProfileFacts(
  profileId: string,
  userId: string,
  turnContext?: ArchivistTurnContext
): Promise<string[]> {
  const userPrompt = (turnContext?.latestUserPrompt || '').trim();
  if (userPrompt.length < 6 || TRIVIAL_ACK_RE.test(userPrompt)) return [];

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !(await isOpenRouterConfiguredAsync())) return [];

  try {
    const [primaryProfileRes, engineOverrides] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id, user_id, life_context_json, deep_profile_json')
        .eq('id', profileId)
        .eq('user_id', userId)
        .maybeSingle(),
      getEnginePromptOverrides().catch(() => ({} as Record<string, never>)),
    ]);

    let hasDeepProfileCol = !primaryProfileRes.error;
    let profile: {
      id: string;
      user_id: string;
      life_context_json?: unknown;
      deep_profile_json?: unknown;
    } | null = primaryProfileRes.data as unknown as {
      id: string;
      user_id: string;
      life_context_json?: unknown;
      deep_profile_json?: unknown;
    } | null;

    if (primaryProfileRes.error) {
      hasDeepProfileCol = false;
      const fallbackRes = await supabaseAdmin
        .from('profiles')
        .select('id, user_id, life_context_json')
        .eq('id', profileId)
        .eq('user_id', userId)
        .maybeSingle();
      profile = fallbackRes.data as unknown as {
        id: string;
        user_id: string;
        life_context_json?: unknown;
      } | null;
    }

    if (!profile) return [];

    const existingCtx =
      profile.life_context_json && typeof profile.life_context_json === 'object'
        ? (profile.life_context_json as Record<string, unknown>)
        : {};
    const existingDeep =
      profile.deep_profile_json && typeof profile.deep_profile_json === 'object'
        ? (profile.deep_profile_json as Record<string, unknown>)
        : {};

    const existingNotesList = Array.isArray(existingCtx.cited_insights)
      ? (existingCtx.cited_insights as Array<Record<string, unknown>>)
          .slice(0, 12)
          .map((n) => `- [${String(n.category || 'note')}] ${String(n.summary || '')}`)
          .join('\n')
      : '';
    const existingDeepLines = (Object.keys(DEEP_PROFILE_BUCKET_LABELS) as DeepProfileBucketKey[])
      .map((bucketKey) => {
        const arr = existingDeep[bucketKey];
        if (!Array.isArray(arr) || arr.length === 0) return '';
        return `${DEEP_PROFILE_BUCKET_LABELS[bucketKey]}: ${arr.slice(0, 3).map(String).join('; ')}`;
      })
      .filter(Boolean)
      .join('\n');

    const existingSummary =
      [
        existingCtx.relationship_status ? `Relationship: ${String(existingCtx.relationship_status)}` : '',
        existingCtx.children_summary ? `Children: ${String(existingCtx.children_summary)}` : '',
        existingCtx.career_role ? `Role: ${String(existingCtx.career_role)}` : '',
        existingCtx.workplace_context ? `Workplace: ${String(existingCtx.workplace_context)}` : '',
        existingCtx.location_status ? `Location status: ${String(existingCtx.location_status)}` : '',
        existingDeepLines,
        existingNotesList,
      ]
        .filter(Boolean)
        .join('\n') || '(none recorded yet)';

    const actorCitation = turnContext?.actorCitation?.trim() || 'Cosmic Council';
    const actorSlug = turnContext?.actorSlug?.trim() || undefined;
    const promptTemplate =
      engineOverrides.memory_deep_profile_extractor_prompt?.trim() ||
      engineOverrides.profile_memory_extractor_prompt?.trim() ||
      DEFAULT_MEMORY_DEEP_PROFILE_EXTRACTOR_PROMPT;

    const renderedPrompt = applyPromptTemplate(promptTemplate, {
      ACTOR_CITATION: actorCitation,
      EXISTING_CONTEXT: existingSummary.slice(0, 1600),
      ALLOWED_MILESTONE_TAGS: Array.from(VALID_ANCHOR_TAGS).join(', '),
      ALLOWED_RELATIONSHIP_STATUSES: Array.from(VALID_RELATIONSHIP_STATUSES).join(', '),
      ALLOWED_CAREER_MODES: Array.from(VALID_CAREER_MODES).join(', '),
      USER_MESSAGE: userPrompt.slice(0, 1800),
      ASSISTANT_REPLY: (turnContext?.latestAssistantAnswer || '').slice(0, 800),
    });

    const utilityModel = await getUtilityModelAsync();
    const completion = await createOpenRouterCompletion({
      model: utilityModel,
      jsonMode: true,
      disableReasoning: true,
      temperature: 0.1,
      maxTokens: 560,
      messages: [
        {
          role: 'user',
          content: renderedPrompt,
        },
      ],
    });

    const parsed = safeExtractJson<{
      supersede_status_updates?: unknown;
      milestones?: unknown;
      core_stress_areas?: unknown;
      relationship_status?: unknown;
      marriage_year?: unknown;
      has_children?: unknown;
      children_summary?: unknown;
      career_mode?: unknown;
      career_role?: unknown;
      workplace_context?: unknown;
      location_status?: unknown;
      deep_profile_buckets?: unknown;
      cited_insights?: unknown;
    }>(completion.text, {});

    const milestones: Array<{
      year: number;
      tag: string;
      note?: string;
      cited_by?: string;
      cited_slug?: string;
    }> = [];
    if (Array.isArray(parsed.milestones)) {
      for (const item of parsed.milestones) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;
        const yr = typeof rec.year === 'number' ? rec.year : Number(rec.year);
        if (!Number.isInteger(yr) || yr < 1930 || yr > new Date().getFullYear() + 1) continue;
        // Guardrail: ensure the year literally appeared in the user's message
        if (!userPrompt.includes(String(yr))) continue;
        const tag = typeof rec.tag === 'string' ? rec.tag.trim() : '';
        if (!tag) continue;
        milestones.push({
          year: yr,
          tag,
          note: typeof rec.note === 'string' ? rec.note.trim().slice(0, 80) : undefined,
          cited_by: actorCitation,
          ...(actorSlug ? { cited_slug: actorSlug } : {}),
        });
      }
    }

    const stressAreas = Array.isArray(parsed.core_stress_areas)
      ? parsed.core_stress_areas.filter((s): s is string => typeof s === 'string')
      : [];

    const relStatus =
      typeof parsed.relationship_status === 'string' &&
      VALID_RELATIONSHIP_STATUSES.has(parsed.relationship_status)
        ? (parsed.relationship_status as RelationshipContextStatus)
        : undefined;

    const marriageYrRaw =
      typeof parsed.marriage_year === 'number' ? parsed.marriage_year : Number(parsed.marriage_year);
    const marriageYear =
      Number.isInteger(marriageYrRaw) &&
      marriageYrRaw >= 1940 &&
      marriageYrRaw <= new Date().getFullYear() &&
      userPrompt.includes(String(marriageYrRaw))
        ? marriageYrRaw
        : undefined;

    const careerMode =
      typeof parsed.career_mode === 'string' && VALID_CAREER_MODES.has(parsed.career_mode)
        ? (parsed.career_mode as CareerContextMode)
        : undefined;

    const hasChildren =
      typeof parsed.has_children === 'boolean' ? parsed.has_children : undefined;

    const childrenSummary =
      typeof parsed.children_summary === 'string' && parsed.children_summary.trim()
        ? parsed.children_summary.trim().slice(0, 140)
        : undefined;

    const careerRole =
      typeof parsed.career_role === 'string' && parsed.career_role.trim()
        ? parsed.career_role.trim().slice(0, 100)
        : undefined;

    const workplaceContext =
      typeof parsed.workplace_context === 'string' && parsed.workplace_context.trim()
        ? parsed.workplace_context.trim().slice(0, 160)
        : undefined;

    const locationStatus =
      typeof parsed.location_status === 'string' &&
      VALID_LOCATION_STATUSES.has(parsed.location_status)
        ? (parsed.location_status as LocationContextStatus)
        : undefined;

    const deepBuckets: Partial<Record<DeepProfileBucketKey, string[]>> = {};
    if (
      parsed.deep_profile_buckets &&
      typeof parsed.deep_profile_buckets === 'object' &&
      !Array.isArray(parsed.deep_profile_buckets)
    ) {
      const rawBuckets = parsed.deep_profile_buckets as Record<string, unknown>;
      for (const [bKey, bVal] of Object.entries(rawBuckets)) {
        if (!VALID_DEEP_BUCKETS.has(bKey) || !Array.isArray(bVal)) continue;
        const cleanedArr = bVal
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.replace(/\s+/g, ' ').trim().slice(0, 180))
          .filter((item) => item.length >= 4)
          .slice(0, 3);
        if (cleanedArr.length > 0) {
          deepBuckets[bKey as DeepProfileBucketKey] = cleanedArr;
        }
      }
    }

    const citedInsights: NonNullable<ExtractedLifeFactsPatch['cited_insights']> = [];
    if (Array.isArray(parsed.cited_insights)) {
      for (const rawItem of parsed.cited_insights.slice(0, 6)) {
        if (!rawItem || typeof rawItem !== 'object') continue;
        const row = rawItem as Record<string, unknown>;
        const rawCat = typeof row.category === 'string' ? row.category.trim() : '';
        const category: CitedInsightCategory = VALID_CITED_INSIGHT_CATEGORIES.has(rawCat)
          ? (rawCat as CitedInsightCategory)
          : 'practical_life';
        const rawBucket = typeof row.bucket === 'string' ? row.bucket.trim() : '';
        const bucket = VALID_DEEP_BUCKETS.has(rawBucket)
          ? (rawBucket as DeepProfileBucketKey)
          : undefined;
        const summary = typeof row.summary === 'string' ? row.summary.trim().slice(0, 180) : '';
        if (!summary || summary.length < 4) continue;
        const supersedesTopic =
          typeof row.supersedes_topic === 'string' && row.supersedes_topic.trim().length >= 3
            ? row.supersedes_topic.trim().slice(0, 48)
            : undefined;
        citedInsights.push({
          category,
          ...(bucket ? { bucket } : {}),
          summary,
          ...(supersedesTopic ? { supersedes_topic: supersedesTopic } : {}),
          cited_by: actorCitation,
          ...(actorSlug ? { cited_slug: actorSlug } : {}),
          conversation_id: turnContext?.conversationId || null,
        });
      }
    }

    const hasDeepBuckets = Object.keys(deepBuckets).length > 0;
    if (
      milestones.length === 0 &&
      stressAreas.length === 0 &&
      !relStatus &&
      !marriageYear &&
      hasChildren === undefined &&
      !childrenSummary &&
      !careerMode &&
      !careerRole &&
      !workplaceContext &&
      !locationStatus &&
      !hasDeepBuckets &&
      citedInsights.length === 0
    ) {
      return [];
    }

    const patchPayload: ExtractedLifeFactsPatch = {
      milestones,
      core_stress_areas: stressAreas,
      relationship_status: relStatus,
      marriage_year: marriageYear,
      has_children: hasChildren,
      children_summary: childrenSummary,
      career_mode: careerMode,
      career_role: careerRole,
      workplace_context: workplaceContext,
      location_status: locationStatus,
      supersede_status_updates: Boolean(parsed.supersede_status_updates),
      ...(hasDeepBuckets ? { deep_profile_buckets: deepBuckets } : {}),
      cited_insights: citedInsights,
      actor_citation: actorCitation,
      actor_slug: actorSlug,
      conversation_id: turnContext?.conversationId || null,
    };

    const mergedLife = mergeExtractedLifeFacts(profile.life_context_json, patchPayload);
    const mergedDeep = hasDeepProfileCol
      ? mergeExtractedDeepProfile(profile.deep_profile_json, patchPayload)
      : { sanitized: {}, changed: false };

    if (mergedLife.changed || mergedDeep.changed) {
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (mergedLife.changed) {
        updatePayload.life_context_json = mergedLife.sanitized;
        updatePayload.life_context_completeness = mergedLife.completeness;
      }
      if (hasDeepProfileCol && mergedDeep.changed) {
        updatePayload.deep_profile_json = mergedDeep.sanitized;
      }

      const updateRes = await supabaseAdmin
        .from('profiles')
        .update(updatePayload)
        .eq('id', profileId)
        .eq('user_id', userId);

      if (updateRes.error && hasDeepProfileCol && mergedLife.changed) {
        await supabaseAdmin
          .from('profiles')
          .update({
            life_context_json: mergedLife.sanitized,
            life_context_completeness: mergedLife.completeness,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profileId)
          .eq('user_id', userId);
      }
    }

    return stressAreas;
  } catch (err) {
    console.warn('[memoryArchivist] Non-fatal life-event extraction error:', err);
    return [];
  }
}

export async function updateCompanionProfileMemoryAfterTurn(params: {
  profileId: string;
  userId: string;
  companionName: string;
  companionRole?: string | null;
  companionSlug: string;
  conversationId?: string | null;
  latestUserPrompt: string;
  latestAssistantAnswer?: string;
}): Promise<void> {
  if (!params.profileId || !params.userId || !params.latestUserPrompt?.trim()) return;
  const cleanName = params.companionName.trim() || 'Companion';
  const cleanRole = (params.companionRole || '').trim();
  const actorCitation = cleanRole ? `${cleanName} · ${cleanRole}` : cleanName;
  await extractAndPersistDeepProfileFacts(params.profileId, params.userId, {
    latestUserPrompt: params.latestUserPrompt,
    latestAssistantAnswer: params.latestAssistantAnswer,
    actorCitation,
    actorSlug: params.companionSlug,
    conversationId: params.conversationId || null,
  });
}

async function updateSilentUserIntelligence(
  userId: string,
  turnContext?: ArchivistTurnContext
): Promise<void> {
  if (!turnContext) return;
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  try {
    const { data: userRow, error: readErr } = await supabaseAdmin
      .from('users')
      .select('sutra_user_profile_json')
      .eq('id', userId)
      .maybeSingle();

    if (readErr) {
      // Gracefully skip if Migration 011 column is not yet applied
      return;
    }

    const existing = (userRow?.sutra_user_profile_json || null) as Partial<VedicUserProfile> | null;
    const updated = computeUpdatedVedicUserProfile(existing, turnContext);

    await supabaseAdmin
      .from('users')
      .update({ sutra_user_profile_json: updated })
      .eq('id', userId);
  } catch {
    // Non-fatal silent telemetry error
  }
}

/**
 * Incrementally summarizes the latest consultation exchange into `profiles.profile_memory_summary`,
 * silently extracts dated milestones + recurring stress areas into `life_context_json`,
 * AND updates silent user intelligence (`users.sutra_user_profile_json`) in the background.
 */
export async function updateProfileMemoryAfterTurn(
  profileId: string,
  userId: string,
  turnContext?: ArchivistTurnContext
): Promise<void> {
  const extractedStress = await extractAndPersistDeepProfileFacts(
    profileId,
    userId,
    turnContext
  ).catch(() => [] as string[]);
  const enrichedTurnContext: ArchivistTurnContext | undefined = turnContext
    ? {
        ...turnContext,
        extractedStressAreas: mergeCoreStressAreas(
          turnContext.extractedStressAreas,
          extractedStress
        ),
      }
    : undefined;

  await Promise.allSettled([
    rebuildProfileMemory(profileId, userId, turnContext),
    updateSilentUserIntelligence(userId, enrichedTurnContext),
  ]);
}

/**
 * Rebuilds a profile's longitudinal memory strictly from non-deleted, non-excluded messages
 * across its conversations so excluded/deleted topics never linger in memory.
 */
export async function rebuildProfileMemory(
  profileId: string,
  userId: string,
  turnContext?: Pick<ArchivistTurnContext, 'latestUserPrompt' | 'latestAssistantAnswer'>
): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !(await isOpenRouterConfiguredAsync())) return;

  try {
    const [{ data: profile }, engineOverrides] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id, name, user_id, profile_memory_summary')
        .eq('id', profileId)
        .eq('user_id', userId)
        .maybeSingle(),
      getEnginePromptOverrides().catch(() => ({} as Record<string, never>)),
    ]);

    if (!profile) return;

    const { data: conversations } = await supabaseAdmin
      .from('conversations')
      .select('id, title')
      .eq('profile_id', profileId)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(12);

    if (!conversations || conversations.length === 0) {
      await supabaseAdmin
        .from('profiles')
        .update({ profile_memory_summary: null })
        .eq('id', profileId);
      return;
    }

    const convoIds = conversations.map((c) => c.id);
    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('conversation_id, role, content, created_at, excluded_from_context')
      .in('conversation_id', convoIds)
      .eq('excluded_from_context', false)
      .order('created_at', { ascending: false })
      .limit(36);

    if (!messages || messages.length === 0) {
      await supabaseAdmin
        .from('profiles')
        .update({ profile_memory_summary: null })
        .eq('id', profileId);
      return;
    }

    const chronological = [...messages].reverse();
    const transcript = chronological
      .map((m) => `${m.role === 'user' ? 'USER' : 'COUNCIL'}: ${String(m.content).slice(0, 600)}`)
      .join('\n\n');

    const latestUserEx =
      turnContext?.latestUserPrompt?.trim() ||
      [...chronological].reverse().find((m) => m.role === 'user')?.content ||
      '';
    const latestAssistantEx =
      turnContext?.latestAssistantAnswer?.trim() ||
      [...chronological].reverse().find((m) => m.role === 'assistant')?.content ||
      '';

    const synthesizerTemplate =
      engineOverrides.memory_profile_synthesizer_prompt?.trim() ||
      DEFAULT_MEMORY_PROFILE_SYNTHESIZER_PROMPT;

    const renderedPrompt = applyPromptTemplate(synthesizerTemplate, {
      PROFILE_NAME: String(profile.name || 'Profile'),
      EXISTING_SUMMARY:
        typeof profile.profile_memory_summary === 'string' && profile.profile_memory_summary.trim()
          ? profile.profile_memory_summary.trim()
          : '(none recorded yet)',
      USER_MESSAGE: String(latestUserEx).slice(0, 1200),
      ASSISTANT_REPLY: String(latestAssistantEx).slice(0, 1200),
      TRANSCRIPT: transcript.slice(0, 3600),
    });

    const finalSynthPrompt = renderedPrompt.includes(transcript.slice(0, 80))
      ? renderedPrompt
      : `${renderedPrompt}\n\nRECENT ACTIVE SESSION EXCERPTS (For "${profile.name}"):\n${transcript.slice(0, 3200)}`;

    const utilityModel = await getUtilityModelAsync();
    const completion = await createOpenRouterCompletion({
      model: utilityModel,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: finalSynthPrompt,
        },
      ],
    });

    const summary = completion.text.trim() || null;
    await supabaseAdmin
      .from('profiles')
      .update({
        profile_memory_summary: summary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId);
  } catch (err) {
    console.warn('[memoryArchivist] Non-fatal memory rebuild error:', err);
  }
}

export async function compactConversationThreadMemory(params: {
  conversationId: string;
  userId: string;
  previousSummary?: string | null;
  messagesToCompact: Array<{ role: string; content: string }>;
  totalCompactedCount: number;
}): Promise<string | null> {
  if (!params.conversationId || !params.userId || params.messagesToCompact.length === 0) {
    return null;
  }
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !(await isOpenRouterConfiguredAsync())) return null;

  try {
    const [engineOverrides, utilityModel] = await Promise.all([
      getEnginePromptOverrides().catch(() => ({} as Record<string, never>)),
      getUtilityModelAsync(),
    ]);

    const messagesBlock = params.messagesToCompact
      .map((m) => {
        const speaker = m.role === 'assistant' ? 'ASSISTANT' : 'USER';
        const cleaned = String(m.content || '')
          .replace(/\[\[BUBBLE\]\]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 700);
        return `${speaker}: ${cleaned}`;
      })
      .join('\n\n')
      .slice(0, 9500);

    const template =
      engineOverrides.memory_rolling_thread_compactor_prompt?.trim() ||
      DEFAULT_MEMORY_ROLLING_THREAD_COMPACTOR_PROMPT;

    const rendered = applyPromptTemplate(template, {
      PREVIOUS_SUMMARY: params.previousSummary?.trim() || '(none yet — start fresh from these turns)',
      MESSAGES_BLOCK: messagesBlock,
    });

    const completion = await createOpenRouterCompletion({
      model: utilityModel,
      temperature: 0.2,
      disableReasoning: true,
      maxTokens: 540,
      messages: [{ role: 'user', content: rendered }],
    });

    const nextSummary = completion.text.trim().slice(0, 2600);
    if (!nextSummary) return null;

    const { error } = await supabaseAdmin
      .from('conversations')
      .update({
        thread_memory_summary: nextSummary,
        thread_memory_msg_count: Math.max(0, Math.trunc(params.totalCompactedCount)),
      })
      .eq('id', params.conversationId)
      .eq('user_id', params.userId);

    if (error) {
      // Gracefully ignore if Migration 018 columns aren't applied yet
      return null;
    }
    return nextSummary;
  } catch (err) {
    console.warn('[memoryArchivist] Non-fatal thread compaction error:', err);
    return null;
  }
}

export async function extractAndPersistCouncilAnalystNotes(params: {
  profileId: string;
  userId: string;
  conversationId?: string | null;
  expertLabel: string;
  expertSlug: string;
  userPrompt: string;
  assistantAnswer: string;
}): Promise<void> {
  if (!params.profileId || !params.userId) return;
  const promptClean = String(params.userPrompt || '').trim();
  const answerClean = String(params.assistantAnswer || '')
    .replace(/\[\[BUBBLE\]\]/g, ' ')
    .trim();
  if (promptClean.length < 6 || answerClean.length < 80 || TRIVIAL_ACK_RE.test(promptClean)) {
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !(await isOpenRouterConfiguredAsync())) return;

  try {
    const { data: profile, error: readErr } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, analyst_notes_json')
      .eq('id', params.profileId)
      .eq('user_id', params.userId)
      .maybeSingle();

    if (readErr || !profile) {
      // Gracefully skip if Migration 018 analyst_notes_json is not yet applied
      return;
    }

    const utilityModel = await getUtilityModelAsync();
    const completion = await createOpenRouterCompletion({
      model: utilityModel,
      jsonMode: true,
      disableReasoning: true,
      temperature: 0.1,
      maxTokens: 280,
      messages: [
        {
          role: 'user',
          content: `Distill 0 to 2 concise factual chart/timing takeaways from this ${params.expertLabel} reading so a chart-aware Companion can stay aligned with the user's Council readings.

RULES:
- Only record concrete structural findings, planetary strengths/cancellations, or Dasha/transit timing windows explicitly stated in the ASSISTANT REPLY.
- Never invent placements, degrees, or dates not in the reply.
- Keep each note calm, grounded, and under 200 characters (return {"notes": []} if the reply is purely introductory or non-chart-specific).

USER QUESTION: ${promptClean.slice(0, 400)}

ASSISTANT REPLY EXCERPT:
${answerClean.slice(0, 2200)}

Return strictly JSON: {"notes": ["..."]}`,
        },
      ],
    });

    const parsed = safeExtractJson<{ notes?: unknown }>(completion.text, {});
    const rawNotes = Array.isArray(parsed.notes)
      ? parsed.notes.filter((n): n is string => typeof n === 'string' && n.trim().length >= 8).slice(0, 2)
      : [];

    if (rawNotes.length === 0) return;

    const { notes, changed } = appendCouncilAnalystNotes(
      (profile as { analyst_notes_json?: unknown }).analyst_notes_json,
      rawNotes.map((summary) => ({
        summary: summary.trim().slice(0, 220),
        system_label: params.expertLabel.trim() || 'Cosmic Council',
        system_slug: params.expertSlug.trim() || 'vedic_astrologer',
        conversation_id: params.conversationId || null,
      }))
    );

    if (changed) {
      await supabaseAdmin
        .from('profiles')
        .update({
          analyst_notes_json: notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.profileId)
        .eq('user_id', params.userId);
    }
  } catch (err) {
    console.warn('[memoryArchivist] Non-fatal analyst notes extraction error:', err);
  }
}

// =============================================================================
// COMPANIONS v2: PER-(USER × COMPANION) SHARED BOND & RELATIONSHIP EVOLUTION
// =============================================================================

export type CompanionRelationshipStage = 'just_met' | 'warming_up' | 'close_confidant';

export interface CompanionRelationshipState {
  familiarity_stage: CompanionRelationshipStage;
  total_turns: number;
  user_slang_cues: string[];
  tone_preferences: string[];
  inside_references: string[];
  hearted_excerpts: string[];
}

export interface CompanionBondState {
  companion_slug: string;
  memory_summary: string | null;
  relationship_state: CompanionRelationshipState;
  last_interaction_at: string | null;
}

const DEFAULT_RELATIONSHIP_STATE: CompanionRelationshipState = {
  familiarity_stage: 'just_met',
  total_turns: 0,
  user_slang_cues: [],
  tone_preferences: [],
  inside_references: [],
  hearted_excerpts: [],
};

export function computeFamiliarityStage(totalTurns: number): CompanionRelationshipStage {
  if (totalTurns <= 5) return 'just_met';
  if (totalTurns <= 20) return 'warming_up';
  return 'close_confidant';
}

function cleanStringList(input: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const cleaned = raw
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLen);
    if (!cleaned || cleaned.length < 2) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function normalizeCompanionRelationshipState(raw: unknown): CompanionRelationshipState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_RELATIONSHIP_STATE };
  }
  const rec = raw as Record<string, unknown>;
  const turnsRaw = Number(rec.total_turns);
  const totalTurns = Number.isFinite(turnsRaw) && turnsRaw >= 0 ? Math.trunc(turnsRaw) : 0;
  const stage: CompanionRelationshipStage =
    rec.familiarity_stage === 'close_confidant' ||
    rec.familiarity_stage === 'warming_up' ||
    rec.familiarity_stage === 'just_met'
      ? rec.familiarity_stage
      : computeFamiliarityStage(totalTurns);

  return {
    familiarity_stage: stage,
    total_turns: totalTurns,
    user_slang_cues: cleanStringList(rec.user_slang_cues, 8, 60),
    tone_preferences: cleanStringList(rec.tone_preferences, 6, 80),
    inside_references: cleanStringList(rec.inside_references, 8, 90),
    hearted_excerpts: cleanStringList(rec.hearted_excerpts, 6, 140),
  };
}

function isMissingRelationError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const rec = err as { code?: string; message?: string };
  const msg = String(rec.message || '').toLowerCase();
  return rec.code === '42P01' || msg.includes('does not exist') || msg.includes('companion_bonds');
}

export async function getCompanionBond(
  userId: string,
  companionSlug: string
): Promise<CompanionBondState> {
  const normalizedSlug = String(companionSlug || '').trim().toLowerCase();
  const emptyBond: CompanionBondState = {
    companion_slug: normalizedSlug,
    memory_summary: null,
    relationship_state: { ...DEFAULT_RELATIONSHIP_STATE },
    last_interaction_at: null,
  };

  if (!userId || !normalizedSlug) return emptyBond;
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return emptyBond;

  try {
    const { data, error } = await supabaseAdmin
      .from('companion_bonds')
      .select('companion_slug, memory_summary, relationship_state_json, last_interaction_at')
      .eq('user_id', userId)
      .eq('companion_slug', normalizedSlug)
      .maybeSingle();

    if (error || !data) {
      return emptyBond;
    }

    const row = data as Record<string, unknown>;
    return {
      companion_slug: normalizedSlug,
      memory_summary:
        typeof row.memory_summary === 'string' && row.memory_summary.trim()
          ? row.memory_summary.trim()
          : null,
      relationship_state: normalizeCompanionRelationshipState(row.relationship_state_json),
      last_interaction_at:
        typeof row.last_interaction_at === 'string' ? row.last_interaction_at : null,
    };
  } catch {
    return emptyBond;
  }
}

export async function recordCompanionBubbleReactionBond(params: {
  userId: string;
  companionSlug: string;
  excerpt: string;
  reacted: 'heart' | 'felt' | null;
}): Promise<void> {
  const normalizedSlug = String(params.companionSlug || '').trim().toLowerCase();
  if (!params.userId || !normalizedSlug) return;

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  const cleanExcerpt = String(params.excerpt || '')
    .replace(/\[\[BUBBLE\]\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  if (!cleanExcerpt) return;

  try {
    const current = await getCompanionBond(params.userId, normalizedSlug);
    const prevList = current.relationship_state.hearted_excerpts;
    let nextHearted: string[];

    if (params.reacted) {
      const deduped = prevList.filter(
        (item) => item.toLowerCase() !== cleanExcerpt.toLowerCase()
      );
      nextHearted = [cleanExcerpt, ...deduped].slice(0, 6);
    } else {
      nextHearted = prevList.filter(
        (item) => item.toLowerCase() !== cleanExcerpt.toLowerCase()
      );
    }

    const nextRelState: CompanionRelationshipState = {
      ...current.relationship_state,
      hearted_excerpts: nextHearted,
    };

    const { error } = await supabaseAdmin
      .from('companion_bonds')
      .upsert(
        {
          user_id: params.userId,
          companion_slug: normalizedSlug,
          memory_summary: current.memory_summary,
          relationship_state_json: nextRelState,
          last_interaction_at: current.last_interaction_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,companion_slug' }
      );

    if (error && !isMissingRelationError(error)) {
      console.warn('[memoryArchivist] Companion reaction bond update skipped:', error.message);
    }
  } catch {
    // Non-fatal silent relationship update
  }
}

export async function updateCompanionBondAfterTurn(params: {
  userId: string;
  companionSlug: string;
  companionName: string;
  userPrompt: string;
  assistantAnswer: string;
}): Promise<void> {
  const normalizedSlug = String(params.companionSlug || '').trim().toLowerCase();
  if (!params.userId || !normalizedSlug) return;

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  try {
    const current = await getCompanionBond(params.userId, normalizedSlug);
    const nextTurns = current.relationship_state.total_turns + 1;
    const nextStage = computeFamiliarityStage(nextTurns);

    let nextSummary = current.memory_summary;
    let nextRelState: CompanionRelationshipState = {
      ...current.relationship_state,
      total_turns: nextTurns,
      familiarity_stage: nextStage,
    };

    const promptClean = String(params.userPrompt || '').trim();
    const answerClean = String(params.assistantAnswer || '')
      .replace(/\[\[BUBBLE\]\]/g, ' ')
      .trim();

    // Distill incremental relationship & shared memory safely in the background
    if (promptClean.length >= 4 && (await isOpenRouterConfiguredAsync())) {
      try {
        const [utilityModel, engineOverrides] = await Promise.all([
          getUtilityModelAsync(),
          getEnginePromptOverrides().catch(() => ({} as Record<string, never>)),
        ]);
        const bondTemplate =
          engineOverrides.memory_companion_bond_prompt?.trim() ||
          engineOverrides.companion_bond_extractor_prompt?.trim() ||
          DEFAULT_MEMORY_COMPANION_BOND_PROMPT;
        const bondPrompt = applyPromptTemplate(bondTemplate, {
          COMPANION_NAME: params.companionName,
          EXISTING_SUMMARY: current.memory_summary || '(none yet)',
          EXISTING_SLANG: JSON.stringify(current.relationship_state.user_slang_cues),
          EXISTING_TONE: JSON.stringify(current.relationship_state.tone_preferences),
          EXISTING_REFS: JSON.stringify(current.relationship_state.inside_references),
          USER_MESSAGE: promptClean.slice(0, 900),
          ASSISTANT_REPLY: answerClean.slice(0, 900),
        });

        const completion = await createOpenRouterCompletion({
          model: utilityModel,
          jsonMode: true,
          disableReasoning: true,
          temperature: 0.2,
          maxTokens: 340,
          messages: [
            {
              role: 'user',
              content: bondPrompt,
            },
          ],
        });

        const parsed = safeExtractJson<{
          memory_summary?: unknown;
          user_slang_cues?: unknown;
          tone_preferences?: unknown;
          inside_references?: unknown;
        }>(completion.text, {});

        if (typeof parsed.memory_summary === 'string' && parsed.memory_summary.trim()) {
          nextSummary = parsed.memory_summary.trim().slice(0, 1200);
        }
        const mergedSlang = cleanStringList(
          [
            ...(Array.isArray(parsed.user_slang_cues) ? parsed.user_slang_cues : []),
            ...current.relationship_state.user_slang_cues,
          ],
          6,
          60
        );
        const mergedTone = cleanStringList(
          [
            ...(Array.isArray(parsed.tone_preferences) ? parsed.tone_preferences : []),
            ...current.relationship_state.tone_preferences,
          ],
          5,
          80
        );
        const mergedRefs = cleanStringList(
          [
            ...(Array.isArray(parsed.inside_references) ? parsed.inside_references : []),
            ...current.relationship_state.inside_references,
          ],
          6,
          90
        );

        nextRelState = {
          ...nextRelState,
          user_slang_cues: mergedSlang,
          tone_preferences: mergedTone,
          inside_references: mergedRefs,
        };
      } catch {
        // Keep deterministic turn count & existing memory cleanly on transient LLM error
      }
    }

    const nowIso = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('companion_bonds')
      .upsert(
        {
          user_id: params.userId,
          companion_slug: normalizedSlug,
          memory_summary: nextSummary,
          relationship_state_json: nextRelState,
          last_interaction_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: 'user_id,companion_slug' }
      );

    if (error && !isMissingRelationError(error)) {
      console.warn('[memoryArchivist] Companion bond upsert error:', error.message);
    }
  } catch (err) {
    console.warn('[memoryArchivist] Non-fatal companion bond error:', err);
  }
}
