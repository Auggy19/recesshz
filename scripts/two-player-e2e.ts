// ---------------------------------------------------------------------------
// Two-player end-to-end flow against a LIVE Convex deployment.
//
// Drives the exact API surface the two browser clients use — device A creates
// a game, device B joins via the link, a third device is locked out, the game
// is played to completion, feedback is submitted, a rematch is created and
// followed, and RPS pick masking / Red or Black server draws / Pong reveals
// are verified over the wire.
//
// Run:  bun scripts/two-player-e2e.ts
//       RECESS_CONVEX_URL=https://...convex.cloud bun scripts/two-player-e2e.ts
// ---------------------------------------------------------------------------

import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";

const URL =
  process.env.RECESS_CONVEX_URL ?? "https://bold-deer-487.convex.cloud";

let failures = 0;

function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.error(`  ✗ ${label}${extra === undefined ? "" : ` — ${JSON.stringify(extra)}`}`);
  }
}

async function expectError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    failures++;
    console.error(`  ✗ expected ConvexError code "${code}" but the call succeeded`);
  } catch (err) {
    if (err instanceof ConvexError && (err.data as { code?: string })?.code === code) {
      console.log(`  ✓ rejected with "${code}"`);
    } else {
      failures++;
      console.error(`  ✗ expected "${code}", got:`, err);
    }
  }
}

const stamp = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const tA = `e2e-A-${stamp()}`;
const tB = `e2e-B-${stamp()}`;
const tC = `e2e-C-${stamp()}`;

const A = new ConvexHttpClient(URL); // browser 1 — initiator
const B = new ConvexHttpClient(URL); // browser 2 — responder
const C = new ConvexHttpClient(URL); // intruder

const q = <T>(c: ConvexHttpClient, name: string, args: Record<string, unknown>) =>
  c.query(name as never, args as never) as Promise<T>;
const m = <T>(c: ConvexHttpClient, name: string, args: Record<string, unknown>) =>
  c.mutation(name as never, args as never) as Promise<T>;

console.log(`Two-player E2E against ${URL}`);
console.log(`devices: A=${tA.slice(0, 12)}… B=${tB.slice(0, 12)}… C=${tC.slice(0, 12)}…`);

// --- Tic Tac Toe: create → join → play → complete → rematch -----------------

console.log("\n[TTT] A creates a game");
const created = await m<{ slug: string }>(A, "games:createGame", {
  gameType: "tic_tac_toe",
  deviceToken: tA,
});
check("createGame returns a UUID slug", /^[0-9a-f-]{36}$/.test(created.slug), created);
const slug = created.slug;

const waiting = await q<{ status: string }>(A, "games:getGameState", {
  slug,
  deviceToken: tA,
});
check("A sees the game waiting", waiting.status === "waiting", waiting.status);

console.log("\n[TTT] Moves are rejected while waiting");
await expectError(
  m(A, "games:submitMove", { slug, deviceToken: tA, cell: 0 }),
  "invalid_move",
);

console.log("\n[TTT] B joins from the shared link");
const joined = await m<{ me: { marker: string } }>(B, "games:joinGame", {
  slug,
  deviceToken: tB,
});
check("B joins as O", joined.me.marker === "O", joined.me);

const started = await q<{ status: string }>(A, "games:getGameState", {
  slug,
  deviceToken: tA,
});
check("game is in_progress for A", started.status === "in_progress", started.status);

console.log("\n[TTT] A third device is locked out (join AND reads)");
await expectError(m(C, "games:joinGame", { slug, deviceToken: tC }), "locked");
await expectError(q(C, "games:getGameState", { slug, deviceToken: tC }), "locked");

console.log("\n[TTT] Playing to completion — X wins the top row");
for (const [token, cell] of [
  [tA, 0],
  [tB, 3],
  [tA, 1],
  [tB, 4],
  [tA, 2],
] as const) {
  const client = token === tA ? A : B;
  await m(client, "games:submitMove", { slug, deviceToken: token, cell });
}
const done = await q<{ status: string; state: { winner: string; winningLine: number[] } }>(
  A,
  "games:getGameState",
  { slug, deviceToken: tA },
);
check("game completed", done.status === "completed", done.status);
check(
  "X wins on the top row",
  done.state.winner === "X" && JSON.stringify(done.state.winningLine) === "[0,1,2]",
  done.state,
);

