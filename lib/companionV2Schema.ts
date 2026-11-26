export type AstrologyEntryRule = 'never' | 'invite_only' | 'contextual_invite';
export type AiIdentityDisclosureMode = 'natural_immersion_honest_when_asked' | 'explicit_ai';
export type CompanionAstrologicalMemoryMode = 'independent' | 'shared';
export type CompanionVerificationMode = 'neutral' | 'council_vedic' | 'council_western' | 'none';
export type CompanionGreetingMode = 'static_only' | 'generated_returning' | 'character_authored';
export type CompanionFamiliarityMode = 'fixed_register' | 'organic_subtle' | 'warm_progressive';
export type CompanionFamiliarityCeiling = 'reserved' | 'cordial' | 'close';
export type CompanionAnalyticalExecutionMode = 'single_pass' | 'adaptive_multipass';

export interface CompanionGreetingConfig {
  mode: CompanionGreetingMode;
  allow_memory_callback?: boolean;
  custom_return_instruction?: string;
}

export interface CompanionFamiliarityPolicy {
  mode: CompanionFamiliarityMode;
  max_familiarity?: CompanionFamiliarityCeiling;
}

export interface CompanionAnalyticalExecutionConfig {
  mode?: CompanionAnalyticalExecutionMode;
  max_passes?: number;
  verify_contradictions?: boolean;
}

export interface CompanionContextualNuance {
  id: string;
  label: string;
  trigger_topics: string[];
  trigger_moods: string[];
  guidance: string;
  priority: number;
}

export interface CompanionReferenceDialogue {
  id: string;
  scenario?: string;
  user_prompt: string;
  companion_reply: string;
  context_note?: string;
  tags?: string[];
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
  capsule_token_estimate?: number;
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
  investigation_strategy?: string;
  refinement_philosophy?: string;
  astrology_entry_rule: AstrologyEntryRule;
  esoteric_guardrails: string;
  ai_identity_disclosure: AiIdentityDisclosureMode;
  astrological_memory_mode?: CompanionAstrologicalMemoryMode;
  verification_mode?: CompanionVerificationMode;
  greeting_config?: CompanionGreetingConfig;
  familiarity_policy?: CompanionFamiliarityPolicy;
  analytical_execution?: CompanionAnalyticalExecutionConfig;
  contextual_nuances: CompanionContextualNuance[];
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
  companion_neutral_verification_prompt: string;
  companion_analysis_task_frame_prompt: string;
  companion_analysis_investigation_prompt: string;
  companion_analysis_refine_prompt: string;
  companion_analysis_response_strategy_prompt: string;
  companion_analysis_memory_extraction_prompt: string;
  companion_skill_rules: Record<string, string>;
  companion_group_configs: Record<string, unknown>;
  companion_archetypes: unknown[];
  companion_specializations: CompanionSpecializationTag[];
}

export const DEFAULT_COMPANION_PERSONALITY_V2: CompanionPersonalityV2 = {
  schema_version: 2,
  core_identity_capsule: '',
  capsule_token_estimate: 0,
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
  investigation_strategy: '',
  refinement_philosophy: '',
  astrology_entry_rule: 'never',
  esoteric_guardrails: '',
  ai_identity_disclosure: 'natural_immersion_honest_when_asked',
  astrological_memory_mode: 'independent',
  verification_mode: 'neutral',
  greeting_config: {
    mode: 'generated_returning',
    allow_memory_callback: true,
    custom_return_instruction: '',
  },
  familiarity_policy: {
    mode: 'warm_progressive',
    max_familiarity: 'close',
  },
  analytical_execution: {
    mode: 'single_pass',
    max_passes: 1,
    verify_contradictions: true,
  },
  contextual_nuances: [],
  reference_dialogues: [],
  core_identity_locked: true,
};

export const COMPANION_SUBFILTER_HEADING_BY_GROUP: Record<
  'spiritual_guides' | 'everyday_companions' | 'life_companions',
  string
> = {
  spiritual_guides: 'Explore by specialization',
  everyday_companions: 'Explore by companionship style',
  life_companions: 'Explore by area of life',
};

