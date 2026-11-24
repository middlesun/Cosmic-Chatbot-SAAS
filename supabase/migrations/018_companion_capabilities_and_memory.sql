-- =============================================================================
-- Migration 018: Companion Capabilities, Dual-Gender Personas, Lossless Thread
-- Compaction, Structured Deep Profile & Council Analyst Notes
-- Safe, idempotent migration (run in Supabase SQL Editor)
-- =============================================================================

-- 1. Extend public.companions with 3-Layer Governance, Capabilities & Dual-Gender Variants
ALTER TABLE public.companions
  ADD COLUMN IF NOT EXISTS companion_group TEXT NOT NULL DEFAULT 'everyday_companions'
    CHECK (
      companion_group IN (
        'spiritual_guides',
        'everyday_companions',
        'life_companions',
        'spiritual',
        'everyday',
        'life'
      )
    ),
  ADD COLUMN IF NOT EXISTS advisory_mode TEXT NOT NULL DEFAULT 'balanced_support'
    CHECK (advisory_mode IN ('listen_only', 'friend', 'balanced_support', 'esoteric_guide')),
  ADD COLUMN IF NOT EXISTS chart_access JSONB NOT NULL DEFAULT
    '{"vedic":false,"western":false,"tarot":false,"numerology":false,"past_life":false,"council_notes":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS formula_cartridge_slugs TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS max_output_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS discoverable_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS gender_variants JSONB,
  ADD COLUMN IF NOT EXISTS override_group_rules BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Extend public.conversations with Lossless Thread Compaction & Chosen Persona Gender
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS thread_memory_summary TEXT,
  ADD COLUMN IF NOT EXISTS thread_memory_msg_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selected_gender TEXT
    CHECK (selected_gender IS NULL OR selected_gender IN ('M', 'F'));

-- 3. Extend public.profiles with Structured Deep Profile & Concise Council Analyst Notes
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deep_profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS analyst_notes_json JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.companions.chart_access IS
  'Granular Admin-controlled capabilities: { vedic, western, tarot, numerology, past_life, council_notes }.';

COMMENT ON COLUMN public.conversations.thread_memory_summary IS
  'Rolling lossless summary of earlier turns beyond the verbatim tail window.';

COMMENT ON COLUMN public.profiles.deep_profile_json IS
  'Structured cited psychological, practical, emotional, and goal context extracted across Council and Companions.';

COMMENT ON COLUMN public.profiles.analyst_notes_json IS
  'Concise technical chart conclusions captured from Council consultations for chart-enabled Companions.';
