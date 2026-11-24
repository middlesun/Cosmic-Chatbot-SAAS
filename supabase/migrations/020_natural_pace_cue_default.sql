-- =============================================================================
-- Migration 020: Phase 0 — Allow 'natural' Pace Cue Default on Conversations
-- Safe, idempotent migration (run in Supabase SQL Editor)
-- Preserves all existing explicit user selections ('just_listen', 'help_think').
-- =============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'conversations'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%companion_chat_mode%'
  LOOP
    EXECUTE format('ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_companion_chat_mode_check
  CHECK (
    companion_chat_mode IS NULL
    OR companion_chat_mode IN ('natural', 'just_listen', 'help_think')
  );

COMMENT ON COLUMN public.conversations.companion_chat_mode IS
  'Optional user pace cue for companion chats: natural (default when NULL or "natural"), just_listen, or help_think.';
