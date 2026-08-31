import type { Board, Marker } from "@/lib/gameLogic";
import { findWinningLine } from "@/lib/gameLogic";
import type { Difficulty } from "@/lib/design-tokens";

function emptyCells(board: Board): number[] {
  return board.map((c, i) => (c === "" ? i : -1)).filter((i) => i >= 0);
}

function tryWin(board: Board, marker: Marker): number | null {
  for (const cell of emptyCells(board)) {
    const next = [...board] as Board;
    next[cell] = marker;
    if (findWinningLine(next)) return cell;
  }
  return null;
}

function minimax(
  board: Board,
  ai: Marker,
  human: Marker,
  maximizing: boolean,
  depth: number,
): { score: number; cell: number | null } {
  const line = findWinningLine(board);
  if (line) {
    const w = board[line[0]];
    return { score: w === ai ? 10 - depth : depth - 10, cell: null };
  }
  const empties = emptyCells(board);
  if (empties.length === 0) return { score: 0, cell: null };

  let bestCell: number | null = empties[0]!;
  let bestScore = maximizing ? -Infinity : Infinity;

  for (const cell of empties) {
    const next = [...board] as Board;
    next[cell] = maximizing ? ai : human;
    const { score } = minimax(next, ai, human, !maximizing, depth + 1);
    if (maximizing && score > bestScore) {
      bestScore = score;
      bestCell = cell;
    } else if (!maximizing && score < bestScore) {
      bestScore = score;
      bestCell = cell;
    }
  }
  return { score: bestScore, cell: bestCell };
}

export function chooseTicTacToeMove(
  board: Board,
  aiMarker: Marker,
  difficulty: Difficulty,
): number {
  const empties = emptyCells(board);
  if (empties.length === 0) return 0;
  const human: Marker = aiMarker === "X" ? "O" : "X";

  if (difficulty === "beginner") {
    if (Math.random() < 0.25) {
      const block = tryWin(board, human);
      if (block !== null) return block;
    }
    return empties[Math.floor(Math.random() * empties.length)]!;
  }

  if (difficulty === "intermediate") {
    const win = tryWin(board, aiMarker);
    if (win !== null) return win;
    const block = tryWin(board, human);
    if (block !== null) return block;
    const prefs = [4, 0, 2, 6, 8, 1, 3, 5, 7].filter((i) => board[i] === "");
    if (prefs.length && Math.random() < 0.7) return prefs[0]!;
    return empties[Math.floor(Math.random() * empties.length)]!;
  }

  const { cell } = minimax(board, aiMarker, human, true, 0);
  return cell ?? empties[0]!;
}
