// Generates the 1200x630 Open Graph cards used by WhatsApp / Instagram /
// Facebook when a Recess link is shared. Two templates, per the link-preview
// spec:
//
//   Template 1 — game invite (room link or /play/:slug). Amber card, "Recess"
//   wordmark top-left, the specific game's board/icon inside a white card,
//   "silence is safe here." below. One file per game:
//     public/og-tic-tac-toe.png
//     public/og-rock-paper-scissors.png
//     public/og-red-or-black.png
//
//   Template 2 — the bare app link. The logo mark + wordmark centered on the
//   amber background, tagline below — no game board:
//     public/og-app.png
//
// `public/og-image.png` is kept as an alias of the Tic Tac Toe card so any
// stale reference keeps resolving.
//
// Composition (all hand-rasterized, pure Node, zero deps):
//   - warm amber background (#F5A623)
//   - "Recess" wordmark (the R icon + "ecess" pixel type)
//   - a white rounded game card with an ink border holding the game's art
//   - "silence is safe here." in white pixel type below the card
//
// Usage:
//   node scripts/gen-og-image.mjs            # write public/og-*.png
//   node scripts/gen-og-image.mjs --ascii    # also print coarse previews
import { deflateSync, inflateSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";

const W = 1200;
const H = 630;

// ---- palette -------------------------------------------------------------
const AMBER = [0xf5, 0xa6, 0x23];
const INK = [0x1a, 0x1a, 0x1a];
const WHITE = [0xff, 0xff, 0xff];
const CREAM = [0xff, 0xf9, 0xe5];

/** A fresh canvas, pre-filled with the amber background. */
function newCanvas() {
  const img = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    img[i * 3] = AMBER[0];
    img[i * 3 + 1] = AMBER[1];
    img[i * 3 + 2] = AMBER[2];
  }
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    img[i] = c[0];
    img[i + 1] = c[1];
    img[i + 2] = c[2];
  };
  return { img, set };
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

const fillRoundedRect = (set, x0, y0, x1, y1, r, c) => {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      if (inRoundedRect(x, y, x0, y0, x1, y1, r)) set(x, y, c);
    }
  }
};

const strokeRoundedRect = (set, x0, y0, x1, y1, r, th, c) => {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const outer = inRoundedRect(x, y, x0, y0, x1, y1, r);
      const inner = inRoundedRect(x, y, x0 + th, y0 + th, x1 - th, y1 - th, Math.max(0, r - th));
      if (outer && !inner) set(x, y, c);
    }
  }
};

const fillCircle = (set, cx, cy, r, c) => {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (Math.hypot(x - cx, y - cy) <= r) set(x, y, c);
    }
  }
};

const strokeCircle = (set, cx, cy, r, th, c) => {
  const inner = r - th / 2;
  const outer = r + th / 2;
  for (let y = Math.floor(cy - outer); y <= Math.ceil(cy + outer); y++) {
    for (let x = Math.floor(cx - outer); x <= Math.ceil(cx + outer); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d >= inner && d <= outer) set(x, y, c);
    }
  }
};

const line = (set, ax, ay, bx, by, th, c) => {
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
function drawR(set, x0, y0, scale, c) {
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

/** Width of a string in the 5x7 font at the given scale/gap. */
function textWidth(text, scale, gap) {
  return text.length * (5 * scale + gap) - gap;
}

/** Draws a string with its baseline (bottom of the 7-row grid) at `baselineY`. */
function drawText(set, text, x0, baselineY, scale, gap, c) {
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
}

/** The "Recess" wordmark (R icon + "ecess") starting at (x0, y0). */
function wordmark(set, x0, y0, rScale, eScale, eGap, c) {
  const rSize = drawR(set, x0, y0, rScale, c);
  const eX = x0 + rSize.w + Math.round(26 * (rScale / 0.5));
  const eBaseline = y0 + rSize.h; // "ecess" baseline aligns with the R's foot
  drawText(set, "ecess", eX, eBaseline, eScale, eGap, c);
  return {
    w: rSize.w + Math.round(26 * (rScale / 0.5)) + textWidth("ecess", eScale, eGap),
    h: rSize.h,
  };
}

// ---------------------------------------------------------------------------
// Template 1 — a game card (white card + the game's art)
// ---------------------------------------------------------------------------

const CARD = { x0: 300, y0: 115, x1: 900, y1: 515, r: 30, border: 10 };

/** The Tic Tac Toe board: 3x3 ink grid, amber X's / ink O's, X O X / O X O / X O X. */
function drawTtt(set) {
  const CELL = 120;
  const BX = 420;
  const BY = 135;
  const GRID_TH = 10;
  line(set, BX + CELL, BY, BX + CELL, BY + 3 * CELL, GRID_TH, INK);
  line(set, BX + 2 * CELL, BY, BX + 2 * CELL, BY + 3 * CELL, GRID_TH, INK);
  line(set, BX, BY + CELL, BX + 3 * CELL, BY + CELL, GRID_TH, INK);
  line(set, BX, BY + 2 * CELL, BX + 3 * CELL, BY + 2 * CELL, GRID_TH, INK);

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
        line(set, cx - arm, cy - arm, cx + arm, cy + arm, MARK_TH, AMBER);
        line(set, cx + arm, cy - arm, cx - arm, cy + arm, MARK_TH, AMBER);
      } else {
        strokeCircle(set, cx, cy, O_R, O_TH, INK);
      }
    }
  }
}

