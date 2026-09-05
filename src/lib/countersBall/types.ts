/**
 * Counters Ball FC — pure types (no React / no Supabase).
 * Roster scales 3v3 → 5v5 without changing the control scheme.
 */

export type RosterSize = 3 | 5;
export type TeamId = 0 | 1;
export type Phase = "kickoff" | "play" | "gameover";

export type Cap = {
  id: string;
  team: TeamId;
  role: "gk" | "outfield";
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  omega: number;
};

export type CountersBallState = {
  rosterSize: RosterSize;
  phase: Phase;
  caps: Cap[];
  ball: Ball;
  /** scores[0] = team 0 (X), scores[1] = team 1 (O) */
  scores: [number, number];
  /** Whose flick is next — maps to Recess markers X=0, O=1 */
  turnTeam: TeamId;
  turnIndex: number;
  winner: TeamId | null;
  targetGoals: number;
  lastTouchTeam: TeamId | null;
  rematch?: { slug: string; by: string };
};

export type Impulse = {
  capId: string;
  ix: number;
  iy: number;
  /** Optional English applied to the ball when this flick contacts it */
  spin?: number;
};

export type SimEvent =
  | { type: "goal"; team: TeamId }
  | { type: "rest" };

export type RunResult = {
  state: CountersBallState;
  events: SimEvent[];
};
