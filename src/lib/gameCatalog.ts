/**
 * Lightweight multiplayer game catalog for Recess.
 * Pure metadata + helpers — pairs with src/lib/gameLogic.ts rules.
 * UI imports this for labels, blurbs, accents, and availability.
 */
import {
  GAME_TYPE,
  RPS_GAME_TYPE,
  RED_BLACK_GAME_TYPE,
  PONG_GAME_TYPE,
  TWENTY_QUESTIONS_GAME_TYPE,
  HANGMAN_GAME_TYPE,
  WORD_SCRAMBLE_GAME_TYPE,
  COUNTERS_BALL_GAME_TYPE,
  freshTicTacToeState,
  freshRpsState,
  freshRedBlackState,
  freshPongState,
  freshTwentyQuestionsState,
  freshHangmanState,
  freshWordScrambleState,
  freshCountersBallState,
} from "@/lib/gameLogic";

export type SupportedGameType =
  | typeof GAME_TYPE
  | typeof RPS_GAME_TYPE
  | typeof RED_BLACK_GAME_TYPE
  | typeof PONG_GAME_TYPE
  | typeof TWENTY_QUESTIONS_GAME_TYPE
  | typeof HANGMAN_GAME_TYPE
  | typeof WORD_SCRAMBLE_GAME_TYPE
  | typeof COUNTERS_BALL_GAME_TYPE;

/** Visual token for cards, chips, and icons. */
export type GameAccent =
  | "amber"
  | "sky"
  | "rose"
  | "emerald"
  | "violet"
  | "slate"
  | "orange";

export type GameIconId =
  | "grid"
  | "hand"
  | "cards"
  | "paddle"
  | "help"
  | "gallows"
  | "scramble"
  | "ball"
  | "spark";

export type GameCatalogEntry = {
  type: SupportedGameType;
  slug: string;
  name: string;
  shortName: string;
  blurb: string;
  icon: GameIconId;
  accent: GameAccent;
  supportsLive: boolean;
  available: boolean;
};

export const GAME_CATALOG: readonly GameCatalogEntry[] = [
  {
    type: GAME_TYPE,
    slug: "tic-tac-toe",
    name: "Tic Tac Toe",
    shortName: "Tic Tac Toe",
    blurb:
      "Three in a row. Pass the link, make a move, and come back when it's your turn — your board waits for you.",
    icon: "grid",
    accent: "amber",
    supportsLive: false,
    available: true,
  },
  {
    type: RPS_GAME_TYPE,
    slug: "rock-paper-scissors",
    name: "Rock Paper Scissors",
    shortName: "RPS",
    blurb:
      "Best of three. Both of you pick in secret, and the picks only reveal once they're both in — no peeking, no arguing.",
    icon: "hand",
    accent: "sky",
    supportsLive: false,
    available: true,
  },
  {
    type: RED_BLACK_GAME_TYPE,
    slug: "red-or-black",
    name: "Red or Black",
    shortName: "Red/Black",
    blurb:
      "Your friend picks a color, the server deals the card, and the reveal lands in an instant. Best of three — guess right to take a round.",
    icon: "cards",
    accent: "rose",
    supportsLive: false,
    available: true,
  },
  {
    type: PONG_GAME_TYPE,
    slug: "pong",
    name: "Pong",
    shortName: "Pong",
    blurb:
      "Classic vertical Pong vs AI — drag your paddle, bounce the ball, first to 7. Fully offline in the browser. Link-based play with a friend still available.",
    icon: "paddle",
    accent: "emerald",
    supportsLive: true,
    available: true,
  },
  {
    type: COUNTERS_BALL_GAME_TYPE,
    slug: "counters-ball",
    name: "Counters Ball FC",
    shortName: "Counters Ball",
    blurb:
      "Bottle-cap table football. Pull back, flick one cap per turn, first to 3. Share the link — your friend flicks when they're free.",
    icon: "ball",
    accent: "emerald",
    supportsLive: false,
    available: true,
  },
  {
    type: TWENTY_QUESTIONS_GAME_TYPE,
    slug: "twenty-questions",
    name: "Twenty Questions",
    shortName: "20 Qs",
    blurb:
      "One of you thinks of something; the other asks yes-or-no questions. Twenty tries to name it — secrets stay server-side until the end.",
    icon: "help",
    accent: "violet",
    supportsLive: false,
    available: true,
  },
  {
    type: HANGMAN_GAME_TYPE,
    slug: "hangman",
    name: "Hangman",
    shortName: "Hangman",
    blurb:
      "One of you sets a word, the other guesses letters until the figure hangs — or the word is found. Six wrong guesses.",
    icon: "gallows",
    accent: "slate",
    supportsLive: false,
    available: true,
  },
  {
    type: WORD_SCRAMBLE_GAME_TYPE,
    slug: "word-scramble",
    name: "Word Scramble",
    shortName: "Scramble",
    blurb:
      "One of you picks a word, the server scrambles it, and the other has three attempts to unscramble it. No peeking, ever.",
    icon: "scramble",
    accent: "orange",
    supportsLive: false,
    available: true,
  },
] as const;