/** The Rock Paper Scissors hand: two splayed finger pills over an amber palm,
 *  thumb angled down-out, palm creases. Ink outline via under-strokes. */
function drawRps(set) {
  const pill = (ax, ay, bx, by, th) => {
    line(set, ax, ay, bx, by, th + 10, INK);
    line(set, ax, ay, bx, by, th, AMBER);
  };
  // fingers — tops lean outward (scissors spread)
  pill(432, 412, 424, 232, 54);
  pill(546, 412, 554, 228, 54);
  // palm — drawn over the finger bases so the seam reads as a fold
  strokeRoundedRect(set, 392, 296, 586, 468, 46, 10, INK);
  fillRoundedRect(set, 402, 306, 576, 458, 36, AMBER);
  // thumb — angled down-out to the right, as in a scissors gesture
  pill(588, 352, 668, 392, 46);
  // palm creases
  line(set, 424, 356, 470, 344, 8, INK);
  line(set, 506, 348, 554, 338, 8, INK);
}

/** The Red or Black split card: cream card, amber top-left half, ink diagonal,
 *  one amber pip per half (mirroring the RedOrBlackArt icon). */
function drawRedBlack(set) {
  const X0 = 420;
  const Y0 = 175;
  const X1 = 780;
  const Y1 = 455;
  const R = 24;
  fillRoundedRect(set, X0, Y0, X1, Y1, R, CREAM);
  // amber top-left triangle: every point above the top-right -> bottom-left diagonal
  for (let y = Math.floor(Y0); y <= Math.ceil(Y1); y++) {
    for (let x = Math.floor(X0); x <= Math.ceil(X1); x++) {
      const diagY = Y0 + ((Y1 - Y0) / (X0 - X1)) * (x - X1);
      if (y <= diagY && inRoundedRect(x, y, X0, Y0, X1, Y1, R)) set(x, y, AMBER);
    }
  }
  strokeRoundedRect(set, X0, Y0, X1, Y1, R, 10, INK);
  line(set, X1 - 5, Y0 + 5, X0 + 5, Y1 - 5, 10, INK);
  // one pip per half
  const pip = (cx, cy) => {
    strokeCircle(set, cx, cy, 20, 9, INK);
    fillCircle(set, cx, cy, 15, AMBER);
  };
  pip(470, 245);
  pip(730, 385);
}

/** Renders a Template 1 game card to `outFile`. */
function renderGameCard(board, outFile) {
  const { img, set } = newCanvas();

  // Wordmark top-left.
  wordmark(set, 84, 52, 0.5, 9, 8, WHITE);

  // Small decorative dots top-right.
  fillCircle(set, 1052, 84, 9, WHITE);
  fillCircle(set, 1092, 118, 6, WHITE);
  fillCircle(set, 1004, 126, 5, WHITE);

  // The white game card with an ink border, centered.
  fillRoundedRect(set, CARD.x0, CARD.y0, CARD.x1, CARD.y1, CARD.r, WHITE);
  strokeRoundedRect(set, CARD.x0, CARD.y0, CARD.x1, CARD.y1, CARD.r, CARD.border, INK);

  if (board === "ttt") drawTtt(set);
  else if (board === "rps") drawRps(set);
  else drawRedBlack(set);

  // Tagline below the card.
  const tagline = "silence is safe here.";
  const tagScale = 8;
  const tagGap = 7;
  drawText(set, tagline, (W - textWidth(tagline, tagScale, tagGap)) / 2, 585, tagScale, tagGap, WHITE);

  writePng(outFile, img);
  console.log("wrote", outFile);
}

