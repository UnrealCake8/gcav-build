# Grand Chamak Auto (GCAV)

GCAV is a browser city game with walking, driving, mapped Dubai roads, city-life jobs, property, shopping, player transfers, multiplayer chat and private push-to-talk calls.

## Local development

Requirements: Node.js 22 or newer.

```sh
npm ci
cp .env.example .env
```

Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `.env`, then run:

```sh
npm start
```

Open `http://localhost:3000`. The local Node process serves static game files and forwards the authenticated API routes; it does not host multiplayer WebSockets. Enter the city in two browser sessions to check multiplayer. Supabase Auth must allow anonymous sign-in for guest play.

`npm run build` builds `dist/game.js`; `npm test` runs the local Node test suite. The SQL migration lives in `supabase/migrations/`.

## Online architecture

- Supabase Auth provides guest sessions that can be upgraded to email accounts. The same user ID owns the player profile and wallet across sessions.
- Supabase Realtime uses authenticated private channels for live movement, room chat, world/player events and call audio/signaling. Live movement is display state; periodic movement checkpoints and all economy/game actions go through authenticated API routes, where Postgres validates positions, proximity, roles, balances, property state, invoices, calls, jobs and Salik before durable changes.
- Voice clips are binary, transient Broadcasts. They are not uploaded to Storage or replayed. The receiver acknowledges after accepting a clip into its playback queue, and the sender deletes its in-memory pending copy on acknowledgement, call end, disconnect or timeout.
- Economy changes and transfers are written with the ledger in Postgres transactions. Retriable actions carry an idempotency UUID; reusing it with a different payload is rejected.
- The persistent Node WebSocket endpoint, local JSON wallets and HTTP voice-clip endpoints have been retired. Vercel serverless functions handle request/response APIs only; Supabase Realtime provides the persistent multiplayer transport.

The registration table is preserved. The game uses `gca_profiles`, private `gca_wallets` and `gca_ledger` tables plus the game-state tables created by the migrations. Never put a Supabase secret/service-role key in a browser bundle or `.env` used by the local static server.

## Game

WASD moves or drives. E enters/exits/interacts. P opens the phone. Space brakes. Drag looks around; C recentres the camera. Touch users can move with the joystick and look by dragging the world.

The city uses OpenStreetMap road and building snapshots for parts of Dubai, five logical Salik gate locations, and geographic landmark anchors. Building rendering uses mapped OSM footprints and the named landmark models; there are no procedurally invented filler buildings. The current footprint snapshot contains 95 buildings between 55.1968769–55.2841935 E and 25.1155707–25.2027428 N, so large parts of the road map still have no mapped buildings. Interiors, traffic and many road elevations remain stylised or incomplete; this is not a complete Dubai reconstruction.

Phone apps include Maps, Real Estate, Messages, Jobs, Bank, Account, hPay, Garage, Phone, Outfits and City Life. Jobs and role actions are persisted with the player. Shop checkout requires customer approval; player transfers, purchases, salaries, property payments, bail, robbery and tolls are validated and recorded server-side.

For push-to-talk, answer a player call, hold Talk or V, speak, then release. Microphone access needs HTTPS or localhost. The browser must support a compatible MediaRecorder codec. Audio is not end-to-end encrypted: the recipient receives it through Supabase Realtime. It is transient and never stored as a clip object or replay row.

## Production

The intended deployment is the existing Vercel `gcav-build` project. Keep it on production-only deployment settings; do not rely on Vercel preview deployments for validation. The existing `gcav-site` project is separate and must remain untouched.

Required Vercel environment variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Only the publishable key is exposed to the browser. Authenticated API routes use the caller’s access token and the database enforces authorization. Never configure a service-role or secret key in a `NEXT_PUBLIC_` variable.

## Tests

```sh
npm ci
npm test
npm run build
```

The local tests cover game API authentication and action validation, plus geography, navigation, city life, phone UI and toll calculations. They do not replace a live two-player Realtime/microphone test.
