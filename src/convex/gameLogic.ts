// ---------------------------------------------------------------------------
// Tic Tac Toe rules — the only game logic Recess ships for this build.
//
// This module is intentionally standalone (pure functions, no Convex imports)
// so the same pattern can be cloned to add Rock Paper Scissors, Red or Black,
// Twenty Questions, or Truth or Dare: write a `fresh<Game>State()` and an
// `apply<Game>Move()` for the new game type and wire it into `games.ts`.
// ---------------------------------------------------------------------------

import type { TicTacToeState } from "./schema";

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
