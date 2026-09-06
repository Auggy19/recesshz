import {
  canFlick,
  runToRest,
  type CountersBallState,
  type Impulse,
} from "@/lib/countersBall";
import type { Marker } from "@/lib/gameLogic";

export function applyCountersBallFlick(
  state: CountersBallState,
  marker: Marker,
  args: { capId?: string; ix?: number; iy?: number; spin?: number },
): { state: CountersBallState; over: boolean; payload: Record<string, unknown> } {
  if (state.phase === "gameover" || state.winner !== null) {
    throw new Error("This match is already over.");
  }
  const { capId, ix, iy, spin } = args;
  if (typeof capId !== "string" || !capId) {
    throw new Error("Pick one of your caps to flick.");
  }
  if (typeof ix !== "number" || typeof iy !== "number" || !Number.isFinite(ix) || !Number.isFinite(iy)) {
    throw new Error("That flick isn't valid.");
  }
  const team = marker === "X" ? 0 : 1;
  if (!canFlick(state, team, capId)) {
    throw new Error("It's not your turn, or that isn't your cap.");
  }
  const impulse: Impulse = {
    capId,
    ix,
    iy,
    spin: typeof spin === "number" && Number.isFinite(spin) ? spin : undefined,
  };
  const result = runToRest(state, impulse);
  const over = result.state.phase === "gameover" || result.state.winner !== null;
  return {
    state: result.state,
    over,
    payload: {
      type: "flick",
      capId,
      ix,
      iy,
      spin: impulse.spin ?? null,
      marker,
      events: result.events,
    },
  };
}
