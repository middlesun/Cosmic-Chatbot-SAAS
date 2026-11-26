import {
  computeLifeContextCompleteness,
  DEEP_PROFILE_BUCKET_LABELS,
  VALID_ANCHOR_TAGS,
  VALID_BIRTH_TIME_ACCURACIES,
  VALID_CAREER_MODES,
  VALID_CITED_INSIGHT_CATEGORIES,
  VALID_LOCATION_STATUSES,
  VALID_RELATIONSHIP_STATUSES,
  type BirthTimeAccuracy,
  type CareerContextMode,
  type CitedInsightCategory,
  type CitedProfileInsight,
  type CouncilAnalystNote,
  type DeepProfileBucketKey,
  type DeepProfileData,
  type DeepProfileEntry,
  type LifeContextAnchor,
  type LifeContextChild,
  type LifeContextData,
  type LocationContextStatus,
  type RelationshipContextStatus,
  type UserContextPreferences,
  DEFAULT_USER_CONTEXT_PREFERENCES,
} from '../../lib/lifeContextSchema';
import type { ClarificationPayload } from '../../lib/vedicTypes';

export type {
  BirthTimeAccuracy,
  CareerContextMode,
  CitedInsightCategory,
  CitedProfileInsight,
  CouncilAnalystNote,
  DeepProfileBucketKey,
  DeepProfileData,
  DeepProfileEntry,
  LifeContextAnchor,
  LifeContextChild,
  LifeContextData,
  LocationContextStatus,
  RelationshipContextStatus,
  UserContextPreferences,
};
export { computeLifeContextCompleteness, DEFAULT_USER_CONTEXT_PREFERENCES };

const MAX_CHILDREN = 10;
const MAX_ANCHORS = 12;
const MAX_STRESS_AREAS = 10;
const MAX_CITED_INSIGHTS = 40;
const MAX_BUCKET_ITEMS = 14;
const MAX_DEEP_ENTRIES = 60;
const MAX_ANALYST_NOTES = 24;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_24H_RE = /^\d{2}:\d{2}(:\d{2})?$/;
const VALID_DEEP_BUCKET_KEYS = new Set<string>(Object.keys(DEEP_PROFILE_BUCKET_LABELS));

function clampYear(val: unknown, min = 1920, max = new Date().getFullYear() + 1): number | undefined {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isInteger(num) || num < min || num > max) return undefined;
  return num;
}

function cleanShortText(val: unknown, maxLen: number): string | undefined {
  if (typeof val !== 'string') return undefined;
  const cleaned = val
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
  return cleaned || undefined;
}

function buildInsightId(category: string, summary: string): string {
  const slug = summary
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  return `${category}_${slug || 'note'}`;
}

/**
 * Validates and sanitizes an incoming Desh-Kaal-Patra life_context_json payload.
 * Drops unknown keys or invalid enums safely while preserving intentional clears.
 */
