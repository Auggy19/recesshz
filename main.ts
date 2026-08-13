import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import {
  createTtlCache,
  injectOgTags,
  ogDescriptionFor,
  ogImageFor,
  ogLabelFor,
  ogTitleFor,
  type OgMeta,
} from "./src/lib/server-og.ts";

const app = new Hono();

// 1) Serve anything in /assets/**
app.use("/assets/*", serveStatic({ root: "./dist/assets" }));

// 2) Catch *all* other files in dist (CSS, JS, images, etc.)
app.use("*", serveStatic({ root: "./dist" }));

// ---------------------------------------------------------------------------
// 3) /play/:slug — serve index.html with per-game Open Graph tags baked in.
//
// WhatsApp / Instagram / Facebook crawlers don't execute JavaScript, so the
// SPA's client-side <meta> updates never reach them — without this step a
// shared game link renders as a bare URL. We fetch the game's (public,
// read-only) metadata from Convex and inject og:title / og:description /
// og:image before returning the HTML. If Convex is unreachable we fall back
// to the static tags in index.html, which already brand the preview.
// ---------------------------------------------------------------------------

// Cache of the last rendered HTML per slug — crawlers re-scrape the same
// link repeatedly, and game status changes are picked up on the next crawl.
// Bounded (see src/lib/server-og.ts): every shared game uses a unique UUID
// slug, so an unbounded map would leak one entry per game forever.
const ogCache = createTtlCache<string>({ ttlMs: 60_000, maxEntries: 250 });

let indexHtmlPromise: Promise<string | null> | null = null;
function readIndexHtml(): Promise<string | null> {
  indexHtmlPromise ??= (async () => {
    try {
      return await Deno.readTextFile("./dist/index.html");
    } catch {
      return null;
    }
  })();
  return indexHtmlPromise;
}

/** Best-effort URL of the Convex site where HTTP actions are served. */
function convexSiteUrl(): string | null {
  const direct = Deno.env.get("CONVEX_SITE_URL");
  if (direct) return direct.replace(/\/+$/, "");
  const vite = Deno.env.get("VITE_CONVEX_URL");
  if (vite) return vite.replace(/\.cloud$/, ".site");
  return null;
}

async function fetchOgMeta(slug: string): Promise<OgMeta | null> {
  const site = convexSiteUrl();
  if (!site) return null;
  try {
    const res = await fetch(`${site}/og/${encodeURIComponent(slug)}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (
      !data ||
      typeof data.status !== "string" ||
      typeof data.gameType !== "string"
    ) {
      return null;
    }
    const gameType = data.gameType;
    return {
      title: ogTitleFor(data.status, gameType),
      description: ogDescriptionFor(data.status, gameType),
      image: ogImageFor(gameType),
      imageAlt: `A game of ${ogLabelFor(gameType)} waiting for you.`,
    };
  } catch {
    return null;
  }
}

app.get("/play/:slug", async (c) => {
  const slug = c.req.param("slug") ?? "";
  const base = await readIndexHtml();
  if (!base) {
    return c.text("index.html not found — run `bun run build` first.", 500);
  }

  const url = c.req.url;
  const cached = ogCache.get(slug);
  if (cached !== null) {
    return c.html(cached);
  }

  const meta = await fetchOgMeta(slug);
  const html = meta ? injectOgTags(base, meta, url) : base;
  ogCache.set(slug, html);
  return c.html(html);
});

// 4) Fallback to index.html for the SPA
app.get("*", serveStatic({ path: "./dist/index.html" }));

Deno.serve(app.fetch);
