// ---------------------------------------------------------------------------
// Tests for the server-side Open Graph baking (src/lib/server-og.ts).
//
// This is the code crawlers (WhatsApp / Instagram / Facebook) actually see on
// /play/:slug — main.ts fetches game metadata from Convex and injects the
// tags with these pure functions. Unlike the client-side system in
// src/lib/og.ts, this path has no DOM: it's string-in, string-out, so it's
// fully testable without stubs. Run with `bun test`.
// ---------------------------------------------------------------------------

import { describe, expect, test } from "bun:test";
import {
  createTtlCache,
  escapeHtml,
  injectOgTags,
  ogDescriptionFor,
  ogImageFor,
  ogLabelFor,
  ogTitleFor,
  type OgMeta,
} from "../src/lib/server-og";

// --- copy and title selection ----------------------------------------------

describe("ogLabelFor", () => {
  test("maps every supported game type", () => {
    expect(ogLabelFor("tic_tac_toe")).toBe("Tic Tac Toe");
    expect(ogLabelFor("rock_paper_scissors")).toBe("Rock Paper Scissors");
    expect(ogLabelFor("red_or_black")).toBe("Red or Black");
    expect(ogLabelFor("pong")).toBe("Pong");
    expect(ogLabelFor("twenty_questions")).toBe("Twenty Questions");
  });

  test("falls back to the Recess brand for unknown types", () => {
    expect(ogLabelFor("mystery")).toBe("Recess");
  });
});

describe("ogTitleFor — Template 1 status titles", () => {
  test("waiting and in_progress both read as an invitation", () => {
    expect(ogTitleFor("waiting", "tic_tac_toe")).toBe(
      "Tic Tac Toe — Your Turn",
    );
    expect(ogTitleFor("in_progress", "tic_tac_toe")).toBe(
      "Tic Tac Toe — Your Turn",
    );
    expect(ogTitleFor("waiting", "pong")).toBe("Pong — Your Turn");
    expect(ogTitleFor("in_progress", "twenty_questions")).toBe(
      "Twenty Questions — Your Turn",
    );
  });

  test("completed stays neutral but keeps the game name", () => {
    expect(ogTitleFor("completed", "rock_paper_scissors")).toBe(
      "Rock Paper Scissors — Game Over",
    );
  });

  test("abandoned gets the quiet-game title", () => {
    expect(ogTitleFor("abandoned", "tic_tac_toe")).toBe(
      "Recess — This game went quiet",
    );
  });

  test("unknown game type falls back to the brand label", () => {
    expect(ogTitleFor("waiting", "mystery")).toBe("Recess — Your Turn");
  });
});

describe("ogDescriptionFor", () => {
  test("waiting: a challenge with the game name", () => {
    expect(ogDescriptionFor("waiting", "tic_tac_toe")).toBe(
      "You've been challenged to a game of Tic Tac Toe. Tap to play — works on any chat app.",
    );
  });

  test("in_progress: a game is waiting", () => {
    expect(ogDescriptionFor("in_progress", "pong")).toBe(
      "A game of Pong is waiting for you. Tap to play — works on any chat app.",
    );
  });

  test("abandoned: start a fresh one", () => {
    expect(ogDescriptionFor("abandoned", "red_or_black")).toBe(
      "A game of Red or Black went quiet after 48 hours. Start a fresh one — silence is safe here.",
    );
  });

  test("unknown game type still names the game as Recess", () => {
    expect(ogDescriptionFor("waiting", "mystery")).toBe(
      "You've been challenged to a game of Recess. Tap to play — works on any chat app.",
    );
  });
});

describe("ogImageFor", () => {
  test("known types resolve to their board thumbnail", () => {
    expect(ogImageFor("tic_tac_toe")).toBe("/og-tic-tac-toe.png");
    expect(ogImageFor("rock_paper_scissors")).toBe(
      "/og-rock-paper-scissors.png",
    );
    expect(ogImageFor("red_or_black")).toBe("/og-red-or-black.png");
    expect(ogImageFor("pong")).toBe("/og-pong.png");
    expect(ogImageFor("twenty_questions")).toBe("/og-twenty-questions.png");
  });

  test("unknown types fall back to the brand card", () => {
    expect(ogImageFor("mystery")).toBe("/og-app.png");
  });
});

describe("escapeHtml", () => {
  test("escapes the four dangerous characters", () => {
    expect(escapeHtml(`A & B "quote" <tag> >`)).toBe(
      "A &amp; B &quot;quote&quot; &lt;tag&gt; &gt;",
    );
  });

  test("leaves plain copy untouched", () => {
    expect(escapeHtml("Tic Tac Toe — Your Turn")).toBe(
      "Tic Tac Toe — Your Turn",
    );
  });
});

// --- injectOgTags -----------------------------------------------------------

const BRAND_HTML = `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta property="og:title" content="Recess — Silence is safe here." />
  <meta property="og:description" content="Turn any chat lull into a quick game." />
  <meta property="og:image" content="/og-app.png" />
  <meta name="twitter:title" content="Recess — Silence is safe here." />
  <title>Recess — Silence is safe here.</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;

const INVITE_META: OgMeta = {
  title: "Tic Tac Toe — Your Turn",
  description:
    "You've been challenged to a game of Tic Tac Toe. Tap to play — works on any chat app.",
  image: "/og-tic-tac-toe.png",
  imageAlt: "A game of Tic Tac Toe waiting for you.",
};

function metaContent(html: string, attr: "property" | "name", key: string) {
  const m = html.match(new RegExp(`<meta\\s+${attr}="${key}"[^>]*content="([^"]*)"`));
  return m?.[1] ?? null;
}

