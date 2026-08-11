// Generates public/og-image.png — 1200x630 amber card with the Recess
// wordmark in white (the "reversed on amber" variant: icon IS the R).
// Pure Node, no deps: rasterizes an R glyph + a 5x7 pixel font for "ecess".
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const W = 1200;
const H = 630;

// ---- palette -------------------------------------------------------------
const AMBER = [0xf5, 0xa6, 0x23];
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

// ---- distance helpers ----------------------------------------------------
const distToSeg = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
};

// ---- wordmark layout -----------------------------------------------------
// R (the icon) spans roughly 250px wide x 260px tall; "ecess" follows.
const rX0 = 224;
const rY0 = 185;
const R_H = 260;
const R_W = 250;

// 5x7 pixel font rows for "ecess"
const FONT = {
  e: [
    "01110",
    "10001",
    "10000",
    "11110",
    "10000",
    "10001",
    "01110",
  ],
  c: [
    "01110",
    "10001",
    "10000",
    "10000",
    "10000",
    "10001",
    "01110",
  ],
  s: [
    "01111",
    "10000",
    "10000",
    "01110",
    "00001",
    "00001",
    "11110",
  ],
};

const SCALE = 17;
const LETTER_W = 5 * SCALE;
const GAP = 10;
const ecessX0 = rX0 + R_W + 36;
const ecessY0 = rY0 + R_H - 7 * SCALE; // baseline aligned with the R

// ---- rasterize the R -----------------------------------------------------
const stemX = rX0;
const stemW = 50;
const bowlCx = rX0 + 135;
const bowlCy = rY0 + 115;
const bowlR = 90;
const holeR = 45;
const legA = [rX0 + 118, rY0 + 160];
const legB = [rX0 + 205, rY0 + 260];
const legTh = 22;

for (let y = rY0; y < rY0 + R_H; y++) {
  for (let x = rX0; x < rX0 + R_W; x++) {
    let inR = false;
    if (x >= stemX && x < stemX + stemW && y >= rY0 && y < rY0 + R_H) inR = true;
    const dC = Math.hypot(x - bowlCx, y - bowlCy);
    if (y <= bowlCy && dC <= bowlR && dC >= holeR) inR = true;
    if (distToSeg(x, y, legA[0], legA[1], legB[0], legB[1]) <= legTh) inR = true;
    if (inR) set(x, y, WHITE);
  }
}

// ---- rasterize "ecess" ---------------------------------------------------
const letters = ["e", "c", "e", "s", "s"];
letters.forEach((ch, li) => {
  const glyph = FONT[ch];
  const lx = ecessX0 + li * (LETTER_W + GAP);
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (glyph[row][col] === "1") {
        for (let dy = 0; dy < SCALE; dy++) {
          for (let dx = 0; dx < SCALE; dx++) {
            set(lx + col * SCALE + dx, ecessY0 + row * SCALE + dy, WHITE);
          }
        }
      }
    }
  }
});

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
  img.copy ? null : null;
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
