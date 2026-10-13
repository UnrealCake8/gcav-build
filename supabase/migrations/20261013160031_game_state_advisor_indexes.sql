-- Make the intended private-only access model explicit for server-managed tables.
create policy "gcav no direct player state access"
on public.gca_game_players for all to anon, authenticated
using (false) with check (false);
create policy "gcav no direct property access"
on public.gca_game_properties for all to anon, authenticated
using (false) with check (false);
create policy "gcav no direct rental request access"
on public.gca_rental_requests for all to anon, authenticated
using (false) with check (false);
create policy "gcav no direct invoice access"
on public.gca_game_invoices for all to anon, authenticated
using (false) with check (false);
create policy "gcav no direct request cache access"
on public.gca_game_requests for all to anon, authenticated
using (false) with check (false);

-- Cover the foreign keys used by participant, invoice, property, and rental lookups.
create index if not exists gca_game_calls_callee_state_idx
  on public.gca_game_calls(callee_id,caller_id,state);
create index if not exists gca_game_calls_lifecycle_idx
  on public.gca_game_calls(state,expires_at);
create index if not exists gca_game_invoices_customer_state_idx
  on public.gca_game_invoices(customer_id,state,expires_at);
create index if not exists gca_game_invoices_merchant_state_idx
  on public.gca_game_invoices(merchant_id,state,expires_at);
create index if not exists gca_game_properties_owner_idx
  on public.gca_game_properties(owner_id,property_id);
create index if not exists gca_game_properties_tenant_idx
  on public.gca_game_properties(tenant_id,property_id);
create index if not exists gca_rental_requests_owner_idx
  on public.gca_rental_requests(owner_id,expires_at);
create index if not exists gca_rental_requests_tenant_idx
  on public.gca_rental_requests(tenant_id,property_id);

-- Cache auth.uid() once per Realtime authorization statement, not per row.
drop policy if exists "gcav authenticated own game read" on realtime.messages;
create policy "gcav authenticated own game read"
on realtime.messages for select to authenticated
using (realtime.topic()='gcav:user:'||(select auth.uid())::text and realtime.messages.extension='broadcast');

drop policy if exists "gcav call participant read" on realtime.messages;
create policy "gcav call participant read"
on realtime.messages for select to authenticated
using (
  realtime.messages.extension='broadcast'
  and realtime.topic() ~ '^gcav:call:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.gca_game_calls c
    where c.id::text=split_part(realtime.topic(),':',3)
      and (select auth.uid()) in (c.caller_id,c.callee_id)
      and c.state in ('ringing','active')
  )
);

drop policy if exists "gcav call participant publish" on realtime.messages;
create policy "gcav call participant publish"
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension='broadcast'
  and realtime.topic() ~ '^gcav:call:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.gca_game_calls c
    where c.id::text=split_part(realtime.topic(),':',3)
      and (select auth.uid()) in (c.caller_id,c.callee_id)
      and c.state='active'
  )
);

drop policy if exists "gcav call participant lookup" on public.gca_game_calls;
create policy "gcav call participant lookup"
on public.gca_game_calls for select to authenticated
using ((select auth.uid()) in (caller_id,callee_id));
