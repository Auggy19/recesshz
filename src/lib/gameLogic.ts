// ---------------------------------------------------------------------------
// Recess game rules.
//
// This module is intentionally standalone (pure functions, no framework imports)
// so the same pattern can be cloned to add Twenty Questions or Truth or Dare:
// write a `fresh<Game>State()` and an `apply<Game>Move()` for the new game
// type and wire it into `games.ts`.
// ---------------------------------------------------------------------------

// TicTacToeState lives here (no Convex schema dependency).
export type TicTacToeState = {
  board: ("" | "X" | "O")[];
  turn: "X" | "O";
  winner: "X" | "O" | null;
  draw: boolean;
  winningLine: number[] | null;
  rematch?: { slug: string; by: string };
};

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
// ---------------------------------------------------------------------------

export const RED_BLACK_GAME_TYPE = "red_or_black" as const;

export type RedBlackChoice = "red" | "black";
export const RED_BLACK_CHOICES: RedBlackChoice[] = ["red", "black"];

export interface RedBlackState {
  round: number;
  phase: "picking" | "resolved";
  guess: RedBlackChoice | null;
  draw: RedBlackChoice | null;
  scores: { X: number; O: number };
  winner: "X" | "O" | null;
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

export function coinFlip(): RedBlackChoice {
  return (crypto.getRandomValues(new Uint8Array(1))[0] & 1) === 0
    ? "red"
    : "black";
}

export interface RedBlackOutcome {
  state: RedBlackState;
  over: boolean;
}

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
// ---------------------------------------------------------------------------

export const PONG_GAME_TYPE = "pong" as const;

export type PongPower = 1 | 2 | 3;
export const PONG_POWERS: PongPower[] = [1, 2, 3];

export interface PongShot {
  angle: number;
  power: PongPower;
}

export interface PongState {
  phase: "serve" | "return" | "point_over" | "match_over";
  turn: Marker;
  serve: PongShot | null;
  scores: { X: number; O: number };
  lastPoint: {
    winner: Marker;
    serve: PongShot;
    ret: PongShot;
    good: boolean;
  } | null;
  matchWinner: Marker | null;
  rematch?: { slug: string; by: string };
}

export const PONG_TARGET = 7;
export const PONG_SERVE_ANGLE = 60;
export const PONG_RETURN_ANGLE = 45;

export function freshPongState(): PongState {
  return {
    phase: "serve",
    turn: "X",
    serve: null,
    scores: { X: 0, O: 0 },
    lastPoint: null,
    matchWinner: null,
  };
}

/** Generous return window so the game stays easy and fun. */
export function pongReturnWindow(
  servePower: PongPower,
  returnPower: PongPower,
): number {
  return Math.max(15, 40 - (servePower - 1) * 5 - (returnPower - 1) * 5);
}

export function isGoodPongReturn(serve: PongShot, ret: PongShot): boolean {
  return (
    Math.abs(serve.angle + ret.angle) <= pongReturnWindow(serve.power, ret.power)
  );
}

export interface PongOutcome {
  state: PongState;
  over: boolean;
}

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
      turn: winner,
      serve: null,
      scores,
      lastPoint: { winner, serve, ret, good },
      matchWinner,
    },
    over: matchWinner !== null,
  };
}

// ---------------------------------------------------------------------------
// Twenty Questions rules
// ---------------------------------------------------------------------------

export const TWENTY_QUESTIONS_GAME_TYPE = "twenty_questions" as const;
export const MAX_QUESTIONS = 20;

export type YesNo = "yes" | "no";
export type TwentyQuestionsPhase =
  | "setup"
  | "asking"
  | "final"
  | "match_over";

export interface TwentyQuestionsEntry {
  text: string;
  answer: YesNo;
}

export interface TwentyQuestionsState {
  phase: TwentyQuestionsPhase;
  secret: string | null;
  pendingQuestion: string | null;
  questions: TwentyQuestionsEntry[];
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

export function applyTwentyQuestionsSecret(
  current: TwentyQuestionsState,
  secret: string,
): TwentyQuestionsState {
  return { ...current, secret, phase: "asking" };
}

export function applyTwentyQuestionsQuestion(
  current: TwentyQuestionsState,
  question: string,
): TwentyQuestionsState {
  return { ...current, pendingQuestion: question };
}

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

function normalizeSecret(s: string): string {
  return s.trim().toLowerCase();
}

export interface TwentyQuestionsOutcome {
  state: TwentyQuestionsState;
  over: boolean;
}

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
// Hangman rules
// ---------------------------------------------------------------------------

export const HANGMAN_GAME_TYPE = "hangman" as const;
export const HANGMAN_MAX_WRONG = 6;
export const HANGMAN_SECRET_MAX = 24;
export const HANGMAN_GUESS_MAX = 40;

export type HangmanPhase = "setup" | "guessing" | "match_over";

export interface HangmanState {
  phase: HangmanPhase;
  secret: string | null;
  revealed: string[];
  guessed: string[];
  wrongCount: number;
  maxWrong: number;
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

function isHangmanLetter(ch: string): boolean {
  return /[a-z]/i.test(ch);
}

export function hangmanRevealed(secret: string, guessed: string[]): string[] {
  return [...secret].map((ch) =>
    isHangmanLetter(ch) && !guessed.includes(ch.toLowerCase()) ? "_" : ch,
  );
}

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
// Word Scramble rules
// ---------------------------------------------------------------------------

export const WORD_SCRAMBLE_GAME_TYPE = "word_scramble" as const;
export const SCRAMBLE_ATTEMPTS = 3;
export const SCRAMBLE_SECRET_MIN = 3;
export const SCRAMBLE_SECRET_MAX = 12;
export const SCRAMBLE_GUESS_MAX = 20;

export type WordScramblePhase = "setup" | "solving" | "match_over";

export interface WordScrambleState {
  phase: WordScramblePhase;
  secret: string | null;
  scrambled: string;
  attemptsLeft: number;
  wrongGuesses: string[];
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

export function hasDistinctLetters(word: string): boolean {
  return new Set(word.toLowerCase().split("")).size >= 2;
}

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
