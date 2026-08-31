/**
 * Single-player AI for Recess — pure functions, difficulty-gated.
 * Edge is not required; client simulates opponent after local moves.
 */
import {
  applyTicTacToeMove,
  applyRpsPick,
  applyPongServe,
  applyPongReturn,
  findWinningLine,
  otherMarker,
  type TicTacToeState,
  type Marker,
  type RpsState,
  type RpsChoice,
  type PongState,
  type PongPower,
  RPS_CHOICES,
  PONG_POWERS,
  isGoodPongReturn,
} from "@/lib/gameLogic";

export type Difficulty = "beginner" | "intermediate" | "expert";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  expert: "Expert",
};

export const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  beginner: "Forgiving opponent — great for warming up.",
  intermediate: "Solid play with occasional mistakes.",
  expert: "Near-optimal. Expect a real match.",
};

function rng(): number {
  return Math.random();
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

function emptyCells(board: ("" | "X" | "O")[]): number[] {
  return board.map((c, i) => (c === "" ? i : -1)).filter((i) => i >= 0);
}

function minimax(
  board: ("" | "X" | "O")[],
  turn: Marker,
  ai: Marker,
  depth: number,
  maxDepth: number,
): { score: number; cell: number | null } {
  const line = findWinningLine(board as ("" | "X" | "O")[]);
  if (line) {
    const w = board[line[0]!] as Marker;
    return { score: w === ai ? 10 - depth : depth - 10, cell: null };
  }
  if (board.every((c) => c !== "") || depth >= maxDepth) {
    return { score: 0, cell: null };
  }

  const cells = emptyCells(board);
  let bestCell: number | null = cells[0] ?? null;
  let bestScore = turn === ai ? -Infinity : Infinity;

  for (const cell of cells) {
    const next = [...board] as ("" | "X" | "O")[];
    next[cell] = turn;
    const { score } = minimax(next, otherMarker(turn), ai, depth + 1, maxDepth);
    if (turn === ai) {
      if (score > bestScore) {
        bestScore = score;
        bestCell = cell;
      }
    } else if (score < bestScore) {
      bestScore = score;
      bestCell = cell;
    }
  }
  return {
    score: bestScore === Infinity || bestScore === -Infinity ? 0 : bestScore,
    cell: bestCell,
  };
}

export function aiTicTacToeMove(
  state: TicTacToeState,
  aiMarker: Marker,
  difficulty: Difficulty,
): number {
  const empties = emptyCells(state.board);
  if (empties.length === 0) return 0;

  if (difficulty === "beginner") {
    if (rng() < 0.7) return pickRandom(empties);
  }

  const maxDepth =
    difficulty === "beginner" ? 2 : difficulty === "intermediate" ? 4 : 9;

  if (difficulty === "intermediate" && rng() < 0.25) {
    return pickRandom(empties);
  }

  const { cell } = minimax(state.board, aiMarker, aiMarker, 0, maxDepth);
  return cell ?? pickRandom(empties);
}

export function aiRpsPick(
  difficulty: Difficulty,
  humanLast?: RpsChoice | null,
): RpsChoice {
  if (difficulty === "beginner") return pickRandom(RPS_CHOICES);
  if (difficulty === "intermediate") {
    if (humanLast && rng() < 0.45) {
      if (humanLast === "rock") return "paper";
      if (humanLast === "paper") return "scissors";
      return "rock";
    }
    return pickRandom(RPS_CHOICES);
  }
  if (humanLast && rng() < 0.7) {
    if (humanLast === "rock") return "paper";
    if (humanLast === "paper") return "scissors";
    return "rock";
  }
  return pickRandom(RPS_CHOICES);
}

export function aiPongShot(
  state: PongState,
  aiMarker: Marker,
  difficulty: Difficulty,
): { angle: number; power: PongPower } {
  const isServe = state.phase === "serve" || state.serve === null;
  const maxAngle = isServe ? 60 : 45;

  if (isServe) {
    const angle =
      difficulty === "beginner"
        ? Math.round((rng() * 2 - 1) * maxAngle * 0.5)
        : difficulty === "intermediate"
          ? Math.round((rng() * 2 - 1) * maxAngle * 0.85)
          : Math.round((rng() * 2 - 1) * maxAngle);
    const power = (
      difficulty === "expert"
        ? pickRandom([2, 3] as PongPower[])
        : pickRandom(PONG_POWERS)
    ) as PongPower;
    return { angle, power };
  }

  const serve = state.serve!;
  if (difficulty === "beginner") {
    const angle = Math.round((rng() * 2 - 1) * maxAngle);
    return { angle, power: 1 };
  }
  if (difficulty === "intermediate") {
    const target = -serve.angle;
    const noise = (rng() * 2 - 1) * 18;
    const angle = Math.max(
      -maxAngle,
      Math.min(maxAngle, Math.round(target + noise)),
    );
    const power = pickRandom([1, 2] as PongPower[]);
    return { angle, power };
  }
  let angle = Math.round(-serve.angle);
  let power: PongPower = 2;
  for (let i = 0; i < 8; i++) {
    power = pickRandom(PONG_POWERS);
    const tryAngle = Math.max(
      -maxAngle,
      Math.min(maxAngle, Math.round(-serve.angle + (rng() * 2 - 1) * 6)),
    );
    if (isGoodPongReturn(serve, { angle: tryAngle, power })) {
      angle = tryAngle;
      break;
    }
    angle = tryAngle;
  }
  return { angle, power };
}

export function resolveTicTacToeAiTurn(
  state: TicTacToeState,
  humanMarker: Marker,
  difficulty: Difficulty,
): TicTacToeState {
  if (state.winner || state.draw) return state;
  const ai = otherMarker(humanMarker);
  if (state.turn !== ai) return state;
  const cell = aiTicTacToeMove(state, ai, difficulty);
  return applyTicTacToeMove(state, cell, ai).state;
}

export function resolveRpsAiPick(
  state: RpsState,
  humanMarker: Marker,
  humanPick: RpsChoice,
  difficulty: Difficulty,
): RpsState {
  const ai = otherMarker(humanMarker);
  let next = applyRpsPick(state, humanMarker, humanPick).state;
  if (next.picks[ai] == null && next.phase === "picking") {
    const aiPick = aiRpsPick(difficulty, humanPick);
    next = applyRpsPick(next, ai, aiPick).state;
  }
  return next;
}

export function resolvePongAiShot(
  state: PongState,
  humanMarker: Marker,
  difficulty: Difficulty,
): PongState {
  const ai = otherMarker(humanMarker);
  if (state.matchWinner || state.turn !== ai) return state;
  const shot = aiPongShot(state, ai, difficulty);
  if (state.phase === "serve") {
    return applyPongServe(state, ai, shot.angle, shot.power).state;
  }
  if (state.phase === "return") {
    return applyPongReturn(state, ai, shot.angle, shot.power).state;
  }
  return state;
}

export const SINGLE_PLAYER_GAMES = [
  "tic_tac_toe",
  "rock_paper_scissors",
  "pong",
] as const;

export type SinglePlayerGame = (typeof SINGLE_PLAYER_GAMES)[number];

export function supportsSinglePlayer(gameType: string): boolean {
  return (SINGLE_PLAYER_GAMES as readonly string[]).includes(gameType);
}
