// Minimal ambient declarations for the Deno runtime globals used by the
// production server (main.ts). The platform runs main.ts under Deno; these
// declarations let `tsc -b` typecheck the server entry, which otherwise sits
// outside every tsconfig project. Scoped to exactly what main.ts uses.
declare global {
  namespace Deno {
    function readTextFile(path: string): Promise<string>;
    function serve(
      handler: (request: Request) => Response | Promise<Response>,
    ): void;
    namespace env {
      function get(key: string): string | undefined;
    }
  }
}

export {};
