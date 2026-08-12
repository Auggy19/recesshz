import { useState } from "react";
import { cn } from "@/lib/utils";
import { QuestionMark } from "@/components/GameArt";

// ---------------------------------------------------------------------------
// Red or Black play area. The responder (O) guesses a color; the server draws
// the card outcome itself (fair 50/50, never from the client) and the round
// resolves instantly. A correct guess scores O, a miss scores X (the host).
// Best of 3 — first to two round wins takes the match. The host (X) never
// submits a move; they just watch the reveals.
// ---------------------------------------------------------------------------

type Marker = "X" | "O";
type GameStatus = "waiting" | "in_progress" | "completed" | "abandoned";
export type RedBlackChoice = "red" | "black";

interface RedBlackState {
  round: number;
  phase: "picking" | "resolved";
  guess: RedBlackChoice | null;
  draw: RedBlackChoice | null;
  scores: { X: number; O: number };
  winner: "X" | "O" | null;
  matchWinner: Marker | null;
  rematch?: { slug: string; by: string };
}

interface Props {
  state: RedBlackState;
  status: GameStatus;
  myMarker: Marker;
  onGuess: (guess: RedBlackChoice) => Promise<boolean>;
}

const CHOICES: { value: RedBlackChoice; label: string }[] = [
  { value: "red", label: "Red" },
  { value: "black", label: "Black" },
];

/** A flat color swatch — the only place a second accent color appears in the
 *  game UI (the game itself is literally "red or black"). Ink outline, no
 *  gradients, matching the icon set's treatment. */
function Swatch({ color, className }: { color: RedBlackChoice; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-2xl border-2 border-[#1A1A1A]",
        color === "red" ? "bg-[#E5484D]" : "bg-[#1A1A1A]",
        className,
      )}
    />
  );
}

export default function RedBlackPlay({ state, status, myMarker, onGuess }: Props) {
  const [submitting, setSubmitting] = useState<RedBlackChoice | null>(null);

  const isWaiting = status === "waiting";
  const isMatchOver = state.matchWinner !== null;
  const isGuesser = myMarker === "O";
  const opponentMarker: Marker = myMarker === "X" ? "O" : "X";
  const revealed = state.phase === "resolved" && state.guess !== null && state.draw !== null;

  const myScore = state.scores[myMarker];
  const oppScore = state.scores[opponentMarker];
  // The status dot pulses while something is actively happening.
  const activeTurn = isWaiting || isMatchOver || (!revealed && isGuesser);

  // Status line text
  let statusText: string;
  if (isWaiting) {
    statusText = "Waiting for your friend to join…";
  } else if (isMatchOver) {
    statusText =
      state.matchWinner === myMarker
        ? "You win the match!"
        : "Your friend wins the match";
  } else if (revealed) {
    statusText =
      state.winner === myMarker
        ? "You took the round"
        : "Your friend took the round";
  } else if (isGuesser) {
    statusText = "Your move — pick a color";
  } else {
    statusText = "Waiting for your friend to pick a color…";
  }

  const handleGuess = async (choice: RedBlackChoice) => {
    if (submitting) return;
    setSubmitting(choice);
    await onGuess(choice);
    setSubmitting(null);
  };

  return (
    <>
      {/* Status line */}
      <div className="flex items-center justify-center gap-2 text-center">
        <span
          className={cn(
            "size-2 rounded-full",
            activeTurn ? "animate-pulse bg-primary" : "bg-muted-foreground/40",
          )}
        />
        <p className="text-sm font-semibold text-muted-foreground">
          {statusText}
        </p>
      </div>

      {/* Score bar */}
      <div className="mx-auto mt-5 flex w-full max-w-xs items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
        <span
          className={cn(
            "text-sm font-black",
            myScore > oppScore ? "text-primary" : "text-foreground",
          )}
        >
          You {myScore}
        </span>
        <span className="text-xs font-semibold text-muted-foreground">
          {isMatchOver ? "Best of 3" : `Round ${Math.min(state.round, 3)} of 3`}
        </span>
        <span
          className={cn(
            "text-sm font-black",
            oppScore > myScore ? "text-primary" : "text-foreground",
          )}
        >
          Friend {oppScore}
        </span>
      </div>

      {/* Reveal / pick area */}
      <div className={cn("mx-auto mt-5 w-full max-w-xs", isWaiting && "opacity-60")}>
        {revealed ? (
          // Round resolved — guess and draw both revealed.
          <div className="rounded-3xl border-2 border-border bg-card p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-1 flex-col items-center gap-2 rounded-2xl bg-background py-4">
                <Swatch color={state.guess!} className="size-14" />
                <span className="text-xs font-bold text-muted-foreground">
                  {isGuesser ? "You said" : "Friend said"}
                </span>
                <span className="text-sm font-black capitalize">{state.guess}</span>
              </div>
              <span className="text-xl font-black text-muted-foreground">vs</span>
              <div className="flex flex-1 flex-col items-center gap-2 rounded-2xl bg-background py-4">
                <Swatch color={state.draw!} className="size-14" />
                <span className="text-xs font-bold text-muted-foreground">
                  Card was
                </span>
                <span className="text-sm font-black capitalize">{state.draw}</span>
              </div>
            </div>
            <p className="mt-4 text-center text-sm font-bold">
              {state.winner === myMarker
                ? "Right on the money — you took the round."
                : "Not this time — your friend took the round."}
            </p>
            {!isMatchOver && (
              <p className="mt-1 text-center text-xs text-muted-foreground">
                {isGuesser
                  ? "Pick below to start the next round."
                  : "Your friend picks to start the next round."}
              </p>
            )}
          </div>
        ) : (
          !isGuesser && !isWaiting && (
            // Host waiting on the guesser — a hidden card placeholder.
            <div className="rounded-3xl border-2 border-dashed border-border bg-card p-5">
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-background py-6">
                <QuestionMark className="h-14 w-14 animate-bounce" />
                <span className="text-xs font-bold text-muted-foreground">
                  Your friend's pick
                </span>
              </div>
              <p className="mt-4 text-center text-sm font-bold">
                The card stays hidden until they guess.
              </p>
            </div>
          )
        )}

        {/* Pick buttons — only the guesser (O) ever sees these */}
        {!isWaiting && !isMatchOver && isGuesser && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {CHOICES.map((c) => {
                const disabled = submitting !== null;
                return (
                  <button
                    key={c.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleGuess(c.value)}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center gap-2.5 rounded-3xl border-2 border-border bg-card transition-all",
                      !disabled &&
                        "cursor-pointer hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md active:scale-95",
                    )}
                  >
                    <Swatch color={c.value} className="size-14 sm:size-16" />
                    <span className="text-sm font-bold">{c.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {revealed
                ? `Pick again to start round ${Math.min(state.round + 1, 3)}.`
                : "First to two rounds wins — guess right to take one."}
            </p>
          </>
        )}
      </div>
    </>
  );
}
