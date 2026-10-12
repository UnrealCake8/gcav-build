# Grand Chamak Auto — browser build

Procedural browser city with connected Waterfront and Downtown Dubai-inspired districts. Includes walking/driving, a delivery mission, phone apps, multiplayer presence, room text chat and private push-to-talk calls.

## Run on Mac

Install Node.js 22 or newer and Git, then:

```bash
git clone https://github.com/UnrealCake8/gcav-build.git
cd gcav-build
npm ci
npm run build
cp .env.example .env
npm start
```

Open http://localhost:3000. Enter the city, then open Phone to see your session number. Open another browser tab and enter the city as another player; use Phone to call its number. Answer, hold Talk (or V) to speak, then release. The other player hears your speech automatically after upload. Your computer does not need Asterisk, SIP, TURN, Caddy or a framework.

For internet access behind CGNAT, follow [Mac hosting instructions](docs/MAC_HOSTING.md). One Cloudflare Tunnel route to port 3000 handles the website, WebSocket multiplayer and audio uploads.

## Controls

WASD: move/drive. E: enter/exit the white car. P: phone. Space: brake. Drag: camera. C / Camera: recenter behind your avatar or car. Scroll or pinch with two fingers on the world: zoom. Forward follows the camera on foot; the driving camera gently follows the car after you stop looking around. Walls shorten the camera distance. On touch screens, an analogue joystick controls walking/driving; a separate Brake button stops the car. Drag the world with another finger to move the camera. Jobs → Waterfront delivery triggers a scripted text mission call. Collect the green marker then reach the amber marker for AED 150.

## Geographic roads and Salik

The game now uses a bundled OpenStreetMap snapshot of 241 regional highway/trunk road pieces, including Sheikh Zayed Road and Al Khail Road. Road centre-lines, names and refs come from actual coordinates, compressed to 25% horizontal scale for driving. Follow the Downtown access road from the starting plaza onto the highway network. The minimap follows you; Phone → Maps shows the full snapshot. Orange dots are Salik gantries.

Ten OSM gantry nodes represent five named gate locations: Al Barsha, Al Safa North/South, Al Garhoud Bridge and Business Bay Crossing. Driving through them automatically debits the in-game bank. Peak, off-peak, free-hours, VAT and the linked Al Safa rule use the server's Asia/Dubai clock. See [data sources and limitations](docs/DATA_SOURCES.md). Buildings and terrain are still procedural, and interchanges are flattened; this is a geographic backbone rather than a finished Dubai reconstruction.

Walking uses distance-driven arm/leg swings, knee bends and a small body bob on local and remote avatars. Stopping or walking into a building settles to idle; entering a car pauses the gait. Repeated roads/building details use instanced meshes and textures are generated locally.

## In-game bank

The server grants a new anonymous wallet AED 500 of game credit. Salik deductions and AED 150 delivery rewards are calculated on the server. Bank shows a dated ledger, gate name, direction and VAT breakdown. The wallet may go negative for tolls; this is a game overdraft, not real financial behaviour.

When launched with `npm start`, wallets are saved in `data/wallets.json`, including job stage and linked-gate history. Back up this folder and keep it private. A wallet recovery key is kept in browser localStorage. Tabs in the same browser share that wallet; a private window or another browser creates a separate player wallet. Clearing localStorage loses access to the old wallet. This is anonymous session recovery, not an account/login system. Names are unverified and new-wallet welcome credit can be abused until proper accounts are added.

`SALIK_RAMADAN` and `SALIK_SPECIAL_DAY` in `.env` let the host select exceptional schedules. Restart after changing them. These are in-game deductions only; the game does not connect to real banks or Salik accounts.

To refresh road data on a Mac with Python 3: `python3 scripts/import-dubai.py`, review the snapshot changes, then `npm run build`. The importer also accepts saved raw inputs using `--roads-json` and `--nodes-json`. Geography can change; do not refresh a live server without testing the new snapshot.

## Outfits

Choose one of six outfits before entering the city, or use Phone → Outfits while playing. Choices persist on this device and sync to every connected player, including players joining later. Outfits include different colours, caps, a suit tie and a desert robe.

## Phone behaviour