export const DEFAULT_COMPANION_SPECIALIZATIONS: CompanionSpecializationTag[] = [
  // Spiritual Guides — Explore by specialization
  {
    slug: 'vedic_astrology',
    label: 'Vedic Astrology',
    group: 'spiritual_guides',
    description: 'Parashari, Dashas, Nakshatras, Navamsa & practical Jyotish counsel.',
    sort_order: 10,
    is_active: true,
  },
  {
    slug: 'western_astrology',
    label: 'Western Astrology',
    group: 'spiritual_guides',
    description: 'Tropical birth charts, planetary transits, compatibility & life turning points.',
    sort_order: 20,
    is_active: true,
  },
  {
    slug: 'evolutionary_astrology',
    label: 'Evolutionary Astrology',
    group: 'spiritual_guides',
    description: 'Soul evolution, nodal patterns, identity shifts & personal growth.',
    sort_order: 30,
    is_active: true,
  },
  {
    slug: 'modern_astrology',
    label: 'Modern Astrology',
    group: 'spiritual_guides',
    description: 'Everyday planetary cycles, daily rhythms & conversational cosmic reflection.',
    sort_order: 40,
    is_active: true,
  },
  {
    slug: 'tarot',
    label: 'Tarot',
    group: 'spiritual_guides',
    description: 'Reflective Tarot spreads, archetypal imagery & decision clarity.',
    sort_order: 50,
    is_active: true,
  },
  {
    slug: 'numerology',
    label: 'Numerology',
    group: 'spiritual_guides',
    description: 'Life Path, Personal Year cycles & symbolic life chapters.',
    sort_order: 60,
    is_active: true,
  },
  {
    slug: 'karma_past_lives',
    label: 'Karma & Past Lives',
    group: 'spiritual_guides',
    description: 'Samskara, Nodal axis (Rahu/Ketu) & contemplative soul patterns.',
    sort_order: 70,
    is_active: true,
  },
  {
    slug: 'spirituality',
    label: 'Spirituality',
    group: 'spiritual_guides',
    description: 'Inner peace, faith, doubt, forgiveness & grounded spiritual reflection.',
    sort_order: 80,
    is_active: true,
  },

  // Everyday Companions — Explore by companionship style
  {
    slug: 'listening',
    label: 'Listening',
    group: 'everyday_companions',
    description: 'Unhurried, judgment-free presence when you just need to be heard.',
    sort_order: 90,
    is_active: true,
  },
  {
    slug: 'comfort_healing',
    label: 'Comfort & Healing',
    group: 'everyday_companions',
    description: 'Gentle reassurance, emotional tenderness & steady warmth on heavy days.',
    sort_order: 100,
    is_active: true,
  },
  {
    slug: 'encouragement',
    label: 'Encouragement',
    group: 'everyday_companions',
    description: 'Self-belief, steady momentum, bouncing back & celebrating wins.',
    sort_order: 110,
    is_active: true,
  },
  {
    slug: 'fun_friendship',
    label: 'Fun & Friendship',
    group: 'everyday_companions',
    description: 'Playful banter, witty company, laughter & relaxed everyday chats.',
    sort_order: 120,
    is_active: true,
  },
  {
    slug: 'candid_conversations',
    label: 'Candid Conversations',
    group: 'everyday_companions',
    description: 'Honest opinions, blind-spot checks & grounded straight talk.',
    sort_order: 130,
    is_active: true,
  },
  {
    slug: 'calm_mindfulness',
    label: 'Calm & Mindfulness',
    group: 'everyday_companions',
    description: 'Quieting racing thoughts, mindfulness & grounding restless evenings.',
    sort_order: 140,
    is_active: true,
  },
  {
    slug: 'deep_conversations',
    label: 'Deep Conversations',
    group: 'everyday_companions',
    description: 'Philosophy, meaning, unspoken truths & reflective curiosity.',
    sort_order: 150,
    is_active: true,
  },
  {
    slug: 'mentorship',
    label: 'Mentorship',
    group: 'everyday_companions',
    description: 'Mature perspective, life wisdom & balanced guidance at crossroads.',
    sort_order: 160,
    is_active: true,
  },
  {
    slug: 'family_like_connection',
    label: 'Family-like Connection',
    group: 'everyday_companions',
    description: 'Brotherly and sisterly warmth, loyal care & heart-to-heart familiarity.',
    sort_order: 170,
    is_active: true,
  },
  {
    slug: 'venting',
    label: 'Venting',
    group: 'everyday_companions',
    description: 'Unfiltered space to let out frustration without polite sugarcoating.',
    sort_order: 180,
    is_active: true,
  },
  {
    slug: 'clarity_decisions',
    label: 'Clarity & Decisions',
    group: 'everyday_companions',
    description: 'Thinking out loud, untangling choices & resolving indecision.',
    sort_order: 190,
    is_active: true,
  },
  {
    slug: 'daily_companionship',
    label: 'Daily Companionship',
    group: 'everyday_companions',
    description: 'Daily check-ins, winding down at bedtime & steady everyday company.',
    sort_order: 200,
    is_active: true,
  },
  {
    slug: 'warmth_affection',
    label: 'Warmth & Affection',
    group: 'everyday_companions',
    description: 'Kindness, feeling appreciated, gentle tenderness & comforting closeness.',
    sort_order: 210,
    is_active: true,
  },

  // Life Companions — Explore by area of life
  {
    slug: 'love_relationships',
    label: 'Love & Relationships',
    group: 'life_companions',
    description: 'Dating, romantic uncertainty, mixed signals & healthy connection.',
    sort_order: 220,
    is_active: true,
  },
  {
    slug: 'heartbreak',
    label: 'Heartbreak',
    group: 'life_companions',
    description: 'Breakups, missing an ex, rejection, closure & letting go.',
    sort_order: 230,
    is_active: true,
  },
  {
    slug: 'marriage_divorce',
    label: 'Marriage & Divorce',
    group: 'life_companions',
    description: 'Marital communication, separation, divorce recovery & second chances.',
    sort_order: 240,
    is_active: true,
  },
  {
    slug: 'grief_loss',
    label: 'Grief & Loss',
    group: 'life_companions',
    description: 'Bereavement, remembering loved ones & carrying difficult anniversaries.',
    sort_order: 250,
    is_active: true,
  },
  {
    slug: 'family_parenthood',
    label: 'Family & Parenthood',
    group: 'life_companions',
    description: 'Parenthood, ageing parents, family expectations & matters of home.',
    sort_order: 260,
    is_active: true,
  },
  {
    slug: 'fertility_pregnancy',
    label: 'Fertility & Pregnancy',
    group: 'life_companions',
    description: 'Fertility journeys, IVF waiting, pregnancy worries & quiet hope.',
    sort_order: 270,
    is_active: true,
  },
  {
    slug: 'health_recovery',
    label: 'Health & Recovery',
    group: 'life_companions',
    description: 'Chronic illness, surgery recovery, caregiving & physical strain.',
    sort_order: 280,
    is_active: true,
  },
  {
    slug: 'emotional_wellness',
    label: 'Emotional Wellness',
    group: 'life_companions',
    description: 'Burnout, low moods, anxiety, emotional exhaustion & steadiness.',
    sort_order: 290,
    is_active: true,
  },
  {
    slug: 'career_business',
    label: 'Career & Business',
    group: 'life_companions',
    description: 'Career choices, job switches, workplace dynamics & founder stress.',
    sort_order: 300,
    is_active: true,
  },
  {
    slug: 'money_finances',
    label: 'Money & Finances',
    group: 'life_companions',
    description: 'Financial pressure, debt worries, setbacks & rebuilding stability.',
    sort_order: 310,
    is_active: true,
  },
  {
    slug: 'legal_challenges',
    label: 'Legal Challenges',
    group: 'life_companions',
    description: 'Legal dispute stress, property/family conflicts & tough negotiations.',
    sort_order: 320,
    is_active: true,
  },
  {
    slug: 'life_direction',
    label: 'Life Direction',
    group: 'life_companions',
    description: 'Relocation, major life transitions, feeling stuck & finding direction.',
    sort_order: 330,
    is_active: true,
  },
  {
    slug: 'trauma_healing',
    label: 'Trauma & Healing',
    group: 'life_companions',
    description: 'Emotional recovery, childhood wounds, boundaries & rebuilding trust.',
    sort_order: 340,
    is_active: true,
  },
  {
    slug: 'intimacy',
    label: 'Intimacy',
    group: 'life_companions',
    description: 'Emotional and physical intimacy, vulnerability & closeness.',
    sort_order: 350,
    is_active: true,
  },
  {
    slug: 'identity_self_discovery',
    label: 'Identity & Self-Discovery',
    group: 'life_companions',
    description: 'Self-acceptance, personal identity, belonging & individuality.',
    sort_order: 360,
    is_active: true,
  },
  {
    slug: 'student_life',
    label: 'Student Life',
    group: 'life_companions',
    description: 'Exam pressure, academic setbacks, study focus & family expectations.',
    sort_order: 370,
    is_active: true,
  },
];

