import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const url =
  import.meta.env.VITE_SUPABASE_URL ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ??
  "";
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

if (!url || !anonKey) {
  console.warn(
    "[Recess] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — set them in Vercel / .env.local",
  );
}

export const supabase = createClient<Database>(url || "http://localhost", anonKey || "public");
