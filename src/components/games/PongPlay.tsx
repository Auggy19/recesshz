import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Pong — vertical correspondence paddle tennis (mobile-first).
//
// Court is portrait: paddles at TOP (X) and BOTTOM (O). Ball travels up/down.
// Angle controls left ↔ right deviation. Soft/Medium/Hard power still tunes
// the return window (kept generous). First to 7 wins.
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

const POWER_OPTIONS: { value: PongPower; label: string; hint: string }[] = [
  { value: 1, label: "Soft", hint: "Widest" },
  { value: 2, label: "Medium", hint: "Balanced" },
  { value: 3, label: "Hard", hint: "Tighter" },
];

const POWER_LABELS: Record<PongPower, string> = {
  1: "Soft",
  2: "Medium",
  3: "Hard",
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** Angle → horizontal position on the vertical court (percent 0–100). */
const posX = (angle: number) => clamp(50 + angle * 0.55, 8, 92);

/** Vertical side: X plays TOP, O plays BOTTOM. */
const sideY = (m: Marker) => (m === "X" ? 8 : 88);

const signed = (a: number) => `${a > 0 ? "+" : ""}${a}`;

const other = (m: Marker): Marker => (m === "X" ? "O" : "X");

const COURT_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function snapAngle(a: number, min: number, max: number) {
  const stepped = Math.round(a / 5) * 5;
  return clamp(stepped, min, max);
}

export default function PongPlay({ state, status, myMarker, onShot }: Props) {
  const [angle, setAngle] = useState(0);
  const [power, setPower] = useState<PongPower>(1);
  const [submitting, setSubmitting] = useState(false);

  const isWaiting = status === "waiting";
  const isMatchOver = state.matchWinner !== null;
  const opponent: Marker = other(myMarker);
  const serve = state.serve;
  const last = state.lastPoint;
  const inFlight = state.phase === "return" && serve !== null;
  const resolved = state.phase === "point_over" || state.phase === "match_over";

  // --- Vertical court geometry ---------------------------------------------
  // Ball travels TOP ↔ BOTTOM. Angle controls LEFT ↔ RIGHT.
  let ballX: number;
  let ballY: number;

  if (inFlight && serve) {
    // Ball has arrived at the returner's end, offset by serve angle
    ballY = sideY(state.turn);
    ballX = posX(serve.angle);
  } else if (state.phase === "match_over" && last) {
    const returner = last.good ? last.winner : other(last.winner);
    ballY = sideY(returner);
    ballX = last.good ? posX(-last.ret.angle) : posX(last.serve.angle);
  } else {
    // Parked with the next server, centered
    ballY = sideY(state.turn);
    ballX = 50;
  }

  // Paddle horizontal position (they slide left/right)
  const paddleX = (m: Marker): number => {
    if (inFlight && serve) {
      // Server's paddle stays at launch spot; returner's is neutral until they swing
      return m === other(state.turn) ? posX(serve.angle) : 50;
    }
    if (state.phase === "match_over" && last) {
      const server = last.good ? other(last.winner) : last.winner;
      const returner = last.good ? last.winner : other(last.winner);
      if (m === server) return posX(last.serve.angle);
      if (m === returner) return posX(-last.ret.angle);
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

  // Auto-aim the ideal mirror on return turns
  useEffect(() => {
    if (isMyReturn && serve) {
      const ideal = snapAngle(-serve.angle, -RETURN_ANGLE_MAX, RETURN_ANGLE_MAX);
      setAngle(ideal);
      setPower(1);
    } else if (isMyServe) {
      setAngle(0);
      setPower(1);
    }
  }, [isMyReturn, isMyServe, serve?.angle, state.phase, state.turn]);

  const myScore = state.scores[myMarker];
  const oppScore = state.scores[opponent];

  const idealReturn =
    isMyReturn && serve
      ? snapAngle(-serve.angle, -RETURN_ANGLE_MAX, RETURN_ANGLE_MAX)
      : null;

  // Live preview of where the player's paddle will be
  const previewX = myTurn ? posX(angle) : null;

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
        ? `Incoming at ${signed(serve?.angle ?? 0)}° — aim near ${signed(idealReturn ?? 0)}°`
        : "Ball in flight — waiting for their return…";
  } else if (state.phase === "point_over") {
    statusText =
      last?.winner === myMarker
        ? "You took the point — serve next"
        : "Point to your friend — they serve next";
  } else {
    statusText =
      state.turn === myMarker
        ? "Your serve — aim left/right, pick power, hit Serve"
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
      {/* Status */}
      <div className="flex items-center justify-center gap-2 text-center px-2">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            isWaiting || isMatchOver || myTurn
              ? "animate-pulse bg-primary"
              : "bg-muted-foreground/40",
          )}
        />
        <p className="text-sm font-semibold text-muted-foreground">{statusText}</p>
      </div>

      {/* Score */}
      <div className="mx-auto mt-4 flex w-full max-w-[280px] items-center justify-between rounded-2xl border border-border bg-card px-4 py-2.5 shadow-soft">
        <span
          className={cn(
            "text-sm font-black",
            myScore > oppScore ? "text-primary" : "text-foreground",
          )}
        >
          You {myScore}
        </span>
        <span className="text-[11px] font-semibold text-muted-foreground">
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

      {/* ========== VERTICAL COURT ========== */}
      <div
        className={cn(
          "relative mx-auto mt-4 w-full max-w-[240px] overflow-hidden rounded-3xl border-2 border-[#1A1A1A] bg-[#FFF9E5] shadow-lift ring-1 ring-black/5",
          isWaiting && "opacity-60",
        )}
        style={{ aspectRatio: "4 / 7" }}
      >
        {/* Center dashed line (horizontal now) */}
        <div className="absolute inset-x-[8%] top-1/2 -translate-y-1/2 border-t-2 border-dashed border-[#1A1A1A]/25" />

        {/* Top paddle (X) — slides left/right */}
        <div
          className="absolute top-[4%] h-[10px] w-[28%] rounded-full bg-[#1A1A1A] shadow-sm"
          style={{
            left: `calc(${paddleX("X")}% - 14%)`,
            transition: `left 500ms ${COURT_EASE}`,
          }}
        />

        {/* Bottom paddle (O) — slides left/right */}
        <div
          className="absolute bottom-[4%] h-[10px] w-[28%] rounded-full bg-[#1A1A1A] shadow-sm"
          style={{
            left: `calc(${paddleX("O")}% - 14%)`,
            transition: `left 500ms ${COURT_EASE}`,
          }}
        />

        {/* Live aim preview (ghost paddle) when it's your turn */}
        {myTurn && previewX !== null && (
          <div
            className="absolute h-[10px] w-[28%] rounded-full border-2 border-primary/60 bg-primary/20"
            style={{
              left: `calc(${previewX}% - 14%)`,
              ...(myMarker === "X"
                ? { top: "4%" }
                : { bottom: "4%" }),
              transition: `left 120ms linear`,
            }}
          />
        )}

        {/* Arrival marker when ball is in flight toward you */}
        {inFlight && serve && state.turn === myMarker && (
          <div
            className="absolute h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/50 bg-primary/15"
            style={{
              left: `${posX(serve.angle)}%`,
              top: myMarker === "X" ? "9%" : "91%",
            }}
          />
        )}

        {/* The ball */}
        <div
          className={cn(
            "absolute size-[16px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#1A1A1A] bg-[#F5A623] shadow-[0_2px_12px_rgba(245,166,35,0.55)]",
            inFlight
              ? "animate-pong-glow"
              : state.phase === "match_over"
                ? ""
                : "animate-recess-bob",
          )}
          style={{
            left: `${ballX}%`,
            top: `${ballY}%`,
            transition: `left 900ms ${COURT_EASE}, top 900ms ${COURT_EASE}`,
          }}
        />
      </div>

      {/* Point reveal */}
      {resolved && last && (
        <div className="mx-auto mt-4 w-full max-w-[280px] rounded-3xl border border-primary/30 bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl bg-background py-2.5 shadow-chip">
              <span className="text-sm font-black">{signed(last.serve.angle)}°</span>
              <span className="text-[10px] font-bold text-muted-foreground">
                Serve · {POWER_LABELS[last.serve.power]}
              </span>
            </div>
            <span className="text-base font-black text-muted-foreground">vs</span>
            <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl bg-background py-2.5 shadow-chip">
              <span className="text-sm font-black">{signed(last.ret.angle)}°</span>
              <span className="text-[10px] font-bold text-muted-foreground">
                Return · {POWER_LABELS[last.ret.power]}
              </span>
            </div>
          </div>
          <p className="mt-2.5 text-center text-sm font-bold">
            {last.winner === myMarker ? "Point to you." : "Point to your friend."}
          </p>
          <p className="mt-0.5 text-center text-xs text-muted-foreground">
            {last.good
              ? "Clean return — paddle found it."
              : "Missed the paddle that time."}
          </p>
          {!isMatchOver && (
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              {state.turn === myMarker
                ? "Your serve — go again."
                : "Your friend serves next."}
            </p>
          )}
        </div>
      )}

      {/* Controls */}
      {(isMyServe || isMyReturn) && (
        <div
          key={`${state.phase}-${state.turn}`}
          className="mx-auto mt-4 w-full max-w-[280px]"
        >
          <div className="rounded-3xl border-2 border-border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">
                {isMyServe ? "Aim left / right" : "Return aim"}
              </span>
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-sm font-black text-primary">
                {signed(angle)}°
              </span>
            </div>

            {isMyReturn && idealReturn !== null && (
              <p className="mt-1 text-center text-xs font-semibold text-primary">
                Best aim ≈ {signed(idealReturn)}° — already set
              </p>
            )}

            {/* Horizontal slider = left ↔ right on the vertical court */}
            <Slider
              className="mt-3 [&_[data-slot=slider-thumb]]:size-6"
              min={angleMin}
              max={angleMax}
              step={5}
              value={[angle]}
              onValueChange={(v) => setAngle(v[0])}
              aria-label={isMyServe ? "Serve aim" : "Return aim"}
            />

            <div className="mt-1 flex justify-between px-0.5 text-[10px] font-semibold text-muted-foreground">
              <span>← Left</span>
              <span>Center</span>
              <span>Right →</span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {POWER_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setPower(o.value)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-2xl border-2 px-1.5 py-2.5 transition-all",
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
              className="mt-3.5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-primary to-primary-deep py-3.5 text-base font-bold text-white shadow-btn-amber transition-all hover:scale-[1.02] hover:brightness-105 active:scale-95 disabled:opacity-60"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {isMyServe ? "Serve" : "Return"}
            </button>

            <p className="mt-2.5 text-center text-xs text-muted-foreground">
              {isMyServe
                ? "Slide to aim. Soft is easiest for your friend to return."
                : "Aim is pre-set near the sweet spot. Soft = widest window."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
