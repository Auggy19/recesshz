import { CB } from "./constants";
import { resetFormation } from "./fresh";
import {
  applyImpulse,
  forceSleep,
  isAtRest,
  quantizeState,
  step,
} from "./physics";
import type {
  CountersBallState,
  Impulse,
  RunResult,
  SimEvent,
  TeamId,
} from "./types";

function cloneState(s: CountersBallState): CountersBallState {
  return {
    ...s,
    scores: [s.scores[0], s.scores[1]],
    ball: { ...s.ball },
    caps: s.caps.map((c) => ({ ...c })),
  };
}

export function canFlick(
  state: CountersBallState,
  team: TeamId,
  capId: string,
): boolean {
  if (state.phase === "gameover") return false;
  if (state.turnTeam !== team) return false;
  const cap = state.caps.find((c) => c.id === capId);
  return !!cap && cap.team === team;
}

function afterRest(state: CountersBallState, events: SimEvent[]): void {
  const goal = events.find((e) => e.type === "goal");
  if (goal && goal.type === "goal") {
    if (
      state.scores[0] >= state.targetGoals ||
      state.scores[1] >= state.targetGoals
    ) {
      state.phase = "gameover";
      state.winner = state.scores[0] >= state.targetGoals ? 0 : 1;
      return;
    }
    state.phase = "kickoff";
    // Conceding team kicks off
    state.turnTeam = goal.team === 0 ? 1 : 0;
    return;
  }
  state.phase = "play";
  state.turnTeam = state.turnTeam === 0 ? 1 : 0;
  state.turnIndex += 1;
}

/**
 * Authoritative turn resolution: impulse in → rest state out.
 * Pure, deterministic, safe for Edge + client replay.
 */
export function runToRest(
  input: CountersBallState,
  impulse: Impulse,
): RunResult {
  const state = cloneState(input);
  const events: SimEvent[] = [];

  applyImpulse(state, impulse);

  for (let i = 0; i < CB.MAX_STEPS; i++) {
    const goalTeam = step(state, CB.DT);
    if (goalTeam !== null) {
      state.scores[goalTeam] += 1;
      events.push({ type: "goal", team: goalTeam });
      resetFormation(state);
      break;
    }
    if (isAtRest(state)) break;
  }

  forceSleep(state);
  quantizeState(state);
  events.push({ type: "rest" });
  afterRest(state, events);
  return { state, events };
}
