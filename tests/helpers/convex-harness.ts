// ---------------------------------------------------------------------------
// Convex test harness — runs the real backend handlers (src/convex/games.ts)
// against an in-memory fake of the Convex database.
//
// The fake implements just enough of the DatabaseReader/Writer surface that
// games.ts uses — query → withIndex/filter → collect/unique, insert, patch —
// so every security rule runs through the actual server code: device-token
// resolution, the third-player lock, per-game move validation, RPS pick
// masking, rematch creation, lazy 48h expiry, and the background cleanup
// cron. Deliberately dependency-free (no convex-test, no live backend) so
// `bun test` keeps working offline.
//
// Index names are accepted but not actually consulted — the fake evaluates
// the index/where predicates over the whole table, which is semantically
// equivalent for correctness testing (a real index only changes the result
// set's ordering/performance, never its membership).
// ---------------------------------------------------------------------------

import { ConvexError } from "convex/values";

export type AnyDoc = Record<string, unknown> & {
  _id: string;
  _creationTime: number;
};

/** A `q.field("updatedAt")` reference, resolved against a doc when compared. */
class FieldRef {
  constructor(readonly name: string) {}
}

/** Resolve a comparison's left side against a doc: in Convex's query DSL
 *  the first operand of q.eq/q.lt/... is always a field (a string field name
 *  or a q.field() reference), never a literal. */
function fieldValue(value: unknown, doc: AnyDoc): unknown {
  if (value instanceof FieldRef) return doc[value.name];
  if (typeof value === "string") return doc[value];
  return value;
}

/** Chainable predicate builder mirroring Convex's query operators. */
export class Predicate {
  private tests: Array<(doc: AnyDoc) => boolean> = [];

  field(name: string) {
    return new FieldRef(name);
  }
  eq(a: unknown, b: unknown) {
    this.tests.push((d) => fieldValue(a, d) === b);
    return this;
  }
  neq(a: unknown, b: unknown) {
    this.tests.push((d) => fieldValue(a, d) !== b);
    return this;
  }
  lt(a: unknown, b: unknown) {
    this.tests.push((d) => (fieldValue(a, d) as number) < (b as number));
    return this;
  }
  lte(a: unknown, b: unknown) {
    this.tests.push((d) => (fieldValue(a, d) as number) <= (b as number));
    return this;
  }
  gt(a: unknown, b: unknown) {
    this.tests.push((d) => (fieldValue(a, d) as number) > (b as number));
    return this;
  }
  gte(a: unknown, b: unknown) {
    this.tests.push((d) => (fieldValue(a, d) as number) >= (b as number));
    return this;
  }

  matches(doc: AnyDoc): boolean {
    return this.tests.every((t) => t(doc));
  }
}

type PredFn = (doc: AnyDoc) => boolean;

export class FakeQuery {
  private fns: PredFn[];

  constructor(
    private db: FakeDb,
    private table: string,
    fns: PredFn[] = [],
  ) {
    this.fns = fns;
  }

  private add(build: (q: Predicate) => unknown): FakeQuery {
    const p = new Predicate();
    build(p);
    return new FakeQuery(this.db, this.table, [
      ...this.fns,
      (doc) => p.matches(doc),
    ]);
  }

  withIndex(_name: string, build: (q: Predicate) => unknown): FakeQuery {
    return this.add(build);
  }
  filter(build: (q: Predicate) => unknown): FakeQuery {
    return this.add(build);
  }
  order(_field: string): FakeQuery {
    return this; // ordering is irrelevant for the rules under test
  }

  async collect(): Promise<AnyDoc[]> {
    const rows = this.db.tables.get(this.table);
    if (!rows) return [];
    return [...rows.values()].filter((doc) => this.fns.every((f) => f(doc)));
  }
  async unique(): Promise<AnyDoc | null> {
    const rows = await this.collect();
    return rows.length > 0 ? rows[0] : null;
  }
  async first(): Promise<AnyDoc | null> {
    const rows = await this.collect();
    return rows[0] ?? null;
  }
}

export class FakeDb {
  readonly tables = new Map<string, Map<string, AnyDoc>>();
  private seq = 0;

  insert(table: string, doc: Record<string, unknown>): string {
    const id = `${table}_${++this.seq}`;
    const row: AnyDoc = { _id: id, _creationTime: Date.now(), ...doc };
    let rows = this.tables.get(table);
    if (!rows) {
      rows = new Map();
      this.tables.set(table, rows);
    }
    rows.set(id, row);
    return id;
  }

  patch(id: string, patch: Record<string, unknown>): void {
    for (const rows of this.tables.values()) {
      const row = rows.get(id);
      if (row) {
        Object.assign(row, patch);
        return;
      }
    }
    throw new Error(`patch: no document with id "${id}"`);
  }

  get(id: string): AnyDoc | null {
    for (const rows of this.tables.values()) {
      const row = rows.get(id);
      if (row) return row;
    }
    return null;
  }

  query(table: string): FakeQuery {
    return new FakeQuery(this, table);
  }

  /** Every doc of a table, for assertions. */
  all(table: string): AnyDoc[] {
    return [...(this.tables.get(table)?.values() ?? [])];
  }
}

/** Minimal shape of a Convex query/mutation definition. */
export interface ConvexFn {
  handler?: (ctx: unknown, args: never) => Promise<unknown>;
  _handler?: (ctx: unknown, args: never) => Promise<unknown>;
}

/**
 * Run a Convex query/mutation against the fake db. The `mutation()`/`query()`
 * wrappers from convex/server expose the raw handler as `_handler` (with the
 * validator/scheduler plumbing on `invokeMutation`), so we call that directly
 * with a fake ctx that only needs `db`.
 */
export function run(
  fn: ConvexFn,
  db: FakeDb,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const handler = fn._handler ?? fn.handler;
  if (!handler) {
    throw new Error("run(): the function has no handler to call");
  }
  return handler.call(fn, { db } as never, args as never);
}

/** Assert a handler rejects with a ConvexError carrying the given code. */
export async function expectCode(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await promise;
  } catch (err) {
    if (
      err instanceof ConvexError &&
      (err.data as { code?: string })?.code === code
    ) {
      return;
    }
    throw err;
  }
  throw new Error(
    `expected a ConvexError with code "${code}" but the call succeeded`,
  );
}
