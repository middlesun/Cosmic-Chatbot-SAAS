-- =============================================================================
-- Migration 012: Chatbot Pipeline Telemetry Logs (Admin Diagnostics)
-- Safe, idempotent migration (run in Supabase SQL Editor)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.chatbot_pipeline_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expert_slug text,
  mode_slug text,
  response_length text,
  user_prompt_preview text,
  action_taken text NOT NULL DEFAULT 'proceed',
  stage1_json jsonb,
  stage2_json jsonb,
  stage3_json jsonb,
  stage4_json jsonb,
  total_latency_ms integer NOT NULL DEFAULT 0,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_chatbot_pipeline_logs_created_at
  ON public.chatbot_pipeline_logs (created_at DESC);

ALTER TABLE public.chatbot_pipeline_logs ENABLE ROW LEVEL SECURITY;
