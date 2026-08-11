// ---------------------------------------------------------------------------
// Recess game rules.
//
// This module is intentionally standalone (pure functions, no Convex imports)
// so the same pattern can be cloned to add Red or Black, Twenty Questions, or
// Truth or Dare: write a `fresh<Game>State()` and an `apply<Game>Move()` for
// the new game type and wire it into `games.ts`.
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
