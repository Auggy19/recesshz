// ---------------------------------------------------------------------------
// Recess game rules.
//
// This module is intentionally standalone (pure functions, no Convex imports)
// so the same pattern can be cloned to add Twenty Questions or Truth or Dare:
// write a `fresh<Game>State()` and an `apply<Game>Move()` for the new game
// type and wire it into `games.ts`.
// ---------------------------------------------------------------------------

import type { TicTacToeState } from "./schema";

// ---------------------------------------------------------------------------
// Tic Tac Toe rules
// ---------------------------------------------------------------------------

export const GAME_TYPE = "tic_tac_toe" as const;

export type Marker = "X" | "O";
export type Cell = "" | Marker;
export type Board = Cell[]; // always length 9

// The 8 lines that win: 3 rows, 3 columns, 2 diagonals.
export const WIN_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8], // rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8], // columns
  [0, 4, 8],
  [2, 4, 6], // diagonals
];

export function freshTicTacToeState(): TicTacToeState {
  return {
    board: Array(9).fill("") as Board,
    turn: "X",
    winner: null,
    draw: false,
    winningLine: null,
  };
}

export function otherMarker(marker: Marker): Marker {
  return marker === "X" ? "O" : "X";
}

/** Returns the winning line if `board` has three-in-a-row, else null. */
export function findWinningLine(board: Board): number[] | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] !== "" && board[a] === board[b] && board[a] === board[c]) {
      return line;
    }
  }
  return null;
}

export function isBoardFull(board: Board): boolean {
  return board.every((cell) => cell !== "");
}

export interface MoveOutcome {
  state: TicTacToeState;
  over: boolean;
}

/**
 * Apply a single move to the current state. Callers are expected to have
 * already validated the move (correct turn, empty cell, game in progress) —
 * this function just computes the new state. Never trust the client: callers
 * must gate on `validateMove` results from the server.
 */
export function applyTicTacToeMove(
  current: TicTacToeState,
  cell: number,
  marker: Marker,
): MoveOutcome {
  const board = [...current.board] as Board;
  board[cell] = marker;

  const winningLine = findWinningLine(board);
  const draw = winningLine === null && isBoardFull(board);
  const over = winningLine !== null || draw;

  return {
    state: {
      board,
      turn: otherMarker(marker),
      winner: winningLine ? marker : null,
      draw,
      winningLine,
      rematch: current.rematch,
    },
    over,
  };
}

// ---------------------------------------------------------------------------
// Rock Paper Scissors rules — best of 3, picks hidden until both are in.
// ---------------------------------------------------------------------------

export const RPS_GAME_TYPE = "rock_paper_scissors" as const;

export type RpsChoice = "rock" | "paper" | "scissors";
export const RPS_CHOICES: RpsChoice[] = ["rock", "paper", "scissors"];

export interface RpsPicks {
  X: RpsChoice | null;
  O: RpsChoice | null;
}

export interface RpsState {
  /** Current round number (1..3). Draws replay the same round. */
  round: number;
  /** picking = still waiting for both picks; resolved = round complete. */
  phase: "picking" | "resolved";
  /** The current round's picks. Never revealed until both are in. */
  picks: RpsPicks;
  scores: { X: number; O: number };
  /** Outcome of the last resolved round. */
  winner: "X" | "O" | "draw" | null;
  /** First to two round-wins takes the match. */
  matchWinner: Marker | null;
  rematch?: { slug: string; by: string };
}

export function freshRpsState(): RpsState {
  return {
    round: 1,
    phase: "picking",
    picks: { X: null, O: null },
    scores: { X: 0, O: 0 },
    winner: null,
    matchWinner: null,
  };
}

/** True when `a` beats `b`. */
export function beats(a: RpsChoice, b: RpsChoice): boolean {
  return (
    (a === "rock" && b === "scissors") ||
    (a === "scissors" && b === "paper") ||
    (a === "paper" && b === "rock")
  );
}

export interface RpsMoveOutcome {
  state: RpsState;
  over: boolean;
}