export const LEGACY_SPECIALIZATION_SLUG_MAP: Record<string, string> = {
  vedic_jyotish: 'vedic_astrology',
  western_tropical: 'western_astrology',
  tarot_archetypes: 'tarot',
  numerology_cycles: 'numerology',
  karmic_past_life: 'karma_past_lives',
  contemplative_faith: 'spirituality',
  dharma_purpose: 'spirituality',
  deep_listening: 'listening',
  warm_friendship: 'fun_friendship',
  overthinking_calm: 'calm_mindfulness',
  late_night_company: 'daily_companionship',
  gentle_accountability: 'encouragement',
  love_heartbreak: 'heartbreak',
  marriage_family: 'marriage_divorce',
  grief_loss: 'grief_loss',
  career_founders: 'career_business',
  money_transitions: 'money_finances',
  identity_creativity: 'identity_self_discovery',
};

const NEW_CANONICAL_SPEC_SLUGS = new Set(DEFAULT_COMPANION_SPECIALIZATIONS.map((s) => s.slug));
const LEGACY_ONLY_SPEC_SLUGS = new Set(
  Object.keys(LEGACY_SPECIALIZATION_SLUG_MAP).filter((k) => !NEW_CANONICAL_SPEC_SLUGS.has(k))
);

export function isLegacySeedSpecializationTaxonomy(
  tags: CompanionSpecializationTag[] | null | undefined
): boolean {
  if (!Array.isArray(tags) || tags.length === 0) return false;
  const slugs = tags.map((t) => String(t.slug || '').trim().toLowerCase());
  const hasNew = slugs.some((s) => NEW_CANONICAL_SPEC_SLUGS.has(s) && s !== 'grief_loss');
  const hasLegacy = slugs.some((s) => LEGACY_ONLY_SPEC_SLUGS.has(s));
  return hasLegacy && !hasNew;
}

export function hasOnlyLegacySpecializationSlugs(rawSlugs: unknown): boolean {
  if (!Array.isArray(rawSlugs) || rawSlugs.length === 0) return false;
  const cleaned = rawSlugs.map((s) => String(s || '').trim().toLowerCase()).filter(Boolean);
  if (cleaned.length === 0) return false;
  const hasLegacyOnly = cleaned.some((s) => LEGACY_ONLY_SPEC_SLUGS.has(s));
  const hasAnyNewOnly = cleaned.some((s) => NEW_CANONICAL_SPEC_SLUGS.has(s) && s !== 'grief_loss');
  return hasLegacyOnly && !hasAnyNewOnly;
}

export function normalizeSpecializationSlugsWithMigration(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const mapped = raw.map((item) => {
    const slug = String(item || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48);
    return LEGACY_SPECIALIZATION_SLUG_MAP[slug] || slug;
  });
  return sanitizeSpecializationSlugs(mapped);
}

export const BUILTIN_COMPANION_SPECIALIZATIONS: Record<string, string[]> = {
  // Spiritual Guides (14)
  dev: ['vedic_astrology', 'spirituality'],
  nandini: ['vedic_astrology', 'spirituality'],
  marc: ['western_astrology'],
  luna: ['western_astrology'],
  sofia: ['evolutionary_astrology'],
  tara: ['modern_astrology'],
  bella: ['tarot'],
  julian: ['tarot'],
  ines: ['numerology'],
  kai: ['numerology'],
  anya: ['karma_past_lives', 'spirituality'],
  vikram: ['karma_past_lives', 'spirituality'],
  shanti: ['spirituality'],
  omar: ['spirituality'],

  // Everyday Companions (29)
  mira: ['listening', 'comfort_healing'],
  samir: ['listening', 'venting'],
  hannah: ['comfort_healing', 'warmth_affection', 'listening'],
  noah: ['comfort_healing', 'listening', 'warmth_affection'],
  kira: ['fun_friendship', 'encouragement', 'comfort_healing'],
  aira: ['fun_friendship', 'encouragement', 'comfort_healing'],
  elia: ['comfort_healing', 'deep_conversations'],
  priya: ['encouragement'],
  max: ['encouragement', 'daily_companionship'],
  ethan: ['candid_conversations', 'clarity_decisions'],
  valeria: ['candid_conversations', 'clarity_decisions'],
  zoya: ['fun_friendship'],
  leo: ['fun_friendship'],
  nora: ['calm_mindfulness', 'comfort_healing'],
  kabir: ['daily_companionship', 'fun_friendship', 'venting'],
  naomi: ['deep_conversations', 'candid_conversations', 'listening'],
  elias: ['deep_conversations'],
  maya: ['mentorship', 'deep_conversations', 'clarity_decisions'],
  mateo: ['family_like_connection', 'encouragement', 'candid_conversations'],
  nina: ['family_like_connection', 'warmth_affection'],
  alex: ['venting', 'listening'],
  zara: ['venting', 'candid_conversations'],
  ari: ['clarity_decisions', 'deep_conversations'],
  elena: ['clarity_decisions', 'mentorship'],
  jamie: ['daily_companionship', 'listening'],
  camila: ['warmth_affection', 'comfort_healing'],
  luca: ['encouragement', 'fun_friendship', 'daily_companionship'],
  theo: ['calm_mindfulness', 'daily_companionship', 'comfort_healing'],
  serena: ['calm_mindfulness'],

  // Life Companions (22)
  isla: ['love_relationships'],
  ryan: ['love_relationships'],
  sienna: ['heartbreak'],
  adrian: ['heartbreak'],
  kavita: ['marriage_divorce', 'love_relationships'],
  daniel: ['marriage_divorce', 'life_direction'],
  grace: ['grief_loss'],
  rohan: ['grief_loss'],
  anjali: ['family_parenthood'],
  eva: ['fertility_pregnancy', 'family_parenthood'],
  adam: ['health_recovery'],
  clara: ['emotional_wellness'],
  neha: ['career_business'],
  nikhil: ['career_business'],
  rachel: ['money_finances'],
  victor: ['legal_challenges', 'money_finances'],
  kenji: ['life_direction', 'identity_self_discovery'],
  lucas: ['life_direction', 'identity_self_discovery'],
  iris: ['trauma_healing', 'emotional_wellness'],
  mila: ['intimacy', 'love_relationships'],
  robin: ['identity_self_discovery'],
  riya: ['student_life', 'career_business'],
};

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

const ALLOWED_ASTROLOGY_ENTRY_RULES: readonly AstrologyEntryRule[] = [
  'never',
  'invite_only',
  'contextual_invite',
];

const ALLOWED_AI_DISCLOSURE_MODES: readonly AiIdentityDisclosureMode[] = [
  'natural_immersion_honest_when_asked',
  'explicit_ai',
];

