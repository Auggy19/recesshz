/* eslint-disable */
/**
 * Drop-in replacement for Convex generated `api`.
 * Points at the Supabase-backed games module so client imports keep working.
 * @module
 */

import * as games from "../../lib/games-api.ts";

export const api = {
  games: {
    createGame: games.createGame,
    joinGame: games.joinGame,
    getGameState: games.getGameState,
    submitMove: games.submitMove,
    playAgain: games.playAgain,
    submitFeedback: games.submitFeedback,
  },
};

/** Legacy internal namespace — unused after migration. */
export const internal = {};
