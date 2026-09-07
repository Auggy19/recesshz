import { useMemo } from "react";
import type { RealtimeStatus } from "@/lib/games-edge";

type Props = {
  status: RealtimeStatus;
  lastEventAt: number | null;
  lastEventType: string | null;
  slug: string;
  eventCount: number;
  /** Force show even without ?debug=1 (e.g. staging). */
  force?: boolean;
};

function formatAge(ts: number | null): string {
  if (ts == null) return "—";
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 1) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  return `${m}m ago`;
}

const STATUS_STYLE: Record<
  RealtimeStatus,
  { dot: string; label: string }
> = {
  idle: { dot: "bg-muted-foreground/40", label: "Idle" },
  connecting: { dot: "bg-amber-400", label: "Connecting…" },
  subscribed: { dot: "bg-emerald-500", label: "Realtime OK" },
  channel_error: { dot: "bg-red-500", label: "Channel error" },
  timed_out: { dot: "bg-red-500", label: "Timed out" },
  closed: { dot: "bg-muted-foreground/50", label: "Closed" },
};

/**
 * Compact Realtime debug strip for GamePage.
 * Visible when:
 *  - ?debug=1 or ?debug=realtime in the URL, or
 *  - localStorage.recess_debug_realtime === "1", or
 *  - force={true}
 */
export function RealtimeDebugHud({
  status,
  lastEventAt,
  lastEventType,
  slug,
  eventCount,
  force = false,
}: Props) {
  const visible = useMemo(() => {
    if (force) return true;
    if (typeof window === "undefined") return false;
    try {
      const q = new URLSearchParams(window.location.search);
      const d = (q.get("debug") || "").toLowerCase();
      if (d === "1" || d === "true" || d === "realtime") return true;
      if (localStorage.getItem("recess_debug_realtime") === "1") return true;
    } catch {
      /* ignore */
    }
    return false;
  }, [force]);

  if (!visible) return null;

  const style = STATUS_STYLE[status] ?? STATUS_STYLE.idle;
  const shortSlug = slug.length > 12 ? `${slug.slice(0, 8)}…` : slug;

  return (
    <div
      className="mx-auto mb-3 w-full max-w-md rounded-2xl border border-border/70 bg-card/90 px-3 py-2 text-[11px] shadow-chip backdrop-blur"
      role="status"
      aria-label="Realtime debug"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`relative flex h-2 w-2 shrink-0 rounded-full ${style.dot}`}
            aria-hidden
          >
            {(status === "subscribed" || status === "connecting") && (
              <span
                className={`absolute inset-0 animate-ping rounded-full opacity-40 ${
                  status === "subscribed" ? "bg-emerald-400" : "bg-amber-300"
                }`}
              />
            )}
          </span>
          <span className="font-semibold tracking-tight text-foreground">
            {style.label}
          </span>
        </div>
        <span className="shrink-0 font-mono text-muted-foreground">{shortSlug}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-muted-foreground">
        <span>events: {eventCount}</span>
        <span>last: {lastEventType ?? "—"}</span>
        <span>{formatAge(lastEventAt)}</span>
      </div>
    </div>
  );
}
