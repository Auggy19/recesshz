/**
 * Vertical Pong — correspondence play with responsive bounce preview
 * and simple left / right aim controls (touch + keyboard).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

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
  remoteAim?: number | null;
  onAimChange?: (angle: number) => void;
  liveConnected?: boolean;
}

const PONG_TARGET = 7;
const SERVE_ANGLE_MAX = 60;
const RETURN_ANGLE_MAX = 45;
const ANGLE_STEP = 5;

const POWER_OPTIONS: { value: PongPower; label: string; hint: string }[] = [
  { value: 1, label: "Soft", hint: "Wide" },
  { value: 2, label: "Med", hint: "Balanced" },
  { value: 3, label: "Hard", hint: "Fast" },
];

const POWER_LABELS: Record<PongPower, string> = {
  1: "Soft",
  2: "Medium",
  3: "Hard",
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const posX = (angle: number) => clamp(50 + angle * 0.55, 8, 92);
const signed = (a: number) => `${a > 0 ? "+" : ""}${a}`;
const other = (m: Marker): Marker => (m === "X" ? "O" : "X");

function snapAngle(a: number, min: number, max: number) {
  return clamp(Math.round(a / ANGLE_STEP) * ANGLE_STEP, min, max);
}

function speedForPower(power: PongPower): number {
  return 0.55 + power * 0.22;
}

type BounceSim = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
};

/** Walls invert vx with acceleration; paddles invert vy with acceleration + aim bias. */
function stepBounce(
  s: BounceSim,
  dt: number,
  paddleTop: number,
  paddleBot: number,
): BounceSim {
  let { x, y, vx, vy, speed } = s;
  x += vx * speed * dt * 60;
  y += vy * speed * dt * 60;

  if (x <= 6) {
    x = 6;
    vx = Math.abs(vx);
    speed = Math.min(speed * 1.08, 2.4);
  } else if (x >= 94) {
    x = 94;
    vx = -Math.abs(vx);
    speed = Math.min(speed * 1.08, 2.4);
  }

  if (y <= 10) {
    y = 10;
    vy = Math.abs(vy);
    const offset = (x - paddleTop) / 20;
    vx = clamp(vx + offset * 0.35, -1.2, 1.2);
    speed = Math.min(speed * 1.12, 2.6);
  } else if (y >= 90) {
    y = 90;
    vy = -Math.abs(vy);
    const offset = (x - paddleBot) / 20;
    vx = clamp(vx + offset * 0.35, -1.2, 1.2);
    speed = Math.min(speed * 1.12, 2.6);
  }

  const mag = Math.hypot(vx, vy) || 1;
  vx /= mag;
  vy /= mag;
  return { x, y, vx, vy, speed };
}

