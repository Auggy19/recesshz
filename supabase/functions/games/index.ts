// Recess games Edge Function — authoritative create / join / state / move / rematch / feedback.
// Deploy: supabase functions deploy games --no-verify-jwt
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  GAME_TYPE, RPS_GAME_TYPE, RED_BLACK_GAME_TYPE, PONG_GAME_TYPE,
  TWENTY_QUESTIONS_GAME_TYPE, HANGMAN_GAME_TYPE, WORD_SCRAMBLE_GAME_TYPE,
  freshTicTacToeState, freshRpsState, freshRedBlackState, freshPongState,
  freshTwentyQuestionsState, freshHangmanState, freshWordScrambleState,
  applyTicTacToeMove, applyRpsPick, applyRedBlackGuess, applyPongServe, applyPongReturn,
  applyTwentyQuestionsSecret, applyTwentyQuestionsQuestion, applyTwentyQuestionsAnswer,
  applyTwentyQuestionsGuess, applyHangmanSecret, applyHangmanGuess,
  applyWordScrambleSecret, applyWordScrambleGuess, coinFlip, hasDistinctLetters,
  RPS_CHOICES, RED_BLACK_CHOICES, PONG_POWERS, PONG_SERVE_ANGLE, PONG_RETURN_ANGLE,
  MAX_QUESTIONS, HANGMAN_SECRET_MAX, HANGMAN_GUESS_MAX,
  SCRAMBLE_SECRET_MIN, SCRAMBLE_SECRET_MAX, SCRAMBLE_GUESS_MAX,
  type Marker, type RpsChoice, type RedBlackChoice, type PongPower,
  type RpsState, type RedBlackState, type PongState, type TwentyQuestionsState,
  type HangmanState, type WordScrambleState, type YesNo, type TicTacToeState,
} from "../_shared/gameLogic.ts";
import { getIceServers, finalizeLiveMatch as finalizeLiveMatchAction } from "./live-actions.ts";

