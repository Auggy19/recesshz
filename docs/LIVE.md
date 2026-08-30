# Recess Live — architecture & UI plan

## Status

| Piece | Status |
|-------|--------|
| Perfect Negotiation | Done |
| Supabase Realtime signaling | Done |
| `game` DataChannel `ordered: false`, `maxRetransmits: 0` | Done |
| Wire protocol + `GameDataChannel` | Done |
| `useLiveGame` hook | Done |
| `LiveStatusBar` UI | Done |
| **GamePage wiring (both players connected)** | **Done (Phase 2)** |
| Live Pong input loop | Phase 3 |
| TURN credentials from Edge | Phase 3 |

## Phase 2 behavior

On `GamePage`, when `status` is `in_progress` or `completed` and the player has a marker:

1. `useLiveGame({ enabled: true, ... })` is active.
2. `LiveStatusBar` renders above the board (not while `waiting` for a friend).
3. **Go live** starts Perfect Negotiation + unordered `game` DataChannel.
4. **End live** hangs up and tears down the session.

Async Edge moves remain the source of truth for scores.

## File map

```
src/lib/live/          transport + hook
src/components/live/   LiveStatusBar
src/pages/GamePage.tsx mounts bar when both players are in
```