/**
 * Apply one player's pick. Callers validate first (game in progress, valid
 * pick, not already picked this round, match not over).
 *
 * A round resolves only once both picks are in; until then the state just
 * holds the single pick (and callers must mask it on reads). When the round
 * is already resolved, submitting a pick advances past it — draws replay the
 * same round, wins move to the next — and then applies the pick to it.
 */
export function applyRpsPick(
  current: RpsState,
  marker: Marker,
  pick: RpsChoice,
): RpsMoveOutcome {
  let base: RpsState = current;
  if (base.phase === "resolved") {
    base = {
      ...base,
      round: base.winner === "draw" ? base.round : base.round + 1,
      phase: "picking",
      picks: { X: null, O: null },
    };
  }

  const picks: RpsPicks = { ...base.picks, [marker]: pick };
  if (picks.X === null || picks.O === null) {
    return { state: { ...base, picks }, over: false };
  }

  const x = picks.X;
  const o = picks.O;
  const outcome: "X" | "O" | "draw" =
    x === o ? "draw" : beats(x, o) ? "X" : "O";
  const scores =
    outcome === "draw"
      ? base.scores
      : { ...base.scores, [outcome]: base.scores[outcome] + 1 };
  const matchWinner: Marker | null =
    outcome !== "draw" && scores[outcome] >= 2 ? outcome : null;

  return {
    state: {
      ...base,
      picks,
      scores,
      winner: outcome,
      phase: "resolved",
      matchWinner,
    },
    over: matchWinner !== null,
  };
}

// ---------------------------------------------------------------------------
// Red or Black rules — best of 3.
//
// The responder (O) guesses "red" or "black"; the server draws the card
// outcome (never the client), and a correct guess scores O while a miss
// scores X (the host). First to two round wins takes the match — the same
// scoring shape as Rock Paper Scissors.
// ---------------------------------------------------------------------------

export const RED_BLACK_GAME_TYPE = "red_or_black" as const;

export type RedBlackChoice = "red" | "black";
export const RED_BLACK_CHOICES: RedBlackChoice[] = ["red", "black"];

export interface RedBlackState {
  /** Current round number (1..3). Every round has a winner, so it advances. */
  round: number;
  /** picking = waiting for O's guess; resolved = guess + draw revealed. */
  phase: "picking" | "resolved";
  /** O's guess for the current round (null while picking). */
  guess: RedBlackChoice | null;
  /** The server's draw for the current round (null while picking). */
  draw: RedBlackChoice | null;
  scores: { X: number; O: number };
  /** Who took the last resolved round. */
  winner: "X" | "O" | null;
  /** First to two round wins takes the match. */
  matchWinner: Marker | null;
  rematch?: { slug: string; by: string };
}

export function freshRedBlackState(): RedBlackState {
  return {
    round: 1,
    phase: "picking",
    guess: null,
    draw: null,
    scores: { X: 0, O: 0 },
    winner: null,
    matchWinner: null,
  };
}

/**
 * A cryptographically fair 50/50 draw. Called server-side only — the client
 * never supplies or sees the outcome before the guess is locked in.
 */
export function coinFlip(): RedBlackChoice {
  return (crypto.getRandomValues(new Uint8Array(1))[0] & 1) === 0
    ? "red"
    : "black";
}

export interface RedBlackOutcome {
  state: RedBlackState;
  over: boolean;
}

/**
 * Apply O's guess against the server's draw. Callers validate first (game in
 * progress, valid guess, guessing player is O, match not over). A resolved
 * round means the previous result is on screen — the next guess advances to
 * the following round and then resolves immediately (there is no replay:
 * every round has a winner).
 */
export function applyRedBlackGuess(
  current: RedBlackState,
  guess: RedBlackChoice,
  draw: RedBlackChoice,
): RedBlackOutcome {
  let base: RedBlackState = current;
  if (base.phase === "resolved") {
    base = {
      ...base,
      round: base.round + 1,
      phase: "picking",
      guess: null,
      draw: null,
      winner: null,
    };
  }

  const winner: "X" | "O" = guess === draw ? "O" : "X";
  const scores = { ...base.scores, [winner]: base.scores[winner] + 1 };
  const matchWinner: Marker | null = scores[winner] >= 2 ? winner : null;

  return {
    state: {
      ...base,
      guess,
      draw,
      scores,
      winner,
      phase: "resolved",
      matchWinner,
    },
    over: matchWinner !== null,
  };
}

