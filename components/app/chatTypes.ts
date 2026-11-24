import type {
  LifeContextAnchor,
  LifeContextChild,
  LifeContextData,
} from '../../lib/lifeContextSchema';
import {
  DEFAULT_COUNCIL_EXPERT_SLUG,
  normalizeCouncilSlug,
  type ClarificationChip,
  type ClarificationPayload,
  type Stage1RouterResult,
  type TimingProgressWidget,
  type TimingWidgetId,
  type VedicSynthesisMeta,
} from '../../lib/vedicTypes';
import type { DrawnTarotCard, DrawnTarotSpread } from '../../lib/tarotDeck';

export {
  DEFAULT_COUNCIL_EXPERT_SLUG,
  normalizeCouncilSlug,
};

export type {
  LifeContextAnchor,
  LifeContextChild,
  LifeContextData,
  ClarificationChip,
  ClarificationPayload,
  Stage1RouterResult,
  VedicSynthesisMeta,
  TimingProgressWidget,
  TimingWidgetId,
  DrawnTarotCard,
  DrawnTarotSpread,
};

export interface ChatCatalogOption {
  slug: string;
  category: string;
  displayName: string;
  subtitle: string;
}

export interface ChatCatalog {
  experts: ChatCatalogOption[];
  modes: ChatCatalogOption[];
  outputs: ChatCatalogOption[];
  languages: ChatCatalogOption[];
  tools: ChatCatalogOption[];
}

export interface SuggestionItem {
  id: string;
  text: string;
  technical_directive?: string;
  action?: 'deep_audit';
  playbook_id?: string;
}

export interface MessageSuggestions {
  followups: SuggestionItem[];
  deeper_analysis: SuggestionItem[];
  clarification?: ClarificationPayload | null;
  vedic_stage1?: Stage1RouterResult | null;
  vedic_meta?: VedicSynthesisMeta | null;
  sutra_stage1?: Stage1RouterResult | null;
  sutra_meta?: VedicSynthesisMeta | null;
  tech_breakdown?: string | null;
  timing_widgets?: TimingProgressWidget[] | null;
  tarot_spread?: DrawnTarotSpread | null;
}

export interface AskLaterItem {
  id: string;
  text: string;
  tier: 'followup' | 'deeper_analysis';
  technical_directive?: string;
  source_message_id?: string;
  saved_at: string;
}

export interface PublicSuggestionsUiConfig {
  followups_enabled: boolean;
  deeper_analysis_enabled: boolean;
  default_expanded: boolean;
  max_followups: number;
  max_deeper_analysis: number;
}

export interface ChatProfile {
  id: string;
  name: string;
  short_name?: string | null;
  is_default?: boolean;
  birth_date: string;
  birth_time?: string;
  birth_city: string;
  birth_country: string;
  current_city?: string | null;
  current_state?: string | null;
  current_country?: string | null;
  current_timezone_offset?: number | null;
  relationship: string | null;
  is_activated: boolean;
  profile_memory_summary?: string | null;
  life_context_json?: LifeContextData | null;
  life_context_completeness?: number;
  natal_dossier_version?: number;
}

export type ChatPillar = 'council' | 'companion' | 'clarity';

export type CompanionArchetypeSlug =
  | 'find_someone'
  | 'friend'
  | 'listener'
  | 'motivator'
  | 'life_coach'
  | 'spiritual_guide';

export type ChatStyle =
  | 'editorial'
  | 'structured'
  | 'chat_bubbles'
  | 'dialogue'
  | 'concise_brief';

export const CHAT_STYLE_OPTIONS: Array<{
  value: ChatStyle;
  label: string;
  description: string;
}> = [
  {
    value: 'editorial',
    label: 'Editorial Essay',
    description: 'Flowing long-form markdown prose with calm typographic breathing room.',
  },
  {
    value: 'structured',
    label: 'Structured Dossier',
    description: 'Sectioned parchment cards, comparison tables, and observatory timing bars.',
  },
  {
    value: 'chat_bubbles',
    label: 'Chat Bubbles',
    description: 'Two-sided messaging bubbles with DP, live typing pauses, and reactions.',
  },
  {
    value: 'dialogue',
    label: 'Reflective Letters',
    description: 'Spacious, intimate parchment note cards with subtle brass accent.',
  },
  {
    value: 'concise_brief',
    label: 'Quick Brief',
    description: 'High-signal 1–2 sentence core takeaway plus crisp supporting points.',
  },
];

export type CompanionCategoryTag =
  | 'support'
  | 'friends'
  | 'astrology'
  | 'tarot_numerology'
  | 'past_life';

