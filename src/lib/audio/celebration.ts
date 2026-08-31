/** Adaptive win/lose celebration cues via Web Audio API. */

export type CelebrationKind = "win" | "lose" | "draw" | "point" | "live_connect";

const STORAGE_KEY = "recess_sound_pref";

export function getSoundEnabled(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "off") return false;
    if (v === "on") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    /* ignore */
  }
}

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) ctx = new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  ac: AudioContext,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  gain = 0.08,
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export async function playCelebration(kind: CelebrationKind): Promise<void> {
  if (!getSoundEnabled()) return;
  const ac = audioCtx();
  if (!ac) return;
  if (ac.state === "suspended") {
    try {
      await ac.resume();
    } catch {
      return;
    }
  }
  const t0 = ac.currentTime;

  switch (kind) {
    case "win":
      tone(ac, 392, t0, 0.18, "sine", 0.09);
      tone(ac, 494, t0 + 0.12, 0.18, "sine", 0.09);
      tone(ac, 587, t0 + 0.24, 0.28, "triangle", 0.1);
      break;
    case "lose":
      tone(ac, 330, t0, 0.22, "sine", 0.07);
      tone(ac, 247, t0 + 0.15, 0.3, "sine", 0.06);
      break;
    case "draw":
      tone(ac, 440, t0, 0.15, "sine", 0.06);
      tone(ac, 440, t0 + 0.2, 0.15, "sine", 0.05);
      break;
    case "point":
      tone(ac, 520, t0, 0.1, "triangle", 0.05);
      break;
    case "live_connect":
      tone(ac, 600, t0, 0.08, "sine", 0.05);
      tone(ac, 800, t0 + 0.08, 0.12, "sine", 0.06);
      break;
  }
}
