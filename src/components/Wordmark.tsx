import { cn } from "@/lib/utils";

interface WordmarkProps {
  /**
   * Which background the wordmark sits on:
   * - "light": cream/white bg — amber R + ink "ecess"
   * - "dark":  ink/black bg — amber R + white "ecess"
   * - "amber": amber bg (reversed) — white R + white "ecess"
   */
  tone?: "light" | "dark" | "amber";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  sm: { word: "text-lg", r: "text-xl" },
  md: { word: "text-2xl", r: "text-[1.75rem]" },
  lg: { word: "text-4xl", r: "text-5xl" },
  xl: { word: "text-6xl", r: "text-7xl" },
} as const;

/**
 * The Recess wordmark — the icon IS the R, "ecess" follows. One R, not two.
 * The R renders in brand amber (or reversed to white on amber backgrounds)
 * and carries the "icon" weight; the letters after it are the supporting type.
 */
export function Wordmark({ tone = "light", size = "md", className }: WordmarkProps) {
  const s = sizes[size];
  const rColor = tone === "amber" ? "text-white" : "text-primary";
  const wordColor = tone === "light" ? "text-foreground" : "text-white";

  return (
    <span
      className={cn(
        "inline-flex select-none items-baseline font-display font-black tracking-tight",
        s.word,
        className,
      )}
    >
      <span aria-hidden className={cn("leading-none", s.r, rColor)}>
        R
      </span>
      <span className={cn(wordColor)}>ecess</span>
    </span>
  );
}
