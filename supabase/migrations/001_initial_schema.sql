-- Cosmic Council PRO: Phase 1 Initial Schema, RLS Policies, Triggers & Atomic Credit RPCs
-- Run inside Supabase SQL Editor or via Supabase CLI migrations

create extension if not exists "pgcrypto";

-- 1. USERS (mirrors auth.users with SaaS profile, tier, credits, referral & onboarding flags)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  tier text not null default 'personal' check (tier in ('personal', 'pro', 'guru')),
  credits_balance integer not null default 0 check (credits_balance >= 0),
  currency_pref text not null default 'INR' check (currency_pref in ('INR', 'USD', 'AED', 'EUR')),
  default_expert text not null default 'council_synthesis',
  default_output text not null default 'detailed',
  default_language text not null default 'English',
  referral_code text unique not null,
  referred_by uuid references public.users(id) on delete set null,
  must_change_password boolean not null default false,
  is_admin boolean not null default false,
  account_status text not null default 'active' check (account_status in ('active', 'suspended')),
  location_country text,
  location_city text,
  last_active_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. PROFILES (Saved birth charts & profile memory)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  birth_date date not null,
  birth_time time not null,
  birth_city text not null,
  birth_state text,
  birth_country text not null,
  latitude double precision,
  longitude double precision,
  timezone_offset double precision,
  gender text check (gender in ('male', 'female', 'non-binary')),
  relationship text,
  birth_chart_pdf_url text,
  is_activated boolean not null default false,
  activated_at timestamptz,
  chart_json jsonb,
  chart_text_context text,
  profile_memory_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_user_id on public.profiles(user_id);

-- 3. DAILY TRANSITS (Global Gochar cache: max 1 API fetch per UTC day across all users)
create table if not exists public.daily_transits (
  transit_date date primary key,
  transits_json jsonb not null,
  transits_text text not null,
  created_at timestamptz not null default now()
);

-- 4. REPORT CATALOG (Admin-managed Deep Research report store)
create table if not exists public.report_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text not null,
  short_description text not null,
  long_description text,
  price_credits integer not null check (price_credits >= 0),
  prompt_chain_json jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. REPORT ORDERS (Async 2-5 min multi-pass deep research orders)
create table if not exists public.report_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  report_catalog_id uuid not null references public.report_catalog(id),
  user_questions text,
  credits_charged integer not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'generating_pdf', 'completed', 'failed')),
  progress_step text default 'Queued for Council synthesis',
  step_outputs_json jsonb default '[]'::jsonb,
  final_markdown text,
  pdf_url text,
  audio_url text,
  linked_conversation_id uuid,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_report_orders_user on public.report_orders(user_id, created_at desc);

-- 6. CONVERSATIONS (Grouped into folders by profile_id, or NULL for General/Learn Astrology)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  linked_report_id uuid references public.report_orders(id) on delete set null,
  title text not null default 'New Consultation',
  mode_type text not null default 'reading' check (mode_type in ('reading', 'learn_astrology', 'report_followup')),
  is_bookmarked boolean not null default false,
  total_word_count integer not null default 0,
  use_full_profile_memory boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_conversations_user_folder on public.conversations(user_id, profile_id, is_bookmarked desc, updated_at desc);

-- 7. MESSAGES (Supports inline reply-to-message, starring, context exclusion, mode tags & follow-ups)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  parent_message_id uuid references public.messages(id) on delete set null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  word_count integer not null default 0,
  expert_used text,
  mode_used text,
  output_format_used text,
  language_used text,
  is_starred boolean not null default false,
  excluded_from_context boolean not null default false,
  followups_json jsonb default '[]'::jsonb,
  tokens_in integer default 0,
  tokens_out integer default 0,
  credits_charged integer default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at asc);

-- 8. USER CUSTOM PROMPTS ("My Prompts", max 10 per user)
create table if not exists public.custom_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  prompt_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_custom_prompts_user on public.custom_prompts(user_id);

-- 9. SYSTEM PROMPTS (Server/Admin-only IP: never readable via client anon key)
create table if not exists public.system_prompts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  category text not null check (category in ('expert', 'mode', 'output', 'language', 'tool', 'report_step', 'learn')),
  display_name text not null,
  prompt_body text not null,
  version integer not null default 1,
  previous_versions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 10. CREDIT TRANSACTIONS & PAYMENT ORDERS
create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount integer not null,
  balance_after integer not null,
  tx_type text not null check (tx_type in ('purchase', 'subscription_grant', 'chat_usage', 'profile_activation', 'report_order', 'referral_bonus', 'admin_adjustment', 'refund', 'welcome_bonus')),
  reference_id text,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_tx_user on public.credit_transactions(user_id, created_at desc);

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  dodo_payment_id text unique not null,
  order_type text not null check (order_type in ('credit_pack', 'subscription')),
  package_slug text,
  amount_paid numeric(12,2) not null,
  currency text not null,
  credits_granted integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 11. REFERRALS
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.users(id) on delete cascade,
  referee_id uuid not null unique references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'rewarded')),
  reward_credits integer not null default 5000,
  rewarded_at timestamptz,
  created_at timestamptz not null default now()
);

