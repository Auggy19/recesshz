/**
 * Truth or Dare — async multiplayer + solo deck.
 * Curated prompts; no NSFW, no harm. Server picks index deterministically from seed.
 */

export const TRUTH_OR_DARE_GAME_TYPE = "truth_or_dare" as const;

export type TodKind = "truth" | "dare";
export type TodPhase = "pick" | "respond" | "match_over";
export type Marker = "X" | "O";

export type TodPrompt = { kind: TodKind; text: string };

export type TodState = {
  phase: TodPhase;
  /** Whose turn it is to choose Truth or Dare for the opponent */
  turn: Marker;
  /** Who must answer the current prompt */
  subject: Marker | null;
  current: TodPrompt | null;
  /** Prompt index into the deck (for fairness / no immediate repeats) */
  used: number[];
  scores: { X: number; O: number };
  target: number;
  matchWinner: Marker | null;
  lastResult: "done" | "skip" | null;
  rematch?: { slug: string; by: string };
};

export const TOD_TARGET = 5;

/** Short, social, usable on mobile — party energy without cruelty. */
export const TRUTHS: string[] = [
  "What's a small win you haven't told anyone about this week?",
  "Which song do you play when you need to feel like yourself again?",
  "What's the kindest thing a stranger ever did for you?",
  "Name a food you'd travel across town for.",
  "What's a habit you're quietly proud of?",
  "Who in your contacts always makes you laugh on a bad day?",
  "What's something you believed as a kid that still makes you smile?",
  "If your week had a title, what would it be?",
  "What's a place nearby that feels like a reset button?",
  "What's one skill you want to be slightly better at by next month?",
  "What's the last thing that made you genuinely proud of a friend?",
  "What do you order when you want comfort, not adventure?",
  "What's a compliment you still remember years later?",
  "If you could redo one ordinary Tuesday, which one and why?",
  "What's a show or film you recommend without overthinking it?",
];

export const DARES: string[] = [
  "Send the other player a voice note of you humming any tune for five seconds.",
  "Type your next message using only words that start with the letter S.",
  "Swap your display name energy: introduce yourself in the chat as a superhero for one line.",
  "Take a photo of something yellow near you and describe it in five words.",
  "Do ten slow shoulder rolls and confirm when you're done.",
  "Write a two-line poem about the weather right now.",
  "Name three things you can see that are not on a screen.",
  "Send a compliment to the other player that isn't about looks.",
  "Count backward from 15 in the chat, one number per message (or one line).",
  "Share a emoji-only summary of your day so far.",
  "Pick an object within reach and sell it to the other player in one sentence.",
  "Stand up, stretch toward the ceiling, and come back — then say you're limber.",
  "Type the alphabet backward as far as you can in thirty seconds.",
  "Recommend a snack like you're a radio ad.",
  "Clap three times (or tap your desk) and report the rhythm: slow or fast.",
];

export function freshTruthOrDareState(): TodState {
  return {
    phase: "pick",
    turn: "X",
    subject: null,
    current: null,
    used: [],
    scores: { X: 0, O: 0 },
    target: TOD_TARGET,
    matchWinner: null,
    lastResult: null,
  };
}

function other(m: Marker): Marker {
  return m === "X" ? "O" : "X";
}

function deckFor(kind: TodKind): string[] {
  return kind === "truth" ? TRUTHS : DARES;
}

/** Deterministic pick avoiding used indices when possible. */
export function pickPrompt(
  kind: TodKind,
  used: number[],
  salt: number,
): { prompt: TodPrompt; index: number } {
  const deck = deckFor(kind);
  const offset = Math.abs(salt) % deck.length;
  for (let i = 0; i < deck.length; i++) {
    const index = (offset + i) % deck.length;
    const key = kind === "truth" ? index : 1000 + index;
    if (!used.includes(key)) {
      return { prompt: { kind, text: deck[index] }, index: key };
    }
  }
  const index = offset;
  const key = kind === "truth" ? index : 1000 + index;
  return { prompt: { kind, text: deck[index] }, index: key };
}

export type TodMove =
  | { action: "choose"; kind: TodKind }
  | { action: "done" }
  | { action: "skip" };

export function applyTruthOrDareMove(
  current: TodState,
  marker: Marker,
  move: TodMove,
  salt = Date.now(),
): { state: TodState; over: boolean } {
  if (current.phase === "match_over") {
    return { state: current, over: true };
  }

  if (move.action === "choose") {
    if (current.phase !== "pick" || current.turn !== marker) {
      return { state: current, over: false };
    }
    const subject = other(marker);
    const { prompt, index } = pickPrompt(move.kind, current.used, salt);
    return {
      state: {
        ...current,
        phase: "respond",
        subject,
        current: prompt,
        used: [...current.used, index],
        lastResult: null,
      },
      over: false,
    };
  }

  if (current.phase !== "respond" || current.subject !== marker) {
    return { state: current, over: false };
  }

  const chooser = other(marker);
  let scores = current.scores;
  if (move.action === "done") {
    scores = {
      ...scores,
      [marker]: scores[marker] + 1,
    };
  }

  const hitTarget =
    scores.X >= current.target || scores.O >= current.target;
  const matchWinner: Marker | null = hitTarget
    ? scores.X >= current.target && scores.O >= current.target
      ? scores.X >= scores.O
        ? "X"
        : "O"
      : scores.X >= current.target
        ? "X"
        : "O"
    : null;

  return {
    state: {
      ...current,
      phase: matchWinner ? "match_over" : "pick",
      turn: chooser,
      subject: null,
      current: null,
      scores,
      matchWinner,
      lastResult: move.action === "done" ? "done" : "skip",
    },
    over: matchWinner !== null,
  };
}

/** Solo / pass-the-phone: next random prompt without scores. */
export function nextSoloPrompt(
  kind: TodKind,
  used: number[],
): { prompt: TodPrompt; used: number[] } {
  const { prompt, index } = pickPrompt(kind, used, Date.now());
  return { prompt, used: [...used, index] };
}
