// ---------------------------------------------------------------------------
// Daily streak tracking — pure date math, no browser APIs, fully testable.
//
// A streak is counted in local calendar days: playing today continues a
// streak from yesterday, playing again the same day is a no-op, and any gap
// of a day or more resets the streak to 1.
// ---------------------------------------------------------------------------

export interface StreakState {
  /** Consecutive days played, ending today (or the last played day). */
  current: number;
  /** Highest streak ever reached. */
  best: number;
  /** Last day a game was completed, as a local YYYY-MM-DD string. */
  lastPlayed: string;
}

/** Local calendar date as YYYY-MM-DD (no timezone drift — pure local). */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole days from `a` to `b` (both local YYYY-MM-DD). Can be negative. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ta = new Date(ay, am - 1, ad).getTime();
  const tb = new Date(by, bm - 1, bd).getTime();
  return Math.round((tb - ta) / 86_400_000);
}

/**
 * Advance the streak for a play happening on `today`.
 * - No prior play            -> current 1, best 1.
 * - Already played today     -> unchanged (idempotent).
 * - Played yesterday         -> current + 1.
 * - Played earlier (gap > 1) -> reset to 1.
 */
export function registerPlay(
  prev: StreakState | null,
  today: string = todayKey(),
): StreakState {
  if (!prev) return { current: 1, best: 1, lastPlayed: today };
  if (prev.lastPlayed === today) return prev;

  const gap = daysBetween(prev.lastPlayed, today);
  const current = gap === 1 ? prev.current + 1 : 1;
  return {
    current,
    best: Math.max(prev.best, current),
    lastPlayed: today,
  };
}
