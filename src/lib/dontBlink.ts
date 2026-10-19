/** DON'T BLINK — pure room logic. Monsters only step when unwatched and unlit. */

export const DONT_BLINK_GAME_TYPE = "dont_blink" as const;

export type Cell = "." | "#" | "P" | "M" | "K" | "L" | "E";

export type Pos = { x: number; y: number };

export type DontBlinkState = {
  w: number;
  h: number;
  walls: boolean[][];
  player: Pos;
  facing: Pos; // unit vector
  monsters: Pos[];
  keys: Pos[];
  lamps: { pos: Pos; on: boolean }[];
  exit: Pos;
  keysHeld: number;
  keysNeeded: number;
  watching: boolean;
  timeLeft: number;
  status: "play" | "win" | "lose";
  message: string;
};

const LEVEL: string[] = [
  "###########",
  "#P..L..K..#",
  "#.###.###.#",
  "#...M.....#",
  "###.#.#.###",
  "#K..L..M.E#",
  "#.###.###.#",
  "#...M.....#",
  "###########",
];

function inBounds(s: DontBlinkState, p: Pos) {
  return p.x >= 0 && p.y >= 0 && p.x < s.w && p.y < s.h;
}

function isWall(s: DontBlinkState, p: Pos) {
  return !inBounds(s, p) || s.walls[p.y][p.x];
}

/** Line of sight from player along facing (and slight cone). */
export function isWatched(s: DontBlinkState, target: Pos): boolean {
  if (!s.watching) return false;
  const dx = target.x - s.player.x;
  const dy = target.y - s.player.y;
  if (dx === 0 && dy === 0) return true;
  // Must be roughly in facing hemisphere
  const dot = dx * s.facing.x + dy * s.facing.y;
  if (dot <= 0) return false;
  // Bresenham-ish clear path
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 1; i <= steps; i++) {
    const x = s.player.x + Math.round((dx * i) / steps);
    const y = s.player.y + Math.round((dy * i) / steps);
    if (x === target.x && y === target.y) return true;
    if (s.walls[y][x]) return false;
  }
  return true;
}

export function isLit(s: DontBlinkState, p: Pos): boolean {
  return s.lamps.some(
    (l) =>
      l.on &&
      Math.abs(l.pos.x - p.x) + Math.abs(l.pos.y - p.y) <= 2,
  );
}

export function freshDontBlinkState(timeLeft = 90): DontBlinkState {
  const h = LEVEL.length;
  const w = LEVEL[0].length;
  const walls = Array.from({ length: h }, () => Array(w).fill(false));
  let player = { x: 1, y: 1 };
  const monsters: Pos[] = [];
  const keys: Pos[] = [];
  const lamps: { pos: Pos; on: boolean }[] = [];
  let exit = { x: w - 2, y: h - 2 };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = LEVEL[y][x] as Cell;
      if (c === "#") walls[y][x] = true;
      if (c === "P") player = { x, y };
      if (c === "M") monsters.push({ x, y });
      if (c === "K") keys.push({ x, y });
      if (c === "L") lamps.push({ pos: { x, y }, on: true });
      if (c === "E") exit = { x, y };
    }
  }

  return {
    w,
    h,
    walls,
    player,
    facing: { x: 1, y: 0 },
    monsters,
    keys,
    lamps,
    exit,
    keysHeld: 0,
    keysNeeded: keys.length,
    watching: true,
    timeLeft,
    status: "play",
    message: "Hold Watch. Monsters freeze when you look. Toggle lights. Get the keys.",
  };
}

export function setWatching(s: DontBlinkState, watching: boolean): DontBlinkState {
  if (s.status !== "play") return s;
  return { ...s, watching, message: watching ? "Eyes open." : "You looked away…" };
}

export function toggleNearestLamp(s: DontBlinkState): DontBlinkState {
  if (s.status !== "play") return s;
  let best = -1;
  let bestD = 99;
  s.lamps.forEach((l, i) => {
    const d = Math.abs(l.pos.x - s.player.x) + Math.abs(l.pos.y - s.player.y);
    if (d < bestD && d <= 2) {
      bestD = d;
      best = i;
    }
  });
  if (best < 0) return { ...s, message: "No lamp within reach." };
  const lamps = s.lamps.map((l, i) =>
    i === best ? { ...l, on: !l.on } : l,
  );
  return {
    ...s,
    lamps,
    message: lamps[best].on ? "Lamp on." : "Lamp off — dark moves faster.",
  };
}

export function tryMove(s: DontBlinkState, dx: number, dy: number): DontBlinkState {
  if (s.status !== "play") return s;
  const next = { x: s.player.x + dx, y: s.player.y + dy };
  if (isWall(s, next)) return { ...s, facing: { x: dx, y: dy } };
  if (s.monsters.some((m) => m.x === next.x && m.y === next.y))
    return { ...s, status: "lose", message: "Caught. Don't blink." };

  let keys = s.keys;
  let keysHeld = s.keysHeld;
  const took = keys.findIndex((k) => k.x === next.x && k.y === next.y);
  if (took >= 0) {
    keys = keys.filter((_, i) => i !== took);
    keysHeld += 1;
  }

  let status = s.status;
  let message = took >= 0 ? `Key ${keysHeld}/${s.keysNeeded}` : s.message;
  if (next.x === s.exit.x && next.y === s.exit.y) {
    if (keysHeld >= s.keysNeeded) {
      status = "win";
      message = "You made it. Eyes open.";
    } else {
      message = `Door needs ${s.keysNeeded - keysHeld} more key(s).`;
    }
  }

  return {
    ...s,
    player: next,
    facing: { x: dx, y: dy },
    keys,
    keysHeld,
    status,
    message,
  };
}

/** One monster AI step — only if not watched and not lit. */
export function tickMonsters(s: DontBlinkState): DontBlinkState {
  if (s.status !== "play") return s;
  const monsters = s.monsters.map((m) => {
    if (isWatched(s, m) || isLit(s, m)) return m;
    const opts = [
      { x: m.x + Math.sign(s.player.x - m.x), y: m.y },
      { x: m.x, y: m.y + Math.sign(s.player.y - m.y) },
      { x: m.x + 1, y: m.y },
      { x: m.x - 1, y: m.y },
      { x: m.x, y: m.y + 1 },
      { x: m.x, y: m.y - 1 },
    ];
    for (const n of opts) {
      if (isWall(s, n)) continue;
      if (s.monsters.some((o) => o !== m && o.x === n.x && o.y === n.y)) continue;
      return n;
    }
    return m;
  });

  const hit = monsters.some(
    (m) => m.x === s.player.x && m.y === s.player.y,
  );
  if (hit) {
    return { ...s, monsters, status: "lose", message: "It moved when you looked away." };
  }
  return { ...s, monsters };
}

export function tickTime(s: DontBlinkState, dt: number): DontBlinkState {
  if (s.status !== "play") return s;
  const timeLeft = Math.max(0, s.timeLeft - dt);
  if (timeLeft <= 0) {
    return { ...s, timeLeft: 0, status: "lose", message: "Time. The dark wins." };
  }
  return { ...s, timeLeft };
}
