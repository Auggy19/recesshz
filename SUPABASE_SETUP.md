# Supabase setup for Recess

1. Open your Supabase project SQL editor.
2. Run the migration file: `supabase/migrations/001_recess_schema.sql`
3. Enable Realtime for the `games` table (SQL includes `alter publication`).
4. In Vercel project settings, ensure these env vars exist (Supabase integration usually sets them):
   - `VITE_SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL` — both are read)
   - `VITE_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

If the integration only set server-side names, add the `VITE_` copies for the Vite client.
