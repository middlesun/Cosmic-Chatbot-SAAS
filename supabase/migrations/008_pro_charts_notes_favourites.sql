-- =============================================================================
-- Migration 008: Pro Chart Fields, Astrology Mode Preference, Notes & Favourites
-- Idempotent & safe to re-run in Supabase SQL Editor.
-- =============================================================================

-- 1. User preference for default astrology system ('vedic' | 'western')
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS default_astrology_mode text NOT NULL DEFAULT 'vedic';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_default_astrology_mode_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_default_astrology_mode_check
      CHECK (default_astrology_mode IN ('vedic', 'western'));
  END IF;
END $$;

-- 2. Profile starring & custom tags
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_profiles_user_starred
  ON public.profiles (user_id, is_starred DESC, created_at DESC);

-- 3. User Favorite Reports
CREATE TABLE IF NOT EXISTS public.user_favorite_reports (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  report_catalog_id uuid NOT NULL REFERENCES public.report_catalog(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, report_catalog_id)
);

ALTER TABLE public.user_favorite_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_favorite_reports'
      AND policyname = 'Users manage own favorite reports'
  ) THEN
    CREATE POLICY "Users manage own favorite reports"
      ON public.user_favorite_reports
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Saved Mini-App Past Readings
CREATE TABLE IF NOT EXISTS public.mini_app_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  app_slug text NOT NULL,
  astrology_mode text NOT NULL DEFAULT 'vedic' CHECK (astrology_mode IN ('vedic', 'western')),
  title text,
  inputs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  structured_json jsonb,
  markdown text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mini_app_readings_lookup
  ON public.mini_app_readings (user_id, app_slug, profile_id, created_at DESC);

ALTER TABLE public.mini_app_readings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mini_app_readings'
      AND policyname = 'Users manage own mini app readings'
  ) THEN
    CREATE POLICY "Users manage own mini app readings"
      ON public.mini_app_readings
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 5. User Notes (1-click saves from Council, Companion, Apps, Reports + personal notes)
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source_type text NOT NULL DEFAULT 'personal' CHECK (source_type IN ('personal', 'council', 'companion', 'apps', 'reports')),
  source_ref_id text,
  astrology_mode text CHECK (astrology_mode IS NULL OR astrology_mode IN ('vedic', 'western')),
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_user_created
  ON public.notes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notes_user_source_profile
  ON public.notes (user_id, source_type, profile_id, created_at DESC);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notes'
      AND policyname = 'Users manage own notes'
  ) THEN
    CREATE POLICY "Users manage own notes"
      ON public.notes
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 6. Report Orders astrology mode ('vedic' | 'western')
ALTER TABLE public.report_orders
  ADD COLUMN IF NOT EXISTS astrology_mode text NOT NULL DEFAULT 'vedic';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_orders_astrology_mode_check'
  ) THEN
    ALTER TABLE public.report_orders
      ADD CONSTRAINT report_orders_astrology_mode_check
      CHECK (astrology_mode IN ('vedic', 'western'));
  END IF;
END $$;