export type CompanionGroup = 'spiritual' | 'everyday' | 'life';

export const COMPANION_GROUP_OPTIONS: Array<{
  value: CompanionGroup;
  label: string;
  description: string;
}> = [
  {
    value: 'spiritual',
    label: 'Spiritual Guides',
    description: 'Astrology, Tarot, Numerology, Karma & contemplative spiritual guidance.',
  },
  {
    value: 'everyday',
    label: 'Everyday Companions',
    description: 'Listeners, Comforters, Mood Lifters, Friends, Confidants & Overthinking Reset.',
  },
  {
    value: 'life',
    label: 'Life Companions',
    description: 'Breakup, Divorce, Grief, Career, Founders, Money, Family & Relocation support.',
  },
];

export type CompanionDiscoveryTabId = 'all' | CompanionGroup;

export const COMPANION_DISCOVERY_TABS: Array<{
  id: CompanionDiscoveryTabId;
  label: string;
}> = [
  { id: 'all', label: 'All' },
  { id: 'spiritual', label: 'Spiritual Guides' },
  { id: 'everyday', label: 'Everyday Companions' },
  { id: 'life', label: 'Life Companions' },
];

export interface CompanionSituationChip {
  id: string;
  label: string;
  matchTags: string[];
  fallbackKeywords: string[];
}

export const COMPANION_SITUATION_CHIPS: CompanionSituationChip[] = [
  {
    id: 'heartbreak',
    label: 'Heartbreak',
    matchTags: ['heartbreak', 'breakup', 'moving-on', 'ex', 'closure', 'red-flags'],
    fallbackKeywords: ['heartbreak', 'breakup', 'letting go', 'red flags'],
  },
  {
    id: 'vent',
    label: 'Vent',
    matchTags: ['vent', 'listen', 'overwhelmed', 'judgment-free', 'heavy-day'],
    fallbackKeywords: ['vent', 'listen', 'judgment-free', 'heavy day'],
  },
  {
    id: 'career',
    label: 'Career',
    matchTags: [
      'career',
      'job-switch',
      'workplace',
      'work-stress',
      'founders',
      'startup',
      'business',
      'burnout',
    ],
    fallbackKeywords: ['career', 'job', 'workplace', 'founder', 'startup', 'business', 'burnout'],
  },
  {
    id: 'grief',
    label: 'Grief',
    matchTags: ['grief', 'loss', 'bereavement', 'mourning'],
    fallbackKeywords: ['grief', 'loss', 'bereavement', 'mourning'],
  },
  {
    id: 'bedtime',
    label: 'Bedtime',
    matchTags: ['bedtime', 'late-night', 'insomnia', 'sleep', 'lonely'],
    fallbackKeywords: ['bedtime', 'late-night', 'late night', 'insomnia', 'sleep'],
  },
  {
    id: 'tarot',
    label: 'Tarot',
    matchTags: ['tarot', 'crossroads', 'mixed-signals'],
    fallbackKeywords: ['tarot', 'spread', 'cards'],
  },
  {
    id: 'astrology',
    label: 'Astrology',
    matchTags: ['astrology', 'vedic', 'chart', 'timing', 'dharma', 'mood-cycles'],
    fallbackKeywords: ['astrology', 'vedic', 'jyotish', 'natal', 'transit'],
  },
  {
    id: 'stuck',
    label: 'Feeling Stuck',
    matchTags: ['stuck', 'unmotivated', 'procrastination', 'restarting', 'motivation', 'inertia'],
    fallbackKeywords: ['stuck', 'unmotivated', 'procrastination', 'motivation'],
  },
  {
    id: 'money',
    label: 'Money Stress',
    matchTags: ['money', 'finance', 'debt', 'financial-stress', 'budget'],
    fallbackKeywords: ['money', 'finance', 'debt', 'financial'],
  },
  {
    id: 'divorce',
    label: 'Divorce & Family',
    matchTags: [
      'divorce',
      'marriage',
      'co-parenting',
      'second-chapter',
      'family',
      'parents',
      'progeny',
    ],
    fallbackKeywords: ['divorce', 'marriage', 'co-parenting', 'family', 'parents', 'progeny'],
  },
  {
    id: 'new_city',
    label: 'New City',
    matchTags: ['new-city', 'relocation', 'expat', 'lonely'],
    fallbackKeywords: ['new city', 'relocation', 'expat', 'moved'],
  },
];

export type CompanionDiscoveryFilterableCard = Partial<
  Pick<
    PublicCompanionCard,
    | 'name'
    | 'tagline'
    | 'short_bio'
    | 'primary_expertise'
    | 'secondary_expertise'
    | 'category_tag'
    | 'companion_group'
    | 'situation_tags'
    | 'skill_level'
    | 'cultural_fluency'
  >
