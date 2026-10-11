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