export const AVAILABLE_GAMES = GAME_CATALOG.filter((g) => g.available);

export function getGameEntry(
  type: string | null | undefined,
): GameCatalogEntry | undefined {
  if (!type) return undefined;
  return GAME_CATALOG.find((g) => g.type === type || g.slug === type);
}

export function urlGameToType(raw: string | null): SupportedGameType | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  const bySlug = GAME_CATALOG.find(
    (g) => g.slug === key || g.type === key || g.shortName.toLowerCase() === key,
  );
  if (bySlug) return bySlug.type;

  switch (key) {
    case "ttt":
      return GAME_TYPE;
    case "rps":
      return RPS_GAME_TYPE;
    case "redblack":
    case "rnb":
      return RED_BLACK_GAME_TYPE;
    case "ping-pong":
    case "ping_pong":
      return PONG_GAME_TYPE;
    case "20-questions":
    case "tq":
      return TWENTY_QUESTIONS_GAME_TYPE;
    case "scramble":
      return WORD_SCRAMBLE_GAME_TYPE;
    case "football":
    case "counters":
    case "countersball":
      return COUNTERS_BALL_GAME_TYPE;
    default:
      return null;
  }
}

export function isSupportedGameType(type: string): type is SupportedGameType {
  return GAME_CATALOG.some((g) => g.type === type);
}

export function freshStateFor(gameType: string): unknown {
  switch (gameType) {
    case GAME_TYPE:
      return freshTicTacToeState();
    case RPS_GAME_TYPE:
      return freshRpsState();
    case RED_BLACK_GAME_TYPE:
      return freshRedBlackState();
    case PONG_GAME_TYPE:
      return freshPongState();
    case COUNTERS_BALL_GAME_TYPE:
      return freshCountersBallState(3);
    case TWENTY_QUESTIONS_GAME_TYPE:
      return freshTwentyQuestionsState();
    case HANGMAN_GAME_TYPE:
      return freshHangmanState();
    case WORD_SCRAMBLE_GAME_TYPE:
      return freshWordScrambleState();
    default:
      return null;
  }
}

/** High-contrast gradient tiles for professional icon visibility. */
export const ACCENT_CLASSES: Record<
  GameAccent,
  { tile: string; text: string; ring: string; soft: string }
> = {
  amber: {
    tile: "from-[#FBBF24] via-[#F5A623] to-[#B45309]",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-600/40",
    soft: "bg-amber-500/15",
  },
  sky: {
    tile: "from-[#38BDF8] via-[#0EA5E9] to-[#0369A1]",
    text: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-600/40",
    soft: "bg-sky-500/15",
  },
  rose: {
    tile: "from-[#FB7185] via-[#F43F5E] to-[#9F1239]",
    text: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-600/40",
    soft: "bg-rose-500/15",
  },
  emerald: {
    tile: "from-[#34D399] via-[#10B981] to-[#065F46]",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-600/40",
    soft: "bg-emerald-500/15",
  },
  violet: {
    tile: "from-[#A78BFA] via-[#8B5CF6] to-[#5B21B6]",
    text: "text-violet-700 dark:text-violet-300",
    ring: "ring-violet-600/40",
    soft: "bg-violet-500/15",
  },
  slate: {
    tile: "from-[#94A3B8] via-[#64748B] to-[#1E293B]",
    text: "text-slate-700 dark:text-slate-200",
    ring: "ring-slate-600/40",
    soft: "bg-slate-500/15",
  },
  orange: {
    tile: "from-[#FB923C] via-[#F97316] to-[#9A3412]",
    text: "text-orange-700 dark:text-orange-300",
    ring: "ring-orange-600/40",
    soft: "bg-orange-500/15",
  },
};
