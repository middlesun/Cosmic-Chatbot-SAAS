import crypto from 'crypto';
import {
  DEFAULT_COUNCIL_EXPERT_SLUG,
  normalizeCouncilSlug,
} from '../../lib/vedicTypes';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import {
  ALL_GUIDE_CATALOG_META,
  DEFAULT_CLARITY_HELPER_SYSTEM_PROMPT,
  DEFAULT_COMPANION_ARCHETYPES,
  DEFAULT_COMPANION_CONSTITUTION,
  DEFAULT_COMPANION_MATCHER_INSTRUCTIONS,
  DEFAULT_CORE_COUNCIL_CONSTITUTION,
  DEFAULT_DEEP_AUDIT_ADJUDICATOR_MANDATE,
  DEFAULT_DEEP_AUDIT_LENSES,
  DEFAULT_FLUENCY_INSTRUCTIONS,
  DEFAULT_FORMAT_CONTRACTS,
  DEFAULT_INTENT_OUTPUT_CONTRACTS,
  DEFAULT_STAGE1_ROUTER_PROMPT,
  DEFAULT_STAGE4_ALIGNED_SUGGESTIONS_PROMPT,
  DEFAULT_STAGE4_FAST_MORE_SUGGESTIONS_PROMPT,
  DEFAULT_VEDIC_ANTI_CLICHE_RULES,
  DEFAULT_VEDIC_TIER1_REASONING_LAWS,
  WESTERN_ANTI_CLICHE_RULES,
  WESTERN_CORE_COUNCIL_CONSTITUTION,
  WESTERN_DEEP_AUDIT_ADJUDICATOR_MANDATE,
  WESTERN_DEEP_AUDIT_LENSES,
  WESTERN_FLUENCY_INSTRUCTIONS,
  WESTERN_FORMAT_CONTRACTS,
  WESTERN_INTENT_OUTPUT_CONTRACTS,
  WESTERN_STAGE4_ALIGNED_SUGGESTIONS_PROMPT,
  WESTERN_STAGE4_FAST_MORE_SUGGESTIONS_PROMPT,
  WESTERN_TIER1_REASONING_LAWS,
  getGuideCatalogMeta,
  GUIDE_SLUGS,
  isValidGuideSlug,
  normalizeChatStyle,
  type ChatStyle,
  type DefaultCompanionArchetype,
  type GuideSlug,
} from './enginePromptDefaults';

export type { ChatStyle, DefaultCompanionArchetype, GuideSlug };
export { ALLOWED_CHAT_STYLES, ALL_GUIDE_CATALOG_META, GUIDE_SLUGS, getGuideCatalogMeta, isValidGuideSlug, normalizeChatStyle } from './enginePromptDefaults';

export type SupportedCurrency = 'INR' | 'USD' | 'AED' | 'EUR';

export interface CustomModelEntry {
  id: string;
  label: string;
  provider?: string;
  notes?: string;
}

export interface TokenLimitsConfig {
  chat_short: number;
  chat_detailed: number;
  report_pass: number;
  utility: number;
  max_history_turns: number;
}

export interface AiSettingsConfig {
  openrouter_api_key_encrypted?: string | null;
  openrouter_api_key_last4?: string | null;
  consultation_model: string;
  utility_model: string;
  jev_classifier_enabled: boolean;
  jev_model: string;
  chatbot_pipeline_logging_enabled: boolean;
  custom_models: CustomModelEntry[];
  token_limits: TokenLimitsConfig;
}

export interface ChatbotFeaturesConfig {
  voice_input: boolean;
  listen_tts: boolean;
  whatsapp_share: boolean;
  attachments: boolean;
  quick_tools: boolean;
  followups: boolean;
  auto_intake: boolean;
  memory_summary: boolean;
}

export type ChatNumericFont =
  | 'dm_sans'
  | 'inter'
  | 'plus_jakarta'
  | 'roboto'
  | 'cormorant'
  | 'jetbrains_mono';

export const ALLOWED_CHAT_NUMERIC_FONTS: readonly ChatNumericFont[] = [
  'dm_sans',
  'inter',
  'plus_jakarta',
  'roboto',
  'cormorant',
  'jetbrains_mono',
] as const;

export function normalizeChatNumericFont(raw: unknown): ChatNumericFont {
  if (typeof raw === 'string' && (ALLOWED_CHAT_NUMERIC_FONTS as readonly string[]).includes(raw)) {
    return raw as ChatNumericFont;
  }
  return 'dm_sans';
}

export interface ChatbotConfig {
  welcome_title: string;
  welcome_subtitle: string;
  general_ready_message: string;
  composer_placeholder: string;
  default_expert: string;
  default_mode: string;
  default_output: string;
  default_language: string;
  default_tone: 'friendly' | 'technical';
  default_response_length: 'short' | 'detailed';
  chat_numeric_font: ChatNumericFont;
  expert_order: string[];
  mode_order: string[];
  language_order: string[];
  features: ChatbotFeaturesConfig;
  conversational_rules: string;
}

export interface SuggestionsConfig {
  followups_enabled: boolean;
  deeper_analysis_enabled: boolean;
  default_expanded: boolean;
  max_followups: number;
  max_deeper_analysis: number;
  followups_rules: string;
  deeper_analysis_rules: string;
}

export interface ModularRuleBlock {
  id: string;
  title: string;
  body: string;
  enabled: boolean;
  source_slug?: string | null;
  updated_at?: string;
}

export interface GuideSuggestionsConfig extends SuggestionsConfig {
  enabled: boolean;
}

export interface GuideChatbotOverride {
  welcome_title?: string;
  welcome_subtitle?: string;
  general_ready_message?: string;
  composer_placeholder?: string;
  chat_style?: ChatStyle;
  features?: Partial<ChatbotFeaturesConfig>;
  modular_rules?: ModularRuleBlock[];
  suggestions?: Partial<GuideSuggestionsConfig>;
  model_id?: string | null;
}

export type PerGuideChatbotConfigMap = Partial<Record<GuideSlug, GuideChatbotOverride>>;

export interface EnginePromptOverrides {
  core_council_constitution?: string;
  companion_constitution?: string;
  companion_archetypes?: DefaultCompanionArchetype[];
  companion_matcher_instructions?: string;
  clarity_helper_system_prompt?: string;
  vedic_tier1_reasoning_laws?: string;
  vedic_anti_cliche_rules?: string;
  intent_output_contracts?: Partial<Record<keyof typeof DEFAULT_INTENT_OUTPUT_CONTRACTS, string>>;
  fluency_instructions?: Partial<Record<keyof typeof DEFAULT_FLUENCY_INSTRUCTIONS, string>>;
  format_contracts?: Partial<Record<keyof typeof DEFAULT_FORMAT_CONTRACTS, string>>;
  stage1_router_prompt?: string;
  deep_audit_lenses?: Partial<Record<keyof typeof DEFAULT_DEEP_AUDIT_LENSES, string>>;
  deep_audit_adjudicator_mandate?: string;
  stage4_aligned_suggestions_prompt?: string;
  stage4_fast_more_suggestions_prompt?: string;
  western_core_council_constitution?: string;
  western_tier1_reasoning_laws?: string;
  western_anti_cliche_rules?: string;
  western_intent_output_contracts?: Partial<Record<keyof typeof WESTERN_INTENT_OUTPUT_CONTRACTS, string>>;
  western_fluency_instructions?: Partial<Record<keyof typeof WESTERN_FLUENCY_INSTRUCTIONS, string>>;
  western_format_contracts?: Partial<Record<keyof typeof WESTERN_FORMAT_CONTRACTS, string>>;
  western_deep_audit_lenses?: Partial<Record<keyof typeof WESTERN_DEEP_AUDIT_LENSES, string>>;
  western_deep_audit_adjudicator_mandate?: string;
  western_stage4_aligned_suggestions_prompt?: string;
  western_stage4_fast_more_suggestions_prompt?: string;
}

