import type { Difficulty } from "@/lib/design-tokens";

export type AiProfileId = "mr_r" | "kojo" | "bra_kojo";

export type AiProfile = {
  id: AiProfileId;
  name: string;
  difficulty: Difficulty;
  line: string;
};

export const AI_PROFILES: AiProfile[] = [
  {
    id: "mr_r",
    name: "Mr. R",
    difficulty: "beginner",
    line: "Warm-up pace. Leaves a door open on purpose.",
  },
  {
    id: "kojo",
    name: "Kojo",
    difficulty: "intermediate",
    line: "Pays attention. Still human enough to beat.",
  },
  {
    id: "bra_kojo",
    name: "Bra Kojo",
    difficulty: "expert",
    line: "Does not gift free points. Earn the win.",
  },
];

export function profileById(id: string | null | undefined): AiProfile {
  return AI_PROFILES.find((p) => p.id === id) ?? AI_PROFILES[1];
}

export function difficultyForProfile(id: string | null | undefined): Difficulty {
  return profileById(id).difficulty;
}
