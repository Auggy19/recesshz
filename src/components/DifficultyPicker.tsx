import { AI_PROFILES } from "@/lib/ai/profiles";
import type { Difficulty } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

type Props = {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
  className?: string;
};

export function DifficultyPicker({ value, onChange, className }: Props) {
  const active = AI_PROFILES.find((p) => p.difficulty === value) ?? AI_PROFILES[1];
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Opponent
      </p>
      <div className="flex flex-wrap gap-2">
        {AI_PROFILES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.difficulty)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-bold transition-all",
              value === p.difficulty
                ? "bg-gradient-to-b from-primary to-primary-deep text-white shadow-btn-amber"
                : "border border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {p.name}
          </button>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{active.line}</p>
    </div>
  );
}
