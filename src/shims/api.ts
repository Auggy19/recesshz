import * as games from "@/lib/games-api";

/** Drop-in replacement for Convex generated `api` object. */
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
