-- =============================================================================
-- Cosmic Council Migration 005:
--   1. Birth Profiles: Current Location (city, state, country, timezone offset)
--   2. Messages: Two-Tier Structured Suggestions (Followup & Deeper analysis)
--   3. Conversations: Per-Conversation "Ask later" Bookmarked Suggestions
--   4. Users: Suggestions Auto-Expand Preference (defaults to TRUE)
--   5. System Prompts: Move legacy Parashari/KP/Jaimini/Nadi rows from 'expert'
--      into 'analysis' so Admin Prompt Recipes preserve all IP while the primary
--      Council selector shows the unified 5-guide Council roster.
-- Safe to run multiple times (idempotent).
-- =============================================================================

-- 1. Current Location on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_city TEXT,
  ADD COLUMN IF NOT EXISTS current_state TEXT,
  ADD COLUMN IF NOT EXISTS current_country TEXT,
  ADD COLUMN IF NOT EXISTS current_timezone_offset NUMERIC;

-- 2. Structured two-tier suggestions on messages (backwards-compatible with followups_json)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS suggestions_json JSONB;

-- 3. Per-conversation "Ask later" bookmarked suggestions
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS ask_later_json JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 4. User setting controlling whether Suggestions auto-expand below replies
--    (Turning FALSE collapses Suggestions by default rather than removing them.)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS suggestions_auto_expand BOOLEAN NOT NULL DEFAULT TRUE;

-- 5. Preserve legacy Vedic sub-system prompts under category='analysis' for Admin Recipes
UPDATE public.system_prompts
SET category = 'analysis'
WHERE slug IN ('parashari', 'kp_precision', 'jaimini', 'nadi')
  AND category = 'expert';