export interface PlaybookOverrideEntry {
  requiresTimingStack?: boolean;
  formulaSlugs?: string[];
  customInstructions?: string;
  updated_at?: string;
}

export type PlaybookOverridesMap = Record<string, PlaybookOverrideEntry>;

export interface ResolvedGuideConfig {
  slug: GuideSlug;
  meta: ReturnType<typeof getGuideCatalogMeta>;
  isCustomized: boolean;
  welcome_title: string;
  welcome_subtitle: string;
  general_ready_message: string;
  composer_placeholder: string;
  chat_style: ChatStyle;
  features: ChatbotFeaturesConfig;
  modular_rules: ModularRuleBlock[];
  has_custom_modular_rules: boolean;
  combined_rules_text: string;
  suggestions: GuideSuggestionsConfig;
  model_id: string | null;
}

export interface MiniAppOverrideConfig {
  enabled?: boolean;
  featured_on_home?: boolean;
  model_id?: string | null;
}

export interface MiniAppsGovernanceConfig {
  default_model_id: string | null;
  daily_live_runs_soft_cap: number;
  estimated_input_cost_per_million_usd: number;
  estimated_output_cost_per_million_usd: number;
  overrides: Record<string, MiniAppOverrideConfig>;
}

export interface CreditPackConfig {
  slug: string;
  name: string;
  subtitle: string;
  credits: number;
  highlight?: string;
  prices: Record<SupportedCurrency, number>;
  dodo_product_id?: string;
  is_active: boolean;
}

export interface MembershipTierConfig {
  slug: 'personal' | 'pro' | 'guru';
  name: string;
  profileLimit: number;
  activationCostCredits: number;
  includedMonthlyCredits: number;
  prices: Record<SupportedCurrency, number>;
  features: string[];
  dodo_product_id?: string;
}

export interface ChatBillingWeights {
  output_token_weight: number;
  input_token_weight: number;
  min_credits_per_reply: number;
  max_credits_per_reply: number;
}

export interface PricingConfig {
  signup_welcome_credits: number;
  referral_reward_credits: number;
  min_credits_to_chat: number;
  chat_billing: ChatBillingWeights;
  credit_packs: CreditPackConfig[];
  membership_tiers: MembershipTierConfig[];
}

export interface PromptRecipeStep {
  prompt_slug: string;
  label?: string;
  inline_override?: string;
  enabled: boolean;
}

