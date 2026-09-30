# Recess free-tier operations

## Multiplayer depends on an Active Supabase project

The browser can run solo games offline. Rooms, joins, and moves go through the Deno Edge Function `games`.

If `mbvajrdpajvzumtxywnt.supabase.co` does not resolve, the project is paused or the URL in Vercel is stale.

1. Open https://supabase.com/dashboard
2. Resume / Restore the Recess project
3. Confirm Vercel `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` match Project Settings → API
4. GitHub → Actions → Deploy Supabase Edge Functions → Run workflow

## What the Edge Function does

Trusted short Deno script. Device token, no login required (`--no-verify-jwt`).

- createGame / joinGame — two players, 48h room expiry
- getGameState — masks secrets (RPS picks, hangman word, etc.)
- submitMove — server applies gameLogic
- playAgain / submitFeedback / getIceServers / finalizeLiveMatch
- heartbeat — cheap `select` so keep-alive counts as database activity

## Keep-alive

`.github/workflows/keep-alive.yml` runs every 12 hours.

Add repo secret `SUPABASE_ANON_KEY` (anon public key, same as Vercel).

Keep-alive prevents future pauses. It does not wake a project that is already paused.

## Legal

`/terms` and `/privacy` are shipped as `TermsPage.tsx` and `PrivacyPage.tsx`.
