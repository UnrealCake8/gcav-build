# GCAV multiplayer and wallet architecture

## Current transport map

| Feature | Path | Authority / persistence |
| --- | --- | --- |
| Join, player identity and initial snapshot | Authenticated `/api/game` action; private Realtime user/world channels | Supabase Auth user ID and Postgres game tables |
| Live movement and room chat | Authenticated per-player Supabase Realtime Broadcast channels | Receivers use the player identity and name from Postgres snapshots; live coordinates are display state only |
| Movement checkpoints, outfit, interior transitions and reset | Authenticated `/api/game`; Postgres publishes world snapshots over private Realtime Broadcast | Movement checkpoints, transitions and all proximity/economy checks are validated in Postgres |
| Calls | Authenticated `/api/game`; private per-user Realtime Broadcast; call-topic RLS checks database participant rows | Call participant/state rows in Postgres |
| Voice clips | Binary Broadcast in the active private call topic; receiver sends `voice-received` | Bytes are transient; sender drops its pending in-memory copy after acknowledgement or timeout |
| Wallet, transfer, toll, job, shop, POS and property | Authenticated `/api/game` and dedicated account routes; Postgres RPCs | Atomic wallet/ledger/state changes in Postgres |

The app no longer has a `/multiplayer` Node WebSocket endpoint, a JSON wallet store, or `/api/clips` upload/download routes. Vercel handles only bounded request/response API calls. Supabase Realtime supplies the managed persistent WebSocket transport for every former live WebSocket feature: movement, chat, world/player events, call signaling and voice clips.

## Security and retries

All game actions require a valid Supabase access token. Sensitive tables have RLS enabled and no direct client write grants. `gca_game_action` checks `auth.uid()`, reads the caller’s state from Postgres, validates the action, then commits game state and ledger changes together. Private call topics are authorized against the stored caller/callee IDs and call state. Clients cannot publish authoritative world state or economic events.

Economy, role, job, chat and call actions carry a UUID request key. The database stores the request, exact payload and response in the same transaction as the action. An identical retry returns the stored response; the same key with a changed action or payload fails. Transfers additionally use the ledger's unique request ID so a retry cannot debit twice.

## Voice delivery

Voice clips use a short-lived private call topic and no Storage or replay. The receiver acknowledges after the clip has been accepted into its playback queue. The sender removes its pending byte buffer when that acknowledgement arrives. Pending bytes also clear when the call/channel ends or the timeout expires. Realtime's server acknowledgement only confirms that Realtime accepted a broadcast; `voice-received` is the recipient-level acknowledgement.

## Local checks

Run `npm test` and `npm run build` from the cloned repository. The local server in `server/index.js` serves static files and runs the same API handlers for local work; it does not create a persistent WebSocket server. Production validation belongs on the `gcav-build` production deployment after review. Do not depend on Vercel previews.
