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

// --- RPS: picks stay masked until both are in -------------------------------

console.log("\n[RPS] Create + join + masking check");
const rps = await m<{ slug: string }>(A, "games:createGame", {
  gameType: "rock_paper_scissors",
  deviceToken: tA,
});
await m(B, "games:joinGame", { slug: rps.slug, deviceToken: tB });
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

await m(B, "games:submitMove", { slug: rps.slug, deviceToken: tB, pick: "scissors" });
const resolved = await q<{
  state: { winner: string; picks: { X: unknown; O: unknown }; scores: { X: number; O: number } };
}>(A, "games:getGameState", { slug: rps.slug, deviceToken: tA });
check("round resolves — rock beats scissors", resolved.state.winner === "X", resolved.state.winner);
check(
  "picks are revealed once resolved",
  resolved.state.picks.X === "rock" && resolved.state.picks.O === "scissors",
  resolved.state.picks,
);
check(
  "score is 1-0",
  resolved.state.scores.X === 1 && resolved.state.scores.O === 0,
  resolved.state.scores,
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

// --- Pong: serve visible, return resolves the point -------------------------

console.log("\n[Pong] serve in flight, return resolves the point");
const pg = await m<{ slug: string }>(A, "games:createGame", {
  gameType: "pong",
  deviceToken: tA,
});
await m(B, "games:joinGame", { slug: pg.slug, deviceToken: tB });
const serve = await m<{ state: { phase: string; turn: string; serve: { angle: number } } }>(
  A,
  "games:submitMove",
  { slug: pg.slug, deviceToken: tA, angle: 30, power: 2 },
);
check(
  "serve in flight and visible to the returner",
  serve.state.phase === "return" && serve.state.serve?.angle === 30,
  serve.state,
);
const point = await m<{
  state: { phase: string; scores: { X: number; O: number }; lastPoint: { good: boolean } };
}>(B, "games:submitMove", { slug: pg.slug, deviceToken: tB, angle: -30, power: 2 });
check(
  "mirrored return scores the returner",
  point.state.phase === "point_over" && point.state.lastPoint?.good === true,
  point.state,
);

// --- summary ----------------------------------------------------------------

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
