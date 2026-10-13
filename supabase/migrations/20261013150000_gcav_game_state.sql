-- Durable game state and Realtime authorization for GCAV.
create sequence if not exists public.gca_player_number_seq start with 101;

create table if not exists public.gca_game_players (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_number integer not null unique default nextval('public.gca_player_number_seq'),
  name text not null default 'Player' check (char_length(name) between 1 and 20),
  role text not null default 'resident' check (role in ('resident','courier','police','criminal','retail')),
  outfit text not null default 'street' check (outfit in ('street','sport','denim','formal','desert','night')),
  x double precision not null default 8,
  z double precision not null default 12,
  yaw double precision not null default 0,
  vehicle boolean not null default false,
  space text,
  job smallint not null default 0 check (job between 0 and 2),
  inventory jsonb not null default '{}'::jsonb,
  wanted boolean not null default false,
  jailed_until timestamptz,
  last_crime_at timestamptz,
  shift_started_at timestamptz,
  shift_space text,
  shift_role text,
  shift_distance double precision not null default 0,
  last_move_at timestamptz not null default now(),
  last_chat_at timestamptz,
  last_action_at timestamptz,
  toll_state jsonb not null default '{"gates":{},"pairs":{}}'::jsonb,
  call_id uuid,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.gca_game_players enable row level security;
revoke all on public.gca_game_players from anon, authenticated;

create table if not exists public.gca_game_properties (
  property_id text primary key,
  name text not null,
  kind text not null,
  buy_price numeric(12,2) not null check (buy_price > 0),
  city_rent numeric(12,2) not null check (city_rent > 0),
  owner_id uuid references auth.users(id) on delete set null,
  rent_price numeric(12,2) not null default 0 check (rent_price >= 0 and rent_price <= 1000000),
  tenant_id uuid references auth.users(id) on delete set null,
  tenant_expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.gca_game_properties enable row level security;
revoke all on public.gca_game_properties from anon, authenticated;

insert into public.gca_game_properties(property_id,name,kind,buy_price,city_rent) values
 ('apt-marina-01','Marina View Studio','apartment',185000,1800),
 ('apt-downtown-02','Downtown Family Apartment','apartment',640000,5200),
 ('villa-jumeirah-01','Jumeirah Garden Villa','house',1250000,9800),
 ('villa-waterfront-02','Waterfront Townhouse','house',890000,7200)
on conflict (property_id) do update set name=excluded.name,kind=excluded.kind,buy_price=excluded.buy_price,city_rent=excluded.city_rent;

create table if not exists public.gca_rental_requests (
  id uuid primary key default gen_random_uuid(),
  property_id text not null references public.gca_game_properties(property_id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique(property_id,tenant_id)
);
alter table public.gca_rental_requests enable row level security;
revoke all on public.gca_rental_requests from anon, authenticated;

create table if not exists public.gca_game_invoices (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null check (item_id in ('coffee','meal','souvenir')),
  item_name text not null,
  amount numeric(12,2) not null check (amount > 0),
  space text not null,
  expires_at timestamptz not null,
  state text not null default 'pending' check (state in ('pending','paid','declined','expired')),
  created_at timestamptz not null default now()
);
alter table public.gca_game_invoices enable row level security;
revoke all on public.gca_game_invoices from anon, authenticated;

create table if not exists public.gca_game_calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references auth.users(id) on delete cascade,
  callee_id uuid not null references auth.users(id) on delete cascade,
  state text not null default 'ringing' check (state in ('ringing','active','ended')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 seconds',
  ended_at timestamptz,
  check (caller_id <> callee_id)
);
create index if not exists gca_game_calls_participant_idx on public.gca_game_calls(caller_id,callee_id,state);
alter table public.gca_game_calls enable row level security;
revoke all on public.gca_game_calls from anon, authenticated;

create table if not exists public.gca_game_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  action text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id,request_id)
);
alter table public.gca_game_requests enable row level security;
revoke all on public.gca_game_requests from anon, authenticated;

insert into public.gca_game_players(user_id,name)
select p.user_id,coalesce(nullif(trim(p.display_name),''),'Player')
from public.gca_profiles p
on conflict(user_id) do nothing;

create or replace function public.gca_create_player_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  chosen_name text;
begin
  chosen_name := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if chosen_name = '' then chosen_name := 'Player'; end if;
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

  insert into public.gca_game_players(user_id,name)
  values(new.id,chosen_name)
  on conflict(user_id) do nothing;

  return new;
end;
$function$;

create or replace function public.gca_emit_user(p_user_id uuid,p_event text,p_payload jsonb)
returns void
language sql
security definer
set search_path = ''
as $function$
  select realtime.send(
    jsonb_build_object('type',p_event)||coalesce(p_payload,'{}'::jsonb),
    'game-event',
    'gcav:user:'||p_user_id::text,
    true
  );
$function$;

create or replace function public.gca_emit_world(p_event text,p_payload jsonb)
returns void
language sql
security definer
set search_path = ''
as $function$
  select realtime.send(
    jsonb_build_object('type',p_event)||coalesce(p_payload,'{}'::jsonb),
    'game-event',
    'gcav:world',
    true
  );
$function$;

create or replace function public.gca_game_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Sign in required' using errcode='28000'; end if;
  return jsonb_build_object(
    'profile',(select jsonb_build_object('display_name',display_name) from public.gca_profiles where user_id=u),
    'wallet',(select jsonb_build_object('balance',balance,'updated_at',updated_at) from public.gca_wallets where user_id=u),
    'entries',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) from (
      select id,amount,label,kind,metadata,created_at from public.gca_ledger where user_id=u order by created_at desc limit 100
    ) x),
    'player',(select to_jsonb(p) from public.gca_game_players p where user_id=u)
  );
end;
$function$;
grant execute on function public.gca_game_snapshot() to authenticated;

drop policy if exists "gcav authenticated call topic read" on realtime.messages;
drop policy if exists "gcav authenticated call topic publish" on realtime.messages;
create policy "gcav authenticated world read"
on realtime.messages for select to authenticated
using (realtime.topic()='gcav:world');
create policy "gcav authenticated own game read"
on realtime.messages for select to authenticated
using (realtime.topic()='gcav:user:'||auth.uid()::text);
create policy "gcav call participant read"
on realtime.messages for select to authenticated
using (
  realtime.topic() ~ '^gcav:call:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.gca_game_calls c
    where c.id::text=split_part(realtime.topic(),':',3)
      and auth.uid() in (c.caller_id,c.callee_id)
      and c.state in ('ringing','active')
  )
);
create policy "gcav call participant publish"
on realtime.messages for insert to authenticated
with check (
  realtime.topic() ~ '^gcav:call:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.gca_game_calls c
    where c.id::text=split_part(realtime.topic(),':',3)
      and auth.uid() in (c.caller_id,c.callee_id)
      and c.state='active'
  )
);
