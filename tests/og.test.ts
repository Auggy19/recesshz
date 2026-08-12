// ---------------------------------------------------------------------------
// Tests for the Open Graph link-preview templates (src/lib/og.ts).
//
// Two templates: Template 1 (a game invite — room link with ?room=&game=, or
// /play/:slug) and Template 2 (the bare app link). The pure detection/template
// functions need no DOM; applyOgMeta is tested against a minimal document stub.
// Run with `bun test`.
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  OG_BRAND_DESCRIPTION,
  OG_BRAND_IMAGE,
  OG_BRAND_IMAGE_ALT,
  OG_BRAND_TITLE,
  OG_CHALLENGE_DESCRIPTION,
  brandMeta,
  gameInviteMeta,
  gameKeyFromParam,
  resolveOgMeta,
  applyOgMeta,
} from "../src/lib/og";

// --- pure template selection ------------------------------------------------

describe("gameKeyFromParam", () => {
  test("maps every alias, case- and separator-insensitive", () => {
    expect(gameKeyFromParam("tic_tac_toe")).toBe("tic_tac_toe");
    expect(gameKeyFromParam("tic-tac-toe")).toBe("tic_tac_toe");
    expect(gameKeyFromParam("ttt")).toBe("tic_tac_toe");
    expect(gameKeyFromParam("TIC-TAC-TOE")).toBe("tic_tac_toe");
    expect(gameKeyFromParam("rock_paper_scissors")).toBe("rock_paper_scissors");
    expect(gameKeyFromParam("rock-paper-scissors")).toBe("rock_paper_scissors");
    expect(gameKeyFromParam("rps")).toBe("rock_paper_scissors");
    expect(gameKeyFromParam("red_or_black")).toBe("red_or_black");
    expect(gameKeyFromParam("red-or-black")).toBe("red_or_black");
    expect(gameKeyFromParam("redblack")).toBe("red_or_black");
    expect(gameKeyFromParam("rnb")).toBe("red_or_black");
    expect(gameKeyFromParam("pong")).toBe("pong");
    expect(gameKeyFromParam("ping-pong")).toBe("pong");
  });

  test("returns null for missing or unknown values", () => {
    expect(gameKeyFromParam(null)).toBeNull();
    expect(gameKeyFromParam("")).toBeNull();
    expect(gameKeyFromParam("twenty_questions")).toBeNull();
    expect(gameKeyFromParam("tictactoe")).toBeNull(); // no separators
  });
});

describe("template copy (spec)", () => {
  test("game invite: [Game] — Your Turn + challenge description + per-game image", () => {
    const meta = gameInviteMeta("tic_tac_toe");
    expect(meta.title).toBe("Tic Tac Toe — Your Turn");
    expect(meta.description).toBe(OG_CHALLENGE_DESCRIPTION);
    expect(meta.description).toBe(
      "You've been challenged to a game. Tap to play — works on any chat app.",
    );
    expect(meta.image).toBe("/og-tic-tac-toe.png");
    expect(meta.imageAlt).toBe("A game of Tic Tac Toe waiting for you.");

    expect(gameInviteMeta("rock_paper_scissors").title).toBe(
      "Rock Paper Scissors — Your Turn",
    );
    expect(gameInviteMeta("rock_paper_scissors").image).toBe(
      "/og-rock-paper-scissors.png",
    );
    expect(gameInviteMeta("red_or_black").title).toBe("Red or Black — Your Turn");
    expect(gameInviteMeta("red_or_black").image).toBe("/og-red-or-black.png");
    expect(gameInviteMeta("pong").title).toBe("Pong — Your Turn");
    expect(gameInviteMeta("pong").image).toBe("/og-pong.png");
  });

  test("game invite with an unknown game type falls back gracefully", () => {
    const meta = gameInviteMeta("mystery");
    expect(meta.title).toBe("Game — Your Turn");
    expect(meta.image).toBe(OG_BRAND_IMAGE);
  });

  test("brand: Silence is safe here. + app description + logo card", () => {
    const meta = brandMeta();
    expect(meta.title).toBe("Recess — Silence is safe here.");
    expect(meta.description).toBe(OG_BRAND_DESCRIPTION);
    expect(meta.description).toBe(
      "Turn any chat lull into a quick game. No login, no download — just tap and play. Works on WhatsApp, iMessage, Telegram, and more.",
    );
    expect(meta.image).toBe("/og-app.png");
    expect(meta.imageAlt).toBe(OG_BRAND_IMAGE_ALT);
  });
});

