// Generates public/og-image.png — the 1200x630 "game card" preview used by
// WhatsApp / Instagram / Facebook when a Recess game link is shared.
//
// Composition (all hand-rasterized, pure Node, zero deps):
//   - warm amber background (#F5A623)
//   - "Recess" wordmark top-left (the R icon + "ecess" pixel type)
//   - a white rounded game card with an ink border, holding a tic-tac-toe
//     board (amber X's, ink O's) — the "game card preview"
//   - "silence is safe here." in white pixel type below the card
//
// Usage:
//   node scripts/gen-og-image.mjs            # write public/og-image.png
//   node scripts/gen-og-image.mjs --ascii    # also print a coarse preview
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const W = 1200;
const H = 630;

// ---- palette -------------------------------------------------------------
const AMBER = [0xf5, 0xa6, 0x23];
const INK = [0x1a, 0x1a, 0x1a];
const WHITE = [0xff, 0xff, 0xff];

const img = new Uint8Array(W * H * 3);
const set = (x, y, c) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  img[i] = c[0];
  img[i + 1] = c[1];
  img[i + 2] = c[2];
};
for (let i = 0; i < W * H; i++) {
  img[i * 3] = AMBER[0];
  img[i * 3 + 1] = AMBER[1];
  img[i * 3 + 2] = AMBER[2];
}

// ---- geometry helpers ----------------------------------------------------
const distToSeg = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
};

const inRoundedRect = (px, py, x0, y0, x1, y1, r) => {
  if (px < x0 || px > x1 || py < y0 || py > y1) return false;
  const qx = Math.max(x0 + r, Math.min(px, x1 - r));
  const qy = Math.max(y0 + r, Math.min(py, y1 - r));
  const d2 = (px - qx) ** 2 + (py - qy) ** 2;
  return d2 <= r * r;
};

const fillRoundedRect = (x0, y0, x1, y1, r, c) => {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      if (inRoundedRect(x, y, x0, y0, x1, y1, r)) set(x, y, c);
    }
  }
};

const strokeRoundedRect = (x0, y0, x1, y1, r, th, c) => {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const outer = inRoundedRect(x, y, x0, y0, x1, y1, r);
      const inner = inRoundedRect(x, y, x0 + th, y0 + th, x1 - th, y1 - th, Math.max(0, r - th));
      if (outer && !inner) set(x, y, c);
    }
  }
};

const fillCircle = (cx, cy, r, c) => {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (Math.hypot(x - cx, y - cy) <= r) set(x, y, c);
    }
  }
};

const strokeCircle = (cx, cy, r, th, c) => {
  const inner = r - th / 2;
  const outer = r + th / 2;
  for (let y = Math.floor(cy - outer); y <= Math.ceil(cy + outer); y++) {
    for (let x = Math.floor(cx - outer); x <= Math.ceil(cx + outer); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d >= inner && d <= outer) set(x, y, c);
    }
  }
};

const line = (ax, ay, bx, by, th, c) => {
  const r = th / 2;
  const x0 = Math.floor(Math.min(ax, bx) - r);
  const x1 = Math.ceil(Math.max(ax, bx) + r);
  const y0 = Math.floor(Math.min(ay, by) - r);
  const y1 = Math.ceil(Math.max(ay, by) + r);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (distToSeg(x, y, ax, ay, bx, by) <= r) set(x, y, c);
    }
  }
};

// ---- the R glyph (the app icon) -----------------------------------------
function drawR(x0, y0, scale, c) {
  const stemX = x0;
  const stemW = 50 * scale;
  const bowlCx = x0 + 135 * scale;
  const bowlCy = y0 + 115 * scale;
  const bowlR = 90 * scale;
  const holeR = 45 * scale;
  const legA = [x0 + 118 * scale, y0 + 160 * scale];
  const legB = [x0 + 205 * scale, y0 + 260 * scale];
  const legTh = 22 * scale;
  const R_W = 250 * scale;
  const R_H = 260 * scale;
  for (let y = Math.floor(y0); y < Math.ceil(y0 + R_H); y++) {
    for (let x = Math.floor(x0); x < Math.ceil(x0 + R_W); x++) {
      let inR = false;
      if (x >= stemX && x < stemX + stemW && y >= y0 && y < y0 + R_H) inR = true;
      const dC = Math.hypot(x - bowlCx, y - bowlCy);
      if (y <= bowlCy && dC <= bowlR && dC >= holeR) inR = true;
      if (distToSeg(x, y, legA[0], legA[1], legB[0], legB[1]) <= legTh) inR = true;
      if (inR) set(x, y, c);
    }
  }
  return { w: R_W, h: R_H };
}

// ---- 5x7 pixel type ------------------------------------------------------
// Only the glyphs we need (all lowercase + a period).
const FONT = {
  a: ["01110", "00001", "01111", "10001", "10001", "10001", "01111"],
  c: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  e: ["01110", "10001", "10000", "11110", "10000", "10001", "01110"],
  f: ["00111", "01000", "01000", "11110", "01000", "01000", "01000"],
  h: ["10000", "10000", "10000", "11110", "10001", "10001", "10001"],
  i: ["00100", "00000", "00100", "00100", "00100", "00100", "00100"],
  l: ["00100", "00100", "00100", "00100", "00100", "00100", "00100"],
  n: ["00000", "00000", "11110", "10001", "10001", "10001", "10001"],
  r: ["00000", "00000", "10110", "11000", "10000", "10000", "10000"],
  s: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
};

