import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { WordScrambleArt } from "@/components/GameArt";

// ---------------------------------------------------------------------------
// Word Scramble play area. The initiator (X) secretly picks a single word;
// the server scrambles its letters (never the client) and the responder (O)
// has three attempts to unscramble it — a correct answer wins O, three misses
// win X. The original word is server-masked from O until the match ends.
// ---------------------------------------------------------------------------

type Marker = "X" | "O";
type GameStatus = "waiting" | "in_progress" | "completed" | "abandoned";

const ATTEMPTS = 3;

interface WordScrambleState {
  phase: "setup" | "solving" | "match_over";
  secret: string | null;
  scrambled: string;
  attemptsLeft: number;
  wrongGuesses: string[];
  winner: Marker | null;
  rematch?: { slug: string; by: string };
}

export type WordScrambleMove = { secret: string } | { guess: string };

interface Props {
  state: WordScrambleState;
  status: GameStatus;
  myMarker: Marker;
  onSubmit: (move: WordScrambleMove) => Promise<boolean>;
}

export default function WordScramblePlay({
  state,
  status,
  myMarker,
  onSubmit,
}: Props) {
  const [secretInput, setSecretInput] = useState("");
  const [guessInput, setGuessInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isWaiting = status === "waiting";
  const isOver = state.winner !== null;
  const isSetter = myMarker === "X";
  const canPlay = state.phase === "solving" && !isSetter && !isOver && !isWaiting;

  // Status line text
  let statusText: string;
  if (isWaiting) {
    statusText = "Waiting for your friend to join…";
  } else if (isOver) {
    statusText =
      state.winner === myMarker
        ? isSetter
          ? "You win!"
          : "You unscrambled it!"
        : isSetter
          ? "They got it"
          : "Out of tries";
  } else if (state.phase === "setup") {
    statusText = isSetter
      ? "Pick a word — your friend can't see it."
      : "Waiting for your friend to pick a word…";
  } else if (isSetter) {
    statusText = "Your friend is unscrambling…";
  } else {
    statusText = `${state.attemptsLeft} attempt${state.attemptsLeft === 1 ? "" : "s"} left — unscramble it.`;
  }

  const submit = async (move: WordScrambleMove) => {
    if (submitting) return;
    setSubmitting(true);
    const ok = await onSubmit(move);
    if (ok) {
      if ("secret" in move) setSecretInput("");
      if ("guess" in move) setGuessInput("");
    }
    setSubmitting(false);
  };

  const onSecretForm = (e: FormEvent) => {
    e.preventDefault();
    const s = secretInput.trim();
    if (!s) return;
    void submit({ secret: s });
  };

  const onGuessForm = (e: FormEvent) => {
    e.preventDefault();
    const g = guessInput.trim();
    if (!g) return;
    void submit({ guess: g });
  };

  return (
    <>
      {/* Status line */}
      <div className="flex items-center justify-center gap-2 text-center">
        <span
          className={cn(
            "size-2 rounded-full",
            canPlay || isWaiting || isOver ? "animate-pulse bg-primary" : "bg-muted-foreground/40",
          )}
        />
        <p className="text-sm font-semibold text-muted-foreground">{statusText}</p>
      </div>

      {/* The game card */}
      <div
        className={cn(
          "mx-auto mt-5 w-full max-w-xs rounded-3xl border-2 bg-card p-5 shadow-soft",
          isOver ? "border-primary/60" : "border-border",
          isWaiting && "opacity-60",
        )}
      >
        {isWaiting ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <WordScrambleArt className="w-20" />
            <p className="text-sm font-semibold text-muted-foreground">
              Waiting for your friend to join…
            </p>
          </div>
        ) : state.phase === "setup" && isSetter ? (
          // X picks the word
          <div>
            <p className="text-center text-sm font-bold">Pick a single word.</p>
            <p className="mt-1 text-center text-xs leading-relaxed text-muted-foreground">
              3 to 12 letters, with at least two different letters — your
              friend gets three attempts to unscramble it.
            </p>
            <form onSubmit={onSecretForm} className="mt-4 flex flex-col gap-2">
              <input
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                maxLength={12}
                placeholder="e.g. giraffe"
                aria-label="Your word"
                className="h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-chip outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="submit"
                disabled={submitting || secretInput.trim().length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-primary to-primary-deep px-5 text-sm font-bold text-white shadow-btn-amber transition-all hover:-translate-y-0.5 hover:brightness-105 disabled:pointer-events-none disabled:opacity-50"
              >
                Scramble it
              </button>
            </form>
          </div>
        ) : state.phase === "setup" ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <WordScrambleArt className="w-20 animate-pulse" />
            <p className="text-sm font-semibold text-muted-foreground">
              Your friend is picking a word…
            </p>
          </div>
        ) : isSetter ? (
          // X watches while O solves
          <div className="flex flex-col items-center gap-3 py-1 text-center">
            <p className="text-xs font-bold text-muted-foreground">Your word</p>
            <p className="max-w-full break-words rounded-2xl bg-background px-4 py-2 text-sm font-bold shadow-chip">
              “{state.secret}”
            </p>
            <p className="text-sm font-semibold text-muted-foreground">
              {state.attemptsLeft} attempt{state.attemptsLeft === 1 ? "" : "s"} left —
              sit tight.
            </p>
            {state.wrongGuesses.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Misses: {state.wrongGuesses.join(" · ")}
              </p>
            )}
          </div>
        ) : (
          // O solves
          <div>
            <p className="text-center text-xs font-bold text-muted-foreground">
              Unscramble the word
            </p>

            {/* The scrambled letters */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              {[...state.scrambled].map((ch, i) => (
                <span
                  key={i}
                  className={cn(
                    "flex h-11 w-9 items-center justify-center rounded-xl border-2 text-lg font-black",
                    "border-primary/40 bg-primary/10 text-primary shadow-chip",
                  )}
                >
                  {ch}
                </span>
              ))}
            </div>

            {/* Attempts remaining */}
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {Array.from({ length: ATTEMPTS }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "size-2.5 rounded-full",
                    i < state.attemptsLeft ? "bg-primary shadow-chip" : "bg-border",
                  )}
                />
              ))}
            </div>

            {/* Wrong guesses so far */}
            {state.wrongGuesses.length > 0 && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Misses:{" "}
                <span className="font-bold text-destructive">
                  {state.wrongGuesses.join(" · ")}
                </span>
              </p>
            )}

            <form onSubmit={onGuessForm} className="mt-4 flex flex-col gap-2">
              <input
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                maxLength={20}
                placeholder="Your answer…"
                aria-label="Your answer"
                className="h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-chip outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="submit"
                disabled={submitting || guessInput.trim().length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-primary to-primary-deep px-5 text-sm font-bold text-white shadow-btn-amber transition-all hover:-translate-y-0.5 hover:brightness-105 disabled:pointer-events-none disabled:opacity-50"
              >
                Guess
              </button>
            </form>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Three attempts. Make them count.
            </p>
          </div>
        )}
      </div>

      {/* Match over — the reveal */}
      {isOver && !isWaiting && (
        <div className="mx-auto mt-4 w-full max-w-xs rounded-3xl border-2 border-primary/60 bg-card p-5 text-center shadow-glow">
          <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-gradient-to-b from-primary/25 to-primary/10 text-xl shadow-chip">
            {state.winner === "O" ? "🎉" : "🧩"}
          </div>
          <p className="mt-3 text-base font-black tracking-tight">
            {state.winner === myMarker
              ? isSetter
                ? "You stumped them!"
                : "You unscrambled it!"
              : isSetter
                ? "Your friend got it"
                : "Out of tries"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {state.winner === "O"
              ? `Solved with ${state.wrongGuesses.length} miss${state.wrongGuesses.length === 1 ? "" : "es"}.`
              : `${state.wrongGuesses.length} miss${state.wrongGuesses.length === 1 ? "" : "es"} — the word held.`}
          </p>
          {state.secret && (
            <p className="mt-4 rounded-2xl bg-background px-4 py-3 text-sm font-bold shadow-chip">
              The word was: <span className="text-primary">“{state.secret}”</span>
            </p>
          )}
        </div>
      )}
    </>
  );
}
