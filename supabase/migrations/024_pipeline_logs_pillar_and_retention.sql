-- =============================================================================
-- Migration 024: Chatbot Pipeline Logs Pillar Index & Retention Support
-- Safe, idempotent migration (run in Supabase SQL Editor)
-- =============================================================================

ALTER TABLE public.chatbot_pipeline_logs
  ADD COLUMN IF NOT EXISTS pillar text;

CREATE INDEX IF NOT EXISTS idx_chatbot_pipeline_logs_pillar_created_at
  ON public.chatbot_pipeline_logs (pillar, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chatbot_pipeline_logs_expert_created_at
  ON public.chatbot_pipeline_logs (expert_slug, created_at DESC);
