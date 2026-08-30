# Recess Live — architecture & UI plan

## Status

| Piece | Status |
|-------|--------|
| Perfect Negotiation | Done |
| Supabase Realtime signaling | Done |
| `game` DataChannel unordered / maxRetransmits 0 | Done |
| `useLiveGame` + LiveStatusBar | Done |
| GamePage when both players connected | Done |
| **Live Pong aim preview** | **Done (Phase 3)** |
| **ICE / TURN resolution** | **Done (Phase 3)** |
| **Edge `finalizeLiveMatch`** | **Done (Phase 3)** |

## Phase 3 details

### Pong live preview
- While the data channel is open, local aim changes are sent as `input` messages (~20 Hz).
- Axis = `angle / 60` in `[-1, 1]`.
- Peer shows an emerald ghost paddle at `remoteAxis * 60` degrees.
- Async `submitMove` remains the source of truth for scores.

### TURN / ICE
- Client calls `resolveIceServers()` → Edge action `getIceServers`.
- Edge always returns Google STUN; adds TURN when secrets are set:
  - `TURN_URLS` (comma-separated)
  - `TURN_USERNAME` / `TURN_CREDENTIAL`
- Client fallback: `VITE_TURN_*` + default STUN.

### Finalize scores / session
- Edge action `finalizeLiveMatch`:
  - `reason: "forfeit"` + `in_progress` → opponent wins, `status: completed`.
  - `reason: "disconnect" | "complete"` → attaches `state.liveEnd` metadata.
- **End live** on the status bar records a disconnect finalize then hangs up.

## Deploy notes

```bash
supabase secrets set TURN_URLS="turn:..." TURN_USERNAME="..." TURN_CREDENTIAL="..."
supabase functions deploy games --no-verify-jwt
```
