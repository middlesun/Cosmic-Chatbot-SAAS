-- 022_companion_v2_authoring_and_versioning.sql
-- Phase 2: Companion Architecture V2 (Rich Character Authoring, Draft/Publish, Version History & Rollback, Specialization Taxonomy)

ALTER TABLE public.companions
  ADD COLUMN IF NOT EXISTS personality_v2_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS draft_payload_json JSONB,
  ADD COLUMN IF NOT EXISTS published_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS has_unpublished_draft BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS core_identity_locked BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS specialization_slugs TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS last_published_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_companions_specialization_slugs
  ON public.companions USING GIN (specialization_slugs);

CREATE TABLE IF NOT EXISTS public.companion_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  companion_id UUID REFERENCES public.companions(id) ON DELETE CASCADE,
  companion_slug TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'archived')),
  snapshot_json JSONB NOT NULL,
  change_note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (companion_slug, version_number)
);

CREATE INDEX IF NOT EXISTS idx_companion_versions_slug_ver
  ON public.companion_versions (companion_slug, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_companion_versions_companion_id
  ON public.companion_versions (companion_id, version_number DESC);

ALTER TABLE public.companion_versions ENABLE ROW LEVEL SECURITY;

-- Restrict direct client access; Admin & runtime server services use supabaseAdmin (service_role)
DROP POLICY IF EXISTS "No direct client read on companion_versions" ON public.companion_versions;
CREATE POLICY "No direct client read on companion_versions"
  ON public.companion_versions
  FOR SELECT
  USING (false);
