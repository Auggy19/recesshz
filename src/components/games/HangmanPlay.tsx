import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { HangmanArt } from "@/components/GameArt";

// ---------------------------------------------------------------------------
// Hangman play area. The initiator (X) secretly picks a word or phrase; the
// responder (O) guesses letters one at a time (or the whole word) and the
// server judges every guess automatically — the setter just watches. Six
// wrong guesses hang the figure (X wins); revealing every letter (or a
// correct full-word guess) wins O. The word is server-masked from O until
// the match ends.
// ---------------------------------------------------------------------------

type Marker = "X" | "O";
type GameStatus = "waiting" | "in_progress" | "completed" | "abandoned";

const MAX_WRONG = 6;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

interface HangmanState {
  phase: "setup" | "guessing" | "match_over";
  secret: string | null;
  revealed: string[];
  guessed: string[];
  wrongCount: number;
  maxWrong: number;
  winner: Marker | null;
  rematch?: { slug: string; by: string };
}

export type HangmanMove = { secret: string } | { guess: string };

interface Props {
  state: HangmanState;
  status: GameStatus;
  myMarker: Marker;
  onSubmit: (move: HangmanMove) => Promise<boolean>;
}

/** The six body parts that appear one per wrong guess. */
const BODY_PARTS = ["head", "body", "arm-l", "arm-r", "leg-l", "leg-r"] as const;

function HangmanFigure({ wrongCount }: { wrongCount: number }) {
  const shown = new Set(BODY_PARTS.slice(0, wrongCount));
  const limb = (name: (typeof BODY_PARTS)[number], d: string) =>
    shown.has(name) ? (
      <g>
        <path d={d} stroke="#1A1A1A" strokeWidth={13} strokeLinecap="round" fill="none" />
        <path d={d} stroke="#F5A623" strokeWidth={7.5} strokeLinecap="round" fill="none" />
      </g>
    ) : null;
  return (
    <svg viewBox="0 0 120 120" className="mx-auto w-24" aria-hidden>
      {/* gallows — always visible */}
      <path d="M 26 18 L 26 104" stroke="#1A1A1A" strokeWidth={7} strokeLinecap="round" />
      <path d="M 26 18 L 82 18" stroke="#1A1A1A" strokeWidth={7} strokeLinecap="round" />
      <path d="M 14 108 L 52 108" stroke="#1A1A1A" strokeWidth={8} strokeLinecap="round" />
      <path d="M 82 18 L 82 34" stroke="#1A1A1A" strokeWidth={3.5} strokeLinecap="round" />
      {shown.has("head") && (
        <circle cx={82} cy={44} r={10} fill="#F5A623" stroke="#1A1A1A" strokeWidth={3.5} />
      )}
      {limb("body", "M 82 54 L 82 76")}
      {limb("arm-l", "M 82 58 L 70 70")}
      {limb("arm-r", "M 82 58 L 94 70")}
      {limb("leg-l", "M 82 76 L 72 94")}
      {limb("leg-r", "M 82 76 L 92 94")}
    </svg>
  );
}

