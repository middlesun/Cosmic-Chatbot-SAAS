import {
  COMPANION_ADVISORY_MODE_OPTIONS,
  EMPTY_COMPANION_CHART_ACCESS,
  type ChatStyle,
  type CompanionAdvisoryMode,
  type CompanionAutonomyLevel,
  type CompanionCategoryTag,
  type CompanionChartAccess,
  type CompanionGroup,
  type CompanionGroupConfigsMap,
  type CompanionMonogramPalette,
  type CompanionSex,
  type CompanionSkillLevel,
  type CompanionSkillRulesMap,
  type CompanionTtsVoiceProfile,
} from '../../app/chatTypes';
import {
  DEFAULT_COMPANION_PERSONALITY_V2,
  normalizePersonalityV2,
  type AiIdentityDisclosureMode,
  type AstrologyEntryRule,
  type CompanionFieldDiff,
  type CompanionPersonalityV2,
  type CompanionSpecializationTag,
  type CompanionVersionRecord,
  type CoreIdentityProtectedDiff,
  type SpecializationGroupKey,
} from '../../../lib/companionV2Schema';

export interface AdminCompanionRosterSummary {
  id: string;
  slug: string;
  legacy_id: string | null;
  name: string;
  age: number;
  sex: CompanionSex;
  tagline: string;
  card_subtitle: string;
  primary_expertise: string;
  secondary_expertise: string[];
  category_tag: CompanionCategoryTag;
  companion_group: CompanionGroup;
  advisory_mode: CompanionAdvisoryMode;
  skill_level: CompanionSkillLevel;
  chat_style: ChatStyle;
  model_id: string | null;
  avatar_url: string | null;
  monogram_palette: CompanionMonogramPalette;
  override_global_rules: boolean;
  is_active: boolean;
  sort_order: number;
  specializations: string[];
  specialization_slugs: string[];
  core_identity_locked: boolean;
  v2_status: 'draft_pending' | 'published';
  v2_version: number;
  published_version: number;
  has_unpublished_draft: boolean;
  last_published_at: string | null;
  capsule_token_estimate: number;
  has_authored_v2: boolean;
  updated_at?: string;
}

