import type { Difficulty } from "@/lib/design-tokens";
import type { RpsChoice, RedBlackChoice, PongPower } from "@/lib/gameLogic";
import { RPS_CHOICES, RED_BLACK_CHOICES } from "@/lib/gameLogic";

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function chooseRpsPick(
  difficulty: Difficulty,
  humanPick: RpsChoice | null,
): RpsChoice {
  if (!humanPick || difficulty === "beginner") return pickRandom(RPS_CHOICES);
  const counter: Record<RpsChoice, RpsChoice> = {
    rock: "paper",
    paper: "scissors",
    scissors: "rock",
  };
  const p = difficulty === "expert" ? 0.75 : 0.45;
  return Math.random() < p ? counter[humanPick] : pickRandom(RPS_CHOICES);
}

export function chooseRedBlackGuess(difficulty: Difficulty): RedBlackChoice {
  if (difficulty === "beginner") return pickRandom(RED_BLACK_CHOICES);
  return Math.random() < 0.5 ? "red" : "black";
}

export function choosePongShot(
  difficulty: Difficulty,
  phase: "serve" | "return",
  serveAngle = 0,
): { angle: number; power: PongPower } {
  const clamp = (a: number) => Math.max(-60, Math.min(60, a));

  if (phase === "serve") {
    if (difficulty === "beginner") {
      return {
        angle: clamp((Math.random() - 0.5) * 80),
        power: (Math.random() < 0.7 ? 1 : 2) as PongPower,
      };
    }
    if (difficulty === "intermediate") {
      return {
        angle: clamp((Math.random() - 0.5) * 50),
        power: (Math.random() < 0.5 ? 2 : 3) as PongPower,
      };
    }
    return { angle: clamp((Math.random() - 0.5) * 30), power: 3 };
  }

  const noise =
    difficulty === "beginner" ? 35 : difficulty === "intermediate" ? 18 : 6;
  const angle = clamp(-serveAngle + (Math.random() - 0.5) * 2 * noise);
  const power: PongPower =
    difficulty === "expert" ? 3 : difficulty === "intermediate" ? 2 : 1;
  return { angle, power };
}
