// ---------------------------------------------------------------------------
// Backend integration tests — the Recess API rules in src/convex/games.ts,
// run through the in-memory harness in tests/helpers/convex-harness.ts.
//
// These exercise the REAL server handlers (not copies of the logic), so the
// security rules are under test exactly as they run in production:
//   - a device token only counts after it's matched to a players row
//   - a NEW device is rejected from any in_progress/completed game
//   - every move is validated server-side (turn, cell, status, ranges)
//   - RPS picks stay masked until both players have submitted
//   - Red or Black draws happen server-side, never client-side
//   - playAgain builds a fresh game between the same two device tokens
//   - games untouched for 48 hours are abandoned
// ---------------------------------------------------------------------------

import { describe, expect, test } from "bun:test";
import {
  cleanupAbandoned,
  createGame,
  getGameState,
  getOgMetadata,
  joinGame,
  playAgain,
  submitFeedback,
  submitMove,
  EXPIRY_MS,
} from "../src/convex/games";
import { FakeDb, expectCode, run } from "./helpers/convex-harness";
import type { AnyDoc } from "./helpers/convex-harness";

type GameRow = AnyDoc & {
  slug: string;
  gameType: string;
  status: string;
  state: Record<string, unknown>;
};

/** Create a game with device-A as the initiator and return its row. */
async function newGame(
  db: FakeDb,
  gameType = "tic_tac_toe",
  deviceToken = "device-A",
): Promise<{ slug: string; game: GameRow }> {
  const { slug } = (await run(createGame, db, {
    gameType,
    deviceToken,
  })) as { slug: string };
  const game = db.all("games").find((g) => g.slug === slug) as GameRow;
  return { slug, game };
}

/** Create a game and have device-B join it (now in_progress, X vs O). */
async function twoPlayerGame(
  db: FakeDb,
  gameType = "tic_tac_toe",
): Promise<{ slug: string; game: GameRow }> {
  const { slug, game } = await newGame(db, gameType);
  await run(joinGame, db, { slug, deviceToken: "device-B" });
  return { slug, game };
}

/** Walk a Tic Tac Toe game to completion: X wins with the top row. */
async function finishTicTacToe(db: FakeDb, slug: string) {
  for (const [token, cell] of [
    ["device-A", 0],
    ["device-B", 3],
    ["device-A", 1],
    ["device-B", 4],
    ["device-A", 2],
  ] as const) {
    await run(submitMove, db, { slug, deviceToken: token, cell });
  }
}

function gameBySlug(db: FakeDb, slug: string): GameRow {
  return db.all("games").find((g) => g.slug === slug) as GameRow;
}

// ---------------------------------------------------------------------------
// POST /api/games — create
// ---------------------------------------------------------------------------