await expectError(
  m(A, "games:submitMove", { slug, deviceToken: tA, cell: 6 }),
  "invalid_move",
);

const friendView = await q<{ status: string; state: { winner: string } }>(
  B,
  "games:getGameState",
  { slug, deviceToken: tB },
);
check(
  "B sees the same terminal state",
  friendView.status === "completed" && friendView.state.winner === "X",
  friendView,
);

console.log("\n[TTT] Feedback from a registered player");
await m(A, "games:submitFeedback", { slug, deviceToken: tA, wouldPlayAgain: true });
check("feedback accepted", true);

console.log("\n[TTT] Rematch — A plays again, B follows the link");
const rematch = await m<{ slug: string }>(A, "games:playAgain", {
  slug,
  deviceToken: tA,
});
check("playAgain returns a fresh slug", rematch.slug !== slug, rematch);
const oldView = await q<{ state: { rematch?: { slug: string } } }>(B, "games:getGameState", {
  slug,
  deviceToken: tB,
});
check(
  "the finished game points at the rematch for B",
  oldView.state.rematch?.slug === rematch.slug,
  oldView.state,
);

const rematchJoin = await m<{ me: { marker: string } }>(B, "games:joinGame", {
  slug: rematch.slug,
  deviceToken: tB,
});
check("B joins the rematch as O", rematchJoin.me.marker === "O", rematchJoin.me);
await expectError(m(C, "games:joinGame", { slug: rematch.slug, deviceToken: tC }), "locked");

await m(A, "games:submitMove", { slug: rematch.slug, deviceToken: tA, cell: 4 });
const fresh = await q<{ state: { board: string[]; turn: string } }>(B, "games:getGameState", {
  slug: rematch.slug,
  deviceToken: tB,
});
check(
  "the rematch is a fresh board, first move lands",
  fresh.state.board[4] === "X" && fresh.state.turn === "O",
  fresh.state,
);

// --- RPS: full best-of-3 match — picks masked until both are in -------------

console.log("\n[RPS] Create + join, then a full best-of-3 match");
const rps = await m<{ slug: string }>(A, "games:createGame", {
  gameType: "rock_paper_scissors",
  deviceToken: tA,
});
await m(B, "games:joinGame", { slug: rps.slug, deviceToken: tB });

console.log("  Round 1 — A picks rock; masking is verified before B responds");
await m(A, "games:submitMove", { slug: rps.slug, deviceToken: tA, pick: "rock" });

const aView = await q<{ state: { picks: { X: unknown; O: unknown } }; me: { picked: boolean } }>(
  A,
  "games:getGameState",
  { slug: rps.slug, deviceToken: tA },
);
const bView = await q<{ state: { picks: { X: unknown; O: unknown } }; me: { picked: boolean } }>(
  B,
  "games:getGameState",
  { slug: rps.slug, deviceToken: tB },
);
check(
  "A's own pick is masked even to A",
  aView.state.picks.X === null && aView.state.picks.O === null,
  aView.state.picks,
);
check("A is flagged as picked", aView.me.picked === true, aView.me);
check(
  "B sees no pick and isn't flagged",
  bView.state.picks.X === null && bView.me.picked === false,
  bView,
);

const r1 = await m<{
  state: {
    winner: string;
    round: number;
    picks: { X: unknown; O: unknown };
    scores: { X: number; O: number };
  };
}>(B, "games:submitMove", { slug: rps.slug, deviceToken: tB, pick: "scissors" });
check(
  "round 1 resolves — rock beats scissors, picks revealed, 1-0",
  r1.state.winner === "X" &&
    r1.state.round === 1 &&
    r1.state.picks.X === "rock" &&
    r1.state.picks.O === "scissors" &&
    r1.state.scores.X === 1,
  r1.state,
);

console.log("  Round 2 — a draw replays the round with no score change");
await m(A, "games:submitMove", { slug: rps.slug, deviceToken: tA, pick: "rock" });
const draw = await m<{
  state: {
    winner: string;
    round: number;
    scores: { X: number; O: number };
    matchWinner: string | null;
  };
}>(B, "games:submitMove", { slug: rps.slug, deviceToken: tB, pick: "rock" });
check(
  "draw replays round 2, scores still 1-0",
  draw.state.winner === "draw" &&
    draw.state.round === 2 &&
    draw.state.scores.X === 1 &&
    draw.state.matchWinner === null,
  draw.state,
);

