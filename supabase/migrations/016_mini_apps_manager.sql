-- Migration 016: Dynamic Mini-Apps & Categories Manager
-- Enables full Admin CRUD, prompt customization, display ordering, and category management.

CREATE TABLE IF NOT EXISTS public.mini_app_categories (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mini_apps (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  short_title TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category_slug TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'auto_brief',
  icon_key TEXT NOT NULL DEFAULT 'sparkles',
  popular BOOLEAN NOT NULL DEFAULT false,
  featured_on_home BOOLEAN NOT NULL DEFAULT false,
  requires_profile BOOLEAN NOT NULL DEFAULT true,
  cache_scope TEXT NOT NULL DEFAULT 'monthly',
  chat_seed_prompt TEXT NOT NULL DEFAULT '',
  estimated_read TEXT NOT NULL DEFAULT '3 min read',
  vedic_prompt TEXT NOT NULL DEFAULT '',
  western_prompt TEXT NOT NULL DEFAULT '',
  system_override TEXT NOT NULL DEFAULT '',
  input_label TEXT NOT NULL DEFAULT '',
  input_placeholder TEXT NOT NULL DEFAULT '',
  model_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mini_app_categories_order
  ON public.mini_app_categories (sort_order ASC, label ASC);

CREATE INDEX IF NOT EXISTS idx_mini_apps_order
  ON public.mini_apps (sort_order ASC, title ASC);

-- Security: Never expose system prompt bodies on public/authenticated client SELECT on mini_apps.
-- User clients read sanitized catalog metadata via /api/apps/catalog; admin uses service_role APIs.
ALTER TABLE public.mini_app_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mini_apps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mini_app_categories_read_active" ON public.mini_app_categories;
CREATE POLICY "mini_app_categories_read_active"
  ON public.mini_app_categories
  FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

-- Note: public.mini_apps intentionally has no anon/authenticated client SELECT policies
-- so vedic_prompt / western_prompt / system_override remain strictly server-side IP.
