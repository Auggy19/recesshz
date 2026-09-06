// Counters Ball + full move handlers for Edge games function
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  RPS_GAME_TYPE, RED_BLACK_GAME_TYPE, PONG_GAME_TYPE,
  TWENTY_QUESTIONS_GAME_TYPE, HANGMAN_GAME_TYPE, WORD_SCRAMBLE_GAME_TYPE,
  applyTicTacToeMove, applyRpsPick, applyRedBlackGuess, applyPongServe, applyPongReturn,
  applyTwentyQuestionsSecret, applyTwentyQuestionsQuestion, applyTwentyQuestionsAnswer,
  applyTwentyQuestionsGuess, applyHangmanSecret, applyHangmanGuess,
  applyWordScrambleSecret, applyWordScrambleGuess, coinFlip, hasDistinctLetters,
  RPS_CHOICES, RED_BLACK_CHOICES, PONG_POWERS, PONG_SERVE_ANGLE, PONG_RETURN_ANGLE,
  HANGMAN_SECRET_MAX, HANGMAN_GUESS_MAX,
  SCRAMBLE_SECRET_MIN, SCRAMBLE_SECRET_MAX, SCRAMBLE_GUESS_MAX,
  type Marker, type RpsChoice, type RedBlackChoice, type PongPower,
  type RpsState, type RedBlackState, type PongState, type TwentyQuestionsState,
  type HangmanState, type WordScrambleState, type TicTacToeState,
} from "../_shared/gameLogic.ts";
import {
  COUNTERS_BALL_GAME_TYPE,
  canFlick as canCountersBallFlick,
  runToRest as runCountersBallToRest,
  type CountersBallState,
} from "../_shared/countersBall/index.ts";

