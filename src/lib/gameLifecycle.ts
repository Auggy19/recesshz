/**
 * Client helpers for room lifecycle on the free tier.
 * Authoritative expiry still lives on the Edge Function (EXPIRY_MS).
 */

export const ROOM_TTL_MS = 48 * 60 * 60 * 1000;

export function roomExpiresAt(createdAtIso: string | null | undefined): Date | null {
  if (!createdAtIso) return null;
  const t = Date.parse(createdAtIso);
  if (Number.isNaN(t)) return null;
  return new Date(t + ROOM_TTL_MS);
}

export function isRoomExpired(createdAtIso: string | null | undefined, now = Date.now()): boolean {
  const exp = roomExpiresAt(createdAtIso);
  if (!exp) return false;
  return now >= exp.getTime();
}

export function formatTtlRemaining(createdAtIso: string | null | undefined, now = Date.now()): string {
  const exp = roomExpiresAt(createdAtIso);
  if (!exp) return "";
  const ms = exp.getTime() - now;
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return `${Math.floor(h / 24)}d left`;
  if (h >= 1) return `${h}h left`;
  const m = Math.max(1, Math.floor(ms / 60_000));
  return `${m}m left`;
}
