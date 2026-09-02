# Spike: Live Multiplayer Pong (isolated)

**Not part of the Recess app.** Standalone Node WebSocket proof-of-concept.

## Goals

- Server-authoritative ball + paddles
- Clients send **paddle X only**
- **15 Hz** full state snapshots (measure bytes/msg in the browser console / on-screen HUD)
- Lobby → 3s countdown → first to **7**
- Disconnect → **pause 20s** → forfeit if no reconnect
- Two browser tabs, same room id — no Recess auth

## Run

```bash
cd spike/live-pong
npm install
npm start
```

Open two tabs: [http://localhost:3099/?room=demo](http://localhost:3099/?room=demo)

Optional: `PORT=3099 node server.mjs`

## Measure (Ghana 3G planning)

1. Watch the on-screen **B/s** HUD (target ~15 msg/s).
2. Chrome DevTools → Network conditions → **Slow 3G**.
3. Confirm paddle lag feels playable; note average snapshot size.

Also: `curl http://localhost:3099/metrics`

## Out of scope

Recess integration, device_token, TURN/WebRTC, spectators, ranked, Supabase Realtime.
