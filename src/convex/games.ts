// ---------------------------------------------------------------------------
// Recess backend.
//
// This file maps the Recess API spec onto Convex functions:
//   POST /api/games                -> createGame (mutation)
//   GET  /api/games/:id            -> joinGame (mutation) + getGameState (query)
//   POST /api/games/:id/moves      -> submitMove (mutation)
//   GET  /api/games/:id/state      -> getGameState (query, reactive)
//   POST /api/games/:id/feedback   -> submitFeedback (mutation)
//
// Security rules (enforced server-side, never trusting the client):
//   - A device token is only trusted after it is matched to a `players` row
//     on the game. Moves are keyed by deviceToken, never by a client-supplied
//     player id.
//   - A NEW device token (not already registered) is rejected from any game
//     that is already in_progress (or completed) — only the original two
//     players can access a game.
//   - Every move is validated: correct turn, empty cell, valid status.
// ---------------------------------------------------------------------------

import { ConvexError, v } from "convex/values";
import {
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type {
  GameStatus,
  PlayerRole,
  TicTacToeState,
} from "./schema";
import {
  GAME_TYPE,
  PONG_GAME_TYPE,
  PONG_POWERS,
  PONG_RETURN_ANGLE,
  PONG_SERVE_ANGLE,
  RPS_GAME_TYPE,
  RED_BLACK_GAME_TYPE,
  RPS_CHOICES,
  RED_BLACK_CHOICES,
  applyPongReturn,
  applyPongServe,
  applyRedBlackGuess,
  applyRpsPick,
  applyTicTacToeMove,
  coinFlip,
  freshPongState,
  freshRedBlackState,
  freshRpsState,
  freshTicTacToeState,
  type Marker,
  type PongPower,
  type PongState,
  type RedBlackChoice,
  type RedBlackState,
  type RpsChoice,
  type RpsState,
} from "./gameLogic";
import type { Doc, Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Any game waiting/in-progress untouched for 48 hours is auto-abandoned. */
export const EXPIRY_MS = 48 * 60 * 60 * 1000;

type ErrorCode =
  | "not_found"
  | "expired"
  | "locked"
  | "not_a_player"
  | "invalid_move"
  | "not_ready"
  | "unsupported_game"
  | "invalid_room";

function fail(code: ErrorCode, message: string): never {
  throw new ConvexError({ code, message });
}

const SUPPORTED_GAME_TYPES = new Set<string>([
  GAME_TYPE,
  RPS_GAME_TYPE,
  RED_BLACK_GAME_TYPE,
  PONG_GAME_TYPE,
]);

function freshStateFor(gameType: string): unknown {
  switch (gameType) {
    case GAME_TYPE:
      return freshTicTacToeState();
    case RPS_GAME_TYPE:
      return freshRpsState();
    case RED_BLACK_GAME_TYPE:
      return freshRedBlackState();
    case PONG_GAME_TYPE:
      return freshPongState();
    default:
      return fail(
        "unsupported_game",
        `Unknown game type "${gameType}".`,
      );
  }
}

/** Never reveal a player's pick until both picks are in. */
function maskRpsState(state: RpsState): RpsState {
  return state.phase === "picking"
    ? { ...state, picks: { X: null, O: null } }
    : state;
}

function isStale(updatedAt: number): boolean {
  return Date.now() - updatedAt > EXPIRY_MS;
}

async function getGameBySlug(ctx: QueryCtx | MutationCtx, slug: string) {
  return (await ctx.db
    .query("games")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique()) as Doc<"games"> | null;
}

async function getPlayer(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<"games">,
  deviceToken: string,
) {
  return (await ctx.db
    .query("players")
    .withIndex("by_game_device", (q) =>
      q.eq("gameId", gameId).eq("deviceToken", deviceToken),
    )
    .unique()) as Doc<"players"> | null;
}

/** Lazily expire stale games on any mutation that touches them. */
async function expireIfStale(
  ctx: MutationCtx,
  game: Doc<"games">,
): Promise<boolean> {
  if (
    (game.status === "waiting" || game.status === "in_progress") &&
    isStale(game.updatedAt)
  ) {
    await ctx.db.patch(game._id, {
      status: "abandoned" as GameStatus,
      updatedAt: Date.now(),
    });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// POST /api/games — create a game, returns the id used in the share link.
//
// An optional `slug` supports instant room creation from URL params
// (?room=XYZ&game=...): if the room already exists and is still alive we
// return it unchanged (create-or-join — both players can open the same room
// link), and if it exists but is completed/abandoned we mint a fresh slug so
// the old one never gets a second game beneath it.
// ---------------------------------------------------------------------------

/** Room tokens from URL params — short, URL-safe, no collisions with UUIDs. */
const ROOM_TOKEN_RE = /^[A-Za-z0-9_-]{3,64}$/;

export const createGame = mutation({
  args: {
    gameType: v.string(),
    deviceToken: v.string(),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, { gameType, deviceToken, slug: requestedSlug }) => {
    if (!SUPPORTED_GAME_TYPES.has(gameType)) {
      fail(
        "unsupported_game",
        `"${gameType}" isn't available yet — only Tic Tac Toe, Rock Paper Scissors, Red or Black, and Pong are supported in this build.`,
      );
    }
    if (!deviceToken || deviceToken.length < 8) {
      fail(
        "not_a_player",
        "Missing device token — please refresh and try again.",
      );
    }

    let slug: string;
    if (requestedSlug) {
      if (!ROOM_TOKEN_RE.test(requestedSlug)) {
        fail(
          "invalid_room",
          "That room name isn't valid — use 3-64 letters, numbers, dashes or underscores.",
        );
      }
      const existing = await getGameBySlug(ctx, requestedSlug);
      if (existing) {
        if (
          (existing.status === "waiting" || existing.status === "in_progress") &&
          existing.gameType === gameType
        ) {
          // Room already alive and the same game — both players share this
          // same link.
          return { slug: existing.slug };
        }
        // Dead room, or an alive room for a different game: mint a fresh slug
        // instead of reusing it — the link preview must match the game the
        // player actually lands in, never a silent hand-off to another game.
        slug = crypto.randomUUID();
      } else {
        slug = requestedSlug;
      }
    } else {
      slug = crypto.randomUUID();
    }

    const now = Date.now();
    const gameId = await ctx.db.insert("games", {
      slug,
      gameType,
      state: freshStateFor(gameType),
      status: "waiting" as GameStatus,
      createdAt: now,
      updatedAt: now,
    });
    // First player to join is X.
    await ctx.db.insert("players", {
      gameId,
      deviceToken,
      role: "initiator",
      marker: "X",
      joinedAt: now,
    });

    return { slug };
  },
});

// ---------------------------------------------------------------------------
// GET /api/games/:id — join (or re-fetch) a game
// ---------------------------------------------------------------------------

export const joinGame = mutation({
  args: {
    slug: v.string(),
    deviceToken: v.string(),
  },
  handler: async (
    ctx,
    { slug, deviceToken },
  ): Promise<{ joined: boolean; me: { role: PlayerRole; marker: Marker } }> => {
    const game = await getGameBySlug(ctx, slug);
    if (!game) fail("not_found", "This game doesn't exist (or the link is wrong).");

    if (await expireIfStale(ctx, game)) {
      fail(
        "expired",
        "This game sat untouched for 48 hours, so it was closed.",
      );
    }

    const me = await getPlayer(ctx, game._id, deviceToken);
    if (me) {
      // Already a player — idempotent re-join (safe on retries). Re-opening
      // the link is an explicit action, so it refreshes the 48-hour
      // "untouched" clock: a player who keeps checking on the game shouldn't
      // have it abandoned underneath them. (The reactive getGameState poll is
      // a read and deliberately doesn't touch the clock.)
      await ctx.db.patch(game._id, { updatedAt: Date.now() });
      return { joined: true, me: { role: me.role, marker: me.marker } };
    }

    // Hard requirement: a NEW device may only join while the game is waiting.
    if (game.status !== "waiting") {
      fail(
        "locked",
        "This game is already in progress — only the original two players can play it.",
      );
    }

    // Second player to join is O.
    const joinedAt = Date.now();
    await ctx.db.insert("players", {
      gameId: game._id,
      deviceToken,
      role: "responder",
      marker: "O",
      joinedAt,
    });
    await ctx.db.patch(game._id, {
      status: "in_progress" as GameStatus,
      updatedAt: joinedAt,
    });

    return { joined: true, me: { role: "responder", marker: "O" } };
  },
});

// ---------------------------------------------------------------------------
// GET /api/games/:id/state — poll for the opponent's move (reactive query)
// ---------------------------------------------------------------------------

export const getGameState = query({
  args: {
    slug: v.string(),
    deviceToken: v.string(),
  },
  handler: async (ctx, { slug, deviceToken }) => {
    const game = await getGameBySlug(ctx, slug);
    if (!game) fail("not_found", "This game doesn't exist (or the link is wrong).");

    const me = await getPlayer(ctx, game._id, deviceToken);

    // Hard requirement enforced on reads too: once a game is in progress (or
    // finished), a device that isn't one of the original two players gets
    // nothing.
    if (!me && (game.status === "in_progress" || game.status === "completed")) {
      fail(
        "locked",
        "This game is already in progress — only the original two players can access it.",
      );
    }

    const rpsState =
      game.gameType === RPS_GAME_TYPE ? (game.state as RpsState) : null;

    return {
      status: game.status,
      gameType: game.gameType,
      // RPS picks are masked until both players have submitted this round.
      state: rpsState ? maskRpsState(rpsState) : game.state,
      me: me
        ? {
            role: me.role,
            marker: me.marker,
            // Lets the UI know "you picked" without revealing the pick.
            picked: rpsState ? rpsState.picks[me.marker] !== null : undefined,
          }
        : null,
    };
  },
});

// ---------------------------------------------------------------------------
// POST /api/games/:id/moves — submit a move
// ---------------------------------------------------------------------------

export const submitMove = mutation({
  args: {
    slug: v.string(),
    deviceToken: v.string(),
    cell: v.optional(v.number()),
    pick: v.optional(
      v.union(
        v.literal("rock"),
        v.literal("paper"),
        v.literal("scissors"),
        v.literal("red"),
        v.literal("black"),
      ),
    ),
    // Pong shots: angle in degrees, power 1-3. Which field set is legal
    // depends on the game type (validated in the per-game handlers).
    angle: v.optional(v.number()),
    power: v.optional(v.number()),
  },
  handler: async (ctx, { slug, deviceToken, cell, pick, angle, power }) => {
    const game = await getGameBySlug(ctx, slug);
    if (!game) fail("not_found", "This game doesn't exist (or the link is wrong).");

    if (await expireIfStale(ctx, game)) {
      fail(
        "expired",
        "This game sat untouched for 48 hours, so it was closed.",
      );
    }

    // The server resolves the player from the device token — never trust a
    // client-supplied player id.
    const player = await getPlayer(ctx, game._id, deviceToken);
    if (!player) {
      fail(
        "not_a_player",
        "You're not registered on this game — open it from your own invite link.",
      );
    }

    if (game.status !== "in_progress") {
      fail("invalid_move", "This game isn't in progress right now.");
    }

    if (game.gameType === RPS_GAME_TYPE) {
      return await submitRpsPick(ctx, game, player, pick as RpsChoice | undefined);
    }
    if (game.gameType === RED_BLACK_GAME_TYPE) {
      return await submitRedBlackGuess(
        ctx,
        game,
        player,
        pick as RedBlackChoice | undefined,
      );
    }
    if (game.gameType === PONG_GAME_TYPE) {
      return await submitPongShot(ctx, game, player, angle, power);
    }

    // Tic Tac Toe — cell-based move.
    const state = game.state as TicTacToeState;
    if (typeof cell !== "number" || !Number.isInteger(cell) || cell < 0 || cell > 8) {
      fail("invalid_move", "That move is off the board.");
    }
    if (state.winner || state.draw) {
      fail("invalid_move", "This game is already over.");
    }
    if (state.board[cell] !== "") {
      fail("invalid_move", "That cell is already taken.");
    }
    if (state.turn !== player.marker) {
      fail("invalid_move", "It's not your turn yet — silence is safe here.");
    }

    const outcome = applyTicTacToeMove(state, cell, player.marker);
    const now = Date.now();

    await ctx.db.insert("moves", {
      gameId: game._id,
      playerId: player._id,
      payload: { cell, marker: player.marker },
      createdAt: now,
    });
    await ctx.db.patch(game._id, {
      state: outcome.state,
      status: outcome.over
        ? ("completed" as GameStatus)
        : ("in_progress" as GameStatus),
      updatedAt: now,
    });

    return { ok: true, state: outcome.state };
  },
});

/**
 * RPS move: record one player's pick. The round only resolves once both picks
 * exist — until then no pick is ever revealed in the returned state.
 */
async function submitRpsPick(
  ctx: MutationCtx,
  game: Doc<"games">,
  player: Doc<"players">,
  pick: RpsChoice | undefined,
) {
  if (!pick || !RPS_CHOICES.includes(pick)) {
    fail("invalid_move", "Pick rock, paper, or scissors.");
  }

  const state = game.state as RpsState;
  if (state.matchWinner) {
    fail("invalid_move", "This match is already over.");
  }
  if (state.phase === "picking" && state.picks[player.marker] !== null) {
    fail(
      "invalid_move",
      "You already picked this round — wait for your friend.",
    );
  }

  const outcome = applyRpsPick(state, player.marker, pick);
  const now = Date.now();

  await ctx.db.insert("moves", {
    gameId: game._id,
    playerId: player._id,
    // Audit against the round the pick actually lands in: when a pick opens
    // a new round, applyRpsPick has already advanced it by now.
    payload: { pick, marker: player.marker, round: outcome.state.round },
    createdAt: now,
  });
  await ctx.db.patch(game._id, {
    state: outcome.state,
    status: outcome.over
      ? ("completed" as GameStatus)
      : ("in_progress" as GameStatus),
    updatedAt: now,
  });

  return { ok: true, state: maskRpsState(outcome.state) };
}

/**
 * Red or Black move: the responder (O) guesses a color. The server draws the
 * card outcome itself with a fair 50/50 and resolves the round instantly —
 * the client never supplies or sees the draw before the guess is locked in.
 * Only O (the guesser) may submit; X is the host and just watches.
 */
async function submitRedBlackGuess(
  ctx: MutationCtx,
  game: Doc<"games">,
  player: Doc<"players">,
  guess: RedBlackChoice | undefined,
) {
  if (!guess || !RED_BLACK_CHOICES.includes(guess)) {
    fail("invalid_move", "Pick red or black.");
  }
  // Hard rule: only the responder guesses — the initiator is the host and
  // never submits a move.
  if (player.marker !== "O") {
    fail(
      "invalid_move",
      "You're the host — your friend picks the color, you watch the reveal.",
    );
  }

  const state = game.state as RedBlackState;
  if (state.matchWinner) {
    fail("invalid_move", "This match is already over.");
  }
  if (state.phase === "picking" && state.guess !== null) {
    fail(
      "invalid_move",
      "You already guessed this round — the reveal is on its way.",
    );
  }

  // Server-side draw: cryptographically fair 50/50, never from the client.
  const outcome = applyRedBlackGuess(state, guess, coinFlip());
  const now = Date.now();

  await ctx.db.insert("moves", {
    gameId: game._id,
    playerId: player._id,
    // Audit against the round the guess actually lands in: a guess after a
    // resolved round advances to the next round inside applyRedBlackGuess.
    payload: { guess, marker: player.marker, round: outcome.state.round },
    createdAt: now,
  });
  await ctx.db.patch(game._id, {
    state: outcome.state,
    status: outcome.over
      ? ("completed" as GameStatus)
      : ("in_progress" as GameStatus),
    updatedAt: now,
  });

  return { ok: true, state: outcome.state };
}

/**
 * Pong move: one shot per turn. The phase decides the shot type — on
 * "serve"/"point_over" the turn player serves (angle ±60°); on "return" they
 * return (angle ±45°). The server resolves the player from the device token,
 * validates the turn and ranges, and never lets a shot through that wasn't
 * this player's to take.
 */
async function submitPongShot(
  ctx: MutationCtx,
  game: Doc<"games">,
  player: Doc<"players">,
  angle: number | undefined,
  power: number | undefined,
) {
  const state = game.state as PongState;
  if (state.matchWinner) {
    fail("invalid_move", "This match is already over.");
  }

  const isServe =
    state.phase === "serve" || state.phase === "point_over";
  if (!isServe && state.phase !== "return") {
    fail("invalid_move", "This match isn't mid-point right now.");
  }
  if (state.turn !== player.marker) {
    fail(
      "invalid_move",
      "It's not your turn yet — silence is safe here.",
    );
  }
  if (typeof power !== "number" || !PONG_POWERS.includes(power as PongPower)) {
    fail("invalid_move", "Pick a power: lob, drive, or smash.");
  }
  if (typeof angle !== "number" || !Number.isInteger(angle)) {
    fail("invalid_move", "That angle isn't valid.");
  }
  const maxAngle = isServe ? PONG_SERVE_ANGLE : PONG_RETURN_ANGLE;
  if (angle < -maxAngle || angle > maxAngle) {
    fail(
      "invalid_move",
      isServe
        ? "Serve angles run from -60° to +60°."
        : "Return angles run from -45° to +45°.",
    );
  }

  const outcome = isServe
    ? applyPongServe(state, player.marker, angle, power as PongPower)
    : applyPongReturn(state, player.marker, angle, power as PongPower);
  const now = Date.now();

  await ctx.db.insert("moves", {
    gameId: game._id,
    playerId: player._id,
    payload: {
      type: isServe ? "serve" : "return",
      angle,
      power,
      marker: player.marker,
    },
    createdAt: now,
  });
  await ctx.db.patch(game._id, {
    state: outcome.state,
    status: outcome.over
      ? ("completed" as GameStatus)
      : ("in_progress" as GameStatus),
    updatedAt: now,
  });

  return { ok: true, state: outcome.state };
}

// ---------------------------------------------------------------------------
// Play Again — a fresh game between the same two device tokens
// ---------------------------------------------------------------------------

export const playAgain = mutation({
  args: {
    slug: v.string(),
    deviceToken: v.string(),
  },
  handler: async (ctx, { slug, deviceToken }) => {
    const game = await getGameBySlug(ctx, slug);
    if (!game) fail("not_found", "This game doesn't exist (or the link is wrong).");

    const me = await getPlayer(ctx, game._id, deviceToken);
    if (!me) {
      fail(
        "not_a_player",
        "You're not registered on this game — open it from your own invite link.",
      );
    }

    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    if (players.length < 2) {
      fail(
        "not_ready",
        "Wait for your opponent to join before starting a rematch.",
      );
    }
    const opponent =
      players.find((p) => p.deviceToken !== deviceToken) ?? players[0];

    const now = Date.now();
    const newSlug = crypto.randomUUID();
    const newGameId = await ctx.db.insert("games", {
      slug: newSlug,
      gameType: game.gameType,
      state: freshStateFor(game.gameType),
      status: "in_progress" as GameStatus, // both players are already known
      createdAt: now,
      updatedAt: now,
    });

    // Same two device tokens, fresh roles: the rematch requester is X again.
    await ctx.db.insert("players", {
      gameId: newGameId,
      deviceToken,
      role: "initiator",
      marker: "X",
      joinedAt: now,
    });
    await ctx.db.insert("players", {
      gameId: newGameId,
      deviceToken: opponent.deviceToken,
      role: "responder",
      marker: "O",
      joinedAt: now,
    });

    // Point the finished game at the rematch so the opponent can follow along.
    await ctx.db.patch(game._id, {
      state: {
        ...(game.state as object),
        rematch: { slug: newSlug, by: deviceToken },
      },
      updatedAt: now,
    });

    return { slug: newSlug };
  },
});

// ---------------------------------------------------------------------------
// POST /api/games/:id/feedback — "Would you play again?" yes/no
// ---------------------------------------------------------------------------

export const submitFeedback = mutation({
  args: {
    slug: v.string(),
    deviceToken: v.string(),
    wouldPlayAgain: v.boolean(),
    feltNatural: v.optional(v.boolean()),
  },
  handler: async (ctx, { slug, deviceToken, wouldPlayAgain, feltNatural }) => {
    const game = await getGameBySlug(ctx, slug);
    if (!game) fail("not_found", "This game doesn't exist (or the link is wrong).");

    const me = await getPlayer(ctx, game._id, deviceToken);
    if (!me) {
      fail(
        "not_a_player",
        "You're not registered on this game — open it from your own invite link.",
      );
    }

    await ctx.db.insert("feedback", {
      gameId: game._id,
      feltNatural: feltNatural ?? undefined,
      wouldPlayAgain,
      createdAt: Date.now(),
    });

    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Public game metadata for social link previews (used by the /og/:slug HTTP
// route in http.ts). Read-only and intentionally tiny: slug + game type +
// status, enough for a crawler to build og:title / og:description. Knowing
// the slug already means you were invited, so nothing sensitive is exposed.
// ---------------------------------------------------------------------------

export const getOgMetadata = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const game = await getGameBySlug(ctx, slug);
    if (!game) return null;
    return {
      gameType: game.gameType,
      status: game.status,
      updatedAt: game.updatedAt,
    };
  },
});

// ---------------------------------------------------------------------------
// Background cleanup — abandon games untouched for 48 hours (runs hourly,
// see crons.ts). Lazy expiry also runs on every mutation above.
// ---------------------------------------------------------------------------

export const cleanupAbandoned = mutation({
  handler: async (ctx) => {
    const cutoff = Date.now() - EXPIRY_MS;
    let abandoned = 0;

    for (const status of ["waiting", "in_progress"] as const) {
      const stale = await ctx.db
        .query("games")
        .withIndex("by_status", (q) => q.eq("status", status))
        .filter((q) => q.lt(q.field("updatedAt"), cutoff))
        .collect();
      for (const game of stale) {
        await ctx.db.patch(game._id, {
          status: "abandoned" as GameStatus,
          updatedAt: Date.now(),
        });
        abandoned += 1;
      }
    }

    return { abandoned };
  },
});
