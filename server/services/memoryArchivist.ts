import type {
  CareerContextMode,
  RelationshipContextStatus,
} from '../../lib/lifeContextSchema';
import {
  VALID_ANCHOR_TAGS,
  VALID_CAREER_MODES,
  VALID_RELATIONSHIP_STATUSES,
} from '../../lib/lifeContextSchema';
import type { Stage1RouterResult, UserFluencyTier, VedicUserProfile } from '../../lib/vedicTypes';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { mergeExtractedLifeFacts } from './lifeContextGuard';
import {
  createOpenRouterCompletion,
  getUtilityModelAsync,
  isOpenRouterConfiguredAsync,
  safeExtractJson,
} from './openrouter';

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

async function extractAndPersistLifeEvents(
  profileId: string,
  userId: string,
  turnContext?: ArchivistTurnContext
): Promise<string[]> {
  const userPrompt = (turnContext?.latestUserPrompt || '').trim();
  if (userPrompt.length < 12) return [];

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !(await isOpenRouterConfiguredAsync())) return [];

  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, life_context_json')
      .eq('id', profileId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!profile) return [];

    const utilityModel = await getUtilityModelAsync();
    const completion = await createOpenRouterCompletion({
      model: utilityModel,
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 320,
      messages: [
        {
          role: 'user',
          content: `Extract ONLY explicit, real-world facts stated by the user in this message. NEVER guess or invent years.
Return strictly JSON:
{
  "milestones": [{"year": 2019, "tag": "married", "note": "short 3-8 word fact"}],
  "core_stress_areas": ["concise recurring life concern if clearly expressed"],
  "relationship_status": null,
  "marriage_year": null,
  "has_children": null,
  "career_mode": null
}

Allowed milestone tags: ${Array.from(VALID_ANCHOR_TAGS).join(', ')}.
Allowed relationship_status: ${Array.from(VALID_RELATIONSHIP_STATUSES).join(', ')} or null.
Allowed career_mode: ${Array.from(VALID_CAREER_MODES).join(', ')} or null.
Rules:
- Only include a milestone if the user explicitly stated the exact 4-digit year in their message (e.g. "married in 2019", "started job in 2018", "lost my father in 2021").
- core_stress_areas: 0 to 2 concise themes (e.g. "relationship friction with ex", "delayed marriage despite career success", "debt recovery pressure"). Empty array if none.

USER MESSAGE:
${userPrompt.slice(0, 1400)}`,
        },
      ],
    });

    const parsed = safeExtractJson<{
      milestones?: unknown;
      core_stress_areas?: unknown;
      relationship_status?: unknown;
      marriage_year?: unknown;
      has_children?: unknown;
      career_mode?: unknown;
    }>(completion.text, {});

    const milestones: Array<{ year: number; tag: string; note?: string }> = [];
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

    if (
      milestones.length === 0 &&
      stressAreas.length === 0 &&
      !relStatus &&
      !marriageYear &&
      hasChildren === undefined &&
      !careerMode
    ) {
      return [];
    }

    const merged = mergeExtractedLifeFacts(profile.life_context_json, {
      milestones,
      core_stress_areas: stressAreas,
      relationship_status: relStatus,
      marriage_year: marriageYear,
      has_children: hasChildren,
      career_mode: careerMode,
    });

    if (merged.changed) {
      await supabaseAdmin
        .from('profiles')
        .update({
          life_context_json: merged.sanitized,
          life_context_completeness: merged.completeness,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId)
        .eq('user_id', userId);
    }

    return stressAreas;
  } catch (err) {
    console.warn('[memoryArchivist] Non-fatal life-event extraction error:', err);
    return [];
  }
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
  const extractedStress = await extractAndPersistLifeEvents(profileId, userId, turnContext).catch(
    () => [] as string[]
  );
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
    rebuildProfileMemory(profileId, userId),
    updateSilentUserIntelligence(userId, enrichedTurnContext),
  ]);
}

/**
 * Rebuilds a profile's longitudinal memory strictly from non-deleted, non-excluded messages
 * across its conversations so excluded/deleted topics never linger in memory.
 */
export async function rebuildProfileMemory(
  profileId: string,
  userId: string
): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin || !(await isOpenRouterConfiguredAsync())) return;

  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, name, user_id')
      .eq('id', profileId)
      .eq('user_id', userId)
      .maybeSingle();

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

    const transcript = [...messages]
      .reverse()
      .map((m) => `${m.role === 'user' ? 'USER' : 'COUNCIL'}: ${String(m.content).slice(0, 600)}`)
      .join('\n\n');

    const utilityModel = await getUtilityModelAsync();
    const completion = await createOpenRouterCompletion({
      model: utilityModel,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `Summarize the longitudinal consultation memory for profile "${profile.name}" from these recent active consultation excerpts.
Focus strictly on:
- Key life events, goals, or decisions the user shared (e.g., marriage, career change, relocation, health focus).
- Major astrological themes and active timing cycles (Dasha, Annual Profection, Progressions, or Transit periods) already explored so future sessions remain coherent without repeating basics.
Keep the summary under 220 words in concise bullet points.

TRANSCRIPT EXCERPTS:
${transcript}`,
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