// ---------------------------------------------------------------------------
// Pong rules — correspondence paddle tennis, first to 7.
//
// Pong is real-time by nature, so Recess plays it by message: each point is
// two moves. The server picks a shot (angle + power); the returner — who
// sees the incoming shot, never hidden — picks a return. The ball is always
// in play, so the point goes to the returner if their return mirrors the
// incoming angle closely enough, otherwise to the server. The point winner
// serves the next point; first to seven points takes the match.
// ---------------------------------------------------------------------------

export const PONG_GAME_TYPE = "pong" as const;

export type PongPower = 1 | 2 | 3;
export const PONG_POWERS: PongPower[] = [1, 2, 3];

export interface PongShot {
  angle: number;
  power: PongPower;
}

export interface PongState {
  /** serve = waiting for the server's shot; return = shot in flight, waiting
   *  for the return; point_over = point resolved, winner serves next;
   *  match_over = someone hit seven. */
  phase: "serve" | "return" | "point_over" | "match_over";
  /** Who must act next — the server on serve/point_over, the returner on
   *  return. After a match ends this is the match winner. */
  turn: Marker;
  /** The in-flight shot, visible to the returner (that's the whole game). */
  serve: PongShot | null;
  scores: { X: number; O: number };
  /** How the last point resolved — shown on both screens. */
  lastPoint: {
    winner: Marker;
    serve: PongShot;
    ret: PongShot;
    /** True when the returner's shot mirrored the incoming angle. */
    good: boolean;
  } | null;
  /** First to seven points takes the match. */
  matchWinner: Marker | null;
  rematch?: { slug: string; by: string };
}

/** Points needed to win a Pong match. */
export const PONG_TARGET = 7;
/** Serves run ±60°; returns ±45° (a wild return sails out of bounds). */
export const PONG_SERVE_ANGLE = 60;
export const PONG_RETURN_ANGLE = 45;

export function freshPongState(): PongState {
  return {
    phase: "serve",
    turn: "X", // the initiator serves first
    serve: null,
    scores: { X: 0, O: 0 },
    lastPoint: null,
    matchWinner: null,
  };
}

/**
 * How close (in degrees) the return must come to the serve's mirror for the
 * return to count. Faster serves and harder returns both shrink the window —
 * a smash is risky, a lob is easy to read.
 */
export function pongReturnWindow(
  servePower: PongPower,
  returnPower: PongPower,
): number {
  return Math.max(4, 24 - (servePower - 1) * 6 - (returnPower - 1) * 2);
}

/** A return is good when it mirrors the incoming angle within the window. */
export function isGoodPongReturn(serve: PongShot, ret: PongShot): boolean {
  return (
    Math.abs(serve.angle + ret.angle) <= pongReturnWindow(serve.power, ret.power)
  );
}

/**
 * Record the server's shot. Callers validate phase (serve/point_over), turn,
 * and the angle/power ranges first. The shot is immediately visible to the
 * returner — never masked, unlike RPS picks.
 */
export function applyPongServe(
  current: PongState,
  marker: Marker,
  angle: number,
  power: PongPower,
): PongOutcome {
  return {
    state: {
      ...current,
      phase: "return",
      turn: otherMarker(marker),
      serve: { angle, power },
    },
    over: false,
  };
}

export interface PongOutcome {
  state: PongState;
  over: boolean;
}

/**
 * Resolve the returner's shot against the in-flight serve. Callers validate
 * phase ("return"), turn, and ranges first. A good return scores the
 * returner; a miss scores the server. The point winner serves next.
 */
export function applyPongReturn(
  current: PongState,
  marker: Marker,
  angle: number,
  power: PongPower,
): PongOutcome {
  const serve = current.serve!;
  const ret: PongShot = { angle, power };
  const good = isGoodPongReturn(serve, ret);
  const winner: Marker = good ? marker : otherMarker(marker);
  const scores = {
    ...current.scores,
    [winner]: current.scores[winner] + 1,
  };
  const matchWinner: Marker | null =
    scores[winner] >= PONG_TARGET ? winner : null;

  return {
    state: {
      ...current,
      phase: matchWinner ? "match_over" : "point_over",
      turn: winner, // the point winner serves next
      serve: null,
      scores,
      lastPoint: { winner, serve, ret, good },
      matchWinner,
    },
    over: matchWinner !== null,
  };
}

