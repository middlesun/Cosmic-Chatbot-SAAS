-- ============================================================================
-- Cosmic Council — Migration 006: 3-Pillar Chat (Council / Companion / Clarity),
-- Multi-Thread Active Tabs (max 5), and Dynamic Companion Personas
-- Safe, idempotent migration (run in Supabase SQL Editor)
-- ============================================================================

-- 1. Extend conversations with chat pillar, active-tab pinning, and companion persona storage
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS pillar text NOT NULL DEFAULT 'council',
  ADD COLUMN IF NOT EXISTS is_active_tab boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS active_tab_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS companion_type text,
  ADD COLUMN IF NOT EXISTS companion_persona_json jsonb;

-- Ensure pillar constraint is cleanly enforced (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversations_pillar_check'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_pillar_check
      CHECK (pillar IN ('council', 'companion', 'clarity'));
  END IF;
END $$;

-- Helpful indexes for sidebar pillar filtering & active tab restoration (near-zero egress)
CREATE INDEX IF NOT EXISTS idx_conversations_user_pillar
  ON public.conversations (user_id, pillar, is_bookmarked DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_user_active_tabs
  ON public.conversations (user_id, is_active_tab, active_tab_order ASC, updated_at DESC)
  WHERE is_active_tab = true;
