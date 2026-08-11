import { Hono } from "hono";
import { serveStatic } from "hono/deno";

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

interface OgMeta {
  title: string;
  description: string;
}

/** Cache of the last rendered HTML per slug — crawlers re-scrape the same
 *  link repeatedly, and game status changes are picked up on the next crawl. */
const ogCache = new Map<string, { html: string; at: number }>();
const OG_CACHE_TTL_MS = 60_000;

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

function titleFor(status: string): string {
  switch (status) {
    case "completed":
      return "Recess — Game Over";
    case "abandoned":
      return "Recess — This game went quiet";
    default:
      // "waiting" (a fresh invite) and "in_progress" both read as an
      // invitation to act — the primary share scenario.
      return "Recess — Your Turn";
  }
}

function descriptionFor(status: string, gameType: string): string {
  const label =
    gameType === "rock_paper_scissors" ? "Rock Paper Scissors" : "Tic Tac Toe";
  if (status === "waiting") {
    return `You've been challenged to a game of Recess (${label}). Tap to play — silence is safe here.`;
  }
  if (status === "abandoned") {
    return `A game of Recess (${label}) went quiet after 48 hours. Start a fresh one — silence is safe here.`;
  }
  return `A game of Recess (${label}) is waiting for you. Tap to play — silence is safe here.`;
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
    return {
      title: titleFor(data.status),
      description: descriptionFor(data.status, data.gameType),
    };
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function injectOgTags(html: string, meta: OgMeta, url: string): string {
  const origin = new URL(url).origin;
  const tags: Array<[key: string, attr: "property" | "name", content: string]> = [
    ["og:title", "property", meta.title],
    ["og:description", "property", meta.description],
    ["og:image", "property", `${origin}/og-image.png`],
    ["og:url", "property", url],
    ["twitter:card", "name", "summary_large_image"],
    ["twitter:title", "name", meta.title],
    ["twitter:description", "name", meta.description],
    ["twitter:image", "name", `${origin}/og-image.png`],
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

app.get("/play/:slug", async (c) => {
  const slug = c.req.param("slug") ?? "";
  const base = await readIndexHtml();
  if (!base) {
    return c.text("index.html not found — run `bun run build` first.", 500);
  }

  const url = c.req.url;
  const now = Date.now();
  const cached = ogCache.get(slug);
  if (cached && now - cached.at < OG_CACHE_TTL_MS) {
    return c.html(cached.html);
  }

  const meta = await fetchOgMeta(slug);
  const html = meta ? injectOgTags(base, meta, url) : base;
  ogCache.set(slug, { html, at: now });
  return c.html(html);
});

// 4) Fallback to index.html for the SPA
app.get("*", serveStatic({ path: "./dist/index.html" }));

Deno.serve(app.fetch);
