import { PhoneOff, Radio } from "lucide-react";
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
 * Modern lucide icons: Radio (Go live), PhoneOff (End live), pulse dot.
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
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm active:scale-[0.98] transition-transform"
            >
              <Radio className="size-3.5" strokeWidth={2.5} aria-hidden />
              Go live
            </button>
          )
        ) : (
          onHangup && (
            <button
              type="button"
              onClick={onHangup}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground active:scale-[0.98] transition-transform"
            >
              <PhoneOff className="size-3.5" strokeWidth={2.5} aria-hidden />
              End live
            </button>
          )
        )}
      </div>
    </div>
  );
}
