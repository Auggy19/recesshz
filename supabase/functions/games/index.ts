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

async function submitMove(db: SupabaseClient, body: Record<string, unknown>) {
  const slug = String(body.slug ?? "");
  const deviceToken = String(body.deviceToken ?? "");
  const cell = body.cell as number | undefined;
  const pick = body.pick as string | undefined;
  const angle = body.angle as number | undefined;
  const power = body.power as number | undefined;
  const secret = body.secret as string | undefined;
  const question = body.question as string | undefined;
  const answer = body.answer as "yes" | "no" | undefined;
  const guess = body.guess as string | undefined;

  const game = await getGameBySlug(db, slug);
  if (!game) fail("not_found", "This game doesn't exist (or the link is wrong).");
  if (await expireIfStale(db, game)) fail("expired", "This game sat untouched for 48 hours, so it was closed.");
  const player = await getPlayer(db, game.id as string, deviceToken);
  if (!player) fail("not_a_player", "You're not registered on this game — open it from your own invite link.");
  if (game.status !== "in_progress") fail("invalid_move", "This game isn't in progress right now.");

  const marker = player.marker as Marker;
  const now = Date.now();
  let newState: unknown = game.state;
  let over = false;
  let payload: Record<string, unknown> = {};
  const gt = game.game_type as string;

  if (gt === RPS_GAME_TYPE) {
    if (!pick || !RPS_CHOICES.includes(pick as RpsChoice)) fail("invalid_move", "Pick rock, paper, or scissors.");
    const state = game.state as RpsState;
    if (state.matchWinner) fail("invalid_move", "This match is already over.");
    if (state.phase === "picking" && state.picks[marker] !== null) {
      fail("invalid_move", "You already picked this round — wait for your friend.");
    }
    const o = applyRpsPick(state, marker, pick as RpsChoice);
    newState = o.state; over = o.over; payload = { pick, marker, round: o.state.round };
  } else if (gt === RED_BLACK_GAME_TYPE) {
    if (!pick || !RED_BLACK_CHOICES.includes(pick as RedBlackChoice)) fail("invalid_move", "Pick red or black.");
    if (marker !== "O") fail("invalid_move", "You're the host — your friend picks the color, you watch the reveal.");
    const state = game.state as RedBlackState;
    if (state.matchWinner) fail("invalid_move", "This match is already over.");
    const o = applyRedBlackGuess(state, pick as RedBlackChoice, coinFlip());
    newState = o.state; over = o.over; payload = { guess: pick, marker, round: o.state.round };
  } else if (gt === PONG_GAME_TYPE) {
    const state = game.state as PongState;
    if (state.matchWinner) fail("invalid_move", "This match is already over.");
    const isServe = state.phase === "serve" || state.phase === "point_over";
    if (!isServe && state.phase !== "return") fail("invalid_move", "This match isn't mid-point right now.");
    if (state.turn !== marker) fail("invalid_move", "It's not your turn yet — silence is safe here.");
    if (typeof power !== "number" || !PONG_POWERS.includes(power as PongPower)) {
      fail("invalid_move", "Pick a power: lob, drive, or smash.");
    }
    if (typeof angle !== "number" || !Number.isInteger(angle)) fail("invalid_move", "That angle isn't valid.");
    const maxA = isServe ? PONG_SERVE_ANGLE : PONG_RETURN_ANGLE;
    if (angle < -maxA || angle > maxA) {
      fail("invalid_move", isServe ? "Serve angles run from -60° to +60°." : "Return angles run from -45° to +45°.");
    }
    const o = isServe
      ? applyPongServe(state, marker, angle, power as PongPower)
      : applyPongReturn(state, marker, angle, power as PongPower);
    newState = o.state; over = o.over;
    payload = { type: isServe ? "serve" : "return", angle, power, marker };
  } else if (gt === TWENTY_QUESTIONS_GAME_TYPE) {
    const state = game.state as TwentyQuestionsState;
    if (state.winner) fail("invalid_move", "This match is already over.");
    const fields = [secret, question, answer, guess].filter((f) => f !== undefined);
    if (fields.length !== 1) fail("invalid_move", "Send exactly one action — a secret, a question, an answer, or a guess.");
    if (secret !== undefined) {
      if (state.phase !== "setup") fail("invalid_move", "The secret is already locked in.");
      if (marker !== "X") fail("invalid_move", "Only the answerer picks the secret.");
      const s = secret.trim();
      if (!s || s.length > 80) fail("invalid_move", "Pick a short secret — 1 to 80 characters.");
      newState = applyTwentyQuestionsSecret(state, s); payload = { type: "secret", marker };
    } else if (question !== undefined) {
      if (marker !== "O") fail("invalid_move", "Only the asker asks questions.");
      if (state.phase === "setup") fail("invalid_move", "Wait for the secret first.");
      if (state.phase === "final") fail("invalid_move", "That's all your questions — make your final guess.");
      if (state.pendingQuestion !== null) fail("invalid_move", "Answer the question on the table first.");
      if (state.questions.length >= MAX_QUESTIONS) fail("invalid_move", "That's all 20 questions — make your guess.");
      const q = question.trim();
      if (!q || q.length > 200) fail("invalid_move", "Questions run 1 to 200 characters.");
      newState = applyTwentyQuestionsQuestion(state, q); payload = { type: "question", question: q, marker };
    } else if (answer !== undefined) {
      if (marker !== "X") fail("invalid_move", "Only the answerer answers questions.");
      if (state.phase !== "asking" || state.pendingQuestion === null) fail("invalid_move", "There's no question to answer right now.");
      newState = applyTwentyQuestionsAnswer(state, answer as YesNo); payload = { type: "answer", answer, marker };
    } else if (guess !== undefined) {
      if (marker !== "O") fail("invalid_move", "Only the asker guesses.");
      if (state.phase === "setup") fail("invalid_move", "Wait for the secret first.");
      if (state.pendingQuestion !== null) fail("invalid_move", "Answer the question on the table first.");
      const trimmed = guess.trim();
      if (!trimmed || trimmed.length > 200) fail("invalid_move", "Guesses run 1 to 200 characters.");
      const o = applyTwentyQuestionsGuess(state, trimmed);
      newState = o.state; over = o.over; payload = { type: "guess", guess: trimmed, marker };
    }
  } else if (gt === HANGMAN_GAME_TYPE) {
    const state = game.state as HangmanState;
    if (state.winner) fail("invalid_move", "This match is already over.");
    const fields = [secret, guess].filter((f) => f !== undefined);
    if (fields.length !== 1) fail("invalid_move", "Send exactly one action — a secret word or a guess.");
    if (secret !== undefined) {
      if (state.phase !== "setup") fail("invalid_move", "The word is already locked in.");
      if (marker !== "X") fail("invalid_move", "Only the word setter picks the word.");
      const s = secret.trim();
      if (!HANGMAN_RE.test(s) || s.length < 2 || s.length > HANGMAN_SECRET_MAX) {
        fail("invalid_move", "Pick a word or phrase — 2 to 24 letters; spaces and dashes are fine.");
      }
      newState = applyHangmanSecret(state, s); payload = { type: "secret", marker };
    } else {
      if (marker !== "O") fail("invalid_move", "Only the guesser guesses.");
      if (state.phase === "setup") fail("invalid_move", "Wait for the word first.");
      const g = (guess ?? "").trim();
      if (!g || g.length > HANGMAN_GUESS_MAX) fail("invalid_move", "Guesses run 1 to 40 characters.");
      const isLetter = g.length === 1;
      if (isLetter && !/[a-z]/i.test(g)) fail("invalid_move", "Guess a letter a–z, or the whole word.");
      if (isLetter && state.guessed.includes(g.toLowerCase())) fail("invalid_move", "You already tried that letter.");
      const o = applyHangmanGuess(state, g);
      newState = o.state; over = o.over; payload = { type: isLetter ? "letter" : "word", guess: g, marker };
    }
  } else if (gt === WORD_SCRAMBLE_GAME_TYPE) {
    const state = game.state as WordScrambleState;
    if (state.winner) fail("invalid_move", "This match is already over.");
    const fields = [secret, guess].filter((f) => f !== undefined);
    if (fields.length !== 1) fail("invalid_move", "Send exactly one action — a secret word or an answer.");
    if (secret !== undefined) {
      if (state.phase !== "setup") fail("invalid_move", "The word is already locked in.");
      if (marker !== "X") fail("invalid_move", "Only the word setter picks the word.");
      const s = secret.trim();
      if (!SCRAMBLE_RE.test(s) || s.length < SCRAMBLE_SECRET_MIN || s.length > SCRAMBLE_SECRET_MAX || !hasDistinctLetters(s)) {
        fail("invalid_move", "Pick a single word — 3 to 12 letters, with at least two different letters.");
      }
      newState = applyWordScrambleSecret(state, s); payload = { type: "secret", marker };
    } else {
      if (marker !== "O") fail("invalid_move", "Only the solver answers.");
      if (state.phase === "setup") fail("invalid_move", "Wait for the scrambled word first.");
      const g = (guess ?? "").trim();
      if (!g || g.length > SCRAMBLE_GUESS_MAX) fail("invalid_move", "Answers run 1 to 20 characters.");
      if (state.wrongGuesses.some((w) => w.toLowerCase() === g.toLowerCase())) {
        fail("invalid_move", "You already tried that answer.");
      }
      const o = applyWordScrambleGuess(state, g);
      newState = o.state; over = o.over; payload = { type: "answer", guess: g, marker };
    }
  } else {
    const state = game.state as TicTacToeState;
    if (typeof cell !== "number" || !Number.isInteger(cell) || cell < 0 || cell > 8) {
      fail("invalid_move", "That move is off the board.");
    }
    if (state.winner || state.draw) fail("invalid_move", "This game is already over.");
    if (state.board[cell] !== "") fail("invalid_move", "That cell is already taken.");
    if (state.turn !== marker) fail("invalid_move", "It's not your turn yet — silence is safe here.");
    const o = applyTicTacToeMove(state, cell, marker);
    newState = o.state; over = o.over; payload = { cell, marker };
  }

  await db.from("moves").insert({
    game_id: game.id, player_id: player.id, payload, created_at: now,
  });
  await db.from("games").update({
    state: newState, status: over ? "completed" : "in_progress", updated_at: now,
  }).eq("id", game.id);
  return { ok: true, state: maskState(gt, newState, marker) };
}

