import crypto from 'crypto';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';

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
  expert_order: string[];
  mode_order: string[];
  language_order: string[];
  features: ChatbotFeaturesConfig;
  conversational_rules: string;
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
- NEVER begin messages with letter salutations such as "Hello [Name],", "Hi [Name],", "Dear [Name],", or "Namaste [Name]," at the top of your reply.
- Jump directly into answering the user's question with calm clarity. On follow-up turns, pick up the thread seamlessly without re-introducing yourself or repeating prior framing.
- If you know the user's preferred name, weave it in only occasionally and organically inside a sentence (at most once across several turns, and never as an opening greeting header).
- Avoid rigid corporate phrasing ("Executive Synthesis", "In conclusion", "As an AI"). Keep headings clean and natural when structured sections genuinely help readability.`;

export const DEFAULT_AI_SETTINGS: AiSettingsConfig = {
  openrouter_api_key_encrypted: null,
  openrouter_api_key_last4: null,
  consultation_model: process.env.OPENROUTER_CONSULTATION_MODEL || 'google/gemini-2.5-flash',
  utility_model: process.env.OPENROUTER_UTILITY_MODEL || 'google/gemini-2.5-flash',
  custom_models: [],
  token_limits: {
    chat_short: 600,
    chat_detailed: 2600,
    report_pass: 4500,
    utility: 800,
    max_history_turns: 24,
  },
};

export const DEFAULT_CHATBOT_CONFIG: ChatbotConfig = {
  welcome_title: "I'm ready",
  welcome_subtitle: '',
  general_ready_message:
    "Great, I'm ready to answer any question you may have regarding Vedic Astrology.",
  composer_placeholder: 'Ask anything about your chart, timing, or Vedic astrology...',
  default_expert: 'council_synthesis',
  default_mode: 'general',
  default_output: 'detailed',
  default_language: 'English',
  default_tone: 'technical',
  default_response_length: 'detailed',
  expert_order: ['council_synthesis', 'parashari', 'kp_precision', 'jaimini', 'nadi'],
  mode_order: ['general', 'life', 'career', 'love', 'marriage', 'health', 'wealth', 'learn_astrology'],
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

let aiSettingsCache: { value: AiSettingsConfig; expiresAt: number } | null = null;
let chatbotConfigCache: { value: ChatbotConfig; expiresAt: number } | null = null;
let pricingConfigCache: { value: PricingConfig; expiresAt: number } | null = null;
let promptRecipesCache: { value: PromptRecipeRecord[]; expiresAt: number } | null = null;

export function invalidateAllPlatformCaches(): void {
  aiSettingsCache = null;
  chatbotConfigCache = null;
  pricingConfigCache = null;
  promptRecipesCache = null;
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

export async function savePlatformSetting(
  key: 'ai_config' | 'chatbot_config' | 'pricing_config',
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

  if (key === 'ai_config') aiSettingsCache = null;
  if (key === 'chatbot_config') chatbotConfigCache = null;
  if (key === 'pricing_config') pricingConfigCache = null;
  return { ok: true };
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
        ? stored.default_expert.trim()
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
    expert_order:
      Array.isArray(stored?.expert_order) && stored.expert_order.length > 0
        ? stored.expert_order.map(String)
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

export async function getPublicChatbotUiConfig() {
  const cfg = await getChatbotConfig();
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
    features: cfg.features,
  };
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
