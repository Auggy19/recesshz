# Spike: Live Multiplayer Pong (isolated)

**Not part of the Recess app.** Standalone Node WebSocket proof-of-concept.

## Goals

- Server-authoritative ball + paddles
- Clients send **paddle X only**
- **15 Hz** state updates with **field-level deltas** + full **keyframes ~1s**
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

## Wire protocol (state)

- **Keyframe** (`full: true`): complete phase, ball, paddles, scores (join, phase change, every 15 ticks).
- **Delta** (`full: false`): only changed fields vs previous snapshot; positions quantized to 2 decimals.
- Client merges into a local baseline; seq gaps are healed by the next keyframe.

## Measure (Ghana 3G planning)

1. Watch the on-screen HUD: **B/s**, **msg/s**, **full / Δ** counts.
2. Chrome DevTools → Network conditions → **Slow 3G**.
3. Confirm paddle lag feels playable; compare B/s to pre-delta baseline (~3.7 KB/s).

Also: `curl http://localhost:3099/metrics` (`delta: true`, `keyframeEvery: 15`)

## Keep-alive (mobile / proxies)

- **Server:** WebSocket protocol `ping` every **25s**; no `pong` → `terminate`.
- **Client:** exponential backoff reconnect; `visibilitychange` + `online` recovery.

## Out of scope

Recess integration, device_token, TURN/WebRTC, spectators, ranked, Supabase Realtime.
