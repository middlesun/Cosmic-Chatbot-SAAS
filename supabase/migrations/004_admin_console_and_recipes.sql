-- Cosmic Council PRO — Admin Panel v2, Dynamic Platform Settings, Composable Prompt Recipes & Support Tickets
-- Safe, idempotent migration (run in Supabase SQL Editor)

-- 1. Platform Settings (Server-only encrypted AI settings, Chatbot config, Pricing & Plans)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
-- Intentionally zero client RLS policies: strictly server-side Service Role access only.

-- 2. Composable Prompt Recipes (Stack ordered prompts from system_prompts into Modes & Report Passes)
CREATE TABLE IF NOT EXISTS public.prompt_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_type TEXT NOT NULL DEFAULT 'mode' CHECK (target_type IN ('mode', 'report_pass', 'custom')),
  target_slug TEXT,
  steps_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_recipes_target
  ON public.prompt_recipes(target_type, target_slug);
CREATE INDEX IF NOT EXISTS idx_prompt_recipes_active
  ON public.prompt_recipes(is_active);

ALTER TABLE public.prompt_recipes ENABLE ROW LEVEL SECURITY;
-- Intentionally zero client RLS policies: strictly server-side Service Role access only.

-- 3. Persistent Support Tickets Desk
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General Support',
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  admin_notes TEXT,
  admin_reply_text TEXT,
  replied_at TIMESTAMPTZ,
  replied_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status_created
  ON public.support_tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user
  ON public.support_tickets(user_id);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_tickets' AND policyname = 'Users can view own support tickets'
  ) THEN
    CREATE POLICY "Users can view own support tickets"
      ON public.support_tickets FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_tickets' AND policyname = 'Users can create own support tickets'
  ) THEN
    CREATE POLICY "Users can create own support tickets"
      ON public.support_tickets FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Expand system_prompts for 100s-scale Prompt Library (new categories, tags, ordering, description)
ALTER TABLE public.system_prompts
  ADD COLUMN IF NOT EXISTS subtitle TEXT,
  ADD COLUMN IF NOT EXISTS model_id TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS description TEXT;

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

CREATE INDEX IF NOT EXISTS idx_system_prompts_category_sort
  ON public.system_prompts(category, sort_order, display_name);
CREATE INDEX IF NOT EXISTS idx_system_prompts_tags
  ON public.system_prompts USING GIN(tags);

-- 5. Ensure report_catalog supports per-report model overrides
ALTER TABLE public.report_catalog
  ADD COLUMN IF NOT EXISTS model_id TEXT;
