import { supabase, requireSupabase } from "@/lib/supabase";
import { ApiError } from "@/lib/api-error";
import type { GameRow, GameStatus, Marker, PlayerRole, PlayerRow } from "@/types/database";
import {
  GAME_TYPE,
  RPS_GAME_TYPE,
  RED_BLACK_GAME_TYPE,
  PONG_GAME_TYPE,
  TWENTY_QUESTIONS_GAME_TYPE,
  HANGMAN_GAME_TYPE,
  WORD_SCRAMBLE_GAME_TYPE,
  freshTicTacToeState,
  freshRpsState,
  freshRedBlackState,
  freshPongState,
  freshTwentyQuestionsState,
  freshHangmanState,
  freshWordScrambleState,
  type Marker as LogicMarker,
  type RpsState,
  type TwentyQuestionsState,
  type HangmanState,
  type WordScrambleState,
} from "@/lib/gameLogic";

export const EXPIRY_MS = 48 * 60 * 60 * 1000;
const ROOM_RE = /^[A-Za-z0-9_-]{3,64}$/;
const SUPPORTED: Set<string> = new Set([
  GAME_TYPE,
  RPS_GAME_TYPE,
  RED_BLACK_GAME_TYPE,
  PONG_GAME_TYPE,
  TWENTY_QUESTIONS_GAME_TYPE,
  HANGMAN_GAME_TYPE,
  WORD_SCRAMBLE_GAME_TYPE,
]);

export function fail(code: ApiError["code"], message: string): never {
  throw new ApiError(code, message);
}

export function freshStateFor(gameType: string): unknown {
  switch (gameType) {
    case GAME_TYPE:
      return freshTicTacToeState();
    case RPS_GAME_TYPE:
      return freshRpsState();
    case RED_BLACK_GAME_TYPE:
      return freshRedBlackState();
    case PONG_GAME_TYPE:
      return freshPongState();
    case TWENTY_QUESTIONS_GAME_TYPE:
      return freshTwentyQuestionsState();
    case HANGMAN_GAME_TYPE:
      return freshHangmanState();
    case WORD_SCRAMBLE_GAME_TYPE:
      return freshWordScrambleState();
    default:
      fail("unsupported_game", `Unknown game type "${gameType}".`);
  }
}

function maskRps(state: RpsState): RpsState {
  return state.phase === "picking" ? { ...state, picks: { X: null, O: null } } : state;
}

function maskSecret<
  T extends { secret: string | null; phase: string },
>(state: T, marker: Marker | null): T {
  if (marker !== "X" && state.phase !== "match_over") {
    return { ...state, secret: null };
  }
  return state;
}

export function maskState(
  gameType: string,
  state: unknown,
  marker: Marker | null,
): unknown {
  if (gameType === RPS_GAME_TYPE) return maskRps(state as RpsState);
  if (gameType === TWENTY_QUESTIONS_GAME_TYPE) {
    return maskSecret(state as TwentyQuestionsState, marker);
  }
  if (gameType === HANGMAN_GAME_TYPE) {
    return maskSecret(state as HangmanState, marker);
  }
  if (gameType === WORD_SCRAMBLE_GAME_TYPE) {
    return maskSecret(state as WordScrambleState, marker);
  }
  return state;
}

export async function getGameBySlug(slug: string): Promise<GameRow | null> {
  requireSupabase();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new ApiError("not_found", error.message);
  return data;
}

export async function getPlayer(
  gameId: string,
  deviceToken: string,
): Promise<PlayerRow | null> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("game_id", gameId)
    .eq("device_token", deviceToken)
    .maybeSingle();
  if (error) throw new ApiError("not_a_player", error.message);
  return data;
}

export async function expireIfStale(game: GameRow): Promise<boolean> {
  if (
    (game.status === "waiting" || game.status === "in_progress") &&
    Date.now() - game.updated_at > EXPIRY_MS
  ) {
    await supabase
      .from("games")
      .update({ status: "abandoned", updated_at: Date.now() })
      .eq("id", game.id);
    return true;
  }
  return false;
}

