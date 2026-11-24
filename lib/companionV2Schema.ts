export interface CompanionReferenceDialogue {
  id: string;
  user_prompt: string;
  companion_reply: string;
  context_note?: string;
}

export interface CompanionInnerCompass {
  worldview: string;
  values: string[];
  core_anchors: string[];
}

export interface CompanionPersonalityV2 {
  schema_version: 2;
  /** Optional 500–700 token concise identity synthesis used at runtime for lean token efficiency. */
  core_identity_capsule: string;
  character_essence: string;
  fictional_lore: string;
  inner_compass: CompanionInnerCompass;
  expression_spectrum: string;
  subtle_contradictions: string;
  humour_and_interests: string;
  quirks_and_habits: string;
  linguistic_fingerprint: string;
  interpersonal_dynamics: string;
  soft_instincts: string;
  autonomy_guidance: string;
  specialist_expertise: string;
  signature_methodology: string;
  reference_dialogues: CompanionReferenceDialogue[];
  core_identity_locked: boolean;
}

export type SpecializationGroupKey =
  | 'spiritual_guides'
  | 'everyday_companions'
  | 'life_companions'
  | 'cross_cutting';

export interface CompanionSpecializationTag {
  slug: string;
  label: string;
  group: SpecializationGroupKey;
  description: string;
  sort_order: number;
  is_active: boolean;
}

