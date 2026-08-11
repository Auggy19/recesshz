import { cn } from "@/lib/utils";

interface WordmarkProps {
  /** Tone picks the color of the "ecess" letters against the background. */
  tone?: "ink" | "cream" | "amber";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  sm: { word: "text-lg", tile: "size-5 rounded-[6px] text-[11px]" },
  md: { word: "text-2xl", tile: "size-7 rounded-lg text-sm" },
  lg: { word: "text-4xl", tile: "size-10 rounded-xl text-lg" },
  xl: { word: "text-6xl", tile: "size-16 rounded-2xl text-3xl" },
} as const;

/**
 * The Recess wordmark — the icon IS the R, "ecess" follows. One R, not two.
 * An amber tile holds the R; the letters after it are the brand's ink.
 */
export function Wordmark({ tone = "ink", size = "md", className }: WordmarkProps) {
  const s = sizes[size];
  return (
    <span
      className={cn(
        "inline-flex select-none items-center gap-1.5 font-black tracking-tight",
        s.word,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center bg-primary leading-none text-white",
          s.tile,
        )}
      >
        R
      </span>
      <span
        className={cn(
          tone === "cream" || tone === "amber" ? "text-white" : "text-foreground",
        )}
      >
        ecess
      </span>
    </span>
  );
}