export function sanitizeLifeContext(rawInput: unknown): {
  sanitized: LifeContextData;
  completeness: number;
} {
  const src =
    rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput)
      ? (rawInput as Record<string, unknown>)
      : {};

  const sanitized: LifeContextData = {};

  if (
    typeof src.birth_time_accuracy === 'string' &&
    VALID_BIRTH_TIME_ACCURACIES.has(src.birth_time_accuracy)
  ) {
    sanitized.birth_time_accuracy = src.birth_time_accuracy as BirthTimeAccuracy;
  }

  if (
    typeof src.relationship_status === 'string' &&
    VALID_RELATIONSHIP_STATUSES.has(src.relationship_status)
  ) {
    sanitized.relationship_status = src.relationship_status as RelationshipContextStatus;
  }

  const marriageYear = clampYear(src.marriage_year, 1940);
  if (marriageYear !== undefined) {
    sanitized.marriage_year = marriageYear;
  }

  if (typeof src.has_children === 'boolean') {
    sanitized.has_children = src.has_children;
  }

  if (Array.isArray(src.children)) {
    const cleanedChildren: LifeContextChild[] = [];
    for (const item of src.children) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const gender = row.gender === 'male' || row.gender === 'female' ? row.gender : null;
      const birthYear = clampYear(row.birth_year, 1940);
      if (!gender || birthYear === undefined) continue;

      const entry: LifeContextChild = {
        gender,
        birth_year: birthYear,
      };
      if (typeof row.optional_birth_date === 'string' && ISO_DATE_RE.test(row.optional_birth_date.trim())) {
        entry.optional_birth_date = row.optional_birth_date.trim();
      }
      if (typeof row.optional_birth_time === 'string' && TIME_24H_RE.test(row.optional_birth_time.trim())) {
        entry.optional_birth_time = row.optional_birth_time.trim().slice(0, 5);
      }
      const birthPlace = cleanShortText(row.optional_birth_place, 80);
      if (birthPlace) {
        entry.optional_birth_place = birthPlace;
      }

      cleanedChildren.push(entry);
      if (cleanedChildren.length >= MAX_CHILDREN) break;
    }
    if (cleanedChildren.length > 0) {
      sanitized.children = cleanedChildren;
      if (sanitized.has_children === undefined) {
        sanitized.has_children = true;
      }
    }
  }

  const childrenSummary = cleanShortText(src.children_summary, 140);
  if (childrenSummary) {
    sanitized.children_summary = childrenSummary;
  }

  if (sanitized.relationship_status === 'married_with_children') {
    sanitized.has_children = true;
  }

  if (typeof src.career_mode === 'string' && VALID_CAREER_MODES.has(src.career_mode)) {
    sanitized.career_mode = src.career_mode as CareerContextMode;
  }

  const careerRole = cleanShortText(src.career_role, 100);
  if (careerRole) {
    sanitized.career_role = careerRole;
  }

  const workplaceContext = cleanShortText(src.workplace_context, 160);
  if (workplaceContext) {
    sanitized.workplace_context = workplaceContext;
  }

  if (typeof src.location_status === 'string' && VALID_LOCATION_STATUSES.has(src.location_status)) {
    sanitized.location_status = src.location_status as LocationContextStatus;
  }

  if (Array.isArray(src.past_anchors)) {
    const anchorMap = new Map<string, LifeContextAnchor>();
    for (const item of src.past_anchors) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const year = clampYear(row.year, 1930);
      const rawTag = typeof row.tag === 'string' ? row.tag.trim() : '';
      const safeTag = VALID_ANCHOR_TAGS.has(rawTag)
        ? rawTag
        : cleanShortText(rawTag, 32)?.toLowerCase().replace(/[^a-z0-9_]+/g, '_');
      if (year === undefined || !safeTag) continue;

      const note = cleanShortText(row.note, 80);
      const citedBy = cleanShortText(row.cited_by, 64);
      const citedSlug = cleanShortText(row.cited_slug, 64);
      const dedupeKey = `${year}:${safeTag}`;
      const existing = anchorMap.get(dedupeKey);
      if (!existing || ((note?.length || 0) > (existing.note?.length || 0))) {
        anchorMap.set(dedupeKey, {
          year,
          tag: safeTag,
          ...(note ? { note } : existing?.note ? { note: existing.note } : {}),
          ...(citedBy ? { cited_by: citedBy } : existing?.cited_by ? { cited_by: existing.cited_by } : {}),
          ...(citedSlug
            ? { cited_slug: citedSlug }
            : existing?.cited_slug
            ? { cited_slug: existing.cited_slug }
            : {}),
        });
      }
      if (anchorMap.size >= MAX_ANCHORS) break;
    }
    if (anchorMap.size > 0) {
      const cleanedAnchors = Array.from(anchorMap.values()).sort((a, b) => a.year - b.year);
      sanitized.past_anchors = cleanedAnchors;
    }
  }

  if (Array.isArray(src.core_stress_areas)) {
    const seenStress = new Set<string>();
    const cleanedStress: string[] = [];
    for (const rawItem of src.core_stress_areas) {
      const text = cleanShortText(rawItem, 100);
      if (!text || text.length < 3) continue;
      const key = text.toLowerCase();
      if (seenStress.has(key)) continue;
      seenStress.add(key);
      cleanedStress.push(text);
      if (cleanedStress.length >= MAX_STRESS_AREAS) break;
    }
    if (cleanedStress.length > 0) {
      sanitized.core_stress_areas = cleanedStress;
    }
  }

  if (Array.isArray(src.cited_insights)) {
    const insightMap = new Map<string, CitedProfileInsight>();
    for (const item of src.cited_insights) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const rawCat = typeof row.category === 'string' ? row.category.trim() : '';
      const category: CitedInsightCategory = VALID_CITED_INSIGHT_CATEGORIES.has(rawCat)
        ? (rawCat as CitedInsightCategory)
        : 'practical_life';
      const summary = cleanShortText(row.summary ?? row.fact, 180);
      if (!summary || summary.length < 4) continue;
      const citedBy = cleanShortText(row.cited_by, 64) || 'Cosmic Council';
      const citedSlug = cleanShortText(row.cited_slug, 64);
      const id = cleanShortText(row.id, 64) || buildInsightId(category, summary);
      const conversationId =
        typeof row.conversation_id === 'string' && row.conversation_id.trim()
          ? row.conversation_id.trim().slice(0, 80)
          : null;
      const updatedAt =
        typeof row.updated_at === 'string' && row.updated_at.trim()
          ? row.updated_at.trim().slice(0, 40)
          : new Date().toISOString();
      const capturedAt =
        typeof row.captured_at === 'string' && row.captured_at.trim()
          ? row.captured_at.trim().slice(0, 40)
          : updatedAt;

      const dedupeKey = summary.toLowerCase();
      if (!insightMap.has(dedupeKey)) {
        insightMap.set(dedupeKey, {
          id,
          category,
          summary,
          fact: summary,
          cited_by: citedBy,
          ...(citedSlug ? { cited_slug: citedSlug } : {}),
          ...(conversationId ? { conversation_id: conversationId } : {}),
          captured_at: capturedAt,
          updated_at: updatedAt,
        });
      }
      if (insightMap.size >= MAX_CITED_INSIGHTS) break;
    }
    if (insightMap.size > 0) {
      sanitized.cited_insights = Array.from(insightMap.values());
    }
  }

  sanitized.updated_at = new Date().toISOString();

  const completeness = computeLifeContextCompleteness(sanitized);
  return { sanitized, completeness };
}

/**
 * Merges a partial patch (such as from an in-chat clarification chip in Phase 3)
 * onto existing life_context_json and recalculates completeness safely.
 */
export function mergeLifeContextPatch(
  existingRaw: unknown,
  patchRaw: Partial<LifeContextData>
): { sanitized: LifeContextData; completeness: number } {
  const existing =
    existingRaw && typeof existingRaw === 'object' && !Array.isArray(existingRaw)
      ? (existingRaw as Record<string, unknown>)
      : {};
  return sanitizeLifeContext({
    ...existing,
    ...patchRaw,
  });
}

export interface ExtractedLifeFactsPatch {
  milestones?: Array<{ year: number; tag: string; note?: string; cited_by?: string; cited_slug?: string }>;
  core_stress_areas?: string[];
  relationship_status?: RelationshipContextStatus;
  marriage_year?: number;
  has_children?: boolean;
  children_summary?: string;
  career_mode?: CareerContextMode;
  career_role?: string;
  workplace_context?: string;
  location_status?: LocationContextStatus;
  supersede_status_updates?: boolean;
  deep_profile_buckets?: Partial<Record<DeepProfileBucketKey, string[]>>;
  cited_insights?: Array<{
    category: CitedInsightCategory;
    bucket?: DeepProfileBucketKey;
    summary: string;
    supersedes_topic?: string;
    cited_by?: string;
    cited_slug?: string;
    conversation_id?: string | null;
  }>;
  actor_citation?: string;
  actor_slug?: string;
  conversation_id?: string | null;
}

/**
 * Non-destructively merges silently extracted chat milestones, psychological/practical insights,
 * and recurring stress areas onto an existing `life_context_json` object with attribution citations.
 * When the user shares an explicit status update (e.g., job change, relationship change, relocation),
 * replaces the superseded entry cleanly rather than accumulating contradictions.
 */