>;

export function resolveCompanionGroup(card: CompanionDiscoveryFilterableCard): CompanionGroup {
  if (
    card.companion_group === 'spiritual' ||
    card.companion_group === 'everyday' ||
    card.companion_group === 'life'
  ) {
    return card.companion_group;
  }
  if (card.skill_level && card.skill_level !== 'none_emotional') {
    return 'spiritual';
  }
  if (
    card.category_tag === 'astrology' ||
    card.category_tag === 'tarot_numerology' ||
    card.category_tag === 'past_life'
  ) {
    return 'spiritual';
  }
  const combined = `${card.primary_expertise || ''} ${(card.situation_tags || []).join(' ')}`.toLowerCase();
  if (
    /(breakup|heartbreak|divorce|marriage|grief|loss|founder|business|money|finance|debt|career|workplace|stuck|unstuck|family|progeny|relocation|new city|transition)/.test(
      combined
    )
  ) {
    return 'life';
  }
  return 'everyday';
}

export function matchesCompanionSituationChip(
  card: CompanionDiscoveryFilterableCard,
  chipId: string | null
): boolean {
  if (!chipId) return true;
  const chip = COMPANION_SITUATION_CHIPS.find((c) => c.id === chipId);
  if (!chip) return true;

  const tags = (card.situation_tags || []).map((t) => t.trim().toLowerCase());
  if (tags.some((t) => chip.matchTags.includes(t))) {
    return true;
  }

  const haystack = [
    card.primary_expertise || '',
    ...(card.secondary_expertise || []),
    card.tagline || '',
    card.short_bio || '',
  ]
    .join(' ')
    .toLowerCase();

  if (chip.id === 'tarot' && card.skill_level === 'tarot') return true;
  if (
    chip.id === 'astrology' &&
    (card.skill_level === 'astrology_soft' || card.skill_level === 'vedic_soft')
  ) {
    return true;
  }

  return chip.fallbackKeywords.some((kw) => haystack.includes(kw));
}

export function matchesCompanionDiscoveryFilter(
  card: CompanionDiscoveryFilterableCard,
  options: {
    groupTab: CompanionDiscoveryTabId;
    situationChipId?: string | null;
    searchQuery?: string;
  }
): boolean {
  if (options.groupTab !== 'all' && resolveCompanionGroup(card) !== options.groupTab) {
    return false;
  }

  if (options.situationChipId && !matchesCompanionSituationChip(card, options.situationChipId)) {
    return false;
  }

  const q = (options.searchQuery || '').trim().toLowerCase();
  if (q) {
    const terms = q.split(/\s+/).filter(Boolean);
    const haystack = [
      card.name || '',
      card.primary_expertise || '',
      ...(card.secondary_expertise || []),
      ...(card.situation_tags || []),
      card.tagline || '',
      card.short_bio || '',
      card.cultural_fluency || '',
    ]
      .join(' ')
      .toLowerCase();
    if (!terms.every((term) => haystack.includes(term))) {
      return false;
    }
  }

  return true;
}

export type CompanionCategoryFilterId =
  | 'all'
  | 'astrology'
  | 'tarot'
  | 'numerology'
  | 'past_life'
  | 'support'
  | 'friends';

export const COMPANION_CATEGORY_FILTERS: Array<{
  id: CompanionCategoryFilterId;
  label: string;
}> = [
  { id: 'all', label: 'All' },
  { id: 'astrology', label: 'Astrology' },
  { id: 'tarot', label: 'Tarot' },
  { id: 'numerology', label: 'Numerology' },
  { id: 'past_life', label: 'Past Life' },
  { id: 'support', label: 'Support & Listening' },
  { id: 'friends', label: 'Friends' },
];

export function matchesCompanionCategoryFilter(
  card: Pick<
    PublicCompanionCard,
    'category_tag' | 'skill_level' | 'primary_expertise' | 'secondary_expertise'
  >,
  filterId: CompanionCategoryFilterId
): boolean {
  if (filterId === 'all') return true;
  if (filterId === 'astrology') return card.category_tag === 'astrology';
  if (filterId === 'tarot') {
    const primary = (card.primary_expertise || '').toLowerCase();
    const secondary = (card.secondary_expertise || []).map((s) => s.toLowerCase());
    return (
      card.skill_level === 'tarot' ||
      primary.includes('tarot') ||
      secondary.some((s) => s.includes('tarot'))
    );
  }
  if (filterId === 'numerology') {
    const primary = (card.primary_expertise || '').toLowerCase();
    const secondary = (card.secondary_expertise || []).map((s) => s.toLowerCase());
    return (
      card.skill_level === 'numerology' ||
      primary.includes('numerology') ||
      secondary.some((s) => s.includes('numerology'))
    );
  }
  if (filterId === 'past_life') {
    return card.category_tag === 'past_life' || card.skill_level === 'past_life';
  }
  if (filterId === 'support') return card.category_tag === 'support';
  if (filterId === 'friends') return card.category_tag === 'friends';
  return false;
}