const ALLOWED_ASTROLOGICAL_MEMORY_MODES: readonly CompanionAstrologicalMemoryMode[] = [
  'independent',
  'shared',
];

const ALLOWED_VERIFICATION_MODES: readonly CompanionVerificationMode[] = [
  'neutral',
  'council_vedic',
  'council_western',
  'none',
];

const ALLOWED_GREETING_MODES: readonly CompanionGreetingMode[] = [
  'static_only',
  'generated_returning',
  'character_authored',
];

const ALLOWED_FAMILIARITY_MODES: readonly CompanionFamiliarityMode[] = [
  'fixed_register',
  'organic_subtle',
  'warm_progressive',
];

const ALLOWED_FAMILIARITY_CEILINGS: readonly CompanionFamiliarityCeiling[] = [
  'reserved',
  'cordial',
  'close',
];

const ALLOWED_ANALYTICAL_EXECUTION_MODES: readonly CompanionAnalyticalExecutionMode[] = [
  'single_pass',
  'adaptive_multipass',
];

export function normalizePersonalityV2(raw: unknown): CompanionPersonalityV2 {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const innerRaw =
    obj.inner_compass && typeof obj.inner_compass === 'object' && !Array.isArray(obj.inner_compass)
      ? (obj.inner_compass as Record<string, unknown>)
      : {};
  const greetingRaw =
    obj.greeting_config &&
    typeof obj.greeting_config === 'object' &&
    !Array.isArray(obj.greeting_config)
      ? (obj.greeting_config as Record<string, unknown>)
      : {};
  const familiarityRaw =
    obj.familiarity_policy &&
    typeof obj.familiarity_policy === 'object' &&
    !Array.isArray(obj.familiarity_policy)
      ? (obj.familiarity_policy as Record<string, unknown>)
      : {};
  const analyticalRaw =
    obj.analytical_execution &&
    typeof obj.analytical_execution === 'object' &&
    !Array.isArray(obj.analytical_execution)
      ? (obj.analytical_execution as Record<string, unknown>)
      : {};

  const nuancesRaw = Array.isArray(obj.contextual_nuances) ? obj.contextual_nuances : [];
  const contextual_nuances: CompanionContextualNuance[] = [];
  for (let i = 0; i < nuancesRaw.length && contextual_nuances.length < 24; i++) {
    const item = nuancesRaw[i];
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const label = cleanText(rec.label, 120);
    const guidance = cleanText(rec.guidance, 1600);
    if (!label && !guidance) continue;
    const priorityNum = Number(rec.priority);
    contextual_nuances.push({
      id: cleanText(rec.id, 60) || `nuance_${i + 1}`,
      label: label || `Contextual Nuance ${i + 1}`,
      trigger_topics: cleanStringList(rec.trigger_topics, 12, 64),
      trigger_moods: cleanStringList(rec.trigger_moods, 10, 48),
      guidance,
      priority: Number.isFinite(priorityNum) ? Math.max(0, Math.min(100, Math.round(priorityNum))) : 50,
    });
  }
  contextual_nuances.sort((a, b) => b.priority - a.priority);

  const dialoguesRaw = Array.isArray(obj.reference_dialogues) ? obj.reference_dialogues : [];
  const reference_dialogues: CompanionReferenceDialogue[] = [];
  for (let i = 0; i < dialoguesRaw.length && reference_dialogues.length < 12; i++) {
    const item = dialoguesRaw[i];
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const user_prompt = cleanText(rec.user_prompt, 800);
    const companion_reply = cleanText(rec.companion_reply, 1600);
    if (!user_prompt && !companion_reply) continue;
    const scenario = cleanText(rec.scenario, 180);
    const context_note = cleanText(rec.context_note, 280);
    const tags = cleanStringList(rec.tags, 10, 48);
    reference_dialogues.push({
      id: cleanText(rec.id, 60) || `ref_${i + 1}`,
      ...(scenario ? { scenario } : {}),
      user_prompt,
      companion_reply,
      ...(context_note ? { context_note } : {}),
      ...(tags.length > 0 ? { tags } : {}),
    });
  }

  const core_identity_capsule = cleanText(obj.core_identity_capsule, 4500);
  const astrology_entry_rule: AstrologyEntryRule = ALLOWED_ASTROLOGY_ENTRY_RULES.includes(
    obj.astrology_entry_rule as AstrologyEntryRule
  )
    ? (obj.astrology_entry_rule as AstrologyEntryRule)
    : 'never';

  const ai_identity_disclosure: AiIdentityDisclosureMode = ALLOWED_AI_DISCLOSURE_MODES.includes(
    obj.ai_identity_disclosure as AiIdentityDisclosureMode
  )
    ? (obj.ai_identity_disclosure as AiIdentityDisclosureMode)
    : 'natural_immersion_honest_when_asked';

  const astrological_memory_mode: CompanionAstrologicalMemoryMode =
    ALLOWED_ASTROLOGICAL_MEMORY_MODES.includes(
      obj.astrological_memory_mode as CompanionAstrologicalMemoryMode
    )
      ? (obj.astrological_memory_mode as CompanionAstrologicalMemoryMode)
      : 'independent';

  const verification_mode: CompanionVerificationMode = ALLOWED_VERIFICATION_MODES.includes(
    obj.verification_mode as CompanionVerificationMode
  )
    ? (obj.verification_mode as CompanionVerificationMode)
    : 'neutral';

  const greetingMode: CompanionGreetingMode = ALLOWED_GREETING_MODES.includes(
    greetingRaw.mode as CompanionGreetingMode
  )
    ? (greetingRaw.mode as CompanionGreetingMode)
    : 'generated_returning';

  const familiarityMode: CompanionFamiliarityMode = ALLOWED_FAMILIARITY_MODES.includes(
    familiarityRaw.mode as CompanionFamiliarityMode
  )
    ? (familiarityRaw.mode as CompanionFamiliarityMode)
    : 'warm_progressive';

  const familiarityCeiling: CompanionFamiliarityCeiling = ALLOWED_FAMILIARITY_CEILINGS.includes(
    familiarityRaw.max_familiarity as CompanionFamiliarityCeiling
  )
    ? (familiarityRaw.max_familiarity as CompanionFamiliarityCeiling)
    : 'close';

  const analyticalMode: CompanionAnalyticalExecutionMode =
    ALLOWED_ANALYTICAL_EXECUTION_MODES.includes(
      analyticalRaw.mode as CompanionAnalyticalExecutionMode
    )
      ? (analyticalRaw.mode as CompanionAnalyticalExecutionMode)
      : 'single_pass';

  const rawMaxPasses = Number(analyticalRaw.max_passes);
  const maxPasses = Number.isFinite(rawMaxPasses)
    ? Math.max(1, Math.min(4, Math.round(rawMaxPasses)))
    : 1;

  return {
    schema_version: 2,
    core_identity_capsule,
    capsule_token_estimate: estimateTokensRough(core_identity_capsule),
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
    investigation_strategy: cleanText(obj.investigation_strategy, 3000),
    refinement_philosophy: cleanText(obj.refinement_philosophy, 3000),
    astrology_entry_rule,
    esoteric_guardrails: cleanText(obj.esoteric_guardrails, 4000),
    ai_identity_disclosure,
    astrological_memory_mode,
    verification_mode,
    greeting_config: {
      mode: greetingMode,
      allow_memory_callback: greetingRaw.allow_memory_callback !== false,
      custom_return_instruction: cleanText(greetingRaw.custom_return_instruction, 1000),
    },
    familiarity_policy: {
      mode: familiarityMode,
      max_familiarity: familiarityCeiling,
    },
    analytical_execution: {
      mode: analyticalMode,
      max_passes: maxPasses,
      verify_contradictions: analyticalRaw.verify_contradictions !== false,
    },
    contextual_nuances,
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
      v2.investigation_strategy?.trim() ||
      v2.refinement_philosophy?.trim() ||
      v2.esoteric_guardrails?.trim() ||
      (v2.contextual_nuances?.length || 0) > 0 ||
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
  const cleanSlug = String(input.slug || '').trim().toLowerCase();
  if (cleanSlug && BUILTIN_COMPANION_SPECIALIZATIONS[cleanSlug]) {
    return [...BUILTIN_COMPANION_SPECIALIZATIONS[cleanSlug]];
  }

  const tags = new Set<string>();
  const haystack = [
    cleanSlug,
    input.primary_expertise || '',
    ...(input.secondary_expertise || []),
    ...(input.discoverable_tags || []),
    ...(input.situation_tags || []),
    input.tagline || '',
  ]
    .join(' ')
    .toLowerCase();

  // Spiritual Guides
  if (input.skill_level === 'vedic_soft' || /\b(vedic|jyotish|dasha|nakshatra|parashari|navamsa)\b/.test(haystack)) {
    tags.add('vedic_astrology');
  }
  if (/\bevolutionary astrology\b/.test(haystack)) {
    tags.add('evolutionary_astrology');
  } else if (/\bmodern astrology\b/.test(haystack)) {
    tags.add('modern_astrology');
  } else if (input.skill_level === 'astrology_soft' || /\b(western|tropical|synastry|transit)\b/.test(haystack)) {
    tags.add('western_astrology');
  }
  if (input.skill_level === 'tarot' || /\btarot\b/.test(haystack)) {
    tags.add('tarot');
  }
  if (input.skill_level === 'numerology' || /\bnumerolog/.test(haystack)) {
    tags.add('numerology');
  }
  if (input.skill_level === 'past_life' || input.category_tag === 'past_life' || /\b(past life|past-life|karma|karmic|samskara)\b/.test(haystack)) {
    tags.add('karma_past_lives');
  }
  if (/\b(faith|prayer|devotion|gita|sufism|zen|buddhist|advaita|interfaith|spiritual|spirituality|forgiveness|dharma)\b/.test(haystack)) {
    tags.add('spirituality');
  }

  // Everyday Companions
  if (/\b(listen|listening|heard|unspoken)\b/.test(haystack)) {
    tags.add('listening');
  }
  if (/\b(comfort|reassurance|healing companion|mood lifter|low mood)\b/.test(haystack)) {
    tags.add('comfort_healing');
  }
  if (/\b(cheerleader|encourag|confidence|motivation|momentum|celebration|little wins|self-belief)\b/.test(haystack)) {
    tags.add('encouragement');
  }
  if (/\b(fun friend|playful|banter|humor|humour|witty|laughter|casual friend)\b/.test(haystack)) {
    tags.add('fun_friendship');
  }
  if (/\b(candid|honest opinion|reality check|blind spot|straight talk)\b/.test(haystack)) {
    tags.add('candid_conversations');
  }
  if (/\b(calm|mindful|mindfulness|meditation|overthinking|peace of mind|restlessness|bedtime)\b/.test(haystack)) {
    tags.add('calm_mindfulness');
  }
  if (/\b(deep conversation|philosophy|existential|meaning|confidant|intellectual curiosity)\b/.test(haystack)) {
    tags.add('deep_conversations');
  }
  if (/\b(mentor|wise mentor|life wisdom|mature perspective)\b/.test(haystack)) {
    tags.add('mentorship');
  }
  if (/\b(brotherly|sisterly|family-like)\b/.test(haystack)) {
    tags.add('family_like_connection');
  }
  if (/\b(vent|venting|rant|unfiltered|frustration)\b/.test(haystack)) {
    tags.add('venting');
  }
  if (/\b(decision|thought partner|clarity|brainstorm|indecision|untangling)\b/.test(haystack)) {
    tags.add('clarity_decisions');
  }
  if (/\b(daily check-in|check-in|bedtime|daily routine|casual companion|little joys)\b/.test(haystack)) {
    tags.add('daily_companionship');
  }
  if (/\b(affection|affectionate|warmth|compliment|appreciated)\b/.test(haystack)) {
    tags.add('warmth_affection');
  }

  // Life Companions
  if (/\b(relationship|dating|love|romantic|mixed signals)\b/.test(haystack)) {
    tags.add('love_relationships');
  }
  if (/\b(heartbreak|breakup|missing an ex|ex|rejection|letting go)\b/.test(haystack)) {
    tags.add('heartbreak');
  }
  if (/\b(marriage|marital|divorce|separation|remarriage)\b/.test(haystack)) {
    tags.add('marriage_divorce');
  }
  if (/\b(grief|bereavement|mourning|anniversaries)\b/.test(haystack)) {
    tags.add('grief_loss');
  }
  if (/\b(family|parenthood|ageing parents|matters of home)\b/.test(haystack)) {
    tags.add('family_parenthood');
  }
  if (/\b(fertility|ivf|pregnancy|progeny)\b/.test(haystack)) {
    tags.add('fertility_pregnancy');
  }
  if (/\b(health|chronic illness|surgery|caregiving|recovery companion)\b/.test(haystack)) {
    tags.add('health_recovery');
  }
  if (/\b(emotional wellness|emotional wellbeing|burnout|emotional exhaustion|anxiety)\b/.test(haystack)) {
    tags.add('emotional_wellness');
  }
  if (/\b(career|business|founder|entrepreneur|startup|workplace|job)\b/.test(haystack)) {
    tags.add('career_business');
  }
  if (/\b(money|finance|financial|debt)\b/.test(haystack)) {
    tags.add('money_finances');
  }
  if (/\b(legal|dispute|litigation|negotiation|property conflict)\b/.test(haystack)) {
    tags.add('legal_challenges');
  }
  if (/\b(life direction|life transition|relocation|homesickness|finding purpose|feeling stuck)\b/.test(haystack)) {
    tags.add('life_direction');
  }
  if (/\b(trauma|abuse recovery|childhood|emotional recovery|rebuilding trust)\b/.test(haystack)) {
    tags.add('trauma_healing');
  }
  if (/\b(intimacy|vulnerability|distance)\b/.test(haystack)) {
    tags.add('intimacy');
  }
  if (/\b(identity|self-discovery|self-acceptance|self-worth|belonging)\b/.test(haystack)) {
    tags.add('identity_self_discovery');
  }
  if (/\b(student|exam|academic|study)\b/.test(haystack)) {
    tags.add('student_life');
  }

  if (tags.size === 0) {
    if (input.companion_group === 'spiritual_guides') tags.add('spirituality');
    else if (input.companion_group === 'life_companions') tags.add('life_direction');
    else tags.add('fun_friendship');
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
    core_identity_locked?: boolean;
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
  const existingLocked =
    typeof existing.core_identity_locked === 'boolean'
      ? existing.core_identity_locked
      : existing.personality_v2_json?.core_identity_locked !== false;
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
  checkStr(
    'personality_v2_json.fictional_lore',
    'Fictional Lore',
    existing.personality_v2_json?.fictional_lore,
    incoming.personality_v2_json?.fictional_lore
  );
  checkStr(
    'personality_v2_json.inner_compass.worldview',
    'Inner Compass Worldview',
    existing.personality_v2_json?.inner_compass?.worldview,
    incoming.personality_v2_json?.inner_compass?.worldview
  );
  checkStr(
    'personality_v2_json.linguistic_fingerprint',
    'Linguistic Fingerprint',
    existing.personality_v2_json?.linguistic_fingerprint,
    incoming.personality_v2_json?.linguistic_fingerprint
  );

  const prevValues = (existing.personality_v2_json?.inner_compass?.values || [])
    .map((x) => x.trim())
    .filter(Boolean)
    .join(' | ');
  const nextValues = (incoming.personality_v2_json?.inner_compass?.values || [])
    .map((x) => x.trim())
    .filter(Boolean)
    .join(' | ');
  if (prevValues && prevValues !== nextValues) {
    diffs.push({
      field: 'personality_v2_json.inner_compass.values',
      label: 'Inner Compass Values',
      before: prevValues.slice(0, 140),
      after: nextValues.slice(0, 140),
    });
  }

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

/**
 * Blank Companion V2 Template Factory (for Admin JSON export, authoring starters, and Phase 6 deliverables).
 */
export function createBlankCompanionV2Template(): CompanionExportBundle {
  return {
    bundle_type: 'cosmic_council_companion_v2',
    schema_version: 2,
    exported_at: new Date().toISOString(),
    companion: {
      slug: 'new_companion_slug',
      name: 'Companion Name',
      age: 32,
      sex: 'F',
      tagline: '',
      card_subtitle: '',
      short_bio: '',
      full_bio: '',
      how_conversations_feel: '',
      primary_expertise: '',
      secondary_expertise: [],
      category_tag: 'friends',
      companion_group: 'everyday_companions',
      advisory_mode: 'friend',
      chart_access: {
        vedic: false,
        western: false,
        tarot: false,
        numerology: false,
        past_life: false,
        council_notes: false,
      },
      formula_cartridge_slugs: [],
      max_output_tokens: null,
      discoverable_tags: [],
      situation_tags: [],
      specialization_slugs: [],
      gender_variants: {},
      override_group_rules: false,
      cultural_fluency: '',
      avatar_url: null,
      monogram_palette: { bg: '#EAE3D7', ring: '#7E7262', ink: '#3D3830' },
      welcome_messages: [''],
      system_prompt: '',
      backstory: '',
      soul_consciousness: '',
      hard_rules: '',
      soft_rules: '',
      autonomy_level: 'intuitive',
      override_global_rules: true,
      skill_level: 'none_emotional',
      chat_style: 'chat_bubbles',
      model_id: null,
      temperature: null,
      tts_voice_profile: { rate: 1.0, pitch: 1.0 },
      supports_listening_cue: true,
      suggestions_enabled: true,
      is_active: true,
      sort_order: 200,
      published_version: 1,
      personality_v2_json: {
        ...DEFAULT_COMPANION_PERSONALITY_V2,
        inner_compass: {
          worldview: '',
          values: [],
          core_anchors: [],
        },
        greeting_config: {
          mode: 'generated_returning',
          allow_memory_callback: true,
          custom_return_instruction: '',
        },
        familiarity_policy: {
          mode: 'warm_progressive',
          max_familiarity: 'close',
        },
        analytical_execution: {
          mode: 'single_pass',
          max_passes: 1,
          verify_contradictions: true,
        },
        contextual_nuances: [
          {
            id: 'nuance_1',
            label: 'Example nuance trigger',
            trigger_topics: [],
            trigger_moods: [],
            guidance: '',
            priority: 50,
          },
        ],
        reference_dialogues: [
          {
            id: 'ref_1',
            scenario: '',
            user_prompt: '',
            companion_reply: '',
            context_note: '',
            tags: [],
          },
        ],
      },
    },
  };
}

/**
 * Blank Global Companion Intelligence V2 Config Template Factory (for Phase 4/6 JSON export/import).
 */
export function createBlankGlobalConfigV2Template(): GlobalCompanionIntelligenceBundle {
  return {
    bundle_type: 'cosmic_council_companion_global_v2',
    schema_version: 2,
    exported_at: new Date().toISOString(),
    companion_constitution: '',
    companion_realism_baseline: '',
    companion_listen_only_guardrail: '',
    companion_empathy_first_guardrail: '',
    companion_chart_presence_prompt: '',
    companion_return_greeting_prompt: '',
    companion_bond_extractor_prompt: '',
    companion_matcher_instructions: '',
    companion_neutral_verification_prompt: '',
    companion_analysis_task_frame_prompt: '',
    companion_analysis_investigation_prompt: '',
    companion_analysis_refine_prompt: '',
    companion_analysis_response_strategy_prompt: '',
    companion_analysis_memory_extraction_prompt: '',
    companion_skill_rules: {
      none_emotional: '',
      vedic: '',
      western: '',
      tarot: '',
      numerology: '',
      past_life: '',
      council_notes: '',
    },
    companion_group_configs: {
      spiritual_guides: {
        group_system_prompt: '',
        default_advisory_mode: 'esoteric_guide',
        default_chart_access: {
          vedic: false,
          western: false,
          tarot: false,
          numerology: false,
          past_life: false,
          council_notes: true,
        },
        default_chat_style: 'editorial',
        default_max_output_tokens: 1800,
      },
      everyday_companions: {
        group_system_prompt: '',
        default_advisory_mode: 'friend',
        default_chart_access: {
          vedic: false,
          western: false,
          tarot: false,
          numerology: false,
          past_life: false,
          council_notes: false,
        },
        default_chat_style: 'chat_bubbles',
        default_max_output_tokens: 1100,
      },
      life_companions: {
        group_system_prompt: '',
        default_advisory_mode: 'balanced_support',
        default_chart_access: {
          vedic: false,
          western: false,
          tarot: false,
          numerology: false,
          past_life: false,
          council_notes: true,
        },
        default_chat_style: 'chat_bubbles',
        default_max_output_tokens: 1350,
      },
    },
    companion_archetypes: [],
    companion_specializations: DEFAULT_COMPANION_SPECIALIZATIONS,
  };
}

export interface CompanionFieldDiff {
  field: string;
  label: string;
  category: 'profile' | 'core_identity' | 'nuances' | 'specialist';
  before: string;
  after: string;
}

const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function stripUnsafeJsonKeys<T = unknown>(input: T, depth = 0): T {
  if (depth > 12 || input === null || typeof input !== 'object') {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => stripUnsafeJsonKeys(item, depth + 1)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
    if (UNSAFE_OBJECT_KEYS.has(key)) continue;
    out[key] = stripUnsafeJsonKeys(val, depth + 1);
  }
  return out as T;
}

function summarizeVal(v: unknown, maxLen = 140): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return '—';
    return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return '—';
    const joined = v.map((x) => (typeof x === 'string' ? x.trim() : JSON.stringify(x))).filter(Boolean).join(', ');
    return joined.length > maxLen ? `${joined.slice(0, maxLen)}…` : joined;
  }
  if (typeof v === 'object') {
    const str = JSON.stringify(v);
    return str.length > maxLen ? `${str.slice(0, maxLen)}…` : str;
  }
  return String(v);
}

/**
 * Computes human-readable field-level differences between two companion snapshots
 * for Draft-vs-Published inspection, Version comparisons, and JSON import dry-runs.
 */
export function computeCompanionFieldDiffs(
  beforeObj: Record<string, unknown> | null | undefined,
  afterObj: Record<string, unknown> | null | undefined
): CompanionFieldDiff[] {
  const before = beforeObj || {};
  const after = afterObj || {};
  const beforeV2 = normalizePersonalityV2(before.personality_v2_json);
  const afterV2 = normalizePersonalityV2(after.personality_v2_json);

  const diffs: CompanionFieldDiff[] = [];

  const compare = (
    field: string,
    label: string,
    category: CompanionFieldDiff['category'],
    a: unknown,
    b: unknown
  ) => {
    const sa = typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a ?? '').trim();
    const sb = typeof b === 'object' && b !== null ? JSON.stringify(b) : String(b ?? '').trim();
    if (sa !== sb) {
      diffs.push({
        field,
        label,
        category,
        before: summarizeVal(a),
        after: summarizeVal(b),
      });
    }
  };

  // Public Profile
  compare('name', 'Display Name', 'core_identity', before.name, after.name);
  compare('slug', 'Slug', 'core_identity', before.slug, after.slug);
  compare('age', 'Age', 'profile', before.age, after.age);
  compare('sex', 'Gender / Presentation', 'core_identity', before.sex, after.sex);
  compare('tagline', 'Tagline', 'profile', before.tagline, after.tagline);
  compare('card_subtitle', 'Card Subtitle', 'profile', before.card_subtitle, after.card_subtitle);
  compare('short_bio', 'Short Bio', 'profile', before.short_bio, after.short_bio);
  compare('full_bio', 'Full Bio', 'profile', before.full_bio, after.full_bio);
  compare('how_conversations_feel', 'How Conversations Feel', 'profile', before.how_conversations_feel, after.how_conversations_feel);
  compare('primary_expertise', 'Primary Expertise', 'profile', before.primary_expertise, after.primary_expertise);
  compare('secondary_expertise', 'Secondary Strengths', 'profile', before.secondary_expertise, after.secondary_expertise);
  compare('specialization_slugs', 'Specializations', 'profile', before.specialization_slugs, after.specialization_slugs);
  compare('discoverable_tags', 'Discoverable Tags', 'profile', before.discoverable_tags || before.situation_tags, after.discoverable_tags || after.situation_tags);
  compare('welcome_messages', 'Welcome Messages', 'profile', before.welcome_messages, after.welcome_messages);
  compare('avatar_url', 'Avatar Portrait', 'profile', before.avatar_url, after.avatar_url);
  compare('is_active', 'Active in Hub', 'profile', before.is_active, after.is_active);
  compare('sort_order', 'Sort Order', 'profile', before.sort_order, after.sort_order);

  // Core Identity & Voice
  compare('core_identity_locked', 'Core Identity Lock', 'core_identity', before.core_identity_locked ?? true, after.core_identity_locked ?? true);
  compare('backstory', 'Private Back Story', 'core_identity', before.backstory, after.backstory);
  compare('system_prompt', 'Legacy System Prompt', 'core_identity', before.system_prompt, after.system_prompt);
  compare('personality_v2_json.core_identity_capsule', 'Core Identity Capsule', 'core_identity', beforeV2.core_identity_capsule, afterV2.core_identity_capsule);
  compare('personality_v2_json.character_essence', 'Character Essence', 'core_identity', beforeV2.character_essence, afterV2.character_essence);
  compare('personality_v2_json.fictional_lore', 'Fictional Lore', 'core_identity', beforeV2.fictional_lore, afterV2.fictional_lore);
  compare('personality_v2_json.inner_compass.worldview', 'Inner Compass Worldview', 'core_identity', beforeV2.inner_compass.worldview, afterV2.inner_compass.worldview);
  compare('personality_v2_json.inner_compass.values', 'Inner Compass Values', 'core_identity', beforeV2.inner_compass.values, afterV2.inner_compass.values);
  compare('personality_v2_json.inner_compass.core_anchors', 'Core Anchors', 'core_identity', beforeV2.inner_compass.core_anchors, afterV2.inner_compass.core_anchors);
  compare('personality_v2_json.expression_spectrum', 'Expression Spectrum', 'core_identity', beforeV2.expression_spectrum, afterV2.expression_spectrum);
  compare('personality_v2_json.subtle_contradictions', 'Subtle Contradictions', 'core_identity', beforeV2.subtle_contradictions, afterV2.subtle_contradictions);
  compare('personality_v2_json.humour_and_interests', 'Humour & Interests', 'core_identity', beforeV2.humour_and_interests, afterV2.humour_and_interests);
  compare('personality_v2_json.quirks_and_habits', 'Quirks & Habits', 'core_identity', beforeV2.quirks_and_habits, afterV2.quirks_and_habits);
  compare('personality_v2_json.linguistic_fingerprint', 'Linguistic Fingerprint', 'core_identity', beforeV2.linguistic_fingerprint, afterV2.linguistic_fingerprint);
  compare('personality_v2_json.interpersonal_dynamics', 'Interpersonal Dynamics', 'core_identity', beforeV2.interpersonal_dynamics, afterV2.interpersonal_dynamics);
  compare('personality_v2_json.soft_instincts', 'Soft Instincts', 'core_identity', beforeV2.soft_instincts, afterV2.soft_instincts);
  compare('personality_v2_json.autonomy_guidance', 'Autonomy Guidance', 'core_identity', beforeV2.autonomy_guidance, afterV2.autonomy_guidance);
  compare('autonomy_level', 'Autonomy Level', 'core_identity', before.autonomy_level, after.autonomy_level);

  // Nuances, Greetings, Familiarity & Reference Dialogues
  compare('personality_v2_json.greeting_config', 'Greeting Behavior', 'nuances', beforeV2.greeting_config, afterV2.greeting_config);
  compare('personality_v2_json.familiarity_policy', 'Relational Familiarity Policy', 'nuances', beforeV2.familiarity_policy, afterV2.familiarity_policy);
  compare(
    'personality_v2_json.contextual_nuances',
    'Contextual Nuances',
    'nuances',
    beforeV2.contextual_nuances.map((n) => `${n.label} (p${n.priority})`),
    afterV2.contextual_nuances.map((n) => `${n.label} (p${n.priority})`)
  );
  compare(
    'personality_v2_json.reference_dialogues',
    'Reference Dialogues',
    'nuances',
    beforeV2.reference_dialogues.map((d) => d.scenario || d.user_prompt.slice(0, 40)),
    afterV2.reference_dialogues.map((d) => d.scenario || d.user_prompt.slice(0, 40))
  );

  // Specialist & Context Rules
  compare('companion_group', 'Pillar Group', 'specialist', before.companion_group, after.companion_group);
  compare('advisory_mode', 'Advisory Mode', 'specialist', before.advisory_mode, after.advisory_mode);
  compare('personality_v2_json.specialist_expertise', 'Specialist Expertise', 'specialist', beforeV2.specialist_expertise, afterV2.specialist_expertise);
  compare('personality_v2_json.signature_methodology', 'Signature Methodology', 'specialist', beforeV2.signature_methodology, afterV2.signature_methodology);
  compare('personality_v2_json.investigation_strategy', 'Investigation Strategy', 'specialist', beforeV2.investigation_strategy, afterV2.investigation_strategy);
  compare('personality_v2_json.refinement_philosophy', 'Epistemic Refinement Philosophy', 'specialist', beforeV2.refinement_philosophy, afterV2.refinement_philosophy);
  compare('personality_v2_json.astrology_entry_rule', 'Astrology Entry Rule', 'specialist', beforeV2.astrology_entry_rule, afterV2.astrology_entry_rule);
  compare('personality_v2_json.verification_mode', 'Verification Mode', 'specialist', beforeV2.verification_mode, afterV2.verification_mode);
  compare('personality_v2_json.astrological_memory_mode', 'Astrological Memory Mode', 'specialist', beforeV2.astrological_memory_mode, afterV2.astrological_memory_mode);
  compare('personality_v2_json.analytical_execution', 'Analytical Execution Mode', 'specialist', beforeV2.analytical_execution, afterV2.analytical_execution);
  compare('personality_v2_json.ai_identity_disclosure', 'AI Identity Disclosure', 'specialist', beforeV2.ai_identity_disclosure, afterV2.ai_identity_disclosure);
  compare('personality_v2_json.esoteric_guardrails', 'Esoteric & Hard Guardrails', 'specialist', beforeV2.esoteric_guardrails, afterV2.esoteric_guardrails);
  compare('chart_access', 'Chart Access Flags', 'specialist', before.chart_access, after.chart_access);
  compare('formula_cartridge_slugs', 'Formula Cartridges', 'specialist', before.formula_cartridge_slugs, after.formula_cartridge_slugs);
  compare('chat_style', 'Chat Style', 'specialist', before.chat_style, after.chat_style);
  compare('model_id', 'Model Override', 'specialist', before.model_id, after.model_id);
  compare('temperature', 'Temperature Override', 'specialist', before.temperature ?? null, after.temperature ?? null);
  compare('max_output_tokens', 'Max Output Tokens', 'specialist', before.max_output_tokens, after.max_output_tokens);
  compare('override_global_rules', 'Override Global Rules', 'specialist', before.override_global_rules, after.override_global_rules);
  compare('override_group_rules', 'Override Group Rules', 'specialist', before.override_group_rules, after.override_group_rules);

  return diffs;
}

