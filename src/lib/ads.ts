/**
 * Non-intrusive ad placement adapter.
 * Network-agnostic: configure via VITE_AD_NETWORK; falls back to no-op / house promo.
 *
 * Providers: none | house | adsense | gam | custom
 * Never mid-move interstitials. Pro tier suppresses most surface ads.
 */

export type AdSlotId =
  | "landing_footer"
  | "game_idle"
  | "post_match"
  | "tournament_list";

export type AdContext = {
  slot: AdSlotId;
  gameType?: string;
  tier?: string;
  path?: string;
};

export type AdCreative = {
  id: string;
  headline: string;
  body: string;
  cta: string;
  href: string;
  weight: "soft" | "standard";
};

const NETWORK = (import.meta.env.VITE_AD_NETWORK as string | undefined) ?? "none";
const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;

const HOUSE: AdCreative[] = [
  {
    id: "house-pwa",
    headline: "Keep Recess one tap away",
    body: "Add to Home Screen for faster challenges.",
    cta: "How to install",
    href: "/#how-it-works",
    weight: "soft",
  },
  {
    id: "house-live",
    headline: "Try live Pong",
    body: "When both of you are free, go live for aim previews.",
    cta: "Open Pong",
    href: "/?game=pong",
    weight: "soft",
  },
  {
    id: "house-quiet",
    headline: "Silence is safe here",
    body: "No timers. No accounts. Play at chat pace.",
    cta: "See games",
    href: "/#games",
    weight: "soft",
  },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function resolveAd(ctx: AdContext): AdCreative | null {
  if (NETWORK === "none") return null;
  if (ctx.tier === "pro" && ctx.slot !== "tournament_list") return null;

  if (
    NETWORK === "house" ||
    NETWORK === "adsense" ||
    NETWORK === "gam" ||
    NETWORK === "custom"
  ) {
    const pool = HOUSE.filter((c) => {
      if (ctx.slot === "post_match") return true;
      if (ctx.gameType === "pong" && c.id === "house-live") return true;
      if (ctx.slot === "landing_footer") return c.id !== "house-live";
      return true;
    });
    if (pool.length === 0) return null;
    const key = `${ctx.slot}:${ctx.gameType ?? ""}:${ctx.path ?? ""}`;
    return pool[hash(key) % pool.length]!;
  }
  return null;
}

export function adsEnabled(): boolean {
  return NETWORK !== "none";
}

export function adNetworkName(): string {
  return NETWORK;
}

export function ensureAdNetworkScript(): void {
  if (typeof document === "undefined") return;
  if (NETWORK === "adsense" && ADSENSE_CLIENT) {
    if (document.getElementById("recess-adsense")) return;
    const s = document.createElement("script");
    s.id = "recess-adsense";
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`;
    s.crossOrigin = "anonymous";
    document.head.appendChild(s);
  }
}
