/** Tiered tournament access model. */

export type AccessTier = "free" | "plus" | "pro";

export type TournamentCapability =
  | "join_open_bracket"
  | "join_ranked"
  | "create_private_bracket"
  | "custom_rules"
  | "ad_free"
  | "priority_matchmaking"
  | "share_bracket_badge";

const TIER_RANK: Record<AccessTier, number> = {
  free: 0,
  plus: 1,
  pro: 2,
};

const CAPABILITIES: Record<AccessTier, TournamentCapability[]> = {
  free: ["join_open_bracket", "share_bracket_badge"],
  plus: ["join_open_bracket", "join_ranked", "share_bracket_badge", "ad_free"],
  pro: [
    "join_open_bracket",
    "join_ranked",
    "create_private_bracket",
    "custom_rules",
    "ad_free",
    "priority_matchmaking",
    "share_bracket_badge",
  ],
};

export function tierAtLeast(user: AccessTier, required: AccessTier): boolean {
  return TIER_RANK[user] >= TIER_RANK[required];
}

export function can(user: AccessTier, capability: TournamentCapability): boolean {
  return CAPABILITIES[user].includes(capability);
}

export type TournamentMeta = {
  id: string;
  name: string;
  gameType: string;
  minTier: AccessTier;
  status: "upcoming" | "open" | "live" | "closed";
  startsAt?: number;
};

export function visibleTournaments(
  all: TournamentMeta[],
  userTier: AccessTier,
): TournamentMeta[] {
  return all.filter((t) => tierAtLeast(userTier, t.minTier));
}

const TIER_KEY = "recess_access_tier";

export function getLocalTier(): AccessTier {
  try {
    const v = localStorage.getItem(TIER_KEY);
    if (v === "plus" || v === "pro" || v === "free") return v;
  } catch {
    /* ignore */
  }
  return "free";
}

export function setLocalTier(tier: AccessTier): void {
  try {
    localStorage.setItem(TIER_KEY, tier);
  } catch {
    /* ignore */
  }
}

export const TIER_COPY: Record<
  AccessTier,
  { name: string; price: string; perks: string[] }
> = {
  free: {
    name: "Recess Free",
    price: "$0",
    perks: ["Open brackets", "All casual games", "Share results"],
  },
  plus: {
    name: "Recess Plus",
    price: "Coming soon",
    perks: ["Ranked weekly", "Ad-light experience", "Badge on shares"],
  },
  pro: {
    name: "Recess Pro",
    price: "Coming soon",
    perks: ["Private brackets", "Custom rules", "Priority matchmaking"],
  },
};