describe("injectOgTags", () => {
  test("replaces the existing brand-card tags with the game invite", () => {
    const out = injectOgTags(BRAND_HTML, INVITE_META, "https://playrecess.freebuff.app/play/abc-123");

    expect(metaContent(out, "property", "og:title")).toBe(
      "Tic Tac Toe — Your Turn",
    );
    expect(metaContent(out, "name", "twitter:title")).toBe(
      "Tic Tac Toe — Your Turn",
    );
    expect(metaContent(out, "property", "og:description")).toBe(
      INVITE_META.description,
    );
    // Exactly one og:title — replaced, not duplicated.
    expect(out.match(/property="og:title"/g)).toHaveLength(1);
    // The original title element survives.
    expect(out).toContain("<title>Recess — Silence is safe here.</title>");
  });

  test("makes image URLs absolute against the request origin", () => {
    const out = injectOgTags(BRAND_HTML, INVITE_META, "https://playrecess.freebuff.app/play/abc-123");

    expect(metaContent(out, "property", "og:image")).toBe(
      "https://playrecess.freebuff.app/og-tic-tac-toe.png",
    );
    expect(metaContent(out, "name", "twitter:image")).toBe(
      "https://playrecess.freebuff.app/og-tic-tac-toe.png",
    );
  });

  test("sets og:url to the full request URL", () => {
    const out = injectOgTags(BRAND_HTML, INVITE_META, "https://playrecess.freebuff.app/play/abc-123");
    expect(metaContent(out, "property", "og:url")).toBe(
      "https://playrecess.freebuff.app/play/abc-123",
    );
  });

  test("appends missing tags before </head> instead of dropping them", () => {
    // The brand HTML has no twitter:card / twitter:image / og:image:alt.
    const out = injectOgTags(BRAND_HTML, INVITE_META, "https://playrecess.freebuff.app/play/abc-123");

    expect(metaContent(out, "name", "twitter:card")).toBe("summary_large_image");
    expect(metaContent(out, "name", "twitter:image")).toBe(
      "https://playrecess.freebuff.app/og-tic-tac-toe.png",
    );
    expect(metaContent(out, "property", "og:image:alt")).toBe(
      "A game of Tic Tac Toe waiting for you.",
    );
    // Appended before the closing head tag, not dumped at the end of the doc.
    const headEnd = out.indexOf("</head>");
    const bodyStart = out.indexOf("<body>");
    expect(headEnd).toBeGreaterThan(-1);
    expect(headEnd).toBeLessThan(bodyStart);
  });

  test("escapes content that contains quotes or ampersands", () => {
    const sneaky: OgMeta = {
      ...INVITE_META,
      title: 'A "quoted" & <angled> title',
    };
    const out = injectOgTags(BRAND_HTML, sneaky, "https://playrecess.freebuff.app/play/abc-123");
    expect(out).toContain("A &quot;quoted&quot; &amp; &lt;angled&gt; title");
    // The attribute value is the escaped form — no raw quote can break it.
    expect(metaContent(out, "property", "og:title")).toBe(
      "A &quot;quoted&quot; &amp; &lt;angled&gt; title",
    );
  });

  test("an empty head still receives all nine tags", () => {
    const out = injectOgTags("<html><head></head><body></body></html>", INVITE_META, "https://playrecess.freebuff.app/play/abc-123");
    for (const [attr, key] of [
      ["property", "og:title"],
      ["property", "og:description"],
      ["property", "og:image"],
      ["property", "og:url"],
      ["name", "twitter:card"],
      ["name", "twitter:title"],
      ["name", "twitter:description"],
      ["name", "twitter:image"],
      ["property", "og:image:alt"],
    ] as const) {
      expect(metaContent(out, attr, key)).not.toBeNull();
    }
  });
});

// --- createTtlCache ----------------------------------------------------------

describe("createTtlCache", () => {
  test("misses return null", () => {
    const cache = createTtlCache<string>({ ttlMs: 60_000, maxEntries: 10 });
    expect(cache.get("nope")).toBeNull();
  });

  test("a fresh entry is returned within its TTL", () => {
    const cache = createTtlCache<string>({ ttlMs: 60_000, maxEntries: 10 });
    cache.set("abc", "<html>…</html>");
    expect(cache.get("abc")).toBe("<html>…</html>");
    expect(cache.size).toBe(1);
  });

  test("an entry is dropped once its TTL passes", () => {
    const cache = createTtlCache<string>({ ttlMs: -1, maxEntries: 10 });
    cache.set("abc", "<html>…</html>");
    expect(cache.get("abc")).toBeNull();
    expect(cache.size).toBe(0);
  });

  test("evicts the oldest entries beyond the cap", () => {
    const cache = createTtlCache<string>({ ttlMs: 60_000, maxEntries: 3 });
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    cache.set("d", "4"); // evicts "a"
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBe("2");
    expect(cache.get("c")).toBe("3");
    expect(cache.get("d")).toBe("4");
    expect(cache.size).toBe(3);
  });

  test("re-setting a key refreshes its recency", () => {
    const cache = createTtlCache<string>({ ttlMs: 60_000, maxEntries: 3 });
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    cache.set("a", "1b"); // refresh "a" — now most recent
    cache.set("d", "4"); // evicts "b", not "a"
    expect(cache.get("a")).toBe("1b");
    expect(cache.get("b")).toBeNull();
    expect(cache.size).toBe(3);
  });

  test("overwriting a key keeps a single entry", () => {
    const cache = createTtlCache<string>({ ttlMs: 60_000, maxEntries: 10 });
    cache.set("abc", "v1");
    cache.set("abc", "v2");
    expect(cache.size).toBe(1);
    expect(cache.get("abc")).toBe("v2");
  });
});
