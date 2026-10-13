# Supabase Realtime migration plan

## Target

Keep guest play by creating a Supabase anonymous Auth session before a player joins the online world. Use that user ID as the durable player identity. When a guest adds an email identity, link it to the same Supabase user so the wallet keeps the same owner.

Use Supabase Realtime for ephemeral online state:
- Presence identifies online sessions.
- Private, per-player channels publish movement and room chat. A user can publish only to their own topic; other authenticated players can subscribe.
- A private call channel carries voice clips. During this first slice, the existing game server issues an unguessable random call UUID only to the two call participants; the UUID is the short-lived channel capability. The later call-signaling migration should move membership checks to a database call row.

Use Vercel API routes and database RPCs for state changes that need validation: transfers, purchases, jobs, Salik, property and inventory. Realtime messages are notifications and live snapshots; they do not grant money or change authoritative game state.

## Voice clips

Send the recorded bytes in an ephemeral binary Broadcast on the private call channel. After the recipient has received the full bytes and accepted them into its playback queue, it sends a `voice-received` acknowledgement with the clip ID. The sender then removes that clip from its pending in-memory queue. Clear pending clips on call end, disconnect, or timeout. The voice path uses anonymous Supabase Auth for guests; creating an email account upgrades that same user identity.

Do not upload clips to Storage or use Broadcast Replay. Client Broadcast is transient; no clip row or stored object remains to delete. The acknowledgement is application-level: Realtime's `ack` option confirms receipt by the Realtime server, not by the other player.

## Existing WebSocket messages to migrate

| Current message group | Destination |
| --- | --- |
| `state`, `move`, `outfit`, `enter`, `exit`, `reset` | Presence and per-player Broadcast for live state; validated movement or room transitions through game APIs where needed |
| `chat` | Per-player Broadcast, with the sender identity taken from the publishing topic |
| `dial`, `answer`, `hangup` | Authenticated call API plus a participant-only private call channel |
| `voice-clip` | Binary Broadcast and recipient acknowledgement; no HTTP clip endpoint |
| `wallet`, `bank`, `transfer`, `purchase`, `pos-*`, `property-*`, `shift`, `job-*`, `salik`, `arrest`, `bail`, `rob` | Vercel API + server-side Postgres validation and ledger/state writes |

## Current implementation on `plan/supabase-realtime-migration`

- Supabase guest sessions use anonymous Auth; email account creation upgrades the same identity.
- Voice media uses private Realtime Broadcast channels with application-level receiver acknowledgement.
- Realtime never stores or replays voice messages. Existing Node HTTP clip routes remain only as legacy code while clients migrate.
- Call setup/signaling, movement, room chat, world snapshots, and game actions still use the persistent WebSocket server. Economy actions remain server-validated there until their API/database replacements are ready.
- The Realtime policy currently uses the random call UUID as a short-lived capability. Replace this with participant-row authorization when call signaling moves to the API/database.

## Rollout order

1. Add anonymous Supabase sessions and private-channel RLS without changing the live connection.
2. Move presence, movement snapshots and room chat to Realtime.
3. Move call signaling and voice clips to Realtime; verify recipient acknowledgement clears pending audio.
4. Move every remaining state/economy action behind authenticated APIs and Postgres transactions.
5. Remove the player-facing WebSocket endpoint and local JSON wallet only after all actions have a tested replacement.

Keep the old path during the transition. Do not expose a client Broadcast as the authority for money, property ownership, or jobs.