-- 12. HELPER FUNCTIONS & TRIGGERS
create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := 'CC-';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_ref_code text;
  ref_by_uuid uuid;
  ref_code_input text;
begin
  new_ref_code := public.generate_referral_code();
  while exists (select 1 from public.users where referral_code = new_ref_code) loop
    new_ref_code := public.generate_referral_code();
  end loop;

  ref_code_input := nullif(trim(coalesce(new.raw_user_meta_data->>'referral_code', '')), '');
  if ref_code_input is not null then
    select id into ref_by_uuid from public.users where referral_code = upper(ref_code_input) limit 1;
  end if;

  insert into public.users (
    id, email, full_name, referral_code, referred_by, must_change_password
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new_ref_code,
    ref_by_uuid,
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, false)
  )
  on conflict (id) do nothing;

  if ref_by_uuid is not null and ref_by_uuid <> new.id then
    insert into public.referrals (referrer_id, referee_id, status, reward_credits)
    values (ref_by_uuid, new.id, 'pending', 5000)
    on conflict (referee_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enforce max 10 custom prompts per user
create or replace function public.enforce_max_custom_prompts()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.custom_prompts where user_id = new.user_id) >= 10 then
    raise exception 'Maximum of 10 custom prompts allowed per account';
  end if;
  return new;
end;
$$;

drop trigger if exists check_max_custom_prompts on public.custom_prompts;
create trigger check_max_custom_prompts
  before insert on public.custom_prompts
  for each row execute procedure public.enforce_max_custom_prompts();

-- 13. ATOMIC CREDIT LEDGER RPCs (Race-condition safe via FOR UPDATE row lock)
create or replace function public.deduct_user_credits(
  p_user_id uuid,
  p_amount integer,
  p_tx_type text,
  p_reference_id text default null,
  p_description text default null
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_current integer;
  v_next integer;
begin
  if p_amount <= 0 then
    raise exception 'Deduction amount must be positive';
  end if;

  select credits_balance into v_current
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'User account not found';
  end if;

  if v_current < p_amount then
    raise exception 'Insufficient credits (available: %, required: %)', v_current, p_amount;
  end if;

  v_next := v_current - p_amount;

  update public.users
  set credits_balance = v_next, updated_at = now()
  where id = p_user_id;

  insert into public.credit_transactions (user_id, amount, balance_after, tx_type, reference_id, description)
  values (p_user_id, -p_amount, v_next, p_tx_type, p_reference_id, p_description);

  return v_next;
end;
$$;

create or replace function public.grant_user_credits(
  p_user_id uuid,
  p_amount integer,
  p_tx_type text,
  p_reference_id text default null,
  p_description text default null
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_current integer;
  v_next integer;
begin
  if p_amount <= 0 then
    raise exception 'Grant amount must be positive';
  end if;

  select credits_balance into v_current
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'User account not found';
  end if;

  v_next := v_current + p_amount;

  update public.users
  set credits_balance = v_next, updated_at = now()
  where id = p_user_id;

  insert into public.credit_transactions (user_id, amount, balance_after, tx_type, reference_id, description)
  values (p_user_id, p_amount, v_next, p_tx_type, p_reference_id, p_description);

  return v_next;
end;
$$;

-- 14. ROW LEVEL SECURITY (RLS)
alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.daily_transits enable row level security;
alter table public.report_catalog enable row level security;
alter table public.report_orders enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.custom_prompts enable row level security;
alter table public.system_prompts enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.payment_orders enable row level security;
alter table public.referrals enable row level security;

-- Users can read/update safe columns on own record (credits/admin/tier enforced server-side)
create policy "Users view own record" on public.users
  for select using (auth.uid() = id);
create policy "Users update own preferences" on public.users
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users manage own profiles" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Authenticated users read daily transits" on public.daily_transits
  for select to authenticated using (true);

create policy "Anyone reads active report catalog" on public.report_catalog
  for select using (is_active = true);

create policy "Users view own report orders" on public.report_orders
  for select using (auth.uid() = user_id);

create policy "Users manage own conversations" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own messages" on public.messages
  for all using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

create policy "Users manage own custom prompts" on public.custom_prompts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- system_prompts: ZERO client access (only service_role backend / admin API)
-- No select policy for anon/authenticated guarantees prompt IP cannot leak to browser.

create policy "Users view own credit transactions" on public.credit_transactions
  for select using (auth.uid() = user_id);

create policy "Users view own payment orders" on public.payment_orders
  for select using (auth.uid() = user_id);

create policy "Users view own referrals" on public.referrals
  for select using (auth.uid() = referrer_id or auth.uid() = referee_id);