// ---------------------------------------------------------------------------
// Twenty Questions rules — one answerer, one asker, up to 20 questions.
//
// The initiator (X) secretly picks a word or phrase. The responder (O) asks
// up to 20 yes/no questions, one at a time; X answers each before the next is
// asked. O may guess at any point — a correct guess wins, a wrong final guess
// loses (the classic rule). Once the 20th question is answered the asker gets
// exactly one final guess. Single-round, like Tic Tac Toe: one match, one
// winner. The secret stays hidden from O (server-masked on reads) until the
// match ends and it's revealed.
// ---------------------------------------------------------------------------

export const TWENTY_QUESTIONS_GAME_TYPE = "twenty_questions" as const;

/** How many yes/no questions the asker gets. */
export const MAX_QUESTIONS = 20;

export type YesNo = "yes" | "no";
export type TwentyQuestionsPhase =
  | "setup" // X is picking the secret
  | "asking" // a question is being asked or answered
  | "final" // all 20 questions used — the asker must guess now
  | "match_over";

export interface TwentyQuestionsEntry {
  text: string;
  answer: YesNo;
}

export interface TwentyQuestionsState {
  phase: TwentyQuestionsPhase;
  /** The answerer's secret — masked from the asker until the match ends. */
  secret: string | null;
  /** The asker's question awaiting an answer (null while the asker acts). */
  pendingQuestion: string | null;
  /** Answered questions, in order. */
  questions: TwentyQuestionsEntry[];
  /** Match winner — O (guessed right) or X (wrong guess / 20 questions up). */
  winner: Marker | null;
  rematch?: { slug: string; by: string };
}

export function freshTwentyQuestionsState(): TwentyQuestionsState {
  return {
    phase: "setup",
    secret: null,
    pendingQuestion: null,
    questions: [],
    winner: null,
  };
}

/** Lock in the answerer's secret and open the floor to questions. */
export function applyTwentyQuestionsSecret(
  current: TwentyQuestionsState,
  secret: string,
): TwentyQuestionsState {
  return { ...current, secret, phase: "asking" };
}

/** Record the asker's question — it's now the answerer's turn. */
export function applyTwentyQuestionsQuestion(
  current: TwentyQuestionsState,
  question: string,
): TwentyQuestionsState {
  return { ...current, pendingQuestion: question };
}

/**
 * Answer the pending question. The 20th answer moves the game to the final
 * guess — the asker gets one last chance before losing.
 */
export function applyTwentyQuestionsAnswer(
  current: TwentyQuestionsState,
  answer: YesNo,
): TwentyQuestionsState {
  const questions = [
    ...current.questions,
    { text: current.pendingQuestion ?? "", answer },
  ];
  const phase: TwentyQuestionsPhase =
    questions.length >= MAX_QUESTIONS ? "final" : "asking";
  return { ...current, questions, pendingQuestion: null, phase };
}

/** Case- and whitespace-insensitive comparison. */
function normalizeSecret(s: string): string {
  return s.trim().toLowerCase();
}

export interface TwentyQuestionsOutcome {
  state: TwentyQuestionsState;
  over: boolean;
}

/**
 * Resolve the asker's guess. A correct guess wins O the match; a wrong one
 * loses it (the classic rule — you only guess when you're sure). The secret
 * is revealed to both players now that the match is over.
 */
export function applyTwentyQuestionsGuess(
  current: TwentyQuestionsState,
  guess: string,
): TwentyQuestionsOutcome {
  const winner: Marker =
    normalizeSecret(guess) === normalizeSecret(current.secret ?? "")
      ? "O"
      : "X";
  return {
    state: { ...current, phase: "match_over", winner },
    over: true,
  };
}

