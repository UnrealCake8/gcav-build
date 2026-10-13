-- Realtime voice uses the existing server-issued random call UUID as a short-lived capability.
-- The message payloads are client-to-client broadcasts and are never persisted or replayed.
create policy "gcav authenticated call topic read"
on realtime.messages
for select
to authenticated
using (realtime.topic() ~ '^gcav:call:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

create policy "gcav authenticated call topic publish"
on realtime.messages
for insert
to authenticated
with check (realtime.topic() ~ '^gcav:call:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
