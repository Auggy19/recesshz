# Deploy spike/live-pong (free host → public wss://)

Isolated Node HTTP + WebSocket service. **Not** the main Recess Vercel app.

`server.mjs` already uses `process.env.PORT` (required by Render/Railway) and binds `0.0.0.0`.

The browser client opens `wss://` automatically when the page is loaded over HTTPS
(`new WebSocket((location.protocol === "https:" ? "wss:" : "ws:") + "//" + location.host)`).

---

## Option A — Render (recommended for a free HTTPS URL)

1. Push this repo to GitHub (already on `Auggy19/recesshz`).
2. Go to [https://dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**.
3. Connect the **Auggy19/recesshz** repo.
4. Settings:
   - **Name:** `recess-spike-live-pong`
   - **Root Directory:** `spike/live-pong`  ← critical
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free
5. Deploy. Wait until status is **Live**.
6. Your URLs:
   - Page: `https://<service-name>.onrender.com/?room=demo`
   - WebSocket (same host): `wss://<service-name>.onrender.com`
   - Metrics: `https://<service-name>.onrender.com/metrics`

**Free-tier note:** the service **spins down after ~15 min idle**. First request after sleep can take 30–60s. Keep one tab open while testing on phones.

**Blueprint alternative:** **New** → **Blueprint** → select repo → use `spike/live-pong/render.yaml` (or paste the same service block).

---

## Option B — Railway

1. [https://railway.app](https://railway.app) → **New Project** → **Deploy from GitHub** → `Auggy19/recesshz`.
2. After the service is created: **Settings** → **Root Directory** → `spike/live-pong`.
3. **Settings** → **Generate Domain** (HTTPS).
4. Railway sets `PORT` automatically; start command is `npm start` from `package.json`.
5. Open `https://<your-domain>/?room=demo` on two devices.

`spike/live-pong/railway.toml` documents build/start; root directory must still be set in the UI for a monorepo.

---

## Mobile test checklist

1. Phone and second device (or phone + desktop) on real network (not only Wi‑Fi localhost).
2. Open the **https://** URL with `?room=demo` on both.
3. Confirm countdown → play; drag paddles; note lag on mobile data.
4. Optional: Chrome remote DevTools / Network throttle is secondary to a real radio test.

---

## Local still works

```bash
cd spike/live-pong
npm install
npm start
# http://localhost:3099/?room=demo
```