// ---------------------------------------------------------------------------
// Hangman rules — one word setter, one guesser, six wrong guesses.
//
// The initiator (X) secretly picks a word or phrase. The responder (O) guesses
// letters one at a time (or the whole word); the server judges every guess
// automatically, so the setter just watches. A letter that's in the word
// reveals every occurrence; a miss adds a body part. Six misses hangs the
// stick figure and X wins; revealing every letter (or a correct full-word
// guess) wins O. The word stays masked from O until the match ends.
// ---------------------------------------------------------------------------

export const HANGMAN_GAME_TYPE = "hangman" as const;

/** Wrong guesses before the stick figure is complete. */
export const HANGMAN_MAX_WRONG = 6;
/** Longest allowed secret (2–24 letters, spaces, dashes, apostrophes). */
export const HANGMAN_SECRET_MAX = 24;
/** Longest allowed guess. */
export const HANGMAN_GUESS_MAX = 40;

export type HangmanPhase = "setup" | "guessing" | "match_over";

export interface HangmanState {
  phase: HangmanPhase;
  /** The setter's word — masked from the guesser until the match ends. */
  secret: string | null;
  /** The word as it stands: letters, spaces/dashes pass through, unknown
   *  letters are "_". */
  revealed: string[];
  /** Every letter tried so far (lowercase, in order). */
  guessed: string[];
  /** Number of wrong guesses so far. */
  wrongCount: number;
  maxWrong: number;
  /** Match winner — X (six misses) or O (solved). */
  winner: Marker | null;
  rematch?: { slug: string; by: string };
}

export function freshHangmanState(): HangmanState {
  return {
    phase: "setup",
    secret: null,
    revealed: [],
    guessed: [],
    wrongCount: 0,
    maxWrong: HANGMAN_MAX_WRONG,
    winner: null,
  };
}

/** Letters are revealed; spaces and dashes pass through as themselves. */
function isHangmanLetter(ch: string): boolean {
  return /[a-z]/i.test(ch);
}

/** Build the revealed pattern for a secret given the tried letters. */
export function hangmanRevealed(secret: string, guessed: string[]): string[] {
  return [...secret].map((ch) =>
    isHangmanLetter(ch) && !guessed.includes(ch.toLowerCase()) ? "_" : ch,
  );
}

/** Lock in the setter's word and open the floor to guesses. */
export function applyHangmanSecret(
  current: HangmanState,
  secret: string,
): HangmanState {
  return {
    ...current,
    secret,
    revealed: hangmanRevealed(secret, []),
    phase: "guessing",
  };
}

export interface HangmanOutcome {
  state: HangmanState;
  over: boolean;
}

/**
 * Resolve one guess — a single letter or the whole word. Callers validate
 * first (game in progress, guessing player is O, phase, format, no repeats).
 * A correct letter (or word) can win the match; each miss brings the stick
 * figure one step closer to complete, where X wins. Only wrong guesses ever
 * spend a miss — a correct letter is never penalized.
 */
export function applyHangmanGuess(
  current: HangmanState,
  guess: string,
): HangmanOutcome {
  const secret = current.secret ?? "";
  const lower = guess.trim().toLowerCase();
  const isLetter = lower.length === 1;
  const wrong = isLetter
    ? !secret.toLowerCase().includes(lower)
    : lower !== secret.toLowerCase();

  let winner: Marker | null = null;
  let revealed = current.revealed;
  let guessed = current.guessed;

  if (isLetter) {
    guessed = [...guessed, lower];
    revealed = hangmanRevealed(secret, guessed);
    if (revealed.every((ch) => ch !== "_")) winner = "O";
  } else if (!wrong) {
    winner = "O";
  }

  if (winner === null && !wrong) {
    // A correct letter that hasn't solved the word yet — no penalty.
    return { state: { ...current, guessed, revealed }, over: false };
  }

  if (winner === null) {
    const wrongCount = current.wrongCount + 1;
    if (wrongCount >= current.maxWrong) winner = "X";
    return {
      state: {
        ...current,
        guessed,
        revealed,
        wrongCount,
        phase: winner ? "match_over" : "guessing",
        winner,
      },
      over: winner !== null,
    };
  }

  return {
    state: { ...current, guessed, revealed, phase: "match_over", winner },
    over: true,
  };
}

