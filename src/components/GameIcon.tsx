/**
 * High-contrast Recess game icons — sharp silhouettes on smooth gradient tiles.
 */
import { cn } from "@/lib/utils";
import {
  ACCENT_CLASSES,
  getGameEntry,
  type GameAccent,
  type GameIconId,
  type SupportedGameType,
} from "@/lib/gameCatalog";

type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, { box: string }> = {
  sm: { box: "size-8 rounded-xl" },
  md: { box: "size-11 rounded-2xl" },
  lg: { box: "size-14 rounded-[1.15rem]" },
};

/** Stylized single-path silhouettes — high visibility at small sizes. */
function Silhouette({ id }: { id: GameIconId }) {
  switch (id) {
    case "grid":
      return (
        <g fill="currentColor" stroke="none">
          <path d="M5 5h5.5v5.5H5V5zm8.5 0H19v5.5h-5.5V5zM5 13.5H10.5V19H5v-5.5zm8.5 0H19V19h-5.5v-5.5z" opacity="0.35" />
          <path d="M6.2 6.2l3.1 3.1M9.3 6.2L6.2 9.3M14.7 14.7l3.1 3.1M17.8 14.7l-3.1 3.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <circle cx="16.5" cy="7.8" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </g>
      );
    case "hand":
      return (
        <g fill="currentColor">
          <path d="M8 14c0-1.2.5-2.2 1.3-2.9V8.2a1.4 1.4 0 0 1 2.8 0v1.2a1.3 1.3 0 0 1 2.5-.4V8.6a1.4 1.4 0 0 1 2.8 0v5.1c0 2.8-2.1 5-4.8 5.3A5 5 0 0 1 8 14z" />
        </g>
      );
    case "cards":
      return (
        <g fill="currentColor">
          <rect x="4.5" y="5" width="10" height="14" rx="1.5" opacity="0.4" />
          <rect x="9.5" y="5" width="10" height="14" rx="1.5" />
        </g>
      );
    case "paddle":
      return (
        <g fill="currentColor">
          <rect x="5" y="4" width="3.2" height="16" rx="1.6" />
          <rect x="15.8" y="4" width="3.2" height="16" rx="1.6" opacity="0.45" />
          <circle cx="12" cy="12" r="2.4" />
        </g>
      );
    case "ball":
      return (
        <g fill="currentColor">
          <circle cx="12" cy="12" r="7.2" />
          <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.35" />
          <path
            d="M12 5.2v13.6M5.2 12h13.6"
            stroke="currentColor"
            strokeWidth="1.2"
            opacity="0.4"
            fill="none"
          />
        </g>
      );
    case "help":
      return (
        <g fill="currentColor">
          <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M9.2 9.4c0-1.7 1.3-2.9 2.9-2.9s2.9 1.2 2.9 2.8c0 1.3-.7 2-1.8 2.6-.8.4-1.2.8-1.2 1.6v.4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <circle cx="12" cy="16.8" r="1.15" />
        </g>
      );
    case "gallows":
      return (
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 19h14M7 19V5h9v2" />
          <circle cx="16" cy="10" r="2" strokeWidth="1.7" />
          <path d="M16 12v4.5M14 14.5h4" strokeWidth="1.5" />
        </g>
      );
    case "scramble":
      return (
        <g fill="currentColor">
          <rect x="3.5" y="7" width="7" height="7" rx="1.2" />
          <rect x="13.5" y="7" width="7" height="7" rx="1.2" opacity="0.55" />
          <rect x="8.5" y="12.5" width="7" height="7" rx="1.2" opacity="0.85" />
        </g>
      );
    default:
      return (
        <g fill="currentColor">
          <path d="M12 3.5l1.4 5.2L18.5 10l-5.1 1.3L12 16.5l-1.4-5.2L5.5 10l5.1-1.3L12 3.5z" />
        </g>
      );
  }
}

export type GameIconProps = {
  gameType?: string | SupportedGameType;
  icon?: GameIconId;
  accent?: GameAccent;
  size?: Size;
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
  const s = SIZE[size];
  const a = ACCENT_CLASSES[accentKey];

  return (
    <span
      title={title ?? entry?.name}
      aria-hidden={!title}
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-white",
        s.box,
        variant === "solid" &&
          `bg-gradient-to-br ${a.tile} shadow-[0_2px_8px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.25)] ring-1 ring-black/10`,
        variant === "soft" && `${a.soft} ${a.text} ring-1 ${a.ring}`,
        variant === "ghost" && a.text,
        className,
      )}
    >
      <svg viewBox="0 0 24 24" width="62%" height="62%" className="overflow-visible" aria-hidden>
        <Silhouette id={iconId} />
      </svg>
    </span>
  );
}

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
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <GameIcon
        gameType={entry.type}
        size="sm"
        variant={selected ? "ghost" : "soft"}
        className={cn(
          selected &&
            "!size-5 !rounded-md !bg-transparent !text-white !shadow-none !ring-0",
        )}
      />
      {entry.shortName}
    </button>
  );
}