describe("createGame", () => {
  test("creates a waiting game with the initiator as X", async () => {
    const db = new FakeDb();
    const { slug, game } = await newGame(db);
    expect(slug).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(game.gameType).toBe("tic_tac_toe");
    expect(game.status).toBe("waiting");
    const players = db.all("players");
    expect(players).toHaveLength(1);
    expect(players[0].deviceToken).toBe("device-A");
    expect(players[0].role).toBe("initiator");
    expect(players[0].marker).toBe("X");
    expect(game.state).toEqual({
      board: ["", "", "", "", "", "", "", "", ""],
      turn: "X",
      winner: null,
      draw: false,
      winningLine: null,
    });
  });

  test("rejects an unsupported game type", async () => {
    const db = new FakeDb();
    await expectCode(
      run(createGame, db, {
        gameType: "truth_or_dare",
        deviceToken: "device-A",
      }),
      "unsupported_game",
    );
  });

  test("rejects a missing or too-short device token", async () => {
    const db = new FakeDb();
    await expectCode(
      run(createGame, db, { gameType: "tic_tac_toe", deviceToken: "abc" }),
      "not_a_player",
    );
  });

  test("room slugs are create-or-join: the same live slug is returned", async () => {
    const db = new FakeDb();
    const first = (await run(createGame, db, {
      gameType: "tic_tac_toe",
      deviceToken: "device-A",
      slug: "sunny-4c",
    })) as { slug: string };
    expect(first.slug).toBe("sunny-4c");

    // Second player opens the same room link while it's still alive.
    const second = (await run(createGame, db, {
      gameType: "tic_tac_toe",
      deviceToken: "device-B",
      slug: "sunny-4c",
    })) as { slug: string };
    expect(second.slug).toBe("sunny-4c");
    expect(db.all("games")).toHaveLength(1);
  });

  test("a dead room gets a fresh UUID, never a second game under the old slug", async () => {
    const db = new FakeDb();
    const { game } = await newGame(db);
    await db.patch(game._id, { status: "completed" });
    const fresh = (await run(createGame, db, {
      gameType: "tic_tac_toe",
      deviceToken: "device-A",
      slug: game.slug,
    })) as { slug: string };
    expect(fresh.slug).not.toBe(game.slug);
    expect(fresh.slug).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("an alive room for a different game type gets a fresh slug, never the wrong game", async () => {
    const db = new FakeDb();
    await run(createGame, db, {
      gameType: "pong",
      deviceToken: "device-A",
      slug: "sunny-4c",
    });
    // Someone opens ?room=sunny-4c&game=tic-tac-toe — the room is a live Pong
    // game, so the invite must not silently hand them a game the preview
    // didn't promise.
    const res = (await run(createGame, db, {
      gameType: "tic_tac_toe",
      deviceToken: "device-B",
      slug: "sunny-4c",
    })) as { slug: string };
    expect(res.slug).not.toBe("sunny-4c");
    expect(res.slug).toMatch(/^[0-9a-f-]{36}$/);
    const fresh = gameBySlug(db, res.slug);
    expect(fresh.gameType).toBe("tic_tac_toe");
    // The original Pong room is untouched.
    expect(gameBySlug(db, "sunny-4c").gameType).toBe("pong");
  });

  test("rejects malformed room tokens", async () => {
    const db = new FakeDb();
    await expectCode(
      run(createGame, db, {
        gameType: "tic_tac_toe",
        deviceToken: "device-A",
        slug: "no spaces!",
      }),
      "invalid_room",
    );
  });
});

// ---------------------------------------------------------------------------
// GET /api/games/:id — join, and the third-player lock
// ---------------------------------------------------------------------------

describe("joinGame", () => {
  test("the second device joins as responder O and the game starts", async () => {
    const db = new FakeDb();
    const { slug } = await newGame(db);
    const res = (await run(joinGame, db, {
      slug,
      deviceToken: "device-B",
    })) as { joined: boolean; me: { role: string; marker: string } };
    expect(res).toEqual({ joined: true, me: { role: "responder", marker: "O" } });
    expect(gameBySlug(db, slug).status).toBe("in_progress");
    const markers = db.all("players").map((p) => p.marker).sort();
    expect(markers).toEqual(["O", "X"]);
  });

  test("re-joining is idempotent and keeps the same role", async () => {
    const db = new FakeDb();
    const { slug } = await newGame(db);
    await run(joinGame, db, { slug, deviceToken: "device-B" });
    const again = (await run(joinGame, db, {
      slug,
      deviceToken: "device-A",
    })) as { me: { marker: string } };
    expect(again.me.marker).toBe("X");
    expect(db.all("players")).toHaveLength(2);
  });

  test("a NEW device is rejected from an in-progress game", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db);
    await expectCode(
      run(joinGame, db, { slug, deviceToken: "intruder" }),
      "locked",
    );
    // The intruder never becomes a player.
    expect(db.all("players")).toHaveLength(2);
  });

  test("a NEW device is rejected from a completed game", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db);
    await finishTicTacToe(db, slug);
    expect(gameBySlug(db, slug).status).toBe("completed");
    await expectCode(
      run(joinGame, db, { slug, deviceToken: "intruder" }),
      "locked",
    );
  });

  test("a game untouched for 48h is lazily expired on join", async () => {
    const db = new FakeDb();
    const { slug, game } = await newGame(db);
    await db.patch(game._id, { updatedAt: Date.now() - EXPIRY_MS - 1000 });
    await expectCode(
      run(joinGame, db, { slug, deviceToken: "device-B" }),
      "expired",
    );
    expect(gameBySlug(db, slug).status).toBe("abandoned");
  });

  test("re-joining refreshes the 48-hour untouched clock", async () => {
    const db = new FakeDb();
    const { slug, game } = await newGame(db);
    // The game was last touched 47h ago — not stale, but close.
    await db.patch(game._id, { updatedAt: Date.now() - (EXPIRY_MS - 60_000) });
    const before = gameBySlug(db, slug).updatedAt as number;
    // The initiator re-opens the link — an explicit action.
    await run(joinGame, db, { slug, deviceToken: "device-A" });
    const after = gameBySlug(db, slug).updatedAt as number;
    expect(after).toBeGreaterThan(before);
    // The refresh buys a fresh 48h window, so a cleanup run leaves it alone.
    const res = (await run(cleanupAbandoned, db)) as { abandoned: number };
    expect(res.abandoned).toBe(0);
    expect(gameBySlug(db, slug).status).toBe("waiting");
  });
});

// ---------------------------------------------------------------------------
// GET /api/games/:id/state — reads respect the same lock + RPS masking
// ---------------------------------------------------------------------------

describe("getGameState", () => {
  test("a registered player sees the full state", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db);
    const res = (await run(getGameState, db, {
      slug,
      deviceToken: "device-A",
    })) as { status: string; me: { marker: string } };
    expect(res.status).toBe("in_progress");
    expect(res.me.marker).toBe("X");
  });

  test("a NEW device gets nothing on an in-progress game", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db);
    await expectCode(
      run(getGameState, db, { slug, deviceToken: "intruder" }),
      "locked",
    );
  });

  test("a NEW device gets nothing on a completed game", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db);
    await finishTicTacToe(db, slug);
    await expectCode(
      run(getGameState, db, { slug, deviceToken: "intruder" }),
      "locked",
    );
  });

  test("RPS picks stay masked while a round is open, but 'picked' is truthful", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "rock_paper_scissors");
    await run(submitMove, db, { slug, deviceToken: "device-A", pick: "rock" });

    const forA = (await run(getGameState, db, {
      slug,
      deviceToken: "device-A",
    })) as { me: { picked: boolean }; state: { picks: unknown } };
    expect(forA.me.picked).toBe(true);
    expect(forA.state.picks).toEqual({ X: null, O: null }); // masked

    const forB = (await run(getGameState, db, {
      slug,
      deviceToken: "device-B",
    })) as { me: { picked: boolean }; state: { picks: unknown } };
    expect(forB.me.picked).toBe(false);
    expect(forB.state.picks).toEqual({ X: null, O: null });
  });
});

