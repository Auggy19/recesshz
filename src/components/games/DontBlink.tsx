import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Eye,
  EyeOff,
  Shield,
  Skull,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlinkDetector, type BlinkDetectorStatus } from "@/lib/blinkDetect";
import {
  sfxBlinkLunge,
  sfxBreath,
  sfxFootstep,
  sfxJumpscare,
  sfxWhisper,
} from "@/lib/horrorAudio";
import { cn } from "@/lib/utils";

type Phase = "gate" | "calibrate" | "play" | "win" | "lose";

const SURVIVE_S = 45;
const MAX_PROXIMITY = 100;
const LUNGE = 12;

export function DontBlink() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectorRef = useRef<BlinkDetector | null>(null);
  const [phase, setPhase] = useState<Phase>("gate");
  const [status, setStatus] = useState<BlinkDetectorStatus>("idle");
  const [statusDetail, setStatusDetail] = useState("");
  const [ear, setEar] = useState(0.3);
  const [eyesClosed, setEyesClosed] = useState(false);
  const [proximity, setProximity] = useState(8);
  const [timeLeft, setTimeLeft] = useState(SURVIVE_S);
  const [shake, setShake] = useState(false);
  const [flicker, setFlicker] = useState(false);
  const [blinkCount, setBlinkCount] = useState(0);
  const [camMode, setCamMode] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const stopCam = useCallback(() => {
    detectorRef.current?.stop();
    detectorRef.current = null;
  }, []);

  useEffect(() => () => stopCam(), [stopCam]);

  const onBlink = useCallback(() => {
    setBlinkCount((n) => n + 1);
    sfxBlinkLunge();
    setShake(true);
    setFlicker(true);
    window.setTimeout(() => setShake(false), 180);
    window.setTimeout(() => setFlicker(false), 120);
    setProximity((p) => {
      const next = Math.min(MAX_PROXIMITY, p + LUNGE + Math.floor(p / 20));
      if (next >= MAX_PROXIMITY) {
        sfxJumpscare();
        setPhase("lose");
        stopCam();
      }
      return next;
    });
  }, [stopCam]);

  const startCamera = async () => {
    setError(null);
    setPhase("calibrate");
    setCamMode(true);
    const det = new BlinkDetector({
      onBlink,
      onStatus: (s, d) => {
        setStatus(s);
        if (d) setStatusDetail(d);
      },
      onEar: (e, closed) => {
        setEar(e);
        setEyesClosed(closed);
      },
    });
    detectorRef.current = det;
    try {
      if (!videoRef.current) throw new Error("Video element missing");
      await det.start(videoRef.current);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Camera failed. Use manual blink mode.",
      );
      setCamMode(false);
      setPhase("gate");
      stopCam();
    }
  };

  const startManual = () => {
    stopCam();
    setCamMode(false);
    setError(null);
    setProximity(8);
    setTimeLeft(SURVIVE_S);
    setBlinkCount(0);
    setPhase("play");
  };

  const beginPlay = () => {
    setProximity(8);
    setTimeLeft(SURVIVE_S);
    setBlinkCount(0);
    setPhase("play");
    sfxBreath();
  };

  // Survive timer + ambient
  useEffect(() => {
    if (phase !== "play") return;
    const id = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setPhase("win");
          stopCam();
          return 0;
        }
        return t - 1;
      });
      if (Math.random() < 0.12) sfxFootstep();
      if (Math.random() < 0.06) sfxWhisper();
      if (Math.random() < 0.08) sfxBreath();
      // Slow creep even without blink if not watching (manual always "watching" unless blink)
      if (!camMode || eyesClosed) {
        /* camera closed handled by blink edge only */
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, stopCam, camMode, eyesClosed]);

  // Slow ambient approach when face lost in cam mode
  useEffect(() => {
    if (phase !== "play" || !camMode) return;
    if (status !== "no_face") return;
    const id = window.setInterval(() => {
      setProximity((p) => {
        const next = Math.min(MAX_PROXIMITY, p + 2);
        if (next >= MAX_PROXIMITY) {
          sfxJumpscare();
          setPhase("lose");
          stopCam();
        }
        return next;
      });
    }, 800);
    return () => window.clearInterval(id);
  }, [phase, camMode, status, stopCam]);

  const monsterScale = 0.35 + (proximity / MAX_PROXIMITY) * 1.4;
  const aggression = proximity / MAX_PROXIMITY;

  return (
    <div className="space-y-3">
      <video
        ref={videoRef}
        className={cn(
          "mx-auto h-28 w-40 rounded-xl border border-border object-cover mirror",
          phase === "gate" && "hidden",
          !camMode && "hidden",
        )}
        playsInline
        muted
        style={{ transform: "scaleX(-1)" }}
      />

      {phase === "gate" && (
        <div className="rounded-2xl border border-violet-500/30 bg-zinc-950 p-4 text-sm text-zinc-200 space-y-3">
          <p className="font-display text-lg font-black text-violet-200">
            Don't Blink
          </p>
          <p className="text-zinc-400 leading-relaxed">
            Something in the dark only moves when your eyes close. We need your
            front camera for a moment — face landmarks are computed{" "}
            <strong className="text-zinc-200">on this device</strong>. Nothing is
            recorded or uploaded.
          </p>
          <ul className="list-disc pl-5 text-xs text-zinc-500 space-y-1">
            <li>Allow camera when prompted</li>
            <li>Good light, face the screen</li>
            <li>One blink = one lunge (cooldown prevents double-fires)</li>
            <li>Survive {SURVIVE_S}s without letting it reach you</li>
          </ul>
          {error && (
            <p className="rounded-xl border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-xs text-rose-200">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="rounded-full font-bold flex-1"
              onClick={() => void startCamera()}
            >
              <Camera className="size-4" />
              Enable camera
            </Button>
            <Button
              variant="outline"
              className="rounded-full font-bold flex-1"
              onClick={startManual}
            >
              <EyeOff className="size-4" />
              Manual blink (no camera)
            </Button>
          </div>
          <p className="text-[11px] text-zinc-600 flex items-center gap-1">
            <Shield className="size-3" /> Local only · MediaPipe Face Landmarker
          </p>
        </div>
      )}

      {phase === "calibrate" && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">Calibration</p>
          <p className="text-xs text-muted-foreground">
            Keep your eyes open. EAR (eye openness) should sit roughly above 0.2.
            Blink once to test — the bar will dip.
          </p>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-violet-500 transition-all"
              style={{ width: `${Math.min(100, ear * 280)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Status: {status}
            {statusDetail ? ` · ${statusDetail}` : ""}
            {eyesClosed ? " · eyes closed" : " · eyes open"}
          </p>
          <Button
            className="rounded-full font-bold w-full"
            disabled={status === "loading" || status === "error"}
            onClick={beginPlay}
          >
            I'm ready — start
          </Button>
          <Button variant="ghost" className="w-full text-xs" onClick={startManual}>
            Skip to manual mode
          </Button>
        </div>
      )}

      {(phase === "play" || phase === "win" || phase === "lose") && (
        <>
          <div className="flex justify-between text-xs font-semibold tabular-nums">
            <span>{Math.ceil(timeLeft)}s left</span>
            <span>Blinks {blinkCount}</span>
            <span className={aggression > 0.7 ? "text-rose-500" : ""}>
              {Math.round(proximity)}% close
            </span>
          </div>

          <div
            className={cn(
              "relative mx-auto aspect-[4/5] max-w-sm overflow-hidden rounded-2xl border border-zinc-800 bg-black",
              shake && "animate-pulse",
              flicker && "opacity-80",
            )}
          >
            {/* room */}
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse at 50% 70%, #1a0a12 0%, #000 55%)`,
                filter: flicker ? "contrast(1.4) brightness(1.2)" : undefined,
              }}
            />
            {/* exit glow far when winning path */}
            <div
              className="absolute top-3 right-4 h-8 w-5 rounded-sm bg-emerald-900/40 border border-emerald-700/30"
              style={{ opacity: 0.3 + (1 - aggression) * 0.4 }}
            />
            {/* monster */}
            <div
              className="absolute left-1/2 bottom-[12%] origin-bottom transition-transform duration-150"
              style={{
                transform: `translateX(-50%) scale(${monsterScale})`,
              }}
            >
              <MonsterSvg aggression={aggression} />
            </div>
            {eyesClosed && camMode && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-rose-300 text-sm font-bold">
                EYES CLOSED
              </div>
            )}
            {phase === "lose" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 text-rose-400">
                <Skull className="size-12 mb-2" />
                <p className="font-display text-xl font-black">IT SAW YOU</p>
                <p className="text-xs text-zinc-500 mt-1">You blinked too close.</p>
              </div>
            )}
            {phase === "win" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-emerald-300">
                <p className="font-display text-xl font-black">You held the gaze</p>
                <p className="text-xs text-zinc-500 mt-1">Exit found in the dark.</p>
              </div>
            )}
          </div>

          {phase === "play" && (
            <div className="flex flex-wrap gap-2">
              {!camMode && (
                <Button
                  className="flex-1 rounded-full font-bold"
                  variant="destructive"
                  onClick={() => {
                    onBlink();
                  }}
                >
                  <Eye className="size-4" />
                  Blink (manual)
                </Button>
              )}
              {camMode && (
                <p className="w-full text-center text-[11px] text-muted-foreground">
                  {status === "no_face"
                    ? "Face lost — it creeps while you're gone"
                    : "Real blinks advance the monster · frames stay local"}
                </p>
              )}
            </div>
          )}

          {(phase === "win" || phase === "lose") && (
            <Button
              className="w-full rounded-full font-bold"
              onClick={() => {
                stopCam();
                setPhase("gate");
                setProximity(8);
              }}
            >
              <RotateCcw className="size-4" />
              Try again
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function MonsterSvg({ aggression }: { aggression: number }) {
  const eyes = 3 + Math.floor(aggression * 4);
  return (
    <svg
      width="160"
      height="200"
      viewBox="0 0 160 200"
      className="drop-shadow-[0_0_20px_rgba(120,0,40,0.6)]"
    >
      <ellipse cx="80" cy="120" rx={40 + aggression * 20} ry={55 + aggression * 15} fill="#1a0508" />
      <path
        d={`M40 80 Q80 ${30 - aggression * 20} 120 80`}
        stroke="#2a0a10"
        strokeWidth="12"
        fill="none"
      />
      {Array.from({ length: eyes }).map((_, i) => {
        const a = (i / eyes) * Math.PI - Math.PI / 2;
        const cx = 80 + Math.cos(a) * (18 + aggression * 10);
        const cy = 90 + Math.sin(a) * (12 + aggression * 8);
        return (
          <g key={i}>
            <ellipse cx={cx} cy={cy} rx="7" ry="10" fill="#3b0010" />
            <circle cx={cx} cy={cy + 1} r="3" fill="#f5a623" />
          </g>
        );
      })}
      <path
        d={`M55 ${140 + aggression * 10} Q80 ${155 + aggression * 20} 105 ${140 + aggression * 10}`}
        stroke="#4a1020"
        strokeWidth="3"
        fill="none"
      />
      <line x1="30" y1="160" x2="10" y2="200" stroke="#2a1018" strokeWidth="6" />
      <line x1="130" y1="160" x2="150" y2="200" stroke="#2a1018" strokeWidth="6" />
    </svg>
  );
}
