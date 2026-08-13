// ---------------------------------------------------------------------------
// Server-entry tests — drive main.ts (the Deno server) directly: the exact
// handler crawlers hit on /play/:slug. Deno + fetch are stubbed BEFORE the
// module is imported (hono/deno destructures Deno at module load), so the
// real HTTP wiring runs: index.html read, Convex metadata fetch, TTL cache,
// tag injection, and the fallback path.
//
// The "missing dist/index.html → 500" case lives in its own file
// (main-server-500.test.ts) because readIndexHtml caches its first result
// module-wide, so it can only be exercised on a fresh module graph.
// ---------------------------------------------------------------------------

import { describe, expect, test, beforeEach, afterAll } from "bun:test";

// --- Deno stub (installed before main.ts / hono/deno load) -----------------

const globals = globalThis as Record<string, unknown>;
const realDeno = globals.Deno;
const realFetch = globalThis.fetch;
const realDateNow = Date.now;

let serveHandler: ((req: Request) => Response | Promise<Response>) | null = null;
let readTextFileImpl: (path: string) => Promise<string> = async () =>
  "<html><head></head><body></body></html>";
let envImpl: Record<string, string> = {};
let fetchImpl: (input: string | URL | Request, init?: RequestInit) => Promise<Response> =
  async () => new Response(null, { status: 404 });

let now = 1_700_000_000_000;

globals.Deno = {
  readTextFile: (path: string) => readTextFileImpl(path),
  env: { get: (key: string) => envImpl[key] },
  serve: (h: (req: Request) => Response | Promise<Response>) => {
    serveHandler = h;
  },
  // Needed only for hono/deno's serve-static module evaluation; the tests
  // never hit static routes.
  open: () => {
    throw new Error("static serving not exercised in these tests");
  },
  lstatSync: () => {
    throw new Error("static serving not exercised in these tests");
  },
  errors: { NotFound: class NotFoundError extends Error {} },
};
globalThis.fetch = ((input, init) =>
  fetchImpl(input as string | URL | Request, init)) as typeof fetch;
Date.now = () => now;

// Import AFTER the stubs are live so module-level Deno references resolve.
await import("../main");

afterAll(() => {
  if (realDeno !== undefined) globals.Deno = realDeno;
  else delete globals.Deno;
  globalThis.fetch = realFetch;
  Date.now = realDateNow;
});

// --- fixtures ---------------------------------------------------------------

/** index.html with an og:title/description to replace and no og:image yet. */
const BASE_HTML =
  '<!doctype html><html><head>' +
  '<meta property="og:title" content="Recess — Silence is safe here." />' +
  '<meta property="og:description" content="Turn any chat lull into a quick game." />' +
  "</head><body><div id=\"root\"></div></body></html>";

