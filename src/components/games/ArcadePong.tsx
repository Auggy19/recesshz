/**
 * Real-time vertical arcade Pong for Solo vs AI.
 * Continuous paddle control, wall/paddle bounce acceleration, difficulty-scaled AI.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Difficulty } from "@/lib/design-tokens";
import { playCelebration } from "@/lib/celebration";

const TARGET = 7;
const COURT_W = 100;
const COURT_H = 100;
const PADDLE_W = 22;
const PADDLE_H = 2.8;
const BALL_R = 1.8;
const BASE_SPEED = 38;
const MAX_SPEED = 95;
const ACCEL_WALL = 1.06;
const ACCEL_PADDLE = 1.12;

type Props = {
  difficulty: Difficulty;
  onMatchEnd?: (won: boolean) => void;
};

type Phase = "ready" | "playing" | "point" | "match";

function aiSpeed(d: Difficulty) {
  if (d === "beginner") return 28;
  if (d === "expert") return 55;
  return 40;
}
function aiError(d: Difficulty) {
  if (d === "beginner") return 14;
  if (d === "expert") return 3;
  return 8;
}
function aiReaction(d: Difficulty) {
  if (d === "beginner") return 0.35;
  if (d === "expert") return 0.85;
  return 0.55;
}

export function ArcadePong({ difficulty, onMatchEnd }: Props) {
  const [score, setScore] = useState({ you: 0, ai: 0 });
  const [phase, setPhase] = useState<Phase>("ready");
  const [message, setMessage] = useState("Tap or press Space to serve");
  const canvasRef = useRef<HTMLDivElement>(null);

  const sim = useRef({
    youX: 50,
    aiX: 50,
    ballX: 50,
    ballY: 50,
    vx: 0,
    vy: 0,
    speed: BASE_SPEED,
    keys: { left: false, right: false },
    touchDir: 0 as -1 | 0 | 1,
    phase: "ready" as Phase,
    scoreYou: 0,
    scoreAi: 0,
    difficulty,
  });

  const [frame, setFrame] = useState(0);

  useEffect(() => {
    sim.current.difficulty = difficulty;
  }, [difficulty]);

  const resetBall = useCallback((towardYou: boolean) => {
    const s = sim.current;
    s.ballX = 50;
    s.ballY = 50;
    s.speed = BASE_SPEED;
    const angle = (Math.random() * 0.6 - 0.3) * Math.PI;
    s.vx = Math.sin(angle);
    s.vy = (towardYou ? 1 : -1) * Math.cos(angle);
    const mag = Math.hypot(s.vx, s.vy) || 1;
    s.vx /= mag;
    s.vy /= mag;
  }, []);

  const startPoint = useCallback(() => {
    const s = sim.current;
    if (s.phase === "match") return;
    s.phase = "playing";
    setPhase("playing");
    setMessage("");
    resetBall(Math.random() > 0.5);
  }, [resetBall]);

  const award = useCallback(
    (to: "you" | "ai") => {
      const s = sim.current;
      if (to === "you") s.scoreYou += 1;
      else s.scoreAi += 1;
      setScore({ you: s.scoreYou, ai: s.scoreAi });

      if (s.scoreYou >= TARGET || s.scoreAi >= TARGET) {
        s.phase = "match";
        setPhase("match");
        const won = s.scoreYou >= TARGET;
        setMessage(won ? "You win!" : "AI wins");
        void playCelebration(won ? "win" : "loss");
        onMatchEnd?.(won);
        return;
      }

      s.phase = "point";
      setPhase("point");
      setMessage(to === "you" ? "Point!" : "AI scored");
      void playCelebration("point");
      s.ballX = 50;
      s.ballY = 50;
      s.vx = 0;
      s.vy = 0;
      window.setTimeout(() => {
        if (sim.current.phase === "point") startPoint();
      }, 900);
    },
    [onMatchEnd, startPoint],
  );

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const s = sim.current;
      const d = s.difficulty;

      const playerSpeed = 70;
      let move = 0;
      if (s.keys.left) move -= 1;
      if (s.keys.right) move += 1;
      if (s.touchDir) move = s.touchDir;
      s.youX = Math.max(
        PADDLE_W / 2,
        Math.min(COURT_W - PADDLE_W / 2, s.youX + move * playerSpeed * dt),
      );

      if (s.phase === "playing") {
        const target =
          s.ballX + (Math.random() - 0.5) * aiError(d) * (s.vy < 0 ? 1 : 0.3);
        const react = aiReaction(d);
        const desired = s.aiX + (target - s.aiX) * react * dt * 8;
        const maxStep = aiSpeed(d) * dt;
        const delta = Math.max(-maxStep, Math.min(maxStep, desired - s.aiX));
        s.aiX = Math.max(
          PADDLE_W / 2,
          Math.min(COURT_W - PADDLE_W / 2, s.aiX + delta),
        );
      }

      if (s.phase === "playing") {
        s.ballX += s.vx * s.speed * dt;
        s.ballY += s.vy * s.speed * dt;

        if (s.ballX - BALL_R <= 0) {
          s.ballX = BALL_R;
          s.vx = Math.abs(s.vx);
          s.speed = Math.min(MAX_SPEED, s.speed * ACCEL_WALL);
        } else if (s.ballX + BALL_R >= COURT_W) {
          s.ballX = COURT_W - BALL_R;
          s.vx = -Math.abs(s.vx);
          s.speed = Math.min(MAX_SPEED, s.speed * ACCEL_WALL);
        }

        const aiTop = 4;
        const aiBot = aiTop + PADDLE_H;
        if (
          s.vy < 0 &&
          s.ballY - BALL_R <= aiBot &&
          s.ballY + BALL_R >= aiTop &&
          s.ballX >= s.aiX - PADDLE_W / 2 - BALL_R &&
          s.ballX <= s.aiX + PADDLE_W / 2 + BALL_R
        ) {
          s.ballY = aiBot + BALL_R;
          s.vy = Math.abs(s.vy);
          const offset = (s.ballX - s.aiX) / (PADDLE_W / 2);
          s.vx = Math.max(-0.95, Math.min(0.95, s.vx + offset * 0.55));
          const mag = Math.hypot(s.vx, s.vy) || 1;
          s.vx /= mag;
          s.vy /= mag;
          s.speed = Math.min(MAX_SPEED, s.speed * ACCEL_PADDLE);
        }

        const youBot = 96;
        const youTop = youBot - PADDLE_H;
        if (
          s.vy > 0 &&
          s.ballY + BALL_R >= youTop &&
          s.ballY - BALL_R <= youBot &&
          s.ballX >= s.youX - PADDLE_W / 2 - BALL_R &&
          s.ballX <= s.youX + PADDLE_W / 2 + BALL_R
        ) {
          s.ballY = youTop - BALL_R;
          s.vy = -Math.abs(s.vy);
          const offset = (s.ballX - s.youX) / (PADDLE_W / 2);
          s.vx = Math.max(-0.95, Math.min(0.95, s.vx + offset * 0.55));
          const mag = Math.hypot(s.vx, s.vy) || 1;
          s.vx /= mag;
          s.vy /= mag;
          s.speed = Math.min(MAX_SPEED, s.speed * ACCEL_PADDLE);
        }

        if (s.ballY < -2) {
          award("you");
        } else if (s.ballY > COURT_H + 2) {
          award("ai");
        }
      }

      setFrame((f) => (f + 1) % 100000);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [award]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        sim.current.keys.left = true;
      }
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        sim.current.keys.right = true;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (sim.current.phase === "ready" || sim.current.phase === "point") {
          startPoint();
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A")
        sim.current.keys.left = false;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D")
        sim.current.keys.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [startPoint]);

  const onPointer = (dir: -1 | 0 | 1) => {
    sim.current.touchDir = dir;
  };

  const resetMatch = () => {
    const s = sim.current;
    s.scoreYou = 0;
    s.scoreAi = 0;
    s.youX = 50;
    s.aiX = 50;
    s.ballX = 50;
    s.ballY = 50;
    s.vx = 0;
    s.vy = 0;
    s.speed = BASE_SPEED;
    s.phase = "ready";
    setScore({ you: 0, ai: 0 });
    setPhase("ready");
    setMessage("Tap or press Space to serve");
  };

  const s = sim.current;
  void frame;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm font-bold">
        <span className={cn(score.you > score.ai && "text-primary")}>
          You {score.you}
        </span>
        <span className="text-xs font-semibold text-muted-foreground">
          First to {TARGET}
        </span>
        <span className={cn(score.ai > score.you && "text-primary")}>
          AI {score.ai}
        </span>
      </div>

      <div
        ref={canvasRef}
        className="relative mx-auto w-full max-w-[min(100%,320px)] touch-none select-none overflow-hidden rounded-3xl border-2 border-[#1A1A1A] bg-[#FFF9E5] shadow-lift dark:bg-amber-950/40"
        style={{ aspectRatio: "3 / 4" }}
        onPointerDown={() => {
          if (phase === "ready" || phase === "point") startPoint();
        }}
      >
        <div className="pointer-events-none absolute inset-x-4 top-1/2 h-px -translate-y-1/2 border-t-2 border-dashed border-[#1A1A1A]/30" />

        <div
          className="absolute h-[2.8%] rounded-full bg-[#1A1A1A] shadow-md"
          style={{
            width: `${PADDLE_W}%`,
            left: `${s.aiX - PADDLE_W / 2}%`,
            top: "4%",
          }}
        />

        <div
          className="absolute h-[2.8%] rounded-full bg-gradient-to-r from-primary to-primary-deep shadow-[0_2px_12px_rgba(245,166,35,0.5)]"
          style={{
            width: `${PADDLE_W}%`,
            left: `${s.youX - PADDLE_W / 2}%`,
            bottom: "4%",
          }}
        />

        <div
          className="absolute rounded-full border-2 border-[#1A1A1A] bg-[#F5A623] shadow-[0_2px_14px_rgba(245,166,35,0.6)]"
          style={{
            width: `${BALL_R * 2}%`,
            height: `${BALL_R * 2 * 0.75}%`,
            left: `${s.ballX - BALL_R}%`,
            top: `${s.ballY - BALL_R}%`,
          }}
        />

        {message && phase !== "playing" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
            <p className="rounded-full bg-[#1A1A1A]/90 px-4 py-2 text-sm font-bold text-white shadow-lg">
              {message}
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          aria-label="Move left"
          onPointerDown={(e) => {
            e.preventDefault();
            onPointer(-1);
          }}
          onPointerUp={() => onPointer(0)}
          onPointerLeave={() => onPointer(0)}
          onPointerCancel={() => onPointer(0)}
          className="flex h-16 flex-1 items-center justify-center rounded-2xl border-2 border-border bg-card text-lg font-black shadow-soft active:scale-[0.98] active:border-primary"
        >
          ← Left
        </button>
        <button
          type="button"
          aria-label="Move right"
          onPointerDown={(e) => {
            e.preventDefault();
            onPointer(1);
          }}
          onPointerUp={() => onPointer(0)}
          onPointerLeave={() => onPointer(0)}
          onPointerCancel={() => onPointer(0)}
          className="flex h-16 flex-1 items-center justify-center rounded-2xl border-2 border-border bg-card text-lg font-black shadow-soft active:scale-[0.98] active:border-primary"
        >
          Right →
        </button>
      </div>

      <div className="flex gap-2">
        {phase === "ready" || phase === "point" ? (
          <button
            type="button"
            onClick={startPoint}
            className="flex-1 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-700 py-3 text-sm font-bold text-white shadow-soft"
          >
            {phase === "ready" ? "Serve" : "Next point"}
          </button>
        ) : phase === "match" ? (
          <button
            type="button"
            onClick={resetMatch}
            className="flex-1 rounded-full bg-gradient-to-b from-primary to-primary-deep py-3 text-sm font-bold text-white shadow-btn-amber"
          >
            Play again
          </button>
        ) : (
          <p className="flex-1 text-center text-xs font-semibold text-muted-foreground">
            Hold Left / Right · Arrow keys on desktop
          </p>
        )}
        {(phase === "playing" || phase === "match") && (
          <button
            type="button"
            onClick={resetMatch}
            className="rounded-full border border-border px-4 py-3 text-xs font-bold"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
