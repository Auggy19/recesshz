/**
 * On-device blink detection via MediaPipe Face Landmarker.
 * Video never leaves the device. Frames are not recorded or uploaded.
 */

export type BlinkDetectorStatus =
  | "idle"
  | "loading"
  | "ready"
  | "no_face"
  | "error";

export type BlinkDetectorOptions = {
  /** EAR below this = eye closed. Calibrate if needed. */
  closedThreshold?: number;
  /** EAR above this after close = open again. */
  openThreshold?: number;
  /** Min ms between accepted blinks. */
  cooldownMs?: number;
  onBlink?: () => void;
  onStatus?: (s: BlinkDetectorStatus, detail?: string) => void;
  onEar?: (ear: number, eyesClosed: boolean) => void;
};

// MediaPipe Face Mesh landmark indices (468 model)
const LEFT = [33, 160, 158, 133, 153, 144] as const;
const RIGHT = [362, 385, 387, 263, 373, 380] as const;

function dist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function eyeAspectRatio(
  lm: { x: number; y: number; z?: number }[],
  idx: readonly number[],
): number {
  const p1 = lm[idx[0]];
  const p2 = lm[idx[1]];
  const p3 = lm[idx[2]];
  const p4 = lm[idx[3]];
  const p5 = lm[idx[4]];
  const p6 = lm[idx[5]];
  if (!p1 || !p4) return 0.3;
  const vertical = dist(p2, p6) + dist(p3, p5);
  const horizontal = dist(p1, p4) || 1e-6;
  return vertical / (2 * horizontal);
}

export class BlinkDetector {
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private landmarker: {
    detectForVideo: (
      video: HTMLVideoElement,
      ts: number,
    ) => { faceLandmarks: { x: number; y: number; z?: number }[][] };
    close: () => void;
  } | null = null;
  private raf = 0;
  private closed = false;
  private lastBlink = 0;
  private opts: Required<
    Pick<
      BlinkDetectorOptions,
      "closedThreshold" | "openThreshold" | "cooldownMs"
    >
  > &
    BlinkDetectorOptions;
  private running = false;

  constructor(opts: BlinkDetectorOptions = {}) {
    this.opts = {
      closedThreshold: opts.closedThreshold ?? 0.18,
      openThreshold: opts.openThreshold ?? 0.22,
      cooldownMs: opts.cooldownMs ?? 450,
      onBlink: opts.onBlink,
      onStatus: opts.onStatus,
      onEar: opts.onEar,
    };
  }

  async start(videoEl: HTMLVideoElement): Promise<void> {
    this.opts.onStatus?.("loading", "Loading face model…");
    this.video = videoEl;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Camera permission denied or unavailable";
      this.opts.onStatus?.("error", msg);
      throw e;
    }

    videoEl.srcObject = this.stream;
    videoEl.setAttribute("playsinline", "true");
    videoEl.muted = true;
    await videoEl.play();

    try {
      const vision = await import(
        /* @vite-ignore */
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm"
      );
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
      );
      this.landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
      });
    } catch (e) {
      this.stop();
      const msg =
        e instanceof Error ? e.message : "Could not load face landmarker";
      this.opts.onStatus?.("error", msg);
      throw e;
    }

    this.running = true;
    this.opts.onStatus?.("ready", "Camera on — frames stay on this device");
    this.loop();
  }

  private loop = () => {
    if (!this.running || !this.video || !this.landmarker) return;
    const now = performance.now();
    if (this.video.readyState >= 2) {
      try {
        const res = this.landmarker.detectForVideo(this.video, now);
        const faces = res.faceLandmarks;
        if (!faces?.length) {
          this.opts.onStatus?.("no_face", "Face not found — center yourself");
          this.opts.onEar?.(0.3, false);
        } else {
          const lm = faces[0];
          const ear =
            (eyeAspectRatio(lm, LEFT) + eyeAspectRatio(lm, RIGHT)) / 2;
          this.opts.onStatus?.("ready");
          this.opts.onEar?.(ear, this.closed);

          if (!this.closed && ear < this.opts.closedThreshold) {
            this.closed = true;
          } else if (this.closed && ear > this.opts.openThreshold) {
            this.closed = false;
            const t = performance.now();
            if (t - this.lastBlink >= this.opts.cooldownMs) {
              this.lastBlink = t;
              this.opts.onBlink?.();
            }
          }
        }
      } catch {
        // drop frame
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  /** Manual / fallback blink (same cooldown). */
  triggerManualBlink() {
    const t = performance.now();
    if (t - this.lastBlink < this.opts.cooldownMs) return false;
    this.lastBlink = t;
    this.opts.onBlink?.();
    return true;
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.landmarker?.close();
    this.landmarker = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) {
      this.video.srcObject = null;
    }
    this.video = null;
    this.opts.onStatus?.("idle");
  }
}
