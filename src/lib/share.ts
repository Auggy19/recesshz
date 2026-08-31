/**
 * Social / competition sharing helpers for Recess.
 */

export type SharePayload = {
  title: string;
  text: string;
  url: string;
};

export function buildChallengeShare(opts: {
  gameName: string;
  url: string;
  result?: "win" | "loss" | "draw" | null;
}): SharePayload {
  const { gameName, url, result } = opts;
  if (result === "win") {
    return {
      title: "Recess",
      text: `I just won ${gameName} on Recess — your move? ${url}`,
      url,
    };
  }
  if (result === "loss") {
    return {
      title: "Recess",
      text: `Tough match of ${gameName} on Recess. Rematch? ${url}`,
      url,
    };
  }
  return {
    title: "Recess",
    text: `You've been challenged to ${gameName} on Recess — play when you're free. ${url}`,
    url,
  };
}

export async function shareOrCopy(payload: SharePayload): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      return "shared";
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "failed";
  }
  try {
    await navigator.clipboard.writeText(`${payload.text}`);
    return "copied";
  } catch {
    return "failed";
  }
}

export function whatsAppShareHref(payload: SharePayload): string {
  return `https://wa.me/?text=${encodeURIComponent(payload.text)}`;
}

export function twitterShareHref(payload: SharePayload): string {
  const q = new URLSearchParams({
    text: payload.text,
    url: payload.url,
  });
  return `https://twitter.com/intent/tweet?${q.toString()}`;
}
