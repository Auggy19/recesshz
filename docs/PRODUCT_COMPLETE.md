# Recess — product completion architecture

## Visual system
- Brand core: amber `#F5A623`, ink `#1A1A1A`, champagne cream `#FFF9E5`.
- Tokens: `src/lib/design-tokens.ts` (palette, gradients, difficulty).
- Per-game accents: `gameCatalog` / `ACCENT_CLASSES` (deep premium gradients).
- Icons: `GameIcon` + `GameChip` (Lucide, cohesive tiles).

## Single-player
- Games: Tic-Tac-Toe, RPS, Red or Black, Pong.
- Difficulties: beginner / intermediate / expert.
- Hooks: `src/lib/ai/useSinglePlayer.ts`
- UI: `/solo/:gameType`, `DifficultyPicker`, `SoloLaunch`.

## Live Pong (real-time)
- Authoritative scores: Edge `submitMove` / `finalizeLiveMatch`.
- Real-time aim: WebRTC DataChannel `ordered:false`, `maxRetransmits:0`.
- Signaling: Supabase Realtime Broadcast `live:${slug}`.
- UI: `LiveStatusBar` + ghost paddle on `PongPlay`.

## Tournaments (tiered access)
- Tiers: `free` | `plus` | `pro` — `src/lib/tournaments/tiers.ts`.
- Free: open casual rooms. Plus: ranked brackets. Pro: private events + ad suppression.
- UI: `TournamentCard` on dashboard / lobby.

## Celebrations + adaptive sound
- Web Audio cues (`win` / `loss` / `draw` / `point` / `live`).
- Respects mute preference + `prefers-reduced-motion`.
- `CelebrationOverlay` + `src/lib/celebration.ts`.

## Social sharing
- `buildMatchShare` + `shareMatch` (Web Share API → clipboard fallback).
- Use post-match on GamePage / Solo.

## Ads (non-intrusive)
- `VITE_AD_NETWORK=none|house|adsense|gam|custom`
- Placements: landing_footer, post_match, tournament_lobby (never mid-move).
- Relevance keywords by game type; Pro tier suppresses surface ads.
- `AdSlot` + `src/lib/ads/adNetwork.ts`.