export interface PromptRecipeRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  target_type: 'mode' | 'report_pass' | 'custom';
  target_slug: string | null;
  steps_json: PromptRecipeStep[];
  model_id: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const BUILTIN_MODEL_SUGGESTIONS: CustomModelEntry[] = [
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'Google', notes: 'Fast, accurate default' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'Google', notes: 'Deep analytical synthesis' },
  { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', provider: 'Anthropic', notes: 'Refined editorial prose' },
  { id: 'anthropic/claude-3.7-sonnet', label: 'Claude 3.7 Sonnet', provider: 'Anthropic', notes: 'Nuanced reasoning' },
  { id: 'openai/gpt-4.1', label: 'GPT-4.1', provider: 'OpenAI', notes: 'Structured precision' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI', notes: 'Lightweight utility tasks' },
  { id: 'deepseek/deepseek-chat-v3-0324', label: 'DeepSeek V3', provider: 'DeepSeek', notes: 'Cost-efficient reasoning' },
];

export const DEFAULT_CONVERSATIONAL_RULES = `CONVERSATIONAL NATURALNESS & CONTINUITY:
- Respond like an attentive, warm Vedic astrologer in a live 1-on-1 conversation — NEVER like a formal email or templated letter.
- NEVER begin messages with "Prediction", "Prediction:", ":::prediction", ":::analysis", or letter salutations such as "Yes, [Name],", "Hello [Name],", "Hi [Name],", "Dear [Name],", or "Namaste [Name]," at the top of your reply.
- NEVER address or repeat the user's name, email ID, or company/account name across turns — speak naturally directly with "you" and "your".
- Jump directly into answering the user's question with calm clarity. On follow-up turns, pick up the thread seamlessly without re-introducing yourself or repeating prior framing.
- Avoid rigid corporate phrasing ("Executive Synthesis", "In conclusion", "As an AI"). Keep headings clean and natural when structured sections genuinely help readability.`;

export const DEFAULT_AI_SETTINGS: AiSettingsConfig = {
  openrouter_api_key_encrypted: null,
  openrouter_api_key_last4: null,
  consultation_model: process.env.OPENROUTER_CONSULTATION_MODEL || 'google/gemini-2.5-flash',
  utility_model: process.env.OPENROUTER_UTILITY_MODEL || 'google/gemini-2.5-flash',
  jev_classifier_enabled: true,
  jev_model: process.env.OPENROUTER_JEV_MODEL || 'typesafe/jev-1.14',
  chatbot_pipeline_logging_enabled: false,
  custom_models: [],
  token_limits: {
    chat_short: 800,
    chat_detailed: 4800,
    report_pass: 4800,
    utility: 800,
    max_history_turns: 24,
  },
};

export const DEFAULT_TIMING_BRACKET_DATES_RULE = `TIMING DATE RANGE RULE (STRICT — BIDIRECTIONAL & SAME FORMAT):
- Whenever you mention the END date of ANY Dasha (Mahadasha, Chara Dasha), Antardasha, Pratyantardasha, or Transit (Gochar / Profection / Progression) — in prose, bullets, or tables — ALWAYS mention its starting date in brackets immediately beside the end date (e.g., "until December 2028 (started February 2026)", "until Dec 2028 (started Feb 2026)", or "ends 30th March 2027 (started 28th Jan 2026)").
- Whenever you mention the START date of ANY Dasha, Antardasha, Pratyantardasha, or Transit — ALWAYS mention its ending date in brackets immediately beside the start date (e.g., "started 28th Jan 2026 (ends 30th March 2027)", "started Feb 2026 (ends Dec 2028)", or "started November 2025 (ends December 2028)").
- ALWAYS format the date inside the brackets in the EXACT SAME date format as the date you wrote in that sentence or table (Month YYYY <-> Month YYYY, Mon YYYY <-> Mon YYYY, DDth Mon YYYY <-> DDth Mon YYYY, DD Mon YYYY <-> DD Mon YYYY, YYYY-MM-DD <-> YYYY-MM-DD). Never mix formats or cite an unbracketed start/end date alone.`;

export const DEFAULT_CHATBOT_CONFIG: ChatbotConfig = {
  welcome_title: "I'm ready",
  welcome_subtitle: '',
  general_ready_message:
    "Great, I'm ready to answer any question you may have regarding Vedic Astrology.",
  composer_placeholder: 'Ask anything about your chart, timing, or Vedic astrology...',
  default_expert: DEFAULT_COUNCIL_EXPERT_SLUG,
  default_mode: 'general',
  default_output: 'detailed',
  default_language: 'English',
  default_tone: 'technical',
  default_response_length: 'detailed',
  chat_numeric_font: 'dm_sans',
  expert_order: [
    DEFAULT_COUNCIL_EXPERT_SLUG,
    'western_astrologer',
    'modern_astrologer',
    'tarot_reader',
    'numerologist',
    'hellenistic_astrologer',
    'learn_astrology',
  ],
  mode_order: ['general', 'life', 'career', 'love', 'marriage', 'health', 'wealth'],
  language_order: ['English', 'Hindi', 'Hinglish'],
  features: {
    voice_input: true,
    listen_tts: true,
    whatsapp_share: true,
    attachments: true,
    quick_tools: true,
    followups: true,
    auto_intake: true,
    memory_summary: true,
  },
  conversational_rules: DEFAULT_CONVERSATIONAL_RULES,
};

export const DEFAULT_FOLLOWUPS_RULES = `FOLLOW-UP SUGGESTIONS ("followups"):
- Generate natural, plain-English next questions that stay TIGHTLY anchored to the user's LAST question and your just-delivered answer.
- NEVER jump to unrelated life areas (e.g., marriage, job promotion, contracts) unless the user asked about them in this exact exchange.
- Keep each question crisp (8–16 words), conversational, and genuinely helpful to an everyday non-technical user.
- Match the active conversation language strictly (English, Hindi, or Hinglish).
- Never number them, never repeat what was already answered, and avoid fear-based phrasing.`;

export const DEFAULT_DEEPER_ANALYSIS_RULES = `DEEPER ANALYSIS SUGGESTIONS ("deeper_analysis"):
- Act as an autonomous Grandmaster specialist in the active Council discipline (Vedic Jyotish, Tropical Western, Modern Psychological Astrology, Tarot, or Numerology).
- Stay STRICTLY focused on the exact planet, Dasha/transit window, house promise, or life question from this turn — go one analytical layer deeper into THIS topic rather than pivoting to unrelated chart features.
- Draw 3–4 high-value verification probes that stress-test THIS exact conclusion:
  • For Vedic Astrologer: check the relevant house's KP Cuspal Sub-Lord, Divisional confirmation (D9/D10/etc.), dispositor / Neecha Bhanga / cancellation strength, Ashtakavarga SAV/BAV bindus for that house, or upcoming Antardasha / Gochar triggers on that specific theme.
  • For Western / Modern Astrologer: check tight aspect geometry, Placidus ruler & Sect role, Mutual Reception, or upcoming Profection / Progression / Transit timing for that exact theme.
  • For Tarot: clarifying card pull on a specific card or tension, shadow/subconscious dynamics, or practical action check on the same question.
  • For Numerology: Karmic Debt / Master Number dynamics, Personal Year/Month timing, or Name Expression interaction on the same question.
- For EACH deeper_analysis item, provide:
  1. "text": a clear, intriguing user-facing question (10–18 words) in the active language directly tied to this question's topic.
  2. "technical_directive": a concise internal analytical directive (1–2 sentences in English) specifying the exact charts, rules, cancellations, or timing checks to perform for THIS question.`;

export const DEFAULT_SUGGESTIONS_CONFIG: SuggestionsConfig = {
  followups_enabled: true,
  deeper_analysis_enabled: true,
  default_expanded: true,
  max_followups: 4,
  max_deeper_analysis: 4,
  followups_rules: DEFAULT_FOLLOWUPS_RULES,
  deeper_analysis_rules: DEFAULT_DEEPER_ANALYSIS_RULES,
};

export const DEFAULT_MINI_APPS_CONFIG: MiniAppsGovernanceConfig = {
  default_model_id: null,
  daily_live_runs_soft_cap: 40,
  estimated_input_cost_per_million_usd: 0.15,
  estimated_output_cost_per_million_usd: 0.6,
  overrides: {},
};

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  signup_welcome_credits: 5000,
  referral_reward_credits: 5000,
  min_credits_to_chat: 25,
  chat_billing: {
    output_token_weight: 0.25,
    input_token_weight: 0.015,
    min_credits_per_reply: 25,
    max_credits_per_reply: 1500,
  },
  credit_packs: [
    {
      slug: 'pack_10k',
      name: 'Observatory Essential',
      subtitle: 'Minimum standard top-up for focused Vedic consultations and deep research reports.',
      credits: 10000,
      prices: { INR: 1000, USD: 12, AED: 45, EUR: 11 },
      is_active: true,
    },
    {
      slug: 'pack_30k',
      name: 'Council Deep Practice',
      subtitle: 'Ideal for active multi-profile explorations and Deep Research PDF reports.',
      credits: 30000,
      highlight: 'Most Popular',
      prices: { INR: 2700, USD: 32, AED: 118, EUR: 30 },
      is_active: true,
    },
    {
      slug: 'pack_75k',
      name: 'Jyotish Studio Reserve',
      subtitle: 'High-capacity reserve for client practices and longitudinal chart consultations.',
      credits: 75000,
      highlight: 'Best Value',
      prices: { INR: 6000, USD: 72, AED: 265, EUR: 66 },
      is_active: true,
    },
  ],
  membership_tiers: [
    {
      slug: 'personal',
      name: 'Personal Plan',
      profileLimit: 10,
      activationCostCredits: 0,
      includedMonthlyCredits: 0,
      prices: { INR: 0, USD: 0, AED: 0, EUR: 0 },
      features: [
        'Up to 10 saved birth profiles',
        '5,000 free credits on signup',
        'Unlimited free birth chart activations',
        'Full access to all platform features',
      ],
    },
    {
      slug: 'pro',
      name: 'Professional Plan',
      profileLimit: 100,
      activationCostCredits: 0,
      includedMonthlyCredits: 25000,
      prices: { INR: 1599, USD: 19, AED: 70, EUR: 18 },
      features: [
        'Up to 100 saved birth profiles',
        '25,000 credits included upon upgrade / renewal',
        'Unlimited free birth chart activations',
        'Full access to all platform features',
      ],
    },
    {
      slug: 'guru',
      name: 'Guru Plan',
      profileLimit: 200,
      activationCostCredits: 0,
      includedMonthlyCredits: 80000,
      prices: { INR: 6999, USD: 79, AED: 290, EUR: 74 },
      features: [
        'Up to 200 saved client birth profiles',
        '80,000 credits included upon upgrade / renewal',
        'Unlimited free birth chart activations',
        'Built for practicing astrologers & family archives',
      ],
    },
  ],
};

// ---------------- AES-256-GCM Secret Encryption ----------------

function getEncryptionKey(): Buffer {
  const seed =
    process.env.ADMIN_ENCRYPTION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'cosmic-council-local-dev-encryption-seed-v1';
  return crypto.createHash('sha256').update(seed).digest();
}