- Each connected session gets a number (101, 102…). Numbers are temporary and reset when the server restarts.
- A call rings the chosen online player. Answering creates a private conversation.
- Hold the floating Talk button (or V on desktop), speak for up to 15 seconds, then release. Speech uploads and plays automatically in order on the other player’s device, even with the phone closed. This is delayed push-to-talk, not live streaming.
- The server sends the clip notification only to the recipient. Audio retrieval requires the recipient's connection token. Tokens stay in browser memory.
- Recordings are stored temporarily in server memory, with a 1 MB upload limit and 32 MB total storage cap. They expire after 5 minutes and are removed when the call ends/disconnects or the server restarts. Received speech is queued in browser memory; hanging up stops playback and clears the queue.
- Dial/Answer unlocks browser audio. If the browser suspends playback, press Enable call audio. Browser codec support can differ: test the intended browsers together. Chrome on both ends is a practical first test.
- The first Talk action requests microphone permission. HTTPS (or localhost) is required. Recordings are not end-to-end encrypted: your server receives the clips over HTTPS and can access them while stored.
- No offline calls or offline voice messages in this version. Reconnecting assigns a new number and returns the player to spawn.

## Architecture

`server/index.js` serves the built website, `/multiplayer` WebSockets, and `/api/clips` HTTP endpoints in a single Node.js process. `src/game.js` renders with Three.js; `src/phone.js` handles call UI, recording and playback. Edit `src/`, `dist/index.html` and `dist/style.css`, then rebuild. Do not edit generated `dist/game.js`.

The server binds to 127.0.0.1 by default. `ALLOWED_ORIGINS` controls WebSocket upgrades and audio uploads. Audio requests use per-session bearer tokens. No public recording URLs, filesystem uploads or PBX credentials are used.

## Validation

`npm test` exercises multiplayer sync/chat, private call routing, recipient-only downloads, third-player denial, upload size/type limits, expiration, disconnect cleanup and origin rejection. Real microphone recording, graphics performance and browser autoplay require manual browser verification.

## Vercel option

`vercel.json` builds and publishes the static website. The Node server must run separately; enter its `wss://HOST/multiplayer` URL in Settings. Audio endpoints must be on that same server host. This build does not enable cross-origin HTTP audio access: to split Vercel and the server, add a restricted CORS policy for the Vercel origin first. The recommended Mac deployment keeps everything on one origin.

## Current limits

This is an early playable foundation, not a finished production game. Session names are unverified; phone numbers are not account identities. Bank and delivery stages are server-owned and saved locally on the host. Movement and vehicle flags are still supplied by clients, so a modified client can cheat movement/tolls. Movement has basic speed/bounds guards, not authoritative physics. Players use individual white cars; other players see a blue representation. For wider release, add persistent accounts, authoritative physics and blocking/reporting/moderation. The server validates audio MIME labels/bytes, not decoded audio duration; the 15-second duration cap is enforced by the client.

## Dubai city life update

A server-shared 24-minute day/night cycle starts at 09:00 when the server boots. The sky, sunlight and emissive street lights/windows change over time. The phone shows accelerated **game time**; Salik still uses actual Dubai time, not this cycle.

Phone **Maps** lists six geographic landmark anchors: Burj Khalifa, Dubai Mall, Mall of the Emirates, Museum of the Future, Dubai Frame and Burj Al Arab. Set a waypoint, travel there, approach the green entrance ring on foot and press **E / Interact**. Interior rooms are shared by players visiting the same landmark. Press Interact away from the exit to open shops; approach the exit ring to leave. Buildings have wider spacing, parking pads, local access lanes and street lamps.

Phone **City Life** chooses a persistent role:

| Role | Gameplay |
| --- | --- |
| Civilian | Explore, meet players, buy items and transfer money. |
| Courier | Existing parcel jobs pay AED 150 per completed delivery. |
| Shop worker | Stay in a shop for a 60-second shift to earn AED 25. POS sells coffee, lunch or souvenirs to another nearby player. |
| Police | Start a 120-second patrol and travel at least 80 game metres to earn AED 60. Arrest wanted players on foot within 8 game metres in the same space. |
| Criminal | Rob a shop for AED 80; creates a persistent wanted flag and a 180-second robbery cooldown. |

