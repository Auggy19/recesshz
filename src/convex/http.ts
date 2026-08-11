import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

auth.addHttpRoutes(http);

// Public, read-only game metadata for social link previews. The production
// server (main.ts) fetches this when a crawler requests /play/:slug, then
// bakes og:title / og:description into the HTML it returns. Returns just the
// slug + game type + status — no player data. Knowing the slug already means
// you were invited, so nothing sensitive is exposed.
http.route({
  path: "/og/:slug",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const slug = new URL(request.url).pathname.split("/").pop() ?? "";
    if (!slug) return new Response("Not found", { status: 404 });
    const meta = await ctx.runQuery(internal.games.getOgMetadata, { slug });
    if (!meta) return new Response("Not found", { status: 404 });
    return Response.json(meta);
  }),
});

export default http;
