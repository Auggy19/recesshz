const KEY = "recess_guest_rounds";
export const GUEST_ROUND_LIMIT = 5;

export function readGuestRounds(): number {
  try {
    const n = Number(window.localStorage.getItem(KEY) ?? "0");
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function incrementGuestRounds(): number {
  const next = readGuestRounds() + 1;
  try {
    window.localStorage.setItem(KEY, String(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function shouldPromptAccount(): boolean {
  return readGuestRounds() >= GUEST_ROUND_LIMIT;
}
