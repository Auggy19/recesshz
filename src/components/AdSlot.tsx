import { useMemo } from "react";
import { resolveAd, type AdSlotId } from "@/lib/ads";
import { getAccessTier } from "@/lib/tournaments";

type Props = {
  slot: AdSlotId;
  gameType?: string;
  className?: string;
};

/** Non-intrusive contextual placement. Renders nothing when ads are off / Pro. */
export function AdSlot({ slot, gameType, className }: Props) {
  const creative = useMemo(
    () =>
      resolveAd({
        slot,
        gameType,
        tier: getAccessTier(),
        path: typeof window !== "undefined" ? window.location.pathname : undefined,
      }),
    [slot, gameType],
  );

  if (!creative) return null;

  return (
    <aside
      className={
        className ??
        "mx-auto w-full max-w-md rounded-2xl border border-border/70 bg-card/70 px-4 py-3 text-left shadow-soft backdrop-blur"
      }
      aria-label="Sponsored"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">
        {creative.weight === "soft" ? "From Recess" : "Sponsored"}
      </p>
      <p className="mt-1 text-sm font-bold tracking-tight text-foreground">
        {creative.headline}
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
        {creative.body}
      </p>
      <a
        href={creative.href}
        className="mt-2 inline-flex text-xs font-bold text-primary hover:underline"
      >
        {creative.cta} →
      </a>
    </aside>
  );
}