export function mergeExtractedLifeFacts(
  existingRaw: unknown,
  extracted: ExtractedLifeFactsPatch
): { sanitized: LifeContextData; completeness: number; changed: boolean } {
  const { sanitized: base } = sanitizeLifeContext(existingRaw);
  const existingAnchors = Array.isArray(base.past_anchors) ? [...base.past_anchors] : [];
  const existingStress = Array.isArray(base.core_stress_areas) ? [...base.core_stress_areas] : [];
  let existingInsights = Array.isArray(base.cited_insights) ? [...base.cited_insights] : [];
  const defaultCitedBy = cleanShortText(extracted.actor_citation, 64) || 'Cosmic Council';
  const defaultCitedSlug = cleanShortText(extracted.actor_slug, 64);
  const defaultConvId = cleanShortText(extracted.conversation_id, 80) || null;
  const nowIso = new Date().toISOString();

  const incomingAnchors: LifeContextAnchor[] = (extracted.milestones || []).map((m) => ({
    ...m,
    cited_by: m.cited_by || defaultCitedBy,
    ...(m.cited_slug || defaultCitedSlug
      ? { cited_slug: m.cited_slug || defaultCitedSlug }
      : {}),
  }));

  // Remove contradicted older insights if incoming insights explicitly mark supersedes_topic
  const supersedeTopics = (extracted.cited_insights || [])
    .map((item) => cleanShortText(item.supersedes_topic, 48)?.toLowerCase())
    .filter((t): t is string => Boolean(t && t.length >= 3));
  if (supersedeTopics.length > 0) {
    existingInsights = existingInsights.filter((old) => {
      const text = old.summary.toLowerCase();
      return !supersedeTopics.some((topic) => text.includes(topic));
    });
  }

  const incomingInsights: CitedProfileInsight[] = (extracted.cited_insights || []).map((item) => ({
    id: buildInsightId(item.category, item.summary),
    category: item.category,
    summary: item.summary,
    fact: item.summary,
    cited_by: cleanShortText(item.cited_by, 64) || defaultCitedBy,
    ...(item.cited_slug || defaultCitedSlug
      ? { cited_slug: item.cited_slug || defaultCitedSlug }
      : {}),
    ...(item.conversation_id || defaultConvId
      ? { conversation_id: item.conversation_id || defaultConvId }
      : {}),
    captured_at: nowIso,
    updated_at: nowIso,
  }));

  // Place newer insights first so the 40-slot ring buffer retains freshest ongoing context
  const mergedInsights = [...incomingInsights, ...existingInsights];

  const nextCandidate: LifeContextData = {
    ...base,
    past_anchors: [...existingAnchors, ...incomingAnchors],
    core_stress_areas: [...existingStress, ...(extracted.core_stress_areas || [])],
    cited_insights: mergedInsights,
  };

  const allowSupersede = Boolean(extracted.supersede_status_updates);
  if (extracted.relationship_status && (!base.relationship_status || allowSupersede)) {
    nextCandidate.relationship_status = extracted.relationship_status;
  }
  if (extracted.marriage_year && (!base.marriage_year || allowSupersede)) {
    nextCandidate.marriage_year = extracted.marriage_year;
  }
  if (typeof extracted.has_children === 'boolean' && (base.has_children === undefined || allowSupersede)) {
    nextCandidate.has_children = extracted.has_children;
  }
  if (extracted.children_summary && (!base.children_summary || allowSupersede)) {
    nextCandidate.children_summary = extracted.children_summary;
  }
  if (extracted.career_mode && (!base.career_mode || allowSupersede)) {
    nextCandidate.career_mode = extracted.career_mode;
  }
  if (extracted.career_role && (!base.career_role || allowSupersede)) {
    nextCandidate.career_role = extracted.career_role;
  }
  if (extracted.workplace_context && (!base.workplace_context || allowSupersede)) {
    nextCandidate.workplace_context = extracted.workplace_context;
  }
  if (extracted.location_status && (!base.location_status || allowSupersede)) {
    nextCandidate.location_status = extracted.location_status;
  }

  const { sanitized, completeness } = sanitizeLifeContext(nextCandidate);
  const changed =
    JSON.stringify({ ...base, updated_at: undefined }) !==
    JSON.stringify({ ...sanitized, updated_at: undefined });

  return { sanitized, completeness, changed };
}

export function sanitizeDeepProfile(rawInput: unknown): DeepProfileData {
  const src =
    rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput)
      ? (rawInput as Record<string, unknown>)
      : {};

  const out: DeepProfileData = {};
  for (const key of Object.keys(DEEP_PROFILE_BUCKET_LABELS) as DeepProfileBucketKey[]) {
    const arr = src[key];
    if (!Array.isArray(arr)) continue;
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const item of arr) {
      const txt = cleanShortText(item, 180);
      if (!txt || txt.length < 3) continue;
      const norm = txt.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);
      cleaned.push(txt);
      if (cleaned.length >= MAX_BUCKET_ITEMS) break;
    }
    if (cleaned.length > 0) {
      out[key] = cleaned;
    }
  }

  if (Array.isArray(src.entries)) {
    const entryMap = new Map<string, DeepProfileEntry>();
    for (const rawItem of src.entries) {
      if (!rawItem || typeof rawItem !== 'object') continue;
      const row = rawItem as Record<string, unknown>;
      const fact = cleanShortText(row.fact ?? row.summary, 200);
      if (!fact || fact.length < 4) continue;
      const rawCat = typeof row.category === 'string' ? row.category.trim() : '';
      const category: CitedInsightCategory = VALID_CITED_INSIGHT_CATEGORIES.has(rawCat)
        ? (rawCat as CitedInsightCategory)
        : 'practical_life';
      const rawBucket = typeof row.bucket === 'string' ? row.bucket.trim() : '';
      const bucket: DeepProfileBucketKey | undefined = VALID_DEEP_BUCKET_KEYS.has(rawBucket)
        ? (rawBucket as DeepProfileBucketKey)
        : undefined;
      const sourceLabel = cleanShortText(row.source_label ?? row.cited_by, 64) || 'Cosmic Council';
      const sourceSlug = cleanShortText(row.source_slug ?? row.cited_slug, 64) || 'council';
      const conversationId =
        typeof row.conversation_id === 'string' && row.conversation_id.trim()
          ? row.conversation_id.trim().slice(0, 80)
          : null;
      const updatedAt =
        typeof row.updated_at === 'string' && row.updated_at.trim()
          ? row.updated_at.trim().slice(0, 40)
          : new Date().toISOString();
      const capturedAt =
        typeof row.captured_at === 'string' && row.captured_at.trim()
          ? row.captured_at.trim().slice(0, 40)
          : updatedAt;
      const id = cleanShortText(row.id, 64) || buildInsightId(bucket || category, fact);

      const dedupeKey = fact.toLowerCase();
      if (!entryMap.has(dedupeKey)) {
        entryMap.set(dedupeKey, {
          id,
          category,
          ...(bucket ? { bucket } : {}),
          fact,
          source_label: sourceLabel,
          source_slug: sourceSlug,
          conversation_id: conversationId,
          captured_at: capturedAt,
          updated_at: updatedAt,
        });
      }
      if (entryMap.size >= MAX_DEEP_ENTRIES) break;
    }
    if (entryMap.size > 0) {
      out.entries = Array.from(entryMap.values());
    }
  }

  out.updated_at =
    typeof src.updated_at === 'string' && src.updated_at.trim()
      ? src.updated_at.trim().slice(0, 40)
      : new Date().toISOString();

  return out;
}

