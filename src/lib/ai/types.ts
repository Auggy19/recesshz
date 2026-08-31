import type { Difficulty } from "@/lib/design-tokens";
import type { Marker, RpsChoice, RedBlackChoice, PongPower } from "@/lib/gameLogic";

export type { Difficulty };

export type AiContext =
  | { game: "tic_tac_toe"; board: ("" | "X" | "O")[]; aiMarker: Marker }
  | { game: "rock_paper_scissors"; humanPick: RpsChoice | null }
  | { game: "red_or_black" }
  | {
      game: "pong";
      phase: "serve" | "return";
      serveAngle?: number;
      servePower?: PongPower;
    };

export type AiMove =
  | { game: "tic_tac_toe"; cell: number }
  | { game: "rock_paper_scissors"; pick: RpsChoice }
  | { game: "red_or_black"; guess: RedBlackChoice }
  | { game: "pong"; angle: number; power: PongPower };
