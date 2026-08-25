import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Pong play area — simple correspondence paddle tennis.
// Server picks angle + power. Returner aims near the mirrored angle.
// Windows are wide so the game stays easy and fun. First to 7 wins.
// ---------------------------------------------------------------------------

type Marker = "X" | "O";
type GameStatus = "waiting" | "in_progress" | "completed" | "abandoned";
export type PongPower = 1 | 2 | 3;

interface PongShot {
  angle: number;
  power: PongPower;
}

interface PongState {
  phase: "serve" | "return" | "point_over" | "match_over";
  turn: Marker;
  serve: PongShot | null;
  scores: { X: number; O: number };
  lastPoint: {
    winner: Marker;
    serve: PongShot;
    ret: PongShot;
    good: boolean;
  } | null;
  matchWinner: Marker | null;
  rematch?: { slug: string; by: string };
}

interface Props {
  state: PongState;
  status: GameStatus;
  myMarker: Marker;
  onShot: (angle: number, power: PongPower) => Promise<boolean>;
}

const PONG_TARGET = 7;
const SERVE_ANGLE_MAX = 60;
const RETURN_ANGLE_MAX = 45;

// Friendly labels — power still matters a little but windows are wide.
const POWER_OPTIONS: { value: PongPower; label: string; hint: string }[] = [
  { value: 1, label: "Soft", hint: "Easiest" },
  { value: 2, label: "Medium", hint: "Balanced" },
  { value: 3, label: "Hard", hint: "Slightly tighter" },
];