export function mergeExtractedDeepProfile(
  existingRaw: unknown,
  extracted: ExtractedLifeFactsPatch
): { sanitized: DeepProfileData; changed: boolean } {
  const base = sanitizeDeepProfile(existingRaw);
  const nowIso = new Date().toISOString();
  const sourceLabel = cleanShortText(extracted.actor_citation, 64) || 'Cosmic Council';
  const sourceSlug = cleanShortText(extracted.actor_slug, 64) || 'council';
  const conversationId = cleanShortText(extracted.conversation_id, 80) || null;

  const supersedeTopics = (extracted.cited_insights || [])
    .map((item) => cleanShortText(item.supersedes_topic, 48)?.toLowerCase())
    .filter((t): t is string => Boolean(t && t.length >= 3));

  const candidate: DeepProfileData = { ...base };

  const incomingBuckets = extracted.deep_profile_buckets || {};
  for (const key of Object.keys(DEEP_PROFILE_BUCKET_LABELS) as DeepProfileBucketKey[]) {
    const newItems = incomingBuckets[key];
    let prevList = Array.isArray(base[key]) ? [...base[key]!] : [];
    if (supersedeTopics.length > 0 && prevList.length > 0) {
      prevList = prevList.filter((oldLine) => {
        const lower = oldLine.toLowerCase();
        return !supersedeTopics.some((topic) => lower.includes(topic));
      });
    }
    if (Array.isArray(newItems) && newItems.length > 0) {
      candidate[key] = [...newItems, ...prevList];
    } else if (supersedeTopics.length > 0 && prevList.length !== (base[key]?.length || 0)) {
      candidate[key] = prevList;
    }
  }

  let existingEntries = Array.isArray(base.entries) ? [...base.entries] : [];
  if (supersedeTopics.length > 0 && existingEntries.length > 0) {
    existingEntries = existingEntries.filter((old) => {
      const lower = old.fact.toLowerCase();
      return !supersedeTopics.some((topic) => lower.includes(topic));
    });
  }
  const newEntries: DeepProfileEntry[] = [];

  for (const insight of extracted.cited_insights || []) {
    const fact = cleanShortText(insight.summary, 200);
    if (!fact || fact.length < 4) continue;
    newEntries.push({
      id: buildInsightId(insight.bucket || insight.category, fact),
      category: insight.category,
      ...(insight.bucket ? { bucket: insight.bucket } : {}),
      fact,
      source_label: cleanShortText(insight.cited_by, 64) || sourceLabel,
      source_slug: cleanShortText(insight.cited_slug, 64) || sourceSlug,
      conversation_id: insight.conversation_id ?? conversationId,
      captured_at: nowIso,
      updated_at: nowIso,
    });
  }

  for (const key of Object.keys(DEEP_PROFILE_BUCKET_LABELS) as DeepProfileBucketKey[]) {
    const items = incomingBuckets[key];
    if (!Array.isArray(items)) continue;
    const catMap: Partial<Record<DeepProfileBucketKey, CitedInsightCategory>> = {
      practical_reality: 'practical_life',
      emotional_triggers: 'emotional_pattern',
      core_insecurities: 'emotional_pattern',
      coping_patterns: 'emotional_pattern',
      stress_areas: 'worry_problem',
      desires_and_goals: 'desire_dream',
      active_dilemmas: 'worry_problem',
      relationship_dynamics: 'relationship',
      communication_preferences: 'practical_life',
      habits_and_routines: 'practical_life',
      values_and_principles: 'spiritual',
    };
    const mappedCat = catMap[key] || 'practical_life';
    for (const rawFact of items) {
      const fact = cleanShortText(rawFact, 200);
      if (!fact || fact.length < 4) continue;
      if (!newEntries.some((e) => e.fact.toLowerCase() === fact.toLowerCase())) {
        newEntries.push({
          id: buildInsightId(key, fact),
          category: mappedCat,
          bucket: key,
          fact,
          source_label: sourceLabel,
          source_slug: sourceSlug,
          conversation_id: conversationId,
          captured_at: nowIso,
          updated_at: nowIso,
        });
      }
    }
  }

  if (newEntries.length > 0 || existingEntries.length > 0) {
    candidate.entries = [...newEntries, ...existingEntries];
  } else {
    delete candidate.entries;
  }

  const sanitized = sanitizeDeepProfile(candidate);
  const changed =
    JSON.stringify({ ...base, updated_at: undefined }) !==
    JSON.stringify({ ...sanitized, updated_at: undefined });

  return { sanitized, changed };
}

export function sanitizeUserContextPreferences(rawInput: unknown): UserContextPreferences {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    return { ...DEFAULT_USER_CONTEXT_PREFERENCES };
  }
  const src = rawInput as Record<string, unknown>;
  return {
    memory_paused:
      typeof src.memory_paused === 'boolean'
        ? src.memory_paused
        : DEFAULT_USER_CONTEXT_PREFERENCES.memory_paused,
    allow_cross_companion_memory:
      typeof src.allow_cross_companion_memory === 'boolean'
        ? src.allow_cross_companion_memory
        : DEFAULT_USER_CONTEXT_PREFERENCES.allow_cross_companion_memory,
  };
}

const ASTRO_INTERPRETATION_CLAIM_RE =
  /\b(?:mahadasha|antardasha|pratyantardasha|vimshottari|dasha|bhukti|gochar|nakshatra|navamsa|d-?9|d-?10|d-?7|ashtakavarga|sub[- ]?lord|house lord|ascendant|lagna|profections?|progressions?|synastry|solar return|sade sati|manglik|kaal sarp|yoga|dosha)\b|\b\d{1,2}(?:st|nd|rd|th)\s+house\b|\b(?:sun|moon|mars|mercury|jupiter|venus|saturn|rahu|ketu|uranus|neptune|pluto)\s+(?:in|conjunct|square|trine|opposite|aspects?|aspecting|transiting|retrograde|debilitated|exalted|combust)\b|\b(?:chart|planets?|transits?|dashas?|readings?|horoscope|tarot|spread|numerology|astrologer)\s+(?:shows?|indicates?|suggests?|predicts?|promises?|denies|points to|revealed|said|noted)\b/i;

