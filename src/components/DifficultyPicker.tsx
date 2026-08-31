import {
  DIFFICULTY_HINTS,
  DIFFICULTY_LABELS,
  type Difficulty,
} from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

const ORDER: Difficulty[] = ["beginner", "intermediate", "expert"];

type Props = {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
  className?: string;
};

export function DifficultyPicker({ value, onChange, className }: Props) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Difficulty
      </p>
      <div className="flex flex-wrap gap-2">
        {ORDER.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-bold transition-all",
              value === d
                ? "bg-gradient-to-b from-primary to-primary-deep text-white shadow-btn-amber"
                : "border border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {DIFFICULTY_LABELS[d]}
          </button>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {DIFFICULTY_HINTS[value]}
      </p>
    </div>
  );
}
