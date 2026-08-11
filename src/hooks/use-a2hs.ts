import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// useA2HS — "Add to Home Screen" install detection.
//
//   Android / Chrome : captures `beforeinstallprompt`, suppresses the native
//                      mini-banner, and exposes `install()` to trigger the
//                      real install dialog on demand.
//   iOS / Safari     : no install event exists; if we detect Safari-in-browser
//                      mode we surface the Share → "Add to Home Screen" guide.
//   Installed        : if the app is already running standalone (display-mode
//                      standalone / navigator.standalone) we never prompt.
//
// A "Not now" dismissal is persisted to localStorage for 7 days.
// ---------------------------------------------------------------------------

export type A2hsStatus =
  | "idle" // resolving which platform path applies
  | "installable" // Chrome: deferred prompt captured
  | "guide" // Chromium browser but no prompt event (preview/iframe/offline) — manual menu steps
  | "ios" // iOS Safari in browser mode: show the micro-guide
  | "installed" // already on the home screen (or just installed)
  | "unsupported"; // browser can't install the app

const DISMISS_KEY = "recess-a2hs-dismissed-until";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

/** Module-level cache of the last prompt event, so a `beforeinstallprompt`
 *  that fired before React mounted isn't lost. */
let lastPrompt: BeforeInstallPromptEvent | null = null;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    window.navigator.standalone === true
  );
}

/** iOS + Safari (not Chrome/Firefox/Edge wrappers), or iPadOS 13+ which
 *  reports a Mac user agent but has touch input. */
function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  const isSafari =
    /Safari\//.test(ua) && !/Chrome\/|CriOS|FxiOS|EdgiOS|OPiOS|OPR\//.test(ua);
  return isSafari;
}

/** Chromium-based browser (Chrome / Edge / Samsung Internet) on a non-iOS
 *  device. These support install but may never fire `beforeinstallprompt` —
 *  preview iframes, http origins, or an inactive service worker all suppress
 *  it. The manual menu guide still applies in those cases. */
function isChromeLike(): boolean {
  if (typeof window === "undefined") return false;
  if (isIosSafari()) return false;
  return /Chrome\/|Chromium\/|Edg\//.test(window.navigator.userAgent);
}

function readDismissedUntil(): number | null {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > Date.now() ? n : null;
  } catch {
    return null;
  }
}

export function useA2HS() {
  // Initial state covers the two cases that are known before the effect runs:
  // already installed, or a beforeinstallprompt that fired before mount.
  const [status, setStatus] = useState<A2hsStatus>(() => {
    if (isStandalone()) return "installed";
    if (lastPrompt) return "installable";
    return "idle";
  });
  const [open, setOpen] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState<number | null>(() =>
    readDismissedUntil(),
  );
  // A minute tick so the 7-day dismissal re-evaluates on its own (and never
  // calls Date.now() during render).
  const [now, setNow] = useState(() => Date.now());
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const tick = setInterval(() => setNow(Date.now()), 60_000);
    const onPrompt = (e: Event) => {
      e.preventDefault(); // suppress Chrome's default mini-infobar
      const prompt = e as BeforeInstallPromptEvent;
      lastPrompt = prompt;
      deferredPrompt.current = prompt;
      setStatus("installable");
    };
    const onInstalled = () => {
      lastPrompt = null;
      deferredPrompt.current = null;
      setStatus("installed");
      setOpen(false);
    };

    // Recover a prompt that fired before this hook mounted (e.g. the post-game
    // screen mounts the prompt late, after the browser already offered it) —
    // the status itself was seeded from `lastPrompt` in the initializer.
    if (lastPrompt) {
      deferredPrompt.current = lastPrompt;
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Browsers that never fire beforeinstallprompt resolve shortly after load
    // (Chrome fires the event within this window when the criteria are met):
    // iOS gets the Share guide, Chromium gets the manual menu guide, and
    // anything else is unsupported. If the event arrives late, the listener
    // above upgrades "guide" → "installable" live.
    const resolveIdle = () => {
      setStatus((s) => {
        if (s !== "idle") return s;
        if (isIosSafari()) return "ios";
        if (isChromeLike()) return "guide";
        return "unsupported";
      });
    };
    const timer = setTimeout(resolveIdle, 2500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, []);

  /** Trigger the native Chrome install dialog. True when the user installed. */
  const install = useCallback(async (): Promise<boolean> => {
    const prompt = deferredPrompt.current;
    if (!prompt) return false;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") {
        deferredPrompt.current = null;
        setStatus("installed");
        setOpen(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  /** "Not now" — remember this device's choice for 7 days. */
  const dismiss = useCallback(() => {
    const until = Date.now() + DISMISS_MS;
    try {
      window.localStorage.setItem(DISMISS_KEY, String(until));
    } catch {
      // Ignore storage failures (private mode etc.).
    }
    setDismissedUntil(until);
    setOpen(false);
  }, []);

  const canInstall = status === "installable" || status === "guide" || status === "ios";
  const isDismissed = dismissedUntil !== null && dismissedUntil > now;
  const canShow = canInstall && !isDismissed && !isStandalone();

  return {
    status,
    open,
    setOpen,
    canInstall,
    canShow,
    isInstalled: status === "installed",
    install,
    dismiss,
  };
}