describe("resolveOgMeta — which template for which URL", () => {
  test("room + known game -> that game's invite card", () => {
    const meta = resolveOgMeta("?room=ABC123&game=tic-tac-toe");
    expect(meta.title).toBe("Tic Tac Toe — Your Turn");
    expect(meta.image).toBe("/og-tic-tac-toe.png");

    expect(resolveOgMeta("?room=X&game=rps").image).toBe(
      "/og-rock-paper-scissors.png",
    );
    expect(resolveOgMeta("?room=X&game=red_or_black").title).toBe(
      "Red or Black — Your Turn",
    );
    expect(resolveOgMeta("?room=X&game=pong").title).toBe("Pong — Your Turn");
    expect(resolveOgMeta("?room=X&game=pong").image).toBe("/og-pong.png");
  });

  test("bare root (no params) -> brand card", () => {
    const meta = resolveOgMeta("");
    expect(meta.title).toBe(OG_BRAND_TITLE);
    expect(meta.image).toBe(OG_BRAND_IMAGE);
  });

  test("room without a game -> brand (no image to pick)", () => {
    expect(resolveOgMeta("?room=ABC123").title).toBe(OG_BRAND_TITLE);
  });

  test("game without a room -> brand", () => {
    expect(resolveOgMeta("?game=ttt").title).toBe(OG_BRAND_TITLE);
  });

  test("unknown game -> brand", () => {
    expect(resolveOgMeta("?room=X&game=twenty_questions").title).toBe(
      OG_BRAND_TITLE,
    );
  });
});

// --- applyOgMeta (DOM stub) -------------------------------------------------

interface StubTag {
  attrs: Map<string, string>;
  setAttribute(key: string, value: string): void;
  getAttribute(key: string): string | null;
}

function makeStubTag(): StubTag {
  return {
    attrs: new Map(),
    setAttribute(key: string, value: string) {
      this.attrs.set(key, value);
    },
    getAttribute(key: string) {
      return this.attrs.get(key) ?? null;
    },
  };
}

interface StubEnvironment {
  tags: StubTag[];
  title: string;
}

function installDomStub(): StubEnvironment {
  const env: StubEnvironment = { tags: [], title: "" };
  const head = {
    appendChild: (el: StubTag) => {
      env.tags.push(el);
    },
  };
  const doc = {
    title: "",
    head,
    querySelector: (selector: string) => {
      const m = selector.match(/^meta\[(property|name)="([^"]+)"\]$/);
      if (!m) return null;
      const [, attr, key] = m;
      return env.tags.find((t) => t.getAttribute(attr) === key) ?? null;
    },
    createElement: () => makeStubTag(),
  };
  // The module reads document.title, so route it through the stub.
  Object.defineProperty(doc, "title", {
    get: () => env.title,
    set: (v: string) => {
      env.title = v;
    },
  });
  globalThis.document = doc as unknown as Document;
  globalThis.window = { location: { origin: "https://playrecess.freebuff.app" } } as unknown as Window & typeof globalThis;
  return env;
}

describe("applyOgMeta", () => {
  let env: StubEnvironment;
  const savedDoc = globalThis.document;
  const savedWindow = globalThis.window;

  beforeEach(() => {
    env = installDomStub();
  });

  afterEach(() => {
    // Restore the pre-test globals unconditionally — when no document/window
    // existed before (bun test runs files in one process), the stub must be
    // REMOVED again, or later test files that import DOM-dependent modules
    // (e.g. sonner's CSS injection) crash against the stub's missing APIs.
    if (savedDoc) {
      globalThis.document = savedDoc;
    } else {
      delete (globalThis as Record<string, unknown>).document;
    }
    if (savedWindow) {
      globalThis.window = savedWindow;
    } else {
      delete (globalThis as Record<string, unknown>).window;
    }
  });

  test("sets the tab title and writes all og/twitter tags", () => {
    applyOgMeta(brandMeta(), "https://playrecess.freebuff.app/");

    expect(env.title).toBe(OG_BRAND_TITLE);
    const content = (attr: string, key: string) =>
      env.tags.find((t) => t.getAttribute(attr) === key)?.getAttribute("content");

    expect(content("property", "og:title")).toBe(OG_BRAND_TITLE);
    expect(content("name", "twitter:title")).toBe(OG_BRAND_TITLE);
    expect(content("property", "og:description")).toBe(OG_BRAND_DESCRIPTION);
    expect(content("name", "twitter:description")).toBe(OG_BRAND_DESCRIPTION);
    expect(content("property", "og:image:alt")).toBe(OG_BRAND_IMAGE_ALT);
  });

  test("makes image URLs absolute against the page origin", () => {
    applyOgMeta(gameInviteMeta("tic_tac_toe"));
    const image = env.tags.find((t) => t.getAttribute("property") === "og:image");
    expect(image?.getAttribute("content")).toBe(
      "https://playrecess.freebuff.app/og-tic-tac-toe.png",
    );
    const twitter = env.tags.find((t) => t.getAttribute("name") === "twitter:image");
    expect(twitter?.getAttribute("content")).toBe(
      "https://playrecess.freebuff.app/og-tic-tac-toe.png",
    );
  });

  test("sets og:url when a canonical URL is provided", () => {
    applyOgMeta(brandMeta(), "https://playrecess.freebuff.app/");
    const url = env.tags.find((t) => t.getAttribute("property") === "og:url");
    expect(url?.getAttribute("content")).toBe("https://playrecess.freebuff.app/");
  });

  test("updates an existing tag instead of duplicating it", () => {
    // Pre-seed an og:title tag.
    const existing = makeStubTag();
    existing.setAttribute("property", "og:title");
    existing.setAttribute("content", "stale");
    env.tags.push(existing);

    applyOgMeta(gameInviteMeta("red_or_black"));

    const titles = env.tags.filter((t) => t.getAttribute("property") === "og:title");
    expect(titles).toHaveLength(1);
    expect(titles[0].getAttribute("content")).toBe("Red or Black — Your Turn");
  });
});
