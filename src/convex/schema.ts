import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// ---------------------------------------------------------------------------
// Recess game data model
// ---------------------------------------------------------------------------

export const GAME_STATUS = {
  WAITING: "waiting",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
} as const;
export const gameStatusValidator = v.union(
  v.literal(GAME_STATUS.WAITING),
  v.literal(GAME_STATUS.IN_PROGRESS),
  v.literal(GAME_STATUS.COMPLETED),
  v.literal(GAME_STATUS.ABANDONED),
);
export type GameStatus = Infer<typeof gameStatusValidator>;

export const PLAYER_ROLE = {
  INITIATOR: "initiator",
  RESPONDER: "responder",
} as const;
export const playerRoleValidator = v.union(
  v.literal(PLAYER_ROLE.INITIATOR),
  v.literal(PLAYER_ROLE.RESPONDER),
);
export type PlayerRole = Infer<typeof playerRoleValidator>;

const markerValidator = v.union(v.literal("X"), v.literal("O"));
const cellValidator = v.union(v.literal(""), v.literal("X"), v.literal("O"));

// Tic Tac Toe state — a 3x3 board stored as a 9-element array in state JSON.
// The state shape lives in `games.state` so future game types can bring their
// own state shape alongside (see `gameType`).
// The validator's only runtime role is to derive the type below; game state
// itself is stored as v.any() so future game types bring their own shapes.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ticTacToeState = v.object({
  board: v.array(cellValidator),
  turn: markerValidator,
  winner: v.union(markerValidator, v.null()),
  draw: v.boolean(),
  winningLine: v.union(v.array(v.number()), v.null()),
  // When a player starts a rematch, the finished game points at the new one.
  rematch: v.optional(
    v.object({
      slug: v.string(),
      by: v.string(), // deviceToken of the player who started the rematch
    }),
  ),
});
export type TicTacToeState = Infer<typeof ticTacToeState>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // A game. `slug` is the UUID used in the shareable link (e.g. /play/:slug).
    games: defineTable({
      slug: v.string(),
      gameType: v.string(),
      state: v.any(),
      status: gameStatusValidator,
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_status", ["status"]),

    // One row per device that joined a game. `deviceToken` is a random string
    // generated client-side and stored in localStorage — the server never
    // trusts it alone for moves, it verifies it against this table.
    players: defineTable({
      gameId: v.id("games"),
      deviceToken: v.string(),
      role: playerRoleValidator,
      marker: markerValidator,
      joinedAt: v.number(),
    })
      .index("by_game", ["gameId"])
      .index("by_game_device", ["gameId", "deviceToken"]),

    // Every accepted move, for audit/replay.
    moves: defineTable({
      gameId: v.id("games"),
      playerId: v.id("players"),
      payload: v.any(),
      createdAt: v.number(),
    }).index("by_game", ["gameId"]),

    // Post-game feedback. Only `wouldPlayAgain` is collected in the UI for
    // this build; `feltNatural` is kept in the schema for future games.
    feedback: defineTable({
      gameId: v.id("games"),
      feltNatural: v.optional(v.boolean()),
      wouldPlayAgain: v.optional(v.boolean()),
      createdAt: v.number(),
    }).index("by_game", ["gameId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
