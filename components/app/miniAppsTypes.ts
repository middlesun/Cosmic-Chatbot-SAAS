import type { LifeContextData } from '../../lib/lifeContextSchema';

export type MiniAppTemplate = 'auto_brief' | 'domain_explorer' | 'form_reading' | 'guided_quiz';

export type MiniAppCategory =
  | 'daily_timing'
  | 'self_chart'
  | 'love'
  | 'money_career'
  | 'mind_wellness';

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
    primary_expertise: string;
    tagline: string;
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
}

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
