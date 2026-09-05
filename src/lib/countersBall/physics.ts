/**
 * Deterministic physics kernels for Counters Ball FC.
 * Fixed dt, ordered collisions, quantized outputs — no wall-clock RNG.
 */
import { CB, PITCH } from "./constants";
import type { Ball, Cap, CountersBallState, Impulse } from "./types";

export function q(n: number): number {
  return Math.round(n * CB.QUANT) / CB.QUANT;
}

export function quantizeState(state: CountersBallState): void {
  for (const c of state.caps) {
    c.x = q(c.x);
    c.y = q(c.y);
    c.vx = q(c.vx);
    c.vy = q(c.vy);
  }
  state.ball.x = q(state.ball.x);
  state.ball.y = q(state.ball.y);
  state.ball.vx = q(state.ball.vx);
  state.ball.vy = q(state.ball.vy);
  state.ball.omega = q(state.ball.omega);
}

export function isAtRest(state: CountersBallState): boolean {
  if (Math.hypot(state.ball.vx, state.ball.vy) >= CB.V_SLEEP) return false;
  if (Math.abs(state.ball.omega) >= CB.OMEGA_SLEEP) return false;
  for (const c of state.caps) {
    if (Math.hypot(c.vx, c.vy) >= CB.V_SLEEP) return false;
  }
  return true;
}

export function forceSleep(state: CountersBallState): void {
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.ball.omega = 0;
  for (const c of state.caps) {
    c.vx = 0;
    c.vy = 0;
  }
}

function applyCoulomb(
  vx: number,
  vy: number,
  mu: number,
  dt: number,
): { vx: number; vy: number } {
  const sp = Math.hypot(vx, vy);
  if (sp < CB.V_SLEEP) return { vx: 0, vy: 0 };
  const dv = mu * dt;
  if (dv >= sp) return { vx: 0, vy: 0 };
  const s = (sp - dv) / sp;
  return { vx: vx * s, vy: vy * s };
}

function applyMagnus(ball: Ball, dt: number): void {
  const sp = Math.hypot(ball.vx, ball.vy);
  if (sp < CB.V_SLEEP || Math.abs(ball.omega) < CB.OMEGA_SLEEP) return;
  let aM = CB.K_MAGNUS * ball.omega * sp;
  if (aM > CB.A_MAGNUS_MAX) aM = CB.A_MAGNUS_MAX;
  if (aM < -CB.A_MAGNUS_MAX) aM = -CB.A_MAGNUS_MAX;
  ball.vx += -aM * (ball.vy / sp) * dt;
  ball.vy += aM * (ball.vx / sp) * dt;
}

function spinDecay(omega: number, dt: number): number {
  let w = omega * Math.exp(-CB.LAMBDA_SPIN * dt);
  if (Math.abs(w) < CB.OMEGA_SLEEP) w = 0;
  return w;
}

function resolveCircles(
  ax: number,
  ay: number,
  avx: number,
  avy: number,
  bx: number,
  by: number,
  bvx: number,
  bvy: number,
  ra: number,
  rb: number,
  massA: number,
  massB: number,
  e: number,
): {
  ax: number;
  ay: number;
  avx: number;
  avy: number;
  bx: number;
  by: number;
  bvx: number;
  bvy: number;
} {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy) || 1e-6;
  const minDist = ra + rb;
  if (dist >= minDist) {
    return { ax, ay, avx, avy, bx, by, bvx, bvy };
  }
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = minDist - dist;
  const inv = 1 / (massA + massB);
  const ax2 = ax - nx * overlap * massB * inv;
  const ay2 = ay - ny * overlap * massB * inv;
  const bx2 = bx + nx * overlap * massA * inv;
  const by2 = by + ny * overlap * massA * inv;

  const rvx = bvx - avx;
  const rvy = bvy - avy;
  const velN = rvx * nx + rvy * ny;
  if (velN > 0) {
    return { ax: ax2, ay: ay2, avx, avy, bx: bx2, by: by2, bvx, bvy };
  }
  const j = (-(1 + e) * velN) / (1 / massA + 1 / massB);
  return {
    ax: ax2,
    ay: ay2,
    avx: avx - (j / massA) * nx,
    avy: avy - (j / massA) * ny,
    bx: bx2,
    by: by2,
    bvx: bvx + (j / massB) * nx,
    bvy: bvy + (j / massB) * ny,
  };
}

