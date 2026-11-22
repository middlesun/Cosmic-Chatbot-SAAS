-- =============================================================================
-- Migration 015: Companions v2 (Preset Personalities, Shared Bonds, Reactions,
-- Referrals) & 5 Admin-Configurable Chat Styles
-- Safe, idempotent migration (run in Supabase SQL Editor)
-- =============================================================================

-- 1. Preset & Admin-Managed Companions Table
CREATE TABLE IF NOT EXISTS public.companions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  legacy_id TEXT,
  name TEXT NOT NULL,
  age INTEGER NOT NULL DEFAULT 30,
  sex TEXT NOT NULL DEFAULT 'F' CHECK (sex IN ('M', 'F')),
  tagline TEXT NOT NULL DEFAULT '',
  short_bio TEXT NOT NULL DEFAULT '',
  full_bio TEXT NOT NULL DEFAULT '',
  primary_expertise TEXT NOT NULL DEFAULT 'Friend',
  secondary_expertise TEXT[] NOT NULL DEFAULT '{}'::text[],
  category_tag TEXT NOT NULL DEFAULT 'friends'
    CHECK (category_tag IN ('support', 'friends', 'astrology', 'tarot_numerology', 'past_life')),
  cultural_fluency TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  monogram_palette JSONB NOT NULL DEFAULT '{"bg":"#EAE3D7","ring":"#B8965A","ink":"#3D3830"}'::jsonb,
  welcome_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  system_prompt TEXT NOT NULL DEFAULT '',
  hard_rules TEXT,
  soft_rules TEXT,
  autonomy_level TEXT NOT NULL DEFAULT 'intuitive'
    CHECK (autonomy_level IN ('steady', 'intuitive', 'free')),
  override_global_rules BOOLEAN NOT NULL DEFAULT TRUE,
  skill_level TEXT NOT NULL DEFAULT 'none_emotional'
    CHECK (skill_level IN ('none_emotional', 'astrology_soft', 'tarot', 'numerology', 'past_life', 'vedic_soft')),
  chat_style TEXT NOT NULL DEFAULT 'chat_bubbles'
    CHECK (chat_style IN ('editorial', 'structured', 'chat_bubbles', 'dialogue', 'concise_brief')),
  model_id TEXT,
  tts_voice_profile JSONB NOT NULL DEFAULT '{"rate":1.0,"pitch":1.0}'::jsonb,
  supports_listening_cue BOOLEAN NOT NULL DEFAULT TRUE,
  suggestions_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companions_active_order
  ON public.companions (is_active, sort_order ASC, name ASC);

ALTER TABLE public.companions ENABLE ROW LEVEL SECURITY;

-- 2. Per-(User x Companion) Shared Memory & Invisible Relationship Evolution
CREATE TABLE IF NOT EXISTS public.companion_bonds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  companion_slug TEXT NOT NULL,
  memory_summary TEXT,
  relationship_state_json JSONB NOT NULL DEFAULT '{"familiarity_stage":"just_met","total_turns":0,"user_slang_cues":[],"tone_preferences":[],"inside_references":[],"hearted_excerpts":[]}'::jsonb,
  last_interaction_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, companion_slug)
);

CREATE INDEX IF NOT EXISTS idx_companion_bonds_user_slug
  ON public.companion_bonds (user_id, companion_slug);

ALTER TABLE public.companion_bonds ENABLE ROW LEVEL SECURITY;

-- 3. Persistent Custom Companions Matched via "Find someone new"
CREATE TABLE IF NOT EXISTS public.user_custom_companions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  persona_json JSONB NOT NULL,
  last_conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_user_custom_companions_user
  ON public.user_custom_companions (user_id, updated_at DESC);

ALTER TABLE public.user_custom_companions ENABLE ROW LEVEL SECURITY;

-- 4. Extend conversations for companion_slug & optional listening cue
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS companion_slug TEXT,
  ADD COLUMN IF NOT EXISTS companion_chat_mode TEXT
    CHECK (companion_chat_mode IS NULL OR companion_chat_mode IN ('just_listen', 'help_think'));

CREATE INDEX IF NOT EXISTS idx_conversations_user_companion_slug
  ON public.conversations (user_id, companion_slug, updated_at DESC)
  WHERE companion_slug IS NOT NULL;

-- 5. Extend messages for bubble reactions, render_style snapshot, and inline referral cards
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reaction TEXT
    CHECK (reaction IS NULL OR reaction IN ('heart', 'felt')),
  ADD COLUMN IF NOT EXISTS render_style TEXT
    CHECK (render_style IS NULL OR render_style IN ('editorial', 'structured', 'chat_bubbles', 'dialogue', 'concise_brief')),
  ADD COLUMN IF NOT EXISTS referral_json JSONB;

COMMENT ON TABLE public.companions IS
  'Server-governed preset & admin-managed companions; system_prompt, hard_rules, and soft_rules are never readable by direct client RLS.';

COMMENT ON TABLE public.companion_bonds IS
  'Private per-(user, companion) longitudinal memory and silent relationship evolution state.';