console.log("  Round 2 replay — A takes the match 2-0");
await m(A, "games:submitMove", { slug: rps.slug, deviceToken: tA, pick: "paper" });
const r2 = await m<{
  state: {
    matchWinner: string | null;
    round: number;
    scores: { X: number; O: number };
    picks: { X: unknown; O: unknown };
  };
}>(B, "games:submitMove", { slug: rps.slug, deviceToken: tB, pick: "rock" });
check(
  "A wins the match at two round wins (2-0)",
  r2.state.matchWinner === "X" &&
    r2.state.round === 2 &&
    r2.state.scores.X === 2 &&
    r2.state.picks.X === "paper" &&
    r2.state.picks.O === "rock",
  r2.state,
);

const rpsDone = await q<{ status: string }>(A, "games:getGameState", {
  slug: rps.slug,
  deviceToken: tA,
});
check("RPS game is completed", rpsDone.status === "completed", rpsDone.status);
await expectError(
  m(A, "games:submitMove", { slug: rps.slug, deviceToken: tA, pick: "rock" }),
  "invalid_move",
);

// --- Red or Black: server-side draw, instant reveal -------------------------

console.log("\n[Red or Black] server draws the card, instant reveal");
const rb = await m<{ slug: string }>(A, "games:createGame", {
  gameType: "red_or_black",
  deviceToken: tA,
});
await m(B, "games:joinGame", { slug: rb.slug, deviceToken: tB });
const rbRes = await m<{ state: { guess: string; draw: string; winner: string } }>(
  B,
  "games:submitMove",
  { slug: rb.slug, deviceToken: tB, pick: "red" },
);
check(
  "guess locked in + server draw revealed",
  rbRes.state.guess === "red" && (rbRes.state.draw === "red" || rbRes.state.draw === "black"),
  rbRes.state,
);
check(
  "winner follows guess vs draw",
  rbRes.state.winner === (rbRes.state.guess === rbRes.state.draw ? "O" : "X"),
  rbRes.state,
);

// --- Pong: full match — first to 7, the serve is always visible -------------

console.log("\n[Pong] Create + join, then a full 7-point match");
const pg = await m<{ slug: string }>(A, "games:createGame", {
  gameType: "pong",
  deviceToken: tA,
});
await m(B, "games:joinGame", { slug: pg.slug, deviceToken: tB });

interface PointState {
  phase: string;
  scores: { X: number; O: number };
  matchWinner: string | null;
  serve: { angle: number } | null;
}
let finalPoint: PointState | null = null;
for (let i = 1; i <= 7; i++) {
  // A serves down the middle; B's wild return (+45°) always misses the mirror
  // window, so A scores every point and the match resolves deterministically.
  const serve = await m<{ state: PointState }>(A, "games:submitMove", {
    slug: pg.slug,
    deviceToken: tA,
    angle: 0,
    power: 1,
  });
  if (i === 1) {
    check(
      "serve in flight and visible to the returner",
      serve.state.phase === "return" && serve.state.serve?.angle === 0,
      serve.state,
    );
  }
  const point = await m<{ state: PointState }>(B, "games:submitMove", {
    slug: pg.slug,
    deviceToken: tB,
    angle: 45,
    power: 1,
  });
  finalPoint = point.state;
  if (i < 7) {
    check(
      `point ${i} to A (${i}-0)`,
      point.state.phase === "point_over" &&
        point.state.scores.X === i &&
        point.state.scores.O === 0,
      point.state.scores,
    );
  }
}

check(
  "match over at 7-0, first to seven",
  finalPoint?.phase === "match_over" &&
    finalPoint?.matchWinner === "X" &&
    finalPoint?.scores.X === 7 &&
    finalPoint?.scores.O === 0,
  finalPoint,
);

const pgDone = await q<{ status: string }>(A, "games:getGameState", {
  slug: pg.slug,
  deviceToken: tA,
});
check("Pong game is completed", pgDone.status === "completed", pgDone.status);
await expectError(
  m(A, "games:submitMove", { slug: pg.slug, deviceToken: tA, angle: 0, power: 1 }),
  "invalid_move",
);

// --- summary ----------------------------------------------------------------

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
