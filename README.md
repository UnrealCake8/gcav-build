# Grand Chamak Auto — browser build

Original procedural waterfront game inspired by the provided reference footage. Includes walking/driving, a delivery mission, phone apps, multiplayer presence, room text chat and private push-to-talk calls.

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

WASD: move/drive. E: enter/exit the white car. P: phone. Space: brake. Drag: camera. On touch screens, an analogue joystick controls walking/driving; a separate Brake button stops the car. Drag the world with another finger to move the camera. Jobs → Waterfront delivery triggers a scripted text mission call. Collect the green marker then reach the amber marker for AED 150.

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

This is an early playable foundation, not a finished production game. Session names are unverified; phone numbers are not account identities. Jobs and money remain browser-side, saved locally. Movement has basic speed/bounds guards, not authoritative physics. Players use individual white cars; other players see a blue representation. For wider release, add persistent accounts, server-owned progress/physics and blocking/reporting/moderation. The server validates audio MIME labels/bytes, not decoded audio duration; the 15-second duration cap is enforced by the client.
