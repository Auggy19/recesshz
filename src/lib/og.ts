// ---------------------------------------------------------------------------
// Recess Open Graph (link preview) templates.
//
// Two cards, chosen by what's being shared:
//
//   Template 1 — a specific game invite (a room link like
//   ?room=ABC123&game=tic-tac-toe, or /play/:slug):
//       title "[Game] — Your Turn", a challenge description, and that game's
//       board thumbnail (public/og-<game>.png).
//
//   Template 2 — the bare app link (no room/game params): the brand card
//       "Recess — Silence is safe here." with the app description and the
//       logo-on-amber image (public/og-app.png).
//
// Where the tags get set:
//   - index.html ships Template 2 as the static defaults (what a non-JS
//     crawler sees on the bare root link) plus an inline head script that
//     swaps to Template 1 the moment ?room=&game= params are present.
//   - Landing refreshes them for the root URL.
//   - GamePage sets status-aware titles on /play/:slug.
// ---------------------------------------------------------------------------

export const OG_GAME_NAMES: Record<string, string> = {
  tic_tac_toe: "Tic Tac Toe",
  rock_paper_scissors: "Rock Paper Scissors",
  red_or_black: "Red or Black",
  pong: "Pong",
  twenty_questions: "Twenty Questions",
};

export const OG_GAME_IMAGES: Record<string, string> = {
  tic_tac_toe: "/og-tic-tac-toe.png",
  rock_paper_scissors: "/og-rock-paper-scissors.png",
  red_or_black: "/og-red-or-black.png",
  pong: "/og-pong.png",
  twenty_questions: "/og-twenty-questions.png",
};

export const OG_BRAND_TITLE = "Recess — Silence is safe here.";
export const OG_BRAND_DESCRIPTION =
  "Turn any chat lull into a quick game. No login, no download — just tap and play. Works on WhatsApp, iMessage, Telegram, and more.";
export const OG_BRAND_IMAGE = "/og-app.png";
export const OG_BRAND_IMAGE_ALT =
  "Recess — turn any chat lull into a quick game.";

export const OG_CHALLENGE_DESCRIPTION =
  "You've been challenged to a game. Tap to play — works on any chat app.";

export interface OgMeta {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
}

/**
 * Map a friendly ?game= value to the server game type. Mirrors the alias set
 * in `urlGameToType` on the Landing page (kept in sync deliberately — the
 * inline head script in index.html uses the same set).
 */
export function gameKeyFromParam(raw: string | null): string | null {
  if (!raw) return null;
  switch (raw.toLowerCase().replace(/-/g, "_")) {
    case "tic_tac_toe":
    case "ttt":
      return "tic_tac_toe";
    case "rock_paper_scissors":
    case "rps":
      return "rock_paper_scissors";
    case "red_or_black":
    case "redblack":
    case "rnb":
      return "red_or_black";
    case "pong":
    case "ping_pong":
      return "pong";
    case "twenty_questions":
    case "20_questions":
    case "tq":
      return "twenty_questions";
    default:
      return null;
  }
}

/** Template 1 — a specific game invite. */
export function gameInviteMeta(gameType: string): OgMeta {
  const name = OG_GAME_NAMES[gameType] ?? "Game";
  return {
    title: `${name} — Your Turn`,
    description: OG_CHALLENGE_DESCRIPTION,
    image: OG_GAME_IMAGES[gameType] ?? OG_BRAND_IMAGE,
    imageAlt: `A game of ${name} waiting for you.`,
  };
}

/** Template 2 — the bare app link. */
export function brandMeta(): OgMeta {
  return {
    title: OG_BRAND_TITLE,
    description: OG_BRAND_DESCRIPTION,
    image: OG_BRAND_IMAGE,
    imageAlt: OG_BRAND_IMAGE_ALT,
  };
}

/**
 * Decide which template applies for a URL's query string. A room link with a
 * known game type is a game invite; everything else (bare root, unknown
 * params) gets the brand card.
 */
export function resolveOgMeta(search: string): OgMeta {
  const params = new URLSearchParams(search);
  const gameKey = gameKeyFromParam(params.get("game"));
  if (params.get("room") && gameKey) return gameInviteMeta(gameKey);
  return brandMeta();
}

/**
 * Write an OgMeta into the document: tab title plus og:/twitter: tags.
 * Image URLs are made absolute (crawlers like WhatsApp need them to resolve).
 */
export function applyOgMeta(meta: OgMeta, canonicalUrl?: string): void {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const absolute = (path: string) =>
    path.startsWith("http") ? path : `${origin}${path}`;

  document.title = meta.title;

  const set = (attr: "property" | "name", key: string, content: string) => {
    let tag = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attr, key);
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", content);
  };

  set("property", "og:title", meta.title);
  set("name", "twitter:title", meta.title);
  set("property", "og:description", meta.description);
  set("name", "twitter:description", meta.description);
  const image = absolute(meta.image);
  set("property", "og:image", image);
  set("name", "twitter:image", image);
  set("property", "og:image:alt", meta.imageAlt);
  if (canonicalUrl) set("property", "og:url", canonicalUrl);
}
