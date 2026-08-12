import { useState } from "react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Pong play area — correspondence paddle tennis. Each point is two moves:
// the server picks a shot (angle + power), the returner sees the incoming
// ball (animated, never hidden) and picks a return. A return that mirrors
// the incoming angle within the window scores the returner; a miss scores
// the server. The point winner serves next; first to 7 points wins.
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

/** Points needed to win (mirrors PONG_TARGET in src/convex/gameLogic.ts). */
const PONG_TARGET = 7;
const SERVE_ANGLE_MAX = 60;
const RETURN_ANGLE_MAX = 45;

const POWER_OPTIONS: { value: PongPower; label: string; hint: string }[] = [
  { value: 1, label: "Lob", hint: "Wide window" },
  { value: 2, label: "Drive", hint: "Balanced" },
  { value: 3, label: "Smash", hint: "Narrow window" },
];

const POWER_LABELS: Record<PongPower, string> = {
  1: "Lob",
  2: "Drive",
  3: "Smash",
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

export default function PongPlay({ state, status, myMarker, onShot }: Props) {
  const [angle, setAngle] = useState(0);
  const [power, setPower] = useState<PongPower>(2);
  const [submitting, setSubmitting] = useState(false);

  const isWaiting = status === "waiting";
  const isMatchOver = state.matchWinner !== null;
  const opponent: Marker = other(myMarker);
  const serve = state.serve;
  const last = state.lastPoint;
  const inFlight = state.phase === "return" && serve !== null;
  const resolved = state.phase === "point_over" || state.phase === "match_over";

  // --- Court geometry (pure CSS transitions, no timers) --------------------
  // Ball: in flight it sits at the returner's side at the serve's height;
  // the match-over ball rests where the last point ended (on the returner's
  // paddle for a good return, at the wall beside it for a miss); otherwise it
  // parks with the next server at center, so the following serve animates
  // cleanly across the court.
  let ballX: number;
  let ballY: number;
  if (inFlight && serve) {
    ballX = sideX(state.turn); // turn is the returner while a shot is in flight
    ballY = posPct(serve.angle);
  } else if (state.phase === "match_over" && last) {
    const returner = last.good ? last.winner : other(last.winner);
    ballX = sideX(returner);
    ballY = last.good ? posPct(-last.ret.angle) : posPct(last.serve.angle);
  } else {
    ballX = sideX(state.turn); // resting with the next server (X serves first)
    ballY = 50;
  }

  // Paddles: the server's paddle sits at the launch spot; the returner's is
  // neutral while they choose, then where they actually swung (the mirror of
  // their return angle) once the match is over. Between points both return to
  // center, ready for the next serve.
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

  // --- Turn helpers ---------------------------------------------------------
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

  const myScore = state.scores[myMarker];
  const oppScore = state.scores[opponent];

  // Status line text
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
        ? `Incoming serve at ${signed(serve?.angle ?? 0)}° — return it!`
        : "Your serve is in flight — waiting for their return…";
  } else if (state.phase === "point_over") {
    statusText =
      last?.winner === myMarker
        ? "You took the point — serve next"
        : "Point to your friend — they serve next";
  } else {
    statusText =
      state.turn === myMarker
        ? "Your serve — pick an angle and power"
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
      <div className="mx-auto mt-5 flex w-full max-w-sm items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
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

      {/* The court — cream, ink outline, amber ball */}
      <div
        className={cn(
          "relative mx-auto mt-5 w-full max-w-sm overflow-hidden rounded-3xl border-2 border-[#1A1A1A] bg-[#FFF9E5] shadow-sm",
          isWaiting && "opacity-60",
        )}
        style={{ aspectRatio: "7 / 4" }}
      >
        {/* dashed center line */}
        <div className="absolute inset-y-[6%] left-1/2 -translate-x-1/2 border-l-2 border-dashed border-[#1A1A1A]/25" />
        {/* X's paddle (left) */}
        <div
          className="absolute left-[5%] h-[26%] w-[10px] rounded-full bg-[#1A1A1A] shadow-sm"
          style={{
            top: `calc(${paddleY("X")}% - 13%)`,
            transition: `top 500ms ${COURT_EASE}`,
          }}
        />
        {/* O's paddle (right) */}
        <div
          className="absolute right-[5%] h-[26%] w-[10px] rounded-full bg-[#1A1A1A] shadow-sm"
          style={{
            top: `calc(${paddleY("O")}% - 13%)`,
            transition: `top 500ms ${COURT_EASE}`,
          }}
        />
        {/* ball */}
        <div
          className="absolute size-[18px] rounded-full border-2 border-[#1A1A1A] bg-[#F5A623] shadow-sm"
          style={{
            left: `${ballX}%`,
            top: `calc(${ballY}% - 9px)`,
            transition: `left 800ms ${COURT_EASE}, top 800ms ${COURT_EASE}`,
          }}
        />
      </div>

      {/* Point reveal */}
      {resolved && last && (
        <div className="mx-auto mt-5 w-full max-w-sm rounded-3xl border-2 border-border bg-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl bg-background py-3">
              <span className="text-base font-black">{signed(last.serve.angle)}°</span>
              <span className="text-[11px] font-bold text-muted-foreground">
                Serve · {POWER_LABELS[last.serve.power]}
              </span>
            </div>
            <span className="text-lg font-black text-muted-foreground">vs</span>
            <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl bg-background py-3">
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
              ? "Clean return — it found the paddle."
              : "The return missed the paddle."}
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

      {/* Serve / return controls — only ever shown on the acting player's turn */}
      {(isMyServe || isMyReturn) && (
        // Keyed by phase+turn so the angle/power reset when a new turn starts.
        <div
          key={`${state.phase}-${state.turn}`}
          className="mx-auto mt-5 w-full max-w-sm"
        >
          <div className="rounded-3xl border-2 border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">
                {isMyServe ? "Serve angle" : "Return angle"}
              </span>
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-sm font-black text-primary">
                {signed(angle)}°
              </span>
            </div>
            <Slider
              className="mt-4 [&_[data-slot=slider-thumb]]:size-5"
              min={angleMin}
              max={angleMax}
              step={5}
              value={[angle]}
              onValueChange={(v) => setAngle(v[0])}
              aria-label={isMyServe ? "Serve angle" : "Return angle"}
            />
            <div className="mt-4 grid grid-cols-3 gap-2">
              {POWER_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setPower(o.value)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-2xl border-2 px-2 py-2.5 transition-all",
                    power === o.value
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:border-primary/40",
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
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {isMyServe ? "Serve" : "Return"}
            </button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {isMyServe
                ? "Harder serves shrink your friend's window to return."
                : "Mirror the incoming angle to return it — a smash cuts your own window."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
