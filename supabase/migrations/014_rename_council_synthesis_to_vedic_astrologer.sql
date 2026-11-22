-- ============================================================================
-- Migration 014: Rename canonical council slug 'council_synthesis' -> 'vedic_astrologer'
-- and migrate legacy engine prompt override keys 'sutra_*' -> 'vedic_*'.
-- Safe & idempotent: can be re-run without error.
-- ============================================================================

BEGIN;

-- 1. public.users: migrate default_expert and update column default
UPDATE public.users
SET default_expert = 'vedic_astrologer'
WHERE default_expert = 'council_synthesis';

ALTER TABLE public.users
  ALTER COLUMN default_expert SET DEFAULT 'vedic_astrologer';

-- 2. public.messages: migrate expert_used
UPDATE public.messages
SET expert_used = 'vedic_astrologer'
WHERE expert_used = 'council_synthesis';

-- 3. public.chatbot_pipeline_logs: migrate expert_slug (guarded if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'chatbot_pipeline_logs'
  ) THEN
    UPDATE public.chatbot_pipeline_logs
    SET expert_slug = 'vedic_astrologer'
    WHERE expert_slug = 'council_synthesis';
  END IF;
END $$;

-- 4. public.system_prompts: rename slug if target doesn't exist, else deactivate duplicate
UPDATE public.system_prompts
SET slug = 'vedic_astrologer',
    updated_at = NOW()
WHERE slug = 'council_synthesis'
  AND NOT EXISTS (
    SELECT 1 FROM public.system_prompts WHERE slug = 'vedic_astrologer'
  );

UPDATE public.system_prompts
SET is_active = FALSE,
    updated_at = NOW()
WHERE slug = 'council_synthesis'
  AND is_active = TRUE
  AND EXISTS (
    SELECT 1 FROM public.system_prompts WHERE slug = 'vedic_astrologer'
  );

-- 5. public.prompt_recipes: migrate target_slug and steps_json prompt_slug references
UPDATE public.prompt_recipes
SET target_slug = 'vedic_astrologer',
    updated_at = NOW()
WHERE target_slug = 'council_synthesis';

UPDATE public.prompt_recipes
SET steps_json = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'prompt_slug' = 'council_synthesis'
      THEN jsonb_set(elem, '{prompt_slug}', '"vedic_astrologer"'::jsonb, false)
      ELSE elem
    END
  )
  FROM jsonb_array_elements(steps_json) AS elem
),
updated_at = NOW()
WHERE jsonb_typeof(steps_json) = 'array'
  AND steps_json @> '[{"prompt_slug": "council_synthesis"}]'::jsonb;

-- 6. public.platform_settings: chatbot_config default_expert & deduplicated expert_order
UPDATE public.platform_settings
SET value_json = jsonb_set(
  value_json,
  '{default_expert}',
  '"vedic_astrologer"'::jsonb,
  true
),
updated_at = NOW()
WHERE key = 'chatbot_config'
  AND value_json->>'default_expert' = 'council_synthesis';

UPDATE public.platform_settings
SET value_json = jsonb_set(
  value_json,
  '{expert_order}',
  COALESCE(
    (
      SELECT jsonb_agg(val ORDER BY first_idx)
      FROM (
        SELECT
          CASE
            WHEN elem = '"council_synthesis"'::jsonb THEN '"vedic_astrologer"'::jsonb
            ELSE elem
          END AS val,
          MIN(ord) AS first_idx
        FROM jsonb_array_elements(value_json->'expert_order') WITH ORDINALITY AS t(elem, ord)
        GROUP BY 1
      ) dedup
    ),
    '[]'::jsonb
  ),
  false
),
updated_at = NOW()
WHERE key = 'chatbot_config'
  AND jsonb_typeof(value_json->'expert_order') = 'array'
  AND value_json->'expert_order' @> '["council_synthesis"]'::jsonb;

-- 7. public.platform_settings: per_guide_chatbot_config map key migration
UPDATE public.platform_settings
SET value_json = (
  CASE
    WHEN value_json ? 'vedic_astrologer'
    THEN value_json - 'council_synthesis'
    ELSE (value_json - 'council_synthesis') || jsonb_build_object('vedic_astrologer', value_json->'council_synthesis')
  END
),
updated_at = NOW()
WHERE key = 'per_guide_chatbot_config'
  AND value_json ? 'council_synthesis';

-- 8. public.platform_settings: engine_prompt_overrides sutra_* -> vedic_* key migration
UPDATE public.platform_settings
SET value_json = (
  CASE
    WHEN (value_json ? 'sutra_tier1_reasoning_laws') AND NOT (value_json ? 'vedic_tier1_reasoning_laws')
    THEN jsonb_set(value_json, '{vedic_tier1_reasoning_laws}', value_json->'sutra_tier1_reasoning_laws', true) - 'sutra_tier1_reasoning_laws'
    ELSE value_json - 'sutra_tier1_reasoning_laws'
  END
),
updated_at = NOW()
WHERE key = 'engine_prompt_overrides'
  AND value_json ? 'sutra_tier1_reasoning_laws';

UPDATE public.platform_settings
SET value_json = (
  CASE
    WHEN (value_json ? 'sutra_anti_cliche_rules') AND NOT (value_json ? 'vedic_anti_cliche_rules')
    THEN jsonb_set(value_json, '{vedic_anti_cliche_rules}', value_json->'sutra_anti_cliche_rules', true) - 'sutra_anti_cliche_rules'
    ELSE value_json - 'sutra_anti_cliche_rules'
  END
),
updated_at = NOW()
WHERE key = 'engine_prompt_overrides'
  AND value_json ? 'sutra_anti_cliche_rules';

COMMIT;
