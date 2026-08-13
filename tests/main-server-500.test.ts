// ---------------------------------------------------------------------------
// Isolated server-entry test: the "dist/index.html missing → 500" path.
//
// Lives in its own file because main.ts's readIndexHtml caches its first
// result module-wide — if any other test in the same module graph reads the
// (stubbed) index.html successfully, this case can never run again. The
// query-string import forces a FRESH module instance of main.ts (bun treats
// "?x" specifiers as separate modules), so this file is order-independent.
// ---------------------------------------------------------------------------

import { expect, test, afterAll } from "bun:test";

const globals = globalThis as Record<string, unknown>;
const realDeno = globals.Deno;
const realFetch = globalThis.fetch;

let serveHandler: ((req: Request) => Response | Promise<Response>) | null = null;

globals.Deno = {
  readTextFile: () => {
    throw new Error("ENOENT: no such file or directory");
  },
  env: { get: () => "https://test.convex.cloud" },
  serve: (h: (req: Request) => Response | Promise<Response>) => {
    serveHandler = h;
  },
  open: () => {
    throw new Error("not exercised");
  },
  lstatSync: () => {
    throw new Error("not exercised");
  },
  errors: { NotFound: class NotFoundError extends Error {} },
};
globalThis.fetch = async () => new Response(null, { status: 404 });

await import("../main.ts?missing-dist");

afterAll(() => {
  if (realDeno !== undefined) globals.Deno = realDeno;
  else delete globals.Deno;
  globalThis.fetch = realFetch;
});

test("a missing dist/index.html returns a 500 with a build hint", async () => {
  // Deno.serve captured the app's fetch handler; drive a /play/:slug request.
  const res = await serveHandler!(
    new Request("https://playrecess.freebuff.app/play/missing-dist"),
  );
  expect(res.status).toBe(500);
  expect(await res.text()).toContain("run `bun run build`");
});