// ---------------------------------------------------------------------------
// POST /api/games/:id/moves — Tic Tac Toe
// ---------------------------------------------------------------------------

describe("submitMove — Tic Tac Toe", () => {
  test("a non-player's move is rejected — the device token, not a client id", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db);
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "intruder", cell: 0 }),
      "not_a_player",
    );
    expect(db.all("moves")).toHaveLength(0);
  });

  test("moves on a waiting game are rejected", async () => {
    const db = new FakeDb();
    const { slug } = await newGame(db);
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", cell: 0 }),
      "invalid_move",
    );
  });

  test("moves off the board are rejected", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db);
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", cell: 9 }),
      "invalid_move",
    );
  });

  test("players must alternate turns", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db);
    await run(submitMove, db, { slug, deviceToken: "device-A", cell: 0 });
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", cell: 1 }),
      "invalid_move",
    );
    // O's move lands, then it's X's turn again.
    await run(submitMove, db, { slug, deviceToken: "device-B", cell: 3 });
    await run(submitMove, db, { slug, deviceToken: "device-A", cell: 1 });
  });

  test("occupied cells are rejected", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db);
    await run(submitMove, db, { slug, deviceToken: "device-A", cell: 0 });
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-B", cell: 0 }),
      "invalid_move",
    );
  });

  test("a winning move completes the game and records the moves", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db);
    await finishTicTacToe(db, slug);
    const game = gameBySlug(db, slug);
    expect(game.status).toBe("completed");
    expect(game.state.winner).toBe("X");
    expect(game.state.winningLine).toEqual([0, 1, 2]);
    expect(db.all("moves")).toHaveLength(5);
  });

  test("moves after completion are rejected", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db);
    await finishTicTacToe(db, slug);
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", cell: 6 }),
      "invalid_move",
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/games/:id/moves — Rock Paper Scissors
// ---------------------------------------------------------------------------

describe("submitMove — Rock Paper Scissors", () => {
  test("an invalid pick is rejected", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "rock_paper_scissors");
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", pick: "lizard" }),
      "invalid_move",
    );
  });

  test("a single pick is stored but never revealed", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "rock_paper_scissors");
    const res = (await run(submitMove, db, {
      slug,
      deviceToken: "device-A",
      pick: "rock",
    })) as { state: { phase: string; picks: unknown; winner: unknown } };
    expect(res.state.phase).toBe("picking");
    expect(res.state.picks).toEqual({ X: null, O: null }); // response masked too
    expect(res.state.winner).toBeNull();
    expect(gameBySlug(db, slug).status).toBe("in_progress");
  });

  test("picking twice in the same round is rejected", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "rock_paper_scissors");
    await run(submitMove, db, { slug, deviceToken: "device-A", pick: "rock" });
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", pick: "paper" }),
      "invalid_move",
    );
  });

  test("both picks resolve the round and score it", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "rock_paper_scissors");
    await run(submitMove, db, { slug, deviceToken: "device-A", pick: "rock" });
    const res = (await run(submitMove, db, {
      slug,
      deviceToken: "device-B",
      pick: "scissors",
    })) as { state: { phase: string; winner: string; scores: object } };
    expect(res.state.phase).toBe("resolved");
    expect(res.state.winner).toBe("X");
    expect(res.state.scores).toEqual({ X: 1, O: 0 });
  });

  test("a draw replays the same round", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "rock_paper_scissors");
    await run(submitMove, db, { slug, deviceToken: "device-A", pick: "paper" });
    const draw = (await run(submitMove, db, {
      slug,
      deviceToken: "device-B",
      pick: "paper",
    })) as { state: { winner: string; round: number; scores: object } };
    expect(draw.state.winner).toBe("draw");
    expect(draw.state.scores).toEqual({ X: 0, O: 0 });
    // The next pick still replays round 1.
    await run(submitMove, db, { slug, deviceToken: "device-A", pick: "rock" });
    expect(
      (gameBySlug(db, slug).state as { round: number }).round,
    ).toBe(1);
  });

  test("the match completes at two round wins", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "rock_paper_scissors");
    // Round 1: X wins.
    await run(submitMove, db, { slug, deviceToken: "device-A", pick: "rock" });
    await run(submitMove, db, { slug, deviceToken: "device-B", pick: "scissors" });
    // Round 2: X wins again — best of three.
    await run(submitMove, db, { slug, deviceToken: "device-A", pick: "paper" });
    const res = (await run(submitMove, db, {
      slug,
      deviceToken: "device-B",
      pick: "rock",
    })) as { state: { matchWinner: string } };
    expect(res.state.matchWinner).toBe("X");
    expect(gameBySlug(db, slug).status).toBe("completed");
  });

  test("the pick that starts a new round is audited against the new round", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "rock_paper_scissors");
    // Round 1: X wins.
    await run(submitMove, db, { slug, deviceToken: "device-A", pick: "rock" });
    await run(submitMove, db, { slug, deviceToken: "device-B", pick: "scissors" });
    // X opens round 2 — this move belongs to round 2, not round 1.
    await run(submitMove, db, { slug, deviceToken: "device-A", pick: "paper" });
    const rounds = db
      .all("moves")
      .map((m) => (m.payload as { round: number }).round);
    expect(rounds).toEqual([1, 1, 2]);
  });

  test("a non-player's pick is rejected", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "rock_paper_scissors");
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "intruder", pick: "rock" }),
      "not_a_player",
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/games/:id/moves — Red or Black
// ---------------------------------------------------------------------------

