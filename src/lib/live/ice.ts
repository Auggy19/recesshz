/**
 * ICE server resolution for live WebRTC.
 * Prefer ephemeral config from Edge (`getIceServers`); fall back to public STUN.
 * Optional static TURN via VITE_TURN_* (dev / small deployments).
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const DEFAULT_STUN: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function staticTurnFromEnv(): RTCIceServer[] {
  const url = import.meta.env.VITE_TURN_URL as string | undefined;
  if (!url) return [];
  const username = (import.meta.env.VITE_TURN_USERNAME as string) || undefined;
  const credential = (import.meta.env.VITE_TURN_CREDENTIAL as string) || undefined;
  if (username && credential) {
    return [{ urls: url.split(",").map((u) => u.trim()), username, credential }];
  }
  return [{ urls: url.split(",").map((u) => u.trim()) }];
}

export async function resolveIceServers(): Promise<RTCIceServer[]> {
  const staticTurn = staticTurnFromEnv();

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.functions.invoke("games", {
        body: { action: "getIceServers" },
      });
      if (
        !error &&
        data &&
        typeof data === "object" &&
        Array.isArray((data as { iceServers?: unknown }).iceServers)
      ) {
        const servers = (data as { iceServers: RTCIceServer[] }).iceServers;
        if (servers.length > 0) return servers;
      }
    } catch {
      /* fall through */
    }
  }

  return [...DEFAULT_STUN, ...staticTurn];
}

export { DEFAULT_STUN };
