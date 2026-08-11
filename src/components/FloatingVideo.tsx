import { useEffect, useRef, useState } from "react";
import {
  Clapperboard,
  Film,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  Upload,
  Video,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// FloatingVideo — a small draggable + resizable video overlay that floats
// above the game UI without covering the board by default. Sources:
//   - a local video file (object URL)
//   - the device camera (getUserMedia)
//   - native Picture-in-Picture on supported browsers (desktop Chrome/Edge,
//     Safari), via the browser's own floating window.
//
// Default position is the bottom-right corner (away from the centered board);
// the user can drag it anywhere and resize it with the corner handle. A
// minimized pill keeps it out of the way while still playing.
// ---------------------------------------------------------------------------

interface Point {
  x: number;
  y: number;
}

const MIN_W = 160;
const MIN_H = 104;
const MAX_W = 480;
const MAX_H = 360;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export default function FloatingVideo() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState<Point>(() => {
    const w = typeof window === "undefined" ? 260 : Math.min(260, window.innerWidth - 24);
    const x = typeof window === "undefined" ? 0 : Math.max(12, window.innerWidth - w - 16);
    const y = typeof window === "undefined" ? 0 : Math.max(12, window.innerHeight - 236);
    return { x, y };
  });
  const [size, setSize] = useState({ w: 260, h: 176 });
  const [hasSource, setHasSource] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objUrlRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; orig: Point } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  // Release media when the overlay is closed or the component unmounts.
  const releaseMedia = () => {
    if (objUrlRef.current) {
      URL.revokeObjectURL(objUrlRef.current);
      objUrlRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    return () => {
      releaseMedia();
    };
  }, []);

  const close = () => {
    releaseMedia();
    setHasSource(false);
    setPlaying(false);
    setOpen(false);
    setMinimized(false);
  };

  // --- Sources -------------------------------------------------------------

  const pickFile = () => fileInputRef.current?.click();

  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    releaseMedia();
    const url = URL.createObjectURL(file);
    objUrlRef.current = url;
    setHasSource(true);
    const video = videoRef.current;
    if (video) {
      video.src = url;
      video.srcObject = null;
      void video.play().catch(() => {});
      setPlaying(true);
    }
  };

  const startCamera = async () => {
    try {
      releaseMedia();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setHasSource(true);
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.src = "";
        void video.play().catch(() => {});
        setPlaying(true);
      }
    } catch {
      // Permission denied or no camera — leave the source area as is.
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || !hasSource) return;
    if (video.paused) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const pipSupported =
    typeof document !== "undefined" &&
    "pictureInPictureEnabled" in document &&
    document.pictureInPictureEnabled;

  const togglePip = async () => {
    const video = videoRef.current;
    if (!video || !hasSource) return;
    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      // PiP can be refused; the in-page overlay still works.
    }
  };

  // --- Drag + resize -------------------------------------------------------

  const onDragStart = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, orig: pos };
  };

  const onDragMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const w = minimized ? 0 : size.w;
    const maxX = (typeof window === "undefined" ? 0 : window.innerWidth) - 48;
    const maxY = (typeof window === "undefined" ? 0 : window.innerHeight) - 36;
    setPos({
      x: clamp(drag.orig.x + (e.clientX - drag.startX), 8 - w, Math.max(8 - w, maxX)),
      y: clamp(drag.orig.y + (e.clientY - drag.startY), 0, Math.max(0, maxY)),
    });
  };

  const onDragEnd = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  };

  const onResizeStart = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: size.w, origH: size.h };
  };

  const onResizeMove = (e: React.PointerEvent) => {
    const r = resizeRef.current;
    if (!r) return;
    const maxW = Math.max(MIN_W, (typeof window === "undefined" ? 0 : window.innerWidth) - 24);
    const maxH = Math.max(MIN_H, (typeof window === "undefined" ? 0 : window.innerHeight) - 72);
    setSize({
      w: clamp(r.origW + (e.clientX - r.startX), MIN_W, Math.min(MAX_W, maxW)),
      h: clamp(r.origH + (e.clientY - r.startY), MIN_H, Math.min(MAX_H, maxH)),
    });
  };

  const onResizeEnd = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    resizeRef.current = null;
  };

  // --- Render --------------------------------------------------------------

  return (
    <>
      {/* Subtle trigger — bottom-left corner, away from the board */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close floating video" : "Open floating video"}
        className={`fixed bottom-5 left-5 z-40 flex size-11 items-center justify-center rounded-full border transition-all ${
          open
            ? "border-primary bg-primary text-white shadow-lg shadow-primary/30"
            : "border-border bg-card text-muted-foreground hover:text-foreground"
        }`}
      >
        <Clapperboard className="size-5" />
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={onFileChosen}
        aria-hidden
        tabIndex={-1}
      />

      {/* Minimized pill — still draggable, one tap restores */}
      {open && minimized && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Restore floating video"
          onClick={() => setMinimized(false)}
          onKeyDown={(e) => e.key === "Enter" && setMinimized(false)}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          className="fixed z-50 flex cursor-grab select-none items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-bold text-muted-foreground shadow-lg active:cursor-grabbing"
          style={{ left: pos.x, top: pos.y }}
        >
          <span className="relative flex size-2">
            <span
              className={`absolute inline-flex h-full w-full rounded-full ${
                playing ? "animate-ping bg-primary opacity-60" : ""
              }`}
            />
            <span className={`relative inline-flex size-2 rounded-full ${playing ? "bg-primary" : "bg-muted-foreground/50"}`} />
          </span>
          <Film className="size-3.5 text-primary" />
          {playing ? "Playing" : "Paused"}
        </div>
      )}

      {/* Full overlay */}
      {open && !minimized && (
        <div
          role="dialog"
          aria-label="Floating video"
          className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
        >
          {/* Drag handle */}
          <div
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            className="flex h-9 shrink-0 cursor-grab select-none items-center justify-between border-b border-border bg-muted/60 px-2 active:cursor-grabbing"
          >
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <Film className="size-3.5 text-primary" />
              Video
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setMinimized(true)}
                aria-label="Minimize video"
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Minimize2 className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={close}
                aria-label="Close video"
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Video surface */}
          <div className="relative min-h-0 flex-1 bg-black">
            <video
              ref={videoRef}
              className="h-full w-full object-contain"
              playsInline
              controls={false}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
            {!hasSource && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-4 text-center">
                <Video className="size-6 text-white/60" />
                <p className="text-[11px] font-semibold text-white/70">
                  Watch a video while you wait for your friend
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={pickFile}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
                  >
                    <Upload className="size-3.5" />
                    Choose video
                  </button>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-white/25"
                  >
                    <Clapperboard className="size-3.5" />
                    Camera
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex h-9 shrink-0 items-center justify-between border-t border-border bg-card px-2">
            <button
              type="button"
              onClick={togglePlay}
              disabled={!hasSource}
              aria-label={playing ? "Pause video" : "Play video"}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            </button>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={pickFile}
                aria-label="Choose a video file"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Upload className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={startCamera}
                aria-label="Use the camera"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Clapperboard className="size-3.5" />
              </button>
              {pipSupported && (
                <button
                  type="button"
                  onClick={togglePip}
                  aria-label="Pop out video"
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <PictureInPicture2 className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Resize handle */}
          <div
            onPointerDown={onResizeStart}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeEnd}
            onPointerCancel={onResizeEnd}
            aria-hidden
            className="absolute bottom-0 right-0 z-10 h-5 w-5 cursor-nwse-resize"
            style={{
              background:
                "linear-gradient(135deg, transparent 50%, rgba(0,0,0,0) 50%)",
            }}
          >
            <span className="absolute bottom-1 right-1 block size-2.5 rounded-[3px] border-b-2 border-r-2 border-muted-foreground/50" />
          </div>
        </div>
      )}
    </>
  );
}
