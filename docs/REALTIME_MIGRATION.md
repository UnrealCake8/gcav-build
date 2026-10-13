# Supabase Realtime migration plan

## Target

Keep guest play by creating a Supabase anonymous Auth session before a player joins the online world. Use that user ID as the durable player identity. When a guest adds an email identity, link it to the same Supabase user so the wallet keeps the same owner.

Use Supabase Realtime for ephemeral online state:
- Presence identifies online sessions.
- Private, per-player channels publish movement and room chat. A user can publish only to their own topic; other authenticated players can subscribe.
- A private call channel carries call signaling and voice clips. A database call row identifies the two permitted participants.

Use Vercel API routes and database RPCs for state changes that need validation: transfers, purchases, jobs, Salik, property and inventory. Realtime messages are notifications and live snapshots; they do not grant money or change authoritative game state.

## Voice clips

Send the recorded `ArrayBuffer` as a binary Broadcast on the private call channel. After the recipient has received the full bytes and accepted them into its playback queue, it sends a `voice-received` acknowledgement with the clip ID. The sender then removes that clip from its pending in-memory queue. Clear pending clips on call end, disconnect, or timeout.

Do not upload clips to Storage or use Broadcast Replay. Client Broadcast is transient; no clip row or stored object remains to delete. The acknowledgement is application-level: Realtime's `ack` option confirms receipt by the Realtime server, not by the other player.

## Existing WebSocket messages to migrate

| Current message group | Destination |
| --- | --- |
| `state`, `move`, `outfit`, `enter`, `exit`, `reset` | Presence and per-player Broadcast for live state; validated movement or room transitions through game APIs where needed |
| `chat` | Per-player Broadcast, with the sender identity taken from the publishing topic |
| `dial`, `answer`, `hangup` | Authenticated call API plus a participant-only private call channel |
| `voice-clip` | Binary Broadcast and recipient acknowledgement; no HTTP clip endpoint |
| `wallet`, `bank`, `transfer`, `purchase`, `pos-*`, `property-*`, `shift`, `job-*`, `salik`, `arrest`, `bail`, `rob` | Vercel API + server-side Postgres validation and ledger/state writes |

## Rollout order

1. Add anonymous Supabase sessions and private-channel RLS without changing the live connection.
2. Move presence, movement snapshots and room chat to Realtime.
3. Move call signaling and voice clips to Realtime; verify recipient acknowledgement clears pending audio.
4. Move every remaining state/economy action behind authenticated APIs and Postgres transactions.
5. Remove the player-facing WebSocket endpoint and local JSON wallet only after all actions have a tested replacement.

Keep the old path during the transition. Do not expose a client Broadcast as the authority for money, property ownership, or jobs.
