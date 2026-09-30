/** Parse a pasted Recess link or raw room code into a slug. */
export function parseRoomInput(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;

  try {
    if (/^https?:\/\//i.test(t) || t.startsWith("playrecessapp.vercel.app")) {
      const url = t.startsWith("http") ? new URL(t) : new URL(`https://${t}`);
      const parts = url.pathname.split("/").filter(Boolean);
      const playIdx = parts.indexOf("play");
      if (playIdx >= 0 && parts[playIdx + 1]) return sanitizeSlug(parts[playIdx + 1]);
      const q = url.searchParams.get("join") || url.searchParams.get("room");
      if (q) return sanitizeSlug(q);
    }
  } catch {
    /* fall through */
  }

  const last = t.split("/").filter(Boolean).pop() ?? t;
  return sanitizeSlug(last);
}

export function sanitizeSlug(value: string): string | null {
  const slug = value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  if (slug.length < 3) return null;
  return slug;
}

/** Short shareable codes (no 0/O/1/I). */
export function mintRoomCode(length = 6): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
