import { supabase, requireSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { ApiError, type ErrorCode } from "@/lib/api-error";
import { createGame as createGameClient } from "@/lib/games-create";

type EdgeError = { code?: string; message?: string };

async function extractEdgeError(error: unknown): Promise<{
  code: ErrorCode;
  message: string;
}> {
  let code: ErrorCode = "not_ready";
  let message =
    (error as { message?: string })?.message ||
    "Couldn't reach the game server. Deploy the `games` Edge Function, then try again.";

  try {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      const body = (await ctx.json()) as { error?: EdgeError; message?: string };
      if (body?.error?.message) message = String(body.error.message);
      else if (body?.message) message = String(body.message);
      if (body?.error?.code) code = body.error.code as ErrorCode;
    }
  } catch {
    /* keep defaults */
  }

  // Supabase client often only says "non-2xx" — surface something actionable.
  if (/non-2xx/i.test(message)) {
    message =
      "Game server rejected the request (Edge non-2xx). If you just added a game, redeploy: supabase functions deploy games --no-verify-jwt";
  }

  return { code, message };
}

async function invokeGames<T>(
  action: string,
  body: Record<string, unknown>,
): Promise<T> {
  requireSupabase();
  const { data, error } = await supabase.functions.invoke("games", {
    body: { action, ...body },
  });

  if (error) {
    const parsed = await extractEdgeError(error);
    throw new ApiError(parsed.code, parsed.message);
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
  try {
    return await invokeGames<{ slug: string }>("createGame", args);
  } catch (err) {
    // Production Edge may lag behind GitHub (unsupported_game / non-2xx).
    // Client path uses the same schema + open RLS and already supports counters_ball.
    const code = err instanceof ApiError ? err.code : "";
    const msg = err instanceof Error ? err.message : "";
    const shouldFallback =
      code === "unsupported_game" ||
      code === "not_ready" ||
      /non-2xx|isn't available yet|redeploy/i.test(msg);

    if (shouldFallback) {
      try {
        return await createGameClient(args);
      } catch (clientErr) {
        // Prefer the more specific client error if Edge was only "unsupported".
        throw clientErr;
      }
    }
    throw err;
  }
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
  /** Counters Ball FC */
  capId?: string;
  ix?: number;
  iy?: number;
  spin?: number;
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
