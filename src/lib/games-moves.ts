import { supabase } from "@/lib/supabase";
import {
  fail, freshStateFor, getGameBySlug, getPlayer, expireIfStale, maskState,
} from "@/lib/games-create";
import {
  RPS_GAME_TYPE, RED_BLACK_GAME_TYPE, PONG_GAME_TYPE,
  TWENTY_QUESTIONS_GAME_TYPE, HANGMAN_GAME_TYPE, WORD_SCRAMBLE_GAME_TYPE,
  applyTicTacToeMove, applyRpsPick, applyRedBlackGuess, applyPongServe, applyPongReturn,
  applyTwentyQuestionsSecret, applyTwentyQuestionsQuestion, applyTwentyQuestionsAnswer,
  applyTwentyQuestionsGuess, applyHangmanSecret, applyHangmanGuess,
  applyWordScrambleSecret, applyWordScrambleGuess, coinFlip, hasDistinctLetters,
  RPS_CHOICES, RED_BLACK_CHOICES, PONG_POWERS, PONG_SERVE_ANGLE, PONG_RETURN_ANGLE,
  MAX_QUESTIONS, HANGMAN_SECRET_MAX, HANGMAN_GUESS_MAX,
  SCRAMBLE_SECRET_MIN, SCRAMBLE_SECRET_MAX, SCRAMBLE_GUESS_MAX,
  type Marker as LogicMarker, type RpsChoice, type RedBlackChoice, type PongPower,
  type RpsState, type RedBlackState, type PongState, type TwentyQuestionsState,
  type HangmanState, type WordScrambleState, type YesNo,
} from "@/convex/gameLogic";
import type { TicTacToeState } from "@/convex/schema";

const HANGMAN_RE = /^[A-Za-z][A-Za-z\s'-]*$/;
const SCRAMBLE_RE = /^[A-Za-z]{3,12}$/;

export type SubmitMoveArgs = {
  slug: string; deviceToken: string; cell?: number; pick?: string;
  angle?: number; power?: number; secret?: string; question?: string;
  answer?: "yes" | "no"; guess?: string;
};

export async function submitMove(args: SubmitMoveArgs) {
  const { slug, deviceToken, cell, pick, angle, power, secret, question, answer, guess } = args;
  const game = await getGameBySlug(slug);
  if (!game) fail("not_found", "This game doesn't exist (or the link is wrong).");
  if (await expireIfStale(game)) fail("expired", "This game sat untouched for 48 hours, so it was closed.");
  const player = await getPlayer(game.id, deviceToken);
  if (!player) fail("not_a_player", "You're not registered on this game — open it from your own invite link.");
  if (game.status !== "in_progress") fail("invalid_move", "This game isn't in progress right now.");

  const marker = player.marker as LogicMarker;
  const now = Date.now();
  let newState: unknown = game.state;
  let over = false;
  let payload: Record<string, unknown> = {};
  const gt = game.game_type;

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

  await supabase.from("moves").insert({
    game_id: game.id, player_id: player.id, payload, created_at: now,
  });
  await supabase.from("games").update({
    state: newState as object, status: over ? "completed" : "in_progress", updated_at: now,
  }).eq("id", game.id);
  return { ok: true, state: maskState(gt, newState, marker) };
}

export async function playAgain(args: { slug: string; deviceToken: string }) {
  const { slug, deviceToken } = args;
  const game = await getGameBySlug(slug);
  if (!game) fail("not_found", "This game doesn't exist (or the link is wrong).");
  const me = await getPlayer(game.id, deviceToken);
  if (!me) fail("not_a_player", "You're not registered on this game — open it from your own invite link.");
  const { data: players } = await supabase.from("players").select("*").eq("game_id", game.id);
  if (!players || players.length < 2) {
    fail("not_ready", "Wait for your opponent to join before starting a rematch.");
  }
  const opponent = players.find((p) => p.device_token !== deviceToken) ?? players[0];
  const now = Date.now();
  const newSlug = crypto.randomUUID();
  const { data: newGame, error } = await supabase.from("games").insert({
    slug: newSlug, game_type: game.game_type, state: freshStateFor(game.game_type) as object,
    status: "in_progress", created_at: now, updated_at: now,
  }).select("*").single();
  if (error || !newGame) fail("invalid_move", error?.message ?? "Rematch failed.");
  await supabase.from("players").insert([
    { game_id: newGame.id, device_token: deviceToken, role: "initiator", marker: "X", joined_at: now },
    { game_id: newGame.id, device_token: opponent.device_token, role: "responder", marker: "O", joined_at: now },
  ]);
  await supabase.from("games").update({
    state: { ...(game.state as object), rematch: { slug: newSlug, by: deviceToken } },
    updated_at: now,
  }).eq("id", game.id);
  return { slug: newSlug };
}

export async function submitFeedback(args: {
  slug: string; deviceToken: string; wouldPlayAgain: boolean; feltNatural?: boolean;
}) {
  const { slug, deviceToken, wouldPlayAgain, feltNatural } = args;
  const game = await getGameBySlug(slug);
  if (!game) fail("not_found", "This game doesn't exist (or the link is wrong).");
  const me = await getPlayer(game.id, deviceToken);
  if (!me) fail("not_a_player", "You're not registered on this game — open it from your own invite link.");
  await supabase.from("feedback").insert({
    game_id: game.id, felt_natural: feltNatural ?? null,
    would_play_again: wouldPlayAgain, created_at: Date.now(),
  });
  return { ok: true };
}

export function subscribeGame(slug: string, onChange: () => void): () => void {
  const channel = supabase.channel(`game:${slug}`).on(
    "postgres_changes",
    { event: "*", schema: "public", table: "games", filter: `slug=eq.${slug}` },
    () => onChange(),
  ).subscribe();
  return () => { void supabase.removeChannel(channel); };
}
