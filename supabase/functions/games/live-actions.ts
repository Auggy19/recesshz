import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type Fail = (code: string, message: string) => never;

type Helpers = {
  fail: Fail;
  getGameBySlug: (db: SupabaseClient, slug: string) => Promise<Record<string, unknown> | null>;
  getPlayer: (
    db: SupabaseClient,
    gameId: string,
    deviceToken: string,
  ) => Promise<Record<string, unknown> | null>;
};

export async function getIceServers() {
  const iceServers: { urls: string | string[]; username?: string; credential?: string }[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];
  const turnUrls = (Deno.env.get("TURN_URLS") ?? "").trim();
  const turnUser = (Deno.env.get("TURN_USERNAME") ?? "").trim();
  const turnCred = (Deno.env.get("TURN_CREDENTIAL") ?? "").trim();
  if (turnUrls) {
    const urls = turnUrls.split(",").map((u) => u.trim()).filter(Boolean);
    if (urls.length) {
      if (turnUser && turnCred) {
        iceServers.push({ urls, username: turnUser, credential: turnCred });
      } else {
        iceServers.push({ urls });
      }
    }
  }
  return { iceServers };
}

export async function finalizeLiveMatch(
  db: SupabaseClient,
  body: Record<string, unknown>,
  helpers: Helpers,
) {
  const { fail, getGameBySlug, getPlayer } = helpers;
  const slug = String(body.slug ?? "");
  const deviceToken = String(body.deviceToken ?? "");
  const reason = String(body.reason ?? "disconnect");
  if (!slug || !deviceToken) fail("invalid_move", "Missing slug or device token.");

  const game = await getGameBySlug(db, slug);
  if (!game) fail("not_found", "This game doesn't exist (or the link is wrong).");

  const me = await getPlayer(db, game.id as string, deviceToken);
  if (!me) fail("not_a_player", "You're not registered on this game.");

  const now = Date.now();
  const status = game.status as string;

  if (reason === "forfeit" && status === "in_progress") {
    const myMarker = me.marker as "X" | "O";
    const winner = myMarker === "X" ? "O" : "X";
    const state = { ...(game.state as Record<string, unknown>) };
    if ("matchWinner" in state || "scores" in state) {
      state.matchWinner = winner;
      if (state.phase !== undefined) state.phase = "match_over";
    } else if ("winner" in state) {
      state.winner = winner;
    }
    state.liveEnd = { reason: "forfeit", by: myMarker, at: now };
    await db
      .from("games")
      .update({ state, status: "completed", updated_at: now })
      .eq("id", game.id);
    return { ok: true, status: "completed" };
  }

  const state = { ...(game.state as Record<string, unknown>) };
  state.liveEnd = { reason, by: me.marker, at: now };
  await db.from("games").update({ state, updated_at: now }).eq("id", game.id);
  return { ok: true, status };
}
