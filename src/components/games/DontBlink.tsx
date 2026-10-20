import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Eye, EyeOff, Shield, Skull, RotateCcw } from "lucide-react";
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

type Phase = "gate" | "play" | "win" | "lose";

const SURVIVE_S = 45;
const MAX_PROXIMITY = 100;
const LUNGE = 12;

/**
 * Manual-first horror survival. Camera blink is optional and never blocks play.
 * We never claim camera/AI success unless start() reports it.
 */
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
  const [camMode, setCamMode] = useState(false);
  const [landmarkerOk, setLandmarkerOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("Ready. Play works without a camera.");

  const stopCam = useCallback(() => {
    try {
      detectorRef.current?.stop();
    } catch {
      /* */
    }
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
      /* */
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
        stopCam();
      }
      return next;
    });
  }, [stopCam]);

  const startManualPlay = () => {
    stopCam();
    setProximity(8);
    setTimeLeft(SURVIVE_S);
    setBlinkCount(0);
    setPhase("play");
    setLog("Manual mode — tap Blink to lunge the monster.");
    try {
      sfxBreath();
    } catch {
      /* */
    }
  };

  const startCamera = async () => {
    setBusy(true);
    setLog("Requesting camera…");
    setStatus("loading");
    setStatusDetail("Requesting camera…");

    stopCam();
    await new Promise((r) => setTimeout(r, 50));

    const video = videoRef.current;
    if (!video) {
      setLog("ERROR: video element missing. Use Play without camera.");
      setBusy(false);
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

    // Hard timeout so the button never sits forever on "Requesting…"
    const timeoutMs = 12000;
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      setLog(
        "Camera request timed out (12s). On iPhone open this page as a top-level tab (not Preview). Or Play without camera.",
      );
      setBusy(false);
      try {
        det.stop();
      } catch {
        /* */
      }
      detectorRef.current = null;
      setCamMode(false);
      setLandmarkerOk(false);
    }, timeoutMs);

    try {
      const result = await det.start(video);
      if (timedOut) return;
      window.clearTimeout(timer);
      setCamMode(result.camera);
      setLandmarkerOk(result.landmarker);
      if (result.camera && result.landmarker) {
        setLog("Camera + blink detection active (on-device). Survive 45s.");
        setProximity(8);
        setTimeLeft(SURVIVE_S);
        setBlinkCount(0);
        setPhase("play");
      } else if (result.camera && !result.landmarker) {
        setLog(
          "Camera opened, but blink AI failed to load. Use the Blink button.",
        );
        setProximity(8);
        setTimeLeft(SURVIVE_S);
        setBlinkCount(0);
        setPhase("play");
      } else {
        setLog("Camera did not start. Use Play without camera.");
      }
    } catch (e) {
      if (timedOut) return;
      window.clearTimeout(timer);
      const msg = cameraErrorMessage(e);
      setLog(`Camera failed: ${msg}`);
      setCamMode(false);
      setLandmarkerOk(false);
      try {
        det.stop();
      } catch {
        /* */
      }
      detectorRef.current = null;
    } finally {
      if (!timedOut) {
        window.clearTimeout(timer);
        setBusy(false);
      }
    }
  };

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
      try {
        if (Math.random() < 0.1) sfxFootstep();
        if (Math.random() < 0.05) sfxWhisper();
      } catch {
        /* */
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, stopCam]);

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
          stopCam();
        }
        return next;
      });
    }, 800);
    return () => window.clearInterval(id);
  }, [phase, camMode, landmarkerOk, status, stopCam]);

  const monsterScale = 0.35 + (proximity / MAX_PROXIMITY) * 1.4;
  const aggression = proximity / MAX_PROXIMITY;

  return (
    <div className="space-y-3">
      <video
        ref={videoRef}
        className={cn(
          "mx-auto rounded-xl border border-border object-cover bg-black",
          camMode ? "h-28 w-40" : "pointer-events-none absolute h-px w-px opacity-0",
        )}
        playsInline
        muted
        autoPlay
        style={{ transform: "scaleX(-1)" }}
      />

      {phase === "gate" && (
        <div className="space-y-3 rounded-2xl border border-violet-500/30 bg-zinc-950 p-4 text-sm text-zinc-200">
          <p className="font-display text-lg font-black text-violet-200">
            Don't Blink
          </p>
          <p className="leading-relaxed text-zinc-400">
            Survive {SURVIVE_S}s. Each blink lunges the thing in the dark. Camera
            blink detection is optional — play works without it.
          </p>
          <p className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300">
            {log}
          </p>
          <Button
            type="button"
            className="w-full rounded-full font-bold"
            onClick={startManualPlay}
          >
            <EyeOff className="size-4" />
            Play without camera
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-full font-bold"
            disabled={busy}
            onClick={() => void startCamera()}
          >
            <Camera className="size-4" />
            {busy ? "Requesting camera…" : "Try camera blink"}
          </Button>
          <p className="flex items-center gap-1 text-[11px] text-zinc-600">
            <Shield className="size-3" />
            Frames stay on device if camera works. No upload.
          </p>
        </div>
      )}

      {(phase === "play" || phase === "win" || phase === "lose") && (
        <>
          <div className="flex justify-between text-xs font-semibold tabular-nums">
            <span>{Math.ceil(timeLeft)}s</span>
            <span>Blinks {blinkCount}</span>
            <span className={aggression > 0.7 ? "text-rose-500" : ""}>
              {Math.round(proximity)}%
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">{log}</p>

          <div
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
              }}
            />
            <div
              className="absolute bottom-[12%] left-1/2 origin-bottom transition-transform duration-150"
              style={{
                transform: `translateX(-50%) scale(${monsterScale})`,
              }}
            >
              <MonsterSvg aggression={aggression} />
            </div>
            {eyesClosed && landmarkerOk && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-bold text-rose-300">
                EYES CLOSED
              </div>
            )}
            {phase === "lose" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 text-rose-400">
                <Skull className="mb-2 size-12" />
                <p className="font-display text-xl font-black">IT SAW YOU</p>
              </div>
            )}
            {phase === "win" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-emerald-300">
                <p className="font-display text-xl font-black">You held the gaze</p>
              </div>
            )}
          </div>

          {phase === "play" && (
            <Button
              type="button"
              className="w-full rounded-full font-bold"
              variant="destructive"
              onClick={() => onBlink()}
            >
              <Eye className="size-4" />
              Blink
            </Button>
          )}

          {(phase === "win" || phase === "lose") && (
            <Button
              type="button"
              className="w-full rounded-full font-bold"
              onClick={() => {
                stopCam();
                setPhase("gate");
                setLog("Ready. Play works without a camera.");
              }}
            >
              <RotateCcw className="size-4" />
              Again
            </Button>
          )}

          {phase === "play" && camMode && (
            <p className="text-center text-[11px] text-muted-foreground">
              EAR {ear.toFixed(2)}
              {statusDetail ? ` · ${statusDetail}` : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function MonsterSvg({ aggression }: { aggression: number }) {
  const eyes = 3 + Math.floor(aggression * 4);
  return (
    <svg width="160" height="200" viewBox="0 0 160 200" aria-hidden>
      <ellipse
        cx="80"
        cy="120"
        rx={40 + aggression * 20}
        ry={55 + aggression * 15}
        fill="#1a0508"
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
      <line x1="30" y1="160" x2="10" y2="200" stroke="#2a1018" strokeWidth="6" />
      <line x1="130" y1="160" x2="150" y2="200" stroke="#2a1018" strokeWidth="6" />
    </svg>
  );
}