export function isAstrologicalInterpretationText(text: string | null | undefined): boolean {
  const cleaned = (text || '').trim();
  if (!cleaned) return false;
  return ASTRO_INTERPRETATION_CLAIM_RE.test(cleaned);
}

/**
 * Combines user-level Living Context (public.users) and optional default birth profile context
 * cleanly without mutating DB objects, honoring cross-companion memory filtering when disabled
 * and independent astrological analysis mode when enabled.
 */
export function mergeUserAndProfileContextForPrompt(options: {
  userLivingContext?: unknown;
  userDeepProfile?: unknown;
  profileLifeContext?: unknown;
  profileDeepProfile?: unknown;
  allowCrossCompanionMemory?: boolean;
  independentAnalysisMode?: boolean;
  activeCompanionSlug?: string | null;
}): {
  life_context_json: LifeContextData;
  deep_profile_json: DeepProfileData;
} {
  const { sanitized: uLife } = sanitizeLifeContext(options.userLivingContext);
  const uDeep = sanitizeDeepProfile(options.userDeepProfile);
  const { sanitized: pLife } = sanitizeLifeContext(options.profileLifeContext);
  const pDeep = sanitizeDeepProfile(options.profileDeepProfile);

  const mergedLifeRaw: Record<string, unknown> = {
    ...pLife,
    ...uLife,
    past_anchors: [...(uLife.past_anchors || []), ...(pLife.past_anchors || [])],
    core_stress_areas: [
      ...(uLife.core_stress_areas || []),
      ...(pLife.core_stress_areas || []),
    ],
    cited_insights: [...(uLife.cited_insights || []), ...(pLife.cited_insights || [])],
  };
  if (!uLife.children && pLife.children) mergedLifeRaw.children = pLife.children;

  const { sanitized: mergedLife } = sanitizeLifeContext(mergedLifeRaw);

  const mergedDeepCandidate: Record<string, unknown> = {};
  for (const key of Object.keys(DEEP_PROFILE_BUCKET_LABELS) as DeepProfileBucketKey[]) {
    const combined = [...(uDeep[key] || []), ...(pDeep[key] || [])];
    if (combined.length > 0) mergedDeepCandidate[key] = combined;
  }
  const combinedEntries = [...(uDeep.entries || []), ...(pDeep.entries || [])];
  if (combinedEntries.length > 0) mergedDeepCandidate.entries = combinedEntries;

  let mergedDeep = sanitizeDeepProfile(mergedDeepCandidate);

  if (options.allowCrossCompanionMemory === false) {
    const activeSlug = (options.activeCompanionSlug || '').trim().toLowerCase();
    const isAllowedSlug = (slug?: string | null): boolean => {
      const normalized = (slug || '').trim().toLowerCase();
      if (!normalized) return true; // manual / user-authored context
      if (normalized === 'user' || normalized === 'manual') return true;
      return Boolean(activeSlug && normalized === activeSlug);
    };

    if (Array.isArray(mergedLife.cited_insights)) {
      const filteredInsights = mergedLife.cited_insights.filter((i) =>
        isAllowedSlug(i.cited_slug)
      );
      if (filteredInsights.length > 0) {
        mergedLife.cited_insights = filteredInsights;
      } else {
        delete mergedLife.cited_insights;
      }
    }

    const filteredEntries = (mergedDeep.entries || []).filter((e) =>
      isAllowedSlug(e.source_slug)
    );
    const rebuiltBuckets: DeepProfileData = {};
    for (const entry of filteredEntries) {
      if (entry.bucket) {
        const list = rebuiltBuckets[entry.bucket] || [];
        if (!list.some((x) => x.toLowerCase() === entry.fact.toLowerCase())) {
          rebuiltBuckets[entry.bucket] = [...list, entry.fact];
        }
      }
    }
    if (filteredEntries.length > 0) {
      rebuiltBuckets.entries = filteredEntries;
    }
    mergedDeep = sanitizeDeepProfile(rebuiltBuckets);
  } else if (options.independentAnalysisMode) {
    // Preserve factual user life context and same-companion context, while stripping any
    // astrological interpretations/claims from cross-practitioner memory buckets.
    const activeSlug = (options.activeCompanionSlug || '').trim().toLowerCase();
    const isSameOrUserSlug = (slug?: string | null): boolean => {
      const normalized = (slug || '').trim().toLowerCase();
      if (!normalized || normalized === 'user' || normalized === 'manual') return true;
      return Boolean(activeSlug && normalized === activeSlug);
    };

    if (Array.isArray(mergedLife.core_stress_areas)) {
      const filteredStress = mergedLife.core_stress_areas.filter(
        (item) => !isAstrologicalInterpretationText(item)
      );
      if (filteredStress.length > 0) {
        mergedLife.core_stress_areas = filteredStress;
      } else {
        delete mergedLife.core_stress_areas;
      }
    }

    if (Array.isArray(mergedLife.cited_insights)) {
      const filteredInsights = mergedLife.cited_insights.filter(
        (i) => isSameOrUserSlug(i.cited_slug) || !isAstrologicalInterpretationText(i.summary)
      );
      if (filteredInsights.length > 0) {
        mergedLife.cited_insights = filteredInsights;
      } else {
        delete mergedLife.cited_insights;
      }
    }

    const strippedDeep: DeepProfileData = {};
    for (const key of Object.keys(DEEP_PROFILE_BUCKET_LABELS) as DeepProfileBucketKey[]) {
      const arr = mergedDeep[key];
      if (!Array.isArray(arr) || arr.length === 0) continue;
      const kept = arr.filter((fact) => !isAstrologicalInterpretationText(fact));
      if (kept.length > 0) strippedDeep[key] = kept;
    }
    if (Array.isArray(mergedDeep.entries) && mergedDeep.entries.length > 0) {
      const keptEntries = mergedDeep.entries.filter(
        (entry) =>
          isSameOrUserSlug(entry.source_slug) || !isAstrologicalInterpretationText(entry.fact)
      );
      if (keptEntries.length > 0) strippedDeep.entries = keptEntries;
    }
    mergedDeep = sanitizeDeepProfile(strippedDeep);
  }

  return {
    life_context_json: mergedLife,
    deep_profile_json: mergedDeep,
  };
}