const HANGMAN_RE = /^[A-Za-z][A-Za-z\s'-]*$/;
const SCRAMBLE_RE = /^[A-Za-z]{3,12}$/;

type Fail = (code: string, message: string) => never;
type MaskState = (gameType: string, state: unknown, marker: Marker | null) => unknown;
type GetGame = (db: SupabaseClient, slug: string) => Promise<Record<string, unknown> | null>;
type GetPlayer = (db: SupabaseClient, gameId: string, deviceToken: string) => Promise<Record<string, unknown> | null>;
type Expire = (db: SupabaseClient, game: Record<string, unknown>) => Promise<boolean>;
type Fresh = (gameType: string) => unknown;

export async function submitMoveAction(
  db: SupabaseClient,
  body: Record<string, unknown>,
  deps: {
    fail: Fail;
    getGameBySlug: GetGame;
    getPlayer: GetPlayer;
    expireIfStale: Expire;
    maskState: MaskState;
  },
) {
  const { fail, getGameBySlug, getPlayer, expireIfStale, maskState } = deps;
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
  const capId = body.capId as string | undefined;
  const ix = body.ix as number | undefined;
  const iy = body.iy as number | undefined;
  const spin = body.spin as number | undefined;

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
      newState = applyTwentyQuestionsSecret(state, s);
      payload = { type: "secret", marker };
    } else if (question !== undefined) {
      if (state.phase !== "asking") fail("invalid_move", "Questions aren't open right now.");
      if (marker !== "O") fail("invalid_move", "Only the guesser asks questions.");
      if (state.pendingQuestion) fail("invalid_move", "Wait for an answer before asking another.");
      const q = question.trim();
      if (!q || q.length > 120) fail("invalid_move", "Keep questions under 120 characters.");
      newState = applyTwentyQuestionsQuestion(state, q);
      payload = { type: "question", question: q, marker };
    } else if (answer !== undefined) {
      if (state.phase !== "asking" || !state.pendingQuestion) fail("invalid_move", "There's no pending question.");
      if (marker !== "X") fail("invalid_move", "Only the answerer replies yes or no.");
      if (answer !== "yes" && answer !== "no") fail("invalid_move", "Answer yes or no.");
      newState = applyTwentyQuestionsAnswer(state, answer);
      payload = { type: "answer", answer, marker };
    } else {
      if (state.phase !== "asking" && state.phase !== "final") fail("invalid_move", "Guesses aren't open yet.");
      if (marker !== "O") fail("invalid_move", "Only the guesser can make a final guess.");
      const g = (guess ?? "").trim();
      if (!g || g.length > 80) fail("invalid_move", "Guesses must be 1–80 characters.");
      const o = applyTwentyQuestionsGuess(state, g);
      newState = o.state; over = o.over; payload = { type: "guess", guess: g, marker };
    }
  } else if (gt === HANGMAN_GAME_TYPE) {
    const state = game.state as HangmanState;
    if (state.winner) fail("invalid_move", "This match is already over.");
    if (secret !== undefined) {
      if (state.phase !== "setup") fail("invalid_move", "The word is already locked in.");
      if (marker !== "X") fail("invalid_move", "Only the host sets the word.");
      const s = secret.trim();
      if (!s || s.length > HANGMAN_SECRET_MAX || !HANGMAN_RE.test(s)) {
        fail("invalid_move", "Use a short word or phrase — letters, spaces, apostrophes only.");
      }
      newState = applyHangmanSecret(state, s);
      payload = { type: "secret", marker };
    } else if (guess !== undefined) {
      if (state.phase !== "guessing") fail("invalid_move", "Guessing isn't open yet.");
      if (marker !== "O") fail("invalid_move", "Only the guesser can guess.");
      const g = guess.trim();
      if (!g || g.length > HANGMAN_GUESS_MAX) fail("invalid_move", "That guess is empty or too long.");
      const o = applyHangmanGuess(state, g);
      newState = o.state; over = o.over; payload = { type: "guess", guess: g, marker };
    } else {
      fail("invalid_move", "Send a secret word or a guess.");
    }
  } else if (gt === WORD_SCRAMBLE_GAME_TYPE) {
    const state = game.state as WordScrambleState;
    if (state.winner) fail("invalid_move", "This match is already over.");
    if (secret !== undefined) {
      if (state.phase !== "setup") fail("invalid_move", "The word is already locked in.");
      if (marker !== "X") fail("invalid_move", "Only the host sets the word.");
      const s = secret.trim();
      if (!SCRAMBLE_RE.test(s) || s.length < SCRAMBLE_SECRET_MIN || s.length > SCRAMBLE_SECRET_MAX) {
        fail("invalid_move", "Use a 3–12 letter word.");
      }
      if (!hasDistinctLetters(s)) fail("invalid_move", "Pick a word with at least two different letters.");
      newState = applyWordScrambleSecret(state, s);
      payload = { type: "secret", marker };
    } else if (guess !== undefined) {
      if (state.phase !== "solving") fail("invalid_move", "Solving isn't open yet.");
      if (marker !== "O") fail("invalid_move", "Only the guesser can guess.");
      const g = guess.trim();
      if (!g || g.length > SCRAMBLE_GUESS_MAX) fail("invalid_move", "That guess is empty or too long.");
      const o = applyWordScrambleGuess(state, g);
      newState = o.state; over = o.over; payload = { type: "guess", guess: g, marker };
    } else {
      fail("invalid_move", "Send a secret word or a guess.");
    }
  } else if (gt === COUNTERS_BALL_GAME_TYPE) {
    const state = game.state as CountersBallState;
    if (state.phase === "gameover" || state.winner !== null) {
      fail("invalid_move", "This match is already over.");
    }
    if (typeof capId !== "string" || !capId) {
      fail("invalid_move", "Pick one of your caps to flick.");
    }
    if (typeof ix !== "number" || typeof iy !== "number" || !Number.isFinite(ix) || !Number.isFinite(iy)) {
      fail("invalid_move", "That flick isn't valid.");
    }
    const team = marker === "X" ? 0 : 1;
    if (!canCountersBallFlick(state, team, capId)) {
      fail("invalid_move", "It's not your turn, or that isn't your cap.");
    }
    const impulse = {
      capId,
      ix,
      iy,
      spin: typeof spin === "number" && Number.isFinite(spin) ? spin : undefined,
    };
    const result = runCountersBallToRest(state, impulse);
    newState = result.state;
    over = result.state.phase === "gameover" || result.state.winner !== null;
    payload = {
      type: "flick",
      capId,
      ix,
      iy,
      spin: impulse.spin ?? null,
      marker,
      events: result.events,
    };
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

  const { error: mErr } = await db.from("moves").insert({
    game_id: game.id,
    player_id: player.id,
    payload,
    created_at: now,
  });
  if (mErr) fail("invalid_move", mErr.message);

  const { error: gErr } = await db.from("games").update({
    state: newState as object,
    status: over ? "completed" : "in_progress",
    updated_at: now,
  }).eq("id", game.id);
  if (gErr) fail("invalid_move", gErr.message);

  return { ok: true, state: maskState(gt, newState, marker) };
}

export async function playAgainAction(
  db: SupabaseClient,
  body: Record<string, unknown>,
  deps: {
    fail: Fail;
    getGameBySlug: GetGame;
    getPlayer: GetPlayer;
    freshStateFor: Fresh;
  },
) {
  const { fail, getGameBySlug, getPlayer, freshStateFor } = deps;
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
  const opponent = players.find((p: { device_token: string }) => p.device_token !== deviceToken) ?? players[0];
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

export async function submitFeedbackAction(
  db: SupabaseClient,
  body: Record<string, unknown>,
  deps: {
    fail: Fail;
    getGameBySlug: GetGame;
    getPlayer: GetPlayer;
  },
) {
  const { fail, getGameBySlug, getPlayer } = deps;
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