function wallsAndGoals(
  state: CountersBallState,
): { goalTeam: 0 | 1 | null } {
  const b = state.ball;
  const r = PITCH.ballR;
  const midY = PITCH.h / 2;

  // Top / bottom boards
  if (b.y - r < 0) {
    b.y = r;
    b.vy = -b.vy * CB.E_WALL;
  } else if (b.y + r > PITCH.h) {
    b.y = PITCH.h - r;
    b.vy = -b.vy * CB.E_WALL;
  }

  // Goals vs end boards
  const inGoalY = Math.abs(b.y - midY) <= PITCH.goalHalf;
  if (b.x - r < 0) {
    if (inGoalY) return { goalTeam: 1 };
    b.x = r;
    b.vx = -b.vx * CB.E_POST;
  } else if (b.x + r > PITCH.w) {
    if (inGoalY) return { goalTeam: 0 };
    b.x = PITCH.w - r;
    b.vx = -b.vx * CB.E_POST;
  }

  // Caps vs boards (simple clamp)
  for (const c of state.caps) {
    const cr = PITCH.capR;
    if (c.x - cr < 0) {
      c.x = cr;
      c.vx = -c.vx * CB.E_WALL;
    } else if (c.x + cr > PITCH.w) {
      c.x = PITCH.w - cr;
      c.vx = -c.vx * CB.E_WALL;
    }
    if (c.y - cr < 0) {
      c.y = cr;
      c.vy = -c.vy * CB.E_WALL;
    } else if (c.y + cr > PITCH.h) {
      c.y = PITCH.h - cr;
      c.vy = -c.vy * CB.E_WALL;
    }
  }

  return { goalTeam: null };
}

export function applyImpulse(state: CountersBallState, impulse: Impulse): void {
  const cap = state.caps.find((c) => c.id === impulse.capId);
  if (!cap) return;
  let ix = impulse.ix;
  let iy = impulse.iy;
  const mag = Math.hypot(ix, iy);
  if (mag > CB.IMPULSE_MAX && mag > 0) {
    const s = CB.IMPULSE_MAX / mag;
    ix *= s;
    iy *= s;
  }
  cap.vx += ix;
  cap.vy += iy;
  if (typeof impulse.spin === "number" && Number.isFinite(impulse.spin)) {
    // Soft English: if cap is near ball, transfer spin; else store mild spin on contact next steps via velocity only.
    const dx = state.ball.x - cap.x;
    const dy = state.ball.y - cap.y;
    if (Math.hypot(dx, dy) < PITCH.capR + PITCH.ballR + 4) {
      state.ball.omega += Math.max(-2, Math.min(2, impulse.spin));
    }
  }
}

export function step(state: CountersBallState, dt: number): 0 | 1 | null {
  const ball = state.ball;

  applyMagnus(ball, dt);

  // Table friction
  {
    const d = applyCoulomb(ball.vx, ball.vy, CB.MU_BALL, dt);
    const factor = Math.exp(-CB.C_LIN_BALL * dt);
    ball.vx = d.vx * factor;
    ball.vy = d.vy * factor;
  }
  for (const c of state.caps) {
    const d = applyCoulomb(c.vx, c.vy, CB.MU_CAP, dt);
    c.vx = d.vx;
    c.vy = d.vy;
  }

  ball.omega = spinDecay(ball.omega, dt);

  // Integrate
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  for (const c of state.caps) {
    c.x += c.vx * dt;
    c.y += c.vy * dt;
  }

  // Cap–cap (stable id order)
  const caps = [...state.caps].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = 0; i < caps.length; i++) {
    for (let j = i + 1; j < caps.length; j++) {
      const a = caps[i];
      const b = caps[j];
      const r = resolveCircles(
        a.x,
        a.y,
        a.vx,
        a.vy,
        b.x,
        b.y,
        b.vx,
        b.vy,
        PITCH.capR,
        PITCH.capR,
        3,
        3,
        CB.E_CAP,
      );
      a.x = r.ax;
      a.y = r.ay;
      a.vx = r.avx;
      a.vy = r.avy;
      b.x = r.bx;
      b.y = r.by;
      b.vx = r.bvx;
      b.vy = r.bvy;
    }
  }

  // Ball–cap
  for (const c of caps) {
    const r = resolveCircles(
      c.x,
      c.y,
      c.vx,
      c.vy,
      ball.x,
      ball.y,
      ball.vx,
      ball.vy,
      PITCH.capR,
      PITCH.ballR,
      3,
      1,
      CB.E_BALL_CAP,
    );
    c.x = r.ax;
    c.y = r.ay;
    c.vx = r.avx;
    c.vy = r.avy;
    ball.x = r.bx;
    ball.y = r.by;
    ball.vx = r.bvx;
    ball.vy = r.bvy;
  }

  const { goalTeam } = wallsAndGoals(state);
  return goalTeam;
}
