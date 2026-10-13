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


-- Keep privileged helper functions private even though they live in public.
revoke all on function public.gca_game_snapshot() from public, anon;
grant execute on function public.gca_game_snapshot() to authenticated;
revoke all on function public.gca_emit_user(uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.gca_emit_world(text,jsonb) from public, anon, authenticated;
revoke all on function public.gca_create_player_account() from public, anon, authenticated;

-- Realtime authorization policies need a participant-scoped read on the call table.
grant select on public.gca_game_calls to authenticated;
create policy "gcav call participant lookup"
on public.gca_game_calls for select to authenticated
using (auth.uid() in (caller_id,callee_id));


create or replace function public.gca_game_wallet_event(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'type','bank',
    'balance',w.balance,
    'entries',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select id,amount,label,kind,metadata,created_at from public.gca_ledger
      where user_id=p_user_id order by created_at desc limit 100
    ) x),'[]'::jsonb),
    'role',p.role,'inventory',p.inventory,'wanted',p.wanted,
    'jailedUntil',extract(epoch from p.jailed_until)*1000,
    'job',p.job,
    'properties',coalesce((select jsonb_agg(jsonb_build_object(
      'id',h.property_id,'mode',case when h.owner_id=p_user_id then 'buy' else 'rent' end,
      'expiresAt',extract(epoch from h.tenant_expires_at)*1000
    )) from public.gca_game_properties h
      where h.owner_id=p_user_id or (h.tenant_id=p_user_id and h.tenant_expires_at>now())),'[]'::jsonb)
  )
  from public.gca_wallets w join public.gca_game_players p on p.user_id=w.user_id
  where w.user_id=p_user_id;
$function$;

create or replace function public.gca_game_world_state()
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.user_id,'number',p.player_number::text,'name',p.name,'role',p.role,
    'outfit',p.outfit,'x',p.x,'z',p.z,'yaw',p.yaw,'vehicle',p.vehicle,
    'space',p.space,'wanted',p.wanted
  ) order by p.player_number),'[]'::jsonb)
  from public.gca_game_players p
  where p.last_seen_at>now()-interval '60 seconds';
$function$;