export default function PongPlay({
  state,
  status,
  myMarker,
  onShot,
  remoteAim = null,
  onAimChange,
  liveConnected = false,
}: Props) {
  const [angle, setAngle] = useState(0);
  const [power, setPower] = useState<PongPower>(2);
  const [submitting, setSubmitting] = useState(false);
  const [ball, setBall] = useState({ x: 50, y: 50 });
  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const simRef = useRef<BounceSim | null>(null);
  const lastPhase = useRef(state.phase);

  const isWaiting = status === "waiting";
  const isMatchOver = state.matchWinner !== null;
  const opponent: Marker = other(myMarker);
  const serve = state.serve;
  const last = state.lastPoint;
  const inFlight = state.phase === "return" && serve !== null;
  const resolved = state.phase === "point_over" || state.phase === "match_over";

  const myScore = state.scores[myMarker];
  const oppScore = state.scores[opponent];

  const isMyServe =
    (state.phase === "serve" || state.phase === "point_over") &&
    state.turn === myMarker &&
    !isMatchOver;
  const isMyReturn =
    !isWaiting &&
    !isMatchOver &&
    state.phase === "return" &&
    state.turn === myMarker;
  const myTurn = isMyServe || isMyReturn;
  const angleMin = isMyServe ? -SERVE_ANGLE_MAX : -RETURN_ANGLE_MAX;
  const angleMax = isMyServe ? SERVE_ANGLE_MAX : RETURN_ANGLE_MAX;

  const idealReturn =
    isMyReturn && serve
      ? snapAngle(-serve.angle, -RETURN_ANGLE_MAX, RETURN_ANGLE_MAX)
      : null;

  useEffect(() => {
    onAimChange?.(angle);
  }, [angle, onAimChange]);

  useEffect(() => {
    if (isMyReturn && idealReturn !== null) setAngle(idealReturn);
  }, [isMyReturn, idealReturn]);

  const nudge = useCallback(
    (dir: -1 | 1) => {
      if (!myTurn) return;
      setAngle((a) => snapAngle(a + dir * ANGLE_STEP, angleMin, angleMax));
    },
    [myTurn, angleMin, angleMax],
  );

  const startHold = useCallback(
    (dir: -1 | 1) => {
      nudge(dir);
      if (holdRef.current) clearInterval(holdRef.current);
      holdRef.current = setInterval(() => nudge(dir), 90);
    },
    [nudge],
  );

  const stopHold = useCallback(() => {
    if (holdRef.current) {
      clearInterval(holdRef.current);
      holdRef.current = null;
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!myTurn) return;
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        nudge(-1);
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        nudge(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [myTurn, nudge]);

  useEffect(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const phaseChanged = lastPhase.current !== state.phase;
    lastPhase.current = state.phase;

    if (state.phase === "return" && serve) {
      const startY = other(state.turn) === "X" ? 12 : 88;
      const endY = state.turn === "X" ? 12 : 88;
      const startX = posX(serve.angle);
      simRef.current = {
        x: startX,
        y: startY,
        vx: serve.angle / 60,
        vy: endY > startY ? 1 : -1,
        speed: speedForPower(serve.power),
      };
      setBall({ x: startX, y: startY });

      let prev = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(0.05, (now - prev) / 1000);
        prev = now;
        if (!simRef.current) return;
        const paddleTop = posX(serve.angle);
        const paddleBot = posX(angle);
        simRef.current = stepBounce(simRef.current, dt, paddleTop, paddleBot);
        setBall({ x: simRef.current.x, y: simRef.current.y });
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    if (state.phase === "point_over" && last && phaseChanged) {
      const good = last.good;
      simRef.current = {
        x: posX(last.serve.angle),
        y: 50,
        vx: (last.ret.angle - last.serve.angle) / 80,
        vy: good ? (Math.random() > 0.5 ? 1 : -1) : 1,
        speed: speedForPower(last.serve.power) * (good ? 1.2 : 0.7),
      };
      let frames = 0;
      let prev = performance.now();
      const tick = (now: number) => {
        frames++;
        const dt = Math.min(0.05, (now - prev) / 1000);
        prev = now;
        if (!simRef.current || frames > 90) {
          setBall({
            x: good ? posX(-last.ret.angle) : posX(last.serve.angle),
            y: good ? 50 : last.winner === "X" ? 88 : 12,
          });
          return;
        }
        simRef.current = stepBounce(
          simRef.current,
          dt,
          posX(last.serve.angle),
          posX(-last.ret.angle),
        );
        setBall({ x: simRef.current.x, y: simRef.current.y });
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    if (state.phase === "serve" || state.phase === "point_over") {
      setBall({ x: 50, y: state.turn === "X" ? 18 : 82 });
    } else if (state.phase === "match_over" && last) {
      setBall({
        x: last.good ? posX(-last.ret.angle) : posX(last.serve.angle),
        y: 50,
      });
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [state.phase, serve, last, angle, state.turn]);

  const paddleX = (m: Marker): number => {
    if (inFlight && serve) {
      if (m === other(state.turn)) return posX(serve.angle);
      if (m === myMarker && myTurn) return posX(angle);
      if (m === opponent && remoteAim != null) return posX(remoteAim);
      return 50;
    }
    if (myTurn && m === myMarker) return posX(angle);
    if (m === opponent && remoteAim != null) return posX(remoteAim);
    return 50;
  };

  let statusText: string;
  if (isWaiting) statusText = "Waiting for your friend to join…";
  else if (isMatchOver)
    statusText =
      state.matchWinner === myMarker
        ? "You win the match!"
        : "Your friend wins the match";
  else if (state.phase === "return")
    statusText =
      state.turn === myMarker
        ? `Incoming — aim near ${signed(idealReturn ?? 0)}°`
        : "Ball in flight — waiting for their return…";
  else if (state.phase === "point_over")
    statusText =
      last?.winner === myMarker
        ? "You took the point — serve next"
        : "Point to your friend — they serve next";
  else
    statusText =
      state.turn === myMarker
        ? "Your serve — move left/right, pick power"
        : "Waiting for your friend to serve…";

  const handleShot = async () => {
    if (submitting || !myTurn) return;
    setSubmitting(true);
    await onShot(angle, power);
    setSubmitting(false);
  };

  const topIsMe = myMarker === "X";

  return (
    <>
      <div className="flex items-center justify-center gap-2 px-2 text-center">
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

      <div className="mx-auto mt-4 flex w-full max-w-sm items-center justify-between rounded-2xl border border-border bg-card px-4 py-2.5 shadow-soft">
        <span className={cn("text-sm font-black", myScore > oppScore && "text-primary")}>
          You {myScore}
        </span>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {isMatchOver ? "Match over" : `First to ${PONG_TARGET}`}
        </span>
        <span className={cn("text-sm font-black", oppScore > myScore && "text-primary")}>
          Friend {oppScore}
        </span>
      </div>

      <div
        className="relative mx-auto mt-4 w-full max-w-[min(100%,280px)] overflow-hidden rounded-3xl border-2 border-[#1A1A1A] bg-[#FFF9E5] shadow-lift dark:bg-amber-950/40"
        style={{ aspectRatio: "3 / 4" }}
        role="img"
        aria-label="Pong court"
      >
        <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-[#1A1A1A]/25" />

        <div
          className="absolute h-[10px] w-[28%] max-w-[72px] -translate-x-1/2 rounded-full bg-[#1A1A1A] shadow-md transition-[left] duration-100"
          style={{
            left: `${paddleX(opponent)}%`,
            ...(topIsMe ? { bottom: "5%" } : { top: "5%" }),
          }}
        />

        <div
          className="absolute h-[10px] w-[28%] max-w-[72px] -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-primary-deep shadow-[0_2px_10px_rgba(245,166,35,0.45)] transition-[left] duration-75"
          style={{
            left: `${paddleX(myMarker)}%`,
            ...(topIsMe ? { top: "5%" } : { bottom: "5%" }),
          }}
        />

        {liveConnected && remoteAim != null && (
          <div
            className="absolute h-[8px] w-[22%] max-w-[56px] -translate-x-1/2 rounded-full border-2 border-emerald-500/60 bg-emerald-400/30"
            style={{
              left: `${posX(remoteAim)}%`,
              ...(opponent === "X" ? { top: "4%" } : { bottom: "4%" }),
              transition: "left 80ms linear",
            }}
            title="Friend's live aim"
          />
        )}

        <div
          className={cn(
            "absolute size-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#1A1A1A] bg-[#F5A623] shadow-[0_2px_12px_rgba(245,166,35,0.55)] sm:size-[16px]",
            inFlight && "animate-pong-glow",
          )}
          style={{
            left: `${ball.x}%`,
            top: `${ball.y}%`,
            willChange: "left, top",
          }}
        />
      </div>

      {resolved && last && (
        <div className="mx-auto mt-4 w-full max-w-sm rounded-3xl border border-primary/30 bg-card p-4 shadow-soft">
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
            {last.good ? "Clean return — paddle found it." : "Missed the window."}
          </p>
        </div>
      )}

      {myTurn && (
        <div className="mx-auto mt-4 w-full max-w-sm rounded-3xl border border-border bg-card p-4 shadow-soft">
          <p className="text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Aim {signed(angle)}°
          </p>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              aria-label="Aim left"
              onPointerDown={(e) => {
                e.preventDefault();
                startHold(-1);
              }}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-border bg-background text-foreground shadow-soft active:scale-95 active:border-primary sm:h-12 sm:w-12"
            >
              <ChevronLeft className="size-7 sm:size-6" strokeWidth={2.5} />
            </button>

            <div className="relative h-3 flex-1 rounded-full bg-muted">
              <div
                className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#1A1A1A] bg-primary shadow-md transition-[left] duration-75"
                style={{
                  left: `${((angle - angleMin) / (angleMax - angleMin || 1)) * 100}%`,
                }}
              />
            </div>

            <button
              type="button"
              aria-label="Aim right"
              onPointerDown={(e) => {
                e.preventDefault();
                startHold(1);
              }}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-border bg-background text-foreground shadow-soft active:scale-95 active:border-primary sm:h-12 sm:w-12"
            >
              <ChevronRight className="size-7 sm:size-6" strokeWidth={2.5} />
            </button>
          </div>

          <div className="mt-1 flex justify-between px-1 text-[10px] font-semibold text-muted-foreground">
            <span>Left</span>
            <span className="hidden sm:inline">← → keys</span>
            <span>Right</span>
          </div>

          {isMyReturn && idealReturn !== null && (
            <p className="mt-2 text-center text-xs font-semibold text-primary">
              Best aim ≈ {signed(idealReturn)}°
            </p>
          )}

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
        </div>
      )}
    </>
  );
}