/**
 * Reversible Consultants-only strategic mode.
 * Set CONSULTANTS_ONLY_MODE to `false` (or update EXCLUDED_CONSULTANT_SLUGS_WHEN_CONSULTANTS_ONLY)
 * to instantly restore Everyday Companions, Life Companions, Shanti, and Omar without data loss.
 */
export const CONSULTANTS_ONLY_MODE = true;

export const EXCLUDED_CONSULTANT_SLUGS_WHEN_CONSULTANTS_ONLY: readonly string[] = [
  'shanti',
  'omar',
] as const;

export const COMPANION_LABEL_SINGULAR = CONSULTANTS_ONLY_MODE ? 'Consultant' : 'Companion';
export const COMPANION_LABEL_PLURAL = CONSULTANTS_ONLY_MODE ? 'Consultants' : 'Companions';

export function isConsultantCatalogEntryAllowed(item: {
  slug?: string | null;
  companion_group?: string | null;
}): boolean {
  if (!CONSULTANTS_ONLY_MODE) return true;
  const slug = String(item.slug || '').trim().toLowerCase();
  if (slug && EXCLUDED_CONSULTANT_SLUGS_WHEN_CONSULTANTS_ONLY.includes(slug)) {
    return false;
  }
  const group = String(item.companion_group || '').trim().toLowerCase();
  return group === 'spiritual_guides' || group === 'spiritual';
}