// ---------------------------------------------------------------------------
// Word Scramble rules — one word setter, one solver, three attempts.
//
// The initiator (X) picks a single word. The server scrambles its letters
// (never the client, and never into the original order) and the responder (O)
// has three attempts to unscramble it — a correct guess wins O, three misses
// win X. The word stays masked from O until the match ends.
// ---------------------------------------------------------------------------

export const WORD_SCRAMBLE_GAME_TYPE = "word_scramble" as const;

/** Attempts the solver gets before the setter wins. */
export const SCRAMBLE_ATTEMPTS = 3;
/** Scramble words are single words, 3–12 letters. */
export const SCRAMBLE_SECRET_MIN = 3;
export const SCRAMBLE_SECRET_MAX = 12;
/** Longest allowed answer. */
export const SCRAMBLE_GUESS_MAX = 20;

export type WordScramblePhase = "setup" | "solving" | "match_over";

export interface WordScrambleState {
  phase: WordScramblePhase;
  /** The original word — masked from the solver until the match ends. */
  secret: string | null;
  /** The server's shuffled letters (uppercase), shown to both players. */
  scrambled: string;
  /** Misses remaining (starts at SCRAMBLE_ATTEMPTS). */
  attemptsLeft: number;
  /** Wrong answers so far, for the solver's reference. */
  wrongGuesses: string[];
  /** Match winner — X (attempts exhausted) or O (solved). */
  winner: Marker | null;
  rematch?: { slug: string; by: string };
}

export function freshWordScrambleState(): WordScrambleState {
  return {
    phase: "setup",
    secret: null,
    scrambled: "",
    attemptsLeft: SCRAMBLE_ATTEMPTS,
    wrongGuesses: [],
    winner: null,
  };
}

/** Does the word contain at least two different letters (scrambleable)? */
export function hasDistinctLetters(word: string): boolean {
  return new Set(word.toLowerCase().split("")).size >= 2;
}

/**
 * Shuffle a word's letters into a different order — never the original
 * arrangement. `rng` is injectable so tests can drive it deterministically.
 */
export function scrambleWord(
  word: string,
  rng: () => number = Math.random,
): string {
  const upper = word.toUpperCase();
  const letters = upper.split("");
  for (let attempt = 0; attempt < 64; attempt++) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    if (letters.join("") !== upper) return letters.join("");
  }
  // Practically unreachable (the validator guarantees ≥2 distinct letters),
  // but swap the first two distinct letters so a scramble always exists.
  const out = [...letters];
  for (let i = 0; i < out.length; i++) {
    const j = out.findIndex((ch, k) => k > i && ch !== out[i]);
    if (j !== -1) {
      [out[i], out[j]] = [out[j], out[i]];
      return out.join("");
    }
  }
  return upper;
}

/** Lock in the setter's word and produce the scrambled board. */
export function applyWordScrambleSecret(
  current: WordScrambleState,
  secret: string,
): WordScrambleState {
  return {
    ...current,
    secret,
    scrambled: scrambleWord(secret),
    phase: "solving",
  };
}

export interface WordScrambleOutcome {
  state: WordScrambleState;
  over: boolean;
}

/**
 * Resolve one answer. Callers validate first (game in progress, solving
 * player is O, phase, format, no repeats). A correct answer wins O; each miss
 * spends one of the three attempts, and the last one wins X.
 */
export function applyWordScrambleGuess(
  current: WordScrambleState,
  guess: string,
): WordScrambleOutcome {
  const correct =
    guess.trim().toLowerCase() === (current.secret ?? "").toLowerCase();
  if (correct) {
    return {
      state: { ...current, phase: "match_over", winner: "O" },
      over: true,
    };
  }
  const attemptsLeft = current.attemptsLeft - 1;
  const winner: Marker | null = attemptsLeft <= 0 ? "X" : null;
  return {
    state: {
      ...current,
      attemptsLeft,
      wrongGuesses: [...current.wrongGuesses, guess],
      phase: winner ? "match_over" : "solving",
      winner,
    },
    over: winner !== null,
  };
}
