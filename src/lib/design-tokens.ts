/**
 * Recess design tokens — sophisticated premium palette.
 * Warm champagne/amber primary, deep ink neutrals, restrained game accents.
 */

export const palette = {
  amber: {
    50: "#FFFBEB",
    100: "#FEF3C7",
    200: "#FDE68A",
    300: "#FCD34D",
    400: "#FBBF24",
    500: "#F5A623",
    600: "#D97706",
    700: "#B45309",
    800: "#92400E",
    900: "#78350F",
  },
  ink: {
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
    400: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#334155",
    800: "#1E293B",
    900: "#0F172A",
    brand: "#1A1A1A",
  },
  cream: "#FFF9E5",
  champagne: "#F7E7C6",
  emerald: { 400: "#34D399", 500: "#10B981", 600: "#059669" },
  sky: { 400: "#38BDF8", 500: "#0EA5E9", 600: "#0284C7" },
  rose: { 400: "#FB7185", 500: "#F43F5E", 600: "#E11D48" },
  violet: { 400: "#A78BFA", 500: "#8B5CF6", 600: "#7C3AED" },
  orange: { 400: "#FB923C", 500: "#F97316", 600: "#C2410C" },
} as const;

/** Deep, premium gradients for game tiles (less toy, more product). */
export const gameGradients = {
  amber: "from-[#F5A623] to-[#B45309]",
  sky: "from-[#38BDF8] to-[#0369A1]",
  rose: "from-[#FB7185] to-[#BE123C]",
  emerald: "from-[#34D399] to-[#047857]",
  violet: "from-[#A78BFA] to-[#6D28D9]",
  slate: "from-[#94A3B8] to-[#334155]",
  orange: "from-[#FB923C] to-[#C2410C]",
} as const;

export type Difficulty = "beginner" | "intermediate" | "expert";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  expert: "Expert",
};

export const DIFFICULTY_BLURBS: Record<Difficulty, string> = {
  beginner: "Forgiving play — great while you learn the ropes.",
  intermediate: "Balanced challenge — mistakes matter.",
  expert: "Sharp play — few openings, no free points.",
};

/** Alias used by DifficultyPicker / singlePlayer. */
export const DIFFICULTY_HINTS = DIFFICULTY_BLURBS;
