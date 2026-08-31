/** Non-intrusive ad placement — pluggable network adapter. */

export type AdPlacement =
  | "landing_footer"
  | "post_match"
  | "between_rounds"
  | "tournament_lobby";

export type AdContext = {
  placement: AdPlacement;
  gameType?: string;
  tier?: string;
  suppressAds?: boolean;
};

export type AdCreative = {
  id: string;
  headline: string;
  body: string;
  cta: string;
  href: string;
  sponsor?: string;
};

type Adapter = {
  fetchCreative(ctx: AdContext): Promise<AdCreative | null>;
};

const KEYWORDS: Record<string, string[]> = {
  tic_tac_toe: ["casual games", "puzzle", "focus"],
  pong: ["arcade", "reflex", "sports"],
  rock_paper_scissors: ["party games", "quick play"],
  hangman: ["word games", "vocabulary"],
  word_scramble: ["word games", "learning"],
  twenty_questions: ["trivia", "party"],
  default: ["indie games", "mobile friendly"],
};

export function relevanceKeywords(gameType?: string): string[] {
  if (!gameType) return KEYWORDS.default;
  return KEYWORDS[gameType] ?? KEYWORDS.default;
}

let adapter: Adapter = {
  async fetchCreative(ctx) {
    if (ctx.suppressAds) return null;
    if (ctx.placement === "between_rounds") return null;
    const kw = relevanceKeywords(ctx.gameType);
    return {
      id: `local-${ctx.placement}`,
      headline: "Play more on Recess",
      body: `Casual multiplayer · ${kw[0] ?? "game"} vibes. No account needed.`,
      cta: "Explore games",
      href: "/#games",
      sponsor: "Recess",
    };
  },
};

export function setAdAdapter(next: Adapter): void {
  adapter = next;
}

export async function loadAd(ctx: AdContext): Promise<AdCreative | null> {
  try {
    return await adapter.fetchCreative(ctx);
  } catch {
    return null;
  }
}

const lastShown: Partial<Record<AdPlacement, number>> = {};
const COOLDOWN_MS: Partial<Record<AdPlacement, number>> = {
  post_match: 8 * 60 * 1000,
  landing_footer: 0,
  tournament_lobby: 5 * 60 * 1000,
};

export function shouldShowAd(placement: AdPlacement): boolean {
  const cd = COOLDOWN_MS[placement] ?? 60_000;
  const last = lastShown[placement] ?? 0;
  return Date.now() - last >= cd;
}

export function markAdShown(placement: AdPlacement): void {
  lastShown[placement] = Date.now();
}
