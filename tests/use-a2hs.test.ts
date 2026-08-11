// ---------------------------------------------------------------------------
// Tests for the A2HS platform-detection helpers (src/hooks/use-a2hs.ts).
//
// The helpers are pure reads of globals (window / navigator / localStorage),
// so each test stubs `window` and restores it afterwards.
// ---------------------------------------------------------------------------

import { afterEach, describe, expect, test } from "bun:test";
import {
  DISMISS_KEY,
  isChromeLike,
  isIosSafari,
  isStandalone,
  readDismissedUntil,
} from "../src/hooks/use-a2hs";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPAD_SAFARI =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPADOS_13_DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DESKTOP_EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
const DESKTOP_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const FIREFOX =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";

interface FakeWindowOptions {
  ua: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
  displayModeStandalone?: boolean;
  store?: Record<string, string>;
}

interface FakeWindow {
  navigator: {
    userAgent: string;
    platform: string;
    maxTouchPoints: number;
    standalone: boolean;
  };
  matchMedia?: (query: string) => { matches: boolean };
  localStorage?: {
    getItem: (k: string) => string | null;
    setItem: (k: string, v: string) => void;
    removeItem: (k: string) => void;
  };
}

function stubWindow(opts: FakeWindowOptions) {
  const store = new Map(Object.entries(opts.store ?? {}));
  const win: FakeWindow = {
    navigator: {
      userAgent: opts.ua,
      platform: opts.platform ?? "",
      maxTouchPoints: opts.maxTouchPoints ?? 0,
      standalone: opts.standalone ?? false,
    },
    matchMedia: opts.displayModeStandalone
      ? () => ({ matches: true })
      : undefined,
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
  Object.defineProperty(globalThis, "window", {
    value: win,
    configurable: true,
    writable: true,
  });
}

function noWindow() {
  delete (globalThis as { window?: unknown }).window;
}

afterEach(noWindow);

describe("isIosSafari", () => {
  test("iPhone Safari is iOS Safari", () => {
    stubWindow({ ua: IPHONE_SAFARI, platform: "iPhone" });
    expect(isIosSafari()).toBe(true);
  });

  test("iPad Safari is iOS Safari", () => {
    stubWindow({ ua: IPAD_SAFARI, platform: "iPad" });
    expect(isIosSafari()).toBe(true);
  });

  test("iPadOS 13+ with a Mac UA and touch input is iOS Safari", () => {
    stubWindow({
      ua: IPADOS_13_DESKTOP_UA,
      platform: "MacIntel",
      maxTouchPoints: 2,
    });
    expect(isIosSafari()).toBe(true);
  });

  test("iOS Chrome (CriOS) is not iOS Safari", () => {
    stubWindow({ ua: IPHONE_CHROME, platform: "iPhone" });
    expect(isIosSafari()).toBe(false);
  });

  test("Android Chrome is not iOS Safari", () => {
    stubWindow({ ua: ANDROID_CHROME, platform: "Linux" });
    expect(isIosSafari()).toBe(false);
  });

  test("desktop Safari with no touch is not iOS Safari", () => {
    stubWindow({ ua: DESKTOP_SAFARI, platform: "MacIntel", maxTouchPoints: 0 });
    expect(isIosSafari()).toBe(false);
  });

  test("desktop Chrome is not iOS Safari", () => {
    stubWindow({ ua: DESKTOP_CHROME, platform: "Win32" });
    expect(isIosSafari()).toBe(false);
  });

  test("returns false when there is no window", () => {
    noWindow();
    expect(isIosSafari()).toBe(false);
  });
});

describe("isChromeLike", () => {
  test("Android Chrome counts", () => {
    stubWindow({ ua: ANDROID_CHROME, platform: "Linux" });
    expect(isChromeLike()).toBe(true);
  });

  test("desktop Chrome counts", () => {
    stubWindow({ ua: DESKTOP_CHROME, platform: "Win32" });
    expect(isChromeLike()).toBe(true);
  });

  test("Edge (Chromium) counts", () => {
    stubWindow({ ua: DESKTOP_EDGE, platform: "Win32" });
    expect(isChromeLike()).toBe(true);
  });

  test("iOS Safari never counts", () => {
    stubWindow({ ua: IPHONE_SAFARI, platform: "iPhone" });
    expect(isChromeLike()).toBe(false);
  });

  test("desktop Safari does not count", () => {
    stubWindow({ ua: DESKTOP_SAFARI, platform: "MacIntel" });
    expect(isChromeLike()).toBe(false);
  });

  test("Firefox does not count", () => {
    stubWindow({ ua: FIREFOX, platform: "Win32" });
    expect(isChromeLike()).toBe(false);
  });
});

describe("isStandalone", () => {
  test("navigator.standalone (iOS installed) is standalone", () => {
    stubWindow({ ua: IPHONE_SAFARI, platform: "iPhone", standalone: true });
    expect(isStandalone()).toBe(true);
  });

  test("display-mode: standalone (installed PWA) is standalone", () => {
    stubWindow({
      ua: DESKTOP_CHROME,
      platform: "Win32",
      displayModeStandalone: true,
    });
    expect(isStandalone()).toBe(true);
  });

  test("in-browser mode is not standalone", () => {
    stubWindow({ ua: DESKTOP_CHROME, platform: "Win32" });
    expect(isStandalone()).toBe(false);
  });

  test("returns false when there is no window", () => {
    noWindow();
    expect(isStandalone()).toBe(false);
  });
});

describe("readDismissedUntil", () => {
  test("no stored flag means not dismissed", () => {
    stubWindow({ ua: DESKTOP_CHROME, platform: "Win32", store: {} });
    expect(readDismissedUntil()).toBeNull();
  });

  test("a future expiry is returned", () => {
    const future = Date.now() + 60_000;
    stubWindow({
      ua: DESKTOP_CHROME,
      platform: "Win32",
      store: { [DISMISS_KEY]: String(future) },
    });
    expect(readDismissedUntil()).toBe(future);
  });

  test("an expired flag is ignored", () => {
    stubWindow({
      ua: DESKTOP_CHROME,
      platform: "Win32",
      store: { [DISMISS_KEY]: String(Date.now() - 1000) },
    });
    expect(readDismissedUntil()).toBeNull();
  });

  test("garbage in the store is ignored", () => {
    stubWindow({
      ua: DESKTOP_CHROME,
      platform: "Win32",
      store: { [DISMISS_KEY]: "not-a-number" },
    });
    expect(readDismissedUntil()).toBeNull();
  });

  test("a throwing localStorage is treated as not dismissed", () => {
    const win: FakeWindow = {
      navigator: {
        userAgent: DESKTOP_CHROME,
        platform: "Win32",
        maxTouchPoints: 0,
        standalone: false,
      },
    };
    Object.defineProperty(win, "localStorage", {
      get() {
        throw new Error("SecurityError: The operation is insecure.");
      },
    });
    Object.defineProperty(globalThis, "window", {
      value: win,
      configurable: true,
      writable: true,
    });
    expect(readDismissedUntil()).toBeNull();
  });
});