// ---------------------------------------------------------------------------
// Template 2 — the brand card: logo mark + wordmark centered on amber
// ---------------------------------------------------------------------------

function renderBrandCard(outFile) {
  const { img, set } = newCanvas();

  // Centered "Recess" wordmark. The R glyph's box is fixed (250x260 at
  // scale 1), so we can size the row without painting.
  const rScale = 0.9;
  const eScale = 15;
  const eGap = 13;
  const rSize = { w: 250 * rScale, h: 260 * rScale };
  const eX = rSize.w + Math.round(26 * (rScale / 0.5));
  const wmW = eX + textWidth("ecess", eScale, eGap);
  const wmH = rSize.h;
  const wmX = (W - wmW) / 2;
  const wmY = 110;
  wordmark(set, wmX, wmY, rScale, eScale, eGap, WHITE);

  // Tagline centered below.
  const tagline = "silence is safe here.";
  const tagScale = 8;
  const tagGap = 7;
  drawText(set, tagline, (W - textWidth(tagline, tagScale, tagGap)) / 2, wmY + wmH + 72, tagScale, tagGap, WHITE);

  // Decorative dots, top-right and bottom-left.
  fillCircle(set, 1052, 84, 9, WHITE);
  fillCircle(set, 1092, 118, 6, WHITE);
  fillCircle(set, 1004, 126, 5, WHITE);
  fillCircle(set, 150, 500, 7, WHITE);
  fillCircle(set, 190, 528, 4, WHITE);
  fillCircle(set, 112, 532, 3, WHITE);

  writePng(outFile, img);
  console.log("wrote", outFile);
}

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

function writePng(outFile, img) {
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
  writeFileSync(outFile, png);
}

// ---- main ----------------------------------------------------------------
renderGameCard("ttt", "public/og-tic-tac-toe.png");
renderGameCard("rps", "public/og-rock-paper-scissors.png");
renderGameCard("redblack", "public/og-red-or-black.png");
renderBrandCard("public/og-app.png");

// Alias kept for stale references — identical composition to the TTT card.
writeFileSync("public/og-image.png", readFileSync("public/og-tic-tac-toe.png"));

// ---- optional ASCII previews ---------------------------------------------
if (process.argv.includes("--ascii")) {
  const files = [
    "public/og-app.png",
    "public/og-tic-tac-toe.png",
    "public/og-rock-paper-scissors.png",
    "public/og-red-or-black.png",
  ];
  for (const f of files) {
    const b = readFileSync(f);
    // decode with the same approach as the encoder (RGB8, no filter variance
    // in our own files since we always write filter 0)
    let off = 8;
    let idat = [];
    let w = 0;
    let h = 0;
    while (off < b.length) {
      const len = b.readUInt32BE(off);
      const type = b.slice(off + 4, off + 8).toString("ascii");
      if (type === "IHDR") {
        w = b.readUInt32BE(off + 8);
        h = b.readUInt32BE(off + 12);
      }
      if (type === "IDAT") idat.push(b.slice(off + 8, off + 8 + len));
      if (type === "IEND") break;
      off += 12 + len;
    }
      const raw = inflateSync(Buffer.concat(idat));
    const px = (x, y) => {
      const row = y * (w * 3 + 1) + 1;
      return [raw[row + x * 3], raw[row + x * 3 + 1], raw[row + x * 3 + 2]];
    };
    console.log("\n=== " + f + " ===");
    const COLS = 96;
    const ROWS = 36;
    for (let row = 0; row < ROWS; row++) {
      let out = "";
      for (let col = 0; col < COLS; col++) {
        const x = Math.min(w - 1, Math.floor((col + 0.5) * (w / COLS)));
        const y = Math.min(h - 1, Math.floor((row + 0.5) * (h / ROWS)));
        const [r, g, b2] = px(x, y);
        if (r === 255 && g === 255 && b2 === 255) out += "#";
        else if (r === 0x1a && g === 0x1a && b2 === 0x1a) out += "@";
        else if (r === 0xff && g === 0xf9 && b2 === 0xe5) out += "+";
        else if (r === 0xf5 && g === 0xa6 && b2 === 0x23) out += ".";
        else out += "?";
      }
      console.log(out);
    }
  }
}
