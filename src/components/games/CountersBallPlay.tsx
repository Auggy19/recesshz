/**
 * Counters Ball FC — pitch view (Phase A).
 * Renders rest state; flick controls land in Phase B with submitMove.
 */
import { PITCH, type CountersBallState } from "@/lib/countersBall";
import { cn } from "@/lib/utils";

export type Marker = "X" | "O";
export type GameStatus = "waiting" | "in_progress" | "completed" | "abandoned";

interface Props {
  state: CountersBallState;
  status: GameStatus;
  myMarker: Marker;
}

function teamFromMarker(m: Marker): 0 | 1 {
  return m === "X" ? 0 : 1;
}

export default function CountersBallPlay({
  state,
  status,
  myMarker,
}: Props) {
  const isWaiting = status === "waiting";
  const isOver = state.phase === "gameover" || state.winner !== null;
  const myTeam = teamFromMarker(myMarker);
  const isMyTurn =
    status === "in_progress" && !isOver && state.turnTeam === myTeam;

  const sx = 100 / PITCH.w;
  const sy = 100 / PITCH.h;

  return (
    <>
      <div className="flex items-center justify-center gap-2 text-center">
        <span
          className={cn(
            "size-2 rounded-full",
            isMyTurn || isWaiting
              ? "animate-pulse bg-primary"
              : "bg-muted-foreground/40",
          )}
        />
        <p className="text-sm font-semibold text-muted-foreground">
          {isWaiting
            ? "Waiting for your friend to join…"
            : isOver
              ? state.winner === myTeam
                ? "You win!"
                : "Your friend wins"
              : isMyTurn
                ? "Your flick — pull back a cap (controls next)"
                : "Waiting for your friend's flick…"}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-center gap-6 font-display text-2xl font-black tabular-nums">
        <span className="text-sky-600 dark:text-sky-400">{state.scores[0]}</span>
        <span className="text-sm font-bold text-muted-foreground">first to {state.targetGoals}</span>
        <span className="text-rose-600 dark:text-rose-400">{state.scores[1]}</span>
      </div>

      <div
        className={cn(
          "relative mx-auto mt-4 aspect-[5/3] w-full max-w-md overflow-hidden rounded-2xl border-2 border-[#1A1A1A]/30 shadow-lift",
          isWaiting && "opacity-70",
        )}
        style={{
          background:
            "linear-gradient(160deg, #1a5c2e 0%, #147a3a 40%, #0f5c2c 100%)",
        }}
      >
        {/* Centre circle */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/20" />
        {/* Goals */}
        <div className="pointer-events-none absolute left-0 top-1/2 h-[28%] w-1.5 -translate-y-1/2 rounded-r bg-white/40" />
        <div className="pointer-events-none absolute right-0 top-1/2 h-[28%] w-1.5 -translate-y-1/2 rounded-l bg-white/40" />

        {state.caps.map((c) => {
          const mine = c.team === myTeam;
          return (
            <div
              key={c.id}
              title={c.id}
              className={cn(
                "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 shadow-md",
                c.team === 0
                  ? "border-sky-900/50 bg-gradient-to-br from-sky-300 to-sky-600"
                  : "border-rose-900/50 bg-gradient-to-br from-rose-300 to-rose-600",
                mine && isMyTurn && "ring-2 ring-primary ring-offset-1 ring-offset-transparent",
              )}
              style={{
                left: `${c.x * sx}%`,
                top: `${c.y * sy}%`,
                width: `${PITCH.capR * 2 * sx}%`,
                height: `${PITCH.capR * 2 * sy * (PITCH.w / PITCH.h)}%`,
                minWidth: 18,
                minHeight: 18,
              }}
            >
              <span className="text-[8px] font-black text-white/90 drop-shadow">
                {c.role === "gk" ? "G" : c.id.split("-")[1]}
              </span>
            </div>
          );
        })}

        {/* Ball / cork */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-900/40 bg-gradient-to-br from-[#FFF9E5] via-[#F5A623] to-[#B45309] shadow"
          style={{
            left: `${state.ball.x * sx}%`,
            top: `${state.ball.y * sy}%`,
            width: `${PITCH.ballR * 2 * sx}%`,
            height: `${PITCH.ballR * 2 * sy * (PITCH.w / PITCH.h)}%`,
            minWidth: 10,
            minHeight: 10,
          }}
        />
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        You're {myMarker === "X" ? "sky caps" : "rose caps"}. One flick per turn — first to{" "}
        {state.targetGoals}.
      </p>
    </>
  );
}