export async function createGame(args: {
  gameType: string;
  deviceToken: string;
  slug?: string;
}) {
  requireSupabase();
  const { gameType, deviceToken, slug: requestedSlug } = args;
  if (!SUPPORTED.has(gameType)) {
    fail("unsupported_game", `"${gameType}" isn't available yet.`);
  }
  if (!deviceToken || deviceToken.length < 8) {
    fail("not_a_player", "Missing device token — please refresh and try again.");
  }

  let slug: string;
  if (requestedSlug) {
    if (!ROOM_RE.test(requestedSlug)) {
      fail(
        "invalid_room",
        "That room name isn't valid — use 3-64 letters, numbers, dashes or underscores.",
      );
    }
    const existing = await getGameBySlug(requestedSlug);
    if (existing) {
      if (
        (existing.status === "waiting" || existing.status === "in_progress") &&
        existing.game_type === gameType
      ) {
        return { slug: existing.slug };
      }
      slug = crypto.randomUUID();
    } else {
      slug = requestedSlug;
    }
  } else {
    slug = crypto.randomUUID();
  }

  const now = Date.now();
  const { data: game, error } = await supabase
    .from("games")
    .insert({
      slug,
      game_type: gameType,
      state: freshStateFor(gameType) as object,
      status: "waiting",
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !game) {
    fail("invalid_move", error?.message ?? "Could not create game.");
  }

  const { error: pErr } = await supabase.from("players").insert({
    game_id: game.id,
    device_token: deviceToken,
    role: "initiator",
    marker: "X",
    joined_at: now,
  });
  if (pErr) fail("invalid_move", pErr.message);

  return { slug };
}

export async function joinGame(args: { slug: string; deviceToken: string }) {
  requireSupabase();
  const { slug, deviceToken } = args;
  const game = await getGameBySlug(slug);
  if (!game) fail("not_found", "This game doesn't exist (or the link is wrong).");
  if (await expireIfStale(game)) {
    fail("expired", "This game sat untouched for 48 hours, so it was closed.");
  }

  const me = await getPlayer(game.id, deviceToken);
  if (me) {
    await supabase
      .from("games")
      .update({ updated_at: Date.now() })
      .eq("id", game.id);
    return {
      joined: true,
      me: { role: me.role as PlayerRole, marker: me.marker as Marker },
    };
  }

  if (game.status !== "waiting") {
    fail(
      "locked",
      "This game is already in progress — only the original two players can play it.",
    );
  }

  const joinedAt = Date.now();
  const { error } = await supabase.from("players").insert({
    game_id: game.id,
    device_token: deviceToken,
    role: "responder",
    marker: "O",
    joined_at: joinedAt,
  });
  if (error) fail("invalid_move", error.message);

  await supabase
    .from("games")
    .update({ status: "in_progress", updated_at: joinedAt })
    .eq("id", game.id);

  return {
    joined: true,
    me: { role: "responder" as const, marker: "O" as const },
  };
}

export async function getGameState(args: {
  slug: string;
  deviceToken: string;
}) {
  requireSupabase();
  const { slug, deviceToken } = args;
  const game = await getGameBySlug(slug);
  if (!game) fail("not_found", "This game doesn't exist (or the link is wrong).");

  const me = await getPlayer(game.id, deviceToken);
  if (
    !me &&
    (game.status === "in_progress" || game.status === "completed")
  ) {
    fail(
      "locked",
      "This game is already in progress — only the original two players can access it.",
    );
  }

  const rps =
    game.game_type === RPS_GAME_TYPE ? (game.state as RpsState) : null;

  return {
    status: game.status as GameStatus,
    gameType: game.game_type,
    state: maskState(
      game.game_type,
      game.state,
      (me?.marker as Marker) ?? null,
    ),
    me: me
      ? {
          role: me.role as PlayerRole,
          marker: me.marker as Marker,
          picked: rps
            ? rps.picks[me.marker as LogicMarker] !== null
            : undefined,
        }
      : null,
  };
}
