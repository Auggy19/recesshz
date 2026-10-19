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
import {
  BlinkDetector,
  cameraErrorMessage,
  type BlinkDetectorStatus,
} from "@/lib/blinkDetect";
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
  const stageRef = useRef<HTMLDivElement>(null);
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
  const [camMode, setCamMode] = useState(false);
  const [landmarkerOk, setLandmarkerOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCam = useCallback(() => {
    detectorRef.current?.stop();
    detectorRef.current = null;
    setCamMode(false);
    setLandmarkerOk(false);
  }, []);

  useEffect(() => () => stopCam(), [stopCam]);

  const onBlink = useCallback(() => {
    setBlinkCount((n) => n + 1);
    try {
      sfxBlinkLunge();
    } catch {
      /* audio may be blocked until gesture */
    }
    setShake(true);
    setFlicker(true);
    window.setTimeout(() => setShake(false), 180);
    window.setTimeout(() => setFlicker(false), 120);
    setProximity((p) => {
      const next = Math.min(MAX_PROXIMITY, p + LUNGE + Math.floor(p / 20));
      if (next >= MAX_PROXIMITY) {
        try {
          sfxJumpscare();
        } catch {
          /* */
        }
        setPhase("lose");
        detectorRef.current?.stop();
        detectorRef.current = null;
        setCamMode(false);
        setLandmarkerOk(false);
      }
      return next;
    });
  }, []);

  /** Full camera retry: stop tracks, then request again. */
  const startCamera = async () => {
    setBusy(true);
    setError(null);
    setStatus("loading");
    setStatusDetail("Requesting camera…");

    // Ensure previous session is fully released (required for iOS retry)
    detectorRef.current?.stop();
    detectorRef.current = null;

    // Wait a tick so video is painted (not display:none) before getUserMedia
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const video = videoRef.current;
    if (!video) {
      setError("Video preview element missing. Use Manual blink.");
      setBusy(false);
      setPhase("gate");
      return;
    }

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
      const result = await det.start(video);
      setCamMode(result.camera);
      setLandmarkerOk(result.landmarker);
      if (!result.camera) {
        setError("Camera did not start. Use Manual blink.");
        setPhase("gate");
      } else if (!result.landmarker) {
        setError(
          "Camera is on, but blink detection could not load. Play with Manual blink — or try camera again after a reload.",
        );
        setPhase("calibrate");
      } else {
        setError(null);
        setPhase("calibrate");
      }
    } catch (e) {
      const msg = cameraErrorMessage(e);
      setError(msg);
      setCamMode(false);
      setLandmarkerOk(false);
      setPhase("gate");
      det.stop();
      detectorRef.current = null;
    } finally {
      setBusy(false);
    }
  };

  const startManual = () => {
    stopCam();
    setError(null);
    setProximity(8);
    setTimeLeft(SURVIVE_S);
    setBlinkCount(0);
    setCamMode(false);
    setLandmarkerOk(false);
    setPhase("play");
    try {
      sfxBreath();
    } catch {
      /* */
    }
  };

  const beginPlay = () => {
    setProximity(8);
    setTimeLeft(SURVIVE_S);
    setBlinkCount(0);
    setPhase("play");
    try {
      sfxBreath();
    } catch {
      /* */
    }
  };

  useEffect(() => {
    if (phase !== "play") return;
    const id = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setPhase("win");
          detectorRef.current?.stop();
          detectorRef.current = null;
          setCamMode(false);
          return 0;
        }
        return t - 1;
      });
      try {
        if (Math.random() < 0.12) sfxFootstep();
        if (Math.random() < 0.06) sfxWhisper();
        if (Math.random() < 0.08) sfxBreath();
      } catch {
        /* */
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "play" || !camMode || !landmarkerOk) return;
    if (status !== "no_face") return;
    const id = window.setInterval(() => {
      setProximity((p) => {
        const next = Math.min(MAX_PROXIMITY, p + 2);
        if (next >= MAX_PROXIMITY) {
          try {
            sfxJumpscare();
          } catch {
            /* */
          }
          setPhase("lose");
          detectorRef.current?.stop();
          detectorRef.current = null;
          setCamMode(false);
        }
        return next;
      });
    }, 800);
    return () => window.clearInterval(id);
  }, [phase, camMode, landmarkerOk, status]);

  const monsterScale = 0.35 + (proximity / MAX_PROXIMITY) * 1.4;
  const aggression = proximity / MAX_PROXIMITY;

  return (
    <div className="space-y-3">
      {/* Always in DOM — opacity, not display:none — so iOS accepts getUserMedia */}
      <video
        ref={videoRef}
        className={cn(
          "mx-auto rounded-xl border border-border object-cover bg-black",
          camMode && phase !== "gate"
            ? "h-28 w-40"
            : "h-px w-px opacity-0 overflow-hidden absolute pointer-events-none",
        )}
        playsInline
        muted
        autoPlay
        // @ts-expect-error webkit prop for older iOS
        webkit-playsinline="true"
        style={{ transform: "scaleX(-1)" }}
      />

      {phase === "gate" && (
        <div className="rounded-2xl border border-violet-500/30 bg-zinc-950 p-4 text-sm text-zinc-200 space-y-3">
          <p className="font-display text-lg font-black text-violet-200">
            Don't Blink
          </p>
          <p className="text-zinc-400 leading-relaxed">
            Something in the dark only moves when your eyes close. Camera frames
            are processed <strong className="text-zinc-200">on this phone</strong> —
            not recorded, not uploaded.
          </p>
          <ul className="list-disc pl-5 text-xs text-zinc-500 space-y-1">
            <li>Open the live site URL (not an embedded Preview iframe) for camera</li>
            <li>Allow Camera for this site in iOS Settings if prompted</li>
            <li>Or play immediately with Manual blink — same monster rules</li>
          </ul>
          {error && (
            <p className="rounded-xl border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-xs text-rose-200 whitespace-pre-wrap">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Button
              className="rounded-full font-bold w-full"
              disabled={busy}
              onClick={() => void startCamera()}
            >
              <Camera className="size-4" />
              {busy ? "Requesting…" : error ? "Try camera again" : "Enable camera"}
            </Button>
            <Button
              variant="outline"
              className="rounded-full font-bold w-full"
              disabled={busy}
              onClick={startManual}
            >
              <EyeOff className="size-4" />
              Manual blink — play now
            </Button>
          </div>
          <p className="text-[11px] text-zinc-600 flex items-center gap-1">
            <Shield className="size-3" /> We never claim the camera worked if it failed
          </p>
        </div>
      )}

      {phase === "calibrate" && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">Calibration</p>
          {landmarkerOk ? (
            <>
              <p className="text-xs text-muted-foreground">
                Keep eyes open. Blink once — the bar should dip, then recover.
              </p>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all"
                  style={{ width: `${Math.min(100, ear * 280)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {status}
                {statusDetail ? ` · ${statusDetail}` : ""}
                {eyesClosed ? " · eyes closed" : " · eyes open"}
              </p>
            </>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-300">
              Camera preview may work, but automatic blink detection is not
              running. Use Manual blink in-game.
            </p>
          )}
          <Button className="rounded-full font-bold w-full" onClick={beginPlay}>
            Start survival
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-full text-xs"
            onClick={() => void startCamera()}
            disabled={busy}
          >
            Try camera again
          </Button>
          <Button variant="ghost" className="w-full text-xs" onClick={startManual}>
            Switch to manual blink
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

          {/* Play stage — DOM/SVG (not a canvas). Preview tools looking for
              <canvas> were wrong for this game; stage is this div. */}
          <div
            ref={stageRef}
            data-dont-blink-stage="true"
            className={cn(
              "relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-800 bg-black",
              shake && "animate-pulse",
              flicker && "opacity-80",
            )}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 70%, #1a0a12 0%, #000 55%)",
                filter: flicker ? "contrast(1.4) brightness(1.2)" : undefined,
              }}
            />
            <div
              className="absolute top-3 right-4 h-8 w-5 rounded-sm border border-emerald-700/30 bg-emerald-900/40"
              style={{ opacity: 0.3 + (1 - aggression) * 0.4 }}
            />
            <div
              className="absolute bottom-[12%] left-1/2 origin-bottom transition-transform duration-150"
              style={{
                transform: `translateX(-50%) scale(${monsterScale})`,
              }}
            >
              <MonsterSvg aggression={aggression} />
            </div>
            {eyesClosed && camMode && landmarkerOk && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-bold text-rose-300">
                EYES CLOSED
              </div>
            )}
            {phase === "lose" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 text-rose-400">
                <Skull className="mb-2 size-12" />
                <p className="font-display text-xl font-black">IT SAW YOU</p>
                <p className="mt-1 text-xs text-zinc-500">Too close after a blink.</p>
              </div>
            )}
            {phase === "win" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-emerald-300">
                <p className="font-display text-xl font-black">You held the gaze</p>
                <p className="mt-1 text-xs text-zinc-500">Exit found in the dark.</p>
              </div>
            )}
          </div>

          {phase === "play" && (
            <div className="flex flex-col gap-2">
              {/* Manual always available so a failed landmarker never soft-locks */}
              <Button
                className="w-full rounded-full font-bold"
                variant="destructive"
                onClick={() => onBlink()}
              >
                <Eye className="size-4" />
                Blink
                {landmarkerOk && camMode ? " (or close your eyes)" : " (manual)"}
              </Button>
              {camMode && landmarkerOk ? (
                <p className="text-center text-[11px] text-muted-foreground">
                  {status === "no_face"
                    ? "Face lost — it creeps while you're gone"
                    : "Real blinks count · frames stay local"}
                </p>
              ) : (
                <p className="text-center text-[11px] text-muted-foreground">
                  Manual mode — each Blink lunges the monster
                </p>
              )}
            </div>
          )}

          {(phase === "win" || phase === "lose") && (
            <div className="flex flex-col gap-2">
              <Button
                className="w-full rounded-full font-bold"
                onClick={() => {
                  stopCam();
                  setPhase("gate");
                  setProximity(8);
                  setError(null);
                }}
              >
                <RotateCcw className="size-4" />
                Back to start
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-full font-bold"
                onClick={startManual}
              >
                Play again (manual)
              </Button>
            </div>
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
      aria-hidden
    >
      <ellipse
        cx="80"
        cy="120"
        rx={40 + aggression * 20}
        ry={55 + aggression * 15}
        fill="#1a0508"
      />
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
