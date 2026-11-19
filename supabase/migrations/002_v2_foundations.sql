-- Cosmic Council V2: Phase 1 Foundations (Columns, Indexes & Default Prompt Updates)
-- Run inside Supabase SQL Editor

-- 1. PROFILES: Short display label, single "You" default flag, & fuzzy duplicate-chart fingerprint
alter table public.profiles
  add column if not exists short_name text,
  add column if not exists is_default boolean not null default false,
  add column if not exists chart_fingerprint text;

create unique index if not exists idx_profiles_single_default_per_user
  on public.profiles (user_id)
  where is_default = true;

create index if not exists idx_profiles_chart_fingerprint
  on public.profiles (chart_fingerprint)
  where chart_fingerprint is not null;

-- 2. USERS: Personal call-name, chat font size preference, & hashed IP anti-abuse metadata
alter table public.users
  add column if not exists preferred_call_name text,
  add column if not exists chat_font_size text not null default 'base',
  add column if not exists signup_ip_hash text,
  add column if not exists last_ip_hash text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_chat_font_size_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_chat_font_size_check
      check (chat_font_size in ('sm', 'base', 'lg'));
  end if;
end $$;

-- 3. SYSTEM PROMPTS & REPORT CATALOG: Subtitles + per-item OpenRouter model overrides
alter table public.system_prompts
  add column if not exists subtitle text,
  add column if not exists model_id text;

alter table public.report_catalog
  add column if not exists model_id text;

-- 4. Seed 'general' Mode and update 'council_synthesis' display name to 'Vedic astrologer'
insert into public.system_prompts (
  slug, category, display_name, subtitle, prompt_body, version, previous_versions, is_active
) values (
  'general',
  'mode',
  'General',
  'Open-ended Vedic guidance across any life topic.',
  'CONSULTATION MODE: GENERAL.
Provide balanced, grounded Vedic insight tailored directly to the user''s question without forcing an artificial domain frame. Anchor chart analysis in Lagna, Moon, relevant Bhavas, active Dasha/Antardasha, and current Gochar transits.',
  1,
  '[]'::jsonb,
  true
)
on conflict (slug) do update
  set display_name = excluded.display_name,
      subtitle = coalesce(public.system_prompts.subtitle, excluded.subtitle),
      updated_at = now();

update public.system_prompts
set display_name = 'Vedic astrologer',
    updated_at = now()
where slug = 'council_synthesis';
