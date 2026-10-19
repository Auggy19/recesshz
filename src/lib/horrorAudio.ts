/** Lightweight Web Audio horror bed — no external assets. */

let ctx: AudioContext | null = null;

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function sfxBreath() {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.value = 90;
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.08, c.currentTime + 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.8);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + 1.9);
}

export function sfxBlinkLunge() {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(120, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.25);
  g.gain.setValueAtTime(0.12, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.35);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.36);
}

export function sfxFootstep() {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "triangle";
  o.frequency.value = 55 + Math.random() * 20;
  g.gain.setValueAtTime(0.06, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.2);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.22);
}

export function sfxWhisper() {
  const c = ac();
  const bufferSize = 2 * c.sampleRate;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.02;
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.04, c.currentTime + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.2);
  noise.connect(g);
  g.connect(c.destination);
  noise.start();
  noise.stop(c.currentTime + 1.25);
}

export function sfxJumpscare() {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(80, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(400, c.currentTime + 0.15);
  o.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.8);
  g.gain.setValueAtTime(0.2, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.9);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.95);
}
