-- =============================================================================
-- Migration 009: Add 'master_prompts' category to public.system_prompts
-- Safe, idempotent migration (run in Supabase SQL Editor)
-- =============================================================================

DO $$
DECLARE
  constraint_rec RECORD;
BEGIN
  FOR constraint_rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.system_prompts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%category%'
  LOOP
    EXECUTE format('ALTER TABLE public.system_prompts DROP CONSTRAINT IF EXISTS %I', constraint_rec.conname);
  END LOOP;
END $$;

ALTER TABLE public.system_prompts
  ADD CONSTRAINT system_prompts_category_check
  CHECK (
    category IN (
      'system',
      'master_prompts',
      'expert',
      'analysis',
      'modifier',
      'mode',
      'output',
      'language',
      'tool',
      'report_step',
      'learn'
    )
  );
