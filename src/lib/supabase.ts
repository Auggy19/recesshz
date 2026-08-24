import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ApiError } from "@/lib/api-error";

const url =
  import.meta.env.VITE_SUPABASE_URL ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ??
  "";
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

/** True when real project URL + anon key are present (not localhost placeholders). */
export const isSupabaseConfigured = Boolean(
  url &&
    anonKey &&
    !url.includes("localhost") &&
    anonKey !== "public",
);

if (!isSupabaseConfigured) {
  console.warn(
    "[Recess] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — set them in Vercel (Production) and redeploy. See SUPABASE_SETUP.md",
  );
}

/** Typed Supabase client (schema in types/database.ts). */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  url || "https://placeholder.supabase.co",
  anonKey || "public-anon-key-missing",
);

/** Call before any game write so users get a clear toast instead of a network error. */
export function requireSupabase(): void {
  if (!isSupabaseConfigured) {
    throw new ApiError(
      "not_ready",
      "Backend is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, run the SQL migration, then redeploy.",
    );
  }
}
