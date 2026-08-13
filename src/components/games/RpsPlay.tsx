import type { ReactNode } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  PaperGesture,
  QuestionMark,
  RockGesture,
  RockPaperScissorsArt,
  type ArtProps,
} from "@/components/GameArt";

// ---------------------------------------------------------------------------
// Rock Paper Scissors play area. Both players pick independently; nobody's
// pick is revealed (server-side) until both have submitted. Best of 3,
// draws replay the round. Gestures are the flat ink/amber hand tiles from
// the icon set — no emoji.
// ---------------------------------------------------------------------------

type Marker = "X" | "O";
type GameStatus = "waiting" | "in_progress" | "completed" | "abandoned";
export type RpsChoice = "rock" | "paper" | "scissors";

interface RpsState {
  round: number;
  phase: "picking" | "resolved";
  picks: { X: RpsChoice | null; O: RpsChoice | null };
  scores: { X: number; O: number };
  winner: "X" | "O" | "draw" | null;
  matchWinner: Marker | null;
  rematch?: { slug: string; by: string };
}

interface Props {
  state: RpsState;
  status: GameStatus;
  myMarker: Marker;
  /** Server truth: have I already submitted a pick for this round? */
  picked: boolean | undefined;
  onPick: (pick: RpsChoice) => Promise<boolean>;
}

const CHOICES: { value: RpsChoice; label: string }[] = [
  { value: "rock", label: "Rock" },
  { value: "paper", label: "Paper" },
  { value: "scissors", label: "Scissors" },
];

/** Rock and paper have dedicated gesture tiles; scissors reuses the card art's
 *  two-finger hand so the set stays visually identical. */
const GESTURES: Record<RpsChoice, (p: ArtProps) => ReactNode> = {
  rock: (p) => <RockGesture {...p} />,
  paper: (p) => <PaperGesture {...p} />,
  scissors: (p) => <RockPaperScissorsArt {...p} />,
};

function Gesture({ pick, className }: { pick: RpsChoice; className?: string }) {
  const C = GESTURES[pick];
  return <C className={className} />;
}

