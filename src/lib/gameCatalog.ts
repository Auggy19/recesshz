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
  freshTicTacToeState,
  freshRpsState,
  freshRedBlackState,
  freshPongState,
  freshTwentyQuestionsState,
  freshHangmanState,
  freshWordScrambleState,
} from "@/lib/gameLogic";

export type SupportedGameType =
  | typeof GAME_TYPE
  | typeof RPS_GAME_TYPE
  | typeof RED_BLACK_GAME_TYPE
  | typeof PONG_GAME_TYPE
  | typeof TWENTY_QUESTIONS_GAME_TYPE
  | typeof HANGMAN_GAME_TYPE
  | typeof WORD_SCRAMBLE_GAME_TYPE;

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
  | "spark";

export type GameCatalogEntry = {
  type: SupportedGameType;
  /** URL-friendly slug for ?game= and share links */
  slug: string;
  name: string;
  /** Short chip label (room picker) */
  shortName: string;
  blurb: string;
  icon: GameIconId;
  accent: GameAccent;
  /** Live WebRTC optional path */
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
      "Classic paddle tennis, by message. Serve an angle, read the return, and chase the rally — first to 7 points takes it. Optional live aim when both are online.",
    icon: "paddle",
    accent: "emerald",
    supportsLive: true,
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

/** Map friendly URL / room query values → server game type. */
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
    default:
      return null;
  }
}

export function isSupportedGameType(type: string): type is SupportedGameType {
  return GAME_CATALOG.some((g) => g.type === type);
}

/** Client-side fresh state mirror (Edge remains authoritative). */
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

/** Tailwind-friendly accent classes for cohesive chips / tiles. */
export const ACCENT_CLASSES: Record<
  GameAccent,
  { tile: string; text: string; ring: string; soft: string }
> = {
  amber: {
    tile: "from-amber-400 to-amber-600",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/30",
    soft: "bg-amber-500/10",
  },
  sky: {
    tile: "from-sky-400 to-sky-600",
    text: "text-sky-600 dark:text-sky-400",
    ring: "ring-sky-500/30",
    soft: "bg-sky-500/10",
  },
  rose: {
    tile: "from-rose-400 to-rose-600",
    text: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/30",
    soft: "bg-rose-500/10",
  },
  emerald: {
    tile: "from-emerald-400 to-emerald-600",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/30",
    soft: "bg-emerald-500/10",
  },
  violet: {
    tile: "from-violet-400 to-violet-600",
    text: "text-violet-600 dark:text-violet-400",
    ring: "ring-violet-500/30",
    soft: "bg-violet-500/10",
  },
  slate: {
    tile: "from-slate-400 to-slate-600",
    text: "text-slate-600 dark:text-slate-300",
    ring: "ring-slate-500/30",
    soft: "bg-slate-500/10",
  },
  orange: {
    tile: "from-orange-400 to-orange-600",
    text: "text-orange-600 dark:text-orange-400",
    ring: "ring-orange-500/30",
    soft: "bg-orange-500/10",
  },
};
