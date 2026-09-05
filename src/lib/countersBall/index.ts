export { CB, FORMATIONS, PITCH } from "./constants";
export { freshCountersBallState, resetFormation } from "./fresh";
export { canFlick, runToRest } from "./runToRest";
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
} from "./types";

export const COUNTERS_BALL_GAME_TYPE = "counters_ball" as const;