describe("submitMove — Red or Black", () => {
  test("only the responder (O) guesses — the host never submits", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "red_or_black");
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", pick: "red" }),
      "invalid_move",
    );
    expect(db.all("moves")).toHaveLength(0);
  });

  test("a guess resolves instantly against a server-side draw", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "red_or_black");
    const res = (await run(submitMove, db, {
      slug,
      deviceToken: "device-B",
      pick: "red",
    })) as { state: { phase: string; guess: string; draw: string; winner: string; scores: object } };
    expect(res.state.phase).toBe("resolved");
    expect(res.state.guess).toBe("red");
    // The draw is server-generated and always a valid color.
    expect(["red", "black"]).toContain(res.state.draw);
    expect(res.state.winner).toBe(
      res.state.guess === res.state.draw ? "O" : "X",
    );
    expect(res.state.scores).toEqual(
      res.state.guess === res.state.draw ? { X: 0, O: 1 } : { X: 1, O: 0 },
    );
  });

  test("the match completes at two round wins", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "red_or_black");
    let state: Record<string, unknown> = {};
    for (let i = 0; i < 5 && !state.matchWinner; i++) {
      const res = (await run(submitMove, db, {
        slug,
        deviceToken: "device-B",
        pick: "red",
      })) as { state: Record<string, unknown> };
      state = res.state;
    }
    expect(["X", "O"]).toContain(state.matchWinner);
    expect(gameBySlug(db, slug).status).toBe("completed");
  });

  test("a guess that opens a new round is audited against the new round", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "red_or_black");
    await run(submitMove, db, { slug, deviceToken: "device-B", pick: "red" });
    // The next guess opens round 2 — it must be audited as round 2.
    await run(submitMove, db, { slug, deviceToken: "device-B", pick: "red" });
    const rounds = db
      .all("moves")
      .map((m) => (m.payload as { round: number }).round);
    expect(rounds).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
// POST /api/games/:id/moves — Pong
// ---------------------------------------------------------------------------

describe("submitMove — Pong", () => {
  test("the serve goes in flight and is visible to the returner", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "pong");
    const res = (await run(submitMove, db, {
      slug,
      deviceToken: "device-A",
      angle: 30,
      power: 2,
    })) as { state: { phase: string; turn: string; serve: unknown } };
    expect(res.state.phase).toBe("return");
    expect(res.state.turn).toBe("O");
    // Unlike RPS picks, the incoming shot is never hidden.
    expect(res.state.serve).toEqual({ angle: 30, power: 2 });
  });

  test("the server can't take a second shot while the ball is in flight", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "pong");
    await run(submitMove, db, { slug, deviceToken: "device-A", angle: 30, power: 2 });
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", angle: -30, power: 1 }),
      "invalid_move",
    );
  });

  test("out-of-range angles and powers are rejected", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "pong");
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", angle: 90, power: 2 }),
      "invalid_move",
    );
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", angle: 0, power: 4 }),
      "invalid_move",
    );
    await run(submitMove, db, { slug, deviceToken: "device-A", angle: -60, power: 1 });
    // Returns are capped tighter than serves.
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-B", angle: 50, power: 1 }),
      "invalid_move",
    );
  });

  test("a good return scores the returner, who serves next", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "pong");
    await run(submitMove, db, { slug, deviceToken: "device-A", angle: 30, power: 1 });
    const res = (await run(submitMove, db, {
      slug,
      deviceToken: "device-B",
      angle: -30,
      power: 1,
    })) as { state: { phase: string; turn: string; scores: object; lastPoint: { winner: string; good: boolean } } };
    expect(res.state.phase).toBe("point_over");
    expect(res.state.lastPoint.winner).toBe("O");
    expect(res.state.lastPoint.good).toBe(true);
    expect(res.state.scores).toEqual({ X: 0, O: 1 });
    expect(res.state.turn).toBe("O"); // the point winner serves next
  });

  test("the match completes at seven points", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "pong");
    let state: Record<string, unknown> = {};
    // X serves down the middle; O's wild return always misses — X scores.
    for (let i = 0; i < 7; i++) {
      await run(submitMove, db, { slug, deviceToken: "device-A", angle: 0, power: 1 });
      const res = (await run(submitMove, db, {
        slug,
        deviceToken: "device-B",
        angle: 45,
        power: 1,
      })) as { state: Record<string, unknown> };
      state = res.state;
    }
    expect((state as { matchWinner: string }).matchWinner).toBe("X");
    expect((state as { phase: string }).phase).toBe("match_over");
    expect((state as { scores: object }).scores).toEqual({ X: 7, O: 0 });
    expect(gameBySlug(db, slug).status).toBe("completed");
  });
});

