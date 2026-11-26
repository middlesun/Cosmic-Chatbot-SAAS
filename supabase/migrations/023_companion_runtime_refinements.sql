-- 023_companion_runtime_refinements.sql
-- Phase 1: Per-companion temperature override (NULL inherits 0.45 platform default; valid range 0.0-2.0)

ALTER TABLE public.companions
  ADD COLUMN IF NOT EXISTS temperature DOUBLE PRECISION
  CHECK (temperature IS NULL OR (temperature >= 0.0 AND temperature <= 2.0));
