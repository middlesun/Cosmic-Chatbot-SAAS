-- Cosmic Council: 5,000 Free Signup Welcome Credits & Free Chart Activations
-- Run inside Supabase SQL Editor

-- 1. Set default balance on public.users to 5,000 credits for new signups
alter table public.users
  alter column credits_balance set default 5000;

-- 2. Update handle_new_user() trigger to grant 5,000 welcome credits & log the ledger transaction
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_ref_code text;
  ref_by_uuid uuid;
  ref_code_input text;
  inserted_user_id uuid;
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
    id, email, full_name, credits_balance, referral_code, referred_by, must_change_password
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    5000,
    new_ref_code,
    ref_by_uuid,
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, false)
  )
  on conflict (id) do nothing
  returning id into inserted_user_id;

  if inserted_user_id is not null then
    insert into public.credit_transactions (
      user_id, amount, balance_after, tx_type, reference_id, description
    ) values (
      inserted_user_id,
      5000,
      5000,
      'welcome_bonus',
      inserted_user_id::text,
      'Welcome bonus — 5,000 free signup credits'
    );
  end if;

  if ref_by_uuid is not null and ref_by_uuid <> new.id then
    insert into public.referrals (referrer_id, referee_id, status, reward_credits)
    values (ref_by_uuid, new.id, 'pending', 5000)
    on conflict (referee_id) do nothing;
  end if;

  return new;
end;
$$;
