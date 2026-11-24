-- =============================================================================
-- Migration 019: Non-binary ('NB') Companion Support + Bespoke Card Subtitle
-- & "How Conversations Feel" Editorial Fields
-- Safe, idempotent migration (run in Supabase SQL Editor)
-- =============================================================================

-- 1. Allow 'NB' alongside 'M' and 'F' on public.companions.sex
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
      AND t.relname = 'companions'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%sex%'
  LOOP
    EXECUTE format('ALTER TABLE public.companions DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.companions
  ADD CONSTRAINT companions_sex_check CHECK (sex IN ('M', 'F', 'NB'));

-- 2. Allow 'NB' on public.conversations.selected_gender if column exists
DO $$
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
      AND column_name = 'selected_gender'
  ) THEN
    FOR r IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = 'public'
        AND t.relname = 'conversations'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%selected_gender%'
    LOOP
      EXECUTE format('ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;

    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_selected_gender_check
      CHECK (selected_gender IS NULL OR selected_gender IN ('M', 'F', 'NB'));
  END IF;
END $$;

-- 3. Add bespoke UI display columns for Mini Card subtitle & "How conversations feel"
ALTER TABLE public.companions
  ADD COLUMN IF NOT EXISTS card_subtitle TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS how_conversations_feel TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.companions.card_subtitle IS
  'Two-part mini card subtitle (e.g., "Vedic Astrology · Life & Wisdom" or "Listener · Unspoken Feelings").';

COMMENT ON COLUMN public.companions.how_conversations_feel IS
  'Expanded profile "How conversations feel" copy explaining the companion conversational atmosphere.';