const POWER_LABELS: Record<PongPower, string> = {
  1: "Soft",
  2: "Medium",
  3: "Hard",
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** Map an angle to a vertical position on the court (percent, 0-100). */
const posPct = (angle: number) => clamp(50 + angle * 0.55, 6, 94);

/** Horizontal position (percent): X plays the left, O the right. */
const sideX = (m: Marker) => (m === "X" ? 6 : 88);

const signed = (a: number) => `${a > 0 ? "+" : ""}${a}`;

const other = (m: Marker): Marker => (m === "X" ? "O" : "X");

const COURT_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Snap to nearest step of 5 within range. */
function snapAngle(a: number, min: number, max: number) {
  const stepped = Math.round(a / 5) * 5;
  return clamp(stepped, min, max);
}

export default function PongPlay({ state, status, myMarker, onShot }: Props) {
  const [angle, setAngle] = useState(0);
  const [power, setPower] = useState<PongPower>(1); // default Soft = easiest
  const [submitting, setSubmitting] = useState(false);

  const isWaiting = status === "waiting";
  const isMatchOver = state.matchWinner !== null;
  const opponent: Marker = other(myMarker);
  const serve = state.serve;
  const last = state.lastPoint;
  const inFlight = state.phase === "return" && serve !== null;
  const resolved = state.phase === "point_over" || state.phase === "match_over";

  // Court geometry
  let ballX: number;
  let ballY: number;
  if (inFlight && serve) {
    ballX = sideX(state.turn);
    ballY = posPct(serve.angle);
  } else if (state.phase === "match_over" && last) {
    const returner = last.good ? last.winner : other(last.winner);
    ballX = sideX(returner);
    ballY = last.good ? posPct(-last.ret.angle) : posPct(last.serve.angle);
  } else {
    ballX = sideX(state.turn);
    ballY = 50;
  }

  const paddleY = (m: Marker): number => {
    if (inFlight && serve) {
      return m === other(state.turn) ? posPct(serve.angle) : 50;
    }
    if (state.phase === "match_over" && last) {
      const server = last.good ? other(last.winner) : last.winner;
      const returner = last.good ? last.winner : other(last.winner);
      if (m === server) return posPct(last.serve.angle);
      if (m === returner) return posPct(-last.ret.angle);
    }
    return 50;
  };

  const isMyServe =
    !isWaiting &&
    !isMatchOver &&
    (state.phase === "serve" || state.phase === "point_over") &&
    state.turn === myMarker;
  const isMyReturn =
    !isWaiting && !isMatchOver && state.phase === "return" && state.turn === myMarker;
  const angleMin = isMyServe ? -SERVE_ANGLE_MAX : -RETURN_ANGLE_MAX;
  const angleMax = isMyServe ? SERVE_ANGLE_MAX : RETURN_ANGLE_MAX;
  const myTurn = isMyServe || isMyReturn;

  // When it's your return, pre-fill the ideal mirror angle so one-tap works.
  useEffect(() => {
    if (isMyReturn && serve) {
      const ideal = snapAngle(-serve.angle, -RETURN_ANGLE_MAX, RETURN_ANGLE_MAX);
      setAngle(ideal);
      setPower(1); // Soft is safest / widest window
    } else if (isMyServe) {
      setAngle(0);
      setPower(1);
    }
  }, [isMyReturn, isMyServe, serve?.angle, state.phase, state.turn]);

  const myScore = state.scores[myMarker];
  const oppScore = state.scores[opponent];

  // Ideal return target (for the hint line)
  const idealReturn =
    isMyReturn && serve
      ? snapAngle(-serve.angle, -RETURN_ANGLE_MAX, RETURN_ANGLE_MAX)
      : null;

  let statusText: string;
  if (isWaiting) {
    statusText = "Waiting for your friend to join…";
  } else if (isMatchOver) {
    statusText =
      state.matchWinner === myMarker
        ? "You win the match!"
        : "Your friend wins the match";
  } else if (state.phase === "return") {
    statusText =
      state.turn === myMarker
        ? `Ball coming at ${signed(serve?.angle ?? 0)}° — aim near ${signed(idealReturn ?? 0)}°`
        : "Your serve is in flight — waiting for their return…";
  } else if (state.phase === "point_over") {
    statusText =
      last?.winner === myMarker
        ? "You took the point — serve next"
        : "Point to your friend — they serve next";
  } else {
    statusText =
      state.turn === myMarker
        ? "Your serve — pick angle & power, then hit Serve"
        : "Waiting for your friend to serve…";
  }

  const handleShot = async () => {
    if (submitting) return;
    setSubmitting(true);
    await onShot(angle, power);
    setSubmitting(false);
  };

  return (
    <>
      {/* Status line */}
      <div className="flex items-center justify-center gap-2 text-center">
        <span
          className={cn(
            "size-2 rounded-full",
            isWaiting || isMatchOver || myTurn
              ? "animate-pulse bg-primary"
              : "bg-muted-foreground/40",
          )}
        />
        <p className="text-sm font-semibold text-muted-foreground">
          {statusText}
        </p>
      </div>

      {/* Score bar */}
      <div className="mx-auto mt-5 flex w-full max-w-sm items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
        <span
          className={cn(
            "text-sm font-black",
            myScore > oppScore ? "text-primary" : "text-foreground",
          )}
        >
          You {myScore}
        </span>
        <span className="text-xs font-semibold text-muted-foreground">
          {isMatchOver ? "Match over" : `First to ${PONG_TARGET}`}
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

      {/* The court */}
      <div
        className={cn(
          "relative mx-auto mt-5 w-full max-w-sm overflow-hidden rounded-3xl border-2 border-[#1A1A1A] bg-[#FFF9E5] shadow-lift ring-1 ring-black/5",
          isWaiting && "opacity-60",
        )}
        style={{ aspectRatio: "7 / 4" }}
      >
        <div className="absolute inset-y-[6%] left-1/2 -translate-x-1/2 border-l-2 border-dashed border-[#1A1A1A]/25" />
        <div
          className="absolute left-[5%] h-[26%] w-[10px] rounded-full bg-[#1A1A1A] shadow-sm"
          style={{
            top: `calc(${paddleY("X")}% - 13%)`,
            transition: `top 500ms ${COURT_EASE}`,
          }}
        />
        <div
          className="absolute right-[5%] h-[26%] w-[10px] rounded-full bg-[#1A1A1A] shadow-sm"
          style={{
            top: `calc(${paddleY("O")}% - 13%)`,
            transition: `top 500ms ${COURT_EASE}`,
          }}
        />
        <div
          className={cn(
            "absolute size-[18px] rounded-full border-2 border-[#1A1A1A] bg-[#F5A623] shadow-[0_2px_14px_rgba(245,166,35,0.6)]",
            inFlight
              ? "animate-pong-glow"
              : state.phase === "match_over"
                ? ""
                : "animate-recess-bob",
          )}
          style={{
            left: `${ballX}%`,
            top: `calc(${ballY}% - 9px)`,
            transition: `left 950ms ${COURT_EASE}, top 950ms ${COURT_EASE}`,
          }}
        />
      </div>

      {/* Point reveal */}
      {resolved && last && (
        <div className="mx-auto mt-5 w-full max-w-sm rounded-3xl border border-primary/30 bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl bg-background py-3 shadow-chip">
              <span className="text-base font-black">{signed(last.serve.angle)}°</span>
              <span className="text-[11px] font-bold text-muted-foreground">
                Serve · {POWER_LABELS[last.serve.power]}
              </span>
            </div>
            <span className="text-lg font-black text-muted-foreground">vs</span>
            <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl bg-background py-3 shadow-chip">
              <span className="text-base font-black">{signed(last.ret.angle)}°</span>
              <span className="text-[11px] font-bold text-muted-foreground">
                Return · {POWER_LABELS[last.ret.power]}
              </span>
            </div>
          </div>
          <p className="mt-3 text-center text-sm font-bold">
            {last.winner === myMarker ? "Point to you." : "Point to your friend."}
          </p>
          <p className="mt-0.5 text-center text-xs text-muted-foreground">
            {last.good
              ? "Nice return — paddle found it."
              : "Missed the paddle that time."}
          </p>
          {!isMatchOver && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {state.turn === myMarker
                ? "Your serve — go again."
                : "Your friend serves next."}
            </p>
          )}
        </div>
      )}

      {/* Controls — only on your turn */}
      {(isMyServe || isMyReturn) && (
        <div
          key={`${state.phase}-${state.turn}`}
          className="mx-auto mt-5 w-full max-w-sm"
        >
          <div className="rounded-3xl border-2 border-border bg-card p-5 shadow-soft">
            {/* Angle */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">
                {isMyServe ? "Serve angle" : "Return angle"}
              </span>
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-sm font-black text-primary">
                {signed(angle)}°
              </span>
            </div>

            {isMyReturn && idealReturn !== null && (
              <p className="mt-1.5 text-center text-xs font-semibold text-primary">
                Best aim ≈ {signed(idealReturn)}° — already set for you
              </p>
            )}

            <Slider
              className="mt-4 [&_[data-slot=slider-thumb]]:size-6"
              min={angleMin}
              max={angleMax}
              step={5}
              value={[angle]}
              onValueChange={(v) => setAngle(v[0])}
              aria-label={isMyServe ? "Serve angle" : "Return angle"}
            />

            {/* Power — Soft is the default and widest window */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {POWER_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setPower(o.value)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-2xl border-2 px-2 py-3 transition-all",
                    power === o.value
                      ? "border-primary bg-primary/10 shadow-glow"
                      : "border-border bg-background shadow-soft hover:border-primary/40",
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-black",
                      power === o.value ? "text-primary" : "text-foreground",
                    )}
                  >
                    {o.label}
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {o.hint}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleShot}
              disabled={submitting}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-primary to-primary-deep py-3.5 text-base font-bold text-white shadow-btn-amber transition-all hover:scale-[1.02] hover:brightness-105 active:scale-95 disabled:opacity-60"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {isMyServe ? "Serve" : "Return"}
            </button>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              {isMyServe
                ? "Just pick an angle and hit Serve. Soft is easiest for your friend to return."
                : "Slider is already near the sweet spot. Soft = widest window. Hit Return."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
