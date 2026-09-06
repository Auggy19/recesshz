export { CB, FORMATIONS, PITCH } from "./constants.ts";
export { freshCountersBallState, resetFormation } from "./fresh.ts";
export { canFlick, runToRest } from "./runToRest.ts";
export type {
  Ball,
  Cap,
  CountersBallState,
  Impulse,
  Phase,
  RosterSize,
  RunResult,
  SimEvent,
  TeamId,
} from "./types.ts";

export const COUNTERS_BALL_GAME_TYPE = "counters_ball" as const;
