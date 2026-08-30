import { supabase, requireSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { ApiError, type ErrorCode } from "@/lib/api-error";

type EdgeError = { code?: string; message?: string };

async function invokeGames<T>(
  action: string,
  body: Record<string, unknown>,
): Promise<T> {
  requireSupabase();
  const { data, error } = await supabase.functions.invoke("games", {
    body: { action, ...body },
  });

  if (error) {
    throw new ApiError(
      "not_ready",
      error.message ||
        "Couldn't reach the game server. Deploy the `games` Edge Function, then try again.",
    );
  }

  const payload = data as T & { error?: EdgeError };
  if (payload && typeof payload === "object" && "error" in payload && payload.error) {
    const code = (payload.error.code as ErrorCode) || "invalid_move";
    throw new ApiError(code, payload.error.message || "Request failed.");
  }

  return payload as T;
}

export async function createGame(args: {
  gameType: string;
  deviceToken: string;
  slug?: string;
}) {
  return invokeGames<{ slug: string }>("createGame", args);
}

export async function joinGame(args: { slug: string; deviceToken: string }) {
  return invokeGames<{
    joined: boolean;
    me: { role: "initiator" | "responder"; marker: "X" | "O" };
  }>("joinGame", args);
}

export async function getGameState(args: { slug: string; deviceToken: string }) {
  return invokeGames<{
    status: string;
    gameType: string;
    state: unknown;
    me: {
      role: string;
      marker: string;
      picked?: boolean;
    } | null;
  }>("getGameState", args);
}

export type SubmitMoveArgs = {
  slug: string;
  deviceToken: string;
  cell?: number;
  pick?: string;
  angle?: number;
  power?: number;
  secret?: string;
  question?: string;
  answer?: "yes" | "no";
  guess?: string;
};

export async function submitMove(args: SubmitMoveArgs) {
  return invokeGames<{ ok: boolean; state: unknown }>("submitMove", args);
}

export async function playAgain(args: { slug: string; deviceToken: string }) {
  return invokeGames<{ slug: string }>("playAgain", args);
}

export async function submitFeedback(args: {
  slug: string;
  deviceToken: string;
  wouldPlayAgain: boolean;
  feltNatural?: boolean;
}) {
  return invokeGames<{ ok: boolean }>("submitFeedback", args);
}

/** ICE servers for live WebRTC (STUN + optional TURN from Edge secrets). */
export async function getIceServers() {
  return invokeGames<{ iceServers: RTCIceServer[] }>("getIceServers", {});
}

/**
 * Authoritative live match end: forfeit or agreed completion.
 * Does not trust peer scores for ranked fairness beyond forfeit.
 */
export async function finalizeLiveMatch(args: {
  slug: string;
  deviceToken: string;
  reason: "forfeit" | "complete" | "disconnect";
  scores?: { X: number; O: number };
}) {
  return invokeGames<{ ok: boolean; status: string }>("finalizeLiveMatch", args);
}

/** Realtime stays on the client — no Edge Function needed. */
export function subscribeGame(slug: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const channel = supabase
    .channel(`game:${slug}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "games", filter: `slug=eq.${slug}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
