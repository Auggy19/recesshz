import { useState } from "react";
import {
  nextSoloPrompt,
  type TodKind,
  type TodPrompt,
} from "@/lib/truthOrDare";
import { cn } from "@/lib/utils";

export function SoloTruthOrDare() {
  const [used, setUsed] = useState<number[]>([]);
  const [current, setCurrent] = useState<TodPrompt | null>(null);
  const [count, setCount] = useState(0);

  function deal(kind: TodKind) {
    const { prompt, used: next } = nextSoloPrompt(kind, used);
    setUsed(next);
    setCurrent(prompt);
    setCount((c) => c + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Pass the phone or play alone. Nothing is saved on a server.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => deal("truth")}
          className="rounded-2xl border border-sky-500/40 bg-sky-500/15 px-4 py-6 text-base font-bold text-sky-800 dark:text-sky-200"
        >
          Truth
        </button>
        <button
          type="button"
          onClick={() => deal("dare")}
          className="rounded-2xl border border-rose-500/40 bg-rose-500/15 px-4 py-6 text-base font-bold text-rose-800 dark:text-rose-200"
        >
          Dare
        </button>
      </div>

      {current && (
        <div
          className={cn(
            "rounded-2xl border px-4 py-8 text-center",
            current.kind === "truth"
              ? "border-sky-500/30 bg-sky-500/10"
              : "border-rose-500/30 bg-rose-500/10",
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {current.kind} · #{count}
          </p>
          <p className="mt-3 text-lg font-medium leading-snug">{current.text}</p>
        </div>
      )}

      {!current && (
        <p className="text-center text-sm text-muted-foreground">
          Tap Truth or Dare to draw a prompt.
        </p>
      )}
    </div>
  );
}
