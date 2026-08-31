/**
 * Tiered tournament access model for Recess.
 * Client-side catalog + entitlement checks; billing can plug in later.
 */

export type AccessTier = "free" | "plus" | "pro";

export type TournamentTier = {
  id: string;
  name: string;
  description: string;
  minTier: AccessTier;
  maxPlayers: number;
  entryLabel: string;
  accent: "amber" | "emerald" | "violet";
};

export const TIER_RANK: Record<AccessTier, number> = {
  free: 0,
  plus: 1,
  pro: 2,
};

export const TIER_LABELS: Record<AccessTier, string> = {
  free: "Free",
  plus: "Plus",
  pro: "Pro",
};

export const TOURNAMENTS: TournamentTier[] = [
  {
    id: "playground",
    name: "Playground Cup",
    description: "Casual weekend brackets. Open to everyone.",
    minTier: "free",
    maxPlayers: 8,
    entryLabel: "Free entry",
    accent: "amber",
  },
  {
    id: "rival",
    name: "Rival Series",
    description: "Seeded best-of-three. Plus members and above.",
    minTier: "plus",
    maxPlayers: 16,
    entryLabel: "Plus+",
    accent: "emerald",
  },
  {
    id: "grand",
    name: "Grand Recess",
    description: "Season finals with public leaderboard. Pro only.",
    minTier: "pro",
    maxPlayers: 32,
    entryLabel: "Pro",
    accent: "violet",
  },
];

const TIER_KEY = "recess_access_tier";

export function getAccessTier(): AccessTier {
  try {
    const v = localStorage.getItem(TIER_KEY);
    if (v === "plus" || v === "pro" || v === "free") return v;
  } catch {
    /* ignore */
  }
  return "free";
}

export function setAccessTier(tier: AccessTier): void {
  try {
    localStorage.setItem(TIER_KEY, tier);
  } catch {
    /* ignore */
  }
}

export function canEnterTournament(
  tournamentId: string,
  userTier: AccessTier = getAccessTier(),
): boolean {
  const t = TOURNAMENTS.find((x) => x.id === tournamentId);
  if (!t) return false;
  return TIER_RANK[userTier] >= TIER_RANK[t.minTier];
}

export function tournamentsForTier(userTier: AccessTier = getAccessTier()) {
  return TOURNAMENTS.map((t) => ({
    ...t,
    locked: TIER_RANK[userTier] < TIER_RANK[t.minTier],
  }));
}