export function formatDeepProfileForLLM(
  deepProfile?: DeepProfileData | null,
  options?: { maxItemsPerBucket?: number; maxEntries?: number; excludeSummaries?: Set<string> }
): string {
  if (!deepProfile || typeof deepProfile !== 'object') return '';
  const maxPerBucket = options?.maxItemsPerBucket ?? 4;
  const maxEntries = options?.maxEntries ?? 10;
  const excluded = options?.excludeSummaries;
  const lines: string[] = [];
  const seenFacts = new Set<string>();

  for (const key of Object.keys(DEEP_PROFILE_BUCKET_LABELS) as DeepProfileBucketKey[]) {
    const items = deepProfile[key];
    if (!Array.isArray(items) || items.length === 0) continue;
    const filtered: string[] = [];
    for (const item of items) {
      const clean = cleanShortText(item, 180);
      if (!clean) continue;
      const norm = clean.toLowerCase();
      if (excluded?.has(norm) || seenFacts.has(norm)) continue;
      seenFacts.add(norm);
      filtered.push(clean);
      if (filtered.length >= maxPerBucket) break;
    }
    if (filtered.length > 0) {
      lines.push(`- ${DEEP_PROFILE_BUCKET_LABELS[key]}: ${filtered.join(' | ')}`);
    }
  }

  if (Array.isArray(deepProfile.entries) && deepProfile.entries.length > 0) {
    const extraNotes: string[] = [];
    for (const entry of deepProfile.entries) {
      const clean = cleanShortText(entry.fact, 180);
      if (!clean) continue;
      const norm = clean.toLowerCase();
      if (excluded?.has(norm) || seenFacts.has(norm)) continue;
      seenFacts.add(norm);
      extraNotes.push(
        `- [${DEEP_PROFILE_BUCKET_LABELS[entry.bucket || 'practical_reality'] || entry.category}] ${clean} (noted via ${entry.source_label})`
      );
      if (extraNotes.length >= maxEntries) break;
    }
    if (extraNotes.length > 0) {
      lines.push(...extraNotes);
    }
  }

  return lines.join('\n');
}

export function formatAnalystNotesForCompanion(
  notes?: CouncilAnalystNote[] | null,
  maxNotes = 6
): string {
  const clean = sanitizeAnalystNotes(notes);
  if (clean.length === 0) return '';
  return clean
    .slice(0, maxNotes)
    .map((n) => {
      const dateTag = n.captured_at ? ` · ${String(n.captured_at).slice(0, 10)}` : '';
      return `- [Prior interpretation by ${n.system_label}${dateTag}] ${n.summary}`;
    })
    .join('\n');
}

export function sanitizeAnalystNotes(rawInput: unknown): CouncilAnalystNote[] {
  if (!Array.isArray(rawInput)) return [];
  const seen = new Set<string>();
  const out: CouncilAnalystNote[] = [];
  for (const raw of rawInput) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const summary = cleanShortText(row.summary ?? row.fact, 260);
    if (!summary || summary.length < 8) continue;
    const key = summary.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const systemLabel = cleanShortText(row.system_label ?? row.cited_by, 64) || 'Cosmic Council';
    const systemSlug = cleanShortText(row.system_slug ?? row.cited_slug, 64) || 'vedic_astrologer';
    const conversationId =
      typeof row.conversation_id === 'string' && row.conversation_id.trim()
        ? row.conversation_id.trim().slice(0, 80)
        : null;
    const capturedAt =
      typeof row.captured_at === 'string' && row.captured_at.trim()
        ? row.captured_at.trim().slice(0, 40)
        : new Date().toISOString();
    const id = cleanShortText(row.id, 64) || buildInsightId(systemSlug, summary);
    out.push({
      id,
      summary,
      system_label: systemLabel,
      system_slug: systemSlug,
      conversation_id: conversationId,
      captured_at: capturedAt,
    });
    if (out.length >= MAX_ANALYST_NOTES) break;
  }
  return out;
}

export function appendCouncilAnalystNotes(
  existingRaw: unknown,
  incoming: Array<{
    summary: string;
    system_label: string;
    system_slug: string;
    conversation_id?: string | null;
  }>
): { notes: CouncilAnalystNote[]; changed: boolean } {
  const prev = sanitizeAnalystNotes(existingRaw);
  const nowIso = new Date().toISOString();
  const mapped: CouncilAnalystNote[] = incoming
    .map((item) => {
      const summary = cleanShortText(item.summary, 260);
      if (!summary || summary.length < 8) return null;
      return {
        id: buildInsightId(item.system_slug, summary),
        summary,
        system_label: cleanShortText(item.system_label, 64) || 'Cosmic Council',
        system_slug: cleanShortText(item.system_slug, 64) || 'vedic_astrologer',
        conversation_id: cleanShortText(item.conversation_id, 80) || null,
        captured_at: nowIso,
      };
    })
    .filter((x): x is CouncilAnalystNote => Boolean(x));

  const merged = sanitizeAnalystNotes([...mapped, ...prev]);
  const changed = JSON.stringify(prev) !== JSON.stringify(merged);
  return { notes: merged, changed };
}

export interface ContextTrapCheckResult {
  triggered: boolean;
  trapId:
    | 'MARRIED_ASKING_FIRST_MARRIAGE'
    | 'HAS_CHILDREN_ASKING_IF_CHILDREN'
    | 'MISSING_MARRIAGE_STATUS'
    | 'MISSING_CAREER_MODE'
    | 'BUSINESS_OR_RETIRED_JOB_QUESTION'
    | 'ALREADY_ABROAD_ASKING_IF_MOVING'
    | 'BIRTH_TIME_PRECISION_CAUTION'
    | null;
  requiresClarificationPause: boolean;
  promptNote?: string;
  clarification?: ClarificationPayload;
}

const FIRST_MARRIAGE_PHRASE_RE =
  /\bwhen will i get married\b|\bwill i (?:ever )?get married\b|\bwhen is my marriage\b|\bmarriage timing\b|\blove or arranged\b|\barranged or love\b|\bwhy is my marriage delayed\b/i;
const EXPLICIT_PAST_OR_SECOND_MARRIAGE_RE =
  /\b(?:past|first|current|existing|second)\s+marriage\b|\bmarriage evolution\b|\bverify\b|\bremarriage\b|\bdivorce\b/i;