export type CompanionSkillLevel =
  | 'none_emotional'
  | 'astrology_soft'
  | 'tarot'
  | 'numerology'
  | 'past_life'
  | 'vedic_soft';

export type CompanionAutonomyLevel = 'steady' | 'intuitive' | 'free';

export type CompanionChatCue = 'just_listen' | 'help_think';

export type MessageReaction = 'heart' | 'felt';

export interface MessageReferralPayload {
  slug: string;
  name?: string;
  reason?: string;
  handoff_note?: string;
}

export interface CompanionMonogramPalette {
  bg: string;
  ring: string;
  ink: string;
}

export interface CompanionTtsVoiceProfile {
  rate: number;
  pitch: number;
}

export interface PublicCompanionCard {
  id: string;
  slug: string;
  name: string;
  age: number;
  sex: 'M' | 'F';
  tagline: string;
  short_bio: string;
  full_bio: string;
  primary_expertise: string;
  secondary_expertise: string[];
  category_tag: CompanionCategoryTag;
  companion_group?: CompanionGroup;
  situation_tags?: string[];
  cultural_fluency: string;
  avatar_url: string | null;
  monogram_palette: CompanionMonogramPalette;
  skill_level: CompanionSkillLevel;
  chat_style: ChatStyle;
  tts_voice_profile: CompanionTtsVoiceProfile;
  supports_listening_cue: boolean;
  suggestions_enabled: boolean;
  sort_order: number;
  last_conversation_id?: string | null;
  last_interaction_at?: string | null;
  thread_count?: number;
}

export interface CompanionPersona {
  id: string;
  slug?: string;
  name: string;
  age: number;
  gender: 'M' | 'F';
  companion_type: CompanionArchetypeSlug;
  role_label: string;
  background: string;
  tagline: string;
  bio: string;
  conversation_style: string;
  opening_message: string;
  system_prompt: string;
  backstory?: string;
  soul_consciousness?: string;
  avatar_url?: string | null;
  monogram_palette?: CompanionMonogramPalette;
  chat_style?: ChatStyle;
  skill_level?: CompanionSkillLevel;
  tts_voice_profile?: CompanionTtsVoiceProfile;
  supports_listening_cue?: boolean;
  topic_context?: string;
  religion_profile?: {
    religiousness: number;
    primary_religion: string;
    secondary_religion?: string;
  };
}

export interface ActiveChatTab {
  tabId: string;
  pillar: ChatPillar;
  conversationId: string | null;
  label: string;
  customLabel?: boolean;
  subtitle?: string;
  expertSlug?: string;
  companionType?: CompanionArchetypeSlug | null;
  companionSlug?: string | null;
  companionPersona?: CompanionPersona | null;
  isCore?: boolean;
}

export interface ConversationRecord {
  id: string;
  user_id: string;
  profile_id: string | null;
  linked_report_id: string | null;
  title: string;
  mode_type: 'reading' | 'learn_astrology' | 'report_followup';
  pillar?: ChatPillar;
  is_active_tab?: boolean;
  active_tab_order?: number;
  companion_type?: CompanionArchetypeSlug | null;
  companion_slug?: string | null;
  companion_chat_mode?: CompanionChatCue | null;
  companion_persona_json?: CompanionPersona | null;
  is_bookmarked: boolean;
  total_word_count: number;
  use_full_profile_memory: boolean;
  ask_later_json?: AskLaterItem[];
  last_message_preview?: string | null;
  updated_at: string;
  created_at: string;
}

export interface ChatMessageRecord {
  id: string;
  conversation_id: string;
  parent_message_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  word_count: number;
  expert_used: string | null;
  mode_used: string | null;
  output_format_used: string | null;
  language_used: string | null;
  is_starred: boolean;
  excluded_from_context: boolean;
  followups_json: string[];
  suggestions_json?: MessageSuggestions | null;
  reaction?: MessageReaction | null;
  render_style?: ChatStyle | null;
  referral_json?: MessageReferralPayload | null;
  credits_charged?: number;
  created_at: string;
}

