import type { Marker, TodState, TodKind } from "@/lib/truthOrDare";
import { cn } from "@/lib/utils";

type Props = {
  state: TodState;
  status: string;
  myMarker: Marker | null;
  onChoose: (kind: TodKind) => void;
  onDone: () => void;
  onSkip: () => void;
  busy?: boolean;
};

export default function TruthOrDarePlay({
  state,
  status,
  myMarker,
  onChoose,
  onDone,
  onSkip,
  busy,
}: Props) {
  const isPicker = myMarker != null && state.phase === "pick" && state.turn === myMarker;
  const isSubject =
    myMarker != null && state.phase === "respond" && state.subject === myMarker;
  const waitingPick =
    myMarker != null && state.phase === "pick" && state.turn !== myMarker;
  const waitingRespond =
    myMarker != null && state.phase === "respond" && state.subject !== myMarker;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-card/80 px-4 py-3 shadow-sm">
        <div className="text-sm">
          <span className="text-muted-foreground">You</span>{" "}
          <span className="font-semibold tabular-nums">{state.scores.X}</span>
        </div>
        <div className="text-xs font-medium text-muted-foreground">
          First to {state.target}
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Friend</span>{" "}
          <span className="font-semibold tabular-nums">{state.scores.O}</span>
        </div>
      </div>

      {status === "waiting" && (
        <p className="text-center text-sm text-muted-foreground">
          Waiting for your friend to open the link…
        </p>
      )}

      {state.phase === "match_over" && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-6 text-center">
          <p className="text-lg font-semibold">
            {state.matchWinner === myMarker ? "You took it" : "They got there first"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Final {state.scores.X} – {state.scores.O}
          </p>
        </div>
      )}

      {state.phase === "pick" && isPicker && (
        <div className="space-y-3">
          <p className="text-center text-sm text-muted-foreground">
            Pick for your friend — truth or dare.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => onChoose("truth")}
              className="rounded-2xl border border-sky-500/40 bg-sky-500/15 px-4 py-8 text-lg font-bold text-sky-700 dark:text-sky-300 transition active:scale-[0.98]"
            >
              Truth
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onChoose("dare")}
              className="rounded-2xl border border-rose-500/40 bg-rose-500/15 px-4 py-8 text-lg font-bold text-rose-700 dark:text-rose-300 transition active:scale-[0.98]"
            >
              Dare
            </button>
          </div>
        </div>
      )}

      {waitingPick && (
        <p className="text-center text-sm text-muted-foreground">
          Your friend is choosing truth or dare for you…
        </p>
      )}

      {state.phase === "respond" && state.current && (
        <div
          className={cn(
            "rounded-2xl border px-4 py-6 text-center",
            state.current.kind === "truth"
              ? "border-sky-500/30 bg-sky-500/10"
              : "border-rose-500/30 bg-rose-500/10",
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {state.current.kind}
          </p>
          <p className="mt-3 text-base font-medium leading-snug">{state.current.text}</p>

          {isSubject && (
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onDone}
                className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"
              >
                Done
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onSkip}
                className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-muted-foreground"
              >
                Skip
              </button>
            </div>
          )}
          {waitingRespond && (
            <p className="mt-4 text-sm text-muted-foreground">Waiting on their answer…</p>
          )}
        </div>
      )}

      {state.lastResult && state.phase === "pick" && (
        <p className="text-center text-xs text-muted-foreground">
          Last turn: {state.lastResult === "done" ? "completed" : "skipped"}
        </p>
      )}
    </div>
  );
}