export function encryptSecret(plainText: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(payload: string): string | null {
  if (!payload || typeof payload !== 'string') return null;
  try {
    const parts = payload.split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') return null;
    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const encrypted = Buffer.from(parts[3], 'hex');
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

export function maskSecretKey(rawKey?: string | null, last4Override?: string | null): string | null {
  if (rawKey && rawKey.trim().length >= 8) {
    const k = rawKey.trim();
    return `${k.slice(0, 6)}••••••${k.slice(-4)}`;
  }
  if (last4Override) {
    return `sk-or-••••••${last4Override}`;
  }
  return null;
}

// ---------------- In-Memory Caching Layer ----------------

const CACHE_TTL_MS = 5 * 60 * 1000;
const PIPELINE_FLAG_TTL_MS = 5 * 1000;

let aiSettingsCache: { value: AiSettingsConfig; expiresAt: number } | null = null;
let pipelineFlagCache: { value: boolean; expiresAt: number } | null = null;
let chatbotConfigCache: { value: ChatbotConfig; expiresAt: number } | null = null;
let suggestionsConfigCache: { value: SuggestionsConfig; expiresAt: number } | null = null;
let miniAppsConfigCache: { value: MiniAppsGovernanceConfig; expiresAt: number } | null = null;
let pricingConfigCache: { value: PricingConfig; expiresAt: number } | null = null;
let promptRecipesCache: { value: PromptRecipeRecord[]; expiresAt: number } | null = null;
let perGuideConfigCache: { value: PerGuideChatbotConfigMap; expiresAt: number } | null = null;
let enginePromptsCache: { value: EnginePromptOverrides; expiresAt: number } | null = null;
let playbookOverridesCache: { value: PlaybookOverridesMap; expiresAt: number } | null = null;

export function invalidateAllPlatformCaches(): void {
  aiSettingsCache = null;
  pipelineFlagCache = null;
  chatbotConfigCache = null;
  suggestionsConfigCache = null;
  miniAppsConfigCache = null;
  pricingConfigCache = null;
  promptRecipesCache = null;
  perGuideConfigCache = null;
  enginePromptsCache = null;
  playbookOverridesCache = null;
}

export function invalidateRecipesCache(): void {
  promptRecipesCache = null;
}

async function readSettingRow<T>(key: string): Promise<Partial<T> | null> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('value_json')
      .eq('key', key)
      .maybeSingle();

    if (error || !data || typeof data.value_json !== 'object' || data.value_json === null) {
      return null;
    }
    return data.value_json as Partial<T>;
  } catch {
    return null;
  }
}

export type PlatformSettingKey =
  | 'ai_config'
  | 'chatbot_config'
  | 'pricing_config'
  | 'suggestions_config'
  | 'mini_apps_config'
  | 'mini_apps_registry'
  | 'per_guide_chatbot_config'
  | 'engine_prompt_overrides'
  | 'playbook_overrides';

export async function savePlatformSetting(
  key: PlatformSettingKey,
  value: unknown,
  adminUserId?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { ok: false, error: 'Supabase admin client is unavailable.' };
  }

  const { error } = await supabaseAdmin
    .from('platform_settings')
    .upsert(
      {
        key,
        value_json: value,
        updated_by: adminUserId || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

  if (error) {
    const msg = error.message || 'Failed to save platform setting.';
    if (error.code === '42P01' || msg.toLowerCase().includes('platform_settings')) {
      return {
        ok: false,
        error:
          'Table public.platform_settings does not exist yet. Run supabase/migrations/004_admin_console_and_recipes.sql in Supabase SQL Editor first.',
      };
    }
    return { ok: false, error: msg };
  }

  if (key === 'ai_config') {
    aiSettingsCache = null;
    pipelineFlagCache = null;
  }
  if (key === 'chatbot_config') chatbotConfigCache = null;
  if (key === 'suggestions_config') suggestionsConfigCache = null;
  if (key === 'mini_apps_config') miniAppsConfigCache = null;
  if (key === 'pricing_config') pricingConfigCache = null;
  if (key === 'per_guide_chatbot_config') perGuideConfigCache = null;
  if (key === 'engine_prompt_overrides') enginePromptsCache = null;
  if (key === 'playbook_overrides') playbookOverridesCache = null;
  return { ok: true };
}

export async function getPipelineLoggingEnabledFast(): Promise<boolean> {
  const now = Date.now();
  if (pipelineFlagCache && pipelineFlagCache.expiresAt > now) {
    return pipelineFlagCache.value;
  }
  const stored = await readSettingRow<AiSettingsConfig>('ai_config');
  const enabled =
    typeof stored?.chatbot_pipeline_logging_enabled === 'boolean'
      ? stored.chatbot_pipeline_logging_enabled
      : DEFAULT_AI_SETTINGS.chatbot_pipeline_logging_enabled;
  pipelineFlagCache = { value: enabled, expiresAt: now + PIPELINE_FLAG_TTL_MS };
  return enabled;
}

// ---------------- Typed Loaders ----------------

export async function getAiSettings(): Promise<AiSettingsConfig> {
  const now = Date.now();
  if (aiSettingsCache && aiSettingsCache.expiresAt > now) {
    return aiSettingsCache.value;
  }

  const stored = await readSettingRow<AiSettingsConfig>('ai_config');
  const defaultConsult = process.env.OPENROUTER_CONSULTATION_MODEL || 'google/gemini-2.5-flash';
  const defaultUtil = process.env.OPENROUTER_UTILITY_MODEL || 'google/gemini-2.5-flash';

  const merged: AiSettingsConfig = {
    openrouter_api_key_encrypted:
      typeof stored?.openrouter_api_key_encrypted === 'string' && stored.openrouter_api_key_encrypted.trim()
        ? stored.openrouter_api_key_encrypted.trim()
        : null,
    openrouter_api_key_last4:
      typeof stored?.openrouter_api_key_last4 === 'string' && stored.openrouter_api_key_last4.trim()
        ? stored.openrouter_api_key_last4.trim()
        : null,
    consultation_model:
      typeof stored?.consultation_model === 'string' && stored.consultation_model.trim()
        ? stored.consultation_model.trim()
        : defaultConsult,
    utility_model:
      typeof stored?.utility_model === 'string' && stored.utility_model.trim()
        ? stored.utility_model.trim()
        : defaultUtil,
    jev_classifier_enabled:
      typeof stored?.jev_classifier_enabled === 'boolean'
        ? stored.jev_classifier_enabled
        : DEFAULT_AI_SETTINGS.jev_classifier_enabled,
    jev_model:
      typeof stored?.jev_model === 'string' && stored.jev_model.trim()
        ? stored.jev_model.trim()
        : DEFAULT_AI_SETTINGS.jev_model,
    chatbot_pipeline_logging_enabled:
      typeof stored?.chatbot_pipeline_logging_enabled === 'boolean'
        ? stored.chatbot_pipeline_logging_enabled
        : DEFAULT_AI_SETTINGS.chatbot_pipeline_logging_enabled,
    custom_models: Array.isArray(stored?.custom_models)
      ? stored.custom_models.filter((m) => m && typeof m.id === 'string' && m.id.trim())
      : [],
    token_limits: {
      chat_short:
        typeof stored?.token_limits?.chat_short === 'number' && stored.token_limits.chat_short >= 100
          ? Math.round(stored.token_limits.chat_short)
          : DEFAULT_AI_SETTINGS.token_limits.chat_short,
      chat_detailed:
        typeof stored?.token_limits?.chat_detailed === 'number' && stored.token_limits.chat_detailed >= 200
          ? Math.round(stored.token_limits.chat_detailed)
          : DEFAULT_AI_SETTINGS.token_limits.chat_detailed,
      report_pass:
        typeof stored?.token_limits?.report_pass === 'number' && stored.token_limits.report_pass >= 400
          ? Math.round(stored.token_limits.report_pass)
          : DEFAULT_AI_SETTINGS.token_limits.report_pass,
      utility:
        typeof stored?.token_limits?.utility === 'number' && stored.token_limits.utility >= 100
          ? Math.round(stored.token_limits.utility)
          : DEFAULT_AI_SETTINGS.token_limits.utility,
      max_history_turns:
        typeof stored?.token_limits?.max_history_turns === 'number' && stored.token_limits.max_history_turns >= 2
          ? Math.min(60, Math.round(stored.token_limits.max_history_turns))
          : DEFAULT_AI_SETTINGS.token_limits.max_history_turns,
    },
  };

  aiSettingsCache = { value: merged, expiresAt: now + CACHE_TTL_MS };
  return merged;
}

export interface ResolvedOpenRouterRuntime {
  apiKey: string | null;
  keySource: 'database' | 'env' | 'none';
  maskedKey: string | null;
  hasDatabaseOverride: boolean;
  hasEnvKey: boolean;
  consultationModel: string;
  utilityModel: string;
  jevClassifierEnabled: boolean;
  jevModel: string;
  pipelineLoggingEnabled: boolean;
  customModels: CustomModelEntry[];
  tokenLimits: TokenLimitsConfig;
}

export async function getResolvedOpenRouterRuntime(): Promise<ResolvedOpenRouterRuntime> {
  const settings = await getAiSettings();
  const envKey = (process.env.OPENROUTER_API_KEY || '').trim() || null;

  let dbKey: string | null = null;
  if (settings.openrouter_api_key_encrypted) {
    dbKey = decryptSecret(settings.openrouter_api_key_encrypted);
  }

  const activeKey = dbKey || envKey;
  const keySource: 'database' | 'env' | 'none' = dbKey ? 'database' : envKey ? 'env' : 'none';

  return {
    apiKey: activeKey,
    keySource,
    maskedKey: maskSecretKey(activeKey, settings.openrouter_api_key_last4),
    hasDatabaseOverride: Boolean(dbKey),
    hasEnvKey: Boolean(envKey),
    consultationModel: settings.consultation_model,
    utilityModel: settings.utility_model,
    jevClassifierEnabled: settings.jev_classifier_enabled,
    jevModel: settings.jev_model,
    pipelineLoggingEnabled: settings.chatbot_pipeline_logging_enabled,
    customModels: settings.custom_models,
    tokenLimits: settings.token_limits,
  };
}

export async function getChatbotConfig(): Promise<ChatbotConfig> {
  const now = Date.now();
  if (chatbotConfigCache && chatbotConfigCache.expiresAt > now) {
    return chatbotConfigCache.value;
  }

  const stored = await readSettingRow<ChatbotConfig>('chatbot_config');
  const merged: ChatbotConfig = {
    welcome_title:
      typeof stored?.welcome_title === 'string' && stored.welcome_title.trim()
        ? stored.welcome_title.trim()
        : DEFAULT_CHATBOT_CONFIG.welcome_title,
    welcome_subtitle:
      typeof stored?.welcome_subtitle === 'string'
        ? stored.welcome_subtitle.trim()
        : DEFAULT_CHATBOT_CONFIG.welcome_subtitle,
    general_ready_message:
      typeof stored?.general_ready_message === 'string' && stored.general_ready_message.trim()
        ? stored.general_ready_message.trim()
        : DEFAULT_CHATBOT_CONFIG.general_ready_message,
    composer_placeholder:
      typeof stored?.composer_placeholder === 'string' && stored.composer_placeholder.trim()
        ? stored.composer_placeholder.trim()
        : DEFAULT_CHATBOT_CONFIG.composer_placeholder,
    default_expert:
      typeof stored?.default_expert === 'string' && stored.default_expert.trim()
        ? normalizeCouncilSlug(stored.default_expert)
        : DEFAULT_CHATBOT_CONFIG.default_expert,
    default_mode:
      typeof stored?.default_mode === 'string' && stored.default_mode.trim()
        ? stored.default_mode.trim()
        : DEFAULT_CHATBOT_CONFIG.default_mode,
    default_output:
      typeof stored?.default_output === 'string' && stored.default_output.trim()
        ? stored.default_output.trim()
        : DEFAULT_CHATBOT_CONFIG.default_output,
    default_language:
      typeof stored?.default_language === 'string' && stored.default_language.trim()
        ? stored.default_language.trim()
        : DEFAULT_CHATBOT_CONFIG.default_language,
    default_tone:
      stored?.default_tone === 'friendly' || stored?.default_tone === 'technical'
        ? stored.default_tone
        : DEFAULT_CHATBOT_CONFIG.default_tone,
    default_response_length:
      stored?.default_response_length === 'short' || stored?.default_response_length === 'detailed'
        ? stored.default_response_length
        : DEFAULT_CHATBOT_CONFIG.default_response_length,
    chat_numeric_font: normalizeChatNumericFont(stored?.chat_numeric_font),
    expert_order:
      Array.isArray(stored?.expert_order) && stored.expert_order.length > 0
        ? Array.from(new Set(stored.expert_order.map((s) => normalizeCouncilSlug(String(s)))))
        : DEFAULT_CHATBOT_CONFIG.expert_order,
    mode_order:
      Array.isArray(stored?.mode_order) && stored.mode_order.length > 0
        ? stored.mode_order.map(String)
        : DEFAULT_CHATBOT_CONFIG.mode_order,
    language_order:
      Array.isArray(stored?.language_order) && stored.language_order.length > 0
        ? stored.language_order.map(String)
        : DEFAULT_CHATBOT_CONFIG.language_order,
    features: {
      ...DEFAULT_CHATBOT_CONFIG.features,
      ...(stored?.features && typeof stored.features === 'object' ? stored.features : {}),
    },
    conversational_rules:
      typeof stored?.conversational_rules === 'string' && stored.conversational_rules.trim()
        ? stored.conversational_rules.trim()
        : DEFAULT_CHATBOT_CONFIG.conversational_rules,
  };

  chatbotConfigCache = { value: merged, expiresAt: now + CACHE_TTL_MS };
  return merged;
}

function sanitizeModularRuleBlock(raw: unknown, idx: number): ModularRuleBlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const body = typeof r.body === 'string' ? r.body.trim().slice(0, 8000) : '';
  const title =
    typeof r.title === 'string' && r.title.trim()
      ? r.title.trim().slice(0, 140)
      : `Rule ${idx + 1}`;
  if (!body && !title) return null;
  const id =
    typeof r.id === 'string' && r.id.trim()
      ? r.id.trim().slice(0, 80)
      : `rule_${idx + 1}_${crypto.randomBytes(3).toString('hex')}`;
  return {
    id,
    title,
    body,
    enabled: r.enabled !== false,
    source_slug:
      typeof r.source_slug === 'string' && r.source_slug.trim() ? r.source_slug.trim() : null,
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : undefined,
  };
}

export async function getPerGuideChatbotConfig(): Promise<PerGuideChatbotConfigMap> {
  const now = Date.now();
  if (perGuideConfigCache && perGuideConfigCache.expiresAt > now) {
    return perGuideConfigCache.value;
  }

  const stored = await readSettingRow<Record<string, GuideChatbotOverride>>('per_guide_chatbot_config');
  const cleaned: PerGuideChatbotConfigMap = {};

  if (stored && typeof stored === 'object') {
    for (const [rawKey, entry] of Object.entries(stored)) {
      const normalized = normalizeCouncilSlug(rawKey);
      if (!isValidGuideSlug(normalized)) continue;
      // Preserve explicit canonical entry over legacy alias if both exist
      if (cleaned[normalized] && rawKey !== normalized) continue;
      if (!entry || typeof entry !== 'object') continue;
      const sanitizedRules = Array.isArray(entry.modular_rules)
        ? entry.modular_rules
            .map((r, i) => sanitizeModularRuleBlock(r, i))
            .filter((r): r is ModularRuleBlock => Boolean(r))
            .slice(0, 30)
        : undefined;

      cleaned[normalized] = {
        ...(typeof entry.welcome_title === 'string' ? { welcome_title: entry.welcome_title.trim().slice(0, 120) } : {}),
        ...(typeof entry.welcome_subtitle === 'string' ? { welcome_subtitle: entry.welcome_subtitle.trim().slice(0, 400) } : {}),
        ...(typeof entry.general_ready_message === 'string' ? { general_ready_message: entry.general_ready_message.trim().slice(0, 400) } : {}),
        ...(typeof entry.composer_placeholder === 'string' ? { composer_placeholder: entry.composer_placeholder.trim().slice(0, 200) } : {}),
        ...(typeof entry.chat_style === 'string'
          ? { chat_style: normalizeChatStyle(entry.chat_style, getGuideCatalogMeta(normalized).defaultChatStyle) }
          : {}),
        ...(entry.features && typeof entry.features === 'object' ? { features: entry.features } : {}),
        ...(sanitizedRules ? { modular_rules: sanitizedRules } : {}),
        ...(entry.suggestions && typeof entry.suggestions === 'object' ? { suggestions: entry.suggestions } : {}),
        ...(entry.model_id !== undefined
          ? {
              model_id:
                typeof entry.model_id === 'string' && entry.model_id.trim()
                  ? entry.model_id.trim()
                  : null,
            }
          : {}),
      };
    }
  }

  perGuideConfigCache = { value: cleaned, expiresAt: now + CACHE_TTL_MS };
  return cleaned;
}

export function buildDefaultModularRulesForGuide(
  slug: GuideSlug,
  globalRulesText: string
): ModularRuleBlock[] {
  const meta = getGuideCatalogMeta(slug);
  if (meta.pillar === 'companion') {
    return [
      {
        id: 'default_companion_tone',
        title: 'Human Texting Rhythm & Boundaries',
        body: 'Keep replies emotionally attuned, natural in length, candid when helpful, and strictly platonic.',
        enabled: true,
        source_slug: null,
      },
    ];
  }
  if (meta.pillar === 'clarity') {
    return [
      {
        id: 'default_clarity_focus',
        title: 'Concise Off-Record Guidance',
        body: 'Answer directly without demanding birth chart intake; provide 2–3 ready-to-copy sharp questions when helping craft Council prompts.',
        enabled: true,
        source_slug: null,
      },
    ];
  }
  const baseRules: ModularRuleBlock[] = [
    {
      id: 'default_conversational_naturalness',
      title: 'Conversational Naturalness & Continuity',
      body: globalRulesText.trim() || DEFAULT_CONVERSATIONAL_RULES,
      enabled: true,
      source_slug: null,
    },
  ];
  if (
    slug === DEFAULT_COUNCIL_EXPERT_SLUG ||
    slug === 'western_astrologer' ||
    slug === 'modern_astrologer' ||
    slug === 'hellenistic_astrologer' ||
    slug === 'learn_astrology'
  ) {
    baseRules.push({
      id: 'default_timing_bracket_dates',
      title: 'Dasha, Antardasha & Transit Paired Bracket Dates',
      body: DEFAULT_TIMING_BRACKET_DATES_RULE,
      enabled: true,
      source_slug: null,
    });
  }
  return baseRules;
}

export async function getResolvedGuideConfig(rawSlug: string): Promise<ResolvedGuideConfig> {
  const normalizedSlug = normalizeCouncilSlug(rawSlug);
  const slug: GuideSlug = isValidGuideSlug(normalizedSlug)
    ? normalizedSlug
    : DEFAULT_COUNCIL_EXPERT_SLUG;
  const meta = getGuideCatalogMeta(slug);
  const [chatbotCfg, globalSug, perGuideMap] = await Promise.all([
    getChatbotConfig(),
    getSuggestionsConfig(),
    getPerGuideChatbotConfig(),
  ]);
  const override = perGuideMap[slug];

  const welcomeTitle =
    override?.welcome_title !== undefined && override.welcome_title !== ''
      ? override.welcome_title
      : meta.pillar === 'council'
      ? chatbotCfg.welcome_title
      : meta.defaultWelcomeTitle;

  const welcomeSubtitle =
    override?.welcome_subtitle !== undefined
      ? override.welcome_subtitle
      : meta.pillar === 'council'
      ? chatbotCfg.welcome_subtitle
      : meta.defaultWelcomeSubtitle;

  const generalReadyMessage =
    override?.general_ready_message !== undefined && override.general_ready_message !== ''
      ? override.general_ready_message
      : slug === DEFAULT_COUNCIL_EXPERT_SLUG
      ? chatbotCfg.general_ready_message
      : meta.defaultGeneralReadyMessage;

  const composerPlaceholder =
    override?.composer_placeholder !== undefined && override.composer_placeholder !== ''
      ? override.composer_placeholder
      : slug === DEFAULT_COUNCIL_EXPERT_SLUG
      ? chatbotCfg.composer_placeholder
      : meta.defaultComposerPlaceholder;

  const features: ChatbotFeaturesConfig = {
    ...chatbotCfg.features,
    ...(override?.features || {}),
  };

  const defaultMasterSuggestions =
    features.followups !== false &&
    meta.defaultSuggestionsEnabled &&
    (globalSug.followups_enabled || globalSug.deeper_analysis_enabled);

  const suggestionsEnabled =
    typeof override?.suggestions?.enabled === 'boolean'
      ? override.suggestions.enabled
      : defaultMasterSuggestions;

  const resolvedSuggestions: GuideSuggestionsConfig = {
    enabled: suggestionsEnabled,
    followups_enabled:
      typeof override?.suggestions?.followups_enabled === 'boolean'
        ? override.suggestions.followups_enabled
        : globalSug.followups_enabled,
    deeper_analysis_enabled:
      typeof override?.suggestions?.deeper_analysis_enabled === 'boolean'
        ? override.suggestions.deeper_analysis_enabled
        : globalSug.deeper_analysis_enabled,
    default_expanded:
      typeof override?.suggestions?.default_expanded === 'boolean'
        ? override.suggestions.default_expanded
        : globalSug.default_expanded,
    max_followups:
      typeof override?.suggestions?.max_followups === 'number'
        ? Math.max(1, Math.min(6, Math.round(override.suggestions.max_followups)))
        : globalSug.max_followups,
    max_deeper_analysis:
      typeof override?.suggestions?.max_deeper_analysis === 'number'
        ? Math.max(1, Math.min(6, Math.round(override.suggestions.max_deeper_analysis)))
        : globalSug.max_deeper_analysis,
    followups_rules:
      typeof override?.suggestions?.followups_rules === 'string' && override.suggestions.followups_rules.trim()
        ? override.suggestions.followups_rules.trim()
        : globalSug.followups_rules,
    deeper_analysis_rules:
      typeof override?.suggestions?.deeper_analysis_rules === 'string' && override.suggestions.deeper_analysis_rules.trim()
        ? override.suggestions.deeper_analysis_rules.trim()
        : globalSug.deeper_analysis_rules,
  };

  const hasCustomRules = Array.isArray(override?.modular_rules);
  const modularRules = hasCustomRules
    ? override!.modular_rules!
    : buildDefaultModularRulesForGuide(slug, chatbotCfg.conversational_rules);

  const combinedRulesText = modularRules
    .filter((r) => r.enabled && r.body.trim().length > 0)
    .map((r, i) => `RULE #${i + 1} (${r.title}):\n${r.body.trim()}`)
    .join('\n\n');

  const chatStyle: ChatStyle = override?.chat_style
    ? normalizeChatStyle(override.chat_style, meta.defaultChatStyle)
    : meta.defaultChatStyle;

  const isCustomized = Boolean(
    override &&
      (override.welcome_title !== undefined ||
        override.welcome_subtitle !== undefined ||
        override.general_ready_message !== undefined ||
        override.composer_placeholder !== undefined ||
        override.chat_style !== undefined ||
        (override.features && Object.keys(override.features).length > 0) ||
        hasCustomRules ||
        (override.suggestions && Object.keys(override.suggestions).length > 0) ||
        override.model_id)
  );

  return {
    slug,
    meta,
    isCustomized,
    welcome_title: welcomeTitle,
    welcome_subtitle: welcomeSubtitle,
    general_ready_message: generalReadyMessage,
    composer_placeholder: composerPlaceholder,
    chat_style: chatStyle,
    features: {
      ...features,
      followups: suggestionsEnabled && resolvedSuggestions.followups_enabled !== false,
    },
    modular_rules: modularRules,
    has_custom_modular_rules: hasCustomRules,
    combined_rules_text: combinedRulesText,
    suggestions: resolvedSuggestions,
    model_id: override?.model_id || null,
  };
}

export async function getEnginePromptOverrides(): Promise<EnginePromptOverrides> {
  const now = Date.now();
  if (enginePromptsCache && enginePromptsCache.expiresAt > now) {
    return enginePromptsCache.value;
  }
  const stored = await readSettingRow<Record<string, unknown>>('engine_prompt_overrides');
  const cleaned: EnginePromptOverrides =
    stored && typeof stored === 'object' ? { ...(stored as EnginePromptOverrides) } : {};
  if (stored && typeof stored === 'object') {
    if (!cleaned.vedic_tier1_reasoning_laws && typeof stored.sutra_tier1_reasoning_laws === 'string') {
      cleaned.vedic_tier1_reasoning_laws = stored.sutra_tier1_reasoning_laws;
    }
    if (!cleaned.vedic_anti_cliche_rules && typeof stored.sutra_anti_cliche_rules === 'string') {
      cleaned.vedic_anti_cliche_rules = stored.sutra_anti_cliche_rules;
    }
  }
  enginePromptsCache = { value: cleaned, expiresAt: now + CACHE_TTL_MS };
  return cleaned;
}

export function getEnginePromptDefaultsBundle() {
  return {
    core_council_constitution: DEFAULT_CORE_COUNCIL_CONSTITUTION,
    companion_constitution: DEFAULT_COMPANION_CONSTITUTION,
    companion_archetypes: DEFAULT_COMPANION_ARCHETYPES,
    companion_matcher_instructions: DEFAULT_COMPANION_MATCHER_INSTRUCTIONS,
    clarity_helper_system_prompt: DEFAULT_CLARITY_HELPER_SYSTEM_PROMPT,
    vedic_tier1_reasoning_laws: DEFAULT_VEDIC_TIER1_REASONING_LAWS,
    vedic_anti_cliche_rules: DEFAULT_VEDIC_ANTI_CLICHE_RULES,
    intent_output_contracts: { ...DEFAULT_INTENT_OUTPUT_CONTRACTS },
    fluency_instructions: { ...DEFAULT_FLUENCY_INSTRUCTIONS },
    format_contracts: { ...DEFAULT_FORMAT_CONTRACTS },
    stage1_router_prompt: DEFAULT_STAGE1_ROUTER_PROMPT,
    deep_audit_lenses: { ...DEFAULT_DEEP_AUDIT_LENSES },
    deep_audit_adjudicator_mandate: DEFAULT_DEEP_AUDIT_ADJUDICATOR_MANDATE,
    stage4_aligned_suggestions_prompt: DEFAULT_STAGE4_ALIGNED_SUGGESTIONS_PROMPT,
    stage4_fast_more_suggestions_prompt: DEFAULT_STAGE4_FAST_MORE_SUGGESTIONS_PROMPT,
    western_core_council_constitution: WESTERN_CORE_COUNCIL_CONSTITUTION,
    western_tier1_reasoning_laws: WESTERN_TIER1_REASONING_LAWS,
    western_anti_cliche_rules: WESTERN_ANTI_CLICHE_RULES,
    western_intent_output_contracts: { ...WESTERN_INTENT_OUTPUT_CONTRACTS },
    western_fluency_instructions: { ...WESTERN_FLUENCY_INSTRUCTIONS },
    western_format_contracts: { ...WESTERN_FORMAT_CONTRACTS },
    western_deep_audit_lenses: { ...WESTERN_DEEP_AUDIT_LENSES },
    western_deep_audit_adjudicator_mandate: WESTERN_DEEP_AUDIT_ADJUDICATOR_MANDATE,
    western_stage4_aligned_suggestions_prompt: WESTERN_STAGE4_ALIGNED_SUGGESTIONS_PROMPT,
    western_stage4_fast_more_suggestions_prompt: WESTERN_STAGE4_FAST_MORE_SUGGESTIONS_PROMPT,
  };
}

export async function getPlaybookOverrides(): Promise<PlaybookOverridesMap> {
  const now = Date.now();
  if (playbookOverridesCache && playbookOverridesCache.expiresAt > now) {
    return playbookOverridesCache.value;
  }
  const stored = await readSettingRow<PlaybookOverridesMap>('playbook_overrides');
  const cleaned: PlaybookOverridesMap = {};
  if (stored && typeof stored === 'object') {
    for (const [pbId, val] of Object.entries(stored)) {
      if (!val || typeof val !== 'object') continue;
      const key = pbId.trim().toUpperCase();
      cleaned[key] = {
        ...(typeof val.requiresTimingStack === 'boolean'
          ? { requiresTimingStack: val.requiresTimingStack }
          : {}),
        ...(Array.isArray(val.formulaSlugs)
          ? { formulaSlugs: val.formulaSlugs.map(String).filter(Boolean) }
          : {}),
        ...(typeof val.customInstructions === 'string' && val.customInstructions.trim()
          ? { customInstructions: val.customInstructions.trim().slice(0, 3000) }
          : {}),
        ...(typeof val.updated_at === 'string' ? { updated_at: val.updated_at } : {}),
      };
    }
  }
  playbookOverridesCache = { value: cleaned, expiresAt: now + CACHE_TTL_MS };
  return cleaned;
}

export async function getPublicChatbotUiConfig() {
  const [cfg, resolvedGuides, engineOverrides] = await Promise.all([
    getChatbotConfig(),
    Promise.all(GUIDE_SLUGS.map((slug) => getResolvedGuideConfig(slug))),
    getEnginePromptOverrides(),
  ]);

  const guide_overrides: Record<
    string,
    {
      welcome_title: string;
      welcome_subtitle: string;
      general_ready_message: string;
      composer_placeholder: string;
      chat_style: ChatStyle;
      features: ChatbotFeaturesConfig;
      suggestions_enabled: boolean;
      suggestions: {
        enabled: boolean;
        followups_enabled: boolean;
        deeper_analysis_enabled: boolean;
        default_expanded: boolean;
        max_followups: number;
        max_deeper_analysis: number;
      };
    }
  > = {};

  for (const g of resolvedGuides) {
    // STRICT SECURITY: NEVER include system_prompt, modular_rules, or engine instructions here
    guide_overrides[g.slug] = {
      welcome_title: g.welcome_title,
      welcome_subtitle: g.welcome_subtitle,
      general_ready_message: g.general_ready_message,
      composer_placeholder: g.composer_placeholder,
      chat_style: g.chat_style,
      features: g.features,
      suggestions_enabled:
        g.suggestions.enabled &&
        (g.suggestions.followups_enabled || g.suggestions.deeper_analysis_enabled),
      suggestions: {
        enabled: g.suggestions.enabled,
        followups_enabled: g.suggestions.followups_enabled,
        deeper_analysis_enabled: g.suggestions.deeper_analysis_enabled,
        default_expanded: g.suggestions.default_expanded,
        max_followups: g.suggestions.max_followups,
        max_deeper_analysis: g.suggestions.max_deeper_analysis,
      },
    };
  }

  const publicCompanionArchetypes =
    Array.isArray(engineOverrides.companion_archetypes) &&
    engineOverrides.companion_archetypes.length > 0
      ? engineOverrides.companion_archetypes
      : DEFAULT_COMPANION_ARCHETYPES;

  return {
    welcome_title: cfg.welcome_title,
    welcome_subtitle: cfg.welcome_subtitle,
    general_ready_message: cfg.general_ready_message,
    composer_placeholder: cfg.composer_placeholder,
    default_expert: cfg.default_expert,
    default_mode: cfg.default_mode,
    default_output: cfg.default_output,
    default_language: cfg.default_language,
    default_tone: cfg.default_tone,
    default_response_length: cfg.default_response_length,
    chat_numeric_font: cfg.chat_numeric_font,
    features: cfg.features,
    guide_overrides,
    companion_archetypes: publicCompanionArchetypes,
  };
}

export async function getSuggestionsConfig(): Promise<SuggestionsConfig> {
  const now = Date.now();
  if (suggestionsConfigCache && suggestionsConfigCache.expiresAt > now) {
    return suggestionsConfigCache.value;
  }

  const stored = await readSettingRow<SuggestionsConfig>('suggestions_config');
  const merged: SuggestionsConfig = {
    followups_enabled:
      typeof stored?.followups_enabled === 'boolean'
        ? stored.followups_enabled
        : DEFAULT_SUGGESTIONS_CONFIG.followups_enabled,
    deeper_analysis_enabled:
      typeof stored?.deeper_analysis_enabled === 'boolean'
        ? stored.deeper_analysis_enabled
        : DEFAULT_SUGGESTIONS_CONFIG.deeper_analysis_enabled,
    default_expanded:
      typeof stored?.default_expanded === 'boolean'
        ? stored.default_expanded
        : DEFAULT_SUGGESTIONS_CONFIG.default_expanded,
    max_followups:
      typeof stored?.max_followups === 'number' && stored.max_followups >= 1
        ? Math.min(6, Math.round(stored.max_followups))
        : DEFAULT_SUGGESTIONS_CONFIG.max_followups,
    max_deeper_analysis:
      typeof stored?.max_deeper_analysis === 'number' && stored.max_deeper_analysis >= 1
        ? Math.min(6, Math.round(stored.max_deeper_analysis))
        : DEFAULT_SUGGESTIONS_CONFIG.max_deeper_analysis,
    followups_rules:
      typeof stored?.followups_rules === 'string' && stored.followups_rules.trim()
        ? stored.followups_rules.trim()
        : DEFAULT_SUGGESTIONS_CONFIG.followups_rules,
    deeper_analysis_rules:
      typeof stored?.deeper_analysis_rules === 'string' && stored.deeper_analysis_rules.trim()
        ? stored.deeper_analysis_rules.trim()
        : DEFAULT_SUGGESTIONS_CONFIG.deeper_analysis_rules,
  };

  suggestionsConfigCache = { value: merged, expiresAt: now + CACHE_TTL_MS };
  return merged;
}

export async function getPublicSuggestionsConfig() {
  const cfg = await getSuggestionsConfig();
  return {
    followups_enabled: cfg.followups_enabled,
    deeper_analysis_enabled: cfg.deeper_analysis_enabled,
    default_expanded: cfg.default_expanded,
    max_followups: cfg.max_followups,
    max_deeper_analysis: cfg.max_deeper_analysis,
  };
}

export async function getMiniAppsConfig(): Promise<MiniAppsGovernanceConfig> {
  const now = Date.now();
  if (miniAppsConfigCache && miniAppsConfigCache.expiresAt > now) {
    return miniAppsConfigCache.value;
  }

  const stored = await readSettingRow<MiniAppsGovernanceConfig>('mini_apps_config');
  const rawOverrides =
    stored?.overrides && typeof stored.overrides === 'object' && !Array.isArray(stored.overrides)
      ? stored.overrides
      : {};

  const sanitizedOverrides: Record<string, MiniAppOverrideConfig> = {};
  for (const [slug, val] of Object.entries(rawOverrides)) {
    if (!val || typeof val !== 'object') continue;
    sanitizedOverrides[slug] = {
      enabled: typeof val.enabled === 'boolean' ? val.enabled : undefined,
      featured_on_home:
        typeof val.featured_on_home === 'boolean' ? val.featured_on_home : undefined,
      model_id:
        typeof val.model_id === 'string' && val.model_id.trim()
          ? val.model_id.trim()
          : val.model_id === null
          ? null
          : undefined,
    };
  }

  const merged: MiniAppsGovernanceConfig = {
    default_model_id:
      typeof stored?.default_model_id === 'string' && stored.default_model_id.trim()
        ? stored.default_model_id.trim()
        : null,
    daily_live_runs_soft_cap:
      typeof stored?.daily_live_runs_soft_cap === 'number' && stored.daily_live_runs_soft_cap >= 1
        ? Math.min(500, Math.round(stored.daily_live_runs_soft_cap))
        : DEFAULT_MINI_APPS_CONFIG.daily_live_runs_soft_cap,
    estimated_input_cost_per_million_usd:
      typeof stored?.estimated_input_cost_per_million_usd === 'number' &&
      stored.estimated_input_cost_per_million_usd >= 0
        ? stored.estimated_input_cost_per_million_usd
        : DEFAULT_MINI_APPS_CONFIG.estimated_input_cost_per_million_usd,
    estimated_output_cost_per_million_usd:
      typeof stored?.estimated_output_cost_per_million_usd === 'number' &&
      stored.estimated_output_cost_per_million_usd >= 0
        ? stored.estimated_output_cost_per_million_usd
        : DEFAULT_MINI_APPS_CONFIG.estimated_output_cost_per_million_usd,
    overrides: sanitizedOverrides,
  };

  miniAppsConfigCache = { value: merged, expiresAt: now + CACHE_TTL_MS };
  return merged;
}

export async function getPricingConfig(): Promise<PricingConfig> {
  const now = Date.now();
  if (pricingConfigCache && pricingConfigCache.expiresAt > now) {
    return pricingConfigCache.value;
  }

  const stored = await readSettingRow<PricingConfig>('pricing_config');
  const merged: PricingConfig = {
    signup_welcome_credits:
      typeof stored?.signup_welcome_credits === 'number' && stored.signup_welcome_credits >= 0
        ? Math.round(stored.signup_welcome_credits)
        : DEFAULT_PRICING_CONFIG.signup_welcome_credits,
    referral_reward_credits:
      typeof stored?.referral_reward_credits === 'number' && stored.referral_reward_credits >= 0
        ? Math.round(stored.referral_reward_credits)
        : DEFAULT_PRICING_CONFIG.referral_reward_credits,
    min_credits_to_chat:
      typeof stored?.min_credits_to_chat === 'number' && stored.min_credits_to_chat >= 0
        ? Math.round(stored.min_credits_to_chat)
        : DEFAULT_PRICING_CONFIG.min_credits_to_chat,
    chat_billing: {
      output_token_weight:
        typeof stored?.chat_billing?.output_token_weight === 'number' &&
        stored.chat_billing.output_token_weight >= 0
          ? stored.chat_billing.output_token_weight
          : DEFAULT_PRICING_CONFIG.chat_billing.output_token_weight,
      input_token_weight:
        typeof stored?.chat_billing?.input_token_weight === 'number' &&
        stored.chat_billing.input_token_weight >= 0
          ? stored.chat_billing.input_token_weight
          : DEFAULT_PRICING_CONFIG.chat_billing.input_token_weight,
      min_credits_per_reply:
        typeof stored?.chat_billing?.min_credits_per_reply === 'number' &&
        stored.chat_billing.min_credits_per_reply >= 0
          ? Math.round(stored.chat_billing.min_credits_per_reply)
          : DEFAULT_PRICING_CONFIG.chat_billing.min_credits_per_reply,
      max_credits_per_reply:
        typeof stored?.chat_billing?.max_credits_per_reply === 'number' &&
        stored.chat_billing.max_credits_per_reply >= 10
          ? Math.round(stored.chat_billing.max_credits_per_reply)
          : DEFAULT_PRICING_CONFIG.chat_billing.max_credits_per_reply,
    },
    credit_packs:
      Array.isArray(stored?.credit_packs) && stored.credit_packs.length > 0
        ? stored.credit_packs
        : DEFAULT_PRICING_CONFIG.credit_packs,
    membership_tiers:
      Array.isArray(stored?.membership_tiers) && stored.membership_tiers.length > 0
        ? stored.membership_tiers
        : DEFAULT_PRICING_CONFIG.membership_tiers,
  };

  pricingConfigCache = { value: merged, expiresAt: now + CACHE_TTL_MS };
  return merged;
}

export async function getPromptRecipes(): Promise<PromptRecipeRecord[]> {
  const now = Date.now();
  if (promptRecipesCache && promptRecipesCache.expiresAt > now) {
    return promptRecipesCache.value;
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return [];

  try {
    const { data, error } = await supabaseAdmin
      .from('prompt_recipes')
      .select('*')
      .order('name', { ascending: true });

    if (error || !Array.isArray(data)) {
      return [];
    }

    const list = data as PromptRecipeRecord[];
    promptRecipesCache = { value: list, expiresAt: now + CACHE_TTL_MS };
    return list;
  } catch {
    return [];
  }
}

export async function getActiveRecipeForTarget(
  targetType: 'mode' | 'report_pass' | 'custom',
  targetSlug: string
): Promise<PromptRecipeRecord | null> {
  const recipes = await getPromptRecipes();
  return (
    recipes.find(
      (r) => r.is_active && r.target_type === targetType && r.target_slug === targetSlug
    ) || null
  );
}

export async function getActiveRecipeBySlug(slug: string): Promise<PromptRecipeRecord | null> {
  const recipes = await getPromptRecipes();
  return recipes.find((r) => r.is_active && r.slug === slug) || null;
}
