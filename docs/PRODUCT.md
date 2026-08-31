# Recess — product completion map

## Shipped

| Pillar | Module | Status |
|--------|--------|--------|
| Premium visual system | `src/lib/design-tokens.ts`, GameIcon gradients | Done |
| Single-player + difficulty | `src/lib/ai/*`, `/solo/:gameType` | TTT playable; RPS/Pong helpers ready |
| Pong real-time | WebRTC DataChannel + LiveStatusBar | Done (Go live) |
| Celebrations + sound | `src/lib/audio/celebration.ts` | Done |
| Social share | `src/lib/share.ts` | Done |
| Tournament tiers | `src/lib/tournaments/tiers.ts` | Model done |
| Non-intrusive ads | `src/lib/ads/adNetwork.ts` | Adapter + caps done |

## Rules

1. Multiplayer scores: Edge + Postgres only.
2. Live Pong aim: DataChannel unreliable unordered; points via `submitMove`.
3. Single-player: client AI only.
4. Ads: never mid-turn; cooldown; suppress for Plus/Pro.
5. Tiers: local until auth profiles exist.

## Next

- Wire `playCelebration` + `shareMatch` on multiplayer results
- Landing footer ad slot
- Tournament lobby UI
- Solo UI for RPS / Pong / Red-Black
- Restore Edge `submitMove` if still stubbed
