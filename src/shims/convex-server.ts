/**
 * Browser-safe stub for `convex/server`.
 *
 * The leftover Convex codegen (`src/convex/_generated/api.js`) still imports
 * `anyApi` from `convex/server`. Vite previously marked that package external,
 * which left a bare `import "convex/server"` in the client bundle and broke
 * production. This shim satisfies those imports without shipping Convex.
 */

/** Proxy that returns itself for any property access (Convex anyApi shape). */
function makeAnyApi(): unknown {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") return undefined; // not a thenable
      return makeAnyApi();
    },
  };
  return new Proxy({}, handler);
}

export const anyApi = makeAnyApi();

// Minimal no-op helpers some generated files type against.
export function query(_def: unknown) {
  return _def;
}
export function mutation(_def: unknown) {
  return _def;
}
export function action(_def: unknown) {
  return _def;
}
export function internalQuery(_def: unknown) {
  return _def;
}
export function internalMutation(_def: unknown) {
  return _def;
}
export function internalAction(_def: unknown) {
  return _def;
}
