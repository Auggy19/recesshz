import { CB, FORMATIONS, PITCH } from "./constants";
import type { Cap, CountersBallState, RosterSize, TeamId } from "./types";

function buildCaps(rosterSize: RosterSize): Cap[] {
  const f = FORMATIONS[rosterSize];
  const caps: Cap[] = [];
  const add = (team: TeamId, spots: { x: number; y: number }[]) => {
    spots.forEach((p, i) => {
      caps.push({
        id: `${team}-${i}`,
        team,
        role: i === 0 ? "gk" : "outfield",
        x: p.x,
        y: p.y,
        vx: 0,
        vy: 0,
      });
    });
  };
  add(0, f.team0);
  add(1, f.team1);
  return caps;
}

/** Kickoff / after-goal reset poses (ball centre, caps on formation). */
export function resetFormation(state: CountersBallState): void {
  const f = FORMATIONS[state.rosterSize];
  const spots = [...f.team0, ...f.team1];
  state.caps.forEach((c, i) => {
    const p = spots[i];
    if (!p) return;
    c.x = p.x;
    c.y = p.y;
    c.vx = 0;
    c.vy = 0;
  });
  state.ball = {
    x: PITCH.w / 2,
    y: PITCH.h / 2,
    vx: 0,
    vy: 0,
    omega: 0,
  };
}

export function freshCountersBallState(
  rosterSize: RosterSize = 3,
): CountersBallState {
  return {
    rosterSize,
    phase: "kickoff",
    caps: buildCaps(rosterSize),
    ball: {
      x: PITCH.w / 2,
      y: PITCH.h / 2,
      vx: 0,
      vy: 0,
      omega: 0,
    },
    scores: [0, 0],
    turnTeam: 0,
    turnIndex: 0,
    winner: null,
    targetGoals: CB.TARGET_GOALS,
    lastTouchTeam: null,
  };
}
