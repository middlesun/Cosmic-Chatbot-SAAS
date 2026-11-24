import type { LifeContextData } from '../../lib/lifeContextSchema';
import type {
  AnyCompanionGroup,
  CompanionAdvisoryMode,
  CompanionChartAccess,
  CompanionGenderVariants,
  CompanionSex,
} from './chatTypes';

export type MiniAppTemplate = 'auto_brief' | 'domain_explorer' | 'form_reading' | 'guided_quiz';

export type MiniAppCategory = string;

export interface MiniAppCategoryRecord {
  slug: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MiniAppRuleItem {
  id: string;
  title: string;
  body: string;
  enabled: boolean;
}

export interface MiniAppDefinition {
  slug: string;
  title: string;
  shortTitle: string;
  tagline: string;
  description: string;
  category: MiniAppCategory;
  categoryLabel: string;
  template: MiniAppTemplate;
  iconKey: string;
  popular: boolean;
  featuredOnHome: boolean;
  requiresProfile: boolean;
  cacheScope: 'daily' | 'weekly' | 'monthly' | 'chart' | 'none';
  chatSeedPrompt: string;
  estimatedRead: string;
  sortOrder?: number;
  isActive?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
}

export interface BreakdownSubTopic {
  id: string;
  label: string;
  summary: string;
}

export interface BreakdownDomain {
  id: string;
  title: string;
  subtitle: string;
  topics: BreakdownSubTopic[];
}

export interface PlanetStrengthQuestion {
  question: string;
  options: string[];
}

export interface MiniAppStructuredHeader {
  eyebrow?: string;
  headline?: string;
  metrics?: Array<{ label: string; value: string; hint?: string }>;
  table?: {
    columns: string[];
    rows: string[][];
  };
}

export interface MiniAppRunResponse {
  slug: string;
  markdown: string;
  structured?: MiniAppStructuredHeader | null;
  cacheHit: boolean;
  cachedAt: string;
  astrologyMode?: 'vedic' | 'western';
  readingId?: string | null;
  profileUsed?: { id: string; name: string; short_name?: string | null } | null;
  questions?: PlanetStrengthQuestion[];
  planetNatalContext?: {
    planet: string;
    sign?: string;
    house?: number;
    nakshatra?: string;
    dignity?: string;
    isRetrograde?: boolean;
  } | null;
}

export interface MiniAppPastReading {
  id: string;
  app_slug: string;
  profile_id: string | null;
  profile_name?: string | null;
  astrology_mode: 'vedic' | 'western';
  title: string | null;
  inputs_json?: Record<string, unknown> | null;
  structured_json?: MiniAppStructuredHeader | null;
  markdown: string;
  created_at: string;
}

export interface HomeSummaryResponse {
  recentConversations: Array<{
    id: string;
    title: string;
    pillar: 'council' | 'companion' | 'clarity';
    profile_id: string | null;
    profile_label: string | null;
    companion_slug?: string | null;
    companion_name: string | null;
    companion_role: string | null;
    avatar_url?: string | null;
    monogram_palette?: { bg: string; ring: string; ink: string } | null;
    updated_at: string;
  }>;
  recentGuides: Array<{
    kind: 'council' | 'companion';
    id: string;
    title: string;
    subtitle: string;
    expertSlug?: string;
    companionSlug?: string;
    avatarUrl?: string | null;
    monogramPalette?: { bg: string; ring: string; ink: string } | null;
    conversationId?: string;
    lastActiveAt?: string;
  }>;
  featuredCompanions?: Array<{
    slug: string;
    name: string;
    age: number;
    sex?: CompanionSex;
    primary_expertise: string;
    card_subtitle?: string;
    secondary_expertise?: string[];
    category_tag?: 'support' | 'friends' | 'astrology' | 'tarot_numerology' | 'past_life';
    companion_group?: AnyCompanionGroup;
    advisory_mode?: CompanionAdvisoryMode;
    chart_access?: CompanionChartAccess;
    discoverable_tags?: string[];
    situation_tags?: string[];
    gender_variants?: CompanionGenderVariants;
    supports_gender_toggle?: boolean;
    skill_level?: 'none_emotional' | 'astrology_soft' | 'tarot' | 'numerology' | 'past_life' | 'vedic_soft';
    tagline: string;
    short_bio?: string;
    how_conversations_feel?: string;
    avatar_url: string | null;
    monogram_palette: { bg: string; ring: string; ink: string };
    last_conversation_id?: string | null;
  }>;
  favoriteAppSlugs: string[];
  recentAppRuns: Array<{
    app_slug: string;
    updated_at: string;
  }>;
  primaryProfile?: {
    id: string;
    name: string;
    short_name?: string | null;
    is_default?: boolean;
    life_context_json?: LifeContextData | null;
    life_context_completeness?: number;
  } | null;
  livingContextSummary?: {
    signalCount: number;
    memoryPaused: boolean;
    allowCrossCompanionMemory: boolean;
  };
}

export const DEFAULT_MINI_APP_CATEGORY_RECORDS: MiniAppCategoryRecord[] = [
  { slug: 'daily_timing', label: 'Timing', sortOrder: 10, isActive: true },
  { slug: 'self_chart', label: 'Identity', sortOrder: 20, isActive: true },
  { slug: 'love', label: 'Love', sortOrder: 30, isActive: true },
  { slug: 'money_career', label: 'Money & Career', sortOrder: 40, isActive: true },
  { slug: 'mind_wellness', label: 'Mind & Wellness', sortOrder: 50, isActive: true },
];

export const MINI_APP_CATEGORIES: Array<{ id: 'all' | 'popular' | MiniAppCategory | 'favorites'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'popular', label: 'Most Popular' },
  { id: 'favorites', label: 'Favourites' },
  { id: 'daily_timing', label: 'Timing' },
  { id: 'self_chart', label: 'Identity' },
  { id: 'love', label: 'Love' },
  { id: 'money_career', label: 'Money & Career' },
  { id: 'mind_wellness', label: 'Mind & Wellness' },
];