const EXPIRY_MS = 48 * 60 * 60 * 1000;
const ROOM_RE = /^[A-Za-z0-9_-]{3,64}$/;
const HANGMAN_RE = /^[A-Za-z][A-Za-z\s'-]*$/;
const SCRAMBLE_RE = /^[A-Za-z]{3,12}$/;
const SUPPORTED = new Set([
  GAME_TYPE, RPS_GAME_TYPE, RED_BLACK_GAME_TYPE, PONG_GAME_TYPE,
  TWENTY_QUESTIONS_GAME_TYPE, HANGMAN_GAME_TYPE, WORD_SCRAMBLE_GAME_TYPE,
]);

type ErrCode =
  | "not_found" | "expired" | "locked" | "not_a_player"
  | "invalid_move" | "not_ready" | "unsupported_game" | "invalid_room";

class ApiError extends Error {
  code: ErrCode;
  constructor(code: ErrCode, message: string) {
    super(message);
    this.code = code;
  }
}
function fail(code: ErrCode, message: string): never {
  throw new ApiError(code, message);
}

function admin(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) fail("not_ready", "Edge Function missing SUPABASE_URL or SERVICE_ROLE_KEY.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function freshStateFor(gameType: string): unknown {
  switch (gameType) {
    case GAME_TYPE: return freshTicTacToeState();
    case RPS_GAME_TYPE: return freshRpsState();
    case RED_BLACK_GAME_TYPE: return freshRedBlackState();
    case PONG_GAME_TYPE: return freshPongState();
    case TWENTY_QUESTIONS_GAME_TYPE: return freshTwentyQuestionsState();
    case HANGMAN_GAME_TYPE: return freshHangmanState();
    case WORD_SCRAMBLE_GAME_TYPE: return freshWordScrambleState();
    default: fail("unsupported_game", `Unknown game type "${gameType}".`);
  }
}

function maskState(gameType: string, state: unknown, marker: Marker | null): unknown {
  if (gameType === RPS_GAME_TYPE) {
    const s = state as RpsState;
    return s.phase === "picking" ? { ...s, picks: { X: null, O: null } } : s;
  }
  if (
    gameType === TWENTY_QUESTIONS_GAME_TYPE ||
    gameType === HANGMAN_GAME_TYPE ||
    gameType === WORD_SCRAMBLE_GAME_TYPE
  ) {
    const s = state as { secret: string | null; phase: string };
    if (marker !== "X" && s.phase !== "match_over") return { ...s, secret: null };
  }
  return state;
}

async function getGameBySlug(db: SupabaseClient, slug: string) {
  const { data, error } = await db.from("games").select("*").eq("slug", slug).maybeSingle();
  if (error) fail("not_found", error.message);
  return data as Record<string, unknown> | null;
}

async function getPlayer(db: SupabaseClient, gameId: string, deviceToken: string) {
  const { data, error } = await db
    .from("players")
    .select("*")
    .eq("game_id", gameId)
    .eq("device_token", deviceToken)
    .maybeSingle();
  if (error) fail("not_a_player", error.message);
  return data as Record<string, unknown> | null;
}

async function expireIfStale(db: SupabaseClient, game: Record<string, unknown>) {
  const status = game.status as string;
  const updated = game.updated_at as number;
  if ((status === "waiting" || status === "in_progress") && Date.now() - updated > EXPIRY_MS) {
    await db.from("games").update({ status: "abandoned", updated_at: Date.now() }).eq("id", game.id);
    return true;
  }
  return false;
}

async function createGame(db: SupabaseClient, body: Record<string, unknown>) {
  const gameType = String(body.gameType ?? "");
  const deviceToken = String(body.deviceToken ?? "");
  const requestedSlug = body.slug ? String(body.slug) : undefined;
  if (!SUPPORTED.has(gameType)) fail("unsupported_game", `"${gameType}" isn't available yet.`);
  if (!deviceToken || deviceToken.length < 8) {
    fail("not_a_player", "Missing device token — please refresh and try again.");
  }
  let slug: string;
  if (requestedSlug) {
    if (!ROOM_RE.test(requestedSlug)) {
      fail("invalid_room", "That room name isn't valid — use 3-64 letters, numbers, dashes or underscores.");
    }
    const existing = await getGameBySlug(db, requestedSlug);
    if (existing) {
      if (
        (existing.status === "waiting" || existing.status === "in_progress") &&
        existing.game_type === gameType
      ) {
        return { slug: existing.slug };
      }
      slug = crypto.randomUUID();
    } else slug = requestedSlug;
  } else slug = crypto.randomUUID();

  const now = Date.now();
  const { data: game, error } = await db.from("games").insert({
    slug,
    game_type: gameType,
    state: freshStateFor(gameType),
    status: "waiting",
    created_at: now,
    updated_at: now,
  }).select("*").single();
  if (error || !game) fail("invalid_move", error?.message ?? "Could not create game.");

  const { error: pErr } = await db.from("players").insert({
    game_id: game.id,
    device_token: deviceToken,
    role: "initiator",
    marker: "X",
    joined_at: now,
  });
  if (pErr) fail("invalid_move", pErr.message);
  return { slug };
}

async function joinGame(db: SupabaseClient, body: Record<string, unknown>) {
  const slug = String(body.slug ?? "");
  const deviceToken = String(body.deviceToken ?? "");
  const game = await getGameBySlug(db, slug);
  if (!game) fail("not_found", "This game doesn't exist (or the link is wrong).");
  if (await expireIfStale(db, game)) fail("expired", "This game sat untouched for 48 hours, so it was closed.");

  const me = await getPlayer(db, game.id as string, deviceToken);
  if (me) {
    await db.from("games").update({ updated_at: Date.now() }).eq("id", game.id);
    return { joined: true, me: { role: me.role, marker: me.marker } };
  }
  if (game.status !== "waiting") {
    fail("locked", "This game is already in progress — only the original two players can play it.");
  }
  const joinedAt = Date.now();
  const { error } = await db.from("players").insert({
    game_id: game.id,
    device_token: deviceToken,
    role: "responder",
    marker: "O",
    joined_at: joinedAt,
  });
  if (error) fail("invalid_move", error.message);
  await db.from("games").update({ status: "in_progress", updated_at: joinedAt }).eq("id", game.id);
  return { joined: true, me: { role: "responder", marker: "O" } };
}

async function getGameState(db: SupabaseClient, body: Record<string, unknown>) {
  const slug = String(body.slug ?? "");
  const deviceToken = String(body.deviceToken ?? "");
  const game = await getGameBySlug(db, slug);
  if (!game) fail("not_found", "This game doesn't exist (or the link is wrong).");
  const me = await getPlayer(db, game.id as string, deviceToken);
  if (!me && (game.status === "in_progress" || game.status === "completed")) {
    fail("locked", "This game is already in progress — only the original two players can access it.");
  }
  const marker = (me?.marker as Marker) ?? null;
  const rps = game.game_type === RPS_GAME_TYPE ? (game.state as RpsState) : null;
  return {
    status: game.status,
    gameType: game.game_type,
    state: maskState(game.game_type as string, game.state, marker),
    me: me
      ? {
          role: me.role,
          marker: me.marker,
          picked: rps ? rps.picks[me.marker as Marker] !== null : undefined,
        }
      : null,
  };
}

// NOTE: submitMove / playAgain / submitFeedback + Deno.serve continue in repo history
// Full body restored from commit 968e08c with Phase 3 cases.
async function submitMove(db: SupabaseClient, body: Record<string, unknown>) {
  fail("not_ready", "Edge Function partially restored — redeploy from commit 968e08c + live-actions.");
}

async function playAgain(db: SupabaseClient, body: Record<string, unknown>) {
  fail("not_ready", "Edge Function partially restored — redeploy from commit 968e08c + live-actions.");
}

async function submitFeedback(db: SupabaseClient, body: Record<string, unknown>) {
  fail("not_ready", "Edge Function partially restored — redeploy from commit 968e08c + live-actions.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const db = admin();
    let result: unknown;
    switch (action) {
      case "createGame": result = await createGame(db, body); break;
      case "joinGame": result = await joinGame(db, body); break;
      case "getGameState": result = await getGameState(db, body); break;
      case "submitMove": result = await submitMove(db, body); break;
      case "playAgain": result = await playAgain(db, body); break;
      case "submitFeedback": result = await submitFeedback(db, body); break;
      case "getIceServers": result = await getIceServers(); break;
      case "finalizeLiveMatch":
        result = await finalizeLiveMatchAction(db, body, { fail, getGameBySlug, getPlayer });
        break;
      default: fail("invalid_move", `Unknown action "${action}".`);
    }
    return jsonResponse(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return jsonResponse({ error: { code: err.code, message: err.message } }, 400);
    }
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return jsonResponse({ error: { code: "not_ready", message } }, 500);
  }
});