create or replace function public.gca_game_action(p_action text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  u uuid:=auth.uid();
  p public.gca_game_players%rowtype;
  v_events jsonb:='[]'::jsonb;
  v_event jsonb;
  v_notice text;
  v_now timestamptz:=now();
  v_id text;
  v_mode text;
  v_amount numeric;
  v_balance numeric;
  v_other uuid;
  v_item text;
  v_name text;
  v_space text;
  v_call public.gca_game_calls%rowtype;
  v_uuid uuid;
  v_request uuid;
  v_distance double precision;
  v_dt double precision;
  v_x double precision;
  v_z double precision;
begin
  if u is null then raise exception 'Sign in required' using errcode='28000'; end if;
  if p_action not in ('join','role','enter','exit','property-acquire','property-set-price',
    'property-renew-request','property-renew-answer','purchase','shift','transfer','pos-create',
    'pos-answer','rob','arrest','bail','outfit','move','job-start','reset','chat','dial','answer','hangup')
  then raise exception 'Invalid game action' using errcode='22023'; end if;
  select * into p from public.gca_game_players where user_id=u for update;
  if not found then
    insert into public.gca_game_players(user_id) values(u)
    on conflict(user_id) do nothing;
    select * into p from public.gca_game_players where user_id=u for update;
  end if;
  update public.gca_game_players set last_seen_at=v_now where user_id=u;

  if p_action='join' then
    v_name:=left(regexp_replace(coalesce(p_payload->>'name','Player'),'[[:cntrl:]]','','g'),20);
    if v_name='' then v_name:='Player'; end if;
    update public.gca_game_players set name=v_name,
      outfit=case when p_payload->>'outfit' in ('street','sport','denim','formal','desert','night') then p_payload->>'outfit' else outfit end,
      last_seen_at=v_now where user_id=u returning * into p;
    update public.gca_profiles set display_name=v_name,updated_at=v_now where user_id=u;
    v_events:=jsonb_build_array(
      jsonb_build_object('type','welcome','id',u,'number',p.player_number::text,
        'world',jsonb_build_object('epoch',extract(epoch from v_now)*1000,'now',extract(epoch from v_now)*1000,'cycleMs',1440000)),
      public.gca_game_wallet_event(u),
      jsonb_build_object('type','state','players',public.gca_game_world_state())
    );
    perform public.gca_emit_world('state',jsonb_build_object('players',public.gca_game_world_state()));
    return jsonb_build_object('events',v_events);
  elsif p_action='role' then
    v_id:=p_payload->>'role';
    if v_id not in ('resident','courier','police','criminal','retail') then raise exception 'Invalid role' using errcode='22023'; end if;
    if p.wanted or p.jailed_until>v_now then raise exception 'Role unavailable while wanted or in custody' using errcode='22023'; end if;
    update public.gca_game_players set role=v_id,shift_started_at=null,shift_role=null where user_id=u;
    v_event:=public.gca_game_wallet_event(u);
  elsif p_action='outfit' then
    v_id:=p_payload->>'outfit';
    if v_id not in ('street','sport','denim','formal','desert','night') then raise exception 'Invalid outfit' using errcode='22023'; end if;
    update public.gca_game_players set outfit=v_id where user_id=u;
    v_event:=jsonb_build_object('type','notice','text','Outfit updated');
  elsif p_action='move' then
    if jsonb_typeof(p_payload->'x')<>'number' or jsonb_typeof(p_payload->'z')<>'number' or jsonb_typeof(p_payload->'yaw')<>'number'
    then raise exception 'Invalid position' using errcode='22023'; end if;
    v_distance:=sqrt(power((p_payload->>'x')::double precision-p.x,2)+power((p_payload->>'z')::double precision-p.z,2));
    v_dt:=greatest(.08,extract(epoch from (v_now-p.last_move_at)));
    if (p.space is null and (abs((p_payload->>'x')::double precision)>10320 or abs((p_payload->>'z')::double precision)>13135))
       or (p.space is not null and (abs((p_payload->>'x')::double precision)>21 or abs((p_payload->>'z')::double precision)>13))
       or v_distance>35*v_dt+3 then raise exception 'Invalid movement' using errcode='22023'; end if;
    update public.gca_game_players set x=(p_payload->>'x')::double precision,z=(p_payload->>'z')::double precision,
      yaw=((p_payload->>'yaw')::double precision-floor((p_payload->>'yaw')::double precision/6.283185307179586)*6.283185307179586),
      vehicle=(p.space is null and coalesce((p_payload->>'vehicle')::boolean,false)),
      shift_distance=shift_distance+case when shift_started_at is not null then v_distance else 0 end,
      last_move_at=v_now,last_seen_at=v_now where user_id=u;
    if p.space is null and p.job=1 and sqrt(power((p_payload->>'x')::double precision+105,2)+power((p_payload->>'z')::double precision,2))<8 then
      update public.gca_game_players set job=2 where user_id=u;
      perform public.gca_emit_user(u,'bank',public.gca_game_wallet_event(u));
    elsif p.space is null and p.job=2 and sqrt(power((p_payload->>'x')::double precision-105,2)+power((p_payload->>'z')::double precision-105,2))<8 then
      update public.gca_game_players set job=0 where user_id=u;
      update public.gca_wallets set balance=balance+150,updated_at=v_now where user_id=u;
      insert into public.gca_ledger(user_id,amount,label,kind) values(u,150,'Waterfront delivery','delivery');
      perform public.gca_emit_user(u,'bank',public.gca_game_wallet_event(u));
    end if;
    if p.shift_started_at is not null and
      ((p.shift_role='retail' and p.space=p.shift_space and v_now>=p.shift_started_at+interval '60 seconds')
       or (p.shift_role='police' and p.space is null and p.shift_distance+v_distance>=80 and v_now<=p.shift_started_at+interval '120 seconds')) then
      v_amount:=case p.shift_role when 'retail' then 25 else 60 end;
      update public.gca_wallets set balance=balance+v_amount,updated_at=v_now where user_id=u;
      insert into public.gca_ledger(user_id,amount,label,kind) values(u,v_amount,case p.shift_role when 'retail' then 'Retail shift' else 'Police patrol' end,'salary');
      update public.gca_game_players set shift_started_at=null,shift_space=null,shift_role=null,shift_distance=0 where user_id=u;
      perform public.gca_emit_user(u,'bank',public.gca_game_wallet_event(u));
    elsif p.shift_started_at is not null and v_now>p.shift_started_at+case when p.shift_role='police' then interval '120 seconds' else interval '60 seconds' end then
      update public.gca_game_players set shift_started_at=null,shift_space=null,shift_role=null,shift_distance=0 where user_id=u;
    end if;
    perform public.gca_emit_world('state',jsonb_build_object('players',public.gca_game_world_state()));
    return jsonb_build_object('events','[]'::jsonb);
  elsif p_action='chat' then
    v_name:=left(regexp_replace(trim(coalesce(p_payload->>'text','')),'[[:cntrl:]]','','g'),240);
    if v_name='' or (p.last_chat_at is not null and v_now-p.last_chat_at<interval '800 milliseconds') then
      return jsonb_build_object('events','[]'::jsonb);
    end if;
    update public.gca_game_players set last_chat_at=v_now where user_id=u;
    perform public.gca_emit_world('chat',jsonb_build_object('name',p.name,'text',v_name));
    return jsonb_build_object('events',jsonb_build_array(jsonb_build_object('type','chat','name',p.name,'text',v_name)));
  elsif p_action='enter' then
    v_id:=p_payload->>'id';
    if p.space is not null or p.vehicle then raise exception 'Cannot enter from here' using errcode='22023'; end if;
    select property_id into v_item from public.gca_game_properties where property_id=v_id
      and (owner_id=u or (tenant_id=u and tenant_expires_at>v_now));
    if v_item is not null then
      v_x:=case v_id when 'apt-marina-01' then 39 when 'apt-downtown-02' then 112 when 'villa-jumeirah-01' then -97 else 112 end;
      v_z:=case v_id when 'apt-marina-01' then 105 when 'apt-downtown-02' then -105 when 'villa-jumeirah-01' then 105 else 105 end;
      v_space:='property:'||v_id;
    else
      v_x:=case v_id when 'burj-khalifa' then -7.7408 when 'dubai-mall' then 550.81 when 'mall-emirates' then -7434.24 when 'museum-future' then 771.12 when 'dubai-frame' then 2641.35 when 'burj-arab' then -8934.05 else null end;
      v_z:=case v_id when 'burj-khalifa' then .8817 when 'dubai-mall' then -146.72 when 'mall-emirates' then 8868.43 when 'museum-future' then -2436.06 when 'dubai-frame' then -4261.61 when 'burj-arab' then 6236.65 else null end;
      v_space:=v_id;
      if v_x is null then raise exception 'Property access required' using errcode='22023'; end if;
    end if;
    if sqrt(power(p.x-v_x,2)+power(p.z-v_z,2))>8 then raise exception 'Too far from entrance' using errcode='22023'; end if;
    update public.gca_game_players set space=v_space,x=0,z=9,shift_started_at=null where user_id=u;
    v_event:=jsonb_build_object('type','transition','space',v_space,'x',0,'z',9);
  elsif p_action='exit' then
    if p.space is null or p.space='custody' then raise exception 'Cannot exit here' using errcode='22023'; end if;
    v_id:=replace(p.space,'property:','');
    v_x:=case v_id when 'apt-marina-01' then 39 when 'apt-downtown-02' then 112 when 'villa-jumeirah-01' then -97 when 'villa-waterfront-02' then 112
      when 'burj-khalifa' then -7.7408 when 'dubai-mall' then 550.81 when 'mall-emirates' then -7434.24 when 'museum-future' then 771.12 when 'dubai-frame' then 2641.35 when 'burj-arab' then -8934.05 else null end;
    v_z:=case v_id when 'apt-marina-01' then 105 when 'apt-downtown-02' then -105 when 'villa-jumeirah-01' then 105 when 'villa-waterfront-02' then 105
      when 'burj-khalifa' then .8817 when 'dubai-mall' then -146.72 when 'mall-emirates' then 8868.43 when 'museum-future' then -2436.06 when 'dubai-frame' then -4261.61 when 'burj-arab' then 6236.65 else null end;
    if v_x is null then raise exception 'Cannot exit here' using errcode='22023'; end if;
    update public.gca_game_players set space=null,shift_started_at=null,x=v_x,z=v_z where user_id=u;
    v_event:=jsonb_build_object('type','transition','space',null,'x',v_x,'z',v_z);
  elsif p_action='transfer' then
    v_id:=p_payload->>'number';
    select user_id into v_other from public.gca_game_players where player_number::text=v_id and user_id<>u;
    v_amount:=(p_payload->>'amount')::numeric;
    v_request:=(p_payload->>'requestId')::uuid;
    if v_other is null then raise exception 'Player is offline or number not found' using errcode='22023'; end if;
    perform public.gca_transfer_money(v_other,v_amount,v_request);
    v_event:=public.gca_game_wallet_event(u);
    perform public.gca_emit_user(v_other,'notice',jsonb_build_object('text','You received AED '||to_char(v_amount,'FM999999990.00')||' from '||p.name));
    perform public.gca_emit_user(u,'notice',jsonb_build_object('text','Transfer sent'));
    perform public.gca_emit_user(v_other,'bank',public.gca_game_wallet_event(v_other));
  elsif p_action='property-renew-request' then
    v_id:=p_payload->>'id';
    select owner_id into v_other from public.gca_game_properties where property_id=v_id and owner_id is not null and owner_id<>u and tenant_id=u and tenant_expires_at>v_now;
    if v_other is null then raise exception 'Rental unavailable' using errcode='22023'; end if;
    insert into public.gca_rental_requests(property_id,owner_id,tenant_id,expires_at)
      values(v_id,v_other,u,v_now+interval '24 hours')
      on conflict(property_id,tenant_id) do update set requested_at=v_now,expires_at=v_now+interval '24 hours'
      returning id into v_uuid;
    perform public.gca_emit_user(v_other,'notice',jsonb_build_object('text',p.name||' requested to renew a rental'));
    v_event:=jsonb_build_object('type','notice','text','Renewal request sent to landlord');
  elsif p_action='property-renew-answer' then
    v_uuid:=(p_payload->>'requestId')::uuid;
    select property_id,tenant_id into v_id,v_other from public.gca_rental_requests
      where id=v_uuid and owner_id=u and expires_at>v_now for update;
    if not found then raise exception 'Renewal request expired' using errcode='22023'; end if;
    if coalesce((p_payload->>'accept')::boolean,false) then
      select rent_price into v_amount from public.gca_game_properties where property_id=v_id for update;
      select balance into v_balance from public.gca_wallets where user_id=v_other for update;
      if v_balance<v_amount then raise exception 'Tenant has insufficient funds' using errcode='22023'; end if;
      update public.gca_wallets set balance=balance-v_amount,updated_at=v_now where user_id=v_other;
      update public.gca_wallets set balance=balance+v_amount,updated_at=v_now where user_id=u;
      insert into public.gca_ledger(user_id,amount,label,kind) values(v_other,-v_amount,'Rental renewal','rent');
      insert into public.gca_ledger(user_id,amount,label,kind) values(u,v_amount,'Rental income','rent');
      update public.gca_game_properties set tenant_expires_at=greatest(tenant_expires_at,v_now)+interval '30 days' where property_id=v_id;
      perform public.gca_emit_user(v_other,'bank',public.gca_game_wallet_event(v_other));
      perform public.gca_emit_user(v_other,'notice',jsonb_build_object('text','Landlord accepted your renewal'));
    else
      perform public.gca_emit_user(v_other,'notice',jsonb_build_object('text','Landlord declined your renewal'));
    end if;
    delete from public.gca_rental_requests where id=v_uuid;
    v_event:=jsonb_build_object('type','notice','text',case when coalesce((p_payload->>'accept')::boolean,false) then 'Renewal accepted' else 'Renewal declined' end);
  elsif p_action='pos-create' then
    if p.role<>'retail' or p.space is null or p.space='custody' then raise exception 'POS unavailable' using errcode='22023'; end if;
    select user_id into v_other from public.gca_game_players
      where player_number::text=p_payload->>'number' and user_id<>u and space=p.space and last_seen_at>v_now-interval '60 seconds'
        and sqrt(power(x-p.x,2)+power(z-p.z,2))<=8;
    if v_other is null then raise exception 'POS requires a nearby customer in this shop' using errcode='22023'; end if;
    v_item:=p_payload->>'item';v_amount:=case v_item when 'coffee' then 12 when 'meal' then 30 when 'souvenir' then 45 else null end;
    if v_amount is null then raise exception 'Item unavailable' using errcode='22023'; end if;
    if exists(select 1 from public.gca_game_invoices where state='pending' and expires_at>v_now and (merchant_id in (u,v_other) or customer_id in (u,v_other)))
      then raise exception 'Invoice already pending' using errcode='22023'; end if;
    insert into public.gca_game_invoices(merchant_id,customer_id,item_id,item_name,amount,space,expires_at)
      values(u,v_other,v_item,case v_item when 'coffee' then 'Coffee' when 'meal' then 'Lunch' else 'City souvenir' end,v_amount,p.space,v_now+interval '30 seconds') returning id into v_uuid;
    perform public.gca_emit_user(v_other,'invoice',jsonb_build_object('id',v_uuid,'merchant',p.name,'item',case v_item when 'coffee' then 'Coffee' when 'meal' then 'Lunch' else 'City souvenir' end,'amount',v_amount));
    v_event:=jsonb_build_object('type','notice','text','Checkout sent. Waiting for customer approval.');
  elsif p_action='pos-answer' then
    v_uuid:=(p_payload->>'id')::uuid;
    select merchant_id,customer_id,amount,item_id into v_other,v_uuid,v_amount,v_item
      from public.gca_game_invoices where id=(p_payload->>'id')::uuid and customer_id=u and state='pending' and expires_at>v_now for update;
    if not found then raise exception 'Invoice expired' using errcode='22023'; end if;
    if coalesce((p_payload->>'accept')::boolean,false) then
      select balance into v_balance from public.gca_wallets where user_id=u for update;
      if v_balance<v_amount then raise exception 'Insufficient funds' using errcode='22023'; end if;
      update public.gca_wallets set balance=balance-v_amount,updated_at=v_now where user_id=u;
      update public.gca_wallets set balance=balance+v_amount,updated_at=v_now where user_id=v_other;
      update public.gca_game_players set inventory=inventory||jsonb_build_object(v_item,coalesce((inventory->>v_item)::integer,0)+1) where user_id=u;
      insert into public.gca_ledger(user_id,amount,label,kind) values(u,-v_amount,'Shop checkout','shop');
      insert into public.gca_ledger(user_id,amount,label,kind) values(v_other,v_amount,'Shop sale','shop');
      update public.gca_game_invoices set state='paid' where id=(p_payload->>'id')::uuid;
      perform public.gca_emit_user(v_other,'bank',public.gca_game_wallet_event(v_other));
      perform public.gca_emit_user(v_other,'notice',jsonb_build_object('text','Customer paid the invoice'));
      v_event:=public.gca_game_wallet_event(u);
    else
      update public.gca_game_invoices set state='declined' where id=(p_payload->>'id')::uuid;
      perform public.gca_emit_user(v_other,'notice',jsonb_build_object('text','Checkout declined'));
      v_event:=jsonb_build_object('type','notice','text','Checkout declined');
    end if;
  elsif p_action='purchase' then
    if p.space is null or p.space='custody' then raise exception 'Shop purchase unavailable' using errcode='22023'; end if;
    v_item:=p_payload->>'item';
    v_amount:=case v_item when 'coffee' then 12 when 'meal' then 30 when 'souvenir' then 45 else null end;
    if v_amount is null then raise exception 'Item unavailable' using errcode='22023'; end if;
    select balance into v_balance from public.gca_wallets where user_id=u for update;
    if v_balance<v_amount then raise exception 'Insufficient funds' using errcode='22023'; end if;
    update public.gca_wallets set balance=balance-v_amount,updated_at=v_now where user_id=u;
    update public.gca_game_players set inventory=inventory||jsonb_build_object(v_item,coalesce((inventory->>v_item)::integer,0)+1) where user_id=u;
    insert into public.gca_ledger(user_id,amount,label,kind) values(u,-v_amount,'Shop purchase','shop');
    v_event:=public.gca_game_wallet_event(u);
  elsif p_action='property-acquire' then
    v_id:=p_payload->>'id';v_mode:=p_payload->>'mode';
    select buy_price,city_rent,owner_id into v_amount,v_balance,v_other from public.gca_game_properties where property_id=v_id for update;
    if not found or v_mode not in ('buy','rent') then raise exception 'Property not found' using errcode='22023'; end if;
    if v_other is not null and v_other<>u then raise exception 'Property already owned' using errcode='22023'; end if;
    v_amount:=case when v_mode='buy' then v_amount else v_balance end;
    select balance into v_balance from public.gca_wallets where user_id=u for update;
    if v_balance<v_amount then raise exception 'Insufficient funds' using errcode='22023'; end if;
    update public.gca_wallets set balance=balance-v_amount,updated_at=v_now where user_id=u;
    insert into public.gca_ledger(user_id,amount,label,kind) values(u,-v_amount,case when v_mode='buy' then 'Property purchase' else 'Property rent' end,'property');
    if v_mode='buy' then update public.gca_game_properties set owner_id=u,tenant_id=null,tenant_expires_at=null,updated_at=v_now where property_id=v_id;
    else update public.gca_game_properties set tenant_id=u,tenant_expires_at=v_now+interval '30 days',updated_at=v_now where property_id=v_id; end if;
    v_event:=public.gca_game_wallet_event(u);
  elsif p_action='property-set-price' then
    update public.gca_game_properties set rent_price=least(1000000,greatest(0,(p_payload->>'price')::numeric)),updated_at=v_now
      where property_id=p_payload->>'id' and owner_id=u;
    if not found then raise exception 'Property not owned' using errcode='22023'; end if;
    v_event:=jsonb_build_object('type','notice','text','Rent price updated');
  elsif p_action='job-start' then
    if p.role<>'courier' then raise exception 'Choose courier role first' using errcode='22023'; end if;
    update public.gca_game_players set job=1 where user_id=u and job=0;
    v_event:=public.gca_game_wallet_event(u);
  elsif p_action='shift' then
    if not ((p.role='retail' and p.space is not null and p.space<>'custody') or (p.role='police' and p.space is null))
    then raise exception 'Shift unavailable here' using errcode='22023'; end if;
    update public.gca_game_players set shift_started_at=v_now,shift_space=space,shift_role=role,shift_distance=0 where user_id=u;
    v_event:=jsonb_build_object('type','notice','text','Shift started');
  elsif p_action='rob' then
    if p.role<>'criminal' or p.space is null or p.space='custody' or p.wanted or (p.last_crime_at is not null and v_now-p.last_crime_at<interval '3 minutes')
    then raise exception 'Robbery unavailable' using errcode='22023'; end if;
    update public.gca_game_players set wanted=true,last_crime_at=v_now where user_id=u;
    update public.gca_wallets set balance=balance+80,updated_at=v_now where user_id=u;
    insert into public.gca_ledger(user_id,amount,label,kind) values(u,80,'Shop robbery','crime');
    v_event:=public.gca_game_wallet_event(u);
  elsif p_action='bail' then
    select balance into v_balance from public.gca_wallets where user_id=u for update;
    if not p.wanted and p.jailed_until is null then raise exception 'No bail due' using errcode='22023'; end if;
    if v_balance<100 then raise exception 'Insufficient funds' using errcode='22023'; end if;
    update public.gca_wallets set balance=balance-100,updated_at=v_now where user_id=u;
    insert into public.gca_ledger(user_id,amount,label,kind) values(u,-100,'Bail','bail');
    update public.gca_game_players set wanted=false,jailed_until=null,space=null where user_id=u;
    v_event:=public.gca_game_wallet_event(u);
  elsif p_action in ('dial','answer','hangup') then
    if p_action='dial' then
      select user_id into v_other from public.gca_game_players where player_number::text=p_payload->>'number' and last_seen_at>v_now-interval '60 seconds';
      if v_other is null or v_other=u or p.call_id is not null then raise exception 'Player offline or line busy' using errcode='22023'; end if;
      if exists(select 1 from public.gca_game_players where user_id=v_other and call_id is not null) then raise exception 'Line busy' using errcode='22023'; end if;
      insert into public.gca_game_calls(caller_id,callee_id) values(u,v_other) returning * into v_call;
      update public.gca_game_players set call_id=v_call.id where user_id in (u,v_other);
      perform public.gca_emit_user(u,'call-ringing',jsonb_build_object('callId',v_call.id,'number',(select player_number::text from public.gca_game_players where user_id=v_other),'name',(select name from public.gca_game_players where user_id=v_other)));
      perform public.gca_emit_user(v_other,'call-incoming',jsonb_build_object('callId',v_call.id,'number',p.player_number::text,'name',p.name));
      return jsonb_build_object('events',jsonb_build_array(jsonb_build_object('type','call-ringing','callId',v_call.id,'number',(select player_number::text from public.gca_game_players where user_id=v_other),'name',(select name from public.gca_game_players where user_id=v_other))));
    end if;
    v_uuid:=(p_payload->>'callId')::uuid;
    select * into v_call from public.gca_game_calls where id=v_uuid and u in (caller_id,callee_id) for update;
    if not found then raise exception 'Call not found' using errcode='22023'; end if;
    if p_action='answer' and v_call.callee_id=u and v_call.state='ringing' and v_call.expires_at>v_now then
      update public.gca_game_calls set state='active',answered_at=v_now where id=v_call.id;
      perform public.gca_emit_user(v_call.caller_id,'call-active',jsonb_build_object('callId',v_call.id));
      v_event:=jsonb_build_object('type','call-active','callId',v_call.id);
    else
      update public.gca_game_calls set state='ended',ended_at=v_now where id=v_call.id;
      update public.gca_game_players set call_id=null where user_id in (v_call.caller_id,v_call.callee_id);
      perform public.gca_emit_user(case when u=v_call.caller_id then v_call.callee_id else v_call.caller_id end,'call-ended',jsonb_build_object('callId',v_call.id,'reason','Call ended'));
      v_event:=jsonb_build_object('type','call-ended','callId',v_call.id,'reason','Call ended');
    end if;
  elsif p_action='reset' then
    update public.gca_game_players set space=null,x=8,z=12,yaw=0,vehicle=false,shift_started_at=null where user_id=u;
    v_event:=jsonb_build_object('type','transition','space',null,'x',8,'z',12);
  elsif p_action='arrest' then
    if p.role<>'police' or p.jailed_until>v_now then raise exception 'Arrest unavailable' using errcode='22023'; end if;
    v_other:=(p_payload->>'id')::uuid;
    select player_number into v_id from public.gca_game_players s where s.user_id=v_other and s.user_id<>u
      and s.wanted and s.jailed_until is null and s.space is not distinct from p.space
      and not s.vehicle and not p.vehicle and sqrt(power(s.x-p.x,2)+power(s.z-p.z,2))<8 for update;
    if not found then raise exception 'Suspect is not close enough' using errcode='22023'; end if;
    update public.gca_game_players set jailed_until=v_now+interval '120 seconds',space='custody',x=0,z=9,vehicle=false,shift_started_at=null where user_id=v_other;
    perform public.gca_emit_user(v_other,'transition',jsonb_build_object('space','custody','x',0,'z',9));
    perform public.gca_emit_user(v_other,'bank',public.gca_game_wallet_event(v_other));
    v_event:=jsonb_build_object('type','notice','text','Suspect arrested');

  elsif p_action in ('pos-create','pos-answer','property-renew-request','property-renew-answer') then
    raise exception 'Action validation is still required' using errcode='22023';
  else
    v_event:=jsonb_build_object('type','notice','text','Action unavailable');
  end if;

  if v_event is not null then
    v_events:=jsonb_build_array(v_event);
    if v_event->>'type' in ('bank','wallet') then perform public.gca_emit_user(u,'bank',v_event); end if;
  end if;
  perform public.gca_emit_world('state',jsonb_build_object('players',public.gca_game_world_state()));
  return jsonb_build_object('events',v_events);
end;
$function$;

revoke all on function public.gca_game_wallet_event(uuid) from public,anon,authenticated;
revoke all on function public.gca_game_world_state() from public,anon,authenticated;
revoke all on function public.gca_game_action(text,jsonb) from public,anon;
grant execute on function public.gca_game_action(text,jsonb) to authenticated;