async function playAgain(db: SupabaseClient, body: Record<string, unknown>) {
  const slug = String(body.slug ?? "");
  const deviceToken = String(body.deviceToken ?? "");
  const game = await getGameBySlug(db, slug);
  if (!game) fail("not_found", "This game doesn't exist (or the link is wrong).");
  const me = await getPlayer(db, game.id as string, deviceToken);
  if (!me) fail("not_a_player", "You're not registered on this game — open it from your own invite link.");
  const { data: players } = await db.from("players").select("*").eq("game_id", game.id);
  if (!players || players.length < 2) {
    fail("not_ready", "Wait for your opponent to join before starting a rematch.");
  }
  const opponent = players.find((p) => p.device_token !== deviceToken) ?? players[0];
  const now = Date.now();
  const newSlug = crypto.randomUUID();
  const { data: newGame, error } = await db.from("games").insert({
    slug: newSlug,
    game_type: game.game_type,
    state: freshStateFor(game.game_type as string),
    status: "in_progress",
    created_at: now,
    updated_at: now,
  }).select("*").single();
  if (error || !newGame) fail("invalid_move", error?.message ?? "Rematch failed.");
  await db.from("players").insert([
    { game_id: newGame.id, device_token: deviceToken, role: "initiator", marker: "X", joined_at: now },
    { game_id: newGame.id, device_token: opponent.device_token, role: "responder", marker: "O", joined_at: now },
  ]);
  await db.from("games").update({
    state: { ...(game.state as object), rematch: { slug: newSlug, by: deviceToken } },
    updated_at: now,
  }).eq("id", game.id);
  return { slug: newSlug };
}

async function submitFeedback(db: SupabaseClient, body: Record<string, unknown>) {
  const slug = String(body.slug ?? "");
  const deviceToken = String(body.deviceToken ?? "");
  const wouldPlayAgain = Boolean(body.wouldPlayAgain);
  const feltNatural = body.feltNatural as boolean | undefined;
  const game = await getGameBySlug(db, slug);
  if (!game) fail("not_found", "This game doesn't exist (or the link is wrong).");
  const me = await getPlayer(db, game.id as string, deviceToken);
  if (!me) fail("not_a_player", "You're not registered on this game — open it from your own invite link.");
  await db.from("feedback").insert({
    game_id: game.id,
    felt_natural: feltNatural ?? null,
    would_play_again: wouldPlayAgain,
    created_at: Date.now(),
  });
  return { ok: true };
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
