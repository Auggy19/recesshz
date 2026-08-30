# Supabase setup for Recess

Recess uses **Supabase Postgres + Realtime + Edge Functions**.
Game rules run server-side in the `games` Edge Function so clients cannot cheat state transitions.

## 1. Schema

1. Open your Supabase project → SQL Editor.
2. Run `supabase/migrations/001_recess_schema.sql`.
3. Confirm Realtime is enabled for `public.games`.

## 2. Environment variables (Vercel)

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | Project URL (Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | `anon` `public` key |

Redeploy after changing env vars.

## 3. Edge Function `games`

### Deploy (CLI)

```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>

# device_token auth is app-level — skip JWT verify
supabase functions deploy games --no-verify-jwt
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically in the Edge runtime.

### Actions (POST body)

| `action` | Body fields | Returns |
|----------|-------------|---------|
| `createGame` | `gameType`, `deviceToken`, optional `slug` | `{ slug }` |
| `joinGame` | `slug`, `deviceToken` | `{ joined, me }` |
| `getGameState` | `slug`, `deviceToken` | masked snapshot |
| `submitMove` | `slug`, `deviceToken`, move fields | `{ ok, state }` |
| `playAgain` | `slug`, `deviceToken` | `{ slug }` |
| `submitFeedback` | `slug`, `deviceToken`, `wouldPlayAgain` | `{ ok }` |

Errors: `{ error: { code, message } }` with HTTP 400/500.

### Local serve

```bash
supabase functions serve games --no-verify-jwt
```

## 4. Client architecture

- `src/lib/supabase.ts` — typed client
- `src/lib/games-edge.ts` — invokes Edge Function `games`
- `src/lib/games-api.ts` — public re-exports
- `src/lib/gameLogic.ts` — pure rules (mirrored in `supabase/functions/_shared/gameLogic.ts`)
- `subscribeGame` — client Realtime on `games` by slug

`games-create.ts` / `games-moves.ts` remain as local reference implementations; production path is Edge.

## 5. Security notes

- Edge uses the **service role** key — never expose it to the browser.
- Clients send `deviceToken` in the body; membership is checked server-side.
- Secrets and RPS picks are **masked** before responses leave the Edge Function.
- Tighten RLS later once soft auth exists.
