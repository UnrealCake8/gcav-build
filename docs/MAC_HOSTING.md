# Host on your Mac through Cloudflare Tunnel

The website, multiplayer WebSockets and audio uploads run in one process on port 3000. CGNAT does not require router changes, port forwarding or a public home IP.

## 1. Install prerequisites

Install Node.js 22 or newer from https://nodejs.org/en/download. Check in Terminal:

```bash
node -v
npm -v
git --version
```

If macOS asks for Command Line Tools when running Git, install them. With Homebrew already installed, install the tunnel connector:

```bash
brew install cloudflared
```

Without Homebrew, use Cloudflare's official download instructions: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/

## 2. Download and run

```bash
git clone https://github.com/UnrealCake8/gcav-build.git
cd gcav-build
npm ci
npm run build
cp .env.example .env
npm start
```

Open http://localhost:3000 in Chrome. Open a second tab to test two players. P → Phone displays each number. Dial the other tab's number, answer, record, then stop and send. Confirm the other tab can play it. The host browser also needs to enter the city; merely starting the server does not join as a player.

## 3. Create the tunnel

Use Cloudflare's dashboard-managed tunnel instructions:
https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/

In Cloudflare One, find Networks → Connectors → Cloudflare Tunnels. Create a Cloudflared tunnel named `gcav-mac`. Choose the macOS connector instructions. Run the installation/run command Cloudflare supplies on your Mac. The connector token is a secret: keep it out of GitHub, screenshots and chat. Wait until the connector reports healthy.

Add a Published application route:

| Field | Value |
|---|---|
| Subdomain | `gca.v` |
| Domain | `malouksgames.com` |
| Path | Leave empty |
| Service type | HTTP |
| Service URL | `localhost:3000` |

This publishes https://gca.v.malouksgames.com. If the hostname still has a DNS record pointing to Vercel (76.76.21.21), replace only that hostname's conflicting record when moving it to this tunnel. The tunnel route normally creates a proxied CNAME to the tunnel. Do not modify the main website or email records. Domain ownership and management in the Cloudflare account are prerequisites.

There is no separate WSS route needed: the game automatically connects to `wss://gca.v.malouksgames.com/multiplayer`. Uploads use the same HTTPS hostname.

## 4. Check allowed origins

The included `.env.example` already allows localhost and https://gca.v.malouksgames.com. If you chose a different hostname, edit `.env`:

```dotenv
HOST=127.0.0.1
PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://YOUR-EXACT-HOSTNAME
```

Use exact origins, without paths or trailing slashes. Restart `npm start` after changing `.env`. The local service stays on HTTP; Cloudflare supplies the public HTTPS/WSS endpoint. You do not need a public certificate on the Mac for this tunnel setup.

## 5. Test from outside

Open the public URL on another device/network. Check that Enter City reports Multiplayer connected. Call between two joined browsers. Confirm a clip arrives and plays. Test microphone permission in each browser. Clear any old separate-server address in Settings so the game uses the same-origin default.

## 6. Keep it running

Keep `npm start` running and the Cloudflare connector running. In another Terminal window:

```bash
caffeinate -i
```

Keep that command running to prevent idle system sleep during testing. Closing the laptop lid may still interrupt hosting. Stopping the Node server or restarting it ends sessions and removes temporary recordings. Configure proper macOS services for unattended use later; the connector's dashboard install instructions may already install it as a service, but the Node game process still needs its own service.

## Update the game

Stop the Node server with Ctrl+C, then:

```bash
git pull --ff-only
npm ci
npm run build
npm start
```

Keep `.env` local. The repo ignores it.

## Troubleshooting

- Website offline/502: check Node on port 3000 and connector health.
- Website works but multiplayer doesn't: clear Settings override, check exact ALLOWED_ORIGINS and restart Node.
- Phone has no number: enter the city and wait for Multiplayer connected.
- No recording: allow microphone and use HTTPS/public URL or localhost.
- Clip received but no sound: press Play; try Chrome at both ends and check microphone input.
- Another player cannot join: server cap is 16 simultaneous WebSocket connections, including extra tabs.
- Calls end on disconnect: intended behaviour; this version does not resume voice calls after reconnect.
