/**
 * Classic single-player Pong vs AI — fully client-side, Recess-branded.
 * Touch-drag / arrow keys. Fair AI with lag + error. First to 7.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Difficulty } from "@/lib/design-tokens";
import { playCelebration } from "@/lib/celebration";

const TARGET = 7;
const W = 100;
const H = 100;
const PW = 24;
const PH = 2.6;
const BR = 2.0;
const BASE = 36;
const MAX = 88;
const WALL_ACC = 1.05;
const PAD_ACC = 1.1;

type Phase = "ready" | "playing" | "point" | "match";

type Props = {
  difficulty?: Difficulty;
  onMatchEnd?: (won: boolean) => void;
};

function aiParams(d: Difficulty) {
  if (d === "beginner") return { speed: 26, pull: 0.32, noise: 16 };
  if (d === "expert") return { speed: 52, pull: 0.78, noise: 3.5 };
  return { speed: 38, pull: 0.52, noise: 9 };
}

export function ArcadePong({
  difficulty = "intermediate",
  onMatchEnd,
}: Props) {
  const [score, setScore] = useState({ you: 0, ai: 0 });
  const [phase, setPhase] = useState<Phase>("ready");
  const [msg, setMsg] = useState("Drag the court or use ← →");
  const [, setTick] = useState(0);
  const courtRef = useRef<HTMLDivElement>(null);

  const sim = useRef({
    youX: 50,
    aiX: 50,
    bx: 50,
    by: 50,
    vx: 0,
    vy: 0,
    speed: BASE,
    left: false,
    right: false,
    dragging: false,
    phase: "ready" as Phase,
    you: 0,
    ai: 0,
    difficulty,
  });

  useEffect(() => {
    sim.current.difficulty = difficulty;
  }, [difficulty]);

  const serveBall = useCallback((towardBottom: boolean) => {
    const s = sim.current;
    s.bx = 50;
    s.by = 50;
    s.speed = BASE;
    const ang = (Math.random() * 0.7 - 0.35) * Math.PI;
    s.vx = Math.sin(ang);
    s.vy = (towardBottom ? 1 : -1) * Math.abs(Math.cos(ang));
    const m = Math.hypot(s.vx, s.vy) || 1;
    s.vx /= m;
    s.vy /= m;
  }, []);

  const startPoint = useCallback(() => {
    const s = sim.current;
    if (s.phase === "match") return;
    s.phase = "playing";
    setPhase("playing");
    setMsg("");
    serveBall(Math.random() > 0.5);
  }, [serveBall]);

  const award = useCallback(
    (to: "you" | "ai") => {
      const s = sim.current;
      if (to === "you") s.you += 1;
      else s.ai += 1;
      setScore({ you: s.you, ai: s.ai });
      s.bx = 50;
      s.by = 50;
      s.vx = 0;
      s.vy = 0;

      if (s.you >= TARGET || s.ai >= TARGET) {
        s.phase = "match";
        setPhase("match");
        const won = s.you >= TARGET;
        setMsg(won ? "You win!" : "AI wins");
        void playCelebration(won ? "win" : "loss");
        onMatchEnd?.(won);
        return;
      }
      s.phase = "point";
      setPhase("point");
      setMsg(to === "you" ? "Point!" : "AI scored");
      void playCelebration("point");
      window.setTimeout(() => {
        if (sim.current.phase === "point") startPoint();
      }, 750);
    },
    [onMatchEnd, startPoint],
  );

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const s = sim.current;
      const ap = aiParams(s.difficulty);

      if (!s.dragging) {
        let m = 0;
        if (s.left) m -= 1;
        if (s.right) m += 1;
        s.youX = Math.max(PW / 2, Math.min(W - PW / 2, s.youX + m * 72 * dt));
      }

      if (s.phase === "playing") {
        const comingUp = s.vy < 0;
        const target =
          s.bx + (Math.random() - 0.5) * (comingUp ? ap.noise : ap.noise * 0.4);
        const pull = comingUp ? ap.pull : ap.pull * 0.25;
        const desired = s.aiX + (target - s.aiX) * pull;
        const step = Math.max(
          -ap.speed * dt,
          Math.min(ap.speed * dt, desired - s.aiX),
        );
        s.aiX = Math.max(PW / 2, Math.min(W - PW / 2, s.aiX + step));
      }

      if (s.phase === "playing") {
        s.bx += s.vx * s.speed * dt;
        s.by += s.vy * s.speed * dt;

        if (s.bx - BR <= 0) {
          s.bx = BR;
          s.vx = Math.abs(s.vx);
          s.speed = Math.min(MAX, s.speed * WALL_ACC);
        } else if (s.bx + BR >= W) {
          s.bx = W - BR;
          s.vx = -Math.abs(s.vx);
          s.speed = Math.min(MAX, s.speed * WALL_ACC);
        }

        const at = 3.5;
        const ab = at + PH;
        if (
          s.vy < 0 &&
          s.by - BR <= ab &&
          s.by + BR >= at &&
          s.bx >= s.aiX - PW / 2 - BR &&
          s.bx <= s.aiX + PW / 2 + BR
        ) {
          s.by = ab + BR;
          s.vy = Math.abs(s.vy);
          const o = (s.bx - s.aiX) / (PW / 2);
          s.vx = Math.max(-0.92, Math.min(0.92, s.vx * 0.85 + o * 0.6));
          const m = Math.hypot(s.vx, s.vy) || 1;
          s.vx /= m;
          s.vy /= m;
          s.speed = Math.min(MAX, s.speed * PAD_ACC);
        }

        const pb = 96.5;
        const pt = pb - PH;
        if (
          s.vy > 0 &&
          s.by + BR >= pt &&
          s.by - BR <= pb &&
          s.bx >= s.youX - PW / 2 - BR &&
          s.bx <= s.youX + PW / 2 + BR
        ) {
          s.by = pt - BR;
          s.vy = -Math.abs(s.vy);
          const o = (s.bx - s.youX) / (PW / 2);
          s.vx = Math.max(-0.92, Math.min(0.92, s.vx * 0.85 + o * 0.6));
          const m = Math.hypot(s.vx, s.vy) || 1;
          s.vx /= m;
          s.vy /= m;
          s.speed = Math.min(MAX, s.speed * PAD_ACC);
        }

        if (s.by < -3) award("you");
        else if (s.by > H + 3) award("ai");
      }

      setTick((t) => (t + 1) % 1e6);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [award]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        sim.current.left = true;
      }
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        sim.current.right = true;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (sim.current.phase === "ready" || sim.current.phase === "point")
          startPoint();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A")
        sim.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D")
        sim.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [startPoint]);

  const pointerToX = (clientX: number) => {
    const el = courtRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pct = ((clientX - r.left) / r.width) * 100;
    sim.current.youX = Math.max(PW / 2, Math.min(W - PW / 2, pct));
  };

  const reset = () => {
    const s = sim.current;
    s.you = 0;
    s.ai = 0;
    s.youX = 50;
    s.aiX = 50;
    s.bx = 50;
    s.by = 50;
    s.vx = 0;
    s.vy = 0;
    s.speed = BASE;
    s.phase = "ready";
    setScore({ you: 0, ai: 0 });
    setPhase("ready");
    setMsg("Drag the court or use ← →");
  };

  const s = sim.current;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between font-display text-base font-black tracking-tight">
        <span className={cn(score.you > score.ai && "text-[#F5A623]")}>
          YOU {score.you}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          First to {TARGET}
        </span>
        <span className={cn(score.ai > score.you && "text-[#F5A623]")}>
          AI {score.ai}
        </span>
      </div>

      <div
        ref={courtRef}
        className="relative mx-auto w-full max-w-[min(100%,300px)] touch-none select-none overflow-hidden rounded-[1.25rem] border-[3px] border-[#1A1A1A] bg-[#FFF9E5] shadow-[0_4px_0_#1A1A1A] dark:bg-[#2a2418]"
        style={{ aspectRatio: "3 / 4" }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          sim.current.dragging = true;
          pointerToX(e.clientX);
          if (phase === "ready" || phase === "point") startPoint();
        }}
        onPointerMove={(e) => {
          if (!sim.current.dragging) return;
          pointerToX(e.clientX);
        }}
        onPointerUp={() => {
          sim.current.dragging = false;
        }}
        onPointerCancel={() => {
          sim.current.dragging = false;
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-[#1A1A1A]/35"
          aria-hidden
        />

        <div
          className="absolute rounded-sm bg-[#1A1A1A]"
          style={{
            width: `${PW}%`,
            height: `${PH}%`,
            left: `${s.aiX - PW / 2}%`,
            top: "3.5%",
          }}
        />

        <div
          className="absolute rounded-sm bg-[#F5A623] shadow-[0_2px_0_#B45309]"
          style={{
            width: `${PW}%`,
            height: `${PH}%`,
            left: `${s.youX - PW / 2}%`,
            bottom: "3.5%",
          }}
        />

        <div
          className="absolute rounded-full bg-[#F5A623] ring-2 ring-[#1A1A1A]"
          style={{
            width: `${BR * 2.2}%`,
            aspectRatio: "1",
            left: `${s.bx - BR * 1.1}%`,
            top: `${s.by - BR * 0.85}%`,
          }}
        />

        {msg && phase !== "playing" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-full border-2 border-[#1A1A1A] bg-[#1A1A1A] px-4 py-2 text-center text-sm font-black text-[#FFF9E5] shadow-[0_3px_0_#F5A623]">
              {msg}
            </p>
          </div>
        )}
      </div>

      <p className="text-center text-[11px] font-semibold text-muted-foreground">
        Drag on the board · Arrow keys / A D · Space to serve
      </p>

      <div className="flex gap-2">
        {phase === "ready" || phase === "point" ? (
          <button
            type="button"
            onClick={startPoint}
            className="flex-1 rounded-full border-2 border-[#1A1A1A] bg-[#F5A623] py-3 text-sm font-black text-[#1A1A1A] shadow-[0_3px_0_#1A1A1A] active:translate-y-0.5 active:shadow-none"
          >
            {phase === "ready" ? "Serve" : "Next"}
          </button>
        ) : phase === "match" ? (
          <button
            type="button"
            onClick={reset}
            className="flex-1 rounded-full border-2 border-[#1A1A1A] bg-[#F5A623] py-3 text-sm font-black text-[#1A1A1A] shadow-[0_3px_0_#1A1A1A]"
          >
            Play again
          </button>
        ) : (
          <button
            type="button"
            onClick={reset}
            className="flex-1 rounded-full border-2 border-border py-3 text-xs font-bold text-muted-foreground"
          >
            Reset match
          </button>
        )}
      </div>
    </div>
  );
}
