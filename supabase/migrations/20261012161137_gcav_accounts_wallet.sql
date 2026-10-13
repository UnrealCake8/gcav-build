-- Cloud player identity and bank. Money mutations go through checked RPCs;
-- browser clients can read only their own rows.
create table if not exists public.gca_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Player' check (char_length(display_name) between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gca_wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance numeric(12,2) not null default 500.00,
  updated_at timestamptz not null default now()
);

create table if not exists public.gca_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(12,2) not null check (amount <> 0),
  label text not null check (char_length(label) between 1 and 120),
  kind text not null check (char_length(kind) between 1 and 40),
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists gca_ledger_user_created_idx
  on public.gca_ledger (user_id, created_at desc);

create unique index if not exists gca_ledger_request_once_idx
  on public.gca_ledger (user_id, request_id)
  where request_id is not null;

alter table public.gca_profiles enable row level security;
alter table public.gca_wallets enable row level security;
alter table public.gca_ledger enable row level security;

revoke all on public.gca_profiles, public.gca_wallets, public.gca_ledger from anon, authenticated;
grant select on public.gca_profiles, public.gca_wallets, public.gca_ledger to authenticated;
grant update (display_name) on public.gca_profiles to authenticated;

drop policy if exists "Players can read their own profile" on public.gca_profiles;
create policy "Players can read their own profile" on public.gca_profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Players can update their own profile" on public.gca_profiles;
create policy "Players can update their own profile" on public.gca_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Players can read their own wallet" on public.gca_wallets;
create policy "Players can read their own wallet" on public.gca_wallets
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Players can read their own ledger" on public.gca_ledger;
create policy "Players can read their own ledger" on public.gca_ledger
  for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.gca_create_player_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_name text;
begin
  chosen_name := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if chosen_name = '' then
    chosen_name := 'Player';
  end if;
  chosen_name := left(chosen_name, 20);

  insert into public.gca_profiles (user_id, display_name)
  values (new.id, chosen_name)
  on conflict (user_id) do nothing;

  insert into public.gca_wallets (user_id, balance)
  values (new.id, 500.00)
  on conflict (user_id) do nothing;

  insert into public.gca_ledger (user_id, amount, label, kind, metadata)
  values (new.id, 500.00, 'Welcome credit', 'welcome', '{"source":"account_signup"}'::jsonb)
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.gca_create_player_account() from public, anon, authenticated;

drop trigger if exists on_gca_player_created on auth.users;
create trigger on_gca_player_created
  after insert on auth.users
  for each row execute function public.gca_create_player_account();

create or replace function public.gca_transfer_money(
  p_recipient uuid,
  p_amount numeric,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender uuid := auth.uid();
  sender_balance numeric(12,2);
  recipient_balance numeric(12,2);
  prior_balance numeric(12,2);
begin
  if sender is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if p_recipient is null or p_recipient = sender then
    raise exception 'Choose another player' using errcode = '22023';
  end if;
  if p_request_id is null or p_amount is null or p_amount <= 0 or p_amount > 10000
     or round(p_amount, 2) <> p_amount then
    raise exception 'Invalid transfer amount or request id' using errcode = '22023';
  end if;

  perform 1 from public.gca_wallets
  where user_id in (sender, p_recipient)
  order by user_id
  for update;

  select balance into sender_balance from public.gca_wallets where user_id = sender;
  select balance into recipient_balance from public.gca_wallets where user_id = p_recipient;
  if sender_balance is null or recipient_balance is null then
    raise exception 'Player wallet not found' using errcode = 'P0002';
  end if;
  if sender_balance < p_amount then
    raise exception 'Insufficient funds' using errcode = '22003';
  end if;
  if exists (
    select 1 from public.gca_ledger
    where user_id = sender and request_id = p_request_id and kind = 'transfer-debit'
  ) then
    return jsonb_build_object('ok', true, 'duplicate', true, 'balance', sender_balance);
  end if;

  update public.gca_wallets
  set balance = balance - p_amount, updated_at = now()
  where user_id = sender
  returning balance into sender_balance;

  update public.gca_wallets
  set balance = balance + p_amount, updated_at = now()
  where user_id = p_recipient
  returning balance into recipient_balance;

  insert into public.gca_ledger (user_id, amount, label, kind, request_id, metadata)
  values
    (sender, -p_amount, 'Player transfer', 'transfer-debit', p_request_id, jsonb_build_object('recipient', p_recipient)),
    (p_recipient, p_amount, 'Player transfer', 'transfer-credit', p_request_id, jsonb_build_object('sender', sender));

  return jsonb_build_object('ok', true, 'duplicate', false, 'balance', sender_balance);
end;
$$;

revoke all on function public.gca_transfer_money(uuid, numeric, uuid) from public, anon;
grant execute on function public.gca_transfer_money(uuid, numeric, uuid) to authenticated;
