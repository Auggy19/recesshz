import type { RosterSize } from "./types";

/** Pitch in abstract units (top-down). Team 0 defends x≈0, team 1 defends x≈w. */
export const PITCH = {
  w: 100,
  h: 60,
  goalHalf: 8,
  goalDepth: 3,
  capR: 2.4,
  ballR: 1.35,
} as const;

/** Deterministic loop parameters — shared by server and any client replay. */
export const CB = {
  DT: 1 / 120,
  MAX_STEPS: 600,
  V_SLEEP: 0.04,
  OMEGA_SLEEP: 0.03,
  LAMBDA_SPIN: 2.2,
  K_MAGNUS: 0.75,
  A_MAGNUS_MAX: 36,
  MU_CAP: 16,
  MU_BALL: 3.5,
  C_LIN_BALL: 1.1,
  E_WALL: 0.8,
  E_POST: 0.5,
  E_CAP: 0.32,
  E_BALL_CAP: 0.72,
  IMPULSE_MAX: 55,
  QUANT: 100,
  TARGET_GOALS: 3,
} as const;

type Spot = { x: number; y: number };

/** Formation tables — only data that changes when scaling 3v3 → 5v5. */
export const FORMATIONS: Record<
  RosterSize,
  { team0: Spot[]; team1: Spot[] }
> = {
  3: {
    team0: [
      { x: 10, y: 30 },
      { x: 28, y: 16 },
      { x: 28, y: 44 },
    ],
    team1: [
      { x: 90, y: 30 },
      { x: 72, y: 16 },
      { x: 72, y: 44 },
    ],
  },
  5: {
    team0: [
      { x: 10, y: 30 },
      { x: 22, y: 12 },
      { x: 22, y: 48 },
      { x: 34, y: 22 },
      { x: 34, y: 38 },
    ],
    team1: [
      { x: 90, y: 30 },
      { x: 78, y: 12 },
      { x: 78, y: 48 },
      { x: 66, y: 22 },
      { x: 66, y: 38 },
    ],
  },
};
