# 🎬 WatchParty

Watch YouTube videos in perfect sync with friends — play, pause, seek all synced in real-time via WebSockets.

## Features
- 🔄 Real-time sync (play, pause, seek)
- 💬 Live chat sidebar
- 😄 Emoji reactions with floating animations
- 👥 User list with host indicator
- 🔗 Shareable 6-character room codes
- 👑 Host transfers automatically if host leaves

## Setup & Run

### 1. Install dependencies
```bash
npm install
```

### 2. Start the server
```bash
node server.js
```

### 3. Open in browser
```
http://localhost:3000
```

## How to use

1. **Host:** Open the app → enter your name → click **Create a room**
2. **Host:** Share the 6-character room code with friends (click it to copy)
3. **Friends:** Open the app → enter name → paste room code → click **Join room**
4. **Host:** Paste a YouTube URL in the top bar → click **Load**
5. Everyone watches in sync! Only the host can play/pause/seek.

## Deploying online (so friends can join remotely)

### Option A: Railway / Render / Fly.io (free tiers)
- Push this folder to GitHub
- Connect to Railway/Render and deploy
- They handle WebSocket support automatically

### Option B: VPS (DigitalOcean, Linode, etc.)
```bash
# On your server
git clone <your-repo>
cd watchparty
npm install
node server.js  # or use PM2 for persistence
```
Then open port 3000 (or use nginx to proxy it).

### Important: Update WS_URL for remote deployment
In `public/index.html`, find this line near the top of the `<script>`:
```js
const WS_URL = `ws://${location.host}`;
```
This auto-detects the host, so it works as-is for most deployments.
For HTTPS deployments, WebSockets upgrade to `wss://` automatically via `location.host`.

## Tech Stack
- **Backend:** Node.js + Express + `ws` (WebSockets) + `uuid`
- **Frontend:** Vanilla HTML/CSS/JS + YouTube IFrame API
- **No database needed** — all state is in-memory
