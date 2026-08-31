/** Competition-friendly social share helpers. */

export type SharePayload = {
  title: string;
  text: string;
  url: string;
};

export function buildMatchShare(opts: {
  gameName: string;
  result: "won" | "lost" | "drew" | "playing";
  scoreLine?: string;
  roomUrl: string;
}): SharePayload {
  const emoji =
    opts.result === "won"
      ? "🏆"
      : opts.result === "lost"
        ? "💪"
        : opts.result === "drew"
          ? "🤝"
          : "🎮";
  const verb =
    opts.result === "won"
      ? "I just won"
      : opts.result === "lost"
        ? "Close one in"
        : opts.result === "drew"
          ? "We drew in"
          : "Playing";
  const score = opts.scoreLine ? ` ${opts.scoreLine}` : "";
  return {
    title: `Recess — ${opts.gameName}`,
    text: `${emoji} ${verb} ${opts.gameName} on Recess.${score} Your move?`,
    url: opts.roomUrl,
  };
}

export async function shareMatch(
  payload: SharePayload,
): Promise<"shared" | "copied" | "failed"> {
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
    if (err instanceof Error && err.name === "AbortError") return "failed";
  }
  try {
    await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`);
    return "copied";
  } catch {
    return "failed";
  }
}

export function shareUrlForRoom(
  slug: string,
  origin = typeof window !== "undefined" ? window.location.origin : "",
): string {
  return `${origin}/play/${slug}`;
}