const EXPLICIT_STATUS_IN_PROMPT_RE =
  /\b(?:i am |i'm )?(?:single|unmarried|married|divorced|separated|engaged|widowed|dating)\b/i;
const EXPLICIT_CAREER_MODE_IN_PROMPT_RE =
  /\b(?:salaried|my own business|startup|freelanc|self[- ]employed|student|retired|homemaker|unemployed|laid off)\b/i;

/**
 * Deterministic 0ms Desh-Kaal-Patra reality check & trap guard.
 * Catches contradictions (e.g. married user asking "When will I get married?")
 * and missing anchor context without interrogating the user.
 */
export function detectContextTrapMismatch(
  playbookId: string,
  lifeContext: LifeContextData | null | undefined,
  userPrompt: string,
  options?: { isFollowUpTurn?: boolean; tradition?: 'vedic' | 'western' }
): ContextTrapCheckResult {
  const ctx = lifeContext || {};
  const prompt = (userPrompt || '').trim();
  const playbook = (playbookId || '').trim().toUpperCase();
  const isFollowUp = Boolean(options?.isFollowUpTurn);
  const isWestern = options?.tradition === 'western';

  const hasMarriedAnchor = Boolean(
    ctx.marriage_year ||
      (Array.isArray(ctx.past_anchors) && ctx.past_anchors.some((a) => a.tag === 'married'))
  );
  const isMarried =
    ctx.relationship_status === 'married_no_children' ||
    ctx.relationship_status === 'married_with_children' ||
    (!ctx.relationship_status && hasMarriedAnchor);

  // 1. Married user asking first-marriage timing/likelihood
  if (
    isMarried &&
    !EXPLICIT_PAST_OR_SECOND_MARRIAGE_RE.test(prompt) &&
    (['MAR_01', 'MAR_02', 'MAR_04', 'MAR_09'].includes(playbook) ||
      FIRST_MARRIAGE_PHRASE_RE.test(prompt))
  ) {
    return {
      triggered: true,
      trapId: 'MARRIED_ASKING_FIRST_MARRIAGE',
      requiresClarificationPause: true,
      clarification: {
        kind: 'trap_mismatch',
        trapId: 'MARRIED_ASKING_FIRST_MARRIAGE',
        originalQuestion: prompt,
        message:
          "I see your profile notes you're already married. Would you like to verify your past marriage window against the chart, explore how your current partnership evolves next, or ask about a second chapter?",
        chips: [
          {
            id: 'verify_past_marriage',
            label: 'Verify my past marriage window',
            playbookId: 'TIM_11',
            clarifiedQuestion: isWestern
              ? 'Please verify my past marriage window against my Annual Profections, Secondary Progressions, and transits.'
              : 'Please verify my past marriage window against my Vimshottari Dasha and transits to check chart timing accuracy.',
          },
          {
            id: 'current_marriage_evolution',
            label: 'Ask about current marriage evolution',
            playbookId: 'MAR_03',
            clarifiedQuestion: isWestern
              ? 'How does my current married life and partnership harmony evolve over the coming Profections and transit cycles?'
              : 'How does my current married life and partnership harmony evolve over the coming Dasha and transit periods?',
          },
          {
            id: 'second_marriage_chapter',
            label: 'Second marriage / new chapter',
            playbookId: 'MAR_29',
            clarifiedQuestion: isWestern
              ? 'Looking candidly at my Tropical chart, what do my 7th House, Venus, and transits indicate about separation or a new chapter ahead?'
              : 'Looking candidly at my chart, what do my Dashas and Navamsa indicate about separation or a second marriage / new chapter ahead?',
          },
        ],
      },
    };
  }

  // 2. Parent asking "Will I have children?"
  const hasChildAnchor = Boolean(
    Array.isArray(ctx.past_anchors) && ctx.past_anchors.some((a) => a.tag === 'child_born')
  );
  const hasExistingChildren =
    ctx.has_children === true ||
    ctx.relationship_status === 'married_with_children' ||
    (Array.isArray(ctx.children) && ctx.children.length > 0) ||
    hasChildAnchor;

  if (
    hasExistingChildren &&
    (playbook === 'PRO_01' ||
      playbook === 'MAR_18' ||
      /\bwill i have (?:a )?(?:child|children|kids|baby)\b|\bwhen will i have children\b/i.test(prompt))
  ) {
    const childNote =
      Array.isArray(ctx.children) && ctx.children.length > 0
        ? `User already has ${ctx.children.length} child(ren) (${ctx.children
            .map((c) => `${c.gender} born ${c.birth_year}`)
            .join(', ')}).`
        : 'User profile notes existing child(ren).';

    if (/\b(?:second|another|more|bond|relationship with|existing)\b/i.test(prompt)) {
      return {
        triggered: true,
        trapId: 'HAS_CHILDREN_ASKING_IF_CHILDREN',
        requiresClarificationPause: false,
        promptNote: `${childNote} Anchor guidance directly in the requested bond or planning for an additional child.`,
      };
    }

    return {
      triggered: true,
      trapId: 'HAS_CHILDREN_ASKING_IF_CHILDREN',
      requiresClarificationPause: true,
      promptNote: childNote,
      clarification: {
        kind: 'trap_mismatch',
        trapId: 'HAS_CHILDREN_ASKING_IF_CHILDREN',
        message:
          'Your profile notes you already have children. Would you like to focus on your bond and milestones with them, or are you asking about planning another child?',
        chips: [
          {
            id: 'progeny_existing_bond',
            label: 'Bond & milestones with child(ren)',
            playbookId: 'PRO_05',
            clarifiedQuestion:
              'How does my chart describe my bond with my child(ren) and their upcoming supportive milestones?',
          },
          {
            id: 'progeny_second_child',
            label: 'Planning another child',
            playbookId: 'PRO_06',
            clarifiedQuestion: isWestern
              ? 'What does my 5th House, its ruler, and Jupiter/Saturn cycles suggest about planning another child and timing windows?'
              : 'What does my D1 and D7 Saptamsha suggest about planning another child and timing windows?',
          },
          {
            id: 'progeny_verify_past',
            label: 'Verify past child timing',
            playbookId: 'TIM_11',
            clarifiedQuestion: isWestern
              ? 'Can you cross-check the birth year(s) of my child(ren) against my 5th house, Profections, and transits?'
              : 'Can you cross-check the birth year(s) of my child(ren) against my 5th house, D7, and Dasha periods?',
          },
        ],
      },
    };
  }

  // 3. Missing Marital Status on marriage-timing / love vs arranged / delay questions
  if (
    !ctx.relationship_status &&
    !hasMarriedAnchor &&
    !isFollowUp &&
    !EXPLICIT_STATUS_IN_PROMPT_RE.test(prompt) &&
    ['MAR_01', 'MAR_02', 'MAR_04', 'MAR_08', 'MAR_09', 'MAR_12'].includes(playbook)
  ) {
    const cleanQ = prompt || 'What does my chart show about marriage?';
    return {
      triggered: true,
      trapId: 'MISSING_MARRIAGE_STATUS',
      requiresClarificationPause: true,
      clarification: {
        kind: 'missing_context',
        trapId: 'MISSING_MARRIAGE_STATUS',
        originalQuestion: prompt,
        message:
          'To anchor this reading in your real-life situation, what is your relationship status right now?',
        chips: [
          {
            id: 'status_single',
            label: 'Single',
            contextPatch: { relationship_status: 'single' },
            playbookId: playbook,
            clarifiedQuestion: cleanQ,
          },
          {
            id: 'status_dating',
            label: 'In a relationship',
            contextPatch: { relationship_status: 'dating_committed' },
            playbookId: playbook,
            clarifiedQuestion: cleanQ,
          },
          {
            id: 'status_married',
            label: 'Married',
            contextPatch: { relationship_status: 'married_no_children' },
            playbookId: playbook === 'MAR_02' ? 'MAR_03' : playbook,
            clarifiedQuestion:
              playbook === 'MAR_02'
                ? 'I am already married — please verify my marriage timing on the chart and share how my current marriage evolves next.'
                : cleanQ,
          },
          {
            id: 'status_divorced',
            label: 'Divorced / Separated',
            contextPatch: { relationship_status: 'divorced_separated' },
            playbookId: playbook === 'MAR_02' ? 'MAR_29' : playbook,
            clarifiedQuestion: cleanQ,
          },
        ],
      },
    };
  }

  // 4. Missing Career Mode on career trajectory / switch / promotion questions
  if (
    !ctx.career_mode &&
    !EXPLICIT_CAREER_MODE_IN_PROMPT_RE.test(prompt) &&
    ['CAR_01', 'CAR_02', 'CAR_03', 'CAR_04', 'CAR_05', 'CAR_09', 'WLT_06'].includes(playbook) &&
    (!isFollowUp || playbook === 'CAR_01' || playbook === 'CAR_04')
  ) {
    const cleanQ = prompt || 'How will my career unfold?';
    return {
      triggered: true,
      trapId: 'MISSING_CAREER_MODE',
      requiresClarificationPause: true,
      clarification: {
        kind: 'missing_context',
        trapId: 'MISSING_CAREER_MODE',
        message:
          'To give you an honest read on your career direction and timing, which best describes your current work setup?',
        chips: [
          {
            id: 'career_salaried',
            label: 'Salaried Job',
            contextPatch: { career_mode: 'job_salaried' },
            playbookId: playbook,
            clarifiedQuestion: cleanQ,
          },
          {
            id: 'career_business',
            label: 'Own Business / Freelance',
            contextPatch: { career_mode: 'business_owner' },
            playbookId: playbook,
            clarifiedQuestion: cleanQ,
          },
          {
            id: 'career_switching_student',
            label: 'Switching / Student',
            contextPatch: { career_mode: 'career_break_pivot' },
            playbookId: playbook,
            clarifiedQuestion: cleanQ,
          },
        ],
      },
    };
  }

  // 5. Business owner / retired person asking corporate job/promotion question -> auto-adapt prompt note
  if (
    (ctx.career_mode === 'business_owner' || ctx.career_mode === 'retired') &&
    (['CAR_02', 'CAR_03', 'CAR_04', 'CAR_09'].includes(playbook) ||
      /\bquit my job\b|\bpromotion at work\b|\bjob switch\b/i.test(prompt))
  ) {
    return {
      triggered: true,
      trapId: 'BUSINESS_OR_RETIRED_JOB_QUESTION',
      requiresClarificationPause: false,
      promptNote:
        ctx.career_mode === 'business_owner'
          ? 'User is a business owner — frame vocation via 7H/3H/11H enterprise leadership rather than salaried corporate employment.'
          : 'User is retired — frame career/purpose via advisory legacy, capital stewardship, and active peaceful routine rather than corporate job moves.',
    };
  }

  // 6. User already settled abroad asking about moving abroad -> auto-adapt to permanence vs homeland
  if (
    ctx.location_status === 'living_abroad' &&
    (playbook === 'FOR_01' || /\bmove abroad\b|\bgo abroad\b|\bsettle abroad\b/i.test(prompt))
  ) {
    return {
      triggered: true,
      trapId: 'ALREADY_ABROAD_ASKING_IF_MOVING',
      requiresClarificationPause: false,
      promptNote:
        'User is already settled abroad — address residency stability, civic permanence, career roots abroad, or homeland visits rather than predicting an initial move.',
    };
  }

  // 7. Approximate / unknown birth time caution
  if (ctx.birth_time_accuracy === 'approximate' || ctx.birth_time_accuracy === 'sunrise_unknown') {
    return {
      triggered: true,
      trapId: 'BIRTH_TIME_PRECISION_CAUTION',
      requiresClarificationPause: false,
      promptNote: isWestern
        ? 'Birth time accuracy is approximate/unknown — anchor insights in Sun, Moon sign, planetary aspects, and outer transits without over-claiming minute-sensitive Placidus Ascendant, Midheaven, or intermediate house cusps.'
        : 'Birth time accuracy is approximate/unknown — anchor insights in Moon sign (Chandra Lagna), planetary strengths, and broader Vimshottari Mahadasha/Antardasha without over-claiming minute-sensitive KP Sub-Lords or borderline Varga Lagna shifts.',
    };
  }

  return { triggered: false, trapId: null, requiresClarificationPause: false };
}

/**
 * Backward-compatible Phase 2 alias consumed by callers that only pass partial options.
 */
export function evaluateLifeContextGuardHints(
  lifeContext: LifeContextData | null | undefined,
  opts?: { userPrompt?: string; playbookId?: string; isFollowUpTurn?: boolean; tradition?: 'vedic' | 'western' }
): ContextTrapCheckResult {
  return detectContextTrapMismatch(
    opts?.playbookId || '',
    lifeContext,
    opts?.userPrompt || '',
    { isFollowUpTurn: opts?.isFollowUpTurn, tradition: opts?.tradition }
  );
}
