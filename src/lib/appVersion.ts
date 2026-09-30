export const APP_BUILD = String(import.meta.env.VITE_APP_BUILD ?? "2026.09.30");
const KEY = "recess_seen_build";

export function hasNewBuild(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== APP_BUILD;
  } catch {
    return false;
  }
}

export function markBuildSeen() {
  try {
    window.localStorage.setItem(KEY, APP_BUILD);
  } catch {
    /* ignore */
  }
}

export function applyClientUpdate() {
  markBuildSeen();
  window.location.reload();
}
