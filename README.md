# GCAV Multiplayer Server

This branch contains the **multiplayer backend only**. The game website and client stay on the main game site. Players can keep using that site and choose a community-hosted server in the game's **Settings**.

A server host runs this service and shares its WebSocket URL with players. Each server has its own connected players and wallet save data.

## Host a server with Docker

Requires Docker Engine and Docker Compose.

```sh
git clone --branch multiplayer-server --single-branch https://github.com/UnrealCake8/gcav-build.git
cd gcav-build
cp .env.example .env
```

Edit `.env` if needed. `ALLOWED_ORIGINS` must list the exact origin of the game website (scheme and hostname, no path). The example allows `https://gca.v.malouksgames.com` plus localhost.

Start the service:

```sh
docker compose up -d --build
```

It listens on port 3000. Docker keeps wallet data in a named volume, so it survives container restarts. Check that it is running at `http://localhost:3000/health`. Stop it with `docker compose down`; to also erase the server's saved wallets, run `docker compose down --volumes`.

## Make it reachable to players

For remote players, give the server a public hostname with HTTPS/WSS, then route that hostname to port 3000 using a reverse proxy or Cloudflare Tunnel. The proxy must pass WebSocket upgrades on `/multiplayer` and normal HTTPS requests to `/api/clips`. Do not expose the service over plain `ws://` to a game page loaded over HTTPS.

The default domain for the Malouks Games server is:

- Health: `https://online.gcav.malouksgames.com/health`
- WebSocket: `wss://online.gcav.malouksgames.com/multiplayer`

For a self-hosted server, replace that hostname with your own. Share the full WebSocket URL, including `/multiplayer`.

## Connect the game to a server

Open the GCAV game site, go to **Settings**, paste the server's WebSocket URL, and save. For example:

```
wss://online.gcav.malouksgames.com/multiplayer
```

For local testing from a local game page, use `ws://localhost:3000/multiplayer`. The game remembers the selected server in that browser. To return to the default server, clear the URL in Settings and save.

## Run without Docker

Requires Node.js 22 or newer.

```sh
cp .env.example .env
npm ci
npm start
```

The process listens on `0.0.0.0:3000` by default and stores wallet data in `data/wallets.json`. Set `PORT` if needed. Keep the process running while players use the server.

## CORS and game origin

`ALLOWED_ORIGINS` is a comma-separated allowlist of exact browser origins. It must contain the origin serving the game frontend, because browsers connect from that page to this server. It is used for both WebSocket origin checks and the voice clip API. The multiplayer server hostname is the destination; it is not automatically the game page's origin.

## Data attribution

The bundled Dubai roads and buildings data derives from OpenStreetMap contributors and is available under the Open Database License (ODbL). See the source data metadata in `src/data/dubai-roads.json` and `src/data/dubai-buildings.json`.
