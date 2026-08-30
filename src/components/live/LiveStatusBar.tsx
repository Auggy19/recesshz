import type { LiveConnectionState } from "@/lib/live/types";

type Props = {
  connectionState: LiveConnectionState | "idle";
  channelOpen: boolean;
  onGoLive?: () => void;
  onHangup?: () => void;
  /** Show compact chip only (in-game header). */
  compact?: boolean;
};

const STATE_COPY: Record<string, string> = {
  idle: "Async",
  signaling: "Linking…",
  connecting: "Connecting…",
  connected: "Live",
  disconnected: "Reconnecting…",
  failed: "Live failed",
  closed: "Live ended",
};

/**
 * Live mode status + actions.
 * Icons: pulse dot (live), radio waves (Go live), hangup (End live).
 */
export function LiveStatusBar({
  connectionState,
  channelOpen,
  onGoLive,
  onHangup,
  compact,
}: Props) {
  const isLive = connectionState === "connected" && channelOpen;
  const inFlight =
    connectionState === "signaling" ||
    connectionState === "connecting" ||
    connectionState === "disconnected";

  const label = isLive ? "Live" : (STATE_COPY[connectionState] ?? connectionState);

  return (
    <div
      className={
        compact
          ? "flex items-center gap-2"
          : "flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/80 px-3 py-2 backdrop-blur"
      }
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={
            "relative flex h-2.5 w-2.5 shrink-0 rounded-full " +
            (isLive
              ? "bg-emerald-500"
              : inFlight
                ? "bg-amber-400"
                : connectionState === "failed"
                  ? "bg-red-500"
                  : "bg-muted-foreground/40")
          }
          aria-hidden
        >
          {(isLive || inFlight) && (
            <span
              className={
                "absolute inset-0 animate-ping rounded-full opacity-40 " +
                (isLive ? "bg-emerald-400" : "bg-amber-300")
              }
            />
          )}
        </span>
        <span className="text-sm font-medium truncate">
          {label}
          {isLive && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              both online
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {connectionState === "idle" ||
        connectionState === "closed" ||
        connectionState === "failed" ? (
          onGoLive && (
            <button
              type="button"
              onClick={onGoLive}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm active:scale-[0.98]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4.93 19.07a10 10 0 0 1 0-14.14M7.76 16.24a6 6 0 0 1 0-8.48M10.59 13.41a2 2 0 0 1 0-2.82"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              </svg>
              Go live
            </button>
          )
        ) : (
          onHangup && (
            <button
              type="button"
              onClick={onHangup}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground active:scale-[0.98]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 6l12 12M8 16a11 11 0 0 1 3-7l2 2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              End live
            </button>
          )
        )}
      </div>
    </div>
  );
}