// ---------------------------------------------------------------------------
// POST /api/games/:id/moves — Twenty Questions
// ---------------------------------------------------------------------------

describe("submitMove — Twenty Questions", () => {
  test("createGame starts a fresh Twenty Questions game in setup", async () => {
    const db = new FakeDb();
    const { slug, game } = await newGame(db, "twenty_questions");
    expect(game.status).toBe("waiting");
    expect((game.state as { phase: string }).phase).toBe("setup");
    expect((game.state as { secret: unknown }).secret).toBeNull();
    expect(slug).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("only the answerer (X) sets the secret during setup", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "twenty_questions");
    // O tries to set the secret — rejected.
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-B", secret: "sneaky" }),
      "invalid_move",
    );
    // X sets it and the game opens.
    const res = (await run(submitMove, db, {
      slug,
      deviceToken: "device-A",
      secret: "  a giraffe  ",
    })) as { state: { phase: string; secret: string } };
    expect(res.state.phase).toBe("asking");
    expect(res.state.secret).toBe("a giraffe"); // trimmed server-side
    expect(db.all("moves")).toHaveLength(1);
    expect((db.all("moves")[0].payload as { type: string }).type).toBe("secret");
  });

  test("empty or over-long secrets are rejected", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "twenty_questions");
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", secret: "   " }),
      "invalid_move",
    );
    await expectCode(
      run(submitMove, db, {
        slug,
        deviceToken: "device-A",
        secret: "x".repeat(81),
      }),
      "invalid_move",
    );
  });

  test("asking a question is O's move and opens the answerer's turn", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "twenty_questions");
    await run(submitMove, db, { slug, deviceToken: "device-A", secret: "giraffe" });

    // X can't ask — only the asker does.
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", question: "Am I tall?" }),
      "invalid_move",
    );
    // O asks.
    const res = (await run(submitMove, db, {
      slug,
      deviceToken: "device-B",
      question: "Is it an animal?",
    })) as { state: { pendingQuestion: string; secret: unknown } };
    expect(res.state.pendingQuestion).toBe("Is it an animal?");
    // The response to O masks the secret.
    expect(res.state.secret).toBeNull();
  });

  test("only X answers, and the pair is recorded", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "twenty_questions");
    await run(submitMove, db, { slug, deviceToken: "device-A", secret: "giraffe" });
    await run(submitMove, db, {
      slug,
      deviceToken: "device-B",
      question: "Is it an animal?",
    });

    // O tries to answer their own question — rejected.
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-B", answer: "yes" }),
      "invalid_move",
    );
    // X answers.
    const res = (await run(submitMove, db, {
      slug,
      deviceToken: "device-A",
      answer: "yes",
    })) as { state: { questions: { text: string; answer: string }[] } };
    expect(res.state.questions).toEqual([
      { text: "Is it an animal?", answer: "yes" },
    ]);
    expect(res.state.pendingQuestion).toBeNull();
  });

  test("exactly one action per move is enforced", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "twenty_questions");
    await expectCode(
      run(submitMove, db, {
        slug,
        deviceToken: "device-A",
        question: "X?",
        secret: "giraffe",
      }),
      "invalid_move",
    );
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", secret: "giraffe", guess: "giraffe" }),
      "invalid_move",
    );
  });

  test("a correct guess completes the game with O the winner, secret revealed", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "twenty_questions");
    await run(submitMove, db, { slug, deviceToken: "device-A", secret: "Giraffe" });
    await run(submitMove, db, {
      slug,
      deviceToken: "device-B",
      question: "Is it an animal?",
    });
    await run(submitMove, db, { slug, deviceToken: "device-A", answer: "yes" });

    const res = (await run(submitMove, db, {
      slug,
      deviceToken: "device-B",
      // Matches the secret "Giraffe" after trim + lowercase — normalization
      // is case/whitespace only, so "a giraffe" would NOT win this round.
      guess: " giraffe ",
    })) as { state: { phase: string; winner: string; secret: string } };
    expect(res.state.phase).toBe("match_over");
    expect(res.state.winner).toBe("O");
    expect(res.state.secret).toBe("Giraffe");
    expect(gameBySlug(db, slug).status).toBe("completed");

    // Both players now see the revealed secret.
    const forB = (await run(getGameState, db, {
      slug,
      deviceToken: "device-B",
    })) as { state: { secret: string } };
    expect(forB.state.secret).toBe("Giraffe");
  });

  test("a wrong final guess loses — X wins", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "twenty_questions");
    await run(submitMove, db, { slug, deviceToken: "device-A", secret: "giraffe" });
    const res = (await run(submitMove, db, {
      slug,
      deviceToken: "device-B",
      guess: "zebra",
    })) as { state: { winner: string } };
    expect(res.state.winner).toBe("X");
    expect(gameBySlug(db, slug).status).toBe("completed");
  });

  test("the secret is masked from the asker on reads until the match ends", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "twenty_questions");
    await run(submitMove, db, { slug, deviceToken: "device-A", secret: "giraffe" });

    // O reads — the secret is hidden.
    const forB = (await run(getGameState, db, {
      slug,
      deviceToken: "device-B",
    })) as { state: { secret: unknown; phase: string } };
    expect(forB.state.secret).toBeNull();
    expect(forB.state.phase).toBe("asking");

    // X reads — their own secret is visible.
    const forA = (await run(getGameState, db, {
      slug,
      deviceToken: "device-A",
    })) as { state: { secret: unknown } };
    expect(forA.state.secret).toBe("giraffe");
  });

  test("after 20 questions the asker gets one final guess, no more questions", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "twenty_questions");
    await run(submitMove, db, { slug, deviceToken: "device-A", secret: "giraffe" });
    for (let i = 0; i < 20; i++) {
      await run(submitMove, db, {
        slug,
        deviceToken: "device-B",
        question: `Question ${i + 1}?`,
      });
      await run(submitMove, db, {
        slug,
        deviceToken: "device-A",
        answer: i % 2 === 0 ? "yes" : "no",
      });
    }
    const state = gameBySlug(db, slug).state as {
      phase: string;
      questions: unknown[];
    };
    expect(state.phase).toBe("final");
    expect(state.questions).toHaveLength(20);

    // Asking more is rejected; only the final guess is accepted.
    await expectCode(
      run(submitMove, db, {
        slug,
        deviceToken: "device-B",
        question: "One more?",
      }),
      "invalid_move",
    );
    const res = (await run(submitMove, db, {
      slug,
      deviceToken: "device-B",
      guess: "giraffe",
    })) as { state: { winner: string } };
    expect(res.state.winner).toBe("O");
    expect(gameBySlug(db, slug).status).toBe("completed");
  });

  test("a non-player's move is rejected", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "twenty_questions");
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "intruder", secret: "giraffe" }),
      "not_a_player",
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/games/:id/moves — Hangman
// ---------------------------------------------------------------------------

