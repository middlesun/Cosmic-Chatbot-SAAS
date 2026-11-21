-- =============================================================================
-- Migration 011: Sutradhara Engine (SUTRA) Foundation Columns & Prompt Categories
-- Safe, idempotent migration (run in Supabase SQL Editor)
-- =============================================================================

-- 1. Profile Truth Dossier + Desh-Kaal-Patra Life Context columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS natal_truth_dossier_json jsonb,
  ADD COLUMN IF NOT EXISTS natal_dossier_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS life_context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS life_context_completeness integer NOT NULL DEFAULT 0;

-- 2. User-level silent intelligence / fluency profile (updated asynchronously)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sutra_user_profile_json jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3. Extend system_prompts category check to support Formula Cartridges & Priority Rules
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
      'tone',
      'mode',
      'output',
      'language',
      'tool',
      'report_step',
      'learn',
      'formula_cartridge',
      'priority_rule'
    )
  );

-- Reinforce zero client read access on proprietary system_prompts
ALTER TABLE public.system_prompts ENABLE ROW LEVEL SECURITY;