An arrested player enters custody for 120 real seconds, or pays AED 100 bail in City Life. Insufficient funds never produce a bail debit. Custody persists across reconnects, expires automatically, and cannot be escaped with Reset or a role change. These are fictional game rules, not Dubai law. Police do not receive cash for arrests.

**POS:** shop worker enters the customer's phone number and selects a catalog item. Both players must be in the same shop within 8 game metres. The customer must approve the 30-second checkout. Payment transfers to the worker and the item enters the customer's bag; decline/expiry makes no payment. Sales and salaries appear in the bank ledger.

**Bank transfers:** Bank → enter an online player's phone number and AED amount → review recipient → Send. Server rejects self-transfers, insufficient funds, invalid amounts and duplicate request IDs. Transfers and POS update both balances in one persisted write. Salaries require an active shift; leaving or disconnecting cancels it. Game accounts are still anonymous browser wallet keys, so production needs authenticated accounts and stronger authoritative movement/economy controls.

This is a playable geographic scaffold: mapped highways and researched landmark positions at metre scale. Landmark meshes, footprints, entrances, parking, local connectors and interiors are stylised approximations. Generic rooms are not reconstructions of real mall layouts. It does not yet contain all Dubai buildings, minor roads, metro service, coastline, functional ramps, NPC traffic or the complete city. Test lighting, touch controls and performance on your target phones/tablets; automated checks do not replace GPU/device visual testing.

### Phone correction

Player transfers now live in the separate **hPay** phone app; Bank contains the balance and transaction history. Landmark buttons are created once when opening Maps. The frame refresh redraws only map canvases, so it cannot append waypoints to Home or other apps. Road asphalt and lane paint use separated elevations and ordered rendering without competing depth writes to reduce flicker at overlapping road segments. Ground coverage now includes paving, parking and green spaces rather than blanket sand.

## Dubai accuracy pass — 12 October 2026

Geographic coordinates now use **one world unit per metre**, replacing the earlier 25% distance compression. Highway widths use 3.5 metres per mapped lane (capped at 30 metres); this is a rendering estimate, not measured carriageway width. The simplified Burj Khalifa model is now 828 metres high; its exterior/footprint and other landmark meshes remain stylised.

Imported **95 building outlines** and **394 outdoor street ways** from partial Downtown and Al Barsha / Mall of the Emirates OSM extracts. Buildings use actual outline polygons for rendering, collision and the phone map. Heights: 43 tagged heights, 9 estimates from tagged floor counts, 43 explicit 10-metre fallback heights. Selected landmark buildings use the existing stylised meshes to avoid duplicates; generic buildings remain outside imported neighbourhoods. Indoor parking ways are excluded rather than flattened onto outdoor roads.

This establishes geographic scale and two building-data samples along the agreed Dubai corridor. It is **not a complete Dubai replica**. Imported bridge/layer tags remain metadata; roads still render at ground level until measured elevation profiles and ramp topology are available. Missing minor streets, building relations/holes, terrain, coastline and interiors need further datasets and work. OSM layer tags must never be treated as measured road heights. Existing OSM toll-gate coordinates and server-owned billing remain; the snapshot covers five logical Salik gate locations, not all Dubai gates.

Reproduce outlines/streets with `python scripts/import-buildings.py AREA.json AREA2.json`, using cached OSM map API responses. The initial extracts used bounding boxes `55.270,25.195,55.281,25.202` and `55.198,25.116,55.205,25.121`.

## Navigation and real estate

The phone Maps app supports searching landmarks and property listings, calculating a route over the existing OpenStreetMap road polylines, and showing the route on the phone map and in the 3D world with next-turn HUD guidance. No external routing API key is required.

Real Estate includes starter apartment and house listings priced in in-game AED. Players can buy permanently or rent for 30 real-world days. Private landlords can set or change their own monthly asking rent; tenants can request a renewal, and the landlord must explicitly accept it before another 30-day term is charged. Rental income and payments are recorded in the existing wallet ledger. Server-side checks validate ownership, prices, availability, balance and property entry. Owned/rented properties can be entered using the existing interior scene.

Run `npm test` and `npm run build` to verify the change.

