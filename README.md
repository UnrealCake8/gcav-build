# GCAV Multiplayer Server

Standalone Node.js service for GCAV player synchronization, game sessions, economy, and private voice clips. The branch contains the server and only the game data modules it needs; it does not serve the game website or static assets.

## Endpoints

- Health: `https://online.gcav.malouksgames.com/health`
- WebSocket: `wss://online.gcav.malouksgames.com/multiplayer`
- Private clip API: `https://online.gcav.malouksgames.com/api/clips` (used by in-game calls)

In the game, set the multiplayer server URL in Settings to:

```
wss://online.gcav.malouksgames.com/multiplayer
```

## Run

Requires Node.js 22 or newer and a persistent Node process with WebSocket upgrade support.

```sh
cp .env.example .env
npm ci
npm start
```

The process listens on `0.0.0.0:3000` by default and stores wallet data in `data/wallets.json`. Set `PORT` if your host assigns a different port. The service must remain running; deploy it to a Node host or run it behind Cloudflare Tunnel with the `online.gcav.malouksgames.com` hostname routed to this process. The proxy must pass WebSocket upgrades for `/multiplayer`.

## CORS and game origin

`ALLOWED_ORIGINS` is a comma-separated allowlist of exact browser origins (scheme and hostname, no path). It must contain the origin serving the game frontend, because the browser connects from that page to this service. The example includes `https://gca.v.malouksgames.com` and localhost. Replace or add the actual game site origin if it changes. The multiplayer hostname is the service destination; it is not automatically the game page's origin.

## Data attribution

The bundled Dubai roads and buildings data derives from OpenStreetMap contributors and is available under the Open Database License (ODbL). See the source data metadata in `src/data/dubai-roads.json` and `src/data/dubai-buildings.json`.