/** Draws a string with its baseline (bottom of the 7-row grid) at `baselineY`. */
function drawText(text, x0, baselineY, scale, gap, c) {
  const top = baselineY - 7 * scale;
  const pitch = 5 * scale + gap;
  let x = x0;
  for (const ch of text) {
    if (ch === " ") {
      x += pitch;
      continue;
    }
    const glyph = FONT[ch];
    if (!glyph) {
      x += pitch;
      continue;
    }
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === "1") {
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              set(x + col * scale + dx, top + row * scale + dy, c);
            }
          }
        }
      }
    }
    x += pitch;
  }
  // Total advance of the whole string (for centering callers).
  return text.length * pitch - gap;
}

// ---- layout --------------------------------------------------------------
// Wordmark top-left: R icon (scale 0.5) + "ecess" (5x7 type at scale 9).
const R_SCALE = 0.5;
const rX0 = 84;
const rY0 = 52;
const rSize = drawR(rX0, rY0, R_SCALE, WHITE);
const ecessScale = 9;
const ecessGap = 8;
const ecessX0 = rX0 + rSize.w + 26;
const ecessY0 = rY0 + rSize.h; // baseline of "ecess" aligns with the R's foot
drawText("ecess", ecessX0, ecessY0, ecessScale, ecessGap, WHITE);

// Small decorative dots top-right.
fillCircle(1052, 84, 9, WHITE);
fillCircle(1092, 118, 6, WHITE);
fillCircle(1004, 126, 5, WHITE);

// The game card — white rounded card with an ink border, centered.
const CARD = { x0: 300, y0: 115, x1: 900, y1: 515, r: 30, border: 10 };
fillRoundedRect(CARD.x0, CARD.y0, CARD.x1, CARD.y1, CARD.r, WHITE);
strokeRoundedRect(CARD.x0, CARD.y0, CARD.x1, CARD.y1, CARD.r, CARD.border, INK);

// Tic-tac-toe board inside the card: 3x3 of 120px cells, ink grid.
const CELL = 120;
const BX = 420;
const BY = 135;
const GRID_TH = 10;
line(BX + CELL, BY, BX + CELL, BY + 3 * CELL, GRID_TH, INK);
line(BX + 2 * CELL, BY, BX + 2 * CELL, BY + 3 * CELL, GRID_TH, INK);
line(BX, BY + CELL, BX + 3 * CELL, BY + CELL, GRID_TH, INK);
line(BX, BY + 2 * CELL, BX + 3 * CELL, BY + 2 * CELL, GRID_TH, INK);

// Marks — X on the diagonal + corners (amber), O elsewhere (ink), mirroring
// the TicTacToeArt icon: X O X / O X O / X O X.
const MARK_TH = 20;
const O_R = 38;
const O_TH = 18;
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 3; c++) {
    const cx = BX + c * CELL + CELL / 2;
    const cy = BY + r * CELL + CELL / 2;
    const isX = (r + c) % 2 === 0;
    if (isX) {
      const arm = 34;
      line(cx - arm, cy - arm, cx + arm, cy + arm, MARK_TH, AMBER);
      line(cx + arm, cy - arm, cx - arm, cy + arm, MARK_TH, AMBER);
    } else {
      strokeCircle(cx, cy, O_R, O_TH, INK);
    }
  }
}

// Tagline below the card.
const tagline = "silence is safe here.";
const tagScale = 8;
const tagGap = 7;
const tagWidth = tagline.length * (5 * tagScale + tagGap) - tagGap;
const tagX = (W - tagWidth) / 2;
drawText(tagline, tagX, 585, tagScale, tagGap, WHITE);

// ---- PNG encoding --------------------------------------------------------
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type RGB
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0; // filter: none
  for (let x = 0; x < W * 3; x++) raw[y * (1 + W * 3) + 1 + x] = img[y * W * 3 + x];
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync("public/og-image.png", png);
console.log("wrote public/og-image.png", png.length, "bytes");

// ---- optional ASCII preview ----------------------------------------------
if (process.argv.includes("--ascii")) {
  const COLS = 80;
  const ROWS = 42;
  const sx = W / COLS;
  const sy = H / ROWS;
  const charFor = (x, y) => {
    const i = (y * W + x) * 3;
    const r = img[i];
    const g = img[i + 1];
    const b = img[i + 2];
    if (r === 255 && g === 255 && b === 255) return "#";
    if (r === 0x1a && g === 0x1a && b === 0x1a) return "@";
    if (r === 0xf5 && g === 0xa6 && b === 0x23) return ".";
    return "?";
  };
  for (let row = 0; row < ROWS; row++) {
    let outRow = "";
    for (let col = 0; col < COLS; col++) {
      outRow += charFor(Math.min(W - 1, Math.floor(col * sx + sx / 2)), Math.min(H - 1, Math.floor(row * sy + sy / 2)));
    }
    console.log(outRow);
  }
}
