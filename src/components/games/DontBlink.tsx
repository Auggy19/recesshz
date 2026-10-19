import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, KeyRound, Lightbulb, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  freshDontBlinkState,
  isLit,
  isWatched,
  setWatching,
  tickMonsters,
  tickTime,
  toggleNearestLamp,
  tryMove,
  type DontBlinkState,
} from "@/lib/dontBlink";
import { cn } from "@/lib/utils";

const CELL = 28;

export function DontBlink() {
  const [state, setState] = useState<DontBlinkState>(() => freshDontBlinkState());
  const watchRef = useRef(true);

  const reset = () => setState(freshDontBlinkState());

  const move = useCallback((dx: number, dy: number) => {
    setState((s) => tryMove(s, dx, dy));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w") {
        e.preventDefault();
        move(0, -1);
      } else if (e.key === "ArrowDown" || e.key === "s") {
        e.preventDefault();
        move(0, 1);
      } else if (e.key === "ArrowLeft" || e.key === "a") {
        e.preventDefault();
        move(-1, 0);
      } else if (e.key === "ArrowRight" || e.key === "d") {
        e.preventDefault();
        move(1, 0);
      } else if (e.key === " " || e.key === "Shift") {
        e.preventDefault();
        watchRef.current = true;
        setState((s) => setWatching(s, true));
      } else if (e.key === "l" || e.key === "L") {
        setState((s) => toggleNearestLamp(s));
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Shift") {
        watchRef.current = false;
        setState((s) => setWatching(s, false));
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, [move]);

  // Timer + monster ticks
  useEffect(() => {
    if (state.status !== "play") return;
    const id = window.setInterval(() => {
      setState((s) => {
        let n = tickTime(s, 0.25);
        n = tickMonsters(n);
        return n;
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [state.status]);

  const pad = (
    <div className="mt-4 grid grid-cols-3 gap-2 max-w-[160px] mx-auto">
      <span />
      <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={() => move(0, -1)}>
        ↑
      </Button>
      <span />
      <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={() => move(-1, 0)}>
        ←
      </Button>
      <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={() => move(0, 1)}>
        ↓
      </Button>
      <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={() => move(1, 0)}>
        →
      </Button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
        <span className="inline-flex items-center gap-1.5">
          <KeyRound className="size-4 text-primary" />
          {state.keysHeld}/{state.keysNeeded}
        </span>
        <span
          className={cn(
            "tabular-nums",
            state.timeLeft < 20 && "text-rose-500",
          )}
        >
          {Math.ceil(state.timeLeft)}s
        </span>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs"
        >
          <RotateCcw className="size-3.5" />
          Reset
        </button>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{state.message}</p>

      <div
        className="mx-auto overflow-hidden rounded-2xl border border-border bg-[#0a0a0c] p-2 shadow-lift"
        style={{ width: state.w * CELL + 16 }}
      >
        <div
          className="relative"
          style={{ width: state.w * CELL, height: state.h * CELL }}
        >
          {Array.from({ length: state.h }).map((_, y) =>
            Array.from({ length: state.w }).map((__, x) => {
              const wall = state.walls[y][x];
              const lit = isLit(state, { x, y });
              return (
                <div
                  key={`${x}-${y}`}
                  className={cn(
                    "absolute",
                    wall ? "bg-zinc-800" : lit ? "bg-amber-950/80" : "bg-zinc-950",
                  )}
                  style={{
                    left: x * CELL,
                    top: y * CELL,
                    width: CELL - 1,
                    height: CELL - 1,
                  }}
                />
              );
            }),
          )}
          {state.keys.map((k, i) => (
            <div
              key={`k-${i}`}
              className="absolute flex items-center justify-center text-amber-400"
              style={{
                left: k.x * CELL,
                top: k.y * CELL,
                width: CELL,
                height: CELL,
              }}
            >
              <KeyRound className="size-3.5" />
            </div>
          ))}
          {state.lamps.map((l, i) => (
            <div
              key={`l-${i}`}
              className={cn(
                "absolute flex items-center justify-center",
                l.on ? "text-amber-300" : "text-zinc-600",
              )}
              style={{
                left: l.pos.x * CELL,
                top: l.pos.y * CELL,
                width: CELL,
                height: CELL,
              }}
            >
              <Lightbulb className="size-3.5" />
            </div>
          ))}
          <div
            className="absolute flex items-center justify-center text-emerald-400 text-[10px] font-bold"
            style={{
              left: state.exit.x * CELL,
              top: state.exit.y * CELL,
              width: CELL,
              height: CELL,
            }}
          >
            EXIT
          </div>
          {state.monsters.map((m, i) => {
            const frozen = isWatched(state, m) || isLit(state, m);
            return (
              <div
                key={`m-${i}`}
                className={cn(
                  "absolute flex items-center justify-center rounded-sm text-[11px] font-black transition-colors",
                  frozen
                    ? "bg-violet-900/80 text-violet-200"
                    : "bg-rose-700 text-white animate-pulse",
                )}
                style={{
                  left: m.x * CELL + 2,
                  top: m.y * CELL + 2,
                  width: CELL - 5,
                  height: CELL - 5,
                }}
              >
                {frozen ? "▣" : "◉"}
              </div>
            );
          })}
          <div
            className="absolute flex items-center justify-center rounded-sm bg-primary text-[10px] font-black text-black"
            style={{
              left: state.player.x * CELL + 2,
              top: state.player.y * CELL + 2,
              width: CELL - 5,
              height: CELL - 5,
            }}
          >
            {state.watching ? "◉" : "·"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className={cn(
            "flex-1 rounded-full font-bold",
            state.watching && "ring-2 ring-primary",
          )}
          variant={state.watching ? "default" : "outline"}
          onPointerDown={() => {
            watchRef.current = true;
            setState((s) => setWatching(s, true));
          }}
          onPointerUp={() => {
            watchRef.current = false;
            setState((s) => setWatching(s, false));
          }}
          onPointerLeave={() => {
            if (watchRef.current) {
              watchRef.current = false;
              setState((s) => setWatching(s, false));
            }
          }}
        >
          {state.watching ? (
            <>
              <Eye className="size-4" /> Watching
            </>
          ) : (
            <>
              <EyeOff className="size-4" /> Look away
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-full font-bold"
          onClick={() => setState((s) => toggleNearestLamp(s))}
        >
          <Lightbulb className="size-4" />
          Lamp
        </Button>
      </div>

      {pad}

      {state.status === "win" && (
        <p className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-300">
          Escaped. {Math.ceil(state.timeLeft)}s left.
        </p>
      )}
      {state.status === "lose" && (
        <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-600 dark:text-rose-300">
          {state.message}
        </p>
      )}

      <p className="text-[11px] text-muted-foreground">
        Hold <strong>Watch</strong> (or Space) so they freeze in your line of sight. Release and they
        crawl. Arrow keys or pad to move. Lamp toggles a nearby light.
      </p>
    </div>
  );
}
