// Generates the Recess PWA icon set — the amber rounded "R" badge (matches
// public/logo.svg and the AppIcon component) rasterized at every size the
// manifest + iOS home screen need. Pure Node, zero deps (same technique as
// scripts/gen-og-image.mjs).
//
// Outputs:
//   public/icons/icon-192.png         192x192  (any)
//   public/icons/icon-512.png         512x512  (any)
//   public/icons/icon-192-maskable.png 192x192 (maskable — full-bleed amber,
//                                              R kept inside the safe zone)
//   public/icons/icon-512-maskable.png 512x512 (maskable)
//   public/apple-touch-icon.png       180x180  (apple-touch-icon)
//
// Usage:
//   node scripts/gen-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const AMBER = [0xf5, 0xa6, 0x23];
const WHITE = [0xff, 0xff, 0xff];

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

// ---- the R glyph (the app icon) -----------------------------------------
// The glyph's bounding box is 250x260 in "R units"; `scale` maps units to px.
function rasterizeR(set, x0, y0, scale, c) {
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
}

// ---- PNG encoder ---------------------------------------------------------
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

function encodePng(size, img) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB (fully opaque)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0; // filter: none
    for (let x = 0; x < size * 3; x++) raw[y * (1 + size * 3) + 1 + x] = img[y * size * 3 + x];
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- icon rendering ------------------------------------------------------
/**
 * Render one icon.
 * @param {number} size side length in px
 * @param {{maskable?: boolean, rFill?: number}} opts
 *   maskable: full-bleed amber square (launcher crops it to a circle/rounded
 *   rect, so no rounded corners and the R stays inside the ~80% safe zone).
 *   rFill: R glyph height as a fraction of `size`.
 */
function renderIcon(size, { maskable = false, rFill = 0.55 } = {}) {
  const img = new Uint8Array(size * size * 3);
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 3;
    img[i] = c[0];
    img[i + 1] = c[1];
    img[i + 2] = c[2];
  };

  // Background: either the full square (maskable) or the rounded amber tile.
  if (maskable) {
    for (let i = 0; i < size * size; i++) {
      img[i * 3] = AMBER[0];
      img[i * 3 + 1] = AMBER[1];
      img[i * 3 + 2] = AMBER[2];
    }
  } else {
    const r = Math.round(size * 0.25); // matches logo.svg (rx 16/64)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (inRoundedRect(x, y, 0, 0, size, size, r)) set(x, y, AMBER);
      }
    }
  }

  // The R, centered in the tile.
  const scale = (size * rFill) / 260;
  const x0 = (size - 250 * scale) / 2;
  const y0 = (size - 260 * scale) / 2;
  rasterizeR(set, x0, y0, scale, WHITE);

  return encodePng(size, img);
}

mkdirSync("public/icons", { recursive: true });

const jobs = [
  ["public/icons/icon-192.png", renderIcon(192, { rFill: 0.55 })],
  ["public/icons/icon-512.png", renderIcon(512, { rFill: 0.55 })],
  ["public/icons/icon-192-maskable.png", renderIcon(192, { maskable: true, rFill: 0.4 })],
  ["public/icons/icon-512-maskable.png", renderIcon(512, { maskable: true, rFill: 0.4 })],
  ["public/apple-touch-icon.png", renderIcon(180, { rFill: 0.55 })],
];

for (const [file, png] of jobs) {
  writeFileSync(file, png);
  console.log("wrote", file, png.length, "bytes");
}

// ---- optional ASCII preview ----------------------------------------------
if (process.argv.includes("--ascii")) {
  const { inflateSync } = await import("node:zlib");
  const S = 192;
  const png = renderIcon(S, { rFill: 0.55 });
  // Locate IDAT, decompress raw scanlines.
  let offset = 8;
  let idat = Buffer.alloc(0);
  while (offset < png.length) {
    const len = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + len);
    if (type === "IDAT") idat = Buffer.concat([idat, data]);
    offset += 12 + len;
  }
  const raw = inflateSync(idat);
  const COLS = 48;
  const ROWS = 48;
  const sx = S / COLS;
  const sy = S / ROWS;
  let out = "";
  for (let row = 0; row < ROWS; row++) {
    let line = "";
    for (let col = 0; col < COLS; col++) {
      const x = Math.min(S - 1, Math.floor(col * sx + sx / 2));
      const y = Math.min(S - 1, Math.floor(row * sy + sy / 2));
      const i = y * (1 + S * 3) + 1 + x * 3;
      const r = raw[i];
      const g = raw[i + 1];
      const b = raw[i + 2];
      if (r === 255 && g === 255 && b === 255) line += "#";
      else if (r === 0xf5 && g === 0xa6 && b === 0x23) line += ".";
      else line += " ";
    }
    out += line + "\n";
  }
  console.log(out);
}
