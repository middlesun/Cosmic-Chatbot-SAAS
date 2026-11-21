-- =============================================================================
-- Migration 013: Per-Guide Chatbot Control Settings, Engine Overrides & Playbook Overrides
-- Safe, idempotent migration (run in Supabase SQL Editor)
-- =============================================================================

-- Ensure platform_settings table & strict service-role RLS are intact
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Seed default JSONB rows for Phase 5 per-guide control center (non-destructive)
INSERT INTO public.platform_settings (key, value_json)
VALUES
  ('per_guide_chatbot_config', '{}'::jsonb),
  ('engine_prompt_overrides', '{}'::jsonb),
  ('playbook_overrides', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.platform_settings IS
  'Server-only governance config including ai_config, chatbot_config, suggestions_config, per_guide_chatbot_config, engine_prompt_overrides, and playbook_overrides.';
