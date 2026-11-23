-- =============================================================================
-- Migration 017: Companion Back Story, Soul & Consciousness & Mini-App Rules Stack
-- Safe, idempotent migration (run in Supabase SQL Editor)
-- =============================================================================

-- 1. Extend public.companions with private Back Story and Soul & Consciousness layers
ALTER TABLE public.companions
  ADD COLUMN IF NOT EXISTS backstory TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS soul_consciousness TEXT NOT NULL DEFAULT '';

-- 2. Extend public.mini_apps with ordered modular rules stack
ALTER TABLE public.mini_apps
  ADD COLUMN IF NOT EXISTS rules_json JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.companions.backstory IS
  'Private lived history & roots inhabited quietly by the companion; never exposed on public cards or recited unprompted.';

COMMENT ON COLUMN public.companions.soul_consciousness IS
  'Sublime human realism, emotional radar, restraint, and inner compass instructions injected into companion runtime prompt.';

COMMENT ON COLUMN public.mini_apps.rules_json IS
  'Ordered modular rules stack [{ id, title, body, enabled }] applied at Mini-App generation runtime.';
