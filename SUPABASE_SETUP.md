# Supabase setup for Recess

Recess no longer uses Convex. All game state lives in Supabase Postgres + Realtime.

## 1. Schema

1. Open your Supabase project → SQL Editor.
2. Run the migration file: `supabase/migrations/001_recess_schema.sql`
3. Confirm Realtime is enabled for `public.games` (the migration adds it to the publication).

## 2. Environment variables (Vercel)

In the Vercel project connected to this repo, set:

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | Project URL (Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | `anon` `public` key |

If the official Supabase ↔ Vercel integration only wrote `NEXT_PUBLIC_SUPABASE_*`, that is fine — the client falls back to those names.

Redeploy after changing env vars.

## 3. Client architecture

- `src/lib/supabase.ts` — typed Supabase client
- `src/lib/games-create.ts` / `games-moves.ts` — create / join / get / move / rematch / feedback
- `src/shims/*` — drop-in replacements so `convex/react` imports keep working
- Pure rules stay in `src/convex/gameLogic.ts` (no server runtime)

No Convex deployment is required.
