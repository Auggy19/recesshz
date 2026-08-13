import { cn } from "@/lib/utils";

interface AppIconProps {
  /**
   * Tile treatment:
   * - "amber": amber tile + white R — the app icon (matches logo.svg / favicon)
   * - "ink":   ink tile + amber R — the reversed launcher tile
   */
  variant?: "amber" | "ink";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  sm: { tile: "size-10 rounded-[28%] text-lg" },
  md: { tile: "size-14 rounded-[30%] text-2xl" },
  lg: { tile: "size-20 rounded-[32%] text-4xl" },
  xl: { tile: "size-28 rounded-[34%] text-6xl" },
} as const;

/**
 * The Recess app icon — a rounded tile with the R, the same mark as the
 * favicon. Use it like a launcher icon wherever the app needs to be
 * recognized at a glance.
 */
export function AppIcon({ variant = "amber", size = "md", className }: AppIconProps) {
  const s = sizes[size];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex select-none items-center justify-center font-black leading-none",
        s.tile,
        variant === "amber"
          ? "bg-gradient-to-b from-primary to-primary-deep text-white"
          : "bg-foreground text-primary",
        className,
      )}
    >
      R
    </span>
  );
}