describe("submitMove — Hangman", () => {
  test("createGame starts a fresh Hangman game in setup", async () => {
    const db = new FakeDb();
    const { slug, game } = await newGame(db, "hangman");
    expect(game.status).toBe("waiting");
    const state = game.state as { phase: string; secret: unknown; maxWrong: number };
    expect(state.phase).toBe("setup");
    expect(state.secret).toBeNull();
    expect(state.maxWrong).toBe(6);
    expect(slug).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("only the setter (X) locks in the word during setup", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "hangman");
    // O tries to set the word — rejected.
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-B", secret: "sneaky" }),
      "invalid_move",
    );
    const res = (await run(submitMove, db, {
      slug,
      deviceToken: "device-A",
      secret: "  a banana split  ",
    })) as { state: { phase: string; secret: string; revealed: string[] } };
    expect(res.state.phase).toBe("guessing");
    expect(res.state.secret).toBe("a banana split"); // trimmed server-side
    expect(res.state.revealed).toEqual([
      "_", " ", "_", "_", "_", "_", "_", "_", " ", "_", "_", "_", "_", "_",
    ]);
    expect(db.all("moves")).toHaveLength(1);
  });

  test("empty, over-long, or invalid secrets are rejected", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "hangman");
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", secret: "   " }),
      "invalid_move",
    );
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", secret: "x".repeat(25) }),
      "invalid_move",
    );
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", secret: "c4t!" }),
      "invalid_move",
    );
  });

  test("a wrong letter counts a miss; a repeat letter is rejected", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "hangman");
    await run(submitMove, db, { slug, deviceToken: "device-A", secret: "banana" });

    const res = (await run(submitMove, db, {
      slug,
      deviceToken: "device-B",
      guess: "z",
    })) as { state: { wrongCount: number; guessed: string[] } };
    expect(res.state.wrongCount).toBe(1);
    expect(res.state.guessed).toEqual(["z"]);

    // Same letter again — rejected before it touches the state.
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-B", guess: "z" }),
      "invalid_move",
    );
    // Non-letters and multi-char non-word input are rejected too.
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-B", guess: "1" }),
      "invalid_move",
    );
  });

  test("the setter never guesses — only the guesser (O) submits moves", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "hangman");
    await run(submitMove, db, { slug, deviceToken: "device-A", secret: "banana" });
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", guess: "b" }),
      "invalid_move",
    );
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "intruder", guess: "b" }),
      "not_a_player",
    );
  });

  test("six misses complete the game with X the winner", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "hangman");
    await run(submitMove, db, { slug, deviceToken: "device-A", secret: "banana" });
    for (const letter of ["q", "w", "e", "r", "t", "y"]) {
      await run(submitMove, db, { slug, deviceToken: "device-B", guess: letter });
    }
    const state = gameBySlug(db, slug).state as { winner: string; phase: string };
    expect(state.winner).toBe("X");
    expect(state.phase).toBe("match_over");
    expect(gameBySlug(db, slug).status).toBe("completed");
  });

  test("a correct word guess completes the game with O the winner, secret revealed", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "hangman");
    await run(submitMove, db, { slug, deviceToken: "device-A", secret: "Giraffe" });
    const res = (await run(submitMove, db, {
      slug,
      deviceToken: "device-B",
      guess: "  giraffe ",
    })) as { state: { winner: string; secret: string } };
    expect(res.state.winner).toBe("O");
    expect(res.state.secret).toBe("Giraffe"); // revealed to the guesser now
    expect(gameBySlug(db, slug).status).toBe("completed");
  });

  test("the word is masked from the guesser on reads until the match ends", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "hangman");
    await run(submitMove, db, { slug, deviceToken: "device-A", secret: "giraffe" });

    // O reads — the word is hidden; only the pattern is visible.
    const forB = (await run(getGameState, db, {
      slug,
      deviceToken: "device-B",
    })) as { state: { secret: unknown; revealed: string[] } };
    expect(forB.state.secret).toBeNull();
    expect(forB.state.revealed).toEqual(["_", "_", "_", "_", "_", "_", "_"]);

    // X reads — their own word is visible.
    const forA = (await run(getGameState, db, {
      slug,
      deviceToken: "device-A",
    })) as { state: { secret: unknown } };
    expect(forA.state.secret).toBe("giraffe");
  });
});

