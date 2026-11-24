-- Migration 021: Companionship-First Decoupled Living User Context & Future-Ready Hooks
-- Preserves all Council/Apps/Reports birth_profile schemas while enabling chartless companionship,
-- user-facing Memory Inspector controls, timezone/proactive hooks, and thread kind tagging.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_living_context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS user_deep_profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS user_context_preferences JSONB NOT NULL DEFAULT '{"memory_paused":false,"allow_cross_companion_memory":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS proactive_opt_in BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS thread_kind TEXT NOT NULL DEFAULT 'chat';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversations_thread_kind_check'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_thread_kind_check
      CHECK (thread_kind IN ('chat', 'journal', 'checkin', 'goal_review'));
  END IF;
END $$;
