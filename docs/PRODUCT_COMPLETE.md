# Recess — product completion architecture

## Visual system
- Brand core: amber `#F5A623`, ink `#1A1A1A`, champagne cream.
- Per-game accents in `gameCatalog` / `ACCENT_CLASSES` (premium deep gradients).
- `GameIcon` + `GameChip` for cohesive Lucide marks.

## Single-player
- `src/lib/singlePlayer.ts` — beginner / intermediate / expert for Tic-Tac-Toe, RPS, Pong.
- UI: `DifficultyPicker`, `SoloLaunch`

## Live Pong
- Authoritative scores: Edge `submitMove`
- Real-time aim: WebRTC DataChannel (`ordered:false`, `maxRetransmits:0`) via `useLiveGame`
- Signaling: Supabase Realtime Broadcast `live:${slug}`

## Tournaments
- Tiers: free / plus / pro — `src/lib/tournaments.ts`

## Celebrations
- Web Audio cues; mute + reduced motion respected
- `CelebrationOverlay`

## Social sharing
- `src/lib/share.ts`

## Ads
- `VITE_AD_NETWORK=none|house|adsense|gam|custom`
- Pro suppresses most slots; never mid-move interstitials