export default function HangmanPlay({
  state,
  status,
  myMarker,
  onSubmit,
}: Props) {
  const [secretInput, setSecretInput] = useState("");
  const [wordGuess, setWordGuess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isWaiting = status === "waiting";
  const isOver = state.winner !== null;
  const isSetter = myMarker === "X";
  const canPlay = state.phase === "guessing" && !isSetter && !isOver && !isWaiting;

  // Wrong letters are the tried ones that never show up in the revealed word.
  const revealedLetters = new Set(
    state.revealed
      .filter((ch) => /[a-z]/i.test(ch))
      .map((ch) => ch.toLowerCase()),
  );
  const wrongTried = state.guessed.filter((g) => !revealedLetters.has(g));

  // Status line text
  let statusText: string;
  if (isWaiting) {
    statusText = "Waiting for your friend to join…";
  } else if (isOver) {
    statusText =
      state.winner === myMarker
        ? isSetter
          ? "You win!"
          : "You solved it!"
        : isSetter
          ? "They got it"
          : "Six misses";
  } else if (state.phase === "setup") {
    statusText = isSetter
      ? "Pick your word — your friend can't see it."
      : "Waiting for your friend to pick a word…";
  } else if (isSetter) {
    statusText = "Your friend is guessing…";
  } else {
    statusText = `${state.wrongCount} of ${state.maxWrong} wrong — choose a letter.`;
  }

  const submit = async (move: HangmanMove) => {
    if (submitting) return;
    setSubmitting(true);
    const ok = await onSubmit(move);
    if (ok) {
      if ("secret" in move) setSecretInput("");
      if ("guess" in move) setWordGuess("");
    }
    setSubmitting(false);
  };

  const onSecretForm = (e: FormEvent) => {
    e.preventDefault();
    const s = secretInput.trim();
    if (!s) return;
    void submit({ secret: s });
  };

  const onWordGuessForm = (e: FormEvent) => {
    e.preventDefault();
    const g = wordGuess.trim();
    if (!g) return;
    void submit({ guess: g });
  };

  const guessLetter = (letter: string) => {
    if (!canPlay || submitting || state.guessed.includes(letter)) return;
    void submit({ guess: letter });
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
            <HangmanArt className="w-20" />
            <p className="text-sm font-semibold text-muted-foreground">
              Waiting for your friend to join…
            </p>
          </div>
        ) : state.phase === "setup" && isSetter ? (
          // X picks the word
          <div>
            <p className="text-center text-sm font-bold">Think of a word or phrase.</p>
            <p className="mt-1 text-center text-xs leading-relaxed text-muted-foreground">
              Your friend gets six wrong guesses. Letters, spaces and dashes are
              fine — 2 to 24 characters.
            </p>
            <form onSubmit={onSecretForm} className="mt-4 flex flex-col gap-2">
              <input
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                maxLength={24}
                placeholder="e.g. a banana split"
                aria-label="Your word"
                className="h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-chip outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="submit"
                disabled={submitting || secretInput.trim().length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-primary to-primary-deep px-5 text-sm font-bold text-white shadow-btn-amber transition-all hover:-translate-y-0.5 hover:brightness-105 disabled:pointer-events-none disabled:opacity-50"
              >
                Lock it in
              </button>
            </form>
          </div>
        ) : state.phase === "setup" ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <HangmanArt className="w-20 animate-pulse" />
            <p className="text-sm font-semibold text-muted-foreground">
              Your friend is picking a word…
            </p>
          </div>
        ) : isSetter ? (
          // X watches while O guesses
          <div className="flex flex-col items-center gap-3 py-1 text-center">
            <p className="text-xs font-bold text-muted-foreground">Your word</p>
            <p className="max-w-full break-words rounded-2xl bg-background px-4 py-2 text-sm font-bold shadow-chip">
              “{state.secret}”
            </p>
            <p className="text-sm font-semibold text-muted-foreground">
              {state.wrongCount} of {state.maxWrong} wrong so far — sit tight.
            </p>
            {state.guessed.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Tried: {state.guessed.join(" · ")}
              </p>
            )}
          </div>
        ) : (
          // O guesses
          <div>
            {/* The revealed word */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {state.revealed.map((ch, i) =>
                ch === " " ? (
                  <span key={i} className="w-2" />
                ) : (
                  <span
                    key={i}
                    className={cn(
                      "flex h-10 w-7 items-center justify-center rounded-xl border text-base font-black",
                      ch === "_"
                        ? "border-border bg-background text-muted-foreground/40 shadow-chip"
                        : "border-primary/40 bg-primary/10 text-primary shadow-chip",
                    )}
                  >
                    {ch === "_" ? "" : ch}
                  </span>
                ),
              )}
            </div>

            {/* Hangman progress */}
            <div className="mt-4 rounded-2xl border border-border bg-background p-3">
              <HangmanFigure wrongCount={state.wrongCount} />
              <div className="mt-2 flex items-center justify-center gap-1.5">
                {Array.from({ length: state.maxWrong }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "size-2.5 rounded-full",
                      i < state.wrongCount ? "bg-primary shadow-chip" : "bg-border",
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Wrong letters so far */}
            {wrongTried.length > 0 && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Misses:{" "}
                <span className="font-bold text-destructive">{wrongTried.join(" ")}</span>
              </p>
            )}

            {/* Letter keyboard */}
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {ALPHABET.map((letter) => {
                const tried = state.guessed.includes(letter);
                const wrong = wrongTried.includes(letter);
                return (
                  <button
                    key={letter}
                    type="button"
                    disabled={!canPlay || submitting || tried}
                    onClick={() => guessLetter(letter)}
                    className={cn(
                      "flex h-9 w-8 items-center justify-center rounded-lg border text-sm font-black uppercase transition-all",
                      tried
                        ? wrong
                          ? "border-destructive/20 bg-destructive/10 text-destructive/60 line-through"
                          : "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-background text-foreground shadow-chip hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary disabled:pointer-events-none disabled:opacity-40",
                    )}
                    aria-label={`Guess ${letter}`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            {/* Whole-word guess */}
            <form onSubmit={onWordGuessForm} className="mt-4 flex flex-col gap-2">
              <input
                value={wordGuess}
                onChange={(e) => setWordGuess(e.target.value)}
                maxLength={40}
                placeholder="Or guess the whole word…"
                aria-label="Guess the whole word"
                className="h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-chip outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="submit"
                disabled={submitting || wordGuess.trim().length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-primary to-primary-deep px-5 text-sm font-bold text-white shadow-btn-amber transition-all hover:-translate-y-0.5 hover:brightness-105 disabled:pointer-events-none disabled:opacity-50"
              >
                Guess the word
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Match over — the reveal */}
      {isOver && !isWaiting && (
        <div className="mx-auto mt-4 w-full max-w-xs rounded-3xl border-2 border-primary/60 bg-card p-5 text-center shadow-glow">
          <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-gradient-to-b from-primary/25 to-primary/10 text-xl shadow-chip">
            {state.winner === "O" ? "🎉" : "💀"}
          </div>
          <p className="mt-3 text-base font-black tracking-tight">
            {state.winner === myMarker
              ? isSetter
                ? "You stumped them!"
                : "You solved it!"
              : isSetter
                ? "Your friend got it"
                : "Six misses — the word got you"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {state.winner === "O"
              ? `Solved with ${state.wrongCount} wrong guess${state.wrongCount === 1 ? "" : "es"} to spare.`
              : `The word survived ${state.wrongCount} wrong guess${state.wrongCount === 1 ? "" : "es"}.`}
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
