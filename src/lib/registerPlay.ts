import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type RegisterPlayResult = {
  streak: number;
  best: number;
};

/**
 * Records a finished match in Postgres via recess_register_play.
 * Safe to call more than once for the same local day — the SQL function
 * keeps the streak at 1 play per UTC day.
 */
export async function registerPlayOnServer(args: {
  deviceToken: string;
  gameType?: string;
  score?: number;
  won?: boolean;
}): Promise<RegisterPlayResult | null> {
  if (!isSupabaseConfigured) return null;
  if (!args.deviceToken || args.deviceToken.length < 8) return null;

  const { data, error } = await supabase.rpc("recess_register_play", {
    p_device_token: args.deviceToken,
    p_game_type: args.gameType ?? "tic_tac_toe",
    p_score: args.score ?? (args.won ? 1 : 0),
    p_won: Boolean(args.won),
  });

  if (error) {
    console.warn("[Recess] recess_register_play failed", error.message);
    return null;
  }

  const row = data as { streak?: number; best?: number } | null;
  if (!row || typeof row.streak !== "number") return null;
  return { streak: row.streak, best: row.best ?? row.streak };
}