function okJson(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function handler(): (req: Request) => Promise<Response> {
  if (!serveHandler) throw new Error("main.ts never registered its handler");
  return (req) => Promise.resolve(serveHandler!(req));
}

function playReq(slug: string): Request {
  return new Request(`https://playrecess.freebuff.app/play/${slug}`);
}

beforeEach(() => {
  readTextFileImpl = async () => BASE_HTML;
  envImpl = { CONVEX_SITE_URL: "https://test.convex.cloud" };
  fetchImpl = async () => new Response(null, { status: 404 });
  now = 1_700_000_000_000;
});

// ---------------------------------------------------------------------------
// /play/:slug — OG baking
// ---------------------------------------------------------------------------

describe("/play/:slug OG baking", () => {
  test("bakes Template-1 tags for a live game (absolute image, og:url, twitter)", async () => {
    fetchImpl = async () =>
      okJson({ status: "in_progress", gameType: "pong" });

    const res = await handler()(playReq("abc123"));
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain('<meta property="og:title" content="Pong — Your Turn" />');
    expect(html).toContain(
      'content="A game of Pong is waiting for you. Tap to play — works on any chat app."',
    );
    // Image is made absolute against the request origin.
    expect(html).toContain(
      '<meta property="og:image" content="https://playrecess.freebuff.app/og-pong.png" />',
    );
    expect(html).toContain(
      '<meta property="og:url" content="https://playrecess.freebuff.app/play/abc123" />',
    );
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  test("a completed game renders the Game Over title", async () => {
    fetchImpl = async () =>
      okJson({ status: "completed", gameType: "tic_tac_toe" });

    const res = await handler()(playReq("def456"));
    const html = await res.text();
    expect(html).toContain(
      '<meta property="og:title" content="Tic Tac Toe — Game Over" />',
    );
  });

  test("a waiting game uses the challenge description", async () => {
    fetchImpl = async () =>
      okJson({ status: "waiting", gameType: "rock_paper_scissors" });

    const res = await handler()(playReq("ghi789"));
    const html = await res.text();
    expect(html).toContain(
      'content="You\'ve been challenged to a game of Rock Paper Scissors. Tap to play — works on any chat app."',
    );
  });

  test("fetch is called with the encoded Convex OG endpoint", async () => {
    let fetchedUrl = "";
    fetchImpl = async (input) => {
      fetchedUrl = String(input);
      return okJson({ status: "waiting", gameType: "red_or_black" });
    };

    await handler()(playReq("room 12"));
    expect(fetchedUrl).toBe("https://test.convex.cloud/og/room%2012");
  });
});

// ---------------------------------------------------------------------------
// /play/:slug — caching
// ---------------------------------------------------------------------------

describe("/play/:slug caching", () => {
  test("a second request within the TTL reuses the cached HTML without refetching", async () => {
    let fetchCount = 0;
    fetchImpl = async () => {
      fetchCount++;
      return okJson({ status: "waiting", gameType: "pong" });
    };

    await handler()(playReq("cache-1"));
    const res = await handler()(playReq("cache-1"));
    const html = await res.text();

    expect(fetchCount).toBe(1);
    expect(html).toContain('content="Pong — Your Turn"');
  });

  test("after the TTL expires the next crawl refetches and sees the new status", async () => {
    let status = "waiting";
    let fetchCount = 0;
    fetchImpl = async () => {
      fetchCount++;
      return okJson({ status, gameType: "pong" });
    };

    const first = await handler()(playReq("cache-2"));
    expect(await first.text()).toContain("Pong — Your Turn");

    // 61s later the game completed; the next crawl must pick it up.
    now += 61_000;
    status = "completed";
    const second = await handler()(playReq("cache-2"));

    expect(fetchCount).toBe(2);
    expect(await second.text()).toContain("Pong — Game Over");
  });
});

// ---------------------------------------------------------------------------
// /play/:slug — fallbacks
// ---------------------------------------------------------------------------

describe("/play/:slug fallbacks", () => {
  test("a Convex error response falls back to the static index.html untouched", async () => {
    fetchImpl = async () => new Response("nope", { status: 500 });

    const res = await handler()(playReq("fallback-1"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(BASE_HTML);
  });

  test("a network failure falls back to the static index.html untouched", async () => {
    fetchImpl = async () => {
      throw new Error("ECONNREFUSED");
    };

    const res = await handler()(playReq("fallback-2"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(BASE_HTML);
  });

  test("a malformed Convex payload (missing gameType) falls back", async () => {
    fetchImpl = async () => okJson({ status: "waiting" });

    const res = await handler()(playReq("fallback-3"));
    expect(await res.text()).toBe(BASE_HTML);
  });

  test("no CONVEX_SITE_URL configured skips the fetch entirely", async () => {
    envImpl = {};
    let fetchCount = 0;
    fetchImpl = async () => {
      fetchCount++;
      return okJson({ status: "waiting", gameType: "pong" });
    };

    const res = await handler()(playReq("fallback-4"));
    expect(await res.text()).toBe(BASE_HTML);
    expect(fetchCount).toBe(0);
  });
});
