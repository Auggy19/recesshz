import { Lock, Trophy } from "lucide-react";
import {
  TIER_LABELS,
  type AccessTier,
  tournamentsForTier,
} from "@/lib/tournaments";
import { cn } from "@/lib/utils";

const ACCENT: Record<string, string> = {
  amber: "from-amber-400 to-amber-600",
  emerald: "from-emerald-400 to-emerald-600",
  violet: "from-violet-400 to-violet-600",
};

type Props = {
  tier?: AccessTier;
  className?: string;
};

export function TournamentList({ tier, className }: Props) {
  const rows = tournamentsForTier(tier);
  return (
    <div className={cn("grid gap-3 sm:grid-cols-3", className)}>
      {rows.map((t) => (
        <div
          key={t.id}
          className={cn(
            "relative flex flex-col rounded-2xl border border-border bg-card p-4 shadow-soft",
            t.locked && "opacity-75",
          )}
        >
          <div
            className={cn(
              "mb-3 flex size-10 items-center justify-center rounded-xl bg-gradient-to-b text-white shadow-sm",
              ACCENT[t.accent] ?? ACCENT.amber,
            )}
          >
            <Trophy className="size-5" strokeWidth={2.25} />
          </div>
          <h3 className="font-display text-base font-black tracking-tight">
            {t.name}
          </h3>
          <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
            {t.description}
          </p>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs font-bold">
            <span className="text-muted-foreground">
              {t.maxPlayers} players · {t.entryLabel}
            </span>
            {t.locked ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Lock className="size-3.5" />
                {TIER_LABELS[t.minTier]}
              </span>
            ) : (
              <span className="text-primary">Open</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