export interface CustomPromptRecord {
  id: string;
  user_id: string;
  title: string;
  prompt_text: string;
  created_at: string;
}

export interface FavoriteMessageRecord extends ChatMessageRecord {
  conversation_title: string;
  profile_id: string | null;
}

export type ChatToneMode = 'friendly' | 'technical';
export type ChatResponseLength = 'short' | 'detailed';

export interface ChatAttachmentInput {
  id: string;
  kind: 'image' | 'pdf';
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

export interface PlaceSuggestion {
  label: string;
  city: string;
  state: string | null;
  country: string;
  latitude: number;
  longitude: number;
  timezoneOffset: number;
}

export interface PendingBirthProfileDraft {
  name: string;
  birth_date: string; // YYYY-MM-DD
  birth_time: string; // HH:MM (24h)
  birth_time_display?: string;
  place_query: string;
  birth_city?: string;
  birth_state?: string | null;
  birth_country?: string;
  gender?: string | null;
  relationship?: string | null;
  original_question?: string | null;
}

export interface ChatbotFeaturesUiConfig {
  voice_input: boolean;
  listen_tts: boolean;
  whatsapp_share: boolean;
  attachments: boolean;
  quick_tools: boolean;
  followups: boolean;
  auto_intake: boolean;
  memory_summary: boolean;
}

export interface CompanionArchetypeConfigItem {
  slug: CompanionArchetypeSlug;
  label: string;
  shortDesc: string;
  questionOne: string;
  questionTwo: string;
  isSpiritual?: boolean;
}

export interface PublicGuideUiConfig {
  welcome_title: string;
  welcome_subtitle: string;
  general_ready_message: string;
  composer_placeholder: string;
  chat_style?: ChatStyle;
  features: ChatbotFeaturesUiConfig;
  suggestions_enabled: boolean;
  suggestions: PublicSuggestionsUiConfig & { enabled: boolean };
}

export type ChatNumericFont =
  | 'dm_sans'
  | 'inter'
  | 'plus_jakarta'
  | 'roboto'
  | 'cormorant'
  | 'jetbrains_mono';

export const CHAT_NUMERIC_FONT_CLASSES: Record<ChatNumericFont, string> = {
  dm_sans: "font-['DM_Sans',sans-serif] tabular-nums text-[1.04em]",
  inter: "font-['Inter',sans-serif] tabular-nums text-[1.02em]",
  plus_jakarta: "font-['Plus_Jakarta_Sans',sans-serif] tabular-nums",
  roboto: "font-['Roboto',sans-serif] tabular-nums text-[1.03em]",
  cormorant: "font-['Cormorant_Garamond',serif] tabular-nums text-[1.08em]",
  jetbrains_mono: "font-['JetBrains_Mono',monospace] tabular-nums text-[0.94em]",
};

export const CHAT_NUMERIC_FONT_OPTIONS: Array<{
  value: ChatNumericFont;
  label: string;
  description: string;
}> = [
  { value: 'dm_sans', label: 'DM Sans — Clean Tabular (Default)', description: 'Crisp geometric numerals' },
  { value: 'plus_jakarta', label: 'Plus Jakarta Sans — Match Body Font', description: 'Seamless match with chat text' },
  { value: 'inter', label: 'Inter — Crisp Modern Sans', description: 'Balanced modern UI digits' },
  { value: 'roboto', label: 'Roboto — Classic Geometric', description: 'Clean technical clarity' },
  { value: 'cormorant', label: 'Cormorant Garamond — Editorial Serif', description: 'Journal serif figures' },
  { value: 'jetbrains_mono', label: 'JetBrains Mono — Technical Monospace', description: 'Observatory telemetry mono' },
];

export interface PublicChatbotUiConfig {
  welcome_title: string;
  welcome_subtitle: string;
  general_ready_message: string;
  composer_placeholder: string;
  default_expert: string;
  default_mode: string;
  default_output: string;
  default_language: string;
  default_tone: ChatToneMode;
  default_response_length: ChatResponseLength;
  chat_numeric_font?: ChatNumericFont;
  features: ChatbotFeaturesUiConfig;
  guide_overrides?: Record<string, PublicGuideUiConfig>;
  companion_archetypes?: CompanionArchetypeConfigItem[];
}

export interface SharedReadingNoteRecord {
  id: string;
  profile_id: string | null;
  profile_label: string | null;
  expert_slug: string | null;
  expert_label: string;
  astrology_mode: 'vedic' | 'western' | null;
  conversation_id: string | null;
  message_id: string | null;
  title: string;
  summary: string;
  created_at: string;
  origin?: 'shared_handoff' | 'saved_note';
}

