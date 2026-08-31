/**
 * Adaptive win/loss celebrations — Web Audio (no external assets).
 * Respects prefers-reduced-motion and stored mute preference.
 */

export type CelebrationKind = "win" | "draw" | "loss" | "point" | "live";

const MUTE_KEY = "recess_sfx_muted";

export function isSfxMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSfxMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

let sharedCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!sharedCtx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      sharedCtx = new AC();
    }
    if (sharedCtx.state === "suspended") void sharedCtx.resume();
    return sharedCtx;
  } catch {
    return null;
  }
}

function tone(
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
  gain = 0.08,
) {
  const ac = ctx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  g.gain.value = 0.0001;
  osc.connect(g);
  g.connect(ac.destination);
  const t0 = ac.currentTime + start;
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function playCelebration(kind: CelebrationKind): void {
  if (isSfxMuted() || prefersReducedMotion()) return;
  try {
    switch (kind) {
      case "win":
        tone(523.25, 0, 0.12, "triangle", 0.09);
        tone(659.25, 0.1, 0.12, "triangle", 0.09);
        tone(783.99, 0.2, 0.18, "triangle", 0.1);
        tone(1046.5, 0.32, 0.22, "sine", 0.07);
        break;
      case "point":
        tone(660, 0, 0.08, "sine", 0.06);
        tone(880, 0.07, 0.1, "sine", 0.05);
        break;
      case "draw":
        tone(440, 0, 0.15, "triangle", 0.06);
        tone(415, 0.12, 0.18, "triangle", 0.05);
        break;
      case "loss":
        tone(320, 0, 0.16, "sawtooth", 0.04);
        tone(240, 0.12, 0.2, "sawtooth", 0.03);
        break;
      case "live":
        tone(520, 0, 0.06, "sine", 0.05);
        tone(780, 0.05, 0.08, "sine", 0.04);
        break;
    }
  } catch {
    /* audio blocked */
  }
}

export const CELEBRATION_COPY: Record<CelebrationKind, string> = {
  win: "You take it.",
  draw: "Shared honors.",
  loss: "Close one.",
  point: "Point.",
  live: "You're live.",
};