export default function RpsPlay({ state, status, myMarker, picked, onPick }: Props) {
  // The server masks picks until both are in, so remember my own pick
  // client-side for the "waiting on your friend" view. Reset when a new
  // round starts (server says I haven't picked) — done as a render-time
  // adjustment, the React-recommended pattern for prop-derived state.
  const [localPick, setLocalPick] = useState<RpsChoice | null>(null);
  const [submitting, setSubmitting] = useState<RpsChoice | null>(null);
  const [lastPicked, setLastPicked] = useState(picked);
  if (lastPicked !== picked) {
    setLastPicked(picked);
    if (!picked) setLocalPick(null);
  }

  const isWaiting = status === "waiting";
  const isMatchOver = state.matchWinner !== null;
  const bothPicked = state.picks.X !== null && state.picks.O !== null;
  const myPick = state.picks[myMarker] ?? localPick;
  const hasPicked = myPick !== null || picked === true;
  const opponentMarker: Marker = myMarker === "X" ? "O" : "X";
  // The server masks picks while a round is open, so `state.picks[myMarker]`
  // is always null client-side during "picking" — trust the server's `picked`
  // flag instead. A resolved round still lets both players pick again.
  const alreadyPickedThisRound =
    state.phase === "picking" && picked === true;
  const canPick =
    status === "in_progress" && !isMatchOver && !alreadyPickedThisRound;

  const myScore = state.scores[myMarker];
  const oppScore = state.scores[opponentMarker];

  // Status line text
  let statusText: string;
  if (isWaiting) {
    statusText = "Waiting for your friend to join…";
  } else if (isMatchOver) {
    statusText =
      state.matchWinner === myMarker
        ? "You win the match!"
        : "Your friend wins the match";
  } else if (bothPicked) {
    statusText =
      state.winner === "draw"
        ? "Draw — pick again"
        : state.winner === myMarker
          ? "You took the round"
          : "Your friend took the round";
  } else if (hasPicked) {
    statusText = "You picked — waiting on your friend…";
  } else {
    statusText = "Your move — pick one";
  }

  const handlePick = async (choice: RpsChoice) => {
    if (submitting) return;
    setSubmitting(choice);
    const ok = await onPick(choice);
    if (ok) setLocalPick(choice);
    setSubmitting(null);
  };

  return (
    <>
      {/* Status line */}
      <div className="flex items-center justify-center gap-2 text-center">
        <span
          className={cn(
            "size-2 rounded-full",
            hasPicked || isWaiting || isMatchOver
              ? "animate-pulse bg-primary"
              : "bg-muted-foreground/40",
          )}
        />
        <p className="text-sm font-semibold text-muted-foreground">
          {statusText}
        </p>
      </div>

      {/* Score bar */}
      <div className="mx-auto mt-5 flex w-full max-w-xs items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
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

      {/* Picks / reveal area */}
      <div className={cn("mx-auto mt-5 w-full max-w-xs", isWaiting && "opacity-60")}>
        {bothPicked ? (
          // Round resolved — both picks revealed.
          <div className="rounded-3xl border border-primary/30 bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-1 flex-col items-center gap-2 rounded-2xl bg-background py-4 shadow-chip">
                {state.picks[myMarker] && (
                  <Gesture pick={state.picks[myMarker]} className="h-14 w-14" />
                )}
                <span className="text-xs font-bold text-muted-foreground">You</span>
              </div>
              <span className="text-xl font-black text-muted-foreground">vs</span>
              <div className="flex flex-1 flex-col items-center gap-2 rounded-2xl bg-background py-4 shadow-chip">
                {state.picks[opponentMarker] && (
                  <Gesture pick={state.picks[opponentMarker]} className="h-14 w-14" />
                )}
                <span className="text-xs font-bold text-muted-foreground">Friend</span>
              </div>
            </div>
            <p className="mt-4 text-center text-sm font-bold">
              {state.winner === "draw"
                ? "Same pick — replay this round."
                : state.winner === myMarker
                  ? `You took round ${state.round}.`
                  : `Your friend took round ${state.round}.`}
            </p>
            {!isMatchOver && (
              <p className="mt-1 text-center text-xs text-muted-foreground">
                Pick below to start the next round.
              </p>
            )}
          </div>
        ) : hasPicked ? (
          // My pick is in — show mine, hide theirs until they submit.
          <div className="rounded-3xl border-2 border-dashed border-border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-1 flex-col items-center gap-2 rounded-2xl bg-background py-4 shadow-chip">
                {myPick ? (
                  <Gesture pick={myPick} className="h-14 w-14" />
                ) : (
                  <span className="text-4xl font-black text-muted-foreground">…</span>
                )}
                <span className="text-xs font-bold text-muted-foreground">You</span>
              </div>
              <span className="text-xl font-black text-muted-foreground">vs</span>
              <div className="flex flex-1 flex-col items-center gap-2 rounded-2xl bg-background py-4 shadow-chip">
                <QuestionMark className="h-14 w-14 animate-bounce" />
                <span className="text-xs font-bold text-muted-foreground">Friend</span>
              </div>
            </div>
            <p className="mt-4 text-center text-sm font-bold">
              Now we wait — silence is safe here.
            </p>
          </div>
        ) : null}

        {/* Pick buttons — available whenever a pick would be accepted */}
        {!isWaiting && !isMatchOver && (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {CHOICES.map((c) => {
                const disabled = !canPick || submitting !== null;
                return (
                  <button
                    key={c.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => handlePick(c.value)}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl border-2 border-border bg-card shadow-soft transition-all duration-150",
                      canPick &&
                        !disabled &&
                        "cursor-pointer hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-glow active:scale-95",
                    )}
                  >
                    <Gesture pick={c.value} className="h-14 w-14 sm:h-16 sm:w-16" />
                    <span className="text-xs font-bold">{c.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {bothPicked
                ? state.winner === "draw"
                  ? "Same pick — pick again to replay the round."
                  : `Pick again to start round ${Math.min(state.round + 1, 3)}.`
                : hasPicked
                  ? "Waiting on your friend's pick — no peeking."
                  : "First to two rounds wins. Draws replay."}
            </p>
          </>
        )}
      </div>
    </>
  );
}
