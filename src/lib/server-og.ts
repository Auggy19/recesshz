// ---------------------------------------------------------------------------
// Server-side Open Graph baking for /play/:slug (used by main.ts).
//
// WhatsApp / Instagram / Facebook crawlers don't execute JavaScript, so the
// SPA's client-side <meta> updates never reach them — the server fetches the
// game's (public, read-only) metadata from Convex and injects og:title /
// og:description / og:image into index.html before responding. These are
// pure functions so the exact HTML a crawler receives is unit-testable
// without a running server.
//
// Kept in sync with src/lib/og.ts (the client-side template system) —
// deliberately: this is the only path crawlers see on /play/:slug, so it
// must render the same Template-1 card the SPA does.
// ---------------------------------------------------------------------------

/** Per-game display names for preview copy. */
export const OG_GAME_LABELS: Record<string, string> = {
  tic_tac_toe: "Tic Tac Toe",
  rock_paper_scissors: "Rock Paper Scissors",
  red_or_black: "Red or Black",
  pong: "Pong",
  twenty_questions: "Twenty Questions",
};

/** Per-game card thumbnails, falling back to the brand card. */
export const OG_GAME_IMAGES: Record<string, string> = {
  tic_tac_toe: "/og-tic-tac-toe.png",
  rock_paper_scissors: "/og-rock-paper-scissors.png",
  red_or_black: "/og-red-or-black.png",
  pong: "/og-pong.png",
  twenty_questions: "/og-twenty-questions.png",
};

export function ogLabelFor(gameType: string): string {
  return OG_GAME_LABELS[gameType] ?? "Recess";
}

export function ogImageFor(gameType: string): string {
  return OG_GAME_IMAGES[gameType] ?? "/og-app.png";
}

export interface OgMeta {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
}

/**
 * Status-aware title for the game invite card.
 * - waiting / in_progress: an invitation to act — the primary share scenario.
 * - completed: neutral (the server never exposes who won), keeps the game name.
 * - abandoned: the game went quiet.
 */
export function ogTitleFor(status: string, gameType: string): string {
  const label = ogLabelFor(gameType);
  switch (status) {
    case "completed":
      return `${label} — Game Over`;
    case "abandoned":
      return "Recess — This game went quiet";
    default:
      return `${label} — Your Turn`;
  }
}

export function ogDescriptionFor(status: string, gameType: string): string {
  const label = ogLabelFor(gameType);
  if (status === "waiting") {
    return `You've been challenged to a game of ${label}. Tap to play — works on any chat app.`;
  }
  if (status === "abandoned") {
    return `A game of ${label} went quiet after 48 hours. Start a fresh one — silence is safe here.`;
  }
  return `A game of ${label} is waiting for you. Tap to play — works on any chat app.`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Bake an OgMeta into a copy of the served HTML: replaces the existing
 * og:/twitter: tags where present, otherwise appends them before </head>.
 * Image URLs are made absolute against the request origin so crawlers
 * (WhatsApp especially) can resolve them.
 */
export function injectOgTags(html: string, meta: OgMeta, url: string): string {
  const origin = new URL(url).origin;
  const tags: Array<[key: string, attr: "property" | "name", content: string]> =
    [
      ["og:title", "property", meta.title],
      ["og:description", "property", meta.description],
      ["og:image", "property", `${origin}${meta.image}`],
      ["og:url", "property", url],
      ["twitter:card", "name", "summary_large_image"],
      ["twitter:title", "name", meta.title],
      ["twitter:description", "name", meta.description],
      ["twitter:image", "name", `${origin}${meta.image}`],
      ["og:image:alt", "property", meta.imageAlt],
    ];
  let out = html;
  for (const [key, attr, content] of tags) {
    const tag = `<meta ${attr}="${key}" content="${escapeHtml(content)}" />`;
    const re = new RegExp(`<meta\\s+${attr}="${key}"[^>]*>`);
    out = re.test(out)
      ? out.replace(re, tag)
      : out.replace("</head>", `  ${tag}\n</head>`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Bounded TTL cache — crawlers re-scrape the same link repeatedly, and game
// status changes are picked up on the next crawl, so 60s is plenty. The cap
// keeps the map from growing without bound: every shared game uses a unique
// UUID slug, so an unbounded cache would leak one entry per game forever.
// ---------------------------------------------------------------------------

export interface TtlCache<V> {
  get(key: string): V | null;
  set(key: string, value: V): void;
  readonly size: number;
}

export function createTtlCache<V>(opts: {
  ttlMs: number;
  maxEntries: number;
}): TtlCache<V> {
  const map = new Map<string, { value: V; at: number }>();
  return {
    get(key) {
      const hit = map.get(key);
      if (!hit) return null;
      if (Date.now() - hit.at > opts.ttlMs) {
        map.delete(key);
        return null;
      }
      return hit.value;
    },
    set(key, value) {
      // Delete-then-set refreshes recency (Map iterates in insertion order).
      map.delete(key);
      map.set(key, { value, at: Date.now() });
      // Evict the oldest entries beyond the cap (least-recently inserted).
      while (map.size > opts.maxEntries) {
        const oldest = map.keys().next().value;
        if (oldest === undefined) break;
        map.delete(oldest);
      }
    },
    get size() {
      return map.size;
    },
  };
}
