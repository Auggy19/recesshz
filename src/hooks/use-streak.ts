import { useCallback, useState } from "react";
import {
  registerPlay as computeNext,
  type StreakState,
} from "@/lib/streak";

const STORAGE_KEY = "recess_streak";

function read(): StreakState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StreakState;
    if (
      typeof parsed.current !== "number" ||
      typeof parsed.best !== "number" ||
      typeof parsed.lastPlayed !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function write(state: StreakState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures (private mode etc.).
  }
}

/**
 * Daily streak, persisted in localStorage. `registerPlay()` is called once
 * per completed match and is idempotent within the same local day.
 */
export function useStreak() {
  const [state, setState] = useState<StreakState | null>(() =>
    typeof window === "undefined" ? null : read(),
  );

  const registerPlay = useCallback(() => {
    const prev = read();
    const next = computeNext(prev);
    write(next);
    setState(next);
    return {
      state: next,
      /** True when this play set a new personal best (streak >= 2). */
      newBest: prev !== null && next.best > prev.best,
    };
  }, []);

  return {
    streak: state?.current ?? 0,
    best: state?.best ?? 0,
    lastPlayed: state?.lastPlayed ?? null,
    registerPlay,
  };
}
