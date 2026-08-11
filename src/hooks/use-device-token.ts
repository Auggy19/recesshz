import { useMemo } from "react";

const STORAGE_KEY = "recess_device_token";

/**
 * A random string generated client-side and persisted in localStorage. The
 * server uses it to identify this device as one of a game's two players.
 */
export function useDeviceToken(): string {
  return useMemo(() => {
    try {
      let token = window.localStorage.getItem(STORAGE_KEY);
      if (!token) {
        token = window.crypto?.randomUUID?.() ?? fallbackToken();
        window.localStorage.setItem(STORAGE_KEY, token);
      }
      return token;
    } catch {
      // Storage unavailable (private mode) — still return a stable token for
      // this page session.
      return window.crypto?.randomUUID?.() ?? fallbackToken();
    }
  }, []);
}

function fallbackToken(): string {
  return `recess-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
