/**
 * Lightweight type module (Convex schema removed after Supabase migration).
 * gameLogic imports TicTacToeState from here.
 */
export type TicTacToeState = {
  board: ("" | "X" | "O")[];
  turn: "X" | "O";
  winner: "X" | "O" | null;
  draw: boolean;
  winningLine: number[] | null;
  rematch?: { slug: string; by: string };
};

export type GameStatus = "waiting" | "in_progress" | "completed" | "abandoned";
export type PlayerRole = "initiator" | "responder";
