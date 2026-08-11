import { describe, expect, test } from "bun:test";
import { daysBetween, registerPlay, todayKey } from "../src/lib/streak";

describe("todayKey", () => {
  test("formats a local date as YYYY-MM-DD", () => {
    expect(todayKey(new Date(2026, 6, 3))).toBe("2026-07-03");
    expect(todayKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("daysBetween", () => {
  test("consecutive days are 1 apart", () => {
    expect(daysBetween("2026-07-31", "2026-08-01")).toBe(1);
  });
  test("month and year boundaries are exact", () => {
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
    expect(daysBetween("2026-02-27", "2026-03-01")).toBe(2);
  });
  test("negative when going backwards", () => {
    expect(daysBetween("2026-08-02", "2026-08-01")).toBe(-1);
  });
});

describe("registerPlay", () => {
  test("first ever play starts a streak of 1", () => {
    expect(registerPlay(null, "2026-08-01")).toEqual({
      current: 1,
      best: 1,
      lastPlayed: "2026-08-01",
    });
  });

  test("playing again the same day is idempotent", () => {
    const prev = registerPlay(null, "2026-08-01");
    expect(registerPlay(prev, "2026-08-01")).toEqual(prev);
  });

  test("playing the next day increments the streak", () => {
    const prev = registerPlay(null, "2026-08-01");
    expect(registerPlay(prev, "2026-08-02")).toEqual({
      current: 2,
      best: 2,
      lastPlayed: "2026-08-02",
    });
  });

  test("skipping a day resets to 1 but keeps the best", () => {
    let s = registerPlay(null, "2026-08-01");
    s = registerPlay(s, "2026-08-02"); // streak 2, best 2
    s = registerPlay(s, "2026-08-05"); // 3-day gap -> reset
    expect(s.current).toBe(1);
    expect(s.best).toBe(2);
    expect(s.lastPlayed).toBe("2026-08-05");
  });

  test("a long streak beats the old best", () => {
    let s = registerPlay(null, "2026-08-01");
    for (let i = 2; i <= 5; i++) {
      s = registerPlay(s, `2026-08-0${i}`);
    }
    expect(s.current).toBe(5);
    expect(s.best).toBe(5);
  });

  test("a clock rollback (future lastPlayed) resets safely", () => {
    const prev = { current: 3, best: 3, lastPlayed: "2026-08-10" };
    expect(registerPlay(prev, "2026-08-01").current).toBe(1);
  });
});
