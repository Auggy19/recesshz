/**
 * Public games API.
 * Mutations go through the Supabase Edge Function `games` (authoritative).
 * Realtime subscriptions stay on the client.
 */
export {
  createGame,
  joinGame,
  getGameState,
  submitMove,
  playAgain,
  submitFeedback,
  subscribeGame,
} from "@/lib/games-edge";
export type { SubmitMoveArgs } from "@/lib/games-edge";