export interface CompanionVersionRecord {
  id: string;
  companion_id?: string | null;
  companion_slug: string;
  version_number: number;
  status: 'published' | 'archived';
  snapshot_json: Record<string, unknown>;
  change_note: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface CompanionExportBundle {
  bundle_type: 'cosmic_council_companion_v2';
  schema_version: 2;
  exported_at: string;
  companion: Record<string, unknown>;
}

export interface CompanionBulkExportBundle {
  bundle_type: 'cosmic_council_companions_roster_v2';
  schema_version: 2;
  exported_at: string;
  count: number;
  specializations: CompanionSpecializationTag[];
  companions: Array<Record<string, unknown>>;
}

export interface GlobalCompanionIntelligenceBundle {
  bundle_type: 'cosmic_council_companion_global_v2';
  schema_version: 2;
  exported_at: string;
  companion_constitution: string;
  companion_realism_baseline: string;
  companion_listen_only_guardrail: string;
  companion_empathy_first_guardrail: string;
  companion_chart_presence_prompt: string;
  companion_return_greeting_prompt: string;
  companion_bond_extractor_prompt: string;
  companion_matcher_instructions: string;
  companion_skill_rules: Record<string, string>;
  companion_group_configs: Record<string, unknown>;
  companion_archetypes: unknown[];
  companion_specializations: CompanionSpecializationTag[];
}

export const DEFAULT_COMPANION_PERSONALITY_V2: CompanionPersonalityV2 = {
  schema_version: 2,
  core_identity_capsule: '',
  character_essence: '',
  fictional_lore: '',
  inner_compass: {
    worldview: '',
    values: [],
    core_anchors: [],
  },
  expression_spectrum: '',
  subtle_contradictions: '',
  humour_and_interests: '',
  quirks_and_habits: '',
  linguistic_fingerprint: '',
  interpersonal_dynamics: '',
  soft_instincts: '',
  autonomy_guidance: '',
  specialist_expertise: '',
  signature_methodology: '',
  reference_dialogues: [],
  core_identity_locked: true,
};

export const DEFAULT_COMPANION_SPECIALIZATIONS: CompanionSpecializationTag[] = [
  // Spiritual Guides
  {
    slug: 'vedic_jyotish',
    label: 'Vedic Jyotish',
    group: 'spiritual_guides',
    description: 'Parashari, Dashas, Nakshatras, Navamsa & practical Jyotish counsel.',
    sort_order: 10,
    is_active: true,
  },
  {
    slug: 'western_tropical',
    label: 'Western Astrology',
    group: 'spiritual_guides',
    description: 'Tropical signs, houses, planetary transits & evolutionary cycles.',
    sort_order: 20,
    is_active: true,
  },
  {
    slug: 'tarot_archetypes',
    label: 'Tarot & Symbolism',
    group: 'spiritual_guides',
    description: 'Reflective Tarot spreads, archetypal imagery & decision clarity.',
    sort_order: 30,
    is_active: true,
  },
  {
    slug: 'numerology_cycles',
    label: 'Numerology',
    group: 'spiritual_guides',
    description: 'Life Path, Destiny & Personal Year rhythm insights.',
    sort_order: 40,
    is_active: true,
  },
  {
    slug: 'karmic_past_life',
    label: 'Karmic & Past-Life',
    group: 'spiritual_guides',
    description: 'Samskara, Nodal axis (Rahu/Ketu) & contemplative soul patterns.',
    sort_order: 50,
    is_active: true,
  },
  {
    slug: 'contemplative_faith',
    label: 'Spiritual & Faith',
    group: 'spiritual_guides',
    description: 'Prayer, doubt, devotion, mindfulness & multi-tradition spiritual grounding.',
    sort_order: 60,
    is_active: true,
  },
  {
    slug: 'dharma_purpose',
    label: 'Dharma & Purpose',
    group: 'spiritual_guides',
    description: 'Meaning, calling, inner alignment & philosophical crossroads.',
    sort_order: 70,
    is_active: true,
  },
  // Everyday Companions
  {
    slug: 'deep_listening',
    label: 'Deep Listening & Venting',
    group: 'everyday_companions',
    description: 'Unhurried, judgment-free emotional space with zero unsolicited lecturing.',
    sort_order: 80,
    is_active: true,
  },
  {
    slug: 'warm_friendship',
    label: 'Everyday Friendship & Banter',
    group: 'everyday_companions',
    description: 'Natural coffee-table warmth, wit, humor, and relaxed daily company.',
    sort_order: 90,
    is_active: true,
  },
  {
    slug: 'overthinking_calm',
    label: 'Overthinking & Anxiety Calm',
    group: 'everyday_companions',
    description: 'Grounding racing thoughts, spiraling worries, and decision fatigue.',
    sort_order: 100,
    is_active: true,
  },
  {
    slug: 'late_night_company',
    label: 'Late-Night & Loneliness',
    group: 'everyday_companions',
    description: 'Quiet company for insomnia, new cities, homesickness, and late nights.',
    sort_order: 110,
    is_active: true,
  },
  {
    slug: 'gentle_accountability',
    label: 'Momentum & Habits',
    group: 'everyday_companions',
    description: 'Honest encouragement, restarting after slips, and getting unstuck.',
    sort_order: 120,
    is_active: true,
  },
  // Life Companions
  {
    slug: 'love_heartbreak',
    label: 'Love, Dating & Heartbreak',
    group: 'life_companions',
    description: 'Breakups, mixed signals, closure, boundaries & emotional recovery.',
    sort_order: 130,
    is_active: true,
  },
  {
    slug: 'marriage_family',
    label: 'Marriage, Family & Parenting',
    group: 'life_companions',
    description: 'Partnership harmony, ageing parents, fertility/IVF, and family dynamics.',
    sort_order: 140,
    is_active: true,
  },
  {
    slug: 'grief_loss',
    label: 'Grief, Loss & Recovery',
    group: 'life_companions',
    description: 'Bereavement, anniversaries, chronic health strain & tender resilience.',
    sort_order: 150,
    is_active: true,
  },
  {
    slug: 'career_founders',
    label: 'Career, Founders & Work',
    group: 'life_companions',
    description: 'Job transitions, startup pressure, burnout, exams & leadership.',
    sort_order: 160,
    is_active: true,
  },
  {
    slug: 'money_transitions',
    label: 'Money, Debt & Transitions',
    group: 'life_companions',
    description: 'Financial pressure, relocation, major pivots & rebuilding steadiness.',
    sort_order: 170,
    is_active: true,
  },
  {
    slug: 'identity_creativity',
    label: 'Identity & Self-Discovery',
    group: 'cross_cutting',
    description: 'Creative voice, authenticity, belonging & personal evolution.',
    sort_order: 180,
    is_active: true,
  },
];

export function estimateTokensRough(text: string | null | undefined): number {
  const cleaned = (text || '').trim();
  if (!cleaned) return 0;
  return Math.ceil(cleaned.length / 4);
}

function cleanText(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, maxLen);
}