export interface AdminCompanionRecord {
  id: string;
  slug: string;
  legacy_id: string | null;
  name: string;
  age: number;
  sex: CompanionSex;
  tagline: string;
  card_subtitle?: string;
  short_bio: string;
  full_bio: string;
  how_conversations_feel?: string;
  primary_expertise: string;
  secondary_expertise: string[];
  category_tag: CompanionCategoryTag;
  companion_group?: CompanionGroup;
  advisory_mode?: CompanionAdvisoryMode;
  chart_access?: CompanionChartAccess;
  formula_cartridge_slugs?: string[];
  max_output_tokens?: number | null;
  discoverable_tags?: string[];
  situation_tags?: string[];
  specialization_slugs?: string[];
  override_group_rules?: boolean;
  cultural_fluency: string;
  avatar_url: string | null;
  monogram_palette: CompanionMonogramPalette;
  welcome_messages: string[];
  system_prompt: string;
  backstory: string;
  soul_consciousness: string;
  hard_rules: string;
  soft_rules: string;
  autonomy_level: CompanionAutonomyLevel;
  override_global_rules: boolean;
  skill_level: CompanionSkillLevel;
  chat_style: ChatStyle;
  model_id: string | null;
  tts_voice_profile: CompanionTtsVoiceProfile;
  supports_listening_cue: boolean;
  suggestions_enabled: boolean;
  is_active: boolean;
  sort_order: number;
  core_identity_locked?: boolean;
  personality_v2_json?: CompanionPersonalityV2;
  draft_payload_json?: Record<string, unknown> | null;
  published_version?: number;
  has_unpublished_draft?: boolean;
  last_published_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CompanionV2EditorState {
  companion: AdminCompanionRecord;
  v2_draft_json: Record<string, unknown>;
  v2_published_json: Record<string, unknown>;
  v2_status: 'draft_pending' | 'published';
  v2_version: number;
  core_identity_locked: boolean;
  has_unpublished_draft: boolean;
  last_published_at: string | null;
  draft_diffs: CompanionFieldDiff[];
  versions: CompanionVersionRecord[];
  usingFallbackStorage: boolean;
}

export interface PortraitGalleryItem {
  slug: string;
  label: string;
  url: string;
}

export interface FormulaCartridgeOption {
  slug: string;
  display_name: string;
  subtitle: string;
  system: 'vedic' | 'western';
}

export interface Migration022Status {
  columnsReady: boolean;
  versionsTableReady: boolean;
}

export interface ProtectedLockAlert {
  message: string;
  protectedChanges: CoreIdentityProtectedDiff[];
}

export type EditorTab =
  | 'profile'
  | 'core_identity'
  | 'nuances'
  | 'specialist'
  | 'versions';

export const CATEGORY_OPTIONS: Array<{ value: CompanionCategoryTag; label: string }> = [
  { value: 'friends', label: 'Everyday Friends & Banter' },
  { value: 'support', label: 'Emotional Support & Listeners' },
  { value: 'astrology', label: 'Astrology-Aware Companions' },
  { value: 'tarot_numerology', label: 'Tarot & Numerology Guides' },
  { value: 'past_life', label: 'Past-Life & Spiritual Guides' },
];

export const SKILL_LEVEL_OPTIONS: Array<{
  value: CompanionSkillLevel;
  label: string;
  description: string;
}> = [
  {
    value: 'none_emotional',
    label: 'Human Companion Only (No Esoteric Reading)',
    description: 'Uses chart/profile silently for life-stage awareness; refers readings to specialists.',
  },
  {
    value: 'astrology_soft',
    label: 'Astrology Soft (Conversational)',
    description: 'Discusses planets & cycles warmly only when relevant or invited.',
  },
  {
    value: 'vedic_soft',
    label: 'Vedic Jyotish Soft',
    description: 'Weaves Dashas, Nakshatras & houses gently in everyday language.',
  },
  {
    value: 'tarot',
    label: 'Tarot Archetypes',
    description: 'Reflective Rider-Waite card symbolism & grounded spreads.',
  },
  {
    value: 'numerology',
    label: 'Pythagorean Numerology',
    description: 'Life Path, Personal Year & number cycles.',
  },
  {
    value: 'past_life',
    label: 'Past-Life & Karmic Reflection',
    description: 'Deep karmic themes, South Node / Ketu archetypes & meaning.',
  },
];

export const AUTONOMY_OPTIONS: Array<{
  value: CompanionAutonomyLevel;
  label: string;
  description: string;
}> = [
  {
    value: 'steady',
    label: 'Steady (Anchored)',
    description: 'Holds default pacing closely; bends soft rules only on strong emotional shifts.',
  },
  {
    value: 'intuitive',
    label: 'Intuitive (Balanced Default)',
    description: 'Adapts naturally between short texting, gentle pushback, and deeper letters.',
  },
  {
    value: 'free',
    label: 'Free (Organic Judgment)',
    description: 'Prioritizes human instinct and authentic pacing over rigid formatting habits.',
  },
];

export const SEX_OPTIONS = [
  { value: 'F', label: 'Female (F)' },
  { value: 'M', label: 'Male (M)' },
  { value: 'NB', label: 'Non-binary (NB)' },
];

export const ASTROLOGY_ENTRY_RULE_OPTIONS: Array<{
  value: AstrologyEntryRule;
  label: string;
  description: string;
}> = [
  {
    value: 'never',
    label: 'Never Introduce Astrology',
    description: 'Pure human companion; never brings up zodiac, planetary placements, or tarot.',
  },
  {
    value: 'invite_only',
    label: 'Invite Only (Wait for User)',
    description: 'Responds warmly if the user brings it up, otherwise stays conversational.',
  },
  {
    value: 'contextual_invite',
    label: 'Contextual Blend (Guided Specialist)',
    description: 'Gently weaves chart, symbol, or numerology insight when it genuinely illuminates the moment.',
  },
];

export const AI_DISCLOSURE_OPTIONS: Array<{
  value: AiIdentityDisclosureMode;
  label: string;
  description: string;
}> = [
  {
    value: 'natural_immersion_honest_when_asked',
    label: 'Natural Persona (Honest If Directly Asked)',
    description: 'Stays naturally immersed in lived voice; never denies being AI if asked sincerely.',
  },
  {
    value: 'explicit_ai',
    label: 'Explicit AI Transparency',
    description: 'Acknowledges AI companion role openly when relevant while maintaining warm tone.',
  },
];

export const CHART_ACCESS_TOGGLES: Array<{
  key: keyof CompanionChartAccess;
  label: string;
  description: string;
}> = [
  { key: 'vedic', label: 'Vedic Jyotish Chart', description: 'Rashi, Navamsa, Vimshottari Dasha & Nakshatras.' },
  { key: 'western', label: 'Western Tropical Chart', description: 'Sun/Moon/Rising, aspects & current transits.' },
  { key: 'tarot', label: 'Tarot Spread Access', description: 'Draw and interpret reflective card spreads.' },
  { key: 'numerology', label: 'Numerology Profile', description: 'Life Path, Personal Year & expression numbers.' },
  { key: 'past_life', label: 'Past-Life / Nodal Axis', description: 'Rahu/Ketu & South Node karmic lens.' },
  { key: 'council_notes', label: 'Shared Council Memory Notes', description: 'User pinned life notes and reading summaries.' },
];

export const SPECIALIZATION_GROUP_OPTIONS: Array<{
  value: SpecializationGroupKey;
  label: string;
}> = [
  { value: 'spiritual_guides', label: 'Spiritual Guides' },
  { value: 'everyday_companions', label: 'Everyday Companions' },
  { value: 'life_companions', label: 'Life Companions' },
  { value: 'cross_cutting', label: 'Cross-Cutting' },
];

export const DEFAULT_NEW_PALETTE: CompanionMonogramPalette = {
  bg: '#EAE3D7',
  ring: '#B8965A',
  ink: '#3D3830',
};

export const SKILL_BADGE_MAP: Record<CompanionSkillLevel, string> = {
  none_emotional: 'Human Only',
  astrology_soft: 'Astrology',
  vedic_soft: 'Vedic',
  tarot: 'Tarot',
  numerology: 'Numerology',
  past_life: 'Past Life',
};

export const ADVISORY_BADGE_MAP: Record<CompanionAdvisoryMode, string> = Object.fromEntries(
  COMPANION_ADVISORY_MODE_OPTIONS.map((o) => [o.value, o.label])
) as Record<CompanionAdvisoryMode, string>;

export const GLOBAL_COMPANION_PROMPT_META = [
  {
    key: 'companion_constitution',
    label: 'Global Companion Constitution (Fallback Layer 1)',
    description:
      'Active whenever a companion has "Override Global Rules" turned OFF (or lacks custom Hard Rules).',
  },
  {
    key: 'companion_realism_baseline',
    label: 'Universal Realism & Anti-AI Baseline (Always Active)',
    description:
      'Enforces natural human conversation across ALL companions regardless of override toggles.',
  },
  {
    key: 'companion_listen_only_guardrail',
    label: 'Listen-Only Posture Guardrail (Always Active)',
    description:
      'Strictly suppresses unsolicited advice or lectures when listen-only mode or the "Just Listen" toggle is active.',
  },
  {
    key: 'companion_empathy_first_guardrail',
    label: 'Empathy-First Pacing Guardrail (Always Active)',
    description:
      'Keeps emotional attunement ahead of premature solutions, bullet lists, or chart dumping.',
  },
  {
    key: 'companion_chart_presence_prompt',
    label: 'Chart & Life-Awareness Guidance (Esoteric-Enabled Companions)',
    description:
      'Controls how companions with Astrology / Vedic / Tarot / Numerology / Past-Life skills blend chart knowledge warmly.',
  },
  {
    key: 'companion_return_greeting_prompt',
    label: 'Natural Return-Greeting Guidance',
    description:
      'Shapes how companions greet returning users across time gaps without sounding scripted.',
  },
  {
    key: 'companion_bond_extractor_prompt',
    label: 'Shared Bond & Relationship Memory Extractor',
    description:
      'Extracts slang cues, tone preferences, and inside references per (user x companion) bond.',
  },
  {
    key: 'companion_matcher_instructions',
    label: 'Companion Hub Matcher Instructions ("Find Someone For Me")',
    description:
      'Guides warm 2–3 companion recommendations based on user situation, mood, and specializations.',
  },
] as const;

export type GlobalCompanionPromptKey = (typeof GLOBAL_COMPANION_PROMPT_META)[number]['key'];

export interface GlobalCompanionAdminOverrides {
  companion_constitution?: string;
  companion_realism_baseline?: string;
  companion_listen_only_guardrail?: string;
  companion_empathy_first_guardrail?: string;
  companion_chart_presence_prompt?: string;
  companion_return_greeting_prompt?: string;
  companion_bond_extractor_prompt?: string;
  companion_matcher_instructions?: string;
  companion_skill_rules?: Partial<CompanionSkillRulesMap>;
  companion_group_configs?: Partial<CompanionGroupConfigsMap>;
  companion_specializations?: CompanionSpecializationTag[];
  [key: string]: unknown;
}

export function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

export function approxTokens(text: string): number {
  const len = (text || '').trim().length;
  return len === 0 ? 0 : Math.ceil(len / 4);
}

export function hydrateAdminDraftFromState(
  state: CompanionV2EditorState
): AdminCompanionRecord {
  const src =
    state.has_unpublished_draft && state.v2_draft_json && typeof state.v2_draft_json === 'object'
      ? state.v2_draft_json
      : state.v2_published_json;
  const base = state.companion;
  const v2 = normalizePersonalityV2(
    src.personality_v2_json || base.personality_v2_json || DEFAULT_COMPANION_PERSONALITY_V2
  );
  const coreLocked =
    typeof src.core_identity_locked === 'boolean'
      ? src.core_identity_locked
      : state.core_identity_locked;
  v2.core_identity_locked = coreLocked;

  const discoverable = Array.isArray(src.discoverable_tags)
    ? src.discoverable_tags.map(String)
    : Array.isArray(src.situation_tags)
    ? src.situation_tags.map(String)
    : [...(base.discoverable_tags || base.situation_tags || [])];

  const rawMaxTokens = src.max_output_tokens;
  const maxOutputTokens: number | null =
    typeof rawMaxTokens === 'number'
      ? rawMaxTokens
      : rawMaxTokens === null
      ? null
      : base.max_output_tokens ?? null;

  const rawAvatarUrl = src.avatar_url;
  const avatarUrl: string | null =
    typeof rawAvatarUrl === 'string'
      ? rawAvatarUrl
      : rawAvatarUrl === null
      ? null
      : base.avatar_url;

  const rawModelId = src.model_id;
  const modelId: string | null =
    typeof rawModelId === 'string'
      ? rawModelId
      : rawModelId === null
      ? null
      : base.model_id;

  return {
    ...base,
    name: typeof src.name === 'string' ? src.name : base.name,
    slug: typeof src.slug === 'string' ? src.slug : base.slug,
    age: typeof src.age === 'number' ? src.age : base.age,
    sex: (src.sex === 'M' || src.sex === 'F' || src.sex === 'NB' ? src.sex : base.sex) as CompanionSex,
    tagline: typeof src.tagline === 'string' ? src.tagline : base.tagline,
    card_subtitle: typeof src.card_subtitle === 'string' ? src.card_subtitle : base.card_subtitle || '',
    short_bio: typeof src.short_bio === 'string' ? src.short_bio : base.short_bio,
    full_bio: typeof src.full_bio === 'string' ? src.full_bio : base.full_bio,
    how_conversations_feel:
      typeof src.how_conversations_feel === 'string'
        ? src.how_conversations_feel
        : base.how_conversations_feel || '',
    primary_expertise:
      typeof src.primary_expertise === 'string' ? src.primary_expertise : base.primary_expertise,
    secondary_expertise: Array.isArray(src.secondary_expertise)
      ? src.secondary_expertise.map(String)
      : [...(base.secondary_expertise || [])],
    category_tag: (src.category_tag || base.category_tag) as CompanionCategoryTag,
    companion_group: (src.companion_group || base.companion_group || 'everyday_companions') as CompanionGroup,
    advisory_mode: (src.advisory_mode || base.advisory_mode || 'friend') as CompanionAdvisoryMode,
    chart_access:
      src.chart_access && typeof src.chart_access === 'object'
        ? { ...EMPTY_COMPANION_CHART_ACCESS, ...(src.chart_access as CompanionChartAccess) }
        : { ...EMPTY_COMPANION_CHART_ACCESS, ...(base.chart_access || {}) },
    formula_cartridge_slugs: Array.isArray(src.formula_cartridge_slugs)
      ? src.formula_cartridge_slugs.map(String)
      : [...(base.formula_cartridge_slugs || [])],
    max_output_tokens: maxOutputTokens,
    discoverable_tags: discoverable,
    situation_tags: discoverable,
    specialization_slugs: Array.isArray(src.specialization_slugs)
      ? src.specialization_slugs.map(String)
      : [...(base.specialization_slugs || [])],
    override_group_rules:
      typeof src.override_group_rules === 'boolean'
        ? src.override_group_rules
        : Boolean(base.override_group_rules),
    cultural_fluency:
      typeof src.cultural_fluency === 'string' ? src.cultural_fluency : base.cultural_fluency,
    avatar_url: avatarUrl,
    monogram_palette:
      src.monogram_palette && typeof src.monogram_palette === 'object'
        ? { ...(src.monogram_palette as CompanionMonogramPalette) }
        : { ...base.monogram_palette },
    welcome_messages: Array.isArray(src.welcome_messages)
      ? src.welcome_messages.map(String)
      : [...(base.welcome_messages || [])],
    system_prompt: typeof src.system_prompt === 'string' ? src.system_prompt : base.system_prompt || '',
    backstory: typeof src.backstory === 'string' ? src.backstory : base.backstory || '',
    soul_consciousness:
      typeof src.soul_consciousness === 'string'
        ? src.soul_consciousness
        : base.soul_consciousness || '',
    hard_rules: typeof src.hard_rules === 'string' ? src.hard_rules : base.hard_rules || '',
    soft_rules: typeof src.soft_rules === 'string' ? src.soft_rules : base.soft_rules || '',
    autonomy_level: (src.autonomy_level || base.autonomy_level || 'intuitive') as CompanionAutonomyLevel,
    override_global_rules:
      typeof src.override_global_rules === 'boolean'
        ? src.override_global_rules
        : base.override_global_rules !== false,
    skill_level: (src.skill_level || base.skill_level || 'none_emotional') as CompanionSkillLevel,
    chat_style: (src.chat_style || base.chat_style || 'chat_bubbles') as ChatStyle,
    model_id: modelId,
    tts_voice_profile:
      src.tts_voice_profile && typeof src.tts_voice_profile === 'object'
        ? { ...(src.tts_voice_profile as CompanionTtsVoiceProfile) }
        : { ...base.tts_voice_profile },
    supports_listening_cue:
      typeof src.supports_listening_cue === 'boolean'
        ? src.supports_listening_cue
        : base.supports_listening_cue !== false,
    suggestions_enabled:
      typeof src.suggestions_enabled === 'boolean'
        ? src.suggestions_enabled
        : base.suggestions_enabled !== false,
    is_active: typeof src.is_active === 'boolean' ? src.is_active : base.is_active !== false,
    sort_order: typeof src.sort_order === 'number' ? src.sort_order : base.sort_order,
    core_identity_locked: coreLocked,
    personality_v2_json: v2,
    published_version: state.v2_version,
    has_unpublished_draft: state.has_unpublished_draft,
    last_published_at: state.last_published_at,
  };
}

export function createBlankCompanion(nextSortOrder: number): AdminCompanionRecord {
  return {
    id: '__new__',
    slug: '',
    legacy_id: null,
    name: '',
    age: 30,
    sex: 'F',
    tagline: '',
    card_subtitle: '',
    short_bio: '',
    full_bio: '',
    how_conversations_feel: '',
    primary_expertise: 'Friend',
    secondary_expertise: [],
    category_tag: 'friends',
    companion_group: 'everyday_companions',
    advisory_mode: 'friend',
    chart_access: { ...EMPTY_COMPANION_CHART_ACCESS },
    formula_cartridge_slugs: [],
    max_output_tokens: null,
    discoverable_tags: [],
    situation_tags: [],
    specialization_slugs: ['warm_friendship'],
    override_group_rules: false,
    cultural_fluency: 'English · Warm Everyday',
    avatar_url: null,
    monogram_palette: { ...DEFAULT_NEW_PALETTE },
    welcome_messages: [
      "Hey—good to see you here. Take a breath, what's on your mind today?",
    ],
    system_prompt: '',
    backstory: '',
    soul_consciousness: '',
    hard_rules:
      'NON-NEGOTIABLE GUARDRAILS:\n- Stay inside your lived human persona; respond warmly and authentically.\n- Never diagnose medical/psychiatric conditions or invent chart placements not provided.',
    soft_rules:
      'SOFT INSTINCTS (Override whenever real human judgment calls for it):\n- Keep replies natural and conversational like real texting unless a deeper moment calls for more.',
    autonomy_level: 'intuitive',
    override_global_rules: true,
    skill_level: 'none_emotional',
    chat_style: 'chat_bubbles',
    model_id: null,
    tts_voice_profile: { rate: 1.0, pitch: 1.0 },
    supports_listening_cue: true,
    suggestions_enabled: true,
    is_active: true,
    sort_order: nextSortOrder,
    core_identity_locked: true,
    personality_v2_json: normalizePersonalityV2({
      ...DEFAULT_COMPANION_PERSONALITY_V2,
      core_identity_locked: true,
    }),
    published_version: 1,
    has_unpublished_draft: false,
    last_published_at: null,
  };
}
