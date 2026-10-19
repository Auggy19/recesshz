/**
 * On-device blink detection via MediaPipe Face Landmarker.
 * Video never leaves the device. Frames are not recorded or uploaded.
 *
 * iOS notes: video must not be display:none during getUserMedia/play;
 * use playsInline + muted; prefer soft constraints; map DOMException names.
 */

export type BlinkDetectorStatus =
  | "idle"
  | "loading"
  | "ready"
  | "no_face"
  | "error";

export type BlinkDetectorOptions = {
  closedThreshold?: number;
  openThreshold?: number;
  cooldownMs?: number;
  onBlink?: () => void;
  onStatus?: (s: BlinkDetectorStatus, detail?: string) => void;
  onEar?: (ear: number, eyesClosed: boolean) => void;
};

const LEFT = [33, 160, 158, 133, 153, 144] as const;
const RIGHT = [362, 385, 387, 263, 373, 380] as const;

function dist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
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

export function cameraErrorMessage(e: unknown): string {
  if (e instanceof DOMException) {
    switch (e.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Camera permission was blocked for this site. On iPhone: Settings → Chrome (or Safari) → Camera → Allow, then reload. If this page is inside a Preview iframe, open the full site URL instead — iframes often block the camera even when the phone allows it.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No camera found on this device.";
      case "NotReadableError":
      case "TrackStartError":
        return "Camera is in use by another app. Close it and try again.";
      case "OverconstrainedError":
        return "Camera constraints not supported. Trying a simpler mode may help.";
      case "SecurityError":
        return "Camera blocked by browser security (needs HTTPS and a top-level page, not a locked iframe).";
      default:
        return e.message || e.name;
    }
  }
  if (e instanceof Error) return e.message;
  return "Camera failed to start.";
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
  /** Camera stream active even if landmarker failed. */
  cameraLive = false;
  landmarkerLive = false;

  constructor(opts: BlinkDetectorOptions = {}) {
    this.opts = {
      closedThreshold: opts.closedThreshold ?? 0.17,
      openThreshold: opts.openThreshold ?? 0.21,
      cooldownMs: opts.cooldownMs ?? 500,
      onBlink: opts.onBlink,
      onStatus: opts.onStatus,
      onEar: opts.onEar,
    };
  }

  private async openStream(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "getUserMedia is not available in this browser. Use Manual blink.",
      );
    }
    // Soft constraints first — hard width/height often fails on iPhone
    const attempts: MediaStreamConstraints[] = [
      { audio: false, video: { facingMode: { ideal: "user" } } },
      { audio: false, video: { facingMode: "user" } },
      { audio: false, video: true },
    ];
    let last: unknown;
    for (const c of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(c);
      } catch (e) {
        last = e;
      }
    }
    throw last;
  }

  async start(videoEl: HTMLVideoElement): Promise<{
    camera: boolean;
    landmarker: boolean;
  }> {
    this.stopTracksOnly();
    this.opts.onStatus?.("loading", "Requesting camera…");
    this.video = videoEl;

    // iOS: element must be in DOM, not display:none; muted + playsInline required
    videoEl.setAttribute("playsinline", "true");
    videoEl.setAttribute("webkit-playsinline", "true");
    videoEl.playsInline = true;
    videoEl.muted = true;
    videoEl.autoplay = true;

    try {
      this.stream = await this.openStream();
    } catch (e) {
      const msg = cameraErrorMessage(e);
      this.opts.onStatus?.("error", msg);
      this.cameraLive = false;
      throw new Error(msg);
    }

    videoEl.srcObject = this.stream;
    try {
      await videoEl.play();
    } catch (e) {
      // Autoplay can fail; stream may still be usable for MediaPipe
      console.warn("[DontBlink] video.play()", e);
    }
    this.cameraLive = true;
    this.opts.onStatus?.("loading", "Camera open — loading face model…");

    try {
      const vision = await import(
        /* @vite-ignore */
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm"
      );
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
      );
      // CPU fallback if GPU fails on some mobile GPUs
      try {
        this.landmarker = await vision.FaceLandmarker.createFromOptions(
          fileset,
          {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numFaces: 1,
          },
        );
      } catch {
        this.landmarker = await vision.FaceLandmarker.createFromOptions(
          fileset,
          {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numFaces: 1,
          },
        );
      }
      this.landmarkerLive = true;
      this.running = true;
      this.opts.onStatus?.(
        "ready",
        "Camera + blink detection on — frames stay on this device",
      );
      this.loop();
      return { camera: true, landmarker: true };
    } catch (e) {
      this.landmarkerLive = false;
      const msg =
        e instanceof Error
          ? e.message
          : "Face model failed to load";
      this.opts.onStatus?.(
        "error",
        `Camera works, but blink AI failed (${msg}). Use Manual blink.`,
      );
      // Do not kill camera stream — user can still see preview; detection won't run
      return { camera: true, landmarker: false };
    }
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

  triggerManualBlink() {
    const t = performance.now();
    if (t - this.lastBlink < this.opts.cooldownMs) return false;
    this.lastBlink = t;
    this.opts.onBlink?.();
    return true;
  }

  private stopTracksOnly() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    try {
      this.landmarker?.close();
    } catch {
      /* ignore */
    }
    this.landmarker = null;
    this.landmarkerLive = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.cameraLive = false;
    if (this.video) {
      this.video.srcObject = null;
    }
  }

  stop() {
    this.stopTracksOnly();
    this.video = null;
    this.opts.onStatus?.("idle");
  }
}