// ---------------------------------------------------------------------------
// POST /api/games/:id/moves — Word Scramble
// ---------------------------------------------------------------------------

describe("submitMove — Word Scramble", () => {
  test("createGame starts a fresh Word Scramble game in setup", async () => {
    const db = new FakeDb();
    const { slug, game } = await newGame(db, "word_scramble");
    expect(game.status).toBe("waiting");
    const state = game.state as { phase: string; scrambled: string; attemptsLeft: number };
    expect(state.phase).toBe("setup");
    expect(state.scrambled).toBe("");
    expect(state.attemptsLeft).toBe(3);
  });

  test("only the setter (X) locks in the word; validation is strict", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "word_scramble");
    // O tries to set the word — rejected.
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-B", secret: "sneaky" }),
      "invalid_move",
    );
    // Not a single word (space), too short, all-same letters.
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", secret: "two words" }),
      "invalid_move",
    );
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", secret: "ab" }),
      "invalid_move",
    );
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", secret: "aaa" }),
      "invalid_move",
    );
  });

  test("the server scrambles the word; the secret stays masked from the solver", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "word_scramble");
    await run(submitMove, db, { slug, deviceToken: "device-A", secret: "giraffe" });

    const state = gameBySlug(db, slug).state as { scrambled: string; secret: string };
    // A permutation of the word's letters — never the original order.
    // "giraffe" has a single a and two f's: A,E,F,F,G,I,R.
    expect([...state.scrambled].sort().join("")).toBe("AEFFGIR");
    expect(state.scrambled).not.toBe("GIRAFFE");

    // Both players see the scrambled letters; the secret is masked for O.
    const forB = (await run(getGameState, db, {
      slug,
      deviceToken: "device-B",
    })) as { state: { secret: unknown; scrambled: string } };
    expect(forB.state.secret).toBeNull();
    expect(forB.state.scrambled).toBe(state.scrambled);
    const forA = (await run(getGameState, db, {
      slug,
      deviceToken: "device-A",
    })) as { state: { secret: unknown } };
    expect(forA.state.secret).toBe("giraffe");
  });

  test("a correct answer wins O and completes the game", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "word_scramble");
    await run(submitMove, db, { slug, deviceToken: "device-A", secret: "Giraffe" });
    const res = (await run(submitMove, db, {
      slug,
      deviceToken: "device-B",
      guess: "  giraffe ",
    })) as { state: { winner: string; secret: string } };
    expect(res.state.winner).toBe("O");
    expect(res.state.secret).toBe("Giraffe"); // revealed now
    expect(gameBySlug(db, slug).status).toBe("completed");
  });

  test("three misses win X; repeated wrong answers are rejected", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "word_scramble");
    await run(submitMove, db, { slug, deviceToken: "device-A", secret: "giraffe" });

    for (const guess of ["zebra", "elephant"]) {
      await run(submitMove, db, { slug, deviceToken: "device-B", guess });
    }
    // Same wrong answer twice — rejected (already tried).
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-B", guess: "zebra" }),
      "invalid_move",
    );
    const res = (await run(submitMove, db, {
      slug,
      deviceToken: "device-B",
      guess: "camel",
    })) as { state: { winner: string; attemptsLeft: number } };
    expect(res.state.attemptsLeft).toBe(0);
    expect(res.state.winner).toBe("X");
    expect(gameBySlug(db, slug).status).toBe("completed");
  });

  test("the setter never answers — only the solver (O) submits moves", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db, "word_scramble");
    await run(submitMove, db, { slug, deviceToken: "device-A", secret: "giraffe" });
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "device-A", guess: "giraffe" }),
      "invalid_move",
    );
    await expectCode(
      run(submitMove, db, { slug, deviceToken: "intruder", guess: "giraffe" }),
      "not_a_player",
    );
  });
});

// ---------------------------------------------------------------------------
// Play Again — a fresh game between the same two device tokens
// ---------------------------------------------------------------------------

