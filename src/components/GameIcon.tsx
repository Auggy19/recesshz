/**
 * Cohesive Lucide-based game icons for Recess.
 * Use on Landing cards, room chips, and in-game headers.
 */
import {
  CircleHelp,
  Grid3X3,
  Hand,
  Layers,
  Radio,
  Shuffle,
  Sparkles,
  Swords,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACCENT_CLASSES,
  getGameEntry,
  type GameAccent,
  type GameIconId,
  type SupportedGameType,
} from "@/lib/gameCatalog";

const ICON_MAP: Record<GameIconId, LucideIcon> = {
  grid: Grid3X3,
  hand: Hand,
  cards: Layers,
  paddle: Radio,
  help: CircleHelp,
  gallows: Swords,
  scramble: Shuffle,
  spark: Sparkles,
};

type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, { box: string; icon: string }> = {
  sm: { box: "size-8 rounded-xl", icon: "size-4" },
  md: { box: "size-11 rounded-2xl", icon: "size-5" },
  lg: { box: "size-14 rounded-[1.15rem]", icon: "size-7" },
};

export type GameIconProps = {
  gameType?: string | SupportedGameType;
  icon?: GameIconId;
  accent?: GameAccent;
  size?: Size;
  /** Filled gradient tile (default) or soft tint */
  variant?: "solid" | "soft" | "ghost";
  className?: string;
  title?: string;
};

export function GameIcon({
  gameType,
  icon,
  accent,
  size = "md",
  variant = "solid",
  className,
  title,
}: GameIconProps) {
  const entry = getGameEntry(gameType);
  const iconId = icon ?? entry?.icon ?? "spark";
  const accentKey = accent ?? entry?.accent ?? "amber";
  const Icon = ICON_MAP[iconId] ?? Sparkles;
  const s = SIZE[size];
  const a = ACCENT_CLASSES[accentKey];

  return (
    <span
      title={title ?? entry?.name}
      aria-hidden={!title}
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        s.box,
        variant === "solid" &&
          `bg-gradient-to-b ${a.tile} text-white shadow-sm`,
        variant === "soft" && `${a.soft} ${a.text} ring-1 ${a.ring}`,
        variant === "ghost" && a.text,
        className,
      )}
    >
      <Icon className={s.icon} strokeWidth={2.25} />
    </span>
  );
}

/** Room-picker chip with icon + short label. */
export function GameChip({
  gameType,
  selected,
  onClick,
  disabled,
}: {
  gameType: SupportedGameType | string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const entry = getGameEntry(gameType);
  if (!entry) return null;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold transition-all",
        selected
          ? "bg-gradient-to-b from-primary to-primary-deep text-white shadow-btn-amber"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
      )}
    >
      <GameIcon
        gameType={entry.type}
        size="sm"
        variant={selected ? "ghost" : "soft"}
        className={cn(
          selected && "!bg-transparent !text-white !shadow-none size-5 rounded-md",
        )}
      />
      {entry.shortName}
    </button>
  );
}
