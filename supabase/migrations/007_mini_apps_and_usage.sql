-- =============================================================================
-- Migration 007: Mini-Apps Hub Cache, Usage Telemetry, and User Favorites
-- Idempotent & safe to re-run in Supabase SQL Editor.
-- =============================================================================

-- 1. Cached Mini-App outputs (scoped per user, optional profile, app, and period/topic key)
CREATE TABLE IF NOT EXISTS public.app_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  app_slug text NOT NULL,
  cache_key text NOT NULL,
  content_markdown text NOT NULL,
  structured_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_cache_unique_key
  ON public.app_cache (
    user_id,
    COALESCE(profile_id, '00000000-0000-0000-0000-000000000000'::uuid),
    app_slug,
    cache_key
  );

CREATE INDEX IF NOT EXISTS idx_app_cache_user_recent
  ON public.app_cache (user_id, updated_at DESC);

ALTER TABLE public.app_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_cache' AND policyname = 'Users manage own app_cache'
  ) THEN
    CREATE POLICY "Users manage own app_cache"
      ON public.app_cache
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Mini-App Usage & Token Telemetry (tracks runs, cache hits & OpenRouter token consumption)
CREATE TABLE IF NOT EXISTS public.app_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  app_slug text NOT NULL,
  cache_hit boolean NOT NULL DEFAULT false,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_usage_logs_app_date
  ON public.app_usage_logs (app_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_usage_logs_user_date
  ON public.app_usage_logs (user_id, created_at DESC);

ALTER TABLE public.app_usage_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_usage_logs' AND policyname = 'Users view own app_usage_logs'
  ) THEN
    CREATE POLICY "Users view own app_usage_logs"
      ON public.app_usage_logs
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3. User Favorite Mini-Apps
CREATE TABLE IF NOT EXISTS public.user_favorite_apps (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  app_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, app_slug)
);

ALTER TABLE public.user_favorite_apps ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_favorite_apps' AND policyname = 'Users manage own favorite apps'
  ) THEN
    CREATE POLICY "Users manage own favorite apps"
      ON public.user_favorite_apps
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
