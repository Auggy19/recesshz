# Recess Live — architecture & UI plan

## Status (implementation phase 1)

| Piece | Status |
|-------|--------|
| Perfect Negotiation | Done (`src/lib/live/peer.ts`) |
| Supabase Realtime signaling | Done (`signaling.ts`) |
| **`game` DataChannel** `ordered: false`, `maxRetransmits: 0` | **Done** |
| Wire protocol + `GameDataChannel` | **Done** |
| `useLiveGame` hook | **Done** |
| `LiveStatusBar` UI | **Done** |
| GamePage “Go live” wiring | Next |
| Live Pong input loop | Later |
| TURN credentials from Edge | Later |

## Transport choices

- **Signaling:** Supabase Broadcast topic `live:{slug}` (SDP / ICE only).
- **Gameplay:** RTCDataChannel label **`game`**:
  - `ordered: false` — reordering OK; app uses `seq` + latest-wins.
  - `maxRetransmits: 0` — stale samples dropped by SCTP; lowest latency.
- **Authority:** Final scores still via Edge + Postgres (async path). Live is opt-in.

## UI / icons

| Element | Design |
|---------|--------|
| Status dot | Emerald pulse = live; amber pulse = connecting; red = failed; muted = async |
| **Go live** | Primary pill + radio-wave icon (arcs + center dot) |
| **End live** | Outline pill + cut-connection icon |
| Placement | Game header compact chip; optional full bar above board |
| Copy | “Live · both online” when channel open |

Do **not** show Go live on pure async-only games until the title opts in (start with Pong).

## Development plan

### Phase 1 (current)
1. Channel init + wire helper + status UI components.
2. Hook API stable for GamePage.

### Phase 2
1. Mount `LiveStatusBar` on Pong (and optionally GamePage shell).
2. Enable after both players joined (`status === in_progress`).
3. On `input` messages, drive remote paddle preview (no score trust).

### Phase 3
1. Edge `finalizeLiveMatch` for scores.
2. Ephemeral TURN from Edge; inject `iceServers` into `createLiveSession`.
3. Presence “friend is here” on same live topic.

### Phase 4
1. Optional second reliable channel only if control HOL becomes an issue (not default).
2. WebTransport server path only if ranked live requires it.

## File map

```
src/lib/live/
  types.ts          signal messages, connection states
  signaling.ts      Supabase Broadcast
  peer.ts           Perfect Negotiation + game DC init
  session.ts        createLiveSession
  wire.ts           LiveWireV1 + LIVE_CHANNEL_INIT
  data-channel.ts   GameDataChannel (seq, backpressure)
  useLiveGame.ts    React hook
  index.ts          exports
src/components/live/
  LiveStatusBar.tsx Go live / status / hangup
docs/LIVE.md        this plan
```
