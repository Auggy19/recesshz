import type { Difficulty } from "@/lib/design-tokens";
import type { Board, Marker } from "@/lib/gameLogic";
import { chooseTicTacToeMove } from "@/lib/ai/ticTacToe";
import {
  chooseRpsPick,
  chooseRedBlackGuess,
  choosePongShot,
} from "@/lib/ai/casual";
import type { AiContext, AiMove } from "@/lib/ai/types";

export type { Difficulty, AiContext, AiMove };
export { chooseTicTacToeMove, chooseRpsPick, chooseRedBlackGuess, choosePongShot };
export {
  useSinglePlayerTicTacToe,
  useSinglePlayerRps,
  useSinglePlayerRedBlack,
  useSinglePlayerPong,
} from "@/lib/ai/useSinglePlayer";

export function chooseAiMove(ctx: AiContext, difficulty: Difficulty): AiMove {
  switch (ctx.game) {
    case "tic_tac_toe":
      return {
        game: "tic_tac_toe",
        cell: chooseTicTacToeMove(ctx.board as Board, ctx.aiMarker, difficulty),
      };
    case "rock_paper_scissors":
      return {
        game: "rock_paper_scissors",
        pick: chooseRpsPick(difficulty, ctx.humanPick),
      };
    case "red_or_black":
      return { game: "red_or_black", guess: chooseRedBlackGuess(difficulty) };
    case "pong": {
      const shot = choosePongShot(difficulty, ctx.phase, ctx.serveAngle ?? 0);
      return { game: "pong", ...shot };
    }
  }
}

export function aiThinkDelayMs(difficulty: Difficulty): number {
  switch (difficulty) {
    case "beginner":
      return 400 + Math.random() * 400;
    case "intermediate":
      return 600 + Math.random() * 500;
    case "expert":
      return 350 + Math.random() * 350;
  }
}

export const SINGLE_PLAYER_GAMES = [
  "tic_tac_toe",
  "rock_paper_scissors",
  "red_or_black",
  "pong",
] as const;

export type SinglePlayerGame = (typeof SINGLE_PLAYER_GAMES)[number];

export function supportsSinglePlayer(type: string): type is SinglePlayerGame {
  return (SINGLE_PLAYER_GAMES as readonly string[]).includes(type);
}