describe("playAgain", () => {
  test("creates a fresh in-progress game between the same two devices", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db);
    await finishTicTacToe(db, slug);

    const res = (await run(playAgain, db, {
      slug,
      deviceToken: "device-A",
    })) as { slug: string };
    expect(res.slug).not.toBe(slug);

    const fresh = gameBySlug(db, res.slug);
    expect(fresh.status).toBe("in_progress");
    expect(fresh.gameType).toBe("tic_tac_toe");
    const tokens = db
      .all("players")
      .filter((p) => p.gameId === fresh._id)
      .map((p) => p.deviceToken)
      .sort();
    expect(tokens).toEqual(["device-A", "device-B"]);

    // The finished game points at the rematch so the opponent can follow.
    expect((gameBySlug(db, slug).state as { rematch: unknown }).rematch).toEqual({
      slug: res.slug,
      by: "device-A",
    });

    // Both original devices can rejoin the rematch; a third still can't.
    const b = (await run(joinGame, db, {
      slug: res.slug,
      deviceToken: "device-B",
    })) as { me: { marker: string } };
    expect(b.me.marker).toBe("O");
    await expectCode(
      run(joinGame, db, { slug: res.slug, deviceToken: "intruder" }),
      "locked",
    );
  });

  test("refuses a rematch before the opponent has joined", async () => {
    const db = new FakeDb();
    const { slug } = await newGame(db);
    await expectCode(
      run(playAgain, db, { slug, deviceToken: "device-A" }),
      "not_ready",
    );
  });

  test("a non-player can't start a rematch", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db);
    await expectCode(
      run(playAgain, db, { slug, deviceToken: "intruder" }),
      "not_a_player",
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/games/:id/feedback
// ---------------------------------------------------------------------------

describe("submitFeedback", () => {
  test("records feedback from a registered player", async () => {
    const db = new FakeDb();
    const { slug, game } = await twoPlayerGame(db);
    await run(submitFeedback, db, {
      slug,
      deviceToken: "device-A",
      wouldPlayAgain: true,
    });
    const rows = db.all("feedback");
    expect(rows).toHaveLength(1);
    expect(rows[0].gameId).toBe(game._id);
    expect(rows[0].wouldPlayAgain).toBe(true);
  });

  test("a non-player's feedback is rejected", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db);
    await expectCode(
      run(submitFeedback, db, {
        slug,
        deviceToken: "intruder",
        wouldPlayAgain: false,
      }),
      "not_a_player",
    );
    expect(db.all("feedback")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Background cleanup — abandon games untouched for 48 hours
// ---------------------------------------------------------------------------

describe("cleanupAbandoned", () => {
  test("abandons waiting and in-progress games older than 48h, leaves fresh ones", async () => {
    const db = new FakeDb();
    const staleWaiting = await newGame(db, "tic_tac_toe");
    const stalePlaying = await twoPlayerGame(db, "rock_paper_scissors");
    const fresh = await twoPlayerGame(db, "tic_tac_toe");

    const cutoff = Date.now() - EXPIRY_MS - 1000;
    await db.patch(staleWaiting.game._id, { updatedAt: cutoff });
    await db.patch(stalePlaying.game._id, { updatedAt: cutoff });

    const res = (await run(cleanupAbandoned, db)) as { abandoned: number };
    expect(res.abandoned).toBe(2);
    expect(gameBySlug(db, staleWaiting.slug).status).toBe("abandoned");
    expect(gameBySlug(db, stalePlaying.slug).status).toBe("abandoned");
    expect(gameBySlug(db, fresh.slug).status).toBe("in_progress");
  });

  test("completed games are never touched", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db);
    await finishTicTacToe(db, slug);
    await db.patch(gameBySlug(db, slug)._id, {
      updatedAt: Date.now() - EXPIRY_MS - 1000,
    });
    const res = (await run(cleanupAbandoned, db)) as { abandoned: number };
    expect(res.abandoned).toBe(0);
    expect(gameBySlug(db, slug).status).toBe("completed");
  });
});

// ---------------------------------------------------------------------------
// GET /og/:slug — public metadata for social link previews (server-side OG
// baking in main.ts fetches this when a crawler hits /play/:slug)
// ---------------------------------------------------------------------------

describe("getOgMetadata", () => {
  test("exposes only public metadata for a live game", async () => {
    const db = new FakeDb();
    const { slug, game } = await newGame(db);
    const meta = (await run(getOgMetadata, db, { slug })) as {
      gameType: string;
      status: string;
      updatedAt: number;
    };
    expect(meta.gameType).toBe("tic_tac_toe");
    expect(meta.status).toBe("waiting");
    expect(meta.updatedAt).toBe(game.updatedAt);
    // No player data, no state — just enough for a crawler to build a card.
    expect(Object.keys(meta).sort()).toEqual(["gameType", "status", "updatedAt"]);
  });

  test("returns null for an unknown slug", async () => {
    const db = new FakeDb();
    await expect(run(getOgMetadata, db, { slug: "nope" })).resolves.toBeNull();
  });

  test("reflects the current status", async () => {
    const db = new FakeDb();
    const { slug } = await twoPlayerGame(db);
    const meta = (await run(getOgMetadata, db, { slug })) as { status: string };
    expect(meta.status).toBe("in_progress");
  });
});
