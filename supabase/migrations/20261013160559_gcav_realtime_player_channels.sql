-- Player broadcasts carry public, ephemeral movement and chat only. Economy
-- actions and authoritative movement checkpoints remain server-side RPCs.
create policy "gcav authenticated player stream read"
on realtime.messages
for select to authenticated
using (
  extension = 'broadcast'
  and topic ~ '^gcav:player:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

create policy "gcav own player stream publish"
on realtime.messages
for insert to authenticated
with check (
  extension = 'broadcast'
  and topic = 'gcav:player:' || (select auth.uid())::text
);