function cleanStringList(raw: unknown, maxItems = 12, maxLen = 180): string[] {
  if (!Array.isArray(raw)) {
    if (typeof raw === 'string') {
      return raw
        .split(/[\n,]+/)
        .map((s) => s.trim().slice(0, maxLen))
        .filter(Boolean)
        .slice(0, maxItems);
    }
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const val = String(item || '').trim().slice(0, maxLen);
    if (!val) continue;
    const key = val.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(val);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function normalizePersonalityV2(raw: unknown): CompanionPersonalityV2 {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const innerRaw =
    obj.inner_compass && typeof obj.inner_compass === 'object' && !Array.isArray(obj.inner_compass)
      ? (obj.inner_compass as Record<string, unknown>)
      : {};

  const dialoguesRaw = Array.isArray(obj.reference_dialogues) ? obj.reference_dialogues : [];
  const reference_dialogues: CompanionReferenceDialogue[] = [];
  for (let i = 0; i < dialoguesRaw.length && reference_dialogues.length < 8; i++) {
    const item = dialoguesRaw[i];
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const user_prompt = cleanText(rec.user_prompt, 800);
    const companion_reply = cleanText(rec.companion_reply, 1600);
    if (!user_prompt && !companion_reply) continue;
    reference_dialogues.push({
      id: cleanText(rec.id, 60) || `ref_${i + 1}`,
      user_prompt,
      companion_reply,
      ...(cleanText(rec.context_note, 280) ? { context_note: cleanText(rec.context_note, 280) } : {}),
    });
  }

  return {
    schema_version: 2,
    core_identity_capsule: cleanText(obj.core_identity_capsule, 4500),
    character_essence: cleanText(obj.character_essence, 2400),
    fictional_lore: cleanText(obj.fictional_lore, 4000),
    inner_compass: {
      worldview: cleanText(innerRaw.worldview, 1800),
      values: cleanStringList(innerRaw.values, 10, 140),
      core_anchors: cleanStringList(innerRaw.core_anchors, 10, 180),
    },
    expression_spectrum: cleanText(obj.expression_spectrum, 2400),
    subtle_contradictions: cleanText(obj.subtle_contradictions, 2000),
    humour_and_interests: cleanText(obj.humour_and_interests, 2000),
    quirks_and_habits: cleanText(obj.quirks_and_habits, 2000),
    linguistic_fingerprint: cleanText(obj.linguistic_fingerprint, 2400),
    interpersonal_dynamics: cleanText(obj.interpersonal_dynamics, 2400),
    soft_instincts: cleanText(obj.soft_instincts, 3000),
    autonomy_guidance: cleanText(obj.autonomy_guidance, 2000),
    specialist_expertise: cleanText(obj.specialist_expertise, 2400),
    signature_methodology: cleanText(obj.signature_methodology, 3000),
    reference_dialogues,
    core_identity_locked:
      typeof obj.core_identity_locked === 'boolean' ? obj.core_identity_locked : true,
  };
}

export function hasAuthoredV2Depth(v2: Partial<CompanionPersonalityV2> | null | undefined): boolean {
  if (!v2) return false;
  return Boolean(
    v2.core_identity_capsule?.trim() ||
      v2.character_essence?.trim() ||
      v2.fictional_lore?.trim() ||
      v2.inner_compass?.worldview?.trim() ||
      (v2.inner_compass?.values?.length || 0) > 0 ||
      (v2.inner_compass?.core_anchors?.length || 0) > 0 ||
      v2.expression_spectrum?.trim() ||
      v2.subtle_contradictions?.trim() ||
      v2.humour_and_interests?.trim() ||
      v2.quirks_and_habits?.trim() ||
      v2.linguistic_fingerprint?.trim() ||
      v2.interpersonal_dynamics?.trim() ||
      v2.soft_instincts?.trim() ||
      v2.autonomy_guidance?.trim() ||
      v2.specialist_expertise?.trim() ||
      v2.signature_methodology?.trim() ||
      (v2.reference_dialogues?.length || 0) > 0
  );
}

export function sanitizeSpecializationTags(raw: unknown): CompanionSpecializationTag[] {
  if (!Array.isArray(raw)) return [];
  const allowedGroups: readonly SpecializationGroupKey[] = [
    'spiritual_guides',
    'everyday_companions',
    'life_companions',
    'cross_cutting',
  ];
  const seen = new Set<string>();
  const out: CompanionSpecializationTag[] = [];

  for (let i = 0; i < raw.length && out.length < 60; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const rawSlug = String(obj.slug || obj.label || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48);
    if (!rawSlug || seen.has(rawSlug)) continue;
    seen.add(rawSlug);
    const label = cleanText(obj.label, 64) || rawSlug.replace(/_/g, ' ');
    const group: SpecializationGroupKey = allowedGroups.includes(obj.group as SpecializationGroupKey)
      ? (obj.group as SpecializationGroupKey)
      : 'cross_cutting';
    const sortOrderNum = Number(obj.sort_order);
    out.push({
      slug: rawSlug,
      label,
      group,
      description: cleanText(obj.description, 220),
      sort_order: Number.isFinite(sortOrderNum) ? Math.round(sortOrderNum) : (i + 1) * 10,
      is_active: obj.is_active !== false,
    });
  }

  return out.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
}

export function sanitizeSpecializationSlugs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const slug = String(item || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
    if (out.length >= 16) break;
  }
  return out;
}

/**
 * Deterministic lightweight taxonomy mapper for all 65 existing companions (and new companions
 * without explicit specialization_slugs assigned yet).
 */
export function inferSpecializationsForCompanion(input: {
  slug?: string;
  companion_group?: string;
  category_tag?: string;
  skill_level?: string;
  primary_expertise?: string;
  secondary_expertise?: string[];
  discoverable_tags?: string[];
  situation_tags?: string[];
  tagline?: string;
}): string[] {
  const tags = new Set<string>();
  const haystack = [
    input.slug || '',
    input.primary_expertise || '',
    ...(input.secondary_expertise || []),
    ...(input.discoverable_tags || []),
    ...(input.situation_tags || []),
    input.tagline || '',
  ]
    .join(' ')
    .toLowerCase();

  if (input.skill_level === 'vedic_soft' || /\b(vedic|jyotish|dasha|nakshatra|parashari|navamsa)\b/.test(haystack)) {
    tags.add('vedic_jyotish');
  }
  if (input.skill_level === 'astrology_soft' || /\b(western|tropical|evolutionary|synastry|transit)\b/.test(haystack)) {
    tags.add('western_tropical');
  }
  if (input.skill_level === 'tarot' || /\btarot\b/.test(haystack)) {
    tags.add('tarot_archetypes');
  }
  if (input.skill_level === 'numerology' || /\bnumerolog/.test(haystack)) {
    tags.add('numerology_cycles');
  }
  if (input.skill_level === 'past_life' || input.category_tag === 'past_life' || /\b(past life|past-life|karma|karmic|samskara)\b/.test(haystack)) {
    tags.add('karmic_past_life');
  }
  if (/\b(faith|prayer|devotion|gita|sufism|zen|buddhist|advaita|interfaith|spiritual)\b/.test(haystack)) {
    tags.add('contemplative_faith');
  }
  if (/\b(dharma|purpose|meaning|direction|philosophy|wisdom)\b/.test(haystack)) {
    tags.add('dharma_purpose');
  }
  if (/\b(listen|vent|unfiltered|silence|heard)\b/.test(haystack)) {
    tags.add('deep_listening');
  }
  if (/\b(friend|banter|coffee|casual|humor|wit|companion)\b/.test(haystack)) {
    tags.add('warm_friendship');
  }
  if (/\b(overthink|anxiety|calm|worry|spiral|mindful|stress)\b/.test(haystack)) {
    tags.add('overthinking_calm');
  }
  if (/\b(bedtime|insomnia|late-night|late night|sleep|lonely|loneliness|relocation|new city|homesick)\b/.test(haystack)) {
    tags.add('late_night_company');
  }
  if (/\b(habit|accountability|stuck|procrastinat|discipline|motivat|restart|momentum)\b/.test(haystack)) {
    tags.add('gentle_accountability');
  }
  if (/\b(heartbreak|breakup|dating|ex|romance|love|closure|rejection|red-flags|mixed-signals)\b/.test(haystack)) {
    tags.add('love_heartbreak');
  }
  if (/\b(marriage|family|parent|fertility|ivf|pregnancy|children|mother|father)\b/.test(haystack)) {
    tags.add('marriage_family');
  }
  if (/\b(grief|loss|bereavement|mourning|illness|health|recovery)\b/.test(haystack)) {
    tags.add('grief_loss');
  }
  if (/\b(career|founder|startup|work|burnout|job|exam|student|business|leadership)\b/.test(haystack)) {
    tags.add('career_founders');
  }
  if (/\b(money|debt|finance|financial|legal|dispute|relocat|transition)\b/.test(haystack)) {
    tags.add('money_transitions');
  }
  if (/\b(identity|creative|creativity|self-discovery|authentic)\b/.test(haystack)) {
    tags.add('identity_creativity');
  }

  if (tags.size === 0) {
    if (input.companion_group === 'spiritual_guides') tags.add('dharma_purpose');
    else if (input.companion_group === 'life_companions') tags.add('identity_creativity');
    else tags.add('warm_friendship');
  }

  return Array.from(tags).slice(0, 6);
}

export interface CoreIdentityProtectedDiff {
  field: string;
  label: string;
  before: string;
  after: string;
}

/**
 * Checks whether an incoming publish/update alters core identity fields while `core_identity_locked` is enabled.
 */
export function detectCoreIdentityChanges(
  existing: {
    name?: string;
    slug?: string;
    sex?: string;
    backstory?: string;
    personality_v2_json?: Partial<CompanionPersonalityV2> | null;
  },
  incoming: {
    name?: string;
    slug?: string;
    sex?: string;
    backstory?: string;
    personality_v2_json?: Partial<CompanionPersonalityV2> | null;
  }
): CoreIdentityProtectedDiff[] {
  const existingLocked = existing.personality_v2_json?.core_identity_locked !== false;
  if (!existingLocked) return [];

  const diffs: CoreIdentityProtectedDiff[] = [];
  const checkStr = (field: string, label: string, a: unknown, b: unknown) => {
    const sa = String(a || '').trim();
    const sb = String(b || '').trim();
    if (sa && sa !== sb) {
      diffs.push({
        field,
        label,
        before: sa.slice(0, 120),
        after: sb.slice(0, 120),
      });
    }
  };

  checkStr('name', 'Display Name', existing.name, incoming.name);
  checkStr('slug', 'Slug ID', existing.slug, incoming.slug);
  checkStr('sex', 'Gender / Presentation', existing.sex, incoming.sex);
  checkStr('backstory', 'Private Back Story', existing.backstory, incoming.backstory);
  checkStr(
    'personality_v2_json.core_identity_capsule',
    'Core Identity Capsule',
    existing.personality_v2_json?.core_identity_capsule,
    incoming.personality_v2_json?.core_identity_capsule
  );
  checkStr(
    'personality_v2_json.character_essence',
    'Character Essence',
    existing.personality_v2_json?.character_essence,
    incoming.personality_v2_json?.character_essence
  );

  const prevAnchors = (existing.personality_v2_json?.inner_compass?.core_anchors || [])
    .map((x) => x.trim())
    .filter(Boolean)
    .join(' | ');
  const nextAnchors = (incoming.personality_v2_json?.inner_compass?.core_anchors || [])
    .map((x) => x.trim())
    .filter(Boolean)
    .join(' | ');
  if (prevAnchors && prevAnchors !== nextAnchors) {
    diffs.push({
      field: 'personality_v2_json.inner_compass.core_anchors',
      label: 'Inner Compass Core Anchors',
      before: prevAnchors.slice(0, 140),
      after: nextAnchors.slice(0, 140),
    });
  }

  return diffs;
}

export function buildCoreIdentityCapsuleDraft(input: {
  name?: string;
  age?: number;
  sex?: string;
  primary_expertise?: string;
  cultural_fluency?: string;
  tagline?: string;
  backstory?: string;
  personality_v2_json?: Partial<CompanionPersonalityV2>;
}): string {
  const v2 = normalizePersonalityV2(input.personality_v2_json);
  const parts: string[] = [];
  if (input.name) {
    parts.push(
      `${input.name} (${input.age || 30}, ${input.sex || 'F'} — ${input.primary_expertise || 'Companion'})${
        input.cultural_fluency ? ` · ${input.cultural_fluency}` : ''
      }.`
    );
  }
  if (v2.character_essence) {
    parts.push(`Essence: ${v2.character_essence}`);
  } else if (input.tagline) {
    parts.push(`Presence: ${input.tagline}`);
  }
  if (v2.fictional_lore) {
    parts.push(`Roots & Lore: ${v2.fictional_lore}`);
  } else if (input.backstory) {
    parts.push(`Roots: ${input.backstory}`);
  }
  if (v2.inner_compass.worldview || v2.inner_compass.core_anchors.length > 0) {
    parts.push(
      `Inner Compass: ${v2.inner_compass.worldview}${
        v2.inner_compass.core_anchors.length > 0
          ? ` Anchors: ${v2.inner_compass.core_anchors.join('; ')}.`
          : ''
      }`
    );
  }
  if (v2.linguistic_fingerprint) {
    parts.push(`Voice & Rhythm: ${v2.linguistic_fingerprint}`);
  }
  if (v2.subtle_contradictions || v2.humour_and_interests) {
    parts.push(
      `Human Texture: ${[v2.subtle_contradictions, v2.humour_and_interests].filter(Boolean).join(' ')}`
    );
  }
  if (v2.signature_methodology) {
    parts.push(`Method: ${v2.signature_methodology}`);
  }
  return parts.join('\n\n').trim().slice(0, 3200);
}
